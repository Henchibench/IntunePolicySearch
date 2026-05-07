import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import { tmpdir } from 'node:os';
import { app, ipcMain, BrowserWindow } from 'electron';
import { XMLParser } from 'fast-xml-parser';
// @ts-expect-error — `cab` ships without types
import * as cab from 'cab';
import { normalizeCatalogXml } from './lib/dell-catalog-normalize';

const CATALOG_URL = 'https://downloads.dell.com/catalog/CatalogPC.cab';

function getCatalogDir(): string {
  return path.join(app.getPath('userData'), 'driver-catalog');
}

function getEntriesPath(): string {
  return path.join(getCatalogDir(), 'dell.json');
}

function getMetaPath(): string {
  return path.join(getCatalogDir(), 'meta.json');
}

interface SyncedMeta {
  lastSyncedAt: string;
  entryCount: number;
}

function readMeta(): SyncedMeta | null {
  try {
    const raw = fs.readFileSync(getMetaPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getStatus() {
  const meta = readMeta();
  if (meta) {
    return {
      lastSyncedAt: meta.lastSyncedAt,
      entryCount: meta.entryCount,
      source: 'synced' as const,
    };
  }
  return { lastSyncedAt: null, entryCount: 0, source: 'none' as const };
}

function getEntries(): unknown[] {
  try {
    return JSON.parse(fs.readFileSync(getEntriesPath(), 'utf-8'));
  } catch {
    return [];
  }
}

function downloadWithProgress(
  url: string,
  dest: string,
  onProgress: (bytesReceived: number, totalBytes: number | null) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} fetching ${url}`));
          return;
        }
        const totalBytes = response.headers['content-length']
          ? parseInt(response.headers['content-length'], 10)
          : null;
        let bytesReceived = 0;
        response.on('data', (chunk: Buffer) => {
          bytesReceived += chunk.length;
          onProgress(bytesReceived, totalBytes);
        });
        response.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

async function extractXml(cabPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cab.extract(cabPath, (err: Error | null, files: { name: string; data: Buffer }[]) => {
      if (err) return reject(err);
      const xmlEntry = files.find((f) => /\.xml$/i.test(f.name));
      if (!xmlEntry) return reject(new Error('No XML file found inside CAB'));
      resolve(xmlEntry.data.toString('utf16le'));
    });
  });
}

async function syncCatalog(window: BrowserWindow | null) {
  fs.mkdirSync(getCatalogDir(), { recursive: true });
  const tmpCab = path.join(tmpdir(), `CatalogPC-${Date.now()}.cab`);

  try {
    await downloadWithProgress(CATALOG_URL, tmpCab, (bytesReceived, totalBytes) => {
      window?.webContents.send('driver-catalog:sync-progress', { bytesReceived, totalBytes });
    });

    const xml = await extractXml(tmpCab);

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(xml);
    const entries = normalizeCatalogXml(parsed, 'Dell Inc.');

    const meta: SyncedMeta = {
      lastSyncedAt: new Date().toISOString(),
      entryCount: entries.length,
    };
    fs.writeFileSync(getEntriesPath(), JSON.stringify(entries));
    fs.writeFileSync(getMetaPath(), JSON.stringify(meta));

    return {
      lastSyncedAt: meta.lastSyncedAt,
      entryCount: meta.entryCount,
      source: 'synced' as const,
    };
  } finally {
    fs.rmSync(tmpCab, { force: true });
  }
}

export function registerDriverCatalogIpc() {
  ipcMain.handle('driver-catalog:get-status', () => getStatus());
  ipcMain.handle('driver-catalog:get-entries', () => getEntries());
  ipcMain.handle('driver-catalog:sync', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return syncCatalog(window);
  });
}
