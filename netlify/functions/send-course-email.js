// netlify/functions/send-course-email.js
// ============================================================================
// Envía por correo el enlace de un curso virtual al personal del hospital.
// Usa Resend (https://resend.com) vía su API HTTP. La clave va en variables
// de entorno (RESEND_API_KEY) y el remitente en EMAIL_FROM.
//
// Entrada (POST JSON):
//   {
//     courseTitle: "Bioseguridad",
//     courseDescription: "…",          // opcional
//     courseUrl: "https://…?vc=VCABCD",
//     subject: "…",                    // opcional (se arma uno por defecto)
//     intro: "…",                      // opcional, texto introductorio
//     recipients: [ { email, nombre } ]  // requerido
//   }
// Salida: { success, sent, failed, errors:[{email,error}] }
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

function buildHtml({ nombre, courseTitle, courseDescription, courseUrl, intro }) {
  const saludo = nombre ? `Hola ${esc(nombre)},` : 'Hola,';
  const desc = courseDescription
    ? `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.5;">${esc(courseDescription)}</p>` : '';
  const introHtml = intro
    ? `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.5;">${esc(intro)}</p>` : '';
  return `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(2,8,23,.08);">
        <tr><td style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:22px 28px;">
          <span style="color:#fff;font-size:18px;font-weight:800;">Campus Susana López</span><br>
          <span style="color:#dbeafe;font-size:12px;">Hospital Susana López de Valencia E.S.E.</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:16px;">${saludo}</p>
          ${introHtml}
          <p style="margin:0 0 6px;color:#334155;font-size:15px;">Tienes un nuevo curso virtual disponible:</p>
          <h2 style="margin:0 0 8px;color:#1d4ed8;font-size:20px;">${esc(courseTitle)}</h2>
          ${desc}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td style="border-radius:10px;background:#2563eb;">
            <a href="${esc(courseUrl)}" style="display:inline-block;padding:13px 26px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">Acceder al curso</a>
          </td></tr></table>
          <p style="margin:0 0 6px;color:#64748b;font-size:13px;">O copia este enlace en tu navegador:</p>
          <p style="margin:0 0 18px;font-size:13px;word-break:break-all;"><a href="${esc(courseUrl)}" style="color:#2563eb;">${esc(courseUrl)}</a></p>
          <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">Al ingresar, escribe tu número de cédula para registrar tu avance. Si no estás registrado, podrás hacerlo en ese momento.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #eef2f7;">
          <span style="color:#94a3b8;font-size:11px;">Mensaje institucional de capacitación. Por favor no respondas a este correo.</span>
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

  const courseTitle = String(body.courseTitle || '').trim() || 'Curso virtual';
  const courseDescription = String(body.courseDescription || '').trim();
  const courseUrl = String(body.courseUrl || '').trim();
  const intro = String(body.intro || '').trim();
  const subject = String(body.subject || '').trim() || `Nuevo curso virtual: ${courseTitle}`;
  let recipients = Array.isArray(body.recipients) ? body.recipients : [];

  if (!courseUrl) return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Falta el enlace del curso.' }) };

  // Normalizar y validar destinatarios (deduplicar por correo)
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

  let sent = 0, failed = 0;
  const errors = [];

  // Resend permite hasta 100 mensajes por lote (/emails/batch).
  const batches = chunk(recipients, 100);
  for (const batch of batches) {
    const payload = batch.map(r => ({
      from,
      to: [r.email],
      subject,
      html: buildHtml({ nombre: r.nombre, courseTitle, courseDescription, courseUrl, intro })
    }));
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const txt = await res.text();
      if (res.ok) {
        sent += batch.length;
      } else {
        failed += batch.length;
        let msg = `HTTP ${res.status}`;
        try { const j = JSON.parse(txt); msg = (j && (j.message || j.error)) ? (j.message || j.error) : msg; } catch (e) {}
        batch.forEach(r => errors.push({ email: r.email, error: msg }));
        console.error('Resend batch error', res.status, txt);
      }
    } catch (e) {
      failed += batch.length;
      batch.forEach(r => errors.push({ email: r.email, error: 'fallo de red' }));
      console.error('Resend fetch error', e);
    }
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ success: failed === 0, sent, failed, total: recipients.length, errors: errors.slice(0, 50) })
  };
};
