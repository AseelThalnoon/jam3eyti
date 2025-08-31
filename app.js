/* v2.1.0 – تبسيط واجهة + Undo + مؤشر حفظ + تفضيلات محفوظة */
const $  = (s,p=document)=>p.querySelector(s);
const $$ = (s,p=document)=>[...p.querySelectorAll(s)];

/* مفاتيح التخزين */
const KEY_PRIMARY   = "jamiyati:data";
const KEY_V02       = "jamiyati:v02";
const KEY_V01       = "jamiyati:v01";
const KEY_BACKUP    = "jamiyati:backup";
const KEY_AUTOSAVE  = "jamiyati:autosave";
const KEY_UI        = "jamiyati:ui";        // تفضيلات المستخدم
const KEY_CURRENT   = "jamiyati:currentId"; // الجمعية المفتوحة آخر مرة

/* حالة التطبيق */
const state={
  jamiyahs: loadAllSafe(),
  currentId: localStorage.getItem(KEY_CURRENT) || null,
  filter:"",
  memberSort: "month",
  memberFilter: "all",
  memberQuery: "",
  payModal:{memberId:null},
  undo: {timer:null, payload:null},
  saving:false, saveTimer:null
};

/* ===== تنسيق ===== */
const fmtMoney=n=>Number(n||0).toLocaleString('en-US');
const fmtInt  =n=>Number(n||0).toLocaleString('en-US');
function monthLabel(startDate,offset){ const d=new Date(startDate); d.setMonth(d.getMonth()+(offset-1)); return d.toLocaleDateString('en-US',{month:'long',year:'numeric'}); }
const shortDate=d=>new Date(d).toLocaleDateString('en-GB');

/* ===== تخزين آمن ===== */
function parseJsonSafe(txt){ try{return JSON.parse(txt);}catch{return null;} }
function readKey(k){ const t=localStorage.getItem(k); return t?parseJsonSafe(t):null; }
function migrateV01toV02(old){
  return (old||[]).map(j=>({
    ...j,
    goal:Number(j.goal||0),
    members:(j.members||[]).map(m=>({
      ...m,
      entitlement:Number.isFinite(m.entitlement)?Number(m.entitlement):Number(m.pay||0)*Number(j.duration||0)
    }))
  }));
}
function loadAllSafe(){
  try{
    let data=readKey(KEY_PRIMARY); if(Array.isArray(data)) return data;
    data=readKey(KEY_V02); if(Array.isArray(data)){ localStorage.setItem(KEY_PRIMARY, JSON.stringify(data)); return data; }
    const v01=readKey(KEY_V01); if(Array.isArray(v01)){ const m=migrateV01toV02(v01); localStorage.setItem(KEY_PRIMARY, JSON.stringify(m)); return m; }
    const backup=readKey(KEY_BACKUP);
    if(Array.isArray(backup)&&backup.length){
      document.addEventListener('DOMContentLoaded',()=>$('#restoreWrap')?.classList.remove('hidden'));
    }
  }catch(e){ console.warn('Storage read error',e); }
  return [];
}
function safeSerialize(v){ try{return JSON.stringify(v);}catch{return null;} }
function markSaving(on,text){
  state.saving = on;
  const dot = $('#saveDot'), st = $('#saveText');
  if(dot) dot.style.background = on ? '#f59e0b' : '#22c55e';
  if(st) st.textContent = text || (on ? 'جارٍ الحفظ…' : 'تم الحفظ');
}
function saveAll(){
  if(!Array.isArray(state.jamiyahs)) return;
  const current = readKey(KEY_PRIMARY);
  if((!state.jamiyahs || state.jamiyahs.length===0) && Array.isArray(current) && current.length>0){
    console.warn('Skip saving empty to protect data'); return;
  }
  const ser=safeSerialize(state.jamiyahs); if(!ser) return;
  try{
    markSaving(true,'جارٍ الحفظ…');
    localStorage.setItem(KEY_PRIMARY, ser);
    localStorage.setItem(KEY_BACKUP, ser);
    localStorage.setItem(KEY_AUTOSAVE, JSON.stringify({at:Date.now(),data:state.jamiyahs}));
    clearTimeout(state.saveTimer);
    state.saveTimer=setTimeout(()=>markSaving(false,'تم الحفظ'),500);
  }catch{
    toast('التخزين معطّل (وضع خاص؟). استخدم تصدير JSON.');
  }
}
function saveUI(){
  const ui = { memberSort:state.memberSort, memberFilter:state.memberFilter, memberQuery:state.memberQuery };
  localStorage.setItem(KEY_UI, JSON.stringify(ui));
}
function loadUI(){
  const ui = readKey(KEY_UI);
  if(!ui) return;
  state.memberSort   = ui.memberSort   || state.memberSort;
  state.memberFilter = ui.memberFilter || state.memberFilter;
  state.memberQuery  = ui.memberQuery  || state.memberQuery;
}

