const favbarEl = document.getElementById('favbar');
const slotEl = document.getElementById('camSlot');
const creditEl = document.getElementById('camCredit');
const emojiEl = document.getElementById('camEmoji');
const labelEl = document.getElementById('camLabel');
const starBtn = document.getElementById('starBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const emptyState = document.getElementById('emptyState');
const emptyMessage = document.getElementById('emptyMessage');
const emptyIcon = document.getElementById('emptyIcon');
const stageTools = document.getElementById('stageTools');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const fullscreenNextBtn = document.getElementById('fullscreenNextBtn');
const switchOverlay = document.getElementById('switchOverlay');
const switchFlag = document.getElementById('switchFlag');
const switchCountry = document.getElementById('switchCountry');
const cams = [];
const favorites = new Set();
const history = [];
let favoriteKey = '';
let current = 0;
let switchOverlayTimer;
let switchOverlayHideTimer;
let resolveYoutubeApi;
const youtubeApiReady = new Promise(resolve => { resolveYoutubeApi = resolve; });
let youtubePlayer = null;
let playerGeneration = 0;
let playerReady = false;
let pendingPlaybackToggle = false;

window.addEventListener('blur', () => {
  if(document.visibilityState !== 'visible') return;
  if(document.activeElement instanceof HTMLIFrameElement && document.activeElement.closest('#camSlot')){
    setTimeout(() => document.body.focus({ preventScroll: true }), 0);
  }
});
if(window.YT && window.YT.Player) resolveYoutubeApi(window.YT);
else {
  const previousYoutubeReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if(typeof previousYoutubeReady === 'function') previousYoutubeReady();
    resolveYoutubeApi(window.YT);
  };
}

function camId(cam){ return cam.src; }

function saveFavorites(){
  localStorage.setItem(favoriteKey, [...favorites].join(','));
  if(window.KidLearn && KidLearn.currentUser()) KidLearn.pushLocalStorageKey(favoriteKey);
}

function loadFavorites(){
  favorites.clear();
  const validIds = new Set(cams.map(camId));
  (localStorage.getItem(favoriteKey) || '')
    .split(',')
    .map(value => value.trim())
    .filter(id => validIds.has(id))
    .forEach(id => favorites.add(id));
}

function showCam(index){
  current = index;
  if(cams.length === 0){
    emptyState.hidden = false;
    starBtn.disabled = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    stageTools.hidden = true;
    renderFavbar();
    return;
  }

  const cam = cams[index];
  emptyState.hidden = true;
  playerGeneration++;
  if(youtubePlayer){
    youtubePlayer.destroy();
    youtubePlayer = null;
  }
  playerReady = false;
  pendingPlaybackToggle = false;
  playPauseBtn.textContent = '⏳ טוען נגן';
  slotEl.querySelector('iframe')?.remove();
  const iframe = document.createElement('iframe');
  const embedUrl = new URL(cam.src);
  embedUrl.searchParams.set('fs', '0');
  embedUrl.searchParams.set('enablejsapi', '1');
  if(window.location.protocol === 'http:' || window.location.protocol === 'https:'){
    embedUrl.searchParams.set('origin', window.location.origin);
  }
  iframe.src = embedUrl.toString();
  iframe.title = cam.title;
  iframe.loading = 'lazy';
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  slotEl.appendChild(iframe);
  const generation = playerGeneration;
  youtubeApiReady.then(YT => {
    if(!iframe.isConnected || generation !== playerGeneration) return;
    youtubePlayer = new YT.Player(iframe, {
      events: {
        onReady: event => {
          if(generation !== playerGeneration) return;
          youtubePlayer = event.target;
          playerReady = true;
          if(pendingPlaybackToggle){
            pendingPlaybackToggle = false;
            toggleVideoPlayback();
          } else {
            updatePlaybackButton(youtubePlayer.getPlayerState());
          }
        },
        onStateChange: event => {
          if(generation !== playerGeneration) return;
          updatePlaybackButton(event.data);
        }
      }
    });
  });
  stageTools.hidden = false;
  creditEl.textContent = cam.credit || '';
  emojiEl.textContent = cam.emoji || '📹';
  labelEl.textContent = cam.label;
  showChannelOverlay(cam);
  starBtn.disabled = false;
  starBtn.classList.toggle('active', favorites.has(camId(cam)));
  prevBtn.disabled = history.length === 0;
  nextBtn.disabled = cams.length <= 1;
  renderFavbar();
}

