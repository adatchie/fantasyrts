/**
 * WEAPON CALIBRATOR
 * 武器アタッチメントの手座標・角度をブラウザ上で視覚的に調整するツール。
 *
 * 使い方:
 *   K キー でパネルを開閉
 *   スプライトフレームをクリック → 手の位置を更新
 *   ← / → キー → 武器角度を 1° ずつ調整
 *   「JSONをコピー」→ sprite-config.js の WEAPON_HAND_CONFIG にペースト
 *
 * 仕組み:
 *   window._weaponHandConfig を書き換えると rendering3d.js がそれを優先参照するため
 *   3D シーン上でリアルタイムに反映される。
 */

import {
    WEAPON_HAND_CONFIG,
    SPRITE_PATHS,
    UNIT_TYPE_TO_SPRITE,
    SHEET_LAYOUT,
    ANIMATIONS,
    DIRECTIONS,
} from './sprite-config.js?v=125';
import { UNIT_TYPES, WEAPON_TYPES } from './constants.js?v=125';

// ---- フェーズとフレームの対応 ----
const PHASE_FRAMES = {
    windup: ANIMATIONS.attack1?.indices[0] ?? 17,
    strike: (ANIMATIONS.attack2?.indices ?? [17, 19]).at(-1) ?? 19,
};

class WeaponCalibrator {
    constructor() {
        this.visible = false;
        this.spriteKey = 'DEFAULT';
        this.phase = 'windup';    // 'windup' | 'strike'
        this.view = 'front';      // 'front' | 'back'
        this.displayScale = 3;    // キャンバス拡大倍率

        // 作業中コンフィグ（WEAPON_HAND_CONFIG のディープコピー）
        this._config = JSON.parse(JSON.stringify(WEAPON_HAND_CONFIG));
        // グローバルに公開して rendering3d.js から参照させる
        window._weaponHandConfig = this._config;

        this._spriteImg = null;
        this._weaponImg = null;
        this._panel = null;
        this._canvas = null;
        this._ctx = null;

        this._buildPanel();
        this._bindKeys();
    }

    // -----------------------------------------------
    // パネル構築
    // -----------------------------------------------
    _buildPanel() {
        this._panel = document.createElement('div');
        this._panel.id = 'wc-panel';
        this._panel.style.cssText = [
            'position:fixed', 'top:16px', 'right:16px', 'width:360px',
            'background:rgba(10,10,20,0.95)', 'color:#ddd',
            'border:1px solid #444', 'border-radius:8px',
            'padding:12px', 'font:12px/1.6 monospace',
            'z-index:99999', 'display:none', 'user-select:none',
        ].join(';');

        this._panel.innerHTML = `
<div style="font-size:13px;font-weight:bold;margin-bottom:8px">
  ⚔ WEAPON CALIBRATOR &nbsp;<span style="font-size:10px;color:#888">[K で開閉]</span>
</div>

<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
  <label>Sprite</label>
  <select id="wc-sprite" style="background:#222;color:#ddd;border:1px solid #555;padding:2px 4px">
    <option value="DEFAULT">DEFAULT</option>
    <option value="ARCHER">ARCHER</option>
    <option value="MAGE">MAGE</option>
    <option value="PRIEST">PRIEST</option>
  </select>
  <label>View</label>
  <button id="wc-view-front" style="background:#334;color:#fff;border:1px solid #668;border-radius:4px;padding:2px 10px;cursor:pointer;font:11px monospace">front</button>
  <button id="wc-view-back"  style="background:#222;color:#aaa;border:1px solid #444;border-radius:4px;padding:2px 10px;cursor:pointer;font:11px monospace">back</button>
</div>

<div style="display:flex;gap:6px;margin-bottom:8px">
  <button id="wc-phase-windup" style="background:#334;color:#fff;border:1px solid #668;border-radius:4px;padding:2px 10px;cursor:pointer;font:11px monospace">windup</button>
  <button id="wc-phase-strike" style="background:#222;color:#aaa;border:1px solid #444;border-radius:4px;padding:2px 10px;cursor:pointer;font:11px monospace">strike</button>
</div>

<canvas id="wc-canvas"
  style="border:1px solid #555;cursor:crosshair;display:block;
         image-rendering:pixelated;margin-bottom:8px;max-width:100%">
</canvas>

<div style="margin-bottom:4px;color:#aaa;font-size:11px">
  クリック: 手の位置を設定 &nbsp; ←/→: 角度調整
</div>

<div id="wc-values"
  style="background:#111;border:1px solid #333;border-radius:4px;
         padding:5px 8px;margin-bottom:8px;line-height:2">
  x: — &nbsp; y: — &nbsp; angle: —°
</div>

<button id="wc-copy"
  style="background:#163;color:#cfc;border:1px solid #374;
         border-radius:4px;padding:5px 14px;cursor:pointer;font:12px monospace;width:100%">
  JSON をコピー（コンソール出力）
</button>

`;

        document.body.appendChild(this._panel);

        this._canvas = this._panel.querySelector('#wc-canvas');
        this._ctx = this._canvas.getContext('2d');

        // イベント
        this._panel.querySelector('#wc-sprite').addEventListener('change', e => {
            this.spriteKey = e.target.value;
            this._ensureConfig();
            this._loadSprite();
        });

        [
            ['#wc-view-front', () => this._setView('front')],
            ['#wc-view-back',  () => this._setView('back')],
            ['#wc-phase-windup', () => this._setPhase('windup')],
            ['#wc-phase-strike', () => this._setPhase('strike')],
        ].forEach(([sel, fn]) => this._panel.querySelector(sel).addEventListener('click', fn));

        this._canvas.addEventListener('click', e => this._onCanvasClick(e));
        this._panel.querySelector('#wc-copy').addEventListener('click', () => this._copyJSON());
    }

