import React from 'react';
import { Link } from 'react-router-dom';

/**
 * 📄 Mini-renderer Markdown (sans dépendance externe).
 *
 * Couvre le sous-ensemble utilisé par les documents légaux du pack :
 * titres #/##/###, paragraphes, listes (* / - / numérotées), cases à cocher
 * `[ ]`, tableaux `| … |`, citations `>`, séparateurs `---`, gras `**…**` et
 * liens `[texte](FR-XXXX-XXX.md)` (transformés en liens internes vers
 * /legal/:docCode).
 *
 * Les placeholders `[●]` / `[?]` sont conservés tels quels (informations à
 * venir de la société).
 */
const MarkdownView = ({ content }) => {
  const blocks = parseBlocks(content || '');

  return (
    <div className="space-y-4 text-sm leading-relaxed text-text-primary">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
};

/* ─── Parsing ─────────────────────────────────────────────────────────────── */

const parseBlocks = (content) => {
  const lines = content.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Séparateur horizontal
    if (/^\s*-{3,}\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    // Titres
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, content: heading[2] });
      i += 1;
      continue;
    }

    // Citation
    if (/^\s*>\s?/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', content: quoteLines.join(' ') });
      continue;
    }

    // Tableau (lignes consécutives commençant par |)
    if (line.trim().startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i += 1;
      }
      blocks.push({ type: 'table', lines: tableLines });
      continue;
    }

    // Cases à cocher `[ ] ...`
    const checkbox = line.match(/^\s*\[\s?\]\s+(.+)$/);
    if (checkbox) {
      const checkboxLines = [checkbox[1]];
      i += 1;
      while (i < lines.length && /^\s*\[\s?\]\s+/.test(lines[i])) {
        checkboxLines.push(lines[i].replace(/^\s*\[\s?\]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'checklist', items: checkboxLines });
      continue;
    }

    // Liste (puces ou numérotée)
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      const items = [bullet[1]];
      i += 1;
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (ordered) {
      const items = [ordered[2]];
      i += 1;
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Paragraphe : accumule les lignes non vides
    if (line.trim() !== '') {
      const paraLines = [line.trim()];
      i += 1;
      while (i < lines.length && lines[i].trim() !== '' && !/^\s*(#|>|\||[-*]|\d+[.)]|\[\s?\])/.test(lines[i])) {
        paraLines.push(lines[i].trim());
        i += 1;
      }
      blocks.push({ type: 'paragraph', content: paraLines.join(' ') });
      continue;
    }

    i += 1; // ligne vide
  }

  return blocks;
};

/* ─── Rendu ───────────────────────────────────────────────────────────────── */

const Block = ({ block }) => {
  switch (block.type) {
    case 'hr':
      return <hr className="border-border-light my-2" />;
    case 'heading': {
      const Tag = `h${block.level}`;
      const sizes = {
        h1: 'text-xl font-display font-bold text-text-primary',
        h2: 'text-lg font-display font-bold text-text-primary',
        h3: 'text-base font-semibold text-text-primary',
      };
      return <Tag className={`${sizes[Tag]} pt-1`}>{renderInline(block.content)}</Tag>;
    }
    case 'quote':
      return (
        <blockquote className="border-l-2 pl-4 italic text-text-secondary" style={{ borderColor: '#C1652E' }}>
          {renderInline(block.content)}
        </blockquote>
      );
    case 'table':
      return <Table lines={block.lines} />;
    case 'checklist':
      return (
        <ul className="space-y-1.5">
          {block.items.map((item, j) => (
            <li key={j} className="flex items-start gap-2">
              <span className="mt-0.5 text-xs text-text-secondary shrink-0">☐</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className={`space-y-1.5 ${block.ordered ? 'list-decimal pl-5' : 'list-disc pl-5'}`}>
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </Tag>
      );
    }
    case 'paragraph':
    default:
      return <p>{renderInline(block.content)}</p>;
  }
};

const Table = ({ lines }) => {
  const rows = lines.map((line) => line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
  // Supprime la ligne de séparation | --- | --- |
  const dataRows = rows.filter((row) => !row.every((cell) => /^-{1,}$/.test(cell)));
  if (dataRows.length === 0) return null;
  const [header, ...body] = dataRows;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {header.map((cell, j) => (
              <th key={j} className="border border-border-medium bg-background-secondary px-3 py-2 text-left font-semibold text-text-primary">
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border border-border-light px-3 py-2 align-top text-text-secondary">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ─── Inline : gras + liens internes ──────────────────────────────────────── */

const renderInline = (text) => {
  const parts = [];
  const regex = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={parts.length} className="font-semibold text-text-primary">{match[1].slice(2, -2)}</strong>);
    } else if (match[2]) {
      const label = match[2].match(/^\[([^\]]+)\]/)[1];
      const href = match[3];
      // Liens vers d'autres documents du pack → route interne /legal/:docCode
      const docMatch = href.match(/^(FR-[A-Z0-9-]+)\.md$/);
      // Allow-list de protocoles : un lien non reconnu ne devient JAMAIS un
      // href exécutable (javascript:, data:… → neutralisé).
      const rawTarget = docMatch ? `/legal/${docMatch[1]}` : href;
      const target = /^(https?:|mailto:|\/|#)/i.test(rawTarget) ? rawTarget : '#';

      parts.push(
        target.startsWith('/legal/') ? (
          // Navigation SPA : les liens croisés du pack restent dans l'app
          // (pas de rechargement complet → le formulaire/document ne perd
          // pas son état).
          <Link
            key={parts.length}
            to={target}
            className="font-medium underline"
            style={{ color: '#C1652E' }}
          >
            {label}
          </Link>
        ) : (
          <a
            key={parts.length}
            href={target}
            className="font-medium underline"
            style={{ color: '#C1652E' }}
          >
            {label}
          </a>
        )
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

export default MarkdownView;