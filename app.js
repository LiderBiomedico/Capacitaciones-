/* ==========================================
   SISTEMA DE CAPACITACIONES - VERSIÃ"N SEGURA
   Hospital Susana LÃ³pez de Valencia
   
   âš ï¸ SEGURIDAD:
   - NO guarda credenciales en localStorage
   - Todas las peticiones pasan por Netlify Functions
   - Las credenciales estÃ¡n en variables de entorno del servidor
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
// FUNCIONES DE POSTTEST - INTEGRACIÓN PRETEST → POSTTEST
// ==========================================

/**
 * Generar link permanente de postest después de completar pretest
 */
async function generatePostestLinkAfterPretest(sessionId, participationId, sessionCode, participantData) {
  try {
    console.log('📝 Generando link de postest...');
    
    const response = await fetch('/.netlify/functions/generate-postest-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        participationId: participationId,
        sessionCode: sessionCode,
        userName: participantData.name,
        userEmail: participantData.email,
        department: participantData.department
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error al generar link de postest');
    }

    console.log('✅ Link de postest generado:', data.postestUrl);

    // Guardar datos globales para usar en el modal
    window.postestLinkData = {
      code: data.postestCode,
      url: data.postestUrl,
      participationId: data.participationId,
      participantName: participantData.name
    };

    return data;

  } catch (error) {
    console.error('❌ Error generando link de postest:', error.message);
    showAlert('Error al generar link de postest: ' + error.message, 'error');
    throw error;
  }
}

/**
 * Mostrar modal con el link y QR del postest
 */
function showPostestLinkModal(postestLinkData) {
  try {
    console.log('📱 Mostrando modal de link de postest');

    // Generar QR para el link de postest
    const qrContainer = document.getElementById('postestQrCode');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      
      new QRCode(qrContainer, {
        text: postestLinkData.url,
        width: 300,
        height: 300,
        colorDark: '#667eea',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    }

    // Llenar el input con la URL
    const urlInput = document.getElementById('postestUrlInput');
    if (urlInput) {
      urlInput.value = postestLinkData.url;
    }

    // Mostrar el modal
    const modal = document.getElementById('postestLinkModal');
    if (modal) {
      modal.style.display = 'flex';
    }

  } catch (error) {
    console.error('❌ Error mostrando modal:', error.message);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo mostrar el link de postest'
    });
  }
}

/**
 * Copiar el link al portapapeles
 */
function copyPostestUrl() {
  try {
    const urlInput = document.getElementById('postestUrlInput');
    if (!urlInput && window.postestLinkData) {
      navigator.clipboard.writeText(window.postestLinkData.url).then(() => {
        Swal.fire({
          icon: 'success',
          title: '¡Copiado!',
          text: 'El link ha sido copiado al portapapeles',
          timer: 2000,
          showConfirmButton: false
        });
      });
    } else if (urlInput) {
      urlInput.select();
      document.execCommand('copy');
      
      Swal.fire({
        icon: 'success',
        title: '¡Copiado!',
        text: 'El link ha sido copiado al portapapeles',
        timer: 2000,
        showConfirmButton: false
      });
    }
  } catch (error) {
    console.error('Error copiando link:', error);
  }
}

/**
 * Descargar QR del postest
 */
