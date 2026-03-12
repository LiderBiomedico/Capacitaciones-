// netlify/functions/get-training-participants.js
// Devuelve participantes de una capacitación usando el módulo https nativo de Node.js
//
// Estructura real de Airtable:
//   Capacitaciones → tiene campo "Código de Acceso"
//   Sesiones       → tiene campo "Código Acceso" (sin "de") vinculado a la capacitación
//   Participaciones → tienen "Nombre", "Departamento", "Profesión", "Pretest Score",
//                     "Puntuación Posttest", "Estado", "Fecha de Inicio"
//                     Y opcionalmente "Código de Acceso" para vincularlas a la capacitación

const https = require('https');

function airtableGet(baseId, apiKey, table, params = '') {
  return new Promise((resolve, reject) => {
    const path = `/v0/${baseId}/${encodeURIComponent(table)}${params}`;
    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { reject(new Error('JSON inválido: ' + body.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchAllRecords(baseId, apiKey, table, filter = '') {
  const records = [];
  let offset = null;
  do {
    let params = '?pageSize=100';
    if (filter) params += '&filterByFormula=' + encodeURIComponent(filter);
    if (offset) params += '&offset=' + offset;
    const { status, data } = await airtableGet(baseId, apiKey, table, params);
    if (status !== 200) throw new Error(`Error ${status} en tabla ${table}: ` + JSON.stringify(data).slice(0, 200));
    if (data.records) records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  return records;
}

function safeNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Variables AIRTABLE_API_KEY / AIRTABLE_BASE_ID no configuradas en Netlify' }) };
  }

  let trainingId;
  try {
    trainingId = JSON.parse(event.body || '{}').trainingId;
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Body inválido' }) };
  }
  if (!trainingId) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Falta trainingId' }) };
  }

  try {
    // ── 1. Obtener la capacitación ──────────────────────────────────────────
    const { status: tStatus, data: tData } = await airtableGet(baseId, apiKey, 'Capacitaciones', `/${trainingId}`);
    if (tStatus !== 200) throw new Error('No se pudo obtener la capacitación: ' + JSON.stringify(tData).slice(0, 200));

    const tf = tData.fields || {};
    const accessCode = (tf['Código de Acceso'] || tf['Código Acceso'] || '').trim();

    const training = {
      id: tData.id,
      titulo:       tf['Título'] || tf['Titulo'] || tf['name'] || tf['Name'] || 'Sin título',
      descripcion:  tf['Objetivo'] || tf['Descripción'] || tf['description'] || '',
      departamento: tf['ProcesoAtencion'] || tf['Departamento'] || 'General',
      fechaCreacion: tf['Fecha de la capacitación'] || tf['Fecha Creación'] || tf['Fecha Creacion'] || tData.createdTime || '',
      activa:    tf['Estado'] !== 'inactive' && tf['Estado'] !== 'finalizada' && tf['Activa'] !== false && tf['Finalizada'] !== true,
      finalizada: tf['Finalizada'] === true || tf['Estado'] === 'finalizada',
      accessCode
    };

    // ── 2. Buscar participaciones ───────────────────────────────────────────
    // Estrategia A: campo "Código de Acceso" directo en Participaciones
    let allParticipations = [];

    if (accessCode) {
      try {
        // Intentar buscar por código de acceso en Participaciones
        const byCode = await fetchAllRecords(baseId, apiKey, 'Participaciones',
          `OR({Código de Acceso}="${accessCode}", {Código Acceso}="${accessCode}")`
        );
        allParticipations = byCode;
        console.log(`📋 Estrategia A (código): ${allParticipations.length} participaciones`);
      } catch (e) {
        console.warn('⚠️ Estrategia A falló:', e.message);
      }
    }

    // Estrategia B: buscar sesiones que tengan el código de acceso → linked IDs → filtrar Participaciones
    if (allParticipations.length === 0) {
      try {
        const sessions = await fetchAllRecords(baseId, apiKey, 'Sesiones',
          accessCode
            ? `OR({Código Acceso}="${accessCode}", {Código de Acceso}="${accessCode}", FIND("${trainingId}", ARRAYJOIN({Capacitación})))`
            : `FIND("${trainingId}", ARRAYJOIN({Capacitación}))`
        );

        console.log(`📋 Sesiones encontradas: ${sessions.length}`);

        for (const session of sessions) {
          const sid = session.id;
          try {
            const recs = await fetchAllRecords(baseId, apiKey, 'Participaciones',
              `OR(FIND("${sid}", ARRAYJOIN({Sesión})), FIND("${sid}", ARRAYJOIN({Sesion})))`
            );
            allParticipations.push(...recs);
          } catch (e) {
            console.warn(`⚠️ Error buscando participaciones de sesión ${sid}:`, e.message);
          }
        }

        // Deduplicar
        const seen = new Set();
        allParticipations = allParticipations.filter(p => seen.has(p.id) ? false : (seen.add(p.id), true));
        console.log(`📋 Estrategia B (sesiones): ${allParticipations.length} participaciones`);
      } catch (e) {
        console.warn('⚠️ Estrategia B falló:', e.message);
      }
    }

    // Estrategia C: traer TODAS las participaciones y filtrar por código (sin filtro Airtable)
    // Solo si las anteriores no dieron resultado y hay código de acceso
    if (allParticipations.length === 0 && accessCode) {
      try {
        console.log('🔍 Estrategia C: obteniendo todas las participaciones...');
        const all = await fetchAllRecords(baseId, apiKey, 'Participaciones');
        allParticipations = all.filter(p => {
          const f = p.fields || {};
          const c = (f['Código de Acceso'] || f['Código Acceso'] || '').toString().trim().toUpperCase();
          return c === accessCode.toUpperCase();
        });
        console.log(`📋 Estrategia C (todas+filtro): ${allParticipations.length} participaciones`);
      } catch (e) {
        console.warn('⚠️ Estrategia C falló:', e.message);
      }
    }

    // ── 3. Normalizar participantes ─────────────────────────────────────────
    const participants = allParticipations.map(p => {
      const f = p.fields || {};

      const nombre      = f['Nombre'] || f['Nombre Completo'] || f['name'] || 'Sin nombre';
      const email       = f['Email'] || f['email'] || f['Correo'] || '';
      const departamento = f['Departamento'] || f['Servicio'] || '';
      const cargo       = f['Cargo'] || f['Profesión'] || f['Profesion'] || '';

      const pretestScore  = safeNum(f['Pretest Score'] || f['Puntuación Pretest']);
      const postestScore  = safeNum(f['Puntuación Posttest'] || f['Puntuación Postest'] || f['Posttest Score']);

      let status = 'Pendiente';
      if (postestScore > 0)       status = 'Completado';
      else if (pretestScore > 0)  status = 'Pretest Completado';
      else if (f['Completado Pretest']) status = 'Pretest Completado';

      const rawStatus = (f['Estado'] || '').toLowerCase();
      if (rawStatus.includes('posttest') || rawStatus.includes('postest') || rawStatus.includes('completado')) {
        status = postestScore > 0 ? 'Completado' : 'Pretest Completado';
      }

      return {
        id: p.id,
        nombre,
        email,
        departamento,
        cargo,
        pretestScore:  Math.round(pretestScore),
        postestScore:  Math.round(postestScore),
        improvement:   postestScore > 0 ? Math.round(postestScore - pretestScore) : 0,
        status
      };
    });

    // ── 4. Estadísticas ─────────────────────────────────────────────────────
    const total       = participants.length;
    const completed   = participants.filter(p => p.postestScore > 0).length;
    const withPre     = participants.filter(p => p.pretestScore > 0);
    const withPost    = participants.filter(p => p.postestScore > 0);

    const avgPretestScore  = withPre.length  ? Math.round(withPre.reduce( (s, p) => s + p.pretestScore,  0) / withPre.length)  : 0;
    const avgPostestScore  = withPost.length ? Math.round(withPost.reduce((s, p) => s + p.postestScore, 0) / withPost.length) : 0;
    const avgImprovement   = withPost.length ? Math.round(withPost.reduce((s, p) => s + p.improvement,  0) / withPost.length) : 0;
    const adherenceRate    = total ? Math.round((completed / total) * 100) : 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        training,
        participants,
        statistics: { totalParticipants: total, completedPostest: completed, avgPretestScore, avgPostestScore, avgImprovement, adherenceRate }
      })
    };

  } catch (err) {
    console.error('❌ Error en get-training-participants:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
