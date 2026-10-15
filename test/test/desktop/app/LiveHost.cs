using System.IO.Ports;
using System.Text.Json.Nodes;

namespace Kidlearn.Tray;

// The one live session with a micro:bit that the page can use. The page starts it, asks for the board's presses
// about every 150 ms, and sends commands. When the page stops asking for 8 seconds (closed, or lost), the session
// ends and the board runs the child's main.py again.
internal static class LiveHost
{
    private const int MaxQueued = 200;
    private static readonly TimeSpan IdleLimit = TimeSpan.FromSeconds(8);
    private static readonly object Lock = new();
    private static readonly Queue<JsonObject> Queued = new();
    private static LiveSession? _session;
    private static DateTime _lastAsk = DateTime.UtcNow;
    private static readonly System.Threading.Timer Watch = new(_ => EndIfIdle(), null, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(1));

    public static bool IsRunning
    {
        get
        {
            lock (Lock)
            {
                return _session is not null;
            }
        }
    }

    // Returns null on success, or the reason the session did not start
    public static string? Start(out JsonObject data)
    {
        lock (Lock)
        {
            data = new JsonObject();
            if (_session is not null)
            {
                Touch();
                return null;
            }

            string? port = MicrobitInstaller.FindPort();
            if (port is null)
            {
                return "no_microbit";
            }

            var session = new LiveSession(port, Enqueue);
            try
            {
                session.Start();
            }
            catch (UnauthorizedAccessException)
            {
                session.Dispose();
                return "port_busy";
            }
            catch (IOException)
            {
                session.Dispose();
                return "port_error";
            }
            catch (TimeoutException)
            {
                session.Dispose();
                return "no_answer";
            }
            catch (InvalidOperationException)
            {
                session.Dispose();
                return "board_error";
            }

            _session = session;
            data["port"] = port;
            Touch();
            return null;
        }
    }

    // Returns null when the command was sent, or the reason it was not
    public static string? Command(JsonObject payload)
    {
        lock (Lock)
        {
            Touch();
            if (_session is null)
            {
                return "not_running";
            }

            try
            {
                _session.Command(payload);
                return null;
            }
            catch (ArgumentException)
            {
                return "bad_command";
            }
        }
    }

    // The presses since the last time the page asked
    public static JsonObject TakeEvents()
    {
        lock (Lock)
        {
            Touch();
            var events = new JsonArray();
            while (Queued.Count > 0)
            {
                events.Add(Queued.Dequeue());
            }
            return new JsonObject { ["events"] = events };
        }
    }

    public static void Stop()
    {
        LiveSession? ending;
        lock (Lock)
        {
            ending = _session;
            _session = null;
            Queued.Clear();
        }

        // Outside the lock: the session's reader may be waiting for the lock to pass on a press
        ending?.Dispose();
    }

    private static void Enqueue(JsonObject evt)
    {
        lock (Lock)
        {
            if (Queued.Count >= MaxQueued)
            {
                Queued.Dequeue();
            }
            Queued.Enqueue(evt);
        }
    }

    private static void Touch()
    {
        _lastAsk = DateTime.UtcNow;
    }

    private static void EndIfIdle()
    {
        bool idle;
        lock (Lock)
        {
            idle = _session is not null && DateTime.UtcNow - _lastAsk > IdleLimit;
        }

        if (idle)
        {
            Stop();
        }
    }
}
