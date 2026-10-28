const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("src/cortana/web/static/audio-clock.js", "utf8");

function harness({ timestamp, currentTime = 4.5, now = 9000, throwTimestamp = false } = {}) {
  const events = [];
  const window = { dispatchEvent(event) { events.push(event); } };
  class MockCustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail || {}; }
  }
  vm.runInNewContext(source, {
    window, CustomEvent: MockCustomEvent, performance: { now: () => now },
    Number, Object, TypeError, RangeError
  }, { filename: "audio-clock.js" });
  const context = {
    currentTime,
    getOutputTimestamp() {
      if (throwTimestamp) throw new Error("not supported");
      return timestamp;
    }
  };
  return { clock: window.CortanaAudioClock, context, events };
}

test("capturePlaybackAnchor uses output timestamp when supported", () => {
  const h = harness({ timestamp: { contextTime: 4.4, performanceTime: 8750 } });
  const anchor = h.clock.capturePlaybackAnchor(h.context);
  assert.equal(anchor.anchorTimeMs, 8750);
  assert.equal(anchor.contextTimeSeconds, 4.4);
  assert.equal(anchor.source, "audio-output-timestamp");
  assert.equal(h.clock.performanceTimeForContextTime(4.5, anchor), 8850);
});

test("capturePlaybackAnchor falls back for invalid timestamp", () => {
  const h = harness({ timestamp: { contextTime: NaN, performanceTime: 0 } });
  const anchor = h.clock.capturePlaybackAnchor(h.context);
  assert.equal(anchor.anchorTimeMs, 9000);
  assert.equal(anchor.contextTimeSeconds, 4.5);
  assert.equal(anchor.source, "performance-fallback");
});

test("capturePlaybackAnchor falls back when getOutputTimestamp throws", () => {
  const h = harness({ throwTimestamp: true });
  const anchor = h.clock.capturePlaybackAnchor(h.context);
  assert.equal(anchor.source, "performance-fallback");
});

test("markOutputStart broadcasts and remembers anchor; reset clears it", () => {
  const h = harness({ timestamp: { contextTime: 2, performanceTime: 3000 }, currentTime: 2.1 });
  const anchor = h.clock.markOutputStart(h.context);
  assert.equal(h.clock.getLatestAnchor().anchorTimeMs, anchor.anchorTimeMs);
  assert.equal(h.events.at(-1).type, "cortana:audio-playout-anchor");
  h.clock.resetOutputAnchor();
  assert.equal(h.clock.getLatestAnchor(), null);
  assert.equal(h.events.at(-1).type, "cortana:audio-playout-reset");
});

test("scheduleTimeline requires captured anchor and calls scheduler at that time", () => {
  const h = harness({ timestamp: { contextTime: 1, performanceTime: 1500 }, currentTime: 1.1 });
  const scheduler = { playTimeline(events, anchorTimeMs) {
    return { scheduled: events.length, anchorTimeMs };
  }};
  assert.throws(() => h.clock.scheduleTimeline(scheduler, []), /No audio playout anchor/);
  assert.throws(() => h.clock.scheduleTimeline({}, []), /viseme scheduler/);
  h.clock.markOutputStart(h.context);
  const result = h.clock.scheduleTimeline(scheduler, [{ viseme: "open" }]);
  assert.equal(result.scheduled, 1);
  assert.equal(result.anchorTimeMs, 1500);
});

test("invalid AudioContext input is rejected", () => {
  const h = harness({});
  assert.throws(() => h.clock.capturePlaybackAnchor(null), /AudioContext/);
});


test("scheduleAudioAlignedTimeline delegates audio-clock events with captured anchor", () => {
  const h = harness({ timestamp: { contextTime: 3.5, performanceTime: 6500 }, currentTime: 3.6 });
  const scheduler = { playAudioAlignedTimeline(events, anchor) {
    return { scheduled: events.length, anchorTimeMs: anchor.anchorTimeMs, contextTimeSeconds: anchor.contextTimeSeconds };
  }};
  assert.throws(() => h.clock.scheduleAudioAlignedTimeline(scheduler, []), /No audio playout anchor/);
  h.clock.markOutputStart(h.context);
  const result = h.clock.scheduleAudioAlignedTimeline(scheduler, [{audioTimeSeconds:3.6}]);
  assert.equal(result.anchorTimeMs, 6500);
  assert.equal(result.contextTimeSeconds, 3.5);
});
