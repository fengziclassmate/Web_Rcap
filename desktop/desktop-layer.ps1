param(
  [Parameter(Mandatory = $true)][long] $WindowHandle,
  [ValidateSet('Attach', 'Inspect', 'Serve')][string] $Action = 'Attach'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class RcapDesktopLayer {
  private delegate bool EnumProc(IntPtr window, IntPtr data);
  [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] private struct Point { public int X, Y; }
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc callback, IntPtr data);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string name, string title);
  [DllImport("user32.dll")] private static extern IntPtr GetParent(IntPtr window);
  [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr window, uint flags);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
  [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
  [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowLongPtr(IntPtr window, int index, IntPtr value);
  [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetParent(IntPtr window, IntPtr parent);
  [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] private static extern bool ScreenToClient(IntPtr window, ref Point point);
  [DllImport("user32.dll", SetLastError = true)] private static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder name, int length);
  [DllImport("user32.dll")] private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);

  public static object Inspect(IntPtr window) {
    SetThreadDpiAwarenessContext(new IntPtr(-4));
    IntPtr parent = GetParent(window);
    Rect bounds;
    GetWindowRect(window, out bounds);
    StringBuilder name = new StringBuilder(256);
    GetClassName(parent, name, name.Capacity);
    return new {
      parent = parent.ToInt64().ToString(), parentClass = name.ToString(),
      child = (GetWindowLongPtr(window, -16).ToInt64() & 0x40000000L) != 0,
      root = GetAncestor(window, 2).ToInt64().ToString(),
      visible = IsWindowVisible(window), minimized = IsIconic(window),
      bounds = new { x = bounds.Left, y = bounds.Top, width = bounds.Right - bounds.Left, height = bounds.Bottom - bounds.Top }
    };
  }

  public static object Attach(IntPtr window) {
    IntPtr desktop = IntPtr.Zero;
    // Use the existing desktop surface above the icons; do not replace the wallpaper or spawn WorkerW.
    EnumWindows((candidate, data) => {
      if (FindWindowEx(candidate, IntPtr.Zero, "SHELLDLL_DefView", null) == IntPtr.Zero) return true;
      desktop = candidate;
      return false;
    }, IntPtr.Zero);
    if (desktop == IntPtr.Zero) throw new InvalidOperationException("The Windows desktop surface is unavailable.");

    SetThreadDpiAwarenessContext(new IntPtr(-4));
    Rect bounds;
    if (!GetWindowRect(window, out bounds)) throw new Win32Exception(Marshal.GetLastWin32Error());
    Point position = new Point { X = bounds.Left, Y = bounds.Top };
    if (!ScreenToClient(desktop, ref position)) throw new Win32Exception(Marshal.GetLastWin32Error());
    long style = GetWindowLongPtr(window, -16).ToInt64() & 0xffffffffL;
    SetWindowLongPtr(window, -16, new IntPtr((style & ~0x80000000L) | 0x40000000L));
    SetParent(window, desktop);
    if (GetParent(window) != desktop) throw new Win32Exception(Marshal.GetLastWin32Error());
    if (!SetWindowPos(window, IntPtr.Zero, position.X, position.Y, bounds.Right - bounds.Left, bounds.Bottom - bounds.Top, 0x0470)) {
      throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    return Inspect(window);
  }

  public static object Place(IntPtr window, int x, int y, int width, int height) {
    SetThreadDpiAwarenessContext(new IntPtr(-4));
    Point point = new Point { X = x, Y = y };
    if (!ScreenToClient(GetParent(window), ref point)) throw new Win32Exception(Marshal.GetLastWin32Error());
    if (!SetWindowPos(window, IntPtr.Zero, point.X, point.Y, width, height, 0x0410)) throw new Win32Exception(Marshal.GetLastWin32Error());
    return Inspect(window);
  }

  public static object Visibility(IntPtr window, bool visible) {
    if (!SetWindowPos(window, IntPtr.Zero, 0, 0, 0, 0, visible ? 0x0453u : 0x0493u)) throw new Win32Exception(Marshal.GetLastWin32Error());
    return Inspect(window);
  }
}
'@

if ($Action -eq 'Serve') {
  $handle = [IntPtr]::new($WindowHandle)
  @{ id = 0; result = [RcapDesktopLayer]::Inspect($handle) } | ConvertTo-Json -Compress -Depth 6
  while ($null -ne ($line = [Console]::ReadLine())) {
    $command = $line | ConvertFrom-Json
    try {
      $result = switch ($command.action) {
        'attach' { [RcapDesktopLayer]::Attach($handle) }
        'place' { [RcapDesktopLayer]::Place($handle, $command.bounds.x, $command.bounds.y, $command.bounds.width, $command.bounds.height) }
        'show' { [RcapDesktopLayer]::Visibility($handle, $true) }
        'hide' { [RcapDesktopLayer]::Visibility($handle, $false) }
        default { throw 'Unknown desktop command' }
      }
      @{ id = $command.id; result = $result } | ConvertTo-Json -Compress -Depth 6
    } catch {
      @{ id = $command.id; error = $_.Exception.Message } | ConvertTo-Json -Compress
    }
  }
} elseif ($Action -eq 'Attach') {
  [RcapDesktopLayer]::Attach([IntPtr]::new($WindowHandle)) | ConvertTo-Json -Compress
} else {
  [RcapDesktopLayer]::Inspect([IntPtr]::new($WindowHandle)) | ConvertTo-Json -Compress
}
