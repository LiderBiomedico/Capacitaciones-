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
    console.log('🔐 Modo: Netlify Functions - Credenciales en servidor');
    
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
// FUNCIONES DE GUARDAR CAPACITACIONES
// ==========================================

// Variable para almacenar el formulario
let trainingFormData = {};

// ==========================================
// CREAR NUEVA CAPACITACIÓN
// ==========================================

async function createNewTraining() {
    const trainingName = document.getElementById('trainingName')?.value;
    const trainingDescription = document.getElementById('trainingDescription')?.value;
    const trainingDepartment = document.getElementById('trainingDepartment')?.value;
    
    // Validar datos
    if (!trainingName) {
        showAlert('Por favor ingrese el nombre de la capacitación', 'error');
        return;
    }
    
    try {
        showAlert('Guardando capacitación...', 'info');
        
        // Preparar datos para Airtable
        const data = {
            records: [
                {
                    fields: {
                        'Título': trainingName,
                        'Descripción': trainingDescription || '',
                        'Departamento': trainingDepartment || 'General',
                        'Activa': true,
                        'Fecha Creación': new Date().toISOString().split('T')[0]
                    }
                }
            ]
        };
        
        // Hacer petición POST a Airtable
        const response = await airtableRequest('POST', '/Capacitaciones', data);
        
        if (response && response.records && response.records.length > 0) {
            const newTraining = response.records[0];
            showAlert('✅ Capacitación guardada exitosamente', 'success');
            console.log('Capacitación creada:', newTraining);
            
            // Limpiar formulario
            clearTrainingForm();
            
            // Recargar lista de capacitaciones
            await loadTrainings();
            
            return newTraining;
        }
    } catch (error) {
        console.error('Error guardando capacitación:', error);
        showAlert(`Error al guardar: ${error.message}`, 'error');
    }
}

// ==========================================
// GUARDAR PREGUNTAS DE CAPACITACIÓN
// ==========================================

async function saveTrainingQuestions(trainingId, questions) {
    if (!trainingId || !questions || questions.length === 0) {
        showAlert('Faltan datos: ID de capacitación o preguntas', 'error');
        return false;
    }
    
    try {
        showAlert('Guardando preguntas...', 'info');
        
        // Preparar array de records para batch insert
        const records = questions.map((question, index) => ({
            fields: {
                'Capacitación': [trainingId], // Airtable usa array para links
                'Número': index + 1,
                'Pregunta': question.text,
                'Tipo': question.type || 'pretest', // pretest o post-test
                'Respuestas': question.answers ? JSON.stringify(question.answers) : ''
            }
        }));
        
        // Guardar en lotes (Airtable permite hasta 10 por request)
        const batchSize = 10;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            const response = await airtableRequest('POST', '/Preguntas', {
                records: batch
            });
            
            if (!response || !response.records) {
                throw new Error('Error en respuesta de Airtable');
            }
        }
        
        showAlert(`✅ ${questions.length} preguntas guardadas`, 'success');
        return true;
        
    } catch (error) {
        console.error('Error guardando preguntas:', error);
        showAlert(`Error al guardar preguntas: ${error.message}`, 'error');
        return false;
    }
}

// ==========================================
// CREAR SESIÓN DE CAPACITACIÓN
// ==========================================

async function createTrainingSession(trainingId) {
    if (!trainingId) {
        showAlert('ID de capacitación no válido', 'error');
        return false;
    }
    
    try {
        // Generar código de acceso único
        const accessCode = generateAccessCode();
        const currentDate = new Date().toISOString().split('T')[0];
        
        const data = {
            records: [
                {
                    fields: {
                        'Capacitación': [trainingId],
                        'Código Acceso': accessCode,
                        'Fecha Inicio': currentDate,
                        'Activa': true,
                        'Link Acceso': `${window.location.origin}?code=${accessCode}`
                    }
                }
            ]
        };
        
        const response = await airtableRequest('POST', '/Sesiones', data);
        
        if (response && response.records && response.records.length > 0) {
            const session = response.records[0];
            showAlert('✅ Sesión creada', 'success');
            console.log('Sesión creada:', session);
            return session;
        }
        
    } catch (error) {
        console.error('Error creando sesión:', error);
        showAlert(`Error al crear sesión: ${error.message}`, 'error');
        return false;
    }
}

// ==========================================
// GUARDAR RESPUESTA DE PARTICIPANTE
// ==========================================

async function saveParticipantAnswer(participationId, questionId, rating) {
    if (!participationId || !questionId || !rating) {
        console.warn('Datos incompletos para guardar respuesta');
        return false;
    }
    
    try {
        const data = {
            records: [
                {
                    fields: {
                        'Participación': [participationId],
                        'Pregunta': [questionId],
                        'Calificación': parseInt(rating),
                        'Fecha Respuesta': new Date().toISOString().split('T')[0]
                    }
                }
            ]
        };
        
        const response = await airtableRequest('POST', '/Respuestas', data);
        return response && response.records && response.records.length > 0;
        
    } catch (error) {
        console.error('Error guardando respuesta:', error);
        return false;
    }
}

