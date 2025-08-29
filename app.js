/* v1.5.2 — Hot-fix: guaranteed openDetails
   - Event delegation on list, open after create, #details guard
   - Payments tracking + dashboard actuals + schedule ✓/✗ + PDF summary
*/

const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const SKEY = "jamiyati:v02";

const state = {
  jamiyahs: loadAll(),
  currentId: null,
  filter: "",
  memberSearch: "",
  memberSort: "month",
  scheduleFilter: "all"
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

/* ---------- Storage ---------- */
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
function uid(){ return Math.random().toString(36).slice(2,10); }
function addMonths(dateStr,i){ const d=new Date(dateStr); d.setMonth(d.getMonth()+i); return d.toISOString().slice(0,10); }
function hasStarted(j){ const today=new Date().setHours(0,0,0,0); const start=new Date(j.startDate).setHours(0,0,0,0); return today>=start; }
function currentJamiyah(){ return state.jamiyahs.find(x=>x.id===state.currentId); }
function toast(msg){ const box=$('#toasts'); const el=document.createElement('div'); el.className='toast'; el.textContent=msg; box.appendChild(el); setTimeout(()=>el.remove(),2200); }
function setError(id,text){ const el=$(`#${id}`); if(el) el.textContent=text||''; }

function monthToFirstDay(monthStr){
  if(!monthStr) return "";
  const [y,m]=monthStr.split('-');
  if(!y||!m) return "";
  return `${y}-${String(m).padStart(2,'0')}-01`;
}

/* ---------- Show/Hide helpers ---------- */
function show(el){ if(el) el.classList.remove('hidden'); }
function hide(el){ if(el) el.classList.add('hidden'); }
function toggle(id, on){ const el=document.getElementById(id); if(!el) return; on?show(el):hide(el); }
function setDetailsSectionsVisible(on){
  toggle('editBlock', on);
  toggle('addMemberBlock', on);
  toggle('membersBlock', on);
  toggle('scheduleBlock', on);
}

/* ---------- Payments helpers ---------- */
function ensurePayments(j, m){
  if (!Array.isArray(m.payments)) m.payments = [];
  for (let i = 0; i < j.duration; i++){
    if (typeof m.payments[i] !== 'boolean') m.payments[i] = false;
  }
  if (m.payments.length > j.duration) m.payments = m.payments.slice(0, j.duration);
  return m.payments;
}
function paidMonthsCount(j, m){
  ensurePayments(j, m);
  return m.payments.reduce((s, p) => s + (p ? 1 : 0), 0);
}
function memberPaidAmount(j, m){
  return paidMonthsCount(j, m) * Number(m.pay || 0);
}
function collectedActual(j){
  return j.members.reduce((s, m) => s + memberPaidAmount(j, m), 0);
}

/* ---------- Dashboard helpers ---------- */
function monthsElapsedFromStart(j){
  const start = new Date(j.startDate);
  const today = new Date();
  if (today < start) return 0;
  let months = (today.getFullYear() - start.getFullYear())*12 + (today.getMonth() - start.getMonth()) + 1;
  return Math.min(Math.max(months, 0), j.duration);
}
function nextPayoutIndex(j){
  const m = monthsElapsedFromStart(j);
  if (m < 1) return 1;
  if (m >= j.duration) return null;
  return m + 1;
}
function renderDashboard(){
  const grid = document.getElementById('dashboardGrid');
  const empty = document.getElementById('dashboardEmpty');
  if (!grid || !empty) return;

  const items = state.jamiyahs.slice().sort((a,b)=>a.name.localeCompare(b.name));
  grid.innerHTML = '';
  empty.classList.toggle('hidden', items.length > 0);

  items.forEach(j => {
    const membersCount = j.members.length;
    const collected = collectedActual(j); // actual
    const allowedSoFar = j.goal * monthsElapsedFromStart(j); // plan baseline
    const denom = Math.max(allowedSoFar, 1);
    const pct = Math.min(100, Math.round((collected / denom) * 100));
    const nextIdx = nextPayoutIndex(j);
    const nextText = nextIdx ? monthLabel(j.startDate, nextIdx) : '—';

    const card = document.createElement('div');
    card.className = 'dash-card';
    card.innerHTML = `
      <div class="dash-card__head">
        <div class="dash-card__title">${j.name}</div>
        <span class="badge">${hasStarted(j) ? 'Started' : 'Not started'}</span>
      </div>
      <div class="dash-row">
        <span class="badge">المدة: ${fmtInt(j.duration)} شهر</span>
        <span class="badge">الأعضاء: ${fmtInt(membersCount)}</span>
        <span class="badge">الهدف الشهري: ${fmtMoney(j.goal)} SAR</span>
        <span class="badge">التالي: ${nextText}</span>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px;">
          <span>Actual collected</span>
          <span>${fmtMoney(collected)} / ${fmtMoney(allowedSoFar)} SAR</span>
        </div>
        <div class="progress"><div class="progress__bar" style="width:${pct}%;"></div></div>
      </div>
      <div class="dash-actions">
        <button class="btn secondary" data-id="${j.id}">فتح</button>
        <button class="btn ghost">تصدير</button>
      </div>
    `;
    const exportBtn = card.querySelector('.btn.ghost');
    exportBtn.addEventListener('click', () => exportPdf(j));
    grid.appendChild(card);
  });
}

/* ---------- DOM Ready ---------- */
document.addEventListener('DOMContentLoaded', () => {
  hide($('#details'));
  setDetailsSectionsVisible(false);

  /* Create */
  $('#jamiyahForm').addEventListener('submit', onCreateJamiyah);

  /* Member add */
  $('#memberForm').addEventListener('submit', onAddMember);

  /* Nav */
  $('#deleteJamiyah').addEventListener('click', onDeleteJamiyah);
  $('#backBtn').addEventListener('click', showList);

  /* Edit */
  $('#editForm').addEventListener('submit', onSaveEdit);
  $('#cancelEdit').addEventListener('click', (e)=>{ e.preventDefault(); $('#editBlock').open=false; });

  /* Search (list) */
  $('#search').addEventListener('input', (e)=>{ state.filter=(e.target.value||'').trim(); renderList(); renderDashboard(); });

  /* Export PDF (details header) */
  $('#exportBtn').addEventListener('click', ()=> exportPdf(currentJamiyah()));

  /* Live hints for add-member */
  $('#m-month').addEventListener('change', updateMonthHint);
  $('#m-pay').addEventListener('input', updateMonthHint);

  /* Members toolbar */
  $('#memberSearch').addEventListener('input', (e)=>{ state.memberSearch=(e.target.value||'').trim(); renderMembers(currentJamiyah()); });
  $('#memberSort').addEventListener('change', (e)=>{ state.memberSort=e.target.value; renderMembers(currentJamiyah()); });

  /* Schedule filter */
  $('#scheduleFilter').addEventListener('change', (e)=>{ state.scheduleFilter=e.target.value; renderSchedule(currentJamiyah()); });

  /* HOT-FIX: event delegation for any "فتح" in the list */
  document.getElementById('jamiyahList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    e.preventDefault();
    try { openDetails(btn.dataset.id); }
    catch (err) { console.error('openDetails failed:', err); alert('Error opening jamiyah. Check console.'); }
  });

  renderList();
  renderDashboard();

  /* Optional: auto-open if exactly one jamiyah */
  try {
    if (state.jamiyahs.length === 1) { openDetails(state.jamiyahs[0].id); }
  } catch(e){ console.error(e); }
});

