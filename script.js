(() => {
  'use strict';
  // Midnight, May 16 2028, Nepal (UTC+05:45, no DST)
  const TARGET_MS = Date.parse('2028-05-16T00:00:00+05:45');
  const NPT_OFFSET_MS = (5 * 60 + 45) * 60000;
  let clockOffset = 0; // optional server-time correction; 0 = local clock
  const now = () => Date.now() + clockOffset;

  const els = Object.fromEntries(['months','days','hours','minutes','seconds'].map(k => [k, document.getElementById(k)]));
  const pad = n => String(Math.max(0, n)).padStart(2, '0');

  // Add whole calendar months to a "Nepal-shifted" timestamp (read with UTC getters), clamping the day.
  function addMonths(shifted, months) {
    const d = new Date(shifted);
    const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
    const y = Math.floor(total / 12), m = total % 12;
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(d.getUTCDate(), dim), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  }

  function remaining(nowMs) {
    if (nowMs >= TARGET_MS) return [0, 0, 0, 0, 0];
    const a = nowMs + NPT_OFFSET_MS, b = TARGET_MS + NPT_OFFSET_MS; // shifted into NPT wall-clock
    const da = new Date(a), db = new Date(b);
    let months = (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + db.getUTCMonth() - da.getUTCMonth();
    while (months > 0 && addMonths(a, months) > b) months--;
    const rest = Math.max(0, b - addMonths(a, months));
    const s = Math.floor(rest / 1000);
    return [months, Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
  }

  function render() {
    const v = remaining(now());
    ['months','days','hours','minutes','seconds'].forEach((k, i) => {
      const t = pad(v[i]); if (els[k].textContent !== t) els[k].textContent = t;
    });
    return v.some(x => x > 0);
  }

  // ---- Tick-tock (Web Audio, synthesized) ----
  let ctx = null, tickCount = 0;
  function ensureAudio() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  }
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    const odd = tickCount++ % 2, t = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain(), filt = ctx.createBiquadFilter();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(odd ? 760 : 1000, t);
    osc.frequency.exponentialRampToValueAtTime(odd ? 420 : 560, t + .05);
    filt.type = 'lowpass'; filt.frequency.value = 2200;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + .004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + .09);
    osc.connect(filt).connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + .1);
  }
  // Browsers require a gesture before audio; arm on first interaction.
  ['pointerdown','keydown','touchstart'].forEach(e => window.addEventListener(e, ensureAudio, { passive: true }));

  // ---- Second-boundary loop: always re-derives time from the clock, never counts ----
  let timer = null;
  function loop() {
    const active = render();
    if (active) tick();
    if (!active) return; // finished: stays at zeros
    timer = setTimeout(loop, 1000 - (now() % 1000) + 5);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { clearTimeout(timer); const active = render(); if (active) timer = setTimeout(loop, 1000 - (now() % 1000) + 5); }
  });
  loop();

  // ---- Optional time sync (never blocks; silent fallback to local clock) ----
  (function sync() {
    if (!navigator.onLine || !/^https?:$/.test(location.protocol)) return;
    const t0 = Date.now();
    fetch(location.href, { method: 'HEAD', cache: 'no-store' }).then(r => {
      const h = r.headers.get('Date'); if (!h) return;
      const t1 = Date.now(), server = Date.parse(h) + 500; // header has 1s resolution
      if (!isNaN(server) && Math.abs(server - (t0 + t1) / 2) < 36e5) clockOffset = server - (t0 + t1) / 2;
    }).catch(() => {});
  })();

  // ---- Music ----
  const bgm = document.getElementById('bgm'), btn = document.getElementById('music'), label = document.getElementById('musicText');
  const setUi = on => { btn.setAttribute('aria-pressed', on); label.textContent = on ? 'MUSIC ON' : 'MUSIC OFF'; };
  btn.addEventListener('click', async () => {
    if (bgm.paused) {
      try { await bgm.play(); setUi(true); } catch (e) { setUi(false); label.textContent = 'AUDIO UNAVAILABLE'; setTimeout(() => setUi(false), 2000); }
    } else { bgm.pause(); setUi(false); }
  });
  bgm.addEventListener('error', () => setUi(false));
  setUi(false);
})();
