import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

import {
    SPRITE_PATHS,
    UNIT_TYPE_TO_SPRITE,
    SHEET_LAYOUT,
    DIRECTIONS,
    ANIMATIONS,
    WEAPON_HAND_CONFIG,
    getSpriteIndex
} from '../scripts/sprite-config.js';
import { UNIT_TYPES } from '../scripts/constants.js';

// ── SPRITE_PATHS 存在性 ──
describe('SPRITE_PATHS', () => {
    it('DEFAULTが定義されている', () => {
        assert.ok(SPRITE_PATHS.DEFAULT);
    });

    it('参照されるPNGファイルが存在する', () => {
        for (const [key, relPath] of Object.entries(SPRITE_PATHS)) {
            const absPath = path.join(ROOT, relPath);
            assert.ok(fs.existsSync(absPath), `${key}: ${relPath} not found`);
        }
    });
});

// ── UNIT_TYPE_TO_SPRITE カバレッジ ──
describe('UNIT_TYPE_TO_SPRITE カバレッジ', () => {
    it('すべてのUNIT_TYPEにスプライトマッピングがある', () => {
        for (const typeId of Object.keys(UNIT_TYPES)) {
            const spriteKey = UNIT_TYPE_TO_SPRITE[typeId] || 'DEFAULT';
            assert.ok(SPRITE_PATHS[spriteKey],
                `${typeId} maps to '${spriteKey}' but no SPRITE_PATHS entry`);
        }
    });

    it('マッピング先のスプライトキーがSPRITE_PATHSに存在する', () => {
        for (const [typeId, spriteKey] of Object.entries(UNIT_TYPE_TO_SPRITE)) {
            assert.ok(SPRITE_PATHS[spriteKey],
                `${typeId} → ${spriteKey} not in SPRITE_PATHS`);
        }
    });

    it('明示的にDEFAULTフォールバックの兵種を確認', () => {
        const defaultTypes = Object.entries(UNIT_TYPE_TO_SPRITE)
            .filter(([, v]) => v === 'DEFAULT')
            .map(([k]) => k);
        // INFANTRY, SPEAR, GUNNER, CAVALRY がDEFAULTフォールバック
        assert.ok(defaultTypes.length > 0, 'some types should use DEFAULT');
    });
});

// ── SHEET_LAYOUT ──
describe('SHEET_LAYOUT', () => {
    it('cols と rows が正の整数', () => {
        assert.ok(SHEET_LAYOUT.cols > 0);
        assert.ok(SHEET_LAYOUT.rows > 0);
    });

    it('総フレーム数がアニメーションindexの最大値以上', () => {
        const totalFrames = SHEET_LAYOUT.cols * SHEET_LAYOUT.rows;
        let maxIndex = 0;
        for (const anim of Object.values(ANIMATIONS)) {
            for (const idx of anim.indices) {
                if (idx > maxIndex) maxIndex = idx;
            }
        }
        assert.ok(maxIndex < totalFrames,
            `max animation index ${maxIndex} >= total frames ${totalFrames}`);
    });
});

// ── DIRECTIONS ──
describe('DIRECTIONS', () => {
    it('方向0-3が定義されている', () => {
        for (let d = 0; d < 4; d++) {
            assert.ok(DIRECTIONS[d], `dir ${d} missing`);
            assert.ok(typeof DIRECTIONS[d].isBack === 'boolean');
            assert.ok(typeof DIRECTIONS[d].flip === 'boolean');
        }
    });
});

// ── ANIMATIONS ──
describe('ANIMATIONS', () => {
    const requiredAnims = ['idle', 'walk', 'attack', 'damage', 'death'];

    it('必須アニメーションが定義されている', () => {
        for (const name of requiredAnims) {
            assert.ok(ANIMATIONS[name], `Missing animation: ${name}`);
        }
    });

    it('各アニメーションに必須プロパティがある', () => {
        for (const [name, anim] of Object.entries(ANIMATIONS)) {
            assert.ok(Array.isArray(anim.indices), `${name}: indices`);
            assert.ok(anim.indices.length > 0, `${name}: indices empty`);
            assert.ok(typeof anim.speed === 'number', `${name}: speed`);
            assert.ok(typeof anim.loop === 'boolean', `${name}: loop`);
        }
    });
});

// ── KNIGHT パイロット検証 ──
describe('KNIGHT スプライトパイロット', () => {
    it('専用SPRITE_PATHSエントリがある', () => {
        assert.equal(SPRITE_PATHS.KNIGHT, 'sprites/knight/knight.png');
    });

    it('UNIT_TYPE_TO_SPRITEがKNIGHTを指す', () => {
        assert.equal(UNIT_TYPE_TO_SPRITE.KNIGHT, 'KNIGHT');
    });

    it('PNGファイルが存在する', () => {
        const absPath = path.join(ROOT, SPRITE_PATHS.KNIGHT);
        assert.ok(fs.existsSync(absPath), 'sprites/knight/knight.png not found');
    });

    it('WEAPON_HAND_CONFIGにKNIGHTエントリがある', () => {
        assert.ok(WEAPON_HAND_CONFIG.KNIGHT, 'KNIGHT hand config missing');
        assert.ok(WEAPON_HAND_CONFIG.KNIGHT.front);
        assert.ok(WEAPON_HAND_CONFIG.KNIGHT.back);
    });
});

// ── WEAPON_HAND_CONFIG ──
describe('WEAPON_HAND_CONFIG', () => {
    it('DEFAULTハンド設定がある', () => {
        assert.ok(WEAPON_HAND_CONFIG.DEFAULT);
        assert.ok(WEAPON_HAND_CONFIG.DEFAULT.front);
        assert.ok(WEAPON_HAND_CONFIG.DEFAULT.back);
    });

    it('front/backにwindup/strikeがある', () => {
        for (const [key, cfg] of Object.entries(WEAPON_HAND_CONFIG)) {
            for (const side of ['front', 'back']) {
                assert.ok(cfg[side], `${key}.${side} missing`);
                for (const phase of ['windup', 'strike']) {
                    const p = cfg[side][phase];
                    assert.ok(p, `${key}.${side}.${phase} missing`);
                    assert.ok(typeof p.x === 'number', `${key}.${side}.${phase}.x`);
                    assert.ok(typeof p.y === 'number', `${key}.${side}.${phase}.y`);
                    assert.ok(typeof p.angle === 'number', `${key}.${side}.${phase}.angle`);
                }
            }
        }
    });
});

// ── getSpriteIndex ──
describe('getSpriteIndex', () => {
    it('dir=0 (front_right, no offset)', () => {
        const result = getSpriteIndex(0, 5);
        assert.equal(result.index, 5);
        assert.equal(result.flip, false);
    });

    it('dir=2 (back_left, +7 offset)', () => {
        const result = getSpriteIndex(2, 5);
        assert.equal(result.index, 12);
        assert.equal(result.flip, false);
    });

    it('dir=1 (front_right, flipped)', () => {
        const result = getSpriteIndex(1, 5);
        assert.equal(result.index, 5);
        assert.equal(result.flip, true);
    });

    it('dir=3 (back_left, +7, flipped)', () => {
        const result = getSpriteIndex(3, 5);
        assert.equal(result.index, 12);
        assert.equal(result.flip, true);
    });
});
