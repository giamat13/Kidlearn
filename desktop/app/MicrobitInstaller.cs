using System.IO.Ports;
using System.Text;
using Microsoft.Win32;

namespace Kidlearn.Tray;

// Copies a MicroPython program to a micro:bit over USB serial (the MicroPython "raw REPL"),
// then resets the board. The micro:bit runs main.py after every reset, so the game starts by itself.
internal static class MicrobitInstaller
{
    private const string UsbKeyPrefix = "VID_0D28&PID_0204"; // micro:bit USB vendor and product id
    private const int BaudRate = 115200;
    private const int ChunkBytes = 64;
    private const int ReplyTimeoutMs = 3000;
    private const int DrainMs = 300;   // how long to throw away what the board prints before a command
    private const int Attempts = 3;    // a failed write is tried again: it starts over from the beginning each time

    // The serial port of a connected micro:bit, or null when none is plugged in.
    public static string? FindPort()
    {
        string[] connected = SerialPort.GetPortNames();
        using var usb = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Enum\USB");
        if (usb == null)
        {
            return null;
        }

        foreach (string device in usb.GetSubKeyNames())
        {
            if (!device.StartsWith(UsbKeyPrefix, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            using var deviceKey = usb.OpenSubKey(device);
            if (deviceKey == null)
            {
                continue;
            }

            foreach (string instance in deviceKey.GetSubKeyNames())
            {
                // Old entries stay in the registry after unplugging, so the port must also be present now
                using var parameters = deviceKey.OpenSubKey(instance + @"\Device Parameters");
                if (parameters?.GetValue("PortName") is string port && connected.Contains(port))
                {
                    return port;
                }
            }
        }

        return null;
    }

    // Writes source to main.py on the micro:bit on this port, then resets it.
    public static void Install(string port, string source)
    {
        for (int attempt = 1; ; attempt++)
        {
            try
            {
                using var serial = new SerialPort(port, BaudRate, Parity.None, 8, StopBits.One)
                {
                    ReadTimeout = 200,
                    WriteTimeout = ReplyTimeoutMs,
                    DtrEnable = true,
                };
                serial.Open();
                WriteProgram(serial.BaseStream, source);
                return;
            }
            catch (Exception ex) when (attempt < Attempts && (ex is TimeoutException or IOException or InvalidOperationException))
            {
                // The board may still be stopping its program or resetting: wait a moment and start again
                Thread.Sleep(700);
            }
        }
    }

    public static void WriteProgram(Stream stream, string source)
    {
        EnterRawRepl(stream);
        // A send starts fresh: remove the previous app programs before writing the new main.py.
        Exec(stream, "import os\nfor name in ('main.py', 'live.py'):\n if name in os.listdir():\n  os.remove(name)");
        WriteFileInRawRepl(stream, "main.py", source);

        // The board resets as soon as it runs this, so no reply is read. The port may drop: that is expected.
        try
        {
            Send(stream, Encoding.UTF8.GetBytes("import machine\nmachine.reset()\n"));
            Send(stream, new byte[] { 0x04 });
        }
        catch (IOException)
        {
        }
    }

    // Writes source to a file on the board and leaves the board in the raw REPL. main.py is the program that runs
    // at every reset; live.py is only started on purpose, so the saved program is not replaced by it.
    public static void WriteFile(Stream stream, string fileName, string source)
    {
        EnterRawRepl(stream);
        WriteFileInRawRepl(stream, fileName, source);
    }

    private static void WriteFileInRawRepl(Stream stream, string fileName, string source)
    {
        byte[] data = Encoding.UTF8.GetBytes(source);
        Exec(stream, "f = open('" + fileName + "', 'wb')\nw = f.write");
        for (int offset = 0; offset < data.Length; offset += ChunkBytes)
        {
            int count = Math.Min(ChunkBytes, data.Length - offset);
            Exec(stream, "w(" + BytesLiteral(data, offset, count) + ")");
        }
        Exec(stream, "f.close()");
    }

    private static void EnterRawRepl(Stream stream)
    {
        Send(stream, new byte[] { 0x03, 0x03 }); // Ctrl-C twice: stop a running program
        Thread.Sleep(100);
        Drain(stream);                            // throw away what the stopped program printed
        Send(stream, new byte[] { 0x01 });       // Ctrl-A: raw REPL
        ReadUntil(stream, text => text.Contains("raw REPL; CTRL-B to exit\r\n>"));
    }

    // Reads and drops whatever the board sends for a moment, so the replies that follow start clean
    private static void Drain(Stream stream)
    {
        DateTime end = DateTime.UtcNow.AddMilliseconds(DrainMs);
        while (DateTime.UtcNow < end)
        {
            try
            {
                stream.ReadByte();
            }
            catch (TimeoutException)
            {
                // nothing more to read right now
            }
        }
    }

    // Runs code in raw REPL mode and returns what it printed. Throws when the code raised an error.
    private static string Exec(Stream stream, string code)
    {
        Send(stream, Encoding.UTF8.GetBytes(code));
        Send(stream, new byte[] { 0x04 }); // Ctrl-D: run it

        // Reply: "OK" + stdout + Ctrl-D + stderr + Ctrl-D + ">". Text before the "OK" was left over from an
        // earlier command (for example a KeyboardInterrupt message), so it is skipped.
        string reply = ReadUntil(stream, text => text.Count(c => c == '\x04') >= 2 && text.EndsWith('>'));
        int ok = reply.IndexOf("OK", StringComparison.Ordinal);
        if (ok < 0)
        {
            throw new InvalidOperationException("micro:bit refused the command");
        }

        string[] parts = reply[(ok + 2)..].Split('\x04');
        string error = parts.Length > 1 ? parts[1].Trim() : "";
        if (error.Length > 0)
        {
            throw new InvalidOperationException(error);
        }
        return parts[0];
    }

    private static string ReadUntil(Stream stream, Func<string, bool> done)
    {
        var text = new StringBuilder();
        DateTime deadline = DateTime.UtcNow.AddMilliseconds(ReplyTimeoutMs);
        while (!done(text.ToString()))
        {
            if (DateTime.UtcNow > deadline)
            {
                throw new TimeoutException("micro:bit did not answer");
            }

            int b;
            try
            {
                b = stream.ReadByte();
            }
            catch (TimeoutException)
            {
                continue;
            }

            if (b >= 0)
            {
                text.Append((char)b);
            }
        }
        return text.ToString();
    }

    private static void Send(Stream stream, byte[] bytes)
    {
        stream.Write(bytes, 0, bytes.Length);
        stream.Flush();
    }

    // A b'...' literal with every byte escaped, so any chunk of the file survives the REPL unchanged
    private static string BytesLiteral(byte[] data, int offset, int count)
    {
        var sb = new StringBuilder("b'");
        for (int i = offset; i < offset + count; i++)
        {
            byte b = data[i];
            switch (b)
            {
                case (byte)'\\': sb.Append("\\\\"); break;
                case (byte)'\'': sb.Append("\\'"); break;
                case (byte)'\n': sb.Append("\\n"); break;
                case (byte)'\r': sb.Append("\\r"); break;
                case (byte)'\t': sb.Append("\\t"); break;
                default:
                    if (b >= 0x20 && b < 0x7F)
                    {
                        sb.Append((char)b);
                    }
                    else
                    {
                        sb.Append("\\x").Append(b.ToString("x2"));
                    }
                    break;
            }
        }
        return sb.Append('\'').ToString();
    }
}
