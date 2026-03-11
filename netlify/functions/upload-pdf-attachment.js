/* =========================================================
   FUNCIÓN: upload-pdf-attachment
   Sube un PDF como attachment al campo "Lista asistencia"
   de un registro en la tabla Capacitaciones de Airtable.

   UBICAR ESTE ARCHIVO EN:
   netlify/functions/upload-pdf-attachment.js
   ========================================================= */

const https = require('https');

exports.handler = async (event) => {
  // Solo POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { recordId, fileName, fileBase64, contentType } = JSON.parse(event.body);

    if (!recordId || !fileName || !fileBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan parámetros: recordId, fileName, fileBase64' }) };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Variables de entorno no configuradas' }) };
    }

    // Convertir base64 a Buffer
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const mimeType = contentType || 'application/pdf';

    // Usar la API de upload de Airtable (content.airtable.com)
    // POST /v0/{baseId}/{tableId}/{recordId}/uploadAttachment/{fieldName}
    // con multipart/form-data

    const boundary = '----FormBoundary' + Date.now().toString(16);

    // Construir el body multipart
    const fieldName = 'Lista asistencia';
    const encodedFieldName = encodeURIComponent(fieldName);

    // Construir multipart body manualmente
    const beforeFile = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );
    const afterFile = Buffer.from(`\r\n--${boundary}--\r\n`);

    const bodyBuffer = Buffer.concat([beforeFile, fileBuffer, afterFile]);

    // Hacer el request HTTPS a Airtable Content API
    const uploadResult = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'content.airtable.com',
        path: `/v0/${AIRTABLE_BASE_ID}/Capacitaciones/${recordId}/uploadAttachment/${encodedFieldName}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on('error', reject);
      req.write(bodyBuffer);
      req.end();
    });

    if (uploadResult.status >= 200 && uploadResult.status < 300) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, result: uploadResult.body })
      };
    } else {
      return {
        statusCode: uploadResult.status,
        body: JSON.stringify({ success: false, error: uploadResult.body })
      };
    }

  } catch (err) {
    console.error('Error en upload-pdf-attachment:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
