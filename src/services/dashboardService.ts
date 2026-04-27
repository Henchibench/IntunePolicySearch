import { Client } from "@microsoft/microsoft-graph-client";
import { AuthenticationProvider } from "@microsoft/microsoft-graph-client";
import { ManagedDevice, DeviceDeepDetails } from "@/types/managedDevice";
import { graphConfig } from "./authConfig";
import { batchGet } from "./graphBatch";

interface ListResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

const DEVICE_SELECT_FIELDS = [
  "id",
  "deviceName",
  "userPrincipalName",
  "userDisplayName",
  "operatingSystem",
  "osVersion",
  "complianceState",
  "lastSyncDateTime",
  "enrolledDateTime",
  "managedDeviceOwnerType",
  "complianceGracePeriodExpirationDateTime",
  "deviceType",
  "manufacturer",
  "model",
].join(",");

export class DashboardService {
  private client: Client;

  constructor(authProvider: AuthenticationProvider) {
    this.client = Client.initWithMiddleware({ authProvider });
  }

  async getManagedDevices(): Promise<ManagedDevice[]> {
    const all: ManagedDevice[] = [];
    let nextLink: string | undefined =
      `${graphConfig.graphManagedDevicesEndpoint}?$select=${DEVICE_SELECT_FIELDS}`;

    while (nextLink) {
      const response: ListResponse<ManagedDevice> = await this.client.api(nextLink).get();
      all.push(...response.value);
      nextLink = response["@odata.nextLink"];
    }

    console.log(`Fetched ${all.length} managed devices`);
    return all;
  }

  async getDeviceDeepDetails(deviceId: string): Promise<DeviceDeepDetails> {
    const requests = [
      { id: "compliance", relativeUrl: `/deviceManagement/managedDevices/${deviceId}/deviceCompliancePolicyStates` },
      { id: "configuration", relativeUrl: `/deviceManagement/managedDevices/${deviceId}/deviceConfigurationStates` },
      { id: "apps", relativeUrl: `/deviceManagement/managedDevices/${deviceId}/detectedApps` },
    ];

    const responses = await batchGet(this.client, requests);

    const compliance = responses.get("compliance");
    const configuration = responses.get("configuration");
    const apps = responses.get("apps");

    return {
      compliancePolicyStates: compliance?.status === 200 ? compliance.body?.value ?? [] : [],
      configurationStates: configuration?.status === 200 ? configuration.body?.value ?? [] : [],
      detectedApps: apps?.status === 200 ? apps.body?.value ?? [] : [],
    };
  }

  async getNonCompliantPolicyStatesBulk(
    deviceIds: string[]
  ): Promise<Map<string, Array<{ policyDisplayName: string; failingSettings: string[] }>>> {
    // settingStates is a navigation property on deviceCompliancePolicyState — not
    // $expand-able. Two waves: list policy states per device, then fetch
    // settingStates sub-collection per non-compliant policy state.
    const wave1 = deviceIds.map((id, idx) => ({
      id: `d${idx}`,
      relativeUrl: `/deviceManagement/managedDevices/${id}/deviceCompliancePolicyStates`,
    }));
    const wave1Resp = await batchGet(this.client, wave1);

    type PolicyEntry = { deviceId: string; policyStateId: string; displayName: string };
    const nonCompliant: PolicyEntry[] = [];
    const out = new Map<string, Array<{ policyDisplayName: string; failingSettings: string[] }>>();
    deviceIds.forEach((deviceId, idx) => {
      out.set(deviceId, []);
      const resp = wave1Resp.get(`d${idx}`);
      if (resp?.status !== 200) return;
      const policies = (resp.body?.value ?? []) as Array<any>;
      for (const p of policies) {
        if (p.state !== "compliant" && p.state !== "notApplicable") {
          nonCompliant.push({ deviceId, policyStateId: p.id, displayName: p.displayName });
        }
      }
    });

    if (nonCompliant.length === 0) return out;

    const wave2 = nonCompliant.map((entry, idx) => ({
      id: `s${idx}`,
      relativeUrl: `/deviceManagement/managedDevices/${entry.deviceId}/deviceCompliancePolicyStates/${entry.policyStateId}/settingStates`,
    }));
    const wave2Resp = await batchGet(this.client, wave2);

    nonCompliant.forEach((entry, idx) => {
      const resp = wave2Resp.get(`s${idx}`);
      const settings = resp?.status === 200 ? ((resp.body?.value ?? []) as Array<any>) : [];
      const failing = settings
        .filter(s => s.state !== "compliant" && s.state !== "notApplicable")
        .map(s => s.settingName || s.setting)
        .filter(Boolean);
      out.get(entry.deviceId)!.push({
        policyDisplayName: entry.displayName,
        failingSettings: failing,
      });
    });

    return out;
  }
}
