// ==========================================
// netlify/functions/toggle-training-status.js
// Finaliza o reactiva una capacitación en Airtable
// ==========================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

async function airtableRequest(method, path, body) {
  const url = `${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}${path}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  if (!res.ok) throw new Error(data?.error?.message || `Error ${res.status}`);
  return data;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  const { trainingId, action } = payload;

  if (!trainingId || !action) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'trainingId y action son requeridos' }) };
  }

  try {
    const nuevoEstado = action === 'finalize' ? 'finalizada' : 'active';
    const activa = action !== 'finalize';

    // Actualizar capacitación
    await airtableRequest('PATCH', `/Capacitaciones/${trainingId}`, {
      fields: {
        'Estado': nuevoEstado,
        'Activa': activa
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        action,
        trainingId,
        sessionsUpdated: 0,
        message: action === 'finalize' ? 'Capacitación finalizada' : 'Capacitación reactivada'
      })
    };

  } catch (err) {
    console.error('Error toggle-training-status:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
