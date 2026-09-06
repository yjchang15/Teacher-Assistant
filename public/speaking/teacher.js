/* eslint-disable @typescript-eslint/no-unused-vars */
// 老師專區：讀取練習紀錄、顯示統計、匯出 CSV
const state = {
  records: [],
  summary: [],
  classes: [],
  editingClassId: null,
  articles: [],
  scoreClass: null, // null = 還沒選過，交給 renderClassPicker 決定預設值
};

const $ = (id) => document.getElementById(id);

function authHeaders() {
  return {};
}

async function api(path, options = {}) {
  return fetch(path, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function scoreClass(score) {
  return score >= 85 ? 'good' : score >= 60 ? 'mid' : 'low';
}

// ====== 頁籤 ======

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
  try {
    localStorage.setItem('teacherTab', name);
  } catch (e) {
    /* 瀏覽器擋住儲存也沒關係，只是下次會回到第一個頁籤 */
  }
}

function restoreTab() {
  let name = null;
  try {
    name = localStorage.getItem('teacherTab');
  } catch (e) {
    /* 忽略 */
  }
  const exists = name && document.querySelector(`.tab-btn[data-tab="${name}"]`);
  switchTab(exists ? name : 'scores');
}

// 頁籤上的數字，讓老師不用切過去也知道有多少筆
function setTabCount(id, count) {
  const el = $(id);
  if (el) el.textContent = count ? String(count) : '';
}

// ====== 進入頁面：主系統已用安全 Cookie 完成老師登入 ======

async function init() {
  return showDashboard();
}

function showPinGate(message) {
  $('pinCard').hidden = false;
  $('dashboard').hidden = true;
  if (message) {
    $('pinError').hidden = false;
    $('pinError').textContent = message;
  }
  $('pinInput').focus();
}

async function submitPin() {
  const pin = $('pinInput').value.trim();
  if (!pin) return;
  state.pin = pin;
  const res = await api('/api/teacher/auth');
  if (!res.ok) {
    state.pin = '';
    sessionStorage.removeItem('teacherPin');
    return showPinGate('密碼錯誤，請再試一次。');
  }
  sessionStorage.setItem('teacherPin', pin);
  $('pinCard').hidden = true;
  showDashboard();
}

async function showDashboard() {
  $('dashboard').hidden = false;
  restoreTab();
  // 名冊要先載好，成績頁的班級選單才知道有哪些班可選
  await loadClasses();
  // 其餘一次載齊，切頁籤才不會每次都要等
  await Promise.all([loadRecords(), loadArticles()]);
}

// ====== 載入與繪製 ======

function showLoading(el) {
  el.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'loading';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  box.append(spinner, document.createTextNode('載入中...'));
  el.appendChild(box);
}

// 沒有資料時給一句話說明下一步，不要只留空白
function emptyState(icon, text) {
  const box = document.createElement('div');
  box.className = 'empty-state';
  const iconEl = document.createElement('div');
  iconEl.className = 'empty-icon';
  iconEl.textContent = icon;
  const textEl = document.createElement('p');
  textEl.textContent = text;
  box.append(iconEl, textEl);
  return box;
}

async function loadRecords() {
  showLoading($('detailList'));
  const res = await api('/api/teacher/records');
  if (res.status === 401) {
    window.location.replace('/login?next=/speaking/teacher.html');
    return;
  }
  if (!res.ok) {
    $('detailCount').textContent = '讀取紀錄失敗，請確認伺服器是否正常執行。';
    return;
  }
  const data = await res.json();
  state.records = data.records;
  state.summary = data.summary;

  renderClassPicker();
  renderSummary();
  renderStudentFilter();
  renderDetails();
}

// 老師教好幾個班，成績一定要先講清楚是哪一班
function renderClassPicker() {
  const select = $('scoreClass');
  const current = state.scoreClass;

  // 名冊上的班級 + 紀錄裡出現過但名冊上沒有的班級
  const names = state.classes.map((c) => c.name);
  for (const s of state.summary) {
    if (s.className && !names.includes(s.className)) names.push(s.className);
  }
  const hasNoClass = state.summary.some((s) => !s.className);

  select.innerHTML = '';
  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = '全部班級';
  select.appendChild(all);

  for (const name of names) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
  if (hasNoClass) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '未分班（自己輸入名字的）';
    select.appendChild(opt);
  }

  // 重新整理後保留原本選的班；第一次進來時，名冊上只有一個班就直接選它
  if (current !== null && [...select.options].some((o) => o.value === current)) {
    select.value = current;
  } else if (state.classes.length === 1) {
    select.value = state.classes[0].name;
  } else {
    select.value = 'all';
  }
  state.scoreClass = select.value;
}

