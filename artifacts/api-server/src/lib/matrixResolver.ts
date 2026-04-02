import { db, escalationMatrixOverridesTable } from "@workspace/db";
import { or, and, eq, isNull } from "drizzle-orm";
import { type ImpactLevel, type UrgencyLevel, type SeverityLevel } from "./severity";

export type MatrixScopeType = "global" | "customer" | "site" | "service";

const SCOPE_PRIORITY: Record<string, number> = {
  global: 1,
  customer: 2,
  site: 3,
  service: 4,
};

const SCOPE_LABELS: Record<string, string> = {
  global: "Global override",
  customer: "Customer override",
  site: "Location override",
  service: "Service override",
};

export const DEFAULT_MATRIX: Record<ImpactLevel, Record<UrgencyLevel, SeverityLevel>> = {
  high: { high: "critical", medium: "high", low: "medium" },
  medium: { high: "high", medium: "medium", low: "low" },
  low: { high: "medium", medium: "low", low: "low" },
};

export type MatrixCell = {
  impactLevel: ImpactLevel;
  urgencyLevel: UrgencyLevel;
  derivedSeverity: SeverityLevel;
  isOverride: boolean;
  overrideId: string | null;
  inheritedFrom: string | null;
};

type OverrideRow = {
  id: string;
  scopeType: string;
  scopeId: string | null;
  impactLevel: string;
  urgencyLevel: string;
  derivedSeverity: string;
};

export async function fetchOverridesForContext(context: {
  customerId: string;
  siteId?: string | null;
  serviceId?: string | null;
}): Promise<OverrideRow[]> {
  const conds: ReturnType<typeof and>[] = [
    and(
      eq(escalationMatrixOverridesTable.scopeType, "global"),
      isNull(escalationMatrixOverridesTable.scopeId)
    ),
    and(
      eq(escalationMatrixOverridesTable.scopeType, "customer"),
      eq(escalationMatrixOverridesTable.scopeId, context.customerId)
    ),
  ];

  if (context.siteId) {
    conds.push(
      and(
        eq(escalationMatrixOverridesTable.scopeType, "site"),
        eq(escalationMatrixOverridesTable.scopeId, context.siteId)
      )
    );
  }

  if (context.serviceId) {
    conds.push(
      and(
        eq(escalationMatrixOverridesTable.scopeType, "service"),
        eq(escalationMatrixOverridesTable.scopeId, context.serviceId)
      )
    );
  }

  return db
    .select()
    .from(escalationMatrixOverridesTable)
    .where(or(...conds)) as Promise<OverrideRow[]>;
}

export function resolveCellFromOverrides(
  impact: ImpactLevel,
  urgency: UrgencyLevel,
  overrides: OverrideRow[]
): { severity: SeverityLevel; scopeLabel: string } {
  const cellOverrides = overrides
    .filter((o) => o.impactLevel === impact && o.urgencyLevel === urgency)
    .sort(
      (a, b) => (SCOPE_PRIORITY[b.scopeType] ?? 0) - (SCOPE_PRIORITY[a.scopeType] ?? 0)
    );

  if (cellOverrides.length > 0) {
    const winner = cellOverrides[0];
    return {
      severity: winner.derivedSeverity as SeverityLevel,
      scopeLabel: SCOPE_LABELS[winner.scopeType] ?? "Override",
    };
  }

  return {
    severity: DEFAULT_MATRIX[impact][urgency],
    scopeLabel: "Default ITIL matrix",
  };
}

export async function resolveMatrixCellForTicket(
  context: {
    customerId: string;
    siteId?: string | null;
    serviceId?: string | null;
  },
  impact: ImpactLevel,
  urgency: UrgencyLevel
): Promise<{ severity: SeverityLevel; scopeLabel: string }> {
  const overrides = await fetchOverridesForContext(context);
  return resolveCellFromOverrides(impact, urgency, overrides);
}

