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
    const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`;

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
    let airtableJSON = null;
    try {
      airtableJSON = JSON.parse(airtableText);
    } catch (e) {
      // la respuesta NO es JSON válido (por ejemplo, HTML de error)
    }

    // Caso 1: Airtable respondió error tipo 401, 403, 404, etc.
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
          error: 'Airtable devolvió un estado no OK',
          airtableRaw: airtableText
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
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        records: airtableJSON.records || [],
        raw: airtableJSON
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
        details: err.message
      })
    };
  }
}
