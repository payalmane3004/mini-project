[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$python = (Get-Command python -ErrorAction Stop).Source
$renderer = Join-Path $PSScriptRoot 'dxf_to_svg.py'
$inspector = Join-Path $PSScriptRoot 'inspect_building_dxf.py'
$processedRoot = Join-Path $repoRoot 'public/campus-maps/processed'
$inspectionFiles = @(Get-ChildItem -LiteralPath $processedRoot -Recurse -File -Filter '*.inspection.json' |
  Where-Object { $_.FullName -match '[\\/]processed[\\/](buildings|unmatched)[\\/]' } |
  Sort-Object FullName)
$failures = [Collections.Generic.List[string]]::new()

foreach ($inspection in $inspectionFiles) {
  $existing = Get-Content -LiteralPath $inspection.FullName -Raw | ConvertFrom-Json
  $dxf = Join-Path $inspection.DirectoryName ($inspection.Name -replace '\.inspection\.json$', '.dxf')
  $svg = Join-Path $inspection.DirectoryName ($inspection.Name -replace '\.inspection\.json$', '.svg')
  if (-not $existing.sourceDwg -or -not (Test-Path -LiteralPath $dxf -PathType Leaf)) {
    $failures.Add("Missing source association or processed DXF: $($inspection.FullName)")
    continue
  }
  & $python $renderer $dxf $svg
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $svg -PathType Leaf) -or (Get-Item -LiteralPath $svg).Length -le 0) {
    $failures.Add("SVG regeneration failed for $($existing.sourceDwg) (exit $LASTEXITCODE)")
    continue
  }
  $inspectArgs = @($inspector, $dxf, $inspection.FullName, '--source-dwg', $existing.sourceDwg)
  if ($existing.buildingId) { $inspectArgs += @('--building-id', $existing.buildingId) }
  & $python @inspectArgs | Out-Null
  if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $inspection.FullName).Length -le 0) {
    $failures.Add("DXF inspection refresh failed for $($existing.sourceDwg) (exit $LASTEXITCODE)")
    continue
  }
  Write-Output "Updated: $($existing.sourceDwg)"
}

if ($failures.Count) {
  $failures | ForEach-Object { Write-Error $_ }
  exit 1
}
Write-Output "Preview and inspection refresh passed for $($inspectionFiles.Count) non-Main-Building processed drawings."
