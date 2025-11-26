/**
 * SEKIGAHARA RTS - Kamon (Family Crest) Drawing System
 * 家紋描画システム
 */

export class KamonDrawer {
    /**
     * 家紋を描画
     */
    static drawKamon(ctx, kamonType, x, y, size, bgColor) {
        ctx.save();
        ctx.translate(x, y);

        // 背景円
        ctx.fillStyle = bgColor || '#f5f5dc';
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();

        // 家紋に応じて描画
        switch (kamonType) {
            case 'MITSUBA_AOI': // 三つ葉葵（徳川）
                this.drawMitsubaAoi(ctx, size);
                break;
            case 'DAIICHI': // 大一大万大吉（石田）
                this.drawDaiichi(ctx, size);
                break;
            case 'FOUR_DIAMONDS': // 四つ目（真田など）
                this.drawFourDiamonds(ctx, size);
                break;
            case 'MARUNI_JUJI': // 丸に十字（島津）
                this.drawMaruniJuji(ctx, size);
                break;
            case 'MITSUBOSHI': // 三つ星
                this.drawMitsuboshi(ctx, size);
                break;
            case 'MARUNI_TACHIAOI': // 丸に立葵（本多）
                this.drawMaruniTachiAoi(ctx, size);
                break;
            case 'ODA_MOKKO': // 織田木瓜（織田）
                this.drawOdaMokko(ctx, size);
                break;
            case 'KUYO': // 九曜（細川）
                this.drawKuyo(ctx, size);
                break;
            case 'CHIGAI_GAMA': // 違い鎌（小早川）
                this.drawChigaiGama(ctx, size);
                break;
            case 'JI': // 兒文字（宇喜多）
                this.drawJi(ctx, size);
                break;
            case 'TACHIBANA': // 橘（井伊）
                this.drawTachibana(ctx, size);
                break;
            case 'FUJIDOMOE': // 藤巴（黒田）
                this.drawFujidomoe(ctx, size);
                break;
            case 'OMODAKA': // 沢瀉（福島）
                this.drawOmodaka(ctx, size);
                break;
            case 'KABUTO': // 兜（汎用）
                this.drawKabuto(ctx, size);
                break;
            case 'MOKKO': // 木瓜（汎用）
                this.drawMokko(ctx, size);
                break;
            case 'MUKAI_CHO': // 対い蝶（大谷）
                this.drawMukaiCho(ctx, size);
                break;
            case 'MITSU_GASHIWA': // 三つ柏（島左近）
                this.drawMitsuGashiwa(ctx, size);
                break;
            case 'TAKEDA_BISHI': // 武田菱（安国寺）
                this.drawTakedaBishi(ctx, size);
                break;
            case 'SAGARI_FUJI': // 下り藤（加藤、大久保）
                this.drawSagariFuji(ctx, size);
                break;
            case 'TSUTA': // 蔦（藤堂）
                this.drawTsuta(ctx, size);
                break;
            case 'UMEBACHI': // 梅鉢（筒井、金森）
                this.drawUmebachi(ctx, size);
                break;
            case 'GENJI_GURUMA': // 源氏車（榊原、生駒）
                this.drawGenjiGuruma(ctx, size);
                break;
            case 'KATABAMI': // 片喰（酒井、長宗我部）
                this.drawKatabami(ctx, size);
                break;
            case 'GION_MAMORI': // 祇園守（小西）
                this.drawGionMamori(ctx, size);
                break;
            case 'WA_CHIGAI': // 輪違い（脇坂）
                this.drawWaChigai(ctx, size);
                break;
            case 'MUKAI_TSURU': // 対い鶴（蒲生）
                this.drawMukaiTsuru(ctx, size);
                break;
            case 'KUGINUKI': // 釘抜き（田中）
                this.drawKuginuki(ctx, size);
                break;
            case 'MARUNI_FUTATSUHIKI': // 丸に二つ引（古田）
                this.drawMaruniFutatsuhiki(ctx, size);
                break;
            case 'MITSU_UROKO': // 三つ鱗（平塚）
                this.drawMitsuUroko(ctx, size);
                break;
            case 'OSHIKI_NI_SAN': // 折敷に三（稲葉）
                this.drawOshikiNiSan(ctx, size);
                break;
            case 'HANABISHI': // 花菱（長束）
                this.drawHanabishi(ctx, size);
                break;
            case 'MARUNI_DAKIGASHIWA': // 丸に抱き柏（小川）
                this.drawMaruniDakigashiwa(ctx, size);
                break;
            case 'MARUNI_MITSUMEBISHI': // 丸に三つ目菱（赤座）
                this.drawMaruniMitsumebishi(ctx, size);
                break;
            default:
                this.drawDefault(ctx, size);
                break;
        }

        ctx.restore();
    }

