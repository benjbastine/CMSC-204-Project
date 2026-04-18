/* ===========================
   JUST DO IT — app.js
   Smart Task Scheduling System
=========================== */

/* ══════════════════════════════
   USER STORE
══════════════════════════════ */
function getUsers()        { return JSON.parse(localStorage.getItem('jdi_users')   || '[]'); }
function saveUsers(u)      { localStorage.setItem('jdi_users', JSON.stringify(u)); }
function getCurrentUser()  { return JSON.parse(localStorage.getItem('jdi_current') || 'null'); }
function setCurrentUser(u) { localStorage.setItem('jdi_current', JSON.stringify(u)); }

/* ══════════════════════════════
   TASK / DATA STORE (per user)
══════════════════════════════ */
function storageKey(type) {
  const u = getCurrentUser();
  return u ? `jdi_${type}_${u.username}` : null;
}
function getTasks()     { const k=storageKey('tasks');    return k ? JSON.parse(localStorage.getItem(k)||'null') || starterTasks() : starterTasks(); }
function saveTasks(t)   { const k=storageKey('tasks');    if (k) localStorage.setItem(k, JSON.stringify(t)); }
function getComplete()  { const k=storageKey('complete'); return k ? JSON.parse(localStorage.getItem(k)||'[]') : []; }
function saveComplete(c){ const k=storageKey('complete'); if (k) localStorage.setItem(k, JSON.stringify(c)); }
function getArchive()   { const k=storageKey('archive');  return k ? JSON.parse(localStorage.getItem(k)||'[]') : []; }
function saveArchive(a) { const k=storageKey('archive');  if (k) localStorage.setItem(k, JSON.stringify(a)); }
function getCategories(){ const k=storageKey('cats');     return k ? JSON.parse(localStorage.getItem(k)||'null') || defaultCats() : defaultCats(); }
function saveCats(c)    { const k=storageKey('cats');     if (k) localStorage.setItem(k, JSON.stringify(c)); }
function getTheme()     { return localStorage.getItem('jdi_theme') || 'light'; }
function saveTheme(t)   { localStorage.setItem('jdi_theme', t); }

/* Starter task — one task for every new user, due date = account creation date */
function starterTasks() {
  return [
    { id:0, summary:'Say Hello World!', due:todayStr(), status:'To do', priority:'Low', category:'Personal', profit:10, deadline:1 }
  ];
}
function defaultCats() { return ['None','Personal','Academic','Work','Chores']; }

/* Next available numeric ID (excluding id 0 starter) */
function nextTaskId() {
  const allIds = [...tasks.map(t=>t.id), ...complete.map(t=>t.id), ...archive.map(t=>t.id)].filter(id=>id>0);
  if (!allIds.length) return 1;
  return Math.max(...allIds) + 1;
}

/* Compute live overdue status */
function computedStatus(task) {
  if (task.status === 'Done') return 'Done';
  if (!task.due) return task.status;
  if (task.due < todayStr() && task.status !== 'Done') return 'Overdue';
  return task.status;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* Live state */
let tasks      = [];
let complete   = [];
let archive    = [];
let categories = [];

/* Pending list edits — changes held until "Update List" is pressed */
let pendingEdits = {}; // { taskId: { field: value, ... } }

/* ══════════════════════════════
   DARK MODE
══════════════════════════════ */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const label   = document.getElementById('themeLabel');
  const iconMoon= document.getElementById('iconMoon');
  const iconSun = document.getElementById('iconSun');
  if (label)    label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  if (iconMoon) iconMoon.style.display = theme === 'dark' ? 'none'  : 'block';
  if (iconSun)  iconSun.style.display  = theme === 'dark' ? 'block' : 'none';
}

function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveTheme(next);
  closeAllDropdowns();

  // Refresh chart so it picks up new colors
  if (document.getElementById('page-home').classList.contains('active')) {
    renderHome();
  }
}