/* ===== أدوات عامة ===== */
const uid=()=>Math.random().toString(36).slice(2,10);
function hasStarted(j){const t=new Date().setHours(0,0,0,0);const s=new Date(j.startDate).setHours(0,0,0,0);return t>=s;}
function currentJamiyah(){return state.jamiyahs.find(x=>x.id===state.currentId)||null;}
function toast(msg, undoHandler){
  const b=$('#toasts'); const el=document.createElement('div'); el.className='toast';
  el.innerHTML = `<span>${msg}</span>` + (undoHandler?`<button class="undo">تراجع</button>`:'');
  b.appendChild(el);
  if(undoHandler){
    const t=setTimeout(()=>{el.remove(); undoHandler('expire');},5000);
    el.querySelector('.undo').addEventListener('click',()=>{clearTimeout(t); el.remove(); undoHandler('undo');});
  } else {
    setTimeout(()=>el.remove(),2200);
  }
}
function setError(id,t){const el=$(`#${id}`);if(el)el.textContent=t||'';}
function monthToFirstDay(m){if(!m)return"";const[y,mm]=m.split('-');if(!y||!mm)return"";return `${y}-${String(mm).padStart(2,'0')}-01`;}
const show=el=>{if(!el)return;el.classList.remove('hidden');el.removeAttribute('hidden');};
const hide=el=>{if(!el)return;el.classList.add('hidden');el.setAttribute('hidden','');};
function setDetailsSectionsVisible(on){ ['membersBlock','scheduleBlock'].forEach(id=> on?show(document.getElementById(id)):hide(document.getElementById(id)) ); }
function updateCounters(j){ $('#mCountPill').textContent=fmtInt((j?.members||[]).length); $('#sCountPill').textContent=fmtInt(j?.duration||0); }

/* ===== دفعات ===== */
function monthsElapsed(j){const s=new Date(j.startDate), n=new Date(); if(n<s) return 0; let m=(n.getFullYear()-s.getFullYear())*12+(n.getMonth()-s.getMonth())+1; return Math.max(0,Math.min(j.duration,m));}
function ensurePayments(j,m){
  if(!Array.isArray(m.payments)||m.payments.length!==j.duration){
    const prev=Array.isArray(m.payments)?m.payments:[];
    m.payments=Array.from({length:j.duration},(_,k)=>{
      const e=prev[k]||{};
      return{ i:k+1, paid:!!e.paid, amount:Number.isFinite(e.amount)?Number(e.amount):Number(m.pay||0), paidAt:e.paidAt||null };
    });
  } else {
    m.payments.forEach((p,i)=>{ if(!Number.isFinite(p.amount)) p.amount=Number(m.pay||0); p.i=i+1;});
  }
  recalcMemberCounters(j,m);
}
function recalcMemberCounters(j,m){
  const paidCount=(m.payments||[]).reduce((s,p)=>s+(p.paid?1:0),0);
  const remainingCount=Math.max(0,j.duration-paidCount);
  const overdueCount=(m.payments||[]).slice(0,monthsElapsed(j)).reduce((s,p)=>s+(p.paid?0:1),0);
  m.paidCount=paidCount; m.remainingCount=remainingCount; m.overdueCount=overdueCount;
  return {paidCount,remainingCount,overdueCount};
}
function memberPaidSummary(j,m){ ensurePayments(j,m); let paid=0; m.payments.forEach(p=>{if(p.paid)paid+=Number(p.amount||0);}); return {paid};}

