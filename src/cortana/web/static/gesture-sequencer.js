/* Gesture Sequencer v1.3.0
 * Bounded, interruptible gesture timelines driven by monotonic-clock offsets.
 * These are avatar presentation cues, not emotion inference.
 */
(() => {
  "use strict";
  const MAX_EVENTS = 96;
  const MAX_OFFSET_MS = 30000;
  const MAX_DURATION_MS = 8000;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const SEQUENCES = Object.freeze({
    speaking: Object.freeze([
      Object.freeze({ atMs: 0, durationMs: 420, gesture: "present", intensity: 0.45 }),
      Object.freeze({ atMs: 520, durationMs: 360, gesture: "explain", intensity: 0.34 }),
      Object.freeze({ atMs: 1120, durationMs: 420, gesture: "present", intensity: 0.4 }),
      Object.freeze({ atMs: 1780, durationMs: 260, gesture: "rest", intensity: 0.2 })
    ]),
    listening: Object.freeze([
      Object.freeze({ atMs: 0, durationMs: 700, gesture: "open", intensity: 0.18 }),
      Object.freeze({ atMs: 900, durationMs: 420, gesture: "rest", intensity: 0.12 })
    ]),
    emphasis: Object.freeze([
      Object.freeze({ atMs: 0, durationMs: 520, gesture: "present", intensity: 0.8 }),
      Object.freeze({ atMs: 680, durationMs: 300, gesture: "rest", intensity: 0.2 })
    ])
  });
  const POSES = Object.freeze({
    rest: Object.freeze({ armLift: 0, armOpen: 0, wristTurn: 0 }),
    open: Object.freeze({ armLift: 0.12, armOpen: 0.22, wristTurn: 0.04 }),
    present: Object.freeze({ armLift: 0.24, armOpen: 0.32, wristTurn: 0.1 }),
    explain: Object.freeze({ armLift: 0.16, armOpen: 0.2, wristTurn: -0.08 })
  });
  let timers = [];
  let generation = 0;
  let active = false;

  function normalize(events) {
    if (!Array.isArray(events) || events.length > MAX_EVENTS) throw new RangeError("gesture sequence has too many events");
    return events.map((event, index) => {
      if (!event || typeof event !== "object") throw new TypeError("invalid gesture event");
      const atMs = Number(event.atMs), durationMs = Number(event.durationMs);
      if (!Number.isFinite(atMs) || atMs < 0 || atMs > MAX_OFFSET_MS) throw new RangeError("gesture atMs out of bounds");
      if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_DURATION_MS) throw new RangeError("gesture durationMs out of bounds");
      if (!Object.prototype.hasOwnProperty.call(POSES, event.gesture)) throw new TypeError("unsupported gesture");
      const intensity = Number(event.intensity === undefined ? 1 : event.intensity);
      if (!Number.isFinite(intensity)) throw new TypeError("gesture intensity must be finite");
      return { atMs, durationMs, gesture: event.gesture, intensity: clamp(intensity, 0, 1), index };
    }).sort((a, b) => a.atMs - b.atMs || a.index - b.index);
  }
  function emit(event, source) {
    const pose = POSES[event.gesture];
    window.dispatchEvent(new CustomEvent("cortana:gesture-frame", { detail: {
      gesture: event.gesture, source: source || "sequence",
      armLift: pose.armLift * event.intensity,
      armOpen: pose.armOpen * event.intensity,
      wristTurn: pose.wristTurn * event.intensity,
      intensity: event.intensity
    }}));
  }
  function cancel() {
    generation += 1;
    for (const timer of timers) window.clearTimeout(timer);
    timers = [];
    active = false;
    emit({gesture:"rest", intensity:0}, "cancel");
  }
  function playTimeline(events, anchorTimeMs) {
    const normalized = normalize(events);
    const anchor = anchorTimeMs === undefined ? performance.now() : Number(anchorTimeMs);
    if (!Number.isFinite(anchor)) throw new TypeError("anchorTimeMs must be finite");
    cancel();
    if (!normalized.length) return {scheduled:0};
    active = true;
    const ownGeneration = generation;
    const boundaries = Array.from(new Set(normalized.flatMap(e => [e.atMs, e.atMs + e.durationMs]))).sort((a,b)=>a-b);
    const poseAt = offset => {
      let current = null;
      for (const event of normalized) if (event.atMs <= offset && event.atMs + event.durationMs > offset &&
        (!current || event.atMs > current.atMs || (event.atMs === current.atMs && event.index > current.index))) current = event;
      emit(current || {gesture:"rest",intensity:0}, "timeline");
    };
    poseAt(performance.now() - anchor);
    for (const boundary of boundaries) {
      if (boundary <= performance.now() - anchor) continue;
      const timer = window.setTimeout(() => {
        timers = timers.filter(t => t !== timer);
        if (generation === ownGeneration && active) poseAt(boundary);
        if (generation === ownGeneration && timers.length === 0) active = false;
      }, Math.max(0, anchor + boundary - performance.now()));
      timers.push(timer);
    }
    return {scheduled: normalized.length};
  }
  function play(name, anchorTimeMs) {
    if (!Object.prototype.hasOwnProperty.call(SEQUENCES, name)) throw new TypeError("unknown gesture sequence");
    return playTimeline(SEQUENCES[name], anchorTimeMs);
  }
  window.CortanaGestureSequencer = Object.freeze({
    play, playTimeline, cancel,
    get active() { return active; },
    getSequences: () => SEQUENCES,
    limits: Object.freeze({maxEvents:MAX_EVENTS,maxOffsetMs:MAX_OFFSET_MS,maxDurationMs:MAX_DURATION_MS})
  });
  window.addEventListener("cortana:voice-state", event => {
    const detail = event && event.detail || {};
    if (detail.speaking === true) play("speaking");
    else if (detail.speaking === false) cancel();
  });
})();