/* ══════════════════════════════
   AUTH
══════════════════════════════ */
function showAuthScreen(id) {
  document.querySelectorAll('.auth-screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById('authWrapper').classList.remove('hidden');
  document.getElementById('appWrapper').classList.add('hidden');
}

function showAppScreen() {
  document.getElementById('authWrapper').classList.add('hidden');
  document.getElementById('appWrapper').classList.remove('hidden');
}

function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  const user = getUsers().find(u => u.username === username && u.password === password);
  if (!user) { errEl.textContent = 'Invalid username or password.'; return; }
  setCurrentUser(user);
  loadUserData();
  applyTheme(getTheme());
  showAppScreen();
  showPage('home');
  updateAvatarLabel();
  toast(`Welcome back, ${user.name || user.username}!`);
}

function doRegister() {
  const name     = document.getElementById('regName').value.trim();
  const gender   = document.getElementById('regGender').value;
  const birthday = document.getElementById('regBirthday').value;
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regConfirm').value;
  const errEl    = document.getElementById('regError');
  errEl.textContent = '';
  if (!name || !username || !password || !confirm) { errEl.textContent = 'Please fill in all required fields.'; return; }
  if (password !== confirm) { errEl.textContent = 'Passwords do not match.'; return; }
  if (password.length < 4)  { errEl.textContent = 'Password must be at least 4 characters.'; return; }
  const users = getUsers();
  if (users.find(u => u.username === username)) { errEl.textContent = 'Username already taken.'; return; }
  const newUser = { name, gender, birthday, username, password };
  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);
  loadUserData();
  applyTheme(getTheme());
  showAppScreen();
  showPage('home');
  updateAvatarLabel();
  toast(`Account created! Welcome, ${name}!`);
}

function doLogout() {
  closeAllDropdowns();
  confirmAction('Are you sure you want to log out?', () => {
    setCurrentUser(null);
    // Reset theme to light on logout
    applyTheme('light');
    localStorage.removeItem('jdi_theme');
    ['loginUsername','loginPassword'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('loginError').textContent = '';
    showAuthScreen('pageLogin');
  });
}

function openProfile() {
  const u = getCurrentUser();
  if (!u) return;
  document.getElementById('profName').value     = u.name || '';
  document.getElementById('profUsername').value = u.username || '';
  document.getElementById('profPassword').value = '';
  document.getElementById('profConfirm').value  = '';
  document.getElementById('profError').textContent = '';
  setSelectValue('profGender', u.gender);
  const pb = document.getElementById('profBirthday');
  if (pb) pb.value = u.birthday || '';
  updateProfileInitials();
  document.querySelectorAll('.auth-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('pageProfile').classList.add('active');
  document.getElementById('authWrapper').classList.remove('hidden');
  document.getElementById('appWrapper').classList.add('hidden');
}

function updateProfileInitials() {
  const nameEl = document.getElementById('profName');
  const initEl = document.getElementById('profileInitials');
  if (!initEl) return;
  const name   = nameEl ? nameEl.value.trim() : '';
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    initEl.textContent = parts.length >= 2
      ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
      : name[0].toUpperCase();
  } else {
    const u = getCurrentUser();
    initEl.textContent = u ? (u.name || u.username || 'U')[0].toUpperCase() : 'U';
  }
}

function doUpdateProfile() {
  const name     = document.getElementById('profName').value.trim();
  const gender   = document.getElementById('profGender').value;
  const birthday = document.getElementById('profBirthday').value;
  const username = document.getElementById('profUsername').value.trim();
  const password = document.getElementById('profPassword').value;
  const confirm  = document.getElementById('profConfirm').value;
  const errEl    = document.getElementById('profError');
  errEl.textContent = '';
  if (!name || !username) { errEl.textContent = 'Name and username are required.'; return; }
  if (password && password !== confirm) { errEl.textContent = 'Passwords do not match.'; return; }
  if (password && password.length < 4)  { errEl.textContent = 'Password must be at least 4 characters.'; return; }
  const users   = getUsers();
  const curUser = getCurrentUser();
  const idx     = users.findIndex(u => u.username === curUser.username);
  if (username !== curUser.username && users.find(u => u.username === username)) {
    errEl.textContent = 'Username already taken.'; return;
  }
  const updated = { ...curUser, name, gender, birthday, username, password: password || curUser.password };
  if (idx >= 0) users[idx] = updated; else users.push(updated);
  saveUsers(users);
  setCurrentUser(updated);
  updateAvatarLabel();
  showAppScreen();
  toast('Profile updated!');
}

function setSelectValue(id, val) {
  const sel = document.getElementById(id);
  if (!sel || !val) return;
  for (const opt of sel.options) { if (opt.value === val) { sel.value = val; return; } }
}

function loadUserData() {
  tasks      = getTasks();
  complete   = getComplete();
  archive    = getArchive();
  categories = getCategories();
  pendingEdits = {};
  renderCategorySelects();
}

function updateAvatarLabel() {
  const u   = getCurrentUser();
  const btn = document.getElementById('avatarBtn');
  if (!u || !btn) return;
  const name  = u.name || u.username || 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  btn.textContent = parts.length >= 2
    ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
    : name[0].toUpperCase();
}

/* ══════════════════════════════
   NAVIGATION
══════════════════════════════ */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  const nav = document.getElementById('nav-'+name);
  if (nav) nav.classList.add('active');
  closeAllDropdowns();
  if (name === 'home')     renderHome();
  if (name === 'list')   { pendingEdits = {}; renderList(); }
  if (name === 'complete') renderComplete();
  if (name === 'calendar') renderCalendar();
  if (name === 'archive')  renderArchive();
}