/* ---------- Create Jamiyah ---------- */
function onCreateJamiyah(e){
  e.preventDefault();
  setError('err-j-name'); setError('err-j-start'); setError('err-j-duration'); setError('err-j-goal');

  const name=$('#j-name').value.trim();
  const startMonth=$('#j-start').value; // YYYY-MM
  const duration=parseInt($('#j-duration').value);
  const goal=parseInt($('#j-goal').value);

  let ok=true;
  if(!name){ setError('err-j-name','required'); ok=false; }
  if(!startMonth){ setError('err-j-start','required'); ok=false; }
  if(!duration||duration<1){ setError('err-j-duration','min 1'); ok=false; }
  if(!goal||goal<=0){ setError('err-j-goal','> 0'); ok=false; }
  if(!ok) return;

  const startDate=monthToFirstDay(startMonth);
  if(state.jamiyahs.some(j=>j.name===name)){ setError('err-j-name','name already exists'); return; }

  const jamiyah={ id:uid(), name, startDate, duration, goal, members:[], createdAt:Date.now() };
  state.jamiyahs.push(jamiyah);
  saveAll();

  e.target.reset();
  toast('تم إنشاء الجمعية');
  renderList();
  renderDashboard();

  /* HOT-FIX: open immediately */
  try { openDetails(jamiyah.id); } catch(e){ console.error(e); }
}

