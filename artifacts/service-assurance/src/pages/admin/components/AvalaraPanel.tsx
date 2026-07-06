import { useEffect, useState } from 'react';
import { BadgeDollarSign, Activity, CheckCircle2, Pencil, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  useAvalaraConfig,
  useAvalaraStatus,
  useAvalaraTest,
  useSaveAvalaraConfig,
} from '@/pages/admin/hooks/useAdminAvalara';

const MASKED = '••••••••';

export function AvalaraPanel() {
  const { toast } = useToast();
  const { data: status, isLoading: loadingStatus } = useAvalaraStatus();
  const { data: savedConfig, isLoading: loadingConfig } = useAvalaraConfig();
  const saveConfigMutation = useSaveAvalaraConfig();
  const testMutation = useAvalaraTest();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusAny: any = status;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const savedConfigAny: any = savedConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const testData: any = testMutation.data;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    accountId: '',
    licenseKey: '',
    baseUrl: '',
    companyCode: '',
  });

  useEffect(() => {
    if (savedConfigAny && showForm) {
      setForm({
        accountId: savedConfigAny.accountId || '',
        licenseKey: savedConfigAny.hasLicenseKey ? MASKED : '',
        baseUrl: savedConfigAny.baseUrl || 'https://sandbox-rest.avatax.com/api/v2',
        companyCode: savedConfigAny.companyCode || '',
      });
    }
  }, [savedConfigAny, showForm]);

  function handleSave() {
    const payload: Record<string, string> = {};
    if (form.accountId && form.accountId !== MASKED) payload.accountId = form.accountId;
    if (form.licenseKey && form.licenseKey !== MASKED) payload.licenseKey = form.licenseKey;
    if (form.baseUrl && form.baseUrl !== MASKED) payload.baseUrl = form.baseUrl;
    if (form.companyCode && form.companyCode !== MASKED) payload.companyCode = form.companyCode;

    if (Object.keys(payload).length === 0) {
      toast({ title: 'No changes to save.' });
      return;
    }

    saveConfigMutation.mutate(payload, {
      onSuccess: () => {
        toast({ title: 'Avalara credentials saved' });
        setShowForm(false);
      },
      onError: (err: any) =>
        toast({ title: 'Save failed', description: err.message, variant: 'destructive' }),
    });
  }

  function handleTest() {
    testMutation.mutate(undefined, {
      onSuccess: (data: any) => {
        toast({
          title: data.ok ? 'Connection successful' : 'Connection failed',
          description: data.message,
          variant: data.ok ? 'default' : 'destructive',
        });
      },
      onError: (err: any) =>
        toast({ title: 'Test failed', description: err.message, variant: 'destructive' }),
    });
  }

  const configured = statusAny?.configured ?? false;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BadgeDollarSign className="w-5 h-5 text-emerald-600" /> Avalara Integration
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              AvaTax invoice validation for invoice complaint investigations
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!showForm && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(true)}
                disabled={loadingConfig}
              >
                <Pencil className="w-4 h-4 mr-1.5" />
                {configured ? 'Edit Credentials' : 'Add Credentials'}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={testMutation.isPending || !configured}
            >
              {testMutation.isPending ? (
                <Activity className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
              )}
              Test Connection
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {showForm && (
          <div className="p-4 bg-muted/20 rounded-lg border border-border/60 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Avalara Credentials
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Account ID
                </label>
                <Input value={form.accountId} onChange={set('accountId')} placeholder="1234567890" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  License Key
                </label>
                <Input
                  value={form.licenseKey}
                  onChange={set('licenseKey')}
                  placeholder={savedConfigAny?.hasLicenseKey ? 'Leave blank to keep existing' : 'License key'}
                  onFocus={() => {
                    if (form.licenseKey === MASKED) setForm((f) => ({ ...f, licenseKey: '' }));
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Base URL
                </label>
                <Input
                  value={form.baseUrl}
                  onChange={set('baseUrl')}
                  placeholder="https://sandbox-rest.avatax.com/api/v2"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Default Company Code
                </label>
                <Input value={form.companyCode} onChange={set('companyCode')} placeholder="DEFAULT" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveConfigMutation.isPending}>
                {saveConfigMutation.isPending ? 'Saving...' : 'Save Credentials'}
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/30 rounded-md border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Credentials</p>
            <div className="flex items-center gap-1.5">
              {configured ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-green-700">Configured</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-700">Not set</span>
                </>
              )}
            </div>
          </div>
          <div className="p-3 bg-muted/30 rounded-md border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Validated</p>
            <p className="text-lg font-bold">{loadingStatus ? '—' : (statusAny?.validatedCount ?? 0)}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-md border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Failed</p>
            <p className="text-lg font-bold">{loadingStatus ? '—' : (statusAny?.failedCount ?? 0)}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-md border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Recent Validations</p>
            <p className="text-lg font-bold">{loadingStatus ? '—' : (statusAny?.recent?.length ?? 0)}</p>
          </div>
        </div>

        {testData && (
          <div
            className={`flex items-start gap-2 p-3 rounded-md text-xs border ${testData.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}
          >
            {testData.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{testData.message}</span>
          </div>
        )}

        {statusAny?.recent?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Recent Validations
            </p>
            <div className="space-y-1.5">
              {statusAny.recent.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2 bg-muted/20 rounded border border-border/40 text-xs"
                >
                  <span className="font-medium">{item.complaintNumber}</span>
                  <span className="text-muted-foreground truncate max-w-[220px]">{item.title}</span>
                  <span className="ml-auto text-muted-foreground">
                    {item.avalaraValidatedAt
                      ? new Date(item.avalaraValidatedAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
