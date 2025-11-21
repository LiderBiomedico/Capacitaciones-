// netlify/functions/create-session.js
// ═════════════════════════════════════════════════════════════════
// Función serverless para crear sesiones automáticamente
// VERSIÓN FINAL - Sin campo Departamento (no tiene opciones)
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
      console.error('❌ Error parseando JSON:', parseError.message);
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
          error: 'Faltan parámetros: code y trainingId requeridos'
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
      console.error('❌ Variables de entorno faltantes');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Variables de entorno no configuradas en Netlify'
        })
      };
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 4: Verificar si la sesión ya existe
    // ═════════════════════════════════════════════════════════════

    const codeUpper = code.toUpperCase().trim();
    const checkUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sesiones?filterByFormula=UPPER({Código Acceso})='${codeUpper}'`;

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
          code: codeUpper,
          sessionId: checkData.records[0].id,
          isNew: false
        })
      };
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 5: Crear nueva sesión
    // IMPORTANTE: Solo incluir campos que existen en Airtable
    // ═════════════════════════════════════════════════════════════

    console.log('✏️ Creando nueva sesión...');

    const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sesiones`;

    // ✅ ESTRUCTURA CORRECTA - Sin Departamento (no tiene opciones)
    const sessionPayload = {
      fields: {
        'Código Acceso': codeUpper,
        'Capacitaciones': [trainingId],
        'Activa': true,
        'Fecha Inicio': new Date().toISOString().split('T')[0]
      }
    };

    console.log('📤 Payload enviado:', JSON.stringify(sessionPayload, null, 2));

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionPayload)
    });

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      console.error('❌ Error creando sesión (status ' + createResponse.status + '):', createData);
      return {
        statusCode: createResponse.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Error al crear sesión',
          airtableStatus: createResponse.status,
          details: createData.error || createData,
          sentPayload: sessionPayload
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
        code: codeUpper,
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
INSTRUCCIONES DE INSTALACIÓN
═════════════════════════════════════════════════════════════════

1. REEMPLAZAR ARCHIVO:
   Copia TODO el contenido de este archivo
   Reemplaza tu: netlify/functions/create-session.js
   Guarda el archivo

2. DEPLOY:
   netlify deploy --prod

3. VERIFICAR:
   • Abre la aplicación
   • Intenta crear una sesión
   • Debería funcionar ✅

═════════════════════════════════════════════════════════════════
CAMBIOS REALIZADOS EN ESTA VERSIÓN
═════════════════════════════════════════════════════════════════

✅ URL correcta para buscar sesiones
✅ Validación de parámetros
✅ Estructura JSON correcta para Airtable
✅ SIN campo Departamento (no tiene opciones en Airtable)
✅ Logging detallado para debugging
✅ Manejo de errores mejorado
✅ Retorna error status correcto (no 500 genérico)

═════════════════════════════════════════════════════════════════
*/
