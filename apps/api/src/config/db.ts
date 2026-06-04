/**
 * Prisma client singleton + tenant-scoped extension.
 *
 * The tenant-scoped client injects `where: { orgId }` on every query so
 * that even a developer mistake can't read across tenants. Postgres RLS
 * provides the second belt; this is the suspenders.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { env } from './env';

let _prisma: PrismaClient | undefined;

export function prisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      datasources: { db: { url: env().DATABASE_URL } },
      log: env().NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return _prisma;
}

/**
 * Set of model names (PascalCase, as Prisma reports them in the query
 * extension's `model` argument) that carry an `orgId` column. Derived once
 * from the DMMF so it never drifts from the schema: if a future model adds
 * `orgId`, it is scoped automatically; control-plane tables (Org, Address,
 * Donation, …) have no `orgId` and pass through untouched.
 */
const orgScopedModels: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'orgId'))
    .map((m) => m.name),
);

/**
 * Operations whose `where` clause we must constrain to the caller's org.
 * `findUnique`/`findUniqueOrThrow` are intentionally absent here — Prisma
 * forbids non-unique filters (like `orgId`) in a unique `where`, so we
 * rewrite those to their `findFirst*` equivalents below instead.
 */
const whereScopedOps: ReadonlySet<string> = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

/**
 * Merge `{ orgId }` into an existing `where` without clobbering sibling
 * filters. If the caller already pinned a *matching* orgId we leave it
 * (idempotent — "belt + suspenders" callers stay valid); a *different*
 * orgId is a cross-tenant bug, so we throw.
 */
function scopeWhere(
  where: Record<string, unknown> | undefined,
  orgId: string,
): Record<string, unknown> {
  if (where && 'orgId' in where) {
    const existing = where.orgId;
    if (typeof existing === 'string' && existing !== orgId) {
      throw new Error(
        `tenantPrisma: where.orgId (${existing}) does not match tenant orgId (${orgId})`,
      );
    }
    // A non-string filter (e.g. { in: [...] }) could still escape the tenant.
    if (typeof existing !== 'string') {
      throw new Error('tenantPrisma: where.orgId must be a plain string equal to the tenant orgId');
    }
  }
  return { ...(where ?? {}), orgId };
}

/**
 * Stamp `orgId` onto a create/update `data` payload. Absent → set it;
 * present + matching → leave; present + different → throw (caller bug).
 */
function stampData(
  data: Record<string, unknown> | undefined,
  orgId: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(data ?? {}) };
  if ('orgId' in next) {
    if (next.orgId !== orgId) {
      throw new Error(
        `tenantPrisma: data.orgId (${String(next.orgId)}) does not match tenant orgId (${orgId})`,
      );
    }
    return next;
  }
  next.orgId = orgId;
  return next;
}

/**
 * The extended client type. `$extends` narrows the runtime client; we expose
 * the inferred type so callers (and `tenant-guard`) get full autocompletion.
 */
export type TenantPrismaClient = ReturnType<typeof buildTenantClient>;

/**
 * The base client's model delegates keyed by their camelCase property name,
 * each exposing `findFirst`/`findFirstOrThrow`. Prisma's `$allOperations`
 * callback is itself typed with `args: any` (see runtime/library.d.ts), so a
 * single narrow cast to this shape is consistent with the extension API and
 * is not "dodging" a real type error — it only names the dynamic delegate
 * lookup we need for the findUnique→findFirst rewrite.
 */
type FindFirstDelegate = {
  findFirst: (args: unknown) => Promise<unknown>;
  findFirstOrThrow: (args: unknown) => Promise<unknown>;
};

/**
 * The effective operation + tenant-scoped args produced by {@link reshapeForTenant}.
 * `operation` may be rewritten (findUnique → findFirst), so the caller knows
 * which delegate method to invoke.
 */
interface ReshapedOp {
  operation: string;
  args: Record<string, unknown>;
}

/**
 * Pure tenant arg-reshaper — the single source of truth shared by BOTH belts:
 *   • {@link tenantPrisma}   — app-layer injection, no transaction (suspenders)
 *   • {@link tenantPrismaTx} — same injection wrapped in a GUC-pinned tx (belt)
 *
 * Given a Prisma operation + args for an org-scoped model, returns the effective
 * operation and an args object with `where`/`data` constrained to `orgId` (via
 * {@link scopeWhere}/{@link stampData}, which throw on a cross-tenant attempt).
 * Returns `null` for operations we deliberately leave untouched (connection/raw
 * ops) so the caller can pass them through.
 *
 * It does NOT execute anything — each caller dispatches the result against its
 * own executor (the base client, or a transaction client). Keeping this pure and
 * shared is what guarantees the two belts can never drift apart and quietly
 * disagree about what "scoped to this tenant" means.
 */
