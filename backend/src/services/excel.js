// Exports Excel aux couleurs de l'église : logo, titre, date, tableau mis en forme,
// filtres, première ligne figée, ligne de synthèse. Utilisé par tous les exports.
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo-excel.png');
const NUIT = 'FF0A1B33';
const MARINE = 'FF173E6F';
const OR = 'FFE4BE05';
const CLAIR = 'FFF3F6FA';
const TRAIT = 'FFC9D6E8';

/**
 * @param {object} o
 * @param {string} o.sheet      nom de l'onglet
 * @param {string} o.title      titre du document (ex. « Inscrits : Nuit de louange »)
 * @param {string} [o.subtitle] précision (dates, lieu, filtres appliqués)
 * @param {{header:string,key:string,width?:number,type?:'text'|'date'|'datetime'|'number'|'money',align?:string}[]} o.columns
 * @param {object[]} o.rows
 * @param {{label:string,value:string|number}[]} [o.summary] chiffres clés sous le titre
 * @returns {Promise<Buffer>}
 */
async function buildWorkbook({ sheet, title, subtitle = '', columns, rows, summary = [] }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Maison d'Adoration pour les Nations";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheet.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 7, showGridLines: false }],
    pageSetup: { orientation: columns.length > 5 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } },
    headerFooter: { oddFooter: `&L&8Maison d'Adoration pour les Nations — ${title.replace(/&/g, '&&')}&R&8Page &P sur &N` },
  });
  const last = columns.length;
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width || 18 }));

  // Bandeau : logo à gauche, nom de l'église, titre, date.
  ws.getRow(1).height = 24;
  ws.getRow(2).height = 26;
  ws.getRow(3).height = 18;
  ws.getRow(4).height = 18;
  // Logo en haut à droite (comme un papier à en-tête), texte à gauche.
  if (fs.existsSync(LOGO)) {
    const img = wb.addImage({ filename: LOGO, extension: 'png' });
    const lastWidthPx = (columns[last - 1].width || 18) * 7;
    ws.addImage(img, { tl: { col: last - 1 + Math.max(0, (lastWidthPx - 62) / lastWidthPx), row: 0.1 }, ext: { width: 62, height: 71 } });
  }
  const textEnd = Math.max(1, last - 1);
  const put = (row, value, font) => {
    if (textEnd > 1) ws.mergeCells(row, 1, row, textEnd);
    const cell = ws.getCell(row, 1);
    cell.value = value;
    cell.font = font;
    cell.alignment = { vertical: 'middle', indent: 1 };
  };
  put(1, "MAISON D'ADORATION POUR LES NATIONS", { name: 'Calibri', size: 10, bold: true, color: { argb: MARINE } });
  put(2, title, { name: 'Calibri', size: 16, bold: true, color: { argb: NUIT } });
  put(3, subtitle, { name: 'Calibri', size: 10, color: { argb: 'FF4A6285' } });
  const now = new Date();
  put(4, `Exporté le ${now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lubumbashi' })} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lubumbashi' })} — Lubumbashi`, { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF4A6285' } });

  // Chiffres clés (ligne 5) : « Inscrits : 42   Places : 60 … »
  ws.getRow(5).height = 22;
  if (summary.length) {
    ws.mergeCells(5, 1, 5, textEnd);
    const c = ws.getCell(5, 1);
    c.value = {
      richText: summary.flatMap((s, i) => [
        { text: `${i ? '     ' : ''}${s.label} : `, font: { name: 'Calibri', size: 10, color: { argb: 'FF4A6285' } } },
        { text: String(s.value), font: { name: 'Calibri', size: 11, bold: true, color: { argb: NUIT } } },
      ]),
    };
    c.alignment = { vertical: 'middle', indent: 1 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLAIR } };
  }
  // Ligne 6 : filet doré
  ws.getRow(6).height = 6;
  for (let i = 1; i <= last; i++) ws.getCell(6, i).border = { bottom: { style: 'medium', color: { argb: OR } } };

  // En-têtes du tableau (ligne 7)
  const head = ws.getRow(7);
  head.height = 24;
  columns.forEach((col, i) => {
    const cell = head.getCell(i + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NUIT } };
    cell.alignment = { vertical: 'middle', horizontal: col.align || (['number', 'money'].includes(col.type) ? 'right' : 'left'), indent: 1, wrapText: true };
  });

  // Données
  const FORMAT = { date: 'dd/mm/yyyy', datetime: 'dd/mm/yyyy hh:mm', number: '#,##0', money: '#,##0.00' };
  rows.forEach((r, idx) => {
    const row = ws.getRow(8 + idx);
    row.height = 20;
    columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      let v = r[col.key];
      if (v === undefined || v === null) v = '';
      if ((col.type === 'date' || col.type === 'datetime') && v) v = new Date(v);
      // Texte stocké comme texte : un « =… » saisi par un visiteur n'est jamais exécuté comme formule.
      cell.value = v;
      if (FORMAT[col.type]) cell.numFmt = FORMAT[col.type];
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1D2B40' } };
      cell.alignment = { vertical: 'middle', horizontal: col.align || (['number', 'money'].includes(col.type) ? 'right' : 'left'), indent: 1 };
      cell.border = { bottom: { style: 'thin', color: { argb: TRAIT } } };
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLAIR } };
    });
  });
  if (!rows.length) {
    ws.mergeCells(8, 1, 8, last);
    const c = ws.getCell(8, 1);
    c.value = 'Aucune ligne à exporter.';
    c.font = { name: 'Calibri', italic: true, color: { argb: 'FF4A6285' } };
    c.alignment = { indent: 1 };
  }
  if (rows.length) ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7 + rows.length, column: last } };
  ws.pageSetup.printTitlesRow = '7:7';
  return wb.xlsx.writeBuffer();
}

/** Envoie le classeur avec un nom de fichier propre. */
async function sendWorkbook(res, filename, options) {
  const buf = await buildWorkbook(options);
  const safe = filename.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  res.send(Buffer.from(buf));
}

module.exports = { buildWorkbook, sendWorkbook };
