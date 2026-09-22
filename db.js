const DB_NAME="chord-ear-trainer";
const DB_VERSION=1;
const STORE="exercises";
const LEGACY_KEY="chord-ear-trainer-history-v1";

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)){
        const s=db.createObjectStore(STORE,{keyPath:"id"});
        s.createIndex("ts","ts");
        s.createIndex("mode","mode");
        s.createIndex("detail","detail");
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

async function withStore(mode,fn){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    const store=tx.objectStore(STORE);
    let result;
    try{ result=fn(store,tx); }catch(err){ reject(err); return; }
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  });
}

export async function migrateLegacy(){
  let legacy=[];
  try{
    const raw=localStorage.getItem(LEGACY_KEY);
    legacy=raw?JSON.parse(raw):[];
  }catch(_){legacy=[]}
  if(!Array.isArray(legacy)||!legacy.length)return 0;

  const existing=await getAllExercises();
  if(existing.length){
    localStorage.removeItem(LEGACY_KEY);
    return 0;
  }

  await withStore("readwrite",store=>{
    legacy.forEach((row,i)=>{
      const normalized={
        ...row,
        id:row.id||`legacy-${row.ts||Date.now()}-${i}`,
        schemaVersion:2,
        exerciseType:row.exerciseType||(row.mode==="chords"?"notes-in-chord":"notes"),
        correctExercise:typeof row.correctExercise==="boolean"?row.correctExercise:(row.errors||0)===0,
        firstAttemptCorrect:typeof row.firstAttemptCorrect==="boolean"?row.firstAttemptCorrect:(row.errors||0)===0,
        replayCount:row.replayCount||0,
        firstResponseMs:row.firstResponseMs??null
      };
      store.put(normalized);
    });
  });
  localStorage.removeItem(LEGACY_KEY);
  return legacy.length;
}

export async function addExercise(row){
  const item={schemaVersion:2,...row};
  await withStore("readwrite",store=>store.put(item));
  return item;
}

export async function getAllExercises(){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly");
    const req=tx.objectStore(STORE).getAll();
    req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>(a.ts||0)-(b.ts||0)));
    req.onerror=()=>reject(req.error);
  });
}

export async function clearExercises(){
  await withStore("readwrite",store=>store.clear());
}

export async function replaceExercises(rows){
  await withStore("readwrite",store=>{
    store.clear();
    (rows||[]).forEach((row,i)=>{
      store.put({
        schemaVersion:2,
        ...row,
        id:row.id||`import-${row.ts||Date.now()}-${i}`
      });
    });
  });
}

export async function exportBackup(){
  const exercises=await getAllExercises();
  return {
    app:"Chord Ear Trainer",
    schemaVersion:2,
    exportedAt:new Date().toISOString(),
    exercises
  };
}

export async function importBackup(data){
  if(!data||!Array.isArray(data.exercises))throw new Error("Backup non valido");
  await replaceExercises(data.exercises);
  return data.exercises.length;
}
