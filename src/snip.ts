// PowerShell run by the snip button: opens the Windows snipping overlay (Win+Shift+S) and waits
// for a NEW image on the clipboard (its sequence number must change, so one already there is
// ignored), saves it as PNG to $out (set by the caller ahead of this script) and prints the path.
// Exit 2 when the overlay closed without a snip, 1 on timeout.
export const SNIP_PS = `

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -Namespace Snap -Name Win -MemberDefinition @'
[DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber();
[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint pid);
[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, System.UIntPtr extra);
'@
function Get-ForegroundName {
  $p = 0; [void][Snap.Win]::GetWindowThreadProcessId([Snap.Win]::GetForegroundWindow(), [ref]$p)
  try { (Get-Process -Id $p -ErrorAction Stop).Name } catch { '' }
}
$before = [Snap.Win]::GetClipboardSequenceNumber()
# Press Win+Shift+S, the shell's own snip hotkey: it opens the overlay much
# faster than launching the ms-screenclip: link. Keys go up in reverse order.
$keys = 0x5B, 0x10, 0x53
foreach ($k in $keys) { [Snap.Win]::keybd_event($k, 0, 0, [System.UIntPtr]::Zero) }
[array]::Reverse($keys)
foreach ($k in $keys) { [Snap.Win]::keybd_event($k, 0, 2, [System.UIntPtr]::Zero) }
$deadline = (Get-Date).AddSeconds(30)
$overlaySeen = $false
$closedAt = $null
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 100
  if ([Snap.Win]::GetClipboardSequenceNumber() -ne $before) {
    $img = [System.Windows.Forms.Clipboard]::GetImage()
    if ($img) {
      New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
      $img.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Output $out
      exit 0
    }
  }
  $fg = Get-ForegroundName
  if ($fg -match 'Snip|ScreenClip') { $overlaySeen = $true; $closedAt = $null }
  elseif ($overlaySeen) {
    # Overlay gone: give the clipboard a second to receive the snip, then stop.
    if (-not $closedAt) { $closedAt = Get-Date }
    elseif (((Get-Date) - $closedAt).TotalMilliseconds -gt 1000) { exit 2 }
  }
}
exit 1
`;
