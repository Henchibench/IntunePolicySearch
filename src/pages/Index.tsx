import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PillNav } from "@/components/PillNav";
import { UtilityRow } from "@/components/UtilityRow";
import { Footer } from "@/components/Footer";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";
import { OrbitalPortrait } from "@/components/landing/OrbitalPortrait";

export default function Index() {
  const { isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    document.title = "Intune Policy Search";
  }, []);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="px-6">
        <PillNav />
        <UtilityRow />
      </div>

      <main className="relative mx-auto mt-20 max-w-[1240px] px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-24 select-none text-center text-[120px] font-medium leading-none tracking-tight2 text-ink/[0.04] dark:text-ink/[0.05]"
        >
          Compliance.
        </div>

        <div className="relative grid grid-cols-1 items-center gap-16 md:grid-cols-2">
          <div>
            <EyebrowLabel>INTUNE POLICY SEARCH</EyebrowLabel>
            <h1 className="mt-4 text-[64px] font-medium leading-none tracking-tight2 text-ink">
              See every device.<br />Every policy.<br />No exports.
            </h1>
            <p className="mt-6 max-w-[44ch] text-[16px] font-[450] leading-relaxed text-charcoal">
              A read-only window into your Intune tenant. Search policies, drill
              into compliance, find why a device is failing — without opening
              the portal.
            </p>
          </div>

          <OrbitalPortrait onCta={login} />
        </div>

        <section className="mt-32">
          <EyebrowLabel>WHAT IT DOES</EyebrowLabel>
          <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-3">
            {[
              { h: "Policy search", b: "Find any compliance, configuration, or app-protection policy by name, platform, or assignment." },
              { h: "Compliance dashboard", b: "Live KPI tiles, virtualized device table, drill-down by policy or pivot." },
              { h: "Device deep-fetch", b: "On-demand per-setting failure reasons, batched against Microsoft Graph." },
            ].map((item) => (
              <div key={item.h}>
                <h3 className="text-[24px] font-medium tracking-tight2 text-ink">{item.h}</h3>
                <p className="mt-2 text-[14px] font-[450] leading-relaxed text-charcoal">{item.b}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
