// ============================================================================
// MÓDULO MANTENIMIENTOS - HSLV  v3
// Mantenimiento preventivo con protocolo por equipo, cronómetro,
// firma digital, generación PDF y carga a Airtable
// ============================================================================
(function () {
  console.log('[MANT] mantenimientos.js v3 cargando...');
  if (window.__HSLV_MANT_LOADED) { console.log('[MANT] Ya cargado, saltando'); return; }
  window.__HSLV_MANT_LOADED = true;
  console.log('[MANT] Módulo inicializado');

  const BASE = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '/.netlify/functions';

  const FIELD_PREV = 'Mantenimientos preventivo';
  const FIELD_CORR = 'Mantenimientos correctivos';
  const FIELD_TERC = 'Mantenimientos preventivo'; // Terceros también van al campo preventivo con prefijo TERC_

  const mtState = window.__HSLV_MT_STATE || (window.__HSLV_MT_STATE = {
    reports: [],
    inventario: [],
    invLoaded: false,
    filterTipo: 'TODOS',
    filterEstado: 'TODOS',
    filterSearch: '',
    timerRunning: false,
    timerStart: null,
    timerElapsed: 0,
    timerInterval: null,
    signaturePads: {},
  });

  function hdr() { try { if (typeof getAuthHeader === 'function') return getAuthHeader(); } catch(e){} return {}; }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmt(v) { if(!v)return''; try{ if(/^\d{4}-\d{2}-\d{2}$/.test(v)){var p=v.split('-');return parseInt(p[2])+'/'+parseInt(p[1])+'/'+p[0];} const d=new Date(v); return isNaN(d)?v:d.toLocaleDateString('es-CO'); }catch(_){return v;} }
  function localDateStr(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function localTimeStr(){ var d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
  function setText(id,v){ const el=document.getElementById(id); if(el)el.textContent=v; }
  function getVal(id){ return (document.getElementById(id)||{}).value||''; }

  // ══════════════════════════════════════════════════════════════════════
  // PROTOCOLOS DE MANTENIMIENTO POR TIPO DE EQUIPO
  // ══════════════════════════════════════════════════════════════════════
  const PROTOCOLOS = {


    'chattanooga_intelect_nmes_portatil': {
      nombre: 'Estimulador Eléctrico Portátil Chattanooga Intelect NMES',
      categoria: 'Biomédico / Electroterapia portátil',
      codigo: 'SLV-GAT-BIO-EEP-INTELLECT-NMES',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el estimulador eléctrico portátil Chattanooga Intelect NMES del uso clínico antes de iniciar el mantenimiento preventivo y confirme que no esté conectado a un paciente.',
        'Apague el equipo, retire la batería de 9 V si aplica y desconecte todos los cables de paciente antes de limpieza, inspección o manipulación de conectores.',
        'Realice el mantenimiento con base en las recomendaciones del fabricante, manual de usuario y manual de servicio disponible, sin abrir la carcasa ni intervenir componentes internos durante mantenimiento preventivo rutinario.',
        'Verifique que el equipo se utilice únicamente por personal entrenado y bajo prescripción/indicación clínica; no realice pruebas de estimulación sobre pacientes durante el mantenimiento.',
        'No use el equipo en presencia de humedad, daño por golpe, olor a quemado, batería sulfatada, conectores flojos, cable conductor expuesto, electrodos deteriorados o salida de estimulación inestable.',
        'No coloque electrodos entre sí, cruzados sobre tórax/corazón, cuello anterior, cabeza o zonas contraindicadas. Para prueba funcional use carga simulada/resistencia o verificación controlada, no aplicación directa al cuerpo del técnico.',
        'Los electrodos autoadhesivos son de uso individual; verifique fecha, adherencia, integridad, empaque y disposición final conforme a bioseguridad. Si se usan electrodos de silicona/carbón reutilizables, deben limpiarse y secarse completamente.',
        'Limpie la carcasa con paño suave ligeramente humedecido con solución compatible. No sumerja el equipo, no aplique aerosol directo y evite ingreso de líquido en controles, pantalla, puerto de batería o conectores.',
        'Limpie los cables conductores con paño húmedo y revise que el aislamiento no esté pegajoso, quebradizo, cortado o con falsos contactos.',
        'Confirme disponibilidad de batería nueva o cargada, cables de paciente compatibles, electrodos compatibles Chattanooga/Dura-Stick o equivalentes autorizados, resistencia de prueba/carga simulada y formato de registro.',
        'Si durante la prueba se evidencia corriente irregular, ausencia de salida, error de pantalla, controles defectuosos, batería con fuga o daño de cables/electrodos, marque el equipo como no apto y genere correctivo.',
        'Toda reparación interna, calibración técnica o ajuste de salida debe ser realizada por servicio técnico autorizado o personal calificado con analizador de electroterapia y documentación técnica aplicable.'
      ],
      inspeccion: [
        { id: 'cinmes_i1', item: 'Carcasa del estimulador íntegra, limpia, sin fisuras, golpes, deformación, humedad interna, residuos de gel, corrosión o partes sueltas' },
        { id: 'cinmes_i2', item: 'Pantalla/display legible, sin segmentos faltantes, manchas, parpadeo, líneas, roturas o baja visibilidad' },
        { id: 'cinmes_i3', item: 'Controles de encendido, intensidad, modo, frecuencia, ancho de pulso, rampa, tiempo y selección de canal funcionales, sin atascamiento ni juego excesivo' },
        { id: 'cinmes_i4', item: 'Tapa y compartimiento de batería íntegros, con cierre firme, contactos limpios, sin sulfatación, fuga, oxidación, resortes deformados o polaridad ilegible' },
        { id: 'cinmes_i5', item: 'Batería instalada o disponible en buen estado, sin fuga, hinchamiento, calentamiento, sulfatación o vencimiento evidente' },
        { id: 'cinmes_i6', item: 'Conectores de salida/canales firmes, limpios, sin pines flojos, hundidos, corroídos, deformados o con falso contacto' },
        { id: 'cinmes_i7', item: 'Cables conductores de paciente completos, flexibles, sin cortes, peladuras, aplastamientos, zonas rígidas, conectores flojos o aislamiento expuesto' },
        { id: 'cinmes_i8', item: 'Electrodos autoadhesivos o reutilizables disponibles, compatibles, íntegros, limpios, con gel/adherencia adecuada y sin contaminación visible' },
        { id: 'cinmes_i9', item: 'Broches, pines o conectores de electrodos con acople firme al cable, sin holgura, corrosión o desprendimiento' },
        { id: 'cinmes_i10', item: 'Etiquetas de marca Chattanooga, modelo Intelect NMES, serial/activo fijo, advertencias, polaridad y símbolos de seguridad legibles y coincidentes con inventario' },
        { id: 'cinmes_i11', item: 'Estuche, clip, manual rápido, accesorios y elementos de transporte disponibles, limpios y en buen estado si aplican' },
        { id: 'cinmes_i12', item: 'No se evidencian reparaciones improvisadas, cinta, pegantes, modificaciones no autorizadas o accesorios incompatibles' },
        { id: 'cinmes_i13', item: 'Superficies externas desinfectadas, secas y sin residuos químicos o gel en zonas de contacto con usuario/paciente' },
        { id: 'cinmes_i14', item: 'Condición general apta para uso clínico portátil: equipo liviano, identificable, completo y almacenado de forma segura' }
      ],
      verificacion: [
        { id: 'cinmes_v1', item: 'Encendido inicial con batería', valorEsperado: 'El equipo enciende, muestra pantalla legible y no presenta reinicios, alarma técnica o calentamiento anormal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_v2', item: 'Apagado desde control principal', valorEsperado: 'El equipo apaga completamente y no queda salida activa en los canales', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_v3', item: 'Autoverificación/indicadores básicos si aplica', valorEsperado: 'Indicadores, símbolos de batería y parámetros responden sin códigos de error', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_v4', item: 'Selección de modo/programa NMES', valorEsperado: 'Permite seleccionar programas o parámetros NMES según configuración del equipo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_v5', item: 'Ajuste de intensidad por canal', valorEsperado: 'La intensidad aumenta/disminuye progresivamente y retorna a cero sin saltos o bloqueo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_v6', item: 'Ajuste de tiempo de tratamiento', valorEsperado: 'Temporizador permite configuración, conteo y finalización sin congelamiento', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_v7', item: 'Conexión de cables y electrodos/carga simulada', valorEsperado: 'El equipo reconoce conexión estable y no genera alarma de circuito abierto con carga adecuada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_v8', item: 'Alarma o indicación de batería baja si aplica', valorEsperado: 'El indicador de batería se visualiza y no hay caída brusca de pantalla durante la prueba', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_v9', item: 'Fijación de conectores durante movimiento leve', valorEsperado: 'No se presentan interrupciones, cambios bruscos de salida o apagado al mover suavemente cables/conectores', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_v10', item: 'Condición posterior a limpieza', valorEsperado: 'Equipo queda seco, limpio, sin ingreso de líquido y con accesorios listos para almacenamiento', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'cinmes_pf1', prueba: 'Prueba de encendido y pantalla', valorEsperado: 'Encendido estable durante mínimo 60 segundos, pantalla legible y sin reinicios', resultado: ['Pasa', 'Falla'] },
        { id: 'cinmes_pf2', prueba: 'Canal 1 — salida sobre carga simulada/resistencia de prueba', valorEsperado: 'Salida perceptible/medible y regulable desde mínimo hasta valor bajo de prueba, sin intermitencias', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_pf3', prueba: 'Canal 2 — salida sobre carga simulada/resistencia de prueba si aplica', valorEsperado: 'Salida perceptible/medible y regulable desde mínimo hasta valor bajo de prueba, sin intermitencias', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_pf4', prueba: 'Barrido de intensidad a cero', valorEsperado: 'Al regresar la intensidad a cero cesa la salida del canal y no queda estimulación residual', resultado: ['Pasa', 'Falla'] },
        { id: 'cinmes_pf5', prueba: 'Parámetros NMES básicos: frecuencia/ancho de pulso/rampa si disponibles', valorEsperado: 'Permite modificar parámetros dentro de rangos del equipo y conserva la configuración seleccionada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_pf6', prueba: 'Temporizador de tratamiento', valorEsperado: 'Inicia conteo, permite pausa/detención si aplica y finaliza con señal o salida desactivada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_pf7', prueba: 'Prueba de circuito abierto', valorEsperado: 'Al desconectar electrodos/carga, el equipo no entrega salida peligrosa y presenta indicación normal de desconexión si aplica', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_pf8', prueba: 'Cables conductores — flexión suave durante salida de prueba', valorEsperado: 'No hay cortes, falsos contactos ni variaciones bruscas en la salida de prueba', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_pf9', prueba: 'Electrodos reutilizables/autoadhesivos — contacto y adherencia', valorEsperado: 'Superficie limpia, gel/adherencia adecuada, sin grietas, contaminación o pérdida de conductividad evidente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cinmes_pf10', prueba: 'Consumo básico de batería bajo operación breve', valorEsperado: 'No se apaga, no reinicia ni muestra caída crítica de batería durante prueba funcional breve', resultado: ['Pasa', 'Falla'] },
        { id: 'cinmes_pf11', prueba: 'Seguridad externa posterior a prueba', valorEsperado: 'Sin calentamiento anormal, olor, ruido, deformación o residuos de gel/humedad', resultado: ['Pasa', 'Falla'] },
        { id: 'cinmes_pf12', prueba: 'Registro de accesorios', valorEsperado: 'Quedan documentados cables, electrodos, batería, estuche y elementos faltantes o reemplazados', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: [
        'Apto para uso',
        'Apto con observaciones',
        'No apto - requiere correctivo',
        'No apto - requiere cambio de batería',
        'No apto - requiere cambio de cables/electrodos',
        'No apto - requiere servicio técnico autorizado',
        'No apto - retirar de servicio'
      ],
      acciones: [
        'Limpieza y desinfección externa compatible',
        'Limpieza de compartimiento y contactos de batería',
        'Cambio de batería de 9 V',
        'Verificación de cables conductores de paciente',
        'Cambio o reposición de cables conductores',
        'Verificación de electrodos autoadhesivos/reutilizables',
        'Reposición de electrodos o accesorios faltantes',
        'Prueba funcional de canales con carga simulada',
        'Verificación de temporizador y controles de intensidad',
        'Rotulación, trazabilidad y actualización de fecha de mantenimiento',
        'Equipo enviado a correctivo o servicio técnico autorizado'
      ]
    },

    'chattanooga_theta_portatil': {
      nombre: 'Estimulador Eléctrico Portátil Chattanooga Theta',
      categoria: 'Biomédico / Electroterapia portátil',
      codigo: 'SLV-GAT-BIO-EEP-THETA',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el estimulador eléctrico portátil Chattanooga Theta del uso clínico antes de iniciar el mantenimiento preventivo y confirme que no esté conectado a paciente.',
        'Apague el equipo, desconecte cables/electrodos y, si aplica, retire o aísle la batería antes de limpieza, inspección o manipulación de conectores.',
        'Realice el procedimiento con base en las recomendaciones del fabricante, manual de usuario y manual de servicio disponible para la línea Rehab/Theta/Physio, sin abrir la carcasa durante mantenimiento preventivo rutinario.',
        'Identifique configuración instalada: unidad Theta, número de canales disponibles, batería/pack recargable, cargador, cables de paciente, electrodos, clip/estuche y accesorios Mi/trigger si aplican.',
        'No aplique estimulación sobre el técnico ni sobre pacientes durante la verificación. Use carga simulada/resistencia de prueba o analizador de electroterapia cuando esté disponible.',
        'No utilice el equipo si presenta humedad, golpes severos, carcasa abierta, batería hinchada, fuga, olor a quemado, conectores flojos, cables pelados o mensajes de error persistentes.',
        'Respete contraindicaciones de electroterapia: no colocar electrodos sobre tórax/corazón, cuello anterior, cabeza, piel lesionada, zonas con sensibilidad alterada o pacientes con dispositivos implantables sin evaluación clínica.',
        'Use electrodos y cables compatibles con Chattanooga/Compex. Los electrodos autoadhesivos deben estar íntegros, limpios, con gel/adherencia adecuada y destinados a un solo paciente cuando aplique.',
        'Limpie el equipo con paño suave ligeramente humedecido y desinfectante compatible. No sumerja la unidad, no rocíe líquido directamente y no permita ingreso de humedad por conectores, pantalla o puerto de carga.',
        'Verifique que el cargador/adaptador sea original o compatible, con tensión adecuada y sin daño físico. No cargue baterías con fuga, hinchamiento, calentamiento o corrosión.',
        'Si el equipo no cumple salida por canales, carga, visualización, controles, seguridad de cables/electrodos o condición mecánica, márquelo como no apto y genere correctivo.',
        'Las intervenciones internas, calibraciones, reparaciones, cambio de batería interna o ajustes de salida deben ser realizados por personal autorizado o servicio técnico calificado.'
      ],
      inspeccion: [
        { id: 'ctheta_i1', item: 'Unidad Chattanooga Theta íntegra, limpia, sin fisuras, golpes, deformaciones, humedad, corrosión, residuos de gel o partes sueltas' },
        { id: 'ctheta_i2', item: 'Pantalla retroiluminada/display legible, sin líneas, manchas, segmentos faltantes, rotura o parpadeo' },
        { id: 'ctheta_i3', item: 'Botones de navegación, encendido, validación, incremento/disminución de intensidad por canal y bloqueo funcionales, sin atascamiento' },
        { id: 'ctheta_i4', item: 'Conectores de canales 1 a 4 según configuración, limpios, firmes, sin pines flojos, deformados, hundidos o corroídos' },
        { id: 'ctheta_i5', item: 'Puerto de carga/alimentación, cargador y cable del cargador íntegros, sin cortes, pines flojos, sulfatación, calentamiento o falsos contactos' },
        { id: 'ctheta_i6', item: 'Batería o pack recargable en buen estado, sin hinchamiento, fuga, sulfatación, cierre flojo o pérdida evidente de autonomía' },
        { id: 'ctheta_i7', item: 'Cables de estimulación completos para los canales disponibles, flexibles, con conectores firmes, sin peladuras, cortes, aplastamiento o aislamiento expuesto' },
        { id: 'ctheta_i8', item: 'Electrodos compatibles disponibles, limpios, con gel/adherencia adecuada, sin contaminación, resequedad, grietas o pérdida de conductividad evidente' },
        { id: 'ctheta_i9', item: 'Accesorios de transporte, clip, correa, estuche, lápiz punto motor o sensores Mi/trigger si aplican, íntegros y limpios' },
        { id: 'ctheta_i10', item: 'Etiquetas de marca Chattanooga, modelo Theta, serial/activo fijo, advertencias, símbolos eléctricos y fecha de mantenimiento legibles' },
        { id: 'ctheta_i11', item: 'Manual rápido, guía de programas o indicaciones de uso disponibles para el servicio si aplica' },
        { id: 'ctheta_i12', item: 'No hay modificaciones no autorizadas, reparaciones improvisadas, cinta, pegantes, accesorios incompatibles o puertos bloqueados' },
        { id: 'ctheta_i13', item: 'Superficies externas desinfectadas, secas, sin residuos químicos, gel o material biológico visible' },
        { id: 'ctheta_i14', item: 'Condición de almacenamiento segura: equipo apagado, cables enrollados sin tensión, electrodos protegidos y cargador organizado' }
      ],
      verificacion: [
        { id: 'ctheta_v1', item: 'Encendido inicial del equipo', valorEsperado: 'Enciende correctamente, muestra pantalla de inicio/menú y no presenta códigos de error, reinicios o alarmas técnicas', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_v2', item: 'Carga y estado de batería', valorEsperado: 'Indicador de batería/carga visible; el cargador responde sin calentamiento, olor o falso contacto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_v3', item: 'Selección de idioma/menú/programas', valorEsperado: 'Permite navegar por menús de tratamiento, categorías y programas sin bloqueo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_v4', item: 'Selección de programa TENS/NMES', valorEsperado: 'Permite seleccionar programa de electroterapia y visualizar parámetros de tratamiento', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_v5', item: 'Incremento/disminución de intensidad por canal', valorEsperado: 'Cada canal disponible permite subir y bajar intensidad de forma progresiva y segura hasta cero', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_v6', item: 'Conexión de cables/electrodos o carga simulada', valorEsperado: 'Los canales reconocen carga adecuada y no presentan alarma de desconexión con accesorios funcionales', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_v7', item: 'Pausa, stop y finalización de sesión', valorEsperado: 'El equipo pausa/detiene el tratamiento y desactiva la salida al finalizar o al llevar intensidad a cero', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_v8', item: 'Bloqueo de teclado/programa si aplica', valorEsperado: 'La función de bloqueo/desbloqueo opera según configuración sin impedir apagado seguro', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_v9', item: 'Estabilidad de salida durante movimiento leve de cables', valorEsperado: 'No hay intermitencia, pérdida de canal, apagado o variación brusca al mover suavemente conectores/cables', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_v10', item: 'Condición final posterior a limpieza', valorEsperado: 'Equipo queda seco, limpio, apagado, con accesorios organizados y sin humedad en puertos', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'ctheta_pf1', prueba: 'Encendido, navegación y pantalla', valorEsperado: 'Equipo enciende, permite navegar menú y pantalla permanece legible durante mínimo 60 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'ctheta_pf2', prueba: 'Canal 1 — salida con carga simulada/resistencia de prueba', valorEsperado: 'Salida estable y regulable; intensidad aumenta/disminuye sin saltos y regresa a cero', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_pf3', prueba: 'Canal 2 — salida con carga simulada/resistencia de prueba', valorEsperado: 'Salida estable y regulable; intensidad aumenta/disminuye sin saltos y regresa a cero', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_pf4', prueba: 'Canal 3 — salida con carga simulada/resistencia de prueba si aplica', valorEsperado: 'Salida estable y regulable; intensidad aumenta/disminuye sin saltos y regresa a cero', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_pf5', prueba: 'Canal 4 — salida con carga simulada/resistencia de prueba si aplica', valorEsperado: 'Salida estable y regulable; intensidad aumenta/disminuye sin saltos y regresa a cero', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_pf6', prueba: 'Programa NMES estándar', valorEsperado: 'Permite iniciar sesión, visualizar fases/rampa/reposo y detener tratamiento sin bloqueo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_pf7', prueba: 'Programa TENS/dolor si aplica', valorEsperado: 'Permite iniciar sesión con parámetros visibles y salida estable en canales seleccionados', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_pf8', prueba: 'Temporizador y finalización de sesión', valorEsperado: 'El temporizador cuenta correctamente y la salida se desactiva al finalizar/detener', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_pf9', prueba: 'Detección de circuito abierto o desconexión', valorEsperado: 'Al retirar carga/electrodo, el equipo indica desconexión o impide salida insegura según diseño', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_pf10', prueba: 'Prueba de carga con adaptador', valorEsperado: 'Indicador de carga opera; no hay calentamiento, chispas, olor o interrupción por falso contacto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_pf11', prueba: 'Accesorios Mi/trigger/lápiz punto motor si aplican', valorEsperado: 'Accesorios son reconocidos o se encuentran íntegros y funcionales según configuración del servicio', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_pf12', prueba: 'Cables y conectores bajo flexión suave', valorEsperado: 'No se presentan cortes, falsos contactos, pérdida de canal ni variación brusca de salida', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_pf13', prueba: 'Electrodos — inspección de adherencia/conductividad', valorEsperado: 'Electrodos limpios, húmedos/gel adecuados, sin resequedad, fisuras, contaminación o pérdida de adhesión', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ctheta_pf14', prueba: 'Seguridad externa posterior a prueba', valorEsperado: 'Sin calentamiento anormal, olor, ruido, deformación, humedad o residuos en carcasa y conectores', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: [
        'Apto para uso',
        'Apto con observaciones',
        'No apto - requiere correctivo',
        'No apto - requiere carga/cambio de batería',
        'No apto - requiere cambio de cables/electrodos',
        'No apto - requiere cargador o accesorio compatible',
        'No apto - requiere servicio técnico autorizado',
        'No apto - retirar de servicio'
      ],
      acciones: [
        'Limpieza y desinfección externa compatible',
        'Limpieza de conectores y puerto de carga sin ingreso de líquido',
        'Carga o verificación de batería',
        'Cambio/reposición de batería si aplica',
        'Verificación de cargador/adaptador',
        'Verificación de cables por canal',
        'Cambio o reposición de cables conductores',
        'Verificación de electrodos compatibles',
        'Reposición de electrodos o accesorios faltantes',
        'Prueba funcional de canales con carga simulada',
        'Verificación de programas TENS/NMES, temporizador y controles',
        'Rotulación, trazabilidad y actualización de fecha de mantenimiento',
        'Equipo enviado a correctivo o servicio técnico autorizado'
      ]
    },


    'riester_ri_former': {
      nombre: 'Equipo de Órganos de Pared Riester ri-former',
      categoria: 'Biomédico / Diagnóstico clínico de pared',
      codigo: 'SLV-GAT-BIO-EOP-RIFORMER',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el equipo de órganos de pared Riester ri-former del uso clínico y confirme que no esté siendo utilizado con paciente antes de iniciar el mantenimiento preventivo.',
        'Desconecte el enchufe de red o apague el interruptor principal antes de limpieza, inspección de contactos, revisión de montaje o manipulación de módulos.',
        'Identifique la configuración instalada: módulo ri-former, número de mangos, cabezales ri-scope, otoscopio, oftalmoscopio, especuloscopio, dispensador de espéculos, módulo de tensiómetro, termómetro u otros accesorios si aplican.',
        'Use únicamente cabezales, mangos, lámparas/LED, espéculos, cables espiralados y accesorios Riester compatibles con el sistema ri-former.',
        'Realice limpieza externa con paño suave ligeramente humedecido y desinfectante compatible. No sumerja la estación, mangos, cabezales ni módulos; no permita ingreso de líquido a conectores, interruptores, lentes o contactos.',
        'No use solventes agresivos, abrasivos, aerosoles directos, autoclave, inmersión ni esterilización por calor para la estación de pared o los instrumentos ópticos.',
        'Verifique que el montaje mural/riel esté firme antes de retirar o colocar mangos. No utilice el equipo si la placa de montaje, módulos o soportes están flojos.',
        'Evite mirar directamente la fuente luminosa de los cabezales; use la intensidad mínima necesaria para la prueba funcional.',
        'No utilice el equipo si presenta cable de alimentación deteriorado, olor a quemado, calentamiento anormal, luz intermitente, módulo suelto, mango sin retención, conectores dañados o partes faltantes.',
        'No abra la fuente de alimentación ni módulos internos durante mantenimiento preventivo rutinario. Las reparaciones internas deben ser realizadas por servicio técnico autorizado Riester o proveedor calificado.',
        'Verifique que los cabezales de diagnóstico estén limpios y libres de contaminación visible antes de la prueba. Retire espéculos usados o elementos desechables.',
        'Si el equipo no cumple seguridad eléctrica, iluminación, retención de mangos, regulación de intensidad, estabilidad mecánica o limpieza óptica, márquelo como no apto y genere correctivo.'
      ],
      inspeccion: [
        { id: 'rif_i1', item: 'Estación ri-former íntegra, limpia, sin fisuras, deformaciones, golpes, humedad, corrosión, piezas sueltas o modificaciones no autorizadas' },
        { id: 'rif_i2', item: 'Montaje de pared/riel firme, nivelado, sin tornillos flojos, vibración, desplazamiento o riesgo de caída' },
        { id: 'rif_i3', item: 'Cable de alimentación, enchufe y prensa-cable íntegros, sin cortes, aplastamiento, conductores expuestos, calentamiento, cinta o empalmes improvisados' },
        { id: 'rif_i4', item: 'Interruptor ON/OFF con lámpara piloto verde funcional, legible, sin atascamiento, falso contacto o daño mecánico' },
        { id: 'rif_i5', item: 'Mangos de diagnóstico presentes, limpios, con superficie antideslizante íntegra, sin fisuras, holguras, calentamiento o daño por caída' },
        { id: 'rif_i6', item: 'Sistema automático de encendido/apagado al retirar y colocar mangos sin atascamiento, retención deficiente o activación espontánea' },
        { id: 'rif_i7', item: 'Cables espiralados de los mangos íntegros, con retorno elástico adecuado, sin cortes, deformación, peladuras, zonas rígidas o falsos contactos' },
        { id: 'rif_i8', item: 'Rheotronic/control de intensidad en cada mango funcional, legible, sin juego excesivo, puntos muertos o bloqueo' },
        { id: 'rif_i9', item: 'Acople de cabezales al mango firme, alineado, con contactos limpios y sin desgaste visible' },
        { id: 'rif_i10', item: 'Cabezal de otoscopio limpio, lente/ventana clara, puerto de espéculo firme, sin residuos, grietas, rayones críticos o piezas faltantes' },
        { id: 'rif_i11', item: 'Cabezal de oftalmoscopio limpio, ventana óptica clara, selector de lentes/dioptrías funcional y sin resistencia anormal' },
        { id: 'rif_i12', item: 'Bombillo/lámpara xenón o LED compatible instalado, sin parpadeo, baja intensidad, sombra parcial, coloración anormal o daño visible' },
        { id: 'rif_i13', item: 'Dispensador de espéculos, si aplica, limpio, firme, abastecido y sin obstrucciones o espéculos contaminados' },
        { id: 'rif_i14', item: 'Módulos adicionales como tensiómetro, termómetro, reloj o extensión, si aplican, firmes, limpios y sin daño visible' },
        { id: 'rif_i15', item: 'Rotulación Riester ri-former, serial/activo fijo, advertencias, símbolos eléctricos y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'rif_i16', item: 'Superficies externas desinfectadas, secas y sin residuos químicos en zonas de contacto con usuario o paciente' }
      ],
      verificacion: [
        { id: 'rif_v1', item: 'Encendido general desde interruptor principal', valorEsperado: 'La lámpara piloto verde enciende y el sistema queda energizado sin ruido, olor o calentamiento anormal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_v2', item: 'Apagado general desde interruptor principal', valorEsperado: 'El sistema apaga completamente y no queda iluminación activa en mangos o cabezales', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_v3', item: 'Encendido automático al retirar cada mango', valorEsperado: 'La iluminación del cabezal enciende al retirar el mango y permanece estable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_v4', item: 'Apagado automático al colocar cada mango en su soporte', valorEsperado: 'La iluminación apaga al retornar el mango al soporte, sin activación espontánea', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_v5', item: 'Regulación de intensidad rheotronic en cada mango', valorEsperado: 'La intensidad aumenta y disminuye progresivamente sin cortes, saltos, parpadeo o puntos muertos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_v6', item: 'Retención mecánica de mangos', valorEsperado: 'Cada mango queda estable en su alojamiento y no se desprende accidentalmente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_v7', item: 'Tracción suave de cables espiralados', valorEsperado: 'Los cables se extienden y recuperan sin cortes eléctricos, tirones excesivos o daño mecánico', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_v8', item: 'Limpieza óptica externa de cabezales', valorEsperado: 'Imagen/luz clara, sin manchas, residuos o empañamiento que afecten la observación clínica', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_v9', item: 'Acople y retiro de espéculos en otoscopio', valorEsperado: 'El espéculo fija y retira correctamente, sin desprendimiento accidental ni bordes inseguros', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_v10', item: 'Módulos adicionales instalados', valorEsperado: 'Tensiómetro, termómetro, reloj, dispensador o extensión funcionan y se encuentran firmes si aplican', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'rif_pf1', prueba: 'Fuente de alimentación centralizada', valorEsperado: 'Al energizar el sistema, los mangos reciben alimentación estable sin fluctuación visible de luz', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf2', prueba: 'Mango 1 — iluminación y regulación', valorEsperado: 'Enciende, regula intensidad y mantiene luz estable durante 60 segundos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf3', prueba: 'Mango 2 — iluminación y regulación', valorEsperado: 'Enciende, regula intensidad y mantiene luz estable durante 60 segundos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf4', prueba: 'Mango 3 o módulo adicional si aplica', valorEsperado: 'Enciende y opera correctamente; marcar N/A si no existe tercer mango', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf5', prueba: 'Otoscopio — iluminación del canal', valorEsperado: 'Campo iluminado uniforme, sin sombras críticas, parpadeo, baja intensidad o calentamiento anormal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf6', prueba: 'Otoscopio — lente/ventana y fijación de espéculo', valorEsperado: 'La visualización es clara y el espéculo queda firme durante manipulación normal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf7', prueba: 'Oftalmoscopio — selector de lentes/dioptrías', valorEsperado: 'El selector cambia posiciones suavemente y permite observación clara sobre blanco/patrón de prueba', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf8', prueba: 'Oftalmoscopio — diafragmas/filtros si aplica', valorEsperado: 'Los diafragmas/filtros seleccionan correctamente sin bloqueo ni desalineación evidente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf9', prueba: 'Continuidad eléctrica bajo movimiento leve', valorEsperado: 'No hay apagado ni parpadeo al mover suavemente mango, cable y cabezal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf10', prueba: 'Calentamiento durante operación breve', valorEsperado: 'No hay temperatura superficial excesiva, olor, deformación o signos de falla térmica durante la prueba', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf11', prueba: 'Montaje mural/riel y resistencia mecánica', valorEsperado: 'El conjunto permanece firme durante retiro/colocación de mangos y uso normal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf12', prueba: 'Limpieza/desinfección compatible', valorEsperado: 'No quedan líquidos, empañamiento, residuos o daño posterior a limpieza externa', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf13', prueba: 'Seguridad eléctrica visual/instrumental básica', valorEsperado: 'Cable, enchufe, carcasa y conexión a red se encuentran seguros; prueba instrumental conforme al programa biomédico si aplica', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rif_pf14', prueba: 'Condición final y disponibilidad clínica', valorEsperado: 'Equipo completo, apagado/energizado según ubicación, limpio, identificado y listo para uso o marcado como no apto', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: [
        'Apto para uso',
        'Apto con observaciones',
        'No apto - requiere correctivo',
        'No apto - requiere cambio de lámpara/LED/accesorio',
        'No apto - requiere ajuste de montaje o instalación',
        'No apto - requiere servicio técnico autorizado',
        'No apto - requiere reposición'
      ],
      acciones: [
        'Limpieza y desinfección externa compatible',
        'Limpieza externa de lentes, ventanas y cabezales',
        'Verificación de montaje mural/riel',
        'Ajuste visual de fijaciones accesibles sin intervención interna',
        'Verificación de fuente de alimentación centralizada',
        'Verificación de interruptor principal y lámpara piloto',
        'Verificación funcional de mangos y rheotronic',
        'Verificación funcional de otoscopio',
        'Verificación funcional de oftalmoscopio',
        'Cambio de espéculos o accesorios desechables',
        'Cambio de lámpara/bombillo/LED compatible si está autorizado por el programa biomédico',
        'Retiro de servicio por falla eléctrica, óptica o mecánica',
        'Remisión a servicio técnico autorizado Riester o proveedor calificado'
      ]
    },


    'welch_allyn_ref_727': {
      nombre: 'Equipo de Órganos Portable Welch Allyn Ref. 727',
      categoria: 'Biomédico / Diagnóstico clínico portátil',
      codigo: 'SLV-GAT-BIO-EOP-WA727',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el equipo de órganos portable Welch Allyn Ref. 727 del uso clínico y confirme que no esté siendo utilizado con paciente antes de iniciar el mantenimiento preventivo.',
        'Identifique los componentes disponibles del set: mango portátil 2,5 V/3,5 V según configuración, otoscopio, oftalmoscopio, espéculos, estuche, baterías o batería recargable, cargador y accesorios compatibles.',
        'Use únicamente baterías, bombillos/lámparas, cabezales, espéculos y accesorios compatibles Welch Allyn. No mezcle baterías nuevas/usadas ni de diferente tipo.',
        'Verifique polaridad, estado de contactos y nivel de carga antes de instalar baterías o probar iluminación. Retire baterías sulfatadas o con fuga.',
        'Realice limpieza externa con paño suave y desinfectante compatible. No sumerja mangos ni cabezales, no esterilice por calor y no permita ingreso de líquido a lentes, conectores, interruptor o compartimiento de baterías.',
        'No aplique alcohol, químicos agresivos, abrasivos ni agua directamente sobre espejos, ventanas ópticas, lentes, lámparas o superficies internas del oftalmoscopio/otoscopio.',
        'Evite mirar directamente la fuente luminosa y no mantenga el equipo encendido más tiempo del necesario, especialmente en versiones halógenas, para prevenir calentamiento excesivo.',
        'No utilice el equipo si presenta lentes fracturados, iluminación intermitente, bajo brillo, corrosión, contactos flojos, cabezal suelto, sobrecalentamiento, daño por caída o piezas faltantes.',
        'No abra ni repare internamente los cabezales ópticos durante mantenimiento preventivo rutinario; las reparaciones internas deben ser realizadas por servicio técnico autorizado Welch Allyn/Hillrom o proveedor calificado.',
        'Antes de pruebas funcionales, retire espéculos usados, residuos biológicos y accesorios contaminados. Use elementos de protección personal y realice desinfección posterior al procedimiento.',
        'Verifique que el equipo se encuentre completo, identificado con activo fijo y almacenado en estuche protector para evitar daño de lentes, lámparas, interruptor y conexiones.',
        'Si el equipo no cumple iluminación, enfoque, estabilidad mecánica, limpieza óptica, integridad de accesorios o seguridad básica, marque como no apto y genere correctivo o reposición.'
      ],
      inspeccion: [
        { id: 'wa727_i1', item: 'Mango portable íntegro, limpio, sin fisuras, golpes, deformación, corrosión, humedad interna, daño por caída o partes sueltas' },
        { id: 'wa727_i2', item: 'Compartimiento de baterías limpio, seco, con tapa funcional, rosca/cierre firme, contactos sin sulfatación, corrosión, deformación o falsos contactos' },
        { id: 'wa727_i3', item: 'Baterías o batería recargable instaladas con polaridad correcta, sin fuga, vencimiento, hinchamiento, sulfatación o bajo voltaje evidente durante la prueba' },
        { id: 'wa727_i4', item: 'Cargador/base de carga o adaptador, si aplica, íntegro, sin fisuras, clavijas dañadas, cable expuesto, falsos contactos o calentamiento anormal' },
        { id: 'wa727_i5', item: 'Interruptor o reóstato/control de intensidad funcional, legible, sin atascamiento, holgura, activación intermitente o calentamiento anormal' },
        { id: 'wa727_i6', item: 'Acople entre mango y cabezal firme, alineado y sin juego excesivo; contactos limpios y sin desgaste visible' },
        { id: 'wa727_i7', item: 'Cabezal de otoscopio sin fisuras, lente/ventana limpia, puerto de espéculo firme, sin residuos, opacidad, rayones críticos o piezas faltantes' },
        { id: 'wa727_i8', item: 'Sistema de espéculos compatible disponible, limpio, íntegro, sin bordes cortantes, deformaciones ni accesorios incompatibles' },
        { id: 'wa727_i9', item: 'Cabezal de oftalmoscopio sin golpes, ventana óptica limpia, selector de lentes/dioptrías funcional y sin resistencia anormal' },
        { id: 'wa727_i10', item: 'Lentes, ventanas, espejos y superficies ópticas visibles sin empañamiento, manchas, rayones severos, desprendimiento o contaminación' },
        { id: 'wa727_i11', item: 'Bombillo/lámpara o LED compatible instalado, sin filamento roto, parpadeo, baja intensidad, coloración anormal, sombra parcial o fallo de encendido' },
        { id: 'wa727_i12', item: 'Estuche o sistema de transporte limpio, íntegro, con compartimientos funcionales y capacidad de proteger el equipo durante almacenamiento' },
        { id: 'wa727_i13', item: 'Rotulación Welch Allyn, Ref. 727, serial/activo fijo, advertencias y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'wa727_i14', item: 'Accesorios complementarios completos y funcionales: espéculos, batería de respaldo, cargador, bombillo de repuesto, bolsa/estuche y adaptadores compatibles si aplican' },
        { id: 'wa727_i15', item: 'Superficies externas desinfectadas, secas y sin residuos químicos en zonas de contacto con paciente o usuario' },
        { id: 'wa727_i16', item: 'No se evidencian modificaciones no autorizadas, reparaciones improvisadas, cintas, adhesivos que obstruyan óptica/ventilación o piezas no originales' }
      ],
      verificacion: [
        { id: 'wa727_v1', item: 'Encendido general del mango con cada cabezal instalado', valorEsperado: 'La fuente luminosa enciende de forma inmediata, estable y sin parpadeo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_v2', item: 'Apagado del equipo desde interruptor/reóstato', valorEsperado: 'El equipo apaga completamente, sin activación espontánea ni drenaje visible de batería', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_v3', item: 'Regulación de intensidad si el mango cuenta con reóstato', valorEsperado: 'La intensidad aumenta/disminuye progresivamente sin cortes, ruido, salto o parpadeo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_v4', item: 'Verificación de contacto mango-cabezal', valorEsperado: 'No hay falsos contactos al mover suavemente el conjunto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_v5', item: 'Verificación de estado de baterías bajo carga', valorEsperado: 'Iluminación estable durante la prueba, sin caída brusca de intensidad', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_v6', item: 'Prueba de carga o conexión a cargador/base si aplica', valorEsperado: 'Indicador o respuesta de carga normal, sin calentamiento, falsos contactos ni daño en clavijas', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_v7', item: 'Limpieza óptica externa de ventanas y lentes', valorEsperado: 'Imagen clara, sin manchas que afecten la observación clínica', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_v8', item: 'Acople y retiro de espéculo en otoscopio', valorEsperado: 'El espéculo fija y retira correctamente, sin desprendimiento accidental', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_v9', item: 'Movimiento del selector de lentes/dioptrías del oftalmoscopio', valorEsperado: 'Selector gira/cambia suavemente y se identifican cambios ópticos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_v10', item: 'Revisión de estuche, accesorios e identificación institucional', valorEsperado: 'Equipo completo, identificado, seco, protegido y con condición final registrada', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebas: [
        { id: 'wa727_pf1', prueba: 'Otoscopio — iluminación sobre superficie blanca a 20–30 cm', valorEsperado: 'Haz luminoso uniforme, suficiente, sin parpadeo ni zonas oscuras relevantes', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf2', prueba: 'Otoscopio — observación a través de lente/ventana', valorEsperado: 'Visualización clara y sin distorsión crítica, manchas u opacidad que afecte el examen', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf3', prueba: 'Otoscopio — retención de espéculo', valorEsperado: 'El espéculo compatible permanece fijo durante manipulación normal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf4', prueba: 'Otoscopio — estabilidad mecánica del cabezal', valorEsperado: 'Cabezal permanece fijo al mango, sin juego excesivo o desconexión', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf5', prueba: 'Oftalmoscopio — iluminación y apertura de observación', valorEsperado: 'Luz estable, centrada y visible por la apertura, sin sombra ni intermitencia', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf6', prueba: 'Oftalmoscopio — selector de lentes/dioptrías', valorEsperado: 'Cambio progresivo de lentes/dioptrías con lectura o clics definidos, sin bloqueo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf7', prueba: 'Oftalmoscopio — calidad óptica básica', valorEsperado: 'Imagen nítida al observar blanco/patrón, sin empañamiento, grietas ni reflejos anormales críticos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf8', prueba: 'Mango — continuidad eléctrica bajo movimiento leve', valorEsperado: 'La luz no se apaga ni parpadea al mover suavemente mango y cabezal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf9', prueba: 'Reóstato/intensidad — barrido mínimo a máximo si aplica', valorEsperado: 'Regulación continua sin cortes; intensidad suficiente para examen clínico básico', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf10', prueba: 'Baterías/contactos — inspección y prueba de carga', valorEsperado: 'Contactos firmes, sin sulfato; iluminación se mantiene estable al menos 60 segundos por cabezal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf11', prueba: 'Cargador/base de carga — funcionamiento si aplica', valorEsperado: 'Carga o indica carga correctamente, sin falsos contactos, olor, ruido o calentamiento anormal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf12', prueba: 'Temperatura superficial durante uso breve', valorEsperado: 'No presenta calentamiento excesivo, olor, deformación o molestia al tacto durante prueba funcional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf13', prueba: 'Limpieza/desinfección compatible', valorEsperado: 'No quedan líquidos, empañamiento, residuos o daño posterior a limpieza externa', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa727_pf14', prueba: 'Almacenamiento final en estuche', valorEsperado: 'Equipo completo, apagado, seco, protegido y listo para uso o marcado como no apto según hallazgos', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: [
        'Apto para uso',
        'Apto con observaciones',
        'No apto - requiere correctivo',
        'No apto - requiere cambio de baterías/accesorios',
        'No apto - requiere cambio de bombillo/lámpara',
        'No apto - requiere servicio técnico autorizado',
        'No apto - requiere reposición'
      ],
      acciones: [
        'Limpieza y desinfección externa compatible',
        'Limpieza externa de ventanas/lentes con método compatible',
        'Cambio de baterías',
        'Recarga o verificación de batería recargable',
        'Limpieza de contactos de batería',
        'Cambio de bombillo/lámpara compatible',
        'Ajuste/aseguramiento de cabezal al mango',
        'Reposición de espéculos o accesorios faltantes',
        'Verificación funcional de otoscopio',
        'Verificación funcional de oftalmoscopio',
        'Verificación de cargador/base de carga',
        'Verificación de estuche y almacenamiento',
        'Retiro de servicio por falla de iluminación',
        'Retiro de servicio por daño óptico/mecánico',
        'Remisión a servicio técnico autorizado Welch Allyn/Hillrom o proveedor calificado'
      ]
    },


    'welch_allyn_pocket_led': {
      nombre: 'Equipo de Órganos Portable Welch Allyn Pocket LED',
      categoria: 'Biomédico / Diagnóstico clínico portátil',
      codigo: 'SLV-GAT-BIO-EOP-WAPL',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el equipo de órganos portable Welch Allyn Pocket LED del uso clínico y confirme que no esté siendo utilizado con paciente antes de iniciar el mantenimiento preventivo.',
        'Identifique los componentes disponibles del set: mango/batería, otoscopio Pocket LED, oftalmoscopio Pocket LED, espéculos reutilizables o desechables, estuche, accesorios y fuente de luz LED.',
        'Use baterías alcalinas o recargables compatibles según configuración del fabricante. Verifique polaridad antes de instalar y no mezcle baterías nuevas/usadas ni de diferente tipo.',
        'Realice limpieza externa con paño suave y desinfectante compatible. No sumerja mangos ni cabezales, no esterilice por calor y no permita ingreso de líquido a lentes, conectores, interruptor o compartimiento de baterías.',
        'No aplique alcohol, químicos agresivos, abrasivos ni agua directamente sobre espejos, ventanas ópticas, lentes o superficies internas del oftalmoscopio/otoscopio, para evitar degradación óptica.',
        'No utilice el equipo si presenta lentes fracturados, luz intermitente, corrosión por baterías, contactos flojos, cabezal suelto, sobrecalentamiento, daño por caída o pérdida de aislamiento.',
        'No abra ni repare internamente los cabezales ópticos durante mantenimiento preventivo rutinario; las reparaciones internas deben ser realizadas por servicio técnico autorizado Welch Allyn/Hillrom o proveedor calificado.',
        'Antes de pruebas funcionales, retire espéculos usados, residuos biológicos y baterías sulfatadas. Use elementos de protección personal y realice desinfección posterior al procedimiento.',
        'Verifique que el equipo se encuentre completo, identificado con activo fijo y almacenado en estuche protector para evitar daño de lentes, LED, interruptor y conexiones.',
        'Si el equipo no cumple iluminación, enfoque, estabilidad mecánica, limpieza óptica, integridad de accesorios o seguridad básica, marque como no apto y genere correctivo o reposición.'
      ],
      inspeccion: [
        { id: 'wapled_i1', item: 'Mango portable íntegro, limpio, sin fisuras, golpes, partes sueltas, deformación, corrosión, humedad interna o daño por caída' },
        { id: 'wapled_i2', item: 'Compartimiento de baterías limpio, seco, con tapa funcional, rosca/cierre firme, contactos sin sulfatación, corrosión, deformación o falsos contactos' },
        { id: 'wapled_i3', item: 'Baterías instaladas con polaridad correcta, sin fuga, vencimiento, hinchamiento o bajo voltaje evidente durante la prueba' },
        { id: 'wapled_i4', item: 'Interruptor o control de encendido del mango funcional, sin atascamiento, holgura, activación intermitente o calentamiento anormal' },
        { id: 'wapled_i5', item: 'Acople entre mango y cabezal firme, alineado y sin juego excesivo, contactos limpios y sin desgaste visible' },
        { id: 'wapled_i6', item: 'Cabezal de otoscopio Pocket LED sin fisuras, lente/ventana limpia, puerto de espéculo firme, sin residuos, opacidad, rayones críticos o piezas faltantes' },
        { id: 'wapled_i7', item: 'Sistema de espéculos compatible disponible, limpio, íntegro, sin bordes cortantes, deformaciones ni uso de accesorios incompatibles' },
        { id: 'wapled_i8', item: 'Cabezal de oftalmoscopio Pocket LED sin golpes, ventana óptica limpia, selector de lentes/dioptrías funcional y sin resistencia anormal' },
        { id: 'wapled_i9', item: 'Lentes, ventanas, espejos y superficies ópticas visibles sin empañamiento, manchas, rayones severos, desprendimiento o contaminación' },
        { id: 'wapled_i10', item: 'Fuente de luz LED en otoscopio y oftalmoscopio sin parpadeo, baja intensidad, coloración anormal, sombra parcial o fallo de encendido' },
        { id: 'wapled_i11', item: 'Estuche o sistema de transporte limpio, íntegro, con compartimientos funcionales y capacidad de proteger el equipo durante almacenamiento' },
        { id: 'wapled_i12', item: 'Rotulación de marca Welch Allyn, referencia Pocket LED, serial/activo fijo, advertencias y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'wapled_i13', item: 'Accesorios complementarios, si aplican, completos y funcionales: puntas de otoscopio, bolsa/estuche, baterías de respaldo y adaptadores compatibles' },
        { id: 'wapled_i14', item: 'Superficies externas desinfectadas, secas y sin residuos químicos en zonas de contacto con paciente o usuario' },
        { id: 'wapled_i15', item: 'No se evidencian modificaciones no autorizadas, reparaciones improvisadas, cintas, adhesivos que obstruyan ventilación/óptica o piezas no originales' }
      ],
      verificacion: [
        { id: 'wapled_v1', item: 'Encendido general del mango con cada cabezal instalado', valorEsperado: 'El LED enciende de forma inmediata, estable y sin parpadeo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_v2', item: 'Apagado del equipo desde el interruptor/control', valorEsperado: 'El equipo apaga completamente, sin activación espontánea ni drenaje visible de batería', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_v3', item: 'Verificación de contacto mango-cabezal', valorEsperado: 'No hay falsos contactos al mover suavemente el conjunto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_v4', item: 'Verificación de estado de baterías bajo carga', valorEsperado: 'Iluminación estable durante la prueba, sin caída brusca de intensidad', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_v5', item: 'Limpieza óptica externa de ventanas y lentes', valorEsperado: 'Imagen clara, sin manchas que afecten la observación clínica', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_v6', item: 'Acople y retiro de espéculo en otoscopio', valorEsperado: 'El espéculo fija y retira correctamente, sin desprendimiento accidental', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_v7', item: 'Movimiento del selector de lentes/dioptrías del oftalmoscopio', valorEsperado: 'Selector gira/cambia suavemente y se identifican cambios ópticos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_v8', item: 'Revisión de estuche y almacenamiento', valorEsperado: 'Permite guardar y proteger el set completo sin presión excesiva sobre los cabezales', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_v9', item: 'Verificación de limpieza posterior al mantenimiento', valorEsperado: 'Equipo queda seco, desinfectado y libre de residuos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_v10', item: 'Identificación institucional y estado de disponibilidad', valorEsperado: 'Equipo identificado, completo y con condición final registrada', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebas: [
        { id: 'wapled_pf1', prueba: 'Otoscopio — iluminación LED sobre superficie blanca a 20–30 cm', valorEsperado: 'Haz luminoso uniforme, suficiente, sin parpadeo ni zonas oscuras relevantes', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_pf2', prueba: 'Otoscopio — observación a través de lente/ventana', valorEsperado: 'Visualización clara y sin distorsión crítica, manchas u opacidad que afecte el examen', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_pf3', prueba: 'Otoscopio — retención de espéculo', valorEsperado: 'El espéculo compatible permanece fijo durante manipulación normal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_pf4', prueba: 'Otoscopio — prueba de estabilidad mecánica del cabezal', valorEsperado: 'Cabezal permanece fijo al mango, sin juego excesivo o desconexión', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_pf5', prueba: 'Oftalmoscopio — iluminación LED y apertura de observación', valorEsperado: 'Luz estable, centrada y visible por la apertura, sin sombra ni intermitencia', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_pf6', prueba: 'Oftalmoscopio — selector de lentes/dioptrías', valorEsperado: 'Cambio progresivo de lentes/dioptrías con lectura o clics definidos, sin bloqueo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_pf7', prueba: 'Oftalmoscopio — calidad óptica básica', valorEsperado: 'Imagen nítida al observar blanco/patrón, sin empañamiento, grietas ni reflejos anormales críticos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_pf8', prueba: 'Mango — continuidad eléctrica bajo movimiento leve', valorEsperado: 'La luz no se apaga ni parpadea al mover suavemente mango y cabezal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_pf9', prueba: 'Baterías/contactos — inspección y prueba de carga', valorEsperado: 'Contactos firmes, sin sulfato; iluminación se mantiene estable al menos 60 segundos por cabezal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_pf10', prueba: 'Temperatura superficial durante uso breve', valorEsperado: 'No presenta calentamiento excesivo, olor, deformación o molestia al tacto durante prueba funcional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_pf11', prueba: 'Limpieza/desinfección compatible', valorEsperado: 'No quedan líquidos, empañamiento, residuos o daño posterior a limpieza externa', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wapled_pf12', prueba: 'Almacenamiento final en estuche', valorEsperado: 'Equipo completo, apagado, seco, protegido y listo para uso o marcado como no apto según hallazgos', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: [
        'Apto para uso',
        'Apto con observaciones',
        'No apto - requiere correctivo',
        'No apto - requiere cambio de baterías/accesorios',
        'No apto - requiere servicio técnico autorizado',
        'No apto - requiere reposición'
      ],
      acciones: [
        'Limpieza y desinfección externa compatible',
        'Limpieza externa de ventanas/lentes con método compatible',
        'Cambio de baterías',
        'Limpieza de contactos de batería',
        'Ajuste/aseguramiento de cabezal al mango',
        'Reposición de espéculos o accesorios faltantes',
        'Verificación funcional de otoscopio',
        'Verificación funcional de oftalmoscopio',
        'Verificación de estuche y almacenamiento',
        'Retiro de servicio por falla de iluminación',
        'Retiro de servicio por daño óptico/mecánico',
        'Remisión a servicio técnico autorizado Welch Allyn/Hillrom o proveedor calificado'
      ]
    },


    'bascula_health_o_meter_522kl': {
      nombre: 'Báscula Bebé Health o meter 522KL',
      categoria: 'Biomédico / Antropometría neonatal',
      codigo: 'SLV-GAT-BIO-BB-HOM522KL',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que la báscula bebé Health o meter 522KL se encuentre fuera de uso clínico, limpia, seca y ubicada sobre una superficie rígida, plana, estable y alejada del borde de la mesa antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de pesas patrón calibradas/trazables, paño suave, desinfectante compatible, seis baterías AA nuevas, adaptador de CA original/compatible si aplica y formato institucional de registro metrológico.',
        'Retire al paciente, cobijas, pañales, accesorios y objetos de la bandeja antes de encender, tarar, calibrar o verificar el equipo. Nunca deje al bebé sin supervisión durante el uso o prueba.',
        'No exceda la capacidad nominal indicada por el fabricante; para 522KL corresponde a 50 lb / 23 kg, con resolución 0,2 oz hasta 20 lb y 0,5 oz de 20 a 50 lb; en kg, 5 g hasta 9 kg y 10 g de 9 a 23 kg.',
        'Permita que el equipo se estabilice a temperatura ambiente y evite corrientes de aire, vibraciones, superficies blandas, luz solar directa, contacto con pared/cables o equipos que generen calor/frío durante las pruebas.',
        'Desconecte el adaptador de CA antes de limpieza o inspección externa. No rocíe líquidos directamente sobre display, teclado, bandeja, conectores, compartimiento de baterías ni unión de la plataforma.',
        'Use limpieza compatible con las recomendaciones del fabricante: paño suave con solución jabonosa suave, alcohol isopropílico al 70% o peróxido de hidrógeno 1–5%, retirando residuos con paño humedecido en agua y secando completamente.',
        'No sumerja la báscula en agua u otro líquido, no use abrasivos y no permita ingreso de humedad al display, conectores, celdas de carga o compartimiento de baterías.',
        'Revise que la unidad esté configurada en kg conforme al uso institucional o que la función UNIT/Everlock no permita cambios accidentales de unidad de medida.',
        'No abra carcasa, no manipule celdas de carga, sellos metrológicos, tarjeta electrónica ni parámetros internos durante mantenimiento preventivo rutinario.',
        'Si se observan mensajes de error, lectura inestable, falla de cero/tara/HOLD, daño físico, humedad interna, cable/adaptador dañado, batería sulfatada, desviación fuera de tolerancia o pérdida de calibración, retire de servicio y genere correctivo/calibración.',
        'Las operaciones de mantenimiento diferentes a limpieza, revisión externa, batería, verificación funcional y comparación metrológica deben ser realizadas por personal de servicio calificado.'
      ],
      inspeccion: [
        { id: 'hom522i1', item: 'Bandeja pediátrica/asiento de pesaje íntegro, limpio, correctamente instalado, sin fisuras, deformaciones, bordes cortantes, manchas permanentes, piezas sueltas o daño visible' },
        { id: 'hom522i2', item: 'Base/plataforma y estructura inferior sin golpes, grietas, torsión, humedad interna, corrosión, evidencia de caída, tornillos faltantes o apoyos deteriorados' },
        { id: 'hom522i3', item: 'Soportes/perillas de fijación de bandeja firmes y completos, sin roscas dañadas, holguras, desgaste excesivo o riesgo de desprendimiento durante el uso' },
        { id: 'hom522i4', item: 'Pantalla/display legible, sin segmentos faltantes, manchas, parpadeos, condensación, lectura intermitente o códigos de error permanentes' },
        { id: 'hom522i5', item: 'Teclas ON/OFF, ZERO/TARE, UNIT, HOLD/RELEASE o equivalentes íntegras, legibles, sin atascamiento, membrana rota ni respuesta intermitente' },
        { id: 'hom522i6', item: 'Compartimiento de baterías limpio, seco, con tapa y tornillo funcionales, sin sulfatación, corrosión, contactos flojos, baterías vencidas o evidencia de fuga' },
        { id: 'hom522i7', item: 'Seis baterías AA instaladas con polaridad correcta, sin deformación, fuga o mensaje Lo/LoBat durante la prueba' },
        { id: 'hom522i8', item: 'Adaptador de CA y conector de alimentación, si aplica, sin cortes, fisuras, falsos contactos, calentamiento, empalmes, clavijas rotas/dobladas o partes expuestas' },
        { id: 'hom522i9', item: 'Cableado visible y unión interna durante armado sin pellizcos, aplastamientos, tensión excesiva o daño por manipulación' },
        { id: 'hom522i10', item: 'Cinta de medición o accesorio de longitud suministrado, si aplica, legible, limpio, sin ruptura, borrado, deformación o pérdida de fijación' },
        { id: 'hom522i11', item: 'Rotulación de marca, modelo 522KL, número de serie, activo fijo, capacidad, unidades, advertencias y datos eléctricos legibles y coherentes con inventario' },
        { id: 'hom522i12', item: 'Sello, etiqueta de verificación o calibración metrológica vigente y sin evidencia de manipulación, cuando aplique según programa institucional' },
        { id: 'hom522i13', item: 'Superficie y uniones desinfectadas con producto compatible; sin residuos químicos, humedad en display, botones, conectores, bandeja o compartimiento de baterías' },
        { id: 'hom522i14', item: 'La bandeja/plataforma queda libre, sin interferencia mecánica con carcasa, mesa, pared, accesorios o cables durante la medición' },
        { id: 'hom522i15', item: 'Patas o puntos de apoyo completos y firmes; el equipo no presenta balanceo, deslizamiento ni inestabilidad sobre la superficie de prueba' }
      ],
      verificacionBasica: [
        { id: 'hom522vb1', item: 'La báscula enciende correctamente con baterías y/o adaptador, realiza secuencia de inicio y muestra cero sin códigos de error persistentes' },
        { id: 'hom522vb2', item: 'Con la bandeja libre de carga, la lectura retorna a cero y permanece estable después del encendido' },
        { id: 'hom522vb3', item: 'La tecla ZERO/TARE pone a cero la lectura y descuenta correctamente un paño o accesorio liviano, permitiendo medición neta del paciente' },
        { id: 'hom522vb4', item: 'La función HOLD/RELEASE conserva o libera una lectura estable según el modo del equipo y responde sin bloqueo' },
        { id: 'hom522vb5', item: 'La unidad de medida configurada corresponde al uso institucional, preferiblemente kg, y la función UNIT/Everlock evita cambios accidentales si aplica' },
        { id: 'hom522vb6', item: 'El indicador de batería no muestra Lo/LoBat; si aparece, se reemplazan las baterías y se repite la verificación' },
        { id: 'hom522vb7', item: 'El equipo apaga correctamente por tecla y la función de autoapagado opera o queda documentada según configuración institucional' },
        { id: 'hom522vb8', item: 'El sonido/beep, si está habilitado, responde al presionar teclas; si está configurado en modo silencioso se registra como N/A o conforme a configuración' },
        { id: 'hom522vb9', item: 'No aparecen mensajes Err, Lo, Out of Range o fallas de inicialización durante encendido, carga, tara, descarga o apagado' }
      ],
      pruebasFuncionales: [
        { id: 'hom522pf1', prueba: 'Encendido/autotest — Encender sin carga sobre superficie firme, rígida y nivelada', valorEsperado: 'Secuencia de inicio completa, display legible y lectura cero sin mensajes de error', resultado: ['Pasa', 'Falla'] },
        { id: 'hom522pf2', prueba: 'Cero inicial — Mantener la bandeja libre de carga durante 30 segundos', valorEsperado: 'Lectura permanece en cero, sin deriva ni oscilación significativa', resultado: ['Pasa', 'Falla'] },
        { id: 'hom522pf3', prueba: 'Tara — Colocar paño/accesorio liviano, activar ZERO/TARE y retirar', valorEsperado: 'Compensa el peso del accesorio y retorna de forma coherente al retirar la carga', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hom522pf4', prueba: 'Exactitud punto bajo — Aplicar masa patrón aproximada de 2 kg centrada en la bandeja', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida para el equipo', resultado: ['Pasa', 'Falla'] },
        { id: 'hom522pf5', prueba: 'Exactitud punto de calibración — Aplicar masa patrón certificada de 5 kg centrada en la bandeja', valorEsperado: 'Lectura dentro de tolerancia; este punto coincide con el valor de calibración indicado por el fabricante para versiones recientes', resultado: ['Pasa', 'Falla'] },
        { id: 'hom522pf6', prueba: 'Exactitud punto medio — Aplicar masa patrón aproximada de 10 kg centrada en la bandeja', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida, sin mensaje de sobrecarga', resultado: ['Pasa', 'Falla'] },
        { id: 'hom522pf7', prueba: 'Exactitud punto alto — Aplicar masa patrón aproximada de 15 kg o carga segura cercana al uso clínico habitual', valorEsperado: 'Lectura dentro de tolerancia institucional y estable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hom522pf8', prueba: 'Verificación cerca de capacidad máxima — Aplicar carga segura sin exceder 23 kg / 50 lb', valorEsperado: 'Equipo responde sin error, deformación, inestabilidad ni mensaje Err por sobrecarga', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hom522pf9', prueba: 'Repetibilidad — Aplicar y retirar el mismo peso patrón al menos 3 veces en el centro', valorEsperado: 'Lecturas repetibles, con variación dentro de la tolerancia definida por metrología', resultado: ['Pasa', 'Falla'] },
        { id: 'hom522pf10', prueba: 'Excentricidad — Aplicar peso patrón en centro, extremos derecho/izquierdo y zona superior/inferior de la bandeja', valorEsperado: 'Lecturas consistentes entre posiciones y dentro de tolerancia institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'hom522pf11', prueba: 'Retorno a cero — Retirar toda carga después de cada medición', valorEsperado: 'La lectura retorna a cero estable sin quedar con valor residual', resultado: ['Pasa', 'Falla'] },
        { id: 'hom522pf12', prueba: 'Función HOLD/RELEASE — Aplicar peso estable y activar/confirmar retención', valorEsperado: 'El valor queda retenido de forma estable y se libera correctamente para nueva medición', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hom522pf13', prueba: 'Cambio/bloqueo de unidad UNIT/Everlock — Verificar kg/lb y retornar a configuración institucional', valorEsperado: 'Permite confirmar o mantener la unidad requerida sin alterar la medición; si está bloqueada, no permite cambio accidental', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hom522pf14', prueba: 'Autoapagado — Dejar sin carga y sin operación por el tiempo configurado', valorEsperado: 'El equipo se apaga por ahorro de energía o conserva encendido si opera con adaptador/autoapagado deshabilitado, según configuración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hom522pf15', prueba: 'Alimentación con baterías — Operar durante la prueba completa', valorEsperado: 'Funcionamiento estable, sin reinicios, apagados inesperados ni indicador Lo/LoBat', resultado: ['Pasa', 'Falla'] },
        { id: 'hom522pf16', prueba: 'Alimentación con adaptador — Si aplica, operar con fuente y mover suavemente el conector', valorEsperado: 'Sin falsos contactos, reinicios, calentamiento ni interrupciones de energía', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hom522pf17', prueba: 'Cinta de medición/accesorio de longitud, si aplica — Revisar extensión, lectura y fijación', valorEsperado: 'Escala legible, movimiento/fijación adecuados y sin interferencia con la bandeja', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hom522pf18', prueba: 'Limpieza/desinfección posterior', valorEsperado: 'Equipo seco, sin residuos químicos, sin humedad en display, botones, conectores o compartimiento de baterías', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de bandeja/asiento, display, base y superficie de apoyo',
        'Revisión de carcasa, bandeja, soportes, perillas, patas, display, teclado, etiquetas y sellos',
        'Cambio o verificación de seis baterías AA',
        'Verificación de adaptador de CA y conector de alimentación, si aplica',
        'Verificación de cero, ZERO/TARE, HOLD/RELEASE, UNIT/Everlock, sonido y autoapagado',
        'Verificación comparativa con pesas patrón calibradas en puntos bajo, 5 kg, medio y alto',
        'Prueba de repetibilidad, excentricidad, retorno a cero y estabilidad',
        'Verificación de cinta de medición o accesorio de longitud, si aplica',
        'Registro de desviaciones metrológicas y recomendación de calibración externa si aplica',
        'Retiro de servicio por error, lectura inestable, daño físico, humedad interna, adaptador/cable dañado o desviación fuera de tolerancia',
        'Remisión a servicio técnico calificado Health o meter/Pelstar o proveedor metrológico especializado'
      ]
    },


    'bascula_health_o_meter_160kg': {
      nombre: 'Báscula de Piso Mecánica Health o meter 160KG',
      categoria: 'Biomédico / Antropometría',
      codigo: 'SLV-GAT-BIO-BAS-HOM160KG',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que la báscula de piso mecánica Health o meter 160KG/160KL se encuentre fuera de uso clínico, limpia, seca y ubicada sobre una superficie rígida, plana, dura y nivelada antes de iniciar el mantenimiento preventivo.',
        'Esta báscula es mecánica de dial elevado y NO posee componentes eléctricos, electrónicos ni baterías; no realice pruebas de seguridad eléctrica ni búsqueda de fallas eléctricas sobre este equipo.',
        'La báscula viene calibrada de fábrica y NO puede ser calibrada por el usuario; el ajuste interno, la reparación del mecanismo de resortes/palancas o el reemplazo de partes deben ser realizados por servicio técnico autorizado Health o meter/Pelstar.',
        'Confirme disponibilidad de pesas patrón calibradas/trazables que cubran el rango de uso (puntos bajo, medio y alto hasta la capacidad nominal), paño suave, desinfectante compatible, nivel de burbuja si está disponible y formato institucional de registro metrológico.',
        'Retire al paciente y todos los objetos de la plataforma antes de ajustar el cero, cargar o verificar. No exceda la capacidad nominal indicada en la placa del equipo; para el modelo 160KG/160KL corresponde a 180 kg / 400 lb con graduación de 1 kg. Nota: el número "160" es el modelo, no la capacidad; confirme siempre la capacidad rotulada en el equipo.',
        'Coloque la báscula sobre piso duro y plano para mejor exactitud; la precisión se ve afectada por alfombras, tapetes de pelo profundo, superficies blandas, desniveles, vibraciones, corrientes de aire o contacto con pared, mueble o cables.',
        'Antes de verificar, suba y baje de la plataforma unas pocas veces para alinear el mecanismo interno, conforme lo indica el manual del fabricante.',
        'Con la plataforma libre de carga, ajuste la aguja/indicador exactamente a cero utilizando la perilla de ajuste de cero ubicada en la parte inferior de la báscula.',
        'Realice limpieza externa con paño suave ligeramente humedecido en solución jabonosa suave o desinfectante compatible; seque por completo y no permita ingreso de líquido al lente del dial, a la aguja ni al mecanismo interno. No sumerja la báscula ni use abrasivos.',
        'No utilice cuchillas, bisturíes ni objetos cortopunzantes cerca del equipo y evite rayar el lente del dial durante limpieza o manipulación.',
        'No abra la carcasa del dial ni manipule resortes, palancas, varillaje o tope de carga durante el mantenimiento preventivo rutinario.',
        'Si observa lectura inestable, aguja trabada, doblada o que no retorna a cero, lente del dial roto, plataforma fisurada, superficie antideslizante deteriorada, imposibilidad de poner en cero o desviación fuera de tolerancia, retire de servicio y genere correctivo o remita a servicio técnico autorizado.'
      ],
      inspeccion: [
        { id: 'hom160i1', item: 'Plataforma de pesaje íntegra, limpia, sin fisuras, deformaciones, abolladuras, bordes cortantes, humedad, corrosión, evidencia de caída ni piezas sueltas' },
        { id: 'hom160i2', item: 'Superficie antideslizante completa y en buen estado, sin desprendimientos, desgaste crítico, levantamiento o pérdida de adherencia que afecte la seguridad del paciente' },
        { id: 'hom160i3', item: 'Base/estructura inferior y soportes sin golpes, torsión, grietas, corrosión, tornillos faltantes ni apoyos deteriorados' },
        { id: 'hom160i4', item: 'Columna/soporte del dial elevado firme, alineado y sin holgura, fisuras, inclinación o riesgo de desprendimiento' },
        { id: 'hom160i5', item: 'Lente o cubierta del dial transparente y limpia, sin ruptura, rayones críticos, empañamiento o condensación que impidan la lectura' },
        { id: 'hom160i6', item: 'Aguja/indicador recto, íntegro, con movimiento libre y retorno adecuado, sin doblez, roce, atascamiento o desprendimiento' },
        { id: 'hom160i7', item: 'Escala impresa del dial (graduaciones y números en kg) legible, sin borrado, decoloración, desplazamiento o daño' },
        { id: 'hom160i8', item: 'Perilla de ajuste de cero presente, firme y funcional, sin rosca dañada, holgura excesiva o pérdida de retención' },
        { id: 'hom160i9', item: 'Patas o puntos de apoyo completos y firmes; la báscula no presenta balanceo, deslizamiento ni inestabilidad sobre la superficie de prueba' },
        { id: 'hom160i10', item: 'Rotulación de marca, modelo 160KG/160KL, número de serie, activo fijo, capacidad y graduación legibles y coherentes con el inventario' },
        { id: 'hom160i11', item: 'Sello o etiqueta de verificación/calibración metrológica vigente y sin evidencia de manipulación, cuando aplique según programa institucional' },
        { id: 'hom160i12', item: 'Superficies externas, plataforma y lente del dial desinfectados, secos y sin residuos químicos' },
        { id: 'hom160i13', item: 'La plataforma queda libre, sin interferencia mecánica con carcasa, pared, mueble, cables u objetos durante la medición' },
        { id: 'hom160i14', item: 'No se evidencian ruidos anormales, roce, fricción o atascamiento de la aguja al aplicar y retirar carga' }
      ],
      verificacionBasica: [
        { id: 'hom160vb1', item: 'Con la plataforma libre de carga, la aguja retorna a cero y permanece estable' },
        { id: 'hom160vb2', item: 'La perilla de ajuste de cero permite llevar la aguja exactamente a la marca de cero, sin juego excesivo ni saltos' },
        { id: 'hom160vb3', item: 'Tras subir y bajar varias veces para alinear el mecanismo, el cero se mantiene estable y repetible' },
        { id: 'hom160vb4', item: 'Al aplicar y retirar una carga, la aguja se desplaza de forma suave y retorna a cero sin valor residual' },
        { id: 'hom160vb5', item: 'La lectura es estable, sin oscilación, deriva ni atascamiento a lo largo del recorrido del dial' },
        { id: 'hom160vb6', item: 'El dial es claramente legible desde la posición de pie del paciente, sin paralaje significativo' },
        { id: 'hom160vb7', item: 'La unidad de medida (kg) corresponde al uso institucional según el modelo del equipo' },
        { id: 'hom160vb8', item: 'La plataforma permanece firme y la superficie antideslizante segura durante la prueba, sin balanceo ni deslizamiento' }
      ],
      pruebasFuncionales: [
        { id: 'hom160pf1', prueba: 'Alineación mecánica — Subir y bajar de la plataforma varias veces y luego ajustar el cero con la perilla inferior', valorEsperado: 'El mecanismo se alinea y la aguja queda estable en cero sin carga', resultado: ['Pasa', 'Falla'] },
        { id: 'hom160pf2', prueba: 'Cero inicial — Mantener la plataforma libre de carga durante 30 segundos', valorEsperado: 'La aguja permanece en cero, sin deriva ni oscilación significativa', resultado: ['Pasa', 'Falla'] },
        { id: 'hom160pf3', prueba: 'Exactitud punto bajo — Aplicar masa patrón aproximada de 20 kg centrada en la plataforma', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida para el equipo', resultado: ['Pasa', 'Falla'] },
        { id: 'hom160pf4', prueba: 'Exactitud punto medio — Aplicar masa patrón aproximada de 50 kg centrada en la plataforma', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida', resultado: ['Pasa', 'Falla'] },
        { id: 'hom160pf5', prueba: 'Exactitud punto medio-alto — Aplicar masa patrón aproximada de 100 kg centrada en la plataforma', valorEsperado: 'Lectura dentro de tolerancia y estable, sin atascamiento de la aguja', resultado: ['Pasa', 'Falla'] },
        { id: 'hom160pf6', prueba: 'Exactitud punto alto — Aplicar masa patrón aproximada de 150 kg o carga segura cercana al uso clínico habitual', valorEsperado: 'Lectura dentro de tolerancia institucional y estable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hom160pf7', prueba: 'Verificación cerca de capacidad máxima — Aplicar carga segura sin exceder la capacidad nominal rotulada (180 kg / 400 lb)', valorEsperado: 'La báscula responde sin deformación, inestabilidad, atascamiento ni daño mecánico', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hom160pf8', prueba: 'Repetibilidad — Aplicar y retirar el mismo peso patrón al menos 3 veces en el centro', valorEsperado: 'Lecturas repetibles, con variación dentro de la tolerancia definida por metrología', resultado: ['Pasa', 'Falla'] },
        { id: 'hom160pf9', prueba: 'Excentricidad — Aplicar peso patrón en el centro y en los cuatro cuadrantes de la plataforma', valorEsperado: 'Lecturas consistentes entre posiciones y dentro de tolerancia institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'hom160pf10', prueba: 'Retorno a cero — Retirar toda la carga después de cada medición', valorEsperado: 'La aguja retorna a cero estable sin quedar con valor residual', resultado: ['Pasa', 'Falla'] },
        { id: 'hom160pf11', prueba: 'Histéresis/retorno — Cargar gradualmente y descargar lentamente la plataforma', valorEsperado: 'Movimiento suave de la aguja sin atascamiento, saltos ni diferencia significativa entre carga y descarga', resultado: ['Pasa', 'Falla'] },
        { id: 'hom160pf12', prueba: 'Estabilidad mecánica/nivelación — Presionar suavemente las esquinas de la plataforma', valorEsperado: 'La báscula permanece firme, sin balanceo, ruido mecánico, deslizamiento o desplazamiento', resultado: ['Pasa', 'Falla'] },
        { id: 'hom160pf13', prueba: 'Legibilidad del dial — Leer la escala desde la posición de pie del paciente', valorEsperado: 'Escala y aguja claramente legibles, sin error de paralaje relevante ni lente dañado', resultado: ['Pasa', 'Falla'] },
        { id: 'hom160pf14', prueba: 'Limpieza/desinfección posterior', valorEsperado: 'Plataforma, base y lente del dial limpios y secos, sin residuos químicos ni ingreso de líquido al mecanismo', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de plataforma, superficie antideslizante, lente del dial, base y estructura',
        'Revisión de plataforma, base, soportes, patas, columna del dial, lente, aguja, escala impresa, perilla de cero y etiquetas',
        'Alineación mecánica subiendo/bajando de la plataforma y ajuste de cero con la perilla inferior',
        'Verificación comparativa con pesas patrón calibradas en puntos bajo, medio y alto del rango',
        'Prueba de repetibilidad, excentricidad, histéresis/retorno y estabilidad mecánica',
        'Verificación de legibilidad del dial y ausencia de atascamiento de la aguja',
        'Registro de desviaciones metrológicas y recomendación de servicio técnico autorizado si está fuera de tolerancia (equipo no calibrable por el usuario)',
        'Retiro de servicio por aguja trabada/doblada, lente roto, daño de plataforma, superficie antideslizante deteriorada, imposibilidad de poner en cero o desviación fuera de tolerancia',
        'Remisión a servicio técnico calificado Health o meter/Pelstar o proveedor metrológico especializado'
      ]
    },


    'unidad_calentamiento_warmtouch_wt5900': {
      nombre: 'Unidad de Calentamiento WarmTouch WT-5900',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-WT-5900',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire la unidad de calentamiento WarmTouch WT-5900 del uso clínico antes de iniciar el mantenimiento preventivo y confirme que no esté conectada a un paciente.',
        'Desconecte el cable de alimentación de la red antes de realizar limpieza, inspección externa, revisión de filtro, manguera, boquilla, cubierta o cableado visible.',
        'No abra ni desarme la unidad durante mantenimiento preventivo rutinario; las intervenciones internas, reparación del sistema calefactor, blower o tarjetas deben ser realizadas por personal técnico autorizado.',
        'No rocíe, vierta ni derrame líquidos sobre la unidad, conectores, interruptores, rejillas, entradas de aire, panel de control, manguera o aberturas de la carcasa.',
        'Realice limpieza externa con paño suave ligeramente humedecido con limpiador no abrasivo o solución institucional compatible; seque completamente antes de energizar.',
        'Verifique disponibilidad de analizador de seguridad eléctrica, termómetro/analizador de temperatura de aire calibrado, cronómetro, manta o adaptador de prueba compatible y formato de registro.',
        'Use únicamente mantas o accesorios compatibles con sistema WarmTouch; no realice prueba clínica con flujo libre directamente hacia el paciente ni permita contacto de la manguera caliente con piel.',
        'Durante pruebas térmicas, mantenga la boquilla conectada a una manta o dispositivo de prueba y dirija el flujo de aire de forma segura para evitar lesión térmica o sobrecalentamiento local.',
        'Confirme que el filtro HEPA y la cubierta del filtro estén instalados; no opere la unidad con el alojamiento del filtro removido o con obstrucciones en entrada/salida de aire.',
        'Revise el contador de horas si está disponible y programe cambio de filtro según criterio del fabricante/institución, típicamente cada 2.000 horas o 365 días, lo que ocurra primero.',
        'Verifique que el equipo se encuentre conectado a toma hospitalaria con puesta a tierra funcional durante pruebas energizadas.',
        'Retire de servicio si presenta alarma de sobretemperatura, olor a quemado, carcasa caliente anormal, manguera deteriorada, filtro ausente, daño eléctrico, flujo insuficiente o falla de selección de temperatura.',
        'El mantenimiento debe ser realizado por personal de tecnología biomédica entrenado, siguiendo el manual de operación/servicio, el programa institucional y normas de seguridad eléctrica hospitalaria.'
      ],
      inspeccion: [
        { id: 'wt5900i1', item: 'Carcasa externa íntegra, limpia, sin fisuras, golpes, deformaciones, tornillos faltantes, partes sueltas, manchas, corrosión, quemaduras ni evidencia de líquidos derramados' },
        { id: 'wt5900i2', item: 'Panel de control legible, con teclas o indicadores de temperatura en buen estado, sin botones hundidos, membrana rota, desgaste crítico o indicadores apagados' },
        { id: 'wt5900i3', item: 'Interruptor principal funcional, firme, sin juego excesivo, chisporroteo, calentamiento, ruptura, humedad o accionamiento intermitente' },
        { id: 'wt5900i4', item: 'Cable de alimentación hospitalario íntegro, sin cortes, aplastamientos, empalmes, clavija floja, pines deformados, aislamiento expuesto o daño por calor' },
        { id: 'wt5900i5', item: 'Etiqueta de identificación, marca WarmTouch, modelo WT-5900, serie, activo fijo, advertencias y datos eléctricos legibles y coherentes con inventario' },
        { id: 'wt5900i6', item: 'Manguera autoportante completa, flexible, sin perforaciones, aplastamientos, obstrucciones, deformación, olor a quemado, alambres expuestos ni desprendimiento' },
        { id: 'wt5900i7', item: 'Boquilla o nozzle íntegro, limpio y firmemente unido a la manguera, sin grietas, bordes cortantes, deformación térmica o acople inseguro a la manta' },
        { id: 'wt5900i8', item: 'Correa o clip de sujeción de boquilla disponible y funcional, sin ruptura, pérdida de tensión, partes faltantes o riesgo de desconexión accidental' },
        { id: 'wt5900i9', item: 'Entrada y salida de aire libres de polvo, pelusa, obstrucciones, residuos de manta, apósitos, material textil o elementos que limiten el flujo' },
        { id: 'wt5900i10', item: 'Cubierta del filtro instalada, firme, limpia, sin fisuras, pestañas rotas, holgura, tornillos faltantes o evidencia de operación sin filtro' },
        { id: 'wt5900i11', item: 'Filtro HEPA presente, seco, correctamente asentado, sin saturación visible, humedad, deformación, polvo excesivo, olor, ruptura o fecha/horas vencidas según programa' },
        { id: 'wt5900i12', item: 'Ganchos, soporte de cama, abrazadera de carro o montaje en atril firmes, sin holguras, corrosión, deformación, tornillos flojos o riesgo de caída' },
        { id: 'wt5900i13', item: 'Ruedas o carro de transporte si aplica en buen estado, con frenos funcionales, sin inestabilidad, inclinación, vibración excesiva o dificultad de desplazamiento' },
        { id: 'wt5900i14', item: 'Contador de horas visible y funcional si aplica, sin pantalla ilegible, daño, bloqueo o imposibilidad de lectura para control de mantenimiento/filtro' },
        { id: 'wt5900i15', item: 'No se evidencian sonidos anormales, vibración excesiva, olor a quemado, calentamiento externo anormal, fugas de aire por carcasa o manguera' },
        { id: 'wt5900i16', item: 'Accesorios compatibles, manta de prueba o adaptador, manual/instrucciones de seguridad y registro de mantenimiento disponibles para la intervención' }
      ],
      verificacionBasica: [
        { id: 'wt5900vb1', item: 'Al conectar a toma hospitalaria con tierra, el equipo no presenta chispas, olor a quemado, calentamiento del cable ni disparo de protección eléctrica' },
        { id: 'wt5900vb2', item: 'El interruptor principal enciende la unidad y el flujo de aire inicia de forma estable sin vibración excesiva ni ruido anormal del blower' },
        { id: 'wt5900vb3', item: 'Los indicadores del panel de control encienden correctamente y permiten seleccionar los niveles de temperatura disponibles' },
        { id: 'wt5900vb4', item: 'La unidad inicia en condición segura y permite cancelar/confirmar alarma inicial según secuencia normal del equipo' },
        { id: 'wt5900vb5', item: 'La manguera y boquilla permanecen firmes durante operación, sin desconexión, fugas evidentes, deformación térmica o flujo hacia zonas no deseadas' },
        { id: 'wt5900vb6', item: 'El flujo de aire percibido en la manta o adaptador de prueba es continuo, uniforme y sin obstrucciones evidentes' },
        { id: 'wt5900vb7', item: 'Las selecciones de temperatura baja, media, alta y boost/alta máxima si aplica responden al accionar las teclas y cambian el indicador correspondiente' },
        { id: 'wt5900vb8', item: 'La temperatura de salida aumenta de forma gradual y coherente sin superar límites de seguridad ni generar alarma injustificada' },
        { id: 'wt5900vb9', item: 'La alarma visual/audible de advertencia se encuentra funcional durante autoprueba o condición simulada permitida por procedimiento' },
        { id: 'wt5900vb10', item: 'El filtro y la cubierta permanecen correctamente instalados durante operación, sin vibración, succión anormal, ruido por fuga o restricción del flujo' },
        { id: 'wt5900vb11', item: 'El equipo puede operar durante un periodo de observación mínimo sin apagados, reinicios, cambios espontáneos de temperatura o códigos de error' },
        { id: 'wt5900vb12', item: 'Al apagar, el equipo detiene el flujo de aire correctamente y queda sin indicadores activos, olores anormales o calentamiento residual inseguro' }
      ],
      pruebasFuncionales: [
        { id: 'wt5900pf1', prueba: 'Encendido general y autoprueba', valorEsperado: 'Equipo enciende, blower inicia, indicadores activos y sin fallas críticas, olor a quemado o ruido anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'wt5900pf2', prueba: 'Verificación de flujo de aire con manta/adaptador compatible', valorEsperado: 'Flujo continuo, uniforme y suficiente, sin obstrucción, fuga importante o desconexión de manguera', resultado: ['Pasa', 'Falla'] },
        { id: 'wt5900pf3', prueba: 'Modo temperatura baja', valorEsperado: 'Indicador correspondiente activo y temperatura de salida estable dentro de tolerancia institucional/fabricante', resultado: ['Pasa', 'Falla'] },
        { id: 'wt5900pf4', prueba: 'Modo temperatura media', valorEsperado: 'Indicador correspondiente activo y aumento térmico gradual sin alarma ni sobretemperatura', resultado: ['Pasa', 'Falla'] },
        { id: 'wt5900pf5', prueba: 'Modo temperatura alta', valorEsperado: 'Indicador correspondiente activo y temperatura estable sin exceder límites de seguridad', resultado: ['Pasa', 'Falla'] },
        { id: 'wt5900pf6', prueba: 'Modo Boost o máximo si aplica', valorEsperado: 'Modo disponible responde correctamente y permanece dentro del límite de control; registrar si no aplica al modelo/configuración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wt5900pf7', prueba: 'Medición de temperatura de aire en salida/manta', valorEsperado: 'Lectura coherente con modo seleccionado y dentro de tolerancias definidas por manual, patrón o metrología institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'wt5900pf8', prueba: 'Estabilidad térmica durante 10 minutos', valorEsperado: 'Temperatura estable, sin oscilaciones bruscas, apagado espontáneo, alarma injustificada o olor a sobrecalentamiento', resultado: ['Pasa', 'Falla'] },
        { id: 'wt5900pf9', prueba: 'Prueba de advertencia/alarma de sobretemperatura según puerto o procedimiento de servicio', valorEsperado: 'Alarma visual/audible responde correctamente o se documenta como prueba especializada no ejecutada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wt5900pf10', prueba: 'Verificación del sistema independiente de seguridad por sobretemperatura', valorEsperado: 'Cumple prueba de servicio con personal/equipo autorizado; si no se ejecuta, dejar programada verificación técnica especializada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wt5900pf11', prueba: 'Filtro HEPA y contador de horas', valorEsperado: 'Filtro instalado, limpio y dentro de vida útil; reemplazo programado si supera 2.000 horas o 365 días según criterio institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'wt5900pf12', prueba: 'Prueba funcional de manguera, boquilla y clip', valorEsperado: 'Manguera mantiene posición, boquilla acopla firmemente a manta y clip evita desconexión accidental', resultado: ['Pasa', 'Falla'] },
        { id: 'wt5900pf13', prueba: 'Verificación de montaje en cama, carro o atril', valorEsperado: 'Equipo estable, sin riesgo de caída; altura/posición segura y compatible con instrucciones del fabricante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wt5900pf14', prueba: 'Seguridad eléctrica: resistencia de tierra', valorEsperado: 'Valor dentro de límites de norma institucional para equipo clase I con conexión a tierra', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wt5900pf15', prueba: 'Seguridad eléctrica: corriente de fuga', valorEsperado: 'Corriente de fuga dentro de límites institucionales/normativos para equipo médico conectado a red', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wt5900pf16', prueba: 'Operación continua con observación de ruido/vibración', valorEsperado: 'Funcionamiento estable, sin vibración excesiva, golpes internos, ruido de rodamientos o variación del blower', resultado: ['Pasa', 'Falla'] },
        { id: 'wt5900pf17', prueba: 'Limpieza y desinfección final', valorEsperado: 'Carcasa, panel, manguera y boquilla limpias y secas, sin residuos de líquido ni obstrucción de entradas/salidas', resultado: ['Pasa', 'Falla'] },
        { id: 'wt5900pf18', prueba: 'Criterio final de aptitud', valorEsperado: 'Apto si cumple flujo, control térmico, alarmas, filtro, montaje, manguera, cable y seguridad eléctrica; retirar si falla función crítica', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, panel de control, manguera, boquilla, cable de alimentación, soporte y superficies accesibles',
        'Inspección visual de cable hospitalario, interruptor, etiquetas, carcasa, entradas/salidas de aire y estado general del equipo',
        'Verificación de filtro HEPA, cubierta del filtro, contador de horas y programación de cambio de filtro según horas/días de uso',
        'Verificación funcional de encendido, blower, flujo de aire, selección de temperaturas e indicadores del panel',
        'Medición de temperatura de salida con patrón calibrado y verificación de estabilidad térmica por modo disponible',
        'Revisión de manguera autoportante, boquilla, clip/correa y compatibilidad con manta o adaptador de prueba',
        'Verificación de alarma/advertencia de temperatura y programación de prueba especializada del sistema independiente de sobretemperatura si aplica',
        'Revisión de soporte de cama, carro, atril o montaje, incluyendo estabilidad y seguridad mecánica',
        'Prueba de seguridad eléctrica visual e instrumental si se cuenta con analizador disponible',
        'Registro de hallazgos, modo de operación probado, temperatura medida, estado de filtro, responsable y próxima fecha de mantenimiento',
        'Recomendación de cambio de filtro, correctivo especializado o retiro de servicio cuando se detecten fallas críticas de flujo, temperatura, alarma, manguera o seguridad eléctrica'
      ]
    },


    'termohigrometro_multicomp_pro_ta298': {
      nombre: 'Termohigrómetro Multicomp Pro TA298',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-MCP-TA298',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el termohigrómetro del punto de control ambiental antes de iniciar el mantenimiento, dejando un equipo de respaldo si el área requiere monitoreo continuo de temperatura y humedad.',
        'Realice limpieza externa con paño suave ligeramente humedecido; no sumerja el equipo, no aplique líquidos directamente sobre pantalla, botones, sensor, soporte, compartimiento de batería o sonda externa.',
        'Verifique que el equipo esté identificado como instrumento de monitoreo ambiental y que su ubicación corresponda al servicio, nevera, almacén, laboratorio, farmacia, ambiente clínico o área administrativa definida.',
        'Confirme disponibilidad de patrón calibrado de temperatura y humedad o termohigrómetro patrón, fuente de referencia ambiental estable, batería compatible, cronómetro y formato de registro metrológico.',
        'Permita estabilización térmica del equipo y del patrón en el mismo ambiente antes de comparar lecturas; evite corrientes de aire, exposición solar directa, fuentes de calor, superficies húmedas o proximidad a evaporadores.',
        'Para pruebas con sonda externa, ubique la punta de la sonda junto al patrón sin tocar paredes metálicas, hielo, agua, resistencias, compresores o superficies que alteren la lectura.',
        'No abra la tarjeta electrónica ni manipule sensor interno, display, circuitos o contactos, salvo cambio de batería autorizado por procedimiento institucional.',
        'No use el equipo si presenta pantalla ilegible, lectura fuera de rango, humedad condensada, corrosión, daño de sonda, cable partido, botones bloqueados o compartimiento de batería sulfatado.',
        'La verificación funcional debe incluir temperatura interior, temperatura exterior por sonda cableada si aplica, humedad relativa, memoria MAX/MIN, selección °C/°F, reloj y alarma si están habilitados.',
        'Registre las desviaciones encontradas frente al patrón calibrado y determine si el equipo continúa apto, requiere ajuste de ubicación, cambio de batería, calibración externa o reposición.',
        'El mantenimiento debe ser realizado por personal de tecnología biomédica o metrología, siguiendo el programa institucional, el manual del fabricante y los criterios de control ambiental del hospital.'
      ],
      inspeccion: [
        { id: 'ta298i1', item: 'Carcasa íntegra, limpia, sin fisuras, golpes, deformaciones, humedad interna, manchas, corrosión, partes sueltas ni evidencia de intervención no autorizada' },
        { id: 'ta298i2', item: 'Pantalla LCD amplia legible, sin segmentos apagados, manchas, cristal roto, pérdida de contraste, parpadeo anormal ni empañamiento interno' },
        { id: 'ta298i3', item: 'Lectura visible de temperatura interior, temperatura exterior si aplica, humedad relativa, hora, unidad de medida y memoria MAX/MIN según configuración del equipo' },
        { id: 'ta298i4', item: 'Botones MODE, SET, MAX/MIN, RESET, °C/°F o equivalentes funcionales, sin bloqueo, hundimiento, desgaste excesivo, suciedad o respuesta intermitente' },
        { id: 'ta298i5', item: 'Sensor interno de temperatura/humedad sin obstrucción, polvo, residuos, humedad, adhesivos o elementos que limiten ventilación natural del equipo' },
        { id: 'ta298i6', item: 'Sonda externa de temperatura presente si aplica, con cable completo, sin cortes, aplastamientos, falsos contactos, oxidación, empalmes improvisados o punta deteriorada' },
        { id: 'ta298i7', item: 'Conector o salida de sonda externa firme, limpio y sin holgura, corrosión, daño mecánico o desconexión accidental' },
        { id: 'ta298i8', item: 'Compartimiento de batería limpio, seco, con tapa funcional, polaridad legible, resortes/contactos sin sulfato, corrosión, deformación o batería vencida' },
        { id: 'ta298i9', item: 'Soporte posterior, gancho de pared o base de mesa estable, sin fracturas, holguras, tornillos flojos o riesgo de caída del equipo' },
        { id: 'ta298i10', item: 'Etiquetas de marca Multicomp Pro, modelo TA298, activo fijo, servicio, punto de medición y estado metrológico legibles y coherentes con inventario' },
        { id: 'ta298i11', item: 'Equipo ubicado lejos de sol directo, fuentes de calor/frío, corrientes de aire, evaporadores, puertas de nevera o zonas con vibración que puedan sesgar mediciones' },
        { id: 'ta298i12', item: 'Superficie de instalación limpia, seca y segura, con el sensor libre y sin contacto directo con paredes húmedas, metal frío, líquidos o material contaminante' },
        { id: 'ta298i13', item: 'No se evidencian alarmas activas injustificadas, valores erráticos, congelamiento de lectura, reinicios espontáneos o pérdida de configuración' },
        { id: 'ta298i14', item: 'Accesorios de montaje, batería, sonda externa y registro institucional disponibles y en condiciones adecuadas para uso continuo' }
      ],
      verificacionBasica: [
        { id: 'ta298vb1', item: 'El equipo enciende correctamente después de instalar/verificar la batería y mantiene lectura estable sin apagados o reinicios espontáneos' },
        { id: 'ta298vb2', item: 'La pantalla muestra temperatura interior dentro del rango operativo esperado para el ambiente evaluado y sin símbolos de error' },
        { id: 'ta298vb3', item: 'La pantalla muestra humedad relativa dentro del rango operativo esperado y sin valores fijos, erráticos o imposibles para el ambiente' },
        { id: 'ta298vb4', item: 'La sonda externa registra temperatura al conectarse/ubicarse en punto de referencia, diferenciándose de la lectura interior cuando corresponde' },
        { id: 'ta298vb5', item: 'La función °C/°F cambia la unidad de temperatura correctamente y retorna a °C para uso institucional si así está definido' },
        { id: 'ta298vb6', item: 'La función MAX/MIN permite consultar valores máximos y mínimos memorizados de temperatura y humedad' },
        { id: 'ta298vb7', item: 'La función RESET borra los registros MAX/MIN y reinicia memoria para nuevo periodo de monitoreo si aplica' },
        { id: 'ta298vb8', item: 'El reloj 12/24 horas puede visualizarse y configurarse; la alarma horaria/despertador responde si está habilitada' },
        { id: 'ta298vb9', item: 'La batería mantiene contacto estable al mover suavemente el equipo, sin pérdida de lectura, reinicio ni cambio de contraste' },
        { id: 'ta298vb10', item: 'Las lecturas comparadas con patrón calibrado permanecen dentro de la tolerancia institucional definida para temperatura y humedad' },
        { id: 'ta298vb11', item: 'El equipo queda instalado en el punto asignado, visible, estable, con la sonda externa correctamente posicionada si aplica y registro actualizado' }
      ],
      pruebasFuncionales: [
        { id: 'ta298pf1', prueba: 'Encendido y visualización inicial', valorEsperado: 'Pantalla activa con todos los segmentos principales legibles y sin códigos de error', resultado: ['Pasa', 'Falla'] },
        { id: 'ta298pf2', prueba: 'Comparación de temperatura interior contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±1 °C o tolerancia institucional definida', resultado: ['Pasa', 'Falla'] },
        { id: 'ta298pf3', prueba: 'Comparación de humedad relativa contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±5 %HR o tolerancia institucional definida', resultado: ['Pasa', 'Falla'] },
        { id: 'ta298pf4', prueba: 'Comparación de temperatura exterior/sonda cableada contra patrón', valorEsperado: 'Lectura de sonda dentro de tolerancia institucional; sin saltos ni pérdida de señal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ta298pf5', prueba: 'Estabilidad de lectura durante 5 minutos en ambiente controlado', valorEsperado: 'Variación gradual y coherente, sin oscilaciones bruscas, congelamiento o reinicios', resultado: ['Pasa', 'Falla'] },
        { id: 'ta298pf6', prueba: 'Respuesta dinámica de la sonda externa ante cambio térmico moderado', valorEsperado: 'La lectura cambia progresivamente y se estabiliza sin desconexión ni valores imposibles', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ta298pf7', prueba: 'Función de memoria MAX/MIN', valorEsperado: 'Permite visualizar máximos y mínimos de temperatura/humedad y conservarlos hasta reinicio', resultado: ['Pasa', 'Falla'] },
        { id: 'ta298pf8', prueba: 'Función RESET de memoria', valorEsperado: 'Borra máximos/mínimos previos y reinicia registro desde las condiciones actuales', resultado: ['Pasa', 'Falla'] },
        { id: 'ta298pf9', prueba: 'Conversión °C/°F', valorEsperado: 'La unidad cambia correctamente y se deja configurada en °C para operación institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'ta298pf10', prueba: 'Verificación de reloj 12/24 h', valorEsperado: 'Hora visible y ajustable; formato 12/24 h funcional si está disponible', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ta298pf11', prueba: 'Verificación de alarma/despertador', valorEsperado: 'Alarma audible/indicador funcional si el equipo cuenta con esta opción; se deja desactivada si no se requiere', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ta298pf12', prueba: 'Prueba de batería y contactos', valorEsperado: 'Batería funcional, sin sulfato, con contacto firme y sin reinicios al mover suavemente el equipo', resultado: ['Pasa', 'Falla'] },
        { id: 'ta298pf13', prueba: 'Inspección funcional del soporte o montaje', valorEsperado: 'Equipo permanece estable en pared o mesa, visible y sin riesgo de caída o desplazamiento accidental', resultado: ['Pasa', 'Falla'] },
        { id: 'ta298pf14', prueba: 'Verificación de ubicación del punto de medición', valorEsperado: 'Ubicación representativa del ambiente monitoreado, lejos de fuentes de sesgo térmico/higrométrico', resultado: ['Pasa', 'Falla'] },
        { id: 'ta298pf15', prueba: 'Legibilidad de identificación y estado metrológico', valorEsperado: 'Activo, servicio, punto de medición, fecha de verificación y próxima revisión visibles/registrados', resultado: ['Pasa', 'Falla'] },
        { id: 'ta298pf16', prueba: 'Limpieza y desinfección final', valorEsperado: 'Equipo limpio, seco, sin residuos de líquido ni obstrucción del sensor interno o sonda externa', resultado: ['Pasa', 'Falla'] },
        { id: 'ta298pf17', prueba: 'Criterio final de aptitud', valorEsperado: 'Apto si cumple lectura, estabilidad, batería, pantalla, botones, sonda y ubicación; retirar si falla función crítica', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, pantalla, botones, soporte, compartimiento de batería y sonda externa si aplica',
        'Verificación visual de pantalla LCD, segmentos, contraste, etiquetas e identificación institucional',
        'Revisión de batería, contactos, polaridad, tapa y ausencia de sulfatación o humedad',
        'Verificación funcional de temperatura interior, humedad relativa y temperatura exterior por sonda cableada si aplica',
        'Comparación de lecturas contra patrón calibrado de temperatura y humedad',
        'Verificación de funciones MAX/MIN, RESET, °C/°F, reloj y alarma si aplica',
        'Revisión de cable y punta de sonda externa, conectores y posicionamiento del punto de medición',
        'Verificación de soporte de pared/base de mesa y condiciones de ubicación ambiental',
        'Cambio de batería o ajuste externo de instalación si aplica',
        'Registro de desviaciones, estado metrológico, responsable y próxima fecha de mantenimiento/verificación',
        'Recomendación de calibración externa, reposición de batería/accesorios o retiro de servicio si no cumple tolerancia'
      ]
    },


    'tensiometro_pared_welch_allyn_7670_01': {
      nombre: 'Tensiómetro de Pared Welch Allyn 7670-01',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-WA-7670-01',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el tensiómetro de pared Welch Allyn 7670-01 del uso clínico antes de iniciar el mantenimiento preventivo y confirme que no esté asignado a una atención de paciente.',
        'Realice limpieza externa previa conforme al protocolo institucional, evitando ingreso de líquidos al manómetro, canastilla, tubos, pera, válvula, brazalete o conexiones.',
        'Use paño suave o toalla germicida compatible; no sumerja el manómetro, la pera, la válvula, los tubos en espiral, el brazalete ni el mecanismo aneroide.',
        'Confirme disponibilidad de manómetro patrón calibrado o analizador de presión no invasiva, conector en T, pera de insuflación, brazalete funcional, cronómetro y formato de registro metrológico.',
        'Verifique que el equipo esté firmemente instalado en pared o riel, con canastilla, soporte, tubería en espiral y accesorios en buen estado antes de efectuar pruebas de presión.',
        'La verificación de presión debe realizarse contra patrón calibrado y trazable, registrando como mínimo 0, 50, 100, 150, 200, 250 y 300 mmHg o los puntos definidos por metrología institucional.',
        'No exceda 300 mmHg durante pruebas de mantenimiento preventivo rutinario ni someta el mecanismo aneroide a sobrepresión innecesaria.',
        'No abra la carcasa del manómetro ni intervenga el mecanismo interno, diafragma, engranajes, aguja, carátula o sistema de ajuste durante mantenimiento preventivo rutinario.',
        'Si la aguja no retorna a cero, el equipo está fuera de tolerancia, presenta fuga neumática, lectura inestable, daño de soporte o accesorios deteriorados, retire de servicio y gestione calibración/correctivo.',
        'Verifique que el brazalete corresponda al tamaño del paciente y que sean legibles la marca arterial, rango de circunferencia, talla y sentido de colocación; el uso de brazalete incorrecto altera la medición.',
        'El mantenimiento debe ser realizado por personal entrenado en tecnología biomédica o metrología, siguiendo el programa institucional, las recomendaciones del fabricante y tolerancias para esfigmomanómetros aneroides.'
      ],
      inspeccion: [
        { id: 'wa767001i1', item: 'Carcasa del manómetro de pared íntegra, limpia, sin fisuras, golpes, deformaciones, corrosión, humedad, partes sueltas ni evidencia de intervención no autorizada' },
        { id: 'wa767001i2', item: 'Dial grande 0-300 mmHg legible, sin manchas, empañamiento, rayones críticos, desprendimiento de carátula, deformación ni marcas ilegibles' },
        { id: 'wa767001i3', item: 'Aguja indicadora en reposo ubicada en cero o dentro de la zona de tolerancia definida, sin flexión, roce, saltos, vibración excesiva ni desplazamiento permanente' },
        { id: 'wa767001i4', item: 'Cristal, cubierta, bisel y frente del manómetro firmes, limpios, sin grietas, opacidad, bordes cortantes, desprendimiento ni ingreso visible de polvo/humedad' },
        { id: 'wa767001i5', item: 'Soporte de pared o riel firme, estable y correctamente instalado, sin tornillos flojos, holguras, inclinación, corrosión o riesgo de caída' },
        { id: 'wa767001i6', item: 'Canastilla o compartimiento de accesorios limpio, fijo, sin bordes cortantes, deformación, elementos contaminados o acumulación de polvo/residuos' },
        { id: 'wa767001i7', item: 'Tubos en espiral y líneas neumáticas flexibles, sin grietas, aplastamientos, endurecimiento, obstrucciones, fugas, reparaciones improvisadas ni desconexiones flojas' },
        { id: 'wa767001i8', item: 'Conectores del manómetro, tubos, pera, válvula y brazalete firmes, compatibles, limpios, sin fisuras, holguras, adaptadores inadecuados ni fugas' },
        { id: 'wa767001i9', item: 'Pera de insuflación flexible, limpia y funcional, sin grietas, endurecimiento, pérdida de elasticidad, fuga o válvula antirretorno defectuosa' },
        { id: 'wa767001i10', item: 'Válvula de liberación de aire con giro suave, control fino y cierre estable, sin bloqueo, liberación brusca no controlada, fuga ni piezas sueltas' },
        { id: 'wa767001i11', item: 'Brazalete FlexiPort o de dos tubos íntegro, limpio, con tela, costuras y cierre funcional, sin rasgaduras, contaminación, deformación o pérdida de adherencia' },
        { id: 'wa767001i12', item: 'Marca arterial, rango de circunferencia, talla del brazalete y orientación de colocación legibles y compatibles con la población atendida en el servicio' },
        { id: 'wa767001i13', item: 'Bolsa neumática interna sin perforaciones, dobleces permanentes, endurecimiento, desplazamiento, deformación o fugas visibles/audibles' },
        { id: 'wa767001i14', item: 'Sistema neumático completo sin fuga audible al presurizar, sin caída rápida de presión ni pérdida de respuesta al manipular suavemente tubos/conectores' },
        { id: 'wa767001i15', item: 'Etiquetas Welch Allyn, referencia 7670-01, identificación institucional, activo fijo, número de serie y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'wa767001i16', item: 'Superficies externas limpias y secas, sin fluidos, polvo, residuos de desinfectante, adhesivos, material biológico o contaminantes visibles' }
      ],
      verificacionBasica: [
        { id: 'wa767001vb1', item: 'La aguja parte de cero y retorna a cero de forma estable después de despresurizar completamente el sistema' },
        { id: 'wa767001vb2', item: 'El sistema permite insuflar el brazalete progresivamente hasta 300 mmHg sin esfuerzo excesivo, sin fuga audible ni desconexión de accesorios' },
        { id: 'wa767001vb3', item: 'La válvula permite descenso fino y controlado de presión en el rango clínico, sin bloqueo, salto brusco o liberación irregular' },
        { id: 'wa767001vb4', item: 'La apertura completa de la válvula permite liberación rápida, completa y segura de la presión al finalizar medición o prueba' },
        { id: 'wa767001vb5', item: 'El brazalete mantiene cierre firme durante presurización, sin apertura espontánea, desplazamiento de bolsa neumática o deformación anormal' },
        { id: 'wa767001vb6', item: 'El soporte de pared mantiene posición estable durante conexión, presurización, lectura y almacenamiento de accesorios' },
        { id: 'wa767001vb7', item: 'La lectura comparada con patrón calibrado permanece dentro de la tolerancia metrológica institucional/fabricante en los puntos evaluados' },
        { id: 'wa767001vb8', item: 'No se evidencian saltos de aguja, fricción mecánica, lectura retardada, vibración excesiva ni histéresis crítica durante aumento y descenso de presión' },
        { id: 'wa767001vb9', item: 'El equipo conserva presión durante prueba de estanqueidad, sin fuga significativa en pera, válvula, tubos, brazalete, conectores o manómetro' },
        { id: 'wa767001vb10', item: 'El dial puede leerse claramente desde la posición normal de uso clínico y los accesorios quedan organizados en la canastilla/soporte' },
        { id: 'wa767001vb11', item: 'Se registra resultado de mantenimiento, desviaciones, acciones realizadas, responsable y próxima fecha de verificación/calibración según programa institucional' }
      ],
      pruebasFuncionales: [
        { id: 'wa767001pf1', prueba: 'Inspección de cero mecánico sin presión aplicada', valorEsperado: 'Aguja ubicada en cero o dentro de la marca/tolerancia permitida antes de iniciar pruebas', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf2', prueba: 'Comparación a 50 mmHg contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf3', prueba: 'Comparación a 100 mmHg contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf4', prueba: 'Comparación a 150 mmHg contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf5', prueba: 'Comparación a 200 mmHg contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf6', prueba: 'Comparación a 250 mmHg contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf7', prueba: 'Comparación a 300 mmHg contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional; no exceder presión máxima de prueba', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf8', prueba: 'Retorno a cero después de presurización máxima', valorEsperado: 'Aguja retorna a cero sin quedarse desplazada, pegada o con oscilación permanente', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf9', prueba: 'Prueba de fuga a 250 mmHg durante 60 segundos', valorEsperado: 'Caída de presión ≤ 4 mmHg/min o criterio institucional, sin fuga audible en sistema neumático', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf10', prueba: 'Prueba de fuga a 150 mmHg durante 60 segundos', valorEsperado: 'Presión estable, sin caída progresiva anormal ni variaciones por conectores, brazalete o tubo espiral', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf11', prueba: 'Control de desinflado lento mediante válvula', valorEsperado: 'Permite descenso controlado aproximado de 2 a 3 mmHg/s para medición auscultatoria', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf12', prueba: 'Liberación rápida de presión', valorEsperado: 'Al abrir completamente la válvula, el sistema se despresuriza de forma rápida, completa y segura', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf13', prueba: 'Función antirretorno de la pera', valorEsperado: 'La pera insufla con respuesta uniforme, no retorna aire hacia la mano y no requiere fuerza excesiva', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf14', prueba: 'Integridad funcional de brazalete y cierre', valorEsperado: 'El brazalete no se abre ni se desplaza durante presurización a 200 mmHg y mantiene ajuste uniforme', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf15', prueba: 'Prueba de tubos en espiral y conectores durante movimiento suave', valorEsperado: 'No aparecen fugas intermitentes, desconexiones, acodamientos críticos ni cambios bruscos de presión', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf16', prueba: 'Estabilidad del soporte de pared y canastilla', valorEsperado: 'Manómetro, soporte y canastilla permanecen firmes durante uso simulado y almacenamiento de accesorios', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf17', prueba: 'Legibilidad de escala, aguja y marcas del brazalete', valorEsperado: 'Lectura del dial y marcas de colocación/talla claramente visibles para el usuario clínico', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf18', prueba: 'Compatibilidad de brazalete con población atendida', valorEsperado: 'Talla y rango de circunferencia adecuados para el servicio; se documenta necesidad de brazaletes adicionales si aplica', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa767001pf19', prueba: 'Limpieza, desinfección y secado final', valorEsperado: 'Equipo queda limpio, seco, sin residuos químicos ni humedad retenida en conexiones, canastilla o brazalete', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf20', prueba: 'Rotulado de estado metrológico', valorEsperado: 'Etiqueta de mantenimiento/calibración vigente, legible y coherente con el registro en hoja de vida', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767001pf21', prueba: 'Criterio final de uso clínico', valorEsperado: 'Equipo apto si cumple cero, fuga, exactitud, brazalete, válvula, soporte y limpieza; retirar si incumple alguno crítico', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de manómetro, dial, cubierta, soporte, canastilla, tubos, pera, válvula, conectores y brazalete',
        'Desinfección externa de superficies de contacto con producto compatible y secado completo',
        'Verificación visual del cero mecánico y retorno de aguja a cero',
        'Verificación metrológica contra patrón calibrado en puntos de 50, 100, 150, 200, 250 y 300 mmHg',
        'Prueba de estanqueidad del sistema neumático completo en presiones clínica y alta',
        'Verificación de válvula de liberación fina y liberación rápida de presión',
        'Revisión de brazalete, bolsa neumática, velcro, marca arterial, rango de circunferencia y talla',
        'Revisión de tubos en espiral, conectores, pera de insuflación y válvula antirretorno',
        'Revisión de soporte de pared, fijación, canastilla y organización de accesorios',
        'Ajuste externo de conexiones o reemplazo de accesorios consumibles deteriorados si aplica',
        'Rotulación de estado de mantenimiento/calibración y registro en hoja de vida del equipo',
        'Recomendación de calibración externa, cambio de brazalete/tubos/pera/válvula o retiro de servicio si no cumple tolerancia'
      ]
    },


    'tensiometro_aneroide_alpk_sphygmomanometer': {
      nombre: 'Tensiómetro Aneroide ALPK Sphygmomanometer',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-ALPK-ANEROIDE',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el tensiómetro aneroide ALPK del uso clínico antes de iniciar el mantenimiento preventivo y confirme que no esté instalado o asignado a una atención de paciente.',
        'Realice limpieza externa previa conforme al protocolo institucional, evitando ingreso de líquidos al manómetro, pera, válvula, tubos o bolsa neumática.',
        'Use paño suave ligeramente humedecido con solución compatible; no sumerja el manómetro, brazalete, pera, tubos, válvula ni conectores.',
        'Confirme disponibilidad de manómetro patrón calibrado o analizador de presión no invasiva, conector en T, pera de insuflación, brazalete funcional, cronómetro y formato de registro metrológico.',
        'La verificación de presión debe realizarse contra patrón calibrado y trazable, registrando como mínimo 0, 50, 100, 150, 200, 250 y 300 mmHg o los puntos definidos por metrología institucional.',
        'No exceda 300 mmHg durante pruebas de mantenimiento preventivo rutinario ni someta el mecanismo aneroide a sobrepresión innecesaria.',
        'No abra la carcasa ni intervenga el mecanismo interno, diafragma, engranajes, aguja, carátula o sistema de ajuste durante mantenimiento preventivo rutinario.',
        'Si la aguja no retorna a cero, permanece fuera de tolerancia, presenta saltos, vibración excesiva, fuga neumática, brazalete deteriorado o válvula defectuosa, retire el equipo de servicio y gestione calibración/correctivo.',
        'Verifique que el brazalete corresponda al paciente y que estén legibles la marca arterial, rango de circunferencia, tamaño y sentido de colocación; el uso de brazalete incorrecto altera la medición.',
        'El mantenimiento debe ser realizado por personal entrenado en tecnología biomédica o metrología, siguiendo el programa institucional, las recomendaciones del fabricante y las tolerancias definidas para esfigmomanómetros aneroides.'
      ],
      inspeccion: [
        { id: 'alpki1', item: 'Carcasa del manómetro aneroide íntegra, sin fisuras, golpes, deformaciones, corrosión, humedad, partes sueltas ni evidencia de intervención no autorizada' },
        { id: 'alpki2', item: 'Dial y escala de presión 0-300 mmHg legibles, sin manchas, empañamiento, rayones críticos, desprendimiento de carátula ni marcas ilegibles' },
        { id: 'alpki3', item: 'Aguja en reposo ubicada en cero o dentro de la zona de tolerancia definida, sin flexión, rozamiento, saltos, vibración excesiva ni desplazamiento permanente' },
        { id: 'alpki4', item: 'Cristal o cubierta del dial limpia y firme, sin grietas, opacidad, desprendimiento, bordes cortantes o ingreso de polvo/humedad' },
        { id: 'alpki5', item: 'Brazalete íntegro y limpio, con tela, costuras, velcro o sistema de cierre funcional, sin rasgaduras, pérdida de adherencia, deformación o contaminación' },
        { id: 'alpki6', item: 'Marca arterial, rango de circunferencia, talla del brazalete y orientación de colocación legibles y compatibles con el uso clínico asignado' },
        { id: 'alpki7', item: 'Bolsa neumática interna sin perforaciones, dobleces permanentes, endurecimiento, desplazamiento, deformación o fugas visibles/audibles' },
        { id: 'alpki8', item: 'Tubos de caucho o PVC flexibles, sin grietas, aplastamientos, endurecimiento, obstrucciones, fugas, reparaciones improvisadas ni desconexiones flojas' },
        { id: 'alpki9', item: 'Conectores del manómetro, tubos y brazalete firmes, compatibles, limpios, sin fisuras, holguras, fugas ni adaptadores inadecuados' },
        { id: 'alpki10', item: 'Pera de insuflación flexible, limpia y funcional, sin grietas, endurecimiento, pérdida de elasticidad, fugas o válvula antirretorno defectuosa' },
        { id: 'alpki11', item: 'Válvula de liberación de aire con giro suave, control fino y cierre estable, sin bloqueo, salida brusca no controlada, fugas ni piezas sueltas' },
        { id: 'alpki12', item: 'Sistema neumático completo sin fuga audible al presurizar, sin caída rápida de presión ni pérdida de respuesta durante manipulación suave de tubos/conectores' },
        { id: 'alpki13', item: 'Estuche, soporte, clip o accesorios de almacenamiento en buen estado, limpios y sin elementos que puedan dañar el manómetro o el brazalete' },
        { id: 'alpki14', item: 'Etiquetas de marca ALPK/ALPK2, identificación institucional, activo fijo, número de serie y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'alpki15', item: 'Superficies externas limpias y secas, sin fluidos, polvo, residuos de desinfectante, adhesivos, material biológico o contaminantes visibles' }
      ],
      verificacionBasica: [
        { id: 'alpkvb1', item: 'La aguja parte de cero y retorna a cero de forma estable después de despresurizar completamente el sistema' },
        { id: 'alpkvb2', item: 'El sistema permite insuflar el brazalete progresivamente hasta 300 mmHg sin esfuerzo excesivo, sin fuga audible ni desconexión de accesorios' },
        { id: 'alpkvb3', item: 'La válvula permite descenso fino y controlado de presión en el rango clínico, sin bloqueo, salto brusco o liberación irregular' },
        { id: 'alpkvb4', item: 'La apertura completa de la válvula permite liberación rápida, completa y segura de la presión al finalizar la medición o prueba' },
        { id: 'alpkvb5', item: 'El brazalete mantiene cierre firme durante presurización, sin apertura espontánea, desplazamiento de bolsa neumática o deformación anormal' },
        { id: 'alpkvb6', item: 'La lectura comparada con patrón calibrado permanece dentro de la tolerancia metrológica institucional/fabricante en los puntos evaluados' },
        { id: 'alpkvb7', item: 'No se evidencian saltos de aguja, fricción mecánica, lectura retardada, vibración excesiva ni histéresis crítica durante aumento y descenso de presión' },
        { id: 'alpkvb8', item: 'El equipo conserva presión durante prueba de estanqueidad, sin fuga significativa en pera, válvula, tubos, brazalete o conectores' },
        { id: 'alpkvb9', item: 'El dial puede leerse claramente desde la posición normal de uso clínico y el equipo queda organizado para almacenamiento o uso seguro' },
        { id: 'alpkvb10', item: 'Se registra resultado de mantenimiento, desviaciones, acciones realizadas, responsable y próxima fecha de verificación/calibración según programa institucional' }
      ],
      pruebasFuncionales: [
        { id: 'alpkpf1', prueba: 'Inspección de cero mecánico sin presión aplicada', valorEsperado: 'Aguja ubicada en cero o dentro de la marca/tolerancia permitida antes de iniciar pruebas', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf2', prueba: 'Comparación a 50 mmHg contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf3', prueba: 'Comparación a 100 mmHg contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf4', prueba: 'Comparación a 150 mmHg contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf5', prueba: 'Comparación a 200 mmHg contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf6', prueba: 'Comparación a 250 mmHg contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf7', prueba: 'Comparación a 300 mmHg contra patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional; no exceder presión máxima de prueba', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf8', prueba: 'Retorno a cero después de presurización máxima', valorEsperado: 'Aguja retorna a cero sin quedarse desplazada, pegada o con oscilación permanente', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf9', prueba: 'Prueba de fuga a 250 mmHg durante 60 segundos', valorEsperado: 'Caída de presión ≤ 4 mmHg/min o criterio institucional, sin fuga audible en el sistema neumático', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf10', prueba: 'Prueba de fuga a 150 mmHg durante 60 segundos', valorEsperado: 'Presión estable, sin caída progresiva anormal ni variaciones por conectores o brazalete', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf11', prueba: 'Control de desinflado lento mediante válvula', valorEsperado: 'Permite descenso controlado aproximado de 2 a 3 mmHg/s para medición auscultatoria', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf12', prueba: 'Liberación rápida de presión', valorEsperado: 'Al abrir completamente la válvula, el sistema se despresuriza de forma rápida, completa y segura', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf13', prueba: 'Función antirretorno de la pera', valorEsperado: 'La pera insufla con respuesta uniforme, no retorna aire hacia la mano y no requiere fuerza excesiva', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf14', prueba: 'Integridad funcional de brazalete y cierre', valorEsperado: 'El brazalete no se abre ni se desplaza durante presurización a 200 mmHg y mantiene ajuste uniforme', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf15', prueba: 'Prueba de tubos y conectores durante movimiento suave', valorEsperado: 'No aparecen fugas intermitentes, desconexiones, acodamientos críticos ni cambios bruscos de presión', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf16', prueba: 'Legibilidad de escala, aguja y marcas del brazalete', valorEsperado: 'Lectura del dial y marcas de colocación/talla claramente visibles para el usuario clínico', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf17', prueba: 'Compatibilidad de brazalete con población atendida', valorEsperado: 'Talla y rango de circunferencia adecuados para el servicio; se documenta necesidad de brazaletes adicionales si aplica', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'alpkpf18', prueba: 'Limpieza, desinfección y secado final', valorEsperado: 'Equipo queda limpio, seco, sin residuos químicos ni humedad retenida en conexiones o brazalete', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf19', prueba: 'Rotulado de estado metrológico', valorEsperado: 'Etiqueta de mantenimiento/calibración vigente, legible y coherente con el registro en hoja de vida', resultado: ['Pasa', 'Falla'] },
        { id: 'alpkpf20', prueba: 'Criterio final de uso clínico', valorEsperado: 'Equipo apto si cumple cero, fuga, exactitud, brazalete, válvula y limpieza; retirar si incumple alguno crítico', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de manómetro, dial, cubierta, brazalete, tubos, pera, válvula, conectores y estuche/soporte',
        'Desinfección externa de superficies de contacto con producto compatible y secado completo',
        'Verificación visual del cero mecánico y retorno de aguja a cero',
        'Verificación metrológica contra patrón calibrado en puntos de 50, 100, 150, 200, 250 y 300 mmHg',
        'Prueba de estanqueidad del sistema neumático completo en presiones clínica y alta',
        'Verificación de válvula de liberación fina y liberación rápida de presión',
        'Revisión de brazalete, bolsa neumática, velcro, marca arterial, rango de circunferencia y talla',
        'Revisión de tubos, conectores, pera de insuflación y válvula antirretorno',
        'Ajuste externo de conexiones o reemplazo de accesorios consumibles deteriorados si aplica',
        'Rotulación de estado de mantenimiento/calibración y registro en hoja de vida del equipo',
        'Recomendación de calibración externa, cambio de brazalete/tubos/pera/válvula o retiro de servicio si no cumple tolerancia'
      ]
    },


    'tensiometro_riester_big_ben_round': {
      nombre: 'Tensiómetro Aneroide Riester Big Ben Round',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-RIESTER-BIGBEN',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el tensiómetro aneroide Riester Big Ben Round del uso clínico antes de iniciar el mantenimiento preventivo y confirme que no se esté utilizando en paciente.',
        'Realice limpieza externa previa conforme al protocolo institucional, evitando ingreso de líquidos al manómetro, válvula, pera, tubos o mecanismo interno.',
        'Use paño suave ligeramente humedecido con solución compatible; no sumerja el manómetro, brazalete, pera, tubos ni válvula de liberación de aire.',
        'Confirme disponibilidad de manómetro patrón calibrado o analizador de presión no invasiva, conectores en T, pera de insuflación, brazalete de tamaño adecuado, estetoscopio y herramienta básica para ajuste externo si aplica.',
        'La verificación de presión debe realizarse contra patrón calibrado y trazable, registrando al menos puntos de 0, 50, 100, 150, 200, 250 y 300 mmHg o los puntos definidos por metrología institucional.',
        'No exceda 300 mmHg durante pruebas rutinarias de usuario ni someta el equipo a sobrepresión innecesaria; cualquier prueba de resistencia o intervención interna debe ser realizada por personal técnico calificado.',
        'No desarme el mecanismo aneroide, diafragma, engranajes, aguja, válvula ni conexiones internas durante mantenimiento preventivo rutinario.',
        'Si la aguja no retorna a cero, se encuentra fuera de marcas de calibración, el equipo presenta fuga, brazalete deteriorado, válvula defectuosa, lectura fuera de tolerancia o daño físico, retire el equipo de servicio y gestione calibración/correctivo.',
        'Verifique que el brazalete corresponda al rango de circunferencia del paciente y que la marca arterial esté visible; el uso de brazalete inadecuado afecta la exactitud de la medición.',
        'El mantenimiento debe ser realizado por personal entrenado en tecnología biomédica o metrología, siguiendo el programa institucional y las recomendaciones del fabricante.'
      ],
      inspeccion: [
        { id: 'rbbri1', item: 'Carcasa del manómetro circular íntegra, sin fisuras, golpes, deformaciones, partes sueltas, corrosión, humedad ni evidencia de intervención no autorizada' },
        { id: 'rbbri2', item: 'Dial amplio y escala 0-300 mmHg legibles, sin manchas, rayones críticos, empañamiento, aguja doblada, vibración excesiva ni desplazamiento de carátula' },
        { id: 'rbbri3', item: 'Aguja en reposo ubicada dentro de las marcas de calibración/cero definidas por el fabricante, sin quedar por encima o debajo del rango permitido' },
        { id: 'rbbri4', item: 'Soporte de pared, mesa, riel, pedestal o base móvil firme según configuración instalada, sin holguras, tornillos faltantes, inclinación inestable o riesgo de caída' },
        { id: 'rbbri5', item: 'Cesta o compartimento posterior para brazalete y tubos íntegro, limpio, sin bordes cortantes ni deformaciones que dañen accesorios' },
        { id: 'rbbri6', item: 'Brazalete de dos tubos íntegro, limpio, con velcro o sistema de cierre funcional, sin rasgaduras, costuras abiertas, contaminación, pérdida de elasticidad ni deformación' },
        { id: 'rbbri7', item: 'Marcas del brazalete legibles: tamaño, rango de circunferencia, posición arterial, indicador de látex/latex-free, lote o identificación cuando aplique' },
        { id: 'rbbri8', item: 'Bolsa neumática interna sin dobleces permanentes, perforaciones, fugas, endurecimiento, deformación o desplazamiento dentro del brazalete' },
        { id: 'rbbri9', item: 'Tubos de conexión flexibles, sin grietas, endurecimiento, aplastamiento, obstrucciones, fugas, reparaciones improvisadas ni desconexiones flojas' },
        { id: 'rbbri10', item: 'Conectores tipo Luer, bayoneta o empalmes firmes, limpios, sin fisuras, fugas, holgura ni adaptadores incompatibles' },
        { id: 'rbbri11', item: 'Pera de insuflación flexible y funcional, sin grietas, endurecimiento, pérdida de elasticidad, suciedad o válvula antirretorno defectuosa' },
        { id: 'rbbri12', item: 'Válvula de liberación de aire con ajuste fino, giro suave, sin bloqueo, fugas, pérdida de control ni salida brusca no controlada' },
        { id: 'rbbri13', item: 'Sistema neumático completo del manómetro, tubos, pera, válvula y brazalete sin fugas audibles ni caída de presión evidente' },
        { id: 'rbbri14', item: 'Etiquetas de marca Riester, modelo Big Ben Round, activo fijo, número de serie y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'rbbri15', item: 'Superficies externas limpias y secas, sin residuos de desinfectante, polvo, fluidos, adhesivos o material biológico' }
      ],
      verificacionBasica: [
        { id: 'rbbvb1', item: 'La aguja parte de cero y retorna a cero de forma estable al liberar completamente la presión' },
        { id: 'rbbvb2', item: 'El sistema permite insuflar el brazalete de forma progresiva hasta 300 mmHg sin esfuerzo excesivo, sin fuga audible y sin oscilaciones anormales de aguja' },
        { id: 'rbbvb3', item: 'La válvula de liberación permite descenso fino y controlado de presión, especialmente en el rango clínico de 180 a 40 mmHg' },
        { id: 'rbbvb4', item: 'La liberación rápida permite despresurizar el sistema de forma segura y completa al finalizar la medición o prueba' },
        { id: 'rbbvb5', item: 'El brazalete se ajusta firmemente en el simulador/brazo de prueba sin abrirse espontáneamente y sin desplazamiento de la bolsa neumática' },
        { id: 'rbbvb6', item: 'El manómetro mantiene lectura estable durante prueba de presión sostenida sin caída significativa atribuible a fugas' },
        { id: 'rbbvb7', item: 'Las mediciones comparadas contra patrón calibrado permanecen dentro de la tolerancia metrológica institucional/fabricante en los puntos evaluados' },
        { id: 'rbbvb8', item: 'No se observan saltos de aguja, fricción mecánica, lectura retardada, oscilación excesiva o ruido mecánico durante incremento y descenso de presión' },
        { id: 'rbbvb9', item: 'El soporte de instalación permite lectura frontal clara y segura por parte del usuario clínico, sin riesgo de caída del manómetro o accesorios' },
        { id: 'rbbvb10', item: 'El equipo queda limpio, seco, con brazalete y accesorios organizados y apto para uso o retiro según resultado final' }
      ],
      pruebasFuncionales: [
        { id: 'rbbpf1', prueba: 'Inspección de cero mecánico sin presión aplicada', valorEsperado: 'Aguja dentro de la marca de cero/calibración del dial y sin desplazamiento permanente', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf2', prueba: 'Presurización hasta 50 mmHg comparada con patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf3', prueba: 'Presurización hasta 100 mmHg comparada con patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf4', prueba: 'Presurización hasta 150 mmHg comparada con patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf5', prueba: 'Presurización hasta 200 mmHg comparada con patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf6', prueba: 'Presurización hasta 250 mmHg comparada con patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf7', prueba: 'Presurización hasta 300 mmHg comparada con patrón calibrado', valorEsperado: 'Diferencia dentro de ±3 mmHg o tolerancia metrológica institucional y sin sobrepasar el límite de escala', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf8', prueba: 'Prueba de histéresis/retorno descendente desde 300 a 150 mmHg', valorEsperado: 'Lectura descendente coherente con patrón, sin saltos de aguja ni retardo mecánico anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf9', prueba: 'Prueba de estanqueidad a 250 mmHg durante 60 segundos', valorEsperado: 'Caída de presión ≤ 4 mmHg/min o criterio institucional, sin fuga audible en pera, tubos, brazalete o conectores', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf10', prueba: 'Prueba de estanqueidad a 150 mmHg durante 60 segundos', valorEsperado: 'Caída de presión ≤ 4 mmHg/min o criterio institucional, sin caída progresiva anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf11', prueba: 'Control de desinflado lento mediante válvula', valorEsperado: 'Permite descenso controlado aproximado de 2 a 3 mmHg/s para medición auscultatoria', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf12', prueba: 'Liberación rápida de presión', valorEsperado: 'Al abrir completamente la válvula, el sistema se despresuriza de forma rápida, completa y segura', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf13', prueba: 'Función antirretorno de pera de insuflación', valorEsperado: 'La pera insufla de forma eficiente, no retorna aire hacia la mano y no requiere fuerza excesiva', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf14', prueba: 'Integridad funcional del brazalete y velcro/cierre', valorEsperado: 'El brazalete no se abre ni desplaza durante presurización a 200 mmHg y conserva ajuste uniforme', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf15', prueba: 'Prueba de tubos y conectores con movimiento suave', valorEsperado: 'No aparecen fugas intermitentes, desconexiones, acodamientos críticos ni cambios bruscos de presión', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf16', prueba: 'Legibilidad del dial a distancia normal de uso clínico', valorEsperado: 'Escala y aguja se leen claramente desde la posición de trabajo, sin obstrucciones ni reflejos críticos', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf17', prueba: 'Estabilidad del soporte de pared/mesa/riel/pedestal', valorEsperado: 'Manómetro y accesorios permanecen firmes durante uso simulado; no hay riesgo de caída o desprendimiento', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf18', prueba: 'Verificación de compatibilidad de brazaletes disponibles', valorEsperado: 'Brazaletes disponibles coinciden con población atendida y rangos de circunferencia requeridos; marcas legibles', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'rbbpf19', prueba: 'Limpieza y desinfección final', valorEsperado: 'Equipo queda limpio, seco, sin humedad retenida, sin residuos químicos y con accesorios organizados', resultado: ['Pasa', 'Falla'] },
        { id: 'rbbpf20', prueba: 'Registro metrológico y etiqueta de estado', valorEsperado: 'Se registra resultado, desviaciones, fecha, responsable y próxima calibración/verificación según programa institucional', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de manómetro, dial, soporte, brazalete, tubos, pera y válvula de liberación',
        'Desinfección externa de superficies de contacto con producto compatible y secado completo',
        'Verificación de cero mecánico y retorno de aguja a cero',
        'Verificación metrológica contra patrón calibrado en puntos de presión definidos',
        'Prueba de estanqueidad del sistema neumático completo',
        'Verificación de válvula de liberación fina y liberación rápida de presión',
        'Revisión de brazalete, bolsa neumática, velcro, marca arterial y rango de circunferencia',
        'Revisión de tubos, conectores, pera de insuflación y válvula antirretorno',
        'Ajuste externo de conexiones o reemplazo de accesorios consumibles deteriorados si aplica',
        'Rotulación de estado de mantenimiento/calibración y registro en hoja de vida del equipo',
        'Recomendación de calibración externa, cambio de brazalete/tubos/pera/válvula o retiro de servicio si no cumple tolerancia'
      ]
    },


    'pulso_oximetro_edan_h100b': {
      nombre: 'Pulso Oxímetro EDAN H100B',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-H100B',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el pulso oxímetro EDAN H100B del uso clínico y confirme que no esté conectado a ningún paciente antes de iniciar el mantenimiento preventivo.',
        'Realice limpieza y desinfección externa previa conforme al protocolo institucional, manteniendo el equipo apagado y retirando las baterías antes de limpiar o desinfectar.',
        'Utilice paño suave ligeramente humedecido con solución compatible; no sumerja el equipo, sensor, conectores ni cable y evite ingreso de líquidos al compartimento de baterías, pantalla, puerto de sensor o salida de comunicación.',
        'Confirme disponibilidad de simulador de SpO2/frecuencia de pulso o analizador de oximetría calibrado compatible con curvas EDAN/Nellcor/BCI según sensor disponible, baterías AA nuevas o recargables en buen estado, sensor SpO2 adulto/pediátrico/neonatal y cable de extensión si aplica.',
        'Tenga en cuenta que el simulador funcional se usa para verificar respuesta, alarmas, lectura y reproducción de curva; la exactitud clínica del sensor se confirma por el método y tolerancias definidos por el fabricante y el programa institucional.',
        'No abra la carcasa ni intervenga tarjeta principal, módulo SpO2, pantalla, conectores, firmware, puerto de comunicación o circuitos internos durante el mantenimiento preventivo rutinario.',
        'Las actualizaciones de software, reparaciones internas, reemplazo de tarjetas, conectores o fallas electrónicas deben ser realizadas por servicio técnico calificado o representante autorizado EDAN.',
        'Verifique que el entorno de prueba esté libre de interferencias electromagnéticas fuertes y que el sensor no reciba luz ambiental intensa directa durante las pruebas.',
        'Si se evidencian lecturas inestables, alarmas no funcionales, error POST, daño físico, sensor deteriorado, corrosión por baterías, pantalla defectuosa o falla de comunicación, retire el equipo de servicio y genere mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'h100bi1', item: 'Carcasa frontal y posterior íntegras, sin fisuras, golpes, deformaciones, partes sueltas, perforaciones, manchas químicas ni evidencia de ingreso de líquidos' },
        { id: 'h100bi2', item: 'Pantalla LCD con visualización clara de SpO2, frecuencia de pulso, onda pletismográfica, barra de pulso, estado de batería, alarmas e iconos sin líneas, manchas ni segmentos faltantes' },
        { id: 'h100bi3', item: 'Botón de encendido, tecla de función, flechas de navegación y silencio/alarma con respuesta adecuada, sin hundimiento, bloqueo ni falsos contactos' },
        { id: 'h100bi4', item: 'Puerto/conector del sensor SpO2 DB9 o compatible sin pines doblados, sulfatación, suciedad, holgura, fisuras ni conectores flojos' },
        { id: 'h100bi5', item: 'Sensor SpO2 reutilizable y cable/extensión íntegros, con ventana óptica limpia, pinza funcional, cable flexible, aislamiento sin peladuras ni cortes y conector firme' },
        { id: 'h100bi6', item: 'Cable de comunicación RS232/USB y puerto auxiliar disponibles e íntegros, si aplica al equipo instalado' },
        { id: 'h100bi7', item: 'Altavoz o buzzer audible, sin obstrucción por suciedad, adhesivos, líquidos o elementos externos' },
        { id: 'h100bi8', item: 'Compartimento de baterías limpio, sin sulfatación, humedad, deformación, resortes flojos, contactos oxidados ni tapa suelta' },
        { id: 'h100bi9', item: 'Baterías AA alcalinas o recargables Ni-MH en buen estado, sin fuga, corrosión, calentamiento, deformación ni vencimiento visible' },
        { id: 'h100bi10', item: 'Correa, funda, soporte o accesorios de transporte en buen estado, sin desprendimientos que comprometan el uso seguro' },
        { id: 'h100bi11', item: 'Etiquetas de marca EDAN, modelo H100B, número de serie, activo fijo, advertencias, IPX2 y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'h100bi12', item: 'Superficies externas limpias y secas, sin residuos de gel, adhesivos, fluidos, polvo o productos de limpieza acumulados' }
      ],
      verificacionBasica: [
        { id: 'h100bvb1', item: 'El equipo enciende correctamente, ejecuta prueba automática de encendido POST y no presenta errores persistentes de batería, tarjeta SpO2 o tarjeta principal' },
        { id: 'h100bvb2', item: 'La pantalla muestra los modos disponibles de onda pletismográfica y número grande, con SpO2, PR, barra de pulso, batería e iconos de alarma legibles' },
        { id: 'h100bvb3', item: 'Las teclas permiten navegar por menú, configuración de sistema, límites de alarma, tipo de paciente adulto/neonatal, volumen y almacenamiento según disponibilidad' },
        { id: 'h100bvb4', item: 'El sensor es reconocido al conectarse; ante sensor desconectado o caída del sensor se visualiza mensaje/ícono y se activa alarma técnica correspondiente' },
        { id: 'h100bvb5', item: 'El equipo detecta señal de pulso estable con simulador o prueba controlada, mostrando onda pletismográfica coherente y frecuencia de pulso estable' },
        { id: 'h100bvb6', item: 'Las alarmas alta/baja de SpO2 y PR se configuran, activan en pantalla y generan señal audible con opción de pausa/silencio según configuración permitida' },
        { id: 'h100bvb7', item: 'Indicador de batería y mensaje de batería baja se comportan de forma coherente; el equipo no se apaga ni reinicia durante la revisión con baterías en buen estado' },
        { id: 'h100bvb8', item: 'Tendencias, tabla/gráfica de tendencias y almacenamiento de datos se visualizan o acceden correctamente, si la configuración del equipo lo permite' },
        { id: 'h100bvb9', item: 'Transferencia de datos mediante cable RS232/USB o software de gestión se reconoce correctamente, si aplica al equipo y al programa institucional' },
        { id: 'h100bvb10', item: 'El equipo queda sin alarmas activas, limpio, con baterías instaladas correctamente y listo para uso o retiro según estado final' }
      ],
      pruebasFuncionales: [
        { id: 'h100bpf1', prueba: 'Encendido y autoprueba POST con baterías en buen estado', valorEsperado: 'Inicio completo sin códigos Error 01, Error 02, Error 03, reinicios, bloqueo de pantalla ni apagado espontáneo', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf2', prueba: 'Visualización en modo onda pletismográfica', valorEsperado: 'Se observa onda SpO2 estable, barra de pulso, valor SpO2, PR e iconos de estado legibles', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf3', prueba: 'Visualización en modo numérico grande', valorEsperado: 'Valores de SpO2 y PR se muestran en formato grande sin pérdida de segmentos ni error de pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf4', prueba: 'SpO2 simulada al 98% con perfusión normal', valorEsperado: 'Lectura 98% ± 2% o dentro de tolerancia del simulador/patrón institucional; señal estable', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf5', prueba: 'SpO2 simulada al 90%', valorEsperado: 'Lectura 90% ± 2% o dentro de tolerancia del simulador/patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf6', prueba: 'SpO2 simulada al 80% para condición de desaturación', valorEsperado: 'Lectura coherente y activación de alarma baja si el límite configurado corresponde', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf7', prueba: 'Frecuencia de pulso simulada a 60 bpm', valorEsperado: 'Lectura de PR 60 bpm ± 2 bpm o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf8', prueba: 'Frecuencia de pulso simulada a 120 bpm', valorEsperado: 'Lectura de PR 120 bpm ± 2 bpm o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf9', prueba: 'Frecuencia de pulso simulada a 180 bpm', valorEsperado: 'Lectura de PR 180 bpm ± 3 bpm o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf10', prueba: 'Alarma de SpO2 baja — Configurar límite bajo 90% y simular 85%', valorEsperado: 'Alarma visual y audible de SpO2 baja activa en tiempo oportuno', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf11', prueba: 'Alarma de SpO2 alta — Configurar límite alto según menú y simular valor superior', valorEsperado: 'Alarma visual y audible de SpO2 alta activa si el rango configurado lo permite', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'h100bpf12', prueba: 'Alarma de PR baja — Configurar límite bajo 50 bpm y simular 40 bpm', valorEsperado: 'Alarma visual y audible de PR baja activa', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf13', prueba: 'Alarma de PR alta — Configurar límite alto 120 bpm y simular 140 bpm', valorEsperado: 'Alarma visual y audible de PR alta activa', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf14', prueba: 'Sensor desconectado del equipo', valorEsperado: 'Mensaje o icono de sensor no conectado y alarma técnica correspondiente', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf15', prueba: 'Sensor retirado del dedo/simulador durante medición', valorEsperado: 'Mensaje de sensor fuera o pérdida de señal y alarma técnica correspondiente, sin mantener valores falsos persistentes', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf16', prueba: 'Silencio o pausa de alarma', valorEsperado: 'La pausa/silencio actúa según tiempo configurado y la alarma visual permanece identificable hasta corregir la condición', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf17', prueba: 'Volumen de alarma y volumen de pulso', valorEsperado: 'Permite ajustar niveles de audio y se escucha con intensidad suficiente para el entorno clínico', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf18', prueba: 'Tipo de paciente adulto/neonatal', valorEsperado: 'El menú permite seleccionar el tipo de paciente y conserva la configuración seleccionada', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf19', prueba: 'Tendencias de SpO2 y PR', valorEsperado: 'Muestra gráfica o tabla de tendencias disponibles sin bloqueo del equipo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'h100bpf20', prueba: 'Almacenamiento y transferencia de datos, si aplica', valorEsperado: 'El equipo entra en modo de transferencia o comunica con software/cable institucional sin error', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'h100bpf21', prueba: 'Indicador de batería', valorEsperado: 'El nivel de batería se muestra de forma coherente y no aparece alarma de batería baja con baterías nuevas/cargadas', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf22', prueba: 'Prueba con sensor y cable/extensión alterno compatible, si está disponible', valorEsperado: 'El equipo reconoce accesorios compatibles y mantiene lectura estable sin falsos contactos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'h100bpf23', prueba: 'Inspección de limpieza posterior y ausencia de humedad', valorEsperado: 'Equipo seco, sin residuos de desinfectante, sin humedad en pantalla, puerto de sensor o compartimento de baterías', resultado: ['Pasa', 'Falla'] },
        { id: 'h100bpf24', prueba: 'Verificación final de operación continua mínima de 5 minutos con señal estable', valorEsperado: 'Sin reinicios, apagados, pérdida intermitente de sensor, alarmas injustificadas ni desviación progresiva de lectura', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, pantalla, botones, puerto de sensor y superficies de contacto',
        'Desinfección externa del equipo y sensor SpO2 con producto compatible según protocolo institucional',
        'Retiro y revisión de baterías AA; limpieza visual del compartimento y contactos',
        'Verificación de encendido, autoprueba POST, pantalla, botones y navegación de menús',
        'Verificación funcional de SpO2 y frecuencia de pulso con simulador o método institucional',
        'Verificación de alarmas alta/baja de SpO2, alta/baja de PR, sensor desconectado y pérdida de señal',
        'Verificación de volumen de alarma, silencio/pausa y volumen de pulso',
        'Verificación de tendencias, almacenamiento y transferencia de datos si aplica',
        'Revisión de sensor SpO2, cable, extensión, conector y accesorios compatibles',
        'Recomendación de cambio de baterías, sensor, cable, tapa de batería o accesorios deteriorados',
        'Remisión a servicio técnico autorizado EDAN o proveedor especializado si se detectan fallas internas o errores POST'
      ]
    },


    'monitor_mindray_epm12': {
      nombre: 'Monitor de Signos Vitales Mindray ePM 12',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-EPM12',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el monitor Mindray ePM 12 del uso clínico y confirme que no esté conectado a ningún paciente antes de iniciar el mantenimiento preventivo.',
        'Realice limpieza y desinfección externa previa conforme al protocolo institucional, evitando ingreso de líquidos en pantalla, conectores, altavoz, registrador, ventilaciones, batería o fuente de alimentación.',
        'Confirme disponibilidad de simulador multiparámetro calibrado tipo Fluke ProSim 8, Rigel UNI-SIM, BC Biomedical o equivalente para ECG, RESP, SpO2, NIBP y temperatura.',
        'Utilice accesorios compatibles con la familia Mindray ePM: cable ECG 3/5 derivaciones, sensor SpO2, brazalete y manguera NIBP, sonda de temperatura, cable de alimentación, batería y módulos opcionales instalados.',
        'Conecte el equipo a red eléctrica hospitalaria con puesta a tierra y permita que complete la autoverificación de encendido antes de ejecutar pruebas funcionales.',
        'Seleccione correctamente la categoría de paciente adulto, pediátrico o neonatal antes de pruebas NIBP y alarmas; no use presiones o límites inadecuados para el tipo de paciente.',
        'No abra la carcasa ni intervenga fuente, batería, tarjetas, módulos internos, sensores, bomba NIBP, válvulas o software de servicio durante el mantenimiento preventivo rutinario.',
        'Las reparaciones, calibraciones internas, actualizaciones de software, ajustes de fábrica y pruebas de seguridad eléctrica especializadas deben ser realizadas por personal autorizado o servicio técnico calificado.',
        'No utilice cables ECG resistentes a electrobisturí para verificar respiración por impedancia, ya que pueden afectar la medición de RESP.',
        'Si se detectan fallas de alarmas, desviación de parámetros, fuga neumática, batería defectuosa, accesorios deteriorados, error de módulo, pantalla táctil no funcional o mensajes persistentes de hardware, retire el equipo de servicio y genere mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'epm12i1', item: 'Carcasa frontal, posterior, asa de transporte y cubiertas laterales íntegras, sin fisuras, golpes, deformaciones, partes sueltas ni signos de impacto' },
        { id: 'epm12i2', item: 'Pantalla táctil de 12 pulgadas aproximadas con imagen uniforme, brillo adecuado, sin manchas, líneas, parpadeo, pixeles defectuosos ni daño superficial' },
        { id: 'epm12i3', item: 'Superficie táctil, botón de encendido, controles físicos y accesos rápidos con respuesta adecuada, sin bloqueo, desgaste excesivo ni falsos contactos' },
        { id: 'epm12i4', item: 'Indicadores visuales, barra de alarmas y altavoz sin obstrucción, suciedad acumulada, pérdida de intensidad o baja audibilidad' },
        { id: 'epm12i5', item: 'Conector ECG y cable troncal de 3/5 derivaciones íntegros, sin pines doblados, sulfatación, cortes, peladuras ni falsos contactos' },
        { id: 'epm12i6', item: 'Electrodos, broches o pinzas ECG limpios, firmes y sin corrosión; accesorios vencidos o deteriorados retirados del servicio' },
        { id: 'epm12i7', item: 'Sensor SpO2, extensión y conector con ventana óptica limpia, pinza funcional, cable sin peladuras y lectura estable al conectar' },
        { id: 'epm12i8', item: 'Brazalete NIBP, manguera, conectores y acoples neumáticos sin fisuras, fugas, rigidez, obstrucción, desgaste del velcro ni conectores flojos' },
        { id: 'epm12i9', item: 'Canal o sonda de temperatura disponible, limpia, con aislamiento íntegro y conector firme, si aplica al equipo instalado' },
        { id: 'epm12i10', item: 'Módulos o puertos opcionales de CO2, IBP, gasto cardiaco, registrador, USB, red, llamada de enfermería o CMS sin daño, suciedad ni pines deformados, si aplican' },
        { id: 'epm12i11', item: 'Cable de alimentación, clavija, tierra física, fusibles accesibles y adaptador sin cortes, empalmes, calentamiento, corrosión ni aislamiento expuesto' },
        { id: 'epm12i12', item: 'Batería interna o removible sin deformación, fuga, sulfatación, sobrecalentamiento, hinchamiento ni mensaje persistente de falla o baja capacidad' },
        { id: 'epm12i13', item: 'Registrador térmico, tapa, rodillo, sensor de papel y papel correctamente instalados y sin residuos de papel, si aplica al equipo' },
        { id: 'epm12i14', item: 'Soporte mural, base rodante, brazo, riel, ruedas y frenos estables y seguros, si el monitor se encuentra instalado en soporte móvil' },
        { id: 'epm12i15', item: 'Etiquetas de activo fijo, número de serie, placa institucional, advertencias, voltaje, modelo ePM 12 y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'epm12i16', item: 'Superficies externas limpias y secas; sin residuos de gel, sangre, fluidos, adhesivos, polvo o productos químicos en ranuras y conectores' }
      ],
      verificacionBasica: [
        { id: 'epm12vb1', item: 'Enciende correctamente con alimentación AC, muestra logo Mindray y completa autoverificación inicial sin errores persistentes' },
        { id: 'epm12vb2', item: 'Pantalla principal visualiza los parámetros configurados: ECG, FC, RESP, SpO2, NIBP, temperatura, batería y alarmas según módulos instalados' },
        { id: 'epm12vb3', item: 'La pantalla táctil permite navegar por menú principal, configuración de paciente, límites de alarma, tendencias, NIBP, revisión de eventos y ajustes del sistema' },
        { id: 'epm12vb4', item: 'El monitor conmuta a batería al desconectar AC sin apagarse, reiniciarse ni perder configuración de monitoreo' },
        { id: 'epm12vb5', item: 'Indicador de alimentación, carga de batería, estado de batería y mensajes técnicos se visualizan correctamente en pantalla' },
        { id: 'epm12vb6', item: 'Fecha, hora, idioma, categoría de paciente, unidades, volumen de alarma y configuración institucional se encuentran correctos' },
        { id: 'epm12vb7', item: 'Alarmas fisiológicas y técnicas se visualizan en pantalla y generan señal audible; la función de silencio/pausa opera según configuración permitida' },
        { id: 'epm12vb8', item: 'Los conectores reconocen los accesorios al conectarlos y muestran mensajes adecuados ante desconexión de ECG, SpO2, NIBP, temperatura o módulos opcionales' },
        { id: 'epm12vb9', item: 'La bomba NIBP inicia y detiene medición desde la tecla o menú correspondiente sin ruidos anormales, sobrepresión, fuga u obstrucción' },
        { id: 'epm12vb10', item: 'El registro de tendencias, eventos, revisión histórica y almacenamiento de mediciones está disponible y conserva información coherente' },
        { id: 'epm12vb11', item: 'El registrador térmico imprime trazados y datos numéricos de forma legible, si aplica al equipo instalado' },
        { id: 'epm12vb12', item: 'La comunicación con central de monitoreo, red hospitalaria, HL7/eGateway o sistema institucional se encuentra operativa, si aplica a la configuración instalada' }
      ],
      pruebasFuncionales: [
        { id: 'epm12pf1', prueba: 'Encendido y autoprueba general con alimentación AC', valorEsperado: 'Inicialización completa sin mensajes de error persistentes, reinicios espontáneos ni bloqueo de pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf2', prueba: 'ECG: ritmo sinusal normal en derivación II con simulador a 80 BPM', valorEsperado: 'Frecuencia cardiaca 80 BPM ± 1 BPM y onda ECG estable sin pérdida de señal', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf3', prueba: 'ECG: amplitud de señal 1 mV en derivación II', valorEsperado: 'Visualización 1 mV ± 5% o calibración gráfica equivalente según pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf4', prueba: 'ECG: alarma de frecuencia cardiaca alta configurando límite 100 lpm y simulando 120 lpm', valorEsperado: 'Alarma alta de FC audible y visual activa en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf5', prueba: 'ECG: alarma de frecuencia cardiaca baja configurando límite 50 lpm y simulando 40 lpm', valorEsperado: 'Alarma baja de FC audible y visual activa en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf6', prueba: 'ECG: desconexión de derivación durante monitoreo activo', valorEsperado: 'Mensaje de derivación desconectada o alarma técnica en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf7', prueba: 'RESP: frecuencia respiratoria por impedancia simulada a 20 RPM', valorEsperado: 'Lectura 20 RPM ± 1 RPM y onda respiratoria estable', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf8', prueba: 'RESP: alarma de apnea o límite bajo mediante simulación sin respiración', valorEsperado: 'Alarma de apnea o RESP baja activa según configuración institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm12pf9', prueba: 'SpO2: saturación simulada al 98% con perfusión normal', valorEsperado: 'Lectura 98% ± 2% y pulso estable', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf10', prueba: 'SpO2: saturación simulada al 90%', valorEsperado: 'Lectura 90% ± 2%', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf11', prueba: 'SpO2: frecuencia de pulso simulada a 80 lpm', valorEsperado: 'Pulso 80 lpm ± 2 lpm', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf12', prueba: 'SpO2: alarma de desaturación con límite inferior 92% y simulación a 88%', valorEsperado: 'Alarma audible y visual de SpO2 baja activa', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf13', prueba: 'NIBP: presión sistólica simulada 120 mmHg', valorEsperado: 'Lectura sistólica 120 mmHg ± 3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf14', prueba: 'NIBP: presión diastólica simulada 80 mmHg', valorEsperado: 'Lectura diastólica 80 mmHg ± 3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf15', prueba: 'NIBP: presión media MAP en simulación 120/80 mmHg', valorEsperado: 'MAP aproximada 93 mmHg ± 3 mmHg', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf16', prueba: 'NIBP: prueba de fuga neumática a 150 mmHg durante 30 s', valorEsperado: 'Caída de presión ≤ 6 mmHg en 30 s o dentro del criterio institucional del patrón', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf17', prueba: 'NIBP: sobrepresión/seguridad neumática según simulador o prueba de servicio', valorEsperado: 'El sistema detiene inflado, despresuriza y no supera límites de seguridad configurados', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm12pf18', prueba: 'Temperatura: canal T1 con simulador resistivo a 37.0 °C', valorEsperado: 'Lectura 37.0 °C ± 0.1 °C o tolerancia definida por patrón institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm12pf19', prueba: 'Temperatura: desconexión de sonda durante monitoreo', valorEsperado: 'Mensaje técnico de sonda desconectada o lectura inválida sin valores falsos persistentes', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm12pf20', prueba: 'IBP opcional: presión invasiva simulada a 0 y 120 mmHg, si el módulo está instalado', valorEsperado: 'Cero correcto y lectura 120 mmHg ± 2 mmHg o según tolerancia del módulo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm12pf21', prueba: 'CO2 opcional: capnografía simulada o gas patrón, si el módulo está instalado', valorEsperado: 'Lectura de EtCO2 dentro de tolerancia del patrón y onda capnográfica estable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm12pf22', prueba: 'Batería: operación al desconectar alimentación AC durante monitoreo ECG + SpO2', valorEsperado: 'El equipo permanece encendido, sin reinicio, con indicador de batería y alarma de alimentación coherentes', resultado: ['Pasa', 'Falla'] },
        { id: 'epm12pf23', prueba: 'Registrador térmico: impresión de trazo ECG y datos numéricos', valorEsperado: 'Impresión legible, avance uniforme, sin atascos, cortes, manchas ni pérdida de información', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm12pf24', prueba: 'Comunicación con central de monitoreo o red hospitalaria, si aplica', valorEsperado: 'Equipo visible en central, con identificación correcta y transmisión estable de parámetros activos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm12pf25', prueba: 'Seguridad eléctrica visual/instrumental: tierra, fuga de chasis y fuga paciente según disponibilidad de analizador', valorEsperado: 'Cumple criterio institucional/IEC 60601-1 para equipo médico; sin daño de cable, tierra o aislamiento', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de carcasa, pantalla táctil, botones, conectores y superficie de trabajo',
        'Verificación de encendido, autoprueba, pantalla táctil, alarmas, indicadores y navegación de menús',
        'Verificación funcional de ECG, RESP, SpO2, NIBP y temperatura con simulador multiparámetro calibrado',
        'Verificación de módulos opcionales IBP, CO2, registrador térmico, red o central de monitoreo, si aplican',
        'Prueba de fuga neumática y funcionamiento de bomba/válvulas NIBP',
        'Verificación de batería, conmutación AC/batería e indicador de carga',
        'Ajuste de fecha, hora, idioma, categoría de paciente, límites de alarma y configuración institucional',
        'Cambio de papel térmico, electrodos, brazalete, manguera, sensor SpO2, cable ECG o sonda de temperatura cuando se encuentren deteriorados',
        'Actualización de software o revisión de configuración de servicio, si aplica y está autorizada',
        'Remisión a mantenimiento correctivo o servicio técnico autorizado cuando se evidencien fallas de hardware, batería, NIBP, módulos, alarmas o desviación metrológica'
      ]
    },


    'lampara_calor_radiante_ningbo_david_hkn93b': {
      nombre: 'Lámpara de Calor Radiante Ningbo David HKN-93B',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-TERM-DAVID-HKN93B',
      frecuencia: ['Trimestral', 'Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire la lámpara de calor radiante Ningbo David HKN-93B del uso clínico y confirme que no esté siendo utilizada con paciente neonatal antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de EPP, paños suaves, solución de limpieza compatible, simulador/resistencia de sonda de piel si se dispone, termómetro patrón o analizador de incubadoras/cunas térmicas, probador de seguridad eléctrica, cronómetro y formato institucional.',
        'Desconecte el equipo de la red eléctrica antes de realizar limpieza externa, inspección de cable, fusibles, base, ruedas, módulo calefactor, paneles, colchón, cuna, porta suero o accesorios.',
        'No toque el elemento calefactor, reflector, rejilla protectora o superficies cercanas hasta confirmar que se encuentren frías; existe riesgo de quemadura después del funcionamiento.',
        'No cubra el módulo calefactor, sensor de piel, rejillas, ventilaciones ni componentes de disipación durante las pruebas; mantenga el área libre de campos, líquidos y materiales inflamables.',
        'Use la sonda de piel compatible, correctamente conectada y fijada durante pruebas en modo bebé; no utilice el modo bebé si la sonda está dañada, desconectada o fuera de tolerancia.',
        'No abra el controlador, tarjetas electrónicas, fuente, módulo de potencia, relés, calefactor o conexiones internas durante mantenimiento preventivo rutinario; la intervención interna debe realizarla personal técnico calificado.',
        'Verifique que la cuna, barandas/paneles, base, ruedas y frenos estén estables antes de energizar el equipo; no realice pruebas si existe riesgo de volcamiento, caída o atrapamiento.',
        'Si se evidencian alarmas críticas, error de sonda, falla de calefacción, sobretemperatura, potencia inestable, cable dañado, fusible recurrente, olor a quemado, chispa, falla de frenos o estructura insegura, retire el equipo de servicio y remita a correctivo especializado.',
      ],
      inspeccion: [
        { id: 'hkn93b_i1', item: 'Módulo calefactor/cabezal radiante íntegro, firmemente fijado, sin golpes, fisuras, deformación, partes sueltas, corrosión, suciedad, manchas por calor o evidencia de apertura no autorizada' },
        { id: 'hkn93b_i2', item: 'Reflector, rejilla protectora y elemento calefactor limpios, sin obstrucciones, deformación, desprendimiento, rotura, oxidación, acumulación de polvo o material combustible' },
        { id: 'hkn93b_i3', item: 'Ángulo/orientación del cabezal radiante ajusta y bloquea correctamente, sin juego excesivo, caída espontánea, ruido mecánico o riesgo de desplazamiento durante la atención' },
        { id: 'hkn93b_i4', item: 'Panel de control, display de temperatura establecida y temperatura del bebé, teclado, indicadores y alarmas visibles, legibles y sin teclas hundidas o fisuradas' },
        { id: 'hkn93b_i5', item: 'Sonda de temperatura de piel, cable y conector íntegros, limpios, sin cortes, dobleces permanentes, sulfatación, pines dañados, falso contacto o adhesivos deteriorados' },
        { id: 'hkn93b_i6', item: 'Cuna/bandeja, colchón, superficie de apoyo y paneles laterales limpios, íntegros, sin fisuras, bordes cortantes, deformaciones, desgaste, humedad o riesgo de atrapamiento' },
        { id: 'hkn93b_i7', item: 'Mecanismo de inclinación de la cuna funcional y seguro, sin holguras, bloqueo deficiente, movimientos bruscos o inclinación no controlada' },
        { id: 'hkn93b_i8', item: 'Base, columna, tornillería, soportes, porta suero, bandejas/accesorios y uniones estructurales firmes, sin corrosión, piezas faltantes o inestabilidad' },
        { id: 'hkn93b_i9', item: 'Ruedas giran libremente, sin desgaste crítico; frenos bloquean de manera efectiva y mantienen el equipo inmóvil durante las pruebas' },
        { id: 'hkn93b_i10', item: 'Cable de alimentación, clavija, entrada de red, alivio de tensión y fusibles externos sin cortes, empalmes, quemaduras, pines flojos, humedad o conductor expuesto' },
        { id: 'hkn93b_i11', item: 'Conexión equipotencial/tierra funcional visualmente, sin adaptadores improvisados, eliminación del pin de tierra o multitomas no autorizadas' },
        { id: 'hkn93b_i12', item: 'Temporizador APGAR, luz de observación/fototerapia si aplica, conector RS232 o accesorios adicionales presentes sin daño visible' },
        { id: 'hkn93b_i13', item: 'Superficies externas limpias y desinfectadas, sin residuos orgánicos, polvo, adhesivos innecesarios, sustancias corrosivas o restos de líquidos' },
        { id: 'hkn93b_i14', item: 'Etiquetas de marca Ningbo David, modelo HKN-93B, serial, activo fijo, advertencias, voltaje, potencia y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'hkn93b_i15', item: 'No se evidencian reparaciones improvisadas, cables adaptados, piezas no originales, alteraciones de seguridad, bloqueo de alarmas o modificaciones no autorizadas' },
      ],
      verificacionBasica: [
        { id: 'hkn93b_vb1', item: 'Al conectar a toma hospitalaria con tierra, el equipo energiza sin chispas, olor a quemado, ruido anormal, reinicios o calentamiento del cable/clavija' },
        { id: 'hkn93b_vb2', item: 'El autodiagnóstico inicial, displays, indicadores luminosos y señal audible funcionan sin códigos de error activos' },
        { id: 'hkn93b_vb3', item: 'El equipo permite seleccionar modo precalentamiento, modo manual y modo bebé/servo según configuración del modelo, sin bloqueo de teclado o fallas de selección' },
        { id: 'hkn93b_vb4', item: 'La temperatura establecida y la temperatura medida se visualizan de forma separada y coherente durante la prueba' },
        { id: 'hkn93b_vb5', item: 'La potencia/calor radiante aumenta y disminuye de forma controlada en modo manual, sin interrupciones inesperadas ni sobrecalentamiento evidente' },
        { id: 'hkn93b_vb6', item: 'La sonda de piel es reconocida por el equipo; al desconectarla o simular falla se genera alarma visual/audible correspondiente' },
        { id: 'hkn93b_vb7', item: 'El temporizador APGAR, alarma de energía, alarma de sobretemperatura y silenciamiento/restablecimiento de alarmas responden de manera funcional cuando aplica' },
        { id: 'hkn93b_vb8', item: 'Cuna, paneles, inclinación, ruedas, frenos y accesorios quedan seguros, limpios y listos para uso clínico después de la verificación' },
      ],
      pruebasFuncionales: [
        { id: 'hkn93b_pf1', prueba: 'Alimentación principal — Conectar a toma hospitalaria con tierra y encender el equipo', valorEsperado: 'Encendido correcto, autoprueba sin error, displays e indicadores activos, sin ruido, olor, chispa o reinicio', resultado: ['Pasa', 'Falla'] },
        { id: 'hkn93b_pf2', prueba: 'Modo precalentamiento — Seleccionar Pre-warm y observar respuesta del cabezal radiante', valorEsperado: 'El equipo entrega calentamiento inicial controlado para preparación de la cuna, sin alarmas ni sobretemperatura', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hkn93b_pf3', prueba: 'Modo manual — Seleccionar potencia baja/media/alta según disponibilidad del panel', valorEsperado: 'La indicación de potencia cambia de forma progresiva y el calor radiante responde de manera estable', resultado: ['Pasa', 'Falla'] },
        { id: 'hkn93b_pf4', prueba: 'Modo bebé/servo — Conectar sonda de piel y seleccionar temperatura de control neonatal segura', valorEsperado: 'El equipo reconoce la sonda, muestra temperatura medida y regula el calentamiento según consigna', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hkn93b_pf5', prueba: 'Verificación de sonda de piel — Comparar lectura con patrón/simulador o termómetro de referencia institucional', valorEsperado: 'Lectura estable y dentro de tolerancia institucional; referencia técnica de sensor de piel del fabricante aproximadamente ±0,2 °C', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hkn93b_pf6', prueba: 'Alarma de sonda desconectada — Desconectar la sonda durante modo bebé/servo', valorEsperado: 'Se activa alarma visual/audible de falla o desconexión de sensor y el equipo pasa a condición segura', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hkn93b_pf7', prueba: 'Alarma de sobretemperatura — Verificar circuito mediante simulador o prueba permitida por el manual/ingeniería clínica', valorEsperado: 'La alarma se activa cuando se supera el umbral definido, con indicación visual/audible y control seguro de calentamiento', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hkn93b_pf8', prueba: 'Alarma de falla de calefacción — Observar estabilidad del calentador durante prueba de calentamiento', valorEsperado: 'No aparecen alarmas de circuito de calor; la salida térmica es estable y controlada', resultado: ['Pasa', 'Falla'] },
        { id: 'hkn93b_pf9', prueba: 'Alarma de energía — Desconectar brevemente la alimentación bajo condición segura o aplicar prueba institucional', valorEsperado: 'El equipo genera indicación/alarma de falla de energía según diseño y recupera funcionamiento al reconectar', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hkn93b_pf10', prueba: 'Temporizador APGAR — Activar temporizador y verificar señales en tiempos programados', valorEsperado: 'Temporizador cuenta correctamente y emite aviso audible/visual según configuración del equipo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hkn93b_pf11', prueba: 'Uniformidad térmica sobre colchón — Medir temperatura en puntos de referencia con equipo patrón si se dispone', valorEsperado: 'Distribución térmica homogénea y dentro del criterio institucional; referencia de uniformidad de colchón de la serie HKN-93: ≤2 °C', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hkn93b_pf12', prueba: 'Irradiancia/calor radiante — Verificar respuesta del cabezal con analizador o método institucional', valorEsperado: 'Salida de radiación/calor presente, estable y coherente con el nivel de potencia seleccionado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hkn93b_pf13', prueba: 'Ángulo del módulo radiante — Ajustar posiciones disponibles del cabezal', valorEsperado: 'El cabezal se orienta y queda fijo sin caída, bloqueo deficiente ni interferencia con la atención o radiografía', resultado: ['Pasa', 'Falla'] },
        { id: 'hkn93b_pf14', prueba: 'Inclinación de cuna — Ajustar inclinación permitida y regresar a posición horizontal', valorEsperado: 'Mecanismo suave, estable, con bloqueo seguro y sin desplazamiento no controlado', resultado: ['Pasa', 'Falla'] },
        { id: 'hkn93b_pf15', prueba: 'Paneles/barandas — Abrir/cerrar o retirar/instalar paneles según diseño', valorEsperado: 'Paneles aseguran correctamente, sin holgura, fisura, bordes cortantes o riesgo de caída del neonato', resultado: ['Pasa', 'Falla'] },
        { id: 'hkn93b_pf16', prueba: 'Ruedas y frenos — Desplazar suavemente el equipo y bloquear frenos', valorEsperado: 'Desplazamiento controlado, ruedas sin atasco y frenos bloquean el movimiento de forma efectiva', resultado: ['Pasa', 'Falla'] },
        { id: 'hkn93b_pf17', prueba: 'Luz de observación/fototerapia integrada si aplica — Activar y verificar funcionamiento básico', valorEsperado: 'Enciende estable, sin parpadeo, ruido, sobrecalentamiento o daño visible en módulo/accesorios', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hkn93b_pf18', prueba: 'Comunicación RS232/salida de datos si aplica — Verificar puerto o indicador de disponibilidad', valorEsperado: 'Puerto íntegro y sin daño; prueba funcional de datos realizada si existe herramienta institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hkn93b_pf19', prueba: 'Seguridad eléctrica — Realizar prueba de tierra, fuga y aislamiento según programa institucional', valorEsperado: 'Cumple criterio institucional/IEC aplicable para equipo electromédico conectado a red', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hkn93b_pf20', prueba: 'Prueba final de operación — Operar el equipo en modo seleccionado durante observación funcional', valorEsperado: 'Funcionamiento estable, sin alarmas no justificadas, sin olor, ruido, reinicio, sobrecalentamiento o fallas mecánicas', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de módulo radiante, panel de control, cuna, colchón, paneles, base, columna, ruedas, frenos, cable de alimentación y accesorios según protocolo institucional',
        'Inspección física de cabezal radiante, reflector, elemento calefactor, rejilla, sonda de piel, display, teclado, cableado externo, estructura, barandas, inclinación, ruedas y frenos',
        'Verificación de encendido, autoprueba, visualización de temperatura establecida y temperatura del bebé, selección de modos Pre-warm, Manual y Baby/Servo cuando aplica',
        'Pruebas funcionales de calentamiento, regulación de potencia, lectura de sonda de piel, alarmas de sensor, sobretemperatura, energía, falla de calefacción y temporizador APGAR',
        'Revisión mecánica de orientación del cabezal, inclinación de cuna, paneles laterales, estabilidad estructural, accesorios y condiciones de movilidad/traslado',
        'Prueba de seguridad eléctrica visual e instrumental cuando aplique según programa institucional de tecnología biomédica',
        'Registro de hallazgos, mediciones disponibles, alarmas probadas, accesorios faltantes, necesidad de correctivo especializado y recomendación de retiro de servicio si aplica',
      ],
    },


    'lampara_cuello_cisne_welch_allyn_gs300': {
      nombre: 'Lámpara Cuello de Cisne Welch Allyn GS 300',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-ILUM-WA-GS300',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire la lámpara Welch Allyn GS 300 del uso clínico y confirme que no esté siendo utilizada durante procedimientos o atención de pacientes.',
        'Confirme disponibilidad de paños suaves, solución de limpieza compatible, luxómetro si se dispone, multímetro/probador de seguridad eléctrica si aplica, toma hospitalaria con tierra, EPP y formato de mantenimiento.',
        'Desconecte el cable de alimentación de la red eléctrica antes de realizar limpieza, inspección de cable, base, montaje, brazo flexible, caja de control o cualquier revisión externa.',
        'No abra la caja de control, cabezal LED, fuente interna, sensores, conexiones internas ni módulos electrónicos durante el mantenimiento preventivo rutinario; la lámpara no posee partes internas de servicio por el usuario.',
        'No sumerja el cabezal, cuello flexible, caja de control, cable de alimentación, sensor o base móvil; evite ingreso de líquido en uniones, ranuras, interruptores y conectores.',
        'Use el equipo dentro del rango de trabajo recomendado y evite exposición directa prolongada o a distancia menor a la indicada por el fabricante, especialmente sobre piel o tejidos sensibles.',
        'Verifique estabilidad del soporte de pared, mesa o base móvil antes de energizar; no cuelgue objetos del brazo, cabezal, caja de control o soporte.',
        'Si se evidencia cable roto, conductor expuesto, daño de tierra, base inestable, brazo flojo, cabezal fisurado, LED intermitente, sobrecalentamiento, olor a quemado, sensor inoperante o disminución crítica de iluminación, retire de servicio y remita a correctivo autorizado.',
      ],
      inspeccion: [
        { id: 'gs300_i1', item: 'Cabezal/luminaria LED íntegro, sin fisuras, golpes, deformaciones, partes sueltas, manchas internas, humedad, evidencia de apertura o daño por calor' },
        { id: 'gs300_i2', item: 'Lente/ventana de salida de luz limpia, transparente, sin rayaduras críticas, opacidad, residuos de limpieza, material biológico o desprendimiento' },
        { id: 'gs300_i3', item: 'Cuello de cisne/brazo flexible conserva posición, sin pérdida de rigidez, grietas, dobleces permanentes, ruidos, holgura excesiva o aislamiento deteriorado' },
        { id: 'gs300_i4', item: 'Caja de control sin golpes, fisuras, deformación, humedad, tornillos faltantes, sobrecalentamiento, olor anormal o evidencia de intervención no autorizada' },
        { id: 'gs300_i5', item: 'Sensor de encendido/apagado sin contacto limpio, libre de obstrucción, adhesivos, polvo o humedad que puedan alterar su respuesta' },
        { id: 'gs300_i6', item: 'Cable de alimentación de tres hilos, clavija, alivio de tensión y entrada de red sin cortes, empalmes, quemaduras, pines doblados, sulfatación o conductor expuesto' },
        { id: 'gs300_i7', item: 'Conexión a tierra, toma hospitalaria y adaptadores sin alteraciones; no se observan extensiones improvisadas, multitomas no autorizadas o eliminación del pin de tierra' },
        { id: 'gs300_i8', item: 'Base móvil si aplica estable, ruedas íntegras, frenos funcionales, mástil firme, tornillos completos y sin riesgo de volcamiento' },
        { id: 'gs300_i9', item: 'Soporte de pared/mesa si aplica firmemente anclado, sin tornillos flojos, fisuras, corrosión, deformación o movimiento excesivo' },
        { id: 'gs300_i10', item: 'Articulaciones, uniones mecánicas y puntos de fijación sin juego excesivo, piezas faltantes, desgaste, oxidación o riesgo de desprendimiento' },
        { id: 'gs300_i11', item: 'Superficies externas limpias y desinfectadas, sin polvo, adhesivos innecesarios, residuos orgánicos, sustancias corrosivas o acumulación de suciedad' },
        { id: 'gs300_i12', item: 'Etiquetas de marca Welch Allyn, modelo GS 300, número de activo, advertencias, voltaje y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'gs300_i13', item: 'Área de trabajo alrededor de la lámpara libre de obstáculos que impidan desconexión rápida del cable de alimentación o movimiento seguro del equipo' },
        { id: 'gs300_i14', item: 'No se evidencian reparaciones improvisadas, cinta aislante, amarres, pegantes, piezas no originales o modificaciones eléctricas/mecánicas no autorizadas' },
      ],
      verificacionBasica: [
        { id: 'gs300_vb1', item: 'Al conectar a red eléctrica hospitalaria, la lámpara no presenta chispas, ruido, olor a quemado, calentamiento anormal ni movimientos mecánicos inseguros' },
        { id: 'gs300_vb2', item: 'El sensor sin contacto responde al encendido y apagado con movimiento de la mano, sin requerir golpes, presión física o múltiples intentos repetidos' },
        { id: 'gs300_vb3', item: 'La salida de luz es estable, blanca, homogénea y suficiente para examen general, sin parpadeos, variaciones bruscas o zonas oscuras críticas' },
        { id: 'gs300_vb4', item: 'El cuello de cisne permite orientar el haz hacia el área de trabajo y mantiene la posición seleccionada durante la prueba' },
        { id: 'gs300_vb5', item: 'La base móvil o el soporte de pared/mesa mantiene el equipo estable durante desplazamiento, orientación, encendido y apagado' },
        { id: 'gs300_vb6', item: 'El cable de alimentación permite conexión segura y desconexión rápida, sin tensión excesiva sobre la caja de control o el tomacorriente' },
        { id: 'gs300_vb7', item: 'Después de limpieza y secado, el equipo continúa funcionando normalmente y no se evidencia ingreso de líquido' },
        { id: 'gs300_vb8', item: 'El equipo queda identificado, limpio, armado y ubicado en condiciones seguras para uso clínico' },
      ],
      pruebasFuncionales: [
        { id: 'gs300_pf1', prueba: 'Alimentación principal — Conectar el equipo a toma hospitalaria con tierra verificada', valorEsperado: 'Equipo energiza sin chispas, ruido, olor anormal, falso contacto, calentamiento o interrupciones', resultado: ['Pasa', 'Falla'] },
        { id: 'gs300_pf2', prueba: 'Encendido sin contacto — Activar el sensor de proximidad con movimiento de la mano', valorEsperado: 'La lámpara enciende de forma inmediata y reproducible sin contacto físico directo', resultado: ['Pasa', 'Falla'] },
        { id: 'gs300_pf3', prueba: 'Apagado sin contacto — Activar nuevamente el sensor de proximidad', valorEsperado: 'La lámpara apaga completamente, sin quedar intermitente ni encendida parcialmente', resultado: ['Pasa', 'Falla'] },
        { id: 'gs300_pf4', prueba: 'Estabilidad del LED — Mantener encendida durante prueba funcional de observación', valorEsperado: 'Luz blanca estable, sin parpadeo, caída de intensidad, apagado súbito ni variación visible', resultado: ['Pasa', 'Falla'] },
        { id: 'gs300_pf5', prueba: 'Intensidad luminosa — Verificar visualmente o con luxómetro a distancia de trabajo definida por la institución', valorEsperado: 'Iluminación suficiente para examen general; referencia técnica aproximada del fabricante: 20.000 lux a distancia típica de trabajo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'gs300_pf6', prueba: 'Distancia de trabajo — Orientar la lámpara dentro del rango recomendado para examen', valorEsperado: 'Haz útil en el área de trabajo, sin exposición excesiva a distancias inadecuadas ni molestias por calor', resultado: ['Pasa', 'Falla'] },
        { id: 'gs300_pf7', prueba: 'Tamaño y uniformidad del haz — Proyectar sobre superficie clara a distancia de trabajo', valorEsperado: 'Punto de iluminación uniforme, sin sombras críticas, manchas, obstrucciones o desviación del cabezal', resultado: ['Pasa', 'Falla'] },
        { id: 'gs300_pf8', prueba: 'Cuello de cisne — Posicionar arriba, abajo, lateral y diagonalmente', valorEsperado: 'El brazo se mueve suavemente y mantiene la posición sin caída, vibración excesiva o retorno espontáneo', resultado: ['Pasa', 'Falla'] },
        { id: 'gs300_pf9', prueba: 'Base móvil si aplica — Desplazar corta distancia, bloquear frenos y orientar la lámpara', valorEsperado: 'Ruedas giran libremente, frenos bloquean, mástil permanece estable y no hay riesgo de volcamiento', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'gs300_pf10', prueba: 'Soporte pared/mesa si aplica — Aplicar movimiento suave durante orientación', valorEsperado: 'Soporte permanece firme, sin holgura, desplazamiento, fisuras o desprendimiento', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'gs300_pf11', prueba: 'Cable y alivio de tensión — Mover suavemente cable y clavija durante operación', valorEsperado: 'No se presentan apagados, intermitencias, chispas, calentamiento, falsos contactos ni tensión mecánica crítica', resultado: ['Pasa', 'Falla'] },
        { id: 'gs300_pf12', prueba: 'Calentamiento — Operar la lámpara durante la prueba y palpar externamente zonas no luminosas', valorEsperado: 'Funcionamiento frío/templado esperado, sin sobrecalentamiento de caja de control, cable, clavija, brazo o cabezal', resultado: ['Pasa', 'Falla'] },
        { id: 'gs300_pf13', prueba: 'Limpieza compatible — Limpiar caja de control y superficies externas con agente aprobado y paño húmedo', valorEsperado: 'Equipo queda limpio y seco, sin afectación de sensor, lente, adhesivos, cable o funcionamiento eléctrico', resultado: ['Pasa', 'Falla'] },
        { id: 'gs300_pf14', prueba: 'Lente/cabezal — Limpiar con paño húmedo y detergente suave evitando alcohol si aplica a la manga/enfoque', valorEsperado: 'Salida de luz clara, sin opacidad, manchas, líquido retenido o daño por agente químico no compatible', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'gs300_pf15', prueba: 'Seguridad eléctrica visual — Revisar clavija, tierra, cable, caja, soporte y ausencia de adaptaciones', valorEsperado: 'Sin conductor expuesto, fisuras, quemaduras, toma floja, eliminación de tierra o riesgo eléctrico visible', resultado: ['Pasa', 'Falla'] },
        { id: 'gs300_pf16', prueba: 'Prueba instrumental de seguridad eléctrica si aplica — Medir continuidad de tierra/corriente de fuga según programa institucional', valorEsperado: 'Resultados dentro de límites definidos por norma/protocolo institucional y equipo apto para uso', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'gs300_pf17', prueba: 'Prueba final operativa — Encender, orientar al campo de examen, apagar y dejar en posición segura', valorEsperado: 'Lámpara funcional, estable, limpia, identificada, con cable ordenado y sin observaciones críticas', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de cabezal LED, cuello de cisne, caja de control, cable, clavija, base móvil o soporte de pared/mesa según aplique',
        'Inspección física de lente, brazo flexible, sensor sin contacto, caja de control, cable de alimentación, clavija, tierra, anclajes, ruedas, frenos y etiquetas',
        'Verificación de encendido y apagado mediante sensor de proximidad, estabilidad de luz, orientación del haz y conservación de posición del cuello flexible',
        'Prueba funcional de iluminación, uniformidad del haz, distancia de trabajo, estabilidad mecánica, base móvil/soporte y ausencia de sobrecalentamiento',
        'Revisión de seguridad eléctrica visual e instrumental cuando aplique según programa institucional',
        'Registro de hallazgos, accesorios o piezas con desgaste, condición de base/soporte, necesidad de correctivo y recomendación de retiro de servicio si aplica',
      ],
    },


    'equipo_organos_welch_allyn_767': {
      nombre: 'Equipo de Órganos Welch Allyn 767',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-DIAG-WA-767',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el equipo de órganos Welch Allyn 767 del uso clínico y confirme que no esté siendo utilizado con paciente antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de otoscopio, oftalmoscopio, mangos de 3,5 V, transformador de pared 767, cable de alimentación hospitalario, espéculos desechables/de prueba, paños suaves, solución de limpieza compatible, luxómetro o verificador visual de iluminación si se dispone, multímetro y EPP.',
        'Desconecte el sistema de la red eléctrica antes de inspeccionar cableado, soportes, módulos, conectores, compartimientos o antes de realizar limpieza externa.',
        'Use únicamente cable de alimentación de grado hospitalario, mangos, cabezales, lámparas y accesorios compatibles Welch Allyn para sistema 3,5 V modelo 767.',
        'No exceda el uso continuo recomendado de los mangos/cabezales durante pruebas de iluminación; permita enfriamiento si se evidencia calentamiento excesivo.',
        'No sumerja el transformador, mangos, cabezales, conectores ni cable espiralado; evite ingreso de líquido en receptáculos, ranuras, interruptores, reóstatos o contactos eléctricos.',
        'No abra el transformador de pared, fuente interna, fusibles, tarjetas, módulo de reloj, contactos internos o circuitos durante mantenimiento preventivo rutinario; las reparaciones internas deben ser realizadas por personal autorizado.',
        'Si se evidencian daño eléctrico, fusible abierto, luz piloto apagada con red presente, sobrecalentamiento, olor a quemado, mango flojo, cable espiralado deteriorado, iluminación inestable o falla de cabezal, retire el equipo de servicio y remita a correctivo especializado.',
      ],
      inspeccion: [
        { id: 'wa767_i1', item: 'Transformador de pared 767 firmemente instalado, sin desprendimiento del soporte, golpes, fisuras, deformaciones, humedad interna o evidencia de apertura no autorizada' },
        { id: 'wa767_i2', item: 'Cable de alimentación hospitalario, clavija, entrada de red y alivio de tensión sin cortes, empalmes, quemaduras, pines flojos, sulfatación o conductor expuesto' },
        { id: 'wa767_i3', item: 'Luz piloto/indicador verde de alimentación visible y funcional cuando el sistema está conectado a red eléctrica' },
        { id: 'wa767_i4', item: 'Receptáculos de mangos, bases de carga/soportes y contactos eléctricos limpios, alineados, sin corrosión, holgura, pines hundidos, chispazos o residuos' },
        { id: 'wa767_i5', item: 'Mangos de 3,5 V identificados, firmes, sin fisuras, deformaciones, recalentamiento, piezas sueltas, contactos contaminados o deterioro del acabado' },
        { id: 'wa767_i6', item: 'Cables espiralados de los mangos íntegros, elásticos, sin cortes, peladuras, empalmes, zonas rígidas, tracción excesiva ni falso contacto al moverlos suavemente' },
        { id: 'wa767_i7', item: 'Reóstato/control de intensidad de cada mango con movimiento suave, sin atascamiento, juego excesivo, zonas muertas o pérdida de respuesta' },
        { id: 'wa767_i8', item: 'Cabezal de otoscopio limpio, acople firme al mango, ventana/lente sin fisuras, puerto de espéculo íntegro, sin obstrucción ni piezas sueltas' },
        { id: 'wa767_i9', item: 'Cabezal de oftalmoscopio limpio, acople firme al mango, lentes/ventanas sin manchas críticas, disco de aperturas y filtros con giro funcional' },
        { id: 'wa767_i10', item: 'Lámparas/bombillos LED o halógenos compatibles, correctamente instalados, sin ennegrecimiento, filamento roto, parpadeo, baja intensidad o contacto flojo' },
        { id: 'wa767_i11', item: 'Especuloscopio, dispensador de espéculos o accesorios disponibles limpios, íntegros y compatibles cuando apliquen' },
        { id: 'wa767_i12', item: 'Superficies externas limpias y desinfectadas, sin polvo, residuos orgánicos, adhesivos, óxido, restos de limpieza o sustancias que afecten uso clínico' },
        { id: 'wa767_i13', item: 'Etiquetas de marca Welch Allyn, modelo/ref. 767, serial, activo fijo, voltaje, advertencias y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'wa767_i14', item: 'Módulo de reloj, tercer mango, dispensador o accesorios adicionales si existen firmes, limpios y sin daño visible' },
        { id: 'wa767_i15', item: 'Puntos de fijación a pared, tornillos, base y canalización de cableado sin holgura, bordes cortantes, humedad, suciedad o riesgo de caída' },
      ],
      verificacionBasica: [
        { id: 'wa767_vb1', item: 'Al conectar a red eléctrica hospitalaria, el indicador de alimentación se ilumina y no se presentan ruidos, olor a quemado, chispas o calentamiento anormal' },
        { id: 'wa767_vb2', item: 'Cada mango enciende al retirarlo o activarlo según configuración del sistema y apaga correctamente al retornarlo al soporte' },
        { id: 'wa767_vb3', item: 'El control de intensidad de cada mango regula la iluminación de mínimo a máximo de forma progresiva y sin parpadeo' },
        { id: 'wa767_vb4', item: 'El cabezal de otoscopio acopla firmemente, ilumina de forma homogénea y permite visualización clara a través de la ventana/lente' },
        { id: 'wa767_vb5', item: 'El cabezal de oftalmoscopio acopla firmemente, ilumina de forma adecuada y permite selección de aperturas/filtros disponibles' },
        { id: 'wa767_vb6', item: 'Los cables espiralados permiten extensión y retorno sin cortes de iluminación, falso contacto o tracción excesiva sobre el transformador' },
        { id: 'wa767_vb7', item: 'Los soportes retienen los mangos adecuadamente y no permiten caída accidental durante extracción o retorno' },
        { id: 'wa767_vb8', item: 'El equipo queda limpio, seco, armado y con accesorios disponibles para uso clínico después de la verificación' },
      ],
      pruebasFuncionales: [
        { id: 'wa767_pf1', prueba: 'Alimentación principal — Conectar el transformador 767 a toma hospitalaria verificada', valorEsperado: 'Indicador verde de red encendido, sin chispas, ruido, olor a quemado, reinicios o calentamiento anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767_pf2', prueba: 'Mango izquierdo — Retirar/activar mango y regular intensidad de mínimo a máximo', valorEsperado: 'Iluminación activa, regulación progresiva, sin parpadeo, apagado súbito o falso contacto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa767_pf3', prueba: 'Mango derecho — Retirar/activar mango y regular intensidad de mínimo a máximo', valorEsperado: 'Iluminación activa, regulación progresiva, sin parpadeo, apagado súbito o falso contacto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa767_pf4', prueba: 'Tercer mango/módulo adicional si aplica — Activar y regular intensidad', valorEsperado: 'Funciona correctamente con módulo compatible Welch Allyn 767, sin calentamiento ni error', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa767_pf5', prueba: 'Cable espiralado — Extender suavemente cada cable mientras el mango permanece encendido', valorEsperado: 'No hay cortes de luz, intermitencias, chispas, ruidos ni pérdida de continuidad visible', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767_pf6', prueba: 'Retorno a soporte — Colocar cada mango en su base después de encenderlo', valorEsperado: 'El mango queda retenido de forma segura y apaga/queda en reposo según diseño del sistema', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767_pf7', prueba: 'Otoscopio — Acoplar cabezal al mango, instalar espéculo de prueba y verificar iluminación', valorEsperado: 'Acople firme, iluminación homogénea, lente/ventana clara y sin sombras críticas u oscilación', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa767_pf8', prueba: 'Oftalmoscopio — Acoplar cabezal al mango y revisar aperturas/filtros/lentes disponibles', valorEsperado: 'Iluminación estable, disco de aperturas funcional y visualización clara sin obstrucción', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa767_pf9', prueba: 'Intensidad luminosa comparativa — Comparar luz de cada mango/cabezal con patrón institucional o verificación visual', valorEsperado: 'Intensidad suficiente para examen clínico, sin diferencia marcada entre mangos ni lámpara degradada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa767_pf10', prueba: 'Calentamiento — Operar cada mango/cabezal durante prueba corta respetando uso intermitente', valorEsperado: 'Temperatura externa aceptable, sin olor, decoloración, apagado térmico o incomodidad al tacto', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767_pf11', prueba: 'Contactos eléctricos — Mover suavemente cabezal y mango durante operación', valorEsperado: 'No se presenta intermitencia de luz, ruido eléctrico, falso contacto o apagado inesperado', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767_pf12', prueba: 'Limpieza/desinfección — Limpiar superficies externas y verificar secado posterior', valorEsperado: 'Equipo queda limpio, seco, sin ingreso de líquido y mantiene operación normal', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767_pf13', prueba: 'Seguridad eléctrica visual — Inspeccionar red, clavija, cable, tierra, carcasa y partes accesibles', valorEsperado: 'Sin conductor expuesto, fisuras, quemaduras, toma floja ni alteraciones de conexión a tierra', resultado: ['Pasa', 'Falla'] },
        { id: 'wa767_pf14', prueba: 'Prueba instrumental de seguridad eléctrica si aplica — Realizar corriente de fuga/continuidad de tierra según programa metrológico institucional', valorEsperado: 'Resultados dentro de límites definidos por norma/protocolo institucional y equipo apto para uso', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa767_pf15', prueba: 'Reloj/accesorio adicional si aplica — Verificar operación básica y batería del reloj', valorEsperado: 'Reloj visible y funcional; si la batería está agotada se documenta reemplazo por personal autorizado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa767_pf16', prueba: 'Prueba final operativa — Dejar transformador conectado, mangos en soporte y cabezales/accesorios organizados', valorEsperado: 'Sistema limpio, identificado, fijo a pared, con mangos funcionales y sin observaciones críticas', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa del transformador de pared, mangos, cables espiralados, soportes, cabezales y accesorios compatibles',
        'Inspección física de carcasa, instalación mural, cable de alimentación hospitalario, clavija, luz piloto, receptáculos, contactos, mangos, reóstatos y etiquetas',
        'Verificación de encendido, indicador de red, retención de mangos, activación/apagado y regulación de intensidad luminosa',
        'Prueba funcional de mangos de 3,5 V, cables espiralados, acople de cabezales, otoscopio, oftalmoscopio y accesorios disponibles',
        'Revisión de lámparas/bombillos, lentes, ventanas, disco de aperturas, espéculos/accesorios y condición de limpieza clínica',
        'Verificación de seguridad eléctrica visual e instrumental cuando aplique según programa institucional',
        'Registro de hallazgos, accesorios faltantes, necesidad de cambio de lámparas/cables/mangos/cabezales y recomendación de correctivo especializado si aplica',
      ],
    },


    'doppler_fetal_edan_sonotrax_basic_a': {
      nombre: 'Doppler Fetal EDAN SonoTrax Basic A',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-DOP-EDAN-BASIC-A',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el Doppler fetal EDAN SonoTrax Basic A del uso clínico y confirme que no esté en contacto con paciente antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de simulador de frecuencia cardíaca fetal/Doppler fetal o método de verificación funcional institucional, gel ecográfico, baterías AA recargables o alcalinas compatibles, cargador si aplica, paños suaves, solución de limpieza compatible y EPP.',
        'Verifique que la sonda obstétrica de 2 MHz o 3 MHz sea compatible con la serie SonoTrax y que el conector corresponda al equipo; no fuerce conectores ni use accesorios no autorizados.',
        'Antes de limpiar, apague el equipo y retire baterías si existe riesgo de ingreso de líquido; no sumerja la unidad principal ni permita ingreso de humedad al compartimento de baterías, altavoz, conectores o pantalla.',
        'La sonda impermeable puede limpiarse externamente según instrucciones del fabricante, evitando golpes, dobleces severos del cable, tracción del conector o uso de solventes agresivos.',
        'Use gel ecográfico compatible para la prueba funcional; no utilice aceites, cremas, alcohol directo sobre membrana de la sonda ni materiales que puedan degradarla.',
        'No abra la unidad principal, no intervenga tarjetas electrónicas, altavoz, pantalla, conector de sonda, módulo ultrasónico o circuito de carga durante el mantenimiento preventivo rutinario.',
        'Si se evidencian lectura inestable persistente, ausencia de audio Doppler, falla de pantalla, error de sonda, daño de cable, corrosión por baterías o desviación frente al simulador, retire el equipo de servicio y remita a correctivo especializado.',
      ],
      inspeccion: [
        { id: 'stba_i1', item: 'Carcasa de la unidad principal íntegra, sin grietas, golpes, deformaciones, humedad interna, piezas sueltas o evidencia de apertura no autorizada' },
        { id: 'stba_i2', item: 'Pantalla LCD visible, sin manchas, segmentos apagados, líneas, humedad, fisuras o pérdida de contraste que impida leer FHR, modo o batería' },
        { id: 'stba_i3', item: 'Teclas de encendido, modo, volumen, retroiluminación o funciones disponibles con respuesta táctil adecuada, sin atascamiento ni desgaste ilegible' },
        { id: 'stba_i4', item: 'Altavoz/rejilla de audio limpios, sin obstrucción, humedad, deformación o ruido mecánico visible' },
        { id: 'stba_i5', item: 'Compartimento de baterías, resortes, contactos y tapa sin corrosión, sulfatación, holgura, residuos de fuga, deformación o cierre inseguro' },
        { id: 'stba_i6', item: 'Baterías AA instaladas del tipo correcto, sin fuga, abombamiento, vencimiento, polaridad invertida o mezcla inadecuada de tecnologías/capacidades' },
        { id: 'stba_i7', item: 'Conector de sonda firme, limpio, sin pines doblados, sulfatación, holgura, humedad, fisuras o falso contacto al mover suavemente el cable' },
        { id: 'stba_i8', item: 'Sonda obstétrica 2 MHz o 3 MHz identificada, compatible, limpia y sin grietas, golpes, membrana deteriorada, desprendimiento o pérdida de sellado' },
        { id: 'stba_i9', item: 'Cable de la sonda continuo, flexible y sin cortes, peladuras, dobleces severos, tracción, empalmes, zonas endurecidas o blindaje expuesto' },
        { id: 'stba_i10', item: 'Etiqueta de frecuencia de la sonda, serial, modelo, marca EDAN/SonoTrax y advertencias legibles y coincidentes con inventario' },
        { id: 'stba_i11', item: 'Indicador de batería, iconos de modo, unidades BPM, símbolo de corazón y demás indicadores visibles durante encendido' },
        { id: 'stba_i12', item: 'Superficies externas limpias y desinfectadas, sin gel seco, residuos orgánicos, adhesivos, polvo o sustancias que afecten higiene o lectura' },
        { id: 'stba_i13', item: 'Funda, soporte, estuche, cargador o base de carga si aplica en buen estado y compatible con el equipo' },
        { id: 'stba_i14', item: 'Puerto de audífonos/salida de audio o interfaces disponibles sin obstrucción, humedad, corrosión ni daño mecánico' },
        { id: 'stba_i15', item: 'Etiquetas de activo fijo, identificación institucional, número de serie, clasificación eléctrica y fecha de mantenimiento legibles' },
      ],
      verificacionBasica: [
        { id: 'stba_vb1', item: 'El equipo enciende correctamente y completa autoverificación inicial sin reinicios, pantalla en blanco, símbolos erráticos o mensajes de falla' },
        { id: 'stba_vb2', item: 'La pantalla muestra modo de operación, indicador de FHR/BPM, estado de batería y símbolos principales de forma clara' },
        { id: 'stba_vb3', item: 'Los botones de modo permiten cambiar entre lectura en tiempo real, promedio, cálculo manual o ajuste de retroiluminación según configuración del modelo' },
        { id: 'stba_vb4', item: 'El control de volumen permite ajustar audio Doppler de mínimo a máximo sin cortes, saturación, ruido excesivo o falla del altavoz' },
        { id: 'stba_vb5', item: 'La conexión de sonda es reconocida por el equipo y no presenta pérdida de señal al mover suavemente conector y cable' },
        { id: 'stba_vb6', item: 'La retroiluminación o contraste de pantalla, si aplica, funciona y permite lectura en condiciones de baja iluminación' },
        { id: 'stba_vb7', item: 'El indicador de batería corresponde al estado real y no aparece alarma de batería baja con baterías cargadas/nuevas' },
        { id: 'stba_vb8', item: 'El equipo se apaga correctamente y conserva configuración básica disponible sin bloqueo de teclas o consumo anormal' },
      ],
      pruebasFuncionales: [
        { id: 'stba_pf1', prueba: 'Encendido y autotest — Encender con baterías en buen estado', valorEsperado: 'Arranque normal, pantalla legible, símbolos completos y sin error técnico persistente', resultado: ['Pasa', 'Falla'] },
        { id: 'stba_pf2', prueba: 'Reconocimiento de sonda — Conectar sonda obstétrica compatible y mover suavemente el conector', valorEsperado: 'Sonda reconocida, sin mensajes de desconexión, falsos contactos o pérdida intermitente de señal', resultado: ['Pasa', 'Falla'] },
        { id: 'stba_pf3', prueba: 'Audio Doppler — Usar simulador Doppler fetal o prueba funcional institucional con gel', valorEsperado: 'Audio claro, continuo, regulable y sin distorsión anormal cuando hay señal simulada', resultado: ['Pasa', 'Falla'] },
        { id: 'stba_pf4', prueba: 'FHR baja — Simular o verificar frecuencia fetal aproximada de 90 BPM si el patrón lo permite', valorEsperado: 'Lectura estable 90 BPM ± 3 BPM o dentro de tolerancia del simulador/patrón usado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stba_pf5', prueba: 'FHR media — Simular frecuencia fetal de 120 BPM', valorEsperado: 'Lectura estable 120 BPM ± 3 BPM y símbolo de detección coherente con la señal', resultado: ['Pasa', 'Falla'] },
        { id: 'stba_pf6', prueba: 'FHR estándar — Simular frecuencia fetal de 140 BPM', valorEsperado: 'Lectura estable 140 BPM ± 3 BPM, sin saltos bruscos o pérdida de señal persistente', resultado: ['Pasa', 'Falla'] },
        { id: 'stba_pf7', prueba: 'FHR alta — Simular frecuencia fetal de 180 BPM si el patrón lo permite', valorEsperado: 'Lectura estable 180 BPM ± 3 BPM o dentro de tolerancia del simulador/patrón usado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stba_pf8', prueba: 'Modo promedio — Activar modo de FHR promedio y aplicar señal estable', valorEsperado: 'El equipo calcula/promedia la frecuencia sin bloqueo y muestra valor coherente con la señal aplicada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stba_pf9', prueba: 'Modo cálculo manual — Activar modo manual si aplica y realizar conteo de prueba', valorEsperado: 'El modo permite iniciar/detener conteo y entrega valor coherente con el intervalo evaluado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stba_pf10', prueba: 'Pérdida de señal — Separar la sonda del simulador o retirar gel/contacto', valorEsperado: 'Disminuye/desaparece audio y lectura; el equipo no conserva valores falsos estables prolongados sin señal', resultado: ['Pasa', 'Falla'] },
        { id: 'stba_pf11', prueba: 'Volumen — Recorrer niveles de audio de mínimo a máximo durante señal simulada', valorEsperado: 'Cambio progresivo de volumen, sin crujidos, cortes, saturación excesiva o falla del altavoz', resultado: ['Pasa', 'Falla'] },
        { id: 'stba_pf12', prueba: 'Pantalla/retroiluminación — Activar retroiluminación o ajustar brillo si aplica', valorEsperado: 'Iluminación y contraste permiten lectura clara de FHR, modo e indicador de batería', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stba_pf13', prueba: 'Batería — Operar el equipo durante prueba corta con baterías instaladas', valorEsperado: 'Operación estable sin apagado súbito, reinicio, calentamiento o alarma injustificada de batería baja', resultado: ['Pasa', 'Falla'] },
        { id: 'stba_pf14', prueba: 'Salida de audio/audífonos si aplica — Conectar accesorio compatible de prueba', valorEsperado: 'Salida funcional sin desconexión del equipo, ruido excesivo o daño del conector', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stba_pf15', prueba: 'Limpieza y protección de sonda — Verificar después de limpieza externa', valorEsperado: 'Sonda queda limpia, seca, sin ingreso de líquido visible y mantiene detección funcional', resultado: ['Pasa', 'Falla'] },
        { id: 'stba_pf16', prueba: 'Prueba final operativa — Dejar equipo armado con sonda, baterías adecuadas y accesorios', valorEsperado: 'Equipo limpio, funcional, con sonda conectada/almacenada correctamente, sin mensajes de falla y listo para uso clínico', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de unidad principal, sonda, cable, conector, pantalla y teclado con solución compatible',
        'Inspección física de carcasa, pantalla, botones, compartimento de baterías, contactos, sonda obstétrica, cable, conector y etiquetas',
        'Verificación de encendido, autotest, visualización LCD, modos de operación, indicador de batería, retroiluminación y apagado',
        'Verificación de audio Doppler, control de volumen, detección de señal y estabilidad de lectura de frecuencia cardíaca fetal',
        'Prueba funcional con simulador Doppler fetal o método institucional en puntos de frecuencia baja, media y alta cuando el patrón lo permita',
        'Verificación de modos de lectura en tiempo real, promedio y cálculo manual si están disponibles en el equipo',
        'Revisión de baterías, polaridad, contactos, tapa, autonomía de prueba corta y ausencia de corrosión o fuga',
        'Registro de hallazgos, desviaciones, accesorios faltantes, necesidad de reposición de sonda/batería y recomendación de correctivo especializado si aplica',
      ],
    },


    'desfibrilador_primedic_xd330xe': {
      nombre: 'Desfibrilador PRIMEDIC DefiMonitor XD330XE',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-DESF-PRIMEDIC-XD330XE',
      frecuencia: ['Mensual', 'Trimestral', 'Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el desfibrilador PRIMEDIC XD330XE del uso clínico y confirme que no esté conectado a paciente antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de analizador de desfibrilador calibrado, simulador ECG, cable ECG de paciente, palas externas adulto/pediátricas o electrodos SavePads compatibles, papel térmico, batería/AkuPak, cable de alimentación, elementos de limpieza y EPP.',
        'Realice limpieza y desinfección externa previa según protocolo institucional, evitando ingreso de líquidos en conectores, palas, compartimento de batería, impresora, ventilaciones o fuente de alimentación.',
        'Use cargas de prueba únicamente sobre analizador/carga de prueba para desfibriladores. Nunca descargue al aire, sobre el personal, sobre el paciente ni sobre superficies metálicas.',
        'Antes de cada descarga verifique que las palas o electrodos estén correctamente conectados al analizador, que el área esté despejada y que se anuncie verbalmente la descarga.',
        'No abra la carcasa, fuente de alta tensión, capacitores, módulo de desfibrilación, impresora o tarjetas internas durante el mantenimiento preventivo rutinario; el equipo almacena energía peligrosa incluso después de apagado.',
        'Utilice únicamente accesorios compatibles PRIMEDIC: palas, cable ECG, SavePads, batería/AkuPak, cargador y papel térmico especificados para la serie DefiMonitor XD.',
        'Si se evidencian fallas de carga, descarga, sincronismo, ECG, alarmas, batería, impresora, palas, electrodos o desviación de energía fuera de tolerancia, retire el equipo de servicio y remita a soporte técnico autorizado o correctivo especializado.',
      ],
      inspeccion: [
        { id: 'pxd330i1', item: 'Carcasa, asa, esquinas, protección contra golpes y panel frontal íntegros, sin grietas, deformaciones, humedad interna, partes sueltas o evidencia de apertura no autorizada' },
        { id: 'pxd330i2', item: 'Pantalla LCD/monitor con iluminación, contraste, curvas ECG, mensajes, energía seleccionada, estado de batería y alarmas visibles, sin líneas, manchas o pixeles muertos' },
        { id: 'pxd330i3', item: 'Botones, selector de energía, teclas de carga, choque, encendido, modo manual/AED, sincronismo, impresión, silencio y navegación firmes, legibles y sin bloqueo' },
        { id: 'pxd330i4', item: 'Indicadores visuales y auditivos de carga, listo para descarga, alarma y estado del equipo visibles/audibles y sin obstrucción' },
        { id: 'pxd330i5', item: 'Cable de alimentación, clavija, conector de entrada, alivio de tensión y cargador/base si aplica sin cortes, empalmes, sulfatación, pines flojos, quemaduras o conductor expuesto' },
        { id: 'pxd330i6', item: 'Batería/AkuPak, contactos, pestillo, compartimento y tapa sin abombamiento, fuga, corrosión, holgura, calentamiento, suciedad o mensaje persistente de falla' },
        { id: 'pxd330i7', item: 'Palas externas adulto limpias, completas, con botones de carga/descarga funcionales, superficies conductoras lisas y sin golpes, corrosión o cable deteriorado' },
        { id: 'pxd330i8', item: 'Palas pediátricas o adaptadores, si aplican, completos, limpios, con fijación adecuada y superficies conductoras sin daño' },
        { id: 'pxd330i9', item: 'Cable de palas o conector de terapia firme, sin pines doblados, sulfatación, aislamiento roto, falsos contactos o daño por tracción' },
        { id: 'pxd330i10', item: 'Electrodos SavePads o pads adhesivos disponibles, compatibles, sellados, no vencidos, con empaque íntegro y conector en buen estado' },
        { id: 'pxd330i11', item: 'Cable ECG de paciente y broches/pinzas/electrodos sin cortes, fisuras, pines flojos, corrosión, blindaje expuesto o marcación ilegible' },
        { id: 'pxd330i12', item: 'Conectores ECG, SpO2, palas/pads, alimentación, impresora y comunicación sin humedad, suciedad, pines doblados, holgura o corrosión' },
        { id: 'pxd330i13', item: 'Impresora térmica, tapa, rodillo, cabezal, sensor de papel y bandeja limpios, alineados, sin residuos, atascos, papel quemado o daño mecánico' },
        { id: 'pxd330i14', item: 'Papel térmico compatible instalado correctamente, seco, sin arrugas, decoloración, humedad o avance irregular' },
        { id: 'pxd330i15', item: 'Ventilaciones, rejillas, base, patas, correa, soporte o carro de transporte limpios, estables y sin obstrucción' },
        { id: 'pxd330i16', item: 'Etiquetas de marca PRIMEDIC, modelo XD330XE, número de serie, activo fijo, advertencias de alta tensión, fecha de mantenimiento y trazabilidad legibles y coincidentes con inventario' },
      ],
      verificacionBasica: [
        { id: 'pxd330vb1', item: 'El equipo enciende con alimentación AC y completa autoverificación inicial sin códigos de error, mensajes técnicos persistentes o reinicios' },
        { id: 'pxd330vb2', item: 'El equipo enciende y opera con batería durante prueba corta, sin apagado inesperado, caída abrupta del indicador de carga o alarma de batería defectuosa' },
        { id: 'pxd330vb3', item: 'Fecha, hora, idioma, límites de alarma, derivación ECG, modo de terapia, configuración de energía y datos de registro se visualizan correctamente' },
        { id: 'pxd330vb4', item: 'El monitor ECG muestra trazo estable con simulador, permite seleccionar derivaciones disponibles y no presenta ruido excesivo con cable en buen estado' },
        { id: 'pxd330vb5', item: 'Las palas o pads son reconocidos por el equipo y no se presentan mensajes de desconexión cuando están acoplados al analizador' },
        { id: 'pxd330vb6', item: 'La selección de energía permite recorrer niveles bajos, medios y altos disponibles según configuración sin bloqueo del selector' },
        { id: 'pxd330vb7', item: 'La función de carga inicia y se cancela/descarga de forma controlada sobre el analizador, con mensajes visuales y audibles coherentes' },
        { id: 'pxd330vb8', item: 'El modo sincronizado identifica marcas de sincronismo sobre complejo QRS simulado antes de permitir descarga sincronizada' },
        { id: 'pxd330vb9', item: 'La impresora térmica imprime trazo, fecha/hora, energía/eventos o prueba de impresión sin atascos ni pérdida de legibilidad' },
        { id: 'pxd330vb10', item: 'Alarmas de frecuencia cardíaca alta/baja, desconexión de electrodos, batería baja o fallas simuladas se activan visual y audiblemente según configuración' },
      ],
      pruebasFuncionales: [
        { id: 'pxd330pf1', prueba: 'Autotest inicial — Encender con red AC y observar secuencia de arranque', valorEsperado: 'Arranque completo sin errores técnicos; pantalla, indicadores, altavoz, fecha/hora y configuración operativos', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf2', prueba: 'Alimentación AC — Operar el equipo conectado y mover suavemente cable/conector', valorEsperado: 'Operación estable sin reinicio, falso contacto, chispas, calentamiento ni alarma de alimentación', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf3', prueba: 'Batería/AkuPak — Desconectar AC con equipo encendido y mantener prueba corta', valorEsperado: 'Continúa operando en batería con indicador activo, sin apagado súbito ni alarma de batería defectuosa', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf4', prueba: 'ECG — Simular ritmo sinusal 60 lpm en derivación disponible', valorEsperado: 'Lectura 60 lpm ± 5 lpm, trazo estable, ganancia adecuada y sin ruido excesivo', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf5', prueba: 'ECG — Simular ritmo sinusal 120 lpm', valorEsperado: 'Lectura 120 lpm ± 5 lpm y activación de alarma alta si el límite configurado es superado', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf6', prueba: 'Alarma ECG — Desconectar un electrodo/cable del simulador', valorEsperado: 'Mensaje de electrodo desconectado o pérdida de señal con alarma visual/audible según configuración', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf7', prueba: 'Selección de energía baja — Seleccionar 10 J o nivel bajo disponible, cargar y descargar sobre analizador', valorEsperado: 'Carga, anuncia listo y entrega energía dentro de tolerancia del fabricante/analizador o criterio institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf8', prueba: 'Selección de energía media — Seleccionar 50 J o nivel medio disponible, cargar y descargar sobre analizador', valorEsperado: 'Energía entregada dentro de tolerancia, sin error de carga/descarga ni reinicio del equipo', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf9', prueba: 'Selección de energía alta — Seleccionar 200 J o energía alta disponible, cargar y descargar sobre analizador', valorEsperado: 'Energía entregada dentro de tolerancia; tiempo de carga aceptable según manual/criterio institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf10', prueba: 'Energía máxima — Seleccionar energía máxima configurada si el analizador y protocolo institucional lo permiten', valorEsperado: 'Carga y descarga segura sobre analizador; lectura dentro de tolerancia y sin códigos de falla', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pxd330pf11', prueba: 'Cancelación/descarga interna — Cargar energía y cancelar según procedimiento del equipo sin liberar descarga al paciente', valorEsperado: 'La energía se cancela o descarga internamente de forma segura con mensaje/alarma correspondiente', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf12', prueba: 'Modo sincronizado — Activar SYNC con ECG simulado y verificar marcas sobre QRS', valorEsperado: 'Marcas de sincronismo visibles y descarga sincronizada solo asociada a QRS cuando se ejecuta sobre analizador', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf13', prueba: 'Modo AED/semiautomático si aplica — Conectar pads al analizador/simulador de arritmia', valorEsperado: 'Analiza ritmo, emite indicaciones visuales/audibles y recomienda/no recomienda descarga según ritmo simulado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pxd330pf14', prueba: 'Palas externas — Verificar botones de carga/descarga, contacto y reconocimiento en analizador', valorEsperado: 'Botones responden, no hay falso contacto y el equipo reconoce correctamente las palas', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf15', prueba: 'Electrodos adhesivos/SavePads — Verificar conexión y detección sin usar empaque clínico si no corresponde abrirlo', valorEsperado: 'Conector y cable reconocidos; no hay mensaje de desconexión con accesorios de prueba adecuados', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pxd330pf16', prueba: 'Impresora térmica — Imprimir tira ECG/evento de prueba', valorEsperado: 'Impresión legible, avance uniforme, fecha/hora correctas, sin atasco ni líneas blancas persistentes', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf17', prueba: 'Alarmas visuales y audibles — Simular FC alta/baja, desconexión y batería baja si es posible', valorEsperado: 'Alarmas se activan con prioridad, texto, sonido y posibilidad de silencio temporal según configuración', resultado: ['Pasa', 'Falla'] },
        { id: 'pxd330pf18', prueba: 'Registro de eventos/memoria — Generar evento de prueba o impresión y verificar almacenamiento/visualización si aplica', valorEsperado: 'Evento registrado con fecha/hora y datos básicos; no se evidencian errores de memoria', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pxd330pf19', prueba: 'Seguridad eléctrica visual/instrumental — Inspección de tierra, fuga, cable y carcasa según disponibilidad de analizador', valorEsperado: 'Cumple límites institucionales/IEC aplicables o no presenta hallazgos visuales críticos si no hay analizador disponible', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pxd330pf20', prueba: 'Prueba final operativa — Dejar equipo armado con accesorios, batería cargando y configuración de uso clínico', valorEsperado: 'Equipo queda operativo, limpio, con accesorios completos, energía descargada, sin mensajes de falla y listo para respuesta clínica', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa del desfibrilador, palas, cables, pantalla, panel, conectores e impresora según protocolo institucional',
        'Inspección física de carcasa, protección contra golpes, cable de alimentación, batería/AkuPak, compartimento de batería, palas, pads, cable ECG, conectores y etiquetas',
        'Verificación de encendido, autotest, operación con red AC, operación con batería, configuración, fecha/hora, alarmas y menús principales',
        'Prueba de monitoreo ECG con simulador, lectura de frecuencia cardíaca, selección de derivaciones y alarmas por límites/desconexión',
        'Pruebas de carga y descarga en niveles bajo, medio, alto y máximo permitido sobre analizador de desfibrilador calibrado',
        'Verificación de modo sincronizado, marcas sobre QRS y descarga sincronizada sobre analizador cuando aplique',
        'Verificación de modo AED/semiautomático, reconocimiento de pads y análisis de ritmo simulado cuando el modelo/configuración lo permita',
        'Prueba de palas externas, botones de carga/descarga, cable de terapia, electrodos adhesivos/SavePads y disponibilidad de accesorios vigentes',
        'Prueba de impresora térmica, avance de papel, legibilidad de trazos/eventos y ausencia de atascos',
        'Verificación visual o instrumental de seguridad eléctrica, continuidad de tierra y ausencia de defectos críticos según disponibilidad de analizador',
        'Registro de resultados, energía medida, observaciones, accesorios vencidos/faltantes y recomendación de correctivo especializado si aplica',
      ],
    },



    'aspirador_thomas_medi_pump_1630': {
      nombre: 'Aspirador de Secreciones Thomas Medi-Pump 1630',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-ASP-THOMAS-1630',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el aspirador Thomas Medi-Pump 1630 del uso clínico y confirme que no esté conectado a paciente antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de vacuómetro o manómetro de vacío patrón, recipiente recolector compatible, tapa, empaque, filtro hidrófobo/bacteriano, mangueras de paciente y de vacío, agua para prueba controlada, paños de limpieza y EPP.',
        'El equipo es un dispositivo eléctrico de succión; no opere con manos húmedas, cable deteriorado, carcasa rota, ingreso de líquidos o presencia de material biológico sin limpieza previa.',
        'Use el aspirador únicamente para la finalidad prevista de succión médica de secreciones o fluidos, con el nivel de vacío indicado por personal clínico capacitado.',
        'No utilice el equipo sin filtro hidrófobo/bacteriano instalado, sin recipiente recolector, con tapa mal ajustada o con mangueras conectadas incorrectamente.',
        'No permita sobrellenado del recipiente recolector; verifique flotador, trampa de rebose o sistema antiderrame si está disponible.',
        'No abra el motor, bomba, cableado interno, interruptor, regulador o manómetro durante mantenimiento preventivo rutinario; las reparaciones internas deben ser realizadas por personal calificado.',
        'Si se evidencia bajo vacío persistente, ruido anormal, sobrecalentamiento, olor a quemado, fuga de vacío, falla del manómetro, filtro contaminado o daño eléctrico, retire el equipo de servicio y remita a correctivo especializado.',
      ],
      inspeccion: [
        { id: 'tmp1630i1', item: 'Carcasa externa, base, asa y panel frontal íntegros, sin grietas, golpes, deformaciones, partes sueltas, humedad interna o evidencia de apertura no autorizada' },
        { id: 'tmp1630i2', item: 'Interruptor de encendido/apagado firme, legible y funcional, sin bloqueo, falso contacto, sulfatación o calentamiento visible' },
        { id: 'tmp1630i3', item: 'Perilla del regulador de vacío completa, firme, con giro progresivo y sin holgura, fisuras o pérdida de fijación' },
        { id: 'tmp1630i4', item: 'Manómetro/vacuómetro integrado legible, con aguja en cero en reposo, visor sin fractura, condensación, golpes o escala ilegible' },
        { id: 'tmp1630i5', item: 'Cable de alimentación, clavija y alivio de tensión sin cortes, empalmes, conductor expuesto, pines flojos, quemaduras o deformación' },
        { id: 'tmp1630i6', item: 'Entrada eléctrica, rejillas de ventilación y base del equipo limpias, secas y sin obstrucción por polvo, pelusa, fluidos o residuos' },
        { id: 'tmp1630i7', item: 'Motor/bomba sin signos externos de sobrecalentamiento, olor a quemado, vibración excesiva, ruido anormal o fijación mecánica deficiente' },
        { id: 'tmp1630i8', item: 'Recipiente recolector transparente íntegro, sin grietas, opacidad excesiva, deformación, fuga, manchas permanentes o marcas de volumen ilegibles' },
        { id: 'tmp1630i9', item: 'Tapa del recipiente, palanca de apertura, empaque/sello y conexiones firmes, limpios, completos y sin deformación o pérdida de hermeticidad' },
        { id: 'tmp1630i10', item: 'Sistema antiderrame/flotador si aplica se mueve libremente, está limpio y no presenta bloqueo, ruptura o evidencia de contaminación' },
        { id: 'tmp1630i11', item: 'Filtro hidrófobo/bacteriano instalado en orientación correcta, seco, limpio, sin saturación, cambio de color, obstrucción o fecha vencida según política institucional' },
        { id: 'tmp1630i12', item: 'Silenciador o filtro de escape presente, limpio, sin obstrucción, humedad, daño físico o ruido excesivo asociado' },
        { id: 'tmp1630i13', item: 'Manguera corta entre bomba/filtro/recipiente y manguera de paciente sin fisuras, endurecimiento, colapso, acoples flojos o residuos internos' },
        { id: 'tmp1630i14', item: 'Conexiones de vacío del paciente, entrada del regulador, codos y adaptadores firmes, sin grietas, deformación, fuga, suciedad o inversión de conexiones' },
        { id: 'tmp1630i15', item: 'Etiquetas de marca Thomas, modelo Medi-Pump 1630, número de serie, activo fijo, advertencias eléctricas y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'tmp1630i16', item: 'Accesorios clínicos requeridos para uso seguro disponibles, limpios y compatibles: recipiente, tapa, filtro, manguera paciente, conectores y soporte si aplica' },
      ],
      verificacionBasica: [
        { id: 'tmp1630vb1', item: 'El aspirador enciende conectado a red eléctrica hospitalaria y el motor inicia sin retardo anormal, chispas, olor a quemado o vibración excesiva' },
        { id: 'tmp1630vb2', item: 'El equipo permanece estable sobre superficie plana y no se desplaza por vibración durante operación continua corta' },
        { id: 'tmp1630vb3', item: 'Con el puerto de paciente abierto, el manómetro permanece cercano a cero y el flujo de aire se percibe en la entrada de succión' },
        { id: 'tmp1630vb4', item: 'Al ocluir la manguera de paciente, el manómetro asciende de forma progresiva y el vacío máximo se mantiene sin caída rápida' },
        { id: 'tmp1630vb5', item: 'La perilla reguladora permite disminuir y aumentar el nivel de vacío de manera gradual sin saltos bruscos o bloqueo mecánico' },
        { id: 'tmp1630vb6', item: 'El filtro hidrófobo/bacteriano permite paso de vacío normal y no genera caída excesiva de presión ni obstrucción visible' },
        { id: 'tmp1630vb7', item: 'El recipiente recolector y tapa mantienen hermeticidad durante prueba de oclusión, sin fuga audible o caída rápida del vacío' },
        { id: 'tmp1630vb8', item: 'El sistema de apagado/encendido responde normalmente y el equipo se detiene sin ruido mecánico anormal al finalizar la prueba' },
        { id: 'tmp1630vb9', item: 'Las instrucciones, advertencias de uso, identificación del equipo y sentido de conexiones quedan visibles para el usuario clínico' },
        { id: 'tmp1630vb10', item: 'El equipo queda limpio, seco, armado correctamente y sin presencia de secreciones, humedad o residuos en accesorios reutilizables' },
      ],
      pruebasFuncionales: [
        { id: 'tmp1630pf1', prueba: 'Encendido seguro — Conectar a tomacorriente hospitalario y activar interruptor', valorEsperado: 'Motor enciende de forma inmediata, estable y sin chispas, olor a quemado, vibración excesiva o ruido anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf2', prueba: 'Verificación de cero — Equipo encendido con puerto de paciente abierto y regulador en mínimo', valorEsperado: 'Manómetro cercano a 0 inHg/mmHg o dentro de tolerancia institucional; sin indicación residual significativa', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf3', prueba: 'Vacío máximo — Ocluir totalmente la manguera de paciente y llevar regulador a máximo', valorEsperado: 'Alcanza vacío máximo operativo especificado por fabricante o referencia institucional, de forma estable y sin oscilaciones excesivas', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf4', prueba: 'Regulación baja — Ajustar vacío a nivel bajo con manguera ocluida usando vacuómetro patrón si disponible', valorEsperado: 'Permite ajuste bajo estable y repetible; la lectura integrada es coherente con el patrón dentro de tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tmp1630pf5', prueba: 'Regulación media — Ajustar vacío a nivel medio con manguera ocluida', valorEsperado: 'Vacío estable, sin saltos bruscos; perilla responde progresivamente y mantiene el ajuste seleccionado', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf6', prueba: 'Regulación alta — Ajustar vacío a nivel alto con manguera ocluida', valorEsperado: 'Vacío alto estable sin caída rápida, ruido de esfuerzo anormal o calentamiento perceptible durante prueba corta', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf7', prueba: 'Hermeticidad del recipiente — Ocluir puerto de paciente, alcanzar vacío y apagar el equipo observando caída de aguja', valorEsperado: 'El vacío se conserva por tiempo corto sin caída rápida; no se detectan fugas en tapa, empaque, mangueras o conexiones', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf8', prueba: 'Fuga por conexiones — Mover suavemente mangueras, codos y tapa durante operación', valorEsperado: 'No se presentan desconexiones, silbidos, caída brusca del vacío ni variación inestable del manómetro', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf9', prueba: 'Prueba de aspiración controlada — Aspirar pequeña cantidad de agua limpia desde recipiente de prueba usando manguera de paciente', valorEsperado: 'El fluido es aspirado hacia el recipiente recolector de forma continua; no ingresa líquido al filtro ni a la bomba', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf10', prueba: 'Sistema antiderrame/flotador — Verificar movilidad y cierre funcional según configuración del recipiente', valorEsperado: 'El flotador o trampa se desplaza libremente y bloquea paso de líquido hacia la bomba cuando corresponde', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tmp1630pf11', prueba: 'Filtro hidrófobo/bacteriano — Evaluar estado físico y restricción de flujo durante aspiración', valorEsperado: 'Filtro seco, limpio, sin saturación ni obstrucción; si está contaminado, húmedo o bloqueado se reemplaza antes de liberar el equipo', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf12', prueba: 'Manómetro integrado — Comparar lectura con vacuómetro patrón en al menos un punto medio si se dispone', valorEsperado: 'Lectura coherente con patrón dentro de tolerancia institucional; aguja sin bloqueo, vibración excesiva o retorno deficiente a cero', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tmp1630pf13', prueba: 'Operación continua corta — Mantener equipo encendido durante 5 minutos en condición de succión controlada', valorEsperado: 'Funcionamiento estable sin sobrecalentamiento, olor anormal, caída de rendimiento, ruido creciente o apagado inesperado', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf14', prueba: 'Silenciador/escape — Verificar ruido y salida de aire durante operación', valorEsperado: 'Ruido dentro de condición normal del equipo, sin obstrucción del escape, vibración excesiva ni expulsión de partículas o humedad', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf15', prueba: 'Apagado y descarga — Apagar equipo y liberar vacío de forma controlada', valorEsperado: 'El motor se detiene normalmente, la presión retorna a cero y no quedan accesorios bajo vacío residual peligroso', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf16', prueba: 'Seguridad eléctrica visual/instrumental — Revisar cable, clavija, carcasa y puesta a tierra; medir con analizador si disponible', valorEsperado: 'Sin daño visible; resistencia de tierra y corrientes de fuga dentro de límites institucionales/IEC aplicables', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tmp1630pf17', prueba: 'Limpieza final y armado — Limpiar superficies, secar accesorios, instalar filtro y conectar mangueras correctamente', valorEsperado: 'Equipo limpio, seco, armado de acuerdo con el flujo de succión y listo para uso o identificado para retiro/correctivo', resultado: ['Pasa', 'Falla'] },
        { id: 'tmp1630pf18', prueba: 'Rotulado de liberación — Verificar registro de mantenimiento, fecha, responsable y condición final', valorEsperado: 'Etiqueta o registro actualizado; observaciones, accesorios reemplazados y estado final documentados', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa del aspirador, carcasa, panel, recipiente recolector, tapa, mangueras y accesorios compatibles',
        'Inspección física de cable de alimentación, interruptor, perilla reguladora, manómetro, carcasa, ventilaciones, motor/bomba, recipiente y tapa',
        'Verificación de filtro hidrófobo/bacteriano, silenciador, sistema antiderrame/flotador, empaques, conectores y mangueras de succión',
        'Prueba funcional de encendido, vacío máximo, regulación baja/media/alta, estabilidad del vacío y hermeticidad del sistema',
        'Prueba de aspiración controlada con agua limpia, verificando que el fluido llegue al recipiente sin paso hacia filtro o bomba',
        'Comparación del manómetro con vacuómetro patrón cuando se dispone de instrumento de referencia',
        'Verificación visual o instrumental de seguridad eléctrica según disponibilidad y programa institucional',
        'Reemplazo de filtro, manguera, empaque o accesorio contaminado/deteriorado si se cuenta con repuesto autorizado',
        'Registro de resultados, observaciones, accesorios faltantes, recomendaciones de limpieza, cambio de consumibles o remisión a correctivo especializado',
      ],
    },

    'monitor_fetal_edan_f9': {
      nombre: 'Monitor Fetal EDAN F9',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-MF-EDAN-F9',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el monitor fetal EDAN F9 del uso clínico y confirme que no esté conectado a paciente materna o fetal antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de simulador de frecuencia cardíaca fetal/Doppler fetal, simulador o método de verificación TOCO, simulador de ECG/NIBP/SpO2/TEMP si el equipo cuenta con módulos maternos, papel térmico CTG compatible, gel de ultrasonido y elementos de limpieza no abrasivos.',
        'Realice limpieza y desinfección externa previa según protocolo institucional, evitando ingreso de líquidos en pantalla, teclado, conectores, transductores, impresora, ranuras de ventilación o fuente de alimentación.',
        'Utilice únicamente transductores, cables, cinturones, sensores y accesorios compatibles con EDAN F9; accesorios no compatibles pueden alterar mediciones, alarmas o seguridad eléctrica.',
        'No sumerja los transductores ni el monitor en líquidos; limpie las superficies con paño suave ligeramente humedecido y seque completamente antes de energizar.',
        'No abra la carcasa ni intervenga tarjetas, fuente, batería, módulos de medición, impresora, transductores o componentes internos durante el mantenimiento preventivo rutinario.',
        'No realice pruebas de FHR, TOCO, DECG, IUP ni parámetros maternos sobre pacientes; use simuladores, accesorios de prueba o condiciones controladas.',
        'Si se evidencian errores persistentes, pérdida de señal fetal, alarmas inoperantes, falla de impresora, batería defectuosa, daño de transductores o desviación fuera de tolerancia, retire el equipo de servicio y remita a soporte técnico autorizado EDAN o personal calificado.',
      ],
      inspeccion: [
        { id: 'edf9i1', item: 'Carcasa, cubierta, asa, bisel y pantalla íntegros, sin grietas, golpes, deformación, humedad interna, partes sueltas o evidencia de apertura no autorizada' },
        { id: 'edf9i2', item: 'Pantalla LCD/táctil con adecuada iluminación, contraste, visualización de trazos FHR/TOCO, fecha/hora, alarmas y menús sin manchas, líneas o pixeles muertos' },
        { id: 'edf9i3', item: 'Teclado, perilla/selector, botones de impresión, inicio/detención, silencio, volumen y navegación con respuesta adecuada, sin hundimiento ni bloqueo' },
        { id: 'edf9i4', item: 'Indicadores luminosos, alarmas visuales y altavoz limpios, visibles y audibles, sin obstrucción ni mensajes de falla permanentes' },
        { id: 'edf9i5', item: 'Cable de alimentación, clavija hospitalaria, alivio de tensión y conector AC sin cortes, pines flojos, empalmes, sulfatación, calentamiento o conductor expuesto' },
        { id: 'edf9i6', item: 'Batería interna y tapa de batería sin abombamiento, fuga, sulfatación, calentamiento, holgura o mensaje persistente de falla de batería' },
        { id: 'edf9i7', item: 'Puertos US1/US2, TOCO, marcador de eventos, DECG/IUP, FTS-3, red/USB y módulos maternos sin pines doblados, corrosión, suciedad, humedad u holgura' },
        { id: 'edf9i8', item: 'Transductor ultrasónico FHR1 íntegro, membrana limpia, sin grietas, golpes, cable deteriorado, conector flojo o pérdida de identificación' },
        { id: 'edf9i9', item: 'Transductor ultrasónico FHR2 para monitoreo gemelar íntegro y funcional si el equipo cuenta con este accesorio' },
        { id: 'edf9i10', item: 'Transductor TOCO externo íntegro, superficie sensible limpia, cable sin cortes, conector firme y retorno mecánico adecuado' },
        { id: 'edf9i11', item: 'Cables DECG/IUP, marcador remoto de eventos, cinturones abdominales y accesorios obstétricos completos, limpios, secos y sin desgaste excesivo si aplican' },
        { id: 'edf9i12', item: 'Sensores maternos ECG, SpO2, NIBP y TEMP, cables, brazaletes y mangueras sin fisuras, aislamiento deteriorado, conectores dañados o accesorios incompletos si aplican' },
        { id: 'edf9i13', item: 'Registrador térmico, tapa, rodillo, cabezal, sensor de papel y bandeja de papel CTG limpios, alineados, sin obstrucciones, residuos o daño mecánico' },
        { id: 'edf9i14', item: 'Papel térmico CTG compatible instalado correctamente, sin humedad, arrugas, decoloración, atascos o avance irregular' },
        { id: 'edf9i15', item: 'Ventilaciones, rejillas, base, patas, soporte o carro de transporte firmes, limpios y sin obstrucción o inestabilidad mecánica' },
        { id: 'edf9i16', item: 'Etiquetas de marca EDAN, modelo F9, número de serie, activo fijo, advertencias, símbolos de seguridad y fecha de mantenimiento legibles y coincidentes con inventario' },
      ],
      verificacionBasica: [
        { id: 'edf9vb1', item: 'El monitor enciende con alimentación AC, completa autoverificación inicial y queda operativo sin códigos de error o alarmas técnicas persistentes' },
        { id: 'edf9vb2', item: 'Fecha, hora, idioma, unidades, velocidad de papel, tipo de monitoreo y configuración institucional se visualizan correctamente' },
        { id: 'edf9vb3', item: 'El equipo opera en batería durante prueba corta al desconectar AC, sin reinicio, apagado súbito o caída abrupta del indicador de carga' },
        { id: 'edf9vb4', item: 'Los menús de paciente, monitoreo fetal, parámetros maternos, tendencias, memoria, impresión, alarmas y configuración son accesibles según permisos' },
        { id: 'edf9vb5', item: 'El volumen del audio Doppler puede ajustarse de mínimo a máximo y se escucha sin distorsión ni cortes' },
        { id: 'edf9vb6', item: 'Los límites de alarma fetal y materna pueden visualizarse; la pausa/silencio de alarma es temporal y queda indicada en pantalla' },
        { id: 'edf9vb7', item: 'El registrador térmico avanza papel, imprime cuadrícula/trazos de prueba y no presenta atasco, ruido anormal o error de papel' },
        { id: 'edf9vb8', item: 'El marcador remoto de eventos genera marca visible en pantalla o registro impreso cuando se activa durante la prueba' },
        { id: 'edf9vb9', item: 'El equipo reconoce transductores FHR/TOCO conectados y muestra calidad de señal/valores sin desconexiones intermitentes' },
        { id: 'edf9vb10', item: 'La conexión a central, red, USB o sistema FTS-3 se verifica disponible si el equipo está configurado con estas opciones' },
      ],
      pruebasFuncionales: [
        { id: 'edf9pf1', prueba: 'Encendido y autotest — Conectar a red AC, encender y observar secuencia inicial', valorEsperado: 'Inicio completo sin errores técnicos; pantalla, indicadores, fecha/hora y configuración operativos', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf2', prueba: 'Alimentación AC — Verificar operación estable y mover suavemente el cable de poder', valorEsperado: 'Sin reinicio, falso contacto, calentamiento, chispas ni alarma de alimentación', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf3', prueba: 'Batería — Desconectar AC con el equipo encendido y mantener prueba corta de funcionamiento', valorEsperado: 'Continúa operando con indicador de batería activo, sin apagado inesperado ni alarma de batería defectuosa', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf4', prueba: 'FHR1 — Simular frecuencia cardíaca fetal 120 BPM en canal US1', valorEsperado: 'Lectura estable 120 BPM ± 2 BPM, trazo visible y calidad de señal adecuada', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf5', prueba: 'FHR1 — Simular frecuencia cardíaca fetal 140 BPM en canal US1', valorEsperado: 'Lectura estable 140 BPM ± 2 BPM y audio Doppler claro sin artefactos excesivos', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf6', prueba: 'FHR1 — Simular frecuencia cardíaca fetal 180 BPM en canal US1', valorEsperado: 'Lectura estable 180 BPM ± 2 BPM; alarma alta se activa si el límite configurado es superado', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf7', prueba: 'FHR2 gemelar — Simular frecuencia cardíaca fetal 130/150 BPM en segundo canal si aplica', valorEsperado: 'Segundo canal reconocido, lectura estable y diferenciación correcta de FHR1/FHR2', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edf9pf8', prueba: 'Audio Doppler — Variar volumen y verificar sonido asociado a señal fetal simulada', valorEsperado: 'Audio claro, regulable, sin saturación, cortes o ruido anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf9', prueba: 'Pérdida de señal FHR — Retirar señal/transductor del simulador', valorEsperado: 'Se muestra pérdida de señal o guiones, con alarma/mensaje según configuración', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf10', prueba: 'TOCO cero — Colocar transductor TOCO en reposo y ejecutar ajuste de línea base', valorEsperado: 'Línea base cercana a 0 unidades, estable y sin deriva excesiva', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf11', prueba: 'TOCO respuesta — Aplicar presión manual graduada o simulador al transductor TOCO', valorEsperado: 'Deflexión proporcional visible en pantalla y registro, sin saturación ni saltos erráticos', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf12', prueba: 'TOCO retorno — Liberar presión del transductor TOCO', valorEsperado: 'Retorna a línea base en pocos segundos sin bloqueo o deriva persistente', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf13', prueba: 'Movimiento fetal/marcador — Activar marcador remoto o evento durante monitoreo simulado', valorEsperado: 'Marca/evento visible en pantalla, memoria o impresión CTG con fecha/hora correcta', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edf9pf14', prueba: 'Registrador térmico — Imprimir trazos FHR/TOCO de prueba', valorEsperado: 'Impresión legible, cuadrícula completa, avance uniforme, sin áreas en blanco, atascos o error de papel', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf15', prueba: 'Velocidad de papel 1 cm/min — Medir desplazamiento del papel durante 1 minuto', valorEsperado: 'Avance 1 cm/min ± 5% o dentro de tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edf9pf16', prueba: 'Velocidad de papel 3 cm/min — Medir desplazamiento del papel durante 1 minuto', valorEsperado: 'Avance 3 cm/min ± 5% o dentro de tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edf9pf17', prueba: 'Alarma FHR baja — Configurar límite bajo y simular frecuencia inferior al límite', valorEsperado: 'Alarma visual y sonora activa, mensaje visible y registro según configuración', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf18', prueba: 'Alarma FHR alta — Configurar límite alto y simular frecuencia superior al límite', valorEsperado: 'Alarma visual y sonora activa; silencio/pausa funciona solo temporalmente', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf19', prueba: 'ECG materno — Conectar simulador ECG si el módulo está instalado', valorEsperado: 'Frecuencia y trazo ECG materno estables, con detección de cable desconectado si se retira derivación', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edf9pf20', prueba: 'SpO2 materna — Conectar simulador o sensor compatible si el módulo está instalado', valorEsperado: 'Lectura de SpO2/pulso estable y alarma funcional ante valor fuera de límite simulado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edf9pf21', prueba: 'NIBP materna — Ejecutar medición con analizador NIBP/brazalete de prueba si el módulo está instalado', valorEsperado: 'Inflado/desinflado normal, sin fuga significativa ni error de sobrepresión; lectura dentro de tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edf9pf22', prueba: 'Temperatura materna — Conectar sonda/simulador compatible si el módulo está instalado', valorEsperado: 'Lectura estable y coherente con valor simulado o referencia', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edf9pf23', prueba: 'Memoria/tendencias/reimpresión — Guardar registro de prueba y revisar trazado almacenado', valorEsperado: 'Registro recuperable con fecha/hora correcta; reimpresión o revisión sin pérdida de datos visible', resultado: ['Pasa', 'Falla'] },
        { id: 'edf9pf24', prueba: 'Comunicación/red/FTS-3 — Verificar conexión a central, USB o sistema de telemetría fetal si aplica', valorEsperado: 'Equipo identificado, señal estable y sin desconexiones persistentes', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edf9pf25', prueba: 'Seguridad eléctrica visual/instrumental — Revisar cable, tierra, partes aplicadas y medir con analizador si disponible', valorEsperado: 'Sin daño visible; resistencia de tierra y corrientes de fuga dentro de límites institucionales/IEC aplicables', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edf9pf26', prueba: 'Limpieza final y reinicio — Desinfectar superficies, reconectar accesorios y reiniciar el equipo', valorEsperado: 'Equipo limpio, seco, sin alarmas técnicas, con accesorios completos y listo para uso o con observaciones registradas', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa del monitor, pantalla, teclado, cable de alimentación, transductores y accesorios compatibles',
        'Inspección física de carcasa, pantalla, batería, conectores, transductores FHR, TOCO, marcador de eventos, registrador e interfaces',
        'Verificación de encendido, autoprueba, configuración básica, fecha/hora, volumen Doppler, alarmas y navegación por menús',
        'Prueba funcional de alimentación AC y operación con batería',
        'Verificación funcional de FHR1/FHR2, audio Doppler, pérdida de señal, TOCO, marcador de eventos y alarmas FHR',
        'Verificación de registrador térmico, papel CTG, calidad de impresión y velocidad de papel',
        'Verificación de parámetros maternos ECG, SpO2, NIBP y temperatura si el equipo cuenta con dichos módulos',
        'Verificación de memoria, tendencias, reimpresión y comunicación con central/FTS-3 si aplica',
        'Prueba visual o instrumental de seguridad eléctrica según disponibilidad y programa institucional',
        'Registro de resultados, accesorios faltantes, observaciones y recomendación de correctivo o retiro de servicio si se detectan fallas críticas',
      ],
    },

    'monitor_drager_vista_120s': {
      nombre: 'Monitor de Signos Vitales Dräger Vista 120S',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-MSV-VISTA120S',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el monitor Dräger Vista 120S del uso clínico y confirme que no esté conectado a ningún paciente antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de simulador de signos vitales/ECG, simulador de SpO₂, analizador de NIBP, termómetro/simulador de temperatura, analizador de seguridad eléctrica si aplica, accesorios compatibles y elementos de limpieza no abrasivos.',
        'Revise que los accesorios utilizados correspondan a los especificados por el fabricante para evitar mediciones erróneas, alarmas inadecuadas o riesgo para el paciente.',
        'No utilice el equipo en presencia de daño físico, ingreso de líquidos, cables deteriorados, conectores flojos, batería defectuosa, alarmas técnicas persistentes o lectura inestable de parámetros.',
        'No abra la carcasa ni intervenga tarjetas electrónicas, módulos de medición, fuente de poder, batería interna o conectores durante el mantenimiento preventivo rutinario.',
        'No realice pruebas invasivas sobre pacientes; las pruebas funcionales deben ejecutarse con simuladores, accesorios de prueba o condiciones controladas.',
        'Antes de energizar, verifique que el cable de alimentación, puesta a tierra, fusibles externos si aplica y tomacorriente hospitalario se encuentren en condiciones seguras.',
        'Si se detecta falla crítica en alarmas, batería, NIBP, ECG, SpO₂, temperatura, red o seguridad eléctrica, retire el equipo de servicio y remita a soporte técnico autorizado Dräger o personal calificado.',
      ],
      inspeccion: [
        { id: 'v120svi1', item: 'Carcasa, bisel y pantalla táctil íntegros, sin grietas, golpes, humedad, manchas internas, partes sueltas o evidencia de apertura no autorizada' },
        { id: 'v120svi2', item: 'Pantalla con adecuada iluminación, contraste, sensibilidad táctil y visualización completa de curvas, números, menús, hora y mensajes' },
        { id: 'v120svi3', item: 'Botones físicos, perilla rotatoria/selector y tecla de encendido responden correctamente y no presentan hundimiento, bloqueo o desgaste excesivo' },
        { id: 'v120svi4', item: 'Alarmas visuales e indicadores luminosos visibles, sin LED apagados, cubiertas rotas ni mensajes de error permanentes' },
        { id: 'v120svi5', item: 'Altavoz/rejilla de sonido limpia y sin obstrucción; volumen audible para alarmas y tonos de pulso' },
        { id: 'v120svi6', item: 'Cable de alimentación, clavija hospitalaria y retenedor sin cortes, empalmes, calentamiento, pines flojos o conductor expuesto' },
        { id: 'v120svi7', item: 'Conector de entrada AC, fusibles externos si aplica y punto de tierra equipotencial firmes, limpios y sin corrosión' },
        { id: 'v120svi8', item: 'Batería instalada correctamente, sin abombamiento, fugas, sulfatación, calentamiento, tapa floja o mensaje de falla de batería' },
        { id: 'v120svi9', item: 'Puertos ECG/RESP, SpO₂, NIBP, TEMP, IBP/CO₂ u otros instalados limpios, alineados, sin pines doblados, corrosión o holgura' },
        { id: 'v120svi10', item: 'Cable ECG, latiguillos y broches/pinzas íntegros, sin cortes, aislamiento deteriorado, conectores flojos o partes expuestas' },
        { id: 'v120svi11', item: 'Sensor SpO₂, cable de extensión y conector íntegros, limpios y sin daño en emisor/receptor, bisagra o cableado' },
        { id: 'v120svi12', item: 'Manguera NIBP, brazaletes adulto/pediátrico/neonatal y conectores sin fugas, fisuras, velcro deteriorado o acoples flojos' },
        { id: 'v120svi13', item: 'Sonda/cable de temperatura y adaptadores compatibles sin daño físico, humedad, ruptura de aislamiento o conectores contaminados' },
        { id: 'v120svi14', item: 'Registrador térmico, tapa, rodillo y compartimiento de papel íntegros, limpios y con papel instalado si el monitor cuenta con esta opción' },
        { id: 'v120svi15', item: 'Puertos de red, USB, llamada de enfermería o comunicación central sin deformación, suciedad, corrosión o conectores flojos' },
        { id: 'v120svi16', item: 'Soporte, asa, base, riel o sistema de montaje firmes, sin inestabilidad mecánica ni riesgo de caída' },
        { id: 'v120svi17', item: 'Etiquetas de marca, modelo Vista 120S, número de serie, activo fijo, advertencias y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'v120svi18', item: 'Superficies externas limpias, secas y libres de fluidos, residuos de adhesivo, polvo, desinfectante acumulado o material biológico' },
      ],
      verificacionBasica: [
        { id: 'v120svb1', item: 'El monitor enciende conectado a red eléctrica hospitalaria, completa autoverificación inicial y queda operativo sin errores técnicos persistentes' },
        { id: 'v120svb2', item: 'Fecha, hora, tipo de paciente, idioma, unidades de medición y configuración institucional se visualizan y pueden verificarse en menú' },
        { id: 'v120svb3', item: 'El indicador de red AC y el indicador de carga de batería se muestran correctamente al conectar/desconectar alimentación' },
        { id: 'v120svb4', item: 'El equipo funciona con batería durante prueba corta sin apagados, reinicios, caída abrupta del porcentaje o alarma de batería defectuosa' },
        { id: 'v120svb5', item: 'La pantalla muestra parámetros y formas de onda sin congelamientos, parpadeos, pérdida de datos o bloqueo de interfaz' },
        { id: 'v120svb6', item: 'Los menús de configuración, admisión/alta de paciente, tendencias, eventos, alarmas y revisión se abren y cierran normalmente' },
        { id: 'v120svb7', item: 'Los límites de alarma pueden visualizarse y modificarse de acuerdo con permisos institucionales, sin quedar alarmas silenciadas permanentemente' },
        { id: 'v120svb8', item: 'La alarma sonora, visual y mensaje en pantalla se activan ante condición simulada y pueden reconocerse según procedimiento normal' },
        { id: 'v120svb9', item: 'El registrador térmico imprime trazado/valores de prueba con contraste adecuado si el equipo cuenta con impresora' },
        { id: 'v120svb10', item: 'La comunicación con central, red o sistema institucional se mantiene disponible si el equipo está configurado para monitoreo central' },
      ],
      pruebasFuncionales: [
        { id: 'v120spf1', prueba: 'Encendido y autotest — Conectar a red AC, encender y observar secuencia de inicio', valorEsperado: 'Inicio completo sin códigos de falla, pantalla operativa, indicadores activos y fecha/hora correctas', resultado: ['Pasa', 'Falla'] },
        { id: 'v120spf2', prueba: 'Alimentación AC — Verificar operación conectada a red y estabilidad al mover suavemente el cable', valorEsperado: 'Operación estable, sin falso contacto, reinicio, calentamiento, chispas o alarma de alimentación', resultado: ['Pasa', 'Falla'] },
        { id: 'v120spf3', prueba: 'Batería — Desconectar AC con el monitor encendido y mantener prueba corta de autonomía', valorEsperado: 'El equipo continúa funcionando, muestra indicador de batería y no presenta apagado inesperado', resultado: ['Pasa', 'Falla'] },
        { id: 'v120spf4', prueba: 'ECG — Conectar simulador ECG y seleccionar derivación principal', valorEsperado: 'Frecuencia cardíaca y trazado ECG estables, sin ruido excesivo y dentro de tolerancia institucional del simulador', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'v120spf5', prueba: 'Detección de cable ECG desconectado — Retirar una derivación del simulador o cable de prueba', valorEsperado: 'Mensaje/alarma de derivación desconectada o condición equivalente se activa correctamente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'v120spf6', prueba: 'Respiración por impedancia — Usar simulador compatible o señal de prueba RESP', valorEsperado: 'Frecuencia respiratoria estable y curva RESP visible sin artefacto excesivo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'v120spf7', prueba: 'SpO₂ — Conectar simulador de SpO₂ o sensor con señal controlada', valorEsperado: 'Valor de SpO₂ y pulso detectados, tono de pulso audible y lectura estable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'v120spf8', prueba: 'Alarma SpO₂ baja — Simular valor por debajo del límite configurado', valorEsperado: 'Alarma visual/sonora y mensaje en pantalla se activan según prioridad configurada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'v120spf9', prueba: 'NIBP fuga neumática — Conectar analizador NIBP/brazalete de prueba y ejecutar prueba de fugas según procedimiento institucional', valorEsperado: 'Sistema mantiene presión sin fuga significativa y sin error técnico de presión', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'v120spf10', prueba: 'NIBP medición — Ejecutar medición con analizador/simulador NIBP en modo adulto', valorEsperado: 'Inflado, desinflado y valores dentro de tolerancia institucional; sin sobrepresión ni error de medición', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'v120spf11', prueba: 'NIBP cancelación/seguridad — Iniciar medición y cancelar desde el monitor', valorEsperado: 'La medición se detiene, el brazalete desinfla y el equipo vuelve a estado listo sin bloqueo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'v120spf12', prueba: 'Temperatura — Conectar simulador/sonda de temperatura compatible y aplicar punto de prueba', valorEsperado: 'Lectura de temperatura estable y coherente con el valor simulado o referencia', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'v120spf13', prueba: 'Tendencias — Registrar valores simulados y verificar almacenamiento/visualización en tendencias', valorEsperado: 'Los datos se guardan y consultan con fecha/hora correcta sin pérdida visible', resultado: ['Pasa', 'Falla'] },
        { id: 'v120spf14', prueba: 'Eventos y alarmas — Generar condición simulada de alarma y revisar registro/evento', valorEsperado: 'El evento queda registrado o visible en revisión según configuración del equipo', resultado: ['Pasa', 'Falla'] },
        { id: 'v120spf15', prueba: 'Silencio/pausa de alarma — Activar alarma simulada y probar silencio temporal según configuración', valorEsperado: 'El silencio es temporal, queda indicado en pantalla y la alarma retorna si persiste la condición', resultado: ['Pasa', 'Falla'] },
        { id: 'v120spf16', prueba: 'Registrador térmico — Imprimir curva o reporte de prueba si el equipo dispone de registrador', valorEsperado: 'Impresión legible, avance de papel correcto, sin atasco ni error de impresora', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'v120spf17', prueba: 'Comunicación/red — Verificar conexión con central o red institucional si aplica', valorEsperado: 'Equipo identificado y comunicado; sin pérdida de enlace, error de IP o desconexión persistente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'v120spf18', prueba: 'Pantalla táctil/mandos — Navegar por menús principales, cambiar pantalla y retornar al monitoreo', valorEsperado: 'Respuesta fluida de táctil/perilla/teclas sin bloqueo ni selección errática', resultado: ['Pasa', 'Falla'] },
        { id: 'v120spf19', prueba: 'Seguridad eléctrica visual/funcional — Revisar cable, tierra, conectores y estabilidad operacional', valorEsperado: 'Sin daño visible, falso contacto, calentamiento, reinicios o pérdida de puesta a tierra observable', resultado: ['Pasa', 'Falla'] },
        { id: 'v120spf20', prueba: 'Prueba de seguridad eléctrica instrumental — Medir resistencia de tierra y corrientes de fuga con analizador si está disponible', valorEsperado: 'Valores dentro de límites institucionales/IEC aplicables para equipo electromédico Clase I y partes aplicadas CF/BF', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'v120spf21', prueba: 'Limpieza final y reinicio — Desinfectar superficies, reconectar accesorios y reiniciar monitor', valorEsperado: 'Equipo limpio, seco, sin alarmas técnicas y listo para uso o con observaciones registradas', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de carcasa, pantalla, cable de alimentación y superficies de contacto',
        'Inspección física de monitor, pantalla, mandos, batería, puertos, conectores, cableado y accesorios de paciente',
        'Verificación de encendido, autoprueba, configuración básica, fecha/hora, alarmas y navegación por menús',
        'Prueba funcional de alimentación AC y operación con batería',
        'Verificación funcional de ECG, respiración, SpO₂, NIBP y temperatura con simuladores o instrumentos compatibles',
        'Verificación de alarmas visuales, sonoras, silencio temporal, límites y registro de eventos/tendencias',
        'Revisión de registrador térmico, papel e impresión de prueba si aplica',
        'Verificación de comunicación con central/red institucional si aplica',
        'Prueba visual o instrumental de seguridad eléctrica según disponibilidad y programa institucional',
        'Registro de resultados, observaciones, accesorios faltantes y recomendación de correctivo si se detectan fallas críticas',
      ],
    },

    'unidad_calentamiento_bair_hugger_67500': {
      nombre: 'Unidad de Calentamiento 3M Bair Hugger 67500',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-UC-BH67500',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire la unidad de calentamiento Bair Hugger 67500 del uso clínico y confirme que no esté conectada a ningún paciente antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de tomacorriente hospitalario con puesta a tierra, termómetro/analizador de temperatura calibrado para flujo de aire, medidor de seguridad eléctrica si aplica, filtro de aire compatible, paños suaves y desinfectante compatible no abrasivo.',
        'Utilice únicamente mantas, batas o accesorios compatibles con el sistema Bair Hugger; no conecte la manguera directamente al paciente ni utilice accesorios no autorizados.',
        'No bloquee la entrada de aire, salida de aire, manguera ni rejillas de ventilación durante la prueba funcional.',
        'No sumerja la unidad, manguera, cable o accesorios en líquidos; no esterilice en autoclave y evite ingreso de desinfectante a rejillas, conectores o panel de control.',
        'No abra la carcasa ni intervenga tarjetas, resistencia, soplador, sensores, termostatos, fuente o componentes internos durante el mantenimiento preventivo rutinario.',
        'Si se evidencian alarmas persistentes, sobretemperatura, olor a quemado, daño del cable, flujo deficiente, filtro contaminado, error de sistema o falla del panel, retire de servicio y remita a servicio técnico autorizado.',
        'Después de reemplazar filtro o realizar limpieza, verifique que la unidad quede seca, ensamblada y libre de obstrucciones antes de energizarla.',
      ],
      inspeccion: [
        { id: 'bh675vi1', item: 'Carcasa externa íntegra, sin grietas, golpes, deformaciones, partes sueltas, tornillos faltantes ni evidencia de apertura no autorizada' },
        { id: 'bh675vi2', item: 'Panel frontal y botones de temperatura/ambiente/espera legibles, limpios y con respuesta táctil adecuada' },
        { id: 'bh675vi3', item: 'Display/indicadores luminosos visibles, sin segmentos apagados, parpadeos anormales, humedad o mensajes de error al encender' },
        { id: 'bh675vi4', item: 'Cable de alimentación y clavija hospitalaria sin cortes, aplastamientos, pines flojos, calentamiento, cinta improvisada o conductor expuesto' },
        { id: 'bh675vi5', item: 'Retenedor, prensaestopa o entrada del cable firme, sin tracción excesiva ni movimiento anormal' },
        { id: 'bh675vi6', item: 'Manguera de aire caliente íntegra, flexible, limpia, sin perforaciones, deformación, quemaduras, obstrucciones, acoples rotos o pérdidas visibles' },
        { id: 'bh675vi7', item: 'Extremo ergonómico de la manguera y sistema de acople a manta/bata íntegros, con ajuste seguro y sin bordes cortantes' },
        { id: 'bh675vi8', item: 'Rejilla de entrada de aire limpia, sin polvo acumulado, pelusa, obstrucción, humedad o elementos extraños' },
        { id: 'bh675vi9', item: 'Filtro de aire instalado, seco, limpio, correctamente asentado y dentro del periodo de reemplazo institucional' },
        { id: 'bh675vi10', item: 'Salida de aire y conducto interno visibles sin residuos, pelusa, olor anormal, obstrucción o daño térmico' },
        { id: 'bh675vi11', item: 'Base, soportes, patas, ruedas o mecanismo de fijación al pedestal/camilla firmes y sin inestabilidad mecánica' },
        { id: 'bh675vi12', item: 'Etiquetas de marca, modelo 675/67500, número de serie, activo fijo, advertencias y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'bh675vi13', item: 'Superficies externas limpias y secas, sin sangre, fluidos, adhesivos, residuos de desinfectante o polvo acumulado en uniones' },
        { id: 'bh675vi14', item: 'No hay señales de sobrecalentamiento: decoloración, plástico derretido, olor a quemado, ruido eléctrico o marcas térmicas' },
      ],
      verificacionBasica: [
        { id: 'bh675vb1', item: 'Al conectar a red eléctrica, la unidad energiza sin chispas, olor anormal, calentamiento del cable o disparo de protecciones' },
        { id: 'bh675vb2', item: 'El equipo realiza autoverificación inicial y queda disponible sin códigos de falla o alarmas activas' },
        { id: 'bh675vb3', item: 'Los botones de selección de temperatura responden y permiten alternar entre ambiente, baja, media y alta según configuración del modelo' },
        { id: 'bh675vb4', item: 'El soplador inicia y mantiene flujo de aire continuo, uniforme y sin vibración, roce, silbido o ruido anormal' },
        { id: 'bh675vb5', item: 'La manguera permanece firmemente conectada durante operación y no presenta fugas perceptibles en acoples' },
        { id: 'bh675vb6', item: 'El flujo de aire no se interrumpe al mover suavemente la manguera o el cable de alimentación' },
        { id: 'bh675vb7', item: 'Las alarmas/indicadores de falla no se activan durante calentamiento normal y el equipo responde al cambio de modo' },
        { id: 'bh675vb8', item: 'La unidad se apaga correctamente y el soplador se detiene según la secuencia normal del fabricante' },
      ],
      pruebasFuncionales: [
        { id: 'bh675pf1', prueba: 'Encendido/autotest — Conectar a red hospitalaria y encender la unidad sin paciente', valorEsperado: 'Autoverificación completa, indicadores activos y equipo listo sin códigos de falla', resultado: ['Pasa', 'Falla'] },
        { id: 'bh675pf2', prueba: 'Modo ambiente — Seleccionar temperatura ambiente y verificar flujo en la salida de la manguera', valorEsperado: 'Flujo de aire continuo sin calentamiento activo perceptible ni alarma', resultado: ['Pasa', 'Falla'] },
        { id: 'bh675pf3', prueba: 'Temperatura baja 32 °C — Operar hasta estabilización y medir temperatura de salida con instrumento calibrado', valorEsperado: 'Temperatura cercana al ajuste seleccionado, dentro de tolerancia institucional/fabricante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bh675pf4', prueba: 'Temperatura media 38 °C — Operar hasta estabilización y medir temperatura de salida con instrumento calibrado', valorEsperado: 'Temperatura cercana al ajuste seleccionado, dentro de tolerancia institucional/fabricante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bh675pf5', prueba: 'Temperatura alta 43 °C — Operar hasta estabilización y medir temperatura de salida con instrumento calibrado', valorEsperado: 'Temperatura cercana al ajuste seleccionado, sin sobrepasar límites de seguridad ni generar alarma', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bh675pf6', prueba: 'Estabilidad térmica — Mantener operación 5 minutos en temperatura seleccionada y observar lectura', valorEsperado: 'Temperatura estable, sin oscilaciones abruptas, apagados o fallas de control', resultado: ['Pasa', 'Falla'] },
        { id: 'bh675pf7', prueba: 'Cambio entre modos — Alternar ambiente/baja/media/alta esperando respuesta del sistema', valorEsperado: 'El equipo cambia de modo, actualiza indicadores y modifica la temperatura de salida progresivamente', resultado: ['Pasa', 'Falla'] },
        { id: 'bh675pf8', prueba: 'Flujo de aire — Verificar salida de aire con manguera extendida y sin manta conectada a paciente', valorEsperado: 'Flujo uniforme, sin obstrucción, vibración excesiva, silbidos o reducción evidente', resultado: ['Pasa', 'Falla'] },
        { id: 'bh675pf9', prueba: 'Manguera y acople — Conectar a manta/bata compatible o accesorio de prueba y aplicar movimientos suaves', valorEsperado: 'Acople seguro, sin desconexión accidental, fuga importante o interrupción de flujo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bh675pf10', prueba: 'Filtro de aire — Retirar, inspeccionar y reinstalar o reemplazar según condición', valorEsperado: 'Filtro limpio, seco, correctamente asentado y sin alarma/obstrucción posterior', resultado: ['Pasa', 'Falla'] },
        { id: 'bh675pf11', prueba: 'Ruido y vibración — Operar en modo alto durante prueba funcional', valorEsperado: 'Nivel de ruido habitual del soplador, sin vibración, roce, zumbido eléctrico ni olor anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'bh675pf12', prueba: 'Seguridad eléctrica visual/funcional — Revisar cable, clavija, puesta a tierra y operación estable', valorEsperado: 'Sin falso contacto, calentamiento, daño visible ni interrupciones al mover suavemente cable/conector', resultado: ['Pasa', 'Falla'] },
        { id: 'bh675pf13', prueba: 'Prueba de seguridad eléctrica instrumental — Medir resistencia de tierra y corrientes de fuga si se dispone de analizador', valorEsperado: 'Valores dentro de límites institucionales/IEC aplicables para equipo electromédico', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bh675pf14', prueba: 'Alarmas/indicadores de falla — Verificar que no existan fallas registradas o alarmas activas durante operación normal', valorEsperado: 'Sin alarmas persistentes; cualquier falla registrada se documenta y se remite a soporte técnico', resultado: ['Pasa', 'Falla'] },
        { id: 'bh675pf15', prueba: 'Prueba prolongada corta — Mantener equipo operando 10 minutos en modo medio o alto bajo supervisión', valorEsperado: 'Operación estable, sin apagado, sobretemperatura, olor anormal o variación significativa de flujo', resultado: ['Pasa', 'Falla'] },
        { id: 'bh675pf16', prueba: 'Apagado — Apagar desde el botón de alimentación y desconectar de red', valorEsperado: 'Secuencia normal de apagado, sin bloqueo, chispas ni mensajes de error al reiniciar', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de carcasa, panel, manguera y cable',
        'Inspección de manguera, acoples, rejillas y salida de aire',
        'Revisión, limpieza o reemplazo de filtro de aire según condición',
        'Verificación de encendido, autoprueba, panel e indicadores',
        'Verificación de flujo de aire y funcionamiento del soplador',
        'Prueba funcional en modo ambiente, baja, media y alta temperatura',
        'Medición comparativa de temperatura de salida con instrumento calibrado',
        'Verificación visual/funcional de cable de alimentación y puesta a tierra',
        'Prueba de seguridad eléctrica instrumental si aplica',
        'Registro de observaciones y recomendación de retiro/correctivo si se presentan alarmas, sobretemperatura, flujo deficiente o daño físico',
      ],
    },
    'bascula_seca_374': {
      nombre: 'Báscula Pediátrica Seca 374',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-BP-SECA374',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que la báscula Seca 374 se encuentre fuera de uso clínico, limpia, seca y ubicada sobre una superficie firme, estable y nivelada antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de pesas patrón calibradas o masas trazables, paño suave, desinfectante compatible no abrasivo, baterías AA si aplica y adaptador de red original o compatible si el equipo lo utiliza.',
        'No someta la báscula a golpes, caídas, cargas superiores a su capacidad nominal ni esfuerzos laterales sobre la bandeja de pesaje.',
        'No desarme la báscula ni intervenga celdas de carga, electrónica interna, display, teclado, conectores o circuito de alimentación durante el mantenimiento preventivo rutinario.',
        'Antes de realizar pruebas metrológicas, permita que la báscula se estabilice térmicamente en el área de trabajo y asegure que no existan corrientes de aire, vibraciones o contacto con superficies externas.',
        'Si se evidencian errores, lectura inestable, daño físico, falla de teclado, desviación fuera de tolerancia, manipulación del sello/calibración o ingreso de líquidos, retire de servicio y remita a servicio técnico autorizado.',
        'Las actividades de calibración, ajuste interno, reparación electrónica o reemplazo de celdas de carga deben ser realizadas por personal calificado/autorizado y con trazabilidad metrológica.',
      ],
      inspeccion: [
        { id: 's374vi1', item: 'Bandeja de pesaje pediátrica íntegra, limpia, sin fisuras, deformaciones, bordes cortantes, manchas permanentes o partes sueltas' },
        { id: 's374vi2', item: 'Base y estructura inferior sin golpes, grietas, torsión, humedad interna, corrosión o evidencia de caída' },
        { id: 's374vi3', item: 'Apoyos/patas de nivelación completos, firmes y ajustables; la báscula queda estable sobre todos los apoyos' },
        { id: 's374vi4', item: 'Display LCD legible, sin segmentos faltantes, manchas, condensación, parpadeos o lectura intermitente' },
        { id: 's374vi5', item: 'Teclas ON/OFF, TARE, HOLD, kg/lb o equivalentes íntegras, legibles y con respuesta adecuada' },
        { id: 's374vi6', item: 'Compartimiento de baterías limpio, seco, sin sulfatación, corrosión, contactos flojos, tapa suelta o baterías con fuga' },
        { id: 's374vi7', item: 'Adaptador de red y conector de alimentación, si aplica, sin cortes, falsos contactos, calentamiento, fisuras o partes expuestas' },
        { id: 's374vi8', item: 'Rotulación de marca, modelo, número de serie, activo fijo, capacidad máxima y división de escala legibles' },
        { id: 's374vi9', item: 'Sello, marca de verificación metrológica o etiqueta de calibración vigente sin evidencia de manipulación, cuando aplique' },
        { id: 's374vi10', item: 'Bandeja y carcasa desinfectadas con producto compatible, sin acumulación de residuos en uniones, botones o display' },
        { id: 's374vi11', item: 'No hay interferencia mecánica entre bandeja/plataforma y carcasa; la plataforma queda libre para medir peso' },
        { id: 's374vi12', item: 'Área de instalación libre de vibraciones, superficies blandas, desniveles, cables tensos u objetos en contacto con la báscula' },
      ],
      verificacionBasica: [
        { id: 's374vb1', item: 'La báscula enciende correctamente con baterías y/o adaptador, realiza autoverificación y muestra cero sin códigos de error' },
        { id: 's374vb2', item: 'El indicador de batería no muestra condición de batería baja; si aparece “batt” o equivalente se reemplazan baterías' },
        { id: 's374vb3', item: 'La lectura retorna a cero al retirar toda carga de la bandeja y no presenta deriva visible en reposo' },
        { id: 's374vb4', item: 'La tecla TARE o cero compensa correctamente un paño o accesorio liviano y permite pesar al paciente sin incluir dicho peso' },
        { id: 's374vb5', item: 'La función HOLD o estabilización mantiene una lectura estable cuando aplica, sin bloquear el equipo' },
        { id: 's374vb6', item: 'La unidad de medida configurada corresponde a kg/g según uso institucional y no se cambia accidentalmente' },
        { id: 's374vb7', item: 'La báscula se apaga correctamente por tecla o autoapagado, conservando operación normal al encender nuevamente' },
        { id: 's374vb8', item: 'No aparecen mensajes de error durante encendido, carga, tara, descarga o apagado' },
      ],
      pruebasFuncionales: [
        { id: 's374pf1', prueba: 'Encendido/autotest — Encender la báscula sin carga sobre superficie firme y nivelada', valorEsperado: 'Autoverificación completa y lectura 0,000 kg / 0 g sin mensajes de error', resultado: ['Pasa', 'Falla'] },
        { id: 's374pf2', prueba: 'Cero inicial — Esperar 30 segundos sin carga y observar lectura', valorEsperado: 'Lectura permanece en cero, sin deriva ni oscilación significativa', resultado: ['Pasa', 'Falla'] },
        { id: 's374pf3', prueba: 'Prueba de tara — Colocar paño/accesorio liviano y activar TARE', valorEsperado: 'La lectura vuelve a cero y al retirar el accesorio muestra valor negativo o retorna según diseño del equipo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's374pf4', prueba: 'Exactitud punto bajo — Aplicar peso patrón aproximado de 2 kg centrado en la bandeja', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida para el equipo', resultado: ['Pasa', 'Falla'] },
        { id: 's374pf5', prueba: 'Exactitud punto medio — Aplicar peso patrón aproximado de 5 kg centrado en la bandeja', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida para el equipo', resultado: ['Pasa', 'Falla'] },
        { id: 's374pf6', prueba: 'Exactitud punto alto — Aplicar peso patrón aproximado de 10 kg o carga cercana al uso clínico habitual', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida para el equipo, sin sobrecarga', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's374pf7', prueba: 'Repetibilidad — Aplicar y retirar el mismo peso patrón al menos 3 veces', valorEsperado: 'Lecturas repetibles, sin variación mayor a la tolerancia definida por metrología', resultado: ['Pasa', 'Falla'] },
        { id: 's374pf8', prueba: 'Excentricidad — Aplicar peso patrón en centro, extremos derecho/izquierdo y zona superior/inferior de la bandeja', valorEsperado: 'Lecturas consistentes entre posiciones y dentro de tolerancia', resultado: ['Pasa', 'Falla'] },
        { id: 's374pf9', prueba: 'Retorno a cero — Retirar peso después de cada medición', valorEsperado: 'Retorna a cero sin quedar con lectura residual', resultado: ['Pasa', 'Falla'] },
        { id: 's374pf10', prueba: 'Función HOLD/estabilización — Aplicar peso y activar función si el modelo la tiene habilitada', valorEsperado: 'El valor se mantiene estable y se libera correctamente según operación del equipo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's374pf11', prueba: 'Cambio de unidad kg/lb o kg/g — Verificar configuración institucional', valorEsperado: 'Permite confirmar o mantener unidad requerida sin alterar la medición', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's374pf12', prueba: 'Alimentación con baterías — Operar la báscula con baterías durante prueba completa', valorEsperado: 'Funcionamiento estable, sin reinicios, apagados inesperados ni indicador de batería baja', resultado: ['Pasa', 'Falla'] },
        { id: 's374pf13', prueba: 'Alimentación con adaptador — Si aplica, operar con adaptador y mover suavemente el conector', valorEsperado: 'Sin falsos contactos, reinicios o interrupciones de energía', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's374pf14', prueba: 'Prueba de estabilidad mecánica — Presionar suavemente apoyos y verificar nivelación', valorEsperado: 'La báscula permanece firme, sin balanceo, ruido mecánico o desplazamiento', resultado: ['Pasa', 'Falla'] },
        { id: 's374pf15', prueba: 'Apagado y reinicio — Apagar/encender después de las pruebas metrológicas', valorEsperado: 'Reinicia normalmente, vuelve a cero y no conserva errores', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de bandeja, display y carcasa',
        'Nivelación y estabilización sobre superficie firme',
        'Cambio de baterías AA',
        'Verificación de adaptador de red y conector de alimentación',
        'Verificación de cero, tara, hold y unidad de medida',
        'Verificación comparativa con pesas patrón calibradas',
        'Prueba de repetibilidad y excentricidad',
        'Registro de desviación y recomendación de calibración externa si aplica',
        'Retiro de servicio por error, lectura inestable, daño físico o desviación fuera de tolerancia',
        'Remisión a servicio técnico autorizado para ajuste, recalibración o reparación',
      ],
    },

    'bascula_seca_333': {
      nombre: 'Báscula Bebé Seca 333',
      categoria: 'Biomédico / Antropometría neonatal',
      codigo: 'SLV-GAT-BIO-BB-SECA333',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que la báscula bebé Seca 333 se encuentre fuera de uso clínico, limpia, seca y ubicada sobre una superficie firme, estable, rígida y nivelada antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de masas patrón calibradas o pesas trazables para puntos bajo, medio y alto dentro de la capacidad máxima del equipo, paño suave, desinfectante compatible, baterías AA y adaptador original si aplica.',
        'Retire al paciente, cobijas, accesorios y objetos de la bandeja antes de encender o tarar el equipo. No deje al neonato sin supervisión durante ninguna verificación simulada.',
        'No someta la bandeja a golpes, caídas, cargas superiores a la capacidad nominal ni fuerzas laterales que puedan afectar las celdas de carga.',
        'Permita estabilización térmica del equipo y evite corrientes de aire, vibraciones, contacto con superficies externas o cables tensos que puedan alterar la lectura.',
        'Utilice únicamente fuente de alimentación original/compatible de 12 V controlada si el equipo opera con adaptador. No use adaptadores dañados, modificados o con calentamiento.',
        'No abra la carcasa ni manipule celdas de carga, tarjeta electrónica, interfaz Wi-Fi/USB, sellos metrológicos o parámetros internos durante el mantenimiento preventivo rutinario.',
        'Si se evidencian mensajes de error, lectura inestable, falla de cero/tara, daño de bandeja, humedad interna, batería sulfatada, desviación fuera de tolerancia o manipulación del sello metrológico, retire de servicio y genere correctivo/calibración.'
      ],
      inspeccion: [
        { id: 's333i1', item: 'Bandeja pediátrica de pesaje íntegra, limpia, sin fisuras, deformaciones, bordes cortantes, manchas permanentes, piezas sueltas ni daño visible' },
        { id: 's333i2', item: 'Base y estructura inferior sin golpes, grietas, torsión, humedad interna, corrosión, evidencia de caída o puntos de apoyo deteriorados' },
        { id: 's333i3', item: 'Apoyos/patas completos, firmes y nivelados; el equipo queda estable y no presenta balanceo sobre la superficie de trabajo' },
        { id: 's333i4', item: 'Display LCD iluminado legible, sin segmentos faltantes, manchas, parpadeos, condensación ni lectura intermitente' },
        { id: 's333i5', item: 'Teclas ON/OFF, TARE, HOLD, SEND/PRINT, kg/lb o equivalentes íntegras, legibles, sin atascamiento y con respuesta táctil adecuada' },
        { id: 's333i6', item: 'Compartimiento de baterías limpio, seco, sin sulfatación, corrosión, contactos flojos, tapa quebrada ni baterías con fuga' },
        { id: 's333i7', item: 'Baterías AA instaladas en buen estado, con polaridad correcta y sin indicador de batería baja durante la prueba' },
        { id: 's333i8', item: 'Adaptador de red y conector de alimentación, si aplica, sin cortes, fisuras, falsos contactos, calentamiento, empalmes o partes expuestas' },
        { id: 's333i9', item: 'Puerto USB para lector de código de barras y/o comunicación, si aplica, sin pines doblados, suciedad, holgura o daño mecánico' },
        { id: 's333i10', item: 'Módulo Wi-Fi/indicadores de comunicación, si aplica, sin mensajes de error y con configuración institucional conservada' },
        { id: 's333i11', item: 'Regla de medición seca 232 n / 234 o accesorio de tallaje, si aplica, firme, legible, sin atascamiento y correctamente acoplado' },
        { id: 's333i12', item: 'Rotulación de marca, modelo, número de serie, activo fijo, capacidad máxima, división de escala y advertencias de seguridad legibles' },
        { id: 's333i13', item: 'Sello, etiqueta de verificación o calibración metrológica vigente y sin evidencia de manipulación, cuando aplique' },
        { id: 's333i14', item: 'Superficie y uniones desinfectadas con producto compatible; sin residuos químicos, humedad en botones, display, conectores o compartimento de baterías' },
        { id: 's333i15', item: 'La bandeja/plataforma queda libre, sin interferencia mecánica con carcasa, accesorios, pared, mesa o cables durante la medición' }
      ],
      verificacionBasica: [
        { id: 's333vb1', item: 'La báscula enciende correctamente con baterías y/o adaptador, realiza autoverificación y muestra cero sin códigos de error persistentes' },
        { id: 's333vb2', item: 'Con la bandeja libre de carga, la lectura retorna a 0,000 kg / 0 g y permanece estable después del encendido' },
        { id: 's333vb3', item: 'La tecla TARE descuenta correctamente un paño, sabanilla o accesorio liviano y permite medición neta del paciente' },
        { id: 's333vb4', item: 'La función HOLD/Auto-HOLD retiene una lectura estable y permite liberarla o reiniciar medición según el modo del equipo' },
        { id: 's333vb5', item: 'La unidad de medida configurada corresponde al uso institucional, preferiblemente kg/g, sin cambios accidentales durante la prueba' },
        { id: 's333vb6', item: 'El indicador de batería no muestra advertencia de batería baja; si aparece, se reemplazan las baterías y se repite la verificación' },
        { id: 's333vb7', item: 'El equipo apaga correctamente por tecla o autoapagado y reinicia sin conservar errores o bloqueos' },
        { id: 's333vb8', item: 'Si el modelo tiene Wi-Fi/USB/SEND, la función de transmisión o indicador de comunicación responde sin error, o se deja en N/A si no está habilitada' },
        { id: 's333vb9', item: 'Si cuenta con tallímetro acoplado, el desplazamiento y lectura de longitud son suaves, legibles y retornan a posición segura' }
      ],
      pruebasFuncionales: [
        { id: 's333pf1', prueba: 'Encendido/autotest — Encender sin carga sobre superficie firme y nivelada', valorEsperado: 'Autoverificación completa, display legible y lectura 0,000 kg / 0 g sin mensajes de error', resultado: ['Pasa', 'Falla'] },
        { id: 's333pf2', prueba: 'Cero inicial — Mantener la bandeja libre de carga durante 30 segundos', valorEsperado: 'Lectura permanece en cero, sin deriva ni oscilación significativa', resultado: ['Pasa', 'Falla'] },
        { id: 's333pf3', prueba: 'Tara — Colocar paño/accesorio liviano, activar TARE y retirar', valorEsperado: 'Compensa el peso del accesorio y retorna de forma coherente al retirar la carga', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's333pf4', prueba: 'Exactitud punto bajo — Aplicar masa patrón aproximada de 2 kg centrada en la bandeja', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida para el equipo', resultado: ['Pasa', 'Falla'] },
        { id: 's333pf5', prueba: 'Exactitud punto medio — Aplicar masa patrón aproximada de 5 kg centrada en la bandeja', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida para el equipo', resultado: ['Pasa', 'Falla'] },
        { id: 's333pf6', prueba: 'Exactitud punto alto — Aplicar masa patrón aproximada de 10 kg o carga cercana al uso clínico habitual', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida, sin mensaje de sobrecarga', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's333pf7', prueba: 'Verificación cerca de capacidad máxima — Aplicar carga segura sin exceder la capacidad indicada en placa', valorEsperado: 'Equipo responde sin error, deformación ni inestabilidad; nunca exceder 20 kg si corresponde al modelo instalado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's333pf8', prueba: 'Repetibilidad — Aplicar y retirar el mismo peso patrón al menos 3 veces en el centro', valorEsperado: 'Lecturas repetibles, con variación dentro de la tolerancia definida por metrología', resultado: ['Pasa', 'Falla'] },
        { id: 's333pf9', prueba: 'Excentricidad — Aplicar peso patrón en centro, extremos derecho/izquierdo y zona superior/inferior de la bandeja', valorEsperado: 'Lecturas consistentes entre posiciones y dentro de tolerancia institucional', resultado: ['Pasa', 'Falla'] },
        { id: 's333pf10', prueba: 'Retorno a cero — Retirar toda carga después de cada medición', valorEsperado: 'La lectura retorna a cero estable sin quedar con valor residual', resultado: ['Pasa', 'Falla'] },
        { id: 's333pf11', prueba: 'Función HOLD/Auto-HOLD — Aplicar peso estable y activar/confirmar retención', valorEsperado: 'El valor queda retenido de forma estable y se libera correctamente para nueva medición', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's333pf12', prueba: 'Función SEND/PRINT/USB/Wi-Fi, si aplica', valorEsperado: 'El equipo permite enviar/registrar el resultado o muestra estado de comunicación sin errores; dejar N/A si no está configurado institucionalmente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's333pf13', prueba: 'Alimentación con baterías — Operar durante la prueba completa', valorEsperado: 'Funcionamiento estable, sin reinicios, apagados inesperados ni indicador de batería baja', resultado: ['Pasa', 'Falla'] },
        { id: 's333pf14', prueba: 'Alimentación con adaptador — Si aplica, operar con fuente y mover suavemente el conector', valorEsperado: 'Sin falsos contactos, reinicios, calentamiento ni interrupciones de energía', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's333pf15', prueba: 'Tallímetro seca 232 n / 234, si aplica — Desplazar a lo largo del rango de medición', valorEsperado: 'Movimiento suave, escala legible, fijación estable y sin interferencia con la bandeja', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's333pf16', prueba: 'Limpieza/desinfección posterior', valorEsperado: 'Equipo seco, sin residuos químicos, sin humedad en display, botones, conectores o compartimento de baterías', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de bandeja, display, base y superficie de apoyo',
        'Nivelación y estabilización sobre superficie firme',
        'Revisión de carcasa, bandeja, apoyos, display, teclado, etiquetas y sellos',
        'Cambio de baterías AA',
        'Verificación de adaptador de red y conector de alimentación',
        'Verificación de cero, tara, HOLD/Auto-HOLD, unidad de medida y apagado',
        'Verificación comparativa con pesas patrón calibradas',
        'Prueba de repetibilidad, excentricidad, retorno a cero y estabilidad',
        'Verificación de comunicación SEND/USB/Wi-Fi y tallímetro, si aplica',
        'Registro de desviaciones metrológicas y recomendación de calibración externa si aplica',
        'Retiro de servicio por error, lectura inestable, daño físico, humedad interna o desviación fuera de tolerancia',
        'Remisión a servicio técnico autorizado SECA o proveedor metrológico especializado'
      ]
    },

    'bascula_seca_334': {
      nombre: 'Báscula Bebé Seca 334',
      categoria: 'Biomédico / Antropometría neonatal',
      codigo: 'SLV-GAT-BIO-BB-SECA334',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que la báscula bebé Seca 334 se encuentre fuera de uso clínico, limpia, seca y ubicada sobre una superficie firme, estable, rígida y nivelada antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de masas patrón calibradas o pesas trazables para puntos bajo, medio y alto dentro de la capacidad máxima del equipo, paño suave, desinfectante compatible, seis baterías AA y adaptador de red original/compatible si aplica.',
        'Retire al paciente, cobijas, accesorios y objetos de la bandeja antes de encender, tarar o verificar el equipo. Nunca deje al bebé sin supervisión sobre la báscula.',
        'No someta la bandeja a golpes, caídas, cargas superiores a la capacidad nominal de 20 kg ni fuerzas laterales que puedan afectar el sistema de medición.',
        'Permita estabilización térmica del equipo y evite corrientes de aire, vibraciones, superficies blandas, cables tensos u objetos en contacto con la bandeja durante la medición.',
        'Utilice únicamente baterías en buen estado y fuente de alimentación original/compatible si el equipo opera con adaptador. No use adaptadores dañados, modificados o con calentamiento.',
        'No abra la carcasa ni manipule celdas de carga, tarjeta electrónica, sellos metrológicos o parámetros internos durante el mantenimiento preventivo rutinario.',
        'Si se evidencian mensajes de error, lectura inestable, falla de cero/tara, daño de bandeja, humedad interna, batería sulfatada, desviación fuera de tolerancia o manipulación del sello metrológico, retire de servicio y genere correctivo/calibración.'
      ],
      inspeccion: [
        { id: 's334i1', item: 'Bandeja pediátrica de pesaje íntegra, limpia, sin fisuras, deformaciones, bordes cortantes, manchas permanentes, piezas sueltas ni daño visible' },
        { id: 's334i2', item: 'Base y estructura inferior sin golpes, grietas, torsión, humedad interna, corrosión, evidencia de caída o puntos de apoyo deteriorados' },
        { id: 's334i3', item: 'Asa de transporte/soporte para colgar íntegra, firme y sin fisuras que comprometan el transporte seguro del equipo' },
        { id: 's334i4', item: 'Apoyos/patas completos, firmes y nivelados; el equipo queda estable y no presenta balanceo sobre la superficie de trabajo' },
        { id: 's334i5', item: 'Display LCD grande y legible, sin segmentos faltantes, manchas, parpadeos, condensación ni lectura intermitente' },
        { id: 's334i6', item: 'Teclas START, TARE, STORE/BMIF, kg/lb o equivalentes íntegras, legibles, sin atascamiento y con respuesta táctil adecuada' },
        { id: 's334i7', item: 'Compartimiento de baterías limpio, seco, sin sulfatación, corrosión, contactos flojos, tapa quebrada ni baterías con fuga' },
        { id: 's334i8', item: 'Seis baterías AA instaladas con polaridad correcta, sin deformación, fuga o indicador bAtt durante la prueba' },
        { id: 's334i9', item: 'Adaptador de red y conector de alimentación, si aplica, sin cortes, fisuras, falsos contactos, calentamiento, empalmes o partes expuestas' },
        { id: 's334i10', item: 'Rotulación de marca, modelo, número de serie, activo fijo, capacidad máxima, división de escala y advertencias de seguridad legibles' },
        { id: 's334i11', item: 'Sello, etiqueta de verificación o calibración metrológica vigente y sin evidencia de manipulación, cuando aplique' },
        { id: 's334i12', item: 'Superficie y uniones desinfectadas con producto compatible; sin residuos químicos ni humedad en botones, display, conectores o compartimento de baterías' },
        { id: 's334i13', item: 'La bandeja/plataforma queda libre, sin interferencia mecánica con carcasa, accesorios, pared, mesa o cables durante la medición' },
        { id: 's334i14', item: 'Accesorio de tallaje acoplable, si aplica, firme, legible, sin atascamiento y correctamente ajustado al equipo' }
      ],
      verificacionBasica: [
        { id: 's334vb1', item: 'La báscula enciende correctamente con la tecla START, realiza autoverificación y muestra cero sin códigos de error persistentes' },
        { id: 's334vb2', item: 'Con la bandeja libre de carga, la lectura retorna a 0,000 kg / 0 g y permanece estable después del encendido' },
        { id: 's334vb3', item: 'La tecla TARE descuenta correctamente un paño, sabanilla o accesorio liviano y permite medición neta del paciente' },
        { id: 's334vb4', item: 'La función Auto-HOLD retiene una lectura estable para cargas superiores al umbral funcional y permite nueva medición al retirar la carga' },
        { id: 's334vb5', item: 'La función STORE/BMIF guarda un peso de referencia y permite visualizar diferencia de peso en una medición posterior, si está habilitada' },
        { id: 's334vb6', item: 'La unidad de medida configurada corresponde al uso institucional, preferiblemente kg/g, sin cambios accidentales durante la prueba' },
        { id: 's334vb7', item: 'El indicador de batería no muestra advertencia bAtt o batería baja; si aparece, se reemplazan las baterías y se repite la verificación' },
        { id: 's334vb8', item: 'El equipo apaga correctamente por tecla o autoapagado y reinicia sin conservar errores o bloqueos' },
        { id: 's334vb9', item: 'No aparecen mensajes de error durante encendido, carga, tara, función diferencial, descarga o apagado' }
      ],
      pruebasFuncionales: [
        { id: 's334pf1', prueba: 'Encendido/autotest — Encender sin carga sobre superficie firme y nivelada', valorEsperado: 'Autoverificación completa, display legible y lectura 0,000 kg / 0 g sin mensajes de error', resultado: ['Pasa', 'Falla'] },
        { id: 's334pf2', prueba: 'Cero inicial — Mantener la bandeja libre de carga durante 30 segundos', valorEsperado: 'Lectura permanece en cero, sin deriva ni oscilación significativa', resultado: ['Pasa', 'Falla'] },
        { id: 's334pf3', prueba: 'Tara — Colocar paño/accesorio liviano, activar TARE y retirar', valorEsperado: 'Compensa el peso del accesorio y retorna de forma coherente al retirar la carga', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's334pf4', prueba: 'Exactitud punto bajo — Aplicar masa patrón aproximada de 2 kg centrada en la bandeja', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida para el equipo', resultado: ['Pasa', 'Falla'] },
        { id: 's334pf5', prueba: 'Exactitud punto medio — Aplicar masa patrón aproximada de 5 kg centrada en la bandeja', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida para el equipo', resultado: ['Pasa', 'Falla'] },
        { id: 's334pf6', prueba: 'Exactitud punto alto — Aplicar masa patrón aproximada de 10 kg o carga cercana al uso clínico habitual', valorEsperado: 'Lectura dentro de la tolerancia institucional/metrológica definida, sin mensaje de sobrecarga', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's334pf7', prueba: 'Verificación cerca de capacidad máxima — Aplicar carga segura sin exceder la capacidad indicada en placa', valorEsperado: 'Equipo responde sin error, deformación ni inestabilidad; nunca exceder 20 kg si corresponde al modelo instalado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's334pf8', prueba: 'Repetibilidad — Aplicar y retirar el mismo peso patrón al menos 3 veces en el centro', valorEsperado: 'Lecturas repetibles, con variación dentro de la tolerancia definida por metrología', resultado: ['Pasa', 'Falla'] },
        { id: 's334pf9', prueba: 'Excentricidad — Aplicar peso patrón en centro, extremos derecho/izquierdo y zona superior/inferior de la bandeja', valorEsperado: 'Lecturas consistentes entre posiciones y dentro de tolerancia institucional', resultado: ['Pasa', 'Falla'] },
        { id: 's334pf10', prueba: 'Retorno a cero — Retirar toda carga después de cada medición', valorEsperado: 'La lectura retorna a cero estable sin quedar con valor residual', resultado: ['Pasa', 'Falla'] },
        { id: 's334pf11', prueba: 'Auto-HOLD — Aplicar peso estable superior a 0,4 kg y esperar estabilización', valorEsperado: 'El valor queda retenido de forma estable y se libera correctamente para nueva medición', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's334pf12', prueba: 'Función BMIF/STORE — Guardar un peso y realizar una segunda medición con diferencia controlada', valorEsperado: 'El equipo muestra la diferencia de peso de forma coherente; dejar N/A si la función no está habilitada institucionalmente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's334pf13', prueba: 'Cambio de unidad kg/lb — Verificar y retornar a configuración institucional', valorEsperado: 'Permite confirmar o mantener la unidad requerida sin alterar la medición', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's334pf14', prueba: 'Alimentación con baterías — Operar durante la prueba completa', valorEsperado: 'Funcionamiento estable, sin reinicios, apagados inesperados ni indicador de batería baja', resultado: ['Pasa', 'Falla'] },
        { id: 's334pf15', prueba: 'Alimentación con adaptador — Si aplica, operar con fuente y mover suavemente el conector', valorEsperado: 'Sin falsos contactos, reinicios, calentamiento ni interrupciones de energía', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's334pf16', prueba: 'Apagado automático — Dejar sin carga y sin operación hasta el tiempo de autoapagado', valorEsperado: 'El equipo entra en ahorro de energía o se apaga según especificación, y reinicia normalmente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's334pf17', prueba: 'Tallímetro/accesorio de longitud, si aplica — Desplazar a lo largo del rango de medición', valorEsperado: 'Movimiento suave, escala legible, fijación estable y sin interferencia con la bandeja', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 's334pf18', prueba: 'Limpieza/desinfección posterior', valorEsperado: 'Equipo seco, sin residuos químicos, sin humedad en display, botones, conectores o compartimento de baterías', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de bandeja, display, base y superficie de apoyo',
        'Nivelación y estabilización sobre superficie firme',
        'Revisión de carcasa, bandeja, apoyos, asa de transporte, display, teclado, etiquetas y sellos',
        'Cambio de baterías AA',
        'Verificación de adaptador de red y conector de alimentación',
        'Verificación de cero, tara, Auto-HOLD, STORE/BMIF, unidad de medida y apagado',
        'Verificación comparativa con pesas patrón calibradas',
        'Prueba de repetibilidad, excentricidad, retorno a cero y estabilidad',
        'Verificación de tallímetro o accesorio de longitud, si aplica',
        'Registro de desviaciones metrológicas y recomendación de calibración externa si aplica',
        'Retiro de servicio por error, lectura inestable, daño físico, humedad interna o desviación fuera de tolerancia',
        'Remisión a servicio técnico autorizado SECA o proveedor metrológico especializado'
      ]
    },

    'regulador_vacio_amvex_c2a': {
      nombre: 'Regulador de Vacío AMVEX Modelo C2A',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-RV',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo se encuentre limpio, seco y sin evidencia de contaminación visible.',
        'Confirme disponibilidad del equipo de verificación: vacuómetro patrón o analizador de vacío calibrado.',
        'No desarme el regulador ni intervenga componentes internos durante el preventivo rutinario.',
        'Si se evidencian daños, fugas, lectura errática o contaminación interna, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'iv1', item: 'Carcasa íntegra, sin golpes, grietas ni deformaciones' },
        { id: 'iv2', item: 'Manómetro legible y sin fisuras' },
        { id: 'iv3', item: 'Perilla de regulación con giro uniforme' },
        { id: 'iv4', item: 'Selector de modo en buen estado (OFF / REG / INT si aplica)' },
        { id: 'iv5', item: 'Puertos y conexiones sin obstrucción' },
        { id: 'iv6', item: 'Adaptador mural o conexión de entrada en buen estado' },
        { id: 'iv7', item: 'Mangueras, filtro bacteriano y trampa de rebose en buen estado' },
        { id: 'iv8', item: 'Limpieza externa realizada con detergente suave diluido y secado completo' },
      ],
      pruebasFuncionales: [
        { id: 'pf1', prueba: 'Selector en OFF con línea ocluida', valorEsperado: 'Sin movimiento de aguja / 0', resultado: ['Pasa', 'Falla'] },
        { id: 'pf2', prueba: 'Selector en REG con perilla totalmente antihoraria y línea ocluida', valorEsperado: 'Sin lectura de vacío', resultado: ['Pasa', 'Falla'] },
        { id: 'pf3', prueba: 'Ajuste de vacío estándar para verificación', valorEsperado: '-90 mmHg (-12 kPa)', resultado: ['Pasa', 'Falla'] },
        { id: 'pf4', prueba: 'Estabilidad de lectura con línea ocluida durante 30 s', valorEsperado: 'Estable, sin caída apreciable', resultado: ['Pasa', 'Falla'] },
        { id: 'pf5', prueba: 'Verificación modo intermitente (si aplica al equipo)', valorEsperado: 'Ciclo funcional observado', resultado: ['Aplica', 'N/A'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Cambio de accesorios externos', 'Verificación funcional', 'Remisión a servicio técnico'],
    },
    'regulador_vacio_amvex_vra': {
      nombre: 'Regulador de Vacío AMVEX VRA',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-RV-VRA',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el regulador AMVEX VRA se encuentre fuera de uso clínico, limpio, seco y sin conexión a paciente antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de fuente de vacío hospitalaria, vacuómetro patrón o analizador de vacío calibrado y accesorios externos requeridos: manguera, filtro bacteriano/hidrofóbico, trampa de rebose y canister.',
        'Para la prueba funcional, confirme que el suministro de vacío de la red sea suficiente y estable antes de evaluar el regulador.',
        'Instale filtro bacteriano/hidrofóbico y trampa de rebose entre el regulador y el sistema colector para prevenir ingreso de fluidos al regulador.',
        'No utilice el equipo si hay evidencia de contaminación interna, ingreso de líquidos, frasco colector lleno, filtro húmedo/saturado o trampa de rebose restringida.',
        'No desarme el regulador ni intervenga manómetro, selector, válvulas, diafragma, empaques u O-rings durante el mantenimiento preventivo rutinario.',
        'Si se evidencian fugas, lectura errática, daño físico, manómetro fuera de tolerancia o contaminación interna, retire de servicio y remita a soporte técnico autorizado.',
        'No esterilice en autoclave, no sumerja en líquidos y evite el ingreso de desinfectantes por puertos, selector, perilla o manómetro.',
      ],
      inspeccion: [
        { id: 'vravi1', item: 'Carcasa frontal y posterior íntegra, sin grietas, golpes, deformaciones, partes faltantes ni signos de apertura no autorizada' },
        { id: 'vravi2', item: 'Manómetro analógico legible, lente sin fisuras, aguja en cero sin vacío aplicado y escala visible en todo el rango' },
        { id: 'vravi3', item: 'Perilla de regulación con giro suave y progresivo, sin trabas, holgura excesiva o desprendimiento' },
        { id: 'vravi4', item: 'Selector OFF / REG / FULL o modo equivalente con posiciones definidas, rotulación legible y enclavamiento correcto' },
        { id: 'vravi5', item: 'Puerto de entrada hacia toma mural o conexión institucional sin fisuras, deformación, desgaste de rosca/adaptador u obstrucción' },
        { id: 'vravi6', item: 'Puerto de salida hacia paciente/canister sin obstrucción, fisuras, contaminación visible ni daño en conexión' },
        { id: 'vravi7', item: 'Adaptador mural, manguera de vacío y conexiones institucionales sin cortes, endurecimiento, deformación o fuga visible' },
        { id: 'vravi8', item: 'Filtro bacteriano/hidrofóbico presente, seco, vigente, sin humedad, decoloración, bloqueo o saturación' },
        { id: 'vravi9', item: 'Trampa de rebose/overflow safety trap instalada, limpia, transparente, libre de restricciones y con flotador funcional si aplica' },
        { id: 'vravi10', item: 'Canister, tapa, empaques y tubuladuras externos limpios, íntegros y sin evidencia de rebose hacia el regulador' },
        { id: 'vravi11', item: 'Etiquetas de identificación, activo fijo, marca, modelo y número de serie legibles y coincidentes con inventario' },
        { id: 'vravi12', item: 'Limpieza externa realizada con paño suave y desinfectante compatible, evitando ingreso de líquido a puertos o selector' },
      ],
      verificacionBasica: [
        { id: 'vravb1', item: 'Al conectar a la fuente de vacío y ocluir la salida, el manómetro responde de forma progresiva al ajuste de la perilla' },
        { id: 'vravb2', item: 'En posición OFF no se transmite vacío al puerto de salida con la línea ocluida' },
        { id: 'vravb3', item: 'En posición REG el equipo permite regulación continua, estable y repetible sin saltos bruscos de lectura' },
        { id: 'vravb4', item: 'En posición FULL el regulador entrega el máximo vacío disponible de la red/fuente sin bloqueo ni oscilación anormal' },
        { id: 'vravb5', item: 'La aguja retorna a cero al liberar la oclusión, disminuir el ajuste y colocar el selector en OFF' },
        { id: 'vravb6', item: 'No se perciben fugas audibles en puertos, selector, manómetro, adaptador mural, manguera, filtro, trampa o canister' },
        { id: 'vravb7', item: 'Filtro, trampa de rebose y tubuladuras no restringen el flujo durante la verificación funcional' },
      ],
      pruebasFuncionales: [
        { id: 'vrapf1', prueba: 'Suministro de vacío — Medir vacío disponible en la toma/fuente antes del regulador', valorEsperado: 'Vacío de red estable y suficiente para la prueba; referencia mínima ≥ -400 mmHg cuando aplique', resultado: ['Pasa', 'Falla'] },
        { id: 'vrapf2', prueba: 'Selector en OFF — Ocluir salida y girar perilla una vuelta en sentido horario', valorEsperado: 'Sin movimiento de aguja / lectura permanece en 0 mmHg', resultado: ['Pasa', 'Falla'] },
        { id: 'vrapf3', prueba: 'Selector en REG con perilla totalmente antihoraria — Ocluir salida', valorEsperado: 'Sin incremento de vacío / lectura permanece en 0 mmHg', resultado: ['Pasa', 'Falla'] },
        { id: 'vrapf4', prueba: 'Ajuste de vacío bajo — En REG, ocluir salida y ajustar lentamente', valorEsperado: '-80 a -100 mmHg con lectura estable', resultado: ['Pasa', 'Falla'] },
        { id: 'vrapf5', prueba: 'Ajuste de vacío medio — En REG, ocluir salida y aumentar progresivamente', valorEsperado: '-180 a -220 mmHg con lectura estable', resultado: ['Pasa', 'Falla'] },
        { id: 'vrapf6', prueba: 'Ajuste de vacío alto — En REG, ocluir salida y aumentar dentro del rango seguro del equipo/red', valorEsperado: 'Regulación progresiva sin vibración de aguja, bloqueo ni sobrepaso no controlado', resultado: ['Pasa', 'Falla'] },
        { id: 'vrapf7', prueba: 'Estabilidad del ajuste — Mantener ajuste estándar de -90 mmHg con salida ocluida durante 30 segundos', valorEsperado: 'Lectura estable, variación ≤ ±10 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'vrapf8', prueba: 'Respuesta a variación de flujo — Abrir y cerrar lentamente la línea ocluida en REG', valorEsperado: 'El vacío cambia y retorna al ajuste sin oscilaciones sostenidas', resultado: ['Pasa', 'Falla'] },
        { id: 'vrapf9', prueba: 'Modo FULL — Colocar selector en FULL y ocluir salida', valorEsperado: 'Manómetro refleja el máximo vacío disponible de la red/fuente', resultado: ['Pasa', 'Falla'] },
        { id: 'vrapf10', prueba: 'Hermeticidad del conjunto externo — Mantener sistema ocluido con accesorios instalados', valorEsperado: 'Sin fuga audible ni caída apreciable del vacío durante la observación', resultado: ['Pasa', 'Falla'] },
        { id: 'vrapf11', prueba: 'Retorno a cero y cierre — Disminuir vacío con perilla hasta cero y mover selector a OFF', valorEsperado: 'Lectura retorna a 0 mmHg y no queda vacío residual aplicado', resultado: ['Pasa', 'Falla'] },
        { id: 'vrapf12', prueba: 'Verificación de accesorios de protección — Evaluar filtro, trampa de rebose y canister durante operación', valorEsperado: 'Instalados correctamente, secos, sin bloqueo y sin paso de fluidos al regulador', resultado: ['Pasa', 'Falla', 'N/A'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa con producto compatible',
        'Verificación funcional OFF / REG / FULL',
        'Verificación de vacío con vacuómetro patrón o analizador calibrado',
        'Cambio de filtro bacteriano / hidrofóbico',
        'Revisión o cambio de mangueras, trampa de rebose, canister o accesorios externos',
        'Retiro de servicio por fuga, contaminación, daño físico o lectura fuera de tolerancia',
        'Remisión a servicio técnico autorizado para reparación interna o calibración avanzada',
      ],
    },

    'termometro_fridge_freezer_nevera': {
      nombre: 'Termómetro Digital Fridge/Freezer para Nevera y Congelador',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-TFF',
      frecuencia: ['Mensual', 'Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el termómetro se encuentre identificado, limpio, seco y disponible para inspección, sin comprometer la cadena de frío del servicio.',
        'Confirme disponibilidad de termómetro patrón o calibrador de temperatura con certificado vigente para comparación en puntos de nevera y congelador.',
        'Use baterías nuevas o verificadas; no mezcle baterías nuevas/usadas, alcalinas/recargables o de marcas diferentes.',
        'Si el equipo cuenta con sonda remota cableada, no hale el cable, no lo doble en exceso y no lo ubique en zonas donde pueda quedar prensado por la puerta.',
        'No sumerja la unidad de visualización en líquidos; limpie únicamente con paño suave ligeramente humedecido y desinfectante compatible.',
        'No exponga el termómetro a hornos, autoclaves, calor directo, humedad excesiva o temperaturas fuera del rango indicado por el fabricante.',
        'Si el display muestra segmentos incompletos, lectura errática, guiones, alarma defectuosa o daño en la sonda/cable, retire de servicio y remita a revisión o reposición.',
        'Antes de emitir concepto final, permita estabilización térmica suficiente de la sonda en el medio evaluado y registre temperatura ambiente, temperatura de nevera y/o temperatura de congelador según aplique.',
      ],
      inspeccion: [
        { id: 'tffvi1', item: 'Carcasa de la unidad de visualización íntegra, sin fisuras, golpes, deformaciones, humedad interna o partes sueltas' },
        { id: 'tffvi2', item: 'Pantalla LCD legible, sin segmentos faltantes, manchas, condensación o lectura intermitente' },
        { id: 'tffvi3', item: 'Botones de operación MAX/MIN, °C/°F, alarma, reset o equivalentes íntegros y con respuesta táctil adecuada' },
        { id: 'tffvi4', item: 'Sonda remota o sensor interno limpio, sin corrosión, golpes, desprendimiento, humedad interna o daño visible' },
        { id: 'tffvi5', item: 'Cable de sonda sin cortes, aplastamientos, endurecimiento, peladuras, falsos contactos o conectores flojos' },
        { id: 'tffvi6', item: 'Compartimiento de batería limpio, seco, sin sulfatación, corrosión, deformación de contactos o tapa floja' },
        { id: 'tffvi7', item: 'Batería con polaridad correcta, voltaje adecuado y sin evidencia de fuga o agotamiento' },
        { id: 'tffvi8', item: 'Soporte, imán, clip, base o sistema de fijación funcional y seguro para instalación en nevera/congelador' },
        { id: 'tffvi9', item: 'Rotulación de identificación institucional, servicio, activo fijo y fecha de última verificación/calibración legibles' },
        { id: 'tffvi10', item: 'Unidad y sonda limpias, sin residuos biológicos, químicos, polvo, grasa o contaminación visible' },
        { id: 'tffvi11', item: 'Ubicación de la sonda representativa del volumen útil de almacenamiento, sin contacto directo con paredes, evaporador, hielo, líquidos o empaques' },
        { id: 'tffvi12', item: 'Cable de sonda instalado sin interferir con el cierre de puerta ni generar pérdida de hermeticidad en la nevera/congelador' },
      ],
      verificacionBasica: [
        { id: 'tffvb1', item: 'El equipo enciende correctamente y muestra lectura estable en °C o °F según configuración institucional' },
        { id: 'tffvb2', item: 'La lectura cambia de forma progresiva al exponer la sonda a variación controlada de temperatura' },
        { id: 'tffvb3', item: 'La función MAX/MIN registra y permite consultar temperaturas máximas y mínimas' },
        { id: 'tffvb4', item: 'La función de borrado/reset de máximos y mínimos opera correctamente cuando aplica' },
        { id: 'tffvb5', item: 'La alarma alta/baja se puede configurar de acuerdo con el rango institucional del área' },
        { id: 'tffvb6', item: 'La alarma audible/visual se activa al simular temperatura fuera del límite configurado' },
        { id: 'tffvb7', item: 'La unidad mantiene lectura continua sin guiones, reinicios espontáneos o pérdida de comunicación con la sonda' },
        { id: 'tffvb8', item: 'La conversión °C/°F, si está habilitada, no altera la lectura ni bloquea el funcionamiento' },
        { id: 'tffvb9', item: 'Después del cambio de batería, fecha/hora, registros o alarmas quedan configurados según necesidad del servicio, si el modelo lo permite' },
      ],
      pruebasFuncionales: [
        { id: 'tffpf1', prueba: 'Encendido y autoverificación — Instalar batería y encender el equipo', valorEsperado: 'Display completo, lectura visible y sin códigos de error', resultado: ['Pasa', 'Falla'] },
        { id: 'tffpf2', prueba: 'Comparación a temperatura ambiente — Ubicar sonda junto a termómetro patrón durante estabilización mínima de 5 minutos', valorEsperado: 'Diferencia frente al patrón ≤ ±1 °C o según especificación del fabricante/institución', resultado: ['Pasa', 'Falla'] },
        { id: 'tffpf3', prueba: 'Comparación en rango de nevera — Ubicar sonda y patrón en ambiente refrigerado 2 °C a 8 °C hasta estabilización', valorEsperado: 'Lectura dentro del rango de nevera y diferencia ≤ ±1 °C o tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tffpf4', prueba: 'Comparación en rango de congelador — Ubicar sonda y patrón en ambiente ≤ -15 °C hasta estabilización', valorEsperado: 'Lectura coherente con congelador y diferencia ≤ ±1 °C a ±2 °C según especificación/rango del equipo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tffpf5', prueba: 'Estabilidad de lectura — Mantener sonda en ambiente estable durante 10 minutos', valorEsperado: 'Variación máxima ≤ ±0,5 °C después de estabilización o según criterio institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'tffpf6', prueba: 'Respuesta dinámica — Pasar la sonda de temperatura ambiente a refrigeración y observar cambio', valorEsperado: 'La lectura desciende progresivamente sin saltos erráticos ni congelamiento del display', resultado: ['Pasa', 'Falla'] },
        { id: 'tffpf7', prueba: 'Alarma alta — Configurar límite alto cercano a la temperatura ambiente y simular excursión', valorEsperado: 'Alarma visual/audible se activa al superar el límite configurado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tffpf8', prueba: 'Alarma baja — Configurar límite bajo y simular condición por debajo del umbral', valorEsperado: 'Alarma visual/audible se activa al caer por debajo del límite configurado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tffpf9', prueba: 'Memoria MAX/MIN — Generar dos puntos de temperatura y revisar registro', valorEsperado: 'Registra máximos y mínimos de forma coherente y permite borrarlos/resetearlos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tffpf10', prueba: 'Prueba de batería — Verificar indicador de batería o medición con multímetro', valorEsperado: 'Batería en buen estado; sin indicador de batería baja o voltaje insuficiente', resultado: ['Pasa', 'Falla'] },
        { id: 'tffpf11', prueba: 'Integridad de sonda/cable — Mover suavemente el cable y conector durante lectura estable', valorEsperado: 'Sin pérdidas de lectura, guiones, cambios bruscos o reinicios', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tffpf12', prueba: 'Instalación final — Verificar ubicación de sonda y cierre de puerta de nevera/congelador', valorEsperado: 'Sonda bien ubicada, cable sin pinzamiento y puerta cierra herméticamente', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de unidad y sonda',
        'Cambio de batería',
        'Reconfiguración de unidad °C/°F',
        'Configuración de límites de alarma alta/baja',
        'Borrado o reinicio de registros MAX/MIN',
        'Verificación comparativa con termómetro patrón',
        'Reubicación de sonda para medición representativa',
        'Aseguramiento de cableado y soporte de instalación',
        'Retiro de servicio por lectura errática, daño físico, falla de alarma o desviación fuera de tolerancia',
        'Recomendación de calibración externa o reposición del equipo',
      ],
    },
    'regulador_vacio_amvex_cha': {
      nombre: 'Regulador de Vacío AMVEX CHA',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-RV-CHA',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el regulador AMVEX CHA se encuentre fuera de uso clínico, limpio, seco y sin conexión a paciente antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de fuente de vacío hospitalaria y vacuómetro patrón o analizador de vacío calibrado; para la prueba funcional se requiere suministro mínimo de -400 mmHg (-53 kPa).',
        'Instale filtro bacteriano/hidrofóbico y trampa de rebose entre el regulador y el sistema colector para prevenir contaminación interna.',
        'No utilice el regulador si el frasco colector se encuentra lleno, si hay contaminación visible, ingreso de líquidos o restricción en la trampa de rebose.',
        'No desarme el regulador ni intervenga diafragma, módulo regulador, válvula de alivio, manómetro, empaques u O-rings durante el mantenimiento preventivo rutinario.',
        'Si se evidencian daños, fugas, lectura errática, manómetro fuera de tolerancia o contaminación interna, retire de servicio y remita a personal calificado/servicio técnico autorizado.',
        'No esterilice en autoclave, no sumerja en líquidos y no realice esterilización por gas; estos métodos pueden dañar componentes plásticos y sellos internos.',
      ],
      inspeccion: [
        { id: 'chavi1', item: 'Carcasa frontal y posterior íntegra, sin grietas, golpes, deformaciones, faltantes ni signos de manipulación no autorizada' },
        { id: 'chavi2', item: 'Manómetro analógico legible, lente sin fisuras, aguja en cero cuando no hay vacío aplicado y escala completa visible' },
        { id: 'chavi3', item: 'Perilla de regulación gira suavemente en sentido horario/antihorario, sin trabas, holguras excesivas ni desprendimiento' },
        { id: 'chavi4', item: 'Selector de modo OFF / REG / FULL en buen estado, con posiciones definidas, rotulación legible y enclavamiento mecánico correcto' },
        { id: 'chavi5', item: 'Puerto de suministro hacia toma mural sin obstrucción, fisuras, desgaste de rosca/adaptador ni fuga visible' },
        { id: 'chavi6', item: 'Puerto de paciente/salida hacia canister sin obstrucción, contaminación visible, fisuras o daño en conexión' },
        { id: 'chavi7', item: 'Adaptador mural, DISS/chemetron/conexión institucional y manguera de vacío en buen estado, sin deformación, fuga, corte o endurecimiento' },
        { id: 'chavi8', item: 'Filtro bacteriano o hidrofóbico presente, seco, sin decoloración, humedad, bloqueo, saturación o vencimiento' },
        { id: 'chavi9', item: 'Trampa de rebose/overflow safety trap instalada, transparente, libre de restricciones y con flotador funcional si aplica' },
        { id: 'chavi10', item: 'Canister, tapa, empaques y tubería secundaria limpios, íntegros y sin fisuras; sin evidencia de rebose hacia el regulador' },
        { id: 'chavi11', item: 'Etiquetas de identificación, placa institucional, marca, modelo y número de serie legibles y coincidentes con inventario' },
        { id: 'chavi12', item: 'Limpieza externa realizada con detergente suave diluido; superficie seca y sin ingreso de líquido por puertos o selector' },
      ],
      verificacionBasica: [
        { id: 'chavb1', item: 'Conectado a fuente de vacío, el manómetro responde al ocluir la tubería y retorna a cero al liberar y colocar en OFF' },
        { id: 'chavb2', item: 'En OFF no se transmite vacío hacia el puerto de paciente con la tubería ocluida' },
        { id: 'chavb3', item: 'En REG la perilla permite ajuste progresivo y estable del vacío sin saltos bruscos de lectura' },
        { id: 'chavb4', item: 'En FULL el regulador entrega el máximo vacío disponible de la red sin bloqueo ni oscilación anormal' },
        { id: 'chavb5', item: 'No se perciben fugas audibles en conexiones, puertos, selector, manómetro o adaptador mural durante la prueba' },
        { id: 'chavb6', item: 'La trampa de rebose y el filtro no restringen el flujo durante la prueba funcional' },
      ],
      pruebasFuncionales: [
        { id: 'chapf1', prueba: 'Suministro mínimo de vacío — Conectar a toma mural o fuente patrón y medir vacío disponible antes del regulador', valorEsperado: 'Vacío de suministro ≥ -400 mmHg (-53 kPa)', resultado: ['Pasa', 'Falla'] },
        { id: 'chapf2', prueba: 'Selector en OFF — Girar la perilla una vuelta en sentido horario y ocluir la tubería de salida', valorEsperado: 'Sin movimiento de aguja / lectura permanece en 0 mmHg', resultado: ['Pasa', 'Falla'] },
        { id: 'chapf3', prueba: 'Selector en REG con perilla totalmente antihoraria — Ocluir la tubería de salida', valorEsperado: 'Sin incremento de vacío / lectura permanece en 0 mmHg', resultado: ['Pasa', 'Falla'] },
        { id: 'chapf4', prueba: 'Ajuste de vacío estándar — En REG, ocluir tubería y aumentar lentamente con la perilla', valorEsperado: '-90 mmHg (-12 kPa) con lectura estable', resultado: ['Pasa', 'Falla'] },
        { id: 'chapf5', prueba: 'Estabilidad del ajuste — Mantener -90 mmHg con línea ocluida durante 30 segundos', valorEsperado: 'Lectura estable, variación ≤ ±10 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'chapf6', prueba: 'Respuesta a variación de flujo — Abrir y cerrar lentamente la tubería ocluida en REG', valorEsperado: 'El vacío varía y retorna al ajuste sin oscilaciones sostenidas', resultado: ['Pasa', 'Falla'] },
        { id: 'chapf7', prueba: 'Modo FULL — Colocar selector en FULL y ocluir tubería de salida', valorEsperado: 'Manómetro refleja el máximo vacío disponible de la red/fuente', resultado: ['Pasa', 'Falla'] },
        { id: 'chapf8', prueba: 'Retorno a cero y cierre — Disminuir vacío con perilla hasta cero y mover selector a OFF', valorEsperado: 'Lectura retorna a 0 mmHg y no queda vacío residual aplicado', resultado: ['Pasa', 'Falla'] },
        { id: 'chapf9', prueba: 'Hermeticidad del conjunto externo — Verificar conexiones, mangueras, filtro, trampa y canister con sistema ocluido', valorEsperado: 'Sin fuga audible ni caída apreciable del vacío durante la observación', resultado: ['Pasa', 'Falla'] },
        { id: 'chapf10', prueba: 'Verificación de rango alto CHA — En REG, aumentar gradualmente hasta el límite seguro disponible según red y manómetro', valorEsperado: 'Regulación progresiva hasta rango alto, sin bloqueo, vibración de aguja ni sobrepaso no controlado', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa con detergente suave diluido',
        'Verificación funcional OFF / REG / FULL',
        'Verificación de vacío con vacuómetro patrón',
        'Cambio de filtro bacteriano / hidrofóbico',
        'Revisión de trampa de rebose y mangueras',
        'Retiro de servicio por fuga, contaminación o lectura fuera de tolerancia',
        'Remisión a servicio técnico autorizado',
      ],
    },
    'monitor_nihon_kohden_csm1501': {
      nombre: 'Monitor de Signos Vitales NIHON KOHDEN CSM-1501 (Life Scope G5)',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-MN',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador Fluke ProSim 8 (o equivalente) con certificado de calibración vigente.',
        'Conecte los cables de ECG, sensor SpO2, manguito NIBP y sensor de temperatura al simulador antes de iniciar pruebas.',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Las intervenciones internas y de servicio avanzado deben ser realizadas por personal autorizado según manual de operación oficial Nihon Kohden.',
        'Si se evidencian daños, errores persistentes o mal funcionamiento, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'nk1', item: 'Carcasa, pantalla, puertos y conectores sin grietas, deformaciones ni daño visible' },
        { id: 'nk2', item: 'Cable de poder y clavija en buen estado, sin sulfatación o roturas' },
        { id: 'nk3', item: 'Accesorios reutilizables (ECG, SpO2, NIBP, temperatura) íntegros y limpios' },
        { id: 'nk4', item: 'Equipo limpio externamente; sin residuos, derrames o contaminación visible' },
        { id: 'nk5', item: 'Batería instalada sin signos externos de fuga, deformación o sobrecalentamiento' },
        { id: 'nk6', item: 'Etiquetas de identificación, activo fijo y número de serie legibles' },
      ],
      pruebasFuncionales: [
        { id: 'nkpf1', prueba: 'ECG: Ritmo sinusal normal (NSR) — Simulación ProSim 8, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf2', prueba: 'ECG: Amplitud de onda — Señal 1 mV pico, derivación II', valorEsperado: '1.0 mV (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf3', prueba: 'ECG: Detección de arritmia — Fibrilación ventricular (V-Fib)', valorEsperado: 'Alarma V-Fib activa', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf4', prueba: 'RESP: Frecuencia respiratoria — Simulación impedancia ProSim 8', valorEsperado: '20 RPM (± 1 RPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf5', prueba: 'SpO2: Saturación — Simulación óptica ProSim 8, sensor conectado', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf6', prueba: 'SpO2: Frecuencia de pulso — Simulación ProSim 8', valorEsperado: '80 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf7', prueba: 'NIBP: Presión sistólica — Simulación estática ProSim 8', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf8', prueba: 'NIBP: Presión diastólica — Simulación estática ProSim 8', valorEsperado: '80 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf9', prueba: 'NIBP: Presión media (MAP) — Cálculo automático del monitor', valorEsperado: '93 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf10', prueba: 'NIBP: Prueba de fuga del manguito — Presión sostenida 30 s', valorEsperado: 'Caída < 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf11', prueba: 'Temperatura: Canal 1 — Simulación resistiva ProSim 8', valorEsperado: '37.0 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf12', prueba: 'Alarmas: Límite superior FC — Configurar alarma 100 BPM, simular 120 BPM', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf13', prueba: 'Alarmas: Límite inferior SpO2 — Configurar alarma 90%, simular 85%', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'nkpf14', prueba: 'Alarmas: Sensor desconectado — Retirar cable ECG / SpO2', valorEsperado: 'Alarma técnica inmediata', resultado: ['Pasa', 'Falla'] },
      ],
      verificacionBasica: [
        { id: 'nkvb1', item: 'Enciende normalmente y completa autoverificación sin errores técnicos persistentes' },
        { id: 'nkvb2', item: 'La pantalla presenta imagen uniforme, buena visibilidad y respuesta correcta de teclas/panel táctil' },
        { id: 'nkvb3', item: 'Opera con red eléctrica y mantiene funcionamiento al desconectar AC (modo batería)' },
        { id: 'nkvb4', item: 'Fecha, hora y parámetros de configuración básica verificados' },
        { id: 'nkvb5', item: 'Alarma audible y visual funcional; volumen adecuado y reconocimiento de alarma correcto' },
        { id: 'nkvb6', item: 'Detección de sensor desconectado / alarma técnica básica confirmada' },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Verificación funcional con simulador', 'Cambio de accesorios', 'Calibración de parámetros', 'Remisión a servicio técnico'],
    },
    'desfibrilador_mindray_d6': {
      nombre: 'Desfibrilador Mindray BeneHeart D6',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-DF',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del analizador de desfibrilador Fluke Impulse 4000 (o equivalente) con certificado de calibración vigente.',
        'Utilice las paletas internas o parches de desfibrilación del equipo para conectar al analizador Impulse 4000.',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Asegúrese de que no haya pacientes ni personal en contacto con las paletas durante las pruebas de descarga.',
        'Si se evidencian daños, errores persistentes o mal funcionamiento, retire de servicio y remita a soporte técnico autorizado Mindray.',
      ],
      inspeccion: [
        { id: 'df1', item: 'Carcasa, pantalla y panel frontal sin grietas, deformaciones ni daño visible' },
        { id: 'df2', item: 'Cable de poder, clavija y fusibles en buen estado' },
        { id: 'df3', item: 'Paletas externas e internas sin daño, electrodos limpios y contacto firme' },
        { id: 'df4', item: 'Parches de desfibrilación (fecha de vencimiento vigente)' },
        { id: 'df5', item: 'Cable de ECG y electrodos en buen estado, conexiones firmes' },
        { id: 'df6', item: 'Cable de SpO2 y sensor en buen estado' },
        { id: 'df7', item: 'Batería instalada sin signos de fuga, deformación o sobrecalentamiento' },
        { id: 'df8', item: 'Indicador de carga de batería verificado (nivel adecuado)' },
        { id: 'df9', item: 'Papel de registro térmico disponible y mecanismo de impresión funcional' },
        { id: 'df10', item: 'Etiquetas de identificación, activo fijo y número de serie legibles' },
      ],
      verificacionBasica: [
        { id: 'dfvb1', item: 'Enciende correctamente con AC y en modo batería' },
        { id: 'dfvb2', item: 'Pantalla muestra información clara y sin artefactos' },
        { id: 'dfvb3', item: 'Autotest inicial del equipo pasa sin errores' },
        { id: 'dfvb4', item: 'Selector de modo funcional: Monitor / Desfibrilación / Marcapasos / DEA' },
        { id: 'dfvb5', item: 'Botones de carga, descarga y sincronización responden correctamente' },
        { id: 'dfvb6', item: 'Alarma audible de carga lista funcional' },
        { id: 'dfvb7', item: 'Impresora / registrador térmico funcional' },
        { id: 'dfvb8', item: 'Operación con batería: descarga completa posible sin AC conectado' },
      ],
      pruebasFuncionales: [
        { id: 'dfpf1', prueba: 'Energía entregada 10 J — Carga y descarga en Impulse 4000 (carga interna 50 Ω)', valorEsperado: '10 J (± 15% = 8.5–11.5 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf2', prueba: 'Energía entregada 50 J — Carga y descarga en Impulse 4000', valorEsperado: '50 J (± 15% = 42.5–57.5 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf3', prueba: 'Energía entregada 100 J — Carga y descarga en Impulse 4000', valorEsperado: '100 J (± 15% = 85–115 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf4', prueba: 'Energía entregada 150 J — Carga y descarga en Impulse 4000', valorEsperado: '150 J (± 15% = 127.5–172.5 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf5', prueba: 'Energía entregada 200 J — Carga y descarga en Impulse 4000', valorEsperado: '200 J (± 15% = 170–230 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf6', prueba: 'Energía máxima 360 J — Carga y descarga en Impulse 4000', valorEsperado: '360 J (± 15% = 306–414 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf7', prueba: 'Tiempo de carga a 360 J — Desde inicio hasta "listo" con batería nueva', valorEsperado: '≤ 9 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf8', prueba: 'Modo sincronizado — Descarga sincronizada con onda R del ECG simulado', valorEsperado: 'Retardo sync ≤ 60 ms', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf9', prueba: 'ECG: Ritmo sinusal normal — Simulación Impulse 4000, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf10', prueba: 'ECG: Detección de fibrilación ventricular — Señal V-Fib de Impulse 4000', valorEsperado: 'Detección y alarma VF', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf11', prueba: 'Modo DEA: Análisis de ritmo — V-Fib simulado en Impulse 4000', valorEsperado: 'Recomienda descarga', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf12', prueba: 'Modo DEA: Análisis de ritmo — NSR simulado en Impulse 4000', valorEsperado: 'No recomienda descarga', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf13', prueba: 'Marcapasos: Estimulación en modo fijo — Frecuencia y corriente configuradas', valorEsperado: 'Freq: 80 PPM (± 1.5%), Corriente: según config', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf14', prueba: 'Marcapasos: Captura de pulso — Detección por Impulse 4000', valorEsperado: 'Ancho de pulso 20–40 ms', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf15', prueba: 'Seguridad: Descarga interna automática — Energía cargada sin descargar por 60 s', valorEsperado: 'Desarme automático (0 J residual)', resultado: ['Pasa', 'Falla'] },
        { id: 'dfpf16', prueba: 'Batería: Autonomía — Mínimo 3 descargas a 360 J con batería cargada', valorEsperado: '≥ 3 descargas a máxima energía', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Verificación de energía con analizador', 'Cambio de batería', 'Cambio de paletas/parches', 'Verificación de marcapasos', 'Remisión a servicio técnico'],
    },
    'monitor_nihon_kohden_bsm3562': {
      nombre: 'Monitor de Signos Vitales NIHON KOHDEN BSM-3562 (Life Scope PT)',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-MN2',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador Fluke ProSim 8 (o equivalente) con certificado de calibración vigente.',
        'Conecte los cables de ECG, sensor SpO2, manguito NIBP, sensor de temperatura y líneas de IBP/EtCO2 al simulador según aplique.',
        'Verifique disponibilidad de gas de calibración para módulo de CO2 (si el equipo cuenta con capnografía).',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Las intervenciones internas y de servicio avanzado deben ser realizadas por personal autorizado según manual de operación oficial Nihon Kohden.',
        'Si se evidencian daños, errores persistentes o mal funcionamiento, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'bsm1', item: 'Carcasa, pantalla táctil, perilla y puertos sin grietas, deformaciones ni daño visible' },
        { id: 'bsm2', item: 'Cable de poder y clavija en buen estado, sin sulfatación o roturas' },
        { id: 'bsm3', item: 'Cable troncal de ECG y derivaciones en buen estado, conectores firmes' },
        { id: 'bsm4', item: 'Sensor de SpO2 (clip/adhesivo) íntegro, ventana óptica limpia' },
        { id: 'bsm5', item: 'Manguito de NIBP y manguera sin fugas, conectores firmes' },
        { id: 'bsm6', item: 'Sensor/sonda de temperatura íntegro y limpio' },
        { id: 'bsm7', item: 'Transductor de presión invasiva (IBP) y línea de presión verificados (si aplica)' },
        { id: 'bsm8', item: 'Línea de muestreo de CO2/EtCO2 y trampa de agua verificadas (si aplica)' },
        { id: 'bsm9', item: 'Batería instalada sin signos de fuga, deformación o sobrecalentamiento' },
        { id: 'bsm10', item: 'Soporte/brazo de montaje estable y seguro' },
        { id: 'bsm11', item: 'Etiquetas de identificación, activo fijo y número de serie legibles' },
        { id: 'bsm12', item: 'Equipo limpio externamente; sin residuos, derrames o contaminación visible' },
      ],
      verificacionBasica: [
        { id: 'bsmvb1', item: 'Enciende normalmente con AC y con batería; completa autoverificación sin errores' },
        { id: 'bsmvb2', item: 'Pantalla táctil presenta imagen uniforme, buena visibilidad y respuesta correcta al tacto' },
        { id: 'bsmvb3', item: 'Perilla de navegación y teclas de función responden correctamente' },
        { id: 'bsmvb4', item: 'Opera con red eléctrica y mantiene funcionamiento al desconectar AC (modo batería)' },
        { id: 'bsmvb5', item: 'Fecha, hora y configuración de parámetros verificados' },
        { id: 'bsmvb6', item: 'Alarma audible y visual funcional; volumen y prioridades configuradas correctamente' },
        { id: 'bsmvb7', item: 'Detección de sensor desconectado / alarma técnica confirmada en todos los canales' },
        { id: 'bsmvb8', item: 'Conectividad de red (si aplica): comunicación con central de monitoreo verificada' },
      ],
      pruebasFuncionales: [
        { id: 'bsmpf1', prueba: 'ECG: Ritmo sinusal normal (NSR) — ProSim 8, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf2', prueba: 'ECG: Amplitud de onda — Señal 1 mV pico, derivación II', valorEsperado: '1.0 mV (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf3', prueba: 'ECG: Detección de arritmia — Fibrilación ventricular (V-Fib) ProSim 8', valorEsperado: 'Alarma V-Fib activa', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf4', prueba: 'ECG: Detección de arritmia — Taquicardia ventricular (V-Tach) ProSim 8', valorEsperado: 'Alarma V-Tach activa', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf5', prueba: 'ECG: Verificación de segmento ST — Simulación ProSim 8', valorEsperado: 'Medición ST estable (± 0.02 mV)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf6', prueba: 'RESP: Frecuencia respiratoria — Impedancia ProSim 8', valorEsperado: '20 RPM (± 1 RPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf7', prueba: 'SpO2: Saturación — Simulación óptica ProSim 8', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf8', prueba: 'SpO2: Frecuencia de pulso — ProSim 8', valorEsperado: '80 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf9', prueba: 'SpO2: Alarma de desaturación — Simular 85% en ProSim 8', valorEsperado: 'Alarma activa (límite 90%)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf10', prueba: 'NIBP: Presión sistólica — Simulación estática ProSim 8', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf11', prueba: 'NIBP: Presión diastólica — Simulación estática ProSim 8', valorEsperado: '80 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf12', prueba: 'NIBP: Presión media (MAP) — Cálculo automático', valorEsperado: '93 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf13', prueba: 'NIBP: Prueba de fuga del manguito — Presión sostenida 30 s', valorEsperado: 'Caída < 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf14', prueba: 'Temperatura: Canal 1 — Simulación resistiva ProSim 8', valorEsperado: '37.0 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf15', prueba: 'IBP: Canal 1 — Presión estática 0 mmHg (calibración de cero)', valorEsperado: '0 mmHg (± 1 mmHg)', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bsmpf16', prueba: 'IBP: Canal 1 — Presión estática 200 mmHg con columna de agua o simulador', valorEsperado: '200 mmHg (± 4 mmHg)', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bsmpf17', prueba: 'EtCO2/Capnografía: Lectura con gas patrón o simulación (si aplica)', valorEsperado: 'Valor dentro de ± 2 mmHg del patrón', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bsmpf18', prueba: 'Alarmas: Límite superior FC — Config 100 BPM, simular 120 BPM', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf19', prueba: 'Alarmas: Límite inferior SpO2 — Config 90%, simular 85%', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'bsmpf20', prueba: 'Alarmas: Sensor desconectado — Retirar cable ECG y SpO2', valorEsperado: 'Alarma técnica inmediata', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Verificación funcional con simulador', 'Cambio de accesorios', 'Calibración de sensores', 'Verificación IBP/CO2', 'Remisión a servicio técnico'],
    },

    'monitor_nihon_kohden_csm1502': {
      nombre: 'Monitor de Signos Vitales NIHON KOHDEN CSM-1502 (Life Scope G5)',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-CSM1502',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el monitor esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador multiparámetro Fluke ProSim 8 o equivalente, con certificado de calibración vigente.',
        'Conecte cable ECG, sensor SpO2, brazalete NIBP, manguera, sondas de temperatura y módulos opcionales antes de iniciar las pruebas.',
        'Utilice únicamente accesorios compatibles con Nihon Kohden CSM-1502 / Life Scope G5 y en buen estado físico.',
        'Verifique que los módulos, smart cables o conectores multiparámetro instalados correspondan a la configuración real del equipo.',
        'No desarme el equipo ni intervenga componentes internos, fuente, tarjetas, módulos o batería durante el mantenimiento preventivo rutinario.',
        'Las pruebas de seguridad eléctrica deben ejecutarse según el programa institucional con analizador certificado cuando aplique.',
        'Si se evidencian fallas de autoverificación, alarmas técnicas persistentes, pantalla defectuosa o mediciones inestables, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'csm1502_i1', item: 'Carcasa frontal/posterior, pantalla táctil y biseles sin grietas, golpes, deformaciones ni daño visible' },
        { id: 'csm1502_i2', item: 'Pantalla LCD limpia, sin rayones profundos, manchas internas, líneas, pérdida de brillo o pixeles defectuosos' },
        { id: 'csm1502_i3', item: 'Botón de encendido, perilla/teclas, pantalla táctil y tecla de silencio de alarma responden adecuadamente' },
        { id: 'csm1502_i4', item: 'Cable de alimentación, clavija, adaptador y punto de tierra sin cortes, sulfatación, calentamiento o falsos contactos' },
        { id: 'csm1502_i5', item: 'Conectores multiparámetro, puertos de módulo y smart cables firmes, limpios y sin pines doblados' },
        { id: 'csm1502_i6', item: 'Cable troncal ECG y derivaciones sin cortes, fisuras, conectores flojos o desgaste del aislamiento' },
        { id: 'csm1502_i7', item: 'Sensor SpO2 y extensión íntegros, ventana óptica limpia y sistema de sujeción funcional' },
        { id: 'csm1502_i8', item: 'Brazalete NIBP, manguera y conectores sin fugas, obstrucciones, rupturas, endurecimiento o deformaciones' },
        { id: 'csm1502_i9', item: 'Sondas/cables de temperatura limpios, íntegros y sin daño en conectores' },
        { id: 'csm1502_i10', item: 'Módulos o accesorios opcionales de IBP, CO2, BIS, EEG, CO, NMT o segundo SpO2 íntegros si están instalados' },
        { id: 'csm1502_i11', item: 'Batería o módulo de alimentación sin deformación, fuga, sobrecalentamiento o mensaje de falla' },
        { id: 'csm1502_i12', item: 'Parlante, indicadores luminosos y señal visual de alarma libres de obstrucción' },
        { id: 'csm1502_i13', item: 'Soporte, brazo, base, riel o sistema de fijación estable y seguro' },
        { id: 'csm1502_i14', item: 'Etiquetas de identificación, activo fijo, serial, advertencias y estado de mantenimiento legibles' },
      ],
      verificacionBasica: [
        { id: 'csm1502_vb1', item: 'Enciende con alimentación AC y completa autoverificación sin errores técnicos persistentes' },
        { id: 'csm1502_vb2', item: 'Pantalla con buena visibilidad; ondas, parámetros, tendencias, fecha y hora se visualizan correctamente' },
        { id: 'csm1502_vb3', item: 'Pantalla táctil, perilla de navegación, teclas de selección y silencio de alarma responden correctamente' },
        { id: 'csm1502_vb4', item: 'Opera con batería al desconectar AC y muestra correctamente estado de carga/autonomía' },
        { id: 'csm1502_vb5', item: 'Configuración de paciente adulto/pediátrico/neonatal, unidades, límites de alarma y volumen verificada' },
        { id: 'csm1502_vb6', item: 'Alarmas audibles y visuales funcionales, con reconocimiento y silencio temporal operativo' },
        { id: 'csm1502_vb7', item: 'Detección de sensor desconectado confirmada para ECG, SpO2, NIBP y módulos instalados según aplique' },
        { id: 'csm1502_vb8', item: 'Comunicación con central, red o HL7 verificada si el equipo cuenta con la opción instalada' },
      ],
      pruebasFuncionales: [
        { id: 'csm1502_pf1', prueba: 'ECG: Ritmo sinusal normal — Simulador ProSim 8, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf2', prueba: 'ECG: Amplitud de señal — Onda 1 mV pico, derivación II', valorEsperado: '1.0 mV (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf3', prueba: 'ECG: Detección de derivación desconectada', valorEsperado: 'Mensaje/alarma técnica de lead off activa', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf4', prueba: 'ECG: Detección de arritmia — Fibrilación ventricular simulada', valorEsperado: 'Alarma VF/V-Fib audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf5', prueba: 'ECG: Detección de taquicardia ventricular simulada', valorEsperado: 'Alarma VT/V-Tach audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf6', prueba: 'ECG/ST/QRS: Verificación de análisis avanzado si está habilitado', valorEsperado: 'Lectura estable conforme a configuración del monitor', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'csm1502_pf7', prueba: 'RESP: Frecuencia respiratoria por impedancia — Simulación ProSim 8', valorEsperado: '20 RPM (± 1 RPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf8', prueba: 'RESP: Alarma de apnea o respiración baja según configuración', valorEsperado: 'Alarma funcional conforme al límite configurado', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf9', prueba: 'SpO2: Saturación — Simulación óptica ProSim 8', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf10', prueba: 'SpO2: Frecuencia de pulso — Simulación ProSim 8', valorEsperado: '80 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf11', prueba: 'SpO2: Alarma de desaturación — Configurar límite 90% y simular 85%', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf12', prueba: 'NIBP/iNIBP: Presión sistólica — Simulación estática/dinámica con analizador NIBP', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf13', prueba: 'NIBP/iNIBP: Presión diastólica — Simulación estática/dinámica con analizador NIBP', valorEsperado: '80 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf14', prueba: 'NIBP/iNIBP: Presión media MAP — Cálculo automático del monitor', valorEsperado: '93 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf15', prueba: 'NIBP: Prueba de fuga del sistema neumático con presión sostenida 30 s', valorEsperado: 'Caída < 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf16', prueba: 'NIBP: Protección de sobrepresión / aborto ante condición anormal', valorEsperado: 'Sin sobreinflado; aborta medición y genera alarma técnica', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf17', prueba: 'Temperatura canal 1 — Simulación resistiva o patrón compatible', valorEsperado: '37.0 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'csm1502_pf18', prueba: 'Temperatura canal 2 — Simulación resistiva o patrón compatible si aplica', valorEsperado: '37.0 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'csm1502_pf19', prueba: 'IBP canal 1 — Cero y presión estática con simulador/transductor', valorEsperado: '0 mmHg (± 1 mmHg) y 200 mmHg (± 4 mmHg)', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'csm1502_pf20', prueba: 'EtCO2/capnografía — Lectura con gas patrón o simulador si está instalado', valorEsperado: 'Valor dentro de ± 2 mmHg del patrón', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'csm1502_pf21', prueba: 'Batería: Funcionamiento en modo batería con parámetros activos', valorEsperado: 'Mantiene operación sin apagado inmediato ni alarma crítica', resultado: ['Pasa', 'Falla'] },
        { id: 'csm1502_pf22', prueba: 'Registrador/comunicación: impresión de trazo, envío a central o integración de datos si aplica', valorEsperado: 'Registro/comunicación correcta y legible', resultado: ['Pasa', 'Falla', 'N/A'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Verificación funcional con simulador', 'Verificación NIBP/iNIBP', 'Verificación de alarmas', 'Verificación de módulos opcionales', 'Verificación de batería', 'Cambio de accesorios', 'Remisión a servicio técnico'],
    },

    'monitor_nihon_kohden_pvm2703': {
      nombre: 'Monitor de Signos Vitales NIHON KOHDEN PVM-2703',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-PVM2703',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador multiparámetro Fluke ProSim 8 o equivalente, con certificado de calibración vigente.',
        'Conecte cable ECG, sensor SpO2, brazalete NIBP, manguera, sonda de temperatura y accesorios requeridos antes de iniciar las pruebas.',
        'Utilice únicamente accesorios compatibles con Nihon Kohden PVM-2703 y en buen estado físico.',
        'No desarme el equipo ni intervenga tarjetas, fuente, batería interna o módulos durante el mantenimiento preventivo rutinario.',
        'Las pruebas de seguridad eléctrica deben realizarse según el programa institucional y con analizador certificado cuando aplique.',
        'Si se evidencian alarmas técnicas persistentes, error de autoverificación, pantalla defectuosa o falla de medición, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'pvm1', item: 'Carcasa, pantalla, panel frontal y cubierta posterior sin grietas, golpes, deformaciones ni daño visible' },
        { id: 'pvm2', item: 'Pantalla limpia, sin manchas internas, líneas, pérdida de brillo o pixeles defectuosos que afecten la lectura' },
        { id: 'pvm3', item: 'Botones, perilla/teclas de navegación y teclas de silencio de alarma responden correctamente' },
        { id: 'pvm4', item: 'Cable de alimentación, clavija y conexión a tierra en buen estado, sin cortes, sulfatación ni falsos contactos' },
        { id: 'pvm5', item: 'Puerto ECG y cable de paciente sin pines doblados, fisuras, cortes o conectores flojos' },
        { id: 'pvm6', item: 'Sensor SpO2 y extensión íntegros, ventana óptica limpia y con sujeción adecuada' },
        { id: 'pvm7', item: 'Brazalete NIBP, manguera y conectores sin fugas, obstrucciones, rupturas o endurecimiento del material' },
        { id: 'pvm8', item: 'Sonda/cable de temperatura íntegro, limpio y sin daño en el conector' },
        { id: 'pvm9', item: 'Batería instalada sin deformación, fuga, sobrecalentamiento o mensaje de falla' },
        { id: 'pvm10', item: 'Parlante de alarmas, indicadores luminosos y señal visual sin obstrucciones' },
        { id: 'pvm11', item: 'Soporte, base, manija y sistema de fijación estables y seguros' },
        { id: 'pvm12', item: 'Etiquetas de identificación, activo fijo, serial y advertencias legibles' },
      ],
      verificacionBasica: [
        { id: 'pvmvb1', item: 'Enciende normalmente con alimentación AC y completa la autoverificación sin errores técnicos persistentes' },
        { id: 'pvmvb2', item: 'Pantalla con buena visibilidad; parámetros, ondas, fecha y hora se visualizan correctamente' },
        { id: 'pvmvb3', item: 'Teclas de navegación, selección, inicio/parada NIBP y silencio de alarma responden correctamente' },
        { id: 'pvmvb4', item: 'Opera con batería al desconectar AC y muestra correctamente el indicador de carga/estado' },
        { id: 'pvmvb5', item: 'Configuración básica de paciente, unidades, límites de alarma y volumen verificada' },
        { id: 'pvmvb6', item: 'Alarmas audibles y visuales funcionales, con reconocimiento/silencio temporal operativo' },
        { id: 'pvmvb7', item: 'Detección de sensor desconectado confirmada para ECG, SpO2 y NIBP según aplique' },
        { id: 'pvmvb8', item: 'Impresora/registrador o comunicación con central verificada si el equipo cuenta con la opción instalada' },
      ],
      pruebasFuncionales: [
        { id: 'pvmpf1', prueba: 'ECG: Ritmo sinusal normal — Simulador ProSim 8, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf2', prueba: 'ECG: Amplitud de señal — Onda 1 mV pico, derivación II', valorEsperado: '1.0 mV (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf3', prueba: 'ECG: Detección de derivación desconectada', valorEsperado: 'Mensaje/alarma técnica de lead off activa', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf4', prueba: 'ECG: Alarma de frecuencia cardiaca alta — Configurar límite 100 BPM y simular 120 BPM', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf5', prueba: 'ECG: Alarma de frecuencia cardiaca baja — Configurar límite 50 BPM y simular 40 BPM', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf6', prueba: 'RESP: Frecuencia respiratoria por impedancia — Simulación ProSim 8', valorEsperado: '20 RPM (± 1 RPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf7', prueba: 'RESP: Alarma de apnea o respiración baja según configuración', valorEsperado: 'Alarma funcional conforme a límite configurado', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf8', prueba: 'SpO2: Saturación — Simulación óptica ProSim 8', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf9', prueba: 'SpO2: Frecuencia de pulso — Simulación ProSim 8', valorEsperado: '80 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf10', prueba: 'SpO2: Alarma de desaturación — Configurar límite 90% y simular 85%', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf11', prueba: 'NIBP: Presión sistólica — Simulación estática/dinámica con analizador NIBP', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf12', prueba: 'NIBP: Presión diastólica — Simulación estática/dinámica con analizador NIBP', valorEsperado: '80 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf13', prueba: 'NIBP: Presión media MAP — Cálculo automático del monitor', valorEsperado: '93 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf14', prueba: 'NIBP: Prueba de fuga del sistema neumático con presión sostenida 30 s', valorEsperado: 'Caída < 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf15', prueba: 'NIBP: Sobrepresión/protección de seguridad según analizador', valorEsperado: 'Sin sobreinflado; aborta medición ante condición anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf16', prueba: 'Temperatura: Canal 1 — Simulación resistiva o patrón compatible', valorEsperado: '37.0 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pvmpf17', prueba: 'Batería: Funcionamiento mínimo en modo batería con parámetros activos', valorEsperado: 'Mantiene operación sin apagado inmediato ni alarma crítica', resultado: ['Pasa', 'Falla'] },
        { id: 'pvmpf18', prueba: 'Registrador/comunicación: impresión de trazo o envío a central si aplica', valorEsperado: 'Registro/comunicación correcta y legible', resultado: ['Pasa', 'Falla', 'N/A'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Verificación funcional con simulador', 'Verificación NIBP', 'Verificación de alarmas', 'Cambio de accesorios', 'Verificación de batería', 'Remisión a servicio técnico'],
    },
    'bascula_seca_813': {
      nombre: 'Báscula Digital de Piso SECA 813',
      categoria: 'Biomédico / Antropometría',
      codigo: 'SLV-GAT-BIO-BAS-SECA813',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que la báscula digital de piso SECA 813 se encuentre fuera de uso clínico, limpia, seca y ubicada sobre una superficie rígida, plana, dura y nivelada antes de iniciar el mantenimiento preventivo.',
        'La SECA 813 es una báscula electrónica con pantalla LCD alimentada por 4 pilas AAA; no posee cable de red ni partes aplicadas a paciente, por lo que no se realizan pruebas de seguridad eléctrica, pero sí verificación del estado de pilas y de las funciones electrónicas.',
        'La báscula viene calibrada de fábrica y, en el uso clínico habitual, no es ajustable por el usuario; el ajuste o la reparación interna deben ser realizados por servicio técnico autorizado SECA. No retire sellos metrológicos.',
        'Confirme disponibilidad de pesas patrón calibradas/trazables que cubran el rango de uso (puntos bajo, medio y alto, hasta cerca de la capacidad nominal de 200 kg), juego de 4 pilas AAA nuevas, paño suave, desinfectante compatible, nivel de burbuja si está disponible y formato institucional de registro metrológico.',
        'Retire al paciente y todos los objetos de la plataforma antes de encender, poner en cero (TARA) o verificar. No exceda la capacidad nominal de 200 kg / 440 lb; la graduación es de 100 g / 0,2 lb.',
        'Coloque la báscula sobre piso duro y plano; la exactitud se ve afectada por alfombras, superficies blandas, desniveles, vibraciones o contacto con pared, mueble o cables. La función de ajuste automático de cero compensa cambios de ubicación, temperatura y tipo de piso.',
        'Utilice la función step-off (la báscula enciende automáticamente al subir, sin pulsar botón) y permita que estabilice el cero antes de cargar.',
        'Realice limpieza externa con paño suave ligeramente humedecido en solución jabonosa suave, alcohol isopropílico al 70% o desinfectante compatible; seque por completo y no permita ingreso de líquido al display, al teclado ni al compartimiento de pilas. No sumerja la báscula ni use abrasivos.',
        'No abra la carcasa, no manipule celdas de carga, tarjeta electrónica ni parámetros internos durante el mantenimiento preventivo rutinario.',
        'Si observa lectura inestable, error de display (p. ej. sobrecarga/StOP), imposibilidad de poner en cero, deriva fuera de tolerancia, plataforma fisurada o superficie antideslizante deteriorada, retire de servicio y genere correctivo o remita a servicio técnico autorizado SECA.',
      ],
      inspeccion: [
        { id: 'seca813i1', item: 'Plataforma de pesaje íntegra, limpia, sin fisuras, deformaciones, abolladuras, bordes cortantes, humedad ni corrosión' },
        { id: 'seca813i2', item: 'Tapete/superficie antideslizante completa y en buen estado, sin desprendimientos, desgaste crítico ni pérdida de adherencia' },
        { id: 'seca813i3', item: 'Estructura/marco de acero firme, sin golpes, torsión, grietas, corrosión ni tornillos faltantes' },
        { id: 'seca813i4', item: 'Pies/apoyos antideslizantes completos y firmes; la báscula no presenta balanceo ni inestabilidad sobre la superficie de prueba' },
        { id: 'seca813i5', item: 'Pantalla LCD íntegra, sin fracturas, manchas internas, segmentos faltantes ni pérdida de contraste que impidan la lectura' },
        { id: 'seca813i6', item: 'Dígitos del LCD grandes y completamente legibles desde la posición de pie del paciente' },
        { id: 'seca813i7', item: 'Teclas/sensor de encendido y funciones (TARA/HOLD/unidades) presentes, firmes y operativas' },
        { id: 'seca813i8', item: 'Compartimiento de pilas limpio, sin corrosión ni fuga; contactos en buen estado y tapa con cierre seguro' },
        { id: 'seca813i9', item: 'Cuatro pilas AAA instaladas, con carga adecuada y sin sulfatación; reemplazadas si hay indicador de batería baja o por antigüedad' },
        { id: 'seca813i10', item: 'Rotulación de marca, modelo 813, número de serie, activo fijo, capacidad (200 kg) y graduación (100 g) legibles y coherentes con el inventario' },
        { id: 'seca813i11', item: 'Sello o etiqueta de verificación/calibración metrológica vigente y sin evidencia de manipulación, cuando aplique' },
        { id: 'seca813i12', item: 'Superficies externas, plataforma y display desinfectados, secos y sin residuos químicos' },
        { id: 'seca813i13', item: 'La plataforma queda libre, sin interferencia mecánica con pared, mueble, cables u objetos durante la medición' },
      ],
      verificacionBasica: [
        { id: 'seca813vb1', item: 'Al subir a la plataforma la báscula enciende automáticamente (step-off) y muestra la prueba de segmentos del display' },
        { id: 'seca813vb2', item: 'Con la plataforma libre de carga, el display indica 0,0 kg estable tras el ajuste automático de cero' },
        { id: 'seca813vb3', item: 'La función TARA/cero lleva la indicación a cero sin valor residual' },
        { id: 'seca813vb4', item: 'La unidad de medida seleccionada (kg) corresponde al uso institucional; la conmutación kg/lb es correcta si aplica' },
        { id: 'seca813vb5', item: 'La función HOLD/Auto-HOLD retiene y muestra el valor de pesaje de forma estable' },
        { id: 'seca813vb6', item: 'El indicador de batería no señala batería baja; el apagado automático opera tras el tiempo de inactividad' },
        { id: 'seca813vb7', item: 'La lectura es estable, sin oscilación ni deriva, y retorna a cero al retirar la carga' },
      ],
      pruebasFuncionales: [
        { id: 'seca813pf1', prueba: 'Encendido automático (step-off) y autodiagnóstico — Subir a la plataforma sin pulsar botón', valorEsperado: 'Enciende, ejecuta prueba de segmentos y queda lista en cero', resultado: ['Pasa', 'Falla'] },
        { id: 'seca813pf2', prueba: 'Cero/TARA — Plataforma libre, observar estabilidad 30 s', valorEsperado: 'Indicación 0,0 kg estable, sin deriva ni oscilación', resultado: ['Pasa', 'Falla'] },
        { id: 'seca813pf3', prueba: 'Exactitud punto bajo — Masa patrón ~20 kg centrada', valorEsperado: 'Lectura dentro de la tolerancia metrológica definida (graduación 100 g)', resultado: ['Pasa', 'Falla'] },
        { id: 'seca813pf4', prueba: 'Exactitud punto medio — Masa patrón ~60 kg centrada', valorEsperado: 'Lectura dentro de tolerancia y estable', resultado: ['Pasa', 'Falla'] },
        { id: 'seca813pf5', prueba: 'Exactitud punto medio-alto — Masa patrón ~120 kg centrada', valorEsperado: 'Lectura dentro de tolerancia y estable', resultado: ['Pasa', 'Falla'] },
        { id: 'seca813pf6', prueba: 'Exactitud punto alto — Masa patrón ~180 kg o carga segura cercana a la capacidad', valorEsperado: 'Lectura dentro de tolerancia, sin error de sobrecarga indebido', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'seca813pf7', prueba: 'Repetibilidad — Aplicar y retirar el mismo peso patrón al menos 3 veces en el centro', valorEsperado: 'Lecturas repetibles dentro de la tolerancia definida por metrología', resultado: ['Pasa', 'Falla'] },
        { id: 'seca813pf8', prueba: 'Excentricidad — Aplicar peso patrón en el centro y en los cuatro cuadrantes', valorEsperado: 'Lecturas consistentes entre posiciones y dentro de tolerancia', resultado: ['Pasa', 'Falla'] },
        { id: 'seca813pf9', prueba: 'Retorno a cero — Retirar toda la carga tras cada medición', valorEsperado: 'El display retorna a 0,0 kg sin valor residual', resultado: ['Pasa', 'Falla'] },
        { id: 'seca813pf10', prueba: 'Función HOLD/Auto-HOLD — Activar retención de lectura', valorEsperado: 'Retiene y muestra el valor de forma estable y correcta', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'seca813pf11', prueba: 'Conmutación de unidades kg/lb (si está habilitada institucionalmente)', valorEsperado: 'Conversión correcta y coherente entre kg y lb', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'seca813pf12', prueba: 'Indicador de batería baja y apagado automático', valorEsperado: 'Señaliza batería baja cuando corresponde y apaga tras inactividad', resultado: ['Pasa', 'Falla'] },
        { id: 'seca813pf13', prueba: 'Estabilidad mecánica/nivelación — Presionar suavemente las esquinas de la plataforma', valorEsperado: 'Permanece firme, sin balanceo, ruido ni desplazamiento', resultado: ['Pasa', 'Falla'] },
        { id: 'seca813pf14', prueba: 'Limpieza/desinfección posterior', valorEsperado: 'Plataforma, tapete y display limpios y secos, sin residuos ni ingreso de líquido al compartimiento de pilas', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de plataforma, tapete antideslizante, display y estructura',
        'Revisión de plataforma, marco, pies, display, teclas, compartimiento y estado de pilas y etiquetas',
        'Reemplazo de las 4 pilas AAA cuando aplica por indicador de batería baja o antigüedad',
        'Verificación de encendido step-off, autodiagnóstico, cero/TARA y ajuste automático de cero',
        'Verificación comparativa con pesas patrón calibradas en puntos bajo, medio y alto del rango (hasta 200 kg)',
        'Prueba de repetibilidad, excentricidad y retorno a cero',
        'Verificación de funciones HOLD/Auto-HOLD, unidades, indicador de batería y apagado automático',
        'Registro de desviaciones metrológicas y recomendación de calibración/servicio técnico autorizado SECA si está fuera de tolerancia',
        'Retiro de servicio por lectura inestable, imposibilidad de poner en cero, error de display, daño de plataforma o desviación fuera de tolerancia',
      ],
    },
    'monitor_nihon_kohden_pvm4763': {
      nombre: 'Monitor de Signos Vitales NIHON KOHDEN Vismo PVM-4763',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-PVM4763',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el monitor PVM-4763 del uso clínico y, si el área lo requiere, deje un monitor de respaldo antes de iniciar el mantenimiento. Verifique que esté apagado y desconectado de la red antes de la inspección física.',
        'Confirme disponibilidad del simulador multiparámetro Fluke ProSim 8 o equivalente (ECG, respiración, SpO2, temperatura), analizador/simulador de presión no invasiva, analizador de seguridad eléctrica certificado y formato institucional de registro, todos con calibración vigente.',
        'Conecte cable de ECG, sensor de SpO2, brazalete y manguera de NIBP, sonda de temperatura y, si está instalado, el módulo de CO2/IBP antes de iniciar las pruebas. Use únicamente accesorios compatibles con Nihon Kohden Vismo PVM-4763 y en buen estado.',
        'Este es un equipo eléctrico Clase I con partes aplicadas a paciente (ECG tipo CF a prueba de desfibrilador, SpO2, NIBP, temperatura y, si aplica, CO2/IBP); ejecute las pruebas de seguridad eléctrica conforme a IEC/EN 62353 o IEC 60601-1 con analizador certificado.',
        'No desarme el equipo ni intervenga tarjetas, fuente, batería interna o módulos durante el mantenimiento preventivo rutinario; las reparaciones internas deben realizarse por personal autorizado según el manual de operación oficial Nihon Kohden.',
        'No exceda 300 mmHg en las pruebas de NIBP ni someta el sistema neumático a sobrepresión innecesaria; utilice brazalete y manguera íntegros y del tamaño adecuado.',
        'Realice limpieza externa con paño suave humedecido en solución jabonosa suave o desinfectante compatible (alcohol isopropílico al 70% según fabricante); no permita ingreso de líquido a conectores, ranuras MULTI, parlante ni interior. No esterilice en autoclave ni sumerja módulos, sensores o cables.',
        'Si se evidencian alarmas técnicas persistentes, error de autoverificación, pérdida de parámetros, fugas eléctricas fuera de límite, daño de cables/sensores o batería que no sostiene respaldo, retire de servicio y remita a soporte técnico autorizado Nihon Kohden.',
      ],
      inspeccion: [
        { id: 'pvm4763i1', item: 'Carcasa, pantalla, panel frontal, mando/encoder y cubierta posterior sin grietas, golpes, deformaciones ni daño visible' },
        { id: 'pvm4763i2', item: 'Pantalla TFT/LCD limpia, sin manchas internas, líneas, pérdida de brillo o pixeles defectuosos que afecten la lectura de curvas y valores' },
        { id: 'pvm4763i3', item: 'Botones, perilla/teclas de navegación, inicio/parada de NIBP y silencio de alarma responden correctamente' },
        { id: 'pvm4763i4', item: 'Cable de alimentación, clavija, portafusible y conexión a tierra en buen estado, sin cortes, sulfatación ni falsos contactos' },
        { id: 'pvm4763i5', item: 'Conectores de paciente y ranuras MULTI limpios, sin pines doblados, corrosión, humedad ni daño mecánico' },
        { id: 'pvm4763i6', item: 'Cable y latiguillos de ECG sin pines doblados, fisuras, cortes ni conductores expuestos; broches/pinzas firmes' },
        { id: 'pvm4763i7', item: 'Sensor y extensión de SpO2 íntegros, ventana óptica limpia y con sujeción adecuada' },
        { id: 'pvm4763i8', item: 'Brazalete, manguera y conectores de NIBP sin fugas, obstrucciones, rupturas ni endurecimiento del material; velcro funcional' },
        { id: 'pvm4763i9', item: 'Sonda/cable de temperatura y, si está instalado, kit de CO2/IBP íntegros, limpios y con accesorios completos' },
        { id: 'pvm4763i10', item: 'Batería interna recargable sin deformación, fuga, sobrecalentamiento ni mensaje de falla' },
        { id: 'pvm4763i11', item: 'Parlante de alarmas, indicadores luminosos y señal visual operativos y sin obstrucción' },
        { id: 'pvm4763i12', item: 'Soporte, base, riel, brazo o sistema de fijación estables y seguros, sin riesgo de caída del monitor' },
        { id: 'pvm4763i13', item: 'Etiquetas de identificación, activo fijo, serial, clase/tipo de protección y advertencias legibles' },
        { id: 'pvm4763i14', item: 'Superficies externas, cables, sensores y brazalete desinfectados, secos y sin residuos químicos' },
      ],
      verificacionBasica: [
        { id: 'pvm4763vb1', item: 'Enciende con alimentación AC y completa la autoverificación sin errores técnicos persistentes' },
        { id: 'pvm4763vb2', item: 'Pantalla con buena visibilidad; parámetros, ondas, fecha y hora se visualizan correctamente' },
        { id: 'pvm4763vb3', item: 'Teclas de navegación, selección, inicio/parada de NIBP y silencio de alarma responden correctamente' },
        { id: 'pvm4763vb4', item: 'Opera con batería al desconectar AC, conmuta sin reinicio y muestra correctamente el indicador de carga/estado' },
        { id: 'pvm4763vb5', item: 'Configuración básica de paciente, unidades, límites de alarma y volumen verificada' },
        { id: 'pvm4763vb6', item: 'Alarmas audibles y visuales funcionales, con reconocimiento/silencio temporal operativo' },
        { id: 'pvm4763vb7', item: 'Detección de sensor/derivación desconectada confirmada para ECG, SpO2 y NIBP según aplique' },
        { id: 'pvm4763vb8', item: 'Impresora/registrador o comunicación con central/telemetría verificada si el equipo cuenta con la opción instalada' },
      ],
      pruebasFuncionales: [
        { id: 'pvm4763pf1', prueba: 'ECG: Ritmo sinusal normal — Simulador ProSim 8, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf2', prueba: 'ECG: Amplitud de señal — Onda 1 mV pico, derivación II', valorEsperado: '1.0 mV (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf3', prueba: 'ECG: Detección de derivación desconectada (lead off)', valorEsperado: 'Mensaje/alarma técnica de lead off activa', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf4', prueba: 'ECG: Alarma de FC alta — Límite 100 BPM y simular 120 BPM', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf5', prueba: 'ECG: Alarma de FC baja — Límite 50 BPM y simular 40 BPM', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf6', prueba: 'RESP: Frecuencia respiratoria por impedancia — Simulación ProSim 8', valorEsperado: '20 RPM (± 1 RPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf7', prueba: 'RESP: Alarma de apnea o respiración baja según configuración', valorEsperado: 'Alarma funcional conforme al límite configurado', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf8', prueba: 'SpO2: Saturación — Simulación óptica ProSim 8', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf9', prueba: 'SpO2: Frecuencia de pulso — Simulación ProSim 8', valorEsperado: '80 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf10', prueba: 'SpO2: Alarma de desaturación — Límite 90% y simular 85%', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf11', prueba: 'NIBP: Presión sistólica — Simulación con analizador NIBP (sin exceder 300 mmHg)', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf12', prueba: 'NIBP: Presión diastólica — Simulación con analizador NIBP', valorEsperado: '80 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf13', prueba: 'NIBP: Presión media (MAP) — Cálculo automático del monitor', valorEsperado: '93 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf14', prueba: 'NIBP: Fuga del sistema neumático con presión sostenida 30 s', valorEsperado: 'Caída < 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf15', prueba: 'NIBP: Protección de sobrepresión según analizador', valorEsperado: 'Sin sobreinflado; aborta la medición ante condición anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf16', prueba: 'Temperatura — Simulación resistiva o patrón compatible', valorEsperado: '37.0 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pvm4763pf17', prueba: 'CO2 (EtCO2) o IBP con patrón, si el módulo está instalado (cero/calibración del módulo)', valorEsperado: 'Lectura dentro de tolerancia del fabricante; cero correcto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pvm4763pf18', prueba: 'PWTT/disparo de NIBP por cambio de presión, si está habilitado', valorEsperado: 'Activa medición de NIBP ante el umbral, según configuración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pvm4763pf19', prueba: 'Seguridad eléctrica — Resistencia del conductor de protección (tierra)', valorEsperado: 'Dentro del límite normativo (IEC 62353 / 60601-1)', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf20', prueba: 'Seguridad eléctrica — Corriente de fuga a tierra y del envolvente', valorEsperado: 'Dentro de los límites normativos', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf21', prueba: 'Seguridad eléctrica — Corriente de fuga de paciente (partes aplicadas)', valorEsperado: 'Dentro de los límites para tipo CF/a prueba de desfibrilador', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf22', prueba: 'Batería — Operación en modo batería con parámetros activos ~10 min', valorEsperado: 'Mantiene operación sin reinicio ni apagado inmediato; indicador coherente', resultado: ['Pasa', 'Falla'] },
        { id: 'pvm4763pf23', prueba: 'Registrador/comunicación — Impresión de trazo o envío a central/telemetría si aplica', valorEsperado: 'Registro/comunicación correcta y legible', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pvm4763pf24', prueba: 'Limpieza, desinfección y secado final', valorEsperado: 'Monitor, cables, sensores y brazalete limpios y secos, sin residuos ni humedad en conectores', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa del monitor, pantalla, cables, sensores y brazalete',
        'Inspección de carcasa, pantalla, conectores MULTI, cable de red, batería, parlante y montaje',
        'Verificación de encendido, autoverificación, fecha/hora y configuración',
        'Pruebas de parámetros con simulador: ECG/FC, respiración, SpO2, NIBP, temperatura y CO2/IBP si aplica',
        'Verificación de NIBP contra patrón, fuga neumática y protección de sobrepresión',
        'Prueba del sistema de alarmas (límites, prioridad, silencio y alarmas técnicas)',
        'Verificación de autonomía y conmutación de batería; reemplazo si no sostiene respaldo',
        'Pruebas de seguridad eléctrica (tierra de protección y corrientes de fuga) conforme a IEC 62353/60601-1',
        'Verificación de registrador/impresora y salida a central/telemetría si aplica',
        'Cambio de accesorios y registro de hallazgos, parámetros verificados y próxima fecha de mantenimiento',
        'Retiro de servicio y remisión a servicio técnico autorizado Nihon Kohden ante falla de seguridad eléctrica, pérdida de parámetros, alarmas inoperantes o batería agotada',
      ],
    },
    'rx_portatil_agfa_dr100e': {
      nombre: 'Rayos X Portátil Digital AGFA DR 100e',
      categoria: 'Biomédico / Imágenes diagnósticas',
      codigo: 'SLV-GAT-BIO-RX-DR100E',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el equipo de rayos X portátil AGFA DR 100e del uso clínico antes de iniciar el mantenimiento. Coordine con el servicio de imágenes y protección radiológica; cualquier disparo de prueba debe hacerse en zona controlada, con barreras/EPP plomado y sin personas no autorizadas.',
        'IMPORTANTE — Sin patrón de rayos X: la institución NO cuenta con patrón/dosímetro de rayos X. Por lo tanto, la verificación dosimétrica (exactitud de kVp, tiempo de exposición, mAs, dosis/DAP, capa hemirreductora HVL, reproducibilidad de salida y congruencia campo luminoso/campo de radiación) NO se realiza en este mantenimiento; debe ser ejecutada por un laboratorio de control de calidad / dosimetría autorizado con patrón trazable, conforme a la normativa de protección radiológica vigente.',
        'El DR 100e es un equipo eléctrico Clase I con generador de hasta 32 kW, detector digital inalámbrico de yoduro de cesio (Dura-line), procesamiento MUSICA y estación NX (Windows). Requiere alimentación de red para operar. Ejecute las pruebas de seguridad eléctrica conforme a IEC/EN 62353 o IEC 60601-1; el equipo cumple además IEC 60601-1-3 (protección radiológica).',
        'No abra el cabezal/tubo, el generador ni el detector; la intervención interna y el reemplazo de batería del detector deben realizarse por servicio técnico autorizado AGFA. No manipule colimación interna ni filtración del haz.',
        'Confirme disponibilidad de analizador de seguridad eléctrica certificado, cinta métrica/escala de DFI (SID), maniquí o placa de prueba para imagen, EPP plomado y formato institucional de registro. Verifique respaldo de datos del NX antes de cualquier reinicio.',
        'Realice limpieza externa con paño suave levemente humedecido en desinfectante compatible; no permita ingreso de líquido al detector, conectores, consola, teclado ni interior. No sumerja el detector ni use abrasivos. Apague el sistema correctamente antes de limpiar.',
        'Si detecta fugas eléctricas fuera de límite, fallas del generador, parada de emergencia inoperante, frenos/seguros mecánicos defectuosos, daño del detector, batería que no sostiene o errores persistentes del NX, retire de servicio y genere correctivo o remita a servicio técnico autorizado AGFA.',
      ],
      inspeccion: [
        { id: 'dr100ei1', item: 'Estructura, carcasa, columna y brazo del tubo íntegros, sin grietas, golpes, corrosión ni piezas sueltas' },
        { id: 'dr100ei2', item: 'Ruedas/casters y sistema de frenos en buen estado; el equipo rueda y frena con seguridad, sin desplazamiento al frenar' },
        { id: 'dr100ei3', item: 'Movimientos de columna (vertical), brazo (telescópico) y rotación del cabezal suaves, con seguros/frenos que sostienen la posición' },
        { id: 'dr100ei4', item: 'Contrapeso/equilibrado del brazo correcto; el cabezal no cae ni deriva al liberar el freno' },
        { id: 'dr100ei5', item: 'Cabezal/coraza del tubo de rayos X sin fugas de aceite, fisuras, sobrecalentamiento ni ruido anormal' },
        { id: 'dr100ei6', item: 'Colimador íntegro: cuchillas/obturadores, escala de campo, lámpara de campo luminoso y espejo limpios y operativos' },
        { id: 'dr100ei7', item: 'Disparador manual (hand switch) de dos etapas y su cable espiralado en buen estado, con longitud suficiente para mantener distancia del operador' },
        { id: 'dr100ei8', item: 'Botón/seta de parada de emergencia presente, accesible y sin daño' },
        { id: 'dr100ei9', item: 'Detector digital inalámbrico (CsI Dura-line) sin fisuras, golpes ni humedad; carcasa y esquinas íntegras' },
        { id: 'dr100ei10', item: 'Compartimiento/bin de carga del detector y contactos limpios; el detector carga correctamente al guardarlo o con el equipo conectado' },
        { id: 'dr100ei11', item: 'Estación NX: monitor, teclado, mouse/control y soporte firmes, limpios y sin daño' },
        { id: 'dr100ei12', item: 'Cable de alimentación, clavija, enrollador y conexión a tierra en buen estado, sin cortes ni sobrecalentamiento' },
        { id: 'dr100ei13', item: 'Señalización de radiación, etiquetas de marca, modelo DR 100e, serie, activo fijo y clase/tipo de protección legibles y coherentes con el inventario' },
        { id: 'dr100ei14', item: 'Superficies externas, detector, cabezal y consola desinfectados, secos y sin residuos químicos' },
      ],
      verificacionBasica: [
        { id: 'dr100evb1', item: 'El sistema enciende con alimentación de red y el generador completa el arranque sin errores en consola' },
        { id: 'dr100evb2', item: 'La estación NX (Windows) inicia correctamente y carga la aplicación de adquisición' },
        { id: 'dr100evb3', item: 'Indicador de nivel de batería correcto (no parpadea en rojo / no bloquea la operación)' },
        { id: 'dr100evb4', item: 'Fecha, hora y configuración del sistema correctas' },
        { id: 'dr100evb5', item: 'El detector inalámbrico se enlaza/comunica con el NX y reporta carga adecuada' },
        { id: 'dr100evb6', item: 'La lámpara de campo luminoso del colimador enciende y proyecta el campo de forma nítida' },
        { id: 'dr100evb7', item: 'Registro de errores/eventos del generador revisado y sin fallas activas' },
      ],
      pruebasFuncionales: [
        { id: 'dr100epf1', prueba: 'Arranque del generador y autodiagnóstico', valorEsperado: 'Arranque completo sin códigos de error; consola y NX operativos', resultado: ['Pasa', 'Falla'] },
        { id: 'dr100epf2', prueba: 'Indicador y autonomía de batería', valorEsperado: 'Nivel coherente; no bloquea operación; carga adecuada', resultado: ['Pasa', 'Falla'] },
        { id: 'dr100epf3', prueba: 'Lámpara de campo luminoso del colimador y apagado automático por temporizador', valorEsperado: 'Campo nítido y bien delimitado; se apaga sola tras el tiempo previsto', resultado: ['Pasa', 'Falla'] },
        { id: 'dr100epf4', prueba: 'Obturadores/cuchillas del colimador y escala de campo', valorEsperado: 'Abren y cierran suavemente; el tamaño de campo coincide con la escala', resultado: ['Pasa', 'Falla'] },
        { id: 'dr100epf5', prueba: 'Disparador manual de dos etapas (preparación/listo) — respuesta de consola', valorEsperado: 'La consola indica preparación y listo; el disparador es de hombre muerto (libera al soltar)', resultado: ['Pasa', 'Falla'] },
        { id: 'dr100epf6', prueba: 'Botón de parada de emergencia', valorEsperado: 'Corta la operación del equipo de forma segura y se rearma según procedimiento', resultado: ['Pasa', 'Falla'] },
        { id: 'dr100epf7', prueba: 'Movimientos y seguros de columna, brazo telescópico y rotación del cabezal', valorEsperado: 'Movimientos suaves; los seguros/frenos sostienen sin deriva', resultado: ['Pasa', 'Falla'] },
        { id: 'dr100epf8', prueba: 'Frenos de ruedas y maniobrabilidad', valorEsperado: 'Rueda con facilidad; los frenos inmovilizan el equipo con seguridad', resultado: ['Pasa', 'Falla'] },
        { id: 'dr100epf9', prueba: 'Comunicación del detector y adquisición de imagen de prueba (maniquí/placa)', valorEsperado: 'El detector adquiere y transfiere la imagen al NX; MUSICA procesa correctamente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'dr100epf10', prueba: 'Calidad básica del detector en imagen de prueba (sin patrón dosimétrico)', valorEsperado: 'Sin píxeles muertos/líneas ni artefactos críticos; uniformidad aceptable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'dr100epf11', prueba: 'Conectividad NX → PACS/HIS-RIS', valorEsperado: 'Las imágenes se envían y reciben correctamente en PACS', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'dr100epf12', prueba: 'Seguridad eléctrica — Resistencia del conductor de protección (tierra)', valorEsperado: 'Dentro del límite normativo (IEC 62353 / 60601-1)', resultado: ['Pasa', 'Falla'] },
        { id: 'dr100epf13', prueba: 'Seguridad eléctrica — Corriente de fuga a tierra y del envolvente', valorEsperado: 'Dentro de los límites normativos', resultado: ['Pasa', 'Falla'] },
        { id: 'dr100epf14', prueba: 'Verificación dosimétrica (kVp, tiempo, mAs, dosis/DAP, HVL, congruencia luz-radiación)', valorEsperado: 'NO ejecutada aquí por no contar con patrón de rayos X; remitir a laboratorio de dosimetría/control de calidad autorizado con patrón trazable', resultado: ['Remitido a lab. externo', 'N/A'] },
        { id: 'dr100epf15', prueba: 'Limpieza, desinfección y secado final', valorEsperado: 'Equipo, detector, cabezal y consola limpios y secos, sin residuos ni humedad en conectores', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa del equipo, cabezal, colimador, detector y estación NX',
        'Inspección de estructura, columna/brazo, ruedas y frenos, cabezal/tubo, colimador, detector, batería, cables y montaje',
        'Verificación de arranque del generador, NX, fecha/hora y registro de errores',
        'Prueba de lámpara de campo luminoso, obturadores del colimador y escala de campo',
        'Verificación del disparador de dos etapas, parada de emergencia y seguros mecánicos',
        'Comunicación del detector, adquisición de imagen de prueba y revisión básica de calidad de imagen (sin patrón dosimétrico)',
        'Verificación de conectividad NX → PACS',
        'Pruebas de seguridad eléctrica (tierra de protección y corrientes de fuga) conforme a IEC 62353/60601-1',
        'Registro y remisión de la verificación dosimétrica (kVp, tiempo, dosis, HVL, congruencia luz-radiación) a laboratorio autorizado por no contar con patrón de rayos X',
        'Retiro de servicio y remisión a servicio técnico autorizado AGFA ante falla de seguridad eléctrica, generador, parada de emergencia, seguros mecánicos, detector o batería',
      ],
    },
    'electrobisturi_wem_ss501sx': {
      nombre: 'Electrobisturí (Unidad Electroquirúrgica) WEM SS-501 SX',
      categoria: 'Biomédico / Cirugía / Electrocirugía',
      codigo: 'SLV-GAT-BIO-ESU-WEMSS501SX',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el electrobisturí WEM SS-501 SX del uso clínico antes de iniciar el mantenimiento. Verifique que no esté conectado a paciente, que no existan accesorios activos conectados al campo quirúrgico y que el equipo se encuentre disponible para prueba técnica.',
        'El manual de servicio WEM recomienda mantenimiento preventivo cada 6 meses por WEM o por personal técnico calificado; registre los resultados para comparación en mantenimientos futuros.',
        'Equipo electroquirúrgico microprocesado Clase I, parte aplicada tipo CF, operación intermitente, frecuencia básica aproximada 390 kHz, alimentación 100–240 VAC 50/60 Hz con selección automática y potencia máxima de salida de 400 W. Ejecute seguridad eléctrica conforme a IEC 62353 / IEC 60601-1 y verificación HF conforme a IEC 60601-2-2 cuando aplique.',
        'Confirme disponibilidad de analizador electroquirúrgico con carga seleccionable hasta 2000 Ω o superior, analizador de seguridad eléctrica, multímetro digital True RMS, prueba PPM/PLC de 0 a 200 Ω, accesorios de prueba, placa paciente, lápiz monopolar, pinza bipolar y pedales monopolar/bipolar compatibles.',
        'La medición de potencia HF, fuga HF, linealidad de salida y aislamiento entre salidas requiere analizador de electrocirugía calibrado. Si no está disponible, marque estas pruebas como N/A y prográmelas con patrón trazable; las pruebas visuales, encendido, PPM/PLC, pedales, lápiz, tonos y seguridad eléctrica sí se documentan.',
        'No abra la unidad durante el mantenimiento preventivo rutinario. La apertura, desmontaje de tapa, paneles, tarjetas CPU/MB, ajustes internos, calibración o reparación deben ser realizados únicamente por personal calificado/autorizado, conservando el lacre y la trazabilidad del equipo.',
        'Limpie y desinfecte superficies externas, panel, teclas, display, conectores, cable de poder, pedales y accesorios con paño suave levemente humedecido. No aplique líquidos directamente, no sumerja accesorios no sumergibles y no permita humedad en bornes, conectores o porta-fusibles.',
        'Antes de energizar, confirme que la red eléctrica y toma hospitalaria tengan polo a tierra funcional, que el fusible corresponda al valor especificado por fabricante y que no existan signos de humedad, golpes, partes sueltas, olor a quemado o calentamiento anormal.',
        'Durante pruebas de activación, conecte siempre las salidas a carga resistiva/analizador. Nunca active el equipo al aire, sobre superficies metálicas, cerca de gases inflamables o con personas en contacto con los terminales activos o placa paciente.',
        'Si se evidencian fallas de autoprueba, mensaje FAULT persistente, sistema PPM/PLC inoperante, activación sin orden, potencia fuera de tolerancia, fugas eléctricas/HF fuera de límite, conectores/pedales dañados o ventilación deficiente, retire el equipo de servicio y genere correctivo especializado.'
      ],
      inspeccion: [
        { id: 'wem501i1', item: 'Carcasa/conjunto caja íntegro, limpio, sin abolladuras, fisuras, deformación, corrosión, humedad, residuos, golpes severos ni piezas sueltas' },
        { id: 'wem501i2', item: 'Panel frontal/policarbonato, teclas de selección y teclas de incremento/disminución sin daño, rotura, hundimiento, desgaste crítico o respuesta mecánica deficiente' },
        { id: 'wem501i3', item: 'Displays digitales independientes de CUT, COAG y BIPOLAR visibles, sin segmentos apagados, manchas, parpadeo anormal o pérdida de luminosidad' },
        { id: 'wem501i4', item: 'Leds de POWER, STDBY, FAULT, HIGH CUT, PURE, SPRAY/BIPOLAR, PPM/PLC y barra CONTACT visibles, limpios y con identificación legible' },
        { id: 'wem501i5', item: 'Conectores frontales Monopolar 1, Monopolar 2, Bipolar y Patient/placa paciente limpios, firmes, sin pines flojos, corrosión, carbón, deformación o humedad' },
        { id: 'wem501i6', item: 'Panel trasero con interruptor ON/OFF, conectores de pedales, porta-fusibles y fusibles en buen estado; valores de fusible acordes a especificación' },
        { id: 'wem501i7', item: 'Cable de alimentación, clavija, prensa-cable y conexión a tierra íntegros, sin cortes, empalmes, calentamiento, sulfatación ni conductores expuestos' },
        { id: 'wem501i8', item: 'Pedal doble Monopolar 1, pedal doble Monopolar 2 y/o pedal Bipolar disponibles según dotación, limpios, con cable y conector sin daño y accionamiento firme' },
        { id: 'wem501i9', item: 'Lápiz monopolar/handswitch, cable, botones de corte/coagulación y electrodo activo en buen estado, sin fisuras, falso contacto ni aislamiento deteriorado' },
        { id: 'wem501i10', item: 'Pinza/cable bipolar en buen estado, sin aislamiento deteriorado, pines dañados, humedad, corrosión o deformación de terminales' },
        { id: 'wem501i11', item: 'Cable de placa paciente y placa/electrodo de retorno compatibles, íntegros, sin cortes, conectores flojos, vencimiento o empaque deteriorado si son desechables' },
        { id: 'wem501i12', item: 'Rejillas/ventilación libres de polvo, obstrucción, pelusa o residuos que impidan disipación térmica' },
        { id: 'wem501i13', item: 'Carro, soporte, ruedas y frenos (si aplica) estables, limpios y sin riesgo de caída o desplazamiento durante uso' },
        { id: 'wem501i14', item: 'Etiquetas de marca WEM/Medtronic, modelo SS-501 SX, serie, activo fijo, advertencias, clase/tipo de protección y datos eléctricos legibles y coherentes con inventario' },
        { id: 'wem501i15', item: 'Superficies externas y accesorios desinfectados, secos y sin residuos químicos antes de energizar o almacenar' }
      ],
      verificacionBasica: [
        { id: 'wem501vb1', item: 'Al energizar, el equipo entra en STAND BY y los leds POWER/STDBY permanecen encendidos sin olor, ruido, humo o calentamiento anormal' },
        { id: 'wem501vb2', item: 'Al salir de STAND BY sin placa paciente, el equipo muestra condición de FAULT según lógica de seguridad y bloquea activación monopolar' },
        { id: 'wem501vb3', item: 'Con prueba PPM/PLC o placa simulada correctamente conectada, desaparece la falla y se habilita el modo de operación según configuración' },
        { id: 'wem501vb4', item: 'Todos los leds, segmentos de display y barra CONTACT encienden correctamente durante la secuencia de verificación' },
        { id: 'wem501vb5', item: 'Selección de funciones de corte: Pure, Blend 1/2/3, High Cut y ECUT 1/2/3/4 responde correctamente' },
        { id: 'wem501vb6', item: 'Selección de coagulación: Fulgurate/Spray, Forced, Desiccate y Soft responde correctamente' },
        { id: 'wem501vb7', item: 'Selección bipolar, Bipolar Cut, Microbipolar y Macrobipolar responde correctamente según configuración del equipo' },
        { id: 'wem501vb8', item: 'Ajuste de potencia en CUT, COAG y BIPOLAR incrementa/disminuye de forma estable y se visualiza en el display correspondiente' },
        { id: 'wem501vb9', item: 'Función Recall recupera o conserva los últimos valores ajustados según configuración del equipo' },
        { id: 'wem501vb10', item: 'Función Remote permite ajuste de potencia desde accesorio compatible, si está disponible y habilitada' },
        { id: 'wem501vb11', item: 'Pedales Monopolar 1, Monopolar 2 y Bipolar son reconocidos y activan únicamente la salida correspondiente' },
        { id: 'wem501vb12', item: 'Tonos de activación diferencian corte, coagulación y bipolar; volumen audible en ambiente clínico' }
      ],
      pruebasFuncionales: [
        { id: 'wem501pf1', prueba: 'Inspección visual externa del conjunto caja, panel frontal, panel trasero, conectores, porta-fusible y fusibles', valorEsperado: 'Sin abolladuras críticas, conectores dañados, fusible incorrecto, piezas sueltas, corrosión, humedad ni alteraciones no autorizadas', resultado: ['Pasa', 'Falla'] },
        { id: 'wem501pf2', prueba: 'Encendido y condición STAND BY', valorEsperado: 'Mensaje/estado STAND BY correcto; leds POWER y STDBY encendidos; sin alarmas anormales ni calentamiento', resultado: ['Pasa', 'Falla'] },
        { id: 'wem501pf3', prueba: 'Autoverificación de leds, displays y teclas', valorEsperado: 'Todos los leds y segmentos de displays CUT/COAG/BIPOLAR encienden; teclas responden sin bloqueo', resultado: ['Pasa', 'Falla'] },
        { id: 'wem501pf4', prueba: 'Condición sin placa paciente / electrodo de retorno', valorEsperado: 'Equipo muestra FAULT y bloquea activación monopolar hasta conexión segura de placa o prueba PPM/PLC', resultado: ['Pasa', 'Falla'] },
        { id: 'wem501pf5', prueba: 'Circuito PLC con placa única conectada y desconectada', valorEsperado: 'Con placa conectada entra en operación; al desconectar enciende FAULT, apaga PLC y bloquea activación', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf6', prueba: 'Circuito PPM/placa dividida con prueba 0–200 Ω', valorEsperado: 'A 20 Ω habilita CONTACT completo; umbrales de LOCK/FAULT dentro de los valores del manual o criterio institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf7', prueba: 'Selección de modos de corte Pure/Blend/High Cut/ECUT y ajuste de potencia', valorEsperado: 'Selecciona cada modo, permite ajuste estable y muestra valor correcto en display CUT', resultado: ['Pasa', 'Falla'] },
        { id: 'wem501pf8', prueba: 'Selección de modos de coagulación Fulgurate/Forced/Desiccate/Soft y ajuste de potencia', valorEsperado: 'Selecciona cada modo, permite ajuste estable y muestra valor correcto en display COAG', resultado: ['Pasa', 'Falla'] },
        { id: 'wem501pf9', prueba: 'Selección de modos Bipolar/Bipolar Cut/Microbipolar/Macrobipolar y ajuste de potencia', valorEsperado: 'Selecciona cada modo disponible, permite ajuste estable y muestra valor correcto en display BIPOLAR', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf10', prueba: 'Activación por lápiz comando manual en Monopolar 1', valorEsperado: 'Corte y coagulación activan salida Monopolar 1 con tono correspondiente y cesan al soltar', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf11', prueba: 'Activación por lápiz comando manual en Monopolar 2', valorEsperado: 'Corte y coagulación activan salida Monopolar 2 con tono correspondiente y cesan al soltar', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf12', prueba: 'Activación por pedales Monopolar 1, Monopolar 2 y Bipolar', valorEsperado: 'Cada pedal activa solo su salida asignada, con tono correcto, sin activación cruzada ni intermitencia', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf13', prueba: 'Linealidad de potencia al 10%, 50% y 100% de la potencia máxima declarada con analizador HF', valorEsperado: 'Para potencias superiores al 10% de la potencia declarada, desviación dentro de ±20% o criterio IEC 60601-2-2/fabricante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf14', prueba: 'Potencia de salida HF — modo CUT Pure a carga declarada', valorEsperado: 'Hasta 400 W en carga declarada; lectura dentro de tolerancia del fabricante/analizador', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf15', prueba: 'Potencia de salida HF — modos COAG Fulgurate/Forced/Desiccate/Soft', valorEsperado: 'Lecturas dentro de curvas/tolerancias del manual para carga seleccionada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf16', prueba: 'Potencia de salida HF — modos Bipolar/Microbipolar/Bipolar Cut/Macrobipolar', valorEsperado: 'Lecturas dentro de curvas/tolerancias del manual para carga seleccionada y modo disponible', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf17', prueba: 'Corriente de fuga HF en electrodo activo y electrodo dispersivo', valorEsperado: 'Menor a 100 mA o dentro del límite especificado por fabricante/norma aplicable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf18', prueba: 'Aislamiento entre salidas Monopolar 1, Monopolar 2 y Bipolar', valorEsperado: 'No existe salida de potencia no comandada en salidas no seleccionadas durante activación cruzada de prueba', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf19', prueba: 'Circuito automático de selección de voltaje / alimentación 100–240 VAC', valorEsperado: 'Opera estable, sin reinicios ni error de fuente; selección automática funcional según prueba autorizada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf20', prueba: 'Seguridad eléctrica — resistencia del conductor de protección', valorEsperado: '< 0,1 Ω o dentro del límite IEC 62353/IEC 60601-1 institucional para equipo Clase I', resultado: ['Pasa', 'Falla'] },
        { id: 'wem501pf21', prueba: 'Seguridad eléctrica — resistencia de aislamiento', valorEsperado: '> 20 MΩ o dentro del criterio normativo/institucional aplicable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wem501pf22', prueba: 'Seguridad eléctrica — corrientes de fuga a tierra, envolvente, paciente y auxiliar de paciente', valorEsperado: 'Dentro de los límites IEC 62353/IEC 60601-1 y criterios del manual para parte aplicada tipo CF', resultado: ['Pasa', 'Falla'] },
        { id: 'wem501pf23', prueba: 'Inspección de accesorios: cable de fuerza, pedales, placa paciente, lápiz monopolar, pinza/cable bipolar', valorEsperado: 'Accesorios completos, compatibles, limpios, funcionales y sin daño de aislamiento o conectores', resultado: ['Pasa', 'Falla'] },
        { id: 'wem501pf24', prueba: 'Limpieza, desinfección, secado final y rotulado de mantenimiento', valorEsperado: 'Equipo y accesorios limpios, secos, sin humedad en conectores; etiqueta/registro de mantenimiento actualizado', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de unidad electroquirúrgica, panel, conectores, pedales, lápiz, cable de placa y accesorios',
        'Inspección de carcasa, panel frontal, panel trasero, fusibles, cable de alimentación, pedales, conectores, ventilación y rotulado',
        'Verificación de encendido, STAND BY, FAULT, leds, displays, teclas, tonos y selección de modos CUT/COAG/BIPOLAR',
        'Prueba del sistema de monitoreo de placa paciente PPM/PLC y bloqueo de activación ante placa desconectada o contacto deficiente',
        'Prueba de activación por lápiz monopolar y pedales Monopolar 1, Monopolar 2 y Bipolar, confirmando ausencia de activación cruzada',
        'Verificación de funciones Recall/Remote, High Cut, ECUT, coagulación y modos bipolares según configuración del equipo',
        'Medición de potencia HF y linealidad al 10%, 50% y 100% con analizador de electrocirugía cuando se dispone de patrón trazable',
        'Medición de corriente de fuga HF y aislamiento entre salidas de potencia cuando se dispone de analizador de electrocirugía',
        'Pruebas de seguridad eléctrica: tierra de protección, aislamiento y corrientes de fuga conforme a IEC 62353/60601-1',
        'Registro de hallazgos, accesorios verificados, pruebas N/A por ausencia de patrón, estado final y próxima fecha de mantenimiento',
        'Retiro de servicio y remisión a correctivo especializado ante falla de PPM/PLC, potencia fuera de tolerancia, fuga fuera de límite, activación no comandada o daño físico crítico'
      ],
    },

    'electrobisturi_erbe_vio3': {
      nombre: 'Electrobisturí (Unidad Electroquirúrgica) ERBE VIO 3',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-ESU-ERBEVIO3',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire la unidad electroquirúrgica ERBE VIO 3 del uso clínico antes de iniciar el mantenimiento. Verifique que esté apagada y desconectada de la red para la inspección física.',
        'Conecte los accesorios necesarios para las pruebas: instrumento monopolar (lápiz/handswitch), instrumento bipolar, electrodo neutro (placa de retorno, preferiblemente partido para NESSY), pedal(es) y módulo APC si está instalado. Use únicamente accesorios compatibles con ERBE VIO 3 y en buen estado.',
        'Es un equipo eléctrico Clase I con partes aplicadas a paciente (salidas HF monopolar/bipolar y electrodo neutro); ejecute las pruebas de seguridad eléctrica conforme a IEC/EN 62353 o IEC 60601-1. Consumo máx. ~1600 W, corriente de línea media máx. ~6,3 A, clase de potencia 400 W.',
        'La medición de potencia de salida HF requiere un analizador de electrocirugía (p. ej. Fluke QA-ES III o equivalente) con cargas resistivas. Si la institución no dispone del analizador, marque esas pruebas como N/A y prográmelas con el patrón correspondiente; las demás verificaciones (NESSY, activación, tonos, pedales, seguridad eléctrica, displays) sí se realizan.',
        'No abra la unidad ni intervenga la fuente, tarjetas o módulos internos durante el mantenimiento rutinario; las reparaciones internas y actualizaciones de software deben hacerse por personal autorizado ERBE.',
        'Realice limpieza externa con paño suave humedecido en desinfectante compatible; no permita ingreso de líquido a conectores, ranuras, ventilación ni interior. No sumerja la unidad ni los cables.',
        'Si detecta fallas de autoverificación, NESSY inoperante, activación sin orden, fugas eléctricas fuera de límite, daño de conectores/pedales o potencia de salida fuera de tolerancia, retire de servicio y remita a soporte técnico autorizado ERBE.',
      ],
      inspeccion: [
        { id: 'vio3i1', item: 'Carcasa, pantalla táctil y panel frontal/posterior íntegros, sin grietas, golpes, líquidos retenidos ni piezas sueltas' },
        { id: 'vio3i2', item: 'Pantalla limpia y legible, sin manchas internas, líneas ni pérdida de brillo que afecten la lectura de modos, efecto y potencia' },
        { id: 'vio3i3', item: 'Conectores de instrumento monopolar, bipolar, electrodo neutro y pedal(es) limpios, sin pines doblados, corrosión ni daño; identificación presente' },
        { id: 'vio3i4', item: 'Cables de instrumentos, lápiz monopolar, pinza bipolar y cable de electrodo neutro íntegros, sin cortes, grietas ni conductores expuestos' },
        { id: 'vio3i5', item: 'Pedal(es)/footswitch y su cable en buen estado, sin daño y con accionamiento firme; conector seguro' },
        { id: 'vio3i6', item: 'Cable de alimentación, clavija, portafusible y conexión a tierra en buen estado, sin cortes ni sobrecalentamiento' },
        { id: 'vio3i7', item: 'Rejillas de ventilación limpias y libres; sin obstrucción ni acumulación de polvo' },
        { id: 'vio3i8', item: 'Módulo APC y accesorios (si instalados) íntegros, completos y conectados de forma segura' },
        { id: 'vio3i9', item: 'Soporte/carro, ruedas y frenos (si aplica) estables y seguros, sin riesgo de caída del equipo' },
        { id: 'vio3i10', item: 'Etiquetas de marca, modelo VIO 3, serie, activo fijo, clase/tipo de protección y advertencias legibles y coherentes con el inventario' },
        { id: 'vio3i11', item: 'Superficies externas, cables y accesorios desinfectados, secos y sin residuos químicos' },
      ],
      verificacionBasica: [
        { id: 'vio3vb1', item: 'Enciende y completa la autoverificación (self-test) sin errores' },
        { id: 'vio3vb2', item: 'Interfaz stepGUIDE operativa: idioma, fecha/hora y navegación por menús correctas' },
        { id: 'vio3vb3', item: 'Selección de modos CUT y COAG y ajuste de efecto/potencia responden correctamente' },
        { id: 'vio3vb4', item: 'Barra de potencia (power bar) y tono de activación audibles/visibles y ajustables' },
        { id: 'vio3vb5', item: 'Sistema NESSY de electrodo neutro indica estado correctamente (con y sin placa conectada)' },
        { id: 'vio3vb6', item: 'Reconocimiento de pedal(es) e instrumentos al conectarlos' },
        { id: 'vio3vb7', item: 'Versión de software visible y registro de errores sin fallas activas' },
      ],
      pruebasFuncionales: [
        { id: 'vio3pf1', prueba: 'Autoverificación de encendido', valorEsperado: 'Arranque completo sin códigos de error; configuración y reloj correctos', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf2', prueba: 'Pantalla táctil y navegación stepGUIDE', valorEsperado: 'Responde al tacto, navega y selecciona modos/efectos sin fallas', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf3', prueba: 'Selección de modos CUT (autoCUT/dryCUT/endoCUT) y ajuste de efecto y potencia', valorEsperado: 'Selecciona y ajusta correctamente; muestra parámetros configurados', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf4', prueba: 'Selección de modos COAG (softCOAG/forcedCOAG/sprayCOAG) y ajuste', valorEsperado: 'Selecciona y ajusta correctamente; muestra parámetros configurados', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf5', prueba: 'Activación monopolar por handswitch del lápiz', valorEsperado: 'Activa con tono y barra de potencia; cesa al soltar', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf6', prueba: 'Activación monopolar y bipolar por pedal(es)', valorEsperado: 'Cada pedal activa la salida correcta con tono e indicación; cesa al soltar', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf7', prueba: 'Activación bipolar (manual/autostart si configurado)', valorEsperado: 'Activa correctamente la salida bipolar con indicación', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf8', prueba: 'NESSY — Electrodo neutro NO conectado', valorEsperado: 'El equipo alarma e inhibe la activación monopolar', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf9', prueba: 'NESSY — Contacto deficiente / placa partida mal aplicada', valorEsperado: 'Genera advertencia de calidad/dirección del electrodo neutro', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf10', prueba: 'NESSY — Electrodo neutro correctamente aplicado', valorEsperado: 'Habilita la activación monopolar con estado seguro', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf11', prueba: 'Tono de activación y ajuste de volumen', valorEsperado: 'Tono audible durante la activación; volumen ajustable', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf12', prueba: 'Monitoreo de tiempo de activación / auto-stop', valorEsperado: 'Limita/avisa la activación prolongada según configuración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'vio3pf13', prueba: 'Potencia de salida HF — CUT con analizador de electrocirugía y carga resistiva', valorEsperado: 'Dentro de la tolerancia del fabricante para el punto ajustado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'vio3pf14', prueba: 'Potencia de salida HF — COAG con analizador de electrocirugía y carga resistiva', valorEsperado: 'Dentro de la tolerancia del fabricante para el punto ajustado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'vio3pf15', prueba: 'Corriente de fuga HF (con analizador de electrocirugía)', valorEsperado: 'Dentro de los límites del fabricante/normativa', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'vio3pf16', prueba: 'Seguridad eléctrica — Resistencia del conductor de protección (tierra)', valorEsperado: 'Dentro del límite normativo (IEC 62353 / 60601-1)', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf17', prueba: 'Seguridad eléctrica — Corriente de fuga a tierra, del envolvente y de paciente', valorEsperado: 'Dentro de los límites normativos para las partes aplicadas', resultado: ['Pasa', 'Falla'] },
        { id: 'vio3pf18', prueba: 'Limpieza, desinfección y secado final', valorEsperado: 'Unidad, cables, accesorios y pedales limpios y secos, sin residuos ni humedad en conectores', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de la unidad, cables, accesorios y pedales',
        'Inspección de carcasa, pantalla, conectores, cables de instrumentos, electrodo neutro, pedales, ventilación y montaje',
        'Verificación de encendido, autoverificación, stepGUIDE, fecha/hora y versión de software',
        'Prueba de selección de modos CUT y COAG y ajuste de efecto/potencia',
        'Prueba de activación monopolar y bipolar por handswitch y pedal(es) con tono y barra de potencia',
        'Prueba del sistema NESSY (sin placa, contacto deficiente y placa correcta) y del monitoreo de tiempo de activación',
        'Medición de potencia de salida HF en CUT/COAG y corriente de fuga HF con analizador de electrocirugía (si disponible; de lo contrario, programado con patrón)',
        'Pruebas de seguridad eléctrica (tierra de protección y corrientes de fuga) conforme a IEC 62353/60601-1',
        'Cambio de accesorios y registro de hallazgos, parámetros verificados y próxima fecha de mantenimiento',
        'Retiro de servicio y remisión a servicio técnico autorizado ERBE ante falla de seguridad eléctrica, NESSY, activación indebida o potencia fuera de tolerancia',
      ],
    },
    'ecografo_esaote_mylab_sigma': {
      nombre: 'Ecógrafo ESAOTE MyLab Sigma',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-ECO-MLSIGMA',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el ecógrafo se encuentre apagado, limpio y desconectado de la red eléctrica antes de iniciar la inspección física externa.',
        'Este protocolo se ajusta para verificación preventiva sin fantoma: las pruebas se limitan a inspección física, reconocimiento de transductores, operación del sistema, controles, almacenamiento, exportación, batería, alarmas/mensajes y estabilidad.',
        'Identifique los transductores disponibles del equipo y registre modelo/serial cuando aplique: convexo, lineal, microconvexo, endocavitario o sectorial.',
        'No aplique líquidos directamente sobre el equipo, pantalla, teclado, trackball, conectores ni transductores; utilice paño humedecido y desinfectante compatible.',
        'No desarme la consola, fuente, batería, panel táctil, módulos internos ni transductores durante el mantenimiento preventivo rutinario.',
        'Evite flexionar excesivamente los cables de los transductores y no halar desde el cable; manipule siempre desde el conector y el cuerpo del transductor.',
        'Las pruebas de seguridad eléctrica y corrientes de fuga deben realizarse con analizador certificado según el programa institucional cuando aplique.',
        'Si se evidencian artefactos persistentes, pérdida de elementos del transductor, daño del cable, sobrecalentamiento, error de arranque o falla de imagen, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'sigma_i1', item: 'Consola, carcasa, pantalla, bisagras y cubiertas sin grietas, golpes, deformaciones, partes flojas ni daño visible' },
        { id: 'sigma_i2', item: 'Pantalla/monitor limpio, con buena visibilidad, sin manchas internas, líneas, pixeles defectuosos o pérdida significativa de brillo' },
        { id: 'sigma_i3', item: 'Teclado, panel táctil, trackball, perillas, botones de ganancia/TGC y controles de congelar/guardar responden físicamente' },
        { id: 'sigma_i4', item: 'Cable de alimentación, adaptador/fuente, clavija y conexión a tierra sin cortes, sulfatación, calentamiento o falsos contactos' },
        { id: 'sigma_i5', item: 'Conectores de transductores en consola firmes, limpios, sin pines doblados, humedad, fisuras o daño mecánico' },
        { id: 'sigma_i6', item: 'Transductor convexo sin fisuras, desprendimiento de lente acústica, cortes, abultamientos, humedad o daño en el cable' },
        { id: 'sigma_i7', item: 'Transductor lineal sin fisuras, desprendimiento de lente acústica, cortes, abultamientos, humedad o daño en el cable' },
        { id: 'sigma_i8', item: 'Otros transductores disponibles sin daño físico y con conector/cable en buen estado' },
        { id: 'sigma_i9', item: 'Gel, soportes de transductores, porta cables y accesorios limpios, íntegros y correctamente fijados' },
        { id: 'sigma_i10', item: 'Puertos USB, red, video, impresora o conexión DICOM sin daño, obstrucción ni falsos contactos' },
        { id: 'sigma_i11', item: 'Batería instalada sin deformación, fuga, sobrecalentamiento, autonomía crítica o mensaje de falla' },
        { id: 'sigma_i12', item: 'Ventilaciones, rejillas y disipación libres de polvo, obstrucciones o acumulación de residuos' },
        { id: 'sigma_i13', item: 'Ruedas, frenos, asa, base, carro o soporte estables y funcionales si aplica' },
        { id: 'sigma_i14', item: 'Etiquetas de identificación, activo fijo, serial, advertencias y estado de mantenimiento legibles' },
      ],
      verificacionBasica: [
        { id: 'sigma_vb1', item: 'Enciende con alimentación AC y completa arranque/autoverificación sin errores técnicos persistentes' },
        { id: 'sigma_vb2', item: 'Pantalla inicial, fecha, hora, presets, identificación del paciente y menús principales se visualizan correctamente' },
        { id: 'sigma_vb3', item: 'Controles principales de ganancia, profundidad, foco, TGC, congelar, guardar, medición e impresión/exportación responden correctamente' },
        { id: 'sigma_vb4', item: 'Reconoce cada transductor conectado y permite selección de preset clínico correspondiente sin error' },
        { id: 'sigma_vb5', item: 'Funciona con batería al desconectar AC y muestra estado de carga/autonomía sin apagado inmediato' },
        { id: 'sigma_vb6', item: 'Registro/almacenamiento de imagen o clip en memoria interna/USB verificado si aplica' },
        { id: 'sigma_vb7', item: 'Impresora, exportación USB, red o DICOM verificada si está configurada en la institución' },
        { id: 'sigma_vb8', item: 'Ventilador o sistema de enfriamiento sin ruido anormal, calentamiento excesivo o mensajes de temperatura' },
      ],
      pruebasFuncionales: [
        { id: 'sigma_pf1', prueba: 'Arranque del sistema y carga de software', valorEsperado: 'Inicio completo sin error, bloqueo, reinicio o mensaje crítico', resultado: ['Pasa', 'Falla'] },
        { id: 'sigma_pf2', prueba: 'Reconocimiento de transductor convexo', valorEsperado: 'El equipo identifica el transductor y habilita preset abdominal/obstétrico según configuración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'sigma_pf3', prueba: 'Reconocimiento de transductor lineal', valorEsperado: 'El equipo identifica el transductor y habilita preset vascular/partes blandas según configuración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'sigma_pf6', prueba: 'Ajuste de profundidad', valorEsperado: 'Modifica profundidad de imagen de forma progresiva y estable', resultado: ['Pasa', 'Falla'] },
        { id: 'sigma_pf7', prueba: 'Ajuste de ganancia general y TGC', valorEsperado: 'La imagen cambia de brillo/compensación de forma uniforme y controlada', resultado: ['Pasa', 'Falla'] },
        { id: 'sigma_pf8', prueba: 'Ajuste de foco y frecuencia/preset', valorEsperado: 'Permite modificar foco/frecuencia/preset y mejora esperada de resolución según transductor', resultado: ['Pasa', 'Falla'] },
        { id: 'sigma_pf12', prueba: 'Modo M si está disponible', valorEsperado: 'El modo se activa, muestra línea/curva de tiempo y permite ajuste de controles sin bloqueo ni error', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'sigma_pf13', prueba: 'Color Doppler si está disponible', valorEsperado: 'Mapa de color aparece, ajusta escala/ganancia y no presenta ruido excesivo sin señal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'sigma_pf14', prueba: 'Doppler pulsado / espectral si está disponible', valorEsperado: 'El modo se activa, habilita cursor/volumen de muestra, controles de escala/ganancia y audio sin bloqueo ni error', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'sigma_pf15', prueba: 'Freeze, cine loop y revisión de imagen', valorEsperado: 'Congela, reproduce/revisa secuencia y permite retornar a imagen en vivo sin error', resultado: ['Pasa', 'Falla'] },
        { id: 'sigma_pf16', prueba: 'Almacenamiento de imagen/clip y recuperación', valorEsperado: 'Guarda y abre imagen/clip del paciente o prueba sin pérdida de datos', resultado: ['Pasa', 'Falla'] },
        { id: 'sigma_pf17', prueba: 'Exportación USB / DICOM / red si aplica', valorEsperado: 'Exporta o envía estudio correctamente según configuración institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'sigma_pf18', prueba: 'Impresión de imagen o reporte si aplica', valorEsperado: 'Impresión/registro legible y con datos correctos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'sigma_pf19', prueba: 'Funcionamiento en batería con imagen activa', valorEsperado: 'Mantiene operación estable sin apagado inmediato ni alarma crítica', resultado: ['Pasa', 'Falla'] },
        { id: 'sigma_pf20', prueba: 'Prueba final de estabilidad operativa', valorEsperado: 'Equipo opera mínimo 10 minutos sin bloqueo, reinicio, ruido anormal ni sobrecalentamiento', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Desinfección superficial compatible', 'Verificación de transductores', 'Verificación de controles e interfaz', 'Verificación de almacenamiento/exportación', 'Verificación Doppler si aplica', 'Verificación de batería', 'Verificación de exportación/DICOM', 'Remisión a servicio técnico'],
    },

    'tensiometro_pared_welch_allyn_tycos': {
      nombre: 'Tensiómetro de Pared WELCH ALLYN TYCOS',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-TYCO',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el tensiómetro se encuentre limpio, seco y firmemente instalado en pared antes de iniciar la inspección.',
        'Confirme disponibilidad de patrón de presión calibrado, manómetro digital calibrado o columna patrón para comparación cuando se realice verificación metrológica.',
        'No utilice el equipo en pacientes durante la verificación de presión, prueba de fuga o revisión de mangueras.',
        'No aplique solventes, inmersión, autoclave ni líquidos directos sobre el manómetro, pera, válvula o mangueras.',
        'Si se evidencia aguja fuera de cero, fuga persistente, daño del brazalete, escala ilegible, manguera fisurada o lectura fuera de tolerancia, retire de servicio y remita a calibración o mantenimiento correctivo.',
      ],
      inspeccion: [
        { id: 'tycos_i1', item: 'Manómetro aneroide de pared firmemente instalado, sin golpes, deformaciones ni partes flojas' },
        { id: 'tycos_i2', item: 'Carátula, escala y numeración legibles; vidrio o cubierta sin fisuras ni opacidad' },
        { id: 'tycos_i3', item: 'Aguja indicadora en reposo dentro de la marca de cero o rango permitido por el fabricante' },
        { id: 'tycos_i4', item: 'Soporte de pared, brazo, base o canastilla de brazalete firmes, limpios y sin corrosión' },
        { id: 'tycos_i5', item: 'Brazalete íntegro, limpio, sin velcro deteriorado, costuras abiertas, manchas o pérdida de fijación' },
        { id: 'tycos_i6', item: 'Cámara interna del brazalete sin fugas, deformaciones, endurecimiento o daño visible' },
        { id: 'tycos_i7', item: 'Mangueras flexibles sin grietas, cortes, endurecimiento, obstrucción, dobleces permanentes o fugas visibles' },
        { id: 'tycos_i8', item: 'Conectores, adaptadores y uniones neumáticas firmes, sin sulfatación, aflojamiento o desconexión accidental' },
        { id: 'tycos_i9', item: 'Pera de insuflación íntegra, elástica, sin fisuras, endurecimiento ni pérdida de retorno' },
        { id: 'tycos_i10', item: 'Válvula de liberación funcional, con cierre y apertura progresiva sin atascos' },
        { id: 'tycos_i11', item: 'Etiqueta de identificación, activo fijo, marca/modelo y estado de calibración legibles si aplica' },
        { id: 'tycos_i12', item: 'Equipo limpio externamente y libre de residuos, polvo o contaminación visible' },
      ],
      verificacionBasica: [
        { id: 'tycos_vb1', item: 'El sistema infla de forma uniforme al accionar la pera de insuflación' },
        { id: 'tycos_vb2', item: 'La aguja asciende de manera progresiva, sin saltos, trabas o vibración anormal' },
        { id: 'tycos_vb3', item: 'La válvula permite liberar presión de forma controlada y gradual' },
        { id: 'tycos_vb4', item: 'La aguja retorna a cero al descargar completamente el sistema' },
        { id: 'tycos_vb5', item: 'El brazalete permite ajuste adecuado y cierre firme para uso clínico' },
        { id: 'tycos_vb6', item: 'No se observan fugas audibles en pera, válvula, mangueras, cámara o conectores' },
        { id: 'tycos_vb7', item: 'El soporte de pared permite acceso seguro al equipo y no interfiere con el uso del brazalete' },
        { id: 'tycos_vb8', item: 'La limpieza y desinfección superficial se realizó con paño suave y agente compatible institucional' },
      ],
      pruebasFuncionales: [
        { id: 'tycos_pf1', prueba: 'Verificación de cero del manómetro', valorEsperado: 'Aguja en cero o dentro del rango de tolerancia del fabricante antes de presurizar', resultado: ['Pasa', 'Falla'] },
        { id: 'tycos_pf2', prueba: 'Presurización inicial del sistema', valorEsperado: 'Alcanza presión de prueba sin esfuerzo excesivo, fuga visible o caída inmediata', resultado: ['Pasa', 'Falla'] },
        { id: 'tycos_pf3', prueba: 'Comparación de lectura a 50 mmHg con patrón de presión calibrado si disponible', valorEsperado: 'Lectura dentro de tolerancia institucional / fabricante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tycos_pf4', prueba: 'Comparación de lectura a 100 mmHg con patrón de presión calibrado si disponible', valorEsperado: 'Lectura dentro de tolerancia institucional / fabricante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tycos_pf5', prueba: 'Comparación de lectura a 150 mmHg con patrón de presión calibrado si disponible', valorEsperado: 'Lectura dentro de tolerancia institucional / fabricante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tycos_pf6', prueba: 'Comparación de lectura a 200 mmHg con patrón de presión calibrado si disponible', valorEsperado: 'Lectura dentro de tolerancia institucional / fabricante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tycos_pf7', prueba: 'Comparación de lectura a 250 mmHg con patrón de presión calibrado si disponible', valorEsperado: 'Lectura dentro de tolerancia institucional / fabricante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tycos_pf8', prueba: 'Comparación de lectura a 300 mmHg con patrón de presión calibrado si disponible', valorEsperado: 'Lectura dentro de tolerancia institucional / fabricante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tycos_pf9', prueba: 'Prueba de fuga neumática con brazalete y mangueras instaladas', valorEsperado: 'Presión estable sin caída significativa durante el tiempo de observación definido por el procedimiento institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'tycos_pf10', prueba: 'Liberación controlada de presión mediante válvula', valorEsperado: 'Desinflado uniforme y controlable, sin bloqueo ni descarga brusca no intencionada', resultado: ['Pasa', 'Falla'] },
        { id: 'tycos_pf11', prueba: 'Prueba de sobrepresión funcional hasta rango alto de escala', valorEsperado: 'El manómetro responde sin trabas, daño, fuga o deformación del sistema', resultado: ['Pasa', 'Falla'] },
        { id: 'tycos_pf12', prueba: 'Retorno de aguja posterior a la descarga completa', valorEsperado: 'Retorna a cero o zona permitida sin quedar desplazada', resultado: ['Pasa', 'Falla'] },
        { id: 'tycos_pf13', prueba: 'Evaluación funcional de pera de insuflación', valorEsperado: 'Compresión y recuperación normales, sin fisuras ni pérdida de presión', resultado: ['Pasa', 'Falla'] },
        { id: 'tycos_pf14', prueba: 'Evaluación funcional de conectores y acoples neumáticos', valorEsperado: 'Conexiones firmes, sin fugas, desprendimientos o adaptadores flojos', resultado: ['Pasa', 'Falla'] },
        { id: 'tycos_pf15', prueba: 'Prueba final de operación completa', valorEsperado: 'Sistema infla, mantiene, libera presión y retorna a cero de forma segura y repetible', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Desinfección superficial compatible', 'Verificación de cero', 'Verificación neumática', 'Prueba de fuga', 'Comparación contra patrón si disponible', 'Cambio de brazalete', 'Cambio de mangueras', 'Cambio de pera o válvula', 'Remisión a calibración / metrología', 'Remisión a mantenimiento correctivo'],
    },

    'electrocardiografo_nihon_kohden_ecg2250': {
      nombre: 'Electrocardiógrafo NIHON KOHDEN ECG-2250 (Cardiofax G)',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-EG',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador Fluke ProSim 8 (o equivalente) con certificado de calibración vigente.',
        'Conecte el cable de paciente de 10 derivaciones al simulador ProSim 8 en modo ECG de 12 canales.',
        'Verifique disponibilidad de papel térmico compatible (papel cuadriculado ECG de alta resolución).',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Si se evidencian daños, errores persistentes o degradación en la calidad de trazo, retire de servicio y remita a soporte técnico autorizado Nihon Kohden.',
      ],
      inspeccion: [
        { id: 'ecg1', item: 'Carcasa, pantalla LCD y panel de control sin grietas, deformaciones ni daño visible' },
        { id: 'ecg2', item: 'Cable de poder y clavija en buen estado, sin sulfatación o roturas' },
        { id: 'ecg3', item: 'Cable de paciente de 10 derivaciones íntegro, sin cortes ni conectores sueltos' },
        { id: 'ecg4', item: 'Electrodos de succión (precordiales) y pinzas (extremidades) limpios y funcionales' },
        { id: 'ecg5', item: 'Cabezal de impresión térmica limpio, sin residuos ni rayones' },
        { id: 'ecg6', item: 'Bandeja de papel y mecanismo de alimentación funcionando correctamente' },
        { id: 'ecg7', item: 'Batería interna sin signos de fuga, deformación o sobrecalentamiento' },
        { id: 'ecg8', item: 'Puerto USB / tarjeta SD funcional (almacenamiento de registros)' },
        { id: 'ecg9', item: 'Etiquetas de identificación, activo fijo y número de serie legibles' },
        { id: 'ecg10', item: 'Equipo limpio externamente; sin residuos, gel o contaminación visible' },
      ],
      verificacionBasica: [
        { id: 'ecgvb1', item: 'Enciende correctamente con AC y en modo batería' },
        { id: 'ecgvb2', item: 'Pantalla LCD muestra información clara, fecha y hora correctas' },
        { id: 'ecgvb3', item: 'Teclado/panel táctil responde correctamente a todas las funciones' },
        { id: 'ecgvb4', item: 'Autotest de calibración interna (1 mV) pasa sin errores' },
        { id: 'ecgvb5', item: 'Impresión de prueba con trazo legible y cuadrícula alineada' },
        { id: 'ecgvb6', item: 'Modo automático (adquisición + interpretación + impresión) funcional' },
        { id: 'ecgvb7', item: 'Almacenamiento y recuperación de registros ECG previos verificado' },
        { id: 'ecgvb8', item: 'Indicador de nivel de batería correcto' },
      ],
      pruebasFuncionales: [
        { id: 'ecgpf1', prueba: 'Señal de calibración interna 1 mV — Pulso cuadrado 1 mV del equipo', valorEsperado: '10 mm de deflexión (ganancia 10 mm/mV)', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf2', prueba: 'ECG 12 derivaciones: NSR 60 BPM — ProSim 8, todas las derivaciones', valorEsperado: '60 BPM (± 1 BPM), trazo limpio en 12 canales', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf3', prueba: 'ECG 12 derivaciones: NSR 80 BPM — ProSim 8', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf4', prueba: 'ECG 12 derivaciones: NSR 120 BPM — ProSim 8', valorEsperado: '120 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf5', prueba: 'Amplitud de onda: Señal 1 mV en derivación II — ProSim 8', valorEsperado: '10 mm (± 0.5 mm) a ganancia estándar', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf6', prueba: 'Amplitud de onda: Señal 2 mV en derivación II — ProSim 8', valorEsperado: '20 mm (± 1 mm) a ganancia estándar', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf7', prueba: 'Velocidad de papel 25 mm/s — Medir 5 cuadros grandes = 1 segundo', valorEsperado: '25 mm/s (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf8', prueba: 'Velocidad de papel 50 mm/s — Medir 10 cuadros grandes = 1 segundo', valorEsperado: '50 mm/s (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf9', prueba: 'Filtro de línea base (0.05 Hz) — Señal con deriva de línea base ProSim 8', valorEsperado: 'Línea base estable, sin deriva visible', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf10', prueba: 'Filtro de red 60 Hz — Señal con ruido de red eléctrica ProSim 8', valorEsperado: 'Ruido de 60 Hz eliminado del trazo', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf11', prueba: 'Filtro muscular (EMG 25/40 Hz) — Señal con artefacto muscular', valorEsperado: 'Reducción visible de artefacto sin distorsión QRS', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf12', prueba: 'Detección de derivación desconectada — Retirar una derivación del simulador', valorEsperado: 'Mensaje de derivación caída en pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf13', prueba: 'Interpretación automática — NSR normal en ProSim 8', valorEsperado: 'Interpretación: "Ritmo sinusal normal" o equivalente', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf14', prueba: 'Calidad de impresión — Trazo impreso con todas las derivaciones visibles', valorEsperado: 'Cuadrícula nítida, trazos definidos, sin áreas en blanco', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf15', prueba: 'Modo manual vs automático — Comparar trazos del mismo ritmo', valorEsperado: 'Trazos idénticos en ambos modos', resultado: ['Pasa', 'Falla'] },
        { id: 'ecgpf16', prueba: 'Batería: Autonomía — Registros consecutivos hasta agotamiento', valorEsperado: '≥ 100 registros con batería cargada', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Limpieza de cabezal térmico', 'Verificación funcional con simulador', 'Cambio de papel térmico', 'Cambio de electrodos', 'Cambio de batería', 'Remisión a servicio técnico'],
    },
    'monitor_fetal_edan_f3': {
      nombre: 'Monitor Fetal EDAN F3',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-MF',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador de frecuencia cardíaca fetal (simulador Doppler fetal) con certificado vigente, o en su defecto utilice el modo de autotest del equipo.',
        'Verifique disponibilidad de papel térmico plegado compatible con el EDAN F3 (papel CTG cuadriculado).',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Los transductores ultrasónicos no deben sumergirse en líquidos; limpiar únicamente con paño húmedo y solución suave.',
        'Si se evidencian daños, errores persistentes o degradación en señal Doppler, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'mf1', item: 'Carcasa, pantalla LCD y panel de control sin grietas, deformaciones ni daño visible' },
        { id: 'mf2', item: 'Cable de poder y clavija en buen estado, sin sulfatación o roturas' },
        { id: 'mf3', item: 'Transductor ultrasónico FHR (Doppler) íntegro, membrana limpia y sin grietas' },
        { id: 'mf4', item: 'Transductor TOCO (presión uterina) íntegro, membrana flexible y limpia' },
        { id: 'mf5', item: 'Cables de transductores sin cortes, dobleces severos ni conectores dañados' },
        { id: 'mf6', item: 'Cinturones abdominales de sujeción en buen estado, elásticos funcionales' },
        { id: 'mf7', item: 'Cabezal de impresión térmica limpio, sin residuos ni rayones' },
        { id: 'mf8', item: 'Bandeja de papel plegado y mecanismo de alimentación funcionando correctamente' },
        { id: 'mf9', item: 'Batería interna sin signos de fuga, deformación o sobrecalentamiento' },
        { id: 'mf10', item: 'Altavoz de audio Doppler funcional (sonido fetal)' },
        { id: 'mf11', item: 'Conector de marcador de evento (botón de paciente) funcional' },
        { id: 'mf12', item: 'Etiquetas de identificación, activo fijo y número de serie legibles' },
      ],
      verificacionBasica: [
        { id: 'mfvb1', item: 'Enciende correctamente con AC y en modo batería' },
        { id: 'mfvb2', item: 'Pantalla LCD muestra información clara, fecha y hora correctas' },
        { id: 'mfvb3', item: 'Teclas de función responden correctamente (inicio monitoreo, detener, imprimir, volumen)' },
        { id: 'mfvb4', item: 'Autotest del equipo pasa sin errores al encender' },
        { id: 'mfvb5', item: 'Impresión de prueba con cuadrícula legible y velocidad de papel verificada' },
        { id: 'mfvb6', item: 'Control de volumen de audio Doppler funcional (mínimo a máximo)' },
        { id: 'mfvb7', item: 'Indicador de nivel de batería correcto' },
        { id: 'mfvb8', item: 'Modo gemelar (FHR1/FHR2) accesible y funcional (si aplica)' },
      ],
      pruebasFuncionales: [
        { id: 'mfpf1', prueba: 'FHR Canal 1: Detección con simulador Doppler fetal — Frecuencia 140 BPM', valorEsperado: '140 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf2', prueba: 'FHR Canal 1: Detección con simulador — Frecuencia 120 BPM', valorEsperado: '120 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf3', prueba: 'FHR Canal 1: Detección con simulador — Frecuencia 200 BPM', valorEsperado: '200 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf4', prueba: 'FHR Canal 1: Detección con simulador — Frecuencia 60 BPM (confirmación)', valorEsperado: '60 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf5', prueba: 'FHR: Audio Doppler — Señal audible clara sin artefactos a volumen medio', valorEsperado: 'Sonido cardíaco fetal claro y nítido', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf6', prueba: 'FHR Canal 2 (gemelar): Detección con simulador — 140 BPM', valorEsperado: '140 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mfpf7', prueba: 'TOCO: Calibración de cero — Transductor en reposo sin presión, ajustar a 0', valorEsperado: 'Línea base 0 unidades (± 5 unidades)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf8', prueba: 'TOCO: Respuesta a presión — Aplicar presión manual graduada sobre el transductor', valorEsperado: 'Deflexión proporcional visible en pantalla y registro', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf9', prueba: 'TOCO: Retorno a línea base — Liberar presión del transductor', valorEsperado: 'Retorno a 0 (± 5 unidades) en < 5 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf10', prueba: 'Velocidad de papel 1 cm/min — Medir 1 cm = 1 minuto en registro impreso', valorEsperado: '1 cm/min (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf11', prueba: 'Velocidad de papel 3 cm/min — Medir 3 cm = 1 minuto en registro impreso', valorEsperado: '3 cm/min (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf12', prueba: 'Calidad de impresión — Cuadrícula CTG nítida, trazos FHR y TOCO definidos', valorEsperado: 'Cuadrícula completa, trazos sin cortes ni áreas en blanco', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf13', prueba: 'Marcador de evento — Presionar botón de evento durante monitoreo', valorEsperado: 'Marca visible en el registro impreso', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf14', prueba: 'Alarma FHR alta — Configurar límite 170 BPM, simular 180 BPM', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf15', prueba: 'Alarma FHR baja — Configurar límite 110 BPM, simular 100 BPM', valorEsperado: 'Alarma audible/visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf16', prueba: 'Alarma pérdida de señal — Retirar transductor FHR del simulador', valorEsperado: 'Alarma de pérdida de señal activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mfpf17', prueba: 'Batería: Autonomía — Monitoreo continuo con impresión hasta agotamiento', valorEsperado: '≥ 2 horas de monitoreo continuo', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Limpieza de transductores', 'Limpieza de cabezal térmico', 'Verificación con simulador fetal', 'Cambio de papel CTG', 'Cambio de cinturones', 'Cambio de batería', 'Remisión a servicio técnico'],
    },
    'calentamiento_covidien_warmtouch': {
      nombre: 'Unidad de Calentamiento COVIDIEN WarmTouch',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-UC',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad de termómetro digital calibrado (rango 30–50 °C) con certificado vigente.',
        'Confirme disponibilidad de manta de calentamiento compatible (manta desechable o reutilizable WarmTouch).',
        'Permita que el equipo alcance temperatura ambiente antes de las mediciones iniciales.',
        'No obstruya las entradas o salidas de aire durante las pruebas de funcionamiento.',
        'Si se evidencian daños, olores a quemado, ruidos anormales o errores persistentes, retire de servicio y remita a soporte técnico autorizado.',
      ],
      inspeccion: [
        { id: 'wt1', item: 'Carcasa y estructura exterior sin grietas, deformaciones ni daño visible' },
        { id: 'wt2', item: 'Cable de poder y clavija en buen estado, sin sulfatación, cortes o roturas' },
        { id: 'wt3', item: 'Manguera de distribución de aire íntegra, sin perforaciones, dobleces ni obstrucciones' },
        { id: 'wt4', item: 'Conector de manguera a la unidad firme y sin fugas de aire' },
        { id: 'wt5', item: 'Filtro de entrada de aire limpio y sin obstrucción (verificar/reemplazar si es necesario)' },
        { id: 'wt6', item: 'Panel de control y perilla/selector de temperatura sin daño, con marcas legibles' },
        { id: 'wt7', item: 'Indicadores LED / pantalla funcionales' },
        { id: 'wt8', item: 'Ruedas de transporte (si aplica) funcionales y con frenos operativos' },
        { id: 'wt9', item: 'Sin residuos, derrames o contaminación visible en el interior accesible' },
        { id: 'wt10', item: 'Etiquetas de identificación, activo fijo y número de serie legibles' },
      ],
      verificacionBasica: [
        { id: 'wtvb1', item: 'Enciende correctamente y realiza autotest sin errores' },
        { id: 'wtvb2', item: 'Ventilador/turbina arranca y mantiene flujo de aire constante' },
        { id: 'wtvb3', item: 'No se perciben ruidos anormales, vibraciones excesivas ni olores a quemado' },
        { id: 'wtvb4', item: 'Selector de temperatura responde correctamente en todos los niveles (Low / Medium / High)' },
        { id: 'wtvb5', item: 'Indicador de modo de operación (calentamiento activo) visible en pantalla/LED' },
        { id: 'wtvb6', item: 'Flujo de aire se distribuye uniformemente a través de la manta conectada' },
      ],
      pruebasFuncionales: [
        { id: 'wtpf1', prueba: 'Temperatura modo LOW — Medir con termómetro calibrado en salida de manguera', valorEsperado: '32 °C (± 2 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf2', prueba: 'Temperatura modo MEDIUM — Medir con termómetro calibrado en salida de manguera', valorEsperado: '38 °C (± 2 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf3', prueba: 'Temperatura modo HIGH — Medir con termómetro calibrado en salida de manguera', valorEsperado: '43 °C (± 2 °C)', resultado: ['Pasa', 'Falla'] },        { id: 'wtpf6', prueba: 'Estabilidad de temperatura — Mantener modo MEDIUM durante 10 minutos', valorEsperado: 'Variación ≤ ± 1.5 °C durante 10 min', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf7', prueba: 'Alarma de sobretemperatura — Verificar activación si temperatura > 44 °C', valorEsperado: 'Alarma activa y corte de calentamiento automático', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf8', prueba: 'Alarma de manguera desconectada — Retirar manguera durante operación', valorEsperado: 'Alarma audible/visual y reducción de potencia', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf9', prueba: 'Alarma de flujo de aire bloqueado — Obstruir parcialmente salida de manguera', valorEsperado: 'Alarma de obstrucción activa', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf10', prueba: 'Uniformidad de distribución de aire — Verificar temperatura en 3 zonas de la manta', valorEsperado: 'Diferencia ≤ 3 °C entre zonas', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf11', prueba: 'Ruido de operación — Medir con sonómetro o evaluar subjetivamente', valorEsperado: '≤ 55 dB a 1 metro de distancia', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf12', prueba: 'Apagado de seguridad — Verificar apagado automático por falla térmica simulada', valorEsperado: 'Equipo se apaga y muestra código de error', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: ['Limpieza externa', 'Limpieza/cambio de filtro de aire', 'Verificación de temperatura con termómetro calibrado', 'Verificación de alarmas', 'Inspección de manguera y conexiones', 'Remisión a servicio técnico'],
    },

    'termohigrometro_ubibot_gs1a': {
      nombre: 'Termohigrómetro UbiBot GS1-A',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-TH',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el dispositivo esté operativo y con indicador LED en estado normal (verde intermitente) antes de iniciar el procedimiento.',
        'Confirme disponibilidad del patrón de referencia certificado: termohigrómetro calibrado con vigencia de calibración activa, o cámara climática de referencia.',
        'Asegúrese de que el sensor no estuvo expuesto a humedad extrema (> 95% HR), condensación o inmersión en las últimas 24 horas.',
        'El procedimiento debe realizarse en ambiente estable: temperatura entre 15 °C y 35 °C, sin corrientes de aire directas sobre el sensor.',
        'Disponga de acceso a la plataforma UbiBot Console (app móvil o web) para verificar la conectividad Wi-Fi y los datos en tiempo real.',
        'No cubra ni obstruya las ranuras del sensor de temperatura/humedad (parte superior del dispositivo) durante las pruebas.',
        'Si el dispositivo presenta indicador LED rojo permanente o sin respuesta, retire de servicio y remita a soporte técnico antes de continuar.',
      ],
      inspeccion: [
        { id: 'th1',  item: 'Carcasa exterior íntegra, sin grietas, deformaciones, quemaduras ni daño físico visible' },
        { id: 'th2',  item: 'Cubierta del sensor (rejilla superior) limpia, sin polvo acumulado, hongos ni contaminantes visibles' },
        { id: 'th3',  item: 'Indicador LED frontal funcional y visible (verde intermitente = normal; rojo = error)' },
        { id: 'th4',  item: 'Pantalla LCD (si aplica al modelo) con visualización clara de temperatura, humedad y estado de batería' },
        { id: 'th5',  item: 'Conector USB / puerto de carga sin corrosión, deformación ni suciedad' },
        { id: 'th6',  item: 'Antena Wi-Fi interna sin daño externo evidente; señal de red disponible en el área de instalación' },
        { id: 'th7',  item: 'Batería interna o externa (según configuración): sin signos de hinchazón, fuga o sulfatación' },
        { id: 'th8',  item: 'Soporte de montaje o base de instalación en buen estado, fijo y seguro en su posición' },
        { id: 'th9',  item: 'Etiqueta de identificación de activo fijo legible; número de serie coincide con el inventario' },
        { id: 'th10', item: 'Limpieza externa realizada con paño seco o ligeramente humedecido con alcohol isopropílico 70%; rejilla del sensor soplada con aire comprimido seco' },
      ],
      verificacionBasica: [
        { id: 'thvb1', item: 'Dispositivo enciende correctamente y LED parpadea en verde (modo normal de operación)' },
        { id: 'thvb2', item: 'Conexión Wi-Fi establecida: el dispositivo aparece en línea en UbiBot Console (app o web)' },
        { id: 'thvb3', item: 'Datos de temperatura y humedad se actualizan en la plataforma en el intervalo configurado (≤ 10 min)' },
        { id: 'thvb4', item: 'Nivel de señal Wi-Fi adecuado en el punto de instalación (RSSI ≥ -75 dBm recomendado)' },
        { id: 'thvb5', item: 'Nivel de batería reportado en la plataforma: ≥ 20% (o fuente de alimentación USB activa)' },
        { id: 'thvb6', item: 'Fecha y hora del dispositivo sincronizadas correctamente en la plataforma' },
        { id: 'thvb7', item: 'Historial de datos sin brechas prolongadas (gaps) que indiquen desconexiones recurrentes' },
      ],
      pruebasFuncionales: [
        { id: 'thpf1',  prueba: 'Lectura de temperatura — Comparación con patrón de referencia calibrado a temperatura ambiente', valorEsperado: 'Diferencia ≤ ± 0.5 °C respecto al patrón (rango operativo: -20 °C a 60 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf2',  prueba: 'Lectura de humedad relativa — Comparación con patrón calibrado a HR ambiente', valorEsperado: 'Diferencia ≤ ± 3% HR respecto al patrón (rango: 0–95% HR sin condensación)', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf3',  prueba: 'Estabilidad de lectura de temperatura — 3 lecturas consecutivas en 15 min en ambiente estable', valorEsperado: 'Variación entre lecturas ≤ ± 0.3 °C', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf4',  prueba: 'Estabilidad de lectura de humedad — 3 lecturas consecutivas en 15 min en ambiente estable', valorEsperado: 'Variación entre lecturas ≤ ± 2% HR', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf5',  prueba: 'Prueba de alarma de temperatura alta — Configurar umbral 5 °C por debajo del valor actual; verificar notificación', valorEsperado: 'Notificación push/email recibida en ≤ 5 min del evento', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf6',  prueba: 'Prueba de alarma de temperatura baja — Configurar umbral 5 °C por encima del valor actual; verificar notificación', valorEsperado: 'Notificación push/email recibida en ≤ 5 min del evento', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf7',  prueba: 'Prueba de alarma de humedad — Configurar umbral de HR fuera del rango actual; verificar notificación', valorEsperado: 'Notificación push/email recibida correctamente', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf8',  prueba: 'Prueba de reconexión Wi-Fi — Desconectar y reconectar la red Wi-Fi; verificar reconexión automática', valorEsperado: 'Reconexión automática en ≤ 3 min sin intervención manual', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf9',  prueba: 'Intervalo de muestreo configurado — Verificar que los datos se registran en el intervalo programado', valorEsperado: 'Datos disponibles en plataforma en el intervalo configurado (recomendado: 5–10 min)', resultado: ['Pasa', 'Falla'] },
        { id: 'thpf10', prueba: 'Exportación/descarga de datos históricos — Exportar datos de los últimos 30 días desde UbiBot Console', valorEsperado: 'Archivo CSV/Excel descargado correctamente con datos continuos y sin corrupción', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y rejilla del sensor',
        'Verificación y ajuste de conectividad Wi-Fi',
        'Comparación y verificación con patrón calibrado (temperatura y humedad)',
        'Verificación de alarmas y notificaciones en plataforma',
        'Actualización de firmware (si aplica)',
        'Cambio / carga de batería',
        'Ajuste de configuración en UbiBot Console',
        'Remisión a soporte técnico UbiBot',
      ],
    },

    'monitor_mindray_epm10': {
      nombre: 'Monitor de Signos Vitales Mindray EPM-10',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-ME',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física externa.',
        'Confirme disponibilidad del simulador de paciente Fluke ProSim 8 (o equivalente Rigel UNI-SIM / BIOPAK) con certificado de calibración vigente.',
        'Conecte los cables de ECG (10 derivaciones), sensor SpO2, manguito NIBP y sonda de temperatura al simulador antes de iniciar las pruebas funcionales.',
        'Verifique que la batería del monitor esté cargada al 100% antes de las pruebas de autonomía.',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Las intervenciones internas y de servicio avanzado deben realizarse exclusivamente por personal autorizado Mindray según manual de servicio EPM-10.',
        'Si el equipo presenta errores de arranque, pantalla en blanco persistente o alarmas de falla de hardware, retire de servicio y remita a soporte técnico antes de continuar.',
      ],
      inspeccion: [
        { id: 'me1',  item: 'Carcasa frontal y posterior sin grietas, deformaciones, quemaduras ni daño físico visible' },
        { id: 'me2',  item: 'Pantalla TFT de 10.1" sin manchas, píxeles muertos, rayaduras ni reflejo anormal; brillo adecuado' },
        { id: 'me3',  item: 'Teclas de función, perilla giratoria y botón de encendido con respuesta táctil correcta y sin atascamiento' },
        { id: 'me4',  item: 'Cable de alimentación AC, clavija y conector IEC sin corrosión, dobladuras ni daño en el aislante' },
        { id: 'me5',  item: 'Módulo de batería: sin signos de hinchazón, fuga electrolítica ni sulfatación en terminales' },
        { id: 'me6',  item: 'Cable de ECG (5 o 10 derivaciones): conductores íntegros, conectores sin corrosión, codificación de colores legible' },
        { id: 'me7',  item: 'Sensor SpO2 (dedo o clip): cable sin peladura, ventana óptica limpia, sujeción firme' },
        { id: 'me8',  item: 'Manguito NIBP y tubería: sin fisuras, deformaciones ni fugas visibles; válvula de escape funcional' },
        { id: 'me9',  item: 'Sonda de temperatura (si aplica): sin daño, conexión firme, superficie del sensor limpia' },
        { id: 'me10', item: 'Puertos laterales y traseros (USB, red, SpO2, NIBP, temperatura) sin obstrucción ni daño' },
        { id: 'me11', item: 'Rejilla de ventilación sin polvo acumulado ni obstrucción' },
        { id: 'me12', item: 'Etiqueta de identificación, activo fijo y número de serie legibles y coincidentes con inventario' },
        { id: 'me13', item: 'Limpieza externa realizada: carcasa con paño húmedo con alcohol isopropílico 70%; pantalla con paño suave seco' },
      ],
      verificacionBasica: [
        { id: 'mevb1', item: 'Enciende normalmente con AC y completa autoverificación de hardware sin errores persistentes' },
        { id: 'mevb2', item: 'Pantalla muestra imagen uniforme, sin artefactos; brillo y contraste ajustables' },
        { id: 'mevb3', item: 'Transición a modo batería: el monitor opera normalmente al desconectar AC' },
        { id: 'mevb4', item: 'Icono de nivel de batería en pantalla corresponde al estado real de carga' },
        { id: 'mevb5', item: 'Fecha, hora y configuración de alarmas verificadas y correctas' },
        { id: 'mevb6', item: 'Alarma audible: volumen audible a ≥ 1 metro; tono de urgencia diferenciable por prioridad' },
        { id: 'mevb7', item: 'Alarma visual: indicador LED de alarma activo en pantalla para cada condición de alerta' },
        { id: 'mevb8', item: 'Menú de configuración accesible; idioma y unidades correctamente configurados' },
      ],
      pruebasFuncionales: [
        { id: 'mepf1',  prueba: 'ECG: Frecuencia cardíaca — Simulación NSR ProSim 8, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf2',  prueba: 'ECG: Amplitud de onda R — Señal 1 mV, derivación II', valorEsperado: '1.0 mV (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf3',  prueba: 'ECG: Frecuencia respiratoria derivada — Impedancia torácica ProSim 8', valorEsperado: '20 RPM (± 1 RPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf4',  prueba: 'ECG: Detección de arritmia VF — Fibrilación ventricular simulada ProSim 8', valorEsperado: 'Alarma V-Fib activa en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf5',  prueba: 'ECG: Detección de arritmia VT — Taquicardia ventricular simulada ProSim 8', valorEsperado: 'Alarma VT activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf6',  prueba: 'SpO2: Saturación de oxígeno — Simulación óptica ProSim 8, sensor conectado', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf7',  prueba: 'SpO2: Frecuencia de pulso — Simulación ProSim 8', valorEsperado: '80 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf8',  prueba: 'NIBP: Presión sistólica — Simulación estática ProSim 8 / manómetro patrón', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf9',  prueba: 'NIBP: Presión diastólica — Simulación estática ProSim 8', valorEsperado: '80 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf10', prueba: 'NIBP: Presión media (MAP) — Cálculo automático del monitor', valorEsperado: '93 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf11', prueba: 'NIBP: Prueba de fuga neumática — Presurizar manguito a 150 mmHg, ocluir y sostener 30 s', valorEsperado: 'Caída ≤ 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf12', prueba: 'Temperatura: Canal 1 — Simulación resistiva ProSim 8 (sonda piel o rectal)', valorEsperado: '37.0 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf13', prueba: 'Alarma FC alta — Configurar límite 100 BPM; simular 120 BPM con ProSim 8', valorEsperado: 'Alarma audible/visual activa ≤ 5 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf14', prueba: 'Alarma SpO2 baja — Configurar límite 90%; simular 85% con ProSim 8', valorEsperado: 'Alarma audible/visual activa ≤ 5 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf15', prueba: 'Alarma NIBP alta — Configurar límite 140 mmHg sistólica; verificar activación', valorEsperado: 'Alarma activa al superar umbral', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf16', prueba: 'Alarma sensor desconectado — Desconectar cable ECG y sensor SpO2', valorEsperado: 'Alarma técnica inmediata (Lead Off / Sensor Off)', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf17', prueba: 'Autonomía de batería — Operar en modo batería con ECG + SpO2 + NIBP activos', valorEsperado: '≥ 2 horas de operación continua', resultado: ['Pasa', 'Falla'] },
        { id: 'mepf18', prueba: 'Tendencia de datos — Revisar tendencia de FC y SpO2 de las últimas 2 horas', valorEsperado: 'Datos continuos sin brechas; tendencia gráfica correcta', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y pantalla',
        'Verificación funcional completa con simulador ProSim 8',
        'Cambio / reacondicionamiento de batería',
        'Cambio de accesorios (cable ECG, sensor SpO2, manguito NIBP)',
        'Calibración de parámetros (NIBP, temperatura)',
        'Actualización de software/firmware (si aplica)',
        'Verificación y ajuste de configuración de alarmas',
        'Remisión a servicio técnico autorizado Mindray',
      ],
    },

    'desfibrilador_mindray_d3': {
      nombre: 'Desfibrilador Mindray BeneHeart D3',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-D3',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física externa.',
        'Confirme disponibilidad del analizador de desfibrilador Fluke Impulse 4000 (o equivalente Rigel Uni-Pulse / Metrolight) con certificado de calibración vigente.',
        'Conecte las paletas externas o parches multifunction del equipo al analizador antes de iniciar las pruebas de energía.',
        'Verifique que la batería esté completamente cargada (indicador verde / barra completa) antes de las pruebas de autonomía.',
        'Asegúrese de que no haya pacientes ni personal en contacto con las paletas o electrodos durante las descargas de prueba.',
        'No desarme el equipo ni intervenga componentes internos durante el preventivo rutinario.',
        'Las intervenciones internas y de servicio avanzado deben realizarse exclusivamente por personal autorizado Mindray según manual de servicio BeneHeart D3.',
        'Si el equipo presenta errores de autotest, pantalla en blanco persistente o falla al cargar, retire de servicio y remita a soporte técnico antes de continuar.',
      ],
      inspeccion: [
        { id: 'd3i1',  item: 'Carcasa, panel frontal y posterior sin grietas, deformaciones, quemaduras ni daño físico visible' },
        { id: 'd3i2',  item: 'Pantalla LCD/TFT sin manchas, rayaduras ni artefactos; lectura clara a distancia operativa' },
        { id: 'd3i3',  item: 'Teclas de función, selector de energía y botón de descarga con respuesta táctil correcta y sin atascamiento' },
        { id: 'd3i4',  item: 'Cable de alimentación AC, clavija e IEC sin corrosión, dobladuras ni daño en el aislante' },
        { id: 'd3i5',  item: 'Paletas externas (palas de mano): electrodos de acero sin corrosión, suciedad ni marca de quemadura; sujeción firme al cuerpo del equipo' },
        { id: 'd3i6',  item: 'Botón de descarga en paletas (rojo) funcional al tacto; botón de carga en paleta esternal operativo' },
        { id: 'd3i7',  item: 'Electrodos de desfibrilación multifunction (parches): fecha de vencimiento vigente; envoltorio íntegro sin perforaciones' },
        { id: 'd3i8',  item: 'Cable de ECG (3 o 5 derivaciones): conductores íntegros, conectores sin corrosión, codificación de colores legible' },
        { id: 'd3i9',  item: 'Sensor SpO2 (dedo / clip): cable sin peladura, ventana óptica limpia' },
        { id: 'd3i10', item: 'Manguito NIBP y tubería: sin fisuras, deformaciones ni fugas visibles en el circuito neumático' },
        { id: 'd3i11', item: 'Módulo de batería: sin signos de hinchazón, fuga electrolítica ni sulfatación; indicador de carga correcto' },
        { id: 'd3i12', item: 'Papel de registro térmico: disponible, cargado correctamente y sin humedad' },
        { id: 'd3i13', item: 'Puertos de conexión (SpO2, NIBP, temperatura, USB) sin obstrucción ni daño' },
        { id: 'd3i14', item: 'Etiqueta de identificación, activo fijo y número de serie legibles y coincidentes con inventario' },
        { id: 'd3i15', item: 'Limpieza externa realizada: carcasa con paño con alcohol isopropílico 70%; paletas con paño húmedo y secado completo' },
      ],
      verificacionBasica: [
        { id: 'd3vb1', item: 'Enciende correctamente con AC y completa autotest de hardware sin errores (batería, cargador, descarga interna)' },
        { id: 'd3vb2', item: 'Enciende y opera normalmente en modo batería al desconectar AC' },
        { id: 'd3vb3', item: 'Pantalla muestra parámetros correctamente: ECG, FC, SpO2, NIBP y batería visibles y sin artefactos' },
        { id: 'd3vb4', item: 'Selector de nivel de energía funciona correctamente en todos los pasos (2 J a 360 J)' },
        { id: 'd3vb5', item: 'Indicador de carga completa (tono audible + LED) al presionar botón de carga' },
        { id: 'd3vb6', item: 'Botón de descarga en paletas y botón de descarga frontal responden correctamente' },
        { id: 'd3vb7', item: 'Modo sincronizado (SYNC): indicador de sincronismo activo con marcador sobre onda R del ECG simulado' },
        { id: 'd3vb8', item: 'Modo DEA: pantalla guía al operador con instrucciones de voz y texto correctamente' },
        { id: 'd3vb9', item: 'Marcapasos externo (si aplica al modelo): modo MP activo, parámetros de frecuencia y corriente ajustables' },
        { id: 'd3vb10', item: 'Impresora térmica: imprime registro de evento y ECG sin atascos; papel avanza correctamente' },
        { id: 'd3vb11', item: 'Alarma audible: tono de urgencia diferenciable; volumen audible a ≥ 1 metro en ambiente ruidoso' },
      ],
      pruebasFuncionales: [
        { id: 'd3pf1',  prueba: 'Energía entregada 10 J — Carga y descarga en analizador Impulse 4000 (carga 50 Ω)', valorEsperado: '10 J (± 15% = 8.5–11.5 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf2',  prueba: 'Energía entregada 50 J — Carga y descarga en Impulse 4000', valorEsperado: '50 J (± 15% = 42.5–57.5 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf3',  prueba: 'Energía entregada 100 J — Carga y descarga en Impulse 4000', valorEsperado: '100 J (± 15% = 85–115 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf4',  prueba: 'Energía entregada 150 J — Carga y descarga en Impulse 4000', valorEsperado: '150 J (± 15% = 127.5–172.5 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf5',  prueba: 'Energía entregada 200 J — Carga y descarga en Impulse 4000', valorEsperado: '200 J (± 15% = 170–230 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf6',  prueba: 'Energía máxima 360 J — Carga y descarga en Impulse 4000', valorEsperado: '360 J (± 15% = 306–414 J)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf7',  prueba: 'Tiempo de carga a energía máxima — Desde inicio de carga hasta tono de listo (batería cargada)', valorEsperado: '≤ 8 segundos a 360 J', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf8',  prueba: 'Modo sincronizado — Descarga sincronizada con onda R del ECG simulado (NSR 80 BPM ProSim 8)', valorEsperado: 'Retardo de sincronismo ≤ 60 ms post onda R', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf9',  prueba: 'Descarga automática (safety dump) — Cargar a 200 J sin descargar; aguardar 60 s', valorEsperado: 'Equipo descarga internamente y regresa a 0 J (seguridad)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf10', prueba: 'ECG: Frecuencia cardíaca — Simulación NSR 80 BPM ProSim 8, derivación II', valorEsperado: '80 BPM (± 1 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf11', prueba: 'ECG: Detección de fibrilación ventricular — Señal V-Fib ProSim 8', valorEsperado: 'Alarma VF activa; modo DEA recomienda descarga', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf12', prueba: 'ECG: Ritmo no desfibrilable — NSR simulado en modo DEA', valorEsperado: 'DEA indica "No se recomienda descarga"', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf13', prueba: 'SpO2: Saturación — Simulación óptica ProSim 8, sensor conectado', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf14', prueba: 'SpO2: Frecuencia de pulso — Simulación ProSim 8', valorEsperado: '80 BPM (± 2 BPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf15', prueba: 'NIBP: Presión sistólica — Simulación estática ProSim 8', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf16', prueba: 'NIBP: Prueba de fuga neumática — Presurizar a 150 mmHg, ocluir y sostener 30 s', valorEsperado: 'Caída ≤ 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf17', prueba: 'Marcapasos externo (si aplica) — Frecuencia 80 PPM, corriente mínima de captura en Impulse 4000', valorEsperado: 'Ancho de pulso 20–40 ms; frecuencia 80 PPM (± 1.5%)', resultado: ['Pasa', 'N/A'] },
        { id: 'd3pf18', prueba: 'Autonomía de batería — Operar en modo ECG continuo + 3 descargas a 360 J en modo batería', valorEsperado: '≥ 3 descargas a 360 J y ≥ 2 h monitoreo continuo', resultado: ['Pasa', 'Falla'] },
        { id: 'd3pf19', prueba: 'Impresora térmica — Imprimir reporte de evento post descarga', valorEsperado: 'Registro impreso completo, legible, sin manchas ni cortes', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y paletas',
        'Verificación de energía de desfibrilación con analizador Impulse 4000',
        'Verificación de modo DEA y modo sincronizado',
        'Verificación de marcapasos externo (si aplica)',
        'Cambio / reacondicionamiento de batería',
        'Reemplazo de electrodos multifunction (parches) vencidos',
        'Reemplazo de cable ECG o accesorios dañados',
        'Carga de papel térmico',
        'Actualización de software/firmware (si aplica)',
        'Remisión a servicio técnico autorizado Mindray',
      ],
    },

    'desfibrilador_nihon_kohden_cardiolife': {
      nombre: 'Desfibrilador NIHON KOHDEN Cardiolife (Serie TEC)',
      categoria: 'Biomédico / Soporte vital - Desfibrilación y monitoreo',
      codigo: 'SLV-GAT-BIO-DESF-NK-CARDIOLIFE',
      frecuencia: ['Mensual', 'Trimestral', 'Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el desfibrilador Nihon Kohden Cardiolife del uso clínico y confirme que no esté conectado a paciente antes de iniciar mantenimiento preventivo.',
        'Identifique el modelo exacto instalado de la familia Cardiolife / TEC y registre accesorios disponibles: palas externas adulto/pediátricas, cable ECG, cable multifunción, parches, batería, papel térmico y cargador/base si aplica.',
        'Confirme disponibilidad de analizador de desfibrilador calibrado con carga de 50 Ω, simulador ECG/multiparámetro, analizador de seguridad eléctrica, cronómetro, papel térmico, elementos de limpieza y EPP.',
        'Conecte las palas externas o cable de electrodos multifunción al analizador antes de cualquier descarga. Nunca descargue al aire, sobre superficies metálicas, personal o paciente.',
        'Antes de cada descarga anuncie verbalmente el disparo, verifique que el área esté despejada y mantenga las manos fuera de las palas, electrodos y terminales del analizador.',
        'Verifique que la batería esté cargada y que el equipo complete autoprueba/autochequeo sin alarma técnica antes de ejecutar pruebas de energía, DEA, sincronismo o marcapasos.',
        'No abra la carcasa, fuente, módulos de alta tensión, capacitores, registrador, tarjetas ni batería durante el mantenimiento preventivo rutinario. Las intervenciones internas deben ser realizadas por personal autorizado Nihon Kohden o proveedor calificado.',
        'Utilice únicamente accesorios compatibles Nihon Kohden Cardiolife / TEC: palas, parches, cable ECG, sensores, batería, cargador, papel térmico y consumibles aprobados para el modelo instalado.',
        'No realice prueba de descarga si hay humedad visible, gel excesivo, corrosión, cable pelado, palas agrietadas, conector flojo, batería hinchada o mensaje de falla de alta tensión.',
        'Si el equipo presenta falla de autoprueba, error de batería, desviación de energía fuera de tolerancia, falla de sincronismo, falla DEA, fuga eléctrica fuera de límite o tiempo de carga excesivo, retírelo de servicio y genere correctivo especializado.',
      ],
      inspeccion: [
        { id: 'nkcli1', item: 'Carcasa, asa, esquinas, base y cubierta sin grietas, deformaciones, golpes severos, humedad interna, partes sueltas ni evidencia de apertura no autorizada' },
        { id: 'nkcli2', item: 'Pantalla/monitor con brillo, contraste, trazado ECG, energía seleccionada, mensajes, alarmas y estado de batería visibles, sin manchas, líneas, pixeles muertos ni parpadeo' },
        { id: 'nkcli3', item: 'Selector de energía, perilla/teclas de navegación, botones CHARGE, SHOCK, SYNC, AED, PRINT, alarmas y encendido/apagado legibles, firmes y sin atascamiento' },
        { id: 'nkcli4', item: 'Indicadores visuales y audibles de carga, listo para descarga, alarma, estado de autochequeo y error técnico funcionales y perceptibles' },
        { id: 'nkcli5', item: 'Cable de alimentación AC, clavija, conector IEC, alivio de tensión y cargador/base sin cortes, empalmes, sulfatación, pines flojos, quemaduras ni conductor expuesto' },
        { id: 'nkcli6', item: 'Batería y compartimento: sin abombamiento, fuga, corrosión, calentamiento, holgura o mensajes persistentes de falla; contactos limpios y seguros' },
        { id: 'nkcli7', item: 'Palas externas adulto: superficies metálicas limpias, lisas y sin corrosión, picaduras, quemaduras o residuo seco de gel; botones de carga/descarga íntegros' },
        { id: 'nkcli8', item: 'Palas pediátricas o adaptadores integrados, si aplican: mecanismo de retiro/instalación funcional, superficies limpias y sin deterioro' },
        { id: 'nkcli9', item: 'Cable de palas o cable multifunción: aislamiento íntegro, sin torsión excesiva, cortes, aplastamiento, falso contacto o conector fisurado' },
        { id: 'nkcli10', item: 'Parches/electrodos de desfibrilación: empaque sellado, fecha de vencimiento vigente, gel íntegro y cantidad disponible según carro de paro' },
        { id: 'nkcli11', item: 'Cable ECG de 3/5 derivaciones y broches/pinzas: sin peladuras, pines doblados, corrosión, cables rígidos o codificación ilegible' },
        { id: 'nkcli12', item: 'Sensor SpO2, NIBP, CO2 o accesorios adicionales, si el modelo los incorpora: cables íntegros, conectores limpios y funcionamiento básico verificable' },
        { id: 'nkcli13', item: 'Registrador/impresora: tapa, rodillo, cuchilla/borde de corte y mecanismo de avance sin trabas; papel térmico instalado, seco y en sentido correcto' },
        { id: 'nkcli14', item: 'Conectores ECG, palas, SpO2, NIBP, USB/red o tarjeta de memoria sin obstrucción, holgura, corrosión, pines doblados ni suciedad' },
        { id: 'nkcli15', item: 'Etiquetas de identificación, advertencias de alta tensión, placa nominal, activo fijo, serie y datos de calibración/verificación legibles y coincidentes con inventario' },
        { id: 'nkcli16', item: 'Limpieza y desinfección externa realizada en carcasa, pantalla, palas, cables, conectores externos e impresora, evitando ingreso de líquidos' },
      ],
      verificacionBasica: [
        { id: 'nkclvb1', item: 'Enciende con red AC y completa autoverificación inicial sin códigos de error, reinicios, alarma técnica persistente o falla de alta tensión' },
        { id: 'nkclvb2', item: 'Opera en modo batería al desconectar AC, con indicador de carga coherente y sin apagado súbito durante la prueba' },
        { id: 'nkclvb3', item: 'Fecha, hora, idioma, volumen de alarmas, límites básicos y configuración institucional verificados y correctos' },
        { id: 'nkclvb4', item: 'Modo monitor ECG muestra trazo estable al conectar simulador; reconoce derivaciones y alarma lead off al desconectar cable' },
        { id: 'nkclvb5', item: 'Selector de energía permite recorrer los niveles disponibles del modelo sin saltos, bloqueo ni selección errática' },
        { id: 'nkclvb6', item: 'Botón CHARGE carga el equipo y activa tono/indicador de listo; botón SHOCK descarga solo cuando el equipo está cargado y conectado al analizador' },
        { id: 'nkclvb7', item: 'Botones de descarga en palas externas responden de forma simultánea y segura, sin falso contacto ni activación involuntaria' },
        { id: 'nkclvb8', item: 'Modo sincronizado activa marcador sobre onda R y mantiene indicación SYNC visible antes de descarga' },
        { id: 'nkclvb9', item: 'Modo DEA/AED, si aplica, guía con mensajes visuales/auditivos, analiza ritmo simulado y no permite descarga en ritmo no desfibrilable' },
        { id: 'nkclvb10', item: 'Marcapasos transcutáneo, si aplica, permite ajustar frecuencia y corriente y muestra indicación de salida de pulso' },
        { id: 'nkclvb11', item: 'Impresora térmica imprime trazado ECG/evento de prueba con avance uniforme, texto legible y sin atascos' },
        { id: 'nkclvb12', item: 'Indicador de autochequeo/estado del equipo queda en condición normal al finalizar la revisión, sin alarma roja o mensaje de mantenimiento pendiente' },
      ],
      pruebasFuncionales: [
        { id: 'nkclpf1', prueba: 'Autoprueba / self test del equipo según menú del usuario', valorEsperado: 'Resultado PASS/OK para unidad principal, batería, circuito de carga/descarga e impresora si aplica', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf2', prueba: 'Energía entregada 10 J — Carga y descarga sobre analizador de desfibrilador 50 Ω', valorEsperado: '10 J dentro de tolerancia del fabricante o ±15% si el manual/modelo no especifica otra tolerancia', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf3', prueba: 'Energía entregada 50 J — Carga y descarga sobre analizador de desfibrilador 50 Ω', valorEsperado: '50 J dentro de tolerancia del fabricante o ±15% si el manual/modelo no especifica otra tolerancia', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf4', prueba: 'Energía entregada 100 J — Carga y descarga sobre analizador de desfibrilador 50 Ω', valorEsperado: '100 J dentro de tolerancia del fabricante o ±15% si el manual/modelo no especifica otra tolerancia', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf5', prueba: 'Energía entregada 150 J — Carga y descarga sobre analizador de desfibrilador 50 Ω', valorEsperado: '150 J dentro de tolerancia del fabricante o ±15% si el manual/modelo no especifica otra tolerancia', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf6', prueba: 'Energía entregada 200 J — Carga y descarga sobre analizador de desfibrilador 50 Ω', valorEsperado: '200 J dentro de tolerancia del fabricante o ±15% si el manual/modelo no especifica otra tolerancia', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf7', prueba: 'Energía máxima disponible del modelo — Carga y descarga sobre analizador 50 Ω', valorEsperado: 'Energía máxima seleccionada dentro de tolerancia del fabricante; documentar valor seleccionado y valor medido', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'nkclpf8', prueba: 'Tiempo de carga a 200 J con batería cargada', valorEsperado: '≤ 4 s para serie Cardiolife TEC-5600 o dentro del límite especificado para el modelo instalado', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf9', prueba: 'Tiempo de carga a energía máxima con batería cargada', valorEsperado: 'Dentro del límite indicado por el manual del modelo; si no está disponible, registrar tiempo y comparar con historial institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf10', prueba: 'Descarga interna de seguridad — Cargar a 200 J y esperar sin descargar', valorEsperado: 'El equipo cancela/descarga internamente la energía según tiempo de seguridad del modelo y retorna a condición segura', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf11', prueba: 'Modo sincronizado — Simular NSR 80 BPM y descargar con SYNC activado', valorEsperado: 'Marcador de sincronismo sobre QRS y descarga sincronizada con onda R según lectura del analizador', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'nkclpf12', prueba: 'ECG frecuencia cardíaca — Simulación NSR 80 BPM en derivación II', valorEsperado: 'Lectura 80 BPM ± 1 BPM o dentro de tolerancia del simulador utilizado', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf13', prueba: 'Alarma de derivación desconectada — Retirar una derivación ECG durante monitoreo', valorEsperado: 'Mensaje/alarma Lead Off o equivalente inmediato y recuperación al reconectar', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf14', prueba: 'Modo DEA/AED — Ritmo VF simulado en analizador compatible', valorEsperado: 'El equipo analiza y recomienda descarga para ritmo desfibrilable, sin errores de análisis', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'nkclpf15', prueba: 'Modo DEA/AED — Ritmo sinusal normal simulado', valorEsperado: 'El equipo indica no descargar / no shock advised para ritmo no desfibrilable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'nkclpf16', prueba: 'Marcapasos transcutáneo, si aplica — Frecuencia 80 PPM y corriente de prueba en analizador', valorEsperado: 'Frecuencia 80 PPM dentro de tolerancia del analizador y pulsos detectados de forma estable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'nkclpf17', prueba: 'SpO2, si aplica — Simulación 98% / pulso 80 BPM con simulador compatible', valorEsperado: 'SpO2 98% ± 2% y pulso 80 BPM ± 2 BPM', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'nkclpf18', prueba: 'NIBP, si aplica — Simulación estática 120/80 mmHg y prueba de fuga', valorEsperado: 'Lectura dentro de ±3 mmHg o tolerancia del simulador; fuga ≤ 6 mmHg en 30 s', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'nkclpf19', prueba: 'Batería — Operación breve en batería con monitoreo ECG y tres ciclos de carga/descarga de prueba', valorEsperado: 'No presenta apagado, reinicio, alarma crítica inmediata ni caída anormal del indicador de batería', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf20', prueba: 'Seguridad eléctrica IEC 62353 / IEC 60601-1 — Tierra, fuga de chasis y fuga de paciente', valorEsperado: 'Valores dentro de límites normativos para equipo Clase I con partes aplicadas CF/BF a prueba de desfibrilación según configuración', resultado: ['Pasa', 'Falla'] },
        { id: 'nkclpf21', prueba: 'Impresora / registrador — Imprimir tira ECG y evento posterior a descarga de prueba', valorEsperado: 'Impresión legible, avance correcto, hora/evento coherente, sin manchas, cortes ni atasco', resultado: ['Pasa', 'Falla', 'N/A'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de carcasa, pantalla, palas, cables, conectores y registrador',
        'Inspección física de palas adulto/pediátricas, cable multifunción, cable ECG, batería, cargador y consumibles',
        'Ejecución de autoprueba/self test y verificación del indicador de estado Cardiolife',
        'Verificación de carga y descarga con analizador de desfibrilador calibrado',
        'Verificación de energía entregada en 10 J, 50 J, 100 J, 150 J, 200 J y energía máxima disponible',
        'Verificación del tiempo de carga, descarga interna de seguridad y botones de carga/descarga',
        'Verificación de modo sincronizado/cardioversión con simulador ECG',
        'Verificación de modo DEA/AED con ritmos desfibrilables y no desfibrilables si aplica al modelo',
        'Verificación de marcapasos transcutáneo si aplica al modelo instalado',
        'Verificación de ECG, alarmas, impresión, batería y accesorios de monitoreo si aplican',
        'Prueba de seguridad eléctrica con analizador certificado según IEC 62353 / IEC 60601-1',
        'Reemplazo o recomendación de reposición de parches vencidos, papel térmico, cable ECG, palas, batería o accesorios deteriorados',
        'Registro de valores medidos, observaciones, desviaciones y recomendación de correctivo especializado Nihon Kohden si aplica',
      ],
    },


    'aspirador_smaf_sxt5a': {
      nombre: 'Aspirador de Secreciones SMAF SXT-5A',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-AS',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección y limpieza.',
        'Utilice equipo de protección personal (EPP): guantes de nitrilo, tapabocas y gafas de protección durante todo el procedimiento por riesgo biológico.',
        'Vacíe y descontamine el frasco colector antes de iniciar el mantenimiento; descarte el contenido según protocolo de residuos biológicos de la institución.',
        'Confirme disponibilidad del vacuómetro de referencia calibrado (rango mínimo 0 a -760 mmHg) para verificación de vacío.',
        'No sumerja el equipo en líquidos ni permita ingreso de agua a la carcasa o motor.',
        'Si se evidencian daños en el motor, ruidos anormales, vibraciones excesivas o incapacidad de generar vacío, retire de servicio y remita a soporte técnico antes de continuar.',
        'Asegúrese de que el frasco colector esté correctamente ensamblado y con la tapa hermética antes de las pruebas funcionales.',
      ],
      inspeccion: [
        { id: 'as1',  item: 'Carcasa exterior sin grietas, deformaciones, quemaduras ni daño físico visible' },
        { id: 'as2',  item: 'Cable de alimentación AC, clavija y enchufe sin corrosión, dobladuras ni daño en el aislante' },
        { id: 'as3',  item: 'Interruptor de encendido/apagado funcional al tacto; sin atascamiento ni daño' },
        { id: 'as4',  item: 'Perilla o control de regulación de vacío con giro suave y uniforme en todo el rango' },
        { id: 'as5',  item: 'Manómetro o vacuómetro integrado: carátula legible, aguja sin atascamiento, vidrio o acrílico sin fisuras' },
        { id: 'as6',  item: 'Frasco colector: íntegro sin grietas, transparente para visualización del contenido, marcas de nivel legibles' },
        { id: 'as7',  item: 'Tapa del frasco colector: sello hermético en buen estado, sin deformaciones ni grietas; mecanismo de cierre firme' },
        { id: 'as8',  item: 'Flotador de seguridad (anti-desbordamiento): libre de incrustaciones, móvil y funcional' },
        { id: 'as9',  item: 'Tuberías internas y externas: sin acodamientos, fisuras, decoloración ni obstrucciones visibles' },
        { id: 'as10', item: 'Filtro bacteriano (si aplica): sin saturación, decoloración ni humedad excesiva; fecha de cambio vigente' },
        { id: 'as11', item: 'Trampa de agua / filtro hidrofóbico: sin bloqueo por condensación ni humedad' },
        { id: 'as12', item: 'Ruedas o base de soporte: en buen estado, seguras; frenos funcionales (si aplica)' },
        { id: 'as13', item: 'Etiqueta de identificación, activo fijo y número de serie legibles y coincidentes con inventario' },
        { id: 'as14', item: 'Limpieza externa realizada: carcasa con paño con alcohol isopropílico 70%; frasco colector descontaminado con solución enzimática y enjuague completo' },
      ],
      verificacionBasica: [
        { id: 'asvb1', item: 'Enciende correctamente; motor arranca sin ruidos anormales (chirridos, golpeteos o vibraciones excesivas)' },
        { id: 'asvb2', item: 'El equipo genera vacío perceptible al ocluir la entrada de la manguera de aspiración en los primeros 5 segundos' },
        { id: 'asvb3', item: 'Perilla de regulación permite ajustar el vacío de forma progresiva y controlada en todo el rango' },
        { id: 'asvb4', item: 'El frasco colector no presenta fugas de aire con el sistema en operación y la tapa correctamente cerrada' },
        { id: 'asvb5', item: 'Flotador de seguridad bloquea el paso al motor al simular nivel máximo del frasco (prueba funcional de seguridad)' },
        { id: 'asvb6', item: 'El equipo se apaga correctamente al accionar el interruptor; no presenta inercia de motor prolongada anormal' },
      ],
      pruebasFuncionales: [
        { id: 'aspf1', prueba: 'Vacío máximo libre — Encender, ocluir salida de manguera completamente y registrar vacío máximo con vacuómetro patrón', valorEsperado: '≥ -550 mmHg (-73 kPa) en ≤ 30 s (según especificación SXT-5A)', resultado: ['Pasa', 'Falla'] },
        { id: 'aspf2', prueba: 'Vacío de trabajo bajo — Ajustar perilla al mínimo; medir vacío con vacuómetro patrón y manguera ocluid', valorEsperado: 'Vacío regulable ≥ -80 mmHg en posición mínima', resultado: ['Pasa', 'Falla'] },
        { id: 'aspf3', prueba: 'Vacío de trabajo alto — Ajustar perilla al máximo; medir vacío con vacuómetro patrón', valorEsperado: 'Vacío regulable ≤ -550 mmHg en posición máxima', resultado: ['Pasa', 'Falla'] },
        { id: 'aspf4', prueba: 'Estabilidad de vacío — Mantener vacío a -300 mmHg con manguera ocluid durante 60 s; registrar variación', valorEsperado: 'Variación ≤ ± 20 mmHg durante 60 s (sin fugas)', resultado: ['Pasa', 'Falla'] },
        { id: 'aspf6', prueba: 'Tiempo de respuesta — Desde encendido hasta alcanzar -300 mmHg con manguera ocluid', valorEsperado: '≤ 20 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'aspf7', prueba: 'Prueba de hermeticidad del frasco — Generar vacío a -400 mmHg, cerrar válvula de entrada y monitorear durante 2 min', valorEsperado: 'Pérdida de vacío ≤ 30 mmHg en 2 min (sin fugas en frasco ni tapa)', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa',
        'Reemplazo de filtro bacteriano / filtro hidrofóbico',
        'Reemplazo de tuberías o mangueras deterioradas',
        'Verificación de vacío con vacuómetro patrón',
      ],
    },

    'pulsioximetro_mindray_pm60': {
      nombre: 'Pulsioxímetro de Mano Mindray PM-60',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-PX',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y con batería suficiente (≥ 50%) antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador de SpO2 (Fluke ProSim 8 o Nonin 6000Q/equivalente) con certificado de calibración vigente, o en su defecto utilice dedo de prueba Mindray compatible.',
        'Limpie el sensor de SpO2 y la ventana óptica antes de las pruebas para evitar lecturas erróneas por suciedad o residuos.',
        'No exponga el sensor a luz ambiental intensa (luz solar directa o fuentes de alta intensidad) durante las pruebas funcionales.',
        'No sumerja el equipo ni el sensor en líquidos; limpiar únicamente con paño levemente humedecido con alcohol isopropílico 70%.',
        'Las intervenciones internas deben realizarse exclusivamente por personal de servicio autorizado Mindray según manual de servicio PM-60.',
        'Si se evidencian daños, lecturas persistentemente erróneas o mensajes de error no resolubles, retire de servicio y remita a soporte técnico autorizado Mindray.',
      ],
      inspeccion: [
        { id: 'pm1',  item: 'Carcasa exterior íntegra, sin grietas, deformaciones, impactos ni daño físico visible' },
        { id: 'pm2',  item: 'Pantalla OLED/LCD: sin pixeles muertos, manchas ni daño visible; visualización clara y nítida' },
        { id: 'pm3',  item: 'Botones de encendido y navegación sin atascamiento, sin daño; respuesta al tacto correcta' },
        { id: 'pm4',  item: 'Cubierta de la bahía de baterías sin grietas; tapa con cierre firme y resortes intactos' },
        { id: 'pm5',  item: 'Baterías AA instaladas sin signos de fuga, corrosión, deformación ni sulfatación en contactos' },
        { id: 'pm6',  item: 'Contactos metálicos de batería limpios y sin oxidación' },
        { id: 'pm7',  item: 'Cable del sensor SpO2 (si es sensor externo): sin cortes, dobleces severos ni pelado del aislante' },
        { id: 'pm8',  item: 'Conector del sensor SpO2: pines sin dobladuras, sin oxidación y con encaje firme al equipo' },
        { id: 'pm9',  item: 'Ventana óptica del sensor SpO2 (fotodiodo/emisores LED): limpia, sin arañazos, manchas ni residuos' },
        { id: 'pm10', item: 'Clip/pinza del sensor de dedo: muelle funcional con presión adecuada, sin deformación' },
        { id: 'pm11', item: 'Etiqueta de identificación de activo fijo y número de serie legible, coincidente con el inventario' },
        { id: 'pm12', item: 'Limpieza externa realizada con paño suave levemente humedecido con alcohol isopropílico 70%; sensor limpiado con paño suave sin sumergir' },
      ],
      verificacionBasica: [
        { id: 'pmvb1', item: 'Enciende correctamente al presionar el botón de encendido; pantalla muestra logo Mindray y autoverificación sin mensajes de error' },
        { id: 'pmvb2', item: 'Pantalla muestra todos los campos activos: SpO2 (%), Frecuencia de Pulso (lpm), barra de pletismografía (onda de pulso) e indicador de batería' },
        { id: 'pmvb3', item: 'Indicador de nivel de batería muestra carga suficiente (≥ 2 segmentos de 4); sin alarma de batería baja' },
        { id: 'pmvb4', item: 'Barra de pletismografía (onda de pulso) se actualiza en tiempo real al colocar el sensor en dedo de prueba o simulador' },
        { id: 'pmvb5', item: 'Botones de navegación permiten acceder al menú de configuración (alarmas, brillo, modo) sin errores' },
        { id: 'pmvb6', item: 'Alarmas audibles: pitido de pulso activo y funcional (ajustar volumen al mínimo para prueba)' },
        { id: 'pmvb7', item: 'Función de silenciamiento de alarmas accesible y funcional según menú del equipo' },
        { id: 'pmvb8', item: 'Apagado automático por inactividad (tiempo configurado según manual) verificado; el equipo se apaga correctamente' },
      ],
      pruebasFuncionales: [
        { id: 'pmpf1',  prueba: 'SpO2: Saturación 100% — Simulador Fluke ProSim 8 / Nonin 6000Q, perfusión normal (PI 5%)', valorEsperado: '100% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf2',  prueba: 'SpO2: Saturación 98% — Simulador, perfusión normal', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf3',  prueba: 'SpO2: Saturación 95% — Simulador, perfusión normal', valorEsperado: '95% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf4',  prueba: 'SpO2: Saturación 90% — Simulador, perfusión normal', valorEsperado: '90% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf5',  prueba: 'SpO2: Saturación 85% — Simulador, perfusión normal', valorEsperado: '85% (± 3%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf6',  prueba: 'SpO2: Saturación 70% — Simulador (punto mínimo de verificación clínica)', valorEsperado: '70% (± 3%)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf7',  prueba: 'Frecuencia de pulso: 60 lpm — Simulador ProSim 8 / Nonin 6000Q', valorEsperado: '60 lpm (± 2 lpm)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf8',  prueba: 'Frecuencia de pulso: 80 lpm — Simulador', valorEsperado: '80 lpm (± 2 lpm)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf9',  prueba: 'Frecuencia de pulso: 100 lpm — Simulador', valorEsperado: '100 lpm (± 2 lpm)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf10', prueba: 'Frecuencia de pulso: 120 lpm — Simulador', valorEsperado: '120 lpm (± 2 lpm)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf11', prueba: 'Frecuencia de pulso: 250 lpm — Simulador (límite superior)', valorEsperado: '250 lpm (± 3 lpm)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf12', prueba: 'Índice de perfusión (PI) — Simulador con perfusión reducida (1%)', valorEsperado: 'PI ≤ 1% visible en pantalla; indicador de señal débil activo si PI < 0.2%', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf13', prueba: 'Alarma SpO2 baja — Configurar límite inferior 90%; simular 85% con simulador', valorEsperado: 'Alarma audible y visual activa (parpadeo pantalla + pitido)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf14', prueba: 'Alarma FC alta — Configurar límite superior 120 lpm; simular 130 lpm', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf15', prueba: 'Alarma FC baja — Configurar límite inferior 50 lpm; simular 40 lpm', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf16', prueba: 'Alarma sensor desconectado — Retirar sensor del simulador durante medición activa', valorEsperado: 'Mensaje de error / alarma técnica en pantalla inmediata (≤ 10 s)', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf17', prueba: 'Alarma batería baja — Verificar comportamiento con batería casi agotada (< 1 segmento)', valorEsperado: 'Mensaje de batería baja visible; alarma audible de advertencia activa', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pmpf18', prueba: 'Onda pletismográfica — Observar forma de onda en pantalla durante medición activa con simulador', valorEsperado: 'Onda de pulso clara, continua y sincronizada con la frecuencia simulada; sin artefactos', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf19', prueba: 'Estabilidad de lectura — SpO2 98%, FC 80 lpm durante 3 minutos continuos', valorEsperado: 'Lecturas estables sin caídas ni fluctuaciones superiores a ± 2% SpO2 / ± 2 lpm FC', resultado: ['Pasa', 'Falla'] },
        { id: 'pmpf20', prueba: 'Prueba con dedo real del técnico — Colocar dedo índice del técnico en sensor; aguardar estabilización', valorEsperado: 'SpO2: 95–100%; FC fisiológica del técnico; onda pletismográfica visible y estable', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y pantalla',
        'Limpieza de sensor SpO2 y ventana óptica',
        'Limpieza de contactos de batería',
        'Cambio de baterías AA',
        'Cambio de sensor SpO2 (si deteriorado)',
        'Verificación funcional con simulador de SpO2',
        'Verificación y ajuste de alarmas',
        'Remisión a servicio técnico autorizado Mindray',
      ],
    },

    'monitor_mindray_mec1200': {
      nombre: 'Monitor de Signos Vitales Mindray MEC-1200',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-MM',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté apagado y desconectado de la red eléctrica antes de iniciar la inspección física.',
        'Confirme disponibilidad del simulador de paciente Fluke ProSim 8 (o equivalente) con certificado de calibración vigente.',
        'Conecte los cables de ECG, sensor SpO2, manguito NIBP y sensor de temperatura al simulador antes de iniciar pruebas funcionales.',
        'Verifique que el cable de alimentación AC, la batería y todos los accesorios estén disponibles antes del procedimiento.',
        'No desarme el equipo ni intervenga componentes internos durante el mantenimiento preventivo rutinario.',
        'Las intervenciones internas y de servicio avanzado deben realizarse exclusivamente por personal autorizado Mindray según manual de servicio MEC-1200.',
        'Si se evidencian daños, errores persistentes o mal funcionamiento tras las pruebas, retire de servicio y remita a soporte técnico autorizado Mindray.',
      ],
      inspeccion: [
        { id: 'mc1',  item: 'Carcasa frontal, lateral y posterior sin grietas, deformaciones, impactos ni daño físico visible' },
        { id: 'mc2',  item: 'Pantalla TFT color: sin pixeles muertos, manchas, burbujas ni daño visible; brillo y contraste adecuados' },
        { id: 'mc3',  item: 'Panel táctil o teclas de función: respuesta correcta al tacto sin atascamiento ni daño' },
        { id: 'mc4',  item: 'Perilla de navegación (knob): giro uniforme, sin holgura excesiva ni atascamiento' },
        { id: 'mc5',  item: 'Cable de alimentación AC, clavija y enchufe sin corrosión, dobladuras ni daño en el aislante' },
        { id: 'mc6',  item: 'Batería interna sin signos externos de fuga, deformación ni sobrecalentamiento; indicador de carga visible' },
        { id: 'mc7',  item: 'Cable troncal de ECG (5 ó 10 derivaciones): íntegro, sin cortes, dobleces severos ni conectores dañados' },
        { id: 'mc8',  item: 'Sensor SpO2 (clip de dedo o adhesivo): ventana óptica limpia, sin arañazos; cable sin pelado ni dobleces' },
        { id: 'mc9',  item: 'Manguito NIBP y manguera: sin fisuras, grietas ni fugas; conector firme al equipo' },
        { id: 'mc10', item: 'Sensor/sonda de temperatura: íntegro, limpio y conector firme' },
        { id: 'mc11', item: 'Puertos laterales (USB, Ethernet, impresora): sin daño ni obstrucción visible' },
        { id: 'mc12', item: 'Soporte de montaje, brazo o carro: estable, seguro y sin deformaciones; ruedas y frenos funcionales (si aplica)' },
        { id: 'mc13', item: 'Etiqueta de identificación de activo fijo y número de serie legible, coincidente con el inventario' },
        { id: 'mc14', item: 'Limpieza externa realizada: carcasa con paño humedecido en alcohol isopropílico 70%; pantalla con paño suave seco o ligeramente húmedo; accesorios limpios' },
      ],
      verificacionBasica: [
        { id: 'mcvb1', item: 'Enciende correctamente con AC; logo Mindray visible y autoverificación POST completa sin mensajes de error persistentes' },
        { id: 'mcvb2', item: 'Pantalla muestra todos los campos activos en la pantalla principal: ECG, SpO2, NIBP, Temperatura, FR y estado de batería' },
        { id: 'mcvb3', item: 'Opera en modo batería al desconectar AC: el equipo mantiene funcionamiento completo sin interrupciones' },
        { id: 'mcvb4', item: 'Indicador de carga de batería muestra nivel adecuado; sin alarma de batería baja al conectar AC' },
        { id: 'mcvb5', item: 'Perilla de navegación y teclas de función permiten navegar todos los menús sin errores (Configuración, Alarmas, Revisión, NIBP, etc.)' },
        { id: 'mcvb6', item: 'Fecha, hora y datos de configuración básica (unidades, idioma, volumen de alarmas) verificados y correctos' },
        { id: 'mcvb7', item: 'Alarmas audibles y visuales funcionales: el tono de alarma es audible a volumen medio y el indicador luminoso parpadea correctamente' },
        { id: 'mcvb8', item: 'Función de silenciamiento y pausa de alarmas accesible y funcional desde pantalla principal' },
        { id: 'mcvb9', item: 'Detección de sensor desconectado: al retirar un cable, el equipo muestra mensaje de error o alarma técnica en pantalla en ≤ 10 s' },
        { id: 'mcvb10', item: 'Conectividad de red (si aplica): verificar que el equipo aparece en la central de monitoreo o red hospitalaria' },
      ],
      pruebasFuncionales: [
        { id: 'mcpf1',  prueba: 'ECG: Ritmo sinusal normal (NSR) — ProSim 8, derivación II, 80 BPM', valorEsperado: '80 BPM (± 1 BPM); trazo limpio sin artefactos', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf2',  prueba: 'ECG: Amplitud de onda — Señal 1 mV pico, derivación II', valorEsperado: '1.0 mV (± 5%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf3',  prueba: 'ECG: Detección de arritmia — Fibrilación ventricular (V-Fib) ProSim 8', valorEsperado: 'Alarma V-Fib activa (audible y visual)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf4',  prueba: 'ECG: Detección de arritmia — Taquicardia ventricular (V-Tach) ProSim 8', valorEsperado: 'Alarma V-Tach activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf5',  prueba: 'ECG: Detección de asistolia — ProSim 8', valorEsperado: 'Alarma de asistolia activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf6',  prueba: 'RESP: Frecuencia respiratoria — Simulación por impedancia ProSim 8', valorEsperado: '20 RPM (± 1 RPM)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf7',  prueba: 'SpO2: Saturación 98% — Simulador ProSim 8, perfusión normal (PI 5%)', valorEsperado: '98% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf8',  prueba: 'SpO2: Saturación 95% — Simulador ProSim 8', valorEsperado: '95% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf9',  prueba: 'SpO2: Saturación 90% — Simulador ProSim 8', valorEsperado: '90% (± 2%)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf10', prueba: 'SpO2: Frecuencia de pulso — Simulador ProSim 8, 80 lpm', valorEsperado: '80 lpm (± 2 lpm)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf11', prueba: 'SpO2: Alarma de desaturación — Configurar límite 92%, simular 88%', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf12', prueba: 'NIBP: Presión sistólica — Simulación estática ProSim 8', valorEsperado: '120 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf13', prueba: 'NIBP: Presión diastólica — Simulación estática ProSim 8', valorEsperado: '80 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf14', prueba: 'NIBP: Presión media (MAP) — Cálculo automático del monitor', valorEsperado: '93 mmHg (± 3 mmHg)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf15', prueba: 'NIBP: Prueba de fuga del manguito — Inflar a 200 mmHg, ocluir y sostener 30 s', valorEsperado: 'Caída ≤ 6 mmHg en 30 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf16', prueba: 'NIBP: Alarma de hipertensión — Configurar límite sistólica 140 mmHg; simular 160 mmHg', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf17', prueba: 'Temperatura: Canal 1 — Simulación resistiva ProSim 8 a 37.0 °C', valorEsperado: '37.0 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf18', prueba: 'Temperatura: Canal 1 — Simulación a 38.5 °C (fiebre)', valorEsperado: '38.5 °C (± 0.1 °C)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf19', prueba: 'Alarmas de FC: Límite superior 100 lpm — Simular 120 lpm con ProSim 8', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf20', prueba: 'Alarmas de FC: Límite inferior 50 lpm — Simular 40 lpm con ProSim 8', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf21', prueba: 'Alarma sensor ECG desconectado — Retirar cable ECG durante monitoreo activo', valorEsperado: 'Mensaje de derivación caída / alarma técnica inmediata en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf22', prueba: 'Alarma sensor SpO2 desconectado — Retirar sensor SpO2 durante medición activa', valorEsperado: 'Alarma técnica de sensor desconectado en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf23', prueba: 'Batería: Autonomía — Desconectar AC y verificar funcionamiento continuo', valorEsperado: '≥ 2 horas de operación continua con batería cargada (según especificación Mindray MEC-1200)', resultado: ['Pasa', 'Falla'] },
        { id: 'mcpf24', prueba: 'Revisión de tendencias — Navegar al menú de tendencias y verificar registros históricos de los parámetros', valorEsperado: 'Tendencias guardadas accesibles; datos coherentes con las mediciones realizadas', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y pantalla',
        'Limpieza de accesorios (sensor SpO2, manguito NIBP, sonda temperatura, cables ECG)',
        'Verificación funcional con simulador ProSim 8',
        'Calibración / verificación de parámetros NIBP y temperatura',
        'Verificación de alarmas y configuración',
        'Cambio de batería interna',
        'Cambio de accesorios deteriorados',
        'Verificación de conectividad de red (si aplica)',
        'Remisión a servicio técnico autorizado Mindray',
      ],
    },


    'monitor_mindray_epm10m': {
      nombre: 'Monitor de Signos Vitales Mindray ePM 10M',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-EPM10M',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el monitor Mindray ePM 10M del uso clínico y confirme que no esté conectado a ningún paciente antes de iniciar el mantenimiento preventivo.',
        'Realice limpieza y desinfección externa previa conforme al protocolo institucional, evitando ingreso de líquidos en pantalla, conectores, altavoz, registrador, ventilaciones o fuente de alimentación.',
        'Confirme disponibilidad de simulador multiparámetro calibrado tipo Fluke ProSim 8 o equivalente para ECG, RESP, SpO2, NIBP y temperatura.',
        'Utilice accesorios compatibles con Mindray ePM 10M: cable ECG 3/5 derivaciones, sensor SpO2, brazalete NIBP, manguera, sonda de temperatura, cable de alimentación y batería en buen estado.',
        'Conecte el equipo a red eléctrica hospitalaria con puesta a tierra y permita que complete la autoverificación de encendido antes de ejecutar pruebas funcionales.',
        'No abra la carcasa ni intervenga fuente, batería, tarjetas, módulos internos, sensores, bomba NIBP, válvulas o software de servicio durante el mantenimiento preventivo rutinario.',
        'Las reparaciones, calibraciones internas, actualizaciones de software, ajustes de fábrica y pruebas de seguridad eléctrica especializadas deben ser realizadas por personal autorizado o servicio técnico calificado.',
        'No utilice cables ECG resistentes a electrobisturí para la verificación de respiración por impedancia, ya que pueden afectar la medición de RESP.',
        'Si se detectan fallas de alarmas, desviación de parámetros, fuga neumática, batería defectuosa, accesorios deteriorados o mensajes de error persistentes, retire el equipo de servicio y genere mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'epm10mi1', item: 'Carcasa frontal, posterior, asa de transporte y cubiertas laterales íntegras, sin fisuras, golpes, deformaciones, partes sueltas ni signos de impacto' },
        { id: 'epm10mi2', item: 'Pantalla táctil de 10 pulgadas aproximadas con imagen uniforme, brillo adecuado, sin manchas, líneas, parpadeo, pixeles defectuosos ni daño superficial' },
        { id: 'epm10mi3', item: 'Superficie táctil, botón de encendido, controles físicos y accesos rápidos con respuesta adecuada, sin bloqueo, desgaste excesivo ni falsos contactos' },
        { id: 'epm10mi4', item: 'Indicadores visuales, barra de alarmas y altavoz sin obstrucción, suciedad acumulada o pérdida de intensidad/audibilidad' },
        { id: 'epm10mi5', item: 'Conector ECG y cable troncal de 3/5 derivaciones íntegros, sin pines doblados, sulfatación, cortes, peladuras ni falsos contactos' },
        { id: 'epm10mi6', item: 'Electrodos, broches o pinzas ECG limpios, firmes y sin corrosión; accesorios vencidos o deteriorados retirados del servicio' },
        { id: 'epm10mi7', item: 'Sensor SpO2, extensión y conector con ventana óptica limpia, pinza funcional, cable sin peladuras y lectura estable al conectar' },
        { id: 'epm10mi8', item: 'Brazalete NIBP, manguera y acoples neumáticos sin fisuras, fugas, rigidez, obstrucción, desgaste del velcro ni conectores flojos' },
        { id: 'epm10mi9', item: 'Canal o sonda de temperatura disponible, limpia, con aislamiento íntegro y conector firme, si aplica al equipo instalado' },
        { id: 'epm10mi10', item: 'Módulos, puertos opcionales, conectores laterales, USB, red, llamada de enfermería, registrador o CO2 sin daño, suciedad ni pines deformados, si aplica' },
        { id: 'epm10mi11', item: 'Cable de alimentación, clavija, tierra física, fusibles accesibles y adaptador sin cortes, empalmes, calentamiento, corrosión ni aislamiento expuesto' },
        { id: 'epm10mi12', item: 'Batería interna o removible sin deformación, fuga, sulfatación, sobrecalentamiento, hinchamiento ni mensaje persistente de falla o baja capacidad' },
        { id: 'epm10mi13', item: 'Registrador térmico, tapa, rodillo y papel correctamente instalados y sin residuos de papel, si aplica al equipo' },
        { id: 'epm10mi14', item: 'Soporte mural, base rodante, brazo, riel, ruedas y frenos estables y seguros, si el monitor se encuentra instalado en soporte móvil' },
        { id: 'epm10mi15', item: 'Etiquetas de activo fijo, número de serie, placa institucional, advertencias y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'epm10mi16', item: 'Superficies externas limpias y secas; sin residuos de gel, sangre, fluidos, adhesivos o productos químicos en ranuras y conectores' }
      ],
      verificacionBasica: [
        { id: 'epm10mvb1', item: 'Enciende correctamente con alimentación AC, muestra logo Mindray y completa autoverificación inicial sin errores persistentes' },
        { id: 'epm10mvb2', item: 'Pantalla principal visualiza los parámetros configurados: ECG, FC, RESP, SpO2, NIBP, temperatura, batería y alarmas según módulos instalados' },
        { id: 'epm10mvb3', item: 'La pantalla táctil permite navegar por menú principal, configuración de paciente, límites de alarma, tendencias, NIBP y revisión de eventos' },
        { id: 'epm10mvb4', item: 'El monitor conmuta a batería al desconectar AC sin apagarse, reiniciarse ni perder configuración de monitoreo' },
        { id: 'epm10mvb5', item: 'Indicador de alimentación, carga de batería y estado de batería se visualiza correctamente en pantalla' },
        { id: 'epm10mvb6', item: 'Fecha, hora, idioma, categoría de paciente, volumen de alarma y configuración institucional se encuentran correctos' },
        { id: 'epm10mvb7', item: 'Alarmas fisiológicas y técnicas se visualizan en pantalla y generan señal audible; la función de silencio/pausa opera según configuración permitida' },
        { id: 'epm10mvb8', item: 'Los conectores reconocen los accesorios al conectarlos y muestran mensajes adecuados ante desconexión de ECG, SpO2, NIBP o temperatura' },
        { id: 'epm10mvb9', item: 'La bomba NIBP inicia y detiene medición desde la tecla o menú correspondiente sin ruidos anormales, sobrepresión, fuga u obstrucción' },
        { id: 'epm10mvb10', item: 'El registro de tendencias, eventos y almacenamiento de mediciones está disponible y conserva información coherente' },
        { id: 'epm10mvb11', item: 'El registrador térmico imprime trazados y datos numéricos de forma legible, si aplica al equipo instalado' },
        { id: 'epm10mvb12', item: 'La comunicación con red, central de monitoreo o sistema hospitalario se encuentra operativa, si aplica a la configuración instalada' }
      ],
      pruebasFuncionales: [
        { id: 'epm10mpf1', prueba: 'Encendido y autoprueba general con alimentación AC', valorEsperado: 'Inicialización completa sin mensajes de error persistentes ni reinicios espontáneos', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf2', prueba: 'ECG: ritmo sinusal normal en derivación II con simulador a 80 BPM', valorEsperado: 'Frecuencia cardiaca 80 BPM ± 1 BPM y onda ECG estable sin pérdida de señal', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf3', prueba: 'ECG: amplitud de señal 1 mV en derivación II', valorEsperado: 'Visualización 1 mV ± 5% o calibración gráfica equivalente según pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf4', prueba: 'ECG: alarma de frecuencia cardiaca alta configurando límite 100 lpm y simulando 120 lpm', valorEsperado: 'Alarma alta de FC audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf5', prueba: 'ECG: alarma de frecuencia cardiaca baja configurando límite 50 lpm y simulando 40 lpm', valorEsperado: 'Alarma baja de FC audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf6', prueba: 'ECG: desconexión de derivación durante monitoreo activo', valorEsperado: 'Mensaje de derivación desconectada o alarma técnica en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf7', prueba: 'RESP: frecuencia respiratoria por impedancia simulada a 20 RPM', valorEsperado: 'Lectura 20 RPM ± 1 RPM y onda respiratoria estable', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf8', prueba: 'RESP: alarma de apnea o límite bajo mediante simulación sin respiración', valorEsperado: 'Alarma de apnea o RESP baja activa según configuración institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm10mpf9', prueba: 'SpO2: saturación simulada al 98% con perfusión normal', valorEsperado: 'Lectura 98% ± 2% y pulso estable', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf10', prueba: 'SpO2: saturación simulada al 90%', valorEsperado: 'Lectura 90% ± 2%', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf11', prueba: 'SpO2: frecuencia de pulso simulada a 80 lpm', valorEsperado: 'Pulso 80 lpm ± 2 lpm', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf12', prueba: 'SpO2: alarma de desaturación con límite inferior 92% y simulación a 88%', valorEsperado: 'Alarma audible y visual de SpO2 baja activa', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf13', prueba: 'NIBP: presión sistólica simulada 120 mmHg', valorEsperado: 'Lectura sistólica 120 mmHg ± 3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf14', prueba: 'NIBP: presión diastólica simulada 80 mmHg', valorEsperado: 'Lectura diastólica 80 mmHg ± 3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf15', prueba: 'NIBP: presión media MAP en simulación 120/80 mmHg', valorEsperado: 'MAP aproximada 93 mmHg ± 3 mmHg', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf16', prueba: 'NIBP: prueba de fuga neumática del brazalete y manguera a 200 mmHg durante 30 segundos', valorEsperado: 'Caída de presión ≤ 6 mmHg en 30 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf17', prueba: 'NIBP: ciclo manual de medición desde tecla Start/Stop o menú NIBP', valorEsperado: 'Infla, mide, desinfla y muestra resultado sin error de bomba, fuga u obstrucción', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf18', prueba: 'NIBP: ciclo automático en intervalo configurado, si se encuentra habilitado institucionalmente', valorEsperado: 'El monitor ejecuta medición automática según intervalo seleccionado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm10mpf19', prueba: 'Temperatura: simulación canal T1 a 37.0 °C', valorEsperado: 'Lectura 37.0 °C ± 0.1 °C o tolerancia del simulador utilizado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm10mpf20', prueba: 'Temperatura: simulación canal T1 a 38.5 °C', valorEsperado: 'Lectura 38.5 °C ± 0.1 °C o tolerancia del simulador utilizado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm10mpf21', prueba: 'Batería: desconectar AC y operar en batería durante prueba breve de 10 minutos', valorEsperado: 'Mantiene monitoreo continuo sin reinicio, apagado inesperado ni alarma crítica inmediata', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf22', prueba: 'Alarmas técnicas: retirar sensor SpO2, cable ECG o manguera NIBP durante monitoreo activo', valorEsperado: 'Mensaje técnico y alarma visual/audible correspondiente en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf23', prueba: 'Registrador térmico: impresión de curva ECG y datos numéricos, si aplica', valorEsperado: 'Impresión legible, avance normal de papel y fecha/hora coherentes', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'epm10mpf24', prueba: 'Tendencias y eventos: guardar o revisar mediciones realizadas durante la prueba', valorEsperado: 'Registros accesibles, sin error de memoria y coherentes con las mediciones', resultado: ['Pasa', 'Falla'] },
        { id: 'epm10mpf25', prueba: 'Conectividad: verificación de enlace con central de monitoreo o red hospitalaria, si aplica', valorEsperado: 'Equipo visible o comunicando correctamente con identificación del paciente/equipo según configuración', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, pantalla táctil, controles, conectores y panel de alarmas',
        'Limpieza y revisión de cables ECG, sensor SpO2, brazalete NIBP, manguera y sonda de temperatura',
        'Verificación de encendido, autoprueba, configuración básica y operación con red eléctrica',
        'Verificación de funcionamiento en modo batería y estado de carga',
        'Verificación funcional con simulador multiparámetro calibrado',
        'Prueba de ECG, RESP, SpO2, NIBP y temperatura según configuración instalada',
        'Verificación de alarmas fisiológicas, alarmas técnicas y función de silencio/pausa',
        'Verificación de tendencias, eventos, registrador térmico y conectividad, si aplica',
        'Cambio o retiro de accesorios deteriorados, vencidos o no conformes',
        'Recomendación de mantenimiento correctivo, calibración especializada o retiro de servicio cuando aplique'
      ]
    },


    'video_laringoscopio_king_vision_ablade': {
      nombre: 'Videolaringoscopio King Vision aBlade',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-KVABLADE',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el videolaringoscopio King Vision aBlade del uso clínico y confirme que no esté conectado a ningún paciente antes de iniciar el mantenimiento preventivo.',
        'Utilice elementos de protección personal y ejecute limpieza/desinfección externa previa conforme al protocolo institucional y a las instrucciones del fabricante.',
        'Confirme disponibilidad de pantalla reutilizable King Vision, adaptador de video aBlade compatible, hoja aBlade nueva o de prueba sin uso clínico, baterías AAA alcalinas nuevas o verificadas, paño suave y toallas desinfectantes compatibles.',
        'Instale o verifique tres baterías AAA en buen estado antes de la prueba funcional; no utilice baterías con fuga, sulfatación, deformación o vencimiento.',
        'Conecte la hoja o el adaptador de video antes de encender el equipo para evitar imagen dividida, ausencia de imagen o funcionamiento anómalo durante la prueba.',
        'No sumerja la pantalla reutilizable, no lave por inmersión, no esterilice por vapor, autoclave, óxido de etileno, plasma o métodos de alta temperatura.',
        'No permita ingreso de líquidos en la abertura de conexiones eléctricas del vástago inferior de la pantalla, compartimiento de baterías, contactos del adaptador ni conectores de video.',
        'Las hojas aBlade son de un solo uso clínico; después de uso en paciente deben desecharse como residuo biosanitario según protocolo institucional.',
        'No abra, modifique, repare internamente ni intervenga tarjeta electrónica, pantalla, cámara, LED, cableado o conectores. Las reparaciones deben ser gestionadas con proveedor o servicio técnico autorizado.',
        'Si se detecta daño físico, imagen ausente, imagen congelada, baja iluminación, falla de batería, corrosión, contaminación interna o fallas intermitentes, retire el equipo de servicio y genere mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'kvabi1', item: 'Pantalla reutilizable íntegra, sin fisuras, golpes, deformación, carcasa abierta, tornillos faltantes ni evidencia de caída' },
        { id: 'kvabi2', item: 'Display TFT con superficie limpia, sin rayones críticos, manchas, líneas, pixeles muertos, empañamiento interno ni pérdida de brillo' },
        { id: 'kvabi3', item: 'Botón de encendido/apagado funcional, sin bloqueo, hundimiento, falso contacto ni pérdida de respuesta táctil' },
        { id: 'kvabi4', item: 'Compartimiento de baterías limpio, seco, con tapa firme, resortes y contactos sin corrosión, sulfatación, humedad ni deformación' },
        { id: 'kvabi5', item: 'Baterías AAA instaladas con polaridad correcta, sin fuga, óxido, calentamiento, abombamiento ni fecha vencida' },
        { id: 'kvabi6', item: 'Vástago de conexión de la pantalla sin fisuras, holgura excesiva, suciedad, restos biológicos ni líquido visible' },
        { id: 'kvabi7', item: 'Conector eléctrico inferior y contactos limpios, secos, alineados, sin pines doblados, hundidos, sulfatados o sueltos' },
        { id: 'kvabi8', item: 'Adaptador de video reutilizable aBlade compatible, sin fisuras, deformaciones, cable o unión floja, contactos dañados ni contaminación visible' },
        { id: 'kvabi9', item: 'Cámara y ventana óptica del adaptador limpias, transparentes, sin rayones, empañamiento, adhesivos, gel, sangre o secreciones' },
        { id: 'kvabi10', item: 'LED o fuente de iluminación del adaptador sin daño visible y con ventana limpia, sin opacidad ni obstrucción' },
        { id: 'kvabi11', item: 'Mecanismo de acople y bloqueo pantalla-adaptador/hoja firme, estable y sin holgura que afecte la conexión eléctrica o mecánica' },
        { id: 'kvabi12', item: 'Hoja aBlade de prueba nueva o no clínica, empaque íntegro si aplica, sin deformación, bordes cortantes, grietas ni daño de canal' },
        { id: 'kvabi13', item: 'Canal guía de la hoja acanalada, si aplica, sin obstrucciones, deformación ni rebabas que dificulten el paso del tubo endotraqueal' },
        { id: 'kvabi14', item: 'Cable de salida de video opcional, si existe, íntegro y con conectores sin pines doblados ni falso contacto' },
        { id: 'kvabi15', item: 'Estuche, espuma protectora o sistema de almacenamiento limpio, seco, sin humedad, polvo excesivo, fluidos o daño estructural' },
        { id: 'kvabi16', item: 'Etiqueta de activo fijo, número de serie, identificación institucional y fecha de mantenimiento legibles y coincidentes con inventario' }
      ],
      verificacionBasica: [
        { id: 'kvabvb1', item: 'El adaptador de video y/o la hoja aBlade se conectan en posición correcta antes del encendido, con acople firme y sin juego mecánico' },
        { id: 'kvabvb2', item: 'Al encender, la pantalla inicia en pocos segundos, sin reinicios, apagado inesperado, parpadeo ni mensajes de falla persistentes' },
        { id: 'kvabvb3', item: 'La imagen en pantalla aparece completa, centrada y estable; no se presenta pantalla negra, nieve, imagen dividida o congelamiento' },
        { id: 'kvabvb4', item: 'La cámara muestra movimiento en tiempo real al desplazar el campo visual frente a un objeto o patrón de prueba' },
        { id: 'kvabvb5', item: 'La iluminación LED permite visualizar claramente el campo de prueba sin sombras excesivas, intermitencia, baja intensidad ni cambio de color anormal' },
        { id: 'kvabvb6', item: 'El indicador de batería o estado de alimentación no muestra condición crítica; si el indicador está en rojo, se reemplazan baterías antes de liberar el equipo' },
        { id: 'kvabvb7', item: 'Al desconectar la hoja/adaptador durante la prueba, el equipo responde según comportamiento esperado: imagen congelada temporal, pérdida controlada de imagen o apagado automático' },
        { id: 'kvabvb8', item: 'El botón de apagado funciona correctamente y el equipo se apaga sin quedar encendido, bloqueado o con consumo anormal' },
        { id: 'kvabvb9', item: 'La limpieza externa posterior deja pantalla, adaptador y contactos secos, sin residuos de desinfectante, humedad o material orgánico' },
        { id: 'kvabvb10', item: 'El equipo queda almacenado en estuche o ubicación protegida, seco, con accesorios compatibles y sin hoja clínica usada conectada' }
      ],
      pruebasFuncionales: [
        { id: 'kvabpf1', prueba: 'Secuencia de conexión previa — Acoplar adaptador de video/hoja aBlade antes de encender', valorEsperado: 'Acople firme y reconocimiento funcional del conjunto sin imagen dividida ni error de conexión', resultado: ['Pasa', 'Falla'] },
        { id: 'kvabpf2', prueba: 'Encendido con baterías AAA verificadas', valorEsperado: 'Pantalla enciende en ≤ 10 s, sin reinicios, apagado inmediato ni parpadeo anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'kvabpf3', prueba: 'Verificación de imagen en tiempo real sobre patrón de prueba o texto', valorEsperado: 'Imagen clara, completa, con movimiento fluido y sin congelamiento, nieve, líneas, distorsión o pérdida intermitente', resultado: ['Pasa', 'Falla'] },
        { id: 'kvabpf4', prueba: 'Verificación de iluminación LED del adaptador/cámara', valorEsperado: 'Iluminación blanca uniforme, suficiente y estable, sin parpadeo ni zonas oscuras que limiten la visualización', resultado: ['Pasa', 'Falla'] },
        { id: 'kvabpf5', prueba: 'Prueba de enfoque/distancia funcional usando objeto a 2–5 cm de la ventana óptica', valorEsperado: 'Permite identificar bordes y detalles del objeto de prueba con nitidez suficiente para uso clínico', resultado: ['Pasa', 'Falla'] },
        { id: 'kvabpf6', prueba: 'Movimiento y estabilidad mecánica del conjunto pantalla-adaptador-hoja', valorEsperado: 'No hay pérdida de imagen, apagado, falso contacto ni holgura al mover suavemente el conjunto', resultado: ['Pasa', 'Falla'] },
        { id: 'kvabpf7', prueba: 'Indicador de batería durante funcionamiento', valorEsperado: 'Indicador en estado operativo; si aparece rojo o bajo, se reemplazan baterías y se repite prueba', resultado: ['Pasa', 'Falla'] },
        { id: 'kvabpf8', prueba: 'Autonomía operativa breve — Mantener equipo encendido 10 minutos', valorEsperado: 'Permanece encendido con imagen estable, sin calentamiento anormal, reinicio ni caída de brillo', resultado: ['Pasa', 'Falla'] },
        { id: 'kvabpf9', prueba: 'Desconexión controlada de hoja/adaptador durante funcionamiento', valorEsperado: 'Se presenta congelamiento temporal/pérdida de imagen o apagado controlado, sin daño de conectores ni bloqueo permanente', resultado: ['Pasa', 'Falla'] },
        { id: 'kvabpf10', prueba: 'Reconexión correcta y nuevo encendido posterior a desconexión', valorEsperado: 'Equipo recupera imagen normal tras apagar, reconectar adecuadamente y encender de nuevo', resultado: ['Pasa', 'Falla'] },
        { id: 'kvabpf11', prueba: 'Salida de video externa, si el equipo cuenta con cable de video opcional', valorEsperado: 'Imagen se visualiza en monitor externo compatible sin pérdida, interferencia o falso contacto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'kvabpf12', prueba: 'Validación de hoja acanalada con tubo endotraqueal de prueba compatible, si aplica', valorEsperado: 'El tubo avanza por el canal sin obstrucción, atrapamiento, rebaba ni deformación de la hoja', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'kvabpf13', prueba: 'Limpieza/desinfección de pantalla y adaptador después de prueba', valorEsperado: 'Superficies limpias y secas; sin líquido en conexiones, compartimiento de baterías o cámara', resultado: ['Pasa', 'Falla'] },
        { id: 'kvabpf14', prueba: 'Verificación final posterior a limpieza', valorEsperado: 'Enciende nuevamente y mantiene imagen funcional, confirmando que la limpieza no afectó conectores ni cámara', resultado: ['Pasa', 'Falla'] },
        { id: 'kvabpf15', prueba: 'Almacenamiento seguro', valorEsperado: 'Equipo queda apagado, seco, protegido en estuche/ubicación asignada y sin hoja usada conectada', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de pantalla reutilizable, carcasa, botón de encendido y superficies de agarre',
        'Limpieza/desinfección del adaptador de video reutilizable y ventana óptica sin inmersión',
        'Verificación de compartimiento de baterías, contactos eléctricos y polaridad de baterías AAA',
        'Cambio preventivo o correctivo de baterías AAA cuando se evidencie bajo nivel, corrosión o vencimiento',
        'Verificación de acople pantalla-adaptador-hoja y bloqueo mecánico',
        'Verificación de encendido, imagen en tiempo real, enfoque, iluminación LED y estabilidad de video',
        'Verificación de salida de video externa, si aplica',
        'Retiro y disposición de hoja aBlade usada o no conforme según protocolo institucional',
        'Limpieza del estuche o área de almacenamiento y verificación de protección contra humedad/golpes',
        'Retiro de servicio y solicitud de mantenimiento correctivo cuando se evidencie falla de imagen, iluminación, conectores, batería o contaminación interna'
      ]
    },


    'termohigrometro_biotemp': {
      nombre: 'Termohigrómetro BIOTEMP',
      categoria: 'Biomédico / Metrología ambiental',
      codigo: 'SLV-GAT-BIO-TH-BIOTEMP',
      frecuencia: ['Trimestral', 'Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el termohigrómetro BIOTEMP del área de uso y verifique que no esté siendo utilizado para control ambiental crítico durante la intervención.',
        'Confirme disponibilidad de patrón calibrado de temperatura y humedad, cámara ambiental o punto de comparación controlado, certificado vigente y condiciones ambientales estables.',
        'Identifique el modelo o referencia instalada; los termohigrómetros BIOTEMP tipo pantalla gigante/sensor exterior trabajan típicamente con medición de temperatura en °C/°F, humedad relativa, memoria MAX/MIN y alimentación con pila AAA.',
        'Permita estabilización térmica del instrumento y del patrón durante mínimo 10 a 15 minutos antes de registrar lecturas comparativas.',
        'No exponga el equipo a hornos, microondas, vapor directo, inmersión, condensación, salpicaduras o productos químicos agresivos.',
        'No abra, modifique ni ajuste electrónicamente el sensor durante el mantenimiento preventivo rutinario; si se detecta desviación fuera de tolerancia, gestione calibración externa, ajuste autorizado o reposición.',
        'Retire del servicio el equipo si presenta pantalla ilegible, sonda dañada, cable interrumpido, lectura errática, corrosión por batería, pérdida de memoria MAX/MIN o desviación no aceptable.'
      ],
      inspeccion: [
        { id: 'biotempi1', item: 'Carcasa íntegra, sin fisuras, golpes, deformación, partes sueltas, manchas por humedad ni signos de manipulación no autorizada' },
        { id: 'biotempi2', item: 'Pantalla LCD doble legible, sin segmentos apagados, manchas, parpadeo, humedad interna, rayones críticos ni pérdida de contraste' },
        { id: 'biotempi3', item: 'Botones °C/°F, MAX/MIN, RESET o equivalentes presentes, limpios y con respuesta mecánica adecuada' },
        { id: 'biotempi4', item: 'Compartimiento de batería limpio, seco, con tapa firme y contactos sin corrosión, sulfatación, deformación o residuos de pila' },
        { id: 'biotempi5', item: 'Pila AAA instalada correctamente, sin fuga, óxido, abombamiento, vencimiento o bajo voltaje evidente' },
        { id: 'biotempi6', item: 'Sensor interno de humedad sin obstrucción, polvo excesivo, condensación, adhesivos, pintura o suciedad acumulada' },
        { id: 'biotempi7', item: 'Sonda o sensor exterior, si aplica, con cable aproximado de 200 cm íntegro, sin cortes, aplastamientos, empalmes, falsos contactos ni aislamiento expuesto' },
        { id: 'biotempi8', item: 'Punta del sensor exterior limpia, seca, sin corrosión, golpes, oxidación, humedad retenida ni obstrucción' },
        { id: 'biotempi9', item: 'Soporte, base, imán, gancho o sistema de instalación firme, sin riesgo de caída o desprendimiento' },
        { id: 'biotempi10', item: 'Etiquetas de identificación institucional, activo fijo, número de serie o referencia y fecha de mantenimiento legibles y coincidentes con inventario' },
        { id: 'biotempi11', item: 'Ubicación de uso protegida de radiación solar directa, corrientes de aire extremas, fuentes de calor, humedad directa o superficies calientes' },
        { id: 'biotempi12', item: 'Limpieza externa realizada con paño suave ligeramente humedecido, sin aplicar líquido directamente sobre pantalla, botones o sensor' }
      ],
      verificacionBasica: [
        { id: 'biotempvb1', item: 'El equipo enciende o muestra lectura estable después de instalar la pila, sin reinicios, apagados intermitentes ni símbolos erráticos' },
        { id: 'biotempvb2', item: 'La unidad de temperatura cambia correctamente entre °C y °F al accionar el botón correspondiente' },
        { id: 'biotempvb3', item: 'La pantalla visualiza temperatura interna/externa, según configuración del modelo, y humedad relativa interna en el rango operativo' },
        { id: 'biotempvb4', item: 'La función MAX/MIN registra y muestra valores máximos y mínimos de temperatura y humedad desde el último reinicio' },
        { id: 'biotempvb5', item: 'La función RESET o borrado de memoria MAX/MIN opera correctamente cuando está disponible' },
        { id: 'biotempvb6', item: 'La lectura de temperatura se estabiliza después del periodo de aclimatación y no presenta saltos bruscos sin cambio ambiental real' },
        { id: 'biotempvb7', item: 'La lectura de humedad relativa se estabiliza y responde gradualmente ante cambios ambientales controlados' },
        { id: 'biotempvb8', item: 'El sensor exterior, si aplica, permite alternar o visualizar INT/EXT sin pérdida de lectura ni desconexión intermitente' },
        { id: 'biotempvb9', item: 'La alerta de helada, si aplica al modelo, se visualiza de acuerdo con la condición de temperatura establecida por el fabricante' },
        { id: 'biotempvb10', item: 'El equipo queda instalado nuevamente en ubicación segura, visible y con lectura coherente para el área de control ambiental' }
      ],
      pruebasFuncionales: [
        { id: 'biotemppf1', prueba: 'Verificación de encendido y visualización general', valorEsperado: 'Pantalla completa, caracteres legibles, sin segmentos ausentes ni mensajes erráticos', resultado: ['Pasa', 'Falla'] },
        { id: 'biotemppf2', prueba: 'Cambio de unidad de temperatura °C/°F', valorEsperado: 'El equipo alterna correctamente entre °C y °F y conserva lectura coherente', resultado: ['Pasa', 'Falla'] },
        { id: 'biotemppf3', prueba: 'Comparación de temperatura a punto ambiente con patrón calibrado', valorEsperado: 'Diferencia ≤ ±1 °C o dentro de tolerancia institucional/metrológica definida', resultado: ['Pasa', 'Falla'] },
        { id: 'biotemppf4', prueba: 'Comparación de humedad relativa a punto ambiente con patrón calibrado', valorEsperado: 'Diferencia ≤ ±5 %HR para referencia 91000-027/B o ≤ ±3 %HR para referencia 91000-006/B, según modelo; aplicar tolerancia institucional si es más estricta', resultado: ['Pasa', 'Falla'] },
        { id: 'biotemppf7', prueba: 'Función MAX/MIN: generación de cambio controlado y revisión de memoria', valorEsperado: 'El equipo almacena y muestra correctamente valores máximo y mínimo; permite reinicio de memoria si aplica', resultado: ['Pasa', 'Falla'] },
        { id: 'biotemppf8', prueba: 'Verificación de sensor exterior INT/EXT, si aplica', valorEsperado: 'El sensor externo responde y muestra temperatura externa sin desconexiones, lectura fija o error', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'biotemppf9', prueba: 'Prueba de cable de sensor exterior por movimiento suave, si aplica', valorEsperado: 'No se pierde lectura ni aparecen saltos, símbolos de error o falso contacto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'biotemppf10', prueba: 'Verificación de rango de humedad operativo', valorEsperado: 'Lectura disponible dentro del rango 20–99 %HR sin bloqueo o saturación injustificada', resultado: ['Pasa', 'Falla'] },
        { id: 'biotemppf11', prueba: 'Verificación de rango de temperatura operativo', valorEsperado: 'Lectura disponible dentro del rango del equipo; modelos BIOTEMP consultados especifican -50 a +70 °C con sonda/sensor exterior', resultado: ['Pasa', 'Falla'] },
        { id: 'biotemppf12', prueba: 'Verificación de alimentación con pila AAA', valorEsperado: 'Equipo permanece encendido y estable; se reemplaza pila si hay bajo contraste, reinicio o lectura intermitente', resultado: ['Pasa', 'Falla'] },
        { id: 'biotemppf13', prueba: 'Revisión de alerta de helada, si aplica al modelo', valorEsperado: 'La indicación/alarma se visualiza conforme a la función del fabricante o se declara N/A si el modelo no la incluye', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'biotemppf14', prueba: 'Registro de resultados metrológicos', valorEsperado: 'Se documentan patrón utilizado, certificado, punto de comparación, lectura patrón, lectura equipo, error y decisión de conformidad', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio', 'Requiere calibración externa', 'Requiere cambio de batería', 'Requiere reposición'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, pantalla, botones y soporte con paño suave, sin inmersión ni aplicación directa de líquidos',
        'Cambio de pila AAA y limpieza de contactos del compartimiento cuando aplica',
        'Verificación de pantalla LCD, botones °C/°F, MAX/MIN y RESET',
        'Verificación de sensor interno de humedad y sonda/sensor exterior, si aplica',
        'Comparación de temperatura contra patrón calibrado',
        'Comparación de humedad relativa contra patrón calibrado',
        'Reinicio de memoria MAX/MIN posterior a la verificación, si el servicio lo requiere',
        'Reubicación del equipo en punto protegido de calor, luz solar directa, condensación y corrientes extremas',
        'Identificación y rotulado de equipo no conforme cuando supera tolerancia o presenta lectura inestable',
        'Solicitud de calibración externa, ajuste autorizado o reposición cuando el error excede tolerancia institucional'
      ]
    },

    'monitor_mindray_umec10': {
      nombre: 'Monitor de Signos Vitales Mindray uMEC 10',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-UMEC10',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el monitor del uso clínico y confirme que no se encuentre conectado a ningún paciente antes de iniciar el mantenimiento preventivo.',
        'Realice limpieza y desinfección externa previa según protocolo institucional, evitando ingreso de líquidos en conectores, ranuras, altavoz, registrador o fuente de alimentación.',
        'Verifique disponibilidad de simulador multiparámetro calibrado tipo Fluke ProSim 8 o equivalente para ECG, RESP, SpO2, NIBP y temperatura.',
        'Utilice accesorios compatibles con Mindray uMEC 10: cable ECG 3/5 derivaciones, sensor SpO2, brazalete NIBP, manguera, sonda de temperatura y cable de alimentación con puesta a tierra.',
        'Conecte el monitor a red eléctrica hospitalaria estable y permita que complete la autoprueba de encendido antes de ejecutar las pruebas funcionales.',
        'No abra la carcasa ni intervenga fuente, batería, tarjetas, módulos internos, transductores o software de servicio durante el mantenimiento preventivo rutinario.',
        'La calibración interna, reparación electrónica, actualización de software o ajuste de módulos debe ser realizada por personal autorizado o servicio técnico especializado.',
        'No utilice cables ECG resistentes a electrobisturí para la verificación de respiración por impedancia, ya que pueden afectar la medición de RESP.',
        'Si se detectan fallas de alarmas, desviación de parámetros, fuga neumática, batería defectuosa, daño de accesorios o mensajes de error persistentes, retire el equipo de servicio y genere mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'umec10i1', item: 'Carcasa, biseles, cubierta posterior y asa de transporte sin fisuras, golpes, deformaciones, partes sueltas ni signos de impacto' },
        { id: 'umec10i2', item: 'Pantalla LCD de 10 pulgadas aproximadas con imagen uniforme, sin manchas, líneas, parpadeo, pixeles defectuosos ni daño superficial' },
        { id: 'umec10i3', item: 'Teclado frontal, botones de alarma, NIBP, menú y encendido con respuesta mecánica adecuada, sin bloqueo ni desgaste excesivo' },
        { id: 'umec10i4', item: 'Perilla selectora o mando de navegación con giro uniforme, pulsación funcional y selección estable en pantalla' },
        { id: 'umec10i5', item: 'Conector ECG y cable troncal de 3/5 derivaciones íntegros, sin pines doblados, sulfatación, cortes, peladuras ni falsos contactos' },
        { id: 'umec10i6', item: 'Electrodos, broches o pinzas ECG limpios, firmes y sin corrosión; accesorios vencidos o deteriorados retirados del servicio' },
        { id: 'umec10i7', item: 'Sensor SpO2, extensión y conector con ventana óptica limpia, pinza funcional, cable sin peladuras y lectura estable al conectar' },
        { id: 'umec10i8', item: 'Brazalete NIBP, manguera y acoples neumáticos sin fisuras, fugas, rigidez, obstrucción, desgaste del velcro ni conectores flojos' },
        { id: 'umec10i9', item: 'Canal o sonda de temperatura disponible, limpia, con aislamiento íntegro y conector firme, si aplica al equipo instalado' },
        { id: 'umec10i10', item: 'Puertos opcionales de red, USB, salida auxiliar, CO2, IBP o central de monitoreo limpios, sin pines deformados ni daño físico, si aplica' },
        { id: 'umec10i11', item: 'Cable de alimentación, clavija, fusible accesible y puesta a tierra sin cortes, empalmes, calentamiento, corrosión ni aislamiento expuesto' },
        { id: 'umec10i12', item: 'Batería interna sin deformación, fuga, sulfatación, sobrecalentamiento ni mensaje persistente de falla o baja capacidad' },
        { id: 'umec10i13', item: 'Altavoz, indicadores luminosos y señalización de alarma visibles y audibles sin obstrucciones ni suciedad acumulada' },
        { id: 'umec10i14', item: 'Registrador térmico, tapa, rodillo y papel correctamente instalados y sin residuos de papel, si aplica al equipo' },
        { id: 'umec10i15', item: 'Soporte mural, brazo, base rodante, ruedas y frenos estables y seguros, si el equipo se encuentra instalado en soporte móvil' },
        { id: 'umec10i16', item: 'Etiqueta de activo fijo, número de serie, placa institucional, advertencias y fecha de mantenimiento legibles y coincidentes con inventario' }
      ],
      verificacionBasica: [
        { id: 'umec10vb1', item: 'Encendido con alimentación AC correcto; el monitor muestra logo Mindray y completa la autoverificación sin errores persistentes' },
        { id: 'umec10vb2', item: 'Pantalla principal visualiza parámetros configurados: ECG, FC, RESP, SpO2, NIBP, temperatura y batería según módulos instalados' },
        { id: 'umec10vb3', item: 'El equipo conmuta a batería al desconectar AC sin apagarse, reiniciarse ni perder configuración de monitoreo' },
        { id: 'umec10vb4', item: 'Indicador de alimentación, carga de batería y estado de batería se visualiza correctamente en pantalla' },
        { id: 'umec10vb5', item: 'Teclas de acceso rápido, menú, perilla y controles permiten navegación por configuración de alarmas, tendencias, NIBP y revisión' },
        { id: 'umec10vb6', item: 'Fecha, hora, idioma, categoría de paciente, unidades, volumen de alarma y límites básicos verificados según lineamiento institucional' },
        { id: 'umec10vb7', item: 'Alarmas fisiológicas y técnicas generan señal audible, visual y mensaje en pantalla a volumen perceptible' },
        { id: 'umec10vb8', item: 'Función de silencio o pausa de alarma opera y retorna al estado normal según el tiempo configurado' },
        { id: 'umec10vb9', item: 'Desconexión de ECG, SpO2 o NIBP genera mensaje técnico en pantalla en máximo 10 segundos' },
        { id: 'umec10vb10', item: 'Tendencias, eventos y revisión histórica abren correctamente y muestran registros coherentes con las mediciones realizadas' },
        { id: 'umec10vb11', item: 'Registrador térmico imprime tira de prueba con trazo y datos legibles, si aplica al equipo instalado' },
        { id: 'umec10vb12', item: 'Comunicación con central de monitoreo, red hospitalaria o sistema de información verificada, si aplica al servicio' }
      ],
      pruebasFuncionales: [
        { id: 'umec10pf1', prueba: 'ECG: ritmo sinusal normal en derivación II con simulador multiparámetro a 60 BPM', valorEsperado: 'Frecuencia cardiaca 60 BPM ± 1 BPM y trazo estable sin artefactos', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf2', prueba: 'ECG: ritmo sinusal normal con simulador a 80 BPM', valorEsperado: 'Frecuencia cardiaca 80 BPM ± 1 BPM y QRS visible sin pérdida de señal', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf3', prueba: 'ECG: amplitud de señal 1 mV en derivación II', valorEsperado: 'Visualización 1 mV ± 5% o calibración gráfica equivalente según pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf4', prueba: 'ECG: alarma de frecuencia cardiaca alta configurando límite 100 lpm y simulando 120 lpm', valorEsperado: 'Alarma alta de FC audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf5', prueba: 'ECG: alarma de frecuencia cardiaca baja configurando límite 50 lpm y simulando 40 lpm', valorEsperado: 'Alarma baja de FC audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf6', prueba: 'ECG: desconexión de derivación durante monitoreo activo', valorEsperado: 'Mensaje de derivación desconectada o alarma técnica en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf7', prueba: 'RESP: frecuencia respiratoria por impedancia simulada a 20 RPM', valorEsperado: 'Lectura 20 RPM ± 1 RPM y onda respiratoria estable', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf8', prueba: 'RESP: alarma de apnea o límite bajo mediante simulación sin respiración', valorEsperado: 'Alarma de apnea o RESP baja activa según configuración institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'umec10pf9', prueba: 'SpO2: saturación simulada al 98% con perfusión normal', valorEsperado: 'Lectura 98% ± 2% y pulso estable', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf10', prueba: 'SpO2: saturación simulada al 90%', valorEsperado: 'Lectura 90% ± 2%', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf11', prueba: 'SpO2: frecuencia de pulso simulada a 80 lpm', valorEsperado: 'Pulso 80 lpm ± 2 lpm', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf12', prueba: 'SpO2: alarma de desaturación con límite inferior 92% y simulación a 88%', valorEsperado: 'Alarma audible y visual de SpO2 baja activa', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf13', prueba: 'NIBP: presión sistólica simulada 120 mmHg', valorEsperado: 'Lectura sistólica 120 mmHg ± 3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf14', prueba: 'NIBP: presión diastólica simulada 80 mmHg', valorEsperado: 'Lectura diastólica 80 mmHg ± 3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf15', prueba: 'NIBP: presión media MAP en simulación 120/80 mmHg', valorEsperado: 'MAP aproximada 93 mmHg ± 3 mmHg', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf16', prueba: 'NIBP: prueba de fuga neumática del brazalete y manguera a 200 mmHg durante 30 segundos', valorEsperado: 'Caída de presión ≤ 6 mmHg en 30 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf17', prueba: 'NIBP: ciclo automático de medición desde tecla Start/Stop', valorEsperado: 'Infla, mide, desinfla y muestra resultado sin error de bomba, fuga u obstrucción', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf18', prueba: 'Temperatura: simulación canal T1 a 37.0 °C', valorEsperado: 'Lectura 37.0 °C ± 0.1 °C o tolerancia del simulador utilizado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'umec10pf19', prueba: 'Temperatura: simulación canal T1 a 38.5 °C', valorEsperado: 'Lectura 38.5 °C ± 0.1 °C o tolerancia del simulador utilizado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'umec10pf20', prueba: 'Batería: desconectar AC y operar en batería durante prueba breve de 10 minutos', valorEsperado: 'Mantiene monitoreo continuo sin reinicio, apagado inesperado ni alarma crítica inmediata', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf21', prueba: 'Registrador térmico: impresión de curva ECG y datos numéricos, si aplica', valorEsperado: 'Impresión legible, avance normal de papel y fecha/hora coherentes', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'umec10pf22', prueba: 'Tendencias y eventos: guardar o revisar mediciones realizadas durante la prueba', valorEsperado: 'Registros accesibles, sin error de memoria y coherentes con las mediciones', resultado: ['Pasa', 'Falla'] },
        { id: 'umec10pf23', prueba: 'Conectividad: verificación de enlace con central de monitoreo o red hospitalaria, si aplica', valorEsperado: 'Equipo visible o comunicando correctamente con identificación del paciente/equipo según configuración', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, pantalla, teclado, perilla y panel de control',
        'Limpieza y revisión de cables ECG, sensor SpO2, brazalete NIBP, manguera y sonda de temperatura',
        'Verificación de encendido, autoprueba, configuración básica y operación con red eléctrica',
        'Verificación de funcionamiento en modo batería y estado de carga',
        'Verificación funcional con simulador multiparámetro calibrado',
        'Prueba de ECG, RESP, SpO2, NIBP y temperatura según configuración instalada',
        'Verificación de alarmas fisiológicas, alarmas técnicas y función de silencio/pausa',
        'Verificación de tendencias, eventos, registrador térmico y conectividad, si aplica',
        'Cambio o retiro de accesorios deteriorados, vencidos o no conformes',
        'Recomendación de mantenimiento correctivo, calibración especializada o retiro de servicio cuando aplique'
      ]
    },

    'monitor_mindray_umec12': {
      nombre: 'Monitor de Signos Vitales Mindray uMEC 12',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-UMEC12',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el monitor del uso clínico y confirme que no se encuentre conectado a ningún paciente antes de iniciar el mantenimiento preventivo.',
        'Realice limpieza y desinfección externa previa según protocolo institucional, evitando ingreso de líquidos en conectores, ranuras, altavoz, registrador o fuente de alimentación.',
        'Verifique disponibilidad de simulador multiparámetro calibrado tipo Fluke ProSim 8 o equivalente para ECG, RESP, SpO2, NIBP y temperatura.',
        'Utilice accesorios compatibles con Mindray uMEC 12: cable ECG 3/5 derivaciones, sensor SpO2, brazalete NIBP, manguera, sonda de temperatura y cable de alimentación con puesta a tierra.',
        'Conecte el monitor a red eléctrica hospitalaria estable y permita que complete la autoprueba de encendido antes de ejecutar las pruebas funcionales.',
        'No abra la carcasa ni intervenga fuente, batería, tarjetas, módulos internos, transductores o software de servicio durante el mantenimiento preventivo rutinario.',
        'La calibración interna, reparación electrónica, actualización de software o ajuste de módulos debe ser realizada por personal autorizado o servicio técnico especializado.',
        'No utilice cables ECG resistentes a electrobisturí para la verificación de respiración por impedancia, ya que pueden afectar la medición de RESP.',
        'Si se detectan fallas de alarmas, desviación de parámetros, fuga neumática, batería defectuosa, daño de accesorios o mensajes de error persistentes, retire el equipo de servicio y genere mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'umec12i1', item: 'Carcasa, biseles, cubierta posterior y asa de transporte sin fisuras, golpes, deformaciones, partes sueltas ni signos de impacto' },
        { id: 'umec12i2', item: 'Pantalla LCD de 12 pulgadas aproximadas con imagen uniforme, sin manchas, líneas, parpadeo, pixeles defectuosos ni daño superficial' },
        { id: 'umec12i3', item: 'Teclado frontal, botones de alarma, NIBP, menú y encendido con respuesta mecánica adecuada, sin bloqueo ni desgaste excesivo' },
        { id: 'umec12i4', item: 'Perilla selectora o mando de navegación con giro uniforme, pulsación funcional y selección estable en pantalla' },
        { id: 'umec12i5', item: 'Conector ECG y cable troncal de 3/5 derivaciones íntegros, sin pines doblados, sulfatación, cortes, peladuras ni falsos contactos' },
        { id: 'umec12i6', item: 'Electrodos, broches o pinzas ECG limpios, firmes y sin corrosión; accesorios vencidos o deteriorados retirados del servicio' },
        { id: 'umec12i7', item: 'Sensor SpO2, extensión y conector con ventana óptica limpia, pinza funcional, cable sin peladuras y lectura estable al conectar' },
        { id: 'umec12i8', item: 'Brazalete NIBP, manguera y acoples neumáticos sin fisuras, fugas, rigidez, obstrucción, desgaste del velcro ni conectores flojos' },
        { id: 'umec12i9', item: 'Canal o sonda de temperatura disponible, limpia, con aislamiento íntegro y conector firme, si aplica al equipo instalado' },
        { id: 'umec12i10', item: 'Puertos opcionales de red, USB, salida auxiliar, CO2, IBP o central de monitoreo limpios, sin pines deformados ni daño físico, si aplica' },
        { id: 'umec12i11', item: 'Cable de alimentación, clavija, fusible accesible y puesta a tierra sin cortes, empalmes, calentamiento, corrosión ni aislamiento expuesto' },
        { id: 'umec12i12', item: 'Batería interna sin deformación, fuga, sulfatación, sobrecalentamiento ni mensaje persistente de falla o baja capacidad' },
        { id: 'umec12i13', item: 'Altavoz, indicadores luminosos y señalización de alarma visibles y audibles sin obstrucciones ni suciedad acumulada' },
        { id: 'umec12i14', item: 'Registrador térmico, tapa, rodillo y papel correctamente instalados y sin residuos de papel, si aplica al equipo' },
        { id: 'umec12i15', item: 'Soporte mural, brazo, base rodante, ruedas y frenos estables y seguros, si el equipo se encuentra instalado en soporte móvil' },
        { id: 'umec12i16', item: 'Etiqueta de activo fijo, número de serie, placa institucional, advertencias y fecha de mantenimiento legibles y coincidentes con inventario' }
      ],
      verificacionBasica: [
        { id: 'umec12vb1', item: 'Encendido con alimentación AC correcto; el monitor muestra logo Mindray y completa la autoverificación sin errores persistentes' },
        { id: 'umec12vb2', item: 'Pantalla principal visualiza parámetros configurados: ECG, FC, RESP, SpO2, NIBP, temperatura y batería según módulos instalados' },
        { id: 'umec12vb3', item: 'El equipo conmuta a batería al desconectar AC sin apagarse, reiniciarse ni perder configuración de monitoreo' },
        { id: 'umec12vb4', item: 'Indicador de alimentación, carga de batería y estado de batería se visualiza correctamente en pantalla' },
        { id: 'umec12vb5', item: 'Teclas de acceso rápido, menú, perilla y controles permiten navegación por configuración de alarmas, tendencias, NIBP y revisión' },
        { id: 'umec12vb6', item: 'Fecha, hora, idioma, categoría de paciente, unidades, volumen de alarma y límites básicos verificados según lineamiento institucional' },
        { id: 'umec12vb7', item: 'Alarmas fisiológicas y técnicas generan señal audible, visual y mensaje en pantalla a volumen perceptible' },
        { id: 'umec12vb8', item: 'Función de silencio o pausa de alarma opera y retorna al estado normal según el tiempo configurado' },
        { id: 'umec12vb9', item: 'Desconexión de ECG, SpO2 o NIBP genera mensaje técnico en pantalla en máximo 10 segundos' },
        { id: 'umec12vb10', item: 'Tendencias, eventos y revisión histórica abren correctamente y muestran registros coherentes con las mediciones realizadas' },
        { id: 'umec12vb11', item: 'Registrador térmico imprime tira de prueba con trazo y datos legibles, si aplica al equipo instalado' },
        { id: 'umec12vb12', item: 'Comunicación con central de monitoreo, red hospitalaria o sistema de información verificada, si aplica al servicio' }
      ],
      pruebasFuncionales: [
        { id: 'umec12pf1', prueba: 'ECG: ritmo sinusal normal en derivación II con simulador multiparámetro a 60 BPM', valorEsperado: 'Frecuencia cardiaca 60 BPM ± 1 BPM y trazo estable sin artefactos', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf2', prueba: 'ECG: ritmo sinusal normal con simulador a 80 BPM', valorEsperado: 'Frecuencia cardiaca 80 BPM ± 1 BPM y QRS visible sin pérdida de señal', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf3', prueba: 'ECG: amplitud de señal 1 mV en derivación II', valorEsperado: 'Visualización 1 mV ± 5% o calibración gráfica equivalente según pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf4', prueba: 'ECG: alarma de frecuencia cardiaca alta configurando límite 100 lpm y simulando 120 lpm', valorEsperado: 'Alarma alta de FC audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf5', prueba: 'ECG: alarma de frecuencia cardiaca baja configurando límite 50 lpm y simulando 40 lpm', valorEsperado: 'Alarma baja de FC audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf6', prueba: 'ECG: desconexión de derivación durante monitoreo activo', valorEsperado: 'Mensaje de derivación desconectada o alarma técnica en ≤ 10 s', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf7', prueba: 'RESP: frecuencia respiratoria por impedancia simulada a 20 RPM', valorEsperado: 'Lectura 20 RPM ± 1 RPM y onda respiratoria estable', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf8', prueba: 'RESP: alarma de apnea o límite bajo mediante simulación sin respiración', valorEsperado: 'Alarma de apnea o RESP baja activa según configuración institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'umec12pf9', prueba: 'SpO2: saturación simulada al 98% con perfusión normal', valorEsperado: 'Lectura 98% ± 2% y pulso estable', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf10', prueba: 'SpO2: saturación simulada al 90%', valorEsperado: 'Lectura 90% ± 2%', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf11', prueba: 'SpO2: frecuencia de pulso simulada a 80 lpm', valorEsperado: 'Pulso 80 lpm ± 2 lpm', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf12', prueba: 'SpO2: alarma de desaturación con límite inferior 92% y simulación a 88%', valorEsperado: 'Alarma audible y visual de SpO2 baja activa', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf13', prueba: 'NIBP: presión sistólica simulada 120 mmHg', valorEsperado: 'Lectura sistólica 120 mmHg ± 3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf14', prueba: 'NIBP: presión diastólica simulada 80 mmHg', valorEsperado: 'Lectura diastólica 80 mmHg ± 3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf15', prueba: 'NIBP: presión media MAP en simulación 120/80 mmHg', valorEsperado: 'MAP aproximada 93 mmHg ± 3 mmHg', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf16', prueba: 'NIBP: prueba de fuga neumática del brazalete y manguera a 200 mmHg durante 30 segundos', valorEsperado: 'Caída de presión ≤ 6 mmHg en 30 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf17', prueba: 'NIBP: ciclo automático de medición desde tecla Start/Stop', valorEsperado: 'Infla, mide, desinfla y muestra resultado sin error de bomba, fuga u obstrucción', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf18', prueba: 'Temperatura: simulación canal T1 a 37.0 °C', valorEsperado: 'Lectura 37.0 °C ± 0.1 °C o tolerancia del simulador utilizado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'umec12pf19', prueba: 'Temperatura: simulación canal T1 a 38.5 °C', valorEsperado: 'Lectura 38.5 °C ± 0.1 °C o tolerancia del simulador utilizado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'umec12pf20', prueba: 'Batería: desconectar AC y operar en batería durante prueba breve de 10 minutos', valorEsperado: 'Mantiene monitoreo continuo sin reinicio, apagado inesperado ni alarma crítica inmediata', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf21', prueba: 'Registrador térmico: impresión de curva ECG y datos numéricos, si aplica', valorEsperado: 'Impresión legible, avance normal de papel y fecha/hora coherentes', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'umec12pf22', prueba: 'Tendencias y eventos: guardar o revisar mediciones realizadas durante la prueba', valorEsperado: 'Registros accesibles, sin error de memoria y coherentes con las mediciones', resultado: ['Pasa', 'Falla'] },
        { id: 'umec12pf23', prueba: 'Conectividad: verificación de enlace con central de monitoreo o red hospitalaria, si aplica', valorEsperado: 'Equipo visible o comunicando correctamente con identificación del paciente/equipo según configuración', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, pantalla, teclado, perilla y panel de control',
        'Limpieza y revisión de cables ECG, sensor SpO2, brazalete NIBP, manguera y sonda de temperatura',
        'Verificación de encendido, autoprueba, configuración básica y operación con red eléctrica',
        'Verificación de funcionamiento en modo batería y estado de carga',
        'Verificación funcional con simulador multiparámetro calibrado',
        'Prueba de ECG, RESP, SpO2, NIBP y temperatura según configuración instalada',
        'Verificación de alarmas fisiológicas, alarmas técnicas y función de silencio/pausa',
        'Verificación de tendencias, eventos, registrador térmico y conectividad, si aplica',
        'Cambio o retiro de accesorios deteriorados, vencidos o no conformes',
        'Recomendación de mantenimiento correctivo, calibración especializada o retiro de servicio cuando aplique'
      ]
    },

    'monitor_mindray_imec12': {
      nombre: 'Monitor de Signos Vitales Mindray iMEC 12',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-IMEC12',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el monitor se encuentre fuera de uso clínico, limpio y desconectado del paciente antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de simulador multiparámetro calibrado tipo Fluke ProSim 8 o equivalente para ECG, RESP, SpO2, NIBP y temperatura.',
        'Utilice únicamente accesorios compatibles Mindray o equivalentes certificados: cable ECG, sensor SpO2, brazalete NIBP, manguera, sonda de temperatura y cable de poder.',
        'Antes de realizar pruebas funcionales, conecte el monitor a red eléctrica y permita la inicialización completa sin manipular parámetros internos de servicio.',
        'No abra la carcasa, fuente, batería, tarjetas electrónicas ni módulos internos durante el mantenimiento preventivo rutinario.',
        'La calibración interna, reparación de módulos, actualización de software o intervención sobre tarjetas debe ser realizada por personal autorizado o servicio técnico especializado.',
        'No utilice cables ECG resistentes a electrobisturí para medición de respiración por impedancia cuando se realicen pruebas de RESP.',
        'Si se presentan errores persistentes, falla de alarmas, desviación de parámetros, batería defectuosa o accesorios dañados, retire el equipo de servicio y genere mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'imec12i1', item: 'Carcasa frontal, posterior, asa de transporte y cubiertas laterales íntegras, sin grietas, golpes, deformaciones ni partes sueltas' },
        { id: 'imec12i2', item: 'Pantalla de 12 pulgadas aproximadas: imagen clara, sin manchas, líneas, pixeles defectuosos, parpadeo ni daño físico visible' },
        { id: 'imec12i3', item: 'Panel táctil y teclas rápidas de silencio/pausa de alarma, inicio NIBP, tendencias y menú responden correctamente' },
        { id: 'imec12i4', item: 'Perilla de navegación o selector rotatorio con giro uniforme, selección estable y sin bloqueo mecánico' },
        { id: 'imec12i5', item: 'Conector ECG y cable troncal de 3/5 derivaciones íntegros, sin cortes, pines doblados, sulfatación ni falsos contactos' },
        { id: 'imec12i6', item: 'Sensor SpO2 y extensión: ventana óptica limpia, cable sin pelado, conector firme y pinza funcional' },
        { id: 'imec12i7', item: 'Brazalete NIBP, manguera y conector neumático sin fisuras, fugas, rigidez excesiva ni acoples flojos' },
        { id: 'imec12i8', item: 'Sonda/canal de temperatura disponible, limpio y con conector firme, si aplica al equipo instalado' },
        { id: 'imec12i9', item: 'Puertos opcionales IBP, CO2, red, USB, registrador o central de monitoreo sin daño, suciedad ni pines deformados, si aplica' },
        { id: 'imec12i10', item: 'Cable de alimentación AC, clavija, tierra física y sujetacable sin cortes, empalmes, calentamiento, corrosión ni aislante expuesto' },
        { id: 'imec12i11', item: 'Batería interna o removible sin deformación, fuga, sobrecalentamiento, sulfatación ni mensajes de falla de batería' },
        { id: 'imec12i12', item: 'Registrador térmico, tapa, rodillo y papel disponibles y funcionales, si aplica al equipo instalado' },
        { id: 'imec12i13', item: 'Soporte mural, base rodante o brazo de montaje estable; ruedas y frenos operativos si el monitor se encuentra en carro' },
        { id: 'imec12i14', item: 'Etiquetas de activo fijo, número de serie, advertencias, fecha de mantenimiento y placa institucional legibles y coincidentes con inventario' },
        { id: 'imec12i15', item: 'Limpieza externa realizada con paño suave y desinfectante compatible, sin ingreso de líquido en conectores, teclado, pantalla o ranuras' }
      ],
      verificacionBasica: [
        { id: 'imec12vb1', item: 'Enciende correctamente con alimentación AC, muestra logo Mindray y completa autoverificación inicial sin errores persistentes' },
        { id: 'imec12vb2', item: 'Pantalla principal muestra parámetros configurados: ECG, frecuencia cardiaca, SpO2, NIBP, RESP, temperatura y batería según configuración instalada' },
        { id: 'imec12vb3', item: 'El monitor cambia a modo batería al desconectar AC sin apagarse ni reiniciarse' },
        { id: 'imec12vb4', item: 'Indicador de carga de batería y conexión AC se visualiza correctamente; no aparece alarma inmediata de batería crítica' },
        { id: 'imec12vb5', item: 'Teclas rápidas, pantalla táctil y perilla permiten navegar menús de alarmas, tendencias, revisión, configuración y NIBP' },
        { id: 'imec12vb6', item: 'Fecha, hora, idioma, unidades de presión, categoría de paciente y volumen de alarma verificados y coherentes con uso institucional' },
        { id: 'imec12vb7', item: 'Alarmas audibles, visuales y mensajes técnicos se activan y son perceptibles a volumen medio' },
        { id: 'imec12vb8', item: 'Función de silencio/pausa de alarma opera correctamente y retorna al estado normal según tiempo configurado' },
        { id: 'imec12vb9', item: 'Desconexión de ECG, SpO2 o NIBP genera mensaje técnico visible en pantalla en máximo 10 segundos' },
        { id: 'imec12vb10', item: 'Tendencias, almacenamiento de eventos o revisión histórica abren correctamente y muestran registros coherentes' },
        { id: 'imec12vb11', item: 'Conectividad con central de monitoreo o red hospitalaria verificada, si aplica al servicio' },
        { id: 'imec12vb12', item: 'Registrador térmico imprime tira de prueba legible, si aplica al equipo instalado' }
      ],
      pruebasFuncionales: [
        { id: 'imec12pf1', prueba: 'ECG: ritmo sinusal normal con simulador multiparámetro en derivación II a 60 BPM', valorEsperado: 'Frecuencia cardiaca 60 BPM ± 1 BPM y trazo estable sin artefactos', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf2', prueba: 'ECG: ritmo sinusal normal a 80 BPM', valorEsperado: 'Frecuencia cardiaca 80 BPM ± 1 BPM, QRS visible y sin pérdida de señal', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf3', prueba: 'ECG: amplitud de señal 1 mV en derivación II', valorEsperado: 'Amplitud visualizada 1 mV ± 5% o trazo calibrado equivalente', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf4', prueba: 'ECG: detección de arritmia ventricular simulada, si el perfil de alarmas lo permite', valorEsperado: 'Alarma audible/visual de arritmia o evento crítico activo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'imec12pf5', prueba: 'RESP: frecuencia respiratoria por impedancia a 20 RPM', valorEsperado: 'Lectura 20 RPM ± 1 RPM y onda respiratoria estable', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf6', prueba: 'RESP: alarma de apnea o límite bajo mediante simulación sin respiración', valorEsperado: 'Alarma de apnea o RESP baja activa según configuración institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf7', prueba: 'SpO2: saturación 98% con simulador y perfusión normal', valorEsperado: 'Lectura 98% ± 2% y pulso estable', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf8', prueba: 'SpO2: saturación 90% con simulador', valorEsperado: 'Lectura 90% ± 2%', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf9', prueba: 'SpO2: frecuencia de pulso simulada a 80 lpm', valorEsperado: 'Frecuencia de pulso 80 lpm ± 2 lpm', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf10', prueba: 'SpO2: alarma de desaturación configurando límite inferior en 92% y simulando 88%', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf11', prueba: 'NIBP: presión sistólica simulada 120 mmHg', valorEsperado: 'Lectura sistólica 120 mmHg ± 3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf12', prueba: 'NIBP: presión diastólica simulada 80 mmHg', valorEsperado: 'Lectura diastólica 80 mmHg ± 3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf13', prueba: 'NIBP: presión media MAP en simulación 120/80 mmHg', valorEsperado: 'MAP aproximada 93 mmHg ± 3 mmHg', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf14', prueba: 'NIBP: prueba de fuga neumática del brazalete y manguera a 200 mmHg durante 30 segundos', valorEsperado: 'Caída de presión ≤ 6 mmHg en 30 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf15', prueba: 'NIBP: ciclo automático de medición desde tecla Start/Stop', valorEsperado: 'Infla, mide, desinfla y muestra resultado sin error de bomba, fuga o sobrepresión', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf16', prueba: 'Temperatura: simulación canal T1 a 37.0 °C', valorEsperado: 'Lectura 37.0 °C ± 0.1 °C o tolerancia del simulador utilizado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'imec12pf17', prueba: 'Temperatura: simulación canal T1 a 38.5 °C', valorEsperado: 'Lectura 38.5 °C ± 0.1 °C o tolerancia del simulador utilizado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'imec12pf18', prueba: 'Alarmas de frecuencia cardiaca: límite superior 100 lpm y simulación a 120 lpm', valorEsperado: 'Alarma alta de FC audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf19', prueba: 'Alarmas de frecuencia cardiaca: límite inferior 50 lpm y simulación a 40 lpm', valorEsperado: 'Alarma baja de FC audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf20', prueba: 'Batería: funcionamiento sin AC durante prueba breve de 10 minutos', valorEsperado: 'Mantiene monitoreo continuo sin reinicio, apagado inesperado ni alarma crítica inmediata', resultado: ['Pasa', 'Falla'] },
        { id: 'imec12pf21', prueba: 'Registrador térmico: impresión de curva ECG y datos numéricos, si aplica', valorEsperado: 'Impresión legible, avance normal de papel y fecha/hora coherentes', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'imec12pf22', prueba: 'Revisión de tendencias y eventos de alarma', valorEsperado: 'Acceso a tendencias y eventos; registros guardados se visualizan sin error', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, pantalla y panel de control',
        'Limpieza y revisión de cables ECG, sensor SpO2, brazalete NIBP, manguera y sonda de temperatura',
        'Verificación de encendido, autoprueba y operación con red eléctrica',
        'Verificación de funcionamiento en modo batería',
        'Verificación funcional con simulador multiparámetro',
        'Prueba de ECG, respiración, SpO2, NIBP y temperatura según configuración instalada',
        'Verificación de alarmas fisiológicas y técnicas',
        'Verificación de tendencias, registrador y conectividad, si aplica',
        'Cambio de accesorios deteriorados o consumibles no conformes',
        'Recomendación de mantenimiento correctivo / retiro de servicio'
      ]
    },

    'monitor_mindray_imec8': {
      nombre: 'Monitor de Signos Vitales Mindray iMEC 8',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-IMEC8',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el monitor se encuentre fuera de uso clínico, limpio y desconectado del paciente antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de simulador multiparámetro calibrado tipo Fluke ProSim 8 o equivalente para ECG, RESP, SpO2, NIBP y temperatura.',
        'Utilice únicamente accesorios compatibles Mindray o equivalentes certificados: cable ECG, sensor SpO2, brazalete NIBP, manguera, sonda de temperatura y cable de poder.',
        'Antes de realizar pruebas funcionales, conecte el monitor a red eléctrica y permita la inicialización completa sin manipular parámetros internos de servicio.',
        'No abra la carcasa, fuente, batería, tarjetas electrónicas ni módulos internos durante el mantenimiento preventivo rutinario.',
        'La calibración interna, reparación de módulos, actualización de software o intervención sobre tarjetas debe ser realizada por personal autorizado o servicio técnico especializado.',
        'No utilice cables ECG resistentes a electrobisturí para medición de respiración por impedancia cuando se realicen pruebas de RESP.',
        'Si se presentan errores persistentes, falla de alarmas, desviación de parámetros, batería defectuosa o accesorios dañados, retire el equipo de servicio y genere mantenimiento correctivo.',
        'Protocolo aplicable al modelo iMEC 8 de la familia Mindray iMEC12/iMEC10/iMEC8; ajuste las pruebas según los módulos instalados en el equipo institucional.'
      ],
      inspeccion: [
        { id: 'imec8i1', item: 'Carcasa frontal, posterior, asa de transporte y cubiertas laterales íntegras, sin grietas, golpes, deformaciones ni partes sueltas' },
        { id: 'imec8i2', item: 'Pantalla LCD color de 8.4 pulgadas aproximadas: imagen clara, sin manchas, líneas, pixeles defectuosos, parpadeo ni daño físico visible' },
        { id: 'imec8i3', item: 'Panel frontal, teclas rápidas de silencio/pausa de alarma, inicio NIBP, tendencias y menú responden correctamente' },
        { id: 'imec8i4', item: 'Perilla de navegación o selector rotatorio con giro uniforme, selección estable y sin bloqueo mecánico' },
        { id: 'imec8i5', item: 'Conector ECG y cable troncal de 3/5 derivaciones íntegros, sin cortes, pines doblados, sulfatación ni falsos contactos' },
        { id: 'imec8i6', item: 'Sensor SpO2 y extensión: ventana óptica limpia, cable sin pelado, conector firme y pinza funcional' },
        { id: 'imec8i7', item: 'Brazalete NIBP, manguera y conector neumático sin fisuras, fugas, rigidez excesiva ni acoples flojos' },
        { id: 'imec8i8', item: 'Sonda/canal de temperatura disponible, limpio y con conector firme, si aplica al equipo instalado' },
        { id: 'imec8i9', item: 'Puertos opcionales IBP, CO2, red, USB, registrador, VGA o central de monitoreo sin daño, suciedad ni pines deformados, si aplica' },
        { id: 'imec8i10', item: 'Cable de alimentación AC, clavija, tierra física y sujetacable sin cortes, empalmes, calentamiento, corrosión ni aislante expuesto' },
        { id: 'imec8i11', item: 'Batería interna o removible sin deformación, fuga, sobrecalentamiento, sulfatación ni mensajes de falla de batería' },
        { id: 'imec8i12', item: 'Registrador térmico, tapa, rodillo y papel disponibles y funcionales, si aplica al equipo instalado' },
        { id: 'imec8i13', item: 'Soporte mural, base rodante o brazo de montaje estable; ruedas y frenos operativos si el monitor se encuentra en carro' },
        { id: 'imec8i14', item: 'Etiquetas de activo fijo, número de serie, advertencias, fecha de mantenimiento y placa institucional legibles y coincidentes con inventario' },
        { id: 'imec8i15', item: 'Limpieza externa realizada con paño suave y desinfectante compatible, sin ingreso de líquido en conectores, teclado, pantalla o ranuras' }
      ],
      verificacionBasica: [
        { id: 'imec8vb1', item: 'Enciende correctamente con alimentación AC, muestra logo Mindray y completa autoverificación inicial sin errores persistentes' },
        { id: 'imec8vb2', item: 'Pantalla principal muestra parámetros configurados: ECG, frecuencia cardiaca, SpO2, NIBP, RESP, temperatura y batería según configuración instalada' },
        { id: 'imec8vb3', item: 'El monitor cambia a modo batería al desconectar AC sin apagarse ni reiniciarse' },
        { id: 'imec8vb4', item: 'Indicador de carga de batería y conexión AC se visualiza correctamente; no aparece alarma inmediata de batería crítica' },
        { id: 'imec8vb5', item: 'Teclas rápidas y perilla permiten navegar menús de alarmas, tendencias, revisión, configuración y NIBP' },
        { id: 'imec8vb6', item: 'Fecha, hora, idioma, unidades de presión, categoría de paciente y volumen de alarma verificados y coherentes con uso institucional' },
        { id: 'imec8vb7', item: 'Alarmas audibles, visuales y mensajes técnicos se activan y son perceptibles a volumen medio' },
        { id: 'imec8vb8', item: 'Función de silencio/pausa de alarma opera correctamente y retorna al estado normal según tiempo configurado' },
        { id: 'imec8vb9', item: 'Desconexión de ECG, SpO2 o NIBP genera mensaje técnico visible en pantalla en máximo 10 segundos' },
        { id: 'imec8vb10', item: 'Tendencias, almacenamiento de eventos o revisión histórica abren correctamente y muestran registros coherentes' },
        { id: 'imec8vb11', item: 'Conectividad con central de monitoreo o red hospitalaria verificada, si aplica al servicio' },
        { id: 'imec8vb12', item: 'Registrador térmico imprime tira de prueba legible, si aplica al equipo instalado' }
      ],
      pruebasFuncionales: [
        { id: 'imec8pf1', prueba: 'ECG: ritmo sinusal normal con simulador multiparámetro en derivación II a 60 BPM', valorEsperado: 'Frecuencia cardiaca 60 BPM ± 1 BPM y trazo estable sin artefactos', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf2', prueba: 'ECG: ritmo sinusal normal a 80 BPM', valorEsperado: 'Frecuencia cardiaca 80 BPM ± 1 BPM, QRS visible y sin pérdida de señal', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf3', prueba: 'ECG: amplitud de señal 1 mV en derivación II', valorEsperado: 'Amplitud visualizada 1 mV ± 5% o trazo calibrado equivalente', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf4', prueba: 'ECG: detección de arritmia ventricular simulada, si el perfil de alarmas lo permite', valorEsperado: 'Alarma audible/visual de arritmia o evento crítico activo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'imec8pf5', prueba: 'RESP: frecuencia respiratoria por impedancia a 20 RPM', valorEsperado: 'Lectura 20 RPM ± 1 RPM y onda respiratoria estable', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf6', prueba: 'RESP: alarma de apnea o límite bajo mediante simulación sin respiración', valorEsperado: 'Alarma de apnea o RESP baja activa según configuración institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf7', prueba: 'SpO2: saturación 98% con simulador y perfusión normal', valorEsperado: 'Lectura 98% ± 2% y pulso estable', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf8', prueba: 'SpO2: saturación 90% con simulador', valorEsperado: 'Lectura 90% ± 2%', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf9', prueba: 'SpO2: frecuencia de pulso simulada a 80 lpm', valorEsperado: 'Frecuencia de pulso 80 lpm ± 2 lpm', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf10', prueba: 'SpO2: alarma de desaturación configurando límite inferior en 92% y simulando 88%', valorEsperado: 'Alarma audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf11', prueba: 'NIBP: presión sistólica simulada 120 mmHg', valorEsperado: 'Lectura sistólica 120 mmHg ± 3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf12', prueba: 'NIBP: presión diastólica simulada 80 mmHg', valorEsperado: 'Lectura diastólica 80 mmHg ± 3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf13', prueba: 'NIBP: presión media MAP en simulación 120/80 mmHg', valorEsperado: 'MAP aproximada 93 mmHg ± 3 mmHg', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf14', prueba: 'NIBP: prueba de fuga neumática del brazalete y manguera a 200 mmHg durante 30 segundos', valorEsperado: 'Caída de presión ≤ 6 mmHg en 30 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf15', prueba: 'NIBP: ciclo automático de medición desde tecla Start/Stop', valorEsperado: 'Infla, mide, desinfla y muestra resultado sin error de bomba, fuga o sobrepresión', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf16', prueba: 'Temperatura: simulación canal T1 a 37.0 °C', valorEsperado: 'Lectura 37.0 °C ± 0.1 °C o tolerancia del simulador utilizado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'imec8pf17', prueba: 'Temperatura: simulación canal T1 a 38.5 °C', valorEsperado: 'Lectura 38.5 °C ± 0.1 °C o tolerancia del simulador utilizado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'imec8pf18', prueba: 'Alarmas de frecuencia cardiaca: límite superior 100 lpm y simulación a 120 lpm', valorEsperado: 'Alarma alta de FC audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf19', prueba: 'Alarmas de frecuencia cardiaca: límite inferior 50 lpm y simulación a 40 lpm', valorEsperado: 'Alarma baja de FC audible y visual activa', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf20', prueba: 'Batería: funcionamiento sin AC durante prueba breve de 10 minutos', valorEsperado: 'Mantiene monitoreo continuo sin reinicio, apagado inesperado ni alarma crítica inmediata', resultado: ['Pasa', 'Falla'] },
        { id: 'imec8pf21', prueba: 'Registrador térmico: impresión de curva ECG y datos numéricos, si aplica', valorEsperado: 'Impresión legible, avance normal de papel y fecha/hora coherentes', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'imec8pf22', prueba: 'Revisión de tendencias y eventos de alarma', valorEsperado: 'Acceso a tendencias y eventos; registros guardados se visualizan sin error', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, pantalla, teclas y panel de control',
        'Limpieza y revisión de cables ECG, sensor SpO2, brazalete NIBP, manguera y sonda de temperatura',
        'Verificación de encendido, autoprueba y operación con red eléctrica',
        'Verificación de funcionamiento en modo batería',
        'Verificación funcional con simulador multiparámetro',
        'Prueba de ECG, respiración, SpO2, NIBP y temperatura según configuración instalada',
        'Verificación de alarmas fisiológicas y técnicas',
        'Verificación de tendencias, registrador y conectividad, si aplica',
        'Cambio de accesorios deteriorados o consumibles no conformes',
        'Recomendación de mantenimiento correctivo / retiro de servicio'
      ]
    },

    'laringoscopio_convencional_fibra_optica': {
      nombre: 'Laringoscopio Convencional de Fibra Óptica (Hojas Macintosh / Miller)',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-LR',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo haya sido sometido a proceso de desinfección de alto nivel (DAN) o esterilización según política institucional antes de realizar el mantenimiento preventivo.',
        'Utilice equipo de protección personal (EPP) completo durante todo el procedimiento: guantes de nitrilo, tapabocas y gafas de protección.',
        'Confirme disponibilidad de todas las hojas del set (Macintosh No. 1, 2, 3, 4 y/o Miller No. 0, 1, 2, 3) para inspeccionarlas individualmente.',
        'Confirme disponibilidad de baterías nuevas del tipo correspondiente al mango (AA, C o D según modelo) para verificación de iluminación.',
        'Tenga a mano luxómetro (o aplicación de referencia) para verificación objetiva de intensidad lumínica si está disponible; de lo contrario realice verificación visual comparativa.',
        'No sumerja el mango en líquidos ni exponga la unión mango-hoja a inmersión; solo las hojas desmontables son aptas para esterilización por autoclave o inmersión según su material.',
        'Si se detectan daños en el haz de fibra óptica, fallas eléctricas internas o corrosión severa, retire de servicio y remita a mantenimiento especializado o proveedor.',
      ],
      inspeccion: [
        { id: 'lr1',  item: 'Mango: carcasa exterior sin grietas, deformaciones, corrosión ni daño físico visible' },
        { id: 'lr2',  item: 'Mango: superficie antideslizante (estrías o goma) íntegra, limpia y sin desprendimientos' },
        { id: 'lr3',  item: 'Tapa del compartimento de baterías: abre y cierra correctamente; rosca o mecanismo de cierre funcional sin daño' },
        { id: 'lr4',  item: 'Contactos eléctricos internos del mango: limpios, sin oxidación, sulfatación ni deformación; resorte de contacto con tensión adecuada' },
        { id: 'lr5',  item: 'Conector de acoplamiento mango–hoja (gancho o bayoneta): sin desgaste excesivo, sin dobladuras; encaje firme y seguro con todas las hojas del set' },
        { id: 'lr6',  item: 'Hoja Macintosh No. 1: íntegra, sin fracturas, bordes sin rebabas ni puntos cortantes; superficie limpia y sin incrustaciones' },
        { id: 'lr7',  item: 'Hoja Macintosh No. 2: íntegra, sin fracturas, bordes sin rebabas ni puntos cortantes; superficie limpia y sin incrustaciones' },
        { id: 'lr8',  item: 'Hoja Macintosh No. 3: íntegra, sin fracturas, bordes sin rebabas ni puntos cortantes; superficie limpia y sin incrustaciones' },
        { id: 'lr9',  item: 'Hoja Macintosh No. 4: íntegra, sin fracturas, bordes sin rebabas ni puntos cortantes; superficie limpia y sin incrustaciones' },
        { id: 'lr10', item: 'Hojas Miller (si aplica al set): íntegras, sin fracturas ni rebabas; superficie limpia y sin incrustaciones' },
        { id: 'lr11', item: 'Ventana óptica / fibra óptica de cada hoja: limpia, sin manchas, residuos, rayones ni fibras rotas visibles (puntos oscuros en el haz)' },
        { id: 'lr12', item: 'Bombillo o LED en cada hoja (si aplica a hojas con iluminación propia): íntegro y sin signos de quemado' },
        { id: 'lr13', item: 'Mecanismo de despliegue de hoja: articulación mango–hoja gira libremente hasta posición de trabajo (90°) y queda firme sin juego excesivo' },
        { id: 'lr14', item: 'Bolsa, estuche o caja de transporte: íntegra, limpia y con compartimentos adecuados para cada hoja; cierre funcional' },
        { id: 'lr15', item: 'Etiqueta de identificación de activo fijo y número de serie (mango y set) legible y coincidente con el inventario' },
      ],
      verificacionBasica: [
        { id: 'lrvb1', item: 'Instalar baterías nuevas en el mango y verificar que el compartimento cierra herméticamente sin holguras' },
        { id: 'lrvb2', item: 'Al desplegar cualquier hoja a 90°, el circuito eléctrico se activa y la luz enciende automáticamente (sin botón adicional)' },
        { id: 'lrvb3', item: 'Al plegar la hoja, la luz se apaga completamente (ausencia de destellos o luz residual que indiquen arco eléctrico)' },
        { id: 'lrvb4', item: 'La intensidad lumínica es brillante y uniforme en todas las hojas del set, sin parpadeos ni variaciones durante 60 segundos de operación continua' },
        { id: 'lrvb5', item: 'El color de la luz es blanco frío o blanco neutro (LED) o blanco-amarillo intenso (halógeno/xenón); sin tonalidades amarillas apagadas que indiquen batería agotada o bombillo en mal estado' },
        { id: 'lrvb6', item: 'Todas las hojas encajan firmemente en el mango sin juego lateral ni desprendimiento espontáneo durante el uso simulado' },
      ],
      pruebasFuncionales: [
        { id: 'lrpf1',  prueba: 'Estabilidad de iluminación — Mantener hoja desplegada 3 minutos continuos; observar variación de luz', valorEsperado: 'Luz constante sin parpadeos, atenuaciones ni apagones durante los 3 minutos', resultado: ['Pasa', 'Falla'] },
        { id: 'lrpf2',  prueba: 'Prueba de encendido/apagado cíclico — Desplegar y plegar hoja 10 veces consecutivas', valorEsperado: 'Luz enciende y apaga correctamente en los 10 ciclos; sin falla intermitente', resultado: ['Pasa', 'Falla'] },
        { id: 'lrpf3',  prueba: 'Encaje mecánico bajo carga — Con hoja desplegada a 90°, aplicar presión lateral suave simulando uso clínico', valorEsperado: 'La hoja permanece firme en el mango sin desprendimiento ni variación de ángulo', resultado: ['Pasa', 'Falla'] },
        { id: 'lrpf4', prueba: 'Temperatura del mango durante uso — Medir temperatura exterior del mango tras 5 minutos de operación continua', valorEsperado: 'Temperatura ≤ 40 °C al tacto en carcasa exterior (sin riesgo de quemadura)', resultado: ['Pasa', 'Falla'] },
        { id: 'lrpf5', prueba: 'Verificación de integridad de la curva de hoja — Inspección visual y táctil de la curvatura de cada hoja Macintosh', valorEsperado: 'Curvatura uniforme según talla; sin deformaciones, aplastamientos ni zonas rectas no originales', resultado: ['Pasa', 'Falla'] },
        { id: 'lrpf6', prueba: 'Prueba de duración de baterías — Operación continua con baterías nuevas instaladas durante 30 minutos', valorEsperado: 'Intensidad lumínica sin caída perceptible al final de los 30 minutos', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Inspección física completa de mango y hojas',
        'Limpieza y desinfección de contactos eléctricos del mango',
        'Cambio de baterías',
        'Cambio de bombillo / módulo LED (si aplica)',
        'Sustitución de hoja deteriorada o con fibra óptica dañada',
        'Verificación de iluminación con luxómetro',
        'Verificación de encaje y mecanismo mango–hoja',
      ],
    },

    'termohigrometro_digital_htc2': {
      nombre: 'Termohigrómetro Digital HTC-2',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-TH2',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el dispositivo esté operativo y con pantalla encendida antes de iniciar el procedimiento.',
        'Confirme disponibilidad de un patrón de referencia certificado: termohigrómetro calibrado con vigencia de calibración activa, o cámara climática de referencia.',
        'Asegúrese de que el sensor no haya estado expuesto a humedad extrema (> 95% HR), condensación o inmersión en las últimas 2 horas antes de la verificación.',
        'El procedimiento debe realizarse en ambiente estable: temperatura entre 15 °C y 35 °C, sin corrientes de aire directas ni fuentes de calor cercanas al sensor.',
        'No cubra ni obstruya las ranuras o ventanas del sensor de temperatura/humedad durante las pruebas; mantenga el dispositivo en posición vertical según lo indica el fabricante.',
        'Disponga de baterías de reemplazo (tipo AAA o AA según configuración del HTC-2) para verificar el nivel de carga y reemplazar si es necesario.',
        'Si el dispositivo presenta pantalla en blanco, lecturas erróneas persistentes o mensaje de error no resolvible con cambio de batería, retire de servicio antes de continuar.',
      ],
      inspeccion: [
        { id: 'h2i1',  item: 'Carcasa exterior íntegra, sin grietas, deformaciones, impactos ni daño físico visible en frontal, lateral y posterior' },
        { id: 'h2i2',  item: 'Pantalla LCD: sin pixeles muertos, manchas, burbujas ni daño visible; todos los segmentos de dígitos funcionales y legibles' },
        { id: 'h2i3',  item: 'Botón(es) de función (MODE / SET / MAX / MIN): sin atascamiento ni daño; respuesta al tacto correcta' },
        { id: 'h2i4',  item: 'Sensor externo (si aplica): cable y sonda íntegros, sin cortes ni conector dañado; rejilla protectora sin obstrucción' },
        { id: 'h2i5',  item: 'Ventana o ranura del sensor interno de HR/temperatura: libre de polvo, hongos, residuos o contaminantes visibles' },
        { id: 'h2i6',  item: 'Compartimento de baterías: tapa con cierre firme; contactos metálicos sin oxidación, sulfatación ni deformación' },
        { id: 'h2i7',  item: 'Baterías instaladas sin signos de fuga, corrosión ni hinchazón; fecha de instalación verificada' },
        { id: 'h2i8',  item: 'Soporte trasero (pie o gancho de pared): íntegro y funcional; el dispositivo se sostiene de forma estable en su posición de trabajo' },
        { id: 'h2i9',  item: 'Etiqueta de identificación de activo fijo y número de serie legible, coincidente con el inventario' },
        { id: 'h2i10', item: 'Limpieza externa realizada con paño seco o ligeramente humedecido con alcohol isopropílico 70%; ranura del sensor soplada con aire comprimido seco' },
      ],
      verificacionBasica: [
        { id: 'h2vb1', item: 'Pantalla enciende correctamente al insertar baterías; todos los segmentos LCD visibles y nítidos' },
        { id: 'h2vb2', item: 'Pantalla muestra simultáneamente temperatura (°C o °F) y humedad relativa (%) en el display principal' },
        { id: 'h2vb3', item: 'Indicador de nivel de batería visible en pantalla; sin símbolo de batería baja con baterías nuevas o en buen estado' },
        { id: 'h2vb4', item: 'Función de cambio de unidades °C/°F operativa: al presionar el botón, el valor se convierte correctamente' },
        { id: 'h2vb5', item: 'Función de memoria MAX/MIN operativa: el dispositivo retiene y muestra los valores máximos y mínimos registrados' },
        { id: 'h2vb6', item: 'Ícono de confort (seco / confort / húmedo) visible y coherente con la lectura de HR actual' },
        { id: 'h2vb7', item: 'Sensor externo (si aplica): la pantalla actualiza la lectura del canal externo al cambiar las condiciones en la sonda remota' },
        { id: 'h2vb8', item: 'Las lecturas se actualizan en pantalla cada 10–30 segundos; sin congelamiento de valores' },
      ],
      pruebasFuncionales: [
        { id: 'h2pf1',  prueba: 'Temperatura interna — Comparación con patrón calibrado en ambiente estable (≥ 15 min de estabilización)', valorEsperado: 'Diferencia ≤ ± 1 °C respecto al patrón (especificación HTC-2: ± 1 °C en rango -10 °C a 50 °C)', resultado: ['Pasa', 'Falla'] },

        { id: 'h2pf2',  prueba: 'Temperatura en escala °F — Convertir lectura del patrón a °F y comparar con display del HTC-2 en modo °F', valorEsperado: 'Diferencia ≤ ± 1.8 °F respecto al valor convertido del patrón', resultado: ['Pasa', 'Falla'] },

        { id: 'h2pf3',  prueba: 'Humedad relativa interna — Comparación con patrón calibrado en ambiente estable (≥ 15 min de estabilización)', valorEsperado: 'Diferencia ≤ ± 5% HR respecto al patrón (especificación HTC-2: ± 5% HR en rango 10–99% HR)', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y ventana del sensor',
        'Soplado de ranura del sensor con aire comprimido seco',
        'Limpieza de contactos de batería',
        'Cambio de baterías (AAA / AA según modelo)',
        'Comparación y verificación con patrón calibrado (temperatura y humedad)',
        'Verificación de funciones MAX/MIN y cambio de unidades',
        'Sustitución del dispositivo por falla en sensor o pantalla',
      ],
    },

    'termometro_digital_witpoce': {
      nombre: 'Termómetro Digital WITPOCE',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-TDW',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el dispositivo esté operativo, con pantalla LCD visible y batería LR44 instalada antes de iniciar el procedimiento.',
        'Confirme disponibilidad de un termómetro patrón calibrado o simulador/cámara térmica de referencia con vigencia de calibración activa.',
        'Realice la verificación en ambiente estable, sin corrientes de aire directas, radiación solar ni fuentes de calor cercanas al sensor.',
        'Permita estabilización mínima de 15 minutos entre el equipo y el patrón antes de registrar lecturas comparativas.',
        'No sumerja el dispositivo en líquidos ni exponga la pantalla o el compartimento de batería a humedad directa.',
        'Si el equipo presenta pantalla en blanco, segmentos incompletos, lecturas erráticas persistentes o falla de alimentación, retire de servicio antes de continuar.',
      ],
      inspeccion: [
        { id: 'wti1', item: 'Carcasa exterior íntegra, sin grietas, deformaciones, golpes ni daño físico visible' },
        { id: 'wti2', item: 'Pantalla LCD clara, legible y sin pérdida de segmentos' },
        { id: 'wti3', item: 'Botón(es) de función operativos, sin atascamiento ni daño mecánico' },
        { id: 'wti4', item: 'Sensor interno y/o sonda externa (si aplica) íntegros, sin cortes, fisuras ni obstrucciones' },
        { id: 'wti5', item: 'Compartimento de batería limpio; contactos sin corrosión, sulfatación ni deformación' },
        { id: 'wti6', item: 'Batería LR44 instalada sin signos de fuga, hinchazón o agotamiento evidente' },
        { id: 'wti7', item: 'Soporte, clip o sistema de fijación en buen estado (si aplica)' },
        { id: 'wti8', item: 'Etiqueta de identificación o número de serie legible y coincidente con inventario (si aplica)' },
        { id: 'wti9', item: 'Limpieza externa realizada con paño suave seco o ligeramente humedecido con alcohol isopropílico 70%' },
      ],
      verificacionBasica: [
        { id: 'wtvb1', item: 'La pantalla enciende correctamente y muestra lectura estable de temperatura' },
        { id: 'wtvb2', item: 'La lectura se actualiza progresivamente ante cambios moderados de temperatura' },
        { id: 'wtvb3', item: 'La unidad de medición mostrada en pantalla es coherente con la configuración del equipo (°C / °F si aplica)' },
        { id: 'wtvb4', item: 'No se evidencian reinicios espontáneos, parpadeos anormales ni pérdida de visualización' },
        { id: 'wtvb5', item: 'El equipo mantiene lectura continua con alimentación por batería LR44 de 1.5 V' },
      ],
      pruebasFuncionales: [
        { id: 'wtpf1', prueba: 'Temperatura ambiente — Comparación con patrón calibrado en ambiente estable (≥ 15 min de estabilización)', valorEsperado: 'Diferencia ≤ ± 1 °C respecto al patrón', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf2', prueba: 'Respuesta a incremento moderado de temperatura — Acercar el sensor a una fuente térmica controlada sin exceder el rango del fabricante', valorEsperado: 'La lectura aumenta de forma progresiva y sin saltos erráticos', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf3', prueba: 'Respuesta a descenso moderado de temperatura — Ubicar el sensor en ambiente más frío controlado sin exceder el rango del fabricante', valorEsperado: 'La lectura disminuye de forma progresiva y sin congelamiento de pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'wtpf6', prueba: 'Consistencia visual y funcional de pantalla — Verificar visualización continua durante 5 min de operación', valorEsperado: 'Pantalla LCD legible, sin pérdida de segmentos ni apagado inesperado', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y pantalla',
        'Limpieza de contactos de batería',
        'Cambio de batería LR44',
        'Verificación comparativa con patrón calibrado',
        'Revisión de sensor interno y/o sonda externa',
      ],
    },
    'unidad_calentamiento_nellcor_wt6000': {
      nombre: 'Unidad de Calentamiento Nellcor WarmTouch WT 6000',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-WT6000',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que la unidad esté desconectada de la red eléctrica antes de iniciar la inspección física y limpieza externa.',
        'Confirme disponibilidad del analizador de seguridad eléctrica vigente y termómetro patrón o instrumento de referencia para verificación funcional cuando aplique.',
        'Inspeccione que la manguera de salida de aire y el puerto de conexión estén libres de obstrucciones, deformaciones o residuos.',
        'Revise que el filtro de aire se encuentre instalado correctamente y sin indicación de reemplazo vencido en pantalla.',
        'Ubique la unidad sobre soporte estable (carro, baranda o porta sueros) y asegure que exista adecuada ventilación alrededor del equipo.',
        'No opere la unidad sin filtro instalado, con carcasa abierta ni con evidencia de ingreso de líquidos al sistema.',
        'Si se evidencian alarmas persistentes, ausencia de flujo de aire, sobrecalentamiento, olor anormal o falla de pantalla, retire de servicio antes de continuar.',
      ],
      inspeccion: [
        { id: 'wt6000i1', item: 'Carcasa exterior íntegra, sin grietas, deformaciones, golpes ni daño físico visible' },
        { id: 'wt6000i2', item: 'Pantalla LCD y panel de control legibles, sin pérdida de segmentos ni teclas atascadas' },
        { id: 'wt6000i3', item: 'Cable de alimentación, clavija y alivio de tensión en buen estado, sin cortes ni recalentamiento' },
        { id: 'wt6000i4', item: 'Manguera de calentamiento íntegra, sin perforaciones, acodamientos, fisuras ni suciedad excesiva' },
        { id: 'wt6000i5', item: 'Boquilla/nozzle de conexión segura, sin fracturas ni holguras anormales' },
        { id: 'wt6000i6', item: 'Filtro de aire instalado correctamente; compartimiento del filtro limpio y sin obstrucciones visibles' },
        { id: 'wt6000i7', item: 'Soporte de fijación a carro, porta sueros o baranda en buen estado y con ajuste firme' },
        { id: 'wt6000i8', item: 'Rejillas de entrada y salida de aire limpias, libres de polvo y sin obstrucción' },
        { id: 'wt6000i9', item: 'Etiquetas de identificación, activo fijo y número de serie legibles y coincidentes con inventario' },
        { id: 'wt6000i10', item: 'Limpieza externa realizada con paño suave y desinfectante compatible, sin ingreso de líquidos al interior del equipo' },
      ],
      verificacionBasica: [
        { id: 'wt6000vb1', item: 'La unidad enciende correctamente y completa autoverificación inicial sin errores aparentes' },
        { id: 'wt6000vb2', item: 'La pantalla muestra de forma clara el estado del equipo y los ajustes de temperatura disponibles' },
        { id: 'wt6000vb3', item: 'Los botones o controles permiten seleccionar correctamente los modos/temperaturas disponibles' },
        { id: 'wt6000vb4', item: 'Se percibe flujo de aire uniforme a través de la manguera al iniciar el calentamiento' },
        { id: 'wt6000vb5', item: 'No se evidencian ruidos anormales, vibraciones excesivas, olor a quemado ni sobrecalentamiento de carcasa' },
        { id: 'wt6000vb6', item: 'La unidad responde a cambio de modo y retorna a condición segura cuando se apaga' },
      ],
      pruebasFuncionales: [
        { id: 'wt6000pf1', prueba: 'Encendido y autodiagnóstico — Energizar la unidad y verificar arranque normal', valorEsperado: 'Inicio sin códigos de falla ni mensajes de error persistentes', resultado: ['Pasa', 'Falla'] },
        { id: 'wt6000pf2', prueba: 'Selección de modos/temperaturas — Verificar respuesta de cada ajuste disponible en el panel', valorEsperado: 'Permite seleccionar las 5 configuraciones disponibles, incluyendo ambiente y boost', resultado: ['Pasa', 'Falla'] },
        { id: 'wt6000pf3', prueba: 'Flujo de aire — Operar la unidad con manguera conectada y verificar salida continua', valorEsperado: 'Flujo de aire continuo, uniforme y sin interrupciones anormales', resultado: ['Pasa', 'Falla'] },
        { id: 'wt6000pf4', prueba: 'Verificación térmica en modo de calentamiento — Registrar temperatura del aire de salida con instrumento de referencia', valorEsperado: 'Genera aumento de temperatura conforme al modo seleccionado y sin sobrepasar condición de alarma', resultado: ['Pasa', 'Falla'] },
        { id: 'wt6000pf5', prueba: 'Modo Boost — Activar boost y verificar temporización/indicación del modo', valorEsperado: 'El modo boost se activa correctamente y muestra indicación/temporización asociada', resultado: ['Pasa', 'Falla'] },
        { id: 'wt6000pf6', prueba: 'Alarmas / mensajes de servicio — Verificar ausencia de alarmas activas durante la operación normal', valorEsperado: 'Sin alarmas activas; filtro y estado general reportados correctamente en pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'wt6000pf7', prueba: 'Apagado seguro — Desactivar la unidad al finalizar la prueba', valorEsperado: 'El equipo se apaga correctamente sin comportamiento anormal posterior', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y panel de control',
        'Limpieza de rejillas de ventilación y compartimiento de filtro',
        'Verificación de manguera y boquilla de conexión',
        'Reemplazo de filtro de aire (si aplica)',
        'Verificación funcional de modos de temperatura',
        'Prueba de flujo de aire y calentamiento',
        'Verificación de alarmas e indicadores en pantalla',
      ],
    },
    'gramera_seca_856': {
      nombre: 'Gramera SECA 856',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-GS856',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Ubique la gramera sobre una superficie firme, nivelada y libre de vibraciones antes de iniciar la inspección.',
        'Confirme disponibilidad de pesas patrón calibradas o masas de referencia trazables para la verificación funcional.',
        'Verifique que el plato o superficie de pesaje esté limpio, seco y libre de residuos antes de encender el equipo.',
        'Revise que las 4 baterías AAA estén instaladas correctamente y con nivel de carga suficiente.',
        'Permita estabilización del equipo por al menos 5 minutos en el área de uso antes de realizar pruebas comparativas.',
        'No exceda la capacidad máxima de 5 kg ni coloque cargas de impacto sobre la superficie de pesaje.',
        'Si el equipo presenta error de cero, inestabilidad persistente, teclas sin respuesta o daño estructural, retire de servicio antes de continuar.',
      ],
      inspeccion: [
        { id: 'gs856i1', item: 'Carcasa y base íntegras, sin grietas, deformaciones ni daño físico visible' },
        { id: 'gs856i2', item: 'Superficie de pesaje de acero inoxidable limpia, firme y sin corrosión' },
        { id: 'gs856i3', item: 'Pantalla digital legible, sin pérdida de segmentos ni manchas' },
        { id: 'gs856i4', item: 'Teclas de encendido, HOLD/TARE y funciones disponibles responden correctamente al tacto' },
        { id: 'gs856i5', item: 'Compartimento de baterías íntegro; contactos sin sulfatación, corrosión ni deformación' },
        { id: 'gs856i6', item: 'Baterías AAA instaladas sin fugas, abombamiento ni agotamiento evidente' },
        { id: 'gs856i7', item: 'Base de apoyo estable, sin balanceo ni desnivel visible' },
        { id: 'gs856i8', item: 'Etiquetas de identificación, activo fijo y número de serie legibles y coincidentes con inventario' },
        { id: 'gs856i9', item: 'Limpieza externa realizada con paño suave ligeramente humedecido, sin ingreso de líquidos al compartimento eléctrico' },
      ],
      verificacionBasica: [
        { id: 'gs856vb1', item: 'La gramera enciende correctamente y realiza puesta a cero sin carga' },
        { id: 'gs856vb2', item: 'La lectura permanece estable sin carga y retorna a cero después de retirar el peso' },
        { id: 'gs856vb3', item: 'La función TARE/HOLD opera correctamente cuando aplica al equipo' },
        { id: 'gs856vb4', item: 'El cambio de unidades (kg/lb u otra disponible) responde correctamente, si aplica al modelo configurado' },
        { id: 'gs856vb5', item: 'No se evidencian apagados inesperados, mensajes de error persistentes ni fluctuaciones anormales de lectura' },
      ],
      pruebasFuncionales: [
        { id: 'gs856pf1', prueba: 'Puesta a cero inicial — Encender el equipo sin carga sobre superficie nivelada', valorEsperado: 'Indicación 0 g o equivalente, estable y sin deriva visible', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf2', prueba: 'Verificación con carga baja — Colocar masa patrón de 500 g', valorEsperado: 'Error máximo permitido dentro de ± 1 g', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf3', prueba: 'Verificación con carga media — Colocar masa patrón de 2.000 g', valorEsperado: 'Error máximo permitido dentro de ± 1 g', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf4', prueba: 'Verificación con carga alta — Colocar masa patrón de 4.000 g', valorEsperado: 'Error máximo permitido dentro de ± 2 g', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf5', prueba: 'Prueba de repetibilidad — Realizar 3 mediciones consecutivas con la misma masa patrón de referencia', valorEsperado: 'Variación entre lecturas ≤ 1 g en cargas < 3 kg o ≤ 2 g en cargas ≥ 3 kg', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf6', prueba: 'Prueba de tara — Colocar recipiente, aplicar TARE y luego añadir masa patrón conocida', valorEsperado: 'La lectura neta corresponde al peso agregado dentro de la resolución del equipo', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf7', prueba: 'Retorno a cero — Retirar completamente la carga después de la medición', valorEsperado: 'La lectura retorna a cero sin error residual visible', resultado: ['Pasa', 'Falla'] },
        { id: 'gs856pf8', prueba: 'Apagado automático — Dejar el equipo sin interacción durante el tiempo programado por fabricante', valorEsperado: 'Autoapagado funcional para ahorro de batería', resultado: ['Pasa', 'Falla'] },
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa y superficie de pesaje',
        'Limpieza de compartimento y contactos de batería',
        'Cambio de baterías AAA',
        'Verificación de nivelación y estabilidad de apoyo',
        'Verificación metrológica con masas patrón',
        'Prueba funcional de TARE/HOLD',
      ],
    },

'aspirador_smaf_yx980d': {
      nombre: 'Aspirador SMAF YX980D',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-ASP-YX980D',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el aspirador se encuentre fuera de uso clínico, desconectado de la red eléctrica y con los frascos colectores vacíos antes de iniciar la inspección.',
        'Realice limpieza y desinfección previa de frascos, tapas, mangueras y superficies externas de acuerdo con el protocolo institucional de bioseguridad.',
        'Confirme disponibilidad de vacuómetro patrón o analizador de vacío calibrado, filtro bacteriano/hidrofóbico, mangueras y recipiente de prueba.',
        'Revise que el filtro de aire y el sistema de protección contra sobreflujo estén correctamente instalados antes de encender el equipo.',
        'No opere el equipo en presencia de gases inflamables, sustancias corrosivas o explosivas, ni lo utilice para aplicaciones no clínicas.',
        'No abra la bomba, motor, tablero eléctrico ni cubiertas internas durante el mantenimiento preventivo rutinario; las intervenciones internas deben ser realizadas por servicio técnico autorizado.',
        'Si se evidencia ingreso de líquido a la bomba, daño eléctrico, fuga importante, sobrecalentamiento, ruido anormal o falla del flotador, retire de servicio y reporte para mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'asp980i1', item: 'Carcasa, estructura móvil y base sin golpes, grietas, deformaciones, corrosión ni partes sueltas' },
        { id: 'asp980i2', item: 'Ruedas, soportes, manijas y elementos de transporte firmes y funcionales' },
        { id: 'asp980i3', item: 'Cable de alimentación, clavija, interruptor y fusible accesible en buen estado, sin cortes ni sulfatación' },
        { id: 'asp980i4', item: 'Manómetro de vacío legible, con aguja en cero cuando el equipo está apagado y sin fisuras en el visor' },
        { id: 'asp980i5', item: 'Regulador de presión/vacío con giro uniforme y sin atascamientos' },
        { id: 'asp980i6', item: 'Frascos colectores de policarbonato íntegros, limpios, sin fisuras, opacidad crítica ni deformaciones' },
        { id: 'asp980i7', item: 'Tapas, empaques, conexiones y válvulas de cierre hermético sin fuga visible ni deterioro' },
        { id: 'asp980i8', item: 'Dispositivo de protección contra sobreflujo/flotador limpio, libre y con movimiento adecuado' },
        { id: 'asp980i9', item: 'Filtro bacteriano/hidrofóbico instalado en la orientación correcta, seco, limpio y sin obstrucción' },
        { id: 'asp980i10', item: 'Mangueras de succión y conexión sin dobleces, grietas, endurecimiento, obstrucciones ni contaminación visible' },
        { id: 'asp980i11', item: 'Pedal o interruptor de mano funcional, con cable y conector en buen estado, si aplica al equipo' },
        { id: 'asp980i12', item: 'Etiquetas de identificación, activo fijo, advertencias y número de serie legibles y coincidentes con inventario' }
      ],
      verificacionBasica: [
        { id: 'asp980vb1', item: 'El equipo enciende y apaga correctamente sin chispa, olor anormal, sobrecalentamiento ni vibración excesiva' },
        { id: 'asp980vb2', item: 'La bomba genera vacío de forma progresiva al ocluir la línea de prueba y la lectura se mantiene estable' },
        { id: 'asp980vb3', item: 'El regulador permite variar el nivel de vacío desde bajo hasta alto de manera controlada' },
        { id: 'asp980vb4', item: 'El sistema de frascos, tapas, filtro y mangueras mantiene cierre hermético durante la prueba de succión' },
        { id: 'asp980vb5', item: 'El dispositivo de sobreflujo interrumpe o limita el paso hacia la bomba cuando se simula elevación del flotador' },
        { id: 'asp980vb6', item: 'El pedal o mando de activación responde correctamente, si aplica' }
      ],
      pruebasFuncionales: [
        { id: 'asp980pf1', prueba: 'Encendido y operación inicial sin carga', valorEsperado: 'Arranque normal, ruido uniforme y sin alarmas, olor eléctrico ni vibración anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'asp980pf2', prueba: 'Vacío mínimo ajustable con vacuómetro patrón', valorEsperado: 'Permite ajustar aproximadamente desde -150 mmHg o 0.02 MPa', resultado: ['Pasa', 'Falla'] },
        { id: 'asp980pf3', prueba: 'Vacío máximo con línea ocluida y filtro instalado', valorEsperado: 'Alcanza hasta -680 mmHg o 0.09 MPa, según condición del equipo y altitud local', resultado: ['Pasa', 'Falla'] },
        { id: 'asp980pf4', prueba: 'Estabilidad de vacío a nivel medio durante 30 segundos', valorEsperado: 'Lectura estable, sin caída brusca ni oscilación anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'asp980pf5', prueba: 'Regulación progresiva de presión/vacío', valorEsperado: 'Variación suave y controlada entre niveles bajo, medio y alto', resultado: ['Pasa', 'Falla'] },
        { id: 'asp980pf6', prueba: 'Hermeticidad de frascos, tapas y mangueras', valorEsperado: 'Sin fugas audibles, sin pérdida marcada de vacío y con acoples firmes', resultado: ['Pasa', 'Falla'] },
        { id: 'asp980pf7', prueba: 'Protección contra sobreflujo / flotador', valorEsperado: 'Flotador libre y cierre funcional al simular nivel alto o inversión controlada de la tapa', resultado: ['Pasa', 'Falla'] },
        { id: 'asp980pf8', prueba: 'Prueba de succión con agua limpia en recipiente de prueba', valorEsperado: 'Aspiración continua hacia el frasco colector sin retorno de líquido, fugas ni ingreso hacia la bomba', resultado: ['Pasa', 'Falla'] },
        { id: 'asp980pf9', prueba: 'Prueba de pedal o interruptor de mano, si aplica', valorEsperado: 'Activa y desactiva la succión de forma inmediata y segura', resultado: ['Aplica', 'N/A'] },
        { id: 'asp980pf10', prueba: 'Operación intermitente controlada hasta 30 minutos, si el servicio lo requiere', valorEsperado: 'Funcionamiento estable respetando ciclo de trabajo, sin sobrecalentamiento ni pérdida de desempeño', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, base y controles',
        'Desinfección de frascos colectores y tapas según protocolo institucional',
        'Verificación y limpieza de mangueras y conexiones externas',
        'Cambio o verificación de filtro bacteriano/hidrofóbico',
        'Verificación de flotador y protección contra sobreflujo',
        'Verificación funcional con vacuómetro patrón',
        'Prueba de hermeticidad del circuito de succión',
        'Recomendación de retiro de servicio / mantenimiento correctivo'
      ]
    },


    'bano_serologico_memmert_wmb10': {
      nombre: 'Baño Serológico MEMMERT WMB-10',
      categoria: 'Biomédico / Laboratorio',
      codigo: 'SLV-GAT-BIO-BS-WMB10',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el baño serológico se encuentre fuera de uso, desconectado de la red eléctrica y a temperatura segura antes de iniciar la inspección.',
        'Confirme disponibilidad de termómetro patrón o datalogger de temperatura calibrado, cronómetro, agua destilada/desmineralizada, paños suaves y elementos de protección personal.',
        'Drene el agua del tanque si se observan residuos, turbidez, biopelícula, precipitados o contaminación; no realice pruebas con muestras biológicas en el interior.',
        'No opere el equipo en seco; antes del encendido confirme nivel de agua suficiente para cubrir la resistencia o zona de calentamiento según diseño del equipo.',
        'No utilice materiales inflamables, solventes, sustancias corrosivas ni elementos que puedan dañar el tanque de acero inoxidable.',
        'No intervenga tarjeta electrónica, resistencia, sensores, termostatos internos ni cableado durante el preventivo rutinario; las reparaciones internas deben ser realizadas por servicio técnico autorizado.',
        'Si se evidencian fuga de agua, daño eléctrico, sobretemperatura, error persistente, corrosión severa o desviación térmica fuera de tolerancia, retire de servicio y reporte para mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'wmb10i1', item: 'Carcasa exterior, panel frontal, tapa y bordes sin golpes, grietas, deformaciones, corrosión ni partes sueltas' },
        { id: 'wmb10i2', item: 'Tanque/cuba de acero inoxidable íntegro, limpio, sin picaduras, incrustaciones, fisuras ni residuos adheridos' },
        { id: 'wmb10i3', item: 'Tapa, bisagras o accesorios de cubierta en buen estado, con cierre y apoyo adecuados si aplica' },
        { id: 'wmb10i4', item: 'Gradillas, soportes o placas internas limpias, firmes, sin corrosión ni deformaciones que afecten el uso' },
        { id: 'wmb10i5', item: 'Cable de alimentación, clavija, interruptor y fusible accesible en buen estado, sin cortes, calentamiento, sulfatación ni empalmes' },
        { id: 'wmb10i6', item: 'Pantalla, perillas, teclas o controles de temperatura legibles y funcionales' },
        { id: 'wmb10i7', item: 'Sensor de temperatura visible o zona de medición sin obstrucciones, golpes ni acumulación de sarro' },
        { id: 'wmb10i8', item: 'Salida de drenaje, válvula o tapón sin fugas, obstrucciones ni deterioro, si aplica al modelo instalado' },
        { id: 'wmb10i9', item: 'Base, apoyos y superficie de ubicación nivelados, estables y alejados de bordes o fuentes de salpicadura' },
        { id: 'wmb10i10', item: 'Etiquetas de identificación, advertencias, activo fijo y número de serie legibles y coincidentes con inventario' },
        { id: 'wmb10i11', item: 'Limpieza externa realizada con paño suave ligeramente humedecido, evitando ingreso de líquidos al panel eléctrico' },
        { id: 'wmb10i12', item: 'Limpieza interna realizada con producto compatible con acero inoxidable, sin abrasivos ni elementos cortopunzantes' }
      ],
      verificacionBasica: [
        { id: 'wmb10vb1', item: 'El equipo enciende correctamente, la pantalla/indicador responde y no presenta mensajes de error persistentes' },
        { id: 'wmb10vb2', item: 'El control permite configurar el punto de temperatura y conserva el valor programado durante la operación' },
        { id: 'wmb10vb3', item: 'El calentamiento inicia de forma progresiva con nivel de agua adecuado y sin olor eléctrico, chispa o ruido anormal' },
        { id: 'wmb10vb4', item: 'La indicación de temperatura aumenta de manera coherente frente a la medición del termómetro patrón' },
        { id: 'wmb10vb5', item: 'El termostato/control corta y regula al aproximarse al punto programado, sin sobrepaso crítico' },
        { id: 'wmb10vb6', item: 'La cuba mantiene hermeticidad durante la prueba, sin fugas en base, drenaje o uniones visibles' },
        { id: 'wmb10vb7', item: 'El temporizador, alarma o función de retención responde correctamente, si aplica a la versión instalada' }
      ],
      pruebasFuncionales: [
        { id: 'wmb10pf1', prueba: 'Encendido inicial con nivel de agua operativo', valorEsperado: 'Arranque normal, indicador activo y ausencia de mensajes de error, chispa, olor eléctrico o calentamiento externo anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'wmb10pf2', prueba: 'Programación de punto de temperatura bajo para verificación', valorEsperado: 'Permite configurar 37 °C y mantener el valor programado sin cambios espontáneos', resultado: ['Pasa', 'Falla'] },
        { id: 'wmb10pf3', prueba: 'Verificación de temperatura a 37 °C con termómetro patrón estabilizado', valorEsperado: 'Lectura del baño dentro de ± 1 °C respecto al patrón o según criterio metrológico institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'wmb10pf4', prueba: 'Estabilidad térmica a 37 °C durante 10 minutos', valorEsperado: 'Variación máxima ≤ ± 0,5 °C después de estabilización', resultado: ['Pasa', 'Falla'] },
        { id: 'wmb10pf5', prueba: 'Uniformidad térmica en tres puntos de la cuba a 37 °C', valorEsperado: 'Diferencia entre puntos ≤ 1 °C con tapa cerrada y nivel de agua adecuado', resultado: ['Pasa', 'Falla'] },
        { id: 'wmb10pf6', prueba: 'Programación de punto de temperatura medio', valorEsperado: 'Permite configurar 56 °C y alcanzar el punto sin oscilaciones anormales', resultado: ['Pasa', 'Falla'] },
        { id: 'wmb10pf7', prueba: 'Verificación de temperatura a 56 °C con termómetro patrón estabilizado', valorEsperado: 'Lectura del baño dentro de ± 1 °C respecto al patrón o según criterio metrológico institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'wmb10pf8', prueba: 'Recuperación térmica después de abrir tapa durante 30 segundos', valorEsperado: 'La temperatura retorna progresivamente al set point sin error ni apagado inesperado', resultado: ['Pasa', 'Falla'] },
        { id: 'wmb10pf9', prueba: 'Verificación de temporizador/retención de tiempo, si aplica', valorEsperado: 'Conteo funcional y finalización/alarma correcta según configuración del equipo', resultado: ['Aplica', 'N/A'] },
        { id: 'wmb10pf10', prueba: 'Prueba de fuga con cuba llena al nivel operativo durante 15 minutos', valorEsperado: 'Sin goteo, humedad anormal en base, válvula, drenaje o conexión eléctrica', resultado: ['Pasa', 'Falla'] },
        { id: 'wmb10pf11', prueba: 'Seguridad por operación sin sobretemperatura visible', valorEsperado: 'No se evidencian ebullición no programada, sobrepaso crítico ni calentamiento excesivo de superficies de contacto', resultado: ['Pasa', 'Falla'] },
        { id: 'wmb10pf12', prueba: 'Apagado y reinicio controlado', valorEsperado: 'El equipo apaga correctamente y reinicia sin pérdida anormal de funciones básicas ni error persistente', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, tapa y controles',
        'Limpieza interna de cuba de acero inoxidable',
        'Cambio de agua por agua destilada/desmineralizada',
        'Verificación de cable de alimentación, clavija e interruptor',
        'Verificación funcional de calentamiento y control de temperatura',
        'Verificación de temperatura con termómetro patrón',
        'Prueba de estabilidad y uniformidad térmica',
        'Verificación de drenaje, válvula o tapón',
        'Recomendación de mantenimiento correctivo / retiro de servicio'
      ]
    },


    'desfibrilador_primedic_xd330ey': {
      nombre: 'Desfibrilador PRIMEDIC XD330EY',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-DF-PR-XD330EY',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo se encuentre fuera de uso clínico, limpio, seco y ubicado en un área segura para prueba con analizador de desfibriladores.',
        'Confirme disponibilidad de analizador de desfibriladores calibrado, simulador ECG, carga de prueba de 50 Ω, gel conductor o medio de contacto compatible y elementos de bioseguridad.',
        'Antes de encender, verifique que las palas/electrodos se encuentren correctamente ubicados en sus soportes y que los cables no presenten daño visible.',
        'No realice descargas al aire ni hacia personas; toda descarga de prueba debe ejecutarse únicamente sobre analizador/carga de prueba autorizada.',
        'Evite el uso cerca de gases inflamables, sustancias explosivas o fuentes de interferencia electromagnética que puedan afectar el funcionamiento.',
        'No supere ciclos repetidos de descarga de alta energía durante el preventivo; permita periodos de enfriamiento si se realizan varias pruebas consecutivas.',
        'No abra cubiertas, fuente, módulo de alta tensión, batería interna ni tarjetas electrónicas. Toda intervención interna debe ser realizada por servicio técnico autorizado.',
        'Si se evidencian fallas de carga, error persistente, batería deficiente, cables dañados, palas deterioradas o energía fuera de tolerancia, retire de servicio y reporte mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'pxdi1', item: 'Carcasa, asa de transporte, base y cubiertas íntegras, sin golpes, grietas, deformaciones, partes sueltas ni signos de humedad' },
        { id: 'pxdi2', item: 'Panel frontal, pantalla/indicadores, teclas de selección de energía, carga, sincronía y descarga legibles y funcionales' },
        { id: 'pxdi3', item: 'Palas externas adulto APEX/STERNUM íntegras, limpias, sin corrosión, carbonización, fisuras ni pérdida de aislamiento' },
        { id: 'pxdi4', item: 'Electrodos pediátricos integrados o accesorios pediátricos disponibles, limpios y con mecanismo de acople seguro, si aplica' },
        { id: 'pxdi5', item: 'Cables de palas/electrodos sin cortes, torsión excesiva, aislamiento expuesto, endurecimiento, sulfatación ni falsos contactos' },
        { id: 'pxdi6', item: 'Conectores, puertos ECG, cable paciente y accesorios sin pines doblados, corrosión ni holgura' },
        { id: 'pxdi7', item: 'Cable de alimentación, clavija, cargador/base y fusible accesible en buen estado, sin calentamiento ni empalmes' },
        { id: 'pxdi8', item: 'Batería instalada sin deformación, fuga, sobrecalentamiento, sulfatación o mensajes de agotamiento al encender' },
        { id: 'pxdi9', item: 'Impresora/registrador, tapa, rodillo y papel térmico disponibles y en buen estado, si aplica al equipo instalado' },
        { id: 'pxdi10', item: 'Alarmas sonoras, indicadores luminosos y mensajes de advertencia visibles/audibles durante autoprueba' },
        { id: 'pxdi11', item: 'Etiquetas de identificación, activo fijo, número de serie, advertencias de alto voltaje y marcado de seguridad legibles' },
        { id: 'pxdi12', item: 'Gel conductor, parches, electrodos ECG y consumibles vigentes, íntegros y almacenados correctamente' },
        { id: 'pxdi13', item: 'Limpieza externa realizada con paño suave; sin ingreso de líquido al equipo, conectores, palas o compartimentos' },
        { id: 'pxdi14', item: 'Superficies de contacto de palas limpias y libres de restos de gel seco para evitar alta impedancia o arcos eléctricos' }
      ],
      verificacionBasica: [
        { id: 'pxdvb1', item: 'El equipo enciende correctamente y completa autoverificación sin errores técnicos persistentes' },
        { id: 'pxdvb2', item: 'El equipo funciona conectado a red eléctrica y mantiene operación en modo batería dentro de la revisión básica' },
        { id: 'pxdvb3', item: 'Indicadores de carga de batería y estado operativo responden de forma coherente' },
        { id: 'pxdvb4', item: 'El selector/teclas permiten elegir niveles de energía sin bloqueo ni respuesta errática' },
        { id: 'pxdvb5', item: 'La función de carga se inicia y el equipo informa energía lista mediante indicador visual/audible' },
        { id: 'pxdvb6', item: 'El equipo realiza descarga únicamente al accionar simultáneamente los controles requeridos sobre carga de prueba' },
        { id: 'pxdvb7', item: 'La función de sincronía muestra marcador o indicación sincronizada con señal ECG simulada, si aplica' },
        { id: 'pxdvb8', item: 'La impresión/registro de ECG o evento funciona correctamente, si aplica al equipo instalado' }
      ],
      pruebasFuncionales: [
        { id: 'pxdpf1', prueba: 'Encendido, autoprueba inicial y estado operativo', valorEsperado: 'Inicio normal, sin mensaje de error crítico y con indicador de equipo listo', resultado: ['Pasa', 'Falla'] },
        { id: 'pxdpf2', prueba: 'Verificación de señal ECG con simulador a 60 BPM', valorEsperado: 'Visualización estable de ECG y frecuencia 60 BPM ± 5 BPM', resultado: ['Pasa', 'Falla'] },
        { id: 'pxdpf3', prueba: 'Alarma/indicación de derivación o cable ECG desconectado', valorEsperado: 'Mensaje o alarma técnica visible/audible al desconectar el cable', resultado: ['Pasa', 'Falla'] },
        { id: 'pxdpf4', prueba: 'Carga y descarga en 50 J sobre analizador/carga 50 Ω', valorEsperado: 'Energía entregada dentro de ± 15% o tolerancia definida por el fabricante/analizador institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'pxdpf5', prueba: 'Carga y descarga en 100 J sobre analizador/carga 50 Ω', valorEsperado: 'Energía entregada dentro de ± 15% o tolerancia definida por el fabricante/analizador institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'pxdpf6', prueba: 'Carga y descarga en 200 J sobre analizador/carga 50 Ω', valorEsperado: 'Energía entregada dentro de ± 15% o tolerancia definida por el fabricante/analizador institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'pxdpf7', prueba: 'Carga máxima seleccionable y tiempo de carga con batería completamente cargada', valorEsperado: 'Alcanza energía máxima sin error; tiempo de carga coherente con especificación del equipo, idealmente ≤ 7 s cuando aplique a 360 J', resultado: ['Pasa', 'Falla'] },
        { id: 'pxdpf8', prueba: 'Descarga interna/cancelación de energía cargada sin descarga al analizador', valorEsperado: 'El equipo descarga internamente o cancela energía de forma segura sin error persistente', resultado: ['Pasa', 'Falla'] },
        { id: 'pxdpf9', prueba: 'Cardioversión sincronizada con simulador ECG, si aplica al modelo instalado', valorEsperado: 'Marcador SYNC presente y descarga sincronizada con complejo QRS según lectura del analizador', resultado: ['Aplica', 'N/A'] },
        { id: 'pxdpf10', prueba: 'Prueba de palas: botones de carga/descarga y contacto sobre analizador', valorEsperado: 'Botones responden, no hay falsos contactos, alta impedancia persistente ni arco eléctrico', resultado: ['Pasa', 'Falla'] },
        { id: 'pxdpf11', prueba: 'Prueba de batería durante operación breve sin red eléctrica', valorEsperado: 'Mantiene encendido, sin alarma crítica inmediata de batería ni apagado inesperado', resultado: ['Pasa', 'Falla'] },
        { id: 'pxdpf12', prueba: 'Impresión/registro de prueba o tira ECG, si aplica', valorEsperado: 'Registro legible, avance de papel normal y hora/evento coherente', resultado: ['Aplica', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, panel y accesorios',
        'Limpieza de palas y retiro de residuos de gel conductor',
        'Verificación de cable de alimentación, clavija y cargador',
        'Verificación de batería y funcionamiento en modo batería',
        'Verificación funcional con analizador de desfibriladores',
        'Verificación de ECG con simulador',
        'Prueba de carga, descarga y energía entregada',
        'Verificación de sincronía / cardioversión si aplica',
        'Verificación de impresión/registrador si aplica',
        'Recomendación de mantenimiento correctivo / retiro de servicio'
      ]
    },


    'mesa_quirurgica_mindray_hybase3000': {
      nombre: 'Mesa Quirúrgica Mindray HyBase 3000',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-MQ-HB3000',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que la mesa quirúrgica se encuentre fuera de uso clínico, sin paciente, limpia, seca y ubicada sobre superficie nivelada antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de equipos de verificación según alcance institucional: multímetro o analizador de seguridad eléctrica, nivel digital/inclinómetro, cinta métrica, cronómetro y elementos de limpieza compatibles.',
        'Desconecte la alimentación de red antes de inspecciones físicas externas; para pruebas funcionales conecte únicamente cuando sea necesario y siguiendo las medidas de seguridad eléctrica.',
        'No realice mantenimiento ni servicio con paciente sobre la mesa. No abra cubiertas internas, unidad hidráulica, tarjetas electrónicas, fuente, batería ni actuadores durante el preventivo rutinario.',
        'Antes de movilizar o probar movimientos, retire objetos de la cubierta, libere el área perimetral y asegure que no existan obstáculos que puedan generar atrapamiento, colisión o caída de accesorios.',
        'Utilice únicamente accesorios compatibles Mindray o accesorios institucionales autorizados; verifique que la carga total paciente/accesorios no exceda la capacidad permitida por el fabricante.',
        'No utilice agentes de limpieza o desinfección no compatibles con superficies, cojines o componentes eléctricos. Evite ingreso de líquidos a paneles, conectores, columna, base y mando.',
        'Si se evidencian fugas hidráulicas, falla de frenos, deriva de movimientos, alarmas, daño estructural, falla de batería o comportamiento no controlado, retire la mesa de servicio y genere mantenimiento correctivo especializado.'
      ],
      inspeccion: [
        { id: 'hb3000i1', item: 'Base, columna central y estructura metálica sin golpes severos, deformaciones, fisuras, corrosión, holguras anormales ni piezas sueltas' },
        { id: 'hb3000i2', item: 'Tablero superior, secciones de cabeza, espalda, asiento y piernas alineadas, estables y sin daño mecánico visible' },
        { id: 'hb3000i3', item: 'Colchonetas/cojines SFC o equivalentes íntegros, sin rasgaduras, perforaciones, pérdida de impermeabilidad, manchas persistentes ni deformación excesiva' },
        { id: 'hb3000i4', item: 'Rieles laterales para accesorios rectos, firmes, sin deformación, corrosión, bordes cortantes ni tornillería faltante' },
        { id: 'hb3000i5', item: 'Placa de cabeza: mecanismo de retiro/instalación, articulación y bloqueo funcionales, sin juego mecánico inseguro' },
        { id: 'hb3000i6', item: 'Placas de piernas: articulación, separación, retiro/instalación y seguros mecánicos funcionales' },
        { id: 'hb3000i7', item: 'Mando de control cableado: carcasa, botones, cable, conector, alivio de tensión e indicadores en buen estado' },
        { id: 'hb3000i8', item: 'Panel de control de respaldo en la base/columna: botones, indicadores y cubierta íntegros, legibles y sin humedad' },
        { id: 'hb3000i9', item: 'Cable de alimentación, clavija, punto de tierra y entrada eléctrica sin cortes, empalmes, sulfatación, calentamiento ni aislamiento expuesto' },
        { id: 'hb3000i10', item: 'Ruedas/castores y pedal o sistema de freno sin obstrucciones, desgaste excesivo, bloqueo irregular ni daño visible' },
        { id: 'hb3000i11', item: 'Sistema hidráulico externo sin evidencia de fuga de aceite, manchas, goteo, ruido anormal o descenso espontáneo' },
        { id: 'hb3000i12', item: 'Batería interna/indicadores de carga sin mensajes de falla, deformación, fuga, calentamiento o sulfatación visible' },
        { id: 'hb3000i13', item: 'Etiquetas de identificación, placa nominal, advertencias de seguridad, activo fijo y número de serie legibles y coincidentes con inventario' },
        { id: 'hb3000i14', item: 'Accesorios disponibles: soportes, apoyabrazos, cinturones, perneras, extensiones o abrazaderas en buen estado, si aplican al servicio' },
        { id: 'hb3000i15', item: 'Limpieza externa realizada en superficies, rieles, base, mando y cojines con método compatible, sin ingreso de líquido a componentes eléctricos' }
      ],
      verificacionBasica: [
        { id: 'hb3000vb1', item: 'La mesa enciende correctamente conectada a red eléctrica y no presenta alarmas, códigos de error ni movimientos inesperados' },
        { id: 'hb3000vb2', item: 'El indicador de batería/carga se visualiza correctamente; la mesa cambia a modo batería sin apagarse al desconectar AC' },
        { id: 'hb3000vb3', item: 'El mando cableado ejecuta comandos de forma individual, sin botones pegados, doble activación ni respuesta retardada anormal' },
        { id: 'hb3000vb4', item: 'El panel de control de respaldo opera funciones básicas si el mando cableado no se utiliza' },
        { id: 'hb3000vb5', item: 'El botón/parada de emergencia o función de detención detiene el movimiento de forma inmediata y segura según configuración del equipo' },
        { id: 'hb3000vb6', item: 'Los frenos/castores bloquean la mesa firmemente y permiten liberación controlada para desplazamiento cuando corresponde' },
        { id: 'hb3000vb7', item: 'La mesa retorna a posición cero o posición horizontal/central según función disponible, sin desviaciones evidentes' },
        { id: 'hb3000vb8', item: 'No se observan fugas hidráulicas, descenso espontáneo, deriva de inclinación ni pérdida de posición durante la revisión estática' },
        { id: 'hb3000vb9', item: 'Las secciones de cabeza y piernas se instalan, retiran y bloquean correctamente; no se liberan accidentalmente durante la manipulación' },
        { id: 'hb3000vb10', item: 'Los movimientos se realizan sin ruidos anormales, vibración excesiva, tirones, bloqueos o golpes de fin de carrera' }
      ],
      pruebasFuncionales: [
        { id: 'hb3000pf1', prueba: 'Encendido general y autoverificación inicial conectada a red eléctrica', valorEsperado: 'Inicio normal, indicadores activos y sin alarma/código de falla persistente', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf2', prueba: 'Elevación y descenso de la mesa desde el mando cableado', valorEsperado: 'Movimiento uniforme, controlado, sin ruidos anormales, sin atasco y con detención al soltar el comando', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf3', prueba: 'Trendelenburg y Trendelenburg inverso con nivel/inclinómetro', valorEsperado: 'Inclinación progresiva y estable; conserva posición sin deriva evidente durante mínimo 60 s', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf4', prueba: 'Inclinación lateral izquierda y derecha con nivel/inclinómetro', valorEsperado: 'Movimiento simétrico, estable y sin pérdida de posición; retorna a horizontal sin error', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf5', prueba: 'Movimiento de placa de espalda arriba/abajo', valorEsperado: 'Articulación suave, sin bloqueo mecánico, sin caída espontánea y con bloqueo estable', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf6', prueba: 'Movimiento de placa de piernas arriba/abajo y separación/retiro si aplica', valorEsperado: 'Permite posicionamiento normal y seguros mecánicos mantienen fijación', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf7', prueba: 'Movimiento/ajuste de placa de cabeza', valorEsperado: 'Permite ajuste, instalación/retiro y bloqueo seguro sin juego excesivo', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf8', prueba: 'Desplazamiento longitudinal del tablero, si el modelo instalado dispone de esta función', valorEsperado: 'Desplazamiento controlado, sin atasco, con retorno a posición central y bloqueo estable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hb3000pf9', prueba: 'Función de posición cero / nivelación automática, si aplica', valorEsperado: 'La mesa retorna a posición horizontal/central sin error y con alineación visual aceptable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hb3000pf10', prueba: 'Prueba de frenos/castors sobre superficie nivelada', valorEsperado: 'Bloqueo firme sin desplazamiento no deseado; liberación permite movilidad controlada', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf11', prueba: 'Prueba de panel de control de respaldo', valorEsperado: 'Ejecuta funciones básicas disponibles cuando se opera desde la base/columna', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf12', prueba: 'Prueba de parada/detención de emergencia durante movimiento lento controlado', valorEsperado: 'El movimiento se detiene inmediatamente sin continuar desplazamiento', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf13', prueba: 'Funcionamiento en modo batería con movimientos básicos', valorEsperado: 'Opera al menos elevación/descenso e inclinación breve sin apagado ni alarma crítica inmediata', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf14', prueba: 'Verificación de carga de batería al conectar red eléctrica', valorEsperado: 'Indicador de carga activo y coherente; no aparece falla de batería/cargador', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf15', prueba: 'Estabilidad estática en posición horizontal y en inclinación moderada sin carga clínica', valorEsperado: 'Mantiene posición mínimo 2 minutos sin descenso, deriva o vibración anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'hb3000pf16', prueba: 'Revisión de accesorios instalados en riel lateral', valorEsperado: 'Accesorios fijan correctamente, sin deslizamiento ni liberación accidental', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hb3000pf17', prueba: 'Prueba de seguridad eléctrica externa con analizador, si está disponible dentro del alcance institucional', valorEsperado: 'Resistencia de tierra, fuga y polaridad dentro de límites institucionales/norma aplicable; registrar valores', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'hb3000pf18', prueba: 'Verificación posterior a limpieza/desinfección', valorEsperado: 'Superficies secas, sin residuos químicos, sin humedad en mando, conectores, base o columna', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de base, columna, tablero, rieles, mando y accesorios',
        'Desinfección de superficies y cojines compatibles con política institucional',
        'Verificación de estructura, rieles, seguros mecánicos y accesorios',
        'Verificación funcional de movimientos electrohidráulicos',
        'Verificación de frenos/castors y estabilidad de posición',
        'Verificación de mando cableado y panel de respaldo',
        'Verificación de batería, cargador y operación en modo batería',
        'Prueba de seguridad eléctrica externa si se dispone del analizador',
        'Recomendación de cambio de accesorios/cojines deteriorados',
        'Recomendación de mantenimiento correctivo especializado o retiro de servicio'
      ]
    },

    'balanza_seca_874': {
      nombre: 'Balanza SECA 874',
      categoria: 'Biomédico / Antropometría',
      codigo: 'SLV-GAT-BIO-BAL-SECA874',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que la balanza se encuentre fuera de uso asistencial, limpia, seca y ubicada sobre una superficie plana, estable, rígida y nivelada.',
        'Confirme disponibilidad de masas patrón calibradas o pesas certificadas dentro del rango de verificación institucional, preferiblemente con puntos de carga baja, media y alta.',
        'Revise que el equipo corresponda al activo institucional, con placa, serial y etiquetas legibles antes de iniciar el mantenimiento preventivo.',
        'Retire objetos, líquidos o elementos que puedan interferir con la plataforma de pesaje. No arrastre la balanza ni la someta a golpes durante la revisión.',
        'Utilice baterías del tipo recomendado por el fabricante; no mezcle baterías nuevas y usadas ni baterías de diferente tipo.',
        'No abra la carcasa, no manipule celdas de carga, tarjetas electrónicas, sellos metrológicos ni parámetros internos durante el mantenimiento preventivo rutinario.',
        'La calibración interna, ajuste metrológico, reparación de celdas de carga o intervención electrónica debe ser realizada por personal autorizado o proveedor especializado.',
        'Si se evidencia lectura inestable, error de cero, desviación fuera de tolerancia, daño estructural, humedad interna o mensajes de error persistentes, retire el equipo de servicio y genere mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'seca874i1', item: 'Plataforma de pesaje íntegra, estable, limpia, sin grietas, deformaciones, corrosión, superficies cortantes ni daño visible' },
        { id: 'seca874i2', item: 'Cubierta antideslizante o superficie superior en buen estado, sin desprendimientos, desgaste excesivo, humedad o residuos que alteren la medición' },
        { id: 'seca874i3', item: 'Base inferior y puntos de apoyo sin fisuras, desnivel, piezas sueltas, tornillería faltante ni contacto irregular con el piso' },
        { id: 'seca874i4', item: 'Display doble/indicador visible para usuario y paciente, sin segmentos apagados, manchas, humedad interna ni daño en mica protectora' },
        { id: 'seca874i5', item: 'Teclas ON/OFF, HOLD, 2 in 1/TARE o funciones disponibles: legibles, firmes y sin atascamiento' },
        { id: 'seca874i6', item: 'Compartimento de baterías limpio, seco, sin sulfatación, corrosión, resortes flojos, tapas quebradas ni contacto eléctrico deficiente' },
        { id: 'seca874i7', item: 'Baterías instaladas en buen estado, sin fuga, deformación, calentamiento ni fecha de vencimiento superada' },
        { id: 'seca874i8', item: 'Etiqueta de identificación institucional, número de serie, placa nominal, capacidad máxima y advertencias de seguridad legibles' },
        { id: 'seca874i9', item: 'Celdas de carga y zona inferior sin golpes, humedad, polvo excesivo, cuerpos extraños o signos de manipulación no autorizada' },
        { id: 'seca874i10', item: 'Pies de apoyo o apoyos antideslizantes completos, nivelados, sin desgaste excesivo y con contacto uniforme con el piso' },
        { id: 'seca874i11', item: 'Limpieza externa realizada con paño suave ligeramente humedecido y desinfectante compatible; sin ingreso de líquido al display o compartimento de baterías' },
        { id: 'seca874i12', item: 'Condiciones del área de uso: superficie firme, sin vibraciones, humedad excesiva, inclinación o interferencias que afecten la lectura' }
      ],
      verificacionBasica: [
        { id: 'seca874vb1', item: 'La balanza enciende correctamente y realiza prueba de segmentos/display sin códigos de error persistentes' },
        { id: 'seca874vb2', item: 'Con la plataforma libre de carga, la lectura retorna a 0.0 kg o cero estable después del encendido' },
        { id: 'seca874vb3', item: 'El indicador de batería no muestra batería baja durante la verificación; reemplazar baterías si aparece advertencia' },
        { id: 'seca874vb4', item: 'La lectura se estabiliza en menos de 5 segundos con una masa de prueba colocada al centro de la plataforma' },
        { id: 'seca874vb5', item: 'La función HOLD mantiene el resultado visible de forma estable hasta la siguiente operación o apagado, según diseño del equipo' },
        { id: 'seca874vb6', item: 'La función 2 in 1/TARE descuenta correctamente el peso inicial del adulto u objeto patrón y muestra NET/0.0 según corresponda' },
        { id: 'seca874vb7', item: 'El apagado automático o manual funciona sin bloqueo de teclas ni reinicios inesperados' },
        { id: 'seca874vb8', item: 'No se presentan lecturas fluctuantes, deriva de cero, saltos abruptos o mensajes de sobrecarga durante la prueba básica' }
      ],
      pruebasFuncionales: [
        { id: 'seca874pf1', prueba: 'Prueba de cero inicial — Plataforma sin carga después del encendido', valorEsperado: 'Lectura 0.0 kg estable, sin deriva ni error de inicialización', resultado: ['Pasa', 'Falla'] },
        { id: 'seca874pf2', prueba: 'Prueba de repetibilidad — Colocar masa patrón de 20 kg en el centro, retirar y repetir 3 veces', valorEsperado: 'Lecturas repetibles dentro de la tolerancia institucional/metrológica definida', resultado: ['Pasa', 'Falla'] },
        { id: 'seca874pf3', prueba: 'Prueba de excentricidad — Colocar masa patrón de 20 kg en cuatro esquinas y centro', valorEsperado: 'Diferencias entre posiciones dentro de la tolerancia definida; sin lectura inestable', resultado: ['Pasa', 'Falla'] },
        { id: 'seca874pf4', prueba: 'Verificación punto bajo — Masa patrón 10 kg o equivalente disponible', valorEsperado: 'Lectura conforme a masa aplicada dentro de tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'seca874pf5', prueba: 'Verificación punto medio — Masa patrón 50 kg o combinación equivalente', valorEsperado: 'Lectura conforme a masa aplicada dentro de tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'seca874pf6', prueba: 'Verificación punto alto — Masa patrón 100 kg o combinación equivalente sin exceder capacidad', valorEsperado: 'Lectura conforme a masa aplicada dentro de tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'seca874pf7', prueba: 'Linealidad ascendente — Aplicar cargas sucesivas baja/media/alta registrando cada lectura', valorEsperado: 'Comportamiento progresivo y coherente, sin saltos, bloqueo o error de lectura', resultado: ['Pasa', 'Falla'] },
        { id: 'seca874pf8', prueba: 'Linealidad descendente — Retirar cargas sucesivamente hasta cero', valorEsperado: 'Lecturas disminuyen de forma coherente y retornan a 0.0 kg estable al finalizar', resultado: ['Pasa', 'Falla'] },
        { id: 'seca874pf9', prueba: 'Función HOLD — Aplicar masa estable y activar HOLD', valorEsperado: 'El valor queda retenido en pantalla sin variación no justificada', resultado: ['Pasa', 'Falla'] },
        { id: 'seca874pf10', prueba: 'Función 2 in 1/TARE — Registrar peso inicial y aplicar peso adicional conocido', valorEsperado: 'Muestra peso neto/adicional de forma coherente con la masa añadida', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'seca874pf11', prueba: 'Prueba de estabilidad — Mantener masa patrón al centro durante 60 segundos', valorEsperado: 'Lectura estable, sin deriva progresiva ni fluctuación anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'seca874pf12', prueba: 'Prueba de sobrecarga operativa segura — Verificar respuesta sin exceder capacidad máxima indicada en placa', valorEsperado: 'No se generan errores bajo carga permitida; nunca exceder capacidad máxima del fabricante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'seca874pf13', prueba: 'Apagado automático o manual posterior a la medición', valorEsperado: 'Equipo apaga correctamente y conserva funcionamiento normal al volver a encender', resultado: ['Pasa', 'Falla'] },
        { id: 'seca874pf14', prueba: 'Verificación posterior a limpieza/desinfección', valorEsperado: 'Equipo seco, sin residuos químicos, sin humedad en display, teclas o compartimento de baterías', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de plataforma, display, base y puntos de apoyo',
        'Desinfección superficial con producto compatible según protocolo institucional',
        'Verificación de compartimento de baterías y contactos eléctricos',
        'Cambio de baterías',
        'Verificación de cero, repetibilidad, excentricidad, linealidad y estabilidad con masas patrón',
        'Verificación de funciones HOLD y 2 in 1/TARE',
        'Revisión de etiquetas, placa nominal, serial y activo fijo',
        'Registro de desviaciones metrológicas y recomendación de calibración externa si aplica',
        'Recomendación de retiro de servicio por daño físico, lectura inestable o desviación fuera de tolerancia',
        'Remisión a servicio técnico autorizado SECA o proveedor metrológico especializado'
      ]
    },


    'electrocardiografo_edan_se1201': {
      nombre: 'Electrocardiógrafo (ECG) EDAN SE-1201',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-ECG-EDAN-SE1201',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el electrocardiógrafo se encuentre fuera de uso clínico, limpio, desconectado del paciente y ubicado sobre superficie estable antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de simulador de ECG calibrado de 12 derivaciones o simulador multiparámetro equivalente para verificación de frecuencia cardíaca, amplitud y trazado.',
        'Utilice papel térmico compatible con EDAN SE-1201, cable paciente, electrodos y cable de alimentación en buen estado.',
        'Antes de las pruebas funcionales, conecte el equipo a red eléctrica y permita la inicialización completa; verifique fecha, hora, filtros y configuración básica de impresión.',
        'No abra la carcasa, fuente de alimentación, batería interna, impresora, tarjetas electrónicas ni módulos internos durante el mantenimiento preventivo rutinario.',
        'La calibración interna, reparación electrónica, actualización de software o cambio de componentes internos debe ser realizada por personal autorizado o servicio técnico especializado.',
        'No conecte el equipo a pacientes durante las pruebas con simulador; no realice pruebas en presencia de líquidos, gases inflamables o accesorios húmedos.',
        'Si se presentan mensajes de error persistentes, falla de impresión, desviación de señal, batería defectuosa, cable paciente deteriorado o interrupciones eléctricas, retire el equipo de servicio y genere mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'edan1201i1', item: 'Carcasa superior, inferior y laterales sin grietas, golpes, deformaciones, corrosión ni piezas sueltas' },
        { id: 'edan1201i2', item: 'Pantalla LCD/visualizador limpio, sin manchas, pixeles muertos, pérdida de contraste ni daño físico visible' },
        { id: 'edan1201i3', item: 'Teclado, teclas de función, selector/menús y botones START/STOP/PRINT con respuesta adecuada y sin atascamiento' },
        { id: 'edan1201i4', item: 'Impresora térmica, tapa, rodillo y mecanismo de arrastre sin obstrucciones, residuos de papel, desgaste o daño visible' },
        { id: 'edan1201i5', item: 'Papel térmico instalado correctamente, compatible, sin humedad, arrugas, decoloración o atasco en el recorrido' },
        { id: 'edan1201i6', item: 'Cable de alimentación AC, clavija, conector y alivio de tensión sin cortes, peladuras, corrosión o calentamiento anormal' },
        { id: 'edan1201i7', item: 'Batería interna sin signos de deformación, fuga, sobrecalentamiento o alarma de batería persistente; indicador de carga visible' },
        { id: 'edan1201i8', item: 'Cable paciente de 10 hilos/12 derivaciones íntegro, sin cortes, dobleces severos, pines flojos, conectores sulfatados o aislamiento deteriorado' },
        { id: 'edan1201i9', item: 'Pinzas, chupones, electrodos reutilizables o adaptadores limpios, completos, sin corrosión y con contacto firme' },
        { id: 'edan1201i10', item: 'Puerto del cable paciente y conectores auxiliares sin pines doblados, cuerpos extraños, humedad o daño mecánico' },
        { id: 'edan1201i11', item: 'Puertos USB/Ethernet/SD o interfaces disponibles sin daño, suciedad, obstrucción ni holgura anormal' },
        { id: 'edan1201i12', item: 'Etiquetas de seguridad, placa nominal, número de serie, activo fijo y advertencias legibles y coincidentes con inventario' },
        { id: 'edan1201i13', item: 'Pies de apoyo, base y cubierta inferior estables, completos, antideslizantes y sin vibración durante la impresión' },
        { id: 'edan1201i14', item: 'Limpieza externa realizada con paño suave y desinfectante compatible; sin ingreso de líquido por teclado, impresora o conectores' },
        { id: 'edan1201i15', item: 'Accesorios almacenados ordenadamente, secos y protegidos para evitar tracción, dobleces o contaminación cruzada' }
      ],
      verificacionBasica: [
        { id: 'edan1201vb1', item: 'El equipo enciende correctamente en alimentación AC y completa autoverificación sin mensajes de error persistentes' },
        { id: 'edan1201vb2', item: 'El equipo opera en modo batería al desconectar AC, sin apagado súbito ni reinicio inesperado' },
        { id: 'edan1201vb3', item: 'Indicador de carga/batería funciona y no muestra advertencia de batería baja con carga adecuada' },
        { id: 'edan1201vb4', item: 'Fecha, hora, idioma, velocidad de papel, ganancia, filtros y formato de reporte se encuentran configurados correctamente' },
        { id: 'edan1201vb5', item: 'El teclado permite navegar menús, ingresar datos de paciente, seleccionar modo de trabajo e iniciar/detener impresión' },
        { id: 'edan1201vb6', item: 'El sistema detecta derivación desconectada al retirar un electrodo o conector del simulador' },
        { id: 'edan1201vb7', item: 'La impresora alimenta el papel de forma uniforme, sin arrastre irregular, ruido excesivo o atasco' },
        { id: 'edan1201vb8', item: 'La impresión térmica es legible, uniforme, sin líneas perdidas, zonas blancas, manchas o baja densidad' },
        { id: 'edan1201vb9', item: 'Memoria/gestor de archivos permite guardar, visualizar e imprimir un registro de prueba, si la configuración institucional lo utiliza' },
        { id: 'edan1201vb10', item: 'Conectividad USB/Ethernet o exportación de reportes funciona si aplica al servicio; verificar sin comprometer datos de pacientes reales' }
      ],
      pruebasFuncionales: [
        { id: 'edan1201pf1', prueba: 'ECG 12 derivaciones — Conectar simulador ECG a cable paciente completo', valorEsperado: 'Las 12 derivaciones se muestran/registran sin ruido excesivo ni derivaciones ausentes', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf2', prueba: 'Frecuencia cardíaca — Simular ritmo sinusal 60 lpm', valorEsperado: 'Lectura de FC 60 lpm ± 1 lpm y trazado estable', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf3', prueba: 'Frecuencia cardíaca — Simular ritmo sinusal 80 lpm', valorEsperado: 'Lectura de FC 80 lpm ± 1 lpm y trazado estable', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf4', prueba: 'Frecuencia cardíaca — Simular taquicardia 120 lpm', valorEsperado: 'Lectura de FC 120 lpm ± 2 lpm y reporte coherente', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf5', prueba: 'Amplitud ECG — Señal patrón 1 mV en derivación II', valorEsperado: 'Amplitud impresa/visualizada 10 mm a ganancia 10 mm/mV ± tolerancia institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf6', prueba: 'Ganancia — Cambiar 5, 10 y 20 mm/mV con simulador estable', valorEsperado: 'El trazado cambia proporcionalmente y el valor aparece correctamente en el reporte', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf7', prueba: 'Velocidad de papel — Imprimir a 25 mm/s', valorEsperado: 'Impresión con escala temporal correcta y velocidad indicada en reporte', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf8', prueba: 'Velocidad de papel — Imprimir a 50 mm/s', valorEsperado: 'Impresión con escala temporal correcta y velocidad indicada en reporte', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf9', prueba: 'Modo Auto — Registro automático de 12 derivaciones', valorEsperado: 'Genera reporte completo con datos, mediciones y trazos según configuración seleccionada', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf10', prueba: 'Modo Manual — Registro manual de derivaciones', valorEsperado: 'Permite iniciar/detener impresión manual sin bloqueo ni pérdida de señal', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf11', prueba: 'Modo Rhythm/Ritmo — Registro prolongado de derivación seleccionada', valorEsperado: 'Imprime ritmo continuo estable durante el intervalo definido', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf12', prueba: 'Modo R-R Analysis — Activar análisis R-R con simulador estable', valorEsperado: 'Inicia adquisición/análisis y genera reporte sin errores, si la función está habilitada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edan1201pf13', prueba: 'Filtro de línea AC — Activar/desactivar filtro 50/60 Hz según red local', valorEsperado: 'Reduce interferencia de línea sin deformar de forma anormal el complejo QRS', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf14', prueba: 'Filtro muscular / pasa bajo — Verificar efecto sobre señal simulada con ruido', valorEsperado: 'Disminuye ruido de alta frecuencia manteniendo trazado clínicamente legible', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edan1201pf15', prueba: 'Detección de derivación desconectada — Retirar RA/LA/LL y una precordial', valorEsperado: 'Mensaje o indicador de lead off correspondiente, sin lectura falsa como normal', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf16', prueba: 'Detección de marcapasos — Simular señal con pulso de marcapasos si el simulador lo permite', valorEsperado: 'Reporte/trazado reconoce o representa pulsos de marcapasos según configuración del equipo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edan1201pf17', prueba: 'Impresión de reporte guardado — Guardar ECG de prueba y reimprimir desde gestor de archivos', valorEsperado: 'Archivo se recupera e imprime completo sin corrupción de datos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edan1201pf18', prueba: 'Exportación/transferencia — Enviar o copiar reporte PDF/SCP/XML si el servicio usa esta función', valorEsperado: 'Transferencia exitosa sin errores y archivo legible en estación destino', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'edan1201pf19', prueba: 'Prueba de batería operativa — Desconectar AC durante adquisición o impresión corta', valorEsperado: 'Equipo mantiene operación sin reinicio; registra estado de batería adecuado', resultado: ['Pasa', 'Falla'] },
        { id: 'edan1201pf20', prueba: 'Seguridad eléctrica externa — Medición con analizador de seguridad eléctrica si está disponible', valorEsperado: 'Corriente de fuga, tierra y aislamiento dentro de límites IEC 60601/institucionales', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, pantalla, teclado y superficies de apoyo',
        'Limpieza de impresora térmica, rodillo y compartimento de papel',
        'Verificación de cable paciente, pinzas, chupones, electrodos y conectores',
        'Cambio o reposición de papel térmico compatible',
        'Verificación de encendido, batería, cargador y cable de alimentación',
        'Verificación funcional con simulador ECG de 12 derivaciones',
        'Pruebas de frecuencia cardíaca, amplitud, ganancia, velocidad e impresión',
        'Verificación de modos Auto, Manual, Ritmo y R-R si aplica',
        'Verificación de filtros, detección de derivación desconectada y calidad de trazado',
        'Verificación de memoria, reimpresión y transferencia de reportes si aplica',
        'Recomendación de cambio de cable paciente/accesorios por deterioro',
        'Remisión a servicio técnico autorizado EDAN o proveedor especializado'
      ]
    },

    'electrocardiografo_mindray_beneheart_r12': {
      nombre: 'Electrocardiógrafo MINDRAY BeneHeart R12',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-ECG-MR-R12',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el electrocardiógrafo se encuentre fuera de uso clínico, desconectado del paciente, limpio y ubicado sobre una superficie estable antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de simulador de ECG calibrado de 12 derivaciones o simulador multiparámetro equivalente para validar frecuencia cardíaca, amplitud, derivaciones y calidad del trazado.',
        'Utilice cable paciente, electrodos/pinzas, papel térmico compatible, batería y cable de alimentación en buen estado antes de ejecutar las pruebas.',
        'Antes de iniciar las pruebas funcionales, permita el encendido completo del equipo y revise configuración de fecha, hora, institución, ganancia, velocidad de papel, filtros y formato del reporte.',
        'No abra la carcasa, fuente de alimentación, batería, impresora, tarjetas electrónicas ni módulos internos durante el mantenimiento preventivo rutinario.',
        'Las intervenciones internas, calibración avanzada, actualización de software, cambio de tarjeta, reparación de impresora o reparación del sistema de alimentación deben ser realizadas por personal autorizado.',
        'No conecte el equipo a pacientes durante las pruebas con simulador; evite realizar pruebas en presencia de líquidos, accesorios húmedos, atmósferas inflamables o cables deteriorados.',
        'Si se evidencian mensajes de error persistentes, fallas de impresión, batería defectuosa, señal ECG inestable, cable paciente deteriorado, pérdida de datos o falla eléctrica, retire el equipo de servicio y genere mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'r12i1', item: 'Carcasa superior, inferior y laterales sin grietas, golpes, deformaciones, corrosión, partes sueltas ni evidencia de ingreso de líquidos' },
        { id: 'r12i2', item: 'Pantalla LCD limpia, legible, sin manchas, pixeles muertos, pérdida de contraste, líneas permanentes ni daño físico visible' },
        { id: 'r12i3', item: 'Teclado, teclas de función, perilla/selector, botones de navegación, botón de encendido y teclas rápidas con respuesta adecuada' },
        { id: 'r12i4', item: 'Impresora térmica, tapa, rodillo, cortador/peine y mecanismo de arrastre sin residuos de papel, polvo, desgaste o daño visible' },
        { id: 'r12i5', item: 'Papel térmico instalado correctamente, compatible, seco, sin arrugas, humedad, decoloración o atasco en el recorrido de impresión' },
        { id: 'r12i6', item: 'Cable de alimentación AC, adaptador/cargador, clavija, conector y alivio de tensión sin cortes, peladuras, corrosión o calentamiento anormal' },
        { id: 'r12i7', item: 'Batería interna sin signos de deformación, fuga, sobrecalentamiento, sulfatación, alerta persistente o autonomía evidentemente reducida' },
        { id: 'r12i8', item: 'Cable paciente de 10 hilos/12 derivaciones íntegro, sin cortes, dobleces severos, pines flojos, conectores sulfatados o aislamiento deteriorado' },
        { id: 'r12i9', item: 'Pinzas, chupones, electrodos reutilizables o adaptadores completos, limpios, sin corrosión y con contacto firme' },
        { id: 'r12i10', item: 'Puerto de cable paciente y conectores auxiliares sin pines doblados, cuerpos extraños, humedad, holgura anormal o daño mecánico' },
        { id: 'r12i11', item: 'Puertos USB, red, lector, memoria externa o interfaces disponibles sin daño, suciedad, obstrucción ni holgura anormal' },
        { id: 'r12i12', item: 'Etiquetas de seguridad, placa nominal, número de serie, activo fijo, advertencias y marcación de fabricante legibles y coincidentes con inventario' },
        { id: 'r12i13', item: 'Pies de apoyo, base, manija y cubierta inferior estables, completos, antideslizantes y sin vibración durante la impresión' },
        { id: 'r12i14', item: 'Accesorios almacenados ordenadamente, secos y protegidos para evitar tracción, dobleces, contaminación cruzada o daño de conectores' },
        { id: 'r12i15', item: 'Limpieza externa realizada con paño suave y desinfectante compatible; sin ingreso de líquido por teclado, impresora, ranuras o conectores' }
      ],
      verificacionBasica: [
        { id: 'r12vb1', item: 'El equipo enciende correctamente con alimentación AC y completa autoverificación sin mensajes de error persistentes' },
        { id: 'r12vb2', item: 'El equipo opera en modo batería al desconectar AC, sin apagado súbito, reinicio inesperado ni pérdida de configuración' },
        { id: 'r12vb3', item: 'Indicador de carga/batería funciona correctamente y no muestra alarma de batería baja con carga adecuada' },
        { id: 'r12vb4', item: 'Fecha, hora, idioma, institución/servicio, ID de equipo, ganancia, velocidad, filtros y formato de reporte están configurados correctamente' },
        { id: 'r12vb5', item: 'Pantalla, menús y navegación permiten ingreso de datos del paciente, selección de modo y revisión de registros de prueba' },
        { id: 'r12vb6', item: 'El sistema detecta derivación desconectada al retirar un electrodo o terminal del simulador ECG' },
        { id: 'r12vb7', item: 'La impresora térmica alimenta el papel de forma uniforme, sin atascos, arrastre irregular, ruido excesivo o zonas sin impresión' },
        { id: 'r12vb8', item: 'La impresión del trazado y del reporte es legible, uniforme, con cuadrícula/escala visible y sin líneas perdidas o manchas' },
        { id: 'r12vb9', item: 'La memoria permite guardar, consultar, reimprimir o eliminar un registro de prueba, si esta función se usa institucionalmente' },
        { id: 'r12vb10', item: 'La exportación/transferencia por USB, red o sistema de información funciona si aplica al servicio, sin utilizar datos reales de pacientes' },
        { id: 'r12vb11', item: 'Las alarmas o mensajes técnicos visuales/sonoros se presentan de forma coherente ante batería baja, papel agotado o derivación desconectada' },
        { id: 'r12vb12', item: 'La limpieza posterior no deja humedad en teclado, impresora, ranuras, conectores, cable paciente ni accesorios' }
      ],
      pruebasFuncionales: [
        { id: 'r12pf1', prueba: 'ECG 12 derivaciones — Conectar simulador ECG al cable paciente completo', valorEsperado: 'Las 12 derivaciones se visualizan/registran sin ruido excesivo, inversión evidente o derivaciones ausentes', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf2', prueba: 'Frecuencia cardíaca — Simular ritmo sinusal 60 lpm', valorEsperado: 'Lectura de FC 60 lpm ± 1 lpm y trazado estable', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf3', prueba: 'Frecuencia cardíaca — Simular ritmo sinusal 80 lpm', valorEsperado: 'Lectura de FC 80 lpm ± 1 lpm y trazado estable', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf4', prueba: 'Frecuencia cardíaca — Simular taquicardia 120 lpm', valorEsperado: 'Lectura de FC 120 lpm ± 2 lpm y reporte coherente', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf5', prueba: 'Amplitud ECG — Señal patrón 1 mV en derivación II', valorEsperado: 'Amplitud impresa/visualizada 10 mm a ganancia 10 mm/mV ± tolerancia institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf6', prueba: 'Ganancia — Cambiar 5, 10 y 20 mm/mV con simulador estable', valorEsperado: 'El trazado cambia proporcionalmente y el valor queda registrado correctamente en pantalla/reporte', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf7', prueba: 'Velocidad de papel — Imprimir/adquirir a 25 mm/s', valorEsperado: 'Escala temporal correcta, trazado estable y velocidad indicada en el reporte', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf8', prueba: 'Velocidad de papel — Imprimir/adquirir a 50 mm/s', valorEsperado: 'Escala temporal correcta, trazado estable y velocidad indicada en el reporte', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf9', prueba: 'Modo Auto — Adquisición automática de ECG de 12 derivaciones', valorEsperado: 'Genera reporte completo con trazos, mediciones y datos configurados sin interrupción', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf10', prueba: 'Modo Manual — Registro manual de derivaciones', valorEsperado: 'Permite iniciar/detener impresión manual sin bloqueo, pérdida de señal ni reinicio', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf11', prueba: 'Modo Rhythm/Ritmo — Registro prolongado de derivación seleccionada', valorEsperado: 'Imprime o registra ritmo continuo estable durante el intervalo definido', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf12', prueba: 'Previsualización y congelamiento/revisión de ECG si aplica', valorEsperado: 'Permite revisar el trazado antes de imprimir/guardar sin pérdida de datos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r12pf13', prueba: 'Algoritmo de medición/interpretación — Generar reporte con señal simulada normal', valorEsperado: 'Muestra mediciones básicas y texto/resultado interpretativo si la licencia/configuración lo permite', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r12pf14', prueba: 'Filtro de línea AC — Activar filtro 50/60 Hz según red local', valorEsperado: 'Reduce interferencia de línea sin deformar anormalmente el complejo QRS', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf15', prueba: 'Filtro muscular / pasa bajo — Verificar efecto sobre señal simulada con ruido', valorEsperado: 'Disminuye ruido de alta frecuencia manteniendo trazado clínicamente legible', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r12pf16', prueba: 'Detección de derivación desconectada — Retirar RA/LA/LL y una precordial', valorEsperado: 'Mensaje o indicador de lead off correspondiente, sin registrar derivación como normal', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf17', prueba: 'Detección de marcapasos — Simular señal con pulso de marcapasos si el simulador lo permite', valorEsperado: 'El trazado representa o identifica pulsos de marcapasos según configuración del equipo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r12pf18', prueba: 'Impresión de reporte guardado — Guardar ECG de prueba y reimprimir desde memoria', valorEsperado: 'Archivo se recupera e imprime completo, legible y sin corrupción de datos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r12pf19', prueba: 'Exportación/transferencia — Copiar o enviar reporte PDF/XML/SCP si el servicio usa esta función', valorEsperado: 'Transferencia exitosa y archivo legible en estación destino o medio externo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r12pf20', prueba: 'Prueba de impresora — Impresión continua corta con simulador activo', valorEsperado: 'Arrastre uniforme del papel, densidad adecuada, sin atascos ni líneas omitidas', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf21', prueba: 'Prueba de batería operativa — Desconectar AC durante adquisición o impresión corta', valorEsperado: 'Equipo mantiene operación sin reinicio y registra estado de batería adecuado', resultado: ['Pasa', 'Falla'] },
        { id: 'r12pf22', prueba: 'Seguridad eléctrica externa — Medición con analizador de seguridad eléctrica si está disponible', valorEsperado: 'Corriente de fuga, tierra y aislamiento dentro de límites IEC 60601/institucionales', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, pantalla, teclado y superficies de apoyo',
        'Limpieza de impresora térmica, rodillo y compartimento de papel',
        'Verificación de cable paciente, pinzas, chupones, electrodos y conectores',
        'Cambio o reposición de papel térmico compatible',
        'Verificación de encendido, batería, cargador y cable de alimentación',
        'Verificación funcional con simulador ECG de 12 derivaciones',
        'Pruebas de frecuencia cardíaca, amplitud, ganancia, velocidad e impresión',
        'Verificación de modos Auto, Manual, Ritmo y funciones de revisión si aplica',
        'Verificación de filtros, detección de derivación desconectada, marcapasos y calidad de trazado',
        'Verificación de memoria, reimpresión, exportación y transferencia de reportes si aplica',
        'Recomendación de cambio de cable paciente/accesorios por deterioro',
        'Remisión a servicio técnico autorizado Mindray o proveedor especializado'
      ]
    },


    'doppler_fetal_portatil_edan_sonotrax_iipro': {
      nombre: 'Doppler Fetal Portátil EDAN SonoTrax II Pro',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-DFP-EDAN-STIIPRO',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el Doppler fetal se encuentre fuera de uso clínico, limpio, seco y sin contacto con paciente antes de iniciar el mantenimiento preventivo.',
        'Confirme disponibilidad de simulador de frecuencia cardíaca fetal, simulador Doppler fetal, phantom acústico o método institucional equivalente para validar lectura de FCF sin uso en paciente.',
        'Utilice gel conductor compatible, paño suave, desinfectante aprobado por la institución y accesorios originales o compatibles en buen estado.',
        'Revise que la batería recargable de polímero de litio/cargador del modelo SonoTrax II Pro se encuentre en condición segura antes de las pruebas de autonomía y carga.',
        'No sumerja la unidad principal ni permita ingreso de líquidos por altavoz, pantalla, conectores, compartimiento de batería o puerto de carga; la sonda debe limpiarse según recomendación del fabricante.',
        'No abra la carcasa, transductor, batería, cargador ni tarjetas internas durante el mantenimiento preventivo rutinario.',
        'Las reparaciones internas, cambio de transductor, ajuste electrónico, sustitución de batería integrada o reparación de circuito deben ser realizadas por personal autorizado EDAN o proveedor especializado.',
        'Si se identifican daños en sonda/cable, lectura inestable, ausencia de audio, batería inflada, cargador defectuoso, fallas de pantalla o mensajes de error persistentes, retire el equipo de servicio y genere mantenimiento correctivo.'
      ],
      inspeccion: [
        { id: 'stiiproi1', item: 'Carcasa de la unidad principal íntegra, sin grietas, golpes, deformaciones, corrosión, partes sueltas ni evidencia de ingreso de líquidos' },
        { id: 'stiiproi2', item: 'Pantalla LCD limpia, legible, sin segmentos apagados, manchas, pérdida de contraste ni daño físico visible' },
        { id: 'stiiproi3', item: 'Teclas de encendido, modo, volumen, memoria/promedio y navegación con respuesta adecuada, sin bloqueo ni falso contacto' },
        { id: 'stiiproi4', item: 'Altavoz sin obstrucciones, suciedad, humedad, vibración anormal o distorsión audible durante la prueba' },
        { id: 'stiiproi5', item: 'Transductor obstétrico de 2 MHz o 3 MHz íntegro, limpio, sin grietas, rayaduras profundas, desprendimiento, humedad interna o daño visible' },
        { id: 'stiiproi6', item: 'Cable del transductor sin cortes, dobleces severos, peladuras, aplastamiento, tracción excesiva, empalmes o blindaje expuesto' },
        { id: 'stiiproi7', item: 'Conector del transductor firme, sin pines doblados, sulfatación, holgura, cuerpos extraños ni humedad' },
        { id: 'stiiproi8', item: 'Puerto de carga, conector de audífonos/salida de audio y conectores auxiliares limpios, firmes y sin corrosión' },
        { id: 'stiiproi9', item: 'Batería recargable sin deformación, fuga, calentamiento anormal, sulfatación, alerta persistente o autonomía evidentemente reducida' },
        { id: 'stiiproi10', item: 'Cargador/adaptador y cable de alimentación sin cortes, peladuras, clavija floja, calentamiento, olor anormal o daño mecánico' },
        { id: 'stiiproi11', item: 'Etiquetas de identificación, número de serie, activo fijo, advertencias, símbolos de seguridad y marcación del fabricante legibles' },
        { id: 'stiiproi12', item: 'Bolsa, soporte, estuche, compartimiento y accesorios limpios, secos, completos y almacenados de forma segura' },
        { id: 'stiiproi13', item: 'Superficie de la sonda libre de residuos de gel, material biológico, fisuras o rugosidades que puedan dificultar limpieza/desinfección' },
        { id: 'stiiproi14', item: 'Limpieza externa realizada con paño suave; sin exceso de líquido en pantalla, altavoz, botones, puertos, uniones o compartimiento de batería' },
        { id: 'stiiproi15', item: 'Condiciones ambientales del área adecuadas para prueba: equipo seco, superficie estable, sin fuentes de interferencia acústica/electromagnética evidente' }
      ],
      verificacionBasica: [
        { id: 'stiiprovb1', item: 'El equipo enciende correctamente y completa la inicialización sin reinicios, bloqueo, pitidos anormales o mensajes de falla persistentes' },
        { id: 'stiiprovb2', item: 'La pantalla muestra batería, modo de operación, frecuencia cardíaca fetal y demás indicadores de forma legible' },
        { id: 'stiiprovb3', item: 'El selector de modo permite alternar entre lectura en tiempo real, promedio, cálculo manual y ajuste de retroiluminación si aplica' },
        { id: 'stiiprovb4', item: 'El control de volumen aumenta/disminuye la señal audible sin distorsión marcada, ruido excesivo o pérdida intermitente de audio' },
        { id: 'stiiprovb5', item: 'El indicador de batería y carga funciona correctamente al conectar y desconectar el cargador' },
        { id: 'stiiprovb6', item: 'El equipo opera en batería durante la prueba funcional sin apagado súbito ni reinicio inesperado' },
        { id: 'stiiprovb7', item: 'El transductor es reconocido por el equipo y genera respuesta audible al contacto con simulador/phantom o prueba equivalente' },
        { id: 'stiiprovb8', item: 'La conexión del transductor permanece estable al mover suavemente el cable y el conector, sin cortes de señal' },
        { id: 'stiiprovb9', item: 'La salida de audífonos o salida de audio funciona si se utiliza institucionalmente, sin ruido, falso contacto ni pérdida de canal' },
        { id: 'stiiprovb10', item: 'La retroiluminación, apagado automático o funciones de ahorro de energía operan correctamente si están configuradas' },
        { id: 'stiiprovb11', item: 'La limpieza/desinfección posterior no deja humedad ni residuos de gel en sonda, cable, botones, pantalla, altavoz o conectores' },
        { id: 'stiiprovb12', item: 'El equipo queda identificado, seco, con accesorios completos y listo para almacenamiento o devolución al servicio' }
      ],
      pruebasFuncionales: [
        { id: 'stiipropf1', prueba: 'Encendido y autoverificación — Encender equipo en modo batería', valorEsperado: 'Inicializa correctamente, pantalla legible y sin mensajes de error persistentes', resultado: ['Pasa', 'Falla'] },
        { id: 'stiipropf2', prueba: 'Alimentación/carga — Conectar cargador original o compatible aprobado', valorEsperado: 'Indicador de carga activo, sin calentamiento anormal, falso contacto, olor o reinicio del equipo', resultado: ['Pasa', 'Falla'] },
        { id: 'stiipropf3', prueba: 'Modo batería — Desconectar cargador y mantener operación durante prueba corta', valorEsperado: 'Equipo continúa funcionando sin apagado súbito y mantiene lectura/sonido estable', resultado: ['Pasa', 'Falla'] },
        { id: 'stiipropf4', prueba: 'Prueba de audio — Activar señal con simulador/phantom y variar volumen', valorEsperado: 'Audio claro, regulable y sin distorsión excesiva en todo el rango útil', resultado: ['Pasa', 'Falla'] },
        { id: 'stiipropf5', prueba: 'Lectura FCF baja — Simular 60 lpm si el patrón lo permite', valorEsperado: 'Lectura aproximada 60 lpm dentro de ±3 lpm o tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stiipropf6', prueba: 'Lectura FCF nominal — Simular 120 lpm', valorEsperado: 'Lectura aproximada 120 lpm dentro de ±3 lpm o tolerancia institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'stiipropf7', prueba: 'Lectura FCF alta — Simular 180 lpm si el patrón lo permite', valorEsperado: 'Lectura aproximada 180 lpm dentro de ±3 lpm o tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stiipropf8', prueba: 'Rango de medición — Verificar que el equipo responde dentro del rango 50 a 210 lpm', valorEsperado: 'Detecta y muestra frecuencia cardíaca fetal dentro del rango especificado sin saltos erráticos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stiipropf9', prueba: 'Modo tiempo real — Mantener señal estable del simulador durante 30 segundos', valorEsperado: 'La FCF se actualiza de forma continua y coherente con el patrón', resultado: ['Pasa', 'Falla'] },
        { id: 'stiipropf10', prueba: 'Modo promedio — Activar modo promedio con señal estable', valorEsperado: 'Muestra valor promedio coherente y estable, sin desviaciones abruptas no justificadas', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stiipropf11', prueba: 'Modo cálculo manual — Ejecutar conteo manual según función disponible', valorEsperado: 'El cálculo manual se inicia/finaliza y muestra resultado sin bloqueo del equipo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stiipropf12', prueba: 'Retroiluminación/brillo — Cambiar nivel o activar iluminación de pantalla', valorEsperado: 'La pantalla cambia de brillo y permanece legible sin parpadeos anormales', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stiipropf13', prueba: 'Conexión del transductor — Mover suavemente cable y conector durante señal simulada', valorEsperado: 'No se interrumpe el audio ni la lectura; no aparecen cortes por falso contacto', resultado: ['Pasa', 'Falla'] },
        { id: 'stiipropf14', prueba: 'Prueba de sensibilidad acústica — Aplicar gel y usar phantom/simulador Doppler', valorEsperado: 'Se obtiene señal audible clara con acoplamiento adecuado, sin ruido dominante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stiipropf15', prueba: 'Salida de audífonos/audio — Conectar audífonos o cable si el servicio lo usa', valorEsperado: 'La salida reproduce señal clara, sin falso contacto ni desconexión intermitente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stiipropf16', prueba: 'Apagado automático/ahorro de energía — Mantener equipo sin señal según tiempo configurado', valorEsperado: 'La función opera conforme a configuración o manual, si está habilitada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stiipropf17', prueba: 'Verificación de sonda impermeable — Inspección posterior a limpieza controlada', valorEsperado: 'Sonda sin ingreso visible de humedad, fisuras, burbujas, empañamiento o falla de señal', resultado: ['Pasa', 'Falla'] },
        { id: 'stiipropf18', prueba: 'Prueba de estabilidad — Mantener lectura simulada a 120 lpm durante 1 minuto', valorEsperado: 'Lectura estable dentro de tolerancia, sin congelamiento, pérdida de señal o reinicio', resultado: ['Pasa', 'Falla'] },
        { id: 'stiipropf19', prueba: 'Interferencia/ruido — Evaluar señal con cargador desconectado y conectado', valorEsperado: 'No se incrementa ruido de forma significativa ni se altera lectura por alimentación/carga', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'stiipropf20', prueba: 'Seguridad eléctrica externa — Medición con analizador de seguridad eléctrica si se dispone', valorEsperado: 'Corrientes de fuga y aislamiento dentro de límites IEC 60601/institucionales para equipo alimentado internamente', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de unidad principal, pantalla, botones y superficies de contacto',
        'Limpieza y desinfección del transductor según recomendación del fabricante e institución',
        'Retiro de residuos de gel conductor en sonda, cable y carcasa',
        'Verificación de carcasa, pantalla, botones, altavoz, conectores y etiquetas',
        'Verificación de transductor obstétrico, cable y conector',
        'Verificación de batería recargable, cargador, indicador de carga y autonomía funcional',
        'Prueba funcional con simulador de FCF, phantom acústico o método institucional equivalente',
        'Verificación de lectura de frecuencia cardíaca fetal en puntos de prueba disponibles',
        'Verificación de modos de operación, volumen, retroiluminación y salida de audio si aplica',
        'Verificación de limpieza final, secado, almacenamiento y disponibilidad de accesorios',
        'Recomendación de reposición de batería, cargador, sonda o accesorios por deterioro',
        'Remisión a servicio técnico autorizado EDAN o proveedor especializado'
      ]
    },


    'incubadora_drager_isolette_c2000': {
      nombre: 'Incubadora Neonatal Dräger Isolette C2000',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-INC-C2000',
      frecuencia: ['Trimestral', 'Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que la incubadora se encuentre fuera de uso clínico, sin paciente, limpia, seca y ubicada en un área segura antes de iniciar el mantenimiento preventivo.',
        'Confirme que el personal que realiza la intervención esté autorizado por la institución; las pruebas internas, ajustes, calibraciones y reparaciones deben ejecutarse solo por personal calificado según manual de servicio.',
        'Desconecte la alimentación eléctrica antes de inspecciones físicas o limpieza; reconecte únicamente para las pruebas funcionales controladas.',
        'Confirme disponibilidad de termómetro patrón o analizador de incubadoras calibrado, analizador de seguridad eléctrica, medidor de humedad/temperatura, oxímetro ambiental o analizador de oxígeno si el equipo cuenta con módulo O2, y recipiente con agua destilada para sistema de humedad si aplica.',
        'No utilice alcohol sobre la cúpula acrílica ni aplique soluciones directamente sobre componentes eléctricos; evite limpieza con vapor, inmersión o ingreso de líquidos al controlador, conectores, motor, resistencias o módulo de sensores.',
        'No anule alarmas, sensores, protecciones térmicas, enclavamientos, puesta a tierra ni controles de seguridad durante la prueba.',
        'Si se evidencian alarmas persistentes, desviación térmica, falla de ventilador, daño en cúpula/puertas, sensor defectuoso, fuga eléctrica, corrosión, sobrecalentamiento u olor anormal, retire de servicio y genere mantenimiento correctivo especializado.'
      ],
      inspeccion: [
        { id: 'c2000i1', item: 'Cúpula acrílica íntegra, transparente, sin fisuras, rayaduras profundas, deformaciones, manchas químicas ni bordes cortantes' },
        { id: 'c2000i2', item: 'Puertas de acceso, mangas/iris ports y seguros de portezuelas con cierre correcto, sin holgura, daño o pérdida de empaques' },
        { id: 'c2000i3', item: 'Juntas, empaques y burletes del habitáculo en buen estado, sin endurecimiento, rasgaduras, desprendimiento o fuga visible de aire' },
        { id: 'c2000i4', item: 'Colchón, bandeja de colchón, inclinación/Trendelenburg y mecanismo de extracción sin daño, limpieza adecuada y movimiento seguro' },
        { id: 'c2000i5', item: 'Base/pedestal, ruedas, frenos y manijas en buen estado; desplazamiento controlado y bloqueo efectivo' },
        { id: 'c2000i6', item: 'Sistema de altura variable, si aplica, sube y baja de forma uniforme, sin ruidos anormales, atascos o pérdida de estabilidad' },
        { id: 'c2000i7', item: 'Cable de alimentación, clavija hospitalaria, alivio de tensión, toma de tierra y conectores externos sin cortes, sulfatación ni calentamiento' },
        { id: 'c2000i8', item: 'Controlador, teclado, perillas, pantalla, indicadores y panel frontal limpios, legibles y sin daño físico' },
        { id: 'c2000i9', item: 'Módulo/sensor de temperatura de aire y conectores sin suciedad, golpes, obstrucciones o cables deteriorados' },
        { id: 'c2000i10', item: 'Sondas de temperatura de piel, si están disponibles, limpias, íntegras, sin cortes, falsos contactos ni conectores flojos' },
        { id: 'c2000i11', item: 'Entradas/salidas de aire, filtro, turbina/ventilador y rejillas libres de polvo, obstrucciones o material extraño' },
        { id: 'c2000i12', item: 'Sistema de humedad, depósito, bandeja, tapa y ductos limpios, sin incrustaciones, fuga, corrosión ni agua estancada' },
        { id: 'c2000i13', item: 'Sistema de oxígeno, si aplica, mangueras, conexiones, célula/sensor y puerto de calibración íntegros y libres de fuga o contaminación' },
        { id: 'c2000i14', item: 'Báscula integrada, si aplica, plataforma, cableado y superficie de pesaje sin daño; rango y cero verificables' },
        { id: 'c2000i15', item: 'Etiquetas de advertencia, activo fijo, marca, modelo, serial, fecha de mantenimiento y polaridad/voltaje legibles y coincidentes con inventario' },
        { id: 'c2000i16', item: 'Limpieza y desinfección externa final realizada con producto compatible, superficies secas y sin residuos químicos' }
      ],
      verificacionBasica: [
        { id: 'c2000vb1', item: 'La incubadora enciende correctamente y completa autoverificación inicial sin códigos de falla persistentes' },
        { id: 'c2000vb2', item: 'Pantalla, teclado, selección de modo aire/piel y navegación de menús responden correctamente' },
        { id: 'c2000vb3', item: 'El ventilador/turbina opera de forma continua, sin ruido anormal, vibración excesiva ni bloqueo de flujo' },
        { id: 'c2000vb4', item: 'El calentador se activa y regula conforme al incremento de temperatura seleccionado, sin sobrecalentamiento visible' },
        { id: 'c2000vb5', item: 'Las alarmas audibles y visuales se activan, silencian temporalmente y restablecen según condición de prueba' },
        { id: 'c2000vb6', item: 'El sistema mantiene estabilidad física del habitáculo con puertas cerradas y no presenta fuga evidente de aire por sellos' },
        { id: 'c2000vb7', item: 'Sistema de humedad, si aplica, inicia operación y muestra incremento o lectura coherente tras estabilización' },
        { id: 'c2000vb8', item: 'Sistema de oxígeno, si aplica, muestra lectura coherente y permite calibración/verificación de sensores según procedimiento institucional' },
        { id: 'c2000vb9', item: 'Báscula integrada, si aplica, permite cero/tara y lectura estable con peso de prueba institucional' },
        { id: 'c2000vb10', item: 'La incubadora queda sin alarmas activas, limpia, seca, conectada de forma segura y lista para uso o retirada según estado final' }
      ],
      pruebasFuncionales: [
        { id: 'c2000pf1', prueba: 'Encendido y autodiagnóstico del controlador', valorEsperado: 'Inicio completo sin falla crítica, pantalla y alarmas operativas', resultado: ['Pasa', 'Falla'] },
        { id: 'c2000pf2', prueba: 'Modo control por aire — Programar 36.0 °C y permitir estabilización con cúpula cerrada', valorEsperado: 'Temperatura de cámara estable dentro de ±1.0 °C del valor programado o tolerancia institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'c2000pf3', prueba: 'Uniformidad térmica básica — Medición en zona central y puntos laterales del colchón', valorEsperado: 'Diferencia entre puntos dentro de tolerancia institucional; sin zonas frías/calientes anormales', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'c2000pf4', prueba: 'Modo control por piel — Conectar sonda de piel y simular/medir temperatura estable', valorEsperado: 'Lectura coherente, control activo y alarma por sonda desconectada funcional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'c2000pf5', prueba: 'Alarma de alta temperatura — Generar condición controlada o usar autoprueba disponible', valorEsperado: 'Alarma visual/audible activa y registro de condición de alta temperatura', resultado: ['Pasa', 'Falla'] },
        { id: 'c2000pf6', prueba: 'Alarma de baja temperatura — Apertura controlada o disminución de lectura según procedimiento', valorEsperado: 'Alarma visual/audible activa tras desviación del set point', resultado: ['Pasa', 'Falla'] },
        { id: 'c2000pf7', prueba: 'Alarma de falla de sensor/sonda de piel desconectada', valorEsperado: 'Mensaje/alarma técnica inmediata y control seguro del equipo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'c2000pf8', prueba: 'Alarma de falla de alimentación — Desconectar AC brevemente bajo condición segura', valorEsperado: 'Alarma de pérdida de energía activa; recuperación normal al reconectar', resultado: ['Pasa', 'Falla'] },
        { id: 'c2000pf9', prueba: 'Flujo de aire / ventilador — Verificar circulación y ausencia de obstrucción en entradas/salidas', valorEsperado: 'Circulación perceptible/indicada, sin ruido anormal ni mensajes de falla', resultado: ['Pasa', 'Falla'] },
        { id: 'c2000pf10', prueba: 'Sistema de humedad — Depósito con agua destilada y operación controlada', valorEsperado: 'Lectura/incremento de humedad coherente tras estabilización; sin fuga ni alarma de baja humedad persistente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'c2000pf11', prueba: 'Sistema de oxígeno — Verificación/calibración a 21% y prueba funcional del sensor si aplica', valorEsperado: 'Lectura próxima a 21% en aire ambiente y alarmas/ajustes funcionales según configuración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'c2000pf12', prueba: 'Puertas y portezuelas — Abrir/cerrar accesos y verificar recuperación de condición térmica', valorEsperado: 'Cierre seguro; sin pérdida de sellado o alarma persistente después de cerrar', resultado: ['Pasa', 'Falla'] },
        { id: 'c2000pf13', prueba: 'Báscula integrada — Cero/tara y peso patrón institucional si aplica', valorEsperado: 'Lectura estable y dentro de tolerancia institucional para pesaje neonatal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'c2000pf14', prueba: 'Altura variable del pedestal — Subir y bajar en todo el recorrido si aplica', valorEsperado: 'Movimiento uniforme, sin atascos, deriva, ruidos anormales o pérdida de estabilidad', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'c2000pf15', prueba: 'Frenos y estabilidad del equipo', valorEsperado: 'Ruedas bloquean correctamente y la incubadora permanece estable durante operación', resultado: ['Pasa', 'Falla'] },
        { id: 'c2000pf16', prueba: 'Seguridad eléctrica — Tierra de protección, corriente de fuga y aislamiento con analizador calibrado', valorEsperado: 'Cumple límites IEC 60601 / protocolo institucional vigente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'c2000pf17', prueba: 'Verificación de limpieza posterior y ausencia de residuos', valorEsperado: 'Equipo limpio, seco, sin residuos químicos, sin agua estancada y con accesorios instalados', resultado: ['Pasa', 'Falla'] },
        { id: 'c2000pf18', prueba: 'Prueba de estabilidad final — Operación continua mínima de 15 minutos en set point seleccionado', valorEsperado: 'Sin alarmas, reinicios, sobrecalentamiento, ruido anormal ni desviación térmica progresiva', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de cúpula, panel, base, puertas, portezuelas y superficies de contacto',
        'Desinfección externa con producto compatible según protocolo institucional',
        'Retiro de polvo y obstrucciones en rejillas, entradas/salidas de aire y filtro accesible',
        'Verificación de cúpula, sellos, puertas, mangas, colchón, bandeja y mecanismos mecánicos',
        'Verificación funcional de encendido, autodiagnóstico, pantalla, teclado y modos aire/piel',
        'Verificación de control térmico con patrón o analizador de incubadoras calibrado',
        'Verificación de alarmas audibles/visuales de temperatura, sensor y falla de energía',
        'Verificación de ventilador/flujo de aire y estabilidad de operación',
        'Verificación del sistema de humedad con agua destilada si aplica',
        'Verificación/calibración funcional del sensor de oxígeno si aplica',
        'Verificación de báscula integrada si aplica',
        'Verificación de ruedas, frenos, pedestal y altura variable si aplica',
        'Verificación de seguridad eléctrica con analizador calibrado si se dispone',
        'Recomendación de cambio de filtro, sensor de oxígeno, sonda de piel, empaques o accesorios deteriorados',
        'Remisión a servicio técnico autorizado Dräger o proveedor especializado'
      ]
    },


    'rayos_x_portatil_carestream_motion_mobile': {
      nombre: 'Equipo de Rayos X (Portátil) Carestream Motion Mobile',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-RXP',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Verifique que el equipo esté fuera de exposición clínica y ubicado en un área segura antes de iniciar la inspección.',
        'Confirme que el mantenimiento funcional se realizará sin emisión de radiación al paciente y sin exposiciones de prueba, ya que no se dispone de equipo patrón para verificación metrológica del haz.',
        'Asegúrese de que la batería del equipo tenga carga suficiente o que el sistema se encuentre conectado según las recomendaciones del fabricante.',
        'Inspeccione el área de trabajo y garantice que no existan obstáculos para el desplazamiento, extensión del brazo ni posicionamiento del cabezal.',
        'Verifique disponibilidad del dosímetro personal, elementos de protección radiológica institucionales y acceso a los autochequeos internos del sistema.',
        'No abra cubiertas, generador, colimador ni cabezal de rayos X. Cualquier intervención interna debe ser realizada por servicio técnico autorizado.',
        'Si el equipo presenta mensajes de error, daño mecánico, sobrecalentamiento, olor anormal, fallo de frenos o anomalías eléctricas, retire de servicio antes de continuar.'
      ],
      inspeccion: [
        { id: 'mmi1', item: 'Carro/base del equipo íntegro, sin golpes estructurales, deformaciones ni corrosión visible' },
        { id: 'mmi2', item: 'Ruedas, sistema de desplazamiento, frenos y manijas funcionales; sin holguras ni bloqueo anormal' },
        { id: 'mmi3', item: 'Columna, brazo articulado y cabezal del tubo con movimiento controlado y fijación estable' },
        { id: 'mmi4', item: 'Carcasa del generador, panel de control y monitor/touchscreen sin grietas ni daño visible' },
        { id: 'mmi5', item: 'Cableado externo, conectores, cargador y clavija de alimentación en buen estado' },
        { id: 'mmi6', item: 'Colimador luminoso íntegro; perillas, mandos y centrado de campo sin atascamiento' },
        { id: 'mmi7', item: 'Indicadores, luces de estado y mandos de preparación/exposición con protección y rotulación legible' },
        { id: 'mmi8', item: 'Compartimentos, soportes de detector/accesorios y seguros mecánicos en buen estado' },
        { id: 'mmi9', item: 'Etiquetas de identificación, activo fijo, advertencias radiológicas y número de serie legibles' },
        { id: 'mmi10', item: 'Limpieza externa realizada; superficies libres de polvo y suciedad, sin ingreso de líquidos al sistema' }
      ],
      verificacionBasica: [
        { id: 'mmvb1', item: 'El sistema enciende correctamente y completa autoverificación sin mensajes críticos de falla' },
        { id: 'mmvb2', item: 'La interfaz táctil/panel permite navegación normal, selección de paciente o técnica y acceso a menús' },
        { id: 'mmvb3', item: 'La batería muestra nivel de carga y el equipo responde correctamente al modo de carga/conexión eléctrica' },
        { id: 'mmvb4', item: 'El brazo y cabezal se posicionan con estabilidad y mantienen la posición sin deriva evidente' },
        { id: 'mmvb5', item: 'La luz del colimador enciende y el ajuste manual del campo funciona correctamente' },
        { id: 'mmvb6', item: 'No se evidencian ruidos anormales, sobrecalentamiento, bloqueos de movilidad ni alarmas activas durante la revisión funcional' }
      ],
      pruebasFuncionales: [
        { id: 'mmpf1', prueba: 'Encendido y autodiagnóstico del sistema', valorEsperado: 'Inicio completo sin fallas críticas ni bloqueo operativo', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf2', prueba: 'Pantalla táctil / consola de operación', valorEsperado: 'Respuesta normal al tacto y navegación fluida entre menús', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf3', prueba: 'Movilidad del carro y frenos', valorEsperado: 'Desplazamiento controlado, frenado efectivo y maniobrabilidad segura', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf4', prueba: 'Posicionamiento de columna, brazo y cabezal', valorEsperado: 'Permite extensión/rotación normales y conserva la posición seleccionada', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf5', prueba: 'Colimador luminoso y ajuste de campo', valorEsperado: 'Luz visible y ajuste manual del campo sin atascamientos', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf6', prueba: 'Selección de técnica radiográfica (APR/manual) sin disparo', valorEsperado: 'Permite configurar parámetros y protocolos disponibles sin error', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf7', prueba: 'Estado de batería / carga', valorEsperado: 'Indica nivel de batería y estado de carga de forma coherente', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf8', prueba: 'Mensajes de sistema y alarmas', valorEsperado: 'Sin alarmas activas ni códigos de falla durante la revisión funcional', resultado: ['Pasa', 'Falla'] },
        { id: 'mmpf9', prueba: 'Verificación funcional adaptada sin equipo patrón', valorEsperado: 'Se documenta revisión operativa básica; no se realiza verificación metrológica del haz, kV, mAs, tiempo ni dosis', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de carcasa, monitor y panel de control',
        'Verificación de ruedas, frenos y maniobrabilidad',
        'Verificación de brazo articulado, columna y cabezal',
        'Verificación funcional de pantalla táctil / consola',
        'Verificación de colimador luminoso y ajuste de campo',
        'Verificación de batería, cargador y estado de alimentación',
      ]
    },
  

    'blender_biomed_2003fl': {
      nombre: 'Blender Aire/Oxígeno BIO-MED Devices 2003FL',
      categoria: 'Biomédico / Terapia respiratoria neonatal',
      codigo: 'SLV-GAT-BIO-BLENDER-BIOMED-2003FL',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el blender BIO-MED 2003FL del uso clínico y confirme que no esté conectado a paciente antes de iniciar el mantenimiento preventivo.',
        'Verifique disponibilidad de fuentes de aire medicinal y oxígeno medicinal reguladas, libres de aceite y humedad, con presiones de entrada dentro del rango especificado por el fabricante o estándar institucional.',
        'Utilice analizador de oxígeno calibrado, manómetros patrón, flujómetro compatible y solución detectora de fugas apta para oxígeno; no use aceites, grasas ni lubricantes no aprobados.',
        'Antes de conectar el equipo, inspeccione roscas DISS/NIST, entradas de aire/O2, salidas principal/auxiliar y filtros de entrada.',
        'No obstruya la alarma neumática del blender y no opere el equipo si la alarma no se activa ante diferencia de presión.',
        'No gire el selector de FiO2 por debajo de 21% ni por encima de 100%; forzar el dial puede dañar el mecanismo.',
        'Permita estabilización mínima de 60 segundos después de cada cambio de concentración antes de registrar lectura de FiO2.',
        'Las reparaciones internas, recambio de diafragmas, válvulas, módulos proporcionales o calibración interna deben ser realizadas por personal calificado o servicio autorizado.',
        'Si se detectan fugas, desviación de FiO2, alarma ausente, contaminación, daño de conectores o imposibilidad de ajuste, retire el equipo del servicio y genere correctivo.'
      ],
      inspeccion: [
        { id: 'biomed2003fl_i1', item: 'Carcasa del blender íntegra, limpia, sin fisuras, golpes, corrosión, piezas sueltas o evidencia de contaminación' },
        { id: 'biomed2003fl_i2', item: 'Perilla/selectora de FiO2 21–100% legible, firme, con recorrido suave y sin puntos de bloqueo' },
        { id: 'biomed2003fl_i3', item: 'Entradas de aire y oxígeno con conectores DISS/NIST limpios, sin roscas barridas, golpes, fuga visible o adaptadores inseguros' },
        { id: 'biomed2003fl_i4', item: 'Salidas de gas principal y auxiliar limpias, libres de obstrucción y con conexión firme al flujómetro/accesorio' },
        { id: 'biomed2003fl_i5', item: 'Filtros de entrada y retenedores sin contaminación visible, humedad, partículas, obstrucción o daño mecánico' },
        { id: 'biomed2003fl_i6', item: 'Etiqueta de sentido AIR/O2, número de serie, modelo 2003FL, advertencias y escala de concentración legibles' },
        { id: 'biomed2003fl_i7', item: 'Soporte, abrazadera, base o montaje del blender estable y sin riesgo de caída' },
        { id: 'biomed2003fl_i8', item: 'Mangueras de aire y oxígeno sin cortes, aplastamiento, endurecimiento, fugas, conectores flojos o vencimiento' },
        { id: 'biomed2003fl_i9', item: 'No hay presencia de grasa, aceite, cinta no compatible, residuos químicos o humedad en conexiones de oxígeno' },
        { id: 'biomed2003fl_i10', item: 'Flujómetro asociado, si aplica, con escala legible, flotador libre y válvula de ajuste funcional' }
      ],
      verificacionBasica: [
        { id: 'biomed2003fl_v1', item: 'Conexión de aire medicinal y oxígeno medicinal', valorEsperado: 'Entradas conectan firmes, sin fuga audible y con presiones equilibradas según especificación', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'biomed2003fl_v2', item: 'Presión de entrada de aire', valorEsperado: 'Presión dentro del rango de operación del equipo o estándar institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'biomed2003fl_v3', item: 'Presión de entrada de oxígeno', valorEsperado: 'Presión dentro del rango de operación del equipo o estándar institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'biomed2003fl_v4', item: 'Flujo por salida principal', valorEsperado: 'Flujo continuo y estable al abrir el flujómetro, sin oscilaciones anormales', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'biomed2003fl_v5', item: 'Alarma por desbalance/desconexión de presión', valorEsperado: 'Al desconectar o reducir una fuente se activa alarma audible y el flujo se comporta según diseño', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'biomed2003fl_v6', item: 'Retorno a operación normal al restablecer fuentes', valorEsperado: 'La alarma cesa y la concentración vuelve a estabilizarse sin fuga', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'biomed2003fl_v7', item: 'Estabilización posterior a cambio de FiO2', valorEsperado: 'Después de 60 segundos la lectura del analizador es estable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'biomed2003fl_v8', item: 'Prueba de fugas externa en conexiones', valorEsperado: 'No se observan burbujas ni caída de presión en conexiones externas', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'biomed2003fl_pf1', prueba: 'Verificación FiO2 al 21% con analizador de oxígeno calibrado', valorEsperado: 'Lectura 21% ± 3% o tolerancia institucional/manufacturer', resultado: ['Pasa', 'Falla'] },
        { id: 'biomed2003fl_pf2', prueba: 'Verificación FiO2 al 30%', valorEsperado: 'Lectura 30% ± 3% después de estabilización', resultado: ['Pasa', 'Falla'] },
        { id: 'biomed2003fl_pf3', prueba: 'Verificación FiO2 al 40%', valorEsperado: 'Lectura 40% ± 3% después de estabilización', resultado: ['Pasa', 'Falla'] },
        { id: 'biomed2003fl_pf4', prueba: 'Verificación FiO2 al 60%', valorEsperado: 'Lectura 60% ± 3% después de estabilización', resultado: ['Pasa', 'Falla'] },
        { id: 'biomed2003fl_pf5', prueba: 'Verificación FiO2 al 100%', valorEsperado: 'Lectura 100% ± 3% después de estabilización', resultado: ['Pasa', 'Falla'] },
        { id: 'biomed2003fl_pf6', prueba: 'Prueba de repetibilidad retornando de 100% a 40%', valorEsperado: 'Lectura retorna a 40% ± 3% sin histéresis significativa', resultado: ['Pasa', 'Falla'] },
        { id: 'biomed2003fl_pf7', prueba: 'Prueba de flujo bajo compatible con 2003FL', valorEsperado: 'Flujo estable sin caída brusca ni alarma injustificada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'biomed2003fl_pf8', prueba: 'Prueba de salida auxiliar/bleed si aplica', valorEsperado: 'Salida disponible y estable según configuración del equipo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'biomed2003fl_pf9', prueba: 'Prueba de alarma retirando fuente de aire', valorEsperado: 'Alarma audible inmediata y condición de falla identificable', resultado: ['Pasa', 'Falla'] },
        { id: 'biomed2003fl_pf10', prueba: 'Prueba de alarma retirando fuente de oxígeno', valorEsperado: 'Alarma audible inmediata y condición de falla identificable', resultado: ['Pasa', 'Falla'] },
        { id: 'biomed2003fl_pf11', prueba: 'Prueba de fuga con presión aplicada en conexiones externas', valorEsperado: 'Sin fugas detectables con solución compatible con oxígeno', resultado: ['Pasa', 'Falla'] },
        { id: 'biomed2003fl_pf12', prueba: 'Verificación final a concentración clínica de 40% o valor definido por servicio', valorEsperado: 'FiO2 estable y equipo apto para uso con accesorios compatibles', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa del blender y conectores sin ingreso de líquidos',
        'Revisión y ajuste externo de conexiones, mangueras, flujómetro y soporte',
        'Verificación de FiO2 con analizador de oxígeno calibrado en puntos seleccionados',
        'Prueba de alarma por desbalance de presión y prueba de fugas externas',
        'Registro de desviaciones y solicitud de calibración/servicio técnico si no cumple tolerancia'
      ]
    },

    'blender_medin': {
      nombre: 'Blender Aire/Oxígeno medin',
      categoria: 'Biomédico / Terapia respiratoria neonatal',
      codigo: 'SLV-GAT-BIO-BLENDER-MEDIN',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el blender medin del uso clínico y confirme que no esté conectado a paciente o circuito respiratorio activo.',
        'Use fuentes de aire medicinal y oxígeno medicinal secas, limpias y reguladas; verifique que no exista contaminación con aceite o humedad.',
        'Tenga disponible analizador de oxígeno calibrado, manómetros patrón, flujómetro medin compatible y detector de fugas apto para oxígeno.',
        'Identifique configuración instalada: blender de bajo/alto flujo, flujómetro, humidificador, sistema CPAP, nHFT o accesorios de terapia neonatal asociados.',
        'No obstruya salidas, alarmas o puertos de purga. No use el equipo si hay daño de conectores o lectura de FiO2 inestable.',
        'Después de cambio de concentración, espere estabilización antes de comparar con analizador de oxígeno.',
        'No realice reparaciones internas, ajustes de módulos proporcionales o calibración interna durante mantenimiento rutinario; remita a servicio técnico calificado.',
        'Si el equipo no entrega mezcla estable, presenta fuga, alarma ausente o desviación de FiO2, retírelo del servicio y genere correctivo.'
      ],
      inspeccion: [
        { id: 'medinbl_i1', item: 'Cuerpo del blender medin íntegro, limpio, sin golpes, fisuras, corrosión, piezas flojas o contaminación visible' },
        { id: 'medinbl_i2', item: 'Perilla/escala de FiO2 21–100% legible, con desplazamiento suave y sin bloqueo' },
        { id: 'medinbl_i3', item: 'Conectores de aire y oxígeno limpios, firmes, sin roscas dañadas, humedad, grasa o fuga' },
        { id: 'medinbl_i4', item: 'Salidas de gas, flujómetro y adaptadores medin compatibles sin obstrucción ni daño' },
        { id: 'medinbl_i5', item: 'Filtros o mallas de entrada sin suciedad, humedad, partículas o evidencia de saturación' },
        { id: 'medinbl_i6', item: 'Soporte o montaje en riel estable, sin holgura ni riesgo de caída' },
        { id: 'medinbl_i7', item: 'Mangueras de gases medicinales sin cortes, endurecimiento, aplastamiento, fugas o vencimiento' },
        { id: 'medinbl_i8', item: 'Rotulación, modelo, número de serie, advertencias de oxígeno y sentido de conexiones legibles' },
        { id: 'medinbl_i9', item: 'Flujómetro asociado con escala legible, flotador libre y válvula de control funcional' },
        { id: 'medinbl_i10', item: 'Accesorios de CPAP/alto flujo asociados limpios, completos y sin daño si aplican al servicio' }
      ],
      verificacionBasica: [
        { id: 'medinbl_v1', item: 'Conexión a aire medicinal y oxígeno medicinal', valorEsperado: 'Conexión firme, sin fuga audible y con presión de entrada adecuada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'medinbl_v2', item: 'Salida de flujo', valorEsperado: 'Flujo estable y regulable mediante flujómetro compatible', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'medinbl_v3', item: 'Movimiento del dial de FiO2', valorEsperado: 'Ajuste progresivo de 21% a 100% sin saltos mecánicos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'medinbl_v4', item: 'Alarma/desbalance de presión si aplica al modelo', valorEsperado: 'Alarma audible o condición de falla identificable ante pérdida de una fuente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'medinbl_v5', item: 'Estabilización de concentración', valorEsperado: 'Lectura de analizador se estabiliza después de cada cambio de FiO2', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'medinbl_v6', item: 'Fugas externas en conexiones y accesorios', valorEsperado: 'Sin burbujas ni caída de presión detectable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'medinbl_v7', item: 'Compatibilidad con circuito neonatal/CPAP si aplica', valorEsperado: 'Conexiones ajustan sin fugas ni obstrucción del flujo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'medinbl_v8', item: 'Condición final de limpieza y secado', valorEsperado: 'Equipo queda limpio, seco y sin residuos químicos', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'medinbl_pf1', prueba: 'FiO2 al 21% con analizador calibrado', valorEsperado: '21% ± 3% o tolerancia institucional/manufacturer', resultado: ['Pasa', 'Falla'] },
        { id: 'medinbl_pf2', prueba: 'FiO2 al 30%', valorEsperado: '30% ± 3% después de estabilización', resultado: ['Pasa', 'Falla'] },
        { id: 'medinbl_pf3', prueba: 'FiO2 al 40%', valorEsperado: '40% ± 3% después de estabilización', resultado: ['Pasa', 'Falla'] },
        { id: 'medinbl_pf4', prueba: 'FiO2 al 60%', valorEsperado: '60% ± 3% después de estabilización', resultado: ['Pasa', 'Falla'] },
        { id: 'medinbl_pf5', prueba: 'FiO2 al 80%', valorEsperado: '80% ± 3% después de estabilización', resultado: ['Pasa', 'Falla'] },
        { id: 'medinbl_pf6', prueba: 'FiO2 al 100%', valorEsperado: '100% ± 3% después de estabilización', resultado: ['Pasa', 'Falla'] },
        { id: 'medinbl_pf7', prueba: 'Repetibilidad regresando a 40%', valorEsperado: 'Retorno a 40% ± 3% sin oscilación persistente', resultado: ['Pasa', 'Falla'] },
        { id: 'medinbl_pf8', prueba: 'Verificación de flujo bajo para terapia neonatal', valorEsperado: 'Flujo estable dentro del rango usado por el servicio', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'medinbl_pf9', prueba: 'Verificación de flujo alto/CPAP si aplica', valorEsperado: 'Flujo estable sin fuga ni alarma injustificada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'medinbl_pf10', prueba: 'Prueba de fuga externa', valorEsperado: 'Sin fugas en entradas, salidas, flujómetro y adaptadores', resultado: ['Pasa', 'Falla'] },
        { id: 'medinbl_pf11', prueba: 'Prueba de pérdida de fuente de aire u oxígeno', valorEsperado: 'Se evidencia alarma/condición segura según diseño', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'medinbl_pf12', prueba: 'Verificación final a concentración clínica definida', valorEsperado: 'Mezcla estable y equipo apto para uso con accesorios instalados', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa del blender y accesorios compatibles',
        'Revisión de conectores, mangueras, filtros externos, flujómetro y soporte',
        'Verificación de FiO2 en múltiples puntos con analizador calibrado',
        'Prueba de fugas externas y condición de alarma/desbalance si aplica',
        'Remisión a servicio técnico si presenta desviación, fuga, contaminación o falla de alarma'
      ]
    },

    'electrocardiografo_comen_h3': {
      nombre: 'Electrocardiógrafo COMEN H3',
      categoria: 'Biomédico / Diagnóstico cardiológico',
      codigo: 'SLV-GAT-BIO-ECG-COMEN-H3',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el electrocardiógrafo COMEN H3 del uso clínico y confirme que no esté conectado a paciente antes de intervenirlo.',
        'Use simulador de ECG calibrado de 12 derivaciones, papel térmico compatible, cable paciente y electrodos en buen estado.',
        'Verifique limpieza externa antes de la prueba, evitando ingreso de líquidos en conectores, teclado, impresora, USB o fuente de alimentación.',
        'No conecte simultáneamente a paciente y simulador. No realice pruebas eléctricas invasivas con el equipo conectado a paciente.',
        'No abra carcasa ni manipule batería, fuente, tarjeta principal, módulo ECG, pantalla táctil o impresora durante mantenimiento preventivo rutinario.',
        'Actualizaciones de software, reparaciones internas y ajustes electrónicos deben realizarse por servicio técnico calificado.',
        'Si se detecta falla de aislamiento, batería, impresora, cable paciente, medición ECG, pantalla o mensajes técnicos persistentes, retire el equipo y genere correctivo.'
      ],
      inspeccion: [
        { id: 'comenh3_i1', item: 'Carcasa, asa, bisagras y cubierta posterior sin fisuras, golpes, deformación, partes sueltas o contaminación visible' },
        { id: 'comenh3_i2', item: 'Pantalla táctil/visualizador de 6,2 pulgadas aproximadas limpia, legible, sin líneas, manchas, pixeles defectuosos o sensibilidad irregular' },
        { id: 'comenh3_i3', item: 'Teclado, botones de encendido, start/stop, menú e impresión funcionales y sin atascamiento' },
        { id: 'comenh3_i4', item: 'Cable paciente de 10 latiguillos/12 derivaciones sin cortes, peladuras, pines doblados, sulfatación o falsos contactos' },
        { id: 'comenh3_i5', item: 'Pinzas, perillas o adaptadores de electrodos limpios, firmes, sin corrosión ni pérdida de presión' },
        { id: 'comenh3_i6', item: 'Conector de paciente íntegro y correctamente fijado, sin pines hundidos o flojos' },
        { id: 'comenh3_i7', item: 'Impresora térmica, tapa, rodillo y compartimiento de papel limpios, sin residuos, obstrucción o daño mecánico' },
        { id: 'comenh3_i8', item: 'Papel térmico compatible instalado en orientación correcta y sin humedad o deterioro' },
        { id: 'comenh3_i9', item: 'Cable de alimentación/adaptador y enchufe sin cortes, empalmes, calentamiento o conductores expuestos' },
        { id: 'comenh3_i10', item: 'Batería sin deformación, fuga, calentamiento, sulfatación ni mensaje de falla persistente' },
        { id: 'comenh3_i11', item: 'Puertos USB/red y conectores auxiliares sin obstrucción, daño físico ni pines deformados' },
        { id: 'comenh3_i12', item: 'Rotulación de modelo, serial, activo fijo, advertencias y fecha de mantenimiento legibles' }
      ],
      verificacionBasica: [
        { id: 'comenh3_v1', item: 'Encendido con alimentación AC', valorEsperado: 'Equipo inicia sin errores técnicos persistentes y muestra pantalla principal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'comenh3_v2', item: 'Encendido/conmutación a batería', valorEsperado: 'Equipo opera con batería sin reinicio inesperado y muestra nivel de carga', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'comenh3_v3', item: 'Configuración de fecha, hora, velocidad y ganancia', valorEsperado: 'Permite configurar 25 mm/s y 10 mm/mV o parámetros institucionales', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'comenh3_v4', item: 'Detección de derivaciones conectadas/desconectadas', valorEsperado: 'Muestra señal estable o mensaje de lead off al retirar derivación', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'comenh3_v5', item: 'Impresión manual/automática', valorEsperado: 'Imprime tira o reporte con trazo legible y avance regular del papel', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'comenh3_v6', item: 'Pantalla táctil y navegación de menús', valorEsperado: 'Responde correctamente a selección de paciente, modo y archivo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'comenh3_v7', item: 'Almacenamiento/revisión de registros si aplica', valorEsperado: 'Permite guardar, visualizar o exportar registros sin error', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'comenh3_v8', item: 'Limpieza final y accesorios', valorEsperado: 'Equipo queda limpio, con cable enrollado sin tensión y papel instalado', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'comenh3_pf1', prueba: 'ECG 12 derivaciones con simulador a 60 BPM', valorEsperado: 'Frecuencia 60 BPM ± 1 BPM y trazos visibles en derivaciones configuradas', resultado: ['Pasa', 'Falla'] },
        { id: 'comenh3_pf2', prueba: 'ECG con simulador a 120 BPM', valorEsperado: 'Frecuencia 120 BPM ± 1 BPM sin pérdida de señal', resultado: ['Pasa', 'Falla'] },
        { id: 'comenh3_pf3', prueba: 'Ganancia 10 mm/mV con señal de 1 mV', valorEsperado: 'Amplitud impresa/visual aproximada de 10 mm ± tolerancia institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'comenh3_pf4', prueba: 'Velocidad de impresión 25 mm/s', valorEsperado: 'Cuadrícula y señal impresas con velocidad correcta según patrón', resultado: ['Pasa', 'Falla'] },
        { id: 'comenh3_pf5', prueba: 'Velocidad de impresión 50 mm/s si aplica', valorEsperado: 'Registro duplicado en velocidad sin distorsión excesiva', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'comenh3_pf6', prueba: 'Filtro de red/músculo/línea base', valorEsperado: 'Filtros se activan/desactivan y reducen artefactos simulados sin bloquear señal', resultado: ['Pasa', 'Falla'] },
        { id: 'comenh3_pf7', prueba: 'Detección lead-off por desconexión de derivación', valorEsperado: 'Mensaje o indicador de derivación desconectada en pantalla', resultado: ['Pasa', 'Falla'] },
        { id: 'comenh3_pf8', prueba: 'Impresión de reporte de 12 derivaciones', valorEsperado: 'Reporte completo, legible, con identificación, fecha/hora y trazos continuos', resultado: ['Pasa', 'Falla'] },
        { id: 'comenh3_pf9', prueba: 'Batería: operación mínima de prueba de 5 minutos', valorEsperado: 'Equipo permanece encendido y funcional sin caída abrupta de carga', resultado: ['Pasa', 'Falla'] },
        { id: 'comenh3_pf10', prueba: 'Carga de batería con AC', valorEsperado: 'Indicador de carga activo y sin calentamiento anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'comenh3_pf11', prueba: 'Exportación USB o comunicación si aplica', valorEsperado: 'Reconoce medio/puerto y permite operación configurada sin error', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'comenh3_pf12', prueba: 'Seguridad eléctrica visual/instrumental según disponibilidad', valorEsperado: 'Cable, tierra, fuga y carcasa cumplen norma institucional para equipo Clase I/BF si aplica', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa del electrocardiógrafo, cable paciente, pinzas y compartimiento de papel',
        'Verificación de alimentación AC, batería, pantalla, teclado e impresora',
        'Pruebas con simulador ECG de 12 derivaciones y registro impreso',
        'Revisión de accesorios y retiro de cables/electrodos deteriorados',
        'Solicitud de correctivo si presenta error ECG, falla de impresora, batería o seguridad eléctrica'
      ]
    },

    'humidificador_fisher_paykel_mr850': {
      nombre: 'Humidificador Fisher & Paykel MR850',
      categoria: 'Biomédico / Terapia respiratoria',
      codigo: 'SLV-GAT-BIO-HUM-FP-MR850',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el humidificador MR850 del uso clínico y confirme que no esté conectado a paciente, ventilador o circuito activo.',
        'Use cámara humidificadora, circuito, adaptadores y sensores de temperatura compatibles; no reutilice consumibles desechables fuera de política institucional.',
        'Verifique disponibilidad de analizador/termómetro calibrado, simulador o banco de prueba para temperatura de cámara/vía aérea y probador de seguridad eléctrica.',
        'No sumerja el equipo, no esterilice la base calefactora y evite ingreso de líquidos a conectores, panel o toma de corriente.',
        'Instale el humidificador en superficie estable, riel o soporte aprobado; verifique que la cámara quede correctamente asentada sobre la placa calefactora.',
        'No opere el equipo sin cámara adecuada o con sensor de temperatura dañado/desconectado durante prueba funcional.',
        'Las reparaciones internas, calibraciones de fábrica, cambio de placa, transformador o componentes de potencia deben ser realizadas por personal calificado.',
        'Si se evidencian alarmas no funcionales, sobrecalentamiento, falla de sensor, daño de placa calefactora o seguridad eléctrica no conforme, retire el equipo de servicio.'
      ],
      inspeccion: [
        { id: 'mr850_i1', item: 'Carcasa del MR850 limpia, sin fisuras, golpes, decoloración térmica, deformación, corrosión o piezas sueltas' },
        { id: 'mr850_i2', item: 'Panel frontal, botones, indicadores y pantalla legibles, sin teclas hundidas, rotas o sin respuesta' },
        { id: 'mr850_i3', item: 'Placa calefactora limpia, lisa, sin residuos, corrosión, rayones profundos, quemaduras o deformación' },
        { id: 'mr850_i4', item: 'Conector del sensor de temperatura íntegro, sin pines doblados, humedad, sulfatación o falso contacto' },
        { id: 'mr850_i5', item: 'Cable/sensor de temperatura de vía aérea y cámara sin cortes, peladuras, aplastamiento o daño del encapsulado' },
        { id: 'mr850_i6', item: 'Cable de alimentación, clavija y puesta a tierra sin cortes, empalmes, calentamiento ni aislamiento expuesto' },
        { id: 'mr850_i7', item: 'Sistema de montaje, abrazadera o riel firme y sin holgura, tornillos flojos o riesgo de caída' },
        { id: 'mr850_i8', item: 'Cámara humidificadora de prueba compatible, limpia, sin fisuras, fugas o deformación' },
        { id: 'mr850_i9', item: 'Circuito respiratorio de prueba y adaptadores limpios, completos, sin obstrucción, humedad excesiva o daño visible' },
        { id: 'mr850_i10', item: 'Etiqueta de modelo MR850, serial, advertencias y activo fijo legibles' }
      ],
      verificacionBasica: [
        { id: 'mr850_v1', item: 'Encendido con red eléctrica', valorEsperado: 'Equipo inicia autoverificación y muestra indicadores sin error persistente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mr850_v2', item: 'Selección/identificación de modo invasivo', valorEsperado: 'Equipo permite operar en modo invasivo según circuito instalado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mr850_v3', item: 'Selección/identificación de modo no invasivo si aplica', valorEsperado: 'Equipo permite operar en modo no invasivo según configuración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mr850_v4', item: 'Reconocimiento del sensor de temperatura', valorEsperado: 'No presenta alarma de sensor desconectado con sensor instalado correctamente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mr850_v5', item: 'Alarma por sensor desconectado', valorEsperado: 'Al retirar sensor genera alarma audible/visual correspondiente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mr850_v6', item: 'Calentamiento inicial de placa', valorEsperado: 'Placa calefactora aumenta temperatura de forma controlada sin olor o calentamiento anormal externo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mr850_v7', item: 'Indicadores de alarma y silencio/pausa', valorEsperado: 'Alarmas visibles/audibles operan y la función de silencio responde según diseño', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mr850_v8', item: 'Limpieza y montaje final', valorEsperado: 'Equipo queda limpio, seco y firme en soporte o superficie', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'mr850_pf1', prueba: 'Prueba de encendido y autodiagnóstico', valorEsperado: 'Sin códigos de error persistentes ni reinicios espontáneos', resultado: ['Pasa', 'Falla'] },
        { id: 'mr850_pf2', prueba: 'Modo invasivo con circuito/cámara de prueba', valorEsperado: 'Control térmico estable con cámara asentada y sensor instalado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mr850_pf3', prueba: 'Modo no invasivo si aplica', valorEsperado: 'Control térmico estable en configuración no invasiva', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mr850_pf4', prueba: 'Temperatura en salida de cámara', valorEsperado: 'Lectura dentro del rango esperado para modo seleccionado según manual/tolerancia institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'mr850_pf5', prueba: 'Temperatura en vía aérea', valorEsperado: 'Lectura estable y coherente con modo seleccionado, sin alarma injustificada', resultado: ['Pasa', 'Falla'] },
        { id: 'mr850_pf6', prueba: 'Alarma de sensor de temperatura desconectado', valorEsperado: 'Alarma audible/visual activa al desconectar sensor', resultado: ['Pasa', 'Falla'] },
        { id: 'mr850_pf7', prueba: 'Alarma de cámara/circuito mal instalado si aplica', valorEsperado: 'Equipo detecta condición insegura o genera mensaje/alarma correspondiente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mr850_pf8', prueba: 'Respuesta de placa calefactora', valorEsperado: 'Calienta y regula sin sobretemperatura, olor, chispa o daño de superficie', resultado: ['Pasa', 'Falla'] },
        { id: 'mr850_pf9', prueba: 'Prueba de estabilidad durante 15 minutos', valorEsperado: 'Temperatura estable sin alarmas recurrentes ni apagado inesperado', resultado: ['Pasa', 'Falla'] },
        { id: 'mr850_pf10', prueba: 'Verificación de montaje y tracción leve de cable/sensor', valorEsperado: 'Sin pérdida de lectura, falsos contactos o desprendimiento', resultado: ['Pasa', 'Falla'] },
        { id: 'mr850_pf11', prueba: 'Seguridad eléctrica visual/instrumental', valorEsperado: 'Tierra, fuga y cableado cumplen norma institucional para equipo Clase I tipo BF', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'mr850_pf12', prueba: 'Prueba final con accesorios instalados', valorEsperado: 'Equipo queda listo, sin alarmas activas y con accesorios retirados/limpios según corresponda', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa del humidificador, placa calefactora y conectores accesibles',
        'Revisión de sensor de temperatura, cable de alimentación, montaje y accesorios de prueba',
        'Verificación de modos, alarmas, calentamiento y estabilidad térmica',
        'Prueba de seguridad eléctrica si se dispone del analizador',
        'Solicitud de correctivo si presenta códigos de error, alarma ausente, falla térmica o fuga eléctrica'
      ]
    },

    'incubadora_transporte_medix_tr200': {
      nombre: 'Incubadora de Transporte MEDIX TR-200',
      categoria: 'Biomédico / Neonatología transporte',
      codigo: 'SLV-GAT-BIO-INC-TR200',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire la incubadora MEDIX TR-200 del uso clínico y confirme que no haya paciente, oxígeno conectado o accesorios activos antes del mantenimiento.',
        'Realice limpieza y desinfección previa de habitáculo, colchón, acrílicos, superficies, ruedas y accesorios según protocolo institucional.',
        'Use termómetro/analizador de incubadoras calibrado, probador de seguridad eléctrica, cronómetro, fuente AC y, si aplica, prueba de operación con batería/cargador TR-50/TR-54.',
        'Evite exposición a luz solar directa, fuentes radiantes, corrientes de aire o condiciones ambientales que alteren el balance térmico durante la prueba.',
        'No utilice la incubadora en presencia de anestésicos inflamables ni deje alcohol/éter u otros agentes inflamables dentro del habitáculo, especialmente con oxígeno.',
        'Verifique que cilindros, reguladores, mangueras de oxígeno y accesorios de transporte estén asegurados y libres de fugas si aplican.',
        'No intervenga módulos internos, tarjeta electrónica, resistencia, cargador o sistema de batería durante mantenimiento rutinario; remita a servicio técnico autorizado.',
        'Si presenta alarma no funcional, control térmico inestable, acrílicos dañados, falla de batería, fuga de oxígeno, ruedas/frenos inseguros o seguridad eléctrica no conforme, retire de servicio.'
      ],
      inspeccion: [
        { id: 'tr200_i1', item: 'Cúpula/acrílicos transparentes íntegros, limpios, sin fisuras, deformaciones, opacidad crítica, bordes cortantes o seguros rotos' },
        { id: 'tr200_i2', item: 'Puertas, portillos y empaques cierran correctamente, sin holguras, trabas dañadas o pérdida evidente de aislamiento térmico' },
        { id: 'tr200_i3', item: 'Colchón, bandeja porta-colchón y superficie neonatal limpios, secos, sin rasgaduras, deformación o contaminación' },
        { id: 'tr200_i4', item: 'Módulo de control removible firme, panel, displays y botones legibles, sin daño ni humedad' },
        { id: 'tr200_i5', item: 'Sensor de temperatura de aire/piel, si aplica, íntegro, limpio, sin cortes, falso contacto o encapsulado dañado' },
        { id: 'tr200_i6', item: 'Sistema de circulación de aire, rejillas y filtros accesibles limpios, sin obstrucción, polvo excesivo o cuerpos extraños' },
        { id: 'tr200_i7', item: 'Resistencia/calefactor sin olor, decoloración extrema, daño visible o contacto con material extraño' },
        { id: 'tr200_i8', item: 'Batería, cargador, conectores y cableado sin sulfatación, deformación, fuga, calentamiento o terminales flojos' },
        { id: 'tr200_i9', item: 'Cable de alimentación AC y conexión 12 VCC si aplica sin cortes, empalmes, calentamiento ni aislamiento expuesto' },
        { id: 'tr200_i10', item: 'Carro/base de transporte, manijas, ruedas, frenos y anclajes firmes, sin vibración, corrosión o riesgo de volcamiento' },
        { id: 'tr200_i11', item: 'Soporte de cilindro de oxígeno, regulador, mangueras y flujómetro si aplican asegurados y sin fuga visible' },
        { id: 'tr200_i12', item: 'Lámpara de examen, tomas auxiliares o accesorios instalados funcionales y físicamente seguros si aplican' },
        { id: 'tr200_i13', item: 'Rotulación TR-200, serial, advertencias, alarmas, activo fijo y fecha de mantenimiento legibles' }
      ],
      verificacionBasica: [
        { id: 'tr200_v1', item: 'Encendido con red AC', valorEsperado: 'Equipo inicia sin error persistente y controla automáticamente la temperatura', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_v2', item: 'Operación con batería/12 VCC si aplica', valorEsperado: 'Equipo conmuta y mantiene funcionamiento sin apagado inesperado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_v3', item: 'Display de temperatura de aire', valorEsperado: 'Lectura legible, estable y coherente con patrón ambiental', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_v4', item: 'Ajuste de temperatura de control', valorEsperado: 'Permite seleccionar valor dentro del rango operativo sin bloqueo de teclas', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_v5', item: 'Alarma audible y visual general', valorEsperado: 'Indicadores y buzzer funcionan durante prueba de alarma', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_v6', item: 'Alarma de falla de energía', valorEsperado: 'Al interrumpir AC genera alarma o indicación correspondiente con batería disponible', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_v7', item: 'Cierre de portillos y puertas', valorEsperado: 'Cierre seguro sin aperturas espontáneas y sin empaques desprendidos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_v8', item: 'Frenos y ruedas', valorEsperado: 'Frenos bloquean y ruedas giran sin vibración anormal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_v9', item: 'Oxígeno/accesorios de transporte si aplican', valorEsperado: 'Sistema asegurado, sin fugas y con flujómetro/regulador funcional', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'tr200_pf1', prueba: 'Prueba de calentamiento inicial con setpoint 34 °C', valorEsperado: 'Equipo inicia calentamiento y aproxima temperatura sin alarma anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'tr200_pf2', prueba: 'Estabilidad térmica a 34 °C', valorEsperado: 'Temperatura estable dentro de tolerancia institucional/fabricante tras estabilización', resultado: ['Pasa', 'Falla'] },
        { id: 'tr200_pf3', prueba: 'Ajuste a temperatura superior dentro de rango operativo', valorEsperado: 'Equipo responde aumentando potencia y temperatura de forma controlada', resultado: ['Pasa', 'Falla'] },
        { id: 'tr200_pf4', prueba: 'Comparación display vs analizador de incubadora', valorEsperado: 'Diferencia dentro de tolerancia institucional/metrológica definida', resultado: ['Pasa', 'Falla'] },
        { id: 'tr200_pf5', prueba: 'Uniformidad térmica en habitáculo', valorEsperado: 'Diferencia entre puntos de medición dentro de tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_pf6', prueba: 'Alarma de temperatura alta', valorEsperado: 'Al superar umbral o simular condición se activa alarma audible/visual', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_pf7', prueba: 'Alarma de temperatura baja o desviación', valorEsperado: 'Al descender/desviar temperatura se activa alarma correspondiente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_pf8', prueba: 'Alarma de falla de sensor', valorEsperado: 'Desconexión/simulación de sensor genera mensaje o alarma', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_pf9', prueba: 'Prueba de batería/autonomía funcional básica', valorEsperado: 'Opera en batería durante prueba mínima sin apagado ni caída crítica', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_pf10', prueba: 'Ventilador/circulación de aire', valorEsperado: 'Circulación uniforme sin ruido excesivo, vibración o bloqueo', resultado: ['Pasa', 'Falla'] },
        { id: 'tr200_pf11', prueba: 'Sistema de oxígeno de transporte si aplica', valorEsperado: 'Regulador/flujómetro entregan flujo estable y sin fugas detectables', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_pf12', prueba: 'Lámpara de examen y accesorios eléctricos si aplican', valorEsperado: 'Funcionan sin parpadeo, calentamiento anormal o falso contacto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_pf13', prueba: 'Seguridad eléctrica visual/instrumental', valorEsperado: 'Tierra, fuga y cableado cumplen norma institucional para equipo Clase I tipo B/BF según configuración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'tr200_pf14', prueba: 'Prueba final de transporte', valorEsperado: 'Puertas, ruedas, frenos, manijas y accesorios permanecen seguros durante desplazamiento corto', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa y revisión de habitáculo, acrílicos, colchón, portillos y superficies de contacto',
        'Verificación de módulo de control, calentamiento, alarmas, batería y cargador',
        'Comparación de temperatura con patrón/analizador de incubadora y prueba de estabilidad',
        'Revisión de carro, ruedas, frenos, soportes, oxígeno y accesorios de transporte',
        'Solicitud de correctivo especializado si no cumple control térmico, alarmas, batería, oxígeno o seguridad eléctrica'
      ]
    },

    'drager_bililux': {
      nombre: 'Lámpara de Fototerapia / Calor Radiante Dräger BiliLux',
      categoria: 'Biomédico / Neonatal / Fototerapia',
      codigo: 'SLV-GAT-BIO-FOTO-DRAGER-BILILUX',
      frecuencia: ['Trimestral', 'Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire la unidad Dräger BiliLux del uso clínico y confirme que no haya paciente bajo tratamiento antes de iniciar el mantenimiento preventivo.',
        'Desconecte la alimentación eléctrica antes de limpieza o inspección física. Energice únicamente durante las pruebas funcionales controladas.',
        'Use protección visual si se requiere encender la fuente de fototerapia. No mire directamente los LED ni exponga personal innecesariamente a la luz azul.',
        'Verifique disponibilidad de radiómetro/fotómetro calibrado para fototerapia, analizador de seguridad eléctrica y elementos de limpieza compatibles.',
        'No cubra ventilaciones, sensores, cabezal o disipadores durante la prueba. No utilice el equipo si presenta sobrecalentamiento, olor anormal o alarmas persistentes.',
        'No abra el cabezal LED ni la fuente de alimentación durante mantenimiento preventivo rutinario; las reparaciones internas deben ser realizadas por personal calificado.',
        'Si la irradiancia, uniformidad, temporizador, alarmas, montaje o seguridad eléctrica no cumplen, retire de servicio y genere correctivo especializado.'
      ],
      inspeccion: [
        { id: 'bililux_i1', item: 'Cabezal LED íntegro, limpio, sin fisuras, golpes, deformación, humedad, corrosión, piezas sueltas o modificación no autorizada' },
        { id: 'bililux_i2', item: 'Lente/ventana óptica limpia, transparente, sin rayones críticos, manchas, opacidad, residuos de desinfectante o material adherido' },
        { id: 'bililux_i3', item: 'Panel de control, pantalla, botones, indicadores y etiquetas legibles, sin atascamiento, membrana rota o pérdida de símbolos' },
        { id: 'bililux_i4', item: 'Cable de alimentación, clavija, prensa-cable y puesta a tierra sin cortes, aplastamiento, calentamiento, sulfatación o reparaciones improvisadas' },
        { id: 'bililux_i5', item: 'Brazo, soporte, riel o base de montaje firmes, con ajuste de posición estable, sin holguras, inclinación involuntaria o riesgo de caída' },
        { id: 'bililux_i6', item: 'Rejillas/ventilaciones libres de polvo, pelusa u obstrucciones; disipación térmica sin bloqueo visible' },
        { id: 'bililux_i7', item: 'Módulo LED sin zonas apagadas, parpadeo, cambio de color anormal, baja intensidad visible o sombras no justificadas' },
        { id: 'bililux_i8', item: 'Sensor de distancia o indicador de posicionamiento, si aplica, limpio, visible y sin daño físico' },
        { id: 'bililux_i9', item: 'Temporizador, contador de horas o registro de terapia visible y funcional si aplica' },
        { id: 'bililux_i10', item: 'Compatibilidad de ubicación con incubadora/cuna, sin contacto con superficies calientes ni interferencia con accesos al paciente' },
        { id: 'bililux_i11', item: 'Rotulación de marca, modelo, serial, activo fijo, advertencias ópticas y fecha de mantenimiento legibles' },
        { id: 'bililux_i12', item: 'Limpieza externa final realizada con producto compatible, superficies secas y sin residuos químicos' }
      ],
      verificacionBasica: [
        { id: 'bililux_v1', item: 'El equipo enciende correctamente y completa autoverificación inicial sin códigos de falla persistentes' },
        { id: 'bililux_v2', item: 'La pantalla/indicadores muestran modo, tiempo, intensidad o estado de funcionamiento de forma legible' },
        { id: 'bililux_v3', item: 'Los controles de inicio, pausa, ajuste de intensidad y apagado responden sin bloqueo' },
        { id: 'bililux_v4', item: 'El temporizador inicia, cuenta, pausa y reinicia según configuración disponible' },
        { id: 'bililux_v5', item: 'La fuente LED enciende de forma uniforme, sin parpadeo ni apagado espontáneo' },
        { id: 'bililux_v6', item: 'Las alarmas/avisos audibles y visuales disponibles se activan y silencian conforme a condición de prueba' },
        { id: 'bililux_v7', item: 'El brazo o soporte mantiene la posición de trabajo sin desplazamiento involuntario' },
        { id: 'bililux_v8', item: 'El equipo queda limpio, identificado y disponible o retirado de servicio según estado final' }
      ],
      pruebasFuncionales: [
        { id: 'bililux_pf1', prueba: 'Encendido y autoprueba', valorEsperado: 'Equipo inicia sin error, pantalla e indicadores operativos y sin reinicios', resultado: ['Pasa', 'Falla'] },
        { id: 'bililux_pf2', prueba: 'Irradiancia central con radiómetro calibrado a distancia de uso institucional', valorEsperado: 'Lectura dentro del rango definido por fabricante/institución para fototerapia efectiva', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bililux_pf3', prueba: 'Uniformidad de irradiancia en al menos cinco puntos del campo', valorEsperado: 'Campo homogéneo, sin zonas oscuras críticas o variaciones fuera de criterio institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bililux_pf4', prueba: 'Ajuste de intensidad disponible', valorEsperado: 'Cada nivel modifica irradiancia de forma coherente y estable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bililux_pf5', prueba: 'Temporizador de tratamiento', valorEsperado: 'Cuenta de tiempo coherente, pausa/reinicio funcional y alarma/aviso al finalizar si aplica', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bililux_pf6', prueba: 'Estabilidad durante 10 minutos de operación', valorEsperado: 'Sin sobrecalentamiento, olor anormal, parpadeo, alarma injustificada o caída evidente de intensidad', resultado: ['Pasa', 'Falla'] },
        { id: 'bililux_pf7', prueba: 'Alarma o aviso por falla/condición simulada disponible', valorEsperado: 'Alarma visual/audible opera y puede silenciarse/restablecerse según manual', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bililux_pf8', prueba: 'Estabilidad mecánica de brazo/soporte', valorEsperado: 'Cabezal permanece en posición, sin descenso, vibración, holgura o riesgo de caída', resultado: ['Pasa', 'Falla'] },
        { id: 'bililux_pf9', prueba: 'Verificación de distancia de trabajo', valorEsperado: 'Permite ubicar la lámpara a distancia recomendada sin interferir con paciente o accesorios', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bililux_pf10', prueba: 'Seguridad eléctrica con analizador', valorEsperado: 'Resistencia de tierra, aislamiento y corrientes de fuga dentro de límites IEC 60601/institucionales', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de cabezal, panel, soporte, cable y superficies accesibles',
        'Inspección de lente óptica, LED, cableado externo, montaje y rotulación',
        'Verificación de encendido, controles, temporizador, alarmas y estabilidad mecánica',
        'Medición de irradiancia y uniformidad con patrón/radiómetro calibrado si disponible',
        'Prueba de seguridad eléctrica externa según procedimiento institucional',
        'Registro de hallazgos, desviaciones y recomendación de correctivo o calibración/verificación especializada'
      ]
    },

    'laringoscopio_welch_allyn_60813': {
      nombre: 'Laringoscopio Welch Allyn 60813',
      categoria: 'Biomédico / Diagnóstico y vía aérea',
      codigo: 'SLV-GAT-BIO-LARING-WA-60813',
      frecuencia: ['Trimestral', 'Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el laringoscopio Welch Allyn 60813 del uso clínico y confirme que no esté contaminado antes del mantenimiento preventivo.',
        'Utilice elementos de protección personal y manipule hojas/mangos como dispositivo semicrítico que requiere reprocesamiento entre usos.',
        'Retire baterías antes de inspecciones internas del compartimiento, limpieza de contactos o almacenamiento prolongado.',
        'Use únicamente hojas, mangos, lámparas/LED, baterías y accesorios compatibles Welch Allyn/fibra óptica según configuración del equipo.',
        'No sumerja el mango si el manual no lo permite y evite ingreso de líquido al compartimiento de baterías o contactos eléctricos.',
        'No use el equipo con luz débil, intermitente, hoja floja, fibra óptica rota, corrosión, batería sulfatada o cierre inseguro.',
        'Si no cumple iluminación, acople, reprocesamiento, integridad mecánica o continuidad eléctrica, retire de servicio y genere correctivo/reposición.'
      ],
      inspeccion: [
        { id: 'wa60813_i1', item: 'Mango 60813 íntegro, limpio, sin golpes, fisuras, deformación, humedad, corrosión, piezas sueltas o modificación no autorizada' },
        { id: 'wa60813_i2', item: 'Tapa inferior/compartimiento de baterías con rosca o cierre funcional, sin sulfatación, residuos, resortes dañados o contactos flojos' },
        { id: 'wa60813_i3', item: 'Baterías compatibles, sin fuga, abombamiento, vencimiento, sulfatación o polaridad incorrecta' },
        { id: 'wa60813_i4', item: 'Contactos del mango limpios, brillantes, firmes y sin oxidación, grasa, líquido o pérdida de presión' },
        { id: 'wa60813_i5', item: 'Acople hoja-mango firme, con bloqueo adecuado y sin juego excesivo durante apertura/cierre' },
        { id: 'wa60813_i6', item: 'Interruptor por elevación de hoja activa la luz de forma inmediata, sin falso contacto o retardo anormal' },
        { id: 'wa60813_i7', item: 'Hojas compatibles presentes, limpias, sin bordes cortantes, fisuras, deformación, óxido, residuos o daño por reprocesamiento' },
        { id: 'wa60813_i8', item: 'Fibra óptica o guía de luz de la hoja íntegra, sin fracturas, opacidad, desprendimiento, quemaduras o baja transmisión' },
        { id: 'wa60813_i9', item: 'Lámpara/LED compatible sin parpadeo, ennegrecimiento, baja intensidad o daño visible' },
        { id: 'wa60813_i10', item: 'Estuche, separadores y almacenamiento limpios, secos, completos y sin elementos contaminados' },
        { id: 'wa60813_i11', item: 'Rotulación de marca, referencia, activo fijo y fecha de mantenimiento legibles' },
        { id: 'wa60813_i12', item: 'Registro de reprocesamiento/limpieza disponible conforme al procedimiento institucional' }
      ],
      verificacionBasica: [
        { id: 'wa60813_v1', item: 'El mango enciende al acoplar y elevar la hoja compatible' },
        { id: 'wa60813_v2', item: 'La luz es blanca/intensa, estable y sin parpadeo durante la manipulación' },
        { id: 'wa60813_v3', item: 'El acople mecánico mantiene la hoja firme en posición de uso' },
        { id: 'wa60813_v4', item: 'El apagado ocurre al cerrar/desacoplar la hoja sin quedar encendido permanentemente' },
        { id: 'wa60813_v5', item: 'La intensidad no cae al mover suavemente el mango, tapa y contactos' },
        { id: 'wa60813_v6', item: 'Las hojas disponibles presentan transmisión de luz adecuada y campo visual despejado' },
        { id: 'wa60813_v7', item: 'El equipo queda limpio, seco, reprocesado y almacenado en estuche/área segura' },
        { id: 'wa60813_v8', item: 'Se registra cambio de baterías, lámpara, hoja o accesorio si aplica' }
      ],
      pruebasFuncionales: [
        { id: 'wa60813_pf1', prueba: 'Encendido con hoja compatible', valorEsperado: 'Luz activa inmediatamente y permanece estable', resultado: ['Pasa', 'Falla'] },
        { id: 'wa60813_pf2', prueba: 'Prueba de intensidad visual comparativa', valorEsperado: 'Iluminación suficiente para visualización de vía aérea; sin luz débil o amarillenta anormal', resultado: ['Pasa', 'Falla'] },
        { id: 'wa60813_pf3', prueba: 'Prueba de falso contacto', valorEsperado: 'No se apaga ni parpadea al mover suavemente hoja, mango, tapa y batería', resultado: ['Pasa', 'Falla'] },
        { id: 'wa60813_pf4', prueba: 'Acople y bloqueo de hoja', valorEsperado: 'Hoja fija, sin juego excesivo, cierre seguro y activación correcta', resultado: ['Pasa', 'Falla'] },
        { id: 'wa60813_pf5', prueba: 'Transmisión de luz por fibra óptica', valorEsperado: 'Haz uniforme en extremo distal, sin sombras por fibra rota u opaca', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa60813_pf6', prueba: 'Verificación de limpieza/reprocesamiento', valorEsperado: 'Superficies libres de materia orgánica, humedad y residuos químicos visibles', resultado: ['Pasa', 'Falla'] },
        { id: 'wa60813_pf7', prueba: 'Compatibilidad de baterías', valorEsperado: 'Baterías instaladas correctamente, sin calentamiento ni sulfatación', resultado: ['Pasa', 'Falla'] },
        { id: 'wa60813_pf8', prueba: 'Inspección de hojas Mac/Miller disponibles', valorEsperado: 'Hojas sin deformación, bordes dañados, corrosión o daño de guía luminosa', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'wa60813_pf9', prueba: 'Apagado y almacenamiento final', valorEsperado: 'Equipo queda apagado, seco, completo y almacenado en lugar seguro', resultado: ['Pasa', 'Falla'] },
        { id: 'wa60813_pf10', prueba: 'Trazabilidad de mantenimiento', valorEsperado: 'Referencia, activo fijo y estado final documentados', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa e inspección de mango, hojas, contactos, baterías y estuche',
        'Verificación de acople hoja-mango, activación de luz y estabilidad de iluminación',
        'Revisión de fibra óptica/guía de luz, lámpara o LED y compatibilidad de accesorios',
        'Cambio de baterías o recomendación de cambio de lámpara/hoja si aplica',
        'Verificación de reprocesamiento, secado y almacenamiento final',
        'Registro de hallazgos y recomendación de retiro, reposición o correctivo especializado'
      ]
    },

    'neopuff_fisher_paykel_rd900asv': {
      nombre: 'Reanimador Neonatal Fisher & Paykel Neopuff RD900ASV',
      categoria: 'Biomédico / Neonatal / Reanimación',
      codigo: 'SLV-GAT-BIO-NEO-FP-RD900ASV',
      frecuencia: ['Mensual', 'Trimestral', 'Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el Neopuff RD900ASV del uso clínico y confirme que no esté conectado a paciente antes del mantenimiento preventivo.',
        'Verifique disponibilidad de fuente de gas regulada, blender si aplica, flujómetro, pulmón de prueba neonatal, manómetro patrón y accesorios compatibles.',
        'No conecte directamente a fuentes de presión no reguladas ni exceda presiones de entrada recomendadas por el fabricante.',
        'Realice limpieza externa con paño compatible; no sumerja el equipo ni permita ingreso de líquido a manómetro, válvulas o conexiones.',
        'Use circuito, pieza en T, mascarilla, tubo corrugado, válvula PEEP y accesorios limpios/desinfectados o desechables según política institucional.',
        'No utilice el equipo si presenta manómetro dañado, fuga, válvulas trabadas, PIP/PEEP inestables, presión excesiva o conexiones incompatibles.',
        'Si el equipo no regula PIP, PEEP, flujo o presión de alivio conforme a prueba, retire de servicio y genere correctivo/calibración.'
      ],
      inspeccion: [
        { id: 'neopuff_i1', item: 'Unidad Neopuff íntegra, limpia, sin golpes, fisuras, corrosión, humedad, piezas sueltas o modificación no autorizada' },
        { id: 'neopuff_i2', item: 'Manómetro visible, aguja en cero sin presión, escala legible, cubierta transparente sin fisuras ni empañamiento' },
        { id: 'neopuff_i3', item: 'Perilla/control de presión inspiratoria máxima PIP gira suavemente, sin bloqueo, juego excesivo o daño' },
        { id: 'neopuff_i4', item: 'Control de PEEP/válvula de salida funcional, limpio, sin obstrucción, grietas o residuos' },
        { id: 'neopuff_i5', item: 'Entrada de gas, conectores, roscas, adaptadores y mangueras sin fuga, desgaste, deformación o incompatibilidad' },
        { id: 'neopuff_i6', item: 'Tubo respiratorio, pieza en T, puerto de oclusión, mascarilla y adaptadores limpios, íntegros y compatibles' },
        { id: 'neopuff_i7', item: 'Válvula de alivio/presión máxima sin obstrucción, manipulación indebida o daño visible' },
        { id: 'neopuff_i8', item: 'Soporte, riel o montaje firme, sin riesgo de caída o tensión sobre mangueras' },
        { id: 'neopuff_i9', item: 'Flujómetro/blender asociado, si aplica, íntegro, calibrado y con lectura legible' },
        { id: 'neopuff_i10', item: 'Etiquetas de marca, modelo, serial, advertencias, sentido de conexión y activo fijo legibles' },
        { id: 'neopuff_i11', item: 'Pulmón de prueba y accesorios de verificación disponibles, limpios y sin fuga visible' },
        { id: 'neopuff_i12', item: 'Equipo seco, libre de residuos de gel, fluidos, polvo o material extraño en conexiones' }
      ],
      verificacionBasica: [
        { id: 'neopuff_v1', item: 'Con gas y flujo configurado, el manómetro responde de forma estable al ocluir la pieza en T' },
        { id: 'neopuff_v2', item: 'El control de PIP permite ajustar presión inspiratoria dentro de rango neonatal institucional' },
        { id: 'neopuff_v3', item: 'El control de PEEP mantiene presión espiratoria positiva estable con pulmón de prueba' },
        { id: 'neopuff_v4', item: 'No se evidencian fugas audibles en entradas, mangueras, pieza en T o conexiones' },
        { id: 'neopuff_v5', item: 'El manómetro retorna a cero al retirar presión y no queda pegado' },
        { id: 'neopuff_v6', item: 'La presión máxima/alivio no permite sobrepresión peligrosa durante prueba controlada' },
        { id: 'neopuff_v7', item: 'Los accesorios de paciente están completos y limpios/desinfectados o desechables' },
        { id: 'neopuff_v8', item: 'El equipo queda configurado, identificado y listo para uso o retirado según estado final' }
      ],
      pruebasFuncionales: [
        { id: 'neopuff_pf1', prueba: 'Prueba de fuga con circuito y pulmón neonatal', valorEsperado: 'Presión se mantiene estable, sin fuga audible ni caída significativa', resultado: ['Pasa', 'Falla'] },
        { id: 'neopuff_pf2', prueba: 'Ajuste de PIP a 20 cmH2O', valorEsperado: 'Manómetro/patrón muestra presión dentro de tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'neopuff_pf3', prueba: 'Ajuste de PIP a 30 cmH2O', valorEsperado: 'Presión estable y repetible, sin oscilaciones bruscas', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'neopuff_pf4', prueba: 'Ajuste de PEEP a 5 cmH2O', valorEsperado: 'PEEP estable durante ventilación manual con pieza en T', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'neopuff_pf5', prueba: 'Ajuste de PEEP a 8 cmH2O', valorEsperado: 'PEEP estable sin fuga ni bloqueo de válvula', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'neopuff_pf6', prueba: 'Ventilación manual simulada durante 1 minuto', valorEsperado: 'Ciclos consistentes, manómetro responde sin retardo ni pegado', resultado: ['Pasa', 'Falla'] },
        { id: 'neopuff_pf7', prueba: 'Verificación de flujo de entrada', valorEsperado: 'Flujo institucional definido permite presiones estables sin caída de fuente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'neopuff_pf8', prueba: 'Verificación de presión máxima/alivio', valorEsperado: 'No excede límite configurado o recomendado en prueba controlada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'neopuff_pf9', prueba: 'Comparación de manómetro con patrón', valorEsperado: 'Lecturas coherentes dentro de tolerancia metrológica definida', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'neopuff_pf10', prueba: 'Condición final de accesorios', valorEsperado: 'Circuito, pieza en T, mascarilla, manguera y pulmón de prueba disponibles y aptos', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa e inspección de unidad, manómetro, controles, mangueras y accesorios',
        'Verificación de conexiones de gas, flujo, PIP, PEEP y presión máxima/alivio',
        'Prueba con pulmón neonatal y comparación con patrón si disponible',
        'Revisión de circuitos, pieza en T, mascarillas, adaptadores y limpieza/desinfección',
        'Registro de presiones medidas, fugas, hallazgos y recomendaciones',
        'Remisión a correctivo/calibración si hay desviación de presión o falla de válvulas/manómetro'
      ]
    },

    'covidien_nellcor_pm10n': {
      nombre: 'Pulso Oxímetro Portátil Covidien Nellcor PM10N',
      categoria: 'Biomédico / Monitoreo',
      codigo: 'SLV-GAT-BIO-OXI-COVIDIEN-PM10N',
      frecuencia: ['Trimestral', 'Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el pulso oxímetro Covidien/Nellcor PM10N del uso clínico y confirme que no esté conectado a paciente antes del mantenimiento.',
        'Verifique disponibilidad de simulador de SpO₂/frecuencia de pulso compatible Nellcor, sensores compatibles, baterías AA nuevas y elementos de limpieza.',
        'Retire baterías si inspecciona el compartimiento o si el equipo será almacenado por tiempo prolongado.',
        'Use únicamente sensores, cables y accesorios compatibles Nellcor/Covidien/Medtronic según manual.',
        'No sumerja el monitor ni aplique líquidos directamente en pantalla, puerto de sensor o compartimiento de baterías.',
        'No utilice el equipo si presenta sensor dañado, lectura errática, alarmas inoperantes, puerto flojo, carcasa rota o baterías sulfatadas.',
        'Si el equipo no reconoce sensor, no mide SpO₂/PR o no activa alarmas, retire de servicio y genere correctivo.'
      ],
      inspeccion: [
        { id: 'pm10n_i1', item: 'Carcasa íntegra, limpia, sin fisuras, golpes, humedad, corrosión, deformaciones o piezas sueltas' },
        { id: 'pm10n_i2', item: 'Pantalla legible, sin manchas, líneas, segmentos ausentes, rayones críticos o bajo contraste' },
        { id: 'pm10n_i3', item: 'Botones/teclado responden sin atascamiento, membrana rota, desgaste excesivo o pérdida de símbolos' },
        { id: 'pm10n_i4', item: 'Puerto/conector de sensor SpO₂ firme, limpio, sin pines doblados, sulfatación o falso contacto' },
        { id: 'pm10n_i5', item: 'Sensor Nellcor y cable íntegros, sin cortes, aplastamiento, fisuras, suciedad, adhesivo deteriorado o conector dañado' },
        { id: 'pm10n_i6', item: 'Compartimiento de baterías limpio, con tapa funcional, contactos sin sulfatación y resortes firmes' },
        { id: 'pm10n_i7', item: 'Baterías AA en buen estado, sin fuga, abombamiento, vencimiento o polaridad incorrecta' },
        { id: 'pm10n_i8', item: 'Altavoz/alarma audible sin obstrucciones, suciedad o daño visible' },
        { id: 'pm10n_i9', item: 'Correa, funda o soporte si aplica limpio, íntegro y sin riesgo de caída' },
        { id: 'pm10n_i10', item: 'Etiquetas de marca, modelo, serial, activo fijo y advertencias legibles' },
        { id: 'pm10n_i11', item: 'Limpieza/desinfección externa compatible realizada, sin residuos químicos' },
        { id: 'pm10n_i12', item: 'Manual rápido o instrucciones de uso disponibles en el área si aplica' }
      ],
      verificacionBasica: [
        { id: 'pm10n_v1', item: 'El equipo enciende y completa prueba inicial sin error persistente' },
        { id: 'pm10n_v2', item: 'La pantalla muestra SpO₂, frecuencia de pulso, barra/indicador de pulso y estado de batería' },
        { id: 'pm10n_v3', item: 'Reconoce sensor conectado y muestra mensaje de sensor desconectado cuando se retira' },
        { id: 'pm10n_v4', item: 'Los botones permiten navegar, silenciar alarma y ajustar límites si la configuración lo permite' },
        { id: 'pm10n_v5', item: 'Alarmas audibles y visuales se activan por valores fuera de límite o pérdida de señal' },
        { id: 'pm10n_v6', item: 'El indicador de batería responde correctamente y no hay apagado inesperado' },
        { id: 'pm10n_v7', item: 'La lectura con simulador o sujeto de prueba es estable y coherente' },
        { id: 'pm10n_v8', item: 'El equipo queda limpio, con sensor funcional y listo para uso o retirado según estado final' }
      ],
      pruebasFuncionales: [
        { id: 'pm10n_pf1', prueba: 'Encendido y POST', valorEsperado: 'Inicio sin error, pantalla y alarmas iniciales operativas', resultado: ['Pasa', 'Falla'] },
        { id: 'pm10n_pf2', prueba: 'Simulación SpO₂ 97% / pulso 60 lpm', valorEsperado: 'Lecturas estables dentro de tolerancia del simulador/institución', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pm10n_pf3', prueba: 'Simulación SpO₂ 90% / pulso 120 lpm', valorEsperado: 'Lecturas coherentes y actualización sin retraso excesivo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pm10n_pf4', prueba: 'Alarma de SpO₂ baja', valorEsperado: 'Alarma visual/audible se activa al superar límite configurado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pm10n_pf5', prueba: 'Alarma de pulso alto/bajo', valorEsperado: 'Alarma visual/audible responde según límites configurados', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pm10n_pf6', prueba: 'Sensor desconectado o pérdida de señal', valorEsperado: 'Equipo muestra mensaje/alarma correspondiente sin congelar lectura falsa', resultado: ['Pasa', 'Falla'] },
        { id: 'pm10n_pf7', prueba: 'Silencio de alarma', valorEsperado: 'Silencia temporalmente y conserva indicador visual según configuración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'pm10n_pf8', prueba: 'Autonomía/estado de batería', valorEsperado: 'Funciona con baterías sin apagado espontáneo; indicador coherente', resultado: ['Pasa', 'Falla'] },
        { id: 'pm10n_pf9', prueba: 'Prueba de falso contacto del sensor', valorEsperado: 'No se interrumpe lectura al mover suavemente cable/conector', resultado: ['Pasa', 'Falla'] },
        { id: 'pm10n_pf10', prueba: 'Limpieza y disponibilidad final', valorEsperado: 'Monitor y sensor limpios, secos, identificados y disponibles', resultado: ['Pasa', 'Falla'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa de monitor, pantalla, botones, puerto y sensor compatible',
        'Inspección de carcasa, pantalla, teclado, conector, sensor, baterías y rotulación',
        'Prueba de encendido, lectura SpO₂/PR, alarmas, silencio y sensor desconectado',
        'Verificación con simulador de SpO₂/frecuencia de pulso si disponible',
        'Cambio de baterías o recomendación de cambio de sensor/cable si aplica',
        'Registro de hallazgos y retiro/correctivo si hay lectura errática o alarma inoperante'
      ]
    },

    'newport_ht70': {
      nombre: 'Ventilador Mecánico Newport HT70',
      categoria: 'Biomédico / Soporte ventilatorio',
      codigo: 'SLV-GAT-BIO-VENT-NEWPORT-HT70',
      frecuencia: ['Mensual', 'Trimestral', 'Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el ventilador Newport HT70 del uso clínico y confirme que no esté conectado a paciente antes del mantenimiento preventivo.',
        'Verifique disponibilidad de analizador de ventiladores calibrado, pulmón de prueba, analizador de oxígeno si aplica, analizador de seguridad eléctrica y circuito compatible.',
        'Conecte el equipo a red eléctrica segura y confirme estado de batería interna/externa antes de pruebas prolongadas.',
        'Use filtros, circuitos, adaptadores, sensor proximal y accesorios compatibles. No reutilice consumibles desechables fuera de política institucional.',
        'No bloquee entrada/salida de aire, ventilación, turbina ni filtros durante operación.',
        'No abra el equipo ni realice calibraciones internas durante mantenimiento preventivo rutinario sin autorización y manual de servicio.',
        'Si presenta alarma crítica, falla de batería, fuga, volumen/presión fuera de tolerancia, FiO₂ incorrecta o seguridad eléctrica no conforme, retire de servicio.'
      ],
      inspeccion: [
        { id: 'ht70_i1', item: 'Carcasa íntegra, limpia, sin golpes, fisuras, humedad, corrosión, piezas sueltas o modificación no autorizada' },
        { id: 'ht70_i2', item: 'Pantalla, membrana táctil/botones, perillas, indicadores y alarmas visuales legibles y sin daño' },
        { id: 'ht70_i3', item: 'Cable de alimentación, adaptador, clavija, prensa-cable y conexión a tierra sin daño, calentamiento o reparaciones improvisadas' },
        { id: 'ht70_i4', item: 'Batería interna y batería Power Pac/externa si aplica con carcasa íntegra, contactos limpios y retención firme' },
        { id: 'ht70_i5', item: 'Entrada de aire, filtros, ventilación y rejillas limpias, sin polvo, obstrucción, humedad o elementos extraños' },
        { id: 'ht70_i6', item: 'Puerto de paciente, salida inspiratoria, válvula espiratoria, sensor proximal y adaptadores limpios e íntegros' },
        { id: 'ht70_i7', item: 'Circuito respiratorio, tubuladuras, colectores de agua, filtros HME/antibacterianos y conectores sin fuga o daño visible' },
        { id: 'ht70_i8', item: 'Entrada de oxígeno de baja/alta presión o mezclador si aplica, con conexión firme y sin fuga audible' },
        { id: 'ht70_i9', item: 'Alarma audible, altavoz y buzzer sin obstrucción, suciedad o daño visible' },
        { id: 'ht70_i10', item: 'Asa, soporte, base, ruedas o montaje de transporte firmes, limpios y sin riesgo de caída' },
        { id: 'ht70_i11', item: 'Rotulación de marca, modelo, serial, activo fijo, advertencias y fecha de mantenimiento legibles' },
        { id: 'ht70_i12', item: 'Registro de horas/uso y mantenimiento mayor disponible para control de servicio especializado' }
      ],
      verificacionBasica: [
        { id: 'ht70_v1', item: 'El ventilador enciende y completa autoprueba inicial sin alarmas persistentes' },
        { id: 'ht70_v2', item: 'Pantalla permite seleccionar modo ventilatorio, parámetros, alarmas y tendencias sin bloqueo' },
        { id: 'ht70_v3', item: 'La turbina/compresor opera sin ruido anormal, vibración excesiva u olor a sobrecalentamiento' },
        { id: 'ht70_v4', item: 'El equipo ventila pulmón de prueba con circuito instalado sin fugas evidentes' },
        { id: 'ht70_v5', item: 'Alarmas de presión alta, desconexión, apnea, batería y alimentación se activan según prueba controlada' },
        { id: 'ht70_v6', item: 'Batería carga/descarga de forma funcional y el equipo cambia a batería al retirar red según prueba segura' },
        { id: 'ht70_v7', item: 'Oxígeno suplementario/FiO₂ si aplica muestra concentración coherente con analizador externo' },
        { id: 'ht70_v8', item: 'El ventilador queda limpio, con circuito de prueba retirado y disponible o retirado según estado final' }
      ],
      pruebasFuncionales: [
        { id: 'ht70_pf1', prueba: 'Autoprueba/encendido', valorEsperado: 'Inicio sin falla, pantalla y alarmas iniciales operativas', resultado: ['Pasa', 'Falla'] },
        { id: 'ht70_pf2', prueba: 'Ventilación volumen control con pulmón de prueba', valorEsperado: 'Volumen tidal medido dentro de tolerancia institucional/fabricante', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ht70_pf3', prueba: 'Ventilación presión control', valorEsperado: 'Presión inspiratoria medida estable y coherente con configuración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ht70_pf4', prueba: 'Frecuencia respiratoria y tiempo inspiratorio', valorEsperado: 'Valores medidos por analizador coinciden con parámetros configurados dentro de tolerancia', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ht70_pf5', prueba: 'PEEP', valorEsperado: 'PEEP medida estable y dentro de tolerancia', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ht70_pf6', prueba: 'Alarma de alta presión', valorEsperado: 'Se activa al ocluir circuito o alcanzar límite configurado, con señal audible/visual', resultado: ['Pasa', 'Falla'] },
        { id: 'ht70_pf7', prueba: 'Alarma de desconexión/baja presión', valorEsperado: 'Se activa al desconectar circuito del pulmón de prueba', resultado: ['Pasa', 'Falla'] },
        { id: 'ht70_pf8', prueba: 'Funcionamiento con batería', valorEsperado: 'Cambio a batería sin apagado, indicador correcto y alarma/aviso de alimentación conforme', resultado: ['Pasa', 'Falla'] },
        { id: 'ht70_pf9', prueba: 'FiO₂ con oxígeno suplementario si aplica', valorEsperado: 'Concentración medida coherente con configuración/fuente y dentro de tolerancia', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ht70_pf10', prueba: 'Prueba de fugas del circuito', valorEsperado: 'Fuga dentro de criterio institucional, sin desconexiones ni caída excesiva de presión', resultado: ['Pasa', 'Falla'] },
        { id: 'ht70_pf11', prueba: 'Silencio/restablecimiento de alarmas', valorEsperado: 'Silencia temporalmente y restablece según condición, conservando seguridad activa', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'ht70_pf12', prueba: 'Seguridad eléctrica con analizador', valorEsperado: 'Resistencia de tierra, aislamiento y corrientes de fuga dentro de límites IEC 60601/institucionales', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza externa e inspección de ventilador, pantalla, cables, baterías, filtros, puertos y accesorios',
        'Verificación de autoprueba, modos ventilatorios, alarmas, batería, circuito y entradas de oxígeno',
        'Prueba funcional con pulmón de prueba y analizador de ventiladores calibrado si disponible',
        'Verificación de volumen, presión, frecuencia, PEEP, alarmas, fugas y FiO₂ si aplica',
        'Prueba de seguridad eléctrica externa según procedimiento institucional',
        'Registro de horas, hallazgos y recomendación de mantenimiento mayor/correctivo especializado'
      ]
    },
    'marcapasos_biotronik_reocor': {
      nombre: 'Marcapasos Externo BIOTRONIK Reocor',
      categoria: 'Biomédico / Soporte vital / Marcapasos externo temporal',
      codigo: 'SLV-GAT-BIO-MP-REOCOR',
      frecuencia: ['Mensual', 'Trimestral', 'Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el marcapasos externo BIOTRONIK Reocor del uso clínico y confirme que no esté conectado a paciente antes de iniciar el mantenimiento preventivo.',
        'El equipo debe ser manipulado únicamente por personal entrenado en cardiología, tecnología biomédica o soporte técnico autorizado, debido a que se utiliza para estimulación cardíaca temporal.',
        'Tenga disponible un marcapasos externo de respaldo y baterías nuevas antes de retirar el equipo del servicio, especialmente si el área atiende pacientes dependientes de estimulación.',
        'Realice limpieza y desinfección externa previa conforme al protocolo institucional, evitando ingreso de líquidos en perillas, teclas, LEDs, altavoz, compartimento de batería, conector Redel, adaptador o cables de paciente.',
        'No sumerja el equipo, cables ni adaptadores; no use autoclave, ultrasonido, solventes agresivos, aerosoles directos, abrasivos ni agentes que deterioren policarbonato, etiquetas o conectores.',
        'Retire las baterías antes de inspección prolongada o almacenamiento. Use únicamente baterías del tipo y calidad recomendados por el fabricante y verifique polaridad correcta.',
        'Verifique disponibilidad e integridad de adaptador ADAPT S/ADAPT D o Redel, cables de paciente compatibles, tapas protectoras, bolsa/soporte, manual de usuario y accesorios autorizados por BIOTRONIK.',
        'No abra la carcasa, no ajuste circuitos internos, no modifique firmware, no repare conectores, perillas, altavoz, etapa de salida ni contactos de batería durante mantenimiento preventivo rutinario.',
        'Las reparaciones, calibraciones internas, modificaciones o reemplazo de partes internas deben ser realizadas por BIOTRONIK o servicio técnico expresamente autorizado.',
        'Si el equipo ha estado expuesto a desfibrilación, caída, humedad, golpe, derrame, interferencia electromagnética, alarma técnica persistente o falla de autoprueba, retírelo de servicio y genere correctivo especializado.',
        'Durante las pruebas use simulador/analizador de marcapasos externo o carga de prueba adecuada. No conecte el equipo a un paciente durante mantenimiento preventivo.',
        'Después de encender el equipo permita que realice la autoprueba inicial y confirme que no aparezcan alarmas o señales de falla técnica antes de continuar.'
      ],
      inspeccion: [
        { id: 'reocor_i1', item: 'Carcasa del marcapasos íntegra, limpia, sin fisuras, deformaciones, golpes, humedad, corrosión, residuos, adhesivos no autorizados o evidencia de apertura' },
        { id: 'reocor_i2', item: 'Panel frontal legible, sin desgaste crítico en escala de frecuencia, amplitud, sensibilidad, modo, burst y símbolos de seguridad' },
        { id: 'reocor_i3', item: 'Perillas, selectores, botones y cubierta protectora con movimiento firme, sin juego excesivo, bloqueo, desprendimiento, falsos contactos o posiciones ilegibles' },
        { id: 'reocor_i4', item: 'LEDs e indicadores visuales de batería, sensado y estimulación visibles, sin mica opaca, rota o hundida' },
        { id: 'reocor_i5', item: 'Altavoz o señal acústica sin obstrucción, daño mecánico o residuos que afecten la audibilidad de alarmas' },
        { id: 'reocor_i6', item: 'Compartimento de batería limpio, seco, sin sulfato, corrosión, resortes vencidos, contactos flojos, tapa rota o cierre inseguro' },
        { id: 'reocor_i7', item: 'Baterías instaladas vigentes, sin fuga, abombamiento, corrosión, fecha vencida o mezcla de tecnologías/marcas no recomendadas' },
        { id: 'reocor_i8', item: 'Conector Redel / adaptador ADAPT S o ADAPT D limpio, firme, sin pines doblados, fisuras, holgura, humedad o dificultad para asegurar el acople' },
        { id: 'reocor_i9', item: 'Cables de paciente y adaptadores compatibles íntegros, con aislamiento sin cortes, peladuras, rigidez, falsos contactos, pinzas sueltas o terminales contaminados' },
        { id: 'reocor_i10', item: 'Sujetador, bolsa, soporte para atril o sistema de fijación funcional, sin riesgo de caída del equipo durante traslado o uso clínico' },
        { id: 'reocor_i11', item: 'Rotulación de marca BIOTRONIK, modelo Reocor, número de serie, activo fijo, advertencias, símbolos y fecha de mantenimiento legibles y coherentes con inventario' },
        { id: 'reocor_i12', item: 'Accesorios disponibles según configuración: cable auricular/ventricular si aplica, adaptador, manual, guía rápida y baterías de respaldo' },
        { id: 'reocor_i13', item: 'Superficies externas desinfectadas, secas y sin residuos químicos en áreas de contacto con usuario o paciente' },
        { id: 'reocor_i14', item: 'No se evidencian modificaciones no autorizadas, sellos rotos, partes faltantes, puentes eléctricos, cinta, empalmes o accesorios no compatibles' },
        { id: 'reocor_i15', item: 'Equipo almacenado en área limpia, seca, protegida de golpes, calor excesivo, humedad, campos electromagnéticos intensos y elementos contaminados' }
      ],
      verificacion: [
        { id: 'reocor_v1', item: 'Encendido y autoprueba inicial', valorEsperado: 'El equipo enciende, ejecuta autoprueba por unos segundos y no presenta alarma técnica persistente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_v2', item: 'Indicador de batería', valorEsperado: 'No se activa alarma/LED de batería baja con baterías nuevas o vigentes', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_v3', item: 'Señal acústica de alarma', valorEsperado: 'Alarma audible, clara y suficiente para el entorno clínico', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_v4', item: 'LED de estimulación', valorEsperado: 'El LED de estimulación se activa de forma sincronizada con los pulsos configurados', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_v5', item: 'LED de sensado', valorEsperado: 'El LED de sensado responde a señales simuladas dentro del rango de sensibilidad configurado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_v6', item: 'Conexión de cable/adaptador', valorEsperado: 'El cable se fija correctamente al conector y no se interrumpe la señal con movimiento suave', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_v7', item: 'Cambio de modo de estimulación disponible según versión', valorEsperado: 'Permite seleccionar modos disponibles sin bloqueo ni salto irregular del selector', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_v8', item: 'Prueba de estimulación asíncrona', valorEsperado: 'Genera pulsos a la frecuencia seleccionada sobre analizador/carga de prueba', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_v9', item: 'Prueba de estimulación inhibida/sensada', valorEsperado: 'Inhibe o responde según el modo seleccionado y la señal simulada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_v10', item: 'Función burst si aplica', valorEsperado: 'La función se activa únicamente bajo control del operador y retorna a operación segura al liberarla/desactivarla', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_v11', item: 'Apagado del equipo', valorEsperado: 'El equipo apaga correctamente sin reinicios espontáneos ni indicadores activos', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'reocor_pf1', prueba: 'Verificación de frecuencia de estimulación — Configurar 60 ppm en modo asíncrono sobre analizador', valorEsperado: 'Frecuencia medida coincide con la configuración dentro de tolerancia del fabricante/protocolo institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf2', prueba: 'Verificación de frecuencia intermedia — Configurar 100 ppm sobre analizador', valorEsperado: 'Frecuencia estable, sin pausas, duplicidad de pulsos o variación anormal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf3', prueba: 'Verificación de frecuencia alta — Configurar un valor alto permitido por el selector', valorEsperado: 'El equipo entrega pulsos estables y genera advertencia acústica si corresponde a configuración crítica', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf4', prueba: 'Amplitud de pulso baja — Configurar amplitud baja y medir en analizador', valorEsperado: 'Amplitud medida corresponde al valor seleccionado dentro de tolerancia definida', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf5', prueba: 'Amplitud de pulso media/alta — Configurar amplitud clínica habitual y medir salida', valorEsperado: 'Amplitud estable, sin caída, saturación, interrupción o alarma técnica', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf6', prueba: 'Ancho/duración de pulso si el analizador lo permite', valorEsperado: 'Duración de pulso dentro de especificación del fabricante o criterio institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf7', prueba: 'Sensibilidad — Inyectar señal simulada en el canal correspondiente', valorEsperado: 'El equipo detecta el evento simulado y muestra indicador de sensado sin falsos positivos persistentes', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf8', prueba: 'Inhibición por sensado — Modo SSI/VVI/AAI según versión y señal simulada superior al umbral', valorEsperado: 'La estimulación se inhibe correctamente ante eventos simulados detectados', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf9', prueba: 'Estimulación ante ausencia de sensado', valorEsperado: 'El equipo reanuda estimulación a la frecuencia configurada cuando no hay señal simulada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf10', prueba: 'Alarma de desconexión/impedancia de electrodo si aplica', valorEsperado: 'El equipo identifica condición de circuito abierto o impedancia fuera de rango según configuración/analizador', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf11', prueba: 'Batería — prueba con batería vigente y revisión de contacto', valorEsperado: 'Sin reinicios al mover suavemente el equipo; contactos firmes y sin activación de batería baja', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf12', prueba: 'Alarmas visuales y acústicas', valorEsperado: 'Indicadores y tonos se activan cuando corresponde y son reconocibles por el operador', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf13', prueba: 'Prueba de cable de paciente', valorEsperado: 'Continuidad eléctrica correcta, aislamiento íntegro y ausencia de falsos contactos al flexionar suavemente el cable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf14', prueba: 'Verificación mecánica del soporte/bolsa de transporte', valorEsperado: 'El equipo queda seguro, visible y accesible para el operador sin riesgo de caída', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf15', prueba: 'Prueba de seguridad eléctrica externa si aplica por programa institucional', valorEsperado: 'Al ser equipo alimentado por batería, se verifica integridad externa; si se mide, cumple límites institucionales aplicables', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'reocor_pf16', prueba: 'Verificación final posterior a limpieza', valorEsperado: 'Equipo seco, desinfectado, funcional, con baterías adecuadas, accesorios completos y listo para uso o almacenamiento', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      accionesRealizadas: [
        'Limpieza y desinfección externa del marcapasos, panel, carcasa, conectores, adaptador, cables y accesorios compatibles',
        'Inspección física de carcasa, perillas, botones, LEDs, altavoz, compartimento de batería, conector Redel/ADAPT y sistema de sujeción',
        'Revisión y cambio de baterías si se encuentran vencidas, descargadas, sulfatadas o no conformes',
        'Verificación de encendido, autoprueba, indicadores visuales, alarmas acústicas y apagado seguro',
        'Pruebas funcionales con analizador/simulador de marcapasos externo: frecuencia, amplitud, sensibilidad, inhibición y salida de pulso',
        'Prueba de continuidad e integridad de cables de paciente y adaptadores autorizados',
        'Retiro de servicio y generación de correctivo si se detectan fallas de salida, sensado, batería, alarmas, conectores, cableado o autoprueba',
        'Registro de valores medidos, patrón utilizado, hallazgos, estado final, responsable y próxima fecha de mantenimiento'
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      recomendaciones: [
        'Mantener un equipo de respaldo y baterías nuevas disponibles en las áreas donde se utilice estimulación temporal.',
        'No almacenar el equipo con baterías deterioradas o vencidas; revisar el compartimento periódicamente para evitar sulfatación.',
        'Usar únicamente cables, adaptadores y accesorios autorizados por BIOTRONIK.',
        'Retirar de servicio el equipo ante cualquier falla de autoprueba, salida de pulso, sensado, alarma, conector o daño físico.'
      ]
    },


    'monitor_mindray_benevision_n12': {
      nombre: 'Monitor de Signos Vitales Mindray BeneVision N12',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-BVN12',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el monitor BeneVision N12 del uso clínico y confirme que no esté conectado a ningún paciente antes del mantenimiento preventivo.',
        'Realice limpieza y desinfección externa con productos compatibles, evitando ingreso de líquidos en pantalla táctil, módulos, conectores, ventilaciones, registrador, batería y fuente.',
        'Use simulador multiparámetro calibrado para ECG, RESP, SpO2, NIBP, temperatura y, si aplica, IBP/CO2; no realice pruebas con paciente.',
        'Verifique que los módulos, rack, cable ECG, sensor SpO2, brazalete NIBP, manguera, sondas de temperatura, batería y cable de alimentación sean compatibles con Mindray.',
        'Permita la autoverificación de encendido y confirme ausencia de mensajes técnicos persistentes antes de iniciar las pruebas funcionales.',
        'No abra la unidad principal, módulos, fuente, batería ni tarjetas internas durante mantenimiento preventivo rutinario; los ajustes internos y reparaciones corresponden a servicio autorizado.',
        'Si se detectan fallas de alarmas, desviación de parámetros, fuga neumática, falla de batería, daño de módulos o errores persistentes, retire el equipo de servicio y genere correctivo.'
      ],
      inspeccion: [
        { id: 'bvn12_i1', item: 'Unidad principal N12, carcasa, biseles, asa y soporte sin fisuras, golpes, deformación, partes sueltas, humedad o signos de caída' },
        { id: 'bvn12_i2', item: 'Pantalla táctil de 12,1 pulgadas aproximadamente limpia, legible, sin rayas críticas, manchas, pixeles muertos, parpadeo o pérdida de sensibilidad táctil' },
        { id: 'bvn12_i3', item: 'Botón de encendido, teclas rápidas, perilla/selector y controles de alarma con respuesta adecuada, sin atascamiento ni desgaste crítico' },
        { id: 'bvn12_i4', item: 'Módulos de parámetros y puertos de conexión firmes, reconocidos por el monitor, sin pines doblados, corrosión, humedad, grietas o juego excesivo' },
        { id: 'bvn12_i5', item: 'Cable ECG 3/5 derivaciones y cable troncal íntegros, con conectores limpios, sin cortes, peladuras, rigidez, sulfatación o falsos contactos' },
        { id: 'bvn12_i6', item: 'Sensor SpO2, extensión y conector con ventana óptica limpia, pinza funcional, cable flexible y sin daño del aislamiento' },
        { id: 'bvn12_i7', item: 'Brazalete NIBP, manguera, acoples y puerto neumático sin fugas visibles, fisuras, rigidez, obstrucción o velcro deteriorado' },
        { id: 'bvn12_i8', item: 'Sondas de temperatura, módulos IBP/CO2 y accesorios opcionales presentes y en buen estado cuando apliquen al equipo instalado' },
        { id: 'bvn12_i9', item: 'Batería interna sin abombamiento, fuga, sobrecalentamiento, daño de contactos o mensaje persistente de falla/capacidad baja' },
        { id: 'bvn12_i10', item: 'Cable de alimentación, clavija, fusibles accesibles, fuente y puesta a tierra sin cortes, empalmes, calentamiento, corrosión o aislamiento expuesto' },
        { id: 'bvn12_i11', item: 'Altavoz, indicadores visuales, luz de alarma y ventilaciones libres de obstrucción, polvo excesivo o residuos' },
        { id: 'bvn12_i12', item: 'Registrador térmico, tapa, rodillo y papel instalados correctamente, limpios y sin residuos, si el equipo cuenta con impresora' },
        { id: 'bvn12_i13', item: 'Puerto de red, USB, sincronización, salida auxiliar y conexión a central limpios, sin daño físico y con tapas protectoras si aplica' },
        { id: 'bvn12_i14', item: 'Soporte mural, brazo, base rodante, ruedas y frenos estables, seguros y sin riesgo de caída del monitor' },
        { id: 'bvn12_i15', item: 'Placa Mindray BeneVision N12, número de serie, activo fijo, advertencias y fecha de mantenimiento legibles y coincidentes con inventario' }
      ],
      verificacionBasica: [
        { id: 'bvn12_v1', item: 'Encendido con alimentación AC y autoverificación inicial', valorEsperado: 'El monitor inicia, reconoce módulos instalados y no presenta error técnico persistente', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_v2', item: 'Respuesta de pantalla táctil, perilla y teclas rápidas', valorEsperado: 'Permite navegar menús, seleccionar parámetros, alarmas, tendencias y configuración sin bloqueo', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_v3', item: 'Visualización de parámetros configurados', valorEsperado: 'ECG, FC, RESP, SpO2, NIBP, temperatura y módulos opcionales aparecen según configuración instalada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bvn12_v4', item: 'Conmutación a batería al desconectar AC', valorEsperado: 'No se apaga ni reinicia y mantiene monitoreo con indicador de batería visible', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_v5', item: 'Fecha, hora, categoría de paciente, unidades y volumen de alarma', valorEsperado: 'Configuración coherente con lineamiento institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_v6', item: 'Alarmas fisiológicas y técnicas', valorEsperado: 'Generan indicación visual, sonora y mensaje en pantalla; pausa/silencio retorna según configuración', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_v7', item: 'Desconexión de sensores ECG, SpO2 y NIBP', valorEsperado: 'El monitor muestra mensaje técnico correspondiente en máximo 10 segundos', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_v8', item: 'Tendencias, eventos, revisión y registrador/red si aplica', valorEsperado: 'Funciones disponibles abren y muestran información coherente sin error de memoria o comunicación', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'bvn12_pf1', prueba: 'ECG — Simular ritmo sinusal 60 BPM en derivación II', valorEsperado: 'FC 60 BPM ± 1 BPM y trazo estable sin artefacto relevante', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_pf2', prueba: 'ECG — Simular ritmo sinusal 120 BPM y verificar alarma alta', valorEsperado: 'Lectura 120 BPM ± 2 BPM y alarma alta activa si el límite se configura por debajo', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_pf3', prueba: 'ECG — Señal patrón 1 mV', valorEsperado: 'Amplitud visualizada coherente con ganancia configurada y sin distorsión crítica', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_pf4', prueba: 'RESP — Simular 20 RPM por impedancia', valorEsperado: 'Lectura 20 RPM ± 1 RPM y onda respiratoria estable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bvn12_pf5', prueba: 'SpO2 — Simular saturación 98% y pulso 80 lpm', valorEsperado: 'SpO2 98% ± 2% y pulso 80 lpm ± 2 lpm', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_pf6', prueba: 'SpO2 — Simular desaturación 88% con límite inferior 92%', valorEsperado: 'Alarma visual y sonora de SpO2 baja activa', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_pf7', prueba: 'NIBP — Simulación 120/80 mmHg', valorEsperado: 'Sistólica y diastólica dentro de ±3 mmHg o tolerancia del patrón institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_pf8', prueba: 'NIBP — Prueba de fuga neumática a 200 mmHg durante 30 s', valorEsperado: 'Caída de presión ≤ 6 mmHg/30 s o criterio institucional vigente', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_pf9', prueba: 'Temperatura — Simular 37.0 °C en canal disponible', valorEsperado: 'Lectura 37.0 °C ± 0.1 °C o tolerancia del simulador utilizado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bvn12_pf10', prueba: 'IBP/CO2 — Verificación con simulador o módulo de prueba si está instalado', valorEsperado: 'Lecturas y alarmas coherentes con el patrón; sin mensajes de módulo o sensor defectuoso', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'bvn12_pf11', prueba: 'Batería — Operación en batería durante 10 minutos de prueba', valorEsperado: 'Mantiene funcionamiento sin apagado, reinicio o alarma crítica inmediata', resultado: ['Pasa', 'Falla'] },
        { id: 'bvn12_pf12', prueba: 'Seguridad eléctrica — Tierra de protección y corrientes de fuga con analizador calibrado', valorEsperado: 'Cumple límites IEC 60601 / IEC 62353 o protocolo institucional vigente', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa del monitor, módulos, cables, sensores, brazalete, manguera y accesorios',
        'Inspección de carcasa, pantalla táctil, controles, puertos, batería, fuente, soportes y rotulación',
        'Verificación de encendido, autoprueba, navegación, alarmas, tendencias, registrador y conectividad si aplica',
        'Pruebas funcionales de ECG, RESP, SpO2, NIBP, temperatura y módulos opcionales con simulador calibrado',
        'Prueba de batería y seguridad eléctrica conforme al programa institucional',
        'Retiro de accesorios deteriorados y generación de correctivo si se identifican fallas críticas'
      ],
      recomendaciones: [
        'Usar accesorios compatibles y aprobados por Mindray para evitar errores de medición o alarmas falsas.',
        'No bloquear ventilaciones ni aplicar líquidos directamente sobre pantalla, módulos o conectores.',
        'Mantener límites de alarma configurados según el servicio y verificar la comunicación con central cuando aplique.'
      ]
    },

    'anestesia_drager_fabius_plus_xl': {
      nombre: 'Máquina de Anestesia Dräger Fabius plus XL',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-FABIUSXL',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire la máquina de anestesia del uso clínico, confirme ausencia de paciente conectado y ubique el equipo en área segura para mantenimiento preventivo.',
        'Use EPP y realice limpieza/desinfección externa; el circuito respiratorio, bolsa, filtros, trampa de agua, sensores y absorbedor deben reprocesarse o reemplazarse según protocolo institucional.',
        'Conecte gases medicinales y alimentación eléctrica dentro de especificación; use analizador de gases/ventilador, pulmón de prueba, manómetro/caudalímetro y analizador de seguridad eléctrica calibrados.',
        'No abra componentes internos, vaporizadores, ventilador, tarjetas, válvulas, reguladores ni tuberías durante mantenimiento preventivo rutinario; reparaciones y calibraciones internas son de servicio autorizado.',
        'Verifique disponibilidad de cilindros/respaldo, circuitos compatibles, cal sodada vigente, vaporizadores autorizados, sensores de O2 y accesorios antes de iniciar pruebas.',
        'Ejecute pruebas automáticas/manuales de fugas y compliancia según el procedimiento de la máquina antes de liberarla para uso clínico.',
        'Si se evidencian fallas de ventilación, suministro de gas, alarmas, vaporizador, fuga crítica, sensor de oxígeno o seguridad eléctrica, retire el equipo de servicio y genere correctivo especializado.'
      ],
      inspeccion: [
        { id: 'fabiusxl_i1', item: 'Estructura, carro, mesa de trabajo, cajones, rieles, asa, ruedas y frenos sin golpes, corrosión, inestabilidad, fisuras o piezas sueltas' },
        { id: 'fabiusxl_i2', item: 'Pantalla, teclado, perilla y panel de control legibles, limpios, sin teclas atascadas, mica rota o indicadores defectuosos' },
        { id: 'fabiusxl_i3', item: 'Cable de alimentación, clavija, fusibles, tomas auxiliares y puesta a tierra sin daño, calentamiento, cortes o empalmes' },
        { id: 'fabiusxl_i4', item: 'Mangueras de O2, aire y N2O, conectores DISS/NIST, yokes y empaques sin cortes, fugas, fisuras, deformación o contaminación' },
        { id: 'fabiusxl_i5', item: 'Manómetros y flujómetros/rotámetros íntegros, legibles, con flotadores libres, tubos limpios y sin fisuras' },
        { id: 'fabiusxl_i6', item: 'Botón de flush de O2, válvula APL, selector bolsa/ventilador y válvula de emergencia con accionamiento suave y retorno correcto' },
        { id: 'fabiusxl_i7', item: 'Sistema respiratorio compacto, válvulas inspiratoria/espiratoria, fuelles, domo y empaques limpios, completos, sin fisuras, deformación o humedad excesiva' },
        { id: 'fabiusxl_i8', item: 'Absorbedor de CO2/canister íntegro, correctamente instalado, con cal sodada vigente, sin grietas, polvo excesivo o bypass no intencional' },
        { id: 'fabiusxl_i9', item: 'Vaporizadores montados firmemente, con interlock funcional, nivel adecuado, etiqueta de agente legible y sin fugas o daño visible' },
        { id: 'fabiusxl_i10', item: 'Sensor de O2, línea de muestreo, trampa de agua y conexiones de monitoreo limpias, vigentes y sin obstrucción' },
        { id: 'fabiusxl_i11', item: 'Circuito paciente, bolsa reservorio, filtros, mascarilla y accesorios limpios, íntegros y compatibles; elementos de un solo uso retirados' },
        { id: 'fabiusxl_i12', item: 'Batería/UPS interna sin alarma persistente, deformación, fuga, mensaje de baja capacidad o falla de carga' },
        { id: 'fabiusxl_i13', item: 'Salida AGSS/evacuación de gases anestésicos conectada, sin obstrucción y con indicador/flujo adecuado si aplica' },
        { id: 'fabiusxl_i14', item: 'Etiquetas Dräger Fabius plus XL, serial, activo fijo, advertencias, gases, dirección de flujo y fecha de mantenimiento legibles' }
      ],
      verificacionBasica: [
        { id: 'fabiusxl_v1', item: 'Encendido y autoprueba inicial', valorEsperado: 'Equipo inicia sin errores persistentes y reconoce configuración instalada', resultado: ['Pasa', 'Falla'] },
        { id: 'fabiusxl_v2', item: 'Presión de suministro de O2, aire y N2O desde red o cilindro', valorEsperado: 'Presiones dentro de rango operativo y alarmas ausentes con suministro correcto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'fabiusxl_v3', item: 'Alarma de baja presión de O2 / falla de suministro', valorEsperado: 'Alarma audible y visual activa al simular desconexión controlada de O2', resultado: ['Pasa', 'Falla'] },
        { id: 'fabiusxl_v4', item: 'Flush de oxígeno', valorEsperado: 'Entrega flujo alto de O2, retorna al soltar y no queda trabado', resultado: ['Pasa', 'Falla'] },
        { id: 'fabiusxl_v5', item: 'Selector bolsa/ventilador y válvula APL', valorEsperado: 'Permiten ventilación manual y control de presión sin bloqueo', resultado: ['Pasa', 'Falla'] },
        { id: 'fabiusxl_v6', item: 'Prueba de fugas del sistema de baja presión y circuito', valorEsperado: 'Supera prueba automática/manual según criterio del fabricante o protocolo institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'fabiusxl_v7', item: 'Alarmas de presión alta, apnea/desconexión, volumen minuto y FiO2', valorEsperado: 'Alarmas audibles y visuales se activan al simular condición', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'fabiusxl_v8', item: 'Operación con batería al desconectar AC', valorEsperado: 'Mantiene operación básica sin apagado o reinicio inmediato', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'fabiusxl_pf1', prueba: 'Ventilador — Modo controlado con pulmón de prueba, VT 500 mL, FR 12/min', valorEsperado: 'Volumen corriente y frecuencia dentro de tolerancia del analizador/protocolo institucional; curva estable', resultado: ['Pasa', 'Falla'] },
        { id: 'fabiusxl_pf2', prueba: 'PEEP — Configurar 5 cmH2O y medir con analizador', valorEsperado: 'PEEP medida 5 cmH2O ± tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'fabiusxl_pf3', prueba: 'Presión límite / alarma de presión alta', valorEsperado: 'Activa alarma y limita ventilación al superar el umbral configurado', resultado: ['Pasa', 'Falla'] },
        { id: 'fabiusxl_pf4', prueba: 'Prueba de fuga del circuito a presión de prueba recomendada', valorEsperado: 'Fuga dentro del límite aceptado por fabricante o protocolo institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'fabiusxl_pf5', prueba: 'Medición FiO2 — Configurar mezcla 100% O2', valorEsperado: 'FiO2 medida cercana a 100% según tolerancia del analizador y sensor calibrado', resultado: ['Pasa', 'Falla'] },
        { id: 'fabiusxl_pf6', prueba: 'Medición FiO2 — Configurar mezcla clínica aproximada 50% O2/aire si aplica', valorEsperado: 'FiO2 medida dentro de tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'fabiusxl_pf7', prueba: 'Flujómetros — Verificar O2, aire y N2O en valores bajos/medios', valorEsperado: 'Flujos estables, sin flotador pegado, sin deriva anormal y con lectura coherente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'fabiusxl_pf8', prueba: 'Vaporizador — Revisión externa y salida de agente con analizador si disponible', valorEsperado: 'Interlock correcto, concentración estable y sin fuga; si no hay analizador, dejar N/A y solicitar verificación especializada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'fabiusxl_pf9', prueba: 'Ventilación manual — Bolsa y APL con pulmón de prueba', valorEsperado: 'Permite ventilación manual, control de presión y liberación de exceso sin fuga significativa', resultado: ['Pasa', 'Falla'] },
        { id: 'fabiusxl_pf10', prueba: 'Absorbedor y válvulas unidireccionales', valorEsperado: 'Movimiento correcto de válvulas, canister sellado y sin reinhalación evidente durante prueba', resultado: ['Pasa', 'Falla'] },
        { id: 'fabiusxl_pf11', prueba: 'AGSS/evacuación de gases', valorEsperado: 'Sistema conectado y funcional sin obstrucción ni succión excesiva', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'fabiusxl_pf12', prueba: 'Seguridad eléctrica — tierra de protección y corrientes de fuga', valorEsperado: 'Cumple límites IEC 60601 / IEC 62353 o protocolo institucional vigente', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de máquina, panel, superficies, mangueras, circuito y accesorios reprocesables',
        'Inspección de gases, flujómetros, vaporizadores, sistema respiratorio, absorbedor, ventilador, alarmas, batería y AGSS',
        'Verificación de autoprueba, fugas, suministro de gases, ventilación manual y ventilación mecánica con pulmón de prueba',
        'Prueba funcional de FiO2, volumen, presión, PEEP, alarmas y seguridad eléctrica con patrones calibrados',
        'Reposición/retiro de filtros, circuito, cal sodada, sensores o accesorios deteriorados según hallazgos',
        'Retiro de servicio y correctivo especializado ante fuga crítica, falla de ventilador, sensor, gas, vaporizador o alarma'
      ],
      recomendaciones: [
        'Ejecutar prueba de fugas y prueba previa de anestesia antes de cada uso clínico.',
        'Mantener vaporizadores bloqueados por interlock y llenados únicamente con agente correspondiente.',
        'No usar la máquina si falla el suministro de O2, el ventilador, las alarmas o la medición de oxígeno.'
      ]
    },

    'anestesia_ge_carestation_620': {
      nombre: 'Máquina de Anestesia GE Carestation 620',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-CS620',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire la Carestation 620 del uso clínico, confirme ausencia de paciente conectado y ubique el equipo en área controlada para mantenimiento preventivo.',
        'Realice limpieza/desinfección externa y reprocesamiento de partes respiratorias reutilizables según protocolo institucional y recomendaciones GE/Datex-Ohmeda.',
        'Conecte alimentación eléctrica, gases medicinales y sistema de evacuación; use analizador de ventilador/gases, pulmón de prueba y analizador de seguridad eléctrica calibrados.',
        'Verifique disponibilidad de circuitos, filtros, bolsa, absorbedor, sensor de O2/flujo, líneas de muestra, vaporizadores autorizados y accesorios compatibles.',
        'No abra la máquina, vaporizadores, módulos electrónicos, válvulas o neumática interna durante mantenimiento preventivo rutinario; ajustes internos son de servicio autorizado.',
        'Ejecute el Checkout/Prueba previa del sistema, prueba de fugas y calibraciones de usuario indicadas antes de liberar el equipo para uso.',
        'Retire de servicio si hay falla de ventilación, suministro de gas, mezcla de gases, vaporizador, sensor de O2/flujo, fuga crítica, batería, alarmas o seguridad eléctrica.'
      ],
      inspeccion: [
        { id: 'cs620_i1', item: 'Carro compacto, estructura, superficie de trabajo, cajones, rieles, asa, ruedas y frenos sin fisuras, corrosión, inestabilidad o daño mecánico' },
        { id: 'cs620_i2', item: 'Pantalla, interfaz, perilla, teclas, luces de trabajo y controles de flujo legibles, limpios y con respuesta adecuada' },
        { id: 'cs620_i3', item: 'Cable de alimentación, tomas auxiliares, clavija, fusibles y puesta a tierra sin daño, cortes, empalmes o calentamiento' },
        { id: 'cs620_i4', item: 'Conexiones de gases O2, aire y N2O, mangueras, yokes, empaques y manómetros sin fugas, fisuras, deformación o contaminación' },
        { id: 'cs620_i5', item: 'Controles electrónicos/mecánicos de flujo y luces indicadoras activas sin bloqueo, lectura errática o respuesta anormal' },
        { id: 'cs620_i6', item: 'Sistema respiratorio, fuelles/turbina según configuración, válvulas, sensores de flujo y empaques limpios, completos y correctamente instalados' },
        { id: 'cs620_i7', item: 'Absorbedor de CO2/canister íntegro, cal sodada vigente, cierre firme y sin polvo excesivo, grietas o fuga visible' },
        { id: 'cs620_i8', item: 'Vaporizadores GE/Datex-Ohmeda montados firmemente, con agente correcto, nivel visible, interlock funcional y sin fuga externa' },
        { id: 'cs620_i9', item: 'Sensor de O2, líneas de muestra, trampa de agua, módulo de gases y conectores sin obstrucción, humedad excesiva o vencimiento evidente' },
        { id: 'cs620_i10', item: 'Circuito paciente, bolsa reservorio, filtros, mascarillas y accesorios limpios, íntegros, compatibles y sin elementos de un solo uso reutilizados' },
        { id: 'cs620_i11', item: 'Batería interna/UPS sin alarma persistente, baja capacidad, fuga, deformación o falla de carga' },
        { id: 'cs620_i12', item: 'AGSS o sistema de evacuación conectado, sin obstrucción, con indicadores en rango si aplica al sistema instalado' },
        { id: 'cs620_i13', item: 'Puertos de comunicación, USB/red y conexiones auxiliares limpias, sin pines dañados ni cuerpos extraños' },
        { id: 'cs620_i14', item: 'Etiquetas GE Carestation 620, serial, activo fijo, advertencias, identificación de gases y fecha de mantenimiento legibles' }
      ],
      verificacionBasica: [
        { id: 'cs620_v1', item: 'Encendido y autoverificación/Checkout inicial', valorEsperado: 'Sistema inicia, permite prueba previa y no presenta error técnico persistente', resultado: ['Pasa', 'Falla'] },
        { id: 'cs620_v2', item: 'Presión de gases de red/cilindro', valorEsperado: 'O2, aire y N2O dentro de rango operativo; alarmas ausentes con suministro correcto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cs620_v3', item: 'Prueba de baja presión de O2 y alarma de suministro', valorEsperado: 'Alarma visual/audible se activa ante desconexión controlada y se recupera al restablecer suministro', resultado: ['Pasa', 'Falla'] },
        { id: 'cs620_v4', item: 'Flush de oxígeno y control de flujo', valorEsperado: 'Flush retorna al soltar; controles de flujo responden y muestran lectura coherente', resultado: ['Pasa', 'Falla'] },
        { id: 'cs620_v5', item: 'Prueba de fugas y compliancia del sistema', valorEsperado: 'Checkout supera prueba de fuga/compliancia según límites del fabricante o protocolo institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'cs620_v6', item: 'Selector manual/ventilador, APL y bolsa', valorEsperado: 'Permite ventilación manual segura y transición a ventilación mecánica sin fuga crítica', resultado: ['Pasa', 'Falla'] },
        { id: 'cs620_v7', item: 'Alarmas de presión, apnea/desconexión, volumen minuto, FiO2 y batería', valorEsperado: 'Alarmas se activan con señal audible/visual y mensaje correcto al simular condición', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cs620_v8', item: 'Operación en batería al retirar AC', valorEsperado: 'Mantiene operación sin apagado o reinicio inmediato y muestra estado de batería', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'cs620_pf1', prueba: 'Ventilador — Modo volumen controlado con pulmón de prueba, VT 500 mL, FR 12/min', valorEsperado: 'Volumen y frecuencia dentro de tolerancia del analizador/protocolo institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'cs620_pf2', prueba: 'Ventilador — Verificación de presión inspiratoria y curva con pulmón de prueba', valorEsperado: 'Presión estable, sin oscilación anormal ni alarma injustificada', resultado: ['Pasa', 'Falla'] },
        { id: 'cs620_pf3', prueba: 'PEEP — Configurar 5 cmH2O', valorEsperado: 'PEEP medida 5 cmH2O ± tolerancia institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cs620_pf4', prueba: 'Prueba de fuga del circuito respiratorio', valorEsperado: 'Fuga dentro de límite aceptado por Checkout/fabricante o criterio institucional', resultado: ['Pasa', 'Falla'] },
        { id: 'cs620_pf5', prueba: 'FiO2 — Configurar 100% O2 y medir con analizador', valorEsperado: 'FiO2 cercana a 100% según tolerancia del analizador y sensor', resultado: ['Pasa', 'Falla'] },
        { id: 'cs620_pf6', prueba: 'FiO2 — Configurar mezcla clínica aproximada 50% O2/aire si aplica', valorEsperado: 'Lectura dentro de tolerancia institucional y alarmas coherentes', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cs620_pf7', prueba: 'Sensores de flujo/volumen — Comparar volumen inspirado y espirado', valorEsperado: 'Diferencia dentro de tolerancia del sistema, sin alarma de sensor o flujo invertido', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cs620_pf8', prueba: 'Vaporizador — Interlock y concentración con analizador si disponible', valorEsperado: 'Solo un vaporizador activo; concentración estable y sin fuga externa; N/A si no se cuenta con analizador de agente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cs620_pf9', prueba: 'Ventilación manual — Bolsa, APL y circuito con pulmón de prueba', valorEsperado: 'Ventilación manual efectiva, control de presión y descarga por APL sin fuga significativa', resultado: ['Pasa', 'Falla'] },
        { id: 'cs620_pf10', prueba: 'Absorbedor y válvulas unidireccionales', valorEsperado: 'Flujo correcto, válvulas móviles y canister sellado sin reinhalación evidente', resultado: ['Pasa', 'Falla'] },
        { id: 'cs620_pf11', prueba: 'AGSS/evacuación', valorEsperado: 'Evacuación funcional sin obstrucción, desconexión o succión excesiva', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cs620_pf12', prueba: 'Seguridad eléctrica — tierra de protección y corrientes de fuga', valorEsperado: 'Cumple límites IEC 60601 / IEC 62353 o protocolo institucional vigente', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      accionesRealizadas: [
        'Limpieza y desinfección externa de Carestation 620, superficies, controles, mangueras, circuito y accesorios reprocesables',
        'Inspección de estructura, gases, controles de flujo, ventilador, absorbedor, vaporizadores, sensores, batería, AGSS y rotulación',
        'Ejecución de Checkout/prueba previa, prueba de fugas, suministro de gases, ventilación manual y ventilación mecánica',
        'Pruebas funcionales de volumen, presión, PEEP, FiO2, alarmas, vaporizador si hay analizador y seguridad eléctrica',
        'Cambio o retiro de filtros, cal sodada, circuito, bolsa, sensores o accesorios deteriorados/no conformes',
        'Retiro de servicio y correctivo especializado ante fallas de gas, ventilador, fuga crítica, sensores, vaporizador, alarmas o seguridad eléctrica'
      ],
      recomendaciones: [
        'Realizar Checkout completo antes de cada jornada o procedimiento anestésico según la guía del equipo.',
        'Usar únicamente vaporizadores, circuitos, sensores y accesorios compatibles GE/Datex-Ohmeda.',
        'No liberar el equipo si falla la prueba de fugas, la medición de oxígeno, el suministro de O2 o las alarmas críticas.'
      ]
    },


    'calentador_fluidos_irrigacion_3m_ranger_245': {
      nombre: 'Calentador de Fluidos de Irrigación 3M Ranger Modelo 245',
      categoria: 'Biomédico',
      codigo: 'SLV-GAT-BIO-3MR245',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el calentador de fluidos 3M Ranger modelo 245 del uso clínico y confirme que no esté conectado a ningún paciente ni a líneas de infusión/irrigación activas.',
        'Use EPP y realice limpieza/desinfección externa conforme al protocolo institucional, evitando ingreso de líquidos en ranuras, placas calefactoras, conectores, interruptor, pantalla, ventilaciones y entrada de alimentación.',
        'Utilice únicamente sets desechables compatibles 3M Ranger; no reutilice consumibles de un solo uso y descarte sets usados como residuo biosanitario según protocolo institucional.',
        'Conecte el equipo a una toma hospitalaria con polo a tierra y verifique que el cable de alimentación se encuentre íntegro antes de energizar.',
        'Permita el precalentamiento del equipo y confirme que alcance temperatura operativa antes de realizar pruebas funcionales.',
        'No abra la carcasa, no ajuste componentes internos ni intervenga tarjetas, sensores o placas calefactoras durante mantenimiento preventivo rutinario; estas acciones corresponden a servicio técnico autorizado.',
        'Retire de servicio si se evidencia sobretemperatura, alarma persistente, ausencia de calentamiento, daño en placas, cable defectuoso, fuga de líquido hacia el equipo o falla de seguridad eléctrica.'
      ],
      inspeccion: [
        { id: 'r245_i1', item: 'Carcasa, asa, base, soporte para pedestal y estructura sin fisuras, deformaciones, corrosión, partes sueltas, golpes severos o evidencia de caída' },
        { id: 'r245_i2', item: 'Placas/canal de calentamiento limpias, secas, sin residuos, rayaduras profundas, deformación, manchas por líquidos o cuerpos extraños' },
        { id: 'r245_i3', item: 'Puerta o mecanismo de cierre del set, bisagras, seguro y guías con apertura/cierre suave y fijación adecuada' },
        { id: 'r245_i4', item: 'Pantalla/indicadores de temperatura, luces de estado y alarmas visibles, legibles y sin segmentos apagados' },
        { id: 'r245_i5', item: 'Teclas, interruptor de encendido y controles con accionamiento normal, sin bloqueo, hundimiento o falsos contactos' },
        { id: 'r245_i6', item: 'Cable de alimentación, clavija, retenedor, entrada IEC y alivio de tensión sin cortes, empalmes, pines flojos, calentamiento o deterioro de aislamiento' },
        { id: 'r245_i7', item: 'Ranuras de ventilación libres de polvo, obstrucción, humedad, pelusa o material contaminante' },
        { id: 'r245_i8', item: 'Soporte para atril/pedestal firme, perilla de sujeción funcional y sin riesgo de deslizamiento durante uso clínico' },
        { id: 'r245_i9', item: 'Accesorios compatibles disponibles: cable de alimentación, soporte de montaje, guía rápida/manual y set desechable 3M Ranger vigente si aplica' },
        { id: 'r245_i10', item: 'Rotulación 3M Ranger modelo 245, serial, activo fijo, advertencias, símbolos, tensión nominal y fecha de mantenimiento legibles y coherentes con inventario' },
        { id: 'r245_i11', item: 'Ausencia de modificaciones no autorizadas, tornillos faltantes, sellos rotos, cinta, empalmes, adaptadores no hospitalarios o accesorios incompatibles' },
        { id: 'r245_i12', item: 'Superficies externas secas y desinfectadas, sin residuos químicos en zonas de contacto con operador, set de calentamiento o pedestal' }
      ],
      verificacionBasica: [
        { id: 'r245_v1', item: 'Encendido y autoverificación inicial', valorEsperado: 'El equipo enciende, muestra indicadores/temperatura y no presenta alarma técnica persistente', resultado: ['Pasa', 'Falla'] },
        { id: 'r245_v2', item: 'Precalentamiento', valorEsperado: 'Alcanza temperatura de operación aproximadamente 41 °C en el tiempo esperado por el fabricante o dentro del criterio institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_v3', item: 'Estabilidad de temperatura en reposo', valorEsperado: 'La lectura se mantiene estable cerca del punto de operación sin oscilaciones bruscas ni mensajes de falla', resultado: ['Pasa', 'Falla'] },
        { id: 'r245_v4', item: 'Indicadores visuales de estado', valorEsperado: 'Los indicadores de calentamiento/listo/alarma se activan de forma coherente con la condición del equipo', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_v5', item: 'Alarma audible y visual', valorEsperado: 'El sistema genera alarma reconocible ante condición simulada permitida por el procedimiento o durante autoprueba', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_v6', item: 'Instalación de set desechable compatible sin fluido', valorEsperado: 'El set se inserta y retira correctamente, sin atrapamiento, daño del canal ni cierre incompleto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_v7', item: 'Montaje en pedestal', valorEsperado: 'El equipo queda estable, fijo y sin giro/deslizamiento al aplicar movimiento suave', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_v8', item: 'Apagado y reinicio controlado', valorEsperado: 'Apaga y reinicia sin bloqueo, reinicio espontáneo, olor anormal o calentamiento externo excesivo', resultado: ['Pasa', 'Falla'] }
      ],
      pruebasFuncionales: [
        { id: 'r245_pf1', prueba: 'Verificación de temperatura de operación — Medir con termómetro/sonda calibrada compatible sobre canal o set de prueba según procedimiento institucional', valorEsperado: 'Temperatura cercana a 41 °C y dentro de tolerancia definida por fabricante/protocolo institucional', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_pf2', prueba: 'Tiempo de calentamiento — Cronometrar desde encendido hasta condición listo/temperatura estable', valorEsperado: 'Alcanza condición lista en aproximadamente 2 minutos o dentro del criterio institucional aplicable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_pf3', prueba: 'Prueba con flujo de solución de prueba si está autorizado — Usar set compatible y solución no destinada a paciente', valorEsperado: 'El fluido circula sin obstrucción o fuga; temperatura de salida permanece en rango clínico aceptable', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_pf4', prueba: 'Detección de temperatura baja si aplica', valorEsperado: 'El equipo informa/alarma condición de temperatura baja durante calentamiento o cuando no alcanza rango esperado', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_pf5', prueba: 'Protección de sobretemperatura si el procedimiento de servicio lo permite sin riesgo', valorEsperado: 'No supera límites seguros; ante condición anormal activa alarma y debe retirarse de servicio si la prueba falla', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_pf6', prueba: 'Integridad de placas calefactoras y transferencia térmica', valorEsperado: 'Calentamiento uniforme, sin zonas frías evidentes, olores, chispas, humo o deformación', resultado: ['Pasa', 'Falla'] },
        { id: 'r245_pf7', prueba: 'Verificación de fuga de corriente/tierra de protección con analizador de seguridad eléctrica', valorEsperado: 'Cumple límites IEC 60601 / IEC 62353 o protocolo institucional vigente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_pf8', prueba: 'Continuidad del conductor de protección', valorEsperado: 'Resistencia de tierra dentro del límite institucional y conexión firme sin falsos contactos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_pf9', prueba: 'Prueba de estabilidad mecánica en soporte', valorEsperado: 'Permanece estable en atril o pedestal, sin oscilación peligrosa ni aflojamiento de la abrazadera', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'r245_pf10', prueba: 'Verificación final posterior a limpieza y pruebas', valorEsperado: 'Equipo seco, funcional, sin alarmas, accesorios completos, rotulado y listo para uso o almacenamiento', resultado: ['Pasa', 'Falla'] }
      ],
      accionesRealizadas: [
        'Limpieza y desinfección externa del calentador, carcasa, placas/canal de calentamiento, soporte, pantalla, controles y cable de alimentación',
        'Inspección física de carcasa, placas calefactoras, cierre del set, cable, clavija, ventilaciones, soporte, rotulación y accesorios compatibles',
        'Verificación de encendido, autoprueba, indicadores, alarmas, precalentamiento, estabilidad térmica y apagado seguro',
        'Prueba funcional de temperatura de operación con instrumento calibrado y set/fluido de prueba cuando aplique al procedimiento institucional',
        'Verificación de montaje seguro en pedestal o atril y revisión de riesgo de caída durante uso clínico',
        'Prueba de seguridad eléctrica: continuidad de tierra y corrientes de fuga según programa institucional',
        'Retiro de servicio y generación de correctivo si se detecta alarma persistente, sobretemperatura, no calentamiento, daño de placas, fuga de líquido o falla eléctrica',
        'Registro de valores medidos, patrón utilizado, hallazgos, estado final, responsable y próxima fecha de mantenimiento'
      ],
      estadoFinal: ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'],
      recomendaciones: [
        'Realizar verificación visual y de funcionamiento antes de cada uso clínico, confirmando que el equipo esté seco, limpio y sin alarmas.',
        'Usar únicamente sets desechables compatibles 3M Ranger y no reutilizar consumibles de un solo uso.',
        'No operar el equipo si presenta daño en placas, ingreso de líquido, cable deteriorado, alarma de temperatura o falla de precalentamiento.',
        'Mantener ventilaciones libres de obstrucción y montar el equipo firmemente en un pedestal estable para evitar caídas.',
        'Reportar a ingeniería biomédica cualquier desviación de temperatura, olor anormal, calentamiento externo excesivo o mensajes técnicos repetitivos.'
      ]
    },


    'olympus_cx31': {
      nombre: 'Microscopio Biológico Olympus CX31',
      categoria: 'Biomédico / Laboratorio clínico / Microscopía óptica',
      codigo: 'SLV-GAT-BIO-MIC-OLY-CX31',
      frecuencia: ['Semestral', 'Anual'],
      condicionesPrevias: [
        'Retire el microscopio Olympus CX31 del uso clínico/asistencial y confirme que no se estén procesando muestras antes de iniciar el mantenimiento preventivo.',
        'Apague el interruptor principal, desconecte el cable de alimentación y permita el enfriamiento completo de la lámpara y del portalámparas antes de inspeccionar, limpiar o manipular el equipo.',
        'Use elementos de protección personal de laboratorio y considere toda platina, portaobjetos, aceite de inmersión, oculares y superficies cercanas como potencialmente contaminadas.',
        'Retire portaobjetos, cubreobjetos, residuos biológicos y aceite de inmersión antes de mover o inclinar el microscopio.',
        'Transporte el microscopio sujetándolo firmemente por el brazo/asa y la base; no lo levante por el tubo binocular, revólver portaobjetivos, platina, condensador, perillas de enfoque o cable de alimentación.',
        'Realice limpieza externa con paño suave ligeramente humedecido. No sumerja el microscopio ni aplique líquidos directamente sobre oculares, objetivos, condensador, interruptor, reóstato, base o conexiones eléctricas.',
        'Limpie lentes, oculares, objetivos y condensador únicamente con papel/lienzo para lentes y solución compatible para óptica. No use abrasivos, gasas secas, solventes agresivos ni objetos metálicos sobre superficies ópticas.',
        'Retire aceite de inmersión del objetivo 100X inmediatamente después de la revisión usando material apropiado para lentes; no permita que el aceite se seque o migre a otros objetivos.',
        'No desarme el sistema óptico, mecanismos internos de enfoque, fuente de iluminación, condensador o revólver durante mantenimiento preventivo rutinario. Las reparaciones internas deben ser realizadas por servicio técnico autorizado Olympus/Evident o proveedor calificado.',
        'Si se requiere cambio de lámpara halógena, utilice únicamente repuesto compatible con el modelo CX31 y evite tocar el vidrio de la lámpara con los dedos.',
        'No opere el equipo si presenta cable deteriorado, olor a quemado, sobrecalentamiento, iluminación inestable, daño en lentes, platina bloqueada, enfoque con resistencia anormal o piezas flojas.',
        'Registre marca, modelo, serie, ubicación, responsable, patrón/instrumento usado, hallazgos, acciones realizadas y estado final del equipo.'
      ],
      inspeccion: [
        { id: 'cx31_i1', item: 'Cuerpo del microscopio íntegro, limpio, estable, sin fisuras, golpes, deformaciones, corrosión, humedad, partes sueltas o modificaciones no autorizadas' },
        { id: 'cx31_i2', item: 'Base y apoyos antideslizantes firmes, completos y sin inestabilidad sobre la superficie de trabajo' },
        { id: 'cx31_i3', item: 'Cable de alimentación, enchufe y prensa-cable íntegros, sin cortes, aplastamiento, conductores expuestos, empalmes, cinta o calentamiento anormal' },
        { id: 'cx31_i4', item: 'Interruptor, reóstato/control de intensidad y fusible accesible en buen estado, legibles, sin bloqueo, falso contacto o daño mecánico' },
        { id: 'cx31_i5', item: 'Tubo binocular/trinocular, cabezal y ajuste interpupilar firmes, alineados y sin holguras o juego excesivo' },
        { id: 'cx31_i6', item: 'Oculares presentes, limpios, sin rayones críticos, hongos, empañamiento, residuos, lentes flojos o copas oculares deterioradas' },
        { id: 'cx31_i7', item: 'Revólver portaobjetivos gira suavemente y enclava cada posición con clic definido, sin rozamiento, juego excesivo o desalineación evidente' },
        { id: 'cx31_i8', item: 'Objetivos 4X, 10X, 40X y 100X aceite presentes según configuración, limpios, roscados firmemente y sin golpes, rayones, hongos, aceite seco o frontales flojos' },
        { id: 'cx31_i9', item: 'Platina mecánica íntegra, limpia, sin bordes cortantes, corrosión, derrames secos, guías flojas o dificultad para fijar portaobjetos' },
        { id: 'cx31_i10', item: 'Mandos X/Y de la platina con desplazamiento uniforme, sin saltos, bloqueo, juego excesivo o pérdida de recorrido' },
        { id: 'cx31_i11', item: 'Perillas de enfoque macrométrico y micrométrico con movimiento suave, sin deslizamiento, bloqueo, ruido anormal o caída espontánea de la platina' },
        { id: 'cx31_i12', item: 'Ajuste de tensión/freno del enfoque operativo y seguro para evitar descenso involuntario de la platina' },
        { id: 'cx31_i13', item: 'Condensador Abbe, porta-filtro, diafragma iris y perilla de altura limpios, firmes, centrados y sin movimiento irregular' },
        { id: 'cx31_i14', item: 'Lámpara/iluminador, colector y ventana de iluminación limpios, sin oscurecimiento excesivo, parpadeo, soporte flojo o signos de sobretemperatura' },
        { id: 'cx31_i15', item: 'Tornillos, tapas, accesorios, filtros, cubiertas y elementos de seguridad presentes, firmes y sin piezas faltantes' },
        { id: 'cx31_i16', item: 'Rotulación Olympus CX31, número de serie, activo fijo, advertencias eléctricas y fecha de mantenimiento legibles y coincidentes con inventario' }
      ],
      verificacion: [
        { id: 'cx31_v1', item: 'Encendido desde interruptor principal', valorEsperado: 'El sistema enciende sin ruido, olor, chispa, sobrecalentamiento, parpadeo persistente o mensajes/anomalías visibles', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_v2', item: 'Regulación de intensidad luminosa', valorEsperado: 'La iluminación aumenta y disminuye progresivamente en todo el rango sin cortes, saltos, oscilaciones o puntos muertos', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_v3', item: 'Uniformidad de iluminación en campo claro', valorEsperado: 'Campo iluminado homogéneo, centrado y sin sombras, manchas, parpadeo o pérdida evidente de intensidad', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_v4', item: 'Ajuste interpupilar y dioptrías de oculares', valorEsperado: 'Permite obtener imagen binocular cómoda y enfocada, sin desalineación evidente ni juego mecánico', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_v5', item: 'Rotación y enclavamiento del revólver', valorEsperado: 'Cada objetivo queda alineado en posición de trabajo con clic definido y sin tocar la muestra o la platina', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_v6', item: 'Desplazamiento de platina en ejes X/Y', valorEsperado: 'Movimiento continuo, controlado y completo del portaobjetos, sin atascos ni pérdida de sujeción', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_v7', item: 'Enfoque macrométrico y micrométrico', valorEsperado: 'El enfoque sube/baja con suavidad y conserva la posición sin caída espontánea o vibración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_v8', item: 'Condensador y diafragma iris', valorEsperado: 'El condensador sube/baja, el diafragma abre/cierra y el contraste cambia de forma controlada', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_v9', item: 'Limpieza óptica posterior a mantenimiento', valorEsperado: 'Oculares, objetivos, condensador y superficie de iluminación quedan sin aceite, polvo, huellas, hongos o residuos visibles', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_v10', item: 'Seguridad eléctrica visual e instrumental básica', valorEsperado: 'Cable, enchufe, carcasa y conexión a tierra se encuentran seguros; pruebas instrumentales conformes al programa institucional si aplica', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      pruebasFuncionales: [
        { id: 'cx31_pf1', prueba: 'Prueba de encendido y estabilidad por 5 minutos', valorEsperado: 'El microscopio permanece encendido con iluminación estable, sin olor a quemado, ruido, parpadeo o calentamiento anormal', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf2', prueba: 'Prueba de regulación de intensidad mínima-media-máxima', valorEsperado: 'La variación de brillo es progresiva y suficiente para observación en campo claro sin fluctuaciones', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf3', prueba: 'Observación con objetivo 4X sobre lámina patrón o muestra de prueba', valorEsperado: 'Imagen clara, centrada, con enfoque estable y campo sin manchas críticas', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf4', prueba: 'Observación con objetivo 10X sobre lámina patrón o muestra de prueba', valorEsperado: 'Imagen nítida, contraste adecuado y transición de enfoque suave desde 4X', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf5', prueba: 'Observación con objetivo 40X sobre lámina patrón o muestra de prueba', valorEsperado: 'Imagen enfocada sin vibración, rozamiento con la muestra o pérdida de parfocalidad evidente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf6', prueba: 'Observación con objetivo 100X aceite si aplica', valorEsperado: 'Imagen funcional con aceite de inmersión compatible y limpieza completa del objetivo al finalizar', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf7', prueba: 'Verificación de parfocalidad entre objetivos', valorEsperado: 'Al cambiar de aumento, la imagen conserva enfoque aproximado y requiere solo ajuste micrométrico menor', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf8', prueba: 'Verificación de centrado y contraste con condensador', valorEsperado: 'El condensador permite ajustar iluminación y contraste sin sombras laterales o descentrado evidente', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf9', prueba: 'Prueba de recorrido de platina y fijación de portaobjetos', valorEsperado: 'La muestra se desplaza en todo el campo de trabajo sin deslizamiento, bloqueo o pérdida de control', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf10', prueba: 'Prueba de enfoque fino en muestra de alto contraste', valorEsperado: 'El micrométrico permite ajuste preciso y repetible sin juego muerto o vibración', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf11', prueba: 'Prueba de limpieza del objetivo de inmersión y oculares', valorEsperado: 'No quedan restos de aceite, huellas, polvo o empañamiento que afecten la observación', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf12', prueba: 'Verificación de cambio de lámpara o inspección de portalámparas si aplica', valorEsperado: 'Lámpara compatible, firme y limpia; portalámparas sin carbonización, deformación o falso contacto', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf13', prueba: 'Prueba de seguridad eléctrica según programa institucional', valorEsperado: 'Continuidad de tierra, aislamiento/corrientes de fuga y condición de cableado dentro de límites establecidos por la institución', resultado: ['Pasa', 'Falla', 'N/A'] },
        { id: 'cx31_pf14', prueba: 'Condición final y disponibilidad para laboratorio', valorEsperado: 'Equipo limpio, seco, cubierto o protegido, con intensidad en mínimo, platina baja, cable organizado y estado final registrado', resultado: ['Pasa', 'Falla', 'N/A'] }
      ],
      estadoFinal: [
        'Apto para uso',
        'Apto con observaciones',
        'No apto - requiere limpieza óptica especializada',
        'No apto - requiere cambio de lámpara/fusible/accesorio compatible',
        'No apto - requiere ajuste mecánico de platina/enfoque/revólver',
        'No apto - requiere servicio técnico autorizado',
        'No apto - requiere reposición'
      ],
      acciones: [
        'Limpieza y desinfección externa compatible del cuerpo, base, platina, mandos y superficies de contacto',
        'Limpieza de oculares, objetivos, condensador y ventana de iluminación con material para óptica',
        'Retiro de aceite de inmersión del objetivo 100X y zonas cercanas',
        'Inspección de cable, enchufe, interruptor, reóstato, fusible y sistema de iluminación',
        'Verificación de encendido, intensidad luminosa y estabilidad del iluminador',
        'Verificación mecánica de enfoque macrométrico, micrométrico, tensión/freno y desplazamiento de platina',
        'Verificación de revólver portaobjetivos, objetivos y oculares',
        'Verificación de condensador, diafragma iris y centrado básico de iluminación',
        'Cambio de lámpara halógena o fusible compatible si está autorizado por el programa biomédico',
        'Prueba funcional con lámina patrón o muestra de prueba en objetivos disponibles',
        'Prueba de seguridad eléctrica conforme al programa institucional cuando aplique',
        'Retiro de servicio por falla eléctrica, óptica, mecánica, contaminación persistente o pérdida de desempeño',
        'Remisión a servicio técnico autorizado Olympus/Evident o proveedor calificado para reparación interna o alineación especializada'
      ],
      recomendaciones: [
        'Después de cada jornada, dejar la platina baja, retirar muestras, limpiar aceite de inmersión, bajar intensidad antes de apagar y cubrir el microscopio con funda protectora.',
        'No tocar superficies ópticas con los dedos y no limpiar lentes con papel común, gasas, telas abrasivas o solventes no compatibles.',
        'Mantener el equipo en área seca, ventilada y libre de polvo, vibraciones, vapores químicos, humedad excesiva y luz solar directa.',
        'No forzar objetivos, revólver, enfoque, platina o condensador; cualquier resistencia anormal debe reportarse a ingeniería biomédica.',
        'Programar servicio técnico especializado cuando se detecten hongos internos, desalineación óptica, falla de iluminación, enfoque inestable o daño mecánico recurrente.'
      ]
    },

};

  // ── INIT ──────────────────────────────────────────────────────────────
  async function loadMantenimientosModule(force) {
    const body = document.getElementById('mantBody');
    if (!body) return;
    body.innerHTML = '<div class="mt-loading"><div class="mt-spinner"></div><p>Cargando inventario...</p></div>';
    if (!mtState.invLoaded || force) {
      try {
        let inv=[], ioff=null;
        do {
          const p = new URLSearchParams({pageSize:'100'}); if(ioff) p.set('offset',ioff);
          const r = await axios.get(BASE+'/inventario?'+p, {headers:hdr()});
          const d = r.data||{};
          inv = inv.concat(d.records||d.data||[]);
          ioff = d.offset||null;
        } while(ioff);
        mtState.inventario = inv;
        mtState.invLoaded = true;
        extractReportsFromInventario(inv);
      } catch(err) {
        body.innerHTML = '<div style="text-align:center;padding:40px;color:#c62828">⚠️ Error al cargar el inventario<br><small>'+esc((err&&err.message)||'')+'</small><br><button class="btn btn-primary" style="margin-top:12px" onclick="loadMantenimientosModule(true)">🔄 Reintentar</button></div>';
        return;
      }
    }
    updateStats();
    renderList();
  }

  function extractReportsFromInventario(inv) {
    mtState.reports = [];
    inv.forEach(function(rec) {
      var f = rec.fields||{};
      var equipo = f['Equipo']||f['EQUIPO']||'';
      var placa  = f['Numero de Placa']||f['PLACA']||'';
      var servicio = f['Servicio']||f['SERVICIO']||'';
      (f[FIELD_PREV]||[]).forEach(function(att) {
        var fn = att.filename||att.name||'reporte.pdf';
        var esTercero = fn.toUpperCase().startsWith('TERC_');
        mtState.reports.push({ id:att.id||att.url, tipo: esTercero ? 'Tercero' : 'Preventivo', equipo:equipo, placa:placa, servicio:servicio, equipoId:rec.id, filename:fn, url:att.url, fecha:extractDateFromFilename(fn), estado:extractEstadoFromFilename(fn), size:att.size });
      });
      (f[FIELD_CORR]||[]).forEach(function(att) {
        mtState.reports.push({ id:att.id||att.url, tipo:'Correctivo', equipo:equipo, placa:placa, servicio:servicio, equipoId:rec.id, filename:att.filename||att.name||'reporte.pdf', url:att.url, fecha:extractDateFromFilename(att.filename||''), estado:extractEstadoFromFilename(att.filename||''), size:att.size });
      });
    });
    mtState.reports.sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
  }

  function extractDateFromFilename(fn) { var m=fn.match(/(\d{4}-\d{2}-\d{2})/); return m?m[1]:''; }
  function extractEstadoFromFilename(fn) {
    if(/completado/i.test(fn)) return 'Completado';
    if(/en.?proceso/i.test(fn)) return 'En Proceso';
    if(/pendiente/i.test(fn)) return 'Pendiente';
    return 'Completado';
  }

  // ── STATS ─────────────────────────────────────────────────────────────
  function updateStats() {
    var all=mtState.reports;
    setText('mtStatTotal', all.length);
    setText('mtStatPrev', all.filter(function(r){return r.tipo==='Preventivo'}).length);
    setText('mtStatCorr', all.filter(function(r){return r.tipo==='Correctivo'}).length);
    setText('mtStatTerc', all.filter(function(r){return r.tipo==='Tercero'}).length);
    setText('mtStatEquipos', new Set(all.map(function(r){return r.equipoId})).size);
    setText('mtStatInv', mtState.inventario.length);
  }

  // ── RENDER LIST ───────────────────────────────────────────────────────
  function renderList() {
    var body = document.getElementById('mantBody');
    if (!body) return;
    var q = mtState.filterSearch.toLowerCase();
    var filtered = mtState.reports.filter(function(r) {
      if (mtState.filterTipo !== 'TODOS' && r.tipo !== mtState.filterTipo) return false;
      if (mtState.filterEstado !== 'TODOS' && r.estado !== mtState.filterEstado) return false;
      if (q && !r.equipo.toLowerCase().includes(q) && !r.placa.toLowerCase().includes(q) && !r.servicio.toLowerCase().includes(q) && !r.filename.toLowerCase().includes(q) && !(r.empresa||'').toLowerCase().includes(q)) return false;
      return true;
    });
    setText('mtCount', filtered.length+' reporte'+(filtered.length!==1?'s':''));
    if (!filtered.length) {
      body.innerHTML = '<div style="text-align:center;padding:60px;color:#90a4ae"><div style="font-size:48px;opacity:.4">🔧</div><div style="font-size:16px;font-weight:700;color:#546e7a;margin-top:12px">Sin reportes registrados</div><div style="font-size:13px;margin-top:6px;color:#90a4ae">Usa los botones para registrar un mantenimiento preventivo o correctivo.</div></div>';
      return;
    }
    var rows = filtered.map(function(r) {
      var tipoBadge = r.tipo==='Preventivo' ? '<span class="mt-badge mt-badge-prev">🛡️ Preventivo</span>' : r.tipo==='Tercero' ? '<span class="mt-badge" style="background:#e8f5e9;color:#1b5e20;border:1.5px solid #81c784;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">🏢 Tercero</span>' : '<span class="mt-badge mt-badge-corr">🔧 Correctivo</span>';
      var sizeKB = r.size ? Math.round(r.size/1024)+' KB' : '';
      var empresaRow = r.tipo==='Tercero' && r.empresa ? '<div style="font-size:11px;color:#2e7d32;font-weight:600;">🏢 '+esc(r.empresa)+'</div>' : '';
      return '<tr class="mt-row"><td class="mt-td">'+tipoBadge+'</td><td class="mt-td"><div class="mt-eq-name">'+esc(r.equipo)+'</div><div class="mt-eq-sub">'+esc(r.placa)+'</div>'+empresaRow+'</td><td class="mt-td">'+esc(r.servicio)+'</td><td class="mt-td">'+esc(fmt(r.fecha)||'—')+'</td><td class="mt-td" style="font-size:11px;color:#78909c;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.filename)+'">'+esc(r.filename)+'</td><td class="mt-td" style="font-size:11px;color:#90a4ae">'+sizeKB+'</td><td class="mt-td mt-actions">'+(r.url?'<a href="'+esc(r.url)+'" target="_blank" class="mt-btn-icon" title="Descargar/Ver PDF">📄</a>':'')+'</td></tr>';
    }).join('');
    body.innerHTML = '<div class="mt-table-wrap"><table class="mt-table"><thead><tr><th>TIPO</th><th>EQUIPO / PLACA</th><th>SERVICIO</th><th>FECHA</th><th>ARCHIVO</th><th>TAMAÑO</th><th>VER</th></tr></thead><tbody>'+rows+'</tbody></table></div><div style="padding:10px 16px;font-size:12px;color:#90a4ae;background:white;border-radius:0 0 12px 12px;border-top:1px solid #eceff1">Los reportes se almacenan como PDF en Airtable › Inventario › '+FIELD_PREV+' / '+FIELD_CORR+'</div>';
  }

  window.mtRenderList = renderList; // expuesto para modal de terceros
  window.mtSearch = function(){ mtState.filterSearch=(document.getElementById('mtSearchInput')||{}).value||''; renderList(); };
  window.mtFilterTipo = function(v){
    mtState.filterTipo=v;
    document.querySelectorAll('.mt-filter-btn').forEach(function(b){b.classList.remove('active')});
    var btn = document.querySelector('.mt-filter-btn[data-tipo="'+v+'"]');
    if(btn) btn.classList.add('active');
    renderList();
  };

  // Normalización de protocolos: evita que el selector falle si un protocolo
  // fue agregado con nombres alternos de campos (verificacion, pruebas, acciones).
  Object.keys(PROTOCOLOS).forEach(function(key) {
    var proto = PROTOCOLOS[key] || {};
    if (!Array.isArray(proto.frecuencia)) proto.frecuencia = proto.frecuencia ? [String(proto.frecuencia)] : ['Anual'];
    if (!Array.isArray(proto.condicionesPrevias)) proto.condicionesPrevias = [];
    if (!Array.isArray(proto.inspeccion)) proto.inspeccion = [];
    if (!Array.isArray(proto.verificacionBasica)) proto.verificacionBasica = Array.isArray(proto.verificacion) ? proto.verificacion : [];
    if (!Array.isArray(proto.pruebasFuncionales)) proto.pruebasFuncionales = Array.isArray(proto.pruebas) ? proto.pruebas : [];
    if (!Array.isArray(proto.estadoFinal)) proto.estadoFinal = ['Apto para uso', 'Apto con observaciones', 'No apto / retirar de servicio'];
    if (!Array.isArray(proto.accionesRealizadas)) proto.accionesRealizadas = Array.isArray(proto.acciones) ? proto.acciones : [];
    proto.nombre = proto.nombre || key.replace(/_/g, ' ').toUpperCase();
    proto.categoria = proto.categoria || 'Biomédico';
    proto.codigo = proto.codigo || 'SLV-GAT-BIO-MP';
    PROTOCOLOS[key] = proto;
  });

  window.mtFilterEstado = function(v) { mtState.filterEstado = v || 'TODOS'; renderList(); };

  // ══════════════════════════════════════════════════════════════════════
  // ABRIR FORMULARIO
  // ══════════════════════════════════════════════════════════════════════
  window.openMantForm = function(tipo) {
    console.log('[MANT] openMantForm llamado con tipo:', tipo);
    try {
      var modal = document.getElementById('mantFormModal');
      if (!modal) { console.error('[MANT] Modal mantFormModal no encontrado'); return; }
      var isPrev = tipo==='prev';
      stopTimer();
      mtState.timerElapsed = 0;
      mtState.timerStart = null;
      mtState.photos = {};

      var titleEl = document.getElementById('mantFormTitle');
      var tipoEl = document.getElementById('mantFormTipoHidden');
      var bodyEl = document.getElementById('mantFormBody');

      if (titleEl) titleEl.textContent = isPrev ? '🛡️ Registrar Mantenimiento Preventivo' : '🔧 Registrar Mantenimiento Correctivo';
      if (tipoEl) tipoEl.value = isPrev ? 'Preventivo' : 'Correctivo';

      if (isPrev) {
        console.log('[MANT] Construyendo selector de protocolo...');
        if (bodyEl) bodyEl.innerHTML = buildProtocolSelectorHTML();
        console.log('[MANT] Selector de protocolo renderizado');
      } else {
        if (bodyEl) bodyEl.innerHTML = buildFormHTML(false);
        setTimeout(function() { initSignaturePads(); }, 300);
        loadInvSelect();
        if (!mtState.invLoaded || mtState.inventario.length === 0) loadInventarioForForm();
      }

      modal.style.display = 'flex';
      modal.style.pointerEvents = 'auto';
      requestAnimationFrame(function() { 
        modal.classList.add('active'); 
        modal.style.opacity = '1';
      });
      console.log('[MANT] Modal abierto correctamente');
    } catch(e) {
      console.error('[MANT] Error en openMantForm:', e);
    }
  };

  // ── SELECTOR DE PROTOCOLO ─────────────────────────────────────────────
  function buildProtocolSelectorHTML() {
    var allCards = Object.keys(PROTOCOLOS).map(function(key) {
      var proto = PROTOCOLOS[key];
      var catColor = proto.categoria === 'Biomédico' ? '#1565c0' : proto.categoria === 'Mecánico' ? '#e65100' : '#2e7d32';
      var catIcon = proto.categoria === 'Biomédico' ? '🏥' : proto.categoria === 'Mecánico' ? '⚙️' : '🏗️';
      return '<div class="mf-protocol-card" data-proto-nombre="'+esc(proto.nombre.toLowerCase())+'" data-proto-cat="'+esc(proto.categoria.toLowerCase())+'" data-proto-cod="'+esc(proto.codigo.toLowerCase())+'" onclick="selectProtocol(\''+key+'\')" style="cursor:pointer"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="font-size:28px">'+catIcon+'</span><div><div style="font-weight:800;font-size:14px;color:#0a1628">'+esc(proto.nombre)+'</div><span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700;background:'+catColor+'22;color:'+catColor+';margin-top:4px">'+esc(proto.categoria)+'</span></div></div><div style="font-size:12px;color:#607d8b;margin-top:4px">Código: <strong>'+esc(proto.codigo)+'</strong> · Frecuencia: '+proto.frecuencia.join(' / ')+'</div><div style="font-size:11px;color:#90a4ae;margin-top:6px">'+proto.inspeccion.length+' ítems de inspección · '+proto.pruebasFuncionales.length+' pruebas funcionales</div></div>';
    }).join('');
    return '<div style="padding:10px 0">'
      + '<div style="font-size:15px;font-weight:700;color:#0a1628;margin-bottom:6px">Seleccione el protocolo de mantenimiento</div>'
      + '<div style="font-size:12px;color:#78909c;margin-bottom:12px">Cada tipo de equipo tiene su protocolo de inspección y verificación funcional específico.</div>'
      + '<div style="position:relative;margin-bottom:16px">'
      +   '<input id="protoSearch" type="text" placeholder="🔍  Buscar protocolo por nombre o categoría..." oninput="filterProtocolCards(this.value)" style="width:100%;padding:10px 14px 10px 38px;border:1.5px solid #90caf9;border-radius:10px;font-size:13px;font-family:Outfit,sans-serif;outline:none;box-sizing:border-box;background:#f0f7ff;">'
      +   '<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:16px;pointer-events:none;">🔍</span>'
      + '</div>'
      + '<div id="protoGrid" class="mf-protocol-grid">'+allCards+'</div>'
      + '<div id="protoEmpty" style="display:none;text-align:center;padding:30px;color:#90a4ae;font-size:13px;">Sin resultados. Intente con otra búsqueda.</div>'
      + '</div>';
  }

  window.filterProtocolCards = function(q) {
    var term = (q||'').toLowerCase().trim();
    var cards = document.querySelectorAll('#protoGrid .mf-protocol-card');
    var visible = 0;
    cards.forEach(function(card) {
      var nombre = card.dataset.protoNombre || '';
      var cat = card.dataset.protoCat || '';
      var cod = card.dataset.protoCod || '';
      var show = !term || nombre.includes(term) || cat.includes(term) || cod.includes(term);
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    var emptyEl = document.getElementById('protoEmpty');
    if (emptyEl) emptyEl.style.display = visible === 0 ? 'block' : 'none';
  };

  window.selectProtocol = function(protocolKey) {
    var proto = PROTOCOLOS[protocolKey];
    if (!proto) return;
    document.getElementById('mantFormBody').innerHTML = buildPrevProtocolFormHTML(protocolKey, proto);
    loadInvSelect();
    if (!mtState.invLoaded || mtState.inventario.length === 0) loadInventarioForForm();
    setTimeout(function() { initSignaturePads(); }, 300);
  };

  // ══════════════════════════════════════════════════════════════════════
  // FORMULARIO PREVENTIVO CON PROTOCOLO COMPLETO
  // ══════════════════════════════════════════════════════════════════════
  function buildPrevProtocolFormHTML(protocolKey, proto) {
    var color = '#1565c0';
    var inspeccionRows = proto.inspeccion.map(function(item, i) {
      return '<tr><td style="text-align:center;font-weight:700;color:#546e7a;width:40px">'+(i+1)+'</td><td style="font-size:12px;color:#263238;padding:8px 10px">'+esc(item.item)+'</td><td style="text-align:center;width:100px"><div style="display:flex;gap:6px;justify-content:center"><label class="mf-check-label"><input type="radio" name="insp_'+item.id+'" value="Si" class="mf-radio-input"><span class="mf-check-si">Sí</span></label><label class="mf-check-label"><input type="radio" name="insp_'+item.id+'" value="No" class="mf-radio-input"><span class="mf-check-no">No</span></label></div></td><td style="width:180px"><input type="text" class="mf-input mf-obs-input" id="obs_'+item.id+'" placeholder="Observaciones..." style="font-size:11px;padding:5px 8px"></td></tr>';
    }).join('');

    var pruebasRows = proto.pruebasFuncionales.map(function(pf, i) {
      var resButtons = pf.resultado.map(function(r) {
        return '<label class="mf-check-label"><input type="radio" name="pf_'+pf.id+'" value="'+r+'" class="mf-radio-input"><span class="mf-check-'+(r==='Pasa'||r==='Aplica'?'si':'no')+'">'+r+'</span></label>';
      }).join('');
      return '<tr><td style="text-align:center;font-weight:700;color:#546e7a;width:40px">'+(i+1)+'</td><td style="font-size:12px;color:#263238;padding:8px 10px">'+esc(pf.prueba)+'</td><td style="font-size:11px;color:#607d8b;text-align:center">'+esc(pf.valorEsperado)+'</td><td style="width:120px"><input type="text" class="mf-input" id="medido_'+pf.id+'" placeholder="Valor medido" style="font-size:11px;padding:5px 8px"></td><td style="text-align:center;width:110px"><div style="display:flex;gap:4px;justify-content:center">'+resButtons+'</div></td><td style="width:140px"><input type="text" class="mf-input mf-obs-input" id="pfobs_'+pf.id+'" placeholder="Obs..." style="font-size:11px;padding:5px 8px"></td></tr>';
    }).join('');

    var estadoOptions = proto.estadoFinal.map(function(e) {
      var icon = e === 'Apto para uso' ? '✅' : e === 'Apto con observaciones' ? '⚠️' : '❌';
      return '<label class="mf-radio-card"><input type="radio" name="estado_final" value="'+e+'"><span class="mf-radio-card-label">'+icon+' '+e+'</span></label>';
    }).join('');

    var accionesChecks = proto.accionesRealizadas.map(function(a) {
      return '<label class="mf-checkbox-card"><input type="checkbox" name="acciones_realizadas" value="'+a+'"><span class="mf-checkbox-card-label">'+a+'</span></label>';
    }).join('');

    var frecOptions = proto.frecuencia.map(function(f) { return '<option value="'+f+'">'+f+'</option>'; }).join('') + '<option value="Otra">Otra</option>';

    var condList = proto.condicionesPrevias.map(function(c) { return '<li style="font-size:12px;color:#37474f;line-height:1.5">'+esc(c)+'</li>'; }).join('');

    return '<input type="hidden" id="mfProtocolKey" value="'+protocolKey+'">'

    + '<div class="mf-proto-header"><div style="display:flex;align-items:center;gap:12px"><span style="font-size:32px">🏥</span><div><div style="font-weight:800;font-size:16px;color:#0a1628">'+esc(proto.nombre)+'</div><div style="font-size:12px;color:#607d8b;margin-top:2px">Código: '+esc(proto.codigo)+' · Categoría: '+esc(proto.categoria)+'</div></div></div></div>'

    + '<div class="mf-section-title" style="background:'+color+'">🏥 DATOS DEL EQUIPO</div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Equipo del Inventario *</label><select id="mfEquipoSelect" class="mf-select" style="display:none"><option value="">Cargando...</option></select><input type="hidden" id="mfEquipoId"><div id="mfEquipoSearchWrap" style="background:#f0f7ff;border:1.5px solid #90caf9;border-radius:12px;padding:14px;margin-top:6px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;"><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">📋 Nombre / Equipo</label><input id="mfSrchNombre" type="text" class="mf-input" placeholder="Ej: Monitor, Desfibrilador..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">🏷️ Marca</label><input id="mfSrchMarca" type="text" class="mf-input" placeholder="Ej: Nihon Kohden, Mindray..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;"><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">⚙️ Modelo</label><input id="mfSrchModelo" type="text" class="mf-input" placeholder="Ej: CSM-1501, BeneHeart D6..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">🔢 Número de Serie</label><input id="mfSrchSerie" type="text" class="mf-input" placeholder="Número de serie..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div></div><div id="mfEquipoDropdown" style="display:none;background:white;border:1.5px solid #90caf9;border-radius:10px;max-height:280px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.12);"></div><div id="mfEquipoSelected" style="display:none;background:#e8f5e9;border:1.5px solid #81c784;border-radius:8px;padding:10px 14px;margin-top:8px;"><div style="display:flex;justify-content:space-between;align-items:center;"><div id="mfEquipoSelectedLabel" style="font-size:13px;font-weight:700;color:#1b5e20;"></div><button type="button" onclick="clearInvEquipo()" style="background:none;border:none;color:#c62828;cursor:pointer;font-size:16px;font-weight:700;padding:0 4px;" title="Quitar selección">✕</button></div><div id="mfEquipoSelectedSub" style="font-size:11px;color:#388e3c;margin-top:3px;"></div></div></div></div></div>'
    + '<div class="mf-inv-card"><div class="mf-inv-title">📋 Datos del Equipo (autocompletados)</div><div class="mf-inv-grid"><div><span class="mf-inv-label">Nombre</span><input id="mf_equipo" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Placa</span><input id="mf_placa" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Marca</span><input id="mf_marca" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Modelo</span><input id="mf_modelo" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Serie</span><input id="mf_serie" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Servicio / Ubicación</span><input id="mf_servicio" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Clasificación Riesgo</span><input id="mf_riesgo" class="mf-inv-val" readonly></div></div></div>'

    + '<div class="mf-section-title" style="background:'+color+'">📅 EJECUCIÓN Y CRONÓMETRO</div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">Fecha de Ejecución *</label><input type="date" id="mfFechaEjecucion" class="mf-input" value="'+localDateStr()+'"></div><div class="mf-group"><label class="mf-label">Responsable / Ingeniero *</label><input type="text" id="mfTecnico" class="mf-input" placeholder="Nombre del ingeniero responsable"></div><div class="mf-group"><label class="mf-label">Frecuencia</label><input type="text" id="mfFrecuencia" class="mf-inv-val" readonly placeholder="Se autocompleta al seleccionar equipo"></div></div>'
    + '<div class="mf-timer-container"><div class="mf-timer-display" id="mfTimerDisplay">00:00:00</div><div style="font-size:11px;color:#78909c;margin-top:6px;text-align:center">El cronómetro se inicia automáticamente al verificar las condiciones previas</div></div>'

    + '<div class="mf-section-title" style="background:#37474f">⚠️ CONDICIONES PREVIAS Y SEGURIDAD</div>'
    + '<div class="mf-conditions-box"><ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">'+condList+'</ul><div style="margin-top:10px"><label class="mf-checkbox-card" style="background:#fff8e1;border-color:#ffd54f"><input type="checkbox" id="mfCondicionesOk" required onchange="onCondicionesPreviasChange(this)"><span class="mf-checkbox-card-label" style="font-weight:700;color:#795548">He leído y verifico que se cumplen todas las condiciones previas</span></label></div></div>'

    + '<div class="mf-section-title" style="background:'+color+'">🔍 INSPECCIÓN VISUAL Y LIMPIEZA</div>'
    + buildPhotoCaptureSectionHTML('inicio', '📸 Foto inicial del equipo (antes de iniciar)', '1️⃣')
    + '<div class="mf-table-container"><table class="mf-protocol-table"><thead><tr><th style="width:40px">No.</th><th>Ítem a verificar</th><th style="width:100px">Cumple</th><th style="width:180px">Observaciones</th></tr></thead><tbody>'+inspeccionRows+'</tbody></table></div>'

    // Verificación funcional básica (si el protocolo la incluye, ej: monitores)
    + (proto.verificacionBasica ? (function() {
      var vbRows = proto.verificacionBasica.map(function(item, i) {
        return '<tr><td style="text-align:center;font-weight:700;color:#546e7a;width:40px">'+(i+1)+'</td><td style="font-size:12px;color:#263238;padding:8px 10px">'+esc(item.item)+'</td><td style="text-align:center;width:100px"><div style="display:flex;gap:6px;justify-content:center"><label class="mf-check-label"><input type="radio" name="vb_'+item.id+'" value="Si" class="mf-radio-input"><span class="mf-check-si">Sí</span></label><label class="mf-check-label"><input type="radio" name="vb_'+item.id+'" value="No" class="mf-radio-input"><span class="mf-check-no">No</span></label></div></td><td style="width:180px"><input type="text" class="mf-input mf-obs-input" id="vbobs_'+item.id+'" placeholder="Observaciones..." style="font-size:11px;padding:5px 8px"></td></tr>';
      }).join('');
      return '<div class="mf-section-title" style="background:'+color+'">🖥️ VERIFICACIÓN FUNCIONAL BÁSICA</div>'
        + '<div class="mf-table-container"><table class="mf-protocol-table"><thead><tr><th style="width:40px">No.</th><th>Actividad / criterio</th><th style="width:100px">Cumple</th><th style="width:180px">Observaciones</th></tr></thead><tbody>'+vbRows+'</tbody></table></div>';
    }()) : '')

    + (protocolKey === 'laringoscopio_convencional_fibra_optica' ? '' :
       '<div class="mf-section-title" style="background:'+color+'">📐 EQUIPO DE VERIFICACIÓN</div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">Equipo utilizado</label><select id="mfEquipoVerificacion" class="mf-select"><option value="Simulador multiparámetro">Simulador multiparámetro</option><option value="Analizador de desfibrilador">Analizador de desfibrilador</option><option value="Vacuómetro patrón">Vacuómetro patrón</option><option value="Analizador de vacío">Analizador de vacío</option><option value="Termohigrómetro Fluke 971">Termohigrómetro Fluke 971</option><option value="Masas patrón">Masas patrón</option><option value="Otro">Otro</option></select></div><div class="mf-group"><label class="mf-label">Marca / Modelo del patrón</label><input type="text" id="mfMarcaPatron" class="mf-input" placeholder="Marca y modelo"></div></div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">No. Serie del patrón</label><input type="text" id="mfSeriePatron" class="mf-input" placeholder="Número de serie"></div><div class="mf-group"><label class="mf-label">Certificado vigente hasta</label><input type="date" id="mfCertificadoVigente" class="mf-input"></div><div class="mf-group"><label class="mf-label">Tolerancia definida (mmHg/kPa)</label><input type="text" id="mfTolerancia" class="mf-input" placeholder="± ____ mmHg / kPa"></div></div>')

    + '<div class="mf-section-title" style="background:'+color+'">⚡ PRUEBAS FUNCIONALES</div>'
    + buildPhotoCaptureSectionHTML('mitad', '📸 Foto durante el procedimiento (verificación)', '2️⃣')
    + '<div class="mf-table-container"><table class="mf-protocol-table"><thead><tr><th style="width:40px">No.</th><th>Prueba</th><th style="width:140px">Valor esperado</th><th style="width:120px">Valor medido</th><th style="width:110px">Resultado</th><th style="width:140px">Observaciones</th></tr></thead><tbody>'+pruebasRows+'</tbody></table></div>'

    + '<div class="mf-section-title" style="background:#263238">📋 RESULTADO FINAL DEL MANTENIMIENTO</div>'
    + '<div style="margin:10px 0"><label class="mf-label" style="margin-bottom:8px;display:block">Estado final del equipo *</label><div class="mf-radio-group">'+estadoOptions+'</div></div>'
    + '<div style="margin:14px 0"><label class="mf-label" style="margin-bottom:8px;display:block">Acciones realizadas</label><div class="mf-checkbox-group">'+accionesChecks+'</div></div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Observaciones técnicas</label><textarea id="mfObservaciones" class="mf-textarea" rows="3" placeholder="Observaciones sobre el estado del equipo..."></textarea></div></div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Recomendaciones</label><textarea id="mfRecomendaciones" class="mf-textarea" rows="3" placeholder="Recomendaciones para próximos mantenimientos..."></textarea></div></div>'
    + buildPhotoCaptureSectionHTML('final', '📸 Foto final del equipo (después del mantenimiento)', '3️⃣')

    + '<div class="mf-section-title" style="background:#263238">✍️ TRAZABILIDAD Y FIRMAS</div>'
    + '<div class="mf-firma-container"><div class="mf-firma-box"><div class="mf-firma-title">Elaboró / Ejecutó</div><canvas id="sigPadEjecuto" class="mf-signature-canvas" width="320" height="120"></canvas><button type="button" class="mf-firma-clear" onclick="clearSignature(\'sigPadEjecuto\')">Limpiar</button><input type="text" id="mfNombreEjecuto" class="mf-input" placeholder="Nombre completo" style="margin-top:6px;font-size:12px"><input type="text" id="mfCargoEjecuto" class="mf-input" placeholder="Cargo" style="margin-top:4px;font-size:12px"></div><div class="mf-firma-box"><div class="mf-firma-title">Recibió / Verificó</div><canvas id="sigPadRecibio" class="mf-signature-canvas" width="320" height="120"></canvas><button type="button" class="mf-firma-clear" onclick="clearSignature(\'sigPadRecibio\')">Limpiar</button><input type="text" id="mfNombreRecibio" class="mf-input" placeholder="Nombre completo" style="margin-top:6px;font-size:12px"><input type="text" id="mfCargoRecibio" class="mf-input" placeholder="Cargo" style="margin-top:4px;font-size:12px"></div></div>'

    + '<div style="background:#e8f5e9;border:1.5px solid #81c784;border-radius:10px;padding:12px 16px;margin-top:14px;font-size:13px;color:#2e7d32"><strong>💾 Al guardar</strong> se generará un PDF del reporte con el protocolo completo y se adjuntará automáticamente al equipo en <strong>"'+FIELD_PREV+'"</strong>.</div>';
  }

  // ══════════════════════════════════════════════════════════════════════
  // FORMULARIO CORRECTIVO
  // ══════════════════════════════════════════════════════════════════════
  function buildFormHTML(isPrev) {
    var color = '#b71c1c';
    return '<div class="mf-section-title" style="background:'+color+'">🔧 EQUIPO</div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Equipo del Inventario *</label><select id="mfEquipoSelect" class="mf-select" style="display:none"><option value="">Cargando...</option></select><input type="hidden" id="mfEquipoId"><div id="mfEquipoSearchWrap" style="background:#f0f7ff;border:1.5px solid #90caf9;border-radius:12px;padding:14px;margin-top:6px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;"><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">📋 Nombre / Equipo</label><input id="mfSrchNombre" type="text" class="mf-input" placeholder="Ej: Monitor, Desfibrilador..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">🏷️ Marca</label><input id="mfSrchMarca" type="text" class="mf-input" placeholder="Ej: Nihon Kohden, Mindray..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;"><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">⚙️ Modelo</label><input id="mfSrchModelo" type="text" class="mf-input" placeholder="Ej: CSM-1501, BeneHeart D6..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div><div><label style="font-size:11px;font-weight:700;color:#1565c0;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;">🔢 Número de Serie</label><input id="mfSrchSerie" type="text" class="mf-input" placeholder="Número de serie..." oninput="onInvSearchMulti()" autocomplete="off" style="background:white;"></div></div><div id="mfEquipoDropdown" style="display:none;background:white;border:1.5px solid #90caf9;border-radius:10px;max-height:280px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.12);"></div><div id="mfEquipoSelected" style="display:none;background:#e8f5e9;border:1.5px solid #81c784;border-radius:8px;padding:10px 14px;margin-top:8px;"><div style="display:flex;justify-content:space-between;align-items:center;"><div id="mfEquipoSelectedLabel" style="font-size:13px;font-weight:700;color:#1b5e20;"></div><button type="button" onclick="clearInvEquipo()" style="background:none;border:none;color:#c62828;cursor:pointer;font-size:16px;font-weight:700;padding:0 4px;" title="Quitar selección">✕</button></div><div id="mfEquipoSelectedSub" style="font-size:11px;color:#388e3c;margin-top:3px;"></div></div></div></div></div>'
    + '<div class="mf-inv-card"><div class="mf-inv-title">📋 Datos del Equipo (autocompletados)</div><div class="mf-inv-grid"><div><span class="mf-inv-label">Nombre</span><input id="mf_equipo" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Placa</span><input id="mf_placa" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Marca</span><input id="mf_marca" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Modelo</span><input id="mf_modelo" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Serie</span><input id="mf_serie" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Servicio / Ubicación</span><input id="mf_servicio" class="mf-inv-val" readonly></div><div><span class="mf-inv-label">Clasificación Riesgo</span><input id="mf_riesgo" class="mf-inv-val" readonly></div></div></div>'
    + '<div class="mf-section-title" style="background:'+color+'">📅 EJECUCIÓN</div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">Fecha de Ejecución *</label><input type="date" id="mfFechaEjecucion" class="mf-input" value="'+localDateStr()+'"></div><div class="mf-group"><label class="mf-label">Técnico Responsable *</label><input type="text" id="mfTecnico" class="mf-input" placeholder="Nombre del técnico"></div></div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">Duración (horas)</label><input type="number" id="mfDuracion" class="mf-input" step="0.5" min="0" placeholder="2.5"></div><div class="mf-group"><label class="mf-label">Costo (COP)</label><input type="number" id="mfCosto" class="mf-input" min="0" placeholder="150000"></div><div class="mf-group"><label class="mf-label">Estado</label><select id="mfEstado" class="mf-select"><option value="Completado">✔ Completado</option><option value="En Proceso">⚙ En Proceso</option><option value="Pendiente">⏳ Pendiente</option></select></div></div>'
    + '<div class="mf-section-title" style="background:'+color+'">📝 DETALLES</div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Falla Reportada *</label><textarea id="mfFallaReportada" class="mf-textarea" rows="3" placeholder="Describa la falla o problema reportado..."></textarea></div></div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Diagnóstico Técnico *</label><textarea id="mfDiagnostico" class="mf-textarea" rows="3" placeholder="Diagnóstico del problema encontrado..."></textarea></div></div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Acción Tomada / Solución *</label><textarea id="mfAccionTomada" class="mf-textarea" rows="3" placeholder="Solución implementada..."></textarea></div></div>'
    + '<div class="mf-row"><div class="mf-group"><label class="mf-label">Causa Raíz</label><input type="text" id="mfCausaRaiz" class="mf-input" placeholder="Causa raíz identificada"></div><div class="mf-group"><label class="mf-label">Repuestos Cambiados</label><input type="text" id="mfRepuestos" class="mf-input" placeholder="Fusible 5A, tarjeta de control..."></div></div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Hallazgos / Condición del Equipo</label><textarea id="mfHallazgos" class="mf-textarea" rows="3" placeholder="Estado general del equipo..."></textarea></div></div>'
    + '<div class="mf-row"><div class="mf-group mf-full"><label class="mf-label">Observaciones y Recomendaciones</label><textarea id="mfObservaciones" class="mf-textarea" rows="3" placeholder="Recomendaciones para próximos mantenimientos..."></textarea></div></div>'
    + '<div class="mf-section-title" style="background:'+color+'">📸 REGISTRO FOTOGRÁFICO</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:10px 0">'
    + buildPhotoCaptureSectionHTML('inicio','📸 Foto inicial (antes)', '1️⃣')
    + buildPhotoCaptureSectionHTML('mitad','📸 Durante la intervención', '2️⃣')
    + buildPhotoCaptureSectionHTML('final','📸 Foto final (después)', '3️⃣')
    + '</div>'
    + '<div class="mf-section-title" style="background:'+color+'">✍️ FIRMAS</div>'
    + '<div class="mf-firma-container">'
    + '<div class="mf-firma-box"><div class="mf-firma-title">Elaboró / Ejecutó</div><canvas id="sigPadEjecuto" class="mf-signature-canvas" width="320" height="120"></canvas><button type="button" class="mf-firma-clear" onclick="clearSignature(\'sigPadEjecuto\')">Limpiar</button><input type="text" id="mfNombreEjecuto" class="mf-input" placeholder="Nombre completo" style="margin-top:6px;font-size:12px"><input type="text" id="mfCargoEjecuto" class="mf-input" placeholder="Cargo" style="margin-top:4px;font-size:12px"></div>'
    + '<div class="mf-firma-box"><div class="mf-firma-title">Recibió / Verificó</div><canvas id="sigPadRecibio" class="mf-signature-canvas" width="320" height="120"></canvas><button type="button" class="mf-firma-clear" onclick="clearSignature(\'sigPadRecibio\')">Limpiar</button><input type="text" id="mfNombreRecibio" class="mf-input" placeholder="Nombre completo" style="margin-top:6px;font-size:12px"><input type="text" id="mfCargoRecibio" class="mf-input" placeholder="Cargo" style="margin-top:4px;font-size:12px"></div>'
    + '</div>'
    + '<div style="background:#fce4ec;border:1.5px solid #ef9a9a;border-radius:10px;padding:12px 16px;margin-top:14px;font-size:13px;color:#b71c1c"><strong>💾 Al guardar</strong> se generará un PDF del reporte y se adjuntará automáticamente al equipo en <strong>"'+FIELD_CORR+'"</strong>.</div>';
  }

  // ══════════════════════════════════════════════════════════════════════
  // CRONÓMETRO
  // ══════════════════════════════════════════════════════════════════════
  window.toggleTimer = function() {
    if (mtState.timerRunning) stopTimer(); else startTimer();
  };
  function startTimer() {
    mtState.timerRunning = true;
    mtState.timerStart = Date.now() - mtState.timerElapsed;
    mtState.timerInterval = setInterval(updateTimerDisplay, 1000);
    var btn = document.getElementById('mfTimerStartBtn');
    if (btn) { btn.textContent = '⏸ Pausar'; btn.classList.remove('mf-timer-start'); btn.classList.add('mf-timer-pause'); }
    updateTimerDisplay();
  }
  function stopTimer() {
    mtState.timerRunning = false;
    if (mtState.timerInterval) { clearInterval(mtState.timerInterval); mtState.timerInterval = null; }
    if (mtState.timerStart) mtState.timerElapsed = Date.now() - mtState.timerStart;
    var btn = document.getElementById('mfTimerStartBtn');
    if (btn) { btn.textContent = '▶ Continuar'; btn.classList.remove('mf-timer-pause'); btn.classList.add('mf-timer-start'); }
  }
  window.resetTimer = function() {
    stopTimer(); mtState.timerElapsed = 0; mtState.timerStart = null; updateTimerDisplay();
    var btn = document.getElementById('mfTimerStartBtn');
    if (btn) btn.textContent = '▶ Iniciar Protocolo';
  };

  // Auto-iniciar cronómetro al marcar condiciones previas
  window.onCondicionesPreviasChange = function(checkbox) {
    if (checkbox.checked) {
      if (!mtState.timerRunning) {
        startTimer();
        showMtToast('⏱️ Cronómetro iniciado automáticamente', 'ok');
      }
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // CAPTURA DE FOTOS (Inicio, Mitad, Final del procedimiento)
  // ══════════════════════════════════════════════════════════════════════
  window.capturePhoto = function(photoId) {
    var input = document.getElementById('photoInput_' + photoId);
    if (input) input.click();
  };

  window.onPhotoSelected = function(input, photoId) {
    var file = input.files && input.files[0];
    if (!file) return;
    // Comprimir imagen a max 800px y calidad 0.6 para que el HTML no sea enorme
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var maxW = 800, maxH = 600;
        var w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        var compressed = canvas.toDataURL('image/jpeg', 0.6);

        var preview = document.getElementById('photoPreview_' + photoId);
        var placeholder = document.getElementById('photoPlaceholder_' + photoId);
        var removeBtn = document.getElementById('photoRemoveBtn_' + photoId);
        if (preview) { preview.src = compressed; preview.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'inline-block';
        if (!mtState.photos) mtState.photos = {};
        mtState.photos[photoId] = compressed;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  window.removePhoto = function(photoId) {
    var preview = document.getElementById('photoPreview_' + photoId);
    var placeholder = document.getElementById('photoPlaceholder_' + photoId);
    var removeBtn = document.getElementById('photoRemoveBtn_' + photoId);
    var input = document.getElementById('photoInput_' + photoId);
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex';
    if (removeBtn) removeBtn.style.display = 'none';
    if (input) input.value = '';
    if (mtState.photos) delete mtState.photos[photoId];
  };

  function buildPhotoCaptureSectionHTML(position, label, icon) {
    return '<div class="mf-photo-capture" style="margin:12px 0;padding:12px 16px;background:#f8f9fa;border:1.5px dashed #b0bec5;border-radius:10px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:20px">'+icon+'</span><div style="font-weight:700;font-size:13px;color:#263238">'+esc(label)+'</div></div>'
      + '<input type="file" accept="image/*" capture="environment" id="photoInput_'+position+'" style="display:none" onchange="onPhotoSelected(this,\''+position+'\')">'
      + '<div id="photoPlaceholder_'+position+'" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:white;border-radius:8px;cursor:pointer;border:1px solid #e0e0e0" onclick="capturePhoto(\''+position+'\')">'
      + '<span style="font-size:32px;opacity:0.5">📷</span>'
      + '<span style="font-size:12px;color:#78909c;margin-top:6px">Toca para tomar foto</span>'
      + '</div>'
      + '<img id="photoPreview_'+position+'" style="display:none;max-width:100%;max-height:200px;border-radius:8px;margin-top:8px;object-fit:contain;border:1px solid #e0e0e0">'
      + '<button type="button" id="photoRemoveBtn_'+position+'" style="display:none;margin-top:6px;padding:4px 12px;font-size:11px;color:#c62828;background:#ffebee;border:1px solid #ef9a9a;border-radius:6px;cursor:pointer" onclick="removePhoto(\''+position+'\')">✕ Eliminar foto</button>'
      + '</div>';
  }
  function updateTimerDisplay() {
    var el = document.getElementById('mfTimerDisplay');
    if (!el) return;
    var elapsed = mtState.timerRunning ? Date.now() - mtState.timerStart : mtState.timerElapsed;
    var totalSec = Math.floor(elapsed / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    el.textContent = String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function getTimerDuration() {
    var elapsed = mtState.timerRunning ? Date.now() - mtState.timerStart : mtState.timerElapsed;
    var totalMin = Math.round(elapsed / 60000);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    return h > 0 ? h+'h '+m+'min' : m+' min';
  }

  // ══════════════════════════════════════════════════════════════════════
  // FIRMA DIGITAL — Implementacion de alto rendimiento
  // ══════════════════════════════════════════════════════════════════════
  //   • Pointer Events (un solo API para mouse / touch / stylus)
  //   • getCoalescedEvents()  → captura todas las muestras intermedias del lapiz
  //   • requestAnimationFrame → alinea el dibujo con el repaint del navegador
  //   • Bounding rect cacheado al pointerdown → cero reflow durante el trazo
  //   • beginPath() por segmento → cada draw es O(1), no crece con el tiempo
  //   • Suavizado cuadratico por midpoints → curvas suaves entre muestras
  //   • setPointerCapture → el lapiz no pierde el trazo al salir del canvas
  //   • desynchronized:true → render del canvas en hilo separado del DOM
  //   • Guard de idempotencia → reabrir el modal no duplica listeners
  function initSignaturePads() {
    ['sigPadEjecuto', 'sigPadRecibio'].forEach(function(id) {
      var canvas = document.getElementById(id);
      if (!canvas) return;

      // Re-init en el MISMO canvas: solo re-medir, no re-enlazar listeners
      if (canvas.__sigBound) {
        if (canvas.__sigFit) canvas.__sigFit();
        return;
      }
      canvas.__sigBound = true;

      var ctx = canvas.getContext('2d', { desynchronized: true });
      var DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      var pad = mtState.signaturePads[id] = { canvas: canvas, ctx: ctx, hasDrawn: false };

      function applyStyle() {
        ctx.strokeStyle = '#1a237e';
        ctx.fillStyle   = '#1a237e';
        ctx.lineWidth   = 2;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
      }

      function fitCanvas() {
        var rect = canvas.getBoundingClientRect();
        var w = Math.max(1, Math.round(rect.width));
        var h = Math.max(1, Math.round(rect.height));
        var targetW = w * DPR, targetH = h * DPR;
        if (canvas.width !== targetW || canvas.height !== targetH) {
          // IMPORTANTE TABLET/MOVIL:
          // Al enfocar un input, el teclado virtual cambia el viewport y dispara resize.
          // Cambiar canvas.width/height borra el contenido del canvas por definición.
          // Por eso guardamos la imagen actual y la restauramos después de redimensionar.
          var hadDrawing = !!pad.hasDrawn;
          var snapshot = null;
          if (hadDrawing && canvas.width > 1 && canvas.height > 1) {
            try { snapshot = canvas.toDataURL('image/png'); } catch (_) { snapshot = null; }
          }

          canvas.width = targetW;
          canvas.height = targetH;
          ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
          applyStyle();

          if (snapshot) {
            var img = new Image();
            img.onload = function() {
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
              applyStyle();
              pad.hasDrawn = true;
            };
            img.src = snapshot;
          }
        } else {
          ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
          applyStyle();
        }
      }
      canvas.__sigFit = fitCanvas;
      fitCanvas();

      // Estado del trazo (cerrado en este scope por canvas)
      var drawing   = false;
      var rectCache = null;   // bounding rect cacheado al pointerdown
      var pending   = [];     // puntos pendientes a renderizar en el proximo rAF
      var lastPt    = null;   // ultima muestra cruda
      var lastMid   = null;   // ultimo midpoint usado como ancla de la curva
      var rafId     = 0;

      function pointFromEvent(e) {
        return { x: e.clientX - rectCache.left, y: e.clientY - rectCache.top };
      }

      function flush() {
        rafId = 0;
        var n = pending.length;
        if (!n) return;
        for (var i = 0; i < n; i++) {
          var p = pending[i];
          if (!lastPt) {
            // Primer punto del trazo: dibuja un puntito (por si el usuario
            // solo presiona sin moverse — ej. para un punto sobre la "i").
            ctx.beginPath();
            ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
            ctx.fill();
            lastPt  = p;
            lastMid = p;
          } else {
            // Suavizado cuadratico: dibuja una curva desde el midpoint
            // anterior hasta el nuevo midpoint, con lastPt como control.
            var mid = { x: (lastPt.x + p.x) / 2, y: (lastPt.y + p.y) / 2 };
            ctx.beginPath();
            ctx.moveTo(lastMid.x, lastMid.y);
            ctx.quadraticCurveTo(lastPt.x, lastPt.y, mid.x, mid.y);
            ctx.stroke();
            lastPt  = p;
            lastMid = mid;
          }
        }
        pending.length = 0;
      }

      function schedule() {
        if (!rafId) rafId = requestAnimationFrame(flush);
      }

      function onDown(e) {
        // Solo boton principal del raton; touch y stylus pasan siempre
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        drawing      = true;
        pad.hasDrawn = true;
        rectCache    = canvas.getBoundingClientRect();
        lastPt       = null;
        lastMid      = null;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        pending.push(pointFromEvent(e));
        schedule();
        e.preventDefault();
      }

      function onMove(e) {
        if (!drawing) return;
        // Coalesced events: en stylus el browser entrega UN evento por frame
        // con varias muestras de alta frecuencia. Tomarlas todas es lo que
        // hace que la escritura se sienta fluida.
        var coal = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : null;
        if (coal && coal.length) {
          for (var i = 0; i < coal.length; i++) pending.push(pointFromEvent(coal[i]));
        } else {
          pending.push(pointFromEvent(e));
        }
        schedule();
        e.preventDefault();
      }

      function onUp(e) {
        if (!drawing) return;
        drawing = false;
        pending.push(pointFromEvent(e));
        flush(); // dibuja el ultimo segmento inmediatamente
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        rectCache = null;
      }

      canvas.addEventListener('pointerdown',   onDown);
      canvas.addEventListener('pointermove',   onMove);
      canvas.addEventListener('pointerup',     onUp);
      canvas.addEventListener('pointercancel', onUp);
      // Si el modal cambia de tamaño (resize / orientacion), re-ajustar.
      // En tablets el teclado virtual dispara muchos resize al tocar inputs; se usa debounce
      // para evitar redimensionamientos repetidos durante la escritura.
      var resizeTimer = null;
      function scheduleFitCanvas() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fitCanvas, 180);
      }
      window.addEventListener('resize', scheduleFitCanvas);
      window.addEventListener('orientationchange', scheduleFitCanvas);
    });
  }

  window.clearSignature = function(canvasId) {
    var pad = mtState.signaturePads[canvasId];
    if (!pad) return;
    // El ctx tiene un setTransform(DPR,0,0,DPR,0,0) aplicado. Para limpiar
    // toda el area en pixeles fisicos, reseteamos transform temporalmente.
    var prev = pad.ctx.getTransform ? pad.ctx.getTransform() : null;
    pad.ctx.setTransform(1, 0, 0, 1, 0, 0);
    pad.ctx.clearRect(0, 0, pad.canvas.width, pad.canvas.height);
    if (prev) pad.ctx.setTransform(prev);
    pad.hasDrawn = false;
  };

  function getSignatureDataURL(canvasId) {
    var pad = mtState.signaturePads[canvasId];
    if (!pad || !pad.hasDrawn) return '';
    // Canvas pequeño para reducir el tamaño del base64 que va al PDF
    var small = document.createElement('canvas');
    small.width  = 320;
    small.height = 120;
    var sctx = small.getContext('2d');
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, 320, 120);
    sctx.drawImage(pad.canvas, 0, 0, 320, 120);
    return small.toDataURL('image/jpeg', 0.6);
  }

  // ══════════════════════════════════════════════════════════════════════
  // INVENTARIO + SELECT
  // ══════════════════════════════════════════════════════════════════════
  async function loadInventarioForForm() {
    var sel = document.getElementById('mfEquipoSelect');
    if (sel) sel.innerHTML = '<option value="">⏳ Cargando equipos...</option>';
    try {
      var inv = [], ioff = null;
      do {
        var p = new URLSearchParams({ pageSize: '100' });
        if (ioff) p.set('offset', ioff);
        var r = await axios.get(BASE + '/inventario?' + p, { headers: hdr() });
        var d = r.data || {};
        inv = inv.concat(d.records || d.data || []);
        ioff = d.offset || null;
      } while (ioff);
      mtState.inventario = inv;
      mtState.invLoaded = true;
      loadInvSelect();
    } catch (err) {
      var sel2 = document.getElementById('mfEquipoSelect');
      if (sel2) sel2.innerHTML = '<option value="">⚠️ Error al cargar equipos</option>';
    }
  }

  window.closeMantForm = function() {
    stopTimer();
    var m = document.getElementById('mantFormModal');
    if (m) { 
      m.classList.remove('active'); 
      m.style.opacity = '0';
      m.style.pointerEvents = 'none'; 
      setTimeout(function() { m.style.display = 'none'; }, 260); 
    }
  };

  // Función global para manejar cambio de equipo en select
  window.onEquipoSelectChange = function() {
    // Compatibilidad con select legacy — el widget de búsqueda usa selectInvEquipo()
    var sel = document.getElementById('mfEquipoSelect');
    if (!sel) return;
    var opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) return;
    ['equipo','placa','marca','modelo','serie','servicio','riesgo'].forEach(function(k) {
      var el = document.getElementById('mf_'+k);
      if (el) el.value = opt.dataset[k] || '';
    });
    var freqEl = document.getElementById('mfFrecuencia');
    if (freqEl) freqEl.value = opt.dataset.frecuencia || '';
  };

  // ─── Datos de inventario cacheados para búsqueda ───────────────────────
  var _invData = []; // Se llena al cargar

  function _buildInvData(inventario) {
    _invData = inventario.map(function(r) {
      var f = r.fields || {};
      return {
        id: r.id,
        nm: f['Equipo']||f['EQUIPO']||'',
        pl: f['Numero de Placa']||f['PLACA']||'',
        marca: f['Marca']||f['MARCA']||'',
        modelo: f['Modelo']||f['MODELO']||'',
        serie: f['Serie']||f['SERIE']||'',
        servicio: f['Servicio']||f['SERVICIO']||'',
        riesgo: f['Clasificacion del Riesgo']||f['Clasificacion Riesgo']||f['Clasificacion de Riesgo']||f['CLASIFICACION RIESGO']||f['Clasificación del Riesgo']||'',
        frecuencia: f['Frecuencia de MTTO Preventivo']||f['Frecuencia de Mantenimiento']||f['FRECUENCIA DE MTTO PREVENTIVO']||f['Frecuencia de MTTO']||'',
      };
    });
  }

  function _renderInvDropdown(items) {
    var list = document.getElementById('mfEquipoDropdown');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div style="padding:12px 14px;color:#90a4ae;font-size:13px;">Sin resultados</div>';
      list.style.display = 'block';
      return;
    }
    list.innerHTML = items.slice(0, 50).map(function(eq) {
      var label = '<strong>' + esc(eq.nm) + '</strong>';
      if (eq.marca || eq.modelo) label += ' <span style="color:#78909c;font-size:11px;">' + esc([eq.marca, eq.modelo].filter(Boolean).join(' ')) + '</span>';
      var sub = [];
      if (eq.serie) sub.push('S/N: ' + esc(eq.serie));
      if (eq.pl) sub.push('Placa: ' + esc(eq.pl));
      if (eq.servicio) sub.push(esc(eq.servicio));
      var subHtml = sub.length ? '<div style="font-size:11px;color:#90a4ae;margin-top:2px;">' + sub.join(' · ') + '</div>' : '';
      return '<div class="mf-inv-item" data-eqid="' + esc(eq.id) + '" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f0f0;">'
        + '<div style="font-size:13px;">' + label + '</div>'
        + subHtml
        + '</div>';
    }).join('');
    // Hover via event delegation (avoids quote conflicts)
    list.querySelectorAll('.mf-inv-item').forEach(function(item) {
      item.addEventListener('mouseenter', function() { this.style.background = '#e3f2fd'; });
      item.addEventListener('mouseleave', function() { this.style.background = ''; });
      item.addEventListener('click', function() { selectInvEquipo(this.dataset.eqid); });
    });
    list.style.display = 'block';
  }

  window.onInvSearchMulti = function() {
    var qNombre = (document.getElementById('mfSrchNombre') && document.getElementById('mfSrchNombre').value || '').toLowerCase().trim();
    var qMarca  = (document.getElementById('mfSrchMarca')  && document.getElementById('mfSrchMarca').value  || '').toLowerCase().trim();
    var qModelo = (document.getElementById('mfSrchModelo') && document.getElementById('mfSrchModelo').value || '').toLowerCase().trim();
    var qSerie  = (document.getElementById('mfSrchSerie')  && document.getElementById('mfSrchSerie').value  || '').toLowerCase().trim();

    // Limpiar selección previa
    var hidden = document.getElementById('mfEquipoId');
    if (hidden) hidden.value = '';
    var sel = document.getElementById('mfEquipoSelected');
    if (sel) sel.style.display = 'none';
    ['equipo','placa','marca','modelo','serie','servicio','riesgo'].forEach(function(k) {
      var el = document.getElementById('mf_'+k); if (el) el.value = '';
    });

    // Si todos los campos están vacíos, ocultar dropdown
    if (!qNombre && !qMarca && !qModelo && !qSerie) {
      var list = document.getElementById('mfEquipoDropdown');
      if (list) list.style.display = 'none';
      return;
    }

    var filtered = _invData.filter(function(eq) {
      if (qNombre && !eq.nm.toLowerCase().includes(qNombre)) return false;
      if (qMarca  && !eq.marca.toLowerCase().includes(qMarca))  return false;
      if (qModelo && !eq.modelo.toLowerCase().includes(qModelo)) return false;
      if (qSerie  && !eq.serie.toLowerCase().includes(qSerie))  return false;
      return true;
    });
    _renderInvDropdown(filtered);
  };

  // Mantener compatibilidad con código que llame onInvSearch
  window.onInvSearch = window.onInvSearchMulti;

  window.selectInvEquipo = function(id) {
    var eq = _invData.find(function(e){ return e.id === id; });
    if (!eq) return;
    // Guardar ID en campo oculto
    var hidden = document.getElementById('mfEquipoId');
    if (hidden) hidden.value = id;
    // Mostrar panel de equipo seleccionado
    var selPanel = document.getElementById('mfEquipoSelected');
    var selLabel = document.getElementById('mfEquipoSelectedLabel');
    var selSub   = document.getElementById('mfEquipoSelectedSub');
    if (selPanel) selPanel.style.display = 'block';
    if (selLabel) selLabel.textContent = '✅ ' + eq.nm + (eq.marca||eq.modelo ? ' — '+[eq.marca,eq.modelo].filter(Boolean).join(' ') : '');
    if (selSub) {
      var parts = [];
      if (eq.serie) parts.push('S/N: ' + eq.serie);
      if (eq.pl)    parts.push('Placa: ' + eq.pl);
      if (eq.servicio) parts.push(eq.servicio);
      selSub.textContent = parts.join(' · ');
    }
    // Autocompletar campos del equipo
    ['equipo','placa','marca','modelo','serie','servicio','riesgo'].forEach(function(k) {
      var el = document.getElementById('mf_'+k);
      if (el) el.value = eq[k === 'equipo' ? 'nm' : k === 'placa' ? 'pl' : k] || '';
    });
    var freqEl = document.getElementById('mfFrecuencia');
    if (freqEl) freqEl.value = eq.frecuencia || '';
    // Cerrar dropdown
    var list = document.getElementById('mfEquipoDropdown');
    if (list) list.style.display = 'none';
  };

  window.clearInvEquipo = function() {
    var hidden = document.getElementById('mfEquipoId');
    if (hidden) hidden.value = '';
    var selPanel = document.getElementById('mfEquipoSelected');
    if (selPanel) selPanel.style.display = 'none';
    ['mfSrchNombre','mfSrchMarca','mfSrchModelo','mfSrchSerie'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    ['equipo','placa','marca','modelo','serie','servicio','riesgo'].forEach(function(k) {
      var el = document.getElementById('mf_'+k); if (el) el.value = '';
    });
    var list = document.getElementById('mfEquipoDropdown');
    if (list) list.style.display = 'none';
    var freqEl = document.getElementById('mfFrecuencia');
    if (freqEl) freqEl.value = '';
  };

  // Cerrar dropdown al hacer clic fuera del panel de búsqueda
  document.addEventListener('click', function(e) {
    var wrap = document.getElementById('mfEquipoSearchWrap');
    if (wrap && !wrap.contains(e.target)) {
      var list = document.getElementById('mfEquipoDropdown');
      if (list) list.style.display = 'none';
    }
  });

  function _invSearchWidget() {
    return '<div id="mfEquipoSearchWrap" style="position:relative;">'
      + '<input id="mfEquipoSearch" type="text" class="mf-input" placeholder="🔍  Buscar por nombre, marca, modelo, serie o servicio..." oninput="onInvSearch(this)" autocomplete="off" style="padding-left:14px;">'
      + '<input type="hidden" id="mfEquipoId">'
      + '<div id="mfEquipoDropdown" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:white;border:1.5px solid #90caf9;border-radius:10px;max-height:260px;overflow-y:auto;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.12);">'
      + '</div>'
      + '</div>';
  }

  function loadInvSelect() {
    // Poblar datos de búsqueda
    _buildInvData(mtState.inventario);
    // El widget de búsqueda ya está en el HTML del formulario (mfEquipoSearchWrap)
    // Solo necesitamos asegurar que los datos estén listos — nada más que hacer aquí.
  }

  // ══════════════════════════════════════════════════════════════════════
  // GUARDAR
  // ══════════════════════════════════════════════════════════════════════
  window.saveMantForm = async function() {
    var tipo = getVal('mantFormTipoHidden');
    var isPrev = tipo === 'Preventivo';

    // Soporte para widget de búsqueda (mfEquipoId) y select legacy
    var equipoId = getVal('mfEquipoId');
    var eq = equipoId ? _invData.find(function(e){ return e.id === equipoId; }) : null;
    var sel = document.getElementById('mfEquipoSelect');
    var opt = null;
    if (!eq && sel) {
      opt = sel.options[sel.selectedIndex];
      if (opt && opt.value) {
        equipoId = opt.value;
        eq = { id:equipoId, nm:opt.dataset.equipo||'', pl:opt.dataset.placa||'', marca:opt.dataset.marca||'', modelo:opt.dataset.modelo||'', serie:opt.dataset.serie||'', servicio:opt.dataset.servicio||'', riesgo:opt.dataset.riesgo||'', frecuencia:opt.dataset.frecuencia||'' };
      }
    }
    // Crear opt-like object para compatibilidad con código existente
    if (eq && !opt) {
      opt = { value: eq.id, dataset: { equipo:eq.nm, placa:eq.pl, marca:eq.marca, modelo:eq.modelo, serie:eq.serie, servicio:eq.servicio, riesgo:eq.riesgo, frecuencia:eq.frecuencia } };
    }

    var tecnico = getVal('mfTecnico');
    var fecha = getVal('mfFechaEjecucion');

    if (!opt||!opt.value) { showMtToast('⚠️ Selecciona un equipo usando el buscador.','warn'); return; }
    if (!tecnico.trim()) { showMtToast('⚠️ El responsable es requerido.','warn'); return; }
    if (!fecha) { showMtToast('⚠️ La fecha es requerida.','warn'); return; }

    stopTimer();
    var saveBtn = document.getElementById('mantFormSaveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><span class="mt-spinner" style="width:18px;height:18px;border-width:3px"></span>Generando PDF y guardando...</span>'; }

    try {
      var htmlReport;
      var protocolKey = getVal('mfProtocolKey');

      if (isPrev && protocolKey && PROTOCOLOS[protocolKey]) {
        var proto = PROTOCOLOS[protocolKey];
        var data = collectProtocolData(proto, opt);
        htmlReport = buildProtocolPDFHTML(data, proto);
      } else {
        var data = {
          tipo:tipo, isPrev:isPrev, equipoId:opt.value,
          equipo:opt.dataset.equipo||'', placa:opt.dataset.placa||'',
          marca:opt.dataset.marca||'', modelo:opt.dataset.modelo||'',
          serie:opt.dataset.serie||'', servicio:opt.dataset.servicio||'',
          riesgo:opt.dataset.riesgo||'', fecha:fecha, tecnico:tecnico,
          duracion:getVal('mfDuracion'), costo:getVal('mfCosto'), estado:getVal('mfEstado'),
          hallazgos:getVal('mfHallazgos'), observaciones:getVal('mfObservaciones'),
          firmaResponsable:getVal('mfFirmaResponsable'),
          fallaReportada:getVal('mfFallaReportada'), diagnostico:getVal('mfDiagnostico'),
          accionTomada:getVal('mfAccionTomada'), causaRaiz:getVal('mfCausaRaiz'),
          repuestos:getVal('mfRepuestos'),
          // Firmas digitales
          firmaEjecuto:getSignatureDataURL('sigPadEjecuto'),
          nombreEjecuto:getVal('mfNombreEjecuto'),
          cargoEjecuto:getVal('mfCargoEjecuto'),
          firmaRecibio:getSignatureDataURL('sigPadRecibio'),
          nombreRecibio:getVal('mfNombreRecibio'),
          cargoRecibio:getVal('mfCargoRecibio'),
          // Fotos
          fotoInicio:(mtState.photos&&mtState.photos['inicio'])||null,
          fotoMitad:(mtState.photos&&mtState.photos['mitad'])||null,
          fotoFinal:(mtState.photos&&mtState.photos['final'])||null,
        };
        htmlReport = buildCorrectiveReportHTML(data);
      }

      // ── Generar PDF real con html2pdf.js ──
      if (saveBtn) saveBtn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><span class="mt-spinner" style="width:18px;height:18px;border-width:3px"></span>Generando PDF...</span>';

      var safeName = (opt.dataset.equipo||'equipo').replace(/[^a-zA-Z0-9]/g,'_').slice(0,30);
      var filename = (isPrev?'PREV':'CORR')+'_'+safeName+'_'+fecha+'_Completado.pdf';
      var fieldName = isPrev ? FIELD_PREV : FIELD_CORR;

      // Quitar script y botón imprimir del HTML
      var cleanHTML = htmlReport.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<button[^>]*id="btnPrint"[^>]*>[\s\S]*?<\/button>/gi, '');

      // Generar PDF: usar iframe oculto — html2canvas corre DENTRO del iframe para capturar estilos
      var pdfBlob = await new Promise(function(resolve, reject) {
        var iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:0;top:0;width:794px;height:1123px;opacity:0;pointer-events:none;z-index:-1;border:none;';
        document.body.appendChild(iframe);

        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(cleanHTML);
        iframeDoc.close();

        // Esperar renderizado completo del HTML dentro del iframe
        setTimeout(function() {
          var imgs = iframeDoc.querySelectorAll('img');
          var imgPromises = Array.from(imgs).map(function(img) {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(function(res) {
              img.onload = res;
              img.onerror = res;
              setTimeout(res, 5000);
            });
          });

          Promise.all(imgPromises).then(function() {
            setTimeout(function() {
              // Cargar html2pdf.bundle DENTRO del iframe para que capture los estilos del iframe
              var script = iframeDoc.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';
              script.onload = function() {
                var iframeHtml2pdf = iframe.contentWindow.html2pdf;
                iframeHtml2pdf().set({
                  margin: 10,
                  filename: filename,
                  image: { type: 'jpeg', quality: 0.95 },
                  html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    letterRendering: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff'
                  },
                  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                  pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
                }).from(iframeDoc.body).outputPdf('blob').then(function(blob) {
                  document.body.removeChild(iframe);
                  resolve(blob);
                }).catch(function(err) {
                  document.body.removeChild(iframe);
                  reject(err);
                });
              };
              script.onerror = function() {
                // Fallback: usar html2pdf de la ventana principal (sin estilos iframe)
                html2pdf().set({
                  margin: 10,
                  filename: filename,
                  image: { type: 'jpeg', quality: 0.92 },
                  html2canvas: { scale: 2, useCORS: true, logging: false },
                  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                  pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
                }).from(iframeDoc.body).outputPdf('blob').then(function(blob) {
                  document.body.removeChild(iframe);
                  resolve(blob);
                }).catch(function(err) {
                  document.body.removeChild(iframe);
                  reject(err);
                });
              };
              iframeDoc.head.appendChild(script);
            }, 1000);
          });
        }, 800);
      });

      // Convertir blob a base64 para enviar al backend
      var pdfBase64 = await new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() {
          var b64 = reader.result.split(',')[1];
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      if (saveBtn) saveBtn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><span class="mt-spinner" style="width:18px;height:18px;border-width:3px"></span>Subiendo a Airtable...</span>';

      var uploadRes = await axios.post(BASE+'/upload-pdf', {
        recordId: opt.value, fieldName: fieldName, filename: filename,
        contentType: 'application/pdf', base64: pdfBase64,
      }, { headers: hdr() });

      if (!uploadRes.data.ok) throw new Error(uploadRes.data.error||'Error al subir');

      mtState.reports.unshift({
        id:filename, tipo:tipo, equipo:opt.dataset.equipo||'',
        placa:opt.dataset.placa||'', servicio:opt.dataset.servicio||'',
        equipoId:opt.value, filename:filename, fecha:fecha, estado:'Completado', url:null,
      });
      mtState.invLoaded = false;
      closeMantForm();
      updateStats();
      renderList();
      showMtToast('✅ PDF guardado en Airtable · '+fieldName,'ok');
    } catch(err) {
      console.error('saveMantForm error:', err);
      showMtToast('❌ Error: '+(err&&err.message||JSON.stringify(err)),'err');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '💾 Guardar'; }
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // RECOPILAR DATOS DEL PROTOCOLO
  // ══════════════════════════════════════════════════════════════════════
  function collectProtocolData(proto, opt) {
    var inspeccion = proto.inspeccion.map(function(item) {
      var checked = document.querySelector('input[name="insp_'+item.id+'"]:checked');
      return { item: item.item, cumple: checked ? checked.value : '—', observaciones: getVal('obs_'+item.id) };
    });
    var verificacionBasica = (proto.verificacionBasica||[]).map(function(item) {
      var checked = document.querySelector('input[name="vb_'+item.id+'"]:checked');
      return { item: item.item, cumple: checked ? checked.value : '—', observaciones: getVal('vbobs_'+item.id) };
    });
    var pruebas = proto.pruebasFuncionales.map(function(pf) {
      var checked = document.querySelector('input[name="pf_'+pf.id+'"]:checked');
      return { prueba:pf.prueba, valorEsperado:pf.valorEsperado, valorMedido:getVal('medido_'+pf.id), resultado: checked?checked.value:'—', observaciones:getVal('pfobs_'+pf.id) };
    });
    var estadoFinalRadio = document.querySelector('input[name="estado_final"]:checked');
    var acciones = [];
    document.querySelectorAll('input[name="acciones_realizadas"]:checked').forEach(function(cb) { acciones.push(cb.value); });
    return {
      equipoId:opt.value, equipo:opt.dataset.equipo||'', placa:opt.dataset.placa||'',
      marca:opt.dataset.marca||'', modelo:opt.dataset.modelo||'', serie:opt.dataset.serie||'',
      servicio:opt.dataset.servicio||'', riesgo:opt.dataset.riesgo||'',
      fecha:getVal('mfFechaEjecucion'), tecnico:getVal('mfTecnico'),
      frecuencia:getVal('mfFrecuencia'), duracion:getTimerDuration(),
      condicionesOk: document.getElementById('mfCondicionesOk') ? document.getElementById('mfCondicionesOk').checked : false,
      inspeccion:inspeccion,
      verificacionBasica:verificacionBasica,
      equipoVerificacion:getVal('mfEquipoVerificacion'), marcaPatron:getVal('mfMarcaPatron'),
      seriePatron:getVal('mfSeriePatron'), certificadoVigente:getVal('mfCertificadoVigente'),
      tolerancia:getVal('mfTolerancia'), pruebas:pruebas,
      estadoFinal: estadoFinalRadio?estadoFinalRadio.value:'—', acciones:acciones,
      observaciones:getVal('mfObservaciones'), recomendaciones:getVal('mfRecomendaciones'),
      firmaEjecuto:getSignatureDataURL('sigPadEjecuto'), nombreEjecuto:getVal('mfNombreEjecuto'),
      cargoEjecuto:getVal('mfCargoEjecuto'), firmaRecibio:getSignatureDataURL('sigPadRecibio'),
      nombreRecibio:getVal('mfNombreRecibio'), cargoRecibio:getVal('mfCargoRecibio'),
      fotoInicio: (mtState.photos && mtState.photos['inicio']) || '',
      fotoMitad: (mtState.photos && mtState.photos['mitad']) || '',
      fotoFinal: (mtState.photos && mtState.photos['final']) || '',
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // GENERAR HTML/PDF PROTOCOLO PREVENTIVO
  // ══════════════════════════════════════════════════════════════════════
  function buildProtocolPDFHTML(d, proto) {
    var color = '#1565c0';
    var colorDark = '#0d47a1';
    var codigo = proto.codigo+'-'+d.fecha+'-'+(d.equipo||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,8).toUpperCase();

    var inspeccionRows = d.inspeccion.map(function(item, i) {
      var bgCumple = item.cumple === 'Si' ? '#e8f5e9' : item.cumple === 'No' ? '#ffebee' : '#f5f5f5';
      var txtColor = item.cumple === 'Si' ? '#2e7d32' : item.cumple === 'No' ? '#c62828' : '#757575';
      var rowBg = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
      return '<tr style="background:'+rowBg+'"><td style="text-align:center;font-weight:700;width:40px;font-size:11px;color:#455a64">'+(i+1)+'</td><td style="font-size:10.5px;padding:6px 10px;color:#263238">'+esc(item.item)+'</td><td style="text-align:center;background:'+bgCumple+';font-weight:700;font-size:11px;color:'+txtColor+';-webkit-print-color-adjust:exact;print-color-adjust:exact">'+esc(item.cumple)+'</td><td style="font-size:10px;color:#607d8b;padding:6px 10px">'+esc(item.observaciones)+'</td></tr>';
    }).join('');

    var pruebasRows = d.pruebas.map(function(pf, i) {
      var bgRes = (pf.resultado==='Pasa'||pf.resultado==='Aplica') ? '#e8f5e9' : pf.resultado==='Falla' ? '#ffebee' : '#f5f5f5';
      var txtColor = (pf.resultado==='Pasa'||pf.resultado==='Aplica') ? '#2e7d32' : pf.resultado==='Falla' ? '#c62828' : '#757575';
      var rowBg = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
      return '<tr style="background:'+rowBg+'"><td style="text-align:center;font-weight:700;width:40px;font-size:11px;color:#455a64">'+(i+1)+'</td><td style="font-size:10.5px;padding:6px 10px;color:#263238">'+esc(pf.prueba)+'</td><td style="font-size:10px;text-align:center;color:#546e7a;padding:6px 8px">'+esc(pf.valorEsperado)+'</td><td style="font-size:11px;text-align:center;font-weight:700;color:#212121">'+esc(pf.valorMedido)+'</td><td style="text-align:center;background:'+bgRes+';font-weight:700;font-size:11px;color:'+txtColor+';-webkit-print-color-adjust:exact;print-color-adjust:exact">'+esc(pf.resultado)+'</td><td style="font-size:9.5px;color:#607d8b;padding:6px 8px">'+esc(pf.observaciones)+'</td></tr>';
    }).join('');

    var estadoColor = d.estadoFinal==='Apto para uso'?'#2e7d32':d.estadoFinal==='Apto con observaciones'?'#f57f17':'#c62828';

    var condPrevias = proto.condicionesPrevias.map(function(c){ return '<li style="margin-bottom:3px;line-height:1.4">'+esc(c)+'</li>'; }).join('');

    var css = '*{box-sizing:border-box;margin:0;padding:0}'
      + 'body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;font-size:10.5px;color:#212121;padding:16px 20px;background:white;line-height:1.35}'
      + '.hdr{display:flex;justify-content:space-between;align-items:stretch;border:2.5px solid '+color+';border-radius:6px;overflow:hidden;margin-bottom:12px}'
      + '.hdr-left{padding:10px 14px;background:white;min-width:210px}'
      + '.hdr-hosp{font-weight:800;font-size:12.5px;color:#1a237e;text-transform:uppercase;letter-spacing:.2px}'
      + '.hdr-dept{font-size:10px;font-weight:600;color:#37474f;margin-top:3px}'
      + '.hdr-addr{font-size:9px;color:#78909c;margin-top:2px}'
      + '.hdr-center{text-align:center;flex:1;padding:10px 14px;background:linear-gradient(180deg,#e8eaf6 0%,#e3f2fd 100%);border-left:2.5px solid '+color+';border-right:2.5px solid '+color+';-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.hdr-title{font-weight:800;font-size:13px;color:'+color+';text-transform:uppercase;letter-spacing:.4px;line-height:1.3}'
      + '.hdr-sub{font-weight:700;font-size:11px;color:#263238;margin-top:4px}'
      + '.hdr-code{font-weight:600;font-size:9px;color:#607d8b;margin-top:3px;letter-spacing:.2px}'
      + '.hdr-right{text-align:right;font-size:9.5px;color:#455a64;white-space:nowrap;padding:10px 14px;background:white;min-width:130px}'
      + '.hdr-right div{margin-bottom:2px}'
      + '.sec{color:white;font-weight:700;padding:6px 12px;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;border-radius:4px;margin:10px 0 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;display:flex;align-items:center;gap:6px}'
      + '.sec-blue{background:'+color+'}'
      + '.sec-dark{background:#37474f}'
      + '.sec-icon{font-size:13px;line-height:1}'
      + '.tbl{width:100%;border-collapse:collapse;font-size:10.5px;margin-top:0;border:1px solid #cfd8dc;border-radius:4px;overflow:hidden}'
      + '.tbl td,.tbl th{border:1px solid #cfd8dc;padding:5px 10px;vertical-align:middle}'
      + '.tbl th{background:#eceff1;font-weight:700;font-size:9.5px;text-transform:uppercase;color:#37474f;letter-spacing:.3px;padding:7px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.lb{background:#eceff1;font-weight:700;font-size:9.5px;color:#37474f;text-transform:uppercase;width:26%;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact;letter-spacing:.2px}'
      + '.vl{font-size:10.5px;color:#212121}'
      + '.cond-box{background:#fffde7;border:1.5px solid #ffe082;border-radius:6px;padding:10px 14px;margin:6px 0;font-size:10px;color:#5d4037}'
      + '.cond-box ul{margin:0;padding-left:16px}'
      + '.cond-check{margin-top:6px;font-weight:700;font-size:10.5px;padding:4px 0}'
      + '.foto-wrap{margin:8px 0;text-align:center}'
      + '.foto-label{font-size:9.5px;font-weight:700;color:#37474f;margin-bottom:5px;text-transform:uppercase;letter-spacing:.3px}'
      + '.foto-frame{display:inline-block;border:2px solid #cfd8dc;border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:90%}'
      + '.foto-frame img{display:block;max-width:100%;max-height:200px}'
      + '.firmas{display:flex;gap:24px;margin-top:16px;padding-top:12px;border-top:2px solid #e0e0e0}'
      + '.firma{flex:1;text-align:center;font-size:9.5px;color:#607d8b}'
      + '.firma-sig{min-height:50px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:4px;border-bottom:2px solid #37474f;padding-bottom:4px}'
      + '.firma-sig img{max-height:55px}'
      + '.firma-role{font-size:9px;color:#78909c;margin-top:2px}'
      + '.firma-name{font-weight:700;color:#212121;margin-top:2px;font-size:11px}'
      + '.firma-cargo{font-size:9.5px;color:#546e7a}'
      + '.estado-badge{display:inline-block;padding:4px 16px;border-radius:14px;font-weight:700;font-size:11px;color:white;letter-spacing:.3px;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.nota{background:#f5f5f5;border:1.5px solid #e0e0e0;border-radius:6px;padding:8px 14px;font-size:9.5px;color:#607d8b;margin-top:12px;line-height:1.4}'
      + '.nota strong{color:#455a64}'
      + '.footer{margin-top:10px;font-size:8.5px;color:#9e9e9e;border-top:1.5px solid #e0e0e0;padding-top:6px;text-align:center;letter-spacing:.2px}'
      + '.btn-print{display:block;margin:16px auto 6px;padding:10px 36px;background:'+color+';color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:"Segoe UI",Arial,sans-serif;letter-spacing:.4px;box-shadow:0 2px 8px rgba(21,101,192,0.3)}'
      + '.btn-print:hover{opacity:.85}'
      + '@media print{@page{size:A4 portrait;margin:8mm}body{padding:0}.btn-print{display:none!important}}';

    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>MANTENIMIENTO PREVENTIVO - '+esc(proto.nombre)+'</title><style>'+css+'</style></head><body>'
    + '<div class="hdr"><div class="hdr-left"><div class="hdr-hosp">HOSPITAL SUSANA LÓPEZ DE VALENCIA E.S.E</div><div class="hdr-dept">GESTIÓN DEL AMBIENTE Y LA TECNOLOGÍA</div><div class="hdr-addr">Calle 15 N°17A-196 Tel. 8217190</div></div><div class="hdr-center"><div class="hdr-title">FORMATO DE MANTENIMIENTO PREVENTIVO Y VERIFICACIÓN FUNCIONAL</div><div class="hdr-sub">'+esc(proto.nombre)+'</div><div class="hdr-code">Código: '+esc(codigo)+'</div></div><div class="hdr-right"><div>Fecha: '+fmt(d.fecha)+'</div><div>Hora: '+localTimeStr()+'</div><div>Duración: '+esc(d.duracion)+'</div><div>Página 1 de 1</div></div></div>'
    + '<div class="sec sec-blue"><span class="sec-icon">🏥</span> DATOS DEL EQUIPO</div><table class="tbl"><tr><td class="lb">Fecha</td><td class="vl">'+fmt(d.fecha)+'</td><td class="lb">Servicio / Área</td><td class="vl">'+esc(d.servicio)+'</td></tr><tr><td class="lb">Marca</td><td class="vl">'+esc(d.marca)+'</td><td class="lb">Modelo</td><td class="vl">'+esc(d.modelo)+'</td></tr><tr><td class="lb">No. Inventario</td><td class="vl">'+esc(d.placa)+'</td><td class="lb">No. Serie</td><td class="vl">'+esc(d.serie)+'</td></tr><tr><td class="lb">Ubicación</td><td class="vl">'+esc(d.servicio)+'</td><td class="lb">Frecuencia</td><td class="vl">'+esc(d.frecuencia)+'</td></tr><tr><td class="lb">Responsable</td><td class="vl">'+esc(d.tecnico)+'</td><td class="lb">Clasificación Riesgo</td><td class="vl">'+esc(d.riesgo)+'</td></tr></table>'
    + '<div class="sec sec-dark"><span class="sec-icon">⚠️</span> CONDICIONES PREVIAS Y SEGURIDAD</div><div class="cond-box"><ul>'+condPrevias+'</ul><div class="cond-check" style="color:'+(d.condicionesOk?'#2e7d32':'#c62828')+'">'+(d.condicionesOk?'✅ Condiciones verificadas y cumplidas':'⚠️ Condiciones no verificadas')+'</div></div>'
    + '<div class="sec sec-blue"><span class="sec-icon">🔍</span> INSPECCIÓN VISUAL Y LIMPIEZA</div>'
    + (d.fotoInicio ? '<div class="foto-wrap"><div class="foto-label">📸 Foto inicial del equipo</div><div class="foto-frame"><img src="'+d.fotoInicio+'" alt="Foto inicial"></div></div>' : '')
    + '<table class="tbl"><tr><th style="width:40px">NO.</th><th>ÍTEM A VERIFICAR</th><th style="width:70px">CUMPLE</th><th style="width:160px">OBSERVACIONES</th></tr>'+inspeccionRows+'</table>'
    + (proto.codigo === 'SLV-GAT-BIO-LR' ? '' : '<div class="sec sec-blue"><span class="sec-icon">📐</span> EQUIPO DE VERIFICACIÓN UTILIZADO</div><table class="tbl"><tr><td class="lb">Equipo utilizado</td><td class="vl">'+esc(d.equipoVerificacion)+'</td><td class="lb">Marca / Modelo</td><td class="vl">'+esc(d.marcaPatron)+'</td></tr><tr><td class="lb">No. Serie patrón</td><td class="vl">'+esc(d.seriePatron)+'</td><td class="lb">Certificado hasta</td><td class="vl">'+fmt(d.certificadoVigente)+'</td></tr><tr><td class="lb">Tolerancia</td><td class="vl" colspan="3">'+esc(d.tolerancia)+'</td></tr></table>')
    + (d.verificacionBasica && d.verificacionBasica.length ? (function() {
      var vbRows = d.verificacionBasica.map(function(item, i) {
        var bgCumple = item.cumple === 'Si' ? '#e8f5e9' : item.cumple === 'No' ? '#ffebee' : '#f5f5f5';
        var txtColor = item.cumple === 'Si' ? '#2e7d32' : item.cumple === 'No' ? '#c62828' : '#757575';
        var rowBg = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
        return '<tr style="background:'+rowBg+'"><td style="text-align:center;font-weight:700;width:40px;font-size:11px;color:#455a64">'+(i+1)+'</td><td style="font-size:10.5px;padding:6px 10px;color:#263238">'+esc(item.item)+'</td><td style="text-align:center;background:'+bgCumple+';font-weight:700;font-size:11px;color:'+txtColor+';-webkit-print-color-adjust:exact;print-color-adjust:exact">'+esc(item.cumple)+'</td><td style="font-size:10px;color:#607d8b;padding:6px 10px">'+esc(item.observaciones)+'</td></tr>';
      }).join('');
      return '<div class="sec sec-blue"><span class="sec-icon">🖥️</span> VERIFICACIÓN FUNCIONAL BÁSICA</div><table class="tbl"><tr><th style="width:40px">NO.</th><th>ACTIVIDAD / CRITERIO</th><th style="width:70px">CUMPLE</th><th style="width:160px">OBSERVACIONES</th></tr>'+vbRows+'</table>';
    }()) : '')
    + '<div class="sec sec-blue"><span class="sec-icon">⚡</span> PRUEBAS FUNCIONALES</div>'
    + (d.fotoMitad ? '<div class="foto-wrap"><div class="foto-label">📸 Foto durante el procedimiento</div><div class="foto-frame"><img src="'+d.fotoMitad+'" alt="Foto procedimiento"></div></div>' : '')
    + '<table class="tbl"><tr><th style="width:40px">NO.</th><th>PRUEBA</th><th style="width:100px">VALOR ESPERADO</th><th style="width:80px">MEDIDO</th><th style="width:70px">RESULT.</th><th style="width:120px">OBS.</th></tr>'+pruebasRows+'</table>'
    + '<div class="sec sec-dark"><span class="sec-icon">📋</span> RESULTADO FINAL DEL MANTENIMIENTO</div><table class="tbl"><tr><td class="lb">Estado final</td><td class="vl"><span class="estado-badge" style="background:'+estadoColor+'">'+esc(d.estadoFinal)+'</span></td></tr><tr><td class="lb">Acciones realizadas</td><td class="vl">'+(d.acciones.length?d.acciones.map(function(a){return esc(a)}).join(' · '):'—')+'</td></tr><tr><td class="lb">Observaciones técnicas</td><td class="vl">'+esc(d.observaciones)+'</td></tr><tr><td class="lb">Recomendaciones</td><td class="vl">'+esc(d.recomendaciones)+'</td></tr><tr><td class="lb">Duración total del mantenimiento</td><td class="vl" style="font-weight:700;font-size:12px;color:'+color+'">⏱️ '+esc(d.duracion)+'</td></tr></table>'
    + (d.fotoFinal ? '<div class="foto-wrap"><div class="foto-label">📸 Foto final del equipo</div><div class="foto-frame"><img src="'+d.fotoFinal+'" alt="Foto final"></div></div>' : '')
    + '<div class="firmas"><div class="firma"><div class="firma-sig">'+(d.firmaEjecuto?'<img src="'+d.firmaEjecuto+'" alt="Firma">':'')+'</div><div class="firma-role">Elaboró / Ejecutó</div><div class="firma-name">'+esc(d.nombreEjecuto)+'</div><div class="firma-cargo">'+esc(d.cargoEjecuto)+'</div></div><div class="firma"><div class="firma-sig">'+(d.firmaRecibio?'<img src="'+d.firmaRecibio+'" alt="Firma">':'')+'</div><div class="firma-role">Recibió / Verificó</div><div class="firma-name">'+esc(d.nombreRecibio)+'</div><div class="firma-cargo">'+esc(d.cargoRecibio)+'</div></div></div>'
    + '<div class="nota"><strong>Nota técnica:</strong> Este formato está diseñado para mantenimiento preventivo rutinario y verificación funcional externa. No autoriza apertura, ajuste interno o reparación del regulador. Cualquier desviación debe documentarse y remitirse a soporte técnico autorizado.</div>'
    + '<button id="btnPrint" class="btn-print">🖨️ Imprimir Reporte</button>'
    + '<div class="footer">HSLV · Sistema de Gestión de la Tecnología · '+esc(proto.codigo)+' · '+esc(codigo)+' · Generado: '+new Date().toLocaleString('es-CO')+'</div>'
    + '<script>document.getElementById("btnPrint").addEventListener("click",function(){window.print();});<\/script>'
    + '</body></html>';
  }

  // ══════════════════════════════════════════════════════════════════════
  // REPORTE CORRECTIVO
  // ══════════════════════════════════════════════════════════════════════
  function buildCorrectiveReportHTML(d) {
    var color = '#b71c1c';
    var colorLight = '#ffebee';
    var codigo = 'CORR-'+d.fecha+'-'+(d.equipo||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,8).toUpperCase();
    var row = function(l,v) { return v ? '<tr><td class="lb">'+l+'</td><td class="vl">'+esc(String(v))+'</td></tr>' : ''; };
    var sec = function(t,rows) { return '<div class="sec"><span class="sec-icon">'+t.split(' ')[0]+'</span> '+t.split(' ').slice(1).join(' ')+'</div><table class="tbl">'+rows+'</table>'; };

    var css = '*{box-sizing:border-box;margin:0;padding:0}'
      + 'body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;font-size:11px;color:#212121;padding:16px 20px;background:white;line-height:1.35}'
      + '.hdr{display:flex;justify-content:space-between;align-items:stretch;border:2.5px solid '+color+';border-radius:6px;overflow:hidden;margin-bottom:12px}'
      + '.hdr-left{padding:10px 14px;background:white;min-width:210px}'
      + '.hdr-hosp{font-weight:800;font-size:12.5px;color:#1a237e;text-transform:uppercase;letter-spacing:.2px}'
      + '.hdr-dept{font-size:10px;font-weight:600;color:#37474f;margin-top:3px}'
      + '.hdr-addr{font-size:9px;color:#78909c;margin-top:2px}'
      + '.hdr-center{text-align:center;flex:1;padding:10px 14px;background:linear-gradient(180deg,#ffebee 0%,#fce4ec 100%);border-left:2.5px solid '+color+';border-right:2.5px solid '+color+';-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.hdr-title{font-weight:800;font-size:13px;color:'+color+';text-transform:uppercase;letter-spacing:.4px;line-height:1.3}'
      + '.hdr-code{font-weight:700;font-size:10px;color:#263238;margin-top:4px}'
      + '.hdr-right{text-align:right;font-size:9.5px;color:#455a64;white-space:nowrap;padding:10px 14px;background:white;min-width:130px}'
      + '.hdr-right div{margin-bottom:2px}'
      + '.sec{background:'+color+';color:white;font-weight:700;padding:6px 12px;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;border-radius:4px;margin:10px 0 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;display:flex;align-items:center;gap:6px}'
      + '.sec-icon{font-size:13px;line-height:1}'
      + '.tbl{width:100%;border-collapse:collapse;font-size:11px;margin-top:0;border:1px solid #cfd8dc}'
      + '.tbl td{border:1px solid #cfd8dc;padding:5px 10px;vertical-align:middle}'
      + '.lb{background:#eceff1;font-weight:700;font-size:9.5px;color:#37474f;text-transform:uppercase;width:30%;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact;letter-spacing:.2px}'
      + '.vl{font-size:11px;color:#212121;min-height:18px}'
      + '.firmas{display:flex;gap:24px;margin-top:20px;padding-top:12px;border-top:2px solid #e0e0e0}'
      + '.firma{flex:1;text-align:center;font-size:10px;color:#607d8b}'
      + '.firma-line{border-bottom:2px solid #37474f;height:40px;margin-bottom:4px}'
      + '.firma-name{font-weight:700;color:#212121;margin-top:2px;font-size:11px}'
      + '.footer{margin-top:12px;font-size:8.5px;color:#9e9e9e;border-top:1.5px solid #e0e0e0;padding-top:6px;text-align:center;letter-spacing:.2px}'
      + '.btn-print{display:block;margin:16px auto 6px;padding:10px 36px;background:'+color+';color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:"Segoe UI",Arial,sans-serif;letter-spacing:.4px;box-shadow:0 2px 8px rgba(183,28,28,0.3)}'
      + '.btn-print:hover{opacity:.85}'
      + '@media print{@page{size:A4 portrait;margin:10mm}body{padding:0}.btn-print{display:none!important}}';

    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>REPORTE DE MANTENIMIENTO CORRECTIVO</title><style>'+css+'</style></head><body>'
    + '<div class="hdr"><div class="hdr-left"><div class="hdr-hosp">HOSPITAL SUSANA LÓPEZ DE VALENCIA E.S.E</div><div class="hdr-dept">GESTIÓN DEL AMBIENTE Y LA TECNOLOGÍA</div><div class="hdr-addr">Calle 15 N°17A-196 Tel. 8217190</div></div><div class="hdr-center"><div class="hdr-title">🔧 REPORTE DE MANTENIMIENTO CORRECTIVO</div><div class="hdr-code">Código: '+esc(codigo)+'</div></div><div class="hdr-right"><div>Fecha: '+fmt(d.fecha)+'</div><div>Hora: '+localTimeStr()+'</div><div>Página 1 de 1</div></div></div>'
    + sec('🏥 DATOS DEL EQUIPO', row('Nombre del Equipo',d.equipo)+row('Placa / Inventario',d.placa)+row('Marca',d.marca)+row('Modelo',d.modelo)+row('Serie',d.serie)+row('Servicio / Ubicación',d.servicio)+row('Clasificación de Riesgo',d.riesgo))
    + sec('📅 DATOS DE EJECUCIÓN', row('Fecha de Ejecución',fmt(d.fecha))+row('Técnico Responsable',d.tecnico)+row('Duración',d.duracion?d.duracion+' horas':'')+row('Costo',d.costo?'$ '+Number(d.costo).toLocaleString('es-CO'):'')+row('Estado',d.estado))
    + sec('🔧 ANÁLISIS CORRECTIVO', row('Falla Reportada',d.fallaReportada)+row('Diagnóstico Técnico',d.diagnostico)+row('Acción Tomada',d.accionTomada)+row('Causa Raíz',d.causaRaiz)+row('Repuestos Cambiados',d.repuestos)+row('Hallazgos',d.hallazgos))
    + sec('📝 OBSERVACIONES', row('Observaciones y Recomendaciones',d.observaciones))
    + (d.fotoInicio||d.fotoMitad||d.fotoFinal ? '<div class="sec"><span class="sec-icon">📸</span> REGISTRO FOTOGRÁFICO</div><div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px">'
      + (d.fotoInicio ? '<div style="flex:1;min-width:180px"><div style="font-size:9px;font-weight:700;color:#455a64;text-transform:uppercase;margin-bottom:4px">1️⃣ Foto Inicial</div><img src="'+d.fotoInicio+'" style="width:100%;border-radius:6px;border:1px solid #cfd8dc;max-height:160px;object-fit:contain"></div>' : '')
      + (d.fotoMitad  ? '<div style="flex:1;min-width:180px"><div style="font-size:9px;font-weight:700;color:#455a64;text-transform:uppercase;margin-bottom:4px">2️⃣ Durante la Intervención</div><img src="'+d.fotoMitad+'" style="width:100%;border-radius:6px;border:1px solid #cfd8dc;max-height:160px;object-fit:contain"></div>' : '')
      + (d.fotoFinal  ? '<div style="flex:1;min-width:180px"><div style="font-size:9px;font-weight:700;color:#455a64;text-transform:uppercase;margin-bottom:4px">3️⃣ Foto Final</div><img src="'+d.fotoFinal+'" style="width:100%;border-radius:6px;border:1px solid #cfd8dc;max-height:160px;object-fit:contain"></div>' : '')
      + '</div>' : '')
    + '<div class="firmas">'
    + '<div class="firma">'+(d.firmaEjecuto&&d.firmaEjecuto!=='data:,'?'<img src="'+d.firmaEjecuto+'" style="height:50px;max-width:180px;object-fit:contain">':'<div class="firma-line"></div>')+'<br>Elaboró / Ejecutó<div class="firma-name">'+esc(d.nombreEjecuto||d.tecnico)+'</div><div style="font-size:9px;color:#78909c">'+esc(d.cargoEjecuto||'')+'</div></div>'
    + '<div class="firma">'+(d.firmaRecibio&&d.firmaRecibio!=='data:,'?'<img src="'+d.firmaRecibio+'" style="height:50px;max-width:180px;object-fit:contain">':'<div class="firma-line"></div>')+'<br>Recibió / Verificó<div class="firma-name">'+esc(d.nombreRecibio||'')+'</div><div style="font-size:9px;color:#78909c">'+esc(d.cargoRecibio||'')+'</div></div>'
    + '</div>'
    + '<button id="btnPrint" class="btn-print">🖨️ Imprimir Reporte</button>'
    + '<div class="footer">HSLV · Sistema de Gestión de la Tecnología · SLV-GAT-MANT-CORR · '+esc(codigo)+' · Generado: '+new Date().toLocaleString('es-CO')+'</div>'
    + '<script>document.getElementById("btnPrint").addEventListener("click",function(){window.print();});<\/script>'
    + '</body></html>';
  }

  // ── TOAST ──────────────────────────────────────────────────────────────
  function showMtToast(msg, type) {
    var t = document.getElementById('mtToast');
    if (!t) { t = document.createElement('div'); t.id = 'mtToast'; document.body.appendChild(t); }
    var bg = type==='ok'?'#2e7d32':type==='warn'?'#f57f17':'#c62828';
    t.style.cssText = 'position:fixed;bottom:32px;right:32px;background:'+bg+';color:white;padding:14px 22px;border-radius:10px;font-size:14px;font-weight:600;font-family:Outfit,sans-serif;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,0.2);transition:opacity 0.4s;opacity:1;max-width:400px';
    t.textContent = msg;
    clearTimeout(t._to);
    t._to = setTimeout(function() { t.style.opacity = '0'; }, 4000);
  }

  window.loadMantenimientosModule = loadMantenimientosModule;
})();
