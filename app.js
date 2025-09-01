/* v2.3.4 — إزالة شارة "أشهر" من بطاقة الجمعية + توحيد ألوان أزرار الفتح/التعديل */
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const KEY_PRIMARY="jamiyati:data", KEY_BACKUP="jamiyati:backup", KEY_AUTOSAVE="jamiyati:autosave";

const state={jamiyahs:loadAllSafe(),currentId:null,memberSort:"month",memberFilter:"all",payModal:{memberId:null},editMemberId:null,filter:""};

const fmtMoney=n=>Number(n||0).toLocaleString('en-US');
const fmtInt=n=>Number(n||0).toLocaleString('en-US');
const monthLabel=(d,off)=>{const x=new Date(d);x.setMonth(x.getMonth()+off-1);return x.toLocaleDateString('en-US',{month:'long',year:'numeric'})};
const uid=()=>Math.random().toString(36).slice(2,10);
const normName=s=>(s||'').trim().replace(/\s+/g,' ').toLowerCase();

function parseJsonSafe(t){try{return JSON.parse(t)}catch{return null}}
function readKey(k){const t=localStorage.getItem(k);return t?parseJsonSafe(t):null}
function loadAllSafe(){try{const d=readKey(KEY_PRIMARY);if(Array.isArray(d))return d;const b=readKey(KEY_BACKUP);if(b&&Array.isArray(b.data))return b.data;}catch{}return[]}
function safeSerialize(v){try{return JSON.stringify(v)}catch{return null}}
function saveAll(){if(!Array.isArray(state.jamiyahs))return;const s=safeSerialize(state.jamiyahs);if(!s)return;try{localStorage.setItem(KEY_PRIMARY,s);localStorage.setItem(KEY_BACKUP,JSON.stringify({at:Date.now(),data:state.jamiyahs}));localStorage.setItem(KEY_AUTOSAVE,JSON.stringify({at:Date.now(),data:state.jamiyahs}))}catch{}}

const show=el=>{el?.classList.remove('hidden');el?.removeAttribute('hidden')};
const hide=el=>{el?.classList.add('hidden');el?.setAttribute('hidden','')};
function hasStarted(j){return new Date().setHours(0,0,0,0)>=new Date(j.startDate).setHours(0,0,0,0)}
function currentJamiyah(){return state.jamiyahs.find(x=>x.id===state.currentId)}
function toast(t){const b=$('#toasts');const el=document.createElement('div');el.className='toast';el.textContent=t;b.appendChild(el);setTimeout(()=>el.remove(),2200)}
function badge(t){const s=document.createElement('span');s.className='badge';s.textContent=t;return s;}
function monthToFirstDay(m){if(!m)return"";const[y,mm]=m.split('-');return `${y}-${String(mm).padStart(2,'0')}-01`}

document.addEventListener('DOMContentLoaded',()=>{
  hide($('#details'));
  $('#jamiyahForm')?.addEventListener('submit',onCreateJamiyah);
  $('#search')?.addEventListener('input',e=>{state.filter=(e.target.value||'').trim();renderList()});
  const dMembers=document.getElementById('membersBlock');const dSchedule=document.getElementById('scheduleBlock');
  dMembers?.addEventListener('toggle',()=>{if(dMembers.open)dSchedule.open=false});
  dSchedule?.addEventListener('toggle',()=>{if(dSchedule.open)dMembers.open=false});
  $('#mFilter')?.addEventListener('change',e=>{state.memberFilter=e.target.value;const j=currentJamiyah();if(j)renderMembers(j)});
  $('#mSort')?.addEventListener('change',e=>{state.memberSort=e.target.value;const j=currentJamiyah();if(j)renderMembers(j)});
  renderList();
});

