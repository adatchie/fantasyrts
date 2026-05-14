import * as THREE from 'three';

export const EFFECT_FACTORY_TABLE = Object.freeze({
    BEAM: { normalizerKey: 'BEAM', factoryKey: 'BEAM' },
    SLASH: { normalizerKey: 'SLASH', factoryKey: 'SLASH' },
    THUNDER_TILE: { normalizerKey: 'THUNDER_TILE', factoryKey: 'THUNDER_TILE' },
    FLOAT_TEXT: { normalizerKey: 'FLOAT_TEXT', factoryKey: 'FLOAT_TEXT' },
    SPARK: { normalizerKey: 'SPARK', factoryKey: 'SPARK' },
    DUST: { normalizerKey: 'DUST', factoryKey: 'DUST' },
    WAVE: { normalizerKey: 'WAVE', factoryKey: 'WAVE' },
    BUBBLE: { normalizerKey: 'BUBBLE', factoryKey: 'BUBBLE' },
    HEX_FLASH: { normalizerKey: 'HEX_FLASH', factoryKey: 'HEX_FLASH' },
    UNIT_FLASH: { normalizerKey: 'UNIT_FLASH', factoryKey: 'UNIT_FLASH' },
    MAGIC_CAST: { normalizerKey: 'MAGIC_CAST', factoryKey: 'MAGIC_CAST' },
    BREATH: { normalizerKey: 'BREATH', factoryKey: 'BREATH' }
});

export const PROJECTILE_RUNNER_TABLE = Object.freeze({
    ARROW: 'runArrowProjectileAnimation',
    MAGIC: 'runMagicProjectileAnimation'
});

export const EFFECT_SPRITE_ATLASES = Object.freeze({
    fire_ground: {
        key: 'fire_ground',
        path: './sprites/effect/normalized/effect_fire_sheet.png',
        cols: 5,
        rows: 5,
        frameCount: 25,
        fps: 20,
        planeScale: { width: 88, height: 88 }
    },
    thunder_strike: {
        key: 'thunder_strike',
        path: './sprites/effect/normalized/effect_thunder_sheet.png',
        cols: 5,
        rows: 6,
        frameCount: 30,
        fps: 24,
        planeScale: { width: 84, height: 172 }
    },
    slash_melee: {
        key: 'slash_melee',
        path: './sprites/effect/normalized/effect_slash_sheet.png',
        cols: 5,
        rows: 4,
        frameCount: 20,
        fps: 24,
        planeScale: { width: 108, height: 72 }
    }
});

export const SLASH_EFFECT_LIBRARY = Object.freeze({
    basic: {
        atlasKey: 'slash_melee',
        frameStart: 15,
        frameCount: 5,
        renderOrder: 1200,
        center: { x: 0.78, y: 36 },
        scale: { width: 0.82, height: 0.78 },
        opacity: 0.82,
        depthTest: false,
        blending: THREE.NormalBlending
    },
    special: {
        atlasKey: 'slash_melee',
        frameStart: 0,
        frameCount: 20,
        renderOrder: 1300,
        center: { x: 0.7, y: 54 },
        scale: { width: 1.35, height: 1.35 },
        opacity: 0.95,
        depthTest: false,
        blending: THREE.AdditiveBlending
    }
});

export const LOW_CLIFF_OCCLUSION_STEP_THRESHOLD = 2;
export const DEBUG_CLIFFS_QUERY_KEY = 'debugCliffs';
