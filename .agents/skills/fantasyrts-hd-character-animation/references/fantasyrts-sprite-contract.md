# FantasyRTS Sprite Contract

Use this reference when adapting generated HD 2D character animations to the current FantasyRTS renderer.

## Current Engine Shape

- `scripts/sprite-config.js` defines `SPRITE_PATHS`, `UNIT_TYPE_TO_SPRITE`, `SHEET_LAYOUT`, `DIRECTIONS`, `ANIMATIONS`, and `WEAPON_HAND_CONFIG`.
- `SHEET_LAYOUT` is currently `cols: 7`, `rows: 4`.
- Directions are not full 8-direction rows. The current renderer maps game directions to two source views plus horizontal flips:
  - `0`: `front_right`, not flipped
  - `1`: `front_right`, flipped
  - `2`: `back_left`, not flipped
  - `3`: `back_left`, flipped
- `ANIMATIONS` uses frame indices inside the 7x4 sheet, for example `idle: [0]`, `walk: [1, 2]`, `attack` variants around indices `17` and `19`, and other single-frame states such as damage, death, magic, and talk.
- `scripts/rendering3d.js` loads each sheet once per unit type, hue-shifts a west-side variant, clones textures per unit, and animates by changing `texture.repeat` and `texture.offset`.
- Unit characters are rendered as billboarding plane meshes named `unitSprite`.
- Separate VFX atlases already use metadata objects with `cols`, `rows`, `frameCount`, `fps`, and `planeScale`. That pattern is a good model if unit animations later need richer metadata.

## HD Asset Guidance

- Start with `256x256` cells for normal units. Use `512x512` when the art is meant to survive downscaling or future zoomed presentation.
- Keep the character's foot anchor and body center stable in every frame. FantasyRTS has no per-frame pivot metadata for unit sprites, so visual alignment must be baked into the cell.
- Leave enough transparent padding for weapons and attack poses. Edge contact is a warning unless the frame intentionally fills the cell.
- Do not bake ground shadows or floor ellipses into the sprite. The game world supplies placement context.
- Avoid embedded projectiles in unit attack frames unless the user specifically wants that. Projectiles and magic impacts should usually be separate effects.
- Keep faction readability independent of the existing hue-shift fallback. Hue shift may recolor unrelated details, so strong HD assets should reserve a clear faction accent region.

## Integration Checklist

1. Validate atlas dimensions: `columns * cell_width` by `rows * cell_height`.
2. Export row previews and inspect for identity drift, jitter, clipping, and inconsistent weapon scale.
3. If the asset uses the existing 7x4 layout, update only `SPRITE_PATHS` and `UNIT_TYPE_TO_SPRITE` after the PNG exists.
4. If the asset changes layout, update `SHEET_LAYOUT`, `DIRECTIONS`, and `ANIMATIONS` together. Do not mix old indices with a new atlas shape.
5. If HD art appears jagged, review `createTextureFromImage` and `createTextureFromCanvas` in `scripts/rendering3d.js`; nearest-neighbor filtering is ideal for pixel art but not for smooth HD sprites.
