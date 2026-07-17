// v0.38.4 (Initiative 28): fetch the standalone 7-Zip reduced console binary (7zr.exe) into
// packages/desktop/bin so the Windows package can bundle it as an extraResource. 7-Zip's own
// installer does NOT add itself to PATH, so a stock Windows machine commonly fails to unpack the
// 8.19 GB 整合包 even with 7-Zip "installed" — shipping this ~600 KB LGPL extractor removes that
// failure mode entirely. Idempotent (skips when the pinned file is already present); sha256-pinned
// so a changed/MITM'd binary is rejected loudly (re-pin here if 7-Zip publishes a new 7zr.exe).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const URL = 'https://www.7-zip.org/a/7zr.exe';
const SHA256 = '56b8cc9f4971cef253644fafe54063ed7fdca551d4dee0f8c6baa81b855acd72'; // 7zr.exe 24.09-era, 602112 bytes
const OUT = join(import.meta.dir, '..', 'bin', '7zr.exe');

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

if (existsSync(OUT) && sha256(readFileSync(OUT)) === SHA256) {
  console.log('[fetch-7zr] bin/7zr.exe already present + verified — skipping');
  process.exit(0);
}

console.log(`[fetch-7zr] downloading ${URL}…`);
const res = await fetch(URL);
if (!res.ok) {
  console.error(`[fetch-7zr] download failed: HTTP ${res.status}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
const got = sha256(buf);
if (got !== SHA256) {
  console.error(`[fetch-7zr] sha256 mismatch — refusing to bundle.\n  expected ${SHA256}\n  got      ${got}`);
  process.exit(1);
}
mkdirSync(join(import.meta.dir, '..', 'bin'), { recursive: true });
writeFileSync(OUT, buf);
console.log(`[fetch-7zr] wrote ${OUT} (${buf.length} bytes, sha256 ✓)`);
