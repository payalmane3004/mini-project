"""Inspect the converted Main Building DXF and emit a cautious diagnostic."""

import argparse
import hashlib
import html
import math
import re
from collections import Counter, defaultdict
from pathlib import Path


def read_pairs(path):
    lines = path.read_text(encoding="cp1252", errors="replace").splitlines()
    return [(code.strip(), value.rstrip()) for code, value in zip(lines[0::2], lines[1::2])]


def read_sections(pairs):
    sections = defaultdict(list)
    section = None
    current = None
    awaiting_name = False
    for code, value in pairs:
        if code == "0" and value == "SECTION":
            section = None
            current = None
            awaiting_name = True
            continue
        if awaiting_name and code == "2":
            section = value.strip()
            awaiting_name = False
            continue
        if section is None:
            continue
        if code == "0" and value == "ENDSEC":
            if current:
                sections[section].append(current)
            section = None
            current = None
            continue
        if code == "0":
            if current:
                sections[section].append(current)
            current = {"type": value.strip(), "pairs": []}
        elif current:
            try:
                current["pairs"].append((int(code), value))
            except ValueError:
                pass
    return sections


def get_values(record, code):
    return [value for group, value in record["pairs"] if group == code]


def value(record, code, default=""):
    found = get_values(record, code)
    return found[0] if found else default


def number(record, code, default=0.0):
    try:
        return float(value(record, code, default))
    except (TypeError, ValueError):
        return float(default)


def read_header(pairs):
    header = {}
    index = 0
    while index < len(pairs):
        code, name = pairs[index]
        if code != "9" or not name.startswith("$"):
            index += 1
            continue
        index += 1
        values = []
        while index < len(pairs) and pairs[index][0] != "9":
            values.append(pairs[index])
            index += 1
        header[name] = values
    return header


def header_number(header, name, code):
    return next((v.strip() for c, v in header.get(name, []) if c == code), None)


def clean_text(text):
    text = re.sub(r"\\f[^;]*;", "", text)
    text = text.replace("\\P", " ").replace("\\~", " ")
    text = re.sub(r"\\[A-Za-z][^;]*;", "", text)
    text = text.replace("\\L", "").replace("\\l", "")
    text = text.replace("{", "").replace("}", "")
    text = re.sub(r"\s*/\s*", "/", text)
    return re.sub(r"\s+", " ", text).strip()


def text_content(record):
    # MTEXT continuation chunks (group 3) precede the final group 1 chunk.
    return clean_text("".join(get_values(record, 3) + get_values(record, 1)))


def entity_points(record):
    kind = record["type"]
    if kind == "LINE":
        return [(number(record, 10), number(record, 20)), (number(record, 11), number(record, 21))]
    if kind == "LWPOLYLINE":
        xs, ys = get_values(record, 10), get_values(record, 20)
        points = []
        for x, y in zip(xs, ys):
            try:
                points.append((float(x), float(y)))
            except ValueError:
                pass
        return points
    if kind in {"TEXT", "MTEXT", "ATTRIB", "ATTDEF"}:
        return [(number(record, 10), number(record, 20))]
    return []


def polygon_area(points):
    if len(points) < 3:
        return 0.0
    return abs(sum(
        points[i][0] * points[(i + 1) % len(points)][1]
        - points[(i + 1) % len(points)][0] * points[i][1]
        for i in range(len(points))
    )) / 2


def escaped(value):
    return html.escape(str(value), quote=True)


