from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source_strip_alpha.png"
FRAME_COUNT = 7


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        return (0, 0, image.width, image.height)
    return bbox


def find_components(image: Image.Image, alpha_threshold: int = 24) -> list[dict]:
    alpha = image.getchannel("A")
    width, height = image.size
    data = alpha.load()
    visited = bytearray(width * height)
    components: list[dict] = []

    def idx(x: int, y: int) -> int:
        return y * width + x

    for y in range(height):
        for x in range(width):
            i = idx(x, y)
            if visited[i] or data[x, y] <= alpha_threshold:
                visited[i] = 1
                continue
            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited[i] = 1
            min_x = max_x = x
            min_y = max_y = y
            area = 0
            while queue:
                cx, cy = queue.popleft()
                area += 1
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)
                for ny in range(max(0, cy - 1), min(height, cy + 2)):
                    for nx in range(max(0, cx - 1), min(width, cx + 2)):
                        ni = idx(nx, ny)
                        if visited[ni]:
                            continue
                        visited[ni] = 1
                        if data[nx, ny] > alpha_threshold:
                            queue.append((nx, ny))
            if area >= 60:
                components.append(
                    {
                        "bbox": (min_x, min_y, max_x + 1, max_y + 1),
                        "area": area,
                        "cx": (min_x + max_x + 1) / 2,
                        "cy": (min_y + max_y + 1) / 2,
                    }
                )
    return components


def group_components(components: list[dict], width: int, frame_count: int) -> list[dict]:
    # Use x-position clustering. Generated sprite sheets may contain separated slash arcs,
    # so grouping by nearest equal-width frame center is more stable than raw connected components.
    centers = [(i + 0.5) * width / frame_count for i in range(frame_count)]
    groups = [
        {
            "components": [],
            "bbox": None,
            "center_x": center,
        }
        for center in centers
    ]

    for comp in components:
        x0, y0, x1, y1 = comp["bbox"]
        cx = comp["cx"]
        # Tiny anti-aliased specks can be ignored.
        if comp["area"] < 150:
            continue
        group_i = min(range(frame_count), key=lambda i: abs(cx - centers[i]))
        groups[group_i]["components"].append(comp)

    for group in groups:
        comps = group["components"]
        if not comps:
            continue
        x0 = min(comp["bbox"][0] for comp in comps)
        y0 = min(comp["bbox"][1] for comp in comps)
        x1 = max(comp["bbox"][2] for comp in comps)
        y1 = max(comp["bbox"][3] for comp in comps)
        group["bbox"] = (x0, y0, x1, y1)
    return groups


def crop_frame(source: Image.Image, bbox: tuple[int, int, int, int], pad: int = 34) -> Image.Image:
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(source.width, x1 + pad)
    y1 = min(source.height, y1 + pad)
    return source.crop((x0, y0, x1, y1))


def normalize_frame(frame: Image.Image, cell: int, anchor_y: float = 0.92) -> Image.Image:
    bbox = alpha_bbox(frame)
    crop = frame.crop(bbox)
    max_w = int(cell * 0.88)
    max_h = int(cell * 0.90)
    scale = min(max_w / crop.width, max_h / crop.height, 1.0)
    resized = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    x = (cell - resized.width) // 2
    y = round(cell * anchor_y) - resized.height
    y = max(0, min(cell - resized.height, y))
    out.alpha_composite(resized, (x, y))
    return out


def make_strip(frames: list[Image.Image]) -> Image.Image:
    out = Image.new("RGBA", (frames[0].width * len(frames), frames[0].height), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        out.alpha_composite(frame, (i * frame.width, 0))
    return out


def make_7x4_atlas(frames_256: list[Image.Image]) -> Image.Image:
    atlas = Image.new("RGBA", (256 * FRAME_COUNT, 256 * 4), (0, 0, 0, 0))
    # Temporary contract: row 0 and row 2 contain the front-right attack sequence.
    # Other rows remain transparent placeholders because no back-view attack was requested.
    for i, frame in enumerate(frames_256):
        atlas.alpha_composite(frame, (i * 256, 0))
        atlas.alpha_composite(frame, (i * 256, 2 * 256))
    return atlas


def checker(size: tuple[int, int], block: int = 16) -> Image.Image:
    out = Image.new("RGBA", size, (52, 56, 64, 255))
    draw = ImageDraw.Draw(out)
    for y in range(0, size[1], block):
        for x in range(0, size[0], block):
            if ((x // block) + (y // block)) % 2:
                draw.rectangle((x, y, x + block - 1, y + block - 1), fill=(78, 84, 94, 255))
    return out


def save_webp_preview(frames: list[Image.Image], path: Path, cell: int, duration: int = 105) -> None:
    previews = []
    for frame in frames:
        bg = checker((cell, cell))
        bg.alpha_composite(frame)
        previews.append(bg.convert("RGB"))
    previews[0].save(path, save_all=True, append_images=previews[1:], duration=duration, loop=0, lossless=True, method=6)


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    components = find_components(source)
    groups = group_components(components, source.width, FRAME_COUNT)
    missing = [i for i, group in enumerate(groups) if group["bbox"] is None]
    if missing:
        raise SystemExit(f"Missing frame groups: {missing}")

    crops = [crop_frame(source, group["bbox"]) for group in groups]
    frames_512 = [normalize_frame(crop, 512) for crop in crops]
    frames_256 = [normalize_frame(crop, 256) for crop in crops]

    strip_512 = make_strip(frames_512)
    strip_256 = make_strip(frames_256)
    atlas_7x4 = make_7x4_atlas(frames_256)

    strip_512.save(ROOT / "soldier_attack_iso_v2_strip_7x512.png")
    strip_256.save(ROOT / "soldier_attack_iso_v2_strip_7x256.png")
    atlas_7x4.save(ROOT / "soldier_attack_iso_v2_atlas_7x4_256.png")
    save_webp_preview(frames_512, ROOT / "soldier_attack_iso_v2_attack_preview_512.webp", 512)
    save_webp_preview(frames_256, ROOT / "soldier_attack_iso_v2_attack_preview_256.webp", 256)

    manifest = {
        "name": "soldier_attack_iso_v2",
        "status": "temporary generated asset, not linked to game runtime",
        "sourceGeneratedImage": str(ROOT / "source_generated_strip_green.png"),
        "sourceAlpha": str(SOURCE),
        "frameCount": FRAME_COUNT,
        "outputs": {
            "strip512": "soldier_attack_iso_v2_strip_7x512.png",
            "strip256": "soldier_attack_iso_v2_strip_7x256.png",
            "atlas7x4": "soldier_attack_iso_v2_atlas_7x4_256.png",
            "preview512": "soldier_attack_iso_v2_attack_preview_512.webp",
            "preview256": "soldier_attack_iso_v2_attack_preview_256.webp",
        },
        "notes": [
            "Created from ChatGPT built-in image generation using the provided three-view soldier reference.",
            "Green chroma background removed locally; original generated image was copied into the artifact folder and left intact in the generated_images store.",
            "The 7x4 atlas is a temporary convenience artifact: rows 0 and 2 contain the same front-right attack strip; rows 1 and 3 are transparent placeholders.",
            "No runtime integration was performed.",
        ],
        "frameBBoxes": [group["bbox"] for group in groups],
        "componentCounts": [len(group["components"]) for group in groups],
    }
    (ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": True, "components": len(components), "groups": [group["bbox"] for group in groups]}, indent=2))


if __name__ == "__main__":
    main()