/* Sidebar — hidden by default (starts collapsed) */
let sidebarVisible = false;
function toggleSidebar() {
  sidebarVisible = !sidebarVisible;
  document.getElementById('sidebar').classList.toggle('collapsed', !sidebarVisible);
  document.getElementById('mainContent').classList.toggle('full', !sidebarVisible);
}

function toggleDropdown(id) {
  const menu    = document.getElementById(id);
  const wasOpen = menu.classList.contains('open');
  closeAllDropdowns();
  if (!wasOpen) menu.classList.add('open');
}
function closeAllDropdowns() { document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open')); }

document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown-wrap')) closeAllDropdowns();
});

function handleSearch(val) {
  const v = val.trim().toLowerCase();
  if (!v) return;
  showPage('list');
  renderList(v);
}

/* ══════════════════════════════
   HOME
══════════════════════════════ */
let chartInst = null;
function renderHome() {
  const u = getCurrentUser();
  document.getElementById('homeGreeting').textContent = `Hello, ${u ? (u.name || u.username) : 'Username'}!`;

  const displayed  = tasks.map(t => ({ ...t, status: computedStatus(t) }));
  // Include completed tasks (in the Complete page) in the Done count
  const done       = displayed.filter(t => t.status === 'Done').length + complete.length;
  const inprogress = displayed.filter(t => t.status === 'In progress').length;
  const inreview   = displayed.filter(t => t.status === 'In review').length;
  const todo       = displayed.filter(t => t.status === 'To do').length;
  const overdue    = displayed.filter(t => t.status === 'Overdue').length;
  const total      = (displayed.length + complete.length) || 1;

  document.getElementById('statCards').innerHTML = [
    { num:done,       label:'done in the last 7 days',    color:'#2db97d', bg:'rgba(45,185,125,.13)',  icon:'✔' },
    { num:inprogress, label:'in progress',                color:'#4a90e2', bg:'rgba(74,144,226,.13)', icon:'✎' },
    { num:todo,       label:'to do',                      color:'#7b2fbe', bg:'rgba(123,47,190,.13)', icon:'✚' },
    { num:overdue,    label:'overdue tasks',               color:'#e05b5b', bg:'rgba(224,91,91,.13)',  icon:'ⴵ' },
  ].map(c=>`
    <div class="stat-card">
      <div class="stat-icon" style="background:${c.bg};color:${c.color}">${c.icon}</div>
      <div>
        <div class="stat-num" style="color:${c.color}">${c.num}</div>
        <div class="stat-label">${c.label}</div>
      </div>
    </div>`).join('');

  const isDark   = document.documentElement.getAttribute('data-theme') === 'dark';
  const textCol  = isDark ? '#e8eaf6' : '#1a1a2e';
  const gridCol  = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
  const ctx      = document.getElementById('statusChart').getContext('2d');
  const data     = [done, inprogress, inreview, todo];
  const labels   = ['Done','In progress','In review','To do'];
  const colors   = ['#2db97d','#4a90e2','#f5a623','#c8cad4'];
  if (chartInst) chartInst.destroy();
  chartInst = new Chart(ctx, {
    type: 'pie',
    data: { labels, datasets:[{ data, backgroundColor:colors, borderWidth:2,
      borderColor: isDark ? '#1e2130' : '#fff' }] },
    options: {
      responsive: false,
      plugins: {
        legend:{ display:false },
        tooltip:{ callbacks:{ label: c => ` ${c.label}: ${((c.raw/total)*100).toFixed(1)}%` } }
      }
    }
  });
  document.getElementById('chartLegend').innerHTML = labels.map((l,i)=>`
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      <span class="legend-label">${l}</span>
      <span class="legend-count">${data[i]}</span>
    </div>`).join('');
}

