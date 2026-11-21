(() => {
"use strict";
const CLOUD_KEYS=[];
const $=id=>document.getElementById(id),SONGS=document.body.dataset.mode==="songs",FAVS=SONGS?"kidlearn-song-favorites-v1":"kidlearn-podcast-favorites-v1",PROGRESS=SONGS?"kidlearn-song-progress-v1":"kidlearn-podcast-progress-v1",SUBS="kidlearn-podcast-subs-v1";
CLOUD_KEYS.push(FAVS,SUBS,PROGRESS,"kidlearn-song-library-v1");
const state={shows:[],songs:[],episodes:[],showOpen:null,searched:false,filter:"all",current:null,connection:false},audio=$("audio");
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}
 try{if(window.KidLearn&&KidLearn.backupKey&&KidLearn.currentUser&&KidLearn.currentUser()&&CLOUD_KEYS.includes(key))KidLearn.backupKey(key)}catch{}}
const LIB="kidlearn-song-library-v1";
function library(){const items=read(LIB,[]);return Array.isArray(items)?items:[]}
// הרשימה האמיתית נשמרת באפליקציה (שורדת עדכונים). כאן רק עותק מהיר להצגה מיידית.
async function loadLibrary(){if(!SONGS||!window.KidLearnBridge)return;try{const r=await KidLearnBridge.request("mediaList",{},{timeoutMs:10000});if(r.ok&&r.data&&Array.isArray(r.data.items)){const songs=r.data.items.filter(x=>x&&x.kind==="song");localStorage.setItem(LIB,JSON.stringify(songs));render()}}catch{}}
// מועדפים יורדים למחשב לבד, אחד אחרי השני, כדי שיתחילו מיד
let prefetching=false;
async function prefetchFavorites(){
 if(prefetching||!window.KidLearnBridge)return;prefetching=true;
 try{
  const have=new Set();try{const l=await KidLearnBridge.request("mediaList",{},{timeoutMs:10000});if(l.ok&&l.data&&Array.isArray(l.data.items))l.data.items.forEach(x=>have.add(x.id))}catch{}
  for(const item of favorites()){
   if(have.has(item.id))continue;
   const payload={itemId:item.id,meta:{kind:item.kind,source:item.source,title:item.title,show:item.show,image:item.image,durationSeconds:item.durationSeconds}};
   if(item.source==="youtube")payload.pageUrl=item.pageUrl;else payload.url=item.audioUrl;
   let r=await KidLearnBridge.request("mediaPrepare",payload,{timeoutMs:20000});
   for(let i=0;r.ok&&r.data&&!r.data.done&&!r.data.error&&i<1500;i++){await sleep(1200);r=await KidLearnBridge.request("mediaStatus",{itemId:item.id},{timeoutMs:10000});if(!r.ok)break}
  }
  loadLibrary();
 }catch{}
 prefetching=false;
}
function inLibrary(id){return library().some(x=>x.id===id)}
function addToLibrary(item){if(!SONGS||!item||!item.id)return;setTimeout(loadLibrary,800);if(inLibrary(item.id))return;const l=library();l.unshift({id:item.id,kind:item.kind||"song",source:item.source,title:item.title,show:item.show,image:item.image,audioUrl:item.audioUrl,pageUrl:item.pageUrl,durationSeconds:item.durationSeconds});write(LIB,l.slice(0,300))}
function localMatches(query){const words=query.toLowerCase().split(/s+/).filter(Boolean);return library().filter(x=>{const t=((x.title||"")+" "+(x.show||"")).toLowerCase();return words.every(w=>t.includes(w))})}
function favorites(){const items=read(FAVS,[]);return Array.isArray(items)?items:[]}function progress(){const saved=read(PROGRESS,{});return saved&&typeof saved==="object"&&!Array.isArray(saved)?saved:{}}
function status(message){$("status").textContent=message}
function subs(){const items=read(SUBS,[]);return Array.isArray(items)?items.filter(x=>x&&typeof x.feedUrl==="string"):[]}
function findSub(feedUrl){return subs().find(x=>x.feedUrl===feedUrl)}
function saveSubs(list){
 write(SUBS,list.slice(0,30));
 try{if(window.KidLearn&&KidLearn.backupKey)KidLearn.backupKey(SUBS)}catch{}
 syncWatch();
}
// שולח לאפליקציה את הפודקאסטים שסימנו בפעמון. היא בודקת אותם ברקע גם כשהאתר סגור.
let loggedIn=null;
async function syncWatch(){
 if(SONGS||!window.KidLearnBridge||loggedIn===null)return;
 try{
  const shows=(loggedIn?subs():[]).filter(x=>x.bell).map(x=>({feedUrl:x.feedUrl,title:x.title}));
  const r=await KidLearnBridge.request("podcastWatchSet",{shows},{timeoutMs:20000});
  state.watching=!!r.ok;
 }catch{}
}
function toggleSub(show){
 const list=subs(),i=list.findIndex(x=>x.feedUrl===show.feedUrl);
 if(i>=0){list.splice(i,1);status("הפודקאסט הוסר מהרשימה שלי.")}
 else{list.unshift({feedUrl:show.feedUrl,title:show.title,artist:show.artist||"",image:show.image||"",bell:false});status("הפודקאסט נוסף לפודקאסטים שלי. לחצו על 🔔 כדי לקבל התראה על פרק חדש.")}
 saveSubs(list);render();
}
function toggleBell(show){
 const list=subs(),item=list.find(x=>x.feedUrl===show.feedUrl);if(!item)return;
 item.bell=!item.bell;
 status(item.bell?(loggedIn?"הפעמון פעיל: תקבלו התראה כשיוצא פרק חדש, גם כשהאתר סגור. תוכנת Kidlearn צריכה להיות פתוחה.":"הפעמון נשמר, אבל התראות מגיעות רק למי שמחובר ל-Kidlearn. התחברו כדי לקבל אותן."):"הפעמון כבוי.");
 saveSubs(list);render();
}
function subButtons(show,into){
 const sub=findSub(show.feedUrl);
 const add=document.createElement("button");add.type="button";add.className="chip-btn"+(sub?" on":"");add.textContent=sub?"✓ בפודקאסטים שלי":"＋ הוספה לפודקאסטים שלי";add.addEventListener("click",()=>toggleSub(show));into.appendChild(add);
 if(sub){const bell=document.createElement("button");bell.type="button";bell.className="bell"+(sub.bell?" on":"");bell.textContent=sub.bell?"🔔":"🔕";bell.title=sub.bell?"כיבוי התראות":"התראה על פרק חדש";bell.setAttribute("aria-pressed",String(!!sub.bell));bell.addEventListener("click",()=>toggleBell(show));into.appendChild(bell)}
}
function connection(kind,message){$("connectionDot").className="dot "+kind;$("connectionText").textContent=message}
async function checkConnection(){
 if(!window.KidLearnBridge){connection("bad","חסר רכיב החיבור של Kidlearn. יש לעדכן את האתר.");return}
 const installed=await KidLearnBridge.isInstalled();
 if(!installed){connection("bad","כדי לחפש ולהאזין צריך את תוסף Chrome ותוכנת Kidlearn במחשב.");return}
 const ping=await KidLearnBridge.request("ping");state.connection=!!ping.ok;
 connection(ping.ok?"ok":"bad",ping.ok?"מחובר לתוכנת Kidlearn במחשב":"התוסף מותקן, אבל תוכנת Kidlearn לא פועלת כרגע.");
}
function safeImage(url){try{const u=new URL(url);return u.protocol==="https:"?u.href:""}catch{return ""}}
function duration(seconds){if(!Number.isFinite(seconds)||seconds<=0)return "";const m=Math.floor(seconds/60),h=Math.floor(m/60);return h?(h+":"+String(m%60).padStart(2,"0")+" שעות"):(m+" דקות")}
function queue(){if(!state.searched&&!state.showOpen)return favorites();return SONGS?state.songs:(state.showOpen?state.episodes:[])}
function episodeCard(item){
 const card=document.createElement("article");card.className="episode"+(item.kind==="song"?" song":"")+(state.current&&state.current.id===item.id?" active":"");
 const src=safeImage(item.image);if(src){const img=document.createElement("img");img.className="cover";img.loading="lazy";img.alt="";img.src=src;card.appendChild(img)}else{const fallback=document.createElement("div");fallback.className="cover cover-fallback";fallback.textContent=item.kind==="song"?"🎵":"🎧";card.appendChild(fallback)}
 const info=document.createElement("div");info.className="episode-info";
 const title=document.createElement("div");title.className="episode-title";title.textContent=item.title||"פרק ללא כותרת";
 const show=document.createElement("div");show.className="episode-show";show.textContent=item.show||"";
 const meta=document.createElement("div");meta.className="episode-meta";meta.textContent=[item.number?"פרק "+item.number:"",duration(item.durationSeconds),item.publishedAt?new Date(item.publishedAt).toLocaleDateString("he-IL"):""].filter(Boolean).join(" · ");
 const source=document.createElement("span");source.className="source"+(item.source==="youtube"?" youtube":"");source.textContent=item.kind==="song"?(inLibrary(item.id)?"⬇️ שמור במחשב":"שיר"):"פרק";info.append(title,show,meta,source);
 const actions=document.createElement("div");actions.className="episode-actions";
 const play=document.createElement("button");play.className="play-small";play.type="button";play.textContent=state.current&&state.current.id===item.id&&!audio.paused?"Ⅱ":"▶";play.title="ניגון";play.addEventListener("click",()=>playEpisode(item));
 const fav=document.createElement("button"),isFav=favorites().some(x=>x.id===item.id);fav.className="fav"+(isFav?" on":"");fav.type="button";fav.textContent=isFav?"♥":"♡";fav.title="הוספה למועדפים";fav.addEventListener("click",()=>toggleFavorite(item));
 actions.append(play,fav);card.append(info,actions);return card;
}
function showCard(show){
 const card=document.createElement("article");card.className="episode show";
 const src=safeImage(show.image);if(src){const img=document.createElement("img");img.className="cover";img.loading="lazy";img.alt="";img.src=src;card.appendChild(img)}else{const f=document.createElement("div");f.className="cover cover-fallback";f.textContent="🎙️";card.appendChild(f)}
 const info=document.createElement("div");info.className="episode-info";
 const title=document.createElement("div");title.className="episode-title";title.textContent=show.title||"פודקאסט";
 const by=document.createElement("div");by.className="episode-show";by.textContent=show.artist||"";
 const tag=document.createElement("span");tag.className="source";tag.textContent="פודקאסט";info.append(title,by,tag);
 const actions=document.createElement("div");actions.className="show-actions";
 const open=document.createElement("button");open.className="open-show";open.type="button";open.textContent="לפרקים ◀";open.addEventListener("click",()=>openShow(show));
 actions.appendChild(open);subButtons(show,actions);
 card.append(info,actions);return card;
}
function renderEpisodes(list){
 const hasSeasons=state.episodes.some(e=>e.season);let last="";
 state.episodes.forEach(e=>{
  if(hasSeasons){const label=e.season?"עונה "+e.season:"פרקים נוספים";if(label!==last){list.appendChild(sectionTitle(label));last=label}}
  list.appendChild(episodeCard(e));
 });
}
function sectionTitle(text){const h=document.createElement("div");h.className="section-title";h.textContent=text;return h}
function emptyMessage(text){const e=document.createElement("div");e.className="empty";e.textContent=text;return e}
function render(){
 const list=$("results");list.replaceChildren();let total=0;
 const pt=$("panelTitle");if(pt)pt.textContent=(!state.searched&&!state.showOpen)?"❤️ המועדפים שלי":(SONGS?"🎵 השירים שמצאנו":"🎙️ הפודקאסטים שמצאנו");
 if(state.showOpen){
  const back=document.createElement("button");back.className="back-list";back.type="button";back.textContent="← חזרה";back.addEventListener("click",()=>{state.showOpen=null;state.episodes=[];render()});
  const bar=document.createElement("div");bar.className="show-toolbar";subButtons(state.showOpen,bar);
  list.append(back,sectionTitle(state.showOpen.title),bar);total=state.episodes.length;
  if(!state.episodes.length)list.appendChild(emptyMessage("לא מצאנו פרקים מתאימים בפודקאסט הזה."));else renderEpisodes(list);
 }else if(state.searched){
  const back=document.createElement("button");back.className="back-list";back.type="button";back.textContent="← חזרה למועדפים";back.addEventListener("click",()=>{state.searched=false;state.shows=[];state.songs=[];$("query").value="";status("");render()});
  list.appendChild(back);
  if(SONGS){total=state.songs.length;if(!state.songs.length)list.appendChild(emptyMessage("לא נמצאו שירים מתאימים. נסו מילים אחרות."));else state.songs.forEach(x=>list.appendChild(episodeCard(x)))}
  else{total=state.shows.length;if(!state.shows.length)list.appendChild(emptyMessage("לא נמצאו פודקאסטים. נסו נושא אחר."));else state.shows.forEach(x=>list.appendChild(showCard(x)))}
 }else{
  const favs=favorites();
  if(!SONGS){
   const mine=subs();list.appendChild(sectionTitle("🎙️ הפודקאסטים שלי"));
   if(!mine.length)list.appendChild(emptyMessage("עדיין לא הוספתם פודקאסטים. חפשו פודקאסט ולחצו על \"הוספה לפודקאסטים שלי\"."));else mine.forEach(x=>list.appendChild(showCard(x)));
  }
  list.appendChild(sectionTitle("❤️ המועדפים שלי"));
  if(!favs.length)list.appendChild(emptyMessage(SONGS?"עדיין לא שמרתם שירים מועדפים. כתבו שם של שיר ולחצו על חיפוש.":"עדיין לא שמרתם מועדפים."));else favs.forEach(i=>list.appendChild(episodeCard(i)));
  total=(SONGS?0:subs().length)+favs.length;
 }
 $("resultCount").textContent=total?String(total):"";
 renderFavorites();
}
async function openShow(show){
 const wasMine=state.filter==="mine";
 status("טוענים את הפרקים של "+show.title+"...");
 const r=await KidLearnBridge.request("podcastEpisodes",{feedUrl:show.feedUrl,title:show.title},{timeoutMs:30000});
 if(!r.ok){status(r.error==="app_not_running"?"תוכנת Kidlearn לא פועלת. הפעילו אותה ונסו שוב.":"לא הצלחנו לטעון את הפרקים. נסו שוב.");return}
 state.episodes=Array.isArray(r.data.episodes)?r.data.episodes:[];state.showOpen=show;
 status(state.episodes.length?"נמצאו "+state.episodes.length+" פרקים.":"לא נמצאו פרקים מתאימים.");render();window.scrollTo({top:0,behavior:"smooth"});
}
function renderFavorites(){
 const list=$("favoriteList");if(!list)return;list.replaceChildren();const items=favorites();
 if(!items.length){const empty=document.createElement("div");empty.className="count";empty.textContent="עדיין לא שמרתם מועדפים";list.appendChild(empty);return}
 items.forEach(item=>{const b=document.createElement("button");b.className="favorite-item";b.type="button";b.textContent="♥ "+item.title;b.addEventListener("click",()=>playEpisode(item));list.appendChild(b)});
}
function toggleFavorite(item){
 const items=favorites(),i=items.findIndex(x=>x.id===item.id);
 if(i>=0)items.splice(i,1);else items.unshift({id:item.id,kind:item.kind,source:item.source,title:item.title,show:item.show,image:item.image,audioUrl:item.audioUrl,pageUrl:item.pageUrl,durationSeconds:item.durationSeconds});
 write(FAVS,items.slice(0,100));render();if(i<0)prefetchFavorites();
}
let lastSavedAt=0;
function saveProgress(force){if(!state.current||!Number.isFinite(audio.currentTime))return;const second=Math.floor(audio.currentTime);if(!force&&second-lastSavedAt<5)return;lastSavedAt=second;const p=progress();p[state.current.id]=second;write(PROGRESS,p)}
function dlShow(label,pct){const box=$("dl");if(!box)return;box.hidden=false;box.classList.toggle("indeterminate",pct==null);$("dlLabel").textContent=label;$("dlPct").textContent=pct==null?"":Math.round(pct)+"%";$("dlFill").style.width=pct==null?"":Math.max(2,Math.min(100,pct))+"%"}
function dlHide(){const box=$("dl");if(box)box.hidden=true}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let playToken=0;
// מוריד (או מוצא שמור) את השיר/הפרק דרך האפליקציה, עם פס התקדמות. מחזיר כתובת מקומית, או null אם אי אפשר.
async function fetchLocal(item,token){
 const payload={itemId:item.id,meta:{kind:item.kind,source:item.source,title:item.title,show:item.show,image:item.image,durationSeconds:item.durationSeconds}};if(item.source==="youtube")payload.pageUrl=item.pageUrl;else payload.url=item.audioUrl;
 let r=await KidLearnBridge.request("mediaPrepare",payload,{timeoutMs:20000});
 if(!r.ok||!r.data)return r.error==="not_child_appropriate"?{blocked:true}:null;
 const t0=Date.now();
 while(token===playToken){
  const d=r.data;
  if(d.error)return d.error==="not_child_appropriate"?{blocked:true}:null;
  if(d.done&&d.url)return{url:d.url};
  let pct=d.total>0?d.bytes/d.total*100:null;
  if(pct==null&&d.bytes>0&&item.durationSeconds>0)pct=Math.min(95,d.bytes/(item.durationSeconds*16000)*100);
  dlShow(d.bytes>0?"מוריד "+(d.bytes/1048576).toFixed(1)+(d.total>0?" / "+(d.total/1048576).toFixed(1):"")+" MB":"מתחילים להוריד...",pct);
  if(Date.now()-t0>30*60*1000)return null;
  await sleep(400);
  r=await KidLearnBridge.request("mediaStatus",{itemId:item.id},{timeoutMs:10000});
  if(!r.ok||!r.data)return null;
 }
 return{cancelled:true};
}
async function playEpisode(item){
 saveProgress();audio.pause();state.current=item;lastSavedAt=0;$("nowTitle").textContent=item.title||"פרק";$("nowShow").textContent=item.show||"";
 const cover=safeImage(item.image);if(cover)$("nowCover").src=cover;status("מכינים את ההשמעה...");render();
 const token=++playToken;dlShow("מתחילים להוריד...",null);
 let src=null;
 try{
  const local=await fetchLocal(item,token);
  if(token!==playToken||(local&&local.cancelled))return;
  if(local&&local.blocked){dlHide();status(SONGS?"השיר הזה אינו מתאים להגדרות הגיל של הנגן.":"הפרק הזה אינו מתאים להגדרות הגיל של הנגן.");return}
  if(local&&local.url)src=local.url;
 }catch{}
 dlHide();
 let url=item.audioUrl;
 if(!src&&item.source==="youtube"){
  const result=await KidLearnBridge.request("podcastResolve",{url:item.pageUrl},{timeoutMs:65000});
  if(token!==playToken)return;
  if(!result.ok||!result.data||!result.data.url){status(result.error==="not_child_appropriate"?SONGS?"השיר הזה אינו מתאים להגדרות הגיל של הנגן.":"הפרק הזה אינו מתאים להגדרות הגיל של הנגן.":SONGS?"לא הצלחנו לפתוח את השיר. נסו שיר אחר.":"לא הצלחנו לפתוח את השמע של הפרק. נסו פרק אחר.");return}
  url=result.data.url;
 }
 const start=progress()[item.id]||0;
 async function attempt(href){
  audio.pause();audio.src=href;audio.load();
  if(start>0)audio.addEventListener("loadedmetadata",()=>{if(Number.isFinite(audio.duration)&&start<audio.duration-10)audio.currentTime=start},{once:true});
  await audio.play();
 }
 try{
  if(src){
   try{await attempt(src);addToLibrary(item);status(SONGS?"השיר מתנגן עכשיו 🎵":"הפרק מתנגן עכשיו 🎵");render();return}
   catch{status("ההשמעה מהקובץ השמור לא הצליחה, מנסים הזרמה ישירה...")}
   if(item.source==="youtube"){const result=await KidLearnBridge.request("podcastResolve",{url:item.pageUrl},{timeoutMs:65000});if(result.ok&&result.data&&result.data.url)url=result.data.url}
  }
  const parsed=new URL(url);if(parsed.protocol!=="https:")throw new Error("Secure stream required");
  await attempt(parsed.href);status(SONGS?"השיר מתנגן עכשיו 🎵":"הפרק מתנגן עכשיו 🎵");render();
 }catch{status("הדפדפן לא הצליח להפעיל את זרם השמע של הפרק הזה.")}
}
$("searchForm").addEventListener("submit",async event=>{
 event.preventDefault();const query=$("query").value.trim();if(query.length<2){status("כתבו לפחות שתי אותיות לחיפוש.");return}
 $("searchButton").disabled=true;$("searchButton").textContent="מחפש...";status(SONGS?"מחפשים שירים...":"מחפשים פודקאסטים...");
 let local=[];
 if(SONGS){local=localMatches(query);if(local.length){state.songs=local;state.showOpen=null;state.episodes=[];state.searched=true;render();status("מצאנו "+local.length+" שירים שכבר שמורים, ומחפשים עוד ביוטיוב...")}}
 try{
  const r=await KidLearnBridge.request(SONGS?"songSearch":"podcastSearch",{query},{timeoutMs:70000});
  if(!r.ok){if(local.length){status("מוצגים רק שירים שכבר שמורים. החיפוש ביוטיוב לא הצליח.");return}status(r.error==="app_not_running"?"תוכנת Kidlearn לא פועלת. הפעילו אותה ונסו שוב.":"החיפוש לא הצליח. בדקו את החיבור ונסו שוב.");return}
  state.shows=!SONGS&&Array.isArray(r.data.shows)?r.data.shows:[];state.songs=SONGS&&Array.isArray(r.data.songs)?r.data.songs:[];
  if(SONGS){const ids=new Set(local.map(x=>x.id));state.songs=local.concat(state.songs.filter(x=>!ids.has(x.id)))}
  state.showOpen=null;state.episodes=[];state.searched=true;render();
  const n=SONGS?state.songs.length:state.shows.length;
  status(n?(SONGS?"נמצאו "+n+" שירים.":"נמצאו "+n+" פודקאסטים. לחצו על \"לפרקים\" כדי לראות את הפרקים."):"לא נמצאו תוצאות. נסו נושא אחר.");
 }catch{status("החיפוש לא הצליח. בדקו שתוכנת Kidlearn פועלת.")}
 finally{$("searchButton").disabled=false;$("searchButton").textContent="חיפוש"}
});
audio.addEventListener("play",()=>$("playerPanel").classList.add("playing"));audio.addEventListener("pause",()=>$("playerPanel").classList.remove("playing"));audio.addEventListener("ended",()=>$("playerPanel").classList.remove("playing"));audio.addEventListener("timeupdate",saveProgress);audio.addEventListener("pause",()=>saveProgress(true));
audio.addEventListener("ended",()=>{saveProgress();const q=queue(),i=q.findIndex(x=>state.current&&x.id===state.current.id)+1;if(i>0&&i<q.length)playEpisode(q[i]);else status(SONGS?"השיר נגמר! רוצים עוד אחד? 🌟":"סיימתם להאזין לפרק! כל הכבוד 🌟")});
checkConnection().then(()=>{syncWatch();loadLibrary();prefetchFavorites()});
if(window.KidLearn){
 try{
  KidLearn.init();
  KidLearn.onAuthChange(async profile=>{loggedIn=!!profile;if(!profile){syncWatch();return}try{if(await KidLearn.syncKeys(SONGS?[FAVS,PROGRESS,"kidlearn-song-library-v1"]:[SUBS,FAVS,PROGRESS]))render()}catch{}syncWatch()});
 }catch{}
}
})();
