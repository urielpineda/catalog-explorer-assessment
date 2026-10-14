// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { mapErrorToEnvelope } from './error-mapping';
import { InvalidArgumentError, NotFoundError, UpstreamUnavailableError } from '../common/errors';

describe('mapErrorToEnvelope', () => {
  it('maps InvalidArgumentError to gRPC status 3', () => {
    const envelope = mapErrorToEnvelope(new InvalidArgumentError('bad input'));

    expect(envelope).toEqual({ status: 3, error: { type: 'INVALID_ARGUMENT', message: 'bad input' } });
  });

  it('maps NotFoundError to gRPC status 5', () => {
    const envelope = mapErrorToEnvelope(new NotFoundError('missing'));

    expect(envelope).toEqual({ status: 5, error: { type: 'NOT_FOUND', message: 'missing' } });
  });

  it('maps UpstreamUnavailableError to gRPC status 14', () => {
    const envelope = mapErrorToEnvelope(new UpstreamUnavailableError('down'));

    expect(envelope).toEqual({ status: 14, error: { type: 'UNAVAILABLE', message: 'down' } });
  });

  it('maps any other error to gRPC status 13 (INTERNAL) rather than leaking internals', () => {
    const envelope = mapErrorToEnvelope(new TypeError('unexpected'));

    expect(envelope).toEqual({ status: 13, error: { type: 'INTERNAL', message: 'unexpected' } });
  });
});
