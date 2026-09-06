/* Test-only stubs. Loaded before app.js by _test.html. Never referenced by index.html. */
(function () {
  // ?phone=1 makes app.js believe it is running on an Android phone
  if (location.search.includes('phone=1')) {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',
      configurable: true,
    });
  }

  // ---- fake speech recognition engine -------------------------------------
  // Two engines, differing only in what they report for resultIndex:
  //   desktop: advances properly, honours `continuous`
  //   android: always reports 0, and ends the session at any pause
  const T = (window.__T = {
    mode: 'desktop',
    results: [],
    live: null,
    starts: 0,
    spoken: [],
    ttsCancels: 0,
    ttsResumes: 0,
    ttsPaused: false,
    recorderStarts: 0,
    fetches: [],
    chatHandler: null,
  });

  class FakeRecognition {
    constructor() {
      this.lang = '';
      this.continuous = false;
      this.interimResults = false;
      this.maxAlternatives = 1;
      this._running = false;
    }
    start() {
      if (this._running) throw new Error('InvalidStateError');
      this._running = true;
      T.starts++;
      T.live = this;
      T.results = [];
      setTimeout(() => this.onstart && this.onstart(), 0);
    }
    stop() {
      if (!this._running) return;
      this._running = false;
      setTimeout(() => this.onend && this.onend(), 0);
    }
    abort() { this.stop(); }
  }
  window.SpeechRecognition = FakeRecognition;

  // Feed one chunk of speech into whichever recognizer is running.
  T.hear = function (text, isFinal) {
    const rec = T.live;
    if (!rec || !rec._running) throw new Error('no live recognizer');
    const last = T.results[T.results.length - 1];
    let index;
    if (last && !last.isFinal) {
      T.results[T.results.length - 1] = mkResult(text, isFinal);
      index = T.results.length - 1;
    } else {
      T.results.push(mkResult(text, isFinal));
      index = T.results.length - 1;
    }
    rec.onresult({ resultIndex: T.mode === 'android' ? 0 : index, results: T.results });
  };

  // The phone's engine giving up at a pause.
  T.enginePause = function () {
    const rec = T.live;
    if (!rec || !rec._running) return;
    rec._running = false;
    rec.onend();
  };

  T.recognitionError = function (name) {
    const rec = T.live;
    if (rec) rec.onerror({ error: name });
  };

  function mkResult(transcript, isFinal) {
    const r = [{ transcript, confidence: 0.9 }];
    r.isFinal = !!isFinal;
    return r;
  }

  // ---- fake speech synthesis ----------------------------------------------
  // speechSynthesis and mediaDevices are read-only accessors on the real window,
  // so a plain assignment silently does nothing. They have to be redefined.
  window.SpeechSynthesisUtterance = function (text) { this.text = text; this.lang = ''; this.rate = 1; this.volume = 1; };
  const fakeSynth = {
    get paused() { return T.ttsPaused; },
    speaking: false,
    pending: false,
    speak(u) { T.spoken.push(u.text); },
    cancel() { T.ttsCancels++; },
    resume() { T.ttsResumes++; T.ttsPaused = false; },
    pause() { T.ttsPaused = true; },
    getVoices() { return []; },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true });

  // ---- fake microphone capture --------------------------------------------
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    configurable: true,
  });
  window.MediaRecorder = class {
    constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; T.recorderStarts++; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      setTimeout(() => this.ondataavailable && this.ondataavailable({ data: new Blob(['x']) }), 0);
      setTimeout(() => this.onstop && this.onstop(), 1);
    }
    get stream() { return { getTracks: () => [{ stop() {} }] }; }
  };
  window.URL.createObjectURL = () => 'blob:fake';
  window.URL.revokeObjectURL = () => {};

  // ---- fetch: real for data routes, scripted for /api/chat -----------------
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, options) => {
    T.fetches.push({ url: String(url), options });
    if (String(url).includes('/api/chat') && T.chatHandler) return T.chatHandler(JSON.parse(options.body));
    return realFetch(url, options);
  };

  // Deliver the reply in chunks, like the real route does, so the app's
  // read-as-you-go path is what gets exercised.
  T.streamReply = (chunks) => {
    const parts = Array.isArray(chunks) ? chunks : [chunks];
    const body = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        for (const part of parts) {
          controller.enqueue(enc.encode(part));
          await new Promise((r) => setTimeout(r, 10));
        }
        controller.close();
      },
    });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  };
  T.chatError = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
})();
