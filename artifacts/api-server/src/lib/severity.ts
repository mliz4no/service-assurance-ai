export type ImpactLevel = "low" | "medium" | "high";
export type UrgencyLevel = "low" | "medium" | "high";
export type SeverityLevel = "low" | "medium" | "high" | "critical";

const SEVERITY_MATRIX: Record<ImpactLevel, Record<UrgencyLevel, SeverityLevel>> = {
  high: {
    high: "critical",
    medium: "high",
    low: "medium",
  },
  medium: {
    high: "high",
    medium: "medium",
    low: "low",
  },
  low: {
    high: "medium",
    medium: "low",
    low: "low",
  },
};

export function calculateSeverity(impact: ImpactLevel, urgency: UrgencyLevel): SeverityLevel {
  return SEVERITY_MATRIX[impact][urgency];
}

const SEVERITY_ORDER: SeverityLevel[] = ["low", "medium", "high", "critical"];

export function severityMeetsThreshold(ticketSeverity: SeverityLevel, threshold: SeverityLevel): boolean {
  return SEVERITY_ORDER.indexOf(ticketSeverity) >= SEVERITY_ORDER.indexOf(threshold);
}