document.addEventListener('click',(e)=>{
  // أزرار البطاقة (✏️ / ▶️)
  const jamBtn=e.target.closest('.jam-btn');
  if(jamBtn){
    const id=jamBtn.dataset.id, kind=jamBtn.dataset.kind;
    const j=state.jamiyahs.find(x=>x.id===id); if(!j) return;
    if(kind==='edit'){ state.currentId=id; openEditModal(); return; }
    if(kind==='open'){ openDetails(id); return; }
  }
  const idAttr=(e.target.closest('[id]')||{}).id||'';
  switch(idAttr){
    case 'restoreBtn': restoreFromBackup(); return;
    case 'exportBtn': exportPdf(currentJamiyah()); return;
    case 'exportJsonBtn': exportJson(); return;
    case 'deleteJamiyah': onDeleteJamiyah(); return;
    case 'backBtn': hide($('#details')); state.currentId=null; return;

    case 'editClose': hide($('#editModal')); return;
    case 'saveEdit': onSaveEdit(); return;

    case 'addMemberBtn':
    case 'fabAdd': openAddMemberModal(); return;
    case 'amClose': hide($('#addMemberModal')); return;
    case 'amSave': onAddMemberFromModal(); return;

    case 'emClose': hide($('#editMemberModal')); return;
    case 'emSave': onSaveEditMember(); return;

    case 'payClose': hide($('#payModal')); return;
    case 'payMarkAll': setAllPayModal(true); return;
    case 'payClearAll': setAllPayModal(false); return;
    case 'paySave': savePayModal(); return;

    case 'md-close': hide($('#monthDetails')); return;
  }

  const actBtn=e.target.closest('button[data-action]');
  if(actBtn){
    const action=actBtn.dataset.action, memberId=actBtn.dataset.id, j=currentJamiyah(); if(!j) return;
    if(action==='pay'){ openPayModal(memberId); return; }
    if(action==='edit-member'){ if(hasStarted(j)){toast('بدأت الجمعية. لا يمكن تعديل الأعضاء.');return;} openEditMember(memberId); return; }
    if(action==='del'){ if(hasStarted(j)){toast('بدأت الجمعية. لا يمكن تعديل الأعضاء.');return;}
      const m=j.members.find(x=>x.id===memberId); if(!m)return;
      if(!confirm(`حذف ${m.name}؟`))return;
      j.members=j.members.filter(x=>x.id!==memberId);
      saveAll(); renderMembers(j); renderSchedule(j); populateMonthOptions(j,$('#am-month')); toast('تم حذف العضو'); return; }
  }
});

/* إنشاء جمعية */
function onCreateJamiyah(e){
  e.preventDefault();
  const name=$('#j-name').value.trim(), sm=$('#j-start').value, duration=+$('#j-duration').value, goal=+$('#j-goal').value;
  if(!name||!sm||!duration||duration<1||!goal||goal<=0){toast('تحقق من المدخلات');return;}
  if(state.jamiyahs.some(j=>j.name===name)){toast('الاسم مستخدم مسبقًا');return;}
  state.jamiyahs.push({id:uid(),name,startDate:monthToFirstDay(sm),duration,goal,members:[],createdAt:Date.now()});
  saveAll(); e.target.reset(); toast('تم الإنشاء'); renderList();
}

