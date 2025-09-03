/* v2.4.0 — منطق بسيط كامل (LocalStorage) + واجهة عربية */
/* كل الأرقام تُعرض en-US، الأشهر بالإنجليزي. */

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const storeKey = 'jam3eyti:data';

/* ============ Helpers ============ */
const monthsEN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const now = new Date();
function toMoney(n){ return Number(n||0).toLocaleString('en-US'); }
function uid(){ return Math.random().toString(36).slice(2,9); }

/* ============ State ============ */
let state = load() || { jams: [], openId: null };
function save(){ localStorage.setItem(storeKey, JSON.stringify(state)); }
function load(){ try{ return JSON.parse(localStorage.getItem(storeKey)); }catch{ return null; }}

/* ============ Init create form ============ */
(function initCreateForm(){
  const mSel = $('#jamMonths');
  for(let m=2;m<=24;m++) {
    const o = document.createElement('option'); o.value=m; o.textContent=m;
    mSel.appendChild(o);
  }
  const startSel = $('#jamStartMonth');
  for(let i=0;i<12;i++){
    const o=document.createElement('option'); o.value=i; o.textContent=monthsEN[i]+' '+now.getFullYear();
    startSel.appendChild(o);
  }
  $('#clearCreate').onclick=()=>{ $('#jamName').value=''; $('#jamAmount').value=''; $('#createErr').textContent=''; };
  $('#createBtn').onclick=createJam;
})();

/* ============ Create Jam ============ */
function createJam(){
  const name=$('#jamName').value.trim();
  const amount=+$('#jamAmount').value;
  const months=+$('#jamMonths').value||6;
  const startMonth=+$('#jamStartMonth').value||now.getMonth();
  const startYear = now.getFullYear();

  if(!name){ return $('#createErr').textContent='اكتب اسم الجمعية.'; }
  if(!amount || amount<=0){ return $('#createErr').textContent='اكتب مبلغ الجمعية.'; }
  $('#createErr').textContent='';

  const id=uid();
  const monthsArr=[...Array(months)].map((_,i)=>{
    const d=new Date(startYear, startMonth+i, 1);
    return { key: monthsEN[d.getMonth()]+' '+d.getFullYear(), total:0, recipients:[] };
  });

  state.jams.push({ id, name, amount, months, startMonth, startYear, members:[], monthsArr });
  state.openId=id;
  save();
  renderAll();
  // بعد الإنشاء افتح التفاصيل والجدول
  $('#detailsSection').scrollIntoView({behavior:'smooth',block:'start'});
  togglePanels('schedule'); // افتح الجدول
}

/* ============ Render ============ */
function renderAll(){
  renderJamList();
  renderOpenJam();
}

function renderJamList(){
  const list=$('#jamList'); list.innerHTML='';
  const q = $('#searchInput').value.trim().toLowerCase();
  const jams = state.jams.filter(j=> j.name.toLowerCase().includes(q));

  $('#jamCount').textContent = jams.length;

  jams.forEach(j=>{
    const card=document.createElement('div');
    card.className='j-card';
    const startLabel = monthsEN[j.startMonth]+' '+j.startYear;

    card.innerHTML=`
      <div class="row"><div class="title">${j.name}</div></div>
      <div class="chips">
        <span class="badge subtle">${startLabel}</span>
        <span class="badge subtle">المدة: ${j.months} شهر</span>
        <span class="badge subtle">مبلغ الجمعية: ${toMoney(j.amount)} ريال</span>
      </div>
      <div class="row">
        <button class="open" title="فتح" data-id="${j.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16M13 5l7 7-7 7"/></svg>
        </button>
        <button class="edit" title="تعديل" data-id="${j.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21l3.9-.6a2 2 0 0 0 1.1-.6L21 6a2.8 2.8 0 0 0-4-4L4 16.8a2 2 0 0 0-.6 1.1L3 21z"/></svg>
        </button>
      </div>
    `;
    list.appendChild(card);
  });

  list.onclick=(e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const id = btn.dataset.id;
    state.openId = id; save();
    renderOpenJam();
    // زر الفتح يذهب للجدول الشهري
    togglePanels('schedule');
    $('#detailsSection').scrollIntoView({behavior:'smooth',block:'start'});
  };
}
$('#searchInput').addEventListener('input', renderJamList);

