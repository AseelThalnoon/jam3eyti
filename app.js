/* v2.3.6 — SVG icons + member card compact */

const $  = (s,p=document)=>p.querySelector(s);
const $$ = (s,p=document)=>[...p.querySelectorAll(s)];

/* ---------- SVG Icons ---------- */
const icons = {
  eye: `<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.8"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" stroke-width="1.8"/><path d="M13 7l4 4" stroke="currentColor" stroke-width="1.8"/></svg>`,
  trash:`<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7l1-2h4l1 2" stroke="currentColor" stroke-width="1.8"/></svg>`,
  card:`<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.8"/></svg>`
};

/* ---------- Storage & State ---------- */
const KEY_PRIMARY="jamiyati:data", KEY_V02="jamiyati:v02", KEY_V01="jamiyati:v01", KEY_BACKUP="jamiyati:backup", KEY_AUTOSAVE="jamiyati:autosave";

const state={ jamiyahs: loadAllSafe(), currentId:null, memberSort:"month", memberFilter:"all", payModal:{memberId:null}, editMemberId:null };

/* ---------- Helpers ---------- */
const fmtMoney=n=>Number(n||0).toLocaleString('en-US');
const fmtInt  =n=>Number(n||0).toLocaleString('en-US');
function monthLabel(startDate,offset){ const d=new Date(startDate); d.setMonth(d.getMonth()+(offset-1)); return d.toLocaleDateString('en-US',{month:'long',year:'numeric'}); }

const PALETTE=["#22c55e","#16a34a","#2dd4bf","#60a5fa","#a78bfa","#f472b6","#f59e0b"];
const colorForMonth=i=>PALETTE[(i-1)%PALETTE.length];
const colorForIndex=idx=>PALETTE[idx%PALETTE.length];
function colorFromStartDate(j){ try{const d=new Date(j.startDate);return PALETTE[d.getMonth()%PALETTE.length];}catch{return PALETTE[0];} }

const normName = s => (s || '').toString().trim().replace(/\s+/g,' ').toLowerCase();

function parseJsonSafe(t){try{return JSON.parse(t);}catch{return null}}
function readKey(k){const t=localStorage.getItem(k);return t?parseJsonSafe(t):null}
function migrateV01toV02(old){return (old||[]).map(j=>({...j,goal:Number(j.goal||0),members:(j.members||[]).map(m=>({...m,entitlement:Number.isFinite(m.entitlement)?Number(m.entitlement):Number(m.pay||0)*Number(j.duration||0)}))}))}
function loadAllSafe(){
  try{
    let d=readKey(KEY_PRIMARY); if(Array.isArray(d)) return d;
    d=readKey(KEY_V02); if(Array.isArray(d)){ localStorage.setItem(KEY_PRIMARY,JSON.stringify(d)); return d; }
    const v01=readKey(KEY_V01); if(Array.isArray(v01)){ const m=migrateV01toV02(v01); localStorage.setItem(KEY_PRIMARY,JSON.stringify(m)); return m; }
    const backup=readKey(KEY_BACKUP);
    if(Array.isArray(backup)&&backup.length){ document.addEventListener('DOMContentLoaded',()=>$('#restoreWrap')?.classList.remove('hidden')); }
  }catch{}
  return [];
}
function safeSerialize(v){try{return JSON.stringify(v)}catch{return null}}
function saveAll(){
  if(!Array.isArray(state.jamiyahs))return;
  const cur=readKey(KEY_PRIMARY);
  if((!state.jamiyahs||state.jamiyahs.length===0)&&Array.isArray(cur)&&cur.length>0){return;}
  const s=safeSerialize(state.jamiyahs); if(!s)return;
  try{
    localStorage.setItem(KEY_PRIMARY,s);
    localStorage.setItem(KEY_BACKUP,s);
    localStorage.setItem(KEY_AUTOSAVE, JSON.stringify({at:Date.now(),data:state.jamiyahs}));
  }catch{}
}

const uid=()=>Math.random().toString(36).slice(2,10);
function hasStarted(j){const t=new Date().setHours(0,0,0,0);const s=new Date(j.startDate).setHours(0,0,0,0);return t>=s;}
function currentJamiyah(){return state.jamiyahs.find(x=>x.id===state.currentId);}
function toast(msg){const b=$('#toasts');const el=document.createElement('div');el.className='toast';el.textContent=msg;b.appendChild(el);setTimeout(()=>el.remove(),2200);}
function setError(id,t){const el=$(`#${id}`);if(el)el.textContent=t||'';}
function monthToFirstDay(m){if(!m)return"";const[y,mm]=m.split('-');if(!y||!mm)return"";return `${y}-${String(mm).padStart(2,'0')}-01`;}
const show=el=>{if(!el)return;el.classList.remove('hidden');el.removeAttribute('hidden');};
const hide=el=>{if(!el)return;el.classList.add('hidden');el.setAttribute('hidden','');};
function setDetailsSectionsVisible(on){['membersBlock','scheduleBlock'].forEach(id=>on?show(document.getElementById(id)):hide(document.getElementById(id))); }
function updateCounters(j){ $('#mCountPill').textContent=fmtInt((j?.members||[]).length); $('#sCountPill').textContent=fmtInt(j?.duration||0); }

