// /.netlify/functions/get-participation-by-postest-code.js
// Busca una participación por su código de postest
// Variables de entorno: AIRTABLE_API_KEY, AIRTABLE_BASE_ID

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
    const { postestCode, participationId } = JSON.parse(event.body || '{}');

    let participation = null;

    // Estrategia 1: buscar directamente por participationId si viene en la URL (?pid=...)
    if (participationId) {
      const pResult = await airtableFetch('GET', `/Participaciones/${participationId}`, null);
      if (pResult.status === 200 && pResult.data?.id) {
        participation = pResult.data;
      }
    }

    // Estrategia 2: buscar por campo "Código Postest" en la tabla Participaciones
    if (!participation && postestCode) {
      const encoded = encodeURIComponent(`{Código Postest}="${postestCode}"`);
      const pResult = await airtableFetch('GET', `/Participaciones?filterByFormula=${encoded}&maxRecords=1`, null);
      if (pResult.status === 200 && pResult.data?.records?.length > 0) {
        participation = pResult.data.records[0];
      }
    }

    if (!participation) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'No se encontró la participación con ese código de postest' })
      };
    }

    // Obtener sesión vinculada
    let session = null;
    let training = null;

    const sesionIds = participation.fields?.['Capacitación'] || participation.fields?.['Sesión'] || [];
    if (Array.isArray(sesionIds) && sesionIds.length > 0) {
      const sResult = await airtableFetch('GET', `/Sesiones/${sesionIds[0]}`, null);
      if (sResult.status === 200 && sResult.data?.id) {
        session = sResult.data;

        // Obtener capacitación vinculada a la sesión
        const capIds = session.fields?.['Capacitación'] || [];
        if (Array.isArray(capIds) && capIds.length > 0) {
          const tResult = await airtableFetch('GET', `/Capacitaciones/${capIds[0]}`, null);
          if (tResult.status === 200 && tResult.data?.id) {
            training = tResult.data;
          }
        }
      }
    }

    // Verificar si el pretest está completado
    const pretestScore = participation.fields?.['Pretest Score'] ||
                         participation.fields?.['Pre-test Score'] ||
                         participation.fields?.['Puntuación Pretest'] || 0;
    const pretestCompletado = participation.fields?.['Completado Pretest'] ||
                               participation.fields?.['Completado Pre-Test'] || false;
    const postestCompletado = participation.fields?.['Completado Posttest'] ||
                               participation.fields?.['Completado Post-Test'] || false;

    const isValidForPosttest = pretestCompletado || pretestScore > 0;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        participation,
        session,
        training,
        status: {
          pretestScore,
          pretestCompletado,
          postestCompletado,
          isValidForPosttest
        }
      })
    };

  } catch (error) {
    console.error('Error en get-participation-by-postest-code:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
