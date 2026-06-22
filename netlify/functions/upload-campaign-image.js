// netlify/functions/upload-campaign-image.js
// ============================================================================
// Guarda la imagen de una campaña en Netlify Blobs y devuelve una URL pública
// y estable (servida por la función campaign-image) para usarla en el <img>
// del correo. Esto evita incrustar la imagen como adjunto (que NO funciona en
// el endpoint batch de Resend) y mejora la visualización en webmail.
//
// Entrada (POST JSON): { base64, contentType }
// Salida: { success, url, id }
// ============================================================================

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

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

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Solicitud inválida.' }) };
  }

  const contentType = String(body.contentType || 'image/jpeg').trim() || 'image/jpeg';
  const clean = String(body.base64 || '').replace(/^data:[^,]+,/, '').trim();
  if (!clean) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'No se recibió la imagen.' }) };
  }

  try {
    const id = crypto.randomBytes(16).toString('hex');
    const store = getStore('campaign-images');
    await store.set(id, Buffer.from(clean, 'base64'), { metadata: { contentType } });

    // URL pública y estable, servida desde el propio dominio del sitio.
    const proto = (event.headers['x-forwarded-proto'] || 'https');
    const host = event.headers.host || '';
    const base = (process.env.URL && /^https?:\/\//i.test(process.env.URL)) ? process.env.URL : `${proto}://${host}`;
    const url = `${base}/.netlify/functions/campaign-image?id=${id}`;

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, url, id }) };
  } catch (e) {
    console.error('Error guardando imagen de campaña:', e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'No se pudo almacenar la imagen.' }) };
  }
};
