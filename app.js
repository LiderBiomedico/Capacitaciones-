/* ==========================================
   SISTEMA DE CAPACITACIONES - VERSIÓN SEGURA
   Hospital Susana López de Valencia
   ========================================== */

/* ---------- Variables globales ---------- */
let currentTraining = null;
let currentSession = null;
let currentExamType = 'pretest';

let trainings = [];
let sessions = [];
let questions = [];

let isConnected = false;

// builder preguntas
let pretestQuestionCount = 0;
let posttestQuestionCount = 0;
const MAX_QUESTIONS = 10;

let qrcode = null;

/* ==========================================
   INICIALIZACIÓN
   ========================================== */

function initializeApp() {
    console.log('🚀 Iniciando Sistema de Capacitaciones (Versión Segura).');
    console.log('🔒 Modo: Netlify Functions - Credenciales en servidor');

    // Ocultar pantalla de carga
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) loadingScreen.classList.add('hidden');
    }, 1500);

    // Fecha/Hora en header
    updateDateTime();
    setInterval(updateDateTime, 60000);

    // Leer ?code= de la URL
    checkUrlParams();

    // Configuración segura / prueba de conexión
    loadConfiguration();

    // Preparar charts vacíos
    initializeCharts();
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
        if (isConnected) {
            accessTraining();
        }
    }
}

/* ==========================================
   CONFIGURACIÓN SEGURA (SIN CREDENCIALES)
   ========================================== */

function loadConfiguration() {
    console.log('ℹ️ Sistema en modo seguro - usando Netlify Functions');
    console.log('ℹ️ Credenciales NO están en el navegador');

    // Intentar conectar Airtable vía proxy
    testConnection(false);
}

/* ==========================================
   PETICIONES A AIRTABLE VÍA PROXY
   ========================================== */

async function airtableRequest(method, endpoint, data = null) {
    // IMPORTANTE:
    // TODAS las peticiones pasan por /.netlify/functions/airtable-proxy
    // Ese proxy agrega las credenciales del servidor y hace la llamada real a Airtable.
    try {
        const response = await fetch('/.netlify/functions/airtable-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

/* ==========================================
   TEST DE CONEXIÓN
   ========================================== */

async function testConnection(showMessage = true) {
    const dot = document.getElementById('connectionDot');
    const statusEl = document.getElementById('connectionStatus');
    const indicator = document.getElementById('connectionIndicator');

    // Estado "probando"
    if (dot) {
        dot.style.background = '#f59e0b';
        dot.style.boxShadow = '0 0 6px #f59e0b';
    }
    if (statusEl) {
        statusEl.textContent = 'Probando...';
        statusEl.className = 'badge';
    }

    try {
        if (showMessage) {
            showAlert('Probando conexión con Airtable', 'info');
        }

        const response = await airtableRequest('GET', '/Capacitaciones?maxRecords=1');

        if (response) {
            isConnected = true;

            if (statusEl) {
                statusEl.textContent = 'Conectado';
                statusEl.className = 'badge success';
            }
            if (indicator) {
                indicator.classList.add('connected');
            }
            if (dot) {
                dot.style.background = '#10b981';
                dot.style.boxShadow = '0 0 6px #10b981';
            }

            if (showMessage) {
                showAlert('✅ Conexión exitosa con Airtable', 'success');
            }

            // cargar dashboard y listado de capacitaciones
            initializeDashboard();
            loadTrainings();
            return true;
        }
    } catch (error) {
        isConnected = false;

        if (statusEl) {
            statusEl.textContent = 'Desconectado';
            statusEl.className = 'badge danger';
        }
        if (indicator) {
            indicator.classList.remove('connected');
        }
        if (dot) {
            dot.style.background = '#ef4444';
            dot.style.boxShadow = '0 0 6px #ef4444';
        }

        if (showMessage) {
            showAlert(`❌ Error de conexión: ${error.message}`, 'error');
        }
        return false;
    }
}

/* ==========================================
   NAVEGACIÓN ENTRE TABS
   ========================================== */

function switchTab(tabName) {
    // Tabs activos (botones)
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        }
    });

    // Contenido visible
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const tabContent = document.getElementById(tabName);
    if (tabContent) tabContent.classList.add('active');

    // Acciones cuando entro a cada tab
    switch (tabName) {
        case 'dashboard':
            initializeDashboard();
            break;
        case 'manage':
            if (isConnected) loadTrainings();
            break;
        case 'reports':
            loadReportOptions();
            break;
        default:
            break;
    }
}

/* ==========================================
   DASHBOARD / REPORTES
   ========================================== */

