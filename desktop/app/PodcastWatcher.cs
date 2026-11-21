using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kidlearn.Tray;

// מעקב אחרי פרקים חדשים בפודקאסטים שהילד סימן בפעמון. רץ ברקע באפליקציה, גם כשהאתר סגור,
// ומציג התראה בשורת המשימות כשיוצא פרק חדש. האתר שולח רק את רשימת הפודקאסטים (כתובת הפיד והשם),
// והאפליקציה בודקת אותם בעצמה, בכתובות HTTPS ציבוריות בלבד (אותן בדיקות כמו בחיפוש).
internal static class PodcastWatcher
{
    private const int MaxFeeds = 30;
    private const int MaxSeenPerFeed = 300;
    private static readonly TimeSpan CheckEvery = TimeSpan.FromMinutes(30);
    private static readonly object Gate = new();
    private static System.Threading.Timer? _timer;
    private static int _running;

    private sealed class Feed
    {
        public string FeedUrl { get; set; } = "";
        public string Title { get; set; } = "";
        public List<string> Seen { get; set; } = new();
        public bool Baselined { get; set; }
    }

    // מקבל התראה כשנמצאו פרקים חדשים: (כותרת, טקסט)
    public static event Action<string, string>? NewEpisodes;

    private static string StatePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kidlearn", "podcast-watch.json");

    // מפעיל את הבדיקה המחזורית (נקרא בעליית האפליקציה)
    public static void Start()
    {
        lock (Gate)
        {
            _timer ??= new System.Threading.Timer(_ => _ = CheckAsync(), null, TimeSpan.FromMinutes(1), CheckEvery);
        }
    }

    public static void Stop()
    {
        lock (Gate)
        {
            _timer?.Dispose();
            _timer = null;
        }
    }

    // payload: { shows: [{ feedUrl, title }] }. הרשימה מחליפה את הקודמת; פודקאסט שכבר במעקב שומר את מה שנראה.
    public static JsonObject Set(string? id, JsonObject request)
    {
        if ((request["payload"] as JsonObject)?["shows"] is not JsonArray shows)
            return Fail(id, "bad_payload");

        var incoming = new List<Feed>();
        foreach (var node in shows)
        {
            if (node is not JsonObject item) continue;
            string? url = Text(item, "feedUrl");
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || url!.Length > 600)
                continue;
            if (incoming.Any(f => f.FeedUrl.Equals(url, StringComparison.OrdinalIgnoreCase)))
                continue;
            incoming.Add(new Feed { FeedUrl = url, Title = (Text(item, "title") ?? "פודקאסט").Truncate(120) });
            if (incoming.Count >= MaxFeeds) break;
        }

        lock (Gate)
        {
            var current = Load();
            foreach (var feed in incoming)
            {
                var old = current.FirstOrDefault(f => f.FeedUrl.Equals(feed.FeedUrl, StringComparison.OrdinalIgnoreCase));
                if (old is not null)
                {
                    feed.Seen = old.Seen;
                    feed.Baselined = old.Baselined;
                }
            }
            Save(incoming);
        }

        Start();
        // פודקאסט חדש במעקב נבדק מיד, כדי לקבוע את נקודת ההתחלה (בלי התראה על פרקים ישנים)
        _ = CheckAsync();
        return Ok(id, new JsonObject { ["watching"] = incoming.Count });
    }

    private static async Task CheckAsync()
    {
        if (Interlocked.Exchange(ref _running, 1) == 1) return;
        try
        {
            List<Feed> feeds;
            lock (Gate) feeds = Load();
            if (feeds.Count == 0) return;

            var found = new List<(string Show, string Title)>();
            foreach (var feed in feeds)
            {
                try
                {
                    var latest = await PodcastActions.LatestEpisodesAsync(feed.FeedUrl, feed.Title);
                    if (latest.Count == 0) continue;

                    var fresh = latest.Where(e => !feed.Seen.Contains(e.Id)).ToList();
                    if (feed.Baselined)
                        found.AddRange(fresh.Select(e => (feed.Title, e.Title)));

                    feed.Baselined = true;
                    feed.Seen.AddRange(fresh.Select(e => e.Id));
                    if (feed.Seen.Count > MaxSeenPerFeed)
                        feed.Seen = feed.Seen.Skip(feed.Seen.Count - MaxSeenPerFeed).ToList();
                }
                catch (Exception)
                {
                    // פיד שלא ענה: ננסה שוב בבדיקה הבאה
                }
            }

            lock (Gate)
            {
                // ייתכן שהרשימה השתנתה בזמן הבדיקה: שומרים רק פודקאסטים שעדיין במעקב
                var now = Load();
                foreach (var feed in feeds)
                {
                    var target = now.FirstOrDefault(f => f.FeedUrl.Equals(feed.FeedUrl, StringComparison.OrdinalIgnoreCase));
                    if (target is null) continue;
                    target.Seen = feed.Seen;
                    target.Baselined = feed.Baselined;
                }
                Save(now);
            }

            if (found.Count == 1)
                NewEpisodes?.Invoke("פרק חדש ב-" + found[0].Show, found[0].Title);
            else if (found.Count > 1)
                NewEpisodes?.Invoke(found.Count + " פרקים חדשים", string.Join(", ", found.Select(f => f.Show).Distinct().Take(3)));
        }
        catch (Exception)
        {
            // בדיקת רקע: לעולם לא מפילה את האפליקציה
        }
        finally
        {
            Interlocked.Exchange(ref _running, 0);
        }
    }

    private static List<Feed> Load()
    {
        try
        {
            if (!File.Exists(StatePath)) return new List<Feed>();
            return JsonSerializer.Deserialize<List<Feed>>(File.ReadAllText(StatePath)) ?? new List<Feed>();
        }
        catch (Exception)
        {
            return new List<Feed>();
        }
    }

    private static void Save(List<Feed> feeds)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(StatePath)!);
            File.WriteAllText(StatePath, JsonSerializer.Serialize(feeds));
        }
        catch (Exception)
        {
            // כתיבה נכשלה: הבדיקה הבאה תתחיל מחדש
        }
    }

    private static string? Text(JsonObject obj, string key) =>
        obj[key] is JsonValue value && value.TryGetValue(out string? text) ? text : null;

    private static JsonObject Ok(string? id, JsonObject data) =>
        new() { ["id"] = id, ["ok"] = true, ["data"] = data };

    private static JsonObject Fail(string? id, string error) =>
        new() { ["id"] = id, ["ok"] = false, ["error"] = error };
}
