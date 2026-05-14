import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    UNIT_TYPES,
    WEAPON_TYPES,
    getUnitTypeInfo,
    getOccupiedGrids,
    TILE_SIZE,
    MAP_W,
    MAP_H
} from '../scripts/constants.js';

// ── UNIT_TYPES 定義検証 ──
describe('UNIT_TYPES', () => {
    const expectedTypes = [
        'INFANTRY', 'KNIGHT', 'ARCHER', 'SPEAR', 'GUNNER',
        'MAGE', 'PRIEST', 'CAVALRY', 'DRAGON', 'DRAGON_RIDER', 'ARTILLERY'
    ];

    it('11兵種がすべて定義されている', () => {
        for (const id of expectedTypes) {
            assert.ok(UNIT_TYPES[id], `Missing unit type: ${id}`);
        }
        assert.equal(Object.keys(UNIT_TYPES).length, 11);
    });

    it('各兵種に必須プロパティがある', () => {
        const required = ['name', 'size', 'sizeShape', 'rangeType', 'atk', 'def', 'baseHp', 'baseMoveRange', 'mobility', 'cost'];
        for (const [id, type] of Object.entries(UNIT_TYPES)) {
            for (const key of required) {
                assert.ok(type[key] !== undefined, `${id} missing: ${key}`);
            }
        }
    });

    it('sizeは有効な値（1, 2, 4）', () => {
        const validSizes = [1, 2, 4];
        for (const [id, type] of Object.entries(UNIT_TYPES)) {
            assert.ok(validSizes.includes(type.size), `${id} has invalid size: ${type.size}`);
        }
    });

    it('sizeShapeとsizeの整合性', () => {
        const sizeToShape = { 1: 'single', 2: 'vertical', 4: '2x2' };
        for (const [id, type] of Object.entries(UNIT_TYPES)) {
            assert.equal(type.sizeShape, sizeToShape[type.size],
                `${id}: size=${type.size} but shape=${type.sizeShape}`);
        }
    });

    it('rangeTypeがATTACK_PATTERNSに存在するキー', async () => {
        const { ATTACK_PATTERNS } = await import('../scripts/attack-patterns.js');
        for (const [id, type] of Object.entries(UNIT_TYPES)) {
            assert.ok(ATTACK_PATTERNS[type.rangeType],
                `${id} has unknown rangeType: ${type.rangeType}`);
        }
    });

    it('baseHpは正の値', () => {
        for (const [id, type] of Object.entries(UNIT_TYPES)) {
            assert.ok(type.baseHp > 0, `${id}: baseHp=${type.baseHp}`);
        }
    });

    it('baseMoveRangeは正の値', () => {
        for (const [id, type] of Object.entries(UNIT_TYPES)) {
            assert.ok(type.baseMoveRange > 0, `${id}: baseMoveRange=${type.baseMoveRange}`);
        }
    });

    it('特殊能力フラグが正しい', () => {
        assert.equal(UNIT_TYPES.MAGE.isAoe, true);
        assert.equal(UNIT_TYPES.PRIEST.isHealer, true);
        assert.equal(UNIT_TYPES.CAVALRY.canPushBack, true);
    });
});

// ── getUnitTypeInfo ──
describe('getUnitTypeInfo', () => {
    it('有効なIDでタイプ情報を返す', () => {
        const info = getUnitTypeInfo('INFANTRY');
        assert.equal(info.name, '歩兵');
        assert.equal(info.size, 1);
    });

    it('無効なIDでnullを返す', () => {
        assert.equal(getUnitTypeInfo('NONEXISTENT'), null);
    });
});

// ── getOccupiedGrids ──
describe('getOccupiedGrids', () => {
    it('single: 基準位置のみ', () => {
        const grids = getOccupiedGrids(5, 5, 0, 'single');
        assert.equal(grids.length, 1);
        assert.deepEqual(grids[0], { x: 5, y: 5 });
    });

    it('vertical dir=0: 基準＋下', () => {
        const grids = getOccupiedGrids(5, 5, 0, 'vertical');
        assert.equal(grids.length, 2);
        assert.deepEqual(grids[0], { x: 5, y: 5 });
        assert.deepEqual(grids[1], { x: 5, y: 6 });
    });

    it('vertical dir=1: 基準＋左', () => {
        const grids = getOccupiedGrids(5, 5, 1, 'vertical');
        assert.equal(grids.length, 2);
        assert.deepEqual(grids[0], { x: 5, y: 5 });
        assert.deepEqual(grids[1], { x: 4, y: 5 });
    });

    it('vertical dir=2: 基準＋上', () => {
        const grids = getOccupiedGrids(5, 5, 2, 'vertical');
        assert.equal(grids.length, 2);
        assert.deepEqual(grids[0], { x: 5, y: 5 });
        assert.deepEqual(grids[1], { x: 5, y: 4 });
    });

    it('vertical dir=3: 基準＋右', () => {
        const grids = getOccupiedGrids(5, 5, 3, 'vertical');
        assert.equal(grids.length, 2);
        assert.deepEqual(grids[0], { x: 5, y: 5 });
        assert.deepEqual(grids[1], { x: 6, y: 5 });
    });

    it('2x2: 基準＋右＋下＋右下（向き不問）', () => {
        for (const dir of [0, 1, 2, 3]) {
            const grids = getOccupiedGrids(5, 5, dir, '2x2');
            assert.equal(grids.length, 4, `dir=${dir}`);
            const coords = new Set(grids.map(g => `${g.x},${g.y}`));
            assert.ok(coords.has('5,5'), `dir=${dir}: base`);
            assert.ok(coords.has('6,5'), `dir=${dir}: right`);
            assert.ok(coords.has('5,6'), `dir=${dir}: below`);
            assert.ok(coords.has('6,6'), `dir=${dir}: diagonal`);
        }
    });
});

// ── WEAPON_TYPES ──
describe('WEAPON_TYPES', () => {
    it('主要武器種が定義されている', () => {
        const expected = ['sword', 'spear', 'bow', 'gun', 'staff', 'cannon'];
        for (const w of expected) {
            assert.ok(WEAPON_TYPES[w], `Missing weapon: ${w}`);
        }
    });

    it('各武器に必須プロパティがある', () => {
        const required = ['sprite', 'scale', 'pivot', 'hand', 'swing'];
        for (const [id, weapon] of Object.entries(WEAPON_TYPES)) {
            for (const key of required) {
                assert.ok(weapon[key] !== undefined, `${id} missing: ${key}`);
            }
        }
    });

    it('swingに必須パラメータがある', () => {
        const required = ['windupDeg', 'strikeDeg', 'easing'];
        for (const [id, weapon] of Object.entries(WEAPON_TYPES)) {
            for (const key of required) {
                assert.ok(weapon.swing[key] !== undefined, `${id}.swing missing: ${key}`);
            }
        }
    });
});

// ── 基本定数 ──
describe('基本定数', () => {
    it('TILE_SIZEは正の値', () => {
        assert.ok(TILE_SIZE > 0);
    });

    it('マップサイズは正の値', () => {
        assert.ok(MAP_W > 0);
        assert.ok(MAP_H > 0);
    });
});
