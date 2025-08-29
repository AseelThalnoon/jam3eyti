/* جمعيتي v0.3 - أرقام بالإنجليزية + اختيار شهر من قائمة */
/* Monthly cap = goal, multiple receivers per month */

const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const SKEY = "jamiyati:v02"; // نفس المفتاح، البيانات السابقة تبقى صالحة

const state = {
  jamiyahs: loadAll(),
  currentId: null,
};

/* ------- Formatting (English digits) ------- */
function fmtMoney(n){ return Number(n||0).toLocaleString('en-US'); }
function fmtInt(n){ return Number(n||0).toLocaleString('en-US'); }

/* ------- Migration from v0.1 if present ------- */
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

function uid() { return Math.random().toString(36).slice(2,10); }
function addMonths(dateStr, i){ const d = new Date(dateStr); d.setMonth(d.getMonth()+i); return d.toISOString().slice(0,10); }
function hasStarted(j){ const today = new Date().setHours(0,0,0,0); const start = new Date(j.startDate).setHours(0,0,0,0); return today >= start; }

/* ------- UI wiring ------- */
document.addEventListener('DOMContentLoaded', () => {
  $('#jamiyahForm').addEventListener('submit', onCreateJamiyah);
  $('#memberForm').addEventListener('submit', onAddMember);
  $('#deleteJamiyah').addEventListener('click', onDeleteJamiyah);
  $('#backBtn').addEventListener('click', () => showList());

  // Live hint when month or pay changes
  $('#m-month').addEventListener('change', updateMonthHint);
  $('#m-pay').addEventListener('input', updateMonthHint);

  renderList();
});

/* ------- Create Jamiyah ------- */
function onCreateJamiyah(e){
  e.preventDefault();
  const name = $('#j-name').value.trim();
  const startDate = $('#j-start').value;
  const duration = parseInt($('#j-duration').value);
  const goal = parseInt($('#j-goal').value);

  if (!name || !startDate || !duration || !goal) return;
  if (goal <= 0) { alert('حدد مبلغ الهدف الشهري أكبر من صفر.'); return; }

  if (state.jamiyahs.some(j=>j.name === name)){
    alert('يوجد جمعية بنفس الاسم. اختر اسماً مختلفاً.');
    return;
  }

  const jamiyah = { id: uid(), name, startDate, duration, goal, members: [], createdAt: Date.now() };
  state.jamiyahs.push(jamiyah);
  saveAll();

  e.target.reset();
  renderList();
}

/* ------- List Jamiyahs ------- */
function renderList(){
  const list = $('#jamiyahList');
  list.innerHTML = '';

  if (state.jamiyahs.length === 0){
    list.innerHTML = `<div class="item"><span>لا توجد جمعيات بعد.</span></div>`;
    $('#details').classList.add('hidden');
    return;
  }

  state.jamiyahs.forEach(j=>{
    const totalEntitlement = j.members.reduce((s,m)=>s+Number(m.entitlement||0),0);
    const btn = document.createElement('div');
    btn.className = 'item';
    btn.innerHTML = `
      <div>
        <div><strong>${j.name}</strong></div>
        <div class="meta">
          من ${j.startDate} لمدة ${fmtInt(j.duration)} شهر
          · <span class="badge">الهدف الشهري: ${fmtMoney(j.goal)}</span>
          · <span class="badge">مجموع الاستحقاقات: ${fmtMoney(totalEntitlement)}</span>
        </div>
      </div>
      <button class="btn" data-id="${j.id}">فتح</button>
    `;
    btn.querySelector('button').addEventListener('click', ()=> openDetails(j.id));
    list.appendChild(btn);
  });
}

/* ------- Open details ------- */
function openDetails(id){
  state.currentId = id;
  const j = state.jamiyahs.find(x=>x.id===id);
  if (!j) return;

  $('#d-title').textContent = j.name;
  $('#d-period').textContent = `من ${j.startDate} لمدة ${fmtInt(j.duration)} شهر`;
  $('#d-goal').textContent = `الهدف الشهري: ${fmtMoney(j.goal)}`;

  const started = hasStarted(j);
  $('#startedAlert').hidden = !started;
  // تأكد أننا نعطل select أيضًا
  $('#memberForm').querySelectorAll('input,button,select').forEach(el => { el.disabled = started; });

  // بناء خيارات الأشهر
  populateMonthOptions(j);
  updateMonthHint();

  renderMembers(j);
  renderSchedule(j);

  $('#details').classList.remove('hidden');
  window.scrollTo({top:0, behavior:'smooth'});
}

/* ------- Helpers for monthly cap logic ------- */
function monthAssignedTotal(j, month){
  return j.members.filter(m=>Number(m.month)===Number(month))
                  .reduce((s,m)=>s+Number(m.entitlement||0),0);
}

