// Monthly-only ROSCA. Members + monthly pays are fixed once locked. Target + schedule included.
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const KEY='jam3eyti_locked_v1';

let st = {
  name:'جمعيتي',
  goal:0,                     // هدف الجمعية (SAR)
  startDate: isoToday(),      // بداية الجمعية (يوم الاستحقاق الشهري)
  endDate: null,              // يحسب تلقائيًا بعد بناء الجدول
  locked:false,               // يمنع أي تعديل على الأعضاء/المبالغ
  members:[],                 // {id,name,pay}
  rota:[],                    // [{slot,date,memberId}]
  payments:{}                 // {'cycle_1': {memberId: ISO}, ...}
};

function isoToday(){ return new Date().toISOString().slice(0,10); }
function save(){ localStorage.setItem(KEY, JSON.stringify(st)); }
function load(){ const raw=localStorage.getItem(KEY); if(raw){ try{ st=JSON.parse(raw);}catch{} } if(!st.startDate) st.startDate=isoToday(); }

function addMonths(dateStr, k){
  const d=new Date(dateStr); d.setMonth(d.getMonth()+k); return d.toISOString().slice(0,10);
}
function sumPays(){ return st.members.reduce((a,m)=>a+(+m.pay||0),0); }

function uid(){ return Math.random().toString(36).slice(2,9); }
function SAR(n){ return Number(n||0).toLocaleString('ar-SA'); }

// === Shares from pay (fixed at lock time) ===
function calcShares(){
  if (!st.members.length) return {unit:1,total:0,map:{}};
  const pays = st.members.map(m=>+m.pay||1);
  const unit = Math.max(1, Math.min(...pays));  // أصغر مبلغ = وحدة
  const map={}; let total=0;
  st.members.forEach(m=>{
    const s = Math.max(1, Math.round((+m.pay||1)/unit));
    map[m.id]=s; total+=s;
  });
  return {unit,total,map};
}

// === Build schedule (monthly) ===
function buildSchedule(){
  const pot = sumPays();
  if (pot<=0) return alert('أضف أعضاء ومبالغ صحيحة.');
  const sh = calcShares();

  // توسعة الأدوار حسب shares
  const order=[];
  st.members.forEach(m=>{
    for (let i=0;i<(sh.map[m.id]||0);i++) order.push(m.id);
  });

  st.rota = order.map((memberId, idx)=>({
    slot: idx+1,
    date: addMonths(st.startDate, idx), // شهريًا
    memberId
  }));

  // تاريخ النهاية = آخر تاريخ في الجدول
  st.endDate = st.rota.length? st.rota[st.rota.length-1].date : st.startDate;
  save(); renderAll(); alert('تم قفل الجمعية وبناء الجدول.');
}

// === UI ===
function renderHeader(){
  $('#assocName').value = st.name || '';
  $('#goal').value = st.goal || 0;
  $('#startDate').value = st.startDate || isoToday();
  $('#endDate').value = st.endDate || '';
  $('#lockMsg').textContent = st.locked? 'تم قفل الجمعية: لا يمكن إضافة أعضاء أو تعديل مبالغ.' : 'يمكنك إضافة الأعضاء وتحديد مبالغهم ثم اضغط قفل.';
  document.body.classList.toggle('locked', st.locked);
  // تفعيل/تعطيل
  const disable = st.locked;
  ['memberName','memberPay','addMember'].forEach(id=>{
    const el = document.getElementById(id); if (el) el.disabled = disable;
  });
  $('#lockBuild').classList.toggle('disabled', st.locked);
}