function clearFieldError(inputId, errorId){ const input=document.getElementById(inputId), err=document.getElementById(errorId); input?.classList.remove('is-invalid'); input?.setAttribute('aria-invalid','false'); if(err){err.textContent='';err.removeAttribute('role');}}
function setFieldError(inputId, errorId, msg){ const input=document.getElementById(inputId), err=document.getElementById(errorId); input?.classList.add('is-invalid'); input?.setAttribute('aria-invalid','true'); if(err){err.textContent=msg||'غير صالح';err.setAttribute('role','alert');}}

function monthsElapsed(j){const s=new Date(j.startDate), n=new Date(); if(n<s) return 0; let m=(n.getFullYear()-s.getFullYear())*12+(n.getMonth()-s.getMonth())+1; return Math.max(0,Math.min(j.duration,m));}
function ensurePayments(j,m){
  if(!Array.isArray(m.payments)||m.payments.length!==j.duration){
    const prev=Array.isArray(m.payments)?m.payments:[];
    m.payments=Array.from({length:j.duration},(_,k)=>{const e=prev[k]||{};return{ i:k+1, paid:!!e.paid, amount:Number.isFinite(e.amount)?Number(e.amount):Number(m.pay||0), paidAt:e.paidAt||null };});
  } else { m.payments.forEach((p,i)=>{ if(!Number.isFinite(p.amount)) p.amount=Number(m.pay||0); p.i=i+1; }); }
  recalcMemberCounters(j,m);
}
function recalcMemberCounters(j,m){ const paidCount=(m.payments||[]).reduce((s,p)=>s+(p.paid?1:0),0); const remainingCount=Math.max(0,j.duration-paidCount); const overdueCount=(m.payments||[]).slice(0,monthsElapsed(j)).reduce((s,p)=>s+(p.paid?0:1),0); m.paidCount=paidCount; m.remainingCount=remainingCount; m.overdueCount=overdueCount; return {paidCount,remainingCount,overdueCount};}
function memberPaidSummary(j,m){ ensurePayments(j,m); let paid=0; m.payments.forEach(p=>{if(p.paid)paid+=Number(p.amount||0);}); return {paid};}
function monthAssignedTotal(j,month){return j.members.filter(m=>Number(m.month)===Number(month)).reduce((s,m)=>s+Number(m.entitlement||0),0);}
function maxMonthlyForMonth(j,month){const remaining=Math.max(0,j.goal-monthAssignedTotal(j,month));return Math.floor(remaining/j.duration);}
function monthStats(j,i){const rec=j.members.filter(m=>Number(m.month)===i);const assigned=rec.reduce((s,m)=>s+Number(m.entitlement||0),0);const remaining=Math.max(0,j.goal-assigned);const pct=j.goal>0?Math.min(100,Math.round((assigned/j.goal)*100)):0;return{rec,assigned,remaining,pct};}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded',()=>{
  hide($('#details')); hide($('#payModal')); hide($('#editModal')); hide($('#addMemberModal')); hide($('#editMemberModal'));

  $('#jamiyahForm')?.addEventListener('submit',onCreateJamiyah);
  $('#search')?.addEventListener('input',e=>{const f=(e.target.value||'').trim(); state.filter=f; renderList();});

  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'){ hide($('#payModal')); hide($('#editModal')); hide($('#addMemberModal')); hide($('#editMemberModal')); hide($('#monthDetails')); }});

  $('#mFilter')?.addEventListener('change', e=>{ state.memberFilter = e.target.value || 'all'; const j=currentJamiyah(); if(j) renderMembers(j); });
  $('#mSort')?.addEventListener('change', e=>{ state.memberSort = e.target.value || 'month'; const j=currentJamiyah(); if(j) renderMembers(j); });

  const dMembers  = document.getElementById('membersBlock');
  const dSchedule = document.getElementById('scheduleBlock');
  dMembers?.addEventListener('toggle', ()=>{ if(dMembers.open) dSchedule.open = false; });
  dSchedule?.addEventListener('toggle', ()=>{ if(dSchedule.open) dMembers.open = false; });

  // <-- جديد: ربط الاستيراد (فتح)
  $('#importFile')?.addEventListener('change', onImportJson);

  renderList();
});

