// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { of } from 'rxjs';
import { EdgeController } from './edge.controller';
import { CatalogServiceClient } from '../proto/gen/catalog';

function fakeCatalogClient(overrides: Partial<CatalogServiceClient> = {}): CatalogServiceClient {
  return {
    search: jest.fn().mockReturnValue(of({ status: 0, data: { results: [], page: {} } })),
    getWork: jest.fn(),
    getWorkEditions: jest.fn(),
    ...overrides,
  } as unknown as CatalogServiceClient;
}

function fakeResponse() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
}

describe('EdgeController', () => {
  it('GET search maps a successful envelope to HTTP 200 with the same body', async () => {
    const data = { results: [{ id: 'OL1W', title: 'Dune' }], page: { page: 1, limit: 20, total: 1, hasNext: false } };
    const client = fakeCatalogClient({ search: jest.fn().mockReturnValue(of({ status: 0, data })) });
    const controller = new EdgeController(client);
    const res = fakeResponse();

    await controller.search('dune', '1', '20', res);

    expect(client.search).toHaveBeenCalledWith({ q: 'dune', page: 1, limit: 20 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 0, data });
  });

  it('GET search maps a NOT_FOUND-shaped... actually INVALID_ARGUMENT envelope to HTTP 400', async () => {
    const envelope = { status: 3, error: { type: 'INVALID_ARGUMENT', message: 'q is required' } };
    const client = fakeCatalogClient({ search: jest.fn().mockReturnValue(of(envelope)) });
    const controller = new EdgeController(client);
    const res = fakeResponse();

    await controller.search('', '1', '20', res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(envelope);
  });

  it('GET works/:id maps a NOT_FOUND envelope to HTTP 404', async () => {
    const envelope = { status: 5, error: { type: 'NOT_FOUND', message: 'work OLBOGUSW not found' } };
    const client = fakeCatalogClient({ getWork: jest.fn().mockReturnValue(of(envelope)) });
    const controller = new EdgeController(client);
    const res = fakeResponse();

    await controller.getWork('OLBOGUSW', res);

    expect(client.getWork).toHaveBeenCalledWith({ id: 'OLBOGUSW' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(envelope);
  });

  it('GET works/:id/editions maps an UNAVAILABLE envelope to HTTP 503', async () => {
    const envelope = { status: 14, error: { type: 'UNAVAILABLE', message: 'upstream down' } };
    const client = fakeCatalogClient({ getWorkEditions: jest.fn().mockReturnValue(of(envelope)) });
    const controller = new EdgeController(client);
    const res = fakeResponse();

    await controller.getWorkEditions('OL1W', '1', '50', res);

    expect(client.getWorkEditions).toHaveBeenCalledWith({ workId: 'OL1W', page: 1, limit: 50 });
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(envelope);
  });

  it('defaults page/limit when the query params are missing', async () => {
    const client = fakeCatalogClient();
    const controller = new EdgeController(client);
    const res = fakeResponse();

    await controller.search('dune', undefined, undefined, res);

    expect(client.search).toHaveBeenCalledWith({ q: 'dune', page: 1, limit: 20 });
  });
});
