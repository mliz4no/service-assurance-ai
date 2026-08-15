import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, '../../../.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const [{ coreSchemaExists }] = (
    await client.query("select to_regclass('public.users') is not null as \"coreSchemaExists\"")
  ).rows;
  if (!coreSchemaExists) {
    throw new Error('Core schema is absent; run db:migrate directly for a clean installation.');
  }

  await client.query('create schema if not exists drizzle');
  await client.query(`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `);

  const [{ migrationCount }] = (
    await client.query('select count(*)::int as "migrationCount" from drizzle.__drizzle_migrations')
  ).rows;
  if (migrationCount > 0) {
    console.log('Migration history already exists; no baseline change was made.');
  } else {
    const baselinePath = path.resolve(scriptDir, '../drizzle/0000_simple_rafael_vega.sql');
    const baselineSql = await readFile(baselinePath);
    const hash = createHash('sha256').update(baselineSql).digest('hex');
    await client.query(
      'insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)',
      [hash, 1774934100456],
    );
    console.log('Recorded the original schema baseline. Run db:migrate next.');
  }
} finally {
  await client.end();
}