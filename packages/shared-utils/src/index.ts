/**
 * @d2d/shared-utils — cross-cutting helpers used by every service + worker.
 *
 * Hard rule: money is BigInt cents (ADR-0007); never use Number for money.
 * Hard rule: all error responses are RFC 7807 Problem Details (ADR-0009).
 * Hard rule: every POST mutation requires an Idempotency-Key (ADR-0010).
 */

export * from './money';
export * from './problem';
export * from './idempotency';
export * from './hash';
export * from './ulid';
export * from './audit-chain';
export * from './attribution-rake';
