"""Extract a source inventory from an ODA ASCII DXF without rewriting it."""

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from dxf_to_svg import GEOMETRY_TYPES, SUPPORTED_TYPES, TEXT_TYPES, entity_points


def read_pairs(path):
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    if len(lines) % 2:
        lines = lines[:-1]
    return [(lines[index].strip(), lines[index + 1].rstrip()) for index in range(0, len(lines), 2)]


def sections(pairs):
    result = defaultdict(list)
    current_section = None
    current = None
    in_entities = False
    for code, value in pairs:
        if code == "0" and value == "SECTION":
            current_section = None
            current = None
            in_entities = False
        elif code == "2" and current_section is None:
            current_section = value
            in_entities = current_section == "ENTITIES"
        elif in_entities:
            if code == "0" and value == "ENDSEC":
                if current:
                    result["ENTITIES"].append(current)
                in_entities = False
                current = None
            elif code == "0":
                if current:
                    result["ENTITIES"].append(current)
                current = {"type": value, "pairs": []}
            elif current is not None:
                current["pairs"].append((code, value))
    return result


def bounds_for(entity):
    pairs = [(int(code), value) for code, value in entity["pairs"]]
    if entity["type"] in SUPPORTED_TYPES:
        return entity_points({"type": entity["type"], "pairs": pairs})
    coords = []
    xs = [float(value) for code, value in pairs if code == 10]
    ys = [float(value) for code, value in pairs if code == 20]
    coords.extend(zip(xs, ys))
    return coords


def dimension_record(entity):
    pairs = entity["pairs"]
    layer = next((value for code, value in pairs if code == "8"), "0")
    text = next((value for code, value in pairs if code == "1"), "")
    measurement = next((value for code, value in pairs if code == "42"), None)
    points = []
    for x_code, y_code in (("10", "20"), ("11", "21"), ("12", "22"), ("13", "23"), ("14", "24"), ("15", "25")):
        x = next((value for code, value in pairs if code == x_code), None)
        y = next((value for code, value in pairs if code == y_code), None)
        if x is not None and y is not None:
            points.append({"x": float(x), "y": float(y)})
    return {
        "layer": layer,
        "dimensionType": next((value for code, value in pairs if code == "70"), None),
        "textOverride": text or None,
        "measurement": float(measurement) if measurement is not None else None,
        "definitionPoints": points,
    }


