/* ==========================================
   SISTEMA DE CAPACITACIONES - LÓGICA PRINCIPAL
   Hospital Susana López de Valencia
   ========================================== */

// ==========================================
// VARIABLES GLOBALES
// ==========================================

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
    console.log('🚀 Iniciando Sistema de Capacitaciones...');
    
    // Ocultar pantalla de carga
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
    }, 1500);
    
    // Cargar configuración
    loadConfiguration();
    
    // Actualizar fecha y hora
    updateDateTime();
    setInterval(updateDateTime, 60000);
    
    // Verificar parámetros de URL
    checkUrlParams();
    
    // Cargar tema guardado
    loadTheme();
    
    // Inicializar dashboard si hay conexión
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
        document.getElementById('accessCode').value = code;
        switchTab('exam');
        // Intentar acceder automáticamente si hay código
        setTimeout(() => {
            if (isConnected) {
                accessTraining();
            }
        }, 2000);
    }
}

// ==========================================
// CONFIGURACIÓN Y CONEXIÓN AIRTABLE
// ==========================================

function loadConfiguration() {
    const savedToken = localStorage.getItem('airtableToken');
    const savedBaseId = localStorage.getItem('airtableBaseId');
    
    if (savedToken && savedBaseId) {
        CONFIG.AIRTABLE_TOKEN = savedToken;
        CONFIG.AIRTABLE_BASE_ID = savedBaseId;
        document.getElementById('airtableToken').value = savedToken;
        document.getElementById('airtableBaseId').value = savedBaseId;
        
        // Probar conexión automáticamente
        testConnection(false);
    } else {
        // Mostrar tab de configuración si no hay credenciales
        switchTab('settings');
        showAlert('Por favor configure las credenciales de Airtable primero', 'info');
    }
}

function saveSettings() {
    const token = document.getElementById('airtableToken').value;
    const baseId = document.getElementById('airtableBaseId').value;
    
    if (!token || !baseId) {
        showAlert('Por favor complete todos los campos', 'error');
        return;
    }
    
    CONFIG.AIRTABLE_TOKEN = token;
    CONFIG.AIRTABLE_BASE_ID = baseId;
    
    localStorage.setItem('airtableToken', token);
    localStorage.setItem('airtableBaseId', baseId);
    
    showAlert('Configuración guardada correctamente', 'success');
    testConnection();
}

