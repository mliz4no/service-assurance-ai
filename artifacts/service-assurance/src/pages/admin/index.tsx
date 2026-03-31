import { AppLayout } from "@/components/layout/app-layout";
import { useGetSlaPolicies, useGetUsers, useGetConfigHealth, useAiTest } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Activity, Server, ShieldCheck, Database, BrainCircuit, Play } from "lucide-react";
import { SeverityBadge } from "@/components/severity-badge";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminPanel() {
  const { data: policies, isLoading: loadingPolicies } = useGetSlaPolicies();
  const { data: users, isLoading: loadingUsers } = useGetUsers();
  const { data: health, isLoading: loadingHealth } = useGetConfigHealth();

  const [aiTestInput, setAiTestInput] = useState("");
  const testAiMutation = useAiTest();

  const handleTestAi = () => {
    if (!aiTestInput) return;
    testAiMutation.mutate({ data: { text: aiTestInput } });
  };

  const HealthIndicator = ({ status, label }: { status?: boolean; label: string }) => (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border/50">
      <span className="font-medium text-sm">{label}</span>
      {status === undefined ? (
        <Activity className="w-5 h-5 text-muted-foreground animate-spin" />
      ) : status ? (
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500" />
      )}
    </div>
  );

  return (
    <AppLayout title="System Administration">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 md:col-span-3 border-border/50 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Server className="w-5 h-5 text-muted-foreground" /> System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <HealthIndicator label="Database Connection" status={health?.database} />
              <HealthIndicator label="OpenAI API" status={health?.openAi} />
              <HealthIndicator label="Session Secret Configured" status={health?.sessionSecret} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SLA Policies */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-muted-foreground" /> SLA Policies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Severity</TableHead>
                    <TableHead>Initial Response</TableHead>
                    <TableHead>Escalation</TableHead>
                    <TableHead>Resolution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPolicies ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-4"><Activity className="w-5 h-5 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
                  ) : policies?.map(p => (
                    <TableRow key={p.id}>
                      <TableCell><SeverityBadge severity={p.severity} /></TableCell>
                      <TableCell>{p.initialResponseMinutes}m</TableCell>
                      <TableCell>{p.escalationMinutes}m</TableCell>
                      <TableCell>{p.resolutionTargetMinutes}m</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* AI Testing */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-muted-foreground" /> AI Classification Test
              </CardTitle>
              <CardDescription>Test the AI normalized status classifier</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Paste an update from a vendor (e.g. 'We dispatched a tech')" 
                  value={aiTestInput}
                  onChange={(e) => setAiTestInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTestAi()}
                />
                <Button onClick={handleTestAi} disabled={testAiMutation.isPending || !aiTestInput}>
                  <Play className="w-4 h-4 mr-2" /> Classify
                </Button>
              </div>
              
              {testAiMutation.data && (
                <div className="p-4 bg-muted/30 rounded-md border border-border/50">
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Resulting Normalized Status:</p>
                  <p className="font-medium text-primary">{testAiMutation.data.normalizedStatus}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </AppLayout>
  );
}
