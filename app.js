/* v2.3.1 — زر فتح يمين وأصغر + أيقونات حذف/تعديل عضو + نافذة تعديل عضو */
const $  = (s,p=document)=>p.querySelector(s);
const $$ = (s,p=document)=>[...p.querySelectorAll(s)];

const KEY_PRIMARY="jamiyati:data", KEY_V02="jamiyati:v02", KEY_V01="jamiyati:v01", KEY_BACKUP="jamiyati:backup", KEY_AUTOSAVE="jamiyati:autosave";

const state={
  jamiyahs: loadAllSafe(),
  currentId:null,
  memberSort:"month",
  memberFilter:"all",
  payModal:{memberId:null},
  editMemberId:null
};

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

function clearFieldError(inputId, errorId){
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errorId);
  input?.classList.remove('is-invalid');
  input?.setAttribute('aria-invalid','false');
  if(err){ err.textContent = ''; err.removeAttribute('role'); }
}
function setFieldError(inputId, errorId, msg){
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errorId);
  input?.classList.add('is-invalid');
  input?.setAttribute('aria-invalid','true');
  if(err){ err.textContent = msg||'غير صالح'; err.setAttribute('role','alert'); }
}

function monthsElapsed(j){const s=new Date(j.startDate), n=new Date(); if(n<s) return 0; let m=(n.getFullYear()-s.getFullYear())*12+(n.getMonth()-s.getMonth())+1; return Math.max(0,Math.min(j.duration,m));}
function ensurePayments(j,m){
  if(!Array.isArray(m.payments)||m.payments.length!==j.duration){
    const prev=Array.isArray(m.payments)?m.payments:[];
    m.payments=Array.from({length:j.duration},(_,k)=>{const e=prev[k]||{};return{ i:k+1, paid:!!e.paid, amount:Number.isFinite(e.amount)?Number(e.amount):Number(m.pay||0), paidAt:e.paidAt||null };});
  } else { m.payments.forEach((p,i)=>{ if(!Number.isFinite(p.amount)) p.amount=Number(m.pay||0); p.i=i+1; }); }
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

function monthAssignedTotal(j,month){return j.members.filter(m=>Number(m.month)===Number(month)).reduce((s,m)=>s+Number(m.entitlement||0),0);}
function maxMonthlyForMonth(j,month){const remaining=Math.max(0,j.goal-monthAssignedTotal(j,month));return Math.floor(remaining/j.duration);}
function monthStats(j,i){const rec=j.members.filter(m=>Number(m.month)===i);const assigned=rec.reduce((s,m)=>s+Number(m.entitlement||0),0);const remaining=Math.max(0,j.goal-assigned);const pct=j.goal>0?Math.min(100,Math.round((assigned/j.goal)*100)):0;return{rec,assigned,remaining,pct};}

/* تهيئة */
document.addEventListener('DOMContentLoaded',()=>{
  hide($('#details')); hide($('#payModal')); hide($('#editModal')); hide($('#addMemberModal')); hide($('#editMemberModal'));

  $('#jamiyahForm')?.addEventListener('submit',onCreateJamiyah);
  $('#search')?.addEventListener('input',e=>{const f=(e.target.value||'').trim(); state.filter=f; renderList();});

  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'){ ['payModal','editModal','addMemberModal','editMemberModal','monthDetails'].forEach(id=>hide(document.getElementById(id))); }});

  $('#mFilter')?.addEventListener('change', e=>{ state.memberFilter = e.target.value || 'all'; const j=currentJamiyah(); if(j) renderMembers(j); });
  $('#mSort')?.addEventListener('change', e=>{ state.memberSort = e.target.value || 'month'; const j=currentJamiyah(); if(j) renderMembers(j); });

  const dMembers  = document.getElementById('membersBlock');
  const dSchedule = document.getElementById('scheduleBlock');
  dMembers?.addEventListener('toggle', ()=>{ if(dMembers.open) dSchedule.open = false; });
  dSchedule?.addEventListener('toggle', ()=>{ if(dSchedule.open) dMembers.open = false; });

  renderList();
});

/* تفويض أحداث */
document.addEventListener('click',(e