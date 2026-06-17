import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useGetSites } from '@workspace/api-client-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Activity, Plus, Search, MapPin } from 'lucide-react';
import { Link } from 'wouter';

export default function SitesList() {
  const [search, setSearch] = useState('');

  const { data: sites, isLoading } = useGetSites({
    search: search || undefined,
  });

  return (
    <AppLayout title="Sites">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sites..."
                className="pl-9 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <Link href="/sites/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Site
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-border/50 rounded-lg shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Site Name</TableHead>
                <TableHead>Site Code</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Timezone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Activity className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !sites?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No sites found.
                  </TableCell>
                </TableRow>
              ) : (
                sites.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <Link href={`/sites/${s.id}`} className="text-primary hover:underline">
                        {s.siteName}
                      </Link>
                    </TableCell>
                    <TableCell>{s.siteCode || '-'}</TableCell>
                    <TableCell>
                      {s.customer ? (
                        <Link href={`/customers/${s.customer.id}`} className="hover:underline">
                          {s.customer.name}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>
                          {s.city}
                          {s.city && s.state ? ', ' : ''}
                          {s.state}
                        </div>
                        <div className="text-muted-foreground">{s.country}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.timezone || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
