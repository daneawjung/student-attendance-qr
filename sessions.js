const form = document.getElementById('sessionForm');
const table = document.getElementById('sessionTable');
const search = document.getElementById('searchSession');
const count = document.getElementById('sessionCount');
const empty = document.getElementById('emptyState');
const message = document.getElementById('message');
let sessions = [];

document.getElementById('sessionDate').value = new Date().toISOString().slice(0,10);

function esc(v){return String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}
function msg(t,err=false){message.textContent=t;message.classList.remove('hidden');message.style.background=err?'#fee2e2':'#dcfce7';message.style.color=err?'#991b1b':'#166534';}
function code(){const d=document.getElementById('sessionDate').value.replaceAll('-',''); return `AT-${d}-${String(Date.now()).slice(-6)}`;}
async function load(){const {data,error}=await supabaseClient.from('attendance_sessions').select('*').order('session_date',{ascending:false}).order('created_at',{ascending:false}); if(error){msg('โหลดคาบเรียนไม่สำเร็จ: '+error.message,true);return;} sessions=data||[];render();}
function render(){const k=search.value.trim().toLowerCase();const rows=sessions.filter(s=>[s.session_code,s.subject_code,s.subject_name,s.class_name].some(v=>String(v??'').toLowerCase().includes(k)));count.textContent=`${sessions.length} คาบ`;empty.classList.toggle('hidden',rows.length>0);table.innerHTML=rows.map(s=>`<tr><td><strong>${esc(s.session_code)}</strong></td><td>${esc(s.subject_code||'')}<br>${esc(s.subject_name)}</td><td>${esc(s.class_name)}</td><td>${esc(s.session_date)}</td><td>${esc(s.start_time||'-')} – ${esc(s.end_time||'-')}</td><td>${s.status==='open'?'🟢 เปิด':s.status==='closed'?'⚫ ปิด':'🟡 ร่าง'}</td><td class="actions">${s.status==='open'?`<button class="small-button" onclick="closeSession('${encodeURIComponent(s.id)}')">ปิดคาบ</button>`:''}</td></tr>`).join('');}
form.addEventListener('submit',async e=>{e.preventDefault();const subjectCode=document.getElementById('subjectCode').value.trim()||null,subjectName=document.getElementById('subjectName').value.trim(),className=document.getElementById('className').value.trim(),sessionDate=document.getElementById('sessionDate').value,startTime=document.getElementById('startTime').value||null,endTime=document.getElementById('endTime').value||null;if(!subjectName||!className||!sessionDate)return;const {error}=await supabaseClient.from('attendance_sessions').insert({session_code:code(),subject_code:subjectCode,subject_name:subjectName,class_name:className,session_date:sessionDate,start_time:startTime,end_time:endTime,status:'open'});if(error){msg('สร้างคาบไม่สำเร็จ: '+error.message,true);return;}msg('เปิดคาบเรียนสำเร็จ');form.reset();document.getElementById('sessionDate').value=new Date().toISOString().slice(0,10);await load();});
window.closeSession=async function(encoded){const id=decodeURIComponent(encoded);if(!confirm('ต้องการปิดคาบนี้ใช่หรือไม่?'))return;const {error}=await supabaseClient.from('attendance_sessions').update({status:'closed'}).eq('id',id);if(error){msg('ปิดคาบไม่สำเร็จ: '+error.message,true);return;}msg('ปิดคาบเรียนแล้ว');await load();};
search.addEventListener('input',render);load();
