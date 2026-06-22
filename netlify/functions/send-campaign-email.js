// netlify/functions/send-campaign-email.js
// ============================================================================
// Envía una publicidad / comunicación (campaña o capacitación) al personal.
//
// Imagen: se incrusta DIRECTAMENTE en cada correo como adjunto inline (CID).
//   - El endpoint individual de Resend (/emails) SÍ admite adjuntos.
//   - El endpoint de lotes (/emails/batch) NO admite adjuntos; por eso, cuando
//     hay imagen, se envía de forma individual. Sin imagen, se usa el lote (rápido).
//   - No depende de ningún almacenamiento externo (ni Netlify Blobs ni hosting).
// Video: si hay enlace, se incluye un botón "Ver el video".
// Resend: clave en RESEND_API_KEY, remitente en EMAIL_FROM.
//
// Entrada (POST JSON):
//   { subject, title, message, videoUrl,
//     imageBase64, imageType, imageName,     // imagen opcional
//     recipients: [ { email, nombre } ] }
// Salida: { success, sent, failed, total, errors:[{email,error}] }
// ============================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function getEnv(names) {
  for (const n of names) {
    if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim();
  }
  return '';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// imageSrc: "cid:campaignimg" cuando la imagen se incrusta.
function buildHtml({ nombre, title, message, videoUrl, imageSrc }) {
  const saludo = nombre ? `Hola ${esc(nombre)},` : 'Hola,';
  const titleHtml = title
    ? `<h2 style="margin:0 0 12px;color:#6d28d9;font-size:21px;line-height:1.3;">${esc(title)}</h2>` : '';
  const msgHtml = message
    ? `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">${esc(message).replace(/\n/g, '<br>')}</p>` : '';
  const imgHtml = imageSrc
    ? `<div style="margin:6px 0 18px;"><img src="${imageSrc}" alt="${esc(title || 'Campaña')}" width="504" style="display:block;width:100%;max-width:504px;height:auto;border-radius:12px;border:1px solid #ede9fe;"></div>` : '';
  const videoHtml = videoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 8px;"><tr><td style="border-radius:10px;background:#7c3aed;">
         <a href="${esc(videoUrl)}" style="display:inline-block;padding:13px 26px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">&#9654;&nbsp; Ver el video</a>
       </td></tr></table>
       <p style="margin:0 0 6px;color:#64748b;font-size:13px;">O copia este enlace en tu navegador:</p>
       <p style="margin:0 0 6px;font-size:13px;word-break:break-all;"><a href="${esc(videoUrl)}" style="color:#7c3aed;">${esc(videoUrl)}</a></p>` : '';

  return `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(2,8,23,.08);">
        <tr><td style="background:linear-gradient(135deg,#6d28d9,#7c3aed);padding:22px 28px;">
          <span style="color:#fff;font-size:18px;font-weight:800;">Campus Susana López</span><br>
          <span style="color:#ede9fe;font-size:12px;">Hospital Susana López de Valencia E.S.E.</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 14px;color:#0f172a;font-size:16px;">${saludo}</p>
          ${titleHtml}
          ${msgHtml}
          ${imgHtml}
          ${videoHtml}
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #eef2f7;">
          <span style="color:#94a3b8;font-size:11px;">Mensaje institucional de capacitación y comunicaciones. Por favor no respondas a este correo.</span>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CID = 'campaignimg';

// fetch con un reintento ante 429 (límite de tasa)
async function resendPost(apiKey, url, payloadStr) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: payloadStr
    });
    if (res.status === 429 && attempt === 0) {
      await new Promise(r => setTimeout(r, 1200));
      continue;
    }
    return res;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Método no permitido.' }) };
  }

  const apiKey = getEnv(['RESEND_API_KEY', 'RESEND_KEY']);
  const from = getEnv(['EMAIL_FROM', 'RESEND_FROM']) || 'Campus Susana López <onboarding@resend.dev>';
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Falta RESEND_API_KEY en el servidor.' }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Solicitud inválida.' }) };
  }

  const subject = String(body.subject || '').trim() || 'Comunicación institucional';
  const title = String(body.title || '').trim();
  const message = String(body.message || '').trim();
  const videoUrl = String(body.videoUrl || '').trim();
  const imageBase64 = String(body.imageBase64 || '').replace(/^data:[^,]+,/, '').trim();
  const imageType = String(body.imageType || 'image/jpeg').trim() || 'image/jpeg';
  const imageName = String(body.imageName || 'campana.jpg').trim() || 'campana.jpg';
  let recipients = Array.isArray(body.recipients) ? body.recipients : [];

  if (!message && !imageBase64 && !videoUrl) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'No hay contenido para enviar (mensaje, imagen o video).' }) };
  }

  const seen = new Set();
  recipients = recipients
    .map(r => ({ email: String((r && r.email) || '').trim().toLowerCase(), nombre: String((r && r.nombre) || '').trim() }))
    .filter(r => {
      if (!EMAIL_RE.test(r.email) || seen.has(r.email)) return false;
      seen.add(r.email); return true;
    });

  if (!recipients.length) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'No hay destinatarios con correo válido.' }) };
  }

  const hasImage = !!imageBase64;
  let sent = 0, failed = 0;
  const errors = [];

  if (!hasImage) {
    // ---- Sin imagen: envío por lotes (rápido) ----
    const imageSrc = '';
    const batches = chunk(recipients, 100);

    async function sendBatch(batch) {
      const payload = batch.map(r => ({
        from, to: [r.email], subject,
        html: buildHtml({ nombre: r.nombre, title, message, videoUrl, imageSrc })
      }));
      try {
        const res = await resendPost(apiKey, 'https://api.resend.com/emails/batch', JSON.stringify(payload));
        const txt = await res.text();
        if (res.ok) { sent += batch.length; return; }
        failed += batch.length;
        let m = `HTTP ${res.status}`;
        try { const j = JSON.parse(txt); m = (j && (j.message || j.error)) ? (j.message || j.error) : m; } catch (e) {}
        batch.forEach(r => errors.push({ email: r.email, error: m }));
        console.error('Resend batch error', res.status, txt);
      } catch (e) {
        failed += batch.length;
        batch.forEach(r => errors.push({ email: r.email, error: 'fallo de red' }));
        console.error('Resend batch fetch error', e);
      }
    }

    const CONCURRENCY = 2;
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      await Promise.all(batches.slice(i, i + CONCURRENCY).map(sendBatch));
    }
  } else {
    // ---- Con imagen: envío individual con adjunto inline (CID) ----
    const imageSrc = `cid:${CID}`;
    const attachments = [{ filename: imageName, content: imageBase64, content_id: CID, content_type: imageType }];

    async function sendOne(r) {
      const msg = {
        from, to: [r.email], subject,
        html: buildHtml({ nombre: r.nombre, title, message, videoUrl, imageSrc }),
        attachments
      };
      try {
        const res = await resendPost(apiKey, 'https://api.resend.com/emails', JSON.stringify(msg));
        const txt = await res.text();
        if (res.ok) { sent += 1; return; }
        failed += 1;
        let m = `HTTP ${res.status}`;
        try { const j = JSON.parse(txt); m = (j && (j.message || j.error)) ? (j.message || j.error) : m; } catch (e) {}
        errors.push({ email: r.email, error: m });
        console.error('Resend send error', res.status, txt);
      } catch (e) {
        failed += 1;
        errors.push({ email: r.email, error: 'fallo de red' });
        console.error('Resend send fetch error', e);
      }
    }

    // Concurrencia conservadora para respetar el límite de tasa de Resend (~2/s).
    const CONCURRENCY = 2;
    for (let i = 0; i < recipients.length; i += CONCURRENCY) {
      await Promise.all(recipients.slice(i, i + CONCURRENCY).map(sendOne));
    }
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ success: failed === 0, sent, failed, total: recipients.length, errors: errors.slice(0, 50) })
  };
};
