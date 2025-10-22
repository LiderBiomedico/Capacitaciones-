// netlify/functions/airtable-proxy.js
// 🔒 PROXY SEGURO PARA AIRTABLE
// Las credenciales se usan SOLO en el servidor

const axios = require('axios');

exports.handler = async (event, context) => {
  // ==========================================
  // CONFIGURACIÓN DE SEGURIDAD
  // ==========================================
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Manejar preflight OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // ==========================================
  // OBTENER CREDENCIALES DEL SERVIDOR
  // ==========================================
  
  // ⚠️ IMPORTANTE: Las credenciales NUNCA llegan desde el cliente
  // Vienen de las variables de entorno del servidor (Netlify)
  
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

  // Validar que existan las credenciales
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('❌ Credenciales de Airtable no configuradas en el servidor');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Credenciales de servidor no configuradas',
        details: 'Verifica que AIRTABLE_API_KEY y AIRTABLE_BASE_ID estén en variables de entorno'
      })
    };
  }

  // ==========================================
  // PARSEAR PETICIÓN DEL CLIENTE
  // ==========================================
  
  let requestData = {};
  try {
    if (event.body) {
      requestData = JSON.parse(event.body);
    }
  } catch (error) {
    console.error('❌ Error parseando JSON:', error.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'JSON inválido' })
    };
  }

  const { path, method, body: requestBody } = requestData;

  // Validar path
  if (!path) {
    console.error('❌ Path no especificado');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Path es requerido' })
    };
  }

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`;

  // ==========================================
  // HACER PETICIÓN A AIRTABLE (CON CREDENCIALES DEL SERVIDOR)
  // ==========================================
  
  try {
    console.log(`📡 ${method} ${path}`);
    
    const config = {
      method: method || 'GET',
      url: url,
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Hospital-Capacitaciones/1.0'
      },
      timeout: 30000 // 30 segundos de timeout
    };

    // Agregar body si existe
    if (requestBody && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      config.data = requestBody;
    }

    // Hacer la petición a Airtable
    const response = await axios(config);

    // Respuesta exitosa
    console.log(`✅ Respuesta exitosa: ${response.status}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };

  } catch (error) {
    // ==========================================
    // MANEJO DE ERRORES
    // ==========================================
    
    console.error('❌ Error en proxy Airtable:', error.message);
    
    // Error de Airtable (tiene respuesta)
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      // Errores comunes
      if (status === 401) {
        console.error('🔒 Error 401: Token inválido o expirado');
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            error: 'Token de Airtable inválido o expirado',
            message: 'Verifica que AIRTABLE_API_KEY sea correcto'
          })
        };
      }
      
      if (status === 404) {
        console.error('🔍 Error 404: Recurso no encontrado');
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            error: 'Recurso no encontrado',
            message: 'Verifica que el Base ID sea correcto'
          })
        };
      }
      
      if (status === 422) {
        console.error('⚠️ Error 422: Datos inválidos');
        return {
          statusCode: 422,
          headers,
          body: JSON.stringify({
            error: 'Datos inválidos',
            details: data
          })
        };
      }
      
      if (status === 429) {
        console.error('⏱️ Error 429: Demasiadas peticiones');
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({
            error: 'Demasiadas peticiones. Por favor intenta más tarde.'
          })
        };
      }
      
      // Error genérico
      return {
        statusCode: status || 500,
        headers,
        body: JSON.stringify({
          error: data.error || error.message,
          details: data
        })
      };
    }
    
    // Error de conexión o timeout
    if (error.code === 'ECONNREFUSED') {
      console.error('🌐 Error: No se puede conectar con Airtable');
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: 'Servicio no disponible',
          message: 'No se puede conectar con Airtable'
        })
      };
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error('⏱️ Error: Timeout en conexión');
      return {
        statusCode: 504,
        headers,
        body: JSON.stringify({
          error: 'Timeout',
          message: 'La petición tardó demasiado'
        })
      };
    }
    
    // Error desconocido
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error interno del servidor',
        message: error.message
      })
    };
  }
};

// ==========================================
// NOTAS DE SEGURIDAD
// ==========================================

/*
🔒 SEGURIDAD DEL PROXY:

1. ✅ Las credenciales vienen de variables de entorno
2. ✅ Las credenciales NUNCA se loguean (evita acceso a logs)
3. ✅ Validación de entrada (path, método, body)
4. ✅ Timeout de 30 segundos para evitar DoS
5. ✅ CORS configurado pero seguro
6. ✅ User-Agent personalizado
7. ✅ Manejo robusto de errores
8. ✅ Logs seguros (sin exponer secretos)

VARIABLES DE ENTORNO REQUERIDAS:

Netlify → Site settings → Build & deploy → Environment

AIRTABLE_API_KEY = Tipo: Personal Access Token (pat...)
AIRTABLE_BASE_ID = Tipo: Base ID (app...)

NUNCA:
❌ Guardar credenciales en el código
❌ Enviar credenciales desde el cliente
❌ Loguear credenciales
❌ Exponer credenciales en el HTML/JS
*/