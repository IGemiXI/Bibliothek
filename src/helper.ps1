# Bibliothek – Windows-Helfer
# Läuft dauerhaft im Hintergrund und beantwortet Befehle der Bibliothek (eine JSON-Zeile pro Befehl).

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}
try { [Console]::InputEncoding  = New-Object System.Text.UTF8Encoding $false } catch {}

Add-Type -AssemblyName System.Drawing
Add-Type -Language CSharp -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }

public class GxAudio {
  static IAudioEndpointVolume Vol() {
    var en = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(en.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    var id = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref id, 23, 0, out epv));
    return epv;
  }
  public static float GetVolume() { float v; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
  public static void SetVolume(float v) { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(v, Guid.Empty)); }
  public static bool GetMute() { bool m; Marshal.ThrowExceptionForHR(Vol().GetMute(out m)); return m; }
  public static void SetMute(bool m) { Marshal.ThrowExceptionForHR(Vol().SetMute(m, Guid.Empty)); }
}

// Windows-Taste abfangen: Einzeldruck öffnet die Bibliothek statt des Startmenüs.
// Kombinationen (Win+E, Win+Shift+S, Win+D …) funktionieren weiter wie gewohnt.
public class GxHook {
  delegate IntPtr LLProc(int nCode, IntPtr wParam, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] struct KB { public uint vk; public uint scan; public uint flags; public uint time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public IntPtr w; public IntPtr l; public uint time; public int x; public int y; }
  [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, LLProc fn, IntPtr mod, uint tid);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h, int n, IntPtr w, IntPtr l);
  [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string name);
  [DllImport("user32.dll")] static extern int GetMessage(out MSG m, IntPtr h, uint a, uint b);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  static LLProc proc;
  static IntPtr hook;
  static bool winDown, combo;
  public static volatile bool Enabled = false;
  public static void Start() {
    var t = new System.Threading.Thread(() => {
      proc = Callback;
      hook = SetWindowsHookEx(13, proc, GetModuleHandle(null), 0);
      MSG m;
      while (GetMessage(out m, IntPtr.Zero, 0, 0) > 0) { }
    });
    t.IsBackground = true;
    t.Start();
  }
  static IntPtr Callback(int n, IntPtr w, IntPtr l) {
    if (n >= 0 && Enabled) {
      var k = (KB)Marshal.PtrToStructure(l, typeof(KB));
      bool injected = (k.flags & 0x10) != 0;
      int msg = w.ToInt32();
      bool down = msg == 0x100 || msg == 0x104;
      bool up = msg == 0x101 || msg == 0x105;
      bool isWin = k.vk == 0x5B || k.vk == 0x5C;
      if (!injected) {
        if (isWin && down) { if (!winDown) { winDown = true; combo = false; } }
        else if (isWin && up) {
          if (winDown && !combo) {
            // Unsichtbare Maskentaste: Windows bricht dadurch das Startmenü ab
            keybd_event(0xE8, 0, 0, UIntPtr.Zero);
            keybd_event(0xE8, 0, 2, UIntPtr.Zero);
            long fg = GetForegroundWindow().ToInt64();
            System.Threading.ThreadPool.QueueUserWorkItem(_ => {
              Console.Out.WriteLine("{\"event\":\"winkey\",\"fg\":" + fg + "}");
              Console.Out.Flush();
            });
          }
          winDown = false;
        } else if (winDown && down) combo = true;
      }
    }
    return CallNextHookEx(hook, n, w, l);
  }
}

