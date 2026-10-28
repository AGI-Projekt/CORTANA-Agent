const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("src/cortana/web/static/gesture-sequencer.js", "utf8");

function harness() {
  let now = 0, nextId = 1;
  const timers = new Map(), events = [];
  const window = {
    dispatchEvent(event) { events.push(event); },
    addEventListener(type, callback) { this.listener = callback; },
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, due: now + Math.max(0, Number(delay) || 0) });
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };
  class MockCustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail || {}; } }
  vm.runInNewContext(source, { window, CustomEvent: MockCustomEvent, performance: { now: () => now }, Number, Object, Array, Math, TypeError, RangeError }, { filename: "gesture-sequencer.js" });
  function advance(ms) {
    const target = now + ms;
    let guard = 0;
    while (true) {
      let selected = null;
      for (const [id, timer] of timers) if (timer.due <= target && (!selected || timer.due < selected.timer.due)) selected = { id, timer };
      if (!selected) break;
      if (++guard > 5000) throw new Error("timer loop safety limit");
      now = selected.timer.due; timers.delete(selected.id); selected.timer.callback();
    }
    now = target;
  }
  return { sequencer: window.CortanaGestureSequencer, events, advance, window, get pendingTimers() { return timers.size; } };
}

test("named speaking sequence emits bounded pose frames at timestamped boundaries", () => {
  const h = harness();
  const result = h.sequencer.play("speaking", 0);
  assert.equal(result.scheduled, 4);
  assert.equal(h.events.at(-1).type, "cortana:gesture-frame");
  assert.equal(h.events.at(-1).detail.gesture, "present");
  h.advance(520);
  assert.equal(h.events.at(-1).detail.gesture, "explain");
  h.advance(4000);
  assert.equal(h.sequencer.active, false);
  assert.equal(h.events.at(-1).detail.gesture, "rest");
});

test("future anchor waits and cancel interrupts queued gestures", () => {
  const h = harness();
  h.sequencer.playTimeline([{atMs:0,durationMs:100,gesture:"open",intensity:1}], 250);
  assert.equal(h.events.at(-1).detail.gesture, "rest");
  h.advance(250);
  assert.equal(h.events.at(-1).detail.gesture, "open");
  h.sequencer.cancel();
  const count = h.events.length;
  h.advance(500);
  assert.equal(h.events.length, count);
  assert.equal(h.pendingTimers, 0);
});

test("invalid gestures are rejected before interrupting the active sequence", () => {
  const h = harness();
  h.sequencer.play("speaking", 0);
  assert.throws(() => h.sequencer.playTimeline([{atMs:-1,durationMs:20,gesture:"open"}], 0), /atMs/);
  assert.throws(() => h.sequencer.playTimeline([{atMs:0,durationMs:20,gesture:"unknown"}], 0), /unsupported gesture/);
  assert.throws(() => h.sequencer.playTimeline(Array(97).fill({atMs:0,durationMs:20,gesture:"open"}), 0), /too many/);
  assert.equal(h.sequencer.active, true);
});

test("voice state starts and cancels the speaking sequence", () => {
  const h = harness();
  h.window.listener({detail:{speaking:true}});
  assert.equal(h.sequencer.active, true);
  h.window.listener({detail:{speaking:false}});
  assert.equal(h.sequencer.active, false);
  assert.equal(h.events.at(-1).detail.source, "cancel");
});
