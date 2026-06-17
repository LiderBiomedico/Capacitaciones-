// ============================================================================
// MÓDULO CRONOGRAMA DE MANTENIMIENTO PREVENTIVO - HSLV  v2
// + Impresión por servicio individual
// + Impresión por mes individual
// + Modal de selección de impresión
// ============================================================================

(function () {
  if (window.__HSLV_CRONOGRAMA_LOADED) return;
  window.__HSLV_CRONOGRAMA_LOADED = true;

  const YEAR = new Date().getFullYear();
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const WEEK_COLORS = {
    S1:{bg:'#e3f2fd',border:'#1565c0',text:'#0d47a1'},
    S2:{bg:'#e8f5e9',border:'#2e7d32',text:'#1b5e20'},
    S3:{bg:'#fff8e1',border:'#f57f17',text:'#e65100'},
    S4:{bg:'#fce4ec',border:'#c62828',text:'#b71c1c'},
  };

  const crState = window.__HSLV_CR_STATE || (window.__HSLV_CR_STATE = {
    allRecords:[], filtered:[], services:[], activeService:'TODOS', searchQuery:'', loaded:false,
  });

  function getHeaders(){try{if(typeof getAuthHeader==='function')return getAuthHeader();}catch(e){}return{};}
  function safeErr(e){try{if(e&&e.response&&e.response.data)return e.response.data.error||JSON.stringify(e.response.data);}catch(_){}return(e&&e.message)?e.message:'Error';}
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function parseSchedule(record){
    const f=record.fields||{};
    const raw=f['Programacion de Mantenimiento Anual']||f['PROGRAMACION DE MANTENIMIENTO ANUAL']||'';
    const freq=f['Frecuencia de Mantenimiento']||f['Frecuencia de MTTO Preventivo']||f['FRECUENCIA DE MTTO PREVENTIVO']||'';
    const fechaProg=f['Fecha Programada de Mantenimiento']||f['FECHA PROGRAMADA DE MANTENIMINETO']||'';
    const results=[];
    if(raw&&raw.trim()){
      raw.split('|').forEach(part=>{
        part=part.trim();
        const mi=MESES.findIndex(m=>part.toLowerCase().includes(m.toLowerCase()));
        if(mi===-1)return;
        const sm=part.match(/S([1-4])/i);
        results.push({mesIdx:mi,semana:sm?'S'+sm[1]:'S1'});
      });
      if(results.length)return results;
    }
    if(raw&&raw.includes(',')){
      raw.split(',').forEach(part=>{
        const mi=MESES.findIndex(m=>part.trim().toLowerCase().includes(m.toLowerCase()));
        if(mi!==-1)results.push({mesIdx:mi,semana:'S1'});
      });
      if(results.length)return results;
    }
    const freqLow=(freq||'').toLowerCase();
    const freqMap={mensual:[0,1,2,3,4,5,6,7,8,9,10,11],bimestral:[0,2,4,6,8,10],trimestral:[0,3,6,9],cuatrimestral:[0,4,8],semestral:[0,6],anual:[0]};
    for(const[key,months]of Object.entries(freqMap)){if(freqLow.includes(key)){months.forEach(m=>results.push({mesIdx:m,semana:'S1'}));return results;}}
    if(fechaProg){try{const d=new Date(fechaProg);if(!isNaN(d.getTime()))results.push({mesIdx:d.getMonth(),semana:'S'+Math.min(Math.ceil(d.getDate()/7),4)});}catch(_){}}
    return results;
  }

  // ── LOAD ───────────────────────────────────────────────────────────────────
  async function loadCronograma(){
    const container=document.getElementById('cronogramaBody');
    if(!container)return;
    container.innerHTML=`<div class="cr-loading"><div class="cr-spinner"></div><p>Cargando cronograma ${YEAR}...</p></div>`;
    try{
      const base=typeof API_BASE_URL!=='undefined'?API_BASE_URL:'/.netlify/functions';
      let allRec=[],offset=null;
      do{
        const params=new URLSearchParams({pageSize:'100'});
        if(offset)params.set('offset',offset);
        const resp=await axios.get(`${base}/inventario?${params}`,{headers:getHeaders()});
        const data=resp.data||{};
        allRec=allRec.concat(data.records||data.data||[]);
        offset=data.offset||null;
      }while(offset);
      crState.allRecords=allRec; crState.loaded=true;
      const svcSet=new Set();
      allRec.forEach(r=>{const svc=(r.fields||{})['Servicio']||(r.fields||{})['SERVICIO']||'';if(svc.trim())svcSet.add(svc.trim());});
      crState.services=Array.from(svcSet).sort();
      renderServiceTabs(); applyFiltersAndRender(); updateCronogramaStats();
    }catch(err){
      container.innerHTML=`<div style="text-align:center;padding:40px;color:#c62828;">⚠️ Error<br><small>${esc(safeErr(err))}</small><br><button class="btn btn-primary" style="margin-top:12px" onclick="loadCronograma()">🔄 Reintentar</button></div>`;
    }
  }

  function renderServiceTabs(){
    const el=document.getElementById('crServiceTabs');
    if(!el)return;
    el.innerHTML=['TODOS',...crState.services].map(svc=>`<button class="cr-tab ${crState.activeService===svc?'active':''}" onclick="crSetService('${esc(svc)}')">${esc(svc)}</button>`).join('');
  }
  window.crSetService=function(svc){crState.activeService=svc;renderServiceTabs();applyFiltersAndRender();};

  function applyFiltersAndRender(){
    const q=crState.searchQuery.toLowerCase();
    crState.filtered=crState.allRecords.filter(r=>{
      const f=r.fields||{};
      const svc=f['Servicio']||f['SERVICIO']||'';
      const eq=f['Equipo']||f['EQUIPO']||'';
      const serie=f['Serie']||f['SERIE']||'';
      if(crState.activeService!=='TODOS'&&svc.trim()!==crState.activeService)return false;
      if(q&&!eq.toLowerCase().includes(q)&&!svc.toLowerCase().includes(q)&&!serie.toLowerCase().includes(q))return false;
      return parseSchedule(r).length>0;
    });
    renderCronograma(); updateCronogramaStats();
  }
  window.crSearch=function(){const el=document.getElementById('crSearchInput');crState.searchQuery=el?el.value.trim():'';applyFiltersAndRender();};

  function updateCronogramaStats(){
    const total=crState.allRecords.length;
    const withSched=crState.allRecords.filter(r=>parseSchedule(r).length>0).length;
    const cm=new Date().getMonth();
    let thisMo=0;
    crState.allRecords.forEach(r=>parseSchedule(r).forEach(s=>{if(s.mesIdx===cm)thisMo++;}));
    setText('crStatTotal',total); setText('crStatProg',withSched); setText('crStatNoProg',total-withSched); setText('crStatMonth',thisMo);
  }
  function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}

  // ── VISUALIZADOR MENSUAL ───────────────────────────────────────────────────
  // Resumen por mes: cuantos mantenimientos preventivos estan PROGRAMADOS,
  // cuantos se han REALIZADO (PDF cargado) y cuantos estan APROBADOS.
  // Toda la informacion sale de crState.allRecords (inventario ya cargado).
  // Respeta el servicio activo seleccionado en las pestanas.

  function crServiceRecords(){
    if(crState.activeService==='TODOS')return crState.allRecords;
    return crState.allRecords.filter(r=>{
      const f=r.fields||{};
      const svc=(f['Servicio']||f['SERVICIO']||'').trim();
      return svc===crState.activeService;
    });
  }

  // Set de IDs de adjuntos aprobados (patron de archivo APROBADO_{id}_{nombre})
  function crBuildAprobadosSet(list){
    const s=new Set();
    (list||[]).forEach(a=>{
      const m=String((a&&a.filename)||'').match(/^APROBADO_([^_]+)_/);
      if(m)s.add(m[1]);
    });
    return s;
  }

  // Arreglo de 12 posiciones {prog, real, apr} — uno por mes del anio.
  function crMonthlyStats(){
    const stats=Array.from({length:12},()=>({prog:0,real:0,apr:0}));
    crServiceRecords().forEach(r=>{
      const f=r.fields||{};
      // PROGRAMADOS: a partir del cronograma anual del equipo
      parseSchedule(r).forEach(s=>{
        if(s.mesIdx>=0&&s.mesIdx<12)stats[s.mesIdx].prog++;
      });
      // REALIZADOS / APROBADOS: a partir de los PDF de mantenimiento preventivo.
      // Se excluyen los de terceros (prefijo TERC_), igual que en kpis.js.
      const prev=Array.isArray(f['Mantenimientos preventivo'])?f['Mantenimientos preventivo']:[];
      const propios=prev.filter(a=>!String((a&&a.filename)||'').toUpperCase().startsWith('TERC_'));
      const aprSet=crBuildAprobadosSet(f['Mantenimiento Aprobado']);
      propios.forEach(a=>{
        const m=String((a&&a.filename)||'').match(/(\d{4})-(\d{2})-\d{2}/);
        if(!m)return;
        if(parseInt(m[1],10)!==YEAR)return;     // solo el anio del cronograma
        const mi=parseInt(m[2],10)-1;
        if(mi<0||mi>11)return;
        stats[mi].real++;
        if(a&&a.id&&aprSet.has(a.id))stats[mi].apr++;
      });
    });
    return stats;
  }

  function crBarColor(prog,pct){
    if(prog<=0)return'#cfd8dc';
    if(pct>=100)return'#2e7d32';
    if(pct>=60)return'#f9a825';
    if(pct>0)return'#ef6c00';
    return'#c62828';
  }

  function buildMonthlyVisualizer(){
    const stats=crMonthlyStats();
    const cm=new Date().getMonth();
    let totProg=0,totReal=0,totApr=0;
    stats.forEach(s=>{totProg+=s.prog;totReal+=s.real;totApr+=s.apr;});
    const totPct=totProg>0?Math.min(Math.round((totApr/totProg)*100),100):0;
    const totColor=crBarColor(totProg,totPct);
    const svcLabel=crState.activeService==='TODOS'?'Todos los servicios':crState.activeService;

    // Encabezado: una columna por mes (mes actual resaltado)
    const thMeses=stats.map((s,i)=>{
      const isCur=i===cm;
      return `<th style="padding:6px 4px;font-size:10.5px;font-weight:800;text-align:center;border-bottom:2px solid #e3e8ef;${isCur?'background:#1565c0;color:#fff;border-radius:6px 6px 0 0;':'color:#607d8b;'}">${MESES_SHORT[i]}${isCur?'<div style="font-size:7.5px;font-weight:700;letter-spacing:.5px;opacity:.9;">ACTUAL</div>':''}</th>`;
    }).join('');

    // Celda numerica (Programados / Realizados / Aprobados)
    const celdaNum=(val,color,i)=>{
      const isCur=i===cm;
      return `<td style="text-align:center;padding:5px 4px;font-size:12px;font-weight:800;color:${val>0?color:'#cfd8dc'};border-bottom:1px solid #eef1f5;${isCur?'background:#f5f9ff;':''}">${val}</td>`;
    };
    const rowProg=stats.map((s,i)=>celdaNum(s.prog,'#1565c0',i)).join('');
    const rowReal=stats.map((s,i)=>celdaNum(s.real,'#00897b',i)).join('');
    const rowApr =stats.map((s,i)=>celdaNum(s.apr,'#2e7d32',i)).join('');

    // Fila de cumplimiento: barra de progreso + porcentaje
    const rowCumpl=stats.map((s,i)=>{
      const pct=s.prog>0?Math.min(Math.round((s.apr/s.prog)*100),100):0;
      const color=crBarColor(s.prog,pct);
      const isCur=i===cm;
      return `<td style="padding:5px 5px;border-bottom:1px solid #eef1f5;${isCur?'background:#f5f9ff;':''}">
        <div style="height:6px;background:#eceff1;border-radius:3px;overflow:hidden;margin-bottom:2px;"><div style="height:100%;width:${pct}%;background:${color};"></div></div>
        <div style="text-align:center;font-size:9.5px;font-weight:800;color:${s.prog>0?color:'#b0bec5'};">${s.prog>0?pct+'%':'\u2014'}</div>
      </td>`;
    }).join('');

    const lblStyle='text-align:left;padding:5px 8px 5px 4px;font-size:10.5px;font-weight:700;white-space:nowrap;border-bottom:1px solid #eef1f5;';
    const dot=c=>`<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};margin-right:4px;vertical-align:middle;"></span>`;

    return `<div style="background:#fff;border:1px solid #e3e8ef;border-radius:14px;padding:14px 18px;margin-bottom:18px;box-shadow:0 1px 4px rgba(13,71,161,.07);">
      <div style="display:flex;align-items:center;gap:13px;flex-wrap:wrap;margin-bottom:12px;">
        <div style="width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#1976d2,#0d47a1);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">\ud83d\udcca</div>
        <div style="flex:1;min-width:180px;">
          <div style="font-size:15px;font-weight:800;color:#0d47a1;">Resumen Mensual de Cumplimiento</div>
          <div style="font-size:11.5px;color:#78909c;">A\u00f1o ${YEAR} \u00b7 ${esc(svcLabel)}</div>
        </div>
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
          <div style="text-align:center;"><div style="font-size:19px;font-weight:800;color:#1565c0;line-height:1;">${totProg}</div><div style="font-size:9px;color:#90a4ae;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Programados</div></div>
          <div style="text-align:center;"><div style="font-size:19px;font-weight:800;color:#00897b;line-height:1;">${totReal}</div><div style="font-size:9px;color:#90a4ae;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Realizados</div></div>
          <div style="text-align:center;"><div style="font-size:19px;font-weight:800;color:#2e7d32;line-height:1;">${totApr}</div><div style="font-size:9px;color:#90a4ae;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Aprobados</div></div>
          <div style="text-align:center;padding-left:14px;border-left:1px solid #e3e8ef;"><div style="font-size:22px;font-weight:800;color:${totColor};line-height:1;">${totPct}%</div><div style="font-size:9px;color:#90a4ae;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Cumplimiento</div></div>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:680px;">
          <thead><tr><th style="border-bottom:2px solid #e3e8ef;"></th>${thMeses}</tr></thead>
          <tbody>
            <tr><td style="${lblStyle}color:#1565c0;">Programados</td>${rowProg}</tr>
            <tr><td style="${lblStyle}color:#00897b;">Realizados</td>${rowReal}</tr>
            <tr><td style="${lblStyle}color:#2e7d32;">Aprobados</td>${rowApr}</tr>
            <tr><td style="${lblStyle}color:#546e7a;">Cumplimiento</td>${rowCumpl}</tr>
          </tbody>
        </table>
      </div>
      <div style="margin-top:10px;display:flex;gap:12px;flex-wrap:wrap;font-size:10.5px;color:#78909c;align-items:center;">
        <span style="font-weight:700;color:#546e7a;">Estado:</span>
        <span>${dot('#2e7d32')}Completo</span>
        <span>${dot('#f9a825')}Avanzado (60-99%)</span>
        <span>${dot('#ef6c00')}Inicial (1-59%)</span>
        <span>${dot('#c62828')}Pendiente (0%)</span>
        <span>${dot('#cfd8dc')}Sin programaci\u00f3n</span>
        <span style="margin-left:auto;font-style:italic;">Cumplimiento = Aprobados \u00f7 Programados</span>
      </div>
    </div>`;
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  function renderCronograma(){
    const container=document.getElementById('cronogramaBody');
    if(!container)return;
    const visualizadorMensual=buildMonthlyVisualizer();
    if(!crState.filtered.length){
      container.innerHTML=visualizadorMensual+`<div style="text-align:center;padding:60px;color:#90a4ae;"><div style="font-size:60px;margin-bottom:16px;opacity:.4">📅</div><div style="font-size:18px;font-weight:700;color:#546e7a">Sin programación registrada</div></div>`;return;
    }
    const groups={};
    crState.filtered.forEach(r=>{
      const f=r.fields||{};
      const svc=(f['Servicio']||f['SERVICIO']||'Sin Servicio').trim();
      if(!groups[svc])groups[svc]=[];
      groups[svc].push(r);
    });
    const cm=new Date().getMonth();
    const allMonths=Array.from({length:12},(_,i)=>i);
    let html='';
    Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).forEach(([svc,records])=>{
      html+=buildServiceBlock(svc,records,allMonths,cm,true);
    });
    html+=buildLegend();
    container.innerHTML=visualizadorMensual+html;
  }

  function buildServiceBlock(svc,records,showMonths,currentMonth,screen){
    const headers=showMonths.map(i=>`<th class="cr-th-mes ${i===currentMonth?'cr-mes-current':''}">${MESES_SHORT[i]}</th>`).join('');
    const filteredRecords=records.filter(r=>{
      const byMonth={};
      parseSchedule(r).forEach(s=>{if(!byMonth[s.mesIdx])byMonth[s.mesIdx]=[];byMonth[s.mesIdx].push(s.semana);});
      return showMonths.some(i=>byMonth[i]&&byMonth[i].length>0);
    });
    if(!filteredRecords.length)return'';
    const rows=filteredRecords.map(r=>{
      const f=r.fields||{};
      const equipo=f['Equipo']||f['EQUIPO']||'—';
      const serie=f['Serie']||f['SERIE']||'';
      const marca=f['Marca']||f['MARCA']||'';
      const freq=f['Frecuencia de Mantenimiento']||f['Frecuencia de MTTO Preventivo']||f['FRECUENCIA DE MTTO PREVENTIVO']||'—';
      const schedule=parseSchedule(r);
      const byMonth={};
      schedule.forEach(s=>{if(!byMonth[s.mesIdx])byMonth[s.mesIdx]=[];byMonth[s.mesIdx].push(s.semana);});
      const cells=showMonths.map(i=>{
        const weeks=byMonth[i]||[];
        const isCurrent=i===currentMonth,isPast=i<currentMonth;
        if(!weeks.length)return`<td class="cr-cell-empty ${isCurrent?'cr-cell-current-month':''}"></td>`;
        const wh=weeks.map(w=>{const c=WEEK_COLORS[w]||WEEK_COLORS.S1;return`<span class="cr-week-badge" style="background:${c.bg};border-color:${c.border};color:${c.text};">${w}</span>`;}).join('');
        return`<td class="cr-cell-active ${isCurrent?'cr-cell-current-month':''} ${isPast&&screen?'cr-cell-past':''}"><div class="cr-cell-inner">${wh}</div></td>`;
      }).join('');
      const total=showMonths.reduce((a,i)=>a+(byMonth[i]||[]).length,0);
      return`<tr class="cr-row">
        <td class="cr-td-equipo"><div class="cr-equipo-name" title="${esc(equipo)}">${esc(equipo)}</div>${serie?`<div class="cr-equipo-sub">${esc(serie)}</div>`:''}${marca?`<div class="cr-equipo-sub">${esc(marca)}</div>`:''}</td>
        <td class="cr-td-freq"><span class="cr-freq-badge">${esc(freq)}</span></td>
        ${cells}
        <td class="cr-td-total"><strong>${total}</strong></td>
      </tr>`;
    }).join('');
    return`<div class="cr-service-block">
      <div class="cr-service-header">
        <span class="cr-service-icon">🏥</span>
        <span class="cr-service-name">${esc(svc)}</span>
        <span class="cr-service-badge">${filteredRecords.length} equipo${filteredRecords.length!==1?'s':''}</span>
      </div>
      <div class="cr-table-wrap"><table class="cr-table">
        <thead><tr><th class="cr-th-equipo">EQUIPO / SERIE</th><th class="cr-th-freq">FRECUENCIA</th>${headers}<th class="cr-th-total">TOTAL</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }

  function buildLegend(){
    return`<div class="cr-legend"><span class="cr-legend-title">Semanas:</span>${Object.entries(WEEK_COLORS).map(([s,c])=>`<span class="cr-legend-item" style="background:${c.bg};border:1.5px solid ${c.border};color:${c.text};">${s}</span>`).join('')}<span class="cr-legend-note">· Cada celda muestra la semana programada del mes</span></div>`;
  }

  // ── PRINT MODAL ────────────────────────────────────────────────────────────
  window.openPrintModal=function(){
    const modal=document.getElementById('crPrintModal');
    if(!modal)return;
    const svcList=document.getElementById('crPrintServices');
    if(svcList){
      svcList.innerHTML=crState.services.map(svc=>`<label class="cr-print-check"><input type="checkbox" value="${esc(svc)}" checked><span>${esc(svc)}</span></label>`).join('');
    }
    modal.style.display='flex';
    setTimeout(()=>modal.classList.add('active'),10);
  };

  window.closePrintModal=function(){
    const modal=document.getElementById('crPrintModal');
    if(modal){modal.classList.remove('active');setTimeout(()=>modal.style.display='none',250);}
  };

  window.crSelectAllServices=function(checked){
    document.querySelectorAll('#crPrintServices input[type="checkbox"]').forEach(cb=>cb.checked=checked);
  };
  window.crSelectAllMonths=function(checked){
    document.querySelectorAll('#crPrintMonths input[type="checkbox"]').forEach(cb=>cb.checked=checked);
  };

  window.executePrint=function(){
    const selectedServices=Array.from(document.querySelectorAll('#crPrintServices input[type="checkbox"]:checked')).map(cb=>cb.value);
    const selectedMonths=Array.from(document.querySelectorAll('#crPrintMonths input[type="checkbox"]:checked')).map(cb=>parseInt(cb.value));
    const printMode=document.querySelector('input[name="crPrintMode"]:checked').value;
    if(!selectedServices.length){alert('Selecciona al menos un servicio.');return;}
    if(!selectedMonths.length){alert('Selecciona al menos un mes.');return;}
    closePrintModal();
    setTimeout(()=>doPrint(selectedServices,selectedMonths,printMode),300);
  };

  function doPrint(services,months,mode){
    const cm=new Date().getMonth();
    const css=`
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:10px;color:#000;padding:12px;margin:0}
      .print-header{border-bottom:2px solid #0d47a1;padding-bottom:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end}
      h1{font-size:14px;color:#0d47a1;margin:0 0 3px}
      .print-subtitle{font-size:10px;color:#607d8b}
      .print-meta{font-size:9px;color:#90a4ae;text-align:right}
      .cr-service-block{margin-bottom:14px;page-break-inside:avoid}
      .cr-service-header{background:#0d47a1;color:white;padding:5px 10px;font-weight:700;font-size:11px;border-radius:3px;margin-bottom:2px;display:flex;align-items:center;gap:8px}
      .cr-service-icon{font-size:14px}
      .cr-service-name{flex:1}
      .cr-service-badge{background:rgba(255,255,255,.22);padding:2px 8px;border-radius:10px;font-size:9px}
      .cr-table-wrap{overflow:visible}
      .cr-table{width:100%;border-collapse:collapse;font-size:9px}
      .cr-table th,.cr-table td{border:1px solid #ccc;padding:4px;text-align:center;vertical-align:middle}
      .cr-table th{background:#eceff1;font-weight:700;font-size:8.5px;text-transform:uppercase;white-space:nowrap}
      .cr-th-equipo,.cr-td-equipo{text-align:left!important;min-width:130px;padding-left:8px!important}
      .cr-equipo-name{font-weight:700;font-size:9px}
      .cr-equipo-sub{font-size:8px;color:#607d8b}
      .cr-freq-badge{display:inline-block;padding:1px 6px;border-radius:10px;background:#e3f2fd;color:#0d47a1;font-weight:700;font-size:8px;white-space:nowrap}
      .cr-week-badge{display:inline-block;padding:1px 5px;border-radius:3px;border:1px solid;font-size:8px;font-weight:700;margin:1px}
      .cr-cell-current-month{background:#fff8e1!important}
      .cr-mes-current{background:#fff3e0!important;color:#e65100!important}
      .cr-cell-inner{display:flex;flex-direction:column;align-items:center;gap:2px}
      .cr-td-total{font-weight:700;color:#0d47a1}
      .cr-legend{margin-top:10px;font-size:9px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:5px 10px;background:#f5f5f5;border-radius:4px}
      .cr-legend-title{font-weight:700}
      .cr-legend-item{padding:2px 8px;border-radius:4px;border:1px solid;font-weight:700;font-size:8px}
      .month-page{page-break-after:always}
      .month-page:last-child{page-break-after:auto}
      @media print{@page{size:A3 landscape;margin:7mm}}
    `;

    let bodyHtml='';

    if(mode==='mensual'){
      months.sort((a,b)=>a-b).forEach((monthIdx,pi)=>{
        const isLast=pi===months.length-1;
        bodyHtml+=`<div class="${isLast?'':'month-page'}">
          <div class="print-header">
            <div><h1>Cronograma de Mantenimiento Preventivo ${YEAR}</h1>
            <div class="print-subtitle">Hospital Susana López de Valencia E.S.E · <strong>Mes: ${MESES[monthIdx]}</strong></div></div>
            <div class="print-meta">Generado: ${new Date().toLocaleDateString('es-CO')}<br>Sistema de Gestión de la Tecnología</div>
          </div>`;
        services.forEach(svc=>{
          const records=crState.allRecords.filter(r=>{
            const f=r.fields||{};
            return(f['Servicio']||f['SERVICIO']||'').trim()===svc&&parseSchedule(r).length>0;
          });
          bodyHtml+=buildServiceBlock(svc,records,[monthIdx],cm,false);
        });
        bodyHtml+=buildLegend()+'</div>';
      });
    }else{
      // Año completo / meses seleccionados
      const months_sorted=months.sort((a,b)=>a-b);
      bodyHtml+=`<div class="print-header">
        <div><h1>Cronograma de Mantenimiento Preventivo ${YEAR}</h1>
        <div class="print-subtitle">Hospital Susana López de Valencia E.S.E · ${services.length===crState.services.length?'Todos los servicios':services.join(', ')}</div></div>
        <div class="print-meta">Generado: ${new Date().toLocaleDateString('es-CO')}<br>Sistema de Gestión de la Tecnología</div>
      </div>`;
      services.forEach(svc=>{
        const records=crState.allRecords.filter(r=>{
          const f=r.fields||{};
          return(f['Servicio']||f['SERVICIO']||'').trim()===svc&&parseSchedule(r).length>0;
        });
        bodyHtml+=buildServiceBlock(svc,records,months_sorted,cm,false);
      });
      bodyHtml+=buildLegend();
    }

    const w=window.open('','_blank','width=1200,height=800');
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cronograma ${YEAR}</title><style>${css}</style></head><body>${bodyHtml}</body></html>`);
    w.document.close();
    setTimeout(()=>{w.focus();w.print();},600);
  }

  window.exportCronogramaCSV=function(){
    if(!crState.allRecords.length){alert('No hay datos');return;}
    const rows=[['Servicio','Equipo','Serie','Frecuencia','Mes','Semana']];
    crState.allRecords.forEach(r=>{
      const f=r.fields||{};
      parseSchedule(r).forEach(s=>rows.push([f['Servicio']||f['SERVICIO']||'',f['Equipo']||f['EQUIPO']||'',f['Serie']||f['SERIE']||'',f['Frecuencia de Mantenimiento']||f['Frecuencia de MTTO Preventivo']||'',MESES[s.mesIdx],s.semana]));
    });
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    a.download=`cronograma_${YEAR}.csv`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
  };

  // ── PENDIENTES / VENCIDOS ───────────────────────────────────────────────────
  // Equipos programados en un mes YA PASADO del anio en curso y SIN reporte
  // preventivo cargado para ese mes. Agrupados por servicio y discriminados
  // por marca, modelo y numero de serie.

  function crField(f, ...keys){ for(const k of keys){ if(f[k]!=null && String(f[k]).trim()!=='') return String(f[k]).trim(); } return ''; }

  // Meses (0-11) del anio del cronograma con reporte preventivo PROPIO cargado.
  function crRealizedMonths(f){
    const out=new Set();
    const prev=Array.isArray(f['Mantenimientos preventivo'])?f['Mantenimientos preventivo']:[];
    prev.filter(a=>!String((a&&a.filename)||'').toUpperCase().startsWith('TERC_')).forEach(a=>{
      const m=String((a&&a.filename)||'').match(/(\d{4})-(\d{2})-\d{2}/);
      if(!m)return;
      if(parseInt(m[1],10)!==YEAR)return;
      const mi=parseInt(m[2],10)-1;
      if(mi>=0&&mi<=11)out.add(mi);
    });
    return out;
  }

  // Devuelve [{svc,equipo,marca,modelo,serie,placa,freq,meses:[idx...]}]
  function crBuildVencidos(){
    const cm=new Date().getMonth();
    const list=[];
    crState.allRecords.forEach(r=>{
      const f=r.fields||{};
      const sched=parseSchedule(r);
      if(!sched.length)return;
      const realizados=crRealizedMonths(f);
      const meses=[];
      sched.forEach(s=>{
        if(s.mesIdx<cm && !realizados.has(s.mesIdx) && meses.indexOf(s.mesIdx)===-1) meses.push(s.mesIdx);
      });
      if(!meses.length)return;
      meses.sort((a,b)=>a-b);
      list.push({
        svc: crField(f,'Servicio','SERVICIO')||'Sin Servicio',
        equipo: crField(f,'Equipo','EQUIPO')||'\u2014',
        marca: crField(f,'Marca','MARCA'),
        modelo: crField(f,'Modelo','MODELO'),
        serie: crField(f,'Serie','SERIE'),
        placa: crField(f,'Numero de Placa','PLACA'),
        freq: crField(f,'Frecuencia de Mantenimiento','Frecuencia de MTTO Preventivo','FRECUENCIA DE MTTO PREVENTIVO')||'\u2014',
        meses,
      });
    });
    return list;
  }

  function crGroupBySvc(list){
    const g={};
    list.forEach(it=>{ (g[it.svc]=g[it.svc]||[]).push(it); });
    return g;
  }

  window.openPendientesModal=function(){
    if(!crState.loaded){ alert('Primero carga el cronograma.'); return; }
    const list=crBuildVencidos();
    const groups=crGroupBySvc(list);
    const totalEquipos=list.length;
    const totalEventos=list.reduce((a,it)=>a+it.meses.length,0);
    const numServicios=Object.keys(groups).length;

    let body='';
    if(!totalEquipos){
      body=`<div style="text-align:center;padding:48px 20px;color:#2e7d32;">
        <div style="font-size:54px;margin-bottom:10px;">\u2705</div>
        <div style="font-size:18px;font-weight:800;">Sin mantenimientos vencidos</div>
        <div style="font-size:13px;color:#78909c;margin-top:6px;">Todos los equipos con programaci\u00f3n en meses ya transcurridos tienen su reporte cargado.</div>
      </div>`;
    }else{
      body=Object.keys(groups).sort((a,b)=>a.localeCompare(b)).map(svc=>{
        const items=groups[svc].sort((a,b)=>a.equipo.localeCompare(b.equipo));
        const eventos=items.reduce((a,it)=>a+it.meses.length,0);
        const rows=items.map(it=>{
          const mesesBadges=it.meses.map(mi=>`<span style="display:inline-block;background:#fdecea;color:#b71c1c;border:1px solid #f5b7b1;border-radius:10px;padding:1px 8px;font-size:10.5px;font-weight:800;margin:1px;">${MESES_SHORT[mi]}</span>`).join(' ');
          return `<tr>
            <td style="padding:7px 9px;border-bottom:1px solid #eef1f5;font-weight:700;color:#263238;font-size:12px;">${esc(it.equipo)}${it.placa?`<div style="font-size:10px;color:#90a4ae;font-weight:600;">Placa: ${esc(it.placa)}</div>`:''}</td>
            <td style="padding:7px 9px;border-bottom:1px solid #eef1f5;font-size:11.5px;color:#455a64;">${esc(it.marca||'\u2014')}</td>
            <td style="padding:7px 9px;border-bottom:1px solid #eef1f5;font-size:11.5px;color:#455a64;">${esc(it.modelo||'\u2014')}</td>
            <td style="padding:7px 9px;border-bottom:1px solid #eef1f5;font-size:11.5px;color:#455a64;font-family:monospace;">${esc(it.serie||'\u2014')}</td>
            <td style="padding:7px 9px;border-bottom:1px solid #eef1f5;font-size:11px;color:#607d8b;">${esc(it.freq)}</td>
            <td style="padding:7px 9px;border-bottom:1px solid #eef1f5;text-align:center;">${mesesBadges}</td>
          </tr>`;
        }).join('');
        return `<div style="margin-bottom:18px;border:1px solid #e3e8ef;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#c62828,#8e0000);color:#fff;padding:9px 14px;display:flex;align-items:center;gap:10px;">
            <span style="font-size:16px;">\ud83c\udfe5</span>
            <span style="flex:1;font-weight:800;font-size:13.5px;">${esc(svc)}</span>
            <span style="background:rgba(255,255,255,.22);padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;">${items.length} equipo${items.length!==1?'s':''} \u00b7 ${eventos} venc.</span>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:720px;">
              <thead><tr style="background:#f5f7fa;">
                <th style="text-align:left;padding:8px 9px;font-size:10px;font-weight:800;color:#607d8b;text-transform:uppercase;letter-spacing:.4px;">Equipo</th>
                <th style="text-align:left;padding:8px 9px;font-size:10px;font-weight:800;color:#607d8b;text-transform:uppercase;letter-spacing:.4px;">Marca</th>
                <th style="text-align:left;padding:8px 9px;font-size:10px;font-weight:800;color:#607d8b;text-transform:uppercase;letter-spacing:.4px;">Modelo</th>
                <th style="text-align:left;padding:8px 9px;font-size:10px;font-weight:800;color:#607d8b;text-transform:uppercase;letter-spacing:.4px;">N\u00b0 Serie</th>
                <th style="text-align:left;padding:8px 9px;font-size:10px;font-weight:800;color:#607d8b;text-transform:uppercase;letter-spacing:.4px;">Frecuencia</th>
                <th style="text-align:center;padding:8px 9px;font-size:10px;font-weight:800;color:#607d8b;text-transform:uppercase;letter-spacing:.4px;">Meses vencidos</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
      }).join('');
    }

    const overlay=document.createElement('div');
    overlay.id='crPendModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(10,22,40,.78);z-index:12000;display:flex;align-items:center;justify-content:center;padding:18px;';
    overlay.onclick=function(e){ if(e.target===overlay) window.closePendientesModal(); };
    overlay.innerHTML=`
      <div style="background:#fff;border-radius:18px;width:100%;max-width:1080px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4);overflow:hidden;">
        <div style="background:linear-gradient(135deg,#b71c1c,#7f0000);color:#fff;padding:16px 22px;display:flex;align-items:center;gap:14px;">
          <div style="width:42px;height:42px;border-radius:11px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:21px;">\u26a0\ufe0f</div>
          <div style="flex:1;">
            <div style="font-size:17px;font-weight:800;">Mantenimientos Vencidos \u00b7 ${YEAR}</div>
            <div style="font-size:11.5px;opacity:.85;">Programados en meses ya transcurridos y sin reporte cargado</div>
          </div>
          <button onclick="closePendientesModal()" style="background:rgba(255,255,255,.18);border:none;color:#fff;width:34px;height:34px;border-radius:9px;font-size:18px;cursor:pointer;">\u2715</button>
        </div>
        <div style="padding:14px 22px;display:flex;gap:22px;flex-wrap:wrap;border-bottom:1px solid #eef1f5;background:#fafbfc;">
          <div><div style="font-size:26px;font-weight:800;color:#c62828;line-height:1;">${totalEquipos}</div><div style="font-size:10px;color:#90a4ae;text-transform:uppercase;letter-spacing:.5px;margin-top:3px;">Equipos vencidos</div></div>
          <div><div style="font-size:26px;font-weight:800;color:#e65100;line-height:1;">${totalEventos}</div><div style="font-size:10px;color:#90a4ae;text-transform:uppercase;letter-spacing:.5px;margin-top:3px;">Mantenimientos venc.</div></div>
          <div><div style="font-size:26px;font-weight:800;color:#37474f;line-height:1;">${numServicios}</div><div style="font-size:10px;color:#90a4ae;text-transform:uppercase;letter-spacing:.5px;margin-top:3px;">Servicios afectados</div></div>
          <div style="margin-left:auto;display:flex;gap:8px;align-items:center;">
            ${totalEquipos?`<button onclick="exportPendientesCSV()" class="cr-btn cr-btn-secondary" style="padding:8px 14px;border:1px solid #cfd8dc;border-radius:9px;background:#fff;font-weight:700;font-size:12px;cursor:pointer;">\ud83d\udcbe CSV</button>
            <button onclick="printPendientes()" class="cr-btn cr-btn-primary" style="padding:8px 14px;border:none;border-radius:9px;background:#c62828;color:#fff;font-weight:700;font-size:12px;cursor:pointer;">\ud83d\udda8\ufe0f Imprimir</button>`:''}
          </div>
        </div>
        <div style="padding:18px 22px;overflow-y:auto;flex:1;">${body}</div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow='hidden';
  };

  window.closePendientesModal=function(){
    const m=document.getElementById('crPendModal');
    if(m)m.remove();
    document.body.style.overflow='auto';
  };

  window.exportPendientesCSV=function(){
    const list=crBuildVencidos();
    if(!list.length){alert('No hay mantenimientos vencidos.');return;}
    const rows=[['Servicio','Equipo','Placa','Marca','Modelo','Numero de Serie','Frecuencia','Meses Vencidos']];
    list.sort((a,b)=>a.svc.localeCompare(b.svc)||a.equipo.localeCompare(b.equipo)).forEach(it=>{
      rows.push([it.svc,it.equipo,it.placa,it.marca,it.modelo,it.serie,it.freq,it.meses.map(mi=>MESES[mi]).join(' / ')]);
    });
    const csv='\uFEFF'+rows.map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    a.download=`mantenimientos_vencidos_${YEAR}.csv`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
  };

  window.printPendientes=function(){
    const list=crBuildVencidos();
    if(!list.length){alert('No hay mantenimientos vencidos.');return;}
    const groups=crGroupBySvc(list);
    const totalEquipos=list.length;
    const totalEventos=list.reduce((a,it)=>a+it.meses.length,0);
    let bodyHtml=`<div class="ph">
        <div><h1>Mantenimientos Preventivos Vencidos ${YEAR}</h1>
        <div class="sub">Hospital Susana L\u00f3pez de Valencia E.S.E \u00b7 Programados en meses ya transcurridos sin reporte cargado</div></div>
        <div class="meta">Generado: ${new Date().toLocaleDateString('es-CO')}<br>${totalEquipos} equipos \u00b7 ${totalEventos} mantenimientos vencidos</div>
      </div>`;
    Object.keys(groups).sort((a,b)=>a.localeCompare(b)).forEach(svc=>{
      const items=groups[svc].sort((a,b)=>a.equipo.localeCompare(b.equipo));
      const rows=items.map(it=>`<tr>
        <td class="l">${esc(it.equipo)}</td><td class="l">${esc(it.placa||'\u2014')}</td>
        <td class="l">${esc(it.marca||'\u2014')}</td><td class="l">${esc(it.modelo||'\u2014')}</td>
        <td class="l">${esc(it.serie||'\u2014')}</td><td class="l">${esc(it.freq)}</td>
        <td>${it.meses.map(mi=>MESES_SHORT[mi]).join(', ')}</td></tr>`).join('');
      bodyHtml+=`<div class="blk"><div class="bh">${esc(svc)} <span>${items.length} equipo${items.length!==1?'s':''}</span></div>
        <table><thead><tr><th>Equipo</th><th>Placa</th><th>Marca</th><th>Modelo</th><th>N\u00b0 Serie</th><th>Frecuencia</th><th>Meses vencidos</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
    });
    const css=`*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;padding:12px;margin:0}
      .ph{border-bottom:2px solid #b71c1c;padding-bottom:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end}
      h1{font-size:14px;color:#b71c1c;margin:0 0 3px}.sub{font-size:10px;color:#607d8b}.meta{font-size:9px;color:#90a4ae;text-align:right}
      .blk{margin-bottom:14px;page-break-inside:avoid}
      .bh{background:#b71c1c;color:#fff;padding:5px 10px;font-weight:700;font-size:11px;border-radius:3px;margin-bottom:2px}
      .bh span{background:rgba(255,255,255,.25);padding:1px 8px;border-radius:10px;font-size:9px;margin-left:6px}
      table{width:100%;border-collapse:collapse;font-size:9px}
      th,td{border:1px solid #ccc;padding:4px;text-align:center}th{background:#fdecea;font-weight:700;font-size:8.5px;text-transform:uppercase}
      td.l,th:first-child{text-align:left}
      @media print{@page{size:A4 landscape;margin:8mm}}`;
    const w=window.open('','_blank','width=1100,height=800');
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Vencidos ${YEAR}</title><style>${css}</style></head><body>${bodyHtml}</body></html>`);
    w.document.close();
    setTimeout(()=>{w.focus();w.print();},500);
  };

  window.loadCronograma=loadCronograma;

})();
