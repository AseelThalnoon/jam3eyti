/* نسخة واجهة تجريبية: توليد بطاقات أعضاء + تشغيل نافذة الدفعات
   الأرقام تُعرض إنجليزي (en-US). عدّل/ادمج حسب منطقك. */

/** أيقونات SVG */
const ICONS = {
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M9 6v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6"/>
          </svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M3 21l3.9-.6a2 2 0 0 0 1.1-.6L21 6a2.8 2.8 0 0 0-4-4L4 16.8a2 2 0 0 0-.6 1.1L3 21z"/>
         </svg>`,
  pay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M2 10h20M6 14h4"/>
        </svg>`
};

/** بيانات تجريبية لعرض الشكل */
const members = [
  {name:'أصيل', contrib:5000, total:30000, month:'October 2025', paid:30000, remain:0, count:'(6 / 6)'},
  {name:'فاتن', contrib:5000, total:30000, month:'November 2025', paid:0,    remain:30000, count:'(6 / 0)'},
  {name:'خالة مريم', contrib:1000, total:6000,  month:'December 2025', paid:0, remain:6000,  count:'(6 / 0)'}
];

/** رسم بطاقات الأعضاء */
function fmt(n){ return Number(n).toLocaleString('en-US'); }

function memberCard(m, idx){
  return `
  <tr>
    <td>
      <div class="member-card">
        <div class="mc-title">${m.name}</div>

        <div class="mc-rows">
          <div class="mc-row"><span class="mc-label">المساهمة</span><span class="mc-sep">:</span><span class="mc-value">${fmt(m.contrib)} ريال</span></div>
          <div class="mc-row"><span class="mc-label">الاستحقاق الكلي</span><span class="mc-sep">:</span><span class="mc-value">${fmt(m.total)} ريال</span></div>
          <div class="mc-row"><span class="mc-label">شهر الاستلام</span><span class="mc-sep">:</span><span class="mc-value">${m.month}</span></div>
        </div>

        <div class="mc-chips">
          <span class="mc-chip">${m.count}</span>
          <span class="mc-chip">المتبقي: ${fmt(m.remain)} ريال</span>
          <span class="mc-chip">مدفوع: ${fmt(m.paid)} ريال</span>
        </div>

        <!-- أزرار عمودية باليمين -->
        <div class="mc-actions">
          <button class="btn icon js-pay"   title="دفعات" data-idx="${idx}">${ICONS.pay}</button>
          <button class="btn icon js-edit"  title="تعديل" data-idx="${idx}">${ICONS.edit}</button>
          <button class="btn icon js-del"   title="حذف"   data-idx="${idx}">${ICONS.trash}</button>
        </div>
      </div>
    </td>
  </tr>`;
}

function renderMembers(){
  const tbody = document.getElementById('memberTableBody');
  tbody.innerHTML = members.map(memberCard).join('');
}

/** تفعيل الأزرار */
function wireHandlers(){
  const tbody = document.getElementById('memberTableBody');

  tbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const i = +btn.dataset.idx;

    if(btn.classList.contains('js-pay')) openPayModal(i);
    else if(btn.classList.contains('js-edit')) toast('تعديل: ' + members[i].name);
    else if(btn.classList.contains('js-del')){
      if(confirm('حذف هذا العضو؟')) toast('تم الحذف (تجريبي)');
    }
  });

  document.getElementById('closePayModal').addEventListener('click', closePayModal);
  document.getElementById('savePayments').addEventListener('click', ()=>{ toast('تم الحفظ'); closePayModal(); });
}

/** نافذة الدفعات */
function openPayModal(){ document.getElementById('payModal').classList.remove('hidden'); }
function closePayModal(){ document.getElementById('payModal').classList.add('hidden'); }

/** Toast بسيط */
function toast(msg){
  let root = document.querySelector('.toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(()=> t.remove(), 2200);
}

/* تشغيل */
renderMembers();
wireHandlers();