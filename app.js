// Simple ROSCA with per-member pay; app computes fair slots & totals automatically.
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const KEY = 'jam3eyti_simple_v2';

let state = {
  name: 'جمعيتي',
  frequency: 'monthly',
  startDate: isoToday(),
  members: [],            // {id, name, pay}
  rota: [],               // [{slot, memberId, date}]
  payments: {}            // {cycle_slot: {memberId: ISO}}
};

function isoToday(){ return new Date().toISOString().slice(0,10); }
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function load(){
  const raw = localStorage.getItem(KEY);
  if (raw){ try{ state = JSON.parse(raw); }catch{} }
  if (!state.startDate) state.startDate = isoToday();
}

function addPeriod(dateStr, freq, k=1){
  const d = new Date(dateStr);
  if (freq==='daily') d.setDate(d.getDate()+k);
  if (freq==='weekly') d.setDate(d.getDate()+7*k);
  if (freq==='monthly') d.setMonth(d.getMonth()+k);
  return d.toISOString().slice(0,10);
}
function sumPay(){ return state.members.reduce((a,m)=>a+(+m.pay||0),0); }

// === UI RENDER ===
function renderSettings(){
  $('#assocName').value = state.name || '';
  $('#frequency').value = state.frequency || 'monthly';
  $('#startDate').value = state.startDate || isoToday();
}
function formatSAR(n){ return Number(n||0).toLocaleString('ar-SA'); }

function renderMembers(){
  const tb = $('#membersTable tbody'); tb.innerHTML = '';
  const pot = sumPay();
  state.members.forEach((m,i)=>{
    const tr = document.createElement('tr');
    const sharesInfo = calcShares(); // {unit, totalShares, map:{id:shares}}
    const myShares = sharesInfo.map[m.id]||0;
    const myTotalGet = Math.round(myShares * (pot)); // كل دور يستلم الصندوق كامل

    tr.innerHTML = `
      <td>${i+1}</td>
      <td><input class="nameEdit" data-id="${m.id}" value="${m.name}"></td>
      <td><input class="payEdit" data-id="${m.id}" type="number" min="1" value="${m.pay}"></td>
      <td class="muted">${myShares} دور</td>
      <td><b>${formatSAR(myTotalGet)}</b> ر.س</td>
      <td><button class="delBtn" data-id="${m.id}">حذف</button></td>
    `;
    tb.appendChild(tr);
  });
  $('#sumPay').textContent = formatSAR(pot);

  tb.querySelectorAll('.nameEdit').forEach(inp=>{
    inp.addEventListener('change',()=>{
      const m = state.members.find(x=>x.id===inp.dataset.id);
      m.name = inp.value.trim(); save(); renderMembers();
    });
  });
  tb.querySelectorAll('.payEdit').forEach(inp=>{
    inp.addEventListener('change',()=>{
      const m = state.members.find(x=>x.id===inp.dataset.id);
      m.pay = Math.max(1, +inp.value||1); save(); renderMembers();
    });
  });
  tb.querySelectorAll('.delBtn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      state.members = state.members.filter(x=>x.id!==btn.dataset.id);
      save(); renderMembers(); renderRota(); renderPayments();
    });
  });
}

function calcShares(){
  // Convert pay amounts to shares using smallest pay as unit.
  if (state.members.length===0) return {unit:1,totalShares:0,map:{}};
  const pays = state.members.map(m=>+m.pay||1);
  const unit = Math.max(1, Math.min(...pays)); // أصغر مساهمة = وحدة
  const map = {};
  let total = 0;
  state.members.forEach(m=>{
    const s = Math.max(1, Math.round((+m.pay||1)/unit));
    map[m.id] = s; total += s;
  });
  return {unit, totalShares: total, map};
}