function selectedClass() {
  return state.scoreClass === null ? 'all' : state.scoreClass;
}

function summaryForSelectedClass() {
  const wanted = selectedClass();
  if (wanted === 'all') return state.summary;
  return state.summary.filter((s) => (s.className || '') === wanted);
}

function renderSummary() {
  const rows = summaryForSelectedClass();
  const showClassColumn = selectedClass() === 'all';

  // 「全部班級」時才需要班級欄，看單一班級就不必重複顯示
  const head = $('summaryHead');
  const hasClassColumn = head.firstElementChild.textContent === '班級';
  if (showClassColumn && !hasClassColumn) {
    const th = document.createElement('th');
    th.textContent = '班級';
    head.insertBefore(th, head.firstElementChild);
  } else if (!showClassColumn && hasClassColumn) {
    head.removeChild(head.firstElementChild);
  }

  renderClassStats(rows);
  $('emptyHint').hidden = rows.some((s) => s.lastAt);

  const tbody = $('summaryTable').querySelector('tbody');
  tbody.innerHTML = '';

  for (const s of rows) {
    const tr = document.createElement('tr');
    const practiced = !!s.lastAt;
    if (!practiced) tr.className = 'row-idle';

    const cells = [
      s.student,
      s.readingCount,
      s.readingAvg ?? '—',
      s.readingBest ?? '—',
      s.conversationCount,
      s.conversationTurns,
      practiced ? formatTime(s.lastAt) : '尚未練習',
    ];
    if (showClassColumn) cells.unshift(s.className || '未分班');

    const avgIndex = showClassColumn ? 3 : 2;
    cells.forEach((value, i) => {
      const td = document.createElement('td');
      td.textContent = value;
      if (i === avgIndex && s.readingAvg !== null) td.className = 'score-cell ' + scoreClass(s.readingAvg);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}

// 一眼看出這個班練了沒：練過幾人、平均幾分、誰還沒做
function renderClassStats(rows) {
  const box = $('classStats');
  box.innerHTML = '';
  if (rows.length === 0) return;

  const practiced = rows.filter((s) => s.lastAt);
  const scored = rows.filter((s) => s.readingAvg !== null);
  const avg = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + s.readingAvg, 0) / scored.length)
    : null;

  const stats = [
    { label: '已練習', value: `${practiced.length} / ${rows.length} 人` },
    { label: '朗讀平均分', value: avg === null ? '—' : String(avg), cls: avg === null ? '' : scoreClass(avg) },
    { label: '尚未練習', value: `${rows.length - practiced.length} 人` },
  ];

  for (const stat of stats) {
    const item = document.createElement('div');
    item.className = 'stat-item';
    const value = document.createElement('div');
    value.className = 'stat-value ' + (stat.cls || '');
    value.textContent = stat.value;
    const label = document.createElement('div');
    label.className = 'stat-label';
    label.textContent = stat.label;
    item.append(value, label);
    box.appendChild(item);
  }
}

function renderStudentFilter() {
  const select = $('studentFilter');
  const current = select.value;
  select.innerHTML = '<option value="all">全部學生</option>';
  // 只列出目前班級的學生，一次 30 人的下拉才不會太長
  const visible = summaryForSelectedClass();
  for (const s of visible) {
    const opt = document.createElement('option');
    opt.value = s.student;
    opt.textContent = s.student;
    select.appendChild(opt);
  }
  // 重新整理後盡量保留老師原本選的學生
  select.value = [...select.options].some((o) => o.value === current) ? current : 'all';
}

function filteredRecords() {
  const className = selectedClass();
  const student = $('studentFilter').value;
  const type = $('typeFilter').value;

  return state.records.filter(
    (r) =>
      (className === 'all' || (r.className || '') === className) &&
      (student === 'all' || r.student === student) &&
      (type === 'all' || r.type === type)
  );
}

function renderDetails() {
  const list = $('detailList');
  list.innerHTML = '';
  const records = filteredRecords();
  $('detailCount').textContent = records.length ? `共 ${records.length} 筆（新的在前）` : '';

  if (records.length === 0) {
    list.appendChild(
      emptyState('📋', state.records.length === 0
        ? '還沒有任何練習紀錄。學生完成一次朗讀或結束一次對話後就會出現在這裡。'
        : '這個條件下沒有紀錄，換個班級或學生看看。')
    );
    return;
  }

  for (const r of records) {
    list.appendChild(r.type === 'reading' ? readingRow(r) : conversationRow(r));
  }
}

function rowShell(r, badgeText) {
  const item = document.createElement('div');
  item.className = 'detail-item';

  const head = document.createElement('div');
  head.className = 'detail-head';

  const who = document.createElement('span');
  who.className = 'detail-who';
  who.textContent = r.className ? `${r.className} · ${r.student}` : r.student;

  const badge = document.createElement('span');
  badge.className = 'tag';
  badge.textContent = badgeText;

  const time = document.createElement('span');
  time.className = 'detail-time';
  time.textContent = formatTime(r.createdAt);

  head.append(who, badge, time);
  item.appendChild(head);
  return item;
}

function readingRow(r) {
  const item = rowShell(r, '朗讀');

  const score = document.createElement('span');
  score.className = 'detail-score ' + scoreClass(r.score);
  score.textContent = r.score;
  item.querySelector('.detail-head').appendChild(score);

  const target = document.createElement('p');
  target.className = 'detail-target';
  target.textContent = r.target;

  const heard = document.createElement('p');
  heard.className = 'detail-heard';
  heard.textContent = `聽到：${r.heard || '（沒有聽到內容）'}`;

  item.append(target, heard);
  return item;
}

function conversationRow(r) {
  const item = rowShell(r, `對話 · ${r.scenarioTitle || r.scenarioId}`);

  const meta = document.createElement('p');
  meta.className = 'detail-heard';
  const levelNames = { 1200: '基礎', 2000: '標準', 3500: '進階' };
  const level = r.conversationLevel
    ? ` · ${levelNames[r.conversationLevel] || ''}（${r.conversationLevel} 單字）`
    : '';
  meta.textContent = `學生說了 ${r.userTurnCount} 輪${level}`;
  item.appendChild(meta);

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = '看逐字稿與 AI 回饋';
  details.appendChild(summary);

  const log = document.createElement('div');
  log.className = 'chat-log mini';
  for (const turn of r.turns || []) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + (turn.role === 'model' ? 'ai' : 'user');
    bubble.textContent = turn.text;
    log.appendChild(bubble);
  }
  details.appendChild(log);

  if (r.feedback) {
    const fb = document.createElement('p');
    fb.className = 'feedback-box';
    fb.textContent = r.feedback;
    details.appendChild(fb);
  }

  item.appendChild(details);
  return item;
}

