// netlify/functions/create-session.js
// ═════════════════════════════════════════════════════════════════
// Función serverless para crear sesiones automáticamente
// Uso: POST a /.netlify/functions/create-session
// ═════════════════════════════════════════════════════════════════

export async function handler(event) {
  // Solo aceptar POST
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
    // PASO 1: Parsear el body
    // ═════════════════════════════════════════════════════════════

    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'JSON inválido',
          details: parseError.message
        })
      };
    }

    const { code, trainingId } = payload;

    // ═════════════════════════════════════════════════════════════
    // PASO 2: Validar parámetros
    // ═════════════════════════════════════════════════════════════

    if (!code || !trainingId) {
      console.warn('⚠️ Parámetros faltantes:', { code, trainingId });
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Faltan parámetros: code y trainingId'
        })
      };
    }

    console.log('📝 Creando sesión:', { code, trainingId });

    // ═════════════════════════════════════════════════════════════
    // PASO 3: Obtener credenciales
    // ═════════════════════════════════════════════════════════════

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Variables de entorno no configuradas'
        })
      };
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 4: Verificar si la sesión ya existe
    // ═════════════════════════════════════════════════════════════

    const checkUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sesiones?filterByFormula={Código Acceso}='${code}'`;

    console.log('🔍 Buscando sesión existente...');

    const checkResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const checkData = await checkResponse.json();

    if (!checkResponse.ok) {
      console.error('❌ Error verificando sesión:', checkData);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Error al verificar sesión',
          details: checkData.error
        })
      };
    }

    // Si ya existe, retornar información
    if (checkData.records && checkData.records.length > 0) {
      console.log('✅ Sesión ya existe');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          message: 'Sesión ya existe',
          code: code,
          sessionId: checkData.records[0].id,
          isNew: false
        })
      };
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 5: Crear nueva sesión
    // ═════════════════════════════════════════════════════════════

    console.log('✏️ Creando nueva sesión...');

    const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sesiones`;

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          'Código Acceso': code.toUpperCase(),
          'Capacitaciones': [trainingId],
          'Activa': true,
          'Fecha Inicio': new Date().toISOString().split('T')[0]
        }
      })
    });

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      console.error('❌ Error creando sesión:', createData);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Error al crear sesión',
          details: createData.error
        })
      };
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 6: Retornar éxito
    // ═════════════════════════════════════════════════════════════

    console.log('✅ Sesión creada:', createData.id);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Sesión creada correctamente',
        code: code,
        sessionId: createData.id,
        isNew: true,
        createdAt: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Error en create-session:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      })
    };
  }
}

/*
═════════════════════════════════════════════════════════════════
INSTRUCCIONES
═════════════════════════════════════════════════════════════════

1. GUARDAR EN:
   netlify/functions/create-session.js

2. CONFIGURAR VARIABLES EN NETLIFY:
   https://app.netlify.com → Tu sitio → Site settings → 
   Build & deploy → Environment

   AIRTABLE_API_KEY = patXXXXXXXXXXXXXX
   AIRTABLE_BASE_ID = appXXXXXXXXXXXXXX

3. DESPLEGAR:
   netlify deploy --prod


═════════════════════════════════════════════════════════════════
*/