/* قائمة الجمعيات كبطاقات — دون شارة الأشهر */
function renderList(){
  const list=$('#jamiyahList'), empty=$('#emptyList'), pill=$('#jamiyahCountPill');
  const items=state.jamiyahs.filter(j=>!state.filter||j.name.includes(state.filter)).sort((a,b)=>a.name.localeCompare(b.name));
  list.innerHTML=''; pill.textContent=fmtInt(items.length);
  empty.classList.toggle('hidden',items.length>0);
  const hasBackup=!!readKey(KEY_BACKUP); $('#restoreWrap')?.classList.toggle('hidden', !(items.length===0&&hasBackup));

  items.forEach(j=>{
    const card=document.createElement('div'); card.className='jam-card';
    card.innerHTML=`
      <div class="jam-actions">
        <button class="jam-btn edit" data-kind="edit" data-id="${j.id}" title="تعديل">✏️</button>
        <button class="jam-btn open" data-kind="open" data-id="${j.id}" title="فتح">▶️</button>
      </div>
      <div class="jam-head"><strong>${j.name}</strong></div>
      <div class="jam-lines">
        <div class="mc-line"><span class="mc-label">شهر البداية</span><span class="mc-sep">:</span><span class="mc-value">${monthLabel(j.startDate,1)}</span></div>
        <div class="mc-line"><span class="mc-label">المدة</span><span class="mc-sep">:</span><span class="mc-value">${fmtInt(j.duration)} شهر</span></div>
        <div class="mc-line"><span class="mc-label">مبلغ الجمعية</span><span class="mc-sep">:</span><span class="mc-value mc-money">${fmtMoney(j.goal)} ريال</span></div>
      </div>
      <div class="jam-chips">
        <span class="pill">أعضاء: ${fmtInt((j.members||[]).length)}</span>
      </div>`;
    list.appendChild(card);
  });

  if(!state.currentId){ hide($('#details')); $('#fabAdd').disabled=true; }
}

/* فتح التفاصيل */
function openDetails(id){
  state.currentId=id; const j=currentJamiyah(); if(!j){hide($('#details'));return;}
  j.members.forEach(m=>ensurePayments(j,m));
  $('#d-title').textContent=j.name;
  const meta=$('#d-meta'); meta.innerHTML=''; meta.append(badge(monthLabel(j.startDate,1)), badge(`المدة: ${fmtInt(j.duration)} شهر`), badge(`مبلغ الجمعية: ${fmtMoney(j.goal)} ريال`));
  const started=hasStarted(j); $('#startedAlert').hidden=!started; $('#addMemberBtn').disabled=started; $('#fabAdd').disabled=started;
  populateMonthOptions(j,$('#am-month'));
  renderMembers(j); renderSchedule(j); show($('#details'));
  $('#membersBlock').open=true; $('#scheduleBlock').open=false;
  $('#details').scrollIntoView({behavior:'smooth',block:'start'}); saveAll();
}

/* ====== الأعضاء والدفعات والجدول الشهري (نفس نسخة v2.3.3) ====== */
function monthsElapsed(j){const s=new Date(j.startDate), n=new Date(); if(n<s) return 0; let m=(n.getFullYear()-s.getFullYear())*12+(n.getMonth()-s.getMonth())+1; return Math.max(0,Math.min(j.duration,m));}
function ensurePayments(j,m){ if(!Array.isArray(m.payments)||m.payments.length!==j.duration){ const prev=Array.isArray(m.payments)?m.payments:[]; m.payments=Array.from({length:j.duration},(_,k)=>{const e=prev[k]||{};return{ i:k+1, paid:!!e.paid, amount:Number.isFinite(e.amount)?Number(e.amount):Number(m.pay||0), paidAt:e.paidAt||null };}); } else { m.payments.forEach((p,i)=>{ if(!Number.isFinite(p.amount)) p.amount=Number(m.pay||0); p.i=i+1; }); } recalcMemberCounters(j,m);}
function recalcMemberCounters(j,m){ const paidCount=(m.payments||[]).reduce((s,p)=>s+(p.paid?1:0),0); const remainingCount=Math.max(0,j.duration-paidCount); const overdueCount=(m.payments||[]).slice(0,monthsElapsed(j)).reduce((s,p)=>s+(p.paid?0:1),0); m.paidCount=paidCount; m.remainingCount=remainingCount; m.overdueCount=overdueCount; return {paidCount,remainingCount,overdueCount};}
function memberPaidSummary(j,m){ ensurePayments(j,m); let paid=0; m.payments.forEach(p=>{if(p.paid)paid+=Number(p.amount||0)}); return {paid};}
function monthAssignedTotal(j,month){return j.members.filter(m=>Number(m.month)===Number(month)).reduce((s,m)=>s+Number(m.entitlement||0),0)}
function maxMonthlyForMonth(j,month){const remaining=Math.max(0,j.goal-monthAssignedTotal(j,month));return Math.floor(remaining/j.duration)}
function monthStats(j,i){const rec=j.members.filter(m=>Number(m.month)===i);const assigned=rec.reduce((s,m)=>s+Number(m.entitlement||0),0);const remaining=Math.max(0,j.goal-assigned);const pct=j.goal>0?Math.min(100,Math.round((assigned/j.goal)*100)):0;return{rec,assigned,remaining,pct};}

