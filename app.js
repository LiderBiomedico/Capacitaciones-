/* ==========================================
   SISTEMA DE CAPACITACIONES - HSLV
   Integración segura con Airtable vía Netlify Functions
   ========================================== */

// Estado global
let pretestQuestionCount = 0;
let posttestQuestionCount = 0;
const MAX_QUESTIONS = 10;
let airtableConnected = false;
let connectionCheckInterval = null;

// ------------------ Inicialización UI ------------------
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  testAirtableConnection();
  if (connectionCheckInterval) clearInterval(connectionCheckInterval);
  connectionCheckInterval = setInterval(testAirtableConnection, 30000);
});

function initializeApp() {
  setTimeout(() => {
    const ls = document.getElementById('loadingScreen');
    if (ls) {
      ls.style.opacity = '0';
      setTimeout(() => (ls.style.display = 'none'), 500);
    }
  }, 1500);
  setTimeout(initializeCharts, 2000);
}

function updateDateTime() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  const el = document.getElementById('currentDateTime');
  if (el) el.textContent = now.toLocaleDateString('es-ES', options);
}

// ------------------ Tabs ------------------
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  const selected = document.getElementById(tabName);
  if (selected) selected.classList.add('active');
  if (typeof event !== 'undefined' && event.target && event.target.closest) {
    event.target.closest('.nav-tab')?.classList.add('active');
  }
}

// ------------------ Airtable (proxy serverless) ------------------
async function airtableRequest(method, path, body = null) {
  const resp = await fetch('/.netlify/functions/airtable-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, path, body })
  });
  if (!resp.ok) {
    let err = {};
    try { err = await resp.json(); } catch { /* ignore */ }
    throw new Error(err.error || `Error ${resp.status}`);
  }
  return await resp.json();
}

function updateConnectionIndicator(status) {
  const indicator = document.getElementById('connectionIndicator');
  const text = document.getElementById('connectionText');
  if (!indicator || !text) return;
  indicator.classList.remove('connected','disconnected','checking');
  if (status === 'connected') { indicator.classList.add('connected'); text.textContent = '✓ Airtable Conectado'; airtableConnected = true; }
  else if (status === 'disconnected') { indicator.classList.add('disconnected'); text.textContent = '✗ Airtable Desconectado'; airtableConnected = false; }
  else { indicator.classList.add('checking'); text.textContent = '⟳ Verificando…'; }
}

async function testAirtableConnection() {
  try {
    updateConnectionIndicator('checking');
    await airtableRequest('GET', '/Capacitaciones?maxRecords=1');
    updateConnectionIndicator('connected');
    console.log('✅ Conexión Airtable OK');
  } catch (e) {
    updateConnectionIndicator('disconnected');
    console.error('❌ Conexión Airtable fallida:', e.message);
  }
}

// ------------------ Preguntas ------------------
function addQuestion(type) {
  const container = document.getElementById(`${type}Questions`);
  const current = type === 'pretest' ? pretestQuestionCount : posttestQuestionCount;
  if (current >= MAX_QUESTIONS) {
    Swal.fire({ icon: 'warning', title: 'Límite Alcanzado', text: `Solo puedes agregar hasta ${MAX_QUESTIONS} preguntas por test` });
    return;
  }
  const newIndex = current + 1;
  if (type === 'pretest') pretestQuestionCount++; else posttestQuestionCount++;
  const questionId = `${type}-q-${newIndex}`;
  const div = document.createElement('div');
  div.className = 'question-item';
  div.id = questionId;
  div.innerHTML = `
    <h4>${type === 'pretest' ? 'Pretest' : 'Post-test'} – Pregunta ${newIndex}</h4>
    <button type="button" class="btn-remove" title="Eliminar" onclick="removeQuestion('${type}', '${questionId}')">✕</button>
    <div class="form-group">
      <label>Enunciado *</label>
      <textarea id="${questionId}-text" rows="2" placeholder="Escribe la pregunta"></textarea>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Opción A *</label><input id="${questionId}-text-a" type="text" /></div>
      <div class="form-group"><label>Opción B *</label><input id="${questionId}-text-b" type="text" /></div>
      <div class="form-group"><label>Opción C *</label><input id="${questionId}-text-c" type="text" /></div>
      <div class="form-group"><label>Opción D *</label><input id="${questionId}-text-d" type="text" /></div>
    </div>
    <div class="form-group">
      <label>Respuesta correcta *</label>
      <div style="display:flex; gap:16px; align-items:center;">
        <label><input type="radio" name="${questionId}-correct" value="A"> A</label>
        <label><input type="radio" name="${questionId}-correct" value="B"> B</label>
        <label><input type="radio" name="${questionId}-correct" value="C"> C</label>
        <label><input type="radio" name="${questionId}-correct" value="D"> D</label>
      </div>
    </div>
  `;
  container.appendChild(div);
}

