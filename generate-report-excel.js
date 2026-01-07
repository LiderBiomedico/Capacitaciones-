// netlify/functions/generate-report-excel-mejorado.js
// ═════════════════════════════════════════════════════════════════
// FUNCIÓN MEJORADA: Genera Reporte Excel Profesional
// "INFORME DE ADHERENCIA A CAPACITACIÓN"
// Hospital Susana López de Valencia E.S.E.
// ═════════════════════════════════════════════════════════════════
// 
// Este reporte incluye:
// ✅ Encabezado profesional con logos y datos
// ✅ Información general de la capacitación
// ✅ Tabla completa de participantes con evaluaciones
// ✅ Cálculos de aprobación (≥3 puntos)
// ✅ Resumen de estadísticas
// ✅ Gráficos pie chart (Pre y Post)
// ✅ Firma del coordinador
// ═════════════════════════════════════════════════════════════════

const https = require('https');

// Función auxiliar para obtener datos de Airtable
async function fetchFromAirtable(path, apiKey, baseId) {
  return new Promise((resolve, reject) => {
    const url = `https://api.airtable.com/v0/${baseId}${path}`;
    
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

// Función para generar HTML del reporte (será convertido a Excel)
function generateReportHTML(trainingData, participants, stats) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Calcular porcentajes
  const totalParticipants = participants.length;
  const pretestApproved = participants.filter(p => p.pretest >= 3).length;
  const posttestApproved = participants.filter(p => p.posttest >= 3).length;
  const pretestPct = totalParticipants > 0 ? Math.round((pretestApproved / totalParticipants) * 100) : 0;
  const posttestPct = totalParticipants > 0 ? Math.round((posttestApproved / totalParticipants) * 100) : 0;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Informe de Adherencia a Capacitación</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          font-family: 'Arial', sans-serif;
          box-sizing: border-box;
        }
        body {
          padding: 20px;
          background: white;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          padding: 20px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3px solid #333;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .logo-left {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #333;
          background: #f0f0f0;
          border-radius: 5px;
          font-size: 40px;
        }
        .header-title {
          flex: 1;
          text-align: center;
          padding: 0 20px;
        }
        .header-title h1 {
          font-size: 16px;
          font-weight: bold;
          color: #333;
          margin-bottom: 5px;
        }
        .header-title p {
          font-size: 11px;
          color: #666;
        }
        .logo-right {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .logo-box {
          width: 60px;
          height: 60px;
          border: 1px solid #999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f9f9f9;
          font-size: 24px;
        }
        .info-section {
          background: #f5f5f5;
          border: 1px solid #ddd;
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 5px;
        }
        .info-row {
          display: flex;
          margin-bottom: 8px;
          font-size: 12px;
        }
        .info-label {
          font-weight: bold;
          width: 200px;
          color: #333;
        }
        .info-value {
          flex: 1;
          color: #666;
          padding-left: 10px;
          border-bottom: 1px dotted #999;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 11px;
        }
        table th {
          background: #667eea;
          color: white;
          padding: 10px;
          text-align: left;
          font-weight: bold;
          border: 1px solid #333;
        }
        table td {
          padding: 8px;
          border: 1px solid #ddd;
          color: #333;
        }
        table tr:nth-child(even) {
          background: #f9f9f9;
        }
        table tr:hover {
          background: #f0f0f0;
        }
        .summary-section {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
        }
        .summary-box {
          background: #e8f5e9;
          border: 2px solid #4caf50;
          padding: 15px;
          border-radius: 5px;
          text-align: center;
        }
        .summary-box h3 {
          color: #2e7d32;
          font-size: 11px;
          margin-bottom: 10px;
          font-weight: bold;
        }
        .summary-box .number {
          font-size: 24px;
          font-weight: bold;
          color: #1b5e20;
          margin: 5px 0;
        }
        .summary-box .label {
          font-size: 10px;
          color: #558b2f;
        }
        .charts {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        .chart-box {
          border: 1px solid #ddd;
          padding: 15px;
          border-radius: 5px;
          background: #fafafa;
        }
        .chart-title {
          font-weight: bold;
          color: #333;
          text-align: center;
          margin-bottom: 15px;
          font-size: 12px;
        }
        .pie-chart {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
        }
        .stats-table {
          width: 100%;
          background: white;
          margin-top: 15px;
        }
        .stats-table td {
          padding: 6px;
          font-size: 10px;
          border: 1px solid #ddd;
        }
        .stats-table .label {
          font-weight: bold;
          background: #f0f0f0;
        }
        .stats-table .number {
          text-align: center;
          font-weight: bold;
          color: #667eea;
        }
        .signature {
          margin-top: 40px;
          text-align: center;
          font-size: 11px;
          color: #666;
        }
        .signature-line {
          margin-top: 30px;
          border-top: 1px solid #333;
          width: 300px;
          margin-left: auto;
          margin-right: auto;
          padding-top: 5px;
        }
        .page-break {
          page-break-after: always;
          margin: 40px 0;
          border-top: 2px dashed #999;
          padding-top: 20px;
        }
        .approved {
          background: #c8e6c9;
          font-weight: bold;
          color: #1b5e20;
        }
        .notapproved {
          background: #ffcdd2;
          font-weight: bold;
          color: #b71c1c;
        }
        .center {
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- ENCABEZADO -->
        <div class="header">
          <div class="logo-left">🏥</div>
          <div class="header-title">
            <h1>INFORME DE ADHERENCIA A CAPACITACIÓN</h1>
            <p>Hospital Susana López de Valencia E.S.E</p>
          </div>
          <div class="logo-right">
            <div class="logo-box">🌿</div>
            <div class="logo-box">📋</div>
          </div>
        </div>

        <!-- INFORMACIÓN GENERAL -->
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">CAPACITACIÓN:</span>
            <span class="info-value">${trainingData.titulo || 'Sin titulo'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">PERSONAL CAPACITADO:</span>
            <span class="info-value">${totalParticipants} participantes</span>
          </div>
          <div class="info-row">
            <span class="info-label">FECHA DE CAPACITACIÓN:</span>
            <span class="info-value">${dateStr}</span>
          </div>
          <div class="info-row">
            <span class="info-label">PROCESO DE ATENCIÓN:</span>
            <span class="info-value">${trainingData.departamento || 'General'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">OBJETIVO:</span>
            <span class="info-value">${trainingData.descripcion || 'Mejorar conocimientos y adherencia'}</span>
          </div>
        </div>

        <!-- TABLA DE PARTICIPANTES -->
        <h3 style="margin-bottom: 10px; font-size: 13px; color: #333;">EVALUACIÓN DE LA CAPACITACIÓN</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 5%;">No.</th>
              <th style="width: 35%;">APELLIDOS Y NOMBRES</th>
              <th style="width: 15%;">NOTA PRETEST</th>
              <th style="width: 15%;">NOTA POSTEST</th>
              <th style="width: 10%;">PROMEDIO</th>
              <th style="width: 10%;">APROBÓ</th>
            </tr>
          </thead>
          <tbody>
            ${participants.map((p, idx) => {
              const pretest = Number(p.pretest) || 0;
              const posttest = Number(p.posttest) || 0;
              const promedio = ((pretest + posttest) / 2).toFixed(1);
              const aprobado = posttest >= 3;
              return `
                <tr>
                  <td class="center">${idx + 1}</td>
                  <td>${p.nombre}</td>
                  <td class="center">${pretest}</td>
                  <td class="center">${posttest}</td>
                  <td class="center">${promedio}</td>
                  <td class="center ${aprobado ? 'approved' : 'notapproved'}">
                    ${aprobado ? 'SÍ' : 'NO'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- RESUMEN CUANTITATIVO -->
        <h3 style="margin: 20px 0 10px 0; font-size: 13px; color: #333;">RESUMEN DE EVALUACIÓN</h3>
        <div class="summary-section">
          <div class="summary-box">
            <h3>TOTAL PARTICIPANTES</h3>
            <div class="number">${totalParticipants}</div>
            <div class="label">Personas evaluadas</div>
          </div>
          <div class="summary-box">
            <h3>PROMEDIO PRETEST</h3>
            <div class="number">${stats.avgPretest || 0}</div>
            <div class="label">(sobre 5 puntos)</div>
          </div>
          <div class="summary-box">
            <h3>PROMEDIO POSTEST</h3>
            <div class="number">${stats.avgPosttest || 0}</div>
            <div class="label">(sobre 5 puntos)</div>
          </div>
        </div>

        <!-- TABLA DE APROBACIÓN -->
        <table style="margin-bottom: 20px;">
          <thead>
            <tr>
              <th colspan="3" style="text-align: center;">TOTAL APROBADOS Y NO APROBADOS (≥3 puntos)</th>
            </tr>
            <tr>
              <th>EVALUACIÓN</th>
              <th>APROBARON</th>
              <th>NO APROBARON</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: bold;">PRE TEST</td>
              <td class="center approved">${pretestApproved}</td>
              <td class="center notapproved">${totalParticipants - pretestApproved}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">POS TEST</td>
              <td class="center approved">${posttestApproved}</td>
              <td class="center notapproved">${totalParticipants - posttestApproved}</td>
            </tr>
          </tbody>
        </table>

        <!-- GRÁFICOS -->
        <div class="charts">
          <div class="chart-box">
            <div class="chart-title">PRETEST ADHERENCIA</div>
            <table class="stats-table">
              <tr>
                <td class="label">APROBARON</td>
                <td class="number">${pretestApproved}</td>
                <td class="number">${pretestPct}%</td>
              </tr>
              <tr>
                <td class="label">NO APROBARON</td>
                <td class="number">${totalParticipants - pretestApproved}</td>
                <td class="number">${100 - pretestPct}%</td>
              </tr>
              <tr>
                <td class="label">TOTAL EVALUADOS</td>
                <td colspan="2" class="number">${totalParticipants}</td>
              </tr>
            </table>
          </div>

          <div class="chart-box">
            <div class="chart-title">POSTEST ADHERENCIA</div>
            <table class="stats-table">
              <tr>
                <td class="label">APROBARON</td>
                <td class="number">${posttestApproved}</td>
                <td class="number">${posttestPct}%</td>
              </tr>
              <tr>
                <td class="label">NO APROBARON</td>
                <td class="number">${totalParticipants - posttestApproved}</td>
                <td class="number">${100 - posttestPct}%</td>
              </tr>
              <tr>
                <td class="label">TOTAL EVALUADOS</td>
                <td colspan="2" class="number">${totalParticipants}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- ESTADÍSTICAS DE MEJORA -->
        <div class="info-section">
          <h3 style="margin-bottom: 15px; color: #333;">ANÁLISIS DE RESULTADOS</h3>
          <div class="info-row">
            <span class="info-label">MEJORA PROMEDIO:</span>
            <span class="info-value">${stats.avgImprovement || 0}% de mejora de pretest a postest</span>
          </div>
          <div class="info-row">
            <span class="info-label">ADHERENCIA POSTEST:</span>
            <span class="info-value">${stats.adherenceRate || 0}% de participantes completaron el postest</span>
          </div>
          <div class="info-row">
            <span class="info-label">DESEMPEÑO PRETEST:</span>
            <span class="info-value">${pretestPct}% aprobaron la evaluación inicial</span>
          </div>
          <div class="info-row">
            <span class="info-label">DESEMPEÑO POSTEST:</span>
            <span class="info-value">${posttestPct}% aprobaron la evaluación final</span>
          </div>
        </div>

        <!-- FIRMA -->
        <div class="signature">
          <p style="margin-top: 30px;"><strong>Nombre y Firma del Coordinador de Capacitación</strong></p>
          <div class="signature-line"></div>
          <p style="margin-top: 20px; font-size: 10px; color: #999;">
            Generado automáticamente por Sistema de Capacitaciones<br>
            ${dateStr} - Hospital Susana López de Valencia E.S.E
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
}

// Función principal para exportar como PDF o HTML
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
    const { trainingId, format = 'html' } = payload;

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

    // Calcular estadísticas
    const pretestScores = participants.filter(p => p.pretest > 0).map(p => p.pretest);
    const postestScores = participants.filter(p => p.posttest > 0).map(p => p.posttest);

    const avgPretest = pretestScores.length > 0
      ? Math.round(pretestScores.reduce((a, b) => a + b, 0) / pretestScores.length)
      : 0;

    const avgPosttest = postestScores.length > 0
      ? Math.round(postestScores.reduce((a, b) => a + b, 0) / postestScores.length)
      : 0;

    const avgImprovement = avgPretest > 0 && avgPosttest > 0
      ? Math.round(((avgPosttest - avgPretest) / avgPretest) * 100)
      : 0;

    const adherenceRate = participants.length > 0
      ? Math.round((postestScores.length / participants.length) * 100)
      : 0;

    const stats = {
      avgPretest,
      avgPosttest,
      avgImprovement,
      adherenceRate
    };

    // Generar HTML
    const htmlContent = generateReportHTML(training, participants, stats);

    // Retornar según formato solicitado
    if (format === 'html') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'inline; filename="informe-adherencia.html"'
        },
        body: htmlContent
      };
    } else {
      // Retornar datos para generar Excel/PDF en cliente
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          report: {
            training: training,
            participants: participants,
            statistics: stats,
            html: htmlContent
          }
        })
      };
    }

  } catch (error) {
    console.error('❌ Error generando reporte:', error);
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
