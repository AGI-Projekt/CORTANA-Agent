/* Predictive lip-sync controller — adaptive scheduling compensation, v1.6.0.
 * Learns observed timer/render lateness and shifts viseme presentation earlier.
 * Prediction is limited to supplied viseme timelines; it never infers phonemes.
 */
(() => {
  "use strict";
  const ALPHA=0.2, MAX_SAMPLES=31, MAX_COMPENSATION_MS=120;
  const MIN_LOOKAHEAD_MS=20, MAX_LOOKAHEAD_MS=120;
  let residuals=[], latencyMs=0, jitterMs=0, initialized=false;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function observe(sample){
    if(!sample||!Number.isFinite(sample.scheduledTimeMs)||!Number.isFinite(sample.actualTimeMs))
      throw new TypeError("scheduledTimeMs and actualTimeMs must be finite");
    const residual=clamp(sample.actualTimeMs-sample.scheduledTimeMs,-500,500);
    residuals.push(residual);if(residuals.length>MAX_SAMPLES)residuals.shift();
    if(!initialized){latencyMs=residual;jitterMs=0;initialized=true;}
    else{const deviation=Math.abs(residual-latencyMs);latencyMs+=(residual-latencyMs)*ALPHA;jitterMs+=(deviation-jitterMs)*ALPHA;}
    latencyMs=clamp(latencyMs,-MAX_COMPENSATION_MS,MAX_COMPENSATION_MS);
    jitterMs=clamp(jitterMs,0,MAX_LOOKAHEAD_MS);
    const state=getState();window.dispatchEvent(new CustomEvent("cortana:predictive-lipsync-state",{detail:state}));return state;
  }
  function getLookaheadMs(){return clamp(20+jitterMs*1.5,MIN_LOOKAHEAD_MS,MAX_LOOKAHEAD_MS);}
  function getState(){return Object.freeze({latencyMs,jitterMs,lookaheadMs:getLookaheadMs(),compensationMs:latencyMs,sampleCount:residuals.length,initialized,maxCompensationMs:MAX_COMPENSATION_MS});}
  function adjustAnchor(anchor){
    if(!anchor||!Number.isFinite(anchor.anchorTimeMs)||!Number.isFinite(anchor.contextTimeSeconds))throw new TypeError("a valid playback anchor is required");
    return Object.freeze(Object.assign({},anchor,{anchorTimeMs:anchor.anchorTimeMs-latencyMs,predictiveCompensationMs:latencyMs}));
  }
  function predictViseme(events,anchor,nowMs){
    if(!Array.isArray(events)||!Number.isFinite(nowMs))throw new TypeError("events and finite nowMs are required");
    if(!anchor||!Number.isFinite(anchor.anchorTimeMs))throw new TypeError("a valid playback anchor is required");
    const horizon=nowMs+getLookaheadMs()-anchor.anchorTimeMs;let active=null;
    for(const event of events){if(!event||!Number.isFinite(event.atMs)||!Number.isFinite(event.durationMs))continue;if(event.atMs<=horizon&&event.atMs+event.durationMs>horizon)active=event;}
    return active?Object.freeze({viseme:active.viseme,character:active.character||"",predictedAtMs:nowMs+getLookaheadMs()}):null;
  }
  function reset(){residuals=[];latencyMs=0;jitterMs=0;initialized=false;return getState();}
  window.CortanaPredictiveLipSync=Object.freeze({observe,adjustAnchor,predictViseme,getState,getLookaheadMs,reset});
})();