import React from 'react';
import { Link } from 'react-router-dom';

/**
 * 📄 Mini-renderer Markdown (sans dépendance) — sous-ensemble des documents
 * légaux : titres, paragraphes, listes, cases à cocher `[ ]`, tableaux,
 * citations, séparateurs, gras et liens internes /legal/:docCode.
 *
 * Placeholders `[●]` / `[?]` conservés tels quels.
 */
const MarkdownView = ({ content, accentColor = '#C1652E' }) => {
  const blocks = parseBlocks(content || '');
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      {blocks.map((block, i) => (
        <Block key={i} block={block} accentColor={accentColor} />
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

    if (/^\s*-{3,}\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, content: heading[2] });
      i += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', content: quoteLines.join(' ') });
      continue;
    }

    if (line.trim().startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i += 1;
      }
      blocks.push({ type: 'table', lines: tableLines });
      continue;
    }

    const checkbox = line.match(/^\s*\[\s?\]\s+(.+)$/);
    if (checkbox) {
      const items = [checkbox[1]];
      i += 1;
      while (i < lines.length && /^\s*\[\s?\]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\[\s?\]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'checklist', items });
      continue;
    }

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

    if (line.trim() !== '') {
      const paraLines = [line.trim()];
      i += 1;
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !/^\s*(#|>|\||[-*]|\d+[.)]|\[\s?\])/.test(lines[i])
      ) {
        paraLines.push(lines[i].trim());
        i += 1;
      }
      blocks.push({ type: 'paragraph', content: paraLines.join(' ') });
      continue;
    }

    i += 1;
  }
  return blocks;
};

/* ─── Rendu ───────────────────────────────────────────────────────────────── */

const Block = ({ block, accentColor }) => {
  switch (block.type) {
    case 'hr':
      return <hr className="my-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />;
    case 'heading': {
      const Tag = `h${block.level}`;
      const sizes = {
        h1: 'text-xl font-bold',
        h2: 'text-lg font-bold',
        h3: 'text-base font-semibold',
      };
      return <Tag className={`${sizes[Tag]} pt-1`}>{renderInline(block.content, accentColor)}</Tag>;
    }
    case 'quote':
      return (
        <blockquote className="border-l-2 pl-4 italic" style={{ borderColor: accentColor, opacity: 0.85 }}>
          {renderInline(block.content, accentColor)}
        </blockquote>
      );
    case 'table':
      return <Table lines={block.lines} accentColor={accentColor} />;
    case 'checklist':
      return (
        <ul className="space-y-1.5" style={{ listStyle: 'none', paddingLeft: 4 }}>
          {block.items.map((item, j) => (
            <li key={j} className="flex items-start gap-2">
              <span className="mt-0.5 text-xs shrink-0" style={{ opacity: 0.55 }}>☐</span>
              <span>{renderInline(item, accentColor)}</span>
            </li>
          ))}
        </ul>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className={`space-y-1.5 ${block.ordered ? 'list-decimal pl-5' : 'list-disc pl-5'}`}>
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item, accentColor)}</li>
          ))}
        </Tag>
      );
    }
    case 'paragraph':
    default:
      return <p>{renderInline(block.content, accentColor)}</p>;
  }
};

const Table = ({ lines, accentColor }) => {
  const rows = lines.map((line) =>
    line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()),
  );
  const dataRows = rows.filter((row) => !row.every((cell) => /^-{1,}$/.test(cell)));
  if (dataRows.length === 0) return null;
  const [header, ...body] = dataRows;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {header.map((cell, j) => (
              <th key={j} className="border px-3 py-2 text-left font-semibold"
                  style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
                {renderInline(cell, accentColor)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border px-3 py-2 align-top"
                    style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  {renderInline(cell, accentColor)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const renderInline = (text, accentColor) => {
  const parts = [];
  const regex = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1]) {
      parts.push(<strong key={parts.length} className="font-semibold">{match[1].slice(2, -2)}</strong>);
    } else if (match[2]) {
      const label = match[2].match(/^\[([^\]]+)\]/)[1];
      const href = match[3];
      const docMatch = href.match(/^(FR-[A-Z0-9-]+)\.md$/);
      // Allow-list de protocoles : un lien non reconnu ne devient JAMAIS un
      // href exécutable (javascript:, data:… → neutralisé).
      const rawTarget = docMatch ? `/legal/${docMatch[1]}` : href;
      const target = /^(https?:|mailto:|\/|#)/i.test(rawTarget) ? rawTarget : '#';
      parts.push(
        target.startsWith('/legal/') ? (
          // Navigation SPA : les liens croisés du pack restent dans l'app
          // (pas de rechargement complet → pas de perte du scroll/état).
          <Link
            key={parts.length}
            to={target}
            className="font-medium underline"
            style={{ color: accentColor }}
          >
            {label}
          </Link>
        ) : (
          <a
            key={parts.length}
            href={target}
            className="font-medium underline"
            style={{ color: accentColor }}
          >
            {label}
          </a>
        ),
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
};

export default MarkdownView;