// /.netlify/functions/generate-postest-link.js
// Genera un código único de postest y actualiza la participación en Airtable
// Variables de entorno: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, SITE_URL (opcional)

const https = require('https');
const crypto = require('crypto');

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
    const { sessionId, participationId, sessionCode, userName, userEmail, department } = JSON.parse(event.body || '{}');

    if (!participationId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'participationId es requerido' }) };
    }

    // Generar código único para postest
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
    const codePrefix = (sessionCode || 'SES').toString().substring(0, 8).toUpperCase();
    const postestCode = `POSTTEST-${codePrefix}-${randomPart}`;

    const SITE_URL = process.env.SITE_URL || process.env.URL || 'https://capacitaciones-hslv.netlify.app';
    const postestUrl = `${SITE_URL}?code=${postestCode}&type=postest&pid=${participationId}`;

    // Intentar guardar el código en la participación (falla silenciosamente si los campos no existen)
    try {
      await airtableFetch('PATCH', `/Participaciones/${participationId}`, {
        fields: {
          'Código Postest': postestCode,
          'Link Postest': postestUrl
        }
      });
    } catch (patchErr) {
      console.warn('⚠️ No se pudo guardar código postest en participación (continuando):', patchErr.message);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        postestCode,
        postestUrl,
        participationId
      })
    };
  } catch (error) {
    console.error('Error en generate-postest-link:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
