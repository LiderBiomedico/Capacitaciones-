// netlify/functions/generate-posttest-link.js
// ═════════════════════════════════════════════════════════════════
// Genera un vínculo permanente para posttest después de completar pretest
// Guarda la participación con el código de posttest
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
    const { sessionId, participationId, sessionCode, userName, userEmail, department } = payload;

    if (!sessionId || !participationId || !sessionCode) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          success: false, 
          error: 'Faltan parámetros: sessionId, participationId, sessionCode' 
        })
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
    // PASO 1: Generar código único para posttest
    // ═════════════════════════════════════════════════════════════
    // Formato: POSTTEST-[SESSION_CODE]-[PARTICIPATION_ID]
    // Ejemplo: POSTTEST-ABC123-recXXXXXXXXX
    
    const postestCode = `POSTTEST-${sessionCode}-${participationId.substring(0, 8).toUpperCase()}`;
    
    // Generar URL permanente
    const baseUrl = process.env.SITE_URL || 'https://capacitacioneshslv.netlify.app';
    const postestUrl = `${baseUrl}?code=${postestCode}&type=posttest&pid=${participationId}`;

    console.log('📝 Generando vínculo de posttest');
    console.log('   Código de pretest:', sessionCode);
    console.log('   Código de posttest:', postestCode);
    console.log('   Participante:', userName);
    console.log('   URL generada:', postestUrl);

    // ═════════════════════════════════════════════════════════════
    // PASO 2: Actualizar la participación con el código de posttest
    // ═════════════════════════════════════════════════════════════

    const updateParticipationUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Participaciones/${participationId}`;

    const updateParticipationResponse = await fetch(updateParticipationUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          'Código Posttest': postestCode,
          'Link Posttest': postestUrl,
          'Estado': 'Pretest Completado'
        }
      })
    });

    const updateParticipationData = await updateParticipationResponse.json();

    if (!updateParticipationResponse.ok) {
      console.error('❌ Error actualizando participación:', updateParticipationData);
      return {
        statusCode: updateParticipationResponse.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Error al guardar código de posttest',
          details: updateParticipationData
        })
      };
    }

    console.log('✅ Participación actualizada con código de posttest');

    // ═════════════════════════════════════════════════════════════
    // PASO 3: Actualizar la sesión para vincular la participación
    // ═════════════════════════════════════════════════════════════

    const updateSessionUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sesiones/${sessionId}`;

    const updateSessionResponse = await fetch(updateSessionUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          'Fecha Cierre Pretest': new Date().toISOString().split('T')[0],
          'Estado': 'Pretest Completado - Esperando Capacitación'
        }
      })
    });

    const updateSessionData = await updateSessionResponse.json();

    if (!updateSessionResponse.ok) {
      console.warn('⚠️ Advertencia actualizando sesión:', updateSessionData);
      // No es crítico si falla, continuamos
    } else {
      console.log('✅ Sesión actualizada');
    }

    // ═════════════════════════════════════════════════════════════
    // RESPUESTA EXITOSA
    // ═════════════════════════════════════════════════════════════

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        message: 'Vínculo permanente generado exitosamente',
        postestCode: postestCode,
        postestUrl: postestUrl,
        participationId: participationId,
        participantData: {
          name: userName,
          email: userEmail,
          department: department
        }
      })
    };

  } catch (error) {
    console.error('❌ Error en generate-posttest-link:', error);
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

/*
═════════════════════════════════════════════════════════════════
CÓMO USAR ESTA FUNCIÓN
═════════════════════════════════════════════════════════════════

1. Desde app.js después de completar el pretest:

   const postestLinkData = await generatePostestLink({
     sessionId: 'rec123456',
     participationId: 'rec987654',
     sessionCode: 'ABC123',
     userName: 'Juan Pérez',
     userEmail: 'juan@hospital.com',
     department: 'Enfermería'
   });

2. La función devolverá:

   {
     success: true,
     postestCode: 'POSTTEST-ABC123-REC98765',
     postestUrl: 'https://... ?code=POSTTEST-ABC123-REC98765&type=posttest&pid=rec987654',
     participationId: 'rec987654'
   }

3. Mostrar esta URL al usuario en un modal con QR


═════════════════════════════════════════════════════════════════
VARIABLES DE ENTORNO EN NETLIFY
═════════════════════════════════════════════════════════════════

AIRTABLE_API_KEY = patXXXXXXXXXXXXXXXXXXXXXX
AIRTABLE_BASE_ID = appXXXXXXXXXXXXXX
SITE_URL = https://capacitacioneshslv.netlify.app (opcional, por defecto es este)

═════════════════════════════════════════════════════════════════
*/
