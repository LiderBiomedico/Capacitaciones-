
// ==================== CURSOS DE EXTENSIÓN ====================
(function(){
    const EXT_TABLE = 'Cursos de Extension';
    const EXT_FORUM_TABLE = 'Foro Cursos Extension';
    const EXT_JSON_FIELD = 'Contenido JSON';
    window.extensionCourses = window.extensionCourses || [];

    function extEscape(value){
        return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }
    function uid(prefix){ return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
    function extPath(table){ return '/' + encodeURIComponent(table).replace(/%20/g,'%20'); }
    function extGetStorage(){ try { return JSON.parse(localStorage.getItem('extensionCourses') || '[]'); } catch(e){ return []; } }
    function extSaveStorage(){ try { localStorage.setItem('extensionCourses', JSON.stringify(window.extensionCourses)); } catch(e){} }
    async function extProxy(payload){
        if (typeof virtualCourseProxy === 'function') return virtualCourseProxy(payload);
        const res = await fetch('/.netlify/functions/airtable-proxy', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
        const text = await res.text(); let data={}; try{ data=text?JSON.parse(text):{}; }catch{ data={raw:text}; }
        if(!res.ok || data.success===false) throw new Error(data.error || data.message || text || `Error HTTP ${res.status}`);
        return data;
    }
    function parseExtRecord(record){
        const f = record?.fields || {}; let course = null;
        const raw = f[EXT_JSON_FIELD] || f['JSON'] || f['Datos'] || '';
        if(raw){ try { course = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e){} }
        if(!course || typeof course !== 'object') course = { id:`airtable-${record.id}`, title:f['Nombre']||f['Título']||'Curso de extensión', teacher:{name:f['Docente']||''}, resources:{pdfs:[],videos:[]}, tests:[], forumPrompt:f['Foro']||'' };
        course.airtableRecordId = record.id;
        course.id = course.id || `airtable-${record.id}`;
        return course;
    }
    async function loadExtensionCoursesFromAirtable(silent=false){
        try{
            const data = await extProxy({ method:'GET', path: extPath(EXT_TABLE) });
            const records = Array.isArray(data.records) ? data.records : (Array.isArray(data?.data?.records) ? data.data.records : []);
            window.extensionCourses = records.map(parseExtRecord).filter(Boolean);
            extSaveStorage();
        }catch(err){
            window.extensionCourses = extGetStorage();
            if(!silent && window.Swal) Swal.fire({icon:'info', title:'Modo local', html:`No se pudo leer la tabla <strong>${EXT_TABLE}</strong> en Airtable. Se muestran los cursos guardados localmente.<br><br><small>${extEscape(err.message||'')}</small>`});
        }
    }
    async function saveExtensionCourseToAirtable(course){
        const fields = {
            'Nombre': course.title,
            'Docente': course.teacher?.name || '',
            'Categoría': course.category || '',
            'Estado': course.status || 'Activo',
            'Contenido JSON': JSON.stringify(course)
        };
        if(course.airtableRecordId){
            const data = await extProxy({ method:'PATCH', path:`${extPath(EXT_TABLE)}/${course.airtableRecordId}`, body:{fields} });
            const record = data.record || data;
            return parseExtRecord(record);
        }
        const data = await extProxy({ method:'POST', path: extPath(EXT_TABLE), body:{fields} });
        const record = data.record || data;
        return parseExtRecord(record);
    }

    window.openExtensionCourseBuilder = function(){
        const modal = document.getElementById('extensionCourseModal');
        if(modal) modal.style.display='flex';
        resetExtensionCourseForm();
        addExtensionDiploma(); addExtensionPdf(); addExtensionVideo(); addExtensionTest();
    };
    window.closeExtensionCourseBuilder = function(){ const m=document.getElementById('extensionCourseModal'); if(m) m.style.display='none'; };
    window.resetExtensionCourseForm = function(){
        ['extensionTeacherName','extensionTeacherRole','extensionTeacherEmail','extensionTeacherPhone','extensionTeacherPhoto','extensionTeacherBio','extensionCourseTitle','extensionCourseCategory','extensionCourseAudience','extensionCourseDuration','extensionCourseDescription','extensionForumPrompt'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
        const mode=document.getElementById('extensionCourseMode'); if(mode) mode.value='Virtual';
        const status=document.getElementById('extensionCourseStatus'); if(status) status.value='Activo';
        ['extensionDiplomasContainer','extensionPdfsContainer','extensionVideosContainer','extensionTestsContainer'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=''; });
    };
    window.addExtensionDiploma = function(){
        const id=uid('diploma'); const c=document.getElementById('extensionDiplomasContainer'); if(!c) return;
        c.insertAdjacentHTML('beforeend', `<div class="extension-item" id="${id}"><div style="display:flex;justify-content:space-between;gap:.5rem;"><strong>Diploma / curso</strong><button class="btn btn-light" onclick="document.getElementById('${id}').remove()"><i class="fas fa-trash"></i></button></div><div class="extension-form-grid"><div class="form-group"><label>Título</label><input class="ext-diploma-title" placeholder="Nombre del diploma o curso"></div><div class="form-group"><label>Institución</label><input class="ext-diploma-institution" placeholder="Institución"></div><div class="form-group"><label>Año</label><input class="ext-diploma-year" placeholder="2026"></div><div class="form-group"><label>URL soporte</label><input class="ext-diploma-url" placeholder="https://...pdf"></div></div></div>`);
    };
    window.addExtensionPdf = function(){
        const id=uid('pdf'); const c=document.getElementById('extensionPdfsContainer'); if(!c) return;
        c.insertAdjacentHTML('beforeend', `<div class="extension-item" id="${id}"><div class="form-group"><label>Nombre PDF</label><input class="ext-pdf-title" placeholder="Guía del curso"></div><div class="form-group"><label>URL PDF</label><input class="ext-pdf-url" placeholder="https://...pdf"></div><button class="btn btn-light" onclick="document.getElementById('${id}').remove()"><i class="fas fa-trash"></i> Quitar</button></div>`);
    };
    window.addExtensionVideo = function(){
        const id=uid('video'); const c=document.getElementById('extensionVideosContainer'); if(!c) return;
        c.insertAdjacentHTML('beforeend', `<div class="extension-item" id="${id}"><div class="form-group"><label>Nombre video</label><input class="ext-video-title" placeholder="Clase 1"></div><div class="form-group"><label>URL video</label><input class="ext-video-url" placeholder="https://...mp4 / YouTube / Vimeo"></div><button class="btn btn-light" onclick="document.getElementById('${id}').remove()"><i class="fas fa-trash"></i> Quitar</button></div>`);
    };
    window.addExtensionTest = function(){
        const id=uid('test'); const c=document.getElementById('extensionTestsContainer'); if(!c) return;
        c.insertAdjacentHTML('beforeend', `<div class="extension-item ext-test-card" id="${id}"><div class="extension-subheader"><h4><i class="fas fa-clipboard-list"></i> Test</h4><button class="btn btn-light" onclick="document.getElementById('${id}').remove()"><i class="fas fa-trash"></i></button></div><div class="extension-form-grid"><div class="form-group"><label>Nombre del test *</label><input class="ext-test-title" placeholder="Evaluación final"></div><div class="form-group"><label>Número de intentos permitidos *</label><input type="number" min="1" value="2" class="ext-test-attempts"></div><div class="form-group"><label>Imagen portada del test URL</label><input class="ext-test-image" placeholder="https://...jpg"></div></div><div class="extension-subheader"><h4>Preguntas</h4><button class="btn btn-secondary" onclick="addExtensionQuestion('${id}')"><i class="fas fa-plus"></i> Pregunta</button></div><div class="ext-questions"></div></div>`);
        addExtensionQuestion(id);
    };
    window.addExtensionQuestion = function(testId){
        const test=document.getElementById(testId); const c=test?.querySelector('.ext-questions'); if(!c) return; const id=uid('q');
        c.insertAdjacentHTML('beforeend', `<div class="extension-item ext-question-card" id="${id}" style="background:#fff;"><div style="display:flex;justify-content:space-between;gap:.5rem;"><strong>Pregunta</strong><button class="btn btn-light" onclick="document.getElementById('${id}').remove()"><i class="fas fa-trash"></i></button></div><div class="form-group"><label>Enunciado *</label><textarea class="ext-q-text" rows="2" placeholder="Escribe la pregunta"></textarea></div><div class="form-group"><label>Imagen de la pregunta URL</label><input class="ext-q-image" placeholder="https://...jpg/png"></div><div class="extension-form-grid"><div class="form-group"><label>Opción A *</label><input class="ext-q-a"></div><div class="form-group"><label>Opción B *</label><input class="ext-q-b"></div><div class="form-group"><label>Opción C</label><input class="ext-q-c"></div><div class="form-group"><label>Opción D</label><input class="ext-q-d"></div><div class="form-group"><label>Correcta</label><select class="ext-q-correct"><option>A</option><option>B</option><option>C</option><option>D</option></select></div></div></div>`);
    };

    function collectExtensionCourse(){
        const title=(document.getElementById('extensionCourseTitle')?.value||'').trim();
        const teacherName=(document.getElementById('extensionTeacherName')?.value||'').trim();
        if(!title) throw new Error('Ingresa el nombre del curso de extensión.');
        if(!teacherName) throw new Error('Ingresa el nombre del docente.');
        const diplomas=[...document.querySelectorAll('#extensionDiplomasContainer .extension-item')].map(el=>({title:el.querySelector('.ext-diploma-title')?.value?.trim()||'', institution:el.querySelector('.ext-diploma-institution')?.value?.trim()||'', year:el.querySelector('.ext-diploma-year')?.value?.trim()||'', url:el.querySelector('.ext-diploma-url')?.value?.trim()||''})).filter(x=>x.title||x.url);
        const pdfs=[...document.querySelectorAll('#extensionPdfsContainer .extension-item')].map(el=>({title:el.querySelector('.ext-pdf-title')?.value?.trim()||'PDF del curso', url:el.querySelector('.ext-pdf-url')?.value?.trim()||''})).filter(x=>x.url);
        const videos=[...document.querySelectorAll('#extensionVideosContainer .extension-item')].map(el=>({title:el.querySelector('.ext-video-title')?.value?.trim()||'Video del curso', url:el.querySelector('.ext-video-url')?.value?.trim()||''})).filter(x=>x.url);
        const tests=[...document.querySelectorAll('#extensionTestsContainer .ext-test-card')].map((el,idx)=>{
            const testTitle=el.querySelector('.ext-test-title')?.value?.trim()||`Test ${idx+1}`;
            const attempts=Math.max(1, Number(el.querySelector('.ext-test-attempts')?.value||1));
            const image=el.querySelector('.ext-test-image')?.value?.trim()||'';
            const questions=[...el.querySelectorAll('.ext-question-card')].map((q,qidx)=>({id:uid('question'), text:q.querySelector('.ext-q-text')?.value?.trim()||'', image:q.querySelector('.ext-q-image')?.value?.trim()||'', options:{A:q.querySelector('.ext-q-a')?.value?.trim()||'', B:q.querySelector('.ext-q-b')?.value?.trim()||'', C:q.querySelector('.ext-q-c')?.value?.trim()||'', D:q.querySelector('.ext-q-d')?.value?.trim()||''}, correct:q.querySelector('.ext-q-correct')?.value||'A'})).filter(q=>q.text && q.options.A && q.options.B);
            return {id:uid('test'), title:testTitle, attempts, image, questions};
        }).filter(t=>t.questions.length);
        return { id:uid('extension'), createdAt:new Date().toISOString(), title, category:(document.getElementById('extensionCourseCategory')?.value||'').trim(), audience:(document.getElementById('extensionCourseAudience')?.value||'').trim(), duration:(document.getElementById('extensionCourseDuration')?.value||'').trim(), mode:document.getElementById('extensionCourseMode')?.value||'Virtual', status:document.getElementById('extensionCourseStatus')?.value||'Activo', description:(document.getElementById('extensionCourseDescription')?.value||'').trim(), teacher:{name:teacherName, role:(document.getElementById('extensionTeacherRole')?.value||'').trim(), email:(document.getElementById('extensionTeacherEmail')?.value||'').trim(), phone:(document.getElementById('extensionTeacherPhone')?.value||'').trim(), photo:(document.getElementById('extensionTeacherPhoto')?.value||'').trim(), bio:(document.getElementById('extensionTeacherBio')?.value||'').trim(), diplomas}, resources:{pdfs,videos}, forumPrompt:(document.getElementById('extensionForumPrompt')?.value||'Preséntese e indique qué espera aprender en este curso.').trim(), tests };
    }

    window.saveExtensionCourse = async function(){
        try{
            const course=collectExtensionCourse();
            if(window.Swal) Swal.fire({title:'Guardando curso de extensión...', allowOutsideClick:false, didOpen:()=>Swal.showLoading()});
            let saved=course;
            try { saved = await saveExtensionCourseToAirtable(course); }
            catch(err){ course.airtableWarning = err.message || 'No se pudo guardar en Airtable'; saved = course; }
            window.extensionCourses.unshift(saved); extSaveStorage(); renderExtensionCoursesList(false); closeExtensionCourseBuilder();
            if(window.Swal) Swal.fire({icon:saved.airtableWarning?'warning':'success', title:saved.airtableWarning?'Curso guardado localmente':'Curso de extensión creado', html:saved.airtableWarning?`El curso quedó guardado localmente. Para guardar en Airtable crea la tabla <strong>${EXT_TABLE}</strong> con el campo <strong>${EXT_JSON_FIELD}</strong>.<br><br><small>${extEscape(saved.airtableWarning)}</small>`:'El curso quedó listo con docente, recursos, foro y test.'});
        }catch(err){ if(window.Swal) Swal.fire({icon:'warning', title:'Revisa los datos', text:err.message || 'No se pudo crear el curso.'}); }
    };

    window.renderExtensionCoursesList = async function(loadRemote=false){
        const cont=document.getElementById('extensionCoursesList'); if(!cont) return;
        if(loadRemote){ cont.innerHTML='<div style="padding:1rem;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b;text-align:center;font-weight:700;"><i class="fas fa-spinner fa-spin"></i> Cargando cursos de extensión...</div>'; await loadExtensionCoursesFromAirtable(true); }
        else if(!window.extensionCourses.length) window.extensionCourses=extGetStorage();
        const courses=window.extensionCourses;
        const teachers=new Set(courses.map(c=>c.teacher?.name).filter(Boolean));
        const resources=courses.reduce((a,c)=>a+(c.resources?.pdfs?.length||0)+(c.resources?.videos?.length||0),0);
        const tests=courses.reduce((a,c)=>a+(c.tests?.length||0),0);
        const set=(id,v)=>{const el=document.getElementById(id); if(el) el.textContent=v;}; set('extensionTeachersCount',teachers.size); set('extensionCoursesCount',courses.length); set('extensionResourcesCount',resources); set('extensionTestsCount',tests);
        if(!courses.length){ cont.innerHTML='<div style="padding:1rem;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b;text-align:center;font-weight:600;">Aún no hay cursos de extensión creados.</div>'; return; }
        cont.innerHTML=courses.map(course=>`<div class="extension-course-card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;"><div style="display:flex;gap:1rem;align-items:flex-start;min-width:260px;flex:1;">${course.teacher?.photo?`<img class="extension-teacher-photo" src="${extEscape(course.teacher.photo)}" onerror="this.style.display='none'">`:`<div class="extension-teacher-photo" style="display:flex;align-items:center;justify-content:center;"><i class="fas fa-user-tie" style="color:#0f766e;font-size:1.6rem;"></i></div>`}<div><h3 style="margin:0 0 .25rem;color:#0f172a;">${extEscape(course.title)}</h3><p style="margin:0;color:#64748b;font-weight:500;">Docente: <strong>${extEscape(course.teacher?.name||'Sin registrar')}</strong> ${course.teacher?.role?`• ${extEscape(course.teacher.role)}`:''}</p><p style="margin:.35rem 0 0;color:#475569;">${extEscape(course.description||'Curso de extensión sin descripción')}</p><div style="margin-top:.55rem;"><span class="extension-badge"><i class="fas fa-file-pdf"></i>${course.resources?.pdfs?.length||0} PDF</span><span class="extension-badge"><i class="fas fa-video"></i>${course.resources?.videos?.length||0} videos</span><span class="extension-badge"><i class="fas fa-award"></i>${course.teacher?.diplomas?.length||0} diplomas</span><span class="extension-badge"><i class="fas fa-clipboard-question"></i>${course.tests?.length||0} test</span></div></div></div><div style="display:flex;gap:.5rem;flex-wrap:wrap;"><button class="btn btn-primary" style="background:#0f766e;border-color:#0f766e;" onclick="viewExtensionCourse('${course.id}')"><i class="fas fa-eye"></i> Ver</button><button class="btn btn-light" onclick="deleteExtensionCourse('${course.id}')"><i class="fas fa-trash"></i> Eliminar</button></div></div></div>`).join('');
    };

    window.viewExtensionCourse = function(id){
        const c=window.extensionCourses.find(x=>x.id===id); if(!c) return;
        const pdfs=(c.resources?.pdfs||[]).map(r=>`<li><a href="${extEscape(r.url)}" target="_blank">${extEscape(r.title||'PDF')}</a></li>`).join('') || '<li>Sin PDF</li>';
        const videos=(c.resources?.videos||[]).map(r=>`<li><a href="${extEscape(r.url)}" target="_blank">${extEscape(r.title||'Video')}</a></li>`).join('') || '<li>Sin videos</li>';
        const diplomas=(c.teacher?.diplomas||[]).map(d=>`<li>${extEscape(d.title||'Diploma')} ${d.institution?`- ${extEscape(d.institution)}`:''} ${d.year?`(${extEscape(d.year)})`:''} ${d.url?`<a href="${extEscape(d.url)}" target="_blank">ver soporte</a>`:''}</li>`).join('') || '<li>Sin diplomas registrados</li>';
        const tests=(c.tests||[]).map(t=>`<button class="btn btn-secondary" style="margin:.25rem;" onclick="startExtensionTest('${c.id}','${t.id}')"><i class="fas fa-clipboard-check"></i> ${extEscape(t.title)} (${t.attempts} intentos)</button>`).join('') || '<p>Sin test configurados.</p>';
        Swal.fire({title:extEscape(c.title), width:900, html:`<div style="text-align:left;line-height:1.55;"><h4>Docente</h4><p><strong>${extEscape(c.teacher?.name||'')}</strong><br>${extEscape(c.teacher?.role||'')}<br>${extEscape(c.teacher?.bio||'')}</p><h4>Diplomas y cursos</h4><ul>${diplomas}</ul><h4>Recursos PDF</h4><ul>${pdfs}</ul><h4>Videos</h4><ul>${videos}</ul><h4>Foro de presentación</h4><p>${extEscape(c.forumPrompt||'Preséntese en el foro.')}</p><button class="btn btn-primary" style="background:#0f766e;border-color:#0f766e;" onclick="openExtensionForum('${c.id}')"><i class="fas fa-comments"></i> Abrir foro</button><h4 style="margin-top:1rem;">Test disponibles</h4>${tests}</div>`, showConfirmButton:true, confirmButtonText:'Cerrar'});
    };
    window.deleteExtensionCourse=function(id){
        Swal.fire({icon:'warning',title:'Eliminar curso de extensión',text:'Se eliminará del respaldo local de la plataforma.',showCancelButton:true,confirmButtonText:'Eliminar',cancelButtonText:'Cancelar'}).then(r=>{ if(!r.isConfirmed) return; window.extensionCourses=window.extensionCourses.filter(c=>c.id!==id); extSaveStorage(); renderExtensionCoursesList(false); });
    };
    window.openExtensionForum=async function(courseId){
        const c=window.extensionCourses.find(x=>x.id===courseId); if(!c) return;
        const key=`extensionForum_${courseId}`; let posts=[]; try{posts=JSON.parse(localStorage.getItem(key)||'[]');}catch(e){}
        const postsHtml=posts.slice().reverse().map(p=>`<div style="border:1px solid #e2e8f0;border-radius:10px;padding:.65rem;margin:.45rem 0;background:#f8fafc;"><strong>${extEscape(p.name)}</strong> <small>${new Date(p.date).toLocaleString('es-CO')}</small><p style="margin:.35rem 0 0;">${extEscape(p.message)}</p></div>`).join('') || '<p style="color:#64748b;">Aún no hay presentaciones.</p>';
        const res=await Swal.fire({title:'Foro de presentación',width:760,html:`<div style="text-align:left;"><p><strong>${extEscape(c.forumPrompt||'Preséntese en el foro.')}</strong></p><input id="extForumName" class="swal2-input" placeholder="Nombre completo" style="margin:.35rem 0;width:100%;"><textarea id="extForumMsg" class="swal2-textarea" placeholder="Escribe tu presentación" style="margin:.35rem 0;width:100%;"></textarea><h4>Participaciones</h4>${postsHtml}</div>`,showCancelButton:true,confirmButtonText:'Publicar',cancelButtonText:'Cerrar',preConfirm:()=>{const name=document.getElementById('extForumName')?.value.trim(); const message=document.getElementById('extForumMsg')?.value.trim(); if(!name||!message){Swal.showValidationMessage('Ingresa nombre y presentación.'); return false;} return {name,message,date:new Date().toISOString(),course:c.title};}});
        if(res.isConfirmed){ posts.push(res.value); localStorage.setItem(key,JSON.stringify(posts)); try{ await extProxy({method:'POST', path:extPath(EXT_FORUM_TABLE), body:{fields:{Curso:c.title, Nombre:res.value.name, Mensaje:res.value.message, Fecha:res.value.date}}}); }catch(e){} Swal.fire({icon:'success',title:'Participación guardada',timer:1300,showConfirmButton:false}); }
    };
    window.startExtensionTest=async function(courseId,testId){
        const c=window.extensionCourses.find(x=>x.id===courseId); const t=c?.tests?.find(x=>x.id===testId); if(!c||!t) return;
        const who=await Swal.fire({title:'Datos del participante',html:'<input id="extTestName" class="swal2-input" placeholder="Nombre completo"><input id="extTestId" class="swal2-input" placeholder="Cédula / identificación">',showCancelButton:true,confirmButtonText:'Iniciar',preConfirm:()=>{const name=document.getElementById('extTestName')?.value.trim(); const doc=document.getElementById('extTestId')?.value.trim(); if(!name||!doc){Swal.showValidationMessage('Ingresa nombre e identificación.'); return false;} return {name,doc};}});
        if(!who.isConfirmed) return;
        const attemptKey=`extensionAttempts_${courseId}_${testId}_${who.value.doc}`; const used=Number(localStorage.getItem(attemptKey)||0);
        if(used >= Number(t.attempts||1)){ Swal.fire({icon:'warning',title:'Intentos agotados',text:`Este participante ya utilizó los ${t.attempts} intento(s) permitidos.`}); return; }
        const qHtml=(t.questions||[]).map((q,i)=>`<div style="text-align:left;border:1px solid #e2e8f0;border-radius:12px;padding:.75rem;margin:.6rem 0;background:#fff;"><strong>${i+1}. ${extEscape(q.text)}</strong>${q.image?`<br><img src="${extEscape(q.image)}" style="max-width:100%;max-height:180px;border-radius:10px;margin:.5rem 0;">`:''}${['A','B','C','D'].filter(k=>q.options?.[k]).map(k=>`<label style="display:block;margin:.35rem 0;"><input type="radio" name="q${i}" value="${k}"> <strong>${k}.</strong> ${extEscape(q.options[k])}</label>`).join('')}</div>`).join('');
        const res=await Swal.fire({title:extEscape(t.title), width:860, html:`<div>${t.image?`<img src="${extEscape(t.image)}" style="max-width:100%;max-height:190px;border-radius:12px;margin-bottom:.5rem;">`:''}<p>Intento ${used+1} de ${t.attempts}</p>${qHtml}</div>`,showCancelButton:true,confirmButtonText:'Enviar respuestas',cancelButtonText:'Cancelar',preConfirm:()=>{const answers={}; for(let i=0;i<t.questions.length;i++){ const checked=document.querySelector(`input[name="q${i}"]:checked`); if(!checked){Swal.showValidationMessage(`Responde la pregunta ${i+1}.`); return false;} answers[i]=checked.value;} return answers; }});
        if(!res.isConfirmed) return;
        let correct=0; t.questions.forEach((q,i)=>{ if(res.value[i]===q.correct) correct++; });
        const percent=Math.round((correct/(t.questions.length||1))*100); localStorage.setItem(attemptKey,String(used+1));
        Swal.fire({icon:percent>=80?'success':'info',title:`Resultado: ${percent}%`,html:`Correctas: <strong>${correct}</strong> de <strong>${t.questions.length}</strong><br>Intentos usados: <strong>${used+1}</strong> de <strong>${t.attempts}</strong>`});
    };

    const previousSwitch = window.switchTab;
    window.switchTab = function(tabName){
        if(typeof previousSwitch === 'function') previousSwitch(tabName);
        if(tabName === 'extensionCourses') renderExtensionCoursesList(true);
    };
})();
