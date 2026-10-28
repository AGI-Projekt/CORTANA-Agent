(() => {
  "use strict";
  let latestAnchor = null;
  const MAX_CONTEXT_TIME = 86400;
  const finite = value => typeof value === "number" && Number.isFinite(value);

  function capturePlaybackAnchor(audioContext) {
    const capturedAtMs = performance.now();
    if (!audioContext || !finite(audioContext.currentTime) ||
        audioContext.currentTime < 0 || audioContext.currentTime > MAX_CONTEXT_TIME) {
      throw new TypeError("A valid AudioContext is required");
    }
    if (typeof audioContext.getOutputTimestamp === "function") {
      try {
        const stamp = audioContext.getOutputTimestamp();
        if (stamp && finite(stamp.contextTime) && finite(stamp.performanceTime) &&
            stamp.contextTime >= 0 && stamp.contextTime <= MAX_CONTEXT_TIME &&
            stamp.performanceTime > 0) {
          return Object.freeze({
            anchorTimeMs: stamp.performanceTime,
            contextTimeSeconds: stamp.contextTime,
            capturedAtMs,
            source: "audio-output-timestamp"
          });
        }
      } catch (_) {}
    }
    return Object.freeze({
      anchorTimeMs: capturedAtMs,
      contextTimeSeconds: audioContext.currentTime,
      capturedAtMs,
      source: "performance-fallback"
    });
  }

  function performanceTimeForContextTime(contextTimeSeconds, anchor) {
    if (!finite(contextTimeSeconds) || contextTimeSeconds < 0 ||
        !anchor || !finite(anchor.anchorTimeMs) || !finite(anchor.contextTimeSeconds)) {
      throw new TypeError("Invalid context time or playback anchor");
    }
    const mapped = anchor.anchorTimeMs + (contextTimeSeconds - anchor.contextTimeSeconds) * 1000;
    if (!finite(mapped)) throw new RangeError("Mapped performance time is invalid");
    return mapped;
  }

  function markOutputStart(audioContext) {
    latestAnchor = capturePlaybackAnchor(audioContext);
    window.dispatchEvent(new CustomEvent("cortana:audio-playout-anchor", { detail: latestAnchor }));
    return latestAnchor;
  }
  function resetOutputAnchor() {
    latestAnchor = null;
    window.dispatchEvent(new CustomEvent("cortana:audio-playout-reset"));
  }
  function getLatestAnchor() { return latestAnchor; }
  function scheduleTimeline(scheduler, events) {
    if (!scheduler || typeof scheduler.playTimeline !== "function") {
      throw new TypeError("A viseme scheduler with playTimeline is required");
    }
    if (!latestAnchor) throw new Error("No audio playout anchor has been captured for this response");
    return scheduler.playTimeline(events, latestAnchor.anchorTimeMs);
  }

  function scheduleAudioAlignedTimeline(scheduler, events, anchor) {
    if (!scheduler || typeof scheduler.playAudioAlignedTimeline !== "function") {
      throw new TypeError("a viseme scheduler with playAudioAlignedTimeline is required");
    }
    const selectedAnchor = anchor || latestAnchor;
    if (!selectedAnchor) throw new Error("No audio playout anchor has been captured for this response");
    return scheduler.playAudioAlignedTimeline(events, selectedAnchor);
  }

  window.CortanaAudioClock = Object.freeze({
    capturePlaybackAnchor, performanceTimeForContextTime, markOutputStart,
    resetOutputAnchor, getLatestAnchor, scheduleTimeline, scheduleAudioAlignedTimeline
  });
})();