function renderFavbar(){
  favbarEl.replaceChildren();
  favbarEl.classList.toggle('show', favorites.size > 0);
  cams.forEach((cam, index) => {
    if(!favorites.has(camId(cam))) return;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'favchip' + (index === current ? ' active' : '');
    const emoji = document.createElement('span');
    emoji.textContent = cam.emoji || '📹';
    const label = document.createElement('span');
    label.textContent = cam.label;
    chip.append(emoji, label);
    chip.addEventListener('click', () => goTo(index));
    favbarEl.appendChild(chip);
  });
}

function goTo(index){
  if(index === current) return;
  history.push(current);
  showCam(index);
}

prevBtn.addEventListener('click', () => {
  if(history.length === 0) return;
  showCam(history.pop());
});
nextBtn.addEventListener('click', showRandomCam);
fullscreenNextBtn.addEventListener('click', showRandomCam);
fullscreenBtn.addEventListener('click', toggleFullscreen);
playPauseBtn.addEventListener('click', toggleVideoPlayback);
document.addEventListener('keydown', event => {
  const key = event.code === 'KeyF' ? 'f'
    : event.code === 'KeyR' ? 'r'
    : event.key.toLowerCase();
  if(event.code === 'Space' || event.key === ' '){
    if(event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if(event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    event.preventDefault();
    toggleVideoPlayback();
    return;
  }
  if(!['f', 'r'].includes(key) || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if(event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  event.preventDefault();
  if(key === 'f') toggleFullscreen();
  else showRandomCam();
});

function toggleVideoPlayback(){
  if(!youtubePlayer || !playerReady){
    pendingPlaybackToggle = !pendingPlaybackToggle;
    playPauseBtn.textContent = pendingPlaybackToggle ? '⏳ הניגון יתחיל כשהנגן יהיה מוכן' : '⏳ טוען נגן';
    return;
  }
  if(youtubePlayer.getPlayerState() === window.YT.PlayerState.PLAYING) youtubePlayer.pauseVideo();
  else youtubePlayer.playVideo();
}

function updatePlaybackButton(state){
  if(state === window.YT.PlayerState.PLAYING) playPauseBtn.textContent = '⏸ השהיה';
  else if(state === window.YT.PlayerState.BUFFERING) playPauseBtn.textContent = '⏳ טוען נגן';
  else playPauseBtn.textContent = '▶ ניגון';
}

function toggleFullscreen(){
  if(document.fullscreenElement === slotEl) return document.exitFullscreen();
  if(!document.fullscreenElement) return slotEl.requestFullscreen();
}

function showChannelOverlay(cam){
  clearTimeout(switchOverlayTimer);
  clearTimeout(switchOverlayHideTimer);
  switchFlag.hidden = !cam.flagCode;
  if(cam.flagCode){
    switchFlag.src = `https://flagcdn.com/w80/${cam.flagCode}.png`;
    switchFlag.alt = cam.country || '';
  }
  switchCountry.textContent = cam.country || cam.label;
  switchOverlay.classList.remove('fade');
  switchOverlay.hidden = false;
  switchOverlayTimer = setTimeout(() => {
    switchOverlay.classList.add('fade');
    switchOverlayHideTimer = setTimeout(() => { switchOverlay.hidden = true; }, 300);
  }, 2400);
}

function showRandomCam(){
  if(cams.length <= 1) return;
  let next;
  do { next = Math.floor(Math.random() * cams.length); } while(next === current);
  goTo(next);
}

starBtn.addEventListener('click', () => {
  if(cams.length === 0) return;
  const id = camId(cams[current]);
  if(favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  starBtn.classList.toggle('active', favorites.has(id));
  saveFavorites();
  renderFavbar();
});

function isChannelValid(channel){
  if(!channel || typeof channel !== 'object') return false;
  if(typeof channel.label !== 'string' || !channel.label.trim()) return false;
  if(typeof channel.title !== 'string' || !channel.title.trim()) return false;
  if(typeof channel.src !== 'string' || !channel.src.trim()) return false;
  if(channel.activeMonths !== undefined &&
    (!Array.isArray(channel.activeMonths) ||
      !channel.activeMonths.every(month => Number.isInteger(month) && month >= 1 && month <= 12))){
    return false;
  }
  if(channel.activeHours !== undefined){
    const windows = Array.isArray(channel.activeHours) ? channel.activeHours : [channel.activeHours];
    if(windows.length === 0 || !windows.every(window =>
      window && Number.isInteger(window.start) && window.start >= 0 && window.start <= 23 &&
      Number.isInteger(window.end) && window.end >= 0 && window.end <= 23 &&
      Number.isFinite(window.tz)
    )){
      return false;
    }
  }
  try {
    const url = new URL(channel.src);
    return url.protocol === 'https:' && (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com'));
  } catch {
    return false;
  }
}

function isChannelActive(channel){
  if(channel.activeMonths && !channel.activeMonths.includes(new Date().getMonth() + 1)) return false;
  if(!channel.activeHours) return true;
  const windows = Array.isArray(channel.activeHours) ? channel.activeHours : [channel.activeHours];
  const utcHour = new Date().getUTCHours();
  return windows.some(({ start, end, tz }) => {
    const localHour = ((utcHour + tz) % 24 + 24) % 24;
    return start <= end
      ? localHour >= start && localHour < end
      : localHour >= start || localHour < end;
  });
}

async function loadConfig(){
  const configPath = new URLSearchParams(window.location.search).get('config');
  if(!configPath) throw new Error('חסר קובץ הגדרות לשידורים.');
  const configUrl = new URL(configPath, window.location.href);
  if(configUrl.origin !== window.location.origin) throw new Error('קובץ ההגדרות חייב להיות חלק מהאתר.');
  const response = await fetch(configUrl);
  if(!response.ok) throw new Error(`טעינת קובץ ההגדרות נכשלה (${response.status}).`);
  const config = await response.json();
  if(!config || typeof config !== 'object' || !Array.isArray(config.channels)){
    throw new Error('קובץ ההגדרות אינו מכיל רשימת ערוצים תקינה.');
  }
  if(typeof config.title !== 'string' || typeof config.favoriteKey !== 'string' ||
    !/^[a-zA-Z0-9_-]+$/.test(config.favoriteKey)){
    throw new Error('חסרים שם עמוד או מפתח מועדפים תקינים בקובץ ההגדרות.');
  }
  const invalidChannels = config.channels.filter(channel => !isChannelValid(channel));
  if(invalidChannels.length){
    throw new Error(`נמצאו ${invalidChannels.length} ערוצים לא תקינים בקובץ ההגדרות.`);
  }
  document.title = config.title;
  document.getElementById('pageTitle').textContent = config.title;
  document.getElementById('pageSubtitle').textContent = config.subtitle || '';
  document.getElementById('pageEmoji').textContent = config.emoji || '📹';
  emptyIcon.textContent = config.emoji || '📹';
  emptyMessage.textContent = config.emptyMessage || 'ערוצי השידור יתווספו בקרוב';
  favoriteKey = config.favoriteKey;
  cams.push(...config.channels.filter(isChannelActive));
  loadFavorites();
  if(window.KidLearn && typeof KidLearn.onAuthChange === 'function'){
    KidLearn.onAuthChange(async profile => {
      if(!profile) return;
      await KidLearn.pullLocalStorageKey(favoriteKey);
      loadFavorites();
      showCam(current);
    });
  }
  showCam(0);
}

loadConfig().catch(error => {
  console.error('Unable to load live camera configuration:', error);
  emptyMessage.textContent = error.message || 'לא ניתן לטעון את ערוצי השידור.';
  emptyState.hidden = false;
  starBtn.disabled = true;
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  stageTools.hidden = true;
});
