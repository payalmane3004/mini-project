"""Render common, source-coordinate DXF geometry and text to static SVG."""

import argparse
import html
import math
import re
from pathlib import Path


GEOMETRY_TYPES = {"LINE", "LWPOLYLINE", "CIRCLE", "ARC", "ELLIPSE"}
TEXT_TYPES = {"TEXT", "MTEXT"}
SUPPORTED_TYPES = GEOMETRY_TYPES | TEXT_TYPES
ANGLE_STEP = math.radians(5)


def read_records(path):
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    records = []
    in_entities = False
    current = None
    for raw_code, value in zip(lines[0::2], lines[1::2]):
        code = raw_code.strip()
        if code == "2" and value.strip() == "ENTITIES":
            in_entities = True
            continue
        if not in_entities:
            continue
        if code == "0" and value.strip() == "ENDSEC":
            if current:
                records.append(current)
            break
        if code == "0":
            if current:
                records.append(current)
            current = {"type": value.strip(), "pairs": []}
        elif current:
            try:
                current["pairs"].append((int(code), value.rstrip()))
            except ValueError:
                continue
    return records


def values(record, code):
    return [value for group, value in record["pairs"] if group == code]


def number(record, code, fallback=0.0):
    try:
        found = values(record, code)
        return float(found[0]) if found else fallback
    except (ValueError, TypeError):
        return fallback


def point(record, x_code=10, y_code=20, fallback=None):
    xs, ys = values(record, x_code), values(record, y_code)
    try:
        return (float(xs[0]), float(ys[0])) if xs and ys else fallback
    except ValueError:
        return fallback


def sample_bulge(start, end, bulge):
    if abs(bulge) < 1e-12:
        return [start, end]
    dx, dy = end[0] - start[0], end[1] - start[1]
    chord = math.hypot(dx, dy)
    if chord == 0:
        return [start]
    sweep = 4 * math.atan(bulge)
    offset = chord * (1 - bulge * bulge) / (4 * bulge)
    center = ((start[0] + end[0]) / 2 - dy / chord * offset,
              (start[1] + end[1]) / 2 + dx / chord * offset)
    radius = chord * (1 + bulge * bulge) / (4 * abs(bulge))
    angle = math.atan2(start[1] - center[1], start[0] - center[0])
    steps = max(1, math.ceil(abs(sweep) / ANGLE_STEP))
    return [(center[0] + radius * math.cos(angle + sweep * index / steps),
             center[1] + radius * math.sin(angle + sweep * index / steps))
            for index in range(steps + 1)][:-1] + [end]


def lwpoly_vertices(record):
    vertices = []
    current = None
    for code, value in record["pairs"]:
        if code == 10:
            if current and "x" in current and "y" in current:
                vertices.append((current["x"], current["y"], current.get("bulge", 0.0)))
            try:
                current = {"x": float(value)}
            except ValueError:
                current = None
        elif current is not None and code == 20:
            try:
                current["y"] = float(value)
            except ValueError:
                pass
        elif current is not None and code == 42:
            try:
                current["bulge"] = float(value)
            except ValueError:
                pass
    if current and "x" in current and "y" in current:
        vertices.append((current["x"], current["y"], current.get("bulge", 0.0)))
    return vertices


def polyline_points(record):
    vertices = lwpoly_vertices(record)
    if len(vertices) < 2:
        return [(x, y) for x, y, _ in vertices]
    closed = bool(int(number(record, 70)) & 1)
    segment_count = len(vertices) if closed else len(vertices) - 1
    points = []
    for index in range(segment_count):
        x1, y1, bulge = vertices[index]
        x2, y2, _ = vertices[(index + 1) % len(vertices)]
        segment = sample_bulge((x1, y1), (x2, y2), bulge)
        points.extend(segment if index == 0 else segment[1:])
    if not closed:
        points.append((vertices[-1][0], vertices[-1][1]))
    return points


def angle_points(center, radius, start, end, full_if_equal=False):
    if end < start or (full_if_equal and end == start):
        end += 2 * math.pi
    steps = max(1, math.ceil(abs(end - start) / ANGLE_STEP))
    angles = [start + (end - start) * index / steps for index in range(steps + 1)]
    low, high = sorted((start, end))
    for cardinal in (0, math.pi / 2, math.pi, 3 * math.pi / 2, 2 * math.pi):
        candidate = cardinal
        while candidate < low:
            candidate += 2 * math.pi
        if low <= candidate <= high:
            angles.append(candidate)
    return [(center[0] + radius * math.cos(angle), center[1] + radius * math.sin(angle)) for angle in angles]


