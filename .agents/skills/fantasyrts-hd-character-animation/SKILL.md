---
name: fantasyrts-hd-character-animation
description: Create, adapt, validate, and package HD 2D character animation sprite atlases for FantasyRTS. Use when working on unit or character sprite sheets, generated 2D animation frames, transparent PNG atlases, animation prompts, animation QA, or integrating non-pixel-art HD sprites with scripts/sprite-config.js and scripts/rendering3d.js.
---

# FantasyRTS HD Character Animation

## Overview

Produce HD, non-pixel-art 2D character animation atlases that fit FantasyRTS' current Three.js sprite-sheet renderer. This skill adapts the useful workflow from 64px pixel-art character skills while avoiding pixel cleanup that would damage HD artwork.

## Default Contract

Prefer the current game contract unless the user explicitly asks to migrate the renderer:

- Atlas layout: `7 columns x 4 rows`, matching `SHEET_LAYOUT` in `scripts/sprite-config.js`.
- View model: quarter-view 4-direction behavior using `front_right` and `back_left`, with flips for the mirrored directions.
- Cell size: use `256x256` for normal units or `512x512` for hero/boss-quality source art. Keep every cell the same size.
- Output: transparent PNG atlas, no floor, no baked shadow, no text, no frame numbers, no background color.
- Engine-facing path: add final assets through `SPRITE_PATHS` and `UNIT_TYPE_TO_SPRITE` only after the asset exists.

Read `references/fantasyrts-sprite-contract.md` before changing engine code, atlas layout, direction mapping, or animation index definitions.

## Workflow

1. Establish identity: unit type, silhouette, weapon, armor/clothing, palette, faction readability, and must-keep reference details.
2. Create a canonical neutral frame first. Lock proportions, face direction, weapon scale, and faction colors before generating other frames.
3. Generate or assemble animation frames as HD sprites. Use prompts like:

```text
HD 2D game character sprite animation frame, transparent background, quarter-view fantasy RTS unit, clean readable silhouette, consistent proportions, consistent outfit and weapon, no pixel art, no floor shadow, no UI, no text.
```

4. Compose frames into the FantasyRTS atlas. Keep feet and body center visually stable between frames; do not let weapons or VFX cross neighboring cells.
5. Validate geometry and frame content with `scripts/validate_hd_atlas.py`.
6. Export row previews with `scripts/export_hd_previews.py` and visually inspect identity drift, jitter, clipping, detached weapons, and mismatched lighting.
7. Integrate only after QA passes. If the HD asset looks jagged in-game, consider changing the relevant Three.js texture filters from nearest-neighbor to linear filtering as a separate engine change.

## Do Not Use Pixel-Art Cleanup

Do not run palette quantization, nearest-neighbor pixelation, or hard-edge snapping on HD character art. Those operations are for low-resolution pixel art and will damage soft linework, painted details, antialiasing, and semi-transparent edges.

Use chroma key only as an intermediate fallback. Prefer true alpha output. If chroma key is used, remove only border-connected background and validate residue before accepting the atlas.

## Validation

Validate a current-layout HD atlas:

```bash
python .agents/skills/fantasyrts-hd-character-animation/scripts/validate_hd_atlas.py \
  --input path/to/unit.png \
  --columns 7 \
  --rows 4 \
  --cell-width 256 \
  --cell-height 256 \
  --json-out path/to/qa/validation.json \
  --contact-sheet path/to/qa/contact-sheet.png
```

Export row previews:

```bash
python .agents/skills/fantasyrts-hd-character-animation/scripts/export_hd_previews.py \
  --atlas path/to/unit.png \
  --columns 7 \
  --rows 4 \
  --cell-width 256 \
  --cell-height 256 \
  --row-names front-base,back-base,front-combat,back-combat \
  --out-dir path/to/qa/previews
```

Prefer animated WebP previews for HD art. GIF is not the default because smooth alpha and antialiasing often degrade badly in GIF palettes.

## Project Safety

FantasyRTS project instructions mark `sprites/`, `assets/`, and `scripts/tools/` as normally off-limits. Do not inspect or edit those directories unless the user explicitly authorizes asset work. For planning and workflow changes, keep artifacts under `.agents/skills/`, `docs/`, or a user-specified output directory.
