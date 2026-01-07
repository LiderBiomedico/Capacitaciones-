// netlify/functions/debug-training.js
// ═════════════════════════════════════════════════════════════════
// FUNCIÓN DE DIAGNÓSTICO - Ver estructura real de datos
// ═════════════════════════════════════════════════════════════════

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Solo POST' })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { trainingId } = payload;

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Variables de entorno no configuradas' })
      };
    }

    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
    const authHeaders = {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    };

    const debug = {
      trainingId,
      paso1_capacitacion: null,
      paso2_todasLasSesiones: [],
      paso3_sesionesVinculadas: [],
      paso4_todasLasParticipaciones: [],
      paso5_participacionesVinculadas: [],
      camposEncontrados: {}
    };

    // ═══════════════════════════════════════════════════════════
    // PASO 1: Obtener la capacitación
    // ═══════════════════════════════════════════════════════════
    
    if (trainingId) {
      const trainingRes = await fetch(`${baseUrl}/Capacitaciones/${trainingId}`, {
        headers: authHeaders
      });
      if (trainingRes.ok) {
        const trainingData = await trainingRes.json();
        debug.paso1_capacitacion = {
          id: trainingData.id,
          campos: Object.keys(trainingData.fields),
          titulo: trainingData.fields['Título'] || trainingData.fields['Titulo'],
          datos: trainingData.fields
        };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 2: Obtener TODAS las sesiones (para ver estructura)
    // ═══════════════════════════════════════════════════════════
    
    const allSessionsRes = await fetch(`${baseUrl}/Sesiones?maxRecords=10`, {
      headers: authHeaders
    });
    
    if (allSessionsRes.ok) {
      const allSessionsData = await allSessionsRes.json();
      debug.paso2_todasLasSesiones = (allSessionsData.records || []).map(s => ({
        id: s.id,
        campos: Object.keys(s.fields),
        capacitacionesVinculadas: s.fields['Capacitaciones'] || s.fields['Capacitación'] || s.fields['Capacitacion'] || 'NO ENCONTRADO',
        codigoAcceso: s.fields['Código Acceso'] || s.fields['Codigo Acceso'] || s.fields['Codigo'] || 'NO ENCONTRADO',
        activa: s.fields['Activa']
      }));

      // Guardar nombres de campos encontrados
      if (allSessionsData.records && allSessionsData.records.length > 0) {
        debug.camposEncontrados.sesiones = Object.keys(allSessionsData.records[0].fields);
      }

      // Filtrar sesiones que tienen esta capacitación
      if (trainingId) {
        debug.paso3_sesionesVinculadas = debug.paso2_todasLasSesiones.filter(s => {
          const caps = s.capacitacionesVinculadas;
          if (Array.isArray(caps)) {
            return caps.includes(trainingId);
          }
          return caps === trainingId;
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 3: Obtener TODAS las participaciones (para ver estructura)
    // ═══════════════════════════════════════════════════════════
    
    const allParticipationsRes = await fetch(`${baseUrl}/Participaciones?maxRecords=20`, {
      headers: authHeaders
    });
    
    if (allParticipationsRes.ok) {
      const allParticipationsData = await allParticipationsRes.json();
      debug.paso4_todasLasParticipaciones = (allParticipationsData.records || []).map(p => ({
        id: p.id,
        campos: Object.keys(p.fields),
        sesionVinculada: p.fields['Sesión'] || p.fields['Sesion'] || p.fields['Session'] || 'NO ENCONTRADO',
        nombre: p.fields['Nombre'] || p.fields['Nombre Completo'] || 'NO ENCONTRADO',
        pretestScore: p.fields['Pretest Score'] || p.fields['Puntuación Pretest'] || p.fields['PretestScore'] || 0,
        posttestScore: p.fields['Post-test Score'] || p.fields['Puntuación Posttest'] || p.fields['PosttestScore'] || 0
      }));

      // Guardar nombres de campos encontrados
      if (allParticipationsData.records && allParticipationsData.records.length > 0) {
        debug.camposEncontrados.participaciones = Object.keys(allParticipationsData.records[0].fields);
      }

      // Filtrar participaciones de las sesiones vinculadas
      if (debug.paso3_sesionesVinculadas.length > 0) {
        const sessionIds = debug.paso3_sesionesVinculadas.map(s => s.id);
        debug.paso5_participacionesVinculadas = debug.paso4_todasLasParticipaciones.filter(p => {
          const sesion = p.sesionVinculada;
          if (Array.isArray(sesion)) {
            return sesion.some(sid => sessionIds.includes(sid));
          }
          return sessionIds.includes(sesion);
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // RESUMEN
    // ═══════════════════════════════════════════════════════════
    
    debug.resumen = {
      capacitacionEncontrada: !!debug.paso1_capacitacion,
      totalSesionesEnBase: debug.paso2_todasLasSesiones.length,
      sesionesDeEstaCapacitacion: debug.paso3_sesionesVinculadas.length,
      totalParticipacionesEnBase: debug.paso4_todasLasParticipaciones.length,
      participacionesDeEstaCapacitacion: debug.paso5_participacionesVinculadas.length
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(debug, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message, stack: error.stack })
    };
  }
}
