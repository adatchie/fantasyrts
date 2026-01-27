/**
 * Fantasy RTS - Sprite Generator
 * ユニットスプライトを生成するツール
 *
 * 使用方法:
 *   node scripts/tools/generate_sprites.js
 *
 * 出力:
 *   - scripts/portraits/ ディレクトリ
 *   - sprite_frames/ ディレクトリ
 */

import { UNIT_TYPES } from '../constants.js';

// 陣営色
const COLORS = {
    EAST: '#88AAEE',
    WEST: '#EE4444',
    NEUTRAL: '#888888'
};

// キャンバス設定
const CANVAS_SIZE = 64;
const LAYER_HEIGHT = 32; // 各レイヤー32px

/**
 * Canvas APIを使用したスプライト生成クラス
 */
export class SpriteGenerator {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = CANVAS_SIZE;
        this.canvas.height = CANVAS_SIZE;
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * ユニットスプライトを生成
     * @param {string} unitType - ユニットタイプID
     * @param {string} side - 陣営 ('EAST' or 'WEST')
     * @returns {string} DataURL
     */
    generateSprite(unitType, side) {
        const typeInfo = UNIT_TYPES[unitType];
        if (!typeInfo) {
            console.warn(`Unknown unit type: ${unitType}`);
            return null;
        }

        // クリア
        this.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // 陣営色を決定（重複色の場合はネイティブ色を使用）
        let baseColor = COLORS[side];
        if (side === 'EAST') {
            // 同じ色が使われる場合は白濁させる
            if (unitType === 'ARCHER' || unitType === 'PRIEST') {
                baseColor = '#FFD700'; // 金色
            }
        }

        // レイヤーを構築
        this.buildLayers(typeInfo, baseColor);

        // マーカー（スプライト未実装時）
        this.drawMarker(typeInfo);

        return this.canvas.toDataURL('image/png');
    }

    /**
     * レイヤー構築
     */
    buildLayers(typeInfo, baseColor) {
        const layerTypes = ['body', 'hair', 'helmet', 'cape'];

        layerTypes.forEach(layer => {
            this.drawLayer(typeInfo, layer, baseColor);
        });
    }

    /**
     * 特定レイヤーを描画
     */
    drawLayer(typeInfo, layerType, baseColor) {
        const y = CANVAS_SIZE - LAYER_HEIGHT;

        switch (layerType) {
            case 'hair':
                this.drawHair(typeInfo, y, baseColor);
                break;
            case 'helmet':
                this.drawHelmet(typeInfo, y, baseColor);
                break;
            case 'cape':
                this.drawCape(typeInfo, y, baseColor);
                break;
            case 'body':
            default:
                this.drawBody(typeInfo, y, baseColor);
                break;
        }
    }

    /**
     * 体（鎧）描画
     */
    drawBody(typeInfo, y, baseColor) {
        const ctx = this.ctx;
        const x = 0;
        const w = CANVAS_SIZE;
        const h = LAYER_HEIGHT;

        // 基本体の形
        ctx.fillStyle = this.getBodyColor(typeInfo, baseColor);
        ctx.fillRect(x + 4, y + 2, w - 8, h - 4);

        // 装飾ライン
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);

