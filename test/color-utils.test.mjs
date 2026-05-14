import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { rgbToHsl, hslToRgb } from '../scripts/rendering/color-utils.js';

describe('rgbToHsl', () => {
    it('黒は (0,0,0)', () => {
        const [h, s, l] = rgbToHsl(0, 0, 0);
        assert.equal(l, 0);
    });

    it('白は (0,0,1)', () => {
        const [h, s, l] = rgbToHsl(255, 255, 255);
        assert.equal(l, 1);
    });

    it('赤は h=0, s=1, l=0.5', () => {
        const [h, s, l] = rgbToHsl(255, 0, 0);
        assert.equal(h, 0);
        assert.equal(s, 1);
        assert.equal(l, 0.5);
    });

    it('緑は h=1/3付近', () => {
        const [h, s, l] = rgbToHsl(0, 255, 0);
        assert.ok(Math.abs(h - 1/3) < 0.01);
    });

    it('青は h=2/3付近', () => {
        const [h, s, l] = rgbToHsl(0, 0, 255);
        assert.ok(Math.abs(h - 2/3) < 0.01);
    });

    it('グレーは s=0', () => {
        const [h, s, l] = rgbToHsl(128, 128, 128);
        assert.equal(s, 0);
    });
});

describe('hslToRgb', () => {
    it('黒は (0,0,0)', () => {
        const [r, g, b] = hslToRgb(0, 0, 0);
        assert.equal(r, 0);
        assert.equal(g, 0);
        assert.equal(b, 0);
    });

    it('白は (255,255,255)', () => {
        const [r, g, b] = hslToRgb(0, 0, 1);
        assert.equal(r, 255);
        assert.equal(g, 255);
        assert.equal(b, 255);
    });

    it('赤は (255,0,0)', () => {
        const [r, g, b] = hslToRgb(0, 1, 0.5);
        assert.equal(r, 255);
        assert.equal(g, 0);
        assert.equal(b, 0);
    });

    it('rgbToHsl → hslToRgb 往復', () => {
        const testCases = [
            [255, 0, 0],
            [0, 255, 0],
            [0, 0, 255],
            [128, 64, 200],
            [200, 200, 50],
            [10, 10, 10],
        ];
        for (const [r, g, b] of testCases) {
            const [h, s, l] = rgbToHsl(r, g, b);
            const [r2, g2, b2] = hslToRgb(h, s, l);
            assert.ok(Math.abs(r2 - r) <= 1, `R roundtrip: ${r} → ${r2}`);
            assert.ok(Math.abs(g2 - g) <= 1, `G roundtrip: ${g} → ${g2}`);
            assert.ok(Math.abs(b2 - b) <= 1, `B roundtrip: ${b} → ${b2}`);
        }
    });
});
