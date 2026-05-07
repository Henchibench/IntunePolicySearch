#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { XMLParser } from 'fast-xml-parser';
import { normalizeCatalogXml } from './lib/dell-catalog-normalize.js';

const execFileAsync = promisify(execFile);

const CATALOG_URL = 'https://downloads.dell.com/catalog/CatalogPC.cab';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const OUT_JSON = path.join(PUBLIC_DIR, 'driver-catalog.json');
const OUT_META = path.join(PUBLIC_DIR, 'driver-catalog.meta.json');

function downloadToFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} fetching ${url}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

async function extractXmlFromCab(cabPath: string): Promise<string> {
  // Uses Windows built-in expand.exe. From WSL, this resolves via the Windows
  // PATH if expand.exe is reachable. On non-Windows hosts, this script will
  // fail with ENOENT; in that case, regenerate `public/driver-catalog.json`
  // manually by running the Electron app's "Sync catalog" button and copying
  // `<userData>/driver-catalog/dell.json` to `public/`.
  const outDir = path.join(tmpdir(), `cab-extract-${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  try {
    await execFileAsync('expand.exe', ['-F:*.xml', cabPath, outDir]);

    const files = fs.readdirSync(outDir);
    const xmlFile = files.find((f) => /\.xml$/i.test(f));
    if (!xmlFile) {
      throw new Error('No XML file found inside CAB after extraction');
    }
    const xmlPath = path.join(outDir, xmlFile);
    // CatalogPC.xml ships as UTF-16 LE
    return fs.readFileSync(xmlPath).toString('utf16le');
  } finally {
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch { /* swallow */ }
  }
}

async function main() {
  const tmpCab = path.join(tmpdir(), `CatalogPC-${Date.now()}.cab`);
  console.log(`Downloading ${CATALOG_URL} → ${tmpCab}`);
  await downloadToFile(CATALOG_URL, tmpCab);

  try {
    console.log('Extracting XML from CAB');
    const xml = await extractXmlFromCab(tmpCab);

    console.log('Parsing XML');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(xml);

    console.log('Normalizing entries');
    const entries = normalizeCatalogXml(parsed, 'Dell Inc.');
    console.log(`Normalized ${entries.length} entries`);

    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    fs.writeFileSync(OUT_JSON, JSON.stringify(entries));
    fs.writeFileSync(
      OUT_META,
      JSON.stringify({
        lastBaked: new Date().toISOString(),
        entryCount: entries.length,
        catalogSource: CATALOG_URL,
      })
    );
    console.log(`Wrote ${OUT_JSON} and ${OUT_META}`);
  } finally {
    fs.rmSync(tmpCab, { force: true });
  }
}

main().catch((err) => {
  console.error('fetch-driver-catalog failed:', err.message);
  console.error('Existing files (if any) left untouched.');
  process.exit(1);
});
