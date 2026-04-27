import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ManagedDevice } from "@/types/managedDevice";
import { cn } from "@/lib/utils";
import { EditorialCard } from "@/components/ui/EditorialCard";

interface DeviceTableProps {
  devices: ManagedDevice[];
  selectedDeviceId: string | null;
  onSelect: (id: string) => void;
}

const ROW_HEIGHT = 44;

export function DeviceTable({ devices, selectedDeviceId, onSelect }: DeviceTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: devices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <EditorialCard radius="frame" padding="lg" className="flex flex-col overflow-hidden">
      <div className="sticky top-0 z-10 grid grid-cols-[2fr_1.4fr_1fr_0.8fr_0.8fr] gap-4 border-b border-border bg-lifted py-3 text-[10.5px] font-bold uppercase tracking-eyebrow text-slate">
        <div>Device</div>
        <div>User</div>
        <div>Platform</div>
        <div>Compliance</div>
        <div>Last sync</div>
      </div>
      <div ref={parentRef} className="h-[480px] overflow-auto">
        {devices.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No devices in this group.</div>
        ) : (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const device = devices[virtualRow.index];
              const selected = device.id === selectedDeviceId;
              return (
                <button
                  key={device.id}
                  onClick={() => onSelect(device.id)}
                  className={cn(
                    "absolute left-0 right-0 grid grid-cols-[2fr_1.4fr_1fr_0.8fr_0.8fr] gap-4 border-b border-border/50 px-3 py-3 text-[12.5px] font-[450] text-ink hover:bg-ink/[0.03] cursor-pointer items-center text-left",
                    selected && "bg-accent"
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="truncate">{device.deviceName}</div>
                  <div className="truncate">{device.userDisplayName || device.userPrincipalName || "—"}</div>
                  <div className="truncate">{device.operatingSystem} {device.osVersion}</div>
                  <div>
                    <span className={cn(
                      device.complianceState === "compliant"
                        ? "inline-flex items-center rounded-pill bg-success/15 px-2.5 py-0.5 text-[11px] font-medium text-success"
                        : device.complianceState === "noncompliant" || device.complianceState === "nonCompliant"
                        ? "inline-flex items-center rounded-pill bg-signal/[0.18] px-2.5 py-0.5 text-[11px] font-medium text-signal-light"
                        : device.complianceState === "inGracePeriod"
                        ? "inline-flex items-center rounded-pill bg-signal-light/[0.12] px-2.5 py-0.5 text-[11px] font-medium text-signal-light"
                        : "inline-flex items-center rounded-pill bg-ink/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-ink"
                    )}>
                      {device.complianceState}
                    </span>
                  </div>
                  <div className="truncate">
                    {device.lastSyncDateTime ? new Date(device.lastSyncDateTime).toLocaleString() : "—"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">{devices.length} device(s)</div>
    </EditorialCard>
  );
}