def make_diagnostic(entities, output, split_y, floor_title_y):
    bands = [
        ("Ground Floor", -math.inf, split_y),
        ("First Floor", split_y, math.inf),
    ]
    page_width, page_height = 1240, 610
    panel_width, panel_height = 586, 500
    panel_xs = (24, 630)
    elements = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {page_width} {page_height}" role="img" aria-labelledby="title description">',
        '<title id="title">Main Building floor plan linework candidates</title>',
        '<desc id="description">Diagnostic split of candidate linework by the two floor drawing regions. Orange linework is unclassified; magenta loops are not confirmed rooms.</desc>',
        '<rect width="1240" height="610" fill="#e9eef3"/>',
        '<text x="24" y="27" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#18212b">Main Building CAD inspection — candidate geometry only</text>',
    ]

    for (floor, y_min, y_max), panel_x in zip(bands, panel_xs):
        candidates = []
        annotations = []
        for entity in entities:
            layer = value(entity, 8, "0").strip()
            kind = entity["type"]
            if layer != "window" or kind not in {"LINE", "LWPOLYLINE", "MTEXT"}:
                continue
            points = entity_points(entity)
            if not points:
                continue
            center_y = sum(y for _, y in points) / len(points)
            if not (y_min <= center_y < y_max):
                continue
            if kind == "MTEXT":
                label = text_content(entity)
                if label:
                    annotations.append((points[0], label, number(entity, 40, 0.5)))
            else:
                candidates.append((entity, points))

        all_points = [point for _, points in candidates for point in points]
        all_points.extend(point for point, _, _ in annotations)
        min_x = min(x for x, _ in all_points)
        max_x = max(x for x, _ in all_points)
        min_y = min(y for _, y in all_points)
        max_y = max(y for _, y in all_points)
        pad_x = max((max_x - min_x) * 0.04, 3)
        pad_y = max((max_y - min_y) * 0.08, 3)
        view_min_x, view_max_x = min_x - pad_x, max_x + pad_x
        view_min_y, view_max_y = min_y - pad_y, max_y + pad_y
        draw_x, draw_y = panel_x + 15, 83
        draw_w, draw_h = panel_width - 30, 390
        scale = min(draw_w / (view_max_x - view_min_x), draw_h / (view_max_y - view_min_y))
        content_w = (view_max_x - view_min_x) * scale
        content_h = (view_max_y - view_min_y) * scale
        offset_x = draw_x + (draw_w - content_w) / 2
        offset_y = draw_y + (draw_h - content_h) / 2

        def svg_point(point):
            x, y = point
            return offset_x + (x - view_min_x) * scale, offset_y + (view_max_y - y) * scale

        elements.append(f'<rect x="{panel_x}" y="45" width="{panel_width}" height="{panel_height}" rx="7" fill="#fff" stroke="#c5ced8"/>')
        elements.append(f'<text x="{panel_x+16}" y="70" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#18212b">{floor}</text>')
        title_y = floor_title_y.get(floor)
        if title_y is not None:
            elements.append(f'<text x="{panel_x+16}" y="83" font-family="Arial,sans-serif" font-size="9" fill="#66758a">Source title text at model Y={title_y:.3f}</text>')

        for entity, points in candidates:
            mapped = [svg_point(point) for point in points]
            d = " ".join(("M" if index == 0 else "L") + f"{x:.2f},{y:.2f}" for index, (x, y) in enumerate(mapped))
            closed = entity["type"] == "LWPOLYLINE" and bool(int(number(entity, 70)) & 1)
            if closed:
                d += " Z"
            color = "#bd4c8a" if closed else "#d97706"
            dash = ' stroke-dasharray="4 3"' if closed else ""
            elements.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="0.8"{dash}/>')

        for (x, y), label, source_height in annotations:
            px, py = svg_point((x, y))
            font_size = max(5.5, min(source_height * scale * 2.4, 10))
            elements.append(f'<text x="{px:.2f}" y="{py:.2f}" font-family="Arial,sans-serif" font-size="{font_size:.2f}" fill="#2563a6">{escaped(label)}</text>')

        line_count = sum(entity["type"] == "LINE" for entity, _ in candidates)
        poly_count = sum(entity["type"] == "LWPOLYLINE" for entity, _ in candidates)
        elements.append(f'<text x="{panel_x+16}" y="{panel_height+33}" font-family="Arial,sans-serif" font-size="9" fill="#586779">{line_count} LINE and {poly_count} closed LWPOLYLINE candidates from layer “window”; annotations are blue.</text>')

    elements.extend([
        '<circle cx="36" cy="575" r="4" fill="#d97706"/><text x="47" y="579" font-family="Arial,sans-serif" font-size="10" fill="#334155">Unclassified linework — not confirmed walls</text>',
        '<circle cx="296" cy="575" r="4" fill="#bd4c8a"/><text x="307" y="579" font-family="Arial,sans-serif" font-size="10" fill="#334155">Closed loops — not confirmed room boundaries</text>',
        '<circle cx="640" cy="575" r="4" fill="#2563a6"/><text x="651" y="579" font-family="Arial,sans-serif" font-size="10" fill="#334155">CAD text annotations</text>',
        '<text x="24" y="600" font-family="Arial,sans-serif" font-size="9" fill="#66758a">Diagnostic only: source coordinates retained within each panel; floor separation inferred from title/annotation clusters. No georeferencing or room polygons created.</text>',
        '</svg>',
    ])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(elements), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dxf", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--diagnostic", type=Path, required=True)
    args = parser.parse_args()

    pairs = read_pairs(args.dxf)
    sections = read_sections(pairs)
    entities = sections.get("ENTITIES", [])
    layer_rows = [record for record in sections.get("TABLES", []) if record["type"] == "LAYER"]
    header = read_header(pairs)
    counts = Counter(entity["type"] for entity in entities)
    per_layer = defaultdict(Counter)
    for entity in entities:
        per_layer[value(entity, 8, "0").strip() or "0"][entity["type"]] += 1
    defined_layers = {value(layer, 2).strip() for layer in layer_rows}

    closed_areas = []
    for entity in entities:
        if entity["type"] != "LWPOLYLINE" or not (int(number(entity, 70)) & 1):
            continue
        closed_areas.append((polygon_area(entity_points(entity)), value(entity, 8, "0").strip()))

    measurements = [number(entity, 42) for entity in entities if entity["type"] == "DIMENSION" and value(entity, 42)]
    texts = [(text_content(entity), number(entity, 10), number(entity, 20), value(entity, 8, "0").strip())
             for entity in entities if entity["type"] == "MTEXT"]
    floor_title_y = {}
    for title in ("Ground Floor", "First Floor"):
        found = next((y for text, _, y, _ in texts if title.lower() in text.lower()), None)
        if found is not None:
            floor_title_y[title] = found

    room_label_points = [y for text, _, y, layer in texts
                         if layer == "window" and text and not text.upper() in {"UP", "DOWN"}
                         and "GROUND FLOOR" not in text.upper() and "FIRST FLOOR" not in text.upper()]
    low_texts = [y for y in room_label_points if y < 100]
    high_texts = [y for y in room_label_points if y >= 100]
    split_y = (max(low_texts) + min(high_texts)) / 2 if low_texts and high_texts else 105.0

    def plan_bounds(low, high):
        points = []
        for entity in entities:
            if value(entity, 8, "0").strip() != "window" or entity["type"] not in {"LINE", "LWPOLYLINE"}:
                continue
            vertices = entity_points(entity)
            if vertices and low <= sum(y for _, y in vertices) / len(vertices) < high:
                points.extend(vertices)
        if not points:
            return None
        return (min(x for x, _ in points), min(y for _, y in points),
                max(x for x, y in points), max(y for x, y in points))

    ground_bounds = plan_bounds(-math.inf, split_y)
    first_bounds = plan_bounds(split_y, math.inf)
    nonempty_layers = {layer for layer, counts_by_type in per_layer.items() if sum(counts_by_type.values())}
    unused_arch_layers = sorted(layer for layer in defined_layers
                                if any(key in layer.lower() for key in ("wall", "door", "win", "stair", "corr"))
                                and layer not in nonempty_layers)

    labels = sorted({text for text, _, _, _ in texts if text and "FLOOR" not in text.upper()
                     and "WALCHAND COLLEGE" not in text.upper() and "MAIN BUILDING" not in text.upper()})
    ups = [(x, y) for text, x, y, _ in texts if text.strip().upper() == "UP"]
    all_mtext_points = [point for entity in entities if entity["type"] == "MTEXT" for point in entity_points(entity)]
    min_x = float(header_number(header, "$EXTMIN", "10") or 0)
    min_y = float(header_number(header, "$EXTMIN", "20") or 0)
    max_x = float(header_number(header, "$EXTMAX", "10") or 0)
    max_y = float(header_number(header, "$EXTMAX", "20") or 0)
    units_code = header_number(header, "$INSUNITS", "70")
    units = {"0": "unitless", "1": "inches", "2": "feet", "4": "millimeters", "5": "centimeters", "6": "meters"}.get((units_code or "").strip(), f"code {units_code}")

    make_diagnostic(entities, args.diagnostic, split_y, floor_title_y)

    def fmt_bounds(bounds):
        return "unavailable" if not bounds else f"x={bounds[0]:.2f}..{bounds[2]:.2f}, y={bounds[1]:.2f}..{bounds[3]:.2f}"

    report = [
        "# Main Building CAD inspection — Phase 1",
        "",
        "## Source and method",
        "",
        "- Original source: `public/campus-maps/academic/main building.dwg` (unchanged).",
        f"- Inspected converted file: `{args.dxf.as_posix()}`.",
        "- Conversion: ODA File Converter 27.9, DWG to ACAD2018 DXF, local/offline. The existing production SVG was not overwritten.",
        f"- Converted DXF SHA-256: `{hashlib.sha256(args.dxf.read_bytes()).hexdigest()}`.",
        "- DXF inspection is limited to model-space entities and header/table metadata; block definitions are not expanded into presumed walls.",
        "",
        "## Units, extents, and dimensions",
        "",
        f"- `$INSUNITS` declares **{units}** (code {units_code}); `$MEASUREMENT` is {header_number(header, '$MEASUREMENT', '70') or 'not set'} and `$DIMLFAC` is {header_number(header, '$DIMLFAC', '40') or 'not set'}.",
        f"- Header extents: X `{min_x:.3f}..{max_x:.3f}`, Y `{min_y:.3f}..{max_y:.3f}`, Z `{header_number(header, '$EXTMIN', '30') or '0'}..{header_number(header, '$EXTMAX', '30') or '0'}` ({max_x-min_x:.3f} by {max_y-min_y:.3f} drawing units). These include the sheet/frame extent.",
        f"- {len(measurements)} DIMENSION entities have measured values from `{min(measurements):.3f}` to `{max(measurements):.3f}` drawing units; dimension text is generated through anonymous dimension blocks and no group-1 text overrides were found.",
        "- The header's inch declaration is not safe to treat as verified physical scale: the drawing's local layout extents and dimension values do not provide a known overall building measurement to cross-check the units. No unit conversion or scale factor has been applied.",
        "- No wall-height or floor-to-floor-height data was found in the inspected model-space entities/header. Wall heights remain unknown.",
        "",
        "## Model-space entity inventory",
        "",
        "| Entity | Count |",
        "|---|---:|",
    ]
    report.extend(f"| `{kind}` | {count} |" for kind, count in counts.most_common())
    report.extend(["", "### Layer findings", "", "| Layer | Model-space entities |", "|---|---|"])
    for layer, by_type in sorted(per_layer.items(), key=lambda item: sum(item[1].values()), reverse=True):
        report.append(f"| `{layer}` | " + ", ".join(f"{kind} {count}" for kind, count in by_type.most_common()) + " |")
    report.extend([
        "",
        f"- The layer table defines {len(defined_layers)} layers. The following architectural layer names are present but have no model-space entities: "
        + ", ".join(f"`{layer}`" for layer in unused_arch_layers) + ".",
        "- Nearly all plan linework, labels, leaders, and the two INSERTs are assigned to the single lowercase layer `window`; its name therefore cannot be used to classify those entities as actual windows. The `WALL`, `DOOR`, `WIN`, `staircase`, `CORRIDOOR`, and `A-Wall` table names are not populated with model-space wall/opening geometry.",
        "",
        "## Floor layouts and labels",
        "",
        f"- The source contains MTEXT title labels `Ground Floor` at Y `{floor_title_y.get('Ground Floor', 0):.3f}` and `First Floor` at Y `{floor_title_y.get('First Floor', 0):.3f}`. Their plan linework occupies separate lower and upper local-coordinate regions, split diagnostically at Y `{split_y:.3f}` (the split is inferred from text clusters, not a CAD floor layer).",
        f"- Ground Floor candidate linework bounds: `{fmt_bounds(ground_bounds)}`.",
        f"- First Floor candidate linework bounds: `{fmt_bounds(first_bounds)}`.",
        "- The drawing title text reads `Main Building`; the sheet heading reads `WALCHAND COLLEGE OF ENGINEERING, SANGLI`. Other source text includes: "
        + "; ".join(f"`{label}`" for label in labels) + ".",
        f"- Three `UP` MTEXT markers were found at " + ", ".join(f"`({x:.2f}, {y:.2f})`" for x, y in ups) + ". They may indicate stairs, but no stair geometry was isolated by layer or entity type. No reliable separate corridor entities were identified.",
        "- Labels and floor titles are annotations only. No room-number-to-boundary relationships or room polygons were derived.",
        "",
        "## Boundary and opening assessment",
        "",
        f"- There are {counts.get('LINE', 0)} model-space LINEs and {counts.get('LWPOLYLINE', 0)} closed LWPOLYLINEs. Of the closed polylines, {sum(layer == 'window' for _, layer in closed_areas)} are on the ambiguous `window` layer; their enclosed areas are small (maximum `{max((area for area, layer in closed_areas if layer == 'window'), default=0):.3f}` square drawing units). The only large closed outline is the sheet/frame on layer `0`, not a room boundary.",
        "- Wall-like parallel line pairs may be present in the 3,603 LINEs assigned to `window`, but the converted file presents most entities on this one ambiguous layer. It is not established whether that reflects the source DWG or the conversion. Together with the lack of closed room outlines, this prevents reliable wall/room extraction. Treat this linework as unclassified candidates, not confirmed walls.",
        "- Explicit model-space DOOR/WIN/staircase/corridor layer geometry was not found. The two INSERTs are both named `urinal_p07`; no door/window INSERTs are present. Openings cannot be distinguished reliably from nearby linework.",
        "- The 26 dimensions may help with local measurements, but without a trusted overall dimension or agreement between declared units and known building size they do not establish a reliable global scale.",
        "",
        "## Reconstruction readiness and recommendation",
        "",
        "**Not ready for reliable automatic 3D wall/room reconstruction.** The DXF has useful floor labels, room text, and dense plan linework, but the converted file presents most active plan linework and labels on one ambiguous layer, closed loops do not correspond to room boundaries, openings are not classified, and the header's unit declaration cannot be independently validated. Wall heights are absent.",
        "",
        "1. Confirm one labeled dimension against a trusted measured building dimension and establish the intended model units/scale.",
        "2. Review the original DWG in a CAD viewer with layer visibility and block inspection, and compare its assignments with the converted DXF; identify actual wall centerlines/edges, door/window openings, and stairs on each floor.",
        "3. Trace/validate closed room boundaries per floor and associate labels manually only where the drawing clearly supports them.",
        "4. Obtain surveyed wall and floor-to-floor heights before creating 3D walls. Keep unmatched areas as unresolved linework rather than inferred rooms.",
        "",
        "## Diagnostic artifact",
        "",
        f"- `{args.diagnostic.as_posix()}` colors all candidate LINEs orange, small closed LWPOLYLINEs magenta, and CAD text blue. These are explicitly unverified candidates/annotations; dimension objects, leaders, block contents, and sheet geometry are omitted from that split view.",
        "- No campus coordinates, camera settings, footprint JSON, source DWG, or existing `main-building.svg` were modified by the inspection.",
        "",
    ])
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text("\n".join(report), encoding="utf-8")
    print(f"Wrote report: {args.report}")
    print(f"Wrote diagnostic: {args.diagnostic}")
    print(f"Entities: {dict(counts)}")


if __name__ == "__main__":
    main()
