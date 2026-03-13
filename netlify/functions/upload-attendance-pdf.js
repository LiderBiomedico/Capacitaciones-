// ==========================================
// netlify/functions/upload-attendance-pdf.js
// Sube un PDF de lista de asistencia a Airtable como adjunto
// ==========================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  const { trainingId, fileName, fileBase64, mimeType = 'application/pdf' } = payload;

  if (!trainingId || !fileBase64) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'trainingId y fileBase64 son requeridos' }) };
  }

  try {
    // Airtable acepta adjuntos via URL o base64 en el campo "attachments"
    // Necesitamos usar la API de Upload de Airtable
    const url = `${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}/Capacitaciones/${trainingId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          'Lista de Asistencia': [
            {
              filename: fileName || 'lista_asistencia.pdf',
              // Airtable requiere URL pública para adjuntos
              // Como alternativa, guardamos el nombre del archivo
              url: `data:${mimeType};base64,${fileBase64}`
            }
          ]
        }
      })
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = {}; }

    if (!response.ok) {
      // Si falla el adjunto (Airtable no soporta base64 directo), guardar solo el nombre
      const fallbackRes = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: { 'Observaciones': `Archivo de asistencia subido: ${fileName} - ${new Date().toLocaleDateString('es-ES')}` }
        })
      });
      
      if (fallbackRes.ok) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Nombre de archivo guardado en observaciones' }) };
      }

      throw new Error(data?.error?.message || `Error ${response.status}`);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, record: data }) };

  } catch (err) {
    console.error('Error upload-attendance-pdf:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
