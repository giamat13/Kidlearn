// train-next.js
// תוסף לעמוד הרכבות בלבד. כפתור "הבא" עובר למצלמה שבה רכבת נוסעים צפויה להגיע בקרוב.
// אם אין נתונים, הכפתור עובד כמו קודם (מצלמה אקראית).
// בעמודי החיות והמטוסים הקובץ לא עושה דבר, כי הוא בודק את נתיב קובץ ההגדרות.
(() => {
  const configPath = new URLSearchParams(window.location.search).get('config') || '';
  if (!configPath.includes('train-cam')) return;

  // מחכים לסיום הטעינה, כדי ש-live-cam.js יהיה מוכן לא משנה באיזה סדר מופיעים הסקריפטים.
  const start = () => {
    if (typeof showRandomCam !== 'function' || typeof goTo !== 'function' || typeof showChannelOverlay !== 'function') {
      console.warn('train-next: live-cam.js לא זמין. בדוק שהוא נטען כסקריפט רגיל (בלי type="module").');
      return;
    }
    console.info('train-next: פעיל');
    setup();
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);

  function setup() {
    const API_URL = 'https://api.amtraker.com/v3/trains';
    const REFRESH_MS = 20 * 1000;
    const MAX_DATA_AGE_MS = 10 * 60 * 1000;
    const LOOKAHEAD_MS = 60 * 1000;
    const GRACE_MS = 30 * 1000;

    // שם העיר באנגלית, כפי שמופיע בתווית הערוץ -> קוד תחנת הנוסעים של Amtrak.
    // הקודים נכתבו מזיכרון ולא אומתו מול רשימת התחנות הרשמית של Amtrak.
    const STATION_BY_CITY = {
      'Ashland, Virginia': 'ASD',
      'Roanoke, Virginia': 'ROA',
      'Spartanburg, South Carolina': 'SPA',
      'Lincoln, Nebraska': 'LCN',
      'Kearney, Nebraska': 'KEA',
      'Galesburg, Illinois': 'GBG',
      'Quincy, Illinois': 'QCY',
      'Burlington, Iowa': 'BUI',
      'Flagstaff, Arizona': 'FLG',
      'Kansas City, Missouri': 'KCY',
      'Cheyenne, Wyoming': 'CYS',
      'Laramie, Wyoming': 'LAR',
      'Salt Lake City, Utah': 'SLC',
      'Tucson, Arizona': 'TUS',
      'Texarkana, Arkansas': 'TXK',
      'Springfield, Massachusetts': 'SPG',
      'South Norwalk, Connecticut': 'NRK',
      'Saint Louis, Missouri': 'STL',
      'Spokane, Washington': 'SPK',
      'Battle Creek, Michigan': 'BTL',
      'Johnstown, Pennsylvania': 'JST',
      'Fullerton, California': 'FUL'
    };

    let arrivalsByStation = new Map();
    let arrivalsUpdatedAt = 0;

    function stopsOf(train) {
      const stops = train && (train.stations || train.stops);
      if (!stops) return [];
      if (Array.isArray(stops)) return stops;
      return Object.entries(stops).map(([code, stop]) => ({ code, ...stop }));
    }

    function buildArrivals(data) {
      const now = Date.now();
      const trains = Array.isArray(data) ? data : Object.values(data || {}).flat();
      const map = new Map();
      for (const train of trains) {
        for (const stop of stopsOf(train)) {
          if (!stop || !stop.code) continue;
          const time = Date.parse(stop.estArr || stop.schArr || '');
          if (Number.isNaN(time) || time < now - GRACE_MS) continue;
          if (!map.has(stop.code) || time < map.get(stop.code)) map.set(stop.code, time);
        }
      }
      return map;
    }

    async function refreshArrivals() {
      try {
        const response = await fetch(API_URL, { cache: 'no-store' });
        if (!response.ok) return;
        arrivalsByStation = buildArrivals(await response.json());
        arrivalsUpdatedAt = Date.now();
      } catch {
        // אם השרת לא זמין או החסימה של הדפדפן מונעת קריאה, נשארים במצב הרגיל.
      }
    }

    // שדה category בקובץ ההגדרות: 'train' או 'metro'. חסר = train.
    // למטרו אין נתוני לוח זמנים, ולכן הכפתור לא בוחר בו לפי רכבות.
    function isTrainCam(cam) {
      return (cam.category || 'train') === 'train';
    }

    function stationCodeOf(cam) {
      const city = Object.keys(STATION_BY_CITY).find(name => cam.label.includes(name));
      return city ? STATION_BY_CITY[city] : null;
    }

    function pickUpcomingCam() {
      const now = Date.now();
      if (now - arrivalsUpdatedAt > MAX_DATA_AGE_MS) return null;
      let best = null;
      cams.forEach((cam, index) => {
        if (index === current) return;
        if (!isTrainCam(cam)) return;
        const code = stationCodeOf(cam);
        if (!code) return;
        const time = arrivalsByStation.get(code);
        if (time === undefined || time > now + LOOKAHEAD_MS) return;
        if (!best || time < best.time) best = { index, time };
      });
      return best ? best.index : null;
    }

    const randomCam = showRandomCam;

    function nextCam() {
      const index = pickUpcomingCam();
      if (index !== null) goTo(index);
      else randomCam();
    }

    // מקש R קורא ל-showRandomCam הגלובלי, לכן מחליפים אותו כאן.
    window.showRandomCam = nextCam;

    // בכל החלפת מצלמה live-cam.js קורא ל-showChannelOverlay, שמציג את שם המדינה.
    // כאן מוסיפים אחריו את סוג הערוץ: רכבת או מטרו.
    const originalChannelOverlay = showChannelOverlay;
    window.showChannelOverlay = cam => {
      originalChannelOverlay(cam);
      const kind = (cam.category || 'train') === 'metro' ? 'מטרו' : 'רכבת';
      switchCountry.textContent = `${cam.country || cam.label} · ${kind}`;
    };
    if (cams.length) window.showChannelOverlay(cams[current]);

    // כפתורי "הבא" נתפסים לפני המאזינים של live-cam.js.
    document.addEventListener('click', event => {
      const button = event.target.closest?.('#nextBtn, #fullscreenNextBtn');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      nextCam();
    }, true);

    refreshArrivals();
    setInterval(refreshArrivals, REFRESH_MS);
  }
})();
