// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { HealthController } from './health.controller';
import { HealthCheckResponse_ServingStatus } from '../proto/gen/health';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('reports SERVING for the overall service (no service name given)', async () => {
    const response = await controller.check({ service: '' });

    expect(response.status).toBe(HealthCheckResponse_ServingStatus.SERVING);
  });

  it('reports SERVING for the catalog service by name', async () => {
    const response = await controller.check({ service: 'catalog.v1.CatalogService' });

    expect(response.status).toBe(HealthCheckResponse_ServingStatus.SERVING);
  });
});
