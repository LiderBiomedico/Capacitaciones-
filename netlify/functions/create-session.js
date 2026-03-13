// /.netlify/functions/create-session.js
// Crea una nueva sesión en Airtable vinculada a una capacitación
// Variables de entorno: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, SITE_URL (opcional)

const https = require('https');

function airtableFetch(method, path, body) {
  return new Promise((resolve, reject) => {
    const API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_ID = process.env.AIRTABLE_BASE_ID;
    const url = `https://api.airtable.com/v0/${BASE_ID}${path}`;
    const parsedUrl = new URL(url);
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
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
    const { code, trainingId } = JSON.parse(event.body || '{}');

    if (!code || !trainingId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Parámetros code y trainingId son requeridos' }) };
    }

    const SITE_URL = process.env.SITE_URL || process.env.URL || 'https://capacitaciones-hslv.netlify.app';
    const codeUpper = code.toUpperCase().trim();
    const accessLink = `${SITE_URL}?code=${codeUpper}`;

    const sessionBody = {
      fields: {
        'Código Acceso': codeUpper,
        'Link Acceso': accessLink,
        'Capacitaciones': [trainingId],
        'Activa': true,
        'Fecha Inicio': new Date().toISOString().split('T')[0]
      }
    };

    const result = await airtableFetch('POST', '/Sesiones', sessionBody);

    if (result.status >= 400) {
      const errMsg = result.data?.error?.message || result.data?.error || `Error Airtable ${result.status}`;
      return { statusCode: result.status, headers: corsHeaders, body: JSON.stringify({ success: false, error: errMsg }) };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, session: result.data, id: result.data.id, code: codeUpper, accessLink })
    };
  } catch (error) {
    console.error('Error en create-session:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
