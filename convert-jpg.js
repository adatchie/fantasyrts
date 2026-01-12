/**
 * JPG→PNG変換＆背景透過スクリプト
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const SPRITE_DIR = path.join(__dirname, 'sprites', 'soldier');

// JPGファイルをPNGに変換して白背景を透過
const JPG_FILES = [
    'back_left_00.jpg',
    'back_left_01.jpg',
    'front_right_03.jpg',
    'front_right_04.jpg',
    'front_right_06.jpg'
];

// 背景と判定する色の閾値
const BG_THRESHOLD = 250;

async function convertAndRemoveBg(jpgFile) {
    const inputPath = path.join(SPRITE_DIR, jpgFile);
    const outputPath = path.join(SPRITE_DIR, jpgFile.replace('.jpg', '.png'));

    if (!fs.existsSync(inputPath)) {
        console.log(`Not found: ${inputPath}`);
        return;
    }

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

        // 白または非常に明るい色なら透過
        if (r >= BG_THRESHOLD && g >= BG_THRESHOLD && b >= BG_THRESHOLD) {
            data[i + 3] = 0;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Converted: ${jpgFile} -> ${path.basename(outputPath)}`);

    // 元のJPGを削除
    fs.unlinkSync(inputPath);
    console.log(`Deleted: ${jpgFile}`);
}

async function main() {
    for (const file of JPG_FILES) {
        await convertAndRemoveBg(file);
    }
    console.log('Done!');
}

main().catch(console.error);
