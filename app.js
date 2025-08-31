/* v2.0.0 – الجدول الشهري كبلاطات + تفاصيل، مع كل تحسينات v1.9.0 */
const $  = (s,p=document)=>p.querySelector(s);
const $$ = (s,p=document)=>[...p.querySelectorAll(s)];
const SKEY="jamiyati:v02";

const state={
  jamiyahs:loadAll(),
  currentId:null,
  filter:"",
  memberSort:"month",            // 'month' | 'name'
  memberFilter:"all",            // 'all' | 'overdue' | 'notfull'
  memberQuery:"",                // بحث بالاسم
  payModal:{memberId:null}
};

/* تنسيق */
const fmtMoney=n=>Number(n||0).toLocaleString('en-US');
const fmtInt  =n=>Number(n||0).toLocaleString('en-US');
function monthLabel(startDate,offset){ const d=new Date(startDate); d.setMonth(d.getMonth()+(offset-1)); return d.toLocaleDateString('en-US',{month:'long',year:'numeric'}); }

/* تخزين */
function migrateV01toV02(old){ return (old||[]).map(j=>({...j,goal:Number(j.goal||0),members:(j.members||[]).map(m=>({...m,entitlement:Number.isFinite(m.entitlement)?Number(m.entitlement):Number(m.pay||0)*Number(j.duration||0)}))}));}
function loadAll(){try{const v02=JSON.parse(localStorage.getItem(SKEY)); if(Array.isArray(v02)) return v02; const v01=JSON.parse(localStorage.getItem("jamiyati:v01")); if(Array.isArray(v01)){const m=migrateV01toV02(v01);localStorage.setItem(SKEY,JSON.stringify(m));return m;} return [];}catch{return []};}
function saveAll(){localStorage.setItem(SKEY,JSON.stringify(state.jamiyahs));}

/* أدوات */
const uid=()=>Math.random().toString(36).slice(2,10);
function hasStarted(j){const t=new Date().setHours(0,0,0,0);const s=new Date(j.startDate).setHours(0,0,0,0);return t>=s;}
function currentJamiyah(){return state.jamiyahs.find(x=>x.id===state.currentId);}
function toast(msg){const b=$('#toasts');const el=document.createElement('div');el.className='toast';el.textContent=msg;b.appendChild(el);setTimeout(()=>el.remove(),2200);}
function setError(id,t){const el=$(`#${id}`);if(el)el.textContent=t||'';}
function monthToFirstDay(m){if(!m)return"";const[y,mm]=m.split('-');if(!y||!mm)return"";return `${y}-${String(mm).padStart(2,'0')}-01`;}
const show=el=>{if(!el)return;el.classList.remove('hidden');el.removeAttribute('hidden');};
const hide=el=>{if(!el)return;el.classList.add('hidden');el.setAttribute('hidden','');};
function setDetailsSectionsVisible(on){ ['membersBlock','scheduleBlock'].forEach(id=> on?show(document.getElementById(id)):hide(document.getElementById(id)) ); }
function updateCounters(j){ $('#mCountPill').textContent=fmtInt((j?.members||[]).length); $('#sCountPill').textContent=fmtInt(j?.duration||0); }

/* دفعات */
function monthsElapsed(j){const s=new Date(j.startDate), n=new Date(); if(n<s) return 0; let m=(n.getFullYear()-s.getFullYear())*12+(n.getMonth()-s.getMonth())+1; return Math.max(0,Math.min(j.duration,m));}
function ensurePayments(j,m){ if(!Array.isArray(m.payments)||m.payments.length!==j.duration){ const prev=Array.isArray(m.payments)?m.payments:[]; m.payments=Array.from({length:j.duration},(_,k)=>{const e=prev[k]||{};return{ i:k+1, paid:!!e.paid, amount:Number.isFinite(e.amount)?Number(e.amount):Number(m.pay||0), paidAt:e.paidAt||null };}); } else { m.payments.forEach((p,i)=>{ if(!Number.isFinite(p.amount)) p.amount=Number(m.pay||0); p.i=i+1;}); } recalcMemberCounters(j,m);}
function recalcMemberCounters(j,m){ const paidCount=(m.payments||[]).reduce((s,p)=>s+(p.paid?1:0),0); const remainingCount=Math.max(0,j.duration-paidCount); const overdueCount=(m.payments||[]).slice(0,monthsElapsed(j)).reduce((s,p)=>s+(p.paid?0:1),0); m.paidCount=paidCount;m.remainingCount=remainingCount;m.overdueCount=overdueCount; return {paidCount,remainingCount,overdueCount};}
function memberPaidSummary(j,m){ ensurePayments(j,m); let paid=0; m.payments.forEach(p=>{if(p.paid)paid+=Number(p.amount||0);}); return {paid};}

