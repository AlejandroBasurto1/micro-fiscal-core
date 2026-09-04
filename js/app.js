import { storageAdapter } from './storage.js';
import { activityOperations, dynamicRules, fiscalConfig } from './config.js';
import { bindCalculator } from './calculator.js';
import { initOperations, collectOperationData, loadOperationData, resetOperationData } from './operations.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const fields = ['actividadSelect','operacionSelect','clienteNombre','clienteTelefono','clienteDireccion','metodoPago','lineasPedido','distanciaPedido','bancoActivo','titularCuenta','clabeCuenta','tipoEntrega'];
const state = { activeModule: 'Actividad', currentEditingId: null, total: 0, dirty: false };
const money = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});

function setStatus(message, type='yellow') {
  $('#quickStatus').textContent = message;
  $$('.luz').forEach(light => light.classList.toggle('active', light.dataset.light === type));
}

function toast(message) {
  const node=document.createElement('div');
  node.className='toast';
  node.setAttribute('role','status');
  node.textContent=message;
  document.body.append(node);
  setTimeout(()=>node.remove(),3200);
}

function value(id) { return document.getElementById(id)?.value?.trim?.() || ''; }
function setValue(id, data='') { const element=document.getElementById(id); if(element) element.value=data ?? ''; }

function updateResults(total=state.total) {
  state.total = Number(total) || 0;
  const iva = state.total > 0 ? state.total - (state.total / (1 + fiscalConfig.ivaRate)) : 0;
  $('#resultTotal').textContent=money.format(state.total);
  $('#resultIVA').textContent=money.format(iva);
  $('#resultISR').textContent=money.format(0);
  $('#resultProfit').textContent=money.format(state.total-iva);
}

function updateClock() {
  const now=new Date();
  $('#horaActual').textContent=now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false});
  $('#fechaActual').textContent=now.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'}).replaceAll('/','-');
}
updateClock();
setInterval(updateClock,1000);

function populateOperations(selected='') {
  const select=$('#operacionSelect');
  select.replaceChildren(new Option('Selecciona operación',''));
  (activityOperations[value('actividadSelect')] || []).forEach(operation => select.add(new Option(operation,operation)));
  select.value=selected;
}

function updateDynamicFields() {
  const visible = dynamicRules[value('operacionSelect')] || dynamicRules.default;
  $$('[data-field]').forEach(wrapper => {
    const show=visible.includes(wrapper.dataset.field);
    wrapper.classList.toggle('dynamic-hidden',!show);
    wrapper.querySelector('input,select')?.toggleAttribute('disabled',!show);
  });
}

function collectRecord() {
  const now=new Date();
  const total=calculator.value();
  const iva=total>0?total-(total/(1+fiscalConfig.ivaRate)):0;
  return {
    schemaVersion:2,
    fechaISO:now.toISOString(),
    fechaLegible:now.toLocaleDateString('es-MX'),
    hora:now.toLocaleTimeString('es-MX'),
    actividad:value('actividadSelect'),
    operacion:value('operacionSelect'),
    cliente:value('clienteNombre'),
    telefono:value('clienteTelefono'),
    direccion:value('clienteDireccion'),
    metodoPago:value('metodoPago'),
    lineasPedido:Number(value('lineasPedido'))||0,
    distancia:Number(value('distanciaPedido'))||0,
    banco:value('bancoActivo'),
    titularCuenta:value('titularCuenta'),
    clabeCuenta:value('clabeCuenta'),
    tipoEntrega:value('tipoEntrega'),
    resultadoCalculadora:total,
    subtotal:total-iva,
    iva,
    isr:0,
    gananciaReal:total-iva,
    moduloActivo:state.activeModule,
    fechaCreacion:now.toISOString(),
    fechaModificacion:now.toISOString(),
    ...collectOperationData()
  };
}

function validRecord(record) {
  return Boolean(record.numeroOperacion && record.actividad && record.operacion && (record.nombreActivo || record.resultadoCalculadora>0 || record.cliente || record.banco));
}

