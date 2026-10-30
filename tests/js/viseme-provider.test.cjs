const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("src/cortana/web/static/viseme-provider.js","utf8");
function harness(){
  const events=[], timers=new Map(); let id=0;
  const window={dispatchEvent(e){events.push(e);},setTimeout(fn){const n=++id;timers.set(n,fn);return n;},clearTimeout(n){timers.delete(n);}};
  class CE{constructor(type,init={}){this.type=type;this.detail=init.detail||{};}}
  vm.runInNewContext(source,{window,CustomEvent:CE,performance:{now:()=>1000},Number,Object,Array,TypeError,RangeError}, {filename:"viseme-provider.js"});
  return {api:window.CortanaVisemeProvider,events,timers,flush(){for(const [n,fn] of timers){timers.delete(n);fn();}}};
}
const anchor={anchorTimeMs:1000,contextTimeSeconds:2};
test("provider validates, batches and emits audio-clock timestamped visemes",()=>{
 const h=harness(); let unsubscribed=false;
 h.api.connect({name:"fixture",subscribe(push){this.push=push;return()=>{unsubscribed=true;};}},anchor);
 const result=h.api.push([{audioTimeSeconds:2.1,durationMs:70,viseme:"open",character:"a"}]);
 assert.equal(result.accepted,1); h.flush();
 const event=h.events.find(e=>e.type==="cortana:audio-aligned-visemes");
 assert.equal(event.detail.audioEvents[0].viseme,"open");
 assert.equal(event.detail.anchor,anchor);
 h.api.disconnect(); assert.equal(unsubscribed,true); assert.equal(h.api.getState(),"idle");
});
test("provider rejects invalid batches and bounds late/future events",()=>{
 const h=harness(); h.api.connect({subscribe(){return()=>{};}},anchor);
 assert.throws(()=>h.api.push([{audioTimeSeconds:2,durationMs:10,viseme:"bad"}]),/invalid/);
 const result=h.api.push([
  {audioTimeSeconds:0,durationMs:20,viseme:"open"},
  {audioTimeSeconds:90,durationMs:20,viseme:"round"},
  {audioTimeSeconds:2.2,durationMs:20,viseme:"closed"}
 ]);
 assert.equal(result.accepted,1); assert.equal(result.dropped,2);
});
test("provider rejects over-capacity buffers and missing anchors",()=>{
 const h=harness();
 assert.throws(()=>h.api.connect({subscribe(){}},null),/anchor/);
 h.api.connect({subscribe(){}},anchor);
 assert.throws(()=>h.api.push(Array(129).fill({audioTimeSeconds:2,durationMs:20,viseme:"open"})),/1 to 128/);
});