def floor_clue(text):
    plain = re.sub(r"\\[A-Za-z][^;]*;", " ", text)
    plain = plain.replace("{", " ").replace("}", " ").replace("\\P", " ")
    normalized = re.sub(r"\s+", " ", plain).casefold()
    return bool(
        re.search(r"\b(?:ground|first|second|third|fourth|upper|lower|basement)\s+floor\b", normalized)
        or re.search(r"\b(?:gf|ff|sf|bf)\b", normalized)
        or re.search(r"\b(?:floor|storey|story)\s+(?:plan|layout)\b", normalized)
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dxf", type=Path)
    parser.add_argument("output_json", type=Path)
    parser.add_argument("--building-id")
    parser.add_argument("--source-dwg", required=True)
    args = parser.parse_args()

    pairs = read_pairs(args.dxf)
    entities = sections(pairs).get("ENTITIES", [])
    entity_counts = Counter(entity["type"] for entity in entities)
    layer_counts = defaultdict(Counter)
    all_points = []
    rendered_points = []
    render_records = []
    text_entities = []
    dimensions = []
    for entity in entities:
        entity_pairs = entity["pairs"]
        layer = next((value for code, value in entity_pairs if code == "8"), "0")
        layer_counts[layer][entity["type"]] += 1
        coordinates = bounds_for(entity)
        all_points.extend(coordinates)
        render_records.append({
            "type": entity["type"],
            "pairs": [(int(code), value) for code, value in entity_pairs],
        })
        if entity["type"] in {"TEXT", "MTEXT", "ATTRIB", "ATTDEF"}:
            text = " ".join(value for code, value in entity_pairs if code in {"1", "3"}).strip()
            if text:
                x = next((float(value) for code, value in entity_pairs if code == "10"), None)
                y = next((float(value) for code, value in entity_pairs if code == "20"), None)
                text_entities.append({"layer": layer, "type": entity["type"], "text": text, "x": x, "y": y})
        if entity["type"] == "DIMENSION":
            dimensions.append(dimension_record(entity))

    extents = None
    if all_points:
        extents = {
            "minX": min(x for x, _ in all_points),
            "minY": min(y for _, y in all_points),
            "maxX": max(x for x, _ in all_points),
            "maxY": max(y for _, y in all_points),
        }
    units = None
    for index, (code, value) in enumerate(pairs):
        if code == "9" and value == "$INSUNITS":
            units = next((int(next_value) for next_code, next_value in pairs[index + 1:index + 4] if next_code == "70"), None)
            break

    geometry_records = [entity for entity in render_records if entity["type"] in GEOMETRY_TYPES]
    geometry_points = [point for entity in geometry_records for point in entity_points(entity)]
    geometry_bounds = None
    if geometry_points:
        geometry_bounds = {
            "minX": min(x for x, _ in geometry_points),
            "minY": min(y for _, y in geometry_points),
            "maxX": max(x for x, _ in geometry_points),
            "maxY": max(y for _, y in geometry_points),
        }
    text_records = [entity for entity in render_records if entity["type"] in TEXT_TYPES]
    filtered_text_count = 0
    if geometry_bounds:
        margin = max(geometry_bounds["maxX"] - geometry_bounds["minX"], geometry_bounds["maxY"] - geometry_bounds["minY"], 1.0) * 0.12
        accepted_text_records = []
        for entity in text_records:
            points = entity_points(entity)
            if points and geometry_bounds["minX"] - margin <= points[0][0] <= geometry_bounds["maxX"] + margin and geometry_bounds["minY"] - margin <= points[0][1] <= geometry_bounds["maxY"] + margin:
                accepted_text_records.append(entity)
            else:
                filtered_text_count += 1
        text_records = accepted_text_records
    rendered_points = geometry_points + [point for entity in text_records for point in entity_points(entity)]

    rendered_extents = None
    if rendered_points:
        rendered_extents = {
            "minX": min(x for x, _ in rendered_points),
            "minY": min(y for _, y in rendered_points),
            "maxX": max(x for x, _ in rendered_points),
            "maxY": max(y for _, y in rendered_points),
        }

    report = {
        "buildingId": args.building_id,
        "associationStatus": "verified-building-id" if args.building_id else "unmatched-source-drawing",
        "sourceDwg": args.source_dwg,
        "convertedDxf": args.dxf.name,
        "dxfUnitsCode": units,
        "modelSpaceEntityCount": len(entities),
        "entityCounts": dict(sorted(entity_counts.items())),
        "dimensionEntityCount": entity_counts["DIMENSION"],
        "dimensions": dimensions,
        "layers": {name: dict(sorted(counts.items())) for name, counts in sorted(layer_counts.items())},
        "bounds": extents,
        "boundsBasis": "Bounds of coordinates found on model-space entities, including text and insert points; they can exceed the drawn geometry when a block reference has a remote insertion point.",
        "renderBounds": rendered_extents,
        "sourceText": text_entities,
        "floorClues": [
            item["text"] for item in text_entities
            if floor_clue(item["text"])
        ],
        "rendererSupportedEntities": [name for name in sorted(SUPPORTED_TYPES) if entity_counts[name]],
        "rendererRenderedEntityCounts": dict(sorted(Counter(entity["type"] for entity in geometry_records + text_records).items())),
        "rendererFilteredTextEntityCount": filtered_text_count,
        "rendererOmittedEntityTypes": dict(sorted((name, count) for name, count in entity_counts.items() if name not in SUPPORTED_TYPES)),
        "floorOrganization": "Requires manual inspection of source text and plan groups; no floors are inferred by this report.",
    }
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"buildingId": args.building_id, "entities": len(entities), "bounds": extents, "output": str(args.output_json)}, indent=2))


if __name__ == "__main__":
    main()
