const fileInput = document.getElementById("fileInput");
const mappingSection = document.getElementById("mappingSection");
const previewSection = document.getElementById("previewSection");
const mappingBox = document.getElementById("mappingBox");
const previewHead = document.getElementById("previewHead");
const previewBody = document.getElementById("previewBody");
const summary = document.getElementById("summary");
const errorsBox = document.getElementById("errors");
const importButton = document.getElementById("importButton");
const cancelButton = document.getElementById("cancelButton");
const message = document.getElementById("message");

const fields = [
  ["student_id", "รหัสนักเรียน", true],
  ["student_no", "เลขที่", false],
  ["prefix", "คำนำหน้า", false],
  ["first_name", "ชื่อ", true],
  ["last_name", "นามสกุล", true],
  ["class_name", "ห้อง", true],
  ["department", "สาขาวิชา", false],
  ["level", "ระดับ", false],
  ["status", "สถานะ", false]
];

let sourceRows = [];
let sourceHeaders = [];
let mappedRows = [];

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_\-]/g, "");
}

function guessField(header) {
  const h = normalize(header);
  const aliases = {
    student_id: ["studentid", "รหัสนักเรียน", "รหัสนักศึกษา", "รหัสประจำตัว", "เลขประจำตัว", "รหัส"],
    student_no: ["studentno", "เลขที่", "ลำดับ", "no"],
    prefix: ["prefix", "คำนำหน้า", "คำนำหน้าชื่อ"],
    first_name: ["firstname", "ชื่อ", "ชื่อจริง"],
    last_name: ["lastname", "นามสกุล", "สกุล"],
    class_name: ["classname", "ห้อง", "ห้องเรียน", "ชั้น", "กลุ่ม"],
    department: ["department", "สาขา", "สาขาวิชา"],
    level: ["level", "ระดับ", "ระดับชั้น"],
    status: ["status", "สถานะ"]
  };
  return Object.entries(aliases).find(([, values]) => values.some(v => normalize(v) === h))?.[0] || "";
}

function renderMapping() {
  mappingBox.innerHTML = fields.map(([key, label, required]) => {
    const guessed = sourceHeaders.findIndex(h => guessField(h) === key);
    const options = ['<option value="">— ไม่ใช้ —</option>']
      .concat(sourceHeaders.map((h, i) => `<option value="${i}" ${i === guessed ? "selected" : ""}>${escapeHtml(h)}</option>`));
    return `<div class="mapping-item"><label>${label}${required ? " *" : ""}<small>${key}</small></label><select data-field="${key}" ${required ? "required" : ""}>${options.join("")}</select></div>`;
  }).join("");
  mappingBox.querySelectorAll("select").forEach(select => select.addEventListener("change", buildPreview));
}

function getMapping() {
  const mapping = {};
  mappingBox.querySelectorAll("select").forEach(select => {
    if (select.value !== "") mapping[select.dataset.field] = Number(select.value);
  });
  return mapping;
}

function buildPreview() {
  const mapping = getMapping();
  mappedRows = sourceRows.map(row => {
    const item = {};
    fields.forEach(([key]) => item[key] = mapping[key] === undefined ? "" : String(row[sourceHeaders[mapping[key]]] ?? "").trim());
    if (!item.status) item.status = "active";
    return item;
  }).filter(item => Object.values(item).some(Boolean));

  const errors = [];
  const seen = new Set();
  mappedRows.forEach((item, i) => {
    if (!item.student_id) errors.push(`แถว ${i + 2}: ไม่มีรหัสนักเรียน`);
    if (!item.first_name) errors.push(`แถว ${i + 2}: ไม่มีชื่อ`);
    if (!item.last_name) errors.push(`แถว ${i + 2}: ไม่มีนามสกุล`);
    if (!item.class_name) errors.push(`แถว ${i + 2}: ไม่มีห้อง`);
    if (item.student_id && seen.has(item.student_id)) errors.push(`แถว ${i + 2}: รหัสนักเรียนซ้ำในไฟล์ (${item.student_id})`);
    if (item.student_id) seen.add(item.student_id);
  });

  summary.innerHTML = `<strong>${mappedRows.length}</strong> รายการ | <strong>${errors.length}</strong> ปัญหา`;
  previewHead.innerHTML = `<tr>${fields.map(([, label]) => `<th>${label}</th>`).join("")}</tr>`;
  previewBody.innerHTML = mappedRows.slice(0, 100).map(item => `<tr>${fields.map(([key]) => `<td>${escapeHtml(item[key])}</td>`).join("")}</tr>`).join("");
  errorsBox.classList.toggle("hidden", errors.length === 0);
  errorsBox.innerHTML = errors.length ? `<strong>กรุณาตรวจสอบ:</strong><ul>${errors.slice(0, 30).map(e => `<li>${escapeHtml(e)}</li>`).join("")}</ul>${errors.length > 30 ? `<p>และอีก ${errors.length - 30} รายการ</p>` : ""}` : "";
  importButton.disabled = errors.length > 0 || mappedRows.length === 0;
  previewSection.classList.remove("hidden");
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    sourceRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    sourceHeaders = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })[0].map(String).filter(Boolean);
    if (!sourceHeaders.length || !sourceRows.length) throw new Error("ไม่พบข้อมูลในไฟล์");
    renderMapping();
    mappingSection.classList.remove("hidden");
    buildPreview();
    showMessage("อ่านไฟล์สำเร็จ กรุณาตรวจสอบการจับคู่คอลัมน์ก่อนยืนยัน", false);
  } catch (error) {
    showMessage(`อ่านไฟล์ไม่สำเร็จ: ${error.message}`, true);
  }
});

importButton.addEventListener("click", () => {
  if (!mappedRows.length || importButton.disabled) return;
  const current = JSON.parse(localStorage.getItem("students") || "[]");
  let added = 0, updated = 0;
  mappedRows.forEach(item => {
    const name = [item.prefix, item.first_name, item.last_name].filter(Boolean).join(" ");
    const index = current.findIndex(s => s.code === item.student_id);
    const student = { code: item.student_id, name, classroom: item.class_name, studentNo: item.student_no, prefix: item.prefix, firstName: item.first_name, lastName: item.last_name, department: item.department, level: item.level, status: item.status };
    if (index >= 0) { current[index] = { ...current[index], ...student }; updated++; }
    else { current.push(student); added++; }
  });
  localStorage.setItem("students", JSON.stringify(current));
  showMessage(`นำเข้าสำเร็จ ${added} คน | อัปเดตข้อมูลเดิม ${updated} คน | รวมในระบบ ${current.length} คน`, false);
});

cancelButton.addEventListener("click", () => {
  fileInput.value = "";
  sourceRows = []; sourceHeaders = []; mappedRows = [];
  mappingSection.classList.add("hidden");
  previewSection.classList.add("hidden");
  message.classList.add("hidden");
});

function showMessage(text, isError) {
  message.textContent = text;
  message.classList.remove("hidden");
  message.classList.toggle("error-message", isError);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" }[char]));
}
