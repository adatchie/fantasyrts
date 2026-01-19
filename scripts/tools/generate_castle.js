
const fs = require('fs');
const path = require('path');

// 設定
const SIZE = { x: 50, y: 50, z: 30 };
const OUTPUT_FILE = path.join(__dirname, '../../castle_gate_new.json');

// ブロックタイプ定義 (building.jsより)
const BLOCK = {
    AIR: 0,
    STONE_WALL: 1,
    STONE_FLOOR: 2,
    WOOD_WALL: 3,
    WOOD_FLOOR: 4,
    ROOF_TILE: 5,
    WOOD_DOOR: 6,
    WINDOW: 7,
};

// 3D配列初期化 blocks[z][y][x]
const blocks = [];
for (let z = 0; z < SIZE.z; z++) {
    blocks[z] = [];
    for (let y = 0; y < SIZE.y; y++) {
        blocks[z][y] = new Array(SIZE.x).fill(BLOCK.AIR);
    }
}

// ヘルパー関数: ブロック配置
function setBlock(x, y, z, type) {
    if (x >= 0 && x < SIZE.x && y >= 0 && y < SIZE.y && z >= 0 && z < SIZE.z) {
        blocks[z][y][x] = type;
    }
}

function fillRect(x1, y1, z1, x2, y2, z2, type) {
    for (let z = z1; z <= z2; z++) {
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                setBlock(x, y, z, type);
            }
        }
    }
}

// === 生成ロジック ===

// 1. 地形・土台 (奥が高くなるように)
// 手前の低いエリア
fillRect(0, 0, 0, 49, 15, 2, BLOCK.STONE_FLOOR);
// 中間の広場
fillRect(0, 16, 0, 49, 35, 5, BLOCK.STONE_WALL); // 土台
fillRect(0, 16, 6, 49, 35, 6, BLOCK.STONE_FLOOR); // 床

// 階段作成 (手前から広場へ)
for (let i = 0; i < 4; i++) {
    const y = 12 + i;
    const z = 3 + i;
    fillRect(10, y, z, 39, y, z, BLOCK.STONE_FLOOR);
}

// 2. 城壁 (Main Wall) - 奥側
const wallY = 32;
const wallHeight = 18; // z=6 から +18 = 24
const wallThickness = 4;

// 左右の壁
fillRect(0, wallY, 6, 18, wallY + wallThickness, wallHeight, BLOCK.STONE_WALL);
fillRect(32, wallY, 6, 49, wallY + wallThickness, wallHeight, BLOCK.STONE_WALL);

// 壁の上部の凹凸 (クレネル)
for (let x = 0; x < 18; x += 2) setBlock(x, wallY, wallHeight + 1, BLOCK.STONE_WALL);
for (let x = 0; x < 18; x += 2) setBlock(x, wallY + wallThickness, wallHeight + 1, BLOCK.STONE_WALL);

for (let x = 32; x < 50; x += 2) setBlock(x, wallY, wallHeight + 1, BLOCK.STONE_WALL);
for (let x = 32; x < 50; x += 2) setBlock(x, wallY + wallThickness, wallHeight + 1, BLOCK.STONE_WALL);


// 3. 中央の門 (Gatehouse)
const gateX = 19;
const gateWidth = 12; // 19 to 31
const gateDepth = 8;
const gateHeight = 22; // z=6 から +22 = 28

fillRect(gateX, wallY - 2, 6, gateX + gateWidth, wallY + wallThickness + 2, gateHeight, BLOCK.STONE_WALL);

// 門の開口部 (アーチの代わりの矩形)
fillRect(gateX + 4, wallY - 3, 6, gateX + gateWidth - 4, wallY + wallThickness + 3, 14, BLOCK.AIR);

// 門扉 (閉まっている状態)
fillRect(gateX + 5, wallY + 1, 6, gateX + gateWidth - 5, wallY + 1, 13, BLOCK.WOOD_DOOR);

// 門の上部の凹凸
for (let x = gateX; x <= gateX + gateWidth; x += 2) {
    setBlock(x, wallY - 2, gateHeight + 1, BLOCK.STONE_WALL);
    setBlock(x, wallY + wallThickness + 2, gateHeight + 1, BLOCK.STONE_WALL);
}


// 4. 側塔 (Towers) - 左右の端
const towerSize = 8;
const towerHeight = 26;

// 左塔
fillRect(0, wallY - 2, 6, towerSize, wallY + wallThickness + 2, towerHeight, BLOCK.STONE_WALL);
// 右塔
fillRect(49 - towerSize, wallY - 2, 6, 49, wallY + wallThickness + 2, towerHeight, BLOCK.STONE_WALL);

// 塔の窓
setBlock(2, wallY, 15, BLOCK.WINDOW);
setBlock(49 - 2, wallY, 15, BLOCK.WINDOW);


// 5. 手前の小さな防壁など
// 広場の手前に低い壁
fillRect(0, 16, 7, 8, 16, 8, BLOCK.STONE_WALL);
fillRect(41, 16, 7, 49, 16, 8, BLOCK.STONE_WALL);

// 篝火（かがりび）的な装飾 (適当に木材で)
setBlock(15, 20, 7, BLOCK.WOOD_WALL);
setBlock(34, 20, 7, BLOCK.WOOD_WALL);


// === JSON出力 ===
const data = {
    name: "Generated Castle Gate",
    size: SIZE,
    blocks: blocks
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 0));
console.log(`JSON generated: ${OUTPUT_FILE}`);
