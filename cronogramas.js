/**
 * MÓDULO DE CRONOGRAMAS
 * Hospital Susana López de Valencia
 * 
 * Funcionalidad:
 * - Crear cronogramas por año
 * - Agregar fechas de capacitaciones
 * - Enviar alertas por email
 * - Gestionar cronogramas existentes
 */

// Variables globales
let cronogramas = [];
let cronogramaActual = null;

/**
 * Cargar cronogramas desde Airtable
 */
async function loadCronogramas() {
  try {
    console.log('📅 Cargando cronogramas...');
    
    const response = await fetch('/.netlify/functions/airtable-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getCronogramas'
      })
    });

    const data = await response.json();
    cronogramas = data.records || [];
    populateCronogramasList();
    console.log(`✅ ${cronogramas.length} cronogramas cargados`);
  } catch (error) {
    console.error('Error cargando cronogramas:', error);
  }
}

/**
 * Llenar lista de cronogramas
 */
function populateCronogramasList() {
  const container = document.getElementById('cronogramasContainer');
  if (!container) return;

  container.innerHTML = '';
  
  cronogramas.forEach(cronograma => {
    const card = document.createElement('div');
    card.className = 'cronograma-card';
    card.innerHTML = `
      <div class="cronograma-header">
        <h3>${cronograma.fields.nombre || 'Sin nombre'}</h3>
        <span class="badge">${cronograma.fields.año}</span>
      </div>
      <p class="cronograma-info">
        Capacitaciones programadas: ${cronograma.fields.capacitaciones?.length || 0}
      </p>
      <div class="cronograma-actions">
        <button onclick="viewCronograma('${cronograma.id}')" class="btn-small">Ver</button>
        <button onclick="editCronograma('${cronograma.id}')" class="btn-small">Editar</button>
        <button onclick="deleteCronograma('${cronograma.id}')" class="btn-small btn-danger">Eliminar</button>
      </div>
    `;
    container.appendChild(card);
  });
}

/**
 * Abrir modal para crear nuevo cronograma
 */
function openNewCronogramaModal() {
  const modal = document.getElementById('cronogramaModal');
  if (!modal) return;

  cronogramaActual = null;
  document.getElementById('cronogramaForm').reset();
  document.getElementById('cronogramaTitle').textContent = 'Crear Nuevo Cronograma';
  document.getElementById('capacitacionesList').innerHTML = '';
  modal.style.display = 'flex';
}

/**
 * Cerrar modal de cronograma
 */
function closeCronogramaModal() {
  const modal = document.getElementById('cronogramaModal');
  if (modal) modal.style.display = 'none';
  cronogramaActual = null;
}

/**
 * Ver detalles de cronograma
 */
function viewCronograma(cronogramaId) {
  const cronograma = cronogramas.find(c => c.id === cronogramaId);
  if (!cronograma) return;

  cronogramaActual = cronograma;
  document.getElementById('cronogramaTitle').textContent = `Cronograma: ${cronograma.fields.nombre}`;
  document.getElementById('cronogramaForm').style.display = 'none';
  document.getElementById('viewMode').style.display = 'block';
  
  const capacitacionesList = document.getElementById('capacitacionesList');
  capacitacionesList.innerHTML = '';
  
  const capacitaciones = cronograma.fields.capacitaciones || [];
  capacitaciones.forEach((cap, index) => {
    const item = document.createElement('div');
    item.className = 'capacitacion-item';
    item.innerHTML = `
      <h4>${cap.nombre}</h4>
      <p>📅 Fecha: ${cap.fecha}</p>
      <p>👥 Participantes esperados: ${cap.participantes}</p>
      <p>📧 Correos alerta: ${cap.correos?.join(', ') || 'No configurado'}</p>
    `;
    capacitacionesList.appendChild(item);
  });

  document.getElementById('cronogramaModal').style.display = 'flex';
}

/**
 * Editar cronograma
 */
function editCronograma(cronogramaId) {
  const cronograma = cronogramas.find(c => c.id === cronogramaId);
  if (!cronograma) return;

  cronogramaActual = cronograma;
  document.getElementById('cronogramaTitle').textContent = `Editar: ${cronograma.fields.nombre}`;
  document.getElementById('cronogramaForm').style.display = 'block';
  document.getElementById('viewMode').style.display = 'none';
  
  document.getElementById('nombreCronograma').value = cronograma.fields.nombre || '';
  document.getElementById('año').value = cronograma.fields.año || new Date().getFullYear();
  
  const capacitacionesList = document.getElementById('capacitacionesList');
  capacitacionesList.innerHTML = '';
  
  const capacitaciones = cronograma.fields.capacitaciones || [];
  capacitaciones.forEach((cap, index) => {
    addCapacitacionToForm(cap, index);
  });

  document.getElementById('cronogramaModal').style.display = 'flex';
}

/**
 * Agregar capacitación al formulario
 */
