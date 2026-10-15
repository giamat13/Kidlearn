using System.Text;
using System.Text.Json.Nodes;

namespace Kidlearn.Tray;

// Builds the MicroPython program for the micro:bit from the blocks a child put together on the website.
// The website sends only block names and values, from a fixed list. Every line of code written to the
// board comes from the text below, so no code from the web can reach the micro:bit.
//
// Program: { "scripts": [ script, script, ... ] }     (1 to 6 scripts, 24 actions in all)
// Script:  { "event": "start" | "buttonA" | "buttonB" | "shake" | "remote" | "faceDown" | "abPress" |
//                     "tiltLeft" | "tiltRight" | "tiltForward" | "tiltBack" | "logoTouch",
//            "repeat": true | false,                  (only with "start")
//            "key": "up" | "down" | "left" | "right" | "zero" ... "nine",   (only with "remote": a key of the Yahboom remote)
//            "actions": [ { "do": "show", "icon": "heart" },
//                         { "do": "wait", "seconds": 1 },
//                         { "do": "text", "word": "HI" },
//                         { "do": "draw", "pixels": "0101011111..." },   (25 characters: 1 = lit)
//                         { "do": "drive", "dir": "forward" },           (Tiny:bit car: forward, back, left, right, spinLeft, spinRight)
//                         { "do": "stop" },                              (Tiny:bit car: stop)
//                         { "do": "clear" } ] }      (1 to 12 actions)
// A program in the older form, with "event" and "actions" directly, is one script.
internal static class MicrobitProgramBuilder
{
    public const int MaxActions = 12;
    public const int MaxScripts = 6;
    public const int MaxTotalActions = 24;

    private const int CarSpeed = 150; // wheel speed for the Tiny:bit car, 0 to 255. The website cannot change it.

    internal static readonly Dictionary<string, string> Icons = new()
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

    internal static readonly HashSet<string> Words = new() { "HI", "GO", "OK", "YAY", "NO" };
    private static readonly HashSet<string> Events = new()
    {
        "start", "buttonA", "buttonB", "shake", "remote",
        "faceDown", "abPress", "tiltLeft", "tiltRight", "tiltForward", "tiltBack", "logoTouch",
    };
    private static readonly HashSet<int> WaitMilliseconds = new() { 500, 1000, 2000, 3000 };

    // The four motor values for each direction: left wheel forward, left wheel back, right wheel forward, right wheel back.
    // From the Tiny-bitLib MakeCode extension (YahboomTechnology/Tiny-bitLib), which sends them to I2C address 0x01.
    private static readonly Dictionary<string, (int Lf, int Lb, int Rf, int Rb)> CarMoves = new()
    {
        ["forward"] = (CarSpeed, 0, CarSpeed, 0),
        ["back"] = (0, CarSpeed, 0, CarSpeed),
        ["left"] = (0, 0, CarSpeed, 0),
        ["right"] = (CarSpeed, 0, 0, 0),
        ["spinLeft"] = (0, CarSpeed, CarSpeed, 0),
        ["spinRight"] = (CarSpeed, 0, 0, CarSpeed),
    };

    private static readonly (int Lf, int Lb, int Rf, int Rb) Stopped = (0, 0, 0, 0);

    // The keys of the Yahboom remote a script can start with, and the code each key sends.
    // From the Yahboom_IR MakeCode extension (YahboomTechnology/Yahboom_IR, enum RemoteButton).
    private static readonly Dictionary<string, int> RemoteKeys = new()
    {
        ["up"] = 0x01,
        ["down"] = 0x09,
        ["left"] = 0x04,
        ["right"] = 0x06,
        ["zero"] = 0x0D,
        ["one"] = 0x10,
        ["two"] = 0x11,
        ["three"] = 0x12,
        ["four"] = 0x14,
        ["five"] = 0x15,
        ["six"] = 0x16,
        ["seven"] = 0x18,
        ["eight"] = 0x19,
        ["nine"] = 0x1A,
    };

