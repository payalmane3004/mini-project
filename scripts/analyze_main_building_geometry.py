"""Experimental, non-destructive geometric analysis of the Main Building DXF.

Uses only Python's standard library. Parallel pairs are evidence for review,
not verified walls. Coordinates are preserved in the source DXF coordinate
system; no scale conversion or room construction is performed.
"""

import argparse
import html
import math
from collections import Counter, defaultdict
from pathlib import Path


def parse_entities(path):
    lines = path.read_text(encoding="cp1252", errors="replace").splitlines()
    pairs = list(zip(lines[0::2], lines[1::2]))
    in_entities = False
    records = []
    current = None
    for code, value in pairs:
        code, value = code.strip(), value.rstrip()
        if code == "0" and value == "SECTION":
            in_entities = False
            continue
        if code == "2" and not in_entities and value.strip() == "ENTITIES":
            in_entities = True
            continue
        if in_entities and code == "0" and value == "ENDSEC":
            if current:
                records.append(current)
            current = None
            in_entities = False
        elif in_entities and code == "0":
            if current:
                records.append(current)
            current = {"type": value.strip(), "pairs": []}
        elif in_entities and current:
            try:
                current["pairs"].append((int(code), value))
            except ValueError:
                pass
    return records


def values(entity, code):
    return [v for c, v in entity["pairs"] if c == code]


def val(entity, code, default=""):
    result = values(entity, code)
    return result[0] if result else default


def num(entity, code, default=0.0):
    try:
        return float(val(entity, code, default))
    except (TypeError, ValueError):
        return float(default)


def line_segment(entity):
    return ((num(entity, 10), num(entity, 20)), (num(entity, 11), num(entity, 21)))


def length(segment):
    return math.dist(*segment)


def candidate_parallel_pairs(entities, tolerance=0.18, min_length=1.0):
    """Find close parallel LINE pairs with overlapping projections.

    Uses a spatial hash on segment midpoints to avoid quadratic comparison.
    """
    lines = []
    for entity in entities:
        if entity["type"] != "LINE":
            continue
        a, b = line_segment(entity)
        seg_length = length((a, b))
        if seg_length < min_length:
            continue
        dx, dy = (b[0] - a[0]) / seg_length, (b[1] - a[1]) / seg_length
        # Canonicalize direction so antiparallel entities share an orientation.
        if dx < -1e-9 or (abs(dx) <= 1e-9 and dy < 0):
            dx, dy = -dx, -dy
        nx, ny = -dy, dx
        midpoint = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        lines.append({"entity": entity, "a": a, "b": b, "u": (dx, dy), "n": (nx, ny),
                      "mid": midpoint, "len": seg_length})

    cell = max(2.0, tolerance * 8)
    buckets = defaultdict(list)
    for index, item in enumerate(lines):
        key = (math.floor(item["mid"][0] / cell), math.floor(item["mid"][1] / cell))
        buckets[key].append(index)

    result = []
    seen = set()
    for index, item in enumerate(lines):
        gx, gy = math.floor(item["mid"][0] / cell), math.floor(item["mid"][1] / cell)
        for ix in range(gx - 2, gx + 3):
            for iy in range(gy - 2, gy + 3):
                for other_index in buckets.get((ix, iy), ()):
                    if other_index <= index or (index, other_index) in seen:
                        continue
                    seen.add((index, other_index))
                    other = lines[other_index]
                    cross = abs(item["u"][0] * other["u"][1] - item["u"][1] * other["u"][0])
                    if cross > 0.008:
                        continue
                    # Distance of second line's midpoint from the first line.
                    delta = (other["mid"][0] - item["mid"][0], other["mid"][1] - item["mid"][1])
                    separation = abs(delta[0] * item["n"][0] + delta[1] * item["n"][1])
                    if separation <= 1e-5 or separation > tolerance:
                        continue
                    projected = []
                    for line in (item, other):
                        projected.append(sorted((line["a"][0] * item["u"][0] + line["a"][1] * item["u"][1],
                                                  line["b"][0] * item["u"][0] + line["b"][1] * item["u"][1])))
                    overlap = min(projected[0][1], projected[1][1]) - max(projected[0][0], projected[1][0])
                    shorter = min(item["len"], other["len"])
                    if overlap < min(0.65, shorter * 0.72):
                        continue
                    result.append((item, other, separation, overlap))
    return lines, result


def fmt(value):
    return f"{value:.4f}"


