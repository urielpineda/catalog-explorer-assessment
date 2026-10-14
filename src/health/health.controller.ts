// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { Controller } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  HealthControllerMethods,
  HealthCheckRequest,
  HealthCheckResponse,
  HealthCheckResponse_ServingStatus,
  HealthListRequest,
  HealthListResponse,
} from '../proto/gen/health';

// Standard grpc.health.v1.Health check. This process is a single service
// with no sub-dependencies tracked individually, so `check`/`watch`/`list`
// all report the same overall SERVING status regardless of the requested
// service name. If a real dependency breakdown (e.g. per-upstream health)
// becomes useful later, this is the place to wire it in.
@Controller()
@HealthControllerMethods()
export class HealthController {
  async check(_request: HealthCheckRequest): Promise<HealthCheckResponse> {
    return { status: HealthCheckResponse_ServingStatus.SERVING };
  }

  watch(_request: HealthCheckRequest): Observable<HealthCheckResponse> {
    return new Observable((subscriber) => {
      subscriber.next({ status: HealthCheckResponse_ServingStatus.SERVING });
    });
  }

  async list(_request: HealthListRequest): Promise<HealthListResponse> {
    return {
      statuses: {
        'catalog.v1.CatalogService': { status: HealthCheckResponse_ServingStatus.SERVING },
      },
    };
  }
}