/* ---------- Global clicks ---------- */
document.addEventListener('click',(e)=>{
  const idAttr=(e.target.closest('[id]')||{}).id||'';
  switch(idAttr){
    case 'restoreBtn': restoreFromBackup(); return;
    case 'exportBtn':  exportPdf(currentJamiyah()); return;
    case 'exportJsonBtn': exportJson(); return;
    case 'deleteJamiyah': onDeleteJamiyah(); return;
    case 'backBtn': showList(); return;

    case 'editBtn': openEditModal(); return;
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

    // <-- جديد: زر "فتح" يطلق اختيار الملف
    case 'importBtn': $('#importFile')?.click(); return;
  }

  /* فتح الجمعية من البطاقة ⇒ افتح الجدول الشهري مباشرة */
  const openBtn=e.target.closest('button.jam-open[data-id]');
  if(openBtn){
    openDetails(openBtn.dataset.id);
    const dMembers  = document.getElementById('membersBlock');
    const dSchedule = document.getElementById('scheduleBlock');
    if(dSchedule && dMembers){
      dSchedule.open = true;
      dMembers.open  = false;
      dSchedule.scrollIntoView({behavior:'smooth', block:'start'});
    }
    return;
  }

  /* تعديل الجمعية من البطاقة */
  const editBtnOnCard = e.target.closest('button.jam-edit[data-id]');
  if(editBtnOnCard){
    const id = editBtnOnCard.dataset.id;
    state.currentId = id;
    openEditModal();
    return;
  }

  const actBtn=e.target.closest('button[data-action]');
  if(actBtn){
    const action=actBtn.dataset.action, memberId=actBtn.dataset.id;
    const j=currentJamiyah(); if(!j)return;

    if(action==='pay'){ openPayModal(memberId); return; }
    if(action==='edit-member'){ if(hasStarted(j)){toast('بدأت الجمعية. لا يمكن تعديل الأعضاء.');return;} openEditMember(memberId); return; }
    if(action==='del'){ if(hasStarted(j)){toast('بدأت الجمعية. لا يمكن تعديل الأعضاء.');return;}
      const m=j.members.find(x=>x.id===memberId); if(!m)return;
      if(!confirm(`حذف ${m.name}؟`))return;
      j.members=j.members.filter(x=>x.id!==memberId);
      saveAll(); renderMembers(j); renderSchedule(j); populateMonthOptions(j,$('#am-month')); updateCounters(j); toast('تم حذف العضو'); return; }
  }
});

/* ---------- Create / List ---------- */
function onCreateJamiyah(e){
  e.preventDefault();
  setError('err-j-name');setError('err-j-start');setError('err-j-duration');setError('err-j-goal');
  const name=$('#j-name').value.trim(), startMonth=$('#j-start').value;
  const duration=parseInt($('#j-duration').value), goal=parseInt($('#j-goal').value);
  let ok=true;
  if(!name){setError('err-j-name','حقل مطلوب');ok=false;}
  if(!startMonth){setError('err-j-start','حقل مطلوب');ok=false;}
  if(!duration||duration<1){setError('err-j-duration','الحد الأدنى 1');ok=false;}
  if(!goal||goal<=0){setError('err-j-goal','أكبر من 0');ok=false;}
  if(!ok)return;
  const startDate=monthToFirstDay(startMonth);
  if(state.jamiyahs.some(j=>j.name===name)){setError('err-j-name','الاسم مستخدم مسبقًا');return;}
  state.jamiyahs.push({id:uid(),name,startDate,duration,goal,members:[],createdAt:Date.now()});
  saveAll(); e.target.reset(); toast('تم إنشاء الجمعية'); renderList();
}

function renderList(){
  const list=$('#jamiyahList'), empty=$('#emptyList'), pill=$('#jamiyahCountPill');
  const items=state.jamiyahs.filter(j=>!state.filter||j.name.includes(state.filter)).sort((a,b)=>a.name.localeCompare(b.name));
  list.innerHTML=''; pill.textContent=fmtInt(items.length);

  const hasItems=items.length>0;
  empty.classList.toggle('hidden',hasItems);
  const hasBackup = Array.isArray(readKey(KEY_BACKUP)) && readKey(KEY_BACKUP).length>0;
  $('#restoreWrap')?.classList.toggle('hidden', !( !hasItems && hasBackup ));

  if(items.length===0){
    empty.innerHTML=`لا توجد جمعيات.
      <div id="restoreWrap" class="stack-1 ${hasBackup?'':'hidden'}" style="margin-top:8px;">
        <button id="restoreBtn" class="btn">استرجاع الجمعيات</button>
        <small class="hint">وجدنا نسخة احتياطية محلية — اضغط للاسترجاع.</small>
      </div>`;
    return;
  }

  items.forEach(j=>{
    const color = colorFromStartDate(j);
    const card=document.createElement('div');
    card.className='jam-card';
    card.style.borderInlineStart=`4px solid ${color}`;
    card.innerHTML=`
      <button class="jam-open" data-id="${j.id}" title="فتح الجمعية" aria-label="فتح">${icons.eye}</button>
      <button class="jam-edit" data-id="${j.id}" title="تعديل الجمعية" aria-label="تعديل">${icons.edit}</button>
      <div class="jam-head"><strong>${j.name}</strong></div>
      <div class="jam-lines">
        <div class="mc-row"><span class="mc-label">شهر البداية</span><span class="mc-sep">:</span><span class="mc-value">${monthLabel(j.startDate,1)}</span></div>
        <div class="mc-row"><span class="mc-label">المدة</span><span class="mc-sep">:</span><span class="mc-value">${fmtInt(j.duration)} شهر</span></div>
        <div class="mc-row"><span class="mc-label">مبلغ الجمعية</span><span class="mc-sep">:</span><span class="mc-value">${fmtMoney(j.goal)} ريال</span></div>
      </div>
      <div class="jam-chips">
        <span class="mc-chip">أعضاء: ${fmtInt((j.members||[]).length)}</span>
        <span class="mc-chip">أشهر: ${fmtInt(j.duration)}</span>
      </div>`;
    list.appendChild(card);
  });

  if(!state.currentId){ hide($('#details')); setDetailsSectionsVisible(false); $('#fabAdd').disabled=true; }
}

