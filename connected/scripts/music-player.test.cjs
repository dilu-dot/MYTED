const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../intro/public/music/player.js'), 'utf8');

function setup({ muted = false, position, blocked = false } = {}) {
  const element = () => ({ dataset: {}, attributes: {}, events: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; },
    removeAttribute(k) { delete this.attributes[k]; },
    addEventListener(k, v) { this.events[k] = v; },
    fire(k, value = {}) { return this.events[k]?.(value); } });
  const button = element(), label = element(), credit = element();
  const control = element();
  control.querySelector = selector => selector === 'a' ? credit : selector === 'button' ? button : label;
  const audio = Object.assign(element(), { paused: true, currentTime: 0, readyState: 0, duration: 60, volume: 1,
    attempts: 0, playResult: () => Promise.resolve(),
    play() { this.attempts++; this.paused = false; return this.playResult(); },
    pause() { this.paused = true; } });
  Object.defineProperty(audio, 'src', { set(v) { audio.attributes.src = v; }, get() { return audio.attributes.src; } });
  const session = new Map(position ? [['teddy:piano:position:v1', JSON.stringify(position)]] : []);
  const local = new Map(muted ? [['teddy:piano:muted:v1', 'true']] : []);
  const storage = map => ({ getItem(k) { if (blocked) throw Error('Storage blocked'); return map.get(k) ?? null; },
    setItem(k, v) { if (blocked) throw Error('Storage blocked'); map.set(k, v); } });
  const document = Object.assign(element(), { hidden: false, currentScript: { src: 'https://example.com/MYTED/music/player.js' },
    documentElement: element(), body: { append() {} }, getElementById() { return null; },
    createElement(tag) { return tag === 'audio' ? audio : control; } });
  const window = element();
  vm.runInNewContext(code, { document, window, sessionStorage: storage(session), localStorage: storage(local),
    URL, performance: { now: () => 2000 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
  return { audio, document, window, button, control, session, local,
    tap: () => document.fire('pointerdown', { target: { closest: () => false } }),
    state: () => control.dataset.state };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('first visit waits for interaction without fetching audio', async () => {
  const app = setup();
  assert.equal(app.state(), 'waiting');
  assert.equal(app.audio.attempts, 0);
  assert.equal(app.audio.src, undefined);
  app.tap(); await settle();
  assert.equal(app.state(), 'playing');
  assert.equal(app.audio.src, 'https://example.com/MYTED/music/a-little-beginning.mp3');
});

test('browser autoplay rejection can be retried on the next tap', async () => {
  const app = setup();
  app.audio.playResult = () => Promise.reject({ name: 'NotAllowedError' });
  app.tap(); await settle();
  assert.equal(app.state(), 'waiting');
  app.audio.playResult = () => Promise.resolve();
  app.tap(); await settle();
  assert.equal(app.state(), 'playing');
});

test('muting during a pending play prevents late audible playback', async () => {
  const app = setup(); let resolve;
  app.audio.playResult = () => new Promise(done => { resolve = done; });
  app.tap();
  app.button.fire('click');
  resolve(); await settle();
  assert.equal(app.state(), 'muted');
  assert.equal(app.audio.paused, true);
  assert.equal(app.local.get('teddy:piano:muted:v1'), 'true');
});

test('a remembered mute stays off on general page interaction', async () => {
  const app = setup({ muted: true, position: { started: true, time: 24 } });
  app.tap(); await settle();
  assert.equal(app.audio.attempts, 0);
  assert.equal(app.state(), 'muted');
  app.button.fire('click'); await settle();
  assert.equal(app.state(), 'playing');
});

test('background tabs pause and visible tabs resume without losing position', async () => {
  const app = setup(); app.tap(); await settle();
  app.audio.readyState = 1; app.audio.fire('loadedmetadata'); app.audio.currentTime = 23;
  app.document.hidden = true; app.document.fire('visibilitychange');
  assert.equal(app.audio.paused, true);
  assert.equal(JSON.parse(app.session.get('teddy:piano:position:v1')).time, 23);
  app.document.hidden = false; app.document.fire('visibilitychange'); await settle();
  assert.equal(app.state(), 'playing');
});

test('a new page restores the playhead and requests the same loop', async () => {
  const app = setup({ position: { started: true, time: 37.5 } });
  app.audio.readyState = 1;
  app.audio.fire('timeupdate'); // A zero-time event must not clobber the resume point.
  app.audio.fire('loadedmetadata'); await settle();
  assert.equal(app.audio.currentTime, 37.5);
  assert.equal(app.state(), 'playing');
});

test('private browsing without storage still supports play and mute', async () => {
  const app = setup({ blocked: true });
  app.tap(); await settle();
  assert.equal(app.state(), 'playing');
  app.button.fire('click');
  assert.equal(app.state(), 'muted');
});
