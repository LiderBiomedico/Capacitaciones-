const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'capacitaciones.html');
const functionsPath = path.join(root, 'netlify', 'functions');
let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`ERROR: ${message}`);
}

function ok(message) {
  console.log(`OK: ${message}`);
}

function compileJavaScript(source, filename) {
  try {
    new vm.Script(source, { filename });
    return true;
  } catch (error) {
    fail(`${filename}: ${error.message}`);
    return false;
  }
}

const html = fs.readFileSync(htmlPath, 'utf8');
const inlineScriptPattern = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let match;
let inlineCount = 0;
while ((match = inlineScriptPattern.exec(html))) {
  if (/\bsrc\s*=/.test(match[1])) continue;
  inlineCount += 1;
  compileJavaScript(match[2], `capacitaciones.html:inline-${inlineCount}`);
}
if (!failures) ok(`${inlineCount} bloques JavaScript internos tienen sintaxis válida`);

const ids = [...html.matchAll(/\bid="([^"]+)"/g)]
  .map((item) => item[1])
  .filter((id) => !id.includes('${'));
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) fail(`IDs HTML duplicados: ${duplicateIds.join(', ')}`);
else ok('No hay IDs HTML estáticos duplicados');

const functionFiles = fs.existsSync(functionsPath)
  ? fs.readdirSync(functionsPath).filter((file) => file.endsWith('.js'))
  : [];
for (const file of functionFiles) {
  compileJavaScript(fs.readFileSync(path.join(functionsPath, file), 'utf8'), `netlify/functions/${file}`);
}
if (!failures) ok(`${functionFiles.length} funciones incluidas tienen sintaxis válida`);

const referencedFunctions = [...new Set(
  [...html.matchAll(/\/\.netlify\/functions\/([A-Za-z0-9_-]+)/g)].map((item) => item[1])
)].sort();
const includedFunctions = new Set(functionFiles.map((file) => path.basename(file, '.js')));
const missingFunctions = referencedFunctions.filter((name) => !includedFunctions.has(name));
if (missingFunctions.length) {
  console.warn(`AVISO: el paquete recibido no incluye estas funciones referenciadas: ${missingFunctions.join(', ')}`);
} else {
  ok('Todas las funciones de Netlify referenciadas están incluidas');
}

if (failures) process.exit(1);
console.log('Verificación local completada sin errores de sintaxis.');
