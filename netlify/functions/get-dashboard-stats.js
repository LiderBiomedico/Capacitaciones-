// netlify/functions/get-dashboard-stats.js
// Estadísticas globales para el Panel de Control
// Adherencia = participantes que completaron el POSTTEST / total participantes
// Usa https nativo de Node.js

const https = require('https');

function airtableGet(baseId, apiKey, table, params = '') {
  return new Promise((resolve, reject) => {
    const path = `/v0/${baseId}/${encodeURIComponent(table)}${params}`;
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { reject(new Error('JSON inválido: ' + body.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchAllRecords(baseId, apiKey, table) {
  const records = [];
  let offset = null;
  do {
    let params = '?pageSize=100';
    if (offset) params += '&offset=' + offset;
    const { status, data } = await airtableGet(baseId, apiKey, table, params);
    if (status !== 200) throw new Error(`Error ${status} en ${table}: ` + JSON.stringify(data).slice(0,200));
    if (data.records) records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  return records;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Variables de entorno no configuradas' }) };
  }

  try {
    // Obtener capacitaciones y participaciones en paralelo
    const [capacitaciones, participaciones] = await Promise.all([
      fetchAllRecords(baseId, apiKey, 'Capacitaciones'),
      fetchAllRecords(baseId, apiKey, 'Participaciones')
    ]);

    // ── Estadísticas de capacitaciones ──────────────────────────────────
    const totalTrainings = capacitaciones.filter(c => {
      const f = c.fields || {};
      return f['Estado'] !== 'inactive' && f['Finalizada'] !== true;
    }).length;

    // ── Estadísticas de participaciones ─────────────────────────────────
    const totalParticipants = participaciones.length;

    // Adherencia: % que completó el POSTTEST
    // Un participante completó si:
    //   - campo 'Estado' = 'Posttest Completado'
    //   - O 'Puntuación Posttest' > 0
    const completedPosttest = participaciones.filter(p => {
      const f = p.fields || {};
      const estado = String(f['Estado'] || '').toLowerCase();
      const postScore = Number(f['Puntuación Posttest'] || f['Posttest Score'] || 0);
      return estado.includes('posttest') || estado.includes('postest') || postScore > 0;
    }).length;

    const adherenceRate = totalParticipants > 0
      ? Math.round((completedPosttest / totalParticipants) * 100)
      : 0;

    // Mejora promedio (solo de quienes completaron posttest)
    let totalImprovement = 0;
    let improvementCount = 0;
    participaciones.forEach(p => {
      const f = p.fields || {};
      const pre  = Number(f['Pretest Score'] || f['Puntuación Pretest'] || 0);
      const post = Number(f['Puntuación Posttest'] || f['Posttest Score'] || 0);
      if (post > 0) {
        totalImprovement += (post - pre);
        improvementCount++;
      }
    });
    const avgImprovement = improvementCount > 0
      ? Math.round(totalImprovement / improvementCount)
      : 0;

    // ── Gráfico: participaciones por día (últimos 7 días) ────────────────
    const now = new Date();
    const dayLabels = [];
    const dayData = [];
    const dayNames = ['dom','lun','mar','mié','jue','vie','sáb'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
      dayLabels.push(dayNames[d.getDay()]);

      const count = participaciones.filter(p => {
        const f = p.fields || {};
        const fecha = String(f['Fecha de Inicio'] || f['Fecha Inicio'] || p.createdTime || '');
        return fecha.startsWith(dateStr);
      }).length;
      dayData.push(count);
    }

    // ── Gráfico: rendimiento por departamento ────────────────────────────
    const deptMap = {};
    participaciones.forEach(p => {
      const f = p.fields || {};
      const dept = f['Departamento'] || 'General';
      const post = Number(f['Puntuación Posttest'] || f['Posttest Score'] || 0);
      const pre  = Number(f['Pretest Score'] || f['Puntuación Pretest'] || 0);
      const score = post > 0 ? post : pre;
      if (!deptMap[dept]) deptMap[dept] = { total: 0, count: 0 };
      if (score > 0) {
        deptMap[dept].total += score;
        deptMap[dept].count++;
      }
    });

    const deptLabels = Object.keys(deptMap);
    const deptData = deptLabels.map(d =>
      deptMap[d].count > 0 ? Math.round(deptMap[d].total / deptMap[d].count) : 0
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        statistics: {
          totalTrainings,
          totalParticipants,
          completedPosttest,
          adherenceRate,
          avgImprovement
        },
        charts: {
          participationsByDay: { labels: dayLabels, data: dayData },
          departmentPerformance: { labels: deptLabels, data: deptData }
        }
      })
    };

  } catch (err) {
    console.error('❌ get-dashboard-stats:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
