/* app.js — v2.3.4 (Aseel minimal-diff)
   - إبقاء المنطق كما هو مع تفعيل "فتح/حفظ" (استيراد/تصدير JSON)
   - عدم تغيير أي شيء غير مرتبط فعليًا بالطلب
*/

// ===================== Helpers & State =====================
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const STORAGE_KEY = 'jam3eyti:data';
const KEY_BACKUP  = 'jam3eyti:backup';

const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; // شهور وأرقام بالإنجليزية حسب طلبك
const fmtMonth = (isoYMD) => {
  // expects YYYY-MM-01 or YYYY-MM
  if(!isoYMD) return '';
  const m = String(isoYMD).slice(5,7);
  const y = String(isoYMD).slice(0,4);
  const idx = Math.max(0, Math.min(11, parseInt(m,10)-1));
  return `${MONTHS_EN[idx]} ${y}`;
};

const state = {
  jamiyahs: [],
  currentId: null, // opened jamiyah id
};

// ===================== Persistence =====================
function loadAll(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      state.jamiyahs = JSON.parse(raw);
      // sanity
      state.jamiyahs.forEach(j=>{
        j.members = Array.isArray(j.members) ? j.members : [];
        j.members.forEach(m=>{
          if(!Array.isArray(m.payments)) m.payments = [];
        });
      });
    } else {
      state.jamiyahs = [];
    }
  }catch(e){
    console.error('loadAll error', e);
    state.jamiyahs = [];
  }
}

function saveAll(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.jamiyahs));
  }catch(e){
    console.error('saveAll error', e);
  }
}

// ===================== Toast =====================
function toast(msg, ms=2200){
  const wrap = $('#toasts');
  if(!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(()=>{ t.remove(); }, ms);
}

// ===================== ID helper =====================
function uid(){
  return Math.random().toString(36).slice(2,10);
}

// ===================== Init =====================
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  bindGlobalUI();
  renderList();
});

// ===================== Bind UI =====================
function bindGlobalUI(){
  const form = $('#jamiyahForm');
  form?.addEventListener('submit', onCreateJamiyah);

  $('#search')?.addEventListener('input', renderList);

  // تفاصيل الجمعية — أزرار
  $('#exportBtn')?.addEventListener('click', onExportPDF);
  $('#exportJsonBtn')?.addEventListener('click', exportJson);

  // فتح / حفظ (استيراد / تصدير)
  $('#importBtn')?.addEventListener('click', ()=> $('#importFile')?.click());
  $('#importFile')?.addEventListener('change', onImportJson);

  // أزرار عامة بالتفاصيل
  $('#backBtn')?.addEventListener('click', () => showSection('list'));
  $('#deleteJamiyah')?.addEventListener('click', onDeleteJamiyah);
  $('#editBtn')?.addEventListener('click', openEditModal);

  // أعضاء
  $('#addMemberBtn')?.addEventListener('click', openAddMemberModal);
  $('#fabAdd')?.addEventListener('click', ()=> {
    if(!state.currentId){ toast('افتح جمعية أولاً'); return; }
    openAddMemberModal();
  });

  $('#mFilter')?.addEventListener('change', renderMembers);
  $('#mSort')?.addEventListener('change', renderMembers);

  // شهر التفاصيل
  $('#md-close')?.addEventListener('click', ()=> $('#monthDetails')?.classList.add('hidden'));

  // استرجاع نسخة
  $('#restoreBtn')?.addEventListener('click', restoreFromBackup);
}

// ===================== Sections show/hide =====================
function showSection(which){
  const details = $('#details');
  const list    = $('#listBlock');
  const create  = $('#createBlock');
  if(which === 'details'){
    details?.classList.remove('hidden');
    details?.removeAttribute('hidden');
    list?.setAttribute('open','');
    create?.setAttribute('open','');
  } else {
    state.currentId = null;
    details?.classList.add('hidden');
    details?.setAttribute('hidden','');
  }
}