/* ══════════════════════════════
   ALGORITHMS
══════════════════════════════ */
function priorityProfit(p) { return {'High':30,'Medium':20,'Low':10}[p]||10; }

function runGreedy() {
  const list = tasks.map((t,i)=>({...t, profit:priorityProfit(t.priority), deadline:i+1}));
  const r    = greedySchedule(list);
  showAlgoResult('Greedy Algorithm', r, list.length);
}
function runBruteForce() {
  const list = tasks.map((t,i)=>({...t, profit:priorityProfit(t.priority), deadline:i+1}));
  if (list.length > 18) {
    const el = document.getElementById('algoResult');
    el.classList.add('show');
    el.innerHTML = '<strong>Brute-Force</strong><br/>Too many tasks (max 18). Use Greedy instead.';
    return;
  }
  const r = bruteForceSchedule(list);
  showAlgoResult('Brute-Force', r, list.length);
}
function showAlgoResult(title, r, total) {
  const el  = document.getElementById('algoResult');
  el.classList.add('show');
  const lines = r.scheduled.map(t=>`  • [#${t.id}] ${t.summary} (${t.priority})`).join('\n');
  el.innerHTML = `<strong>${title} Results</strong><br/><pre>
Scheduled (${r.scheduled.length}/${total}):
${lines||'  (none)'}

Total Score : ${r.totalProfit}
Time        : ${r.timeMs} ms</pre>`;
}
function greedySchedule(list) {
  const t0=performance.now(), sorted=[...list].sort((a,b)=>b.profit-a.profit);
  const maxD=Math.max(...list.map(t=>t.deadline),0), slots=new Array(maxD+1).fill(null), sched=[];
  for(const task of sorted){ for(let d=task.deadline;d>=1;d--){ if(!slots[d]){slots[d]=task;sched.push(task);break;} } }
  return {scheduled:sched,totalProfit:sched.reduce((s,t)=>s+t.profit,0),timeMs:(performance.now()-t0).toFixed(3)};
}
function bruteForceSchedule(list) {
  const t0=performance.now(),n=list.length;let best={scheduled:[],totalProfit:0};
  for(let mask=0;mask<(1<<n);mask++){const sub=list.filter((_,i)=>mask&(1<<i));if(isFeasible(sub)){const p=sub.reduce((s,t)=>s+t.profit,0);if(p>best.totalProfit)best={scheduled:sub,totalProfit:p};}}
  return{...best,timeMs:(performance.now()-t0).toFixed(3)};
}
function isFeasible(subset){
  if(!subset.length)return true;
  const sorted=[...subset].sort((a,b)=>a.deadline-b.deadline),maxD=Math.max(...subset.map(t=>t.deadline)),slots=new Array(maxD+1).fill(false);
  for(const t of sorted){let placed=false;for(let d=t.deadline;d>=1;d--){if(!slots[d]){slots[d]=true;placed=true;break;}}if(!placed)return false;}
  return true;
}

