import { useState } from 'react';
import {
  getPreviewDeviceEventPurgeQueryKey,
  usePreviewDeviceEventPurge,
  useRunDeviceEventPurge,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ArchiveX, Loader2, Play, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CATEGORY_LABELS = {
  default: 'Default events',
  incident_evidence: 'Incident evidence',
  audit: 'Audit events',
  legal: 'Legal records',
} as const;

export function EventRetentionPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const preview = usePreviewDeviceEventPurge();
  const runPurge = useRunDeviceEventPurge();
  const data = preview.data;
  const isAdmin = user?.role === 'admin';

  function execute(dryRun: boolean) {
    runPurge.mutate(
      { data: { dryRun } },
      {
        onSuccess: (result) => {
          toast({
            title: dryRun ? 'Purge preview complete' : 'Event purge complete',
            description: `${result.deletedTotal} event${result.deletedTotal === 1 ? '' : 's'} ${dryRun ? 'eligible' : 'deleted'}.`,
          });
          setConfirmOpen(false);
          queryClient.invalidateQueries({ queryKey: getPreviewDeviceEventPurgeQueryKey() });
        },
        onError: (error) => {
          toast({
            title: dryRun ? 'Preview failed' : 'Purge failed',
            description: error instanceof Error ? error.message : 'The retention operation failed.',
            variant: 'destructive',
          });
        },
      },
    );
  }

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ArchiveX className="w-5 h-5 text-muted-foreground" /> Event Retention
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Daily Event Monitor cleanup with legal and compliance hold protection
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => execute(true)}
                disabled={runPurge.isPending}
              >
                {runPurge.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-1.5" />
                )}
                Dry Run
              </Button>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                  disabled={runPurge.isPending || !data?.enabled}
                >
                  <ArchiveX className="w-4 h-4 mr-1.5" /> Run Purge
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="p-3 bg-muted/30 rounded-md border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Scheduler</p>
              <p className="text-sm font-semibold">{data?.enabled ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div className="p-3 bg-muted/30 rounded-md border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Events in scope</p>
              <p className="text-lg font-bold">{preview.isLoading ? '-' : (data?.totalInScope ?? 0)}</p>
            </div>
            <div className="p-3 bg-muted/30 rounded-md border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Eligible now</p>
              <p className="text-lg font-bold">{preview.isLoading ? '-' : (data?.totalEligible ?? 0)}</p>
            </div>
            <div className="p-3 bg-muted/30 rounded-md border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Protected holds</p>
              <p className="text-lg font-bold">{preview.isLoading ? '-' : (data?.heldCount.totalHolds ?? 0)}</p>
            </div>
          </div>

          {data && (
            <div className="overflow-x-auto rounded-md border border-border/50">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Retention</th>
                    <th className="px-3 py-2 font-medium">Eligible</th>
                    <th className="px-3 py-2 font-medium">Cutoff</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((category) => (
                    <tr key={category} className="border-t border-border/50">
                      <td className="px-3 py-2 font-medium">{CATEGORY_LABELS[category]}</td>
                      <td className="px-3 py-2">{data.retentionHours[category]} hours</td>
                      <td className="px-3 py-2">{data.eligibleCountPerCategory[category]}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {data.cutoffPerCategory[category]
                          ? new Date(data.cutoffPerCategory[category]).toLocaleString()
                          : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!data?.enabled && !preview.isLoading && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
              Automated deletion is disabled. Dry runs remain available for retention review.
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete eligible device events?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {data?.totalEligible ?? 0} currently eligible events. Legal
              and compliance holds remain protected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => execute(false)}>Delete eligible events</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}