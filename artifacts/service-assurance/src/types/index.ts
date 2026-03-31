/**
 * Type augmentations for fields that exist in the DB and API responses
 * but were not included in the auto-generated OpenAPI types.
 *
 * These are additive — they extend generated types, never replace them.
 */

import type { TicketWithRelations } from "@workspace/api-client-react";

/**
 * Per-action AI timestamps written by the tickets route when each
 * AI action runs. The generated Ticket type only has `aiLastGeneratedAt`
 * (the composite timestamp); these are the per-panel granular ones.
 * Also includes `aiConfidence` which the DB stores but the spec omits.
 */
export interface TicketAiFields {
  /** Timestamp of the last executive summary generation */
  aiSummarizedAt?: string | null;
  /** Timestamp of the last normalized-status generation */
  aiNormalizedAt?: string | null;
  /** Timestamp of the last customer-update-draft generation */
  aiCustomerUpdateAt?: string | null;
  /** 0-100 confidence score from the last AI run */
  aiConfidence?: number | null;
}

/**
 * Full ticket with relations AND the extra AI timing/confidence fields
 * returned by the API but missing from the generated OpenAPI spec.
 *
 * Named `TicketWithAI` to avoid clashing with the generated `TicketDetail`
 * (which extends TicketWithRelations with an optional `updates` array).
 */
export type TicketWithAI = TicketWithRelations & TicketAiFields;
