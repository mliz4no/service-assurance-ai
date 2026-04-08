import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute, InternalOnlyRoute } from "@/lib/auth";

// Pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import CustomersList from "@/pages/customers/index";
import CustomerNew from "@/pages/customers/new";
import CustomerDetail from "@/pages/customers/detail";
import CustomerEdit from "@/pages/customers/edit";
import SitesList from "@/pages/sites/index";
import SiteNew from "@/pages/sites/new";
import SiteDetail from "@/pages/sites/detail";
import ServicesList from "@/pages/services/index";
import ServiceNew from "@/pages/services/new";
import ServiceDetail from "@/pages/services/detail";
import TicketsList from "@/pages/tickets/index";
import TicketNew from "@/pages/tickets/new";
import TicketDetail from "@/pages/tickets/detail";
import AdminPanel from "@/pages/admin/index";
import MyTickets from "@/pages/my-tickets";
import ControllersPage from "@/pages/controllers/index";
import ControllerDetailPage from "@/pages/controllers/detail";
import DevicesPage from "@/pages/devices/index";
import DeviceDetailPage from "@/pages/devices/detail";
import NetworkLinksPage from "@/pages/network-links/index";
import EventMonitorPage from "@/pages/events/index";
import MapPage from "@/pages/map/index";
import NotFound from "@/pages/not-found";

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
    <Switch>
      <Route path="/" component={Login} />

      <Route path="/dashboard">
        <InternalOnlyRoute><Dashboard /></InternalOnlyRoute>
      </Route>
      <Route path="/customers">
        <ProtectedRoute><CustomersList /></ProtectedRoute>
      </Route>
      <Route path="/customers/new">
        <ProtectedRoute><CustomerNew /></ProtectedRoute>
      </Route>
      <Route path="/customers/:id/edit">
        <ProtectedRoute><CustomerEdit /></ProtectedRoute>
      </Route>
      <Route path="/customers/:id">
        <ProtectedRoute><CustomerDetail /></ProtectedRoute>
      </Route>
      <Route path="/sites">
        <ProtectedRoute><SitesList /></ProtectedRoute>
      </Route>
      <Route path="/sites/new">
        <ProtectedRoute><SiteNew /></ProtectedRoute>
      </Route>
      <Route path="/sites/:id">
        <ProtectedRoute><SiteDetail /></ProtectedRoute>
      </Route>
      <Route path="/services">
        <ProtectedRoute><ServicesList /></ProtectedRoute>
      </Route>
      <Route path="/services/new">
        <ProtectedRoute><ServiceNew /></ProtectedRoute>
      </Route>
      <Route path="/services/:id">
        <ProtectedRoute><ServiceDetail /></ProtectedRoute>
      </Route>
      <Route path="/tickets">
        <ProtectedRoute><TicketsList /></ProtectedRoute>
      </Route>
      <Route path="/tickets/new">
        <ProtectedRoute><TicketNew /></ProtectedRoute>
      </Route>
      <Route path="/tickets/:id">
        <ProtectedRoute><TicketDetail /></ProtectedRoute>
      </Route>
      <Route path="/admin">
        <InternalOnlyRoute><AdminPanel /></InternalOnlyRoute>
      </Route>
      <Route path="/my-tickets">
        <ProtectedRoute><MyTickets /></ProtectedRoute>
      </Route>
      <Route path="/controllers">
        <InternalOnlyRoute><ControllersPage /></InternalOnlyRoute>
      </Route>
      <Route path="/controllers/:id">
        <InternalOnlyRoute><ControllerDetailPage /></InternalOnlyRoute>
      </Route>
      <Route path="/devices">
        <ProtectedRoute><DevicesPage /></ProtectedRoute>
      </Route>
      <Route path="/devices/:id">
        <ProtectedRoute><DeviceDetailPage /></ProtectedRoute>
      </Route>
      <Route path="/network-links">
        <InternalOnlyRoute><NetworkLinksPage /></InternalOnlyRoute>
      </Route>
      <Route path="/events">
        <InternalOnlyRoute><EventMonitorPage /></InternalOnlyRoute>
      </Route>
      <Route path="/map">
        <ProtectedRoute><MapPage /></ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
