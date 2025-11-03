// netlify/functions/airtable-proxy.js
// 🔒 PROXY SEGURO PARA AIRTABLE
// Las credenciales se usan SOLO en el servidor

const axios = require('axios');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Credenciales de servidor no configuradas',
        details: 'Verifica AIRTABLE_API_KEY y AIRTABLE_BASE_ID en Netlify'
      })
    };
  }

  // Parse body
  let requestData = {};
  try {
    if (event.body) {
      requestData = JSON.parse(event.body);
    }
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'JSON inválido' })
    };
  }

  const { path, method, body: requestBody } = requestData;
  if (!path) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Path es requerido' })
    };
  }

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`;

  try {
    const config = {
      method: method || 'GET',
      url,
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Hospital-Capacitaciones/1.0'
      },
      timeout: 30000
    };

    if (requestBody && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      config.data = requestBody;
    }

    const response = await axios(config);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };

  } catch (error) {
    // Errores comunes de Airtable
    if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        if (status === 401) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: 'Token de Airtable inválido o expirado',
                    message: 'Verifica AIRTABLE_API_KEY'
                })
            };
        }

        if (status === 404) {
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
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({
                    error: 'Demasiadas peticiones. Por favor intenta más tarde.'
                })
            };
        }

        return {
            statusCode: status || 500,
            headers,
            body: JSON.stringify({
                error: data.error || error.message,
                details: data
            })
        };
    }

    // Timeout / conexión
    if (error.code === 'ECONNREFUSED') {
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
        return {
            statusCode: 504,
            headers,
            body: JSON.stringify({
                error: 'Timeout',
                message: 'La petición tardó demasiado'
            })
        };
    }

    // Error genérico
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