// ===================== Jamiyah CRUD =====================
function onCreateJamiyah(e){
  e.preventDefault();
  const name = $('#j-name').value.trim();
  const start = $('#j-start').value; // YYYY-MM
  const duration = parseInt($('#j-duration').value,10);
  const goal = parseInt($('#j-goal').value,10);

  let ok = true;
  $('#err-j-name').textContent = '';
  $('#err-j-start').textContent = '';
  $('#err-j-duration').textContent = '';
  $('#err-j-goal').textContent = '';

  if(!name){ $('#err-j-name').textContent = 'أدخل اسم الجمعية'; ok=false; }
  if(!start){ $('#err-j-start').textContent = 'اختر شهر البداية'; ok=false; }
  if(!(duration>0)){ $('#err-j-duration').textContent = 'المدة مطلوبة'; ok=false; }
  if(!(goal>0)){ $('#err-j-goal').textContent = 'أدخل مبلغ الجمعية'; ok=false; }

  if(!ok) return;

  const id = uid();
  const j = {
    id, name,
    start: `${start}-01`,
    duration,
    goal,
    members: [],
  };
  state.jamiyahs.push(j);
  saveAll();
  toast('تم إنشاء الجمعية');
  renderList();
}

function renderList(){
  const list = $('#jamiyahList');
  const empty = $('#emptyList');
  const pill = $('#jamiyahCountPill');
  if(!list) return;

  const q = ($('#search')?.value || '').trim().toLowerCase();
  const data = state.jamiyahs.filter(j => j.name.toLowerCase().includes(q));

  list.innerHTML = '';
  pill.textContent = String(data.length);

  if(!data.length){
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  data.forEach((j,idx)=>{
    const card = document.createElement('div');
    card.className = 'card jam-card';
    const meta = `${fmtMonth(j.start)} • ${j.duration}m • ${Number(j.goal).toLocaleString('en-US')} SAR`;

    card.innerHTML = `
      <div class="stack-1">
        <div class="stack-0">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div style="display:flex;flex-direction:column;gap:4px;">
              <div class="h2">${j.name}</div>
              <div class="meta" style="font-size:.85rem;color:#94a3b8;">${meta}</div>
            </div>
            <div class="jam-actions">
              <button class="icon-btn open-j" title="فتح الجمعية" aria-label="فتح">
                <!-- عين -->
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 5c-7.1 0-12 7-12 7s4.9 7 12 7 12-7 12-7-4.9-7-12-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"/></svg>
              </button>
              <button class="icon-btn edit-j" title="تعديل الجمعية" aria-label="تعديل">
                <!-- قلم -->
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm14.71-9.04 1.83-1.83a1 1 0 0 0 0-1.41L17.2 2.62a1 1 0 0 0-1.41 0L13.96 4.45l3.75 3.76Z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    $('.open-j', card)?.addEventListener('click', ()=> openDetails(j.id, {focus:'schedule'}));
    $('.edit-j', card)?.addEventListener('click', ()=> openEditModal(j.id));
    list.appendChild(card);
  });
}

function openDetails(id, opts={}){
  const j = state.jamiyahs.find(x=>x.id===id);
  if(!j){ toast('الجمعية غير موجودة'); return; }
  state.currentId = id;

  $('#d-title').textContent = j.name;
  $('#d-meta').textContent  = `${fmtMonth(j.start)} • ${j.duration}m • ${Number(j.goal).toLocaleString('en-US')} SAR`;

  // أرقام الملخص
  $('#mCountPill').textContent = String(j.members.length);
  $('#sCountPill').textContent = String(j.duration);

  // إظهار التفاصيل
  showSection('details');

  // إظهار/إخفاء مجموعات التفاصيل حسب المطلوب سابقًا
  $('#membersBlock')?.classList.remove('hidden');
  $('#scheduleBlock')?.classList.remove('hidden');

  renderMembers();
  renderSchedule();

  // خيار فتح الجدول مباشرة إذا جاء من زر "فتح الجمعية"
  if(opts.focus === 'schedule'){
    $('#membersBlock').removeAttribute('open');
    $('#scheduleBlock').setAttribute('open','');
  }
}

function onDeleteJamiyah(){
  if(!state.currentId) return;
  const j = state.jamiyahs.find(x=>x.id===state.currentId);
  if(!j) return;
  if(!confirm('حذف الجمعية؟')) return;
  state.jamiyahs = state.jamiyahs.filter(x=>x.id!==state.currentId);
  state.currentId = null;
  saveAll();
  toast('تم حذف الجمعية');
  renderList();
  showSection('list');
}

// ===================== Edit Jamiyah =====================
function openEditModal(id=state.currentId){
  const j = state.jamiyahs.find(x=>x.id===id);
  if(!j){ toast('الجمعية غير موجودة'); return; }
  $('#e-name').value = j.name;
  $('#e-goal').value = String(j.goal);
  $('#e-start').value = j.start.slice(0,7);
  $('#e-duration').value = String(j.duration);

  $('#err-e-name').textContent='';
  $('#err-e-goal').textContent='';

  $('#editModal')?.classList.remove('hidden');
  $('#editModal')?.removeAttribute('hidden');

  $('#saveEdit').onclick = ()=>{
    const name = $('#e-name').value.trim();
    const goal = parseInt($('#e-goal').value,10);
    const start = $('#e-start').value; // won't change effect after started (منطق مبسط)
    const duration = parseInt($('#e-duration').value,10);

    let ok = true;
    if(!name){ $('#err-e-name').textContent='أدخل الاسم'; ok=false; } else $('#err-e-name').textContent='';
    if(!(goal>0)){ $('#err-e-goal').textContent='مبلغ غير صالح'; ok=false; } else $('#err-e-goal').textContent='';

    if(!ok) return;

    j.name = name;
    j.goal = goal;
    if(start) j.start = `${start}-01`;
    if(duration>0) j.duration = duration;

    saveAll();
    toast('تم الحفظ');
    closeEditModal();
    openDetails(j.id);
    renderList();
  };

  $('#editClose').onclick = closeEditModal;
}

function closeEditModal(){
  $('#editModal')?.classList.add('hidden');
  $('#editModal')?.setAttribute('hidden','');
}

// ===================== Members =====================
function openAddMemberModal(){
  if(!state.currentId){ toast('افتح جمعية أولاً'); return; }
  const j = state.jamiyahs.find(x=>x.id===state.currentId);
  if(!j) return;

  // تعبئة شهور الاستلام المتاحة (1..duration)
  const sel = $('#am-month');
  sel.innerHTML = '';
  for(let i=1;i<=j.duration;i++){
    const o = document.createElement('option');
    o.value = String(i);
    // عرض اسم الشهر الفعلي
    const base = new Date(j.start);
    const d = new Date(base.getFullYear(), base.getMonth()+i-1, 1);
    o.textContent = `${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
    sel.appendChild(o);
  }

  $('#am-name').value = '';
  $('#am-pay').value = '';
  $('#err-am-name').textContent='';
  $('#err-am-pay').textContent='';
  $('#err-am-month').textContent='';
  $('#am-hint').textContent = '';

  $('#addMemberModal')?.classList.remove('hidden');
  $('#addMemberModal')?.removeAttribute('hidden');

  $('#amSave').onclick = ()=>{
    const name = $('#am-name').value.trim();
    const pay  = parseInt($('#am-pay').value,10);
    const month = parseInt($('#am-month').value,10);

    let ok = true;
    if(!name){ $('#err-am-name').textContent='الاسم مطلوب'; ok=false; } else $('#err-am-name').textContent='';
    // منع تكرار نفس الاسم
    if(j.members.some(m=>m.name.trim()===name)){ $('#err-am-name').textContent='الاسم موجود مسبقًا'; ok=false; }
    if(!(pay>0)){ $('#err-am-pay').textContent='المساهمة غير صالحة'; ok=false; } else $('#err-am-pay').textContent='';
    if(!(month>0)){ $('#err-am-month').textContent='اختر شهر الاستلام'; ok=false; } else $('#err-am-month').textContent='';

    // حد أعلى للمساهمة الشهرية = goal/duration تقريبًا (منطق مبسط)
    const maxMonthly = Math.ceil(j.goal / j.duration);
    if(pay > maxMonthly){
      $('#err-am-pay').textContent = `المبلغ تعدّى حد المساهمة الشهرية (${maxMonthly})`;
      ok=false;
    }

    if(!ok) return;

    const m = { id: uid(), name, pay, month, payments: [] };
    ensurePayments(j, m);
    j.members.push(m);
    saveAll();
    toast('تمت إضافة العضو');
    closeAddMemberModal();
    renderMembers();
  };

  $('#amClose').onclick = closeAddMemberModal;
}

function closeAddMemberModal(){
  $('#addMemberModal')?.classList.add('hidden');
  $('#addMemberModal')?.setAttribute('hidden','');
}

function ensurePayments(j, m){
  // بناء دفعات لكل شهر (duration) بوضع false كبداية
  if(!Array.isArray(m.payments) || m.payments.length !== j.duration){
    m.payments = Array.from({length: j.duration}, ()=> false);
  }
}

function renderMembers(){
  const j = state.jamiyahs.find(x=>x.id===state.currentId);
  if(!j) return;
  const tbody = $('#memberTableBody');
  const empty = $('#emptyMembers');
  if(!tbody) return;

  let list = [...j.members];

  const filter = $('#mFilter')?.value || 'all';
  if(filter==='overdue'){
    // متأخرون: شهور غير مدفوعة قبل شهر الاستلام (تعريف مبسط)
    list = list.filter(m=> m.payments.some((p,idx)=> !p && idx+1 < m.month));
  } else if(filter==='notfull'){
    list = list.filter(m=> m.payments.some(p=>!p));
  }

  const sort = $('#mSort')?.value || 'month';
  if(sort==='name'){
    list.sort((a,b)=> a.name.localeCompare(b.name,'ar'));
  }else{
    list.sort((a,b)=> (a.month||0)-(b.month||0) || a.name.localeCompare(b.name,'ar'));
  }

  tbody.innerHTML = '';
  if(!list.length){
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  list.forEach((m,idx)=>{
    const tr = document.createElement('tr');

    const paidCount = (m.payments||[]).filter(Boolean).length;
    const totalDue  = m.pay * (m.payments?.length || j.duration);
    const paidSum   = m.pay * paidCount;

    // عرض اسم شهر الاستلام بالإنجليزية
    const base = new Date(j.start);
    const d = new Date(base.getFullYear(), base.getMonth()+m.month-1, 1);
    const monthText = `${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;

    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${m.name}</td>
      <td>${Number(m.pay).toLocaleString('en-US')}</td>
      <td>${Number(totalDue).toLocaleString('en-US')}</td>
      <td>${Number(paidSum).toLocaleString('en-US')} (${paidCount}/${j.duration})</td>
      <td>${monthText}</td>
      <td>
        <div class="mc-actions" style="display:flex;gap:6px;justify-content:flex-start;">
          <button class="btn" data-act="pay">دفعات</button>
          <button class="btn" data-act="edit">تعديل</button>
          <button class="btn danger" data-act="del">حذف</button>
        </div>
      </td>
    `;

    tr.querySelector('[data-act="pay"]')?.addEventListener('click', ()=> openPayModal(j, m));
    tr.querySelector('[data-act="edit"]')?.addEventListener('click', ()=> openEditMemberModal(j, m));
    tr.querySelector('[data-act="del"]')?.addEventListener('click', ()=>{
      if(confirm('حذف العضو؟')){
        j.members = j.members.filter(x=>x.id!==m.id);
        saveAll();
        renderMembers();
      }
    });

    tbody.appendChild(tr);
  });

  // معلومات المتأخرين (سريعة)
  const overdueCount = j.members.filter(m=> m.payments.some((p,idx)=> !p && idx+1 < m.month)).length;
  $('#mOverdueInfo').textContent = overdueCount ? `متأخرون: ${overdueCount}` : '';
}

// ===================== Payments Modal =====================
function openPayModal(j, m){
  ensurePayments(j, m);
  $('#payModalTitle').textContent = `دفعات: ${m.name}`;
  const body = $('#payModalBody');
  const summary = $('#paySummary');
  body.innerHTML = '';
  summary.innerHTML = '';

  const base = new Date(j.start);

  m.payments.forEach((val, idx)=>{
    const d = new Date(base.getFullYear(), base.getMonth()+idx, 1);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px;border:1px solid #1f2937;border-radius:8px;margin-bottom:6px;';
    const mo = `${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
    row.innerHTML = `
      <span>${mo}</span>
      <label style="display:flex;align-items:center;gap:8px;">
        <span>${Number(m.pay).toLocaleString('en-US')} SAR</span>
        <input type="checkbox" ${val?'checked':''} data-idx="${idx}" />
      </label>
    `;
    body.appendChild(row);
  });

  $('#payMarkAll').onclick = ()=>{
    m.payments = m.payments.map(()=>true);
    openPayModal(j,m);
  };
  $('#payClearAll').onclick = ()=>{
    m.payments = m.payments.map(()=>false);
    openPayModal(j,m);
  };
  $('#paySave').onclick = ()=>{
    // قراءة القيم
    $$('input[type="checkbox"]', body).forEach(ch=>{
      const i = parseInt(ch.getAttribute('data-idx'),10);
      m.payments[i] = ch.checked;
    });
    saveAll();
    toast('تم الحفظ');
    closePayModal();
    renderMembers();
  };

  $('#payClose').onclick = closePayModal;

  $('#payModal')?.classList.remove('hidden');
  $('#payModal')?.removeAttribute('hidden');
}

function closePayModal(){
  $('#payModal')?.classList.add('hidden');
  $('#payModal')?.setAttribute('hidden','');
}

// ===================== Edit Member =====================
function openEditMemberModal(j, m){
  $('#em-name').value = m.name;
  $('#em-pay').value  = String(m.pay);

  const sel = $('#em-month'); sel.innerHTML = '';
  for(let i=1;i<=j.duration;i++){
    const o = document.createElement('option');
    o.value = String(i);
    const base = new Date(j.start);
    const d = new Date(base.getFullYear(), base.getMonth()+i-1, 1);
    o.textContent = `${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
    if(i === m.month) o.selected = true;
    sel.appendChild(o);
  }

  $('#err-em-name').textContent='';
  $('#err-em-pay').textContent='';
  $('#err-em-month').textContent='';

  $('#editMemberModal')?.classList.remove('hidden');
  $('#editMemberModal')?.removeAttribute('hidden');

  $('#emSave').onclick = ()=>{
    const name = $('#em-name').value.trim();
    const pay  = parseInt($('#em-pay').value,10);
    const month = parseInt($('#em-month').value,10);
    let ok = true;

    if(!name){ $('#err-em-name').textContent='الاسم مطلوب'; ok=false; } else $('#err-em-name').textContent='';
    if(!(pay>0)){ $('#err-em-pay').textContent='المساهمة غير صالحة'; ok=false; } else $('#err-em-pay').textContent='';
    if(!(month>0)){ $('#err-em-month').textContent='اختر شهر الاستلام'; ok=false; } else $('#err-em-month').textContent='';

    // حد أعلى للمساهمة الشهرية
    const maxMonthly = Math.ceil(j.goal / j.duration);
    if(pay > maxMonthly){
      $('#err-em-pay').textContent = `المبلغ تعدّى حد المساهمة الشهرية (${maxMonthly})`;
      ok=false;
    }

    if(!ok) return;

    // منع تكرار الأسماء لغير نفس العضو
    if(j.members.some(x=>x.id!==m.id && x.name.trim()===name)){
      $('#err-em-name').textContent='الاسم موجود مسبقًا';
      return;
    }

    m.name = name;
    m.pay  = pay;
    m.month= month;
    ensurePayments(j, m);
    saveAll();
    toast('تم الحفظ');
    closeEditMemberModal();
    renderMembers();
  };

  $('#emClose').onclick = closeEditMemberModal;
}

function closeEditMemberModal(){
  $('#editMemberModal')?.classList.add('hidden');
  $('#editMemberModal')?.setAttribute('hidden','');
}

// ===================== Schedule (Month Grid) =====================
function renderSchedule(){
  const j = state.jamiyahs.find(x=>x.id===state.currentId);
  if(!j) return;
  const grid = $('#scheduleGrid');
  grid.innerHTML = '';

  const base = new Date(j.start);
  for(let i=1;i<=j.duration;i++){
    const d = new Date(base.getFullYear(), base.getMonth()+i-1, 1);
    const cell = document.createElement('div');
    cell.className = 'card';
    cell.style.cursor = 'pointer';
    const mo = `${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;

    // مستلمون هذا الشهر
    const receivers = j.members.filter(m=> m.month === i);
    const total = receivers.reduce((s,m)=> s + m.pay, 0);

    cell.innerHTML = `
      <div class="stack-1">
        <div class="h2">${mo}</div>
        <div style="font-size:.9rem;color:#94a3b8;">Recipients: ${receivers.length}</div>
        <div style="font-size:.9rem;color:#94a3b8;">Total: ${Number(total).toLocaleString('en-US')} SAR</div>
      </div>
    `;
    cell.addEventListener('click', ()=> openMonthDetails(j, i, mo, receivers));
    grid.appendChild(cell);
  }
}

function openMonthDetails(j, monthIndex, moText, receivers){
  $('#md-title').textContent = moText;
  const body = $('#md-body');
  body.innerHTML = '';

  if(!receivers.length){
    body.innerHTML = `<div class="empty">لا يوجد مستلمون هذا الشهر</div>`;
  }else{
    receivers.forEach(m=>{
      const item = document.createElement('div');
      item.className = 'card';
      item.style.padding = '10px';
      item.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="font-weight:600">${m.name}</div>
            <div style="font-size:.9rem;color:#94a3b8;">${Number(m.pay).toLocaleString('en-US')} SAR</div>
          </div>
          <button class="btn" title="دفعات" aria-label="دفعات">دفعات</button>
        </div>
      `;
      $('button', item)?.addEventListener('click', ()=> openPayModal(j, m));
      body.appendChild(item);
    });
  }

  $('#monthDetails')?.classList.remove('hidden');
}

// ===================== Export / Import =====================
function exportJson(){
  const data = state.jamiyahs;
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `jam3eyti-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('تم الحفظ (JSON)');
}

function onExportPDF(){
  // نسخة بسيطة: اطبع قسم التفاصيل فقط (المتصفّح يحفظ PDF)
  toast('سيتم فتح نافذة الطباعة — اختر "حفظ كـ PDF"');
  window.print();
}

function onImportJson(e){
  const input = e.target;
  const file  = input?.files && input.files[0];
  const reset = () => { if(input) input.value=''; };
  if(!file){ reset(); return; }

  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result || '[]');
      if(!Array.isArray(data)){ toast('ملف غير صالح'); reset(); return; }

      // نسخ احتياطي قبل الاستبدال
      const current = JSON.stringify(state.jamiyahs || []);
      localStorage.setItem(KEY_BACKUP, current);

      // استبدال + تصحيح
      state.jamiyahs = data.map(j=>({
        ...j,
        members: Array.isArray(j.members) ? j.members.map(m=>({
          ...m,
          payments: Array.isArray(m.payments) ? m.payments : []
        })) : []
      }));

      state.jamiyahs.forEach(j=> j.members.forEach(m=> ensurePayments(j,m)));

      saveAll();
      renderList();
      if(state.jamiyahs.length){
        openDetails(state.jamiyahs[0].id, {focus:'schedule'});
      }
      toast('تم الفتح (استيراد JSON)');
    }catch(err){
      console.error(err);
      toast('تعذّر قراءة الملف');
    }finally{
      reset();
    }
  };
  reader.onerror = ()=>{ toast('فشل قراءة الملف'); reset(); };
  reader.readAsText(file);
}

function restoreFromBackup(){
  try{
    const raw = localStorage.getItem(KEY_BACKUP);
    if(!raw){ toast('لا توجد نسخة احتياطية'); return; }
    state.jamiyahs = JSON.parse(raw);
    saveAll();
    renderList();
    toast('تم الاسترجاع من النسخة الاحتياطية');
  }catch(e){
    toast('تعذّر الاسترجاع');
  }
}