def entity_points(record):
    kind = record["type"]
    if kind == "LINE":
        start, end = point(record, 10, 20), point(record, 11, 21)
        return [start, end] if start and end else []
    if kind == "LWPOLYLINE":
        return polyline_points(record)
    center = point(record)
    if kind == "CIRCLE":
        radius = abs(number(record, 40))
        return [(center[0] + dx, center[1] + dy) for dx, dy in ((-radius, 0), (radius, 0), (0, -radius), (0, radius))] if center else []
    if kind == "ARC" and center:
        return angle_points(center, abs(number(record, 40)), math.radians(number(record, 50)), math.radians(number(record, 51)))
    if kind == "ELLIPSE":
        major = point(record, 11, 21)
        if not center or not major:
            return []
        ratio = abs(number(record, 40))
        start, end = number(record, 41), number(record, 42)
        if end <= start:
            end += 2 * math.pi
        # DXF ellipse group 11/21 stores the major-axis vector, relative to
        # the center, rather than a second absolute point.
        axis_x, axis_y = major
        steps = max(1, math.ceil((end - start) / ANGLE_STEP))
        angles = [start + (end - start) * index / steps for index in range(steps + 1)]
        return [(center[0] + axis_x * math.cos(t) - axis_y * ratio * math.sin(t),
                 center[1] + axis_y * math.cos(t) + axis_x * ratio * math.sin(t)) for t in angles]
    if kind in TEXT_TYPES and center:
        return [center]
    return []


def clean_text(value):
    value = re.sub(r"\\U\+([0-9A-Fa-f]{4})", lambda match: chr(int(match.group(1), 16)), value)
    value = value.replace("%%d", "°").replace("%%D", "°").replace("%%p", "±").replace("%%P", "±").replace("%%c", "Ø").replace("%%C", "Ø")
    return value


def clean_mtext(value):
    value = re.sub(r"\\f[^;]*;", "", value)
    value = re.sub(r"\\[A-Za-z][^;]*;", "", value)
    value = re.sub(r"\\[LOlo]", "", value)
    value = re.sub(r"\\S([^;]*);", lambda match: match.group(1).replace("^", "/"), value)
    value = value.replace("\\{", "{").replace("\\}", "}").replace("\\\\", "\\")
    value = value.replace("\\~", " ")
    return [clean_text(part) for part in value.split("\\P")]


def text_anchor(record):
    if record["type"] == "TEXT":
        horizontal = int(number(record, 72))
        vertical = int(number(record, 73))
    else:
        attachment = int(number(record, 71, 1))
        horizontal = (attachment - 1) % 3
        vertical = (attachment - 1) // 3
    return ("start", "middle", "end")[max(0, min(horizontal, 2))], ("text-after-edge", "auto", "hanging")[max(0, min(vertical, 2))]


def render_geometry(record):
    kind = record["type"]
    layer = html.escape(values(record, 8)[0] if values(record, 8) else "0", quote=True)
    tag = f'data-entity="{kind}" data-layer="{layer}"'
    if kind == "LINE":
        p1, p2 = point(record, 10, 20), point(record, 11, 21)
        return [f'<path {tag} d="M{p1[0]:.6f},{p1[1]:.6f} L{p2[0]:.6f},{p2[1]:.6f}"/>'] if p1 and p2 else []
    if kind == "LWPOLYLINE":
        points = polyline_points(record)
        if len(points) < 2:
            return []
        path_data = " ".join(("M" if index == 0 else "L") + f"{x:.6f},{y:.6f}" for index, (x, y) in enumerate(points))
        if int(number(record, 70)) & 1:
            path_data += " Z"
        return [f'<path {tag} d="{path_data}"/>']
    if kind == "CIRCLE":
        center = point(record)
        radius = abs(number(record, 40))
        return [f'<circle {tag} cx="{center[0]:.6f}" cy="{center[1]:.6f}" r="{radius:.6f}"/>'] if center and radius > 0 else []
    if kind == "ARC":
        center, radius = point(record), abs(number(record, 40))
        if not center or radius <= 0:
            return []
        points = angle_points(center, radius, math.radians(number(record, 50)), math.radians(number(record, 51)))
        path_data = " ".join(("M" if i == 0 else "L") + f"{x:.6f},{y:.6f}" for i, (x, y) in enumerate(points))
        return [f'<path {tag} d="{path_data}"/>']
    if kind == "ELLIPSE":
        points = entity_points(record)
        if len(points) < 2:
            return []
        path_data = " ".join(("M" if i == 0 else "L") + f"{x:.6f},{y:.6f}" for i, (x, y) in enumerate(points))
        return [f'<path {tag} d="{path_data}"/>']
    return []


