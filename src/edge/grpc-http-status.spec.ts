// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { httpStatusFromGrpc } from './grpc-http-status';

describe('httpStatusFromGrpc', () => {
  it('maps OK (0) to 200', () => {
    expect(httpStatusFromGrpc(0)).toBe(200);
  });

  it('maps INVALID_ARGUMENT (3) to 400', () => {
    expect(httpStatusFromGrpc(3)).toBe(400);
  });

  it('maps NOT_FOUND (5) to 404', () => {
    expect(httpStatusFromGrpc(5)).toBe(404);
  });

  it('maps UNAVAILABLE (14) to 503', () => {
    expect(httpStatusFromGrpc(14)).toBe(503);
  });

  it('maps any other status (e.g. INTERNAL, 13) to 500', () => {
    expect(httpStatusFromGrpc(13)).toBe(500);
    expect(httpStatusFromGrpc(999)).toBe(500);
  });
});
