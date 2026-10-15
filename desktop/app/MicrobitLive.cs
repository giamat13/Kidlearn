using System.Text;
using System.Text.Json.Nodes;

namespace Kidlearn.Tray;

// The live link between the panel and a micro:bit. The board reports presses as lines of text:
//   "e A 1"  button A went down,  "e A 0"  it came up   (same for B)
// The panel sends fixed commands, which the app writes as text:
//   "o led 2 3 1"  the light at column 2, row 3 goes on (0 = off), in a 5x5 picture
// Nothing else is accepted in either direction: the panel never sends code, only these commands.
internal static class MicrobitLive
{
    public const int MaxLineLength = 32;

    private static readonly HashSet<string> Inputs = new() { "A", "B" };

    // The text of one line from the board, as a panel event, or null when the line is not one of ours
    public static JsonObject? ParseEvent(string line)
    {
        string[] parts = line.Trim().Split(' ');
        if (parts.Length != 3 || parts[0] != "e" || !Inputs.Contains(parts[1]) || parts[2] is not ("0" or "1"))
        {
            return null;
        }

        return new JsonObject
        {
            ["input"] = parts[1],
            ["state"] = parts[2] == "1" ? "down" : "up",
        };
    }

    // The text the board gets for a panel command, or null when the command is not one of the fixed ones.
    // Only these kinds exist: a light, a picture from the micro:bit's own set, a short word, a 5x5 drawing, clear.
    public static string? CommandFor(JsonObject? payload)
    {
        if (payload is null || payload["output"] is not JsonValue output || !output.TryGetValue(out string? name))
        {
            return null;
        }

        switch (name)
        {
            case "led":
                if (!TryCoordinate(payload["x"], out int x) || !TryCoordinate(payload["y"], out int y))
                {
                    return null;
                }
                if (payload["on"] is not JsonValue on || !on.TryGetValue(out bool lit))
                {
                    return null;
                }
                return "o led " + x + " " + y + " " + (lit ? "1" : "0");

            case "icon":
                // The micro:bit's own picture names, for example "heart" -> HEART
                return Text(payload["icon"]) is { } icon && MicrobitProgramBuilder.Icons.TryGetValue(icon, out string? image)
                    ? "o icon " + image["Image.".Length..]
                    : null;

            case "text":
                return Text(payload["word"]) is { } word && MicrobitProgramBuilder.Words.Contains(word)
                    ? "o text " + word
                    : null;

            case "pic":
                return Text(payload["pixels"]) is { } pixels && pixels.Length == 25 && pixels.All(c => c == '0' || c == '1')
                    ? "o pic " + pixels
                    : null;

            case "clear":
                return "o clr";

            default:
                return null;
        }
    }

    private static string? Text(JsonNode? node) =>
        node is JsonValue value && value.TryGetValue(out string? text) ? text : null;

    // Reads lines from the board until the stream ends or the token is cancelled, and reports each panel event.
    // Lines that are too long, or that are not ours, are skipped: the board prints other text too.
    public static void ReadEvents(Stream stream, Action<JsonObject> onEvent, CancellationToken ct)
    {
        var line = new StringBuilder();
        while (!ct.IsCancellationRequested)
        {
            int b;
            try
            {
                b = stream.ReadByte();
            }
            catch (TimeoutException)
            {
                continue;
            }

            if (b < 0)
            {
                return;
            }

            if (b == '\n')
            {
                if (line.Length > 0 && line.Length <= MaxLineLength && ParseEvent(line.ToString()) is { } evt)
                {
                    onEvent(evt);
                }
                line.Clear();
            }
            else if (line.Length <= MaxLineLength)
            {
                line.Append((char)b);
            }
        }
    }

    // Writes one command line to the board
    public static void Send(Stream stream, JsonObject payload)
    {
        string? text = CommandFor(payload);
        if (text is null)
        {
            throw new ArgumentException("bad_command");
        }

        byte[] bytes = Encoding.ASCII.GetBytes(text + "\n");
        stream.Write(bytes, 0, bytes.Length);
        stream.Flush();
    }

    private static bool TryCoordinate(JsonNode? node, out int value)
    {
        value = -1;
        if (node is JsonValue v && v.TryGetValue(out int number) && number >= 0 && number <= 4)
        {
            value = number;
            return true;
        }
        return false;
    }
}
