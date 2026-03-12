// netlify/functions/upload-attendance-pdf.js
// Sube PDF al campo "Lista asistencia" en Airtable usando la Content API oficial
// Documentación: https://airtable.com/developers/web/api/upload-attachment
//
// Endpoint correcto:
//   POST https://api.airtable.com/v0/{baseId}/{tableIdOrName}/{recordId}/uploadAttachment/{fieldIdOrName}
//   Headers: Authorization: Bearer ..., Content-Type: <mime>, Content-Disposition: attachment; filename="..."
//   Body: binario del archivo

const https = require('https');

function makeRequest(options, bodyBuffer) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data;
        try { data = JSON.parse(raw); } catch { data = { raw: raw.slice(0, 500) }; }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ success: false, error: 'Método no permitido' }) };

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ success: false, error: 'Variables AIRTABLE_API_KEY / AIRTABLE_BASE_ID no configuradas en Netlify' }) };
  }

  let trainingId, fileName, fileBase64, mimeType;
  try {
    const body = JSON.parse(event.body || '{}');
    trainingId = body.trainingId;
    fileName   = body.fileName   || 'lista_asistencia.pdf';
    fileBase64 = body.fileBase64;
    mimeType   = body.mimeType   || 'application/pdf';
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ success: false, error: 'Body JSON inválido' }) };
  }

  if (!trainingId || !fileBase64) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ success: false, error: 'Faltan trainingId o fileBase64' }) };
  }

  const fileBuffer = Buffer.from(fileBase64, 'base64');
  console.log(`📎 Upload: "${fileName}" ${Math.round(fileBuffer.length / 1024)}KB → record ${trainingId}`);

  // ── Content API de Airtable (método oficial para archivos adjuntos) ──────
  // POST /v0/{baseId}/Capacitaciones/{recordId}/uploadAttachment/{fieldName}
  const fieldName = 'Lista asistencia';
  const uploadPath = `/v0/${baseId}/Capacitaciones/${trainingId}/uploadAttachment/${encodeURIComponent(fieldName)}`;

  const { status, data } = await makeRequest({
    hostname: 'api.airtable.com',
    port: 443,
    path: uploadPath,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '')}"`,
      'Content-Length': fileBuffer.length
    }
  }, fileBuffer);

  console.log(`Content API → ${status}:`, JSON.stringify(data).slice(0, 300));

  if (status === 200 || status === 201) {
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ success: true, message: `"${fileName}" guardado en Airtable correctamente`, attachment: data })
    };
  }

  // Mostrar error detallado de Airtable
  const errMsg = data?.error?.message || data?.error || data?.raw || JSON.stringify(data).slice(0, 300);
  console.error(`❌ Airtable error ${status}:`, errMsg);
  return {
    statusCode: 500,
    headers: cors,
    body: JSON.stringify({
      success: false,
      error: `Airtable respondió ${status}: ${errMsg}`,
      debug: { uploadPath, fieldName, trainingId }
    })
  };
};
