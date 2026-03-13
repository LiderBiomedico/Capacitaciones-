// /.netlify/functions/upload-attendance-pdf.js
// Guarda PDF en campo 'Lista asistencia' de la tabla Sesiones
// Si no hay sesión vinculada, la crea automáticamente
// Variables de entorno: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, SITE_URL

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
      res.on('data', chunk => { data += chunk; });
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
      res.on('data', chunk => { data += chunk; });
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
    const { trainingId, trainingCode, fileName, fileBase64, mimeType } = JSON.parse(event.body || '{}');

    if (!trainingId || !fileBase64 || !fileName) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'trainingId, fileName y fileBase64 son requeridos' }) };
    }

    const fileSizeBytes = Buffer.byteLength(fileBase64, 'base64');
    if (fileSizeBytes > 5 * 1024 * 1024) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'El archivo supera el límite de 5MB' }) };
    }

    const safeFileName = fileName || 'lista_asistencia.pdf';
    const safeMimeType = mimeType || 'application/pdf';

    // ── 1. Buscar sesión vinculada (filtro en JS) ───────────────────────────
    let sessionId = null;
    let allSessions = [];

    try {
      let offset = null;
      do {
        const path = `/Sesiones?pageSize=100${offset ? '&offset=' + encodeURIComponent(offset) : ''}`;
        const res = await airtableFetch('GET', path);
        allSessions.push(...(res.data?.records || []));
        offset = res.data?.offset || null;
      } while (offset);

      const match = allSessions.find(s => {
        const linked = s.fields?.['Capacitaciones'] || s.fields?.['Capacitación'] || s.fields?.['Capacitacion'] || [];
        return Array.isArray(linked) && linked.includes(trainingId);
      });
      if (match) {
        sessionId = match.id;
        console.log('✅ Sesión vinculada encontrada:', sessionId);
      }
    } catch (e) {
      console.warn('⚠️ Error buscando sesiones:', e.message);
    }

    // ── 2. Si no hay sesión, crear una nueva automáticamente ───────────────
    if (!sessionId) {
      console.log('⚠️ Sin sesión vinculada, creando una automáticamente...');
      try {
        // Obtener datos de la capacitación para el código
        const capRes = await airtableFetch('GET', `/Capacitaciones/${trainingId}`);
        const capFields = capRes.data?.fields || {};
        const capCode = trainingCode || capFields['Código de Acceso'] || capFields['Código Acceso'] || 'ASIST';
        const siteUrl = process.env.SITE_URL || 'https://capacitaciones-hslv.netlify.app';

        const newSession = await airtableFetch('POST', '/Sesiones', {
          fields: {
            'Código Acceso': capCode,
            'Capacitaciones': [trainingId],
            'Activa': true,
            'Fecha Inicio': new Date().toISOString().split('T')[0],
            'Link Acceso': `${siteUrl}?code=${capCode}`
          }
        });

        if (newSession.status < 400 && newSession.data?.id) {
          sessionId = newSession.data.id;
          console.log('✅ Sesión creada automáticamente:', sessionId);
        } else {
          console.warn('⚠️ No se pudo crear sesión:', JSON.stringify(newSession.data));
        }
      } catch (e) {
        console.warn('⚠️ Error creando sesión:', e.message);
      }
    }

    // ── 3. Subir archivo a Airtable Content API ────────────────────────────
    let attachmentValue;
    try {
      const uploadResult = await uploadToAirtableContent(fileBase64, safeFileName, safeMimeType);
      if (uploadResult.status === 200 && uploadResult.data?.uploadedFiles?.[0]?.url) {
        attachmentValue = [{ url: uploadResult.data.uploadedFiles[0].url, filename: safeFileName }];
        console.log('✅ Archivo subido via Content API');
      } else {
        throw new Error(`Content API status ${uploadResult.status}: ${JSON.stringify(uploadResult.data)}`);
      }
    } catch (uploadErr) {
      console.warn('⚠️ Content API falló, usando data URL:', uploadErr.message);
      attachmentValue = [{ url: `data:${safeMimeType};base64,${fileBase64}`, filename: safeFileName }];
    }

    // ── 4. Guardar en la sesión ────────────────────────────────────────────
    if (sessionId) {
      const updateRes = await airtableFetch('PATCH', `/Sesiones/${sessionId}`, {
        fields: { 'Lista asistencia': attachmentValue }
      });

      if (updateRes.status < 400) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            message: 'PDF guardado correctamente en Sesiones',
            recordId: sessionId,
            savedIn: 'Sesiones',
            fieldUsed: 'Lista asistencia'
          })
        };
      }

      const err422 = updateRes.data?.error?.message || JSON.stringify(updateRes.data);
      console.error('❌ Error guardando en Sesiones:', err422);
      return {
        statusCode: updateRes.status,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: err422, hint: 'Verifica que el campo "Lista asistencia" existe en la tabla Sesiones de Airtable.' })
      };
    }

    // ── 5. Fallback total: error con instrucciones ────────────────────────
    return {
      statusCode: 422,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'No se pudo vincular o crear una sesión para esta capacitación. Ve a Airtable y crea manualmente una sesión vinculada a esta capacitación, luego intenta de nuevo.'
      })
    };

  } catch (error) {
    console.error('Error en upload-attendance-pdf:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
