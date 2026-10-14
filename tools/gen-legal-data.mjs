// Script TEMPORAIRE (non commité) : lit docs/legal/*.md et génère
// fasofree-backend/src/modules/legal/data/legal-documents.data.ts
// (le Dockerfile ne copiant pas docs/, le contenu légal est embarqué).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const docsDir = resolve(process.cwd(), 'docs/legal');
const outFile = resolve(
  process.cwd(),
  'fasofree-backend/src/modules/legal/data/legal-documents.data.ts',
);

const files = readdirSync(docsDir).filter((f) => /^FR-.*\.md$/.test(f));
const docs = [];

for (const f of files.sort()) {
  const raw = readFileSync(join(docsDir, f), 'utf8');
  // front-matter YAML minimal entre deux lignes "---"
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`Front-matter introuvable dans ${f}`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z][a-zA-Z0-9]*):\s*(.+)$/);
    if (kv) meta[kv[1].trim()] = kv[2].trim();
  }
  const body = m[2].replace(/\n+$/, '');
  const titleMatch = body.match(/^#\s+(.+)$/m);
  docs.push({
    docCode: meta.doc || f.replace(/\.md$/, ''),
    title: (titleMatch ? titleMatch[1].trim() : meta.doc || f).replace(/\*\*/g, ''),
    version: meta.version || '0.0',
    statut: meta.statut || 'brouillon',
    date: meta.date || '',
    mecanisme: meta.mecanisme || 'case-a-cocher',
    audience: meta.audience || 'tous',
    contentMd: body,
  });
}

const lines = [
  '/**',
  ' * ⚖️ Contenu légal embarqué (GÉNÉRÉ — ne pas éditer à la main).',
  ' * Source : docs/legal/*.md — régénérer avec tools/gen-legal-data.mjs',
  ' * après chaque mise à jour des documents (bump de version inclus).',
  ' */',
  '',
  'export interface LegalDocumentSeed {',
  '  docCode: string;',
  '  title: string;',
  '  version: string;',
  '  statut: string;',
  '  date: string;',
  '  mecanisme: string;',
  '  audience: string;',
  '  contentMd: string;',
  '}',
  '',
  `export const LEGAL_DOCUMENTS_SEED: LegalDocumentSeed[] = ${JSON.stringify(docs, null, 2)};`,
  '',
];

writeFileSync(outFile, lines.join('\n'));
console.log(`✅ ${docs.length} documents générés → ${outFile}`);
console.log(docs.map((d) => `  ${d.docCode} v${d.version} (${d.audience}) — ${d.title}`).join('\n'));