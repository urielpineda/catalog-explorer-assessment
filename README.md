# Catalog Explorer

A gRPC `CatalogService` (NestJS, Node 20) that owns all business logic, caching, and
resilience over the public Open Library API, plus a thin HTTP edge that translates each REST
route into one gRPC call.

Node 20 required. `.nvmrc` pins it; run `nvm use` first.

## Build & run

```bash
npm install
npm run build          # tsc, both deployables
npm run proto:gen      # regenerate src/proto/gen after editing proto/*.proto

# two separate processes:
npm run start:service  # gRPC on 0.0.0.0:50051
npm run start:edge      # HTTP on :3000 (set CATALOG_GRPC_URL if the service isn't local)
```

## Test

```bash
npm test
```

88 tests, all offline. The upstream sits behind an interface
(`src/upstream/open-library-client.interface.ts`); every `CatalogService` test uses a stub,
never the network. The real `fetch`-based client is tested with a mocked `fetch`.

Covers: successful search, empty result, upstream error, upstream timeout, cache hit after a
miss, pagination advancing, and normalization of partial/missing-field records.

## curl examples

Real output, against the live API, through the full stack:

```bash
curl "http://localhost:3000/v1/catalog/search?q=dune&page=1&limit=3"
# {"status":0,"data":{"results":[{"id":"OL893414W","title":"Dune","authors":["Frank Herbert"],
#  "firstPublishYear":1965,"coverUrl":"..."}], "page":{"page":1,"limit":3,"total":48315,"hasNext":true}}}

curl "http://localhost:3000/v1/catalog/works/OL893414W"
# {"status":0,"data":{"id":"OL893414W","title":"Dune","authors":["Frank Herbert"], ...}}

curl -i "http://localhost:3000/v1/catalog/works/OLTOTALLYBOGUSW"
# HTTP 404, {"status":5,"error":{"type":"NOT_FOUND","message":"work OLTOTALLYBOGUSW not found"}}

curl "http://localhost:3000/v1/catalog/works/OL893414W/editions?page=1&limit=3"
# {"status":0,"data":{"editions":[...],"page":{"page":1,"limit":3,"total":155,"hasNext":true}}}

curl -i "http://localhost:3000/v1/catalog/search?q=&page=1&limit=20"
# HTTP 400, {"status":3,"error":{"type":"INVALID_ARGUMENT","message":"q is required"}}

curl "http://localhost:3000/v1/catalog/public/check-health"
# {"status":"ok"}
```

## Architecture

**Contract.** `proto/catalog.proto` defines `Search`, `GetWork`, `GetWorkEditions`, and a
shared envelope (`status`, `error`, `data`) for every response. `status` is the gRPC status
code end to end. Generated stubs in `src/proto/gen/` are committed, never hand-edited.

**Pagination: page/limit, not cursor.** `search.json` already takes page/limit. Open Library
has no stable sort key to build a cursor on, so a cursor would promise stability it doesn't
have. Last page still returns `status: 0` with an empty array, never `NOT_FOUND`.

**Normalization.** `src/domain/open-library.mapper.ts` is the only code that knows about Open
Library's quirks: missing `author_name`/`cover_i`, the `-1` cover sentinel, `description` as
either a string or `{type, value}`. Everything past it sees a clean shape.

**Caching and resilience.** In-memory cache behind a `Cache` interface. Three states: true
miss, negative hit (confirmed not-found, short TTL), positive hit (longer TTL). Concurrent
identical misses share one in-flight promise instead of each calling upstream. Every call has
a 3s timeout and retries with jittered backoff, except a confirmed 404, which is never
retried.

**Editions: one call, not a fan-out.** The brief's framing (and its buggy sample) implies
fetching each edition individually. Live testing showed `editions.json` already returns full
edition objects, paginated, in one call. So `GetWorkEditions` makes one upstream call per
page. The real bounded fan-out in this codebase resolves author names for `GetWork`, since the
work-detail endpoint only exposes author keys, bounded at 5 concurrent, tolerant of partial
failure.

**Edge language: Node/TypeScript, not Go.** One codegen pass, shared types, no second
toolchain. The edge does no computation, so Go's performance edge buys nothing here.

## Dependencies

- `@nestjs/*`, `@grpc/grpc-js`, `@grpc/proto-loader`: the gRPC transport NestJS needs; not
  worth hand-rolling for this scope.
- `rxjs`, `reflect-metadata`: required by NestJS's own decorators and gRPC client, not a
  separate choice.
- `ts-proto`: generates `src/proto/gen/` from the `.proto` files.
- `jest`, `ts-jest`, `ts-node`, `typescript`, `@types/*`: compiler and test runner.

No framework-per-concern: caching, retry, timeout, and bounded concurrency are hand-written in
`src/common/` and `src/cache/`, not pulled from a library, so the logic is visible.

## Finished vs. skipped

