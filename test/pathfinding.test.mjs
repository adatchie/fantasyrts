import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    gridToPixel,
    pixelToGrid,
    isValidCoord,
    getDistRaw,
    getDist,
    getDistChebyshev,
    getFacingAngle
} from '../scripts/pathfinding.js';

// ── gridToPixel / pixelToGrid 往復テスト ──
describe('座標変換', () => {
    it('gridToPixel: (0,0) → (0, 0)', () => {
        const p = gridToPixel(0, 0);
        assert.equal(p.x, 0);
        assert.equal(p.z, 0);
    });

    it('gridToPixel: (1,0) → 正のx方向', () => {
        const p = gridToPixel(1, 0);
        assert.ok(p.x > 0);
    });

    it('gridToPixel: (0,1) → 負のx方向', () => {
        const p = gridToPixel(0, 1);
        assert.ok(p.x < 0);
    });

    it('gridToPixel → pixelToGrid 往復: 整数座標', () => {
        const testCases = [
            [0, 0], [5, 5], [10, 3], [0, 15], [20, 0], [35, 35]
        ];
        for (const [gx, gy] of testCases) {
            const px = gridToPixel(gx, gy);
            const grid = pixelToGrid(px.x, px.z);
            assert.equal(grid.x, gx, `roundtrip x: (${gx},${gy})`);
            assert.equal(grid.y, gy, `roundtrip y: (${gx},${gy})`);
        }
    });
});

// ── isValidCoord ──
describe('isValidCoord', () => {
    it('原点は有効', () => {
        assert.ok(isValidCoord({ x: 0, y: 0 }));
    });

    it('マップ内は有効', () => {
        assert.ok(isValidCoord({ x: 35, y: 35 }));
    });

    it('負の座標は無効', () => {
        assert.ok(!isValidCoord({ x: -1, y: 0 }));
        assert.ok(!isValidCoord({ x: 0, y: -1 }));
    });

    it('マップ外は無効', () => {
        assert.ok(!isValidCoord({ x: 70, y: 0 }));
        assert.ok(!isValidCoord({ x: 0, y: 70 }));
    });
});

// ── getDistRaw / getDist ──
describe('距離計算', () => {
    it('getDistRaw: 同一位置は0', () => {
        assert.equal(getDistRaw(5, 5, 5, 5), 0);
    });

    it('getDistRaw: マンハッタン距離', () => {
        assert.equal(getDistRaw(0, 0, 3, 4), 7);
        assert.equal(getDistRaw(2, 3, 5, 1), 5);
    });

    it('getDist: ユニットオブジェクト間', () => {
        const u1 = { x: 0, y: 0 };
        const u2 = { x: 3, y: 4 };
        assert.equal(getDist(u1, u2), 7);
    });

    it('getDistChebyshev: 斜めも距離1', () => {
        const u1 = { x: 0, y: 0 };
        const u2 = { x: 1, y: 1 };
        assert.equal(getDistChebyshev(u1, u2), 1);
    });

    it('getDistChebyshev: 最大座標差', () => {
        const u1 = { x: 0, y: 0 };
        const u2 = { x: 3, y: 1 };
        assert.equal(getDistChebyshev(u1, u2), 3);
    });
});

// ── getFacingAngle ──
describe('getFacingAngle', () => {
    it('右方向は0', () => {
        assert.equal(getFacingAngle(0, 0, 1, 0), 0);
    });

    it('下方向は1', () => {
        assert.equal(getFacingAngle(0, 0, 0, 1), 1);
    });

    it('左方向は2', () => {
        assert.equal(getFacingAngle(0, 0, -1, 0), 2);
    });

    it('上方向は3', () => {
        assert.equal(getFacingAngle(0, 0, 0, -1), 3);
    });
});
