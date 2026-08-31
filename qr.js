const STORAGE_KEY = "students";
const grid = document.getElementById("studentGrid");
const search = document.getElementById("searchStudent");
const count = document.getElementById("studentCount");
const empty = document.getElementById("emptyState");
const modal = document.getElementById("qrModal");
const modalQr = document.getElementById("modalQr");
let currentStudent = null;

function getStudents() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[char]));
}
function render() {
  const keyword = search.value.trim().toLowerCase();
  const all = getStudents();
  const students = all.filter(s => [s.code, s.name, s.classroom].some(v => String(v).toLowerCase().includes(keyword)));
  count.textContent = `${all.length} คน`;
  empty.classList.toggle("hidden", students.length > 0);
  grid.innerHTML = students.map((s, i) => `
    <article class="student-card">
      <div class="student-number">${i + 1}</div>
      <h3>${escapeHtml(s.name)}</h3>
      <p>${escapeHtml(s.code)} • ${escapeHtml(s.classroom)}</p>
      <button onclick="showQR('${encodeURIComponent(s.code)}')">🔲 แสดง QR</button>
    </article>`).join("");
}
window.showQR = function(encodedCode) {
  const code = decodeURIComponent(encodedCode);
  currentStudent = getStudents().find(s => s.code === code);
  if (!currentStudent) return;
  document.getElementById("modalName").textContent = currentStudent.name;
  document.getElementById("modalMeta").textContent = `${currentStudent.code} • ${currentStudent.classroom}`;
  modalQr.innerHTML = "";
  // QR contains only the stable student ID, not the student's name.
  new QRCode(modalQr, { text: `student:${currentStudent.code}`, width: 260, height: 260, correctLevel: QRCode.CorrectLevel.M });
  modal.classList.remove("hidden");
};
document.getElementById("closeModal").addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", e => { if (e.target === modal) modal.classList.add("hidden"); });
document.getElementById("printQr").addEventListener("click", () => window.print());
search.addEventListener("input", render);
render();
