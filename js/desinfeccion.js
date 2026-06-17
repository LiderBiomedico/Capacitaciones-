// ============================================================================
// MÓDULO DE DESINFECCIÓN DE EQUIPOS BIOMÉDICOS (HSLV / NEXA)
// Verificación de limpieza con lápiz UV + linterna UV.
//
// Flujo:
//   1. Marcado: técnico marca el equipo con lápiz UV, toma "Foto Antes".
//   2. Verificación (días después): vuelve con linterna UV, toma "Foto Despues",
//      decide CUMPLE / NO CUMPLE.
//
// Usa /.netlify/functions/desinfeccion para CRUD y /.netlify/functions/upload-pdf
// (con tableName='Desinfeccion') para subir las fotos como attachments.
// ============================================================================

(function () {
  if (window.__HSLV_DESINFECCION_LOADED) {
    console.warn('Módulo Desinfección ya cargado, se omite recarga.');
    return;
  }
  window.__HSLV_DESINFECCION_LOADED = true;

  // API base
  if (typeof API_BASE_URL === 'undefined') {
    var API_BASE_URL = '/.netlify/functions';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Estado del módulo
  // ─────────────────────────────────────────────────────────────────────────
  const state = window.__HSLV_DESINFECCION_STATE || (window.__HSLV_DESINFECCION_STATE = {
    records: [],
    filter: 'Marcado',       // 'Marcado' | 'Verificado' | 'todos'
    searchQ: '',
    searchTimer: null,
    selectedEquipo: null,    // equipo del inventario elegido para nuevo registro
    selectedDesinfeccionId: null, // id del registro a verificar
    fotoAntesBase64: null,
    fotoDespuesBase64: null,
  });

  function getAuth() {
    try { if (typeof getAuthHeader === 'function') return getAuthHeader(); } catch (e) {}
    return {};
  }
  function getNombreTecnico() {
    try {
      return sessionStorage.getItem('NEXA_NOMBRE') ||
             sessionStorage.getItem('NEXA_USUARIO') || 'Sin identificar';
    } catch (e) { return 'Sin identificar'; }
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function todayISO() {
    // Evita problemas de UTC con la zona Colombia (UTC-5)
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }
  // Devuelve la fecha+hora local en el formato que entiende <input type="datetime-local">
  // ("YYYY-MM-DDTHH:MM"). Útil como valor por defecto cuando se abre un modal.
  function nowDatetimeLocal() {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mn = String(d.getMinutes()).padStart(2, '0');
    return `${yy}-${mm}-${dd}T${hh}:${mn}`;
  }
  // Convierte el valor de un input datetime-local ("YYYY-MM-DDTHH:MM", sin TZ)
  // a un ISO 8601 con zona horaria correcta. Lo que va al backend / Airtable.
  function datetimeLocalToISO(value) {
    if (!value) return '';
    try {
      // new Date(value) interpreta el datetime-local como hora local del navegador
      const d = new Date(value);
      if (isNaN(d.getTime())) return value;
      return d.toISOString();
    } catch (e) { return value; }
  }
  // Formato amigable es-CO:
  // - Si Airtable devuelve solo fecha (YYYY-MM-DD), se muestra como fecha sin convertir zona horaria.
  // - Si devuelve fecha + hora, se muestra en hora Colombia (America/Bogota).
  function formatDateTime(isoStr) {
    if (!isoStr) return '—';
    try {
      const s = String(isoStr).trim();

      // Airtable puede devolver campos tipo Date como "YYYY-MM-DD".
      // JavaScript interpreta ese formato como UTC 00:00 y en Colombia lo convierte
      // al día anterior 19:00. Por eso se formatea manualmente sin new Date().
      const pureDate = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (pureDate) {
        return `${pureDate[3]}/${pureDate[2]}/${pureDate[1]}`;
      }

      const d = new Date(s);
      if (isNaN(d.getTime())) return s;

      // Si Airtable devuelve T00:00:00.000Z porque el campo es solo Date,
      // no debe mostrarse como 19:00 del día anterior.
      const isDateOnly = /T00:00:00(\.000)?Z?$/.test(s);
      if (isDateOnly) {
        const yy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `${dd}/${mm}/${yy}`;
      }

      return d.toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch (e) { return String(isoStr); }
  }
  function safeErr(e) {
    if (!e) return 'Error desconocido';
    // Axios: error con response del backend
    if (e.response && e.response.data) {
      const errField = e.response.data.error;
      if (errField) {
        if (typeof errField === 'string') return errField;
        // Objeto de error de Airtable: {type, message}
        return errField.message || errField.type || JSON.stringify(errField);
      }
      return JSON.stringify(e.response.data);
    }
    return e.message || String(e);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Redimensionado de imagen en cliente (antes de subir)
  // Las fotos UV pueden ser pesadas; reducimos a max 1280px lado mayor, JPEG 0.85
  // ─────────────────────────────────────────────────────────────────────────
  function fileToResizedBase64(file, maxDim) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.onload = (ev) => {
        const img = new Image();
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
        img.onload = () => {
          try {
            let w = img.naturalWidth, h = img.naturalHeight;
            const max = maxDim || 1280;
            if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
            else if (h >= w && h > max) { w = Math.round(w * max / h); h = max; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            // Fondo negro: típico para fotos UV en habitación oscura
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } catch (e) { reject(e); }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Carga principal de la lista
  // ─────────────────────────────────────────────────────────────────────────
  async function loadDesinfeccion(forceRefresh) {
    const tbody = document.getElementById('desinfeccionTbody');
    if (!tbody) { console.warn('No se encontró #desinfeccionTbody'); return; }

    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:18px;color:#607d8b;">
      ⏳ Cargando registros de desinfección...
    </td></tr>`;

    try {
      const qs = new URLSearchParams({ action: 'list', pageSize: '100' });
      if (state.filter && state.filter !== 'todos') qs.set('estado', state.filter);
      if (state.searchQ) qs.set('q', state.searchQ);

      const res = await axios.get(`${API_BASE_URL}/desinfeccion?${qs.toString()}`, {
        headers: getAuth()
      });
      state.records = (res.data && res.data.records) || [];
      console.log(`✅ Desinfección: ${state.records.length} registros (filtro="${state.filter}")`);

      const countEl = document.getElementById('desinfeccionCount');
      if (countEl) countEl.textContent = `${state.records.length} registros`;

      renderTabla();
      // Refresca KPIs de la tarjeta superior del módulo
      loadKpisModulo();

    } catch (err) {
      console.error('❌ Error cargando desinfección:', err);
      const errMsg = safeErr(err);
      const isMissingTable = /NOT_FOUND|Could not find table|TABLE_NOT_FOUND|INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND|requested model was not found|model was not found/i.test(errMsg);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:18px;color:#c62828;">
        ⚠️ <strong>Error al cargar:</strong> ${esc(errMsg)}
        ${isMissingTable ? `<br><br><div style="background:#fff3cd;color:#856404;border:1px solid #ffeaa7;border-radius:8px;padding:14px;text-align:left;max-width:600px;margin:0 auto;font-size:13px;line-height:1.5;">
          <strong>⚙️ Falta crear la tabla en Airtable.</strong><br>
          1. Abra su base de Airtable (la misma de <code>Inventario</code>).<br>
          2. Cree una tabla nueva con el nombre exacto: <code style="background:#fff;padding:2px 6px;border-radius:4px;font-weight:700;">Desinfeccion</code> (sin tilde).<br>
          3. Agregue los 17 campos descritos en <code>README_DESINFECCION.md</code>.<br>
          4. Recargue esta página con <kbd>Ctrl+Shift+R</kbd>.
        </div>` : ''}
        <br><button class="btn btn-primary" onclick="loadDesinfeccion(true)" style="margin-top:10px">🔄 Reintentar</button>
      </td></tr>`;
    }
  }

  function renderTabla() {
    const tbody = document.getElementById('desinfeccionTbody');
    if (!tbody) return;

    if (!state.records.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:18px;color:#607d8b;">
        🧼 No hay registros en este filtro.<br>
        <small>Use el botón "+ Nueva Marca UV" para iniciar un proceso de verificación.</small>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = state.records.map(rec => {
      const f = rec.fields || {};
      const equipo    = f['Equipo'] || '—';
      const marca     = f['Marca'] || '';
      const modelo    = f['Modelo'] || '';
      const serie     = f['Serie'] || '';
      const servicio  = f['Servicio'] || '';
      const fMarcado  = formatDateTime(f['Fecha Marcado']);
      const fVerif    = formatDateTime(f['Fecha Verificacion']);
      const estado    = f['Estado'] || 'Marcado';
      const resultado = String(f['Resultado'] || '').trim();
      const tecMarc   = f['Ingeniero Marcado'] || '';
      const tecVerif  = f['Ingeniero Verificacion'] || '';

      // Badge de resultado
      let badge = '';
      if (estado === 'Verificado') {
        if (resultado.toLowerCase() === 'cumple') {
          badge = `<span style="background:#e8f5e9;color:#1b5e20;border:1px solid #a5d6a7;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">✅ CUMPLE</span>`;
        } else if (resultado.toLowerCase().startsWith('no')) {
          badge = `<span style="background:#ffebee;color:#b71c1c;border:1px solid #ef9a9a;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">❌ NO CUMPLE</span>`;
        } else {
          badge = `<span style="background:#eceff1;color:#455a64;padding:3px 10px;border-radius:12px;font-size:11px;">Verificado</span>`;
        }
      } else {
        badge = `<span style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">⏳ PENDIENTE</span>`;
      }

      // Botón principal según estado
      const actionBtn = (estado === 'Verificado')
        ? `<button class="btn btn-small btn-secondary" onclick="window.openDesinfeccionDetalle('${rec.id}')" title="Ver detalle">👁️ Ver</button>`
        : `<button class="btn btn-small btn-primary" onclick="window.openVerificarLimpieza('${rec.id}')" title="Verificar con linterna UV">🔦 Verificar</button>`;

      const tecMarcStr = tecMarc ? `<br><small style="color:#90a4ae">por ${esc(tecMarc)}</small>` : '';
      const tecVerifStr = tecVerif ? `<br><small style="color:#90a4ae">por ${esc(tecVerif)}</small>` : '';

      return `<tr>
        <td>
          <strong>${esc(equipo)}</strong>
          ${marca ? `<br><small style="color:#607d8b">${esc(marca)} ${esc(modelo)}</small>` : ''}
        </td>
        <td>${esc(serie)}</td>
        <td>${esc(servicio)}</td>
        <td>${fMarcado}${tecMarcStr}</td>
        <td>${fVerif !== '—' ? fVerif + tecVerifStr : '—'}</td>
        <td style="text-align:center;">${badge}</td>
        <td style="text-align:center;">${actionBtn}</td>
      </tr>`;
    }).join('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KPIs del módulo (tarjeta superior y dashboard global)
  // ─────────────────────────────────────────────────────────────────────────
  async function loadKpisModulo() {
    try {
      const res = await axios.get(`${API_BASE_URL}/desinfeccion?action=kpis`, { headers: getAuth() });
      const d = res.data || {};
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = (v == null ? '—' : v); };
      // Tarjetas internas del módulo
      set('desinfTotal',           d.total ?? 0);
      set('desinfPendientes',      d.marcadosPendientes ?? 0);
      set('desinfCumple',          d.cumple ?? 0);
      set('desinfNoCumple',        d.noCumple ?? 0);
      set('desinfTasa',            (d.tasaCumplimiento ?? 0) + '%');
      // Tarjetas del dashboard global (si están presentes)
      set('kpiDesinfTotal',        d.total ?? 0);
      set('kpiDesinfPendientes',   d.marcadosPendientes ?? 0);
      set('kpiDesinfCumple',       d.cumple ?? 0);
      set('kpiDesinfNoCumple',     d.noCumple ?? 0);
      set('kpiDesinfTasa',         (d.tasaCumplimiento ?? 0) + '%');

      renderDashboardDesinfeccion(d);
    } catch (err) {
      console.warn('No se pudieron cargar KPIs de desinfección:', safeErr(err));
      renderDashboardDesinfeccionError();
    }
  }

  function renderDashboardDesinfeccion(d) {
    renderDesinfeccionResultadoChart(d || {});
    renderDesinfeccionServiciosChart((d && d.topServicios) || []);
    renderDesinfeccionDashboardTable((d && d.recientes) || []);
  }

  function renderDashboardDesinfeccionError() {
    const tbody = document.getElementById('desinfeccionDashboardTbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#c62828;padding:12px;">No fue posible cargar los datos de desinfección.</td></tr>`;
    }
  }

  function renderDesinfeccionResultadoChart(d) {
    const ctx = document.getElementById('desinfeccionResultadoChart');
    if (!ctx || typeof Chart === 'undefined') return;
    if (ctx._chartInstance) ctx._chartInstance.destroy();

    const pendientes = Number(d.marcadosPendientes || 0);
    const cumple = Number(d.cumple || 0);
    const noCumple = Number(d.noCumple || 0);

    ctx._chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [`Pendientes (${pendientes})`, `Cumple (${cumple})`, `No cumple (${noCumple})`],
        datasets: [{
          data: [pendientes, cumple, noCumple],
          backgroundColor: ['#e65100', '#2e7d32', '#c62828'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  function renderDesinfeccionServiciosChart(servicios) {
    const ctx = document.getElementById('desinfeccionServiciosChart');
    if (!ctx || typeof Chart === 'undefined') return;
    if (ctx._chartInstance) ctx._chartInstance.destroy();

    const data = (servicios || []).slice(0, 8);
    const labels = data.map(s => s.nombre || 'Sin servicio');
    const values = data.map(s => Number(s.total || 0));

    ctx._chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['Sin datos'],
        datasets: [{
          label: 'Registros',
          data: values.length ? values : [0],
          backgroundColor: '#00838f',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } }
        }
      }
    });
  }

  function renderDesinfeccionDashboardTable(registros) {
    const tbody = document.getElementById('desinfeccionDashboardTbody');
    if (!tbody) return;

    if (!registros || !registros.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#90a4ae;padding:12px;">Aún no hay controles de desinfección registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = registros.map(r => {
      const estado = r.estado || '—';
      const resultado = r.resultado || (estado === 'Verificado' ? '—' : 'Pendiente');
      const resultColor = /^cumple$/i.test(resultado) ? '#2e7d32' : (/no/i.test(resultado) ? '#c62828' : '#e65100');
      const equipoTxt = [r.equipo, r.marca, r.modelo].filter(Boolean).join(' · ') || '—';
      return `<tr>
        <td>${esc(formatDateTime(r.fecha))}</td>
        <td><strong>${esc(equipoTxt)}</strong><br><small style="color:#78909c;">Serie: ${esc(r.serie || '—')}</small></td>
        <td>${esc(r.servicio || 'Sin servicio')}</td>
        <td><span class="badge">${esc(estado)}</span></td>
        <td><span style="font-weight:800;color:${resultColor};">${esc(resultado)}</span></td>
        <td>${esc(r.responsable || '—')}</td>
      </tr>`;
    }).join('');
  }

  // Exponer para que app.js pueda llamarlo desde el dashboard
  window.loadDesinfeccionKpis = loadKpisModulo;

  // ─────────────────────────────────────────────────────────────────────────
  // BÚSQUEDA / FILTROS
  // ─────────────────────────────────────────────────────────────────────────
  function debouncedSearch() {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      const el = document.getElementById('desinfeccionSearch');
      state.searchQ = el ? el.value.trim() : '';
      loadDesinfeccion();
    }, 400);
  }
  function setFiltro(f) {
    state.filter = f;
    document.querySelectorAll('[data-desinf-filter]').forEach(btn => {
      btn.classList.toggle('active-filter', btn.getAttribute('data-desinf-filter') === f);
      btn.style.background = (btn.getAttribute('data-desinf-filter') === f) ? '#1565c0' : '#eceff1';
      btn.style.color      = (btn.getAttribute('data-desinf-filter') === f) ? '#fff'    : '#455a64';
    });
    loadDesinfeccion();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL: NUEVA MARCA UV (paso 1)
  // ─────────────────────────────────────────────────────────────────────────

  // Cache del inventario en memoria. Se llena una sola vez por sesión.
  // Estructura: array de objetos slim {id, item, equipo, marca, modelo, serie, servicio, sede, placa}
  let invCache = null;
  let invCachePromise = null;

  async function ensureInvCache() {
    if (invCache) return invCache;
    if (invCachePromise) return invCachePromise;

    invCachePromise = (async () => {
      let all = [];
      let offset = null;
      let safety = 0;
      do {
        safety++;
        const qs = new URLSearchParams({ pageSize: '100' });
        if (offset) qs.set('offset', offset);
        const res = await axios.get(`${API_BASE_URL}/inventario?${qs.toString()}`, { headers: getAuth() });
        const data = res.data || {};
        const recs = data.records || data.data || [];
        all = all.concat(recs.map(r => {
          const f = r.fields || {};
          return {
            id: r.id,
            item:     f['Item'] || f['ITEM'] || 0,
            equipo:   f['Equipo'] || f['EQUIPO'] || '',
            marca:    f['Marca']  || f['MARCA']  || '',
            modelo:   f['Modelo'] || f['MODELO'] || '',
            serie:    f['Serie']  || f['SERIE']  || '',
            servicio: f['Servicio'] || f['SERVICIO'] || '',
            sede:     f['Sede']   || '',
            placa:    f['Numero de Placa'] || f['PLACA'] || '',
          };
        }));
        offset = data.offset || null;
      } while (offset && safety < 30);
      invCache = all;
      return invCache;
    })();
    try {
      return await invCachePromise;
    } finally {
      // Si la promesa falló, la limpio para permitir reintento en el próximo open
      if (!invCache) invCachePromise = null;
    }
  }

  async function abrirNuevaMarca() {
    state.selectedEquipo = null;
    state.fotoAntesBase64 = null;
    const m = document.getElementById('desinfeccionNuevaModal');
    if (!m) { alert('Modal no disponible'); return; }

    // Reset de los 4 campos de búsqueda
    ['desinfSrchNombre','desinfSrchMarca','desinfSrchModelo','desinfSrchSerie'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const cont = document.getElementById('desinfNuevaResultados');
    if (cont) cont.innerHTML = '<div style="padding:14px;text-align:center;color:#90a4ae;font-size:12px;">Escriba en cualquier campo para filtrar resultados...</div>';
    const selDiv = document.getElementById('desinfNuevaEquipoSeleccionado');
    if (selDiv) selDiv.style.display = 'none';

    document.getElementById('desinfNuevaFecha').value = nowDatetimeLocal();
    document.getElementById('desinfNuevaTecnico').value = getNombreTecnico();
    document.getElementById('desinfNuevaObs').value = '';
    const prev = document.getElementById('desinfNuevaFotoPreview');
    if (prev) { prev.src = ''; }
    const prevWrap = document.getElementById('desinfNuevaFotoPreviewWrap');
    if (prevWrap) prevWrap.style.display = 'none';
    cerrarCamaraDesinf();
    const btn = document.getElementById('desinfNuevaGuardarBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardar marca'; }

    // Abrir modal
    if (typeof openModal === 'function') openModal('desinfeccionNuevaModal');
    else { m.style.display = 'block'; m.classList.add('active'); }

    // Cargar inventario en background (no-op si ya está cacheado)
    const status = document.getElementById('desinfBusquedaEstado');
    if (invCache) {
      if (status) status.textContent = `✅ ${invCache.length} equipos disponibles para buscar`;
    } else {
      if (status) status.textContent = '⏳ Cargando inventario completo (solo la primera vez)…';
      try {
        await ensureInvCache();
        if (status) status.textContent = `✅ ${invCache.length} equipos disponibles para buscar`;
      } catch (e) {
        if (status) status.innerHTML = '<span style="color:#c62828;">⚠️ Error cargando inventario: ' + esc(safeErr(e)) + '</span>';
      }
    }
  }
  window.abrirNuevaMarcaUV = abrirNuevaMarca;

  // Búsqueda multi-campo client-side sobre el cache
  function buscarMultiCampo() {
    const cont = document.getElementById('desinfNuevaResultados');
    const status = document.getElementById('desinfBusquedaEstado');

    // Si no hay cache todavía
    if (!invCache) {
      if (cont) cont.innerHTML = '<div style="padding:14px;text-align:center;color:#90a4ae;font-size:12px;">⏳ Cargando inventario… espere un momento.</div>';
      return;
    }

    const qNombre = ((document.getElementById('desinfSrchNombre') || {}).value || '').toLowerCase().trim();
    const qMarca  = ((document.getElementById('desinfSrchMarca')  || {}).value || '').toLowerCase().trim();
    const qModelo = ((document.getElementById('desinfSrchModelo') || {}).value || '').toLowerCase().trim();
    const qSerie  = ((document.getElementById('desinfSrchSerie')  || {}).value || '').toLowerCase().trim();

    // Si todos los campos están vacíos
    if (!qNombre && !qMarca && !qModelo && !qSerie) {
      if (cont) cont.innerHTML = '<div style="padding:14px;text-align:center;color:#90a4ae;font-size:12px;">Escriba en cualquier campo para filtrar resultados...</div>';
      if (status) status.textContent = `✅ ${invCache.length} equipos disponibles para buscar`;
      return;
    }

    const filtered = invCache.filter(eq => {
      if (qNombre && !String(eq.equipo).toLowerCase().includes(qNombre)) return false;
      if (qMarca  && !String(eq.marca).toLowerCase().includes(qMarca))   return false;
      if (qModelo && !String(eq.modelo).toLowerCase().includes(qModelo)) return false;
      if (qSerie  && !String(eq.serie).toLowerCase().includes(qSerie))   return false;
      return true;
    });

    if (status) {
      if (filtered.length === 0) {
        status.textContent = `Sin coincidencias entre ${invCache.length} equipos`;
      } else if (filtered.length > 50) {
        status.textContent = `Mostrando 50 de ${filtered.length} resultados · refine los filtros`;
      } else {
        status.textContent = `${filtered.length} resultado${filtered.length === 1 ? '' : 's'} de ${invCache.length} equipos`;
      }
    }

    if (!filtered.length) {
      if (cont) cont.innerHTML = '<div style="padding:14px;text-align:center;color:#90a4ae;">Sin resultados con esos filtros.</div>';
      return;
    }

    if (cont) cont.innerHTML = filtered.slice(0, 50).map(eq => {
      const safe = (s) => esc(s).replace(/'/g, "\\'");
      return `<div onclick="window.seleccionarEquipoDesinf('${eq.id}','${safe(eq.equipo)}','${safe(eq.marca)}','${safe(eq.modelo)}','${safe(eq.serie)}','${safe(eq.servicio)}','${safe(eq.sede)}',${Number(eq.item)||0})"
        style="padding:10px 12px;border-bottom:1px solid #eceff1;cursor:pointer;transition:background 0.15s;"
        onmouseover="this.style.background='#e3f2fd'" onmouseout="this.style.background='white'">
        <div style="font-weight:600;color:#0d47a1;">#${esc(String(eq.item))} · ${esc(eq.equipo)}</div>
        <div style="font-size:12px;color:#607d8b;">${esc(eq.marca)} ${esc(eq.modelo)} ${eq.serie ? '· serie '+esc(eq.serie) : ''}</div>
        <div style="font-size:11px;color:#90a4ae;">${esc(eq.servicio)} ${eq.sede ? '· '+esc(eq.sede) : ''}</div>
      </div>`;
    }).join('');
  }
  window.buscarEquipoDesinf = buscarMultiCampo;

  function seleccionarEquipo(id, equipo, marca, modelo, serie, servicio, sede, item) {
    state.selectedEquipo = { id, equipo, marca, modelo, serie, servicio, sede, item };
    const cont = document.getElementById('desinfNuevaEquipoSeleccionado');
    cont.style.display = 'block';
    cont.innerHTML = `<div style="background:#e8f5e9;border:1.5px solid #81c784;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
      <div style="flex:1;">
        <div style="font-weight:700;color:#1b5e20;">✅ ${esc(equipo)}</div>
        <div style="font-size:12px;color:#2e7d32;">${esc(marca)} ${esc(modelo)} ${serie ? '· serie '+esc(serie) : ''}</div>
        <div style="font-size:11px;color:#388e3c;">${esc(servicio)} ${sede ? '· '+esc(sede) : ''}</div>
      </div>
      <button type="button" onclick="window.limpiarEquipoDesinf()" style="background:none;border:none;color:#c62828;cursor:pointer;font-size:18px;font-weight:700;padding:0 4px;line-height:1;" title="Quitar selección">✕</button>
    </div>`;
    // Limpio los 4 campos de búsqueda y el dropdown — el equipo ya está seleccionado
    ['desinfSrchNombre','desinfSrchMarca','desinfSrchModelo','desinfSrchSerie'].forEach(idd => {
      const el = document.getElementById(idd); if (el) el.value = '';
    });
    document.getElementById('desinfNuevaResultados').innerHTML =
      '<div style="padding:10px;text-align:center;color:#607d8b;font-size:12px;">Equipo seleccionado. Use la X para cambiar.</div>';
    actualizarBotonGuardar();
  }
  window.seleccionarEquipoDesinf = seleccionarEquipo;

  function limpiarEquipoSeleccionado() {
    state.selectedEquipo = null;
    const cont = document.getElementById('desinfNuevaEquipoSeleccionado');
    if (cont) { cont.style.display = 'none'; cont.innerHTML = ''; }
    const res = document.getElementById('desinfNuevaResultados');
    if (res) res.innerHTML = '<div style="padding:14px;text-align:center;color:#90a4ae;font-size:12px;">Escriba en cualquier campo para filtrar resultados...</div>';
    actualizarBotonGuardar();
  }
  window.limpiarEquipoDesinf = limpiarEquipoSeleccionado;

  // ─────────────────────────────────────────────────────────────────────────
  // Captura de foto con la cámara del dispositivo (reemplaza el input file)
  // ─────────────────────────────────────────────────────────────────────────
  let camStream = null;
  let _modalObserver = null;

  async function abrirCamaraDesinf() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Este navegador no permite usar la cámara.\nSe requiere una conexión segura (HTTPS) y un navegador compatible.');
      return;
    }

    // Oculta la foto previa mientras se reabre la cámara
    const previewWrap = document.getElementById('desinfNuevaFotoPreviewWrap');
    if (previewWrap) previewWrap.style.display = 'none';

    const wrap     = document.getElementById('desinfNuevaCamWrap');
    const video    = document.getElementById('desinfNuevaVideo');
    const abrirBtn = document.getElementById('desinfNuevaAbrirCamBtn');

    try {
      cerrarCamaraDesinf(); // detener cualquier stream previo
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      if (video) {
        video.srcObject = camStream;
        try { await video.play(); } catch (e) { /* algunos navegadores reproducen solos */ }
      }
      if (wrap) wrap.style.display = 'block';
      if (abrirBtn) abrirBtn.style.display = 'none';
      _observarCierreModalDesinf();
    } catch (e) {
      const msg = (e && e.name === 'NotAllowedError')
        ? 'Permiso de cámara denegado. Habilítelo en los ajustes del navegador.'
        : 'No se pudo acceder a la cámara: ' + (e && e.message ? e.message : e);
      alert(msg);
    }
  }
  window.abrirCamaraDesinf = abrirCamaraDesinf;

  function capturarFotoDesinf() {
    const video = document.getElementById('desinfNuevaVideo');
    if (!video || !camStream) { alert('La cámara no está activa'); return; }
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) { alert('La cámara aún no está lista. Espere un momento e intente de nuevo.'); return; }

    // Redimensionar a máx. 1280 px lado mayor, JPEG 0.85 (igual que el resto del módulo)
    const max = 1280;
    let w = vw, h = vh;
    if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
    else if (h >= w && h > max) { w = Math.round(w * max / h); h = max; }

    let canvas = document.getElementById('desinfNuevaCanvas');
    if (!canvas) { canvas = document.createElement('canvas'); }
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';          // fondo negro típico de fotos UV
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(video, 0, 0, w, h);

    const b64 = canvas.toDataURL('image/jpeg', 0.85);
    state.fotoAntesBase64 = b64;

    const prev = document.getElementById('desinfNuevaFotoPreview');
    const previewWrap = document.getElementById('desinfNuevaFotoPreviewWrap');
    if (prev) prev.src = b64;
    if (previewWrap) previewWrap.style.display = 'block';

    cerrarCamaraDesinf();
    actualizarBotonGuardar();
  }
  window.capturarFotoDesinf = capturarFotoDesinf;

  function cerrarCamaraDesinf() {
    const wrap     = document.getElementById('desinfNuevaCamWrap');
    const video    = document.getElementById('desinfNuevaVideo');
    const abrirBtn = document.getElementById('desinfNuevaAbrirCamBtn');
    if (camStream) {
      try { camStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      camStream = null;
    }
    if (video) { try { video.pause(); } catch (e) {} video.srcObject = null; }
    if (wrap) wrap.style.display = 'none';
    if (abrirBtn) abrirBtn.style.display = '';
  }
  window.cerrarCamaraDesinf = cerrarCamaraDesinf;

  // Cierra cámara + modal (usado por botones Cancelar y ×)
  function cerrarModalNuevaMarcaUV() {
    cerrarCamaraDesinf();
    if (typeof closeModal === 'function') closeModal('desinfeccionNuevaModal');
  }
  window.cerrarModalNuevaMarcaUV = cerrarModalNuevaMarcaUV;

  // Detiene la cámara automáticamente si el modal se cierra por cualquier vía
  // (clic fuera, tecla Esc, etc.), observando cambios de visibilidad del modal.
  function _observarCierreModalDesinf() {
    if (_modalObserver || typeof MutationObserver === 'undefined') return;
    const m = document.getElementById('desinfeccionNuevaModal');
    if (!m) return;
    _modalObserver = new MutationObserver(() => {
      if (m.style.display === 'none' && camStream) cerrarCamaraDesinf();
    });
    _modalObserver.observe(m, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  function actualizarBotonGuardar() {
    const btn = document.getElementById('desinfNuevaGuardarBtn');
    if (!btn) return;
    btn.disabled = !(state.selectedEquipo && state.fotoAntesBase64);
  }

  async function guardarNuevaMarca() {
    if (!state.selectedEquipo) { alert('Seleccione un equipo del inventario'); return; }
    if (!state.fotoAntesBase64) { alert('Tome la foto del equipo con la cámara (con marcas UV visibles)'); return; }

    const btn = document.getElementById('desinfNuevaGuardarBtn');
    btn.disabled = true; btn.textContent = '⏳ Guardando...';
    try {
      const e = state.selectedEquipo;
      const fechaLocal = document.getElementById('desinfNuevaFecha').value || nowDatetimeLocal();
      const fechaISO = datetimeLocalToISO(fechaLocal);
      const tecnico = (document.getElementById('desinfNuevaTecnico').value || '').trim() || getNombreTecnico();
      const obs = (document.getElementById('desinfNuevaObs').value || '').trim();

      // 1. Crear el registro
      const fields = {
        'Equipo':                e.equipo,
        'Marca':                 e.marca,
        'Modelo':                e.modelo,
        'Serie':                 e.serie,
        'Servicio':              e.servicio,
        'Sede':                  e.sede,
        'Item':                  e.item,
        'Inventario Record ID':  e.id,
        'Fecha Marcado':         fechaISO,
        'Ingeniero Marcado':     tecnico,
        'Estado':                'Marcado',
        'Resultado':             '',
        'Observaciones':         obs,
      };
      btn.textContent = '⏳ Creando registro...';
      const createRes = await axios.post(`${API_BASE_URL}/desinfeccion`, { fields }, { headers: { ...getAuth(), 'Content-Type': 'application/json' } });
      if (!createRes.data || !createRes.data.ok || !createRes.data.record) {
        throw new Error('No se pudo crear el registro');
      }
      const newId = createRes.data.record.id;

      // 2. Subir foto a "Foto Antes"
      btn.textContent = '⏳ Subiendo foto...';
      const fechaTag = fechaLocal.slice(0, 10);
      const fn = `marca_uv_${(e.equipo || 'equipo').replace(/[^a-z0-9]/gi,'_').slice(0,40)}_${fechaTag}.jpg`;
      const upRes = await axios.post(`${API_BASE_URL}/upload-pdf`, {
        recordId:    newId,
        fieldName:   'Foto Antes',
        filename:    fn,
        contentType: 'image/jpeg',
        base64:      state.fotoAntesBase64,
        tableName:   'Desinfeccion',
      }, { headers: { ...getAuth(), 'Content-Type': 'application/json' } });

      if (!upRes.data || !upRes.data.ok) {
        console.warn('La foto no se subió, pero el registro quedó creado:', upRes.data);
        alert('Registro creado pero la foto no se pudo subir. Puede subirla manualmente desde Airtable o reintentar.\nDetalle: ' + (upRes.data && upRes.data.error || 'error desconocido'));
      }

      btn.textContent = '✅ Guardado';
      setTimeout(() => {
        if (typeof closeModal === 'function') closeModal('desinfeccionNuevaModal');
        loadDesinfeccion(true);
      }, 600);

    } catch (err) {
      const errMsg = safeErr(err);
      console.error('❌ Error guardando:', err);
      console.error('❌ Detalle de la respuesta del servidor:', err && err.response && err.response.data);
      const hint = /unknown field name|UNKNOWN_FIELD_NAME/i.test(errMsg)
        ? '\n\n💡 Pista: un nombre de campo no coincide entre el código y su tabla de Airtable. Verifique que el campo entre comillas exista con el nombre exacto.'
        : '';
      alert('Error al guardar:\n\n' + errMsg + hint);
      btn.disabled = false; btn.textContent = 'Guardar marca';
    }
  }
  window.guardarNuevaMarcaUV = guardarNuevaMarca;

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL: VERIFICAR LIMPIEZA (paso 2)
  // ─────────────────────────────────────────────────────────────────────────
  async function abrirVerificar(id) {
    const rec = state.records.find(r => r.id === id);
    if (!rec) { alert('Registro no encontrado, recargue la lista.'); return; }
    state.selectedDesinfeccionId = id;
    state.fotoDespuesBase64 = null;

    const f = rec.fields || {};
    const info = document.getElementById('desinfVerifInfo');
    if (info) {
      info.innerHTML = `<div style="background:#f5f7fa;border-radius:8px;padding:12px;">
        <div style="font-weight:700;color:#0d47a1;font-size:15px;">${esc(f['Equipo']||'')}</div>
        <div style="font-size:12px;color:#607d8b;">${esc(f['Marca']||'')} ${esc(f['Modelo']||'')} ${f['Serie']?'· serie '+esc(f['Serie']):''}</div>
        <div style="font-size:11px;color:#90a4ae;">${esc(f['Servicio']||'')} ${f['Sede']?'· '+esc(f['Sede']):''}</div>
        <div style="font-size:11px;color:#1565c0;margin-top:8px;">📅 Marcado: <strong>${formatDateTime(f['Fecha Marcado'])}</strong> por ${esc(f['Ingeniero Marcado']||'—')}</div>
      </div>`;
    }
    // Foto antes (si existe)
    const fotoAntesCont = document.getElementById('desinfVerifFotoAntes');
    if (fotoAntesCont) {
      const atts = Array.isArray(f['Foto Antes']) ? f['Foto Antes'] : [];
      if (atts.length && atts[0].url) {
        fotoAntesCont.innerHTML = `<div style="text-align:center;">
          <div style="font-size:11px;color:#607d8b;margin-bottom:6px;font-weight:600;">📷 Foto Antes (con marcas UV)</div>
          <a href="${esc(atts[0].url)}" target="_blank">
            <img src="${esc(atts[0].url)}" style="max-width:100%;max-height:240px;border:2px solid #1565c0;border-radius:8px;">
          </a>
        </div>`;
      } else {
        fotoAntesCont.innerHTML = `<div style="text-align:center;font-size:12px;color:#90a4ae;padding:24px;background:#eceff1;border-radius:8px;">
          Sin foto antes registrada.
        </div>`;
      }
    }
    document.getElementById('desinfVerifFecha').value = nowDatetimeLocal();
    document.getElementById('desinfVerifTecnico').value = getNombreTecnico();
    document.getElementById('desinfVerifObs').value = '';
    const prev = document.getElementById('desinfVerifFotoPreview');
    if (prev) { prev.src = ''; prev.style.display = 'none'; }
    const fi = document.getElementById('desinfVerifFotoInput');
    if (fi) fi.value = '';
    // Resetear botones cumple/no cumple
    window.__desinfResultado = null;
    actualizarBotonesResultado();

    if (typeof openModal === 'function') openModal('desinfeccionVerificarModal');
    else {
      const m = document.getElementById('desinfeccionVerificarModal');
      if (m) { m.style.display = 'block'; m.classList.add('active'); }
    }
  }
  window.openVerificarLimpieza = abrirVerificar;

  function setResultado(val) {
    window.__desinfResultado = val;
    actualizarBotonesResultado();
  }
  window.setResultadoDesinf = setResultado;

  function actualizarBotonesResultado() {
    const btnC = document.getElementById('desinfBtnCumple');
    const btnN = document.getElementById('desinfBtnNoCumple');
    const val = window.__desinfResultado;
    if (btnC) {
      if (val === 'Cumple') {
        btnC.style.background = '#2e7d32'; btnC.style.color = '#fff';
        btnC.style.boxShadow = '0 4px 12px rgba(46,125,50,0.4)';
      } else {
        btnC.style.background = '#fff'; btnC.style.color = '#2e7d32';
        btnC.style.boxShadow = 'none';
      }
    }
    if (btnN) {
      if (val === 'No Cumple') {
        btnN.style.background = '#c62828'; btnN.style.color = '#fff';
        btnN.style.boxShadow = '0 4px 12px rgba(198,40,40,0.4)';
      } else {
        btnN.style.background = '#fff'; btnN.style.color = '#c62828';
        btnN.style.boxShadow = 'none';
      }
    }
    const guardar = document.getElementById('desinfVerifGuardarBtn');
    if (guardar) {
      guardar.disabled = !(val && state.fotoDespuesBase64);
    }
  }

  async function onFotoDespuesSeleccionada(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const b64 = await fileToResizedBase64(file, 1280);
      state.fotoDespuesBase64 = b64;
      const prev = document.getElementById('desinfVerifFotoPreview');
      if (prev) { prev.src = b64; prev.style.display = 'block'; }
      actualizarBotonesResultado();
    } catch (e) {
      alert('No se pudo procesar la imagen: ' + e.message);
    }
  }
  window.onFotoDespuesDesinf = onFotoDespuesSeleccionada;

  async function guardarVerificacion() {
    const id = state.selectedDesinfeccionId;
    if (!id) { alert('Sin registro seleccionado'); return; }
    const resultado = window.__desinfResultado;
    if (!resultado) { alert('Marque CUMPLE o NO CUMPLE'); return; }
    if (!state.fotoDespuesBase64) { alert('Tome o cargue la foto después (con linterna UV)'); return; }

    const btn = document.getElementById('desinfVerifGuardarBtn');
    btn.disabled = true; btn.textContent = '⏳ Guardando verificación...';
    try {
      const fechaLocal = document.getElementById('desinfVerifFecha').value || nowDatetimeLocal();
      const fechaISO = datetimeLocalToISO(fechaLocal);
      const tecnico = (document.getElementById('desinfVerifTecnico').value || '').trim() || getNombreTecnico();
      const obs = (document.getElementById('desinfVerifObs').value || '').trim();

      // 1. PATCH del registro
      const patchBody = {
        id,
        fields: {
          'Fecha Verificacion':     fechaISO,
          'Ingeniero Verificacion': tecnico,
          'Resultado':              resultado,
          'Estado':                 'Verificado',
          'Observaciones':          obs,
        }
      };
      const patchRes = await axios.patch(`${API_BASE_URL}/desinfeccion`, patchBody, {
        headers: { ...getAuth(), 'Content-Type': 'application/json' }
      });
      if (!patchRes.data || !patchRes.data.ok) {
        throw new Error('No se pudo actualizar: ' + (patchRes.data && patchRes.data.error || ''));
      }

      // 2. Subir foto a "Foto Despues"
      btn.textContent = '⏳ Subiendo foto...';
      const fechaTag = fechaLocal.slice(0, 10);
      const fn = `verif_uv_${resultado.replace(/ /g,'_')}_${fechaTag}.jpg`;
      const upRes = await axios.post(`${API_BASE_URL}/upload-pdf`, {
        recordId:    id,
        fieldName:   'Foto Despues',
        filename:    fn,
        contentType: 'image/jpeg',
        base64:      state.fotoDespuesBase64,
        tableName:   'Desinfeccion',
      }, { headers: { ...getAuth(), 'Content-Type': 'application/json' } });

      if (!upRes.data || !upRes.data.ok) {
        console.warn('La foto después no se subió:', upRes.data);
        alert('Verificación guardada pero la foto no se pudo subir.\n' + (upRes.data && upRes.data.error || ''));
      }

      btn.textContent = '✅ Guardado';
      setTimeout(() => {
        if (typeof closeModal === 'function') closeModal('desinfeccionVerificarModal');
        loadDesinfeccion(true);
      }, 600);

    } catch (err) {
      const errMsg = safeErr(err);
      console.error('❌ Error verificando:', err);
      console.error('❌ Detalle de la respuesta del servidor:', err && err.response && err.response.data);
      const hint = /unknown field name|UNKNOWN_FIELD_NAME/i.test(errMsg)
        ? '\n\n💡 Pista: un nombre de campo no coincide entre el código y su tabla de Airtable. Verifique que el campo entre comillas exista con el nombre exacto.'
        : '';
      alert('Error al guardar verificación:\n\n' + errMsg + hint);
      btn.disabled = false; btn.textContent = 'Guardar verificación';
    }
  }
  window.guardarVerificacionDesinf = guardarVerificacion;

  // ─────────────────────────────────────────────────────────────────────────
  // VISTA SOLO LECTURA (registros ya verificados)
  // ─────────────────────────────────────────────────────────────────────────
  function verDetalle(id) {
    const rec = state.records.find(r => r.id === id);
    if (!rec) { alert('No se encontró'); return; }
    const f = rec.fields || {};
    const atAntes = Array.isArray(f['Foto Antes'])    ? f['Foto Antes']    : [];
    const atDesp  = Array.isArray(f['Foto Despues'])  ? f['Foto Despues']  : [];
    const cont = document.getElementById('desinfDetalleBody');
    const resultado = String(f['Resultado'] || '').trim();
    const cumple = resultado.toLowerCase() === 'cumple';
    const badge = cumple
      ? `<span style="background:#e8f5e9;color:#1b5e20;padding:6px 16px;border-radius:14px;font-weight:700;border:2px solid #66bb6a;">✅ CUMPLE</span>`
      : resultado
        ? `<span style="background:#ffebee;color:#b71c1c;padding:6px 16px;border-radius:14px;font-weight:700;border:2px solid #ef5350;">❌ NO CUMPLE</span>`
        : `<span style="background:#eceff1;color:#455a64;padding:6px 16px;border-radius:14px;">Pendiente</span>`;

    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="margin:0;color:#0d47a1;">${esc(f['Equipo']||'')}</h3>
        ${badge}
      </div>
      <div style="background:#f5f7fa;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;">
        <div><strong>Marca/Modelo:</strong> ${esc(f['Marca']||'')} ${esc(f['Modelo']||'')}</div>
        <div><strong>Serie:</strong> ${esc(f['Serie']||'—')}</div>
        <div><strong>Servicio:</strong> ${esc(f['Servicio']||'—')} · ${esc(f['Sede']||'')}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
        <div>
          <div style="font-weight:700;color:#1565c0;margin-bottom:6px;">📷 Foto Antes (marcas UV)</div>
          <div style="font-size:12px;color:#607d8b;margin-bottom:6px;">Marcado: ${formatDateTime(f['Fecha Marcado'])}<br>Ingeniero: ${esc(f['Ingeniero Marcado']||'—')}</div>
          ${atAntes.length && atAntes[0].url
            ? `<a href="${esc(atAntes[0].url)}" target="_blank"><img src="${esc(atAntes[0].url)}" style="width:100%;border:2px solid #1565c0;border-radius:8px;"></a>`
            : '<div style="padding:30px;text-align:center;background:#eceff1;color:#90a4ae;border-radius:8px;">Sin foto</div>'}
        </div>
        <div>
          <div style="font-weight:700;color:${cumple?'#2e7d32':'#c62828'};margin-bottom:6px;">🔦 Foto Después (linterna UV)</div>
          <div style="font-size:12px;color:#607d8b;margin-bottom:6px;">Verificado: ${formatDateTime(f['Fecha Verificacion'])}<br>Ingeniero: ${esc(f['Ingeniero Verificacion']||'—')}</div>
          ${atDesp.length && atDesp[0].url
            ? `<a href="${esc(atDesp[0].url)}" target="_blank"><img src="${esc(atDesp[0].url)}" style="width:100%;border:2px solid ${cumple?'#2e7d32':'#c62828'};border-radius:8px;"></a>`
            : '<div style="padding:30px;text-align:center;background:#eceff1;color:#90a4ae;border-radius:8px;">Sin foto</div>'}
        </div>
      </div>
      ${f['Observaciones'] ? `<div style="background:#fffde7;border-left:4px solid #fbc02d;padding:10px 14px;border-radius:6px;font-size:13px;">
        <strong>Observaciones:</strong> ${esc(f['Observaciones'])}
      </div>` : ''}
    `;
    if (typeof openModal === 'function') openModal('desinfeccionDetalleModal');
    else {
      const m = document.getElementById('desinfeccionDetalleModal');
      if (m) { m.style.display = 'block'; m.classList.add('active'); }
    }
  }
  window.openDesinfeccionDetalle = verDetalle;

  // ─────────────────────────────────────────────────────────────────────────
  // Exports globales
  // ─────────────────────────────────────────────────────────────────────────
  window.loadDesinfeccion          = loadDesinfeccion;
  window.debouncedDesinfeccionSearch = debouncedSearch;
  window.setDesinfeccionFiltro     = setFiltro;

  console.log('✅ Módulo Desinfección de Equipos Biomédicos cargado');
})();
