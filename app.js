/* v1.4.3 — Counters per member: paidCount, remainingCount, overdueCount
   + Modal summary row showing (Paid / Remaining / Overdue now)
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
  scheduleFilter: "all",
  payModal: { memberId: null }
};

/* ---------- Formatting ---------- */
const fmtMoney = (n)=> Number(n||0).toLocaleString('en-US');
const fmtInt   = (n)=> Number(n||0).toLocaleString('en-US');
function monthLabel(startDate, offset){
  const d = new Date(startDate); d.setMonth(d.getMonth() + (offset - 1));
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
const startedStatus = (j)=> hasStarted(j) ? `Started` : `Starts ${j.startDate}`;

/* ---------- Storage & migration ---------- */
function migrateV01toV02(old){
  return (old||[]).map(j=>({
    ...j,
    goal: Number(j.goal||0),
    members: (j.members||[]).map(m=>({
      ...m,
      entitlement: Number.isFinite(m.entitlement) ? Number(m.entitlement) : Number(m.pay||0)*Number(j.duration||0)
    }))
  }));
}
function loadAll(){
  try{
    const v02 = JSON.parse(localStorage.getItem(SKEY));
    if (Array.isArray(v02)) return v02;
    const v01 = JSON.parse(localStorage.getItem("jamiyati:v01"));
    if (Array.isArray(v01)){
      const migrated = migrateV01toV02(v01);
      localStorage.setItem(SKEY, JSON.stringify(migrated));
      return migrated;
    }
    return [];
  }catch{ return []; }
}
function saveAll(){ localStorage.setItem(SKEY, JSON.stringify(state.jamiyahs)); }

/* ---------- Utils ---------- */
const uid = ()=> Math.random().toString(36).slice(2,10);
function addMonths(dateStr, i){ const d=new Date(dateStr); d.setMonth(d.getMonth()+i); return d.toISOString().slice(0,10); }
function hasStarted(j){ const today=new Date().setHours(0,0,0,0); const start=new Date(j.startDate).setHours(0,0,0,0); return today>=start; }
function currentJamiyah(){ return state.jamiyahs.find(x=>x.id===state.currentId); }
function toast(msg){ const box=$('#toasts'); const el=document.createElement('div'); el.className='toast'; el.textContent=msg; box.appendChild(el); setTimeout(()=>el.remove(),2200); }
function setError(id, text){ const el=$(`#${id}`); if(el) el.textContent=text||''; }
function monthToFirstDay(monthStr){ if(!monthStr) return ""; const [y,m]=monthStr.split('-'); if(!y||!m) return ""; return `${y}-${String(m).padStart(2,'0')}-01`; }

/* show/hide manage class + [hidden] */
const show = (el)=>{ if(!el) return; el.classList.remove('hidden'); el.removeAttribute('hidden'); };
const hide = (el)=>{ if(!el) return; el.classList.add('hidden'); el.setAttribute('hidden',''); };

function toggle(id, showIt){ const el=document.getElementById(id); if(!el) return; showIt?show(el):hide(el); }
function setDetailsSectionsVisible(hasOpen){
  toggle('editBlock', hasOpen);
  toggle('addMemberBlock', hasOpen);
  toggle('membersBlock', hasOpen);
  toggle('scheduleBlock', hasOpen);
}

/* ---------- Payments helpers ---------- */
function monthsElapsed(j){
  const start = new Date(j.startDate); const now = new Date();
  if (now < start) return 0;
  let months = (now.getFullYear()-start.getFullYear())*12 + (now.getMonth()-start.getMonth()) + 1;
  return Math.max(0, Math.min(j.duration, months));
}

function ensurePayments(j, m){
  if (!Array.isArray(m.payments) || m.payments.length !== j.duration){
    const prev = Array.isArray(m.payments) ? m.payments : [];
    m.payments = Array.from({length: j.duration}, (_,k)=>{
      const existed = prev[k]||{};
      return {
        i: k+1,
        paid: !!existed.paid,
        amount: Number.isFinite(existed.amount) ? Number(existed.amount) : Number(m.pay||0),
        paidAt: existed.paidAt || null
      };
    });
  }else{
    m.payments.forEach((p,idx)=>{
      if (!Number.isFinite(p.amount)) p.amount = Number(m.pay||0);
      p.i = idx+1;
    });
  }
  recalcMemberCounters(j,m); // keep counters up to date
}

function recalcMemberCounters(j,m){
  // إجمالي شهور مدفوعة/متبقية + كم شهر متأخر حتى الآن
  const paidCount = (m.payments||[]).reduce((s,p)=> s + (p.paid?1:0), 0);
  const remainingCount = Math.max(0, j.duration - paidCount);
  const elapsed = monthsElapsed(j);
  const overdueCount = (m.payments||[]).slice(0, elapsed).reduce((s,p)=> s + (p.paid?0:1), 0);
  m.paidCount = paidCount;
  m.remainingCount = remainingCount;
  m.overdueCount = overdueCount;
  return {paidCount, remainingCount, overdueCount};
}

function memberPaidSummary(j, m){
  ensurePayments(j,m);
  const elapsed = monthsElapsed(j);
  let paid = 0, due = 0;
  m.payments.forEach(p=>{ if (p.paid) paid += Number(p.amount||0); });
  m.payments.slice(0, elapsed).forEach(p=>{ if (!p.paid) due += Number(p.amount||0); });
  return { paid, due };
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  hide($('#details'));
  hide($('#payModal'));

  // Create
  $('#jamiyahForm').addEventListener('submit', onCreateJamiyah);

  // Member add
  $('#memberForm').addEventListener('submit', onAddMember);

  // Nav
  $('#deleteJamiyah').addEventListener('click', onDeleteJamiyah);
  $('#backBtn').addEventListener('click', showList);

  // Edit
  $('#editForm').addEventListener('submit', onSaveEdit);
  $('#cancelEdit').addEventListener('click', (e)=>{ e.preventDefault(); $('#editBlock').open=false; });

  // List/search
  $('#search').addEventListener('input', (e)=>{ state.filter=(e.target.value||'').trim(); renderList(); });

  // Export
  $('#exportBtn').addEventListener('click', ()=> exportPdf(currentJamiyah()));

  // Live hints
  $('#m-month').addEventListener('change', updateMonthHint);
  $('#m-pay').addEventListener('input', updateMonthHint);

  // Members toolbar
  $('#memberSearch').addEventListener('input', (e)=>{ state.memberSearch=(e.target.value||'').trim(); renderMembers(currentJamiyah()); });
  $('#memberSort').addEventListener('change', (e)=>{ state.memberSort=e.target.value; renderMembers(currentJamiyah()); });

  // Schedule filter
  $('#scheduleFilter').addEventListener('change', (e)=>{ state.scheduleFilter=e.target.value; renderSchedule(currentJamiyah()); });

  // Modal buttons
  $('#payClose').addEventListener('click', closePayModal);
  $('#paySave').addEventListener('click', savePayModal);
  $('#payMarkAll').addEventListener('click', ()=> setAllPayModal(true));
  $('#payClearAll').addEventListener('click', ()=> setAllPayModal(false));
  $('#payModal').addEventListener('click', (e)=>{ if (e.target.id==='payModal') closePayModal(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closePayModal(); });

  setDetailsSectionsVisible(false);
  renderList();
});

/* ---------- Create Jamiyah ---------- */
function onCreateJamiyah(e){
  e.preventDefault();
  setError('err-j-name'); setError('err-j-start'); setError('err-j-duration'); setError('err-j-goal');

  const name=$('#j-name').value.trim();
  const startMonth=$('#j-start').value;
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
}

/* ---------- List ---------- */
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
    row.querySelector('button').addEventListener('click', ()=> openDetails(j.id));
    list.appendChild(row);
  });

  if(!state.currentId){ hide($('#details')); setDetailsSectionsVisible(false); }
}

