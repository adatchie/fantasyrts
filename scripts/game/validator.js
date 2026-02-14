/**
 * SEKIGAHARA RTS - Validator Module
 * バリデーション関数群
 *
 * マップデータ、ユニット定義、配置データの検証を行う関数を提供します。
 */

import { MAP_W, MAP_H } from '../constants.js';

// バリデーションエラーメッセージ定数
export const VALIDATION_ERRORS = {
    NO_MAP_DATA: 'マップデータが存在しません',
    NO_UNIT_DEFINITION: 'ユニット定義が存在しません',
    INVALID_TERRAIN_WIDTH: 'terrain.width が無効です: {0} (最小10以上)',
    INVALID_TERRAIN_HEIGHT: 'terrain.height が無効です: {0} (最小10以上)',
    MISSING_TERRAIN_DATA: 'terrain データが存在しません',
    MISSING_HEIGHT_MAP: 'terrain.heightMap が配列ではありません',
    MISSING_TERRAIN_TYPE: 'terrain.terrainType が配列ではありません',
    INVALID_BUILDINGS: 'buildings が配列ではありません',
    INVALID_UNIT_DEFINITIONS: 'unitDefinitions が配列ではありません',
    INVALID_UNITS: 'units が配列ではありません',
    INVALID_PLACEMENTS: 'placements が配列ではありません',
    MISSING_ID: 'id が存在しません',
    MISSING_NAME: 'name が存在しません',
    MISSING_TYPE: 'type が存在しません',
    INVALID_COUNT: 'count が無効です: {0} (1-30の範囲で指定してください)',
    INVALID_X: 'x が無効です: {0} (0-{1}の範囲で指定してください)',
    INVALID_Y: 'y が無効です: {0} (0-{1}の範囲で指定してください)',
    INVALID_ATK: 'atk が無効です: {0}',
    INVALID_DEF: 'def が無効です: {0}',
    TOO_MANY_PLACEMENTS: '配置数が多すぎます: {0} (最大8部隊まで)'
};

/**
 * カスタムマップデータのバリデーション
 *
 * @param {Object} mapData - 検証するマップデータ
 * @returns {Object} 検証結果 {valid: boolean, errors: string[]}
 */
export function validateMapData(mapData) {
    const errors = [];

    if (!mapData) {
        return { valid: false, errors: [VALIDATION_ERRORS.NO_MAP_DATA] };
    }

    // 地形データのチェック
    if (!mapData.terrain) {
        errors.push(VALIDATION_ERRORS.MISSING_TERRAIN_DATA);
    } else {
        if (typeof mapData.terrain.width !== 'number' || mapData.terrain.width <= 0) {
            errors.push(VALIDATION_ERRORS.INVALID_TERRAIN_WIDTH.replace('{0}', mapData.terrain.width));
        }
        if (typeof mapData.terrain.height !== 'number' || mapData.terrain.height <= 0) {
            errors.push(VALIDATION_ERRORS.INVALID_TERRAIN_HEIGHT.replace('{0}', mapData.terrain.height));
        }
        // 最小サイズチェック（10x10以下のマップを警告）
        if (mapData.terrain.width < 10) {
            errors.push(VALIDATION_ERRORS.INVALID_TERRAIN_WIDTH.replace('{0}', mapData.terrain.width));
        }
        if (mapData.terrain.height < 10) {
            errors.push(VALIDATION_ERRORS.INVALID_TERRAIN_HEIGHT.replace('{0}', mapData.terrain.height));
        }
        if (!Array.isArray(mapData.terrain.heightMap)) {
            errors.push(VALIDATION_ERRORS.MISSING_HEIGHT_MAP);
        }
        if (!Array.isArray(mapData.terrain.terrainType)) {
            errors.push(VALIDATION_ERRORS.MISSING_TERRAIN_TYPE);
        }
    }

    // 建物データのチェック
    if (mapData.buildings && !Array.isArray(mapData.buildings)) {
        errors.push(VALIDATION_ERRORS.INVALID_BUILDINGS);
    }

    // ユニット定義のチェック
    if (mapData.unitDefinitions && !Array.isArray(mapData.unitDefinitions)) {
        errors.push(VALIDATION_ERRORS.INVALID_UNIT_DEFINITIONS);
    }

    // ユニット配置のチェック
    if (mapData.units && !Array.isArray(mapData.units)) {
        errors.push(VALIDATION_ERRORS.INVALID_UNITS);
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * ユニット定義のバリデーション
 *
 * @param {Object} unitDef - 検証するユニット定義
 * @returns {Object} 検証結果 {valid: boolean, errors: string[]}
 */
export function validateUnitData(unitDef) {
    const errors = [];

    if (!unitDef) {
        return { valid: false, errors: [VALIDATION_ERRORS.NO_UNIT_DEFINITION] };
    }

    // 必須フィールドのチェック
    if (unitDef.id === undefined || unitDef.id === null) {
        errors.push(VALIDATION_ERRORS.MISSING_ID);
    }
    if (!unitDef.name) {
        errors.push(VALIDATION_ERRORS.MISSING_NAME);
    }
    if (!unitDef.type) {
        errors.push(VALIDATION_ERRORS.MISSING_TYPE);
    }

    // 数値フィールドのチェック（NaN、Infinity、範囲外）
    if (unitDef.count !== undefined) {
        const count = Number(unitDef.count);
        if (isNaN(count) || !isFinite(count) || count < 1 || count > 30) {
            errors.push(VALIDATION_ERRORS.INVALID_COUNT.replace('{0}', unitDef.count));
        }
    }

    // MAP_W, MAP_H の境界値チェック（境界を含む）
    if (unitDef.x !== undefined) {
        const x = Number(unitDef.x);
        if (isNaN(x) || x < 0 || x > MAP_W - 1) {  // MAP_W - 1 まで有効
            errors.push(VALIDATION_ERRORS.INVALID_X.replace('{0}', unitDef.x).replace('{1}', MAP_W - 1));
        }
    }

    if (unitDef.y !== undefined) {
        const y = Number(unitDef.y);
        if (isNaN(y) || y < 0 || y > MAP_H - 1) {  // MAP_H - 1 まで有効
            errors.push(VALIDATION_ERRORS.INVALID_Y.replace('{0}', unitDef.y).replace('{1}', MAP_H - 1));
        }
    }

    // ステータス値のチェック
    if (unitDef.atk !== undefined) {
        const atk = Number(unitDef.atk);
        if (isNaN(atk) || !isFinite(atk) || atk < 0 || atk > 200) {
            errors.push(VALIDATION_ERRORS.INVALID_ATK.replace('{0}', unitDef.atk));
        }
    }

    if (unitDef.def !== undefined) {
        const def = Number(unitDef.def);
        if (isNaN(def) || !isFinite(def) || def < 0 || def > 200) {
            errors.push(VALIDATION_ERRORS.INVALID_DEF.replace('{0}', unitDef.def));
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * 配置データのバリデーション
 *
 * @param {Array} placements - 検証する配置データ配列
 * @returns {Object} 検証結果 {valid: boolean, errors: string[]}
 */
export function validatePlacements(placements) {
    const errors = [];

    if (!placements) {
        return { valid: true, errors: [] }; // 配置なしは有効
    }

    if (!Array.isArray(placements)) {
        return { valid: false, errors: [VALIDATION_ERRORS.INVALID_PLACEMENTS] };
    }

    // 配置数のチェック（最大8部隊）
    if (placements.length > 8) {
        errors.push(VALIDATION_ERRORS.TOO_MANY_PLACEMENTS.replace('{0}', placements.length));
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}
