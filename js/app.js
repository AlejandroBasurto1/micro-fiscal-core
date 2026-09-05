import { storageAdapter } from './storage.js';
import { activityOperations, dynamicRules, fiscalConfig } from './config.js';
import { bindCalculator } from './calculator.js';
import { initOperations, collectOperationData, loadOperationData, resetOperationData, commitOperationMedia, deleteOperationMedia } from './operations.js';
import { buildCsv } from './export.js';
import { buildOperationalRecord, calculateExpenseSummary, calculateTravelSummary, operationalCsvHeaders, operationalCsvRow, operationalModules, recordMatchesOperationalFilters, validateOperationalPayload } from './operational-modules.js';
import { buildMediaBackup, restoreMediaBackup } from './media.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const fields = ['actividadSelect','operacionSelect','clienteNombre','clienteTelefono','clienteDireccion','metodoPago','lineasPedido','distanciaPedido','bancoActivo','titularCuenta','clabeCuenta','tipoEntrega'];
const operationalFieldIds = [
  'expenseDate','expenseCategory','expenseConcept','expenseVendor','expenseAmount','expenseVat','expensePayment','expenseAccount','expenseDocumentType','expenseRelatedOperation','expenseRelatedClient',
  'travelPurpose','travelOrigin','travelDestination','travelStartDate','travelEndDate','travelVehicle','travelStartMileage','travelEndMileage','travelFuel','travelTolls','travelParking','travelFood','travelLodging','travelTransport','travelOther','travelAdvance','travelPayment','travelRelatedOperation'
];
const operationalSet = new Set(operationalModules);
const state = { activeModule: 'Actividad', currentEditingId: null, total: 0, dirty: false };
const money = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});

function readPreference(key, fallback='') {
  try { return localStorage.getItem(key) ?? fallback; }
  catch { return fallback; }
}

function writePreference(key, data) {
  try { localStorage.setItem(key, data); return true; }
  catch { setStatus('La preferencia se aplicó, pero el navegador no permitió guardarla.','yellow'); return false; }
}

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

function todayLocal() {
  const now=new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function operationalInput(moduleName=state.activeModule) {
  if(moduleName==='Gastos') return {
    fecha:value('expenseDate'), categoria:value('expenseCategory'), concepto:value('expenseConcept'), proveedor:value('expenseVendor'),
    importe:value('expenseAmount'), iva:value('expenseVat'), metodoPago:value('expensePayment'), cuentaBanco:value('expenseAccount'),
    tipoComprobante:value('expenseDocumentType'), responsable:value('responsibleUser'), operacionRelacionada:value('expenseRelatedOperation'), clienteRelacionado:value('expenseRelatedClient')
  };
  if(moduleName==='Viáticos') return {
    responsable:value('responsibleUser'), motivo:value('travelPurpose'), origen:value('travelOrigin'), destino:value('travelDestination'),
    fechaInicio:value('travelStartDate'), fechaFin:value('travelEndDate'), vehiculo:value('travelVehicle'), kilometrajeInicial:value('travelStartMileage'),
    kilometrajeFinal:value('travelEndMileage'), gasolina:value('travelFuel'), casetas:value('travelTolls'), estacionamiento:value('travelParking'),
    alimentos:value('travelFood'), hospedaje:value('travelLodging'), transporte:value('travelTransport'), otrosGastos:value('travelOther'),
    anticipos:value('travelAdvance'), metodoPago:value('travelPayment'), operacionRelacionada:value('travelRelatedOperation')
  };
  return {};
}

function updateOperationalSummary() {
  if(state.activeModule==='Gastos') {
    const summary=calculateExpenseSummary(operationalInput());
    $('#expenseTotal').textContent=money.format(summary.total);
    updateResults(summary.total);
    $('#resultIVA').textContent=money.format(summary.iva);
    $('#resultProfit').textContent=money.format(0);
  } else if(state.activeModule==='Viáticos') {
    const summary=calculateTravelSummary(operationalInput());
    $('#travelActual').textContent=money.format(summary.gastoReal);
    $('#travelBalance').textContent=`Saldo ${money.format(summary.saldoPorComprobar)}`;
    $('#travelDistance').textContent=`${summary.kilometrosRecorridos} km`;
    $('#travelExpenseBreakdown').textContent=`Gasto real ${money.format(summary.gastoReal)}`;
    $('#travelPendingBalance').textContent=`Saldo por comprobar ${money.format(summary.saldoPorComprobar)}`;
    updateResults(summary.gastoReal);
    $('#resultIVA').textContent=money.format(0);
    $('#resultProfit').textContent=money.format(0);
  }
}

function updateResults(total=state.total) {
  const parsed = Number(total);
  state.total = Number.isFinite(parsed) ? parsed : 0;
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
  const operationData=collectOperationData();
  if(operationalSet.has(state.activeModule)) {
    return buildOperationalRecord(state.activeModule,operationalInput(),operationData,now);
  }
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
    ...operationData
  };
}