// ====== 朗讀文章 ======

async function loadArticles() {
  const res = await api('/api/teacher/articles');
  if (!res.ok) return;
  const data = await res.json();
  state.articles = data.articles || [];
  renderArticles();
}

function renderArticles() {
  $('articleInfo').textContent = state.articles.length ? `共 ${state.articles.length} 篇` : '尚未設定';
  const list = $('articleList');
  list.innerHTML = '';
  if (!state.articles.length) {
    list.appendChild(emptyState('📄', '還沒有文章，請在上方貼上內容並新增。'));
    return;
  }
  state.articles.forEach((article, index) => list.appendChild(articleCard(article, index)));
}

function articleCard(article, index) {
  const card = document.createElement('div');
  card.className = 'article-card';
  const head = document.createElement('div');
  head.className = 'article-card-head';
  const title = document.createElement('strong');
  title.textContent = `文章 #${index + 1}`;
  const meta = document.createElement('span');
  const words = article.text.split(/\s+/).filter(Boolean).length;
  meta.className = 'class-count';
  meta.textContent = article.updatedAt ? `${words} 字 · ${formatTime(article.updatedAt)} 更新` : `${words} 字`;
  const remove = document.createElement('button');
  remove.className = 'danger-btn';
  remove.textContent = '刪除';
  remove.onclick = () => deleteArticle(article, index);
  head.append(title, meta, remove);
  const input = document.createElement('textarea');
  input.rows = 6;
  input.value = article.text;
  input.setAttribute('aria-label', `文章 #${index + 1} 內容`);
  const save = document.createElement('button');
  save.className = 'secondary-btn';
  save.textContent = '儲存文章';
  save.onclick = () => saveArticle(article.id, input.value);
  card.append(head, input, save);
  return card;
}