    // -----------------------------------------------
    // キーバインド
    // -----------------------------------------------
    _bindKeys() {
        window.addEventListener('keydown', e => {
            // Kキー: トグル（コンソールからは window.toggleCalibrator() でも可）
            if (e.key === 'k' || e.key === 'K') {
                this.toggle();
                return;
            }
            if (!this.visible) return;
            if (e.key === 'ArrowLeft')  { this._adjustAngle(-1); e.preventDefault(); }
            if (e.key === 'ArrowRight') { this._adjustAngle( 1); e.preventDefault(); }
        });
    }

    // -----------------------------------------------
    // 状態変更
    // -----------------------------------------------
    _setView(view) {
        this.view = view;
        this._refreshTabButtons('wc-view-front', 'wc-view-back', view === 'front');
        this._render();
    }

    _setPhase(phase) {
        this.phase = phase;
        this._refreshTabButtons('wc-phase-windup', 'wc-phase-strike', phase === 'windup');
        this._render();
    }

    _refreshTabButtons(idA, idB, aIsActive) {
        const btnA = this._panel.querySelector(`#${idA}`);
        const btnB = this._panel.querySelector(`#${idB}`);
        const applyStyle = (btn, active) => {
            btn.style.background   = active ? '#334' : '#222';
            btn.style.color        = active ? '#fff' : '#aaa';
            btn.style.borderColor  = active ? '#668' : '#444';
        };
        applyStyle(btnA,  aIsActive);
        applyStyle(btnB, !aIsActive);
    }

    // -----------------------------------------------
    // スプライト読み込み
    // -----------------------------------------------
    _loadSprite() {
        const path = SPRITE_PATHS[this.spriteKey] ?? SPRITE_PATHS['DEFAULT'];
        if (!path) return;
        const img = new Image();
        img.onload = () => { this._spriteImg = img; this._render(); };
        img.src = path;

        // 武器スプライト読み込み
        const unitType = Object.entries(UNIT_TYPE_TO_SPRITE).find(([, v]) => v === this.spriteKey)?.[0]
                      ?? 'INFANTRY';
        const weaponKey = UNIT_TYPES[unitType]?.weapon;
        const weaponDef = weaponKey ? WEAPON_TYPES[weaponKey] : null;
        if (weaponDef?.sprite) {
            const wImg = new Image();
            wImg.onload = () => { this._weaponImg = wImg; this._render(); };
            wImg.src = `assets/sprites/${weaponDef.sprite}`;
        } else {
            this._weaponImg = null;
        }
    }

