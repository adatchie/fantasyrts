import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    ATTACK_PATTERNS,
    RANGE_TYPE_NAMES,
    rotatePattern,
    isInAttackRange,
    getAttackableGrids
} from '../scripts/attack-patterns.js';

// ── ATTACK_PATTERNS 構造検証 ──
describe('ATTACK_PATTERNS', () => {
    it('すべての rangeType が定義されている', () => {
        const expected = ['melee', 'forward2', 'heal', 'bowArc', 'longArc', 'aoe', 'breath', 'siege'];
        for (const key of expected) {
            assert.ok(ATTACK_PATTERNS[key], `Missing pattern: ${key}`);
            assert.ok(Array.isArray(ATTACK_PATTERNS[key]), `${key} should be an array`);
            assert.ok(ATTACK_PATTERNS[key].length > 0, `${key} should not be empty`);
        }
    });

    it('各パターンの要素が {dx, dy} 形式', () => {
        for (const [name, pattern] of Object.entries(ATTACK_PATTERNS)) {
            for (const p of pattern) {
                assert.ok(typeof p.dx === 'number', `${name}: dx should be number`);
                assert.ok(typeof p.dy === 'number', `${name}: dy should be number`);
            }
        }
    });

    it('melee は周囲4マス（十字）', () => {
        const melee = ATTACK_PATTERNS.melee;
        assert.equal(melee.length, 4);
        const coords = new Set(melee.map(p => `${p.dx},${p.dy}`));
        assert.ok(coords.has('0,-1'), '前');
        assert.ok(coords.has('1,0'), '右');
        assert.ok(coords.has('0,1'), '後');
        assert.ok(coords.has('-1,0'), '左');
    });

    it('forward2 は前方2マス', () => {
        const fwd = ATTACK_PATTERNS.forward2;
        assert.equal(fwd.length, 2);
        assert.deepEqual(fwd[0], { dx: 0, dy: -1 });
        assert.deepEqual(fwd[1], { dx: 0, dy: -2 });
    });

    it('bowArc は射程3〜5のドーナツ状', () => {
        const bow = ATTACK_PATTERNS.bowArc;
        for (const p of bow) {
            const dist = Math.abs(p.dx) + Math.abs(p.dy);
            assert.ok(dist >= 3 && dist <= 5, `(${p.dx},${p.dy}) dist=${dist} out of range`);
        }
    });

    it('siege は前方直線3〜8マス', () => {
        const siege = ATTACK_PATTERNS.siege;
        assert.equal(siege.length, 6);
        for (const p of siege) {
            assert.equal(p.dx, 0, 'siege should be straight forward');
            assert.ok(p.dy <= -3 && p.dy >= -8, `dy=${p.dy} out of siege range`);
        }
    });
});

// ── rotatePattern ──
describe('rotatePattern', () => {
    const cross = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }
    ];

    it('dir=0 はそのまま', () => {
        const r = rotatePattern(cross, 0);
        assert.deepEqual(r, cross);
    });

    it('dir=1 は時計回り90度', () => {
        const r = rotatePattern(cross, 1).map(p => ({ dx: p.dx + 0, dy: p.dy + 0 }));
        assert.equal(r[0].dx, 1);  assert.equal(r[0].dy, 0);   // 前→右
        assert.equal(r[1].dx, 0);  assert.equal(r[1].dy, 1);   // 右→後
    });

    it('dir=2 は180度回転', () => {
        const r = rotatePattern(cross, 2).map(p => ({ dx: p.dx + 0, dy: p.dy + 0 }));
        assert.equal(r[0].dx, 0);  assert.equal(r[0].dy, 1);   // 前→後
        assert.equal(r[1].dx, -1); assert.equal(r[1].dy, 0);   // 右→左
    });

    it('dir=3 は反時計回り90度', () => {
        const r = rotatePattern(cross, 3).map(p => ({ dx: p.dx + 0, dy: p.dy + 0 }));
        assert.equal(r[0].dx, -1); assert.equal(r[0].dy, 0);   // 前→左
    });

    it('無効なdir値はそのまま返す', () => {
        const r = rotatePattern(cross, 99);
        assert.deepEqual(r, cross);
    });
});

// ── isInAttackRange ──
describe('isInAttackRange', () => {
    it('melee: 隣接マスは攻撃可能', () => {
        const attacker = { x: 5, y: 5, dir: 0 };
        assert.ok(isInAttackRange(attacker, { x: 5, y: 4 }, 'melee'));  // 前
        assert.ok(isInAttackRange(attacker, { x: 6, y: 5 }, 'melee'));  // 右
        assert.ok(isInAttackRange(attacker, { x: 5, y: 6 }, 'melee'));  // 後
        assert.ok(isInAttackRange(attacker, { x: 4, y: 5 }, 'melee'));  // 左
    });

    it('melee: 2マス先は攻撃不可', () => {
        const attacker = { x: 5, y: 5, dir: 0 };
        assert.ok(!isInAttackRange(attacker, { x: 5, y: 3 }, 'melee'));
    });

    it('bowArc: 射程3は届く、射程2は届かない', () => {
        const attacker = { x: 10, y: 10, dir: 0 };
        // マンハッタン距離3
        assert.ok(isInAttackRange(attacker, { x: 10, y: 7 }, 'bowArc'));
        // マンハッタン距離2（近すぎ）
        assert.ok(!isInAttackRange(attacker, { x: 10, y: 8 }, 'bowArc'));
        // マンハッタン距離5
        assert.ok(isInAttackRange(attacker, { x: 10, y: 5 }, 'bowArc'));
    });

    it('存在しないrangeTypeは常にfalse', () => {
        const attacker = { x: 5, y: 5, dir: 0 };
        assert.ok(!isInAttackRange(attacker, { x: 5, y: 4 }, 'nonexistent'));
    });

    it('向きによって範囲が回転する', () => {
        const attacker0 = { x: 5, y: 5, dir: 0 };
        const attacker2 = { x: 5, y: 5, dir: 2 };
        // forward2: dir=0なら前方(-y)に攻撃
        assert.ok(isInAttackRange(attacker0, { x: 5, y: 4 }, 'forward2'));
        // dir=2なら後方(+y)に攻撃
        assert.ok(isInAttackRange(attacker2, { x: 5, y: 6 }, 'forward2'));
    });
});

// ── getAttackableGrids ──
describe('getAttackableGrids', () => {
    it('melee: 攻撃可能座標を返す', () => {
        const unit = { x: 5, y: 5, dir: 0 };
        const grids = getAttackableGrids(unit, 'melee');
        assert.equal(grids.length, 4);
        const coords = new Set(grids.map(g => `${g.x},${g.y}`));
        assert.ok(coords.has('5,4'));
        assert.ok(coords.has('6,5'));
        assert.ok(coords.has('5,6'));
        assert.ok(coords.has('4,5'));
    });

    it('存在しないrangeTypeは空配列', () => {
        const unit = { x: 5, y: 5, dir: 0 };
        const grids = getAttackableGrids(unit, 'nonexistent');
        assert.deepEqual(grids, []);
    });
});

// ── RANGE_TYPE_NAMES ──
describe('RANGE_TYPE_NAMES', () => {
    it('すべてのrangeTypeに表示名がある', () => {
        for (const key of Object.keys(ATTACK_PATTERNS)) {
            assert.ok(RANGE_TYPE_NAMES[key], `Missing name for: ${key}`);
        }
    });
});