/* ---------- Open details ---------- */
function openDetails(id){
  state.currentId=id;
  const j=currentJamiyah();
  if(!j){ hide($('#details')); setDetailsSectionsVisible(false); return; }

  j.members.forEach(m=>ensurePayments(j,m));

  $('#d-title').textContent=j.name;
  $('#d-period').textContent=`من ${j.startDate} لمدة ${fmtInt(j.duration)} شهر`;
  $('#d-goal').textContent=`الهدف الشهري: ${fmtMoney(j.goal)}`;
  $('#d-status').textContent=startedStatus(j);

  const started=hasStarted(j);
  $('#startedAlert').hidden=!started;
  $('#memberForm').querySelectorAll('input,button,select').forEach(el=>{ el.disabled=started; });

  $('#e-name').value=j.name; $('#e-goal').value=j.goal;
  $('#e-start').value=j.startDate.slice(0,7); $('#e-duration').value=j.duration;
  $('#e-start').disabled=started; $('#e-duration').disabled=started;

  populateMonthOptions(j); populateScheduleFilter(j); updateMonthHint();

  renderMembers(j);
  renderSchedule(j);
  updateMembersSummary(j);
  updateScheduleSummary(j);

  setDetailsSectionsVisible(true);
  show($('#details'));
  $('#details')?.scrollIntoView({ behavior:'smooth', block:'start' });

  saveAll();
}

