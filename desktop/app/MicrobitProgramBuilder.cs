using System.Text;
using System.Text.Json.Nodes;

namespace Kidlearn.Tray;

// Builds the MicroPython program for the micro:bit from the blocks a child put together on the website.
// The website sends only block names and values, from a fixed list. Every line of code written to the
// board comes from the text below, so no code from the web can reach the micro:bit.
//
// Program: { "scripts": [ script, script, ... ] }     (1 to 6 scripts, 24 actions in all)
// Script:  { "event": "start" | "buttonA" | "buttonB" | "shake",
//            "repeat": true | false,                  (only with "start")
//            "actions": [ { "do": "show", "icon": "heart" },
//                         { "do": "wait", "seconds": 1 },
//                         { "do": "text", "word": "HI" },
//                         { "do": "draw", "pixels": "0101011111..." },   (25 characters: 1 = lit)
//                         { "do": "clear" } ] }      (1 to 12 actions)
// A program in the older form, with "event" and "actions" directly, is one script.
internal static class MicrobitProgramBuilder
{
    public const int MaxActions = 12;
    public const int MaxScripts = 6;
    public const int MaxTotalActions = 24;

    private static readonly Dictionary<string, string> Icons = new()
    {
        ["heart"] = "Image.HEART",
        ["happy"] = "Image.HAPPY",
        ["sad"] = "Image.SAD",
        ["surprised"] = "Image.SURPRISED",
        ["angry"] = "Image.ANGRY",
        ["asleep"] = "Image.ASLEEP",
        ["yes"] = "Image.YES",
        ["no"] = "Image.NO",
        ["up"] = "Image.ARROW_N",
        ["right"] = "Image.ARROW_E",
        ["down"] = "Image.ARROW_S",
        ["left"] = "Image.ARROW_W",
        ["house"] = "Image.HOUSE",
        ["ghost"] = "Image.GHOST",
        ["pacman"] = "Image.PACMAN",
        ["target"] = "Image.TARGET",
        ["rabbit"] = "Image.RABBIT",
        ["duck"] = "Image.DUCK",
        ["butterfly"] = "Image.BUTTERFLY",
        ["snake"] = "Image.SNAKE",
    };

    private static readonly HashSet<string> Words = new() { "HI", "GO", "OK", "YAY", "NO" };
    private static readonly HashSet<string> Events = new() { "start", "buttonA", "buttonB", "shake" };
    private static readonly HashSet<int> WaitMilliseconds = new() { 500, 1000, 2000, 3000 };

    // Returns the program source, or throws ArgumentException with a short reason when the blocks are not allowed
    public static string Build(JsonObject program)
    {
        var scripts = new List<JsonObject>();
        if (program["scripts"] is JsonArray list)
        {
            foreach (JsonNode? node in list)
            {
                scripts.Add(node as JsonObject ?? throw new ArgumentException("bad_script"));
            }
        }
        else
        {
            scripts.Add(program);
        }

        if (scripts.Count < 1 || scripts.Count > MaxScripts)
        {
            throw new ArgumentException("bad_scripts_count");
        }

        var functions = new StringBuilder();
        var once = new StringBuilder();      // start scripts that run one time, in order
        var repeating = new StringBuilder(); // start scripts that run again and again
        var checks = new StringBuilder();    // button and shake scripts, checked in the loop
        int totalActions = 0;

        for (int i = 0; i < scripts.Count; i++)
        {
            (string eventName, bool repeat, List<string> lines) = ParseScript(scripts[i]);
            totalActions += lines.Count;
            if (totalActions > MaxTotalActions)
            {
                throw new ArgumentException("bad_actions_count");
            }

            string name = "script_" + (i + 1);
            functions.Append("def " + name + "():\n");
            foreach (string line in lines)
            {
                functions.Append(line);
            }
            functions.Append("\n");

            switch (eventName)
            {
                case "start" when repeat:
                    repeating.Append("    " + name + "()\n");
                    break;
                case "start":
                    once.Append(name + "()\n");
                    break;
                case "buttonA":
                    checks.Append("    if button_a.was_pressed():\n        " + name + "()\n");
                    break;
                case "buttonB":
                    checks.Append("    if button_b.was_pressed():\n        " + name + "()\n");
                    break;
                default:
                    checks.Append("    if accelerometer.was_gesture('shake'):\n        " + name + "()\n");
                    break;
            }
        }

        var code = new StringBuilder();
        code.Append("# Kidlearn: program built with blocks\n");
        code.Append("from microbit import display, button_a, button_b, accelerometer, sleep, Image\n\n");
        code.Append(functions);
        code.Append("display.clear()\n");
        code.Append(once);
        code.Append("while True:\n");
        code.Append(repeating);
        code.Append(checks);
        code.Append("    sleep(20)\n");
        return code.ToString();
    }

