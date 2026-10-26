/**
 * CAMPUS SUSANA LÓPEZ · HSLV
 * Consolidación de checkpoints — tabla "Respuestas Cursos Virtuales"
 * Ejecutar en Airtable: Extensiones → Scripting → pegar este código → Run
 *
 * Qué hace
 *  1. Agrupa los registros por cédula + curso y los recorre en orden cronológico.
 *  2. Separa los intentos: un intento termina en su registro de cierre
 *     (Aprobado / Reprobado - Repetir capacitación / Finalizado) o cuando
 *     el mismo checkpoint vuelve a aparecer (el participante reinició el curso).
 *  3. Los checkpoints de cada intento se guardan como JSON en el campo
 *     "Detalle Checkpoints" del registro de cierre.
 *  4. Los intentos abandonados (sin cierre) se convierten en UN registro
 *     "Intento incompleto" con su detalle en JSON.
 *  5. Elimina los registros individuales tipo "Checkpoint" ya consolidados.
 *
 * Seguridad
 *  - Primero muestra una simulación; solo escribe si se pulsa "Ejecutar".
 *  - Nunca crea registros: funciona aunque la base esté sobre el límite.
 *  - Solo borra checkpoints cuyo registro destino se actualizó bien.
 *  - No toca intentos en curso (sin cierre y con actividad en los
 *    últimos DIAS_PROTEGIDOS días).
 *  - Se puede ejecutar varias veces: integra checkpoints nuevos sin duplicar.
 *  - Compatible con la versión nueva de la app (registros "En curso" con
 *    Detalle Checkpoints): esos registros no se modifican.
 */

const TABLA_ID = 'tblKXvyqPQuZieEq7';
const DIAS_PROTEGIDOS = 3;
const LOTE = 50;
const MAX_JSON = 95000; // límite de texto largo en Airtable: 100.000 caracteres

const F = {
  participante: 'fldTUDX0wFeeHdN5P',
  cedula: 'fldZgqA7Gq9DGASeu',
  curso: 'fld3p0N96ogXCt7cF',
  cursoId: 'fld3KNF9dWq4p4HDw',
  modulo: 'fldppgubC544uUQpu',
  indiceModulo: 'fldnfiCT9dBgR0Zn3',
  checkpointId: 'fldBmySc7DmZU0UIP',
  tiempo: 'fldDBMLmOVIpI2kpM',
  pregunta: 'fldw5PgcDX1TJZ583',
  respuestaUsuario: 'fld7TJ7CGCyefBDy9',
  respuestaCorrecta: 'flduRb17NWFff3Btk',
  resultado: 'fldtuVMuWh92lEl0w',
  fecha: 'fldpTAk88PVtHHB9Z',
  calificacion: 'fldtXV7ujOPTufmNs',
  tipo: 'fldML6f7TJZlWyycP',
  total: 'fldJHY3PhCKamC7L3',
  correctas: 'fld5v7hxtXFbiBVO7',
  porcentaje: 'fldlP98bSfuIiINxJ',
  detalle: 'fldodRP8BecS3XfVO',
};

const TIPO_CHECKPOINT = 'Checkpoint';
const TIPO_INCOMPLETO = 'Intento incompleto';
const TIPO_EN_CURSO = 'en curso'; // comparación en minúsculas

// ───────────────────────── utilidades ─────────────────────────
const txt = (r, f) => (r.getCellValueAsString(f) || '').trim();
const num = (r, f) => {
  const v = r.getCellValue(f);
  return typeof v === 'number' ? v : null;
};
const ms = (r) => {
  const v = r.getCellValue(F.fecha);
  const t = v ? Date.parse(v) : NaN;
  return isNaN(t) ? null : t;
};

function aItem(r) {
  return {
    checkpointId: txt(r, F.checkpointId),
    modulo: txt(r, F.modulo),
    indiceModulo: num(r, F.indiceModulo),
    tiempo: txt(r, F.tiempo),
    pregunta: txt(r, F.pregunta),
    respuestaUsuario: txt(r, F.respuestaUsuario),
    respuestaCorrecta: txt(r, F.respuestaCorrecta),
    resultado: txt(r, F.resultado),
    calificacion: num(r, F.calificacion),
    fecha: r.getCellValue(F.fecha) || null,
  };
}

// Devuelve [] si está vacío, el arreglo si es JSON válido, o null si está dañado.
function leerDetalle(r) {
  const raw = txt(r, F.detalle);
  if (!raw) return [];
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a : null;
  } catch (e) {
    return null;
  }
}

