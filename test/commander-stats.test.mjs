import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    WARLORDS,
    COMMANDER_CLASS_BASE,
    COMMANDER_GROWTH_RATES,
    UNIT_TYPES,
    expToNextLevel,
    DIALOGUE,
    P_BRAVE, P_LOYAL, P_COWARD, P_CALM
} from '../scripts/constants.js';

// ── WARLORDS スキーマ検証 ──
describe('WARLORDS 新スキーマ', () => {
    const REQUIRED = ['name', 'side', 'class', 'soldiers', 'ATK', 'DEF', 'AGI', 'VIT', 'INT', 'MND', 'LUK', 'loyalty', 'x', 'y', 'size', 'p', 'kamon', 'bg', 'face', 'level', 'exp'];

    it('35人の部隊長が定義されている', () => {
        assert.ok(WARLORDS.length >= 30, `Expected 30+ warlords, got ${WARLORDS.length}`);
    });

    it('全員に必須プロパティがある', () => {
        for (const w of WARLORDS) {
            for (const key of REQUIRED) {
                assert.ok(w[key] !== undefined, `${w.name} missing: ${key}`);
            }
        }
    });

    it('全員の名前がカタカナで表記されている', () => {
        const katakanaPattern = /^[゠-ヿ]+$/;
        for (const w of WARLORDS) {
            assert.ok(katakanaPattern.test(w.name), `${w.name} is not Katakana-only`);
        }
    });

    it('classが有効なUNIT_TYPESキー', () => {
        for (const w of WARLORDS) {
            assert.ok(UNIT_TYPES[w.class], `${w.name}: invalid class '${w.class}'`);
        }
    });

    it('パラメータが0-99の範囲', () => {
        const stats = ['ATK', 'DEF', 'AGI', 'VIT', 'INT', 'MND', 'LUK'];
        for (const w of WARLORDS) {
            for (const s of stats) {
                assert.ok(typeof w[s] === 'number', `${w.name}.${s} not a number`);
                assert.ok(w[s] >= 0 && w[s] <= 99, `${w.name}.${s}=${w[s]} out of range`);
            }
        }
    });

    it('loyaltyが0-100の範囲', () => {
        for (const w of WARLORDS) {
            assert.ok(w.loyalty >= 0 && w.loyalty <= 100, `${w.name}: loyalty=${w.loyalty}`);
        }
    });

    it('level/expが初期化されている', () => {
        for (const w of WARLORDS) {
            assert.equal(w.level, 1, `${w.name}: level should start at 1`);
            assert.equal(w.exp, 0, `${w.name}: exp should start at 0`);
        }
    });

    it('EAST/WESTの両陣営が存在する', () => {
        const east = WARLORDS.filter(w => w.side === 'EAST');
        const west = WARLORDS.filter(w => w.side === 'WEST');
        assert.ok(east.length >= 10, `EAST should have 10+, got ${east.length}`);
        assert.ok(west.length >= 10, `WEST should have 10+, got ${west.length}`);
    });
});

// ── COMMANDER_CLASS_BASE ──
describe('COMMANDER_CLASS_BASE', () => {
    it('11職業すべて定義されている', () => {
        for (const typeId of Object.keys(UNIT_TYPES)) {
            assert.ok(COMMANDER_CLASS_BASE[typeId], `Missing base for: ${typeId}`);
        }
    });

    it('各職業に7パラメータがある', () => {
        const params = ['ATK', 'DEF', 'AGI', 'VIT', 'INT', 'MND', 'LUK'];
        for (const [cls, base] of Object.entries(COMMANDER_CLASS_BASE)) {
            for (const p of params) {
                assert.ok(typeof base[p] === 'number', `${cls} missing: ${p}`);
                assert.ok(base[p] >= 0 && base[p] <= 100, `${cls}.${p}=${base[p]} out of range`);
            }
        }
    });
});

// ── COMMANDER_GROWTH_RATES ──
describe('COMMANDER_GROWTH_RATES', () => {
    it('11職業すべて定義されている', () => {
        for (const typeId of Object.keys(UNIT_TYPES)) {
            assert.ok(COMMANDER_GROWTH_RATES[typeId], `Missing growth for: ${typeId}`);
        }
    });

    it('成長率が0以上', () => {
        for (const [cls, rates] of Object.entries(COMMANDER_GROWTH_RATES)) {
            for (const [stat, rate] of Object.entries(rates)) {
                assert.ok(rate >= 0, `${cls}.${stat} growth=${rate} should be >= 0`);
            }
        }
    });
});

// ── expToNextLevel ──
describe('expToNextLevel', () => {
    it('Lv1→2は100EXP', () => {
        assert.equal(expToNextLevel(1), 100);
    });

    it('レベルが上がるほど必要EXPが増加', () => {
        let prev = 0;
        for (let lv = 1; lv <= 10; lv++) {
            const needed = expToNextLevel(lv);
            assert.ok(needed > prev, `Lv${lv}: ${needed} should be > ${prev}`);
            prev = needed;
        }
    });

    it('正の整数を返す', () => {
        for (let lv = 1; lv <= 20; lv++) {
            const exp = expToNextLevel(lv);
            assert.ok(exp > 0, `Lv${lv}: exp=${exp}`);
            assert.equal(exp, Math.floor(exp), `Lv${lv}: should be integer`);
        }
    });
});

// ── DIALOGUE ──
describe('DIALOGUE', () => {
    it('4性格タイプのセリフが定義されている', () => {
        assert.ok(DIALOGUE[P_BRAVE]);
        assert.ok(DIALOGUE[P_LOYAL]);
        assert.ok(DIALOGUE[P_COWARD]);
        assert.ok(DIALOGUE[P_CALM]);
    });

    it('セリフが文字列配列で空ではない', () => {
        for (const [, lines] of Object.entries(DIALOGUE)) {
            for (const [, phrases] of Object.entries(lines)) {
                assert.ok(Array.isArray(phrases), 'phrases should be array');
                assert.ok(phrases.length > 0, 'phrases should not be empty');
                for (const phrase of phrases) {
                    assert.ok(typeof phrase === 'string' && phrase.length > 0, 'phrase should be non-empty string');
                }
            }
        }
    });
});
