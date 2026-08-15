import { createHash } from 'node:crypto';
import { authSessionsTable, db, usersTable } from '@workspace/db';
import { and, eq, gt } from 'drizzle-orm';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(token: string, userId: string): Promise<void> {
  await db.insert(authSessionsTable).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(authSessionsTable).where(eq(authSessionsTable.tokenHash, hashToken(token)));
}

export async function getUserFromToken(token: string) {
  const [result] = await db
    .select({ user: usersTable })
    .from(authSessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, authSessionsTable.userId))
    .where(
      and(
        eq(authSessionsTable.tokenHash, hashToken(token)),
        gt(authSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return result?.user ?? null;
}
