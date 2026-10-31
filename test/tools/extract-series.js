// שימוש: node tools/extract-series.js <series-id>
// מחלץ מ-games.json את הפלייליסט של הסדרה ושומר את רשימת הסרטונים ב-series/data/<id>.json.
// לא מורידים קבצי וידאו, רק מזהים, כותרות ומשכי זמן.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const id = process.argv[2];
if (!id) { console.error('חסר מזהה סדרה'); process.exit(1); }

const games = JSON.parse(fs.readFileSync(path.join(root, 'games.json'), 'utf8'));
const game = games.items
    ? games.items.find(g => g.id === id)
    : (games.games || []).find(g => g.id === id);
if (!game) { console.error('סדרה לא נמצאה ב-games.json: ' + id); process.exit(1); }

const playlistUrl = game.playlistUrl || game.url;
const out = execFileSync('yt-dlp', [
    '--encoding', 'utf-8', '--flat-playlist', '--ignore-errors',
    '--print', '%(id)s\t%(duration)s\t%(title)s',
    playlistUrl
], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
});

const videos = out.split('\n').filter(Boolean).map(line => {
    const [vid, duration, ...title] = line.split('\t');
    return { id: vid, title: title.join('\t'), duration: Number(duration) || 0 };
}).filter(v => v.title !== '[Private video]' && v.title !== '[Deleted video]');

const dest = path.join(root, 'series', 'data', id + '.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify({ id, title: game.title, videos }, null, 2) + '\n');
console.log(videos.length + ' סרטונים נשמרו ב-' + dest);
