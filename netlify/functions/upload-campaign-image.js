// netlify/functions/upload-campaign-image.js
// ============================================================================
// Guarda la imagen de una campaña en Netlify Blobs y devuelve una URL pública
// del mismo dominio: /.netlify/functions/campaign-image?id=XXXX
//
// CAMBIO IMPORTANTE:
// Ya NO requiere IMGBB_API_KEY. Esto corrige el error 500: "Falta IMGBB_API_KEY".
//
// Entrada (POST JSON): { base64, contentType?, name? }
// Salida: { success, url, id }  |  { success:false, error, detail }
// ============================================================================

const crypto = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

function getOrigin(event) {
  const h = event.headers || {};
  const host = h.host || h.Host || '';
  const proto = h['x-forwarded-proto'] || h['X-Forwarded-Proto'] || 'https';
  if (host) return `${proto}://${host}`;
  if (event.rawUrl) {
    try { return new URL(event.rawUrl).origin; } catch (e) {}
  }
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
  return String(siteUrl || '').replace(/\/$/, '');
}

async function getBlobStore() {
  const { getStore } = require('@netlify/blobs');
  try {
    return getStore('campaign-images');
  } catch (e) {
    // Fallback útil para algunos entornos de Netlify CLI o despliegues antiguos.
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || '';
    const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN || '';
    if (!siteID || !token) throw e;
    return getStore({ name: 'campaign-images', siteID, token });
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, error: 'Método no permitido.' });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return json(400, { success: false, error: 'Solicitud inválida.' });
  }

  const contentType = String(body.contentType || body.type || 'image/jpeg').trim() || 'image/jpeg';
  const clean = String(body.base64 || '').replace(/^data:[^,]+,/, '').trim();
  if (!clean) return json(400, { success: false, error: 'No se recibió la imagen.' });

  let buffer;
  try { buffer = Buffer.from(clean, 'base64'); } catch (e) {
    return json(400, { success: false, error: 'La imagen no está en formato base64 válido.' });
  }
  if (!buffer.length) return json(400, { success: false, error: 'La imagen está vacía.' });
  // Evita superar el límite práctico de funciones/serverless y correos.
  if (buffer.length > 4.5 * 1024 * 1024) {
    return json(413, { success: false, error: 'La imagen es muy pesada. Usa una imagen menor a 4.5 MB.' });
  }

  try {
    const store = await getBlobStore();
    const id = crypto.createHash('sha256')
      .update(buffer)
      .update(String(Date.now()))
      .digest('hex')
      .slice(0, 32);

    await store.set(id, buffer, {
      metadata: {
        contentType,
        originalName: String(body.name || 'campana.jpg').slice(0, 120),
        createdAt: new Date().toISOString()
      }
    });

    const origin = getOrigin(event);
    if (!origin) return json(500, { success: false, error: 'No se pudo construir la URL pública de la imagen.' });

    return json(200, {
      success: true,
      id,
      url: `${origin}/.netlify/functions/campaign-image?id=${encodeURIComponent(id)}`
    });
  } catch (e) {
    console.error('Error guardando imagen de campaña en Netlify Blobs:', e);
    return json(500, {
      success: false,
      error: 'No se pudo guardar la imagen en Netlify Blobs.',
      detail: String((e && e.message) || e)
    });
  }
};
