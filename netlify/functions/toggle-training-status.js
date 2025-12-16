// netlify/functions/toggle-training-status.js
// ═════════════════════════════════════════════════════════════════
// Permite finalizar o reactivar una capacitación
// Cuando se finaliza, las sesiones se desactivan para poder reutilizar
// ═════════════════════════════════════════════════════════════════

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Solo POST' })
    };
  }

  try {
    let payload = JSON.parse(event.body || '{}');
    const { trainingId, action } = payload; // action: 'finalize' o 'reactivate'

    if (!trainingId || !action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Faltan parámetros: trainingId y action (finalize/reactivate)' 
        })
      };
    }

    if (!['finalize', 'reactivate'].includes(action)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Action debe ser "finalize" o "reactivate"' 
        })
      };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Variables de entorno no configuradas' })
      };
    }

    const isFinalize = action === 'finalize';
    console.log(`📋 ${isFinalize ? 'Finalizando' : 'Reactivando'} capacitación:`, trainingId);

    // ═════════════════════════════════════════════════════════════
    // PASO 1: Actualizar la capacitación
    // ═════════════════════════════════════════════════════════════

    const updateTrainingUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Capacitaciones/${trainingId}`;
    
    const trainingFields = {
      'Finalizada': isFinalize,
      'Fecha Finalización': isFinalize ? new Date().toISOString().split('T')[0] : null
    };

    const trainingResponse = await fetch(updateTrainingUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: trainingFields })
    });

    if (!trainingResponse.ok) {
      const errorData = await trainingResponse.json();
      console.error('❌ Error actualizando capacitación:', errorData);
      
      // Si el campo no existe, continuamos de todas formas
      if (errorData.error?.type !== 'INVALID_REQUEST_UNKNOWN_FIELD_NAME') {
        return {
          statusCode: trainingResponse.status,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'No se pudo actualizar la capacitación',
            details: errorData
          })
        };
      }
    }

    const trainingData = await trainingResponse.json();
    console.log('✅ Capacitación actualizada');

    // ═════════════════════════════════════════════════════════════
    // PASO 2: Actualizar todas las sesiones relacionadas
    // ═════════════════════════════════════════════════════════════

    // Obtener sesiones de esta capacitación
    const sessionsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sesiones?filterByFormula=FIND('${trainingId}',ARRAYJOIN({Capacitaciones}))`;
    
    const sessionsResponse = await fetch(sessionsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let updatedSessions = 0;
    if (sessionsResponse.ok) {
      const sessionsData = await sessionsResponse.json();
      const sessions = sessionsData.records || [];
      
      console.log(`📋 Sesiones encontradas: ${sessions.length}`);

      // Actualizar cada sesión
      for (const session of sessions) {
        const updateSessionUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sesiones/${session.id}`;
        
        const sessionUpdateResponse = await fetch(updateSessionUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              'Activa': !isFinalize,
              'Estado': isFinalize ? 'Finalizada' : 'Activa'
            }
          })
        });

        if (sessionUpdateResponse.ok) {
          updatedSessions++;
        }
      }
      
      console.log(`✅ Sesiones actualizadas: ${updatedSessions}`);
    }

    // ═════════════════════════════════════════════════════════════
    // RESPUESTA EXITOSA
    // ═════════════════════════════════════════════════════════════

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: isFinalize 
          ? 'Capacitación finalizada exitosamente' 
          : 'Capacitación reactivada exitosamente',
        training: {
          id: trainingId,
          finalizada: isFinalize,
          fechaFinalizacion: isFinalize ? new Date().toISOString().split('T')[0] : null
        },
        sessionsUpdated: updatedSessions
      })
    };

  } catch (error) {
    console.error('❌ Error en toggle-training-status:', error);
    return {
      statusCode: 500,
      headers,
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

1. Para FINALIZAR una capacitación:

   const result = await fetch('/.netlify/functions/toggle-training-status', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       trainingId: 'recXXXXXXXXXXXXXX',
       action: 'finalize'
     })
   }).then(r => r.json());

2. Para REACTIVAR una capacitación:

   const result = await fetch('/.netlify/functions/toggle-training-status', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       trainingId: 'recXXXXXXXXXXXXXX',
       action: 'reactivate'
     })
   }).then(r => r.json());

═════════════════════════════════════════════════════════════════
CAMPOS NECESARIOS EN AIRTABLE (TABLA CAPACITACIONES)
═════════════════════════════════════════════════════════════════

Para que funcione correctamente, agregar estos campos a la tabla Capacitaciones:
- Finalizada (Checkbox)
- Fecha Finalización (Date)

Y en la tabla Sesiones:
- Estado (Single line text o Single select con opciones: Activa, Finalizada)

═════════════════════════════════════════════════════════════════
*/