function downloadPostestQR() {
  try {
    const qrContainer = document.getElementById('postestQrCode');
    const qrImage = qrContainer?.querySelector('img');
    
    if (!qrImage) {
      throw new Error('No se encontró la imagen del QR');
    }
    
    const link = document.createElement('a');
    link.href = qrImage.src;
    link.download = `QR-POSTTEST-${window.postestLinkData?.code || 'sin-codigo'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    Swal.fire({
      icon: 'success',
      title: 'Descargado',
      text: 'El código QR ha sido descargado',
      timer: 1500,
      showConfirmButton: false
    });
    
  } catch (error) {
    console.error('Error descargando QR:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo descargar el QR'
    });
  }
}

/**
 * Cerrar modal de postest
 */
function closePostestLinkModal() {
  const modal = document.getElementById('postestLinkModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Detectar link de postest en la URL y cargarlo automáticamente
 */
async function handlePostestCodeFromUrl(postestCode, participationId) {
  try {
    console.log('🔍 Detectado link de postest, buscando participación...');
    
    const response = await fetch('/.netlify/functions/get-participation-by-postest-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postestCode: postestCode
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Código de postest no válido');
    }

    if (!data.status.isValidForPosttest) {
      throw new Error('Este participante aún no ha completado el pretest');
    }

    console.log('✅ Participación encontrada:', data.participation.fields['Nombre Completo']);

    // Guardar datos globales
    currentParticipation = data.participation;
    currentSession = data.session;
    currentTraining = data.training;
    currentExamType = 'postest';

    // Mostrar información
    Swal.fire({
      icon: 'info',
      title: 'Bienvenido al Posttest',
      html: `
        <div style="text-align: left;">
          <p><strong>Participante:</strong> ${data.participation.fields['Nombre Completo']}</p>
          <p><strong>Capacitación:</strong> ${data.training?.fields['Título'] || 'N/A'}</p>
          <p><strong>Puntuación Pretest:</strong> ${data.status.pretestScore}/100</p>
        </div>
      `,
      confirmButtonText: 'Continuar'
    });

    // Navegar a la sección de examen
    switchTab('exam');
    
    return data;

  } catch (error) {
    console.error('❌ Error cargando postest:', error.message);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.message
    });
    throw error;
  }
}

/**
 * Actualizar función checkUrlParams para detectar pretest y postest
 */
function checkUrlParamsUpdated() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const type = urlParams.get('type');
  const participationId = urlParams.get('pid');

  if (code) {
    // Detectar si es pretest o postest
    if (type === 'postest' && code.startsWith('POSTTEST-')) {
      console.log('📋 URL detectada: POSTTEST');
      handlePostestCodeFromUrl(code, participationId);
    } else {
      console.log('📋 URL detectada: PRETEST');
      const accessCodeInput = document.getElementById('accessCode');
      if (accessCodeInput) accessCodeInput.value = code;
      switchTab('exam');
      if (isConnected) accessTraining();
    }
  }
}

/**
 * Completar postest - Guardar puntuación y mostrar resultados
 */
async function completePosttest(postestScore) {
  try {
    if (!currentParticipation) {
      throw new Error('No hay participación cargada');
    }

    const participationId = currentParticipation.id;

    // Actualizar puntuación del postest
    const updateResponse = await fetch('/.netlify/functions/airtable-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'PATCH',
        path: `/Participaciones/${participationId}`,
        body: {
          fields: {
            'Puntuación Posttest': postestScore,
            'Estado': 'Posttest Completado',
            'Fecha Posttest': new Date().toISOString().split('T')[0]
          }
        }
      })
    });

    const updateData = await updateResponse.json();

    if (!updateData.success) {
      throw new Error('Error al guardar puntuación del postest');
    }

    console.log('✅ Posttest guardado exitosamente');

    // Mostrar resultados
    const pretestScore = currentParticipation.fields['Puntuación Pretest'] || 0;
    const improvement = postestScore - pretestScore;

    Swal.fire({
      icon: improvement >= 0 ? 'success' : 'info',
      title: '¡Posttest Completado!',
      html: `
        <div style="text-align: left;">
          <p><strong>Puntuación Pretest:</strong> ${pretestScore}/100</p>
          <p><strong>Puntuación Posttest:</strong> ${postestScore}/100</p>
          <p><strong>Mejora:</strong> <span style="color: ${improvement >= 0 ? '#28a745' : '#dc3545'};">
            ${improvement >= 0 ? '+' : ''}${improvement} puntos
          </span></p>
        </div>
      `,
      confirmButtonText: 'Cerrar'
    });

    // Limpiar datos globales
    currentParticipation = null;
    currentSession = null;
    currentTraining = null;
    currentExamType = 'pretest';

    return updateData;

  } catch (error) {
    console.error('❌ Error completando postest:', error.message);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.message
    });
    throw error;
  }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================


// ==========================================
// BLOQUEO POR CONTRASEÑA (ADMIN) - Airtable
// - Se omite cuando el usuario entra por QR (?code=...)
// - Valida contra Netlify Function: /.netlify/functions/validate-app-password
// ==========================================
const ADMIN_AUTH_STORAGE_KEY = 'HSLV_ADMIN_AUTH_V1';
const ADMIN_AUTH_TTL_HOURS = 8;

function isParticipantFlow() {
  const urlParams = new URLSearchParams(window.location.search);
  return !!urlParams.get('code');
}

function getStoredAdminAuth() {
  try {
    const raw = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.expiresAt) return null;
    if (Date.now() > data.expiresAt) return null;
    return data;
  } catch {
    return null;
  }
}

function setStoredAdminAuth() {
  const ttlMs = ADMIN_AUTH_TTL_HOURS * 60 * 60 * 1000;
  localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify({ ok: true, expiresAt: Date.now() + ttlMs }));
}

async function validateAdminPassword(password) {
  const res = await fetch('/.netlify/functions/validate-app-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data?.error || 'Contraseña incorrecta');
  }
  return true;
}

async function enforceAdminPassword() {
  if (getStoredAdminAuth()) return true;

  while (true) {
    const result = await Swal.fire({
      title: 'Acceso Administrativo',
      text: 'Ingresa la contraseña para administrar el sistema',
      input: 'password',
      inputPlaceholder: 'Contraseña',
      inputAttributes: { autocapitalize: 'off', autocomplete: 'current-password' },
      confirmButtonText: 'Ingresar',
      showCancelButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showLoaderOnConfirm: true,
      preConfirm: async (pwd) => {
        if (!pwd || String(pwd).trim().length < 6) {
          Swal.showValidationMessage('Ingresa una contraseña válida');
          return false;
        }
        try {
          await validateAdminPassword(String(pwd));
          return true;
        } catch (e) {
          Swal.showValidationMessage(e.message || 'Contraseña incorrecta');
          return false;
        }
      }
    });

    if (result.isConfirmed) {
      setStoredAdminAuth();
      return true;
    }
  }
}

async function initializeApp() {
    console.log('🚀 Iniciando Sistema de Capacitaciones (Versión Segura)...');
    console.log('🔐 Modo: Netlify Functions - Credenciales en servidor');

    // Ocultar pantalla de carga
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) loadingScreen.classList.add('hidden');
    }, 1500);

    // Flujo participante: NO pedir contraseña
    if (isParticipantFlow()) {
        // Verificar parámetros de URL (ACTUALIZADO para detectar postest)
        checkUrlParamsUpdated();
        return;
    }

    // Esperar a que se oculte el loading antes de pedir contraseña
    await new Promise(resolve => setTimeout(resolve, 1600));

    // Pedir contraseña (guardada en Airtable)
    await enforceAdminPassword();

    // Actualizar fecha y hora
    updateDateTime();
    setInterval(updateDateTime, 60000);

    // Verificar parámetros de URL (ACTUALIZADO para detectar postest)
    checkUrlParamsUpdated();

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

// ==========================================
// CONFIGURACIÃ"N SEGURA (SIN CREDENCIALES)
// ==========================================

function loadConfiguration() {
    console.log('â„¹ï¸ Sistema en modo seguro - Usando Netlify Functions');
    console.log('â„¹ï¸ Credenciales en variables de entorno del servidor');
    
    // No cargamos credenciales del localStorage
    // Solo intentamos conectar a travÃ©s del proxy
    testConnection(false);
}

// ==========================================
// FUNCIONES DE AIRTABLE (VÃA PROXY SEGURO)
// ==========================================

async function airtableRequest(method, endpoint, data = null) {
    // âš ï¸ IMPORTANTE: TODAS las peticiones pasan por Netlify Functions
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
        console.error('âŒ Error en peticiÃ³n Airtable:', error.message);
        throw error;
    }
}

// ==========================================
// TEST DE CONEXIÃ"N
// ==========================================

async function testConnection(showMessage = true) {
    try {
        if (showMessage) {
            showAlert('Probando conexiÃ³n...', 'info');
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
                showAlert('âœ… ConexiÃ³n exitosa con Airtable', 'success');
            }
            
            // Inicializar dashboard despuÃ©s de conexiÃ³n exitosa
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
            showAlert(`âŒ Error de conexiÃ³n: ${error.message}`, 'error');
        }
        
        return false;
    }
}

// ==========================================
// NAVEGACIÃ"N ENTRE TABS
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
    
    // Ejecutar acciones especÃ­ficas de cada tab
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
    console.log(`ðŸ"Š Capacitaciones cargadas: ${trainings.length}`);
    // Implementar visualizaciÃ³n segÃºn necesidad
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
    
    // Usar SweetAlert2 si estÃ¡ disponible
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: type,
            title: type === 'success' ? 'Ã‰xito' : type === 'error' ? 'Error' : 'InformaciÃ³n',
            text: message,
            timer: 3000,
            showConfirmButton: false
        });
    }
}

