const members = [];

function addMember() {
  const name = document.getElementById("memberName").value.trim();
  const contribution = parseFloat(document.getElementById("contribution").value);
  const preferredMonth = parseInt(document.getElementById("preferredMonth").value);

  if (!name || isNaN(contribution) || isNaN(preferredMonth)) {
    alert("الرجاء تعبئة جميع الحقول بشكل صحيح");
    return;
  }

  const member = {
    name,
    contribution,
    preferredMonth,
  };

  members.push(member);
  updateMembersList();

  document.getElementById("memberName").value = "";
  document.getElementById("contribution").value = "";
  document.getElementById("preferredMonth").value = "";
}

function updateMembersList() {
  const list = document.getElementById("membersList");
  list.innerHTML = "";

  members.forEach((member, index) => {
    const li = document.createElement("li");
    li.textContent = `👤 ${member.name} - 💰 ${member.contribution} ر.س - 📅 شهر ${member.preferredMonth}`;
    list.appendChild(li);
  });
}