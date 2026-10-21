#!/usr/bin/env node
/**
 * Ajoute un en-tête de copyright aux fichiers sources FasoFree versionnés.
 *
 * - Idempotent : un fichier déjà marqué n'est pas retouché.
 * - Ne touche QUE les fichiers suivis par git : les scripts locaux non
 *   versionnés (fichiers de travail temporaires) sont ignorés.
 * - Conserve un éventuel shebang (#!) et le BOM UTF-8.
 * - Respecte les fins de ligne d'origine (LF / CRLF).
 * - Cible .ts/.tsx/.js/.jsx/.mjs/.cjs des packages FasoFree,
 *   en ignorant node_modules, dist, build, coverage, .git.
 *
 * Usage : node tools/add-copyright-headers.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const COPYRIGHT_HOLDER = 'BIDIGA Imrane';
const COPYRIGHT_YEAR = '2026';

const TARGET_DIRS = [
  'fasofree-backend',
  'fasofree-frontend',
  'fasofree-frontend-client',
  'tools',
];

const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.vite']);

const dryRun = process.argv.includes('--dry-run');

// Fichiers versionnés uniquement (git) : le code distribue, pas le travail local.
const TRACKED = new Set(
  execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .map((p) => p.replace(/\\/g, '/').trim())
    .filter(Boolean)
);

function makeHeader(eol) {
  return (
    `/**${eol}` +
    ` * Copyright (c) ${COPYRIGHT_YEAR} ${COPYRIGHT_HOLDER} - FasoFree. All rights reserved.${eol}` +
    ` * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.${eol}` +
    ` */${eol}${eol}`
  );
}

function collectFiles(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out);
    } else if (EXTS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

let added = 0;
let alreadyMarked = 0;
let notTracked = 0;

for (const target of TARGET_DIRS) {
  const base = path.join(ROOT, target);
  if (!fs.existsSync(base)) continue;
  for (const file of collectFiles(base)) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (!TRACKED.has(rel)) {
      notTracked++;
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    // Détection d'un en-tête existant : on ne regarde que le début du fichier.
    if (/Copyright|rights reserved/i.test(content.slice(0, 600))) {
      alreadyMarked++;
      continue;
    }

    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const BOM = '\uFEFF';
    let out;
    if (content.startsWith(BOM)) {
      out = BOM + makeHeader(eol) + content.slice(BOM.length);
    } else if (content.startsWith('#!')) {
      const newline = content.indexOf('\n');
      out = content.slice(0, newline + 1) + '\n' + makeHeader(eol) + content.slice(newline + 1);
    } else {
      out = makeHeader(eol) + content;
    }

    if (!dryRun) fs.writeFileSync(file, out, 'utf8');
    added++;
  }
}

console.log(
  `[copyright] ${dryRun ? '(dry-run) ' : ''}en-tetes ajoutes : ${added} - ` +
    `deja marques : ${alreadyMarked} - non versionnes (ignores) : ${notTracked}`
);
