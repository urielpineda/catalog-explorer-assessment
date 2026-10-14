// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { EdgeModule } from './edge.module';

async function bootstrap() {
  const app = await NestFactory.create(EdgeModule);
  const port = process.env.EDGE_HTTP_PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Catalog Explorer edge listening on http://localhost:${port}`);
}

bootstrap();
