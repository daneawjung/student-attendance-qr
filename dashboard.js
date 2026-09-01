const list=document.getElementById('todayList');
const todayText=document.getElementById('todayText');
const heroDate=document.getElementById('heroDate');
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function todayDay(){const n=new Date().getDay();return n===0?7:n;}
function isCurrent(s){const now=new Date().toTimeString().slice(0,8);return now>=s.start_time&&now<=s.end_time;}
async function load(){
 if(!list)return;
 try{
  const d=new Date(),day=todayDay(),date=localDate();
  const dateLabel=d.toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  if(todayText)todayText.textContent=`${dateLabel} • หน้าหลักสำหรับการทำงานประจำวัน`;
  if(heroDate)heroDate.textContent=`📅 ${dateLabel}`;
  const schedulesResult=await supabaseClient.from('attendance_weekly_schedules').select('id,start_time,end_time,subject_code,subject_name,class_name,room,teacher_name,active').eq('day_of_week',day).eq('active',true).order('start_time');
  if(schedulesResult.error)throw schedulesResult.error;
  const sessionsResult=await supabaseClient.from('attendance_sessions').select('id,session_code,subject_code,subject_name,class_name,start_time,end_time,status').eq('session_date',date);
  if(sessionsResult.error)throw sessionsResult.error;
  const schedules=schedulesResult.data||[],sessions=sessionsResult.data||[];
  if(!schedules.length){list.innerHTML='<div class="empty-state">🌤️ วันนี้ไม่มีคาบเรียนตามตาราง</div>';return;}
  const rows=[];
  for(const s of schedules){
   const session=sessions.find(x=>x.subject_code===s.subject_code&&x.class_name===s.class_name&&x.start_time===s.start_time);
   let total=0,counts={present:0,late:0,excused:0,absent:0};
   if(s.class_name){
    const students=await supabaseClient.from('attendance_students').select('id',{count:'exact',head:true}).eq('class_name',s.class_name).eq('status','active');
    if(!students.error)total=students.count||0;
   }
   if(session){
    const records=await supabaseClient.from('attendance_records').select('status').eq('session_id',session.id);
    if(!records.error)(records.data||[]).forEach(r=>{if(Object.prototype.hasOwnProperty.call(counts,r.status))counts[r.status]++;});
   }
   const checked=counts.present+counts.late+counts.excused;
   rows.push({s,session,total,counts,checked});
  }
  list.innerHTML=rows.map(row=>{
   const s=row.s,session=row.session,c=row.counts,total=row.total,open=session&&session.status==='open',current=isCurrent(s);
   const statusText=open?'🟢 กำลังเปิดเช็กชื่อ':session?'⚫ ปิดแล้ว':'⚪ ยังไม่ได้เปิด Session';
   const button=open?`<a class="focus-button" href="session-control.html?session=${encodeURIComponent(session.id)}">📋 ดูรายชื่อ</a>`:`<a class="focus-button" href="today.html">▶️ ${session?'ดูคาบ':'เปิดเช็กชื่อ'}</a>`;
   const absent=Math.max(total-row.checked,0);
   const percent=total?Math.min(100,Math.round(row.checked/total*100)):0;
   return `<div class="focus-card ${current?'current':''}"><div class="focus-main"><div class="today-time">${esc(s.start_time)}–${esc(s.end_time)} ${current?'⏰':''}</div><strong>${esc(s.subject_name)}</strong><div class="focus-meta">${esc(s.subject_code)} • 👥 ${esc(s.class_name)}${s.room?' • 🏫 '+esc(s.room):''}</div><div class="focus-meta ${open?'session-open':''}">${statusText}</div></div><div class="attendance-summary"><div class="summary-total">👨‍🎓 ${total} คน</div><div class="summary-chips"><span>🟢 ${c.present}</span><span>🟡 ${c.late}</span><span>🔵 ${c.excused}</span><span>🔴 ${absent}</span></div><div class="summary-progress"><span style="width:${percent}%"></span></div><small>เช็กแล้ว ${row.checked}/${total} คน</small></div><div>${button}</div></div>`;
  }).join('');
 }catch(err){list.innerHTML=`<div class="empty-state">⚠️ โหลดข้อมูลไม่ได้<br><small>${esc(err.message||err)}</small></div>`;}
}
load();
setInterval(load,30000);
