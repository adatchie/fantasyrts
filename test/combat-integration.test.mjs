import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isInAttackRange } from '../scripts/attack-patterns.js';
import { isMeleeReachable } from '../scripts/combat.js';

describe('isInAttackRange object API', () => {
    it('melee: 隣接ターゲットは攻撃可能', () => {
        const attacker = { x: 5, y: 5, dir: 0 };
        assert.ok(isInAttackRange(attacker, { x: 5, y: 4 }, 'melee'));
    });

    it('melee: 2マス先は攻撃不可', () => {
        const attacker = { x: 5, y: 5, dir: 0 };
        assert.ok(!isInAttackRange(attacker, { x: 5, y: 3 }, 'melee'));
    });

    it('bowArc: 射程内は攻撃可能', () => {
        const attacker = { x: 10, y: 10, dir: 0 };
        assert.ok(isInAttackRange(attacker, { x: 10, y: 7 }, 'bowArc'));
    });

    it('向きによって攻撃可能範囲が変わる', () => {
        const facingRight = { x: 5, y: 5, dir: 0 };
        const facingUp = { x: 5, y: 5, dir: 3 };
        assert.ok(isInAttackRange(facingRight, { x: 6, y: 5 }, 'melee'));
        assert.ok(isInAttackRange(facingUp, { x: 5, y: 4 }, 'melee'));
    });

    it('num args (旧バグパターン) は常にfalseを返す', () => {
        assert.ok(!isInAttackRange(5, 5, 4, 5, 0, 'melee'));
    });
});

