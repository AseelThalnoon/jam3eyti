/* جمعيتي v0.8 — Collapsible Members & Schedule + footer credits kept in HTML */

const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const SKEY = "jamiyati:v02";

const state = {
  jamiyahs: loadAll(),
  currentId: null,
  filter: ""
};

/* ---------- Formatting ---------- */
function fmtMoney(n){ return Number(n||0).toLocaleString('en-US'); }
function fmtInt(n){ return Number(n||0).toLocaleString('en-US'); }
function monthLabel(startDate, offset){
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + (offset - 1));
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function startedStatus(j){ return hasStarted(j) ? `Started` : `Starts ${j.startDate}`; }

/* ---------- Storage & Migration ---------- */
function migrateV01toV02(old) {
  return (old || []).map(j => ({
    ...j,
    goal: Number(j.goal || 0),
    members: (j.members || []).map(m => ({
      ...m,
      entitlement: Number.isFinite(m.entitlement)
        ? Number(m.entitlement)
        : Number(m.pay || 0) * Number(j.duration || 0)
    }))
  }));
}
function loadAll() {
  try {
    const v02 = JSON.parse(localStorage.getItem(SKEY));
    if (Array.isArray(v02)) return v02;
    const v01 = JSON.parse(localStorage.getItem("jamiyati:v01"));
    if (Array.isArray(v01)) {
      const migrated = migrateV01toV02(v01);
      localStorage.setItem(SKEY, JSON.stringify(migrated));
      return migrated;
    }
    return [];
  } catch { return []; }
}
function saveAll() { localStorage.setItem(SKEY, JSON.stringify(state.jamiyahs)); }

/* ---------- Utils ---------- */
function uid() { return Math.random().toString(36).slice(2,10); }
function addMonths(dateStr, i){ const d = new Date(dateStr); d.setMonth(d.getMonth()+i); return d.toISOString().slice(0,10); }
function hasStarted(j){ const today = new Date().setHours(0,0,0,0); const start = new Date(j.startDate).setHours(0,0,0,0); return today >= start; }
function currentJamiyah(){ return state.jamiyahs.find(x=>x.id===state.currentId); }
function toast(msg){ const box = $('#toasts'); const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; box.appendChild(el); setTimeout(()=>{ el.remove(); }, 2500); }
function setError(id, text){ const el = $(`#${id}`); if (el) el.textContent = text || ''; }

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Create
  $('#jamiyahForm').addEventListener('submit', onCreateJamiyah);

  // Member add
  $('#memberForm').addEventListener('submit', onAddMember);

  // Nav
  $('#deleteJamiyah').addEventListener('click', onDeleteJamiyah);
  $('#backBtn').addEventListener('click', () => showList());

  // Edit
  $('#editForm').addEventListener('submit', onSaveEdit);
  $('#cancelEdit').addEventListener('click', (e)=> { e.preventDefault(); $('#editBlock').open = false; });

  // Search
  $('#search').addEventListener('input', (e)=>{ state.filter = (e.target.value||'').trim(); renderList(); });

  // Import / Export
  $('#exportBtn').addEventListener('click', onExport);
  $('#importInput').addEventListener('change', onImport);

  // Live hints
  $('#m-month').addEventListener('change', updateMonthHint);
  $('#m-pay').addEventListener('input', updateMonthHint);

  renderList();
});

/* ---------- Create Jamiyah ---------- */
function onCreateJamiyah(e){
  e.preventDefault();
  setError('err-j-name'); setError('err-j-start'); setError('err-j-duration'); setError('err-j-goal');

  const name = $('#j-name').value.trim();
  const startDate = $('#j-start').value;
  const duration = parseInt($('#j-duration').value);
  const goal = parseInt($('#j-goal').value);

  let ok = true;
  if (!name){ setError('err-j-name','required'); ok = false; }
  if (!startDate){ setError('err-j-start','required'); ok = false; }
  if (!duration || duration<1){ setError('err-j-duration','min 1'); ok = false; }
  if (!goal || goal<=0){ setError('err-j-goal','> 0'); ok = false; }
  if (!ok) return;

  if (state.jamiyahs.some(j=>j.name === name)){
    setError('err-j-name','name already exists'); return;
  }

  const jamiyah = { id: uid(), name, startDate, duration, goal, members: [], createdAt: Date.now() };
  state.jamiyahs.push(jamiyah);
  saveAll();

  e.target.reset();
  renderList();
  toast('تم إنشاء الجمعية');
}

