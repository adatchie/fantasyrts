export class TextureGenerator {
    /**
     * 石垣（城壁）のテクスチャを生成
     * @param {number} width - テクスチャ幅
     * @param {number} height - テクスチャ高さ
     * @returns {HTMLCanvasElement} 生成されたCanvas要素
     */
    static generateStoneWall(width = 512, height = 512) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // ベースカラー（明るめのグレーに変更）
        ctx.fillStyle = '#aaaaaa'; // #5a5a5a -> #aaaaaa
        ctx.fillRect(0, 0, width, height);

        // ノイズを加える（ざらつき）
        this.addNoise(ctx, width, height, 0.1);

        // 石積みパターンを描画
        // レンガ状に配置（石を大きくするため行・列を減らす）
        const rows = 4; // 8 -> 4 (高さ2倍)
        const cols = 2; // 4 -> 2 (幅2倍)
        const brickH = height / rows;
        const brickW = width / cols;

        for (let r = 0; r < rows; r++) {
            // 行ごとにオフセットをずらす（レンガ積み）
            const offset = (r % 2 === 0) ? 0 : brickW / 2;
            
            for (let c = -1; c < cols + 1; c++) {
                const x = c * brickW + offset;
                const y = r * brickH;

                // 石の個体差（色、明るさ）
                const brightness = 0.9 + Math.random() * 0.2; // 0.8~1.2 -> 0.9~1.1 (明るく均一に)
                const hue = 0 + (Math.random() - 0.5) * 5;    // 色相ずれを減らす
                const sat = 0 + Math.random() * 2;            // 低彩度
                
                // 石のベース (輝度を上げて明るく)
                ctx.fillStyle = `hsl(${hue}, ${sat}%, ${70 * brightness}%)`; // 40 -> 70
                
                // 石の形を少し不規則にする（マージンをとる）
                const gap = 4; // 目地も少し広く
                const roughX = x + gap + (Math.random() - 0.5) * 4;
                const roughY = y + gap + (Math.random() - 0.5) * 4;
                const roughW = brickW - gap * 2 + (Math.random() - 0.5) * 4;
                const roughH = brickH - gap * 2 + (Math.random() - 0.5) * 4;

                // 角を丸めるためのパス
                this.drawRoundedRect(ctx, roughX, roughY, roughW, roughH, 8); // 角丸も大きく
                ctx.fill();

                // 石の表面のディテール（ハイライトとシャドウ）
                // 上端にハイライト
                ctx.fillStyle = `rgba(255, 255, 255, 0.2)`;
                ctx.fillRect(roughX, roughY, roughW, 4);
                // 下端にシャドウ
                ctx.fillStyle = `rgba(0, 0, 0, 0.15)`;
                ctx.fillRect(roughX, roughY + roughH - 4, roughW, 4);
            }
        }

        // 全体に汚れ（ウェザリング）を追加 (少し控えめに)
        this.addWeathering(ctx, width, height);

        return canvas;
    }

    static addNoise(ctx, w, h, amount) {
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * amount * 255;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
            data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
        }
        ctx.putImageData(imageData, 0, 0);
    }

    static addWeathering(ctx, w, h) {
        // 縦方向の汚れ（雨だれ）
        ctx.globalCompositeOperation = 'multiply';
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, 'rgba(100, 100, 100, 0.0)');
        gradient.addColorStop(1, 'rgba(50, 50, 40, 0.3)'); // 下の方が暗く汚れている
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // ランダムなシミ
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const r = Math.random() * 30 + 10;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(60, 50, 40, 0.4)');
            grad.addColorStop(1, 'rgba(60, 50, 40, 0.0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    static drawRoundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}