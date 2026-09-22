import {
  migrateLegacy,
  addExercise,
  getAllExercises,
  clearExercises,
  exportBackup,
  importBackup
} from "./db.js";

const NAMES=["Do","Do♯/Re♭","Re","Re♯/Mi♭","Mi","Fa","Fa♯/Sol♭","Sol","Sol♯/La♭","La","La♯/Si♭","Si"];
const SHORT_NAMES=["Do","Do♯","Re","Re♯","Mi","Fa","Fa♯","Sol","Sol♯","La","La♯","Si"];

const BANK={
  easy:[
    {n:"maggiore",i:[0,4,7]},{n:"minore",i:[0,3,7]},{n:"diminuito",i:[0,3,6]},
    {n:"aumentato",i:[0,4,8]},{n:"sus2",i:[0,2,7]},{n:"sus4",i:[0,5,7]},
    {n:"7",i:[0,4,7,10]},{n:"maj7",i:[0,4,7,11]},{n:"m7",i:[0,3,7,10]}
  ],
  jazz:[
    {n:"6",i:[0,4,7,9]},{n:"m6",i:[0,3,7,9]},{n:"m7b5",i:[0,3,6,10]},
    {n:"dim7",i:[0,3,6,9]},{n:"mMaj7",i:[0,3,7,11]},
    {n:"6/9",i:[0,4,7,9,14],omit:[7]},{n:"9",i:[0,4,7,10,14],omit:[7]},
    {n:"maj9",i:[0,4,7,11,14],omit:[7]},{n:"m9",i:[0,3,7,10,14],omit:[7]},
    {n:"11",i:[0,4,7,10,14,17],omit:[7]},{n:"m11",i:[0,3,7,10,14,17],omit:[7]},
    {n:"13",i:[0,4,7,10,14,21],omit:[7]},{n:"m13",i:[0,3,7,10,14,21],omit:[7]}
  ],
  advanced:[
    {n:"7b9",i:[0,4,7,10,13],omit:[7]},{n:"7#9",i:[0,4,7,10,15],omit:[7]},
    {n:"7b5",i:[0,4,6,10]},{n:"7#5",i:[0,4,8,10]},
    {n:"7#11",i:[0,4,10,14,18],omit:[7]},{n:"maj7#11",i:[0,4,11,14,18],omit:[7]},
    {n:"7b13",i:[0,4,10,14,20],omit:[7]},{n:"7alt",i:[0,4,10,13,15,20]},
    {n:"maj13",i:[0,4,11,14,18,21],omit:[7]},{n:"mMaj9",i:[0,3,7,11,14],omit:[7]},
    {n:"7sus4",i:[0,5,7,10]},{n:"rootless9",i:[4,10,14],rootless:true},
    {n:"rootless13",i:[4,10,14,21],rootless:true},{n:"rootlessm9",i:[3,10,14],rootless:true}
  ]
};

const $=id=>document.getElementById(id);
const screens={home:$("homeScreen"),trainer:$("trainerScreen"),history:$("historyScreen")};
const keys=[...document.querySelectorAll(".key")];

const homeBtn=$("homeBtn");
const installBtn=$("installBtn");
const modeOption=$("modeOption");
const trainingMethod=$("trainingMethod");
const timbre=$("timbre");
const playBtn=$("playBtn");
const nextBtn=$("nextBtn");
const settingsBtn=$("settingsBtn");
const settingsPanel=$("settingsPanel");
const registerPreset=$("registerPreset");
const showLabels=$("showLabels");
const antiReference=$("antiReference");
const keyboard=$("keyboard");
const keyboardWrap=$("keyboardWrap");
const identifyPanel=$("identifyPanel");
const rootAnswer=$("rootAnswer");
const qualityAnswer=$("qualityAnswer");
const confirmChord=$("confirmChord");
const status=$("status");
const progress=$("progress");
const answer=$("answer");
const chordTypeWrap=$("chordTypeWrap");

let appMode=null;
let chordTask="notes";
let challenge=null;
let found=new Set();
let wrongPresses=[];
let wrongChordAnswers=[];
let startedAt=0;
let firstSoundAt=0;
let firstResponseMs=null;
let firstAttemptCorrect=null;
let replayCount=0;
let hasPlayed=false;
let savedCurrent=false;
let historyCache=[];
let ctx=null;
let master=null;
let lastSignature="";

