/* ==========================================
   SISTEMA DE CAPACITACIONES - VERSIÓN CON AIRTABLE
   Hospital Susana López de Valencia
   
   ⚠️ SEGURIDAD:
   - NO guarda credenciales en localStorage
   - Todas las peticiones pasan por Netlify Functions
   - Las credenciales están en variables de entorno del servidor
   ========================================== */

// Variables globales
let pretestQuestionCount = 0;
let posttestQuestionCount = 0;
const MAX_QUESTIONS = 10;
let airtableConnected = false;
let connectionCheckInterval = null;

// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

function initializeApp() {
    setTimeout(() => {
        document.getElementById('loadingScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 500);
    }, 1500);

    setTimeout(() => initializeCharts(), 2000);
    
    // Verificar conexión con Airtable
    testAirtableConnection();
    
    // Verificar conexión cada 30 segundos
    if (connectionCheckInterval) clearInterval(connectionCheckInterval);
    connectionCheckInterval = setInterval(() => {
        testAirtableConnection();
    }, 30000);
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

// ==========================================
// NAVEGACIÓN
// ==========================================

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
}

// ==========================================
// CONEXIÓN AIRTABLE (VÍA NETLIFY PROXY)
// ==========================================

async function airtableRequest(method, path, body = null) {
    try {
        const response = await fetch('/.netlify/functions/airtable-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                method: method,
                path: path,
                body: body
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

function updateConnectionIndicator(status) {
    const indicator = document.getElementById('connectionIndicator');
    const text = document.getElementById('connectionText');
    
    if (!indicator) return;
    
    indicator.classList.remove('connected', 'disconnected', 'checking');
    
    switch(status) {
        case 'connected':
            indicator.classList.add('connected');
            text.textContent = '✓ Airtable Conectado';
            airtableConnected = true;
            break;
        case 'disconnected':
            indicator.classList.add('disconnected');
            text.textContent = '✗ Airtable Desconectado';
            airtableConnected = false;
            break;
        case 'checking':
            indicator.classList.add('checking');
            text.textContent = '⟳ Verificando...';
            break;
    }
}

async function testAirtableConnection() {
    try {
        updateConnectionIndicator('checking');
        
        const response = await airtableRequest('GET', '/Capacitaciones?maxRecords=1');
        
        if (response) {
            updateConnectionIndicator('connected');
            console.log('✅ Conexión exitosa con Airtable');
            return true;
        }
    } catch (error) {
        updateConnectionIndicator('disconnected');
        console.error('❌ Error de conexión:', error.message);
        return false;
    }
}

// ==========================================
// FUNCIONES DE PREGUNTAS
// ==========================================

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
    
    // Animación
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

// ==========================================
// GUARDAR CAPACITACIÓN EN AIRTABLE
// ==========================================

async function saveTraining() {
    // Verificar conexión
    if (!airtableConnected) {
        Swal.fire({
            icon: 'error',
            title: 'Sin Conexión',
            text: 'No hay conexión con Airtable. Verifica la configuración.',
        });
        return;
    }
    
    // Recolectar datos del formulario
    const title = document.getElementById('trainingTitle').value.trim();
    const description = document.getElementById('trainingDescription').value.trim();
    const trainingDate = document.getElementById('trainingDate').value;
    const department = document.getElementById('trainingDepartment').value;
    const duration = document.getElementById('trainingDuration').value.trim();
    
    // Obtener personal capacitado seleccionado
    const staffCheckboxes = document.querySelectorAll('.trainingStaff:checked');
    const selectedStaff = Array.from(staffCheckboxes).map(cb => cb.value);
    
    // Validaciones
    if (!title || !department || !trainingDate || selectedStaff.length === 0) {
        Swal.fire({
            icon: 'error',
            title: 'Campos Requeridos',
            text: 'Complete todos los campos obligatorios, incluyendo fecha y personal capacitado',
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
    
    // Generar código de acceso
    const accessCode = generateAccessCode();
    const accessUrl = `${window.location.origin}${window.location.pathname}?code=${accessCode}`;
    
    // Mostrar loading
    Swal.fire({
        title: 'Guardando en Airtable...',
        html: 'Por favor espera mientras se guardan los datos',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });
    
    try {
        // 1. Crear el registro de Capacitación
        console.log('📝 Creando capacitación en Airtable...');
        const trainingResponse = await airtableRequest('POST', '/Capacitaciones', {
            records: [{
                fields: {
                    'Título': title,
                    'Descripción': description || '',
                    'Departamento': department,
                    'Duración': duration || '',
                    'Personal Capacitado': selectedStaff.join(', '),
                    'Fecha Creación': trainingDate,
                    'Activa': true,
                    'Fecha Creación Sistema': new Date().toISOString()
                }
            }]
        });
        
        const trainingRecordId = trainingResponse.records[0].id;
        console.log('✅ Capacitación creada:', trainingRecordId);
        
        // 2. Crear la sesión con código de acceso
        console.log('🔐 Creando sesión...');
        const sessionResponse = await airtableRequest('POST', '/Sesiones', {
            records: [{
                fields: {
                    'Capacitación': [trainingRecordId],
                    'Código Acceso': accessCode,
                    'Link Acceso': accessUrl,
                    'Fecha Inicio': new Date().toISOString(),
                    'Activa': true
                }
            }]
        });
        
        const sessionRecordId = sessionResponse.records[0].id;
        console.log('✅ Sesión creada:', sessionRecordId);
        
        // 3. Guardar preguntas del Pretest
        console.log('❓ Guardando preguntas de Pretest...');
        const pretestRecords = pretestQuestions.map(q => ({
            fields: {
                'Capacitación': [trainingRecordId],
                'Tipo': 'Pretest',
                'Número': q.number,
                'Pregunta': q.question,
                'Opción A': q.options.a,
                'Opción B': q.options.b,
                'Opción C': q.options.c,
                'Opción D': q.options.d,
                'Respuesta Correcta': q.correctAnswer.toUpperCase()
            }
        }));
        
        // Airtable permite máximo 10 registros por request
        await airtableRequest('POST', '/Preguntas', {
            records: pretestRecords
        });
        console.log(`✅ ${pretestQuestions.length} preguntas de Pretest guardadas`);
        
        // 4. Guardar preguntas del Post-test
        console.log('✅ Guardando preguntas de Post-test...');
        const posttestRecords = posttestQuestions.map(q => ({
            fields: {
                'Capacitación': [trainingRecordId],
                'Tipo': 'Post-test',
                'Número': q.number,
                'Pregunta': q.question,
                'Opción A': q.options.a,
                'Opción B': q.options.b,
                'Opción C': q.options.c,
                'Opción D': q.options.d,
                'Respuesta Correcta': q.correctAnswer.toUpperCase()
            }
        }));
        
        await airtableRequest('POST', '/Preguntas', {
            records: posttestRecords
        });
        console.log(`✅ ${posttestQuestions.length} preguntas de Post-test guardadas`);
        
        // 5. Mostrar éxito
        Swal.fire({
            icon: 'success',
            title: '¡Capacitación Guardada en Airtable!',
            html: `
                <div style="margin: 20px 0;">
                    <p><strong>Título:</strong> ${title}</p>
                    <p><strong>Departamento:</strong> ${department}</p>
                    <p style="margin-top: 15px;">Código de Acceso:</p>
                    <h2 style="color: #667eea; margin: 10px 0;">${accessCode}</h2>
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
        
        // Limpiar formulario
        resetForm();
        
    } catch (error) {
        console.error('❌ Error guardando en Airtable:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al Guardar',
            html: `
                <p>No se pudo guardar la capacitación en Airtable</p>
                <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    Error: ${error.message}
                </p>
                <p style="font-size: 0.85em; color: #999; margin-top: 10px;">
                    Verifica las credenciales en Netlify y la estructura de las tablas en Airtable
                </p>
            `,
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

// ==========================================
// CÓDIGO QR Y COMPARTIR
// ==========================================

function showQRCode(accessCode, title) {
    const modal = document.getElementById('qrModal');
    const qrContainer = document.getElementById('qrcode');
    
    qrContainer.innerHTML = '';
    
    const accessUrl = `${window.location.origin}${window.location.pathname}?code=${accessCode}`;
    new QRCode(qrContainer, {
        text: accessUrl,
        width: 256,
        height: 256,
        colorDark: '#667eea',
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

// ==========================================
// LIMPIAR FORMULARIO
// ==========================================

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
    
    Swal.fire({
        icon: 'success',
        title: 'Formulario Limpiado',
        timer: 1500,
        showConfirmButton: false
    });
}

// ==========================================
// GRÁFICOS
// ==========================================

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
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
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
                        'rgba(102, 126, 234, 0.8)',
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

// Limpiar intervalo al descargar
window.addEventListener('beforeunload', () => {
    if (connectionCheckInterval) clearInterval(connectionCheckInterval);
});