async function testConnection(showMessage = true) {
    try {
        if (showMessage) {
            showAlert('Probando conexión...', 'info');
        }
        
        const response = await airtableRequest('GET', '/Capacitaciones?maxRecords=1');
        
        if (response) {
            isConnected = true;
            document.getElementById('connectionStatus').textContent = 'Conectado';
            document.getElementById('connectionStatus').className = 'badge success';
            
            if (showMessage) {
                showAlert('✅ Conexión exitosa con Airtable', 'success');
            }
            
            // Inicializar dashboard después de conexión exitosa
            initializeDashboard();
            loadTrainings();
        }
    } catch (error) {
        isConnected = false;
        document.getElementById('connectionStatus').textContent = 'Desconectado';
        document.getElementById('connectionStatus').className = 'badge danger';
        
        if (showMessage) {
            showAlert(`❌ Error de conexión: ${error.message}`, 'error');
        }
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
    document.getElementById(tabName).classList.add('active');
    
    // Ejecutar acciones específicas de cada tab
    switch(tabName) {
        case 'dashboard':
            initializeDashboard();
            break;
        case 'manage':
            loadTrainings();
            break;
        case 'reports':
            loadReportOptions();
            break;
        case 'settings':
            updateSystemInfo();
            break;
    }
}

// ==========================================
// FUNCIONES DE CREACIÓN DE CAPACITACIÓN
// ==========================================

function addQuestion(type) {
    const container = document.getElementById(type + 'Questions');
    const questionCount = container.children.length;
    
    if (questionCount >= 10) {
        showAlert('Máximo 10 preguntas por examen', 'warning');
        return;
    }
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-item';
    questionDiv.innerHTML = `
        <h4>Pregunta ${questionCount + 1}</h4>
        <button class="btn-remove" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
        <input type="text" class="${type}-question" 
               placeholder="Escriba la pregunta aquí..." required>
    `;
    
    container.appendChild(questionDiv);
    
    // Focus en el nuevo input
    questionDiv.querySelector('input').focus();
}

async function saveTraining() {
    const title = document.getElementById('trainingTitle').value;
    const description = document.getElementById('trainingDescription').value;
    const department = document.getElementById('trainingDepartment').value;
    const duration = document.getElementById('trainingDuration').value;
    
    if (!title || !department) {
        showAlert('Por favor complete los campos obligatorios', 'error');
        return;
    }
    
    const pretestQuestions = Array.from(document.querySelectorAll('.pretest-question'))
        .map(q => q.value)
        .filter(q => q);
    
    const posttestQuestions = Array.from(document.querySelectorAll('.posttest-question'))
        .map(q => q.value)
        .filter(q => q);
    
    if (pretestQuestions.length === 0 || posttestQuestions.length === 0) {
        showAlert('Debe agregar al menos una pregunta en pretest y post-test', 'error');
        return;
    }
    
    // Mostrar loading
    Swal.fire({
        title: 'Guardando capacitación...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        // Crear capacitación en Airtable
        const trainingData = {
            fields: {
                "Título": title,
                "Descripción": description,
                "Departamento": department,
                "Activa": true
            }
        };
        
        const trainingResponse = await airtableRequest('POST', '/Capacitaciones', trainingData);
        const trainingId = trainingResponse.id;
        
        // Crear preguntas de pretest
        for (let i = 0; i < pretestQuestions.length; i++) {
            const questionData = {
                fields: {
                    "Capacitación": [trainingId],
                    "Tipo": "Pretest",
                    "Número": i + 1,
                    "Pregunta": pretestQuestions[i]
                }
            };
            await airtableRequest('POST', '/Preguntas', questionData);
        }
        
        // Crear preguntas de post-test
        for (let i = 0; i < posttestQuestions.length; i++) {
            const questionData = {
                fields: {
                    "Capacitación": [trainingId],
                    "Tipo": "Post-test",
                    "Número": i + 1,
                    "Pregunta": posttestQuestions[i]
                }
            };
            await airtableRequest('POST', '/Preguntas', questionData);
        }
        
        Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: 'Capacitación creada correctamente',
            confirmButtonColor: '#667eea'
        });
        
        resetForm();
        loadTrainings();
        
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo guardar la capacitación: ' + error.message,
            confirmButtonColor: '#ef4444'
        });
    }
}

function resetForm() {
    document.getElementById('trainingForm').reset();
    document.getElementById('pretestQuestions').innerHTML = '';
    document.getElementById('posttestQuestions').innerHTML = '';
}

// ==========================================
// FUNCIONES DE GESTIÓN DE CAPACITACIONES
// ==========================================

