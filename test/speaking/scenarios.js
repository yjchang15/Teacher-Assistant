/* Test-only scenarios. Loaded by _test.html after app.js. Call window.runTests(). */
/* eslint-disable */
(function () {
  const T = window.__T;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tick = () => wait(60);
  const $ = (id) => document.getElementById(id);

  // Waits are polled, never fixed: the app deliberately gives the microphone up
  // to two seconds to hand back its recording, so a fixed wait tests the clock.
  async function until(label, cond, ms = 6000) {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      let ok = false;
      try { ok = cond(); } catch (e) { ok = false; }
      if (ok) return true;
      await wait(25);
    }
    throw new Error(`timed out waiting for: ${label}`);
  }
  const scoreShown = () => until('the score to appear', () => !$('resultBox').hidden);

  const results = [];
  let currentName = '';
  function check(label, ok, detail) {
    results.push({ test: currentName, check: label, ok: !!ok, detail: ok ? '' : String(detail) });
  }
  function eq(label, actual, expected) {
    check(label, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }

  async function home() {
    await showHome();
    await until('the roster', () => document.querySelectorAll('.student-btn').length > 0);
    document.querySelectorAll('.student-btn')[0].click();
    await tick();
  }

  async function enterReading() {
    await home();
    document.querySelector('.mode-btn[data-mode="reading"]').click();
    await until('the article', () => $('recordBtn') && !$('recordBtn').disabled);
  }

  async function enterChat() {
    await home();
    document.querySelector('.mode-btn[data-mode="conversation"]').click();
    await until('the opening line', () => document.querySelectorAll('#chatLog .bubble.ai').length === 1);
  }

  // Say one student turn and wait for the exchange to settle.
  async function studentSays(text) {
    const before = state.conversation.history.length;
    $('chatRecordBtn').click();
    await until('the microphone', () => T.live && T.live._running);
    T.hear(text, true);
    T.live.stop();
    await until('the turn to finish', () => !$('chatRecordBtn').disabled
      && state.conversation.history.length > before);
  }

  // ---- reading -------------------------------------------------------------

  async function readingDesktopWaitsForButton() {
    currentName = 'reading · desktop: only the button ends it';
    T.mode = 'desktop';
    await enterReading();
    $('recordBtn').click();
    await until('the microphone', () => T.live && T.live._running);
    T.hear('it does not', false);
    T.hear('it does not matter', true);
    await tick();
    check('score is not shown while still reading', $('resultBox').hidden, 'result box opened early');
    eq('button still says stop', $('recordBtn').textContent, '⏹️ 唸完了，看分數');
    T.hear('at all i can wait for you here', true);
    await tick();
    $('recordBtn').click();
    await scoreShown();
    eq('transcript', $('heardText').textContent, 'it does not matter at all i can wait for you here');
    eq('score', $('scoreCircle').textContent, '100');
  }

  async function readingAndroidSurvivesPauses() {
    currentName = 'reading · android: pauses and cumulative results';
    T.mode = 'android';
    await enterReading();
    $('recordBtn').click();
    await until('the microphone', () => T.live && T.live._running);
    const w1 = ['it', 'does', 'not', 'matter'];
    for (let i = 1; i <= w1.length; i++) T.hear(w1.slice(0, i).join(' '), false);
    T.hear('it does not matter', true);
    await tick();
    eq('no duplication in the live subtitle', $('recordStatus').textContent, 'it does not matter');

    T.enginePause(); // the phone gives up at the pause
    await until('recognition to resume', () => T.live && T.live._running);
    check('still recording after the pause', isRecording, 'recording stopped at a pause');
    check('no score yet', $('resultBox').hidden, 'scored early');

    const w2 = ['at', 'all', 'i', 'can', 'wait'];
    for (let i = 1; i <= w2.length; i++) T.hear(w2.slice(0, i).join(' '), false);
    T.hear('at all i can wait', true);
    T.hear('for you here', false); // never finalised — the student presses the button now
    await tick();
    $('recordBtn').click();
    await scoreShown();
    eq('stretches joined, nothing repeated', $('heardText').textContent,
      'it does not matter at all i can wait for you here');
    eq('score', $('scoreCircle').textContent, '100');
  }

  async function readingPartialScoresLower() {
    currentName = 'reading · a partial reading scores lower';
    T.mode = 'android';
    await enterReading();
    $('recordBtn').click();
    await until('the microphone', () => T.live && T.live._running);
    T.hear('it does not matter', true);
    $('recordBtn').click();
    await scoreShown();
    const score = Number($('scoreCircle').textContent);
    check('score between 1 and 60', score > 0 && score < 60, `score was ${score}`);
    check('unread words marked red', document.querySelectorAll('#diffLine .word-miss').length > 0,
      'nothing marked as missed');
    check('read words marked green', document.querySelectorAll('#diffLine .word-ok').length > 0,
      'nothing marked as read');
  }

  async function readingScoresPunctuationFairly() {
    currentName = 'reading · curly quotes and numbers are not mistakes';
    const target = 'It doesn’t matter — I’ll wait 25 minutes.';
    const heard = 'it doesnt matter ill wait twenty five minutes';
    const words = normalizeWords(target);
    const { accuracy } = diffWords(words, normalizeWords(heard));
    eq('a correct reading scores 100', accuracy, 100);
    const partial = diffWords(words, normalizeWords('it doesnt matter')).accuracy;
    check('a wrong reading still loses marks', partial < 60, `partial scored ${partial}`);
  }

  async function readingDeadMicGivesUp() {
    currentName = 'reading · dead microphone gives up';
    T.mode = 'android';
    await enterReading();
    const stop = setInterval(() => { if (isRecording) T.enginePause(); }, 20);
    $('recordBtn').click();
    try {
      await until('the app to give up', () => !isRecording, 30000);
    } finally {
      clearInterval(stop);
    }
    eq('button reset', $('recordBtn').textContent, '🎙️ 開始朗讀');
    // the message comes after the recorder hands back (or times out), not with the button
    await until('the message', () => $('recordStatus').textContent === '沒有聽到內容，請再試一次。', 4000);
    check('student is told nothing was heard', true);
    check('no score invented', $('resultBox').hidden, 'a score was shown');
  }

  async function readingBackButtonStops() {
    currentName = 'reading · 返回 while recording';
    T.mode = 'android';
    await enterReading();
    $('recordBtn').click();
    await until('the microphone', () => T.live && T.live._running);
    T.hear('it does not', false);
    document.querySelector('[data-action="back"]').click();
    await until('the home screen', () => !!document.querySelector('.mode-btn'));
    try {
      await until('recording to stop', () => !isRecording && !readingRecognizer, 3000);
      check('recording stopped and recognizer released', true);
    } catch (e) {
      check('recording stopped and recognizer released', false, String(e.message));
    }
    const startsBefore = T.starts;
    await wait(800);
    eq('no ghost restarts after leaving', T.starts, startsBefore);
  }

  async function readingSavesToBackend() {
    currentName = 'reading · the score reaches the teacher';
    T.mode = 'desktop';
    const before = (await (await fetch('/api/teacher/records')).json()).records.length;
    await enterReading();
    $('recordBtn').click();
    await until('the microphone', () => T.live && T.live._running);
    T.hear('it does not matter at all i can wait for you here', true);
    $('recordBtn').click();
    await scoreShown();
    await until('the record to post', async () => true);
    await wait(400);
    check('no save warning shown', $('saveWarning').hidden, $('saveWarning').textContent);
    const after = await (await fetch('/api/teacher/records')).json();
    eq('one new record', after.records.length, before + 1);
    eq('stored as reading', after.records[0].type, 'reading');
    eq('stored score', after.records[0].score, 100);
    eq('stored seat', after.records[0].seatNo, state.seatNo);
    eq('stored class', after.records[0].className, state.className);
    const summary = after.summary.find((s) => s.seatNo === state.seatNo && s.className === state.className);
    check('the seat now shows a reading in the summary', summary && summary.readingCount > 0,
      JSON.stringify(summary));
  }

  async function readingSaveFailureIsVisible() {
    currentName = 'reading · a failed save is visible';
    T.mode = 'desktop';
    await enterReading();
    const realClass = state.classId;
    state.classId = '99999'; // a class that no longer exists
    $('recordBtn').click();
    await until('the microphone', () => T.live && T.live._running);
    T.hear('it does not matter at all i can wait for you here', true);
    $('recordBtn').click();
    await scoreShown();
    await until('the warning', () => !$('saveWarning').hidden);
    state.classId = realClass;
    check('warning names the reason', $('saveWarning').textContent.includes('班級或座號已變更'),
      $('saveWarning').textContent);
    eq('score still shown to the student', $('scoreCircle').textContent, '100');
  }

  async function readingSecondAttemptIsClean() {
    currentName = 'reading · 再唸一次 leaves no residue';
    T.mode = 'android';
    await enterReading();
    $('recordBtn').click();
    await until('the microphone', () => T.live && T.live._running);
    T.hear('it does not matter', true);
    $('recordBtn').click();
    await scoreShown();
    $('retryBtn').click();
    await tick();
    check('result box closed', $('resultBox').hidden, 'result box still open');
    $('recordBtn').click();
    await until('the microphone again', () => T.live && T.live._running);
    T.hear('it does not matter at all i can wait for you here', true);
    $('recordBtn').click();
    await scoreShown();
    eq('second attempt is not mixed with the first', $('heardText').textContent,
      'it does not matter at all i can wait for you here');
    eq('score', $('scoreCircle').textContent, '100');
  }

  // ---- conversation --------------------------------------------------------

  async function chatOpensLocally() {
    currentName = 'chat · opening line is local and spoken';
    T.mode = 'desktop';
    T.spoken = [];
    T.chatHandler = () => { throw new Error('the opening line must not call the API'); };
    const before = T.fetches.filter((f) => f.url.includes('/api/chat')).length;
    await enterChat();
    eq('one AI bubble', document.querySelectorAll('#chatLog .bubble.ai').length, 1);
    eq('no API call for the opening', T.fetches.filter((f) => f.url.includes('/api/chat')).length, before);
    check('opening was spoken', T.spoken.join(' ').trim().length > 0, 'nothing spoken');
    check('opening is in the transcript', state.conversation.history.length === 1
      && state.conversation.history[0].role === 'model', JSON.stringify(state.conversation.history));
  }

  async function chatTurnAndroid() {
    currentName = 'chat · a student turn on android';
    T.mode = 'android';
    T.chatHandler = () => T.streamReply(['Nice!', ' What did you eat?']);
    await enterChat();
    T.spoken = [];
    const before = state.conversation.history.length;
    $('chatRecordBtn').click();
    await until('the microphone', () => T.live && T.live._running);
    ['i', 'i ate', 'i ate lunch'].forEach((t) => T.hear(t, false));
    T.hear('i ate lunch', true);
    T.live.stop();
    await until('the turn to finish', () => state.conversation.history.length === before + 2
      && !$('chatRecordBtn').disabled);
    const bubbles = [...document.querySelectorAll('#chatLog .bubble')].map((b) => b.querySelector('span').textContent);
    eq('student turn recorded once', bubbles[1], 'i ate lunch');
    eq('AI replied', bubbles[2].trim(), 'Nice! What did you eat?');
    eq('history length', state.conversation.history.length, 3);
    check('reply was spoken', T.spoken.join(' ').includes('Nice'), JSON.stringify(T.spoken));
    check('no stray typing bubble left', !$('typingBubble') && !$('streamBubble'), 'transient bubble left behind');
  }

  async function chatSpeaksSentenceBySentence() {
    currentName = 'chat · sentences are spoken as they arrive';
    T.mode = 'desktop';
    T.chatHandler = () => T.streamReply(['That sounds ', 'fun. Where ', 'did you go?']);
    await enterChat();
    T.spoken = [];
    await studentSays('i went out');
    const spoken = T.spoken.map((s) => s.trim()).filter(Boolean);
    eq('first sentence spoken on its own', spoken[0], 'That sounds fun.');
    eq('second sentence spoken after it', spoken[1], 'Where did you go?');
  }

  async function chatErrorDoesNotEnterHistory() {
    currentName = 'chat · an API error stays out of the transcript';
    T.mode = 'desktop';
    T.chatHandler = () => T.chatError(429, { error: '現在使用的人太多，請等幾秒再說一次。', retryable: true });
    await enterChat();
    const before = state.conversation.history.length;
    $('chatRecordBtn').click();
    await until('the microphone', () => T.live && T.live._running);
    T.hear('hello there', true);
    T.live.stop();
    await until('the error', () => $('chatStatus').textContent.includes('太多'));
    eq('only the student turn was added', state.conversation.history.length, before + 1);
    check('retry is hinted', $('chatStatus').textContent.includes('重試'), $('chatStatus').textContent);
    check('error text is not in the transcript',
      !state.conversation.history.some((t) => t.text.includes('太多')), 'error leaked into history');
    check('microphone re-enabled for a retry', !$('chatRecordBtn').disabled, 'button left disabled');
    check('no stray bubbles', !$('typingBubble') && !$('streamBubble'), 'transient bubble left behind');
  }

  async function chatRetryAfterErrorWorks() {
    currentName = 'chat · the retry after an error goes through';
    T.mode = 'desktop';
    T.chatHandler = () => T.chatError(429, { error: '現在使用的人太多，請等幾秒再說一次。', retryable: true });
    await enterChat();
    $('chatRecordBtn').click();
    await until('the microphone', () => T.live && T.live._running);
    T.hear('i like art', true);
    T.live.stop();
    await until('the error', () => $('chatStatus').textContent.includes('太多'));
    T.chatHandler = () => T.streamReply(['Art is great! What do you draw?']);
    await studentSays('i draw cats');
    const bubbles = [...document.querySelectorAll('#chatLog .bubble')].map((b) => b.querySelector('span').textContent.trim());
    check('both student turns kept', bubbles.filter((b) => b === 'i like art' || b === 'i draw cats').length === 2,
      JSON.stringify(bubbles));
    eq('AI answered the retry', bubbles[bubbles.length - 1], 'Art is great! What do you draw?');
  }

  async function chatEndSavesRecord() {
    currentName = 'chat · ending saves the practice';
    T.mode = 'desktop';
    T.chatHandler = (body) => T.streamReply([body.feedback ? '你今天說得很好。' : 'Great! Tell me more.']);
    await enterChat();
    await studentSays('i like music');
    const before = (await (await fetch('/api/teacher/records')).json()).records.length;
    $('endChatBtn').click();
    await until('the feedback', () => $('feedbackBox').textContent.includes('很好'));
    await wait(500);
    const after = await (await fetch('/api/teacher/records')).json();
    eq('one new record', after.records.length, before + 1);
    eq('stored as conversation', after.records[0].type, 'conversation');
    eq('student turns counted', after.records[0].userTurnCount, 1);
    check('feedback stored', (after.records[0].feedback || '').includes('很好'), 'feedback missing');
    check('transcript stored', (after.records[0].turns || []).length >= 2, 'turns missing');
    check('cannot double-save by pressing end again', $('endChatBtn').disabled, 'end button still enabled');
  }

  async function chatFeedbackFailureStillSaves() {
    currentName = 'chat · feedback fails but the practice is still saved';
    T.mode = 'desktop';
    T.chatHandler = (body) => (body.feedback
      ? T.chatError(500, { error: 'Gemini API 呼叫失敗' })
      : T.streamReply(['Sure! And you?']));
    await enterChat();
    await studentSays('i play basketball');
    const before = (await (await fetch('/api/teacher/records')).json()).records.length;
    $('endChatBtn').click();
    await until('the failure notice', () => $('feedbackBox').textContent.includes('回饋這次拿不到'));
    await wait(500);
    const after = await (await fetch('/api/teacher/records')).json();
    eq('record still saved', after.records.length, before + 1);
    check('no false claim of a failed save', !$('feedbackBox').textContent.includes('沒有送到老師'),
      $('feedbackBox').textContent);
  }

  async function chatLevelChangeRestarts() {
    currentName = 'chat · changing the level starts a fresh conversation';
    T.mode = 'desktop';
    T.chatHandler = () => T.streamReply(['Okay!']);
    await enterChat();
    await studentSays('hello');
    check('conversation has turns', state.conversation.history.length >= 3, 'no turns');
    const level = $('conversationLevel');
    level.value = '1200';
    level.onchange();
    await until('the fresh opening', () => state.conversation.history.length === 1);
    eq('level remembered', state.conversation.level, '1200');
    eq('one bubble only', document.querySelectorAll('#chatLog .bubble').length, 1);
  }

  // ---- speech playback -----------------------------------------------------

  async function ttsUnlockAndResume() {
    currentName = 'speech · unlock on touch, resume when paused';
    speechUnlocked = false;
    T.spoken = [];
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    check('unlocked by a touch', speechUnlocked, 'still locked');
    eq('a silent utterance was used', T.spoken.length, 1);
    T.spoken = [];
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    eq('only unlocked once', T.spoken.length, 0);

    T.ttsResumes = 0;
    window.speechSynthesis.pause();
    speak('Hello there.');
    check('resumed after speaking', T.ttsResumes > 0, 'never resumed');
  }

  // ---- phone-specific ------------------------------------------------------

  async function phoneGivesMicToRecognition() {
    currentName = 'phone · the recorder never takes the microphone';
    check('detected as a phone', isPhone, 'not detected as a phone');
    check('playback capture disabled', !audioSupported, 'audio capture still enabled');
    T.mode = 'android';
    T.recorderStarts = 0;
    await enterReading();
    $('recordBtn').click();
    await until('the microphone', () => T.live && T.live._running);
    eq('no MediaRecorder was created', T.recorderStarts, 0);
    T.hear('it does not matter at all i can wait for you here', true);
    $('recordBtn').click();
    await scoreShown();
    eq('score still produced', $('scoreCircle').textContent, '100');
    check('playback button stays hidden', $('playMineBtn').hidden, 'playback offered on a phone');
  }

  // ---- run -----------------------------------------------------------------

  window.runTests = async function (which) {
    const desktop = [
      readingDesktopWaitsForButton,
      readingAndroidSurvivesPauses,
      readingPartialScoresLower,
      readingScoresPunctuationFairly,
      readingBackButtonStops,
      readingSavesToBackend,
      readingSaveFailureIsVisible,
      readingSecondAttemptIsClean,
      chatOpensLocally,
      chatTurnAndroid,
      chatSpeaksSentenceBySentence,
      chatErrorDoesNotEnterHistory,
      chatRetryAfterErrorWorks,
      chatEndSavesRecord,
      chatFeedbackFailureStillSaves,
      chatLevelChangeRestarts,
      ttsUnlockAndResume,
    ];
    const suites = { desktop, slow: [readingDeadMicGivesUp], phone: [phoneGivesMicToRecognition] };
    const suite = suites[which] || desktop;
    results.length = 0;
    window.__progress = [];
    for (const fn of suite) {
      currentName = fn.name;
      window.__progress.push(fn.name);
      try {
        await Promise.race([
          fn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('scenario timed out')), 40000)),
        ]);
      } catch (e) {
        results.push({ test: currentName, check: 'threw', ok: false, detail: String((e && e.message) || e) });
      }
      T.chatHandler = null;
    }
    const failed = results.filter((r) => !r.ok);
    return { total: results.length, passed: results.length - failed.length, failed };
  };
})();
