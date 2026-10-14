// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

// The edge's one translation table: gRPC status (what the envelope
// carries) -> HTTP status (what the REST route returns). Anything not
// explicitly known maps to 500 rather than guessing.
const KNOWN_STATUSES: Record<number, number> = {
  0: 200, // OK
  3: 400, // INVALID_ARGUMENT
  5: 404, // NOT_FOUND
  14: 503, // UNAVAILABLE
};

export function httpStatusFromGrpc(grpcStatus: number): number {
  return KNOWN_STATUSES[grpcStatus] ?? 500;
}
