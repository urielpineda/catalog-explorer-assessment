// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { Controller, Get, Param, Query, Res, Inject } from '@nestjs/common';
import type { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { CatalogServiceClient } from '../proto/gen/catalog';
import { CATALOG_SERVICE_CLIENT } from './tokens';
import { httpStatusFromGrpc } from './grpc-http-status';

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Thin by design: every handler is REST-param-parsing in, one gRPC call,
// envelope-and-status-code out. No business logic, no second response
// shape; whatever the service's envelope says is exactly what ships.
@Controller('v1/catalog')
export class EdgeController {
  constructor(@Inject(CATALOG_SERVICE_CLIENT) private readonly catalog: CatalogServiceClient) {}

  @Get('search')
  async search(
    @Query('q') q: string,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Res() res: Response,
  ) {
    const envelope = await firstValueFrom(
      this.catalog.search({ q, page: toInt(page, 1), limit: toInt(limit, 20) }),
    );
    res.status(httpStatusFromGrpc(envelope.status)).json(envelope);
  }

  @Get('works/:id')
  async getWork(@Param('id') id: string, @Res() res: Response) {
    const envelope = await firstValueFrom(this.catalog.getWork({ id }));
    res.status(httpStatusFromGrpc(envelope.status)).json(envelope);
  }

  @Get('works/:id/editions')
  async getWorkEditions(
    @Param('id') id: string,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Res() res: Response,
  ) {
    const envelope = await firstValueFrom(
      this.catalog.getWorkEditions({ workId: id, page: toInt(page, 1), limit: toInt(limit, 50) }),
    );
    res.status(httpStatusFromGrpc(envelope.status)).json(envelope);
  }
}
