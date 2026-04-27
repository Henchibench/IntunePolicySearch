import { Client } from "@microsoft/microsoft-graph-client";

export interface BatchSubRequest {
  id: string;
  relativeUrl: string;
}

export interface BatchSubResponse {
  status: number;
  body: any;
}

/**
 * Send GET requests via Microsoft Graph $batch (max 20 per call).
 * Handles 429/503 with Retry-After per sub-response. SDK auto-retry does NOT
 * apply to batched sub-requests, per Microsoft Learn throttling guidance.
 */
export async function batchGet(
  client: Client,
  requests: BatchSubRequest[],
  version: "beta" | "v1.0" = "beta"
): Promise<Map<string, BatchSubResponse>> {
  const results = new Map<string, BatchSubResponse>();
  const CHUNK_SIZE = 20;
  const MAX_RETRIES = 3;
  const batchEndpoint = `https://graph.microsoft.com/${version}/$batch`;

  for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
    let pending = requests.slice(i, i + CHUNK_SIZE);

    for (let attempt = 0; attempt <= MAX_RETRIES && pending.length > 0; attempt++) {
      const batchBody = {
        requests: pending.map(r => ({ id: r.id, method: "GET", url: r.relativeUrl })),
      };

      let batchResponse: any;
      try {
        batchResponse = await client.api(batchEndpoint).post(batchBody);
      } catch (err) {
        console.warn("Batch request failed entirely:", err);
        for (const r of pending) {
          if (!results.has(r.id)) results.set(r.id, { status: 0, body: null });
        }
        pending = [];
        break;
      }

      const responses: any[] = batchResponse?.responses || [];
      const retry: typeof pending = [];
      let waitSeconds = 0;

      for (const resp of responses) {
        const orig = pending.find(r => r.id === resp.id);
        if (!orig) continue;
        if (resp.status === 429 || resp.status === 503) {
          const retryAfter = resp.headers?.["Retry-After"] ?? resp.headers?.["retry-after"];
          const ra = parseInt(retryAfter ?? "5", 10);
          waitSeconds = Math.max(waitSeconds, isNaN(ra) ? 5 : ra);
          retry.push(orig);
        } else {
          results.set(resp.id, { status: resp.status, body: resp.body });
        }
      }

      pending = retry;
      if (pending.length > 0 && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, Math.max(waitSeconds, 1) * 1000));
      }
    }

    for (const r of pending) {
      if (!results.has(r.id)) results.set(r.id, { status: 429, body: null });
    }
  }

  return results;
}
