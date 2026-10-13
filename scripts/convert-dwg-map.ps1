param(
  [Parameter(Mandatory = $true)]
  [string]$Drawing,
  [Parameter(Mandatory = $true)]
  [string]$ConverterPath,
  [string]$OutputSvg
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$drawingPath = (Resolve-Path -LiteralPath $Drawing).Path
$converter = (Resolve-Path -LiteralPath $ConverterPath).Path
$python = (Get-Command python -ErrorAction Stop).Source
$svgRenderer = Join-Path $PSScriptRoot "dxf_to_svg.py"
$baseName = [IO.Path]::GetFileNameWithoutExtension($drawingPath)

if ([IO.Path]::GetExtension($drawingPath).ToLowerInvariant() -ne ".dwg") {
  throw "Input must be a DWG file: $drawingPath"
}

if (-not $OutputSvg) {
  $slug = [regex]::Replace($baseName.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim("-")
  $OutputSvg = Join-Path $repoRoot "public\campus-maps\processed\$slug.svg"
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("campus-dwg-" + [guid]::NewGuid().ToString("N"))
$inputDir = Join-Path $tempRoot "input"
$outputDir = Join-Path $tempRoot "dxf"
New-Item -ItemType Directory -Path $inputDir, $outputDir -Force | Out-Null

try {
  Copy-Item -LiteralPath $drawingPath -Destination $inputDir
  $arguments = @($inputDir, $outputDir, "ACAD2018", "DXF", "0", "1", "*.dwg")
  $process = Start-Process -FilePath $converter -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
  if ($process.ExitCode -ne 0) {
    throw "ODA File Converter failed with exit code $($process.ExitCode)."
  }

  $converted = Get-ChildItem -LiteralPath $outputDir -Filter "*.dxf" -File | Select-Object -First 1
  if (-not $converted) {
    throw "The converter completed without creating a DXF file."
  }

  & $python $svgRenderer $converted.FullName $OutputSvg
  if ($LASTEXITCODE -ne 0) {
    throw "DXF to SVG extraction failed with exit code $LASTEXITCODE."
  }
}
finally {
  $resolvedTempRoot = [IO.Path]::GetFullPath($tempRoot)
  $systemTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if ($resolvedTempRoot.StartsWith($systemTempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedTempRoot)) {
    Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
  }
}