function computeOverdueMembers(j){ return (j.members||[]).filter(m=>{ensurePayments(j,m);return m.overdueCount>0;}).length; }
function updateCounters(j){ $('#mCountPill').textContent=fmtInt((j?.members||[]).length); $('#sCountPill').textContent=fmtInt(j?.duration||0); }

function renderMembers(j){
  const body=$('#memberTableBody'), empty=$('#emptyMembers'); body.innerHTML=''; const list=[...j.members];
  updateCounters(j);
  const overdueCount=computeOverdueMembers(j); const info=$('#mOverdueInfo'); if(info) info.textContent = overdueCount ? `متأخرون: ${fmtInt(overdueCount)}` : '';
  let rows=list.map(m=>{ensurePayments(j,m); return m;});
  if(state.memberFilter==='overdue'){ rows=rows.filter(m=>m.overdueCount>0);} else if(state.memberFilter==='notfull'){ rows=rows.filter(m=>m.paidCount<j.duration); }
  rows.sort((a,b)=> state.memberSort==='name'? a.name.localeCompare(b.name)||a.month-b.month : a.month-b.month||a.name.localeCompare(b.name));
  empty.classList.toggle('hidden', rows.length!==0);

  rows.forEach((m)=>{
    const {paid}=memberPaidSummary(j,m); const remainingMoney=Math.max(0, m.entitlement - paid);
    const tr=document.createElement('tr'); tr.dataset.memberId=m.id;
    const td=document.createElement('td'); td.colSpan=7;
    td.innerHTML = `
      <div class="member-card" style="border-inline-start:4px solid #334155">
        <div class="mc-line"><span class="mc-label">الاسم</span><span class="mc-sep">:</span><span class="mc-value">${m.name}</span></div>
        <div class="mc-line"><span class="mc-label">المساهمة</span><span class="mc-sep">:</span><span class="mc-value mc-money">${fmtMoney(m.pay)} ريال</span></div>
        <div class="mc-line"><span class="mc-label">الاستحقاق الكلي</span><span class="mc-sep">:</span><span class="mc-value mc-money">${fmtMoney(m.entitlement)} ريال</span></div>
        <div class="mc-line"><span class="mc-label">شهر الاستلام</span><span class="mc-sep">:</span><span class="mc-value">${monthLabel(j.startDate,m.month)}</span></div>
        <div class="mc-chips">
          <span class="pill">مدفوع: ${fmtMoney(paid)} ريال</span>
          <span class="pill">المتبقي: ${fmtMoney(remainingMoney)} ريال</span>
          <span class="pill">(${m.paidCount} / ${j.duration})</span>
        </div>
        <div class="mc-actions">
          <button class="btn icon" data-action="pay" data-id="${m.id}" title="دفعات">💳</button>
          <button class="btn icon edit" data-action="edit-member" data-id="${m.id}" title="تعديل">✏️</button>
          <button class="btn icon delete" data-action="del" data-id="${m.id}" title="حذف">🗑️</button>
        </div>
      </div>`;
    tr.appendChild(td); body.appendChild(tr);
  });
}

function populateMonthOptions(j, selectEl){
  if(!selectEl) return;
  const cur=selectEl.value; selectEl.innerHTML='';
  for(let i=1;i<=j.duration;i++){
    const max=maxMonthlyForMonth(j,i);
    const o=document.createElement('option');
    o.value=i; o.textContent=`${monthLabel(j.startDate,i)} · الحد الأعلى الشهري: ${fmtMoney(max)} ريال${max<=0?' · ممتلئ':''}`;
    if(max<=0) o.disabled=true;
    selectEl.appendChild(o);
  }
  if(cur && Number(cur)>=1 && Number(cur)<=j.duration) selectEl.value=cur;
}

