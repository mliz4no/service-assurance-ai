import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw, Save, Grid3X3, Info } from "lucide-react";
import {
  useGetEscalationMatrix,
  useUpsertEscalationMatrix,
  getEscalationMatrixQueryKey,
} from "@workspace/api-client-react";
import type { MatrixScopeType, MatrixSeverityLevel, MatrixImpactLevel, MatrixUrgencyLevel, MatrixCell } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const IMPACTS: MatrixImpactLevel[] = ["high", "medium", "low"];
const URGENCIES: MatrixUrgencyLevel[] = ["high", "medium", "low"];
const SEVERITIES: MatrixSeverityLevel[] = ["critical", "high", "medium", "low"];

const DEFAULT_MATRIX: Record<MatrixImpactLevel, Record<MatrixUrgencyLevel, MatrixSeverityLevel>> = {
  high: { high: "critical", medium: "high", low: "medium" },
  medium: { high: "high", medium: "medium", low: "low" },
  low: { high: "medium", medium: "low", low: "low" },
};

const SEVERITY_COLORS: Record<MatrixSeverityLevel, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

const SEVERITY_TRIGGER_COLORS: Record<MatrixSeverityLevel, string> = {
  critical: "border-red-300 bg-red-50 text-red-900 hover:bg-red-100 focus:ring-red-200",
  high: "border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100 focus:ring-orange-200",
  medium: "border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100 focus:ring-yellow-200",
  low: "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 focus:ring-slate-200",
};

const LEVEL_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

type CellState = { severity: MatrixSeverityLevel; isOverride: boolean; overrideId: string | null };
type EditableMatrix = Record<MatrixImpactLevel, Record<MatrixUrgencyLevel, CellState>>;

function buildEditableMatrix(cells: MatrixCell[]): EditableMatrix {
  const m: EditableMatrix = {
    high: { high: { severity: "critical", isOverride: false, overrideId: null }, medium: { severity: "high", isOverride: false, overrideId: null }, low: { severity: "medium", isOverride: false, overrideId: null } },
    medium: { high: { severity: "high", isOverride: false, overrideId: null }, medium: { severity: "medium", isOverride: false, overrideId: null }, low: { severity: "low", isOverride: false, overrideId: null } },
    low: { high: { severity: "medium", isOverride: false, overrideId: null }, medium: { severity: "low", isOverride: false, overrideId: null }, low: { severity: "low", isOverride: false, overrideId: null } },
  };
  for (const cell of cells) {
    m[cell.impactLevel as MatrixImpactLevel][cell.urgencyLevel as MatrixUrgencyLevel] = {
      severity: cell.derivedSeverity as MatrixSeverityLevel,
      isOverride: cell.isOverride,
      overrideId: cell.overrideId,
    };
  }
  return m;
}

interface Props {
  scopeType: MatrixScopeType;
  scopeId?: string | null;
  scopeLabel: string;
  defaultExpanded?: boolean;
  readOnly?: boolean;
}