/* تعبئة قائمة الأشهر المتاحة مع المتبقي لكل شهر */
function populateMonthOptions(j){
  const select = $('#m-month');
  const current = select.value; // احتفظ بالاختيار لو كان موجود
  select.innerHTML = '';
  for (let i=1; i<=j.duration; i++){
    const already = monthAssignedTotal(j, i);
    const remaining = Math.max(0, j.goal - already);
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `شهر ${fmtInt(i)} · المتبقي: ${fmtMoney(remaining)}`;
    select.appendChild(option);
  }
  // حاول ترجع الاختيار السابق إن كان صالح
  if (current && Number(current) >= 1 && Number(current) <= j.duration) {
    select.value = current;
  }
}

/* ------- Render members ------- */
function renderMembers(j){
  const body = $('#memberTable tbody');
  body.innerHTML = '';
  j.members
    .sort((a,b)=>a.month-b.month || a.name.localeCompare(b.name))
    .forEach((m,idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtInt(idx+1)}</td>
        <td>${m.name}</td>
        <td>${fmtMoney(m.pay)}</td>
        <td>${fmtMoney(m.entitlement)}</td>
        <td>${fmtInt(m.month)}</td>
        <td><button class="btn danger btn-sm" data-id="${m.id}">حذف</button></td>
      `;
      tr.querySelector('button').addEventListener('click', ()=>{
        const jx = state.jamiyahs.find(x=>x.id===state.currentId);
        if (!jx) return;
        if (hasStarted(jx)) { alert('بدأت الجمعية. لا يمكن تعديل الأعضاء.'); return; }
        jx.members = jx.members.filter(x=>x.id!==m.id);
        saveAll();
        renderMembers(jx);
        renderSchedule(jx);
        renderList();
        populateMonthOptions(jx);
        updateMonthHint();
      });
      body.appendChild(tr);
    });
}

/* ------- Add member ------- */
function onAddMember(e){
  e.preventDefault();
  const j = state.jamiyahs.find(x=>x.id===state.currentId);
  if (!j) return;
  if (hasStarted(j)) { alert('بدأت الجمعية. لا يمكن إضافة أعضاء جدد.'); return; }

  const name  = $('#m-name').value.trim();
  const pay   = parseInt($('#m-pay').value);
  const month = parseInt($('#m-month').value);

  if (!name || !pay || !month) return;
  if (month < 1 || month > j.duration) {
    alert(`شهر الاستلام يجب أن يكون بين 1 و ${fmtInt(j.duration)}.`);
    return;
  }

  // Compute entitlement and enforce monthly cap by goal
  const entitlement = pay * j.duration;
  const already = monthAssignedTotal(j, month);
  const remaining = j.goal - already;

  if (entitlement > remaining) {
    alert(`السقف الشهري (${fmtMoney(j.goal)}) لا يكفي لهذا الاستحقاق.\nالمتبقي في شهر ${fmtInt(month)}: ${fmtMoney(remaining)}.\nاختر شهرًا آخر أو خفّض المساهمة.`);
    return;
  }

  j.members.push({ id: uid(), name, pay, month, entitlement });
  saveAll();

  e.target.reset();
  renderMembers(j);
  renderSchedule(j);
  renderList();
  populateMonthOptions(j);
  updateMonthHint();
}

/* ------- Schedule ------- */
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
      <td>${fmtInt(monthIndex)}</td>
      <td>${date}</td>
      <td>${receiversText}</td>
      <td>المصروف: ${fmtMoney(totalAssigned)} · المتبقي: ${fmtMoney(remaining)}</td>
    `;
    body.appendChild(tr);
  }
}

/* ------- Live month hint under input ------- */
function updateMonthHint(){
  const j = state.jamiyahs.find(x=>x.id===state.currentId);
  const hint = $('#monthHint');
  const sel = $('#m-month');
  if (!j || !sel || !sel.value) { hint.textContent = ''; return; }

  const monthVal = parseInt(sel.value);
  const already = monthAssignedTotal(j, monthVal);
  const remaining = Math.max(0, j.goal - already);
  const pay = parseInt($('#m-pay').value || '0');
  const ent = pay && j.duration ? pay * j.duration : 0;

  hint.textContent = `المتبقي في شهر ${fmtInt(monthVal)}: ${fmtMoney(remaining)}${ent ? ` · استحقاقك المتوقع: ${fmtMoney(ent)}` : ''}`;
}

/* ------- Delete jamiyah ------- */
function onDeleteJamiyah(){
  const id = state.currentId;
  const j = state.jamiyahs.find(x=>x.id===id);
  if (!j) return;
  if (!confirm(`حذف ${j.name}؟ لا يمكن التراجع.`)) return;

  state.jamiyahs = state.jamiyahs.filter(x=>x.id!==id);
  saveAll();
  showList();
}

/* ------- Back to list ------- */
function showList(){
  $('#details').classList.add('hidden');
  renderList();
}