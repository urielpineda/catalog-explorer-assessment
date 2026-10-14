// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { Module } from '@nestjs/common';
import { ClientsModule, Transport, ClientGrpc } from '@nestjs/microservices';
import { join } from 'path';
import { EdgeController } from './edge.controller';
import { EdgeHealthController } from './health.controller';
import { CATALOG_SERVICE_CLIENT, HEALTH_CLIENT } from './tokens';
import { CatalogServiceClient, CATALOG_SERVICE_NAME } from '../proto/gen/catalog';

const CATALOG_GRPC_PACKAGE = 'CATALOG_GRPC_PACKAGE';
const HEALTH_GRPC_PACKAGE = 'HEALTH_GRPC_PACKAGE';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: CATALOG_GRPC_PACKAGE,
        transport: Transport.GRPC,
        options: {
          package: 'catalog.v1',
          protoPath: join(__dirname, '../../proto/catalog.proto'),
          url: process.env.CATALOG_GRPC_URL ?? 'localhost:50051',
        },
      },
      {
        name: HEALTH_GRPC_PACKAGE,
        transport: Transport.GRPC,
        options: {
          package: 'grpc.health.v1',
          protoPath: join(__dirname, '../../proto/health.proto'),
          url: process.env.CATALOG_GRPC_URL ?? 'localhost:50051',
        },
      },
    ]),
  ],
  controllers: [EdgeController, EdgeHealthController],
  providers: [
    {
      provide: CATALOG_SERVICE_CLIENT,
      inject: [CATALOG_GRPC_PACKAGE],
      useFactory: (client: ClientGrpc) => client.getService<CatalogServiceClient>(CATALOG_SERVICE_NAME),
    },
    {
      provide: HEALTH_CLIENT,
      inject: [HEALTH_GRPC_PACKAGE],
      useFactory: (client: ClientGrpc) => client.getService('Health'),
    },
  ],
})
export class EdgeModule {}
