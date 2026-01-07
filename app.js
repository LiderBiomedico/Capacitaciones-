/* ==========================================
   SISTEMA DE CAPACITACIONES - VERSIÓN CON EXCEL PROFESIONAL
   Hospital Susana López de Valencia
   
   ✅ CAMBIO PRINCIPAL:
   - Función Excel profesional que genera ADERENCIA1.xlsx
   - Integración con ExcelJS para formato profesional
   
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
// FUNCIÓN EXCEL PROFESIONAL - NUEVA
// ==========================================

/**
 * Descargar reporte de adherencia en Excel profesional
 * Genera archivo exactamente como ADERENCIA1.xlsx
 */
async function downloadAdherenceReportExcel() {
  try {
    console.log('📊 Iniciando descarga de reporte Excel profesional...');
    
    // Validar que haya datos
    if (!currentTraining || !sessions.length) {
      alert('❌ No hay datos para descargar. Selecciona una capacitación primero.');
      return;
    }

    // Recopilar datos de participantes
    const participantsData = [];
    
    for (const session of sessions) {
      for (const participation of session.participations) {
        participantsData.push({
          trainingName: currentTraining.name,
          sessionCode: session.code,
          participantName: participation.name,
          department: participation.department,
          email: participation.email,
          pretestDate: participation.pretestDate || '',
          pretestScore: participation.pretestScore || 0,
          posttestDate: participation.posttestDate || '',
          posttestScore: participation.posttestScore || 0,
          passed: participation.posttestScore >= 70
        });
      }
    }

    // Enviar a función Netlify
    const response = await fetch('/.netlify/functions/generate-report-excel-profesional', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trainingName: currentTraining.name,
        trainingDate: new Date().toLocaleDateString('es-CO'),
        participants: participantsData
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Descargar archivo
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Informe-Adherencia-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    console.log('✅ Reporte descargado exitosamente');
    alert('✅ Reporte descargado exitosamente en formato Excel profesional');

  } catch (error) {
    console.error('❌ Error descargando reporte:', error);
    alert(`❌ Error: ${error.message}`);
  }
}

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

    console.log('✅ Link de postest generado:', data.posttestLink);
    return data.posttestLink;

  } catch (error) {
    console.error('❌ Error generando link de postest:', error);
    throw error;
  }
}

// ==========================================
// FUNCIONES DE CONECTIVIDAD
// ==========================================

/**
 * Verificar conexión con Airtable
 */
async function checkConnection() {
  try {
    const response = await fetch('/.netlify/functions/airtable-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping' })
    });

    isConnected = response.ok;
    updateConnectionStatus();
    return isConnected;
  } catch (error) {
    console.error('Error checking connection:', error);
    isConnected = false;
    updateConnectionStatus();
    return false;
  }
}

/**
 * Actualizar estado de conexión en UI
 */
function updateConnectionStatus() {
  const statusIndicator = document.getElementById('connectionStatus');
  if (statusIndicator) {
    if (isConnected) {
      statusIndicator.textContent = '🟢 Conectado';
      statusIndicator.style.color = 'green';
    } else {
      statusIndicator.textContent = '🔴 Desconectado';
      statusIndicator.style.color = 'red';
    }
  }
}

// ==========================================
// FUNCIONES DE CAPACITACIONES
// ==========================================

/**
 * Cargar lista de capacitaciones desde Airtable
 */
async function loadTrainings() {
  try {
    console.log('📚 Cargando capacitaciones...');
    
    const response = await fetch('/.netlify/functions/airtable-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getTrainings'
      })
    });

    const data = await response.json();
    trainings = data.records || [];
    populateTrainingSelect();
    console.log(`✅ ${trainings.length} capacitaciones cargadas`);
  } catch (error) {
    console.error('Error loading trainings:', error);
  }
}

/**
 * Llenar selector de capacitaciones
 */
function populateTrainingSelect() {
  const select = document.getElementById('trainingSelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- Selecciona una capacitación --</option>';
  
  trainings.forEach(training => {
    const option = document.createElement('option');
    option.value = training.id;
    option.textContent = training.fields.name;
    select.appendChild(option);
  });
}

/**
 * Seleccionar capacitación y cargar datos
 */
async function selectTraining(trainingId) {
  if (!trainingId) {
    currentTraining = null;
    sessions = [];
    participations = [];
    return;
  }

  currentTraining = trainings.find(t => t.id === trainingId);
  await loadSessions(trainingId);
}

/**
 * Cargar sesiones de una capacitación
 */
async function loadSessions(trainingId) {
  try {
    console.log('📅 Cargando sesiones...');
    
    const response = await fetch('/.netlify/functions/airtable-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getSessions',
        trainingId: trainingId
      })
    });

    const data = await response.json();
    sessions = data.records || [];
    
    // Cargar participantes para cada sesión
    for (const session of sessions) {
      await loadSessionParticipants(session.id);
    }
    
    console.log(`✅ ${sessions.length} sesiones cargadas`);
  } catch (error) {
    console.error('Error loading sessions:', error);
  }
}

/**
 * Cargar participantes de una sesión
 */
async function loadSessionParticipants(sessionId) {
  try {
    const response = await fetch('/.netlify/functions/airtable-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getSessionParticipants',
        sessionId: sessionId
      })
    });

    const data = await response.json();
    const session = sessions.find(s => s.id === sessionId);
    
    if (session) {
      session.participations = data.records || [];
    }
  } catch (error) {
    console.error('Error loading participants:', error);
  }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

/**
 * Inicializar aplicación al cargar
 */
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 Iniciando Sistema de Capacitaciones...');
  
  // Verificar conexión
  await checkConnection();
  
  // Cargar capacitaciones
  await loadTrainings();
  
  // Configurar listeners
  const trainingSelect = document.getElementById('trainingSelect');
  if (trainingSelect) {
    trainingSelect.addEventListener('change', (e) => {
      selectTraining(e.target.value);
    });
  }

  const exportButton = document.getElementById('exportExcelBtn');
  if (exportButton) {
    exportButton.addEventListener('click', downloadAdherenceReportExcel);
  }

  console.log('✅ Sistema listo');
});

/**
 * Manejo de errores global
 */
window.addEventListener('error', (event) => {
  console.error('❌ Error global:', event.error);
});