/* إضافة/تعديل عضو */
function openAddMemberModal(){
  const j=currentJamiyah(); if(!j){toast('افتح جمعية أولًا');return;}
  if(hasStarted(j)){toast('بدأت الجمعية. لا يمكن إضافة أعضاء.');return;}
  $('#am-name').value=''; $('#am-pay').value='';
  $('#am-hint').textContent=`اختر شهر استلام متاح. مبلغ الجمعية: ${fmtMoney(j.goal)} ريال`;
  populateMonthOptions(j,$('#am-month'));
  show($('#addMemberModal'));
}
function onAddMemberFromModal(){
  const j=currentJamiyah(); if(!j) return;
  if(hasStarted(j)){ toast('بدأت الجمعية. لا يمكن إضافة أعضاء.'); hide($('#addMemberModal')); return; }
  const name=($('#am-name').value||'').trim(), pay=Number($('#am-pay').value||0), month=Number($('#am-month').value||0);
  if(!name){toast('أدخل اسم العضو');return;}
  if((j.members||[]).some(m=>normName(m.name)===normName(name))){toast('هذا الاسم موجود مسبقًا');return;}
  if(!Number.isFinite(pay)||pay<=0){toast('المساهمة غير صالحة');return;}
  if(!month||month<1||month>j.duration){toast('اختر شهر الاستلام');return;}
  const entitlement=pay*j.duration, assigned=j.members.filter(m=>Number(m.month)===month).reduce((s,m)=>s+Number(m.entitlement||0),0);
  const remaining=Math.max(0,j.goal-assigned), max=maxMonthlyForMonth(j,month);
  if(pay>max||entitlement>remaining){toast(`المساهمة الشهرية تتجاوز الحد الأعلى: ${fmtMoney(max)} ريال`);return;}
  const m={id:uid(),name,pay,month,entitlement,payments:[]}; ensurePayments(j,m);
  j.members.push(m); saveAll(); renderMembers(j); renderSchedule(j); populateMonthOptions(j,$('#am-month')); hide($('#addMemberModal')); toast('تمت إضافة العضو');
}
function openEditMember(memberId){
  const j=currentJamiyah(); if(!j)return;
  const m=j.members.find(x=>x.id===memberId); if(!m)return; state.editMemberId=memberId;
  $('#em-name').value=m.name; $('#em-pay').value=m.pay; populateMonthOptions(j,$('#em-month')); $('#em-month').value=String(m.month);
  show($('#editMemberModal'));
}
function onSaveEditMember(){
  const j=currentJamiyah(); if(!j)return;
  const m=j.members.find(x=>x.id===state.editMemberId); if(!m)return;
  const name=($('#em-name').value||'').trim(), pay=Number($('#em-pay').value||0), month=Number($('#em-month').value||0);
  if(!name){toast('أدخل اسم العضو');return;}
  if(j.members.some(x=>x.id!==m.id && normName(x.name)===normName(name))){toast('الاسم مستخدم');return;}
  if(!Number.isFinite(pay)||pay<=0){toast('المساهمة غير صالحة');return;}
  if(!month||month<1||month>j.duration){toast('اختر شهر صحيح');return;}
  const entitlement=pay*j.duration, assigned=j.members.filter(x=>x.id!==m.id&&Number(x.month)===month).reduce((s,x)=>s+Number(x.entitlement||0),0);
  const remaining=Math.max(0,j.goal-assigned), max=maxMonthlyForMonth(j,month);
  if(pay>max||entitlement>remaining){toast(`المساهمة الشهرية تتجاوز الحد الأعلى: ${fmtMoney(max)} ريال`);return;}
  m.name=name; m.pay=pay; m.month=month; m.entitlement=entitlement; ensurePayments(j,m);
  saveAll(); renderMembers(j); renderSchedule(j); hide($('#editMemberModal')); toast('تم حفظ التعديل');
}

