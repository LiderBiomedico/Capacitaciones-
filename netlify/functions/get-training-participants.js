// netlify/functions/get-training-participants.js
// ═════════════════════════════════════════════════════════════════
// Obtiene todos los participantes de una capacitación específica
// Flujo: Capacitación → Sesiones → Participaciones
// ═════════════════════════════════════════════════════════════════

export async function handler(event) {
  // Headers CORS
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Manejar preflight OPTIONS
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
    // ═════════════════════════════════════════════════════════════
    // PASO 1: Parsear request y validar
    // ═════════════════════════════════════════════════════════════
    
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

    // ═════════════════════════════════════════════════════════════
    // PASO 2: Obtener credenciales
    // ═════════════════════════════════════════════════════════════

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Variables de entorno no configuradas (AIRTABLE_API_KEY, AIRTABLE_BASE_ID)' 
        })
      };
    }

    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
    const authHeaders = {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    };

    console.log('📊 Obteniendo participantes para capacitación:', trainingId);

    // ═════════════════════════════════════════════════════════════
    // PASO 3: Obtener datos de la capacitación
    // ═════════════════════════════════════════════════════════════

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
    console.log('✅ Capacitación encontrada:', trainingData.fields['Título']);

    // ═════════════════════════════════════════════════════════════
    // PASO 4: Obtener TODAS las sesiones de esta capacitación
    // ═════════════════════════════════════════════════════════════

    // Usamos filterByFormula para buscar sesiones que tengan esta capacitación
    const sessionsFormula = encodeURIComponent(`FIND("${trainingId}", ARRAYJOIN({Capacitaciones})) > 0`);
    const sessionsUrl = `${baseUrl}/Sesiones?filterByFormula=${sessionsFormula}`;
    
    console.log('🔍 Buscando sesiones...');
    
    const sessionsResponse = await fetch(sessionsUrl, {
      method: 'GET',
      headers: authHeaders
    });

    let sessions = [];
    if (sessionsResponse.ok) {
      const sessionsData = await sessionsResponse.json();
      sessions = sessionsData.records || [];
      console.log(`✅ Encontradas ${sessions.length} sesiones`);
    } else {
      console.warn('⚠️ No se pudieron obtener sesiones, intentando método alternativo...');
      
      // Método alternativo: obtener todas las sesiones y filtrar manualmente
      const allSessionsResponse = await fetch(`${baseUrl}/Sesiones?maxRecords=100`, {
        method: 'GET',
        headers: authHeaders
      });
      
      if (allSessionsResponse.ok) {
        const allSessionsData = await allSessionsResponse.json();
        sessions = (allSessionsData.records || []).filter(session => {
          const caps = session.fields['Capacitaciones'] || [];
          return caps.includes(trainingId);
        });
        console.log(`✅ (Método alternativo) Encontradas ${sessions.length} sesiones`);
      }
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 5: Obtener TODAS las participaciones de estas sesiones
    // ═════════════════════════════════════════════════════════════

    let allParticipants = [];
    
    if (sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      console.log('🔍 Buscando participaciones para sesiones:', sessionIds);
      
      // Construir fórmula para buscar participaciones de cualquiera de estas sesiones
      // OR(FIND("rec1", ARRAYJOIN({Sesión}))>0, FIND("rec2", ARRAYJOIN({Sesión}))>0, ...)
      const orConditions = sessionIds.map(id => `FIND("${id}", ARRAYJOIN({Sesión})) > 0`);
      const participationsFormula = encodeURIComponent(`OR(${orConditions.join(', ')})`);
      
      const participationsUrl = `${baseUrl}/Participaciones?filterByFormula=${participationsFormula}`;
      
      const participationsResponse = await fetch(participationsUrl, {
        method: 'GET',
        headers: authHeaders
      });

      if (participationsResponse.ok) {
        const participationsData = await participationsResponse.json();
        allParticipants = participationsData.records || [];
        console.log(`✅ Encontradas ${allParticipants.length} participaciones`);
      } else {
        console.warn('⚠️ Error en filtro, intentando método alternativo...');
        
        // Método alternativo: obtener todas las participaciones y filtrar
        const allParticipationsResponse = await fetch(`${baseUrl}/Participaciones?maxRecords=500`, {
          method: 'GET',
          headers: authHeaders
        });
        
        if (allParticipationsResponse.ok) {
          const allParticipationsData = await allParticipationsResponse.json();
          allParticipants = (allParticipationsData.records || []).filter(p => {
            const sessionLinks = p.fields['Sesión'] || [];
            return sessionLinks.some(sid => sessionIds.includes(sid));
          });
          console.log(`✅ (Método alternativo) Encontradas ${allParticipants.length} participaciones`);
        }
      }
    }

    // ═════════════════════════════════════════════════════════════
    // PASO 6: Formatear datos de participantes
    // ═════════════════════════════════════════════════════════════

    const formattedParticipants = allParticipants.map(p => {
      const fields = p.fields;
      
      // Obtener scores (pueden estar en diferentes campos)
      const pretestScore = fields['Puntuación Pretest'] || fields['Pretest Score'] || fields['PretestScore'] || 0;
      const postestScore = fields['Puntuación Posttest'] || fields['Post-test Score'] || fields['PosttestScore'] || fields['Puntuación Postest'] || 0;
      
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

      return {
        id: p.id,
        nombre: fields['Nombre Completo'] || fields['Nombre'] || 'Sin nombre',
        email: fields['Email'] || fields['Correo'] || '',
        departamento: fields['Departamento'] || fields['Cargo'] || '',
        cargo: fields['Cargo'] || '',
        pretestScore: Math.round(pretestScore),
        postestScore: Math.round(postestScore),
        improvement: improvement,
        status: status,
        fechaRegistro: fields['Fecha Registro'] || fields['Fecha Inicio'] || fields['Created'] || ''
      };
    });

    // Ordenar por nombre
    formattedParticipants.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // ═════════════════════════════════════════════════════════════
    // PASO 7: Calcular estadísticas
    // ═════════════════════════════════════════════════════════════

    const totalParticipants = formattedParticipants.length;
    const completedPretest = formattedParticipants.filter(p => p.pretestScore > 0).length;
    const completedPostest = formattedParticipants.filter(p => p.postestScore > 0).length;
    
    // Promedios
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

    // ═════════════════════════════════════════════════════════════
    // PASO 8: Respuesta exitosa
    // ═════════════════════════════════════════════════════════════

    const response = {
      success: true,
      training: {
        id: trainingId,
        titulo: trainingData.fields['Título'] || 'Sin título',
        descripcion: trainingData.fields['Descripción'] || '',
        departamento: trainingData.fields['Departamento'] || 'General',
        activa: trainingData.fields['Activa'] !== false,
        finalizada: trainingData.fields['Finalizada'] === true,
        fechaCreacion: trainingData.fields['Fecha Creación'] || ''
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
        avgPretestScore,
        avgPostestScore,
        avgImprovement,
        adherenceRate
      }
    };

    console.log('✅ Reporte generado exitosamente');
    console.log(`   - Total participantes: ${totalParticipants}`);
    console.log(`   - Completaron pretest: ${completedPretest}`);
    console.log(`   - Completaron postest: ${completedPostest}`);

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
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
}