function fusionar(previos, nuevos) {
  const vistos = new Set();
  const out = [];
  for (const it of [...previos, ...nuevos]) {
    const k = `${it.checkpointId || ''}|${it.fecha || ''}|${it.respuestaUsuario || ''}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(it);
  }
  out.sort((a, b) => (Date.parse(a.fecha) || 0) - (Date.parse(b.fecha) || 0));
  return out;
}

const esCorrecta = (it) => (it.resultado || '').toLowerCase() === 'correcta';

// ───────────────────────── lectura ─────────────────────────
const tabla = base.getTable(TABLA_ID);
output.markdown('## Consolidación de checkpoints · Respuestas Cursos Virtuales');
output.text('Leyendo registros…');

const query = await tabla.selectRecordsAsync({ fields: Object.values(F) });
const registros = query.records;

const grupos = new Map();
registros.forEach((r, i) => {
  const k = `${txt(r, F.cedula)}||${txt(r, F.cursoId) || txt(r, F.curso)}`;
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push({ r, i, t: ms(r), tipo: txt(r, F.tipo) });
});

// ───────────────────────── planificación ─────────────────────────
const limiteProteccion = Date.now() - DIAS_PROTEGIDOS * 86400000;
const planes = []; // { clase: 'cierre'|'incompleto', destino, fields, borrar: [ids], n }
const omitidos = []; // { grupo, motivo, registros }
let protegidos = 0;

function planIncompleto(buffer) {
  const items = buffer.map((b) => aItem(b.r));
  const correctas = items.filter(esCorrecta).length;
  const total = Math.max(0, ...buffer.map((b) => num(b.r, F.total) || 0)) || items.length;
  const pct = total ? Math.round((correctas / total) * 100) : 0;
  const json = JSON.stringify(items);
  const [destino, ...resto] = buffer;
  return {
    clase: 'incompleto',
    destino: destino.r,
    n: items.length,
    json,
    borrar: resto.map((b) => b.r.id),
    fields: {
      [F.detalle]: json,
      [F.tipo]: TIPO_INCOMPLETO,
      [F.modulo]: 'Resumen intento incompleto',
      [F.resultado]: `${correctas}/${total}`,
      [F.correctas]: correctas,
      [F.porcentaje]: pct,
      [F.calificacion]: pct,
      [F.fecha]: buffer[buffer.length - 1].r.getCellValue(F.fecha),
      [F.checkpointId]: null,
      [F.tiempo]: null,
      [F.pregunta]: null,
      [F.respuestaUsuario]: null,
      [F.respuestaCorrecta]: null,
      [F.indiceModulo]: null,
    },
  };
}

for (const [k, lista] of grupos) {
  if (lista.some((x) => x.t === null)) {
    omitidos.push({ grupo: k, motivo: 'registros sin Fecha Respuesta', registros: lista.length });
    continue;
  }
  lista.sort((a, b) => a.t - b.t || a.i - b.i);

  const candidatos = [];
  let buffer = [];
  let idsEnBuffer = new Set();
  let grupoValido = true;

  for (const x of lista) {
    if (x.tipo === TIPO_CHECKPOINT) {
      const cp = txt(x.r, F.checkpointId);
      if (cp && idsEnBuffer.has(cp)) {
        // El checkpoint se repite: el intento anterior quedó abandonado.
        candidatos.push(planIncompleto(buffer));
        buffer = [];
        idsEnBuffer = new Set();
      }
      buffer.push(x);
      if (cp) idsEnBuffer.add(cp);
      continue;
    }

    // Registro "En curso" (formato nuevo de la app: un registro por intento).
    // Es un intento distinto: los checkpoints sueltos anteriores quedan como incompletos.
    if (x.tipo.toLowerCase() === TIPO_EN_CURSO) {
      if (buffer.length) candidatos.push(planIncompleto(buffer));
      buffer = [];
      idsEnBuffer = new Set();
      continue;
    }

    // Registro de cierre (o "Intento incompleto" de una ejecución anterior)
    if (buffer.length) {
      const previos = leerDetalle(x.r);
      if (previos === null) {
        omitidos.push({ grupo: k, motivo: 'JSON dañado en el registro de cierre', registros: lista.length });
        grupoValido = false;
        break;
      }
      const items = fusionar(previos, buffer.map((b) => aItem(b.r)));
      const json = JSON.stringify(items);
      candidatos.push({
        clase: 'cierre',
        destino: x.r,
        n: buffer.length,
        json,
        borrar: buffer.map((b) => b.r.id),
        fields: { [F.detalle]: json },
      });
    }
    buffer = [];
    idsEnBuffer = new Set();
  }

  if (!grupoValido) continue;

  // Checkpoints al final sin cierre
  if (buffer.length) {
    const ultimo = buffer[buffer.length - 1].t;
    if (ultimo >= limiteProteccion) {
      protegidos += buffer.length; // intento en curso: no se toca
    } else {
      candidatos.push(planIncompleto(buffer));
    }
  }

  const excedido = candidatos.find((c) => c.json.length > MAX_JSON);
  if (excedido) {
    omitidos.push({ grupo: k, motivo: `JSON de ${excedido.json.length} caracteres (supera ${MAX_JSON})`, registros: lista.length });
    continue;
  }
  planes.push(...candidatos);
}

// ───────────────────────── resumen (simulación) ─────────────────────────
const totalCheckpoints = registros.filter((r) => txt(r, F.tipo) === TIPO_CHECKPOINT).length;
const cierres = planes.filter((p) => p.clase === 'cierre');
const incompletos = planes.filter((p) => p.clase === 'incompleto');
const aBorrar = planes.reduce((s, p) => s + p.borrar.length, 0);

output.markdown('### Simulación (todavía no se ha modificado nada)');
output.table([
  { Concepto: 'Registros en la tabla', Valor: registros.length },
  { Concepto: 'Registros tipo Checkpoint', Valor: totalCheckpoints },
  { Concepto: 'Grupos cédula + curso', Valor: grupos.size },
  { Concepto: 'Intentos con cierre a consolidar', Valor: cierres.length },
  { Concepto: 'Intentos abandonados → "Intento incompleto"', Valor: incompletos.length },
  { Concepto: `Checkpoints protegidos (intentos de los últimos ${DIAS_PROTEGIDOS} días)`, Valor: protegidos },
  { Concepto: 'Grupos omitidos por seguridad', Valor: omitidos.length },
  { Concepto: 'REGISTROS QUE SE LIBERAN', Valor: aBorrar },
  { Concepto: 'Registros en la tabla al terminar', Valor: registros.length - aBorrar },
]);

if (omitidos.length) {
  output.markdown('**Grupos omitidos (no se tocan):**');
  output.table(omitidos.slice(0, 50));
}

const ejemplo = cierres[0] || incompletos[0];
if (ejemplo) {
  output.markdown(
    `**Ejemplo:** ${txt(ejemplo.destino, F.participante)} · ${txt(ejemplo.destino, F.curso)} · ` +
      `${ejemplo.clase === 'cierre' ? txt(ejemplo.destino, F.tipo) : TIPO_INCOMPLETO} · ${ejemplo.n} checkpoints`
  );
  output.text(JSON.stringify(JSON.parse(ejemplo.json).slice(0, 2), null, 2));
}

if (!planes.length) {
  output.markdown('✅ No hay checkpoints pendientes por consolidar.');
} else {
  const opcion = await input.buttonsAsync(
    `Se actualizarán ${planes.length} registros y se eliminarán ${aBorrar}. ¿Ejecutar?`,
    [
      { label: 'Ejecutar consolidación', value: 'si', variant: 'danger' },
      { label: 'Cancelar', value: 'no', variant: 'secondary' },
    ]
  );

  if (opcion !== 'si') {
    output.markdown('Cancelado. No se modificó ningún registro.');
  } else {
    // ───────────────────────── ejecución ─────────────────────────
    let actualizados = 0;
    let borrados = 0;
    const errores = [];

    for (let i = 0; i < planes.length; i += LOTE) {
      const lote = planes.slice(i, i + LOTE);
      try {
        await tabla.updateRecordsAsync(lote.map((p) => ({ id: p.destino.id, fields: p.fields })));
        actualizados += lote.length;
      } catch (e) {
        errores.push(`Lote ${i / LOTE + 1}: actualización falló (${e.message}). Sus checkpoints NO se borraron.`);
        continue;
      }
      const ids = lote.flatMap((p) => p.borrar);
      for (let j = 0; j < ids.length; j += LOTE) {
        const parte = ids.slice(j, j + LOTE);
        try {
          await tabla.deleteRecordsAsync(parte);
          borrados += parte.length;
        } catch (e) {
          errores.push(`Lote ${i / LOTE + 1}: borrado parcial falló (${e.message}). Vuelve a ejecutar el script.`);
        }
      }
      if ((i / LOTE) % 5 === 4) {
        output.text(`Progreso: ${actualizados}/${planes.length} intentos · ${borrados} registros eliminados`);
      }
    }

    output.markdown('### Resultado');
    output.table([
      { Concepto: 'Registros actualizados (cierres + incompletos)', Valor: actualizados },
      { Concepto: 'Registros eliminados', Valor: borrados },
      { Concepto: 'Errores', Valor: errores.length },
    ]);
    if (errores.length) output.text(errores.join('\n'));
    else output.markdown('✅ Consolidación terminada sin errores.');
  }
}
