// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

// Raw shapes as actually returned by openlibrary.org, verified against the
// live API directly before writing this. Intentionally loose/optional on
// fields the upstream itself omits sometimes; the mapper in
// src/domain/open-library.mapper.ts is the only place that normalizes
// these into the clean domain shape.

export interface RawSearchDoc {
  key: string; // "/works/OL893414W"
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  edition_count?: number;
}

export interface RawSearchResult {
  numFound: number;
  start: number;
  docs: RawSearchDoc[];
}

export interface RawWorkAuthorRef {
  author: { key: string }; // "/authors/OL123A"
}

export interface RawWork {
  key: string; // "/works/OL893414W"
  title: string;
  description?: string | { type: string; value: string };
  covers?: number[]; // may contain -1 as a "no cover" sentinel
  subjects?: string[];
  authors?: RawWorkAuthorRef[];
}

export interface RawEditionEntry {
  key: string; // "/books/OL123M"
  title: string;
  publish_date?: string;
  publishers?: string[];
}

export interface RawEditionsPage {
  size: number;
  entries: RawEditionEntry[];
}

export interface RawAuthor {
  key: string; // "/authors/OL123A"
  name: string;
}

// The one seam between this service and the network. Every method is a
// plain read with no side effects, so every call here is safe to retry.
// Tests depend on this interface and a stub implementation, never on the
// real HTTP client, so the service layer runs with no network access.
//
// Implementations must throw UpstreamNotFoundError (src/common/errors.ts)
// for a confirmed-missing resource (upstream 404), and any other Error for
// a transient/transport failure, so CatalogService can tell the two apart.
export interface OpenLibraryClient {
  search(query: string, page: number, limit: number, signal?: AbortSignal): Promise<RawSearchResult>;
  getWork(workId: string, signal?: AbortSignal): Promise<RawWork>;
  getWorkEditions(
    workId: string,
    page: number,
    limit: number,
    signal?: AbortSignal,
  ): Promise<RawEditionsPage>;
  getAuthor(authorId: string, signal?: AbortSignal): Promise<RawAuthor>;
}
