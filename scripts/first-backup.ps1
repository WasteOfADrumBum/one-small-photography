<#
.SYNOPSIS
  Takes a private off-site backup of the OneSmallPhoto production database.

.DESCRIPTION
  Wraps the repository's own scripts (scripts/db-backup.mjs, then
  scripts/verify-backup.mjs). Read-only against the database. The database
  address is typed at a hidden prompt, lives only in this process's environment
  while the backup runs, and is never printed or written to disk.

  The backup goes to a folder OUTSIDE the repository, which only your Windows
  account can open. The file holds private data (contact messages, the admin
  password hash): never commit it, email it, or put it in a shared folder.

.PARAMETER Destination
  Folder for backup files. Default: <your profile>\OneSmallPhoto-Backups

.PARAMETER CheckOnly
  Checks Node, the repo and the destination, then stops. Does not ask for the
  database address, connect, or create anything. Run this first.

.EXAMPLE
  .\scripts\first-backup.ps1 -CheckOnly
  .\scripts\first-backup.ps1
#>
[CmdletBinding()]
param(
  [string]$Destination = (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'OneSmallPhoto-Backups'),
  [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
  Write-Host "ERROR: $Message" -ForegroundColor Red
  exit 1
}
function Ok([string]$Message) { Write-Host "  ok  $Message" -ForegroundColor Green }

# Anything the child scripts print is shown with the database address and password blanked out.
$script:secrets = @()
function Show([object]$Line) {
  $text = "$Line"
  foreach ($s in $script:secrets) { if ($s) { $text = $text.Replace($s, '***') } }
  Write-Host "  $text"
}

$onWindows = [Environment]::OSVersion.Platform -eq 'Win32NT'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Write-Host "OneSmallPhoto first off-site backup"

# 1. Right place, right tools.
foreach ($f in 'scripts\db-backup.mjs', 'scripts\verify-backup.mjs', 'package.json') {
  if (-not (Test-Path (Join-Path $repo $f))) { Fail "Run this from a checkout of one-small-photography (missing $f)." }
}
Ok "repository at $repo"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail 'Node.js is not installed. Install Node 22 LTS from nodejs.org, then reopen PowerShell.' }
$nodeVersion = [version](& node --version).TrimStart('v')
if ($nodeVersion -lt [version]'22.12.0') { Fail "Node $nodeVersion is too old; this repo needs 22.12 or newer." }
Ok "Node $nodeVersion"

if (-not (Test-Path (Join-Path $repo 'node_modules\pg'))) {
  Fail "Dependencies are not installed. Run:  cd '$repo'; npm ci"
}
Ok 'npm dependencies installed'

# 2. The destination must be outside the repo, so the backup can never be committed.
$dest = [IO.Path]::GetFullPath($Destination).TrimEnd('\', '/')
$repoFull = [IO.Path]::GetFullPath($repo).TrimEnd('\', '/')
$cmp = if ($onWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
if ($dest.Equals($repoFull, $cmp) -or $dest.StartsWith($repoFull + [IO.Path]::DirectorySeparatorChar, $cmp)) {
  Fail "The destination ($dest) is inside the repository. Choose a folder outside it."
}
Ok "destination $dest is outside the repository"
if ($dest -match 'OneDrive|Dropbox|Google Drive|iCloud') {
  Write-Host "  WARN $dest looks like a cloud-synced folder. The file is private and not encrypted; prefer a local or BitLocker/encrypted drive folder." -ForegroundColor Yellow
}

if ($CheckOnly) {
  Write-Host "`nChecks passed. Nothing was created and the database was not contacted."
  Write-Host 'Run again without -CheckOnly to take the backup.'
  exit 0
}

# 3. Private destination folder (owner-only access).
if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }
if ($onWindows) {
  & icacls $dest /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail 'Could not restrict the backup folder to your account.' }
} else {
  & chmod 700 $dest
}
Ok 'backup folder is private to your account'

# 4. Ask for the database address without showing or saving it.
Write-Host "`nIn Neon: project OneSmallPhoto > Dashboard > Connect > branch 'production' > copy the connection string."
$secure = Read-Host 'Paste the Neon connection string (hidden)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if ($plain -notmatch '^postgres(ql)?://') { Fail 'That is not a postgres:// connection string. Nothing was run.' }
if ($plain -match '@(localhost|127\.0\.0\.1)[:/]') { Fail 'That points at this computer, not production. Nothing was run.' }

# Remember the whole address and its password part, only to blank them out of any printed output.
$script:secrets = @($plain)
if ($plain -match '^postgres(ql)?://[^:/@]+:([^@]+)@') { $script:secrets += $Matches[2] }

$stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd-HHmmss') + 'Z'
$file = Join-Path $dest "onesmallphoto-db-$stamp.json"
if (Test-Path $file) { Fail "$file already exists." }

# 5. Back up (read-only), then verify. The address exists only in this process.
$previous = $env:DATABASE_URL
$env:DATABASE_URL = $plain
$plain = $null
$prevPref = $ErrorActionPreference
try {
  $ErrorActionPreference = 'Continue'   # Windows PowerShell 5.1 treats a native tool's stderr as an error
  Write-Host "`nBacking up..."
  & node (Join-Path $repo 'scripts\db-backup.mjs') $file 2>&1 | ForEach-Object { Show $_ }
  $backupExit = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $prevPref
  if ($null -eq $previous) { Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue } else { $env:DATABASE_URL = $previous }
}
if ($backupExit -ne 0 -or -not (Test-Path $file)) {
  if (Test-Path $file) { Remove-Item $file -Force }
  Fail 'The backup did not complete; no file was kept. (Check the connection string and your network.)'
}

Write-Host "`nVerifying the file..."
$ErrorActionPreference = 'Continue'
$verifyOutput = & node (Join-Path $repo 'scripts\verify-backup.mjs') $file 2>&1
$verifyExit = $LASTEXITCODE
$ErrorActionPreference = $prevPref
$verifyOutput | ForEach-Object { Show $_ }
if ($verifyExit -ne 0) { Fail "The backup file failed verification. Keep it for inspection but do not rely on it: $file" }

$script:secrets = @()

# 6. Record the checksum next to the file so later copies can be compared.
$hash = (Get-FileHash -Algorithm SHA256 -Path $file).Hash.ToLower()
Set-Content -Path "$file.sha256" -Value "$hash  $(Split-Path $file -Leaf)" -Encoding ascii

Write-Host "`nDone." -ForegroundColor Green
Write-Host "  File:   $file"
Write-Host "  SHA256: $hash"
Write-Host "`nNext (by hand):"
Write-Host '  1. Copy the file and its .sha256 to a second private place (an encrypted external drive).'
Write-Host '  2. Compare checksums on the copy:  Get-FileHash <copy> -Algorithm SHA256'
Write-Host '  3. Never commit it, email it or put it in a shared folder.'
Write-Host '  4. Record the date and location in docs/RELEASE.md section 6.'