    /**
     * 沢瀉（福島正則）
     */
    static drawOmodaka(ctx, size) {
        ctx.fillStyle = '#fff';
        // 矢尻のような葉
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.5);
        ctx.lineTo(-size * 0.3, size * 0.2);
        ctx.lineTo(0, size * 0.1);
        ctx.lineTo(size * 0.3, size * 0.2);
        ctx.closePath();
        ctx.fill();

        // 下部の葉
        ctx.beginPath();
        ctx.ellipse(-size * 0.2, size * 0.4, size * 0.1, size * 0.2, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(size * 0.2, size * 0.4, size * 0.1, size * 0.2, -0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 丸に立葵（本多忠勝）
     */
    static drawMaruniTachiAoi(ctx, size) {
        // 外枠の円
        ctx.strokeStyle = '#fff'; // 家紋は白で描くことが多い
        ctx.lineWidth = size * 0.1;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fff';

        // 立葵の葉と茎（簡略化）
        // 茎
        ctx.beginPath();
        ctx.moveTo(0, size * 0.6);
        ctx.lineTo(0, -size * 0.4);
        ctx.lineWidth = size * 0.08;
        ctx.stroke();

        // 葉（左右に3枚ずつ）
        for (let i = 0; i < 3; i++) {
            let y = size * 0.3 - (i * size * 0.25);

            // 左葉
            ctx.beginPath();
            ctx.ellipse(-size * 0.25, y, size * 0.15, size * 0.1, -0.5, 0, Math.PI * 2);
            ctx.fill();

            // 右葉
            ctx.beginPath();
            ctx.ellipse(size * 0.25, y, size * 0.15, size * 0.1, 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 頭頂部の花/葉
        ctx.beginPath();
        ctx.arc(0, -size * 0.5, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 織田木瓜（織田有楽斎）
     */
    static drawOdaMokko(ctx, size) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.05;

        // 五つ木瓜（外側の花弁5つ）
        const petalCount = 5;
        const radius = size * 0.6;

        ctx.beginPath();
        for (let i = 0; i < petalCount; i++) {
            const angle = (i * 360 / petalCount - 90) * Math.PI / 180;
            const x = Math.cos(angle) * radius * 0.6;
            const y = Math.sin(angle) * radius * 0.6;
            // 花弁の円
            ctx.moveTo(x, y);
            ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
        }
        ctx.stroke(); // 輪郭線

        // 内側の円（中心）
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 九曜（細川忠興）
     */
    static drawKuyo(ctx, size) {
        ctx.fillStyle = '#fff';

        // 中心の大きな星
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // 周囲の8つの星
        const count = 8;
        const dist = size * 0.65;
        const smallSize = size * 0.12;

        for (let i = 0; i < count; i++) {
            const angle = (i * 360 / count) * Math.PI / 180;
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;

            ctx.beginPath();
            ctx.arc(x, y, smallSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * 違い鎌（小早川秀秋）
     */
    static drawChigaiGama(ctx, size) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.1;
        ctx.lineCap = 'round';

        // 鎌を2つ描く
        for (let i = 0; i < 2; i++) {
            ctx.save();
            ctx.rotate((i * 180 + 45) * Math.PI / 180); // 45度傾けて交差させる

            // 柄
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.6);
            ctx.lineTo(0, size * 0.6);
            ctx.stroke();

            // 刃
            ctx.beginPath();
            ctx.arc(-size * 0.3, -size * 0.4, size * 0.3, 0, Math.PI, false);
            ctx.stroke();

            ctx.restore();
        }

        // 丸枠
        ctx.lineWidth = size * 0.05;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * 兒文字（宇喜多秀家）
     */
    static drawJi(ctx, size) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${size * 1.2}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('兒', 0, size * 0.1);
    }

    /**
     * 橘（井伊直政）
     */
    static drawTachibana(ctx, size) {
        ctx.strokeStyle = '#fff';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = size * 0.05;

        // 丸枠
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        // 実
        ctx.beginPath();
        ctx.arc(0, -size * 0.1, size * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // 葉
        ctx.beginPath();
        ctx.ellipse(-size * 0.3, size * 0.3, size * 0.2, size * 0.1, 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(size * 0.3, size * 0.3, size * 0.2, size * 0.1, -0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 藤巴（黒田長政）- 簡略版
     */
    static drawFujidomoe(ctx, size) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.08;

        // 巴状に3つの円弧を描く
        for (let i = 0; i < 3; i++) {
            ctx.save();
            ctx.rotate((i * 120) * Math.PI / 180);

            ctx.beginPath();
            ctx.arc(size * 0.4, 0, size * 0.3, 0, Math.PI * 2);
            ctx.stroke();

            // 藤の花房っぽさ（点）
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(size * 0.4, 0, size * 0.1, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    /**
     * 三つ葉葵（徳川家）
     */
    static drawMitsubaAoi(ctx, size) {
        ctx.fillStyle = '#1a4d1a';
        ctx.strokeStyle = '#0d260d';
        ctx.lineWidth = size * 0.03;

        const leafSize = size * 0.35;
        const positions = [
            { angle: -90, dist: size * 0.3 },
            { angle: 150, dist: size * 0.3 },
            { angle: 30, dist: size * 0.3 }
        ];

        positions.forEach(pos => {
            const rad = pos.angle * Math.PI / 180;
            const lx = Math.cos(rad) * pos.dist;
            const ly = Math.sin(rad) * pos.dist;

            // 葉の形状
            ctx.beginPath();
            ctx.ellipse(lx, ly, leafSize * 0.6, leafSize, rad, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 葉脈
            ctx.beginPath();
            ctx.moveTo(lx, ly - leafSize * 0.8);
            ctx.lineTo(lx, ly + leafSize * 0.8);
            ctx.stroke();
        });

        // 中心の茎
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 大一大万大吉（石田三成）
     */
    static drawDaiichi(ctx, size) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${size * 0.3}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const text = '大一\n大万\n大吉';
        const lines = text.split('\n');
        const lineHeight = size * 0.35;

        lines.forEach((line, i) => {
            const y = (i - 1) * lineHeight;
            ctx.fillText(line, 0, y);
        });
    }

    /**
     * 四つ目菱（真田など）
     */
    static drawFourDiamonds(ctx, size) {
        ctx.fillStyle = '#8b0000';
        ctx.strokeStyle = '#4a0000';
        ctx.lineWidth = size * 0.02;

        const diamondSize = size * 0.3;
        const positions = [
            [-diamondSize, -diamondSize],
            [diamondSize, -diamondSize],
            [-diamondSize, diamondSize],
            [diamondSize, diamondSize]
        ];

        positions.forEach(([dx, dy]) => {
            ctx.save();
            ctx.translate(dx, dy);
            ctx.rotate(45 * Math.PI / 180);

            ctx.beginPath();
            ctx.rect(-diamondSize * 0.4, -diamondSize * 0.4, diamondSize * 0.8, diamondSize * 0.8);
            ctx.fill();
            ctx.stroke();

            ctx.restore();
        });
    }

    /**
     * 丸に十字（島津家）
     */
    static drawMaruniJuji(ctx, size) {
        ctx.fillStyle = '#000';

        const crossWidth = size * 0.2;
        const crossLength = size * 1.4;

        // 十字
        ctx.fillRect(-crossWidth / 2, -crossLength / 2, crossWidth, crossLength);
        ctx.fillRect(-crossLength / 2, -crossWidth / 2, crossLength, crossWidth);

        // 外枠の円（白抜き）
        ctx.strokeStyle = '#000';
        ctx.lineWidth = size * 0.15;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * 一文字に三つ星（毛利家）
     */
    static drawMitsuboshi(ctx, size) {
        ctx.fillStyle = '#fff'; // 家紋は白

        // 三つ星（●●●）
        const starRadius = size * 0.18;
        const positions = [
            { x: 0, y: size * 0.2 },          // 中央
            { x: -size * 0.45, y: size * 0.2 }, // 左
            { x: size * 0.45, y: size * 0.2 }   // 右
        ];

        positions.forEach(pos => {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, starRadius, 0, Math.PI * 2);
            ctx.fill();
        });

        // 一文字（ー）
        const barWidth = size * 1.2;
        const barHeight = size * 0.15;
        ctx.fillRect(-barWidth / 2, -size * 0.3, barWidth, barHeight);
    }

    /**
     * 兜（シンプル版）
     */
    static drawKabuto(ctx, size) {
        ctx.fillStyle = '#2c2c2c';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = size * 0.03;

        // 兜のシルエット
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.6);
        ctx.lineTo(-size * 0.5, 0);
        ctx.lineTo(-size * 0.3, size * 0.5);
        ctx.lineTo(size * 0.3, size * 0.5);
        ctx.lineTo(size * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 角
        ctx.fillStyle = '#8b7355';
        ctx.beginPath();
        ctx.moveTo(-size * 0.6, -size * 0.3);
        ctx.lineTo(-size * 0.4, -size * 0.8);
        ctx.lineTo(-size * 0.35, -size * 0.2);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(size * 0.6, -size * 0.3);
        ctx.lineTo(size * 0.4, -size * 0.8);
        ctx.lineTo(size * 0.35, -size * 0.2);
        ctx.closePath();
        ctx.fill();
    }

    /**
     * 木瓜
     */
    static drawMokko(ctx, size) {
        ctx.fillStyle = '#8b4513';
        ctx.strokeStyle = '#5c2e0f';
        ctx.lineWidth = size * 0.03;

        const petalCount = 4;
        const petalSize = size * 0.5;

        for (let i = 0; i < petalCount; i++) {
            const angle = (i * 90) * Math.PI / 180;
            const x = Math.cos(angle) * size * 0.3;
            const y = Math.sin(angle) * size * 0.3;

            ctx.beginPath();
            ctx.arc(x, y, petalSize * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // 中心
        ctx.fillStyle = '#f5f5dc';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    /**
     * デフォルト（シンプルな円）
     */
    static drawDefault(ctx, size) {
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 星を描画（ヘルパー）
     */
    static drawStar(ctx, x, y, size, points) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();

        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const radius = i % 2 === 0 ? size : size * 0.5;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }

        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    /**
     * 対い蝶（大谷吉継）
     */
    static drawMukaiCho(ctx, size) {
        ctx.fillStyle = '#000';
        // 2つの蝶が向かい合うシルエット
        for (let i = 0; i < 2; i++) {
            ctx.save();
            ctx.scale(i === 0 ? 1 : -1, 1);
            ctx.translate(size * 0.2, 0);

            // 羽
            ctx.beginPath();
            ctx.ellipse(0, -size * 0.2, size * 0.3, size * 0.2, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(0, size * 0.2, size * 0.25, size * 0.15, 0.2, 0, Math.PI * 2);
            ctx.fill();

            // 触角
            ctx.strokeStyle = '#000';
            ctx.lineWidth = size * 0.05;
            ctx.beginPath();
            ctx.moveTo(-size * 0.1, -size * 0.3);
            ctx.quadraticCurveTo(-size * 0.2, -size * 0.5, 0, -size * 0.6);
            ctx.stroke();

            ctx.restore();
        }
    }

    /**
     * 三つ柏（島左近）
     */
    static drawMitsuGashiwa(ctx, size) {
        ctx.fillStyle = '#fff';
        const angles = [-90, 150, 30];
        angles.forEach(a => {
            ctx.save();
            ctx.rotate(a * Math.PI / 180);
            ctx.translate(0, -size * 0.15);

            // 柏の葉
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.5);
            ctx.quadraticCurveTo(size * 0.35, -size * 0.3, 0, size * 0.1);
            ctx.quadraticCurveTo(-size * 0.35, -size * 0.3, 0, -size * 0.5);
            ctx.fill();
            ctx.restore();
        });
    }

    /**
     * 武田菱（安国寺恵瓊）
     */
    static drawTakedaBishi(ctx, size) {
        ctx.fillStyle = '#fff';
        const s = size * 0.45;
        // 4つの菱形
        const positions = [
            { x: 0, y: -s }, { x: -s * 0.8, y: 0 }, { x: s * 0.8, y: 0 }, { x: 0, y: s }
        ];

        positions.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.beginPath();
            ctx.moveTo(0, -s * 0.5);
            ctx.lineTo(s * 0.6, 0);
            ctx.lineTo(0, s * 0.5);
            ctx.lineTo(-s * 0.6, 0);
            ctx.fill();
            ctx.restore();
        });
    }

    /**
     * 下り藤（加藤嘉明、大久保忠隣）
     */
    static drawSagariFuji(ctx, size) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.05;

        // 丸枠
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        // 藤の花房（左右）
        for (let i = 0; i < 2; i++) {
            ctx.save();
            ctx.scale(i === 0 ? 1 : -1, 1);
            ctx.translate(size * 0.3, 0);

            // 房
            ctx.beginPath();
            ctx.ellipse(0, size * 0.1, size * 0.15, size * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();

            // 蔓
            ctx.beginPath();
            ctx.moveTo(-size * 0.3, -size * 0.6);
            ctx.quadraticCurveTo(0, -size * 0.6, 0, -size * 0.3);
            ctx.stroke();

            ctx.restore();
        }
    }

    /**
     * 蔦（藤堂高虎）
     */
    static drawTsuta(ctx, size) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.03;

        // 蔦の葉
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.2);
        ctx.lineTo(size * 0.4, 0);
        ctx.lineTo(size * 0.2, size * 0.4);
        ctx.lineTo(0, size * 0.2);
        ctx.lineTo(-size * 0.2, size * 0.4);
        ctx.lineTo(-size * 0.4, 0);
        ctx.closePath();
        ctx.fill();

        // 丸枠
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * 梅鉢（筒井定次、金森長近）
     */
    static drawUmebachi(ctx, size) {
        ctx.fillStyle = '#fff';

        // 中心円
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
        ctx.fill();

        // 周囲の5円
        for (let i = 0; i < 5; i++) {
            const angle = (i * 72 - 90) * Math.PI / 180;
            const dist = size * 0.55;
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;

            ctx.beginPath();
            ctx.arc(x, y, size * 0.2, 0, Math.PI * 2);
            ctx.fill();

            // 軸
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = size * 0.05;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    }

    /**
     * 源氏車（榊原康政、生駒一正）
     */
    static drawGenjiGuruma(ctx, size) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.1;

        // 車輪
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
        ctx.stroke();

        // 中心軸
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // スポーク（8本）
        ctx.lineWidth = size * 0.05;
        for (let i = 0; i < 8; i++) {
            const angle = (i * 45) * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * size * 0.8, Math.sin(angle) * size * 0.8);
            ctx.stroke();
        }
    }

    /**
     * 片喰（酒井家次、長宗我部盛親）
     */
    static drawKatabami(ctx, size) {
        ctx.fillStyle = '#fff';

        // 3つのハート
        const angles = [-90, 150, 30];
        angles.forEach(a => {
            ctx.save();
            ctx.rotate(a * Math.PI / 180);
            ctx.translate(0, -size * 0.2);

            // ハート型
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-size * 0.3, -size * 0.3, -size * 0.4, 0, 0, size * 0.2);
            ctx.bezierCurveTo(size * 0.4, 0, size * 0.3, -size * 0.3, 0, 0);
            ctx.fill();
            ctx.restore();
        });

        // 剣（長宗我部用だが汎用として）
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.03;
        angles.forEach(a => {
            ctx.save();
            ctx.rotate((a + 60) * Math.PI / 180);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -size * 0.7);
            ctx.stroke();
            ctx.restore();
        });
    }

    /**
     * 祇園守（小西行長）
     */
    static drawGionMamori(ctx, size) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.08;

        // クロス
        ctx.beginPath();
        ctx.moveTo(-size * 0.5, -size * 0.5);
        ctx.lineTo(size * 0.5, size * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(size * 0.5, -size * 0.5);
        ctx.lineTo(-size * 0.5, size * 0.5);
        ctx.stroke();

        // 筒
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.rect(-size * 0.2, -size * 0.6, size * 0.4, size * 1.2);
        ctx.fill();
    }

    /**
     * 輪違い（脇坂安治）
     */
    static drawWaChigai(ctx, size) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.1;

        // 2つの交差する輪
        for (let i = 0; i < 2; i++) {
            ctx.save();
            ctx.translate(i === 0 ? -size * 0.2 : size * 0.2, 0);
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    /**
     * 対い鶴（蒲生郷舎）
     */
    static drawMukaiTsuru(ctx, size) {
        ctx.fillStyle = '#fff';
        // 2羽の鶴（非常に簡略化）
        for (let i = 0; i < 2; i++) {
            ctx.save();
            ctx.scale(i === 0 ? 1 : -1, 1);
            ctx.translate(size * 0.3, 0);

            // 体
            ctx.beginPath();
            ctx.ellipse(0, 0, size * 0.2, size * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            //首
            ctx.beginPath();
            ctx.arc(-size * 0.2, -size * 0.4, size * 0.1, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        // 丸枠
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.05;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * 釘抜き（田中吉政）
     */
    static drawKuginuki(ctx, size) {
        ctx.fillStyle = '#fff';

        // 丸枠
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // 中の四角い穴（背景色で抜く）
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.rect(-size * 0.3, -size * 0.3, size * 0.6, size * 0.6);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * 丸に二つ引（古田重勝）
     */
    static drawMaruniFutatsuhiki(ctx, size) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.1;

        // 丸枠
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        // 二つ引
        ctx.lineWidth = size * 0.15;
        ctx.beginPath();
        ctx.moveTo(-size * 0.7, -size * 0.2);
        ctx.lineTo(size * 0.7, -size * 0.2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-size * 0.7, size * 0.2);
        ctx.lineTo(size * 0.7, size * 0.2);
        ctx.stroke();
    }

    /**
     * 三つ鱗（平塚為広）
     */
    static drawMitsuUroko(ctx, size) {
        ctx.fillStyle = '#fff';
        const s = size * 0.4;

        const positions = [
            { x: 0, y: -s }, { x: -s, y: s }, { x: s, y: s }
        ];

        positions.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.beginPath();
            ctx.moveTo(0, -s * 0.8);
            ctx.lineTo(s, s * 0.8);
            ctx.lineTo(-s, s * 0.8);
            ctx.fill();
            ctx.restore();
        });
    }

    /**
     * 折敷に三（稲葉正成）
     */
    static drawOshikiNiSan(ctx, size) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.1;

        // 折敷（四角い台）
        ctx.beginPath();
        ctx.rect(-size * 0.7, -size * 0.7, size * 1.4, size * 1.4);
        ctx.stroke();

        // 「三」の文字
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${size * 0.8}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('三', 0, size * 0.1);
    }

    /**
     * 花菱（長束正家）
     */
    static drawHanabishi(ctx, size) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.05;

        // 4つの菱形を十字に配置
        const s = size * 0.5;
        const positions = [
            { x: 0, y: -s }, // 上
            { x: s, y: 0 },  // 右
            { x: 0, y: s },  // 下
            { x: -s, y: 0 }  // 左
        ];

        positions.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(45 * Math.PI / 180);

            const w = size * 0.35;
            ctx.beginPath();
            ctx.rect(-w / 2, -w / 2, w, w);
            ctx.fill();
            ctx.stroke();

            ctx.restore();
        });

        // 中心の菱形
        ctx.save();
        ctx.rotate(45 * Math.PI / 180);
        const cw = size * 0.25;
        ctx.beginPath();
        ctx.rect(-cw / 2, -cw / 2, cw, cw);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    /**
     * 丸に抱き柏（小川祐忠）
     */
    static drawMaruniDakigashiwa(ctx, size) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.08;

        // 外枠の円
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fff';

        // 3枚の柏の葉（中央に3つ配置）
        const angles = [-90, 150, 30];
        angles.forEach(a => {
            ctx.save();
            ctx.rotate(a * Math.PI / 180);
            ctx.translate(0, -size * 0.1);

            // 葉の形状（簡略化した笹葉）
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.45);
            ctx.quadraticCurveTo(size * 0.15, -size * 0.3, size * 0.1, 0);
            ctx.quadraticCurveTo(size * 0.15, size * 0.2, 0, size * 0.15);
            ctx.quadraticCurveTo(-size * 0.15, size * 0.2, -size * 0.1, 0);
            ctx.quadraticCurveTo(-size * 0.15, -size * 0.3, 0, -size * 0.45);
            ctx.fill();

            // 左側の3つの実
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(-size * 0.25, -size * 0.15 + (i * size * 0.15), size * 0.08, 0, Math.PI * 2);
                ctx.fill();
            }

            // 右側の3つの実
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(size * 0.25, -size * 0.15 + (i * size * 0.15), size * 0.08, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        });
    }

    /**
     * 丸に三つ目菱（赤座直保）
     */
    static drawMaruniMitsumebishi(ctx, size) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.08;

        // 外枠の円
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fff';

        // 3つの大きな菱形を三角形状に配置
        const positions = [
            { x: 0, y: -size * 0.35 },      // 上
            { x: -size * 0.3, y: size * 0.2 }, // 左下
            { x: size * 0.3, y: size * 0.2 }   // 右下
        ];

        positions.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(45 * Math.PI / 180);

            // 大きな菱形（黒で塗りつぶし）
            const outerSize = size * 0.35;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.rect(-outerSize / 2, -outerSize / 2, outerSize, outerSize);
            ctx.fill();

            // 中央の小さな白い菱形（目）
            ctx.globalCompositeOperation = 'destination-out';
            const innerSize = size * 0.12;
            ctx.beginPath();
            ctx.rect(-innerSize / 2, -innerSize / 2, innerSize, innerSize);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';

            ctx.restore();
        });
    }
}
