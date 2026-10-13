"""Export only Ground Floor model-space artwork as a prototype SVG underlay."""

import argparse
import html
import json
import re
from pathlib import Path


def parse_entities(path):
    lines = path.read_text(encoding="cp1252", errors="replace").splitlines()
    pairs = list(zip(lines[0::2], lines[1::2]))
    active, current, result = False, None, []
    for code, value in pairs:
        code, value = code.strip(), value.rstrip()
        if code == "0" and value == "SECTION":
            active = False
        elif code == "2" and not active and value.strip() == "ENTITIES":
            active = True
        elif active and code == "0" and value == "ENDSEC":
            if current:
                result.append(current)
            break
        elif active and code == "0":
            if current:
                result.append(current)
            current = {"type": value.strip(), "data": []}
        elif active and current:
            try:
                current["data"].append((int(code), value))
            except ValueError:
                pass
    return result


def values(entity, code):
    return [value for group, value in entity["data"] if group == code]


def num(entity, code):
    try:
        return float(values(entity, code)[0])
    except (IndexError, ValueError):
        return 0.0


def clean_mtext(text):
    text = re.sub(r"\\f[^;]*;", "", text)
    text = text.replace("\\P", " ").replace("\\~", " ")
    text = re.sub(r"\\[A-Za-z][^;]*;", "", text)
    return re.sub(r"\s+", " ", text.replace("{", "").replace("}", "")).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dxf", type=Path)
    parser.add_argument("output_svg", type=Path)
    parser.add_argument("--floor", choices=("ground", "first"), default="ground")
    parser.add_argument("--labels-output", type=Path)
    parser.add_argument("--split-y", type=float, default=104.764,
                        help="Phase 1 inferred floor-title split in source CAD coordinates.")
    args = parser.parse_args()
    floor_low, floor_high = (25.0, args.split_y) if args.floor == "ground" else (110.0, 190.0)
    floor_title = "Ground Floor" if args.floor == "ground" else "First Floor"
    entities = parse_entities(args.dxf)
    selected = []
    points = []
    for entity in entities:
        kind = entity["type"]
        layer = values(entity, 8)
        if not layer or layer[0].strip() != "window" or kind not in {"LINE", "LWPOLYLINE", "MTEXT"}:
            continue
        if kind == "LINE":
            coords = [(num(entity, 10), num(entity, 20)), (num(entity, 11), num(entity, 21))]
            center_y = sum(p[1] for p in coords) / 2
        elif kind == "LWPOLYLINE":
            coords = [(float(x), float(y)) for x, y in zip(values(entity, 10), values(entity, 20))]
            center_y = sum(p[1] for p in coords) / len(coords) if coords else args.split_y
        else:
            coords = [(num(entity, 10), num(entity, 20))]
            center_y = coords[0][1]
        # Keep plan entities in this floor's coordinate band, excluding the
        # floor-title annotations between the two layouts.
        if coords and floor_low <= center_y < floor_high:
            if not (-22.0 <= coords[0][0] <= 215.0):
                continue
            selected.append((entity, coords))
            points.extend(coords)
    if not points:
        raise SystemExit("No Ground Floor entities found below split Y.")
    min_x, max_x = min(p[0] for p in points), max(p[0] for p in points)
    min_y, max_y = min(p[1] for p in points), max(p[1] for p in points)
    pad_x, pad_y = (max_x - min_x) * .015, (max_y - min_y) * .04
    min_x, max_x = min_x - pad_x, max_x + pad_x
    min_y, max_y = min_y - pad_y, max_y + pad_y
    width, height = max_x - min_x, max_y - min_y
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{min_x:.4f} {-max_y:.4f} {width:.4f} {height:.4f}" role="img" aria-labelledby="title desc">',
        '<title id="title">Main Building Ground Floor CAD underlay</title>',
        '<desc id="desc">Unclassified source CAD entities selected from the lower Ground Floor coordinate band using the inferred Phase 1 split. The underlay is not wall-classified or georeferenced.</desc>',
        # Transparent reference artwork lets the 3D footprint surface define
        # the building outline instead of turning the plan's rectangular
        # drawing bounds into a fictitious slab.
        '<g transform="scale(1 -1)" fill="none" stroke="#435266" stroke-width="0.10" stroke-linecap="round" stroke-linejoin="round" opacity="0.88">',
    ]
    for entity, coords in selected:
        kind = entity["type"]
        if kind not in {"LINE", "LWPOLYLINE"} or len(coords) < 2:
            continue
        path_d = "M" + " L".join(f"{x:.4f},{y:.4f}" for x, y in coords)
        if kind == "LWPOLYLINE" and int(num(entity, 70)) & 1:
            path_d += " Z"
        out.append(f'<path d="{path_d}"/>')
    out.append("</g>")
    for entity, coords in selected:
        if entity["type"] != "MTEXT":
            continue
        label = clean_mtext("".join(values(entity, 3) + values(entity, 1)))
        if label:
            x, y = coords[0]
            out.append(f'<text x="{x:.4f}" y="{-y:.4f}" font-family="Arial,sans-serif" font-size="1.0" fill="#334155" opacity="0.9">{html.escape(label)}</text>')
    out.append("</svg>")
    args.output_svg.parent.mkdir(parents=True, exist_ok=True)
    args.output_svg.write_text("\n".join(out), encoding="utf-8")
    print(f"Wrote {args.output_svg}; {len(selected)} source entities, source coordinate bounds {min_x:.3f}..{max_x:.3f} x {min_y:.3f}..{max_y:.3f}.")
    if args.labels_output:
        labels = []
        for entity, coords in selected:
            if entity["type"] != "MTEXT":
                continue
            label = clean_mtext("".join(values(entity, 3) + values(entity, 1)))
            if label:
                labels.append({"text": label, "x": round(coords[0][0], 4), "y": round(coords[0][1], 4), "sourceEntityType": "MTEXT"})
        args.labels_output.parent.mkdir(parents=True, exist_ok=True)
        args.labels_output.write_text(json.dumps({
            "building": "Main Building",
            "floor": floor_title,
            "source": "public/campus-maps/processed/main-building-converted.dxf",
            "coordinateSystem": "converted DXF model space; local, uncalibrated",
            "bounds": {"xRange": [round(min_x, 4), round(max_x, 4)], "yRange": [round(min_y, 4), round(max_y, 4)]},
            "entityCounts": {"total": len(selected), "LINE": sum(e["type"] == "LINE" for e, _ in selected), "LWPOLYLINE": sum(e["type"] == "LWPOLYLINE" for e, _ in selected), "MTEXT": len(labels)},
            "labels": labels,
            "associationStatus": "source annotations only; no room associations verified",
        }, indent=2), encoding="utf-8")
        print(f"Wrote {args.labels_output}; {len(labels)} source labels.")


if __name__ == "__main__":
    main()