function showArticleMessage(text, error = false) {
  const message = $('articleError');
  message.hidden = !text;
  message.className = error ? 'warning' : 'hint';
  message.textContent = text;
}

async function addArticle() {
  const text = $('newArticleInput').value.trim();
  if (!text) return showArticleMessage('請先貼上文章內容。', true);
  const res = await api('/api/teacher/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return showArticleMessage(data.error || '新增失敗，請再試一次。', true);
  $('newArticleInput').value = '';
  state.articles = data.articles;
  renderArticles();
  showArticleMessage(`已新增文章 #${state.articles.length}。`);
}

async function saveArticle(id, text) {
  const res = await api(`/api/teacher/articles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return showArticleMessage(data.error || '儲存失敗，請再試一次。', true);
  state.articles = data.articles;
  renderArticles();
  showArticleMessage('文章已儲存。');
}

async function deleteArticle(article, index) {
  if (!confirm(`確定要刪除「文章 #${index + 1}」嗎？`)) return;
  const res = await api(`/api/teacher/articles/${article.id}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return showArticleMessage(data.error || '刪除失敗，請再試一次。', true);
  state.articles = data.articles;
  renderArticles();
  showArticleMessage('文章已刪除，其餘文章已重新編號。');
}

// ====== 班級管理 ======

async function loadClasses() {
  const res = await api('/api/teacher/classes');
  if (res.status === 401) {
    window.location.replace('/login?next=/speaking/teacher.html');
    return;
  }
  if (!res.ok) return;
  state.classes = (await res.json()).classes || [];
}

function showClassError(message) {
  const box = $('classFormError');
  box.hidden = !message;
  box.textContent = message || '';
}

function renderClassList() {
  setTabCount('tabCountRoster', state.classes.length);
  const list = $('classList');
  list.innerHTML = '';

  if (state.classes.length === 0) {
    list.appendChild(emptyState('👥', '還沒有班級。在上面填班級名稱與人數，按「＋ 新增班級」。'));
    return;
  }

  for (const cls of state.classes) list.appendChild(classCard(cls));
}

function classCard(cls) {
  const card = document.createElement('div');
  card.className = 'class-card';

  const head = document.createElement('div');
  head.className = 'class-card-head';

  const name = document.createElement('input');
  name.type = 'text';
  name.className = 'class-card-name';
  name.value = cls.name;
  name.maxLength = 30;
  name.setAttribute('aria-label', '班級名稱');

  const save = document.createElement('button');
  save.className = 'class-save-btn';
  save.textContent = '儲存';
  save.onclick = () => saveClass(cls.id, name.value, cls.seats);
  name.onkeydown = (event) => {
    if (event.key === 'Enter') save.click();
  };

  const count = document.createElement('span');
  count.className = 'class-count';
  count.textContent = `共 ${cls.seats.length} 個座號`;

  const remove = document.createElement('button');
  remove.className = 'danger-btn';
  remove.textContent = '🗑 刪除班級';
  remove.onclick = () => deleteClass(cls);

  head.append(name, save, count, remove);

  const seats = document.createElement('div');
  seats.className = 'seat-chips';

  for (const seat of cls.seats) {
    const chip = document.createElement('span');
    chip.className = 'seat-chip';
    const numericSeat = Number.parseInt(seat, 10);
    chip.append(document.createTextNode(Number.isFinite(numericSeat) ? String(numericSeat) : seat));

    const del = document.createElement('button');
    del.className = 'seat-x';
    del.textContent = '✕';
    del.title = `移除座號 ${seat}`;
    del.setAttribute('aria-label', `移除座號 ${seat}`);
    del.onclick = () => saveClass(cls.id, cls.name, cls.seats.filter((n) => n !== seat));

    chip.appendChild(del);
    seats.appendChild(chip);
  }

  const addBox = document.createElement('div');
  addBox.className = 'seat-add-box';

  const addInput = document.createElement('input');
  addInput.type = 'text';
  addInput.inputMode = 'numeric';
  addInput.maxLength = 4;
  addInput.value = String(Number.parseInt(nextSeat(cls.seats), 10));
  addInput.setAttribute('aria-label', '要新增的座號');

  const add = document.createElement('button');
  add.className = 'seat-add';
  add.textContent = '＋';
  add.title = '新增座號';
  add.setAttribute('aria-label', '新增座號');
  add.onclick = () => {
    const seat = addInput.value.trim();
    if (seat) saveClass(cls.id, cls.name, [...cls.seats, seat]);
  };
  addInput.onkeydown = (event) => {
    if (event.key === 'Enter') add.click();
  };
  addBox.append(addInput, add);
  seats.appendChild(addBox);

  card.append(head, seats);
  return card;
}

// 補號碼時接續目前最大的座號
function nextSeat(seats) {
  const numbers = seats.map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return String(next).padStart(2, '0');
}

async function addClass() {
  showClassError('');
  const res = await api('/api/teacher/classes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: $('newClassName').value,
      count: $('newClassCount').value,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return showClassError(data.error || '新增失敗，請再試一次。');

  $('newClassName').value = '';
  await loadClasses();
}

async function saveClass(id, name, seats) {
  showClassError('');
  const res = await api(`/api/teacher/classes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, seats }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return showClassError(data.error || '儲存失敗，請再試一次。');
  await loadClasses();
}

async function deleteClass(cls) {
  if (!confirm(`確定要刪除「${cls.name}」嗎？\n（已經留下的練習紀錄不會被刪掉）`)) return;
  const res = await api(`/api/teacher/classes/${cls.id}`, { method: 'DELETE' });
  if (res.ok) await loadClasses();
}

// ====== 匯出與清空 ======

// 用 fetch 下載才能帶密碼標頭，不必把密碼放進網址
async function downloadFile(path, filename) {
  const res = await api(path);
  if (!res.ok) {
    alert('匯出失敗，請重新整理頁面後再試一次。');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function clearRecords() {
  if (!confirm('確定要清空所有練習紀錄嗎？\n（系統會先在 Supabase 留下完整備份）')) return;
  const res = await api('/api/teacher/records', { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    $('clearResult').textContent = `清空失敗：${data.error || '未知錯誤'}`;
    return;
  }
  $('clearResult').textContent = data.backup
    ? `已清空 ${data.cleared} 筆紀錄，Supabase 備份 ID：${data.backup}`
    : '目前沒有紀錄可以清空。';
  await loadRecords();
}

// ====== 事件綁定 ======

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

$('pinBtn')?.addEventListener('click', submitPin);
$('pinInput')?.addEventListener('keydown', (e) => e.key === 'Enter' && submitPin());
$('refreshBtn').addEventListener('click', () =>
  Promise.all([loadRecords(), loadClasses(), loadArticles()])
);
$('addArticleBtn').addEventListener('click', addArticle);
$('scoreClass').addEventListener('change', () => {
  state.scoreClass = $('scoreClass').value;
  renderSummary();
  renderStudentFilter();
  renderDetails();
});
$('studentFilter').addEventListener('change', renderDetails);
$('addClassBtn')?.addEventListener('click', addClass);
$('typeFilter').addEventListener('change', renderDetails);
// 匯出跟著目前選的班級走，老師才不會每次都拿到全校的資料
function exportSuffix() {
  const name = selectedClass();
  return name === 'all' ? '' : `?class=${encodeURIComponent(name)}`;
}
function exportName(prefix) {
  const name = selectedClass();
  return name === 'all' ? `${prefix}.csv` : `${prefix}-${name || '未分班'}.csv`;
}

$('exportRecordsBtn').addEventListener('click', () =>
  downloadFile('/api/teacher/export/records.csv' + exportSuffix(), exportName('practice-records'))
);
$('exportSummaryBtn').addEventListener('click', () =>
  downloadFile('/api/teacher/export/summary.csv' + exportSuffix(), exportName('practice-summary'))
);
$('clearBtn').addEventListener('click', clearRecords);

init();
