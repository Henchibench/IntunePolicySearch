import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate">{device.deviceName}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
            <dt className="text-muted-foreground">User</dt>
            <dd className="col-span-2">{device.userDisplayName || device.userPrincipalName || "—"}</dd>

            <dt className="text-muted-foreground">Platform</dt>
            <dd className="col-span-2">{device.operatingSystem} {device.osVersion}</dd>

            <dt className="text-muted-foreground">Compliance</dt>
            <dd className="col-span-2">{device.complianceState}</dd>

            <dt className="text-muted-foreground">Last sync</dt>
            <dd className="col-span-2">{device.lastSyncDateTime ? new Date(device.lastSyncDateTime).toLocaleString() : "—"}</dd>

            <dt className="text-muted-foreground">Enrolled</dt>
            <dd className="col-span-2">{device.enrolledDateTime ? new Date(device.enrolledDateTime).toLocaleString() : "—"}</dd>

            <dt className="text-muted-foreground">Owner type</dt>
            <dd className="col-span-2">{device.managedDeviceOwnerType || "—"}</dd>

            <dt className="text-muted-foreground">Manufacturer</dt>
            <dd className="col-span-2">{device.manufacturer || "—"}</dd>

            <dt className="text-muted-foreground">Model</dt>
            <dd className="col-span-2">{device.model || "—"}</dd>
          </dl>

          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={intunePortalUrl(device.id)} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Open in Intune
            </a>
          </Button>

          <hr />

          {!details && !isLoading && !error && (
            <Button onClick={() => load(device.id)} size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Load deep details
            </Button>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading deep details…
            </div>
          )}

          {error && (
            <div className="rounded border border-red-500/50 bg-red-500/10 p-2 text-sm">
              Failed to load: {error}
              <Button onClick={() => load(device.id)} variant="link" size="sm" className="ml-2">
                Retry
              </Button>
            </div>
          )}

          {details && <DeviceDeepDetails details={details} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
