// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { CatalogController } from './catalog.controller';
import { CatalogService } from '../catalog/catalog.service';
import { InMemoryCache } from '../cache/in-memory-cache';
import { createStubOpenLibraryClient } from '../upstream/open-library-client.stub';
import { UpstreamNotFoundError } from '../common/errors';

describe('CatalogController', () => {
  describe('search', () => {
    it('wraps a successful search in a status:0 envelope with no error', async () => {
      const upstream = createStubOpenLibraryClient();
      upstream.search.mockResolvedValueOnce({ numFound: 0, start: 0, docs: [] });
      const controller = new CatalogController(new CatalogService(upstream, new InMemoryCache()));

      const response = await controller.search({ q: 'dune', page: 1, limit: 20 });

      expect(response.status).toBe(0);
      expect(response.error).toBeUndefined();
      expect(response.data).toEqual({ results: [], page: { page: 1, limit: 20, total: 0, hasNext: false } });
    });

    it('wraps invalid input in a status:3 envelope with no data', async () => {
      const controller = new CatalogController(
        new CatalogService(createStubOpenLibraryClient(), new InMemoryCache()),
      );

      const response = await controller.search({ q: '', page: 1, limit: 20 });

      expect(response.status).toBe(3);
      expect(response.error?.type).toBe('INVALID_ARGUMENT');
      expect(response.data).toBeUndefined();
    });
  });

  describe('getWork', () => {
    it('wraps a successful fetch in a status:0 envelope with no error', async () => {
      const upstream = createStubOpenLibraryClient();
      upstream.getWork.mockResolvedValueOnce({ key: '/works/OL1W', title: 'Dune' });
      const controller = new CatalogController(new CatalogService(upstream, new InMemoryCache()));

      const response = await controller.getWork({ id: 'OL1W' });

      expect(response.status).toBe(0);
      expect(response.error).toBeUndefined();
      expect(response.data).toEqual({
        id: 'OL1W',
        title: 'Dune',
        authors: [],
        description: '',
        subjects: [],
        coverUrl: '',
      });
    });

    it('wraps a confirmed-missing work in a status:5 envelope', async () => {
      const upstream = createStubOpenLibraryClient();
      upstream.getWork.mockRejectedValue(new UpstreamNotFoundError('missing'));
      const controller = new CatalogController(new CatalogService(upstream, new InMemoryCache()));

      const response = await controller.getWork({ id: 'OLBOGUSW' });

      expect(response.status).toBe(5);
      expect(response.error?.type).toBe('NOT_FOUND');
      expect(response.data).toBeUndefined();
    });

    it('wraps a transient upstream failure in a status:14 envelope', async () => {
      const upstream = createStubOpenLibraryClient();
      upstream.getWork.mockRejectedValue(new Error('ECONNRESET'));
      const controller = new CatalogController(new CatalogService(upstream, new InMemoryCache()));

      const response = await controller.getWork({ id: 'OL1W' });

      expect(response.status).toBe(14);
      expect(response.error?.type).toBe('UNAVAILABLE');
    });
  });

  describe('getWorkEditions', () => {
    it('wraps a successful fetch in a status:0 envelope', async () => {
      const upstream = createStubOpenLibraryClient();
      upstream.getWorkEditions.mockResolvedValueOnce({ size: 0, entries: [] });
      const controller = new CatalogController(new CatalogService(upstream, new InMemoryCache()));

      const response = await controller.getWorkEditions({ workId: 'OL1W', page: 1, limit: 50 });

      expect(response.status).toBe(0);
      expect(response.data).toEqual({
        editions: [],
        page: { page: 1, limit: 50, total: 0, hasNext: false },
      });
    });

    it('wraps a confirmed-missing work in a status:5 envelope', async () => {
      const upstream = createStubOpenLibraryClient();
      upstream.getWorkEditions.mockRejectedValue(new UpstreamNotFoundError('missing'));
      const controller = new CatalogController(new CatalogService(upstream, new InMemoryCache()));

      const response = await controller.getWorkEditions({ workId: 'OLBOGUSW', page: 1, limit: 50 });

      expect(response.status).toBe(5);
      expect(response.error?.type).toBe('NOT_FOUND');
      expect(response.data).toBeUndefined();
    });
  });
});
