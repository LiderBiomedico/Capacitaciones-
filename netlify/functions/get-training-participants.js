// netlify/functions/get-training-participants.js
// ═════════════════════════════════════════════════════════════════
// Obtiene todos los participantes de una capacitación con sus notas
// de pretest y posttest para generar reportes
// ═════════════════════════════════════════════════════════════════

export async function handler(event) {
  // Configurar CORS
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Manejar preflight
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
    const { trainingId } = payload;

    if (!trainingId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Falta parámetro: trainingId' })
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

    console.log('📊 Obteniendo participantes para capacitación:', trainingId);

    // ═════════════════════════════════════════════════════════════
    // PASO 1: Obtener información de la capacitación
    // ═════════════════════════════════════════════════════════════

    const trainingUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Capacitaciones/${trainingId}`;
    
    const trainingResponse = await fetch(trainingUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!trainingResponse.ok) {
      const errorData = await trainingResponse.json();
      console.error('❌ Error obteniendo capacitación:', errorData);
      return {
        statusCode: trainingResponse.status,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No se pudo obtener la capacitación',
          details: errorData
        })
      };
    }

    const trainingData = await trainingResponse.json();
    console.log('✅ Capacitación encontrada:', trainingData.fields['Título']);

    // ═════════════════════════════════════════════════════════════
    // PASO 2: Obtener todas las sesiones de esta capacitación
    // ═════════════════════════════════════════════════════════════

    const sessionsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sesiones?filterByFormula=FIND('${trainingId}',ARRAYJOIN({Capacitaciones}))`;
    
    const sessionsResponse = await fetch(sessionsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let sessions = [];
    if (sessionsResponse.ok) {
      const sessionsData = await sessionsResponse.json();
      sessions = sessionsData.records || [];
      console.log(`📋 Sesiones encontradas: ${sessions.length}`);
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 3: Obtener todas las participaciones
    // ═════════════════════════════════════════════════════════════

    let allParticipants = [];
    
    // Obtener IDs de sesiones
    const sessionIds = sessions.map(s => s.id);
    
    if (sessionIds.length > 0) {
      // Construir filtro para buscar participaciones de estas sesiones
      const filterParts = sessionIds.map(id => `FIND('${id}',ARRAYJOIN({Sesión}))`);
      const filter = `OR(${filterParts.join(',')})`;
      
      const participationsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Participaciones?filterByFormula=${encodeURIComponent(filter)}`;
      
      const participationsResponse = await fetch(participationsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (participationsResponse.ok) {
        const participationsData = await participationsResponse.json();
        allParticipants = participationsData.records || [];
        console.log(`👥 Participantes encontrados: ${allParticipants.length}`);
      }
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 4: Formatear datos de participantes
    // ═════════════════════════════════════════════════════════════

    const formattedParticipants = allParticipants.map(p => {
      const fields = p.fields;
      
      // Calcular mejora
      const pretestScore = parseFloat(fields['Puntuación Pretest']) || 0;
      const postestScore = parseFloat(fields['Puntuación Posttest']) || 0;
      const improvement = postestScore - pretestScore;
      
      // Determinar estado
      let status = 'Pendiente';
      if (fields['Puntuación Posttest'] !== undefined && fields['Puntuación Posttest'] !== null) {
        status = 'Completado';
      } else if (fields['Puntuación Pretest'] !== undefined && fields['Puntuación Pretest'] !== null) {
        status = 'Pretest Completado';
      }

      return {
        id: p.id,
        nombre: fields['Nombre Completo'] || fields['Nombre'] || 'Sin nombre',
        email: fields['Email'] || '',
        departamento: fields['Departamento'] || fields['Servicio'] || '',
        cargo: fields['Cargo'] || '',
        pretestScore: pretestScore,
        postestScore: postestScore,
        improvement: improvement,
        improvementPercent: pretestScore > 0 ? ((improvement / pretestScore) * 100).toFixed(1) : 0,
        status: status,
        fechaPretest: fields['Fecha Pretest'] || '',
        fechaPostest: fields['Fecha Posttest'] || '',
        codigoPostest: fields['Código Posttest'] || ''
      };
    });

    // ═════════════════════════════════════════════════════════════
    // PASO 5: Calcular estadísticas generales
    // ═════════════════════════════════════════════════════════════

    const totalParticipants = formattedParticipants.length;
    const completedPretest = formattedParticipants.filter(p => p.pretestScore > 0).length;
    const completedPostest = formattedParticipants.filter(p => p.postestScore > 0).length;
    
    const avgPretestScore = completedPretest > 0 
      ? (formattedParticipants.reduce((sum, p) => sum + p.pretestScore, 0) / completedPretest).toFixed(1)
      : 0;
    
    const avgPostestScore = completedPostest > 0
      ? (formattedParticipants.filter(p => p.postestScore > 0).reduce((sum, p) => sum + p.postestScore, 0) / completedPostest).toFixed(1)
      : 0;
    
    const avgImprovement = completedPostest > 0
      ? (formattedParticipants.filter(p => p.postestScore > 0).reduce((sum, p) => sum + p.improvement, 0) / completedPostest).toFixed(1)
      : 0;

    const adherenceRate = totalParticipants > 0 
      ? ((completedPostest / totalParticipants) * 100).toFixed(1)
      : 0;

    // ═════════════════════════════════════════════════════════════
    // RESPUESTA EXITOSA
    // ═════════════════════════════════════════════════════════════

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        training: {
          id: trainingId,
          titulo: trainingData.fields['Título'] || 'Sin título',
          descripcion: trainingData.fields['Descripción'] || '',
          departamento: trainingData.fields['Departamento'] || '',
          fechaCreacion: trainingData.fields['Fecha Creación'] || '',
          activa: trainingData.fields['Activa'] !== false,
          finalizada: trainingData.fields['Finalizada'] === true
        },
        sessions: sessions.map(s => ({
          id: s.id,
          codigo: s.fields['Código Acceso'] || '',
          activa: s.fields['Activa'] !== false,
          fechaInicio: s.fields['Fecha Inicio'] || ''
        })),
        participants: formattedParticipants,
        statistics: {
          totalParticipants,
          completedPretest,
          completedPostest,
          avgPretestScore: parseFloat(avgPretestScore),
          avgPostestScore: parseFloat(avgPostestScore),
          avgImprovement: parseFloat(avgImprovement),
          adherenceRate: parseFloat(adherenceRate)
        }
      })
    };

  } catch (error) {
    console.error('❌ Error en get-training-participants:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
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

1. Llamar desde el frontend:

   const result = await fetch('/.netlify/functions/get-training-participants', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       trainingId: 'recXXXXXXXXXXXXXX'
     })
   }).then(r => r.json());

2. La función devolverá:

   {
     success: true,
     training: { id, titulo, descripcion, ... },
     sessions: [...],
     participants: [
       {
         id: 'rec123',
         nombre: 'Juan Pérez',
         pretestScore: 60,
         postestScore: 85,
         improvement: 25,
         status: 'Completado'
       },
       ...
     ],
     statistics: {
       totalParticipants: 10,
       completedPretest: 10,
       completedPostest: 8,
       avgPretestScore: 65.5,
       avgPostestScore: 82.3,
       avgImprovement: 16.8,
       adherenceRate: 80
     }
   }

═════════════════════════════════════════════════════════════════
*/