function openDetails(id){
  state.currentId=id;
  const j=currentJamiyah(); if(!j){hide($('#details')); setDetailsSectionsVisible(false); return;}
  j.members.forEach(m=>ensurePayments(j,m));

  $('#d-title').textContent=j.name;
  const meta=$('#d-meta'); meta.innerHTML='';
  meta.append(badge(monthLabel(j.startDate,1)), badge(`المدة: ${fmtInt(j.duration)} شهر`), badge(`مبلغ الجمعية: ${fmtMoney(j.goal)} ريال`));

  const started=hasStarted(j);
  $('#startedAlert').hidden=!started;
  $('#addMemberBtn').disabled=started; $('#fabAdd').disabled=started;

  populateMonthOptions(j,$('#am-month'));
  renderMembers(j); renderSchedule(j); updateCounters(j);
  setDetailsSectionsVisible(true); show($('#details'));

  const dMembers  = document.getElementById('membersBlock');
  const dSchedule = document.getElementById('scheduleBlock');
  if(dMembers && dSchedule){ dMembers.open = true; dSchedule.open = false; }

  $('#details')?.scrollIntoView({behavior:'smooth',block:'start'});
  saveAll();
}

function badge(t){const s=document.createElement('span');s.className='badge';s.textContent=t;return s;}
function computeOverdueMembers(j){ return (j.members||[]).filter(m=>{ensurePayments(j,m);return m.overdueCount>0;}).length; }

/* ---------- Members (التغيير هنا) ---------- */
function renderMembers(j){
  const body=$('#memberTableBody'), empty=$('#emptyMembers'); body.innerHTML=''; const list=[...j.members];
  updateCounters(j);

  const overdueCount=computeOverdueMembers(j);
  const info=$('#mOverdueInfo'); if(info) info.textContent = overdueCount ? `متأخرون: ${fmtInt(overdueCount)}` : '';

  let rows=list.map(m=>{ensurePayments(j,m); return m;});
  if(state.memberFilter==='overdue'){ rows=rows.filter(m=>m.overdueCount>0);
  }else if(state.memberFilter==='notfull'){ rows=rows.filter(m=>m.paidCount<j.duration); }

  rows.sort((a,b)=> state.memberSort==='name'
    ? a.name.localeCompare(b.name)||a.month-b.month
    : a.month-b.month||a.name.localeCompare(b.name));

  empty.classList.toggle('hidden', rows.length!==0);

  rows.forEach((m)=>{
    const {paid}=memberPaidSummary(j,m);
    const remainingMoney=Math.max(0, m.entitlement - paid);

    const tr=document.createElement('tr'); tr.dataset.memberId=m.id;
    const td=document.createElement('td'); td.colSpan=7;

    /* ——— بطاقة مبسّطة ——— */
    td.innerHTML = `
      <div class="member-card" style="border-inline-start:3px solid ${colorForMonth(m.month)}">
        <div class="mc-title">${m.name}</div>

        <div class="mc-rows">
          <div class="mc-row"><span class="mc-label">المساهمة</span><span class="mc-sep">:</span><span class="mc-value">${fmtMoney(m.pay)} ريال</span></div>
          <div class="mc-row"><span class="mc-label">الاستحقاق الكلي</span><span class="mc-sep">:</span><span class="mc-value">${fmtMoney(m.entitlement)} ريال</span></div>
          <div class="mc-row"><span class="mc-label">شهر الاستلام</span><span class="mc-sep">:</span><span class="mc-value mc-month">${monthLabel(j.startDate,m.month)}</span></div>
        </div>

        <div class="mc-chips">
          <span class="mc-chip">مدفوع: ${fmtMoney(paid)} ريال</span>
          ${remainingMoney>0?`<span class="mc-chip ${m.overdueCount>0?'warn':''}">المتبقي: ${fmtMoney(remainingMoney)} ريال</span>`:''}
          <span class="mc-chip">(${m.paidCount} / ${j.duration})</span>
        </div>

        <div class="mc-actions">
          <button class="btn icon" data-action="pay" data-id="${m.id}" title="دفعات" aria-label="دفعات">${icons.card}</button>
          <button class="btn icon" data-action="edit-member" data-id="${m.id}" title="تعديل" aria-label="تعديل">${icons.edit}</button>
          <button class="btn icon" data-action="del" data-id="${m.id}" title="حذف" aria-label="حذف">${icons.trash}</button>
        </div>
      </div>`;
    tr.appendChild(td); body.appendChild(tr);
  });
}

/* ---------- Shared ---------- */
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

