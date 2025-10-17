// ==========================================
// SISTEMA DE CAPACITACIONES - AIRTABLE VERSION
// ==========================================

let pretestQuestionCount = 0;
let posttestQuestionCount = 0;
let currentTrainingID = 0;
const MAX_QUESTIONS = 10;
let isConnected = false;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Establecer fecha actual en el input
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('trainingDate').value = today;
});

async function initializeApp() {
    console.log('🚀 Iniciando Sistema de Capacitaciones...');
    
    // Verificar conexión con Airtable
    await checkAirtableConnection();
    
    // Calcular próximo ID
    await updateNextTrainingID();
    
    setTimeout(() => {
        document.getElementById('loadingScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 500);
    }, 1500);

    setTimeout(() => initializeCharts(), 2000);
    
    if (isConnected) {
        loadDashboardData();
    }
}

async function checkAirtableConnection() {
    try {
        const response = await airtableRequest('GET', '/config');
        if (response && response.configured) {
            isConnected = true;
            console.log('✅ Conectado a Airtable');
            showConnectionStatus(true);
        }
    } catch (error) {
        isConnected = false;
        console.error('❌ Error de conexión:', error);
        showConnectionStatus(false);
        
        Swal.fire({
            icon: 'error',
            title: 'Error de Conexión',
            text: 'No se pudo conectar con Airtable. Verifica la configuración en Netlify.',
            confirmButtonText: 'Entendido'
        });
    }
}

function showConnectionStatus(connected) {
    const indicator = document.querySelector('.connection-indicator');
    const dot = document.querySelector('.connection-dot');
    const text = indicator.querySelector('span');
    
    if (connected) {
        indicator.style.background = 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)';
        indicator.style.borderColor = '#81c784';
        dot.style.background = '#4caf50';
        text.textContent = 'Airtable Conectado';
    } else {
        indicator.style.background = 'linear-gradient(135deg, #ffebee 0%, #fff3e0 100%)';
        indicator.style.borderColor = '#ef5350';
        dot.style.background = '#f44336';
        text.textContent = 'Airtable Desconectado';
    }
}

async function updateNextTrainingID() {
    try {
        const response = await airtableRequest('GET', `/${CONFIG.TABLES.TRAININGS}?pageSize=100&sort[0][field]=ID&sort[0][direction]=desc`);
        
        if (response.records && response.records.length > 0) {
            const lastID = response.records[0].fields[CONFIG.FIELDS.TRAININGS.ID] || 0;
            currentTrainingID = parseInt(lastID) + 1;
        } else {
            currentTrainingID = 1;
        }
        
        updateTrainingCounter();
    } catch (error) {
        console.error('Error obteniendo último ID:', error);
        currentTrainingID = 1;
        updateTrainingCounter();
    }
}

