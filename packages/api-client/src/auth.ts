/**
 * Auth API wrappers. Endpoints set / clear httpOnly cookies on the API
 * side; callers don't need to manage tokens manually for browser flows.
 */
import { ApiClient, getClient } from './client';
import type { AuthResponse, User } from './types';

export function createAuthApi(client: ApiClient = getClient()) {
  return {
    login(email: string, password: string): Promise<AuthResponse> {
      return client.request<AuthResponse>('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    /** Server clears cookies + revokes refresh token. Idempotent. */
    logout(): Promise<void> {
      return client.request<void>('/v1/auth/logout', { method: 'POST', body: '{}' });
    },
    /** Current user from access token. 401s on missing/invalid cookie. */
    me(): Promise<{ user: User }> {
      return client.request<{ user: User }>('/v1/auth/me');
    },
    /** Rotate access + refresh tokens — cookie path is /v1/auth so only this route ships d2d_rt. */
    refresh(): Promise<AuthResponse> {
      return client.request<AuthResponse>('/v1/auth/refresh', { method: 'POST', body: '{}' });
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
