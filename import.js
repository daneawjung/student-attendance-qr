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
const connectionStatus = document.getElementById("connectionStatus");

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
let databaseReady = false;

async function checkDatabase() {
  const { error } = await supabaseClient.from("attendance_students").select("id", { count: "exact", head: true });
  if (error) {
    connectionStatus.textContent = `❌ ฐานข้อมูลยังไม่พร้อม: ${error.message}`;
    connectionStatus.style.background = "#fee2e2";
    connectionStatus.style.color = "#991b1b";
    databaseReady = false;
    importButton.disabled = true;
    return;
  }
  connectionStatus.textContent = "🟢 เชื่อมต่อฐานข้อมูลสำเร็จ พร้อมนำเข้าข้อมูล";
  connectionStatus.style.background = "#dcfce7";
  connectionStatus.style.color = "#166534";
  databaseReady = true;
}

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
  importButton.disabled = !databaseReady || errors.length > 0 || mappedRows.length === 0;
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

importButton.addEventListener("click", async () => {
  if (!mappedRows.length || importButton.disabled || !databaseReady) return;
  importButton.disabled = true;
  importButton.textContent = "⏳ กำลังบันทึก...";

  try {
    const payload = mappedRows.map(item => ({
      student_id: item.student_id,
      student_no: item.student_no ? Number(item.student_no) : null,
      prefix: item.prefix || null,
      first_name: item.first_name,
      last_name: item.last_name,
      class_name: item.class_name,
      department: item.department || null,
      level: item.level || null,
      status: item.status === "inactive" ? "inactive" : "active"
    }));

    // Upsert by the unique student_id. Existing students are updated; new students are inserted.
    const { error } = await supabaseClient
      .from("attendance_students")
      .upsert(payload, { onConflict: "student_id" });

    if (error) throw error;
    showMessage(`บันทึกสำเร็จ ${payload.length} คน ลงฐานข้อมูลกลางแล้ว`, false);
  } catch (error) {
    showMessage(`บันทึกลงฐานข้อมูลไม่สำเร็จ: ${error.message}`, true);
  } finally {
    importButton.disabled = false;
    importButton.textContent = "☁️ ยืนยันบันทึกลงฐานข้อมูล";
  }
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
  message.style.background = isError ? "#fee2e2" : "#dcfce7";
  message.style.color = isError ? "#991b1b" : "#166534";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" }[char]));
}

checkDatabase();