function reshapeForTenant(operation: string, args: unknown, orgId: string): ReshapedOp | null {
  const a = (args ?? {}) as Record<string, unknown>;

  // findUnique(OrThrow) can't accept a non-unique `orgId` filter, so rewrite to
  // findFirst(OrThrow), which can — then AND in orgId.
  if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
    const where = a.where as Record<string, unknown> | undefined;
    return {
      operation: operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow',
      args: { ...a, where: scopeWhere(where, orgId) },
    };
  }

  if (whereScopedOps.has(operation)) {
    const where = a.where as Record<string, unknown> | undefined;
    return { operation, args: { ...a, where: scopeWhere(where, orgId) } };
  }

  if (operation === 'create') {
    const data = a.data as Record<string, unknown> | undefined;
    return { operation, args: { ...a, data: stampData(data, orgId) } };
  }

  if (operation === 'createMany' || operation === 'createManyAndReturn') {
    const data = a.data;
    const rows = Array.isArray(data)
      ? data.map((row) => stampData(row as Record<string, unknown>, orgId))
      : stampData(data as Record<string, unknown> | undefined, orgId);
    return { operation, args: { ...a, data: rows } };
  }

  if (operation === 'upsert') {
    const where = a.where as Record<string, unknown> | undefined;
    // upsert.where is a unique selector; we can't AND orgId into it (same
    // constraint as findUnique). We stamp create/update data so a new row lands
    // in the right tenant, and rely on the stamped `update.data.orgId` matching
    // (plus RLS WITH CHECK under tenantPrismaTx) to reject a cross-tenant target.
    const create = stampData(a.create as Record<string, unknown> | undefined, orgId);
    const update = stampData(a.update as Record<string, unknown> | undefined, orgId);
    return { operation, args: { ...a, where: where ?? {}, create, update } };
  }

  // Connection/raw or otherwise non-scopable op — leave it alone.
  return null;
}

function buildTenantClient(orgId: string) {
  return prisma().$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // `model` is undefined for top-level/raw ops; only scope models we
          // know carry an orgId column. Everything else passes through.
          if (model === undefined || !orgScopedModels.has(model)) {
            return query(args);
          }

          // Shared, pure tenant arg-reshaper (also used by tenantPrismaTx).
          // `null` = an operation we don't touch → pass straight through.
          const reshaped = reshapeForTenant(operation, args, orgId);
          if (reshaped === null) return query(args);

          // findUnique(OrThrow) was rewritten to findFirst(OrThrow) — the bound
          // `query` is still pinned to the unique op and won't honour it, so we
          // dispatch to the *base* delegate. orgId is already merged into the
          // args, so this is not double-scoped and cannot recurse.
          if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
            const delegates = prisma() as unknown as Record<string, FindFirstDelegate>;
            const delegate = delegates[lowerFirst(model)];
            if (!delegate) return query(args);
            return reshaped.operation === 'findFirst'
              ? delegate.findFirst(reshaped.args)
              : delegate.findFirstOrThrow(reshaped.args);
          }

          // Every other reshaped op keeps its name; feed it the scoped args.
          // Assigned to a typed variable (not an object literal) so TS resolves
          // Prisma's catch-all `any` overload instead of the per-model union.
          const nextArgs: Record<string, unknown> = reshaped.args;
          return query(nextArgs);
        },
      },
    },
  });
}

/** Lowercase the first letter — maps a DMMF model name to its delegate key. */
function lowerFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/**
 * Build a tenant client whose every org-scoped operation runs inside a
 * GUC-pinned transaction (the SEC-005 read-side belt). Parameterised on the base
 * `client` so tests can drive it through the non-owner `d2d_app` role and prove
 * RLS actually bites; production uses the global `prisma()`.
 *
 * Mechanics: reuse {@link reshapeForTenant} to inject `where: { orgId }` (the
 * suspenders), then dispatch the reshaped op against a {@link runTenantTx}
 * transaction that has set `app.current_org_id` (the belt). The transaction is
 * taken from the BASE `client`, so the delegate inside it is un-extended and
 * cannot recurse back into this callback. findUnique→findFirst is handled by the
 * reshaper, so the unique-filter constraint never reaches the tx delegate.
 */
function buildTenantTxClient(client: PrismaClient, orgId: string) {
  return client.$extends({
    name: 'tenant-scope-tx',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Non-tenant models carry no orgId and no RLS policy — run them on the
          // base connection unchanged (nothing to scope, no GUC required).
          if (model === undefined || !orgScopedModels.has(model)) {
            return query(args);
          }
          const reshaped = reshapeForTenant(operation, args, orgId) ?? {
            operation,
            args: (args ?? {}) as Record<string, unknown>,
          };
          // One short GUC-pinned tx per operation. For several reads/writes in
          // one unit of work, prefer a single tenantTx(orgId, tx => …) instead —
          // it sets the GUC once and shares one connection.
          return runTenantTx(client, orgId, async (tx) => {
            const delegate = (
              tx as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>
            )[lowerFirst(model)];
            const fn = delegate?.[reshaped.operation];
            if (!fn) {
              throw new Error(
                `tenantPrismaTx: unknown delegate ${lowerFirst(model)}.${reshaped.operation}`,
              );
            }
            return fn(reshaped.args);
          });
        },
      },
    },
  });
}

