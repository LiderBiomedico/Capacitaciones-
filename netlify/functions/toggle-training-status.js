// netlify/functions/toggle-training-status.js
// Finaliza o reactiva una capacitación y sus sesiones

const AIRTABLE_API = 'https://api.airtable.com/v0';

async function airtablePatch(baseId, apiKey, table, recordId, fields) {
  const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Error ${res.status}`);
  }
  return res.json();
}

async function fetchAllRecords(baseId, apiKey, table, filterFormula = '') {
  const records = [];
  let offset = null;
  do {
    let params = '?pageSize=100';
    if (filterFormula) params += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
    if (offset) params += `&offset=${offset}`;
    const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}${params}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    const data = await res.json();
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

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Variables de entorno no configuradas' }) };
  }

  let trainingId, action;
  try {
    const body = JSON.parse(event.body || '{}');
    trainingId = body.trainingId;
    action = body.action; // 'finalize' | 'reactivate'
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Body inválido' }) };
  }

  if (!trainingId || !['finalize', 'reactivate'].includes(action)) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Parámetros inválidos' }) };
  }

  try {
    const finalizar = action === 'finalize';

    // 1. Actualizar la capacitación
    await airtablePatch(baseId, apiKey, 'Capacitaciones', trainingId, {
      'Finalizada': finalizar,
      'Activa': !finalizar
    });

    // 2. Actualizar sesiones vinculadas
    const formula = `FIND("${trainingId}", ARRAYJOIN({Capacitación}))`;
    let sessions = [];
    try {
      sessions = await fetchAllRecords(baseId, apiKey, 'Sesiones', formula);
    } catch {
      const formula2 = `FIND("${trainingId}", ARRAYJOIN({Capacitacion}))`;
      sessions = await fetchAllRecords(baseId, apiKey, 'Sesiones', formula2).catch(() => []);
    }

    let sessionsUpdated = 0;
    for (const session of sessions) {
      try {
        await airtablePatch(baseId, apiKey, 'Sesiones', session.id, {
          'Activa': !finalizar
        });
        sessionsUpdated++;
      } catch (e) {
        console.warn(`⚠️ No se pudo actualizar sesión ${session.id}:`, e.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, sessionsUpdated })
    };

  } catch (err) {
    console.error('❌ Error en toggle-training-status:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
