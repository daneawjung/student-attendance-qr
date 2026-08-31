const teacherMode = document.getElementById("teacherMode");
const studentMode = document.getElementById("studentMode");
const historySection = document.getElementById("historySection");
const historyBox = document.getElementById("history");

function getAttendance() {
  return JSON.parse(localStorage.getItem("attendanceRecords") || "[]");
}

function saveAttendance(record) {
  const records = getAttendance();
  records.unshift(record);
  localStorage.setItem("attendanceRecords", JSON.stringify(records.slice(0, 30)));
  renderHistory();
}

function renderHistory() {
  const records = getAttendance();
  if (!records.length) {
    historyBox.innerHTML = '<p class="hint">ยังไม่มีข้อมูลการเช็กชื่อ</p>';
    return;
  }

  historyBox.innerHTML = records.map(record => `
    <div class="history-item">
      <strong>${escapeHtml(record.name)}</strong> (${escapeHtml(record.id)})<br>
      ⏰ ${escapeHtml(record.time)}
    </div>
  `).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  }[char]));
}

// ถ้าเปิดเว็บจาก QR จะมี studentId และ studentName อยู่ใน URL
const params = new URLSearchParams(window.location.search);
const scannedId = params.get("studentId");
const scannedName = params.get("studentName");

if (scannedId && scannedName) {
  teacherMode.classList.add("hidden");
  studentMode.classList.remove("hidden");
  document.getElementById("scannedStudentId").textContent = scannedId;
  document.getElementById("scannedStudentName").textContent = scannedName;
} else {
  teacherMode.classList.remove("hidden");
  studentMode.classList.add("hidden");
}

// ครูสร้าง QR ประจำตัวนักเรียน
const qrForm = document.getElementById("qrForm");
qrForm.addEventListener("submit", event => {
  event.preventDefault();

  const id = document.getElementById("studentId").value.trim();
  const name = document.getElementById("studentName").value.trim();
  const url = `${window.location.origin}${window.location.pathname}?studentId=${encodeURIComponent(id)}&studentName=${encodeURIComponent(name)}`;

  const qrBox = document.getElementById("qrcode");
  qrBox.innerHTML = "";
  new QRCode(qrBox, {
    text: url,
    width: 220,
    height: 220,
    correctLevel: QRCode.CorrectLevel.M
  });

  document.getElementById("qrStudent").textContent = `${name} (${id})`;
  document.getElementById("qrArea").classList.remove("hidden");
});

// นักเรียนยืนยันเช็กชื่อหลังสแกน QR
const confirmButton = document.getElementById("confirmAttendance");
confirmButton.addEventListener("click", () => {
  const id = document.getElementById("scannedStudentId").textContent;
  const name = document.getElementById("scannedStudentName").textContent;
  const now = new Date();
  const time = now.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "medium" });

  saveAttendance({ id, name, time });

  const result = document.getElementById("studentResult");
  result.textContent = `เช็กชื่อสำเร็จ ${name} เวลา ${time}`;
  result.classList.remove("hidden");
  confirmButton.disabled = true;
  confirmButton.textContent = "✅ เช็กชื่อแล้ว";
});

renderHistory();
