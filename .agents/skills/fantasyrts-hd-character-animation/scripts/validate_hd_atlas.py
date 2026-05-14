#!/usr/bin/env python3
"""Validate a fixed-cell HD character sprite atlas and optionally write a contact sheet."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


def parse_hex_color(value: str) -> tuple[int, int, int]:
    text = value.strip().lstrip("#")
    if len(text) != 6:
        raise argparse.ArgumentTypeError("color must be #rrggbb")
    try:
        return tuple(int(text[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    except ValueError as exc:
        raise argparse.ArgumentTypeError("color must be #rrggbb") from exc


def alpha_count(image: Image.Image) -> int:
    return sum(image.getchannel("A").histogram()[1:])


def edge_count(image: Image.Image, margin: int) -> int:
    if margin <= 0:
        return 0
    alpha = image.getchannel("A")
    width, height = alpha.size
    boxes = (
        (0, 0, width, min(margin, height)),
        (0, max(0, height - margin), width, height),
        (0, 0, min(margin, width), height),
        (max(0, width - margin), 0, width, height),
    )
    return sum(sum(alpha.crop(box).histogram()[1:]) for box in boxes)


def near_color_count(
    image: Image.Image,
    key: tuple[int, int, int],
    threshold: int,
) -> int:
    threshold_sq = threshold * threshold
    count = 0
    for r, g, b, a in image.getdata():
        if a == 0:
            continue
        distance_sq = (r - key[0]) ** 2 + (g - key[1]) ** 2 + (b - key[2]) ** 2
        if distance_sq <= threshold_sq:
            count += 1
    return count


def make_checker(size: tuple[int, int], block: int = 12) -> Image.Image:
    width, height = size
    out = Image.new("RGBA", size, (235, 235, 235, 255))
    draw = ImageDraw.Draw(out)
    for y in range(0, height, block):
        for x in range(0, width, block):
            if ((x // block) + (y // block)) % 2:
                draw.rectangle((x, y, x + block - 1, y + block - 1), fill=(248, 248, 248, 255))
    return out


def fit_preview(frame: Image.Image, max_cell: int) -> Image.Image:
    width, height = frame.size
    scale = min(max_cell / width, max_cell / height, 1.0)
    new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    if new_size == frame.size:
        return frame.copy()
    return frame.resize(new_size, Image.Resampling.LANCZOS)


def make_contact_sheet(
    atlas: Image.Image,
    rows: int,
    columns: int,
    cell_width: int,
    cell_height: int,
    output: Path,
    contact_cell: int,
) -> None:
    label_h = 16
    pad = 2
    preview_w = min(contact_cell, cell_width)
    preview_h = min(contact_cell, cell_height)
    sheet = Image.new(
        "RGBA",
        (columns * (preview_w + pad) + pad, rows * (preview_h + label_h + pad) + pad),
        (255, 255, 255, 255),
    )
    draw = ImageDraw.Draw(sheet)

    for row in range(rows):
        for col in range(columns):
            frame = atlas.crop(
                (
                    col * cell_width,
                    row * cell_height,
                    (col + 1) * cell_width,
                    (row + 1) * cell_height,
                )
            )
            preview = fit_preview(frame, contact_cell)
            x = col * (preview_w + pad) + pad
            y = row * (preview_h + label_h + pad) + label_h + pad
            bg = make_checker((preview_w, preview_h))
            bg.alpha_composite(preview, ((preview_w - preview.width) // 2, (preview_h - preview.height) // 2))
            sheet.alpha_composite(bg, (x, y))
            draw.rectangle((x, y, x + preview_w - 1, y + preview_h - 1), outline=(0, 120, 80, 255))
            draw.text((x + 3, y - label_h), f"{row}:{col}", fill=(0, 0, 0, 255))

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output)


def validate(args: argparse.Namespace) -> dict:
    source = Path(args.input).expanduser().resolve()
    cell_height = args.cell_height or args.cell_width
    chroma_key = parse_hex_color(args.chroma_key) if args.chroma_key else None

    with Image.open(source) as opened:
        atlas = opened.convert("RGBA")

    expected = (args.columns * args.cell_width, args.rows * cell_height)
    errors: list[str] = []
    warnings: list[str] = []
    cells: list[dict] = []

    if atlas.size != expected:
        errors.append(f"atlas is {atlas.width}x{atlas.height}; expected {expected[0]}x{expected[1]}")

    scan_rows = args.rows if atlas.height >= expected[1] else max(0, atlas.height // cell_height)
    scan_cols = args.columns if atlas.width >= expected[0] else max(0, atlas.width // args.cell_width)

    for row in range(scan_rows):
        for col in range(scan_cols):
            box = (
                col * args.cell_width,
                row * cell_height,
                (col + 1) * args.cell_width,
                (row + 1) * cell_height,
            )
            frame = atlas.crop(box)
            nontransparent = alpha_count(frame)
            edge_pixels = edge_count(frame, args.edge_margin)
            alpha_bbox = frame.getchannel("A").getbbox()
            opaque_ratio = nontransparent / float(args.cell_width * cell_height)
            chroma_pixels = near_color_count(frame, chroma_key, args.chroma_threshold) if chroma_key else 0

            if nontransparent < args.min_alpha_pixels:
                warnings.append(f"cell {row}:{col} is sparse or empty ({nontransparent} alpha pixels)")
            if edge_pixels > args.edge_threshold:
                warnings.append(f"cell {row}:{col} has {edge_pixels} alpha pixels near the cell edge")
            if opaque_ratio > args.max_opaque_ratio:
                warnings.append(f"cell {row}:{col} is {opaque_ratio:.1%} opaque; background may not be transparent")
            if chroma_pixels:
                message = f"cell {row}:{col} has {chroma_pixels} opaque pixels near chroma key"
                if args.fail_on_chroma:
                    errors.append(message)
                else:
                    warnings.append(message)

            cells.append(
                {
                    "row": row,
                    "column": col,
                    "nontransparent_pixels": nontransparent,
                    "opaque_ratio": round(opaque_ratio, 5),
                    "edge_pixels": edge_pixels,
                    "alpha_bbox": alpha_bbox,
                    "chroma_pixels": chroma_pixels,
                }
            )

    if args.contact_sheet:
        make_contact_sheet(
            atlas,
            args.rows,
            args.columns,
            args.cell_width,
            cell_height,
            Path(args.contact_sheet).expanduser().resolve(),
            args.contact_cell,
        )

    return {
        "ok": not errors,
        "file": str(source),
        "width": atlas.width,
        "height": atlas.height,
        "columns": args.columns,
        "rows": args.rows,
        "cell_width": args.cell_width,
        "cell_height": cell_height,
        "errors": errors,
        "warnings": warnings,
        "cells": cells,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--columns", type=int, required=True)
    parser.add_argument("--rows", type=int, required=True)
    parser.add_argument("--cell-width", type=int, required=True)
    parser.add_argument("--cell-height", type=int)
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--contact-sheet")
    parser.add_argument("--contact-cell", type=int, default=128)
    parser.add_argument("--min-alpha-pixels", type=int, default=500)
    parser.add_argument("--edge-margin", type=int, default=2)
    parser.add_argument("--edge-threshold", type=int, default=64)
    parser.add_argument("--max-opaque-ratio", type=float, default=0.92)
    parser.add_argument("--chroma-key")
    parser.add_argument("--chroma-threshold", type=int, default=12)
    parser.add_argument("--fail-on-chroma", action="store_true")
    args = parser.parse_args()

    result = validate(args)
    out = Path(args.json_out).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")

    summary = {"ok": result["ok"], "errors": result["errors"], "warning_count": len(result["warnings"])}
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    if result["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
