// netlify/functions/upload-attendance-pdf.js
// Sube el PDF de lista de asistencia al campo "Lista asistencia" de la capacitación en Airtable
// Airtable requiere una URL pública para adjuntos; usamos su API de upload de attachments

const AIRTABLE_API = 'https://api.airtable.com/v0';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Método no permitido' }) };
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Variables de entorno no configuradas' }) };
  }

  let trainingId, fileName, fileBase64, mimeType;
  try {
    const body = JSON.parse(event.body || '{}');
    trainingId = body.trainingId;
    fileName   = body.fileName || 'lista_asistencia.pdf';
    fileBase64 = body.fileBase64; // base64 del PDF sin prefijo data:...
    mimeType   = body.mimeType || 'application/pdf';
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Body inválido' }) };
  }

  if (!trainingId || !fileBase64) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Faltan parámetros: trainingId y fileBase64 son requeridos' }) };
  }

  try {
    // Airtable Content API: subir attachment directamente
    // POST https://content.airtableusercontent.com/v2/s3Upload
    // Primero obtenemos una URL firmada de Airtable, luego subimos el archivo

    // Paso 1: Solicitar URL de upload a Airtable
    const uploadRequestUrl = `https://content.airtableusercontent.com/v2/${baseId}/Capacitaciones/${trainingId}/uploadAttachment/Lista%20asistencia`;

    const fileBuffer = Buffer.from(fileBase64, 'base64');

    const uploadRes = await fetch(uploadRequestUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': fileBuffer.length.toString()
      },
      body: fileBuffer
    });

    if (!uploadRes.ok) {
      const errData = await uploadRes.json().catch(() => ({}));
      console.error('❌ Error subiendo adjunto a Airtable:', uploadRes.status, errData);

      // Fallback: intentar actualizar el campo como URL (si el archivo está en algún CDN)
      // En este caso informamos al usuario que Airtable requiere URL pública
      return {
        statusCode: uploadRes.status,
        headers,
        body: JSON.stringify({
          success: false,
          error: errData?.error?.message || 'Error al subir el archivo a Airtable. Airtable requiere que los adjuntos se suban desde una URL pública o mediante su Content API.',
          hint: 'Verifica que tu token de Airtable tenga el scope "data.records:write" y "webhook:manage".'
        })
      };
    }

    const uploadData = await uploadRes.json();
    console.log('✅ Adjunto subido exitosamente:', uploadData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'PDF subido correctamente a Airtable',
        attachment: uploadData
      })
    };

  } catch (err) {
    console.error('❌ Error en upload-attendance-pdf:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
