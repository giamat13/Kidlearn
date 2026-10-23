using System.Collections.Concurrent;
using System.Text;
using System.Text.RegularExpressions;

namespace Kidlearn.Tray;

// One open cable to a micro:bit that runs a program with a "board" block (see MicrobitProgramBuilder).
// It reads what the micro:bit writes, one line at a time, and keeps only the fixed lines that mean "this story started":
//     KL:buttonA     KL:start     KL:shake     KL:remote:up     ...
// Everything else the micro:bit prints is thrown away. It also writes the few fixed commands the page may send back:
//     I:heart   (a picture)     W:HI   (a word)     D:0101...   (a drawing, 25 characters)     C   (clear the screen)
// The names come from the same tables the blocks use, so a command can only show what a block could show.
// This class knows nothing about serial ports: it works on any Stream, so it can be checked without a micro:bit.
internal sealed class MicrobitLinkSession : IDisposable
{
    private const int MaxQueued = 64;     // events waiting for the page; older ones stay, newer ones are dropped
    private const int MaxLine = 64;       // a longer line is not ours and is thrown away
    private static readonly Regex EventLine = new(@"^KL:([A-Za-z]{2,16})(?::([a-z]{2,6}))?$", RegexOptions.Compiled);
    private static readonly Regex CommandLine = new(@"^(I:[a-z]{2,12}|W:[A-Z]{2,4}|D:[01]{25}|C)$", RegexOptions.Compiled);

    private readonly Stream _stream;
    private readonly ConcurrentQueue<string> _events = new();
    private readonly object _writeGate = new();
    private volatile bool _dead;
    private volatile bool _disposed;

    public MicrobitLinkSession(Stream stream)
    {
        _stream = stream;
        new Thread(ReadLoop) { IsBackground = true, Name = "MicrobitLink" }.Start();
    }

    // False after the cable was pulled out or the session was closed
    public bool Alive => !_dead && !_disposed;

    // The events that arrived since the last call, oldest first: "buttonA", "start", "remote:up" ...
    public List<string> Drain()
    {
        var result = new List<string>();
        while (_events.TryDequeue(out string? item))
        {
            result.Add(item);
        }
        return result;
    }

    // "KL:buttonA" -> "buttonA", "KL:remote:up" -> "remote:up". Anything that is not an event of a story is null.
    public static string? ParseEvent(string line)
    {
        Match match = EventLine.Match(line);
        if (!match.Success)
        {
            return null;
        }

        string name = match.Groups[1].Value;
        string key = match.Groups[2].Value;
        if (!MicrobitProgramBuilder.Events.Contains(name))
        {
            return null;
        }
        // A key goes with the remote, and only with the remote
        if (name == "remote")
        {
            return MicrobitProgramBuilder.RemoteKeys.ContainsKey(key) ? name + ":" + key : null;
        }
        return key.Length == 0 ? name : null;
    }

    // True when the command is one the micro:bit's program understands
    public static bool IsCommand(string command)
    {
        if (!CommandLine.IsMatch(command))
        {
            return false;
        }
        return command[0] switch
        {
            'I' => MicrobitProgramBuilder.Icons.ContainsKey(command[2..]),
            'W' => MicrobitProgramBuilder.Words.Contains(command[2..]),
            _ => true,   // D: (25 characters of 0 and 1) and C were checked by the pattern
        };
    }

    // Sends one command to the micro:bit. False when it is not a known command or the cable is gone.
    public bool Write(string command)
    {
        if (!Alive || !IsCommand(command))
        {
            return false;
        }

        try
        {
            lock (_writeGate)
            {
                byte[] bytes = Encoding.ASCII.GetBytes(command + "\n");
                _stream.Write(bytes, 0, bytes.Length);
                _stream.Flush();
            }
            return true;
        }
        catch (Exception)
        {
            _dead = true;
            return false;
        }
    }

    private void ReadLoop()
    {
        var line = new StringBuilder();
        bool tooLong = false;
        var buffer = new byte[64];
        while (!_disposed)
        {
            int count;
            try
            {
                count = _stream.Read(buffer, 0, buffer.Length);
            }
            catch (TimeoutException)
            {
                continue; // nothing arrived for a moment
            }
            catch (Exception)
            {
                _dead = true;
                return;
            }

            if (count <= 0)
            {
                _dead = true;
                return;
            }

            for (int i = 0; i < count; i++)
            {
                byte b = buffer[i];
                if (b == (byte)'\n')
                {
                    if (!tooLong)
                    {
                        string? name = ParseEvent(line.ToString());
                        if (name is not null && _events.Count < MaxQueued)
                        {
                            _events.Enqueue(name);
                        }
                    }
                    line.Clear();
                    tooLong = false;
                }
                else if (b >= 0x20 && b < 0x7F)
                {
                    if (line.Length < MaxLine)
                    {
                        line.Append((char)b);
                    }
                    else
                    {
                        tooLong = true;
                    }
                }
                // '\r' and any other byte are not part of a line
            }
        }
    }

    public void Dispose()
    {
        _disposed = true;
        try
        {
            _stream.Dispose();
        }
        catch (Exception)
        {
            // already closed
        }
    }
}