function addCapacitacionToForm(capacitacion = {}, index = null) {
  const list = document.getElementById('capacitacionesList');
  const itemId = index !== null ? index : list.children.length;
  
  const item = document.createElement('div');
  item.className = 'capacitacion-form-item';
  item.id = `cap-${itemId}`;
  item.innerHTML = `
    <div class="form-group">
      <label>Nombre de la Capacitación:</label>
      <input type="text" class="cap-nombre" placeholder="Ej: Excel Avanzado" value="${capacitacion.nombre || ''}">
    </div>
    
    <div class="form-group">
      <label>Fecha de la Capacitación:</label>
      <input type="date" class="cap-fecha" value="${capacitacion.fecha || ''}">
    </div>
    
    <div class="form-group">
      <label>Participantes Esperados:</label>
      <input type="number" class="cap-participantes" placeholder="Cantidad" value="${capacitacion.participantes || ''}">
    </div>
    
    <div class="form-group">
      <label>Correos para Alertas (separados por coma):</label>
      <input type="text" class="cap-correos" placeholder="email1@hospital.com, email2@hospital.com" value="${capacitacion.correos?.join(', ') || ''}">
    </div>
    
    <div class="form-group">
      <label>Días de anticipación para alerta:</label>
      <input type="number" class="cap-diasAlerta" placeholder="Ej: 7" value="${capacitacion.diasAlerta || 7}">
    </div>
    
    <button type="button" onclick="removeCapacitacion('${itemId}')" class="btn-small btn-danger">Eliminar</button>
    <hr>
  `;
  
  list.appendChild(item);
}

/**
 * Remover capacitación del formulario
 */
function removeCapacitacion(itemId) {
  const item = document.getElementById(`cap-${itemId}`);
  if (item) item.remove();
}

/**
 * Guardar cronograma
 */
async function saveCronograma() {
  try {
    console.log('💾 Guardando cronograma...');
    
    const nombre = document.getElementById('nombreCronograma').value.trim();
    const año = document.getElementById('año').value;
    
    if (!nombre) {
      alert('❌ Por favor ingresa un nombre para el cronograma');
      return;
    }

    // Recopilar capacitaciones
    const capacitaciones = [];
    document.querySelectorAll('.capacitacion-form-item').forEach((item, index) => {
      const nombre = item.querySelector('.cap-nombre').value.trim();
      const fecha = item.querySelector('.cap-fecha').value;
      const participantes = item.querySelector('.cap-participantes').value;
      const correos = item.querySelector('.cap-correos').value
        .split(',')
        .map(e => e.trim())
        .filter(e => e);
      const diasAlerta = item.querySelector('.cap-diasAlerta').value || 7;

      if (nombre && fecha) {
        capacitaciones.push({
          nombre,
          fecha,
          participantes: parseInt(participantes) || 0,
          correos,
          diasAlerta: parseInt(diasAlerta)
        });
      }
    });

    if (capacitaciones.length === 0) {
      alert('❌ Agrega al menos una capacitación');
      return;
    }

    // Guardar en Airtable
    const payload = {
      action: 'saveCronograma',
      cronogramaId: cronogramaActual?.id || null,
      nombre,
      año: parseInt(año),
      capacitaciones
    };

    const response = await fetch('/.netlify/functions/airtable-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.success) {
      alert('✅ Cronograma guardado exitosamente');
      closeCronogramaModal();
      loadCronogramas();
    } else {
      throw new Error(data.error || 'Error al guardar');
    }

  } catch (error) {
    console.error('Error guardando cronograma:', error);
    alert(`❌ Error: ${error.message}`);
  }
}

/**
 * Eliminar cronograma
 */
async function deleteCronograma(cronogramaId) {
  if (!confirm('¿Estás seguro de que quieres eliminar este cronograma?')) {
    return;
  }

  try {
    const response = await fetch('/.netlify/functions/airtable-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deleteCronograma',
        cronogramaId
      })
    });

    const data = await response.json();

    if (data.success) {
      alert('✅ Cronograma eliminado');
      loadCronogramas();
    } else {
      throw new Error(data.error || 'Error al eliminar');
    }

  } catch (error) {
    console.error('Error eliminando cronograma:', error);
    alert(`❌ Error: ${error.message}`);
  }
}

/**
 * Enviar alertas por email para cronogramas
 * Se ejecuta diariamente desde Netlify
 */
async function enviarAlertasCronogramas() {
  try {
    console.log('📧 Enviando alertas de cronogramas...');
    
    const response = await fetch('/.netlify/functions/send-cronograma-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await response.json();
    console.log('✅ Alertas enviadas:', data);

  } catch (error) {
    console.error('Error enviando alertas:', error);
  }
}

// Inicializar cuando carga la página
document.addEventListener('DOMContentLoaded', async function() {
  // Cargar cronogramas si existe el contenedor
  if (document.getElementById('cronogramasContainer')) {
    await loadCronogramas();
  }
});
