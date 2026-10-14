// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { Controller, Inject } from '@nestjs/common';
import {
  CatalogServiceController,
  CatalogServiceControllerMethods,
  SearchRequest,
  SearchResponse,
  GetWorkRequest,
  WorkResponse,
  GetWorkEditionsRequest,
  EditionsResponse,
} from '../proto/gen/catalog';
import { CatalogService } from '../catalog/catalog.service';
import { mapErrorToEnvelope } from './error-mapping';

// One HTTP/gRPC route = one RPC, no business logic: delegate to
// CatalogService, wrap its result or its typed error in the envelope. This
// is the only place that ever constructs a *Response envelope.
@Controller()
@CatalogServiceControllerMethods()
export class CatalogController implements CatalogServiceController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    try {
      const result = await this.catalogService.search(request.q, request.page, request.limit);
      return { status: 0, data: { results: result.results, page: result.page } };
    } catch (error) {
      return { ...mapErrorToEnvelope(error), data: undefined };
    }
  }

  async getWork(request: GetWorkRequest): Promise<WorkResponse> {
    try {
      const work = await this.catalogService.getWork(request.id);
      return { status: 0, data: work };
    } catch (error) {
      return { ...mapErrorToEnvelope(error), data: undefined };
    }
  }

  async getWorkEditions(request: GetWorkEditionsRequest): Promise<EditionsResponse> {
    try {
      const result = await this.catalogService.getWorkEditions(request.workId, request.page, request.limit);
      return { status: 0, data: { editions: result.editions, page: result.page } };
    } catch (error) {
      return { ...mapErrorToEnvelope(error), data: undefined };
    }
  }
}
