// Exports de la gestion de l'église, aux deux modèles validés sur le canevas :
//  - Excel : bandeau bleu nuit avec le logo blanc, filet doré, chiffres clés,
//    tableau à en-têtes marine (filtres, lignes alternées), ligne de total ;
//  - PDF (A4) : papier à en-tête (logo couleur, coordonnées), titre et chiffres,
//    tableau paginé (en-tête répété), pied de page « Page x sur n ».
// Un même « rapport » décrit le contenu ; chaque format le met en page.
const path = require('path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const LOGO_BLANC = path.join(ASSETS, 'logo-blanc.png');
const LOGO_COULEUR = path.join(ASSETS, 'logo-couleur.png');
const FONTS = {
  regular: path.join(ASSETS, 'fonts', 'manrope-latin-400-normal.woff'),
  semibold: path.join(ASSETS, 'fonts', 'manrope-latin-600-normal.woff'),
  bold: path.join(ASSETS, 'fonts', 'manrope-latin-800-normal.woff'),
  slab: path.join(ASSETS, 'fonts', 'zilla-slab-latin-700-normal.woff'),
};

const CHURCH = "Maison d'Adoration pour les Nations";
const ADDRESS = '2094, avenue Kapenda, Lubumbashi — +243 970 679 649 — maisondadoration@gmail.com';
const C = {
  nuit: '#0A1B33', marine: '#173E6F', or: '#E4BE05', clair: '#F3F6FA', zebre: '#F6F8FB',
  trait: '#DCE3EC', texte: '#1D2B40', doux: '#4A6285', bleuClair: '#C9D6E8',
};
const argb = (hex) => `FF${hex.slice(1).toUpperCase()}`;
const TZ = 'Africa/Lubumbashi';

/**
 * Un rapport :
 * {
 *   title, subtitle, docLabel,             // ex. « Inscrits : Nuit de louange », « Dimanche 6 décembre… », « LISTE D'ÉMARGEMENT »
 *   filename,                              // sans extension
 *   kpis: [{ label, value, note? }],       // 4 au plus
 *   columns: [{ header, key, width, type?: 'text'|'number'|'money'|'date'|'datetime'|'check'|'signature',
 *               align?, pdf?: false|number (poids de largeur), xlsx?: false }],
 *   rows: [{...}],
 *   total?: { label, values: { key: valeur } },
 *   extraSheets?: [{ name, title, columns, rows }],   // Excel seulement (ex. « Annulés »)
 *   landscape?: boolean                   // PDF ; par défaut : paysage au-delà de 5 colonnes
 * }
 */

const exportedAt = () => {
  const now = new Date();
  return {
    date: now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }),
    short: now.toLocaleDateString('fr-FR', { timeZone: TZ }),
    time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).replace(':', 'h'),
  };
};

