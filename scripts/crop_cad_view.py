"""Create a cropped SVG view without changing the source-coordinate geometry."""
import argparse
import xml.etree.ElementTree as ET


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("output")
    parser.add_argument("--min-x", type=float, required=True)
    parser.add_argument("--min-y", type=float, required=True)
    parser.add_argument("--max-x", type=float, required=True)
    parser.add_argument("--max-y", type=float, required=True)
    args = parser.parse_args()
    width = args.max_x - args.min_x
    height = args.max_y - args.min_y
    padding = max(width, height) * 0.025
    root = ET.parse(args.source).getroot()
    root.set("viewBox", f"{args.min_x-padding:.9f} {-args.max_y-padding:.9f} {width+2*padding:.9f} {height+2*padding:.9f}")
    root.set("width", f"{width+2*padding:.9f}")
    root.set("height", f"{height+2*padding:.9f}")
    ET.ElementTree(root).write(args.output, encoding="unicode", xml_declaration=True)


if __name__ == "__main__":
    main()
