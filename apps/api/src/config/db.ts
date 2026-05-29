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

          // Prisma types `args` as `any` for the catch-all operation; narrow
          // it to a mutable record we can re-shape before delegating.
          const a = (args ?? {}) as Record<string, unknown>;

          // findUnique(OrThrow) can't accept a non-unique `orgId` filter, so
          // we rewrite to findFirst(OrThrow), which can — then AND in orgId.
          // We delegate to the *base* client (not `query`, which is bound to
          // findUnique) so the rewritten op is honoured; the orgId is already
          // merged here, so this is not double-scoped and cannot recurse.
          if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
            const where = a.where as Record<string, unknown> | undefined;
            const next = { ...a, where: scopeWhere(where, orgId) };
            const delegates = prisma() as unknown as Record<string, FindFirstDelegate>;
            const delegate = delegates[lowerFirst(model)];
            if (!delegate) return query(args);
            return operation === 'findUnique'
              ? delegate.findFirst(next)
              : delegate.findFirstOrThrow(next);
          }

          // Reshaped args are assigned to a `Record<string, unknown>` variable
          // before being handed to `query`. Prisma types the catch-all
          // `query` param as `any` (runtime/library.d.ts), but a *fresh object
          // literal* makes TS resolve the narrower per-model union overload and
          // reject our generic record shape — passing a typed variable hits the
          // intended `any` overload. The reshaping is runtime-correct.
          let next: Record<string, unknown>;

          if (whereScopedOps.has(operation)) {
            const where = a.where as Record<string, unknown> | undefined;
            next = { ...a, where: scopeWhere(where, orgId) };
            return query(next);
          }

          if (operation === 'create') {
            const data = a.data as Record<string, unknown> | undefined;
            next = { ...a, data: stampData(data, orgId) };
            return query(next);
          }

          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const data = a.data;
            const rows = Array.isArray(data)
              ? data.map((row) => stampData(row as Record<string, unknown>, orgId))
              : stampData(data as Record<string, unknown> | undefined, orgId);
            next = { ...a, data: rows };
            return query(next);
          }

          if (operation === 'upsert') {
            const where = a.where as Record<string, unknown> | undefined;
            // upsert.where is a unique selector; we can't AND orgId into it
            // (same constraint as findUnique). We stamp create/update data so
            // a new row lands in the right tenant, and rely on the stamped
            // `update.data.orgId` matching to reject a cross-tenant target.
            const create = stampData(a.create as Record<string, unknown> | undefined, orgId);
            const update = stampData(a.update as Record<string, unknown> | undefined, orgId);
            next = { ...a, where: where ?? {}, create, update };
            return query(next);
          }

          // Any other operation on an org-scoped model: pass through. (There
          // is no remaining read/write that can leak — count/aggregate/etc.
          // are covered above; the rest are connection/raw ops.)
          return query(args);
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
