(() => {
  const NAMES=["Do","Do♯/Re♭","Re","Re♯/Mi♭","Mi","Fa","Fa♯/Sol♭","Sol","Sol♯/La♭","La","La♯/Si♭","Si"];
  const STORAGE_KEY="chord-ear-trainer-history-v1";
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
  const homeBtn=$("homeBtn"), installBtn=$("installBtn"), modeOption=$("modeOption"), timbre=$("timbre");
  const playBtn=$("playBtn"), nextBtn=$("nextBtn"), status=$("status"), progress=$("progress"), answer=$("answer");
  const keys=[...document.querySelectorAll(".key")];
  let appMode=null,challenge=null,previousChallenge=null,found=new Set(),wrongPresses=[],startTime=0,ctx=null,master=null,lastSig="";

  function loadHistory(){try{const raw=localStorage.getItem(STORAGE_KEY);const d=raw?JSON.parse(raw):[];return Array.isArray(d)?d:[]}catch(_){return []}}
  function saveHistory(d){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d.slice(-5000)))}catch(_){}}
  function addHistory(row){const d=loadHistory();d.push(row);saveHistory(d)}
  function showScreen(name){Object.values(screens).forEach(s=>s.classList.remove("active"));screens[name].classList.add("active");homeBtn.hidden=name==="home";if(name==="history")renderHistory()}
  function goHome(){showScreen("home")}
  homeBtn.addEventListener("click",goHome);
  document.querySelectorAll("[data-open]").forEach(btn=>btn.addEventListener("click",()=>{const t=btn.dataset.open;if(t==="history")showScreen("history");else openTrainer(t)}));

  function openTrainer(mode){
    appMode=mode;
    $("trainerTitle").textContent=mode==="chords"?"Accordi":"Note";
    $("trainerSub").textContent=mode==="chords"?"Trova tutte le note. L’ottava non conta.":"Riconosci una o due note. L’ottava non conta.";
    if(mode==="chords")modeOption.innerHTML='<option value="easy">Facile</option><option value="jazz" selected>Jazz</option><option value="advanced">Avanzato</option>';
    else modeOption.innerHTML='<option value="1" selected>1 nota</option><option value="2">2 note</option>';
    showScreen("trainer");nextChallenge(false)
  }
  modeOption.addEventListener("change",()=>nextChallenge(false));

  function ensureAudio(){
    if(!ctx){
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;ctx=new AC();
      const comp=ctx.createDynamicsCompressor();comp.threshold.value=-8;comp.knee.value=8;comp.ratio.value=8;comp.attack.value=.002;comp.release.value=.16;
      master=ctx.createGain();master.gain.value=1.55;comp.connect(master);master.connect(ctx.destination);ctx._comp=comp;
    }
    if(ctx.state==="suspended")ctx.resume();return ctx
  }
  function freq(m){return 440*Math.pow(2,(m-69)/12)}
  function loudnessComp(midi){const d=midi-60;let c=1;if(d<0)c=1+Math.min(.22,(-d)*.014);else c=1-Math.min(.18,d*.008);return Math.max(.82,Math.min(1.22,c))}
  function connectVoice(o,g){o.connect(g);g.connect(ctx._comp)}
  function playPiano(midi,when=0,dur=1.7,gain=.195){
    ensureAudio();const t=ctx.currentTime+when;
    [[1,1,"triangle"],[2,.24,"sine"],[3,.11,"sine"],[4,.055,"sine"]].forEach(([mul,amp,type])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq(midi)*mul,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain*amp,t+.009);g.gain.exponentialRampToValueAtTime(.0001,t+dur);connectVoice(o,g);o.start(t);o.stop(t+dur+.04)})
  }
  function playEPiano(midi,when=0,dur=1.6,gain=.18){
    ensureAudio();const t=ctx.currentTime+when;const carrier=ctx.createOscillator(),mod=ctx.createOscillator(),mg=ctx.createGain(),amp=ctx.createGain();
    carrier.type="sine";mod.type="sine";carrier.frequency.setValueAtTime(freq(midi),t);mod.frequency.setValueAtTime(freq(midi)*2,t);mg.gain.setValueAtTime(freq(midi)*.7,t);mg.gain.exponentialRampToValueAtTime(1,t+dur*.7);mod.connect(mg);mg.connect(carrier.frequency);amp.gain.setValueAtTime(.0001,t);amp.gain.exponentialRampToValueAtTime(gain,t+.012);amp.gain.exponentialRampToValueAtTime(.0001,t+dur);connectVoice(carrier,amp);carrier.start(t);mod.start(t);carrier.stop(t+dur+.05);mod.stop(t+dur+.05)
  }
  function playOrgan(midi,when=0,dur=1.5,gain=.108){
    ensureAudio();const t=ctx.currentTime+when;[[1,1],[2,.55],[3,.32],[4,.2]].forEach(([mul,a])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.setValueAtTime(freq(midi)*mul,t);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain*a,t+.025);g.gain.setValueAtTime(gain*a,t+dur-.12);g.gain.linearRampToValueAtTime(.0001,t+dur);connectVoice(o,g);o.start(t);o.stop(t+dur+.04)})
  }
  function playMidi(midi,when=0,solo=false){const g=(solo?1.1:1)*loudnessComp(midi);if(timbre.value==="epiano")playEPiano(midi,when,solo?1.1:1.6,.18*g);else if(timbre.value==="organ")playOrgan(midi,when,solo?1:1.5,.108*g);else playPiano(midi,when,solo?1.05:1.7,.195*g)}
  function playPc(pc){playMidi(60+pc,0,true)}
  function chordPool(level){if(level==="easy")return BANK.easy;if(level==="jazz")return [...BANK.easy,...BANK.jazz];return [...BANK.easy,...BANK.jazz,...BANK.advanced]}
  function chordVoicing(root,ch,level,shift=0){
    let ints=ch.i.slice();if(ch.omit?.length&&(level==="advanced"||Math.random()<.55))ints=ints.filter(x=>!ch.omit.includes(x));
    if(level==="advanced"&&!ch.rootless&&ints.includes(0)&&ints.length>=4&&Math.random()<.28)ints=ints.filter(x=>x!==0);
    let midis=ints.map(i=>55+root+i+shift);const roll=Math.random();
    if(midis.length>=4&&roll<.30)midis=midis.map((m,i)=>i%2?m+12:m).sort((a,b)=>a-b);
    else if(midis.length>=4&&roll<.50){midis.sort((a,b)=>a-b);midis[midis.length-2]-=12;midis.sort((a,b)=>a-b)}
    while(Math.min(...midis)<55)midis=midis.map(m=>m+12);
    while(Math.max(...midis)>84&&Math.min(...midis)-12>=55)midis=midis.map(m=>m-12);
    return{midis,pcs:[...new Set(midis.map(m=>(m%12+12)%12))].sort((a,b)=>a-b)}
  }
  function circularDistance(a,b){const d=Math.abs(a-b)%12;return Math.min(d,12-d)}
  function overlapCount(a,b){const s=new Set(b);return a.reduce((n,x)=>n+(s.has(x)?1:0),0)}
  function bassDistance(a,b){return(!a?.midis?.length||!b?.midis?.length)?99:Math.abs(Math.min(...a.midis)-Math.min(...b.midis))}
  function candidateScore(prev,c){if(!prev)return 999;const rd=circularDistance(prev.root??prev.pcs[0],c.root??c.pcs[0]),ov=overlapCount(prev.pcs,c.pcs),bd=bassDistance(prev,c);let score=rd*3+Math.min(bd,12)*1.3-ov*8;if(prev.ch?.n&&c.ch?.n&&prev.ch.n===c.ch.n)score-=7;if(rd>=4)score+=5;if(rd>=5)score+=4;if(ov===0)score+=8;else if(ov===1)score+=2;return score}
  function makeChordChallenge(){
    const level=modeOption.value,p=chordPool(level),prev=challenge;let best=null,bestScore=-Infinity;
    for(let a=0;a<180;a++){
      const root=Math.floor(Math.random()*12),ch=p[Math.floor(Math.random()*p.length)],shift=Math.random()<.5?0:12,v=chordVoicing(root,ch,level,shift),sig=root+"|"+ch.n+"|"+v.pcs.join(",")+"|"+shift;
      if(sig===lastSig)continue;const c={kind:"chords",root,ch,...v,detail:level,signature:sig},s=candidateScore(prev,c);if(s>bestScore){best=c;bestScore=s}
      if(prev&&circularDistance(prev.root??0,root)>=3&&overlapCount(prev.pcs,c.pcs)<=1&&prev.ch?.n!==ch.n&&bassDistance(prev,c)>=3&&s>=24){best=c;break}
    }
    return best
  }
  function makeNoteChallenge(){
    const count=Number(modeOption.value),prev=challenge;let best=null,bestScore=-Infinity;
    for(let a=0;a<120;a++){
      const pcs=[];while(pcs.length<count){const pc=Math.floor(Math.random()*12);if(!pcs.includes(pc))pcs.push(pc)}pcs.sort((a,b)=>a-b);if(count===2&&circularDistance(pcs[0],pcs[1])<3)continue;
      const midis=pcs.map((pc,i)=>60+pc+(i&&pc<=pcs[0]?12:0)),c={kind:"notes",pcs,midis,detail:String(count),signature:"notes|"+pcs.join(",")};
      const s=prev?(-overlapCount(prev.pcs,pcs)*12+Math.min(...pcs.map(x=>Math.min(...prev.pcs.map(y=>circularDistance(x,y)))))*4):999;
      if(s>bestScore){best=c;bestScore=s}if(prev&&overlapCount(prev.pcs,pcs)===0&&s>=12){best=c;break}
    }
    return best||{kind:"notes",pcs:[0],midis:[60],detail:String(count),signature:"notes|0"}
  }
  function nextChallenge(autoPlay=false){previousChallenge=challenge;challenge=appMode==="chords"?makeChordChallenge():makeNoteChallenge();lastSig=challenge.signature;found=new Set();wrongPresses=[];startTime=Date.now();keys.forEach(k=>k.classList.remove("correct","wrong"));status.textContent="";status.className="status";answer.textContent="";nextBtn.disabled=true;updateProgress();if(autoPlay)playChallenge()}
  function playChallenge(){if(!challenge)return;ensureAudio();challenge.midis.forEach(m=>playMidi(m,0,false))}
  function updateProgress(){progress.textContent=`${found.size} di ${challenge?challenge.pcs.length:0} note riconosciute`}
  function saveCompleted(){const targetCount=challenge.pcs.length,attempts=targetCount+wrongPresses.length,accuracy=attempts?targetCount/attempts*100:100;addHistory({id:Date.now()+"-"+Math.random().toString(36).slice(2,7),ts:Date.now(),mode:appMode,detail:challenge.detail,timbre:timbre.value,targets:challenge.pcs.slice(),wrong:wrongPresses.slice(),errors:wrongPresses.length,attempts,accuracy,durationMs:Math.max(0,Date.now()-startTime)})}
  function checkDone(){if(challenge.pcs.every(pc=>found.has(pc))){status.textContent="Corretto";status.className="status ok";nextBtn.disabled=false;answer.textContent=challenge.pcs.map(pc=>NAMES[pc]).join(" · ");saveCompleted()}}
  keys.forEach(k=>k.addEventListener("click",()=>{const pc=Number(k.dataset.pc);playPc(pc);if(!challenge||!nextBtn.disabled)return;if(challenge.pcs.includes(pc)){if(!found.has(pc))found.add(pc);k.classList.remove("wrong");k.classList.add("correct");status.textContent="Nota corretta";status.className="status ok"}else{wrongPresses.push(pc);k.classList.add("wrong");status.textContent="Nota errata";status.className="status bad"}updateProgress();checkDone()}));
  playBtn.addEventListener("click",playChallenge);nextBtn.addEventListener("click",()=>nextChallenge(true));

  const periodFilter=$("periodFilter"),modeFilter=$("modeFilter"),detailFilter=$("detailFilter");
  [periodFilter,modeFilter,detailFilter].forEach(el=>el.addEventListener("change",()=>{if(el===modeFilter)refreshDetailFilter();renderHistory()}));
  function refreshDetailFilter(){
    const keep=detailFilter.value;
    const opts=modeFilter.value==="chords"?[["all","Tutti i livelli"],["easy","Facile"],["jazz","Jazz"],["advanced","Avanzato"]]:modeFilter.value==="notes"?[["all","Tutte"],["1","1 nota"],["2","2 note"]]:[["all","Tutti i livelli"]];
    detailFilter.innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");if(opts.some(x=>x[0]===keep))detailFilter.value=keep
  }
  function filteredHistory(){const all=loadHistory(),days=periodFilter.value==="all"?null:Number(periodFilter.value),cut=days?Date.now()-days*86400000:0;return all.filter(r=>(!cut||r.ts>=cut)&&(modeFilter.value==="all"||r.mode===modeFilter.value)&&(detailFilter.value==="all"||r.detail===detailFilter.value))}
  function avg(arr,fn){return arr.length?arr.reduce((s,x)=>s+fn(x),0)/arr.length:0}
  function pct(v){return Number.isFinite(v)?Math.round(v)+"%":"—"}
  function sec(ms){return ms<60000?(ms/1000).toFixed(ms<10000?1:0)+"s":Math.floor(ms/60000)+"m "+Math.round(ms%60000/1000)+"s"}
  function renderHistory(){
    refreshDetailFilter();const data=filteredHistory().sort((a,b)=>a.ts-b.ts);$("mExercises").textContent=data.length;$("mAccuracy").textContent=data.length?pct(avg(data,r=>r.accuracy)):"—";$("mErrors").textContent=data.length?avg(data,r=>r.errors).toFixed(1):"—";$("mTime").textContent=data.length?sec(avg(data,r=>r.durationMs)):"—";
    const trend=$("mTrend");if(data.length>=10){const n=Math.min(20,Math.floor(data.length/2)),prev=data.slice(-2*n,-n),recent=data.slice(-n),delta=avg(recent,r=>r.accuracy)-avg(prev,r=>r.accuracy);trend.textContent=(delta>0?"+":"")+delta.toFixed(1)+" punti vs prima";trend.className="trend "+(delta>1?"up":delta<-1?"down":"neutral")}else{trend.textContent=data.length?"Servono almeno 10 esercizi":"";trend.className="trend neutral"}
    drawTrend($("trendCanvas"),data);drawErrors($("errorsCanvas"),data);
    const rows=[...data].reverse().slice(0,12);$("recentRows").innerHTML=rows.length?rows.map(r=>{const d=new Date(r.ts),when=d.toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}),md=r.mode==="chords"?"Accordi · "+({easy:"Facile",jazz:"Jazz",advanced:"Avanzato"}[r.detail]||r.detail):"Note · "+r.detail;return `<div class="recent-row"><div>${when}</div><div>${md}</div><div>${pct(r.accuracy)}</div><div>${r.errors}</div></div>`}).join(""):'<div class="empty">Nessun esercizio nei filtri selezionati.</div>'
  }
  function setupCanvas(canvas){const rect=canvas.getBoundingClientRect(),dpr=Math.max(1,window.devicePixelRatio||1),w=Math.max(250,Math.round(rect.width)),h=Math.max(100,Math.round(rect.height));canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);return{c,w,h}}
  function drawTrend(canvas,data){
    const{c,w,h}=setupCanvas(canvas);c.clearRect(0,0,w,h);c.strokeStyle="#34404f";c.lineWidth=1;
    [0,25,50,75,100].forEach(v=>{const y=8+(100-v)/100*(h-22);c.beginPath();c.moveTo(28,y);c.lineTo(w-6,y);c.stroke()});
    c.fillStyle="#94a3b8";c.font="9px system-ui";c.textAlign="right";[0,50,100].forEach(v=>{const y=8+(100-v)/100*(h-22)+3;c.fillText(v+"%",25,y)});
    if(!data.length){c.textAlign="center";c.fillText("Nessun dato",w/2,h/2);return}
    const maxPoints=24,group=Math.max(1,Math.ceil(data.length/maxPoints)),pts=[];for(let i=0;i<data.length;i+=group){const chunk=data.slice(i,i+group);pts.push(avg(chunk,r=>r.accuracy))}
    c.strokeStyle="#75c8ff";c.lineWidth=2;c.beginPath();pts.forEach((v,i)=>{const x=30+(pts.length===1?.5:i/(pts.length-1))*(w-38),y=8+(100-v)/100*(h-22);if(i===0)c.moveTo(x,y);else c.lineTo(x,y)});c.stroke();
    c.fillStyle="#75c8ff";pts.forEach((v,i)=>{const x=30+(pts.length===1?.5:i/(pts.length-1))*(w-38),y=8+(100-v)/100*(h-22);c.beginPath();c.arc(x,y,2.5,0,Math.PI*2);c.fill()})
  }
  function drawErrors(canvas,data){
    const{c,w,h}=setupCanvas(canvas);c.clearRect(0,0,w,h);const counts=Array(12).fill(0);data.forEach(r=>(r.wrong||[]).forEach(pc=>counts[pc]++));const ranked=counts.map((v,i)=>({i,v})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,6);
    if(!ranked.length){c.fillStyle="#94a3b8";c.font="10px system-ui";c.textAlign="center";c.fillText("Nessun errore registrato",w/2,h/2);return}
    const max=ranked[0].v||1,rowH=(h-8)/ranked.length;c.font="9px system-ui";ranked.forEach((x,idx)=>{const y=4+idx*rowH,bw=(w-72)*(x.v/max);c.fillStyle="#94a3b8";c.textAlign="right";c.fillText(NAMES[x.i],50,y+rowH*.62);c.fillStyle="#253342";c.fillRect(57,y+rowH*.18,w-67,rowH*.52);c.fillStyle="#ef6464";c.fillRect(57,y+rowH*.18,bw,rowH*.52);c.fillStyle="#f5f7fb";c.textAlign="left";c.fillText(String(x.v),62+Math.min(bw,w-78),y+rowH*.62)})
  }
  window.addEventListener("resize",()=>{if(screens.history.classList.contains("active"))renderHistory()});
  $("clearHistory").addEventListener("click",()=>{if(confirm("Vuoi cancellare tutto lo storico? Questa operazione non si può annullare.")){localStorage.removeItem(STORAGE_KEY);renderHistory()}});

  if("serviceWorker" in navigator&&location.protocol!=="file:"){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  let deferredInstallPrompt=null;
  const isStandalone=()=>window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone===true;

  if(!isStandalone()){
    installBtn.hidden=false;
    installBtn.textContent="Installa";
  }

  window.addEventListener("beforeinstallprompt",e=>{
    e.preventDefault();
    deferredInstallPrompt=e;
    if(!isStandalone()){
      installBtn.hidden=false;
      installBtn.textContent="Installa";
    }
  });

  installBtn.addEventListener("click",async()=>{
    if(isStandalone()){
      installBtn.hidden=true;
      return;
    }
    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();
      try{
        const choice=await deferredInstallPrompt.userChoice;
        if(choice?.outcome==="accepted") installBtn.hidden=true;
      }catch(_){}
      deferredInstallPrompt=null;
      return;
    }
    alert("Chrome non ha ancora reso disponibile l’installazione. Usa l’app per almeno 30 secondi, tocca qualche controllo e poi riprova. In alternativa: menu ⋮ di Chrome → Aggiungi alla schermata Home / Installa app.");
  });

  window.addEventListener("appinstalled",()=>{
    installBtn.hidden=true;
    deferredInstallPrompt=null;
  });

  if(isStandalone()) installBtn.hidden=true;
})();