/* تعديل الجمعية */
function openEditModal(){
  const j=currentJamiyah(); if(!j)return;
  $('#e-name').value=j.name; $('#e-goal').value=j.goal; $('#e-start').value=j.startDate.slice(0,7); $('#e-duration').value=j.duration;
  const started=hasStarted(j); $('#e-start').disabled=started; $('#e-duration').disabled=started; show($('#editModal'));
}
function onSaveEdit(){
  const j=currentJamiyah(); if(!j)return;
  const newName=$('#e-name').value.trim(), newGoal=+$('#e-goal').value, sm=$('#e-start').value, newDuration=+$('#e-duration').value;
  const started=hasStarted(j);
  if(!newName){toast('أدخل اسمًا');return;}
  if(state.jamiyahs.some(x=>x.id!==j.id && x.name===newName)){toast('الاسم مستخدم مسبقًا');return;}
  if(!newGoal||newGoal<=0){toast('قيمة الهدف غير صالحة');return;}
  if(!started){
    if(!sm){toast('حدد شهر البداية');return;}
    if(!newDuration||newDuration<1){toast('المدة غير صالحة');return;}
    const newStart=monthToFirstDay(sm);
    if(newDuration!==j.duration){
      j.members=j.members.map(m=>{
        ensurePayments(j,m);
        const np=Array.from({length:newDuration},(_,k)=>{const prev=m.payments[k]||{};return {i:k+1,paid:!!prev.paid&&k<newDuration,amount:Number.isFinite(prev.amount)?Number(prev.amount):Number(m.pay||0),paidAt:prev.paidAt&&prev.paid?prev.paidAt:null};});
        return {...m,entitlement:Number(m.pay||0)*newDuration,month:Math.min(m.month,newDuration),payments:np};
      });
    }
    j.startDate=newStart; j.duration=newDuration;
  }
  j.name=newName; j.goal=newGoal; saveAll(); hide($('#editModal')); openDetails(j.id); renderList(); toast('تم حفظ التعديلات');
}

