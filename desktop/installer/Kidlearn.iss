; Kidlearn installer.
; Build with installer\build.ps1 (or: ISCC.exe installer\Kidlearn.iss after publishing the app).

#define MyAppName "Kidlearn"
#define MyAppVersion "1.0.0"
#define MyAppExeName "Kidlearn.exe"
#define MyAppURL "https://giamat13.github.io/Kidlearn/"
#define RuntimeFileName "windowsdesktop-runtime-win-x64.exe"
; Must match ExtensionOrigin in desktop/shared/NativeMessaging.cs and "key" in desktop/extension/manifest.json
#define ExtensionId "ojlnaidcaijnkidndnogplnedifkjmjb"
#define HostName "com.kidlearn.bridge"
#define HostManifestFile "com.kidlearn.bridge.json"

[Setup]
AppId={{6F1D2A8E-3B7C-4E59-9A0D-2C8B7E41F5A3}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher=Kidlearn
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
; מתקינים לחשבון המשתמש הנוכחי, בלי הרשאות מנהל (ה-Runtime מבקש הרשאה בעצמו אם צריך)
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=KidlearnSetup
SetupIconFile=..\app\Assets\kidlearn.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
CloseApplicationsFilter=*.exe
RestartApplications=no

[Languages]
Name: "hebrew"; MessagesFile: "compiler:Languages\Hebrew.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
hebrew.TaskAutoStart=הפעלה אוטומטית של Kidlearn בכניסה למחשב (מומלץ)
english.TaskAutoStart=Start Kidlearn automatically when I sign in (recommended)
hebrew.TaskChromeExt=הוספת תוסף הכרום (טאב חדש ייפתח ב-Kidlearn)
english.TaskChromeExt=Add the Chrome extension (new tabs open Kidlearn)
hebrew.RunNow=הפעלת Kidlearn עכשיו
english.RunNow=Start Kidlearn now
hebrew.RuntimeFailed=לא הצלחנו להתקין את .NET 10 Desktop Runtime הנדרש ל-Kidlearn. התקינו אותו מ-https://dotnet.microsoft.com/download/dotnet/10.0 והריצו את ההתקנה שוב.
english.RuntimeFailed=Could not install the .NET 10 Desktop Runtime that Kidlearn needs. Install it from https://dotnet.microsoft.com/download/dotnet/10.0 and run this setup again.
hebrew.ExtStep1=תוסף הכרום מוכן לחיבור. נפתחו עכשיו דף ההרחבות של Chrome ותיקיית התוסף.
english.ExtStep1=The Chrome extension is ready to load. The Chrome extensions page and the extension folder are now open.
hebrew.ExtStep2=1. בדף ההרחבות הדליקו "מצב מפתח" (Developer mode) בפינה למעלה.
english.ExtStep2=1. On the extensions page, turn on "Developer mode" in the top corner.
hebrew.ExtStep3=2. לחצו "Load unpacked" ובחרו את התיקייה extension שנפתחה ב-Explorer.
english.ExtStep3=2. Click "Load unpacked" and choose the "extension" folder that opened in Explorer.
hebrew.ExtStep4=השלב הזה נדרש פעם אחת בלבד. Chrome לא מאפשר להתקין תוסף שאינו מחנות Chrome בלי אישור ידני.
english.ExtStep4=This is needed only once. Chrome does not allow installing an extension outside the Chrome Web Store without a manual approval.
hebrew.UninstallNote=Kidlearn הוסר. כדי להסיר גם את התוסף, פתחו chrome://extensions והסירו את "Kidlearn".
english.UninstallNote=Kidlearn was removed. To remove the extension too, open chrome://extensions and remove "Kidlearn".

[Tasks]
Name: "autostart"; Description: "{cm:TaskAutoStart}"; Flags: checkedonce
Name: "chromeext"; Description: "{cm:TaskChromeExt}"; Flags: checkedonce

[Files]
Source: "..\dist\app\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\app\KidlearnHost.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\extension\*"; DestDir: "{app}\extension"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "prereq\{#RuntimeFileName}"; DestDir: "{tmp}"; Flags: deleteafterinstall nocompression; Check: NeedDesktopRuntime

[Icons]
Name: "{userprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "Kidlearn"; ValueData: """{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue; Tasks: autostart
; Chrome looks up native messaging hosts here (per user, no admin needed)
Root: HKCU; Subkey: "Software\Google\Chrome\NativeMessagingHosts\{#HostName}"; ValueType: string; ValueData: "{app}\{#HostManifestFile}"; Flags: uninsdeletekey

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:RunNow}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM {#MyAppExeName}"; Flags: runhidden waituntilterminated; RunOnceId: "StopKidlearn"

[UninstallDelete]
; written by the installer at runtime, so the uninstaller does not know about it
Type: files; Name: "{app}\{#HostManifestFile}"

[Code]
const
  // 16 = FILE_ATTRIBUTE_DIRECTORY
  DirectoryAttribute = $10;

// The app is framework-dependent, so it needs a .NET 10 Desktop Runtime (any 10.x).
function DesktopRuntime10Installed(): Boolean;
var
  FindRec: TFindRec;
begin
  Result := False;
  if FindFirst(ExpandConstant('{pf64}\dotnet\shared\Microsoft.WindowsDesktop.App\10.*'), FindRec) then
  begin
    Result := (FindRec.Attributes and DirectoryAttribute) <> 0;
    FindClose(FindRec);
  end;
end;

function NeedDesktopRuntime(): Boolean;
begin
  Result := not DesktopRuntime10Installed();
end;

procedure InstallDesktopRuntime();
var
  ResultCode: Integer;
begin
  if not NeedDesktopRuntime() then
    Exit;

  // 0 = installed, 3010 = installed (reboot needed), 1638 = newer version already present
  if not Exec(ExpandConstant('{tmp}\{#RuntimeFileName}'), '/install /quiet /norestart', '',
              SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    ResultCode := -1;

  if (not DesktopRuntime10Installed()) and (ResultCode <> 3010) and (ResultCode <> 1638) then
    MsgBox(CustomMessage('RuntimeFailed'), mbError, MB_OK);
end;

function FindChrome(): String;
begin
  Result := ExpandConstant('{pf64}\Google\Chrome\Application\chrome.exe');
  if FileExists(Result) then
    Exit;
  Result := ExpandConstant('{pf32}\Google\Chrome\Application\chrome.exe');
  if FileExists(Result) then
    Exit;
  Result := ExpandConstant('{localappdata}\Google\Chrome\Application\chrome.exe');
  if FileExists(Result) then
    Exit;
  Result := '';
end;

procedure OpenChromeExtensionSetup();
var
  ResultCode: Integer;
  ChromePath: String;
begin
  ChromePath := FindChrome();
  if ChromePath <> '' then
    Exec(ChromePath, 'chrome://extensions', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
  Exec(ExpandConstant('{win}\explorer.exe'), ExpandConstant('"{app}\extension"'), '',
       SW_SHOWNORMAL, ewNoWait, ResultCode);
  MsgBox(CustomMessage('ExtStep1') + #13#10 + #13#10 +
         CustomMessage('ExtStep2') + #13#10 +
         CustomMessage('ExtStep3') + #13#10 + #13#10 +
         CustomMessage('ExtStep4'), mbInformation, MB_OK);
end;

function HexDigit(N: Integer): String;
begin
  Result := Copy('0123456789ABCDEF', N + 1, 1);
end;

// Escapes a path for JSON, and writes non-ASCII as \uXXXX. SaveStringToFile writes ANSI,
// so a Hebrew Windows user name would otherwise corrupt the file that Chrome reads.
function JsonEscapePath(const Path: String): String;
var
  I, Code: Integer;
  C: Char;
begin
  Result := '';
  for I := 1 to Length(Path) do
  begin
    C := Path[I];
    Code := Ord(C);
    if C = '\' then
      Result := Result + '\\'
    else if Code > 127 then
      Result := Result + '\u' + HexDigit(Code div 4096) + HexDigit((Code div 256) mod 16) +
                HexDigit((Code div 16) mod 16) + HexDigit(Code mod 16)
    else
      Result := Result + C;
  end;
end;

// Chrome finds the native host through the registry key, which points to this file.
// The file lists the host exe and the only extension allowed to start it.
procedure WriteNativeHostManifest();
var
  Json: String;
begin
  Json := '{' + #13#10 +
    '  "name": "{#HostName}",' + #13#10 +
    '  "description": "Kidlearn bridge between Chrome and the Kidlearn desktop app",' + #13#10 +
    '  "path": "' + JsonEscapePath(ExpandConstant('{app}\KidlearnHost.exe')) + '",' + #13#10 +
    '  "type": "stdio",' + #13#10 +
    '  "allowed_origins": [ "chrome-extension://{#ExtensionId}/" ]' + #13#10 +
    '}' + #13#10;
  SaveStringToFile(ExpandConstant('{app}\{#HostManifestFile}'), Json, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    WriteNativeHostManifest();
    InstallDesktopRuntime();
    if WizardIsTaskSelected('chromeext') and (not WizardSilent()) then
      OpenChromeExtensionSetup();
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usPostUninstall) and (not UninstallSilent()) then
    MsgBox(CustomMessage('UninstallNote'), mbInformation, MB_OK);
end;
