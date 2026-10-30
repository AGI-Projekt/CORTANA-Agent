/* Real-time viseme provider bridge — v1.5.0
 * Provider adapters supply timestamped visemes; this module never infers phonemes from text.
 */
(() => {
  "use strict";
  const MAX_BATCH = 128;
  const MAX_BUFFER = 512;
  const MAX_LATENESS_MS = 1200;
  const MAX_FUTURE_MS = 30000;
  const validVisemes = new Set(["neutral","open","mid","wide","round","closed","teeth"]);
  let state = "idle";
  let source = null;
  let unsubscribe = null;
  let pending = [];
  let flushTimer = null;
  let anchor = null;
  let sequence = 0;

  function emit(type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }
  function validateBatch(batch) {
    if (!Array.isArray(batch) || batch.length === 0 || batch.length > MAX_BATCH) {
      throw new RangeError("provider batch must contain 1 to 128 events");
    }
    return batch.map(item => {
      if (!item || typeof item !== "object" ||
          !Number.isFinite(item.audioTimeSeconds) || item.audioTimeSeconds < 0 ||
          item.audioTimeSeconds > 86400 ||
          !Number.isFinite(item.durationMs) || item.durationMs <= 0 || item.durationMs > 5000 ||
          !validVisemes.has(item.viseme)) {
        throw new TypeError("invalid provider viseme event");
      }
      const character = item.character === undefined ? "" : item.character;
      if (typeof character !== "string" || character.length > 8) throw new TypeError("invalid viseme character");
      return Object.freeze({audioTimeSeconds:item.audioTimeSeconds,durationMs:item.durationMs,viseme:item.viseme,character});
    });
  }
  function flush() {
    flushTimer = null;
    if (state !== "connected" || !pending.length || !anchor) return;
    const events = pending.splice(0, MAX_BATCH);
    emit("cortana:audio-aligned-visemes", {
      audioEvents: events, anchor, providerSequence: ++sequence, source: "realtime-viseme-provider"
    });
  }
  function scheduleFlush() {
    if (flushTimer === null) flushTimer = window.setTimeout(flush, 0);
  }
  function push(batch) {
    if (state !== "connected") throw new Error("viseme provider is not connected");
    const normalized = validateBatch(batch);
    const nowPerformanceMs = performance.now();
    const accepted = normalized.filter(item => {
      const duePerformanceMs = anchor.anchorTimeMs +
        (item.audioTimeSeconds - anchor.contextTimeSeconds) * 1000;
      const deltaMs = duePerformanceMs - nowPerformanceMs;
      return deltaMs >= -MAX_LATENESS_MS && deltaMs <= MAX_FUTURE_MS;
    });
    const dropped = normalized.length - accepted.length;
    if (pending.length + accepted.length > MAX_BUFFER) {
      throw new RangeError("provider buffer capacity exceeded");
    }
    pending.push(...accepted);
    if (accepted.length) scheduleFlush();
    emit("cortana:viseme-provider-stats", {
      accepted:accepted.length,dropped,buffered:pending.length,state
    });
    return {accepted:accepted.length,dropped,buffered:pending.length};
  }
  function connect(adapter, playbackAnchor) {
    if (!adapter || typeof adapter.subscribe !== "function") {
      throw new TypeError("provider adapter must implement subscribe(callback)");
    }
    if (!playbackAnchor || !Number.isFinite(playbackAnchor.anchorTimeMs) ||
        !Number.isFinite(playbackAnchor.contextTimeSeconds)) {
      throw new TypeError("a valid playback anchor is required");
    }
    disconnect();
    anchor = playbackAnchor;
    source = adapter;
    state = "connected";
    try {
      const result = adapter.subscribe(push);
      if (typeof result === "function") unsubscribe = result;
      else if (result && typeof result.unsubscribe === "function") unsubscribe = () => result.unsubscribe();
    } catch (error) {
      state = "idle"; source = null; anchor = null;
      throw error;
    }
    emit("cortana:viseme-provider-state", {state,provider:adapter.name || "custom"});
    return {state,provider:adapter.name || "custom"};
  }
  function disconnect() {
    if (flushTimer !== null) window.clearTimeout(flushTimer);
    flushTimer = null;
    if (typeof unsubscribe === "function") {
      try { unsubscribe(); } catch (_) {}
    }
    unsubscribe = null; source = null; pending = []; anchor = null; state = "idle";
    emit("cortana:viseme-provider-state", {state});
  }
  function updateAnchor(nextAnchor) {
    if (!nextAnchor || !Number.isFinite(nextAnchor.anchorTimeMs) ||
        !Number.isFinite(nextAnchor.contextTimeSeconds)) throw new TypeError("invalid playback anchor");
    anchor = nextAnchor;
  }
  window.CortanaVisemeProvider = Object.freeze({
    connect, disconnect, push, updateAnchor,
    getState: () => state,
    getStats: () => Object.freeze({state,buffered:pending.length,sequence})
  });
})();