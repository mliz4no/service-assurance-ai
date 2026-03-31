import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: "bg-slate-100 text-slate-800 border-slate-200",
    investigating: "bg-blue-100 text-blue-800 border-blue-200",
    vendor_engaged: "bg-purple-100 text-purple-800 border-purple-200",
    dispatch_scheduled: "bg-orange-100 text-orange-800 border-orange-200",
    monitoring: "bg-yellow-100 text-yellow-800 border-yellow-200",
    resolved: "bg-green-100 text-green-800 border-green-200",
    closed: "bg-gray-100 text-gray-800 border-gray-200",
    active: "bg-green-100 text-green-800 border-green-200",
    inactive: "bg-slate-100 text-slate-800 border-slate-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    down: "bg-red-100 text-red-800 border-red-200",
    impaired: "bg-orange-100 text-orange-800 border-orange-200",
    disconnected: "bg-gray-100 text-gray-800 border-gray-200",
  };

  const defaultColor = "bg-slate-100 text-slate-800 border-slate-200";
  const colorClass = colors[status] || defaultColor;

  return (
    <Badge variant="outline" className={`${colorClass} font-medium capitalize shadow-none rounded-md`}>
      {status.replace("_", " ")}
    </Badge>
  );
}
