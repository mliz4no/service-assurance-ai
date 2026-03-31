import { useAuth } from "@/lib/auth";
import { clearToken } from "@/main";
import { Link, useLocation } from "wouter";
import { 
  Building2, 
  MapPin, 
  Globe2, 
  TicketCheck, 
  LayoutDashboard, 
  Settings,
  LogOut,
  User as UserIcon,
  Search
} from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        clearToken();
        window.location.href = "/";
      },
      onError: () => {
        clearToken();
        window.location.href = "/";
      }
    });
  };

  const isAdminOrOps = user?.role === "admin" || user?.role === "ops";

  const navItems = isAdminOrOps ? [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tickets", label: "Tickets", icon: TicketCheck },
    { href: "/customers", label: "Customers", icon: Building2 },
    { href: "/sites", label: "Sites", icon: MapPin },
    { href: "/services", label: "Services", icon: Globe2 },
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin", icon: Settings }] : []),
  ] : [
    { href: "/my-tickets", label: "My Tickets", icon: TicketCheck },
  ];

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-sidebar text-sidebar-foreground flex flex-col fixed inset-y-0 left-0 z-10 border-r border-sidebar-border shadow-sm">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50">
          <div className="flex items-center gap-2 text-primary-foreground font-bold text-lg tracking-tight">
            <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-sm" />
            </div>
            Service Assurance AI
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2 px-3">
            Navigation
          </div>
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" 
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-sidebar-border/50 bg-sidebar/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 max-w-[140px]">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate" title={user?.name}>{user?.name}</span>
                <span className="text-xs text-sidebar-foreground/60 capitalize">{user?.role}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleLogout} title="Logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">{title || "Dashboard"}</h1>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search resources..."
                className="w-full bg-muted/50 pl-9 shadow-none border-transparent focus-visible:bg-white"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