/* ══════════════════════════════
   LIST — with pending edits
══════════════════════════════ */
function renderList(filter='') {
  const prioOrder = {'High':0,'Medium':1,'Low':2};
  let visible = [...tasks].sort((a,b)=>{
    const pd=(prioOrder[a.priority]??9)-(prioOrder[b.priority]??9);
    return pd!==0 ? pd : a.id-b.id;
  });
  if (filter) {
    visible = visible.filter(t=>
      String(t.id).includes(filter)||
      t.summary.toLowerCase().includes(filter)||
      (t.category||'').toLowerCase().includes(filter)||
      t.status.toLowerCase().includes(filter)||
      t.priority.toLowerCase().includes(filter)
    );
  }

  document.getElementById('taskTableBody').innerHTML = visible.map(t => {
    const realIdx = tasks.findIndex(x=>x.id===t.id);
    // Apply any pending edit to display
    const pending = pendingEdits[t.id] || {};
    const dueVal  = pending.due      !== undefined ? pending.due      : t.due;
    const priVal  = pending.priority !== undefined ? pending.priority : t.priority;
    const catVal  = pending.category !== undefined ? pending.category : t.category;
    let   stVal   = pending.status   !== undefined ? pending.status   : t.status;
    const displayStatus = (stVal==='Done') ? 'Done' : computedStatus({...t,...pending});

    const statusHtml = displayStatus === 'Overdue'
      ? `<span class="badge s-overdue">Overdue</span>`
      : `<select class="badge ${statusClass(displayStatus)}"
           onchange="setPending(${t.id},'status',this.value);this.className='badge '+statusClass(this.value)">
           ${['In progress','In review','Done','To do'].map(s=>
             `<option value="${s}" ${s===displayStatus?'selected':''}>${s}</option>`).join('')}
         </select>`;

    return `<tr>
      <td><strong>#${t.id}</strong></td>
      <td>${t.summary}</td>
      <td><input type="date" class="date-input" value="${dueVal}"
            onchange="setPending(${t.id},'due',this.value)" /></td>
      <td>${statusHtml}</td>
      <td>
        <select class="badge ${priorityClass(priVal)}"
          onchange="setPending(${t.id},'priority',this.value);this.className='badge '+priorityClass(this.value)">
          ${['High','Medium','Low'].map(p=>`<option value="${p}" ${p===priVal?'selected':''}>${p}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="cat-select"
          onchange="setPending(${t.id},'category',this.value)">
          ${categories.map(c=>`<option value="${c}" ${c===catVal?'selected':''}>${c}</option>`).join('')}
        </select>
      </td>
      <td>
        <button class="badge a-remove" onclick="confirmRemoveTask(${realIdx})">Remove</button>
      </td>
    </tr>`;
  }).join('');
}

/* Record a pending change without saving yet */
function setPending(taskId, field, value) {
  if (!pendingEdits[taskId]) pendingEdits[taskId] = {};
  pendingEdits[taskId][field] = value;
}

/* "Update List" button — commit all pending edits */
function updateList() {
  if (!Object.keys(pendingEdits).length) { toast('No changes to save.'); return; }

  const doneIds = [];
  for (const [id, edits] of Object.entries(pendingEdits)) {
    const idx = tasks.findIndex(t => String(t.id) === String(id));
    if (idx < 0) continue;
    Object.assign(tasks[idx], edits);
    // If set to Done → will move to complete
    if (tasks[idx].status === 'Done') doneIds.push(tasks[idx].id);
  }
  pendingEdits = {};

  // Move Done tasks to complete list
  if (doneIds.length) {
    doneIds.forEach(id => {
      const idx = tasks.findIndex(t => t.id === id);
      if (idx >= 0) complete.push(tasks.splice(idx, 1)[0]);
    });
    saveComplete(complete);
    toast(`${doneIds.length} task(s) moved to Complete`);
  } else {
    toast('List updated!');
  }

  saveTasks(tasks);
  renderList();
  renderHome();
}

function confirmRemoveTask(i) {
  confirmAction(`Move task #${tasks[i].id} "${tasks[i].summary}" to Archive?`, () => {
    // Discard any pending edits for this task
    delete pendingEdits[tasks[i].id];
    archive.push(tasks.splice(i,1)[0]);
    saveTasks(tasks); saveArchive(archive);
    renderList(); renderHome();
    toast('Task moved to archive.');
  });
}

