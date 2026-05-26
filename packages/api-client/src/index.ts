/**
 * @d2d/api-client — typed wrappers around Door 2 Digital REST API.
 *
 * Two usage modes:
 *   1. Browser: same-origin `/proxy/api/*` rewrite (see next.config.mjs).
 *      Cookies travel automatically (`credentials: include`).
 *   2. Node / server components: pass `baseUrl` pointing at the API host
 *      and forward the request cookie via the `headers` option per call.
 */
export { ApiClient, ApiError, getClient, resetClient } from './client';
export type { ApiClientOptions, ApiRequestInit } from './client';
export { createAuthApi } from './auth';
export type { AuthApi } from './auth';
export type { AuthResponse, User, ProblemDetails, PlatformRole, RegionCode } from './types';
