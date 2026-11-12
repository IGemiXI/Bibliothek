# Bibliothek – Windows-Helfer
# Läuft dauerhaft im Hintergrund und beantwortet Befehle der Bibliothek (eine JSON-Zeile pro Befehl).

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}
try { [Console]::InputEncoding  = New-Object System.Text.UTF8Encoding $false } catch {}

Add-Type -Language CSharp -TypeDefinition @'
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
