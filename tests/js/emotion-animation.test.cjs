const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("src/cortana/web/static/emotion-animation.js", "utf8");

function createHarness() {
  const window = {};
  vm.runInNewContext(source, { window, Math, Number, Object, String }, { filename: "emotion-animation.js" });
  return window.CortanaEmotionAnimation;
}

test("engine exposes eight immutable allowlisted profiles", () => {
  const api = createHarness();
  assert.equal(api.version, "1.1.0");
  assert.deepEqual(Object.keys(api.profiles).sort(), [
    "anger", "calm", "determination", "disgust", "fear", "joy", "sadness", "surprise"
  ]);
  assert.equal(Object.isFrozen(api.profiles), true);
});

test("emotion changes are interpolated and eventually settle", () => {
  const engine = createHarness().createEmotionAnimationEngine({ transitionSeconds: 0.42 });
  const result = engine.setEmotion("joy");
  assert.equal(result.changed, true);
  assert.equal(engine.getEmotion(), "joy");
  const first = engine.update(1 / 60);
  assert.equal(first.emotion, "joy");
  assert.notEqual(first.color, engine.getProfiles().joy.color);
  let state = first;
  for (let i = 0; i < 180; i += 1) state = engine.update(1 / 60);
  assert.equal(state.settled, true);
  assert.equal(state.color, engine.getProfiles().joy.color);
  assert.equal(state.eyeY, engine.getProfiles().joy.eyeY);
});

test("unknown labels safely transition to calm", () => {
  const engine = createHarness().createEmotionAnimationEngine();
  engine.setEmotion("anger");
  for (let i = 0; i < 180; i += 1) engine.update(1 / 60);
  assert.equal(engine.setEmotion("untrusted-label").emotion, "calm");
  let state;
  for (let i = 0; i < 180; i += 1) state = engine.update(1 / 60);
  assert.equal(state.color, engine.getProfiles().calm.color);
  assert.equal(state.settled, true);
});

test("repeated target is idempotent and delta time is bounded", () => {
  const engine = createHarness().createEmotionAnimationEngine();
  assert.equal(engine.setEmotion("calm").changed, false);
  engine.setEmotion("fear");
  const state = engine.update(100);
  assert.ok(state.eyeY > 0.09);
  assert.ok(state.eyeY <= engine.getProfiles().fear.eyeY);
});

test("reset restores the exact calm baseline", () => {
  const engine = createHarness().createEmotionAnimationEngine();
  engine.setEmotion("surprise");
  engine.update(0.04);
  const state = engine.reset();
  assert.equal(state.emotion, "calm");
  assert.equal(state.color, engine.getProfiles().calm.color);
  assert.equal(state.eyeY, engine.getProfiles().calm.eyeY);
});