function renderMembers(){
  const tb = $('#membersTable tbody'); tb.innerHTML='';
  const pot = sumPays();
  const sh = calcShares();

  st.members.forEach((m,i)=>{
    const myShares = sh.map[m.id]||0;
    const myTotal = myShares * pot;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${st.locked? `<span>${m.name}</span>` : `<input class="nameEdit" data-id="${m.id}" value="${m.name}">`}</td>
      <td>${st.locked? `<span>${SAR(m.pay)}</span>` : `<input class="payEdit" data-id="${m.id}" type="number" min="1" value="${m.pay}">`}</td>
      <td class="muted">${myShares} دور</td>
      <td><b>${SAR(myTotal)}</b> ر.س</td>
      <td>${st.locked? '' : `<button class="delBtn" data-id="${m.id}">حذف</button>`}</td>
    `;
    tb.appendChild(tr);
  });

  $('#pot').textContent = SAR(pot);

  if (!st.locked){
    tb.querySelectorAll('.nameEdit').forEach(inp=>{
      inp.addEventListener('change',()=>{ const m=st.members.find(x=>x.id===inp.dataset.id); m.name=inp.value.trim(); save(); renderMembers(); });
    });
    tb.querySelectorAll('.payEdit').forEach(inp=>{
      inp.addEventListener('change',()=>{ const m=st.members.find(x=>x.id===inp.dataset.id); m.pay=Math.max(1,+inp.value||1); save(); renderMembers(); });
    });
    tb.querySelectorAll('.delBtn').forEach(btn=>{
      btn.addEventListener('click',()=>{ st.members = st.members.filter(x=>x.id!==btn.dataset.id); save(); renderMembers(); renderRota(); renderPayments(); });
    });
  }
}

function renderRota(){
  const tb = $('#rotaTable tbody'); tb.innerHTML='';
  const pot = sumPays();
  st.rota.forEach(r=>{
    const m = st.members.find(x=>x.id===r.memberId);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.slot}</td><td>${r.date}</td><td>${m?m.name:'-'}</td><td>${SAR(pot)} ر.س</td>`;
    tb.appendChild(tr);
  });
  // fill cycles select
  const sel = $('#cycleSelect'); sel.innerHTML='';
  st.rota.forEach(r=>{
    const m = st.members.find(x=>x.id===r.memberId);
    const o = document.createElement('option');
    o.value = r.slot; o.textContent = `دورة ${r.slot} • ${r.date} • ${m?m.name:''}`;
    sel.appendChild(o);
  });
}

function nearestCycleIndex(){
  const today = isoToday(); let i=0;
  for (; i<st.rota.length; i++){ if (st.rota[i].date >= today) break; }
  return i;
}

