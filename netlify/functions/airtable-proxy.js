// netlify/functions/airtable-proxy.js
// Proxy seguro para todas las peticiones a Airtable
// Las credenciales viven SOLO en variables de entorno del servidor

exports.handler = async (event) => {
  // Manejar CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Método no permitido' });
  }

  const apiKey  = process.env.AIRTABLE_API_KEY;
  const baseId  = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error('❌ Variables de entorno AIRTABLE_API_KEY o AIRTABLE_BASE_ID no configuradas');
    return respond(500, { error: 'Configuración del servidor incompleta. Verifica las variables de entorno en Netlify.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Body inválido (no es JSON)' });
  }

  const { method = 'GET', path: endpointPath = '', body: requestBody } = body;

  if (!endpointPath) {
    return respond(400, { error: 'Falta el parámetro "path"' });
  }

  // Construir URL de Airtable
  const baseUrl = `https://api.airtable.com/v0/${baseId}`;
  const url = `${baseUrl}${endpointPath}`;

  const fetchOptions = {
    method: method.toUpperCase(),
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };

  if (requestBody && ['POST', 'PATCH', 'PUT'].includes(method.toUpperCase())) {
    fetchOptions.body = JSON.stringify(requestBody);
  }

  try {
    const airtableResponse = await fetch(url, fetchOptions);
    const data = await airtableResponse.json();

    if (!airtableResponse.ok) {
      console.error('❌ Error Airtable:', airtableResponse.status, data);
      return respond(airtableResponse.status, {
        success: false,
        error: data?.error?.message || `Error ${airtableResponse.status} de Airtable`
      });
    }

    // Airtable devuelve los registros en data.records para listas
    return respond(200, {
      success: true,
      ...data
    });

  } catch (err) {
    console.error('❌ Error de red al contactar Airtable:', err.message);
    return respond(502, { success: false, error: 'Error de red al contactar Airtable: ' + err.message });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body)
  };
}
