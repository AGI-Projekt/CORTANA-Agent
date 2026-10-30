const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("src/cortana/web/static/lipsync-calibration.js","utf8");
function harness(){
  const events=[],window={dispatchEvent(event){events.push(event);}};
  class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail||{};}}
  vm.runInNewContext(source,{window,CustomEvent,Number,Object,Array,Math,TypeError,RangeError},{filename:"lipsync-calibration.js"});
  return {api:window.CortanaLipSyncCalibration,events};
}
const anchor={anchorTimeMs:1000,contextTimeSeconds:2};
test("calibration waits for three paired samples and uses a robust median",()=>{
 const h=harness(),sample=offset=>({audioTimeSeconds:2.1,expectedPerformanceTimeMs:1100+offset,anchor});
 assert.equal(h.api.addSample(sample(12)).calibrated,false);
 h.api.addSample(sample(14));
 const state=h.api.addSample(sample(13));
 assert.equal(state.calibrated,true);assert.equal(state.offsetMs,13);assert.equal(state.sampleCount,3);
});
test("calibration clamps offset and reset clears state",()=>{
 const h=harness(),sample={audioTimeSeconds:2,expectedPerformanceTimeMs:1600,anchor};
 h.api.calibrate([sample,sample,sample]);assert.equal(h.api.getOffsetMs(),250);
 assert.equal(h.api.reset().offsetMs,0);assert.equal(h.api.getState().sampleCount,0);
});
test("calibration rejects invalid batches and malformed samples",()=>{
 const h=harness();assert.throws(()=>h.api.calibrate([]),/3 to 31/);
 assert.throws(()=>h.api.addSample({}),/requires/);
 assert.throws(()=>h.api.calibrate([{}, {}, {}]),/requires/);
});