Finished: contract-first proto and envelope, all three RPCs, the thin HTTP edge, pagination,
all four response states, caching and resilience, offline tests for every required scenario,
and the standard gRPC health check.

Skipped, all deliberate:
- **Postgres persistence.** No write path exists; a database adds ops surface with no benefit.
- **Circuit breaker.** Timeout + retry already bounds the cost; no failures observed in testing.
- **Redis.** The `Cache` interface supports it; not needed for a single instance.
- **Rate limiting, observability, docker-compose, k6, streaming, OpenAPI.** None change the
  architecture decisions being graded.

## What I'd do next

1. Use the search path's `author_name` before falling back to the per-author fan-out.
2. Share the negative-cache entry between `GetWork` and `GetWorkEditions` for the same id.
3. A real end-to-end deadline across the full retry/fan-out chain, instead of a timeout per
   individual call.
4. Structured logging with a request id propagated edge to service to upstream.

## Assumptions

- `limit` is clamped to 1-100 on `Search` and `GetWorkEditions`.
- Query cache keys fold whitespace/case; the query sent upstream is only trimmed.
- `GetWork`'s `authors` field returns display names, not raw Open Library author keys.

## Code Review

Reviewing the sample `catalog.service.ts` (assessment §4), ranked most severe first.
P0 = breaks correctness or availability. P1 = real bug, narrower trigger. P2 = nit.

### 1. [P0] Swallowed errors return a fake success
`getWork` catches the error, logs it, and falls off the end, returning `undefined`. NestJS
serializes that as `200 OK` with an empty body, so a 503 from upstream looks identical to a
legitimately empty result. Fix: rethrow a typed exception.
```typescript
catch (error) {
  this.logger.error(`getWork(${id}) failed`, error as Error);
  throw new ServiceUnavailableException(`Could not load work ${id}`);
}
```

### 2. [P0] Unbounded `Promise.all`, no partial-failure tolerance
`work.editionIds.map(...)` fires one request per edition, uncapped. `Promise.all` rejects the
whole call the instant one edition fetch fails, discarding every edition that already
succeeded. Fix: bounded concurrency that tolerates per-item failure (see
`src/common/concurrency.ts`).

### 3. [P0] No timeout on any upstream call
A hung connection hangs the request indefinitely. Fix: wrap every call with an abort timeout.

### 4. [P0] Unbounded cache
`this.cache` is a plain `Map`, never expiring. A transient bad result gets cached as
permanently correct, and memory grows without bound. Fix: a TTL'd, bounded cache that only
stores structurally valid results.

### 5. [P1] Cache key collisions
`` `search:${query}:${page}:${limit}` `` doesn't escape `:` in `query`; a title containing `:`
can collide with an unrelated cache entry. Fix: `JSON.stringify({ q, page, limit })`.

### 6. [P1] No request coalescing
The cache only fills after upstream resolves, so N concurrent identical misses all call
upstream. Fix: an in-flight-promise map keyed by cache key, with cleanup on both success and
failure (a leaked entry on failure is worse than no coalescing at all).

### 7. [P1] Cached objects shared by reference
`cache.get(key)` returns the same object every caller got. Downstream code mutating it in
place corrupts the cache for everyone after. Fix: return a defensive copy.

### 8. [P1] `searchAll`'s unbounded `pages` is a DoS vector
Nothing clamps the caller-controlled `pages`. Fix: `Math.min(Math.max(1, pages), 20)`.

### 9. [P2] `searchAll` never short-circuits
Keeps requesting pages even after one returns fewer than `limit` docs. Fix: break on a short
page.

### 10. [P1] No retry logic
A single transient failure is unrecoverable as written.

### 11. [P1] No input validation
Nothing rejects an empty query or a bad page/limit before the cache/upstream.

### 12. [P2] Pervasive `any`
No type safety on `work.editionIds` or `result.docs`; an upstream field rename becomes a
runtime error instead of a compile error.

### 13. [P1] `Logger.error` with no rethrow
Combined with #1, the error is logged but never surfaced to the caller or the framework's own
exception filter.

The common thread: this code assumes the happy path and has no answer for failure, latency, or
concurrency. The single worst line is the implicit `return undefined;` in `getWork`'s catch
block, since it turns every upstream failure into something indistinguishable from success.

## AI Usage

I don't have hands-on experience with NestJS or gRPC. Claude (Anthropic) wrote the
implementation in this submission in a guided TDD session; I did not hand-type `src/`. Every
source file carries an `AI-ASSISTED` header saying so (generated proto stubs don't, since
that's compiler output, not AI output).

What's mine: the architecture decisions, the pagination model, the response envelope, and
skipping the per-edition fan-out after testing the live API showed it wasn't needed. I
reviewed the generated code instead of accepting it; a later pass removed 5 unused
dependencies, a dead contract field, an unreachable line, and an unused method. I can explain
any decision here.
