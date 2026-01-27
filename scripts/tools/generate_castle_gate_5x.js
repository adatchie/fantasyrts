
const fs = require('fs');
const path = require('path');

const AIR = 0;
const STONE_WALL = 1;
const STONE_FLOOR = 2;
const WOOD_DOOR = 6;
const WINDOW = 7;

const SCALE = 5;

// Original dimensions
const baseWidth = 22;
const baseDepth = 6;
const baseHeight = 14;

// Scaled dimensions
const width = baseWidth * SCALE;
const depth = baseDepth * SCALE;
const height = baseHeight * SCALE;

// Output file
const OUTPUT_FILE = path.join(__dirname, '../../castle_gate_5x.json');

// 3D array initialization
const blocks = [];
for (let z = 0; z < height; z++) {
    blocks[z] = [];
    for (let y = 0; y < depth; y++) {
        blocks[z][y] = new Array(width).fill(AIR);
    }
}

// Helper: Fill a scaled region corresponding to one original block
function setScaledBlock(bx, by, bz, type) {
    const sx1 = bx * SCALE;
    const sy1 = by * SCALE;
    const sz1 = bz * SCALE;
    const sx2 = sx1 + SCALE - 1;
    const sy2 = sy1 + SCALE - 1;
    const sz2 = sz1 + SCALE - 1;

    for (let z = sz1; z <= sz2; z++) {
        for (let y = sy1; y <= sy2; y++) {
            for (let x = sx1; x <= sx2; x++) {
                if (x >= 0 && x < width && y >= 0 && y < depth && z >= 0 && z < height) {
                    blocks[z][y][x] = type;
                }
            }
        }
    }
}

// Proxies for original logic
function setBlock(x, y, z, type) {
    setScaledBlock(x, y, z, type);
}

function fillBlocks(x1, y1, z1, x2, y2, z2, type) {
    for (let z = z1; z <= z2; z++) {
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                setBlock(x, y, z, type);
            }
        }
    }
}

// === Copied Logic from generate_castle_gate.js ===

// 1. 基盤と壁本体
// 壁の厚さは中央2マス (y=2,3)
fillBlocks(0, 2, 0, baseWidth - 1, 3, 9, STONE_WALL);

// 2. 塔 (Towers)
// 画像には複数の塔がある。
// 左端(大きな塔), 中央左(門の左), 中央右(門の右), 右端(壁の端)

// 左端の塔 (Left End Tower)
// x=0-3, y=1-4
fillBlocks(0, 1, 0, 3, 4, 11, STONE_WALL);
// 装飾 (窓)
setBlock(1, 1, 5, WINDOW);
setBlock(2, 1, 8, WINDOW);

// 門の左塔 (Gate Left Tower) - 円筒形っぽく角を削る
// x=6-8, y=0-5 (突き出す)
fillBlocks(6, 0, 0, 8, 5, 12, STONE_WALL);
// 角を削る (Airにするのではなく、塗らないことで表現...fillBlocksで塗ってるので上書き必要ならAIR)
// ここでは単純な箱で作る

// 門の右塔 (Gate Right Tower)
// x=13-15, y=0-5
fillBlocks(13, 0, 0, 15, 5, 12, STONE_WALL);

// 壁 (塔の間)
// 左壁: x=4-5
// 右壁: x=16-21

// 3. 門 (Gate) & 通路
// x=9-12 (4マス幅)
// 穴を開ける
fillBlocks(9, 2, 0, 12, 3, 5, AIR); // 通路
fillBlocks(9, 0, 0, 12, 1, 5, AIR); // 前方スペース
fillBlocks(9, 4, 0, 12, 5, 5, AIR); // 後方スペース

// 門扉 (奥に配置, y=3)
fillBlocks(9, 3, 0, 12, 3, 4, WOOD_DOOR);

// アーチ上部 (z=6,7)
// 壁として埋まっているが、多少デザインを入れる
// そのままSTONE_WALLでOK

// 4. クレネル (城壁の凸凹)
// 塔の上部
function createCrenellations(x1, y1, x2, y2, z) {
    for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
            // 外周のみ
            if (x === x1 || x === x2 || y === y1 || y === y2) {
                if ((x + y) % 2 === 0) {
                    setBlock(x, y, z, STONE_WALL);
                }
            } else {
                // 床を敷く
                setBlock(x, y, z - 1, STONE_FLOOR);
            }
        }
    }
}

// 左塔
createCrenellations(0, 1, 3, 4, 11);
// 門左塔
createCrenellations(6, 0, 8, 5, 12);
// 門右塔
createCrenellations(13, 0, 15, 5, 12);

// 壁部分の通路 (Walkway)
// z=10
fillBlocks(4, 2, 10, 5, 3, 10, STONE_FLOOR); // 左壁上
fillBlocks(9, 2, 10, 12, 3, 10, STONE_FLOOR); // 門上
fillBlocks(16, 2, 10, baseWidth - 1, 3, 10, STONE_FLOOR); // 右壁上

// 壁の凸凹 z=10
// 前面 (y=2 の前, つまりy=1には何もないが、壁の前面y=2に凸凹をつけるにはy=2のz+1)
// ここではシンプルに壁の上に置く
for (let x = 0; x < baseWidth; x++) {
    // 塔以外の場所
    if ((x < 6 || x > 8) && (x < 13 || x > 15)) {
        if (x % 2 === 0) setBlock(x, 2, 10, STONE_WALL); // 前
        if (x % 2 === 0) setBlock(x, 3, 10, STONE_WALL); // 後
    }
}

// === JSON出力 ===
const data = {
    name: "Castle Gate 5x",
    size: { x: width, y: depth, z: height },
    blocks: blocks
};

// Compression is NOT handled here, relies on Map Editor's compression.
// But writing 1.5MB file is fine for file system, just problematic for LocalStorage without compression.
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data));
console.log(`JSON generated: ${OUTPUT_FILE}`);
