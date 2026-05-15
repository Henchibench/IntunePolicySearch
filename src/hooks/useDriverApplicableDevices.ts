import { useEffect, useRef, useState } from 'react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useAuth } from './useAuth';
import type { DriverApplicableDevice } from '@/types/drivers';
import { zipSchemaValues, type ReportColumn } from '@/lib/reportNormalize';

const REPORT_NAME = 'DriverUpdateDeviceStatusByDriver';
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30_000;

const SELECT_COLUMNS = [
  'DeviceName',
  'UPN',
  'DeviceId',
  'AadDeviceId',
  'CurrentDeviceUpdateSubstateTime',
  'PolicyName',
  'CurrentDeviceUpdateState',
  'CurrentDeviceUpdateSubstate',
  'AggregateState',
  'HighestPriorityAlertSubType',
  'LastWUScanTime',
];

function escapeOData(s: string): string {
  return s.replace(/'/g, "''");
}

export function buildConfigBody(catalogEntryId: string) {
  return {
    id: `${REPORT_NAME}_00000000-0000-0000-0000-000000000001`,
    filter: `CatalogEntryId eq '${escapeOData(catalogEntryId)}'`,
    orderBy: [] as string[],
    select: SELECT_COLUMNS,
    search: '',
    metadata: '',
  };
}

export function buildFetchBody(
  configId: string,
  catalogEntryId: string,
  top: number,
  skip: number
) {
  return {
    id: configId,
    top,
    skip,
    search: '',
    orderBy: [] as string[],
    filter: `CatalogEntryId eq '${escapeOData(catalogEntryId)}'`,
    select: SELECT_COLUMNS,
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

export function toApplicableDevice(row: Record<string, unknown>): DriverApplicableDevice {
  return {
    deviceId: str(row.DeviceId),
    aadDeviceId: str(row.AadDeviceId),
    deviceName: str(row.DeviceName),
    upn: str(row.UPN),
    policyName: str(row.PolicyName),
    aggregateState: str(row.AggregateState_loc) || str(row.AggregateState),
    currentDeviceUpdateState: num(row.CurrentDeviceUpdateState),
    currentDeviceUpdateStateLoc: str(row.CurrentDeviceUpdateState_loc),
    currentDeviceUpdateSubstate: num(row.CurrentDeviceUpdateSubstate),
    currentDeviceUpdateSubstateLoc: str(row.CurrentDeviceUpdateSubstate_loc),
    currentDeviceUpdateSubstateTime: str(row.CurrentDeviceUpdateSubstateTime),
    lastWUScanTime: str(row.LastWUScanTime),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface CachedReportConfig {
  id: string;
  status: 'inProgress' | 'completed' | string;
}

interface CachedReportResponse {
  TotalRowCount: number;
  Schema: ReportColumn[];
  Values: unknown[][];
}

export interface UseDriverApplicableDevicesResult {
  devices: DriverApplicableDevice[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

export function useDriverApplicableDevices(
  catalogEntryId: string | null,
  enabled: boolean
): UseDriverApplicableDevicesResult {
  const { getAccessToken } = useAuth();
  const [devices, setDevices] = useState<DriverApplicableDevice[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const tokenRef = useRef(getAccessToken);
  tokenRef.current = getAccessToken;

  useEffect(() => {
    if (!enabled || !catalogEntryId) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      setDevices([]);
      setTotalCount(0);

      try {
        const client = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => await tokenRef.current() },
        });

        // Phase 1: configure
        const configBody = buildConfigBody(catalogEntryId);
        const phase1: CachedReportConfig = await client
          .api('/deviceManagement/reports/cachedReportConfigurations')
          .version('beta')
          .post(configBody);

        if (cancelled) return;
        const configId = phase1.id ?? configBody.id;

        // Phase 2: poll until completed (or already completed)
        const deadline = Date.now() + POLL_TIMEOUT_MS;
        let status = phase1.status;
        while (status !== 'completed') {
          if (cancelled) return;
          if (Date.now() > deadline) {
            throw new Error('Report generation timed out after 30 seconds');
          }
          await sleep(POLL_INTERVAL_MS);
          if (cancelled) return;
          const poll: CachedReportConfig = await client
            .api(`/deviceManagement/reports/cachedReportConfigurations('${configId}')`)
            .version('beta')
            .get();
          status = poll.status;
        }

        // Phase 3: fetch
        if (cancelled) return;
        const fetchBody = buildFetchBody(configId, catalogEntryId, 50, 0);
        const phase3: CachedReportResponse = await client
          .api('/deviceManagement/reports/getCachedReport')
          .version('beta')
          .post(fetchBody);

        if (cancelled) return;
        const rows = zipSchemaValues(phase3.Schema, phase3.Values);
        setDevices(rows.map(toApplicableDevice));
        setTotalCount(phase3.TotalRowCount);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [catalogEntryId, enabled, retryCount]);

  return {
    devices,
    totalCount,
    isLoading,
    error,
    retry: () => setRetryCount((c) => c + 1),
  };
}