const fmtCell = (v, type) => {
  if (v === null || v === undefined || v === '') return '';
  if (type === 'date') return new Date(v).toLocaleDateString('fr-FR', { timeZone: TZ });
  if (type === 'datetime') return new Date(v).toLocaleString('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  if (type === 'money') return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (type === 'number') return Number(v).toLocaleString('fr-FR');
  return String(v);
};
const isRight = (c) => c.align === 'right' || (!c.align && ['number', 'money'].includes(c.type));
const isCenter = (c) => c.align === 'center' || (!c.align && c.type === 'check');

/* ======================================================================
 * Excel
 * ==================================================================== */

function excelSheet(wb, { name, title, subtitle, docLabel, kpis = [], columns, rows, total }) {
  const cols = columns.filter((c) => c.xlsx !== false && c.type !== 'signature');
  const ws = wb.addWorksheet(name.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 8, showGridLines: false }],
    pageSetup: {
      orientation: cols.length > 5 ? 'landscape' : 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.55, header: 0.25, footer: 0.25 },
    },
    headerFooter: { oddFooter: `&L&8${CHURCH} — ${title.replace(/&/g, '&&')}&R&8Page &P sur &N` },
  });
  // Colonne A : marge du papier à en-tête, qui porte le logo. Le tableau commence en B.
  const first = 2;
  const last = first + cols.length - 1;
  ws.getColumn(1).width = 11;
  cols.forEach((c, i) => (ws.getColumn(first + i).width = c.width || 16));
  const font = (o = {}) => ({ name: 'Calibri', size: 11, color: { argb: argb(C.texte) }, ...o });
  const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } });

  // Lignes 1–3 : bandeau bleu nuit
  [26, 30, 24].forEach((h, i) => (ws.getRow(i + 1).height = h));
  for (let r = 1; r <= 3; r++) for (let c = 1; c <= last; c++) ws.getCell(r, c).fill = fill(C.nuit);
  const textEnd = Math.max(first, last - 1);
  const band = (row, value, f) => {
    if (textEnd > first) ws.mergeCells(row, first, row, textEnd);
    const cell = ws.getCell(row, first);
    cell.value = value;
    cell.font = f;
    cell.alignment = { vertical: 'middle' };
  };
  band(1, CHURCH.toUpperCase(), font({ size: 10, bold: true, color: { argb: argb(C.or) } }));
  band(2, title, font({ size: 17, bold: true, color: { argb: 'FFFFFFFF' } }));
  band(3, subtitle || '', font({ size: 10, color: { argb: argb(C.bleuClair) } }));
  const at = exportedAt();
  ws.mergeCells(1, last, 3, last);
  const d = ws.getCell(1, last);
  d.value = `${docLabel ? `${docLabel}\n` : ''}Exporté le ${at.short}\nà ${at.time}`;
  d.font = font({ size: 9, color: { argb: argb(C.bleuClair) } });
  d.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
  const logo = wb.addImage({ filename: LOGO_BLANC, extension: 'png' });
  ws.addImage(logo, { tl: { col: 0.18, row: 0.12 }, ext: { width: 56, height: 64 } });

  // Ligne 4 : filet doré ; 5 : respiration
  ws.getRow(4).height = 4;
  for (let c = 1; c <= last; c++) ws.getCell(4, c).fill = fill(C.or);
  ws.getRow(5).height = 8;

  // Ligne 6 : chiffres clés, répartis sur la largeur du tableau
  ws.getRow(6).height = 40;
  if (kpis.length) {
    const n = Math.min(kpis.length, cols.length);
    const per = Math.floor(cols.length / n);
    let start = first;
    kpis.slice(0, n).forEach((k, i) => {
      const end = i === n - 1 ? last : start + per - 1;
      if (end > start) ws.mergeCells(6, start, 6, end);
      const cell = ws.getCell(6, start);
      cell.value = {
        richText: [
          { text: `${k.label}\n`, font: font({ size: 9, color: { argb: argb(C.doux) } }) },
          { text: String(k.value), font: font({ size: 15, bold: true, color: { argb: argb(C.nuit) } }) },
          ...(k.note ? [{ text: `  ${k.note}`, font: font({ size: 9, color: { argb: argb(C.doux) } }) }] : []),
        ],
      };
      cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
      for (let c = start; c <= end; c++) {
        ws.getCell(6, c).fill = fill(C.clair);
        ws.getCell(6, c).border = c === end && i < n - 1 ? { right: { style: 'thick', color: { argb: 'FFFFFFFF' } } } : {};
      }
      start = end + 1;
    });
  }
  ws.getRow(7).height = 8;

  // Ligne 8 : en-têtes
  const head = ws.getRow(8);
  head.height = 24;
  cols.forEach((c, i) => {
    const cell = head.getCell(first + i);
    cell.value = c.header;
    cell.font = font({ size: 10, bold: true, color: { argb: 'FFFFFFFF' } });
    cell.fill = fill(C.marine);
    cell.alignment = { vertical: 'middle', horizontal: isRight(c) ? 'right' : isCenter(c) ? 'center' : 'left', indent: isCenter(c) ? 0 : 1 };
  });

  const NUMFMT = { date: 'dd/mm/yyyy', datetime: 'dd/mm/yyyy hh:mm', number: '#,##0', money: '#,##0.00' };
  rows.forEach((r, idx) => {
    const row = ws.getRow(9 + idx);
    row.height = 20;
    cols.forEach((c, i) => {
      const cell = row.getCell(first + i);
      let v = r[c.key];
      if (c.type === 'check') v = v ? '✔' : '☐';
      else if ((c.type === 'date' || c.type === 'datetime') && v) v = new Date(v);
      else if (v === undefined || v === null) v = '';
      // Valeur texte : un « =… » saisi par un visiteur n'est jamais exécuté comme formule.
      cell.value = v;
      if (NUMFMT[c.type]) cell.numFmt = NUMFMT[c.type];
      cell.font = font({ size: 10, bold: Boolean(c.bold), color: { argb: argb(c.bold ? C.nuit : c.type === 'check' ? C.doux : C.texte) } });
      cell.alignment = { vertical: 'middle', horizontal: isRight(c) ? 'right' : isCenter(c) ? 'center' : 'left', indent: isCenter(c) ? 0 : 1 };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE1E6EC' } } };
      if (idx % 2 === 1) cell.fill = fill(C.clair);
    });
  });
  let end = 8 + rows.length;
  if (!rows.length) {
    ws.mergeCells(9, first, 9, last);
    const c = ws.getCell(9, first);
    c.value = 'Aucune ligne à exporter.';
    c.font = font({ size: 10, italic: true, color: { argb: argb(C.doux) } });
    c.alignment = { indent: 1, vertical: 'middle' };
    ws.getRow(9).height = 22;
    end = 9;
  }
  if (total && rows.length) {
    const row = ws.getRow(end + 1);
    row.height = 22;
    cols.forEach((c, i) => {
      const cell = row.getCell(first + i);
      cell.border = { top: { style: 'medium', color: { argb: argb(C.or) } } };
      cell.font = font({ size: 10, bold: true, color: { argb: argb(C.nuit) } });
      if (i === 0) cell.value = total.label;
      if (total.values[c.key] !== undefined) {
        cell.value = total.values[c.key];
        if (NUMFMT[c.type]) cell.numFmt = NUMFMT[c.type];
        cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
      } else cell.alignment = { vertical: 'middle', indent: 1 };
    });
  }
  if (rows.length) ws.autoFilter = { from: { row: 8, column: first }, to: { row: 8 + rows.length, column: last } };
  ws.pageSetup.printTitlesRow = '8:8';
  return ws;
}

