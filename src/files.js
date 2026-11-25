/* Reading uploads (PDF, Word, text, Excel, CSV) and saving Excel files. Libraries load only when needed. */
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const ext = file => (file.name.split('.').pop() || '').toLowerCase();

export async function readDocument(file) {
  const e = ext(file);
  if (['txt', 'md', 'text'].includes(e) || file.type.startsWith('text/')) return (await file.text()).trim();
  if (e === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      pages.push(content.items.map(it => it.str + (it.hasEOL ? '\n' : '')).join(''));
    }
    return pages.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  if (e === 'docx') {
    const mammoth = (await import('mammoth/mammoth.browser.js')).default;
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value.trim();
  }
  throw new Error(`"${file.name}": use PDF, Word (.docx) or text files.`);
}

/* Returns the rows of the first non-empty sheet, as arrays of cell strings. */
export async function readSheet(file) {
  const XLSX = await import('xlsx');
  const wb = ext(file) === 'csv'
    ? XLSX.read((await file.text()).replace(/^﻿/, ''), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { cellDates: true });
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, dateNF: 'yyyy-mm-dd hh:mm', defval: '' })
      .filter(r => r.some(c => String(c).trim()));
    if (rows.length > 1) return rows;
  }
  return [];
}

export async function saveSheet(name, rows, sheetName) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = rows[0].map((_, i) => ({ wch: Math.min(80, Math.max(...rows.map(r => String(r[i] ?? '').length)) + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, name + '.xlsx');
}
