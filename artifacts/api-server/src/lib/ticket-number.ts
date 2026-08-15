import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';

const COUNTER_KEY = 'service_assurance';

export async function getNextTicketNumber(): Promise<string> {
  const result = await db.execute(sql`
    insert into ticket_number_counters (key, last_value)
    values (
      ${COUNTER_KEY},
      (select coalesce(max(substring(ticket_number from '[0-9]+$')::integer), 1000) + 1 from tickets)
    )
    on conflict (key) do update
      set last_value = ticket_number_counters.last_value + 1
    returning last_value
  `);
  const nextValue = Number(result.rows[0]?.last_value);

  if (!Number.isSafeInteger(nextValue)) {
    throw new Error('Unable to allocate the next ticket number.');
  }

  return `SA-${nextValue}`;
}