/* ---------- List Jamiyahs ---------- */
function renderList(){
  const list=$('#jamiyahList'); const empty=$('#emptyList'); const pill=$('#jamiyahCountPill');
  const items=state.jamiyahs.filter(j=>!state.filter||j.name.includes(state.filter)).sort((a,b)=>a.name.localeCompare(b.name));
  list.innerHTML=''; pill.textContent=fmtInt(items.length);
  if(items.length===0){ empty.classList.remove('hidden'); } else { empty.classList.add('hidden'); }

  items.forEach(j=>{
    const totalEntitlement=j.members.reduce((s,m)=>s+Number(m.entitlement||0),0);
    const row=document.createElement('div');
    row.className='item';
    row.innerHTML=`
      <div>
        <div><strong>${j.name}</strong></div>
        <div class="meta">
          <span>من ${j.startDate} لمدة ${fmtInt(j.duration)} شهر</span>
          <span class="badge">الهدف الشهري: ${fmtMoney(j.goal)}</span>
          <span class="badge">${startedStatus(j)}</span>
          <span class="badge">مجموع الاستحقاقات: ${fmtMoney(totalEntitlement)}</span>
        </div>
      </div>
      <button class="btn secondary" data-id="${j.id}">فتح</button>
    `;
    list.appendChild(row); // click handled by delegated listener
  });

  if(!state.currentId){ hide($('#details')); setDetailsSectionsVisible(false); }
}

/* ---------- Guard: require #details ---------- */
function _requireDetails(){
  const el = document.getElementById('details');
  if (!el) { throw new Error('#details not found in DOM'); }
  return el;
}
window._debugOpenFirst = function(){
  if (!state.jamiyahs.length) { alert('No jamiyahs yet'); return; }
  openDetails(state.jamiyahs[0].id);
};

/* ---------- OPEN DETAILS (uses guard) ---------- */
function openDetails(id){
  state.currentId = id;
  const j = currentJamiyah();

  if(!j){
    hide($('#details'));
    setDetailsSectionsVisible(false);
    toast('تعذّر فتح الجمعية');
    return;
  }

  // Header
  $('#d-title').textContent  = j.name;
  $('#d-period').textContent = `من ${j.startDate} لمدة ${fmtInt(j.duration)} شهر`;
  $('#d-goal').textContent   = `الهدف الشهري: ${fmtMoney(j.goal)}`;
  $('#d-status').textContent = startedStatus(j);

  // Started guard
  const started = hasStarted(j);
  $('#startedAlert').hidden = !started;
  document.querySelectorAll('#memberForm input, #memberForm button, #memberForm select')
    .forEach(el => { el.disabled = started; });

  // Edit form
  $('#e-name').value     = j.name;
  $('#e-goal').value     = j.goal;
  $('#e-start').value    = j.startDate.slice(0,7);
  $('#e-duration').value = j.duration;
  $('#e-start').disabled    = started;
  $('#e-duration').disabled = started;

  // Options / filters
  populateMonthOptions(j);
  populateScheduleFilter(j);
  updateMonthHint();

  // Tables
  renderMembers(j);
  renderSchedule(j);
  updateMembersSummary(j);
  updateScheduleSummary(j);

  // Show details & inner sections
  setDetailsSectionsVisible(true);
  const detailsEl = _requireDetails();
  show(detailsEl);
  detailsEl.scrollIntoView({ behavior:'smooth', block:'start' });
}