/*
═════════════════════════════════════════════════════════════════
INSTALACIÓN
═════════════════════════════════════════════════════════════════

1. Crear el archivo en:
   netlify/functions/get-training-participants.js

2. Asegúrate de tener las variables de entorno en Netlify:
   - AIRTABLE_API_KEY
   - AIRTABLE_BASE_ID

3. Deploy:
   netlify deploy --prod

═════════════════════════════════════════════════════════════════
ESTRUCTURA DE AIRTABLE ESPERADA
═════════════════════════════════════════════════════════════════

Tabla: Capacitaciones
- Título (Single line text)
- Descripción (Long text)
- Departamento (Single select)
- Activa (Checkbox)
- Finalizada (Checkbox)
- Fecha Creación (Date)

Tabla: Sesiones
- Capacitaciones (Link to Capacitaciones) ← IMPORTANTE
- Código Acceso (Single line text)
- Activa (Checkbox)
- Fecha Inicio (Date)

Tabla: Participaciones
- Sesión (Link to Sesiones) ← IMPORTANTE
- Nombre Completo (Single line text)
- Email (Email)
- Departamento (Single line text)
- Cargo (Single select)
- Puntuación Pretest (Number) o Pretest Score
- Puntuación Posttest (Number) o Post-test Score
- Estado (Single select)

═════════════════════════════════════════════════════════════════
TESTING
═════════════════════════════════════════════════════════════════

En consola del navegador:

fetch('/.netlify/functions/get-training-participants', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ trainingId: 'recXXXXXXXXXXXX' })
})
.then(r => r.json())
.then(d => console.log(d));

═════════════════════════════════════════════════════════════════
*/