    // -----------------------------------------------
    // 現在の設定取得・保証
    // -----------------------------------------------
    _ensureConfig() {
        if (!this._config[this.spriteKey]) {
            this._config[this.spriteKey] = {
                front: {
                    windup: { x: 0.60, y: 0.42, angle: -130 },
                    strike: { x: 0.68, y: 0.60, angle:   30 },
                },
                back: {
                    windup: { x: 0.40, y: 0.42, angle: 130 },
                    strike: { x: 0.32, y: 0.60, angle: -30 },
                },
            };
        }
    }

    _getCurrent() {
        this._ensureConfig();
        return this._config[this.spriteKey][this.view][this.phase];
    }

    // -----------------------------------------------
    // 描画
    // -----------------------------------------------
    _render() {
        if (!this._spriteImg) return;

        const { cols, rows } = SHEET_LAYOUT;
        const fw = this._spriteImg.width  / cols;
        const fh = this._spriteImg.height / rows;
        const sc = this.displayScale;

        this._canvas.width  = fw * sc;
        this._canvas.height = fh * sc;

        // フレームインデックス（front/back × windup/strike）
        const baseFrame = PHASE_FRAMES[this.phase] ?? 17;
        // back_left は +7 オフセット
        const frameIdx = this.view === 'back' ? baseFrame + 7 : baseFrame;
        const fcol = frameIdx % cols;
        const frow = Math.floor(frameIdx / cols);

        // スプライトフレームを描画
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        this._ctx.imageSmoothingEnabled = false;
        this._ctx.drawImage(
            this._spriteImg,
            fcol * fw, frow * fh, fw, fh,
            0, 0, fw * sc, fh * sc,
        );

        // 暗めのグリッドオーバーレイ（座標の目安）
        this._ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        this._ctx.lineWidth = 0.5;
        for (let gx = 0; gx <= fw * sc; gx += fw * sc / 4) {
            this._ctx.beginPath(); this._ctx.moveTo(gx, 0); this._ctx.lineTo(gx, fh * sc); this._ctx.stroke();
        }
        for (let gy = 0; gy <= fh * sc; gy += fh * sc / 4) {
            this._ctx.beginPath(); this._ctx.moveTo(0, gy); this._ctx.lineTo(fw * sc, gy); this._ctx.stroke();
        }

        const cfg = this._getCurrent();
        const hpx = cfg.x * fw * sc;
        const hpy = cfg.y * fh * sc;
        const angleRad = cfg.angle * Math.PI / 180;

        // 武器スプライト or 代替ライン
        if (this._weaponImg) {
            // 武器の高さ = フレーム高さの 55%
            const wH = fh * sc * 0.55;
            const wW = wH * (this._weaponImg.width / this._weaponImg.height);
            const unitType = Object.entries(UNIT_TYPE_TO_SPRITE).find(([, v]) => v === this.spriteKey)?.[0] ?? 'INFANTRY';
            const weaponKey = UNIT_TYPES[unitType]?.weapon;
            const weaponDef = weaponKey ? WEAPON_TYPES[weaponKey] : null;
            const pivotFx = weaponDef?.pivot?.x ?? 0.5;
            const pivotFy = weaponDef?.pivot?.y ?? 1.0;

            this._ctx.save();
            this._ctx.translate(hpx, hpy);
            this._ctx.rotate(angleRad);
            this._ctx.imageSmoothingEnabled = false;
            this._ctx.drawImage(this._weaponImg,
                -pivotFx * wW,
                -pivotFy * wH,
                wW, wH);
            this._ctx.restore();
        } else {
            // プレースホルダー：オレンジの線
            this._ctx.save();
            this._ctx.translate(hpx, hpy);
            this._ctx.rotate(angleRad);
            this._ctx.strokeStyle = '#f80';
            this._ctx.lineWidth = 3;
            this._ctx.beginPath();
            this._ctx.moveTo(0, 0);
            this._ctx.lineTo(0, -fh * sc * 0.45);
            this._ctx.stroke();
            // 先端の印
            this._ctx.beginPath();
            this._ctx.moveTo(-5, -fh * sc * 0.45);
            this._ctx.lineTo(0,  -fh * sc * 0.50);
            this._ctx.lineTo(5,  -fh * sc * 0.45);
            this._ctx.stroke();
            this._ctx.restore();
        }

        // 手の位置マーカー（黄色の十字 + 円）
        this._ctx.save();
        this._ctx.strokeStyle = '#ff0';
        this._ctx.fillStyle   = 'rgba(255,220,0,0.85)';
        this._ctx.lineWidth = 1.5;
        this._ctx.beginPath();
        this._ctx.arc(hpx, hpy, 5, 0, Math.PI * 2);
        this._ctx.fill();
        this._ctx.stroke();
        // 十字線
        this._ctx.beginPath();
        this._ctx.moveTo(hpx - 9, hpy); this._ctx.lineTo(hpx + 9, hpy);
        this._ctx.moveTo(hpx, hpy - 9); this._ctx.lineTo(hpx, hpy + 9);
        this._ctx.stroke();
        this._ctx.restore();

        // 数値表示
        this._panel.querySelector('#wc-values').innerHTML =
            `x: <b>${cfg.x.toFixed(4)}</b> &nbsp; ` +
            `y: <b>${cfg.y.toFixed(4)}</b> &nbsp; ` +
            `angle: <b>${cfg.angle}°</b>`;
    }

