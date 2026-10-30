(() => {
"use strict";
const CHANNELS=Object.freeze(["browInnerUp","browDown","eyeWide","eyeSquint","cheekRaise","jawOpen","mouthSmile","mouthFrown","mouthPucker","mouthWide","lipPress","upperLipRaise","lowerLipDepress"]);
const ZERO=Object.freeze(Object.fromEntries(CHANNELS.map(k=>[k,0])));
const EMOTIONS=Object.freeze({
calm:Object.freeze({}),joy:Object.freeze({cheekRaise:.58,mouthSmile:.52,eyeSquint:.12,browInnerUp:.08}),
sadness:Object.freeze({browInnerUp:.48,browDown:.12,mouthFrown:.5,eyeSquint:.16}),
anger:Object.freeze({browDown:.78,eyeSquint:.42,lipPress:.18,mouthFrown:.12}),
fear:Object.freeze({browInnerUp:.72,eyeWide:.82,jawOpen:.12,mouthFrown:.12}),
surprise:Object.freeze({browInnerUp:.92,eyeWide:.9,jawOpen:.22}),
disgust:Object.freeze({browDown:.28,upperLipRaise:.68,mouthFrown:.18,eyeSquint:.18}),
determination:Object.freeze({browDown:.34,eyeSquint:.2,lipPress:.22})
});
const VISEMES=Object.freeze({
neutral:Object.freeze({}),open:Object.freeze({jawOpen:.78,lowerLipDepress:.46}),
mid:Object.freeze({jawOpen:.46,lowerLipDepress:.2}),wide:Object.freeze({mouthWide:.86,jawOpen:.2}),
round:Object.freeze({mouthPucker:.94,jawOpen:.3}),closed:Object.freeze({lipPress:.9,jawOpen:.015}),
teeth:Object.freeze({upperLipRaise:.42,jawOpen:.1})
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function createFacialIntelligence(options={}) {
const attack=clamp(Number(options.attackSeconds)||.055,.015,.3);
const release=clamp(Number(options.releaseSeconds)||.095,.02,.5);
let current={...ZERO};
function update(input={}) {
const dt=clamp(Number.isFinite(input.deltaSeconds)?input.deltaSeconds:0,0,.1);
const emotion=Object.prototype.hasOwnProperty.call(EMOTIONS,input.emotion)?input.emotion:"calm";
const viseme=Object.prototype.hasOwnProperty.call(VISEMES,input.viseme)?input.viseme:"neutral";
const speaking=input.speaking===true;
const audioLevel=clamp(Number.isFinite(input.audioLevel)?input.audioLevel:0,0,1);
const target={...ZERO,...EMOTIONS[emotion]};
for(const key of Object.keys(VISEMES[viseme])) target[key]=Math.max(target[key],VISEMES[viseme][key]);
if(speaking){target.jawOpen=Math.max(target.jawOpen,audioLevel*(viseme==="closed"?.035:.14));target.mouthSmile*=.28;target.mouthFrown*=.28;target.cheekRaise*=.55;}
else{target.jawOpen*=.18;target.lowerLipDepress*=.12;target.mouthWide*=.35;target.mouthPucker*=.3;target.lipPress*=.45;}
for(const key of CHANNELS){const dest=clamp(Number(target[key])||0,0,1);const duration=dest>current[key]?attack:release;const alpha=dt===0?0:1-Math.exp(-Math.LN2*dt/duration);current[key]=clamp(current[key]+(dest-current[key])*alpha,0,1);}
return Object.freeze({...current,emotion,viseme,speaking});
}
function reset(){current={...ZERO};return Object.freeze({...current,emotion:"calm",viseme:"neutral",speaking:false});}
return Object.freeze({update,reset,getWeights:()=>Object.freeze({...current}),channels:CHANNELS});
}
window.CortanaFacialIntelligence=Object.freeze({version:"1.0.0",channels:CHANNELS,emotions:EMOTIONS,visemes:VISEMES,createFacialIntelligence});
})();