function loadSettings(){
  registerPreset.value=localStorage.getItem("cet-register")||"speaker";
  showLabels.checked=localStorage.getItem("cet-labels")!=="0";
  antiReference.checked=localStorage.getItem("cet-antiref")!=="0";
  applyLabelSetting();
}
function saveSettings(){
  localStorage.setItem("cet-register",registerPreset.value);
  localStorage.setItem("cet-labels",showLabels.checked?"1":"0");
  localStorage.setItem("cet-antiref",antiReference.checked?"1":"0");
}
function applyLabelSetting(){keyboard.classList.toggle("hide-labels",!showLabels.checked)}
[registerPreset,showLabels,antiReference].forEach(el=>el.addEventListener("change",()=>{saveSettings();applyLabelSetting()}));
settingsBtn.addEventListener("click",()=>settingsPanel.hidden=!settingsPanel.hidden);

function showScreen(name){
  Object.values(screens).forEach(s=>s.classList.remove("active"));
  screens[name].classList.add("active");
  homeBtn.hidden=name==="home";
  if(name==="history")renderHistory();
}
homeBtn.addEventListener("click",()=>showScreen("home"));

document.querySelectorAll("[data-open]").forEach(btn=>btn.addEventListener("click",()=>{
  const target=btn.dataset.open;
  if(target==="history")showScreen("history");
  else openTrainer(target);
}));

function openTrainer(mode){
  appMode=mode;
  $("trainerTitle").textContent=mode==="chords"?"Accordi":"Note";
  $("trainerSub").textContent=mode==="chords"?"Scegli manualmente livello e metodo.":"Una o due note; livello sempre scelto da te.";
  chordTypeWrap.hidden=mode!=="chords";
  chordTask="notes";
  syncChordTaskButtons();

  if(mode==="chords"){
    modeOption.innerHTML='<option value="easy">Facile</option><option value="jazz" selected>Jazz</option><option value="advanced">Avanzato</option>';
  }else{
    modeOption.innerHTML='<option value="1" selected>1 nota</option><option value="2">2 note</option>';
  }
  showScreen("trainer");
  syncAnswerUI();
  nextChallenge(false);
}
modeOption.addEventListener("change",()=>{refreshQualityOptions();nextChallenge(false)});
trainingMethod.addEventListener("change",()=>nextChallenge(false));

document.querySelectorAll("[data-chord-task]").forEach(btn=>btn.addEventListener("click",()=>{
  chordTask=btn.dataset.chordTask;
  syncChordTaskButtons();
  syncAnswerUI();
  nextChallenge(false);
}));
function syncChordTaskButtons(){
  document.querySelectorAll("[data-chord-task]").forEach(btn=>btn.classList.toggle("active",btn.dataset.chordTask===chordTask));
}
function syncAnswerUI(){
  const identify=appMode==="chords"&&chordTask==="identify";
  keyboardWrap.hidden=identify;
  identifyPanel.hidden=!identify;
  if(identify)refreshQualityOptions();
}
function refreshQualityOptions(){
  rootAnswer.innerHTML=NAMES.map((n,i)=>`<option value="${i}">${n}</option>`).join("");
  if(appMode!=="chords")return;
  const names=[...new Set(chordPool(modeOption.value).filter(c=>!c.rootless).map(c=>c.n))];
  qualityAnswer.innerHTML=names.map(n=>`<option value="${n}">${n}</option>`).join("");
}

