import { lazy, Suspense } from 'react';
import { Switch, Route, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, ProtectedRoute, InternalOnlyRoute } from '@/lib/auth';
import { LoaderCircle } from 'lucide-react';

import NotFound from '@/pages/not-found';

const Login = lazy(() => import('@/pages/login'));
const Dashboard = lazy(() => import('@/pages/dashboard'));
const CustomersList = lazy(() => import('@/pages/customers/index'));
const CustomerNew = lazy(() => import('@/pages/customers/new'));
const CustomerDetail = lazy(() => import('@/pages/customers/detail'));
const CustomerEdit = lazy(() => import('@/pages/customers/edit'));
const SitesList = lazy(() => import('@/pages/sites/index'));
const SiteNew = lazy(() => import('@/pages/sites/new'));
const SiteDetail = lazy(() => import('@/pages/sites/detail'));
const ServicesList = lazy(() => import('@/pages/services/index'));
const ServiceNew = lazy(() => import('@/pages/services/new'));
const ServiceDetail = lazy(() => import('@/pages/services/detail'));
const TicketsList = lazy(() => import('@/pages/tickets/index'));
const TicketNew = lazy(() => import('@/pages/tickets/new'));
const TicketDetail = lazy(() => import('@/pages/tickets/detail'));
const AdminPanel = lazy(() => import('@/pages/admin/index'));
const MyTickets = lazy(() => import('@/pages/my-tickets'));
const ControllersPage = lazy(() => import('@/pages/controllers/index'));
const ControllerDetailPage = lazy(() => import('@/pages/controllers/detail'));
const DevicesPage = lazy(() => import('@/pages/devices/index'));
const DeviceDetailPage = lazy(() => import('@/pages/devices/detail'));
const NetworkLinksPage = lazy(() => import('@/pages/network-links/index'));
const EventMonitorPage = lazy(() => import('@/pages/events/index'));
const MapPage = lazy(() => import('@/pages/map/index'));
const PublicNetworkMapPage = lazy(() => import('@/pages/network-map-public'));
const MonitoringPage = lazy(() => import('@/pages/monitoring/index'));
const InvoiceComplaintsList = lazy(() => import('@/pages/invoice-complaints/index'));
const NewInvoiceComplaint = lazy(() => import('@/pages/invoice-complaints/new'));
const InvoiceComplaintDetail = lazy(() => import('@/pages/invoice-complaints/detail'));

function RouteFallback() {
  return (
    <div
      className="grid min-h-screen place-items-center bg-background"
      role="status"
      aria-label="Loading page"
    >
      <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/network-map" component={PublicNetworkMapPage} />
        <Route path="/" component={Login} />

        <Route path="/dashboard">
          <InternalOnlyRoute>
            <Dashboard />
          </InternalOnlyRoute>
        </Route>
        <Route path="/customers">
          <ProtectedRoute>
            <CustomersList />
          </ProtectedRoute>
        </Route>
        <Route path="/customers/new">
          <ProtectedRoute>
            <CustomerNew />
          </ProtectedRoute>
        </Route>
        <Route path="/customers/:id/edit">
          <ProtectedRoute>
            <CustomerEdit />
          </ProtectedRoute>
        </Route>
        <Route path="/customers/:id">
          <ProtectedRoute>
            <CustomerDetail />
          </ProtectedRoute>
        </Route>
        <Route path="/sites">
          <ProtectedRoute>
            <SitesList />
          </ProtectedRoute>
        </Route>
        <Route path="/sites/new">
          <ProtectedRoute>
            <SiteNew />
          </ProtectedRoute>
        </Route>
        <Route path="/sites/:id">
          <ProtectedRoute>
            <SiteDetail />
          </ProtectedRoute>
        </Route>
        <Route path="/services">
          <ProtectedRoute>
            <ServicesList />
          </ProtectedRoute>
        </Route>
        <Route path="/services/new">
          <ProtectedRoute>
            <ServiceNew />
          </ProtectedRoute>
        </Route>
        <Route path="/services/:id">
          <ProtectedRoute>
            <ServiceDetail />
          </ProtectedRoute>
        </Route>
        <Route path="/tickets">
          <ProtectedRoute>
            <TicketsList />
          </ProtectedRoute>
        </Route>
        <Route path="/tickets/new">
          <ProtectedRoute>
            <TicketNew />
          </ProtectedRoute>
        </Route>
        <Route path="/tickets/:id">
          <ProtectedRoute>
            <TicketDetail />
          </ProtectedRoute>
        </Route>
        <Route path="/admin">
          <InternalOnlyRoute>
            <AdminPanel />
          </InternalOnlyRoute>
        </Route>
        <Route path="/my-tickets">
          <ProtectedRoute>
            <MyTickets />
          </ProtectedRoute>
        </Route>
        <Route path="/controllers">
          <InternalOnlyRoute>
            <ControllersPage />
          </InternalOnlyRoute>
        </Route>
        <Route path="/controllers/:id">
          <InternalOnlyRoute>
            <ControllerDetailPage />
          </InternalOnlyRoute>
        </Route>
        <Route path="/devices">
          <ProtectedRoute>
            <DevicesPage />
          </ProtectedRoute>
        </Route>
        <Route path="/devices/:id">
          <ProtectedRoute>
            <DeviceDetailPage />
          </ProtectedRoute>
        </Route>
        <Route path="/network-links">
          <InternalOnlyRoute>
            <NetworkLinksPage />
          </InternalOnlyRoute>
        </Route>
        <Route path="/events">
          <InternalOnlyRoute>
            <EventMonitorPage />
          </InternalOnlyRoute>
        </Route>
        <Route path="/map">
          <ProtectedRoute>
            <MapPage />
          </ProtectedRoute>
        </Route>
        <Route path="/monitoring">
          <InternalOnlyRoute>
            <MonitoringPage />
          </InternalOnlyRoute>
        </Route>
        <Route path="/invoice-complaints">
          <ProtectedRoute>
            <InvoiceComplaintsList />
          </ProtectedRoute>
        </Route>
        <Route path="/invoice-complaints/new">
          <ProtectedRoute>
            <NewInvoiceComplaint />
          </ProtectedRoute>
        </Route>
        <Route path="/invoice-complaints/:id">
          <ProtectedRoute>
            <InvoiceComplaintDetail />
          </ProtectedRoute>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