/* ---------- Helpers ---------- */
function monthAssignedTotal(j,month){
  return j.members.filter(m=>Number(m.month)===Number(month)).reduce((s,m)=>s+Number(m.entitlement||0),0);
}
function maxMonthlyForMonth(j,month){
  const remaining=Math.max(0,j.goal-monthAssignedTotal(j,month));
  return Math.floor(remaining/j.duration);
}
function colorForMonth(i){
  const colors=["#22c55e","#16a34a","#2dd4bf","#60a5fa","#a78bfa","#f472b6","#f59e0b"];
  return colors[(i-1)%colors.length];
}

/* ---------- Month selects ---------- */
function populateMonthOptions(j){
  const select=$('#m-month'); const current=select.value; select.innerHTML='';
  for(let i=1;i<=j.duration;i++){
    const maxMonthly=maxMonthlyForMonth(j,i);
    const opt=document.createElement('option');
    opt.value=i;
    opt.textContent=`${monthLabel(j.startDate,i)} · Max monthly: ${fmtMoney(maxMonthly)} SAR${maxMonthly<=0?' · FULL':''}`;
    if(maxMonthly<=0) opt.disabled=true;
    select.appendChild(opt);
  }
  if(current && Number(current)>=1 && Number(current)<=j.duration) select.value=current;
}
function populateScheduleFilter(j){
  const sel=$('#scheduleFilter'); const current=state.scheduleFilter; sel.innerHTML='';
  const all=document.createElement('option'); all.value='all'; all.textContent='عرض: كل الشهور'; sel.appendChild(all);
  for(let i=1;i<=j.duration;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=monthLabel(j.startDate,i); sel.appendChild(o); }
  sel.value=current||'all';
}

/* ---------- Edit Jamiyah ---------- */
function onSaveEdit(e){
  e.preventDefault();
  setError('err-e-name'); setError('err-e-goal');

  const j=currentJamiyah(); if(!j) return;

  const newName=$('#e-name').value.trim();
  const newGoal=parseInt($('#e-goal').value);
  const startMonth=$('#e-start').value;
  const newDuration=parseInt($('#e-duration').value);
  const started=hasStarted(j);

  if(!newName){ setError('err-e-name','required'); return; }
  if(state.jamiyahs.some(x=>x.id!==j.id && x.name===newName)){ setError('err-e-name','name exists'); return; }
  if(!newGoal||newGoal<=0){ setError('err-e-goal','> 0'); return; }

  if(!started){
    if(!startMonth){ toast('حدد شهر البداية'); return; }
    if(!newDuration||newDuration<1){ toast('المدة غير صحيحة'); return; }
    const newStart=monthToFirstDay(startMonth);
    if(newDuration!==j.duration){
      j.members=j.members.map(m=>{
        const updated = {
          ...m,
          entitlement:Number(m.pay||0)*newDuration,
          month:Math.min(m.month,newDuration)
        };
        ensurePayments({ duration:newDuration }, updated); // resize payments
        return updated;
      });
    }
    j.startDate=newStart;
    j.duration=newDuration;
  }

  j.name=newName; j.goal=newGoal; saveAll();
  openDetails(j.id);
  renderList();
  renderDashboard();
  $('#editBlock').open=false;
  toast('تم حفظ التعديلات');
}

