// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: ['catalog.v1', 'grpc.health.v1'],
      protoPath: [
        join(__dirname, '../../proto/catalog.proto'),
        join(__dirname, '../../proto/health.proto'),
      ],
      url: process.env.GRPC_URL ?? '0.0.0.0:50051',
    },
  });

  await app.listen();
  // eslint-disable-next-line no-console
  console.log(`CatalogService gRPC listening on ${process.env.GRPC_URL ?? '0.0.0.0:50051'}`);
}

bootstrap();
