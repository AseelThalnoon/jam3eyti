/* v1.5 — Fixed tabs, removed duplicate IDs, validated selectors
   - Accessible tabs with keyboard support (Left/Right/Home/End)
   - Details stay hidden until a jamiyah is opened
   - All prior business logic preserved
*/

const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const SKEY = "jamiyati:v02";
const THEME_KEY = "jamiyati:theme"; // auto | light | dark

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

/* ---------- Theme ---------- */
function applyTheme(mode){
  const html = document.documentElement;
  html.setAttribute('data-theme', mode || 'auto');
  localStorage.setItem(THEME_KEY, mode || 'auto');
}
function initTheme(){
  applyTheme(localStorage.getItem(THEME_KEY) || 'auto');
  $('#themeToggle')?.addEventListener('click', ()=>{
    const cur = localStorage.getItem(THEME_KEY) || 'auto';
    const next = cur === 'auto' ? 'dark' : (cur === 'dark' ? 'light' : 'auto');
    applyTheme(next);
    toast(next === 'auto' ? 'Theme: Auto' : `Theme: ${next}`);
  });
}

/* ---------- Tabs (accessible) ---------- */
const Tabs = {
  list: null, tabs: [], panels: [],
  init(){
    this.list = $('#tabsList');
    if (!this.list) return;
    this.tabs = $$('#tabsList [role="tab"]');
    this.panels = ['editBlock','addMemberBlock','membersBlock','scheduleBlock'].map(id => document.getElementById(id)).filter(Boolean);

    // click
    this.tabs.forEach((t, idx) => t.addEventListener('click', () => this.setActive(idx)));
    // keyboard
    this.list.addEventListener('keydown', (e)=>{
      const cur = this.tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
      let next = cur;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const dir = e.key === 'ArrowRight' ? -1 : 1; // RTL
        next = (cur + dir + this.tabs.length) % this.tabs.length;
        e.preventDefault();
      } else if (e.key === 'Home') { next = 0; e.preventDefault(); }
      else if (e.key === 'End') { next = this.tabs.length-1; e.preventDefault(); }
      if (next !== cur) this.setActive(next, true);
    });

    // default
    this.setActive(2); // open on "الأعضاء" by default
  },
  setActive(i, focusTab=false){
    this.tabs.forEach((t, idx)=>{
      const sel = idx === i;
      t.setAttribute('aria-selected', sel ? 'true' : 'false');
      t.setAttribute('tabindex', sel ? '0' : '-1');
      if (sel && focusTab) t.focus();
    });
    this.panels.forEach((p, idx)=>{ p.hidden = (idx !== i); });
  }
};

/* ---------- Section visibility ---------- */
function setDetailsVisible(hasOpen){
  const details = $('#details');
  const tabsWrap = $('#detailsTabs');
  if (hasOpen) {
    details.classList.remove('hidden');
    tabsWrap.classList.remove('hidden');
  } else {
    details.classList.add('hidden');
    tabsWrap.classList.add('hidden');
  }
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Hide details on load
  setDetailsVisible(false);
  initTheme();
  Tabs.init();

  // Create
  $('#jamiyahForm')?.addEventListener('submit', onCreateJamiyah);

  // Member add
  $('#memberForm')?.addEventListener('submit', onAddMember);

  // Nav
  $('#deleteJamiyah')?.addEventListener('click', onDeleteJamiyah);
  $('#backBtn')?.addEventListener('click', showList);

  // Edit
  $('#editForm')?.addEventListener('submit', onSaveEdit);
  $('#cancelEdit')?.addEventListener('click', (e)=>{ e.preventDefault(); /* keep panel open */ });

  // Search
  $('#search')?.addEventListener('input', (e)=>{ state.filter=(e.target.value||'').trim(); renderList(); });

  // Export
  $('#exportBtn')?.addEventListener('click', ()=> exportPdf(currentJamiyah()));

  // Hints / filters
  $('#m-month')?.addEventListener('change', updateMonthHint);
  $('#m-pay')?.addEventListener('input', updateMonthHint);
  $('#memberSearch')?.addEventListener('input', (e)=>{ state.memberSearch=(e.target.value||'').trim(); renderMembers(currentJamiyah()); });
  $('#memberSort')?.addEventListener('change', (e)=>{ state.memberSort=e.target.value; renderMembers(currentJamiyah()); });
  $('#scheduleFilter')?.addEventListener('change', (e)=>{ state.scheduleFilter=e.target.value; renderSchedule(currentJamiyah()); });

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
  empty.classList[items.length===0?'remove':'add']('hidden');

  items.forEach(j=>{
    const totalEntitlement=j.members.reduce((s,m)=>s+Number(m.entitlement||0),0);
    const row=document.createElement('div');
    row.className='item';
    row.innerHTML=`
      <div>
        <div class="titleline"><svg class="i" style="color:var(--primary)"><use href="#logo"/></svg><strong>${j.name}</strong></div>
        <div class="meta">
          <span>من ${j.startDate} لمدة ${fmtInt(j.duration)} شهر</span>
          <span class="badge">الهدف الشهري: ${fmtMoney(j.goal)}</span>
          <span class="badge">${startedStatus(j)}</span>
          <span class="badge">مجموع الاستحقاقات: ${fmtMoney(totalEntitlement)}</span>
        </div>
      </div>
      <button class="btn secondary" data-id="${j.id}"><svg class="i"><use href="#ic-open"/></svg>فتح</button>
    `;
    row.querySelector('button').addEventListener('click', ()=> openDetails(j.id));
    list.appendChild(row);
  });

  if(!state.currentId){ setDetailsVisible(false); }
}

