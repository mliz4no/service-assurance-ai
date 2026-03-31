import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface Session {
  userId: string;
  createdAt: number;
}

const sessions = new Map<string, Session>();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function createSession(token: string, userId: string): void {
  sessions.set(token, { userId, createdAt: Date.now() });
}

export function getSession(token: string): Session | undefined {
  const session = sessions.get(token);
  if (!session) return undefined;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return undefined;
  }
  return session;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

export async function getUserFromToken(token: string) {
  const session = getSession(token);
  if (!session) return null;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId));
  return user || null;
}
