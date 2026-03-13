// /.netlify/functions/upload-attendance-pdf.js
// Sube un PDF de lista de asistencia a Airtable como attachment
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

// Sube el archivo a la Content API de Airtable y devuelve la URL
function uploadToAirtableContent(fileBase64, fileName, mimeType) {
  return new Promise((resolve, reject) => {
    const API_KEY = process.env.AIRTABLE_API_KEY;
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const boundary = '----FormBoundary' + Date.now().toString(16);

    const bodyParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
      fileBuffer,
      `\r\n--${boundary}--\r\n`
    ];

    const totalLength = bodyParts.reduce((sum, part) => sum + (typeof part === 'string' ? Buffer.byteLength(part) : part.length), 0);

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

    bodyParts.forEach(part => {
      if (typeof part === 'string') req.write(part);
      else req.write(part);
    });
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

    // Verificar tamaño (4MB en base64 ≈ 5.3MB)
    const fileSizeBytes = Buffer.byteLength(fileBase64, 'base64');
    if (fileSizeBytes > 5 * 1024 * 1024) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'El archivo supera el límite de 5MB' }) };
    }

    const safeFileName = fileName || 'lista_asistencia.pdf';
    const safeMimeType = mimeType || 'application/pdf';

    // Intentar usar la Content API de Airtable para subir el archivo
    // Si falla, usar URL de datos directamente en el campo attachment
    let attachmentFields;

    try {
      const uploadResult = await uploadToAirtableContent(fileBase64, safeFileName, safeMimeType);
      if (uploadResult.status === 200 && uploadResult.data?.uploadedFiles?.[0]?.url) {
        const fileUrl = uploadResult.data.uploadedFiles[0].url;
        attachmentFields = { 'Lista de Asistencia': [{ url: fileUrl, filename: safeFileName }] };
      } else {
        throw new Error('Upload API no disponible');
      }
    } catch (uploadErr) {
      // Fallback: guardar como data URL directamente
      console.warn('⚠️ Content API no disponible, usando data URL:', uploadErr.message);
      const dataUrl = `data:${safeMimeType};base64,${fileBase64}`;
      attachmentFields = { 'Lista de Asistencia': [{ url: dataUrl, filename: safeFileName }] };
    }

    // Actualizar el registro de la capacitación con el attachment
    const updateResult = await airtableFetch('PATCH', `/Capacitaciones/${trainingId}`, { fields: attachmentFields });

    if (updateResult.status >= 400) {
      const errMsg = updateResult.data?.error?.message || updateResult.data?.error || `Error Airtable ${updateResult.status}`;
      return { statusCode: updateResult.status, headers: corsHeaders, body: JSON.stringify({ success: false, error: errMsg }) };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: 'PDF guardado correctamente', recordId: updateResult.data?.id })
    };

  } catch (error) {
    console.error('Error en upload-attendance-pdf:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
