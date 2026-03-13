/**
 * upload-attendance-pdf.js
 * Netlify Function — Sube un PDF de lista de asistencia al campo
 * "Lista de Asistencia" (attachment) de la tabla Sesiones en Airtable.
 *
 * Flujo:
 *  1. Recibe trainingId + fileBase64 + fileName + trainingCode desde el frontend
 *  2. Busca la sesión más reciente vinculada a esa capacitación
 *  3. Si no encuentra sesión, usa trainingCode para hacer match por "Código Acceso"
 *  4. Sube el PDF como attachment al campo "Lista de Asistencia" de esa sesión
 */

const AIRTABLE_API = 'https://api.airtable.com/v0';

// ── Helpers ────────────────────────────────────────────────────────────────────

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

async function airtableFetch(url, options) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Error Airtable ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Obtiene TODAS las páginas de una tabla Airtable.
 */
async function fetchAllRecords(baseId, table, token, filterFormula = null) {
  let records = [];
  let offset = null;

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (filterFormula) params.set('filterByFormula', filterFormula);
    if (offset) params.set('offset', offset);

    const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}?${params}`;
    const data = await airtableFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    records = records.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);

  return records;
}

// ── Handler principal ──────────────────────────────────────────────────────────

exports.handler = async (event) => {
  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ success: false, error: 'Método no permitido' }),
    };
  }

  // Variables de entorno (configuradas en Netlify Dashboard)
  const token  = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!token || !baseId) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: false,
        error: 'Variables de entorno AIRTABLE_API_KEY y AIRTABLE_BASE_ID no configuradas en Netlify.',
      }),
    };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ success: false, error: 'Body JSON inválido' }),
    };
  }

  const { trainingId, trainingCode, fileName, fileBase64, mimeType } = body;

  if (!fileBase64) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ success: false, error: 'No se recibió el archivo base64.' }),
    };
  }
  if (!trainingId && !trainingCode) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ success: false, error: 'Se requiere trainingId o trainingCode.' }),
    };
  }

  // ── Paso 1: Buscar sesión vinculada a la capacitación ─────────────────────────
  let sessionRecord = null;
  let sessionFieldsList = [];

  try {
    const allSessions = await fetchAllRecords(baseId, 'Sesiones', token);
    sessionFieldsList = allSessions.length > 0 ? Object.keys(allSessions[0].fields || {}) : [];

    // Buscar por vínculo a capacitación (campo linked record)
    if (trainingId) {
      const linked = allSessions.filter((s) => {
        const cap =
          s.fields?.['Capacitaciones'] ||
          s.fields?.['Capacitación']    ||
          s.fields?.['Capacitacion']    || [];
        return Array.isArray(cap) ? cap.includes(trainingId) : cap === trainingId;
      });

      if (linked.length > 0) {
        // Tomar la sesión más reciente (mayor Fecha Inicio)
        linked.sort((a, b) => {
          const fa = a.fields?.['Fecha Inicio'] || '';
          const fb = b.fields?.['Fecha Inicio'] || '';
          return fb.localeCompare(fa);
        });
        sessionRecord = linked[0];
      }
    }

    // Fallback: buscar por Código Acceso
    if (!sessionRecord && trainingCode) {
      const code = trainingCode.toString().toUpperCase().trim();
      sessionRecord = allSessions.find((s) => {
        const cod = (
          s.fields?.['Código Acceso'] ||
          s.fields?.['Código de Acceso'] || ''
        ).toString().toUpperCase().trim();
        return cod === code;
      }) || null;
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ success: false, error: `Error consultando Sesiones: ${err.message}` }),
    };
  }

  if (!sessionRecord) {
    return {
      statusCode: 404,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: false,
        error: `No se encontró ninguna sesión vinculada a la capacitación "${trainingCode || trainingId}". Verifica que la sesión exista en Airtable.`,
        sessionFields: sessionFieldsList,
      }),
    };
  }

  // ── Paso 2: Subir el PDF como attachment ──────────────────────────────────────
  // Airtable no acepta base64 directamente en el campo attachment via REST API.
  // Se debe proporcionar una URL pública. Para subir binario usamos el endpoint
  // de uploads de la Content API (beta) de Airtable, que sí acepta base64/binario.
  //
  // Endpoint: PATCH /v0/{baseId}/{table}/{recordId}
  // con el campo attachment usando { url } (URL pública) O
  // usando el Content API: POST /v0/{baseId}/{table}/{recordId}/uploadAttachment
  //
  // Usamos el endpoint de uploadAttachment (Content API) que acepta binario directamente.

  const sessionId = sessionRecord.id;
  const safeFileName = (fileName || 'lista_asistencia.pdf').replace(/[^a-zA-Z0-9._\-]/g, '_');

  // Convertir base64 a Buffer
  let fileBuffer;
  try {
    fileBuffer = Buffer.from(fileBase64, 'base64');
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ success: false, error: 'El base64 del archivo es inválido.' }),
    };
  }

  // Límite de 5 MB en Airtable para un attachment individual
  const MAX_BYTES = 5 * 1024 * 1024;
  if (fileBuffer.length > MAX_BYTES) {
    return {
      statusCode: 413,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: false,
        error: `El archivo pesa ${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB. El límite es 5 MB. Por favor comprímelo e intenta de nuevo.`,
      }),
    };
  }

  try {
    // Airtable Content API: subir attachment directamente con binario
    const uploadUrl = `${AIRTABLE_API}/${baseId}/Sesiones/${sessionId}/uploadAttachment`;

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'x-airtable-application-id': baseId,
        // Metadatos del archivo en headers
        'x-file-name': safeFileName,
        'x-mime-type': mimeType || 'application/pdf',
        // Campo destino
        'x-field-name': 'Lista de Asistencia',
      },
      body: fileBuffer,
    });

    const uploadData = await uploadRes.json().catch(() => ({}));

    if (!uploadRes.ok) {
      // Si Content API no está disponible, fallback al método PATCH con data-URI
      if (uploadRes.status === 404 || uploadRes.status === 405) {
        return await patchWithDataUri({
          token, baseId, sessionId, safeFileName, mimeType, fileBase64,
        });
      }

      throw new Error(uploadData?.error?.message || uploadData?.error || `Error subiendo PDF (${uploadRes.status})`);
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        sessionId,
        sessionName: sessionRecord.fields?.['Capacitaciones']?.[0] || sessionId,
        fileName: safeFileName,
        message: 'PDF subido correctamente a la sesión.',
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};

// ── Fallback: PATCH con data-URI (método alternativo) ─────────────────────────
// Airtable acepta attachments como array de { url } donde url puede ser una data URI.
async function patchWithDataUri({ token, baseId, sessionId, safeFileName, mimeType, fileBase64 }) {
  const dataUri = `data:${mimeType || 'application/pdf'};base64,${fileBase64}`;

  const patchUrl = `${AIRTABLE_API}/${baseId}/Sesiones/${sessionId}`;
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        'Lista de Asistencia': [
          {
            url: dataUri,
            filename: safeFileName,
          },
        ],
      },
    }),
  });

  const patchData = await patchRes.json().catch(() => ({}));

  if (!patchRes.ok) {
    const msg = patchData?.error?.message || patchData?.error || `Error PATCH (${patchRes.status})`;
    // Devolver también campos disponibles para diagnóstico
    const fields = patchData?.error?.type ? [] : Object.keys(patchData?.fields || {});
    throw new Error(msg + (fields.length ? `\nCampos en sesión: ${fields.join(', ')}` : ''));
  }

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      sessionId,
      fileName: safeFileName,
      method: 'patch-data-uri',
      message: 'PDF subido correctamente (método alternativo).',
    }),
  };
}
