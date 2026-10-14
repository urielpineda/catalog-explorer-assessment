// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

// DI tokens for the interfaces CatalogService depends on. Production
// wiring binds these to the real HTTP client / in-memory cache; tests
// construct CatalogService directly with stubs and never touch this file.
export const OPEN_LIBRARY_CLIENT = Symbol('OPEN_LIBRARY_CLIENT');
export const CACHE = Symbol('CACHE');
