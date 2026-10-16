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
    // An install can take about 10 seconds (it writes the program in small chunks)
    private static readonly TimeSpan ClientTimeout = TimeSpan.FromSeconds(90);
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
            "microbitStatus" => Ok(id, new JsonObject
            {
                ["connected"] = MicrobitInstaller.FindPort() is not null,
            }),
            "installMicrobit" => InstallMicrobit(id, request),
            "boardLinkStart" => BoardLinkStart(id),
            "boardLinkPoll" => BoardLinkPoll(id),
            "boardLinkShow" => BoardLinkShow(id, request),
            "boardLinkStop" => BoardLinkStop(id),
            _ => Fail(id, "unknown_action"),
        };
    }

    private static readonly object InstallLock = new();

    // The website sends the blocks the child chose, and MicrobitProgramBuilder writes the code from them.
    // The website never sends code.
    private static JsonObject InstallMicrobit(string? id, JsonObject request)
    {
        if (request["payload"] is not JsonObject payload || payload["program"] is not JsonObject program)
        {
            return Fail(id, "no_program");
        }

        string source;
        try
        {
            source = MicrobitProgramBuilder.Build(program);
        }
        catch (ArgumentException ex)
        {
            return Fail(id, ex.Message);
        }

        string? port = MicrobitInstaller.FindPort();
        if (port is null)
        {
            return Fail(id, "no_microbit");
        }

        try
        {
            lock (InstallLock)
            {
                MicrobitLink.Stop(); // the link holds the cable: a send always comes first
                MicrobitInstaller.Install(port, source);
            }
            return Ok(id, new JsonObject { ["installed"] = true, ["port"] = port });
        }
        // Each failure has its own code, so the website can tell the child what to do
        catch (UnauthorizedAccessException ex)
        {
            return Fail(id, "port_busy", ex.Message);       // another program has the cable
        }
        catch (TimeoutException ex)
        {
            return Fail(id, "no_answer", ex.Message);       // the board did not answer
        }
        catch (IOException ex)
        {
            return Fail(id, "port_error", ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Fail(id, "board_error", ex.Message);     // the board refused or reported an error
        }
    }

    // ---- the link between the board on the page and the micro:bit (see MicrobitLink) ----
    // The page starts it while a child plays with the board, asks what the micro:bit said, and sends back what to show.
    private static JsonObject BoardLinkStart(string? id)
    {
        string? error = MicrobitLink.Start();
        return error is null ? Ok(id, new JsonObject { ["linked"] = true }) : Fail(id, error);
    }

    private static JsonObject BoardLinkPoll(string? id)
    {
        List<string>? events = MicrobitLink.Poll();
        var list = new JsonArray();
        foreach (string name in events ?? new List<string>())
        {
            list.Add(name);
        }
        return Ok(id, new JsonObject { ["linked"] = events is not null, ["events"] = list });
    }

    // payload: { "kind": "icon" | "word" | "draw" | "clear", "value": "heart" | "HI" | "0101..." }. The command is built here from fixed names.
    private static JsonObject BoardLinkShow(string? id, JsonObject request)
    {
        if (request["payload"] is not JsonObject payload)
        {
            return Fail(id, "no_payload");
        }

        string? value = GetString(payload, "value");
        string? command = GetString(payload, "kind") switch
        {
            "icon" when value is not null => "I:" + value,
            "word" when value is not null => "W:" + value,
            "draw" when value is not null => "D:" + value,
            "clear" => "C",
            _ => null,
        };
        if (command is null || !MicrobitLinkSession.IsCommand(command))
        {
            return Fail(id, "bad_command");
        }
        return Ok(id, new JsonObject { ["shown"] = MicrobitLink.Show(command) });
    }

    private static JsonObject BoardLinkStop(string? id)
    {
        MicrobitLink.Stop();
        return Ok(id, new JsonObject { ["linked"] = false });
    }

    private static JsonObject Ok(string? id, JsonObject data) =>
        new() { ["id"] = id, ["ok"] = true, ["data"] = data };

    private static JsonObject Fail(string? id, string error, string? detail = null)
    {
        var response = new JsonObject { ["id"] = id, ["ok"] = false, ["error"] = error };
        if (detail is not null)
        {
            response["detail"] = detail;
        }
        return response;
    }

    private static string? GetString(JsonObject obj, string key) =>
        obj[key] is JsonValue value && value.TryGetValue(out string? text) ? text : null;
}