    // One script: its event, whether it repeats, and the lines of its function body
    private static (string EventName, bool Repeat, List<string> Lines) ParseScript(JsonObject script)
    {
        string? eventName = GetString(script, "event");
        if (eventName is null || !Events.Contains(eventName))
        {
            throw new ArgumentException("unknown_event");
        }

        bool repeat = script["repeat"] is JsonValue repeatValue && repeatValue.TryGetValue(out bool flag) && flag;
        if (repeat && eventName != "start")
        {
            throw new ArgumentException("repeat_only_with_start");
        }

        if (script["actions"] is not JsonArray actions || actions.Count < 1 || actions.Count > MaxActions)
        {
            throw new ArgumentException("bad_actions_count");
        }

        var lines = new List<string>();
        foreach (JsonNode? node in actions)
        {
            if (node is not JsonObject action)
            {
                throw new ArgumentException("bad_action");
            }
            lines.Add(ActionLine(action));
        }
        return (eventName, repeat, lines);
    }

    private static string ActionLine(JsonObject action)
    {
        switch (GetString(action, "do"))
        {
            case "show":
            {
                string? icon = GetString(action, "icon");
                if (icon is null || !Icons.TryGetValue(icon, out string? image))
                {
                    throw new ArgumentException("unknown_icon");
                }
                return $"    display.show({image})\n";
            }
            case "wait":
            {
                int ms = GetMilliseconds(action);
                return $"    sleep({ms})\n";
            }
            case "text":
            {
                string? word = GetString(action, "word");
                if (word is null || !Words.Contains(word))
                {
                    throw new ArgumentException("unknown_word");
                }
                return $"    display.scroll('{word}')\n";
            }
            case "draw":
            {
                // The child's own picture: 25 characters, row by row, '1' = lit, '0' = off
                string? pixels = GetString(action, "pixels");
                if (pixels is null || pixels.Length != 25 || pixels.Any(c => c != '0' && c != '1'))
                {
                    throw new ArgumentException("bad_drawing");
                }
                var rows = new List<string>();
                for (int r = 0; r < 5; r++)
                {
                    rows.Add(new string(pixels.Substring(r * 5, 5).Select(c => c == '1' ? '9' : '0').ToArray()));
                }
                return $"    display.show(Image(\"{string.Join(":", rows)}\"))\n";
            }
            case "clear":
                return "    display.clear()\n";
            default:
                throw new ArgumentException("unknown_action");
        }
    }

    // Waits are allowed in half-second steps only: 0.5, 1, 2 or 3 seconds
    private static int GetMilliseconds(JsonObject action)
    {
        if (action["seconds"] is JsonValue value && value.TryGetValue(out double seconds))
        {
            int ms = (int)Math.Round(seconds * 1000);
            if (WaitMilliseconds.Contains(ms))
            {
                return ms;
            }
        }
        throw new ArgumentException("bad_wait");
    }

    private static string? GetString(JsonObject obj, string key) =>
        obj[key] is JsonValue value && value.TryGetValue(out string? text) ? text : null;
}
