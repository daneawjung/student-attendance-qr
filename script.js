const form = document.getElementById("attendanceForm");
const result = document.getElementById("result");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const studentId = document.getElementById("studentId").value.trim();
  const studentName = document.getElementById("studentName").value.trim();
  const now = new Date();
  const dateTime = now.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  result.textContent = `เช็กชื่อสำเร็จ: ${studentName} (${studentId}) เวลา ${dateTime}`;
  result.classList.remove("hidden");
  form.reset();
});
