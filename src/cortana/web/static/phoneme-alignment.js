/* Phoneme-level alignment adapter. Requires timestamped phoneme boundaries from an aligner/provider. */
(() => {
  "use strict";
  const MAX_EVENTS=512, MAX_TIME_SECONDS=86400, MAX_DURATION_MS=5000;
  const MAP=Object.freeze({
    "a":"open","ɑ":"open","ɐ":"open","æ":"open","ʌ":"open","ɒ":"open",
    "e":"mid","ɛ":"mid","ə":"mid","ɜ":"mid","ɘ":"mid","ɤ":"mid",
    "i":"wide","ɪ":"wide","y":"wide","j":"wide","ɨ":"wide",
    "o":"round","ɔ":"round","ɵ":"round","u":"round","ʊ":"round","w":"round",
    "m":"closed","m̩":"closed","p":"closed","b":"closed","ɱ":"closed",
    "f":"teeth","v":"teeth","θ":"teeth","ð":"teeth",
    "t":"neutral","d":"neutral","n":"neutral","s":"neutral","z":"neutral",
    "ʃ":"neutral","ʒ":"neutral","k":"neutral","g":"neutral","ŋ":"neutral",
    "r":"neutral","ɹ":"neutral","l":"neutral","h":"neutral","x":"neutral",
    "ts":"neutral","tʃ":"neutral","dʒ":"neutral"
  });
  const VALID=new Set(["neutral","open","mid","wide","round","closed","teeth"]);
  function normalizePhoneme(value){
    if(typeof value!=="string"||!value.trim()||value.length>16)throw new TypeError("phoneme must be a short non-empty IPA token");
    return value.normalize("NFC").trim().toLocaleLowerCase();
  }
  function toViseme(phoneme){const token=normalizePhoneme(phoneme);return MAP[token]||"neutral";}
  function align(events){
    if(!Array.isArray(events)||events.length===0||events.length>MAX_EVENTS)throw new RangeError("phoneme events must be a non-empty bounded array");
    return events.map((event,index)=>{
      if(!event||typeof event!=="object")throw new TypeError("invalid phoneme event");
      const start=event.startTimeSeconds,end=event.endTimeSeconds;
      if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>MAX_TIME_SECONDS)throw new RangeError("phoneme boundaries must be valid increasing audio timestamps");
      const durationMs=Math.round((end-start)*1000);
      if(durationMs<=0||durationMs>MAX_DURATION_MS)throw new RangeError("phoneme duration must be between 1 and 5000 ms");
      const phoneme=normalizePhoneme(event.phoneme);
      const character=event.character===undefined?"":event.character;
      if(typeof character!=="string"||character.length>8)throw new TypeError("character must be a short string");
      return {audioTimeSeconds:start,durationMs,viseme:toViseme(phoneme),phoneme,character,index};
    }).sort((a,b)=>a.audioTimeSeconds-b.audioTimeSeconds||a.index-b.index)
      .map(({index,...event})=>event);
  }
  window.CortanaPhonemeAlignment=Object.freeze({align,toViseme,normalizePhoneme,maxEvents:MAX_EVENTS});
})();