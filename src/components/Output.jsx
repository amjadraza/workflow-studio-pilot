/* Shows AI output: plain text, with markdown pipe tables turned into real tables. */
import { Fragment } from 'react';

function toBlocks(text) {
  const blocks = [];
  let lines = [], table = null;
  for (const line of text.split('\n')) {
    if (/^\s*\|/.test(line)) {
      if (lines.length) { blocks.push(lines.join('\n') + '\n'); lines = []; }
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim().replace(/\*\*/g, ''));
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue; // the |---| separator row
      if (!table) { table = []; blocks.push(table); }
      table.push(cells);
    } else {
      table = null;
      lines.push(line.replace(/\*\*/g, '').replace(/^#+\s*/, ''));
    }
  }
  if (lines.length) blocks.push(lines.join('\n'));
  return blocks;
}

export default function Output({ text, urdu }) {
  if (!text) return <div className="out"><p className="empty">Nothing yet.</p></div>;
  return (
    <div className={'out' + (urdu ? ' urdu' : '')}>
      {toBlocks(text).map((b, i) => typeof b === 'string' ? <Fragment key={i}>{b}</Fragment> : (
        <table key={i}>
          <tbody>
            {b.map((row, j) => <tr key={j}>{row.map((c, k) => j === 0 ? <th key={k}>{c}</th> : <td key={k}>{c}</td>)}</tr>)}
          </tbody>
        </table>
      ))}
    </div>
  );
}
