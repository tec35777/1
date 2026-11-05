const out=document.querySelector('#status');
function render(s){const counts={};for(const x of s.items)counts[x.status]=(counts[x.status]||0)+1;out.textContent=`保存: ${s.running?'実行中':'停止'} / 自動収集: ${s.collecting?'実行中':'停止'}\n登録 ${s.items.length} / 完了 ${counts.done||0}\n待機 ${counts.pending||0} / 保存中 ${counts.active||0} / 失敗 ${counts.failed||0}\n${s.note||''}\n${s.items.find(x=>x.status==='failed')?.error||''}`;}
async function send(action){const [t]=await chrome.tabs.query({active:true,currentWindow:true});const r=await chrome.runtime.sendMessage({action,tab:t?.id});if(!r.ok)throw Error(r.error);render(r.state);}
for(const b of document.querySelectorAll('button'))b.onclick=()=>send(b.id).catch(e=>out.textContent=e.message);
send('status').catch(e=>out.textContent=e.message);setInterval(()=>send('status').catch(()=>{}),2000);
