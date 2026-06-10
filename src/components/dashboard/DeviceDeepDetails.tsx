import { DeviceDeepDetails as DeepDetails } from "@/types/managedDevice";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";

interface DeviceDeepDetailsProps {
  details: DeepDetails;
}

export function DeviceDeepDetails({ details }: DeviceDeepDetailsProps) {
  const compliance = details.compliancePolicyStates.filter(p => p.state !== "notApplicable");
  const configuration = details.configurationStates.filter(c => c.state !== "notApplicable");

  return (
    <div>
      <section className="border-t border-border py-4 first:border-t-0 first:pt-0">
        <EyebrowLabel>Compliance policies ({compliance.length})</EyebrowLabel>
        <div className="mt-3 space-y-3">
          {compliance.length === 0 && (
            <div className="text-slate text-[13px]">None</div>
          )}
          {compliance.map(p => (
            <div key={p.id} className="rounded-md border border-border p-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold truncate text-ink">{p.displayName}</div>
                <div className="text-xs text-slate">{p.state}</div>
              </div>
              {p.settingStates && p.settingStates.length > 0 && (
                <ul className="mt-1 ml-3 list-disc text-xs text-slate space-y-0.5">
                  {p.settingStates
                    .filter(s => s.state !== "compliant" && s.state !== "notApplicable")
                    .map((s, i) => (
                      <li key={`${p.id}-s${i}`}>
                        <span className="font-semibold">{s.settingName || s.setting}</span>
                        {": "}{s.state}
                        {s.errorDescription ? ` — ${s.errorDescription}` : ""}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border py-4 first:border-t-0 first:pt-0">
        <EyebrowLabel>Configuration profiles ({configuration.length})</EyebrowLabel>
        <div className="mt-3 space-y-3">
          {configuration.length === 0 && (
            <div className="text-slate text-[13px]">None</div>
          )}
          {configuration.map(c => (
            <div key={c.id} className="rounded-md border border-border p-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold truncate text-ink">{c.displayName}</div>
                <div className="text-xs text-slate">{c.state}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border py-4 first:border-t-0 first:pt-0">
        <EyebrowLabel>Managed apps ({details.managedAppStates.length})</EyebrowLabel>
        {details.managedAppStates.length === 0 ? (
          <div className="mt-3 text-slate text-[13px]">None deployed by Intune</div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 font-semibold text-foreground">App</th>
                  <th className="text-left p-2 font-semibold text-foreground">Intent</th>
                  <th className="text-left p-2 font-semibold text-foreground">Install state</th>
                  <th className="text-left p-2 font-semibold text-foreground">Version</th>
                </tr>
              </thead>
              <tbody>
                {details.managedAppStates.map(a => {
                  const installPillClass =
                    a.installState === "installed"
                      ? "inline-flex items-center rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success"
                      : a.installState === "failed" || a.installState === "uninstallFailed"
                        ? "inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive"
                        : a.installState === "pendingInstall" || a.installState === "notInstalled"
                          ? "inline-flex items-center rounded-md bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning"
                          : "inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground";
                  return (
                    <tr key={a.applicationId} className="border-t border-border">
                      <td className="p-2 truncate max-w-[240px] text-ink">{a.displayName}</td>
                      <td className="p-2 text-slate">{a.mobileAppIntent ?? "—"}</td>
                      <td className="p-2">
                        <span className={installPillClass}>{a.installState ?? "unknown"}</span>
                      </td>
                      <td className="p-2 text-slate">{a.displayVersion || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border-t border-border py-4 first:border-t-0 first:pt-0">
        <EyebrowLabel>Detected apps ({details.detectedApps.length})</EyebrowLabel>
        {details.detectedApps.length === 0 ? (
          <div className="mt-3 text-slate text-[13px]">None</div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 font-semibold text-foreground">Name</th>
                  <th className="text-left p-2 font-semibold text-foreground">Version</th>
                  <th className="text-left p-2 font-semibold text-foreground">Publisher</th>
                </tr>
              </thead>
              <tbody>
                {details.detectedApps.map(a => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="p-2 truncate max-w-[200px] text-ink">{a.displayName}</td>
                    <td className="p-2 text-slate">{a.version || "—"}</td>
                    <td className="p-2 text-slate truncate max-w-[150px]">{a.publisher || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
