import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { LogIn } from 'lucide-react';
import { Link } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/lib/auth';

type PublicMapPoint = {
  id: string;
  label: string;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  latitude: number;
  longitude: number;
  provider: string | null;
  region: string | null;
  lastSeenAt: string | null;
  source: 'manual' | 'nagios' | 'controller' | 'synthetic';
};

type PublicMapSummary = {
  totalAssets: number;
  activeOutages: number;
  degradedServices: number;
  unknownServices: number;
  lastUpdatedAt: string | null;
};

const STATUS_STYLE: Record<PublicMapPoint['status'], { color: string; label: string }> = {
  up: { color: '#16a34a', label: 'Up' },
  down: { color: '#dc2626', label: 'Down' },
  degraded: { color: '#d97706', label: 'Degraded' },
  unknown: { color: '#64748b', label: 'Unknown' },
};

function formatLastUpdated(value: string | null): string {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
}

export default function PublicNetworkMapPage() {
  const { isAuthenticated } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  const {
    data: points = [],
    isLoading: pointsLoading,
    isError: pointsError,
  } = useQuery({
    queryKey: ['public-network-map'],
    queryFn: () => apiFetch<PublicMapPoint[]>('/public/network-map'),
    refetchInterval: 30000,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['public-network-map-summary'],
    queryFn: () => apiFetch<PublicMapSummary>('/public/network-map/summary'),
    refetchInterval: 30000,
  });

  const providers = useMemo(
    () =>
      [
        ...new Set(
          points
            .map((point) => point.provider)
            .filter((provider): provider is string => !!provider),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [points],
  );

  const regions = useMemo(
    () =>
      [
        ...new Set(
          points.map((point) => point.region).filter((region): region is string => !!region),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [points],
  );

  const filteredPoints = useMemo(
    () =>
      points.filter((point) => {
        if (statusFilter !== 'all' && point.status !== statusFilter) return false;
        if (providerFilter !== 'all' && point.provider !== providerFilter) return false;
        if (regionFilter !== 'all' && point.region !== regionFilter) return false;
        return true;
      }),
    [points, statusFilter, providerFilter, regionFilter],
  );

  const mapCenter: [number, number] = useMemo(() => {
    if (filteredPoints.length === 0) return [39.5, -98.35];
    const totalLat = filteredPoints.reduce((sum, point) => sum + point.latitude, 0);
    const totalLng = filteredPoints.reduce((sum, point) => sum + point.longitude, 0);
    return [totalLat / filteredPoints.length, totalLng / filteredPoints.length];
  }, [filteredPoints]);

  const mapContent = (
    <div
      className={
        isAuthenticated
          ? 'w-full space-y-4'
          : 'mx-auto w-full max-w-7xl space-y-4 px-4 py-6 md:px-6 lg:px-8'
      }
    >
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Network Status Map</h1>
          <p className="text-sm text-muted-foreground">
            Public service visibility with approved labels and outage state.
          </p>
        </div>
        {!isAuthenticated && (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/login">
              <LogIn className="mr-2 h-4 w-4" />
              Staff login
            </Link>
          </Button>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {summaryLoading ? '...' : (summary?.totalAssets ?? 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Active Outages
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-600">
            {summaryLoading ? '...' : (summary?.activeOutages ?? 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Degraded
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-600">
            {summaryLoading ? '...' : (summary?.degradedServices ?? 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Last Updated
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">
            {formatLastUpdated(summary?.lastUpdatedAt ?? null)}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="up">Up</SelectItem>
            <SelectItem value="down">Down</SelectItem>
            <SelectItem value="degraded">Degraded</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>

        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            {providers.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {provider}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {regions.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="h-[65vh] min-h-[420px] w-full">
          {pointsError ? (
            <div className="flex h-full items-center justify-center text-sm text-destructive">
              Unable to load map data.
            </div>
          ) : (
            <MapContainer center={mapCenter} zoom={5} style={{ width: '100%', height: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {filteredPoints.map((point) => (
                <CircleMarker
                  key={point.id}
                  center={[point.latitude, point.longitude]}
                  radius={8}
                  pathOptions={{
                    color: STATUS_STYLE[point.status].color,
                    fillColor: STATUS_STYLE[point.status].color,
                    fillOpacity: 0.85,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-sm">{point.label}</p>
                      <Badge variant="outline">{STATUS_STYLE[point.status].label}</Badge>
                      <p>Provider: {point.provider ?? 'N/A'}</p>
                      <p>Region: {point.region ?? 'N/A'}</p>
                      <p>Source: {point.source}</p>
                      <p>Last Seen: {formatLastUpdated(point.lastSeenAt)}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        {pointsLoading
          ? 'Loading map points...'
          : `Showing ${filteredPoints.length} of ${points.length} approved public points.`}
      </p>
    </div>
  );

  if (isAuthenticated) {
    return <AppLayout title="Public Network Map">{mapContent}</AppLayout>;
  }

  return <main className="min-h-screen bg-background text-foreground">{mapContent}</main>;
}
