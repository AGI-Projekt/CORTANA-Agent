const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("src/cortana/web/static/unreal-bridge.js", "utf8");
class MockWebSocket {
  constructor(url) { this.url=url; this.readyState=0; this.sent=[]; MockWebSocket.latest=this; }
  send(value) { this.sent.push(value); }
  close() { this.readyState=3; }
}
function load() {
  const window={WebSocket:MockWebSocket,performance:{now:()=>100}};
  vm.runInNewContext(source,{window,URL,Object,Number,Math,Set,JSON,Error,Date},{filename:"unreal-bridge.js"});
  return window.CortanaUnrealBridge;
}
test("requires secure transport except localhost development",()=>{
  const api=load(), bridge=api.createUnrealBridge();
  assert.throws(()=>bridge.connect("ws://example.com"),/wss/);
  assert.doesNotThrow(()=>bridge.connect("ws://localhost:8787/avatar"));
});
test("publishes versioned bounded frames only when connected",()=>{
  const api=load(), bridge=api.createUnrealBridge();
  bridge.connect("wss://localhost:8787/avatar");
  const socket=MockWebSocket.latest;
  assert.equal(bridge.publish({timestampMs:100}),false);
  socket.readyState=1;
  assert.equal(bridge.publish({state:"speaking",emotion:"joy",viseme:"wide",audioLevel:1.5,facial:{jawOpen:.8,mouthSmile:.6},timestampMs:100}),true);
  const frame=JSON.parse(socket.sent[0]);
  assert.equal(frame.type,"cortana.avatar.frame");
  assert.equal(frame.version,1);
  assert.equal(frame.sequence,1);
  assert.equal(frame.blendshapes.jawOpen,.8);
  assert.equal(frame.blendshapes.browDown,0);
  assert.equal(frame.audioLevel,1);
});
test("throttles frames and counts drops",()=>{
  const bridge=load().createUnrealBridge();
  bridge.connect("wss://localhost:8787/avatar");
  const socket=MockWebSocket.latest; socket.readyState=1;
  assert.equal(bridge.publish({timestampMs:100}),true);
  assert.equal(bridge.publish({timestampMs:110}),false);
  assert.equal(bridge.getStatus().droppedFrames,1);
  assert.equal(socket.sent.length,1);
});
test("falls back to neutral labels and clamps every channel",()=>{
  const frame=load().normalizeFrame({emotion:"unknown",viseme:"bad",state:"bad",facial:{eyeWide:8,jawOpen:-1}},2,5);
  assert.equal(frame.emotion,"calm"); assert.equal(frame.viseme,"neutral"); assert.equal(frame.state,"idle");
  assert.equal(frame.blendshapes.eyeWide,1); assert.equal(frame.blendshapes.jawOpen,0);
});