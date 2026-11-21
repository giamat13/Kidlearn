using System.Diagnostics;
using System.Reflection;

namespace Kidlearn.Tray;

internal static class Program
{
    // חייב להיות זהה ל-KIDLEARN_URL בתוסף (desktop/extension/newtab.js)
    public const string KidlearnUrl = "https://giamat13.github.io/Kidlearn/";

    private const string SingleInstanceName = "Kidlearn.Tray.SingleInstance";

    [STAThread]
    private static void Main()
    {
        // מופע אחד בלבד בכל רגע
        using var singleInstance = new Mutex(true, SingleInstanceName, out bool isFirstInstance);
        if (!isFirstInstance)
        {
            return;
        }

        Application.SetHighDpiMode(HighDpiMode.SystemAware);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        // ApplicationContext במקום Form: אין חלון, רק אייקון באזור ההודעות
        Application.Run(new TrayContext());
    }

    internal static void OpenKidlearn() => OpenUrl(KidlearnUrl);

    internal static void OpenUrl(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch (Exception)
        {
            MessageBox.Show(
                "לא הצלחנו לפתוח את הדפדפן. נסו שוב.",
                "Kidlearn",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning,
                MessageBoxDefaultButton.Button1,
                MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign);
        }
    }
}

internal sealed class TrayContext : ApplicationContext
{
    private readonly NotifyIcon _trayIcon;
    private readonly BridgeServer _bridge = new();
    private bool _openOnBalloonClick;

    public TrayContext()
    {
        var menu = new ContextMenuStrip { RightToLeft = RightToLeft.Yes };
        menu.Items.Add("פתיחת Kidlearn", null, (_, _) => Program.OpenKidlearn());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("יציאה", null, (_, _) => Exit());

        _trayIcon = new NotifyIcon
        {
            Icon = LoadIcon(),
            Text = "Kidlearn",
            ContextMenuStrip = menu,
            Visible = true,
        };

        // התראה על פרק חדש בפודקאסט שהילד סימן בפעמון. לחיצה על ההתראה פותחת את דף הפודקאסטים.
        PodcastWatcher.NewEpisodes += (title, text) =>
        {
            _trayIcon.BalloonTipTitle = title;
            _trayIcon.BalloonTipText = text;
            _trayIcon.BalloonTipIcon = ToolTipIcon.Info;
            _openOnBalloonClick = true;
            _trayIcon.ShowBalloonTip(10000);
        };
        _trayIcon.BalloonTipClicked += (_, _) =>
        {
            if (_openOnBalloonClick)
            {
                Program.OpenUrl(Program.KidlearnUrl + "podcasts/index.html");
            }
        };
        _trayIcon.BalloonTipClosed += (_, _) => _openOnBalloonClick = false;
        PodcastWatcher.Start();
        MediaCache.Start();

        // לחיצה שמאלית על האייקון פותחת את האתר
        _trayIcon.MouseClick += (_, e) =>
        {
            if (e.Button == MouseButtons.Left)
            {
                Program.OpenKidlearn();
            }
        };
    }

    private void Exit()
    {
        // מסתירים את האייקון לפני היציאה, אחרת הוא נשאר בזמן עד שמזיזים את העכבר עליו
        _trayIcon.Visible = false;
        Application.Exit();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            PodcastWatcher.Stop();
            MediaCache.Stop();
            _bridge.Dispose();
            _trayIcon.Dispose();
        }
        base.Dispose(disposing);
    }

    private static Icon LoadIcon()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("kidlearn.ico");
        return stream is null ? SystemIcons.Application : new Icon(stream);
    }
}
