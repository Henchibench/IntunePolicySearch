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
}