async function saveRecord() {
  const data=collectRecord();
  if(!validRecord(data)) {
    setStatus('Faltan actividad, operación y un resultado o dato suficiente para guardar.','yellow');
    toast('Completa la información mínima.');
    return null;
  }

  try {
    let saved;
    if(state.currentEditingId) {
      const old=storageAdapter.find(state.currentEditingId);
      if(!old) {
        state.currentEditingId=null;
        $('#mainSection').classList.remove('editing');
        setStatus('El registro que estabas editando ya no existe. Guarda nuevamente como registro nuevo.','red');
        toast('No se encontró el registro original.');
        return null;
      }
      data.historialCambios=[...(old.historialCambios||[]),{date:new Date().toISOString(),action:`Expediente actualizado por ${data.usuarioResponsable||'usuario local'}.`}];
      saved=storageAdapter.update(state.currentEditingId,{...data,fechaCreacion:old.fechaCreacion||data.fechaCreacion});
      state.currentEditingId=null;
      $('#mainSection').classList.remove('editing');
    } else {
      data.historialCambios=[{date:new Date().toISOString(),action:`Expediente creado por ${data.usuarioResponsable||'usuario local'}.`}];
      saved=storageAdapter.create(data);
    }

    if(!saved) throw new Error('El adaptador no devolvió el registro guardado.');
    state.dirty=false;
    const hasLocation=Number.isFinite(saved.ubicacion?.latitud) && Number.isFinite(saved.ubicacion?.longitud);
    setStatus(`Registro ${saved.id.slice(0,8)} guardado${hasLocation?' con ubicación':' sin ubicación'}.`,'green');
    updateResults(data.resultadoCalculadora);
    renderHistory();
    toast('Registro guardado correctamente.');
    return saved;
  } catch(error) {
    console.error(error);
    setStatus(error?.code==='MRFC_STORAGE_WRITE_FAILED' ? error.message : 'No fue posible guardar el registro. Tus datos permanecen en pantalla.','red');
    toast('Error al guardar. No se borraron los datos del formulario.');
    return null;
  }
}

async function loadRecord(id, editing=false) {
  const record=storageAdapter.find(id);
  if(!record) {
    setStatus('El registro solicitado no existe.','red');
    renderHistory();
    return;
  }
  setValue('actividadSelect',record.actividad);
  populateOperations(record.operacion);
  fields.slice(2).forEach(id=>{
    const map={clienteNombre:'cliente',clienteTelefono:'telefono',clienteDireccion:'direccion',lineasPedido:'lineasPedido',distanciaPedido:'distancia',bancoActivo:'banco'};
    setValue(id,record[map[id]||id]);
  });
  state.total=Number(record.resultadoCalculadora)||0;
  $('#calcDisplay').value=state.total||'';
  updateResults();
  updateDynamicFields();
  await loadOperationData(record);
  state.dirty=false;
  if(editing) {
    state.currentEditingId=id;
    $('#mainSection').classList.add('editing');
    setStatus(`Editando registro ${id.slice(0,8)}. Guarda para actualizar.`,'yellow');
  } else {
    state.currentEditingId=null;
    $('#mainSection').classList.remove('editing');
    setStatus(`Registro ${id.slice(0,8)} cargado.`,'yellow');
  }
  window.scrollTo({top:$('#mainSection').offsetTop-12,behavior:'smooth'});
}

function clearForm(force=false) {
  const hasData=state.dirty || fields.some(id=>value(id));
  if(!force&&hasData&&!confirm('Hay datos sin guardar. ¿Deseas limpiar el formulario?')) return;
  fields.forEach(id=>setValue(id,''));
  populateOperations();
  calculator.clear();
  updateResults(0);
  resetOperationData();
  state.currentEditingId=null;
  state.dirty=false;
  $('#mainSection').classList.remove('editing');
  $$('[data-field]').forEach(node=>{
    node.classList.remove('dynamic-hidden');
    node.querySelector('input,select')?.removeAttribute('disabled');
  });
  setStatus('Formulario limpio. Historial conservado.','red');
}

