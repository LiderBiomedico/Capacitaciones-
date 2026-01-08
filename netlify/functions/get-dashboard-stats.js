// netlify/functions/get-dashboard-stats.js
// ═════════════════════════════════════════════════════════════════
// Obtiene estadísticas globales para el Dashboard
// Cuenta TODAS las participaciones de la base de datos
// ═════════════════════════════════════════════════════════════════

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
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

    console.log('📊 Obteniendo estadísticas del dashboard...');

    // ═══════════════════════════════════════════════════════════
    // PASO 1: Obtener todas las capacitaciones activas
    // ═══════════════════════════════════════════════════════════

    let allTrainings = [];
    let offset = null;

    do {
      const url = offset 
        ? `${baseUrl}/Capacitaciones?pageSize=100&offset=${offset}`
        : `${baseUrl}/Capacitaciones?pageSize=100`;
      
      const response = await fetch(url, { headers: authHeaders });
      
      if (response.ok) {
        const data = await response.json();
        allTrainings = allTrainings.concat(data.records || []);
        offset = data.offset;
      } else {
        offset = null;
      }
    } while (offset);

    const activeTrainings = allTrainings.filter(t => t.fields['Activa'] !== false);
    console.log(`✅ Capacitaciones activas: ${activeTrainings.length}`);

    // ═══════════════════════════════════════════════════════════
    // PASO 2: Obtener TODAS las participaciones
    // ═══════════════════════════════════════════════════════════

    let allParticipations = [];
    offset = null;

    do {
      const url = offset 
        ? `${baseUrl}/Participaciones?pageSize=100&offset=${offset}`
        : `${baseUrl}/Participaciones?pageSize=100`;
      
      const response = await fetch(url, { headers: authHeaders });
      
      if (response.ok) {
        const data = await response.json();
        allParticipations = allParticipations.concat(data.records || []);
        offset = data.offset;
      } else {
        offset = null;
      }
    } while (offset);

    console.log(`✅ Total participaciones: ${allParticipations.length}`);

    // ═══════════════════════════════════════════════════════════
    // PASO 3: Calcular estadísticas
    // ═══════════════════════════════════════════════════════════

    const totalParticipants = allParticipations.length;

    // Extraer scores
    const participantsWithScores = allParticipations.map(p => {
      const fields = p.fields;
      const pretestScore = 
        fields['Pretest Score'] || 
        fields['Puntuación Pretest'] || 
        fields['PretestScore'] || 
        0;
      const postestScore = 
        fields['Post-test Score'] || 
        fields['Posttest Score'] ||
        fields['Puntuación Posttest'] || 
        fields['Puntuación Postest'] ||
        0;
      
      return {
        pretest: Number(pretestScore) || 0,
        posttest: Number(postestScore) || 0
      };
    });

    // Completados = tienen posttest
    const completedPosttest = participantsWithScores.filter(p => p.posttest > 0).length;

    // Tasa de adherencia
    const adherenceRate = totalParticipants > 0 
      ? Math.round((completedPosttest / totalParticipants) * 100) 
      : 0;

    // Promedios
    const pretestScores = participantsWithScores.filter(p => p.pretest > 0).map(p => p.pretest);
    const postestScores = participantsWithScores.filter(p => p.posttest > 0).map(p => p.posttest);

    const avgPretest = pretestScores.length > 0 
      ? Math.round(pretestScores.reduce((a, b) => a + b, 0) / pretestScores.length)
      : 0;

    const avgPosttest = postestScores.length > 0 
      ? Math.round(postestScores.reduce((a, b) => a + b, 0) / postestScores.length)
      : 0;

    // Mejora promedio
    const avgImprovement = avgPretest > 0 && avgPosttest > 0
      ? Math.round(((avgPosttest - avgPretest) / avgPretest) * 100)
      : 0;

    // ═══════════════════════════════════════════════════════════
    // PASO 4: Estadísticas por día (últimos 7 días)
    // ═══════════════════════════════════════════════════════════

    const today = new Date();
    const last7Days = [];
    const participationsByDay = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last7Days.push(dateStr);
      
      // Contar participaciones de ese día
      const count = allParticipations.filter(p => {
        const fechaRegistro = p.fields['Fecha de Inicio'] || p.fields['Fecha Registro'] || p.fields['Fecha Inicio'] || '';
        return fechaRegistro.startsWith(dateStr);
      }).length;
      
      participationsByDay.push(count);
    }

    // Nombres de días
    const dayNames = last7Days.map(dateStr => {
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString('es-ES', { weekday: 'short' });
    });

    // ═══════════════════════════════════════════════════════════
    // PASO 5: Estadísticas por departamento
    // ═══════════════════════════════════════════════════════════

    const departmentStats = {};
    
    allParticipations.forEach(p => {
      const dept = p.fields['Departamento'] || 'General';
      const posttest = Number(p.fields['Post-test Score'] || p.fields['Puntuación Posttest'] || 0);
      
      if (!departmentStats[dept]) {
        departmentStats[dept] = { total: 0, scores: [] };
      }
      
      departmentStats[dept].total++;
      if (posttest > 0) {
        departmentStats[dept].scores.push(posttest);
      }
    });

    // Convertir a arrays para el gráfico
    const departments = Object.keys(departmentStats).slice(0, 5); // Top 5
    const departmentScores = departments.map(dept => {
      const scores = departmentStats[dept].scores;
      return scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    });

    // ═══════════════════════════════════════════════════════════
    // RESPUESTA
    // ═══════════════════════════════════════════════════════════

    const response = {
      success: true,
      statistics: {
        totalTrainings: activeTrainings.length,
        totalParticipants,
        completedPosttest,
        adherenceRate,
        avgPretest,
        avgPosttest,
        avgImprovement
      },
      charts: {
        participationsByDay: {
          labels: dayNames,
          data: participationsByDay
        },
        departmentPerformance: {
          labels: departments,
          data: departmentScores
        }
      },
      debug: {
        totalCapacitaciones: allTrainings.length,
        capacitacionesActivas: activeTrainings.length,
        totalParticipaciones: allParticipations.length
      }
    };

    console.log('✅ Estadísticas calculadas:', response.statistics);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('❌ Error en get-dashboard-stats:', error);
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
