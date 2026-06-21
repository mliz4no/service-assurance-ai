import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ChevronDown, ChevronUp, HelpCircle, Save, Zap } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { getGetServiceQueryKey } from '@workspace/api-client-react';

type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';

const IMPACT_OPTIONS: { value: ImpactLevel; label: string; description: string }[] = [
  {
    value: 'critical',
    label: 'Critical',
    description: 'Core business circuit — any outage causes major disruption.',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Important circuit — outage significantly impacts operations.',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Useful circuit — outage causes noticeable but manageable impact.',
  },
  {
    value: 'low',
    label: 'Low',
    description: 'Non-critical circuit — outage has limited business effect.',
  },
];

const IMPACT_COLORS: Record<ImpactLevel, string> = {
  critical: 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100',
  high: 'border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100',
  medium: 'border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100',
  low: 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100',
};

const IMPACT_BADGE_COLORS: Record<ImpactLevel, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
};

const SEVERITY_DEFINITIONS: { level: string; color: string; text: string }[] = [
  {
    level: 'Critical',
    color: 'bg-red-100 text-red-800 border-red-200',
    text: 'Major business outage or severe service disruption requiring immediate attention.',
  },
  {
    level: 'High',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    text: 'Significant impact to business operations requiring urgent response.',
  },
  {
    level: 'Medium',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    text: 'Noticeable service impact that should be addressed promptly but is not a major outage.',
  },
  {
    level: 'Low',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    text: 'Limited business impact or minor issue that can be handled in normal workflow.',
  },
];

interface Props {
  serviceId: string;
  currentImpact: ImpactLevel | null | undefined;
  defaultExpanded?: boolean;
}

async function saveImpactLevel(serviceId: string, impactLevel: ImpactLevel | null): Promise<void> {
  const token = localStorage.getItem('sa_auth_token');
  const res = await fetch(`/api/services/${serviceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ impactLevel: impactLevel ?? '' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? 'Failed to save');
  }
}

function HelpTip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help inline-block ml-1 align-middle" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] text-center leading-snug">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CircuitImpactSelector({
  serviceId,
  currentImpact,
  defaultExpanded = false,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(!defaultExpanded);
  const [selected, setSelected] = useState<ImpactLevel | 'none'>(currentImpact ?? 'high');
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = selected !== (currentImpact ?? 'high');
  const effectiveImpact = selected !== 'none' ? selected : null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveImpactLevel(serviceId, effectiveImpact);
      queryClient.invalidateQueries({ queryKey: getGetServiceQueryKey(serviceId) });
      toast({ title: 'Circuit impact saved' });
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 pt-4 px-5 border-b border-border/50">
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-left"
            onClick={() => setCollapsed((c) => !c)}
          >
            <Zap className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <CardTitle className="text-sm font-semibold">Circuit Business Impact</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentImpact
                  ? `Classified as ${currentImpact.charAt(0).toUpperCase() + currentImpact.slice(1)} importance`
                  : 'No impact classification set'}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {currentImpact && (
              <Badge
                variant="outline"
                className={cn('text-xs capitalize border', IMPACT_BADGE_COLORS[currentImpact])}
              >
                {currentImpact}
              </Badge>
            )}
            {collapsed ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="px-5 pt-5 pb-5 space-y-5">
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Set the business importance of this circuit. This classification informs how incidents
              affecting it are prioritised during escalation.
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center">
              Impact
              <HelpTip>
                The business effect of an incident on the customer, site, or service.
              </HelpTip>
            </label>
            <Select value={selected} onValueChange={(v) => setSelected(v as ImpactLevel | 'none')}>
              <SelectTrigger
                className={cn(
                  'w-48 text-sm font-medium border capitalize',
                  selected !== 'none' ? IMPACT_COLORS[selected as ImpactLevel] : 'border-border',
                )}
              >
                <SelectValue placeholder="Select impact…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-sm text-muted-foreground">
                  — Not classified —
                </SelectItem>
                {IMPACT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">
                    <span
                      className={cn(
                        'inline-block px-1.5 py-0.5 rounded text-xs font-medium capitalize mr-2 border',
                        IMPACT_BADGE_COLORS[opt.value],
                      )}
                    >
                      {opt.label}
                    </span>
                    <span className="text-muted-foreground text-xs">{opt.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
            >
              <Save className="w-3 h-3 mr-1.5" />
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>

          <div className="border-t border-border/50 pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Severity Level Definitions
            </p>
            <div className="space-y-2">
              {SEVERITY_DEFINITIONS.map((def) => (
                <div key={def.level} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center px-2 py-0.5 rounded text-xs font-semibold border w-16 justify-center',
                      def.color,
                    )}
                  >
                    {def.level}
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{def.text}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
