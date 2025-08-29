/* جمعيتي v1.1 — كل الأقسام قابلة للإخفاء + أزرار ملوّنة + تبسيط واجهة
   (يحافظ على v1.0: تاريخ البداية 01، تصدير PDF، منطق الأشهر/الأرقام) */

const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const SKEY="jamiyati:v02";

const state={
  jamiyahs:loadAll(),
  currentId:null,
  filter:"",
  memberSearch:"",
  memberSort:"month",
  scheduleFilter:"all"
};

/* Formatting */
const fmtMoney=n=>Number(n||0).toLocaleString('en-US');
const fmtInt=n=>Number(n||0).toLocaleString('en-US');
function monthLabel(startDate,offset){ const d=new Date(startDate); d.setMonth(d.getMonth()+(offset-1)); return d.toLocaleDateString('en-US',{month:'long',year:'numeric'}); }
const hasStarted=j=> new Date().setHours(0,0,0,0) >= new Date(j.startDate).setHours(0,0,0,0);
const startedStatus=j=> hasStarted(j)?'Started':`Starts ${j.startDate}`;
const uid=()=>Math.random().toString(36).slice(2,10);
function addMonths(dateStr,i){ const d=new Date(dateStr); d.setMonth(d.getMonth()+i); return d.toISOString().slice(0,10); }
function toast(msg){ const box=$('#toasts'); const el=document.createElement('div'); el.className='toast'; el.textContent=msg; box.appendChild(el); setTimeout(()=>el.remove(),2500); }
function setError(id,text){ const el=$(`#${id}`); if(el) el.textContent=text||''; }
function normalizeToMonthStart(dateStr){ if(!dateStr) return ""; const d=new Date(dateStr); if(isNaN(d)) return ""; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); return `${y}-${m}-01`; }

/* Storage & migration */
function migrateV01toV02(old){ return (old||[]).map(j=>({...j,goal:Number(j.goal||0),members:(j.members||[]).map(m=>({...m,entitlement:Number.isFinite(m.entitlement)?Number(m.entitlement):Number(m.pay||0)*Number(j.duration||0)}))})); }
function loadAll(){ try{ const v02=JSON.parse(localStorage.getItem(SKEY)); if(Array.isArray(v02)) return v02; const v01=JSON.parse(localStorage.getItem("jamiyati:v01")); if(Array.isArray(v01)){ const migrated=migrateV01toV02(v01); localStorage.setItem(SKEY,JSON.stringify(migrated)); return migrated; } return []; }catch{ return []; } }
function saveAll(){ localStorage.setItem(SKEY,JSON.stringify(state.jamiyahs)); }

/* Init */
document.addEventListener('DOMContentLoaded',()=>{
  // Create
  $('#jamiyahForm').addEventListener('submit',onCreateJamiyah);
  $('#j-start').addEventListener('change',e=>{ const v=normalizeToMonthStart(e.target.value); if(v) e.target.value=v; });

  // Details actions
  $('#deleteJamiyah').addEventListener('click',onDeleteJamiyah);
  $('#backBtn').addEventListener('click',()=>$('#details').classList.add('hidden'));
  $('#exportBtn').addEventListener('click',()=>exportPdf(currentJamiyah()));

  // Edit
  $('#editForm').addEventListener('submit',onSaveEdit);
  $('#cancelEdit').addEventListener('click',e=>{ e.preventDefault(); $('#editBlock').open=false; });
  $('#e-start').addEventListener('change',e=>{ const v=normalizeToMonthStart(e.target.value); if(v) e.target.value=v; });

  // Member add
  $('#memberForm').addEventListener('submit',onAddMember);
  $('#m-month').addEventListener('change',updateMonthHint);
  $('#m-pay').addEventListener('input',updateMonthHint);

  // Toolbars
  $('#search').addEventListener('input',e=>{ state.filter=(e.target.value||'').trim(); renderList(); });
  $('#memberSearch').addEventListener('input',e=>{ state.memberSearch=(e.target.value||'').trim(); renderMembers(currentJamiyah()); });
  $('#memberSort').addEventListener('change',e=>{ state.memberSort=e.target.value; renderMembers(currentJamiyah()); });
  $('#scheduleFilter').addEventListener('change',e=>{ state.scheduleFilter=e.target.value; renderSchedule(currentJamiyah()); });

  renderList();
});