function ensureAudio(){
  if(!ctx){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return null;
    ctx=new AC();
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-8;comp.knee.value=8;comp.ratio.value=8;comp.attack.value=.002;comp.release.value=.16;
    master=ctx.createGain();master.gain.value=1.55;
    comp.connect(master);master.connect(ctx.destination);ctx._comp=comp;
  }
  if(ctx.state==="suspended")ctx.resume();
  return ctx;
}
function freq(m){return 440*Math.pow(2,(m-69)/12)}
function loudnessComp(midi){
  const d=midi-60;let c=1;
  if(d<0)c=1+Math.min(.22,(-d)*.014);
  else c=1-Math.min(.18,d*.008);
  return Math.max(.82,Math.min(1.22,c));
}
function connectVoice(o,g){o.connect(g);g.connect(ctx._comp)}
function playPiano(midi,when=0,dur=1.7,gain=.195){
  ensureAudio();const t=ctx.currentTime+when;
  [[1,1,"triangle"],[2,.24,"sine"],[3,.11,"sine"],[4,.055,"sine"]].forEach(([mul,amp,type])=>{
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq(midi)*mul,t);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain*amp,t+.009);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    connectVoice(o,g);o.start(t);o.stop(t+dur+.04);
  });
}
function playEPiano(midi,when=0,dur=1.6,gain=.18){
  ensureAudio();const t=ctx.currentTime+when;
  const carrier=ctx.createOscillator(),mod=ctx.createOscillator(),mg=ctx.createGain(),amp=ctx.createGain();
  carrier.type="sine";mod.type="sine";
  carrier.frequency.setValueAtTime(freq(midi),t);mod.frequency.setValueAtTime(freq(midi)*2,t);
  mg.gain.setValueAtTime(freq(midi)*.7,t);mg.gain.exponentialRampToValueAtTime(1,t+dur*.7);
  mod.connect(mg);mg.connect(carrier.frequency);
  amp.gain.setValueAtTime(.0001,t);amp.gain.exponentialRampToValueAtTime(gain,t+.012);amp.gain.exponentialRampToValueAtTime(.0001,t+dur);
  connectVoice(carrier,amp);carrier.start(t);mod.start(t);carrier.stop(t+dur+.05);mod.stop(t+dur+.05);
}
function playOrgan(midi,when=0,dur=1.5,gain=.108){
  ensureAudio();const t=ctx.currentTime+when;
  [[1,1],[2,.55],[3,.32],[4,.2]].forEach(([mul,a])=>{
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type="sine";o.frequency.setValueAtTime(freq(midi)*mul,t);
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain*a,t+.025);g.gain.setValueAtTime(gain*a,t+dur-.12);g.gain.linearRampToValueAtTime(.0001,t+dur);
    connectVoice(o,g);o.start(t);o.stop(t+dur+.04);
  });
}
function playMidi(midi,when=0,solo=false){
  const g=(solo?1.1:1)*loudnessComp(midi);
  if(timbre.value==="epiano")playEPiano(midi,when,solo?1.1:1.6,.18*g);
  else if(timbre.value==="organ")playOrgan(midi,when,solo?1:1.5,.108*g);
  else playPiano(midi,when,solo?1.05:1.7,.195*g);
}
function registerBounds(){
  if(registerPreset.value==="full")return{base:43,min:43,max:88,key:48};
  if(registerPreset.value==="headphones")return{base:50,min:50,max:86,key:55};
  return{base:55,min:55,max:84,key:60};
}
function playPc(pc){const b=registerBounds();playMidi(b.key+pc,0,true)}

function chordPool(level){
  if(level==="easy")return BANK.easy;
  if(level==="jazz")return [...BANK.easy,...BANK.jazz];
  return [...BANK.easy,...BANK.jazz,...BANK.advanced];
}
function circularDistance(a,b){const d=Math.abs(a-b)%12;return Math.min(d,12-d)}
function overlapCount(a,b){const s=new Set(b);return a.reduce((n,x)=>n+(s.has(x)?1:0),0)}
function bassDistance(a,b){return(!a?.midis?.length||!b?.midis?.length)?99:Math.abs(Math.min(...a.midis)-Math.min(...b.midis))}

function noteWeaknessScores(){
  const exposure=Array(12).fill(0),penalty=Array(12).fill(0);
  historyCache.forEach(r=>{
    (r.targets||[]).forEach(pc=>{
      exposure[pc]++;
      if(!r.correctExercise)penalty[pc]+=1;
      penalty[pc]+=Math.min(r.errors||0,3)*.12;
    });
  });
  return exposure.map((n,i)=>n?Math.min(1.5,penalty[i]/n):.35);
}
function chordWeaknessMap(){
  const map=new Map();
  historyCache.filter(r=>r.mode==="chords"&&r.chordName).forEach(r=>{
    const x=map.get(r.chordName)||{n:0,p:0};
    x.n++;x.p+=r.correctExercise?0:1;x.p+=Math.min(r.errors||0,3)*.12;map.set(r.chordName,x);
  });
  const out=new Map();
  map.forEach((v,k)=>out.set(k,v.n?v.p/v.n:.35));
  return out;
}
function weightedPick(items,weightFn){
  const weights=items.map(x=>Math.max(.01,weightFn(x)));
  const total=weights.reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(let i=0;i<items.length;i++){r-=weights[i];if(r<=0)return items[i]}
  return items[items.length-1];
}
function noteWeight(pc){
  const method=trainingMethod.value;
  if(method==="random")return 1;
  const w=noteWeaknessScores()[pc];
  return method==="weakness"?1+w*10:1+w*3.5;
}
function chordWeight(ch){
  const method=trainingMethod.value;
  if(method==="random")return 1;
  const w=chordWeaknessMap().get(ch.n)??.35;
  return method==="weakness"?1+w*9:1+w*3;
}

