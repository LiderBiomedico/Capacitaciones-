// netlify/functions/airtable-proxy.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Solo permitir POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Obtener credenciales de variables de entorno
        const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
        const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

        if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    error: 'Credenciales de Airtable no configuradas',
                    details: 'Configura AIRTABLE_API_KEY y AIRTABLE_BASE_ID en Netlify'
                })
            };
        }

        // Parsear la solicitud del cliente
        const { method, path, body } = JSON.parse(event.body);

        // Construir URL de Airtable
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`;

        // Realizar la petición a Airtable
        const options = {
            method: method,
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        // Si hay body, agregarlo
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const data = await response.json();

        return {
            statusCode: response.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('Error en función Airtable:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Error al procesar la solicitud',
                details: error.message 
            })
        };
    }
};