async function buildXlsx(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = CHURCH;
  wb.created = new Date();
  excelSheet(wb, { name: report.sheet || 'Export', ...report });
  for (const extra of report.extraSheets || []) {
    excelSheet(wb, { ...report, kpis: [], total: null, ...extra, name: extra.name });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ======================================================================
 * PDF
 * ==================================================================== */

function buildPdf(report) {
  const cols = report.columns.filter((c) => c.pdf !== false);
  const landscape = report.landscape ?? cols.length > 5;
  const doc = new PDFDocument({
    size: 'A4', layout: landscape ? 'landscape' : 'portrait', bufferPages: true,
    margins: { top: 33, bottom: 27, left: 36, right: 36 },
    info: { Title: report.title, Author: CHURCH, Creator: CHURCH },
  });
  doc.registerFont('R', FONTS.regular);
  doc.registerFont('S', FONTS.semibold);
  doc.registerFont('B', FONTS.bold);
  doc.registerFont('Z', FONTS.slab);

  const W = doc.page.width;
  const H = doc.page.height;
  const L = 36;
  const R = W - 36;
  const FOOT = H - 27 - 18; // haut du pied de page
  const at = exportedAt();

  // --- En-tête complet (première page)
  doc.image(LOGO_COULEUR, L, 33, { fit: [44, 50] });
  doc.font('Z').fontSize(16).fillColor(C.nuit).text(CHURCH, L + 56, 38, { lineBreak: false });
  doc.font('R').fontSize(9).fillColor(C.doux).text(ADDRESS, L + 56, 60, { lineBreak: false });
  if (report.docLabel) doc.font('B').fontSize(9).fillColor(C.marine).text(report.docLabel, L, 40, { width: R - L, align: 'right' });
  doc.font('R').fontSize(9).fillColor(C.doux).text(`Éditée le ${at.date} à ${at.time}`, L, 54, { width: R - L, align: 'right' });
  doc.rect(L, 92, R - L, 2.2).fill(C.or);

  // --- Titre, précision et chiffres clés (à droite)
  const kpis = (report.kpis || []).slice(0, 4);
  doc.font('B');
  const kW = kpis.map((k) => {
    doc.font('R').fontSize(8);
    const lw = doc.widthOfString(k.label);
    doc.font('B').fontSize(15);
    const vw = doc.widthOfString(String(k.value)) + (k.note ? (doc.font('R').fontSize(10), doc.widthOfString(` ${k.note}`)) : 0);
    return Math.max(lw, vw) + 24;
  });
  const kTotal = kW.reduce((a, b) => a + b, 0);
  const titleW = R - L - (kTotal ? kTotal + 20 : 0);
  doc.font('Z').fontSize(23).fillColor(C.nuit);
  const titleH = doc.heightOfString(report.title, { width: titleW });
  doc.text(report.title, L, 108, { width: titleW });
  let y = 108 + titleH + 2;
  if (report.subtitle) {
    doc.font('R').fontSize(10.5).fillColor('#33435A').text(report.subtitle, L, y, { width: titleW });
    y = doc.y;
  }
  if (kpis.length) {
    const boxH = 42;
    const kTop = Math.max(108, y - boxH);
    let x = R - kTotal;
    doc.roundedRect(x, kTop, kTotal, boxH, 7).lineWidth(0.8).stroke(C.bleuClair);
    kpis.forEach((k, i) => {
      if (i > 0) doc.moveTo(x, kTop).lineTo(x, kTop + boxH).lineWidth(0.8).stroke(C.bleuClair);
      if (k.fill) doc.save().rect(x + 0.5, kTop + 0.5, kW[i] - 1, boxH - 1).fill(C.clair).restore();
      doc.font('R').fontSize(8).fillColor(C.doux).text(k.label, x + 12, kTop + 7, { lineBreak: false });
      doc.font('B').fontSize(15).fillColor(C.nuit).text(String(k.value), x + 12, kTop + 18, { lineBreak: false, continued: Boolean(k.note) });
      if (k.note) doc.font('R').fontSize(10).fillColor(C.doux).text(` ${k.note}`, { lineBreak: false });
      x += kW[i];
    });
    y = Math.max(y, kTop + boxH);
  }
  y += 14;

  // --- Tableau
  const totalWeight = cols.reduce((n, c) => n + (typeof c.pdf === 'number' ? c.pdf : c.width || 14), 0);
  const widths = cols.map((c) => ((typeof c.pdf === 'number' ? c.pdf : c.width || 14) / totalWeight) * (R - L));
  const headH = 22;
  const rowH = cols.some((c) => c.type === 'signature') ? 25 : 20;
  const pad = 7;

  const drawHead = () => {
    doc.rect(L, y, R - L, headH).fill(C.nuit);
    let x = L;
    cols.forEach((c, i) => {
      doc.font('B').fontSize(8.5).fillColor('#FFFFFF')
        .text(c.header, x + pad, y + 7, { width: widths[i] - pad * 2, align: isRight(c) ? 'right' : isCenter(c) ? 'center' : 'left', lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    y += headH;
  };
  const newPage = () => {
    doc.addPage();
    // En-tête court des pages suivantes
    doc.image(LOGO_COULEUR, L, 30, { fit: [22, 25] });
    doc.font('Z').fontSize(11).fillColor(C.nuit).text(report.title, L + 30, 36, { width: R - L - 30, lineBreak: false, ellipsis: true });
    doc.rect(L, 62, R - L, 1.2).fill(C.or);
    y = 74;
    drawHead();
  };

  drawHead();
  if (!report.rows.length) {
    doc.font('R').fontSize(10).fillColor(C.doux).text('Aucune ligne à exporter.', L + pad, y + 8);
    y += 28;
  }
  report.rows.forEach((r, idx) => {
    if (y + rowH > FOOT - 8) newPage();
    if (idx % 2 === 1) doc.rect(L, y, R - L, rowH).fill(C.zebre);
    doc.moveTo(L, y + rowH).lineTo(R, y + rowH).lineWidth(0.6).stroke(C.trait);
    let x = L;
    cols.forEach((c, i) => {
      const w = widths[i];
      if (c.type === 'check') {
        const s = 9;
        doc.roundedRect(x + w / 2 - s / 2, y + rowH / 2 - s / 2, s, s, 1.5).lineWidth(1).stroke('#33435A');
        if (r[c.key]) {
          const cx = x + w / 2;
          const cy = y + rowH / 2;
          doc.moveTo(cx - 3, cy).lineTo(cx - 0.8, cy + 2.4).lineTo(cx + 3.4, cy - 2.6).lineWidth(1.4).stroke(C.nuit);
        }
      } else if (c.type === 'signature') {
        doc.moveTo(x + pad, y + rowH - 7).lineTo(x + w - pad, y + rowH - 7).lineWidth(0.7).stroke('#8A9BB5');
      } else {
        const bold = c.bold;
        doc.font(bold ? 'S' : 'R').fontSize(9.5).fillColor(bold ? C.nuit : c.muted ? C.doux : C.texte)
          .text(fmtCell(r[c.key], c.type), x + pad, y + (rowH - 11) / 2, { width: w - pad * 2, align: isRight(c) ? 'right' : isCenter(c) ? 'center' : 'left', lineBreak: false, ellipsis: true });
      }
      x += w;
    });
    y += rowH;
  });
  if (report.total && report.rows.length) {
    if (y + 24 > FOOT - 8) newPage();
    doc.rect(L, y, R - L, 1.6).fill(C.or);
    let x = L;
    cols.forEach((c, i) => {
      const v = i === 0 ? report.total.label : report.total.values[c.key];
      if (v !== undefined) {
        doc.font('B').fontSize(9.5).fillColor(C.nuit)
          .text(i === 0 ? v : fmtCell(v, c.type), x + pad, y + 7, { width: (i === 0 ? widths[0] + (widths[1] || 0) : widths[i]) - pad * 2, align: i === 0 ? 'left' : isRight(c) ? 'right' : 'left', lineBreak: false });
      }
      x += widths[i];
    });
  }

  // --- Pied de page sur chaque page : « Page x sur n »
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.moveTo(L, FOOT).lineTo(R, FOOT).lineWidth(0.6).stroke(C.trait);
    doc.font('R').fontSize(8).fillColor(C.doux).text(`${CHURCH} — ${report.title}`, L, FOOT + 6, { width: (R - L) * 0.75, lineBreak: false, ellipsis: true });
    doc.text(`Page ${i + 1} sur ${range.count}`, L, FOOT + 6, { width: R - L, align: 'right', lineBreak: false });
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/* ======================================================================
 * Envoi
 * ==================================================================== */

const safeName = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

async function sendReport(res, format, report) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'pdf') {
    const buf = await buildPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName(report.filename)}-${stamp}.pdf"`);
    return res.send(buf);
  }
  const buf = await buildXlsx(report);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName(report.filename)}-${stamp}.xlsx"`);
  return res.send(buf);
}

module.exports = { buildXlsx, buildPdf, sendReport };