function fillFilter(select,label,items,current) {
  select.replaceChildren(new Option(label,''));
  items.forEach(item=>select.add(new Option(item,item)));
  select.value=current;
}

function renderHistory() {
  const container=$('#historialContenido');
  const query=value('historySearch').toLowerCase();
  const activity=value('historyActivity');
  const operation=value('historyOperation');
  const allRecords=storageAdapter.list().sort((a,b)=>new Date(b.fechaCreacion)-new Date(a.fechaCreacion));
  const activities=[...new Set(allRecords.map(r=>r.actividad).filter(Boolean))];
  const operations=[...new Set(allRecords.map(r=>r.operacion).filter(Boolean))];
  fillFilter($('#historyActivity'),'Todas las actividades',activities,activity);
  fillFilter($('#historyOperation'),'Todas las operaciones',operations,operation);

  const records=allRecords.filter(r=>(!activity||r.actividad===activity)&&(!operation||r.operacion===operation)&&(!query||[r.cliente,r.actividad,r.operacion,r.id,r.numeroOperacion,r.identificadorActivo,r.numeroSerie,r.usuarioResponsable,r.codigoBarras,r.ubicacion?.direccion].some(v=>String(v||'').toLowerCase().includes(query))));
  container.replaceChildren();
  if(!records.length) {
    const p=document.createElement('p');
    p.textContent='No existen registros para los filtros seleccionados.';
    container.append(p);
    return;
  }

  records.forEach(record=>{
    const article=document.createElement('article');
    article.className='history-item';
    const info=document.createElement('div');
    const title=document.createElement('h3');
    title.textContent=`${record.actividad} · ${record.operacion}`;
    const meta=document.createElement('p');
    meta.textContent=`${record.fechaLegible} ${record.hora} · ${record.cliente||'Sin cliente'} · ${money.format(record.resultadoCalculadora||0)}`;
    info.append(title,meta);
    const actions=document.createElement('div');
    actions.className='history-actions';
    [['Cargar','load'],['Editar','edit'],['Eliminar','delete']].forEach(([label,action])=>{
      const button=document.createElement('button');
      button.type='button';
      button.textContent=label;
      button.dataset.action=action;
      button.dataset.id=record.id;
      actions.append(button);
    });
    article.append(info,actions);
    container.append(article);
  });
}

function downloadBlob(content,name,type) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement('a');
  link.href=url;
  link.download=name;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

function fileStamp() {
  const d=new Date(),pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function exportCsv() {
  const records=storageAdapter.list();
  if(!records.length){toast('No hay registros para exportar.');return;}
  const headers=['ID','Fecha','Hora','Actividad','Operación','Cliente','Teléfono','Dirección','Método de pago','Banco','Titular','Cuenta','Distancia','Resultado','IVA','ISR','Ganancia','Latitud','Longitud'];
  const rows=records.map(r=>[r.id,r.fechaLegible,r.hora,r.actividad,r.operacion,r.cliente,r.telefono,r.direccion,r.metodoPago,r.banco,r.titularCuenta,r.clabeCuenta,r.distancia,r.resultadoCalculadora,r.iva,r.isr,r.gananciaReal,r.ubicacion?.latitud??'',r.ubicacion?.longitud??'']);
  const escape=cell=>`"${String(cell??'').replaceAll('"','""').replaceAll('\n',' ')}"`;
  const csv='\ufeff'+[headers,...rows].map(row=>row.map(escape).join(',')).join('\r\n');
  downloadBlob(csv,`MRFC_registros_${fileStamp()}.csv`,'text/csv;charset=utf-8');
  setStatus('Exportación CSV compatible con Excel completada.','green');
}

function exportJsonBackup() {
  const records=storageAdapter.list();
  if(!records.length){toast('No hay registros para respaldar.');return;}
  downloadBlob(storageAdapter.exportBackup(),`MRFC_respaldo_${fileStamp()}.json`,'application/json;charset=utf-8');
  setStatus(`Respaldo JSON generado con ${records.length} registro(s).`,'green');
}

function importJsonBackup(file) {
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const imported=storageAdapter.importBackup(String(reader.result||''));
      renderHistory();
      setStatus(`Respaldo restaurado. MRFC contiene ${imported.length} registro(s).`,'green');
      toast('Respaldo restaurado correctamente.');
    } catch(error) {
      console.error(error);
      setStatus('El archivo seleccionado no es un respaldo MRFC válido.','red');
      toast('No se pudo restaurar el respaldo.');
    }
  };
  reader.onerror=()=>setStatus('No fue posible leer el archivo de respaldo.','red');
  reader.readAsText(file);
}

