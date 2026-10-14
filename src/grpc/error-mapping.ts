// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { CatalogError } from '../proto/gen/catalog';
import { InvalidArgumentError, NotFoundError, UpstreamUnavailableError } from '../common/errors';

// gRPC status codes (a subset); `status` in the envelope mirrors these
// numbers end to end, so the edge has exactly one place to look.
const GRPC_STATUS = {
  OK: 0,
  INVALID_ARGUMENT: 3,
  NOT_FOUND: 5,
  INTERNAL: 13,
  UNAVAILABLE: 14,
} as const;

export interface ErrorEnvelope {
  status: number;
  error: CatalogError;
}

// The only place CatalogService's typed errors get turned into the wire
// envelope. Anything not one of our known error types maps to INTERNAL
// with a generic message, never leaking an unexpected internal detail.
export function mapErrorToEnvelope(error: unknown): ErrorEnvelope {
  if (error instanceof InvalidArgumentError) {
    return { status: GRPC_STATUS.INVALID_ARGUMENT, error: { type: error.type, message: error.message } };
  }
  if (error instanceof NotFoundError) {
    return { status: GRPC_STATUS.NOT_FOUND, error: { type: error.type, message: error.message } };
  }
  if (error instanceof UpstreamUnavailableError) {
    return { status: GRPC_STATUS.UNAVAILABLE, error: { type: error.type, message: error.message } };
  }
  const message = error instanceof Error ? error.message : 'internal error';
  return { status: GRPC_STATUS.INTERNAL, error: { type: 'INTERNAL', message } };
}
