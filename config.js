// ==========================================
// config.js - Configuración del Sistema
// ==========================================

const CONFIG = {
    // Credenciales de Airtable (se cargan dinámicamente)
    AIRTABLE_TOKEN: '',
    AIRTABLE_BASE_ID: '',
    AIRTABLE_API_URL: 'https://api.airtable.com/v0',
    
    // Configuración de la aplicación
    APP_NAME: 'Sistema de Capacitaciones',
    HOSPITAL_NAME: 'Hospital Susana López de Valencia',
    VERSION: '1.0.0',
    
    // Límites
    MAX_QUESTIONS_PER_EXAM: 10,
    MIN_QUESTIONS_PER_EXAM: 1,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    
    // Timeouts
    API_TIMEOUT: 30000, // 30 segundos
    SESSION_TIMEOUT: 60 * 60 * 1000, // 1 hora
    
    // Configuración de gráficos
    CHART_COLORS: {
        primary: 'rgba(102, 126, 234, 1)',
        secondary: 'rgba(118, 75, 162, 1)',
        success: 'rgba(16, 185, 129, 1)',
        danger: 'rgba(239, 68, 68, 1)',
        warning: 'rgba(245, 158, 11, 1)',
        info: 'rgba(59, 130, 246, 1)'
    },
    
    // URLs de producción
    PRODUCTION_URL: 'https://capacitaciones-hslv.netlify.app',
    
    // Configuración de exportación
    EXPORT_FORMATS: ['CSV', 'PDF', 'Excel'],
    
    // Departamentos disponibles
    DEPARTMENTS: [
        'General',
        'Enfermería',
        'Medicina',
        'Administración',
        'Laboratorio',
        'Radiología',
        'Urgencias',
        'UCI',
        'Quirófano',
        'Pediatría'
    ],
    
    // Cargos disponibles
    POSITIONS: [
        'Médico',
        'Enfermero/a',
        'Auxiliar de Enfermería',
        'Administrativo',
        'Técnico',
        'Coordinador',
        'Jefe de Área',
        'Residente',
        'Interno',
        'Otro'
    ],
    
    // Escalas de calificación
    RATING_LABELS: {
        1: 'Totalmente en desacuerdo',
        2: 'En desacuerdo',
        3: 'Neutral',
        4: 'De acuerdo',
        5: 'Totalmente de acuerdo'
    }
};

// ==========================================
// Función de Request a Airtable
// ==========================================