/* ---------- Open details ---------- */
function openDetails(id){
  state.currentId=id;
  const j=currentJamiyah();
  if(!j){ setDetailsVisible(false); return; }

  $('#d-title').textContent=j.name;
  $('#d-period').textContent=`من ${j.startDate} لمدة ${fmtInt(j.duration)} شهر`;
  $('#d-goal').textContent=`الهدف الشهري: ${fmtMoney(j.goal)}`;
  $('#d-status').textContent=startedStatus(j);

  const started=hasStarted(j);
  $('#startedAlert').hidden=!started;
  $('#memberForm')?.querySelectorAll('input,button,select').forEach(el=>{ el.disabled=started; });

  // Edit form
  $('#e-name').value=j.name;
  $('#e-goal').value=j.goal;
  $('#e-start').value=j.startDate.slice(0,7);
  $('#e-duration').value=j.duration;
  $('#e-start').disabled=started; $('#e-duration').disabled=started;

  populateMonthOptions(j);
  populateScheduleFilter(j);
  updateMonthHint();

  renderMembers(j);
  renderSchedule(j);
  updateMembersSummary(j);
  updateScheduleSummary(j);

  setDetailsVisible(true);
  Tabs.setActive(2); // open on "الأعضاء"
  document.getElementById('details')?.scrollIntoView({ behavior:'smooth', block:'start' });
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
  const select=$('#m-month'); if(!select) return;
  const current=select.value; select.innerHTML='';
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
  const sel=$('#scheduleFilter'); if(!sel) return;
  const current=state.scheduleFilter; sel.innerHTML='';
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
      j.members=j.members.map(m=>({ ...m, entitlement:Number(m.pay||0)*newDuration, month:Math.min(m.month,newDuration) }));
    }
    j.startDate=newStart;
    j.duration=newDuration;
  }

  j.name=newName; j.goal=newGoal; saveAll();
  openDetails(j.id);
  renderList();
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
  if(!body||!empty||!totPay||!totEnt) return;
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
  empty.classList[rows.length===0?'remove':'add']('hidden');

  rows.forEach((m,idx)=>{
    totalPay+=Number(m.pay||0); totalEnt+=Number(m.entitlement||0);
    const tr=document.createElement('tr'); tr.className='row-accent'; tr.style.borderInlineStartColor=colorForMonth(m.month);
    const cells=[
      ['#',fmtInt(idx+1)],['الاسم',m.name],['المساهمة',fmtMoney(m.pay)],
      ['الاستحقاق الكلي',fmtMoney(m.entitlement)],['شهر الاستلام',monthLabel(j.startDate,m.month)],['','']
    ];
    cells.forEach(([label,val],i)=>{
      const td=document.createElement('td'); td.setAttribute('data-col',label); td.innerHTML=val;
      if(i===5){ const btn=document.createElement('button'); btn.className='btn danger'; btn.textContent='حذف';
        btn.addEventListener('click',()=>{
          const jx=currentJamiyah(); if(!jx) return;
          if(hasStarted(jx)){ toast('بدأت الجمعية. لا يمكن تعديل الأعضاء.'); return; }
          if(!confirm(`حذف ${m.name}؟`)) return;
          jx.members=jx.members.filter(x=>x.id!==m.id); saveAll();
          renderMembers(jx); renderSchedule(jx); renderList(); populateMonthOptions(jx); updateMonthHint(); updateMembersSummary(jx);
          toast('تم حذف العضو');
        });
        td.appendChild(btn);
      }
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

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

  j.members.push({ id:uid(), name, pay, month, entitlement });
  saveAll();

  e.target.reset();
  populateMonthOptions(j); renderMembers(j); renderSchedule(j); renderList(); updateMonthHint(); updateMembersSummary(j);
  toast('تمت إضافة العضو');
}

/* ---------- Schedule ---------- */
function updateScheduleSummary(j){
  $('#sSummaryText')?.textContent='الجدول الشهري';
  $('#sCountPill')?.textContent=fmtInt(j.duration);
}
function renderSchedule(j){
  if(!j) return;
  const body=$('#scheduleTableBody'); if(!body) return;
  body.innerHTML='';
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
  const members=j.members.slice().sort((a,b)=>a.month-b.month||a.name.localeCompare(b.name));
  const membersRows=members.map((m,i)=>`
    <tr><td>${i+1}</td><td>${m.name}</td><td>${fmtMoney(m.pay)}</td><td>${fmtMoney(m.entitlement)}</td><td>${monthLabel(j.startDate,m.month)}</td></tr>
  `).join('');
  const totPay=members.reduce((s,m)=>s+Number(m.pay||0),0);
  const totEnt=members.reduce((s,m)=>s+Number(m.entitlement||0),0);

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
            <svg class="logo" viewBox="0 0 128 128"><rect width="128" height="128" rx="26" fill="#0b1220"/><circle cx="64" cy="52" r="22" fill="#22c55e"></circle><path d="M24 100c10-18 28-28 40-28s30 10 40 28" stroke="#22c55e" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
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
  setDetailsVisible(false);
  state.currentId=null;
}