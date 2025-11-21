// netlify/functions/airtable-proxy.js
// ═════════════════════════════════════════════════════════════════
// Proxy seguro para comunicarse con Airtable
// Usa variables de entorno (NO expone credenciales en frontend)
// ═════════════════════════════════════════════════════════════════

export async function handler(event) {
  // Permitir solo POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Solo se permite POST'
      })
    };
  }

  try {
    // ═════════════════════════════════════════════════════════════
    // PASO 1: Parsear el body del request
    // ═════════════════════════════════════════════════════════════
    
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.error('❌ Error parseando JSON:', parseError);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'JSON inválido en el body',
          details: parseError.message
        })
      };
    }

    const { method, path, body } = payload;

    // ═════════════════════════════════════════════════════════════
    // PASO 2: Validar parámetros
    // ═════════════════════════════════════════════════════════════

    if (!method || !path) {
      console.warn('⚠️ Parámetros faltantes:', { method, path });
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Faltan parámetros: method y/o path'
        })
      };
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 3: Obtener credenciales del ambiente
    // ═════════════════════════════════════════════════════════════

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      console.error('❌ Variables de entorno no configuradas:', {
        AIRTABLE_API_KEY: AIRTABLE_API_KEY ? '***' : 'FALTA',
        AIRTABLE_BASE_ID: AIRTABLE_BASE_ID ? '***' : 'FALTA'
      });
      
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Variables de entorno no configuradas en Netlify',
          missing: {
            AIRTABLE_API_KEY: !AIRTABLE_API_KEY,
            AIRTABLE_BASE_ID: !AIRTABLE_BASE_ID
          }
        })
      };
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 4: Construir URL de Airtable
    // ═════════════════════════════════════════════════════════════

    const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`;

    console.log('📤 Llamando a Airtable:', method, path);

    // ═════════════════════════════════════════════════════════════
    // PASO 5: Hacer request a Airtable
    // ═════════════════════════════════════════════════════════════

    const airtableResponse = await fetch(AIRTABLE_URL, {
      method: method,
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: (method === 'POST' || method === 'PATCH' || method === 'PUT')
        ? JSON.stringify(body || {})
        : undefined
    });

    const responseText = await airtableResponse.text();

    // ═════════════════════════════════════════════════════════════
    // PASO 6: Parsear respuesta de Airtable
    // ═════════════════════════════════════════════════════════════

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Respuesta de Airtable no es JSON:', responseText.substring(0, 200));
      
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Respuesta de Airtable no es JSON válido',
          airtableStatus: airtableResponse.status
        })
      };
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 7: Manejar respuesta de Airtable
    // ═════════════════════════════════════════════════════════════

    if (!airtableResponse.ok) {
      console.error('❌ Error de Airtable (status ' + airtableResponse.status + '):', responseData.error);
      
      return {
        statusCode: airtableResponse.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          airtableStatus: airtableResponse.status,
          error: responseData.error?.message || 'Error en Airtable',
          airtableError: responseData.error,
          details: responseData
        })
      };
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 8: Respuesta exitosa
    // ═════════════════════════════════════════════════════════════

    console.log('✅ Respuesta de Airtable exitosa');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        ...responseData
      })
    };

  } catch (error) {
    console.error('❌ Error no manejado en airtable-proxy:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: 'Error interno del servidor',
        message: error.message,
        type: error.name
      })
    };
  }
}

/*
═════════════════════════════════════════════════════════════════
INSTRUCCIONES DE INSTALACIÓN
═════════════════════════════════════════════════════════════════

1. CREAR CARPETA:
   mkdir -p netlify/functions

2. GUARDAR ESTE ARCHIVO:
   netlify/functions/airtable-proxy.js

3. CONFIGURAR VARIABLES EN NETLIFY:
   https://app.netlify.com → Tu sitio → Site settings → 
   Build & deploy → Environment

   Agregar:
   AIRTABLE_API_KEY = patXXXXXXXXXXXXXX
   AIRTABLE_BASE_ID = appXXXXXXXXXXXXXX

4. DESPLEGAR:
   netlify deploy --prod

5. VERIFICAR:
   - Netlify Functions debe listar: airtable-proxy
   - Sin errores de compilación


═════════════════════════════════════════════════════════════════
CÓMO OBTENER LAS CREDENCIALES
═════════════════════════════════════════════════════════════════

AIRTABLE_API_KEY:
1. Ve a: https://airtable.com/account/api
2. Haz clic en: Create a new token
3. Dale estos permisos:
   ☑ data.records:read
   ☑ data.records:write
4. Copia: patXXXXXXXXXXXXXX

AIRTABLE_BASE_ID:
1. Ve a: https://airtable.com
2. Abre tu base
3. Mira la URL: https://airtable.com/appXXXXXXXXXXXXXX/...
4. La parte appXXXXXXXXXXXXXX es tu BASE_ID


═════════════════════════════════════════════════════════════════
TESTING
═════════════════════════════════════════════════════════════════

En tu navegador, abre F12 → Console y ejecuta:

fetch('/.netlify/functions/airtable-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'GET',
    path: '/Capacitaciones?maxRecords=1'
  })
})
.then(r => r.json())
.then(d => console.log(d))

Deberías ver: { success: true, records: [...] }


═════════════════════════════════════════════════════════════════
*/
