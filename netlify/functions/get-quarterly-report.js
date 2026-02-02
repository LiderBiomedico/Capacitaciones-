// netlify/functions/get-quarterly-report.js
// ═════════════════════════════════════════════════════════════════
// Reporte trimestral consolidado (capacitaciones + participantes)
// - Filtra capacitaciones por trimestre (campo "Fecha"; fallback a "Fecha Creación/Creado En")
// - Agrega estadísticas globales y distribuciones por servicio/cargo/profesión
// - Devuelve rankings y lista de capacitaciones del trimestre
// ═════════════════════════════════════════════════════════════════

function toIsoDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clampNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function normalizeKey(s) {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getQuarterRange(year, quarter) {
  const q = Number(quarter);
  const y = Number(year);
  const startMonth = (q - 1) * 3; // 0,3,6,9
  const start = new Date(Date.UTC(y, startMonth, 1));
  const end = new Date(Date.UTC(y, startMonth + 3, 0)); // last day of 3rd month
  return { start, end };
}

function parseAnyDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function pickField(fields, names = []) {
  for (const n of names) {
    if (fields && Object.prototype.hasOwnProperty.call(fields, n) && fields[n] !== undefined && fields[n] !== null && fields[n] !== '') {
      return fields[n];
    }
  }
  return null;
}

async function fetchAllRecords({ baseUrl, table, headers }) {
  let records = [];
  let offset = null;
  do {
    const url = offset
      ? `${baseUrl}/${encodeURIComponent(table)}?pageSize=100&offset=${encodeURIComponent(offset)}`
      : `${baseUrl}/${encodeURIComponent(table)}?pageSize=100`;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Error Airtable (${table}): ${res.status} ${err?.error?.message || err?.error || 'request failed'}`);
    }
    const data = await res.json();
    records = records.concat(data.records || []);
    offset = data.offset;
  } while (offset);

  return records;
}

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
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Solo POST permitido' }) };
  }

  try {
    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'JSON inválido' }) };
    }

    const year = clampNumber(payload.year, 0);
    const quarter = clampNumber(payload.quarter, 0);
    const scope = (payload.scope || 'all').toString();

    if (!year || year < 2020 || year > 2100 || !quarter || quarter < 1 || quarter > 4) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Parámetros inválidos (year/quarter)' }) };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Variables de entorno no configuradas' }) };
    }

    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
    const authHeaders = {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    };

    const { start, end } = getQuarterRange(year, quarter);
    const startISO = toIsoDate(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())));
    const endISO = toIsoDate(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())));

    const period = {
      year,
      quarter,
      startDate: startISO,
      endDate: endISO,
      label: `T${quarter} ${year}`
    };

    // 1) Capacitaciones
    const trainingsRaw = await fetchAllRecords({ baseUrl, table: 'Capacitaciones', headers: authHeaders });

    const trainings = trainingsRaw
      .map((r) => {
        const f = r.fields || {};
        const titulo = pickField(f, ['Título', 'Titulo', 'Title']) || 'Sin título';
        const dept = pickField(f, ['Departamento', 'Department', 'Servicio', 'Área', 'Area']) || 'General';
        const fecha = pickField(f, ['Fecha', 'Fecha Capacitación', 'Fecha Capacitacion', 'Fecha de Capacitación', 'Fecha de Capacitacion']);
        const creado = pickField(f, ['Fecha Creación', 'Fecha Creacion', 'Creado En', 'Created', 'Created time']);
        const dateObj = parseAnyDate(fecha) || parseAnyDate(creado);

        const activa = f['Activa'] !== false;
        const finalizada = f['Finalizada'] === true;

        return {
          id: r.id,
          title: titulo,
          department: dept,
          dateObj,
          date: dateObj ? toIsoDate(new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()))) : '',
          dateLabel: dateObj ? new Date(dateObj).toLocaleDateString('es-CO') : '',
          activa,
          finalizada
        };
      })
      .filter((t) => {
        if (!t.dateObj) return false;
        const dt = t.dateObj.getTime();
        const inRange = dt >= start.getTime() && dt <= end.getTime();
        if (!inRange) return false;
        if (scope === 'onlyActive') return t.activa && !t.finalizada;
        if (scope === 'onlyFinalized') return t.finalizada;
        return true;
      })
      .sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0));

    const trainingIds = new Set(trainings.map((t) => t.id));

    // 2) Sesiones
    const sessionsRaw = await fetchAllRecords({ baseUrl, table: 'Sesiones', headers: authHeaders });

    // Map trainingId -> sessionIds
    const sessionsByTraining = new Map();
    const sessionIdSet = new Set();

    for (const s of sessionsRaw) {
      const f = s.fields || {};
      const linked =
        pickField(f, ['Capacitaciones', 'Capacitación', 'Capacitacion', 'Training', 'Capacitacion(es)']) ||
        [];

      const linkedArr = Array.isArray(linked) ? linked : [linked];
      const hits = linkedArr.filter((id) => trainingIds.has(id));
      if (hits.length === 0) continue;

      sessionIdSet.add(s.id);

      for (const tid of hits) {
        if (!sessionsByTraining.has(tid)) sessionsByTraining.set(tid, []);
        sessionsByTraining.get(tid).push(s.id);
      }
    }

    // 3) Participaciones
    const participationsRaw = await fetchAllRecords({ baseUrl, table: 'Participaciones', headers: authHeaders });

    const participationRecords = [];
    for (const p of participationsRaw) {
      const f = p.fields || {};
      const sesion = pickField(f, ['Sesión', 'Sesion', 'Session']) || [];
      const sesArr = Array.isArray(sesion) ? sesion : [sesion];
      const belongs = sesArr.some((sid) => sessionIdSet.has(sid));
      if (!belongs) continue;

      const pre = clampNumber(
        pickField(f, ['Pretest Score', 'Puntuación Pretest', 'PretestScore', 'Pretest']) || 0,
        0
      );
      const post = clampNumber(
        pickField(f, ['Post-test Score', 'Posttest Score', 'Puntuación Posttest', 'Puntuación Postest', 'PosttestScore', 'Posttest', 'Postest']) ||
          0,
        0
      );

      const nombre = pickField(f, ['Nombre Completo', 'Nombre', 'Name']) || 'Sin nombre';
      const email = pickField(f, ['Email', 'Correo', 'E-mail']) || '';
      const departamento = pickField(f, ['Departamento', 'Department', 'Servicio', 'Área', 'Area']) || '';
      const cargo = pickField(f, ['Cargo', 'Position', 'Rol', 'Rol/Función', 'Rol/Funcion']) || '';
      const profesion = pickField(f, ['Profesión', 'Profesion', 'Profesional', 'Profesión/Especialidad', 'Profesion/Especialidad']) || '';

      participationRecords.push({
        id: p.id,
        sessionIds: sesArr,
        nombre,
        email,
        departamento,
        cargo,
        profesion,
        pretestScore: Math.round(pre),
        postestScore: Math.round(post)
      });
    }

    // Helper: sessionId -> trainingId (first match)
    const trainingBySession = new Map();
    for (const [tid, sids] of sessionsByTraining.entries()) {
      for (const sid of sids) {
        if (!trainingBySession.has(sid)) trainingBySession.set(sid, tid);
      }
    }

    // Aggregate per training
    const participationByTraining = new Map();
    for (const pr of participationRecords) {
      for (const sid of pr.sessionIds) {
        if (!trainingBySession.has(sid)) continue;
        const tid = trainingBySession.get(sid);
        if (!participationByTraining.has(tid)) participationByTraining.set(tid, []);
        participationByTraining.get(tid).push(pr);
      }
    }

    // Global aggregates
    const totalParticipations = participationRecords.length;
    const completedPretest = participationRecords.filter((x) => x.pretestScore > 0).length;
    const completedPostest = participationRecords.filter((x) => x.postestScore > 0).length;
    const adherenceRate = totalParticipations > 0 ? Math.round((completedPostest / totalParticipations) * 100) : 0;

    const preScores = participationRecords.filter((x) => x.pretestScore > 0).map((x) => x.pretestScore);
    const postScores = participationRecords.filter((x) => x.postestScore > 0).map((x) => x.postestScore);
    const avgPre = preScores.length ? Math.round(preScores.reduce((a, b) => a + b, 0) / preScores.length) : 0;
    const avgPost = postScores.length ? Math.round(postScores.reduce((a, b) => a + b, 0) / postScores.length) : 0;
    const avgImprovement = avgPre > 0 && avgPost > 0 ? Math.round(((avgPost - avgPre) / avgPre) * 100) : 0;

    // Pass rate post-test (>=60% = 3/5)
    const postestCount = postScores.length;
    const passCount = participationRecords.filter((x) => x.postestScore >= 60).length;
    const passRatePostest = postestCount > 0 ? Math.round((passCount / postestCount) * 100) : 0;

    // Unique participants
    const uniqueSet = new Set();
    for (const pr of participationRecords) {
      const key = pr.email ? normalizeKey(pr.email) : `${normalizeKey(pr.nombre)}|${normalizeKey(pr.departamento)}|${normalizeKey(pr.cargo)}`;
      if (key) uniqueSet.add(key);
    }
    const uniqueParticipants = uniqueSet.size;

    // Distributions by dept/cargo/profession
    const deptMap = new Map();
    const cargoMap = new Map();
    const profMap = new Map();

    for (const pr of participationRecords) {
      const dept = pr.departamento?.trim() || 'Sin dato';
      const cargo = pr.cargo?.trim() || 'Sin dato';
      const prof = pr.profesion?.trim() || 'Sin dato';

      // Dept: count + unique
      if (!deptMap.has(dept)) deptMap.set(dept, { name: dept, count: 0, uniqueSet: new Set() });
      const d = deptMap.get(dept);
      d.count += 1;
      const ukey = pr.email ? normalizeKey(pr.email) : normalizeKey(pr.nombre);
      if (ukey) d.uniqueSet.add(ukey);

      cargoMap.set(cargo, (cargoMap.get(cargo) || 0) + 1);
      profMap.set(prof, (profMap.get(prof) || 0) + 1);
    }

    const byDept = Array.from(deptMap.values())
      .map((x) => ({ name: x.name, count: x.count, unique: x.uniqueSet.size }))
      .sort((a, b) => b.count - a.count);

    const byCargo = Array.from(cargoMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const byProfession = Array.from(profMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Trainings by month (within quarter)
    const monthMap = new Map();
    for (const t of trainings) {
      if (!t.dateObj) continue;
      const y = t.dateObj.getUTCFullYear();
      const m = t.dateObj.getUTCMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    }
    const monthLabels = Array.from(monthMap.keys()).sort();
    const trainingsByMonth = monthLabels.map((k) => {
      const [yy, mm] = k.split('-');
      const label = new Date(Number(yy), Number(mm) - 1, 1).toLocaleDateString('es-CO', { month: 'long' });
      return { month: k, label: label.charAt(0).toUpperCase() + label.slice(1), count: monthMap.get(k) || 0 };
    });

    // Enrich trainings with per-training metrics
    const enrichedTrainings = trainings.map((t) => {
      const plist = participationByTraining.get(t.id) || [];
      const total = plist.length;
      const donePost = plist.filter((x) => x.postestScore > 0).length;
      const donePre = plist.filter((x) => x.pretestScore > 0).length;
      const aRate = total > 0 ? Math.round((donePost / total) * 100) : 0;

      const preArr = plist.filter((x) => x.pretestScore > 0).map((x) => x.pretestScore);
      const postArr = plist.filter((x) => x.postestScore > 0).map((x) => x.postestScore);
      const ap = preArr.length ? Math.round(preArr.reduce((a, b) => a + b, 0) / preArr.length) : 0;
      const apo = postArr.length ? Math.round(postArr.reduce((a, b) => a + b, 0) / postArr.length) : 0;
      const imp = ap > 0 && apo > 0 ? Math.round(((apo - ap) / ap) * 100) : 0;

      const postCnt = postArr.length;
      const pass = plist.filter((x) => x.postestScore >= 60).length;
      const passRate = postCnt > 0 ? Math.round((pass / postCnt) * 100) : 0;

      return {
        ...t,
        participations: total,
        completedPretest: donePre,
        completedPostest: donePost,
        adherenceRate: aRate,
        avgPretestScore: ap,
        avgPostestScore: apo,
        avgImprovement: imp,
        passRatePostest: passRate
      };
    });

    const topTrainingsByParticipants = [...enrichedTrainings]
      .sort((a, b) => (b.participations || 0) - (a.participations || 0))
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        title: t.title,
        department: t.department,
        participations: t.participations,
        adherenceRate: t.adherenceRate
      }));

    // Insights
    const insights = [];
    if (enrichedTrainings.length === 0) {
      insights.push('No se encontraron capacitaciones en el trimestre seleccionado.');
    } else {
      insights.push(`Se consolidaron ${enrichedTrainings.length} capacitaciones entre ${startISO} y ${endISO}.`);
      insights.push(`Adherencia global (Post-test): ${adherenceRate}% (${completedPostest}/${totalParticipations} participaciones con Post-test).`);
      insights.push(`Desempeño global: Pre ${avgPre}% | Post ${avgPost}% | Mejora promedio ${avgImprovement >= 0 ? '+' : ''}${avgImprovement}%.`);
      insights.push(`Aprobación Post-test (≥60%): ${passRatePostest}% (${passCount}/${postestCount}).`);

      const top = topTrainingsByParticipants[0];
      if (top) {
        insights.push(`Capacitación con mayor participación: "${top.title}" (${top.participations} participaciones, adherencia ${top.adherenceRate}%).`);
      }

      const mainDept = byDept[0];
      if (mainDept) {
        insights.push(`Servicio/Departamento con mayor participación: ${mainDept.name} (${mainDept.count} participaciones; ${mainDept.unique} participantes únicos).`);
      }

      const mostCargo = byCargo[0];
      if (mostCargo && mostCargo.name !== 'Sin dato') {
        insights.push(`Cargo más frecuente: ${mostCargo.name} (${mostCargo.count}).`);
      }

      const mostProf = byProfession[0];
      if (mostProf && mostProf.name !== 'Sin dato') {
        insights.push(`Profesión más frecuente: ${mostProf.name} (${mostProf.count}).`);
      }

      if (adherenceRate < 70) {
        insights.push('Recomendación: fortalecer seguimiento y recordatorios para completar Post-test (meta sugerida ≥ 80%).');
      }
      if (passRatePostest < 80 && postestCount > 0) {
        insights.push('Recomendación: revisar contenidos y reforzar temas con menor desempeño (Aprobación Post-test objetivo ≥ 80%).');
      }
      if (avgImprovement <= 0 && avgPre > 0 && avgPost > 0) {
        insights.push('Recomendación: ajustar metodología/recursos didácticos: no se observa mejora promedio entre Pre y Post-test.');
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        period,
        kpis: {
          trainingsCount: enrichedTrainings.length,
          sessionsCount: sessionIdSet.size,
          participationsCount: totalParticipations,
          uniqueParticipants,
          completedPretest,
          completedPostest,
          adherenceRate,
          avgPretestScore: avgPre,
          avgPostestScore: avgPost,
          avgImprovement,
          passRatePostest,
          passCountPostest: passCount,
          postestCount
        },
        trainings: enrichedTrainings,
        topTrainingsByParticipants,
        distributions: {
          byDept,
          byCargo,
          byProfession,
          trainingsByMonth
        },
        insights
      })
    };
  } catch (error) {
    console.error('❌ Error en get-quarterly-report:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      })
    };
  }
}
