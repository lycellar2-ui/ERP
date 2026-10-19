const ExcelJS = require('exceljs');
const fs = require('fs');

const files = [
  'D:\\Lyscellar\\Report\\Review Target for Q3 - Q4.xlsx',
  'C:\\Users\\Chienth\\Desktop\\Review Target for Q3 - Q4.xlsx'
];

async function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  console.log(`Processing with ExcelJS (Pure English): ${filePath}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // 1. Target by sale sheet
  let wsTarget = workbook.getWorksheet('Target by sale');
  if (!wsTarget) {
    console.log('Worksheet "Target by sale" not found!');
    return;
  }

  // Translate headers in 'Target by sale' to pure English
  const cellA2 = wsTarget.getCell('A2');
  if (cellA2.value) cellA2.value = 'TARGETS';

  const cellB2 = wsTarget.getCell('B2');
  if (cellB2.value) cellB2.value = 'TOTAL Q3 + Q4 2026';

  const cellC3 = wsTarget.getCell('C3');
  if (cellC3.value) cellC3.value = 'Total Q3';

  const cellG3 = wsTarget.getCell('G3');
  if (cellG3.value) cellG3.value = 'Total Q4';

  // Thin borders helper
  const thinBorder = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  // Add borders to existing data table (Rows 2 to 10, Cols 1 to 10)
  for (let r = 2; r <= 10; r++) {
    const row = wsTarget.getRow(r);
    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.border = thinBorder;
    }
  }

  // Helper for merge & style
  const mergeAndStyle = (ws, range, text, isBold, isItalic, fontSize) => {
    try { ws.unMergeCells(range); } catch (e) {}
    ws.mergeCells(range);
    const firstCell = ws.getCell(range.split(':')[0]);
    firstCell.value = text;
    firstCell.font = { bold: isBold, italic: isItalic, size: fontSize, name: 'Calibri' };
    firstCell.alignment = { horizontal: 'center', vertical: 'middle' };
  };

  // Add date line at row 13 (G13:J13)
  mergeAndStyle(wsTarget, 'G13:J13', 'Date: ..... / ..... / 2026', false, true, 11);

  // Signature headers at row 15
  mergeAndStyle(wsTarget, 'A15:C15', 'SALE DIRECTOR', true, false, 11);
  mergeAndStyle(wsTarget, 'D15:F15', 'OPERATION MANAGER', true, false, 11);
  mergeAndStyle(wsTarget, 'G15:J15', 'DIRECTOR', true, false, 11);

  mergeAndStyle(wsTarget, 'A16:C16', '(Sign & Print Name)', false, true, 9);
  mergeAndStyle(wsTarget, 'D16:F16', '(Sign & Print Name)', false, true, 9);
  mergeAndStyle(wsTarget, 'G16:J16', '(Sign & Print Name)', false, true, 9);

  // Remove any pre-existing sign sheets
  const sheetsToRemove = [];
  workbook.eachSheet((ws) => {
    if (ws.name.includes('Target by sale (') || ws.name.includes('Ban ky') || ws.name.includes('Bản ký') || ws.name.includes('Approval')) {
      sheetsToRemove.push(ws.id);
    }
  });
  sheetsToRemove.forEach((id) => workbook.removeWorksheet(id));

  // Create clean English approval sheet: 'Target by sale (Approval)'
  const signSheetName = 'Target by sale (Approval)';
  const wsSign = workbook.addWorksheet(signSheetName);

  // Page title
  mergeAndStyle(wsSign, 'A2:J2', 'SALES TARGET APPROVAL BOARD - Q3 & Q4 2026', true, false, 14);
  mergeAndStyle(wsSign, 'A3:J3', 'Sales Performance Plan Q3 & Q4 2026 (Target by Sale)', false, true, 11);

  // Copy table structure (Target by sale Rows 2..10 -> Sign Sheet Rows 5..13)
  for (let r = 2; r <= 10; r++) {
    const srcRow = wsTarget.getRow(r);
    const targetR = r + 3;
    const dstRow = wsSign.getRow(targetR);

    for (let c = 1; c <= 10; c++) {
      const srcCell = srcRow.getCell(c);
      const dstCell = dstRow.getCell(c);
      const colLetter = String.fromCharCode(64 + c);

      if (r === 2 || r === 3) {
        dstCell.value = srcCell.value;
      } else {
        dstCell.value = { formula: `'Target by sale'!${colLetter}${r}` };
      }

      dstCell.font = {
        name: 'Calibri',
        size: 11,
        bold: !!srcCell.font?.bold,
        italic: !!srcCell.font?.italic
      };
      dstCell.numFmt = srcCell.numFmt || '#,##0';
      dstCell.alignment = {
        horizontal: c === 1 ? 'left' : (r === 2 || r === 3 ? 'center' : 'right'),
        vertical: 'middle'
      };
      dstCell.border = thinBorder;
    }
  }

  // Style Header (Rows 5 & 6)
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE9ECEF' }
  };
  for (let r = 5; r <= 6; r++) {
    const row = wsSign.getRow(r);
    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.fill = headerFill;
      cell.font = { bold: true, name: 'Calibri', size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
  }

  // Style Total row (Row 9)
  const totalFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F4F8' }
  };
  const row9 = wsSign.getRow(9);
  for (let c = 1; c <= 10; c++) {
    const cell = row9.getCell(c);
    cell.fill = totalFill;
    cell.font = { bold: true, name: 'Calibri', size: 11 };
  }

  // Signature Block in Approval Sheet
  mergeAndStyle(wsSign, 'G16:J16', 'Date: ..... / ..... / 2026', false, true, 11);

  mergeAndStyle(wsSign, 'A18:C18', 'SALE DIRECTOR', true, false, 11);
  mergeAndStyle(wsSign, 'D18:F18', 'OPERATION MANAGER', true, false, 11);
  mergeAndStyle(wsSign, 'G18:J18', 'DIRECTOR', true, false, 11);

  mergeAndStyle(wsSign, 'A19:C19', '(Sign & Print Name)', false, true, 9);
  mergeAndStyle(wsSign, 'D19:F19', '(Sign & Print Name)', false, true, 9);
  mergeAndStyle(wsSign, 'G19:J19', '(Sign & Print Name)', false, true, 9);

  // Set column widths
  const colWidths = [24, 20, 16, 14, 14, 14, 16, 14, 14, 14];
  colWidths.forEach((w, idx) => {
    wsSign.getColumn(idx + 1).width = w;
    wsTarget.getColumn(idx + 1).width = w;
  });

  // Page setup for printing
  wsSign.pageSetup = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    showGridLines: true
  };

  await workbook.xlsx.writeFile(filePath);
  console.log(`Successfully updated in pure English: ${filePath}`);
}

async function run() {
  for (const f of files) {
    await processFile(f);
  }
}

run().catch(console.error);
