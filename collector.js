async function collect(scroll) {
  if(location.hostname !== 'grok.com' || !location.pathname.startsWith('/imagine')) throw Error('Grok Imagineの履歴画面で操作してください');
  const rows=[];
  for(const el of document.querySelectorAll('img,video,video source')) {
    const url=el.currentSrc||el.src;
    if(!url || !/^https:\/\//.test(url)) continue;
    const u=new URL(url);
    if(!(u.hostname==='assets.grok.com'||u.hostname.endsWith('.grok.com')||u.hostname==='grok.com')) continue;
    if(/avatar|profile|icon|logo/i.test(u.pathname)) continue;
    if(el.tagName==='IMG' && Math.max(el.naturalWidth,el.width)<200) continue;
    if(!/\.(png|jpe?g|webp|gif|mp4|webm)(?:$|\?)/i.test(url)) continue;
    // Query parameters may select different renditions: preserve them for deduplication.
    u.hash='';
    rows.push({key:u.href,url:u.href,kind:/\.(mp4|webm)(?:$|\?)/i.test(url)?'video':'image'});
  }
  if(scroll) {
    const candidates=[document.scrollingElement,...document.querySelectorAll('main,section,div')].filter(e=>e&&e.scrollHeight>e.clientHeight+100&&e.clientHeight>200);
    const target=candidates.sort((a,b)=>(b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight))[0];
    if(target) target.scrollBy(0,Math.max(200,target.clientHeight*0.75));
  }
  return rows;
}
