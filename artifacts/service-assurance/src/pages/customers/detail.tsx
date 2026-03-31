import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetCustomer } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Activity, Edit, Building2, MapPin, Globe2, Ticket, Mail, Phone } from "lucide-react";
import { Link } from "wouter";

export default function CustomerDetail() {
  const params = useParams();
  const id = params.id as string;
  const [, setLocation] = useLocation();

  const { data: customer, isLoading } = useGetCustomer(id, {
    query: {
      enabled: !!id,
    }
  });

  if (isLoading) {
    return (
      <AppLayout title="Loading Customer...">
        <div className="flex justify-center py-12"><Activity className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  if (!customer) {
    return (
      <AppLayout title="Customer Not Found">
        <div className="text-center py-12 text-muted-foreground">Customer not found.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={customer.name}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                {customer.name}
                <StatusBadge status={customer.status} />
              </h1>
              <p className="text-muted-foreground">Account #: {customer.accountNumber || "N/A"}</p>
            </div>
          </div>
          <Button onClick={() => setLocation(`/customers/${id}/edit`)} variant="outline">
            <Edit className="w-4 h-4 mr-2" /> Edit Customer
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Primary Contact</p>
                <p className="font-medium">{customer.primaryContactName || "Not set"}</p>
              </div>
              {customer.primaryContactEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${customer.primaryContactEmail}`} className="text-primary hover:underline">{customer.primaryContactEmail}</a>
                </div>
              )}
              {customer.primaryContactPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{customer.primaryContactPhone}</span>
                </div>
              )}
              {customer.notes && (
                <div className="pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{customer.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="col-span-1 md:col-span-2">
            <Tabs defaultValue="sites" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="sites"><MapPin className="w-4 h-4 mr-2"/> Sites ({customer.sites?.length || 0})</TabsTrigger>
                <TabsTrigger value="services"><Globe2 className="w-4 h-4 mr-2"/> Services ({customer.services?.length || 0})</TabsTrigger>
                <TabsTrigger value="tickets"><Ticket className="w-4 h-4 mr-2"/> Tickets ({customer.tickets?.length || 0})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="sites" className="mt-4">
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-0">
                    {!customer.sites?.length ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">No sites configured.</div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {customer.sites.map(s => (
                          <div key={s.id} className="p-4 flex items-center justify-between hover:bg-muted/30">
                            <div>
                              <Link href={`/sites/${s.id}`} className="font-medium text-primary hover:underline">{s.siteName}</Link>
                              <div className="text-sm text-muted-foreground">{s.city}, {s.state}</div>
                            </div>
                            <div className="text-sm text-muted-foreground">{s.siteCode}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="services" className="mt-4">
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-0">
                    {!customer.services?.length ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">No services provisioned.</div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {customer.services.map(s => (
                          <div key={s.id} className="p-4 flex items-center justify-between hover:bg-muted/30">
                            <div>
                              <Link href={`/services/${s.id}`} className="font-medium text-primary hover:underline">{s.serviceType}</Link>
                              <div className="text-sm text-muted-foreground">Circuit: {s.circuitId || "N/A"}</div>
                            </div>
                            <StatusBadge status={s.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tickets" className="mt-4">
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-0">
                    {!customer.tickets?.length ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">No recent tickets.</div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {customer.tickets.map(t => (
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
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
