// netlify/functions/get-participation-by-posttest-code.js
// ═════════════════════════════════════════════════════════════════
// Busca una participación usando el código de posttest
// Devuelve los datos necesarios para cargar el posttest
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
    const { postestCode } = payload;

    if (!postestCode) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Falta parámetro: postestCode' })
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

    // ═════════════════════════════════════════════════════════════
    // PASO 1: Buscar la participación por código de posttest
    // ═════════════════════════════════════════════════════════════

    const postestCodeUpper = postestCode.toUpperCase().trim();
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Participaciones?filterByFormula=UPPER({Código Posttest})='${postestCodeUpper}'`;

    console.log('🔍 Buscando participación por código de posttest:', postestCodeUpper);

    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      console.error('❌ Error en búsqueda:', searchData);
      return {
        statusCode: searchResponse.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Error al buscar participación',
          details: searchData
        })
      };
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 2: Validar resultado
    // ═════════════════════════════════════════════════════════════

    if (!searchData.records || searchData.records.length === 0) {
      console.warn('⚠️ No se encontró participación con código:', postestCodeUpper);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Código de posttest no válido o ya utilizado',
          message: 'Por favor verifica que copiastes el código correctamente'
        })
      };
    }

    const participation = searchData.records[0];
    const participationFields = participation.fields;

    console.log('✅ Participación encontrada');
    console.log('   Participante:', participationFields['Nombre Completo'] || participationFields['Nombre']);
    console.log('   Email:', participationFields['Email']);
    console.log('   Estado:', participationFields['Estado']);

    // ═════════════════════════════════════════════════════════════
    // PASO 3: Obtener información de la sesión
    // ═════════════════════════════════════════════════════════════

    let sessionData = null;
    if (participationFields['Sesión'] && participationFields['Sesión'].length > 0) {
      const sessionId = participationFields['Sesión'][0];
      const getSessionUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sesiones/${sessionId}`;

      const sessionResponse = await fetch(getSessionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (sessionResponse.ok) {
        const sessionRecord = await sessionResponse.json();
        sessionData = {
          id: sessionId,
          fields: sessionRecord.fields
        };
      }
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 4: Obtener información de la capacitación
    // ═════════════════════════════════════════════════════════════

    let trainingData = null;
    if (sessionData && sessionData.fields['Capacitaciones'] && sessionData.fields['Capacitaciones'].length > 0) {
      const trainingId = sessionData.fields['Capacitaciones'][0];
      const getTrainingUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Capacitaciones/${trainingId}`;

      const trainingResponse = await fetch(getTrainingUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (trainingResponse.ok) {
        const trainingRecord = await trainingResponse.json();
        trainingData = {
          id: trainingId,
          fields: trainingRecord.fields
        };
      }
    }

    // ═════════════════════════════════════════════════════════════
    // RESPUESTA EXITOSA
    // ═════════════════════════════════════════════════════════════

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        participation: {
          id: participation.id,
          fields: participationFields
        },
        session: sessionData,
        training: trainingData,
        status: {
          isValidForPosttest: participationFields['Estado'] === 'Pretest Completado' || participationFields['Estado'] === 'Esperando Posttest',
          pretestScore: participationFields['Puntuación Pretest'] || participationFields['Pretest Score'] || 0,
          hasCompletedPretest: !!(participationFields['Puntuación Pretest'] || participationFields['Pretest Score'])
        }
      })
    };

  } catch (error) {
    console.error('❌ Error en get-participation-by-posttest-code:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        success: false, 
        error: error.message,
        type: error.name
      })
    };
  }
}