function removeQuestion(type, id) {
  document.getElementById(id)?.remove();
  if (type === 'pretest') pretestQuestionCount = Math.max(0, pretestQuestionCount - 1);
  else posttestQuestionCount = Math.max(0, posttestQuestionCount - 1);
}

function collectQuestions(type) {
  const count = type === 'pretest' ? pretestQuestionCount : posttestQuestionCount;
  const questions = [];
  for (let i = 0; i < count; i++) {
    const qid = `${type}-q-${i+1}`;
    const textEl = document.getElementById(`${qid}-text`);
    if (!textEl) continue; // por si se eliminó alguno intermedio
    const questionText = textEl.value.trim();
    if (!questionText) {
      Swal.fire({ icon:'error', title:'Pregunta vacía', text:`Completa el enunciado de la pregunta ${i+1}` });
      return null;
    }
    const options = {
      a: document.getElementById(`${qid}-text-a`).value.trim(),
      b: document.getElementById(`${qid}-text-b`).value.trim(),
      c: document.getElementById(`${qid}-text-c`).value.trim(),
      d: document.getElementById(`${qid}-text-d`).value.trim()
    };
    if (!options.a || !options.b || !options.c || !options.d) {
      Swal.fire({ icon:'error', title:'Opciones incompletas', text:`Complete todas las opciones en la pregunta ${i+1}` });
      return null;
    }
    const correct = document.querySelector(`input[name="${qid}-correct"]:checked`);
    if (!correct) {
      Swal.fire({ icon:'error', title:'Respuesta Correcta', text:`Selecciona la respuesta correcta para la pregunta ${i+1}` });
      return null;
    }
    questions.push({ number: i+1, question: questionText, options, correctAnswer: correct.value });
  }
  return questions;
}

