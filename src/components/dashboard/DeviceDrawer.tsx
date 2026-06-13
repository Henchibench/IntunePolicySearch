import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { ManagedDevice } from "@/types/managedDevice";
import { useDeviceDeepDetails } from "@/hooks/useDeviceDeepDetails";
import { DeviceDeepDetails } from "./DeviceDeepDetails";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

interface DeviceDrawerProps {
  device: ManagedDevice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const intunePortalUrl = (id: string) =>
  `https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/overview/mdmDeviceId/${id}`;

export function DeviceDrawer({ device, open, onOpenChange }: DeviceDrawerProps) {
  const { dashboardService } = useAuth();
  const { details, isLoading, error, load, reset } = useDeviceDeepDetails(dashboardService);

  // Reset deep details whenever the drawer is closed or the selected device changes.
  useEffect(() => {
    reset();
  }, [device?.id, reset]);

  if (!device) return null;

  const compliancePillClass =
    device.complianceState === "compliant"
      ? "inline-flex items-center rounded-md bg-success/10 px-3 py-1 text-[11.5px] font-semibold text-success"
      : device.complianceState === "noncompliant"
      ? "inline-flex items-center rounded-md bg-destructive/10 px-3 py-1 text-[11.5px] font-semibold text-destructive"
      : device.complianceState === "inGracePeriod"
      ? "inline-flex items-center rounded-md bg-warning/10 px-3 py-1 text-[11.5px] font-semibold text-warning"
      : "inline-flex items-center rounded-md bg-muted px-3 py-1 text-[11.5px] font-semibold text-foreground";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[760px] max-w-[92vw] sm:max-w-none border-l border-border bg-card p-7 shadow-drawer-light dark:shadow-drawer flex flex-col"
      >
        {/* Header */}
        <div>
          <EyebrowLabel>Device</EyebrowLabel>
          <h2 className="mt-1.5 text-[24px] font-semibold leading-tight text-ink">
            {device.deviceName}
          </h2>
          <p className="mt-1 text-[13px] text-slate">
            {device.userDisplayName || device.userPrincipalName || "—"}
          </p>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {/* Compliance state pill */}
            <span className={compliancePillClass}>
              {device.complianceState}
            </span>
            {/* OS + version pill */}
            <span className="inline-flex items-center rounded-md bg-muted px-3 py-1 text-[11.5px] font-semibold text-foreground">
              {device.operatingSystem}
              {device.osVersion ? ` · ${device.osVersion}` : ""}
            </span>
            {/* Ownership pill */}
            <span className="inline-flex items-center rounded-md bg-primary/10 px-3 py-1 text-[11.5px] font-semibold text-link">
              {device.managedDeviceOwnerType ?? "Unknown"}
            </span>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="mt-6 space-y-4 text-sm overflow-y-auto flex-1 min-h-0">
          <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
            <dt className="text-muted-foreground">Last sync</dt>
            <dd className="col-span-2">{device.lastSyncDateTime ? new Date(device.lastSyncDateTime).toLocaleString() : "—"}</dd>

            <dt className="text-muted-foreground">Enrolled</dt>
            <dd className="col-span-2">{device.enrolledDateTime ? new Date(device.enrolledDateTime).toLocaleString() : "—"}</dd>

            <dt className="text-muted-foreground">Manufacturer</dt>
            <dd className="col-span-2">{device.manufacturer || "—"}</dd>

            <dt className="text-muted-foreground">Model</dt>
            <dd className="col-span-2">{device.model || "—"}</dd>
          </dl>

          <hr />

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
              Failed to load: {error}
              <Button onClick={() => load(device.id, device.userPrincipalName)} variant="link" size="sm" className="ml-2">
                Retry
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading deep details…
            </div>
          )}

          {details && <DeviceDeepDetails details={details} />}
        </div>

        {/* Pinned bottom CTAs */}
        <div className="mt-auto pt-6 flex flex-wrap gap-3">
          {!details && !isLoading && !error && (
            <Button variant="ink" onClick={() => load(device.id, device.userPrincipalName)}>
              <RefreshCw className="h-4 w-4 mr-2" /> Load deep details
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={intunePortalUrl(device.id)} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Open in Intune
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