/* ---------- Helpers ---------- */
function monthAssignedTotal(j, month){
  return j.members.filter(m=>Number(m.month)===Number(month)).reduce((s,m)=>s+Number(m.entitlement||0),0);
}
function maxMonthlyForMonth(j, month){
  const remaining=Math.max(0, j.goal - monthAssignedTotal(j, month));
  return Math.floor(remaining / j.duration);
}
function colorForMonth(i){
  const colors=["#22c55e","#16a34a","#2dd4bf","#60a5fa","#a78bfa","#f472b6","#f59e0b"];
  return colors[(i-1)%colors.length];
}

/* ---------- Month selects ---------- */
function populateMonthOptions(j){
  const select=$('#m-month'); const current=select.value; select.innerHTML='';
  for(let i=1; i<=j.duration; i++){
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

    if(newDuration !== j.duration){
      j.members = j.members.map(m=>{
        ensurePayments(j,m);
        const np = Array.from({length:newDuration}, (_,k)=>{
          const prev = m.payments[k]||{};
          return {
            i: k+1,
            paid: !!prev.paid && k < newDuration,
            amount: Number.isFinite(prev.amount) ? Number(prev.amount) : Number(m.pay||0),
            paidAt: prev.paidAt && prev.paid ? prev.paidAt : null
          };
        });
        return {
          ...m,
          entitlement: Number(m.pay||0) * newDuration,
          month: Math.min(m.month, newDuration),
          payments: np
        };
      });
    }
    j.startDate=newStart;
    j.duration=newDuration;
  }

  j.name=newName; j.goal=newGoal;
  saveAll();
  openDetails(j.id);
  renderList();
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

  let totalPay=0, totalEnt=0;

  if(rows.length===0){
    empty.classList.remove('hidden');
  }else{
    empty.classList.add('hidden');
    rows.forEach((m,idx)=>{
      ensurePayments(j,m);
      const counts = recalcMemberCounters(j,m);
      totalPay += Number(m.pay||0);
      totalEnt += Number(m.entitlement||0);

      const {paid, due} = memberPaidSummary(j,m);

      const tr=document.createElement('tr');
      tr.className='row-accent';
      tr.style.borderInlineStartColor=colorForMonth(m.month);

      const cells = [
        ['#', fmtInt(idx+1)],
        ['الاسم', m.name],
        ['المساهمة', fmtMoney(m.pay)],
        ['الاستحقاق الكلي', fmtMoney(m.entitlement)],
        ['مدفوع حتى الآن', `<span class="badge ok">${fmtMoney(paid)}</span><small class="hint">(${counts.paidCount} / ${j.duration})</small>`],
        ['متأخر', counts.overdueCount>0 ? `<span class="badge late">${fmtMoney(due)}</span><small class="hint">${counts.overdueCount} شهر</small>` : `<span class="badge ok">0</span><small class="hint">(0 شهر)</small>`],
        ['شهر الاستلام', monthLabel(j.startDate, m.month)],
        ['', '']
      ];

      cells.forEach(([label, value], i)=>{
        const td=document.createElement('td');
        td.setAttribute('data-col', label);
        td.innerHTML = value;
        if (i===7){
          const wrap=document.createElement('div'); wrap.style.display='flex'; wrap.style.gap='8px';
          const btnPay=document.createElement('button');
          btnPay.className='btn'; btnPay.textContent='دفعات';
          btnPay.addEventListener('click', ()=> openPayModal(m.id));
          const btnDel=document.createElement('button');
          btnDel.className='btn danger'; btnDel.textContent='حذف';
          btnDel.addEventListener('click', ()=>{
            const jx=currentJamiyah(); if(!jx) return;
            if(hasStarted(jx)){ toast('بدأت الجمعية. لا يمكن تعديل الأعضاء.'); return; }
            if(!confirm(`حذف ${m.name}؟`)) return;
            jx.members=jx.members.filter(x=>x.id!==m.id);
            saveAll(); renderMembers(jx); renderSchedule(jx); renderList(); populateMonthOptions(jx); updateMonthHint(); updateMembersSummary(jx);
            toast('تم حذف العضو');
          });
          wrap.appendChild(btnPay); wrap.appendChild(btnDel);
          td.innerHTML=''; td.appendChild(wrap);
        }
        tr.appendChild(td);
      });

      body.appendChild(tr);
    });
  }

  totPay.textContent = fmtMoney(totalPay);
  totEnt.textContent = fmtMoney(totalEnt);
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
  const remaining=j.goal - already;
  if(entitlement>remaining){ setError('err-m-pay',`exceeds by ${fmtMoney(entitlement-remaining)}`); return; }

  const memberId = uid();
  const payments = Array.from({length:j.duration}, (_,k)=>({ i:k+1, paid:false, amount:pay, paidAt:null }));

  const m={ id: memberId, name, pay, month, entitlement, payments, paidCount:0, remainingCount:j.duration, overdueCount:0 };
  state.jamiyahs.find(x=>x.id===j.id).members.push(m);
  saveAll();

  e.target.reset();
  populateMonthOptions(j); renderMembers(j); renderSchedule(j); renderList(); updateMonthHint(); updateMembersSummary(j);
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
    const receiversText=receivers.length?receivers.map(r=>`${r.name} (${fmtMoney(r.entitlement)})`).join('، '):'—';

    const tr=document.createElement('tr'); tr.className='row-accent'; tr.style.borderInlineStartColor=colorForMonth(i);
    const cells=[
      ['الشهر',monthLabel(j.startDate,i)],
      ['التاريخ',date],
      ['المستلمون',receiversText],
      ['المصروف · المتبقي',`المصروف: ${fmtMoney(totalAssigned)} · المتبقي: ${fmtMoney(remaining)}`]
    ];
    cells.forEach(([label,val])=>{ const td=document.createElement('td'); td.setAttribute('data-col',label); td.innerHTML=val; tr.appendChild(td); });
    body.appendChild(tr);
  });

  updateScheduleSummary(j);
}

