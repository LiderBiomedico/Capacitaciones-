# Actualización: contraseña admin desde Airtable

Incluye:
- capacitaciones.html (modificado): pide contraseña ADMIN después del splash
- app.js (modificado): si usas esta versión, también queda protegido
- netlify/functions/validate-app-password.js (nuevo): valida contraseña contra Airtable (AppConfig)

## Airtable
Crea una tabla llamada **AppConfig** con 2 campos:
- **Key** (texto)
- **Value** (texto)

Agrega un registro:
- Key = APP_PASSWORD
- Value = (tu contraseña)

## Netlify (variables de entorno)
Asegúrate de tener:
- AIRTABLE_API_KEY
- AIRTABLE_BASE_ID

Opcional (fallback):
- APP_PASSWORD (solo si no tienes AppConfig aún)

## Nota
El bloqueo se omite automáticamente si el link trae ?code=... (flujo de participante por QR).
