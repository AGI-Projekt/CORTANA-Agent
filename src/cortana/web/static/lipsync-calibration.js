/* Lip-sync calibration — robust clock/latency offset estimator, v1.5.0.
 * Uses paired AudioContext/performance timestamps supplied by the application.
 * It does not infer phoneme boundaries from raw audio.
 */
(() => {
  "use strict";
  const MIN_SAMPLES = 3, MAX_SAMPLES = 31, MAX_OFFSET_MS = 250;
  let samples = [], offsetMs = 0;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function normalize(sample) {
    if (!sample || !Number.isFinite(sample.audioTimeSeconds) ||
        !Number.isFinite(sample.expectedPerformanceTimeMs) ||
        !sample.anchor || !Number.isFinite(sample.anchor.anchorTimeMs) ||
        !Number.isFinite(sample.anchor.contextTimeSeconds)) {
      throw new TypeError("sample requires audio time, expected performance time, and a valid anchor");
    }
    const mapped = sample.anchor.anchorTimeMs +
      (sample.audioTimeSeconds - sample.anchor.contextTimeSeconds) * 1000;
    const residual = sample.expectedPerformanceTimeMs - mapped;
    if (!Number.isFinite(residual) || Math.abs(residual) > 1000) {
      throw new RangeError("calibration residual is outside the supported range");
    }
    return residual;
  }
  function getState() {
    return Object.freeze({
      offsetMs, sampleCount: samples.length, calibrated: samples.length >= MIN_SAMPLES,
      minSamples: MIN_SAMPLES, maxSamples: MAX_SAMPLES, maxOffsetMs: MAX_OFFSET_MS
    });
  }
  function addSample(sample) {
    const residual = normalize(sample);
    samples.push(residual);
    if (samples.length > MAX_SAMPLES) samples.shift();
    if (samples.length >= MIN_SAMPLES) offsetMs = clamp(median(samples), -MAX_OFFSET_MS, MAX_OFFSET_MS);
    const state = getState();
    window.dispatchEvent(new CustomEvent("cortana:lipsync-calibration", {detail: state}));
    return state;
  }
  function calibrate(batch) {
    if (!Array.isArray(batch) || batch.length < MIN_SAMPLES || batch.length > MAX_SAMPLES) {
      throw new RangeError("calibration requires 3 to 31 samples");
    }
    const residuals = batch.map(normalize);
    samples = residuals;
    offsetMs = clamp(median(samples), -MAX_OFFSET_MS, MAX_OFFSET_MS);
    const state = getState();
    window.dispatchEvent(new CustomEvent("cortana:lipsync-calibration", {detail: state}));
    return state;
  }
  function reset() {
    samples = []; offsetMs = 0;
    const state = getState();
    window.dispatchEvent(new CustomEvent("cortana:lipsync-calibration", {detail: state}));
    return state;
  }
  window.CortanaLipSyncCalibration = Object.freeze({
    addSample, calibrate, reset, getOffsetMs: () => offsetMs, getState
  });
})();