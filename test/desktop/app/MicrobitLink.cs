using System.IO.Ports;

namespace Kidlearn.Tray;

// The live link between the board on the web page and the micro:bit on the cable.
//
// While a child plays with "my board", the page starts the link and asks every moment what the micro:bit said
// (a story started: it started, A, B, a shake ...). The page also sends back what to show on the micro:bit's screen.
// The cable is held only while the page keeps asking: if it stops for a few seconds (the tab was closed, the child
// went to another page) the link closes itself, so the cable is free for a send. A send closes the link first.
internal static class MicrobitLink
{
    private const int IdleSeconds = 8;
    private const int BaudRate = 115200;

    private static readonly object Gate = new();
    private static SerialPort? _port;
    private static MicrobitLinkSession? _session;
    private static long _lastAsked;          // Environment.TickCount64 of the page's last question
    private static System.Threading.Timer? _watch;

    // Opens the cable. Returns null when the link is open, or the reason it is not
    // (the same words the send uses: no_microbit, port_busy, port_error).
    public static string? Start()
    {
        lock (Gate)
        {
            if (_session is { Alive: true })
            {
                Touch();
                return null;
            }
            CloseLocked();

            string? name = MicrobitInstaller.FindPort();
            if (name is null)
            {
                return "no_microbit";
            }

            try
            {
                _port = new SerialPort(name, BaudRate, Parity.None, 8, StopBits.One)
                {
                    ReadTimeout = 250,
                    WriteTimeout = 1000,
                    DtrEnable = true,
                };
                _port.Open();
                _session = new MicrobitLinkSession(_port.BaseStream);
            }
            catch (UnauthorizedAccessException)
            {
                CloseLocked();
                return "port_busy";       // another program has the cable
            }
            catch (Exception ex) when (ex is IOException or InvalidOperationException or ArgumentException)
            {
                CloseLocked();
                return "port_error";
            }

            Touch();
            _watch ??= new System.Threading.Timer(_ => CloseIfIdle(), null, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(2));
            return null;
        }
    }

    // What the micro:bit said since the last question. Null means there is no link (it was closed, or the cable was pulled).
    public static List<string>? Poll()
    {
        lock (Gate)
        {
            if (_session is not { Alive: true })
            {
                CloseLocked();
                return null;
            }
            Touch();
            return _session.Drain();
        }
    }

    // One fixed command for the micro:bit's screen (see MicrobitLinkSession.IsCommand)
    public static bool Show(string command)
    {
        lock (Gate)
        {
            if (_session is not { Alive: true })
            {
                return false;
            }
            Touch();
            return _session.Write(command);
        }
    }

    public static void Stop()
    {
        lock (Gate)
        {
            CloseLocked();
        }
    }

    private static void Touch() => _lastAsked = Environment.TickCount64;

    private static void CloseIfIdle()
    {
        lock (Gate)
        {
            if (_session is not null && Environment.TickCount64 - _lastAsked > IdleSeconds * 1000L)
            {
                CloseLocked();
            }
        }
    }

    private static void CloseLocked()
    {
        _session?.Dispose();
        _session = null;
        try
        {
            _port?.Dispose();
        }
        catch (Exception)
        {
            // the cable may already be gone
        }
        _port = null;
    }
}
