/* v2.1.1 – إصلاح فتح المودالات تلقائيًا + إخفاء قوي عند التحميل */
const $  = (s,p=document)=>p.querySelector(s);
const $$ = (s,p=document)=>[...p.querySelectorAll(s)];

/* مفاتيح التخزين */
const KEY_PRIMARY   = "jamiyati:data";
const KEY_V02       = "jamiyati:v02";
const KEY_V01       = "jamiyati:v01";
const KEY_BACKUP    = "jamiyati:backup";
const KEY_AUTOSAVE  = "jamiyati:autosave";
const KEY_UI        = "jamiyati:ui";
const KEY_CURRENT   = "jamiyati:currentId";

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

/* === أدوات عرض: show/hide تضمن display === */
const show=el=>{ if(!el) return; el.style.display=''; el.classList.remove('hidden'); el.removeAttribute('hidden'); };
const hide=el=>{ if(!el) return; el.style.display='none'; el.classList.add('hidden'); el.setAttribute('hidden',''); };

/* ===== بقية الأكواد كما هي من v2.1.0 (لا تغييرات منطقية) ===== */
/* ——— تنسيقات ——— */
const fmtMoney=n=>Number(n||0).toLocaleString('en-US');
const fmtInt  =n=>Number(n||0).toLocaleString('en-US');
function monthLabel(startDate,offset){ const d=new Date(startDate); d.setMonth(d.getMonth()+(offset-1)); return d.toLocaleDateString('en-US',{month:'long',year:'numeric'}); }
const shortDate=d=>new Date(d).toLocaleDateString('en-GB');

/* ——— تخزين ——— */
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

/* ——— عام ——— */
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
function setDetailsSectionsVisible(on){ ['membersBlock','scheduleBlock'].forEach(id=> on?show(document.getElementById(id)):hide(document.getElementById(id)) ); }
function updateCounters(j){ $('#mCountPill').textContent=fmtInt((j?.members||[]).length); $('#sCountPill').textContent=fmtInt(j?.duration||0); }

/* ——— دفعات ——— */
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

/* ——— Helpers ——— */
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
  if(!j || !j.duration || !j.goal) return 0;
  let sumPct=0;
  for(let i=1;i<=j.duration;i++){
    const {assigned}=monthStats(j,i);
    const pct = j.goal>0 ? Math.min(1, assigned/j.goal) : 0;
    sumPct += pct;
  }
  return Math.round((sumPct/j.duration)*100);
}

/* ——— تهيئة ——— */
document.addEventListener('DOMContentLoaded',()=>{
  // إخفاء قوي لأي مودال عند التحميل (لو CSS ما طُبق لحظة)
  ['payModal','editModal','addMemberModal','monthDetails'].forEach(id=>hide(document.getElementById(id)));

  loadUI();
  $('#jamiyahForm')?.addEventListener('submit',onCreateJamiyah);
  $$('#createBlock .chip').forEach(ch=>{
    ch.addEventListener('click',()=>{
      const v = ch.getAttribute('data-val');
      const input = ch.parentElement.previousElementSibling;
      if(input) input.value = v;
    });
  });
  $('#search')?.addEventListener('input',e=>{state.filter=(e.target.value||'').trim();renderList();});
  window.addEventListener('beforeunload', ()=> {
    try{ localStorage.setItem(KEY_AUTOSAVE, JSON.stringify({ at: Date.now(), data: state.jamiyahs })); }catch{}
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key==='Escape'){
      ['payModal','editModal','addMemberModal','monthDetails'].forEach(id=>{
        const el = document.getElementById(id);
        if(el && !el.classList.contains('hidden')) hide(el);
      });
    }
  });

  renderList();
  if(state.currentId && state.jamiyahs.some(j=>j.id===state.currentId)){
    openDetails(state.currentId);
  }
});

/* ——— تفويض أحداث (نفس السابق) ——— */
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
      const btn = e.target.closest('button.btn.secondary[data-id]');
      if(btn){ openDetails(btn.dataset.id); }

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
          const removed = j.members.splice(idx,1)[0];
          saveAll(); renderMembers(j); renderSchedule(j); populateMonthOptions(j,$('#am-month')); updateCounters(j);
          toast(`تم حذف ${removed.name}`, (action)=>{
            if(action==='undo'){
              const jj=currentJamiyah(); if(!jj) return;
              jj.members.push(removed);
              jj.members.sort((a,b)=>a.month-b.month||a.name.localeCompare(b.name));
              saveAll(); renderMembers(jj); renderSchedule(jj); populateMonthOptions(jj,$('#am-month')); updateCounters(jj);
              toast('تم التراجع');
            }
          });
        }
      }
    }
  }
});

/* ——— بقية الدوال: onCreateJamiyah, renderList, openDetails, applyUIToControls,
      renderMembers, populateMonthOptions, openEditModal, onSaveEdit,
      renderSchedule, openAddMemberModal, onAddMemberFromModal,
      openPayModal, setAllPayModal, savePayModal, onDeleteJamiyah,
      showList, exportPdf, exportJson ——— */
/* الكود مطابق v2.1.0 (انسخته كما هو بالرسالة السابقة) باستثناء دوال show/hide وتثبيت الإخفاء عند التحميل. */