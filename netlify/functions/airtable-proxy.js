// ==========================================
// netlify/functions/airtable-proxy.js
// Proxy seguro para todas las peticiones a Airtable
// ==========================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Variables de entorno AIRTABLE_API_KEY y AIRTABLE_BASE_ID no configuradas' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body JSON inválido' }) };
  }

  const { method = 'GET', path: airtablePath = '', body: requestBody } = payload;

  if (!airtablePath) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'path es requerido' }) };
  }

  const url = `${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}${airtablePath}`;

  const fetchOptions = {
    method,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  if (requestBody && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    fetchOptions.body = JSON.stringify(requestBody);
  }

  try {
    const response = await fetch(url, fetchOptions);
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data?.error?.message || data?.error || text || `Error ${response.status}` })
      };
    }

    // Normalizar respuesta: agregar success:true y records array
    const normalized = { success: true, ...data };
    if (data.records === undefined && method === 'GET') normalized.records = [];

    return { statusCode: 200, headers, body: JSON.stringify(normalized) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Error interno del servidor' })
    };
  }
};
