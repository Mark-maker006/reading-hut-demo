param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = (Get-Command python -ErrorAction Stop).Source
$lanAddress = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -notlike '127.*' -and
    $_.IPAddress -notlike '169.254.*' -and
    $_.AddressState -eq 'Preferred'
  } |
  Select-Object -First 1 -ExpandProperty IPAddress

Write-Host "Serving: $root"
Write-Host "Local:   http://localhost:$Port/"
if ($lanAddress) {
  Write-Host "WLAN:    http://${lanAddress}:$Port/"
}
Write-Host 'Keep this window open while other devices are using the preview.'

& $python -m http.server $Port --bind 0.0.0.0 --directory $root