def render_text(record, default_size, max_size):
    insertion = point(record)
    if not insertion:
        return [], False
    anchor, baseline = text_anchor(record)
    rotation = -number(record, 50)
    raw = "".join(values(record, 3) + values(record, 1)) if record["type"] == "MTEXT" else (values(record, 1)[0] if values(record, 1) else "")
    lines = clean_mtext(raw) if record["type"] == "MTEXT" else [clean_text(raw)]
    lines = [line for line in lines if line]
    if not lines:
        return [], False
    requested_size = number(record, 40, default_size)
    size = min(max(requested_size, default_size * 0.35), max_size)
    clamped = not math.isclose(size, requested_size, rel_tol=0.01)
    width_factor = number(record, 41, 1.0) if record["type"] == "TEXT" else 1.0
    width_factor = min(max(width_factor, 0.1), 10.0)
    x, y = insertion[0], -insertion[1]
    transform = (f'transform="translate({x:.6f} {y:.6f}) rotate({rotation:.6f}) scale({width_factor:.5f} 1) translate({-x:.6f} {-y:.6f})"'
                 if record["type"] == "TEXT" else f'transform="rotate({rotation:.6f} {x:.6f} {y:.6f})"')
    layer = html.escape(values(record, 8)[0] if values(record, 8) else "0", quote=True)
    pieces = [f'<text data-entity="{record["type"]}" data-layer="{layer}" x="{x:.6f}" y="{y:.6f}" font-family="Arial,sans-serif" font-size="{size:.6f}" text-anchor="{anchor}" dominant-baseline="{baseline}" fill="#111827" {transform}>']
    for index, line in enumerate(lines):
        dy = 0 if index == 0 else size * 1.15
        pieces.append(f'<tspan x="{x:.6f}" dy="{dy:.6f}">{html.escape(line)}</tspan>')
    pieces.append("</text>")
    return pieces, clamped


def bounds(points):
    return (min(x for x, _ in points), min(y for _, y in points), max(x for x, _ in points), max(y for _, y in points))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_dxf", type=Path)
    parser.add_argument("output_svg", type=Path)
    args = parser.parse_args()

    records = read_records(args.input_dxf)
    supported = [record for record in records if record["type"] in SUPPORTED_TYPES]
    geometry_records = [record for record in supported if record["type"] in GEOMETRY_TYPES]
    geometry_points = [p for record in geometry_records for p in entity_points(record)]
    text_records = [record for record in supported if record["type"] in TEXT_TYPES]
    geometry_bounds = bounds(geometry_points) if geometry_points else None

    # Keep source text only when its insertion point is near the actual drawn
    # geometry. Remote notes and bad block coordinates remain searchable in
    # the inspection report without stretching the floor-plan preview.
    if geometry_bounds:
        min_x, min_y, max_x, max_y = geometry_bounds
        margin = max(max_x - min_x, max_y - min_y, 1.0) * 0.12
        text_records = [record for record in text_records if (lambda p: p is not None and min_x - margin <= p[0] <= max_x + margin and min_y - margin <= p[1] <= max_y + margin)(point(record))]
    render_points = geometry_points + [p for record in text_records for p in entity_points(record)]
    if not render_points:
        raise SystemExit("No supported geometry or in-bounds source text was found.")

    min_x, min_y, max_x, max_y = bounds(render_points)
    span = max(max_x - min_x, max_y - min_y, 1.0)
    pad = span * 0.025
    width, height = max_x - min_x + 2 * pad, max_y - min_y + 2 * pad
    view_y = -(max_y + pad)
    source_name = html.escape(args.input_dxf.stem, quote=False)
    elements = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:.6f}" height="{height:.6f}" viewBox="{min_x-pad:.6f} {view_y:.6f} {width:.6f} {height:.6f}" role="img" aria-labelledby="title description">',
        f'<title id="title">CAD drawing: {source_name}</title>',
        '<desc id="description">Source-coordinate rendering of lines, polylines, circles, arcs, ellipses, and nearby source text. Dimensions, block inserts, and unsupported entities are excluded.</desc>',
        f'<rect x="{min_x-pad:.6f}" y="{view_y:.6f}" width="{width:.6f}" height="{height:.6f}" fill="#fff"/>',
        f'<g transform="scale(1 -1)" fill="none" stroke="#18212b" stroke-width="{span*0.00085:.6f}" stroke-linecap="round" stroke-linejoin="round">',
    ]
    for record in geometry_records:
        elements.extend(render_geometry(record))
    elements.append("</g>")
    clamped_text = 0
    for record in text_records:
        text_elements, clamped = render_text(record, span * 0.003, span * 0.06)
        elements.extend(text_elements)
        clamped_text += int(clamped)
    elements.append("</svg>")
    args.output_svg.parent.mkdir(parents=True, exist_ok=True)
    args.output_svg.write_text("\n".join(elements), encoding="utf-8")
    print(f"Wrote {args.output_svg}: {len(records)} entities; {len(geometry_records)} geometry and {len(text_records)} text rendered; {clamped_text} text sizes clamped")


if __name__ == "__main__":
    main()
