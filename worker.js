importScripts('collector.js');
let chain=Promise.resolve();
const serial=fn=>{const r=chain.then(fn);chain=r.catch(console.error);return r;};
const read=async()=> (await chrome.storage.local.get('state')).state||{items:[],running:false,collecting:false,next:0,note:''};
const save=s=>chrome.storage.local.set({state:s});
async function scan(s,scroll){
 const tab=await chrome.tabs.get(s.tab);
 if(!tab.url?.startsWith('https://grok.com/imagine')) throw Error('対象の履歴タブを開いてください');
 const [r]=await chrome.scripting.executeScript({target:{tabId:s.tab},func:collect,args:[scroll]});
 const map=new Map(s.items.map(x=>[x.key,x]));let added=0;
 for(const x of r.result||[]) if(!map.has(x.key)){map.set(x.key,{...x,status:'pending',attempts:0});added++;}
 s.items=[...map.values()];s.note=`今回 ${added}件追加。収集数は全履歴の件数を保証しません。`;
}
async function reconcile(s){
 for(const x of s.items.filter(x=>x.status==='active')){
  const query=Number.isInteger(x.id)?{id:x.id}:{url:x.url,startedAfter:new Date((x.startedAt||Date.now())-1000).toISOString(),orderBy:['-startTime'],limit:1};
  const ds=await chrome.downloads.search(query);const d=ds[0];
  if(d) x.id=d.id;
  if(d?.state==='in_progress') continue;
  if(d?.state==='complete'){x.status='done';x.error='';}
  else {x.status=x.attempts>=3?'failed':'pending';x.error=d?.error||'ダウンロードが見つかりません';}
  s.next=Date.now()+5000*Math.pow(2,Math.max(0,x.attempts-1));
 }
}
async function tick(){
 const s=await read();await reconcile(s);
 if(s.collecting && Date.now()>=(s.scanAt||0)){
  try{await scan(s,true);}catch(e){s.collecting=false;s.note=e.message;}
  s.scanAt=Date.now()+10000;
 }
 if(s.running&&!s.items.some(x=>x.status==='active')&&Date.now()>=s.next){
  const x=s.items.find(x=>x.status==='pending');
  if(x){
   x.attempts++;x.status='active';x.startedAt=Date.now();delete x.id;await save(s);
   await chrome.alarms.create('tick',{when:Date.now()+30000});
   try{
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x.key));
    const name=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const ext=new URL(x.url).pathname.match(/\.(png|jpe?g|webp|gif|mp4|webm)$/i)?.[1]||'bin';
    x.id=await chrome.downloads.download({url:x.url,filename:`GrokImagine/${name}.${ext}`,conflictAction:'uniquify',saveAs:false});
   }catch(e){x.status=x.attempts>=3?'failed':'pending';x.error=e.message;s.next=Date.now()+30000;}
  }else if(!s.collecting){s.running=false;s.note='処理待ちはありません。失敗件数を確認してください。';}
 }
 await save(s);
 const future=[s.next,s.scanAt].filter(x=>x>Date.now());
 if(s.running||s.collecting||s.items.some(x=>x.status==='active')) await chrome.alarms.create('tick',{when:Math.max(Date.now()+5000,Math.min(Date.now()+30000,...future))});
}
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='tick')serial(tick);});
chrome.downloads.onChanged.addListener(d=>{if(d.state)serial(tick);});
chrome.runtime.onStartup.addListener(()=>serial(async()=>{const s=await read();s.running=false;s.collecting=false;await reconcile(s);await save(s);await tick();}));
chrome.runtime.onInstalled.addListener(()=>serial(async()=>{const s=await read();s.running=false;s.collecting=false;await reconcile(s);await save(s);await tick();}));
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 serial(async()=>{
  const s=await read();
  if(m.action==='status') return s;
  if(m.action==='scan'||m.action==='collect'){
   s.tab=m.tab;await scan(s,false);s.collecting=m.action==='collect';s.scanAt=0;
  }
  if(m.action==='start') s.running=true;
  if(m.action==='stop'){s.running=false;s.collecting=false;s.note='停止しました。進行中の1件は完了まで待ちます。';}
  if(m.action==='retry')for(const x of s.items)if(x.status==='failed'){x.status='pending';x.attempts=0;}
  await save(s);await tick();return await read();
 }).then(s=>reply({ok:true,state:s}),e=>reply({ok:false,error:e.message}));return true;
});