function installBackupControls() {
  const host=$('.secondary-actions');
  if(!host || $('#backupJsonBtn')) return;
  const backup=document.createElement('button');
  backup.className='tool-btn';
  backup.id='backupJsonBtn';
  backup.type='button';
  backup.textContent='💾 Respaldo JSON';
  backup.addEventListener('click',exportJsonBackup);

  const restore=document.createElement('button');
  restore.className='tool-btn';
  restore.id='restoreJsonBtn';
  restore.type='button';
  restore.textContent='♻️ Restaurar';

  const input=document.createElement('input');
  input.type='file';
  input.accept='application/json,.json';
  input.hidden=true;
  input.id='restoreJsonFile';
  restore.addEventListener('click',()=>input.click());
  input.addEventListener('change',event=>{
    importJsonBackup(event.target.files?.[0]);
    event.target.value='';
  });
  host.append(backup,restore,input);
}

function requestGps() {
  const operationGps=$('#getLocationBtn');
  if(operationGps) {
    operationGps.click();
    return;
  }
  setStatus('GPS del expediente no disponible en esta vista.','yellow');
}

function activateModule(name) {
  state.activeModule=name;
  $$('.card').forEach(card=>{
    const active=card.dataset.module===name;
    card.classList.toggle('active',active);
    card.classList.toggle('inactive',!active);
  });
  const activity=name==='Actividad';
  $('#activityForm').classList.toggle('dynamic-hidden',!activity);
  $('#modulePlaceholder').classList.toggle('dynamic-hidden',activity);
  $('#panelTitle').textContent=activity?'Operación del Día':name;
  if(!activity) {
    $('#modulePlaceholder').textContent=`Módulo ${name} preparado. El núcleo de expedientes permanece disponible en Actividad.`;
    setStatus(`Módulo activo: ${name}.`,'yellow');
  }
}

function scrollToElement(element) {
  if(!element) return;
  element.scrollIntoView({behavior:'smooth',block:'center'});
}

function openQrTools() {
  activateModule('Actividad');
  const panel=$('#qrOutput')?.closest('.code-panel');
  scrollToElement(panel);
  setStatus('Herramientas QR listas. Selecciona los datos y genera el código.','green');
}

function openBarcodeTools() {
  activateModule('Actividad');
  const panel=$('#barcodeOutput')?.closest('.code-panel');
  scrollToElement(panel);
  setStatus('Herramientas de código de barras listas.','green');
}

function openOcrTools() {
  activateModule('Actividad');
  const card=$('[data-photo-slot="1"]');
  scrollToElement(card);
  const input=card?.querySelector('input[type=file]');
  if(input) input.click();
  setStatus('Selecciona la fotografía 1; después usa Analizar para ejecutar OCR.','yellow');
}