function validRecord(record) {
  if(operationalSet.has(record?.moduloActivo)) {
    return validateOperationalPayload(record.moduloActivo,record.datosModulo).valid && Boolean(record.numeroOperacion);
  }
  return Boolean(record.numeroOperacion && record.actividad && record.operacion && (record.nombreActivo || record.resultadoCalculadora>0 || record.cliente || record.banco));
}

async function saveRecord() {
  let data;
  try { data=collectRecord(); }
  catch(error) {
    setStatus(error?.message || 'Revisa los datos obligatorios del módulo.','yellow');
    toast('Completa la información mínima.');
    return null;
  }
  if(!validRecord(data)) {
    const validation=operationalSet.has(state.activeModule) ? validateOperationalPayload(state.activeModule,operationalInput()) : null;
    setStatus(validation?.errors?.join(' ') || 'Faltan actividad, operación y un resultado o dato suficiente para guardar.','yellow');
    toast('Completa la información mínima.');
    return null;
  }

  try {
    let saved;
    const wasEditing=Boolean(state.currentEditingId);
    if(wasEditing) {
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
    } else {
      data.historialCambios=[{date:new Date().toISOString(),action:`Expediente creado por ${data.usuarioResponsable||'usuario local'}.`}];
      saved=storageAdapter.create(data);
    }

    if(!saved) throw new Error('El adaptador no devolvió el registro guardado.');
    await commitOperationMedia(saved);
    state.currentEditingId=saved.id;
    $('#mainSection').classList.add('editing');
    state.dirty=false;
    const hasLocation=Number.isFinite(saved.ubicacion?.latitud) && Number.isFinite(saved.ubicacion?.longitud);
    setStatus(`Registro ${saved.id.slice(0,8)} ${wasEditing?'actualizado':'guardado'}${hasLocation?' con ubicación':' sin ubicación'}.`,'green');
    updateResults(data.resultadoCalculadora);
    renderHistory();
    renderModuleRecords();
    window.dispatchEvent(new CustomEvent('mrfc:records-changed'));
    toast('Registro guardado correctamente.');
    return saved;
  } catch(error) {
    console.error(error);
    setStatus(error?.code==='MRFC_STORAGE_WRITE_FAILED' ? error.message : 'No fue posible guardar el registro. Tus datos permanecen en pantalla.','red');
    toast('Error al guardar. No se borraron los datos del formulario.');
    return null;
  }
}

function fillOperationalForm(moduleName, data={}) {
  const maps = {
    Gastos: {expenseDate:'fecha',expenseCategory:'categoria',expenseConcept:'concepto',expenseVendor:'proveedor',expenseAmount:'importe',expenseVat:'iva',expensePayment:'metodoPago',expenseAccount:'cuentaBanco',expenseDocumentType:'tipoComprobante',expenseRelatedOperation:'operacionRelacionada',expenseRelatedClient:'clienteRelacionado'},
    'Viáticos': {travelPurpose:'motivo',travelOrigin:'origen',travelDestination:'destino',travelStartDate:'fechaInicio',travelEndDate:'fechaFin',travelVehicle:'vehiculo',travelStartMileage:'kilometrajeInicial',travelEndMileage:'kilometrajeFinal',travelFuel:'gasolina',travelTolls:'casetas',travelParking:'estacionamiento',travelFood:'alimentos',travelLodging:'hospedaje',travelTransport:'transporte',travelOther:'otrosGastos',travelAdvance:'anticipos',travelPayment:'metodoPago',travelRelatedOperation:'operacionRelacionada'}
  };
  operationalFieldIds.forEach(id=>setValue(id,''));
  Object.entries(maps[moduleName]||{}).forEach(([id,key])=>setValue(id,data[key]));
  updateOperationalSummary();
}

