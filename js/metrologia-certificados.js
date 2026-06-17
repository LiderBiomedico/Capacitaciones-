/* =============================================================================
 * metrologia-certificados.js
 * Certificador de calibración ISO/IEC 17025 · Metrología Biomédica · NEXA
 * Arquitectura extensible por TIPO de equipo (TIPOS registry).
 * =========================================================================== */
(function(){
  'use strict';

  var API = '/.netlify/functions';
  var SK = { token:'NEXA_MET_TOKEN', user:'NEXA_MET_USER', name:'NEXA_MET_NAME', nivel:'NEXA_MET_NIVEL' };
  var NIVELES_OK = ['metrologia','total'];
  var TABLA = 'Certificados Metrologia';

  var STATE = { tipo:'presion', inv:null, invLoading:false, patrones:[], resultadoSel:'' };

  // Tarjetas de "Tipo de certificado" (Genérico retirado). El orden define cuál queda activa por defecto.
  var TIPO_CARDS = [
    { tipo:'presion', icon:'🩺', title:'Tensiómetro', sub:'Presión no invasiva (mmHg) · GUM' },
    { tipo:'ecg',     icon:'❤️', title:'Electrocardiógrafo', sub:'FC + seguridad eléctrica IEC 60601' }
  ];

  // ── utils ─────────────────────────────────────────────
  function $(id){ return document.getElementById(id); }
  function $$(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function val(id){ var e=$(id); return e? (e.value||'').trim() : ''; }
  function getToken(){ return sessionStorage.getItem(SK.token)||''; }
  function authHeaders(){ return { 'Authorization':'Bearer '+getToken() }; }
  function toast(msg,kind){ var t=$('toast'); t.textContent=msg; t.className=(kind||'')+' show'; setTimeout(function(){ t.className=t.className.replace('show','').trim(); }, 3600); }
  function todayISO(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function addYearISO(iso,yrs){ if(!iso) return ''; var p=iso.split('-'); if(p.length!==3) return ''; return (parseInt(p[0],10)+(yrs||1))+'-'+p[1]+'-'+p[2]; }
  function fmtFecha(iso){ if(!iso) return '—'; var p=String(iso).slice(0,10).split('-'); return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):iso; }
  function toNum(s){ var n=parseFloat(String(s).replace(',','.')); return isNaN(n)?null:n; }
  function fmtN(n,d){ if(n===null||n===undefined||isNaN(n)) return ''; return Number(n).toFixed(d===undefined?3:d).replace('.',','); }

  // ── LOGIN ─────────────────────────────────────────────
  window.doLogin = function(){
    var u=val('lgUser'), p=($('lgPass').value||'').trim(), err=$('lgErr'), btn=$('lgBtn'), txt=$('lgTxt');
    err.textContent='';
    if(!u){ err.textContent='Ingrese el usuario'; $('lgUser').focus(); return; }
    if(!p){ err.textContent='Ingrese la contraseña'; $('lgPass').focus(); return; }
    btn.disabled=true; txt.innerHTML='<span class="spin"></span> Verificando…';
    fetch(API+'/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})})
      .then(function(r){return r.json();})
      .then(function(d){
        btn.disabled=false; txt.textContent='Ingresar';
        if(!d||!d.success){ err.textContent=(d&&d.error)||'Usuario o contraseña incorrectos'; return; }
        var nivel=String(d.nivel||'').toLowerCase();
        if(NIVELES_OK.indexOf(nivel)===-1){ err.textContent='Este módulo es exclusivo de Metrología.'; return; }
        sessionStorage.setItem(SK.token,d.token||''); sessionStorage.setItem(SK.user,d.usuario||u);
        sessionStorage.setItem(SK.name,d.nombre||d.usuario||u); sessionStorage.setItem(SK.nivel,nivel);
        showApp();
      })
      .catch(function(){ btn.disabled=false; txt.textContent='Ingresar'; err.textContent='Error de conexión. Intente de nuevo.'; });
  };
  window.doLogout = function(){
    [SK.token,SK.user,SK.name,SK.nivel].forEach(function(k){ sessionStorage.removeItem(k); });
    $('appView').style.display='none'; $('loginView').style.display='flex';
    $('lgPass').value=''; $('lgErr').textContent='';
  };

  function setupTipoCards(){
    var grid=$('typeGrid'); if(!grid) return;
    grid.innerHTML = TIPO_CARDS.map(function(t,i){
      return '<div class="type-card'+(i===0?' active':'')+'" data-tipo="'+t.tipo+'" onclick="setTipo(this)" style="text-align:center;cursor:pointer">'+
        '<div style="font-size:30px;line-height:1;margin-bottom:6px">'+t.icon+'</div>'+
        '<div style="font-weight:800;color:#1e3a8a;font-size:15px">'+esc(t.title)+'</div>'+
        '<div style="font-size:12px;color:#64748b;margin-top:3px">'+esc(t.sub)+'</div>'+
      '</div>';
    }).join('');
    STATE.tipo = TIPO_CARDS[0].tipo;
  }
  function setIfEmpty(id,v){ var e=$(id); if(e && !(e.value||'').trim()) e.value=v; }
  function prefillDefaults(){
    // Laboratorio emisor (fijo): NOVAMEDICAL S.A.S.
    setIfEmpty('cLabNombre','NOVAMEDICAL S.A.S.');
    setIfEmpty('cLabDir','Calle 8 N° 18-85, Barrio La Esmeralda, Popayán');
    setIfEmpty('cLabTel','Tel: 8356668 · Cel: 3007912693 - 3006603723 · novamedicalpopayan@gmail.com');
    // Cliente por defecto: HSLV (editable para otros clientes)
    setIfEmpty('cCliNombre','HOSPITAL SUSANA LOPEZ DE VALENCIA');
    setIfEmpty('cCliNit','891501676-1');
    setIfEmpty('cCliDir','Calle 15 # 17A-196, La Ladera, Popayán');
    setIfEmpty('cCliTel','8211721');
    // Firmas por defecto (editables)
    setIfEmpty('cMetrologo','ING. PAUL EDUARDO MUÑOZ R.');
    setIfEmpty('cMetrologoCargo','Esp. Electromedicina y GTH · MSc. Automática');
    setIfEmpty('cReviso','ING. LIZETH NATALIA VICTORIA M.');
    setIfEmpty('cRevisoCargo','Esp. Ingeniería Clínica');
  }

  function showApp(){
    $('loginView').style.display='none'; $('appView').style.display='block';
    $('uName').textContent = sessionStorage.getItem(SK.name)||'—';
    $('cMetrologo').value = sessionStorage.getItem(SK.name)||'';
    $('cRecepcion').value = todayISO(); $('cFecha').value = todayISO(); $('cProxima').value = addYearISO(todayISO(),1);
    if(STATE.patrones.length===0) addPatron();
    setupTipoCards();
    prefillDefaults();
    applyTipoDefaults(STATE.tipo);
    if(TIPOS[STATE.tipo]&&TIPOS[STATE.tipo].renderForm) TIPOS[STATE.tipo].renderForm($('typeHost'));
    loadNextNumber(); loadInventory();
  }

  // ── TABS ──────────────────────────────────────────────
  window.setTab = function(t){
    var nuevo=t==='nuevo';
    $('tabNuevo').classList.toggle('active',nuevo); $('tabLista').classList.toggle('active',!nuevo);
    $('viewNuevo').style.display=nuevo?'block':'none'; $('viewLista').style.display=nuevo?'none':'block';
    if(!nuevo) loadGuardados();
  };

  // ── INVENTARIO ────────────────────────────────────────
  function loadInventory(){
    if(STATE.inv||STATE.invLoading){ if(STATE.inv) $('eqStatus').textContent=STATE.inv.length+' equipos disponibles para buscar'; return; }
    STATE.invLoading=true;
    var all=[], offset=null, safety=0;
    (function step(){
      safety++;
      var qs=new URLSearchParams({pageSize:'100'}); if(offset) qs.set('offset',offset);
      fetch(API+'/inventario?'+qs.toString(),{headers:authHeaders()}).then(function(r){return r.json();})
        .then(function(d){
          var recs=(d&&(d.records||d.data))||[];
          all=all.concat(recs.map(function(r){ var f=r.fields||{}; return {
            equipo:f['Equipo']||'', marca:f['Marca']||'', modelo:f['Modelo']||'', serie:f['Serie']||'',
            placa:f['Numero de Placa']||'', servicio:f['Servicio']||'', sede:f['Sede']||'' }; }));
          offset=(d&&d.offset)||null;
          if(offset&&safety<30) step();
          else { STATE.inv=all; STATE.invLoading=false; $('eqStatus').textContent=all.length+' equipos disponibles para buscar'; }
        })
        .catch(function(){ STATE.invLoading=false; $('eqStatus').textContent='No se pudo cargar el inventario (puede escribir los datos manualmente).'; });
    })();
  }
  window.filterEquipos = function(){
    var q=val('eqSearch').toLowerCase(), cont=$('eqResults');
    if(!STATE.inv||!q){ cont.style.display='none'; return; }
    var f=STATE.inv.filter(function(e){ return (e.equipo+' '+e.marca+' '+e.modelo+' '+e.serie+' '+e.placa).toLowerCase().indexOf(q)!==-1; }).slice(0,40);
    cont.style.display='block';
    cont.innerHTML = f.length ? f.map(function(e){
      return '<div class="row" onclick="selEquipo(\''+encodeURIComponent(JSON.stringify(e))+'\')"><b>'+esc(e.equipo)+'</b><div>'+esc(e.marca)+' '+esc(e.modelo)+(e.serie?' · serie '+esc(e.serie):'')+' · '+esc(e.servicio)+'</div></div>';
    }).join('') : '<div class="row"><div>Sin coincidencias.</div></div>';
  };
  window.selEquipo = function(enc){
    var e; try{ e=JSON.parse(decodeURIComponent(enc)); }catch(_){ return; }
    $('cEquipo').value=e.equipo||''; $('cMarca').value=e.marca||''; $('cModelo').value=e.modelo||'';
    $('cSerie').value=e.serie||''; $('cPlaca').value=e.placa||''; $('cServicio').value=e.servicio||'';
    $('eqResults').style.display='none'; $('eqSearch').value='';
    var sel=$('eqSelected'); sel.style.display='block';
    sel.innerHTML='<div class="sel-eq"><div><b>✓ '+esc(e.equipo)+'</b><div style="font-size:12px;color:#2e7d32">'+esc(e.marca)+' '+esc(e.modelo)+(e.serie?' · serie '+esc(e.serie):'')+'</div></div><button class="x" onclick="clearEquipo()">✕</button></div>';
  };
  window.clearEquipo = function(){ $('eqSelected').style.display='none'; $('eqSelected').innerHTML=''; };

  // ── PATRONES ──────────────────────────────────────────
  window.addPatron = function(){ STATE.patrones.push({nombre:'',marca:'',modelo:'',serie:'',certificado:'',fechaCal:'',proximaCal:'',trazabilidad:''}); renderPatrones(); };
  window.delPatron = function(i){ STATE.patrones.splice(i,1); if(STATE.patrones.length===0) addPatron(); else renderPatrones(); };
  function renderPatrones(){
    $('patronList').innerHTML = STATE.patrones.map(function(p,i){
      return '<div class="patron"><span class="pn">PATRÓN '+(i+1)+'</span>'+(STATE.patrones.length>1?'<button class="del" onclick="delPatron('+i+')">✕</button>':'')+
        '<div class="grid g3">'+
          fld('Equipo patrón','p_nombre_'+i,p.nombre)+
          fld('Marca','p_marca_'+i,p.marca)+
          fld('Modelo','p_modelo_'+i,p.modelo)+
          fld('N° de serie','p_serie_'+i,p.serie)+
          fld('N° certificado patrón','p_cert_'+i,p.certificado)+
          fld('Trazabilidad (laboratorio/organismo)','p_traz_'+i,p.trazabilidad)+
        '</div>'+
        '<div class="grid g2" style="margin-top:10px">'+
          fldDate('Fecha calibración del patrón','p_fcal_'+i,p.fechaCal)+
          fldDate('Próxima calibración del patrón','p_pcal_'+i,p.proximaCal)+
        '</div></div>';
    }).join('');
  }
  function fld(label,id,v){ return '<div class="f"><label>'+label+'</label><input id="'+id+'" type="text" value="'+esc(v)+'" oninput="syncPatrones()"></div>'; }
  function fldDate(label,id,v){ return '<div class="f"><label>'+label+'</label><input id="'+id+'" type="date" value="'+esc(v)+'" oninput="syncPatrones()"></div>'; }
  window.syncPatrones = function(){
    STATE.patrones.forEach(function(p,i){
      p.nombre=val('p_nombre_'+i); p.marca=val('p_marca_'+i); p.modelo=val('p_modelo_'+i); p.serie=val('p_serie_'+i);
      p.certificado=val('p_cert_'+i); p.trazabilidad=val('p_traz_'+i); p.fechaCal=val('p_fcal_'+i); p.proximaCal=val('p_pcal_'+i);
    });
  };

  // ── TIPO ──────────────────────────────────────────────
  function applyTipoDefaults(tipo){
    var d=(TIPOS[tipo]&&TIPOS[tipo].defaults)||{};
    if(d.magnitud!==undefined) $('cMagnitud').value=d.magnitud;
    if(d.unidad!==undefined) $('cUnidad').value=d.unidad;
    if(d.metodo!==undefined) $('cMetodo').value=d.metodo;
  }
  window.setTipo = function(el){
    STATE.tipo = el.getAttribute('data-tipo');
    $$('#typeGrid .type-card').forEach(function(c){ c.classList.toggle('active', c===el); });
    applyTipoDefaults(STATE.tipo);
    TIPOS[STATE.tipo].renderForm($('typeHost'));
  };

  // ── RESULTADO ─────────────────────────────────────────
  window.setResultado = function(el){
    STATE.resultadoSel = el.getAttribute('data-res');
    $$('#resOpts .res-opt').forEach(function(o){ o.classList.toggle('active', o===el); });
  };

  // ── NÚMERO ────────────────────────────────────────────
  function loadNextNumber(){
    fetch(API+'/metrologia-certificados?action=next-number',{headers:authHeaders()}).then(function(r){return r.json();})
      .then(function(d){ if(d&&d.ok&&d.numero&&!val('cNumero')) $('cNumero').value=d.numero; }).catch(function(){});
  }

  // ── COLLECT ───────────────────────────────────────────
  function buildCondiciones(){ var a=[]; if(val('cTemp')) a.push('Temperatura: '+val('cTemp')+' °C'); if(val('cHum')) a.push('Humedad relativa: '+val('cHum')+' %'); if(val('cPres')) a.push('Presión: '+val('cPres')); return a.join('  |  '); }
  function collectCommon(){
    syncPatrones();
    return {
      tipo: STATE.tipo, tipoNombre: TIPOS[STATE.tipo].nombre,
      numero: val('cNumero'), recepcion: val('cRecepcion'), fecha: val('cFecha'), proxima: val('cProxima'),
      equipo:val('cEquipo'), marca:val('cMarca'), modelo:val('cModelo'), serie:val('cSerie'),
      placa:val('cPlaca'), servicio:val('cServicio'), estadoItem:val('cEstadoItem'), resEquipo:val('cResEquipo'), rango:val('cRango'),
      lab:{ nombre:val('cLabNombre'), dir:val('cLabDir'), tel:val('cLabTel'), acred:val('cLabAcred') },
      cliente:{ nombre:val('cCliNombre'), nit:val('cCliNit'), dir:val('cCliDir'), tel:val('cCliTel') },
      sede: val('cLabNombre'),
      magnitud:val('cMagnitud'), unidad:val('cUnidad'), metodo:val('cMetodo'), lugar:val('cLugar'),
      condiciones: buildCondiciones(), temp:val('cTemp'), humedad:val('cHum'), presion:val('cPres'),
      patron: STATE.patrones.map(function(p){ return [p.nombre,p.marca,p.modelo,p.serie?('S/N '+p.serie):'',p.certificado?('Cert. '+p.certificado):''].filter(Boolean).join(' · '); }).join('\n'),
      patrones: JSON.parse(JSON.stringify(STATE.patrones)),
      resultado: STATE.resultadoSel, regla: val('cRegla'), observaciones: val('cObs'),
      metrologo: val('cMetrologo'), metrologoCargo: val('cMetrologoCargo'), reviso: val('cReviso'), revisoCargo: val('cRevisoCargo')
    };
  }
  function collect(){
    var c = collectCommon();
    var tipoData = TIPOS[STATE.tipo].collect() || {};
    c.datos = { temp:c.temp, humedad:c.humedad, presion:c.presion, patrones:c.patrones,
                lab:c.lab, cliente:c.cliente, regla:c.regla, estadoItem:c.estadoItem,
                resEquipo:c.resEquipo, rango:c.rango, recepcion:c.recepcion, metrologoCargo:c.metrologoCargo,
                revisoCargo:c.revisoCargo, lugar:c.lugar, tipo:c.tipo };
    c.datos[c.tipo] = tipoData;
    c.incertidumbre = tipoData.incertidumbreResumen || c.incertidumbre || '';
    return c;
  }
  function validar(c){
    if(!c.equipo){ toast('Indique el equipo a calibrar','err'); return false; }
    if(!c.fecha){ toast('Indique la fecha de calibración','err'); return false; }
    if(!c.magnitud){ toast('Indique la magnitud','err'); return false; }
    if(!c.resultado){ toast('Seleccione la conclusión / resultado','err'); return false; }
    var v = TIPOS[c.tipo].validar ? TIPOS[c.tipo].validar(c.datos[c.tipo]) : null;
    if(v){ toast(v,'err'); return false; }
    return true;
  }

  // Exponer helpers usados por la parte 2 (PDF/tipos) vía objeto global interno
  window.__MET = {
    $:$, $$:$$, esc:esc, val:val, toNum:toNum, fmtN:fmtN, fmtFecha:fmtFecha, toast:toast,
    todayISO:todayISO, addYearISO:addYearISO, STATE:STATE, API:API, TABLA:TABLA,
    authHeaders:authHeaders, collect:collect, validar:validar, loadNextNumber:loadNextNumber,
    resetCommon:function(){
      ['cEquipo','cMarca','cModelo','cSerie','cPlaca','cServicio','cMagnitud','cUnidad','cMetodo','cLugar','cTemp','cHum','cPres','cObs','cReviso','cRevisoCargo','cCliNit','cCliTel','cResEquipo','cRango'].forEach(function(id){ if($(id)) $(id).value=''; });
      $('cEstadoItem').value='Operativo, sin daño aparente';
      $('cRecepcion').value=todayISO(); $('cFecha').value=todayISO(); $('cProxima').value=addYearISO(todayISO(),1);
      $('cNumero').value=''; STATE.resultadoSel='';
      $$('#resOpts .res-opt').forEach(function(o){ o.classList.remove('active'); });
      STATE.patrones=[]; addPatron();
      applyTipoDefaults(STATE.tipo); TIPOS[STATE.tipo].renderForm($('typeHost'));
      prefillDefaults();
      clearEquipo();
    }
  };

  // TIPOS se define en la parte 2 (más abajo, mismo archivo)
  var TIPOS = window.__TIPOS = {};

  // ── LISTA ─────────────────────────────────────────────
  window.loadGuardados = function(){
    var cont=$('listaBody'); cont.innerHTML='<div class="muted" style="padding:14px;text-align:center">Cargando…</div>';
    fetch(API+'/metrologia-certificados?action=list',{headers:authHeaders()}).then(function(r){return r.json();})
      .then(function(d){
        if(!d||!d.ok){ cont.innerHTML='<div class="muted" style="padding:14px">No se pudo cargar: '+esc((d&&d.error)||'')+'</div>'; return; }
        var cs=d.certificados||[];
        if(!cs.length){ cont.innerHTML='<div class="muted" style="padding:18px;text-align:center">Aún no hay certificados emitidos.</div>'; return; }
        var rows=cs.map(function(c){
          var cls=c.resultado.indexOf('NO APTO')===0?'no':(c.resultado.indexOf('OBSERV')>-1?'obs':'ok');
          return '<tr><td><b>'+esc(c.numero)+'</b></td><td>'+esc(c.equipo)+'<div class="muted">'+esc(c.marca)+' '+esc(c.modelo)+'</div></td><td>'+esc(fmtFecha(c.fecha))+'</td><td>'+esc(c.magnitud)+'</td><td><span class="pill '+cls+'">'+esc(c.resultado||'—')+'</span></td><td>'+(c.pdfUrl?'<a class="link-pdf" href="'+esc(c.pdfUrl)+'" target="_blank">📄 Ver PDF</a>':'<span class="muted">—</span>')+'</td></tr>';
        }).join('');
        cont.innerHTML='<div style="overflow-x:auto"><table class="gtable"><thead><tr><th>N°</th><th>Equipo</th><th>Fecha</th><th>Magnitud</th><th>Resultado</th><th>PDF</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
      })
      .catch(function(){ cont.innerHTML='<div class="muted" style="padding:14px">Error de conexión.</div>'; });
  };

  // ── INIT (lo dispara la parte 2, tras registrar los TIPOS) ────────────
  // El <script> va al final del <body>, por lo que todo el DOM ya existe.
  function init(){ if(getToken()){ showApp(); } else { $('loginView').style.display='flex'; } }
  window.__MET.init = function(){ try{ init(); }catch(e){ if(typeof console!=='undefined') console.error(e); } };
})();
/* === metrologia-certificados.js · PARTE 2: tipos, incertidumbre y PDF ISO 17025 === */
(function(){
  'use strict';
  var M = window.__MET, T = window.__TIPOS;
  var $=M.$, $$=M.$$, esc=M.esc, val=M.val, toNum=M.toNum, fmtN=M.fmtN, fmtFecha=M.fmtFecha, toast=M.toast;

  // ───────────────────────── TIPO: GENÉRICO ─────────────────────────
  T.generico = {
    nombre:'Genérico',
    defaults:{ magnitud:'', unidad:'', metodo:'Comparación directa con patrón de referencia' },
    renderForm:function(host){
      host.innerHTML =
        '<div class="card"><h3>📊 Resultados de las mediciones</h3>'+
        '<div style="overflow-x:auto"><table class="tbl"><thead><tr>'+
        '<th style="width:34px">#</th><th>Valor patrón / nominal</th><th>Lectura del equipo</th><th>Error</th><th>Incert. (k=2)</th><th>Tolerancia / EMP</th><th>Veredicto</th><th style="width:34px"></th>'+
        '</tr></thead><tbody id="genBody"></tbody></table></div>'+
        '<button class="add-row" onclick="genAddRow()">＋ Agregar punto de medición</button></div>';
      $('genBody').innerHTML=''; window.genAddRow();
    },
    collect:function(){
      var out=[]; $$('#genBody tr').forEach(function(tr){
        var g=function(c){ return tr.querySelector(c).value.trim(); };
        var o={patron:g('.g-pat'),lectura:g('.g-lec'),error:g('.g-err'),incert:g('.g-inc'),tol:g('.g-tol'),veredicto:g('.g-ver')};
        if(o.patron||o.lectura||o.error||o.incert||o.tol||o.veredicto) out.push(o);
      });
      return { mediciones:out, incertidumbreResumen: val('cIncertGen')||'' };
    },
    buildPdfSections:function(doc,c,y,H){
      var d=c.datos.generico||{}; var meds=d.mediciones||[];
      y=H.section(doc,y,'RESULTADOS DE LAS MEDICIONES / MEASUREMENT RESULTS');
      if(meds.length){
        doc.autoTable({ startY:y, margin:{left:H.M,right:H.M,top:H.TOP,bottom:22},
          head:[['#','Valor patrón / nominal','Lectura equipo','Error','Incert. (k=2)','Tolerancia / EMP','Veredicto']],
          body:meds.map(function(m,i){return [String(i+1),m.patron||'',m.lectura||'',m.error||'',m.incert||'',m.tol||'',m.veredicto||''];}),
          styles:H.tblStyles, headStyles:H.headStyles, alternateRowStyles:{fillColor:[244,247,251]}, columnStyles:{0:{cellWidth:10}} });
        y=doc.lastAutoTable.finalY+5;
      } else { y=H.para(doc,y,'No se registraron puntos de medición.'); }
      return y;
    }
  };

  // Helpers del tipo genérico
  function genRow(){
    return '<tr><td class="g-n" style="text-align:center;font-weight:700;color:#607d8b"></td>'+
      '<td><input class="g-pat" placeholder="0" oninput="genRecalc(this)"></td>'+
      '<td><input class="g-lec" placeholder="0" oninput="genRecalc(this)"></td>'+
      '<td><input class="g-err" placeholder="auto"></td>'+
      '<td><input class="g-inc"></td><td><input class="g-tol"></td>'+
      '<td><input class="g-ver" placeholder="Conforme"></td>'+
      '<td style="text-align:center"><button class="del" onclick="genDel(this)">✕</button></td></tr>';
  }
  function genRenum(){ $$('#genBody tr').forEach(function(tr,i){ tr.querySelector('.g-n').textContent=i+1; }); }
  window.genAddRow=function(){ var tb=$('genBody'); tb.insertAdjacentHTML('beforeend',genRow()); genRenum(); };
  window.genDel=function(btn){ var tr=btn.closest('tr'); tr.parentNode.removeChild(tr); if($$('#genBody tr').length===0) window.genAddRow(); else genRenum(); };
  window.genRecalc=function(inp){ var tr=inp.closest('tr'); var p=toNum(tr.querySelector('.g-pat').value), l=toNum(tr.querySelector('.g-lec').value); if(p!==null&&l!==null) tr.querySelector('.g-err').value=fmtN(l-p,3); };

  // ───────────────────────── TIPO: ELECTROCARDIÓGRAFO ─────────────────────────
  var ECG_FC_DEF=[30,60,120,180];
  var ECG_ELEC_DEF=[
    {grupo:'SISTEMA DE VOLTAJE'},
    {d:'L1 – L2',u:'V',lim:'N/A'},{d:'L2 – GND',u:'V',lim:'N/A'},{d:'L1 – GND',u:'V',lim:'N/A'},
    {grupo:'PUESTA A TIERRA'},
    {d:'Resistencia del cable de tierra',u:'Ω',lim:'≤ 0,200'},
    {grupo:'CORRIENTE DE FUGA A TIERRA'},
    {d:'Polaridad normal',u:'µA',lim:'≤ 500'},{d:'Polaridad normal, sin neutro',u:'µA',lim:'≤ 1000'},
    {d:'Polaridad invertida',u:'µA',lim:'≤ 500'},{d:'Polaridad invertida, sin neutro',u:'µA',lim:'≤ 1000'},
    {grupo:'CORRIENTE DE FUGA A CHASIS / GABINETE'},
    {d:'Polaridad normal',u:'µA',lim:'≤ 100'},{d:'Polaridad normal, sin tierra',u:'µA',lim:'≤ 500'},{d:'Polaridad normal, sin neutro',u:'µA',lim:'≤ 500'},
    {d:'Polaridad invertida',u:'µA',lim:'≤ 100'},{d:'Polaridad invertida, sin tierra',u:'µA',lim:'≤ 500'},{d:'Polaridad invertida, sin neutro',u:'µA',lim:'≤ 500'}
  ];

  T.ecg = {
    nombre:'Electrocardiógrafo',
    defaults:{
      magnitud:'Frecuencia cardíaca y seguridad eléctrica',
      unidad:'LPM (min⁻¹), µA, Ω, V',
      metodo:'Comparación directa con simulador de signos vitales y verificación de seguridad eléctrica conforme a IEC 60601-1'
    },
    renderForm:function(host){
      var fcRows = ECG_FC_DEF.map(function(ref,i){ return ecgFcRow(ref,i); }).join('');
      var elecRows = ECG_ELEC_DEF.map(function(r,i){ return ecgElecRow(r,i); }).join('');
      host.innerHTML =
        '<div class="card"><h3>❤️ Variable medida — Frecuencia cardíaca (FC)</h3>'+
        '<div class="grid g4">'+
          inp('Tolerancia (EMP) ± LPM','e_tol','5')+
          inp('Factor de cobertura k','e_k','2')+
          inp('U del patrón (k=2)','e_ucert','0.16')+
          inp('Deriva del patrón (LPM)','e_drift','0')+
          inp('Resolución del patrón (LPM)','e_resp','0.1')+
          inp('Resolución del ECG (LPM)','e_rese','1')+
        '</div>'+
        '<div style="overflow-x:auto;margin-top:8px"><table class="tbl"><thead><tr>'+
          '<th>Valor de referencia (LPM)</th><th>Lecturas (separadas por coma)</th><th>Promedio</th><th>Error</th><th>Desv. est.</th><th>U exp. (k=2) ±</th><th>Veredicto</th><th style="width:34px"></th>'+
        '</tr></thead><tbody id="ecgFcBody">'+fcRows+'</tbody></table></div>'+
        '<button class="add-row" onclick="ecgAddFc()">＋ Agregar valor de referencia</button>'+
        '<details class="acc"><summary>Ver presupuesto de incertidumbre (GUM)</summary>'+
        '<div class="hint">u(A)=s/√n · u(res)=resolución/(2√3) · u(cert)=U_patrón/2 · u(deriva)=deriva/√3 · u_c=√Σu² · U=k·u_c. '+
        'El factor k=2 corresponde a un nivel de confianza ≈ 95 % (distribución normal).</div></details>'+
        '</div>'+

        '<div class="card"><h3>⚡ Pruebas de seguridad eléctrica (IEC 60601-1)</h3>'+
        '<div style="overflow-x:auto"><table class="tbl"><thead><tr>'+
          '<th>Prueba</th><th>Valor medido</th><th>Unidad</th><th>Límite</th><th>Resultado</th>'+
        '</tr></thead><tbody id="ecgElecBody">'+elecRows+'</tbody></table></div>'+
        '<div class="hint">Límites por defecto para equipo Clase I tipo CF/BF. Ajuste según la clasificación real del equipo y la edición de IEC 60601-1 aplicable.</div>'+
        '</div>';
      window.ecgRecalc();
    },
    validar:function(d){
      if(!d || !d.fc || !d.fc.puntos.length) return 'Registre al menos un valor de referencia de FC.';
      var conLecturas = d.fc.puntos.some(function(p){ return p.lecturas.length>0; });
      if(!conLecturas) return 'Ingrese las lecturas de frecuencia cardíaca.';
      return null;
    },
    collect:function(){
      window.ecgRecalc();
      var fc = window.__ecgFC || {puntos:[]};
      var elec = []; $$('#ecgElecBody tr').forEach(function(tr){
        if(tr.classList.contains('sub')){ elec.push({grupo:tr.getAttribute('data-grupo')}); return; }
        elec.push({ d:tr.getAttribute('data-d'), valor:tr.querySelector('.x-val').value.trim(),
          u:tr.querySelector('.x-u').value.trim(), lim:tr.querySelector('.x-lim').value.trim(),
          res:tr.querySelector('.x-res').value.trim() });
      });
      var resumen='';
      if(fc.puntos.length){ var Us=fc.puntos.map(function(p){return p.U;}).filter(function(x){return x!=null;}); if(Us.length){ var maxU=Math.max.apply(null,Us); resumen='U = ± '+fmtN(maxU,3)+' LPM (k=2, ≈95%)'; } }
      return { fc:fc, electrical:{rows:elec}, incertidumbreResumen:resumen };
    },
    buildPdfSections:function(doc,c,y,H){
      var d=c.datos.ecg||{}; var fc=d.fc||{puntos:[]}; var elec=(d.electrical&&d.electrical.rows)||[];
      // FC
      y=H.section(doc,y,'RESULTADOS DE LAS MEDICIONES · VARIABLE: FRECUENCIA CARDÍACA (LPM) / HEART RATE');
      doc.autoTable({ startY:y, margin:{left:H.M,right:H.M,top:H.TOP,bottom:22},
        head:[['Valor de referencia','Promedio','Incertidumbre expandida (k=2) ±','Error','Pasa / Falla']],
        body: fc.puntos.map(function(p){ return [ fmtN(p.ref,0)+' LPM', fmtN(p.promedio,2), '± '+fmtN(p.U,3), fmtN(p.error,2), p.veredicto||'' ]; }),
        styles:H.tblStyles, headStyles:H.headStyles, alternateRowStyles:{fillColor:[244,247,251]},
        didParseCell:function(data){ if(data.section==='body'&&data.column.index===4){ var v=String(data.cell.raw||''); data.cell.styles.textColor = v.indexOf('FALLA')>-1?[183,28,28]:[27,94,32]; data.cell.styles.fontStyle='bold'; } } });
      y=doc.lastAutoTable.finalY+5;
      if(fc.tolerancia) y=H.para(doc,y,'Tolerancia (EMP) aplicada: ± '+fmtN(fc.tolerancia,0)+' LPM. Factor de cobertura k = '+fmtN(fc.k,2)+'.');
      // Seguridad eléctrica
      y=H.ensure(doc,y,30); y=H.section(doc,y,'PRUEBAS DE SEGURIDAD ELÉCTRICA (IEC 60601-1) / ELECTRICAL SAFETY');
      var body=[];
      elec.forEach(function(r){
        if(r.grupo){ body.push([{content:r.grupo,colSpan:5,styles:{fillColor:[0,137,123],textColor:[255,255,255],fontStyle:'bold',halign:'left'}}]); }
        else { body.push([ r.d||'', r.valor||'', r.u||'', r.lim||'', r.res||'' ]); }
      });
      doc.autoTable({ startY:y, margin:{left:H.M,right:H.M,top:H.TOP,bottom:22},
        head:[['Prueba','Valor medido','Unidad','Límite','Resultado']],
        body:body, styles:H.tblStyles, headStyles:H.headStyles,
        didParseCell:function(data){ if(data.section==='body'&&data.column.index===4){ var v=String(data.cell.raw||''); if(v){ data.cell.styles.textColor=v.indexOf('FALLA')>-1?[183,28,28]:(v.indexOf('N/A')>-1?[120,130,140]:[27,94,32]); data.cell.styles.fontStyle='bold'; } } } });
      y=doc.lastAutoTable.finalY+5;
      return y;
    }
  };

  // FC row + handlers
  function ecgFcRow(ref,i){
    return '<tr data-i="'+i+'">'+
      '<td><input class="e-ref" value="'+ref+'" oninput="ecgRecalc()"></td>'+
      '<td><input class="e-lec" placeholder="ej: 60,60,60,60,60,60,60,60,60,60" oninput="ecgRecalc()"></td>'+
      '<td class="calc e-prom">—</td><td class="calc e-error">—</td><td class="calc e-desv">—</td><td class="calc e-U">—</td>'+
      '<td class="calc e-ver">—</td>'+
      '<td style="text-align:center"><button class="del" onclick="ecgDelFc(this)">✕</button></td></tr>';
  }
  function ecgElecRow(r,i){
    if(r.grupo) return '<tr class="sub" data-grupo="'+esc(r.grupo)+'"><td colspan="5">'+esc(r.grupo)+'</td></tr>';
    return '<tr data-d="'+esc(r.d)+'">'+
      '<td style="text-align:left;padding-left:8px;font-size:12px">'+esc(r.d)+'</td>'+
      '<td><input class="x-val"></td>'+
      '<td><input class="x-u" value="'+esc(r.u)+'"></td>'+
      '<td><input class="x-lim" value="'+esc(r.lim)+'"></td>'+
      '<td><select class="x-res"><option value="">—</option><option>PASA</option><option>FALLA</option><option>N/A</option></select></td></tr>';
  }
  function inp(label,id,v){ return '<div class="f"><label>'+label+'</label><input id="'+id+'" type="text" value="'+esc(v)+'" oninput="ecgRecalc()"></div>'; }

  window.ecgAddFc=function(){ var tb=$('ecgFcBody'); var i=tb.children.length; tb.insertAdjacentHTML('beforeend', ecgFcRow('',i)); };
  window.ecgDelFc=function(btn){ var tr=btn.closest('tr'); tr.parentNode.removeChild(tr); window.ecgRecalc(); };

  function stats(arr){ var n=arr.length; if(!n) return {n:0,mean:null,std:0}; var s=0; arr.forEach(function(x){s+=x;}); var mean=s/n; var v=0; if(n>1){ arr.forEach(function(x){v+=(x-mean)*(x-mean);}); v=v/(n-1); } return {n:n,mean:mean,std:Math.sqrt(v)}; }

  window.ecgRecalc=function(){
    var k=toNum(val('e_k'))||2, tol=toNum(val('e_tol')), uCert=(toNum(val('e_ucert'))||0)/2,
        drift=toNum(val('e_drift'))||0, resP=toNum(val('e_resp'))||0, resE=toNum(val('e_rese'))||0;
    var uResP=resP/(2*Math.sqrt(3)), uResE=resE/(2*Math.sqrt(3)), uDrift=drift/Math.sqrt(3);
    var puntos=[];
    $$('#ecgFcBody tr').forEach(function(tr){
      var ref=toNum(tr.querySelector('.e-ref').value);
      var lec=(tr.querySelector('.e-lec').value||'').split(/[,;\s]+/).map(toNum).filter(function(x){return x!==null;});
      var st=stats(lec);
      var prom=st.mean, err=(prom!==null&&ref!==null)?(prom-ref):null;
      var uA=st.n>1?(st.std/Math.sqrt(st.n)):0;
      var uc=Math.sqrt(uA*uA + uCert*uCert + uResP*uResP + uResE*uResE + uDrift*uDrift);
      var U=k*uc;
      var ver = (err!==null&&tol!=null) ? (Math.abs(err)<=tol?'PASA':'FALLA') : '—';
      tr.querySelector('.e-prom').textContent = prom!==null?fmtN(prom,2):'—';
      tr.querySelector('.e-error').textContent = err!==null?fmtN(err,2):'—';
      tr.querySelector('.e-desv').textContent = st.n>1?fmtN(st.std,3):'—';
      tr.querySelector('.e-U').textContent = st.n?('± '+fmtN(U,3)):'—';
      var vc=tr.querySelector('.e-ver'); vc.textContent=ver; vc.className='calc e-ver '+(ver==='PASA'?'v-ok':(ver==='FALLA'?'v-no':''));
      if(ref!==null) puntos.push({ ref:ref, lecturas:lec, promedio:prom, error:err, desv:st.std, n:st.n, uA:uA, uc:uc, U:U, veredicto:ver });
    });
    window.__ecgFC = { puntos:puntos, tolerancia:tol, k:k, uCertPatron:toNum(val('e_ucert')), resPatron:resP, resEquipo:resE, deriva:drift };
  };

  // ───────────────────────── TIPO: TENSIÓMETRO / PRESIÓN NO INVASIVA ─────────────────────────
  var PRES_REF_DEF=[50,100,150,200,250,300];

  T.presion = {
    nombre:'Tensiómetro (presión)',
    defaults:{
      magnitud:'Presión',
      unidad:'mmHg',
      metodo:'Comparación directa con el patrón de trabajo (Simulador NIBP), sometiendo el equipo a excitaciones puntuales y comparando la indicación del patrón con la indicación del objeto de prueba.'
    },
    renderForm:function(host){
      var rows = PRES_REF_DEF.map(function(ref,i){ return presRow(ref,i); }).join('');
      host.innerHTML =
        '<div class="card"><h3>🩺 Variable medida — Presión (mmHg)</h3>'+
        '<div class="grid g4">'+
          tinp('Tolerancia (EMP) ± mmHg','t_tol','3')+
          tinp('Factor de cobertura k','t_k','2')+
          tinp('U del patrón (k=2)','t_ucert','0.16')+
          tinp('Deriva del patrón (mmHg)','t_drift','0')+
          tinp('Resolución del patrón (mmHg)','t_resp','0.1')+
          tinp('Resolución del tensiómetro (mmHg)','t_rese','1')+
        '</div>'+
        '<div style="overflow-x:auto;margin-top:8px"><table class="tbl"><thead><tr>'+
          '<th>Valor de referencia (mmHg)</th><th>Lecturas (separadas por coma)</th><th>Promedio</th><th>Error</th><th>Desv. est.</th><th>U exp. (k=2) ±</th><th>Veredicto</th><th style="width:34px"></th>'+
        '</tr></thead><tbody id="presBody">'+rows+'</tbody></table></div>'+
        '<button class="add-row" onclick="presAddPt()">＋ Agregar valor de referencia</button>'+
        '<details class="acc"><summary>Ver presupuesto de incertidumbre (GUM)</summary>'+
        '<div class="hint">u(A)=s/√n · u(res)=resolución/(2√3) · u(cert)=U_patrón/2 · u(deriva)=deriva/√3 · u_c=√Σu² · U=k·u_c. '+
        'El factor k=2 corresponde a un nivel de confianza ≈ 95 % (distribución normal). Tolerancia ± 3 mmHg conforme a la práctica para PNI (NIBP).</div></details>'+
        '</div>';
      window.presRecalc();
    },
    validar:function(d){
      var P=(d&&d.pres)||{puntos:[]};
      if(!P.puntos.length) return 'Registre al menos un valor de referencia de presión.';
      if(!P.puntos.some(function(p){ return p.lecturas.length>0; })) return 'Ingrese las lecturas de presión.';
      return null;
    },
    collect:function(){
      window.presRecalc();
      var P = window.__presFC || {puntos:[]};
      var resumen='';
      if(P.puntos.length){ var Us=P.puntos.map(function(p){return p.U;}).filter(function(x){return x!=null;}); if(Us.length){ resumen='U = ± '+fmtN(Math.max.apply(null,Us),3)+' mmHg (k=2, ≈95%)'; } }
      return { pres:P, incertidumbreResumen:resumen };
    },
    buildPdfSections:function(doc,c,y,H){
      var d=c.datos.presion||{}; var P=d.pres||{puntos:[]};
      y=H.section(doc,y,'RESULTADOS DE LAS MEDICIONES · VARIABLE: PRESIÓN (mmHg) / PRESSURE');
      doc.autoTable({ startY:y, margin:{left:H.M,right:H.M,top:H.TOP,bottom:22},
        head:[['Valor de referencia','Promedio','Incertidumbre expandida (k=2) ±','Error','Pasa / Falla']],
        body:P.puntos.map(function(p){ return [ fmtN(p.ref,0)+' mmHg', fmtN(p.promedio,2), '± '+fmtN(p.U,3), fmtN(p.error,2), p.veredicto||'' ]; }),
        styles:H.tblStyles, headStyles:H.headStyles, alternateRowStyles:{fillColor:[244,247,251]},
        didParseCell:function(data){ if(data.section==='body'&&data.column.index===4){ var v=String(data.cell.raw||''); data.cell.styles.textColor = v.indexOf('FALLA')>-1?[183,28,28]:[27,94,32]; data.cell.styles.fontStyle='bold'; } } });
      y=doc.lastAutoTable.finalY+5;
      if(P.tolerancia!=null) y=H.para(doc,y,'Tolerancia (EMP) aplicada: ± '+fmtN(P.tolerancia,1)+' mmHg. Factor de cobertura k = '+fmtN(P.k,2)+'.');
      y=drawErrorChart(doc,y,H,P.puntos,P.tolerancia||0);
      return y;
    }
  };

  function presRow(ref,i){
    return '<tr data-i="'+i+'">'+
      '<td><input class="t-ref" value="'+ref+'" oninput="presRecalc()"></td>'+
      '<td><input class="t-lec" placeholder="ej: 51,51,51" oninput="presRecalc()"></td>'+
      '<td class="calc t-prom">—</td><td class="calc t-error">—</td><td class="calc t-desv">—</td><td class="calc t-U">—</td>'+
      '<td class="calc t-ver">—</td>'+
      '<td style="text-align:center"><button class="del" onclick="presDel(this)">✕</button></td></tr>';
  }
  function tinp(label,id,v){ return '<div class="f"><label>'+label+'</label><input id="'+id+'" type="text" value="'+esc(v)+'" oninput="presRecalc()"></div>'; }
  window.presAddPt=function(){ var tb=$('presBody'); var i=tb.children.length; tb.insertAdjacentHTML('beforeend', presRow('',i)); };
  window.presDel=function(btn){ var tr=btn.closest('tr'); tr.parentNode.removeChild(tr); window.presRecalc(); };

  window.presRecalc=function(){
    var k=toNum(val('t_k'))||2, tol=toNum(val('t_tol')), uCert=(toNum(val('t_ucert'))||0)/2,
        drift=toNum(val('t_drift'))||0, resP=toNum(val('t_resp'))||0, resE=toNum(val('t_rese'))||0;
    var uResP=resP/(2*Math.sqrt(3)), uResE=resE/(2*Math.sqrt(3)), uDrift=drift/Math.sqrt(3);
    var puntos=[];
    $$('#presBody tr').forEach(function(tr){
      var ref=toNum(tr.querySelector('.t-ref').value);
      var lec=(tr.querySelector('.t-lec').value||'').split(/[,;\s]+/).map(toNum).filter(function(x){return x!==null;});
      var st=stats(lec);
      var prom=st.mean, err=(prom!==null&&ref!==null)?(prom-ref):null;
      var uA=st.n>1?(st.std/Math.sqrt(st.n)):0;
      var uc=Math.sqrt(uA*uA + uCert*uCert + uResP*uResP + uResE*uResE + uDrift*uDrift);
      var U=k*uc;
      var ver=(err!==null&&tol!=null)?(Math.abs(err)<=tol?'PASA':'FALLA'):'—';
      tr.querySelector('.t-prom').textContent = prom!==null?fmtN(prom,2):'—';
      tr.querySelector('.t-error').textContent = err!==null?fmtN(err,2):'—';
      tr.querySelector('.t-desv').textContent = st.n>1?fmtN(st.std,3):'—';
      tr.querySelector('.t-U').textContent = st.n?('± '+fmtN(U,3)):'—';
      var vc=tr.querySelector('.t-ver'); vc.textContent=ver; vc.className='calc t-ver '+(ver==='PASA'?'v-ok':(ver==='FALLA'?'v-no':''));
      if(ref!==null) puntos.push({ ref:ref, lecturas:lec, promedio:prom, error:err, desv:st.std, n:st.n, uA:uA, uc:uc, U:U, veredicto:ver });
    });
    window.__presFC = { puntos:puntos, tolerancia:tol, k:k, uCertPatron:toNum(val('t_ucert')), resPatron:resP, resEquipo:resE, deriva:drift };
  };

  // Gráfica Error vs Presión dibujada nativamente en jsPDF (sin librerías externas)
  function drawErrorChart(doc, y, H, puntos, tol){
    var M=H.M, cw=H.cw;
    var chartH=64;
    y=H.ensure(doc,y,chartH+16);
    y=H.section(doc,y,'GRÁFICA DEL ERROR MEDIDO · ERROR VS PRESIÓN');
    var pts=(puntos||[]).filter(function(p){ return p.error!=null && p.ref!=null; });
    if(!pts.length){ return H.para(doc,y,'Sin datos suficientes para graficar.'); }
    var padL=20, padR=26, padT=4, padB=12;
    var x0=M+padL, y0=y+padT, plotW=cw-padL-padR, plotH=chartH-padT-padB;
    var refs=pts.map(function(p){return p.ref;}), errs=pts.map(function(p){return p.error;});
    var xMin=Math.min.apply(null,refs), xMax=Math.max.apply(null,refs); if(xMin===xMax){ xMin-=1; xMax+=1; }
    var maxErr=errs.reduce(function(a,b){return Math.max(a,Math.abs(b));},0);
    var yAbs=Math.max((tol||0)*1.5, maxErr*1.4, 1); var yMinV=-yAbs, yMaxV=yAbs;
    function PX(v){ return x0 + (v-xMin)/(xMax-xMin)*plotW; }
    function PY(v){ return y0 + plotH - (v-yMinV)/(yMaxV-yMinV)*plotH; }
    // marco + grilla Y
    doc.setDrawColor(190,200,210); doc.setLineWidth(0.2); doc.rect(x0,y0,plotW,plotH);
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(110,120,130);
    var ticks=4;
    for(var i=0;i<=ticks;i++){ var vv=yMinV+(yMaxV-yMinV)*i/ticks; var py=PY(vv); doc.setDrawColor(233,237,241); doc.line(x0,py,x0+plotW,py); doc.text(fmtN(vv,1),x0-2,py+1.6,{align:'right'}); }
    // etiquetas X
    pts.forEach(function(p){ doc.text(String(p.ref),PX(p.ref),y0+plotH+5,{align:'center'}); });
    // línea cero
    doc.setDrawColor(150,160,170); doc.setLineWidth(0.3); doc.line(x0,PY(0),x0+plotW,PY(0));
    // LÍM MAX / MIN (verde, discontinua)
    doc.setDrawColor(46,125,50); doc.setLineWidth(0.5); doc.setLineDashPattern([1.4,1.2],0);
    doc.line(x0,PY(tol),x0+plotW,PY(tol)); doc.line(x0,PY(-tol),x0+plotW,PY(-tol));
    doc.setLineDashPattern([],0);
    doc.setFont('helvetica','bold'); doc.setFontSize(6.6); doc.setTextColor(46,125,50);
    doc.text('LÍM. MAX (+'+fmtN(tol,1)+')',x0+plotW+1,PY(tol)+1);
    doc.text('LÍM. MIN ('+fmtN(-tol,1)+')',x0+plotW+1,PY(-tol)+1.5);
    // serie de error (azul)
    doc.setDrawColor(33,118,174); doc.setLineWidth(0.6);
    for(var j=1;j<pts.length;j++){ doc.line(PX(pts[j-1].ref),PY(pts[j-1].error),PX(pts[j].ref),PY(pts[j].error)); }
    doc.setFillColor(33,118,174);
    pts.forEach(function(p){ doc.circle(PX(p.ref),PY(p.error),0.9,'F'); });
    // títulos de ejes
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(70,90,100);
    doc.text('Punto de prueba (mmHg)',x0+plotW/2,y0+plotH+10,{align:'center'});
    doc.text('Error (mmHg)',M+3,y0+plotH/2,{align:'center',angle:90});
    return y0+plotH+padB+2;
  }

  // ───────────────────────── PDF (ISO/IEC 17025) ─────────────────────────
  var _logo=null;
  function getLogo(){
    if(_logo!==null) return Promise.resolve(_logo);
    return new Promise(function(res){
      var img=new Image();
      img.onload=function(){ try{ var cv=document.createElement('canvas'); cv.width=img.naturalWidth; cv.height=img.naturalHeight; cv.getContext('2d').drawImage(img,0,0); _logo={data:cv.toDataURL('image/jpeg',0.92),w:img.naturalWidth,h:img.naturalHeight}; }catch(e){_logo=false;} res(_logo); };
      img.onerror=function(){ _logo=false; res(false); };
      img.src='logoNOVAMEDICAL.jpg';
    });
  }

  var ISO_DECL = 'Este certificado expresa el resultado de las mediciones realizadas en el momento y bajo las condiciones indicadas. Los resultados se refieren exclusivamente al ítem calibrado. No podrá reproducirse parcialmente sin autorización escrita del laboratorio emisor; su reproducción solo se permite en forma íntegra. La trazabilidad metrológica al Sistema Internacional de Unidades (SI) se sustenta en los patrones de referencia relacionados. El usuario es responsable de recalibrar el instrumento a intervalos apropiados. La incertidumbre expandida reportada corresponde a la incertidumbre típica combinada multiplicada por un factor de cobertura k = 2, para un nivel de confianza de aproximadamente 95 % (distribución normal).';

  function buildPDF(c){
    return getLogo().then(function(logo){
      var jsPDF=window.jspdf.jsPDF; var doc=new jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
      var W=210, M=15, cw=W-2*M, TOP=30;

      var H = {
        M:M, cw:cw, TOP:TOP, W:W,
        tblStyles:{ font:'helvetica', fontSize:8.5, cellPadding:2, halign:'center', lineColor:[207,216,220], lineWidth:0.2, textColor:[20,30,40] },
        headStyles:{ fillColor:[13,71,161], textColor:[255,255,255], fontStyle:'bold', fontSize:8 },
        ensure:function(d,y,need){ if(y+ (need||10) > 274){ d.addPage(); return TOP; } return y; },
        section:function(d,y,title){ y=H.ensure(d,y,12); d.setFillColor(13,71,161); d.rect(M,y,cw,6.5,'F'); d.setFont('helvetica','bold'); d.setFontSize(9.2); d.setTextColor(255,255,255); d.text(title,M+2.5,y+4.6); return y+8.5; },
        para:function(d,y,txt,size){ d.setFont('helvetica','normal'); d.setFontSize(size||8.5); d.setTextColor(40,50,60); var t=d.splitTextToSize(String(txt),cw); var need=t.length*4.0+2; y=H.ensure(d,y,need); d.text(t,M,y); return y+need; },
        kv:function(d,y,pairs){ d.setFontSize(8.6); var colW=cw/2; for(var i=0;i<pairs.length;i+=2){ y=H.ensure(d,y,8); var rowY=y+5; for(var j=0;j<2;j++){ var pr=pairs[i+j]; if(!pr) continue; var x=M+j*colW; d.setFont('helvetica','bold'); d.setTextColor(70,90,100); d.text(pr[0]+':',x+2,rowY); d.setFont('helvetica','normal'); d.setTextColor(20,30,40); d.text(d.splitTextToSize(String(pr[1]||'—'),colW-36),x+36,rowY); } d.setDrawColor(225,231,236); d.setLineWidth(0.2); d.line(M,y+7.3,W-M,y+7.3); y+=7.3; } return y+2; }
      };

      // ───── PÁGINA 1: PORTADA / FRONT MATTER ─────
      var y=TOP;
      y=H.section(doc,y,'IDENTIFICACIÓN DEL ÍTEM CALIBRADO / EQUIPMENT IDENTIFICATION');
      y=H.kv(doc,y,[['Equipo / Equipment',c.equipo],['Marca / Brand',c.marca],['Modelo / Model',c.modelo],['N° de serie / Serial',c.serie],['Placa / Asset',c.placa],['Ubicación / Location',c.servicio],['Estado del ítem',c.estadoItem],['Resolución',c.resEquipo||'—']]);
      y=H.section(doc,y,'CLIENTE / CUSTOMER');
      y=H.kv(doc,y,[['Nombre / Name',c.cliente.nombre],['NIT / ID',c.cliente.nit||'—'],['Dirección / Address',c.cliente.dir],['Teléfono / Phone',c.cliente.tel||'—']]);
      y=H.section(doc,y,'DATOS DE LA CALIBRACIÓN / CALIBRATION DATA');
      y=H.kv(doc,y,[['Fecha de recepción',fmtFecha(c.recepcion)],['Fecha de calibración',fmtFecha(c.fecha)],['Próxima calibración',fmtFecha(c.proxima)],['Magnitud / Quantity',c.magnitud],['Unidad / Unit',c.unidad],['Lugar / Site',c.lugar||c.cliente.dir],['Cond. ambientales',c.condiciones||'—'],['Método',c.metodo]]);

      // Conclusión destacada
      y=H.ensure(doc,y,18);
      var resU = c.resultado.indexOf('NO APTO')===0?[183,28,28]:(c.resultado.indexOf('OBSERV')>-1?[230,81,0]:[27,94,32]);
      var resB = c.resultado.indexOf('NO APTO')===0?[255,235,238]:(c.resultado.indexOf('OBSERV')>-1?[255,248,225]:[232,245,233]);
      doc.setFillColor(resB[0],resB[1],resB[2]); doc.roundedRect(M,y,cw,12,2,2,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(70,90,100); doc.text('CONCLUSIÓN / RESULT:',M+3,y+7.5);
      doc.setTextColor(resU[0],resU[1],resU[2]); doc.setFontSize(11); doc.text(c.resultado||'—',M+52,y+7.7); y+=15;
      if(c.regla){ y=H.para(doc,y,'Regla de decisión (ISO/IEC 17025): '+c.regla,8); }

      // Firmas
      y=H.ensure(doc,y,28); y+=6; var half=cw/2;
      doc.setDrawColor(120,140,150); doc.setLineWidth(0.3);
      doc.line(M+6,y,M+half-10,y); doc.line(M+half+6,y,W-M-6,y);
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(20,30,40);
      doc.text(c.metrologo||'—',M+(half-4)/2+3,y+5,{align:'center'}); doc.text(c.reviso||'—',M+half+(half-4)/2+3,y+5,{align:'center'});
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(90,100,110);
      doc.text(doc.splitTextToSize('Calibró / Calibrated by'+(c.metrologoCargo?(' · '+c.metrologoCargo):''),half-6),M+(half-4)/2+3,y+9.5,{align:'center'});
      doc.text(doc.splitTextToSize('Revisó-Aprobó / Approved by'+(c.revisoCargo?(' · '+c.revisoCargo):''),half-6),M+half+(half-4)/2+3,y+9.5,{align:'center'});

      // ───── PÁGINA 2: INCERTIDUMBRE + MÉTODO + RESULTADOS ─────
      doc.addPage(); y=TOP;
      y=H.section(doc,y,'INCERTIDUMBRE Y MÉTODO / UNCERTAINTY & METHOD');
      y=H.para(doc,y,'La incertidumbre típica de medida se calculó considerando las contribuciones del/los patrón(es), del método de calibración y del propio instrumento (resolución, repetibilidad). La incertidumbre expandida U corresponde a la incertidumbre típica combinada multiplicada por un factor de cobertura k = 2, equivalente a un nivel de confianza de aproximadamente 95 % para una distribución normal, conforme a la Guía GUM (JCGM 100:2008).');
      y=H.para(doc,y,'Método / Procedure: '+(c.metodo||'—'));
      if(c.incertidumbre) y=H.para(doc,y,'Incertidumbre expandida reportada: '+c.incertidumbre);
      y+=1;
      // Resultados específicos del tipo
      y=(T[c.tipo]&&T[c.tipo].buildPdfSections)? T[c.tipo].buildPdfSections(doc,c,y,H) : y;

      // ───── PATRONES + DECLARACIÓN FINAL ─────
      y=H.ensure(doc,y,40); y=H.section(doc,y,'PATRONES DE REFERENCIA Y TRAZABILIDAD / REFERENCE STANDARDS');
      var pbody=[]; (c.patrones||[]).forEach(function(p,i){
        pbody.push([String(i+1), p.nombre||'—', [p.marca,p.modelo].filter(Boolean).join(' / ')||'—', p.serie||'—', p.certificado||'—', fmtFecha(p.proximaCal), p.trazabilidad||'—']);
      });
      if(pbody.length){
        doc.autoTable({ startY:y, margin:{left:M,right:M,top:TOP,bottom:22},
          head:[['#','Patrón','Marca / Modelo','Serie','N° certificado','Próx. cal.','Trazabilidad']],
          body:pbody, styles:Object.assign({},H.tblStyles,{fontSize:7.8,halign:'left'}), headStyles:H.headStyles, columnStyles:{0:{cellWidth:8,halign:'center'}} });
        y=doc.lastAutoTable.finalY+5;
      }
      y=H.ensure(doc,y,42); y=H.section(doc,y,'DECLARACIONES ISO/IEC 17025');
      y=H.para(doc,y,ISO_DECL,8);
      if(c.observaciones){ y=H.ensure(doc,y,16); doc.setFont('helvetica','bold'); doc.setFontSize(8.6); doc.setTextColor(70,90,100); doc.text('Observaciones / Remarks:',M,y); y+=4.5; y=H.para(doc,y,c.observaciones,8.5); }
      y=H.ensure(doc,y,8); doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(13,71,161); doc.text('— FIN DEL CERTIFICADO / END OF CERTIFICATE —',W/2,y+4,{align:'center'});

      // ───── Encabezados y pies en TODAS las páginas ─────
      var total=doc.internal.getNumberOfPages();
      for(var i=1;i<=total;i++){ doc.setPage(i); drawHeader(doc,logo,c,i,total); drawFooter(doc,c,i,total); }
      return doc;
    });
  }

  function drawHeader(doc,logo,c,page,total){
    var W=210, M=15;
    if(logo){ var lw=20, lh=lw*(logo.h/logo.w); doc.addImage(logo.data,'JPEG',M,7,lw,lh); }
    doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(13,71,161);
    doc.text(String(c.lab.nombre||'Metrología Biomédica'),M+24,11.5,{maxWidth:W-M-24-30});
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(70,90,100);
    doc.text(doc.splitTextToSize([c.lab.dir,c.lab.tel,c.lab.acred?('Acreditación: '+c.lab.acred):''].filter(Boolean).join(' · '),W-M-24-28),M+24,15.5);
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(0,137,123);
    doc.text('CERTIFICADO DE CALIBRACIÓN / CALIBRATION CERTIFICATE',W/2,22.5,{align:'center'});
    doc.setFontSize(8); doc.setTextColor(13,71,161);
    doc.text('N° '+(c.numero||'—'),M,26.5); doc.text('Página / Page '+page+' de / of '+total,W-M,26.5,{align:'right'});
    doc.setDrawColor(13,71,161); doc.setLineWidth(0.5); doc.line(M,27.6,W-M,27.6);
  }
  function drawFooter(doc,c,page,total){
    var W=210, M=15;
    doc.setDrawColor(207,216,220); doc.setLineWidth(0.3); doc.line(M,287,W-M,287);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(120,130,140);
    doc.text('Cumple los requisitos de la norma internacional ISO/IEC 17025 · NEXA CMMS · Metrología Biomédica',W/2,291,{align:'center'});
    doc.text('Certificado N° '+(c.numero||'')+'  ·  '+page+'/'+total,W/2,294.5,{align:'center'});
  }

  // ───────────────────────── PREVIEW / GUARDAR ─────────────────────────
  window.previewPDF=function(){
    var c=M.collect(); if(!c.equipo){ toast('Indique al menos el equipo','err'); return; }
    var b=$('btnPreview'); b.disabled=true;
    buildPDF(c).then(function(doc){ b.disabled=false; window.open(doc.output('bloburl'),'_blank'); })
      .catch(function(e){ b.disabled=false; toast('Error generando PDF: '+e.message,'err'); });
  };
  window.guardar=function(){
    var c=M.collect(); if(!M.validar(c)) return;
    var b=$('btnSave'); b.disabled=true; b.innerHTML='<span class="spin"></span> Guardando…';
    fetch(M.API+'/metrologia-certificados',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},M.authHeaders()),body:JSON.stringify({action:'create',certificado:c})})
      .then(function(r){ return r.json().then(function(d){ return {status:r.status,d:d}; }); })
      .then(function(res){
        if(!res.d||!res.d.ok) throw new Error((res.d&&res.d.error)||('HTTP '+res.status));
        c.numero=res.d.numero||c.numero; $('cNumero').value=c.numero; var recordId=res.d.recordId;
        return buildPDF(c).then(function(doc){
          var b64=doc.output('datauristring').split(',')[1];
          var clean=function(s){ return String(s||'').replace(/[^a-zA-Z0-9]/g,'_'); };
          var filename='CERT_'+clean(c.numero)+'_'+clean(c.equipo).slice(0,28)+'.pdf';
          return fetch(M.API+'/upload-pdf',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},M.authHeaders()),body:JSON.stringify({recordId:recordId,fieldName:'Certificado PDF',filename:filename,contentType:'application/pdf',base64:b64,tableName:M.TABLA})})
            .then(function(r){ return r.json().catch(function(){return{};}); })
            .then(function(up){ return {numero:c.numero,doc:doc,up:up}; });
        });
      })
      .then(function(out){
        b.disabled=false; b.innerHTML='💾 Guardar y generar PDF';
        if(out.up&&out.up.ok===false){ toast('Certificado '+out.numero+' guardado. PDF no adjuntado: '+(out.up.error||''),''); }
        else { toast('✅ Certificado '+out.numero+' guardado correctamente','ok'); }
        window.open(out.doc.output('bloburl'),'_blank');
        M.resetCommon(); M.loadNextNumber();
      })
      .catch(function(e){ b.disabled=false; b.innerHTML='💾 Guardar y generar PDF'; toast('Error: '+e.message,'err'); });
  };

  // Arrancar la app (ahora que los TIPOS están registrados)
  M.init();
})();