    // The IR receiver on pin 8 (the Tiny:bit board), read as an NEC signal. ir_key() returns the key code, or -1.
    // Each bit is a short burst of light and then a space: 0.56 ms for a 0, 1.69 ms for a 1.
    private const string IrFunctions = """
        # Yahboom IR receiver on pin 8, NEC signal. ir_key() returns the key code, or -1 when no key was pressed.
        # The receiver reads 0 while a burst of infrared light arrives and 1 between bursts.
        def held(level, limit):
            # Microseconds the pin stays at this level, or -1 when it changes later than the limit
            start = utime.ticks_us()
            while pin8.read_digital() == level:
                if utime.ticks_diff(utime.ticks_us(), start) > limit:
                    return -1
            return utime.ticks_diff(utime.ticks_us(), start)

        def ir_key():
            if held(1, 60000) < 0 or not 7000 < held(0, 12000) < 11000:  # leader burst, about 9 ms
                return -1
            if not 3500 < held(1, 6000) < 5500:                         # leader space, about 4.5 ms
                return -1
            key = 0
            for bit in range(32):                                       # address, inverse address, key, inverse key
                if held(0, 2000) < 0:                                   # each bit starts with a burst of about 0.56 ms
                    return -1
                space = held(1, 3000)                                   # 0.56 ms for a 0 bit, 1.69 ms for a 1 bit
                if space < 0:
                    return -1
                if space > 1100 and 16 <= bit < 24:
                    key |= 1 << (bit - 16)
            return key


        """;

    // The function that sends a car command. Without a car the write fails, and the error is ignored
    // so the screen and buttons keep working.
    private const string CarFunction =
        "# Tiny:bit car: 2 = motor command, then left forward, left back, right forward, right back\n" +
        "def car(a, b, c, d):\n" +
        "    try:\n" +
        "        i2c.write(0x01, bytes([2, a, b, c, d]))\n" +
        "    except OSError:\n" +
        "        pass\n\n";

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
        bool usesCar = false;                // a drive or stop block somewhere: the car code is added
        bool usesRemote = false;             // a remote script somewhere: the IR code is added and read in the loop
        var abScripts = new List<string>();    // scripts that start when A and B are pressed together
        var logoScripts = new List<string>();  // scripts that start when the logo is touched (micro:bit V2)

        for (int i = 0; i < scripts.Count; i++)
        {
            ParsedScript parsed = ParseScript(scripts[i]);
            usesCar |= parsed.UsesCar;
            usesRemote |= parsed.EventName == "remote";
            totalActions += parsed.Lines.Count;
            if (totalActions > MaxTotalActions)
            {
                throw new ArgumentException("bad_actions_count");
            }

            string name = "script_" + (i + 1);
            functions.Append("def " + name + "():\n");
            foreach (string line in parsed.Lines)
            {
                functions.Append(line);
            }
            if (parsed.Drives)
            {
                // A script that drove the car always stops it at the end, so the car never keeps going on its own
                functions.Append("    " + CarCall(Stopped) + "\n");
            }
            functions.Append("\n");

            switch (parsed.EventName)
            {
                case "start" when parsed.Repeat:
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
                case "remote":
                    checks.Append($"    if key == {parsed.KeyCode}:\n        {name}()\n");
                    break;
                case "faceDown":
                    checks.Append(GestureCheck("face down", name));
                    break;
                case "tiltLeft":
                    checks.Append(GestureCheck("left", name));
                    break;
                case "tiltRight":
                    checks.Append(GestureCheck("right", name));
                    break;
                case "tiltForward":
                    checks.Append(GestureCheck("up", name)); // the micro:bit calls a tilt forward "up"
                    break;
                case "tiltBack":
                    checks.Append(GestureCheck("down", name)); // and a tilt back "down"
                    break;
                case "abPress":
                    abScripts.Add(name);
                    break;
                case "logoTouch":
                    logoScripts.Add(name);
                    break;
                default:
                    checks.Append("    if accelerometer.was_gesture('shake'):\n        " + name + "()\n");
                    break;
            }
        }

        // Blocks that start at the moment something happens: A and B pressed together, a touch on the logo.
        // The state is read once per loop, so a script starts once when the thing begins, and not again while it lasts.
        var edges = new StringBuilder();
        if (abScripts.Count > 0)
        {
            edges.Append("    ab_now = button_a.is_pressed() and button_b.is_pressed()\n");
            edges.Append("    if ab_now and not ab_was:\n");
            foreach (string script in abScripts)
            {
                edges.Append("        " + script + "()\n");
            }
            edges.Append("    ab_was = ab_now\n");
        }
        if (logoScripts.Count > 0)
        {
            edges.Append("    logo_now = pin_logo is not None and pin_logo.is_touched()\n");
            edges.Append("    if logo_now and not logo_was:\n");
            foreach (string script in logoScripts)
            {
                edges.Append("        " + script + "()\n");
            }
            edges.Append("    logo_was = logo_now\n");
        }

