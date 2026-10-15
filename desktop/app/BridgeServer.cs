using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.Json.Nodes;
using Kidlearn.Shared;

namespace Kidlearn.Tray;

// שרת מקומי שהמארח (KidlearnHost.exe) פונה אליו עבור הבקשות מהתוסף.
// תהליכון רקע אחד שמחכה לחיבור, בלי חלון ובלי טיימרים.
internal sealed class BridgeServer : IDisposable
{
    private static readonly TimeSpan ClientTimeout = TimeSpan.FromSeconds(5);
    private readonly CancellationTokenSource _cts = new();

    public BridgeServer()
    {
        _ = Task.Run(() => RunAsync(_cts.Token));
    }

    private static async Task RunAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await using var pipe = NamedPipeServerStreamAcl.Create(
                    BridgeProtocol.PipeName,
                    PipeDirection.InOut,
                    1,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous,
                    0,
                    0,
                    CreateOwnerOnlySecurity());

                await pipe.WaitForConnectionAsync(ct);
                await HandleClientAsync(pipe, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
            catch (Exception)
            {
                // חיבור שנפל או הודעה פגומה: ממתינים רגע וממשיכים להאזין
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(1), ct);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }
    }

    private static async Task HandleClientAsync(Stream pipe, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(ClientTimeout);

        JsonObject? request = await Framing.ReadAsync(pipe, timeout.Token);
        if (request is null)
        {
            return;
        }

        await Framing.WriteAsync(pipe, BridgeActions.Handle(request), timeout.Token);
    }

    // רק המשתמש הנוכחי יכול להתחבר. בלי זה, משתמש אחר במחשב יוכל לשלוח בקשות לאפליקציה שלך
    private static PipeSecurity CreateOwnerOnlySecurity()
    {
        var security = new PipeSecurity();
        using var identity = WindowsIdentity.GetCurrent();
        security.AddAccessRule(new PipeAccessRule(identity.User!, PipeAccessRights.FullControl, AccessControlType.Allow));
        return security;
    }

    public void Dispose()
    {
        _cts.Cancel();
    }
}

// הפעולות שהאתר מורשה לבקש. כל פעולה חדשה היא מקרה נוסף כאן, ורק כאן.
// פעולה שלא ברשימה נדחית, כך שאתר לא יכול להפעיל דבר שלא אישרנו במפורש.
internal static class BridgeActions
{
    public static JsonObject Handle(JsonObject request)
    {
        string? id = GetString(request, "id");
        string? action = GetString(request, "action");

        return action switch
        {
            "ping" => Ok(id, new JsonObject
            {
                ["app"] = "Kidlearn",
                ["version"] = Application.ProductVersion,
                ["status"] = "running",
            }),
            _ => Fail(id, "unknown_action"),
        };
    }

    private static JsonObject Ok(string? id, JsonObject data) =>
        new() { ["id"] = id, ["ok"] = true, ["data"] = data };

    private static JsonObject Fail(string? id, string error) =>
        new() { ["id"] = id, ["ok"] = false, ["error"] = error };

    private static string? GetString(JsonObject obj, string key) =>
        obj[key] is JsonValue value && value.TryGetValue(out string? text) ? text : null;
}
