const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("src/cortana/web/static/predictive-lipsync.js","utf8");
function harness(){const events=[],window={dispatchEvent(e){events.push(e);}};class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail||{};}}vm.runInNewContext(source,{window,CustomEvent,Number,Object,Array,Math,TypeError,RangeError},{filename:"predictive-lipsync.js"});return{api:window.CortanaPredictiveLipSync,events};}
const anchor={anchorTimeMs:1000,contextTimeSeconds:2};
test("adaptive estimator learns lateness and shifts anchor earlier",()=>{const h=harness();for(let i=0;i<5;i++)h.api.observe({scheduledTimeMs:1000+i*100,actualTimeMs:1040+i*100});const state=h.api.getState(),adjusted=h.api.adjustAnchor(anchor);assert.ok(state.latencyMs>0&&state.latencyMs<=40);assert.ok(adjusted.anchorTimeMs<anchor.anchorTimeMs);assert.equal(adjusted.contextTimeSeconds,anchor.contextTimeSeconds);});
test("jitter expands bounded predictive lookahead",()=>{const h=harness(),before=h.api.getLookaheadMs();h.api.observe({scheduledTimeMs:100,actualTimeMs:160});const after=h.api.getLookaheadMs();assert.ok(after>=before);assert.ok(after<=120);});
test("predicts only supplied viseme events within adaptive horizon",()=>{const h=harness();h.api.observe({scheduledTimeMs:100,actualTimeMs:140});const events=[{atMs:0,durationMs:200,viseme:"open",character:"a"}];const predicted=h.api.predictViseme(events,{anchorTimeMs:100,contextTimeSeconds:1},100);assert.equal(predicted.viseme,"open");assert.ok(predicted.predictedAtMs>100);});
test("rejects invalid samples and anchors; reset clears learned state",()=>{const h=harness();assert.throws(()=>h.api.observe({}),/finite/);assert.throws(()=>h.api.adjustAnchor(null),/anchor/);h.api.observe({scheduledTimeMs:0,actualTimeMs:50});const state=h.api.reset();assert.equal(state.sampleCount,0);assert.equal(state.latencyMs,0);assert.equal(state.initialized,false);});
test("compensation is bounded under extreme timing outliers",()=>{const h=harness();for(let i=0;i<50;i++)h.api.observe({scheduledTimeMs:0,actualTimeMs:500});assert.ok(Math.abs(h.api.getState().compensationMs)<=120);});
