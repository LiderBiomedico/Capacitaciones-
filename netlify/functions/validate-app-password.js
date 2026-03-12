// netlify/functions/validate-app-password.js
// Valida la contraseña de administrador leyéndola desde Airtable (tabla AppConfig)
// La fila con Key = "APP_PASSWORD" contiene el valor de la contraseña

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

  // Leer contraseña enviada por el usuario
  let password;
  try {
    const body = JSON.parse(event.body || '{}');
    password = body.password;
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Body inválido' }) };
  }

  if (!password) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Contraseña requerida' }) };
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Variables de entorno AIRTABLE_API_KEY / AIRTABLE_BASE_ID no configuradas en Netlify' })
    };
  }

  try {
    // Buscar en AppConfig la fila donde Key = "APP_PASSWORD"
    const filter = encodeURIComponent(`{Key}="APP_PASSWORD"`);
    const url = `https://api.airtable.com/v0/${baseId}/AppConfig?filterByFormula=${filter}&maxRecords=1`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('❌ Error consultando AppConfig:', res.status, err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Error al consultar la configuración en Airtable: ' + (err?.error?.message || res.status) })
      };
    }

    const data = await res.json();

    if (!data.records || data.records.length === 0) {
      console.error('❌ No se encontró APP_PASSWORD en AppConfig');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Contraseña no configurada. Agrega una fila en AppConfig con Key=APP_PASSWORD y Value=tu_contraseña' })
      };
    }

    const storedPassword = String(data.records[0].fields['Value'] || '').trim();

    if (!storedPassword) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'El campo Value de APP_PASSWORD está vacío en AppConfig' })
      };
    }

    // Comparar contraseñas
    if (String(password).trim() !== storedPassword) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Contraseña incorrecta' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('❌ Error en validate-app-password:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Error interno: ' + err.message })
    };
  }
};
