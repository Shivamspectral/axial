const SUPABASE_URL='https://jdsqcbishfbjjsxipicm.supabase.co';
const SUPABASE_KEY='sb_publishable_LhPLVrHYp-tDcMI7wqDQJg_7UAz9d3R';
let sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const staffClient=(email,role)=>supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{global:{headers:{'x-staff-email':email,'x-staff-role':role}}});
const HOD_LOGIN_EMAIL='sonalirangdale@scoe.edu';
const HOD_LOGIN_PASSWORD='sonali@ce';
const SUPER_ADMIN_EMAIL='vedaware33@gmail.com';
const SUPER_ADMIN_PASSWORD='astra@ce2026';
const studentClient=id=>supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{global:{headers:{'x-student-id':id}}});
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session=null, profile=null, student=null, staffRole=null, currentStaffPage='dashboard', cache={};

function toast(msg){const el=document.createElement('div');el.className='toast';el.textContent=msg;$('toast').appendChild(el);setTimeout(()=>el.remove(),2800)}
function showError(msg){$('loginError').textContent=msg;$('loginError').classList.remove('hidden')}
function clearError(){$('loginError').classList.add('hidden')}
function closeModal(){$('modal').classList.add('hidden')}
$('modal').addEventListener('click',e=>{if(e.target.dataset.close!==undefined)closeModal()});

document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');const staff=t.dataset.login==='staff';$('studentLogin').classList.toggle('hidden',staff);$('staffLogin').classList.toggle('hidden',!staff);clearError()}));

$('studentLogin').addEventListener('submit',async e=>{e.preventDefault();clearError();const id=$('studentId').value.trim();if(!id)return;const sdb=studentClient(id);const {data,error}=await sdb.from('axial_students').select('*').eq('student_id',id).eq('active',true).maybeSingle();if(error){showError(error.message);return}if(!data){showError('Student ID not found or inactive. Please contact the college administrator.');return}student=data;await renderStudent();});
$('staffRole').addEventListener('change',()=>{ $('staffEmail').value=''; $('staffPassword').value=''; $('staffEmail').placeholder=$('staffRole').value==='HOD'?'Enter HOD email':'Enter Super Admin email'; $('staffPassword').placeholder='Enter password'; clearError(); });
$('staffLogin').addEventListener('submit',async e=>{e.preventDefault();clearError();const email=$('staffEmail').value.trim().toLowerCase(),password=$('staffPassword').value,requested=$('staffRole').value;if(!email||!password){showError('Enter your staff email and password.');return}const account=requested==='HOD'?{email:HOD_LOGIN_EMAIL,password:HOD_LOGIN_PASSWORD,name:'Sonali Rangdale',department:'CE'}:{email:SUPER_ADMIN_EMAIL,password:SUPER_ADMIN_PASSWORD,name:'Super Admin',department:'Administration'};if(email!==account.email||password!==account.password){showError('Incorrect staff credentials.');return}sb=staffClient(email,requested);session={user:{id:email,email}};profile={user_id:email,email:account.email,full_name:account.name,role:requested,department:account.department,active:true};staffRole=requested;await renderStaff();});

async function ensureDefaultHod(){}

async function signOut(){sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);session=null;profile=null;student=null;staffRole=null;$('studentApp').classList.add('hidden');$('staffApp').classList.add('hidden');$('loginScreen').classList.remove('hidden');}
function studentShell(body){return `<div class="student-layout"><div class="student-head"><div class="student-branding"><img src="assets/scoe-logo.jpeg" class="student-scoe-logo" alt="Siddhant College of Engineering"><div class="student-astra"><img src="assets/astra-logo.jpeg" alt="ASTRA"><span>ASTRA Feedback Intelligence</span></div><div><div class="muted">Student ID: <b>${esc(student.student_id)}</b> · ${esc(student.full_name)}</div></div></div><button class="btn secondary" onclick="signOut()">Exit</button></div>${body}</div>`}

async function renderStudent(){
 $('loginScreen').classList.add('hidden');$('studentApp').classList.remove('hidden');
 const sdb=studentClient(student.student_id);const {data:cycles}=await sdb.from('axial_v3_cycles').select('*').eq('status','open').lte('start_date',new Date().toISOString().slice(0,10)).gte('end_date',new Date().toISOString().slice(0,10)).order('start_date');
 cache.studentCycles=cycles||[];
 if(!cache.studentCycles.length){$('studentApp').innerHTML=studentShell(`<div class="card success"><div class="check">✓</div><h2>No active feedback cycle</h2><p class="muted">There is currently no feedback window open for students. Please check again when your department announces the cycle.</p></div>`);return}
 $('studentApp').innerHTML=studentShell(`<div class="card student-card"><div class="panel-head"><div><h3>Select Feedback Cycle</h3><small>Only cycles currently open are shown.</small></div></div><div class="form-grid"><div class="field"><label>Cycle</label><select id="cycleSelect">${cache.studentCycles.map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.year_level)}</option>`).join('')}</select></div><div class="field"><label>Student Context</label><input value="${esc(student.year_level)} · Division ${esc(student.division)} · ${esc(student.department_code)}" disabled></div></div><div style="margin-top:16px"><button class="btn gold" onclick="loadFeedback()">Start Feedback →</button></div></div><div id="feedbackArea"></div>`);
}


function ensureFeedbackProgressUI(){
  const form=document.getElementById('feedbackForm');
  if(!form || document.getElementById('feedbackProgressWrap')) return;
  const wrap=document.createElement('div');
  wrap.id='feedbackProgressWrap';
  wrap.className='feedback-progress-wrap';
  wrap.innerHTML='<div class="feedback-progress-meta"><span>Feedback progress</span><span id="feedbackProgressCount">0 of 0 answered</span></div><div class="feedback-progress" aria-label="Feedback progress"><span id="feedbackProgressBar"></span></div>';
  form.prepend(wrap);
  setupEasyFeedbackUX();
}

function updateFeedbackProgress(){
  const questions=[...document.querySelectorAll('[data-question-id]')];
  const answered=questions.filter(q=>q.querySelector('input[type="radio"]:checked')).length;
  const total=questions.length;
  const pct=total?Math.round(answered/total*100):0;
  const bar=document.getElementById('feedbackProgressBar');
  const count=document.getElementById('feedbackProgressCount');
  if(bar) bar.style.width=pct+'%';
  if(count) count.textContent=`${answered} of ${total} answered`;
  questions.forEach(q=>{
    q.classList.toggle('is-complete',!!q.querySelector('input[type="radio"]:checked'));
  });
}
function setupEasyFeedbackUX(){
  const form=document.getElementById('feedbackForm');
  if(!form || form.dataset.easyUx==='1') return;
  form.dataset.easyUx='1';
  form.addEventListener('change',e=>{
    if(e.target.matches('input[type="radio"]')) updateFeedbackProgress();
  });
  updateFeedbackProgress();
}

async function loadFeedback(){const cycleId=Number($('cycleSelect').value);const sdb=studentClient(student.student_id);const {data:map,error}=await sdb.from('axial_v3_cycle_faculty').select('faculty_id,division').eq('cycle_id',cycleId).eq('division',student.division);if(error){toast(error.message);return}const ids=(map||[]).map(x=>x.faculty_id);let q=sdb.from('axial_v3_faculty').select('*').eq('active',true).eq('year_level',student.year_level).eq('department_code',student.department_code).eq('division',student.division);if(ids.length)q=q.in('id',ids);else{toast('No faculty assigned to this cycle.');return}const {data:faculty}=await q.order('full_name');const {data:submitted}=await sdb.from('axial_v3_feedback').select('faculty_id').eq('cycle_id',cycleId).eq('student_login_id',student.student_id);const submittedIds=new Set((submitted||[]).map(x=>x.faculty_id));const availableFaculty=(faculty||[]).filter(f=>!submittedIds.has(f.id));const {data:questions,error:qe}=await sdb.from('axial_v3_questions').select('*').eq('active',true).eq('year_level',student.year_level).order('position');if(qe){toast(qe.message);return}cache.currentCycle=cache.studentCycles.find(c=>c.id===cycleId);cache.currentFaculty=availableFaculty;cache.currentQuestions=questions||[];$('feedbackArea').innerHTML=`<div class="card feedback-card" style="margin-top:12px"><div class="panel-head"><div><h3>${esc(cache.currentCycle.name)}</h3><small>${cache.currentFaculty.length} faculty · ${cache.currentQuestions.length} questions</small></div></div><div class="field"><label>Faculty</label><select id="facultySelect">${cache.currentFaculty.map(f=>`<option value="${f.id}">${esc(f.full_name)} · ${esc(f.subject)}</option>`).join('')}</select></div><div id="questionsArea">${renderQuestions(cache.currentQuestions)}</div><div class="modal-actions"><button class="btn gold" onclick="submitFeedback()">Submit Feedback</button></div></div>`;window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});}
function renderQuestions(qs){
  if(!qs.length)return '<div class="empty">No active questions are configured for this year.</div>';
  return qs.map((q,i)=>{
    if(q.response_type==='text')return `<div class="question"><p>${i+1}. ${esc(q.question_text)}</p><textarea class="field-text" id="q_${q.id}" rows="3" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:10px" placeholder="Write your response..."></textarea></div>`;
    if(q.response_type==='yes_no')return `<div class="question"><p>${i+1}. ${esc(q.question_text)}</p><div class="ratings ratings-yesno"><label class="rating"><input type="radio" name="q_${q.id}" value="true"><span><b>Yes</b></span></label><label class="rating"><input type="radio" name="q_${q.id}" value="false"><span><b>No</b></span></label></div></div>`;
    return `<div class="question"><p>${i+1}. ${esc(q.question_text)}</p><div class="ratings">${[[5,'Excellent'],[4,'Very Good'],[3,'Good'],[2,'Satisfactory'],[1,'Poor']].map(([n,l])=>`<label class="rating"><input type="radio" name="q_${q.id}" value="${n}"><span><b>${n}</b><small>${l}</small></span></label>`).join('')}</div></div>`;
  }).join('')+`<div class="question"><p>Additional comments</p><textarea id="overallComment" rows="3" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:10px" placeholder="Optional comments"></textarea></div>`;
}
async function submitFeedback(){const answers=[];for(const q of cache.currentQuestions){if(q.response_type==='text'){const v=$(`q_${q.id}`)?.value.trim();if(q.required&&!v){toast(`Please answer question ${q.position}`);return}answers.push({question_id:q.id,text_response:v})}else if(q.response_type==='yes_no'){const v=document.querySelector(`input[name="q_${q.id}"]:checked`)?.value;if(q.required&&!v){toast(`Please answer question ${q.position}`);return}answers.push({question_id:q.id,yes_no:v? v==='true':null})}else{const v=document.querySelector(`input[name="q_${q.id}"]:checked`)?.value;if(q.required&&!v){toast(`Please answer question ${q.position}`);return}answers.push({question_id:q.id,rating:v?Number(v):null})}}
 const facultyId=Number($('facultySelect').value);const sdb=studentClient(student.student_id);const {data:feedback,error}=await sdb.from('axial_v3_feedback').insert({cycle_id:cache.currentCycle.id,faculty_id:facultyId,student_login_id:student.student_id,student_id:student.student_id,year_level:student.year_level,division:student.division,comment:$('overallComment').value.trim()||null}).select('id').single();if(error){toast(error.message);return}
 const rows=answers.map(a=>({...a,feedback_id:feedback.id}));const {error:ae}=await sdb.from('axial_v3_feedback_answers').insert(rows);if(ae){await sdb.from('axial_v3_feedback').delete().eq('id',feedback.id);toast(ae.message);return}
 $('feedbackArea').innerHTML=`<div class="card success" style="margin-top:12px"><div class="check">✓</div><h2>Feedback submitted</h2><p class="muted">Thank you, ${esc(student.full_name)}. Your response has been recorded for this faculty member.</p><button class="btn secondary" onclick="renderStudent()">Submit for another faculty →</button></div>`;
}

async function getProfile(){if(!session)return null;const {data}=await sb.from('profiles').select('*').eq('user_id',session.user.id).maybeSingle();return data}
function staffShell(content){const nav=staffRole==='Super Admin'?[['dashboard','Dashboard'],['departments','Departments'],['hods','HOD Management'],['students','Students'],['faculty','Faculty'],['questions','Questions'],['cycles','Feedback Cycles'],['analytics','Analytics'],['exports','Downloads'],['audit','Audit Log'],['settings','Settings']]:[['dashboard','Dashboard'],['faculty','Faculty'],['cycles','Feedback Cycles'],['analytics','Analytics'],['exports','Downloads']];return `<div class="portal-shell"><aside class="sidebar"><div class="brand-row"><img src="assets/astra-logo.jpeg" class="sidebar-astra-logo" alt="ASTRA"><div><b>ASTRA</b><small>SIDDHANT COE</small></div></div><div class="role-pill"><b>${esc(profile?.full_name||'Staff')}</b><br>${esc(staffRole)}</div><div class="nav">${nav.map(([k,l])=>`<button class="${currentStaffPage===k?'active':''}" onclick="staffPage('${k}')">${l}</button>`).join('')}</div><div class="side-bottom"><button class="nav button" style="background:rgba(255,255,255,.08);color:#fff" onclick="signOut()">Sign out</button></div></aside><main class="main"><div class="topbar"><div class="brandline topbar-brand"><img src="assets/scoe-logo.jpeg" alt="Siddhant College of Engineering"><span>Siddhant College of Engineering · ASTRA Feedback Intelligence</span></div><div class="topbar-actions"><button class="btn secondary" onclick="refreshStaff()">Refresh</button></div></div><div id="staffContent">${content}</div></main></div>`}
async function renderStaff(){ $('loginScreen').classList.add('hidden');$('studentApp').classList.add('hidden');$('staffApp').classList.remove('hidden');currentStaffPage='dashboard';await renderStaffPage();}
async function refreshStaff(){await renderStaffPage()}
async function staffPage(p){
  currentStaffPage=p;
  const host=$('staffApp');
  if(host)host.innerHTML=staffShell(`<div class="card panel loading-panel"><div class="loading-spinner"></div><h2>Loading ${esc(p.charAt(0).toUpperCase()+p.slice(1))}…</h2><p class="muted">Fetching the latest live data. Please wait.</p></div>`);
  await renderStaffPage();
}
async function renderStaffPage(){
  let html='';
  try{
    if(currentStaffPage==='dashboard')html=await dashboard();
    else if(currentStaffPage==='departments')html=await departments();
    else if(currentStaffPage==='hods')html=await hods();
    else if(currentStaffPage==='students')html=await students();
    else if(currentStaffPage==='faculty')html=await faculty();
    else if(currentStaffPage==='questions')html=await questions();
    else if(currentStaffPage==='cycles')html=await cycles();
    else if(currentStaffPage==='analytics')html=await analytics();
    else if(currentStaffPage==='exports')html=await exportsPage();
    else if(currentStaffPage==='audit')html=await audit();
    else html=settings();
    $('staffApp').innerHTML=staffShell(html);
  }catch(e){
    $('staffApp').innerHTML=staffShell(errorBox(`Unable to load ${currentStaffPage}: ${e?.message||e}`));
  }
}

async function count(table){const {count,error}=await sb.from(table).select('*',{count:'exact',head:true});return error?0:count||0}
async function dashboard(){const [d,s,f,c,r]=await Promise.all([count('axial_departments'),count('axial_students'),count('axial_v3_faculty'),count('axial_v3_cycles'),count('axial_v3_feedback')]);return `<div class="page-head"><div><span class="eyebrow">ASTRA / COMMAND CENTER</span><h1>${staffRole==='Super Admin'?'Super Admin Dashboard':'HOD Dashboard'}</h1><p>${staffRole==='Super Admin'?'Full configuration and governance across the feedback system.':'Read-only department intelligence and report downloads.'}</p></div>${staffRole==='Super Admin'?'<div class="actions"><button class="btn gold" onclick="openEditor(\'cycle\')">+ New Feedback Cycle</button><button class="btn secondary" onclick="openEditor(\'student\')">+ Add Student</button></div>':''}</div><div class="grid4"><div class="card metric"><small>Departments</small><strong>${d}</strong><span>Configured</span></div><div class="card metric"><small>Students</small><strong>${s}</strong><span>Registered IDs</span></div><div class="card metric"><small>Faculty</small><strong>${f}</strong><span>Active records</span></div><div class="card metric"><small>Responses</small><strong>${r}</strong><span>Submitted feedback</span></div></div><div class="grid2"><div class="card panel"><div class="panel-head"><h3>Active Cycles</h3><small>Live database</small></div>${await cycleTable(true)}</div><div class="card panel"><div class="panel-head"><h3>System rules</h3></div><ul class="muted" style="line-height:1.9;padding-left:18px"><li>Students authenticate with registered ID only.</li><li>No faculty login exists.</li><li>HOD accounts are read-only for analytics/downloads.</li><li>Super Admin owns all configuration.</li><li>Feedback responses are immutable after submission.</li></ul></div></div>`}

async function departments(){const {data,error}=await sb.from('axial_departments').select('*').order('name');if(error)return errorBox(error.message);return page('Departments','Create, edit, activate and archive departments.',`<button class="btn gold" onclick="openEditor('department')">+ Add Department</button>`,`<div class="card panel"><div class="toolbar"><input id="search" placeholder="Search departments..." oninput="filterRows(this.value)"></div><div class="table-wrap"><table class="table"><thead><tr><th>Code</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.name)}</td><td><span class="badge ${x.active?'':'red'}">${x.active?'Active':'Disabled'}</span></td><td>${staffRole==='Super Admin'?`<button class="btn secondary" onclick='openEditor("department",${JSON.stringify(x)})'>Edit</button> <button class="btn secondary" onclick='toggleDepartment(${x.id},${x.active})'>${x.active?'Disable':'Enable'}</button>`:'Read-only'}</td></tr>`).join('')||`<tr><td colspan="4"><div class="empty">No departments configured yet.</div></td></tr>`}</tbody></table></div></div>`)}
async function hods(){const x={full_name:'Sonali Rangdale',email:HOD_LOGIN_EMAIL,department:'CE',active:true};return page('HOD Management','Staff authentication is stored only in app.js. Supabase Auth is not used for HOD/Super Admin login.', '', `<div class="card panel"><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Status</th></tr></thead><tbody><tr><td><b>${esc(x.full_name)}</b></td><td>${esc(x.email)}</td><td>${esc(x.department)}</td><td><span class="badge">Active</span></td></tr></tbody></table></div></div><div class="card panel" style="margin-top:14px"><b>Authentication mode</b><p class="muted">HOD and Super Admin credentials are hardcoded in <code>app.js</code>. Feedback data remains in Supabase.</p></div>`)}
async function students(){const {data,error}=await sb.from('axial_students').select('*').order('department_code').order('student_id');if(error)return errorBox(error.message);const action=`<div class="actions"><button class="btn gold" onclick="openEditor('student')">+ Add Student</button><button class="btn secondary" onclick="importStudents()">Import Excel</button><button class="btn secondary" onclick="downloadStudents()">Download CSV</button></div>`;const body=`<div class="card panel"><div class="toolbar"><input placeholder="Search by ID, name, department..." oninput="filterRows(this.value)"></div><div class="table-wrap"><table class="table"><thead><tr><th>Student ID</th><th>Name</th><th>Department</th><th>Year</th><th>Division</th><th>Status</th><th></th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td><b>${esc(x.student_id)}</b></td><td>${esc(x.full_name)}</td><td>${esc(x.department_code)}</td><td>${esc(x.year_level)}</td><td>${esc(x.division)}</td><td><span class="badge ${x.active?'':'red'}">${x.active?'Active':'Disabled'}</span></td><td><button class="btn secondary" onclick='openEditor("student",${JSON.stringify(x)})'>Edit</button></td></tr>`).join('')||`<tr><td colspan="7"><div class="empty">No students registered.</div></td></tr>`}</tbody></table></div></div>`;return page('Students','Registered IDs that can enter the feedback portal.',action,body)}
async function faculty(){const {data,error}=await sb.from('axial_v3_faculty').select('*').order('department_code').order('full_name');if(error)return errorBox(error.message);return page('Faculty','Faculty records used for feedback assignment. There is no faculty login.',staffRole==='Super Admin'?`<button class="btn gold" onclick="openEditor('faculty')">+ Add Faculty</button>`:'',`<div class="card panel"><div class="table-wrap"><table class="table"><thead><tr><th>Code</th><th>Name</th><th>Subject</th><th>Department</th><th>Year</th><th>Status</th><th></th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${esc(x.faculty_code)}</td><td><b>${esc(x.full_name)}</b></td><td>${esc(x.subject)}</td><td>${esc(x.department_code)}</td><td>${esc(x.year_level)}-${esc(x.division)}</td><td><span class="badge ${x.active?'':'red'}">${x.active?'Active':'Disabled'}</span></td><td>${staffRole==='Super Admin'?`<button class="btn secondary" onclick='openEditor("faculty",${JSON.stringify(x)})'>Edit</button>`:'Read only'}</td></tr>`).join('')||`<tr><td colspan="7"><div class="empty">No faculty records.</div></td></tr>`}</tbody></table></div></div>`)}
async function questions(){const {data,error}=await sb.from('axial_v3_questions').select('*').order('year_level').order('position');if(error)return errorBox(error.message);return page('Question Studio','Fully editable question bank by academic year and response type.',`<button class="btn gold" onclick="openEditor('question')">+ Add Question</button>`,`<div class="card panel"><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Year</th><th>Question</th><th>Type</th><th>Required</th><th></th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${x.position}</td><td>${x.year_level}</td><td>${esc(x.question_text)}</td><td>${esc(x.response_type)}</td><td>${x.required?'Yes':'No'}</td><td><button class="btn secondary" onclick='openEditor("question",${JSON.stringify(x)})'>Edit</button></td></tr>`).join('')||`<tr><td colspan="6"><div class="empty">No questions configured.</div></td></tr>`}</tbody></table></div></div>`)}
async function cycles(){return page('Feedback Cycles','Open, close and manage feedback windows and faculty assignments.',`<button class="btn gold" onclick="openEditor('cycle')">+ New Cycle</button>`,`<div class="card panel">${await cycleTable(false)}</div>`)}
async function cycleTable(compact){const {data}=await sb.from('axial_v3_cycles').select('*').order('start_date',{ascending:false});const rows=await Promise.all((data||[]).map(async x=>{const n=await responseCount(x.id);return `<tr><td><b>${esc(x.name)}</b></td><td>${x.year_level}</td><td>${x.start_date} → ${x.end_date}</td><td><span class="badge ${x.status==='open'?'':'red'}">${x.status}</span></td><td>${n}</td>${staffRole==='Super Admin'?`<td><button class="btn secondary" onclick='openEditor("cycle",${JSON.stringify(x)})'>Edit</button> <button class="btn secondary" onclick='openAssignment(${x.id})'>Assign Faculty</button> <button class="btn secondary" onclick='deleteCycle(${x.id})'>Delete</button></td>`:''}</tr>`}));return `<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Year</th><th>Window</th><th>Status</th><th>Responses</th>${staffRole==='Super Admin'?'<th></th>':''}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="6"><div class="empty">No cycles configured.</div></td></tr>`}</tbody></table></div>`}
async function responseCount(id){const {count}=await sb.from('axial_v3_feedback').select('*',{count:'exact',head:true}).eq('cycle_id',id);return count||0}
async function fetchAllRows(table,select='*',order='id'){
  let all=[],from=0;
  while(true){
    let q=sb.from(table).select(select).order(order).range(from,from+999);
    const {data,error}=await q;
    if(error)throw error;
    all=all.concat(data||[]);
    if(!data||data.length<1000)break;
    from+=1000;
  }
  return all;
}
async function analyticsBundle(){
  const [faculty,questions,cycles,feedback,answers,students,assignments]=await Promise.all([
    fetchAllRows('axial_v3_faculty','id,faculty_code,full_name,subject,designation,department_code,year_level,division,active','id'),
    fetchAllRows('axial_v3_questions','id,position,question_text,year_level,response_type,required,active','id'),
    fetchAllRows('axial_v3_cycles','id,hod_login_id,name,year_level,start_date,end_date,status,created_at','id'),
    fetchAllRows('axial_v3_feedback','id,cycle_id,faculty_id,student_login_id,student_id,year_level,division,comment,submitted_at','id'),
    fetchAllRows('axial_v3_feedback_answers','id,feedback_id,question_id,rating,yes_no,text_response,created_at','id'),
    fetchAllRows('axial_students','id,student_id,full_name,department_code,year_level,division,academic_year,active','id'),
    fetchAllRows('axial_v3_cycle_faculty','cycle_id,faculty_id,division','cycle_id')
  ]);
  return {faculty,questions,cycles,feedback,answers,students,assignments};
}
function buildAnalytics(b){
  const fm=new Map(b.faculty.map(x=>[Number(x.id),x])), qm=new Map(b.questions.map(x=>[Number(x.id),x])), cm=new Map(b.cycles.map(x=>[Number(x.id),x]));
  const fbm=new Map(b.feedback.map(x=>[Number(x.id),x]));
  const byFaculty=new Map(), byQuestion=new Map(), byCycle=new Map(), byDivision=new Map(), ratings={1:0,2:0,3:0,4:0,5:0};
  const comments=[];
  for(const f of b.feedback){
    const fac=fm.get(Number(f.faculty_id)), cyc=cm.get(Number(f.cycle_id));
    const fr=byFaculty.get(Number(f.faculty_id))||{submissions:0,sum:0,n:0,low:0,division:f.division,year_level:f.year_level,cycleIds:new Set()};
    fr.submissions++;fr.cycleIds.add(Number(f.cycle_id));byFaculty.set(Number(f.faculty_id),fr);
    const cr=byCycle.get(Number(f.cycle_id))||{submissions:0,sum:0,n:0,students:new Set()};cr.submissions++;cr.students.add(f.student_login_id);byCycle.set(Number(f.cycle_id),cr);
    const dr=byDivision.get(f.division)||{submissions:0,students:new Set(),sum:0,n:0};dr.submissions++;dr.students.add(f.student_login_id);byDivision.set(f.division,dr);
    if(f.comment&&String(f.comment).trim())comments.push({...f,faculty_name:fac?.full_name||'Unknown',subject:fac?.subject||'',cycle_name:cyc?.name||''});
  }
  for(const a of b.answers){
    if(a.rating===null||a.rating===undefined)continue;
    const v=Number(a.rating), f=fbm.get(Number(a.feedback_id)); if(!f)continue;
    const qr=byQuestion.get(Number(a.question_id))||{sum:0,n:0,dist:{1:0,2:0,3:0,4:0,5:0}};qr.sum+=v;qr.n++;qr.dist[v]=(qr.dist[v]||0)+1;byQuestion.set(Number(a.question_id),qr);
    const fr=byFaculty.get(Number(f.faculty_id))||{submissions:0,sum:0,n:0,low:0,division:f.division,year_level:f.year_level,cycleIds:new Set()};fr.sum+=v;fr.n++;if(v<=2)fr.low++;byFaculty.set(Number(f.faculty_id),fr);
    const cr=byCycle.get(Number(f.cycle_id))||{submissions:0,sum:0,n:0,students:new Set()};cr.sum+=v;cr.n++;byCycle.set(Number(f.cycle_id),cr);
    const dr=byDivision.get(f.division)||{submissions:0,students:new Set(),sum:0,n:0};dr.sum+=v;dr.n++;byDivision.set(f.division,dr);
    if(ratings[v]!==undefined)ratings[v]++;
  }
  const activeStudents=b.students.filter(s=>s.active);
  const responseStudents=new Set(b.feedback.map(x=>x.student_login_id));
  const avgAll=b.answers.filter(x=>x.rating!==null&&x.rating!==undefined);
  const overall=avgAll.length?(avgAll.reduce((s,x)=>s+Number(x.rating),0)/avgAll.length):0;
  return {fm,qm,cm,fbm,byFaculty,byQuestion,byCycle,byDivision,ratings,comments,activeStudents,responseStudents,overall};
}
function metricCard(label,value,note){return `<div class="card metric"><small>${label}</small><strong>${value}</strong><span>${note}</span></div>`}
function barRow(label,value,max,count){
  const pct=max?Math.max(2,Math.round(value/max*100)):0;
  return `<div class="bar-row"><div class="bar-label"><span>${esc(label)}</span><b>${value}</b></div><div class="bar-track"><i style="width:${pct}%"></i></div>${count!==undefined?`<small>${count} responses</small>`:''}</div>`;
}

function chartCard(title,subtitle,svg){return `<div class="card panel chart-card"><div class="panel-head"><div><h3>${esc(title)}</h3><small>${esc(subtitle||'')}</small></div></div>${svg}</div>`}
function svgBars(data,{width=720,height=260,max=null,format=v=>String(v),color='#a71924'}={}){
  const vals=data.map(d=>Number(d.value)||0), mx=max||Math.max(1,...vals), left=145, right=24, top=18, bottom=28, gap=10, rowH=Math.max(20,(height-top-bottom-gap*(data.length-1))/Math.max(1,data.length));
  const bw=width-left-right; let out=`<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img">`;
  data.forEach((d,i)=>{const y=top+i*(rowH+gap), w=Math.max(d.value?2:0,(Number(d.value)||0)/mx*bw);out+=`<text x="${left-8}" y="${y+rowH*.62}" text-anchor="end" class="chart-label">${esc(String(d.label).slice(0,24))}</text><rect x="${left}" y="${y}" width="${bw}" height="${rowH*.62}" rx="7" class="chart-track"></rect><rect x="${left}" y="${y}" width="${w}" height="${rowH*.62}" rx="7" fill="${color}"></rect><text x="${Math.min(left+w+7,width-4)}" y="${y+rowH*.62}" class="chart-value">${esc(format(d.value))}</text>`});
  return out+`</svg>`;
}
function svgColumns(data,{width=720,height=270,max=null,format=v=>String(v),color='#a71924'}={}){
  const vals=data.map(d=>Number(d.value)||0), mx=max||Math.max(1,...vals), left=42,right=16,top=18,bottom=55,innerW=width-left-right, slot=innerW/Math.max(1,data.length), bar=Math.max(12,slot*.58);let out=`<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img">`;
  data.forEach((d,i)=>{const x=left+i*slot+(slot-bar)/2,h=(Number(d.value)||0)/mx*(height-top-bottom),y=height-bottom-h;out+=`<rect x="${x}" y="${y}" width="${bar}" height="${h}" rx="6" fill="${color}"></rect><text x="${x+bar/2}" y="${y-6}" text-anchor="middle" class="chart-value">${esc(format(d.value))}</text><text x="${x+bar/2}" y="${height-bottom+17}" text-anchor="middle" class="chart-label">${esc(String(d.label).slice(0,13))}</text>`});
  return out+`<line x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}" class="chart-axis"/></svg>`;
}
function svgDonut(data,{size=220}={}){const total=data.reduce((s,d)=>s+(Number(d.value)||0),0);let a=-Math.PI/2,paths='',colors=['#a71924','#d9a441','#7b8b8a','#5b6670','#d8c2aa','#7a3d45'];data.forEach((d,i)=>{const frac=total?(Number(d.value)||0)/total:0, a2=a+frac*Math.PI*2, x1=110+82*Math.cos(a),y1=110+82*Math.sin(a),x2=110+82*Math.cos(a2),y2=110+82*Math.sin(a2),large=frac>.5?1:0;paths+=`<path d="M110 110 L${x1} ${y1} A82 82 0 ${large} 1 ${x2} ${y2} Z" fill="${colors[i%colors.length]}" opacity=".92"></path>`;a=a2});return `<div class="donut-wrap"><svg viewBox="0 0 220 220" class="donut-svg">${paths}<circle cx="110" cy="110" r="48" fill="white"></circle><text x="110" y="107" text-anchor="middle" class="donut-total">${total}</text><text x="110" y="126" text-anchor="middle" class="chart-label">responses</text></svg><div class="donut-legend">${data.map((d,i)=>`<span><i style="background:${colors[i%colors.length]}"></i>${esc(d.label)}: <b>${d.value}</b></span>`).join('')}</div></div>`}
function chartGrid(cards){return `<div class="chart-grid">${cards.join('')}</div>`}

