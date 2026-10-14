// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import {
  OpenLibraryClient,
  RawSearchResult,
  RawWork,
  RawEditionsPage,
  RawAuthor,
} from './open-library-client.interface';

// A jest.fn()-backed double implementing the real interface, so
// CatalogService's tests never touch the network. Each method defaults to
// a reasonable empty response; tests override only what they care about
// with mockResolvedValueOnce / mockRejectedValueOnce.
export function createStubOpenLibraryClient(): jest.Mocked<OpenLibraryClient> {
  return {
    search: jest.fn<Promise<RawSearchResult>, any>().mockResolvedValue({ numFound: 0, start: 0, docs: [] }),
    getWork: jest.fn<Promise<RawWork>, any>(),
    getWorkEditions: jest
      .fn<Promise<RawEditionsPage>, any>()
      .mockResolvedValue({ size: 0, entries: [] }),
    getAuthor: jest.fn<Promise<RawAuthor>, any>(),
  };
}
