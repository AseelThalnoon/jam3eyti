// Jam3eyti - Local-only ROSCA manager
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const STORAGE_KEY = 'jam3eyti_data_v1';

let app = {
  associations: [],
  activeId: null,
};

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(app));
}
function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { app = JSON.parse(raw); } catch(e){ console.error(e); }
  } else {
    const id = uid();
    app.associations = [{
      id, name: 'جمعيتي الأولى', baseAmount: 1000, frequency: 'monthly', startDate: todayISO(),
      members: [], rota: [], payments: {}
    }];
    app.activeId = id;
    save();
  }
}

function uid(){ return Math.random().toString(36).slice(2,10); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function addPeriod(dateStr, freq, k=1){
  const d = new Date(dateStr);
  if (freq==='daily') d.setDate(d.getDate()+k);
  if (freq==='weekly') d.setDate(d.getDate()+7*k);
  if (freq==='monthly'){ d.setMonth(d.getMonth()+k); }
  return d.toISOString().slice(0,10);
}
function periodName(freq){
  return freq==='daily'?'يومي': freq==='weekly'?'أسبوعي':'شهري';
}

function activeAssoc(){
  return app.associations.find(a=>a.id===app.activeId);
}

function refreshAssocSelect(){
  const sel = $('#assocSelect');
  sel.innerHTML = '';
  app.associations.forEach(a=>{
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = a.name;
    sel.appendChild(opt);
  });
  sel.value = app.activeId;
}

function switchTab(id){
  $$('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $$('.tab').forEach(s=>s.classList.toggle('active', s.id===id));
}

function renderAssoc(){
  const a = activeAssoc();
  $('#assocName').value = a.name||'';
  $('#baseAmount').value = a.baseAmount||'';
  $('#frequency').value = a.frequency||'monthly';
  $('#startDate').value = a.startDate||todayISO();
}

function renderMembers(){
  const a = activeAssoc();
  const tb = $('#membersTable tbody');
  tb.innerHTML = '';
  a.members.forEach((m, idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td><input value="${m.name}" data-id="${m.id}" class="nameEdit"/></td>
      <td><input type="number" min="1" value="${m.shares}" data-id="${m.id}" class="sharesEdit"/></td>
      <td>
        <button data-idx="${idx}" class="upBtn">↑</button>
        <button data-idx="${idx}" class="downBtn">↓</button>
      </td>
      <td>
        <button data-id="${m.id}" class="delBtn">حذف</button>
      </td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('.nameEdit').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const m = a.members.find(x=>x.id===inp.dataset.id);
      m.name = inp.value.trim();
      save();
    });
  });
  tb.querySelectorAll('.sharesEdit').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const m = a.members.find(x=>x.id===inp.dataset.id);
      m.shares = Math.max(1, parseInt(inp.value||'1'));
      save();
    });
  });
  tb.querySelectorAll('.delBtn').forEach(btn=>btn.addEventListener('click', ()=>{
    const id = btn.dataset.id;
    a.members = a.members.filter(x=>x.id!==id);
    save(); renderMembers();
  }));
  tb.querySelectorAll('.upBtn').forEach(btn=>btn.addEventListener('click', ()=>{
    const i = parseInt(btn.dataset.idx);
    if (i>0){ [a.members[i-1], a.members[i]] = [a.members[i], a.members[i-1]]; save(); renderMembers(); }
  }));
  tb.querySelectorAll('.downBtn').forEach(btn=>btn.addEventListener('click', ()=>{
    const i = parseInt(btn.dataset.idx);
    if (i<a.members.length-1){ [a.members[i+1], a.members[i]] = [a.members[i], a.members[i+1]]; save(); renderMembers(); }
  }));
}

function buildRota(){
  const a = activeAssoc();
  const expanded = [];
  a.members.forEach(m=>{ for (let i=0;i<m.shares;i++) expanded.push(m.id); });
  a.rota = [];
  for (let i=0;i<expanded.length;i++){
    const due = addPeriod(a.startDate, a.frequency, i);
    a.rota.push({slot:i+1, memberId:expanded[i], dueDate:due});
  }
  save();
}

