import { Activity, Lock, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UPDATE_TYPE_CONFIG, timeAgo } from "./ticket-utils";
import type { TicketUpdate } from "@workspace/api-client-react";

interface Props {
  description: string | null | undefined;
  updates: TicketUpdate[] | undefined;
  isLoadingUpdates: boolean;
  isCustomer: boolean;
  updateText: string;
  setUpdateText: (text: string) => void;
  updateType: "internal_note" | "vendor_update" | "customer_update";
  setUpdateType: (type: "internal_note" | "vendor_update" | "customer_update") => void;
  updateVisibility: "internal" | "customer";
  setUpdateVisibility: (vis: "internal" | "customer") => void;
  onAddUpdate: () => void;
  isPostingUpdate: boolean;
}

export function UpdateTimeline({
  description,
  updates,
  isLoadingUpdates,
  isCustomer,
  updateText,
  setUpdateText,
  updateType,
  setUpdateType,
  updateVisibility,
  setUpdateVisibility,
  onAddUpdate,
  isPostingUpdate,
}: Props) {
  return (
    <div className="lg:col-span-2 space-y-5">

      {/* Description */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Description
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {description || (
              <span className="italic text-muted-foreground">No description provided.</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Activity Timeline
          </CardTitle>
          {updates && (
            <span className="text-xs text-muted-foreground">
              {updates.length} {updates.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {isLoadingUpdates ? (
            <div className="flex justify-center py-10">
              <Activity className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !updates?.length ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No activity yet.
            </p>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

              <div className="space-y-4">
                {[...updates]
                  .sort(
                    (a, b) =>
                      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                  )
                  .map((update) => {
                    const cfg =
                      UPDATE_TYPE_CONFIG[update.updateType] ||
                      UPDATE_TYPE_CONFIG.system_event;
                    const Icon = cfg.icon;
                    const isInternal =
                      update.visibility === "internal" &&
                      update.updateType !== "system_event";

                    return (
                      <div key={update.id} className="flex gap-4 relative">
                        {/* Icon dot */}
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 z-10",
                            cfg.bg,
                            cfg.border,
                            "border-white ring-2 ring-white"
                          )}
                        >
                          <Icon className={cn("w-3.5 h-3.5", cfg.text)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 pb-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0",
                                cfg.bg,
                                cfg.text,
                                cfg.border
                              )}
                            >
                              {cfg.label}
                            </Badge>
                            {isInternal && !isCustomer && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-slate-50 text-slate-600 border-slate-200 px-1.5 py-0"
                              >
                                <Lock className="w-2.5 h-2.5 mr-0.5" /> Internal
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {timeAgo(update.createdAt)} ·{" "}
                              {update.createdBy?.name || "System"}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "text-sm rounded-md border p-3 leading-relaxed whitespace-pre-wrap",
                              update.updateType === "system_event"
                                ? "bg-slate-50 border-slate-100 text-slate-500 italic text-xs"
                                : "bg-white border-border/60 text-foreground"
                            )}
                          >
                            {update.rawText}
                          </div>
                          {update.normalizedStatus && !isCustomer && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-indigo-600">
                              <Sparkles className="w-3 h-3" />
                              Normalized: {update.normalizedStatus}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post Update Form */}
      {!isCustomer && (
        <Card id="update-form" className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Post Update
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="flex flex-wrap gap-3">
              <Select
                value={updateType}
                onValueChange={(v) => {
                  const t = v as "internal_note" | "vendor_update" | "customer_update";
                  setUpdateType(t);
                  setUpdateVisibility(t === "customer_update" ? "customer" : "internal");
                }}
              >
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal_note">Internal Note</SelectItem>
                  <SelectItem value="vendor_update">Vendor Update</SelectItem>
                  <SelectItem value="customer_update">Customer Update</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={updateVisibility}
                onValueChange={(v) => setUpdateVisibility(v as "internal" | "customer")}
              >
                <SelectTrigger className="w-[175px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal Only</SelectItem>
                  <SelectItem value="customer">Visible to Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Textarea
              placeholder="Type your update..."
              className="min-h-[120px] text-sm resize-none"
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
            />

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {updateVisibility === "customer"
                  ? "This update will be visible to the customer."
                  : "This update is internal only."}
              </p>
              <Button
                onClick={onAddUpdate}
                disabled={isPostingUpdate || !updateText.trim()}
                size="sm"
              >
                {isPostingUpdate ? "Posting..." : "Post Update"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
