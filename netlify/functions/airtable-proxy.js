// /.netlify/functions/airtable-proxy.js
// Proxy seguro para todas las peticiones a Airtable
// Variables de entorno requeridas: AIRTABLE_API_KEY, AIRTABLE_BASE_ID

const https = require('https');

function airtableFetch(method, path, body) {
  return new Promise((resolve, reject) => {
    const API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_ID = process.env.AIRTABLE_BASE_ID;

    if (!API_KEY || !BASE_ID) {
      return reject(new Error('Variables AIRTABLE_API_KEY o AIRTABLE_BASE_ID no configuradas en Netlify'));
    }

    const url = `https://api.airtable.com/v0/${BASE_ID}${path}`;
    const parsedUrl = new URL(url);
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    };
    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data: { error: data } }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Método no permitido' }) };
  }

  try {
    const { method, path, body } = JSON.parse(event.body || '{}');

    if (!method || !path) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Parámetros method y path requeridos' }) };
    }

    const result = await airtableFetch(method, path, body);

    // Error de Airtable
    if (result.status >= 400) {
      const errMsg = result.data?.error?.message || result.data?.error || `Error Airtable ${result.status}`;
      return { statusCode: result.status, headers: corsHeaders, body: JSON.stringify({ success: false, error: errMsg }) };
    }

    // Respuesta con lista de records (GET con lista)
    if (result.data && Array.isArray(result.data.records)) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          records: result.data.records,
          offset: result.data.offset || null
        })
      };
    }

    // Respuesta con un solo record (POST/PATCH/DELETE)
    if (result.data && result.data.id) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          record: result.data,
          id: result.data.id,
          fields: result.data.fields
        })
      };
    }

    // Otro tipo de respuesta exitosa
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, ...result.data })
    };

  } catch (error) {
    console.error('Error en airtable-proxy:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