/* ---------- Pay Modal ---------- */
function openPayModal(memberId){
  const j=currentJamiyah(); if(!j) return;
  const m=j.members.find(x=>x.id===memberId); if(!m) return;
  ensurePayments(j,m);
  state.payModal.memberId = memberId;

  // Summary counters
  const {paidCount, remainingCount, overdueCount} = recalcMemberCounters(j,m);
  $('#payModalTitle').textContent = `دفعات: ${m.name}`;
  $('#paySummary').innerHTML = `
    <span class="badge ok">مدفوعة: ${paidCount} / ${j.duration}</span>
    <span class="badge">المتبقية: ${remainingCount}</span>
    <span class="badge ${overdueCount>0?'late':'ok'}">متأخرة حتى الآن: ${overdueCount}</span>
  `;

  const body = $('#payModalBody');
  body.innerHTML = '';

  const grid=document.createElement('div');
  grid.className='pay-grid';

  grid.insertAdjacentHTML('beforeend', `
    <div class="cell"><strong>الشهر</strong></div>
    <div class="cell"><strong>مدفوع؟</strong></div>
    <div class="cell"><strong>المبلغ · SAR</strong></div>
    <div class="cell"><strong>التاريخ</strong></div>
  `);

  if (!Array.isArray(m.payments) || m.payments.length===0){
    grid.insertAdjacentHTML('beforeend', `<div class="cell" style="grid-column:1/-1">لا توجد أشهر. تأكد من مدة الجمعية.</div>`);
  }else{
    m.payments.forEach(p=>{
      const monthTxt = monthLabel(j.startDate, p.i);
      const paidAtTxt = p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-GB') : '—';
      grid.insertAdjacentHTML('beforeend', `
        <div class="cell month">${monthTxt}</div>
        <div class="cell">
          <input type="checkbox" data-k="paid" data-i="${p.i}" ${p.paid?'checked':''} />
        </div>
        <div class="cell">
          <input type="number" data-k="amount" data-i="${p.i}" min="0" step="1" value="${Number(p.amount||0)}" />
        </div>
        <div class="cell" id="paidAt-${p.i}">${paidAtTxt}</div>
      `);
    });
  }

  body.appendChild(grid);
  show($('#payModal'));
}