function buildRota(){
  const shares = calcShares(); // map: memberId -> shares
  const seq = [];
  Object.entries(shares.map).forEach(([id, s])=>{
    for (let i=0;i<s;i++) seq.push(id);
  });
  // default deterministic order = as entered
  const ordered = [];
  state.members.forEach(m=>{
    for (let i=0;i<(shares.map[m.id]||0); i++) ordered.push(m.id);
  });
  state.rota = ordered.map((memberId, idx)=>({
    slot: idx+1,
    memberId,
    date: addPeriod(state.startDate, state.frequency, idx)
  }));
  save();
  renderRota();
  renderPayments();
  alert('تم توليد الجدول.');
}

function shuffleRota(){
  for (let i = state.rota.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [state.rota[i], state.rota[j]] = [state.rota[j], state.rota[i]];
  }
  // re-number dates per new order
  state.rota = state.rota.map((r,i)=>({ ...r, slot:i+1, date:addPeriod(state.startDate, state.frequency, i)}));
  save(); renderRota(); renderPayments();
}

function sortRotaByPay(){
  // Highest total pay gets earliest slots
  const payMap = Object.fromEntries(state.members.map(m=>[m.id, +m.pay||0]));
  state.rota.sort((a,b)=> (payMap[b.memberId] - payMap[a.memberId]));
  state.rota = state.rota.map((r,i)=>({ ...r, slot:i+1, date:addPeriod(state.startDate, state.frequency, i)}));
  save(); renderRota(); renderPayments();
}

function renderRota(){
  const tb = $('#rotaTable tbody'); tb.innerHTML = '';
  const pot = sumPay();
  state.rota.forEach(r=>{
    const m = state.members.find(x=>x.id===r.memberId);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.slot}</td><td>${r.date}</td><td>${m?m.name:'-'}</td><td>${formatSAR(pot)} ر.س</td>`;
    tb.appendChild(tr);
  });
  // fill cycles select
  const sel = $('#cycleSelect'); sel.innerHTML = '';
  state.rota.forEach(r=>{
    const m = state.members.find(x=>x.id===r.memberId);
    const o = document.createElement('option');
    o.value = r.slot;
    o.textContent = `دورة ${r.slot} • ${r.date} • ${m?m.name:''}`;
    sel.appendChild(o);
  });
}

function nearestCycleIndex(){
  const today = isoToday();
  let idx = 0;
  for (let i=0;i<state.rota.length;i++){
    if (state.rota[i].date >= today){ idx = i; break; }
  }
  return idx;
}

function renderPayments(){
  const tb = $('#paymentsTable tbody'); tb.innerHTML = '';
  if (!state.rota.length){ tb.innerHTML = '<tr><td colspan="4">ابنِ الجدول أولًا.</td></tr>'; return; }
  const slot = +($('#cycleSelect').value||1);
  const key = 'cycle_'+slot;
  if (!state.payments[key]) state.payments[key] = {};
  const pot = sumPay();

  state.members.forEach(m=>{
    const paidAt = state.payments[key][m.id] || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.name}</td>
      <td>${formatSAR(m.pay)} ر.س</td>
      <td><input type="checkbox" data-id="${m.id}" ${paidAt?'checked':''}></td>
      <td>${paidAt? new Date(paidAt).toLocaleDateString('ar-SA'):''}</td>
    `;
    tb.appendChild(tr);
  });

  tb.querySelectorAll('input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('change',()=>{
      const id = cb.dataset.id;
      if (cb.checked) state.payments[key][id] = new Date().toISOString();
      else delete state.payments[key][id];
      save(); renderPayments();
    });
  });
}

