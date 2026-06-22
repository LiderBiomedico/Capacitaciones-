// netlify/functions/upload-campaign-image.js
// ============================================================================
// Guarda la imagen de una campaña en Netlify Blobs y devuelve una URL pública
// y estable (servida por la función campaign-image) para usarla en el <img>
// del correo. Esto evita incrustar la imagen como adjunto (que NO funciona en
// el endpoint batch de Resend) y mejora la visualización en webmail.
//
// Entrada (POST JSON): { base64, contentType }
// Salida: { success, url, id }  |  { success:false, error, detail }
// ============================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Método no permitido.' }) };
  }

  // Carga defensiva del módulo (si el deploy no reinstaló dependencias, se reporta claramente)
  let getStore;
  try {
    ({ getStore } = require('@netlify/blobs'));
  } catch (e) {
    return {
      statusCode: 500, headers: CORS,
      body: JSON.stringify({ success: false, error: 'No se pudo cargar el almacenamiento (@netlify/blobs). El deploy debe reinstalar dependencias (npm install).', detail: String((e && e.message) || e) })
    };
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Solicitud inválida.' }) };
  }

  const contentType = String(body.contentType || 'image/jpeg').trim() || 'image/jpeg';
  const clean = String(body.base64 || '').replace(/^data:[^,]+,/, '').trim();
  if (!clean) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'No se recibió la imagen.' }) };
  }

  // Crear el "store". Si el contexto de Blobs no está inyectado (deploy manual),
  // intentar configuración explícita con SITE_ID + token de Netlify.
  let store;
  try {
    store = getStore('campaign-images');
  } catch (e) {
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || '';
    const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN || '';
    if (siteID && token) {
      try { store = getStore({ name: 'campaign-images', siteID, token }); }
      catch (e2) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'El almacenamiento de imágenes (Netlify Blobs) no está disponible.', detail: String((e2 && e2.message) || e2) }) };
      }
    } else {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'El almacenamiento de imágenes (Netlify Blobs) no está disponible en este entorno.', detail: String((e && e.message) || e) }) };
    }
  }

  try {
    const crypto = require('crypto');
    const id = crypto.randomBytes(16).toString('hex');
    await store.set(id, Buffer.from(clean, 'base64'), { metadata: { contentType } });

    const proto = (event.headers['x-forwarded-proto'] || 'https');
    const host = event.headers.host || '';
    const base = (process.env.URL && /^https?:\/\//i.test(process.env.URL)) ? process.env.URL : `${proto}://${host}`;
    const url = `${base}/.netlify/functions/campaign-image?id=${id}`;

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, url, id }) };
  } catch (e) {
    console.error('Error guardando imagen de campaña:', e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'No se pudo almacenar la imagen.', detail: String((e && e.message) || e) }) };
  }
};
