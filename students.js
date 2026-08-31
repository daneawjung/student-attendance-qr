const STORAGE_KEY = "students";

const form = document.getElementById("studentForm");
const codeInput = document.getElementById("studentCode");
const nameInput = document.getElementById("studentName");
const classInput = document.getElementById("studentClass");
const editId = document.getElementById("editId");
const table = document.getElementById("studentTable");
const search = document.getElementById("searchStudent");
const count = document.getElementById("studentCount");
const emptyState = document.getElementById("emptyState");
const saveButton = document.getElementById("saveStudent");
const cancelButton = document.getElementById("cancelEdit");

function getStudents() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveStudents(students) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  }[char]));
}

function renderStudents() {
  const keyword = search.value.trim().toLowerCase();
  const all = getStudents();
  const filtered = all.filter(student =>
    [student.code, student.name, student.classroom].some(value =>
      value.toLowerCase().includes(keyword)
    )
  );

  count.textContent = `${all.length} คน`;
  emptyState.classList.toggle("hidden", filtered.length > 0);

  table.innerHTML = filtered.map((student, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(student.code)}</strong></td>
      <td>${escapeHtml(student.name)}</td>
      <td>${escapeHtml(student.classroom)}</td>
      <td class="actions">
        <button class="small-button" onclick="editStudent('${encodeURIComponent(student.code)}')">แก้ไข</button>
        <button class="small-button danger" onclick="deleteStudent('${encodeURIComponent(student.code)}')">ลบ</button>
      </td>
    </tr>
  `).join("");
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const code = codeInput.value.trim();
  const name = nameInput.value.trim();
  const classroom = classInput.value.trim();
  const students = getStudents();

  if (editId.value) {
    const index = students.findIndex(student => student.code === editId.value);
    if (index !== -1) {
      students[index] = { code, name, classroom };
    }
  } else {
    if (students.some(student => student.code === code)) {
      alert("รหัสนักเรียนนี้มีอยู่แล้ว");
      return;
    }
    students.push({ code, name, classroom });
  }

  saveStudents(students);
  resetForm();
  renderStudents();
});

window.editStudent = function(encodedCode) {
  const code = decodeURIComponent(encodedCode);
  const student = getStudents().find(item => item.code === code);
  if (!student) return;

  editId.value = student.code;
  codeInput.value = student.code;
  codeInput.disabled = true;
  nameInput.value = student.name;
  classInput.value = student.classroom;
  saveButton.textContent = "💾 บันทึกการแก้ไข";
  cancelButton.classList.remove("hidden");
  nameInput.focus();
};

window.deleteStudent = function(encodedCode) {
  const code = decodeURIComponent(encodedCode);
  const student = getStudents().find(item => item.code === code);
  if (!student) return;

  if (!confirm(`ต้องการลบ ${student.name} ใช่หรือไม่?`)) return;
  saveStudents(getStudents().filter(item => item.code !== code));
  renderStudents();
};

function resetForm() {
  form.reset();
  editId.value = "";
  codeInput.disabled = false;
  saveButton.textContent = "➕ เพิ่มนักเรียน";
  cancelButton.classList.add("hidden");
}

cancelButton.addEventListener("click", resetForm);
search.addEventListener("input", renderStudents);
renderStudents();
