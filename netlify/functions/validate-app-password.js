// ==========================================
// netlify/functions/validate-app-password.js
// Valida la contraseña de administrador
// ==========================================

const APP_PASSWORD = process.env.APP_PASSWORD || 'admin123';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  const { password } = payload;

  if (!password) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Contraseña requerida' }) };
  }

  if (password === APP_PASSWORD) {
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } else {
    return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Contraseña incorrecta' }) };
  }
};
