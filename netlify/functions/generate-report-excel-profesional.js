// netlify/functions/generate-report-excel-profesional.js
// ═════════════════════════════════════════════════════════════════
// FUNCIÓN PROFESIONAL: Genera Excel con formato ADERENCIA
// Exactamente como ADERENCIA1.xlsx
// Hospital Susana López de Valencia E.S.E.
// ═════════════════════════════════════════════════════════════════

const https = require('https');
const ExcelJS = require('exceljs');

// Función para hacer peticiones a Airtable
async function airtableRequest(method, endpoint, apiKey, baseId, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.airtable.com',
      path: `/v0/${baseId}${endpoint}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error('Error parsing response'));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Función principal para generar Excel
async function generateProfessionalExcel(trainingId, apiKey, baseId) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Informe', { 
    pageSetup: { paperSize: 9, orientation: 'portrait' } 
  });

  // Configuración de página
  worksheet.pageMargins = { left: 0.5, right: 0.5, top: 0.7, bottom: 0.7 };
  worksheet.pageSetup.fitToPage = true;
  worksheet.pageSetup.fitToHeight = 1;

  // ═════════════════════════════════════════════════════════════════
  // OBTENER DATOS
  // ═════════════════════════════════════════════════════════════════

  // Obtener capacitación
  const trainingResponse = await airtableRequest('GET', `/Capacitaciones/${trainingId}`, apiKey, baseId);
  if (!trainingResponse || trainingResponse.error) {
    throw new Error('Capacitación no encontrada');
  }
  const training = trainingResponse.fields;

  // Obtener sesiones
  const sessionsResponse = await airtableRequest('GET', '/Sesiones?pageSize=100', apiKey, baseId);
  let sessionIds = [];
  if (sessionsResponse && sessionsResponse.records) {
    const linkedSessions = sessionsResponse.records.filter(s => {
      const caps = s.fields['Capacitaciones'] || [];
      return Array.isArray(caps) ? caps.includes(trainingId) : caps === trainingId;
    });
    sessionIds = linkedSessions.map(s => s.id);
  }

  // Obtener participaciones
  const participationsResponse = await airtableRequest('GET', '/Participaciones?pageSize=100', apiKey, baseId);
  let participants = [];
  if (participationsResponse && participationsResponse.records) {
    const linked = participationsResponse.records.filter(p => {
      const sesion = p.fields['Sesión'] || [];
      return Array.isArray(sesion) ? sesion.some(sid => sessionIds.includes(sid)) : sessionIds.includes(sesion);
    });

    participants = linked.map(p => {
      const fields = p.fields;
      return {
        nombre: fields['Nombre Completo'] || 'Sin nombre',
        pretest: Number(fields['Puntuación Pretest'] || 0),
        posttest: Number(fields['Puntuación Posttest'] || 0)
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // CONSTRUIR EXCEL
  // ═════════════════════════════════════════════════════════════════

  // Ancho de columnas
  worksheet.columns = [
    { width: 2 },   // A
    { width: 15 },  // B
    { width: 25 },  // C
    { width: 15 },  // D
    { width: 12 },  // E
    { width: 12 },  // F
    { width: 12 },  // G
    { width: 12 },  // H
    { width: 12 },  // I
    { width: 12 }   // J
  ];

  let currentRow = 1;

  // ═════════════════════════════════════════════════════════════════
  // ENCABEZADO
  // ═════════════════════════════════════════════════════════════════
  currentRow = 2;
  const headerCell = worksheet.getCell(`D${currentRow}`);
  headerCell.value = 'INFORME  DE ADHERENCIA A CAPACITACIÓN';
  headerCell.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
  headerCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
  worksheet.mergeCells(`D${currentRow}:E${currentRow}`);

  // ═════════════════════════════════════════════════════════════════
  // INFORMACIÓN GENERAL
  // ═════════════════════════════════════════════════════════════════
  currentRow = 4;

  // Capacitación
  const capLabel = worksheet.getCell(`B${currentRow}`);
  capLabel.value = 'CAPACITACIÓN ';
  capLabel.font = { bold: true, size: 10 };
  capLabel.alignment = { horizontal: 'left', vertical: 'center' };

  const capValue = worksheet.getCell(`D${currentRow}`);
  capValue.value = training['Título'] || training['titulo'] || 'Sin título';
  capValue.font = { size: 10 };
  worksheet.mergeCells(`D${currentRow}:E${currentRow}`);

  currentRow++;

  // Personal capacitado
  const personalLabel = worksheet.getCell(`B${currentRow}`);
  personalLabel.value = 'PERSONAL CAPACITADO:';
  personalLabel.font = { bold: true, size: 10 };

  const personalValue = worksheet.getCell(`D${currentRow}`);
  personalValue.value = participants.length;
  personalValue.font = { size: 10 };
  worksheet.mergeCells(`D${currentRow}:E${currentRow}`);

  currentRow++;

  // Fecha
  const fechaLabel = worksheet.getCell(`B${currentRow}`);
  fechaLabel.value = 'FECHA DE CAPACITACIÓN:';
  fechaLabel.font = { bold: true, size: 10 };

  const fechaValue = worksheet.getCell(`D${currentRow}`);
  fechaValue.value = new Date().toLocaleDateString('es-ES');
  fechaValue.font = { size: 10 };
  worksheet.mergeCells(`D${currentRow}:E${currentRow}`);

  currentRow++;

  // Proceso de atención
  const procesoLabel = worksheet.getCell(`B${currentRow}`);
  procesoLabel.value = 'PROCESO DE ATENCION:';
  procesoLabel.font = { bold: true, size: 10 };

  const procesoValue = worksheet.getCell(`D${currentRow}`);
  procesoValue.value = training['Departamento'] || training['departamento'] || 'General';
  procesoValue.font = { size: 10 };
  worksheet.mergeCells(`D${currentRow}:E${currentRow}`);

  currentRow += 2;

  // ═════════════════════════════════════════════════════════════════
  // ENCABEZADOS TABLA
  // ═════════════════════════════════════════════════════════════════

  const headerRow = currentRow;

  const headers = [
    { col: 'B', text: 'No.' },
    { col: 'C', text: 'APELLIDOS Y NOMBRES ' },
    { col: 'E', text: 'EVALUACION DE LA CAPACITACION' },
    { col: 'I', text: 'TOTAL APROBADOS Y NO APROBADOS' }
  ];

  headers.forEach(h => {
    const cell = worksheet.getCell(`${h.col}${headerRow}`);
    cell.value = h.text;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  currentRow++;

  // Sub-encabezados
  const subHeaders = [
    { col: 'E', text: 'NOTA PRETEST' },
    { col: 'F', text: 'NOTA POSTEST' },
    { col: 'G', text: 'PROMEDIO' },
    { col: 'I', text: 'PRE TEST' },
    { col: 'J', text: 'POS TEST' }
  ];

  subHeaders.forEach(h => {
    const cell = worksheet.getCell(`${h.col}${currentRow}`);
    cell.value = h.text;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  currentRow++;

  // ═════════════════════════════════════════════════════════════════
  // DATOS PARTICIPANTES
  // ═════════════════════════════════════════════════════════════════

  const dataStartRow = currentRow;

  participants.forEach((participant, index) => {
    // No.
    const noCell = worksheet.getCell(`B${currentRow}`);
    noCell.value = index + 1;
    noCell.alignment = { horizontal: 'center' };
    noCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    // Nombre
    const nameCell = worksheet.getCell(`C${currentRow}`);
    nameCell.value = participant.nombre;
    nameCell.alignment = { horizontal: 'left', wrapText: true };
    nameCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    // Pretest
    const pretestCell = worksheet.getCell(`E${currentRow}`);
    pretestCell.value = participant.pretest;
    pretestCell.alignment = { horizontal: 'center' };
    pretestCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    // Postest
    const postestCell = worksheet.getCell(`F${currentRow}`);
    postestCell.value = participant.posttest;
    postestCell.alignment = { horizontal: 'center' };
    postestCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    // Promedio
    const promCell = worksheet.getCell(`G${currentRow}`);
    promCell.value = (participant.pretest + participant.posttest) / 2;
    promCell.alignment = { horizontal: 'center' };
    promCell.numFmt = '0.0';
    promCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    // Aprobación (Pretest >= 3)
    const aprePretestCell = worksheet.getCell(`I${currentRow}`);
    aprePretestCell.value = { formula: `IF(E${currentRow}>=3,1,0)` };
    aprePretestCell.alignment = { horizontal: 'center' };
    aprePretestCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    // Aprobación (Postest >= 3)
    const aPosCell = worksheet.getCell(`J${currentRow}`);
    aPosCell.value = { formula: `IF(F${currentRow}>=3,1,0)` };
    aPosCell.alignment = { horizontal: 'center' };
    aPosCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    currentRow++;
  });

  const dataEndRow = currentRow - 1;

  // ═════════════════════════════════════════════════════════════════
  // RESUMEN
  // ═════════════════════════════════════════════════════════════════

  currentRow++;

  // Aprobaron
  const aproLabel = worksheet.getCell(`H${currentRow}`);
  aproLabel.value = 'APROBARON';
  aproLabel.font = { bold: true, size: 10 };
  aproLabel.alignment = { horizontal: 'right' };

  const aproPreCell = worksheet.getCell(`I${currentRow}`);
  aproPreCell.value = { formula: `SUM(I${dataStartRow}:I${dataEndRow})` };
  aproPreCell.alignment = { horizontal: 'center' };
  aproPreCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  const apoPostCell = worksheet.getCell(`J${currentRow}`);
  apoPostCell.value = { formula: `SUM(J${dataStartRow}:J${dataEndRow})` };
  apoPostCell.alignment = { horizontal: 'center' };
  apoPostCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  currentRow++;

  // No aprobaron
  const noAproLabel = worksheet.getCell(`H${currentRow}`);
  noAproLabel.value = 'NO APROBARON';
  noAproLabel.font = { bold: true, size: 10 };
  noAproLabel.alignment = { horizontal: 'right' };

  const noAproPreCell = worksheet.getCell(`I${currentRow}`);
  noAproPreCell.value = { formula: `${dataEndRow - dataStartRow + 1}-I${currentRow - 1}` };
  noAproPreCell.alignment = { horizontal: 'center' };
  noAproPreCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  const noApoPostCell = worksheet.getCell(`J${currentRow}`);
  noApoPostCell.value = { formula: `${dataEndRow - dataStartRow + 1}-J${currentRow - 2}` };
  noApoPostCell.alignment = { horizontal: 'center' };
  noApoPostCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  currentRow += 2;

  // ═════════════════════════════════════════════════════════════════
  // TABLA TOTAL
  // ═════════════════════════════════════════════════════════════════

  // Encabezado TOTAL
  const totalHeaderRow = currentRow;
  const totalCol1 = worksheet.getCell(`D${totalHeaderRow}`);
  totalCol1.value = 'TOTAL  ';
  totalCol1.font = { bold: true, size: 10 };
  totalCol1.alignment = { horizontal: 'center' };
  totalCol1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };

  const totalCol2 = worksheet.getCell(`E${totalHeaderRow}`);
  totalCol2.value = 'PRE TEST';
  totalCol2.font = { bold: true, size: 10 };
  totalCol2.alignment = { horizontal: 'center' };
  totalCol2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };

  const totalCol3 = worksheet.getCell(`F${totalHeaderRow}`);
  totalCol3.value = 'POS TEST';
  totalCol3.font = { bold: true, size: 10 };
  totalCol3.alignment = { horizontal: 'center' };
  totalCol3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };

  currentRow++;

  // Aprobaron
  const sumAproLabel = worksheet.getCell(`D${currentRow}`);
  sumAproLabel.value = 'APROBARON';
  sumAproLabel.font = { bold: true, size: 10 };

  const sumAproPreVal = worksheet.getCell(`E${currentRow}`);
  sumAproPreVal.value = { formula: `I${currentRow - 3}` };
  sumAproPreVal.alignment = { horizontal: 'center' };

  const sumAproPostVal = worksheet.getCell(`F${currentRow}`);
  sumAproPostVal.value = { formula: `J${currentRow - 3}` };
  sumAproPostVal.alignment = { horizontal: 'center' };

  currentRow++;

  // No aprobaron
  const sumNoLabel = worksheet.getCell(`D${currentRow}`);
  sumNoLabel.value = 'NO APROBARON';
  sumNoLabel.font = { bold: true, size: 10 };

  const sumNoPreVal = worksheet.getCell(`E${currentRow}`);
  sumNoPreVal.value = { formula: `I${currentRow - 2}` };
  sumNoPreVal.alignment = { horizontal: 'center' };

  const sumNoPostVal = worksheet.getCell(`F${currentRow}`);
  sumNoPostVal.value = { formula: `J${currentRow - 2}` };
  sumNoPostVal.alignment = { horizontal: 'center' };

  currentRow++;

  // Total evaluados
  const sumTotalLabel = worksheet.getCell(`D${currentRow}`);
  sumTotalLabel.value = 'TOTAL EVALUADOS';
  sumTotalLabel.font = { bold: true, size: 10 };

  const sumTotalPreVal = worksheet.getCell(`E${currentRow}`);
  sumTotalPreVal.value = participants.length;
  sumTotalPreVal.alignment = { horizontal: 'center' };

  const sumTotalPostVal = worksheet.getCell(`F${currentRow}`);
  sumTotalPostVal.value = participants.length;
  sumTotalPostVal.alignment = { horizontal: 'center' };

  // Convertir a buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// Handler de Netlify
exports.handler = async (event) => {
  console.log('📊 Generando Excel Profesional...');

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
    const { trainingId } = payload;

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
        body: JSON.stringify({ success: false, error: 'Variables no configuradas' })
      };
    }

    console.log('🔄 Generando Excel...');
    const buffer = await generateProfessionalExcel(trainingId, AIRTABLE_API_KEY, AIRTABLE_BASE_ID);

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const fileName = `Informe-Adherencia-${dateStr}.xlsx`;

    console.log('✅ Excel generado exitosamente');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Access-Control-Allow-Origin': '*'
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
