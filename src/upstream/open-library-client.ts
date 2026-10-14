// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import {
  OpenLibraryClient,
  RawSearchResult,
  RawWork,
  RawEditionsPage,
  RawAuthor,
} from './open-library-client.interface';
import { UpstreamNotFoundError } from '../common/errors';

const BASE_URL = 'https://openlibrary.org';

async function getJson<T>(fetchFn: typeof fetch, url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetchFn(url, { signal });
  if (response.status === 404) {
    throw new UpstreamNotFoundError(`not found: ${url}`);
  }
  if (!response.ok) {
    throw new Error(`upstream returned ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

// The real implementation of the OpenLibraryClient seam. fetch is injected
// (defaulting to the global) so this stays unit-testable with a mocked
// fetch instead of a real network call.
export class OpenLibraryHttpClient implements OpenLibraryClient {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  search(query: string, page: number, limit: number, signal?: AbortSignal): Promise<RawSearchResult> {
    const url = new URL(`${BASE_URL}/search.json`);
    url.searchParams.set('q', query);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i,edition_count');
    return getJson<RawSearchResult>(this.fetchFn, url.toString(), signal);
  }

  getWork(workId: string, signal?: AbortSignal): Promise<RawWork> {
    return getJson<RawWork>(this.fetchFn, `${BASE_URL}/works/${workId}.json`, signal);
  }

  getWorkEditions(
    workId: string,
    page: number,
    limit: number,
    signal?: AbortSignal,
  ): Promise<RawEditionsPage> {
    const url = new URL(`${BASE_URL}/works/${workId}/editions.json`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String((page - 1) * limit));
    return getJson<RawEditionsPage>(this.fetchFn, url.toString(), signal);
  }

  getAuthor(authorId: string, signal?: AbortSignal): Promise<RawAuthor> {
    return getJson<RawAuthor>(this.fetchFn, `${BASE_URL}/authors/${authorId}.json`, signal);
  }
}
