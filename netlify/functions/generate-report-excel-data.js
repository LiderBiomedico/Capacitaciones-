// netlify/functions/generate-report-excel-data.js
// ═════════════════════════════════════════════════════════════════
// FUNCIÓN NUEVA: Genera Excel con DATOS REALES de Airtable
// Hospital Susana López de Valencia E.S.E.
// ═════════════════════════════════════════════════════════════════

const https = require('https');

// Función para hacer peticiones HTTPS a Airtable
async function airtableRequest(method, endpoint, apiKey, baseId, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.airtable.com',
      path: `/v0/${baseId}${endpoint}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', chunk => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          console.error('Error parsing response:', responseData);
          reject(new Error('Error parsing Airtable response'));
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e);
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Función para generar CSV (alternativa simple que siempre funciona)
function generateCSVReport(training, participants) {
  let csv = 'INFORME DE ADHERENCIA A CAPACITACIÓN\n';
  csv += `Hospital Susana López de Valencia E.S.E.\n\n`;
  
  csv += 'INFORMACIÓN GENERAL\n';
  csv += `Capacitación,${training.titulo || ''}\n`;
  csv += `Personal Capacitado,${participants.length}\n`;
  csv += `Fecha,${new Date().toLocaleDateString('es-ES')}\n`;
  csv += `Departamento,${training.departamento || ''}\n\n`;

  csv += 'PARTICIPANTES Y EVALUACIONES\n';
  csv += 'No.,Apellidos y Nombres,Pre-Test,Post-Test,Promedio,Aprobado\n';

  let pretestApproved = 0;
  let posttestApproved = 0;

  participants.forEach((p, idx) => {
    const pretest = Number(p.pretest) || 0;
    const posttest = Number(p.posttest) || 0;
    const promedio = ((pretest + posttest) / 2).toFixed(1);
    const aprobado = posttest >= 3 ? 'SÍ' : 'NO';

    if (pretest >= 3) pretestApproved++;
    if (posttest >= 3) posttestApproved++;

    csv += `${idx + 1},"${p.nombre}",${pretest},${posttest},${promedio},${aprobado}\n`;
  });

  csv += '\nRESUMEN DE EVALUACIÓN\n';
  csv += `Total Aprobados Pretest,${pretestApproved}\n`;
  csv += `Total Aprobados Postest,${posttestApproved}\n`;
  csv += `Total Evaluados,${participants.length}\n`;

  return csv;
}

// Función principal del handler
exports.handler = async (event) => {
  console.log('📊 Iniciando generación de reporte Excel');

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

    console.log('📝 Parámetros recibidos:', { trainingId });

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
      console.error('❌ Falta configuración de variables de entorno');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Variables de entorno no configuradas (AIRTABLE_API_KEY, AIRTABLE_BASE_ID)' 
        })
      };
    }

    console.log('🔄 Obteniendo datos de Airtable...');

    // ═════════════════════════════════════════════════════════════════
    // 1. Obtener capacitación
    // ═════════════════════════════════════════════════════════════════
    let training = {};
    try {
      const trainingResponse = await airtableRequest(
        'GET',
        `/Capacitaciones/${trainingId}`,
        AIRTABLE_API_KEY,
        AIRTABLE_BASE_ID
      );

      if (!trainingResponse || trainingResponse.error) {
        console.error('Capacitación no encontrada:', trainingResponse);
        throw new Error('Capacitación no encontrada');
      }

      training = trainingResponse.fields;
      console.log('✅ Capacitación obtenida:', training['Título'] || training['titulo']);
    } catch (error) {
      console.error('Error obteniendo capacitación:', error.message);
      throw error;
    }

    // ═════════════════════════════════════════════════════════════════
    // 2. Obtener sesiones relacionadas
    // ═════════════════════════════════════════════════════════════════
    let sessionIds = [];
    try {
      const sessionsResponse = await airtableRequest(
        'GET',
        '/Sesiones?pageSize=100',
        AIRTABLE_API_KEY,
        AIRTABLE_BASE_ID
      );

      if (sessionsResponse && sessionsResponse.records) {
        const linkedSessions = sessionsResponse.records.filter(s => {
          const caps = s.fields['Capacitaciones'] || [];
          return Array.isArray(caps) 
            ? caps.includes(trainingId) 
            : caps === trainingId;
        });

        sessionIds = linkedSessions.map(s => s.id);
        console.log(`✅ Sesiones encontradas: ${sessionIds.length}`);
      }
    } catch (error) {
      console.error('Error obteniendo sesiones:', error.message);
      sessionIds = [];
    }

    // ═════════════════════════════════════════════════════════════════
    // 3. Obtener participaciones
    // ═════════════════════════════════════════════════════════════════
    let participants = [];
    try {
      const participationsResponse = await airtableRequest(
        'GET',
        '/Participaciones?pageSize=100',
        AIRTABLE_API_KEY,
        AIRTABLE_BASE_ID
      );

      if (participationsResponse && participationsResponse.records) {
        const linkedParticipations = participationsResponse.records.filter(p => {
          const sesion = p.fields['Sesión'] || [];
          if (Array.isArray(sesion)) {
            return sesion.some(sid => sessionIds.includes(sid));
          }
          return sessionIds.includes(sesion);
        });

        participants = linkedParticipations.map(p => {
          const fields = p.fields;
          const pretestScore = Number(fields['Puntuación Pretest'] || fields['Pretest Score'] || 0);
          const postestScore = Number(fields['Puntuación Posttest'] || fields['Post-test Score'] || 0);

          return {
            nombre: fields['Nombre Completo'] || fields['Nombre'] || 'Sin nombre',
            email: fields['Email'] || '',
            departamento: fields['Departamento'] || '',
            cargo: fields['Cargo'] || '',
            pretest: pretestScore,
            posttest: postestScore
          };
        });

        console.log(`✅ Participantes encontrados: ${participants.length}`);
      }
    } catch (error) {
      console.error('Error obteniendo participaciones:', error.message);
      participants = [];
    }

    console.log('📊 Datos obtenidos:');
    console.log(`   - Capacitación: ${training['Título'] || 'N/A'}`);
    console.log(`   - Participantes: ${participants.length}`);

    // ═════════════════════════════════════════════════════════════════
    // 4. Generar CSV (alternativa funcional)
    // ═════════════════════════════════════════════════════════════════
    const csvContent = generateCSVReport(training, participants);
    const csvBuffer = Buffer.from(csvContent, 'utf-8');

    console.log('✅ Reporte CSV generado');

    // ═════════════════════════════════════════════════════════════════
    // 5. Retornar archivo
    // ═════════════════════════════════════════════════════════════════
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const fileName = `Informe-Adherencia-${dateStr}.csv`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Access-Control-Allow-Origin': '*'
      },
      body: csvContent,
      isBase64Encoded: false
    };

  } catch (error) {
    console.error('❌ Error generando reporte:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: error.toString()
      })
    };
  }
};
