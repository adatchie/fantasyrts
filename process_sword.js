const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function main() {
    const inputPath = 'C:/Users/adatc/.gemini/antigravity/brain/dfc91d8f-a14f-4fd8-81c9-c70c7cf93cd8/sword_sprite_1773233878696.png';
    const outputPath = 'C:/fantasyrts/assets/sprites/sword.png';

    if (!fs.existsSync(inputPath)) {
        console.error("Input file not found:", inputPath);
        return;
    }

    const img = await loadImage(inputPath);
    // Resize down slightly if it's 1024x1024
    let w = img.width;
    let h = img.height;
    if (w >= 1024) {
        w = 800;
        h = 800;
    }

    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    // Draw the image scaled
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // Make white/light-grey transparent
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log("Saved transparent sword sprite to", outputPath);
}

main().catch(console.error);