describe('isMeleeReachable: 本番実装のガードを検証', () => {
    const allUnits = [];
    const map = null;

    it('melee: 隣接なら近接可能', () => {
        const unit = { x: 5, y: 5, dir: 0 };
        const target = { x: 5, y: 4 };
        assert.ok(isMeleeReachable(unit, target, allUnits, 'melee', map));
    });

    it('melee: 2マス離れたtarget(size1)は不可', () => {
        const unit = { x: 5, y: 5, dir: 0, size: 1, sizeShape: 'single' };
        const target = { x: 5, y: 3, size: 1, sizeShape: 'single' };
        assert.ok(!isMeleeReachable(unit, target, allUnits, 'melee', map));
    });

    // sizeShape=vertical (騎兵): game dir=0(右)なら占有は(x,y)+(x-1,y)
    it('melee: size2 vertical attacker dir=0(右) は後方左グリッド込みで到達可能', () => {
        const unit = { x: 5, y: 5, dir: 0, size: 2, sizeShape: 'vertical' };
        const target = { x: 2, y: 5, size: 1, sizeShape: 'single' };
        assert.ok(isMeleeReachable(unit, target, allUnits, 'melee', map));
    });

    it('melee: size1 vs size2 vertical target dir=0(右) は後方左グリッド込みで到達可能', () => {
        const unit = { x: 2, y: 5, dir: 0, size: 1, sizeShape: 'single' };
        const target = { x: 5, y: 5, dir: 0, size: 2, sizeShape: 'vertical' };
        assert.ok(isMeleeReachable(unit, target, allUnits, 'melee', map));
    });

    // sizeShape=2x2 (ドラゴン等): 占有は(x,y)+(x+1,y)+(x,y+1)+(x+1,y+1)
    it('melee: size4 2x2 attacker vs size1 は向きに関係なく固定4マス込みで到達可能', () => {
        for (const dir of [0, 1, 2, 3]) {
            const unit = { x: 5, y: 5, dir, size: 4, sizeShape: '2x2' };
            const target = { x: 9, y: 6, size: 1, sizeShape: 'single' };
            assert.ok(isMeleeReachable(unit, target, allUnits, 'melee', map), `dir=${dir}`);
        }
    });

    it('melee: size1 vs size4 2x2 target は向きに関係なく固定4マス込みで到達可能', () => {
        for (const dir of [0, 1, 2, 3]) {
            const unit = { x: 9, y: 6, dir: 0, size: 1, sizeShape: 'single' };
            const target = { x: 5, y: 5, dir, size: 4, sizeShape: '2x2' };
            assert.ok(isMeleeReachable(unit, target, allUnits, 'melee', map), `dir=${dir}`);
        }
    });

    it('melee: 中間グリッドにユニットがいれば遮断', () => {
        const unit = { x: 5, y: 5, dir: 0, size: 1, sizeShape: 'single' };
        const target = { x: 5, y: 3, size: 1, sizeShape: 'single' };
        const blocker = { id: 99, x: 5, y: 4, dead: false };
        assert.ok(!isMeleeReachable(unit, target, [unit, target, blocker], 'melee', map));
    });

    // forward2: 方向変換を含むテスト
    // dir は getFacingAngle 形式: 0=右,1=下,2=左,3=上
    // FACING_TO_ROTATE_PATTERN_DIR: [1, 2, 3, 0]
    it('forward2: dir=3(上)でtargetが2マス上なら到達可能', () => {
        const unit = { x: 5, y: 5, dir: 3, size: 1, sizeShape: 'single' };
        const target = { x: 5, y: 3, size: 1, sizeShape: 'single' };
        assert.ok(isMeleeReachable(unit, target, allUnits, 'forward2', map));
    });

    it('forward2: dir=0(右)でtargetが2マス右なら到達可能', () => {
        const unit = { id: 1, x: 5, y: 5, dir: 0, size: 1, sizeShape: 'single' };
        const target = { id: 2, x: 7, y: 5, size: 1, sizeShape: 'single' };
        const blocker = { id: 99, x: 6, y: 5, dead: false };
        assert.ok(isMeleeReachable(unit, target, [unit, target, blocker], 'forward2', map));
    });

    it('forward2: dir=1(下)でtargetが2マス下なら到達可能', () => {
        const unit = { x: 5, y: 5, dir: 1, size: 1, sizeShape: 'single' };
        const target = { x: 5, y: 7, size: 1, sizeShape: 'single' };
        assert.ok(isMeleeReachable(unit, target, allUnits, 'forward2', map));
    });

    it('forward2: dir=2(左)でtargetが2マス左なら到達可能', () => {
        const unit = { x: 5, y: 5, dir: 2, size: 1, sizeShape: 'single' };
        const target = { x: 3, y: 5, size: 1, sizeShape: 'single' };
        assert.ok(isMeleeReachable(unit, target, allUnits, 'forward2', map));
    });

    it('forward2: dir=0(右)でtargetが2マス上なら到達不可', () => {
        const unit = { x: 5, y: 5, dir: 0, size: 1, sizeShape: 'single' };
        const target = { x: 5, y: 3, size: 1, sizeShape: 'single' };
        assert.ok(!isMeleeReachable(unit, target, allUnits, 'forward2', map));
    });

    // 遠距離rangeTypeは射程内targetでも近接扱い不可
    const rangedCases = [
        ['bowArc', { x: 10, y: 10, dir: 0 }, { x: 10, y: 7 }],
        ['siege', { x: 10, y: 10, dir: 0 }, { x: 10, y: 5 }],
        ['breath', { x: 10, y: 10, dir: 0 }, { x: 10, y: 7 }],
        ['longArc', { x: 10, y: 10, dir: 0 }, { x: 10, y: 6 }],
        ['aoe', { x: 10, y: 10, dir: 0 }, { x: 10, y: 7 }],
        ['heal', { x: 5, y: 5, dir: 0 }, { x: 5, y: 4 }],
    ];

    for (const [rangeType, unit, target] of rangedCases) {
        it(`${rangeType}: 射程内でも近接扱い不可`, () => {
            assert.ok(isInAttackRange(unit, target, rangeType), '射程内であること');
            assert.ok(!isMeleeReachable(unit, target, allUnits, rangeType, map));
        });
    }

    it('unknownType: 常に近接不可', () => {
        const unit = { x: 5, y: 5, dir: 0, sizeShape: 'single' };
        const target = { x: 5, y: 4, sizeShape: 'single' };
        assert.ok(!isMeleeReachable(unit, target, allUnits, 'unknownType', map));
    });
});
