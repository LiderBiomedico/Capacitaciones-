// netlify/functions/airtable-proxy.js

// Esta función actúa como puente seguro entre el frontend y Airtable.
// Usa variables de entorno configuradas en Netlify (NO las pongas en el frontend).

export async function handler(event) {
  // permitir sólo POST desde el frontend
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed. Use POST.'
      })
    };
  }

  try {
    // El body que manda tu index.html:
    // {
    //   "method": "GET" | "POST" | "PATCH" | ...
    //   "path": "/Capacitaciones?maxRecords=1"
    //   "body": { ... }  <-- opcional
    // }
    const payload = JSON.parse(event.body || '{}');
    const { method, path, body } = payload;

    // Validaciones básicas
    if (!method || !path) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Faltan parámetros: method o path'
        })
      };
    }

    // Variables secretas que debes poner en Netlify
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Variables de entorno no configuradas en Netlify (AIRTABLE_API_KEY o AIRTABLE_BASE_ID)'
        })
      };
    }
    
    const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`;

    // Log para debugging (se puede quitar en producción)
    console.log('🔄 Llamando a Airtable:', method, path);
    if (body) {
      console.log('📤 Body:', JSON.stringify(body, null, 2));
    }

    // Hacemos la llamada real a Airtable
    const airtableRes = await fetch(AIRTABLE_URL, {
      method,
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      // si el método tiene body (POST, PATCH...) lo enviamos, si no, null
      body: (method === 'POST' || method === 'PATCH' || method === 'PUT')
        ? JSON.stringify(body || {})
        : undefined
    });

    const airtableText = await airtableRes.text(); // primero como texto bruto
    console.log('📥 Respuesta Airtable (status ' + airtableRes.status + '):', airtableText.substring(0, 500));
    
    let airtableJSON = null;
    try {
      airtableJSON = JSON.parse(airtableText);
    } catch (e) {
      // la respuesta NO es JSON válido (por ejemplo, HTML de error)
      console.error('❌ Respuesta no es JSON:', airtableText.substring(0, 200));
    }

    // Caso 1: Airtable respondió error tipo 401, 403, 404, 422, etc.
    if (!airtableRes.ok) {
      return {
        statusCode: airtableRes.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          status: airtableRes.status,
          error: airtableJSON?.error?.message || 'Airtable devolvió un estado no OK',
          errorType: airtableJSON?.error?.type || 'UNKNOWN_ERROR',
          // Incluir detalles del error para debugging
          airtableResponse: airtableJSON || airtableText
        })
      };
    }

    // Caso 2: OK pero no pudimos parsear JSON (raro, pero puede pasar si hay proxy mal configurado)
    if (!airtableJSON) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Respuesta de Airtable no es JSON válido',
          airtableRaw: airtableText
        })
      };
    }

    // Caso 3: todo bien → Devolvemos un formato consistente
    // En un GET a /Capacitaciones, Airtable responde algo tipo:
    // { "records":[ { "id":"rec123", "fields":{...}, "createdTime":... }, ... ] }
    // En un POST, Airtable responde:
    // { "id":"rec123", "fields":{...}, "createdTime":... }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        ...airtableJSON // Devuelve todo: records, id, fields, etc.
      })
    };

  } catch (err) {
    console.error('❌ Error en airtable-proxy:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Excepción en airtable-proxy',
        details: err.message,
        stack: err.stack
      })
    };
  }
}