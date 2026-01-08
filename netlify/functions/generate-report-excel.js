// netlify/functions/generate-report-excel.js
// ═════════════════════════════════════════════════════════════════
// Genera reporte Excel con formato oficial SLV-SR-03-F05
// Hospital Susana López de Valencia E.S.E.
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
      body: JSON.stringify({ success: false, error: 'Solo POST permitido' })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { trainingId } = payload;

    if (!trainingId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Falta trainingId' })
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

    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
    const authHeaders = {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    };

    // ═══════════════════════════════════════════════════════════
    // OBTENER DATOS DE LA CAPACITACIÓN
    // ═══════════════════════════════════════════════════════════

    const trainingResponse = await fetch(`${baseUrl}/Capacitaciones/${trainingId}`, {
      headers: authHeaders
    });

    if (!trainingResponse.ok) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Capacitación no encontrada' })
      };
    }

    const trainingData = await trainingResponse.json();
    const training = trainingData.fields;

    // ═══════════════════════════════════════════════════════════
    // OBTENER SESIONES Y PARTICIPANTES
    // ═══════════════════════════════════════════════════════════

    // Obtener todas las sesiones
    const sessionsResponse = await fetch(`${baseUrl}/Sesiones?pageSize=100`, {
      headers: authHeaders
    });
    const sessionsData = await sessionsResponse.json();
    const linkedSessions = (sessionsData.records || []).filter(s => {
      const caps = s.fields['Capacitaciones'] || [];
      return Array.isArray(caps) ? caps.includes(trainingId) : caps === trainingId;
    });

    const sessionIds = linkedSessions.map(s => s.id);

    // Obtener todas las participaciones
    let allParticipations = [];
    if (sessionIds.length > 0) {
      const participationsResponse = await fetch(`${baseUrl}/Participaciones?pageSize=100`, {
        headers: authHeaders
      });
      const participationsData = await participationsResponse.json();
      allParticipations = (participationsData.records || []).filter(p => {
        const sesion = p.fields['Sesión'] || [];
        if (Array.isArray(sesion)) {
          return sesion.some(sid => sessionIds.includes(sid));
        }
        return sessionIds.includes(sesion);
      });
    }

    // ═══════════════════════════════════════════════════════════
    // OBTENER PREGUNTAS
    // ═══════════════════════════════════════════════════════════

    const questionsResponse = await fetch(`${baseUrl}/Preguntas?pageSize=100`, {
      headers: authHeaders
    });
    const questionsData = await questionsResponse.json();
    const linkedQuestions = (questionsData.records || []).filter(q => {
      const caps = q.fields['Capacitación'] || q.fields['Capacitaciones'] || [];
      return Array.isArray(caps) ? caps.includes(trainingId) : caps === trainingId;
    });

    // ═══════════════════════════════════════════════════════════
    // FORMATEAR PARTICIPANTES
    // ═══════════════════════════════════════════════════════════

    const participants = allParticipations.map((p, index) => {
      const fields = p.fields;
      const pretestScore = Number(fields['Pretest Score'] || fields['Puntuación Pretest'] || 0);
      const posttestScore = Number(fields['Post-test Score'] || fields['Puntuación Posttest'] || 0);
      
      return {
        numero: index + 1,
        nombre: fields['Nombre Completo'] || fields['Nombre'] || 'Sin nombre',
        cargo: fields['Cargo'] || fields['Departamento'] || '',
        servicio: fields['Departamento'] || fields['Servicio'] || '',
        pretest: pretestScore,
        posttest: posttestScore,
        fechaRegistro: fields['Fecha de Inicio'] || fields['Fecha Registro'] || ''
      };
    });

    // Calcular estadísticas
    const totalParticipants = participants.length;
    const pretestScores = participants.filter(p => p.pretest > 0).map(p => p.pretest);
    const posttestScores = participants.filter(p => p.posttest > 0).map(p => p.posttest);
    
    const avgPretest = pretestScores.length > 0 
      ? (pretestScores.reduce((a, b) => a + b, 0) / pretestScores.length).toFixed(1)
      : 0;
    const avgPosttest = posttestScores.length > 0 
      ? (posttestScores.reduce((a, b) => a + b, 0) / posttestScores.length).toFixed(1)
      : 0;
    
    const adherencia = totalParticipants > 0 && posttestScores.length > 0
      ? Math.round((posttestScores.length / totalParticipants) * 100)
      : 0;

    // ═══════════════════════════════════════════════════════════
    // GENERAR ESTRUCTURA DEL REPORTE
    // ═══════════════════════════════════════════════════════════

    const reportData = {
      success: true,
      report: {
        // Información del documento
        codigo: 'SLV-SR-03-F05',
        version: '1.0',
        
        // Sección I - Información General
        informacionGeneral: {
          capacitacion: training['Título'] || training['Titulo'] || 'Sin título',
          objetivo: training['Descripción'] || training['Descripcion'] || training['Objetivo'] || '',
          temasTratar: training['Temas'] || training['Contenido'] || training['Descripción'] || '',
          metodologia: training['Metodología'] || training['Metodologia'] || 'Presencial',
          planeacion: `1. Se prepara el tema de la capacitación y el material educativo para la capacitación\n2. Explicar al personal el correcto uso y manejo del tema\n3. Creación del pre test y post test para aplicar al personal participante y determinar el grado de conocimiento`,
          hacer: `Realizar capacitación en ${training['Título'] || 'el tema'}`,
          verificacion: 'Se realizó un pre test y un post test para las personas que participaron en la capacitación para evaluar el grado de conocimiento en el tema.',
          actuar: '(Aplica si en el pos test el resultado es <= al 100%, no aplica plan de acción si en el pos test el resultado es el 100% de adherencia)',
          lugarFecha: training['Lugar'] || 'Hospital Susana López de Valencia',
          fechaCapacitacion: training['Fecha Creación'] || training['Fecha'] || new Date().toISOString().split('T')[0],
          duracion: training['Duración'] || training['Duracion'] || '30 min por proceso asistencial',
          expositor: training['Expositor'] || training['Responsable'] || 'Ing. Biomédico',
          coordinador: training['Coordinador'] || training['Responsable'] || 'Ing. Biomédico',
          instrumentoEvaluacion: 'Pre y Post-Test',
          numeroPreguntas: linkedQuestions.length || 5,
          maximaCalificacion: '5 (nota: aprueban el examen los participantes que obtienen como resultado nota mayor e igual 3 puntos)'
        },
        
        // Sección II - Participantes
        participantes: participants,
        
        // Sección III - Resultados
        resultados: {
          totalParticipantes: totalParticipants,
          completaronPretest: pretestScores.length,
          completaronPosttest: posttestScores.length,
          promedioPretest: avgPretest,
          promedioPosttest: avgPosttest,
          adherencia: adherencia
        },
        
        // Metadatos
        metadata: {
          generadoEn: new Date().toISOString(),
          trainingId: trainingId,
          sesiones: linkedSessions.length
        }
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(reportData)
    };

  } catch (error) {
    console.error('❌ Error generando reporte:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}
