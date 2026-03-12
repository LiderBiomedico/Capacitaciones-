// netlify/functions/get-quarterly-report.js
// Genera estadísticas globales trimestrales de todas las capacitaciones

const AIRTABLE_API = 'https://api.airtable.com/v0';

async function fetchAllRecords(baseId, apiKey, table, filterFormula = '') {
  const records = [];
  let offset = null;

  do {
    let params = '?pageSize=100';
    if (filterFormula) params += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
    if (offset) params += `&offset=${offset}`;

    const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}${params}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Error ${res.status} tabla ${table}`);
    }

    const data = await res.json();
    if (data.records) records.push(...data.records);
    offset = data.offset || null;
  } while (offset);

  return records;
}

function getQuarterRange(year, quarter) {
  const startMonth = (quarter - 1) * 3; // 0-indexed
  const start = new Date(year, startMonth, 1);
  const end   = new Date(year, startMonth + 3, 0, 23, 59, 59);
  return { start, end };
}

function safeNum(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Variables de entorno no configuradas' }) };
  }

  let year, quarter, scope;
  try {
    const body = JSON.parse(event.body || '{}');
    year    = parseInt(body.year, 10);
    quarter = parseInt(body.quarter, 10);
    scope   = body.scope || 'all';
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Body inválido' }) };
  }

  if (!year || !quarter || quarter < 1 || quarter > 4) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Año o trimestre inválido' }) };
  }

  try {
    const { start, end } = getQuarterRange(year, quarter);

    // 1. Obtener todas las capacitaciones
    let capacitaciones = await fetchAllRecords(baseId, apiKey, 'Capacitaciones');

    // Filtrar por trimestre (por campo Fecha, Fecha Creación, o createdTime)
    capacitaciones = capacitaciones.filter(c => {
      const f = c.fields || {};
      const rawDate = f['Fecha'] || f['Fecha Creación'] || f['Fecha Creacion'] || c.createdTime || '';
      if (!rawDate) return false;
      const d = new Date(rawDate);
      return d >= start && d <= end;
    });

    // Filtrar por scope
    if (scope === 'onlyActive') {
      capacitaciones = capacitaciones.filter(c => c.fields['Activa'] !== false && !c.fields['Finalizada']);
    } else if (scope === 'onlyFinalized') {
      capacitaciones = capacitaciones.filter(c => c.fields['Finalizada'] === true);
    }

    const trainingIds = capacitaciones.map(c => c.id);

    // 2. Obtener sesiones de esas capacitaciones
    let allSessions = [];
    if (trainingIds.length > 0) {
      // Airtable tiene límite en la longitud de fórmulas; hacemos batch de 10
      for (let i = 0; i < trainingIds.length; i += 10) {
        const batch = trainingIds.slice(i, i + 10);
        const orParts = batch.map(id => `FIND("${id}", ARRAYJOIN({Capacitación}))`);
        const formula = `OR(${orParts.join(',')})`;
        try {
          const recs = await fetchAllRecords(baseId, apiKey, 'Sesiones', formula);
          allSessions.push(...recs);
        } catch {
          // ignorar errores por batch
        }
      }
    }

    const sessionIds = [...new Set(allSessions.map(s => s.id))];

    // 3. Obtener participaciones de esas sesiones
    let allParticipations = [];
    for (let i = 0; i < sessionIds.length; i += 5) {
      const batch = sessionIds.slice(i, i + 5);
      const orParts = batch.map(id => `FIND("${id}", ARRAYJOIN({Sesión}))`);
      const formula = `OR(${orParts.join(',')})`;
      try {
        const recs = await fetchAllRecords(baseId, apiKey, 'Participaciones', formula);
        allParticipations.push(...recs);
      } catch {
        // ignorar
      }
    }

    // Eliminar duplicados
    const seenIds = new Set();
    allParticipations = allParticipations.filter(p => {
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });

    // 4. Calcular KPIs globales
    const withPostest   = allParticipations.filter(p => safeNum(p.fields['Posttest Score'] || p.fields['Puntuación Posttest'] || p.fields['Puntuación Postest']) > 0);
    const withPretest   = allParticipations.filter(p => safeNum(p.fields['Pretest Score'] || p.fields['Puntuación Pretest']) > 0);
    const uniqueNames   = new Set(allParticipations.map(p => (p.fields['Nombre'] || p.fields['Nombre Completo'] || '').toLowerCase().trim()));

    const avgPre  = withPretest.length  > 0 ? Math.round(withPretest.reduce( (s, p) => s + safeNum(p.fields['Pretest Score'] || p.fields['Puntuación Pretest']), 0) / withPretest.length)  : 0;
    const avgPost = withPostest.length > 0 ? Math.round(withPostest.reduce((s, p) => s + safeNum(p.fields['Posttest Score'] || p.fields['Puntuación Posttest'] || p.fields['Puntuación Postest']), 0) / withPostest.length) : 0;
    const adherence = allParticipations.length > 0 ? Math.round((withPostest.length / allParticipations.length) * 100) : 0;

    // 5. Distribución por departamento
    const byDept = {};
    allParticipations.forEach(p => {
      const dept = p.fields['Departamento'] || p.fields['Servicio'] || 'Sin especificar';
      byDept[dept] = (byDept[dept] || 0) + 1;
    });

    // 6. Distribución por cargo / profesión
    const byCargo = {};
    allParticipations.forEach(p => {
      const cargo = p.fields['Cargo'] || p.fields['Profesión'] || p.fields['Profesion'] || 'Sin especificar';
      byCargo[cargo] = (byCargo[cargo] || 0) + 1;
    });

    // 7. Capacitaciones por mes
    const byMonth = {};
    capacitaciones.forEach(c => {
      const f = c.fields || {};
      const rawDate = f['Fecha'] || f['Fecha Creación'] || c.createdTime || '';
      if (rawDate) {
        const d = new Date(rawDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth[key] = (byMonth[key] || 0) + 1;
      }
    });

    // 8. Ranking de capacitaciones por participantes
    const trainingRanking = capacitaciones.map(c => {
      const f = c.fields || {};
      const cId = c.id;
      const cSessions = allSessions.filter(s => {
        const linked = s.fields['Capacitación'] || [];
        return Array.isArray(linked) && linked.includes(cId);
      });
      const cSessionIds = new Set(cSessions.map(s => s.id));
      const cParticipations = allParticipations.filter(p => {
        const linked = p.fields['Sesión'] || [];
        return Array.isArray(linked) && linked.some(id => cSessionIds.has(id));
      });
      const cWithPost = cParticipations.filter(p => safeNum(p.fields['Posttest Score'] || p.fields['Puntuación Posttest'] || p.fields['Puntuación Postest']) > 0);

      return {
        id: cId,
        titulo: f['Título'] || f['Titulo'] || f['name'] || 'Sin título',
        departamento: f['Departamento'] || '',
        participantes: cParticipations.length,
        completados: cWithPost.length,
        adherencia: cParticipations.length > 0 ? Math.round((cWithPost.length / cParticipations.length) * 100) : 0,
        activa: f['Activa'] !== false,
        finalizada: f['Finalizada'] === true
      };
    }).sort((a, b) => b.participantes - a.participantes);

    const period = {
      year,
      quarter,
      label: `T${quarter} ${year}`,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };

    const kpis = {
      trainingsCount: capacitaciones.length,
      sessionsCount: allSessions.length,
      participationsCount: allParticipations.length,
      uniqueParticipants: uniqueNames.size,
      completedCount: withPostest.length,
      adherenceRate: adherence,
      avgPretestScore: avgPre,
      avgPostestScore: avgPost,
      avgImprovement: avgPost - avgPre
    };

    const distributions = {
      byDepartment: Object.entries(byDept).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      byCargo:      Object.entries(byCargo).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      byMonth:      Object.entries(byMonth).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month))
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        period,
        kpis,
        distributions,
        trainingRanking,
        scope
      })
    };

  } catch (err) {
    console.error('❌ Error en get-quarterly-report:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