// ==========================================
// REGISTRAR PARTICIPANTE
// ==========================================

async function registerParticipant(sessionId, participantData) {
    if (!sessionId || !participantData.name || !participantData.email) {
        showAlert('Datos incompletos del participante', 'error');
        return false;
    }
    
    try {
        const data = {
            records: [
                {
                    fields: {
                        'Sesión': [sessionId],
                        'Nombre': participantData.name,
                        'Email': participantData.email,
                        'Cargo': participantData.position || 'No especificado',
                        'Departamento': participantData.department || 'General',
                        'Fecha Registro': new Date().toISOString().split('T')[0],
                        'Completado': false
                    }
                }
            ]
        };
        
        const response = await airtableRequest('POST', '/Participaciones', data);
        
        if (response && response.records && response.records.length > 0) {
            const participation = response.records[0];
            console.log('Participante registrado:', participation);
            return participation;
        }
        
    } catch (error) {
        console.error('Error registrando participante:', error);
        showAlert(`Error al registrar: ${error.message}`, 'error');
        return false;
    }
}

// ==========================================
// ACTUALIZAR CAPACITACIÓN EXISTENTE
// ==========================================

async function updateTraining(trainingId, updatedData) {
    if (!trainingId) {
        showAlert('ID de capacitación no válido', 'error');
        return false;
    }
    
    try {
        showAlert('Actualizando capacitación...', 'info');
        
        const data = {
            records: [
                {
                    id: trainingId,
                    fields: updatedData
                }
            ]
        };
        
        const response = await airtableRequest('PATCH', '/Capacitaciones', data);
        
        if (response && response.records && response.records.length > 0) {
            showAlert('✅ Capacitación actualizada', 'success');
            await loadTrainings();
            return response.records[0];
        }
        
    } catch (error) {
        console.error('Error actualizando capacitación:', error);
        showAlert(`Error al actualizar: ${error.message}`, 'error');
        return false;
    }
}

// ==========================================
// FINALIZAR PARTICIPACIÓN
// ==========================================

async function completeParticipation(participationId, postTestScore) {
    if (!participationId) {
        showAlert('ID de participación no válido', 'error');
        return false;
    }
    
    try {
        const data = {
            records: [
                {
                    id: participationId,
                    fields: {
                        'Post-test Score': postTestScore,
                        'Completado': true,
                        'Fecha Finalización': new Date().toISOString().split('T')[0]
                    }
                }
            ]
        };
        
        const response = await airtableRequest('PATCH', '/Participaciones', data);
        
        if (response && response.records && response.records.length > 0) {
            showAlert('✅ Evaluación completada', 'success');
            return response.records[0];
        }
        
    } catch (error) {
        console.error('Error completando participación:', error);
        showAlert(`Error: ${error.message}`, 'error');
        return false;
    }
}

// ==========================================
// GENERAR CÓDIGO DE ACCESO ÚNICO
// ==========================================

function generateAccessCode() {
    return 'CAP-' + Date.now().toString(36).toUpperCase() + 
           '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// ==========================================
// LIMPIAR FORMULARIO DE CAPACITACIÓN
// ==========================================

function clearTrainingForm() {
    const inputs = document.querySelectorAll('#trainingForm input, #trainingForm textarea, #trainingForm select');
    inputs.forEach(input => input.value = '');
    trainingFormData = {};
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
🔐 SEGURIDAD EN ESTA VERSIÓN:

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

ESTRUCTURA DE AIRTABLE REQUERIDA:

Tablas necesarias:
1. Capacitaciones (Título, Descripción, Departamento, Activa, Fecha Creación)
2. Preguntas (Capacitación, Tipo, Número, Pregunta, Respuestas)
3. Sesiones (Capacitación, Código Acceso, Fecha Inicio, Activa, Link Acceso)
4. Participaciones (Sesión, Nombre, Email, Cargo, Departamento, Completado)
5. Respuestas (Participación, Pregunta, Calificación, Fecha Respuesta)

EJEMPLO DE USO:

// Crear nueva capacitación
await createNewTraining();

// Crear sesión (requiere ID de capacitación)
await createTrainingSession(trainingId);

// Registrar participante
await registerParticipant(sessionId, {
    name: 'Juan Pérez',
    email: 'juan@hospital.com',
    position: 'Enfermero',
    department: 'Enfermería'
});

// Guardar respuesta
await saveParticipantAnswer(participationId, questionId, 4);

// Completar participación
await completeParticipation(participationId, postTestScore);
*/