// ==========================================
// netlify/functions/create-session.js
// Crea una sesión en Airtable (si se usa tabla Sesiones)
// Si la app usa Capacitaciones directamente, simplemente valida y retorna el ID
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

  const { code, trainingId } = payload;

  try {
    // Verificar si ya existe una sesión con ese código
    const sesionesRes = await airtableRequest('GET', `/Sesiones?filterByFormula={Código Acceso}="${code}"&maxRecords=1`);
    
    if (sesionesRes.records && sesionesRes.records.length > 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, sessionId: sesionesRes.records[0].id, message: 'Sesión existente encontrada' })
      };
    }

    // Crear nueva sesión
    const now = new Date().toISOString().slice(0, 10);
    const newSession = await airtableRequest('POST', '/Sesiones', {
      fields: {
        'Código Acceso': code,
        'Capacitación': trainingId ? [trainingId] : undefined,
        'Fecha Inicio': now,
        'Activa': true
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, sessionId: newSession.id })
    };

  } catch (err) {
    // Si la tabla Sesiones no existe, retornar éxito con el trainingId como fallback
    console.error('Error create-session:', err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, sessionId: trainingId, message: 'Usando capacitación directamente' })
    };
  }
};