function updateTrainingCounter() {
    const counterElement = document.getElementById('trainingCounter');
    if (counterElement) {
        counterElement.textContent = String(currentTrainingID).padStart(4, '0');
    }
    const idInput = document.getElementById('trainingID');
    if (idInput) {
        idInput.value = String(currentTrainingID).padStart(4, '0');
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
    const element = document.getElementById('currentDateTime');
    if (element) {
        element.textContent = now.toLocaleDateString('es-ES', options);
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) selectedTab.classList.add('active');
    
    event.target.closest('.nav-tab').classList.add('active');
    
    if (tabName === 'create') {
        updateNextTrainingID();
    } else if (tabName === 'dashboard' && isConnected) {
        loadDashboardData();
    }
}

// ==================== FUNCIONES DE PREGUNTAS ====================

function addQuestion(type) {
    const container = document.getElementById(`${type}Questions`);
    const currentCount = type === 'pretest' ? pretestQuestionCount : posttestQuestionCount;
    
    if (currentCount >= MAX_QUESTIONS) {
        Swal.fire({
            icon: 'warning',
            title: 'Límite Alcanzado',
            text: `Solo puedes agregar hasta ${MAX_QUESTIONS} preguntas por test`,
            confirmButtonText: 'Entendido'
        });
        return;
    }
    
    if (type === 'pretest') {
        pretestQuestionCount++;
    } else {
        posttestQuestionCount++;
    }
    
    const questionNumber = currentCount + 1;
    const questionId = `${type}-q${questionNumber}`;
    
    const questionHTML = `
        <div class="question-card" id="${questionId}" data-question-number="${questionNumber}">
            <div class="question-header">
                <h4>📝 Pregunta ${questionNumber}</h4>
                <button type="button" class="btn-remove" onclick="removeQuestion('${questionId}', '${type}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
            
            <div class="form-group">
                <label><i class="fas fa-question"></i> Pregunta *</label>
                <textarea id="${questionId}-text" class="question-text" rows="2" required 
                          placeholder="Escriba la pregunta aquí..."></textarea>
            </div>
            
            <div class="form-group">
                <label><i class="fas fa-list"></i> Opciones de Respuesta</label>
                <div class="options-container">
                    <div class="option-item">
                        <input type="radio" name="${questionId}-correct" value="a" id="${questionId}-option-a" required>
                        <label for="${questionId}-option-a" class="radio-label">✓ Correcta</label>
                        <input type="text" id="${questionId}-text-a" class="option-text" placeholder="Opción A" required>
                    </div>
                    
                    <div class="option-item">
                        <input type="radio" name="${questionId}-correct" value="b" id="${questionId}-option-b">
                        <label for="${questionId}-option-b" class="radio-label">✓ Correcta</label>
                        <input type="text" id="${questionId}-text-b" class="option-text" placeholder="Opción B" required>
                    </div>
                    
                    <div class="option-item">
                        <input type="radio" name="${questionId}-correct" value="c" id="${questionId}-option-c">
                        <label for="${questionId}-option-c" class="radio-label">✓ Correcta</label>
                        <input type="text" id="${questionId}-text-c" class="option-text" placeholder="Opción C" required>
                    </div>
                    
                    <div class="option-item">
                        <input type="radio" name="${questionId}-correct" value="d" id="${questionId}-option-d">
                        <label for="${questionId}-option-d" class="radio-label">✓ Correcta</label>
                        <input type="text" id="${questionId}-text-d" class="option-text" placeholder="Opción D" required>
                    </div>
                </div>
                <small class="help-text">Marca la opción correcta</small>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', questionHTML);
    updateQuestionCounter(type);
    
    const newQuestion = document.getElementById(questionId);
    newQuestion.style.opacity = '0';
    setTimeout(() => {
        newQuestion.style.transition = 'opacity 0.3s';
        newQuestion.style.opacity = '1';
    }, 10);
}

function removeQuestion(questionId, type) {
    Swal.fire({
        title: '¿Eliminar pregunta?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            const element = document.getElementById(questionId);
            if (element) {
                element.style.transition = 'opacity 0.3s';
                element.style.opacity = '0';
                
                setTimeout(() => {
                    element.remove();
                    
                    if (type === 'pretest') {
                        pretestQuestionCount--;
                    } else {
                        posttestQuestionCount--;
                    }
                    
                    renumberQuestions(type);
                    updateQuestionCounter(type);
                }, 300);
            }
        }
    });
}

function renumberQuestions(type) {
    const container = document.getElementById(`${type}Questions`);
    const questions = container.querySelectorAll('.question-card');
    
    questions.forEach((question, index) => {
        const newNumber = index + 1;
        const header = question.querySelector('h4');
        if (header) {
            header.textContent = `📝 Pregunta ${newNumber}`;
        }
        question.setAttribute('data-question-number', newNumber);
    });
}

function updateQuestionCounter(type) {
    const container = document.getElementById(`${type}Questions`);
    const count = type === 'pretest' ? pretestQuestionCount : posttestQuestionCount;
    
    let counter = container.parentElement.querySelector('.question-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.className = 'question-counter';
        container.parentElement.insertBefore(counter, container);
    }
    
    counter.innerHTML = `
        <i class="fas fa-list-ol"></i> 
        <span>${count} de ${MAX_QUESTIONS} preguntas agregadas</span>
    `;
}

function collectQuestions(type) {
    const container = document.getElementById(`${type}Questions`);
    const questionCards = container.querySelectorAll('.question-card');
    const questions = [];
    
    for (let i = 0; i < questionCards.length; i++) {
        const card = questionCards[i];
        const questionId = card.id;
        
        const questionText = document.getElementById(`${questionId}-text`).value.trim();
        if (!questionText) {
            Swal.fire({
                icon: 'error',
                title: 'Pregunta Vacía',
                text: `Complete la pregunta ${i + 1} del ${type === 'pretest' ? 'Pretest' : 'Post-test'}`,
            });
            return null;
        }
        
        const options = {
            a: document.getElementById(`${questionId}-text-a`).value.trim(),
            b: document.getElementById(`${questionId}-text-b`).value.trim(),
            c: document.getElementById(`${questionId}-text-c`).value.trim(),
            d: document.getElementById(`${questionId}-text-d`).value.trim()
        };
        
        if (!options.a || !options.b || !options.c || !options.d) {
            Swal.fire({
                icon: 'error',
                title: 'Opciones Incompletas',
                text: `Complete todas las opciones de la pregunta ${i + 1}`,
            });
            return null;
        }
        
        const correctAnswer = document.querySelector(`input[name="${questionId}-correct"]:checked`);
        if (!correctAnswer) {
            Swal.fire({
                icon: 'error',
                title: 'Respuesta Correcta',
                text: `Seleccione la respuesta correcta para la pregunta ${i + 1}`,
            });
            return null;
        }
        
        questions.push({
            number: i + 1,
            question: questionText,
            options: options,
            correctAnswer: correctAnswer.value
        });
    }
    
    return questions;
}

// ==================== GUARDAR EN AIRTABLE ====================

async function saveTraining() {
    if (!isConnected) {
        Swal.fire({
            icon: 'error',
            title: 'Sin Conexión',
            text: 'No hay conexión con Airtable. Verifica la configuración.',
        });
        return;
    }

    const title = document.getElementById('trainingTitle').value;
    const description = document.getElementById('trainingDescription').value;
    const trainingTopics = document.getElementById('trainingTopics').value;
    const trainingDate = document.getElementById('trainingDate').value;
    const trainingInstructor = document.getElementById('trainingInstructor').value;
    const department = document.getElementById('trainingDepartment').value;
    const duration = document.getElementById('trainingDuration').value;
    
    const staffCheckboxes = document.querySelectorAll('.trainingStaff:checked');
    const selectedStaff = Array.from(staffCheckboxes).map(cb => cb.value);
    
    const methodCheckboxes = document.querySelectorAll('.trainingMethod:checked');
    const selectedMethods = Array.from(methodCheckboxes).map(cb => cb.value);
    
    const planningCheckboxes = document.querySelectorAll('.trainingPlanning:checked');
    const selectedPlanning = Array.from(planningCheckboxes).map(cb => cb.value);
    
    const processCheckboxes = document.querySelectorAll('.trainingProcess:checked');
    const selectedProcess = Array.from(processCheckboxes).map(cb => cb.value);
    
    if (!title || !department || !trainingDate || !trainingInstructor || 
        selectedStaff.length === 0 || selectedMethods.length === 0 || 
        selectedPlanning.length === 0 || selectedProcess.length === 0) {
        Swal.fire({
            icon: 'error',
            title: 'Campos Requeridos',
            text: 'Complete todos los campos obligatorios',
        });
        return;
    }
    
    if (pretestQuestionCount === 0 || posttestQuestionCount === 0) {
        Swal.fire({
            icon: 'error',
            title: 'Preguntas Requeridas',
            text: 'Agregue al menos una pregunta en cada test',
        });
        return;
    }
    
    const pretestQuestions = collectQuestions('pretest');
    if (!pretestQuestions) return;
    
    const posttestQuestions = collectQuestions('posttest');
    if (!posttestQuestions) return;
    
    const accessCode = generateAccessCode();
    
    Swal.fire({
        title: 'Guardando en Airtable...',
        html: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });
    
    try {
        // 1. Crear capacitación principal
        const trainingData = {
            fields: {
                [CONFIG.FIELDS.TRAININGS.ID]: currentTrainingID,
                [CONFIG.FIELDS.TRAININGS.TITLE]: title,
                [CONFIG.FIELDS.TRAININGS.OBJECTIVE]: description,
                [CONFIG.FIELDS.TRAININGS.TOPICS]: trainingTopics,
                [CONFIG.FIELDS.TRAININGS.DATE]: trainingDate,
                [CONFIG.FIELDS.TRAININGS.INSTRUCTOR]: trainingInstructor,
                [CONFIG.FIELDS.TRAININGS.DEPARTMENT]: department,
                [CONFIG.FIELDS.TRAININGS.DURATION]: duration,
                [CONFIG.FIELDS.TRAININGS.STAFF]: selectedStaff.join(', '),
                [CONFIG.FIELDS.TRAININGS.METHODOLOGY]: selectedMethods.join(', '),
                [CONFIG.FIELDS.TRAININGS.PLANNING]: selectedPlanning.join(', '),
                [CONFIG.FIELDS.TRAININGS.PROCESS]: selectedProcess.join(', '),
                [CONFIG.FIELDS.TRAININGS.ACCESS_CODE]: accessCode,
                [CONFIG.FIELDS.TRAININGS.STATUS]: 'Activa',
                [CONFIG.FIELDS.TRAININGS.CREATED_AT]: new Date().toISOString()
            }
        };
        
        const trainingResponse = await airtableRequest('POST', `/${CONFIG.TABLES.TRAININGS}`, trainingData);
        const trainingRecordId = trainingResponse.id;
        
        // 2. Guardar preguntas del pretest
        for (let i = 0; i < pretestQuestions.length; i++) {
            const q = pretestQuestions[i];
            const questionData = {
                fields: {
                    [CONFIG.FIELDS.QUESTIONS.TRAINING_ID]: [trainingRecordId],
                    [CONFIG.FIELDS.QUESTIONS.TYPE]: 'Pretest',
                    [CONFIG.FIELDS.QUESTIONS.NUMBER]: q.number,
                    [CONFIG.FIELDS.QUESTIONS.QUESTION]: q.question,
                    [CONFIG.FIELDS.QUESTIONS.OPTION_A]: q.options.a,
                    [CONFIG.FIELDS.QUESTIONS.OPTION_B]: q.options.b,
                    [CONFIG.FIELDS.QUESTIONS.OPTION_C]: q.options.c,
                    [CONFIG.FIELDS.QUESTIONS.OPTION_D]: q.options.d,
                    [CONFIG.FIELDS.QUESTIONS.CORRECT_ANSWER]: q.correctAnswer.toUpperCase()
                }
            };
            await airtableRequest('POST', `/${CONFIG.TABLES.QUESTIONS}`, questionData);
        }
        
        // 3. Guardar preguntas del post-test
        for (let i = 0; i < posttestQuestions.length; i++) {
            const q = posttestQuestions[i];
            const questionData = {
                fields: {
                    [CONFIG.FIELDS.QUESTIONS.TRAINING_ID]: [trainingRecordId],
                    [CONFIG.FIELDS.QUESTIONS.TYPE]: 'Posttest',
                    [CONFIG.FIELDS.QUESTIONS.NUMBER]: q.number,
                    [CONFIG.FIELDS.QUESTIONS.QUESTION]: q.question,
                    [CONFIG.FIELDS.QUESTIONS.OPTION_A]: q.options.a,
                    [CONFIG.FIELDS.QUESTIONS.OPTION_B]: q.options.b,
                    [CONFIG.FIELDS.QUESTIONS.OPTION_C]: q.options.c,
                    [CONFIG.FIELDS.QUESTIONS.OPTION_D]: q.options.d,
                    [CONFIG.FIELDS.QUESTIONS.CORRECT_ANSWER]: q.correctAnswer.toUpperCase()
                }
            };
            await airtableRequest('POST', `/${CONFIG.TABLES.QUESTIONS}`, questionData);
        }
        
        Swal.fire({
            icon: 'success',
            title: '¡Capacitación Guardada en Airtable!',
            html: `
                <div style="margin: 20px 0;">
                    <p><strong>ID Capacitación:</strong></p>
                    <h3 style="color: #00897B; margin: 5px 0;">${String(currentTrainingID).padStart(4, '0')}</h3>
                    <p style="font-size: 0.9em; color: #666; margin: 15px 0;">Código de Acceso:</p>
                    <h2 style="color: #004D40; margin: 10px 0;">${accessCode}</h2>
                    <p style="font-size: 0.9em; color: #666;">Comparte este código con los participantes</p>
                </div>
            `,
            confirmButtonText: 'Generar QR',
            showCancelButton: true,
            cancelButtonText: 'Cerrar'
        }).then((result) => {
            if (result.isConfirmed) {
                showQRCode(accessCode, title);
            }
        });
        
        resetForm();
        updateNextTrainingID();
        
    } catch (error) {
        console.error('Error guardando en Airtable:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al Guardar',
            text: 'No se pudo guardar en Airtable: ' + error.message,
        });
    }
}

function generateAccessCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function showQRCode(accessCode, title) {
    const modal = document.getElementById('qrModal');
    const qrContainer = document.getElementById('qrcode');
    
    qrContainer.innerHTML = '';
    
    const accessUrl = `${window.location.origin}?code=${accessCode}`;
    new QRCode(qrContainer, {
        text: accessUrl,
        width: 256,
        height: 256,
        colorDark: '#00897B',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
    
    document.getElementById('modalAccessCode').textContent = accessCode;
    document.getElementById('modalAccessLink').textContent = accessUrl;
    
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('qrModal').style.display = 'none';
}

function copyLink() {
    const link = document.getElementById('modalAccessLink').textContent;
    const code = document.getElementById('modalAccessCode').textContent;
    
    const text = `🏥 Acceso a Capacitación\n\nCódigo: ${code}\nLink: ${link}\n\nHospital Susana López de Valencia`;
    
    navigator.clipboard.writeText(text).then(() => {
        Swal.fire({
            icon: 'success',
            title: 'Copiado',
            text: 'Link copiado al portapapeles',
            timer: 2000,
            showConfirmButton: false
        });
    });
}

function shareWhatsApp() {
    const code = document.getElementById('modalAccessCode').textContent;
    const link = document.getElementById('modalAccessLink').textContent;
    
    const message = `🏥 *Acceso a Capacitación*\nHospital Susana López de Valencia\n\n*Código:* ${code}\n*Link:* ${link}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

function downloadQR() {
    const canvas = document.querySelector('#qrcode canvas');
    if (canvas) {
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const code = document.getElementById('modalAccessCode').textContent;
            link.download = `QR-${code}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            
            Swal.fire({
                icon: 'success',
                title: 'Descargado',
                timer: 2000,
                showConfirmButton: false
            });
        });
    }
}

function resetForm() {
    if (pretestQuestionCount > 0 || posttestQuestionCount > 0) {
        Swal.fire({
            title: '¿Limpiar Formulario?',
            text: 'Se perderán todas las preguntas',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, limpiar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                performReset();
            }
        });
    } else {
        performReset();
    }
}

function performReset() {
    document.getElementById('trainingForm').reset();
    document.getElementById('pretestQuestions').innerHTML = '';
    document.getElementById('posttestQuestions').innerHTML = '';
    pretestQuestionCount = 0;
    posttestQuestionCount = 0;
    document.querySelectorAll('.question-counter').forEach(c => c.remove());
    
    // Restaurar fecha actual
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('trainingDate').value = today;
    
    Swal.fire({
        icon: 'success',
        title: 'Formulario Limpiado',
        timer: 1500,
        showConfirmButton: false
    });
}

// ==================== DASHBOARD ====================

async function loadDashboardData() {
    try {
        const response = await airtableRequest('GET', `/${CONFIG.TABLES.TRAININGS}?filterByFormula={Estado}='Activa'`);
        
        const totalTrainings = response.records ? response.records.length : 0;
        document.getElementById('totalTrainings').textContent = totalTrainings;
        
        // Aquí puedes cargar más estadísticas de Airtable
        
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

// ==================== CHARTS ====================

let participationsChart = null;
let departmentChart = null;

function initializeCharts() {
    if (participationsChart) participationsChart.destroy();
    if (departmentChart) departmentChart.destroy();
    
    const ctx1 = document.getElementById('participationsChart');
    if (ctx1) {
        participationsChart = new Chart(ctx1.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
                datasets: [{
                    label: 'Participaciones',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#00897B',
                    backgroundColor: 'rgba(0, 137, 123, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    const ctx2 = document.getElementById('departmentChart');
    if (ctx2) {
        departmentChart = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Enfermería', 'Medicina', 'Admin', 'Lab', 'Radiología'],
                datasets: [{
                    label: 'Rendimiento',
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(0, 137, 123, 0.8)',
                        'rgba(100, 210, 80, 0.8)',
                        'rgba(217, 65, 244, 0.8)',
                        'rgba(248, 150, 30, 0.8)',
                        'rgba(52, 172, 224, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }
}