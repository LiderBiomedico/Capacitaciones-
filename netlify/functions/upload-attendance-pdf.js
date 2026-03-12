// netlify/functions/upload-attendance-pdf.js
// Sube un PDF al campo "Lista asistencia" de una capacitación en Airtable
// Usa https nativo de Node.js - sin dependencias externas
//
// ESTRATEGIA DUAL:
//   1. Content API de Airtable: POST uploadAttachment (método oficial)
//   2. Fallback: PATCH con data URL base64

const https = require('https');

function httpsRequest(options, bodyBuffer) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: { raw: body.slice(0, 500) } }); }
      });
    });
    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Método no permitido' }) };
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Variables AIRTABLE_API_KEY / AIRTABLE_BASE_ID no configuradas' }) };
  }

  let trainingId, fileName, fileBase64, mimeType;
  try {
    const body = JSON.parse(event.body || '{}');
    trainingId = body.trainingId;
    fileName   = body.fileName   || 'lista_asistencia.pdf';
    fileBase64 = body.fileBase64;
    mimeType   = body.mimeType   || 'application/pdf';
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Body inválido' }) };
  }

  if (!trainingId || !fileBase64) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Faltan trainingId o fileBase64' }) };
  }

  const fileBuffer = Buffer.from(fileBase64, 'base64');
  console.log(`📎 Subiendo "${fileName}" (${Math.round(fileBuffer.length/1024)}KB) → capacitación ${trainingId}`);

  try {
    // ── Método 1: Content API ─────────────────────────────────────────────
    const uploadPath = `/v0/${baseId}/Capacitaciones/${trainingId}/uploadAttachment/Lista%20asistencia`;
    const { status: s1, data: d1 } = await httpsRequest({
      hostname: 'content.airtableusercontent.com',
      port: 443,
      path: uploadPath,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': fileBuffer.length
      }
    }, fileBuffer);

    console.log(`Content API → ${s1}:`, JSON.stringify(d1).slice(0, 200));

    if (s1 === 200 || s1 === 201) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: `PDF guardado en Airtable`, attachment: d1 }) };
    }

    // ── Método 2: PATCH con data URL ──────────────────────────────────────
    console.warn(`Content API falló (${s1}), intentando PATCH...`);
    const patchBodyStr = JSON.stringify({
      fields: { 'Lista asistencia': [{ url: `data:${mimeType};base64,${fileBase64}`, filename: fileName }] }
    });
    const patchBuf = Buffer.from(patchBodyStr, 'utf8');

    const { status: s2, data: d2 } = await httpsRequest({
      hostname: 'api.airtable.com',
      port: 443,
      path: `/v0/${baseId}/Capacitaciones/${trainingId}`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': patchBuf.length
      }
    }, patchBuf);

    console.log(`PATCH → ${s2}:`, JSON.stringify(d2).slice(0, 200));

    if (s2 === 200) {
      const att = (d2.fields?.['Lista asistencia'] || [])[0];
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: `PDF guardado en Airtable`, attachment: att }) };
    }

    throw new Error(`Error ${s2}: ${d2?.error?.message || JSON.stringify(d2).slice(0, 200)}`);

  } catch (err) {
    console.error('❌ upload-attendance-pdf:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
