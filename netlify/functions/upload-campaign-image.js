// netlify/functions/upload-campaign-image.js
// ============================================================================
// Sube la imagen de una campaña a ImgBB (https://imgbb.com) y devuelve una URL
// pública y PERMANENTE para usarla en el <img src> del correo. Se usa imagen
// enlazada (no adjunto) porque es la única forma confiable de que se vea en
// webmail (Gmail/Outlook/Apple Mail) y permite el envío rápido por lotes.
//
// Requiere la variable de entorno IMGBB_API_KEY (clave gratuita de imgbb.com).
//
// Entrada (POST JSON): { base64 }
// Salida: { success, url }  |  { success:false, error, detail }
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

  const apiKey = (process.env.IMGBB_API_KEY || process.env.IMGBB_KEY || '').trim();
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Falta IMGBB_API_KEY en el servidor. Crea una clave gratuita en imgbb.com y agrégala en Netlify.' }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Solicitud inválida.' }) };
  }

  const clean = String(body.base64 || '').replace(/^data:[^,]+,/, '').trim();
  if (!clean) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'No se recibió la imagen.' }) };
  }

  try {
    const form = new URLSearchParams();
    form.set('key', apiKey);
    form.set('image', clean);

    const res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data && data.success && data.data) {
      // url directa de la imagen (permanente)
      const url = data.data.url || (data.data.image && data.data.image.url) || data.data.display_url || '';
      if (url) return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, url }) };
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ success: false, error: 'ImgBB no devolvió una URL.', detail: JSON.stringify(data).slice(0, 300) }) };
    }

    const detail = (data && data.error && data.error.message) ? data.error.message : `HTTP ${res.status}`;
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ success: false, error: 'ImgBB rechazó la imagen.', detail }) };
  } catch (e) {
    console.error('Error subiendo imagen a ImgBB:', e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'No se pudo subir la imagen.', detail: String((e && e.message) || e) }) };
  }
};
