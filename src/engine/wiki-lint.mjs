import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wikiRoot = path.join(__dirname, '../../docs/wiki');

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk(wikiRoot);
const known = new Set(files.map(f => path.basename(f, '.md')));
const inbound = new Map([...known].map(k => [k, 0]));
const broken = [];

for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  const re = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const target = m[1].trim();
    if (!known.has(target)) broken.push(`${path.basename(f)} -> ${target}`);
    else inbound.set(target, (inbound.get(target) || 0) + 1);
  }
}

const orphans = [...inbound.entries()]
  .filter(([k, v]) => v === 0 && !['index', 'AGENTS', 'log'].includes(k))
  .map(([k]) => k);

console.log(`[wiki:lint] files=${files.length} broken=${broken.length} orphans=${orphans.length}`);
if (broken.length || orphans.length) {
  if (broken.length) console.error('BROKEN LINKS:', broken);
  if (orphans.length) console.error('ORPHAN PAGES:', orphans);
  process.exit(1);
}
