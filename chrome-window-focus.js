const { spawn } = require('child_process');

// Chrome selects its tab itself. Windows can still keep its window behind the
// tracker, so activate the matching native Chrome window as a separate step.
const focusScript = String.raw`
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class TrackerWindowFocus {
    public delegate bool EnumWindowsProc(IntPtr window, IntPtr state);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr state);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder text, int maxCount);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr window, StringBuilder text, int maxCount);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint source, uint target, bool attach);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr window);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
}
'@
$tabTitle = $env:QURAN_TRACKER_CHROME_TITLE
if ([string]::IsNullOrWhiteSpace($tabTitle)) { exit 1 }
for ($attempt = 0; $attempt -lt 15; $attempt++) {
    $matches = [System.Collections.Generic.List[System.IntPtr]]::new()
    $callback = [TrackerWindowFocus+EnumWindowsProc] {
        param($window, $state)
        if (-not [TrackerWindowFocus]::IsWindowVisible($window)) { return $true }
        $class = [System.Text.StringBuilder]::new(256)
        [void][TrackerWindowFocus]::GetClassName($window, $class, $class.Capacity)
        if ($class.ToString() -ne 'Chrome_WidgetWin_1') { return $true }
        $text = [System.Text.StringBuilder]::new(4096)
        [void][TrackerWindowFocus]::GetWindowText($window, $text, $text.Capacity)
        $windowTitle = $text.ToString()
        if ($windowTitle -ne $tabTitle -and -not $windowTitle.StartsWith($tabTitle + ' - ') -and -not $windowTitle.Contains('"' + $tabTitle + '"')) { return $true }
        [uint32]$processId = 0
        [void][TrackerWindowFocus]::GetWindowThreadProcessId($window, [ref]$processId)
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process -and $process.ProcessName -eq 'chrome') { $matches.Add($window) }
        return $true
    }
    [void][TrackerWindowFocus]::EnumWindows($callback, [IntPtr]::Zero)
    if ($matches.Count -gt 0) {
        $target = $matches[0]
        $foreground = [TrackerWindowFocus]::GetForegroundWindow()
        [uint32]$unused = 0
        $foregroundThread = [TrackerWindowFocus]::GetWindowThreadProcessId($foreground, [ref]$unused)
        $currentThread = [TrackerWindowFocus]::GetCurrentThreadId()
        $attached = $foregroundThread -ne 0 -and $foregroundThread -ne $currentThread -and [TrackerWindowFocus]::AttachThreadInput($currentThread, $foregroundThread, $true)
        try {
            if ([TrackerWindowFocus]::IsIconic($target)) { [void][TrackerWindowFocus]::ShowWindowAsync($target, 9) }
            [void][TrackerWindowFocus]::BringWindowToTop($target)
            [void][TrackerWindowFocus]::SetForegroundWindow($target)
        } finally {
            if ($attached) { [void][TrackerWindowFocus]::AttachThreadInput($currentThread, $foregroundThread, $false) }
        }
        Start-Sleep -Milliseconds 100
        if ([TrackerWindowFocus]::GetForegroundWindow() -eq $target) { exit 0 }
    }
    Start-Sleep -Milliseconds 150
}
exit 1
`;

function focusChromeWindow(title) {
    if (process.platform !== 'win32' || !title) return Promise.resolve(false);
    return new Promise(resolve => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(focusScript, 'utf16le').toString('base64')], {
            windowsHide: true,
            stdio: 'ignore',
            env: { ...process.env, QURAN_TRACKER_CHROME_TITLE: title },
        });
        child.once('error', () => resolve(false));
        child.once('exit', code => resolve(code === 0));
    });
}

module.exports = { focusChromeWindow };