/* ---------- List Jamiyahs ---------- */
function renderList(){
  const list = $('#jamiyahList');
  const empty = $('#emptyList');
  const count = $('#listCount');

  const items = state.jamiyahs
    .filter(j => !state.filter || j.name.includes(state.filter))
    .sort((a,b)=> a.name.localeCompare(b.name));

  list.innerHTML = '';
  if (items.length === 0){
    empty.classList.remove('hidden');
    count.textContent = '';
  } else {
    empty.classList.add('hidden');
    count.textContent = `(${fmtInt(items.length)})`;
  }

  items.forEach(j=>{
    const totalEntitlement = j.members.reduce((s,m)=>s+Number(m.entitlement||0),0);
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `
      <div>
        <div><strong>${j.name}</strong></div>
        <div class="meta">
          <span>من ${j.startDate} لمدة ${fmtInt(j.duration)} شهر</span>
          <span class="badge">الهدف الشهري: ${fmtMoney(j.goal)}</span>
          <span class="badge">${startedStatus(j)}</span>
          <span class="badge">مجموع الاستحقاقات: ${fmtMoney(totalEntitlement)}</span>
        </div>
      </div>
      <button class="btn" data-id="${j.id}">فتح</button>
    `;
    row.querySelector('button').addEventListener('click', ()=> openDetails(j.id));
    list.appendChild(row);
  });

  if (state.jamiyahs.length === 0) $('#details').classList.add('hidden');
}

/* ---------- Open details ---------- */
function openDetails(id){
  state.currentId = id;
  const j = currentJamiyah();
  if (!j) return;

  $('#d-title').textContent = j.name;
  $('#d-period').textContent = `من ${j.startDate} لمدة ${fmtInt(j.duration)} شهر`;
  $('#d-goal').textContent = `الهدف الشهري: ${fmtMoney(j.goal)}`;
  $('#d-status').textContent = startedStatus(j);

  const started = hasStarted(j);
  $('#startedAlert').hidden = !started;
  $('#memberForm').querySelectorAll('input,button,select').forEach(el => { el.disabled = started; });

  // Pre-fill edit form
  $('#e-name').value = j.name;
  $('#e-goal').value = j.goal;
  $('#e-start').value = j.startDate;
  $('#e-duration').value = j.duration;
  $('#e-start').disabled = started;
  $('#e-duration').disabled = started;

  // Mobile: collapse big sections by default, expand on desktop
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  $('#membersBlock').open = !isMobile;
  $('#scheduleBlock').open = !isMobile;

  populateMonthOptions(j);
  updateMonthHint();

  renderMembers(j);
  renderSchedule(j);
  updateMembersSummary(j);
  updateScheduleSummary(j);

  $('#details').classList.remove('hidden');
  window.scrollTo({top:0, behavior:'smooth'});
}

/* ---------- Helpers ---------- */
function monthAssignedTotal(j, month){
  return j.members.filter(m=>Number(m.month)===Number(month))
                  .reduce((s,m)=>s+Number(m.entitlement||0),0);
}
function maxMonthlyForMonth(j, month){
  const remaining = Math.max(0, j.goal - monthAssignedTotal(j, month));
  return Math.floor(remaining / j.duration);
}

/* Summaries for collapsible sections */
function updateMembersSummary(j){
  const txt = $('#mSummaryText');
  if (!txt) return;
  txt.textContent = `الأعضاء (${fmtInt(j.members.length)})`;
}
function updateScheduleSummary(j){
  const txt = $('#sSummaryText');
  if (!txt) return;
  txt.textContent = `الجدول الشهري (${fmtInt(j.duration)} شهر)`;
}

