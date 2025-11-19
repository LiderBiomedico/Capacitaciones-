// netlify/functions/create-session.js
// Función serverless para crear sesiones automáticamente cuando se escanea un QR

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
                error: 'Method not allowed. Use POST.'
            })
        };
    }

    try {
        // Parsear el body
        const body = JSON.parse(event.body || '{}');
        const { code, trainingId } = body;

        // Validar parámetros
        if (!code || !trainingId) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Faltan parámetros requeridos: code y trainingId'
                })
            };
        }

        console.log(`📝 Intentando crear sesión: código=${code}, training=${trainingId}`);

        // Obtener credenciales de variables de entorno
        const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
        const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

        if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
            console.error('❌ Variables de entorno no configuradas');
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Variables de entorno no configuradas en Netlify'
                })
            };
        }

        // PASO 1: Verificar que la sesión no exista ya
        console.log(`🔍 Buscando sesión existente con código: ${code}`);

        const checkUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sesiones?filterByFormula={Código Acceso}='${code}'`;
        
        const checkResponse = await fetch(checkUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const checkData = await checkResponse.json();

        // Si hay error
        if (!checkResponse.ok) {
            console.error('❌ Error verificando sesión:', checkData);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: checkData.error?.message || 'Error al verificar sesión existente'
                })
            };
        }

        // Si ya existe
        if (checkData.records && checkData.records.length > 0) {
            console.log(`⚠️ La sesión con código ${code} ya existe`);
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    message: 'Sesión ya existe',
                    code: code,
                    sessionId: checkData.records[0].id,
                    isNew: false
                })
            };
        }

        // PASO 2: Crear nueva sesión
        console.log(`✅ Sesión no existe, creando nueva...`);

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

        // Si hay error en la creación
        if (!createResponse.ok) {
            console.error('❌ Error creando sesión:', createData);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: createData.error?.message || 'Error al crear sesión',
                    details: createData.error
                })
            };
        }

        // ✅ Éxito
        console.log(`✅ Sesión creada exitosamente:`, createData.id);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Sesión creada automáticamente',
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        };
    }
}
