import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Activity, CheckCircle2, Cloud, Pencil, RefreshCw, XCircle } from 'lucide-react';
import {
  useSalesforceConfig,
  useSalesforceStatus,
  useSalesforceSync,
  useSalesforceTest,
  useSaveConfig,
} from '@/pages/admin/hooks/useAdminSalesforce';

const MASKED = '••••••••';

export function SalesforcePanel() {
  const { toast } = useToast();
  const { data: status, isLoading: loadingStatus } = useSalesforceStatus();
  const { data: savedConfig, isLoading: loadingConfig } = useSalesforceConfig();
  const saveConfigMutation = useSaveConfig();
  const testMutation = useSalesforceTest();
  const syncMutation = useSalesforceSync('full');

  // Cast external API responses to `any` for UI consumption (generated types are loose)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusAny: any = status;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const savedConfigAny: any = savedConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const testData: any = testMutation.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncData: any = syncMutation.data;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    clientId: '',
    clientSecret: '',
    loginUrl: '',
    instanceUrl: '',
    username: '',
    password: '',
    securityToken: '',
  });

  useEffect(() => {
    if (savedConfigAny && showForm) {
      setForm({
        clientId: savedConfigAny.clientId || '',
        clientSecret: savedConfigAny.hasClientSecret ? MASKED : '',
        loginUrl: savedConfigAny.loginUrl || '',
        instanceUrl: savedConfigAny.instanceUrl || '',
        username: savedConfigAny.username || '',
        password: savedConfigAny.hasPassword ? MASKED : '',
        securityToken: '',
      });
    }
  }, [savedConfig, showForm]);

  function handleSave() {
    const payload: Record<string, string> = {};
    if (form.clientId && form.clientId !== MASKED) payload.clientId = form.clientId;
    if (form.clientSecret && form.clientSecret !== MASKED) payload.clientSecret = form.clientSecret;
    if (form.loginUrl && form.loginUrl !== MASKED) payload.loginUrl = form.loginUrl;
    if (form.instanceUrl && form.instanceUrl !== MASKED) payload.instanceUrl = form.instanceUrl;
    if (form.username && form.username !== MASKED) payload.username = form.username;
    if (form.password && form.password !== MASKED) {
      payload.password =
        form.password + (form.securityToken.trim() ? form.securityToken.trim() : '');
    }

    if (Object.keys(payload).length === 0) {
      toast({ title: 'No changes to save.' });
      return;
    }

    saveConfigMutation.mutate(payload, {
      onSuccess: () => {
        toast({ title: 'Credentials saved' });
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

  function handleSync() {
    syncMutation.mutate(undefined, {
      onSuccess: (data: any) => {
        const accSynced = data?.accounts?.synced ?? 0;
        const conSynced = data?.contacts?.synced ?? 0;
        toast({
          title: 'Sync complete',
          description: `${accSynced} accounts, ${conSynced} contacts synced.`,
        });
      },
      onError: (err: any) =>
        toast({ title: 'Sync failed', description: err.message, variant: 'destructive' }),
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
              <Cloud className="w-5 h-5 text-[#00A1E0]" /> Salesforce Integration
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Read-only sync — pulls Accounts and Contacts into internal customer records
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
            <Button size="sm" onClick={handleSync} disabled={syncMutation.isPending || !configured}>
              {syncMutation.isPending ? (
                <Activity className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1.5" />
              )}
              Sync Now
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {showForm && (
          <div className="p-4 bg-muted/20 rounded-lg border border-border/60 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Salesforce Credentials
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Login URL{' '}
                  <span className="font-normal text-muted-foreground">
                    (for OAuth — not your org URL)
                  </span>
                </label>
                <Input
                  value={form.loginUrl}
                  onChange={set('loginUrl')}
                  placeholder="https://login.salesforce.com"
                  onFocus={() => {
                    if (form.loginUrl === MASKED) setForm((f) => ({ ...f, loginUrl: '' }));
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Production: <code className="font-mono">https://login.salesforce.com</code> ·
                  Sandbox: <code className="font-mono">https://test.salesforce.com</code>
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Instance URL
                </label>
                <Input
                  value={form.instanceUrl}
                  onChange={set('instanceUrl')}
                  placeholder="https://yourorg.my.salesforce.com"
                  onFocus={() => {
                    if (form.instanceUrl === MASKED) setForm((f) => ({ ...f, instanceUrl: '' }));
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your org's My Domain URL — used for API calls after login.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Username
                </label>
                <Input
                  value={form.username}
                  onChange={set('username')}
                  placeholder="user@yourorg.com"
                  onFocus={() => {
                    if (form.username === MASKED) setForm((f) => ({ ...f, username: '' }));
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Consumer Key (Client ID)
                </label>
                <Input
                  value={form.clientId}
                  onChange={set('clientId')}
                  placeholder="3MVG9..."
                  onFocus={() => {
                    if (form.clientId === MASKED) setForm((f) => ({ ...f, clientId: '' }));
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Consumer Secret
                </label>
                <textarea
                  value={form.clientSecret}
                  onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
                  onFocus={() => {
                    if (form.clientSecret === MASKED) setForm((f) => ({ ...f, clientSecret: '' }));
                  }}
                  placeholder={
                    savedConfigAny?.hasClientSecret
                      ? 'Leave blank to keep existing'
                      : 'Consumer Secret'
                  }
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground placeholder:font-sans"
                  autoComplete="off"
                  spellCheck={false}
                />
                {form.clientSecret && form.clientSecret !== MASKED && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {form.clientSecret.length} characters
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Password
                </label>
                <textarea
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  onFocus={() => {
                    if (form.password === MASKED) setForm((f) => ({ ...f, password: '' }));
                  }}
                  placeholder={
                    savedConfigAny?.hasPassword
                      ? 'Leave blank to keep existing'
                      : 'Salesforce password'
                  }
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground placeholder:font-sans"
                  autoComplete="off"
                  spellCheck={false}
                />
                {form.password && form.password !== MASKED && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {form.password.length} characters
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Security Token{' '}
                  <span className="font-normal">
                    (optional — required if your org uses IP restrictions)
                  </span>
                </label>
                <Input
                  value={form.securityToken}
                  onChange={set('securityToken')}
                  placeholder="aBcDeFgH1234..."
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The token will be appended directly to your password before saving. Find it in
                  Salesforce → Settings → My Personal Information → Reset My Security Token.
                </p>
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

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted/30 rounded-md border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Credentials</p>
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
            <p className="text-xs font-semibold text-muted-foreground mb-1">Accounts synced</p>
            <p className="text-lg font-bold">
              {loadingStatus ? '—' : (statusAny?.accountsSynced ?? 0)}
            </p>
          </div>
          <div className="p-3 bg-muted/30 rounded-md border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Contacts synced</p>
            <p className="text-lg font-bold">
            {loadingStatus ? '—' : (statusAny?.contactsSynced ?? 0)}
            </p>
          </div>
          <div className="p-3 bg-muted/30 rounded-md border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Last sync</p>
            <p className="text-sm font-medium">
              {loadingStatus
                ? '—'
                  : statusAny?.lastSyncAt
                    ? new Date(statusAny.lastSyncAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Never'}
            </p>
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

        {syncData && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md text-xs text-green-800">
            Sync complete — {syncData.accounts?.synced ?? 0} accounts,{' '}
            {syncData.contacts?.synced ?? 0} contacts processed.
            {(syncData.accounts?.errors?.length > 0 ||
              syncData.contacts?.errors?.length > 0) && (
              <span className="text-amber-700"> Some rows had errors — check sync log below.</span>
            )}
          </div>
        )}

        {statusAny?.recentLogs?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Recent Sync Log
            </p>
            <div className="space-y-1.5">
              {statusAny.recentLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 px-3 py-2 bg-muted/20 rounded border border-border/40 text-xs"
                >
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded font-semibold capitalize ${
                      log.status === 'success'
                        ? 'bg-green-100 text-green-700'
                        : log.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {log.status}
                  </span>
                  <span className="text-muted-foreground capitalize">{log.syncType}</span>
                  <span className="font-medium">{log.recordsProcessed ?? 0} records</span>
                  <span className="text-muted-foreground ml-auto">
                    {new Date(log.startedAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {log.message && (
                    <span
                      className="text-muted-foreground truncate max-w-[200px]"
                      title={log.message}
                    >
                      {log.message}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
