/* eslint-disable @typescript-eslint/no-unused-vars */
// ====== 全域狀態 ======
const state = {
  studentName: '',
  seatNo: '',
  classId: '',
  className: '',
  classes: [],
  articles: [],
  article: '',
  conversation: { history: [], ended: false, audio: [], level: '2000' },
};

const appEl = document.getElementById('app');
const studentBadge = document.getElementById('studentBadge');

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechSupported = !!SpeechRecognitionCtor;

// ====== 工具函式 ======

function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// 以最長共同子序列(LCS)比對兩組單字，標記 target 每個字是否有被說出來
function diffWords(targetWords, heardWords) {
  const n = targetWords.length;
  const m = heardWords.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (targetWords[i - 1] === heardWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  const matched = new Array(n).fill(false);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (targetWords[i - 1] === heardWords[j - 1]) {
      matched[i - 1] = true;
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  const matchedCount = matched.filter(Boolean).length;
  const accuracy = n === 0 ? 0 : Math.round((matchedCount / n) * 100);
  return { matched, accuracy };
}

function speak(text, lang = 'en-US') {
  stopClip();
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

// ====== 錄下學生的聲音，讓他自己聽 ======
// SpeechRecognition 只會給文字、拿不到聲音，所以另外用 MediaRecorder 同時錄一份。
// 錄音只留在瀏覽器記憶體裡，不會上傳，換下一句就丟掉。

const audioSupported = !!(
  navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder
);
let mediaRecorder = null;
let recordedChunks = [];
let myAudioUrl = null;
let clipAudio = null;
let clipButton = null;

async function startAudioCapture() {
  if (!audioSupported) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size) recordedChunks.push(e.data);
    };
    mediaRecorder.start();
    return true;
  } catch (e) {
    // 錄不到就算了，評分照常運作，只是沒有回放可以聽
    console.warn('無法錄音回放:', e);
    mediaRecorder = null;
    return false;
  }
}

// 停止錄音並回傳音檔；同時關掉麥克風，否則分頁會一直顯示「錄音中」
function stopAudioCapture() {
  return new Promise((resolve) => {
    const rec = mediaRecorder;
    mediaRecorder = null;
    if (!rec || rec.state === 'inactive') return resolve(null);
    rec.onstop = () => {
      rec.stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(recordedChunks, { type: rec.mimeType || 'audio/webm' });
      resolve(blob.size > 0 ? blob : null);
    };
    rec.stop();
  });
}

function setMyRecording(blob) {
  stopClip();
  if (myAudioUrl) URL.revokeObjectURL(myAudioUrl);
  myAudioUrl = blob ? URL.createObjectURL(blob) : null;
  const btn = document.getElementById('playMineBtn');
  if (btn) {
    btn.hidden = !myAudioUrl;
    btn.textContent = '▶️ 聽我唸的';
  }
}

function stopClip() {
  if (clipAudio) {
    clipAudio.pause();
    clipAudio = null;
  }
  if (clipButton) {
    clipButton.textContent = clipButton.dataset.idleLabel;
    clipButton = null;
  }
}

// 共用播放器：同一時間只播一段，按同一顆就停止
function playClip(url, btn, idleLabel, playingLabel) {
  if (!url) return;
  const sameButton = clipButton === btn;
  stopClip();
  if (sameButton) return;

  if (window.speechSynthesis) window.speechSynthesis.cancel();
  clipAudio = new Audio(url);
  clipButton = btn;
  btn.dataset.idleLabel = idleLabel;
  btn.textContent = playingLabel;
  clipAudio.onended = stopClip;
  clipAudio.onerror = stopClip;
  clipAudio.play().catch(stopClip);
}

function playMyRecording() {
  const btn = document.getElementById('playMineBtn');
  playClip(myAudioUrl, btn, '▶️ 聽我唸的', '⏸️ 停止播放');
}

// continuous = true 用在朗讀整段：中間換氣、停頓都不會中斷辨識，
// 要由學生自己按停止。對話一次只講一句，維持非連續模式即可。
function createRecognizer({ onResult, onStart, onEnd, onError, continuous = false }) {
  const rec = new SpeechRecognitionCtor();
  rec.lang = 'en-US';
  rec.continuous = continuous;
  rec.interimResults = continuous; // 連續模式才需要即時字幕
  rec.maxAlternatives = 1;
  rec.onstart = onStart;
  rec.onend = onEnd;
  rec.onerror = (e) => onError && onError(e);
  rec.onresult = (event) => {
    let finalText = '';
    let interimText = '';
    let confidence = null;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalText += result[0].transcript + ' ';
        confidence = result[0].confidence || confidence;
      } else {
        interimText += result[0].transcript + ' ';
      }
    }
    onResult({ finalText: finalText.trim(), interimText: interimText.trim(), confidence });
  };
  return rec;
}