function closePayModal(){
  state.payModal.memberId = null;
  hide($('#payModal'));
}

function setAllPayModal(flag){
  $$('#payModalBody input[type="checkbox"][data-k="paid"]').forEach(cb => { cb.checked = flag; });
}

function savePayModal(){
  const j=currentJamiyah(); if(!j) return;
  const m=j.members.find(x=>x.id===state.payModal.memberId); if(!m) return;
  ensurePayments(j,m);

  const now = new Date().toISOString();
  const checks = $$('#payModalBody input[type="checkbox"][data-k="paid"]');
  const amounts = $$('#payModalBody input[type="number"][data-k="amount"]');

  const paidMap = {}; checks.forEach(cb => { paidMap[parseInt(cb.dataset.i)] = cb.checked; });
  const amountMap = {}; amounts.forEach(inp => { amountMap[parseInt(inp.dataset.i)] = Number(inp.value||0); });

  m.payments = m.payments.map(p=>{
    const newPaid = !!paidMap[p.i];
    const newAmount = Number(amountMap[p.i]||0);
    return {
      i: p.i,
      paid: newPaid,
      amount: newAmount,
      paidAt: newPaid ? (p.paid ? p.paidAt || now : now) : null
    };
  });

  // تحديث العدادات
  recalcMemberCounters(j,m);

  saveAll();
  renderMembers(j);
  closePayModal();
  toast('تم حفظ الدفعات');
}

/* ---------- Hint ---------- */
function updateMonthHint(){
  const j=currentJamiyah(); const hint=$('#monthHint'); const sel=$('#m-month');
  if(!j||!sel||!sel.value){ hint.textContent=''; return; }
  const monthVal=parseInt(sel.value); const maxMonthly=maxMonthlyForMonth(j,monthVal); const pay=parseInt($('#m-pay').value||'0');
  let line=`Max monthly in ${monthLabel(j.startDate,monthVal)}: ${fmtMoney(maxMonthly)} SAR`;
  if(pay){ line += pay>maxMonthly ? ` · Your input (${fmtMoney(pay)}) is above max` : ` · Your input (${fmtMoney(pay)}) is within max`; }
  hint.textContent=line;
}

/* ---------- Delete ---------- */
function onDeleteJamiyah(){
  const j=currentJamiyah(); if(!j) return;
  if(!confirm(`حذف ${j.name}؟ لا يمكن التراجع.`)) return;
  state.jamiyahs=state.jamiyahs.filter(x=>x.id!==j.id); saveAll();
  showList(); renderList(); toast('تم حذف الجمعية');
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
  const members=j.members.slice().sort((a,b)=> a.month-b.month || a.name.localeCompare(b.name));
  const membersRows=members.map((m,i)=>{
    const {paid, due} = memberPaidSummary(j, m);
    const counts = recalcMemberCounters(j,m);
    return `
      <tr>
        <td>${i+1}</td>
        <td>${m.name}</td>
        <td>${fmtMoney(m.pay)}</td>
        <td>${fmtMoney(m.entitlement)}</td>
        <td>${fmtMoney(paid)} (${counts.paidCount}/${j.duration})</td>
        <td>${fmtMoney(due)} (${counts.overdueCount})</td>
        <td>${monthLabel(j.startDate, m.month)}</td>
      </tr>`;
  }).join('');
  const totPay=members.reduce((s,m)=>s+Number(m.pay||0),0);
  const totEnt=members.reduce((s,m)=>s+Number(m.entitlement||0),0);

  const scheduleRows = Array.from({length:j.duration}, (_,k)=>{
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

        <h2>الأعضاء (ملخص الدفعات)</h2>
        <table>
          <thead><tr>
            <th>#</th><th>الاسم</th><th>المساهمة (شهريًا)</th><th>الاستحقاق الكلي</th><th>مدفوع (عدد)</th><th>متأخر (عدد)</th><th>شهر الاستلام</th>
          </tr></thead>
          <tbody>${membersRows || `<tr><td colspan="7" class="muted">لا يوجد أعضاء</td></tr>`}</tbody>
          <tfoot><tr><td colspan="2">الإجمالي</td><td>${fmtMoney(totPay)}</td><td>${fmtMoney(totEnt)}</td><td colspan="3"></td></tr></tfoot>
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