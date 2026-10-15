using System.IO.Pipes;
using System.Text.Json.Nodes;
using Kidlearn.Shared;

namespace Kidlearn.Host;

// המארח ש-Chrome מפעיל לכל בקשה מהתוסף. הוא לא מחליט כלום:
// מעביר את הבקשה לאפליקציה שרצה ברקע (דרך named pipe), ומחזיר לתוסף את התשובה.
// Chrome שולח את מזהה התוסף הקורא כארגומנט הראשון, והמארח מסרב לכל מזהה אחר.
internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        if (args.Length < 1 || args[0] != BridgeProtocol.ExtensionOrigin)
        {
            return 1;
        }

        // ה-stdout משמש רק לתשובה ל-Chrome, בשום מקרה לא מדפיסים אליו דבר אחר
        using var stdin = Console.OpenStandardInput();
        using var stdout = Console.OpenStandardOutput();
        // A micro:bit install can take about 10 seconds, so the host waits longer than that
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(90));

        JsonObject? request = await Framing.ReadAsync(stdin, cts.Token);
        if (request is null)
        {
            return 1;
        }

        JsonObject response = await ForwardAsync(request, cts.Token);
        await Framing.WriteAsync(stdout, response, cts.Token);
        return 0;
    }

    private static async Task<JsonObject> ForwardAsync(JsonObject request, CancellationToken ct)
    {
        string? id = request["id"] is JsonValue value && value.TryGetValue(out string? text) ? text : null;

        using var pipe = await ConnectAsync(ct);
        if (pipe is null)
        {
            // האפליקציה לא רצה (למשל אחרי "יציאה" מהתפריט)
            return Fail(id, "app_not_running");
        }

        await Framing.WriteAsync(pipe, request, ct);
        JsonObject? reply = await Framing.ReadAsync(pipe, ct);
        return reply ?? Fail(id, "no_reply");
    }

    // האפליקציה עשויה להיות באמצע פתיחה או בין שני חיבורים, לכן מנסים כמה פעמים לזמן קצר
    private static async Task<NamedPipeClientStream?> ConnectAsync(CancellationToken ct)
    {
        for (int attempt = 0; attempt < 5; attempt++)
        {
            var pipe = new NamedPipeClientStream(".", BridgeProtocol.PipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            try
            {
                await pipe.ConnectAsync(500, ct);
                return pipe;
            }
            catch (Exception ex) when (ex is IOException or TimeoutException)
            {
                pipe.Dispose();
                await Task.Delay(100, ct);
            }
        }
        return null;
    }

    private static JsonObject Fail(string? id, string error) =>
        new() { ["id"] = id, ["ok"] = false, ["error"] = error };
}