async function loadRecord(id, editing=false) {
  const record=storageAdapter.find(id);
  if(!record) {
    setStatus('El registro solicitado no existe.','red');
    renderHistory();
    return;
  }
  const moduleName=operationalSet.has(record.moduloActivo) ? record.moduloActivo : 'Actividad';
  activateModule(moduleName,true);
  if(moduleName==='Actividad') {
    setValue('actividadSelect',record.actividad);
    populateOperations(record.operacion);
    fields.slice(2).forEach(id=>{
      const map={clienteNombre:'cliente',clienteTelefono:'telefono',clienteDireccion:'direccion',lineasPedido:'lineasPedido',distanciaPedido:'distancia',bancoActivo:'banco'};
      setValue(id,record[map[id]||id]);
    });
  } else {
    fillOperationalForm(moduleName,record.datosModulo);
  }
  state.total=Number(record.resultadoCalculadora)||0;
  $('#calcDisplay').value=state.total||'';
  updateResults();
  if(moduleName==='Actividad') updateDynamicFields();
  else updateOperationalSummary();
  await loadOperationData(record);
  state.dirty=false;
  state.currentEditingId=id;
  if(editing) {
    $('#mainSection').classList.add('editing');
    setStatus(`Editando registro ${id.slice(0,8)}. Guarda para actualizar.`,'yellow');
  } else {
    $('#mainSection').classList.remove('editing');
    setStatus(`Registro ${id.slice(0,8)} cargado. Los cambios se guardarán sobre este expediente.`,'yellow');
  }
  window.scrollTo({top:$('#mainSection').offsetTop-12,behavior:'smooth'});
}

