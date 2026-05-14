/**
 * Isometric grid ↔ 3D world coordinate conversion utilities.
 * Pure functions with no side effects or external state.
 */
import { TILE_SIZE, TILE_HEIGHT } from './constants.js';

/**
 * Grid (x, y, z) → isometric 3D world (x, y, z)
 */
export function gridToWorld3D(x, y, z = 0) {
    const worldX = (x - y) * TILE_SIZE / 2;
    const worldZ = (x + y) * TILE_SIZE / 4;
    const worldY = z * TILE_HEIGHT;
    return { x: worldX, y: worldY, z: worldZ };
}

/**
 * 3D world (worldX, worldZ) → grid (x, y)
 */
export function world3DToGrid(worldX, worldZ) {
    const gx = (worldX / (TILE_SIZE / 2) + worldZ / (TILE_SIZE / 4)) / 2;
    const gy = (worldZ / (TILE_SIZE / 4) - worldX / (TILE_SIZE / 2)) / 2;
    return { x: Math.round(gx), y: Math.round(gy) };
}
