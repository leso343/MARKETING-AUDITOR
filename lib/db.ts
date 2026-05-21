/**
 * Tier 3 — Drizzle ORM client over libsql.
 *
 * libsql is the SQLite-compatible driver from Turso. Same client connects to:
 *   - local file (dev):  DATABASE_URL="file:./data/dev.db"
 *   - Turso (prod):      DATABASE_URL="libsql://<your-db>.turso.io"
 *                        DATABASE_AUTH_TOKEN="<turso token>"
 *
 * Postgres deployment: swap to drizzle-orm/postgres-js with a small driver change.
 * See README "Deploy" section.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * When DATABASE_URL is unset OR client init fails, we export a **stub** db
 * whose query chain (select / from / where / limit / insert / values / update
 * / set / delete) is awaitable and resolves to `[]`. This means:
 *   - The site never crashes from a missing DB env var on Vercel.
 *   - Callers (e.g. lib/access.ts) that don't pre-check `dbAvailable` still
 *     get a safe empty result and fall back to filesystem code paths.
 *   - When DATABASE_URL *is* set, behavior is identical to before — the real
 *     drizzle client is used.
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

// Reuse a single client across Next.js hot-reloads in dev.
const globalForDb = globalThis as unknown as {
  __libsqlClient?: Client;
};

/**
 * Stub query builder. Drizzle's chains are thenable — `await db.select()...`
 * resolves to an array of rows. We replicate that with a Proxy: every property
 * access returns a callable that re-yields the proxy, and `.then` resolves to
 * `[]`. Insert/update/delete return-typed callers also await to `[]`.
 *
 * This is intentionally permissive — any drizzle method name resolves. The
 * only contract is: awaiting the chain yields `[]`.
 */
function makeStubChain(): unknown {
  const noop = (() => makeStubChain()) as unknown as object;
  const proxy: unknown = new Proxy(noop, {
    get(_t, prop) {
      if (prop === "then") {
        // Thenable: `await chain` → []
        return (resolve: (v: unknown[]) => void) => resolve([]);
      }
      if (prop === "catch" || prop === "finally") {
        return () => proxy;
      }
      if (typeof prop === "symbol") return undefined;
      // Any method (select/from/where/limit/insert/values/set/update/delete/…)
      // returns the same stub chain so it stays chainable.
      return () => makeStubChain();
    },
    apply() {
      return makeStubChain();
    },
  });
  return proxy;
}

let realDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (url) {
  try {
    const client =
      globalForDb.__libsqlClient ?? createClient({ url, authToken });
    if (process.env.NODE_ENV !== "production") {
      globalForDb.__libsqlClient = client;
    }
    realDb = drizzle(client, { schema });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[lib/db] DB init failed — running in stub mode. Multi-tenant features disabled.",
      err,
    );
  }
}

/** True when a usable DB client is wired. False → callers should fall back. */
export const dbAvailable: boolean = realDb !== null;


// Cast the stub to the realDb type so callers' TypeScript still type-checks.
// The stub *behaviorally* honors the awaited-array contract — runtime is safe.
export const db = (realDb ?? (makeStubChain() as ReturnType<typeof drizzle<typeof schema>>));
export { schema };
