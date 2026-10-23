/* Approximate grapheme-to-viseme scheduler for the procedural avatar.
 * Transcript deltas are hints only: this is not phoneme alignment.
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
  let timer = null;
  let generation = 0;
  function emit(viseme, character, durationMs) {
    if (wrapper) wrapper.dataset.viseme = viseme;
    window.dispatchEvent(new CustomEvent("cortana:viseme", {
      detail: { viseme, character: character || "", durationMs: durationMs || 0 }
    }));
  }
  function drain(expectedGeneration) {
    if (expectedGeneration !== generation) return;
    const item = queue.shift();
    if (!item) {
      emit("neutral", "", 0);
      timer = null;
      return;
    }
    emit(item.viseme, item.character, item.durationMs);
    timer = window.setTimeout(() => drain(expectedGeneration), item.durationMs);
  }
  function enqueue(text) {
    if (typeof text !== "string" || !text) return;
    for (const character of Array.from(text)) {
      const viseme = classify(character);
      queue.push({character, viseme, durationMs: durationFor(character, viseme)});
    }
    if (queue.length > 1600) queue = queue.slice(-1600);
    if (timer === null) drain(generation);
  }
  function reset() {
    generation += 1;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    queue = [];
    emit("neutral", "", 0);
  }
  window.CortanaVisemeScheduler = Object.freeze({classify, enqueue, reset});
})();