function renderQuickSummary() {
  const records=storageAdapter.list();
  const target=$('#modulePlaceholder');
  if(!records.length) {
    target.textContent='No hay registros suficientes para generar la gráfica/resumen.';
    target.classList.remove('dynamic-hidden');
    return;
  }
  const total=records.reduce((sum,r)=>sum+(Number(r.resultadoCalculadora)||0),0);
  const iva=records.reduce((sum,r)=>sum+(Number(r.iva)||0),0);
  const completed=records.filter(r=>r.estadoOperacion==='Completado').length;
  const byActivity=Object.entries(records.reduce((acc,r)=>{const key=r.actividad||'Sin actividad';acc[key]=(acc[key]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]);
  target.replaceChildren();
  const title=document.createElement('strong');
  title.textContent='Resumen operativo MRFC';
  const detail=document.createElement('div');
  detail.textContent=`${records.length} expedientes · ${completed} completados · Total ${money.format(total)} · IVA registrado ${money.format(iva)}`;
  const list=document.createElement('div');
  list.textContent=byActivity.map(([name,count])=>`${name}: ${count}`).join(' · ');
  target.append(title,detail,list);
  target.classList.remove('dynamic-hidden');
  setStatus('Resumen operativo actualizado.','green');
}

function applyLanguage(lang) {
  const english=lang==='en';
  document.documentElement.lang=english?'en':'es';
  $('#languageToggle').textContent=english?'EN':'ES';
  const labels=english
    ? {saveBtn:'💾 Save',editBtn:'✏️ Edit',clearBtn:'🗑️ Clear',exportBtn:'📤 Export CSV',historialBtn:'📊 History',queryTitle:'🔎 Operation files'}
    : {saveBtn:'💾 Guardar',editBtn:'✏️ Editar',clearBtn:'🗑️ Limpiar',exportBtn:'📤 Exportar CSV',historialBtn:'📊 Historial',queryTitle:'🔎 Consulta de expedientes'};
  Object.entries(labels).forEach(([id,text])=>{const node=document.getElementById(id);if(node)node.textContent=text;});
  localStorage.setItem('mrfc-language',document.documentElement.lang);
}

const calculator=bindCalculator({overlay:$('#calcOverlay'),display:$('#calcDisplay'),onSave:async()=>{if(await saveRecord())closeCalculator();},onResult:updateResults,ivaRate:fiscalConfig.ivaRate});
function openCalculator(){$('#calcOverlay').classList.add('active');$('#calcDisplay').focus();}
function closeCalculator(){$('#calcOverlay').classList.remove('active');$('#calcBtn').focus();}

$('#actividadSelect').addEventListener('change',()=>{populateOperations();updateDynamicFields();state.dirty=true;setStatus('Actividad seleccionada. Completa la operación.','yellow');});
$('#operacionSelect').addEventListener('change',()=>{updateDynamicFields();state.dirty=true;setStatus('Operación seleccionada. Datos sin guardar.','yellow');});
$('#mainSection').addEventListener('input',()=>{state.dirty=true;setStatus('Formulario modificado. Datos sin guardar.','yellow');});
$$('.card').forEach(card=>card.addEventListener('click',()=>activateModule(card.dataset.module)));
$('#moduleSearch').addEventListener('input',event=>{const q=event.target.value.trim().toLowerCase();$$('[data-module]').forEach(card=>card.classList.toggle('module-hidden',q&&!card.dataset.module.toLowerCase().includes(q)));$$('.tool-actions .tool-btn').forEach(button=>button.classList.toggle('module-hidden',q&&!button.textContent.toLowerCase().includes(q)));});

$('#themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('light-mode');
  document.documentElement.classList.toggle('theme-light',document.body.classList.contains('light-mode'));
  const light=document.body.classList.contains('light-mode');
  localStorage.setItem('mrfc-theme',light?'light':'dark');
  $('#themeToggle').textContent=light?'☀️':'🌙';
  $('#mrfcLogo').src=light?'assets/assetsmrfc-logo-light.png':'assets/assetsmrfc-logo-dark.png';
});
if(localStorage.getItem('mrfc-theme')==='light') {
  document.body.classList.add('light-mode');
  document.documentElement.classList.add('theme-light');
  $('#themeToggle').textContent='☀️';
  $('#mrfcLogo').src='assets/assetsmrfc-logo-light.png';
}

$('#languageToggle').addEventListener('click',()=>applyLanguage(document.documentElement.lang==='es'?'en':'es'));
applyLanguage(localStorage.getItem('mrfc-language')==='en'?'en':'es');

$('#homeBtn').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
$('#backBtn').addEventListener('click',()=>history.back());
$('#nextBtn').addEventListener('click',()=>history.forward());
$('#calcBtn').addEventListener('click',openCalculator);
$('#closeCalc').addEventListener('click',closeCalculator);
$('#calcOverlay').addEventListener('click',e=>{if(e.target===$('#calcOverlay'))closeCalculator();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('#calcOverlay').classList.contains('active')) closeCalculator();
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s') {e.preventDefault();saveRecord();}
});
window.addEventListener('beforeunload',event=>{if(!state.dirty)return;event.preventDefault();event.returnValue='';});