function openEditModal(){ const j=currentJamiyah(); if(!j) return;
  $('#e-name').value=j.name; $('#e-goal').value=j.goal; $('#e-start').value=j.startDate.slice(0,7); $('#e-duration').value=j.duration;
  const started=hasStarted(j); $('#e-start').disabled=started; $('#e-duration').disabled=started;
  setError('err-e-name'); setError('err-e-goal'); show($('#editModal'));
}
function onSaveEdit(){
  const j=currentJamiyah(); if(!j) return;
  setError('err-e-name'); setError('err-e-goal');
  const newName=$('#e-name').value.trim(), newGoal=parseInt($('#e-goal').value);
  const startMonth=$('#e-start').value, newDuration=parseInt($('#e-duration').value);
  const started=hasStarted(j);
  if(!newName){setError('err-e-name','حقل مطلوب');return;}
  if(state.jamiyahs.some(x=>x.id!==j.id && x.name===newName)){setError('err-e-name','الاسم مستخدم مسبقًا');return;}
  if(!newGoal||newGoal<=0){setError('err-e-goal','أكبر من 0');return;}
  if(!started){
    if(!startMonth){toast('حدد شهر البداية');return;}
    if(!newDuration||newDuration<1){toast('المدة غير صحيحة');return;}
    const newStart=monthToFirstDay(startMonth);
    if(newDuration!==j.duration){
      j.members=j.members.map(m=>{
        ensurePayments(j,m);
        const np=Array.from({length:newDuration},(_,k)=>{const prev=m.payments[k]||{};return {i:k+1,paid:!!prev.paid&&k<newDuration,amount:Number.isFinite(prev.amount)?Number(prev.amount):Number(m.pay||0),paidAt:prev.paidAt&&prev.paid?prev.paidAt:null};});
        return {...m,entitlement:Number(m.pay||0)*newDuration,month:Math.min(m.month,newDuration),payments:np};
      });
    }
    j.startDate=newStart; j.duration=newDuration;
  }
  j.name=newName; j.goal=newGoal;
  saveAll(); hide($('#editModal')); openDetails(j.id); renderList(); toast('تم حفظ التعديلات');
}

