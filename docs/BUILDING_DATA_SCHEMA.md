# Building Data Schema Specification

This document describes the JSON data structure used for saving and loading building blueprints in the Fantasy RTS Building Editor.

## Overview

Building data represents a voxel-based 3D structure. It is used by the `BuildingEditor` to restore blueprints and by the `BuildingSystem` to instantiate buildings in the game world.

## JSON Structure

The root object contains the following properties:

```json
{
  "name": "string",
  "size": {
    "x": number,
    "y": number,
    "z": number
  },
  "blocks": [
    // Array<Array<Array<number>>>
  ]
}
```

### Properties

- **name** (`string`): The name of the building blueprint (e.g., "Castle Gate").
- **size** (`object`): Dimensions of the building block grid.
    - `x`: Width (number of blocks along the X-axis).
    - `y`: Depth (number of blocks along the Y-axis).
    - `z`: Height (number of blocks along the Z-axis).
- **blocks** (`array`): A 3-dimensional array representing the block type at each coordinate. The indices are organized as `[z][y][x]`.

### Coordinate System

- **Z-axis** (1st index): Height layer. `0` is the bottom-most layer (ground level).
- **Y-axis** (2nd index): Depth.
- **X-axis** (3rd index): Width.

### Block Types

Block types are represented by integers mapped to specific materials and game logic.

| ID | Type Name | Description | Color (Hex) |
| :--- | :--- | :--- | :--- |
| 0 | `AIR` | Empty space. No block is rendered. | N/A |
| 1 | `STONE_WALL` | Stone wall block. | `0x888888` |
| 2 | `STONE_FLOOR` | Stone flooring block. | `0x666666` |
| 3 | `WOOD_WALL` | Wooden wall block. | `0x8B4513` |
| 4 | `WOOD_FLOOR` | Wooden flooring block. | `0xA0522D` |
| 5 | `ROOF_TILE` | Roof tile block. | `0xB22222` |
| 6 | `WOOD_DOOR` | Wooden door. | `0x654321` |
| 7 | `WINDOW` | Window block. | `0x87CEEB` |

## Example

A simple 2x2x2 structure with a stone floor and one wall block:

```json
{
  "name": "Tiny Hut",
  "size": { "x": 2, "y": 2, "z": 2 },
  "blocks": [
    [
      [2, 2],
      [2, 2]
    ],
    [
      [1, 0],
      [0, 0]
    ]
  ]
}
```

## Usage

1. **Importing**: Paste the JSON content into the "Import JSON" modal in the Building Editor.
2. **Exporting**: Click "Export JSON" in the Building Editor to generate this format.
3. **Game Data**: Stored in `BUILDING_TEMPLATES` in `scripts/building.js` (or loaded dynamically).
