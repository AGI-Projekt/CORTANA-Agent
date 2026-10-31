/* Emotion Core v1.8 — context-aware emotion/prosody fusion on the audio clock.
 * Inputs are explicit provider features; this module does not infer emotion from raw audio.
 */
(() => {
  "use strict";
  const EMOTIONS=Object.freeze(["calm","joy","sadness","anger","fear","surprise","disgust","determination"]);
  const ALLOWED=new Set(EMOTIONS),MAX_EVENTS=256,MAX_TIME=86400,MAX_DURATION=5000;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const finite=(v)=>typeof v==="number"&&Number.isFinite(v);
  let smoothed=null,lastResponseId=null,timers=[],generation=0;
  function normalizeScores(scores){
    if(scores===undefined||scores===null)return {};
    if(typeof scores!=="object"||Array.isArray(scores))throw new TypeError("emotion scores must be an object");
    const out={};
    for(const [key,value] of Object.entries(scores)){
      if(!ALLOWED.has(key)||!finite(value)||value<0||value>1)throw new TypeError("emotion scores contain an invalid label or confidence");
      out[key]=value;
    }
    return out;
  }
  function normalizeProsody(prosody={}){
    if(!prosody||typeof prosody!=="object"||Array.isArray(prosody))throw new TypeError("prosody must be an object");
    const limits={pitchHz:[40,1200],energy:[0,1],speechRate:[0,8],pauseMs:[0,10000],pitchVariation:[0,1]};
    const out={};
    for(const [key,[min,max]] of Object.entries(limits)){
      if(prosody[key]===undefined)continue;
      if(!finite(prosody[key])||prosody[key]<min||prosody[key]>max)throw new RangeError(key+" is outside supported bounds");
      out[key]=prosody[key];
    }
    return out;
  }
  function inferProsodyBias(p){
    const bias=Object.fromEntries(EMOTIONS.map(name=>[name,0]));
    if(p.energy!==undefined){
      if(p.energy>0.72){bias.joy+=0.16;bias.anger+=0.12;bias.surprise+=0.08;}
      if(p.energy<0.22){bias.calm+=0.14;bias.sadness+=0.12;}
    }
    if(p.speechRate!==undefined){
      if(p.speechRate>4.2){bias.joy+=0.08;bias.anger+=0.12;bias.fear+=0.1;}
      if(p.speechRate<1.5){bias.calm+=0.1;bias.sadness+=0.08;}
    }
    if(p.pitchVariation!==undefined&&p.pitchVariation>0.62){bias.joy+=0.1;bias.surprise+=0.1;}
    if(p.pauseMs!==undefined&&p.pauseMs>1200){bias.sadness+=0.08;bias.calm+=0.06;}
    return bias;
  }
  function analyze(input){
    if(!input||typeof input!=="object")throw new TypeError("multimodal emotion input is required");
    const responseId=input.responseId;
    if(typeof responseId!=="string"||!responseId||responseId.length>128)throw new TypeError("responseId is required");
    if(!finite(input.audioTimeSeconds)||input.audioTimeSeconds<0||input.audioTimeSeconds>MAX_TIME)throw new RangeError("audioTimeSeconds is outside supported bounds");
    const context=normalizeScores(input.emotionScores),prosody=normalizeProsody(input.prosody);
    const bias=inferProsodyBias(prosody),contextWeight=input.contextWeight===undefined?0.7:input.contextWeight;
    if(!finite(contextWeight)||contextWeight<0||contextWeight>1)throw new RangeError("contextWeight must be between 0 and 1");
    const scores={};
    for(const name of EMOTIONS)scores[name]=clamp((context[name]||0)*contextWeight+bias[name]*(1-contextWeight),0,1);
    const total=Object.values(scores).reduce((a,b)=>a+b,0);
    const ranked=EMOTIONS.slice().sort((a,b)=>scores[b]-scores[a]);
    const candidate=total>0?ranked[0]:"calm",rawConfidence=total>0?scores[candidate]:0;
    const confidence=clamp(rawConfidence,0,1);
    if(lastResponseId!==responseId){smoothed=null;lastResponseId=responseId;}
    const alpha=finite(input.smoothing)?clamp(input.smoothing,0.05,1):0.42;
    if(!smoothed)smoothed={...scores};
    else for(const name of EMOTIONS)smoothed[name]=smoothed[name]+(scores[name]-smoothed[name])*alpha;
    const smoothedWinner=EMOTIONS.slice().sort((a,b)=>smoothed[b]-smoothed[a])[0];
    const smoothedConfidence=smoothed[smoothedWinner];
    const emotion=smoothedConfidence<0.12?"calm":smoothedWinner;
    const result=Object.freeze({responseId,audioTimeSeconds:input.audioTimeSeconds,emotion,confidence:clamp(smoothedConfidence,0,1),scores:Object.freeze({...smoothed}),prosody:Object.freeze({...prosody}),source:"context-prosody-fusion"});
    return result;
  }
  function normalizeTimeline(events){
    if(!Array.isArray(events)||events.length>MAX_EVENTS)throw new RangeError("emotion timeline must be a bounded array");
    return events.map(event=>{
      if(!event||typeof event!=="object")throw new TypeError("invalid emotion timeline event");
      const durationMs=event.durationMs===undefined?180:Number(event.durationMs);
      if(!finite(durationMs)||durationMs<=0||durationMs>MAX_DURATION)throw new RangeError("durationMs is outside supported bounds");
      return {responseId:event.responseId,audioTimeSeconds:event.audioTimeSeconds,durationMs,emotionScores:event.emotionScores,prosody:event.prosody,contextWeight:event.contextWeight,smoothing:event.smoothing};
    }).sort((a,b)=>a.audioTimeSeconds-b.audioTimeSeconds);
  }
  function cancel(){
    generation+=1;
    for(const timer of timers)window.clearTimeout(timer);
    timers=[];
  }
  function schedule(events,anchor,expectedResponseId){
    const normalized=normalizeTimeline(events);
    if(!anchor||!finite(anchor.anchorTimeMs)||!finite(anchor.contextTimeSeconds))throw new TypeError("valid audio playout anchor is required");
    if(typeof expectedResponseId!=="string"||!expectedResponseId)throw new TypeError("expectedResponseId is required");
    const clock=window.CortanaAudioClock;
    if(!clock||typeof clock.performanceTimeForContextTime!=="function")throw new Error("audio clock bridge is unavailable");
    const prepared=normalized.map(event=>{
      if(event.responseId!==expectedResponseId)throw new Error("emotion event does not match active response");
      const result=analyze(event);
      return {result,atMs:clock.performanceTimeForContextTime(event.audioTimeSeconds,anchor),durationMs:event.durationMs};
    });
    cancel();
    const ownGeneration=generation;
    for(const item of prepared){
      const delay=Math.max(0,item.atMs-performance.now());
      const timer=window.setTimeout(()=>{
        timers=timers.filter(value=>value!==timer);
        if(generation!==ownGeneration)return;
        window.dispatchEvent(new CustomEvent("cortana:emotion-transition",{detail:{emotion:item.result.emotion,confidence:item.result.confidence,responseId:item.result.responseId,audioTimeSeconds:item.result.audioTimeSeconds,durationMs:item.durationMs,source:item.result.source}}));
        window.dispatchEvent(new CustomEvent("cortana:multimodal-emotion",{detail:item.result}));
      },delay);
      timers.push(timer);
    }
    return Object.freeze({scheduled:prepared.length,responseId:expectedResponseId});
  }
  function reset(){cancel();smoothed=null;lastResponseId=null;return true;}
  window.CortanaEmotionProsodySync=Object.freeze({analyze,schedule,cancel,reset,emotions:EMOTIONS,limits:Object.freeze({maxEvents:MAX_EVENTS,maxAudioTimeSeconds:MAX_TIME,maxDurationMs:MAX_DURATION})});
})();