function getOpen(){ return state.jams.find(j=>j.id===state.openId) || null; }

function renderOpenJam(){
  const j = getOpen();
  const section = $('#detailsSection');
  if(!j){ section.classList.add('hidden'); return; }
  section.classList.remove('hidden');

  // ميتا
  $('#jamMeta').innerHTML = `
    <span class="badge subtle">${monthsEN[j.startMonth]} ${j.startYear}</span>
    <span class="badge subtle">المدة: ${j.months} شهر</span>
    <span class="badge subtle">مبلغ الجمعية: ${toMoney(j.amount)} ريال</span>
  `;

  // أعضاء
  $('#memberCount').textContent = j.members.length;
  renderMembers(j);
  // جدول شهري
  renderMonthsGrid(j);
}

/* ============ Members ============ */
function renderMembers(j){
  const tbody = $('#memberTableBody'); tbody.innerHTML='';
  const filter = $('#filterPaid').value;
  const sort = $('#sortMode').value;

  let mem = [...j.members];
  if(filter==='paid') mem = mem.filter(m=> m.paidMonths.length===j.months);
  if(filter==='unpaid') mem = mem.filter(m=> m.paidMonths.length<j.months);

  if(sort==='byMonth') mem.sort((a,b)=> a.monthIndex-b.monthIndex);
  else mem.sort((a,b)=> a.name.localeCompare(b.name,'ar'));

  mem.forEach((m,idx)=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="member-card">
          <div class="mc-title">${m.name}</div>

          <div class="mc-rows">
            <div class="mc-row"><span class="mc-label">المساهمة</span><span class="mc-sep">:</span><span class="mc-value">${toMoney(m.contrib)} ريال</span></div>
            <div class="mc-row"><span class="mc-label">الاستحقاق الكلي</span><span class="mc-sep">:</span><span class="mc-value">${toMoney(m.contrib*j.months)} ريال</span></div>
            <div class="mc-row"><span class="mc-label">شهر الاستلام</span><span class="mc-sep">:</span><span class="mc-value">${monthsEN[m.monthIndex]} ${j.startYear + Math.floor((j.startMonth+m.monthIndex)/12)}</span></div>
          </div>

          <div class="mc-chips">
            <span class="mc-chip">(${j.months} / ${m.paidMonths.length})</span>
            <span class="mc-chip">المتبقي: ${toMoney( (j.months - m.paidMonths.length) * m.contrib )} ريال</span>
            <span class="mc-chip">مدفوع: ${toMoney( m.paidMonths.length * m.contrib )} ريال</span>
          </div>

          <div class="mc-actions">
            <button class="btn icon" title="دفعات" data-act="pay" data-id="${m.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20M6 14h4"/></svg>
            </button>
            <button class="btn icon" title="تعديل" data-act="edit" data-id="${m.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21l3.9-.6a2 2 0 0 0 1.1-.6L21 6a2.8 2.8 0 0 0-4-4L4 16.8a2 2 0 0 0-.6 1.1L3 21z"/></svg>
            </button>
            <button class="btn icon" title="حذف" data-act="del" data-id="${m.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M9 6v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  $('#membersEmpty').classList.toggle('hidden', j.members.length>0);

  // أفعال الأزرار
  tbody.onclick = (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if(act==='pay') openPay(j,id);
    if(act==='edit') openMemberModal(j, j.members.find(x=>x.id===id));
    if(act==='del'){ if(confirm('حذف العضو؟')) { j.members = j.members.filter(x=>x.id!==id); save(); renderOpenJam(); } }
  };
}

$('#filterPaid').onchange = ()=> renderOpenJam();
$('#sortMode').onchange   = ()=> renderOpenJam();

// إضافة عضو (FAB)
$('#addMemberFab').onclick = ()=> openMemberModal(getOpen(), null);

/* ============ Member Modal ============ */
let editMemberId = null;

function openMemberModal(j, member){
  editMemberId = member ? member.id : null;
  $('#memberModalTitle').textContent = member ? 'تعديل عضو' : 'إضافة عضو';
  $('#mName').value = member ? member.name : '';
  $('#mContrib').value = member ? member.contrib : '';
  $('#mNameErr').textContent=''; $('#mContribErr').textContent=''; $('#mGlobalErr').classList.add('hidden');

  // تعبئة أشهر الاستلام (الأشهر المتاحة)
  const sel = $('#mMonth'); sel.innerHTML='';
  for(let i=0;i<j.months;i++){
    const labelMonthIndex = (j.startMonth + i) % 12;
    const o=document.createElement('option'); o.value=i; o.textContent = monthsEN[labelMonthIndex] + ' ' + (j.startYear + Math.floor((j.startMonth+i)/12));
    sel.appendChild(o);
  }
  if(member) sel.value = member.monthIndex;

  // Hint للحد الأعلى
  $('#mMonthHint').textContent = `الحد الأعلى الشهري: ${toMoney(j.amount)} ريال`;

  $('#memberModal').classList.remove('hidden');

  // منع تكرار الأسماء أثناء الكتابة
  $('#mName').oninput = ()=>{
    const name = $('#mName').value.trim();
    const dup = j.members.some(m=> m.name===name && m.id!==editMemberId);
    $('#mNameErr').textContent = dup ? 'الاسم مكرر.' : '';
  };

  // تحقق من المساهمة
  $('#mContrib').oninput = ()=>{
    const val = +$('#mContrib').value || 0;
    $('#mContribErr').textContent = val>j.amount ? 'المبلغ تعدّى حد المساهمة الشهرية.' : '';
  };
}

$('#closeMemberModal').onclick = ()=> $('#memberModal').classList.add('hidden');

$('#saveMember').onclick = ()=>{
  const j=getOpen(); if(!j) return;
  const name=$('#mName').value.trim();
  const contrib=+$('#mContrib').value;
  const monthIndex=+$('#mMonth').value;

  // تحقق
  if(!name){ $('#mNameErr').textContent='اكتب الاسم.'; return; }
  if(j.members.some(m=> m.name===name && m.id!==editMemberId)){ $('#mNameErr').textContent='الاسم مكرر.'; return; }
  if(!contrib || contrib<=0){ $('#mContribErr').textContent='اكتب المساهمة.'; return; }
  if(contrib>j.amount){ $('#mContribErr').textContent='المبلغ تعدّى حد المساهمة الشهرية.'; return; }

  if(editMemberId){
    const m = j.members.find(x=>x.id===editMemberId);
    m.name=name; m.contrib=contrib; m.monthIndex=monthIndex;
  }else{
    j.members.push({ id:uid(), name, contrib, monthIndex, paidMonths:[] });
  }
  save();
  $('#memberModal').classList.add('hidden');
  renderOpenJam();
};

/* ============ Payments Modal ============ */
let payMember = null;
function openPay(j, memberId){
  payMember = j.members.find(m=>m.id===memberId);
  if(!payMember) return;
  $('#payTitle').textContent = `دفعات: ${payMember.name}`;
  const grid=$('#payGrid'); grid.innerHTML='';
  for(let i=0;i<j.months;i++){
    const monthLabelIndex=(j.startMonth+i)%12;
    const label= monthsEN[monthLabelIndex] + ' ' + (j.startYear + Math.floor((j.startMonth+i)/12));
    const paid = payMember.paidMonths.includes(i);
    grid.insertAdjacentHTML('beforeend', `
      <div class="cell month">${label}</div>
      <div class="cell">المساهمة: ${toMoney(payMember.contrib)} ريال</div>
      <div class="cell">${paid? 'مدفوعة' : 'غير مدفوعة'}</div>
      <div class="cell">
        <input type="checkbox" data-index="${i}" ${paid?'checked':''} />
      </div>
    `);
  }
  $('#payModal').classList.remove('hidden');

  $('#markAllPaid').onclick=()=> $$('#payGrid input[type="checkbox"]').forEach(cb=> cb.checked=true);
  $('#clearAllMarks').onclick=()=> $$('#payGrid input[type="checkbox"]').forEach(cb=> cb.checked=false);
}
$('#closePayModal').onclick=()=> $('#payModal').classList.add('hidden');
$('#savePayments').onclick=()=>{
  const j=getOpen(); if(!j||!payMember) return;
  const cbs=[...$$('#payGrid input[type="checkbox"]')];
  payMember.paidMonths = cbs.filter(cb=>cb.checked).map(cb=> +cb.dataset.index);
  save();
  $('#payModal').classList.add('hidden');
  renderOpenJam();
};

/* ============ Monthly schedule ============ */
function renderMonthsGrid(j){
  const grid=$('#monthsGrid'); grid.innerHTML='';
  for(let i=0;i<j.months;i++){
    const monthIndex=(j.startMonth+i)%12;
    const label= monthsEN[monthIndex] + ' ' + (j.startYear + Math.floor((j.startMonth+i)/12));
    const received = j.members.filter(m=> m.monthIndex===i).map(m=> m.name);
    const totalPaid = j.members.reduce((s,m)=> s + (m.paidMonths.includes(i)? m.contrib:0), 0);

    const percent = Math.min(100, Math.round((totalPaid / j.amount) * 100));

    const tile=document.createElement('div');
    tile.className='month-tile';
    tile.innerHTML=`
      <div class="row">
        <strong>${label}</strong>
        <span class="badge">الحد: ${toMoney(j.amount)} ريال</span>
      </div>
      <div class="progress"><span style="width:${percent}%"></span></div>
      <div class="kpis">
        <span class="badge">مدفوع: ${toMoney(totalPaid)} ريال</span>
        <span class="badge">متبقّي: ${toMoney(Math.max(0, j.amount-totalPaid))} ريال</span>
        <span class="badge">مستلمون: ${received.length}</span>
      </div>
    `;
    tile.onclick=()=> showMonthDetail(j,i,label);
    grid.appendChild(tile);
  }
}

function showMonthDetail(j, i, label){
  const box=$('#monthDetails');
  const receivers = j.members.filter(m=> m.monthIndex===i);
  const totalPaid = j.members.reduce((s,m)=> s + (m.paidMonths.includes(i)? m.contrib:0), 0);
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="md-head">
      <div class="h2">${label}</div>
      <div class="kpis">
        <span class="badge">مدفوع: ${toMoney(totalPaid)} ريال</span>
        <span class="badge">متبقّي: ${toMoney(Math.max(0, j.amount-totalPaid))} ريال</span>
      </div>
    </div>
    <div class="md-list">
      ${ receivers.length ? receivers.map(r=>`
        <div class="md-card">
          <div class="row"><span class="muted">الاسم :</span>&nbsp;<strong>${r.name}</strong></div>
          <div class="row"><span class="muted">المبلغ :</span>&nbsp;<span>${toMoney(r.contrib)} ريال</span></div>
        </div>
      `).join('') : `<div class="empty">لا يوجد مستلمين في هذا الشهر.</div>` }
    </div>
  `;
}

/* ============ Toggle Panels ============ */
function togglePanels(which){
  if(which==='schedule'){ $('#schedulePanel').open=true; $('#membersPanel').open=false; }
  if(which==='members'){ $('#membersPanel').open=true; $('#schedulePanel').open=false; }
}
// افتح/أغلق بحيث لا يتضارب
$('#membersPanel > summary').addEventListener('click',()=>{
  setTimeout(()=> togglePanels('members'),0);
});
$('#schedulePanel > summary').addEventListener('click',()=>{
  setTimeout(()=> togglePanels('schedule'),0);
});

/* ============ Export ============ */
$('#exportJson').onclick = ()=>{
  const j=getOpen(); if(!j) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(j,null,2));
  const a=document.createElement('a'); a.href=dataStr; a.download=`jam-${j.name}.json`; a.click();
};
$('#exportPdf').onclick = ()=> window.print();

/* ============ Bootstrap ============ */
renderAll();