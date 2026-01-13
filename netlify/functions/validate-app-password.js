// netlify/functions/validate-app-password.js
// Valida la contraseña ADMIN contra Airtable (tabla AppConfig) para bloquear el acceso al modo administrador.
// - NO expone el API KEY al navegador (usa variables de entorno en Netlify)
// - Responde { success: true } si la contraseña coincide
//
// Airtable (recomendado):
// Tabla: AppConfig
// Campos:
//   - Key   (Single line text)  -> Ej: APP_PASSWORD
//   - Value (Single line text)  -> Ej: TuContraseñaSegura

const fetch = require('node-fetch');
const crypto = require('crypto');

function withCors(headers = {}) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: withCors({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body)
  };
}

// Comparación en tiempo constante (evita leaks por timing)
function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a), 'utf8');
  const bBuf = Buffer.from(String(b), 'utf8');
  const maxLen = Math.max(aBuf.length, bBuf.length);
  const aPadded = Buffer.concat([aBuf, Buffer.alloc(maxLen - aBuf.length)]);
  const bPadded = Buffer.concat([bBuf, Buffer.alloc(maxLen - bBuf.length)]);
  return crypto.timingSafeEqual(aPadded, bPadded) && aBuf.length === bBuf.length;
}

async function getPasswordFromAirtable({ apiKey, baseId, tableName, keyField, valueField, keyName }) {
  const filter = `({${keyField}}='${keyName}')`;
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?maxRecords=1&filterByFormula=${encodeURIComponent(filter)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || 'Error leyendo configuración de Airtable';
    throw new Error(msg);
  }

  const record = data?.records?.[0];
  const value = record?.fields?.[valueField];
  return value ? String(value) : null;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: withCors() };
    }

    if (event.httpMethod !== 'POST') {
      return json(405, { success: false, error: 'Method not allowed' });
    }

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { success: false, error: 'JSON inválido' });
    }

    const password = (body.password || '').toString();
    if (!password) {
      return json(400, { success: false, error: 'Contraseña requerida' });
    }

    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    // Configurable por variables de entorno si quieres
    const tableName = process.env.APP_CONFIG_TABLE || 'AppConfig';
    const keyField = process.env.APP_CONFIG_KEY_FIELD || 'Key';
    const valueField = process.env.APP_CONFIG_VALUE_FIELD || 'Value';
    const keyName = process.env.APP_PASSWORD_KEY || 'APP_PASSWORD';

    let storedPassword = null;

    // 1) Intentar Airtable (preferido)
    if (apiKey && baseId) {
      try {
        storedPassword = await getPasswordFromAirtable({
          apiKey,
          baseId,
          tableName,
          keyField,
          valueField,
          keyName
        });
      } catch (e) {
        // si Airtable falla, podemos caer a una variable env como respaldo
        // (útil para emergencias o mientras creas la tabla)
        storedPassword = null;
      }
    }

    // 2) Fallback opcional: variable de entorno
    if (!storedPassword && process.env.APP_PASSWORD) {
      storedPassword = String(process.env.APP_PASSWORD);
    }

    if (!storedPassword) {
      return json(500, {
        success: false,
        error: 'No se encontró la contraseña en Airtable (AppConfig) ni en APP_PASSWORD (env).'
      });
    }

    if (safeEqual(password, storedPassword)) {
      return json(200, { success: true });
    }

    // Pequeña demora para dificultar brute force
    await new Promise((r) => setTimeout(r, 350));

    return json(401, { success: false, error: 'Contraseña incorrecta' });

  } catch (error) {
    return json(500, { success: false, error: error.message || 'Error interno' });
  }
};