/* Helpers للجدول الشهري (Tiles) */
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

/* تهيئة */
document.addEventListener('DOMContentLoaded',()=>{
  hide($('#details')); hide($('#payModal')); hide($('#editModal')); hide($('#addMemberModal'));

  // إنشاء
  $('#jamiyahForm').addEventListener('submit',onCreateJamiyah);

  // قائمة
  $('#search').addEventListener('input',e=>{state.filter=(e.target.value||'').trim();renderList();});

  // تصدير
  $('#exportBtn').addEventListener('click',()=>exportPdf(currentJamiyah()));

  // دفعات
  $('#payClose').addEventListener('click',()=>hide($('#payModal')));
  $('#paySave').addEventListener('click',savePayModal);
  $('#payMarkAll').addEventListener('click',()=>setAllPayModal(true));
  $('#payClearAll').addEventListener('click',()=>setAllPayModal(false));
  $('#payModal').addEventListener('click',e=>{if(e.target.id==='payModal')hide($('#payModal'));});

  // تعديل
  $('#editBtn').addEventListener('click',openEditModal);
  $('#editClose').addEventListener('click',()=>hide($('#editModal')));
  $('#saveEdit').addEventListener('click',onSaveEdit);

  // إضافة عضو (+) — زر العنوان و الزر العائم
  $('#addMemberBtn').addEventListener('click',openAddMemberModal);
  $('#fabAdd').addEventListener('click',openAddMemberModal);

  // أدوات الأعضاء
  $('#mSearch').addEventListener('input',e=>{state.memberQuery=(e.target.value||'').trim().toLowerCase(); renderMembers(currentJamiyah());});
  $('#mFilter').addEventListener('change',e=>{state.memberFilter=e.target.value; renderMembers(currentJamiyah());});
  $('#mSort').addEventListener('change',e=>{state.memberSort=e.target.value; renderMembers(currentJamiyah());});

  // تفاصيل الجدول الشهري (Tiles)
  $('#md-close').addEventListener('click', ()=>hide($('#monthDetails')));
  $('#schedAutoExpand').addEventListener('change', ()=>renderSchedule(currentJamiyah()));

  // عام
  $('#deleteJamiyah').addEventListener('click',onDeleteJamiyah);
  $('#backBtn').addEventListener('click',showList);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ hide($('#payModal')); hide($('#editModal')); hide($('#addMemberModal')); hide($('#monthDetails')); }});

  renderList();
});

/* إنشاء جمعية */
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

/* قائمة الجمعيات */
function renderList(){
  const list=$('#jamiyahList'), empty=$('#emptyList'), pill=$('#jamiyahCountPill');
  const items=state.jamiyahs.filter(j=>!state.filter||j.name.includes(state.filter)).sort((a,b)=>a.name.localeCompare(b.name));
  list.innerHTML=''; pill.textContent=fmtInt(items.length);
  empty.classList.toggle('hidden',items.length!==0);
  if(items.length===0){
    empty.innerHTML='ابدأ من الأعلى: اختر <b>شهر البداية</b> و<b>المدة</b> و<b>مبلغ الجمعية</b> ثم اضغط "إنشاء".';
  }
  items.forEach(j=>{
    const row=document.createElement('div'); row.className='item';
    row.innerHTML=`<div>
        <div><strong>${j.name}</strong></div>
        <div class="meta stack-0">
          <span class="badge">تبدأ في ${monthLabel(j.startDate,1)}</span>
          <span class="badge">المدة: ${fmtInt(j.duration)} شهر</span>
          <span class="badge">مبلغ الجمعية: ${fmtMoney(j.goal)} ريال</span>
        </div>
      </div>
      <button class="btn secondary" data-id="${j.id}">فتح</button>`;
    row.querySelector('button').addEventListener('click',()=>openDetails(j.id));
    list.appendChild(row);
  });
  if(!state.currentId){ hide($('#details')); setDetailsSectionsVisible(false); $('#fabAdd').disabled=true; }
}