        var code = new StringBuilder();
        code.Append("# Kidlearn: program built with blocks\n");
        var imports = new List<string> { "display", "button_a", "button_b", "accelerometer", "sleep", "Image" };
        if (usesCar)
        {
            imports.Add("i2c");
        }
        if (usesRemote)
        {
            imports.Add("pin8");
        }
        code.Append("from microbit import " + string.Join(", ", imports) + "\n");
        if (usesRemote)
        {
            code.Append("import utime\n");
        }
        // The V2 parts are imported only when a block uses them. On a V1 board they are None, and those blocks never fire.
        if (logoScripts.Count > 0)
        {
            code.Append("try:\n    from microbit import pin_logo\nexcept ImportError:\n    pin_logo = None\n");
        }
        code.Append("\n");
        if (usesCar)
        {
            code.Append(CarFunction);
        }
        if (usesRemote)
        {
            code.Append(IrFunctions);
        }
        code.Append(functions);
        if (abScripts.Count > 0)
        {
            code.Append("ab_was = False\n");
        }
        if (logoScripts.Count > 0)
        {
            code.Append("logo_was = False\n");
        }
        code.Append("display.clear()\n");
        if (usesCar)
        {
            code.Append(CarCall(Stopped) + "\n"); // the car starts stopped
        }
        code.Append(once);
        code.Append("while True:\n");
        if (usesRemote)
        {
            code.Append("    key = ir_key()\n"); // one read per loop: the remote's key, or -1
        }
        code.Append(repeating);
        code.Append(edges);
        code.Append(checks);
        code.Append("    sleep(20)\n");
        return code.ToString();
    }

    // One script: its event, whether it repeats, the lines of its function body,
    // whether it drives the car (so it must stop it at the end), and whether it uses the car at all
    private sealed record ParsedScript(string EventName, bool Repeat, List<string> Lines, bool Drives, bool UsesCar, int? KeyCode);

    private static ParsedScript ParseScript(JsonObject script)
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

        int? keyCode = null;
        if (eventName == "remote")
        {
            string? key = GetString(script, "key");
            if (key is null || !RemoteKeys.TryGetValue(key, out int code))
            {
                throw new ArgumentException("unknown_key");
            }
            keyCode = code;
        }

        if (script["actions"] is not JsonArray actions || actions.Count < 1 || actions.Count > MaxActions)
        {
            throw new ArgumentException("bad_actions_count");
        }

        var lines = new List<string>();
        bool drives = false;
        bool usesCar = false;
        foreach (JsonNode? node in actions)
        {
            if (node is not JsonObject action)
            {
                throw new ArgumentException("bad_action");
            }
            string? kind = GetString(action, "do");
            drives |= kind == "drive";
            usesCar |= kind is "drive" or "stop";
            lines.Add(ActionLine(action));
        }
        return new ParsedScript(eventName, repeat, lines, drives, usesCar, keyCode);
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
            case "drive":
            {
                string? dir = GetString(action, "dir");
                if (dir is null || !CarMoves.TryGetValue(dir, out var motors))
                {
                    throw new ArgumentException("unknown_direction");
                }
                return "    " + CarCall(motors) + "\n";
            }
            case "stop":
                return "    " + CarCall(Stopped) + "\n";
            case "clear":
                return "    display.clear()\n";
            default:
                throw new ArgumentException("unknown_action");
        }
    }

    // A script that starts when the board's accelerometer reports a gesture (the names are the micro:bit's own)
    private static string GestureCheck(string gesture, string name) =>
        $"    if accelerometer.was_gesture('{gesture}'):\n        {name}()\n";

    // A call of the car function with the four motor values
    private static string CarCall((int Lf, int Lb, int Rf, int Rb) motors) =>
        $"car({motors.Lf}, {motors.Lb}, {motors.Rf}, {motors.Rb})";

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
