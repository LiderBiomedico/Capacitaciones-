// /.netlify/functions/upload-attendance-pdf.js
// Sube PDF de lista de asistencia al campo 'Lista asistencia' de la tabla Sesiones
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
        catch (e) { resolve({ status: res.statusCode, data: { raw: data } }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Sube el archivo binario a la Content API de Airtable
function uploadToAirtableContent(fileBase64, fileName, mimeType) {
  return new Promise((resolve, reject) => {
    const API_KEY = process.env.AIRTABLE_API_KEY;
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const boundary = '----FormBoundary' + Date.now().toString(16);
    const headerPart = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const footerPart = `\r\n--${boundary}--\r\n`;
    const totalLength = Buffer.byteLength(headerPart) + fileBuffer.length + Buffer.byteLength(footerPart);

    const options = {
      hostname: 'content.airtable.com',
      path: '/v0/uploadFiles',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLength
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
    req.write(headerPart);
    req.write(fileBuffer);
    req.write(footerPart);
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
    const { trainingId, fileName, fileBase64, mimeType } = JSON.parse(event.body || '{}');

    if (!trainingId || !fileBase64 || !fileName) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'trainingId, fileName y fileBase64 son requeridos' }) };
    }

    const fileSizeBytes = Buffer.byteLength(fileBase64, 'base64');
    if (fileSizeBytes > 5 * 1024 * 1024) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'El archivo supera el límite de 5MB' }) };
    }

    const safeFileName = fileName || 'lista_asistencia.pdf';
    const safeMimeType = mimeType || 'application/pdf';

    // ── Buscar la sesión vinculada a esta capacitación ──────────────────────
    // Traer todas las sesiones y filtrar en JS (ARRAYJOIN devuelve nombres, no IDs)
    const BASE_ID = process.env.AIRTABLE_BASE_ID;
    const sesRes = await airtableFetch('GET', `/Sesiones?pageSize=100`);
    const allSessions = sesRes.data?.records || [];

    let targetId = null;  // ID del registro donde se guardará el PDF
    let targetTable = 'Sesiones';

    // Buscar sesión cuyo campo 'Capacitaciones' incluya el trainingId
    const matchingSession = allSessions.find(s => {
      const capLinked = s.fields?.['Capacitaciones'] || s.fields?.['Capacitación'] || s.fields?.['Capacitacion'] || [];
      return Array.isArray(capLinked) && capLinked.includes(trainingId);
    });

    if (matchingSession) {
      targetId = matchingSession.id;
      console.log(`✅ Sesión encontrada: ${targetId}`);
    } else {
      // Fallback: guardar directamente en la Capacitación si no hay sesión
      targetId = trainingId;
      targetTable = 'Capacitaciones';
      console.warn('⚠️ No se encontró sesión vinculada, guardando en Capacitaciones');
    }

    // ── Subir el archivo ─────────────────────────────────────────────────────
    let attachmentValue;

    try {
      const uploadResult = await uploadToAirtableContent(fileBase64, safeFileName, safeMimeType);
      if (uploadResult.status === 200 && uploadResult.data?.uploadedFiles?.[0]?.url) {
        const fileUrl = uploadResult.data.uploadedFiles[0].url;
        attachmentValue = [{ url: fileUrl, filename: safeFileName }];
        console.log('✅ Subido via Content API');
      } else {
        throw new Error(`Content API status ${uploadResult.status}: ${JSON.stringify(uploadResult.data)}`);
      }
    } catch (uploadErr) {
      // Fallback: data URL (funciona para archivos pequeños en Airtable)
      console.warn('⚠️ Content API falló, usando data URL:', uploadErr.message);
      const dataUrl = `data:${safeMimeType};base64,${fileBase64}`;
      attachmentValue = [{ url: dataUrl, filename: safeFileName }];
    }

    // ── Guardar en Airtable ──────────────────────────────────────────────────
    const fieldName = targetTable === 'Sesiones' ? 'Lista asistencia' : 'Lista de Asistencia';
    const updateResult = await airtableFetch(
      'PATCH',
      `/${targetTable}/${targetId}`,
      { fields: { [fieldName]: attachmentValue } }
    );

    if (updateResult.status >= 400) {
      const errMsg = updateResult.data?.error?.message || updateResult.data?.error || `Error Airtable ${updateResult.status}`;
      return { statusCode: updateResult.status, headers: corsHeaders, body: JSON.stringify({ success: false, error: errMsg, detail: updateResult.data }) };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: `PDF guardado en ${targetTable}`,
        recordId: updateResult.data?.id,
        savedIn: targetTable
      })
    };

  } catch (error) {
    console.error('Error en upload-attendance-pdf:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