    // -----------------------------------------------
    // インタラクション
    // -----------------------------------------------
    _onCanvasClick(e) {
        const rect = this._canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        // getBoundingClientRect は CSS スケールを反映しているので
        // canvas の実ピクセルとの比率で正規化
        const cfg = this._getCurrent();
        cfg.x = parseFloat((px / rect.width).toFixed(4));
        cfg.y = parseFloat((py / rect.height).toFixed(4));

        this._render();
    }

    _adjustAngle(delta) {
        const cfg = this._getCurrent();
        cfg.angle = cfg.angle + delta;
        this._render();
    }

    // -----------------------------------------------
    // JSON 出力
    // -----------------------------------------------
    _copyJSON() {
        const json = JSON.stringify(this._config, null, 4);
        const output = `export const WEAPON_HAND_CONFIG = ${json};`;
        console.log('=== WEAPON_HAND_CONFIG (sprite-config.js にコピペ) ===');
        console.log(output);
        console.log('=== END ===');

        navigator.clipboard?.writeText(output).then(() => {
            const btn = this._panel.querySelector('#wc-copy');
            const orig = btn.textContent;
            btn.textContent = '✓ クリップボードにコピーしました';
            btn.style.background = '#264';
            setTimeout(() => {
                btn.textContent = orig;
            }, 2000);
        }).catch(() => {
            console.warn('[Calibrator] クリップボードアクセス不可。コンソールを参照してください。');
        });
    }

    // -----------------------------------------------
    // 開閉
    // -----------------------------------------------
    toggle() {
        this.visible = !this.visible;
        this._panel.style.display = this.visible ? 'block' : 'none';
        if (this.visible && !this._spriteImg) {
            this._loadSprite();
        }
    }
}

// -----------------------------------------------
// エントリポイント
// -----------------------------------------------
export function initWeaponCalibrator() {
    const create = () => {
        window._wc = new WeaponCalibrator();
        // コンソールから直接呼べるグローバル関数
        window.toggleCalibrator = () => window._wc.toggle();
        console.log('[WeaponCalibrator] 初期化完了 — Kキー or toggleCalibrator() で開閉');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', create);
    } else {
        create();
    }
}
