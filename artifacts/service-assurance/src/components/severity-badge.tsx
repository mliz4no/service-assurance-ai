import { Badge } from "@/components/ui/badge";

export function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-800 border-red-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-slate-100 text-slate-800 border-slate-200",
  };

  const defaultColor = "bg-slate-100 text-slate-800 border-slate-200";
  const colorClass = colors[severity] || defaultColor;

  return (
    <Badge variant="outline" className={`${colorClass} font-medium capitalize shadow-none rounded-md`}>
      {severity}
    </Badge>
  );
}
