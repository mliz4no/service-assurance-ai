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
import { AlertCircle, ChevronDown, ChevronUp, HelpCircle, MapPin, Save } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';
type UrgencyLevel = 'high' | 'medium' | 'low';

const IMPACT_OPTIONS: { value: ImpactLevel; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const URGENCY_OPTIONS: { value: UrgencyLevel; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const IMPACT_COLORS: Record<ImpactLevel, string> = {
  critical: 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100',
  high: 'border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100',
  medium: 'border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100',
  low: 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100',
};

const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  high: 'border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100',
  medium: 'border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100',
  low: 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100',
};

const BADGE_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
};

const SEVERITY_DEFINITIONS = [
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

const URGENCY_DEFINITIONS = [
  {
    label: 'High',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    text: 'Immediate action is required because the issue is causing or is likely to cause serious business disruption.',
  },
  {
    label: 'Medium',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    text: 'Action is needed soon, but the issue is not yet causing severe business disruption.',
  },
  {
    label: 'Low',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    text: 'Action is needed, but the issue can be handled through normal operational workflow.',
  },
];

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

async function saveSiteClassification(
  siteId: string,
  impactLevel: ImpactLevel | null,
  urgencyLevel: UrgencyLevel | null,
): Promise<void> {
  const token = localStorage.getItem('sa_auth_token');
  const res = await fetch(`/api/sites/${siteId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      impactLevel: impactLevel ?? '',
      urgencyLevel: urgencyLevel ?? '',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? 'Failed to save');
  }
}

interface Props {
  siteId: string;
  currentImpact: ImpactLevel | null | undefined;
  currentUrgency: UrgencyLevel | null | undefined;
  defaultExpanded?: boolean;
}

export function LocationImpactSelector({
  siteId,
  currentImpact,
  currentUrgency,
  defaultExpanded = false,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(!defaultExpanded);
  const [impact, setImpact] = useState<ImpactLevel>(currentImpact ?? 'high');
  const [urgency, setUrgency] = useState<UrgencyLevel>(currentUrgency ?? 'medium');
  const [isSaving, setIsSaving] = useState(false);

  const savedImpact = currentImpact ?? 'high';
  const savedUrgency = currentUrgency ?? 'medium';
  const isDirty = impact !== savedImpact || urgency !== savedUrgency;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSiteClassification(siteId, impact, urgency);
      queryClient.invalidateQueries({ queryKey: [`/api/sites/${siteId}`] });
      toast({ title: 'Location classification saved' });
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const hasClassification = !!(currentImpact || currentUrgency);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 pt-4 px-5 border-b border-border/50">
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-left"
            onClick={() => setCollapsed((c) => !c)}
          >
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <CardTitle className="text-sm font-semibold">
                Location Severity Classification
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasClassification
                  ? `Impact: ${(currentImpact ?? '—').charAt(0).toUpperCase() + (currentImpact ?? '—').slice(1)} · Urgency: ${(currentUrgency ?? '—').charAt(0).toUpperCase() + (currentUrgency ?? '—').slice(1)}`
                  : 'No classification set — using defaults'}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {currentImpact && (
              <Badge
                variant="outline"
                className={cn('text-xs capitalize border', BADGE_COLORS[currentImpact])}
              >
                {currentImpact}
              </Badge>
            )}
            {currentUrgency && (
              <Badge
                variant="outline"
                className={cn('text-xs capitalize border', BADGE_COLORS[currentUrgency])}
              >
                {currentUrgency}
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
              Classify the typical Impact and Urgency profile for this location. These values inform
              how incidents affecting this site are prioritised during escalation.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Impact */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                Impact
                <HelpTip>
                  The business effect of the incident on the customer, site, or service.
                </HelpTip>
              </label>
              <Select value={impact} onValueChange={(v) => setImpact(v as ImpactLevel)}>
                <SelectTrigger
                  className={cn(
                    'w-full text-sm font-medium border capitalize',
                    IMPACT_COLORS[impact],
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPACT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm capitalize">
                      <span
                        className={cn(
                          'inline-block px-1.5 py-0.5 rounded text-xs font-medium capitalize mr-1 border',
                          BADGE_COLORS[opt.value],
                        )}
                      >
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Urgency */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                Urgency
                <HelpTip>
                  How quickly action is required based on business need, outage duration, available
                  failover, and operational context.
                </HelpTip>
              </label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as UrgencyLevel)}>
                <SelectTrigger
                  className={cn(
                    'w-full text-sm font-medium border capitalize',
                    URGENCY_COLORS[urgency],
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {URGENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm capitalize">
                      <span
                        className={cn(
                          'inline-block px-1.5 py-0.5 rounded text-xs font-medium capitalize mr-1 border',
                          BADGE_COLORS[opt.value],
                        )}
                      >
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {/* Definitions panel — two columns */}
          <div className="border-t border-border/50 pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                Severity Definitions
              </p>
              <div className="space-y-1.5">
                {SEVERITY_DEFINITIONS.map((def) => (
                  <div key={def.level} className="flex items-start gap-2">
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-xs font-semibold border w-14 justify-center',
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
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                Urgency Definitions
              </p>
              <div className="space-y-1.5">
                {URGENCY_DEFINITIONS.map((def) => (
                  <div key={def.label} className="flex items-start gap-2">
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-xs font-semibold border w-14 justify-center',
                        def.color,
                      )}
                    >
                      {def.label}
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{def.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
