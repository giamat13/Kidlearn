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
        string AudioUrl, string PageUrl, string Image, int? DurationSeconds, string PublishedAt);

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

        using var gate = new SemaphoreSlim(8);
        var feedTasks = shows.Select(async show =>
        {
            await gate.WaitAsync();
            try { return await ReadFeedAsync(show); }
            finally { gate.Release(); }
        }).ToArray();

        // Run YouTube discovery alongside RSS retrieval so the sources do not add their
        // worst-case timeouts sequentially to the Native Messaging request.
        Task<List<Episode>> youtubeTask = Task.Run(() => SearchYouTube(query));
        var rssEpisodes = Task.WhenAll(feedTasks).GetAwaiter().GetResult()
            .SelectMany(items => items)
            .ToList();

        var youtubeEpisodes = new List<Episode>();
        string? youtubeWarning = null;
        try
        {
            youtubeEpisodes = youtubeTask.GetAwaiter().GetResult();
        }
        catch (FileNotFoundException)
        {
            youtubeWarning = "yt_dlp_missing";
        }
        catch (Exception)
        {
            youtubeWarning = "youtube_unavailable";
        }

        // משאירים מקום גם לתוצאות YouTube, במקום שפידים פופולריים ימלאו את כל הרשימה.
        var combined = Deduplicate(rssEpisodes.Take(18).ToList(), youtubeEpisodes).Take(MaxResults).ToList();
        var results = new JsonArray();
        foreach (var episode in combined)
            results.Add(ToJson(episode));

        var response = Ok(id, new JsonObject
        {
            ["results"] = results,
            ["count"] = combined.Count,
            ["rssCount"] = combined.Count(e => e.Source == "rss"),
            ["youtubeCount"] = combined.Count(e => e.Source == "youtube"),
            ["youtubeAvailable"] = youtubeWarning is null,
            ["warning"] = youtubeWarning
        });
        return response;
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

    private static async Task<List<Episode>> ReadFeedAsync(PodcastShow show)
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

            foreach (var item in root.Descendants().Where(e => e.Name.LocalName == "item").Take(30))
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
                    published));
                if (episodes.Count >= 12)
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

    private static List<Episode> SearchYouTube(string query)
    {
        string output = RunYtDlp(new[]
        {
            "--no-warnings", "--no-progress", "--no-call-home",
            "--dump-single-json", "--playlist-end", "12",
            "ytsearch12:" + query
        }, 45000);

        using var document = JsonDocument.Parse(output);
        if (!document.RootElement.TryGetProperty("entries", out var entries))
            return new List<Episode>();

        var episodes = new List<Episode>();
        foreach (var item in entries.EnumerateArray())
        {
            string? videoId = JsonText(item, "id");
            string? title = JsonText(item, "title");
            if (string.IsNullOrWhiteSpace(videoId) || string.IsNullOrWhiteSpace(title))
                continue;

            string? pageUrl = JsonText(item, "webpage_url");
            if (string.IsNullOrWhiteSpace(pageUrl))
                pageUrl = "https://www.youtube.com/watch?v=" + Uri.EscapeDataString(videoId);

            string image = "";
            if (item.TryGetProperty("thumbnails", out var thumbnails) &&
                thumbnails.ValueKind == JsonValueKind.Array)
            {
                foreach (var thumbnail in thumbnails.EnumerateArray())
                    image = JsonText(thumbnail, "url") ?? image;
            }
            image = image.Length > 1500 ? "" : image;

            // בנגן לילדים מציגים רק תוצאות של-YouTube יש דירוג גיל מפורש שמתאים עד גיל 12.
            // תוצאה ללא דירוג ידוע לא תוצג.
            int? ageLimit = JsonInt(item, "age_limit");
            if (ageLimit is null || ageLimit > 12)
                continue;

            episodes.Add(new Episode(
                "youtube:" + videoId, "youtube", CleanTitle(title),
                JsonText(item, "channel") ?? JsonText(item, "uploader") ?? "YouTube",
                "", "", pageUrl, image,
                JsonInt(item, "duration"), ""));
        }
        return episodes;
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

    private static List<Episode> Deduplicate(List<Episode> rss, List<Episode> youtube)
    {
        var accepted = new List<Episode>();
        var sourceKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var episode in rss.Concat(youtube))
        {
            string title = Normalize(episode.Title);
            string show = Normalize(episode.Show);
            if (title.Length == 0)
                continue;

            string sourceKey = episode.Source + "|" + show + "|" + title;
            if (!sourceKeys.Add(sourceKey))
                continue;

            bool crossSourceDuplicate = accepted.Any(existing =>
            {
                if (existing.Source == episode.Source)
                    return false;
                string existingTitle = Normalize(existing.Title);
                if (title != existingTitle || title.Length < 18)
                    return false;
                if (episode.DurationSeconds is int a && existing.DurationSeconds is int b)
                    return Math.Abs(a - b) <= Math.Max(25, Math.Max(a, b) * 0.08);
                return title.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length >= 4;
            });

            if (!crossSourceDuplicate)
                accepted.Add(episode);
        }
        return accepted;
    }

    private static JsonObject ToJson(Episode episode) => new()
    {
        ["id"] = episode.Id,
        ["source"] = episode.Source,
        ["title"] = episode.Title,
        ["show"] = episode.Show,
        ["description"] = episode.Description,
        ["audioUrl"] = episode.AudioUrl,
        ["pageUrl"] = episode.PageUrl,
        ["image"] = episode.Image,
        ["durationSeconds"] = episode.DurationSeconds,
        ["publishedAt"] = episode.PublishedAt
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
        return Regex.Replace(clean, @"\s+", " ").Trim().Truncate(260);
    }

    private static string CleanTitle(string value) =>
        Regex.Replace(System.Net.WebUtility.HtmlDecode(value), @"\s+", " ").Trim().Truncate(180);

    private static int? ParseDuration(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (TimeSpan.TryParse(value, CultureInfo.InvariantCulture, out var time))
            return Math.Max(0, (int)time.TotalSeconds);
        if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out int seconds))
            return Math.Max(0, seconds);
        return null;
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
