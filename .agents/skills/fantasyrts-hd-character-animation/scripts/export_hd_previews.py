#!/usr/bin/env python3
"""Export animated WebP and PNG strip previews from a fixed-cell HD atlas."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


def make_checker(size: tuple[int, int], block: int = 16) -> Image.Image:
    width, height = size
    out = Image.new("RGBA", size, (48, 52, 60, 255))
    draw = ImageDraw.Draw(out)
    for y in range(0, height, block):
        for x in range(0, width, block):
            if ((x // block) + (y // block)) % 2:
                draw.rectangle((x, y, x + block - 1, y + block - 1), fill=(72, 78, 88, 255))
    return out


def resize_frame(frame: Image.Image, preview_width: int) -> Image.Image:
    if preview_width <= 0 or frame.width == preview_width:
        return frame.copy()
    preview_height = max(1, round(frame.height * (preview_width / frame.width)))
    return frame.resize((preview_width, preview_height), Image.Resampling.LANCZOS)


def extract_row(
    atlas: Image.Image,
    row: int,
    columns: int,
    cell_width: int,
    cell_height: int,
) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for col in range(columns):
        frames.append(
            atlas.crop(
                (
                    col * cell_width,
                    row * cell_height,
                    (col + 1) * cell_width,
                    (row + 1) * cell_height,
                )
            ).convert("RGBA")
        )
    return frames


def save_transparent_webp(frames: list[Image.Image], path: Path, preview_width: int, duration: int) -> None:
    resized = [resize_frame(frame, preview_width) for frame in frames]
    resized[0].save(
        path,
        save_all=True,
        append_images=resized[1:],
        duration=duration,
        loop=0,
        lossless=True,
        exact=True,
        method=6,
    )


def save_checker_webp(frames: list[Image.Image], path: Path, preview_width: int, duration: int) -> None:
    resized = [resize_frame(frame, preview_width) for frame in frames]
    composited: list[Image.Image] = []
    for frame in resized:
        bg = make_checker(frame.size)
        bg.alpha_composite(frame)
        composited.append(bg.convert("RGB"))
    composited[0].save(
        path,
        save_all=True,
        append_images=composited[1:],
        duration=duration,
        loop=0,
        lossless=True,
        method=6,
    )


def save_strip(frames: list[Image.Image], path: Path, preview_width: int) -> None:
    resized = [resize_frame(frame, preview_width) for frame in frames]
    width = sum(frame.width for frame in resized)
    height = max(frame.height for frame in resized)
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    x = 0
    for frame in resized:
        out.alpha_composite(frame, (x, (height - frame.height) // 2))
        x += frame.width
    out.save(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--columns", type=int, required=True)
    parser.add_argument("--rows", type=int, required=True)
    parser.add_argument("--cell-width", type=int, required=True)
    parser.add_argument("--cell-height", type=int)
    parser.add_argument("--row-names", default="")
    parser.add_argument("--prefix", default="row")
    parser.add_argument("--preview-width", type=int, default=256)
    parser.add_argument("--duration", type=int, default=90)
    args = parser.parse_args()

    cell_height = args.cell_height or args.cell_width
    atlas_path = Path(args.atlas).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    row_names = [name.strip() for name in args.row_names.split(",") if name.strip()]
    if row_names and len(row_names) != args.rows:
        raise SystemExit(f"--row-names has {len(row_names)} names; expected {args.rows}")

    with Image.open(atlas_path) as opened:
        atlas = opened.convert("RGBA")

    expected = (args.columns * args.cell_width, args.rows * cell_height)
    if atlas.size != expected:
        raise SystemExit(f"atlas is {atlas.width}x{atlas.height}; expected {expected[0]}x{expected[1]}")

    for row in range(args.rows):
        name = row_names[row] if row_names else f"{row:02d}"
        stem = f"{args.prefix}-{name}"
        frames = extract_row(atlas, row, args.columns, args.cell_width, cell_height)
        save_transparent_webp(frames, out_dir / f"{stem}-transparent.webp", args.preview_width, args.duration)
        save_checker_webp(frames, out_dir / f"{stem}-checker.webp", args.preview_width, args.duration)
        save_strip(frames, out_dir / f"{stem}-strip.png", args.preview_width)

    print(f"wrote previews to {out_dir}")


if __name__ == "__main__":
    main()
