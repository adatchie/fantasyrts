/**
 * スプライト背景除去スクリプト
 * 白または明るいグレーの背景ピクセルを透過にする
 * 
 * 使い方: node remove-bg.js
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const SPRITE_DIR = path.join(__dirname, 'sprites', 'soldier');
const OUTPUT_DIR = path.join(__dirname, 'sprites', 'soldier_clean');

// 処理対象ファイル
const FILES = [
    'back_left_00.png',
    'back_left_01.png',
    'front_right_00.png',
    'front_right_03.png',
    'front_right_04.png',
    'front_right_06.png'
];

// 背景と判定する色の閾値（RGB各値がこれ以上なら背景）
const BG_THRESHOLD = 240;

async function removeBackground(inputPath, outputPath) {
    const img = await loadImage(inputPath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // 白または明るいグレーなら透過
        if (r >= BG_THRESHOLD && g >= BG_THRESHOLD && b >= BG_THRESHOLD) {
            data[i + 3] = 0; // アルファを0に
        }
    }

    ctx.putImageData(imageData, 0, 0);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Processed: ${outputPath}`);
}

async function main() {
    // 出力ディレクトリ作成
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    for (const file of FILES) {
        const inputPath = path.join(SPRITE_DIR, file);
        const outputPath = path.join(OUTPUT_DIR, file);

        if (fs.existsSync(inputPath)) {
            await removeBackground(inputPath, outputPath);
        } else {
            console.log(`File not found: ${inputPath}`);
        }
    }

    console.log('Done! Check sprites/soldier_clean/ folder');
}

main().catch(console.error);
