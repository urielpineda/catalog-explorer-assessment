// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { CatalogService } from './catalog.service';
import { InMemoryCache } from '../cache/in-memory-cache';
import { createStubOpenLibraryClient } from '../upstream/open-library-client.stub';
import { InvalidArgumentError, NotFoundError, UpstreamUnavailableError, UpstreamNotFoundError } from '../common/errors';

describe('CatalogService.search', () => {
  it('returns normalized results with pagination info on a successful search', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.search.mockResolvedValueOnce({
      numFound: 48315,
      start: 0,
      docs: [
        {
          key: '/works/OL893414W',
          title: 'Dune',
          author_name: ['Frank Herbert'],
          first_publish_year: 1965,
          cover_i: 12345,
        },
      ],
    });
    const service = new CatalogService(upstream, new InMemoryCache());

    const result = await service.search('dune', 1, 20);

    expect(result.results).toEqual([
      {
        id: 'OL893414W',
        title: 'Dune',
        authors: ['Frank Herbert'],
        firstPublishYear: 1965,
        coverUrl: 'https://covers.openlibrary.org/b/id/12345-M.jpg',
      },
    ]);
    expect(result.page).toEqual({ page: 1, limit: 20, total: 48315, hasNext: true });
  });

  it('returns an empty-but-valid result for a query with zero matches (not an error)', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.search.mockResolvedValueOnce({ numFound: 0, start: 0, docs: [] });
    const service = new CatalogService(upstream, new InMemoryCache());

    const result = await service.search('asdkjhqwkejhasd', 1, 20);

    expect(result.results).toEqual([]);
    expect(result.page).toEqual({ page: 1, limit: 20, total: 0, hasNext: false });
  });

  it('serves a repeat identical search from cache without calling upstream again', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.search.mockResolvedValueOnce({
      numFound: 1,
      start: 0,
      docs: [{ key: '/works/OL1W', title: 'Dune' }],
    });
    const service = new CatalogService(upstream, new InMemoryCache());

    const first = await service.search('dune', 1, 20);
    const second = await service.search('dune', 1, 20);

    expect(second).toEqual(first);
    expect(upstream.search).toHaveBeenCalledTimes(1);
  });

  it('treats query case/whitespace differences as the same cache entry', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.search.mockResolvedValueOnce({
      numFound: 1,
      start: 0,
      docs: [{ key: '/works/OL1W', title: 'Dune' }],
    });
    const service = new CatalogService(upstream, new InMemoryCache());

    await service.search('  Dune  ', 1, 20);
    await service.search('dune', 1, 20);

    expect(upstream.search).toHaveBeenCalledTimes(1);
  });

  it('coalesces N concurrent identical cache misses into exactly 1 upstream call', async () => {
    const upstream = createStubOpenLibraryClient();
    let resolveUpstream: (value: any) => void;
    upstream.search.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpstream = resolve;
      }),
    );
    const service = new CatalogService(upstream, new InMemoryCache());

    const concurrentCalls = Promise.all([
      service.search('dune', 1, 20),
      service.search('dune', 1, 20),
      service.search('dune', 1, 20),
    ]);
    resolveUpstream!({ numFound: 1, start: 0, docs: [{ key: '/works/OL1W', title: 'Dune' }] });
    const [a, b, c] = await concurrentCalls;

    expect(upstream.search).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('propagates an upstream failure to every coalesced caller and cleans up so a later call retries', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.search.mockRejectedValue(new Error('upstream exploded'));
    const service = new CatalogService(upstream, new InMemoryCache());

    await expect(service.search('dune', 1, 20)).rejects.toThrow();

    upstream.search.mockReset();
    upstream.search.mockResolvedValueOnce({ numFound: 0, start: 0, docs: [] });
    await expect(service.search('dune', 1, 20)).resolves.toEqual({
      results: [],
      page: { page: 1, limit: 20, total: 0, hasNext: false },
    });
  });

  it('retries a transient upstream failure and surfaces UNAVAILABLE after exhausting retries', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.search.mockRejectedValue(new Error('ECONNRESET'));
    const service = new CatalogService(upstream, new InMemoryCache());

    await expect(service.search('dune', 1, 20)).rejects.toBeInstanceOf(UpstreamUnavailableError);
    expect(upstream.search.mock.calls.length).toBeGreaterThan(1);
  });

  it('surfaces UNAVAILABLE (never a hang, never an empty success) when upstream never responds', async () => {
    jest.useFakeTimers();
    const upstream = createStubOpenLibraryClient();
    upstream.search.mockReturnValue(new Promise(() => {})); // never resolves
    const service = new CatalogService(upstream, new InMemoryCache());

    const pending = service.search('dune', 1, 20);
    const assertion = expect(pending).rejects.toBeInstanceOf(UpstreamUnavailableError);
    await jest.runAllTimersAsync();
    await assertion;

    jest.useRealTimers();
  });

  it('rejects an empty/whitespace-only query as invalid, without calling upstream', async () => {
    const upstream = createStubOpenLibraryClient();
    const service = new CatalogService(upstream, new InMemoryCache());

    await expect(service.search('   ', 1, 20)).rejects.toBeInstanceOf(InvalidArgumentError);
    expect(upstream.search).not.toHaveBeenCalled();
  });

  it('rejects page < 1 as invalid', async () => {
    const service = new CatalogService(createStubOpenLibraryClient(), new InMemoryCache());

    await expect(service.search('dune', 0, 20)).rejects.toBeInstanceOf(InvalidArgumentError);
  });

  it('rejects an absurd limit as invalid', async () => {
    const service = new CatalogService(createStubOpenLibraryClient(), new InMemoryCache());

    await expect(service.search('dune', 1, 100_000)).rejects.toBeInstanceOf(InvalidArgumentError);
  });

  it('advances pagination correctly across pages, including the last page', async () => {
    const upstream = createStubOpenLibraryClient();
    // 25 total results, limit 20: page 1 has more pages after it, page 2 is the last.
    upstream.search.mockResolvedValueOnce({ numFound: 25, start: 0, docs: [] });
    upstream.search.mockResolvedValueOnce({ numFound: 25, start: 20, docs: [] });
    const service = new CatalogService(upstream, new InMemoryCache());

    const pageOne = await service.search('dune', 1, 20);
    const pageTwo = await service.search('dune', 2, 20);

    expect(pageOne.page).toEqual({ page: 1, limit: 20, total: 25, hasNext: true });
    expect(pageTwo.page).toEqual({ page: 2, limit: 20, total: 25, hasNext: false });
  });
});

