using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace Kidlearn.Tray;

// שמירה מקומית של כל שיר ופרק שהילד מאזין לו, כי סביר שישמע אותו שוב.
// האפליקציה מורידה את הקובץ לתיקייה בחשבון המשתמש, מדווחת התקדמות לאתר, ומגישה אותו
// מכתובת מקומית (127.0.0.1) בלבד. האתר מקבל רק מזהה, ולא יכול לקרוא קבצים אחרים.
internal static class MediaCache
{
    private const int Port = 47653;
    private const long MaxFileBytes = 700L * 1024 * 1024;
    private const long MaxCacheBytes = 3L * 1024 * 1024 * 1024;

    private sealed class Job
    {
        public string Key = "";
        public string Path = "";
        public long Bytes;
        public long Total;
        public bool Done;
        public string? Error;
        public string Stage = "download";
        public JsonObject? Meta;
    }

    private static readonly ConcurrentDictionary<string, Job> Jobs = new();
    private static readonly HttpClient Http = CreateClient();
    private static HttpListener? _listener;
    private static readonly object StartLock = new();

    private static string Folder
    {
        get
        {
            string dir = System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kidlearn", "media");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    private static HttpClient CreateClient()
    {
        var handler = new SocketsHttpHandler
        {
            AllowAutoRedirect = true,
            MaxAutomaticRedirections = 5,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli,
            ConnectTimeout = TimeSpan.FromSeconds(15),
        };
        var client = new HttpClient(handler) { Timeout = TimeSpan.FromMinutes(30) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("KidlearnPodcastPlayer/1.0 (+https://giamat13.github.io/Kidlearn/)");
        return client;
    }

    public static void Start()
    {
        lock (StartLock)
        {
            if (_listener is not null) return;
            try
            {
                var listener = new HttpListener();
                listener.Prefixes.Add($"http://127.0.0.1:{Port}/");
                listener.Start();
                _listener = listener;
                _ = Task.Run(() => ServeLoop(listener));
            }
            catch (Exception)
            {
                _listener = null; // הפורט תפוס: ההשמעה תיפול חזרה להזרמה ישירה
            }
        }
    }

    public static void Stop()
    {
        try { _listener?.Close(); } catch (Exception) { }
        _listener = null;
    }

    // האתר מבקש להכין שיר או פרק. אם הוא כבר שמור, התשובה מיידית. אחרת מתחילה הורדה ברקע.
    public static JsonObject Prepare(string? id, JsonObject request)
    {
        Start();
        if (_listener is null) return Fail(id, "cache_unavailable");

        var payload = request["payload"] as JsonObject;
        string? url = payload?["url"] is JsonValue v && v.TryGetValue(out string? text) ? text : null;
        string? itemId = payload?["itemId"] is JsonValue iv && iv.TryGetValue(out string? t2) ? t2 : null;

        string? pageUrl = payload?["pageUrl"] is JsonValue pv && pv.TryGetValue(out string? t3) ? t3 : null;
        bool youtube = PodcastActions.IsYouTubeUrl(pageUrl);
        Uri? uri = null;
        if (string.IsNullOrWhiteSpace(itemId) || itemId.Length > 200 ||
            (youtube ? pageUrl!.Length > 300
                     : !Uri.TryCreate(url, UriKind.Absolute, out uri) || uri.Scheme != Uri.UriSchemeHttps ||
                       url!.Length > 4000 || IsPrivateHost(uri)))
        {
            return Fail(id, "bad_media_url");
        }

        string key = Hash(itemId);
        var job = Jobs.GetOrAdd(key, _ => new Job { Key = key, Path = System.IO.Path.Combine(Folder, key + ".bin") });
        job.Meta = BuildMeta(itemId, payload?["meta"] as JsonObject, youtube ? pageUrl : null, youtube ? null : url);
        if (!File.Exists(job.Path + ".ok") && !job.Done && job.Bytes == 0)
        {
            try { if (File.Exists(job.Path)) File.Delete(job.Path); } catch (Exception) { }
        }

        lock (job)
        {
            if (File.Exists(job.Path) && !job.Done && job.Error is null && job.Bytes == 0)
            {
                // שמור מהפעם הקודמת (למשל אחרי הפעלה מחדש של האפליקציה)
                long size = new FileInfo(job.Path).Length;
                if (size > 0 && File.Exists(job.Path + ".ok"))
                {
                    job.Bytes = job.Total = size;
                    job.Done = true;
                }
            }

            if (job.Error is not null)
            {
                job.Error = null;
                job.Bytes = job.Total = 0;
                job.Done = false;
            }

            if (!job.Done && job.Bytes == 0)
            {
                if (youtube) { string page = pageUrl!; _ = Task.Run(() => DownloadYouTube(job, page)); }
                else { Uri target = uri!; _ = Task.Run(() => Download(job, target)); }
            }
        }

        return Ok(id, Status(job));
    }

    private static JsonObject BuildMeta(string itemId, JsonObject? meta, string? pageUrl, string? audioUrl)
    {
        string Str(string k, int max) => meta?[k] is JsonValue v && v.TryGetValue(out string? t) && t is not null ? (t.Length > max ? t[..max] : t) : "";
        var o = new JsonObject
        {
            ["id"] = itemId, ["kind"] = Str("kind", 12), ["source"] = Str("source", 20), ["title"] = Str("title", 300),
            ["show"] = Str("show", 200), ["image"] = Str("image", 1500), ["pageUrl"] = pageUrl ?? "", ["audioUrl"] = audioUrl ?? "",
        };
        if (meta?["durationSeconds"] is JsonValue d && d.TryGetValue(out int secs)) o["durationSeconds"] = secs;
        return o;
    }

    private static void SaveMeta(Job job)
    {
        try { if (job.Meta is not null) File.WriteAllText(job.Path + ".json", job.Meta.ToJsonString()); } catch (Exception) { }
    }

    // השירים והפרקים ששמורים במחשב, מהחדש לישן. נשמרים בין עדכונים ובין כתובות אתר שונות.
    public static JsonObject List(string? id)
    {
        var items = new JsonArray();
        try
        {
            foreach (var file in new DirectoryInfo(Folder).GetFiles("*.bin.json").OrderByDescending(f => f.LastWriteTimeUtc).Take(300))
            {
                if (!File.Exists(file.FullName[..^5] + ".ok")) continue;
                try { if (JsonNode.Parse(File.ReadAllText(file.FullName)) is JsonObject o) items.Add(o); } catch (Exception) { }
            }
        }
        catch (Exception) { }
        return Ok(id, new JsonObject { ["items"] = items });
    }

    public static JsonObject PollStatus(string? id, JsonObject request)
    {
        string? itemId = request["payload"] is JsonObject p && p["itemId"] is JsonValue v && v.TryGetValue(out string? t) ? t : null;
        if (string.IsNullOrWhiteSpace(itemId) || !Jobs.TryGetValue(Hash(itemId), out var job))
            return Fail(id, "unknown_media");
        return Ok(id, Status(job));
    }

    private static JsonObject Status(Job job) => new()
    {
        ["done"] = job.Done,
        ["bytes"] = job.Bytes,
        ["total"] = job.Total,
        ["error"] = job.Error,
        ["stage"] = job.Stage,
        ["url"] = job.Done ? $"http://127.0.0.1:{Port}/m/{job.Key}" : null,
    };

    private static void DownloadYouTube(Job job, string pageUrl)
    {
        string temp = job.Path + ".part";
        try
        {
            string template = System.IO.Path.Combine(Folder, job.Key + ".dl.%(ext)s");
            foreach (string old in Directory.GetFiles(Folder, job.Key + ".dl.*")) { try { File.Delete(old); } catch (Exception) { } }
            PodcastActions.DownloadYouTubeAudio(pageUrl, template, (bytes, total) =>
            {
                job.Stage = "download";
                job.Bytes = bytes;
                if (total > 0) job.Total = total;
            });
            string? produced = Directory.GetFiles(Folder, job.Key + ".dl.*")
                .Where(f => !f.EndsWith(".part") && !f.EndsWith(".ytdl")).OrderByDescending(f => new FileInfo(f).Length).FirstOrDefault();
            if (produced is null) throw new InvalidDataException("no file");
            temp = produced;
            long size = new FileInfo(temp).Length;
            if (size == 0) throw new InvalidDataException("empty");
            if (File.Exists(job.Path)) File.Delete(job.Path);
            File.Move(temp, job.Path);
            SaveMeta(job);
            File.WriteAllText(job.Path + ".ok", produced.EndsWith(".webm") ? "audio/webm" : "audio/mp4");
            job.Bytes = job.Total = size;
            job.Done = true;
            TrimCache(job.Path);
        }
        catch (Exception ex)
        {
            job.Error = ex.Message.Contains("not_child_appropriate") ? "not_child_appropriate" : "download_failed";
            try { File.Delete(temp); } catch (Exception) { }
            try { foreach (string old in Directory.GetFiles(Folder, job.Key + ".dl.*")) File.Delete(old); } catch (Exception) { }
        }
    }

    private static async Task Download(Job job, Uri uri)
    {
        string temp = job.Path + ".part";
        try
        {
            using var response = await Http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();
            string? type = response.Content.Headers.ContentType?.MediaType;
            if (type is not null && !(type.StartsWith("audio/") || type.StartsWith("video/") ||
                                      type == "application/octet-stream" || type == "binary/octet-stream"))
                throw new InvalidDataException("not audio");

            long total = response.Content.Headers.ContentLength ?? 0;
            if (total > MaxFileBytes) throw new InvalidDataException("too large");
            job.Total = total;

            await using (var input = await response.Content.ReadAsStreamAsync())
            await using (var output = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                var buffer = new byte[64 * 1024];
                int read;
                while ((read = await input.ReadAsync(buffer)) > 0)
                {
                    await output.WriteAsync(buffer.AsMemory(0, read));
                    job.Bytes += read;
                    if (job.Bytes > MaxFileBytes) throw new InvalidDataException("too large");
                }
            }

            if (job.Bytes == 0) throw new InvalidDataException("empty");
            job.Total = job.Bytes;
            if (File.Exists(job.Path)) File.Delete(job.Path);
            File.Move(temp, job.Path);
            SaveMeta(job);
            File.WriteAllText(job.Path + ".ok", type is not null && type.StartsWith("audio/") ? type : "audio/mpeg");
            job.Done = true;
            TrimCache(job.Path);
        }
        catch (Exception)
        {
            job.Error = "download_failed";
            try { File.Delete(temp); } catch (Exception) { }
        }
    }

    // כשהמקום עובר את המכסה מוחקים את הקבצים שלא נפתחו הכי הרבה זמן
    private static void TrimCache(string keep)
    {
        try
        {
            var files = new DirectoryInfo(Folder).GetFiles("*.bin").OrderBy(f => f.LastAccessTimeUtc).ToList();
            long total = files.Sum(f => f.Length);
            foreach (var file in files)
            {
                if (total <= MaxCacheBytes) break;
                if (string.Equals(file.FullName, keep, StringComparison.OrdinalIgnoreCase)) continue;
                total -= file.Length;
                string key = System.IO.Path.GetFileNameWithoutExtension(file.Name);
                Jobs.TryRemove(key, out _);
                try { file.Delete(); File.Delete(file.FullName + ".ok"); } catch (Exception) { }
            }
        }
        catch (Exception) { }
    }

    private static async Task ServeLoop(HttpListener listener)
    {
        while (listener.IsListening)
        {
            HttpListenerContext context;
            try { context = await listener.GetContextAsync(); }
            catch (Exception) { return; }
            _ = Task.Run(() => Serve(context));
        }
    }

    private static async Task Serve(HttpListenerContext context)
    {
        var response = context.Response;
        try
        {
            string path = context.Request.Url?.AbsolutePath ?? "";
            if (!path.StartsWith("/m/") || path.Length != 3 + 64 || !path[3..].All(Uri.IsHexDigit))
            {
                response.StatusCode = 404;
                return;
            }

            string file = System.IO.Path.Combine(Folder, path[3..].ToLowerInvariant() + ".bin");
            if (!File.Exists(file) || !File.Exists(file + ".ok"))
            {
                response.StatusCode = 404;
                return;
            }

            File.SetLastAccessTimeUtc(file, DateTime.UtcNow);
            long length = new FileInfo(file).Length;
            long start = 0, end = length - 1;
            string? range = context.Request.Headers["Range"];
            if (range is not null && range.StartsWith("bytes="))
            {
                var parts = range[6..].Split('-');
                if (parts[0].Length > 0 && long.TryParse(parts[0], out long s)) start = s;
                if (parts.Length > 1 && parts[1].Length > 0 && long.TryParse(parts[1], out long e)) end = Math.Min(e, length - 1);
                if (start > end || start >= length)
                {
                    response.StatusCode = 416;
                    return;
                }
                response.StatusCode = 206;
                response.AddHeader("Content-Range", $"bytes {start}-{end}/{length}");
            }

            string contentType = File.ReadAllText(file + ".ok").Trim();
            response.ContentType = contentType.StartsWith("audio/") ? contentType : "audio/mpeg";
            response.AddHeader("Accept-Ranges", "bytes");
            response.AddHeader("Access-Control-Allow-Origin", "*");
            response.AddHeader("Access-Control-Allow-Private-Network", "true");
            response.ContentLength64 = end - start + 1;

            await using var input = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.Read);
            input.Seek(start, SeekOrigin.Begin);
            var buffer = new byte[64 * 1024];
            long remaining = end - start + 1;
            while (remaining > 0)
            {
                int read = await input.ReadAsync(buffer.AsMemory(0, (int)Math.Min(buffer.Length, remaining)));
                if (read == 0) break;
                await response.OutputStream.WriteAsync(buffer.AsMemory(0, read));
                remaining -= read;
            }
        }
        catch (Exception) { }
        finally
        {
            try { response.Close(); } catch (Exception) { }
        }
    }

    private static bool IsPrivateHost(Uri uri)
    {
        string host = uri.Host;
        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || host.EndsWith(".local", StringComparison.OrdinalIgnoreCase))
            return true;
        if (!IPAddress.TryParse(host, out var ip)) return false;
        if (IPAddress.IsLoopback(ip)) return true;
        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            byte[] b = ip.GetAddressBytes();
            return b[0] == 10 || b[0] == 127 || b[0] == 0 || (b[0] == 169 && b[1] == 254) ||
                   (b[0] == 172 && b[1] >= 16 && b[1] <= 31) || (b[0] == 192 && b[1] == 168);
        }
        return ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6UniqueLocal;
    }

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    private static JsonObject Ok(string? id, JsonObject data) =>
        new() { ["id"] = id, ["ok"] = true, ["data"] = data };

    private static JsonObject Fail(string? id, string error) =>
        new() { ["id"] = id, ["ok"] = false, ["error"] = error };
}