/* فتح التفاصيل */
function openDetails(id){
  state.currentId=id;
  const j=currentJamiyah(); if(!j){hide($('#details')); setDetailsSectionsVisible(false); return;}
  j.members.forEach(m=>ensurePayments(j,m));

  $('#d-title').textContent=j.name;
  const meta=$('#d-meta'); meta.innerHTML='';
  meta.append(badge(monthLabel(j.startDate,1)), badge(`المدة: ${fmtInt(j.duration)} شهر`), badge(`مبلغ الجمعية: ${fmtMoney(j.goal)} ريال`));

  // تفعيل/تعطيل زر الإضافة (+)
  const started=hasStarted(j);
  $('#addMemberBtn').disabled = started;
  $('#fabAdd').disabled = started;

  // افتح قسم الأعضاء تلقائيًا أول مرة
  const onceKey=`opened:${j.id}`;
  if(!localStorage.getItem(onceKey)){
    $('#membersBlock').setAttribute('open','');
    localStorage.setItem(onceKey,'1');
  }

  // إعداد
  populateMonthOptions(j, $('#am-month'));
  renderMembers(j);
  renderSchedule(j);
  updateCounters(j);

  setDetailsSectionsVisible(true);
  show($('#details'));
  $('#details')?.scrollIntoView({behavior:'smooth',block:'start'});
  saveAll();
}
function badge(t){const s=document.createElement('span');s.className='badge';s.textContent=t;return s;}

/* الأعضاء + الأدوات */
function computeOverdueMembers(j){ return (j.members||[]).filter(m=>{ensurePayments(j,m); return m.overdueCount>0;}).length; }

