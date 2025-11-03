/* ==========================================
   SISTEMA DE CAPACITACIONES - VERSIÓN SEGURA
   Hospital Susana López de Valencia
   
   ⚠️ SEGURIDAD:
   - NO guarda credenciales en localStorage
   - Todas las peticiones pasan por Netlify Functions
   - Las credenciales están en variables de entorno del servidor
   ========================================== */

// Variables globales
let currentTraining = null;
let currentSession = null;
let currentParticipation = null;
let currentExamType = 'pretest';
let trainings = [];
let sessions = [];
let participations = [];
let questions = [];
let isConnected = false;

// ==========================================
// INICIALIZACIÓN
// ==========================================

function initializeApp() {
    console.log('🚀 Iniciando Sistema de Capacitaciones (Versión Segura)...');
    console.log('🔒 Modo: Netlify Functions - Credenciales en servidor');
    
    // Ocultar pantalla de carga
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) loadingScreen.classList.add('hidden');
    }, 1500);
    
    // Actualizar fecha y hora
    updateDateTime();
    setInterval(updateDateTime, 60000);
    
    // Verificar parámetros de URL
    checkUrlParams();
    
    // Cargar tema guardado
    loadTheme();
    
    // Cargar configuración (sin credenciales)
    loadConfiguration();
    
    // Inicializar dashboard
    if (isConnected) {
        initializeDashboard();
    }
}

function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    const dateTimeString = now.toLocaleDateString('es-CO', options);
    
    const dateTimeElement = document.getElementById('currentDateTime');
    if (dateTimeElement) {
        dateTimeElement.textContent = dateTimeString;
    }
}

function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        const accessCodeInput = document.getElementById('accessCode');
        if (accessCodeInput) accessCodeInput.value = code;
        switchTab('exam');
        if (isConnected) accessTraining();
    }
}

// ==========================================
// CONFIGURACIÓN SEGURA (SIN CREDENCIALES)
// ==========================================

function loadConfiguration() {
    console.log('ℹ️ Sistema en modo seguro - Usando Netlify Functions');
    console.log('ℹ️ Credenciales en variables de entorno del servidor');
    
    // No cargamos credenciales del localStorage
    // Solo intentamos conectar a través del proxy
    testConnection(false);
}

// ==========================================
// FUNCIONES DE AIRTABLE (VÍA PROXY SEGURO)
// ==========================================

async function airtableRequest(method, endpoint, data = null) {
    // ⚠️ IMPORTANTE: TODAS las peticiones pasan por Netlify Functions
    // El servidor usa las credenciales de las variables de entorno
    // El cliente NUNCA maneja credenciales
    
    try {
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
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('❌ Error en petición Airtable:', error.message);
        throw error;
    }
}

// ==========================================
// TEST DE CONEXIÓN
// ==========================================

async function testConnection(showMessage = true) {
    try {
        if (showMessage) {
            showAlert('Probando conexión...', 'info');
        }
        
        const response = await airtableRequest('GET', '/Capacitaciones?maxRecords=1');
        
        if (response) {
            isConnected = true;
            const connectionStatus = document.getElementById('connectionStatus');
            if (connectionStatus) {
                connectionStatus.textContent = 'Conectado';
                connectionStatus.className = 'badge success';
            }
            
            if (showMessage) {
                showAlert('✅ Conexión exitosa con Airtable', 'success');
            }
            
            // Inicializar dashboard después de conexión exitosa
            initializeDashboard();
            loadTrainings();
            
            return true;
        }
    } catch (error) {
        isConnected = false;
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.textContent = 'Desconectado';
            connectionStatus.className = 'badge danger';
        }
        
        if (showMessage) {
            showAlert(`❌ Error de conexión: ${error.message}`, 'error');
        }
        
        return false;
    }
}

// ==========================================
// NAVEGACIÓN ENTRE TABS
// ==========================================

function switchTab(tabName) {
    // Actualizar tabs activos
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        }
    });
    
    // Actualizar contenido visible
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const tabContent = document.getElementById(tabName);
    if (tabContent) tabContent.classList.add('active');
    
    // Ejecutar acciones específicas de cada tab
    switch(tabName) {
        case 'dashboard':
            initializeDashboard();
            break;
        case 'manage':
            if (isConnected) loadTrainings();
            break;
        case 'reports':
            loadReportOptions();
            break;
    }
}

// ==========================================
// CARGAR DATOS
// ==========================================

async function loadTrainings() {
    try {
        const response = await airtableRequest('GET', '/Capacitaciones');
        if (response && response.records) {
            trainings = response.records;
            displayTrainings();
        }
    } catch (error) {
        console.error('Error cargando capacitaciones:', error);
        showAlert('Error al cargar capacitaciones', 'error');
    }
}

function displayTrainings() {
    console.log(`📊 Capacitaciones cargadas: ${trainings.length}`);
    // Implementar visualización según necesidad
}

// ==========================================
// UTILIDADES
// ==========================================

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
}

function saveTheme(theme) {
    localStorage.setItem('theme', theme);
}

function showAlert(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Usar SweetAlert2 si está disponible
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: type,
            title: type === 'success' ? 'Éxito' : type === 'error' ? 'Error' : 'Información',
            text: message,
            timer: 3000,
            showConfirmButton: false
        });
    }
}

function initializeDashboard() {
    console.log('📊 Dashboard inicializado');
    // Implementar lógica del dashboard
}

function loadReportOptions() {
    console.log('📈 Opciones de reportes cargadas');
    // Implementar lógica de reportes
}

async function accessTraining() {
    const code = document.getElementById('accessCode').value;
    if (!code) {
        showAlert('Por favor ingrese un código de acceso', 'error');
        return;
    }
    
    try {
        showAlert('Buscando capacitación...', 'info');
        // Aquí iría la lógica para buscar el código en Airtable
        console.log('Accediendo a capacitación con código:', code);
    } catch (error) {
        showAlert('Error al acceder a la capacitación', 'error');
    }
}

// ==========================================
// INICIAR AL CARGAR LA PÁGINA
// ==========================================

document.addEventListener('DOMContentLoaded', initializeApp);

// ==========================================
// NOTAS DE SEGURIDAD
// ==========================================

/*
🔒 SEGURIDAD EN ESTA VERSIÓN:

1. ✅ NO se guardan credenciales en localStorage
2. ✅ NO se envían credenciales desde el navegador
3. ✅ Todas las peticiones pasan por Netlify Functions
4. ✅ Las credenciales están en variables de entorno del servidor
5. ✅ Comunicación cliente-servidor encriptada (HTTPS)
6. ✅ El proxy verifica credenciales en el servidor
7. ✅ Si una sesión se compromete, las credenciales no se exponen

CONFIGURACIÓN EN NETLIFY:

Site settings → Build & deploy → Environment

AIRTABLE_API_KEY=patXXXXXXXXXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

Estas variables NUNCA están en el código, solo en el servidor.
*/