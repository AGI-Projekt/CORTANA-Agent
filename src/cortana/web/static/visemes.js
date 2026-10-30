/* Viseme scheduler for the procedural avatar.
 * Text deltas use approximate grapheme timing; playTimeline accepts externally aligned
 * timestamp events when a provider supplies audio-clock timestamps. Transcript timing is not phoneme timing.
 */
(() => {
  "use strict";
  const wrapper = document.getElementById("avatar");
  const profiles = Object.freeze({
    a:"open", ą:"open", e:"mid", ę:"mid",
    i:"wide", y:"wide", j:"wide",
    o:"round", ó:"round", u:"round",
    m:"closed", b:"closed", p:"closed",
    f:"teeth", v:"teeth", w:"teeth"
  });
  const valid = new Set(["neutral", "open", "mid", "wide", "round", "closed", "teeth"]);
  const MAX_TEXT_QUEUE = 1600;
  const MAX_TIMELINE_EVENTS = 512;
  const MAX_OFFSET_MS = 120000;
  const MAX_DURATION_MS = 5000;

  function classify(character) {
    const ch = String(character || "").toLocaleLowerCase("pl-PL");
    if (/^[.!?,;:…]$/.test(ch)) return "neutral";
    const viseme = profiles[ch] || "neutral";
    return valid.has(viseme) ? viseme : "neutral";
  }
  function durationFor(character, viseme) {
    if (/^[.!?…]$/.test(character)) return 155;
    if (/^[,;:]$/.test(character)) return 105;
    if (/^\s$/.test(character)) return 32;
    if (["open", "mid", "round"].includes(viseme)) return 76;
    if (["closed", "teeth"].includes(viseme)) return 58;
    return 48;
  }

  let queue = [];
  let queueTimer = null;
  let timelineTimers = [];
  let generation = 0;
  let mode = "idle";

  function emit(viseme, character, durationMs, source) {
    if (wrapper) wrapper.dataset.viseme = viseme;
    window.dispatchEvent(new CustomEvent("cortana:viseme", {
      detail: {
        viseme,
        character: character || "",
        durationMs: durationMs || 0,
        source: source || "text"
      }
    }));
  }

  function cancelTimers() {
    if (queueTimer !== null) window.clearTimeout(queueTimer);
    queueTimer = null;
    for (const timer of timelineTimers) window.clearTimeout(timer);
    timelineTimers = [];
  }

  function reset() {
    generation += 1;
    cancelTimers();
    queue = [];
    mode = "idle";
    emit("neutral", "", 0, "reset");
  }

  function drain(expectedGeneration) {
    if (expectedGeneration !== generation || mode !== "text") return;
    const item = queue.shift();
    if (!item) {
      emit("neutral", "", 0, "text");
      queueTimer = null;
      mode = "idle";
      return;
    }
    emit(item.viseme, item.character, item.durationMs, "text");
    queueTimer = window.setTimeout(() => {
      queueTimer = null;
      drain(expectedGeneration);
    }, item.durationMs);
  }

  function enqueue(text) {
    if (typeof text !== "string" || !text) return;
    if (mode === "timeline") reset();
    if (mode === "idle") mode = "text";
    for (const character of Array.from(text)) {
      const viseme = classify(character);
      queue.push({character, viseme, durationMs: durationFor(character, viseme)});
    }
    if (queue.length > MAX_TEXT_QUEUE) queue = queue.slice(-MAX_TEXT_QUEUE);
    if (queueTimer === null) drain(generation);
  }

  function normalizeTimeline(events) {
    if (!Array.isArray(events)) throw new TypeError("timeline events must be an array");
    if (events.length > MAX_TIMELINE_EVENTS) throw new RangeError("timeline contains too many events");
    return events.map((event, index) => {
      if (!event || typeof event !== "object") throw new TypeError("invalid timeline event");
      const atMs = Number(event.atMs);
      const durationMs = Number(event.durationMs);
      if (!Number.isFinite(atMs) || atMs < 0 || atMs > MAX_OFFSET_MS) {
        throw new RangeError("atMs must be between 0 and 120000");
      }
      if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_DURATION_MS) {
        throw new RangeError("durationMs must be between 0 and 5000");
      }
      if (typeof event.viseme !== "string" || !valid.has(event.viseme)) {
        throw new TypeError("unsupported viseme");
      }
      const character = event.character === undefined ? "" : event.character;
      if (typeof character !== "string" || character.length > 8) {
        throw new TypeError("character must be a short string");
      }
      return {atMs, durationMs, viseme: event.viseme, character, index};
    }).sort((left, right) => left.atMs - right.atMs || left.index - right.index);
  }

  function playTimeline(events, anchorTimeMs) {
    // Validate before resetting so malformed input cannot interrupt an active animation.
    const normalized = normalizeTimeline(events);
    const anchor = anchorTimeMs === undefined ? performance.now() : Number(anchorTimeMs);
    if (!Number.isFinite(anchor)) throw new TypeError("anchorTimeMs must be finite");
    reset();
    if (normalized.length === 0) return {scheduled: 0};
    mode = "timeline";
    const ownGeneration = generation;
    const boundaries = Array.from(new Set(normalized.flatMap(event => [
      event.atMs, event.atMs + event.durationMs
    ]))).sort((left, right) => left - right);

    function cueAt(offsetMs) {
      let active = null;
      for (const event of normalized) {
        if (event.atMs <= offsetMs && event.atMs + event.durationMs > offsetMs) {
          if (!active || event.atMs > active.atMs ||
              (event.atMs === active.atMs && event.index > active.index)) active = event;
        }
      }
      return active;
    }
    function emitAt(offsetMs) {
      const event = cueAt(offsetMs);
      if (event) emit(event.viseme, event.character, event.durationMs, "timeline");
      else emit("neutral", "", 0, "timeline");
    }

    const elapsed = performance.now() - anchor;
    emitAt(elapsed);
    for (const boundary of boundaries) {
      if (boundary <= elapsed) continue;
      let timer = null;
      timer = window.setTimeout(() => {
        timelineTimers = timelineTimers.filter(item => item !== timer);
        if (generation === ownGeneration && mode === "timeline") emitAt(boundary);
      }, Math.max(0, anchor + boundary - performance.now()));
      timelineTimers.push(timer);
    }
    return {scheduled: normalized.length};
  }

  function playAudioAlignedTimeline(events, anchor) {
    if (!anchor || !Number.isFinite(anchor.anchorTimeMs) || !Number.isFinite(anchor.contextTimeSeconds)) {
      throw new TypeError("a valid audio playout anchor is required");
    }
    if (!Array.isArray(events) || events.length > MAX_TIMELINE_EVENTS) {
      throw new RangeError("audio-aligned events must be a bounded array");
    }
    const mapped = events.map(event => {
      if (!event || typeof event !== "object" ||
          typeof event.audioTimeSeconds !== "number" || !Number.isFinite(event.audioTimeSeconds) ||
          event.audioTimeSeconds < 0 || event.audioTimeSeconds > 86400) {
        throw new TypeError("audioTimeSeconds must be a finite AudioContext timestamp");
      }
      // Normalize floating-point AudioContext seconds to integer milliseconds so
      // decimal timestamps such as 4.7 - 4.5 do not drift past a timer boundary.
      const atMs = Math.round((event.audioTimeSeconds - anchor.contextTimeSeconds) * 1000);
      if (atMs < -MAX_OFFSET_MS || atMs > MAX_OFFSET_MS) {
        throw new RangeError("audio timestamp is outside the supported anchor window");
      }
      return { atMs: Math.max(0, atMs), durationMs: event.durationMs, viseme: event.viseme, character: event.character || "" };
    });
    const calibrationOffset = window.CortanaLipSyncCalibration
      ? window.CortanaLipSyncCalibration.getOffsetMs() : 0;
    const calibratedAnchor = Object.assign({}, anchor, {
      anchorTimeMs: anchor.anchorTimeMs + calibrationOffset
    });
    return playTimeline(mapped, calibratedAnchor.anchorTimeMs);
  }

  window.CortanaVisemeScheduler = Object.freeze({
    classify, enqueue, playTimeline, playAudioAlignedTimeline, reset,
    getMode: () => mode,
    limits: Object.freeze({
      maxTextQueue: MAX_TEXT_QUEUE,
      maxTimelineEvents: MAX_TIMELINE_EVENTS,
      maxOffsetMs: MAX_OFFSET_MS,
      maxDurationMs: MAX_DURATION_MS
    })
  });
})();
