[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('BU-001', 'BU-003', 'BU-007', 'BU-015', 'BU-025', 'BU-037', 'BU-040')]
  [string]$BuildingId,
  [Parameter(Mandatory = $true)]
  [string]$ConverterPath
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$sources = @{
  'BU-001' = 'public/campus-maps/other/Tilak hall NAC.dwg'
  'BU-003' = 'public/campus-maps/other/Mechanical Department.dwg'
  'BU-007' = 'public/campus-maps/academic/Electrical Department.dwg'
  'BU-015' = 'public/campus-maps/other/vartak hall.dwg'
  'BU-025' = 'public/campus-maps/hostels/D1 Hostel.dwg'
  'BU-037' = 'public/campus-maps/hostels/Cyber Hostel.dwg'
  'BU-040' = 'public/campus-maps/other/Director Bunglow.dwg'
}

$sourceRelative = $sources[$BuildingId]
$sourcePath = Join-Path $repoRoot $sourceRelative
$converterPath = (Resolve-Path -LiteralPath $ConverterPath).Path
if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) { throw "Mapped original DWG is missing: $sourceRelative" }
if ([IO.Path]::GetExtension($converterPath) -notin @('.exe', '.cmd', '.bat')) { throw 'ConverterPath must identify the ODA File Converter executable.' }

$sourceName = [IO.Path]::GetFileNameWithoutExtension($sourcePath)
$slug = [regex]::Replace($sourceName.ToLowerInvariant(), '[^a-z0-9]+', '-').Trim('-')
$outputRoot = Join-Path $repoRoot "public/campus-maps/processed/buildings/$BuildingId-$slug"
$resolvedOutputRoot = [IO.Path]::GetFullPath($outputRoot)
$processedRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'public/campus-maps/processed/buildings'))
if (-not $resolvedOutputRoot.StartsWith($processedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Output path escaped the processed building asset directory.' }
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("campus-building-dwg-" + [guid]::NewGuid().ToString('N'))
$inputDir = Join-Path $tempRoot 'input'
$dxfDir = Join-Path $tempRoot 'dxf'
New-Item -ItemType Directory -Path $inputDir, $dxfDir -Force | Out-Null

try {
  # ODA works on a copy in a temporary folder; the original source file is never passed for output.
  Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $inputDir ([IO.Path]::GetFileName($sourcePath)))
  $arguments = "`"$inputDir`" `"$dxfDir`" ACAD2018 DXF 0 1 *.dwg"
  $conversion = Start-Process -FilePath $converterPath -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
  if ($conversion.ExitCode -ne 0) { throw "ODA conversion failed with exit code $($conversion.ExitCode)." }

  $converted = Get-ChildItem -LiteralPath $dxfDir -Filter '*.dxf' -File | Select-Object -First 1
  if (-not $converted) { throw 'ODA completed without creating an ASCII DXF.' }

  $baseName = "$BuildingId-$slug"
  $outputDxf = Join-Path $outputRoot "$baseName.dxf"
  $outputSvg = Join-Path $outputRoot "$baseName.svg"
  $outputReport = Join-Path $outputRoot "$baseName.inspection.json"
  Copy-Item -LiteralPath $converted.FullName -Destination $outputDxf -Force

  $python = (Get-Command python -ErrorAction Stop).Source
  $renderer = Join-Path $PSScriptRoot 'dxf_to_svg.py'
  & $python $renderer $outputDxf $outputSvg
  if ($LASTEXITCODE -ne 0) { throw "DXF to SVG rendering failed with exit code $LASTEXITCODE." }

  $inspector = Join-Path $PSScriptRoot 'inspect_building_dxf.py'
  & $python $inspector $outputDxf $outputReport --building-id $BuildingId --source-dwg $sourceRelative
  if ($LASTEXITCODE -ne 0) { throw "DXF inspection failed with exit code $LASTEXITCODE." }

  $report = Get-Content -LiteralPath $outputReport -Raw | ConvertFrom-Json
  if ($report.rendererOmittedEntityTypes.Count -gt 0) {
    Write-Warning 'The SVG renderer omits entity types shown in the inspection report. Review the DXF before application integration.'
  }
  Write-Output "Converted files created under $outputRoot. Review the SVG and inspection JSON before adding a building plan association."
}
finally {
  $resolvedTempRoot = [IO.Path]::GetFullPath($tempRoot)
  $systemTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if ($resolvedTempRoot.StartsWith($systemTempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedTempRoot)) {
    Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
  }
}
