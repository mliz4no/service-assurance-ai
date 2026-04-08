import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetSite } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, MapPin, Building2, Globe2, Ticket, Phone, Mail, User } from "lucide-react";
import { LocationImpactSelector } from "@/components/LocationImpactSelector";
import { Link } from "wouter";
import { StatusBadge } from "@/components/status-badge";

export default function SiteDetail() {
  const params = useParams();
  const id = params.id as string;

  const { data: site, isLoading } = useGetSite(id, {
    query: { enabled: !!id }
  });

  if (isLoading) return <AppLayout title="Loading Site..."><div className="flex justify-center py-12"><Activity className="w-8 h-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  if (!site) return <AppLayout title="Site Not Found"><div className="text-center py-12 text-muted-foreground">Site not found.</div></AppLayout>;

  const hasLcon = site.lconName || site.lconPhone || site.lconEmail;

  return (
    <AppLayout title={site.siteName}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {site.siteName}
              <span className="text-sm font-normal text-muted-foreground border px-2 py-0.5 rounded-md ml-2">{site.siteCode || "No code"}</span>
            </h1>
            <p className="text-muted-foreground flex items-center gap-1 text-sm mt-1">
              <Building2 className="w-4 h-4" />
              {site.customer ? (
                <Link href={`/customers/${site.customer.id}`} className="hover:underline">{site.customer.name}</Link>
              ) : "No customer linked"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1 space-y-4">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium">{site.address1 || "No address provided"}</p>
                  {site.address2 && <p className="font-medium">{site.address2}</p>}
                  <p className="text-sm text-muted-foreground">
                    {site.city}{site.city && site.state ? ", " : ""}
                    {site.state} {site.postalCode}
                  </p>
                  <p className="text-sm text-muted-foreground">{site.country}</p>
                </div>
                <div className="pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Timezone</p>
                  <p className="font-medium text-sm">{site.timezone || "Not set"}</p>
                </div>
                {site.notes && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{site.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm" data-testid="lcon-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Local Contact (LCON)</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {!hasLcon ? (
                  <p className="text-sm text-muted-foreground italic" data-testid="lcon-empty">No local contact on file.</p>
                ) : (
                  <div className="space-y-3">
                    {site.lconName && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium" data-testid="lcon-name">{site.lconName}</span>
                      </div>
                    )}
                    {site.lconPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                        <a
                          href={`tel:${site.lconPhone}`}
                          className="text-sm text-primary hover:underline font-mono"
                          data-testid="lcon-phone"
                        >
                          {site.lconPhone}
                        </a>
                      </div>
                    )}
                    {site.lconEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                        <a
                          href={`mailto:${site.lconEmail}`}
                          className="text-sm text-primary hover:underline"
                          data-testid="lcon-email"
                        >
                          {site.lconEmail}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-1 md:col-span-2 space-y-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Globe2 className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Services at this site</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!site.services?.length ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No services provisioned at this site.</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {site.services.map(s => (
                      <div key={s.id} className="p-4 flex items-center justify-between hover:bg-muted/30">
                        <div>
                          <Link href={`/services/${s.id}`} className="font-medium text-primary hover:underline">{s.serviceType}</Link>
                          <div className="text-sm text-muted-foreground">Vendor: {s.vendorName} · Circuit: {s.circuitId || "N/A"}</div>
                        </div>
                        <StatusBadge status={s.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <LocationImpactSelector
              siteId={site.id}
              currentImpact={(site as any).impactLevel ?? null}
              currentUrgency={(site as any).urgencyLevel ?? null}
            />

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Tickets for this site</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!site.tickets?.length ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No tickets for this site.</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {site.tickets.map(t => (
                      <div key={t.id} className="p-4 flex items-center justify-between hover:bg-muted/30">
                        <div>
                          <Link href={`/tickets/${t.id}`} className="font-medium text-primary hover:underline">{t.ticketNumber} - {t.title}</Link>
                          <div className="text-sm text-muted-foreground">{new Date(t.openedAt).toLocaleDateString()}</div>
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
