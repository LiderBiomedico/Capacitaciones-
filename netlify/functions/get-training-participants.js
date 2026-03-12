// netlify/functions/get-training-participants.js
// Devuelve participantes de una capacitación con búsqueda robusta en Airtable
// Soporta múltiples variantes de nombres de campos y relaciones.

const https = require('https');

function airtableGet(baseId, apiKey, table, params = '') {
  return new Promise((resolve, reject) => {
    const path = `/v0/${baseId}/${encodeURIComponent(table)}${params}`;
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body || '{}') });
        } catch (e) {
          reject(new Error('JSON inválido: ' + String(body).slice(0, 300)));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function fetchAllRecords(baseId, apiKey, table, filter = '', fields = []) {
  const records = [];
  let offset = null;

  do {
    let params = '?pageSize=100';
    if (filter) params += '&filterByFormula=' + encodeURIComponent(filter);
    for (const field of fields) {
      params += `&fields[]=${encodeURIComponent(field)}`;
    }
    if (offset) params += '&offset=' + encodeURIComponent(offset);

    const { status, data } = await airtableGet(baseId, apiKey, table, params);
    if (status !== 200) {
      throw new Error(`Error ${status} en tabla ${table}: ${JSON.stringify(data).slice(0, 300)}`);
    }

    if (Array.isArray(data.records)) records.push(...data.records);
    offset = data.offset || null;
  } while (offset);

  return records;
}

function safeNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const cleaned = String(v).replace(',', '.').replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function firstFilled(obj, keys, fallback = '') {
  if (!obj) return fallback;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function normText(value) {
  return String(value || '').trim().toUpperCase();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function hasLinkedId(fields, possibleKeys, wantedIds) {
  const wanted = new Set(wantedIds || []);
  if (!wanted.size) return false;

  for (const key of possibleKeys) {
    const values = asArray(fields?.[key]);
    for (const value of values) {
      if (wanted.has(value)) return true;
    }
  }
  return false;
}

function stringContainsAnyField(fields, possibleKeys, wantedValues) {
  const wanted = (wantedValues || []).map(normText).filter(Boolean);
  if (!wanted.length) return false;

  for (const key of possibleKeys) {
    const raw = fields?.[key];
    const haystack = normText(Array.isArray(raw) ? raw.join(' | ') : raw);
    if (!haystack) continue;
    if (wanted.some((w) => haystack.includes(w))) return true;
  }
  return false;
}

function uniqueById(records) {
  const seen = new Set();
  return (records || []).filter((record) => {
    if (!record || !record.id || seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      body: JSON.stringify({ success: false, error: 'Variables AIRTABLE_API_KEY / AIRTABLE_BASE_ID no configuradas en Netlify' })
    };
  }

  let trainingId = '';
  try {
    trainingId = JSON.parse(event.body || '{}').trainingId;
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Body inválido' }) };
  }

  if (!trainingId) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Falta trainingId' }) };
  }

  try {
    // 1) Obtener capacitación
    const { status: trainingStatus, data: trainingData } = await airtableGet(baseId, apiKey, 'Capacitaciones', `/${trainingId}`);
    if (trainingStatus !== 200) {
      throw new Error('No se pudo obtener la capacitación: ' + JSON.stringify(trainingData).slice(0, 250));
    }

    const tf = trainingData.fields || {};
    const accessCode = normText(firstFilled(tf, ['Código de Acceso', 'Código Acceso', 'Codigo de Acceso', 'Codigo Acceso']));
    const trainingTitle = String(firstFilled(tf, ['Título', 'Titulo', 'Name', 'name'], 'Sin título')).trim();

    const training = {
      id: trainingData.id,
      titulo: trainingTitle,
      descripcion: firstFilled(tf, ['Objetivo', 'Descripción', 'Descripcion', 'description'], ''),
      departamento: firstFilled(tf, ['ProcesoAtencion', 'Departamento', 'Servicio', 'Area'], 'General'),
      fechaCreacion: firstFilled(tf, ['Fecha de la capacitación', 'Fecha de la Capacitacion', 'Fecha', 'Fecha Creación', 'Fecha Creacion'], trainingData.createdTime || ''),
      activa: tf['Estado'] !== 'inactive' && tf['Estado'] !== 'finalizada' && tf['Activa'] !== false && tf['Finalizada'] !== true,
      finalizada: tf['Finalizada'] === true || tf['Estado'] === 'finalizada',
      accessCode
    };

    // 2) Traer sesiones y participaciones de forma amplia y filtrar en memoria.
    // Esto evita fallos por diferencias de nombres de campo en Airtable.
    const [sessions, participations] = await Promise.all([
      fetchAllRecords(baseId, apiKey, 'Sesiones'),
      fetchAllRecords(baseId, apiKey, 'Participaciones')
    ]);

    // 3) Identificar sesiones relacionadas con la capacitación
    const linkedSessions = sessions.filter((session) => {
      const f = session.fields || {};
      return (
        hasLinkedId(f, ['Capacitaciones', 'Capacitación', 'Capacitacion', 'Training', 'Capacitacion Relacionada'], [trainingId]) ||
        stringContainsAnyField(f, ['Código de Acceso', 'Código Acceso', 'Codigo de Acceso', 'Codigo Acceso'], [accessCode]) ||
        stringContainsAnyField(f, ['Título', 'Titulo', 'Nombre', 'Name'], [trainingTitle])
      );
    });

    const sessionIds = linkedSessions.map((s) => s.id);

    // 4) Buscar participaciones relacionadas por varias rutas
    let allParticipations = participations.filter((record) => {
      const f = record.fields || {};

      const matchesBySession = hasLinkedId(f, ['Sesión', 'Sesion', 'Session'], sessionIds);
      const matchesByTraining = hasLinkedId(f, ['Capacitación', 'Capacitacion', 'Capacitaciones', 'Training'], [trainingId]);
      const matchesByCode = stringContainsAnyField(f, ['Código de Acceso', 'Código Acceso', 'Codigo de Acceso', 'Codigo Acceso'], [accessCode]);
      const matchesByTitle = stringContainsAnyField(f, ['Capacitación Nombre', 'Nombre Capacitación', 'Nombre Capacitacion', 'Capacitación', 'Capacitacion', 'Training Name'], [trainingTitle]);

      return matchesBySession || matchesByTraining || matchesByCode || matchesByTitle;
    });

    // Respaldo: si no encontró nada, intentar relación indirecta por coincidencia textual de sesiones y códigos
    if (allParticipations.length === 0 && (sessionIds.length > 0 || accessCode || trainingTitle)) {
      allParticipations = participations.filter((record) => {
        const f = record.fields || {};
        return (
          stringContainsAnyField(f, ['Sesión', 'Sesion', 'Session'], sessionIds) ||
          stringContainsAnyField(f, ['Código de Acceso', 'Código Acceso', 'Codigo de Acceso', 'Codigo Acceso'], [accessCode]) ||
          stringContainsAnyField(f, ['Capacitación Nombre', 'Nombre Capacitación', 'Nombre Capacitacion', 'Observaciones', 'Notas'], [trainingTitle])
        );
      });
    }

    allParticipations = uniqueById(allParticipations);

    // 5) Normalizar participantes
    const participants = allParticipations.map((p) => {
      const f = p.fields || {};

      const nombre = String(firstFilled(f, ['Nombre', 'Nombre Completo', 'Participante', 'Name', 'name'], 'Sin nombre')).trim();
      const email = String(firstFilled(f, ['Email', 'Correo', 'Correo Electrónico', 'Correo Electronico', 'email'], '')).trim();
      const departamento = String(firstFilled(f, ['Departamento', 'Servicio', 'Área', 'Area', 'Proceso'], '')).trim();
      const cargo = String(firstFilled(f, ['Cargo', 'Profesión', 'Profesion', 'Rol'], '')).trim();

      const pretestScore = Math.round(safeNum(firstFilled(f, [
        'Pretest Score',
        'Puntuación Pretest',
        'Puntuacion Pretest',
        'Pre-test Score',
        'PretestScore'
      ], 0)));

      const postestScore = Math.round(safeNum(firstFilled(f, [
        'Puntuación Posttest',
        'Puntuacion Posttest',
        'Puntuación Postest',
        'Puntuacion Postest',
        'Posttest Score',
        'Post-test Score',
        'Postest Score',
        'PostestScore',
        'PosttestScore'
      ], 0)));

      const rawStatus = normText(firstFilled(f, ['Estado', 'Status', 'Resultado'], ''));
      let status = 'Pendiente';

      if (postestScore > 0) {
        status = 'Completado';
      } else if (pretestScore > 0 || f['Completado Pretest'] === true) {
        status = 'Pretest Completado';
      }

      if (rawStatus.includes('COMPLET')) status = 'Completado';
      else if (rawStatus.includes('POSTTEST') || rawStatus.includes('POSTEST')) status = postestScore > 0 ? 'Completado' : 'Pretest Completado';
      else if (rawStatus.includes('PRETEST')) status = 'Pretest Completado';

      const improvement = postestScore > 0 ? Math.round(postestScore - pretestScore) : 0;

      return {
        id: p.id,
        nombre,
        email,
        departamento,
        cargo,
        pretestScore,
        postestScore,
        improvement,
        status
      };
    });

    // 6) Ordenar para mejor visualización
    participants.sort((a, b) => {
      const byName = a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });

    // 7) Estadísticas
    const total = participants.length;
    const completed = participants.filter((p) => p.postestScore > 0 || p.status === 'Completado').length;
    const withPre = participants.filter((p) => p.pretestScore > 0);
    const withPost = participants.filter((p) => p.postestScore > 0);

    const avgPretestScore = withPre.length ? Math.round(withPre.reduce((sum, p) => sum + p.pretestScore, 0) / withPre.length) : 0;
    const avgPostestScore = withPost.length ? Math.round(withPost.reduce((sum, p) => sum + p.postestScore, 0) / withPost.length) : 0;
    const avgImprovement = withPost.length ? Math.round(withPost.reduce((sum, p) => sum + p.improvement, 0) / withPost.length) : 0;
    const adherenceRate = total ? Math.round((completed / total) * 100) : 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        training,
        participants,
        statistics: {
          totalParticipants: total,
          completedPostest: completed,
          avgPretestScore,
          avgPostestScore,
          avgImprovement,
          adherenceRate
        },
        debug: {
          accessCode,
          trainingTitle,
          sessionsFound: linkedSessions.length,
          participationsFound: allParticipations.length
        }
      })
    };
  } catch (err) {
    console.error('❌ Error en get-training-participants:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message || 'Error interno del servidor' })
    };
  }
};
