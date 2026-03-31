import { Lock, MessageSquare, Sparkles, Wrench, Zap } from "lucide-react";

export const STATUS_STEPS = [
  { value: "new", label: "New" },
  { value: "investigating", label: "Investigating" },
  { value: "vendor_engaged", label: "Vendor Engaged" },
  { value: "dispatch_scheduled", label: "Dispatch" },
  { value: "monitoring", label: "Monitoring" },
  { value: "resolved", label: "Resolved" },
] as const;

export type StatusStepValue = (typeof STATUS_STEPS)[number]["value"];

export const STATUS_ORDER: string[] = STATUS_STEPS.map((s) => s.value);

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

export const UPDATE_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; bg: string; text: string; border: string }
> = {
  system_event: {
    label: "System Event",
    icon: Zap,
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
  },
  internal_note: {
    label: "Internal Note",
    icon: Lock,
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  vendor_update: {
    label: "Vendor Update",
    icon: Wrench,
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  customer_update: {
    label: "Customer Update",
    icon: MessageSquare,
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
  ai_generated: {
    label: "AI Generated",
    icon: Sparkles,
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
  },
};