/* ══════════════════════════════
   COMPLETE PAGE
══════════════════════════════ */
function renderComplete() {
  const prioOrder = {'High':0,'Medium':1,'Low':2};
  const sorted = [...complete].sort((a,b)=>{
    const pd=(prioOrder[a.priority]??9)-(prioOrder[b.priority]??9);
    return pd!==0 ? pd : a.id-b.id;
  });

  document.getElementById('completeBody').innerHTML = sorted.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">No completed tasks yet.</td></tr>`
    : sorted.map(t => {
        const origIdx = complete.findIndex(x=>x.id===t.id);
        return `<tr>
          <td><strong>#${t.id}</strong></td>
          <td>${t.summary}</td>
          <td><span class="date-chip">${t.due ? formatDate(t.due) : '—'}</span></td>
          <td><span class="badge s-done">Done</span></td>
          <td><span class="badge ${priorityClass(t.priority)}">${t.priority}</span></td>
          <td>${t.category||'—'}</td>
          <td>
            <button class="badge a-return" onclick="returnToList(${origIdx})">Return</button>
          </td>
        </tr>`;
      }).join('');
}

function returnToList(i) {
  confirmAction(`Return task #${complete[i].id} "${complete[i].summary}" back to List?`, () => {
    const t = complete.splice(i, 1)[0];
    t.status = 'To do';
    tasks.push(t);
    saveTasks(tasks); saveComplete(complete);
    renderComplete(); renderHome();
    toast('Task returned to List.');
  });
}

function returnAllToList() {
  if (!complete.length) return;
  confirmAction('Return ALL completed tasks back to List?', () => {
    complete.forEach(t => { t.status = 'To do'; tasks.push(t); });
    complete = [];
    saveTasks(tasks); saveComplete(complete);
    renderComplete(); renderHome();
    toast('All completed tasks returned to List.');
  });
}

/* ══════════════════════════════
   CALENDAR
══════════════════════════════ */
let calYear=new Date().getFullYear(), calMonth=new Date().getMonth();

function initCalendarSelectors() {
  const months  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const ms      = document.getElementById('calMonthSel');
  ms.innerHTML  = months.map((m,i)=>`<option value="${i}" ${i===calMonth?'selected':''}>${m}</option>`).join('');
  const ys      = document.getElementById('calYearSel');
  ys.innerHTML  = '';
  for (let y=calYear-10; y<=calYear+10; y++) {
    const o=document.createElement('option');
    o.value=y; o.textContent=y;
    if(y===calYear)o.selected=true;
    ys.appendChild(o);
  }
}

function updateCalendarSelectors() {
  const ms = document.getElementById('calMonthSel');
  const ys = document.getElementById('calYearSel');
  if (ms) ms.value = calMonth;
  if (ys) {
    if (![...ys.options].find(o=>parseInt(o.value)===calYear)) initCalendarSelectors();
    else ys.value = calYear;
  }
}

function onCalMonthSel() { calMonth = parseInt(document.getElementById('calMonthSel').value); renderCalendarGrid(); }
function onCalYearSel()  { calYear  = parseInt(document.getElementById('calYearSel').value);  renderCalendarGrid(); }

function renderCalendar()  { initCalendarSelectors(); renderCalendarGrid(); }
function changeMonth(d)    { calMonth+=d; if(calMonth>11){calMonth=0;calYear++;}if(calMonth<0){calMonth=11;calYear--;} renderCalendarGrid(); updateCalendarSelectors(); }