async function loadJSON(url) {
  const res = await fetch(url);
  return res.json();
}

function render(templateId) {
  const tpl = document.getElementById(templateId);
  appEl.innerHTML = '';
  appEl.appendChild(tpl.content.cloneNode(true));
}

// ====== 畫面：首頁 ======

async function showHome() {
  studentBadge.hidden = true;
  render('tpl-home');

  const warning = document.getElementById('browserWarning');
  if (!speechSupported) {
    warning.hidden = false;
    document.querySelectorAll('.mode-btn').forEach((b) => (b.disabled = true));
  }

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const identity = currentIdentity();
      if (!identity) return; // 按鈕在選好名字前是停用的，正常不會走到這裡
      state.studentName = identity.student;
      state.seatNo = identity.seatNo;
      state.classId = identity.classId;
      state.className = identity.className;
      studentBadge.textContent = identity.className
        ? `${identity.className} · ${identity.student}`
        : identity.student;
      studentBadge.hidden = false;

      const mode = btn.dataset.mode;
      if (mode === 'reading') startReading();
      if (mode === 'conversation') startConversation();
    });
  });

  await setupIdentityPicker();
}

// 選好班級與座號之前，練習項目維持停用
function updateModeButtons() {
  const ready = speechSupported && !!currentIdentity();
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.disabled = !ready;
  });
}

// ====== 選班級與座號 ======

// 學生的身分就是「班級 + 座號」，沒有姓名
const picked = { seat: '', classId: '', className: '' };

function currentIdentity() {
  return picked.seat
    ? { student: picked.seat, seatNo: picked.seat, classId: picked.classId, className: picked.className }
    : null;
}

// 記住上次選的人，電腦教室座位固定時就不用每堂課重選
function remember(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch (e) {
    /* 瀏覽器擋住儲存也沒關係，只是下次要重選 */
  }
}

