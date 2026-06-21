import { useParams, useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { useGetService, getGetServiceQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Globe2, Building2, MapPin, DollarSign, Phone, Ticket } from 'lucide-react';
import { Link } from 'wouter';
import { StatusBadge } from '@/components/status-badge';
import { SeverityBadge } from '@/components/severity-badge';
import { CircuitImpactSelector } from '@/components/CircuitImpactSelector';

export default function ServiceDetail() {
  const params = useParams();
  const id = (params as any).id as string;

  const { data: service, isLoading } = useGetService(id, {
    query: { queryKey: getGetServiceQueryKey(id), enabled: !!id },
  });

  if (isLoading)
    return (
      <AppLayout title="Loading Service...">
        <div className="flex justify-center py-12">
          <Activity className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  if (!service)
    return (
      <AppLayout title="Service Not Found">
        <div className="text-center py-12 text-muted-foreground">Service not found.</div>
      </AppLayout>
    );

  return (
    <AppLayout title={`Service: ${service.circuitId || service.vendorName}`}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600">
            <Globe2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {service.serviceType} - {service.vendorName}
              <StatusBadge status={service.status} />
            </h1>
            <p className="text-muted-foreground font-mono mt-1">
              Circuit ID: {service.circuitId || 'N/A'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Relations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  {service.customer ? (
                    <Link
                      href={`/customers/${service.customer.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {service.customer.name}
                    </Link>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Site</p>
                  {service.site ? (
                    <Link
                      href={`/sites/${service.site.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {service.site.siteName}
                    </Link>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Service Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Bandwidth</p>
                  <p className="font-medium">{service.bandwidth || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Install Date</p>
                  <p className="font-medium">
                    {service.installDate
                      ? new Date(service.installDate).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> MRC
                  </p>
                  <p className="font-medium">
                    {service.monthlyRecurringCharge
                      ? `$${parseFloat(String(service.monthlyRecurringCharge)).toFixed(2)}`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Support Ref
                  </p>
                  <p className="font-medium">{service.supportReference || 'N/A'}</p>
                </div>
              </div>

              {service.notes && (
                <div className="pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{service.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <CircuitImpactSelector
          serviceId={service.id}
          currentImpact={(service as any).impactLevel ?? null}
        />

        {/* Linked Tickets */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Tickets for this circuit</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!(service as any).tickets?.length ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No tickets linked to this circuit.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {((service as any).tickets as Array<any>).map((t: any) => {
                  const isBreached =
                    t.nextEscalationAt && new Date(t.nextEscalationAt) < new Date();
                  return (
                    <div
                      key={t.id}
                      className="p-4 flex items-center justify-between hover:bg-muted/30"
                    >
                      <div>
                        <Link
                          href={`/tickets/${t.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {t.ticketNumber} — {t.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {new Date(t.openedAt).toLocaleDateString()}
                          </span>
                          {isBreached && (
                            <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                              SLA BREACH
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={t.severity} />
                        <StatusBadge status={t.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