async function analytics(){
  let b;
  try{b=await analyticsBundle()}catch(e){return errorBox(e.message)}
  const a=buildAnalytics(b);
  const active=a.activeStudents.length, responded=a.responseStudents.size, participation=active?Math.round(responded/active*100):0;
  const low=Object.entries(a.ratings).filter(([k])=>Number(k)<=2).reduce((s,[,v])=>s+v,0);
  const maxDist=Math.max(1,...Object.values(a.ratings));
  const facultyRows=b.faculty.map(f=>{
    const x=a.byFaculty.get(Number(f.id))||{submissions:0,sum:0,n:0,low:0,division:f.division};
    const eligible=b.students.filter(s=>s.active&&s.year_level===f.year_level&&s.division===f.division).length;
    const pct=eligible?Math.round(x.submissions/eligible*100):0;
    return {...f,...x,average:x.n?(x.sum/x.n):0,participation:pct};
  });
  const qRows=b.questions.map(q=>{const x=a.byQuestion.get(Number(q.id))||{sum:0,n:0,dist:{1:0,2:0,3:0,4:0,5:0}};return {...q,...x,average:x.n?(x.sum/x.n):0}});
  const cycleRows=b.cycles.map(c=>{const x=a.byCycle.get(Number(c.id))||{submissions:0,sum:0,n:0,students:new Set()};return {...c,...x,average:x.n?(x.sum/x.n):0,uniqueStudents:x.students.size}});
  const divRows=['A','B'].map(d=>{const x=a.byDivision.get(d)||{submissions:0,sum:0,n:0,students:new Set()};return {division:d,...x,average:x.n?(x.sum/x.n):0,uniqueStudents:x.students.size}});
  const topFaculty=[...facultyRows].filter(x=>x.n).sort((x,y)=>y.average-x.average).slice(0,3);
  return page('Faculty Intelligence','Complete HOD analytics: faculty, questions, cycles, divisions, response distribution, comments and raw response exports.',
    `<button class="btn gold" onclick="downloadAnalytics('xlsx')">Excel Report + Graphs</button><button class="btn secondary" onclick="downloadAnalytics('zipjson')">Full JSON</button><button class="btn secondary" onclick="downloadAnalytics('pdf')">Detailed PDF Report</button>`,
    `<div class="grid4">${metricCard('Active Students',active,'Registered active IDs')}${metricCard('Students Responded',responded,participation+'% participation')}${metricCard('Feedback Entries',b.feedback.length,'Faculty submissions')}${metricCard('Overall Rating',a.overall.toFixed(2)+'/5',low+' ratings at 1–2')}</div>
    ${chartGrid([
      chartCard('1. Overall rating distribution','Count of every 1–5 rating',svgDonut([5,4,3,2,1].map(v=>({label:String(v),value:a.ratings[v]})))),
      chartCard('2. Average rating by faculty','Mean score across all parameters',svgBars(facultyRows.map(x=>({label:x.full_name,value:x.average})),{max:5,format:v=>Number(v).toFixed(2)})),
      chartCard('3. Feedback responses by faculty','Number of submitted faculty feedback entries',svgColumns(facultyRows.map(x=>({label:x.full_name,value:x.submissions})))),
      chartCard('4. Low ratings by faculty','Ratings of 1 or 2',svgBars(facultyRows.map(x=>({label:x.full_name,value:x.low})))),
      chartCard('5. Average by parameter','Average score for every question',svgColumns(qRows.map(q=>({label:`Q${q.position}`,value:q.average})),{max:5,format:v=>Number(v).toFixed(2)})),
      chartCard('6. Low ratings by parameter','Count of ratings ≤ 2 for each question',svgBars(qRows.map(q=>({label:`Q${q.position} · ${q.question_text}`,value:(q.dist[1]||0)+(q.dist[2]||0)})))),
      chartCard('7. Participation by division','Unique students who submitted feedback',svgColumns(divRows.map(x=>({label:'Division '+x.division,value:x.uniqueStudents})),{max:Math.max(1,active)})),
      chartCard('8. Average rating by division','Mean rating across each division',svgColumns(divRows.map(x=>({label:'Division '+x.division,value:x.average})),{max:5,format:v=>Number(v).toFixed(2)})),
      chartCard('9. Responses by cycle','Feedback entries in each cycle',svgBars(cycleRows.map(x=>({label:x.name,value:x.submissions})))),
      chartCard('10. Average by cycle','Mean rating for each feedback cycle',svgColumns(cycleRows.map(x=>({label:x.name,value:x.average})),{max:5,format:v=>Number(v).toFixed(2)})),
      chartCard('11. Rating mix','Share of excellent to poor responses',svgColumns([5,4,3,2,1].map(v=>({label:String(v),value:a.ratings[v]})))),
      chartCard('12. Comment volume by faculty','Written comments submitted for each faculty',svgBars(facultyRows.map(f=>({label:f.full_name,value:a.comments.filter(c=>Number(c.faculty_id)===Number(f.id)).length}))))
    ])}
    <div class="grid2">
      <div class="card panel"><div class="panel-head"><div><h3>Rating distribution</h3><small>All submitted 1–5 ratings</small></div><button class="btn secondary" onclick="downloadAnalytics('ratings')">CSV</button></div>${[5,4,3,2,1].map(v=>barRow(String(v),a.ratings[v],maxDist)).join('')}</div>
      <div class="card panel"><div class="panel-head"><div><h3>Participation by division</h3><small>Student response coverage</small></div></div>${divRows.map(x=>barRow('Division '+x.division,x.uniqueStudents,Math.max(1,active),x.submissions)).join('')}</div>
    </div>
    <div class="card panel" style="margin-top:12px"><div class="panel-head"><div><h3>Faculty performance matrix</h3><small>Click View for full faculty analysis</small></div><div class="actions"><button class="btn secondary" onclick="downloadAnalytics('faculty')">Faculty CSV</button><button class="btn secondary" onclick="downloadAnalytics('answers')">Raw Answers CSV</button><button class="btn secondary" onclick="downloadAnalytics('comments')">Comments CSV</button></div></div>
      <div class="table-wrap"><table class="table wide-table"><thead><tr><th>Faculty</th><th>Subject</th><th>Div</th><th>Responses</th><th>Participation</th><th>Average</th><th>Low ≤2</th><th>Actions</th></tr></thead><tbody>
      ${facultyRows.map(f=>`<tr><td><b>${esc(f.full_name)}</b><br><small>${esc(f.faculty_code||'')}</small></td><td>${esc(f.subject)}</td><td>${f.year_level}-${f.division}</td><td>${f.submissions}</td><td>${f.participation}%</td><td><b>${f.n?f.average.toFixed(2):'—'}</b>/5</td><td>${f.low||0}</td><td><button class="btn secondary" onclick="viewFacultyAnalysis(${f.id})">View</button></td></tr>`).join('')||'<tr><td colspan="8"><div class="empty">No faculty records.</div></td></tr>'}
      </tbody></table></div>
    </div>
    <div class="card panel" style="margin-top:12px"><div class="panel-head"><div><h3>Parameter / question analysis</h3><small>Every mandatory parameter with distribution and average</small></div><button class="btn secondary" onclick="downloadAnalytics('questions')">Question CSV</button></div>
      <div class="table-wrap"><table class="table wide-table"><thead><tr><th>#</th><th>Parameter</th><th>Responses</th><th>Avg</th><th>5</th><th>4</th><th>3</th><th>2</th><th>1</th></tr></thead><tbody>
      ${qRows.map(q=>`<tr><td>${q.position}</td><td>${esc(q.question_text)}</td><td>${q.n}</td><td><b>${q.n?q.average.toFixed(2):'—'}</b>/5</td><td>${q.dist[5]||0}</td><td>${q.dist[4]||0}</td><td>${q.dist[3]||0}</td><td>${q.dist[2]||0}</td><td>${q.dist[1]||0}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="grid2" style="margin-top:12px">
      <div class="card panel"><div class="panel-head"><div><h3>Cycle analysis</h3><small>Every feedback window</small></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Cycle</th><th>Status</th><th>Responses</th><th>Students</th><th>Avg</th></tr></thead><tbody>${cycleRows.map(c=>`<tr><td>${esc(c.name)}</td><td><span class="badge ${c.status==='open'?'':'red'}">${esc(c.status)}</span></td><td>${c.submissions}</td><td>${c.uniqueStudents}</td><td>${c.n?c.average.toFixed(2):'—'}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card panel"><div class="panel-head"><div><h3>Comments & written feedback</h3><small>${a.comments.length} comments collected</small></div><button class="btn secondary" onclick="downloadAnalytics('comments')">Download</button></div>${a.comments.slice(0,12).map(c=>`<div class="comment-row"><b>${esc(c.faculty_name)}</b><small>${esc(c.subject)} · ${esc(c.division)} · ${new Date(c.submitted_at).toLocaleString('en-IN')}</small><p>${esc(c.comment)}</p></div>`).join('')||'<div class="empty">No comments yet.</div>'}</div>
    </div>
    <div class="card panel" style="margin-top:12px"><div class="panel-head"><div><h3>Quick insight panels</h3><small>Derived directly from submitted responses</small></div></div>
      <div class="insight-grid"><div><b>Highest-rated faculty</b><p>${topFaculty.length?topFaculty.map(x=>esc(x.full_name)+' — '+x.average.toFixed(2)+'/5').join('<br>'):'No rated faculty yet.'}</p></div><div><b>Low-rating volume</b><p>${low} ratings were 1 or 2 out of ${Object.values(a.ratings).reduce((s,v)=>s+v,0)} total ratings.</p></div><div><b>Question coverage</b><p>${qRows.filter(x=>x.n).length} of ${qRows.length} parameters have submitted ratings.</p></div><div><b>Download scope</b><p>Excel includes summary, faculty, questions, cycles, assignments, raw feedback, answers, comments and student registry.</p></div></div>
    </div>`
  );
}
async function viewFacultyAnalysis(id){
  let b;try{b=await analyticsBundle()}catch(e){return toast(e.message)}
  const a=buildAnalytics(b), f=b.faculty.find(x=>Number(x.id)===Number(id)); if(!f)return toast('Faculty not found');
  const fbs=b.feedback.filter(x=>Number(x.faculty_id)===Number(id)), fids=new Set(fbs.map(x=>Number(x.id)));
  const qs=b.questions.map(q=>{const vals=b.answers.filter(x=>fids.has(Number(x.feedback_id))&&Number(x.question_id)===Number(q.id)&&x.rating!==null);const sum=vals.reduce((s,x)=>s+Number(x.rating),0);return {...q,n:vals.length,average:vals.length?sum/vals.length:0,dist:[1,2,3,4,5].map(v=>vals.filter(x=>Number(x.rating)===v).length)}});
  const comments=fbs.filter(x=>x.comment&&String(x.comment).trim()).map(x=>`<div class="comment-row"><small>${new Date(x.submitted_at).toLocaleString('en-IN')} · ${esc(x.division)}</small><p>${esc(x.comment)}</p></div>`).join('');
  const ratings=fbs.flatMap(fb=>b.answers.filter(x=>Number(x.feedback_id)===Number(fb.id)&&x.rating!==null).map(x=>Number(x.rating)));
  const average=ratings.length?ratings.reduce((s,v)=>s+v,0)/ratings.length:0;
  const cycleStats=b.cycles.map(c=>{const fs=fbs.filter(x=>Number(x.cycle_id)===Number(c.id));const rs=fs.flatMap(fb=>b.answers.filter(x=>Number(x.feedback_id)===Number(fb.id)&&x.rating!==null).map(x=>Number(x.rating)));return {name:c.name,n:fs.length,avg:rs.length?rs.reduce((z,v)=>z+v,0)/rs.length:0,comments:fs.filter(x=>x.comment&&String(x.comment).trim()).length}}).filter(x=>x.n||x.avg||x.comments);
  const question5=qs.map(q=>({label:`Q${q.position}`,value:q.n?(q.dist[4]||0)/q.n*100:0}));
  const questionLow=qs.map(q=>({label:`Q${q.position}`,value:q.n?((q.dist[0]||0)+(q.dist[1]||0))/q.n*100:0}));
  const questionAvg=qs.map(q=>({label:`Q${q.position}`,value:q.average}));
  const questionResponses=qs.map(q=>({label:`Q${q.position}`,value:q.n}));
  const ratingCounts=[1,2,3,4,5].map(v=>({label:String(v),value:ratings.filter(x=>x===v).length}));
  const commentByCycle=cycleStats.map(x=>({label:x.name,value:x.comments}));
  const responseByCycle=cycleStats.map(x=>({label:x.name,value:x.n}));
  const avgByCycle=cycleStats.map(x=>({label:x.name,value:x.avg}));
  const maxRating=Math.max(1,...ratingCounts.map(x=>x.value));
  const facultyCharts=chartGrid([
    chartCard('1. Overall rating mix','1–5 rating counts for this faculty',svgDonut(ratingCounts)),
    chartCard('2. Average by parameter','Mean score for each question',svgColumns(questionAvg,{max:5,format:v=>Number(v).toFixed(2)})),
    chartCard('3. Responses by parameter','Number of answers received per question',svgColumns(questionResponses)),
    chartCard('4. Excellent-rate by parameter','Percentage of ratings that were 5',svgBars(question5,{max:100,format:v=>Number(v).toFixed(0)+'%'})),
    chartCard('5. Low-rating rate by parameter','Percentage of ratings that were 1–2',svgBars(questionLow,{max:100,format:v=>Number(v).toFixed(0)+'%'})),
    chartCard('6. Rating counts','Exact count for every rating level',svgColumns(ratingCounts,{max:maxRating})),
    chartCard('7. Responses by cycle','Feedback submissions for this faculty',svgBars(responseByCycle)),
    chartCard('8. Average by cycle','Mean rating for this faculty in each cycle',svgColumns(avgByCycle,{max:5,format:v=>Number(v).toFixed(2)})),
    chartCard('9. Comments by cycle','Written comments received',svgBars(commentByCycle)),
    chartCard('10. Parameter score profile','Visual score profile across all questions',svgBars(questionAvg,{max:5,format:v=>Number(v).toFixed(2)}))
  ]);
  $('modalBox').innerHTML=`<h2>${esc(f.full_name)}</h2><p>${esc(f.subject)} · ${esc(f.year_level)}-${esc(f.division)} · ${esc(f.designation||'')}</p>
  <div class="grid4 modal-metrics">${metricCard('Responses',fbs.length,'Feedback entries')}${metricCard('Average',average.toFixed(2)+'/5','All parameters')}${metricCard('Low ratings',ratings.filter(v=>v<=2).length,'Ratings ≤ 2')}${metricCard('Comments',fbs.filter(x=>x.comment&&String(x.comment).trim()).length,'Written responses')}</div>${facultyCharts}
  <div class="card panel modal-analysis"><h3>Parameter analysis</h3><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Parameter</th><th>Responses</th><th>Average</th><th>5</th><th>4</th><th>3</th><th>2</th><th>1</th></tr></thead><tbody>${qs.map(q=>`<tr><td>${q.position}</td><td>${esc(q.question_text)}</td><td>${q.n}</td><td>${q.n?q.average.toFixed(2):'—'}</td><td>${q.dist[4]||0}</td><td>${q.dist[3]||0}</td><td>${q.dist[2]||0}</td><td>${q.dist[1]||0}</td><td>${q.dist[0]||0}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card panel modal-analysis"><h3>Written comments</h3>${comments||'<div class="empty">No comments for this faculty yet.</div>'}</div>
  <div class="modal-actions"><button class="btn secondary" onclick="downloadFacultyReport(${id})">Download Faculty Report</button><button class="btn gold" onclick="closeModal()">Close</button></div>`;
  $('modal').classList.remove('hidden');
}
async function downloadFacultyReport(id){
  let b;try{b=await analyticsBundle()}catch(e){return toast(e.message)}
  const f=b.faculty.find(x=>Number(x.id)===Number(id));if(!f)return toast('Faculty not found');
  const fbs=b.feedback.filter(x=>Number(x.faculty_id)===Number(id)),fids=new Set(fbs.map(x=>Number(x.id)));
  const rows=b.questions.map(q=>{const vals=b.answers.filter(a=>fids.has(Number(a.feedback_id))&&Number(a.question_id)===Number(q.id)&&a.rating!==null);const sum=vals.reduce((s,x)=>s+Number(x.rating),0);return {Position:q.position,Parameter:q.question_text,Responses:vals.length,Average:vals.length?(sum/vals.length).toFixed(2):'',Rating_5:vals.filter(x=>Number(x.rating)===5).length,Rating_4:vals.filter(x=>Number(x.rating)===4).length,Rating_3:vals.filter(x=>Number(x.rating)===3).length,Rating_2:vals.filter(x=>Number(x.rating)===2).length,Rating_1:vals.filter(x=>Number(x.rating)===1).length}});
  const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Faculty Analysis');XLSX.writeFile(wb,`${f.full_name.replace(/[^a-z0-9]+/gi,'_')}_report.xlsx`);
}

async function exportsPage(){
  return page('Download Center','HOD can export the complete analytics dataset. Every download is generated from the live Supabase data.',
  `<button class="btn gold" onclick="downloadAnalytics('xlsx')">Excel Report + Graphs</button><button class="btn secondary" onclick="downloadAnalytics('zipjson')">Full JSON</button>`,
  `<div class="download-grid">
    <div class="card panel"><h3>Excel Report + Graphs</h3><p class="muted">Excel report styled after the college feedback-analysis format, with faculty-wise performance tables, percentage analysis and real Excel bar charts.</p><button class="btn gold" onclick="downloadAnalytics('xlsx')">Generate Excel + Graphs</button></div>
    <div class="card panel"><h3>Raw Feedback</h3><p class="muted">Every submitted faculty feedback record with cycle, student ID, division, comment and timestamp.</p><button class="btn secondary" onclick="downloadAnalytics('feedback')">CSV</button></div>
    <div class="card panel"><h3>Raw Answers</h3><p class="muted">Every question response with parameter text, rating, yes/no or text response.</p><button class="btn secondary" onclick="downloadAnalytics('answers')">CSV</button></div>
    <div class="card panel"><h3>Question Analysis</h3><p class="muted">Per-parameter averages and 1–5 distribution.</p><button class="btn secondary" onclick="downloadAnalytics('questions')">CSV</button></div>
    <div class="card panel"><h3>Faculty Results</h3><p class="muted">Faculty, subject, division, responses, participation, average and low-rating counts.</p><button class="btn secondary" onclick="downloadAnalytics('faculty')">CSV</button></div>
    <div class="card panel"><h3>Comments</h3><p class="muted">All written comments for qualitative review.</p><button class="btn secondary" onclick="downloadAnalytics('comments')">CSV</button></div>
    <div class="card panel"><h3>Students</h3><p class="muted">Current student registry for administrative reporting.</p><button class="btn secondary" onclick="downloadStudents()">CSV</button></div>
    <div class="card panel"><h3>Faculty Feedback PDF Report</h3><p class="muted">A3, multi-page report styled after the college feedback report format, using the Siddhant College logo.</p><button class="btn gold" onclick="downloadAnalytics('pdf')">Generate Detailed PDF Report</button></div>
  </div>`
  );
}

async function audit(){const {data,error}=await sb.from('axial_audit_log').select('*').order('created_at',{ascending:false}).limit(200);if(error)return errorBox(error.message);return page('Audit Log','Trace administrative changes and governance events.','',`<div class="card panel"><div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Role</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${new Date(x.created_at).toLocaleString('en-IN')}</td><td>${esc(x.actor_role)}</td><td>${esc(x.action)}</td><td>${esc(x.entity)}</td><td>${esc(JSON.stringify(x.details))}</td></tr>`).join('')||`<tr><td colspan="5"><div class="empty">No audit events yet.</div></td></tr>`}</tbody></table></div></div>`)}
function settings(){return page('Settings','System behavior and branding.', '', `<div class="grid2"><div class="card panel"><h3>Identity</h3><p class="muted">College: Siddhant College of Engineering<br>Product: ASTRA Feedback Intelligence<br>Theme: Red + Gold</p></div><div class="card panel"><h3>Access model</h3><p class="muted">Student: ID only<br>HOD: email + password, analytics/download only<br>Super Admin: email + password, full configuration<br>Faculty: no login</p></div></div>`)}
function page(title,sub,action,body){return `<div class="page-head"><div><span class="eyebrow">ASTRA / ${title.toUpperCase()}</span><h1>${title}</h1><p>${sub}</p></div><div class="actions">${action||''}</div></div>${body}`}
function errorBox(msg){return `<div class="card panel"><div class="error">${esc(msg)}</div></div>`}
function filterRows(q){const v=q.toLowerCase();document.querySelectorAll('tbody tr').forEach(r=>r.style.display=r.innerText.toLowerCase().includes(v)?'':'none')}

async function openEditor(type,row=null){if(staffRole!=='Super Admin')return toast('Super Admin access required');let title='',fields='',save='';if(type==='department'){title=row?'Edit Department':'Add Department';fields=`${input('code',row?.code,'Department Code','CE')}${input('name',row?.name,'Department Name','Computer Engineering')}${checkbox('active',row?.active??true,'Active')}`;save=`saveDepartment(${row?.id||'null'})`}if(type==='student'){title=row?'Edit Student':'Add Student';fields=`${input('student_id',row?.student_id,'Student ID','SCOE23CE001')}${input('full_name',row?.full_name,'Full Name','Student Name')}${input('department_code',row?.department_code,'Department Code','CE')}${select('year_level',row?.year_level||'SE',['FE','SE','TE','BE'])}${input('division',row?.division,'Division','A')}${input('academic_year',row?.academic_year||'2026-27','Academic Year','2026-27')}${checkbox('active',row?.active??true,'Active')}`;save=`saveStudent(${row?.id||'null'})`}if(type==='faculty'){title=row?'Edit Faculty':'Add Faculty';fields=`${input('hod_login_id',row?.hod_login_id,'HOD login ID (optional)','')}${input('faculty_code',row?.faculty_code,'Faculty Code','CE001')}${input('full_name',row?.full_name,'Full Name','Prof. Name')}${input('subject',row?.subject,'Subject','DBMS')}${input('department_code',row?.department_code,'Department','CE')}${select('year_level',row?.year_level||'SE','FE,SE,TE,BE'.split(','))}${select('division',row?.division||'A',['A','B'])}${checkbox('active',row?.active??true,'Active')}`;save=`saveFaculty(${row?.id||'null'})`}if(type==='question'){title=row?'Edit Question':'Add Question';fields=`${select('year_level',row?.year_level||'SE',['FE','SE','TE','BE'])}${input('position',row?.position||1,'Position','1','number')}${input('question_text',row?.question_text,'Question','The faculty explains concepts clearly.','text')}${select('response_type',row?.response_type||'rating_1_5',['rating_1_5','yes_no','text'])}${checkbox('required',row?.required??true,'Required')}${checkbox('active',row?.active??true,'Active')}`;save=`saveQuestion(${row?.id||'null'})`}if(type==='cycle'){title=row?'Edit Feedback Cycle':'New Feedback Cycle';fields=`${input('name',row?.name,'Cycle Name','SE Faculty Feedback')}${select('year_level',row?.year_level||'SE',['FE','SE','TE','BE'])}${input('start_date',row?.start_date||new Date().toISOString().slice(0,10),'Start Date','YYYY-MM-DD','date')}${input('end_date',row?.end_date||new Date().toISOString().slice(0,10),'End Date','YYYY-MM-DD','date')}${select('status',row?.status||'draft',['draft','open','closed'])}`;save=`saveCycle(${row?.id||'null'})`}if(type==='hodEdit'){title='Edit HOD';fields=`${input('full_name',row?.full_name,'Full Name','Prof. Name')}${input('department',row?.department,'Department Code','CE')}${input('phone',row?.phone,'Phone (optional)','')}${checkbox('active',row?.active!==false,'Active')}`;save=`saveHod(${JSON.stringify(row?.user_id||'')})`}if(type==='hod'){title='Create HOD';fields=`${input('full_name','','Full Name','Prof. Name')}${input('email','','Email','hod@college.edu','email')}${input('password','','Temporary Password','Minimum 8 characters','password')}${input('department','','Department Code','CE')}${input('phone','','Phone (optional)','')}`;save='createHod()'}$('modalBox').innerHTML=`<h2>${title}</h2><p>Changes are saved to Supabase and auditable.</p><div class="form-grid">${fields}</div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn gold" onclick="${save}">Save</button></div>`;$('modal').classList.remove('hidden')}
function input(id,val,label,ph,type='text'){return `<div class="field"><label>${label}</label><input id="f_${id}" type="${type}" value="${esc(val)}" placeholder="${esc(ph)}"></div>`}function select(id,val,opts){return `<div class="field"><label>${id.replaceAll('_',' ')}</label><select id="f_${id}">${opts.map(o=>`<option ${String(o)===String(val)?'selected':''}>${o}</option>`).join('')}</select></div>`}function checkbox(id,val,label){return `<div class="field"><label>${label}</label><select id="f_${id}"><option value="true" ${val?'selected':''}>Yes</option><option value="false" ${!val?'selected':''}>No</option></select></div>`}
const fv=id=>$(`f_${id}`)?.value.trim();const fb=id=>fv(id)==='true';
async function writeAudit(action,entity,id,details={}){await sb.from('axial_audit_log').insert({actor_user_id:session?.user?.id,actor_role:staffRole,action,entity,entity_id:id?String(id):null,details})}
async function saveDepartment(id){const payload={code:fv('code'),name:fv('name'),active:fb('active')};const q=id?sb.from('axial_departments').update(payload).eq('id',id):sb.from('axial_departments').insert(payload);const {error}=await q;if(error)return toast(error.message);await writeAudit(id?'update':'create','department',id,payload);closeModal();renderStaffPage();toast('Department saved')}
async function toggleDepartment(id,active){const {error}=await sb.from('axial_departments').update({active:!active}).eq('id',id);if(error)return toast(error.message);await writeAudit('toggle','department',id,{active:!active});renderStaffPage()}
async function saveStudent(id){const payload={student_id:fv('student_id'),full_name:fv('full_name'),department_code:fv('department_code'),year_level:fv('year_level'),division:fv('division'),academic_year:fv('academic_year'),active:fb('active'),updated_at:new Date().toISOString()};const q=id?sb.from('axial_students').update(payload).eq('id',id):sb.from('axial_students').insert(payload);const {error}=await q;if(error)return toast(error.message);await writeAudit(id?'update':'create','student',id,payload);closeModal();renderStaffPage();toast('Student saved')}
async function saveFaculty(id){const payload={hod_login_id:fv('hod_login_id'),faculty_code:fv('faculty_code'),full_name:fv('full_name'),subject:fv('subject'),department_code:fv('department_code'),year_level:fv('year_level'),division:fv('division'),active:fb('active')};const q=id?sb.from('axial_v3_faculty').update(payload).eq('id',id):sb.from('axial_v3_faculty').insert(payload);const {error}=await q;if(error)return toast(error.message);await writeAudit(id?'update':'create','faculty',id,payload);closeModal();renderStaffPage();toast('Faculty saved')}
async function saveQuestion(id){const payload={hod_login_id:profile?.email||'sonalirangdale@scoe.edu',year_level:fv('year_level'),position:Number(fv('position')),question_text:fv('question_text'),response_type:fv('response_type'),required:fb('required'),active:fb('active')};const q=id?sb.from('axial_v3_questions').update(payload).eq('id',id):sb.from('axial_v3_questions').insert(payload);const {error}=await q;if(error)return toast(error.message);await writeAudit(id?'update':'create','question',id,payload);closeModal();renderStaffPage();toast('Question saved')}
async function saveCycle(id){
  const payload={name:fv('name'),year_level:fv('year_level'),start_date:fv('start_date'),end_date:fv('end_date'),status:fv('status'),hod_login_id:profile?.email||HOD_LOGIN_EMAIL};
  if(payload.end_date<payload.start_date)return toast('End date cannot be before start date');
  const q=id?sb.from('axial_v3_cycles').update(payload).eq('id',id):sb.from('axial_v3_cycles').insert(payload).select('id').single();
  const {data,error}=await q;
  if(error)return toast(error.message);
  await writeAudit(id?'update':'create','cycle',id||data?.id,payload);
  closeModal();renderStaffPage();toast('Feedback cycle saved');
}
async function createHod(){closeModal();toast('HOD authentication is managed in app.js. Supabase Auth is not used.');}

async function saveHod(userId){closeModal();toast('HOD authentication is managed in app.js.');}
async function openAssignment(cycleId){const {data:faculty,error}=await sb.from('axial_v3_faculty').select('*').eq('active',true).order('department_code').order('full_name');if(error)return toast(error.message);const {data:assigned}=await sb.from('axial_v3_cycle_faculty').select('faculty_id').eq('cycle_id',cycleId);const selected=new Set((assigned||[]).map(x=>x.faculty_id));$('modalBox').innerHTML=`<h2>Assign Faculty</h2><p>Select which active faculty members should receive this feedback cycle.</p><div style="display:grid;gap:8px;max-height:55vh;overflow:auto">${(faculty||[]).map(f=>`<label style="display:flex;gap:10px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:10px"><input class="assign-faculty" type="checkbox" value="${f.id}" ${selected.has(f.id)?'checked':''}> <span><b>${esc(f.full_name)}</b><br><small class="muted">${esc(f.department_code)} · ${esc(f.subject)} · ${esc(f.year_level)}-${esc(f.division)}</small></span></label>`).join('')||'<div class="empty">No active faculty records.</div>'}</div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn gold" onclick="saveAssignment(${cycleId})">Save Assignment</button></div>`;$('modal').classList.remove('hidden')}
async function saveAssignment(cycleId){
  const ids=[...document.querySelectorAll('.assign-faculty:checked')].map(x=>Number(x.value));
  const {error:delErr}=await sb.from('axial_v3_cycle_faculty').delete().eq('cycle_id',cycleId);
  if(delErr)return toast(delErr.message);
  if(ids.length){
    const {data:fac,error:fe}=await sb.from('axial_v3_faculty').select('id,division').in('id',ids);
    if(fe)return toast(fe.message);
    const {error}=await sb.from('axial_v3_cycle_faculty').insert((fac||[]).map(f=>({cycle_id:cycleId,faculty_id:f.id,division:f.division})));
    if(error)return toast(error.message);
  }
  await writeAudit('assign','cycle_faculty',cycleId,{faculty_ids:ids});
  closeModal();renderStaffPage();toast('Faculty assignment saved');
}
async function deleteCycle(id){
  if(staffRole!=='Super Admin')return;
  const {count,error:ce}=await sb.from('axial_v3_feedback').select('*',{count:'exact',head:true}).eq('cycle_id',id);
  if(ce)return toast(ce.message);
  if(Number(count||0)>0)return toast('This cycle already has feedback responses. Close it instead of deleting it.');
  if(!confirm('Delete this feedback cycle and its faculty assignments?'))return;
  const {error:ae}=await sb.from('axial_v3_cycle_faculty').delete().eq('cycle_id',id);
  if(ae)return toast(ae.message);
  const {error}=await sb.from('axial_v3_cycles').delete().eq('id',id);
  if(error)return toast(error.message);
  await writeAudit('delete','cycle',id,{});
  renderStaffPage();toast('Feedback cycle deleted');
}

async function importStudents(){const file=document.createElement('input');file.type='file';file.accept='.xlsx,.xls,.csv';file.onchange=async()=>{const f=file.files[0];if(!f)return;const data=await f.arrayBuffer();const wb=XLSX.read(data);const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});const mapped=rows.map(r=>({student_id:String(r.student_id||r.StudentID||r['Student ID']||'').trim(),full_name:String(r.full_name||r.Name||r['Full Name']||'').trim(),department_code:String(r.department_code||r.Department||r.Dept||'').trim(),year_level:String(r.year_level||r.Year||'SE').trim(),division:String(r.division||r.Division||'A').trim(),academic_year:String(r.academic_year||r['Academic Year']||'2026-27').trim(),active:true})).filter(x=>x.student_id&&x.full_name&&x.department_code);if(!mapped.length)return toast('No valid student rows found');const {error}=await sb.from('axial_students').upsert(mapped,{onConflict:'student_id'});if(error)return toast(error.message);await writeAudit('import','students',null,{count:mapped.length});toast(`${mapped.length} students imported`);renderStaffPage()};file.click()}
async function downloadStudents(){const {data,error}=await sb.from('axial_students').select('student_id,full_name,department_code,year_level,division,academic_year,active').order('student_id');if(error)return toast(error.message);downloadBlob(toCsv(data||[]),'siddhant_students.csv','text/csv')}
async function downloadAnalytics(kind){
  let b;try{b=await analyticsBundle()}catch(e){return toast(e.message)}
  const a=buildAnalytics(b);
  const facultyRows=b.faculty.map(f=>{const x=a.byFaculty.get(Number(f.id))||{submissions:0,sum:0,n:0,low:0};const eligible=b.students.filter(s=>s.active&&s.year_level===f.year_level&&s.division===f.division).length;return {Faculty:f.full_name,Faculty_Code:f.faculty_code,Subject:f.subject,Designation:f.designation,Department:f.department_code,Year:f.year_level,Division:f.division,Status:f.active?'Active':'Disabled',Submissions:x.submissions||0,Participation:eligible?Math.round((x.submissions||0)/eligible*100)+'%':'0%',Average_Rating:x.n?(x.sum/x.n).toFixed(2):'',Low_Ratings:x.low||0,Comments:b.feedback.filter(z=>Number(z.faculty_id)===Number(f.id)&&z.comment&&String(z.comment).trim()).length}});
  const questionRows=b.questions.map(q=>{const x=a.byQuestion.get(Number(q.id))||{sum:0,n:0,dist:{1:0,2:0,3:0,4:0,5:0}};return {Position:q.position,Year:q.year_level,Parameter:q.question_text,Responses:x.n||0,Average:x.n?(x.sum/x.n).toFixed(2):'',Rating_5:x.dist[5]||0,Rating_4:x.dist[4]||0,Rating_3:x.dist[3]||0,Rating_2:x.dist[2]||0,Rating_1:x.dist[1]||0}});
  const feedbackRows=b.feedback.map(f=>{const fac=a.fm.get(Number(f.faculty_id)),cyc=a.cm.get(Number(f.cycle_id));return {Feedback_ID:f.id,Cycle:cyc?.name||'',Faculty:fac?.full_name||'',Faculty_Code:fac?.faculty_code||'',Subject:fac?.subject||'',Student_ID:f.student_id||f.student_login_id||'',Year:f.year_level,Division:f.division,Comment:f.comment||'',Submitted_At:f.submitted_at||''}});
  const answerRows=b.answers.map(x=>{const f=a.fbm.get(Number(x.feedback_id)),fac=f?a.fm.get(Number(f.faculty_id)):null,q=a.qm.get(Number(x.question_id));return {Answer_ID:x.id,Feedback_ID:x.feedback_id,Faculty:fac?.full_name||'',Subject:fac?.subject||'',Student_ID:f?.student_id||f?.student_login_id||'',Division:f?.division||'',Question_No:q?.position||'',Parameter:q?.question_text||'',Rating:x.rating??'',Yes_No:x.yes_no??'',Text_Response:x.text_response??'',Created_At:x.created_at||''}});
  const commentRows=feedbackRows.filter(x=>x.Comment);
  const divisionRows=['A','B'].map(d=>{const x=a.byDivision.get(d)||{submissions:0,sum:0,n:0,students:new Set()};return {Division:d,Unique_Students:x.students.size,Feedback_Entries:x.submissions||0,Average:x.n?(x.sum/x.n).toFixed(2):''}});
  const cycleRows=b.cycles.map(c=>{const x=a.byCycle.get(Number(c.id))||{submissions:0,sum:0,n:0,students:new Set()};return {Cycle:c.name,Year:c.year_level,Status:c.status,Start:c.start_date,End:c.end_date,Unique_Students:x.students.size,Feedback_Entries:x.submissions||0,Average:x.n?(x.sum/x.n).toFixed(2):''}});
  if(kind==='faculty')return downloadBlob(toCsv(facultyRows),'siddhant_faculty_results.csv','text/csv');
  if(kind==='questions')return downloadBlob(toCsv(questionRows),'siddhant_question_analysis.csv','text/csv');
  if(kind==='feedback')return downloadBlob(toCsv(feedbackRows),'siddhant_raw_feedback.csv','text/csv');
  if(kind==='answers')return downloadBlob(toCsv(answerRows),'siddhant_raw_answers.csv','text/csv');
  if(kind==='comments')return downloadBlob(toCsv(commentRows),'siddhant_comments.csv','text/csv');
  if(kind==='ratings')return downloadBlob(toCsv(Object.entries(a.ratings).map(([Rating,Responses])=>({Rating,Responses}))), 'siddhant_rating_distribution.csv','text/csv');
  if(kind==='zipjson')return downloadBlob(JSON.stringify({generated_at:new Date().toISOString(),faculty:facultyRows,questions:questionRows,divisions:divisionRows,cycles:cycleRows,feedback:feedbackRows,answers:answerRows,students:b.students,faculty_master:b.faculty,questions_master:b.questions,assignments:b.assignments},null,2),'siddhant_feedback_full_export.json','application/json');
  if(kind==='xlsx'){
    const wb=XLSX.utils.book_new();
    const addSheet=(name,rows)=>{
      const safe=name.slice(0,31);
      const ws=XLSX.utils.json_to_sheet(rows||[],{skipHeader:false});
      ws['!cols']=(rows&&rows.length)?Object.keys(rows[0]).map(k=>({wch:Math.min(42,Math.max(12,String(k).length+4))})):[];
      XLSX.utils.book_append_sheet(wb,ws,safe); return safe;
    };
    const summaryRows=[
      {Metric:'Siddhant College of Engineering',Value:''},
      {Metric:'ASTRA Feedback Intelligence',Value:''},
      {Metric:'Report Type',Value:'Faculty Feedback Analysis Excel Report'},
      {Metric:'Generated On',Value:new Date().toLocaleString('en-IN')},
      {Metric:'Active Students',Value:a.activeStudents.length},
      {Metric:'Students Responded',Value:a.responseStudents.size},
      {Metric:'Participation %',Value:a.activeStudents.length?Math.round(a.responseStudents.size/a.activeStudents.length*100):0},
      {Metric:'Feedback Entries',Value:b.feedback.length},
      {Metric:'Total Ratings',Value:b.answers.filter(x=>x.rating!==null&&x.rating!==undefined).length},
      {Metric:'Overall Average Rating',Value:Number(a.overall.toFixed(2))},
      {Metric:'Overall Percentage',Value:Number((a.overall/5*100).toFixed(2))},
      {Metric:'Low Ratings (1-2)',Value:Object.entries(a.ratings).filter(([k])=>Number(k)<=2).reduce((s,[,v])=>s+v,0)},
      {Metric:'Comments',Value:a.comments.length}
    ];
    addSheet('Executive Summary',summaryRows);
    addSheet('Faculty Summary',facultyRows.map(x=>({...x,Overall_Percentage:x.Average_Rating?Number(x.Average_Rating)/5*100:0})));
    addSheet('Question Analysis',questionRows.map(x=>({...x,Percentage:x.Average?Number(x.Average)/5*100:0})));
    addSheet('Division Analysis',divisionRows.map(x=>({...x,Percentage:x.Average?Number(x.Average)/5*100:0})));
    addSheet('Cycle Analysis',cycleRows.map(x=>({...x,Percentage:x.Average?Number(x.Average)/5*100:0})));

    // Faculty-wise sheets follow the uploaded Excel report style: parameter table + percentage graph.
    const facultySheetNames=[];
    for(const f of b.faculty){
      const facAnswers=b.answers.filter(x=>{const fb=a.fbm.get(Number(x.feedback_id));return fb&&Number(fb.faculty_id)===Number(f.id)&&x.rating!==null&&x.rating!==undefined});
      const qRows=b.questions.filter(q=>q.year_level===f.year_level&&q.active!==false).sort((x,y)=>(x.position||0)-(y.position||0)).map((q,i)=>{
        const vals=facAnswers.filter(x=>Number(x.question_id)===Number(q.id)).map(x=>Number(x.rating)).filter(Number.isFinite);
        const avg=vals.length?vals.reduce((m,v)=>m+v,0)/vals.length:0;
        const d={1:0,2:0,3:0,4:0,5:0}; vals.forEach(v=>{if(d[v]!==undefined)d[v]++});
        return {Sr_No:i+1,Performance_Measure:q.question_text,Percentage:Number((avg/5*100).toFixed(2)),Marks_Average:Number(avg.toFixed(2)),Responses:vals.length,Rating_5:d[5],Rating_4:d[4],Rating_3:d[3],Rating_2:d[2],Rating_1:d[1]};
      });
      const overall=qRows.filter(x=>x.Responses).reduce((m,x)=>m+x.Marks_Average,0)/(qRows.filter(x=>x.Responses).length||1);
      const header=[
        {Field:'SIDDHANT COLLEGE OF ENGINEERING',Value:''},
        {Field:'ASTRA FEEDBACK INTELLIGENCE',Value:''},
        {Field:'Feedback Analysis',Value:''},
        {Field:'Faculty',Value:f.full_name},
        {Field:'Subject',Value:f.subject||''},
        {Field:'Faculty Code',Value:f.faculty_code||''},
        {Field:'Year / Division',Value:`${f.year_level||''} / ${f.division||''}`},
        {Field:'Overall Average',Value:Number(overall.toFixed(2))},
        {Field:'Overall Percentage',Value:Number((overall/5*100).toFixed(2))}
      ];
      const name=addSheet(`Faculty ${f.faculty_code||f.id}`,header);
      const ws=wb.Sheets[name];
      XLSX.utils.sheet_add_json(ws,qRows,{origin:'A11',skipHeader:false});
      ws['!cols']=[{wch:8},{wch:62},{wch:14},{wch:14},{wch:12},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10}];
      facultySheetNames.push({name,chartStart:12,chartEnd:11+qRows.length});
    }
    addSheet('Feedback Responses',feedbackRows);
    addSheet('Answer Details',answerRows);
    addSheet('Comments',commentRows);
    addSheet('Students',b.students);
    addSheet('Faculty Master',b.faculty);
    addSheet('Cycles',b.cycles);
    addSheet('Questions',b.questions);
    addSheet('Assignments',b.assignments);

    // Inject real Excel charts into the generated XLSX package.
    // JSZip is loaded in index.html. Supabase/backend is untouched.
    const addExcelCharts=async(workbook)=>{
      if(typeof JSZip==='undefined') throw new Error('Excel chart engine is not loaded. Please refresh the page and try again.');
      const zip=await JSZip.loadAsync(workbook);
      let chartNo=1, drawingNo=1;
      const content=await zip.file('[Content_Types].xml').async('string');
      let ct=content;
      const escXml=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
      const escFormulaSheet=v=>String(v??'').replace(/'/g,"''");
      const sheetNames=wb.SheetNames;
      const chartDefs=[];
      // Executive charts
      chartDefs.push({sheet:'Faculty Summary',catCol:'A',valCol:'M',start:2,end:1+facultyRows.length,title:'Faculty Feedback Percentage',yTitle:'Percentage'});
      chartDefs.push({sheet:'Question Analysis',catCol:'C',valCol:'K',start:2,end:1+questionRows.length,title:'Parameter-wise Feedback Percentage',yTitle:'Percentage'});
      // One chart per faculty sheet, matching the uploaded report style.
      facultySheetNames.forEach(x=>chartDefs.push({sheet:x.name,catCol:'B',valCol:'C',start:x.chartStart,end:x.chartEnd,title:'Student Feedback Analysis',yTitle:'Percentage'}));
      // Additional charts on division/cycle/rating sheets via compact chart sheets.
      const graphRows = [
        {Category:'Rating 5',Value:a.ratings[5]||0},{Category:'Rating 4',Value:a.ratings[4]||0},{Category:'Rating 3',Value:a.ratings[3]||0},{Category:'Rating 2',Value:a.ratings[2]||0},{Category:'Rating 1',Value:a.ratings[1]||0}
      ];
      const graphWs=XLSX.utils.json_to_sheet(graphRows);
      XLSX.utils.book_append_sheet(wb,graphWs,'Graphs');
      const graphIdx=wb.SheetNames.indexOf('Graphs');
      // Refresh the workbook XML in the JSZip package after adding Graphs.
      const base=await XLSX.write(wb,{bookType:'xlsx',type:'array'});
      const z2=await JSZip.loadAsync(base);
      const defs=[...chartDefs,{sheet:'Graphs',catCol:'A',valCol:'B',start:2,end:6,title:'Overall Rating Distribution',yTitle:'Responses'}];
      let ct2=await z2.file('[Content_Types].xml').async('string');
      let chartId=1,drawingId=1;
      for(const def of defs){
        const idx=wb.SheetNames.indexOf(def.sheet); if(idx<0) continue;
        const sheetFile=`xl/worksheets/sheet${idx+1}.xml`;
        const sheetEntry=z2.file(sheetFile); if(!sheetEntry) continue;
        let sheetXml=await sheetEntry.async('string');
        const relFile=`xl/worksheets/_rels/sheet${idx+1}.xml.rels`;
        let relXml=z2.file(relFile)?await z2.file(relFile).async('string'):'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
        const used=[...relXml.matchAll(/Id="rId(\d+)"/g)].map(m=>Number(m[1])).filter(Number.isFinite);
        const rid='rId'+((used.length?Math.max(...used):0)+1);
        const cid=chartId++, did=drawingId++;
        const sheetName=escFormulaSheet(def.sheet);
        const catRef=`'${sheetName}'!$${def.catCol}$${def.start}:$${def.catCol}$${def.end}`;
        const valRef=`'${sheetName}'!$${def.valCol}$${def.start}:$${def.valCol}$${def.end}`;
        const chartXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<chartSpace xmlns="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <chart>
    <title><tx><rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-IN"/><a:t>${escXml(def.title)}</a:t></a:r></a:p></rich></tx><layout/><overlay val="0"/></title>
    <plotArea><layout/>
      <barChart><barDir val="col"/><grouping val="clustered"/><varyColors val="0"/>
        <ser><idx val="0"/><order val="0"/><spPr><a:solidFill><a:srgbClr val="A71924"/></a:solidFill></spPr>
          <cat><strRef><f>${catRef}</f><strCache><ptCount val="0"/></strCache></strRef></cat>
          <val><numRef><f>${valRef}</f><numCache><formatCode>0.00</formatCode><ptCount val="0"/></numCache></numRef></val>
        </ser>
        <gapWidth val="80"/><axId val="10"/><axId val="20"/>
      </barChart>
      <catAx><axId val="10"/><scaling><orientation val="minMax"/></scaling><delete val="0"/><axPos val="b"/><majorTickMark val="none"/><minorTickMark val="none"/><tickLblPos val="nextTo"/><crossAx val="20"/><crosses val="autoZero"/><lblAlgn val="ctr"/><lblOffset val="100"/></catAx>
      <valAx><axId val="20"/><scaling><orientation val="minMax"/></scaling><delete val="0"/><axPos val="l"/><majorGridlines/><majorTickMark val="none"/><minorTickMark val="none"/><tickLblPos val="nextTo"/><crossAx val="10"/><crosses val="autoZero"/><crossBetween val="midCat"/></valAx>
    </plotArea>
    <plotVisOnly val="1"/><dispBlanksAs val="gap"/>
  </chart>
</chartSpace>`;
        const drawingXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:twoCellAnchor editAs="oneCell">
    <xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>14</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>20</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${did}" name="Chart ${cid}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
        z2.file(`xl/charts/chart${cid}.xml`,chartXml);
        z2.file(`xl/drawings/drawing${did}.xml`,drawingXml);
        z2.file(`xl/drawings/_rels/drawing${did}.xml.rels`,`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${cid}.xml" Id="rId1"/></Relationships>`);
        relXml=relXml.replace('</Relationships>',`<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${did}.xml" Id="${rid}"/></Relationships>`);
        z2.file(relFile,relXml);
        if(!/<drawing[^>]*r:id=/.test(sheetXml)) sheetXml=sheetXml.replace('</worksheet>',`<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rid}"/></worksheet>`);
        z2.file(sheetFile,sheetXml);
        ct2=ct2.replace('</Types>',`<Override PartName="/xl/charts/chart${cid}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/drawings/drawing${did}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
      }
      z2.file('[Content_Types].xml',ct2);
      return await z2.generateAsync({type:'uint8array'});
    };
    try{
      const raw=XLSX.write(wb,{bookType:'xlsx',type:'array'});
      const finalXlsx=await addExcelCharts(raw);
      downloadBlob(finalXlsx,'siddhant_feedback_analysis_with_graphs.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }catch(e){
      console.error(e);
      toast('Excel generation failed: '+(e?.message||e));
    }
    return;
  }
  if(kind==='pdf')return generateScoeFeedbackPdf(b,facultyRows,questionRows);
}

async function imageDataUrl(path){ return 'data:image/jpeg;base64,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kewe2qfzP7zzv/hUfwn/AOhL0T/wXW3/AMbo/wCFR/Cf/oS9E/8ABdbf/G69Eoo5I9g9tU/mf3nnf/Co/hP/ANCXon/gutv/AI3R/wAKj+E//Ql6J/4Lrb/43XolFHJHsHtqn8z+887/AOFR/Cf/AKEvRP8AwXW3/wAbo/4VH8J/+hL0T/wXW3/xuvRKKOSPYPbVP5n9553/AMKj+E//AEJeif8Agutv/jdH/Co/hP8A9CXon/gutv8A43XolFHJHsHtqn8z+887/wCFR/Cf/oS9E/8ABdbf/G6P+FR/Cf8A6EvRP/Bdbf8AxuvRKKOSPYPbVP5n9553/wAKj+E//Ql6J/4Lrb/43R/wqP4T/wDQl6J/4Lrb/wCN16JRRyR7B7ap/M/vPO/+FR/Cf/oS9E/8F1t/8bo/4VH8J/8AoS9E/wDBdbf/ABuvRKKOSPYPbVP5n9553/wqP4T/APQl6J/4Lrb/AON0f8Kj+E//AEJeif8Agutv/jdeiUUckewe2qfzP7zzv/hUfwn/AOhL0T/wXW3/AMbo/wCFR/Cf/oS9E/8ABdbf/G69Eoo5I9g9tU/mf3nnf/Co/hP/ANCXon/gutv/AI3R/wAKj+E//Ql6J/4Lrb/43XolFHJHsHtqn8z+887/AOFR/Cf/AKEvRP8AwXW3/wAbo/4VH8J/+hL0T/wXW3/xuvRKKOSPYPbVP5n9553/AMKj+E//AEJeif8Agutv/jdH/Co/hP8A9CXon/gutv8A43XolFHJHsHtqn8z+8//0P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0/38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACmsyr94gfWnVRaBZ3JmG5R2pMC6GDdDmlrMiPlz+XEuEFW5Lm2hG6WVEA7swH86Ex2ZYrO1DU7DSrdrrULhLeNBkl2Cj9SK8P+Kn7Qvgf4aafLLcXaXN0AdscZD5PvtOa/J34t/tI+OPildTW/2hrLSTnbEjHBHuDzXk4rMKOHWr1P0PIOD8dms04x5Yd3+h+hXxS/bS8D+C3l07w4v9rahHkbSCI8/wC+pIrj/g7+1/rvjvXTZ67ptpp9ox5c3BBHPYNivyeZAUEjfez171t+GtI1PVtVhjsIvOYMOAeT+VfLU86rVK1ktD94q+HeW4bBSjN+/b4n/kf0g2N/a6jbJdWkiyRuMgqcj9KvV4b8BXvE8C2drewNBJCqqVIPYe9e5V97CXNFSP5QxVBUasqSd7MKKKKs4gooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//1v38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKK5jxR4msvC+mS6leOqrGpOGOM4pPRXZrCEpyUYq7Z09FfAniH9ufwtpFzLZ29n5ssZI5D4OPevKdW/wCCguuoSul+HbeQHoWlda86pj6ENHI+7w/BmcV4qUKLt5tI/VGoZJoIhulkVAO7ED+dfjXrn7cXxR1aMrZ20emE9DFKxI/MV4rrX7Rnxq1ksl14nuvKfqgK4wfwrzqmdYeO2p9PhvDbNajXtLR+d/yP3V1Xx54P0SF5tQ1e1QJyR50e78t1eGat+1/8EdGuHtrrU5mdOuyEuPwINfiLqGpajrVwbrVbl7mVuSXNZzxKGKFd2RXkT4gf/LuJ97hfCimo3xFZt+St/mft9pX7ZXwS1rVbfRtPvrk3N0wRN1syrk9MnPFfUMFwl5ZLcWzAiVdyke9fzc+G9Rj8P61aatJALsW7htjZAOPpX1vrf7avjybSYdH8N2UelLCoUSRSNuwPY114bO4yi3W0Pns38NcTTqwjgPeT3ba0PYP2hPit8ePhxrkptJzb6XI5EbpJk47cYr4/1n9o34v60jR3HiC42N23DH8q5/xx8ZfiF8Q7eO28UarLdRRnOxsEfyry4Dn5uAOcCvnMXmUpVH7Kbsfr3D3CtDDYeKxdFOoutr/mXdR1PUtYumutUuGmmbksTk1VHyjP38etSKjysqW6b3k4Cjkn8K+hdH/Zc+K2t2NrqOn2CeRdIrjdJtIB9iK8qnQr4h3irn2+KzDA5akqs1BM8K0PSNQ8TavbaLpsZkublgiKBwCfWv1j+CP7IWn+DhZeJdWv3kvmVXaIou1W64zVj9nD9laL4fzr4l8Vqs+p/wAK8EJ3GCK+6wAowOgr7/LcrVFc9Van8w8ZcbTxdR4bAT9zq+5BbW8dtCsMYwFGKsUUV9Qfgzd9WFFFFAgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/1/38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAD0r4a/a+8ZajovhlrI6dFJHNlVlLkMpPoK+5a848e/Dbwr48tgniaxS/jh+ZY3BxkfQiuetBzpuMT28pxdLC4qFarHmSex/O9di6kk869jbMhyGcEdfTNMVQByd1fe/xu/Z/wDF+pX8+r2WlpYaRZqUt4YG3lgvT5cZFfP+g/s3fFfxB89npnlxnoZG2HH0Ir8xxGW11UfKrn9s5bxTltTDxqzmo+V1oeD7VzyMUcKcjmvqmT9jz4xqm82kTe3nD/Cuau/2W/jDak79NRsekmf6VzPL8Ut4M9BcUZVP4ay+9Hz3kj5mFKH/AIq97sv2YvjBfS+UNLVB7vj+Yr2jwj+wv4+1JxJ4gnWzgb+46uR+BrWnltecrKJz4ni/K8PHmnWXydz4bR+SM7fpzQWC/KOSec1+yehfsW/DrRfCl3YX8C6lqcqHZcyLh0OO2Divyl8eeCrjwt41uvC542zFFJwPlzgVeLyuph1GU3e5w5Lxlg80nUp0bpw116ryOa0/Rdf1NfN07Tri6RerRxO4/MA13fhv4R+O/EmpQWkelXFsJ2Cl2idcA9+RX7K/s3+BLHwh8ONPijjUvcosrHAPLCvoQRRL0QflX0dDIaDjGc3qfkmZeKGJp1Z0aFNWTaTufBnwg/Yu8L+GprbX/E87aldABxHIg2q3XqDX3ZaWdtY20dpaxiOKIBVUdABVuivq6NCnRjy01Y/CMyzbFZhV9ripuT/IKKKK6TwwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAIpYYphiRQwHrSrHGgwigCpKjd0jXdIwUDuTigd3sPwKNq+ledeJ/in4N8KQPNqF8shTqkJEj/98g5rwLV/2ltY1Wb7N8PNCN+W4DXSyQD88VzVcRSpK85HpUMDXrawjofYOFHJAFZ11rGk2I/0y9gt/wDrpIq/zIr4S1S7+PPiyVZrzxFJ4UTOSlpKjjHp84rLvvhZLe2/2nxr4vu9XUckzqgU/iMV4884orSCuevTyab/AIs7fifaHiT4m+CNA0m51C41m0cQqSVSeN2OPYNmvgy1+GXwz+K+paj401vxBbwTTSMYFeSIFRnIOCwNJH8OvgCH+z3dlZXErHku4BJ/76rsrX4DfBu6iWW18PWpU9Cu4j/0KvLr5pCdlOF0fUYHCvAqUqVRpvrY734RfGrwpoV03w71rV4mkszsglLrsKLwPmztFfWVpr2iX+PsWoW8+f8AnnKjfyJr4IvP2dPhDzMNEt4mHJbkfzNZVt8ONE06XyPB/il9DlHC/ZjGSP8AvomtaWcxirSjoedjMqp15OpSlq99Op+kIIIyDkU6vz/sofjn4UlE+n+LLjxJGvIiu3SNSPqort9N/aL8X6IwXx94fS2iXgvamS4J98AV7dPMaFTrY+eqZRXiuaOp9k0V5X4T+MHgnxdEr2N35DH+GcCJvyY5r06GaGZA8Lq6noVII/SvTjOMleLPEnTnB2krE1FFFUZBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB//R/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigApCQOtVru8trKB7i7kWKNBkliAP1r5H+Ivxs1nXrqXwp8NkPmklJbs5Tyx0JQ8qTWNWtClHmmztw2FqYiXLTR7X48+L3hTwNAVurj7TdnhYYR5rZ9wpyK+aNX8cfE/wCIj/6FI2hac3IMbfMye6uKwNL8NeF/CTf2/wCML1LzVZOXuJ2UOT3HUCul8S+LLS98G39/4ZuEklSJthjYEjj2r4rE5rUm+Wnoj7nC5TClKN1zPucfb6F8NtEvxJrt7De6k5+Z5WUNn8DXQfELxgvg7wk2r+G4o5EUZBQ8AY9s1+fmgeDB8QodY1S/1KU6zas7quATxXr3wy8Q3HiHwdqvgnWHLz2yOq7uvAxXgSU5vmkz7SeXcrSbulua3jP4r+JPEHw+tfEemSGKaOULLtbsBzXoI8TXHiz4NvePMTOkPJHJyBXzX4Dmhl0XxJ4KviAbcSSR7zjkcd67f4RajLP4J1vQz86wq4GOeg7U3bZI7KtCnGCSVrHzykOlNodzqlzqDpqcMrBBxnjp71+h/wCzrquqap4Kil1F3Zk4BbuMV8qfA74V+HPGWt38niC2+0CKVsK68cGv0X0TQdN8PadFp+jQLBDHhdo4wBWM0cua1qfs1ThueNftCeMZ/CfgySSybbcXWUBzjGRXw2NO8U6LoNv4xfU5I5Z3DAAjnPNfSH7XBum0uyhRT9nEgLkV4b4u1jT9T8O+HvDWlSCd/wB2WA7HHtWkbJanVl8UqEWuu59Ux/Ey60P4VReILtzJeeWMFjgk4rzTwd+07cavMljrmkO8cp2iUI7Dn3xivNfjFqNxD4V0jwfZZM7qmUHXJGK7b4IXXiBBbeGtf8NR/ZkwVmbfn0z0ApunHdOxn9Vpxoucld3Z9QSeA/DXiqzj1eyi+xXEgDCRVwwz7Gm6frvxR+HEga0nbXNPQ8rM+0qvsFFepW8UNlAsaBVRVGBnAFfPGrfHu2tvHSeDbO0WbcwV3TLYycc44q6OLqUpe4z5R0/btwceZH154B+NXhnxkBZyv9hv14aOUeWM+i7iM17QrK4DKcg9xXwZ4i8G+HvE7x3dlKun6qoDJOhHmK3bqa3fAvxc8V+Ar2Pwx8RN13aM22K9OXbHbdgAAYr7TC5rSqNQnoz5TGZRKCcqX3H2xRWbpeq2GsWiXunzLNFIMgqQf5VpV9EnfY+Uaa0YUUUUxBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf//S/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACsfWda07QbCTUdTmWGGIEkkgdPTNW72+ttOtZLy7cJFECxJ4wBXwz418Tav8YfEj6PYFotAsnw56CQqeRg9QfY1yYjEQow5pHo4PCuvO2y6sm8VeO/Evxb1R9J0JnsdBhYh5RlWlx1GGGMH2ro9M8Oad4f0aSz0jAlKn5x97dXmHxY8Tt8L/Bog0JPLkdfLTHG3jg186eAPEXxc0+9XxP4l1NZtFkAcqZlOAeemOtfnOJxFWvNtvQ/UMNgOWn+6Vor8Tzfx/f61qPj270Xx5eSrZqT5YPKkZ464ro/gh4v0LQ9cvfDNzdM9pclkjDYC88CvS/jT4f8PfFHw4PFXhqRbi6tRlwMZIHOO9eJ+H/AFn418ML/AMIxaC112zbBbBUkr7msUorc+tpShLD2ejNTWfP+E3xKk1UKTpWocsUGV2sfatj4bumv/FGa+8PrKLG55f5CF5PNfTvg74dSar4RtdP+J9jBcyW6gZZt3ygd+laY1L4d/DlTbeGbACY8Ktuhfn3wTWTcr+6eZPHaSjDd9TyLxl+zbqOpa9LrGgXzWi3PEgUqM569a9P+H3wu8OeAdIltdUvIhJcAhy7KM5655q3Gvxa8dHFtAmiWD9J45P32P9xhXSWPwIgnIbxPrE+tZ6rOq4/StvZt7nkVcc5LkqTKeij4d+C55ZdPuIQ0pLExlT1+hrfb4o+EAxAnP5f/AF627f4K/DyzUCPR4Cfx/wAat/8ACovAZGTpEGPTB/xq/q1+p5EsTTlO7dzzvxJefD3x/p7adq08QQ9C5A/ma4Hwt8BfhrpmqrqWnXcNxIh3KAVOPyNe83PwZ+HVyNsmjQH8D/jXJ33wF0lCX8NahLobjobdQf8A0LNU6LS3O6ljVFcqlY8n1X4HXeq+P7XxJJPm2t2BC8YwDX1FaWVpbRqoXCoMdPSvDZtL+L/geQvA6+IbBer3Em2THsqiul8P/FLStRf7JqUcljdjgrKhRc+xbGa4ZU5XHWqTqpJO6Mf41eP4fBXha5kjIE86lUwfmGRxxXyn8KtMXRdO1D4k+IwBJNuePf1OeR6V9GfE34Pn4lX9nqUeoFraJgzRgqVIFfOPxTh1i9vYPBmnwSW+l6egDnaQp28E88VcVFbKx9BgJU7KEHq9zkvD3xW8Qa38QJdUe6aHTbY7tucAgH3r7I8HePNF+LdncaXLamRISU3Mpwccda/NzR9Mv9W8Qf8ACLaOpxI+wuvYZx9K++I9X8Ofs++C4A0PnahIoJXH3mI9q1UYr3kdWY4eEGlFXkz03RfEHiX4Oamg+a60GVuU5Plg9SAPQV9o+GvEuleKdLi1PS5lljkAJAIyCexHavzr8AfHrSfiVM+ja3YLaSTjaqkNyD/vV22i6lrPwZ8Tpd2TtP4dvnxJF2jZjlmAFfR4DMZKXJU2Pz3MsplK8lG0vzP0CorH0TW7DX9Oh1LTpBJFMoYYPTPrWxX2ad9Ufnsk07MKKKKZIUUUUAFFFFABRRRQAUUV8WftU/tJR/CjSz4a8Ovu1y8XG8EgwowyHUjPOfWs5zjCPNI7sJhKuKrRo0VeTPpLxf8AE7wV4HtZLrX9Thi8oZMaupkx/u5zXzHrH7d/wbsXaKzkupnXjmBsfmDX44eKPF3iLxlqkur+I72S8uZP43OTj0rm1BzsA3MemOa+XqZtPmtCJ+2YbgWjCKeJnd/cfsUn7f8A8PfM/eW8oT1ETZ/nXaaL+3R8FtSljt7ie6hkkOP9QdoPuSa/Eo2dzCu+WFsHuQQKrEKX8v7uOSB0rFZrVXxI9SfBOXzh7kmn6n9Lfhn4geEPF9ulxoWpwXBkAIQSLvwfVQc12tfzN+EvG/inwNqI1XwvfyafcL1aI8lR2PWv26/Za+NWsfF7weLjXbRobu0JjaTDYk2YG4seMmvcweOWI0asz8xz7hitly9rGXND8T6qooor1j8/PDfif+0H8O/hDexWHjGaeKWYAr5URkGD06GvKj+3T8BgMm8vP/AY/wCNfKv/AAUH/wCRp0//AK5x/wAq/N5gMV89iswlRq+zSP2LJeE8PjcEsROTTZ/TD4I8baF4/wBDj8Q+Hnd7SX7pddh9eldjXzL+yb/ySLT/AMP/AEEV9NV70Jc0VI/KMVSVKvOmujsFeG/FD9oT4dfCG8isfGM88UswBXyojIOfoa9yr8jf+Cgo/wCKnsf+uaVhiarpU3NHq5PgYYzFxoTdkz6rb9uj4Drj/TLw5/6dj/jTf+G6vgLnH2y8/wDAY/41+GygUbQTtwPXIr5hZvN/ZP2J8C4OKvKbP3K/4bo+Aw/5fLz/AMBj/jWxpP7Z3wP1mYQWt/cIx/56Q7B+pr8IDjbtZfm7Go1BDZ6sOv0qlm9TrEVTgXCXShUep/SloXxQ8CeIYkk07WbU7+itMisfwzXeRyRzIJImDqehByK/mDstS1DTbiO706d7eWI7lKnkEV9ifBz9sv4geCb2K08WTtrGm8KxlYlo09VCjkiu+hmtOb5Zqx8zmXBFehBzw0+by2P29orzz4d/Enwz8S9Ch1zw7ciVJACyHAZT7rnNeh176aauj8pqU5U5OE1ZoKKKD0pmR88fEf8Aab+F3wt10eHfFdxcRXjIHAjhLjB98ivPz+3R8Bx/y+Xh/wC3Y/418F/t1jPxfjz/AM+y/wA6+KthOQgGK+ZxOZypTcUtj9qyrg6hi8LCvKbuz9yP+G6fgN/z+Xn/AIDH/Gnf8N0fAcdbu8/8Bj/jX4anCjJGTTQS3QkD3rm/tat/Key+B8Bfl9o7+p+9uh/tg/BTX5RDZ6hNGx4/exbB+pr3DRfiF4M19EbTdYtZGfovnJu59s5r+aXGB8gGfrWvpHiLWdCvI73R7ySzu4zlZIz0I96qOcu/vxOKvwFS5X7Grr5n9OysrAMpyD3FOr8bvgj+2v4u8O3MOkeP5TqlmWCtcSMWkRfYDAr9avCnizRPGOi2+uaFcLcW1woYEEZGexA6H2r6KhiadZXgz8szPJsVl8rVo6PZ9Dp6KKK6z5wYzhVLHoBmvlHXP2zPgp4e1i80PUbq7W6sZGjkAtyRuU4ODnmvqyf/AFMn+6f5V/OB8Y8H4m+Jf+v2b/0KvLx2Klh4qUVufc8M5NSzOtKnUk0kr6H7J6F+2Z8FfEOr2uiabd3bXN44SMNbkAk9MnNfVcEyXEKTx/dcZH0r+b74PD/i5nh7j/l7j/nX9G2kf8gy2/3BTwWKdeLbQuI8mpZbVjTptu/c0aKKK9M+HCvnLx/+1H8Kvhprp8O+J7m4jvAu7EcJcY+ua+jD0r8Kv21efjFL/wBcB/OuDGYh0KfOj6vIMsp4/E+xqOyt0P0QH7c3wIJAF5eHJx/x7H/GvrDRNYs/EGkWet6cS1tfRLLGWGDtYZGRX8xVuAJk/wB4V/SN8JTn4ZeGP+vCD/0EVy4HGyxDkpLY9zibIKOWRg6cm+a+56LRRRXsn5wFFFRu6xoXc4AGSaAPEfif+0H8OPhFeRWHjG6ljuJgCqRR+YcHoSAeK8qP7c/wHD7DeXmcZ/49j/jX5kftVePB49+LOoXafdsM2v8A36JFfN2FGA4+bqSP7tfLV81lCo4RR+35bwTRxGHhUqyak1sfu7oP7Z3wT8Sa3Z6Bp13dfab2QRx77cqm49MtnivqyGWOeJJojuRwCCO4NfzAWV5Npd9Ff2LmKSFg6MOoIr+iL4E+MbXxp8NNH1K3l854oI4ZW/6aKo3Zr0cDjXiG1JWsfLcTcOwyzklTbae9z2OiiivYPzkKKKKAPmzx7+1V8J/hxrzeG/E1zcpeKoYiOAuuD75riW/bq+Ay5zd3nH/Tsf8AGvzl/bKx/wALiuf+uK/zNfKJKg7iMivlq2aThKUbbH7hl/B2FxGGhVnNptX/AK0P6N/hf8aPAvxesJL/AMHXTSrExVklXy5BjjO3JOPevWq/nx/Zw+LV38KPH9rqCts069ZYrkZ6R5yTjvX776JrFnr+lWurafIJILqNZFI9GGRXs4PFLEQ5up+f8QZHPLK/JvB7M16KKK9A+PPAPiZ+0l8M/hNri+H/ABfcXEV20aygRQmQbW6cg15x/wANzfAjIH2u85/6dj/jXxJ/wUAx/wALfg/68oP5GvhVCPMHHFfN4jMpUqrppH7Fk/CeGxmCjiakmm0f05aDrVj4j0i11vTSWtryNZIywwdrDIyK2a8y+Dn/ACTPw7/15Qf+gCvTa+ii7pM/Ja0VCpKC6M8C+Jv7R/w0+E2tLoPi+eeO7aNZQIoTINrdOQa82/4bn+A//P5ef+Ax/wAa+Jv+CgLAfFu3Azn7FD0Hsa+DgB1NfN4rMK1Ko4QifreS8KYXG4WFapNpvfU/cn/hun4Df8/d5/4DH/Gm/wDDdPwG/wCfy84/6dj/AI1+HDbewpVVAQ2ODxXHLNqsUm4rU+jXAmDcmlN/efuMf26vgN/z93v/AICt/jSf8N1/AX/n6vf/AAGb/Gvw4I+YkH5B2o461Szar/KT/qLgk7Ob+/8A4B+4/wDw3X8Bf+fy9/8AAVv8a9C+HH7Tvwt+KestoXhO4uZLpF3ESwlBgnHUmv59sqK+1P2GWH/C05gf+eK/+hV14bMKtWooyjY8TNeEsJhMLOtCbbR+3tFFFfSn4sFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/9P9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAppIAJPQU6vGfjR4/HgnwtL9jbOo3mYrdR13np9KiUlGLkzWlTlUmoR3Z5H8ZvH914j1hfh/4alJDH/SXQ8BOhGeRU/hnRbLQNOTT4dodRzjqT615p4asE8G+HLrxbru3+0LpTPIzHncwyRmvnfwF8aLjxD8TbhdR1RrWxBKpGWAQ8+9fnGOryxFTfRH6rhMvcaTjTW259VfFTwJF458Oy2BGJkUlT71+eLPqXha8l8GeM3kg00sVVgNwx09hX6qWt3a3cKywyiVX+6QQRXB+M/hZ4U8bL5es2STP/eYcivJ9ryaHfgscqD9nU2Pz/wDg7Z63H4xn0vwq7XWiSud4bhdpPtnmvum00Pwf8O7aXVlhSGeXLMAPmJPoKrWXh3wZ8IdHkbSbdIWxkBRy5+lUvC3hTU/Hl+PEnijP2UNuigboV6jIPNaqk56jxWKUpOUPh/MrRSeMfiJcGPT1bT9LY8yAlWK/Rq9d8K/DLQfDm24WIXFx3lcfMTXoFjp9rY26Q2yBUAwqgcCtERHvXpQpqKPl6mKcnyx0RCsIxuQbcVKsYPUkfSpl5O00/aScDgVulc82UtSv5YB4UfWjyQDnHWpsbTnOR70hmhHUjJ9atqwO61RH5WOdopmwjhRn2PSpt8fVpAPoRUny4znPpQ4ofO7aootGhHIwf5VwfibwFoXiWNhfW6yTn7sxHzL9K9HMR27jio2jymR1rN00y4VVB6M+UrzS/F3w6uPNtXe/0xTkg/eA9gorfkfw/wDETRp4rfEF1MhRgRhgfoa+gJ4IrmIxXCZB9q+fPGvw/u9BvG8T+Ev3br80sa8Bx1PvXJUpdj26OJvJX0Z863/gS1+BdhdeKAgvLqV2KFux6jkV5d8VPFVx4vsdG1i82BmdMqGyRx6V9jzwaR8WvC02jan+4nUFSCOVbpkA14Dpf7Luoxa2lzreqF9MtX3IrFcbR0yO3FcLuj6yhiYKTnW1kjV8DfCueS+sPGOdsEUaNgYzxz0r3PSvHPhTxrLd+F5CBLFlNrDBJBx3NecfET4y+HPh1ov/AAjegBbq9VNiKgyM4wOVNfJfhrT/AIo23iBPiFHZMkVxLkoN2cdemM03e10TKhPFXqTfL2P0b+GHiy8+HXiT/hE9Xctp14/7hyfusx6emAK+145Y5o1ljO5WGQR6V8F3+mz+MvCMN75Qg1OOMOrdHV8e9e7fAr4g/wDCSaK2h6k+NR00mJg3VgnGefWvt8qxXPD2c3qfm2b4Nfxqa9T6Dooor6Q+PCiiigAooooAKKKKAK93cJaW0lzJwsYya/nT+N3irUPFXxM1u/1KZpzFcSwJu6CNGOAK/od123e60e7t4/vSRkCv5t/iHCYfHOuROSHW+nUr24c8183nHM6cUnbU/YeAow+sVJtXaWhH4H8KXvjXxdpnhOzGxtSmWIMv8O7v7V+1fw7/AGP/AIT+F9Ht4te0mHV70KC8ky8hsc4wa/Iv4B+JrPwj8VNC1O/I+zrcp5sjfwqD1r+hXRtZ03XrCHUdLuEuYJVDBkYN1HtU5XRhyOT1Z18b47G068acW4wa6dTy+f8AZ7+DVzEIJ/Cto6DsVP8AjXivxE/Yp+FniewdfDVomg3AyVNug+Y+h3GvtGivflQpzVpRR+UUMyxVGfPTqNP1Pwdk/ZN8f2PxNtvA9xbMLSaRd90nzL5DE4Ocbc+1ftL8OfAejfDnwrZ+G9GgWGOFF3lRje+ACx9zXdbEzuwM+tPrKhhadG/IenmufYnMIxjWekf6uFFFFdh8ufkd/wAFBv8AkadP/wCucf8AI1+b56V+kH/BQb/kadP/AOucf8jX5vnpXwuY/wC8H9TcKf8AIqifvx+yb/ySPT/w/wDQRX0zXzN+yb/ySPT/AMP/AEEV9M19pR/hxP5uzL/eqnqwr8jv+Cgv/IzWP/XNK/XGvyO/4KC/8jNY/wDXNK48f/u8j6LhX/kZQPzeHX8q/Yr9nD9nz4TeLPhva6v4g8PW13dSkbncEk5H1r8eE+8Pwr99P2Tf+STWP4fyr5zKIRlKXMrn6rxtiKtLCw9lJq76Gg37KfwLZdv/AAitoP8AgJ/xriPE/wCxZ8ItdtXh02zXSJWGBJCgLD8zX2FRX1ksPSas4o/DaebY2m7xqv7z8R/jZ+xt4q+G1tJrHhyZ9X01ASzNjzVA9EWvip1aN2t5QYpE68YP0Ir+oO7tIL22ktbpBJFICrKehBr8L/2vfhND8OPiDLd6XERp+o/vM4wBI5yRXy+Y5dGC9pT0P2ThbiiviJ/VcS7y6PuYP7NPxo1P4W+M7SFpidKvXWOZSeFBPLfWv3n0rU7XWNNt9Usm3wXKB0PqD0r+YNdyBfVTuz6V+7f7Hfju58bfCi3a8OZNOf7MvOflQcV2ZViHJOmzzeOMqhT5MZTVr6M+sqD0ooPSvpT8TPxD/bsP/F4I/wDr2X+dfGMJVp0AXchIDA19nft1jPxgj/69l/nXxpAP36H/AGh/OvzzG/x36n9X8O8/9lw5ex+33ws/Zq+Des+AND1TU/DltcXFzaxyO7Kckkc967yT9lL4FyAj/hFbQZ/2T/jXf/Bn/kl/hv8A68ov5V6dX3UKNPkXuo/m/FZhilXk/aPd9T4s8XfsP/CnxBbtFpMf9jOejQRgn/x41+d3xw/ZV8ZfCLfqdkG1LRugl4Lj3ZVHAr95Kxte0TT/ABFpNzo+pwrPbXKFHRhkEGuatgaNRbWZ6+X8T47DVFKU3KPVM/mH2AY2Da3f2r7d/Y++Ouo+B/FUHhLUrppdK1FxGiOflSRuN3tXiv7Q3w0b4Y/EW90VBst52aaJR0VCeAK8a067udOvob6zco8LBlI9Qa+MpSlhq9kfv+JoUc4wOi+JaH9P0Usc8SzRMGRxkEcgipa8X+Afi6Lxj8M9Hv0fzJIYUjkPX5wOa9or9DjLmSaP5Sr0nSqSpS3TsQzf6iT/AHT/ACr+b/4wn/i5/iUf9P03/oVf0gTf6iT/AHT/ACr+b/4vjPxO8TdiL2b/ANCr5/N/4cfU/V+AVfF1PT9Rfg/x8TPD2ev2uP8AnX9Gmkf8gy2/3BX85fwfIPxM8PAjLfao+fxr+jTSP+QZbf7goyn4JGnHy/f0/Q0aKKK+iPxwQ9K/Cv8AbU/5LHKP+mC/zr91D0r8LP21CB8YpNw6wLg/jXiZpb2J+m8E/wDIw+R8jxZ85Af7w/nX9I/wkGPhn4Z/68IP/Qa/m6hH71C3JLAV/SJ8JBj4ZeGf+vCD/wBBFcGUfFM+o8QVaNF+p6NRRRX1R+FBXj3x18YJ4K+GWt6usoiuFt38kk4y4HGK9hr8yP8AgoF8QUh07T/A1q+Jg4nlA7xsuK5cRVVOm5Hu5PhPrWNp0ujevoflnqd/NqmpXWp3R3SXkjSOfdjk16V4V+EHi3xb4R1TxrpSB9P0pHeQlsZCdRjvXlWM/IOQR8v1r9zP2b/hHb6T8Bm8OagN66/GZmyB92ZQcV8Vg8M8RUbkf0Vn+bf2VRh7LdtL5dT8MSAxII5XqPev1V/4J8/EGOTTdR+HszfPAXuwT6OcYFfnB8RdBk8L+NtZ0hojEkF1KsYIx8oYgGvSf2avHN14H+K+jyxSeXb300cNwxOB5ZOTmtcJP2GI5WGfYeOPytzWrtdH9CNFVrW5hvLaK7gbdHKoZSO4PSrNfdH8stWCiiigR+Dn7ZHPxhuT/wBMV/ma+WoIMrjqvWvqX9sk/wDF47kf9Mk/ma+dNDs5tTu4NPtQDNdOI1DHAyfevzrGx/eyiurP67yacI5dTnLZJGDJ8v3vvMcDHpX6vfsPfHOTVLJ/hz4juQ09v88DyNyVJwqDPoK/PH4l/CzxJ8OL21ttdgCi6hSZXU7kIcZA3dM+1cj4S8Uaj4N8R2XibSTtubCRZFGcA7a0w1SeFrKMjizbBUs5wDlB3f2X5o/pqoryH4LfEzTPij4Hsdfspd82xUnXuJQBu/WvXq+/TTV0fyxVpSpTdOas0fi9/wAFABn4vwf9eUH8jXwqi/OK+7P2/wD/AJK9B/15QfyNfCiN8/FfB5g/9oZ/UPDEYrKYt9j+jz4N/wDJNPDv/XlB/wCgCvTq8x+Df/JNPDv/AF5Qf+gCvTq+8h8KP5jxX8aXqzynxp8Fvhx8QdSXWPFmiwahdooQSSAk7V6DrXHH9lf4GHr4VtP++T/jX0PRUOnBu7RdPGV6ceWE2l6nzt/wyr8DP+hVtP8Avk/41+GvxN0qy0Xx7rel6dEIbS2vJkRF6KqsQAK/pTr+b74xjHxN8Rn/AKfp/wD0M187m0IxpxaXU/WuBcTWq4qoqk21bqzD+Hmm2Or+OdH0y9Xfb3VyqOpHBBr9wdI/ZZ+B02l2ss/he0kkeNSzFTkkjr1r8TfhN/yUnw9/1+JX9HOif8gaz/65L/KllNOLjJyRtxxi61KtBUptaPZnhH/DKXwJ/wChTs/++T/jXXeDvgZ8MPAWonVfCuhW+n3TDBeNSDj869eor6NU4LVI/IJ43ETjyzm2vUKKKK1PPCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/1P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAIZ5UgheaQ4VASTXwpr1/L8RviTJcyktp2lkqq9R5iHqK+lPjL4n/4RzwfcmJttxcqY4/8AeNfMuhyL4P8ABs/iK6TMpQzyDuSRzXzOb4nkh7NdT67J8PzNz69DK+IeteDNcZ/BmpX4t5JFx2HXjua8b179mHw3faQlz4VuR9sjG5XTbyfqDXzt8Q/ij4L8aatNeTWj2N2GK+bFGS+PxNY3hj45eMPBF2i6dPcX2njgCYFePoBXxajpzXP1mjgK9OClB2Z7h4I8afFH4b67F4Y1+GS9tQ4RHO5to6DoMV90zeI47XQhq2oMYyybsH/PWvLPhV4wsvijoa61qGniGaJuSVI5HuaXxHLL4w8RW/hiw5tYSDLjpgHms1FTdmfO4twlUtONrbh4a0TUviRr/wDburZGnWzfuY26MR0ODX07aWcdvGkKIERRgY7VQ0XSLbSNPhs7UALGAv5VvqpHFevCNlZHy9fEKc7QeiEVCoJPboe9SorZye9OVSTUkqyrC7RDcwHAPHNdSgzz3PWxXubi1sojPcyLGo5JYgD9a+dfiF+0n4H8FLJEk4uZl4wnzc/ga80+Nfh39ovxdLLY+HIre0085AK3GGYe4IrwHwF+yV4vvNW/tX4lzJFawnc+HDA465ziraa2R9Jg8Jh3F1K8/kdje/tRfEXxZOYPBOil0Y8MwkUfyNMOrftO6rGbgReQDyAJDx/47U3jv45+BvhCh8NeAbCG5uYRtaQggAjjIIOK+e2/a0+Jn2n7Ul48aZ4iDHbj8qifKt2fS0sFOrDmpUk15nquo+M/2lfDObq8hkuFXtuY/wAhTNE/a++IGnXiWevaW+/O3bhyf5V1Xw+/bKtdTmi0nx7ZII5MDzF3Oea+xdI+H3wp8diDxNY2cFyzYdWABYd+cGtFBSV4s5sTVhhouGIoWZe+F/j698daWl/dWTW+4Zw6sv8AOvVnUfwCn2Ok2WnWwtrGIIijAGMAVP5e0YNV7NpHwE61OUnKGhnujEYqrLCJFaNxlcZPuPStN19agddp3Mc8Vg1YcJto+ZPHfhe68K6mvivQF/ck/vYxwD3Oa2L2V/G3hSWPR5vKmljw2DgqxHSvbb2ygv7WS0uk3RSA9vWvmKKC5+HPi97CVidPv2+Q9lZj0ryq1Pqe9hqrel9UeXeF/gLo3h6/l8ReOLlLgoxdfNKnHOc9qh8e/tA6No8Y8P8Agu2+23CfKgVTwegxtzXpnxg+HXiTx/FbxaHem3t2A34YAEEe9c54U+Efw7+F9oNT8QTQS3qDc0khXfn25rmg7H1VKtGceapK76IPgxr3je/ma88WyCFJ+UR3wQD0ABxXfag03w88e2Xi7TSVsrxliuMdMfeJNfIvxZ+OOi3mu2qeDpZQtk4LkLhTt46819a6Jew/EX4bIxYPI0Xrk7iBW9Co6dRTRx4zCy9nzSVlI+9dL1CDU9Pg1C3bdHOgcH2IzWjXzt+z54obU/D0mi3T/v8AT3aIA9dicCvomv1ClNTgprqfjtek6VRwfQKKKK1OYKKKKACiiigBCARg1+H/AO2D8F7/AMCeOrjxLptuZNK1M+YzgfdlfLN0r9wa47xr4H8PePtEl0LxFapcwSAgbhnaT3FcWKw6r0+Vn02SZtLL8SqtrxejXkfzQbyPlTg/zr23wJ+0H8Ufh+kVto2sTCzjOfs+/CH9K+p/iz+wh4k0u7n1D4eSreWbZdhKyxsgP8Kgdcdq+K9b+Fvjvw7dPbaho12THwXWF2Xj3xivi3hsThpXjsf0LSzLLc1hy1JJrsz7Y8P/APBQjxdamK21XQ7aZRgNIXctX0r4U/bp+FureVb6151pcyEAhYiUB+pNfixNb3FrKYp42icdnBUj8DUW89BwR+prohmleO+p51fhHK68G4LlfdM/pg8MeOvCvi+3S40HUYbneobYsilwD6qCSK6+v5qfA/xF8W/D3V4tW8K38lrIpBkCnAdR/Cfav23/AGbfj3Z/GPw2Fu8RataDEseeSF43c88mvo8Hjo19NmfkWecMV8vXtYvmh3Pp+iiivWPgj8jv+Cg3/I06f/1zj/ka/N89K/SD/goN/wAjTp//AFzj/ka/N89K+FzH/eD+puFP+RVE/fj9k3/kken/AIf+givpmvmb9k3/AJJHp/4f+givpmvtKP8ADifzdmX+9VPVhX5Hf8FBf+Rmsf8ArmlfrjX5I/8ABQT/AJGWx/65p/KuPH/7vI+i4V/5GUD82x1/Kv34/ZN/5JJYfh/KvwIXk/lX77/sm/8AJJLD8P5V4OS/FI/TOPP92p+p9NUUUV9gfz4Ffnj/AMFBtLWTwHpV/EgMgugGP+ziv0Or4a/bvkgj+GFqJurT4X64rixn8GXofSZBJxzGi13PxU3fwjoetfqz/wAE+9bc2Go6Bu+VC0uK/KZeB7jmv0p/4J8rL/wk2qMfuGA/nmvjcrbjXt3P3/i2ClldSUulj9Z6D0ooPSvvz+XD8RP26/8AksEf/Xsv86+Mrcnzk/3h/Ovsz9uz/kr8f/Xsv86+NLf/AF8f+8P51+eY7XENeZ/WPDr/AOEyGvQ/o4+DP/JMPDX/AF5Q/wDoNen15f8ABn/kl/hv/ryi/wDQa9Qr9Ap/Aj+WsV/Hn6v8woooqzjPyk/4KCeFrWO+07xVj97IVhJx2r8zCedsfAr9bP8AgoO0f/CK6Up+99oH8q/JE5BIHQivg80ilXuj+n+Dpt5bFPzP2m/YJ1B7j4U3FvIxYx3TYz6Yr7qr8/f2AA3/AArq7Pb7Q38q/QKvscK70Ytn4Jn0FHMKqXchm/1En+6f5V/N98YOPiX4lLd76Yf+PV/SDN/qJP8AdP8AKv5wPi/kfFDxKjDCm9m/9CryM3/hx9T7zgD/AHqovI4nRtVu9C1S31fTW2XFowdT05HvX09bftl/F23hjt0vGAjAA+c9vwr5Z07TrrVb6HTbJPMmnYKg9Sa92g/Zh+LU8STxaYCjjIyT0/KvnMK68b+zufrGaUsBVnBYu2nc7n/htD4vAf8AH63/AH2f8KT/AIbQ+Lp/5fW/77P+Fcb/AMMufF3/AKBg/M/4Uf8ADLnxd/6Bg/M/4V08+NtfU8V4TIua9o/ejsD+2h8Xhx9tb/vs/wCFfPPjfxxrvxC1o6/4ilMtww25JzxXqh/Zc+LxH/IMHHuf8K8b8UeE9b8G6m2ka7D5FyozisMVKvKC9pc9TL6OW0q7eE5bvsYUGPNCqOQQa/pE+Eef+FZeGM9fsEH/AKDX83kORJGE53MM1/SL8JBj4Z+GR/04Qf8AoNexk+8z4PxB0jRXqeiUUUV9WfhJBPNHbwvNKwVEBJJ6Cv59P2lfHdz49+KOq30pylk7Ww5yCsbECv2b/aL8aw+CvhZrN353k3VxA8duc4Jkxxiv577u7n1K6mvLqQm4mcu2ehJ5PNfMZxVagoRP2bgXAp1JYma20R3/AMI/C/8AwmXxF0HQXiMkFzcxrJgZAU+tf0YaFpUOiaLZaPAMR2cSRKPZRivyU/YH8DTap4xv/FF9bg2lvDtifr+9Vq/YOu3LKfJR5nuzxOM8d7fGeyi9I/mz8Xv28PAdxofxDg8T2cQj0+9hSMkdDLyWNfC9vcTWkyT2zFJIzkMO1fuD+2p4Cfxf8K5NRgGH0UvdMe5ULjFfhvndkDgAc18/mVNwxHMfp/CGLjicuVOb1joz+hn9nTxzaeO/hdpV/bPva0jS2kJ6741ANe71+Vf/AAT8+ILpc6l8Pp2CwxobpCT1Z2xiv1Ur7DDVPaUoyPwfO8F9Vxs6PS+noFFFFdR86fg1+2R/yWO5/wCuK/zNeC+A/wDkbNJBPzfaFyvbFe9/tkj/AIvHc/8AXFP5mvAfAhB8X6T6+etfn2Id8R8z+sMrssoiv7v6H7PfHP4OwfFP4MWT2qY1PTbVZoNo5dggAUn0r8P9QsLnS76fTr9THNbOyMO4ZTg1/S94PA/4RbSh/wBO0f8A6CK/Jf8AbW+Bg8Ka8PHegWuzTtQbEoQdJSCzM2OgPrXvZlhOeCqR3R+acI5z7HESwVWXuybt6nBfsgfGuf4deNotC1OcrpOqsIgjHEaOxyX9jX7hWtzDeW8d1bsHilUMrDkEHpX8vcbvDIJk6ryPY+or9rf2OPjjF4+8Jp4W1eXGqaau1QTwYVwq8nv7VnlWKc06cjTjTJuVrHUlv8X+Z8e/8FACf+FwQD/pyg/ka+Fk6ivuj/goBx8YIP8AasoB9OD0r4XQfOBnIrxcwX+0tn3vC9v7Ki/I/o9+Df8AyTTw7/15Qf8AoAr06vMfg3/yTTw7/wBeUH/oAr06vv4fCj+ZsV/Gn6sKKKKo4gr+cL4y/wDJS/EP/X9P/wChmv6Pa/nB+Mwx8TPEX/X9P/6Ga+bzlfuo+p+v8Au2Lqf4f1M74Tf8lK8O/wDX5HX9HWif8gaz/wCuS/yr+cj4Tf8AJTPDv/X2lf0caL/yCLP/AK5L/KnlHwSL48Vq1P0ZqUUUV9GfjoUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH//V/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooqKVwkTOeAATQB8c/HPVD4g8a6Z4RiJ22zLcNjpjPer2oP4dSyGk6zJEI3XaUkYAFfxrgNHvW8VfErWdcl5W0d7Yf8AATXz1+0r4S+IV3fR6zom42cQGRGSWwPYCvzjMqntarR+q5dh4qnCk5Wvrc6Lx1+z/wDD3XfMv/DV5b2d1knCMgH5k14jpPgXxD4a1630rUtOtdbtppAoZn3YHr8teQnVhFZlTrl9aaiODEyBVz9TzX1p8BfA/jO4ng17V9QF1ZsoKguGIP0rzHpGx9vN1KFO8p3R9KtHpvgzwdjT7ZLEFOY4+m7FWPhN4fMcEuv3A/e3RLc9dp5rmfiJcvqWpab4at+C0qmQD+6a+h9B06PTtPgtk6RIFH4V0UIXZ8FiK3LFvqzXRVUDb0NWo1qJRniriRjFepGOp83OVnZDkXHWrYXc4IOSO3amqg9qmAHZjXoQirHJNp7jSiMTuUZ/lXiPxu8P+MNd8Lz2XhJhGXUhm3bWPHTFe7KiN93NT+ShG0nP1rflizSlX9nNST2P54fHXwy8aeF7+Z9cspZHdiS4UsOe+cV5l5ciN5ZQ7xxjv+Vf0jeIfBHh7xNAbXVbOOZG9RmvDZP2TfhWb83x02Lfu3fd5/nXJLB87P1PBcY0Yw5akbNH5V/Br4C+JPibqkbmFobEEbnYYOPbIr9lPhl8M9M+HGgxadYMWKqAxIwc11Oj+H/DHgPS/LsYYrK2jHzH7vA+tfLnxT/a+8HeDZZdP0ci+ukJXGCVz9Qa2VKNDc+YxmNxWbVWqcdD7Dd1VflbOfWs6W8tIh+9kVfqcV+P3ib9tLx7rDuNPT7EP4fLZsfrXk19+0X8UdQfdPq02D/tf/WrCWIid+H4TxE1eWh+5h1TS3IUXUeScAbx1qZtjJtHOeQa/DLwZ8XfHWoeLtMtLzU5mjknX+L1r9TPEPxhsPAOm6T/AGv8wulQFyPUVzKXMcGNyephZKN7nvbghdrCvJfij4fTVdEaeFMy22ZFPfIFegaB4j0zxNp0WpabKJY5VB4PrV29tFu4HjbuK5px5jyKTlCd5HhXhXVLrVvDUtojlbqJCgwecivlHVPgZ8RPHXiOc+JNSkGnhyR8wPy56Yx6V9HaA7eH/GN1pbcLMxYfia5b4/fErWvB1hBZaAuLu5barZI6j1rxZLlk0fX4V1PapU1qyCx+AHwx0LRXsr9YDKy4MrlQ2fzruPh3ZeEPDat4f0S9Sc9dgK8A/Q18WDwl8WPGMcd/r2vpY20h3HdOq8H/AHsV6P8AC/w94Q8EeKo5rrxM+o30+E2oyOuc5xlTWk01C56eJoz9nJVZtyR9P+BL4eE/iq9svyQ6gAoHQbmYmvuZW3KG9a+A/G+3TdZ0XxDF0WdTuHoB3r7m0K7F/o9pdg582NW/MV95lNXno8r6H5ZnFFRnGoupr0UUV758uFFFFABRRRQAUUV8N/tD/tbWPwr1yz0Dw6keo3aOGuRklVjI6Ar/ABZ7VjUqQprmm7HoYTB1sVU9nRjdn3JWfe6Zp+oxG3vYFljbqGHFeefCz4p+Hfij4bt9a0edTKyDzYsgMrY54znGa9TrRNSV1sc1SE6U3CSs0eE+Iv2cPg94jEkt54btRcSZzKFO7Pr1r4K+PX7Eo8NaNd+K/Ac7XUVsGlmgcKu2MdkA5J9q/WusfXjaDRrs320W4jO/d0x71yVsLSqRd4nv5fneMwlSLpzbV9nqj+ZB4jBJJFJuR48gqRjBFfSP7KHjjUPCPxc0m1s3Ji1eWO2lJOPlJyRXjHxCa1bxzr32I5h+2TbR2I3npXTfAtGk+L/hRE4zfR4+vNfC4ZOniLRfU/pXNJRxOWTc1uv0P6NVYMoYdDTqrWoYW0QfqFGas1+jn8itan5Hf8FBv+Rp0/8A65x/yNfm+elfpB/wUG/5GnT/APrnH/I1+b56V8LmP+8H9S8Kf8iqJ+/H7Jv/ACSPT/w/9BFfTNfM37Jv/JI9P/D/ANBFfTNfaUf4cT+bsy/3qp6sK/JH/goEM+JrH/rmlfrdX5Jf8FAv+Rmsf+uafyrjx/8Au8j6HhX/AJGUD83VHzD8K/fX9k3/AJJJYfh/KvwLWv3z/ZNIPwksMe38q8HJvikfpnHn+7U/U+m6KKK+wP59Cvzh/wCCg+uWp8JaVoYkAnW4EhXPO3HpX6BeINf0rw1pk2q6vcLbwQqWJYgdPTNfgt+0z8WJPip8Qri+twBY2mYYiCcNtPBryMwqqFFx6s++4TwE8Rj4Vbe7HVnzqeRuFfrR/wAE/dBK6Bf+ICPvu0Wa/Jy2hkuZ1t4wSzYwo5JJr99/2WvAX/CB/CqwtmBV78LcsCMEFx0r5/KaTdZy7H6lxtjI08Cqaesn+R9J0HpRQelfbn83n4h/t2D/AIu/H72y/wA6+Mrf/Xx/7w/nX2b+3Xz8YI/+vZf518ZQkLcRE8ruGa/PcZpXfqf1fkEf+EuDfY/o6+DP/JMPDeP+fKL+Ven15h8Gv+SYeG8dPsUWP++a9Pr7+HwI/lzFfxperCiiuK8deNtD8B+HrvXtbuEhjt0ZgCQGYgdAD1NW2krswhCU5KEVds/Mf/goB4tSfXrHwqp3eUqzHFfm6ASpYV6t8Y/iFd/Evxze6+8m+Eswi3Hny88CuB0HSrrW9btdHsU3y3TqiKP7xNfn2Kn7bEe6f1fkmEjgcvhCpo7XZ+zP7Cekzaf8JXlnQo0twWGRjIIr7ery74O+Fl8IfD7R9JMflzLbxmUYx8+Oa9Rr7ujHkpqJ/MOZV1XxVSqtm2RT/wCpk/3T/Kv5wfjHz8S/Eob/AJ/Zv/Qq/o+m/wBTJ/un+VfzhfGMf8XM8Sn/AKfpv/Qq8PN1enH1P0jgF/7XP0IvhAT/AMLL8OlOn2uMEH61/RppCr/ZlthQPkFfzm/CD/kpfh7/AK+o/wCdf0Z6T/yDLb/rmtLKPgkPjxWxEPQ0dq+go2r6Clor6M/IbjCoweBX4X/tp5HxikUABBAD+Oa/dI9K/C79tX/ksMn/AFwX+deJmn8E/SeDFfMPkfJVpgSqy9Swr+kP4S/8k08M56/YIP8A0Gv5vrX/AFiY/vCv6QvhL/yTTwz/ANeEH/oNefk8bSmz6vxBelH5nodFFVL67hsbWW7uGCRxKWYnsBX1Z+F2vofl3/wUB+IEMsun+AYmPmwlbnI6fMMYr8wlBLc/MO5Ne1ftBeNbvxv8TtX1C7fcttK8EJzn5UY4ryGwsb3UJEs7KJ7i5c8JGpYnPsK/PMbVlVrtRP6z4ewccDl8Iy00u/mfU/wV/ap174KeGZPDukaJa3itK0rSSOythvpXsS/8FFfGpfafDVnjr/rJK+Gz8PvHnfQb7I6/6O/T8qQ/DzxyeRoF7/4Dyf4VrTr4umuVXsvI8+vk2TYipKrUs299f+CfZHif9vPxR4u8O6j4bvvDVmIL+Jom+d+jV8HXbieeWdIxEJCTsXoM9hXU/wDCvfHX/QAvv/Ad/wDCsbVfDuv6EFl1rT7iyDnAMsTID7ZIFc1aeIre9PoexluFy3B3hhWlzedz0v8AZ/8AGMvgj4paHficwwS3KJOc4BjzyDX9Dmn30OpWNvf27borhFdSO4YZFfzAhmhkEicEDII7Gv3/AP2X/H0Pj74U6bdIfmsFW1bPXMSgZr38orcylTZ+Xcd4BQnDExW+jPo2iiivqD8UPwc/bJ/5LHc/9cU/ma8A8DYPjDSdv/PdK9//AGyf+Sx3P/XFP5mvAfAv/I26T/13Wvz+t/vD9T+sMu/5FcfT9D+jvwd/yKulf9e0f/oIrK+I/gbTfiJ4Q1HwtqSjZexNGr4yULdxWt4O/wCRW0r/AK9ov/QRXS199ZONmfyzKcoVXOLs0z+a/wCJ/gTUvh34tvPDV8hTyJG8ssMbo8kKfxFaXwg+Imp/DXxpYeIbKVoreKRTOin/AFiDkqR6V+pH7avwPTxj4afx3otuH1PTELTED5miQcAevPavxrG+GYrKpUjhgeoI9a+DxVGWFrc0dj+nMmzCnnGB5Km9rNH1r+1n480X4leN9P8AEGjMJFaxg3f7L45H4V8nEYkqzu+UjPGMiqZPziuCrVdWfO+p9DgcDDB4T2EOlz+jz4N/8kz8O/8AXlB/6AK9NrzH4Nf8ky8O/wDXlB/6AK9Or9Lh8KP5ExX8aXqwoooqjjCv5w/jP/yUzxF/1/T/APoZr+jyv5w/jP8A8lM8Rf8AX9P/AOhmvm84/hR9T9c4B/3up6FD4S/8lK8Pf9faV/Rvov8AyCLP/rkv8q/nI+Ev/JSvD3/X2lf0b6L/AMgiz/65L/Kqyn4JG/Hv8an6GpRRRX0R+OBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/W/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigArk/G2q/2J4V1LVM4+zws35CusryP45zmD4W+IGU4Jtnx+VZzdotnRRjzTivM+XPhYI7fR9T8QSji8uHmJ9m5rPvvjx4Dt7ubTr64UMpKsDjH862/AxsrD4aWs94SYWtleQYznjmvhn4la58D7yPUhZwOupgtg+XgbvrmvyqScqjlc/YsFRhVm4zex6x480z4JeOg93aXMVlftyHTaCT75NeufAfwzd+H9KkjOpG8tcny/mDDHbpXwh8NdJ+FmpacW8S3UkN1v+XaoIx25Jr9JPhnpuiaR4XC6HL51vt3Kxxnp7VE90eljbU6ahGTa8zN8Pr/AMJB8VJ7t/mhs4tn/AlNfUAAGAvSvmn4IxG61HW7+TlvtciA+1fTCjHFenRXKfDYz+JYnTORVl5VgjMs5CooyTUKcVwHxV1c6N4H1O6VtkiwttP4V6SXU8qMPaVFFdSHXPjP4A8Ou0V9fxB16jcM/wA68h1j9r74caSWEUrSlf7q5/ka/H7xRrV9rGsXV1eSmTLtjnPeua+8M1z/AFpxdkj9awvCdCUFKcr3P1quf27fBcDHyopT/wBs2/xqtH+3r4RZwstrIAe/ltX5O45zSsAar65JPY9L/VbBtbH7T+Gv2z/h3rUi28zvBu7suB+pr6f0rxp4f1nRG8QWFyHt0TcXGMYr+buLhxj1r9c/g20kf7Pl6Q3/ACzb/wBBr0sNiHNNWPic74fo4XklTdrs8E/aa/aW1XWr+48M+Grp4LdCUdkON3b3r4HeR55muZ2Msrcknua2/FDPJr96WP8Ay1b+dYXOcV4terKcmfqOVYGnh6MVBC4K53NtLdh0pBnGyhicU0Hr7VxJu+p78klNI7X4dKT420hX5/fp/Ovuv9rIL/whmjjGNoQ57/dr4Z+GcbTePNFjXq1wg/WvvL9ru1kg8IaSHGOE/wDQa9SHwOx8RmXJ9epxfmeyfsmyyy+CImeQuvTn6V9ZSZycDoK+S/2TP+RFiHv/AEr61fg7h6URdkflGZpfWZJaHzX8Q4f7M8W2OooMeYyqTWF8X/hpcfEXQreTTZfIvY8MjggduOTXb/GWDFpZXY/gmB/So9Y1fUNN8Em+06Jp50h3IFBJzj2rxK6tK56uHnJck4vU+NIP2cPihq6raa7rLtaIcbd6nj6YrudD/Z/8D/DW7tdZ1jUXE6uCAwXBP1zXA3Xxb+N15O0NjpU6YYgEq4/pXm/jzWPi7qMFrd+LomjtUkzgk+nuKbkpQsfVRp16sfekrM/QLx5HaXfgw3Fl86RJvQj6cV9UfCXUDqHgjTpGOWSJFP4KK+PtDYXvwnD53A2g4HPOBX0h+zzdtc+CFV+sUrL+VfTZJOzlA/Ns6ppUV3TPfKKKK+yPgwooooAKKKKAPLvjDqPifSvh7rF94Sj36hFA7JgneCOhUDqa/nc8S32r6jrt5d62zm9klcyeZwwbPP61/Tkyq67WGQa+AP2hv2N9N8dXEvifwIqWepvlnh4SN27sTyck9a8XMcLKvBcnQ/RuFc4oYGrJVlbm6n5g/DX4t+Mfhfq8eq+Hbx4wpHmQhsJIo7N9a/R7wJ+3/wCF7i0VPHVo9pMox/o6NJn86/NnxX8JPHngnUJrHW9KuMoSC8cbNGcf7WMYrzqSNoSyTIFYcYPWvnKdfEYb3eh+x43J8tzSPt3a76pn7dH9u/4HCPf5t79Ps5/xr5o+Of7bNt4s0a68M/D6NktruMo80oMb4bqMdK/NVWX+IkGp4YpJpRFEjOzdAozmtamZ16keWKPJwfB+Aw9VVZy5ku7HTSSXEjXFwf3jEkn39a+w/wBjD4a3HjL4lQa3PGwttFK3KyY+UurYxn1rzX4Vfs8fED4oaultBp8lnZDBeWdTH8v+zkYNftj8HPhJofwk8Kw6HpUY80jdK+MEuRz0966MvwU+f2szk4p4goUcPLB4eV5S006I9fAwMUtFFfYH87n5Hf8ABQf/AJGnT/8ArnH/ACr83z0r9Hv+Cg5P/CU2Axx5UfI+lfnFnCj5OM/jXw2ZRl7e6R/T3CdSKyyKkz99v2Tv+SRaf+H8hX01XzJ+yfn/AIVJYZ45H8hX03X2dFfu4n865i/9qqW7sK/JD/goF/yM9h/1zT+VfrfX5H/8FAyR4osc8KY05/CuPHp+wlY9/hZpZlC5+cgx3r9PPgT+118Ovh34EtvDutif7RERnZEWHT1zX5gEDbgAkHuetN2AccnFfFYatVoPmgj+hc3y3D4+CpVpaLXc/ahv29PhGAdouicf88T/AI1wnij/AIKBeHoLdm8J2BupgOBOjIPzBr8ksY6Cr1tp2o3kgjs7Z5C391Sa9J5liJaJHy8OEMqhrOV/me8/Fr9pX4g/FeQx39y1jY/8+0TExn65r54LEqRITk9B716FoXwq8e+Ir+Oy0/RbktIQA7ROE598V93/AAa/YU1Oa8g1n4kyLFDGQ6wxEOH9mBxiuaNDEYmacj1q2Y5blNHlptLyXU8l/ZN/Z81Hx54mtfFetwvFptg4kUMMCQr257V+2FrbQ2dvHa2yhIogFVR0AFZPhzw1o/hXS4tI0S2S1toQAFQYHFb9fZYbDxoQ5Ufz5nObVMwrupLRdEFB6UUHpXYfOH4h/t18fF+P/r2X+dfGVuF88BuFGCfzr7P/AG6yf+FvIuOPsynP418VLxzya/Pcwpz9s2kf1Vw7Wp/2dThKXQ/XT4d/tq/C/wALeDNI0DURcCeyt0ibbESMqMdc12Un7enwlCkxi5J94T/jX4tuM+tNEbH7gJ9q9GOZV1BKx4tfg/LpVJSct9dz9WvFv/BQXT4IWXwjpouZD085WT+VfBnxT+O3jv4s3THXrtltc7ktlbMan2zXlFrpGq3ZAtrKaUn+4hb+Qr0Pwx8FviN4uvo7DTtGniMhGJJI2RefUkYrmqYjE1/dSPVweU5Tl/73S66tnlgj3sqqvzfqTX6P/sZ/s83mpaqnxD8S27JaW5zbrIMEuOQwB7e9d98EP2G49Lni1z4lus8yEEW6kPGQPU8Gv0h03TLHR7GHTtNhWC3gUIiLwAo6CvRwOXShP2lQ+E4k4rp1qTwuE67v/I0AAowOAKWiivqT8VIpv9TJ/un+Vfzh/GL/AJKX4l/6/Zv/AEKv6PJf9TJ/un+Vfzg/GFlPxQ8SquT/AKbN1H+1Xz+bJunG3c/W+BJKOJqNvoM+DvPxM8Pf9fUf86/o00n/AJBlt/1zWv5zPg6234meH1KEZuo+QPev6NNJ/wCQbbf7gqcpi1CVyuOnF1qbTvoaNFFFfRH5EIelfhd+2tx8YJCf+eC/zr90T0r8L/21SP8Ahb8ibS+YB246142ZxcqFkfpHBkksfdu2h8mWpG+P/eFf0gfCb/kmnhn/AK8Yf/Qa/m8t8CeFWGMsBxX9InwnGPhr4aH/AE4w/wDoNeflCa5rn1HHslKFGzvqz0Ovnf8Aab8bQeC/hVq0jy+VPfRPDCe+8jNfRFfk3+378RBdavZfD+P5o4AtySOeWGMV7+JqOFKUkfmOSYVYnGwpy2vdn5tXFzLe3L3d0xd5CST7+tfen7CngGLxB44u/EGoWoa3s4t0b4yPMVv518D7F2DbnJOK/c79jPwLJ4P+FcMt3Hie/czg99jgEV8nltCU6vPLofunF2PWGwDowestD61+xWv/ADyX8qPsVr/zyX8qtUV9rY/mvmfcq/YrX/nkv5V8Z/tq/DuPxR8MG1azjCyaMz3LkDqqrjBr7WrlvGnh2DxZ4V1Pw5cjMeoQtE2fRqxq01Om4dz0cDip4fERrJ7M/mZAIGJOAemOa/Sf9gD4gS2us6h4Gu5dtsYzNGCcZkdsdK+A/HOiN4c8X6vogj8tbO4kRQRjKqxArqfgn4um8F/ErRNeMpigjuU88A9YxXw2EU6Fc/pjPKdPG5Y1dNtXR/R3RWXo2pQ6zpNpqtucxXcSyL9GGRWpX6Afyq1Z2Z+Dn7ZOB8YrnPeJf5mvAPArA+LNKx/z3WvoD9sj5vjBcAjLeUuPzNfPngXjxjpI27QJ1JHrXwNanL6y9Op/VGX1IrLIq/2f0P6QPB3/ACK2lf8AXtF/6CK6Wub8H4/4RbSsdPs0X/oIrpK+9Wx/LtX4perKt5Z21/ayWd3GJYZRtZT0Ir8JP2q/gxP8L/HU93ZIx0zU2MiMRhQ7ksVH0r95a8M+P3wpsfix4Cu9GliV72BWktWP8MpGAc1w4vDqtTcep9Nw/mssvxcZt+69Gfz1k84P8IphILZFa3iHQ77wzrN5oWoRMtzayNGxYY+6cZHrWKuQwXoTX5/7KanyNH9RvFUqlJzhLRo/pA+DX/JMvDv/AF5Qf+gCvTq8x+DQI+GXh3P/AD5Qf+gCvTq/TIfCj+O8V/Gl6sKKKKs4wr+cL4z/APJTfEX/AF/T/wDoZr+j2v5vvjKVb4n+JB8xIvZ8cf7Zr57NouVONu5+tcBzUcVUbf2Sn8JiP+Fl+HR/09pX9HGh/wDIHsv+uS/yr+cf4SH/AIuT4dUphvtickV/RxonGkWf/XJf5UZTGShK5rx3JSrU2n0Zq0UUV9CfkAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH//X/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigArxP9oByvww1kesDfyr2yvFfj8gb4Xa45GQlu5rKv/Dl6HbhP40L9zxDwPa21x8PtNtbtFaGS2QNn0xXzp408K/s/2F7KmpW9slwSS2MEk/nXtvh65mPwptp4jtZLNSv5V+csd94Cudf1Gfx1JJLMsr7Rt3d/rX5VF+8z9mwEf3jtKx6uvhb4AahfrBa3rWjMQAEVcfzr7Y8J6LpOg+Efsegy+dB5eQ/HIx7V+Z3iLVfhS9lnw7aFLoH5W2YP86++PgjeTaj8O0Rs7hHgZ9MVMuh1ZnCSim5XO0+AyqLHWGXveSZPvX0QvPNfOPwHcCDWYf7t7JkV9HI3Oa9ansj4LGJ+1LS+1fMH7VOvrpPgCaIttacFfzFfTyHnNfnh+2x4h8uxg0oN1IOK627RNsooe1xcUfmLI26WRmOckmkTtSEYx70teU9Wf0ZTXKl2Qp60lA56Uo61PUrfVDovvge9frt8JkCfs9XZ9Ym/9Br8ik/1v41+vPwy4/Z3uSvy/uW/9Br2cD9o+A4m+Gn6n5OeJT/xPL3H/PVv51ibhWz4gydavT1Pmt/OsgqeqAEd89a8yo/edj7TCJ+xi0+gE5pFHBzVi1tbi/kENjE87nsgLH8hXq/hT4EfE/xfIP7O0eaFW4BmRkB/MUQpSk9EKvjKFK0qkkjP+C8Qm+Jnh9GHH2qP+dfoh+29ZrF4L0h1GPmUf+O1498J/wBkL4o+HfGGleIdeNtb21nOsrYlGcD2Ir3H9uZkHgrS1RhII5ACV5HAr3adBwoy5kfl+Nx1LEZpRlSldI3v2Tf+RGiHv/SvrRvkXB7mvk39k7/kR42xgN932OOtfWT52YY5J4rzlsfHZrK+Lk0eM/GNB/YET+j8flWfZazDofg1NUm3MkEYcgDOQB6Vc+McuNBt0PeXH6ViXeo6To3gYXesD/Rli+YEdeK8nEbnbhlenFeZ4jc/tX+D4J2t5LK4VkYg4hPasTW/2gfhn4vhSx1exmmjLcBoT1ryrU/ij8MjqEwXQFePcf3hjPNdX4T8V/AzxFew2bWS207MANybRk+5NZJOx9hHD04RUmrM+sNPm0e58AyHQ4vs9sYMqMbT0HavV/2a2J8I3AJzi5krz2/t9O0/wZcR6Xt8kQZQj0xxXov7NsLp4Omd+rXEh/Ovo8mX7yR+eZu/3D9T6Nooor7g/PgooooAKKKKACiiigDI1bQdI1y3a01W1S5ibqrjINeN6l+zP8FNSdpZfC1osjHJYIc5P4173RUSjGXxI6qWIrUv4cmvRnzC37I/wZaTf/YkGPTZx/Ouo0j9m74NaO6TW/hm0MsZyGKHIP517tRUKjTWqijrlmOKmuWVR29SlY2FlpsCWtjCsMSDCqowABV2iitjy229WFFFFAjgPFvwu8A+Op0ufFuiW+pyxgBWlXJAFccf2bfgcevg+x4/2D/jXuFFS4xe6OqGIrQXLGTS9WYmg+HdF8MaemlaBaJZWifdjjGFFbdFFUkczbbuwrz3xd8Lfh/48lSfxdolvqkkeNpmXJGPxFehUUrJ6MuEpQfNF2Z4ef2bfgccZ8H2PH+wf8aT/hmz4Hf9CfY/98H/ABr3Gil7OHZHV9cxH88vvZ4eP2bfgcP+ZPsf++D/AI1tad8EfhTpJDad4btYCOm1T/jXq1FJQj2IeJqveT+9mbYaVp2mRCGwt0hQdAorSooqzlbb3CiiigQUUUUAeZ+KPg78NPGt9/aXinw/bajdAbfMlUk49Otc2P2bfgcBgeD7HH+4f8a9woqXGL3R1RxFWKtGTXzZ4f8A8M3fA3/oT7L/AL4P+NKv7OHwQU5XwhZA/wC4f8a9voo9nDsjT65iP53955ppfwe+GuikNpnh+2tyP7q139rYWdjGIbSFY0HQAVcooUUtkc8qk5/E2woooqjEKKKKAGkBgQehrxzUf2fvg1q19NqWo+FLOe5uGLySMpyzHqTzXstFS0nujWFWdPWEmvQ8d074BfB3SbyLUNO8LWcFxAQyOqnKkdxzXr0caRIscY2qowB6VJRQklshzqzqfHJv1CiiiqMQrzHxH8G/hj4uvzqniTw9bX90RjzJFJbH516dRSaT3NYVJwd4Oz8jw8fs3/A8MGHg+yBBz9w/417HYWFppdlDp9hEIba3UJGi9FUdAKu0UlFLZFzrVKnxyb9WFeW+JPgt8LvF+oHVvEnh21v7thtMkiktj0616lRTaT3M4TlB3i7M8P8A+Gbvgd/0J9jx/sH/ABr2HT9OstKsoNO0+FYLa3UJGi9FVegFX6KSilsjSpXq1P4km/V3CiiiqOcKKKKAPHtY+Avwf1/UJNV1nwvZ3V3MSXkdTuJPPPNZ6/s2fA1H8xfB9iGHfYf8a9xoqOSO9jsWKrpW5nb1ZSsLC10yzh0+xiENvbqEjReiqowAKu0UVZxtnlXiL4JfCrxZqR1fxF4btb+8YYMsiktj86yrf9nf4KWtzHeW/hKySaI5VghyD+de1UVHLHex1rE1UuVTdvVla2toLSCO1tkEcUShVUdAB0FWaKKs5AooooA8l1v4GfCbxHfPqet+GbS8upOWkdTk/rWR/wAM3fA3cH/4Q+xyOh2H/GvcaKjkjvY7Fiq6VlJ29WUNP0+y0myh0/T4hBbwKERF6Ko4AFX6KKs5G76sKKKKBBXjmofAD4O6rfTalqPhWznubhi8kjKcszHJJ5r2OipaT3RtTqzpu8JNeh43Zfs//BzTryHULHwrZw3EDBkdVOVYdxzXr8UUcEawxDaiDAA7CpaKaSWwTq1Knxyb9QooopmIUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/0P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAK8u+M1i2o/DTXrVBlntnA/KvUaydasU1LSrmxkGVlQqfyqJq8WjanLlmpdj4i+Foi1LwNBp1zz5KCFh9BXlnjH4e/BLw3dS6h4jtbd5XJYhwMkn8a9D+FszWl7r+isNr297LtH+yOlfH3x8axX4ixjxRI508YO3Ge/pX5bJKNWUGfsmAi6k73Nm88f/ALPGly+XZeGEndT1WEkfmDX1h8K/GHhLxTomfC8AtI0GDHjbjjpivgmTxh4EtbdrPw54fN2WGFYRMTn8K9o/Zot/Edtq93Jd6e9pZz5ZVdSvX2NYy3sexjMNFUnNy2Po34TudM8XaxozfKZZHmGeM5NfTcfQZr5bvd/hz4mW2pSHbHeqsQ+pNfT9vJviBH1r0aTvofCY9LnTj1Lm4KpPoK/IT9sLxAdR8Y/Yg2ViGPyNfrhctK9tIYwA2CK/ND4o/s7eJvGvi+51S+u4rW2diQ3mAHGfeuud2rI9XIXTpV3UqPY/PEZbn0pz4xX3fZ/so+E7cL/aXimFW7gyx/41uxfs1/CyP5ZvE1ucf9NY/wDGuZUJH6h/buH5XFX+4/PFTTxwa/REfsw/Cy5P7nxTAP8AtrH/AI1Wm/Y68O34L6R4kil9AsqE1f1aV7mK4gw8Y8sr/cfnyn+vH1r9fPh4Nv7PMwHAMB/9Br5d1H9i3xfayBtKuFulJ4LMP6V+gPw9+G11o3wtPhnxIRHtj2sUOTjFepQpOkm31Pk+IM1oVYwdN7M/FiXwzrXiLxFdWuk20krGVvuqT3r6G8Lfs0wWsCar4/1OPTrcANsDrvI9MNivUvHfxK8FfCa4n0PwVp4n1ViQZWTDg+2K+bLy0+MPxbuyzW92yOcjzFYLg+hxXK4JSutT2qWLrYiikpKMbb3Pd/8AhaHwL+Fg+z+E9Fj1XUYP+W00eMke6muY8R/tsfEjVYPsmi28WkRLwDAzAgfjVfwx+xp4+1crJqRFuD1w3P6ivc9G/YThj2vqN8zeoytaKVRaR0PKlLKoO+IfNI+LtS/aH+MWok+d4pvArdg//wBavVPBfxMvviV4buPBPja4N5OctBLIcnceBX2HZ/sYeA7ZQLkmRh1+UV1ui/sq/D/R7xL61TEkRyPlHaptPeTOXEZnl6j+5ilbyLv7PHh648O+Gfsc3CoTj3FfRLgMRjoOaoabpNrpNqlrbKdqDA49KtO2Uz3z+lYrY+BrVPa1Oc8D+MFyLi40/TVP3pQSPqK4/wCLmg6lqnw8FnpwMjRx5KevFa/iGYa/49igj5W1wT+BxXLfGbxd4q8MxRP4fjSeNAN6ZOSAPQV4tWTcrH1GDpzvGCWp8f8Ah3x54V8O2zaR4w8JLMYmIZ/KZiccVneJdZ+HvinUNPj8CaE1ldmUZKxFe1eo6b8ZfBGoTeR408PpE54ZzGevfrX0P8P7T4Q6xKl74agt/tKneAcBx+GaU5uKsfT16jpJuUDblSfTfhd5d4MSi2A565wK+lfgNZG08C25IwZTv/MCvnv4quF0e30yDCG6fYB06ivrr4faf/ZnhHTbbGCIUz9dtfVZLF3lI/NM5qJ0YpdWdtRRRX2B8IFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/0f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKawyp9xTqKAPhPxFajwh8ZbiGJdlvqEO/PQF2P86pePPhl4H8R3A13xVGjxwjnzANvH1r1P9orQXWCw8T2ifvLOUM7D+6K4jWdHt/iJ4K+wtMUNzF1HqRX5zmlF06/Mup+m5biJSpRne3Q+add+JXwW8BA2nhrSIrm8i+75Sbhke4Ncl4d+K3xR8X+KrSTTtNGn6UHBJG5QVz7iu1034ZfCnwBqSWOsMl1qD84cAnP515R4p8a+JNU8UXHh7wW6afZ2ak5Vto4Neafa0aUKiajG9+rPsrx7ZXF7odprCYa5s2EufcV6/wCBtcXW9BtblmxIFAfHr3r48+BPjvVvF9vfeFfEEn2qaAsu8HcDjjrXsfgDU5fDXiS48PX7bInYsgPQgnirpT1PmcbhUoSj1R7R4+1ObRvC19f20hVoo2YHp0Ffin4y+L/xB1DWL6JtcuPJ8xgq7uAM9BX7CfF9b288D6jDpyGWSSJgqj3Ffk3Y/s8/EjxFfySpZeWsrE5fI6/hXoTUmlynq8PKhCDnVseKT+ItdvWLXN5JI2O5qh/aF8w+eZj+Nfcnhz9inxFeFX1i4EGf7jA/zr37w3+xV4TtdrapK0uOuQDmiMKh9dXzvL6K03PyotrnWWP+iPKx9s16f4Ts/jDdXEa+HGvI2YgAqGAHvnFfr34f/Zy+GmiYWPTYpyO7qK9Z0rwl4e0MBdLsY7fH91cV306bv77PkcVxLSn7sYXPAf2d/AnxI0bTl1D4ga3cXUkgysTsGAz+FfWE0cc0LRSqGRhgioo3UJhRkinbj3r0k0l3PzGvVlWqOckeNXXwC+G15rb69e6RBcXTnO515Br0rT/D2jaTEsNjapEqjACjoK2WfcKZvwMUKS6oftak42chcKowAKYzBRyc1E784qIuT1rKUkhKHdgzA9Bz71VkOeVGPpUjMKqSEYAU964ZzT0KjG7s2I7HG4sRiua8Raoml6ZcXrHbsQnn1rfdghKjnIr58+KviBr69t/CennfJMR5mOytXHVnyo9XDUueooLYxfAcBu7u88QT8ec7AE+mc18k/GzQfixP4guNR0m+c2mTtS3fcdueMgCvdfi9r974C8GQ2GlsYWlG0yDjacdc14b4F8bN4MD634k11tSS4TcIy4fBPOMV5N7yufoGCpSjL2yV7Hzcmkf2jcLb+ML2+gnDc7k+X8zX2z+zz8JNI0i6bxFYaibyNxgZIJHOe1Gk+NfhX8Vb7+yrzTkjuJeN+zBIP1r6W8L+ENB8B6PINIUJBgt0xWdR3kkdOY4+rOKptctzmdYjl8RfETR9FQebFbzI7Z7DpX3jZwLbWsVugwI1Cj8K+PfgXpMniLxfqPi2YZhjLRJ9UbrX2ZX6LltPko37n49nFROr7NdAooor2D50KKKKACiiigChqGo2mlWU2oahKsFvApZ3Y4VQO5Jr87/if+3Qunas+h/DPTRq08UhjYyK2CRxlduc89K6z9uz4gal4Z8A2uh6TMY21OVorgZxmJlzj864j9iv4FeHbjw0fHviWyS5vZJGWJXGQqg5DD3rzq06kp+ypO3c+6y/BYahhPr2MjzJu0Y9zz9v21vjdpZF5qng9Y7bqzOkoAH1Ir7J+BP7TPhf4xR/YB/omqxqC8TfKp7fLnk817pq/gfwrrlg+manpsU9u67SjLxivmn4b/sk+G/h/wCO7jxtY3sqM8heO3AHlqu7IFVGFaEleV0YV8VluJozap8k1tbW59V65ren+HtLuNX1SUQ21spdmJxwPrX5zfEH9u29i1l9H+GmkLqhRyhMitk44yu3rWh+318RLzS9AsfBul3L28s77pwnG+J1+6fbNdF+yB8BPDuleDYPFviOwjutTuzvjdxkqhwVOawq1ak6vsqTtbdnTgsHhsNg1j8ZHm5naMTxYfttfGbRZVude8JLBaNyzukgwPbIr7Z+CP7RvhH4x2vk2T/ZtRjXMkT/AC89Dtzyea9Y8SfDzwh4q0x9K1jTYZ4XGAGXOPpX4ua3YX37PH7QtvHYymCzS4W4cKcA27MSE+ntU1alTD2lN3R2UKGCzWE4UKfJOKurPRn7n3s7W1pLcIMlFyBXwB8P/wBrnxV4r+L0/wAPb3S7eK1ju2txIpbdgMVz6dq+37TVU13wjDrEX3Ly2WUfRxmvxp+CZz+0/d57ak//AKMNdGIquMocr3Z5OU4KlVo4h1Y3cVp5M/cGiig9K9A+NPgP41/tXeK/hr8U7XwLpul29xbTqjGSQsG+Y+3FfcHhzUpNY0Gw1SZQkl3CkjAdAWGa/HL9rQ/8ZGWA/wCmUP8AM1+vngT/AJE3Rf8Ar1i/9BrzaFWUqs4vofaZtgqNDCYepTjZyWp1tfMn7Tnxq1r4J+F9P1zRLOK8lu7jySspIAGM9q+m6+AP+CgW3/hXmjbh/wAvvH/fNdOIm4UpSXQ8jJ6EK+Np0qiumzxqx/bj+MOqQm403wlDdRg43RrIwz9RV/8A4bR+OOMr4JU+v7uX/CvTP2JP+EUX4Uz/ANtvbrP9skx5rANtx719lxr8PZZAkT2bO3AAZcmuKkqlSCnzn1ePxGBw9edGOFXuu17sq/C7xXq3jPwhaa7rdp9hup1DNFgjaSM9+a8f+OP7UHhT4Rq2mxkXurMPkjX5lBPTdg8V7b441+28E+BtV8QwKBFp9u0oC9MAdq/G74LeGP8AhoT43Xepa25urWKU3LJJyDHu+7j0rXE1ZwUYQ+JnlZRgKGIlUxOI0pw1svyPZz+2j8b9VP2vSfCCyWq87kSUgj8BXoHw3/bplvtaj0X4jaWulGVwilFbIJ/vbsYr740jwR4W0OwTTdM06KCBBjaq8YrwX4kfsn/Dn4g6va6w0P8AZ8sMgd/JUfvMdjn1qXSrxs1O5bx2W1W6cqHKujT1PpfTdStNWsIdSsXEkE6B0I7g9K+A/wBoL9rrxb8JvHf/AAimj6Tb3iGIOGkLZyTjHFfeOgaJZ+HdGtdFsRiC0jEa/RRivxv/AGtzE/7Qdgk3EeyPOemN3enjakqdNOLsyOH8JQxGKcakeaKTdj1GP9tX43TRpLF4LR0cZBVJSCD+Fdf4H/a1+MniLxZpeiap4PW3tb2ZY5JAknyKep5GK+wfAx+Hq+D9IEstmH+zR5y65zj613Om2/gy4nH9l/ZpJU5HlkEj8qKdOrdNzuXisXhPejDDcvndnVwu0kSOwwWGSKmpAABgVh+JNXj0LQ73V5fuW0bOfwFei3Y+MScpWXU8J+N/7SHhL4OW3k3TfadSkH7uJBu57bscgV8Vt+2x8Z9YD3eheElntgx2siSEFffArxnwtompfHr4+XJ1SU3tklyxYOc4g3fdAr9lvD3w88IeGNLj0nSdNihgRQuFXGfrXlQnVr3adkfoVejgsshCnVhzzkru+yPgv4e/t1Xc+sx6N8SdJXS2kIAMatkE+u6v0U0TWtP1/TYNV0yUS29woZSDng18H/thfAnw7eeD5fGHh+yjtL2yzJI6DBZRzzVf9hH4k3WueHbnwhqU5muLQl0yc4QcAVpSnUjU9nN3OPGYLD4jB/XsJHls7SR6R+05+0T4h+Cf2T+xbCG8+0EA+aSMZ+lfMlp+3B8ZdQiFxY+Do54j/EqyEfoK2P8AgoBxNpZPI3rX1b+zj4f8OzfC7SpZbSJneNCTjviuWbq1K8qcZ2SPQpU8Hhstp4mpR5pSbW58y+F/2v8A4y6xrtjpt74NEMNzIqM/ly8A9+RX6TaVdS3unW93cJsklQMy+hNZ8Xh7w9G6tFaRBlORgVvqoUBVGAK9SlCcV78rnx+OxNCtJOjT5Rkr+XE7j+EE1+Xfi39uDx/onjLU/DGn6DbXAtLl4Y+XLMFOBwO9fqFdf8e0n+6a/CzTTa/8NO5vdvkf2uwffwoG6uTG1ZwUVB2uz6HhzC4es6ssRDm5VdI+ij+2b8bgM/8ACFKR/wBc5f8ACvYvgl+0j8TfiJ4sGieJPDI0612g+YEcc5/2uK+rt3w7CgebZ4/31ra0e38LyOZ9FEDsOrREH+VXGlU5k3M48TjcJKnKMMPyvvd6Hgv7UHxv1r4IeF7DXNFs4ryW7n8krKSABjOeK8h/Z6/bDu/if4lbw94ttLfTnkX9yY2PzMTwPmqr/wAFCRn4eaRxn/TB/KvzU0Lwt4t8LaLYfFbTFItLe5Cqyk7ldeckdhXDiMTUp17R+Fbn1uUZNhMVlbnUspybSfmf0Yk4Un2r4D8R/tY+KdH+M1p8N4dMt3tLicRGUlt4BOM+lfQvwC+LGnfFXwFa6nDLuu4EEcwb7xdRycelfmX48IH7Vumf9fqf+hV2YjEctOModWfO5PlkKlatSxEdYp/ej9pbaUzW8crDBZQTXy98cf2ovCnwjU6bERe6s4+SNfmUE9N2DxXtnjHxGPCXw/v/ABGwyLC1Mv5Cvxy+C3hU/tBfG+71LXHN1awym5ZJOQY933celPE1pQ5YQ+JnPlGW0q3tK+IfuQ38/I9m/wCG0fjdqx+2aT4QWS2U53IkpBH4Cu++G/7dUt9rUei/EbS10syvsUoGyDn+Ld0r750jwR4W0KwTTdM06KCBBjaq4FeC/Ej9k74c/EHV7XVzD/Z0sMgeTyVH7zHY5qfZV1ZqVzrWPyqq3TqUOVdGnqfS+m6la6rYQ6lZOJILhA6EdwRkV8GeOf2s/Fnhj4wWnw8tdLtpLW4mWMyMW3AEkZr7p0HRbTw9o1ro1iMQWkaxr9FGK/GT4wEj9qTTf+vlP/QjV4qrKnGLXc58iwdDE1aiqK6UW0ftLYXT3WmwXjgBpYwxA6ZIr8uvFn7ePjPw54w1XQBotq0FhcyQhiWyVRiMmv060T/kA2f/AFxX+Vfz4+LfDGoeM/jVrPhzSwDNe6lNGhY4+ZnPFc+PrzpU4unuz1OFsBhcVWrLFRuoq/ofvP8ADTx5p/xE8I2PiSxdW8+NTIFOQsmMsPwrlPjx8TL/AOFXgmXxNp1ulzMm7CPnHAz2r86P2UfipqPwk8dzfCzxhI0VtcTmGIN0ExbBPPbjrX2P+2RJHJ8IZp0IdDvYEcgjbW3tpSw7mviSPLq5UsPmUaM1eEnp5o6X9mj41ax8avCc2v6xZxWckczxhYiSML9ayv2n/jvr3wR0XTtR0OyhvJLyfyiJSQANuc8V5V/wT8Yt8M7sn/n7m/pWD/wUL/5FPRR/09H/ANArN1Kn1bnv71jop4Gi86+rcvuX2POrH9uP4zanD59h4PhuI843xrIy/mBV4/to/HPb8nghSfeOX/Cvef2Sx4Kj+FFv/ab2yzGVs+YwDdB619QxJ8Pp5Vihezd3OFAZSSfbmlShVlBSczpxmJwNGrOksLs7XuypovizU734eQ+LL+2EF61qszRHIAYgEjnmvzpv/wBur4lx6/eaNp3h22uWt5XjULvZiFOBwK/S7xjHFD4O1NIFARYDgDpivyB/ZsOiv8d9X/t0w+SJW2mUgDPmH1qsVUqQlCEXuY5FhsNVpV61anzKKuket/8ADZ/xwz/yJK/9+5f8K+hf2cvj98RPit4n1DR/GHh4aRb2tuJUkCuNzFsY+avo7d8O+CZbPP8AvrXQ6Na6AA13oqxEN8peLBHHbIraNKopqTnddjzMXjcLOlKEMPyt7O7Plf8Aae/aK8Q/BI2a6JYQXn2hgG80kYBGe1fNNn+2t8cdSgW803wVHPbt/EqSkfoKuf8ABQk/v9JHq6g/9819gfs46dov/CrdJPlxkmJMnjrtFcMnVqV5U4zske7Tp4PDZZTxFSipSk2t2fKPhn9vLxDZ68mnfEjw+ul2zYyY1feM+zV+kPhzX9O8T6Na65pUgktruNZFPfDDOD71+Zf7e+l+CLGx0y50pIF1iWXbIseN5j28ZHXGa+s/2SrLWrL4RWKa2GEjtujDf88yBtrqw86ntJQm7pHBmuFwssFTxtCPK5NpxPG/HP7Wfirwx8ZLP4dWml28tpcSpGZWLbxuJ/DtX3np9093YQXbgBpUViB6kV+LXxhb/jKfS8d7mMfqa/ZzRf8AkCWf/XJP5UYWrOc5KXRmGc4ShQo0HTjZyV2fmD4r/bz8Y+HfGGp6Cui2rW9hdSwbiW3FUYjNfot8NfHmm/EXwlY+JNPkVvtEamQKchZMAsv4V+Cvivw1qfjT406z4b0xF+1XupzRITxyXOK+qP2UPilqXwl8fXHwt8XO0VrPKYYwfuiYtgtz246152GxtT2zjU+FvQ+vzfIMJ9RhUwnxpJtd0fop8evibqHwp8ETeJ9Mt0uZo92EkJA4Ge1cp+zN8a9Z+NfhGbX9as4rOaOd4wsRJGF6Hmuc/bJkjm+D88kZDq+8qexyvrXnP/BP3d/wrS6D9ftcv5cV6LrS+sqn0sfGwwNN5VLE295Ox9weJ/E2j+EdGuNc1udYLa3UsSSATjsM9TX5z+Nf27tZuNYfS/hloY1NEYqTIr7jj025rP8A2/Pidd291Z/DixkMbFVuJCDjcjjGDXu37K/wF8L+F/Ath4g1OyjutSvlWcSuuWCuAQAfapnWqVKro0na27OzB4XC4XCRxmMhzOXwx2Pm5f22vjHocyz+IfCawWpPzM6SLge2RX3L8Efj/wCFfjPphk0t/KvoR+9hb5SCOpA64zXoniv4b+D/ABjpUulazp0U0cikAlclc9xXlvwd/Zv8JfB7VL7V9GkeWe8LffAG1CchRjsK2pwrRl70ro4sXisuxFFunS5Jra2qZ9H0UUV3nyAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf//S/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA5TxroMXiTw5e6VIM+dGwH1xXxn8Pryaxub3wnffu5rORlTPBKLwK+9iMjFfGXxx8OS+EfEtp4805CIJWEdxtHCrnJY14OZ4b2tPmW6Ppcpr8tT2Te58ZfHbRPEGgeOl8T2entfxMm0DaWAbPtUPwZ+Gms+Kp9U1XX7VrEX6Mq8EEbvTNfd9pJpniXToLgKs8TqHBPOQa2YLWC2QJbxhAOwHSvz+dXlbTR+i/wBoThS9ny6nknwy+D2ifDeOY2DNLPMSWdgM8+9WPiN4bmuIU13TMi+svnGOrBe1etfw8monQMCGGQwxWUKlnc8dVZOfNIw/h/4vsvFejokwX7TCAkqNwdw68V6Zaw20IxHGoPpXy94h0K/8F6x/wk2hqfKc/vo06EdzgV7h4S8Wad4hsI7m3bMuBvX+IH6V7FOrzHFiKSj7ye53isFOXUe1WFbPQ59jVBGB5zkdt3UVIZQg+YgV2Kol1PHcLvY0Q57AD6VKHyQAxOPWsX7dbIfmlA/GkbWdOTrcRj6sK2+sU/tSQnRnpaJv+Zg4HHvTt+e9cy3iPSBw11H/AN9Cov8AhKNEHH22L/voULGUV9pDeHqbqLOpL1GXFc1/wlGhnrexf99Cl/4STQzyLyP/AL6FQ8ZSe0kJYaot4s3yx71CWNY39v6Oel7H/wB9CnDWNNf7tyh/4EKyeLoP7Yvq9W9+VmizVC+3H05qr9stXHyyg/Q1zniHxHYaJYyXk8oCqDwT972rJ1qb15jqhRm2lYo+NfFlr4Y0iW8dgZSCEXux9hXjfw+0C7vbufxRrILXF0S0e7qqE5AqjaQ3/wAQdcXVNQUiwhb92rdOO9e6W8EcESxRKNqDAx6CvMr4iMtEe5GDoxtbU4nxx4A0nxzpLaZqK/IwOTjkfSvla5/ZY8PeGY7nWpJ5tQWIFktiAUOOgwOa+5NvPXFI43ABgCCcGuSFRJXZ3UMbVpL3ZH5t+APCWua/48inttBGj2dk4yyIy7lU4719k/EPV20zQINDsjuur/8AcIB1yRXpdw9hpsMtxgQooJJ6V5x8NfDt18SPiC/iS9QnStMb9znoZUOM/lXpYGjLE1E7aEYrHqUXWqaWPpn4SeE08J+ELW1IxNOolk9dzDmvU6YiLGgReAvAp9fqEIqMVFH5RUm5zcn1CiiiqMgooooAKKKKAPyw/wCChVrcE6XdOT5AZQMdN22vr/8AZZvLK8+EumNZEFUUK23+8FGa5b9sD4UXnxK+HJm0pC95pLNcBF5MmFwFx3r4y/ZY/aTs/hJHN8PfHkMlvB5rFG2nKyMcYOegGK8VyVLEtzekj9GhTljcnjSo6yg3deR+w1RiRGYqrAkdq+X/ABN+1p8KdA0pr+O++0SFcqkeGOfcA18cfBX4q/F34tfG7+0dFvJx4fjmDSxsSI/J3Hge/tXouvBSUU7tnzdLJsRKjKtNcsY99LnPf8FArW9/4WNaXbEi1FtEB6Fsc1+lXwHnguPhboDQEMBaxA49dgrwD9tX4R6j498Dw61oVuJbzSmMsoAy7RquMKB1Oa+eP2Xf2pdK8AaV/wAIH49MqCOVgkhHKHptbPQDFeapKjiJOe0j6aVGeNyinGgryg3ddT9aK/Eb9uU/bfjekdn8zfY4R8v97mv0L8Y/td/C3wzo731rd/bJ2U+WkeHy3vg1+cfw30LxV+0V8co/Fk8DSaZDch5WcHb5IY/KD6jPSjHSVWKpw1bZrw3hquFqTxldcsYxe/U/XnwCkkfwk0OOTh102AH67BX5HfBH/k567/7CUn/ow1+0c1lDpvh82FsNsdvCEUDsFGBX4b/DvxPpHg/9om91rW5PLt01OTLDtiQ9avF2i6bfRkZApVqWLUFdtH7z0HpXzkf2pfhKP+YkD+K/4123gT4x+CfiLfzab4ZuxcTwR+YwBBwvTtXqKcXsz4Opg69NOVSDS9D8rf2tP+Ti7D/rlD/M1+vngT/kTdF/69Yv/Qa/Hn9sC6hsv2gbS7mJ2QwxMfwJ6V+gHg/9pv4V2PhXSbS51ELNFbRqykjIIH1rycM4xqzbZ+g5zhqtbL8M6UG7LofWdfn/AP8ABQQ4+HWjn/p94/75r6H0T9oz4Z+INXtdE02/El1duEjXI5Y/jXzp/wAFB2/4tzo3OB9t/wDZa7MU4yoy10Pncko1aWZ0YzjZ36nyH8E/gP8AFP4k+Em13wfqos7RZmjKGXZ8w6nFe9+Gv2U/jtpfiCw1K+14PBbyqzjz85UfhVj9j741+BPAPw0m0XxDe+RcNdPIAxA4P1r6vP7UnwlBx/aa8+6/41wYWnQVKLv+J9Pm+MzP61UhGHu3fToa3xttbm1+BXiC0lO+WLT3Vj6kDmvzo/4J8FI/iVq+7AzZkDPXO6v1GlvNB+K/ge+g0yQT2WoRNETwc5FfjLoOu63+zX8arqa8tnhsftDK2QQWg3fw+tbYmNqsKvRHHkidfCYjB7TlqkfqD+07D8U5fDliPhfcSW94J/3pjJBKY9q/Nnx18Qv2mPh/HDN4k1u7t1lYKpDnH6iv0x0X9qn4T6xpKai2oCAldxjkKhvpgmvzi/a3+M8XxTurceH7WVNEtpAqzuhUNKOoB6EVhjWuV1IT18joyChNVlhq9BW1u2j9Lf2avE2s+K/hpbarrt093dOeXkOSeK/Mv9s2zuNQ+OEFnaPsmliRVOcck1+iv7ImP+FQ2frkZ/Kvz2/a9u4bH492d3c8RRRozHvgGniuWWHi5+RWQwUM2qxgtr2O70L9lD46X+j2V9Za8EgnhVlXzsYBFfSP7P3wG+KPw58Uzav4v1b7ZavHtCeZv5z1xXYeDP2mfhVZeFNLtLjUQkkNuisCQCCB9a7PS/2lPhdq+oQaZZaiHnuGCoMjkn8a6aVOjFqcZa+p5OOxeZ1VOFSHuu/Q+gK8w+MsVzP8MfEMVp/rmtXC/XFelQypPEs0ZyrjIqpqdhDqenz2Fwu6OdCpB7g16UldWPiqT5KkZPoz8d/2IpFtPi5qcN8QsxjZfq2a/Zivw18ZaX4q/Zx+OMniCS3ZNPluDOrID5bRls7SfX2r9H/CP7XHws8RaNHf3N79kmCjekmFO7vgE15eEqKF4Tdmj9B4jwtTE1IYqguaMorbudx+0ZLBH8IvEImON1q4H1xX56/8E+LSYePtXvEz5JtSvPTOa0P2oP2ndO+IlmngbwH5riV9rsBy+eMDHUV9Pfsb/CS9+H/gcaprcIj1C/O8f3hGw4BrPmdTFLl2RajLA5NOlW0lN6LqeB/8FA0dm00r/fWvIPhx8O/2odU8N2934Q12S10t1HlIJtuOOOMV7H+39zNpfzYw68etfZn7N3/JK9IJAH7lOn0qHSVXESTbVjs+vSwuTUmoqV299T5K+GHw4/ap0vxppl54r8QSXOmRzKZ0M24FM8jGK/TCjAor16dNQVkz85xmLliZqcopehBdf8e0n+6a/ADX9F1XxH8ddS0PSJvKvLzUpI4nJxtYtwc1+/8Adf8AHtJ/umvwTg1zT9A/aYm1fVZPKtrTVndiOmA/vXl5gk+RPufc8JTnB15QV5W0Ppib9kb4/NyniAdOnnjH8q+t/wBnP4UeO/hrZXEPjS+F5JKSVw+/Ga1x+1L8JTwNSB/Ff8a6Lwt8fPh34w1RNI0a+Elw/QZHOfxrrp06MZXi9fU8XHYrMa9NqtCy9LHzP/wUEIX4d6V1ybsAY+lZn7MvgHT/AIi/s3aj4b1JQ5uJZAjkZKMV6j3rQ/4KDlR8O9Jy20/bBj8q7P8AYXYN8Hm45+1Nn8q5eVPFST7HqOc6eSQqRdmpHxN8G/F+ufs4/GG58H66zJplxIYh5mQoQtw9ZXijV9P1r9qDRtR02ZZoJrxCGU5GC1fXv7avwRPijQx470KL/T7AZmwOTGor8y/gw0z/ABY8Oi54ZLuMc9c5ryq6nTnGilpe59xl7w+OoTx0dJ2tJeaW5+4vx2DH4HeI9vawf+VfnN/wT3ZE+I+sZwM2ZHPXO6v1d17QYPE/g650G5UNFe25jYH0Ir8TdC1zWv2a/jVdT3ls8Fh9oZWGCC0AbjaO9erivcqQqNHxWSL2+DxOEj8T1Xmfp/8AtPQ/FOXw5Yf8KuuJLe8E/wC9MZIJTHtX5s+PPiF+0x8PoopvEmt3duszbVIc4/UV+mGi/tU/CfWNJTUm1AQEruMchCtn6E1+cf7XPxmi+Ktzbjw/aypolrJtWd0Kh5l4IB6EVOMlFLnjLXsdPD+Hq+2jhq9BNa3bWp+lv7M/ibWfFnwzttW126e7unOC7nJ6V+aHxhz/AMNSaaf+nmP/ANCNfoh+yJ/ySGz5yd3P5V+ePxhC/wDDUem5JyLlDj/gRoxTboxfoVksFHH4iEdEkz9mtF/5AVn/ANcV/lX4e+CWc/tXRAcD+3H4/wCBmv3C0U50KzP/AExX+Vfh54IZf+GtUwR/yG36/wDXQ1ri435PU4MgaUMV6P8AU+k/22fgvPpd/b/FnwnG0UsRAmEQ4TYMmT65Nct4m+ONj8SP2b003UblF1WyDQlC3zOqKAGwecmv1S8UeHNO8W6De+HtVQPbX0ZjcEZ4Nfz7/G74Z618KPHGoaDdII7SVmkgK/d8tidoP4Vy45SpKU4bS0Pa4dq08w5MPiH70HeL7rsfpP8A8E/Tn4Z3ftdzf0rA/wCChfHhPRWPQXX/ALJXQ/8ABP7/AJJndHA/4+5en4Vz/wDwUMAbwloyk4P2o4/74rSy+p+92OKKS4ht/ePnL4Q/s7/F7xx4Pj1rw1q4tbORyAhl29uuK948C/stfG/w/wCMNJ1jVNcE9lZzrJIvnZyo6jGK6D9mP49/D3wj8M7fR9avvJuI5DkMQOw9a+hz+1P8JAcf2mv5r/jTw9GhyRkn+JGZYzM3VqUlD3bvp0PXPF8bR+C9Rjb7y25Br8IvBPgHxR8Qvinq2i+FLhbW6S4kYuW2kAuR1r9y9b1zT/EXw/v9V0199vNbllI9Dg1+O3wD8caF4D+N+ratr8vkwSTOm76SE85qsbFSlG70L4anXp4fEukvetse4H9kX9oArj/hIR/3/H+Ffb37Ovw78X/DTwO+heM777ffNcSSB92/CN0Gazx+1L8Jeg1JTj3X/Gu18CfGfwP8RL+XTvDV2LiaBd7AEHAzjtXXSp0Yy5oPX1Pm8ficwr0uXEQtFeVj4I/4KFD97pfHVl5/4DXlfw/+Fn7UeoeD7fU/COvvbaayhkjE204wMYGK9U/4KEjM2lc9GX/0Gvtj9nAf8Wq0fOP9Sn/oIrz3RjUxMrvofVLHvC5NQlGKbu91c/KT4ctb3Xxrh0n4+PPeTqyRR/aBuUuCR8xOPl96/cDSLfTrTTLaDSkVLRI1EQT7oQDjH4V+Uf7e/gNtD8V6d8RrF2g+0hLcBeBvQZzX3v8As5+Obbx38L9Lvrdt7Wka2zk9S8agGtsIvZ1JUn6nm57JYrDUsdT0T0ceiZ+YHxf+b9qXTPUXMf8AM1+z2if8gKz/AOuKfyr8ZPi+MftTaZj7xuI/5mv2b0T/AJAVnn/nin8qrCfxJ+ouIV+5w+nQ/DrwKWb9rGLDEY1x8+/7xq+lf21/g1caPewfFnwlG0UsZAmEY4TYMmTjuSa+afAhP/DWERJXnXZO/wD00av2+8U+G9P8XeH73w7qiB7a+jMbgjPBrGjSVSnOPmetmuPeCxuHqx25Vdd0flj4p+N9j8Rf2bk03VbhE1WyDRNHu+Z0RQA2DzzXtn/BPsZ+Gd23/T3Lj9K/Nv43fDTWfhT44v8AQb5NlrKxe3K/dMbE7Qfwr9J/+Cf67fhndA9ftcv9K48NUnPF2mtlY9LOcLQpZQ6mGd4yd/S58oft6xkfG+Bn72MP9a/WT4UsH+F3h3yDkjT4APrsFfEv7eXwrutX0608eaRbGe5tyI5ioyViRepxWd+zD+1h4c03wzB4P8bzNBc2x2RufuhBwASa7YSjSxMlPTmPAxFCpjcooyoLmcLprqcf45H7WFv4i1q4sNRuY9NjnlaHY7cR7vlHT0rD/Zz+NPxT134rQ+HPEutXNzEjhJI5GyMg4NfXfxR/al8C2Xh+50rwvI2qatfoY7dIAJB5h6btvQV+ef7M11d3fx6F3er5c81xukVuCrluRWdSfLWioTvc9HCUPbZfWnXoqLitNNT91KKKK98/IgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9P9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArn/E3h6x8UaLdaNqCB4rlCpz71f1LUrTSrV7y9kEcaDJJOK8N1/9obwfpDtFE7TMO6jIrzsVjsPhl++mkejhMJXry/cRbfkfP3h8an8NvFFz4H1zItnYtayfw7CcKuemfavavtUax5ZwPc180fFP4sQePZoXtLYQvbuGSXGG4rzqXxn4jlhEX2tsAYznrX4pmec4aNV+xd0fsuDyXFV6addWkfZk2u6RaDM91Gp92FcrqPxI8Nafl2n80jsmCK+Prm+1C6ybq4Mn41TwK+TqZ1N/Cj3aXDkV8cj6W1H4x6JLG0UUTyJJxhlryG28ZXeja22q6Gxhjc8xDhSfpXE8UfSuGWb4h/DKx7tLJMNBaxueuXHxn8T3G4ELGexUmsSb4m+LJf8Al9cZ9DXntFckswxEt5s6FleEj9hHXS+OvE0v3r+UfjWfJ4o12U/NdOSfesGu28K6PZajFJcX24eXn7ozUQqV6rspXFVpYWhG/JY5xtb1V/vXT5+tRHVNR7zt+det6J4H0zVra8ulDqIwduRzxVqLwFoSrE88rfPhccda9L6jiWtzyf7SwidrHjB1PUP+e7fnTl1XUxjFy/517+vws0cxSSl2IVdw6Vh3vhLw1Y3VvbuWy4B4A71UsBiYR5rijmeElKzjc8iGtaovS5f86tJ4m1uP7l24P1qx4ntbCwvmgsAcZ/i4rmgM1485zg7NnuUoUaqvGJ1SeN/E0XCX0g/4FVPVPE+t6wqJf3LSxxnOGPWsE9aSiONqx+GRby/DyesUei6V8SdZ0mIQQxqYsYCnNdbafGzUIsLcW67R6Zrw49aSt45nXX2jnq5Th57RPpm1+NOkSAfao5FPstdhYfEnw1qAGyXyj/tYFfG2BSjn5sbcV3wzist9TyanD1CXwux9OeLtfHiu9tvCmizKReMEd1P3Q1fZngLwtY+EfDttpdoBlVBcj+Jscmvyesru50+4F5p07W8y9GU4r0zRPjN470Vwf7QkuwP4ZWOK/QMo4soUFy1ou/dHxubcMYitaNB6LofqZRXwt4b/AGn9XN1Hba1aJsOOUyTX2nouqR6zpkGoxDCzoGAPuM1+q5dnGGx1/YSu0fluYZTicC0q8bXNaiiivdPCCiiigAooooAayq6lWGQe1fL/AMTf2T/hn8SJjdywf2Zcsxd5LdRuYnrnNfUVFRKEZ/Ernbh8VVw8uelJxfkfn1a/8E+vh7DciabWbyVR/CwXBHpX198Pfhd4Q+Gmmrp3hmxjt8DDOq4Z/c16PRURpQi7xR1YnM8ViY8tabaIpYo542ilUMjDBB6EV8ofEf8AY++GHj+5e8jjOjyysWc2ygb2PUnPrX1pRVSpxmrSVzmw2Lr4efPRm4vyPgDTv+Cf3w6tLyG5m1e7mSFgfLYLtbHY19i+CPh34T+H2nLp3hmwjtEA+YouCx7k/Wu6oqIUacPhVjoxOZYrEq1abaK9zAtzbyQMcCQYJr4P1r9gTwBretX2tXGu3qyX0zzMoC4UucnFffFFOpShU0mrmWFx2IwrboTcb9j8+B/wTz+HQOf7dvufZa9l+CP7LnhX4H6/ea/oWpXN5LeQ+SyzABQM5yMV9RUVMaFOLvGJ04jNsZiIOFWo2mfInxc/ZD8G/F3xWPFmsapdWlwI1j2xBSuF7815h/w7x+HfmGQ6/fk/Ra/QqipeGottuJpTzrHU6apwqNRXQ+HfBf7DfgXwV4r07xXY61eTT6bMsyI4XaxX1r3X42fBLQvjdodpoeu3k1nFaTecrQgEk4xg5r22ir9hT5HG2jOWeYYiVWNaUnzLZn57f8O8vh2Rhtevjz6LUq/8E9vhyBg65ekfRa/QSisVhKK0UDvefZi96rPOvhn8O9M+GXhqPwzpMzzwRnIaTGfTtXOfFH4FeBfivbMviCzRbortW4VQZFHbBNe0UV1OEWuVrQ8eOJqxq+1jJqXc/P8As/8Agn78O7a9S5k1e7mRCDsYLg+xr13xt+yn8P8Axl4RsPCEbPpdrYyCQNbqAzsBjJz619R0VisPTSaUdz0amb42pJSnUd1sedfDT4daZ8M/DUfhnSp3uII/45MbjxjtXhnxa/ZF8HfFzxOPFGsapc2s+wJtiC7cD619cUVc6NOUeWS0OSjjq9Gq6tKbUn1Pz2/4d5fDvcSdeviD2wuK3PDP7B/gDwzrdnrltrV5LLZSCRVYLgkdjX3bRULD0o7RO+ed4+acZVXZla0t1tLaK2Q5WJQoJ9qs0UV0ngNnA+Ovhv4S+ImnNp3iawjul/hZ1yVPqK+PL/8A4J9/Dq7upLiLV7uJXYsFULhc9hX6A0VhKjTm7yR6uGzLFYaLjSm0j5R+G37Inwy+Htyt60Z1e5jbcklyoLIfbFfVMUUcMaxRKFRRgAdAKlorWMIxVoo5MRiq2Ilz1ZNvzPnn4z/s8eG/jS1u2t309obZgwMQHOPrXqvgfwbY+BfDtr4c06RpYbVQoZ+pwMc4rsaKShFScktRSxNWVNUpS91bIKKKKs5RkiCRGQ9GGK+FPEn7B/gDxLr9/wCILrWrxJb+ZpmVQuAXOcCvu6isqlKFS3Or2PRwuOr4WTlQm4t9j8+f+Hevw6Byuu3wP0Wu/wDhv+xr4K+G3iSDxLpmq3VxNAQQsgXacfSvseioWHpJ3UTsrZxja0XGpUbTPE/jX8EdB+NuiW2h69dS2sVrL5qtEATnGO9avwg+E+kfB/wwfC+i3Ml1AZDJulxuyfpXq9FaKnFS57anmvE1XSVFy93exR1DT7TVbKbT76MSwTqVdW5BBr44039iX4f6V43j8b2mpXKzRXP2lYcL5YOc7R7V9q0U5QjJpyWxdDGVqCkqM2k9yGGIQxJEvIQYrx34pfAvwL8WLVk8QWirdFdq3KqDIv0Jr2iim0mrMxpVqlKanTlZ9z8/7P8A4J+fDu2vFuJNXu5kU52sFwfY16745/ZU+H/jLwfp/g2Jn0q10+QShrdRud8Yyc+tfUdFY/V6evunrTznHTnGcqjvHY86+Gnw70z4Z+GYvDGlTvcQRHO+TG48Y7V4r4m/ZN8IeJ/iDB8Q7rU7mO8gcOI1C7CQc19X0Vo4Ras0cNPGV6dSVWE2pS3fcp2tolpaR2aElYlCgn0FfIukfsb+CdI+JI+JceqXUl6t4bwRsF2bySceuOa+xqKbinujOliq1Lm9nK3No/MK+f8A41/s8+EPjdBaprkj2c9s+7zoQN7qBjac9q+gKKcoxkrSWhFCvOjNVKUrSXU8V+C3wU0T4KaBL4f0O8lu4ZJWl3SgAgt24ql8bfgPoHxv02003Xb2azS0k81WhAJJxjvXu9FQ6cHHka0NljK6rfWFN8/fqfnr/wAO8vh4Sc6/f8+y0H/gnj8Oim3+3r7Prhc1+hVFYLC0tuU9d8QZi73rPU8+8O/D/T/DvgpfBNvO8lssQi8xsbsAAZ/SvkLUv+Cf/wAPtS1G51KXXb1XuZGkIAXALHOBX39RWsqNOatJHm4fMMTh5SlSm03ufnuP+CeXw6HTXb4fgtex/Bj9lnwp8FPEFz4g0LUrm6kuohEySgBQAc54r6lopRw9KDvGJvXzfGVoOnUqNpnzt8a/2dfDfxta3Ou309p9nII8oA5wMd69X8DeDbHwL4dtfDmnytNDaqFVn6kAY7V2VFaqnFS50tTz5YmrKkqMpe6tkeR/GD4PeHvjL4fi8P8AiF2ijhcyI6AFlYjGRmqPwX+C+kfBbQpPD+i6hPeW0kjSfvscM3XpXtVFPljzc1tR/Wq3svYc3ub2Pk/xT+yZ4P8AFPxCt/iJdalcxXttIsgjULsJXP496+pLS0S0s4rNCSsShQT14q5RSjCMW3FbhWxVatGMasrqO3kfHWj/ALG/gnR/iSvxKi1S6e9S8N4IiF2b2JOPXHNfYtFFOMIx+FCr4mrXadSV2tD5++Nv7PHhD4329qmuSPZ3Fs+4TwgbyAMBTntWv8FfgronwU0CXw/ol5NexSStKWmxkFu3Fe1UVPs4c3PbU0eNruh9X53yduhnanplhrFjNpupwrcW1wpV0cZDA9jXxl4z/YZ+GfinVH1OzuJtKDnJit1UJn8a+3qKmdKE/jVysLjsRhW3Qm437Hyf8L/2Rvhz8NLpr6EvqVyfuPOoyh9VxUfg/wDZJ8H+DvH9x8QLPU7ma7nnacxuF2As27AxX1pRSVGmrWWxtPM8VJycpv3tH5hRRRW55AUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/9T9/KKKKACiiigAooooAKKKKACiiigAooooAKKK+bfi/wDFDxh8PrhJbGyjntJOAzZODXBi8XTw1J1auyO7CYWpiaip092fSVFfns/7UPjR+VsrcA+561Uf9pnxucg28Iz6E18dLjHLV9p/cfYLhDMmr8q+8+rPjlKY/BF3htvynp9K/MUZcZb5s9zXrvin4yeKvFti1hqJWOJ+oUmvI1HavyLiXNqWYV1UoXskfrHDeVTwNBwr7tirwPl6DsaXhhyMCkPPWlwcYB59q+HVrXZ91LWWmogUA8CnEetJyvEmOfTrQoLHCfMfSkk29CHK240470o56VqQaLrF7/x72UkmfRSa6jTvhn4x1MgQ6fIme7KRXoQwleppGDfyOKrjKFPWpNL5nCEY60uB617hY/s/+ObrHmRqgPqSK7Cz/Zh8Ry4NxOi/Rq9ilw/mFT4abPEq8Q5fS3qI+Xdg9a6jw74hbQ2cFFlRxyGr6jtP2WX63V2fwIrobf8AZc0QY8+7k/DFe1S4VzRO6jb5njVuKcskuWbv8j5kT4nXdsDFY26ImcketZE/ju8lVVaNQRJ5lfYqfsweFBgtdTZ+gq0P2Y/B4GDcSn3wK9dcM5s1a6+88J5/lKd1F/cfJf8AwtbUkXb5S7Sm3vWbqHj9tQaGZrZFaPAyOvFfZS/szeDQMGaVvqBTX/Zl8GN0mlH4CtXwxmrjZyX3kx4gylSvyP7j4D1C/bU52uCOaoDp0r79m/Zd8Kt/q7yZfpisyf8AZa0XB8m8lP1xXjVOD8ybvyp/M9+lxflkVZXXyPhUjsaK+yrv9lqXn7Ldk/UiuXu/2Y/E0IP2eZG/4FXDV4WzGC1hf0O+nxTls3pK3qfLtKc969wv/gB44tCSkavj0JNcRqHw08Y6aT5thLJj0UkV4lbKsXS+Om/uPZoZxhKr92a+84X2pdpHJNaNxo+sWnFzZPF/vKRWY/HXINeTKlUi9Y2PVVem2nGSY7JbkqMCk5b5lA4pBkDK4/GlwDzyD7Vi009TfmV7kkORMkhbaRX6f/DrxZ4dTwnYRT6lAsixICGcZBxX5eHGMDk+9W4bu4hXCSsvsDX2OR53PLKkp8vMpHx2d5EsyhFc/K0frqPFXhtumpQH/gYqQeJNAPTUIT/wMV+RY1fU1b5bhx+NTrr2uAokN1KWdsBQe9ffw46cnb2X4n5/LglxV/a/gfrzbapp96dtpcJKfRWBrQr5++B3hTUNL0VNT1WV5JrgZAfsDyK+ga/V8FXnXoxqVI8rfQ/LsXRhRrSpwlzJdQooorvOEKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1f38ooooAKKKKACiiigAooooAKKKKACiiigArh/HnhKy8XaBcaddICzKdjHsfWu4rwr4yfE+28G6RJZ2kgN9OCqgHlc968zMKtGnh5Sr/DbU9PA06tSvCND4r6H52a/pD6FrN3pMrbhbuyjv0rHxkZz0q5fahdareTX12S0srEsfrVQgAFc8Dmv5Eryg6snT2vof1thoTVGMam9hvOMuAQKTcB7Z6Vo6XaR32o21pIxVZmCn8a/QPwR8B/BlpYW99dx/bmlUMRKARz6V9Lk+SVsxk1T0S3Pmc4zyhl6XOrtnwRpnhvXdXYGwsZp1PdUJFevaF+zv431nZcuqW0TckOcN+VfoXpfhzRNFTy9Ls47dfRBitzGK/VsFwThqWtabkz8txnGmJq6UYqJ8gaP+y3o8CrcaxfSb15YAgrXqWlfCL4caTHGTDDMScBnA5Nek+LZZYfDt9LDnesbYxXyNJr2stoujs5k3vqYQ/wC7X2NDI8vofBTVz4+vnWOr/HUdj6qOi+DfDdr9qmht7OBf42woH41Ri+IXw4i4i12xX6SrWT8S7eG5+HF81xCs5S3LAP0zivyl8L6Ra+IfFFpHHZnYtxtkUL8hHpXvwpQjpFJHiucpaybP14/4WV8Px/zH7L/v8tNPxN+HwGT4hsh/22X/ABr4C8PfD3WJdK1Kbw14fs9RuBfyR4u1OEQemK4S6+Ffi17y6hvdCt/tHLCO3UlR9K20MWfqNpvjrwdq9wLTTNZtbqY9EjlVm/IVZ1fxf4Y0Bgmtapb2THtLIFP618Ifs6eGLuz+Kc9vrejJYtBZBkwpGSD15713/wC1Z4c1DUrewlsdKgug8gVpGBLAfh2qd9hNn0qfin8OQNx8SWOP+uy/41zviX42fD7R9NkubXxBYyzAfKvnLyfzr83fDvge7gk1BZPD8N5KkBKoyEqPcVhaV4E0vUL25g1PR18wR7toThTSaYro/ULRfjH4HvNOhnv9fsEuZlDCNZlyc+2am8AfEe28bXV8lrc28sdrIyARtlsL3NfmNrHwsi0/W9MuhpZhtUVHMmwgY9Aa+0P2UNB0i10LVr60tRHK93Ku5hhiKLPqO6Po3UPiH4H0m4NrqWu2ltMOqSSqpH4VWT4o/DuQ7Y/Edix9pl/xr4O+O3gzVL/4lxwLods8BAkWQqfnJPQmvMtF+HaXtifP0tILlr5ov3ange1OwH6kH4h+BlTzDrtoE9fNXFV/+Fm/D7OP+Ehss/8AXZa/KLUfCeseHL1tMv7JpIJZTtBU5wa9X1f4ZeOJtHRtP8L6YlmLdZPPZWExBHf3o0W4H6D/APCy/h+R/wAjBZf9/l/xrd0/UdA8Q25udMuIb6HON0ZDDP1Ffk7qvw58UWWnzX0OgK8S2wJIRsBu5FfoP+z3pCaV8PrUeQLeSUB3UDHJHNDimildHouo+HfB+oM0V/bwO4GSGAyBXDX/AMGPh7r0L/Y7eKPJILRAcGvLfENzrkXjTWRHJJsW1JUduvavRfgLeaheeHLp9QLFxcyAbuuK82pgsNWuqkE/kd1LF16XvU5NfM801z9lnT3Vn0m8fcegYgCvFvEHwA8caDG86It1GM4CfMcfSv0tpCAetfLYvhPL8RG0Y8r8j6bDcU5hRkm5c3qfjvf6DrOmbjqNjLb7epdCBWMpya/WHx/oWj3vh69murJLh1jJGVyc1+XWqWF0uoXAitWVA7YAHQZr8ez3h95daNOXMmfr2RcRf2g26iUXH8THPAzgV2/w5/skeMLF9aOLcOvXpn3rkvsGoEcW7/lTl07UgRtgk3DkHHevlcKqlGpGry3sz6rFypV6cqXNa6P2B0trVrCE2RBh2jbjpjHFaNfIHwH+JeoyInhvXY3Vk4RmHboK+vVYMoYdDX9X5ZjYYqhGpFW8ux/KuPwc8NiJU5O/mOooor1jywooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9b9/KKKKACiiigAooooAKKKKACiiigAooooAawyCB3r5t8Yfs/WvjDVpNUv9Sny5JCgjAHoK+lKK4cVg6WKh7OvG6O3DYqrhp89KVmfJI/ZV0EDH9oT8+4p4/ZV8O9DqE/5ivrOivDXDmWr/l0j2nxBmL/5es+WbL9l7w3Z3UV0t7OTEQRyO1fS+m2KabYw2MZJWFQoJ9qv0V62Ey7DYW/sIqNzy8Vj8Rire2m5WCiiivUPMIZ4IriJoZlDI4wQe9YTeFdCaOONrRCsT+Yox0b1ro6KAKN3p9pf2b2F3GJIJF2lSOCK4vSfhh4K0WQy2GmQxPv35CgHNehUUAZOm6NpukiQWECwiZi7bRjLHqamj0yxiuWu44VErjBbHJrQooAy00fTo9QbVUgUXTLsL452+lSahpllqkPkX0Syp6MM1oUUAc9aeGNDspWmt7REd12EgdR6VSHgfwqtw90mnQrJKMMQvJFddRQBg3XhvQr63S1u7KOWKP7qsvAqTR9A0jQIXt9ItktY3YsVQYGT3raooAx7/Q9L1OWOe9t1leI5UkZINUovCXh+Fg8dlGGD+Znb/F610tFAHN33hPw5qUqz3thFNInKsy5IrYaytWtvsZjHk427ccYq5RQBk3ekWlzpsulhAkUq7MAdBXO+DtA1Dw5FNYzSCW2LlkJOSAegruKKAMabQdKnne5lt0aSRdrMRyRU2m6TY6TE0NhEsKMSxCjHJrTop3AKKKKQEM0MVxE0MyhkYYINcnJ4B8JyOXfTYSWOT8tdlRWU6VOfxxTNYVJw+B2OMHw/8JDppsP/AHzTx4E8KAY/s6L/AL5rsKKxWEofyr7jX6zWf2n95y9t4O8OWcy3FtYxRyL0YLzXTAbQAOgp1FdEacIK0VYxnOUneTuFFFFWZhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB//9f9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9D9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9H9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9L9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9P9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9T9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9k='; }
function pdfWrap(doc,text,x,y,maxWidth,lineHeight=5,fontSize=9){
  doc.setFontSize(fontSize); const lines=doc.splitTextToSize(String(text??''),maxWidth); lines.forEach((line,i)=>doc.text(line,x,y+i*lineHeight));
  return y+Math.max(1,lines.length)*lineHeight;
}
function pdfLine(doc,x1,y,x2){doc.line(x1,y,x2,y)}
function pdfHeader(doc,logo){
  const W=420;
  try{doc.addImage(logo,'JPEG',18,10,62,22)}catch(e){}
  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('SIDDHANT COLLEGE OF ENGINEERING',W/2,18,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text('Student Feedback Response Report',W/2,27,{align:'center'});
  pdfLine(doc,18,35,W-18);
}
function pdfLine(doc,x1,y,x2){doc.line(x1,y,x2,y)}
function pdfWrap(doc,text,x,y,maxWidth,lineHeight=5,fontSize=9){
  doc.setFontSize(fontSize);
  const lines=doc.splitTextToSize(String(text??''),maxWidth);
  lines.forEach((line,i)=>doc.text(line,x,y+i*lineHeight));
  return y+Math.max(1,lines.length)*lineHeight;
}
function pdfResponseMeta(doc,meta){
  let y=44; const left=20,right=215; const row=8; doc.setFontSize(9);
  const pairs=[
    ['Academic Year',meta.academic_year||'—','Feedback Cycle',meta.cycle_name||'—'],
    ['Year Level',meta.year_level||'—','Division',meta.division||'—'],
    ['Faculty',meta.faculty_name||'—','Subject',meta.subject||'—'],
    ['Faculty Code',meta.faculty_code||'—','Students Responded',String(meta.students||0)],
    ['Feedback Window',meta.date_range||'—','Department',meta.department||'Computer Engineering']
  ];
  pairs.forEach(r=>{
    doc.setFont('helvetica','bold');doc.text(r[0]+':',left,y);
    doc.setFont('helvetica','normal');pdfWrap(doc,r[1],left+38,y,145,4,9);
    doc.setFont('helvetica','bold');doc.text(r[2]+':',right,y);
    doc.setFont('helvetica','normal');pdfWrap(doc,r[3],right+43,y,140,4,9);
    y+=row;
  });
  return y+4;
}
function formatPdfDateTime(value){
  if(!value)return '—';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value);
  return d.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function pdfResponseMatrix(doc,feedbacks,answersByFeedback,questions,meta,logo){
  const W=420,x=12,right=W-12;
  let y=meta.y;
  const idW=28,timeW=38,qW=25,totalW=22,avgW=22,pctW=22,srW=9;
  const tableW=srW+idW+timeW+(questions.length*qW)+totalW+avgW+pctW;
  const tableX=Math.max(x,(W-tableW)/2);
  const headerH=10,rowH=8;
  const drawHeader=()=>{
    doc.setFillColor(245,239,234);doc.rect(tableX,y,tableW,headerH,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(7);
    let xx=tableX;
    ['#','Student ID','Submitted'].forEach((h,i)=>{
      const ww=[srW,idW,timeW][i];doc.text(h,xx+ww/2,y+6,{align:'center'});xx+=ww;
    });
    questions.forEach((q,i)=>{doc.text('Q'+(i+1),xx+qW/2,y+6,{align:'center'});xx+=qW});
    doc.text('Total',xx+totalW/2,y+6,{align:'center'});xx+=totalW;
    doc.text('Avg /5',xx+avgW/2,y+6,{align:'center'});xx+=avgW;
    doc.text('%',xx+pctW/2,y+6,{align:'center'});
    y+=headerH;
  };
  const drawRow=(fb,idx)=>{
    let xx=tableX;
    const answers=answersByFeedback.get(Number(fb.id))||[];
    const byQ=new Map(answers.map(a=>[Number(a.question_id),a]));
    const scores=questions.map(q=>{const a=byQ.get(Number(q.id));return a&&a.rating!==null&&a.rating!==undefined?Number(a.rating):null});
    const answered=scores.filter(v=>v!==null);
    const total=answered.reduce((s,v)=>s+v,0), out=answered.length*5, pct=out?total/out*100:0;
    const cells=[
      [String(idx+1),srW],
      [String(fb.student_id||fb.student_login_id||'—'),idW],
      [formatPdfDateTime(fb.submitted_at),timeW],
      ...scores.map(v=>[v===null?'—':String(v),qW]),
      [String(total),totalW],
      [answered.length?(total/answered.length).toFixed(2):'—',avgW],
      [pct?pct.toFixed(1)+'%':'—',pctW]
    ];
    doc.setFont('helvetica','normal');doc.setFontSize(7);
    cells.forEach(([v,ww],j)=>{
      doc.rect(xx,y,ww,rowH);
      doc.text(String(v),xx+ww/2,y+5.3,{align:'center'});
      xx+=ww;
    });
    y+=rowH;
  };
  const ensureSpace=(needed)=>{
    if(y+needed>274){
      doc.addPage();pdfHeader(doc,logo);y=43;drawHeader();
      return true;
    }
    return false;
  };
  drawHeader();
  feedbacks.forEach((fb,i)=>{ensureSpace(rowH);drawRow(fb,i)});
  y+=4;
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('Question Key / Maximum Score',tableX,y);y+=6;
  doc.setFont('helvetica','normal');doc.setFontSize(7.5);
  questions.forEach((q,i)=>{
    const text='Q'+(i+1)+': '+q.question_text+' (Max 5)';
    if(y>274){doc.addPage();pdfHeader(doc,logo);y=43}
    y=pdfWrap(doc,text,tableX,y,tableW,3.5,7.5)+2;
  });
  // Faculty-level average for each question across all submitted students.
  if(y+18>274){doc.addPage();pdfHeader(doc,logo);y=43}
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('Overall Faculty Question Averages',tableX,y);y+=6;
  const qAverages=questions.map(q=>{
    const vals=feedbacks.flatMap(fb=>(answersByFeedback.get(Number(fb.id))||[]))
      .filter(a=>Number(a.question_id)===Number(q.id)&&a.rating!==null&&a.rating!==undefined)
      .map(a=>Number(a.rating));
    const avg=vals.length?vals.reduce((sum,v)=>sum+v,0)/vals.length:0;
    return {q,avg,n:vals.length};
  });
  const avgCols=5, avgCellW=tableW/avgCols, avgRowH=9;
  doc.setFont('helvetica','normal');doc.setFontSize(7.5);
  for(let start=0;start<qAverages.length;start+=avgCols){
    if(y+avgRowH>274){doc.addPage();pdfHeader(doc,logo);y=43;doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('Overall Faculty Question Averages (continued)',tableX,y);y+=6;doc.setFont('helvetica','normal');doc.setFontSize(7.5)}
    qAverages.slice(start,start+avgCols).forEach((item,j)=>{
      const xx=tableX+j*avgCellW;
      doc.rect(xx,y,avgCellW,avgRowH);
      doc.setFont('helvetica','bold');doc.text('Q'+item.q.position,xx+3,y+4);
      doc.setFont('helvetica','normal');doc.text(item.n?item.avg.toFixed(2)+'/5':'—',xx+avgCellW-3,y+4,{align:'right'});
      doc.setFontSize(6.5);doc.text(item.n+' responses',xx+3,y+7.2);doc.setFontSize(7.5);
    });
    y+=avgRowH;
  }
  y+=3;
  const comments=feedbacks.filter(x=>x.comment&&String(x.comment).trim());
  if(comments.length){
    if(y+15>274){doc.addPage();pdfHeader(doc,logo);y=43}
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('Student Comments',tableX,y);y+=6;
    comments.forEach((fb)=>{
      if(y>272){doc.addPage();pdfHeader(doc,logo);y=43;doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('Student Comments (continued)',tableX,y);y+=6}
      doc.setFont('helvetica','bold');doc.setFontSize(7.5);
      doc.text(String(fb.student_id||fb.student_login_id||'—')+' · '+formatPdfDateTime(fb.submitted_at),tableX,y);
      y=pdfWrap(doc,String(fb.comment),tableX+55,y,tableW-55,3.5,7.5)+3;
    });
  }
  return y;
}
function pdfFooter(doc){
  const W=420;
  const y=286;
  doc.setFont('helvetica','normal');doc.setFontSize(8);
  doc.text('HOD',70,y,{align:'center'});doc.text('Director',210,y,{align:'center'});doc.text('Dean Academics',350,y,{align:'center'});
  doc.setFontSize(7);doc.setTextColor(110);
  doc.text('Siddhant College of Engineering · Student Feedback Response Report',W/2,294,{align:'center'});
  doc.setTextColor(0);
}
function pdfSectionTitle(doc,title,subtitle){
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text(title,24,30);
  if(subtitle){doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(subtitle,24,37);}
  doc.setDrawColor(180);doc.line(24,41,396,41);doc.setDrawColor(0);
}
function pdfBarChart(doc,items,x,y,w,h,title,maxValue=5){
  pdfSectionTitle(doc,title);
  const top=y+14,left=x+35,right=x+w-8,bottom=y+h-12;
  doc.setFont('helvetica','normal');doc.setFontSize(7);
  doc.line(left,bottom,right,bottom);doc.line(left,top,left,bottom);
  const n=items.length||1, gap=(right-left)/n, barW=Math.min(20,gap*0.55);
  items.forEach((it,i)=>{
    const val=Math.max(0,Number(it.value)||0), bh=(bottom-top)*(val/maxValue), bx=left+i*gap+(gap-barW)/2;
    doc.setFillColor(167,25,36);doc.rect(bx,bottom-bh,barW,bh,'F');doc.setFillColor(0);
    doc.text(String(it.label).slice(0,18),bx+barW/2,bottom+5,{align:'center'});
    doc.setFont('helvetica','bold');doc.text(val.toFixed(2),bx+barW/2,bottom-bh-2,{align:'center'});doc.setFont('helvetica','normal');
  });
  for(let i=0;i<=5;i++){const yy=bottom-(bottom-top)*i/5;doc.text((maxValue*i/5).toFixed(1),left-3,yy+2,{align:'right'});doc.setDrawColor(225);doc.line(left,yy,right,yy);doc.setDrawColor(0)}
}
function pdfTable(doc,headers,rows,x,y,widths,rowH=8,fontSize=7){
  let yy=y;
  const drawRow=(vals,bold=false,fill=false)=>{
    let xx=x;doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(fontSize);
    vals.forEach((v,i)=>{const ww=widths[i];if(fill){doc.setFillColor(245,239,234);doc.rect(xx,yy,ww,rowH,'F');doc.setFillColor(0)}doc.rect(xx,yy,ww,rowH);doc.text(String(v??'—').slice(0,80),xx+ww/2,yy+5.3,{align:'center'});xx+=ww});yy+=rowH;
  };
  drawRow(headers,true,true);rows.forEach(r=>drawRow(r));return yy;
}
function pdfHeatmap(doc,rows,cols,x,y,w){
  pdfSectionTitle(doc,'Faculty × Question Heatmap','Average rating per question, on a 1–5 scale');
  const nameW=62,qW=(w-nameW)/cols.length,rowH=10;let yy=y+14;
  let xx=x;doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.rect(xx,yy,nameW,rowH);doc.text('Faculty / Subject',xx+3,yy+6);xx+=nameW;
  cols.forEach((q,i)=>{doc.rect(xx,yy,qW,rowH);doc.text('Q'+(i+1),xx+qW/2,yy+6,{align:'center'});xx+=qW});yy+=rowH;
  rows.forEach(r=>{xx=x;doc.setFont('helvetica','normal');doc.rect(xx,yy,nameW,rowH);doc.text(String(r.label).slice(0,32),xx+2,yy+6);xx+=nameW;r.values.forEach(v=>{const n=Number(v)||0;const shade=Math.round(255-((n/5)*100));doc.setFillColor(255,Math.max(130,shade),Math.max(130,shade));doc.rect(xx,yy,qW,rowH,'F');doc.setFillColor(0);doc.rect(xx,yy,qW,rowH);doc.text(n?n.toFixed(2):'—',xx+qW/2,yy+6,{align:'center'});xx+=qW});yy+=rowH;if(yy>275){doc.addPage();pdfHeader(doc,null);pdfSectionTitle(doc,'Faculty × Question Heatmap (continued)');yy=55}});
  return yy;
}
async function generateScoeFeedbackPdf(b,facultyRows,questionRows){
  try{
    if(!b.feedback.length){toast('No submitted feedback available for PDF generation.');return}
    if(!window.jspdf?.jsPDF) throw new Error('PDF engine failed to load. Refresh the page and try again.');
    const {jsPDF}=window.jspdf;
    const logo=await imageDataUrl('assets/scoe-logo.jpeg');
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true});
    const fm=new Map(b.faculty.map(f=>[Number(f.id),f])), cm=new Map(b.cycles.map(c=>[Number(c.id),c]));
    const answersByFeedback=new Map();
    b.answers.forEach(a=>{if(!answersByFeedback.has(Number(a.feedback_id)))answersByFeedback.set(Number(a.feedback_id),[]);answersByFeedback.get(Number(a.feedback_id)).push(a)});
    const groups=new Map();
    b.feedback.forEach(f=>{const key=Number(f.cycle_id)+'|'+Number(f.faculty_id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f)});
    const allRatings=b.answers.filter(a=>a.rating!==null&&a.rating!==undefined).map(a=>Number(a.rating));
    const overallAvg=allRatings.length?allRatings.reduce((a,v)=>a+v,0)/allRatings.length:0;
    const activeStudents=b.students.filter(s=>s.active).length;
    const uniqueStudents=new Set(b.feedback.map(f=>f.student_id||f.student_login_id)).size;
    const responseRate=activeStudents?(uniqueStudents/activeStudents*100):0;
    const qRows=b.questions.filter(q=>q.active).sort((a,c)=>a.position-c.position).map(q=>{const vals=b.answers.filter(a=>Number(a.question_id)===Number(q.id)&&a.rating!==null&&a.rating!==undefined).map(a=>Number(a.rating));const avg=vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:0;return {q,avg,n:vals.length}});
    const facultyStats=[];
    for(const [key,fs] of groups){const [cycleId,facultyId]=key.split('|').map(Number),f=fm.get(facultyId);if(!f)continue;const vals=fs.flatMap(fb=>(answersByFeedback.get(Number(fb.id))||[]).filter(a=>a.rating!==null&&a.rating!==undefined).map(a=>Number(a.rating)));facultyStats.push({f,avg:vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:0,n:fs.length,vals})}
    const divisionMap=new Map();
    facultyStats.forEach(s=>{const d=s.f.division||'ALL';if(!divisionMap.has(d))divisionMap.set(d,[]);divisionMap.get(d).push(s)});

    // 1. Cover / Executive Summary
    pdfHeader(doc,logo);doc.setFont('helvetica','bold');doc.setFontSize(24);doc.text('Student Feedback Intelligence Report',210,62,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(11);doc.text('Siddhant College of Engineering · Detailed Student Feedback Analysis',210,70,{align:'center'});
    const cards=[['Active Students',activeStudents],['Students Responded',uniqueStudents],['Response Rate',responseRate.toFixed(1)+'%'],['Feedback Entries',b.feedback.length],['Total Ratings',allRatings.length],['Overall Average',overallAvg.toFixed(2)+' / 5']];
    cards.forEach((r,i)=>{const xx=i%3===0?42:i%3===1?156:270,yy=92+Math.floor(i/3)*30;doc.setDrawColor(215);doc.roundedRect(xx,yy,105,22,3,3);doc.setDrawColor(0);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(r[0],xx+7,yy+8);doc.setFontSize(14);doc.text(String(r[1]),xx+98,yy+15,{align:'right'})});
    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('Report Contents',42,165);doc.setFont('helvetica','normal');doc.setFontSize(10);
    ['Executive summary','Overall question analysis','Faculty performance overview','Faculty × question heatmap','Rating distribution','Division / subject analysis','Faculty-wise detailed responses','Student comments','Questionnaire and methodology'].forEach((t,i)=>doc.text(`${i+1}. ${t}`,48,174+i*7));
    pdfFooter(doc);

    // 2. Overall question analysis
    doc.addPage();pdfHeader(doc,logo);pdfBarChart(doc,qRows.map(x=>({label:'Q'+x.q.position,value:x.avg})),35,45,350,115,'Overall Question Average',5);
    let y=168;const rows=qRows.map(x=>['Q'+x.q.position,x.q.question_text,x.n,x.avg?x.avg.toFixed(2):'—',x.avg?(x.avg/5*100).toFixed(1)+'%':'—']);
    y=pdfTable(doc,['Q','Question','Responses','Avg /5','%'],rows,24,y,[12,250,28,35,35],8,6.5);pdfFooter(doc);

    // 3. Faculty overview
    doc.addPage();pdfHeader(doc,logo);pdfBarChart(doc,facultyStats.map(x=>({label:x.f.full_name,value:x.avg})),30,45,360,115,'Faculty Average Score',5);
    const frows=facultyStats.map(x=>[x.f.full_name,x.f.subject||'—',x.f.division||'ALL',x.n,x.avg.toFixed(2),((x.avg/5)*100).toFixed(1)+'%']);
    pdfTable(doc,['Faculty','Subject','Div','Responses','Avg /5','%'],frows,20,168,[110,115,30,35,38,38],8,6.5);pdfFooter(doc);

    // 4. Heatmap
    doc.addPage();pdfHeader(doc,logo);
    const heatRows=facultyStats.map(x=>{const fs=groups.get([...groups.keys()].find(k=>Number(k.split('|')[1])===Number(x.f.id))||'')||[];const vals=qRows.map(q=>{const v=fs.flatMap(fb=>(answersByFeedback.get(Number(fb.id))||[])).filter(a=>Number(a.question_id)===Number(q.q.id)&&a.rating!=null).map(a=>Number(a.rating));return v.length?v.reduce((s,n)=>s+n,0)/v.length:0});return {label:(x.f.full_name+' · '+(x.f.subject||'')),values:vals}});
    pdfHeatmap(doc,heatRows,qRows.map(x=>x.q),24,50,372);pdfFooter(doc);

    // 5. Rating distribution
    doc.addPage();pdfHeader(doc,logo);const dist=[1,2,3,4,5].map(n=>({label:String(n),value:allRatings.filter(v=>v===n).length}));
    pdfBarChart(doc,dist,55,50,310,110,'Overall Rating Distribution',Math.max(1,...dist.map(x=>x.value)));
    const distRows=[5,4,3,2,1].map(n=>{const c=allRatings.filter(v=>v===n).length;return ['Rating '+n,c,allRatings.length?(c/allRatings.length*100).toFixed(1)+'%':'—']});
    pdfTable(doc,['Rating','Responses','Share'],distRows,130,172,[80,70,70],9,8);pdfFooter(doc);

    // 6. Division analysis
    doc.addPage();pdfHeader(doc,logo);const drows=[...divisionMap.entries()].map(([d,arr])=>{const vals=arr.flatMap(x=>x.vals);const av=vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:0;return [d,arr.reduce((s,x)=>s+x.n,0),av.toFixed(2),((av/5)*100).toFixed(1)+'%']});
    pdfBarChart(doc,drows.map(r=>({label:r[0],value:Number(r[2])})),60,50,300,100,'Division Average',5);pdfTable(doc,['Division','Feedback Entries','Avg /5','%'],drows,125,165,[70,80,70,70],9,8);pdfFooter(doc);

    // 7+. Detailed faculty reports and student responses
    for(const [key,feedbacksRaw] of groups){
      const [cycleId,facultyId]=key.split('|').map(Number),c=cm.get(cycleId),f=fm.get(facultyId);if(!f||!c)continue;
      const feedbacks=[...feedbacksRaw].sort((a,b)=>new Date(a.submitted_at||0)-new Date(b.submitted_at||0));
      const questions=b.questions.filter(q=>q.active&&q.year_level===f.year_level).sort((a,b)=>a.position-b.position);
      doc.addPage();pdfHeader(doc,logo);
      const students=new Set(feedbacks.map(x=>x.student_id||x.student_login_id));
      const meta={academic_year:(c.name||'').match(/20\d{2}-\d{2}/)?.[0]||'',cycle_name:c.name,year_level:f.year_level,division:f.division,faculty_name:f.full_name,faculty_code:f.faculty_code,subject:f.subject,students:students.size,date_range:`${c.start_date||'—'} - ${c.end_date||'—'}`,department:f.department_code};
      const py=pdfResponseMeta(doc,meta);
      const sectionRatings=feedbacks.flatMap(fb=>(answersByFeedback.get(Number(fb.id))||[]).filter(a=>a.rating!=null).map(a=>Number(a.rating)));
      const sectionAvg=sectionRatings.length?sectionRatings.reduce((s,v)=>s+v,0)/sectionRatings.length:0;
      doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(`Overall Faculty Average: ${sectionAvg.toFixed(2)} / 5`,210,py+5,{align:'center'});
      pdfResponseMatrix(doc,feedbacks,answersByFeedback,questions,{y:py+11},logo);pdfFooter(doc);
    }

    // Final methodology page
    doc.addPage();pdfHeader(doc,logo);pdfSectionTitle(doc,'Questionnaire & Methodology');
    let my=55;doc.setFont('helvetica','normal');doc.setFontSize(9);
    qRows.forEach(x=>{my=pdfWrap(doc,`Q${x.q.position}. ${x.q.question_text} · Maximum score: 5`,24,my,360,4.5,9)+4;if(my>268){doc.addPage();pdfHeader(doc,logo);pdfSectionTitle(doc,'Questionnaire & Methodology (continued)');my=55}});
    my+=3;my=pdfWrap(doc,'Calculation notes: averages are calculated from submitted numeric ratings only. Percentage is average divided by 5. Student names are omitted from the response report; Student ID and exact submission date/time are retained. Response rate uses active students as the denominator.',24,my,360,4.5,9);
    pdfFooter(doc);
    doc.save('siddhant_college_student_feedback_intelligence_report.pdf');
    toast(`Comprehensive PDF generated: ${groups.size} faculty/cycle sections`);
  }catch(e){toast('PDF generation failed: '+(e?.message||e));console.error(e)}
}

function toCsv(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]);const q=v=>`"${String(v??'').replaceAll('"','""')}"`;return [keys.map(q).join(','),...rows.map(r=>keys.map(k=>q(r[k])).join(','))].join('\n')}
function downloadBlob(text,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}


window.addEventListener('DOMContentLoaded',()=>{
  const observer=new MutationObserver(()=>{
    if(document.getElementById('feedbackForm')) ensureFeedbackProgressUI();
  });
  observer.observe(document.body,{childList:true,subtree:true});
  if(document.getElementById('feedbackForm')) ensureFeedbackProgressUI();
});
