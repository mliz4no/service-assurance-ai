import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const { Pool } = pg;

// Prepare variables to export (use top-level exports to satisfy bundlers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pool: any = undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = undefined;

if (!process.env.DATABASE_URL) {
  if (process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true') {
    // In dry-run/dev mode, skip initializing a real DB so the server can start
    // without a DATABASE_URL. Consumers should guard against a null `db`.
    pool = null;
    db = null;
  } else {
    throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
  }
} else {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
}

export { pool, db };
export * from './schema';

export * from './schema';
