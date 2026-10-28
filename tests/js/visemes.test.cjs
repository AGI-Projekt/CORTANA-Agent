const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("src/cortana/web/static/visemes.js", "utf8");

function makeHarness() {
  let now = 0;
  let nextTimerId = 1;
  const timers = new Map();
  const emitted = [];
  const wrapper = { dataset: {} };
  const window = {
    dispatchEvent(event) { emitted.push(event); },
    setTimeout(callback, delay) {
      const id = nextTimerId++;
      timers.set(id, { callback, due: now + Math.max(0, Number(delay) || 0) });
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };
  class MockCustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail || {}; }
  }
  vm.runInNewContext(source, {
    window,
    document: { getElementById: () => wrapper },
    CustomEvent: MockCustomEvent,
    performance: { now: () => now }
  }, { filename: "visemes.js" });

  function advance(ms) {
    const target = now + ms;
    let guard = 0;
    while (true) {
      let selected = null;
      for (const [id, timer] of timers) {
        if (timer.due <= target && (!selected || timer.due < selected.timer.due)) {
          selected = { id, timer };
        }
      }
      if (!selected) break;
      if (++guard > 5000) throw new Error("mock timer loop exceeded safety limit");
      now = selected.timer.due;
      timers.delete(selected.id);
      selected.timer.callback();
    }
    now = target;
  }
  return {
    scheduler: window.CortanaVisemeScheduler,
    emitted,
    wrapper,
    advance,
    get pendingTimers() { return timers.size; }
  };
}

test("classify maps common Polish characters to coarse mouth profiles", () => {
  const h = makeHarness();
  assert.equal(h.scheduler.classify("ą"), "open");
  assert.equal(h.scheduler.classify("ę"), "mid");
  assert.equal(h.scheduler.classify("o"), "round");
  assert.equal(h.scheduler.classify("m"), "closed");
  assert.equal(h.scheduler.classify("?"), "neutral");
});

test("timeline emits cues at declared offsets and returns to neutral", () => {
  const h = makeHarness();
  const result = h.scheduler.playTimeline([
    { atMs: 0, durationMs: 100, viseme: "open", character: "a" },
    { atMs: 100, durationMs: 80, viseme: "round", character: "o" }
  ], 0);
  assert.equal(result.scheduled, 2);
  assert.equal(h.emitted.at(-1).detail.viseme, "open");
  h.advance(100);
  assert.equal(h.emitted.at(-1).detail.viseme, "round");
  h.advance(80);
  assert.equal(h.emitted.at(-1).detail.viseme, "neutral");
});

test("timeline supports a future anchor without emitting early", () => {
  const h = makeHarness();
  h.scheduler.playTimeline([{ atMs: 0, durationMs: 50, viseme: "teeth" }], 200);
  assert.equal(h.emitted.at(-1).detail.viseme, "neutral");
  h.advance(200);
  assert.equal(h.emitted.at(-1).detail.viseme, "teeth");
  h.advance(50);
  assert.equal(h.emitted.at(-1).detail.viseme, "neutral");
});

test("timeline rejects malformed or oversized input before interrupting active state", () => {
  const h = makeHarness();
  h.scheduler.playTimeline([{ atMs: 0, durationMs: 100, viseme: "open" }], 0);
  assert.throws(() => h.scheduler.playTimeline([{ atMs: -1, durationMs: 20, viseme: "open" }], 0), /atMs/);
  assert.throws(() => h.scheduler.playTimeline([{ atMs: 0, durationMs: 10, viseme: "unknown" }], 0), /viseme/);
  assert.throws(() => h.scheduler.playTimeline(Array(513).fill({ atMs: 0, durationMs: 10, viseme: "open" }), 0), /too many/);
  assert.equal(h.scheduler.getMode(), "timeline");
});

test("reset cancels scheduled transitions and clears the mouth cue", () => {
  const h = makeHarness();
  h.scheduler.playTimeline([
    { atMs: 0, durationMs: 50, viseme: "open" },
    { atMs: 100, durationMs: 30, viseme: "round" }
  ], 0);
  const countBeforeReset = h.emitted.length;
  h.scheduler.reset();
  assert.equal(h.scheduler.getMode(), "idle");
  assert.equal(h.emitted.at(-1).detail.viseme, "neutral");
  h.advance(200);
  assert.equal(h.emitted.length, countBeforeReset + 1);
  assert.equal(h.pendingTimers, 0);
});

test("text queue interrupts timeline and can continue in approximate mode", () => {
  const h = makeHarness();
  h.scheduler.playTimeline([{ atMs: 0, durationMs: 1000, viseme: "round" }], 0);
  h.scheduler.enqueue("a");
  assert.equal(h.scheduler.getMode(), "text");
  assert.equal(h.emitted.at(-1).detail.viseme, "open");
});


test("audio-aligned timeline maps AudioContext timestamps onto monotonic playback time", () => {
  const h = makeHarness();
  const result = h.scheduler.playAudioAlignedTimeline([
    { audioTimeSeconds: 4.6, durationMs: 80, viseme: "open", character: "a" },
    { audioTimeSeconds: 4.7, durationMs: 60, viseme: "round", character: "o" }
  ], { anchorTimeMs: 0, contextTimeSeconds: 4.5 });
  assert.equal(result.scheduled, 2);
  assert.equal(h.emitted.at(-1).detail.viseme, "open");
  h.advance(100);
  assert.equal(h.emitted.at(-1).detail.viseme, "round");
});

test("audio-aligned timeline rejects missing anchors, invalid timestamps, and oversized input", () => {
  const h = makeHarness();
  assert.throws(() => h.scheduler.playAudioAlignedTimeline([], null), /anchor/);
  assert.throws(() => h.scheduler.playAudioAlignedTimeline([{audioTimeSeconds:NaN,durationMs:20,viseme:"open"}], {anchorTimeMs:0,contextTimeSeconds:0}), /audioTimeSeconds/);
  assert.throws(() => h.scheduler.playAudioAlignedTimeline(Array(513).fill({audioTimeSeconds:1,durationMs:20,viseme:"open"}), {anchorTimeMs:0,contextTimeSeconds:0}), /bounded array/);
});
