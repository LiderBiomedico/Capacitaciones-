// /.netlify/functions/toggle-training-status.js
// Finaliza o reactiva una capacitación (activa/desactiva sus sesiones)
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
    const { trainingId, action } = JSON.parse(event.body || '{}');

    if (!trainingId || !action) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'trainingId y action son requeridos' }) };
    }

    const isActive = action === 'reactivate';

    // 1. Actualizar estado de la capacitación
    const trainingUpdate = {
      fields: {
        'Activa': isActive,
        'Estado': isActive ? 'Activa' : 'Finalizada'
      }
    };

    const trainingResult = await airtableFetch('PATCH', `/Capacitaciones/${trainingId}`, trainingUpdate);

    if (trainingResult.status >= 400) {
      const errMsg = trainingResult.data?.error?.message || `Error ${trainingResult.status}`;
      return { statusCode: trainingResult.status, headers: corsHeaders, body: JSON.stringify({ success: false, error: errMsg }) };
    }

    // 2. Buscar todas las sesiones vinculadas a esta capacitación
    const encoded = encodeURIComponent(`SEARCH("${trainingId}", ARRAYJOIN({Capacitación}))`);
    const sessionsResult = await airtableFetch('GET', `/Sesiones?filterByFormula=${encoded}`, null);

    let sessionsUpdated = 0;

    if (sessionsResult.status === 200 && sessionsResult.data?.records?.length > 0) {
      const sessions = sessionsResult.data.records;

      // Actualizar cada sesión en lotes de 10 (límite de Airtable)
      for (let i = 0; i < sessions.length; i += 10) {
        const batch = sessions.slice(i, i + 10);
        const batchBody = {
          records: batch.map(s => ({
            id: s.id,
            fields: { 'Activa': isActive }
          }))
        };

        await airtableFetch('PATCH', '/Sesiones', batchBody);
        sessionsUpdated += batch.length;
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        action,
        trainingId,
        sessionsUpdated,
        message: isActive ? 'Capacitación reactivada correctamente' : 'Capacitación finalizada correctamente'
      })
    };

  } catch (error) {
    console.error('Error en toggle-training-status:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
