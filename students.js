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
const connectionStatus = document.getElementById("connectionStatus");
const message = document.getElementById("message");

let allStudents = [];

function showMessage(text, error = false) {
  message.textContent = text;
  message.classList.remove("hidden");
  message.style.background = error ? "#fee2e2" : "#dcfce7";
  message.style.color = error ? "#991b1b" : "#166534";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  }[char]));
}

function fullName(student) {
  return [student.prefix, student.first_name, student.last_name].filter(Boolean).join(" ");
}

async function loadStudents() {
  connectionStatus.textContent = "กำลังโหลดข้อมูลจาก Supabase...";
  const { data, error } = await supabaseClient
    .from("attendance_students")
    .select("id, student_id, student_no, prefix, first_name, last_name, class_name, department, level, status")
    .order("class_name", { ascending: true })
    .order("student_no", { ascending: true, nullsFirst: false });

  if (error) {
    connectionStatus.textContent = `❌ เชื่อมต่อไม่ได้: ${error.message}`;
    connectionStatus.style.background = "#fee2e2";
    connectionStatus.style.color = "#991b1b";
    return;
  }

  allStudents = data || [];
  connectionStatus.textContent = "🟢 เชื่อมต่อฐานข้อมูลสำเร็จ";
  connectionStatus.style.background = "#dcfce7";
  connectionStatus.style.color = "#166534";
  renderStudents();
}

function renderStudents() {
  const keyword = search.value.trim().toLowerCase();
  const filtered = allStudents.filter(student =>
    [student.student_id, fullName(student), student.class_name, student.department, student.level]
      .some(value => String(value ?? "").toLowerCase().includes(keyword))
  );

  count.textContent = `${allStudents.length} คน`;
  emptyState.classList.toggle("hidden", filtered.length > 0);
  table.innerHTML = filtered.map((student, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(student.student_id)}</strong></td>
      <td>${escapeHtml(fullName(student))}</td>
      <td>${escapeHtml(student.class_name)}</td>
      <td class="actions">
        <button class="small-button" onclick="editStudent('${encodeURIComponent(student.id)}')">แก้ไข</button>
        <button class="small-button danger" onclick="deleteStudent('${encodeURIComponent(student.id)}')">ลบ</button>
      </td>
    </tr>
  `).join("");
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const code = codeInput.value.trim();
  const rawName = nameInput.value.trim();
  const classroom = classInput.value.trim();
  const parts = rawName.split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || "";
  const lastName = parts.join(" ") || "-";

  if (!code || !firstName || !classroom) return;

  saveButton.disabled = true;
  try {
    const payload = { student_id: code, first_name: firstName, last_name: lastName, class_name: classroom, status: "active" };
    let result;
    if (editId.value) {
      result = await supabaseClient.from("attendance_students").update(payload).eq("id", editId.value);
    } else {
      result = await supabaseClient.from("attendance_students").insert(payload);
    }
    if (result.error) throw result.error;
    showMessage(editId.value ? "บันทึกการแก้ไขสำเร็จ" : "เพิ่มนักเรียนสำเร็จ");
    resetForm();
    await loadStudents();
  } catch (error) {
    showMessage(`บันทึกไม่สำเร็จ: ${error.message}`, true);
  } finally {
    saveButton.disabled = false;
  }
});

window.editStudent = function(encodedId) {
  const id = decodeURIComponent(encodedId);
  const student = allStudents.find(item => item.id === id);
  if (!student) return;
  editId.value = student.id;
  codeInput.value = student.student_id;
  codeInput.disabled = true;
  nameInput.value = fullName(student);
  classInput.value = student.class_name;
  saveButton.textContent = "💾 บันทึกการแก้ไข";
  cancelButton.classList.remove("hidden");
  nameInput.focus();
};

window.deleteStudent = async function(encodedId) {
  const id = decodeURIComponent(encodedId);
  const student = allStudents.find(item => item.id === id);
  if (!student || !confirm(`ต้องการลบ ${fullName(student)} ใช่หรือไม่?`)) return;
  const { error } = await supabaseClient.from("attendance_students").delete().eq("id", id);
  if (error) {
    showMessage(`ลบไม่สำเร็จ: ${error.message}`, true);
    return;
  }
  showMessage("ลบนักเรียนสำเร็จ");
  await loadStudents();
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
loadStudents();