function recall(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

async function setupIdentityPicker() {
  // 回首頁重新選人時要先清掉上一次的選擇，否則畫面沒反白、按鈕卻是啟用的，
  // 會沿用前一位學生的身分
  picked.seat = '';
  picked.classId = '';
  picked.className = '';

  const hint = document.getElementById('homeHint');
  const classSelect = document.getElementById('classSelect');

  let classes = [];
  try {
    classes = (await loadJSON('/api/classes')).classes || [];
  } catch (e) {
    console.warn('讀不到班級名冊:', e);
  }
  state.classes = classes.filter((c) => (c.seats || []).length > 0);

  // 沒有名冊時先停用練習，請老師建立班級與座號
  classSelect.hidden = state.classes.length === 0;
  hint.textContent = state.classes.length
    ? '請選擇你的班級和座號，再選擇要練習的項目。'
    : '老師還沒建立班級，請先到老師專區設定班級與座號。';

  classSelect.innerHTML = '';
  state.classes.forEach((cls) => {
    const opt = document.createElement('option');
    opt.value = cls.id;
    opt.textContent = cls.name;
    classSelect.appendChild(opt);
  });

  const lastClassId = recall('lastClassId');
  if (state.classes.some((c) => c.id === lastClassId)) classSelect.value = lastClassId;

  classSelect.onchange = () => {
    picked.seat = '';
    remember('lastSeat', '');
    renderStudentGrid();
    updateModeButtons();
  };

  renderStudentGrid();
  updateModeButtons();
}

function renderStudentGrid() {
  const classSelect = document.getElementById('classSelect');
  const grid = document.getElementById('studentGrid');
  const cls = state.classes.find((c) => c.id === classSelect.value);
  grid.innerHTML = '';

  if (cls) remember('lastClassId', cls.id);
  const lastSeat = recall('lastSeat');

  function selectOnly(btn) {
    grid.querySelectorAll('.student-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
  }

  (cls ? cls.seats : []).forEach((seat) => {
    const btn = document.createElement('button');
    btn.className = 'student-btn';
    btn.textContent = seat;
    btn.onclick = () => {
      picked.seat = seat;
      picked.classId = cls.id;
      picked.className = cls.name;
      remember('lastSeat', seat);
      selectOnly(btn);
      updateModeButtons();
    };
    if (seat === lastSeat) btn.click();
    grid.appendChild(btn);
  });
}

// ====== 畫面：朗讀評分 ======

async function startReading() {
  // 每次進來都重讀，老師剛維護的文章清單才會馬上出現
  state.articles = (await loadJSON('/api/articles')).articles || [];

  render('tpl-reading');
  document.querySelector('[data-action="back"]').addEventListener('click', showHome);

  const select = document.getElementById('articleSelect');
  state.articles.forEach((article, index) => {
    const option = document.createElement('option');
    option.value = article.id;
    option.textContent = `文章 #${index + 1}`;
    select.appendChild(option);
  });
  select.disabled = state.articles.length === 0;

  function showArticle() {
    const article = state.articles.find((item) => item.id === select.value);
    state.article = article ? article.text : '';
    document.getElementById('sentenceText').textContent =
      state.article || '（老師還沒設定朗讀文章。請告訴老師到老師專區新增文章。）';
    document.getElementById('recordBtn').disabled = !state.article;
    document.getElementById('resultBox').hidden = true;
    document.getElementById('recordStatus').textContent = '';
  }
  select.onchange = showArticle;
  showArticle();

  document.getElementById('playModelBtn').onclick = () => state.article && speak(state.article);
  document.getElementById('playMineBtn').onclick = playMyRecording;
  setMyRecording(null);

  const recordBtn = document.getElementById('recordBtn');
  recordBtn.onclick = () => handleReadingRecord(state.article);

  document.getElementById('retryBtn').onclick = () => {
    document.getElementById('resultBox').hidden = true;
    document.getElementById('recordStatus').textContent = '';
  };
}

let isRecording = false;
let readingRecognizer = null;

async function handleReadingRecord(text) {
  if (!text) return;

  // 錄音中再按一次就是「唸完了」，整段朗讀由學生自己決定何時結束
  if (isRecording) {
    if (readingRecognizer) readingRecognizer.stop();
    return;
  }
  isRecording = true;

  const recordBtn = document.getElementById('recordBtn');
  const status = document.getElementById('recordStatus');
  setMyRecording(null);
  status.textContent = '準備中...';

  await startAudioCapture();

  let heard = '';
  let failed = false;

  readingRecognizer = createRecognizer({
    continuous: true,
    onStart: () => {
      recordBtn.classList.add('recording');
      recordBtn.textContent = '⏹️ 唸完了，看分數';
      status.textContent = '請開始朗讀整段，唸完後按上面的按鈕';
    },
    onError: (e) => {
      // 連續辨識在停頓時常會回 no-speech，已經聽到內容就不算失敗
      if (e.error === 'no-speech' && heard) return;
      failed = true;
      status.textContent = `辨識發生問題（${e.error}），請再試一次。`;
    },
    onResult: ({ finalText, interimText }) => {
      if (finalText) heard = `${heard} ${finalText}`.trim();
      // 一邊唸一邊顯示聽到的字，學生才知道有沒有收到音
      status.textContent = `${heard} ${interimText}`.trim() || '請開始朗讀...';
    },
    onEnd: async () => {
      recordBtn.classList.remove('recording');
      recordBtn.textContent = '🎙️ 開始朗讀';
      isRecording = false;
      readingRecognizer = null;

      const blob = await stopAudioCapture();
      if (!heard) {
        if (!failed) status.textContent = '沒有聽到內容，請再試一次。';
        return;
      }
      // 分數只看唸出來的字對不對，不摻辨識信心值，比較好跟學生解釋
      showReadingResult(text, heard, null, blob);
    },
  });

  try {
    readingRecognizer.start();
  } catch (e) {
    isRecording = false;
    readingRecognizer = null;
    await stopAudioCapture();
    status.textContent = '無法啟動麥克風，請確認瀏覽器已允許存取麥克風。';
  }
}

function showReadingResult(targetText, heardText, confidence, audioBlob) {
  const targetWords = normalizeWords(targetText);
  const heardWords = normalizeWords(heardText);
  const { matched, accuracy } = diffWords(targetWords, heardWords);

  let score = accuracy;
  if (confidence) {
    score = Math.round(accuracy * 0.8 + confidence * 100 * 0.2);
  }

  const circle = document.getElementById('scoreCircle');
  circle.textContent = `${score}`;
  circle.className = 'score-circle ' + (score >= 85 ? 'good' : score >= 60 ? 'mid' : 'low');

  document.getElementById('heardText').textContent = heardText || '（沒有聽到內容）';

  const diffLine = document.getElementById('diffLine');
  diffLine.innerHTML = targetWords
    .map((w, i) => `<span class="${matched[i] ? 'word-ok' : 'word-miss'}">${w}</span>`)
    .join(' ');

  setMyRecording(audioBlob);
  document.getElementById('resultBox').hidden = false;
  document.getElementById('recordStatus').textContent = '';

  saveRecord({
    type: 'reading',
    student: state.studentName,
    seatNo: state.seatNo,
    classId: state.classId,
    className: state.className,
    target: targetText,
    heard: heardText,
    score,
  });
}

// ====== 畫面：情境對話 ======

// 不用先選情境，按下去就直接開始聊
async function startConversation() {
  render('tpl-conversation');
  document.querySelector('[data-action="back"]').addEventListener('click', showHome);
  document.getElementById('restartChatBtn').addEventListener('click', startChat);
  const level = document.getElementById('conversationLevel');
  const savedLevel = recall('conversationLevel');
  level.value = ['1200', '2000', '3500'].includes(savedLevel) ? savedLevel : '2000';
  state.conversation.level = level.value;
  const showSelectedLevel = () => {
    document.querySelectorAll('.level-guide-row').forEach((row) => {
      row.classList.toggle('selected', row.dataset.level === level.value);
    });
  };
  showSelectedLevel();
  level.onchange = () => {
    state.conversation.level = level.value;
    remember('conversationLevel', level.value);
    showSelectedLevel();
    startChat();
  };
  document.getElementById('chatRecordBtn').onclick = handleChatRecord;
  document.getElementById('endChatBtn').onclick = handleEndChat;

  await startChat();
}

// 聲音只留在瀏覽器記憶體，重新開始就釋放掉
function clearChatAudio() {
  stopClip();
  (state.conversation.audio || []).forEach((url) => url && URL.revokeObjectURL(url));
  state.conversation.audio = [];
}

async function startChat() {
  clearChatAudio();
  state.conversation.history = [];
  state.conversation.ended = false;

  document.getElementById('feedbackBox').hidden = true;
  document.getElementById('feedbackBox').textContent = '';
  document.getElementById('endChatBtn').disabled = false;

  renderChatLog();

  // 開場白由 AI 即時產生，不是寫死的句子
  const status = document.getElementById('chatStatus');
  const recordBtn = document.getElementById('chatRecordBtn');
  status.textContent = '';
  recordBtn.disabled = true;
  showTyping();

  const opening = await callChatApi(null, [
    { role: 'user', text: '(Please start our conversation now with your short opening line.)' },
  ]);

  hideTyping();
  state.conversation.history.push({ role: 'model', text: opening });
  renderChatLog();
  speak(opening);
  recordBtn.disabled = false;
}

function renderChatLog() {
  const log = document.getElementById('chatLog');
  log.innerHTML = '';

  state.conversation.history.forEach((turn, i) => {
    const div = document.createElement('div');
    div.className = 'bubble ' + (turn.role === 'model' ? 'ai' : 'user');

    const text = document.createElement('span');
    text.textContent = turn.text;
    div.appendChild(text);

    // AI 那句用電腦發音再念一次；學生那句放他自己的錄音，全班都能一起聽
    if (turn.role === 'model') {
      div.appendChild(replayButton('🔊', () => speak(turn.text)));
    } else {
      const url = state.conversation.audio[i];
      if (url) {
        const btn = replayButton('▶️', null);
        btn.onclick = () => playClip(url, btn, '▶️', '⏸️');
        div.appendChild(btn);
      }
    }

    log.appendChild(div);
  });

  log.scrollTop = log.scrollHeight;
}

// AI 正在想的時候，在對話裡放一個會跳動的泡泡
function showTyping() {
  hideTyping();
  const log = document.getElementById('chatLog');
  const bubble = document.createElement('div');
  bubble.className = 'bubble ai';
  bubble.id = 'typingBubble';
  const dots = document.createElement('span');
  dots.className = 'typing';
  dots.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
  bubble.appendChild(dots);
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
}

function hideTyping() {
  const bubble = document.getElementById('typingBubble');
  if (bubble) bubble.remove();
}

function replayButton(label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'bubble-play';
  btn.textContent = label;
  btn.title = '再聽一次';
  if (onClick) btn.onclick = onClick;
  return btn;
}

let isChatRecording = false;

async function handleChatRecord() {
  if (state.conversation.ended || isChatRecording) return;
  isChatRecording = true;

  const btn = document.getElementById('chatRecordBtn');
  const status = document.getElementById('chatStatus');
  status.textContent = '準備中...';

  await startAudioCapture();

  let heardText = null;
  let failed = false;

  const recognizer = createRecognizer({
    onStart: () => {
      btn.classList.add('recording');
      btn.textContent = '🔴 錄音中...';
      status.textContent = '請開始說話';
    },
    onError: (e) => {
      failed = true;
      status.textContent = `辨識發生問題（${e.error}），請再試一次。`;
    },
    onResult: ({ finalText }) => {
      if (finalText) heardText = finalText;
    },
    onEnd: async () => {
      btn.classList.remove('recording');
      btn.textContent = '🎙️ 按住說話';
      isChatRecording = false;

      const blob = await stopAudioCapture();
      if (!heardText) {
        if (!failed) status.textContent = '沒有聽到內容，請再試一次。';
        return;
      }

      const index = state.conversation.history.length;
      state.conversation.history.push({ role: 'user', text: heardText });
      if (blob) state.conversation.audio[index] = URL.createObjectURL(blob);
      renderChatLog();

      status.textContent = '';
      btn.disabled = true;
      showTyping();

      const aiText = await callChatApi(null, state.conversation.history);
      hideTyping();
      state.conversation.history.push({ role: 'model', text: aiText });
      renderChatLog();
      speak(aiText);
      status.textContent = '';
      btn.disabled = false;
    },
  });

  try {
    recognizer.start();
  } catch (e) {
    isChatRecording = false;
    await stopAudioCapture();
    status.textContent = '無法啟動麥克風，請確認瀏覽器已允許存取麥克風。';
  }
}

// 把一次練習結果送到伺服器存檔（老師頁面用）。失敗不打擾學生，只寫 console。
async function saveRecord(payload) {
  try {
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.warn('練習紀錄未存檔:', (await res.json()).error);
  } catch (e) {
    console.warn('練習紀錄未存檔（無法連線伺服器）:', e);
  }
}

async function callChatApi(systemPrompt, history) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: Boolean(systemPrompt), history, level: state.conversation.level }),
    });
    const data = await res.json();
    if (!res.ok) {
      return `（發生錯誤：${data.error || '未知錯誤'}）`;
    }
    return data.text;
  } catch (e) {
    return '（無法連線到伺服器，請稍後再試）';
  }
}

