import { pool } from '@workspace/db';

export type ReleaseLock = () => Promise<void>;

export async function acquireDistributedLock(lockName: string): Promise<ReleaseLock | null> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'select pg_try_advisory_lock(hashtext($1)) as acquired',
      [lockName],
    );

    if (!(result.rows[0] as { acquired?: boolean } | undefined)?.acquired) {
      client.release();
      return null;
    }

    return async () => {
      try {
        await client.query('select pg_advisory_unlock(hashtext($1))', [lockName]);
      } finally {
        client.release();
      }
    };
  } catch (error) {
    client.release();
    throw error;
  }
}