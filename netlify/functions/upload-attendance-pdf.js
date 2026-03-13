// /.netlify/functions/upload-attendance-pdf.js
// Guarda PDF de asistencia en la sesión vinculada a la capacitación
// Estrategia: GET la sesión → detectar campo attachment → guardar

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
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'El archivo supera 5MB' }) };
    }
    const safeFileName = fileName || 'lista_asistencia.pdf';
    const safeMimeType = mimeType || 'application/pdf';

    // ── PASO 1: Buscar sesión vinculada (filtro JS, no API) ─────────────────
    let sessionId = null;
    let sessionFields = {};

    try {
      let offset = null;
      const allSessions = [];
      do {
        const path = `/Sesiones?pageSize=100${offset ? '&offset=' + encodeURIComponent(offset) : ''}`;
        const res = await airtableFetch('GET', path);
        allSessions.push(...(res.data?.records || []));
        offset = res.data?.offset || null;
      } while (offset);

      console.log(`Sesiones totales encontradas: ${allSessions.length}`);

      const match = allSessions.find(s => {
        const linked = s.fields?.['Capacitaciones'] || s.fields?.['Capacitación'] || s.fields?.['Capacitacion'] || [];
        return Array.isArray(linked) && linked.includes(trainingId);
      });

      if (match) {
        sessionId = match.id;
        sessionFields = match.fields || {};
        console.log(`Sesión encontrada: ${sessionId}`);
        console.log(`Campos de la sesión: ${Object.keys(sessionFields).join(', ')}`);
      }
    } catch (e) {
      console.warn('Error buscando sesiones:', e.message);
    }

    // ── PASO 2: Si no hay sesión, crearla ───────────────────────────────────
    if (!sessionId) {
      console.log('Sin sesión vinculada, creando una nueva...');
      try {
        const capRes = await airtableFetch('GET', `/Capacitaciones/${trainingId}`);
        const capFields = capRes.data?.fields || {};
        const capCode = trainingCode || capFields['Código de Acceso'] || capFields['Código Acceso'] || 'ASIST';
        const siteUrl = process.env.SITE_URL || 'https://capacitaciones-hslv.netlify.app';

        const newSes = await airtableFetch('POST', '/Sesiones', {
          fields: {
            'Código Acceso': capCode,
            'Capacitaciones': [trainingId],
            'Activa': true,
            'Fecha Inicio': new Date().toISOString().split('T')[0],
            'Link Acceso': `${siteUrl}?code=${capCode}`
          }
        });

        if (newSes.status < 400 && newSes.data?.id) {
          sessionId = newSes.data.id;
          sessionFields = newSes.data.fields || {};
          console.log('Sesión creada:', sessionId);
          console.log('Campos sesión nueva:', Object.keys(sessionFields).join(', '));
        } else {
          console.warn('No se pudo crear sesión:', JSON.stringify(newSes.data));
        }
      } catch (e) {
        console.warn('Error creando sesión:', e.message);
      }
    }

    if (!sessionId) {
      return {
        statusCode: 422,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'No se encontró ni se pudo crear una sesión vinculada a esta capacitación.' })
      };
    }

    // ── PASO 3: GET detallado de la sesión para ver campos reales ───────────
    // Esto nos da el schema real incluyendo campos vacíos que no aparecen en GET lista
    try {
      const detailRes = await airtableFetch('GET', `/Sesiones/${sessionId}`);
      if (detailRes.status < 400) {
        sessionFields = detailRes.data?.fields || sessionFields;
        console.log('Campos detallados sesión:', Object.keys(sessionFields).join(', '));
      }
    } catch (e) { /* ignorar */ }

    // ── PASO 4: Subir archivo ────────────────────────────────────────────────
    let attachmentValue;
    try {
      const uploadResult = await uploadToAirtableContent(fileBase64, safeFileName, safeMimeType);
      if (uploadResult.status === 200 && uploadResult.data?.uploadedFiles?.[0]?.url) {
        attachmentValue = [{ url: uploadResult.data.uploadedFiles[0].url, filename: safeFileName }];
        console.log('Archivo subido via Content API');
      } else {
        throw new Error(`Content API ${uploadResult.status}: ${JSON.stringify(uploadResult.data).slice(0, 200)}`);
      }
    } catch (uploadErr) {
      console.warn('Content API falló, usando data URL:', uploadErr.message);
      attachmentValue = [{ url: `data:${safeMimeType};base64,${fileBase64}`, filename: safeFileName }];
    }

    // ── PASO 5: Intentar guardar con múltiples nombres de campo ─────────────
    // Candidatos en orden de probabilidad (basado en lo visto en Airtable)
    const fieldCandidates = [
      'Lista asistencia',       // nombre exacto visto en la imagen
      'Lista de asistencia',    // variante con 'de'
      'Lista de Asistencia',    // variante capitalizada
      'Lista Asistencia',       // variante sin preposición
      'Attachment',             // campo genérico
      'Adjunto',                // en español
      'Archivo',                // otra variante
    ];

    let savedField = null;
    let lastError = '';

    for (const fieldName of fieldCandidates) {
      console.log(`Intentando campo: "${fieldName}"`);
      const res = await airtableFetch('PATCH', `/Sesiones/${sessionId}`, {
        fields: { [fieldName]: attachmentValue }
      });

      if (res.status < 400) {
        savedField = fieldName;
        console.log(`✅ Guardado con campo: "${fieldName}"`);
        break;
      }

      const errMsg = (res.data?.error?.message || res.data?.error || JSON.stringify(res.data) || '').toLowerCase();
      lastError = res.data?.error?.message || errMsg;
      console.warn(`Campo "${fieldName}" falló (${res.status}): ${lastError.slice(0, 100)}`);

      // Si el error no es de campo desconocido, parar — es otro tipo de error
      if (!errMsg.includes('unknown field') && !errMsg.includes('campo desconocido')) {
        break;
      }
    }

    if (savedField) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: `PDF guardado correctamente (campo: "${savedField}")`,
          recordId: sessionId,
          savedIn: 'Sesiones',
          fieldUsed: savedField
        })
      };
    }

    // ── PASO 6: Diagnóstico — devolver los campos reales de la sesión ────────
    return {
      statusCode: 422,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: `No se pudo guardar el PDF. Último error: "${lastError}". Campos disponibles en la sesión: [${Object.keys(sessionFields).join(', ')}]. Por favor verifica el nombre exacto del campo de attachment en Airtable.`,
        sessionId,
        sessionFields: Object.keys(sessionFields)
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
