// netlify/functions/validate-app-password.js
// Valida la contraseña de administrador contra la variable de entorno

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Método no permitido' }) };
  }

  let password;
  try {
    const body = JSON.parse(event.body || '{}');
    password = body.password;
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Body inválido' }) };
  }

  const adminPassword = process.env.APP_ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('❌ Variable APP_ADMIN_PASSWORD no configurada');
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Contraseña de administrador no configurada en el servidor' }) };
  }

  if (!password || String(password).trim() !== adminPassword.trim()) {
    return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Contraseña incorrecta' }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