async function loadTrainings() {
    const container = document.getElementById('trainingsList');
    container.innerHTML = `
        <div class="loading-message">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Cargando capacitaciones...</p>
        </div>
    `;
    
    try {
        const response = await airtableRequest('GET', '/Capacitaciones?filterByFormula=Activa=TRUE()');
        trainings = response.records || [];
        
        container.innerHTML = '';
        
        if (trainings.length === 0) {
            container.innerHTML = '<p class="no-data">No hay capacitaciones activas</p>';
            return;
        }
        
        for (const training of trainings) {
            // Contar sesiones relacionadas
            const sessionsResponse = await airtableRequest('GET', 
                `/Sesiones?filterByFormula=SEARCH('${training.id}', {Capacitación})`);
            const sessionCount = sessionsResponse.records ? sessionsResponse.records.length : 0;
            
            const trainingDiv = document.createElement('div');
            trainingDiv.className = 'training-item';
            trainingDiv.innerHTML = `
                <div class="training-info">
                    <h4>${training.fields['Título']}</h4>
                    <p>
                        <i class="fas fa-building"></i> ${training.fields['Departamento']} | 
                        <i class="fas fa-link"></i> ${sessionCount} sesiones
                    </p>
                </div>
                <div class="training-actions">
                    <button class="btn btn-primary" onclick="generateSession('${training.id}')">
                        <i class="fas fa-qrcode"></i> Generar QR
                    </button>
                    <button class="btn btn-info" onclick="viewTrainingDetails('${training.id}')">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                    <button class="btn btn-danger" onclick="deleteTraining('${training.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(trainingDiv);
        }
    } catch (error) {
        container.innerHTML = `<p class="text-center" style="color: red;">Error: ${error.message}</p>`;
    }
}

async function generateSession(trainingId) {
    const training = trainings.find(t => t.id === trainingId);
    const accessCode = generateAccessCode();
    const accessLink = `${window.location.origin}${window.location.pathname}?code=${accessCode}`;
    
    try {
        // Crear sesión en Airtable
        const sessionData = {
            fields: {
                "Capacitación": [trainingId],
                "Código Acceso": accessCode,
                "Link Acceso": accessLink,
                "Fecha Inicio": new Date().toISOString().split('T')[0],
                "Activa": true
            }
        };
        
        await airtableRequest('POST', '/Sesiones', sessionData);
        
        // Mostrar modal con QR
        showQRModal(accessCode, accessLink, training.fields['Título']);
        
    } catch (error) {
        showAlert('Error al generar sesión: ' + error.message, 'error');
    }
}

function generateAccessCode() {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

function showQRModal(code, link, title) {
    document.getElementById('modalAccessCode').textContent = code;
    document.getElementById('modalAccessLink').textContent = link;
    
    // Limpiar QR anterior
    document.getElementById('qrcode').innerHTML = '';
    
    // Generar nuevo QR
    new QRCode(document.getElementById('qrcode'), {
        text: link,
        width: 256,
        height: 256,
        colorDark: "#667eea",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    
    // Mostrar modal
    document.getElementById('qrModal').style.display = 'block';
    
    // Agregar título de la capacitación
    const modalTitle = document.querySelector('#qrModal h2');
    modalTitle.innerHTML = `<i class="fas fa-qrcode"></i> QR: ${title}`;
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function copyLink() {
    const link = document.getElementById('modalAccessLink').textContent;
    navigator.clipboard.writeText(link).then(() => {
        showAlert('✅ Link copiado al portapapeles', 'success');
    });
}

function shareWhatsApp() {
    const code = document.getElementById('modalAccessCode').textContent;
    const link = document.getElementById('modalAccessLink').textContent;
    const message = `
📚 *Capacitación Hospital Susana López de Valencia*
🔗 Código de acceso: ${code}
📱 Link directo: ${link}

Por favor ingrese al link o use el código para acceder a la capacitación.
    `;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
}

function downloadQR() {
    const canvas = document.querySelector('#qrcode canvas');
    const link = document.createElement('a');
    link.download = `QR_${document.getElementById('modalAccessCode').textContent}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

async function deleteTraining(trainingId) {
    const result = await Swal.fire({
        title: '¿Está seguro?',
        text: 'Esta acción desactivará la capacitación',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
        try {
            await airtableRequest('PATCH', `/Capacitaciones/${trainingId}`, {
                fields: {
                    "Activa": false
                }
            });
            
            Swal.fire('Eliminado', 'La capacitación ha sido desactivada', 'success');
            loadTrainings();
            
        } catch (error) {
            showAlert('Error al eliminar: ' + error.message, 'error');
        }
    }
}

// ==========================================
// FUNCIONES DE EXAMEN
// ==========================================

async function accessTraining() {
    const code = document.getElementById('accessCode').value;
    const name = document.getElementById('participantName').value;
    const email = document.getElementById('participantEmail').value;
    const cargo = document.getElementById('participantCargo').value;
    
    if (!code || !name || !cargo) {
        showAlert('Por favor complete todos los campos obligatorios', 'error');
        return;
    }
    
    Swal.fire({
        title: 'Validando acceso...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        // Buscar sesión por código
        const sessionResponse = await airtableRequest('GET', 
            `/Sesiones?filterByFormula=AND({Código Acceso}='${code}', Activa=TRUE())`);
        
        if (!sessionResponse.records || sessionResponse.records.length === 0) {
            throw new Error('Código inválido o sesión no activa');
        }
        
        currentSession = sessionResponse.records[0];
        
        // Obtener información de la capacitación
        const trainingId = currentSession.fields['Capacitación'][0];
        const trainingResponse = await airtableRequest('GET', `/Capacitaciones/${trainingId}`);
        currentTraining = trainingResponse;
        
        // Verificar participación existente
        const participationResponse = await airtableRequest('GET',
            `/Participaciones?filterByFormula=AND({Sesión}='${currentSession.id}', {Nombre}='${name}')`);
        
        if (participationResponse.records && participationResponse.records.length > 0) {
            currentParticipation = participationResponse.records[0];
            
            if (currentParticipation.fields['Completado']) {
                Swal.fire({
                    icon: 'info',
                    title: 'Capacitación Completada',
                    text: 'Ya has completado esta capacitación anteriormente',
                    confirmButtonColor: '#667eea'
                });
                return;
            }
            
            currentExamType = currentParticipation.fields['Pretest Score'] ? 'posttest' : 'pretest';
        } else {
            // Crear nueva participación
            const participationData = {
                fields: {
                    "Sesión": [currentSession.id],
                    "Usuario ID": 'user_' + Date.now(),
                    "Nombre": name,
                    "Email": email,
                    "Cargo": cargo,
                    "Fecha Inicio": new Date().toISOString().split('T')[0],
                    "Completado": false
                }
            };
            
            const newParticipation = await airtableRequest('POST', '/Participaciones', participationData);
            currentParticipation = newParticipation;
            currentExamType = 'pretest';
        }
        
        Swal.fire({
            icon: 'success',
            title: '¡Bienvenido!',
            text: `Acceso concedido a: ${currentTraining.fields['Título']}`,
            confirmButtonColor: '#667eea'
        }).then(() => {
            loadExam();
        });
        
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error de Acceso',
            text: error.message,
            confirmButtonColor: '#ef4444'
        });
    }
}

async function loadExam() {
    document.getElementById('examAccess').style.display = 'none';
    document.getElementById('examContent').style.display = 'block';
    
    const examTitle = document.getElementById('examTitle');
    examTitle.innerHTML = `
        <i class="fas fa-clipboard-list"></i>
        ${currentTraining.fields['Título']} - ${currentExamType === 'pretest' ? 'Evaluación Inicial' : 'Evaluación Final'}
    `;
    
    const questionsContainer = document.getElementById('examQuestions');
    questionsContainer.innerHTML = '';
    
    try {
        // Obtener preguntas del examen
        const questionsResponse = await airtableRequest('GET',
            `/Preguntas?filterByFormula=AND({Capacitación}='${currentTraining.id}', {Tipo}='${currentExamType === 'pretest' ? 'Pretest' : 'Post-test'}')&sort[0][field]=Número`);
        
        questions = questionsResponse.records || [];
        
        if (questions.length === 0) {
            throw new Error('No se encontraron preguntas para este examen');
        }
        
        questions.forEach((question, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'exam-question';
            questionDiv.innerHTML = `
                <h4>Pregunta ${index + 1} de ${questions.length}</h4>
                <p>${question.fields['Pregunta']}</p>
                <div class="rating-options">
                    ${[1,2,3,4,5].map(rating => `
                        <div class="rating-option">
                            <input type="radio" name="q${question.id}" value="${rating}" 
                                   id="q${question.id}r${rating}" data-question-id="${question.id}"
                                   onchange="updateExamProgress()">
                            <label for="q${question.id}r${rating}">
                                ${rating} - ${getRatingLabel(rating)}
                            </label>
                        </div>
                    `).join('')}
                </div>
            `;
            questionsContainer.appendChild(questionDiv);
        });
        
        updateExamProgress();
        
    } catch (error) {
        showAlert('Error al cargar el examen: ' + error.message, 'error');
    }
}

function getRatingLabel(rating) {
    const labels = {
        1: 'Totalmente en desacuerdo',
        2: 'En desacuerdo',
        3: 'Neutral',
        4: 'De acuerdo',
        5: 'Totalmente de acuerdo'
    };
    return labels[rating];
}

function updateExamProgress() {
    const totalQuestions = questions.length;
    const answeredQuestions = document.querySelectorAll('#examQuestions input[type="radio"]:checked').length;
    const progress = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
    
    const progressBar = document.getElementById('examProgress');
    progressBar.style.width = progress + '%';
    progressBar.innerHTML = `<span>${Math.round(progress)}%</span>`;
}

async function submitExam() {
    const totalQuestions = questions.length;
    const answeredQuestions = document.querySelectorAll('#examQuestions input[type="radio"]:checked').length;
    
    if (answeredQuestions < totalQuestions) {
        showAlert(`Por favor responda todas las preguntas (${answeredQuestions}/${totalQuestions})`, 'warning');
        return;
    }
    
    const result = await Swal.fire({
        title: '¿Enviar respuestas?',
        text: 'Una vez enviadas no podrá modificarlas',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#667eea',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sí, enviar',
        cancelButtonText: 'Revisar'
    });
    
    if (!result.isConfirmed) return;
    
    Swal.fire({
        title: 'Enviando respuestas...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        let totalScore = 0;
        const answers = [];
        
        // Recopilar respuestas
        questions.forEach(question => {
            const selectedOption = document.querySelector(`input[name="q${question.id}"]:checked`);
            if (selectedOption) {
                const score = parseInt(selectedOption.value);
                totalScore += score;
                answers.push({
                    questionId: question.id,
                    score: score
                });
            }
        });
        
        const averageScore = totalScore / questions.length;
        
        // Guardar respuestas en Airtable
        for (const answer of answers) {
            const answerData = {
                fields: {
                    "Participación": [currentParticipation.id],
                    "Pregunta": [answer.questionId],
                    "Calificación": answer.score
                }
            };
            await airtableRequest('POST', '/Respuestas', answerData);
        }
        
        // Actualizar participación
        const updateData = { fields: {} };
        
        if (currentExamType === 'pretest') {
            updateData.fields["Pretest Score"] = averageScore;
            
            await airtableRequest('PATCH', `/Participaciones/${currentParticipation.id}`, updateData);
            
            Swal.fire({
                icon: 'success',
                title: 'Evaluación Inicial Completada',
                html: `
                    <p>Puntuación: <strong>${averageScore.toFixed(1)}/5</strong></p>
                    <p>Ahora procederá con la capacitación y luego la evaluación final.</p>
                `,
                confirmButtonColor: '#667eea',
                confirmButtonText: 'Continuar con Post-test'
            }).then(() => {
                currentExamType = 'posttest';
                loadExam();
            });
            
        } else {
            updateData.fields["Post-test Score"] = averageScore;
            updateData.fields["Completado"] = true;
            updateData.fields["Fecha Fin"] = new Date().toISOString().split('T')[0];
            
            await airtableRequest('PATCH', `/Participaciones/${currentParticipation.id}`, updateData);
            
            const pretestScore = currentParticipation.fields["Pretest Score"];
            const improvement = ((averageScore - pretestScore) / pretestScore * 100).toFixed(1);
            
            Swal.fire({
                icon: 'success',
                title: '¡Capacitación Completada!',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Resultados:</strong></p>
                        <p>📊 Evaluación Inicial: ${pretestScore.toFixed(1)}/5</p>
                        <p>📈 Evaluación Final: ${averageScore.toFixed(1)}/5</p>
                        <p>🎯 Mejora: ${improvement > 0 ? '+' : ''}${improvement}%</p>
                    </div>
                `,
                confirmButtonColor: '#10b981',
                confirmButtonText: 'Finalizar'
            }).then(() => {
                // Resetear formulario
                document.getElementById('examContent').style.display = 'none';
                document.getElementById('examAccess').style.display = 'block';
                document.getElementById('accessForm').reset();
                currentTraining = null;
                currentSession = null;
                currentParticipation = null;
            });
        }
        
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron enviar las respuestas: ' + error.message,
            confirmButtonColor: '#ef4444'
        });
    }
}

// ==========================================
// FUNCIONES DE REPORTES
// ==========================================

async function loadReportOptions() {
    const select = document.getElementById('reportTraining');
    select.innerHTML = '<option value="">Cargando capacitaciones...</option>';
    
    try {
        const response = await airtableRequest('GET', '/Capacitaciones?filterByFormula=Activa=TRUE()');
        
        select.innerHTML = '<option value="">Seleccione una capacitación...</option>';
        
        response.records.forEach(training => {
            const option = document.createElement('option');
            option.value = training.id;
            option.textContent = training.fields['Título'];
            select.appendChild(option);
        });
        
    } catch (error) {
        select.innerHTML = '<option value="">Error al cargar capacitaciones</option>';
        console.error('Error loading report options:', error);
    }
}

async function loadReport() {
    const trainingId = document.getElementById('reportTraining').value;
    
    if (!trainingId) {
        document.getElementById('reportContent').style.display = 'none';
        return;
    }
    
    document.getElementById('reportContent').style.display = 'block';
    
    Swal.fire({
        title: 'Generando reporte...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        // Obtener sesiones de esta capacitación
        const sessionsResponse = await airtableRequest('GET',
            `/Sesiones?filterByFormula=SEARCH('${trainingId}', {Capacitación})`);
        
        const sessionIds = sessionsResponse.records.map(s => s.id);
        
        if (sessionIds.length === 0) {
            Swal.close();
            document.getElementById('resultsTableBody').innerHTML = 
                '<tr><td colspan="7" class="text-center">No hay sesiones para esta capacitación</td></tr>';
            return;
        }
        
        // Obtener participaciones
        const participationFilter = `OR(${sessionIds.map(id => `SEARCH('${id}', {Sesión})`).join(',')})`;
        const participationsResponse = await airtableRequest('GET',
            `/Participaciones?filterByFormula=${participationFilter}`);
        
        const allParticipations = participationsResponse.records || [];
        const completed = allParticipations.filter(p => p.fields['Completado']);
        
        // Calcular estadísticas
        const totalParticipants = allParticipations.length;
        const completionRate = totalParticipants > 0 ? (completed.length / totalParticipants * 100) : 0;
        
        const avgPretest = completed.length > 0 
            ? completed.reduce((sum, p) => sum + (p.fields['Pretest Score'] || 0), 0) / completed.length 
            : 0;
        
        const avgPosttest = completed.length > 0 
            ? completed.reduce((sum, p) => sum + (p.fields['Post-test Score'] || 0), 0) / completed.length 
            : 0;
        
        // Actualizar estadísticas en la UI
        document.getElementById('reportParticipants').textContent = totalParticipants;
        document.getElementById('reportCompletion').textContent = completionRate.toFixed(1) + '%';
        document.getElementById('reportAvgPre').textContent = avgPretest.toFixed(1);
        document.getElementById('reportAvgPost').textContent = avgPosttest.toFixed(1);
        
        // Actualizar gráfico
        updateReportChart(completed);
        
        // Actualizar tabla
        const tbody = document.getElementById('resultsTableBody');
        tbody.innerHTML = '';
        
        if (allParticipations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay participantes registrados</td></tr>';
        } else {
            allParticipations.forEach(p => {
                const row = tbody.insertRow();
                const pretestScore = p.fields['Pretest Score'] || 0;
                const posttestScore = p.fields['Post-test Score'] || 0;
                const improvement = posttestScore && pretestScore
                    ? ((posttestScore - pretestScore) / pretestScore * 100).toFixed(1) + '%'
                    : '-';
                
                row.innerHTML = `
                    <td>${p.fields['Nombre'] || 'Sin nombre'}</td>
                    <td>${p.fields['Cargo'] || '-'}</td>
                    <td>${p.fields['Fecha Inicio'] || '-'}</td>
                    <td>${pretestScore ? pretestScore.toFixed(1) : '-'}</td>
                    <td>${posttestScore ? posttestScore.toFixed(1) : '-'}</td>
                    <td>${improvement}</td>
                    <td>
                        <span class="badge ${p.fields['Completado'] ? 'success' : 'warning'}">
                            ${p.fields['Completado'] ? '✅ Completado' : '⏳ En proceso'}
                        </span>
                    </td>
                `;
            });
        }
        
        Swal.close();
        
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el reporte: ' + error.message,
            confirmButtonColor: '#ef4444'
        });
    }
}

function updateReportChart(completedParticipations) {
    const ctx = document.getElementById('reportChart').getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (window.reportChartInstance) {
        window.reportChartInstance.destroy();
    }
    
    const labels = completedParticipations.map((p, i) => 
        p.fields['Nombre'] || `Participante ${i + 1}`
    );
    
    const pretestScores = completedParticipations.map(p => p.fields['Pretest Score'] || 0);
    const posttestScores = completedParticipations.map(p => p.fields['Post-test Score'] || 0);
    
    window.reportChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Pretest',
                data: pretestScores,
                backgroundColor: 'rgba(102, 126, 234, 0.5)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2
            }, {
                label: 'Post-test',
                data: posttestScores,
                backgroundColor: 'rgba(16, 185, 129, 0.5)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '/5';
                        }
                    }
                }
            }
        }
    });
}

function exportReport(format) {
    if (format === 'csv') {
        exportToCSV();
    } else if (format === 'pdf') {
        exportToPDF();
    }
}

function exportToCSV() {
    const table = document.querySelector('.data-table');
    let csv = [];
    
    // Obtener encabezados
    const headers = [];
    table.querySelectorAll('thead th').forEach(th => {
        headers.push('"' + th.textContent + '"');
    });
    csv.push(headers.join(','));
    
    // Obtener datos
    table.querySelectorAll('tbody tr').forEach(row => {
        const rowData = [];
        row.querySelectorAll('td').forEach(td => {
            rowData.push('"' + td.textContent.trim() + '"');
        });
        csv.push(rowData.join(','));
    });
    
    // Crear y descargar archivo
    const csvContent = '\ufeff' + csv.join('\n'); // UTF-8 BOM
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_capacitacion_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showAlert('Reporte CSV descargado correctamente', 'success');
}

function exportToPDF() {
    // Esta función requeriría una librería adicional como jsPDF
    showAlert('La exportación a PDF estará disponible próximamente', 'info');
}

function printReport() {
    window.print();
}

// ==========================================
// FUNCIONES DE DASHBOARD
// ==========================================

async function initializeDashboard() {
    if (!isConnected) return;
    
    try {
        // Obtener capacitaciones activas
        const trainingsResponse = await airtableRequest('GET', 
            '/Capacitaciones?filterByFormula=Activa=TRUE()');
        const totalTrainings = trainingsResponse.records ? trainingsResponse.records.length : 0;
        
        // Obtener todas las participaciones
        const participationsResponse = await airtableRequest('GET', '/Participaciones');
        const allParticipations = participationsResponse.records || [];
        
        // Calcular estadísticas
        const uniqueParticipants = [...new Set(allParticipations.map(p => p.fields['Nombre']))];
        const totalParticipants = uniqueParticipants.length;
        
        const completed = allParticipations.filter(p => p.fields['Completado']);
        const adherenceRate = allParticipations.length > 0 
            ? (completed.length / allParticipations.length * 100) 
            : 0;
        
        const avgImprovement = completed.length > 0
            ? completed.reduce((sum, p) => {
                const pre = p.fields['Pretest Score'] || 0;
                const post = p.fields['Post-test Score'] || 0;
                return pre > 0 ? sum + ((post - pre) / pre * 100) : sum;
            }, 0) / completed.length
            : 0;
        
        // Actualizar UI
        document.getElementById('totalTrainings').textContent = totalTrainings;
        document.getElementById('totalParticipants').textContent = totalParticipants;
        document.getElementById('adherenceRate').textContent = adherenceRate.toFixed(1) + '%';
        document.getElementById('avgImprovement').textContent = 
            (avgImprovement > 0 ? '+' : '') + avgImprovement.toFixed(1) + '%';
        
        // Actualizar gráficos
        updateDashboardCharts(allParticipations);
        
        // Actualizar actividad reciente
        updateRecentActivity(allParticipations);
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

function updateDashboardCharts(participations) {
    // Gráfico de participaciones por día
    const ctx1 = document.getElementById('participationsChart').getContext('2d');
    
    if (window.participationsChartInstance) {
        window.participationsChartInstance.destroy();
    }
    
    // Agrupar participaciones por fecha (últimos 7 días)
    const last7Days = [];
    const participationsByDay = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last7Days.push(dateStr);
        
        const dayParticipations = participations.filter(p => 
            p.fields['Fecha Inicio'] === dateStr
        );
        participationsByDay.push(dayParticipations.length);
    }
    
    window.participationsChartInstance = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: last7Days.map(d => {
                const date = new Date(d);
                return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
            }),
            datasets: [{
                label: 'Participaciones',
                data: participationsByDay,
                borderColor: 'rgba(102, 126, 234, 1)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
    
    // Gráfico de rendimiento por departamento
    const ctx2 = document.getElementById('departmentChart').getContext('2d');
    
    if (window.departmentChartInstance) {
        window.departmentChartInstance.destroy();
    }
    
    // Aquí podrías agregar lógica para agrupar por departamento
    // Por ahora mostramos un gráfico de ejemplo
    window.departmentChartInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Enfermería', 'Medicina', 'Administración', 'Laboratorio'],
            datasets: [{
                data: [30, 25, 20, 15],
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateRecentActivity(participations) {
    const container = document.getElementById('recentActivity');
    
    // Ordenar por fecha más reciente
    const recentParticipations = participations
        .sort((a, b) => {
            const dateA = new Date(a.fields['Fecha Inicio'] || '1900-01-01');
            const dateB = new Date(b.fields['Fecha Inicio'] || '1900-01-01');
            return dateB - dateA;
        })
        .slice(0, 5);
    
    if (recentParticipations.length === 0) {
        container.innerHTML = '<p class="no-data">No hay actividad reciente</p>';
        return;
    }
    
    container.innerHTML = '';
    
    recentParticipations.forEach(p => {
        const activityDiv = document.createElement('div');
        activityDiv.className = 'activity-item';
        
        const status = p.fields['Completado'] ? '✅ Completó' : '⏳ Inició';
        const date = p.fields['Fecha Inicio'] || 'Fecha desconocida';
        
        activityDiv.innerHTML = `
            <p><strong>${p.fields['Nombre']}</strong> ${status} una capacitación</p>
            <p class="time"><i class="fas fa-clock"></i> ${date}</p>
        `;
        
        container.appendChild(activityDiv);
    });
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function showAlert(message, type = 'info') {
    const icons = {
        success: 'success',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };
    
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
    
    Toast.fire({
        icon: icons[type],
        title: message
    });
}

function toggleDarkMode() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Actualizar icono
    const icon = document.getElementById('darkModeIcon');
    icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    
    // Actualizar toggle en settings
    document.getElementById('darkModeToggle').checked = newTheme === 'dark';
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    const icon = document.getElementById('darkModeIcon');
    icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    
    document.getElementById('darkModeToggle').checked = savedTheme === 'dark';
}

function updateSystemInfo() {
    // Actualizar fecha de última actualización
    document.getElementById('lastUpdate').textContent = new Date().toLocaleString('es-CO');
    
    // Contar registros si hay conexión
    if (isConnected) {
        countRecords();
    }
}

async function countRecords() {
    try {
        const tables = ['Capacitaciones', 'Participaciones', 'Sesiones', 'Preguntas'];
        let totalRecords = 0;
        
        for (const table of tables) {
            const response = await airtableRequest('GET', `/${table}?pageSize=1`);
            // Airtable no devuelve el total, pero podemos estimarlo
            totalRecords += 10; // Estimación básica
        }
        
        document.getElementById('recordCount').textContent = totalRecords + '+';
        
    } catch (error) {
        document.getElementById('recordCount').textContent = 'Error';
    }
}

async function viewTrainingDetails(trainingId) {
    const training = trainings.find(t => t.id === trainingId);
    
    if (!training) return;
    
    try {
        // Obtener preguntas de la capacitación
        const pretestResponse = await airtableRequest('GET',
            `/Preguntas?filterByFormula=AND({Capacitación}='${trainingId}', {Tipo}='Pretest')&sort[0][field]=Número`);
        
        const posttestResponse = await airtableRequest('GET',
            `/Preguntas?filterByFormula=AND({Capacitación}='${trainingId}', {Tipo}='Post-test')&sort[0][field]=Número`);
        
        const pretestQuestions = pretestResponse.records || [];
        const posttestQuestions = posttestResponse.records || [];
        
        let detailsHTML = `
            <h3>${training.fields['Título']}</h3>
            <p><strong>Departamento:</strong> ${training.fields['Departamento']}</p>
            <p><strong>Descripción:</strong> ${training.fields['Descripción'] || 'Sin descripción'}</p>
            
            <h4>Preguntas de Pretest (${pretestQuestions.length})</h4>
            <ol>
                ${pretestQuestions.map(q => `<li>${q.fields['Pregunta']}</li>`).join('')}
            </ol>
            
            <h4>Preguntas de Post-test (${posttestQuestions.length})</h4>
            <ol>
                ${posttestQuestions.map(q => `<li>${q.fields['Pregunta']}</li>`).join('')}
            </ol>
        `;
        
        Swal.fire({
            title: 'Detalles de la Capacitación',
            html: detailsHTML,
            width: '800px',
            confirmButtonColor: '#667eea'
        });
        
    } catch (error) {
        showAlert('Error al cargar detalles: ' + error.message, 'error');
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

// Cerrar modal al hacer clic fuera
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Prevenir envío de formularios
document.addEventListener('submit', function(e) {
    e.preventDefault();
});