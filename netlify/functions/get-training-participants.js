// netlify/functions/get-training-participants.js
// ═════════════════════════════════════════════════════════════════
// Obtiene todos los participantes de una capacitación específica
// VERSIÓN MEJORADA - Búsqueda flexible de campos
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
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'JSON inválido' })
      };
    }

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
        body: JSON.stringify({ 
          success: false, 
          error: 'Variables de entorno no configuradas' 
        })
      };
    }

    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
    const authHeaders = {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    };

    console.log('📊 Obteniendo participantes para capacitación:', trainingId);

    // ═══════════════════════════════════════════════════════════
    // PASO 1: Obtener datos de la capacitación
    // ═══════════════════════════════════════════════════════════

    const trainingResponse = await fetch(`${baseUrl}/Capacitaciones/${trainingId}`, {
      method: 'GET',
      headers: authHeaders
    });

    if (!trainingResponse.ok) {
      const errorData = await trainingResponse.json();
      console.error('❌ Error obteniendo capacitación:', errorData);
      return {
        statusCode: trainingResponse.status,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Capacitación no encontrada',
          details: errorData 
        })
      };
    }

    const trainingData = await trainingResponse.json();
    const trainingFields = trainingData.fields;
    
    // Buscar título con diferentes nombres de campo posibles
    const titulo = trainingFields['Título'] || trainingFields['Titulo'] || trainingFields['Title'] || 'Sin título';
    console.log('✅ Capacitación encontrada:', titulo);

    // ═══════════════════════════════════════════════════════════
    // PASO 2: Obtener TODAS las sesiones y filtrar manualmente
    // (Método más robusto que filterByFormula)
    // ═══════════════════════════════════════════════════════════

    console.log('🔍 Buscando sesiones...');
    
    let allSessions = [];
    let offset = null;
    
    // Paginar para obtener todas las sesiones
    do {
      const sessionsUrl = offset 
        ? `${baseUrl}/Sesiones?pageSize=100&offset=${offset}`
        : `${baseUrl}/Sesiones?pageSize=100`;
      
      const sessionsResponse = await fetch(sessionsUrl, {
        method: 'GET',
        headers: authHeaders
      });

      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json();
        allSessions = allSessions.concat(sessionsData.records || []);
        offset = sessionsData.offset;
      } else {
        console.error('❌ Error obteniendo sesiones');
        offset = null;
      }
    } while (offset);

    console.log(`📋 Total sesiones en base: ${allSessions.length}`);

    // Filtrar sesiones que pertenecen a esta capacitación
    const linkedSessions = allSessions.filter(session => {
      const fields = session.fields;
      // Buscar el campo de vinculación con diferentes nombres posibles
      const capacitaciones = fields['Capacitaciones'] || fields['Capacitación'] || fields['Capacitacion'] || fields['Training'] || [];
      
      if (Array.isArray(capacitaciones)) {
        return capacitaciones.includes(trainingId);
      }
      return capacitaciones === trainingId;
    });

    console.log(`✅ Sesiones de esta capacitación: ${linkedSessions.length}`);

    if (linkedSessions.length === 0) {
      // No hay sesiones, devolver resultado vacío
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          training: {
            id: trainingId,
            titulo: titulo,
            descripcion: trainingFields['Descripción'] || trainingFields['Descripcion'] || '',
            departamento: trainingFields['Departamento'] || 'General',
            activa: trainingFields['Activa'] !== false,
            finalizada: trainingFields['Finalizada'] === true,
            fechaCreacion: trainingFields['Fecha Creación'] || trainingFields['Fecha Creacion'] || ''
          },
          sessions: [],
          participants: [],
          statistics: {
            totalParticipants: 0,
            completedPretest: 0,
            completedPostest: 0,
            avgPretestScore: 0,
            avgPostestScore: 0,
            avgImprovement: 0,
            adherenceRate: 0
          },
          debug: {
            totalSesionesEnBase: allSessions.length,
            sesionesVinculadas: 0,
            mensaje: 'No se encontraron sesiones vinculadas a esta capacitación'
          }
        })
      };
    }

    const sessionIds = linkedSessions.map(s => s.id);

    // ═══════════════════════════════════════════════════════════
    // PASO 3: Obtener TODAS las participaciones y filtrar
    // ═══════════════════════════════════════════════════════════

    console.log('🔍 Buscando participaciones...');
    
    let allParticipations = [];
    offset = null;
    
    do {
      const participationsUrl = offset
        ? `${baseUrl}/Participaciones?pageSize=100&offset=${offset}`
        : `${baseUrl}/Participaciones?pageSize=100`;
      
      const participationsResponse = await fetch(participationsUrl, {
        method: 'GET',
        headers: authHeaders
      });

      if (participationsResponse.ok) {
        const participationsData = await participationsResponse.json();
        allParticipations = allParticipations.concat(participationsData.records || []);
        offset = participationsData.offset;
      } else {
        console.error('❌ Error obteniendo participaciones');
        offset = null;
      }
    } while (offset);

    console.log(`📋 Total participaciones en base: ${allParticipations.length}`);

    // Filtrar participaciones de las sesiones vinculadas
    const linkedParticipations = allParticipations.filter(participation => {
      const fields = participation.fields;
      // Buscar el campo de sesión con diferentes nombres posibles
      const sesion = fields['Sesión'] || fields['Sesion'] || fields['Session'] || [];
      
      if (Array.isArray(sesion)) {
        return sesion.some(sid => sessionIds.includes(sid));
      }
      return sessionIds.includes(sesion);
    });

    console.log(`✅ Participaciones de esta capacitación: ${linkedParticipations.length}`);

    // ═══════════════════════════════════════════════════════════
    // PASO 4: Formatear datos de participantes
    // ═══════════════════════════════════════════════════════════

    const formattedParticipants = linkedParticipations.map(p => {
      const fields = p.fields;
      
      // Buscar scores con diferentes nombres de campo posibles
      const pretestScore = 
        fields['Pretest Score'] || 
        fields['Puntuación Pretest'] || 
        fields['PretestScore'] ||
        fields['Pretest'] ||
        0;
      
      const postestScore = 
        fields['Post-test Score'] || 
        fields['Posttest Score'] ||
        fields['Puntuación Posttest'] || 
        fields['Puntuación Postest'] ||
        fields['PosttestScore'] ||
        fields['Posttest'] ||
        0;
      
      // Calcular mejora
      const improvement = pretestScore > 0 && postestScore > 0 
        ? Math.round(((postestScore - pretestScore) / pretestScore) * 100) 
        : 0;
      
      // Determinar estado
      let status = 'Pendiente';
      if (postestScore > 0) {
        status = 'Completado';
      } else if (pretestScore > 0) {
        status = 'Pretest Completado';
      } else if (fields['Estado']) {
        status = fields['Estado'];
      }

      // Buscar nombre con diferentes campos posibles
      const nombre = 
        fields['Nombre Completo'] || 
        fields['Nombre'] || 
        fields['Name'] ||
        'Sin nombre';

      return {
        id: p.id,
        nombre: nombre,
        email: fields['Email'] || fields['Correo'] || fields['E-mail'] || '',
        departamento: fields['Departamento'] || fields['Department'] || '',
        cargo: fields['Cargo'] || fields['Position'] || '',
        pretestScore: Math.round(Number(pretestScore) || 0),
        postestScore: Math.round(Number(postestScore) || 0),
        improvement: improvement,
        status: status,
        fechaRegistro: fields['Fecha Registro'] || fields['Fecha de Inicio'] || fields['Fecha Inicio'] || fields['Created'] || ''
      };
    });

    // Ordenar por nombre
    formattedParticipants.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // ═══════════════════════════════════════════════════════════
    // PASO 5: Calcular estadísticas
    // ═══════════════════════════════════════════════════════════

    const totalParticipants = formattedParticipants.length;
    const completedPretest = formattedParticipants.filter(p => p.pretestScore > 0).length;
    const completedPostest = formattedParticipants.filter(p => p.postestScore > 0).length;
    
    const pretestScores = formattedParticipants.filter(p => p.pretestScore > 0).map(p => p.pretestScore);
    const postestScores = formattedParticipants.filter(p => p.postestScore > 0).map(p => p.postestScore);
    
    const avgPretestScore = pretestScores.length > 0 
      ? Math.round(pretestScores.reduce((a, b) => a + b, 0) / pretestScores.length) 
      : 0;
    
    const avgPostestScore = postestScores.length > 0 
      ? Math.round(postestScores.reduce((a, b) => a + b, 0) / postestScores.length) 
      : 0;
    
    const avgImprovement = avgPretestScore > 0 && avgPostestScore > 0
      ? Math.round(((avgPostestScore - avgPretestScore) / avgPretestScore) * 100)
      : 0;
    
    const adherenceRate = totalParticipants > 0 
      ? Math.round((completedPostest / totalParticipants) * 100) 
      : 0;

    // ═══════════════════════════════════════════════════════════
    // RESPUESTA EXITOSA
    // ═══════════════════════════════════════════════════════════

    const response = {
      success: true,
      training: {
        id: trainingId,
        titulo: titulo,
        descripcion: trainingFields['Descripción'] || trainingFields['Descripcion'] || '',
        departamento: trainingFields['Departamento'] || 'General',
        activa: trainingFields['Activa'] !== false,
        finalizada: trainingFields['Finalizada'] === true,
        fechaCreacion: trainingFields['Fecha Creación'] || trainingFields['Fecha Creacion'] || ''
      },
      sessions: linkedSessions.map(s => ({
        id: s.id,
        codigo: s.fields['Código Acceso'] || s.fields['Codigo Acceso'] || '',
        activa: s.fields['Activa'] !== false,
        fechaInicio: s.fields['Fecha Inicio'] || ''
      })),
      participants: formattedParticipants,
      statistics: {
        totalParticipants,
        completedPretest,
        completedPostest,
        avgPretestScore,
        avgPostestScore,
        avgImprovement,
        adherenceRate
      },
      debug: {
        totalSesionesEnBase: allSessions.length,
        sesionesVinculadas: linkedSessions.length,
        totalParticipacionesEnBase: allParticipations.length,
        participacionesVinculadas: linkedParticipations.length
      }
    };

    console.log('✅ Reporte generado exitosamente');
    console.log(`   - Sesiones encontradas: ${linkedSessions.length}`);
    console.log(`   - Total participantes: ${totalParticipants}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('❌ Error en get-training-participants:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      })
    };
  }
}
