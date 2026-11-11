<#
.SYNOPSIS
  Points the permanent Nyaya link (https://shivam098.github.io/nyaya) at the current tunnel address.

.DESCRIPTION
  Quick Cloudflare tunnels get a new random *.trycloudflare.com address on every restart. The GitHub Pages
  site in shivam098/nyaya forwards visitors (including /share/<token> links) to that address. Run this after
  starting a new tunnel. It updates index.html and 404.html in the Pages repo through the GitHub API, then
  waits until the permanent link serves the new address.

.EXAMPLE
  ./scripts/update-public-link.ps1 -TunnelUrl https://example-words.trycloudflare.com
#>
param(
  [Parameter(Mandatory = $true)][string]$TunnelUrl,
  [string]$PagesRepo = 'shivam098/nyaya',
  [string]$GitHubUser = 'shivam098',
  [int]$WaitSeconds = 180
)
$ErrorActionPreference = 'Stop'
$TunnelUrl = $TunnelUrl.TrimEnd('/')
if ($TunnelUrl -notmatch '^https://[a-z0-9.-]+$') { throw "TunnelUrl must be an https origin, got '$TunnelUrl'" }

$status = (Invoke-WebRequest -UseBasicParsing $TunnelUrl -TimeoutSec 20).StatusCode
if ($status -ne 200) { throw "Tunnel $TunnelUrl returned $status; not updating the permanent link." }

$env:GH_TOKEN = gh auth token --hostname github.com --user $GitHubUser
$changed = $false
foreach ($file in 'index.html', '404.html') {
  $meta = gh api "repos/$PagesRepo/contents/$file" | ConvertFrom-Json
  $current = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($meta.content -replace '\s', '')))
  $updated = [regex]::Replace($current, "var NYAYA_TARGET = '[^']*';", "var NYAYA_TARGET = '$TunnelUrl';")
  $updated = [regex]::Replace($updated, 'href="https://[a-z0-9.-]+"', "href=`"$TunnelUrl`"")
  if ($updated -eq $current) { Write-Output "$file already points to $TunnelUrl"; continue }
  $body = @{
    message = "Point permanent link to $TunnelUrl"
    content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($updated))
    sha     = $meta.sha
  } | ConvertTo-Json
  $body | gh api -X PUT "repos/$PagesRepo/contents/$file" --input - | Out-Null
  Write-Output "Updated $file"
  $changed = $true
}

$owner, $name = $PagesRepo.Split('/')
$pagesUrl = "https://$owner.github.io/$name/"
$deadline = (Get-Date).AddSeconds($WaitSeconds)
do {
  try {
    $page = Invoke-WebRequest -UseBasicParsing "$pagesUrl`?v=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" -TimeoutSec 20 -Headers @{ 'Cache-Control' = 'no-cache' }
    if ($page.Content -match [regex]::Escape("var NYAYA_TARGET = '$TunnelUrl';")) {
      Write-Output "Permanent link $pagesUrl now forwards to $TunnelUrl"
      exit 0
    }
  } catch { }
  if (-not $changed) { break }
  Start-Sleep -Seconds 10
} while ((Get-Date) -lt $deadline)
Write-Warning "Updated the Pages repo, but $pagesUrl is not serving the new address yet (GitHub Pages can take a few minutes)."
