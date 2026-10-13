# Repeatable non-Main Building DWG integration workflow

## Pilot and current status

Pilot: **BU-007 Electrical Department**, source `public/campus-maps/academic/Electrical Department.dwg`. The campus CAD label `Electrical Deptt` and drawing filename support this association. The DWG header signature is `AC1024` (AutoCAD 2010). No converted pilot DXF/SVG or geometry inspection was produced in this environment.

The only current processed building plan assets remain the existing Main Building files. This pilot does not render in the application yet. No Main Building source, architecture, viewer, or processed asset was edited.

## Tool audit and blocker

- `ODAFileConverter`, `TeighaFileConverter`, `dwgread`, `dwg2dxf`, and `libredwg` are not on `PATH`.
- Python has no `ezdxf`, `odafc`, or Aspose CAD package. Project dependencies include no DWG parser.
- WinGet search for `ODA File Converter` returned no package.
- The existing `scripts/convert-dwg-map.ps1` requires an ODA File Converter executable and only emits SVG; it discards its temporary converted DXF. It is inadequate for retaining and inspecting a new source conversion.
- The ODA official download page lists a Windows x64 MSI and the tool’s directory-based CLI. The official FAQ states that non-members may use the converter for non-commercial applications. Downloading the official MSI did not yield a usable converter here: Windows Installer administrative extraction returned error **1619**, no executable was extracted, and no conversion ran. The original DWG remains untouched.

Minimum action to complete this pilot: install the official [ODA File Converter for Windows x64](https://www.opendesign.com/guestfiles/oda_file_converter?language=en), then provide the installed `ODAFileConverter.exe` path (or make it available on `PATH`). The project’s existing CLI expects source directory, target directory, output version/type, recursive flag, audit flag, and input filter.

## Repeatable conversion and inspection

Once ODA File Converter is installed, from the project root run:

```powershell
./scripts/convert-building-dwg.ps1 -BuildingId BU-007 -ConverterPath 'C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe'
```

The script validates the selected ID against its exact source mapping, copies the original DWG into a temporary input folder, asks ODA for ACAD2018 DXF, preserves the converted DXF under `public/campus-maps/processed/buildings/`, renders an SVG with the existing renderer, and writes an inspection JSON. It does not write to the original DWG. The inspector reports model-space entity counts, layers, extents, `$INSUNITS`, and literal TEXT/MTEXT labels. It explicitly reports entity types omitted by the current SVG renderer and does not infer floor organization or architectural meaning.

Review the inspection JSON and rendered SVG against the original in a CAD viewer before application integration. If the SVG renderer omits geometry types used in the pilot, extend and validate the renderer against those actual source entities before linking the SVG in the app. Add an ID-to-plan entry only after confirming floor organization, labels, bounds, and rendering fidelity. Reconstruct wall geometry only from supported source lines after manual evidence review; do not infer rooms, doors, windows, stairs, or facility assignments from proximity alone.

The script accepts the seven currently verified non-Main source IDs: `BU-001`, `BU-003`, `BU-007`, `BU-015`, `BU-025`, `BU-037`, and `BU-040`. It deliberately excludes `BU-002` Main Building.