def diagnostic_svg(entities, lines, candidates, path):
    # Two panels use the title-derived floor bands from Phase 1.
    bounds = [("Ground Floor", -10000, 104.764), ("First Floor", 104.764, 10000)]
    width, height = 1280, 720
    panel_w, panel_h = 610, 650
    pair_ids = {id(row[0]["entity"]) for row in candidates} | {id(row[1]["entity"]) for row in candidates}
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
           '<title id="title">Experimental Main Building geometry analysis</title>',
           '<desc id="desc">Gray source lines, red close parallel line-pair candidates, blue labels, magenta closed polylines. Candidate status is unverified.</desc>',
           '<rect width="100%" height="100%" fill="#e9eef3"/>',
           '<text x="24" y="25" font-family="Arial" font-size="17" font-weight="bold">Experimental geometry analysis — unverified candidates</text>']
    for panel_idx, (floor, low, high) in enumerate(bounds):
        x0 = 20 + panel_idx * 630
        subset = []
        labels = []
        for entity in entities:
            kind = entity["type"]
            if kind == "LINE":
                seg = line_segment(entity)
                center = (seg[0][1] + seg[1][1]) / 2
                if low <= center < high:
                    subset.append((entity, seg))
            elif kind == "MTEXT":
                x, y = num(entity, 10), num(entity, 20)
                if low <= y < high:
                    txt = " ".join(values(entity, 3) + values(entity, 1)).replace("\\P", " ")
                    if txt.strip():
                        labels.append((x, y, txt[:90]))
        points = [p for _, seg in subset for p in seg] + [(x, y) for x, y, _ in labels]
        if not points:
            continue
        minx, maxx = min(p[0] for p in points), max(p[0] for p in points)
        miny, maxy = min(p[1] for p in points), max(p[1] for p in points)
        padx, pady = max(2, (maxx-minx)*.04), max(2, (maxy-miny)*.05)
        minx, maxx, miny, maxy = minx-padx, maxx+padx, miny-pady, maxy+pady
        dx, dy = 570, 570
        scale = min(dx/(maxx-minx), dy/(maxy-miny))
        ox = x0 + 20 + (dx-(maxx-minx)*scale)/2
        oy = 72 + (dy-(maxy-miny)*scale)/2
        def xy(point):
            return ox+(point[0]-minx)*scale, oy+(maxy-point[1])*scale
        out.append(f'<g id="{floor.lower().replace(" ", "-")}"><rect x="{x0}" y="40" width="{panel_w}" height="660" rx="6" fill="white" stroke="#bac5d1"/>')
        out.append(f'<text x="{x0+15}" y="62" font-family="Arial" font-size="14" font-weight="bold">{floor}</text>')
        for entity, seg in subset:
            a, b = xy(seg[0]), xy(seg[1])
            color = "#c43b36" if id(entity) in pair_ids else "#9aa4b2"
            stroke = 1.1 if color == "#c43b36" else .65
            out.append(f'<path d="M{a[0]:.2f},{a[1]:.2f} L{b[0]:.2f},{b[1]:.2f}" stroke="{color}" stroke-width="{stroke}" fill="none"/>')
        for entity in entities:
            if entity["type"] != "LWPOLYLINE" or not (int(num(entity, 70)) & 1):
                continue
            pts = [(float(a), float(b)) for a,b in zip(values(entity,10),values(entity,20))]
            if not pts or not low <= sum(p[1] for p in pts)/len(pts) < high:
                continue
            mapped = [xy(p) for p in pts]
            d = "M" + " L".join(f"{x:.2f},{y:.2f}" for x,y in mapped) + " Z"
            out.append(f'<path d="{d}" fill="none" stroke="#bd4c8a" stroke-width="1" stroke-dasharray="3 2"/>')
        for x,y,label in labels:
            px,py=xy((x,y))
            out.append(f'<text x="{px:.2f}" y="{py:.2f}" font-family="Arial" font-size="7" fill="#2563a6">{html.escape(label)}</text>')
        local_pairs = sum(low <= (p[0]["mid"][1]+p[1]["mid"][1])/2 < high for p in candidates)
        out.append(f'<text x="{x0+15}" y="688" font-family="Arial" font-size="9" fill="#475569">{len(subset)} source LINEs; {local_pairs} close parallel pair candidates.</text></g>')
    out.extend(['<circle cx="34" cy="712" r="4" fill="#9aa4b2"/><text x="44" y="716" font-family="Arial" font-size="9">Original LINE</text>',
                '<circle cx="145" cy="712" r="4" fill="#c43b36"/><text x="155" y="716" font-family="Arial" font-size="9">Parallel-pair candidate (unverified)</text>',
                '<circle cx="355" cy="712" r="4" fill="#bd4c8a"/><text x="365" y="716" font-family="Arial" font-size="9">Closed polyline (not confirmed room)</text>',
                '<circle cx="595" cy="712" r="4" fill="#2563a6"/><text x="605" y="716" font-family="Arial" font-size="9">Source text</text></svg>'])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(out), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dxf", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--diagnostic", type=Path, required=True)
    parser.add_argument("--pair-tolerance", type=float, default=0.18,
                        help="Maximum parallel-line separation in original DXF units (default: 0.18).")
    args = parser.parse_args()
    entities = parse_entities(args.dxf)
    lines, pairs = candidate_parallel_pairs(entities, args.pair_tolerance)
    sensitivity = {}
    for tested_tolerance in (0.18, 4.0, 12.0):
        if abs(tested_tolerance - args.pair_tolerance) < 1e-9:
            sensitivity[tested_tolerance] = len(pairs)
        else:
            sensitivity[tested_tolerance] = len(candidate_parallel_pairs(entities, tested_tolerance)[1])
    line_types = Counter(val(line["entity"], 6, "BYLAYER") for line in lines)
    colors = Counter(val(line["entity"], 62, "BYLAYER") for line in lines)
    layer_types = Counter(val(line["entity"], 8, "0") for line in lines)
    diagnostic_svg(entities, lines, pairs, args.diagnostic)
    distances = [row[2] for row in pairs]
    report = [
        "# Main Building geometry analysis — Phase 2 experiment", "",
        "## Scope and safeguards", "",
        f"- Input: `{args.dxf.as_posix()}` (read-only). Source coordinates and source entities are retained; no scale conversion, snapping, line merging, or room generation is performed.",
        "- This is a screening experiment. Parallel pairs are visual review candidates only, not verified walls. No application component or campus geometry is changed.",
        "",
        "## Entity attribute evidence", "",
        f"- {len(lines)} LINE segments (length >= 1.0 DXF unit) entered geometric screening. Their layer counts: `{dict(layer_types)}`.",
        f"- Explicit LINE linetypes: `{dict(line_types)}`. Explicit color indices: `{dict(colors)}`; BYLAYER means the DXF entity does not distinguish the items through that attribute.",
        "- Block INSERTs remain the two `urinal_p07` instances from Phase 1; this test does not expand block geometry. Entity type, linetype, and explicit color do not currently supply architectural classification.",
        "",
        "## Repeated geometry screening", "",
        f"- Tested LINE segments at or above 1.0 drawing unit for near-parallel alignment, separation <= {args.pair_tolerance:g} source units, and at least 72% shared projected length (or 0.65 units).",
        f"- Found {len(pairs)} paired relationships involving {len({id(line) for pair in pairs for line in pair[:2]})} distinct LINE entities. Pair separations range `{min(distances):.4f}..{max(distances):.4f}` source units." if pairs else "- No pairs met the screening thresholds.",
        f"- Sensitivity check: pair counts at separation tolerances 0.18, 4, and 12 source units are `{sensitivity}`. The broad tolerances rapidly produce thousands of overlapping pair matches, demonstrating that proximity alone is not discriminative.",
        "- Pairing can expose repeated double-line patterns, but dimensions, furniture, fixtures, symbols, and wall edges can all produce such pairs. The drawing gives no independent layer, block, linetype, or color evidence to resolve those alternatives. Pair membership alone is insufficient to call a wall.",
        "- Endpoint intersections/connectivity may describe a line graph, but do not establish which connected loops are rooms: openings, fragmented drawing strokes, symbols, and annotations can create or break cycles. The Phase 1 closed-polylines result likewise does not support room boundary extraction.",
        "- Text labels are nearby annotations, but there are no CAD topology links tying a label to a closed room outline. Automated label-to-room assignment would be speculative.",
        "",
        "## Scale and reconstruction decision", "",
        "- The drawing declares inches and contains 26 dimension entities (2.921–50.341 DXF units), but no trusted reference dimension is available to validate the unit declaration or scale. Dimensions can be reviewed in a CAD editor; this analysis does not calibrate geometry.",
        "- **Recommendation: assisted tracing from the source drawing**, after verifying a dimension and inspecting source layer visibility/blocks in an AutoCAD-compatible editor. The converted DXF can then serve as an underlay; a reviewer can classify wall runs, openings, stairs, and room outlines. Automatic extraction is not reliable from the current evidence. Fully manual redrafting is only needed if trustworthy source geometry cannot be separated or traced.",
        "- Before 3D construction, confirm scale and collect wall/floor heights. Keep unresolved openings and room boundaries explicitly unresolved; this analysis does not infer either.",
        "",
        "## Diagnostic", "",
        f"- `{args.diagnostic.as_posix()}` shows original LINEs gray, close-parallel LINE candidates red, closed LWPOLYLINEs magenta, and source text blue, separated into inferred floor-coordinate bands. Colors indicate screening status only.",
        "",
    ]
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text("\n".join(report), encoding="utf-8")
    print(f"LINEs: {len(lines)}; near-parallel pair relationships: {len(pairs)}")
    print(f"Linetypes: {dict(line_types)}; explicit colors: {dict(colors)}")
    print(f"Wrote {args.report} and {args.diagnostic}")


if __name__ == "__main__":
    main()
