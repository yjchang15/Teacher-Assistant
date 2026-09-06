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

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

// 辨識結果會把數字寫成 25，文章裡卻可能寫 twenty-five（或反過來）。
// 兩邊都拆成英文字，這種寫法差異就不會被算成唸錯。
function numberToWords(n) {
  if (n < 20) return [ONES[n]];
  if (n < 100) {
    const rest = n % 10;
    return rest ? [TENS[Math.floor(n / 10)], ONES[rest]] : [TENS[Math.floor(n / 10)]];
  }
  if (n < 1000) {
    const head = [ONES[Math.floor(n / 100)], 'hundred'];
    const rest = n % 100;
    return rest ? head.concat(numberToWords(rest)) : head;
  }
  return null; // 太大的數字（年份、電話）就原樣比對
}

function normalizeWords(text) {
  return text
    // 文章多半是從 Word 或網頁貼上來的，智慧引號要先轉成直式，
    // 否則 doesn’t 會被切成 doesn + t，兩個字都算唸錯。
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase()
    // don't / dont 視為同一個字，撇號的有無不該影響發音分數
    .replace(/'/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => (/^\d+$/.test(word) ? numberToWords(Number(word)) || [word] : [word]));
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

function utterance(text, lang = 'en-US') {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.95;
  return utter;
}

// 手機瀏覽器只有在使用者剛碰過畫面時才准許網頁發出聲音。AI 的回覆要等網路
// 回來才唸得出來，那時候早就不算「剛碰過」了，於是整堂課都是靜音的——電腦
// 和平板沒有這條限制，所以只有手機出問題。這裡在第一次觸碰時先唸一段沒有
// 音量的空白，把發聲權限拿到手，之後排進佇列的句子就都放得出來。
let speechUnlocked = false;

function unlockSpeech() {
  if (speechUnlocked || !window.speechSynthesis) return;
  try {
    const warmUp = new SpeechSynthesisUtterance(' ');
    warmUp.volume = 0;
    window.speechSynthesis.speak(warmUp);
    speechUnlocked = true;
  } catch (e) {
    /* 這次拿不到就算了，下一次觸碰再試 */
  }
}

document.addEventListener('pointerdown', unlockSpeech, true);
document.addEventListener('touchend', unlockSpeech, true);
document.addEventListener('keydown', unlockSpeech, true);

// iOS 會在講完一句或切走分頁之後把佇列擱置著，不 resume 就再也不出聲
function speakNow(utter) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.speak(utter);
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
}

function speak(text, lang = 'en-US') {
  stopClip();
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  speakNow(utterance(text, lang));
}

// ====== 邊收字邊唸 ======
// AI 的回覆是一段一段串流回來的。整段收完才唸，學生就得多等一次；
// 所以每收到一個完整句子就先丟進發音佇列，後面的句子會自動接著唸。

let ttsPending = ''; // 還沒湊成完整句子、先留著的尾巴

function speakReset() {
  stopClip();
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  ttsPending = '';
}

function speakPush(delta) {
  if (!window.speechSynthesis) return;
  ttsPending += delta;
  // 找出目前收到的最後一個句尾，把之前的整句都送出去唸
  const boundary = /[.!?]["')\]]?(\s|$)/g;
  let cut = -1;
  let match;
  while ((match = boundary.exec(ttsPending))) cut = match.index + match[0].length;
  if (cut > 0) {
    const sentence = ttsPending.slice(0, cut).trim();
    ttsPending = ttsPending.slice(cut);
    // 這裡不能 cancel，否則會打斷前一句；直接排隊接著唸
    if (sentence) speakNow(utterance(sentence));
  }
}

function speakFlush() {
  if (!window.speechSynthesis) return;
  const rest = ttsPending.trim();
  ttsPending = '';
  if (rest) speakNow(utterance(rest));
}

// ====== 錄下學生的聲音，讓他自己聽 ======
// SpeechRecognition 只會給文字、拿不到聲音，所以另外用 MediaRecorder 同時錄一份。
// 錄音只留在瀏覽器記憶體裡，不會上傳，換下一句就丟掉。

// 手機的麥克風一次只服務一個使用者。MediaRecorder 先接上去之後，語音辨識就
// 一個字都收不到，學生整段唸完只換來「沒有聽到內容」。電腦和平板沒有這個限制，
// 兩邊可以同時開著，所以只有手機不能用。回放自己的錄音只是加分，辨識不到的話
// 整個練習都沒意義，所以手機上把麥克風整支讓給辨識。
const isPhone = /iPhone|iPod/.test(navigator.userAgent)
  || (/Android/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent));

const audioSupported = !isPhone && !!(
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

    // 評分要等這個 Promise，所以絕對不能卡住：onstop 沒觸發或 stop() 丟例外時
    // 就放棄回放，分數照樣要出得來。
    let settled = false;
    const finish = (blob) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { rec.stream.getTracks().forEach((t) => t.stop()); } catch { /* 已經關掉了 */ }
      resolve(blob);
    };
    const timer = setTimeout(() => finish(null), 2000);

    rec.onstop = () => {
      const blob = new Blob(recordedChunks, { type: rec.mimeType || 'audio/webm' });
      finish(blob.size > 0 ? blob : null);
    };
    try {
      rec.stop();
    } catch {
      finish(null);
    }
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
  // event.results 是這一輪辨識到目前為止的完整清單，每次都從頭重讀一遍。
  // resultIndex 說的是「這次事件新增的是哪一段」，但手機的引擎常常一直回 0，
  // 照著它把新的字接到後面，同一段就會被接上好幾十次——學生唸兩句，畫面卻
  // 跑出整篇重複的字。從頭重組就不會有這個問題，代價只是每次多跑幾十個字。
  rec.onresult = (event) => {
    let finalText = '';
    let interimText = '';
    let confidence = null;
    for (let i = 0; i < event.results.length; i++) {
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
  document.querySelector('[data-action="back"]').addEventListener('click', () => {
    stopReading(); // 不停掉的話，離開畫面後辨識還會一直自己接回去
    showHome();
  });

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
// 只有學生按下「唸完了」（或離開畫面）才算唸完，辨識引擎自己停下來不算
let readingStopped = false;

// 手機的辨識引擎不理會 continuous：換氣停頓一下它就自己結束了，於是學生才唸
// 兩句就跳出分數。電腦不會，所以桌機版一直是對的。沒有辦法叫它別停，只能在
// 它停掉時立刻接回去；接回來之前唸的字都留著，最後合起來算分。
// 麥克風如果壞掉，每一段都會瞬間結束，所以接回去要有上限：整段最多接這麼多
// 次，而且一直沒聽到任何字的話，等這麼久就放棄，直接告訴學生沒有收到聲音。
const MAX_READING_SEGMENTS = 120;
const READING_SILENCE_GIVE_UP_MS = 20_000;

function stopReading() {
  readingStopped = true;
  if (readingRecognizer) readingRecognizer.stop();
}

async function handleReadingRecord(text) {
  if (!text) return;

  // 錄音中再按一次就是「唸完了」，整段朗讀由學生自己決定何時結束
  if (isRecording) {
    stopReading();
    return;
  }
  isRecording = true;
  readingStopped = false;

  const recordBtn = document.getElementById('recordBtn');
  const status = document.getElementById('recordStatus');
  setMyRecording(null);
  status.textContent = '準備中...';

  await startAudioCapture();

  // 辨識被手機中斷幾次，這裡就有幾段。每一段的內容由 onResult 整段換掉，不是
  // 一直往後接，否則同一句會被記好幾次。
  const done = [];
  // 這一段目前聽到的全部（含還沒定案的 interim：按下「唸完了」時最後一句
  // 常常還是 interim，丟掉的話整段唸完卻算不出分數）
  let current = '';
  const spokenSoFar = () => [...done, current].join(' ').trim();

  let failed = false;
  let segments = 0;
  let announced = false;
  const startedAt = Date.now();

  const endSegment = () => {
    if (current) done.push(current);
    current = '';
  };

  const finish = async () => {
    recordBtn.classList.remove('recording');
    recordBtn.textContent = '🎙️ 開始朗讀';
    isRecording = false;
    readingRecognizer = null;

    const blob = await stopAudioCapture();
    // 學生按了返回，這個畫面已經不在了，沒有地方可以顯示分數
    if (!document.getElementById('resultBox')) return;

    const spoken = done.join(' ').trim();
    if (!spoken) {
      if (!failed) status.textContent = '沒有聽到內容，請再試一次。';
      return;
    }
    // 分數只看唸出來的字對不對，不摻辨識信心值，比較好跟學生解釋
    showReadingResult(text, spoken, null, blob);
  };

  readingRecognizer = createRecognizer({
    continuous: true,
    onStart: () => {
      // 中途自己接回來的那幾段不要重寫畫面，否則字幕會被清掉
      if (announced) return;
      announced = true;
      recordBtn.classList.add('recording');
      recordBtn.textContent = '⏹️ 唸完了，看分數';
      status.textContent = '請開始朗讀整段，唸完後按上面的按鈕';
    },
    onError: (e) => {
      // 停頓時的 no-speech、以及我們自己叫停的 aborted，都不是真的出問題
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      failed = true;
      status.textContent = `辨識發生問題（${e.error}），請再試一次。`;
    },
    onResult: ({ finalText, interimText }) => {
      current = `${finalText} ${interimText}`.trim();
      // 一邊唸一邊顯示聽到的字，學生才知道有沒有收到音
      status.textContent = spokenSoFar() || '請開始朗讀...';
    },
    onEnd: async () => {
      endSegment();
      const stillWorthWaiting = done.length || Date.now() - startedAt < READING_SILENCE_GIVE_UP_MS;
      if (!readingStopped && !failed && stillWorthWaiting && ++segments < MAX_READING_SEGMENTS) {
        try {
          readingRecognizer.start();
          return;
        } catch (e) {
          // 接不回去就照原本的方式收尾，至少分數還在
        }
      }
      await finish();
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

async function showReadingResult(targetText, heardText, confidence, audioBlob) {
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

  const saved = await saveRecord({
    type: 'reading',
    student: state.studentName,
    seatNo: state.seatNo,
    classId: state.classId,
    className: state.className,
    target: targetText,
    heard: heardText,
    score,
  });
  const warning = document.getElementById('saveWarning');
  warning.hidden = saved.ok;
  warning.textContent = saved.ok
    ? ''
    : `這次的分數沒有送到老師那裡（${saved.error}）。請告訴老師，或返回首頁重新選一次班級座號再唸。`;
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

  const status = document.getElementById('chatStatus');
  const recordBtn = document.getElementById('chatRecordBtn');
  status.textContent = '';

  // 開場白改在本機挑一句，不呼叫 API。
  // 一上課全班同時按「開始」，原本那 30 幾個請求會在幾秒內一起送出去，
  // 免費額度是以每分鐘計的，光開場就先把配額打光。開場白本來就只是
  // 一句招呼，寫在前端也一樣自然，而且是瞬間出現。
  const opening = randomOpening(state.conversation.level);
  state.conversation.history.push({ role: 'model', text: opening });
  renderChatLog();
  speakReset();
  speakPush(opening);
  speakFlush();
  recordBtn.disabled = false;
}

// 每個等級幾句不同的開場白，隨機挑一句，全班才不會整齊劃一
const OPENINGS = {
  1200: [
    'Hi! How are you today?',
    'Hello! What is your name?',
    'Hi! Do you like school?',
    'Hello! What do you eat for lunch?',
  ],
  2000: [
    'Hi! How was your day today?',
    'Hello! What do you like to do after school?',
    'Hi! Did you watch anything fun this week?',
    'Hello! What is your favorite food?',
  ],
  3500: [
    'Hi! How has your week been so far?',
    'Hello! What did you enjoy most about today?',
    'Hi! Is there something you have been looking forward to?',
    'Hello! What kind of music do you listen to, and why?',
  ],
};

function randomOpening(level) {
  const list = OPENINGS[level] || OPENINGS['2000'];
  return list[Math.floor(Math.random() * list.length)];
}

// 送出一輪對話，字回來就顯示、句子成形就唸。
// 回傳 AI 說的話；失敗時回傳 null，並把原因寫在狀態列。
async function streamAiTurn(history) {
  speakReset();
  let paint = null;
  const result = await callChatApi(null, history, (delta, full) => {
    if (!paint) paint = streamBubble();
    paint(full);
    speakPush(delta);
  });
  speakFlush();
  hideTyping();
  clearStreamBubble();

  if (result.error) {
    // 錯誤訊息絕對不能進 history：它會被當成 AI 講過的話，
    // 之後每一輪都跟著送回 Gemini，越積越多還會影響回答。
    const status = document.getElementById('chatStatus');
    status.textContent = result.retryable
      ? `${result.error}（按一次麥克風就會重試）`
      : result.error;
    return null;
  }
  return result.text;
}

function renderChatLog() {
  const log = document.getElementById('chatLog');
  // 「正在打字」和串流中的泡泡不屬於 history，重畫時要留著再接回去，
  // 否則錄音檔晚一步好、觸發重畫，就會把還在串流的那句洗掉。
  const transient = [document.getElementById('typingBubble'), document.getElementById('streamBubble')].filter(Boolean);
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

  transient.forEach((node) => log.appendChild(node));
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

// 字一邊回來一邊長出來的暫時泡泡。整句收完後會被 renderChatLog 取代成正式的那顆。
function streamBubble() {
  hideTyping();
  const log = document.getElementById('chatLog');
  const bubble = document.createElement('div');
  bubble.className = 'bubble ai';
  bubble.id = 'streamBubble';
  const text = document.createElement('span');
  bubble.appendChild(text);
  log.appendChild(bubble);
  return (full) => {
    text.textContent = full;
    log.scrollTop = log.scrollHeight;
  };
}

function clearStreamBubble() {
  const bubble = document.getElementById('streamBubble');
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

      // 錄音檔只是給學生回放用的，AI 的回覆不需要等它。這裡先把收尾丟到背景，
      // 免得 MediaRecorder 慢半拍（最久兩秒）就整輪對話都跟著慢兩秒。
      const capture = stopAudioCapture();
      if (!heardText) {
        await capture;
        if (!failed) status.textContent = '沒有聽到內容，請再試一次。';
        return;
      }

      const index = state.conversation.history.length;
      state.conversation.history.push({ role: 'user', text: heardText });
      renderChatLog();
      capture.then((blob) => {
        if (!blob) return;
        state.conversation.audio[index] = URL.createObjectURL(blob);
        renderChatLog(); // 錄音好了才補上回放鈕
      });

      status.textContent = '';
      btn.disabled = true;
      showTyping();

      const aiText = await streamAiTurn(state.conversation.history);
      if (aiText) {
        state.conversation.history.push({ role: 'model', text: aiText });
        renderChatLog();
        status.textContent = '';
      }
      // 失敗時把學生剛說的那句留在 history，他再按一次麥克風就是重試同一輪
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

// 把一次練習結果送到伺服器存檔（老師頁面用）。
// 存不進去一定要講出來：以前只寫在 console，學生看到分數就離開了，老師的後台
// 卻始終是空的，兩邊都不知道發生了什麼事。
async function saveRecord(payload) {
  try {
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    let message = '';
    try { message = (await res.json()).error || ''; } catch { /* 錯誤頁不一定是 JSON */ }
    console.warn('練習紀錄未存檔:', res.status, message);
    return { ok: false, error: message || `伺服器回應 ${res.status}` };
  } catch (e) {
    console.warn('練習紀錄未存檔（無法連線伺服器）:', e);
    return { ok: false, error: '連不到伺服器' };
  }
}

// 伺服器改成串流純文字了：錯誤仍然是 JSON，成功則是一段一段的內文。
// onDelta(delta, full) 每收到一塊就會被呼叫一次，回傳值是完整的整段文字。
async function callChatApi(systemPrompt, history, onDelta) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: Boolean(systemPrompt), history, level: state.conversation.level }),
    });
    if (!res.ok) {
      let message = '未知錯誤';
      let retryable = res.status === 429;
      try {
        const data = await res.json();
        message = data.error || message;
        retryable = Boolean(data.retryable) || retryable;
      } catch { /* 錯誤頁不一定是 JSON */ }
      return { error: message, retryable };
    }
    if (!res.body) return { text: await res.text() };

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      full += value;
      if (onDelta) onDelta(value, full);
    }
    return { text: full };
  } catch (e) {
    return { error: '無法連線到伺服器，請稍後再試。', retryable: true };
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

  const result = await callChatApi(feedbackPrompt, historyWithRequest, (delta, full) => {
    feedbackBox.textContent = full; // 回饋比較長，邊產生邊顯示才不會像當掉
  });

  // 拿不到回饋也要把紀錄存起來，老師那邊才看得到這次練習。
  // 這裡不讓學生重按「結束對話」，因為 saveRecord 沒有更新的介面，
  // 再按一次會變成兩筆紀錄，老師的對話次數就不準了。
  const feedback = result.error ? '' : result.text;
  feedbackBox.textContent = result.error
    ? `${result.error}\n（這次練習會記錄下來，回饋這次拿不到）`
    : feedback;

  const saved = await saveRecord({
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
  if (!saved.ok) {
    feedbackBox.textContent = `${feedbackBox.textContent}\n（這次練習沒有送到老師那裡：${saved.error}）`;
  }
}

// ====== 啟動 ======
showHome();