function renderCalendarGrid() {
  updateCalendarSelectors();
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMon=new Date(calYear,calMonth+1,0).getDate();
  let html=days.map(d=>`<div class="cal-day-header">${d}</div>`).join('');
  for(let i=0;i<firstDay;i++) html+=`<div class="cal-cell empty"></div>`;
  for(let d=1;d<=daysInMon;d++){
    const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayTasks=tasks.filter(t=>t.due===ds);
    const chips=dayTasks.map(t=>{
      const status=computedStatus(t);
      const cls=status==='Overdue'?'chip-overdue':calChipClass(t.priority);
      return `<button class="cal-chip ${cls}" onclick="showTaskPopup(${t.id})">#${t.id}</button>`;
    }).join('');
    html+=`<div class="cal-cell"><span class="cal-num">${d}</span><div class="cal-tasks">${chips}</div></div>`;
  }
  document.getElementById('calendarGrid').innerHTML=html;
}

function calChipClass(p){return{'High':'chip-high','Medium':'chip-medium','Low':'chip-low'}[p]||'chip-low';}

function showTaskPopup(taskId){
  const t=tasks.find(x=>x.id===taskId);if(!t)return;
  const status=computedStatus(t);
  document.getElementById('popupTitle').textContent=`[#${t.id}] ${t.summary}`;
  document.getElementById('popupBody').innerHTML=`
    <div><strong>Due Date:</strong> ${t.due?formatDate(t.due):'—'}</div>
    <div><strong>Status:</strong> ${status}</div>
    <div><strong>Priority:</strong> ${t.priority}</div>
    <div><strong>Category:</strong> ${t.category||'—'}</div>`;
  document.getElementById('taskPopup').classList.remove('hidden');
}
function closePopup(){ document.getElementById('taskPopup').classList.add('hidden'); }

/* ══════════════════════════════
   MANAGE — ADD TASK
══════════════════════════════ */
function renderCategorySelects() {
  const sel = document.getElementById('mCategory');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="" disabled selected>Select Category</option>` +
    categories.map(c=>`<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
}

function promptNewCategory() {
  const name = window.prompt('Enter new category name:');
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  if (!categories.includes(trimmed)) {
    categories.push(trimmed);
    saveCats(categories);
    renderCategorySelects();
    toast(`Category "${trimmed}" added.`);
  }
  document.getElementById('mCategory').value = trimmed;
}

function deleteSelectedCategory() {
  const sel = document.getElementById('mCategory');
  const val = sel.value;
  if (!val) { toast('Please select a category to delete.'); return; }
  if (val === 'None') { toast('"None" is a default category and cannot be deleted.'); return; }
  confirmAction(`Delete category "${val}"? All tasks using this category will be set to "None".`, () => {
    categories = categories.filter(c => c !== val);
    saveCats(categories);
    // Reassign all tasks using this category to 'None'
    let changed = 0;
    tasks.forEach(t => { if (t.category === val) { t.category = 'None'; changed++; } });
    complete.forEach(t => { if (t.category === val) { t.category = 'None'; } });
    archive.forEach(t => { if (t.category === val) { t.category = 'None'; } });
    if (changed) { saveTasks(tasks); saveComplete(complete); saveArchive(archive); }
    renderCategorySelects();
    toast(`Category "${val}" deleted. ${changed ? changed + ' task(s) updated to "None".' : ''}`);
  });
}

