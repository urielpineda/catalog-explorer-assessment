// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { Cache } from '../cache/cache.interface';
import { OpenLibraryClient } from '../upstream/open-library-client.interface';
import {
  toDomainWork,
  toDomainWorkDetail,
  toDomainEdition,
  extractAuthorIds,
} from '../domain/open-library.mapper';
import { Work, WorkDetail, Edition, PageInfo } from '../proto/gen/catalog';
import { withRetry } from '../common/retry';
import { withTimeout } from '../common/timeout';
import { mapWithConcurrency } from '../common/concurrency';
import {
  InvalidArgumentError,
  NotFoundError,
  UpstreamUnavailableError,
  UpstreamNotFoundError,
} from '../common/errors';

const POSITIVE_TTL_MS = 10 * 60_000; // search results and work/edition data are equally stable
const WORK_NEGATIVE_TTL_MS = 2 * 60_000;
const REQUEST_TIMEOUT_MS = 3_000;
const RETRY_ATTEMPTS = 2;
const RETRY_BASE_MS = 100;
const MAX_LIMIT = 100;
const AUTHOR_FANOUT_LIMIT = 5;

function isRetryableUpstreamError(error: unknown): boolean {
  return !(error instanceof UpstreamNotFoundError);
}

export interface SearchResult {
  results: Work[];
  page: PageInfo;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function searchCacheKey(query: string, page: number, limit: number): string {
  return JSON.stringify({ q: normalizeQuery(query), page, limit });
}

function workCacheKey(id: string): string {
  return `work:${id.trim()}`;
}

export interface EditionsResult {
  editions: Edition[];
  page: PageInfo;
}

function editionsNotFoundKey(workId: string): string {
  return `editions-notfound:${workId.trim()}`;
}

function editionsCacheKey(workId: string, page: number, limit: number): string {
  return `editions:${workId.trim()}:${page}:${limit}`;
}

export class CatalogService {
  // Concurrent identical misses collapse onto one in-flight promise instead
  // of each independently calling upstream (request coalescing).
  private readonly inFlightSearches = new Map<string, Promise<SearchResult>>();
  private readonly inFlightWorks = new Map<string, Promise<WorkDetail>>();
  private readonly inFlightEditions = new Map<string, Promise<EditionsResult>>();

  constructor(
    private readonly upstream: OpenLibraryClient,
    private readonly cache: Cache,
  ) {}

  async search(query: string, page: number, limit: number): Promise<SearchResult> {
    if (!query?.trim()) {
      throw new InvalidArgumentError('q is required');
    }
    if (page < 1) {
      throw new InvalidArgumentError('page must be >= 1');
    }
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new InvalidArgumentError(`limit must be between 1 and ${MAX_LIMIT}`);
    }

    const key = searchCacheKey(query, page, limit);

    const cached = await this.cache.get<SearchResult>(key);
    if (cached) return cached.value as SearchResult;

    const inFlight = this.inFlightSearches.get(key);
    if (inFlight) return inFlight;

    const fetchPromise = this.fetchAndCacheSearch(key, query, page, limit).finally(() => {
      this.inFlightSearches.delete(key);
    });
    this.inFlightSearches.set(key, fetchPromise);
    return fetchPromise;
  }

  private async fetchAndCacheSearch(
    key: string,
    query: string,
    page: number,
    limit: number,
  ): Promise<SearchResult> {
    let raw;
    try {
      raw = await withRetry(
        () => withTimeout(this.upstream.search(query, page, limit), REQUEST_TIMEOUT_MS),
        { attempts: RETRY_ATTEMPTS, baseMs: RETRY_BASE_MS, isRetryable: isRetryableUpstreamError },
      );
    } catch (error) {
      throw new UpstreamUnavailableError(`search upstream call failed: ${(error as Error).message}`);
    }

    const result: SearchResult = {
      results: raw.docs.map(toDomainWork),
      page: {
        page,
        limit,
        total: raw.numFound,
        hasNext: page * limit < raw.numFound,
      },
    };
    await this.cache.set(key, result, POSITIVE_TTL_MS);
    return result;
  }

