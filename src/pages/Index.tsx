import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PillNav } from "@/components/PillNav";
import { UtilityRow } from "@/components/UtilityRow";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

export default function Index() {
  const { isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    document.title = "Intune Policy Search";
  }, []);

  if (isLoading) {
    return null;
  }
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PillNav />
      <div className="px-6">
        <UtilityRow />
      </div>

      <main className="mx-auto mt-16 max-w-[1280px] px-6">
        <section className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">INTUNE POLICY SEARCH</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
              See every device. Every policy. No exports.
            </h1>
            <p className="mt-4 max-w-[44ch] text-sm leading-relaxed text-muted-foreground">
              A read-only window into your Intune tenant. Search policies, drill
              into compliance, find why a device is failing — without opening
              the portal.
            </p>
            <div className="mt-8">
              <Button onClick={login} variant="ink" size="lg">
                Sign in to get started
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold text-foreground">Connect your tenant</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Sign in with your Microsoft account to query Microsoft Graph
              directly. Nothing is stored — every result is read live from your
              tenant.
            </p>
            <Button onClick={login} variant="ink" className="mt-6 w-full">
              Sign in with Microsoft
            </Button>
          </div>
        </section>

        <section className="mt-24">
          <p className="text-xs font-semibold text-primary">What it does</p>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { h: "Policy search", b: "Find any compliance, configuration, or app-protection policy by name, platform, or assignment." },
              { h: "Compliance dashboard", b: "Live KPI tiles, virtualized device table, drill-down by policy or pivot." },
              { h: "Device deep-fetch", b: "On-demand per-setting failure reasons, batched against Microsoft Graph." },
            ].map((item) => (
              <div key={item.h} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <h3 className="text-base font-semibold text-foreground">{item.h}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.b}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
