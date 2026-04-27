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
        <EyebrowLabel>COMPLIANCE POLICIES ({compliance.length})</EyebrowLabel>
        <div className="mt-3 space-y-3">
          {compliance.length === 0 && (
            <div className="text-slate text-[13px]">None</div>
          )}
          {compliance.map(p => (
            <div key={p.id} className="rounded border border-border p-2">
              <div className="flex items-center justify-between">
                <div className="font-[450] truncate text-ink">{p.displayName}</div>
                <div className="text-xs font-[450] text-slate">{p.state}</div>
              </div>
              {p.settingStates && p.settingStates.length > 0 && (
                <ul className="mt-1 ml-3 list-disc text-xs text-slate space-y-0.5">
                  {p.settingStates
                    .filter(s => s.state !== "compliant" && s.state !== "notApplicable")
                    .map((s, i) => (
                      <li key={`${p.id}-s${i}`}>
                        <span className="font-[450]">{s.settingName || s.setting}</span>
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
        <EyebrowLabel>CONFIGURATION PROFILES ({configuration.length})</EyebrowLabel>
        <div className="mt-3 space-y-3">
          {configuration.length === 0 && (
            <div className="text-slate text-[13px]">None</div>
          )}
          {configuration.map(c => (
            <div key={c.id} className="rounded border border-border p-2">
              <div className="flex items-center justify-between">
                <div className="font-[450] truncate text-ink">{c.displayName}</div>
                <div className="text-xs font-[450] text-slate">{c.state}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border py-4 first:border-t-0 first:pt-0">
        <EyebrowLabel>MANAGED APPS ({details.managedAppStates.length})</EyebrowLabel>
        {details.managedAppStates.length === 0 ? (
          <div className="mt-3 text-slate text-[13px]">None deployed by Intune</div>
        ) : (
          <div className="mt-3 rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-ink/[0.06]">
                <tr>
                  <th className="text-left p-2 font-[450] text-ink">App</th>
                  <th className="text-left p-2 font-[450] text-ink">Intent</th>
                  <th className="text-left p-2 font-[450] text-ink">Install state</th>
                  <th className="text-left p-2 font-[450] text-ink">Version</th>
                </tr>
              </thead>
              <tbody>
                {details.managedAppStates.map(a => {
                  const installPillClass =
                    a.installState === "installed"
                      ? "inline-flex items-center rounded-pill bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"
                      : a.installState === "failed" || a.installState === "uninstallFailed"
                        ? "inline-flex items-center rounded-pill bg-signal/[0.18] px-2 py-0.5 text-[11px] font-medium text-signal-light"
                        : a.installState === "pendingInstall" || a.installState === "notInstalled"
                          ? "inline-flex items-center rounded-pill bg-signal-light/[0.12] px-2 py-0.5 text-[11px] font-medium text-signal-light"
                          : "inline-flex items-center rounded-pill bg-ink/[0.06] px-2 py-0.5 text-[11px] font-medium text-ink";
                  return (
                    <tr key={a.applicationId} className="border-t border-border">
                      <td className="p-2 truncate max-w-[240px] text-ink font-[450]">{a.displayName}</td>
                      <td className="p-2 text-slate font-[450]">{a.mobileAppIntent ?? "—"}</td>
                      <td className="p-2">
                        <span className={installPillClass}>{a.installState ?? "unknown"}</span>
                      </td>
                      <td className="p-2 text-slate font-[450]">{a.displayVersion || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border-t border-border py-4 first:border-t-0 first:pt-0">
        <EyebrowLabel>DETECTED APPS ({details.detectedApps.length})</EyebrowLabel>
        {details.detectedApps.length === 0 ? (
          <div className="mt-3 text-slate text-[13px]">None</div>
        ) : (
          <div className="mt-3 rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-ink/[0.06]">
                <tr>
                  <th className="text-left p-2 font-[450] text-ink">Name</th>
                  <th className="text-left p-2 font-[450] text-ink">Version</th>
                  <th className="text-left p-2 font-[450] text-ink">Publisher</th>
                </tr>
              </thead>
              <tbody>
                {details.detectedApps.map(a => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="p-2 truncate max-w-[200px] text-ink font-[450]">{a.displayName}</td>
                    <td className="p-2 text-slate font-[450]">{a.version || "—"}</td>
                    <td className="p-2 text-slate font-[450] truncate max-w-[150px]">{a.publisher || "—"}</td>
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
