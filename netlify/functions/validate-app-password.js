// /.netlify/functions/validate-app-password.js
// Valida la contraseña administrativa leyéndola desde la tabla AppConfig de Airtable
// Variables de entorno requeridas: AIRTABLE_API_KEY, AIRTABLE_BASE_ID

const https = require('https');

function airtableFetch(path) {
  return new Promise((resolve, reject) => {
    const API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_ID = process.env.AIRTABLE_BASE_ID;
    const url = `https://api.airtable.com/v0/${BASE_ID}${path}`;
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data: { error: data } }); }
      });
    });
    req.on('error', reject);
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
    const { password } = JSON.parse(event.body || '{}');

    if (!password || String(password).trim().length < 1) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Contraseña requerida' }) };
    }

    const API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_ID = process.env.AIRTABLE_BASE_ID;

    if (!API_KEY || !BASE_ID) {
      console.error('Variables AIRTABLE_API_KEY o AIRTABLE_BASE_ID no configuradas');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Servidor no configurado. Configure AIRTABLE_API_KEY y AIRTABLE_BASE_ID en Netlify.' })
      };
    }

    // Leer APP_PASSWORD desde tabla AppConfig (Key="APP_PASSWORD", Value=contraseña)
    const encodedFilter = encodeURIComponent('{Key}="APP_PASSWORD"');
    const result = await airtableFetch(`/AppConfig?filterByFormula=${encodedFilter}&maxRecords=1`);

    if (result.status >= 400) {
      console.error('Error consultando AppConfig:', result.data);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Error al consultar configuración del sistema' }) };
    }

    const records = result.data?.records || [];

    if (records.length === 0) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'APP_PASSWORD no configurada en la tabla AppConfig de Airtable' })
      };
    }

    const storedPassword = records[0]?.fields?.Value || records[0]?.fields?.value || '';

    if (!storedPassword) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'El campo Value de APP_PASSWORD está vacío' }) };
    }

    if (String(password) === String(storedPassword)) {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    } else {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Contraseña incorrecta' }) };
    }

  } catch (error) {
    console.error('Error en validate-app-password:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Error interno: ' + error.message }) };
  }
};