/* Create */
function onCreateJamiyah(e){
  e.preventDefault();
  setError('err-j-name'); setError('err-j-start'); setError('err-j-duration'); setError('err-j-goal');

  const name=$('#j-name').value.trim();
  let startDate=$('#j-start').value;
  const duration=parseInt($('#j-duration').value);
  const goal=parseInt($('#j-goal').value);

  let ok=true;
  if(!name){ setError('err-j-name','required'); ok=false; }
  if(!startDate){ setError('err-j-start','required'); ok=false; }
  if(!duration||duration<1){ setError('err-j-duration','min 1'); ok=false; }
  if(!goal||goal<=0){ setError('err-j-goal','> 0'); ok=false; }
  if(!ok) return;

  startDate=normalizeToMonthStart(startDate);
  $('#j-start').value=startDate;

  if(state.jamiyahs.some(j=>j.name===name)){ setError('err-j-name','name exists'); return; }

  const jamiyah={ id:uid(), name, startDate, duration, goal, members:[], createdAt:Date.now() };
  state.jamiyahs.push(jamiyah); saveAll();

  e.target.reset(); toast('تم إنشاء الجمعية');
  renderList();
}

/* List */
function renderList(){
  const list=$('#jamiyahList'); const empty=$('#emptyList'); const pill=$('#jamiyahCountPill');
  const items=state.jamiyahs.filter(j=>!state.filter||j.name.includes(state.filter)).sort((a,b)=>a.name.localeCompare(b.name));
  list.innerHTML=''; pill.textContent=fmtInt(items.length);
  if(items.length===0){ empty.classList.remove('hidden'); } else { empty.classList.add('hidden'); }

  items.forEach(j=>{
    const totalEnt=j.members.reduce((s,m)=>s+Number(m.entitlement||0),0);
    const row=document.createElement('div'); row.className='item';
    row.innerHTML=`
      <div>
        <div><strong>${j.name}</strong></div>
        <div class="meta">
          <span>من ${j.startDate} · ${fmtInt(j.duration)} شهر</span>
          <span class="badge">الهدف: ${fmtMoney(j.goal)}</span>
          <span class="badge">${startedStatus(j)}</span>
          <span class="badge">استحقاقات: ${fmtMoney(totalEnt)}</span>
        </div>
      </div>
      <button class="btn primary" data-id="${j.id}">فتح</button>
    `;
    row.querySelector('button').addEventListener('click',()=>openDetails(j.id));
    list.appendChild(row);
  });

  if(state.jamiyahs.length===0) $('#details').classList.add('hidden');
}

/* Open details */
function currentJamiyah(){ return state.jamiyahs.find(x=>x.id===state.currentId); }

