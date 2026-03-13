/**
 * upload-attendance-pdf.js
 * Sube PDF al campo "Lista de Asistencia" en la tabla Sesiones de Airtable.
 *
 * USA content.airtable.com con multipart/form-data — mismo método que
 * upload-pdf-attachment.js que ya funciona en el proyecto.
 */

const https = require('https');
const AIRTABLE_API = 'https://api.airtable.com/v0';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

async function airtableFetch(url, options) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.error || `Error Airtable ${res.status}`);
  return json;
}

async function fetchAllRecords(baseId, table, token) {
  let records = [], offset = null;
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    const data = await airtableFetch(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    records = records.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);
  return records;
}

// Método probado: content.airtable.com + multipart/form-data
function uploadToAirtableContent({ token, baseId, table, recordId, fieldName, fileName, fileBuffer, mimeType }) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now().toString(16);
    const before = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    );
    const after = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([before, fileBuffer, after]);

    const req = https.request({
      hostname: 'content.airtable.com',
      path: `/v0/${baseId}/${encodeURIComponent(table)}/${recordId}/uploadAttachment/${encodeURIComponent(fieldName)}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ success: false, error: 'Método no permitido' }) };

  const token  = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ success: false, error: 'Variables AIRTABLE_API_KEY y AIRTABLE_BASE_ID no configuradas.' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ success: false, error: 'Body JSON inválido' }) }; }

  const { trainingId, trainingCode, sessionId, fileName, fileBase64, mimeType } = body;

  if (!fileBase64) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ success: false, error: 'No se recibió el archivo.' }) };
  if (!sessionId && !trainingId && !trainingCode) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ success: false, error: 'Se requiere sessionId, trainingId o trainingCode.' }) };

  // Paso 1: base64 → Buffer
  let fileBuffer;
  try { fileBuffer = Buffer.from(fileBase64, 'base64'); }
  catch { return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ success: false, error: 'Base64 inválido.' }) }; }

  if (fileBuffer.length > 5 * 1024 * 1024) return {
    statusCode: 413, headers: corsHeaders(),
    body: JSON.stringify({ success: false, error: `Archivo muy grande (${(fileBuffer.length/1024/1024).toFixed(1)} MB). Máximo 5 MB.` }),
  };

  const safeFileName = (fileName || 'lista_asistencia.pdf').replace(/[^a-zA-Z0-9._\-]/g, '_');

  // Paso 2: Encontrar sesión destino
  let sessionRecord = null, sessionFieldsList = [];
  try {
    if (sessionId) {
      sessionRecord = await airtableFetch(`${AIRTABLE_API}/${baseId}/Sesiones/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } });
    }
    if (!sessionRecord) {
      const all = await fetchAllRecords(baseId, 'Sesiones', token);
      sessionFieldsList = all.length > 0 ? Object.keys(all[0].fields || {}) : [];
      if (trainingId) {
        const linked = all.filter(s => {
          const cap = s.fields?.['Capacitaciones'] || s.fields?.['Capacitación'] || s.fields?.['Capacitacion'] || [];
          return (Array.isArray(cap) ? cap : []).includes(trainingId);
        });
        if (linked.length > 0) {
          linked.sort((a, b) => (b.fields?.['Fecha Inicio'] || '').localeCompare(a.fields?.['Fecha Inicio'] || ''));
          sessionRecord = linked[0];
        }
      }
      if (!sessionRecord && trainingCode) {
        const code = trainingCode.toString().toUpperCase().trim();
        sessionRecord = all.find(s => (s.fields?.['Código Acceso'] || s.fields?.['Código de Acceso'] || '').toString().toUpperCase().trim() === code) || null;
      }
    }
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ success: false, error: `Error consultando Sesiones: ${err.message}` }) };
  }

  if (!sessionRecord) return {
    statusCode: 404, headers: corsHeaders(),
    body: JSON.stringify({ success: false, error: 'No se encontró la sesión en Airtable.', sessionFields: sessionFieldsList }),
  };

  // Paso 3: Subir con content.airtable.com (multipart/form-data)
  try {
    const result = await uploadToAirtableContent({
      token, baseId, table: 'Sesiones', recordId: sessionRecord.id,
      fieldName: 'Lista de Asistencia', fileName: safeFileName,
      fileBuffer, mimeType: mimeType || 'application/pdf',
    });

    if (result.status >= 200 && result.status < 300) {
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, sessionId: sessionRecord.id, fileName: safeFileName, message: 'PDF guardado correctamente.' }) };
    }

    const errMsg = typeof result.body === 'object'
      ? (result.body?.error?.message || result.body?.error || JSON.stringify(result.body))
      : result.body;
    throw new Error(`${errMsg} (status ${result.status})`);

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ success: false, error: err.message }) };
  }
};
