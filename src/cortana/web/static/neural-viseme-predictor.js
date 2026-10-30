/* Small online MLP predictor. It learns phoneme-context -> viseme from aligned examples; no pretrained model is implied. */
(() => {
  "use strict";
  const PHONEMES=["a","ɑ","ɐ","æ","ʌ","ɒ","e","ɛ","ə","ɜ","ɘ","ɤ","i","ɪ","y","j","ɨ","o","ɔ","ɵ","u","ʊ","w","m","m̩","p","b","ɱ","f","v","θ","ð","t","d","n","s","z","ʃ","ʒ","k","g","ŋ","r","ɹ","l","h","x","ts","tʃ","dʒ","<unk>"];
  const VISEMES=["neutral","open","mid","wide","round","closed","teeth"];
  const H=12, INPUT=PHONEMES.length*2, OUTPUT=VISEMES.length;
  const index=new Map(PHONEMES.map((p,i)=>[p,i]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function matrix(rows,cols,scale){return Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>Math.sin((r+1)*17+(c+1)*31)*scale));}
  let w1=matrix(H,INPUT,0.025),b1=Array(H).fill(0),w2=matrix(OUTPUT,H,0.025),b2=Array(OUTPUT).fill(0),trained=0;
  const token=p=>index.has(p)?p:"<unk>";
  function features(context){
    const x=Array(INPUT).fill(0),items=Array.isArray(context)?context.slice(-2):[];
    x[index.get(token(items[0]||"<unk>"))]=1;
    x[PHONEMES.length+index.get(token(items[1]||"<unk>"))]=1;
    return x;
  }
  function forward(x){
    const hidden=w1.map((row,i)=>Math.tanh(row.reduce((s,v,j)=>s+v*x[j],b1[i])));
    const logits=w2.map((row,i)=>row.reduce((s,v,j)=>s+v*hidden[j],b2[i]));
    const max=Math.max(...logits),ex=logits.map(v=>Math.exp(v-max)),sum=ex.reduce((a,v)=>a+v,0);
    return {hidden,probabilities:ex.map(v=>v/sum)};
  }
  function train(sequence,options={}){
    if(!Array.isArray(sequence)||sequence.length<2||sequence.length>MAX_SEQUENCE)throw new RangeError("training sequence must contain 2–512 aligned phonemes");
    const epochs=clamp(Number.isInteger(options.epochs)?options.epochs:8,1,50),rate=clamp(Number.isFinite(options.learningRate)?options.learningRate:0.035,0.001,0.2);
    const rows=sequence.map(item=>{
      if(!item||typeof item.phoneme!=="string"||typeof item.viseme!=="string"||!VISEMES.includes(item.viseme))throw new TypeError("training data requires phoneme and valid viseme");
      return {phoneme:token(item.phoneme.normalize("NFC").toLocaleLowerCase()),target:VISEMES.indexOf(item.viseme)};
    });
    let loss=0,samples=0;
    for(let epoch=0;epoch<epochs;epoch++){
      for(let i=0;i<rows.length;i++){
        const x=features([i>=2?rows[i-2].phoneme:"<unk>",i>=1?rows[i-1].phoneme:"<unk>"]),{hidden,probabilities}=forward(x),delta=probabilities.slice();
        delta[rows[i].target]-=1;loss-=Math.log(Math.max(probabilities[rows[i].target],1e-9));samples++;
        const oldW2=w2.map(row=>row.slice());
        for(let o=0;o<OUTPUT;o++){for(let h=0;h<H;h++)w2[o][h]-=rate*delta[o]*hidden[h];b2[o]-=rate*delta[o];}
        for(let h=0;h<H;h++){
          let grad=0;for(let o=0;o<OUTPUT;o++)grad+=delta[o]*oldW2[o][h];
          grad*=1-hidden[h]*hidden[h];
          for(let j=0;j<INPUT;j++)w1[h][j]-=rate*grad*x[j];b1[h]-=rate*grad;
        }
      }
    }
    trained+=rows.length*epochs;
    return Object.freeze({samples:rows.length,epochs,loss:loss/samples,totalTrainingSteps:trained});
  }
  function predictNext(context){
    if(!Array.isArray(context)||context.length>32)throw new TypeError("context must be a bounded phoneme array");
    const {probabilities}=forward(features(context.map(p=>token(String(p).normalize("NFC").toLocaleLowerCase()))));
    let best=0;for(let i=1;i<probabilities.length;i++)if(probabilities[i]>probabilities[best])best=i;
    return Object.freeze({viseme:VISEMES[best],confidence:probabilities[best],trainedSteps:trained});
  }
  function reset(){w1=matrix(H,INPUT,0.025);b1=Array(H).fill(0);w2=matrix(OUTPUT,H,0.025);b2=Array(OUTPUT).fill(0);trained=0;return getState();}
  function getState(){return Object.freeze({trainedSteps:trained,phonemeVocabulary:PHONEMES.length,visemeClasses:OUTPUT,hiddenUnits:H});}
  const MAX_SEQUENCE=512;
  window.CortanaNeuralVisemePredictor=Object.freeze({train,predictNext,getState,reset});
})();