function chordVoicing(root,ch,level,shift=0,forIdentification=false){
  let ints=ch.i.slice();
  if(!forIdentification&&ch.omit?.length&&(level==="advanced"||Math.random()<.55))ints=ints.filter(x=>!ch.omit.includes(x));
  if(!forIdentification&&level==="advanced"&&!ch.rootless&&ints.includes(0)&&ints.length>=4&&Math.random()<.28)ints=ints.filter(x=>x!==0);

  const b=registerBounds();
  let midis=ints.map(i=>b.base+root+i+shift);
  const roll=Math.random();
  if(midis.length>=4&&roll<.30)midis=midis.map((m,i)=>i%2?m+12:m).sort((a,b)=>a-b);
  else if(midis.length>=4&&roll<.50){midis.sort((a,b)=>a-b);midis[midis.length-2]-=12;midis.sort((a,b)=>a-b)}

  while(Math.min(...midis)<b.min)midis=midis.map(m=>m+12);
  while(Math.max(...midis)>b.max&&Math.min(...midis)-12>=b.min)midis=midis.map(m=>m-12);
  return{midis,pcs:[...new Set(midis.map(m=>(m%12+12)%12))].sort((a,b)=>a-b)};
}
function chordCandidateScore(prev,c){
  if(!prev||!antiReference.checked)return 999;
  const rd=circularDistance(prev.root??prev.pcs[0],c.root??c.pcs[0]);
  const ov=overlapCount(prev.pcs,c.pcs),bd=bassDistance(prev,c);
  let score=rd*3+Math.min(bd,12)*1.3-ov*8;
  if(prev.ch?.n&&c.ch?.n&&prev.ch.n===c.ch.n)score-=7;
  if(rd>=4)score+=5;if(rd>=5)score+=4;if(ov===0)score+=8;else if(ov===1)score+=2;
  return score;
}
function makeChordChallenge(prev){
  const level=modeOption.value;
  let pool=chordPool(level);
  const identifying=chordTask==="identify";
  if(identifying)pool=pool.filter(ch=>!ch.rootless);

  let best=null,bestScore=-Infinity;
  for(let a=0;a<220;a++){
    const roots=[0,1,2,3,4,5,6,7,8,9,10,11];
    const root=weightedPick(roots,noteWeight);
    const ch=weightedPick(pool,chordWeight);
    const shift=Math.random()<.55?0:12;
    const v=chordVoicing(root,ch,level,shift,identifying);
    const sig=`${root}|${ch.n}|${v.pcs.join(",")}|${shift}|${chordTask}`;
    if(sig===lastSignature)continue;
    const c={kind:"chords",root,ch,...v,detail:level,signature:sig};
    const score=chordCandidateScore(prev,c);
    if(score>bestScore){best=c;bestScore=score}
    if(!antiReference.checked)break;
    if(prev&&circularDistance(prev.root??0,root)>=3&&overlapCount(prev.pcs,c.pcs)<=1&&prev.ch?.n!==ch.n&&bassDistance(prev,c)>=3&&score>=24){best=c;break}
  }
  return best;
}
function makeNoteChallenge(prev){
  const count=Number(modeOption.value);
  let best=null,bestScore=-Infinity;
  for(let a=0;a<180;a++){
    const available=[0,1,2,3,4,5,6,7,8,9,10,11];
    const pcs=[];
    while(pcs.length<count){
      const choices=available.filter(x=>!pcs.includes(x));
      const pc=weightedPick(choices,noteWeight);
      if(!pcs.includes(pc))pcs.push(pc);
    }
    pcs.sort((a,b)=>a-b);
    if(count===2&&circularDistance(pcs[0],pcs[1])<3)continue;

    const b=registerBounds();
    const midis=pcs.map((pc,i)=>b.key+pc+(i&&pc<=pcs[0]?12:0));
    const c={kind:"notes",pcs,midis,detail:String(count),signature:`notes|${pcs.join(",")}`};
    let score=999;
    if(prev&&antiReference.checked){
      const ov=overlapCount(prev.pcs,pcs);
      const minDist=Math.min(...pcs.map(x=>Math.min(...prev.pcs.map(y=>circularDistance(x,y)))));
      score=-ov*14+minDist*4;
    }
    if(score>bestScore){best=c;bestScore=score}
    if(!antiReference.checked)break;
    if(prev&&overlapCount(prev.pcs,pcs)===0&&score>=12){best=c;break}
  }
  return best||{kind:"notes",pcs:[0],midis:[60],detail:String(count),signature:"notes|0"};
}

function resetAttemptState(){
  found=new Set();wrongPresses=[];wrongChordAnswers=[];
  startedAt=Date.now();firstSoundAt=0;firstResponseMs=null;firstAttemptCorrect=null;
  replayCount=0;hasPlayed=false;savedCurrent=false;
  keys.forEach(k=>k.classList.remove("correct","wrong"));
  status.textContent="";status.className="status";answer.textContent="";nextBtn.disabled=true;
}
function nextChallenge(autoPlay=false){
  const prev=challenge;
  challenge=appMode==="chords"?makeChordChallenge(prev):makeNoteChallenge(prev);
  lastSignature=challenge.signature;
  resetAttemptState();
  updateProgress();
  if(autoPlay)playChallenge(false);
}
function playChallenge(userInitiated=true){
  if(!challenge)return;
  ensureAudio();
  if(hasPlayed&&userInitiated)replayCount++;
  if(!hasPlayed){hasPlayed=true;firstSoundAt=Date.now()}
  challenge.midis.forEach(m=>playMidi(m,0,false));
}
playBtn.addEventListener("click",()=>playChallenge(true));
nextBtn.addEventListener("click",()=>nextChallenge(true));

