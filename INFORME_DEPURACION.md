# Sistema automatizado de capacitaciones HSLV — versión depurada

Fecha de revisión: 3 de septiembre de 2026

Esta carpeta es una copia independiente. Los archivos originales recibidos no fueron modificados.

## Resultado de la revisión

El informe inicial de React Doctor 0.9.13 contenía 83 advertencias agrupadas en 11 reglas y una puntuación de 56/100. El propio informe indica `reactDetected: false`: el sistema es principalmente HTML y JavaScript, no una aplicación React. Las reglas genéricas de seguridad, errores y rendimiento sí se usaron como guía de depuración.

## Correcciones aplicadas

- Validación del estado HTTP antes de consumir respuestas de `fetch`.
- Mensajes de error de Netlify conservados mediante el helper `readJsonResponse`.
- Protección `noopener,noreferrer` en ventanas y enlaces externos.
- Liberación de todas las URL temporales creadas con `URL.createObjectURL`.
- Sustitución de la clonación `JSON.parse(JSON.stringify(...))` por `structuredClone`.
- Búsquedas repetitivas optimizadas con `Map` y `Set`.
- Operaciones independientes agrupadas con `Promise.all`.
- Operaciones que deben respetar orden o límites de API ejecutadas con `runSequentially`.
- Iteraciones dobles `map/filter` y `filter/map` combinadas en una sola pasada.
- Ordenamientos inmutables actualizados con `toSorted` donde correspondía.
- Corrección del ID HTML duplicado de los dos modales QR.
- El campo de contraseña para administrar usuarios ahora oculta el texto.
- La clave de ImgBB expuesta en el navegador fue eliminada. Las imágenes de campañas se envían mediante la función segura `upload-campaign-image` y la variable de entorno `IMGBB_API_KEY`.
- Se agregó `npm test` / `npm run check` para validar sintaxis, scripts internos, IDs HTML y funciones incluidas.

## Verificación realizada

La verificación local terminó correctamente:

- 4 bloques JavaScript internos con sintaxis válida.
- 349 IDs HTML revisados, sin IDs estáticos duplicados.
- 5 funciones de Netlify incluidas con sintaxis válida.
- `package.json` válido.
- `npm test` completado con código de salida 0.

React Doctor no se volvió a ejecutar en el entorno de depuración porque el proceso intentó enviar telemetría externa con rutas y diagnósticos del proyecto. Las comprobaciones posteriores se realizaron localmente sin transmitir información.

## Funciones faltantes en el paquete recibido

`capacitaciones.html` invoca seis funciones que no estaban dentro del ZIP recibido:

- `airtable-proxy.js`
- `create-session.js`
- `toggle-training-status.js`
- `upload-airtable-attachment.js`
- `upload-attendance-pdf.js`
- `validate-app-password.js`

Estas funciones deben recuperarse del proyecto completo antes de desplegar esta carpeta como reemplazo del sitio actual. No se generaron implementaciones ficticias porque podrían alterar la integración con Airtable, autenticación y archivos.

## Variables requeridas en Netlify

Revisa que el sitio conserve, como mínimo, las variables que correspondan a sus funciones:

- `AIRTABLE_TOKEN`
- `AIRTABLE_BASE_ID`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `IMGBB_API_KEY`

No coloques los valores de estas variables dentro de `capacitaciones.html` ni los publiques en GitHub.

## Comandos de comprobación

Desde esta carpeta:

```powershell
npm test
npx react-doctor@latest
```

Antes del despliegue confirma que las seis funciones faltantes estén presentes en `netlify/functions`.