function initializeDashboard() {
    // Aquí puedes usar trainings / participations reales
    // Para ahora actualizamos métricas básicas:
    document.getElementById('totalTrainings').textContent = trainings.length || 0;
    // Las demás métricas son placeholder hasta que tengamos Participaciones reales:
    document.getElementById('totalParticipants').textContent = 0;
    document.getElementById('adherenceRate').textContent = '0%';
    document.getElementById('improvementRate').textContent = '0%';

    initializeCharts();
}

function loadReportOptions() {
    // Espacio para futura exportación PDF, CSV, etc.
    console.log('📈 Reportes / opciones de exporte');
}

/* ==========================================
   GRÁFICAS (Chart.js)
   ========================================== */

function initializeCharts() {
    const departmentsCanvas = document.getElementById('departmentsChart');
    const participationsCanvas = document.getElementById('participationsChart');

    if (departmentsCanvas && !departmentsCanvas.dataset.initialized) {
        departmentsCanvas.dataset.initialized = '1';
        new Chart(departmentsCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Urgencias', 'UCI', 'Quirófano', 'Biomed', 'Adm.'],
                datasets: [{
                    label: 'Participantes',
                    data: [5, 10, 7, 3, 4]
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    }

    if (participationsCanvas && !participationsCanvas.dataset.initialized) {
        participationsCanvas.dataset.initialized = '1';
        new Chart(participationsCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
                datasets: [{
                    label: 'Participaciones',
                    data: [2, 4, 6, 3, 5]
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    }
}

/* ==========================================
   CARGA DE CAPACITACIONES (GESTIONAR TAB)
   ========================================== */

async function loadTrainings() {
    try {
        const response = await airtableRequest('GET', '/Capacitaciones');
        if (response && response.records) {
            trainings = response.records;
            renderTrainingTable();
            initializeDashboard();
        }
    } catch (error) {
        console.error('Error cargando capacitaciones:', error);
        showAlert('Error al cargar capacitaciones', 'error');
    }
}

function renderTrainingTable() {
    const tbody = document.getElementById('manageTableBody');
    if (!tbody) return;

    if (!trainings.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No hay capacitaciones registradas</td>
            </tr>`;
        return;
    }

    tbody.innerHTML = trainings.map(rec => {
        const f = rec.fields || {};

        const titulo = f['Título'] || '(Sin título)';
        const depto = f['Departamento'] || '-';
        const fecha = f['Fecha Programada'] || f['Fecha Creación'] || '-';
        const personal = f['Personal Objetivo'] || '';
        const codigo = f['Código Acceso'] || '—';
        const activa = f['Activa'] ? 'Activa' : 'Inactiva';
        const badgeClass = f['Activa'] ? 'success' : 'danger';

        return `
            <tr>
                <td><strong>${titulo}</strong><br/><small>${f['Descripción'] || ''}</small></td>
                <td>${depto}</td>
                <td>${fecha}</td>
                <td>${personal}</td>
                <td><code>${codigo}</code></td>
                <td><span class="badge ${badgeClass}">${activa}</span></td>
                <td>
                    <button class="btn btn-info" type="button"
                        onclick="openQRFromRecord('${rec.id}', '${codigo}')">
                        <i class="fas fa-qrcode"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/* ==========================================
   BUILDER DE PREGUNTAS (PRETEST / POST-TEST)
   ========================================== */

function addQuestion(type) {
    if (type !== 'pretest' && type !== 'posttest') return;

    if (type === 'pretest' && pretestQuestionCount >= MAX_QUESTIONS) {
        showAlert('Máximo de preguntas de pretest alcanzado', 'warning');
        return;
    }
    if (type === 'posttest' && posttestQuestionCount >= MAX_QUESTIONS) {
        showAlert('Máximo de preguntas de post-test alcanzado', 'warning');
        return;
    }

    if (type === 'pretest') {
        pretestQuestionCount++;
    } else {
        posttestQuestionCount++;
    }

    const containerId = type === 'pretest' ? 'pretestQuestions' : 'posttestQuestions';
    const container = document.getElementById(containerId);

    const number = type === 'pretest' ? pretestQuestionCount : posttestQuestionCount;
    const questionId = `${type}-q-${number}`;

    const html = `
        <div class="question-item" id="${questionId}">
            <button class="btn-remove" onclick="removeQuestion('${questionId}','${type}')">
                <i class="fas fa-times"></i>
            </button>
            <h4>${type === 'pretest' ? 'Pretest' : 'Post-test'} Pregunta ${number}</h4>

            <div class="form-group">
                <label>Pregunta</label>
                <input type="text" class="question-text" placeholder="Escribe la pregunta" />
            </div>

            <div class="form-group">
                <label>Tipo de respuesta</label>
                <select class="question-type">
                    <option value="1-5">Escala 1 a 5</option>
                    <option value="texto">Respuesta abierta</option>
                </select>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
    renumberQuestions(type);
}

function removeQuestion(id, type) {
    const el = document.getElementById(id);
    if (el) el.remove();

    renumberQuestions(type);
}

function renumberQuestions(type) {
    const container = document.getElementById(
        type === 'pretest' ? 'pretestQuestions' : 'posttestQuestions'
    );

    const items = [...container.querySelectorAll('.question-item')];
    items.forEach((item, index) => {
        const title = item.querySelector('h4');
        if (title) {
            title.textContent = `${type === 'pretest' ? 'Pretest' : 'Post-test'} Pregunta ${index + 1}`;
        }
    });

    if (type === 'pretest') {
        pretestQuestionCount = items.length;
    } else {
        posttestQuestionCount = items.length;
    }
}

function collectQuestions(type) {
    const container = document.getElementById(
        type === 'pretest' ? 'pretestQuestions' : 'posttestQuestions'
    );
    if (!container) return [];

    const items = [...container.querySelectorAll('.question-item')];
    return items.map((item, idx) => {
        return {
            number: idx + 1,
            text: item.querySelector('.question-text')?.value?.trim() || '',
            answerType: item.querySelector('.question-type')?.value || '1-5',
            kind: type === 'pretest' ? 'Pretest' : 'Post-test'
        };
    }).filter(q => q.text !== '');
}

/* ==========================================
   GUARDAR CAPACITACIÓN COMPLETA EN AIRTABLE
   ========================================== */

async function saveTraining() {
    if (!isConnected) {
        showAlert('No hay conexión con Airtable. Verifique conexión.', 'error');
        return;
    }

    // 1. Recolectar datos básicos
    const title = document.getElementById('trainingTitle').value.trim();
    const description = document.getElementById('trainingDescription').value.trim();
    const department = document.getElementById('trainingDepartment').value.trim();
    const trainingDate = document.getElementById('trainingDate').value;
    const duration = document.getElementById('trainingDuration').value;
    const staff = [...document.querySelectorAll('.trainingStaff:checked')].map(cb => cb.value);

    // Validaciones mínimas
    if (!title) {
        showAlert('Ingrese un título de capacitación', 'error');
        return;
    }
    if (!department) {
        showAlert('Seleccione el departamento responsable', 'error');
        return;
    }

    // 2. Recolectar preguntas
    const preQuestions = collectQuestions('pretest');
    const postQuestions = collectQuestions('posttest');

    // 3. Generar código único de acceso y link
    const accessCode = generateAccessCode();
    const accessLink = `${window.location.origin}?code=${accessCode}`;

    try {
        showAlert('Guardando capacitación...', 'info');

        // 4. Crear registro en "Capacitaciones"
        const trainingPayload = {
            records: [{
                fields: {
                    'Título': title,
                    'Descripción': description,
                    'Departamento': department,
                    'Fecha Programada': trainingDate || '',
                    'Duración (min)': duration || '',
                    'Personal Objetivo': staff.join(', '),
                    'Código Acceso': accessCode,
                    'Activa': true
                }
            }]
        };

        const createdTraining = await airtableRequest('POST', '/Capacitaciones', trainingPayload);
        const newTrainingRecord = createdTraining.records && createdTraining.records[0];
        if (!newTrainingRecord) throw new Error('No se pudo crear la capacitación');

        const trainingId = newTrainingRecord.id;
        currentTraining = newTrainingRecord;

        // 5. Crear registro de sesión en "Sesiones"
        const sessionPayload = {
            records: [{
                fields: {
                    'Capacitación': [trainingId],
                    'Código Acceso': accessCode,
                    'Link Acceso': accessLink,
                    'Fecha Inicio': trainingDate || new Date().toISOString().split('T')[0],
                    'Activa': true
                }
            }]
        };
        const createdSession = await airtableRequest('POST', '/Sesiones', sessionPayload);
        currentSession = createdSession.records && createdSession.records[0] || null;

        // 6. Crear preguntas en "Preguntas"
        const questionRecords = [];
        preQuestions.forEach(q => {
            questionRecords.push({
                fields: {
                    'Capacitación': [trainingId],
                    'Tipo': 'Pretest',
                    'Número': q.number,
                    'Pregunta': q.text
                }
            });
        });
        postQuestions.forEach(q => {
            questionRecords.push({
                fields: {
                    'Capacitación': [trainingId],
                    'Tipo': 'Post-test',
                    'Número': q.number,
                    'Pregunta': q.text
                }
            });
        });

        if (questionRecords.length) {
            await airtableRequest('POST', '/Preguntas', { records: questionRecords });
        }

        // 7. Actualizar tabla local y UI
        trainings.push(newTrainingRecord);
        renderTrainingTable();
        initializeDashboard();

        // 8. Mostrar QR modal
        openModal(newTrainingRecord, accessCode, accessLink);

        // 9. Limpiar formulario
        resetForm();

        showAlert('✅ Capacitación guardada correctamente', 'success');

    } catch (err) {
        console.error('Error guardando capacitación:', err);
        showAlert(`Error al guardar capacitación: ${err.message}`, 'error');
    }
}

/* ==========================================
   LIMPIAR FORMULARIO DESPUÉS DE GUARDAR
   ========================================== */

function resetForm() {
    document.getElementById('trainingTitle').value = '';
    document.getElementById('trainingDescription').value = '';
    document.getElementById('trainingDepartment').value = '';
    document.getElementById('trainingDate').value = '';
    document.getElementById('trainingDuration').value = '';
    document.querySelectorAll('.trainingStaff:checked').forEach(cb => cb.checked = false);

    // limpiar preguntas
    document.getElementById('pretestQuestions').innerHTML = '';
    document.getElementById('posttestQuestions').innerHTML = '';
    pretestQuestionCount = 0;
    posttestQuestionCount = 0;
}

/* ==========================================
   ACCESO PARTICIPANTE (EXAM TAB)
   ========================================== */

async function accessTraining() {
    const code = document.getElementById('accessCode').value.trim();
    if (!code) {
        showAlert('Por favor ingrese un código de acceso', 'error');
        return;
    }

    try {
        showAlert('Buscando capacitación...', 'info');
        // Aquí se podría consultar Airtable Sesiones filtrando por Código Acceso
        console.log('Accediendo con código:', code);

        // Por ahora solo mostramos que se recibió el código
        Swal.fire({
            icon: 'success',
            title: 'Código recibido',
            text: `Código ${code} ingresado. (Lógica de flujo de participante pendiente)`
        });

    } catch (error) {
        showAlert('Error al acceder a la capacitación', 'error');
    }
}

/* ==========================================
   MODAL QR / UTILIDADES
   ========================================== */

function generateAccessCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
}

function openModal(trainingRecord, accessCode, accessLink) {
    const modal = document.getElementById('qrModal');
    if (!modal) return;

    const titleEl = document.getElementById('modalTrainingTitle');
    const codeEl  = document.getElementById('modalAccessCode');
    const linkEl  = document.getElementById('modalAccessLink');
    const qrBox   = document.getElementById('qrcode');

    const title = trainingRecord?.fields?.['Título'] || '(Sin título)';
    if (titleEl) titleEl.textContent = title;
    if (codeEl)  codeEl.textContent  = accessCode || trainingRecord?.fields?.['Código Acceso'] || '';
    if (linkEl)  linkEl.textContent  = accessLink || window.location.origin;

    // Generar QR
    if (qrBox) {
        qrBox.innerHTML = '';
        qrcode = new QRCode(qrBox, {
            text: accessLink || window.location.href,
            width: 200,
            height: 200
        });
    }

    modal.style.display = 'block';
}

function openQRFromRecord(recordId, code) {
    // Buscar la capacitación correspondiente en trainings[]
    const record = trainings.find(r => r.id === recordId);
    const accessCode = code || (record?.fields?.['Código Acceso'] || '');
    const accessLink = `${window.location.origin}?code=${accessCode}`;
    openModal(record, accessCode, accessLink);
}

function closeModal() {
    const modal = document.getElementById('qrModal');
    if (modal) modal.style.display = 'none';
}

function copyLink() {
    const linkEl = document.getElementById('modalAccessLink');
    if (!linkEl) return;
    const text = linkEl.textContent.trim();

    navigator.clipboard.writeText(text).then(() => {
        showAlert('Link copiado al portapapeles', 'success');
    }).catch(() => {
        showAlert('No se pudo copiar el link', 'error');
    });
}

/* ==========================================
   UTILIDAD DE ALERTA (SweetAlert2)
   ========================================== */

function showAlert(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: type,
            title: type === 'success' ? 'Éxito' :
                   type === 'error'   ? 'Error' :
                   type === 'warning' ? 'Atención' : 'Información',
            text: message,
            timer: 3000,
            showConfirmButton: false
        });
    }
}

/* ==========================================
   INICIAR AL CARGAR LA PÁGINA
   ========================================== */

document.addEventListener('DOMContentLoaded', initializeApp);

/* ==========================================
   NOTA DE SEGURIDAD
   ==========================================

   - NO se guardan credenciales en el navegador.
   - TODAS las llamadas a Airtable pasan por /.netlify/functions/airtable-proxy
     (ver airtable-proxy.js).
   - Las variables AIRTABLE_API_KEY y AIRTABLE_BASE_ID viven SOLO en el servidor.

*/
