import { DeviceDeepDetails as DeepDetails } from "@/types/managedDevice";

interface DeviceDeepDetailsProps {
  details: DeepDetails;
}

export function DeviceDeepDetails({ details }: DeviceDeepDetailsProps) {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h4 className="font-semibold mb-2">Compliance policies ({details.compliancePolicyStates.length})</h4>
        <div className="space-y-1">
          {details.compliancePolicyStates.length === 0 && (
            <div className="text-muted-foreground">None</div>
          )}
          {details.compliancePolicyStates.map(p => (
            <div key={p.id} className="rounded border p-2">
              <div className="flex items-center justify-between">
                <div className="font-medium truncate">{p.displayName}</div>
                <div className="text-xs">{p.state}</div>
              </div>
              {p.settingStates && p.settingStates.length > 0 && (
                <ul className="mt-1 ml-3 list-disc text-xs text-muted-foreground space-y-0.5">
                  {p.settingStates
                    .filter(s => s.state !== "compliant" && s.state !== "notApplicable")
                    .map((s, i) => (
                      <li key={`${p.id}-s${i}`}>
                        <span className="font-medium">{s.settingName || s.setting}</span>
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

      <section>
        <h4 className="font-semibold mb-2">Configuration profiles ({details.configurationStates.length})</h4>
        <div className="space-y-1">
          {details.configurationStates.length === 0 && (
            <div className="text-muted-foreground">None</div>
          )}
          {details.configurationStates.map(c => (
            <div key={c.id} className="rounded border p-2">
              <div className="flex items-center justify-between">
                <div className="font-medium truncate">{c.displayName}</div>
                <div className="text-xs">{c.state}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="font-semibold mb-2">Detected apps ({details.detectedApps.length})</h4>
        {details.detectedApps.length === 0 ? (
          <div className="text-muted-foreground">None</div>
        ) : (
          <div className="max-h-64 overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Version</th>
                  <th className="text-left p-2">Publisher</th>
                </tr>
              </thead>
              <tbody>
                {details.detectedApps.map(a => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2 truncate max-w-[200px]">{a.displayName}</td>
                    <td className="p-2 text-muted-foreground">{a.version || "—"}</td>
                    <td className="p-2 text-muted-foreground truncate max-w-[150px]">{a.publisher || "—"}</td>
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
