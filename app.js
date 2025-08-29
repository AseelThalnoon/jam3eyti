/* جمعيتي v0.1 - LocalStorage SPA */
/* Data shape:
  jamiyah = {
    id, name, startDate, duration, goal,
    members: [{id, name, pay, month}],
    createdAt
  }
*/

const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const SKEY = "jamiyati:v01";

const state = {
  jamiyahs: loadAll(),
  currentId: null,
};

function loadAll() {
  try { return JSON.parse(localStorage.getItem(SKEY)) || []; }
  catch { return []; }
}
function saveAll() {
  localStorage.setItem(SKEY, JSON.stringify(state.jamiyahs));
}

function uid() { return Math.random().toString(36).slice(2,10); }
function fmtMoney(n){ return Number(n||0).toLocaleString('ar-EG'); }
function addMonths(dateStr, i){
  const d = new Date(dateStr);
  d.setMonth(d.getMonth()+i);
  return d.toISOString().slice(0,10);
}
function hasStarted(j){
  const today = new Date().setHours(0,0,0,0);
  const start = new Date(j.startDate).setHours(0,0,0,0);
  return today >= start;
}

/* UI wiring */
document.addEventListener('DOMContentLoaded', () => {
  // Forms
  $('#jamiyahForm').addEventListener('submit', onCreateJamiyah);
  $('#memberForm').addEventListener('submit', onAddMember);
  $('#deleteJamiyah').addEventListener('click', onDeleteJamiyah);
  $('#backBtn').addEventListener('click', () => showList());

  renderList();
});

/* Create Jamiyah */
function onCreateJamiyah(e){
  e.preventDefault();
  const name = $('#j-name').value.trim();
  const startDate = $('#j-start').value;
  const duration = parseInt($('#j-duration').value);
  const goal = parseInt($('#j-goal').value || 0);

  if (!name || !startDate || !duration) return;

  // Enforce unique name
  if (state.jamiyahs.some(j=>j.name === name)){
    alert('يوجد جمعية بنفس الاسم. اختر اسماً مختلفاً.');
    return;
  }

  const jamiyah = {
    id: uid(),
    name, startDate, duration, goal,
    members: [],
    createdAt: Date.now()
  };
  state.jamiyahs.push(jamiyah);
  saveAll();

  // reset
  e.target.reset();
  renderList();
}

/* List Jamiyahs */
function renderList(){
  const list = $('#jamiyahList');
  list.innerHTML = '';

  if (state.jamiyahs.length === 0){
    list.innerHTML = `<div class="item"><span>لا توجد جمعيات بعد.</span></div>`;
    $('#details').classList.add('hidden');
    return;
  }

  state.jamiyahs.forEach(j=>{
    const totalMonthly = j.members.reduce((s,m)=>s+Number(m.pay),0);
    const btn = document.createElement('div');
    btn.className = 'item';
    btn.innerHTML = `
      <div>
        <div><strong>${j.name}</strong></div>
        <div class="meta">
          من ${j.startDate} لمدة ${j.duration} شهر
          · مساهمة شهرية إجمالية: ${fmtMoney(totalMonthly)}
          ${j.goal ? `· الهدف: ${fmtMoney(j.goal)}`:''}
        </div>
      </div>
      <button class="btn" data-id="${j.id}">فتح</button>
    `;
    btn.querySelector('button').addEventListener('click', ()=> openDetails(j.id));
    list.appendChild(btn);
  });
}

/* Open details */
function openDetails(id){
  state.currentId = id;
  const j = state.jamiyahs.find(x=>x.id===id);
  if (!j) return;

  $('#d-title').textContent = j.name;
  $('#d-period').textContent = `من ${j.startDate} لمدة ${j.duration} شهر`;
  $('#d-goal').textContent = j.goal ? `الهدف: ${fmtMoney(j.goal)}` : 'بدون هدف محدد';

  // lock adding members if started
  const started = hasStarted(j);
  $('#startedAlert').hidden = !started;
  $('#memberForm').querySelectorAll('input,button').forEach(el => {
    el.disabled = started;
  });

  // set max month hint
  $('#m-month').placeholder = `1 إلى ${j.duration}`;

  // members table
  renderMembers(j);
  // schedule
  renderSchedule(j);

  $('#details').classList.remove('hidden');
  window.scrollTo({top:0, behavior:'smooth'});
}

/* Render members */
function renderMembers(j){
  const body = $('#memberTable tbody');
  body.innerHTML = '';
  j.members
    .sort((a,b)=>a.month-b.month || a.name.localeCompare(b.name))
    .forEach((m,idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx+1}</td>
        <td>${m.name}</td>
        <td>${fmtMoney(m.pay)}</td>
        <td>${m.month}</td>
        <td><button class="btn danger btn-sm" data-id="${m.id}">حذف</button></td>
      `;
      tr.querySelector('button').addEventListener('click', ()=>{
        // If started, block removal
        if (hasStarted(j)) { alert('بدأت الجمعية. لا يمكن تعديل الأعضاء.'); return; }
        j.members = j.members.filter(x=>x.id!==m.id);
        saveAll();
        renderMembers(j);
        renderSchedule(j);
        renderList();
      });
      body.appendChild(tr);
    });
}

/* Add member */
function onAddMember(e){
  e.preventDefault();
  const j = state.jamiyahs.find(x=>x.id===state.currentId);
  if (!j) return;
  if (hasStarted(j)) { alert('بدأت الجمعية. لا يمكن إضافة أعضاء جدد.'); return; }

  const name = $('#m-name').value.trim();
  const pay  = parseInt($('#m-pay').value);
  const month = parseInt($('#m-month').value);

  if (!name || !pay || !month) return;
  if (month < 1 || month > j.duration) {
    alert(`شهر الاستلام يجب أن يكون بين 1 و ${j.duration}.`);
    return;
  }

  // Rule: prevent duplicate receiver month
  if (j.members.some(m=>m.month===month)) {
    alert('هذا الشهر محجوز لعضو آخر. اختر شهراً مختلفاً.');
    return;
  }

  j.members.push({ id: uid(), name, pay, month });
  saveAll();

  e.target.reset();
  renderMembers(j);
  renderSchedule(j);
  renderList();
}

/* Schedule */
function renderSchedule(j){
  const body = $('#scheduleTable tbody');
  body.innerHTML = '';

  // total monthly pot = sum of contributions
  const monthlyTotal = j.members.reduce((s,m)=>s+Number(m.pay),0);

  for (let i=0;i<j.duration;i++){
    const monthIndex = i+1;
    const date = addMonths(j.startDate, i);
    const receiver = j.members.find(m=>m.month===monthIndex);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${monthIndex}</td>
      <td>${date}</td>
      <td>${receiver ? receiver.name : '—'}</td>
      <td>${fmtMoney(monthlyTotal)}</td>
    `;
    body.appendChild(tr);
  }
}

/* Delete jamiyah */
function onDeleteJamiyah(){
  const id = state.currentId;
  const j = state.jamiyahs.find(x=>x.id===id);
  if (!j) return;
  if (!confirm(`حذف ${j.name}؟ لا يمكن التراجع.`)) return;

  state.jamiyahs = state.jamiyahs.filter(x=>x.id!==id);
  saveAll();
  showList();
}

/* Back to list */
function showList(){
  $('#details').classList.add('hidden');
  renderList();
}