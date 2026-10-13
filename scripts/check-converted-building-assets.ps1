[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$inventoryPath = Join-Path $repoRoot 'public/campus-maps/processed/unmatched/conversion-inventory.json'
$inventory = Get-Content -LiteralPath $inventoryPath -Raw | ConvertFrom-Json
$problems = [Collections.Generic.List[string]]::new()

foreach ($result in $inventory.results) {
  $sourcePath = Join-Path (Join-Path $repoRoot 'public/campus-maps') $result.sourceDwg
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf) -or (Get-Item -LiteralPath $sourcePath).Length -le 0) {
    $problems.Add("Missing or empty source DWG: $($result.sourceDwg)")
  }
  if ($result.status -ne 'success') { $problems.Add("Conversion was not fully successful: $($result.sourceDwg) ($($result.status))") }
  foreach ($kind in @('dxf', 'svg', 'inspection')) {
    $relative = $result.outputs.$kind
    if (-not $relative) { $problems.Add("No $kind output recorded for $($result.sourceDwg)"); continue }
    $path = Join-Path $repoRoot ($relative.Replace('/', [IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or (Get-Item -LiteralPath $path).Length -le 0) {
      $problems.Add("Missing or empty $kind output for $($result.sourceDwg): $relative")
    }
  }
}

$drawingMap = Get-Content -LiteralPath (Join-Path $repoRoot 'src/data/buildingDrawings.js') -Raw
$assetUrls = [regex]::Matches($drawingMap, '(?:previewUrl|inspectionUrl|sourceUrl)\s*:\s*"(?<url>/campus-maps/[^"]+)"')
foreach ($match in $assetUrls) {
  $relative = [Uri]::UnescapeDataString($match.Groups['url'].Value.Substring(1))
  $path = Join-Path $repoRoot ('public/' + $relative.Replace('/', [IO.Path]::DirectorySeparatorChar))
  if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or (Get-Item -LiteralPath $path).Length -le 0) {
    $problems.Add("Missing or empty application asset: $relative")
  }
}

if ($problems.Count) {
  $problems | ForEach-Object { Write-Error $_ }
  exit 1
}
Write-Output "Asset check passed: $($inventory.sourceCount) source DWGs and DXF/SVG/report outputs, plus $($assetUrls.Count) application asset references, exist and are non-empty. Conversion: $($inventory.successfulCount) success, $($inventory.partialCount) partial, $($inventory.failedCount) failed."
