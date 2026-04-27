import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ManagedDevice } from "@/types/managedDevice";
import { cn } from "@/lib/utils";

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
    <div className="rounded-md border bg-card">
      <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-2 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b">
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
                    "absolute left-0 right-0 grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-2 px-3 items-center text-sm hover:bg-accent/50 text-left",
                    selected && "bg-accent"
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="truncate">{device.deviceName}</div>
                  <div className="truncate text-muted-foreground">{device.userDisplayName || device.userPrincipalName || "—"}</div>
                  <div className="truncate">{device.operatingSystem} {device.osVersion}</div>
                  <div className={cn(
                    "truncate",
                    device.complianceState === "compliant" ? "text-emerald-600" :
                    device.complianceState === "noncompliant" ? "text-red-600" :
                    "text-amber-600"
                  )}>
                    {device.complianceState}
                  </div>
                  <div className="truncate text-muted-foreground">
                    {device.lastSyncDateTime ? new Date(device.lastSyncDateTime).toLocaleString() : "—"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground border-t">{devices.length} device(s)</div>
    </div>
  );
}