/* ---------- Members ---------- */
function updateMembersSummary(j){
  $('#mSummaryText').textContent='الأعضاء';
  $('#mCountPill').textContent=fmtInt(j.members.length);
}
function renderMembers(j){
  if(!j) return;
  const body=$('#memberTableBody'); const empty=$('#emptyMembers'); const totPay=$('#totPay'); const totEnt=$('#totEnt');
  body.innerHTML='';

  let rows=j.members.slice();
  if(state.memberSearch){
    const q=state.memberSearch.toLowerCase();
    rows=rows.filter(m=>(m.name||'').toLowerCase().includes(q));
  }
  if(state.memberSort==='name'){ rows.sort((a,b)=>a.name.localeCompare(b.name)||a.month-b.month); }
  else if(state.memberSort==='pay'){ rows.sort((a,b)=>b.pay-a.pay||a.month-b.month); }
  else { rows.sort((a,b)=>a.month-b.month||a.name.localeCompare(b.name)); }

  let totalPay=0,totalEnt=0;
  if(rows.length===0){ empty.classList.remove('hidden'); }
  else{
    empty.classList.add('hidden');
    rows.forEach((m,idx)=>{
      ensurePayments(j, m);
      totalPay+=Number(m.pay||0); totalEnt+=Number(m.entitlement||0);

      const paidAmt = memberPaidAmount(j, m);
      const remainAmt = Math.max(0, Number(m.entitlement||0) - paidAmt);

      const tr=document.createElement('tr'); tr.className='row-accent'; tr.style.borderInlineStartColor=colorForMonth(m.month);
      const cells=[
        ['#',fmtInt(idx+1)],
        ['الاسم',m.name],
        ['المساهمة',fmtMoney(m.pay)],
        ['الاستحقاق الكلي',fmtMoney(m.entitlement)],
        ['مدفوع / متبقي', `${fmtMoney(paidAmt)} / ${fmtMoney(remainAmt)}`],
        ['شهر الاستلام',monthLabel(j.startDate,m.month)],
        ['', ''] // actions
      ];

      cells.forEach(([label,val],i)=>{
        const td=document.createElement('td'); td.setAttribute('data-col',label); td.innerHTML=val;

        if(i===6){
          const wrap=document.createElement('div');
          wrap.style.display='flex'; wrap.style.gap='8px'; wrap.style.flexWrap='wrap';

          const payBtn=document.createElement('button');
          payBtn.className='btn secondary'; payBtn.textContent='المدفوعات';
          payBtn.addEventListener('click',()=>openPaymentsModal(j.id,m.id));

          const delBtn=document.createElement('button');
          delBtn.className='btn danger'; delBtn.textContent='حذف';
          delBtn.addEventListener('click',()=>{
            const jx=currentJamiyah(); if(!jx) return;
            if(hasStarted(jx)){ toast('بدأت الجمعية. لا يمكن تعديل الأعضاء.'); return; }
            if(!confirm(`حذف ${m.name}؟`)) return;
            jx.members=jx.members.filter(x=>x.id!==m.id); saveAll();
            renderMembers(jx); renderSchedule(jx); renderList(); renderDashboard(); populateMonthOptions(jx); updateMonthHint(); updateMembersSummary(jx);
            toast('تم حذف العضو');
          });

          wrap.appendChild(payBtn);
          wrap.appendChild(delBtn);
          td.appendChild(wrap);
        }

        tr.appendChild(td);
      });

      body.appendChild(tr);
    });
  }
  totPay.textContent=fmtMoney(totalPay);
  totEnt.textContent=fmtMoney(totalEnt);
  updateMembersSummary(j);
}