function markFirstResponse(correct){
  if(firstResponseMs===null){
    const base=firstSoundAt||startedAt;
    firstResponseMs=Math.max(0,Date.now()-base);
    firstAttemptCorrect=!!correct;
  }
}
function updateProgress(){
  if(appMode==="chords"&&chordTask==="identify"){
    progress.textContent="Riconosci fondamentale e qualità";
  }else{
    progress.textContent=`${found.size} di ${challenge?challenge.pcs.length:0} note riconosciute`;
  }
}
async function saveCompleted(){
  if(savedCurrent)return;
  savedCurrent=true;
  const errors=appMode==="chords"&&chordTask==="identify"?wrongChordAnswers.length:wrongPresses.length;
  const row={
    id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    ts:Date.now(),
    mode:appMode,
    detail:challenge.detail,
    exerciseType:appMode==="chords"?chordTask:"notes",
    method:trainingMethod.value,
    timbre:timbre.value,
    registerPreset:registerPreset.value,
    antiReference:antiReference.checked,
    targets:challenge.pcs.slice(),
    chordRoot:challenge.root??null,
    chordName:challenge.ch?.n??null,
    wrong:wrongPresses.slice(),
    wrongChordAnswers:wrongChordAnswers.slice(),
    errors,
    attempts:(appMode==="chords"&&chordTask==="identify"?1:challenge.pcs.length)+errors,
    correctExercise:errors===0,
    firstAttemptCorrect:firstAttemptCorrect??errors===0,
    firstResponseMs,
    durationMs:Math.max(0,Date.now()-startedAt),
    replayCount
  };
  await addExercise(row);
  historyCache.push(row);
}
async function finishExercise(){
  status.textContent="Corretto";status.className="status ok";nextBtn.disabled=false;
  if(appMode==="chords"&&chordTask==="identify"){
    answer.textContent=`${NAMES[challenge.root]} · ${challenge.ch.n}`;
  }else{
    answer.textContent=challenge.pcs.map(pc=>NAMES[pc]).join(" · ");
  }
  await saveCompleted();
}

keys.forEach(k=>k.addEventListener("click",async()=>{
  const pc=Number(k.dataset.pc);
  playPc(pc);
  if(!challenge||!nextBtn.disabled||identifyPanel.hidden===false)return;
  const correct=challenge.pcs.includes(pc);
  markFirstResponse(correct);
  if(correct){
    found.add(pc);k.classList.remove("wrong");k.classList.add("correct");
    status.textContent="Nota corretta";status.className="status ok";
  }else{
    wrongPresses.push(pc);k.classList.add("wrong");
    status.textContent="Nota errata";status.className="status bad";
  }
  updateProgress();
  if(challenge.pcs.every(x=>found.has(x)))await finishExercise();
}));

confirmChord.addEventListener("click",async()=>{
  if(!challenge||!nextBtn.disabled)return;
  const root=Number(rootAnswer.value),quality=qualityAnswer.value;
  const correct=root===challenge.root&&quality===challenge.ch.n;
  markFirstResponse(correct);
  if(correct){
    await finishExercise();
  }else{
    wrongChordAnswers.push({root,quality});
    status.textContent="Non è questo accordo";status.className="status bad";
  }
});

/* ---------- History ---------- */
const periodFilter=$("periodFilter"),modeFilter=$("modeFilter"),detailFilter=$("detailFilter");
[periodFilter,modeFilter,detailFilter].forEach(el=>el.addEventListener("change",()=>{
  if(el===modeFilter)refreshDetailFilter();
  renderHistory();
}));
document.querySelectorAll("[data-history-tab]").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll("[data-history-tab]").forEach(x=>x.classList.toggle("active",x===btn));
  document.querySelectorAll(".history-view").forEach(v=>v.classList.remove("active"));
  $({
    overview:"historyOverview",
    notes:"historyNotes",
    chords:"historyChords",
    confusions:"historyConfusions"
  }[btn.dataset.historyTab]).classList.add("active");
  renderHistory();
}));