/* ===== Helpers ===== */
function monthAssignedTotal(j,month){return j.members.filter(m=>Number(m.month)===Number(month)).reduce((s,m)=>s+Number(m.entitlement||0),0);}
function maxMonthlyForMonth(j,month){const remaining=Math.max(0,j.goal-monthAssignedTotal(j,month));return Math.floor(remaining/j.duration);}
function colorForMonth(i){const c=["#22c55e","#16a34a","#2dd4bf","#60a5fa","#a78bfa","#f472b6","#f59e0b"];return c[(i-1)%c.length];}
function monthStats(j, i){
  const rec = j.members.filter(m => Number(m.month)===i);
  const assigned = rec.reduce((s,m)=>s+Number(m.entitlement||0),0);
  const remaining = Math.max(0, j.goal - assigned);
  const pct = j.goal>0 ? Math.min(100, Math.round((assigned/j.goal)*100)) : 0;
  return {rec, assigned, remaining, pct};
}
function overallFillPercent(j){
  // متوسط الامتلاء عبر كل الشهور (assigned/goal لكل شهر)
  if(!j || !j.duration || !j.goal) return 0;
  let sumPct=0;
  for(let i=1;i<=j.duration;i++){
    const {assigned}=monthStats(j,i);
    const pct = j.goal>0 ? Math.min(1, assigned/j.goal) : 0;
    sumPct += pct;
  }
  return Math.round((sumPct/j.duration)*100);
}

/* ===== تهيئة ===== */
document.addEventListener('DOMContentLoaded',()=>{
  hide($('#details')); hide($('#payModal')); hide($('#editModal')); hide($('#addMemberModal'));
  loadUI();

  // أحداث فورم الإنشاء + Chips
  $('#jamiyahForm')?.addEventListener('submit',onCreateJamiyah);
  $$('#createBlock .chip').forEach(ch=>{
    ch.addEventListener('click',()=>{
      const v = ch.getAttribute('data-val');
      const input = ch.parentElement.previousElementSibling; // الـ input قبل الـ chips
      if(input) input.value = v;
    });
  });

  // بحث القائمة
  $('#search')?.addEventListener('input',e=>{state.filter=(e.target.value||'').trim();renderList();});

  // قبل الإغلاق: خزن نسخة تلقائية
  window.addEventListener('beforeunload', ()=> {
    try{ localStorage.setItem(KEY_AUTOSAVE, JSON.stringify({ at: Date.now(), data: state.jamiyahs })); }catch{}
  });

  // Esc لإغلاق أي مودال ظاهر
  document.addEventListener('keydown', (e)=>{
    if(e.key==='Escape'){
      ['payModal','editModal','addMemberModal','monthDetails'].forEach(id=>{
        const el = document.getElementById(id);
        if(el && !el.classList.contains('hidden')) hide(el);
      });
    }
  });

  renderList();

  // لو فيه جمعية محفوظة مسبقًا افتحها
  if(state.currentId && state.jamiyahs.some(j=>j.id===state.currentId)){
    openDetails(state.currentId);
  }
});

