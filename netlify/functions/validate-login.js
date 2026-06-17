// netlify/functions/validate-login.js
// ============================================================================
// Validación de inicio de sesión (usuario + contraseña) DEL LADO DEL SERVIDOR.
//
// Por qué existe: hacer el login desde el navegador obliga a traer las
// contraseñas al cliente. Esta función mantiene esa verificación en el servidor
// y al navegador solo le devuelve { success, nivel, nombre, modulos, vence }.
// Las contraseñas NUNCA salen de Netlify.
//
// Lee las credenciales de Airtable desde variables de entorno (las mismas que
// ya usan tus otras funciones). Se aceptan varios nombres por compatibilidad.
// ============================================================================

const AUTH_TABLE_ID = 'tbl5lvdRbOEL4Zn1G'; // Tabla "Contraseñas"

// Etiqueta del módulo (en Airtable) -> id de pestaña (tab) en la app
const MODULE_TAB_MAP = {
  'Dashboard': 'dashboard',
  'Crear': 'create',
  'Cursos Virtuales': 'virtualCourses',
  'Cursos de Extensión': 'extensionCourses',
  'Gestionar': 'manage',
  'Examen': 'exam',
  'Reportes': 'reports',
  'Personal HSLV': 'personal',
  'Cronograma': 'schedule'
};
const ALL_MODULE_TABS = Object.values(MODULE_TAB_MAP);

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

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fail(statusCode, error) {
  return { statusCode, headers: CORS, body: JSON.stringify({ success: false, error }) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return fail(405, 'Método no permitido.');
  }

  // Token (secreto) desde variables de entorno; base puede caer al ID conocido.
  const token = getEnv(['AIRTABLE_TOKEN', 'AIRTABLE_API_KEY', 'AIRTABLE_PAT', 'AIRTABLE_API_TOKEN']);
  const baseId = getEnv(['AIRTABLE_BASE_ID', 'AIRTABLE_BASE', 'BASE_ID']) || 'appcazmz56GPqqqLG';

  if (!token) {
    return fail(500, 'Configuración del servidor incompleta (token de Airtable).');
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return fail(400, 'Solicitud inválida.'); }

  const usuario = String(body.usuario || '').trim();
  const contrasena = String(body.contrasena || body.password || '');
  if (!usuario || !contrasena) return fail(400, 'Ingresa usuario y contraseña.');

  // Filtro por usuario (insensible a mayúsculas). Se escapan comillas/backslash.
  const safe = usuario.toLowerCase().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const formula = `LOWER({Usuario})='${safe}'`;
  const url = `https://api.airtable.com/v0/${baseId}/${AUTH_TABLE_ID}` +
    `?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;

  let data;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('Airtable error', res.status, txt);
      return fail(502, 'No se pudo verificar las credenciales. Intenta de nuevo.');
    }
    data = await res.json();
  } catch (e) {
    console.error('Fetch error', e);
    return fail(502, 'No se pudo conectar con el servidor de datos.');
  }

  const records = (data && Array.isArray(data.records)) ? data.records : [];
  // Mensaje genérico para no revelar si el usuario existe.
  if (!records.length) return fail(401, 'Usuario o contraseña incorrectos.');

  const f = records[0].fields || {};
  const storedPass = String(f['Contraseña'] != null ? f['Contraseña'] : '');
  if (storedPass !== contrasena) return fail(401, 'Usuario o contraseña incorrectos.');

  if (f['Activo'] !== true) return fail(403, 'La cuenta está inactiva. Contacta al administrador.');

  const hoy = todayISO();
  const ini = (f['Fecha Inicio'] || '').slice(0, 10);
  const fin = (f['Fecha Fin'] || '').slice(0, 10);
  if (ini && hoy < ini) return fail(403, `Tu acceso inicia el ${ini}.`);
  if (fin && hoy > fin) return fail(403, `Tu acceso venció el ${fin}. Contacta al administrador.`);

  const nivel = f['Nivel de Acceso'] || 'Consulta';
  let modulos;
  if (nivel === 'Administrador') {
    modulos = ALL_MODULE_TABS.slice();
  } else {
    const etiquetas = Array.isArray(f['Módulos Permitidos']) ? f['Módulos Permitidos'] : [];
    modulos = etiquetas.map((et) => MODULE_TAB_MAP[et]).filter(Boolean);
  }
  if (!modulos.length) return fail(403, 'Tu cuenta no tiene módulos asignados. Contacta al administrador.');

  // Respuesta segura: sin contraseña ni datos de otros usuarios.
  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      success: true,
      usuario: f['Usuario'] || usuario,
      nombre: f['Nombre Completo'] || f['Usuario'] || usuario,
      nivel,
      modulos,
      vence: fin || ''
    })
  };
};