async function airtableRequest(method, endpoint, data = null) {
    // Si estamos en producción, usar función serverless
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return await airtableRequestServerless(method, endpoint, data);
    }
    
    // En desarrollo, usar API directamente
    if (!CONFIG.AIRTABLE_TOKEN || !CONFIG.AIRTABLE_BASE_ID) {
        throw new Error('Por favor configure las credenciales de Airtable');
    }
    
    const url = `${CONFIG.AIRTABLE_API_URL}/${CONFIG.AIRTABLE_BASE_ID}${endpoint}`;
    
    const options = {
        method: method,
        headers: {
            'Authorization': `Bearer ${CONFIG.AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Error ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('Airtable request error:', error);
        throw error;
    }
}

// Función para usar con Netlify Functions
async function airtableRequestServerless(method, endpoint, data = null) {
    const response = await fetch('/.netlify/functions/airtable-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            method: method,
            path: endpoint,
            body: data
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
    }
    
    return await response.json();
}

// ==========================================
// netlify.toml
// ==========================================
/*
[build]
  functions = "netlify/functions"
  publish = "."

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
*/

// ==========================================
// package.json
// ==========================================
/*
{
  "name": "hospital-capacitaciones",
  "version": "1.0.0",
  "description": "Sistema de Capacitaciones - Hospital Susana López de Valencia",
  "main": "index.html",
  "scripts": {
    "dev": "netlify dev",
    "build": "echo 'No build required'",
    "deploy": "netlify deploy --prod"
  },
  "keywords": [
    "hospital",
    "capacitaciones",
    "training",
    "healthcare"
  ],
  "author": "Hospital Susana López de Valencia",
  "license": "MIT",
  "dependencies": {
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "netlify-cli": "^17.0.0"
  }
}
*/

// ==========================================
// .env.example
// ==========================================
/*
# Credenciales de Airtable
AIRTABLE_API_KEY=patXXXXXXXXXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# Configuración opcional
NODE_ENV=production
*/

// ==========================================
// .gitignore
// ==========================================
/*
# Dependencies
node_modules/
package-lock.json
yarn.lock

# Environment variables
.env
.env.local
.env.production

# Netlify
.netlify/

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.sublime-*

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build
dist/
build/

# Temporary files
*.tmp
*.temp
.cache/
*/

// ==========================================
// README.md
// ==========================================
/*
# 🏥 Sistema de Capacitaciones - Hospital Susana López de Valencia

Sistema integral de gestión de capacitaciones hospitalarias con evaluaciones pre y post test.

## 🚀 Características

- ✅ Creación de capacitaciones con pretest y post-test
- ✅ Generación de códigos QR para acceso
- ✅ Calificación de 1 a 5 puntos
- ✅ Cálculo automático de adherencia y mejora
- ✅ Dashboard con estadísticas en tiempo real
- ✅ Reportes exportables (CSV, PDF)
- ✅ Diseño responsive para móviles
- ✅ Modo oscuro

## 📋 Requisitos

- Cuenta en [Airtable](https://airtable.com)
- Cuenta en [Netlify](https://netlify.com) (opcional para hosting)
- Navegador web moderno

## 🛠️ Instalación Local

1. Clonar el repositorio:
```bash
git clone https://github.com/hospital/capacitaciones.git
cd capacitaciones
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus credenciales de Airtable
```

4. Ejecutar en desarrollo:
```bash
npm run dev
```

## 📊 Configuración de Airtable

### Crear las siguientes tablas:

1. **Capacitaciones**
   - Título (Single line text)
   - Descripción (Long text)
   - Departamento (Single select)
   - Activa (Checkbox)

2. **Preguntas**
   - Capacitación (Link to Capacitaciones)
   - Tipo (Single select: Pretest/Post-test)
   - Número (Number)
   - Pregunta (Long text)

3. **Sesiones**
   - Capacitación (Link to Capacitaciones)
   - Código Acceso (Single line text)
   - Link Acceso (URL)
   - Fecha Inicio (Date)
   - Activa (Checkbox)

4. **Participaciones**
   - Sesión (Link to Sesiones)
   - Nombre (Single line text)
   - Email (Email)
   - Cargo (Single select)
   - Pretest Score (Number)
   - Post-test Score (Number)
   - Completado (Checkbox)

5. **Respuestas**
   - Participación (Link to Participaciones)
   - Pregunta (Link to Preguntas)
   - Calificación (Number)

## 🚀 Despliegue en Netlify

1. Conectar con GitHub
2. Configurar variables de entorno en Netlify
3. Deploy automático con cada push

## 📱 Uso

### Administrador:
1. Acceder al sistema
2. Configurar credenciales en Ajustes
3. Crear nueva capacitación
4. Generar código QR
5. Compartir con participantes

### Participante:
1. Escanear QR o ingresar código
2. Completar datos personales
3. Realizar pretest
4. Ver contenido de capacitación
5. Realizar post-test
6. Recibir resultados

## 📈 Métricas

- Tasa de adherencia
- Mejora promedio pre vs post
- Participaciones por día
- Rendimiento por departamento

## 🔒 Seguridad

- Credenciales encriptadas
- Funciones serverless para API
- Validación de datos
- Sesiones únicas por código

## 👥 Equipo

Desarrollado para el Hospital Susana López de Valencia

## 📄 Licencia

MIT License - Ver LICENSE.md

## 🆘 Soporte

Para soporte técnico contactar a: soporte@hospital.com
*/