describe('CatalogService.getWork', () => {
  it('returns normalized work detail with resolved author names', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.getWork.mockResolvedValueOnce({
      key: '/works/OL893414W',
      title: 'Dune',
      description: 'A desert planet.',
      authors: [{ author: { key: '/authors/OL1A' } }],
    });
    upstream.getAuthor.mockResolvedValueOnce({ key: '/authors/OL1A', name: 'Frank Herbert' });
    const service = new CatalogService(upstream, new InMemoryCache());

    const work = await service.getWork('OL893414W');

    expect(work).toEqual({
      id: 'OL893414W',
      title: 'Dune',
      authors: ['Frank Herbert'],
      description: 'A desert planet.',
      subjects: [],
      coverUrl: '',
    });
  });

  it('tolerates a failed author lookup without failing the whole getWork call', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.getWork.mockResolvedValueOnce({
      key: '/works/OL1W',
      title: 'Untitled',
      authors: [{ author: { key: '/authors/OL1A' } }, { author: { key: '/authors/OL2A' } }],
    });
    upstream.getAuthor.mockImplementation(async (id: string) => {
      if (id === 'OL2A') throw new Error('author lookup failed');
      return { key: '/authors/OL1A', name: 'Frank Herbert' };
    });
    const service = new CatalogService(upstream, new InMemoryCache());

    const work = await service.getWork('OL1W');

    expect(work.authors).toEqual(['Frank Herbert', 'OL2A']);
  });

  it('serves a repeat getWork for the same id from cache without calling upstream again', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.getWork.mockResolvedValueOnce({ key: '/works/OL1W', title: 'Untitled' });
    const service = new CatalogService(upstream, new InMemoryCache());

    const first = await service.getWork('OL1W');
    const second = await service.getWork('OL1W');

    expect(second).toEqual(first);
    expect(upstream.getWork).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty id as invalid, without calling upstream', async () => {
    const upstream = createStubOpenLibraryClient();
    const service = new CatalogService(upstream, new InMemoryCache());

    await expect(service.getWork('  ')).rejects.toBeInstanceOf(InvalidArgumentError);
    expect(upstream.getWork).not.toHaveBeenCalled();
  });

  it('maps a confirmed upstream 404 to NotFoundError and negative-caches it', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.getWork.mockRejectedValue(new UpstreamNotFoundError('work not found'));
    const service = new CatalogService(upstream, new InMemoryCache());

    await expect(service.getWork('OLBOGUSW')).rejects.toBeInstanceOf(NotFoundError);
    expect(upstream.getWork).toHaveBeenCalledTimes(1); // a definitive 404 is never retried

    await expect(service.getWork('OLBOGUSW')).rejects.toBeInstanceOf(NotFoundError);
    expect(upstream.getWork).toHaveBeenCalledTimes(1); // served from the negative cache, not upstream again
  });

  it('maps a transient upstream failure to UpstreamUnavailableError and does not negative-cache it', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.getWork.mockRejectedValue(new Error('ETIMEDOUT'));
    const service = new CatalogService(upstream, new InMemoryCache());

    await expect(service.getWork('OL893414W')).rejects.toBeInstanceOf(UpstreamUnavailableError);

    upstream.getWork.mockReset();
    upstream.getWork.mockResolvedValueOnce({ key: '/works/OL893414W', title: 'Dune' });
    await expect(service.getWork('OL893414W')).resolves.toMatchObject({ title: 'Dune' });
  });
});

