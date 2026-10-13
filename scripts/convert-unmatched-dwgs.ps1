[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ConverterPath
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $repoRoot 'public/campus-maps'
$processedRoot = Join-Path $sourceRoot 'processed/unmatched'
$verifiedSources = @(
  'academic/main building.dwg',
  'other/Tilak hall NAC.dwg',
  'other/Mechanical Department.dwg',
  'academic/Electrical Department.dwg',
  'library/New library  GF.dwg',
  'other/Canteen.dwg',
  'other/Ladies Gymkhana.dwg',
  'other/exam hall with toilet.dwg',
  'other/vartak hall.dwg',
  'hostels/D1 Hostel.dwg',
  'hostels/Cyber Hostel.dwg',
  'other/Director Bunglow.dwg'
)

function Get-RelativePath([string]$BasePath, [string]$TargetPath) {
  $base = [IO.Path]::GetFullPath($BasePath).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
  $target = [IO.Path]::GetFullPath($TargetPath)
  if (-not $target.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) { throw "Path is outside expected root: $TargetPath" }
  return $target.Substring($base.Length)
}

$converterPath = (Resolve-Path -LiteralPath $ConverterPath -ErrorAction Stop).Path
if ([IO.Path]::GetExtension($converterPath) -ne '.exe') { throw 'ConverterPath must identify the ODA File Converter executable.' }
$python = (Get-Command python -ErrorAction Stop).Source
$dwgs = @(Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Filter '*.dwg' |
  Where-Object { $_.FullName -notlike (Join-Path $sourceRoot 'processed\*') } |
  Sort-Object FullName)
$unmatched = @($dwgs | Where-Object {
  $relative = Get-RelativePath $sourceRoot $_.FullName
  $relative = $relative.Replace('\', '/')
  $verifiedSources -notcontains $relative
})
$renderer = Join-Path $PSScriptRoot 'dxf_to_svg.py'
$inspector = Join-Path $PSScriptRoot 'inspect_building_dxf.py'
New-Item -ItemType Directory -Path $processedRoot -Force | Out-Null
$results = [Collections.Generic.List[object]]::new()
$inventoryPath = Join-Path $processedRoot 'conversion-inventory.json'
$previousResults = @()
if (Test-Path -LiteralPath $inventoryPath -PathType Leaf) {
  try { $previousResults = @((Get-Content -LiteralPath $inventoryPath -Raw | ConvertFrom-Json).results) }
  catch { throw "Existing conversion inventory is not readable; refusing to replace it: $inventoryPath" }
}
foreach ($previous in $previousResults) {
  if ($verifiedSources -contains $previous.sourceDwg) { $results.Add($previous) }
}

foreach ($source in $unmatched) {
  $relative = (Get-RelativePath $sourceRoot $source.FullName).Replace('\', '/')
  $slug = [regex]::Replace(($relative -replace '\.dwg$', '').ToLowerInvariant(), '[^a-z0-9]+', '-').Trim('-')
  $target = Join-Path $processedRoot $slug
  $result = [ordered]@{
    sourceDwg = $relative
    associationStatus = 'unmatched-source-drawing'
    outputDirectory = (Get-RelativePath $repoRoot $target).Replace('\', '/')
    status = 'failed'
    outputs = [ordered]@{ dxf = $null; svg = $null; inspection = $null }
    errors = [Collections.Generic.List[string]]::new()
  }
  $tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('campus-unmatched-dwg-' + [guid]::NewGuid().ToString('N'))
  try {
    $previous = $previousResults | Where-Object sourceDwg -eq $relative | Select-Object -First 1
    if ($previous) {
      $outputsValid = $true
      foreach ($kind in @('dxf', 'svg', 'inspection')) {
        $relativeOutput = $previous.outputs.$kind
        if (-not $relativeOutput) { $outputsValid = $false; break }
        $existingPath = Join-Path $repoRoot ($relativeOutput.Replace('/', [IO.Path]::DirectorySeparatorChar))
        if (-not (Test-Path -LiteralPath $existingPath -PathType Leaf) -or (Get-Item -LiteralPath $existingPath).Length -le 0) { $outputsValid = $false; break }
      }
      if ($outputsValid) {
        $existingReportPath = Join-Path $repoRoot ($previous.outputs.inspection.Replace('/', [IO.Path]::DirectorySeparatorChar))
        $existingReport = Get-Content -LiteralPath $existingReportPath -Raw | ConvertFrom-Json
        if ($existingReport.sourceDwg -eq $relative) {
          foreach ($property in $previous.PSObject.Properties) {
            if (-not $result.Contains($property.Name)) { $result[$property.Name] = $property.Value }
          }
          $result.status = $previous.status
          $result.outputs = $previous.outputs
          Write-Output "reused: $relative"
          continue
        }
      }
    }
    if (Test-Path -LiteralPath $target) { throw "Output already exists; refusing to overwrite: $target" }
    $inputDir = Join-Path $tempRoot 'input'
    $dxfDir = Join-Path $tempRoot 'dxf'
    New-Item -ItemType Directory -Path $inputDir, $dxfDir -Force | Out-Null
    Copy-Item -LiteralPath $source.FullName -Destination (Join-Path $inputDir $source.Name)
    $arguments = "`"$inputDir`" `"$dxfDir`" ACAD2018 DXF 0 1 *.dwg"
    $conversion = Start-Process -FilePath $converterPath -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
    if ($conversion.ExitCode -ne 0) { throw "ODA conversion failed with exit code $($conversion.ExitCode)." }
    $converted = Get-ChildItem -LiteralPath $dxfDir -Filter '*.dxf' -File | Select-Object -First 1
    if (-not $converted -or $converted.Length -eq 0) { throw 'ODA completed without creating a non-empty DXF.' }

    New-Item -ItemType Directory -Path $target -Force | Out-Null
    $base = [IO.Path]::GetFileNameWithoutExtension($source.Name)
    $dxf = Join-Path $target "$base.dxf"
    $svg = Join-Path $target "$base.svg"
    $report = Join-Path $target "$base.inspection.json"
    Copy-Item -LiteralPath $converted.FullName -Destination $dxf
    if ((Get-Item -LiteralPath $dxf).Length -le 0) { throw 'Copied DXF is empty.' }
    $result.outputs.dxf = (Get-RelativePath $repoRoot $dxf).Replace('\', '/')

    & $python $inspector $dxf $report --source-dwg $relative
    if ($LASTEXITCODE -ne 0) { $result.errors.Add("DXF inspection failed with exit code $LASTEXITCODE.") }
    elseif ((Test-Path -LiteralPath $report -PathType Leaf) -and (Get-Item -LiteralPath $report).Length -gt 0) {
      $result.outputs.inspection = (Get-RelativePath $repoRoot $report).Replace('\', '/')
    } else { $result.errors.Add('DXF inspector did not create a non-empty report.') }

    & $python $renderer $dxf $svg
    if ($LASTEXITCODE -ne 0) { $result.errors.Add("DXF to SVG rendering failed with exit code $LASTEXITCODE.") }
    elseif ((Test-Path -LiteralPath $svg -PathType Leaf) -and (Get-Item -LiteralPath $svg).Length -gt 0) {
      $result.outputs.svg = (Get-RelativePath $repoRoot $svg).Replace('\', '/')
    } else { $result.errors.Add('SVG renderer did not create a non-empty SVG.') }
    if ($result.errors.Count -eq 0) { $result.status = 'success' }
    elseif ($result.outputs.dxf -and $result.outputs.inspection) { $result.status = 'partial' }
  } catch {
    $result.errors.Add($_.Exception.Message)
    if ($result.outputs.dxf -and $result.outputs.inspection) { $result.status = 'partial' }
  } finally {
    $results.Add([pscustomobject]$result)
    $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
    $tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if ($resolvedTemp.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedTemp)) {
      Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
    }
  }
  Write-Output "$($result.status): $relative"
}

$inventory = [ordered]@{
  generatedAt = (Get-Date).ToString('o')
  sourceCount = $results.Count
  successfulCount = @($results | Where-Object status -eq 'success').Count
  partialCount = @($results | Where-Object status -eq 'partial').Count
  failedCount = @($results | Where-Object status -eq 'failed').Count
  associationPolicy = 'No building IDs are assigned by this batch. Source content requires manual association review.'
  results = @($results)
}
$inventory | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $inventoryPath -Encoding utf8
Write-Output "Batch complete: $($inventory.successfulCount) successful, $($inventory.partialCount) partial, $($inventory.failedCount) failed; inventory: $inventoryPath"
