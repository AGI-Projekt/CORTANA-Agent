/* Emotion-to-Animation Engine v1.1
 * Frame-rate-independent facial, full-body gesture, and voice-activity animation.
 * No emotion inference, persistence, or permission changes occur in this module.
 */
(() => {
  "use strict";

  const PROFILES = Object.freeze({
    calm: Object.freeze({ label: "SPOKÓJ", color: 0x78efff, eyeX: 0.17, eyeY: 0.09, mouthX: 0.14, mouthY: 0.025, mouthYPos: -0.38, headTilt: 0, headPitch: 0, bodySway: 0.006, breath: 0.012, idleGlow: 4.5, blinkInterval: 4.0 }),
    joy: Object.freeze({ label: "RADOŚĆ", color: 0x62ffd5, eyeX: 0.17, eyeY: 0.082, mouthX: 0.18, mouthY: 0.038, mouthYPos: -0.38, headTilt: -0.045, headPitch: -0.018, bodySway: 0.018, breath: 0.018, idleGlow: 5.2, blinkInterval: 3.5 }),
    sadness: Object.freeze({ label: "SMUTEK", color: 0x739dff, eyeX: 0.16, eyeY: 0.058, mouthX: 0.12, mouthY: 0.016, mouthYPos: -0.395, headTilt: 0.035, headPitch: 0.045, bodySway: 0.004, breath: 0.008, idleGlow: 3.6, blinkInterval: 4.8 }),
    anger: Object.freeze({ label: "ZŁOŚĆ", color: 0xff536b, eyeX: 0.19, eyeY: 0.062, mouthX: 0.13, mouthY: 0.035, mouthYPos: -0.38, headTilt: 0, headPitch: 0.035, bodySway: 0.012, breath: 0.02, idleGlow: 5.8, blinkInterval: 3.0 }),
    fear: Object.freeze({ label: "STRACH", color: 0xb68dff, eyeX: 0.16, eyeY: 0.13, mouthX: 0.11, mouthY: 0.06, mouthYPos: -0.39, headTilt: -0.025, headPitch: -0.055, bodySway: 0.022, breath: 0.024, idleGlow: 5.0, blinkInterval: 2.7 }),
    surprise: Object.freeze({ label: "ZASKOCZENIE", color: 0x5bf2ff, eyeX: 0.17, eyeY: 0.145, mouthX: 0.105, mouthY: 0.07, mouthYPos: -0.395, headTilt: 0, headPitch: -0.035, bodySway: 0.02, breath: 0.018, idleGlow: 5.6, blinkInterval: 3.2 }),
    disgust: Object.freeze({ label: "ODRAZA", color: 0x9dd779, eyeX: 0.16, eyeY: 0.058, mouthX: 0.11, mouthY: 0.022, mouthYPos: -0.365, headTilt: 0.065, headPitch: 0.015, bodySway: 0.008, breath: 0.01, idleGlow: 3.8, blinkInterval: 4.3 }),
    determination: Object.freeze({ label: "DETERMINACJA", color: 0xffc45f, eyeX: 0.17, eyeY: 0.06, mouthX: 0.15, mouthY: 0.018, mouthYPos: -0.38, headTilt: 0, headPitch: 0.012, bodySway: 0.007, breath: 0.012, idleGlow: 5.0, blinkInterval: 4.1 })
  });

  const GESTURES = Object.freeze({
    calm: Object.freeze({ armLift: 0.02, armOpen: 0.16, wristTurn: 0.02, gesturePulse: 0.08 }),
    joy: Object.freeze({ armLift: 0.42, armOpen: 0.48, wristTurn: 0.18, gesturePulse: 0.28 }),
    sadness: Object.freeze({ armLift: -0.12, armOpen: 0.04, wristTurn: -0.12, gesturePulse: 0.03 }),
    anger: Object.freeze({ armLift: 0.12, armOpen: 0.12, wristTurn: -0.3, gesturePulse: 0.16 }),
    fear: Object.freeze({ armLift: 0.28, armOpen: -0.1, wristTurn: 0.24, gesturePulse: 0.2 }),
    surprise: Object.freeze({ armLift: 0.52, armOpen: 0.58, wristTurn: 0.3, gesturePulse: 0.24 }),
    disgust: Object.freeze({ armLift: -0.04, armOpen: -0.12, wristTurn: -0.22, gesturePulse: 0.05 }),
    determination: Object.freeze({ armLift: 0.16, armOpen: 0.08, wristTurn: 0.08, gesturePulse: 0.09 })
  });
  const NUMERIC_KEYS = Object.freeze([
    "eyeX", "eyeY", "mouthX", "mouthY", "mouthYPos", "headTilt",
    "headPitch", "bodySway", "breath", "idleGlow", "blinkInterval",
    "armLift", "armOpen", "wristTurn", "gesturePulse"
  ]);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;

  function mixColor(from, to, amount) {
    const channels = [16, 8, 0].map((shift) => {
      const a = (from >> shift) & 255;
      const b = (to >> shift) & 255;
      return Math.round(lerp(a, b, amount));
    });
    return (channels[0] << 16) | (channels[1] << 8) | channels[2];
  }

  function createEmotionAnimationEngine(options = {}) {
    const transitionSeconds = clamp(Number(options.transitionSeconds) || 0.42, 0.08, 2.5);
    let currentId = "calm";
    let targetId = "calm";
    let current = { ...PROFILES.calm, ...GESTURES.calm };
    let target = { ...PROFILES.calm, ...GESTURES.calm };
    let voiceActivity = 0;
    let voiceSpeaking = false;
    let transitionCount = 0;

    function setEmotion(id) {
      const nextId = typeof id === "string" && Object.prototype.hasOwnProperty.call(PROFILES, id)
        ? id : "calm";
      if (nextId === targetId) return { changed: false, emotion: targetId };
      targetId = nextId;
      target = { ...PROFILES[nextId], ...GESTURES[nextId] };
      transitionCount += 1;
      return { changed: true, emotion: targetId, transition: transitionCount };
    }

    function update(deltaSeconds) {
      const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.1);
      const alpha = 1 - Math.exp(-Math.LN2 * dt / (transitionSeconds / 3));
      for (const key of NUMERIC_KEYS) current[key] = lerp(current[key], target[key], alpha);
      current.color = mixColor(current.color, target.color, alpha);
      current.voiceActivity = voiceActivity;
      current.voiceSpeaking = voiceSpeaking;
      if (Math.abs(current.headTilt - target.headTilt) < 0.0001 &&
          Math.abs(current.headPitch - target.headPitch) < 0.0001 &&
          Math.abs(current.eyeY - target.eyeY) < 0.0001) {
        currentId = targetId;
      }
      return { ...current, emotion: targetId, settled: currentId === targetId, transition: transitionCount };
    }

    function reset() {
      targetId = "calm";
      target = { ...PROFILES.calm, ...GESTURES.calm };
      currentId = "calm";
      current = { ...PROFILES.calm, ...GESTURES.calm };
      voiceActivity = 0;
      voiceSpeaking = false;
      transitionCount = 0;
      return update(0);
    }

    return Object.freeze({
      setEmotion,
      setVoiceActivity(level, speaking) {
        voiceActivity = clamp(Number.isFinite(level) ? level : 0, 0, 1);
        voiceSpeaking = speaking === true;
        return { level: voiceActivity, speaking: voiceSpeaking };
      },
      update,
      reset,
      getEmotion: () => targetId,
      getProfiles: () => PROFILES,
      getGestureProfiles: () => GESTURES
    });
  }

  window.CortanaEmotionAnimation = Object.freeze({
    version: "1.2.0",
    profiles: PROFILES,
    createEmotionAnimationEngine
  });
})();