$('#saveBtn').addEventListener('click',saveRecord);
$('#editBtn').addEventListener('click',()=>{if(state.currentEditingId){setStatus('Ya existe un registro en edición.','yellow');return;}$('#historialPanel').classList.remove('dynamic-hidden');renderHistory();setStatus('Selecciona Editar en el historial.','yellow');});
$('#clearBtn').addEventListener('click',()=>clearForm());
$('#exportBtn').addEventListener('click',exportCsv);
$('#historialBtn').addEventListener('click',()=>{$('#historialPanel').classList.toggle('dynamic-hidden');renderHistory();});
['historySearch','historyActivity','historyOperation'].forEach(id=>document.getElementById(id).addEventListener(id==='historySearch'?'input':'change',renderHistory));
$('#historialContenido').addEventListener('click',event=>{
  const button=event.target.closest('button[data-id]');
  if(!button)return;
  const {id,action}=button.dataset;
  if(action==='load')loadRecord(id);
  if(action==='edit')loadRecord(id,true);
  if(action==='delete'&&confirm('¿Eliminar este registro?')) {
    try {
      storageAdapter.delete(id);
      if(state.currentEditingId===id){state.currentEditingId=null;$('#mainSection').classList.remove('editing');}
      renderHistory();
      setStatus('Registro eliminado.','red');
    } catch(error) {
      console.error(error);
      setStatus('No fue posible eliminar el registro.','red');
    }
  }
});
window.addEventListener('mrfc:open-record',event=>loadRecord(event.detail.id,true));

$('#gpsBtn').addEventListener('click',requestGps);
$('#captureBtn').addEventListener('click',async()=>{if(typeof html2canvas!=='function'){setStatus('La librería de captura no está disponible.','red');return;}try{const canvas=await html2canvas(document.body,{backgroundColor:null,scale:2,ignoreElements:el=>el.classList.contains('calc-overlay')&&!el.classList.contains('active')});const link=document.createElement('a');link.download=`MRFC_${fileStamp()}.png`;link.href=canvas.toDataURL('image/png');link.click();toast('Captura descargada.');}catch(error){console.error(error);setStatus('No fue posible generar la captura.','red');}});

$('#ocrBtn').addEventListener('click',openOcrTools);
$('#qrTopBtn').addEventListener('click',openQrTools);
$('#qrBtn').addEventListener('click',openQrTools);
$('#codeTopBtn').addEventListener('click',openBarcodeTools);
$('#codigoBtn').addEventListener('click',openBarcodeTools);
$('#graficaBtn').addEventListener('click',renderQuickSummary);

initOperations({storageAdapter,setStatus});
installBackupControls();
populateOperations();
updateDynamicFields();
updateResults();
renderHistory();
const diagnostics=storageAdapter.getDiagnostics();
setStatus(`Estado operativo listo. ${diagnostics.records} registro(s) disponibles.`,'red');