        // 武器のインジケーター
        this.drawWeaponIndicator(typeInfo, y);
    }

    /**
     * 体の色を決定
     */
    getBodyColor(typeInfo, baseColor) {
        switch (typeInfo.name) {
            case '騎士':
            case '騎兵':
                return '#4a4a4a'; // 重装鎧（暗い）
            case '僧侶':
                return '#e8e8e8'; // 僧衣（白）
            case '魔術師':
                return '#6a0dad'; // ローブ（紫）
            case '砲兵':
                return '#666666'; // 重装備（灰）
            default:
                return baseColor;
        }
    }

    /**
     * 髪描画
     */
    drawHair(typeInfo, y, baseColor) {
        const ctx = this.ctx;

        switch (typeInfo.name) {
            case '魔術師': // 女性長髪
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(4, y - 16, 24, 16); // 左側
                ctx.fillRect(36, y - 16, 24, 16); // 右側
                ctx.fillRect(16, y - 8, 32, 12);  // 中央
                break;

            case '僧侶': // 女性短髪
                ctx.fillStyle = '#D2691E';
                ctx.fillRect(8, y - 8, 24, 8);
                ctx.fillRect(20, y - 8, 8, 8);
                break;

            case '弓兵':
                ctx.fillStyle = '#654321';
                ctx.fillRect(8, y - 12, 48, 12);
                break;

            default: // 一般的な短髪
                ctx.fillStyle = '#654321';
                ctx.fillRect(4, y - 8, 56, 8);
                break;
        }
    }

    /**
     * 兜/帽子描画
     */
    drawHelmet(typeInfo, y, baseColor) {
        const ctx = this.ctx;

        switch (typeInfo.name) {
            case '騎士':
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(4, y - 16, 56, 16); // 兜本体
                ctx.fillStyle = '#2a2a2a';
                ctx.fillRect(20, y - 24, 24, 8); // 王冠
                break;

            case 'ドラゴン':
                ctx.fillStyle = '#2a2a2a';
                ctx.fillRect(4, y - 8, 56, 8);
                break;

            default:
                // 兜なし
                break;
        }
    }

    /**
     * マント描画
     */
    drawCape(typeInfo, y, baseColor) {
        const ctx = this.ctx;

        if (typeInfo.name === '竜騎兵') {
            ctx.fillStyle = baseColor;
            ctx.fillRect(4, y, 56, 12); // マント
            // 翼のインジケーター
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(12, y + 6);
            ctx.lineTo(4, y + 12);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(60, y);
            ctx.lineTo(48, y + 6);
            ctx.lineTo(56, y + 12);
            ctx.closePath();
            ctx.fill();
        }
    }

    /**
     * 武器インジケーター描画
     */
    drawWeaponIndicator(typeInfo, y) {
        const ctx = this.ctx;
        const x = CANVAS_SIZE - 20;

        switch (typeInfo.name) {
            case '槍兵':
            case '騎兵':
                ctx.fillStyle = '#C0C0C0';
                ctx.beginPath();
                ctx.moveTo(x, y + 4);
                ctx.lineTo(x + 12, y + 32);
                ctx.lineTo(x + 8, y + 32);
                ctx.lineTo(x + 4, y + 4);
                ctx.closePath();
                ctx.fill();
                break;

            case '銃士':
                ctx.fillStyle = '#2F4F4F';
                ctx.fillRect(x, y + 16, 16, 16); // 銃身
                ctx.fillStyle = '#000';
                ctx.fillRect(x + 12, y + 8, 8, 8); // 砲口
                break;

            case '魔術師':
                ctx.fillStyle = '#6a0dad';
                ctx.fillRect(x, y + 8, 8, 24); // 魔導書
                ctx.fillStyle = '#fff';
                ctx.font = '10px Arial';
                ctx.fillText('M', x + 2, y + 24);
                break;

            case '僧侶':
                ctx.fillStyle = '#90EE90';
                ctx.beginPath();
                ctx.arc(x + 8, y + 16, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = '8px Arial';
                ctx.fillText('✚', x + 4, y + 20);
                break;

            case '砲兵':
                ctx.fillStyle = '#333';
                ctx.fillRect(x, y + 12, 16, 20); // 砲
                ctx.fillStyle = '#000';
                ctx.fillRect(x + 14, y + 4, 4, 4); // 爆発穴
                break;

            default: // 歩兵、弓兵、ドラゴン、竜騎兵
                // 剣
                ctx.fillStyle = '#C0C0C0';
                ctx.fillRect(x, y + 8, 6, 20); // 剣身
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(x - 4, y + 4, 14, 6); // 剣柄
                break;
        }
    }

    /**
     * マーカー描画（スプライト未実装時）
     */
    drawMarker(typeInfo) {
        const ctx = this.ctx;
        const size = 24;
        const x = (CANVAS_SIZE - size) / 2;
        const y = (CANVAS_SIZE - size) / 2;

        ctx.font = `${size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(typeInfo.marker, CANVAS_SIZE / 2, CANVAS_SIZE / 2);
    }
}

/**
 * スプライトフレームアニメーション生成
 */
export class SpriteFrameGenerator {
    constructor() {
        this.frames = [];
        this.canvases = [];
    }

    /**
     * 移動アニメーションフレームを生成
     */
    generateMoveFrames() {
        this.frames = [];
        for (let i = 0; i < 4; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = CANVAS_SIZE;
            canvas.height = CANVAS_SIZE;
            const ctx = canvas.getContext('2d');
            const scaleY = 0.95 + (i / 4) * 0.1;
            ctx.translate(0, CANVAS_SIZE / 2);
            ctx.scale(1, scaleY);
            ctx.translate(0, -CANVAS_SIZE / 2);
            this.canvases.push(canvas);
        }
        return this.canvases;
    }

    /**
     * 攻撃アニメーションフレームを生成
     */
    generateAttackFrames() {
        this.frames = [];
        for (let i = 0; i < 3; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = CANVAS_SIZE;
            canvas.height = CANVAS_SIZE;
            const ctx = canvas.getContext('2d');
            const scaleX = 1.0 + (i / 3) * 0.2;
            ctx.translate(CANVAS_SIZE / 2, 0);
            ctx.scale(scaleX, 1);
            ctx.translate(-CANVAS_SIZE / 2, 0);
            this.canvases.push(canvas);
        }
        return this.canvases;
    }

    /**
     * ダメージアニメーションフレームを生成
     */
    generateDamageFrames() {
        this.frames = [];
        for (let i = 0; i < 5; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = CANVAS_SIZE;
            canvas.height = CANVAS_SIZE;
            const ctx = canvas.getContext('2d');
            const offsetX = -2 + (i % 2) * 4;
            ctx.translate(offsetX, 0);
            this.canvases.push(canvas);
        }
        return this.canvases;
    }

    /**
     * 待機アニメーションフレームを生成
     */
    generateIdleFrames() {
        this.frames = [];
        for (let i = 0; i < 3; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = CANVAS_SIZE;
            canvas.height = CANVAS_SIZE;
            const ctx = canvas.getContext('2d');
            const scaleY = 1.0 + Math.sin(i * Math.PI / 2) * 0.02;
            ctx.translate(0, CANVAS_SIZE / 2);
            ctx.scale(1, scaleY);
            ctx.translate(0, -CANVAS_SIZE / 2);
            this.canvases.push(canvas);
        }
        return this.canvases;
    }
}

/**
 * メイン関数
 */
async function main() {
    console.log('=== Fantasy RTS Sprite Generator ===');
    console.log(`Canvas Size: ${CANVAS_SIZE}x${CANVAS_SIZE}`);
    console.log('');

    const generator = new SpriteGenerator();
    const frameGenerator = new SpriteFrameGenerator();

    // ユニットタイプ別スプライト生成
    const unitTypes = Object.keys(UNIT_TYPES).filter(t => t !== 'HEADQUARTERS' && t !== 'NORMAL');

    console.log('Generating sprites for:');
    unitTypes.forEach(type => {
        console.log(`  - ${UNIT_TYPES[type].name} (${type})`);
    });
    console.log('');

    const outputDir = 'scripts/portraits';
    const sprites = {};

    for (const type of unitTypes) {
        const info = UNIT_TYPES[type];

        // 東軍
        const eastSprite = generator.generateSprite(type, 'EAST');
        if (eastSprite) {
            sprites[`${type}_EAST`] = eastSprite;
            console.log(`  ✓ ${info.name} (EAST)`);
        }

        // 西軍
        const westSprite = generator.generateSprite(type, 'WEST');
        if (westSprite) {
            sprites[`${type}_WEST`] = westSprite;
            console.log(`  ✓ ${info.name} (WEST)`);
        }
    }

    console.log('');
    console.log('=== Sprite Frames ===');

    // アニメーションフレーム生成
    const moveFrames = frameGenerator.generateMoveFrames();
    console.log(`  ✓ Move frames: ${moveFrames.length}`);

    const attackFrames = frameGenerator.generateAttackFrames();
    console.log(`  ✓ Attack frames: ${attackFrames.length}`);

    const damageFrames = frameGenerator.generateDamageFrames();
    console.log(`  ✓ Damage frames: ${damageFrames.length}`);

    const idleFrames = frameGenerator.generateIdleFrames();
    console.log(`  ✓ Idle frames: ${idleFrames.length}`);

    console.log('');
    console.log('=== Summary ===');
    console.log(`Total sprites generated: ${Object.keys(sprites).length}`);
    console.log(`Total frames generated: ${moveFrames.length + attackFrames.length + damageFrames.length + idleFrames.length}`);
    console.log('');
    console.log('Sprites stored in sprites object. Use as DataURL or save to file.');
}

// ブラウザ環境で実行
if (typeof window !== 'undefined' && window.onload) {
    window.onload = main;
}

// Node.js環境で実行
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpriteGenerator, SpriteFrameGenerator };
}

// ターミナルで実行
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('generate_sprites.js')) {
    main().catch(console.error);
}
