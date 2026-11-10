(() => {
  'use strict';
  if (document.getElementById('teddy-music')) return;
  const base = new URL('.', document.currentScript.src);
  const POSITION_KEY = 'teddy:piano:position:v1';
  const PREFERENCE_KEY = 'teddy:piano:muted:v1';
  const LEVEL = .20;
  let saved = {}, muted = false;
  try { saved = JSON.parse(sessionStorage.getItem(POSITION_KEY) || '{}') || {}; } catch {}
  try { muted = localStorage.getItem(PREFERENCE_KEY) === 'true'; } catch {}
  let offset = Number.isFinite(saved.time) && saved.time >= 0 ? saved.time : 0;
  const resumeOffset = offset;
  let restored = false;
  let started = saved.started === true, starting = false, epoch = 0;
  let context, gain, source, ramp = 0, lastSave = 0;
  const audio = document.createElement('audio');
  audio.id = 'teddy-bgm';
  audio.preload = 'none';
  audio.loop = true;
  audio.setAttribute('aria-hidden', 'true');
  const control = document.createElement('div');
  control.id = 'teddy-music';
  control.dataset.resumeAt = String(resumeOffset);
  control.innerHTML = '<button type="button" class="piano-button" aria-label="Play soft piano music" aria-pressed="false"><span class="piano-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="piano-label">play piano</span></button><a class="piano-credit" target="_blank" rel="noopener" aria-label="Piano music credits" title="Piano music credits">i</a>';
  control.querySelector('a').href = new URL('credits.html', base).href;
  const button = control.querySelector('button');
  const label = control.querySelector('.piano-label');
  document.body.append(audio, control);

  function render(state) {
    control.dataset.state = state;
    document.documentElement.dataset.music = state;
    const active = state === 'playing' || state === 'loading';
    button.setAttribute('aria-pressed', String(state === 'playing'));
    button.setAttribute('aria-label', active ? 'Mute piano music' : 'Play soft piano music');
    label.textContent = state === 'playing' ? 'piano on' : state === 'loading' ? 'piano…' : muted ? 'piano off' : 'play piano';
    button.title = state === 'unavailable' ? 'The piano could not load. Tap to retry.' : active ? 'Soft piano · tap to mute' : 'Soft piano · tap to play';
  }

  function save(readPosition = true) {
    if (readPosition && restored && Number.isFinite(audio.currentTime) && audio.readyState > 0) offset = audio.currentTime;
    try { sessionStorage.setItem(POSITION_KEY, JSON.stringify({ time: offset, started })); } catch {}
  }

  function setLevel(value, fade = false) {
    cancelAnimationFrame(ramp);
    if (gain) {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      if (fade) gain.gain.setTargetAtTime(value, now, .45);
      else gain.gain.setValueAtTime(value, now);
      return;
    }
    const initial = audio.volume;
    if (!fade) { audio.volume = value; return; }
    const begin = performance.now();
    const step = now => {
      // A queued frame can carry a timestamp just before performance.now().
      const progress = Math.max(0, Math.min(1, (now - begin) / 1500));
      audio.volume = Math.max(0, Math.min(1, initial + (value - initial) * progress));
      if (progress < 1) ramp = requestAnimationFrame(step);
    };
    ramp = requestAnimationFrame(step);
  }

  function connectAudio() {
    if (context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    let next;
    try {
      next = new AudioContext();
      const nextGain = next.createGain();
      const nextSource = next.createMediaElementSource(audio);
      nextGain.gain.value = 0;
      nextSource.connect(nextGain).connect(next.destination);
      context = next; gain = nextGain; source = nextSource;
      audio.volume = 1;
    } catch {
      next?.close().catch(() => {});
      // Plain media playback remains available on browsers without Web Audio.
    }
  }

  async function play(fromGesture = false) {
    if (muted || document.hidden || starting || (!audio.paused && control.dataset.state === 'playing')) return;
    starting = true;
    const attempt = ++epoch;
    render('loading');
    if (fromGesture) connectAudio();
    setLevel(0);
    if (!audio.getAttribute('src')) audio.src = new URL('a-little-beginning.mp3', base).href;
    try {
      // Invoke both immediately while the user's activation is still available.
      const resumed = context?.state === 'suspended' ? context.resume() : Promise.resolve();
      await Promise.all([resumed, audio.play()]);
      if (attempt !== epoch || muted || document.hidden) {
        if (attempt === epoch || muted || document.hidden) audio.pause();
        return;
      }
      starting = false;
      started = true;
      setLevel(LEVEL, true);
      render('playing');
      save();
    } catch (error) {
      if (attempt !== epoch) return;
      starting = false;
      audio.pause();
      render(error?.name === 'NotAllowedError' ? 'waiting' : 'unavailable');
    }
  }

  function pause(readPosition = true) {
    ++epoch;
    starting = false;
    save(readPosition);
    setLevel(0);
    audio.pause();
    render(muted ? 'muted' : 'waiting');
  }

  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      try { audio.currentTime = resumeOffset % audio.duration; } catch {}
      restored = true;
    }
  });
  audio.addEventListener('timeupdate', () => {
    if (performance.now() - lastSave > 1000) { lastSave = performance.now(); save(); }
  });
  audio.addEventListener('error', () => {
    ++epoch; starting = false;
    render('unavailable');
  });
  button.addEventListener('click', () => {
    if (!muted && (starting || !audio.paused)) {
      muted = true;
      pause();
    } else {
      muted = false;
      if (audio.error) audio.removeAttribute('src');
      play(true);
    }
    try { localStorage.setItem(PREFERENCE_KEY, String(muted)); } catch {}
  });
  const interaction = event => {
    if (event.target.closest?.('#teddy-music')) return;
    if (event.type === 'keydown' && (event.ctrlKey || event.altKey || event.metaKey || !['Enter', ' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(event.key))) return;
    play(true);
  };
  document.addEventListener('pointerdown', interaction, { passive: true });
  document.addEventListener('keydown', interaction);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else if (started && !muted) play();
  });
  // A departing media element may have reset its playhead by pagehide. Keep
  // the last good sample rather than replacing it with a teardown-time zero.
  document.addEventListener('click', event => { if (event.target.closest?.('a[href]')) save(); }, { capture: true });
  window.addEventListener('pagehide', () => pause(false));
  window.addEventListener('pageshow', event => {
    if (event.persisted && started && !muted) play();
  });
  window.addEventListener('storage', event => {
    if (event.key !== PREFERENCE_KEY && event.key !== null) return;
    try { muted = localStorage.getItem(PREFERENCE_KEY) === 'true'; } catch { return; }
    if (muted) pause();
    else render(audio.paused ? 'waiting' : 'playing');
  });
  render(muted ? 'muted' : 'waiting');
  if (started && !muted) play();
})();