async function handleEndChat() {
  const feedbackBox = document.getElementById('feedbackBox');
  feedbackBox.hidden = false;
  feedbackBox.textContent = '正在整理回饋...';
  state.conversation.ended = true;
  document.getElementById('endChatBtn').disabled = true;

  const feedbackPrompt =
    'You are an encouraging English teacher for Taiwanese junior high school students. ' +
    'Based on the conversation transcript so far, write short feedback IN TRADITIONAL CHINESE (繁體中文), 3 to 5 sentences, covering: ' +
    '1) what the student did well, 2) one or two specific things to improve (vocabulary or grammar, quoting the English words/phrases they used), ' +
    '3) one short encouraging closing sentence. Do not write in English except when quoting the student’s own words.';

  const historyWithRequest = [
    ...state.conversation.history,
    { role: 'user', text: '(This is the end of the conversation. Please give me feedback now.)' },
  ];

  const feedback = await callChatApi(feedbackPrompt, historyWithRequest);
  feedbackBox.textContent = feedback;

  saveRecord({
    type: 'conversation',
    student: state.studentName,
    seatNo: state.seatNo,
    classId: state.classId,
    className: state.className,
    scenarioId: 'free',
    scenarioTitle: '自由對話',
    conversationLevel: state.conversation.level,
    turns: state.conversation.history,
    feedback,
  });
}

// ====== 啟動 ======
showHome();
