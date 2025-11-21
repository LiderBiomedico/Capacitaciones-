// netlify/functions/create-session.js
// ═════════════════════════════════════════════════════════════════
// Función para crear sesiones - VERSIÓN SIMPLIFICADA
// ═════════════════════════════════════════════════════════════════

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Solo POST' })
    };
  }

  try {
    let payload = JSON.parse(event.body || '{}');
    const { code, trainingId } = payload;

    if (!code || !trainingId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Faltan: code y trainingId' })
      };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Variables de entorno no configuradas' })
      };
    }

    const codeUpper = code.toUpperCase().trim();

    // PASO 1: Verificar si sesión existe
    const checkUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sesiones?filterByFormula=UPPER({Código Acceso})='${codeUpper}'`;

    const checkResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const checkData = await checkResponse.json();

    if (!checkResponse.ok) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Error al verificar sesión', details: checkData })
      };
    }

    // Si ya existe
    if (checkData.records && checkData.records.length > 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          message: 'Sesión ya existe',
          sessionId: checkData.records[0].id,
          isNew: false
        })
      };
    }

    // PASO 2: Crear nueva sesión
    const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sesiones`;

    // ⚠️ SOLO campos básicos - SIN Departamento, SIN opciones múltiples
    const sessionData = {
      fields: {
        'Código Acceso': codeUpper,
        'Capacitaciones': [trainingId],
        'Activa': true,
        'Fecha Inicio': new Date().toISOString().split('T')[0]
      }
    };

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionData)
    });

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      console.error('Error Airtable:', createData);
      return {
        statusCode: createResponse.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Error al crear sesión',
          status: createResponse.status,
          details: createData
        })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        message: 'Sesión creada',
        sessionId: createData.id,
        code: codeUpper
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}