// Große, scharfe Icons (bis 256 px) über die Windows-Bildlisten
[ComImport, Guid("46EB5926-582E-4017-9FDF-E8998DAA0950"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IImageList {
  [PreserveSig] int Add(IntPtr a, IntPtr b, ref int c);
  [PreserveSig] int ReplaceIcon(int i, IntPtr h, ref int c);
  [PreserveSig] int SetOverlayImage(int a, int b);
  [PreserveSig] int Replace(int i, IntPtr a, IntPtr b);
  [PreserveSig] int AddMasked(IntPtr a, int b, ref int c);
  [PreserveSig] int Draw(IntPtr p);
  [PreserveSig] int Remove(int i);
  [PreserveSig] int GetIcon(int i, int flags, ref IntPtr icon);
}
public class GxIcon {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct SHFILEINFO { public IntPtr hIcon; public int iIcon; public uint attr; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string name; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string type; }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SHGetFileInfo(string p, uint a, ref SHFILEINFO s, uint size, uint flags);
  [DllImport("shell32.dll")] static extern int SHGetImageList(int list, ref Guid riid, out IImageList ppv);
  [DllImport("user32.dll")] static extern bool DestroyIcon(IntPtr h);

  static System.Drawing.Bitmap Get(string path, int list) {
    var sfi = new SHFILEINFO();
    SHGetFileInfo(path, 0, ref sfi, (uint)Marshal.SizeOf(sfi), 0x4000); // SYSICONINDEX
    IImageList il;
    var g = new Guid("46EB5926-582E-4017-9FDF-E8998DAA0950");
    if (SHGetImageList(list, ref g, out il) != 0) return null;
    IntPtr h = IntPtr.Zero;
    il.GetIcon(sfi.iIcon, 0x1 | 0x20, ref h); // TRANSPARENT | ILD_IMAGE
    if (h == IntPtr.Zero) return null;
    var bmp = System.Drawing.Icon.FromHandle(h).ToBitmap();
    DestroyIcon(h);
    return bmp;
  }
  static System.Drawing.Rectangle Bounds(System.Drawing.Bitmap b) {
    int minX = b.Width, minY = b.Height, maxX = -1, maxY = -1;
    for (int y = 0; y < b.Height; y++) for (int x = 0; x < b.Width; x++) {
      if (b.GetPixel(x, y).A > 16) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
    }
    if (maxX < 0) return System.Drawing.Rectangle.Empty;
    return new System.Drawing.Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
  }
  /* Liefert ein PNG als Base64 – 256 px, wenn das Programm so ein großes Icon hat, sonst 48 px */
  public static string Png(string path) {
    System.Drawing.Bitmap bmp = Get(path, 4); // JUMBO 256
    if (bmp != null) {
      var r = Bounds(bmp);
      if (r.IsEmpty || r.Width <= 64 && r.Height <= 64) { bmp.Dispose(); bmp = null; }
      else if (r.Width < bmp.Width || r.Height < bmp.Height) {
        int side = Math.Max(r.Width, r.Height);
        var sq = new System.Drawing.Bitmap(side, side);
        using (var gr = System.Drawing.Graphics.FromImage(sq)) gr.DrawImage(bmp, new System.Drawing.Rectangle((side - r.Width) / 2, (side - r.Height) / 2, r.Width, r.Height), r, System.Drawing.GraphicsUnit.Pixel);
        bmp.Dispose(); bmp = sq;
      }
    }
    if (bmp == null) bmp = Get(path, 2); // EXTRALARGE 48
    if (bmp == null) return null;
    using (var ms = new System.IO.MemoryStream()) {
      bmp.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
      bmp.Dispose();
      return Convert.ToBase64String(ms.ToArray());
    }
  }
}

public class GxWin {
  public class Info { public long h; public string title; public uint pid; public int l; public int t; public int r; public int b; }
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int L; public int T; public int R; public int B; }
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] static extern IntPtr FindWindow(string c, string w);
  [DllImport("user32.dll")] static extern IntPtr FindWindowEx(IntPtr p, IntPtr after, string c, string w);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int val, int size);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint flags);

  /* Fenster ganz nach hinten legen – aber über dem Windows-Hintergrundbild */
  public static void SendToBack(long hv) {
    var h = new IntPtr(hv);
    IntPtr after = new IntPtr(1); // HWND_BOTTOM
    IntPtr prog = FindWindow("Progman", null);
    if (prog != IntPtr.Zero) {
      IntPtr prev = GetWindow(prog, 3); // Fenster direkt über dem Desktop
      if (prev == h) return;
      if (prev != IntPtr.Zero) after = prev;
    }
    SetWindowPos(h, after, 0, 0, 0, 0, 0x0013); // NOSIZE | NOMOVE | NOACTIVATE
  }

  /* Fenster auf einen Bildschirm verschieben und maximieren */
  public static void MoveTo(long hv, int x, int y, int w, int hh, bool max) {
    var h = new IntPtr(hv);
    ShowWindow(h, 9);
    SetWindowPos(h, IntPtr.Zero, x, y, w, hh, 0x0014); // NOZORDER | NOACTIVATE
    if (max) ShowWindow(h, 3);
  }

  public static List<Info> List(uint selfPid) {
    var list = new List<Info>();
    EnumWindows(delegate (IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      if (GetWindow(h, 4) != IntPtr.Zero) return true;            // hat Besitzer -> Dialog
      int ex = GetWindowLong(h, -20);
      if ((ex & 0x80) != 0) return true;                          // Tool-Fenster
      int cloaked = 0;
      DwmGetWindowAttribute(h, 14, out cloaked, 4);
      if (cloaked != 0) return true;                              // unsichtbare UWP-Hüllen
      var t = new StringBuilder(512);
      GetWindowText(h, t, 512);
      if (t.Length == 0) return true;
      string title = t.ToString();
      if (title == "Program Manager") return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid == selfPid) return true;
      RECT rc; GetWindowRect(h, out rc);
      list.Add(new Info { h = h.ToInt64(), title = title, pid = pid, l = rc.L, t = rc.T, r = rc.R, b = rc.B });
      return true;
    }, IntPtr.Zero);
    return list;
  }
  public static void Focus(long hv) {
    var h = new IntPtr(hv);
    if (IsIconic(h)) ShowWindow(h, 9);
    keybd_event(0x12, 0, 0, UIntPtr.Zero);   // ALT drücken, damit Windows den Fokuswechsel erlaubt
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    SetForegroundWindow(h);
  }
  public static void Close(long hv) { PostMessage(new IntPtr(hv), 0x10, IntPtr.Zero, IntPtr.Zero); }
  public static void Taskbar(bool show) {
    int cmd = show ? 5 : 0;
    IntPtr t = FindWindow("Shell_TrayWnd", null);
    if (t != IntPtr.Zero) ShowWindow(t, cmd);
    IntPtr s = IntPtr.Zero;
    while ((s = FindWindowEx(IntPtr.Zero, s, "Shell_SecondaryTrayWnd", null)) != IntPtr.Zero) ShowWindow(s, cmd);
  }
}
'@