/* ===== تفويض أحداث ===== */
document.addEventListener('click', (e)=>{
  const id = (e.target.closest('[id]')||{}).id || '';

  switch(id){
    case 'restoreBtn':        restoreFromBackup(); break;
    case 'exportBtn':         exportPdf(currentJamiyah()); break;
    case 'exportJsonBtn':     exportJson(); break;
    case 'deleteJamiyah':     onDeleteJamiyah(); break;
    case 'backBtn':           showList(); break;

    case 'editBtn':           openEditModal(); break;
    case 'editClose':         hide($('#editModal')); break;
    case 'saveEdit':          onSaveEdit(); break;

    case 'addMemberBtn':
    case 'fabAdd':            openAddMemberModal(); break;
    case 'amClose':           hide($('#addMemberModal')); break;
    case 'amSave':            onAddMemberFromModal(); break;

    case 'payClose':          hide($('#payModal')); break;
    case 'payMarkAll':        setAllPayModal(true); break;
    case 'payClearAll':       setAllPayModal(false); break;
    case 'paySave':           savePayModal(); break;

    case 'md-close':          hide($('#monthDetails')); break;

    default: {
      // فتح جمعية
      const btn = e.target.closest('button.btn.secondary[data-id]');
      if(btn){ openDetails(btn.dataset.id); }

      // أزرار داخل جدول الأعضاء
      if(e.target.matches('button.btn') && e.target.textContent.trim()==='دفعات'){
        const tr=e.target.closest('tr'); if(!tr) return;
        const nameCell=tr.querySelector('[data-col="الاسم"]'); const nameTxt=nameCell?.textContent?.trim()||'';
        const j=currentJamiyah(); if(!j) return;
        const m=j.members.find(x=>x.name===nameTxt); if(m) openPayModal(m.id);
      }
      if(e.target.matches('button.btn.danger') && e.target.textContent.trim()==='حذف'){
        const tr=e.target.closest('tr'); if(!tr) return;
        const nameCell=tr.querySelector('[data-col="الاسم"]'); const nameTxt=nameCell?.textContent?.trim()||'';
        const j=currentJamiyah(); if(!j) return;
        const idx=j.members.findIndex(x=>x.name===nameTxt);
        if(idx>-1){
          if(hasStarted(j)){toast('بدأت الجمعية. لا يمكن تعديل الأعضاء.');return;}
          // حذف مع تراجع
          const removed = j.members.splice(idx,1)[0];
          saveAll(); renderMembers(j); renderSchedule(j); populateMonthOptions(j,$('#am-month')); updateCounters(j);
          state.undo.payload = {type:'member', jamiyahId:j.id, member:removed};
          if(state.undo.timer) clearTimeout(state.undo.timer);
          toast(`تم حذف ${removed.name}`, (action)=>{
            if(action==='undo'){
              // رجّع العضو
              const jj = currentJamiyah(); if(!jj) return;
              jj.members.push(removed);
              jj.members.sort((a,b)=>a.month-b.month||a.name.localeCompare(b.name));
              saveAll(); renderMembers(jj); renderSchedule(jj); populateMonthOptions(jj,$('#am-month')); updateCounters(jj);
              state.undo.payload=null;
              toast('تم التراجع');
            } else {
              state.undo.payload=null;
            }
          });
        }
      }
    }
  }
});

/* ===== إنشاء جمعية ===== */
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
  const now=Date.now();
  state.jamiyahs.push({id:uid(),name,startDate,duration,goal,members:[],createdAt:now,updatedAt:now});
  saveAll(); e.target.reset(); toast('تم إنشاء الجمعية'); renderList();
}

