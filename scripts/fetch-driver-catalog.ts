#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import { tmpdir } from 'node:os';
import { XMLParser } from 'fast-xml-parser';
// @ts-expect-error — `cab` ships without types
import * as cab from 'cab';
import { normalizeCatalogXml } from './lib/dell-catalog-normalize.js';

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
  return new Promise((resolve, reject) => {
    cab.extract(cabPath, (err: Error | null, files: { name: string; data: Buffer }[]) => {
      if (err) return reject(err);
      const xmlEntry = files.find((f) => /\.xml$/i.test(f.name));
      if (!xmlEntry) return reject(new Error('No XML file found inside CAB'));
      // CatalogPC.xml ships as UTF-16 LE
      resolve(xmlEntry.data.toString('utf16le'));
    });
  });
}

async function main() {
  const tmpCab = path.join(tmpdir(), `CatalogPC-${Date.now()}.cab`);
  console.log(`Downloading ${CATALOG_URL} → ${tmpCab}`);
  await downloadToFile(CATALOG_URL, tmpCab);

  console.log('Extracting XML from CAB');
  const xml = await extractXmlFromCab(tmpCab);
  fs.unlinkSync(tmpCab);

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
}

main().catch((err) => {
  console.error('fetch-driver-catalog failed:', err.message);
  console.error('Existing files (if any) left untouched.');
  process.exit(1);
});