// ------------------ Utilidades acceso ------------------
function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function showQRCode(accessCode) {
  const modal = document.getElementById('qrModal');
  const qrContainer = document.getElementById('qrcode');
  if (!modal || !qrContainer) return;
  qrContainer.innerHTML = '';
  const accessUrl = `${window.location.origin}${window.location.pathname}?code=${accessCode}`;
  new QRCode(qrContainer, { text: accessUrl, width: 256, height: 256, colorDark: '#667eea', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
  document.getElementById('modalAccessCode').textContent = accessCode;
  document.getElementById('modalAccessLink').textContent = accessUrl;
  modal.style.display = 'flex';
}
function closeModal(){ const m = document.getElementById('qrModal'); if (m) m.style.display='none'; }
function copyLink(){
  const link = document.getElementById('modalAccessLink').textContent;
  const code = document.getElementById('modalAccessCode').textContent;
  const text = `🏥 Acceso a Capacitación\n\nCódigo: ${code}\nLink: ${link}\n\nHospital Susana López de Valencia`;
  navigator.clipboard.writeText(text).then(()=>Swal.fire({icon:'success',title:'Copiado',timer:1800,showConfirmButton:false}));
}
function shareWhatsApp(){
  const code = document.getElementById('modalAccessCode').textContent;
  const link = document.getElementById('modalAccessLink').textContent;
  const message = `🏥 *Acceso a Capacitación*\nHospital Susana López de Valencia\n\n*Código:* ${code}\n*Link:* ${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank');
}
function downloadQR(){
  const canvas = document.querySelector('#qrcode canvas');
  if (!canvas) return;
  canvas.toBlob(blob=>{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const code = document.getElementById('modalAccessCode').textContent;
    a.download = `QR-${code}.png`; a.href = url; a.click(); URL.revokeObjectURL(url);
    Swal.fire({icon:'success',title:'Descargado',timer:2000,showConfirmButton:false});
  });
}

// ------------------ Reset ------------------
function resetForm(){
  if (pretestQuestionCount>0 || posttestQuestionCount>0){
    Swal.fire({title:'¿Limpiar Formulario?', text:'Se perderán todas las preguntas', icon:'warning', showCancelButton:true, confirmButtonText:'Sí, limpiar', cancelButtonText:'Cancelar'})
    .then(res=>{ if(res.isConfirmed) performReset();});
  } else performReset();
}
function performReset(){
  document.getElementById('trainingForm')?.reset();
  document.getElementById('pretestQuestions').innerHTML='';
  document.getElementById('posttestQuestions').innerHTML='';
  pretestQuestionCount=0; posttestQuestionCount=0;
  document.querySelectorAll('.question-counter').forEach(c=>c.remove());
  Swal.fire({icon:'success',title:'Formulario Limpiado',timer:1200,showConfirmButton:false});
}

// ------------------ Charts (placeholder) ------------------
let participationsChart = null;
let departmentChart = null;
function initializeCharts() {
  const c1 = document.getElementById('participationsChart');
  const c2 = document.getElementById('departmentChart');
  if (c1) {
    participationsChart = new Chart(c1.getContext('2d'), {
      type:'line',
      data:{ labels:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'], datasets:[{ label:'Participaciones', data:[0,0,0,0,0,0,0], borderColor:'#667eea', backgroundColor:'rgba(102,126,234,0.1)', tension:0.4 }]},
      options:{ responsive:true, maintainAspectRatio:false }
    });
  }
  if (c2) {
    departmentChart = new Chart(c2.getContext('2d'), {
      type:'bar',
      data:{ labels:['Enfermería','Medicina','Admin','Lab','Radiología'], datasets:[{ label:'Rendimiento', data:[0,0,0,0,0] }]},
      options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, max:100 } } }
    });
  }
}

// ------------------ Guardar Capacitación ------------------
async function saveTraining(){
  if (!airtableConnected){
    Swal.fire({icon:'error', title:'Sin Conexión', text:'No hay conexión con Airtable. Verifica configuración.'});
    return;
  }
  const title = document.getElementById('trainingTitle').value.trim();
  const description = document.getElementById('trainingDescription').value.trim();
  const trainingDate = document.getElementById('trainingDate').value;
  const department = document.getElementById('trainingDepartment').value;
  const duration = document.getElementById('trainingDuration')?.value.trim() || '';

  const selectedStaff = Array.from(document.querySelectorAll('.trainingStaff:checked')).map(cb=>cb.value);

  if (!title || !department || !trainingDate || selectedStaff.length===0){
    Swal.fire({icon:'error', title:'Campos Requeridos', text:'Complete todos los campos y seleccione personal capacitado.'});
    return;
  }

  if (pretestQuestionCount===0 || posttestQuestionCount===0){
    Swal.fire({icon:'error', title:'Preguntas Requeridas', text:'Agrega al menos una pregunta en Pre y Post test.'});
    return;
  }

  const pretest = collectQuestions('pretest'); if (!pretest) return;
  const posttest = collectQuestions('posttest'); if (!posttest) return;

  const accessCode = generateAccessCode();
  const accessUrl = `${window.location.origin}${window.location.pathname}?code=${accessCode}`;

  Swal.fire({ title:'Guardando en Airtable…', html:'Por favor espera', allowOutsideClick:false, didOpen:()=>Swal.showLoading() });

  try {
    // 1) Capacitaciones
    const trainingResp = await airtableRequest('POST', '/Capacitaciones', {
      records: [{ fields: {
        'Título': title,
        'Descripción': description || '',
        'Departamento': department,
        'Duración': duration,
        'Personal Capacitado': selectedStaff.join(', '),
        'Fecha Creación': trainingDate,
        'Activa': true,
        'Fecha Creación Sistema': new Date().toISOString()
      }}]
    });
    const trainingId = trainingResp.records[0].id;

    // 2) Sesiones
    const sessionResp = await airtableRequest('POST', '/Sesiones', {
      records: [{ fields: {
        'Capacitación': [trainingId],
        'Código Acceso': accessCode,
        'Link Acceso': accessUrl,
        'Fecha Inicio': new Date().toISOString(),
        'Activa': true
      }}]
    });
    const sessionId = sessionResp.records[0].id;
    console.log('Sesión creada', sessionId);

    // 3) Preguntas Pretest
    const preRecords = pretest.map(q => ({
      fields:{
        'Capacitación': [trainingId],
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
    // 10 por batch es el límite usual
    await airtableRequest('POST', '/Preguntas', { records: preRecords });

    // 4) Preguntas Post-test
    const postRecords = posttest.map(q => ({
      fields:{
        'Capacitación': [trainingId],
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
    await airtableRequest('POST', '/Preguntas', { records: postRecords });

    Swal.fire({
      icon:'success',
      title:'¡Capacitación Guardada!',
      html:`<div style="margin:16px 0; text-align:left;">
              <p><strong>Título:</strong> ${title}</p>
              <p><strong>Código:</strong> ${accessCode}</p>
              <p><strong>Link:</strong> <a href="${accessUrl}">${accessUrl}</a></p>
            </div>`
    });
    showQRCode(accessCode, title);
    resetForm();
  } catch (err) {
    console.error(err);
    Swal.fire({icon:'error', title:'Error guardando', text: err.message || 'No se pudo guardar' });
  }
}

// Exponer funciones globales usadas por el HTML (no se modifica el frontend)
window.switchTab = switchTab;
window.addQuestion = addQuestion;
window.resetForm = resetForm;
window.saveTraining = saveTraining;
window.closeModal = closeModal;
window.copyLink = copyLink;
window.shareWhatsApp = shareWhatsApp;
window.downloadQR = downloadQR;