/**
 * Tenant-scoped Prisma — wraps the *same* global client (no new pool) so
 * every query is forced to include `where: { orgId }`. Use this in domain
 * services instead of the raw `prisma()` client.
 *
 * Opt-in: existing services that still call `prisma()` are unaffected.
 */
export function tenantPrisma(orgId: string): TenantPrismaClient {
  if (!orgId) {
    throw new Error('tenantPrisma: orgId is required');
  }
  return buildTenantClient(orgId);
}

/**
 * Tenant-scoped Prisma whose every operation runs inside a GUC-pinned
 * transaction — the SEC-005 read-side belt that makes reads work once the app
 * connects as the non-owner `d2d_app` role. Same `where: { orgId }` injection as
 * {@link tenantPrisma} (the suspenders) PLUS a per-op
 * `set_config('app.current_org_id', …)` so Postgres RLS (the belt) admits the
 * caller's rows. An un-GUC'd read under `d2d_app` matches `"orgId" = NULL` and
 * returns ZERO rows — deny-by-default — so this wrapper is what every standalone
 * read path needs after cutover (see docs/runbooks/rls-cutover.md §4b).
 *
 * Drop-in for `prisma()` in read paths. Do NOT call inside a tenantTx callback
 * (it would open a second, independent transaction on another connection) — use
 * the handed `tx` there.
 */
export function tenantPrismaTx(orgId: string): TenantPrismaClient {
  if (!orgId) {
    throw new Error('tenantPrismaTx: orgId is required');
  }
  return tenantPrismaTxOn(prisma(), orgId);
}

/**
 * Seam behind {@link tenantPrismaTx}, parameterised on the client so the RLS
 * belt test can run it against the non-owner `d2d_app` role (the global
 * `prisma()` connects as the table owner, which bypasses non-FORCEd RLS).
 * Production code should call `tenantPrismaTx`. The returned object is a Prisma
 * `$extends` client with only a `query` extension, so its delegate shape is
 * structurally identical to {@link TenantPrismaClient}; the cast only erases the
 * distinct extension *name* in the inferred type.
 */
export function tenantPrismaTxOn(client: PrismaClient, orgId: string): TenantPrismaClient {
  if (!orgId) {
    throw new Error('tenantPrismaTxOn: orgId is required');
  }
  return buildTenantTxClient(client, orgId) as unknown as TenantPrismaClient;
}

/**
 * Run `fn` inside a transaction pinned to `orgId` (SEC-005 — the RLS "belt").
 *
 * Sets the transaction-local `app.current_org_id` GUC that Postgres RLS
 * policies consume (`USING ("orgId" = current_setting('app.current_org_id',
 * true))`). Because the app's runtime DB role is a *non-owner* role with RLS
 * enforced (see prisma/rls/bootstrap-app-role.sql + the rls_belt migration),
 * any tenant table read/written inside this transaction is constrained to
 * `orgId` by the database itself — not just the app layer.
 *
 * `set_config(key, value, true)` is transaction-scoped: it is rolled back at
 * COMMIT/ROLLBACK, so it never leaks to the next user of a pooled connection.
 * Parameterised via the tagged template — never string-interpolated — so the
 * orgId can't break out of the GUC assignment.
 *
 * The `tx` handed to `fn` is a plain `Prisma.TransactionClient`, so existing
 * helpers (`writeAudit(tx, …)`, `AuditService.recordEvent(tx, …)`) work
 * unchanged. Callers still pass `orgId` in their `data`/`where` as today; the
 * GUC is the database-enforced floor underneath that.
 */
export async function tenantTx<T>(
  orgId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number },
): Promise<T> {
  return runTenantTx(prisma(), orgId, fn, options);
}

/**
 * Implementation seam behind {@link tenantTx}, parameterised on the client so
 * tests can prove RLS actually bites by running it against the non-owner
 * `d2d_app` role (the global `prisma()` connects as the table owner, which
 * bypasses non-FORCEd RLS). Production code should call `tenantTx`.
 */
export async function runTenantTx<T>(
  client: Pick<PrismaClient, '$transaction'>,
  orgId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number },
): Promise<T> {
  if (!orgId) {
    throw new Error('tenantTx: orgId is required');
  }
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return fn(tx);
  }, options);
}

export async function shutdownDb(): Promise<void> {
  await _prisma?.$disconnect();
}