function clearForm(force=false) {
  if(!force&&state.dirty&&!confirm('Hay datos sin guardar. ¿Deseas limpiar el formulario?')) return;
  fields.forEach(id=>setValue(id,''));
  operationalFieldIds.forEach(id=>setValue(id,''));
  setValue('expenseDate',todayLocal());
  setValue('travelStartDate',todayLocal());
  setValue('travelEndDate',todayLocal());
  populateOperations();
  calculator.clear();
  updateResults(0);
  updateOperationalSummary();
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

function moduleRecordSummary(record) {
  const data=record?.datosModulo||{};
  if(record?.moduloActivo==='Gastos') return `${data.categoria||'Sin categoría'} · ${data.concepto||'Sin concepto'} · ${money.format(record.resultadoCalculadora||0)}`;
  if(record?.moduloActivo==='Viáticos') return `${data.origen||'Sin origen'} → ${data.destino||'Sin destino'} · ${money.format(data.gastoReal||0)}`;
  return `${record?.cliente||'Sin cliente'} · ${money.format(record?.resultadoCalculadora||0)}`;
}

function recordSearchValues(record) {
  const moduleValues=Object.values(record?.datosModulo||{});
  return [record.cliente,record.actividad,record.operacion,record.id,record.numeroOperacion,record.identificadorActivo,record.numeroSerie,record.usuarioResponsable,record.codigoBarras,record.ubicacion?.direccion,...moduleValues];
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

  const records=allRecords.filter(r=>(!activity||r.actividad===activity)&&(!operation||r.operacion===operation)&&(!query||recordSearchValues(r).some(v=>String(v||'').toLowerCase().includes(query))));
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
    meta.textContent=`${record.fechaLegible||''} ${record.hora||''} · ${moduleRecordSummary(record)}`;
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

function renderModuleRecords() {
  const container=$('#moduleRecordResults');
  if(!container || !operationalSet.has(state.activeModule)) return;
  const category=value('moduleRecordCategory');
  const allModuleRecords=storageAdapter.list().filter(record=>record.moduloActivo===state.activeModule);
  const categories=[...new Set(allModuleRecords.map(record=>record.datosModulo?.categoria).filter(Boolean))].sort();
  fillFilter($('#moduleRecordCategory'),'Todas las categorías',categories,category);
  $('#moduleRecordCategory').disabled=state.activeModule!=='Gastos';
  const records=allModuleRecords
    .filter(record=>recordMatchesOperationalFilters(record,{module:state.activeModule,query:value('moduleRecordSearch'),date:value('moduleRecordDate'),category:value('moduleRecordCategory')}))
    .sort((a,b)=>new Date(b.fechaCreacion||b.fechaISO)-new Date(a.fechaCreacion||a.fechaISO));
  container.replaceChildren();
  if(!records.length) {
    const empty=document.createElement('p');
    empty.textContent=`No hay registros de ${state.activeModule} para estos filtros.`;
    container.append(empty);
    return;
  }
  records.forEach(record=>{
    const card=document.createElement('article');
    card.className='query-card';
    const title=document.createElement('h3');
    title.textContent=record.numeroOperacion||record.id;
    const detail=document.createElement('p');
    detail.textContent=`${record.fechaLegible||''} · ${moduleRecordSummary(record)} · ${record.estadoOperacion||'Borrador'}`;
    const actions=document.createElement('div');
    actions.className='inline-actions';
    [['Consultar','load'],['Editar','edit'],['Eliminar','delete']].forEach(([label,action])=>{
      const button=document.createElement('button');
      button.type='button'; button.textContent=label; button.dataset.moduleAction=action; button.dataset.id=record.id;
      actions.append(button);
    });
    card.append(title,detail,actions);
    container.append(card);
  });
}

async function removeRecord(id) {
  try {
    const record=storageAdapter.find(id);
    const deleted=storageAdapter.delete(id);
    if(!deleted) throw new Error('El registro ya no existe.');
    if(record) await deleteOperationMedia(record);
    if(state.currentEditingId===id) clearForm(true);
    renderHistory();
    renderModuleRecords();
    window.dispatchEvent(new CustomEvent('mrfc:records-changed'));
    setStatus('Registro eliminado.','red');
    return true;
  } catch(error) {
    console.error(error);
    setStatus('No fue posible eliminar el registro.','red');
    return false;
  }
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
  const records=storageAdapter.list().filter(record=>!operationalSet.has(state.activeModule)||record.moduloActivo===state.activeModule);
  if(!records.length){toast('No hay registros para exportar.');return;}
  const operational=operationalSet.has(state.activeModule);
  const headers=operational ? operationalCsvHeaders : ['ID','Fecha','Hora','Actividad','Operación','Cliente','Teléfono','Dirección','Método de pago','Banco','Titular','Cuenta','Distancia','Resultado','IVA','ISR','Ganancia','Latitud','Longitud'];
  const rows=operational ? records.map(operationalCsvRow) : records.map(r=>[r.id,r.fechaLegible,r.hora,r.actividad,r.operacion,r.cliente,r.telefono,r.direccion,r.metodoPago,r.banco,r.titularCuenta,r.clabeCuenta,r.distancia,r.resultadoCalculadora,r.iva,r.isr,r.gananciaReal,r.ubicacion?.latitud??'',r.ubicacion?.longitud??'']);
  downloadBlob(buildCsv(headers,rows),`MRFC_${operational?state.activeModule.toLowerCase():'registros'}_${fileStamp()}.csv`,'text/csv;charset=utf-8');
  setStatus(`Exportación CSV de ${operational?state.activeModule:'registros'} compatible con Excel completada.`,'green');
}

async function exportJsonBackup() {
  const records=storageAdapter.list();
  if(!records.length){toast('No hay registros para respaldar.');return;}
  try {
    const backup=JSON.parse(storageAdapter.exportBackup());
    const media=await buildMediaBackup(records);
    backup.media=media.items;
    backup.mediaSummary={included:media.items.length,missing:media.missing.length,totalBytes:media.totalBytes};
    downloadBlob(JSON.stringify(backup,null,2),`MRFC_respaldo_${fileStamp()}.json`,'application/json;charset=utf-8');
    const warning=media.missing.length?` ${media.missing.length} fotografía(s) referenciada(s) no estaban disponibles.`:'';
    setStatus(`Respaldo generado con ${records.length} registro(s) y ${media.items.length} fotografía(s).${warning}`,media.missing.length?'yellow':'green');
  } catch {
    setStatus('No fue posible crear el respaldo. Verifica el almacenamiento de fotografías.','red');
    toast('No se generó ningún archivo de respaldo.');
  }
}

async function importJsonBackup(file) {
  if(!file) return;
  if(file.size>90*1024*1024){setStatus('El respaldo excede el límite seguro de 90 MB.','red');return;}
  try {
    const parsed=JSON.parse(await file.text());
    if(!Array.isArray(parsed)&&parsed?.app&&parsed.app!=='MRFC') throw new Error('Aplicación inválida.');
    const records=Array.isArray(parsed)?parsed:parsed?.records;
    if(!Array.isArray(records)) throw new Error('Colección inválida.');
    const restoredPhotos=await restoreMediaBackup(Array.isArray(parsed)?null:parsed.media);
    const imported=storageAdapter.importBackup(parsed);
    renderHistory();
    renderModuleRecords();
    window.dispatchEvent(new CustomEvent('mrfc:records-changed'));
    setStatus(`Respaldo restaurado. MRFC contiene ${imported.length} registro(s) y recuperó ${restoredPhotos} fotografía(s).`,'green');
    toast('Respaldo restaurado correctamente.');
  } catch {
    setStatus('El archivo seleccionado no es un respaldo MRFC válido o no pudo restaurarse de forma segura.','red');
    toast('No se pudo restaurar el respaldo.');
  }
}

function installBackupControls() {
  const host=$('.secondary-actions');
  if(!host || $('#backupJsonBtn')) return;
  const backup=document.createElement('button');
  backup.className='tool-btn';
  backup.id='backupJsonBtn';
  backup.type='button';
  backup.textContent='💾 Respaldo JSON';
  backup.addEventListener('click',()=>{void exportJsonBackup();});

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
    void importJsonBackup(event.target.files?.[0]);
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

function activateModule(name,force=false) {
  if(!force&&state.activeModule!==name&&state.dirty&&!confirm('Hay cambios sin guardar. ¿Deseas cambiar de módulo y descartarlos?')) return false;
  if(!force&&state.activeModule!==name) clearForm(true);
  state.activeModule=name;
  $$('.card').forEach(card=>{
    const active=card.dataset.module===name;
    card.classList.toggle('active',active);
    card.classList.toggle('inactive',!active);
  });
  const activity=name==='Actividad';
  const operational=operationalSet.has(name);
  $('#activityForm').classList.toggle('dynamic-hidden',!activity);
  $('#operationalModuleForms').classList.toggle('dynamic-hidden',!operational);
  $$('[data-operational-module]').forEach(form=>form.classList.toggle('dynamic-hidden',form.dataset.operationalModule!==name));
  $('#operationDossier').classList.toggle('dynamic-hidden',!(activity||operational));
  $('#modulePlaceholder').classList.toggle('dynamic-hidden',activity||operational);
  $('#panelTitle').textContent=activity?'Operación del Día':name;
  if(operational) {
    $('#dossierTitle').textContent=name==='Gastos'?'Expediente del gasto':'Expediente de viáticos';
    $('#estructuraBase').textContent=name==='Gastos'?'Gastos usa el expediente compartido para evidencia, OCR, ubicación y códigos.':'Viáticos calcula gasto real y saldo por comprobar sin aplicar reglas fiscales.';
    if(!value(name==='Gastos'?'expenseDate':'travelStartDate')) {
      setValue(name==='Gastos'?'expenseDate':'travelStartDate',todayLocal());
      if(name==='Viáticos') setValue('travelEndDate',todayLocal());
    }
    updateOperationalSummary();
    renderModuleRecords();
    setStatus(`Módulo ${name} listo para captura.`,'green');
  } else if(activity) {
    $('#dossierTitle').textContent='Expediente por operación';
    $('#estructuraBase').textContent='🧠 Plantilla MRFC activa. Los campos cambian según actividad y operación seleccionada.';
  } else {
    $('#modulePlaceholder').textContent=`Módulo ${name} preparado. El núcleo de expedientes permanece disponible en Actividad.`;
    setStatus(`Módulo activo: ${name}.`,'yellow');
  }
  return true;
}

function scrollToElement(element) {
  if(!element) return;
  element.scrollIntoView({behavior:'smooth',block:'center'});
}

function openQrTools() {
  if(!$('#operationDossier').classList.contains('dynamic-hidden')) {
    const panel=$('#qrOutput')?.closest('.code-panel');
    scrollToElement(panel);
    setStatus('Herramientas QR listas. Selecciona los datos y genera el código.','green');
    return;
  }
  activateModule('Actividad');
  const panel=$('#qrOutput')?.closest('.code-panel');
  scrollToElement(panel);
  setStatus('Herramientas QR listas. Selecciona los datos y genera el código.','green');
}

function openBarcodeTools() {
  if($('#operationDossier').classList.contains('dynamic-hidden')) activateModule('Actividad');
  const panel=$('#barcodeOutput')?.closest('.code-panel');
  scrollToElement(panel);
  setStatus('Herramientas de código de barras listas.','green');
}

function openOcrTools() {
  if($('#operationDossier').classList.contains('dynamic-hidden')) activateModule('Actividad');
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
    ? {saveBtn:'💾 Save',editBtn:'✏️ Edit',clearBtn:'🗑️ Clear',exportBtn:'📤 Export CSV',historialBtn:'📊 History',queryTitle:'🔎 Operation files',getLocationBtn:'Get location',generateQrBtn:'Generate QR',downloadQrBtn:'Download',printQrBtn:'Print',scanQrBtn:'Scan',generateBarcodeBtn:'Generate',downloadBarcodeBtn:'Download',printBarcodeBtn:'Print',scanBarcodeBtn:'Scan',queryBtn:'Search',backupJsonBtn:'💾 JSON backup',restoreJsonBtn:'♻️ Restore',moduleExportBtn:'Export module CSV'}
    : {saveBtn:'💾 Guardar',editBtn:'✏️ Editar',clearBtn:'🗑️ Limpiar',exportBtn:'📤 Exportar CSV',historialBtn:'📊 Historial',queryTitle:'🔎 Consulta de expedientes',getLocationBtn:'Obtener ubicación',generateQrBtn:'Generar QR',downloadQrBtn:'Descargar',printQrBtn:'Imprimir',scanQrBtn:'Escanear',generateBarcodeBtn:'Generar',downloadBarcodeBtn:'Descargar',printBarcodeBtn:'Imprimir',scanBarcodeBtn:'Escanear',queryBtn:'Buscar',backupJsonBtn:'💾 Respaldo JSON',restoreJsonBtn:'♻️ Restaurar',moduleExportBtn:'Exportar módulo CSV'};
  Object.entries(labels).forEach(([id,text])=>{const node=document.getElementById(id);if(node)node.textContent=text;});
  $$('[data-lang-es][data-lang-en]').forEach(node=>{node.textContent=english?node.dataset.langEn:node.dataset.langEs;});
  writePreference('mrfc-language',document.documentElement.lang);
}

const calculator=bindCalculator({overlay:$('#calcOverlay'),display:$('#calcDisplay'),onSave:async()=>{if(await saveRecord())closeCalculator();},onResult:updateResults,ivaRate:fiscalConfig.ivaRate});
function openCalculator(){$('#calcOverlay').classList.add('active');$('#calcDisplay').focus();}
function closeCalculator(){$('#calcOverlay').classList.remove('active');$('#calcBtn').focus();}

$('#actividadSelect').addEventListener('change',()=>{populateOperations();updateDynamicFields();state.dirty=true;setStatus('Actividad seleccionada. Completa la operación.','yellow');});
$('#operacionSelect').addEventListener('change',()=>{updateDynamicFields();state.dirty=true;setStatus('Operación seleccionada. Datos sin guardar.','yellow');});
$('#mainSection').addEventListener('input',event=>{
  if(event.target.closest('#moduleRecordTools')) return;
  state.dirty=true;
  if(operationalSet.has(state.activeModule)) updateOperationalSummary();
  setStatus('Formulario modificado. Datos sin guardar.','yellow');
});
$$('.card').forEach(card=>card.addEventListener('click',()=>activateModule(card.dataset.module)));
$('#moduleSearch').addEventListener('input',event=>{const q=event.target.value.trim().toLowerCase();$$('[data-module]').forEach(card=>card.classList.toggle('module-hidden',q&&!card.dataset.module.toLowerCase().includes(q)));$$('.tool-actions .tool-btn').forEach(button=>button.classList.toggle('module-hidden',q&&!button.textContent.toLowerCase().includes(q)));});

$('#themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('light-mode');
  document.documentElement.classList.toggle('theme-light',document.body.classList.contains('light-mode'));
  const light=document.body.classList.contains('light-mode');
  writePreference('mrfc-theme',light?'light':'dark');
  $('#themeToggle').textContent=light?'☀️':'🌙';
  $('#mrfcLogo').src=light?'assets/assetsmrfc-logo-light.png':'assets/assetsmrfc-logo-dark.png';
});
if(readPreference('mrfc-theme')==='light') {
  document.body.classList.add('light-mode');
  document.documentElement.classList.add('theme-light');
  $('#themeToggle').textContent='☀️';
  $('#mrfcLogo').src='assets/assetsmrfc-logo-light.png';
}

$('#languageToggle').addEventListener('click',()=>applyLanguage(document.documentElement.lang==='es'?'en':'es'));
applyLanguage(readPreference('mrfc-language')==='en'?'en':'es');

$('#homeBtn').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
$('#backBtn').addEventListener('click',()=>history.back());
$('#nextBtn').addEventListener('click',()=>history.forward());
$('#calcBtn').addEventListener('click',openCalculator);
$('#closeCalc').addEventListener('click',closeCalculator);
$('#calcOverlay').addEventListener('click',e=>{if(e.target===$('#calcOverlay'))closeCalculator();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('#calcOverlay').classList.contains('active')) closeCalculator();
  else if(e.key==='Escape') document.querySelector('.media-lightbox')?.remove();
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s') {e.preventDefault();saveRecord();}
});
window.addEventListener('beforeunload',event=>{if(!state.dirty)return;event.preventDefault();event.returnValue='';});
window.addEventListener('mrfc:dirty',()=>{state.dirty=true;setStatus('Formulario modificado. Datos sin guardar.','yellow');});

$('#saveBtn').addEventListener('click',saveRecord);
$('#editBtn').addEventListener('click',()=>{if(state.currentEditingId){setStatus('Ya existe un registro en edición.','yellow');return;}$('#historialPanel').classList.remove('dynamic-hidden');renderHistory();setStatus('Selecciona Editar en el historial.','yellow');});
$('#clearBtn').addEventListener('click',()=>clearForm());
$('#exportBtn').addEventListener('click',exportCsv);
$('#moduleExportBtn').addEventListener('click',exportCsv);
$('#historialBtn').addEventListener('click',()=>{$('#historialPanel').classList.toggle('dynamic-hidden');renderHistory();});
['historySearch','historyActivity','historyOperation'].forEach(id=>document.getElementById(id).addEventListener(id==='historySearch'?'input':'change',renderHistory));
['moduleRecordSearch','moduleRecordDate','moduleRecordCategory'].forEach(id=>document.getElementById(id).addEventListener(id==='moduleRecordSearch'?'input':'change',renderModuleRecords));
$('#moduleRecordResults').addEventListener('click',event=>{
  const button=event.target.closest('button[data-module-action][data-id]');
  if(!button) return;
  const {id,moduleAction}=button.dataset;
  if(moduleAction==='load') loadRecord(id,false);
  if(moduleAction==='edit') loadRecord(id,true);
  if(moduleAction==='delete'&&confirm('¿Eliminar este registro y sus evidencias?')) removeRecord(id);
});
$('#historialContenido').addEventListener('click',event=>{
  const button=event.target.closest('button[data-id]');
  if(!button)return;
  const {id,action}=button.dataset;
  if(action==='load')loadRecord(id);
  if(action==='edit')loadRecord(id,true);
  if(action==='delete'&&confirm('¿Eliminar este registro?')) removeRecord(id);
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
applyLanguage(document.documentElement.lang);
setValue('expenseDate',todayLocal());
setValue('travelStartDate',todayLocal());
setValue('travelEndDate',todayLocal());
populateOperations();
updateDynamicFields();
updateResults();
renderHistory();
const diagnostics=storageAdapter.getDiagnostics();
setStatus(diagnostics.storageAvailable ? `Estado operativo listo. ${diagnostics.records} registro(s) disponibles.` : 'La app inició, pero el almacenamiento local no está disponible.',diagnostics.storageAvailable?'green':'red');
