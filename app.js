const groups = [];
let selectedGroup = null;

function createGroup() {
  const name = document.getElementById("groupName").value.trim();
  const startDate = document.getElementById("startDate").value;
  const duration = parseInt(document.getElementById("duration").value);

  if (!name || !startDate || isNaN(duration)) {
    alert("يرجى تعبئة جميع الحقول بشكل صحيح");
    return;
  }

  const newGroup = {
    name,
    startDate,
    duration,
    members: []
  };

  groups.push(newGroup);
  updateGroupsList();

  // clear inputs
  document.getElementById("groupName").value = "";
  document.getElementById("startDate").value = "";
  document.getElementById("duration").value = "";
}

function updateGroupsList() {
  const list = document.getElementById("groupsList");
  list.innerHTML = "";

  groups.forEach((group, index) => {
    const li = document.createElement("li");
    li.innerHTML = `<button onclick="openGroup(${index})">${group.name}</button>`;
    list.appendChild(li);
  });
}

function openGroup(index) {
  selectedGroup = groups[index];
  document.getElementById("main").style.display = "none";
  document.getElementById("groupView").style.display = "block";
  document.getElementById("groupTitle").textContent = selectedGroup.name;

  updateMembersList();
  generateSchedule();
}

function goBack() {
  selectedGroup = null;
  document.getElementById("groupView").style.display = "none";
  document.getElementById("main").style.display = "block";
}

function addMember() {
  if (!selectedGroup) return;

  const name = document.getElementById("memberName").value.trim();
  const contribution = parseFloat(document.getElementById("contribution").value);
  const preferredMonth = parseInt(document.getElementById("preferredMonth").value);

  if (!name || isNaN(contribution) || isNaN(preferredMonth)) {
    alert("يرجى تعبئة الحقول");
    return;
  }

  if (preferredMonth > selectedGroup.duration || preferredMonth < 1) {
    alert("الشهر خارج المدة المحددة");
    return;
  }

  const taken = selectedGroup.members.find(m => m.preferredMonth === preferredMonth);
  if (taken) {
    alert(`الشهر ${preferredMonth} محجوز للعضو ${taken.name}`);
    return;
  }

  selectedGroup.members.push({ name, contribution, preferredMonth });

  // clear
  document.getElementById("memberName").value = "";
  document.getElementById("contribution").value = "";
  document.getElementById("preferredMonth").value = "";

  updateMembersList();
  generateSchedule();
}

function updateMembersList() {
  const list = document.getElementById("membersList");
  list.innerHTML = "";

  selectedGroup.members.forEach(m => {
    const li = document.createElement("li");
    li.textContent = `${m.name} - 💰 ${m.contribution} ر.س - 📅 شهر ${m.preferredMonth}`;
    list.appendChild(li);
  });
}

function generateSchedule() {
  const tbody = document.querySelector("#scheduleTable tbody");
  tbody.innerHTML = "";

  for (let month = 1; month <= selectedGroup.duration; month++) {
    const row = document.createElement("tr");

    const member = selectedGroup.members.find(m => m.preferredMonth === month);
    const amount = member ? member.contribution * selectedGroup.members.length : 0;

    row.innerHTML = `
      <td>الشهر ${month}</td>
      <td>${member ? member.name : 'غير محدد'}</td>
      <td>${member ? amount + ' ر.س' : '-'}</td>
    `;

    tbody.appendChild(row);
  }
}