function openDetails(id){
  state.currentId=id; const j=currentJamiyah(); if(!j) return;

  $('#d-title').textContent=j.name;
  $('#d-period').textContent=`من ${j.startDate} لمدة ${fmtInt(j.duration)} شهر`;
  $('#d-goal').textContent=`الهدف الشهري: ${fmtMoney(j.goal)}`;
  $('#d-status').textContent=startedStatus(j);

  const started=hasStarted(j);
  $('#startedAlert').hidden=!started;
  $('#memberForm').querySelectorAll('input,button,select').forEach(el=>{ el.disabled=started; });

  $('#e-name').value=j.name; $('#e-goal').value=j.goal; $('#e-start').value=j.startDate; $('#e-duration').value=j.duration;
  $('#e-start').disabled=started; $('#e-duration').disabled=started;

  populateMonthOptions(j); populateScheduleFilter(j); updateMonthHint();
  renderMembers(j); renderSchedule(j); updateMembersSummary(j); updateScheduleSummary(j);

  const isMobile=window.matchMedia('(max-width:640px)').matches;
  $('#membersBlock').open=!isMobile; $('#scheduleBlock').open=!isMobile;

$('#details').classList.remove('hidden');
document.getElementById('details').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* Helpers */
function monthAssignedTotal(j,month){ return j.members.filter(m=>Number(m.month)===Number(month)).reduce((s,m)=>s+Number(m.entitlement||0),0); }
function maxMonthlyForMonth(j,month){ const remaining=Math.max(0,j.goal-monthAssignedTotal(j,month)); return Math.floor(remaining/j.duration); }
function colorForMonth(i){ const colors=["#22c55e","#16a34a","#2dd4bf","#60a5fa","#a78bfa","#f472b6","#f59e0b"]; return colors[(i-1)%colors.length]; }

function populateMonthOptions(j){
  const select=$('#m-month'); const current=select.value; select.innerHTML='';
  for(let i=1;i<=j.duration;i++){
    const maxMonthly=maxMonthlyForMonth(j,i);
    const o=document.createElement('option');
    o.value=i; o.textContent=`${monthLabel(j.startDate,i)} · Max monthly: ${fmtMoney(maxMonthly)} SAR${maxMonthly<=0?' · FULL':''}`;
    if(maxMonthly<=0) o.disabled=true; select.appendChild(o);
  }
  if(current && Number(current)>=1 && Number(current)<=j.duration) select.value=current;
}
function populateScheduleFilter(j){
  const sel=$('#scheduleFilter'); const cur=state.scheduleFilter; sel.innerHTML='';
  const all=document.createElement('option'); all.value='all'; all.textContent='كل الشهور'; sel.appendChild(all);
  for(let i=1;i<=j.duration;i++){ const opt=document.createElement('option'); opt.value=String(i); opt.textContent=monthLabel(j.startDate,i); sel.appendChild(opt); }
  sel.value=cur||'all';
}

/* Edit */
function onSaveEdit(e){
  e.preventDefault(); setError('err-e-name'); setError('err-e-goal');
  const j=currentJamiyah(); if(!j) return;

  const newName=$('#e-name').value.trim();
  const newGoal=parseInt($('#e-goal').value);
  let newStart=$('#e-start').value;
  const newDuration=parseInt($('#e-duration').value);
  const started=hasStarted(j);

  if(!newName){ setError('err-e-name','required'); return; }
  if(state.jamiyahs.some(x=>x.id!==j.id && x.name===newName)){ setError('err-e-name','name exists'); return; }
  if(!newGoal||newGoal<=0){ setError('err-e-goal','> 0'); return; }

  if(!started){
    if(!newStart){ toast('حدد تاريخ البداية'); return; }
    if(!newDuration||newDuration<1){ toast('المدة غير صحيحة'); return; }
    newStart=normalizeToMonthStart(newStart); $('#e-start').value=newStart;

    if(newDuration!==j.duration){
      j.members=j.members.map(m=>({...m,entitlement:Number(m.pay||0)*newDuration,month:Math.min(m.month,newDuration)}));
    }
    j.startDate=newStart; j.duration=newDuration;
  }

  j.name=newName; j.goal=newGoal; saveAll();
  openDetails(j.id); renderList(); $('#editBlock').open=false; toast('تم حفظ التعديلات');
}

/* Members */
function updateMembersSummary(j){ $('#mSummaryText').textContent='الأعضاء'; $('#mCountPill').textContent=fmtInt(j.members.length); }
function renderMembers(j){
  if(!j) return;
  const body=$('#memberTable tbody'); const empty=$('#emptyMembers'); const totPay=$('#totPay'); const totEnt=$('#totEnt');
  body.innerHTML='';
  let rows=j.members.slice();
  if(state.memberSearch){ const q=state.memberSearch.toLowerCase(); rows=rows.filter(m=>(m.name||'').toLowerCase().includes(q)); }
  if(state.memberSort==='name'){ rows.sort((a,b)=>a.name.localeCompare(b.name)||a.month-b.month); }
  else if(state.memberSort==='pay'){ rows.sort((a,b)=>b.pay-a.pay||a.month-b.month); }
  else { rows.sort((a,b)=>a.month-b.month||a.name.localeCompare(b.name)); }

  let totalPay=0,totalEnt=0;
  if(rows.length===0){ empty.classList.remove('hidden'); }
  else{
    empty.classList.add('hidden');
    rows.forEach((m,idx)=>{
      totalPay+=Number(m.pay||0); totalEnt+=Number(m.entitlement||0);
      const tr=document.createElement('tr'); tr.className='row-accent'; tr.style.borderInlineStartColor=colorForMonth(m.month);
      const cols=[['#',fmtInt(idx+1)],['الاسم',m.name],['المساهمة',fmtMoney(m.pay)],['الاستحقاق',fmtMoney(m.entitlement)],['شهر الاستلام',monthLabel(j.startDate,m.month)],['','']];
      cols.forEach(([label,val],i)=>{ const td=document.createElement('td'); td.setAttribute('data-col',label); td.innerHTML=val;
        if(i===5){ const btn=document.createElement('button'); btn.className='btn danger'; btn.textContent='حذف';
          btn.addEventListener('click',()=>{ const jx=currentJamiyah(); if(!jx) return; if(hasStarted(jx)){ toast('بدأت الجمعية. لا يمكن تعديل الأعضاء.'); return; }
            if(!confirm(`حذف ${m.name}؟`)) return; jx.members=jx.members.filter(x=>x.id!==m.id); saveAll();
            renderMembers(jx); renderSchedule(jx); renderList(); populateMonthOptions(jx); updateMonthHint(); updateMembersSummary(jx); toast('تم حذف العضو'); });
          td.appendChild(btn); }
        tr.appendChild(td); });
      body.appendChild(tr);
    });
  }
  totPay.textContent=fmtMoney(totalPay); totEnt.textContent=fmtMoney(totalEnt); updateMembersSummary(j);
}

/* Add member */
function onAddMember(e){
  e.preventDefault(); setError('err-m-name'); setError('err-m-pay'); setError('err-m-month');
  const j=currentJamiyah(); if(!j) return; if(hasStarted(j)){ toast('بدأت الجمعية. لا يمكن إضافة أعضاء جدد.'); return; }

  const name=$('#m-name').value.trim(); const pay=parseInt($('#m-pay').value); const month=parseInt($('#m-month').value);
  let ok=true; if(!name){ setError('err-m-name','required'); ok=false; } if(!pay||pay<1){ setError('err-m-pay','min 1'); ok=false; } if(!month){ setError('err-m-month','required'); ok=false; }
  if(!ok) return;

  if(month<1||month>j.duration){ setError('err-m-month',`1..${fmtInt(j.duration)}`); return; }
  const maxMonthly=maxMonthlyForMonth(j,month); if(pay>maxMonthly){ setError('err-m-pay',`max ${fmtMoney(maxMonthly)}`); return; }

  const entitlement=pay*j.duration; const already=monthAssignedTotal(j,month); const remaining=j.goal-already;
  if(entitlement>remaining){ setError('err-m-pay',`exceeds by ${fmtMoney(entitlement-remaining)}`); return; }

  j.members.push({id:uid(),name,pay,month,entitlement}); saveAll();
  e.target.reset(); populateMonthOptions(j); renderMembers(j); renderSchedule(j); renderList(); updateMonthHint(); updateMembersSummary(j); toast('تمت إضافة العضو');
}

/* Schedule */
function updateScheduleSummary(j){ $('#sSummaryText').textContent='الجدول الشهري'; $('#sCountPill').textContent=fmtInt(j.duration); }
function renderSchedule(j){
  if(!j) return; const body=$('#scheduleTable tbody'); body.innerHTML='';
  const months=[]; for(let i=1;i<=j.duration;i++){ if(state.scheduleFilter==='all'||String(i)===state.scheduleFilter) months.push(i); }
  months.forEach(i=>{
    const date=addMonths(j.startDate,i-1);
    const receivers=j.members.filter(m=>Number(m.month)===i).sort((a,b)=>a.name.localeCompare(b.name));
    const totalAssigned=receivers.reduce((s,m)=>s+Number(m.entitlement||0),0); const remaining=Math.max(0,j.goal-totalAssigned);
    const receiversText=receivers.length?receivers.map(r=>`${r.name} (${fmtMoney(r.entitlement)})`).join('، '):'—';
    const tr=document.createElement('tr'); tr.className='row-accent'; tr.style.borderInlineStartColor=colorForMonth(i);
    [['الشهر',monthLabel(j.startDate,i)],['التاريخ',date],['المستلمون',receiversText],['المصروف · المتبقي',`المصروف: ${fmtMoney(totalAssigned)} · المتبقي: ${fmtMoney(remaining)}`]]
      .forEach(([label,val])=>{ const td=document.createElement('td'); td.setAttribute('data-col',label); td.innerHTML=val; body.appendChild(tr).appendChild(td); });
  });
  updateScheduleSummary(j);
}

/* Hint */
function updateMonthHint(){
  const j=currentJamiyah(); const hint=$('#monthHint'); const sel=$('#m-month');
  if(!j||!sel||!sel.value){ hint.textContent=''; return; }
  const monthVal=parseInt(sel.value); const maxMonthly=maxMonthlyForMonth(j,monthVal); const pay=parseInt($('#m-pay').value||'0');
  let line=`Max monthly في ${monthLabel(j.startDate,monthVal)}: ${fmtMoney(maxMonthly)} SAR`;
  if(pay){ line += pay>maxMonthly?` · أعلى من الحد (${fmtMoney(pay)})`:` · ضمن الحد (${fmtMoney(pay)})`; }
  hint.textContent=line;
}

/* Delete */
function onDeleteJamiyah(){
  const j=currentJamiyah(); if(!j) return;
  if(!confirm(`حذف ${j.name}؟`)) return;
  state.jamiyahs=state.jamiyahs.filter(x=>x.id!==j.id); saveAll(); $('#details').classList.add('hidden'); renderList(); toast('تم حذف الجمعية');
}

/* Export PDF (نفس نسخة v1.0) */
function exportPdf(j){
  if(!j) return;
  const css=`<style>@page{size:A4;margin:16mm}body{font-family:-apple-system,Segoe UI,Roboto,Arial,"Noto Naskh Arabic","IBM Plex Sans Arabic",sans-serif;color:#111}
  header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.logo{width:20px;height:20px}
  .meta{color:#555;font-size:12px;margin-bottom:12px}h2{margin:18px 0 8px;font-size:16px}
  table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:right;font-size:12px;vertical-align:top}
  thead th{background:#f3f4f6}tfoot td{font-weight:700;background:#fafafa}footer{margin-top:20px;font-size:11px;color:#666;display:flex;justify-content:space-between}
  </style>`;
  const members=j.members.slice().sort((a,b)=>a.month-b.month||a.name.localeCompare(b.name));
  const membersRows=members.map((m,i)=>`<tr><td>${i+1}</td><td>${m.name}</td><td>${fmtMoney(m.pay)}</td><td>${fmtMoney(m.entitlement)}</td><td>${monthLabel(j.startDate,m.month)}</td></tr>`).join('');
  const totPay=members.reduce((s,m)=>s+Number(m.pay||0),0), totEnt=members.reduce((s,m)=>s+Number(m.entitlement||0),0);
  const scheduleRows=Array.from({length:j.duration},(_,k)=>{ const i=k+1; const rec=j.members.filter(m=>Number(m.month)===i).sort((a,b)=>a.name.localeCompare(b.name));
    const assigned=rec.reduce((s,m)=>s+Number(m.entitlement||0),0); const rem=Math.max(0,j.goal-assigned);
    const text=rec.length?rec.map(r=>`${r.name} (${fmtMoney(r.entitlement)})`).join('، '):'—';
    return `<tr><td>${monthLabel(j.startDate,i)}</td><td>${addMonths(j.startDate,i-1)}</td><td>${text}</td><td>Spent: ${fmtMoney(assigned)} · Left: ${fmtMoney(rem)}</td></tr>`; }).join('');
  const html=`<html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>Jamiyati - ${j.name}</title>${css}</head><body>
    <header><div class="brand"><svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" aria-hidden="true"><defs><linearGradient id="lg" x1="0" x2="1"><stop stop-color="#22c55e"/><stop offset="1" stop-color="#16a34a"/></linearGradient></defs><circle cx="64" cy="50" r="22" fill="url(#lg)"></circle><path d="M24 98c8-16 26-26 40-26s32 10 40 26" stroke="#22c55e" stroke-width="8" fill="none" stroke-linecap="round"></path></svg><h1 style="margin:0 8px">جمعيتي</h1></div><div class="meta">${new Date().toLocaleDateString('en-GB')}</div></header>
    <div class="meta"><div>الاسم: <strong>${j.name}</strong></div><div>الفترة: من ${j.startDate} لمدة ${fmtInt(j.duration)} شهر</div><div>الهدف الشهري: ${fmtMoney(j.goal)} SAR</div></div>
    <h2>الأعضاء</h2><table><thead><tr><th>#</th><th>الاسم</th><th>المساهمة (شهريًا)</th><th>الاستحقاق</th><th>شهر الاستلام</th></tr></thead><tbody>${membersRows||'<tr><td colspan="5">لا يوجد أعضاء</td></tr>'}</tbody>
    <tfoot><tr><td colspan="2">الإجمالي</td><td>${fmtMoney(totPay)}</td><td>${fmtMoney(totEnt)}</td><td></td></tr></tfoot></table>
    <h2>الجدول الشهري</h2><table><thead><tr><th>الشهر</th><th>التاريخ</th><th>المستلمون</th><th>المصروف · المتبقي</th></tr></thead><tbody>${scheduleRows}</tbody></table>
    <footer><span>© Aseel Thalnoon</span><span>Jamiyati · Printable</span></footer>
    <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(),300);}</script></body></html>`;
  const w=window.open('','_blank'); w.document.open(); w.document.write(html); w.document.close();
}