function initializeDashboard() {
    console.log('ðŸ"Š Dashboard inicializado');
    // Implementar lÃ³gica del dashboard
}

function loadReportOptions() {
    console.log('ðŸ"ˆ Opciones de reportes cargadas');
    // Implementar lÃ³gica de reportes
}

async function accessTraining() {
    const code = document.getElementById('accessCode').value;
    if (!code) {
        showAlert('Por favor ingrese un cÃ³digo de acceso', 'error');
        return;
    }
    
    try {
        showAlert('Buscando capacitaciÃ³n...', 'info');
        // AquÃ­ irÃ­a la lÃ³gica para buscar el cÃ³digo en Airtable
        console.log('Accediendo a capacitaciÃ³n con cÃ³digo:', code);
    } catch (error) {
        showAlert('Error al acceder a la capacitaciÃ³n', 'error');
    }
}

// ==========================================
// INICIAR AL CARGAR LA PÃGINA
// ==========================================

document.addEventListener('DOMContentLoaded', initializeApp);

// ==========================================
// NOTAS DE SEGURIDAD
// ==========================================

/*
ðŸ"' SEGURIDAD EN ESTA VERSIÃ"N:

1. âœ… NO se guardan credenciales en localStorage
2. âœ… NO se envÃ­an credenciales desde el navegador
3. âœ… Todas las peticiones pasan por Netlify Functions
4. âœ… Las credenciales estÃ¡n en variables de entorno del servidor
5. âœ… ComunicaciÃ³n cliente-servidor encriptada (HTTPS)
6. âœ… El proxy verifica credenciales en el servidor
7. âœ… Si una sesiÃ³n se compromete, las credenciales no se exponen

CONFIGURACIÃ"N EN NETLIFY:

Site settings â†' Build & deploy â†' Environment

AIRTABLE_API_KEY=patXXXXXXXXXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

Estas variables NUNCA estÃ¡n en el cÃ³digo, solo en el servidor.
*/
