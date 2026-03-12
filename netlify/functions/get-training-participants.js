// netlify/functions/get-training-participants.js
// Devuelve participantes y estadísticas de una capacitación específica
// Busca participaciones vinculadas a las sesiones de esa capacitación

const AIRTABLE_API = 'https://api.airtable.com/v0';

async function airtableFetch(baseId, apiKey, table, params = '') {
  const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}${params}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Error ${res.status} en tabla ${table}`);
  }
  return res.json();
}

// Paginar todos los registros de Airtable (máximo 100 por página)
async function fetchAllRecords(baseId, apiKey, table, filterFormula = '') {
  const records = [];
  let offset = null;

  do {
    let params = '?pageSize=100';
    if (filterFormula) params += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
    if (offset) params += `&offset=${offset}`;

    const data = await airtableFetch(baseId, apiKey, table, params);
    if (data.records) records.push(...data.records);
    offset = data.offset || null;
  } while (offset);

  return records;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Variables de entorno no configuradas' })
    };
  }

  let trainingId;
  try {
    const body = JSON.parse(event.body || '{}');
    trainingId = body.trainingId;
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Body inválido' }) };
  }

  if (!trainingId) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Falta trainingId' }) };
  }

  try {
    // 1. Obtener la capacitación
    const trainingData = await airtableFetch(baseId, apiKey, 'Capacitaciones', `/${trainingId}`);
    const tf = trainingData.fields || {};

    const training = {
      id: trainingData.id,
      titulo: tf['Título'] || tf['Titulo'] || tf['name'] || tf['Name'] || 'Sin título',
      descripcion: tf['Descripción'] || tf['Descripcion'] || tf['description'] || '',
      departamento: tf['Departamento'] || tf['departamento'] || 'General',
      fechaCreacion: tf['Fecha'] || tf['Fecha Creación'] || tf['Fecha Creacion'] || tf['createdTime'] || '',
      activa: tf['Activa'] !== false,
      finalizada: tf['Finalizada'] === true
    };

    // 2. Obtener sesiones de esta capacitación
    // Sesiones tienen un campo linked "Capacitación" que apunta al id de la capacitación
    const sesionesFilter = `FIND("${trainingId}", ARRAYJOIN({Capacitación}))`;
    const sesionesAlt    = `FIND("${trainingId}", ARRAYJOIN({Capacitacion}))`;

    let sesiones = [];
    try {
      sesiones = await fetchAllRecords(baseId, apiKey, 'Sesiones', sesionesFilter);
    } catch {
      try {
        sesiones = await fetchAllRecords(baseId, apiKey, 'Sesiones', sesionesAlt);
      } catch {
        sesiones = [];
      }
    }

    const sessionIds = sesiones.map(s => s.id);
    console.log(`📋 Sesiones encontradas: ${sessionIds.length}`);

    // 3. Obtener todas las participaciones de esas sesiones
    let allParticipations = [];

    if (sessionIds.length > 0) {
      // Estrategia A: buscar por IDs de sesión via linked field
      for (const sessionId of sessionIds) {
        const filter = `FIND("${sessionId}", ARRAYJOIN({Sesión}))`;
        try {
          const recs = await fetchAllRecords(baseId, apiKey, 'Participaciones', filter);
          allParticipations.push(...recs);
        } catch {
          // Intentar campo alternativo
          const filter2 = `FIND("${sessionId}", ARRAYJOIN({Sesion}))`;
          try {
            const recs2 = await fetchAllRecords(baseId, apiKey, 'Participaciones', filter2);
            allParticipations.push(...recs2);
          } catch {
            // ignorar sesiones sin participaciones
          }
        }
      }
    }

    // Eliminar duplicados por ID
    const seen = new Set();
    allParticipations = allParticipations.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    console.log(`👥 Participaciones totales: ${allParticipations.length}`);

    // 4. Normalizar participantes
    const participants = allParticipations.map(p => {
      const f = p.fields || {};

      // Nombres de campos posibles (el sistema usa distintos nombres)
      const nombre =
        f['Nombre Completo'] || f['Nombre'] || f['name'] || f['Name'] || 'Sin nombre';
      const email =
        f['Email'] || f['email'] || f['Correo'] || '';
      const departamento =
        f['Departamento'] || f['departamento'] || f['Servicio'] || '';
      const cargo =
        f['Cargo'] || f['cargo'] || f['Profesión'] || f['Profesion'] || '';
      const pretestScore =
        parseFloat(f['Pretest Score'] || f['Puntuación Pretest'] || f['pretest_score'] || 0);
      const postestScore =
        parseFloat(f['Posttest Score'] || f['Puntuación Posttest'] || f['Puntuación Postest'] || f['posttest_score'] || 0);

      // Estado
      let status = 'Pendiente';
      const rawStatus = f['Estado'] || '';
      if (rawStatus.toLowerCase().includes('posttest') || rawStatus.toLowerCase().includes('postest') || rawStatus.toLowerCase().includes('completado')) {
        status = postestScore > 0 ? 'Completado' : 'Pretest Completado';
      } else if (f['Completado Pretest'] || pretestScore > 0) {
        status = postestScore > 0 ? 'Completado' : 'Pretest Completado';
      }
      if (postestScore > 0) status = 'Completado';

      const improvement = postestScore > 0 ? Math.round(postestScore - pretestScore) : 0;

      return {
        id: p.id,
        nombre,
        email,
        departamento,
        cargo,
        pretestScore: Math.round(pretestScore),
        postestScore: Math.round(postestScore),
        improvement,
        status
      };
    });

    // 5. Calcular estadísticas
    const total = participants.length;
    const completed = participants.filter(p => p.postestScore > 0).length;
    const withPretest = participants.filter(p => p.pretestScore > 0);
    const withPostest = participants.filter(p => p.postestScore > 0);

    const avgPretestScore = withPretest.length > 0
      ? Math.round(withPretest.reduce((s, p) => s + p.pretestScore, 0) / withPretest.length)
      : 0;
    const avgPostestScore = withPostest.length > 0
      ? Math.round(withPostest.reduce((s, p) => s + p.postestScore, 0) / withPostest.length)
      : 0;
    const avgImprovement = withPostest.length > 0
      ? Math.round(withPostest.reduce((s, p) => s + p.improvement, 0) / withPostest.length)
      : 0;
    const adherenceRate = total > 0
      ? Math.round((completed / total) * 100)
      : 0;

    const statistics = {
      totalParticipants: total,
      completedPostest: completed,
      avgPretestScore,
      avgPostestScore,
      avgImprovement,
      adherenceRate
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        training,
        participants,
        statistics
      })
    };

  } catch (err) {
    console.error('❌ Error en get-training-participants:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