/* ---------- Add member ---------- */
function onAddMember(e){
  e.preventDefault();
  setError('err-m-name'); setError('err-m-pay'); setError('err-m-month');

  const j=currentJamiyah(); if(!j) return;
  if(hasStarted(j)){ toast('بدأت الجمعية. لا يمكن إضافة أعضاء جدد.'); return; }

  const name=$('#m-name').value.trim();
  const pay=parseInt($('#m-pay').value);
  const month=parseInt($('#m-month').value);

  let ok=true;
  if(!name){ setError('err-m-name','required'); ok=false; }
  if(!pay||pay<1){ setError('err-m-pay','min 1'); ok=false; }
  if(!month){ setError('err-m-month','required'); ok=false; }
  if(!ok) return;

  if(month<1 || month>j.duration){ setError('err-m-month',`1..${fmtInt(j.duration)}`); return; }
  const maxMonthly=maxMonthlyForMonth(j,month);
  if(pay>maxMonthly){ setError('err-m-pay',`max ${fmtMoney(maxMonthly)}`); return; }

  const entitlement=pay*j.duration;
  const already=monthAssignedTotal(j,month);
  const remaining=j.goal-already;
  if(entitlement>remaining){ setError('err-m-pay',`exceeds by ${fmtMoney(entitlement-remaining)}`); return; }

  const newMember = { id:uid(), name, pay, month, entitlement };
  ensurePayments(j, newMember); // init payments
  j.members.push(newMember);
  saveAll();

  e.target.reset();
  populateMonthOptions(j);
  renderMembers(j);
  renderSchedule(j);
  renderList();
  renderDashboard();
  updateMonthHint();
  updateMembersSummary(j);
  toast('تمت إضافة العضو');
}

/* ---------- Schedule ---------- */
function updateScheduleSummary(j){
  $('#sSummaryText').textContent='الجدول الشهري';
  $('#sCountPill').textContent=fmtInt(j.duration);
}
function renderSchedule(j){
  if(!j) return;
  const body=$('#scheduleTableBody'); body.innerHTML='';

  const filter=state.scheduleFilter; const months=[];
  for(let i=1;i<=j.duration;i++){ if(filter==='all' || String(i)===filter) months.push(i); }

  months.forEach(i=>{
    const date=addMonths(j.startDate,i-1);
    const receivers=j.members.filter(m=>Number(m.month)===i).sort((a,b)=>a.name.localeCompare(b.name));

    const totalAssigned=receivers.reduce((s,m)=>s+Number(m.entitlement||0),0);
    const remaining=Math.max(0,j.goal-totalAssigned);

    const paidCount = receivers.reduce((s, r) => {
      ensurePayments(j, r);
      return s + (r.payments[i-1] ? 1 : 0);
    }, 0);

    const receiversText = receivers.length
      ? receivers.map(r=>{
          ensurePayments(j, r);
          const mark = r.payments[i-1] ? '✓' : '✗';
          return `${r.name} (${fmtMoney(r.entitlement)}) ${mark}`;
        }).join('، ')
      : '—';

    const tr=document.createElement('tr'); tr.className='row-accent'; tr.style.borderInlineStartColor=colorForMonth(i);
    const cells=[
      ['الشهر',monthLabel(j.startDate,i)],
      ['التاريخ',date],
      ['المستلمون',receiversText],
      ['المصروف · المتبقي',`المصروف: ${fmtMoney(totalAssigned)} · المتبقي: ${fmtMoney(remaining)} · المدفوع لهذا الشهر: ${fmtInt(paidCount)} / ${fmtInt(receivers.length)}`]
    ];
    cells.forEach(([label,val])=>{ const td=document.createElement('td'); td.setAttribute('data-col',label); td.innerHTML=val; tr.appendChild(td); });
    body.appendChild(tr);
  });

  updateScheduleSummary(j);
}

/* ---------- Payments modal ---------- */
let pm_ctx = { jamiyahId: null, memberId: null };

