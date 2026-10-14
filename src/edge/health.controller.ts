// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { Controller, Get, Res, Inject } from '@nestjs/common';
import type { Response } from 'express';
import { Observable, firstValueFrom } from 'rxjs';
import { HEALTH_CLIENT } from './tokens';

interface HealthClient {
  check(request: { service: string }): Observable<{ status: number }>;
}

// A real check, not a static 200: the edge calls the backend's own
// grpc.health.v1.Health, so this route tells you the edge can actually
// reach the service, not just that the edge process is alive.
@Controller('v1/catalog/public')
export class EdgeHealthController {
  constructor(@Inject(HEALTH_CLIENT) private readonly health: HealthClient) {}

  @Get('check-health')
  async checkHealth(@Res() res: Response) {
    try {
      const response = await firstValueFrom(this.health.check({ service: 'catalog.v1.CatalogService' }));
      const serving = response.status === 1; // HealthCheckResponse_ServingStatus.SERVING
      res.status(serving ? 200 : 503).json({ status: serving ? 'ok' : 'not_serving' });
    } catch {
      res.status(503).json({ status: 'unreachable' });
    }
  }
}