/* الجدول الشهري */
function renderSchedule(j){
  const grid=$('#scheduleGrid'), details=$('#monthDetails'), mdTitle=$('#md-title'), mdBody=$('#md-body');
  if(!grid)return; grid.innerHTML=''; hide(details);
  for(let i=1;i<=j.duration;i++){
    const {rec,remaining,pct}=monthStats(j,i);
    const tile=document.createElement('div'); tile.className='month-tile'; tile.dataset.month=i;
    tile.innerHTML=`<div class="row"><div class="label">${monthLabel(j.startDate,i)}</div><div class="muted">${pct}%</div></div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="kpis"><span class="badge">مستلمون: ${fmtInt(rec.length)}</span><span class="badge">المتبقّي: ${fmtMoney(remaining)} ريال</span></div>`;
    tile.addEventListener('click',()=>{
      mdTitle.textContent=monthLabel(j.startDate,i);
      mdBody.innerHTML = rec.length
        ? `<div class="md-list">${rec.map((m)=>`
          <div class="md-card">
            <div class="mc-line"><span class="mc-label">الاسم</span><span class="mc-sep">:</span><span class="mc-value">${m.name}</span></div>
            <div class="mc-line"><span class="mc-label">الاستحقاق</span><span class="mc-sep">:</span><span class="mc-value mc-money">${fmtMoney(m.entitlement)} ريال</span></div>
          </div>`).join('')}</div>`
        : `<div class="empty">لا يوجد مستلمون لهذا الشهر.</div>`;
      show(details); details.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
    grid.appendChild(tile);
  }
  updateCounters(j);
}

/* دفعات */
function openPayModal(memberId){
  const j=currentJamiyah(); if(!j)return;
  const m=j.members.find(x=>x.id===memberId); if(!m)return;
  ensurePayments(j,m); state.payModal.memberId=memberId;
  const {paidCount,remainingCount,overdueCount}=recalcMemberCounters(j,m);
  $('#payModalTitle').textContent=`دفعات: ${m.name}`;
  $('#paySummary').innerHTML=`<span class="badge">مدفوعة: ${paidCount} / ${j.duration}</span><span class="badge">المتبقية: ${remainingCount}</span><span class="badge ${overdueCount>0?'subtle':''}">متأخرة: ${overdueCount}</span>`;
  const body=$('#payModalBody'); body.innerHTML=''; const grid=document.createElement('div'); grid.className='pay-grid';
  grid.insertAdjacentHTML('beforeend',`<div class="cell"><strong>الشهر</strong></div><div class="cell"><strong>مدفوع؟</strong></div><div class="cell"><strong>المبلغ · ريال</strong></div><div class="cell"><strong>التاريخ</strong></div>`);
  m.payments.forEach(p=>{const monthTxt=monthLabel(j.startDate,p.i), paidAtTxt=p.paidAt?new Date(p.paidAt).toLocaleDateString('en-GB'):'—';
    grid.insertAdjacentHTML('beforeend',`<div class="cell month">${monthTxt}</div><div class="cell"><input type="checkbox" data-k="paid" data-i="${p.i}" ${p.paid?'checked':''}></div><div class="cell"><input type="number" data-k="amount" data-i="${p.i}" min="0" step="1" value="${Number(p.amount||0)}"></div><div class="cell" id="paidAt-${p.i}">${paidAtTxt}</div>`);});
  body.appendChild(grid); show($('#payModal'));
}
function setAllPayModal(f){$$('#payModalBody input[type="checkbox"][data-k="paid"]').forEach(cb=>cb.checked=f)}
function savePayModal(){
  const j=currentJamiyah(); if(!j)return;
  const m=j.members.find(x=>x.id===state.payModal.memberId); if(!m)return; ensurePayments(j,m); const now=new Date().toISOString();
  const checks=$$('#payModalBody input[type="checkbox"][data-k="paid"]'); const amounts=$$('#payModalBody input[type="number"][data-k="amount"]');
  const paidMap={}, amountMap={}; checks.forEach(cb=>paidMap[parseInt(cb.dataset.i)]=cb.checked); amounts.forEach(inp=>amountMap[parseInt(inp.dataset.i)]=Number(inp.value||0));
  m.payments=m.payments.map(p=>{const newPaid=!!paidMap[p.i], newAmount=Number(amountMap[p.i]||0); return {i:p.i,paid:newPaid,amount:newAmount,paidAt:newPaid?(p.paid?p.paidAt||now:now):null};});
  recalcMemberCounters(j,m); saveAll(); renderMembers(j); hide($('#payModal')); toast('تم حفظ الدفعات');
}

/* حذف/تصدير/استرجاع */
function onDeleteJamiyah(){ const j=currentJamiyah(); if(!j)return; if(!confirm(`حذف ${j.name}؟ لا يمكن التراجع.`))return; state.jamiyahs=state.jamiyahs.filter(x=>x.id!==j.id); saveAll(); hide($('#details')); renderList(); toast('تم حذف الجمعية');}
function exportJson(){ const data=safeSerialize(state.jamiyahs)||"[]"; const blob=new Blob([data],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`jamiyati-backup-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); toast('تم تنزيل نسخة JSON احتياطية');}
function exportPdf(j){/* كما في v2.3.3 (غيرنا الواجهة فقط) */ }
function restoreFromBackup(){ const b=readKey(KEY_BACKUP)||(readKey(KEY_AUTOSAVE)||{}).data; if(b&&Array.isArray(b)){ state.jamiyahs=b; localStorage.setItem(KEY_PRIMARY,JSON.stringify(b)); $('#restoreWrap')?.classList.add('hidden'); toast('تم الاسترجاع من النسخة الاحتياطية'); renderList(); if(state.jamiyahs[0]) openDetails(state.jamiyahs[0].id);} else { toast('لا توجد نسخة احتياطية صالحة'); } }