// netlify/functions/airtable-proxy.js
// 🔒 PROXY SEGURO PARA AIRTABLE (No expone credenciales al navegador)

const axios = require('axios');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Credenciales de servidor no configuradas',
        details: 'Configura AIRTABLE_API_KEY y AIRTABLE_BASE_ID en Netlify → Site settings → Environment'
      })
    };
  }

  let payload = {};
  try {
    if (event.body) payload = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { path, method = 'GET', body } = payload || {};
  if (!path || typeof path !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Path es requerido' }) };
  }

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path.startsWith('/') ? '' : '/'}${path.replace(/^\//,'')}`;

  try {
    const config = {
      url,
      method,
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'HSLV-Capacitaciones/1.0'
      },
      timeout: 30000
    };
    if (body && ['POST','PATCH','PUT'].includes(method.toUpperCase())) {
      config.data = body;
    }
    const resp = await axios(config);
    return { statusCode: 200, headers, body: JSON.stringify(resp.data) };
  } catch (error) {
    if (error.response) {
      const { status, data } = error.response;
      let friendly = { error: data?.error?.message || data?.error || 'Error en Airtable', details: data };
      if (status === 422) friendly.error = 'Datos inválidos (422)';
      if (status === 401) friendly.error = 'No autorizado (401)';
      if (status === 404) friendly.error = 'No encontrado (404)';
      if (status === 429) friendly.error = 'Demasiadas peticiones (429)';
      return { statusCode: status || 500, headers, body: JSON.stringify(friendly) };
    }
    if (error.code === 'ECONNABORTED') {
      return { statusCode: 504, headers, body: JSON.stringify({ error: 'Timeout', message: 'La petición tardó demasiado' }) };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno', message: error.message }) };
  }
};
