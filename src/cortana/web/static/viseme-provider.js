(() => {
"use strict";
const MAX_EVENTS=512,MAX_RESPONSE_ID=128;
const ALLOWED=new Set(["neutral","open","mid","wide","round","closed","teeth"]);
function validate(event,expectedResponseId){
if(!event||typeof event!=="object"||event.type!=="cortana.viseme.timeline")throw new TypeError("unsupported viseme provider event");
if(typeof event.response_id!=="string"||!event.response_id||event.response_id.length>MAX_RESPONSE_ID)throw new TypeError("response_id is required");
if(!expectedResponseId||event.response_id!==expectedResponseId)throw new Error("viseme timeline does not match the active response");
let events;
if(Array.isArray(event.events)&&event.events.length){
if(event.events.length>MAX_EVENTS)throw new RangeError("viseme events must be a bounded array");
events=event.events.map(item=>{
if(!item||typeof item!=="object")throw new TypeError("invalid viseme event");
if(typeof item.audioTimeSeconds!=="number"||!Number.isFinite(item.audioTimeSeconds)||item.audioTimeSeconds<0||item.audioTimeSeconds>86400)throw new TypeError("audioTimeSeconds must be a finite AudioContext timestamp");
if(typeof item.durationMs!=="number"||!Number.isFinite(item.durationMs)||item.durationMs<=0||item.durationMs>5000)throw new RangeError("durationMs must be between 0 and 5000");
if(typeof item.viseme!=="string"||!ALLOWED.has(item.viseme))throw new TypeError("unsupported viseme");
const character=item.character===undefined?"":item.character;
if(typeof character!=="string"||character.length>8)throw new TypeError("character must be a short string");
return {audioTimeSeconds:item.audioTimeSeconds,durationMs:item.durationMs,viseme:item.viseme,character};
});
}else if(Array.isArray(event.phonemes)){
if(!window.CortanaPhonemeAlignment)throw new Error("phoneme alignment engine is not loaded");
events=window.CortanaPhonemeAlignment.align(event.phonemes);
}else throw new RangeError("provider event requires viseme events or aligned phonemes");
if(!events.length||events.length>MAX_EVENTS)throw new RangeError("aligned events must be a non-empty bounded array");
return events;
}
function accept(event,expectedResponseId,anchor,scheduler){
const events=validate(event,expectedResponseId);
if(!anchor||!Number.isFinite(anchor.anchorTimeMs)||!Number.isFinite(anchor.contextTimeSeconds))throw new Error("audio playout anchor is not available");
if(!scheduler||typeof scheduler.playAudioAlignedTimeline!=="function")throw new TypeError("audio-aligned viseme scheduler is required");
let prediction=null;
if(Array.isArray(event.phonemes)&&window.CortanaNeuralVisemePredictor){
const training=events.map(item=>({phoneme:item.phoneme,viseme:item.viseme}));
if(training.length>=2)window.CortanaNeuralVisemePredictor.train(training);
const context=training.slice(-2).map(item=>item.phoneme);
prediction=window.CortanaNeuralVisemePredictor.predictNext(context);
window.dispatchEvent(new CustomEvent("cortana:predicted-viseme",{detail:{responseId:event.response_id,...prediction}}));
}
const result=scheduler.playAudioAlignedTimeline(events,anchor);
return Object.freeze({accepted:true,scheduled:result.scheduled,responseId:event.response_id,source:Array.isArray(event.phonemes)?"phoneme-alignment":"viseme-provider",prediction});
}
window.CortanaVisemeProvider=Object.freeze({validate,accept,maxEvents:MAX_EVENTS});
})();