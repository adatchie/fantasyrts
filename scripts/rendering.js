/**
 * SEKIGAHARA RTS - Rendering Engine (Enhanced)
 * 高精細化されたマップとユニットの描画
 */

import { HEX_SIZE, C_EAST, C_WEST } from './constants.js';
import { hexToPixel } from './pathfinding.js';
import { KamonDrawer } from './kamon.js';

export class RenderingEngine {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
    }

    /**
     * ヘックスタイルを描画（高精細化版）
     */
    drawHex(x, y, tile, camera) {
        const ctx = this.ctx;
        const size = HEX_SIZE * camera.zoom;

        // ヘックス形状を描画
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const rad = (60 * i - 30) * Math.PI / 180;
            ctx.lineTo(x + size * Math.cos(rad), y + size * Math.sin(rad));
        }
        ctx.closePath();

        // 塗りつぶし（地形タイプに応じて）
        if (tile.type === 'RIVER') {
            // 川: 放射状グラデーション
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
            gradient.addColorStop(0, '#4477aa');
            gradient.addColorStop(1, '#223355');
            ctx.fillStyle = gradient;
        } else {
            // 平地・山岳: 高さに応じた色彩
            let baseR = 35 + tile.h * 8;
            let baseG = 95 - tile.h * 6;
            let baseB = 35 + tile.h * 3;

            if (tile.type === 'MTN') {
                baseR = 80 + tile.h * 4;
                baseG = 70 + tile.h * 3;
                baseB = 60 + tile.h * 3;
            }

            // 立体感を出すグラデーション
            const gradient = ctx.createLinearGradient(
                x - size, y - size,
                x + size, y + size
            );
            gradient.addColorStop(0, `rgb(${baseR + 20}, ${baseG + 20}, ${baseB + 10})`);
            gradient.addColorStop(0.5, `rgb(${baseR}, ${baseG}, ${baseB})`);
            gradient.addColorStop(1, `rgb(${baseR - 15}, ${baseG - 15}, ${baseB - 10})`);
            ctx.fillStyle = gradient;
        }
        ctx.fill();

        // 等高線（高度が高い場合）
        if (tile.h > 3 && tile.type !== 'RIVER') {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + tile.h * 0.02})`;
            ctx.lineWidth = 1.5;
        } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
        }
        ctx.stroke();
    }

    /**
     * ユニットを描画
     */
    drawUnit(unit, camera, selectedUnits) {
        const ctx = this.ctx;
        const sx = unit.pos.x * camera.zoom + camera.x;
        const sy = unit.pos.y * camera.zoom + camera.y;

        // 画面外チェック
        if (sx < -100 || sx > this.canvas.width + 100 ||
            sy < -100 || sy > this.canvas.height + 100) {
            return;
        }

        let visualSize = HEX_SIZE * camera.zoom * 0.8;
        if (unit.size === 2) visualSize *= 2.2;

        // 選択中のユニットは白い円で強調
        if (selectedUnits.includes(unit)) {
            ctx.beginPath();
            ctx.arc(sx, sy, visualSize + 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        }

        // ユニット本体の描画
        ctx.save();
        ctx.translate(sx, sy);
        const angle = (unit.dir * 60) * (Math.PI / 180);
        ctx.rotate(angle);

        ctx.fillStyle = unit.side === 'EAST' ? C_EAST : C_WEST;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;

        const s = visualSize;
        const backX = -s / 2, backW = s * 0.6, backH = s;
        const frontX = s * 0.1, frontW = s * 0.4, frontH = s * 0.6;

        ctx.beginPath();
        ctx.moveTo(backX, -backH / 2);
        ctx.lineTo(frontX, -backH / 2);
        ctx.lineTo(frontX, -frontH / 2);
        ctx.lineTo(frontX + frontW, -frontH / 2);
        ctx.lineTo(frontX + frontW, frontH / 2);
        ctx.lineTo(frontX, frontH / 2);
        ctx.lineTo(frontX, backH / 2);
        ctx.lineTo(backX, backH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 名前表示
        ctx.fillStyle = '#fff';
        ctx.font = (unit.size === 2 ? "bold 12px" : "10px") + " sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText(unit.name, sx, sy + visualSize + 12);

        // HPバー
        const barW = visualSize * 1.5;
        const barY = sy + visualSize + 15;
        ctx.fillStyle = 'red';
        ctx.fillRect(sx - barW / 2, barY, barW, 4);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(sx - barW / 2, barY, barW * (unit.soldiers / unit.maxSoldiers), 4);
    }

    /**
     * 指示線を描画
     * @param {boolean} isSelected - 選択中のユニットかどうか
     */
    drawOrderLine(unit, allUnits, camera, isSelected = false) {
        const ctx = this.ctx;
        const start = unit.pos;
        let end = null;

        if (unit.order.type === 'MOVE') {
            end = hexToPixel(unit.order.targetHex.q, unit.order.targetHex.r);
        } else if (unit.order.targetId != null) {
            const target = allUnits.find(u => u.id === unit.order.targetId);
            if (target) end = target.pos;
        }

        if (end) {
            const sx = start.x * camera.zoom + camera.x;
            const sy = start.y * camera.zoom + camera.y;
            const ex = end.x * camera.zoom + camera.x;
            const ey = end.y * camera.zoom + camera.y;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);

            // 選択中は鮮やかな色、非選択は薄い色
            let baseColor;
            if (unit.order.type === 'ATTACK') {
                baseColor = isSelected ? 'rgba(255, 0, 0, 0.9)' : 'rgba(255, 0, 0, 0.3)';
            } else if (unit.order.type === 'PLOT') {
                baseColor = isSelected ? 'rgba(0, 255, 0, 0.9)' : 'rgba(0, 255, 0, 0.3)';
            } else {
                baseColor = isSelected ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.3)';
            }

            ctx.strokeStyle = baseColor;
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = isSelected ? 2.5 : 1.5;
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    /**
     * エフェクトを描画
     */
    drawEffects(effects, camera) {
        const ctx = this.ctx;

        effects.forEach(e => {
            const sx = e.x * camera.zoom + camera.x;
            const sy = e.y * camera.zoom + camera.y;

            if (e.type === 'BEAM') {
                const tx = e.tx * camera.zoom + camera.x;
                const ty = e.ty * camera.zoom + camera.y;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(tx, ty);
                ctx.strokeStyle = e.color;
                ctx.lineWidth = (e.life / 30) * 10;
                ctx.stroke();
            } else if (e.type === 'DUST') {
                ctx.fillStyle = `rgba(200, 200, 180, ${e.life / 30})`;
                ctx.beginPath();
                ctx.arc(sx, sy, 30, 0, Math.PI * 2);
                ctx.fill();
            } else if (e.type === 'SPARK') {
                // 火花エフェクト - 黄色/オレンジ色に輝く
                const alpha = e.life / e.maxLife;
                const size = 3 + alpha * 2;

                // 外側の光輪
                const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, size * 2);
                gradient.addColorStop(0, `rgba(255, 255, 100, ${alpha * 0.8})`);
                gradient.addColorStop(0.5, `rgba(255, 150, 0, ${alpha * 0.5})`);
                gradient.addColorStop(1, `rgba(255, 100, 0, 0)`);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(sx, sy, size * 2, 0, Math.PI * 2);
                ctx.fill();

                // 中心の明るい部分
                ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
                ctx.beginPath();
                ctx.arc(sx, sy, size, 0, Math.PI * 2);
                ctx.fill();
            } else if (e.type === 'WAVE') {
                ctx.strokeStyle = `rgba(200, 0, 255, ${e.life / 40})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(sx, sy, (40 - e.life) * 3, 0, Math.PI * 2);
                ctx.stroke();
            } else if (e.type === 'FLOAT_TEXT') {
                ctx.fillStyle = e.color;
                ctx.font = "bold 24px serif";
                ctx.textAlign = "center";
                ctx.fillText(e.text, sx, sy);
            }
        });
    }

    /**
     * 吹き出しを描画
     */
    drawBubbles(bubbles, camera) {
        const ctx = this.ctx;
        ctx.font = "12px serif";

        bubbles.forEach(b => {
            const sx = b.x * camera.zoom + camera.x;
            const sy = b.y * camera.zoom + camera.y;
            const w = ctx.measureText(b.text).width + 10;

            // 吹き出し背景
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.roundRect(sx - w / 2, sy - 15, w, 20, 5);
            ctx.fill();

            // 吹き出しの尾
            ctx.beginPath();
            ctx.moveTo(sx, sy + 5);
            ctx.lineTo(sx - 5, sy);
            ctx.lineTo(sx + 5, sy);
            ctx.fill();

            // テキスト
            ctx.fillStyle = "black";
            ctx.textAlign = "center";
            ctx.fillText(b.text, sx, sy);
        });
    }
}

/**
 * 武将ポートレートを生成
 * 将来的に画像ファイルへの差し替えも可能な設計
 */
export function generatePortrait(unit) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pc = pCanvas.getContext('2d');

    // 背景色（武将データに指定があればそれを使用、なければ陣営色）
    const bgColor = unit.bg || (unit.side === 'EAST' ? '#001133' : '#330000');

    // 家紋を描画
    const kamonType = unit.kamon || 'DEFAULT';
    KamonDrawer.drawKamon(pc, kamonType, 32, 32, 28, bgColor);

    // 枠線
    pc.strokeStyle = unit.side === 'EAST' ? '#88AAEE' : '#EE4444';
    pc.lineWidth = 3;
    pc.beginPath();
    pc.arc(32, 32, 30, 0, Math.PI * 2);
    pc.stroke();

    return pCanvas;
}
