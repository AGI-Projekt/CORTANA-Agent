const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("src/cortana/web/static/lipsync-calibration.js","utf8");
function harness(){
 const events=[],window={dispatchEvent(e){events.push(e);}};
 class CE{constructor(type,init={}){this.type=type;this.detail=init.detail||{};}}
 vm.runInNewContext(source,{window,CustomEvent:CE,Number,Object,Array,Math,TypeError,RangeError}, {filename:"lipsync-calibration.js"});
 return {api:window.CortanaLipSyncCalibration,events};
}
const anchor={anchorTimeMs:1000,contextTimeSeconds:2};
test("calibration uses median measured offset and requires three samples",()=>{
 const h=harness();
 const sample=offset=>({audioTimeSeconds:2.1,expectedPerformanceTimeMs:1100+offset,anchor});
 assert.equal(h.api.addSample(sample(12)).calibrated,false);
 h.api.addSample(sample(14));
 const result=h.api.addSample(sample(13));
 assert.equal(result.calibrated,true); assert.equal(result.offsetMs,13); assert.equal(result.sampleCount,3);
});
test("calibration clamps offset and reset clears samples",()=>{
 const h=harness(), sample={audioTimeSeconds:2,expectedPerformanceTimeMs:1600,anchor};
 h.api.calibrate([sample,sample,sample]);
 assert.equal(h.api.getOffsetMs(),250);
 assert.equal(h.api.reset().offsetMs,0);
 assert.equal(h.api.getState().sampleCount,0);
});
test("invalid calibration data is rejected",()=>{
 const h=harness();
 assert.throws(()=>h.api.calibrate([]),/3 to 31/);
 assert.throws(()=>h.api.addSample({}),/requires/);
});