function addTask() {
  const idVal    = document.getElementById('mTaskId').value.trim();
  const due      = document.getElementById('mDueDate').value;
  const priority = document.getElementById('mPriority').value;
  const category = document.getElementById('mCategory').value;
  const summary  = document.getElementById('mSummary').value.trim();
  if (!due || !priority || !summary) { toast('Please fill in all required fields.'); return; }

  let id;
  if (idVal !== '') {
    id = parseInt(idVal);
    if (isNaN(id) || id < 1) { toast('Task # must be a positive number.'); return; }
    if (tasks.find(t=>t.id===id)||complete.find(t=>t.id===id)||archive.find(t=>t.id===id)) {
      toast(`Task #${id} already exists. Choose a different number.`); return;
    }
  } else {
    id = nextTaskId();
  }

  const status = due < todayStr() ? 'Overdue' : 'To do';
  const cat    = category || 'None';
  tasks.push({ id, summary, due, status, priority, category: cat, profit:priorityProfit(priority), deadline:tasks.length+1 });
  saveTasks(tasks);
  resetForm();
  toast(`Task #${id} added!`);
}

function resetForm() {
  ['mTaskId','mDueDate','mSummary'].forEach(f=>document.getElementById(f).value='');
  document.getElementById('mPriority').value='';
  document.getElementById('mCategory').value='';
}

/* ══════════════════════════════
   ARCHIVE
══════════════════════════════ */
function renderArchive() {
  document.getElementById('archiveBody').innerHTML = archive.length === 0
    ? `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">Archive is empty.</td></tr>`
    : archive.map((t,i)=>`
    <tr>
      <td><strong>#${t.id}</strong></td>
      <td>${t.summary}</td>
      <td><span class="date-chip">${t.due?formatDate(t.due):'—'}</span></td>
      <td><span class="badge ${priorityClass(t.priority)}">${t.priority}</span></td>
      <td>${t.category||'—'}</td>
      <td style="display:flex;gap:.4rem;flex-wrap:wrap;">
        <button class="badge a-restore" onclick="confirmRestoreTask(${i})">Restore</button>
        <button class="badge a-delete"  onclick="confirmDeleteTask(${i})">Delete</button>
      </td>
    </tr>`).join('');
}

function confirmRestoreTask(i) {
  confirmAction(`Restore task #${archive[i].id} "${archive[i].summary}" back to your list?`, () => {
    tasks.push(archive.splice(i,1)[0]);
    saveTasks(tasks); saveArchive(archive);
    renderArchive(); toast('Task restored.');
  });
}
function confirmDeleteTask(i) {
  confirmAction(`Permanently delete task #${archive[i].id}? This cannot be undone.`, () => {
    archive.splice(i,1); saveArchive(archive); renderArchive();
    toast('Task permanently deleted.');
  });
}
function restoreAll() {
  if (!archive.length) return;
  confirmAction('Restore ALL archived tasks to your list?', () => {
    tasks.push(...archive.splice(0)); saveTasks(tasks); saveArchive(archive);
    renderArchive(); toast('All tasks restored.');
  });
}
function deleteAll() {
  if (!archive.length) return;
  confirmAction('Permanently delete ALL archived tasks? This cannot be undone.', () => {
    archive=[]; saveArchive(archive); renderArchive(); toast('Archive cleared.');
  });
}

/* ══════════════════════════════
   CONFIRM MODAL
══════════════════════════════ */
let _confirmCb = null;
function confirmAction(msg, cb) {
  _confirmCb = cb;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmModal').classList.remove('hidden');
}
function closeConfirm(ok) {
  document.getElementById('confirmModal').classList.add('hidden');
  if (ok && _confirmCb) _confirmCb();
  _confirmCb = null;
}

/* ══════════════════════════════
   HELPERS
══════════════════════════════ */
function formatDate(s){
  if(!s)return'';
  const d=new Date(s+'T00:00:00');
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function statusClass(s){
  return{'Overdue':'s-overdue','In progress':'s-inprogress','In review':'s-inreview','Done':'s-done','To do':'s-todo'}[s]||'s-todo';
}
function priorityClass(p){
  return{'High':'p-high','Medium':'p-medium','Low':'p-low'}[p]||'';
}
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),2800);
}

/* ══════════════════════════════
   INIT
══════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme immediately
  applyTheme(getTheme());

  const user = getCurrentUser();
  if (user) {
    loadUserData();
    showAppScreen();
    showPage('home');
    updateAvatarLabel();
  } else {
    showAuthScreen('pageLogin');
  }
});