/* ---------- Schedule ---------- */
function renderSchedule(j){
  const grid=$('#scheduleGrid'), details=$('#monthDetails'), mdTitle=$('#md-title'), mdBody=$('#md-body');
  if(!grid) return; grid.innerHTML=''; hide(details);
  for(let i=1;i<=j.duration;i++){
    const {rec,remaining,pct}=monthStats(j,i);
    const tile=document.createElement('div'); tile.className='month-tile'; tile.setAttribute('data-month',i);
    tile.innerHTML=`<div class="row"><div class="label">${monthLabel(j.startDate,i)}</div><div class="muted">${pct}%</div></div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="kpis"><span class="badge">مستلمون: ${fmtInt(rec.length)}</span><span class="badge">المتبقّي: ${fmtMoney(remaining)} ريال</span></div>`;
    tile.addEventListener('click',()=>{
      mdTitle.textContent=monthLabel(j.startDate,i);
      if(rec.length){
        const listHtml = rec.map((m,idx) => `
          <div class="md-card" style="border-inline-start:4px solid ${colorForIndex(idx)}">
            <div class="mc-row"><span class="mc-label">الاسم</span><span class="mc-sep">:</span><span class="mc-value">${m.name}</span></div>
            <div class="mc-row"><span class="mc-label">الاستحقاق</span><span class="mc-sep">:</span><span class="mc-value">${fmtMoney(m.entitlement)} ريال</span></div>
          </div>`).join('');
        mdBody.innerHTML = `<div class="md-list">${listHtml}</div>`;
      }else{
        mdBody.innerHTML = `<div class="empty">لا يوجد مستلمون لهذا الشهر.</div>`;
      }
      show(details); details.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
    grid.appendChild(tile);
  }
  updateCounters(j);
}

/* ---------- Add/Edit Member & Payments (نفس المنطق القديم) ---------- */
function openAddMemberModal(){
  const j = currentJamiyah();
  if(!j){ toast('افتح جمعية أولًا'); return; }
  if(hasStarted(j)){ toast('بدأت الجمعية. لا يمكن إضافة أعضاء.'); return; }

  $('#am-name').value=''; $('#am-pay').value='';
  clearFieldError('am-name','err-am-name'); clearFieldError('am-pay','err-am-pay'); clearFieldError('am-month','err-am-month');

  $('#am-hint').textContent=`اختر شهر استلام متاح. مبلغ الجمعية: ${fmtMoney(j.goal)} ريال`;
  populateMonthOptions(j, $('#am-month'));

  ['am-name','am-pay','am-month'].forEach(id=>{
    const el=document.getElementById(id);
    const errId = id==='am-name' ? 'err-am-name' : id==='am-pay' ? 'err-am-pay' : 'err-am-month';
    const ev = (id==='am-month') ? 'change' : 'input';
    el?.addEventListener(ev, ()=> clearFieldError(id,errId), { once:false });
  });

  show($('#addMemberModal'));
  $('#am-name')?.focus();
}

function onAddMemberFromModal(){
  const j = currentJamiyah();
  if(!j) return;
  if(hasStarted(j)){ toast('بدأت الجمعية. لا يمكن إضافة أعضاء.'); hide($('#addMemberModal')); return; }

  clearFieldError('am-name','err-am-name'); clearFieldError('am-pay','err-am-pay'); clearFieldError('am-month','err-am-month');

  const rawName = ($('#am-name')?.value || '');
  const name    = rawName.trim();
  const pay     = Number($('#am-pay')?.value || 0);
  const month   = Number($('#am-month')?.value || 0);

  let firstInvalid = null;

  if(!name){
    setFieldError('am-name','err-am-name','حقل مطلوب'); firstInvalid = firstInvalid || $('#am-name');
  } else {
    const exists = (j.members || []).some(m => normName(m.name) === normName(name));
    if(exists){ setFieldError('am-name','err-am-name','هذا الاسم موجود مسبقًا'); firstInvalid = firstInvalid || $('#am-name'); }
  }

  if(!Number.isFinite(pay) || pay <= 0){
    setFieldError('am-pay','err-am-pay','المساهمة الشهرية غير صالحة'); firstInvalid = firstInvalid || $('#am-pay');
  }

  if(!month || month < 1 || month > j.duration){
    setFieldError('am-month','err-am-month','اختر شهر الاستلام'); firstInvalid = firstInvalid || $('#am-month');
  }

  if(firstInvalid){ firstInvalid.focus({ preventScroll:true }); return; }

  const entitlement = pay * j.duration;
  const assignedThisMonth = j.members.filter(m => Number(m.month) === month).reduce((s,m)=> s + Number(m.entitlement||0), 0);
  const remainingThisMonth = Math.max(0, j.goal - assignedThisMonth);
  const maxMonthly = maxMonthlyForMonth(j, month);

  if(pay > maxMonthly || entitlement > remainingThisMonth){
    setFieldError('am-pay','err-am-pay', `المساهمة الشهرية تتجاوز الحد الأعلى: ${fmtMoney(maxMonthly)} ريال`);
    $('#am-pay')?.focus({ preventScroll:true });
    return;
  }

  const m = { id: uid(), name, pay: Number(pay), month: Number(month), entitlement, payments: [] };
  ensurePayments(j, m);
  j.members.push(m);

  saveAll(); renderMembers(j); renderSchedule(j); populateMonthOptions(j, $('#am-month')); updateCounters(j);
  hide($('#addMemberModal')); toast('تمت إضافة العضو');
}

function openEditMember(memberId){
  const j=currentJamiyah(); if(!j)return;
  const m=j.members.find(x=>x.id===memberId); if(!m) return;
  state.editMemberId=memberId;

  $('#em-name').value=m.name;
  $('#em-pay').value=m.pay;
  populateMonthOptions(j,$('#em-month'));
  $('#em-month').value=String(m.month);

  clearFieldError('em-name','err-em-name'); clearFieldError('em-pay','err-em-pay'); clearFieldError('em-month','err-em-month');
  show($('#editMemberModal'));
}
function onSaveEditMember(){
  const j=currentJamiyah(); if(!j)return;
  const m=j.members.find(x=>x.id===state.editMemberId); if(!m)return;

  clearFieldError('em-name','err-em-name');
  clearFieldError('em-pay','err-em-pay');
  clearFieldError('em-month','err-em-month');

  const name  = $('#em-name').value.trim();
  const pay   = Number($('#em-pay').value||0);
  const month = Number($('#em-month').value||0);

  let firstInvalid=null;

  if(!name){
    setFieldError('em-name','err-em-name','حقل مطلوب');
    firstInvalid=firstInvalid||$('#em-name');
  } else {
    const exists = j.members.some(x=>x.id!==m.id && normName(x.name)===normName(name));
    if(exists){
      setFieldError('em-name','err-em-name','الاسم مستخدم');
      firstInvalid=firstInvalid||$('#em-name');
    }
  }

  if(!Number.isFinite(pay)||pay<=0){
    setFieldError('em-pay','err-em-pay','قيمة غير صالحة');
    firstInvalid=firstInvalid||$('#em-pay');
  }

  if(!month||month<1||month>j.duration){
    setFieldError('em-month','err-em-month','اختر شهر صحيح');
    firstInvalid=firstInvalid||$('#em-month');
  }

  if(firstInvalid){ firstInvalid.focus({preventScroll:true}); return; }

  // --- التعديل هنا: استثناء العضو الجاري تعديله من حساب سعة الشهر ---
  const entitlement = pay * j.duration;

  // إجمالي الاستحقاقات في هذا الشهر باستثناء هذا العضو
  const assignedThisMonth = j.members
    .filter(x => x.id !== m.id && Number(x.month) === month)
    .reduce((s, x) => s + Number(x.entitlement || 0), 0);

  // السعة المتبقية في هذا الشهر بعد استثناء نفس العضو
  const remainingThisMonth = Math.max(0, j.goal - assignedThisMonth);

  // السقف الشهري الجديد مشتق من السعة المتبقية مقسوماً على مدة الجمعية
  const maxMonthly = Math.floor(remainingThisMonth / j.duration);

  if (pay > maxMonthly || entitlement > remainingThisMonth){
    setFieldError('em-pay','err-em-pay', `المساهمة الشهرية تتجاوز الحد الأعلى: ${fmtMoney(maxMonthly)} ريال`);
    $('#em-pay')?.focus({preventScroll:true});
    return;
  }
  // --- نهاية التعديل ---

  m.name = name;
  m.pay  = pay;
  m.month = month;
  m.entitlement = entitlement;
  ensurePayments(j,m);

  saveAll();
  renderMembers(j);
  renderSchedule(j);
  hide($('#editMemberModal'));
  toast('تم حفظ التعديل');
}

  m.name=name; m.pay=pay; m.month=month; m.entitlement=entitlement;
  ensurePayments(j,m);

  saveAll(); renderMembers(j); renderSchedule(j); hide($('#editMemberModal')); toast('تم حفظ التعديل');
}

/* ---------- Payments ---------- */
function openPayModal(memberId){
  const j=currentJamiyah(); if(!j) return;
  const m=j.members.find(x=>x.id===memberId); if(!m) return;
  ensurePayments(j,m); state.payModal.memberId=memberId;
  const {paidCount,remainingCount,overdueCount}=recalcMemberCounters(j,m);
  $('#payModalTitle').textContent=`دفعات: ${m.name}`;
  $('#paySummary').innerHTML=`<span class="badge">مدفوعة: ${paidCount} / ${j.duration}</span>
    <span class="badge">المتبقية: ${remainingCount}</span>
    <span class="badge ${overdueCount>0?'status':''}">متأخرة حتى الآن: ${overdueCount}</span>`;
  const body=$('#payModalBody'); body.innerHTML='';
  const grid=document.createElement('div'); grid.className='pay-grid';
  grid.insertAdjacentHTML('beforeend',`<div class="cell"><strong>الشهر</strong></div><div class="cell"><strong>مدفوع؟</strong></div><div class="cell"><strong>المبلغ · ريال</strong></div><div class="cell"><strong>التاريخ</strong></div>`);
  m.payments.forEach(p=>{
    const monthTxt=monthLabel(j.startDate,p.i), paidAtTxt=p.paidAt?new Date(p.paidAt).toLocaleDateString('en-GB'):'—';
    grid.insertAdjacentHTML('beforeend',`<div class="cell month">${monthTxt}</div>
      <div class="cell"><input type="checkbox" data-k="paid" data-i="${p.i}" ${p.paid?'checked':''}></div>
      <div class="cell"><input type="number" data-k="amount" data-i="${p.i}" min="0" step="1" value="${Number(p.amount||0)}"></div>
      <div class="cell" id="paidAt-${p.i}">${paidAtTxt}</div>`);
  });
  body.appendChild(grid); show($('#payModal'));
}
function setAllPayModal(flag){$$('#payModalBody input[type="checkbox"][data-k="paid"]').forEach(cb=>{cb.checked=flag;});}
function savePayModal(){
  const j=currentJamiyah(); if(!j)return;
  const m=j.members.find(x=>x.id===state.payModal.memberId); if(!m)return;
  ensurePayments(j,m); const now=new Date().toISOString();
  const checks=$$('#payModalBody input[type="checkbox"][data-k="paid"]');
  const amounts=$$('#payModalBody input[type="number"][data-k="amount"]');
  const paidMap={}, amountMap={}; checks.forEach(cb=>paidMap[parseInt(cb.dataset.i)]=cb.checked);
  amounts.forEach(inp=>amountMap[parseInt(inp.dataset.i)]=Number(inp.value||0));
  m.payments=m.payments.map(p=>{const newPaid=!!paidMap[p.i]; const newAmount=Number(amountMap[p.i]||0);
    return {i:p.i,paid:newPaid,amount:newAmount,paidAt:newPaid?(p.paid?p.paidAt||now:now):null};});
  recalcMemberCounters(j,m); saveAll(); renderMembers(j); hide($('#payModal')); toast('تم حفظ الدفعات');
}

/* ---------- Delete / Export / Restore ---------- */
function onDeleteJamiyah(){ const j=currentJamiyah(); if(!j) return;
  if(!confirm(`حذف ${j.name}؟ لا يمكن التراجع.`)) return;
  state.jamiyahs=state.jamiyahs.filter(x=>x.id!==j.id); saveAll(); showList(); renderList(); toast('تم حذف الجمعية'); }
function showList(){ hide($('#details')); state.currentId=null; setDetailsSectionsVisible(false); $('#fabAdd').disabled=true; }

function exportPdf(j){
  const css=`<style>@page{size:A4;margin:14mm}body{font-family:-apple-system,Segoe UI,Roboto,Arial,"Noto Naskh Arabic","IBM Plex Sans Arabic",sans-serif;color:#111}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}h2{margin:18px 0 8px;font-size:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:right;font-size:12px;vertical-align:top}thead th{background:#f3f4f6}tfoot td{font-weight:700;background:#fafafa}.muted{color:#666}</style>`;
  const members=j.members.slice().sort((a,b)=>a.month-b.month||a.name.localeCompare(b.name));
  const rows=members.map((m,i)=>{const {paid}=memberPaidSummary(j,m);const c=recalcMemberCounters(j,m);
    return `<tr><td>${i+1}</td><td>${m.name}</td><td>${fmtMoney(m.pay)} ريال</td><td>${fmtMoney(m.entitlement)} ريال</td><td>${fmtMoney(paid)} ريال (${c.paidCount}/${j.duration})</td><td>${monthLabel(j.startDate,m.month)}</td></tr>`;}).join('');
  const totPay=members.reduce((s,m)=>s+Number(m.pay||0),0),totEnt=members.reduce((s,m)=>s+Number(m.entitlement||0),0);
  const sched=Array.from({length:j.duration},(_,k)=>k+1).map(i=>{
    const rec=j.members.filter(m=>Number(m.month)===i).sort((a,b)=>a.name.localeCompare(b.name));
    const txt=rec.length?rec.map(r=>`${r.name} (${fmtMoney(r.entitlement)} ريال)`).join('، '):'—';
    return `<tr><td>${monthLabel(j.startDate,i)}</td><td>${txt}</td></tr>`;
  }).join('');
  const html=`<html dir="rtl" lang="ar"><head><meta charset="utf-8" /><title>${j.name}</title>${css}</head><body>
  <header><h1>جمعيتي</h1><div>${new Date().toLocaleDateString('en-GB')}</div></header>
  <div class="meta">${monthLabel(j.startDate,1)} · المدة: ${fmtInt(j.duration)} شهر · مبلغ الجمعية: ${fmtMoney(j.goal)} ريال</div>
  <h2>الأعضاء</h2>
  <table><thead><tr><th>#</th><th>الاسم</th><th>المساهمة</th><th>الاستحقاق الكلي</th><th>مدفوع (عدد)</th><th>شهر الاستلام</th></tr></thead>
  <tbody>${rows||`<tr><td colspan="6" class="muted">لا يوجد أعضاء</td></tr>`}</tbody>
  <tfoot><tr><td colspan="2">الإجمالي</td><td>${fmtMoney(totPay)} ريال</td><td>${fmtMoney(totEnt)} ريال</td><td colspan="2"></td></tr></tfoot></table>
  <h2>الجدول الشهري</h2>
  <table><thead><tr><th>الشهر</th><th>المستلمون</th></tr></thead><tbody>${sched}</tbody></table>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}</script></body></html>`;
  const w=window.open('','_blank'); w.document.open(); w.document.write(html); w.document.close();
}

function exportJson(){
  const data = safeSerialize(state.jamiyahs)||"[]";
  const blob = new Blob([data],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`jamiyati-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast('تم تنزيل نسخة JSON احتياطية');
}

function restoreFromBackup(){
  const backup=readKey(KEY_BACKUP)||(readKey(KEY_AUTOSAVE)||{}).data;
  if(Array.isArray(backup)&&backup.length){
    state.jamiyahs=backup; localStorage.setItem(KEY_PRIMARY,JSON.stringify(backup));
    $('#restoreWrap')?.classList.add('hidden'); toast('تم الاسترجاع من النسخة الاحتياطية');
    renderList(); if(state.jamiyahs[0]) openDetails(state.jamiyahs[0].id);
  }else{ toast('لا توجد نسخة احتياطية صالحة'); }
}

/* ---------- NEW: Import JSON (فتح) ---------- */
function onImportJson(e){
  const input = e.target;
  const file  = input?.files && input.files[0];
  const reset = () => { if (input) input.value = ''; };

  if (!file) { reset(); return; }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = parseJsonSafe(reader.result || '[]');
      if (!Array.isArray(data)) { toast('ملف غير صالح'); reset(); return; }

      // نسخ احتياطي قبل الاستبدال
      const current = safeSerialize(state.jamiyahs) || '[]';
      localStorage.setItem(KEY_BACKUP, current);

      // استبدال + تصحيح البنية
      state.jamiyahs = data.map(j => ({
        id: j.id || uid(),
        name: String(j.name || '').trim(),
        startDate: j.startDate || j.start || '',
        duration: Number(j.duration || 0),
        goal: Number(j.goal || 0),
        members: Array.isArray(j.members) ? j.members.map(m => ({
          id: m.id || uid(),
          name: String(m.name || '').trim(),
          pay: Number(m.pay || 0),
          month: Number(m.month || 1),
          entitlement: Number.isFinite(m.entitlement) ? Number(m.entitlement) : Number(m.pay || 0) * Number(j.duration || 0),
          payments: Array.isArray(m.payments) ? m.payments : []
        })) : []
      }));

      // تأكيد دفعات وحسابات كل عضو
      state.jamiyahs.forEach(j => j.members.forEach(m => ensurePayments(j, m)));

      saveAll();
      renderList();
      if (state.jamiyahs.length) openDetails(state.jamiyahs[0].id);

      toast('تم الفتح (استيراد JSON)');
    } catch (err) {
      console.error(err);
      toast('تعذّر قراءة الملف');
    } finally {
      reset();
    }
  };
  reader.onerror = () => { toast('فشل قراءة الملف'); reset(); };
  reader.readAsText(file);
}