/* Build month options with "max monthly" and FULL state */
function populateMonthOptions(j){
  const select = $('#m-month');
  const current = select.value;
  select.innerHTML = '';

  for (let i=1; i<=j.duration; i++){
    const maxMonthly = maxMonthlyForMonth(j, i);
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${monthLabel(j.startDate, i)} · Max monthly: ${fmtMoney(maxMonthly)} SAR${maxMonthly<=0?' · FULL':''}`;
    if (maxMonthly <= 0) option.disabled = true;
    select.appendChild(option);
  }

  if (current && Number(current) >= 1 && Number(current) <= j.duration) {
    select.value = current;
  }
}

/* ---------- Edit Jamiyah ---------- */
function onSaveEdit(e){
  e.preventDefault();
  setError('err-e-name'); setError('err-e-goal');

  const j = currentJamiyah(); if (!j) return;

  const newName = $('#e-name').value.trim();
  const newGoal = parseInt($('#e-goal').value);
  const newStart = $('#e-start').value;
  const newDuration = parseInt($('#e-duration').value);
  const started = hasStarted(j);

  if (!newName){ setError('err-e-name','required'); return; }
  if (state.jamiyahs.some(x=>x.id!==j.id && x.name===newName)) { setError('err-e-name','name exists'); return; }
  if (!newGoal || newGoal<=0){ setError('err-e-goal','> 0'); return; }

  if (!started){
    if (!newStart){ toast('حدد تاريخ البداية'); return; }
    if (!newDuration || newDuration<1){ toast('المدة غير صحيحة'); return; }

    if (newDuration !== j.duration){
      j.members = j.members.map(m => ({
        ...m,
        entitlement: Number(m.pay || 0) * newDuration,
        month: Math.min(m.month, newDuration)
      }));
    }
    j.startDate = newStart;
    j.duration = newDuration;
  }

  j.name = newName;
  j.goal = newGoal;
  saveAll();

  openDetails(j.id);
  renderList();
  $('#editBlock').open = false;
  toast('تم حفظ التعديلات');
}

/* ---------- Members ---------- */
function renderMembers(j){
  const body = $('#memberTable tbody');
  const empty = $('#emptyMembers');
  body.innerHTML = '';

  if (j.members.length === 0){
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
  }

  j.members
    .sort((a,b)=>a.month-b.month || a.name.localeCompare(b.name))
    .forEach((m,idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtInt(idx+1)}</td>
        <td>${m.name}</td>
        <td>${fmtMoney(m.pay)}</td>
        <td>${fmtMoney(m.entitlement)}</td>
        <td>${monthLabel(j.startDate, m.month)}</td>
        <td><button class="btn danger btn-sm" data-id="${m.id}">حذف</button></td>
      `;
      tr.querySelector('button').addEventListener('click', ()=>{
        const jx = currentJamiyah(); if (!jx) return;
        if (hasStarted(jx)) { toast('بدأت الجمعية. لا يمكن تعديل الأعضاء.'); return; }
        if (!confirm(`حذف ${m.name}؟`)) return;
        jx.members = jx.members.filter(x=>x.id!==m.id);
        saveAll();
        renderMembers(jx);
        renderSchedule(jx);
        renderList();
        populateMonthOptions(jx);
        updateMonthHint();
        updateMembersSummary(jx);
        toast('تم حذف العضو');
      });
      body.appendChild(tr);
    });

  updateMembersSummary(j);
}

/* ---------- Add member ---------- */
function onAddMember(e){
  e.preventDefault();
  setError('err-m-name'); setError('err-m-pay'); setError('err-m-month');

  const j = currentJamiyah();
  if (!j) return;
  if (hasStarted(j)) { toast('بدأت الجمعية. لا يمكن إضافة أعضاء جدد.'); return; }

  const name  = $('#m-name').value.trim();
  const pay   = parseInt($('#m-pay').value);
  const month = parseInt($('#m-month').value);

  let ok = true;
  if (!name){ setError('err-m-name','required'); ok=false; }
  if (!pay || pay<1){ setError('err-m-pay','min 1'); ok=false; }
  if (!month){ setError('err-m-month','required'); ok=false; }
  if (!ok) return;

  if (month < 1 || month > j.duration) {
    setError('err-m-month', `1..${fmtInt(j.duration)}`); return;
  }

  const maxMonthly = maxMonthlyForMonth(j, month);
  if (pay > maxMonthly) {
    setError('err-m-pay', `max ${fmtMoney(maxMonthly)}`); return;
  }

  const entitlement = pay * j.duration;
  const already = monthAssignedTotal(j, month);
  const remaining = j.goal - already;
  if (entitlement > remaining) {
    setError('err-m-pay', `exceeds by ${fmtMoney(entitlement-remaining)}`); return;
  }

  j.members.push({ id: uid(), name, pay, month, entitlement });
  saveAll();

  e.target.reset();
  populateMonthOptions(j);
  renderMembers(j);
  renderSchedule(j);
  renderList();
  updateMonthHint();
  updateMembersSummary(j);
  toast('تمت إضافة العضو');
}

