/**
 * Public types for the Door 2 Digital API client. Mirrors the API service
 * layer's response shapes — kept manually in sync until codegen lands.
 */

export type PlatformRole =
  | 'super_admin'
  | 'org_admin'
  | 'manager'
  | 'knocker'
  | 'inside_sales'
  | 'accountant'
  | 'auditor'
  | 'viewer';

export type RegionCode = 'AU' | 'US' | 'SG';

export interface User {
  id: string;
  email: string;
  role: PlatformRole;
  orgId: string;
  regionCode: RegionCode;
  brandCode: string;
  givenName: string;
  familyName: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  user: User;
}

/**
 * RFC 7807 Problem Details. The API returns these (with
 * `application/problem+json` content-type) for every non-2xx response.
 */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** Optional per-field validation errors. */
  errors?: Record<string, string[]>;
  /** Allow arbitrary problem extensions per RFC 7807 §3.2. */
  [k: string]: unknown;
}
