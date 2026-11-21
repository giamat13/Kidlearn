using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Kidlearn.Tray;

// חיפוש פודקאסטים ממקורות RSS ו-YouTube. השירות מחזיר כתובות השמעה בלבד;
// הוא לעולם אינו מוריד או שומר קובצי שמע.
internal static class PodcastActions
{
    private static readonly HttpClient Http = CreateHttpClient();
    private const int MaxResults = 24;
    private const int MaxShows = 32;
    private const int MaxFeedBytes = 4 * 1024 * 1024;

    private sealed record PodcastShow(string Title, string Artist, string FeedUrl, string Image, string PageUrl);
    private sealed record Episode(
        string Id, string Source, string Title, string Show, string Description,
        string AudioUrl, string PageUrl, string Image, int? DurationSeconds, string PublishedAt,
        int? Season = null, int? Number = null);

    private static HttpClient CreateHttpClient()
    {
        var handler = new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli
        };
        var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(18) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("KidlearnPodcastPlayer/1.0 (+https://giamat13.github.io/Kidlearn/)");
        return client;
    }

    // רשימת התוכניות שהחיפוש האחרון החזיר. רק כתובות מהרשימה הזו נפתחות ב-PodcastEpisodes,
    // כדי שהאתר לא יוכל לבקש מהאפליקציה לקרוא כתובת שרירותית.
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, PodcastShow> KnownShows =
        new(StringComparer.OrdinalIgnoreCase);

    // חיפוש תוכניות (פודקאסטים) בלבד. את הפרקים של תוכנית מביאים רק בלחיצה עליה.
    public static JsonObject Search(string? id, JsonObject request)
    {
        string query = GetString(request["payload"] as JsonObject, "query")?.Trim() ?? "";
        if (query.Length < 2 || query.Length > 120)
            return Fail(id, "bad_query");

        var countries = new[] { "il", "us", "gb", "ca", "au", "in" };
        var countryResults = Task.WhenAll(countries.Select(country =>
            Task.Run(() => SearchApple(query, country)))).GetAwaiter().GetResult();
        var shows = countryResults.SelectMany(results => results)
            .Where(s => !string.IsNullOrWhiteSpace(s.FeedUrl))
            .GroupBy(s => s.FeedUrl, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .Take(MaxShows)
            .ToList();

        if (KnownShows.Count > 500)
            KnownShows.Clear();
        var results = new JsonArray();
        foreach (var show in shows)
        {
            KnownShows[show.FeedUrl] = show;
            results.Add(new JsonObject
            {
                ["feedUrl"] = show.FeedUrl,
                ["title"] = CleanTitle(show.Title),
                ["artist"] = CleanTitle(show.Artist),
                ["image"] = show.Image,
                ["pageUrl"] = show.PageUrl
            });
        }

        return Ok(id, new JsonObject { ["shows"] = results, ["count"] = shows.Count });
    }

    // הפרקים של תוכנית אחת, מתוך רשימת התוכניות שהחיפוש החזיר.
    public static JsonObject Episodes(string? id, JsonObject request)
    {
        var payload = request["payload"] as JsonObject;
        string? feedUrl = GetString(payload, "feedUrl");
        if (feedUrl is null || feedUrl.Length > 600 ||
            !Uri.TryCreate(feedUrl, UriKind.Absolute, out var feedUri) || feedUri.Scheme != Uri.UriSchemeHttps)
            return Fail(id, "unknown_show");
        // פודקאסט מהחיפוש האחרון, או פודקאסט שהילד עוקב אחריו (נבדק שוב ל-HTTPS ציבורי בקריאת הפיד)
        if (!KnownShows.TryGetValue(feedUrl, out var show))
            show = new PodcastShow(CleanTitle(GetString(payload, "title") ?? "פודקאסט"), "", feedUrl, "", "");

        var episodes = OrderEpisodes(ReadFeedAsync(show).GetAwaiter().GetResult());
        var results = new JsonArray();
        foreach (var episode in episodes)
            results.Add(ToJson(episode));
        return Ok(id, new JsonObject { ["episodes"] = results, ["count"] = episodes.Count });
    }

    // הפרקים האחרונים של פיד, בשביל מעקב ההתראות (PodcastWatcher)
    internal static async Task<List<(string Id, string Title)>> LatestEpisodesAsync(string feedUrl, string title)
    {
        var episodes = await ReadFeedAsync(new PodcastShow(title, "", feedUrl, "", ""), 15);
        return episodes.Select(e => (e.Id, e.Title)).ToList();
    }

    // חיפוש שירים ביוטיוב, עם אותו סינון דירוג גיל כמו בפרקים.
    public static JsonObject SearchSongs(string? id, JsonObject request)
    {
        string query = GetString(request["payload"] as JsonObject, "query")?.Trim() ?? "";
        if (query.Length < 2 || query.Length > 120)
            return Fail(id, "bad_query");

        try
        {
            var songs = SearchYouTube(query + " song", "song");
            var results = new JsonArray();
            foreach (var song in songs)
                results.Add(ToJson(song));
            return Ok(id, new JsonObject { ["songs"] = results, ["count"] = songs.Count });
        }
        catch (FileNotFoundException)
        {
            return Fail(id, "yt_dlp_missing");
        }
        catch (Exception)
        {
            return Fail(id, "youtube_unavailable");
        }
    }

    public static JsonObject Resolve(string? id, JsonObject request)
    {
        string? pageUrl = GetString(request["payload"] as JsonObject, "url");
        if (!Uri.TryCreate(pageUrl, UriKind.Absolute, out var uri) ||
            uri.Scheme != Uri.UriSchemeHttps ||
            !(uri.Host.Equals("youtube.com", StringComparison.OrdinalIgnoreCase) ||
              uri.Host.EndsWith(".youtube.com", StringComparison.OrdinalIgnoreCase) ||
              uri.Host.Equals("youtu.be", StringComparison.OrdinalIgnoreCase)))
        {
            return Fail(id, "invalid_video_url");
        }

        try
        {
            // בדיקת דירוג גיל נוספת בזמן פתיחת הפרק, גם אם נשלחה בקשה ישירה לגשר.
            string ageText = RunYtDlp(new[]
            {
                "--no-warnings", "--no-progress", "--no-call-home", "--print", "%(age_limit)s",
                "--no-playlist", uri.ToString()
            }, 20000).Trim();
            if (!int.TryParse(ageText, out int ageLimit) || ageLimit > 12)
                return Fail(id, "not_child_appropriate");

            string output = RunYtDlp(new[]
            {
                "--no-warnings", "--no-progress", "--no-call-home",
                "--format", "bestaudio/best", "--get-url", "--no-playlist", uri.ToString()
            }, 30000);

            string? audioUrl = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(line => line.Trim())
                .FirstOrDefault(line => Uri.TryCreate(line, UriKind.Absolute, out var media) &&
                                        (media.Scheme == "https" || media.Scheme == "http"));

            if (audioUrl is null)
                return Fail(id, "audio_unavailable");

            return Ok(id, new JsonObject { ["url"] = audioUrl });
        }
        catch (FileNotFoundException)
        {
            return Fail(id, "yt_dlp_missing");
        }
        catch (TimeoutException)
        {
            return Fail(id, "youtube_timeout");
        }
        catch (Exception)
        {
            return Fail(id, "youtube_unavailable");
        }
    }

    private static List<PodcastShow> SearchApple(string query, string country)
    {
        try
        {
            string url = "https://itunes.apple.com/search?term=" + Uri.EscapeDataString(query) +
                         "&country=" + country + "&entity=podcast&limit=25&explicit=No";
            string json = Http.GetStringAsync(url).GetAwaiter().GetResult();
            using var document = JsonDocument.Parse(json);
            if (!document.RootElement.TryGetProperty("results", out var results))
                return new List<PodcastShow>();

            var shows = new List<PodcastShow>();
            foreach (var item in results.EnumerateArray())
            {
                string feed = JsonText(item, "feedUrl") ?? "";
                if (!Uri.TryCreate(feed, UriKind.Absolute, out var feedUri) ||
                    feedUri.Scheme != Uri.UriSchemeHttps)
                    continue;

                shows.Add(new PodcastShow(
                    JsonText(item, "collectionName") ?? "פודקאסט",
                    JsonText(item, "artistName") ?? "",
                    feed,
                    JsonText(item, "artworkUrl600") ?? JsonText(item, "artworkUrl100") ?? "",
                    JsonText(item, "collectionViewUrl") ?? ""));
            }
            return shows;
        }
        catch (Exception)
        {
            return new List<PodcastShow>();
        }
    }

    private static async Task<List<Episode>> ReadFeedAsync(PodcastShow show, int maxEpisodes = 150)
    {
        try
        {
            if (!Uri.TryCreate(show.FeedUrl, UriKind.Absolute, out var currentUri))
                return new List<Episode>();

            HttpResponseMessage? response = null;
            for (int redirect = 0; redirect <= 4; redirect++)
            {
                // RSS is fetched only over public HTTPS endpoints. Redirects are checked again
                // so a catalog feed cannot make the desktop app contact localhost or a LAN device.
                if (!await IsPublicHttpsAsync(currentUri))
                    return new List<Episode>();

                response = await Http.GetAsync(currentUri, HttpCompletionOption.ResponseHeadersRead);
                bool isRedirect = response.StatusCode is System.Net.HttpStatusCode.MovedPermanently
                    or System.Net.HttpStatusCode.Redirect
                    or System.Net.HttpStatusCode.SeeOther
                    or System.Net.HttpStatusCode.TemporaryRedirect
                    or System.Net.HttpStatusCode.PermanentRedirect;
                if (!isRedirect)
                    break;

                Uri? location = response.Headers.Location;
                response.Dispose();
                response = null;
                if (location is null || redirect == 4)
                    return new List<Episode>();
                currentUri = new Uri(currentUri, location);
            }

            if (response is null)
                return new List<Episode>();

            using (response)
            {
                if (!response.IsSuccessStatusCode ||
                    (response.Content.Headers.ContentLength is long length && length > MaxFeedBytes))
                    return new List<Episode>();

                string xml = await response.Content.ReadAsStringAsync();
                if (xml.Length > MaxFeedBytes)
                    return new List<Episode>();

            var document = XDocument.Parse(xml, LoadOptions.None);
            var root = document.Root;
            if (root is null)
                return new List<Episode>();

            var channel = root.Descendants().FirstOrDefault(e => e.Name.LocalName == "channel");
            string channelImage = FindImage(channel) ?? show.Image;
            var episodes = new List<Episode>();

            foreach (var item in root.Descendants().Where(e => e.Name.LocalName == "item").Take(400))
            {
                string? title = ChildText(item, "title");
                if (string.IsNullOrWhiteSpace(title) || IsExplicit(item))
                    continue;

                var enclosure = item.Elements().FirstOrDefault(e => e.Name.LocalName == "enclosure");
                string? audioUrl = enclosure?.Attribute("url")?.Value;
                if (string.IsNullOrWhiteSpace(audioUrl))
                {
                    audioUrl = item.Elements()
                        .Where(e => e.Name.LocalName == "content")
                        .Select(e => e.Attribute("url")?.Value)
                        .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
                }

                if (!Uri.TryCreate(audioUrl, UriKind.Absolute, out var audioUri) ||
                    !await IsPublicHttpsAsync(audioUri))
                    continue;

                string guid = ChildText(item, "guid") ?? audioUri.AbsoluteUri;
                string episodeId = "rss:" + Hash(Normalize(show.Title) + "|" + guid);
                string image = FindImage(item) ?? channelImage;
                if (!Uri.TryCreate(image, UriKind.Absolute, out var imageUri) ||
                    !await IsPublicHttpsAsync(imageUri))
                    image = "";
                string description = ChildText(item, "description") ??
                                     ChildText(item, "summary") ?? "";
                description = CleanDescription(description);
                string published = ChildText(item, "pubDate") ?? "";
                if (DateTimeOffset.TryParse(published, CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeUniversal, out var date))
                    published = date.ToUniversalTime().ToString("O");

                episodes.Add(new Episode(
                    episodeId, "rss", CleanTitle(title), show.Title, description,
                    audioUri.AbsoluteUri,
                    ChildText(item, "link") ?? show.PageUrl,
                    image,
                    ParseDuration(ChildText(item, "duration")),
                    published,
                    ParseNumber(ChildText(item, "season")),
                    ParseNumber(ChildText(item, "episode"))));
                if (episodes.Count >= maxEpisodes)
                    break;
            }
            return episodes;
            }
        }
        catch (Exception)
        {
            return new List<Episode>();
        }
    }


    private static async Task<bool> IsPublicHttpsAsync(Uri uri)
    {
        if (uri.Scheme != Uri.UriSchemeHttps || uri.Port != 443 || !string.IsNullOrEmpty(uri.UserInfo))
            return false;

        IPAddress[] addresses;
        if (IPAddress.TryParse(uri.DnsSafeHost, out var literal))
            addresses = new[] { literal };
        else
            addresses = await Dns.GetHostAddressesAsync(uri.DnsSafeHost);

        return addresses.Length > 0 && addresses.All(IsPublicAddress);
    }

    private static bool IsPublicAddress(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
            address = address.MapToIPv4();

        if (IPAddress.IsLoopback(address) || address.IsIPv6LinkLocal ||
            address.IsIPv6SiteLocal || address.IsIPv6Multicast)
            return false;

        byte[] bytes = address.GetAddressBytes();
        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            byte a = bytes[0], b = bytes[1];
            return !(a == 0 || a == 10 || a == 127 || a >= 224 ||
                     (a == 169 && b == 254) ||
                     (a == 172 && b >= 16 && b <= 31) ||
                     (a == 192 && b == 168) ||
                     (a == 100 && b >= 64 && b <= 127) ||
                     (a == 198 && (b == 18 || b == 19)));
        }

        if (address.AddressFamily == AddressFamily.InterNetworkV6)
            return (bytes[0] & 0xFE) != 0xFC; // exclude IPv6 unique-local ranges
        return false;
    }

    private static List<Episode> SearchYouTube(string query, string kind)
    {
        // חיפוש מהיר בלי לפתוח כל סרטון, ואז בדיקת דירוג גיל לכל תוצאה במקביל.
        string output = RunYtDlp(new[]
        {
            "--no-warnings", "--no-progress", "--no-call-home",
            "--flat-playlist", "--dump-single-json", "--playlist-end", "10",
            "ytsearch10:" + query
        }, 30000);

        using var document = JsonDocument.Parse(output);
        if (!document.RootElement.TryGetProperty("entries", out var entries))
            return new List<Episode>();

        var candidates = new List<Episode>();
        foreach (var item in entries.EnumerateArray())
        {
            string? videoId = JsonText(item, "id");
            string? title = JsonText(item, "title");
            if (string.IsNullOrWhiteSpace(videoId) || string.IsNullOrWhiteSpace(title) || videoId.Length > 20)
                continue;

            string pageUrl = "https://www.youtube.com/watch?v=" + Uri.EscapeDataString(videoId);
            string image = "";
            if (item.TryGetProperty("thumbnails", out var thumbnails) &&
                thumbnails.ValueKind == JsonValueKind.Array)
            {
                foreach (var thumbnail in thumbnails.EnumerateArray())
                    image = JsonText(thumbnail, "url") ?? image;
            }
            image = image.Length > 1500 ? "" : image;

            candidates.Add(new Episode(
                kind + ":youtube:" + videoId, "youtube", CleanTitle(title),
                JsonText(item, "channel") ?? JsonText(item, "uploader") ?? "YouTube",
                "", "", pageUrl, image,
                JsonInt(item, "duration"), ""));
        }

        // בנגן לילדים מציגים רק תוצאות עם דירוג גיל מפורש עד 12. תוצאה בלי דירוג, או שנכשלה הבדיקה שלה, לא תוצג.
        var approved = new bool[candidates.Count];
        Parallel.For(0, candidates.Count, new ParallelOptions { MaxDegreeOfParallelism = 4 }, i =>
        {
            try
            {
                string age = RunYtDlp(new[]
                {
                    "--no-warnings", "--no-progress", "--no-call-home", "--no-playlist",
                    "--print", "%(age_limit)s", candidates[i].PageUrl
                }, 25000).Trim();
                approved[i] = int.TryParse(age, out int limit) && limit <= 12;
            }
            catch (Exception)
            {
                approved[i] = false;
            }
        });

        return candidates.Where((_, i) => approved[i]).ToList();
    }

    private static string RunYtDlp(IEnumerable<string> arguments, int timeoutMs)
    {
        string executable = Path.Combine(AppContext.BaseDirectory, "yt-dlp.exe");
        if (!File.Exists(executable))
            executable = "yt-dlp";

        var start = new ProcessStartInfo
        {
            FileName = executable,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };
        // YouTube צריך סביבת JavaScript כדי לפענח את הקישורים. deno מצורף לאפליקציה אם קיים; node נבדק אם מותקן במחשב.
        string bundledDeno = Path.Combine(AppContext.BaseDirectory, "deno.exe");
        if (File.Exists(bundledDeno))
        {
            start.ArgumentList.Add("--js-runtimes");
            start.ArgumentList.Add("deno:" + bundledDeno);
        }
        start.ArgumentList.Add("--js-runtimes");
        start.ArgumentList.Add("node");
        foreach (string argument in arguments)
            start.ArgumentList.Add(argument);

        using var process = new Process { StartInfo = start };
        try
        {
            if (!process.Start())
                throw new InvalidOperationException("Could not start yt-dlp.");

            Task<string> stdout = process.StandardOutput.ReadToEndAsync();
            Task<string> stderr = process.StandardError.ReadToEndAsync();
            if (!process.WaitForExit(timeoutMs))
            {
                try { process.Kill(true); } catch { }
                throw new TimeoutException();
            }

            string output = stdout.GetAwaiter().GetResult();
            if (process.ExitCode != 0 || string.IsNullOrWhiteSpace(output))
                throw new InvalidOperationException("yt-dlp did not return a result: " +
                    stderr.GetAwaiter().GetResult().Truncate(400));
            return output;
        }
        catch (Win32Exception ex)
        {
            throw new FileNotFoundException("yt-dlp was not found.", ex);
        }
    }

    public static bool IsYouTubeUrl(string? pageUrl) =>
        Uri.TryCreate(pageUrl, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps &&
        (uri.Host.Equals("youtube.com", StringComparison.OrdinalIgnoreCase) ||
         uri.Host.EndsWith(".youtube.com", StringComparison.OrdinalIgnoreCase) ||
         uri.Host.Equals("youtu.be", StringComparison.OrdinalIgnoreCase));

    // מוריד את האודיו של סרטון יוטיוב לקובץ ומדווח התקדמות (בתים שהורדו, סך הכול).
    // ההורדה נעשית ב-yt-dlp עצמו ולא בדפדפן, כי כתובות ההזרמה של יוטיוב נדחות לעיתים מדפדפן.
    public static void DownloadYouTubeAudio(string pageUrl, string outputFile, Action<long, long> progress)
    {
        if (!IsYouTubeUrl(pageUrl)) throw new InvalidOperationException("bad_url");

        string executable = Path.Combine(AppContext.BaseDirectory, "yt-dlp.exe");
        if (!File.Exists(executable)) executable = "yt-dlp";

        var start = new ProcessStartInfo
        {
            FileName = executable,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };
        string bundledDeno = Path.Combine(AppContext.BaseDirectory, "deno.exe");
        if (File.Exists(bundledDeno))
        {
            start.ArgumentList.Add("--js-runtimes");
            start.ArgumentList.Add("deno:" + bundledDeno);
        }
        start.ArgumentList.Add("--js-runtimes");
        start.ArgumentList.Add("node");
        foreach (string argument in new[]
        {
            "--no-warnings", "--no-call-home", "--no-playlist", "--newline", "--no-part",
            "--max-filesize", "700M",
            "--progress-template", "PRG %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s",
            "-f", "bestaudio[ext=m4a]/bestaudio", "-o", outputFile, pageUrl
        })
            start.ArgumentList.Add(argument);

        using var process = new Process { StartInfo = start };
        try
        {
            if (!process.Start()) throw new InvalidOperationException("Could not start yt-dlp.");
        }
        catch (Win32Exception ex)
        {
            throw new FileNotFoundException("yt-dlp was not found.", ex);
        }

        // לא מחכים לסוף הפלט: תהליכי node שיוצאים מ-yt-dlp יכולים להחזיק את הצינור פתוח ולתקוע את ההורדה.
        Task<string> stderr = process.StandardError.ReadToEndAsync();
        var reader = Task.Run(() =>
        {
            string? line;
            while ((line = process.StandardOutput.ReadLine()) is not null)
                HandleProgressLine(line, progress);
        });
        if (!process.WaitForExit(900000))
        {
            try { process.Kill(true); } catch { }
            throw new TimeoutException();
        }
        reader.Wait(1500);
        if (process.ExitCode != 0 || !File.Exists(outputFile))
            throw new InvalidOperationException("yt-dlp failed: " + (stderr.IsCompleted ? stderr.Result.Truncate(300) : ""));
    }

    private static void HandleProgressLine(string line, Action<long, long> progress)
    {
        {
            if (!line.StartsWith("PRG ", StringComparison.Ordinal)) return;
            string[] parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            long downloaded = parts.Length > 1 && long.TryParse(parts[1], out long d) ? d : 0;
            long total = parts.Length > 2 && long.TryParse(parts[2], out long t) ? t : 0;
            if (total == 0 && parts.Length > 3 && double.TryParse(parts[3], NumberStyles.Float, CultureInfo.InvariantCulture, out double e))
                total = (long)e;
            progress(downloaded, total);
        }
    }

    private static JsonObject ToJson(Episode episode) => new()
    {
        ["id"] = episode.Id,
        ["source"] = episode.Source,
        ["kind"] = episode.Id.StartsWith("song:", StringComparison.Ordinal) ? "song" : "episode",
        ["title"] = episode.Title,
        ["show"] = episode.Show,
        ["description"] = episode.Description,
        ["audioUrl"] = episode.AudioUrl,
        ["pageUrl"] = episode.PageUrl,
        ["image"] = episode.Image,
        ["durationSeconds"] = episode.DurationSeconds,
        ["publishedAt"] = episode.PublishedAt,
        ["season"] = episode.Season,
        ["number"] = episode.Number
    };

    private static bool IsExplicit(XElement item)
    {
        string? value = item.Elements().FirstOrDefault(e => e.Name.LocalName == "explicit")?.Value;
        return value?.Trim().Equals("yes", StringComparison.OrdinalIgnoreCase) == true ||
               value?.Trim().Equals("true", StringComparison.OrdinalIgnoreCase) == true;
    }

    private static string? FindImage(XElement? element)
    {
        if (element is null) return null;
        foreach (var candidate in element.DescendantsAndSelf())
        {
            if (candidate.Name.LocalName is "image" or "thumbnail")
            {
                string? href = candidate.Attribute("href")?.Value ??
                               candidate.Attribute("url")?.Value ??
                               (candidate.Name.LocalName == "image"
                                   ? candidate.Elements().FirstOrDefault(e => e.Name.LocalName == "url")?.Value
                                   : null);
                if (Uri.TryCreate(href, UriKind.Absolute, out var uri) &&
                    (uri.Scheme == "https" || uri.Scheme == "http"))
                    return uri.AbsoluteUri;
            }
        }
        return null;
    }

    private static string? ChildText(XElement element, string localName) =>
        element.Elements().FirstOrDefault(e => e.Name.LocalName == localName)?.Value?.Trim();

    private static string CleanDescription(string value)
    {
        string decoded = System.Net.WebUtility.HtmlDecode(value);
        string clean = Regex.Replace(decoded, "<[^>]+>", " ");
        return Regex.Replace(clean, @"\s+", " ").Trim().Truncate(140);
    }

    private static string CleanTitle(string value) =>
        Regex.Replace(System.Net.WebUtility.HtmlDecode(value), @"\s+", " ").Trim().Truncate(180);

    private static int? ParseNumber(string? value) =>
        int.TryParse(value?.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int n) && n > 0 && n < 10000 ? n : null;

    // סדר הפרקים: לפי עונה ואז לפי מספר פרק. בפיד בלי מספור, מהישן לחדש.
    private static List<Episode> OrderEpisodes(List<Episode> episodes)
    {
        bool numbered = episodes.Any(e => e.Season is not null || e.Number is not null);
        static DateTimeOffset Date(Episode e) =>
            DateTimeOffset.TryParse(e.PublishedAt, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var d)
                ? d : DateTimeOffset.MinValue;
        var ordered = numbered
            ? episodes.OrderBy(e => e.Season ?? int.MaxValue).ThenBy(e => e.Number ?? int.MaxValue).ThenBy(Date)
            : episodes.OrderBy(Date);
        return ordered.Take(100).ToList();
    }

    private static int? ParseDuration(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        // itunes:duration הוא שניות ("1606"), דקות:שניות ("26:46") או שעות:דקות:שניות ("1:02:03").
        // TimeSpan.TryParse היה מפרש "1606" כ-1606 ימים, ולכן מפרקים ידנית.
        string[] parts = value.Trim().Split(':');
        if (parts.Length is < 1 or > 3)
            return null;
        long total = 0;
        foreach (string part in parts)
        {
            if (!double.TryParse(part, NumberStyles.Float, CultureInfo.InvariantCulture, out double number) || number < 0)
                return null;
            total = total * 60 + (long)number;
        }
        return total is > 0 and < 24 * 3600 ? (int)total : null;
    }

    private static int? JsonInt(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property)) return null;
        return property.ValueKind == JsonValueKind.Number && property.TryGetInt32(out int value)
            ? Math.Max(0, value) : null;
    }

    private static string? JsonText(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property)) return null;
        return property.ValueKind == JsonValueKind.String ? property.GetString() : null;
    }

    private static string? GetString(JsonObject? obj, string key) =>
        obj?[key] is JsonValue value && value.TryGetValue(out string? text) ? text : null;

    private static string Normalize(string value) =>
        Regex.Replace(value.Normalize(NormalizationForm.FormKC).ToLowerInvariant(),
            @"[^\p{L}\p{N}]+", " ").Trim();

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    private static JsonObject Ok(string? id, JsonObject data) =>
        new() { ["id"] = id, ["ok"] = true, ["data"] = data };

    private static JsonObject Fail(string? id, string error) =>
        new() { ["id"] = id, ["ok"] = false, ["error"] = error };
}

internal static class PodcastStringExtensions
{
    public static string Truncate(this string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];
}
