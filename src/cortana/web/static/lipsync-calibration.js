/* Lip-sync calibration — robust clock offset estimator, v1.5.0 */
(() => {
  "use strict";
  const MIN_SAMPLES = 3, MAX_SAMPLES = 31, MAX_OFFSET_MS = 250;
  let offsetMs = 0, samples = [];
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  function median(values) {
    const sorted = values.slice().sort((a,b)=>a-b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
  }
  function addSample(sample) {
    if (!sample || !Number.isFinite(sample.audioTimeSeconds) ||
        !Number.isFinite(sample.expectedPerformanceTimeMs) ||
        !sample.anchor || !Number.isFinite(sample.anchor.contextTimeSeconds) ||
        !Number.isFinite(sample.anchor.anchorTimeMs)) {
      throw new TypeError("calibration sample requires audio time, expected performance time, and anchor");
    }
    const mapped = sample.anchor.anchorTimeMs +
      (sample.audioTimeSeconds - sample.anchor.contextTimeSeconds) * 1000;
    const measured = sample.expectedPerformanceTimeMs - mapped;
    if (!Number.isFinite(measured) || Math.abs(measured) > 1000) {
      throw new RangeError("calibration sample is outside the supported range");
    }
    samples.push(measured);
    if (samples.length > MAX_SAMPLES) samples.shift();
    if (samples.length >= MIN_SAMPLES) offsetMs = clamp(median(samples), -MAX_OFFSET_MS, MAX_OFFSET_MS);
    const result = getState();
    window.dispatchEvent(new CustomEvent("cortana:lipsync-calibration", {detail:result}));
    return result;
  }
  function calibrate(batch) {
    if (!Array.isArray(batch) || batch.length < MIN_SAMPLES || batch.length > MAX_SAMPLES) {
      throw new RangeError("calibration requires 3 to 31 samples");
    }
    const previous = samples.slice(), previousOffset = offsetMs;
    try {
      samples = [];
      for (const sample of batch) addSample(sample);
      if (samples.length < MIN_SAMPLES) throw new RangeError("not enough calibration samples");
      return getState();
    } catch (error) {
      samples = previous; offsetMs = previousOffset; throw error;
    }
  }
  function reset() {
    samples = []; offsetMs = 0;
    window.dispatchEvent(new CustomEvent("cortana:lipsync-calibration", {detail:getState()}));
    return getState();
  }
  function getState() {
    return Object.freeze({
      offsetMs, sampleCount:samples.length,
      calibrated:samples.length >= MIN_SAMPLES,
      minSamples:MIN_SAMPLES,maxSamples:MAX_SAMPLES,maxOffsetMs:MAX_OFFSET_MS
    });
  }
  window.CortanaLipSyncCalibration = Object.freeze({addSample,calibrate,reset,getOffsetMs:()=>offsetMs,getState});
})();