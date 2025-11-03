// ==========================================
// config.js - Configuración del Sistema
// ==========================================

const CONFIG = {
    // Configuración de la aplicación
    APP_NAME: 'Sistema de Capacitaciones',
    HOSPITAL_NAME: 'Hospital Susana López de Valencia',
    VERSION: '1.0.0',
    
    // Límites
    MAX_QUESTIONS_PER_EXAM: 20,
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

/**
 * Realiza una petición a Airtable a través del proxy de Netlify Functions
 * @param {string} method - Método HTTP (GET, POST, PATCH, DELETE)
 * @param {string} endpoint - Endpoint de la API (ej: '/Capacitaciones')
 * @param {object} data - Datos a enviar (para POST/PATCH)
 * @returns {Promise<object>} - Respuesta de Airtable
 */
async function airtableRequest(method, endpoint, data = null) {
    // Detectar si estamos en localhost (desarrollo) o en producción
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '';
    
    let apiUrl;
    
    if (isLocalhost) {
        // En desarrollo local con Netlify CLI: netlify dev
        // Las funciones están en: http://localhost:8888/.netlify/functions/
        apiUrl = 'http://localhost:8888/.netlify/functions/airtable-proxy';
        console.log('🔧 Modo DESARROLLO - Usando Netlify Dev Local');
    } else {
        // En producción en Netlify
        apiUrl = '/.netlify/functions/airtable-proxy';
        console.log('🚀 Modo PRODUCCIÓN - Usando Netlify Functions');
    }
    
    try {
        console.log(`📡 ${method} ${endpoint}`);
        
        const requestOptions = {
            method: 'POST', // Siempre POST al proxy
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                method: method,      // El método real para Airtable
                path: endpoint,      // El path de Airtable
                body: data          // Los datos a enviar
            }),
            timeout: CONFIG.API_TIMEOUT
        };
        
        const response = await fetch(apiUrl, requestOptions);
        
        if (!response.ok) {
            let errorMessage = `Error ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                
                // Proporcionar mensajes más descriptivos
                if (response.status === 404) {
                    errorMessage = 'Netlify Functions no encontrada. Verifica que el proyecto esté configurado correctamente.';
                } else if (response.status === 401) {
                    errorMessage = 'Error de autenticación. Verifica las credenciales de Airtable.';
                } else if (response.status === 403) {
                    errorMessage = 'Acceso denegado. Verifica los permisos de Airtable.';
                } else if (response.status === 500) {
                    errorMessage = errorData.details || 'Error del servidor. Verifica las variables de entorno.';
                }
            } catch (e) {
                // Si no se puede parsear el JSON del error
                console.error('Error parseando respuesta de error:', e);
            }
            throw new Error(errorMessage);
        }
        
        const responseData = await response.json();
        console.log('✅ Petición exitosa');
        return responseData;
        
    } catch (error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
            throw new Error('La petición tardó demasiado. Verifica tu conexión.');
        }
        
        if (error.message.includes('Failed to fetch')) {
            if (isLocalhost) {
                throw new Error('No se puede conectar con Netlify Dev. Asegúrate de ejecutar "netlify dev"');
            } else {
                throw new Error('Error de red. Verifica tu conexión a internet.');
            }
        }
        
        console.error('❌ Error en petición Airtable:', error.message);
        throw error;
    }
}

// ==========================================
// Funciones de Utilidad
// ==========================================

/**
 * Genera un código de acceso aleatorio de 6 caracteres
 */
function generateAccessCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Formatea una fecha en formato legible en español
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Formatea una fecha y hora en formato legible en español
 */
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Valida un correo electrónico
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Calcula el porcentaje de mejora entre pre-test y post-test
 */
function calculateImprovement(preScore, postScore) {
    if (!preScore || preScore === 0) return 0;
    return ((postScore - preScore) / preScore * 100).toFixed(2);
}

/**
 * Calcula el promedio de un array de números
 */
function calculateAverage(numbers) {
    if (!numbers || numbers.length === 0) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return (sum / numbers.length).toFixed(2);
}

// ==========================================
// Logging y Debug
// ==========================================

const Logger = {
    info: (message, ...args) => {
        console.log(`ℹ️ [INFO] ${message}`, ...args);
    },
    
    success: (message, ...args) => {
        console.log(`✅ [SUCCESS] ${message}`, ...args);
    },
    
    warning: (message, ...args) => {
        console.warn(`⚠️ [WARNING] ${message}`, ...args);
    },
    
    error: (message, ...args) => {
        console.error(`❌ [ERROR] ${message}`, ...args);
    },
    
    debug: (message, ...args) => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log(`🔍 [DEBUG] ${message}`, ...args);
        }
    }
};

// Exportar para uso en otros scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        airtableRequest,
        generateAccessCode,
        formatDate,
        formatDateTime,
        validateEmail,
        calculateImprovement,
        calculateAverage,
        Logger
    };
}

console.log('📦 Config.js cargado - Versión', CONFIG.VERSION);