/* ---------- Schedule ---------- */
function renderSchedule(j){
  const body = $('#scheduleTable tbody');
  body.innerHTML = '';

  for (let i=0;i<j.duration;i++){
    const monthIndex = i+1;
    const date = addMonths(j.startDate, i);
    const receivers = j.members
      .filter(m=>Number(m.month)===monthIndex)
      .sort((a,b)=>a.name.localeCompare(b.name));

    const totalAssigned = receivers.reduce((s,m)=>s+Number(m.entitlement||0),0);
    const remaining = Math.max(0, j.goal - totalAssigned);

    const receiversText = receivers.length
      ? receivers.map(r=>`${r.name} (${fmtMoney(r.entitlement)})`).join('، ')
      : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${monthLabel(j.startDate, monthIndex)}</td>
      <td>${date}</td>
      <td>${receiversText}</td>
      <td>المصروف: ${fmtMoney(totalAssigned)} · المتبقي: ${fmtMoney(remaining)}</td>
    `;
    body.appendChild(tr);
  }

  updateScheduleSummary(j);
}

/* ---------- Live hint ---------- */
function updateMonthHint(){
  const j = currentJamiyah();
  const hint = $('#monthHint');
  const sel = $('#m-month');
  if (!j || !sel || !sel.value) { hint.textContent = ''; return; }

  const monthVal = parseInt(sel.value);
  const maxMonthly = maxMonthlyForMonth(j, monthVal);
  const pay = parseInt($('#m-pay').value || '0');

  let line = `Max monthly in ${monthLabel(j.startDate, monthVal)}: ${fmtMoney(maxMonthly)} SAR`;
  if (pay) {
    if (pay > maxMonthly) line += ` · Your input (${fmtMoney(pay)}) is above max`;
    else line += ` · Your input (${fmtMoney(pay)}) is within max`;
  }
  hint.textContent = line;
}

/* ---------- Delete ---------- */
function onDeleteJamiyah(){
  const j = currentJamiyah(); if (!j) return;
  if (!confirm(`حذف ${j.name}؟ لا يمكن التراجع.`)) return;

  state.jamiyahs = state.jamiyahs.filter(x=>x.id!==j.id);
  saveAll();
  showList();
  renderList();
  toast('تم حذف الجمعية');
}

/* ---------- Export / Import ---------- */
function onExport(){
  const j = currentJamiyah(); if (!j) return;
  const data = JSON.stringify(j, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${j.name.replace(/\s+/g,'_')}.jamiyati.json`;
  document.body.appendChild(a);
  a.click();
  a.remove(); URL.revokeObjectURL(url);
  toast('تم تصدير الجمعية');
}
function onImport(e){
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const obj = JSON.parse(reader.result);
      if (!obj || !obj.name || !obj.startDate || !obj.duration) throw new Error('bad file');
      let base = obj.name, n=1;
      while(state.jamiyahs.some(x=>x.name === obj.name)){ obj.name = `${base} (${++n})`; }
      obj.id = uid();
      state.jamiyahs.push(obj);
      saveAll();
      renderList();
      openDetails(obj.id);
      toast('تم الاستيراد');
    }catch(err){ toast('ملف غير صالح'); }
  };
  reader.readAsText(file);
}

/* ---------- Back ---------- */
function showList(){
  $('#details').classList.add('hidden');
}