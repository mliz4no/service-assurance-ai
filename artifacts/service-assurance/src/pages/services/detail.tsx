import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetService } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Globe2, Building2, MapPin, DollarSign, Phone } from "lucide-react";
import { Link } from "wouter";
import { StatusBadge } from "@/components/status-badge";

export default function ServiceDetail() {
  const params = useParams();
  const id = params.id as string;

  const { data: service, isLoading } = useGetService(id, {
    query: { enabled: !!id }
  });

  if (isLoading) return <AppLayout title="Loading Service..."><div className="flex justify-center py-12"><Activity className="w-8 h-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  if (!service) return <AppLayout title="Service Not Found"><div className="text-center py-12 text-muted-foreground">Service not found.</div></AppLayout>;

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
            <p className="text-muted-foreground font-mono mt-1">Circuit ID: {service.circuitId || "N/A"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Relations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  {service.customer ? (
                    <Link href={`/customers/${service.customer.id}`} className="font-medium text-primary hover:underline">{service.customer.name}</Link>
                  ) : "-"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Site</p>
                  {service.site ? (
                    <Link href={`/sites/${service.site.id}`} className="font-medium text-primary hover:underline">{service.site.siteName}</Link>
                  ) : "-"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Service Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Bandwidth</p>
                  <p className="font-medium">{service.bandwidth || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Install Date</p>
                  <p className="font-medium">{service.installDate ? new Date(service.installDate).toLocaleDateString() : "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3"/> MRC</p>
                  <p className="font-medium">{service.monthlyRecurringCharge ? `$${service.monthlyRecurringCharge.toFixed(2)}` : "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3"/> Support Ref</p>
                  <p className="font-medium">{service.supportReference || "N/A"}</p>
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
      </div>
    </AppLayout>
  );
}