  async getWork(id: string): Promise<WorkDetail> {
    if (!id?.trim()) {
      throw new InvalidArgumentError('id is required');
    }

    const key = workCacheKey(id);

    const cached = await this.cache.get<WorkDetail>(key);
    if (cached) {
      if (cached.value === null) {
        throw new NotFoundError(`work ${id} not found`);
      }
      return cached.value;
    }

    const inFlight = this.inFlightWorks.get(key);
    if (inFlight) return inFlight;

    const fetchPromise = this.fetchAndCacheWork(key, id).finally(() => {
      this.inFlightWorks.delete(key);
    });
    this.inFlightWorks.set(key, fetchPromise);
    return fetchPromise;
  }

  private async fetchAndCacheWork(key: string, id: string): Promise<WorkDetail> {
    let raw;
    try {
      raw = await withRetry(
        () => withTimeout(this.upstream.getWork(id), REQUEST_TIMEOUT_MS),
        { attempts: RETRY_ATTEMPTS, baseMs: RETRY_BASE_MS, isRetryable: isRetryableUpstreamError },
      );
    } catch (error) {
      if (error instanceof UpstreamNotFoundError) {
        await this.cache.set(key, null, WORK_NEGATIVE_TTL_MS);
        throw new NotFoundError(`work ${id} not found`);
      }
      // Transient failure: never cached, so the next call gets a fresh try.
      throw new UpstreamUnavailableError(`getWork upstream call failed: ${(error as Error).message}`);
    }

    const authorIds = extractAuthorIds(raw);
    const authorResults = await mapWithConcurrency(authorIds, AUTHOR_FANOUT_LIMIT, (authorId) =>
      withRetry(() => withTimeout(this.upstream.getAuthor(authorId), REQUEST_TIMEOUT_MS), {
        attempts: RETRY_ATTEMPTS,
        baseMs: RETRY_BASE_MS,
        isRetryable: isRetryableUpstreamError,
      }),
    );
    // A failed author lookup falls back to the raw id rather than failing
    // the whole getWork call; one bad author lookup must not sink the work.
    const authorNames = authorResults.map((result, i) => (result.ok ? result.value.name : authorIds[i]));

    const workDetail = toDomainWorkDetail(raw, authorNames);
    await this.cache.set(key, workDetail, POSITIVE_TTL_MS);
    return workDetail;
  }

  async getWorkEditions(workId: string, page: number, limit: number): Promise<EditionsResult> {
    if (!workId?.trim()) {
      throw new InvalidArgumentError('workId is required');
    }
    if (page < 1) {
      throw new InvalidArgumentError('page must be >= 1');
    }
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new InvalidArgumentError(`limit must be between 1 and ${MAX_LIMIT}`);
    }

    const notFoundKey = editionsNotFoundKey(workId);
    const negativeCached = await this.cache.get<null>(notFoundKey);
    if (negativeCached) {
      throw new NotFoundError(`work ${workId} not found`);
    }

    const key = editionsCacheKey(workId, page, limit);
    const cached = await this.cache.get<EditionsResult>(key);
    if (cached) return cached.value as EditionsResult;

    const inFlight = this.inFlightEditions.get(key);
    if (inFlight) return inFlight;

    const fetchPromise = this.fetchAndCacheEditions(key, notFoundKey, workId, page, limit).finally(() => {
      this.inFlightEditions.delete(key);
    });
    this.inFlightEditions.set(key, fetchPromise);
    return fetchPromise;
  }

  private async fetchAndCacheEditions(
    key: string,
    notFoundKey: string,
    workId: string,
    page: number,
    limit: number,
  ): Promise<EditionsResult> {
    let raw;
    try {
      raw = await withRetry(
        () => withTimeout(this.upstream.getWorkEditions(workId, page, limit), REQUEST_TIMEOUT_MS),
        { attempts: RETRY_ATTEMPTS, baseMs: RETRY_BASE_MS, isRetryable: isRetryableUpstreamError },
      );
    } catch (error) {
      if (error instanceof UpstreamNotFoundError) {
        await this.cache.set(notFoundKey, null, WORK_NEGATIVE_TTL_MS);
        throw new NotFoundError(`work ${workId} not found`);
      }
      throw new UpstreamUnavailableError(
        `getWorkEditions upstream call failed: ${(error as Error).message}`,
      );
    }

    const result: EditionsResult = {
      editions: raw.entries.map(toDomainEdition),
      page: {
        page,
        limit,
        total: raw.size,
        hasNext: page * limit < raw.size,
      },
    };
    await this.cache.set(key, result, POSITIVE_TTL_MS);
    return result;
  }
}
