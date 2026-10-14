// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

// Thrown by CatalogService, caught at the gRPC controller boundary and
// turned into the envelope's status/error fields. `type` matches the
// CatalogError.type string in the proto contract.
export class InvalidArgumentError extends Error {
  readonly type = 'INVALID_ARGUMENT';
}

export class NotFoundError extends Error {
  readonly type = 'NOT_FOUND';
}

export class UpstreamUnavailableError extends Error {
  readonly type = 'UNAVAILABLE';
}

// Thrown by an OpenLibraryClient implementation (real or stub) specifically
// for a confirmed-missing resource (upstream 404), so CatalogService can
// tell "doesn't exist" apart from "upstream is having a bad day" and decide
// whether to retry, negative-cache, or neither.
export class UpstreamNotFoundError extends Error {}