function backupJSON(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  download(blob, `jam3eyti_backup_${Date.now()}.json`);
}
function restoreJSON(file){
  const r = new FileReader();
  r.onload = ()=>{ try{
      const data = JSON.parse(r.result);
      if (data && data.members && Array.isArray(data.members)){ state = data; save(); boot(); alert('تم الاستعادة.'); }
      else alert('ملف غير صالح.');
    }catch{ alert('فشل الاستعادة.'); } };
  r.readAsText(file);
}
function exportCSV(){
  const lines = [];
  const pot = sumPay();
  lines.push('Member,PayPerCycle,TotalSlots,TotalExpectedReceiptsSAR');
  const shares = calcShares();
  state.members.forEach(m=>{
    const s = shares.map[m.id]||0;
    const totalGet = s * pot;
    lines.push(`${csv(m.name)},${m.pay},${s},${totalGet}`);
  });
  lines.push('');
  lines.push('Slot,Date,Receiver,PotSAR');
  state.rota.forEach(r=>{
    const m = state.members.find(x=>x.id===r.memberId);
    lines.push(`${r.slot},${r.date},${csv(m?m.name:'-')},${pot}`);
  });
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  download(blob, `jam3eyti_${state.name.replace(/\s+/g,'_')}.csv`);
}

function csv(s){ if (s==null) return ''; s=String(s); return s.includes(',')?`"${s.replace(/"/g,'""')}"`:s; }
function download(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

function uid(){ return Math.random().toString(36).slice(2,9); }

// === BOOT & EVENTS ===
function boot(){
  renderSettings();
  renderMembers();
  renderRota();
  renderPayments();
}

document.addEventListener('DOMContentLoaded', ()=>{
  load(); boot();

  $('#assocName').addEventListener('change', e=>{ state.name = e.target.value.trim()||'جمعيّتي'; save(); });
  $('#frequency').addEventListener('change', e=>{ state.frequency = e.target.value; save(); renderRota(); renderPayments(); });
  $('#startDate').addEventListener('change', e=>{ state.startDate = e.target.value || isoToday(); save(); renderRota(); renderPayments(); });

  $('#addMember').addEventListener('click', ()=>{
    const name = $('#memberName').value.trim();
    const pay = Math.max(1, +$('#memberPay').value||0);
    if (!name) return alert('أدخل اسم العضو');
    if (!pay) return alert('أدخل مبلغ الدفع لكل دورة');
    state.members.push({id:uid(), name, pay});
    $('#memberName').value=''; $('#memberPay').value='';
    save(); renderMembers();
  });

  $('#clearMembers').addEventListener('click', ()=>{
    if (!confirm('مسح جميع الأعضاء؟')) return;
    state.members = []; state.rota=[]; state.payments={}; save();
    renderMembers(); renderRota(); renderPayments();
  });

  $('#buildRota').addEventListener('click', buildRota);
  $('#shuffle').addEventListener('click', shuffleRota);
  $('#sortByPay').addEventListener('click', sortRotaByPay);

  $('#cycleSelect').addEventListener('change', renderPayments);
  $('#goToday').addEventListener('click', ()=>{
    const idx = nearestCycleIndex();
    $('#cycleSelect').selectedIndex = idx;
    renderPayments();
  });
  $('#markAllPaid').addEventListener('click', ()=>{
    const slot = +($('#cycleSelect').value||1);
    const key = 'cycle_'+slot;
    if (!state.payments[key]) state.payments[key]={};
    state.members.forEach(m=> state.payments[key][m.id] = new Date().toISOString());
    save(); renderPayments();
  });
  $('#resetCycle').addEventListener('click', ()=>{
    const slot = +($('#cycleSelect').value||1);
    const key = 'cycle_'+slot;
    if (!confirm('مسح مدفوعات هذه الدورة؟')) return;
    state.payments[key] = {};
    save(); renderPayments();
  });

  $('#backupJSON').addEventListener('click', backupJSON);
  $('#importJSON').addEventListener('change', e=>{ const f=e.target.files[0]; if (f) restoreJSON(f); });
  $('#exportCSV').addEventListener('click', exportCSV);
  $('#printView').addEventListener('click', ()=>window.print());

  // Add to home hint for iOS
  $('#addToHome').addEventListener('click', ()=>{
    alert('في Safari: زر المشاركة → إضافة إلى الشاشة الرئيسية.');
  });
});