describe('CatalogService.getWorkEditions', () => {
  it('returns normalized editions with pagination info on success', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.getWorkEditions.mockResolvedValueOnce({
      size: 155,
      entries: [{ key: '/books/OL1M', title: 'Dune (Paperback)', publish_date: '1990', publishers: ['Ace Books'] }],
    });
    const service = new CatalogService(upstream, new InMemoryCache());

    const result = await service.getWorkEditions('OL893414W', 1, 50);

    expect(result.editions).toEqual([
      { id: 'OL1M', title: 'Dune (Paperback)', publishDate: '1990', publishers: ['Ace Books'] },
    ]);
    expect(result.page).toEqual({ page: 1, limit: 50, total: 155, hasNext: true });
  });

  it('returns an empty-but-valid result for a work with zero editions', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.getWorkEditions.mockResolvedValueOnce({ size: 0, entries: [] });
    const service = new CatalogService(upstream, new InMemoryCache());

    const result = await service.getWorkEditions('OL1W', 1, 50);

    expect(result.editions).toEqual([]);
    expect(result.page).toEqual({ page: 1, limit: 50, total: 0, hasNext: false });
  });

  it('serves a repeat identical request from cache without calling upstream again', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.getWorkEditions.mockResolvedValueOnce({ size: 1, entries: [] });
    const service = new CatalogService(upstream, new InMemoryCache());

    await service.getWorkEditions('OL1W', 1, 50);
    await service.getWorkEditions('OL1W', 1, 50);

    expect(upstream.getWorkEditions).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty workId, an out-of-range page, or an absurd limit', async () => {
    const service = new CatalogService(createStubOpenLibraryClient(), new InMemoryCache());

    await expect(service.getWorkEditions('', 1, 50)).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(service.getWorkEditions('OL1W', 0, 50)).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(service.getWorkEditions('OL1W', 1, 1000)).rejects.toBeInstanceOf(InvalidArgumentError);
  });

  it('maps a confirmed 404 to NotFoundError and negative-caches it per work id', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.getWorkEditions.mockRejectedValue(new UpstreamNotFoundError('work not found'));
    const service = new CatalogService(upstream, new InMemoryCache());

    await expect(service.getWorkEditions('OLBOGUSW', 1, 50)).rejects.toBeInstanceOf(NotFoundError);
    expect(upstream.getWorkEditions).toHaveBeenCalledTimes(1);

    // Different page/limit, same work id: still served from the negative cache.
    await expect(service.getWorkEditions('OLBOGUSW', 2, 20)).rejects.toBeInstanceOf(NotFoundError);
    expect(upstream.getWorkEditions).toHaveBeenCalledTimes(1);
  });

  it('maps a transient failure to UpstreamUnavailableError without caching it', async () => {
    const upstream = createStubOpenLibraryClient();
    upstream.getWorkEditions.mockRejectedValue(new Error('ECONNRESET'));
    const service = new CatalogService(upstream, new InMemoryCache());

    await expect(service.getWorkEditions('OL893414W', 1, 50)).rejects.toBeInstanceOf(UpstreamUnavailableError);

    upstream.getWorkEditions.mockReset();
    upstream.getWorkEditions.mockResolvedValueOnce({ size: 0, entries: [] });
    await expect(service.getWorkEditions('OL893414W', 1, 50)).resolves.toMatchObject({ editions: [] });
  });
});
