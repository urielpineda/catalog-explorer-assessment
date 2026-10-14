// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { OpenLibraryHttpClient } from './open-library-client';
import { UpstreamNotFoundError } from '../common/errors';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('OpenLibraryHttpClient', () => {
  it('search() calls the search.json endpoint with q/page/limit and returns the parsed body', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ numFound: 1, start: 0, docs: [] }));
    const client = new OpenLibraryHttpClient(fetchMock as unknown as typeof fetch);

    const result = await client.search('dune', 1, 20);

    expect(result).toEqual({ numFound: 1, start: 0, docs: [] });
    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe('https://openlibrary.org/search.json');
    expect(calledUrl.searchParams.get('q')).toBe('dune');
    expect(calledUrl.searchParams.get('page')).toBe('1');
    expect(calledUrl.searchParams.get('limit')).toBe('20');
  });

  it('getWork() throws UpstreamNotFoundError on a 404', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ error: 'notfound' }, 404));
    const client = new OpenLibraryHttpClient(fetchMock as unknown as typeof fetch);

    await expect(client.getWork('OLBOGUSW')).rejects.toBeInstanceOf(UpstreamNotFoundError);
  });

  it('getWork() throws a plain Error on a 5xx (so it is retried, not negative-cached)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}, 503));
    const client = new OpenLibraryHttpClient(fetchMock as unknown as typeof fetch);

    await expect(client.getWork('OL1W')).rejects.not.toBeInstanceOf(UpstreamNotFoundError);
    await expect(client.getWork('OL1W')).rejects.toThrow();
  });

  it('getWorkEditions() converts page/limit to the upstream offset/limit pair', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ size: 0, entries: [] }));
    const client = new OpenLibraryHttpClient(fetchMock as unknown as typeof fetch);

    await client.getWorkEditions('OL893414W', 3, 50);

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe('/works/OL893414W/editions.json');
    expect(calledUrl.searchParams.get('limit')).toBe('50');
    expect(calledUrl.searchParams.get('offset')).toBe('100'); // (page 3 - 1) * limit 50
  });

  it('getAuthor() returns the parsed author body', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ key: '/authors/OL1A', name: 'Frank Herbert' }));
    const client = new OpenLibraryHttpClient(fetchMock as unknown as typeof fetch);

    const result = await client.getAuthor('OL1A');

    expect(result).toEqual({ key: '/authors/OL1A', name: 'Frank Herbert' });
  });
});
