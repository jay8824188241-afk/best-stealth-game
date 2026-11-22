// Lantern Thief — the program that hands the game in (Node 22, stdlib only).
// It copies game/ and screenshots/ beside this file into the output
// directory and writes /output/dossier.json with the vendored make.fun
// library, so the scorer can read the game and its screenshots.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (Inside the grader's container MAKEFUN_OUTPUT_DIR is unset and /output
// is used instead.)

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_SHOT_BYTES = 256 * 1024;

function shotReport(dir) {
  const names = readdirSync(dir)
    .filter((n) => /\.(png|jpe?g)$/i.test(n) && !n.startsWith('.'))
    .sort();
  return names.map((n) => ({ name: n, bytes: statSync(join(dir, n)).size }));
}

mkdirSync(outDir, { recursive: true });

// The entry is tied to its owner's wallet; refuse to hand in a repo that
// lost its owner file instead of producing a dossier for nobody.
const ownerPath = join(here, '.makefun', 'owner.json');
if (!existsSync(ownerPath)) {
  throw new Error('.makefun/owner.json: missing — the entry has no owner wallet');
}
const owner = JSON.parse(readFileSync(ownerPath, 'utf-8'));
if (typeof owner.wallet !== 'string' || owner.wallet.length === 0) {
  throw new Error('.makefun/owner.json: no wallet field — the entry has no owner wallet');
}

cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });

const shotsIn = join(here, 'screenshots');
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsIn)) cpSync(shotsIn, join(outDir, 'screenshots'), { recursive: true });

const shots = shotReport(join(outDir, 'screenshots'));
for (const s of shots) {
  if (s.bytes > MAX_SHOT_BYTES) {
    throw new Error(`screenshots/${s.name}: ${s.bytes} bytes, over the 256 KiB cap`);
  }
}

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`dossier written to ${join(outDir, 'dossier.json')}`);
console.log(`screenshots (${shots.length}): ${shots.map((s) => `${s.name} ${s.bytes}B`).join(', ')}`);
console.log(`owner wallet: ${owner.wallet.slice(0, 4)}…${owner.wallet.slice(-4)}`);