export async function getEffectiveMatrixForScope(
  scopeType: MatrixScopeType | "default",
  scopeId: string | null
): Promise<MatrixCell[]> {
  const IMPACTS: ImpactLevel[] = ["high", "medium", "low"];
  const URGENCIES: UrgencyLevel[] = ["high", "medium", "low"];

  let overrides: OverrideRow[] = [];

  if (scopeType !== "default") {
    const cond = scopeId
      ? and(
          eq(escalationMatrixOverridesTable.scopeType, scopeType),
          eq(escalationMatrixOverridesTable.scopeId, scopeId)
        )
      : and(
          eq(escalationMatrixOverridesTable.scopeType, scopeType),
          isNull(escalationMatrixOverridesTable.scopeId)
        );

    overrides = (await db
      .select()
      .from(escalationMatrixOverridesTable)
      .where(cond)) as OverrideRow[];
  }

  const cells: MatrixCell[] = [];
  for (const impact of IMPACTS) {
    for (const urgency of URGENCIES) {
      const override = overrides.find(
        (o) => o.impactLevel === impact && o.urgencyLevel === urgency
      );
      cells.push({
        impactLevel: impact,
        urgencyLevel: urgency,
        derivedSeverity: override
          ? (override.derivedSeverity as SeverityLevel)
          : DEFAULT_MATRIX[impact][urgency],
        isOverride: !!override,
        overrideId: override?.id ?? null,
        inheritedFrom: override ? null : "Default ITIL matrix",
      });
    }
  }

  return cells;
}

export async function upsertMatrixOverrides(
  scopeType: MatrixScopeType,
  scopeId: string | null,
  cells: Array<{ impactLevel: string; urgencyLevel: string; derivedSeverity: string }>,
  updatedByUserId?: string
): Promise<void> {
  const IMPACTS: ImpactLevel[] = ["high", "medium", "low"];
  const URGENCIES: UrgencyLevel[] = ["high", "medium", "low"];

  for (const impact of IMPACTS) {
    for (const urgency of URGENCIES) {
      const cell = cells.find(
        (c) => c.impactLevel === impact && c.urgencyLevel === urgency
      );
      const defaultSeverity = DEFAULT_MATRIX[impact][urgency];
      const incoming = cell?.derivedSeverity ?? defaultSeverity;

      const existingCond = scopeId
        ? and(
            eq(escalationMatrixOverridesTable.scopeType, scopeType),
            eq(escalationMatrixOverridesTable.scopeId, scopeId),
            eq(escalationMatrixOverridesTable.impactLevel, impact),
            eq(escalationMatrixOverridesTable.urgencyLevel, urgency)
          )
        : and(
            eq(escalationMatrixOverridesTable.scopeType, scopeType),
            isNull(escalationMatrixOverridesTable.scopeId),
            eq(escalationMatrixOverridesTable.impactLevel, impact),
            eq(escalationMatrixOverridesTable.urgencyLevel, urgency)
          );

      const [existing] = await db
        .select({ id: escalationMatrixOverridesTable.id })
        .from(escalationMatrixOverridesTable)
        .where(existingCond);

      if (incoming === defaultSeverity) {
        if (existing) {
          await db
            .delete(escalationMatrixOverridesTable)
            .where(eq(escalationMatrixOverridesTable.id, existing.id));
        }
      } else {
        if (existing) {
          await db
            .update(escalationMatrixOverridesTable)
            .set({
              derivedSeverity: incoming as SeverityLevel,
              updatedByUserId: updatedByUserId ?? null,
            })
            .where(eq(escalationMatrixOverridesTable.id, existing.id));
        } else {
          await db.insert(escalationMatrixOverridesTable).values({
            scopeType,
            scopeId: scopeId ?? null,
            impactLevel: impact as ImpactLevel,
            urgencyLevel: urgency as UrgencyLevel,
            derivedSeverity: incoming as SeverityLevel,
            updatedByUserId: updatedByUserId ?? null,
          });
        }
      }
    }
  }
}
