const list=document.getElementById('todayList');const todayText=document.getElementById('todayText');const heroDate=document.getElementById('heroDate');
function esc(v){return String(v??'').replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}
function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function timeNow(){return new Date().toTimeString().slice(0,8);}
function isCurrent(s){const now=timeNow();return now>=s.start_time&&now<=s.end_time;}
async function load(){
 const d=new Date(),day=d.getDay(),date=localDate();
 const dateLabel=d.toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 todayText.textContent=`${dateLabel} • หน้าหลักสำหรับการทำงานประจำวัน`;
 heroDate.textContent=`📅 ${dateLabel}`;
 const {data:schedules,error}=await supabaseClient.from('attendance_weekly_schedules').select('id,start_time,end_time,subject_code,subject_name,class_name,room,teacher_name,active').eq('day_of_week',day).eq('active',true).order('start_time');
 if(error){list.innerHTML=`<div class="empty-state">โหลดตารางวันนี้ไม่ได้: ${esc(error.message)}</div>`;return;}
 const {data:sessions,error:se}=await supabaseClient.from('attendance_sessions').select('id,session_code,subject_code,subject_name,class_name,start_time,end_time,status').eq('session_date',date);
 if(se){list.innerHTML=`<div class="empty-state">โหลดคาบวันนี้ไม่ได้: ${esc(se.message)}</div>`;return;}
 const rows=[];
 for(const s of schedules||[]){
   const session=(sessions||[]).find(x=>x.subject_code===s.subject_code&&x.class_name===s.class_name&&x.start_time===s.start_time);
   let count=0;
   if(session){const {count:c}=await supabaseClient.from('attendance_records').select('id',{count:'exact',head:true}).eq('session_id',session.id).eq('status','present');count=c||0;}
   rows.push({s,session,count});
 }
 if(!rows.length){list.innerHTML='<div class="empty-state">🌤️ วันนี้ไม่มีคาบเรียนตามตาราง</div>';return;}
 list.innerHTML=rows.map(({s,session,count})=>{
   const open=session?.status==='open';
   const current=isCurrent(s);
   const statusText=open?'🟢 กำลังเปิดเช็กชื่อ':session?'⚫ ปิดแล้ว':'⚪ ยังไม่ได้เปิด Session';
   const button=open?`<a class="focus-button" href="session-control.html?session=${encodeURIComponent(session.id)}">📋 ดูรายชื่อ</a>`:`<a class="focus-button" href="today.html">▶️ ${session?'เปิดดูคาบ':'เปิดเช็กชื่อ'}</a>`;
   return `<div class="focus-card ${current?'current':''}">
     <div class="focus-main">
       <div class="today-time">${esc(s.start_time)}–${esc(s.end_time)} ${current?'⏰':''}</div>
       <strong>${esc(s.subject_name)}</strong>
       <div class="focus-meta">${esc(s.subject_code)} • 👥 ${esc(s.class_name)}${s.room?' • 🏫 '+esc(s.room):''}</div>
       <div class="focus-meta ${open?'session-open':''}">${statusText}${open?` • เช็กแล้ว ${count} คน`:''}</div>
     </div>
     <div>${button}</div>
   </div>`;
 }).join('');
}
load();setInterval(load,30000);