export function EscalationMatrixEditor({ scopeType, scopeId, scopeLabel, defaultExpanded = true, readOnly = false }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetEscalationMatrix(scopeType, scopeId);
  const upsertMutation = useUpsertEscalationMatrix();
  const [matrix, setMatrix] = useState<EditableMatrix | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [collapsed, setCollapsed] = useState(!defaultExpanded);

  useEffect(() => {
    if (data?.cells) {
      setMatrix(buildEditableMatrix(data.cells));
      setIsDirty(false);
    }
  }, [data]);

  const handleCellChange = (impact: MatrixImpactLevel, urgency: MatrixUrgencyLevel, severity: MatrixSeverityLevel) => {
    setMatrix((prev) => {
      if (!prev) return prev;
      const isOverride = severity !== DEFAULT_MATRIX[impact][urgency];
      return {
        ...prev,
        [impact]: {
          ...prev[impact],
          [urgency]: { severity, isOverride, overrideId: prev[impact][urgency].overrideId },
        },
      };
    });
    setIsDirty(true);
  };

  const handleResetCell = (impact: MatrixImpactLevel, urgency: MatrixUrgencyLevel) => {
    const defaultSev = DEFAULT_MATRIX[impact][urgency];
    handleCellChange(impact, urgency, defaultSev);
  };

  const handleResetAll = () => {
    setMatrix((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      for (const imp of IMPACTS) {
        next[imp] = { ...prev[imp] };
        for (const urg of URGENCIES) {
          next[imp][urg] = { severity: DEFAULT_MATRIX[imp][urg], isOverride: false, overrideId: prev[imp][urg].overrideId };
        }
      }
      return next;
    });
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!matrix) return;
    const cells: Array<{ impactLevel: MatrixImpactLevel; urgencyLevel: MatrixUrgencyLevel; derivedSeverity: MatrixSeverityLevel }> = [];
    for (const imp of IMPACTS) {
      for (const urg of URGENCIES) {
        cells.push({ impactLevel: imp, urgencyLevel: urg, derivedSeverity: matrix[imp][urg].severity });
      }
    }
    upsertMutation.mutate(
      { scopeType, scopeId: scopeId ?? null, cells },
      {
        onSuccess: () => {
          toast({ title: `${scopeLabel} matrix saved` });
          queryClient.invalidateQueries({ queryKey: getEscalationMatrixQueryKey(scopeType, scopeId) });
          setIsDirty(false);
        },
        onError: (err: any) => {
          toast({ title: "Failed to save matrix", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const overrideCount = matrix
    ? IMPACTS.reduce((acc, imp) => acc + URGENCIES.filter((urg) => matrix[imp][urg].isOverride).length, 0)
    : 0;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 pt-4 px-5 border-b border-border/50">
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-left"
            onClick={() => setCollapsed((c) => !c)}
          >
            <Grid3X3 className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <CardTitle className="text-sm font-semibold">{scopeLabel}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {overrideCount > 0
                  ? `${overrideCount} cell${overrideCount !== 1 ? "s" : ""} overriding the default ITIL matrix`
                  : "Using default ITIL severity matrix"}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {overrideCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {overrideCount} override{overrideCount !== 1 ? "s" : ""}
              </Badge>
            )}
            {!readOnly && !collapsed && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={handleResetAll}
                  disabled={upsertMutation.isPending}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset all
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSave}
                  disabled={!isDirty || upsertMutation.isPending}
                >
                  <Save className="w-3 h-3 mr-1" />
                  {upsertMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="px-5 pt-4 pb-5">
          {isLoading || !matrix ? (
            <p className="text-xs text-muted-foreground">Loading matrix…</p>
          ) : (
            <>
              <div className="mb-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Rows = Impact level · Columns = Urgency level · Each cell defines the resulting severity.
                  {scopeType !== "global"
                    ? " Non-default cells are stored as overrides for this scope only."
                    : " These become the global baseline."}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left pb-2 pr-3 text-xs font-medium text-muted-foreground w-28">
                        Impact ↓ / Urgency →
                      </th>
                      {URGENCIES.map((urg) => (
                        <th key={urg} className="pb-2 px-2 text-center text-xs font-semibold text-foreground">
                          {LEVEL_LABELS[urg]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {IMPACTS.map((imp) => (
                      <tr key={imp} className="border-t border-border/30">
                        <td className="py-2 pr-3 text-xs font-semibold text-foreground">{LEVEL_LABELS[imp]}</td>
                        {URGENCIES.map((urg) => {
                          const cell = matrix[imp][urg];
                          const isModified = cell.severity !== DEFAULT_MATRIX[imp][urg];

                          return (
                            <td key={urg} className="py-2 px-2">
                              <div className="flex items-center gap-1">
                                {readOnly ? (
                                  <span className={cn(
                                    "inline-flex items-center px-2 py-1 rounded text-xs font-semibold border capitalize",
                                    SEVERITY_COLORS[cell.severity]
                                  )}>
                                    {cell.severity}
                                  </span>
                                ) : (
                                  <Select
                                    value={cell.severity}
                                    onValueChange={(v) => handleCellChange(imp, urg, v as MatrixSeverityLevel)}
                                  >
                                    <SelectTrigger
                                      className={cn(
                                        "h-8 text-xs w-28 font-medium border capitalize",
                                        SEVERITY_TRIGGER_COLORS[cell.severity],
                                        isModified && "ring-2 ring-offset-1 ring-primary/40"
                                      )}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SEVERITIES.map((s) => (
                                        <SelectItem key={s} value={s} className="text-xs capitalize">
                                          <span className={cn("inline-block px-1.5 py-0.5 rounded text-xs font-medium capitalize mr-1", SEVERITY_COLORS[s])}>
                                            {s}
                                          </span>
                                          {s === DEFAULT_MATRIX[imp][urg] && (
                                            <span className="text-muted-foreground text-xs">(default)</span>
                                          )}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                {!readOnly && isModified && (
                                  <button
                                    title="Reset to default"
                                    onClick={() => handleResetCell(imp, urg)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              {isModified && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  default: {DEFAULT_MATRIX[imp][urg]}
                                </p>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isDirty && !readOnly && (
                <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Unsaved changes — click Save to apply.
                </p>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