/* ===== قائمة الجمعيات ===== */
function renderList(){
  const list=$('#jamiyahList'), empty=$('#emptyList'), pill=$('#jamiyahCountPill');
  const items=state.jamiyahs
    .filter(j=>!state.filter||j.name.includes(state.filter))
    .sort((a,b)=>a.name.localeCompare(b.name));

  list.innerHTML=''; pill.textContent=fmtInt(items.length);

  const hasItems = items.length>0;
  empty.classList.toggle('hidden',hasItems);
  const hasBackup = Array.isArray(readKey(KEY_BACKUP)) && readKey(KEY_BACKUP).length>0;
  const wrap = $('#restoreWrap'); if(wrap) wrap.classList.toggle('hidden', !( !hasItems && hasBackup ));

  if(items.length===0){
    empty.innerHTML = `لا توجد جمعيات.
      <div id="restoreWrap" class="stack-1 ${hasBackup?'':'hidden'}" style="margin-top:8px;">
        <button id="restoreBtn" class="btn">استرجاع الجمعيات</button>
        <small class="hint">وجدنا نسخة احتياطية محلية — اضغط للاسترجاع.</small>
      </div>`;
  }

  items.forEach(j=>{
    const last = j.updatedAt || j.createdAt || Date.now();
    const row=document.createElement('div'); row.className='item';
    row.innerHTML=`<div>
        <div><strong>${j.name}</strong></div>
        <div class="meta stack-0">
          <span class="badge">تبدأ في ${monthLabel(j.startDate,1)}</span>
          <span class="badge">المدة: ${fmtInt(j.duration)} شهر</span>
          <span class="badge">مبلغ الجمعية: ${fmtMoney(j.goal)} ريال</span>
          <span class="badge">آخر تعديل: ${shortDate(last)}</span>
        </div>
      </div>
      <button class="btn secondary" data-id="${j.id}">فتح</button>`;
    list.appendChild(row);
  });

  if(!state.currentId){ hide($('#details')); setDetailsSectionsVisible(false); $('#fabAdd').disabled=true; }
}

/* ===== فتح التفاصيل ===== */
function openDetails(id){
  state.currentId=id;
  localStorage.setItem(KEY_CURRENT, id);

  const j=currentJamiyah(); if(!j){hide($('#details')); setDetailsSectionsVisible(false); return;}
  j.members.forEach(m=>ensurePayments(j,m));

  // عنوان + سطر موجز
  $('#d-title').textContent=j.name;
  const line = `يبدأ: ${monthLabel(j.startDate,1)} · المدة: ${fmtInt(j.duration)} شهر · مبلغ الجمعية: ${fmtMoney(j.goal)} ريال`;
  $('#metaLine').textContent = line;

  // شريط التقدم الإجمالي
  const pct = overallFillPercent(j);
  $('#overallBar').style.width = `${pct}%`;

  // تمكين/تعطيل إضافة أعضاء بعد البدء
  const started=hasStarted(j);
  $('#addMemberBtn').disabled = started;
  $('#fabAdd').disabled = started;
  $('#startedAlert').hidden = !started;

  const onceKey=`opened:${j.id}`;
  if(!localStorage.getItem(onceKey)){
    $('#membersBlock').setAttribute('open','');
    localStorage.setItem(onceKey,'1');
  }

  populateMonthOptions(j, $('#am-month'));
  applyUIToControls();
  renderMembers(j);
  renderSchedule(j);
  updateCounters(j);

  setDetailsSectionsVisible(true);
  show($('#details'));
  $('#details')?.scrollIntoView({behavior:'smooth',block:'start'});
  touchUpdated(j);
  saveAll();
}
function touchUpdated(j){ j.updatedAt = Date.now(); }
function badge(t){const s=document.createElement('span');s.className='badge';s.textContent=t;return s;}

/* ===== الأعضاء + أدواتهم ===== */
function computeOverdueMembers(j){ return (j.members||[]).filter(m=>{ensurePayments(j,m); return m.overdueCount>0;}).length; }

function applyUIToControls(){
  // تطبيق تفضيلات محفوظة
  $('#mFilter').value = state.memberFilter;
  $('#mSort').value   = state.memberSort;
  $('#mSearch').value = state.memberQuery;
}