function Send($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Depth 6 -Compress))
  [Console]::Out.Flush()
}

function Props($path, [string[]]$names) {
  $out = @()
  foreach ($item in @(Get-ItemProperty -Path $path -ErrorAction SilentlyContinue)) {
    $o = @{ key = $item.PSChildName }
    foreach ($n in $names) { $o[$n] = $item.$n }
    $out += $o
  }
  return ,$out
}

$winlogon = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon'
[GxHook]::Start()

Send @{ id = 0; ok = $true; data = 'ready' }

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ($line.Trim().Length -eq 0) { continue }
  $id = 0
  try {
    $req = $line | ConvertFrom-Json
    $id = $req.id
    $a = $req.args
    $data = $null
    switch ($req.cmd) {
      'ping'      { $data = 'pong' }
      'volGet'    { $data = @{ vol = [Math]::Round([GxAudio]::GetVolume() * 100); mute = [GxAudio]::GetMute() } }
      'volSet'    { [GxAudio]::SetVolume([float]($a.v / 100)); $data = $true }
      'muteSet'   { [GxAudio]::SetMute([bool]$a.m); $data = $true }
      'taskbar'   { [GxWin]::Taskbar([bool]$a.show); $data = $true }
      'procs'     { $data = @(Get-Process | Where-Object { $_.Path } | ForEach-Object { $_.Path }) }
      'windows'   {
        $res = @()
        foreach ($w in [GxWin]::List([uint32]$a.selfPid)) {
          $p = $null
          try { $p = (Get-Process -Id $w.pid -ErrorAction SilentlyContinue).Path } catch {}
          $res += @{ h = $w.h; title = $w.title; pid = $w.pid; path = $p; l = $w.l; t = $w.t; r = $w.r; b = $w.b }
        }
        $data = $res
      }
      'focus'     { [GxWin]::Focus([long]$a.h); $data = $true }
      'toBack'    { [GxWin]::SendToBack([long]$a.h); $data = $true }
      'moveTo'    { [GxWin]::MoveTo([long]$a.h, [int]$a.x, [int]$a.y, [int]$a.w, [int]$a.hh, [bool]$a.max); $data = $true }
      'defaultBrowser' {
        $prog = (Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice' -ErrorAction SilentlyContinue).ProgId
        $cmd = $null
        if ($prog) { $cmd = (Get-ItemProperty -LiteralPath "Registry::HKEY_CLASSES_ROOT\$prog\shell\open\command" -ErrorAction SilentlyContinue).'(default)' }
        $data = @{ progId = $prog; command = $cmd }
      }
      'icon'      { $data = [GxIcon]::Png([string]$a.path) }
      'uwpLogos'  {
        # Logo-Dateien der Store-Apps aus ihrem Paket suchen (beste Auflösung, ohne Hintergrundplatte)
        $res = @{}
        $pkgs = @{}
        foreach ($p in @(Get-AppxPackage -ErrorAction SilentlyContinue)) { $pkgs[$p.PackageFamilyName] = $p.InstallLocation }
        foreach ($id in @($a.appIds)) {
          try {
            $fam = $id.Split('!')[0]
            $loc = $pkgs[$fam]
            if (-not $loc) { continue }
            [xml]$m = Get-Content -LiteralPath (Join-Path $loc 'AppxManifest.xml') -Raw
            $app = @($m.Package.Applications.Application)[0]
            $ve = $app.VisualElements
            $logo = $ve.Square44x44Logo
            if (-not $logo) { $logo = $ve.Square150x150Logo }
            if (-not $logo) { continue }
            $full = Join-Path $loc $logo
            $dir = Split-Path $full -Parent
            $base = [IO.Path]::GetFileNameWithoutExtension($full)
            $cands = @(Get-ChildItem -LiteralPath $dir -Filter ($base + '*.png') -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'contrast' })
            if (-not $cands.Count) { continue }
            $best = $cands | Sort-Object @{ e = { if ($_.Name -match 'targetsize-256' -and $_.Name -match 'unplated') { 0 } elseif ($_.Name -match 'targetsize-256') { 1 } elseif ($_.Name -match 'unplated') { 2 } else { 3 } } }, @{ e = { $_.Length }; Descending = $true } | Select-Object -First 1
            $res[$id] = $best.FullName
          } catch {}
        }
        $data = $res
      }
      'winkey'    { [GxHook]::Enabled = [bool]$a.on; $data = $true }
      'closeWin'  { [GxWin]::Close([long]$a.h); $data = $true }
      'uninstall' {
        $names = @('DisplayName', 'Publisher', 'InstallLocation', 'UninstallString', 'DisplayIcon')
        $data = @()
        $data += Props 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' $names
        $data += Props 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' $names
        $data += Props 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' $names
      }
      'gog'       { $data = Props 'HKLM:\SOFTWARE\WOW6432Node\GOG.com\Games\*' @('gameName', 'exe', 'path', 'workingDir', 'launchParam', 'gameID') }
      'steamPath' { $data = (Get-ItemProperty -Path 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).SteamPath }
      'startApps' { $data = @(Get-StartApps | Where-Object { $_.AppID -like '*!*' } | ForEach-Object { @{ name = $_.Name; appId = $_.AppID } }) }
      'runEntries' {
        $res = @()
        foreach ($k in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run')) {
          $p = Get-ItemProperty -Path $k -ErrorAction SilentlyContinue
          if ($p) {
            foreach ($prop in $p.PSObject.Properties) {
              if ($prop.Name -notlike 'PS*') { $res += @{ name = $prop.Name; cmd = [string]$prop.Value } }
            }
          }
        }
        $data = $res
      }
      'sleep'     {
        Add-Type -AssemblyName System.Windows.Forms
        [void][System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)
        $data = $true
      }
      'shellGet'  { $data = (Get-ItemProperty -Path $winlogon -Name Shell -ErrorAction SilentlyContinue).Shell }
      'shellSet'  {
        if ($a.value) { Set-ItemProperty -Path $winlogon -Name Shell -Value ([string]$a.value) }
        else { Remove-ItemProperty -Path $winlogon -Name Shell -ErrorAction SilentlyContinue }
        $data = $true
      }
      default     { throw "Unbekannter Befehl: $($req.cmd)" }
    }
    Send @{ id = $id; ok = $true; data = $data }
  } catch {
    Send @{ id = $id; ok = $false; error = $_.Exception.Message }
  }
}