function refreshDetailFilter(){
  const keep=detailFilter.value;
  const opts=modeFilter.value==="chords"
    ?[["all","Tutti i livelli"],["easy","Facile"],["jazz","Jazz"],["advanced","Avanzato"]]
    :modeFilter.value==="notes"
      ?[["all","Tutte"],["1","1 nota"],["2","2 note"]]
      :[["all","Tutti i livelli"]];
  detailFilter.innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
  if(opts.some(x=>x[0]===keep))detailFilter.value=keep;
}
function filteredHistory(){
  const days=periodFilter.value==="all"?null:Number(periodFilter.value);
  const cut=days?Date.now()-days*86400000:0;
  return historyCache.filter(r=>
    (!cut||r.ts>=cut)&&
    (modeFilter.value==="all"||r.mode===modeFilter.value)&&
    (detailFilter.value==="all"||r.detail===detailFilter.value)
  ).sort((a,b)=>a.ts-b.ts);
}
function avg(arr,fn){return arr.length?arr.reduce((s,x)=>s+fn(x),0)/arr.length:0}
function pct(v){return Number.isFinite(v)?Math.round(v)+"%":"—"}
function sec(ms){if(ms==null||!Number.isFinite(ms))return"—";return ms<60000?(ms/1000).toFixed(ms<10000?1:0)+"s":Math.floor(ms/60000)+"m "+Math.round(ms%60000/1000)+"s"}
function dayKey(ts){
  const d=new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function dayLabel(key){
  const [y,m,d]=key.split("-");
  return `${d}/${m}`;
}
function renderHistory(){
  refreshDetailFilter();
  const data=filteredHistory();
  $("mExercises").textContent=data.length;
  $("mAccuracy").textContent=data.length?pct(avg(data,r=>r.correctExercise?100:0)):"—";
  $("mErrors").textContent=data.length?avg(data,r=>r.errors||0).toFixed(1):"—";
  const responseRows=data.filter(r=>r.firstResponseMs!=null);
  $("mTime").textContent=responseRows.length?sec(avg(responseRows,r=>r.firstResponseMs)):"—";

  const trend=$("mTrend");
  if(data.length>=20){
    const n=Math.min(30,Math.floor(data.length/2));
    const old=data.slice(-2*n,-n),recent=data.slice(-n);
    const delta=avg(recent,r=>r.correctExercise?100:0)-avg(old,r=>r.correctExercise?100:0);
    trend.textContent=(delta>0?"+":"")+delta.toFixed(1)+" punti";
    trend.className="trend "+(delta>1?"up":delta<-1?"down":"neutral");
  }else{
    trend.textContent=data.length?"Trend da 20 esercizi":"";
    trend.className="trend neutral";
  }

  drawDaily($("dailyCanvas"),data);
  drawMoving($("movingCanvas"),data);
  drawProblemNotes($("errorsCanvas"),data);
  renderNoteStats(data);
  renderChordStats(data);
  drawConfusions($("confusionCanvas"),data);

  const rows=[...data].reverse().slice(0,14);
  $("recentRows").innerHTML=rows.length?rows.map(r=>{
    const d=new Date(r.ts);
    const when=d.toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
    let md=r.mode==="chords"?"Accordi":"Note";
    if(r.mode==="chords")md+=" · "+({easy:"Facile",jazz:"Jazz",advanced:"Avanzato"}[r.detail]||r.detail);
    else md+=" · "+r.detail;
    return `<div class="recent-row"><div>${when}</div><div>${md}</div><div class="${r.correctExercise?"goodnum":"badnum"}">${r.correctExercise?"Corretto":"Con errori"}</div><div>${r.errors||0}</div></div>`;
  }).join(""):'<div class="empty">Nessun esercizio nei filtri selezionati.</div>';
}
function setupCanvas(canvas){
  const rect=canvas.getBoundingClientRect(),dpr=Math.max(1,window.devicePixelRatio||1);
  const w=Math.max(260,Math.round(rect.width)),h=Math.max(105,Math.round(rect.height));
  canvas.width=w*dpr;canvas.height=h*dpr;
  const c=canvas.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);
  return{c,w,h};
}
function drawDaily(canvas,data){
  const{c,w,h}=setupCanvas(canvas);c.clearRect(0,0,w,h);
  const map=new Map();
  data.forEach(r=>{
    const k=dayKey(r.ts),x=map.get(k)||{correct:0,errors:0};
    if(r.correctExercise)x.correct++;
    x.errors+=r.errors||0;
    map.set(k,x);
  });
  const rows=[...map.entries()].slice(-14);
  if(!rows.length){emptyCanvas(c,w,h);return}
  const max=Math.max(1,...rows.flatMap(([,v])=>[v.correct,v.errors]));
  const left=24,bottom=19,top=7,usableW=w-left-5,usableH=h-bottom-top,groupW=usableW/rows.length;
  c.strokeStyle="#34404f";c.beginPath();c.moveTo(left,top);c.lineTo(left,h-bottom);c.lineTo(w-5,h-bottom);c.stroke();
  rows.forEach(([k,v],i)=>{
    const bw=Math.max(2,groupW*.26),cx=left+i*groupW+groupW/2;
    const hc=v.correct/max*usableH,he=v.errors/max*usableH;
    c.fillStyle="#45c97a";c.fillRect(cx-bw-1,h-bottom-hc,bw,hc);
    c.fillStyle="#ef6464";c.fillRect(cx+1,h-bottom-he,bw,he);
    c.fillStyle="#94a3b8";c.font="8px system-ui";c.textAlign="center";
    if(rows.length<=10||i%2===0)c.fillText(dayLabel(k),cx,h-5);
  });
  c.font="8px system-ui";c.textAlign="left";c.fillStyle="#45c97a";c.fillText("■ corretti",left+3,10);
  c.fillStyle="#ef6464";c.fillText("■ errori",left+60,10);
}
function drawMoving(canvas,data){
  const{c,w,h}=setupCanvas(canvas);c.clearRect(0,0,w,h);
  if(!data.length){emptyCanvas(c,w,h);return}
  const windowSize=20,pts=data.map((_,i)=>{
    const chunk=data.slice(Math.max(0,i-windowSize+1),i+1);
    return avg(chunk,r=>r.correctExercise?100:0);
  });
  [0,50,100].forEach(v=>{
    const y=8+(100-v)/100*(h-22);c.strokeStyle="#34404f";c.beginPath();c.moveTo(28,y);c.lineTo(w-5,y);c.stroke();
    c.fillStyle="#94a3b8";c.font="8px system-ui";c.textAlign="right";c.fillText(v+"%",25,y+3);
  });
  c.strokeStyle="#75c8ff";c.lineWidth=2;c.beginPath();
  pts.forEach((v,i)=>{
    const x=30+(pts.length===1?.5:i/(pts.length-1))*(w-38),y=8+(100-v)/100*(h-22);
    if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
  });
  c.stroke();
}
function emptyCanvas(c,w,h){c.fillStyle="#94a3b8";c.font="10px system-ui";c.textAlign="center";c.fillText("Nessun dato",w/2,h/2)}
function notePerformance(data){
  const rows=Array.from({length:12},(_,pc)=>({pc,seen:0,failed:0,wrongPress:0,errors:0}));
  data.forEach(r=>{
    (r.targets||[]).forEach(pc=>{
      rows[pc].seen++;
      if(!r.correctExercise)rows[pc].failed++;
      rows[pc].errors+=r.errors||0;
    });
    (r.wrong||[]).forEach(pc=>rows[pc].wrongPress++);
  });
  return rows;
}
function drawProblemNotes(canvas,data){
  const{c,w,h}=setupCanvas(canvas);c.clearRect(0,0,w,h);
  const rows=notePerformance(data).filter(x=>x.seen).map(x=>({...x,rate:x.seen?x.failed/x.seen:0})).sort((a,b)=>b.rate-a.rate||b.wrongPress-a.wrongPress).slice(0,7);
  if(!rows.length){emptyCanvas(c,w,h);return}
  const max=Math.max(.01,...rows.map(x=>x.rate));
  const rowH=(h-5)/rows.length;
  rows.forEach((x,i)=>{
    const y=i*rowH,bw=(w-65)*(x.rate/max);
    c.fillStyle="#94a3b8";c.font="9px system-ui";c.textAlign="right";c.fillText(SHORT_NAMES[x.pc],42,y+rowH*.65);
    c.fillStyle="#253342";c.fillRect(50,y+rowH*.22,w-58,rowH*.46);
    c.fillStyle="#ef6464";c.fillRect(50,y+rowH*.22,bw,rowH*.46);
    c.fillStyle="#f5f7fb";c.textAlign="left";c.fillText(Math.round(x.rate*100)+"%",54+Math.min(bw,w-78),y+rowH*.65);
  });
}
function renderNoteStats(data){
  const rows=notePerformance(data);
  $("noteStats").innerHTML='<div class="stat-row head"><div>Nota</div><div>Prove</div><div>Senza errori</div><div>Premuta errata</div></div>'+
    rows.map(x=>{
      const clean=x.seen?Math.round((x.seen-x.failed)/x.seen*100):0;
      return `<div class="stat-row"><div>${NAMES[x.pc]}</div><div>${x.seen}</div><div class="${clean>=80?"goodnum":clean<60&&x.seen?"badnum":""}">${x.seen?clean+"%":"—"}</div><div>${x.wrongPress}</div></div>`;
    }).join("");
}
function renderChordStats(data){
  const map=new Map();
  data.filter(r=>r.mode==="chords"&&r.chordName).forEach(r=>{
    const x=map.get(r.chordName)||{name:r.chordName,n:0,clean:0,errors:0,response:[]};
    x.n++;if(r.correctExercise)x.clean++;x.errors+=r.errors||0;if(r.firstResponseMs!=null)x.response.push(r.firstResponseMs);map.set(r.chordName,x);
  });
  const rows=[...map.values()].sort((a,b)=>(a.clean/a.n)-(b.clean/b.n)||b.n-a.n);
  $("chordStats").innerHTML='<div class="stat-row head"><div>Accordo</div><div>Prove</div><div>Senza errori</div><div>Prima risposta</div></div>'+
    (rows.length?rows.map(x=>{
      const clean=Math.round(x.clean/x.n*100);
      return `<div class="stat-row"><div>${x.name}</div><div>${x.n}</div><div class="${clean>=80?"goodnum":clean<60?"badnum":""}">${clean}%</div><div>${x.response.length?sec(avg(x.response,v=>v)):"—"}</div></div>`;
    }).join(""):'<div class="empty">Completa alcuni accordi per vedere le statistiche.</div>');
}
function drawConfusions(canvas,data){
  const{c,w,h}=setupCanvas(canvas);c.clearRect(0,0,w,h);
  const matrix=Array.from({length:12},()=>Array(12).fill(0));
  data.filter(r=>r.mode==="notes"&&String(r.detail)==="1"&&r.targets?.length===1).forEach(r=>{
    const target=r.targets[0];
    (r.wrong||[]).forEach(wrong=>matrix[target][wrong]++);
  });
  const max=Math.max(0,...matrix.flat());
  if(!max){emptyCanvas(c,w,h);return}
  const padL=25,padT=15,cell=Math.min((w-padL-3)/12,(h-padT-3)/12);
  c.font="7px system-ui";c.textAlign="center";
  for(let i=0;i<12;i++){
    c.fillStyle="#94a3b8";
    c.fillText(SHORT_NAMES[i].replace("♯","#"),padL+i*cell+cell/2,9);
    c.textAlign="right";c.fillText(SHORT_NAMES[i].replace("♯","#"),padL-3,padT+i*cell+cell*.65);c.textAlign="center";
    for(let j=0;j<12;j++){
      const v=matrix[i][j],alpha=v?(.18+.82*v/max):.035;
      c.fillStyle=`rgba(239,100,100,${alpha})`;
      c.fillRect(padL+j*cell,padT+i*cell,cell-1,cell-1);
      if(v){c.fillStyle="#fff";c.font="7px system-ui";c.fillText(String(v),padL+j*cell+cell/2,padT+i*cell+cell*.65)}
    }
  }
}