function renderMembers(j){
  const body=$('#memberTableBody'), empty=$('#emptyMembers'); body.innerHTML=''; const list=[...j.members];
  updateCounters(j);

  const overdueCount=computeOverdueMembers(j);
  const info=$('#mOverdueInfo'); if(info) info.textContent = overdueCount ? `متأخرون: ${fmtInt(overdueCount)}` : '';

  let rows=list.map(m=>{ensurePayments(j,m); return m;});

  if(state.memberQuery){
    const q=state.memberQuery.toLowerCase();
    rows=rows.filter(m=>(m.name||'').toLowerCase().includes(q));
  }
  if(state.memberFilter==='overdue'){
    rows=rows.filter(m=>m.overdueCount>0);
  }else if(state.memberFilter==='notfull'){
    rows=rows.filter(m=>m.paidCount<j.duration);
  }

  rows.sort((a,b)=>{
    if(state.memberSort==='name') return a.name.localeCompare(b.name)||a.month-b.month;
    return a.month-b.month||a.name.localeCompare(b.name);
  });

  empty.classList.toggle('hidden', rows.length!==0);

  rows.forEach((m,idx)=>{
    const {paid}=memberPaidSummary(j,m);
    const remainingMoney=Math.max(0, m.entitlement - paid);

    const tr=document.createElement('tr');
    tr.className='row-accent';
    tr.style.borderInlineStartColor=colorForMonth(m.month);

    const cells=[
      ['#', fmtInt(idx+1)],
      ['الاسم', m.name],
      ['المساهمة', `${fmtMoney(m.pay)} ريال`],
      ['مدفوع / متبقّي',
        `<span class="badge">${fmtMoney(paid)} ريال</span>
         <span class="badge">المتبقي: ${fmtMoney(remainingMoney)} ريال</span>
         <small class="hint">(${m.paidCount} / ${j.duration})</small>`],
      ['شهر الاستلام', monthLabel(j.startDate,m.month)],
      ['', '']
    ];

    cells.forEach(([label,val],i)=>{
      const td=document.createElement('td'); td.setAttribute('data-col',label); td.innerHTML=val;
      if(i===5){
        const wrap=document.createElement('div'); wrap.style.display='flex'; wrap.style.gap='8px';
        const btnPay=document.createElement('button'); btnPay.className='btn'; btnPay.textContent='دفعات';
        const btnDel=document.createElement('button'); btnDel.className='btn danger'; btnDel.textContent='حذف';
        wrap.appendChild(btnPay); wrap.appendChild(btnDel);
        td.innerHTML=''; td.appendChild(wrap);
      }
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  // ربط أدوات الفلترة/الفرز/البحث
  $('#mSearch').oninput = (e)=>{ state.memberQuery=(e.target.value||''); saveUI(); renderMembers(j); };
  $('#mFilter').onchange = (e)=>{ state.memberFilter=e.target.value; saveUI(); renderMembers(j); };
  $('#mSort').onchange   = (e)=>{ state.memberSort=e.target.value; saveUI(); renderMembers(j); };
}

/* ===== تعبئة شهور الاستلام ===== */
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

/* ===== تعديل الجمعية ===== */
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
  touchUpdated(j);
  saveAll(); hide($('#editModal')); openDetails(j.id); renderList(); toast('تم حفظ التعديلات');
}

/* ===== الجدول الشهري – Tiles ===== */
function renderSchedule(j){
  const grid = $('#scheduleGrid');
  const details = $('#monthDetails');
  const mdTitle = $('#md-title');
  const mdBody = $('#md-body');

  if(!grid) return;
  grid.innerHTML = '';
  hide(details);

  for(let i=1;i<=j.duration;i++){
    const {rec, remaining, pct} = monthStats(j,i);
    const tile = document.createElement('div');
    tile.className = 'month-tile';
    tile.setAttribute('data-month', i);

    tile.innerHTML = `
      <div class="row">
        <div class="label">${monthLabel(j.startDate,i)}</div>
        <div class="muted">${pct}%</div>
      </div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="kpis">
        <span class="badge">مستلمون: ${fmtInt(rec.length)}</span>
        <span class="badge">المتبقّي: ${fmtMoney(remaining)} ريال</span>
      </div>
    `;

    tile.addEventListener('click', ()=>{
      mdTitle.textContent = monthLabel(j.startDate,i);
      mdBody.innerHTML = rec.length
        ? rec.map(m => `
            <div class="item" style="display:flex;justify-content:space-between;gap:8px;padding:8px;border:1px solid var(--border);border-radius:10px;background:var(--panel)">
              <div>${m.name}</div>
              <div class="muted">${fmtMoney(m.entitlement)} ريال</div>
            </div>`).join('')
        : `<div class="empty">لا يوجد مستلمون لهذا الشهر.</div>`;
      show(details);
      details.scrollIntoView({behavior:'smooth',block:'nearest'});
    });

    grid.appendChild(tile);
  }

  // حدّث شريط التقدم الإجمالي
  const pct = overallFillPercent(j);
  $('#overallBar').style.width = `${pct}%`;

  updateCounters(j);
}

/* ===== إضافة عضو (Modal) ===== */
function openAddMemberModal(){
  const j = currentJamiyah();
  if(!j){ toast('افتح جمعية أولًا'); return; }
  if(hasStarted(j)){ toast('بدأت الجمعية. لا يمكن إضافة أعضاء.'); return; }

  const nameInp = $('#am-name');
  const payInp  = $('#am-pay');
  const monthSel= $('#am-month');
  const hint    = $('#am-hint');

  if(nameInp) nameInp.value = '';
  if(payInp)  payInp.value  = '';
  if(hint)    hint.textContent = `اختر شهر استلام متاح. مبلغ الجمعية: ${fmtMoney(j.goal)} ريال`;

  populateMonthOptions(j, monthSel);
  show($('#addMemberModal'));
}
function onAddMemberFromModal(){
  const j = currentJamiyah();
  if(!j) return;
  if(hasStarted(j)){ toast('بدأت الجمعية. لا يمكن إضافة أعضاء.'); hide($('#addMemberModal')); return; }

  const name   = ($('#am-name')?.value || '').trim();
  const payStr = $('#am-pay')?.value || '';
  const month  = Number($('#am-month')?.value || 0);

  let ok = true;
  if(!name){ setError('err-am-name','حقل مطلوب'); toast('اكتب اسم العضو'); ok = false; }
  const pay = Number(payStr);
  if(!Number.isFinite(pay) || pay <= 0){ setError('err-am-pay','غير صالح'); toast('المساهمة الشهرية غير صالحة'); ok = false; }
  if(!month || month < 1 || month > j.duration){ setError('err-am-month','اختر شهرًا'); toast('اختر شهر الاستلام'); ok = false; }
  if(!ok) return;

  const entitlement = pay * j.duration;
  const assignedThisMonth = j.members.filter(m=>Number(m.month)===month).reduce((s,m)=>s+Number(m.entitlement||0),0);
  const remainingThisMonth = Math.max(0, j.goal - assignedThisMonth);
  if(entitlement > remainingThisMonth){
    toast(`لا يكفي المتبقي في هذا الشهر. المتبقي: ${fmtMoney(remainingThisMonth)} ريال`);
    return;
  }

  const m = { id: uid(), name, pay: Number(pay), month: Number(month), entitlement, payments: [] };
  ensurePayments(j, m);
  j.members.push(m);
  j.updatedAt = Date.now();

  saveAll();
  renderMembers(j);
  renderSchedule(j);
  populateMonthOptions(j, $('#am-month'));
  updateCounters(j);

  hide($('#addMemberModal'));
  toast('تمت إضافة العضو');
}

/* ===== دفعات (Modal) ===== */
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
  const j=currentJamiyah(); if(!j) return;
  const m=j.members.find(x=>x.id===state.payModal.memberId); if(!m) return;
  ensurePayments(j,m); const now=new Date().toISOString();
  const checks=$$('#payModalBody input[type="checkbox"][data-k="paid"]');
  const amounts=$$('#payModalBody input[type="number"][data-k="amount"]');
  const paidMap={}, amountMap={}; checks.forEach(cb=>paidMap[parseInt(cb.dataset.i)]=cb.checked);
  amounts.forEach(inp=>amountMap[parseInt(inp.dataset.i)]=Number(inp.value||0));
  m.payments=m.payments.map(p=>{const newPaid=!!paidMap[p.i]; const newAmount=Number(amountMap[p.i]||0);
    return {i:p.i,paid:newPaid,amount:newAmount,paidAt:newPaid?(p.paid?p.paidAt||now:now):null};});
  recalcMemberCounters(j,m); j.updatedAt=Date.now();
  saveAll(); renderMembers(j); hide($('#payModal')); toast('تم حفظ الدفعات');
}

/* ===== حذف/رجوع + PDF/JSON ===== */
function onDeleteJamiyah(){
  const j=currentJamiyah(); if(!j) return;
  const removed = j; // للوضوح
  const idx = state.jamiyahs.findIndex(x=>x.id===j.id);
  if(idx===-1) return;
  state.jamiyahs.splice(idx,1);
  saveAll(); showList(); renderList();
  // تراجع لإرجاع الجمعية كاملة
  toast(`تم حذف ${removed.name}`, (action)=>{
    if(action==='undo'){
      state.jamiyahs.splice(idx,0,removed);
      saveAll(); renderList(); openDetails(removed.id);
      toast('تم التراجع');
    }
  });
}
function showList(){ hide($('#details')); state.currentId=null; localStorage.removeItem(KEY_CURRENT); setDetailsSectionsVisible(false); $('#fabAdd').disabled=true; }

function exportPdf(j){ if(!j) return;
  const css=`<style>@page{size:A4;margin:14mm}body{font-family:-apple-system,Segoe UI,Roboto,Arial,"Noto Naskh Arabic","IBM Plex Sans Arabic",sans-serif;color:#111}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.meta{color:#555;font-size:12px;margin-bottom:12px}h2{margin:18px 0 8px;font-size:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:right;font-size:12px;vertical-align:top}thead th{background:#f3f4f6}tfoot td{font-weight:700;background:#fafafa}.muted{color:#666}</style>`;
  const jx=j, members=jx.members.slice().sort((a,b)=>a.month-b.month||a.name.localeCompare(b.name));
  const rows=members.map((m,i)=>{const {paid}=memberPaidSummary(jx,m);const c=recalcMemberCounters(jx,m);
    return `<tr><td>${i+1}</td><td>${m.name}</td><td>${fmtMoney(m.pay)} ريال</td><td>${fmtMoney(paid)} ريال (${c.paidCount}/${jx.duration})</td><td>${monthLabel(jx.startDate,m.month)}</td></tr>`;}).join('');
  const sched=Array.from({length: jx.duration},(_,k)=>k+1).map(i=>{
    const rec=jx.members.filter(m=>Number(m.month)===i).sort((a,b)=>a.name.localeCompare(b.name));
    const txt=rec.length?rec.map(r=>`${r.name} (${fmtMoney(r.entitlement)} ريال)`).join('، '):'—';
    return `<tr><td>${monthLabel(jx.startDate,i)}</td><td>${txt}</td></tr>`;
  }).join('');
  const html=`<html dir="rtl" lang="ar"><head><meta charset="utf-8" /><title>${jx.name}</title>${css}</head><body>
  <header><h1>جمعيتي</h1><div>${new Date().toLocaleDateString('en-GB')}</div></header>
  <div class="meta">يبدأ: ${monthLabel(jx.startDate,1)} · المدة: ${fmtInt(jx.duration)} شهر · مبلغ الجمعية: ${fmtMoney(jx.goal)} ريال</div>
  <h2>الأعضاء</h2>
  <table><thead><tr><th>#</th><th>الاسم</th><th>المساهمة</th><th>مدفوع (عدد)</th><th>شهر الاستلام</th></tr></thead>
  <tbody>${rows||`<tr><td colspan="5" class="muted">لا يوجد أعضاء</td></tr>`}</tbody>
  <h2>الجدول الشهري</h2>
  <table><thead><tr><th>الشهر</th><th>المستلمون</th></tr></thead><tbody>${sched}</tbody></table>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}</script></body></html>`;
  const w=window.open('','_blank');w.document.open();w.document.write(html);w.document.close();
}
function exportJson(){
  const data = safeSerialize(state.jamiyahs)||"[]";
  const blob = new Blob([data],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`jamiyati-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast('تم تنزيل نسخة JSON احتياطية');
}