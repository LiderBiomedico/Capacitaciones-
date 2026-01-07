// netlify/functions/generate-report-excel-formateado.js
// ═════════════════════════════════════════════════════════════════
// FUNCIÓN MEJORADA: Genera Reporte Excel Profesional
// "INFORME DE ADHERENCIA A CAPACITACIÓN"
// Hospital Susana López de Valencia E.S.E.
// ═════════════════════════════════════════════════════════════════

const https = require('https');
const ExcelJS = require('exceljs');

// Función auxiliar para obtener datos de Airtable
async function fetchFromAirtable(path, apiKey, baseId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.airtable.com',
      path: `/v0/${baseId}${path}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Función para generar Excel formateado
async function generateExcelReport(trainingData, participants) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Informe', { pageSetup: { paperSize: 9, orientation: 'portrait' } });

  // Configurar márgenes y tamaño de página
  worksheet.pageMargins = { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 };
  worksheet.pageSetup.fitToPage = true;
  worksheet.pageSetup.fitToHeight = 1;

  let currentRow = 1;

  // ═════════════════════════════════════════════════════════════════
  // ENCABEZADO
  // ═════════════════════════════════════════════════════════════════
  
  // Merging para encabezado
  worksheet.mergeCells(`A${currentRow}:H${currentRow + 2}`);
  const headerCell = worksheet.getCell(`A${currentRow}`);
  headerCell.value = 'INFORME DE ADHERENCIA A CAPACITACIÓN';
  headerCell.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
  headerCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerCell.border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };

  currentRow += 3;

  // ═════════════════════════════════════════════════════════════════
  // INFORMACIÓN GENERAL
  // ═════════════════════════════════════════════════════════════════

  const infoRows = [
    ['CAPACITACIÓN', trainingData.titulo || 'Sin título'],
    ['PERSONAL CAPACITADO', participants.length.toString()],
    ['FECHA DE CAPACITACIÓN', new Date().toLocaleDateString('es-ES')],
    ['PROCESO DE ATENCIÓN', trainingData.departamento || 'General']
  ];

  infoRows.forEach(([label, value]) => {
    const labelCell = worksheet.getCell(`A${currentRow}`);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 11 };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    const valueCell = worksheet.getCell(`B${currentRow}`);
    valueCell.value = value;
    valueCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    worksheet.mergeCells(`B${currentRow}:H${currentRow}`);
    currentRow++;
  });

  currentRow += 1;

  // ═════════════════════════════════════════════════════════════════
  // TABLA DE PARTICIPANTES
  // ═════════════════════════════════════════════════════════════════

  const headerRow = currentRow;
  const headers = ['No.', 'APELLIDOS Y NOMBRES', 'NOTA PRETEST', 'NOTA POSTEST', 'PROMEDIO', 'PRE TEST', 'POS TEST'];
  
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF667eea' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  currentRow++;

  // Agregar participantes
  let pretestApproved = 0;
  let posttestApproved = 0;

  participants.forEach((participant, index) => {
    const pretest = Number(participant.pretest) || 0;
    const posttest = Number(participant.posttest) || 0;
    const promedio = ((pretest + posttest) / 2).toFixed(1);

    if (pretest >= 3) pretestApproved++;
    if (posttest >= 3) posttestApproved++;

    const rowData = [
      index + 1,
      participant.nombre,
      pretest,
      posttest,
      promedio,
      0,
      0
    ];

    rowData.forEach((value, colIndex) => {
      const cell = worksheet.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.alignment = { horizontal: colIndex === 1 ? 'left' : 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    currentRow++;
  });

  // Fila de aprobación/no aprobación
  const approvalRow = currentRow;
  const approvalCell = worksheet.getCell(approvalRow, 5);
  approvalCell.value = 'APROBARON';
  approvalCell.font = { bold: true };
  approvalCell.alignment = { horizontal: 'center' };
  approvalCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  const approvalValueCell = worksheet.getCell(approvalRow, 6);
  approvalValueCell.value = pretestApproved;
  approvalValueCell.alignment = { horizontal: 'center' };
  approvalValueCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  const approvalValueCell2 = worksheet.getCell(approvalRow, 7);
  approvalValueCell2.value = posttestApproved;
  approvalValueCell2.alignment = { horizontal: 'center' };
  approvalValueCell2.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  currentRow++;

  const notApprovalRow = currentRow;
  const notApprovalCell = worksheet.getCell(notApprovalRow, 5);
  notApprovalCell.value = 'NO APROBARON';
  notApprovalCell.font = { bold: true };
  notApprovalCell.alignment = { horizontal: 'center' };
  notApprovalCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  const notApprovalValueCell = worksheet.getCell(notApprovalRow, 6);
  notApprovalValueCell.value = participants.length - pretestApproved;
  notApprovalValueCell.alignment = { horizontal: 'center' };
  notApprovalValueCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  const notApprovalValueCell2 = worksheet.getCell(notApprovalRow, 7);
  notApprovalValueCell2.value = participants.length - posttestApproved;
  notApprovalValueCell2.alignment = { horizontal: 'center' };
  notApprovalValueCell2.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  currentRow += 2;

  // ═════════════════════════════════════════════════════════════════
  // TABLA DE RESUMEN
  // ═════════════════════════════════════════════════════════════════

  const summaryStartRow = currentRow;

  const summaryHeaders = ['TOTAL', 'PRE TEST', 'POS TEST'];
  summaryHeaders.forEach((header, index) => {
    const cell = worksheet.getCell(summaryStartRow, index + 2);
    cell.value = header;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center' };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  });

  currentRow++;

  const summaryRows = [
    ['APROBARON', pretestApproved, posttestApproved],
    ['NO APROBARON', participants.length - pretestApproved, participants.length - posttestApproved],
    ['TOTAL EVALUADOS', participants.length, participants.length]
  ];

  summaryRows.forEach(([label, preValue, postValue]) => {
    const labelCell = worksheet.getCell(currentRow, 1);
    labelCell.value = label;
    labelCell.font = { bold: true };
    labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    const preCell = worksheet.getCell(currentRow, 2);
    preCell.value = preValue;
    preCell.alignment = { horizontal: 'center' };
    preCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    const postCell = worksheet.getCell(currentRow, 3);
    postCell.value = postValue;
    postCell.alignment = { horizontal: 'center' };
    postCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    currentRow++;
  });

  currentRow += 2;

  // ═════════════════════════════════════════════════════════════════
  // SECCIÓN DE GRÁFICOS Y ANÁLISIS
  // ═════════════════════════════════════════════════════════════════

  const pretestPct = participants.length > 0 ? Math.round((pretestApproved / participants.length) * 100) : 0;
  const posttestPct = participants.length > 0 ? Math.round((posttestApproved / participants.length) * 100) : 0;

  // Información de gráficos
  const chartInfoRow = currentRow;
  
  const chartTitle1 = worksheet.getCell(chartInfoRow, 1);
  chartTitle1.value = `PRE TEST\n${pretestPct}%`;
  chartTitle1.font = { bold: true, size: 11 };
  chartTitle1.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  worksheet.mergeCells(`A${chartInfoRow}:B${chartInfoRow + 2}`);

  const chartTitle2 = worksheet.getCell(chartInfoRow, 3);
  chartTitle2.value = `POS TEST\n${posttestPct}%`;
  chartTitle2.font = { bold: true, size: 11 };
  chartTitle2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  worksheet.mergeCells(`C${chartInfoRow}:D${chartInfoRow + 2}`);

  currentRow += 4;

  // ═════════════════════════════════════════════════════════════════
  // FIRMA
  // ═════════════════════════════════════════════════════════════════

  currentRow += 3;

  const signatureRow = currentRow;
  const signatureCell = worksheet.getCell(signatureRow, 1);
  signatureCell.value = 'Nombre y Firma y Cargo del Coordinador de Capacitación';
  signatureCell.font = { size: 10 };
  signatureCell.alignment = { horizontal: 'center' };
  worksheet.mergeCells(`A${signatureRow}:H${signatureRow}`);

  currentRow += 2;

  const signatureLineRow = currentRow;
  const signatureLineCell = worksheet.getCell(signatureLineRow, 1);
  signatureLineCell.value = '_________________________________';
  signatureLineCell.alignment = { horizontal: 'center' };
  worksheet.mergeCells(`A${signatureLineRow}:H${signatureLineRow}`);

  // Ajustar ancho de columnas
  worksheet.columns = [
    { width: 5 },   // No.
    { width: 25 },  // Nombres
    { width: 12 },  // Pretest
    { width: 12 },  // Postest
    { width: 12 },  // Promedio
    { width: 12 },  // Pre Test
    { width: 12 },  // Pos Test
    { width: 12 }   // Extra
  ];

  // Convertir a buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// Función principal
export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Solo POST permitido' })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { trainingId, format = 'excel' } = payload;

    if (!trainingId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Falta trainingId' })
      };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Variables de entorno no configuradas' })
      };
    }

    // Obtener datos de Airtable
    const trainingResponse = await fetchFromAirtable(
      `/Capacitaciones/${trainingId}`,
      AIRTABLE_API_KEY,
      AIRTABLE_BASE_ID
    );

    if (!trainingResponse || trainingResponse.error) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Capacitación no encontrada' })
      };
    }

    const training = trainingResponse.fields;

    // Obtener sesiones
    const sessionsData = await fetchFromAirtable(
      '/Sesiones?pageSize=100',
      AIRTABLE_API_KEY,
      AIRTABLE_BASE_ID
    );

    const linkedSessions = (sessionsData.records || []).filter(s => {
      const caps = s.fields['Capacitaciones'] || [];
      return Array.isArray(caps) ? caps.includes(trainingId) : caps === trainingId;
    });

    const sessionIds = linkedSessions.map(s => s.id);

    // Obtener participaciones
    const participationsData = await fetchFromAirtable(
      '/Participaciones?pageSize=100',
      AIRTABLE_API_KEY,
      AIRTABLE_BASE_ID
    );

    const linkedParticipations = (participationsData.records || []).filter(p => {
      const sesion = p.fields['Sesión'] || [];
      if (Array.isArray(sesion)) {
        return sesion.some(sid => sessionIds.includes(sid));
      }
      return sessionIds.includes(sesion);
    });

    // Formatear participantes
    const participants = linkedParticipations.map(p => {
      const fields = p.fields;
      const pretestScore = Number(fields['Pretest Score'] || fields['Puntuación Pretest'] || 0);
      const postestScore = Number(fields['Post-test Score'] || fields['Puntuación Posttest'] || 0);

      return {
        nombre: fields['Nombre Completo'] || fields['Nombre'] || 'Sin nombre',
        pretest: pretestScore,
        posttest: postestScore
      };
    });

    // Generar Excel
    const excelBuffer = await generateExcelReport(training, participants);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="informe-adherencia.xlsx"',
        'Access-Control-Allow-Origin': '*'
      },
      body: excelBuffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('❌ Error generando reporte Excel:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}
