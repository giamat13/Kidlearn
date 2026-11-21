// קוד משותף לאפליקציה ולמארח ה-Native Messaging (הקבצים מקושרים ב-csproj של שניהם)
using System.Buffers.Binary;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kidlearn.Shared;

internal static class BridgeProtocol
{
    // המזהה הקבוע של התוסף (נגזר מ-"key" ב-manifest.json). רק התוסף הזה יכול להפעיל את המארח
    public const string ExtensionOrigin = "chrome-extension://ojlnaidcaijnkidndnogplnedifkjmjb/";

    // שם המארח שהתוסף קורא לו, והשם של המארח ברישום של Chrome
    public const string HostName = "com.kidlearn.bridge";

    // ערוץ ה-named pipe בין המארח לאפליקציה. מזהה לפי שם המשתמש, כך שכל משתמש במחשב מקבל ערוץ משלו
    public static string PipeName => "Kidlearn.Bridge." + Environment.UserName;
}

// פורמט ההודעות של Chrome: 4 בתים באורך (little endian) ואחריהם JSON בקידוד UTF-8
internal static class Framing
{
    public const int MaxMessageBytes = 64 * 1024;

    public static async Task<JsonObject?> ReadAsync(Stream stream, CancellationToken ct)
    {
        byte[] header = new byte[4];
        if (!await ReadExactAsync(stream, header, ct))
        {
            return null;
        }

        int length = BinaryPrimitives.ReadInt32LittleEndian(header);
        if (length <= 0 || length > MaxMessageBytes)
        {
            throw new InvalidDataException("Invalid message length");
        }

        byte[] body = new byte[length];
        if (!await ReadExactAsync(stream, body, ct))
        {
            return null;
        }

        return JsonSerializer.Deserialize<JsonNode>(body) as JsonObject;
    }

    public static async Task WriteAsync(Stream stream, JsonObject message, CancellationToken ct)
    {
        byte[] body = JsonSerializer.SerializeToUtf8Bytes(message);
        byte[] header = new byte[4];
        BinaryPrimitives.WriteInt32LittleEndian(header, body.Length);

        await stream.WriteAsync(header, ct);
        await stream.WriteAsync(body, ct);
        await stream.FlushAsync(ct);
    }

    private static async Task<bool> ReadExactAsync(Stream stream, byte[] buffer, CancellationToken ct)
    {
        int read = 0;
        while (read < buffer.Length)
        {
            int n = await stream.ReadAsync(buffer.AsMemory(read), ct);
            if (n == 0)
            {
                return false;
            }
            read += n;
        }
        return true;
    }
}
