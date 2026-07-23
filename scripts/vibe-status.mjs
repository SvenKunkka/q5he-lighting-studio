import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const status = process.argv[2];
const valid = new Set(['busy', 'done', 'allow', 'idle']);

if (!valid.has(status)) {
  console.error('Usage: node scripts/vibe-status.mjs busy|done|allow|idle');
  process.exit(1);
}

const target = resolve('public/vibe-status.json');
writeFileSync(target, JSON.stringify({ status, seq: Date.now() }) + '\n');
console.log(`vibe-status=${status}`);
