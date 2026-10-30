const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("src/cortana/web/static/facial-intelligence.js", "utf8");
function makeEngine() {
  const window = {};
  vm.runInNewContext(source, { window, Object, Number, Math }, { filename: "facial-intelligence.js" });
  return window.CortanaFacialIntelligence.createFacialIntelligence();
}
test("exports bounded blendshape-style facial channels", () => {
  const engine = makeEngine();
  assert.equal(engine.channels.length, 13);
  const weights = engine.update({ deltaSeconds: 0.1, emotion: "surprise", viseme: "open", speaking: true, audioLevel: 0.8 });
  for (const key of engine.channels) assert.ok(weights[key] >= 0 && weights[key] <= 1, key);
});
test("emotion and viseme controls compose without erasing upper-face expression", () => {
  const engine = makeEngine();
  const weights = engine.update({ deltaSeconds: 0.1, emotion: "anger", viseme: "round", speaking: true, audioLevel: 0.4 });
  assert.ok(weights.browDown > 0.4);
  assert.ok(weights.mouthPucker > 0.4);
  assert.ok(weights.jawOpen > 0);
});
test("closed-mouth articulation stays restrained under high audio energy", () => {
  const engine = makeEngine();
  const weights = engine.update({ deltaSeconds: 0.1, emotion: "calm", viseme: "closed", speaking: true, audioLevel: 1 });
  assert.ok(weights.jawOpen < 0.1);
  assert.ok(weights.lipPress > 0.5);
});
test("unknown emotion and viseme safely fall back to calm and neutral", () => {
  const engine = makeEngine();
  const weights = engine.update({ deltaSeconds: 0.1, emotion: "unknown", viseme: "invalid", speaking: false });
  assert.equal(weights.emotion, "calm");
  assert.equal(weights.viseme, "neutral");
});
test("transitions are smoothed, frame-delta bounded, and resettable", () => {
  const engine = makeEngine();
  const first = engine.update({ deltaSeconds: 0.016, emotion: "joy", viseme: "wide", speaking: true });
  assert.ok(first.mouthSmile > 0 && first.mouthSmile < 0.6);
  const second = engine.update({ deltaSeconds: 5, emotion: "joy", viseme: "wide", speaking: true });
  assert.ok(second.mouthSmile >= first.mouthSmile);
  const reset = engine.reset();
  for (const key of engine.channels) assert.equal(reset[key], 0);
});
