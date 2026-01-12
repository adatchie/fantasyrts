/**
 * front_right_00.pngの背景透過処理
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const SPRITE_DIR = path.join(__dirname, 'sprites', 'soldier');
const FILE = 'front_right_00.png';
const BG_THRESHOLD = 250;

async function processFile() {
    const filePath = path.join(SPRITE_DIR, FILE);

    const img = await loadImage(filePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let transparentCount = 0;
    let processedCount = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a === 0) transparentCount++;

        // 白または非常に明るい色なら透過
        if (r >= BG_THRESHOLD && g >= BG_THRESHOLD && b >= BG_THRESHOLD) {
            data[i + 3] = 0;
            processedCount++;
        }
    }

    console.log(`Already transparent pixels: ${transparentCount}`);
    console.log(`Newly made transparent: ${processedCount}`);

    ctx.putImageData(imageData, 0, 0);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);
    console.log(`Processed: ${FILE}`);
}

processFile().catch(console.error);