function renderRota(){
  const a = activeAssoc();
  const tb = $('#rotaTable tbody');
  tb.innerHTML = '';
  a.rota.forEach(r=>{
    const tr = document.createElement('tr');
    const m = a.members.find(x=>x.id===r.memberId);
    tr.innerHTML = `<td>${r.slot}</td><td>${r.dueDate}</td><td>${m?m.name:'-'}</td>`;
    tb.appendChild(tr);
  });
  const cycSel = $('#cycleSelect');
  cycSel.innerHTML='';
  a.rota.forEach((r)=>{
    const opt = document.createElement('option');
    const m = a.members.find(x=>x.id===r.memberId);
    opt.value = r.slot;
    opt.textContent = `دورة ${r.slot} • ${r.dueDate} • المستلم: ${m?m.name:'-'}`;
    cycSel.appendChild(opt);
  });
}

function nearestCycleIndex(){
  const a = activeAssoc();
  const today = todayISO();
  let idx = 0;
  for (let i=0;i<a.rota.length;i++){
    if (a.rota[i].dueDate >= today){ idx = i; break; }
  }
  return idx; // 0-based
}

function renderPayments(){
  const a = activeAssoc();
  if (!a.rota.length) { $('#paymentsTable tbody').innerHTML = '<tr><td colspan="4">ابنِ جدول الأدوار أولًا.</td></tr>'; return; }
  const slot = parseInt($('#cycleSelect').value||'1');
  const key = `cycle_${slot}`;
  if (!a.payments[key]) a.payments[key]={};
  const tb = $('#paymentsTable tbody');
  tb.innerHTML='';
  a.members.forEach(m=>{
    const paid = !!a.payments[key][m.id];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.name}</td>
      <td>${(a.baseAmount * m.shares).toLocaleString()}</td>
      <td><input type="checkbox" ${paid?'checked':''} data-id="${m.id}"></td>
      <td>${paid? (new Date(a.payments[key][m.id]).toLocaleDateString('ar-SA')):''}</td>
    `;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('change',()=>{
      const id = cb.dataset.id;
      if (cb.checked) a.payments[key][id] = new Date().toISOString();
      else delete a.payments[key][id];
      save();
      renderPayments();
    });
  });
  save();
}

function exportCSV(){
  const a = activeAssoc();
  let csv = [];
  csv.push('### Members');
  csv.push('Name,Shares');
  a.members.forEach(m=>csv.push(`${escapeCSV(m.name)},${m.shares}`));
  csv.push('');
  csv.push('### Rota');
  csv.push('Slot,DueDate,Receiver');
  a.rota.forEach(r=>{
    const m = a.members.find(x=>x.id===r.memberId);
    csv.push(`${r.slot},${r.dueDate},${escapeCSV(m?m.name:'-')}`);
  });
  csv.push('');
  csv.push('### Payments');
  const header = ['Cycle','Member','Paid','PaidAt'];
  csv.push(header.join(','));
  a.rota.forEach(r=>{
    const key = `cycle_${r.slot}`;
    a.members.forEach(m=>{
      const paidAt = a.payments[key]?.[m.id] || '';
      csv.push([r.slot, escapeCSV(m.name), paidAt? 'YES':'NO', paidAt].join(','));
    });
  });
  const blob = new Blob([csv.join('\n')], {type:'text/csv;charset=utf-8;'});
  downloadBlob(blob, `jam3eyti_${a.name.replace(/\s+/g,'_')}.csv`);
}

function backupJSON(){
  const blob = new Blob([JSON.stringify(app,null,2)], {type:'application/json'});
  downloadBlob(blob, `jam3eyti_backup_${Date.now()}.json`);
}
function restoreJSON(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if (data && Array.isArray(data.associations)){
        app = data;
        save();
        boot();
        alert('تم الاستعادة بنجاح.');
      } else alert('ملف غير صالح.');
    } catch(e){ alert('فشل الاستعادة.'); }
  };
  reader.readAsText(file);
}

function escapeCSV(s){
  if (s==null) return '';
  s = String(s);
  if (s.includes(',') || s.includes('"')){
    return `"${s.replace(/"/g,'""')}"`;
  }
  return s;
}
function downloadBlob(blob, filename){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

function boot(){
  refreshAssocSelect();
  renderAssoc();
  renderMembers();
  renderRota();
  switchTab('assoc');
}
document.addEventListener('DOMContentLoaded', ()=>{
  load();
  boot();

  $$('.tabs button').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

  $('#assocSelect').addEventListener('change', e=>{
    app.activeId = e.target.value; save(); boot();
  });
  $('#newAssocBtn').addEventListener('click', ()=>{
    const id = uid();
    const name = prompt('اسم الجمعية الجديدة؟','جمعية جديدة');
    const a = {id, name: name||'جمعية جديدة', baseAmount: 1000, frequency:'monthly', startDate: todayISO(), members:[], rota:[], payments:{}};
    app.associations.push(a);
    app.activeId = id; save(); boot();
  });

  $('#saveAssoc').addEventListener('click', ()=>{
    const a = activeAssoc();
    a.name = ($('#assocName').value.trim() || a.name);
    a.baseAmount = parseFloat($('#baseAmount').value)||a.baseAmount||0;
    a.frequency = $('#frequency').value;
    a.startDate = $('#startDate').value || todayISO();
    save(); refreshAssocSelect();
    alert('تم الحفظ.');
  });
  $('#deleteAssoc').addEventListener('click', ()=>{
    if (!confirm('حذف الجمعية الحالية؟ لا يمكن التراجع.')) return;
    app.associations = app.associations.filter(x=>x.id!==app.activeId);
    if (!app.associations.length){
      const id = uid();
      app.associations = [{id, name:'جمعية', baseAmount:1000, frequency:'monthly', startDate:todayISO(), members:[], rota:[], payments:{}}];
      app.activeId = id;
    } else {
      app.activeId = app.associations[0].id;
    }
    save(); boot();
  });

  $('#addMember').addEventListener('click', ()=>{
    const a = activeAssoc();
    const name = $('#memberName').value.trim();
    const shares = Math.max(1, parseInt($('#memberShares').value||'1'));
    if (!name) return alert('اكتب اسم العضو.');
    a.members.push({id:uid(), name, shares});
    $('#memberName').value=''; $('#memberShares').value='1';
    save(); renderMembers();
  });

  $('#regenRota').addEventListener('click', ()=>{
    buildRota(); renderRota(); alert('تم بناء جدول الأدوار.');
  });

  $('#cycleSelect').addEventListener('change', renderPayments);
  $('#todayCycle').addEventListener('click', ()=>{
    const idx = nearestCycleIndex();
    $('#cycleSelect').selectedIndex = idx;
    renderPayments();
  });
  $('#markAllPaid').addEventListener('click', ()=>{
    const a = activeAssoc();
    const slot = parseInt($('#cycleSelect').value||'1');
    const key = `cycle_${slot}`;
    if (!a.payments[key]) a.payments[key] = {};
    a.members.forEach(m=> a.payments[key][m.id] = new Date().toISOString());
    save(); renderPayments();
  });
  $('#clearPayments').addEventListener('click', ()=>{
    if (!confirm('مسح مدفوعات هذه الدورة؟')) return;
    const a = activeAssoc();
    const slot = parseInt($('#cycleSelect').value||'1');
    const key = `cycle_${slot}`;
    a.payments[key] = {};
    save(); renderPayments();
  });

  $('#exportCSV').addEventListener('click', exportCSV);
  $('#backupJSON').addEventListener('click', backupJSON);
  $('#importJSON').addEventListener('change', e=>{
    const f = e.target.files[0];
    if (f) restoreJSON(f);
  });
  $('#printView').addEventListener('click', ()=>window.print());
});