function renderPayments(){
  const tb = $('#paymentsTable tbody'); tb.innerHTML='';
  if (!st.rota.length){ tb.innerHTML = '<tr><td colspan="4">ابنِ الجدول أولًا.</td></tr>'; return; }
  const slot = +($('#cycleSelect').value||1);
  const key = 'cycle_'+slot;
  if (!st.payments[key]) st.payments[key]={};

  st.members.forEach(m=>{
    const paidAt = st.payments[key][m.id] || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.name}</td>
      <td>${SAR(m.pay)} ر.س</td>
      <td><input type="checkbox" data-id="${m.id}" ${paidAt?'checked':''}></td>
      <td>${paidAt? new Date(paidAt).toLocaleDateString('ar-SA'):''}</td>
    `;
    tb.appendChild(tr);
  });

  tb.querySelectorAll('input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('change',()=>{
      const id = cb.dataset.id;
      if (cb.checked) st.payments[key][id] = new Date().toISOString();
      else delete st.payments[key][id];
      save(); renderPayments(); updateGoalProgress();
    });
  });
}

function updateEndDate(){
  st.endDate = st.rota.length? st.rota[st.rota.length-1].date : '';
  $('#endDate').value = st.endDate || '';
}

function distributedSoFar(){
  // نحسب كم شهر/دورة مدفوعة بالكامل (جميع الأعضاء دفعوا)
  let total = 0, pot = sumPays();
  st.rota.forEach(r=>{
    const key = 'cycle_'+r.slot;
    const paidMap = st.payments[key]||{};
    const allPaid = st.members.length && (Object.keys(paidMap).length === st.members.length);
    if (allPaid) total += pot;
  });
  return total;
}
function updateGoalProgress(){
  const dist = distributedSoFar();
  const goal = +st.goal||0;
  const pct = goal>0 ? Math.min(100, Math.round((dist/goal)*100)) : 0;
  $('#goalBar').style.width = pct+'%';
  $('#goalInfo').textContent = `التقدّم: ${pct}% • موزّع: ${SAR(dist)} • الهدف: ${SAR(goal)}`;
}

function renderAll(){
  renderHeader(); renderMembers(); renderRota(); renderPayments(); updateEndDate(); updateGoalProgress();
}

// === Actions ===
function lockAndBuild(){
  if (st.locked) return;
  if (!st.members.length) return alert('أضف عضوًا واحدًا على الأقل.');
  // تثبيت الإعدادات
  st.name = $('#assocName').value.trim() || st.name;
  st.goal = Math.max(0, +$('#goal').value||0);
  st.startDate = $('#startDate').value || isoToday();
  st.locked = true;
  // بناء الجدول الشهري
  buildSchedule();
}

function shuffleRota(){
  if (!st.locked) return alert('اقفل الجمعية أولًا.');
  for (let i = st.rota.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [st.rota[i], st.rota[j]] = [st.rota[j], st.rota[i]];
  }
  // إعادة ترقيم التواريخ شهريًا
  st.rota = st.rota.map((r,i)=>({ ...r, slot:i+1, date:addMonths(st.startDate, i)}));
  save(); renderRota(); updateEndDate();
}

function sortByPay(){
  if (!st.locked) return alert('اقفل الجمعية أولًا.');
  const payMap = Object.fromEntries(st.members.map(m=>[m.id,+m.pay||0]));
  st.rota.sort((a,b)=> payMap[b.memberId]-payMap[a.memberId]);
  st.rota = st.rota.map((r,i)=>({ ...r, slot:i+1, date:addMonths(st.startDate, i)}));
  save(); renderRota(); updateEndDate();
}

// === Boot ===
document.addEventListener('DOMContentLoaded', ()=>{
  load(); renderAll();

  // inputs
  $('#assocName').addEventListener('change', e=>{ if(!st.locked){ st.name=e.target.value.trim(); save(); }});
  $('#goal').addEventListener('change', e=>{ st.goal=Math.max(0,+e.target.value||0); save(); updateGoalProgress(); });
  $('#startDate').addEventListener('change', e=>{ if(!st.locked){ st.startDate=e.target.value||isoToday(); save(); }});

  // members
  $('#addMember').addEventListener('click', ()=>{
    if (st.locked) return alert('ممنوع إضافة أعضاء بعد القفل.');
    const name = $('#memberName').value.trim();
    const pay  = Math.max(1, +($('#memberPay').value)||0);
    if (!name) return alert('اكتب اسم العضو');
    if (!pay)  return alert('أدخل مبلغًا شهريًا صحيحًا');
    st.members.push({id:uid(), name, pay});
    $('#memberName').value=''; $('#memberPay').value='';
    save(); renderMembers();
  });

  // lock/build
  $('#lockBuild').addEventListener('click', lockAndBuild);
  $('#unlock').addEventListener('click', ()=>{
    if (!confirm('للاختبار فقط: فك القفل سيلغي الجدول والمدفوعات. متابعة؟')) return;
    st.locked=false; st.rota=[]; st.payments={}; st.endDate=null; save(); renderAll();
  });

  // rota & payments
  $('#shuffle').addEventListener('click', shuffleRota);
  $('#sortByPay').addEventListener('click', sortByPay);
  $('#goToday').addEventListener('click', ()=>{ const i=nearestCycleIndex(); $('#cycleSelect').selectedIndex=i; renderPayments(); });

  $('#cycleSelect').addEventListener('change', renderPayments);
  $('#markAllPaid').addEventListener('click', ()=>{
    const slot=+($('#cycleSelect').value||1); const key='cycle_'+slot;
    if (!st.payments[key]) st.payments[key]={};
    st.members.forEach(m=> st.payments[key][m.id]=new Date().toISOString());
    save(); renderPayments(); updateGoalProgress();
  });
  $('#resetCycle').addEventListener('click', ()=>{
    const slot=+($('#cycleSelect').value||1); const key='cycle_'+slot;
    if (!confirm('مسح مدفوعات هذه الدورة؟')) return;
    st.payments[key]={}; save(); renderPayments(); updateGoalProgress();
  });

  // backup/export
  $('#backupJSON').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(st,null,2)],{type:'application/json'});
    download(blob, `jam3eyti_backup_${Date.now()}.json`);
  });
  $('#importJSON').addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=()=>{ try{
      const data=JSON.parse(r.result);
      if (data && data.members && Array.isArray(data.members)){ st=data; save(); renderAll(); alert('تم الاستعادة.'); }
      else alert('ملف غير صالح.');
    }catch{ alert('فشل الاستعادة.'); } };
    r.readAsText(f);
  });
  $('#exportCSV').addEventListener('click', ()=>{
    const pot=sumPays();
    const lines=[];
    // members
    lines.push('Member,MonthlyPay,TotalSlots,TotalReceiptsSAR');
    const sh=calcShares();
    st.members.forEach(m=>{
      const s=sh.map[m.id]||0;
      lines.push(`${csv(m.name)},${m.pay},${s},${s*pot}`);
    });
    lines.push('');
    // rota
    lines.push('Slot,Date,Receiver,PotSAR');
    st.rota.forEach(r=>{
      const m=st.members.find(x=>x.id===r.memberId);
      lines.push(`${r.slot},${r.date},${csv(m?m.name:'-')},${pot}`);
    });
    // payments summary
    lines.push('');
    lines.push('Cycle,Member,Paid,PaidAt');
    st.rota.forEach(r=>{
      const key='cycle_'+r.slot;
      st.members.forEach(m=>{
        const paidAt = st.payments[key]?.[m.id] || '';
        lines.push([r.slot, csv(m.name), paidAt?'YES':'NO', paidAt].join(','));
      });
    });
    const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'});
    download(blob, `jam3eyti_${st.name.replace(/\s+/g,'_')}.csv`);
  });
  $('#printView').addEventListener('click', ()=>window.print());
});

function csv(s){ if(s==null) return ''; s=String(s); return s.includes(',')?`"${s.replace(/"/g,'""')}"`:s; }
function download(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),500); }