/* ---------- Backup ---------- */
$("exportHistory").addEventListener("click",async()=>{
  const data=await exportBackup();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`chord-ear-trainer-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("importHistory").addEventListener("click",()=>$("importFile").click());
$("importFile").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(!confirm("Importare questo backup sostituendo lo storico presente?"))return;
    await importBackup(data);historyCache=await getAllExercises();renderHistory();
    alert("Backup importato.");
  }catch(err){alert("Backup non valido.");}
  e.target.value="";
});
$("clearHistory").addEventListener("click",async()=>{
  if(confirm("Vuoi cancellare tutto lo storico? Questa operazione non si può annullare.")){
    await clearExercises();historyCache=[];renderHistory();
  }
});

/* ---------- PWA / updates ---------- */
async function setupPWA(){
  if("serviceWorker" in navigator&&location.protocol!=="file:"){
    try{
      const reg=await navigator.serviceWorker.register("./sw.js");
      reg.addEventListener("updatefound",()=>{
        const worker=reg.installing;
        if(!worker)return;
        worker.addEventListener("statechange",()=>{
          if(worker.state==="installed"&&navigator.serviceWorker.controller)$("updateBanner").hidden=false;
        });
      });
    }catch(_){}
  }

  let deferredInstallPrompt=null;
  const isStandalone=()=>window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
  if(!isStandalone()){installBtn.hidden=false;installBtn.textContent="Installa"}
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;if(!isStandalone())installBtn.hidden=false});
  installBtn.addEventListener("click",async()=>{
    if(isStandalone()){installBtn.hidden=true;return}
    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();
      try{const choice=await deferredInstallPrompt.userChoice;if(choice?.outcome==="accepted")installBtn.hidden=true}catch(_){}
      deferredInstallPrompt=null;return;
    }
    alert("Se Chrome non mostra ancora il prompt: menu ⋮ → Aggiungi alla schermata Home / Installa app.");
  });
  window.addEventListener("appinstalled",()=>{installBtn.hidden=true;deferredInstallPrompt=null});
  if(isStandalone())installBtn.hidden=true;
}
$("reloadApp").addEventListener("click",()=>location.reload());

async function init(){
  await migrateLegacy();
  historyCache=await getAllExercises();
  loadSettings();
  refreshDetailFilter();
  await setupPWA();
}
init();