function openPaymentsModal(jid, mid){
  const j = state.jamiyahs.find(x=>x.id===jid); if (!j) return;
  const m = j.members.find(x=>x.id===mid); if (!m) return;
  ensurePayments(j, m);

  pm_ctx = { jamiyahId: jid, memberId: mid };

  $('#pmemberTitle').textContent = `مدفوعات: ${m.name}`;
  $('#pmemberMeta').textContent = `المساهمة الشهرية: ${fmtMoney(m.pay)} SAR · المدة: ${fmtInt(j.duration)} شهر`;

  const grid = $('#pmMonths'); grid.innerHTML = '';
  for (let i=1; i<=j.duration; i++){
    const id = `pm-cb-${i}`;
    const wrap = document.createElement('div');
    wrap.className = 'pmonth';
    wrap.innerHTML = `
      <input type="checkbox" id="${id}" ${m.payments[i-1] ? 'checked' : ''} />
      <label for="${id}">
        <div><strong>${monthLabel(j.startDate, i)}</strong></div>
        <small class="hint">SAR ${fmtMoney(m.pay)}</small>
      </label>
    `;
    grid.appendChild(wrap);
  }

  updatePaymentsModalSums(j, m);

  $('#pmMarkAll').onclick = () => {
    $$('[id^="pm-cb-"]').forEach(cb => cb.checked = true);
    updatePaymentsModalSums(j, m, true);
  };
  $('#pmClearAll').onclick = () => {
    $$('[id^="pm-cb-"]').forEach(cb => cb.checked = false);
    updatePaymentsModalSums(j, m, true);
  };

  grid.onchange = () => updatePaymentsModalSums(j, m, true);

  const dlg = document.getElementById('paymentsModal');
  dlg.showModal();

  $('#pmSave').onclick = (e) => {
    e.preventDefault();
    const checks = $$('[id^="pm-cb-"]').map(cb => cb.checked);
    m.payments = checks;
    saveAll();

    renderMembers(j);
    renderSchedule(j);
    renderDashboard();

    dlg.close();
    toast('تم حفظ المدفوعات');
  };

  $('#pmReset').onclick = (e) => {
    e.preventDefault();
    dlg.close();
  };
}

function updatePaymentsModalSums(j, m, fromUI=false){
  let paidCount;
  if (fromUI){
    paidCount = $$('[id^="pm-cb-"]').reduce((s, cb) => s + (cb.checked?1:0), 0);
  } else {
    paidCount = paidMonthsCount(j, m);
  }
  const paidAmt = paidCount * Number(m.pay||0);
  const remainAmt = Math.max(0, Number(m.entitlement||0) - paidAmt);
  $('#pmPaidSum').textContent = fmtMoney(paidAmt);
  $('#pmRemainSum').textContent = fmtMoney(remainAmt);
}

