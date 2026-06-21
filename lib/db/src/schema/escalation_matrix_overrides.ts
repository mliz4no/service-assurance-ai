import { pgTable, text, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import { usersTable } from './users';

export const escalationMatrixOverridesTable = pgTable(
  'escalation_matrix_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scopeType: text('scope_type', { enum: ['global', 'customer', 'site', 'service'] }).notNull(),
    scopeId: uuid('scope_id'),
    impactLevel: text('impact_level', { enum: ['low', 'medium', 'high'] }).notNull(),
    urgencyLevel: text('urgency_level', { enum: ['low', 'medium', 'high'] }).notNull(),
    derivedSeverity: text('derived_severity', {
      enum: ['low', 'medium', 'high', 'critical'],
    }).notNull(),
    updatedByUserId: uuid('updated_by_user_id').references(() => usersTable.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    uniqueScopeCell: unique('uq_matrix_scope_cell').on(
      t.scopeType,
      t.scopeId,
      t.impactLevel,
      t.urgencyLevel,
    ),
  }),
);

export type EscalationMatrixOverride = typeof escalationMatrixOverridesTable.$inferSelect;
export type InsertEscalationMatrixOverride = typeof escalationMatrixOverridesTable.$inferInsert;