function renderMembers(j){
  const body=$('#memberTableBody'), empty=$('#emptyMembers'); body.innerHTML=''; const list=[...j.members];
  updateCounters(j);

  // معلومات المتأخرين
  const overdueCount=computeOverdueMembers(j);
  $('#mOverdueInfo').textContent = overdueCount ? `متأخرون: ${fmtInt(overdueCount)}` : '';

  // بحث/فلتر/ترتيب
  let rows=list.map(m=>{ensurePayments(j,m); return m;});

  if(state.memberQuery){
    const q=state.memberQuery;
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

  if(rows.length===0){
    empty.classList.remove('hidden');
  }else{
    empty.classList.add('hidden');
  }

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
      ['الاستحقاق الكلي', `${fmtMoney(m.entitlement)} ريال`],
      ['مدفوع حتى الآن', `
         <span class="badge">${fmtMoney(paid)} ريال</span>
         <span class="badge">المتبقي: ${fmtMoney(remainingMoney)} ريال</span>
         <small class="hint">(${m.paidCount} / ${j.duration})</small>`],
      ['شهر الاستلام', monthLabel(j.startDate,m.month)],
      ['', '']
    ];

    cells.forEach(([label,val],i)=>{
      const td=document.createElement('td'); td.setAttribute('data-col',label); td.innerHTML=val;
      if(i===6){
        const wrap=document.createElement('div'); wrap.style.display='flex'; wrap.style.gap='8px';
        const btnPay=document.createElement('button'); btnPay.className='btn'; btnPay.textContent='دفعات'; btnPay.addEventListener('click',()=>openPayModal(m.id));
        const btnDel=document.createElement('button'); btnDel.className='btn danger'; btnDel.textContent='حذف';
        btnDel.addEventListener('click',()=>{
          if(hasStarted(j)){toast('بدأت الجمعية. لا يمكن تعديل الأعضاء.');return;}
          if(!confirm(`حذف ${m.name}؟`))return;
          j.members=j.members.filter(x=>x.id!==m.id);
          saveAll(); renderMembers(j); renderSchedule(j); populateMonthOptions(j,$('#am-month')); updateCounters(j);
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

/* تعبئة الشهور لاختيار شهر الاستلام */
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

/* تعديل (Modal) */
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

/* الجدول الشهري – نسخة البلاطات */
function renderSchedule(j){
  const grid = $('#scheduleGrid');
  const details = $('#monthDetails');
  const mdTitle = $('#md-title');
  const mdBody = $('#md-body');
  const autoExpand = $('#schedAutoExpand');

  grid.innerHTML = '';
  hide(details);

  for(let i=1;i<=j.duration;i++){
    const {rec, assigned, remaining, pct} = monthStats(j,i);
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

    // فتح تلقائي (اختياري)
    if(autoExpand.checked && rec.length){
      tile.click();
    }
  }

  updateCounters(j);
}

/* دفعات (Modal) */
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
  recalcMemberCounters(j,m); saveAll(); renderMembers(j); hide($('#payModal')); toast('تم حفظ الدفعات');
}

/* حذف/رجوع + PDF */
function onDeleteJamiyah(){ const j=currentJamiyah(); if(!j) return;
  if(!confirm(`حذف ${j.name}؟ لا يمكن التراجع.`)) return;
  state.jamiyahs=state.jamiyahs.filter(x=>x.id!==j.id); saveAll(); showList(); renderList(); toast('تم حذف الجمعية'); }
function showList(){ hide($('#details')); state.currentId=null; setDetailsSectionsVisible(false); $('#fabAdd').disabled=true; }

function exportPdf(j){ if(!j) return;
  const css=`<style>@page{size:A4;margin:14mm}body{font-family:-apple-system,Segoe UI,Roboto,Arial,"Noto Naskh Arabic","IBM Plex Sans Arabic",sans-serif;color:#111}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.meta{color:#555;font-size:12px;margin-bottom:12px}h2{margin:18px 0 8px;font-size:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:right;font-size:12px;vertical-align:top}thead th{background:#f3f4f6}tfoot td{font-weight:700;background:#fafafa}.muted{color:#666}</style>`;
  const jx=j, members=jx.members.slice().sort((a,b)=>a.month-b.month||a.name.localeCompare(b.name));
  const rows=members.map((m,i)=>{const {paid}=memberPaidSummary(jx,m);const c=recalcMemberCounters(jx,m);
    return `<tr><td>${i+1}</td><td>${m.name}</td><td>${fmtMoney(m.pay)} ريال</td><td>${fmtMoney(m.entitlement)} ريال</td><td>${fmtMoney(paid)} ريال (${c.paidCount}/${jx.duration})</td><td>${monthLabel(jx.startDate,m.month)}</td></tr>`;}).join('');
  const totPay=members.reduce((s,m)=>s+Number(m.pay||0),0),totEnt=members.reduce((s,m)=>s+Number(m.entitlement||0),0);
  const sched=Array.from({length: jx.duration},(_,k)=>k+1).map(i=>{
    const rec=jx.members.filter(m=>Number(m.month)===i).sort((a,b)=>a.name.localeCompare(b.name));
    const txt=rec.length?rec.map(r=>`${r.name} (${fmtMoney(r.entitlement)} ريال)`).join('، '):'—';
    return `<tr><td>${monthLabel(jx.startDate,i)}</td><td>${txt}</td></tr>`;
  }).join('');
  const html=`<html dir="rtl" lang="ar"><head><meta charset="utf-8" /><title>${jx.name}</title>${css}</head><body>
  <header><h1>جمعيتي</h1><div>${new Date().toLocaleDateString('en-GB')}</div></header>
  <div class="meta">${monthLabel(jx.startDate,1)} · المدة: ${fmtInt(jx.duration)} شهر · مبلغ الجمعية: ${fmtMoney(jx.goal)} ريال</div>
  <h2>الأعضاء</h2>
  <table><thead><tr><th>#</th><th>الاسم</th><th>المساهمة</th><th>الاستحقاق الكلي</th><th>مدفوع (عدد)</th><th>شهر الاستلام</th></tr></thead>
  <tbody>${rows||`<tr><td colspan="6" class="muted">لا يوجد أعضاء</td></tr>`}</tbody>
  <tfoot><tr><td colspan="2">الإجمالي</td><td>${fmtMoney(totPay)} ريال</td><td>${fmtMoney(totEnt)} ريال</td><td colspan="2"></td></tr></tfoot></table>
  <h2>الجدول الشهري</h2>
  <table><thead><tr><th>الشهر</th><th>المستلمون</th></tr></thead><tbody>${sched}</tbody></table>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}</script></body></html>`;
  const w=window.open('','_blank');w.document.open();w.document.write(html);w.document.close();
}