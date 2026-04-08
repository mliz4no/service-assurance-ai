import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, useGetCurrentUser } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { saveToken } from "@/lib/token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const loginMutation = useLogin();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const dest = user?.role === "telecom_services_partner" ? "/customers"
        : user?.role === "customer" ? "/my-tickets"
        : "/dashboard";
      setLocation(dest);
    }
  }, [authLoading, isAuthenticated, user, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    setErrorMsg("");
    loginMutation.mutate({ data: values }, {
      onSuccess: (data: any) => {
        if (data?.token) {
          saveToken(data.token);
        }
        window.location.href = "/dashboard";
      },
      onError: (err: any) => {
        setErrorMsg(err?.data?.message || err?.message || "Invalid credentials");
      }
    });
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Activity className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md p-4">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-md">
              <div className="w-4 h-4 bg-white rounded-sm" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Service Assurance AI</h1>
          </div>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="space-y-1 pb-6 text-center">
            <CardTitle className="text-2xl font-semibold">Welcome back</CardTitle>
            <CardDescription className="text-base">
              Sign in to your operations dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="admin@example.com" autoComplete="email" data-testid="login-email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                      </div>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" autoComplete="current-password" data-testid="login-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {errorMsg && (
                  <div className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md" data-testid="login-error">
                    {errorMsg}
                  </div>
                )}
                <Button type="submit" className="w-full font-medium" disabled={loginMutation.isPending} data-testid="login-submit">
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>Demo Credentials:</p>
              <p className="mt-1">admin@serviceassurance.ai / Admin123!</p>
              <p>ops@serviceassurance.ai / Ops123!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