/* ---------- Export PDF ---------- */
function exportPdf(j){
  if(!j) return;
  const css=`
    <style>
      @page{size:A4;margin:14mm}
      body{font-family:-apple-system,Segoe UI,Roboto,Arial,"Noto Naskh Arabic","IBM Plex Sans Arabic",sans-serif;color:#111}
      header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
      header .brand{display:flex;align-items:center;gap:8px}
      header h1{font-size:20px;margin:0}
      .logo{width:20px;height:20px}
      .meta{color:#555;font-size:12px;margin-bottom:12px}
      h2{margin:18px 0 8px;font-size:16px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:8px;text-align:right;font-size:12px;vertical-align:top}
      thead th{background:#f3f4f6}
      tfoot td{font-weight:700;background:#fafafa}
      .muted{color:#666}
      footer{margin-top:20px;font-size:11px;color:#666;display:flex;justify-content:space-between}
    </style>
  `;
  const members=j.members.slice().sort((a,b)=>a.month-b.month||a.name.localeCompare(b.name));
  const membersRows=members.map((m,i)=>`
    <tr><td>${i+1}</td><td>${m.name}</td><td>${fmtMoney(m.pay)}</td><td>${fmtMoney(m.entitlement)}</td><td>${monthLabel(j.startDate,m.month)}</td></tr>
  `).join('');
  const totPay=members.reduce((s,m)=>s+Number(m.pay||0),0);
  const totEnt=members.reduce((s,m)=>s+Number(m.entitlement||0),0);

  const paymentsRows = j.members.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(m=>{
    ensurePayments(j, m);
    const pc = paidMonthsCount(j, m);
    const paidAmt = pc * Number(m.pay||0);
    const remainAmt = Math.max(0, Number(m.entitlement||0) - paidAmt);
    return `<tr>
      <td>${m.name}</td>
      <td>${fmtInt(pc)} / ${fmtInt(j.duration)}</td>
      <td>${fmtMoney(paidAmt)}</td>
      <td>${fmtMoney(remainAmt)}</td>
    </tr>`;
  }).join('');

  const scheduleRows=Array.from({length:j.duration},(_,k)=>{
    const i=k+1; const rec=j.members.filter(m=>Number(m.month)===i).sort((a,b)=>a.name.localeCompare(b.name));
    const totalAssigned=rec.reduce((s,m)=>s+Number(m.entitlement||0),0); const remaining=Math.max(0,j.goal-totalAssigned);
    const receiversText=rec.length?rec.map(r=>`${r.name} (${fmtMoney(r.entitlement)})`).join('، '):'—';
    return `<tr><td>${monthLabel(j.startDate,i)}</td><td>${addMonths(j.startDate,i-1)}</td><td>${receiversText}</td><td>Spent: ${fmtMoney(totalAssigned)} · Left: ${fmtMoney(remaining)}</td></tr>`;
  }).join('');

  const html=`
    <html dir="rtl" lang="ar">
      <head><meta charset="utf-8" /><title>Jamiyati - ${j.name}</title>${css}</head>
      <body>
        <header>
          <div class="brand">
            <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
              <defs><linearGradient id="lg" x1="0" x2="1"><stop stop-color="#22c55e"/><stop offset="1" stop-color="#16a34a"/></linearGradient></defs>
              <circle cx="64" cy="50" r="22" fill="url(#lg)"></circle>
              <path d="M24 98c8-16 26-26 40-26s32 10 40 26" stroke="#22c55e" stroke-width="8" fill="none" stroke-linecap="round"></path>
            </svg>
            <h1>جمعيتي</h1>
          </div>
          <div class="muted">${new Date().toLocaleDateString('en-GB')}</div>
        </header>

        <div class="meta">
          <div>الاسم: <strong>${j.name}</strong></div>
          <div>الفترة: من ${j.startDate} لمدة ${fmtInt(j.duration)} شهر</div>
          <div>الهدف الشهري: ${fmtMoney(j.goal)} SAR</div>
        </div>

        <h2>الأعضاء</h2>
        <table>
          <thead><tr><th>#</th><th>الاسم</th><th>المساهمة (شهريًا)</th><th>الاستحقاق الكلي</th><th>شهر الاستلام</th></tr></thead>
          <tbody>${membersRows || `<tr><td colspan="5" class="muted">لا يوجد أعضاء</td></tr>`}</tbody>
          <tfoot><tr><td colspan="2">الإجمالي</td><td>${fmtMoney(totPay)}</td><td>${fmtMoney(totEnt)}</td><td></td></tr></tfoot>
        </table>

        <h2>ملخص المدفوعات</h2>
        <table>
          <thead><tr><th>العضو</th><th>أشهر مدفوعة</th><th>مدفوع</th><th>متبقي</th></tr></thead>
          <tbody>${paymentsRows || `<tr><td colspan="4" class="muted">لا يوجد بيانات</td></tr>`}</tbody>
        </table>

        <h2>الجدول الشهري</h2>
        <table>
          <thead><tr><th>الشهر</th><th>التاريخ</th><th>المستلمون</th><th>المصروف · المتبقي</th></tr></thead>
          <tbody>${scheduleRows}</tbody>
        </table>

        <footer>
          <span>© Aseel Thalnoon</span>
          <span>Jamiyati · Generated from web app</span>
        </footer>

        <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}</script>
      </body>
    </html>
  `;
  const w=window.open('','_blank'); w.document.open(); w.document.write(html); w.document.close();
}

/* ---------- Back ---------- */
function showList(){
  hide($('#details'));
  state.currentId=null;
  setDetailsSectionsVisible(false);
}