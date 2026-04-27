import { DeviceDeepDetails as DeepDetails } from "@/types/managedDevice";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";

interface DeviceDeepDetailsProps {
  details: DeepDetails;
}

export function DeviceDeepDetails({ details }: DeviceDeepDetailsProps) {
  return (
    <div>
      <section className="border-t border-border py-4 first:border-t-0 first:pt-0">
        <EyebrowLabel>COMPLIANCE POLICIES ({details.compliancePolicyStates.length})</EyebrowLabel>
        <div className="mt-3 space-y-3">
          {details.compliancePolicyStates.length === 0 && (
            <div className="text-slate text-[13px]">None</div>
          )}
          {details.compliancePolicyStates.map(p => (
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
        <EyebrowLabel>CONFIGURATION PROFILES ({details.configurationStates.length})</EyebrowLabel>
        <div className="mt-3 space-y-3">
          {details.configurationStates.length === 0 && (
            <div className="text-slate text-[13px]">None</div>
          )}
          {details.configurationStates.map(c => (
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
        <EyebrowLabel>DETECTED APPS ({details.detectedApps.length})</EyebrowLabel>
        {details.detectedApps.length === 0 ? (
          <div className="mt-3 text-slate text-[13px]">None</div>
        ) : (
          <div className="mt-3 max-h-64 overflow-auto rounded border border-border">
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
