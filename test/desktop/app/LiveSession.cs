using System.Collections.Concurrent;
using System.IO.Ports;
using System.Text;
using System.Text.Json.Nodes;

namespace Kidlearn.Tray;

// A live session with a micro:bit: the board runs live.py (not the child's main.py) while the page is open.
// The computer sends one line every 50 ms: a queued command, or an empty line as a tick. live.py waits for that
// line with input(), so the board can not stay silent for long: between two lines it reports button presses.
// When the session ends, the board is reset and the child's main.py runs again.
internal sealed class LiveSession : IDisposable
{
    private const int TickMs = 50;

    // live.py: the board's side of the live link. It is written to the board as a file of its own.
    public const string LiveProgram = """
        # Kidlearn live link: the computer and this board talk over the USB cable while this runs.
        # The computer sends one line every 50 ms: a command, or an empty line (a tick). Between lines the board
        # reports button presses.
        from microbit import display, button_a, button_b, Image
        last_a = False
        last_b = False

        def pattern(bits):
            rows = []
            for i in range(0, 25, 5):
                rows.append("".join("9" if c == "1" else "0" for c in bits[i:i + 5]))
            return ":".join(rows)

        while True:
            line = input()
            parts = line.split(" ")
            if len(parts) >= 2 and parts[0] == "o":
                kind = parts[1]
                if kind == "led" and len(parts) == 5:
                    display.set_pixel(int(parts[2]), int(parts[3]), 9 if parts[4] == "1" else 0)
                elif kind == "icon" and len(parts) == 3:
                    display.show(getattr(Image, parts[2]))
                elif kind == "text" and len(parts) == 3:
                    display.scroll(parts[2])
                elif kind == "pic" and len(parts) == 3:
                    display.show(Image(pattern(parts[2])))
                elif kind == "clr" and len(parts) == 2:
                    display.clear()
            a = button_a.is_pressed()
            if a != last_a:
                last_a = a
                print("e A " + ("1" if a else "0"))
            b = button_b.is_pressed()
            if b != last_b:
                last_b = b
                print("e B " + ("1" if b else "0"))

        """;

    private readonly SerialPort _port;
    private readonly Action<JsonObject> _onEvent;
    private readonly ConcurrentQueue<string> _commands = new();
    private CancellationTokenSource? _cts;
    private Task? _reader;
    private Task? _ticker;

    public LiveSession(string port, Action<JsonObject> onEvent)
    {
        _onEvent = onEvent;
        _port = new SerialPort(port, 115200, Parity.None, 8, StopBits.One)
        {
            ReadTimeout = 200,
            WriteTimeout = 3000,
            DtrEnable = true,
        };
    }

    // Stops the child's program, writes live.py, and starts it. Throws when the board does not answer.
    public void Start()
    {
        _port.Open();
        Stream stream = _port.BaseStream;

        Send(stream, new byte[] { 0x03, 0x03 }); // stop the child's program
        Thread.Sleep(300);
        Drain(stream, 500);
        MicrobitInstaller.WriteFile(stream, "live.py", LiveProgram);
        Send(stream, new byte[] { 0x02 }); // leave the raw REPL
        Thread.Sleep(300);
        Drain(stream, 300);
        Send(stream, Encoding.ASCII.GetBytes("import live\r\n"));

        _cts = new CancellationTokenSource();
        _reader = Task.Run(() => MicrobitLive.ReadEvents(stream, _onEvent, _cts.Token));
        _ticker = Task.Run(() => Tick(stream, _cts.Token));
    }

    // Queues a command from the page. Only the fixed commands in MicrobitLive are accepted.
    public void Command(JsonObject payload)
    {
        string? text = MicrobitLive.CommandFor(payload);
        if (text is null)
        {
            throw new ArgumentException("bad_command");
        }
        _commands.Enqueue(text);
    }

    // Ends the session: the live program stops, and the board runs its child's main.py again
    public void Stop()
    {
        _cts?.Cancel();
        try
        {
            Task.WaitAll(new[] { _reader, _ticker }.Where(t => t is not null).Cast<Task>().ToArray(), 2000);
        }
        catch (AggregateException)
        {
            // the tasks end with the cancellation
        }

        if (_port.IsOpen)
        {
            Stream stream = _port.BaseStream;
            Send(stream, new byte[] { 0x03, 0x03 }); // stop live.py
            Thread.Sleep(300);
            Drain(stream, 300);
            Send(stream, Encoding.ASCII.GetBytes("import machine\r\nmachine.reset()\r\n"));
        }
    }

    private void Tick(Stream stream, CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            string line = _commands.TryDequeue(out string? command) ? command : string.Empty;
            Send(stream, Encoding.ASCII.GetBytes(line + "\r\n"));
            Thread.Sleep(TickMs);
        }
    }

    private static void Send(Stream stream, byte[] bytes)
    {
        stream.Write(bytes, 0, bytes.Length);
        stream.Flush();
    }

    private static void Drain(Stream stream, int ms)
    {
        DateTime end = DateTime.UtcNow.AddMilliseconds(ms);
        while (DateTime.UtcNow < end)
        {
            try
            {
                stream.ReadByte();
            }
            catch (TimeoutException)
            {
            }
        }
    }

    public void Dispose()
    {
        Stop();
        _port.Dispose();
        _cts?.Dispose();
    }
}
