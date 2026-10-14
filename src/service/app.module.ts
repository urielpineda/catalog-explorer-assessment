// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { Module } from '@nestjs/common';
import { HealthController } from '../health/health.controller';
import { CatalogController } from '../grpc/catalog.controller';
import { CatalogService } from '../catalog/catalog.service';
import { InMemoryCache } from '../cache/in-memory-cache';
import { OpenLibraryHttpClient } from '../upstream/open-library-client';
import { OPEN_LIBRARY_CLIENT, CACHE } from './tokens';

@Module({
  controllers: [HealthController, CatalogController],
  providers: [
    { provide: OPEN_LIBRARY_CLIENT, useClass: OpenLibraryHttpClient },
    { provide: CACHE, useClass: InMemoryCache },
    {
      provide: CatalogService,
      inject: [OPEN_LIBRARY_CLIENT, CACHE],
      useFactory: (upstream: OpenLibraryHttpClient, cache: InMemoryCache) =>
        new CatalogService(upstream, cache),
    },
  ],
})
export class AppModule {}
