// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { of, throwError } from 'rxjs';
import { EdgeHealthController } from './health.controller';

function fakeResponse() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
}

describe('EdgeHealthController', () => {
  it('returns HTTP 200 {status:"ok"} when the backend reports SERVING', async () => {
    const health = { check: jest.fn().mockReturnValue(of({ status: 1 })) };
    const controller = new EdgeHealthController(health as any);
    const res = fakeResponse();

    await controller.checkHealth(res);

    expect(health.check).toHaveBeenCalledWith({ service: 'catalog.v1.CatalogService' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
  });

  it('returns HTTP 503 when the backend reports anything other than SERVING', async () => {
    const health = { check: jest.fn().mockReturnValue(of({ status: 2 })) }; // NOT_SERVING
    const controller = new EdgeHealthController(health as any);
    const res = fakeResponse();

    await controller.checkHealth(res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ status: 'not_serving' });
  });

  it('returns HTTP 503 when the backend is unreachable (never hangs, never a fake 200)', async () => {
    const health = { check: jest.fn().mockReturnValue(throwError(() => new Error('ECONNREFUSED'))) };
    const controller = new EdgeHealthController(health as any);
    const res = fakeResponse();

    await controller.checkHealth(res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ status: 'unreachable' });
  });
});
