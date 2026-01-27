
const fs = require('fs');
const path = require('path');

// 設定 (5倍スケール: 50x50x30 -> 250x250x150)
const SCALE = 5;
const BASE_X = 50;
const BASE_Y = 50;
const BASE_Z = 30;

const SIZE = {
    x: BASE_X * SCALE,
    y: BASE_Y * SCALE,
    z: BASE_Z * SCALE
};

// JSONのサイズ制限を考慮し、出力先は同じディレクトリ
const OUTPUT_FILE = path.join(__dirname, '../../castle_gate_large.json');

// ブロックタイプ定義
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
// メモリ使用量が大きくなるため、疎なデータ構造や最適化が必要だが、
// ここでは単純な配列で試みる（Node.jsのメモリが足りるか注意）
// 250*250*150 = 9,375,000 要素。Int8Arrayなら9MB、JS配列だと数百MBいくかも。
// JSの配列はオブジェクトなので重い。
// Uint8Arrayのフラット配列を使って、JSONシリアライズ時に変換する方が良いかもしれないが
// 既存の読み込み側(building.js)が3次元配列を期待している。
// building.js: blocks[z][y][x]

// メモリ節約のため、Int8Arrayの3次元配列もどきにするか、
// 単純に生成してから圧縮する。
// とりあえず愚直にやってみる。

const blocks = [];
for (let z = 0; z < SIZE.z; z++) {
    blocks[z] = [];
    for (let y = 0; y < SIZE.y; y++) {
        // 全てAIR(0)で埋める代わりに、データがある行だけ確保するのは
        // JSON構造が変わるのでNG。
        // building-editor.jsの読み込みは:
        // this.blocks = data.blocks;
        // 固定サイズ配列を期待している。
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
    // 範囲チェックとクリッピング
    x1 = Math.max(0, x1); y1 = Math.max(0, y1); z1 = Math.max(0, z1);
    x2 = Math.min(SIZE.x - 1, x2); y2 = Math.min(SIZE.y - 1, y2); z2 = Math.min(SIZE.z - 1, z2);

    for (let z = z1; z <= z2; z++) {
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                blocks[z][y][x] = type;
            }
        }
    }
}

// === 生成ロジック (全てSCALE倍) ===

// 1. 地形・土台
// 手前の低いエリア: 0~49, 0~15, 0~2
fillRect(
    0 * SCALE, 0 * SCALE, 0 * SCALE,
    49 * SCALE + (SCALE - 1), 15 * SCALE + (SCALE - 1), 2 * SCALE + (SCALE - 1),
    BLOCK.STONE_FLOOR
);

// 中間の広場
// 土台: 0~49, 16~35, 0~5
fillRect(
    0 * SCALE, 16 * SCALE, 0 * SCALE,
    49 * SCALE + (SCALE - 1), 35 * SCALE + (SCALE - 1), 5 * SCALE + (SCALE - 1),
    BLOCK.STONE_WALL
);
// 床: 0~49, 16~35, 6
fillRect(
    0 * SCALE, 16 * SCALE, 6 * SCALE,
    49 * SCALE + (SCALE - 1), 35 * SCALE + (SCALE - 1), 6 * SCALE + (SCALE - 1),
    BLOCK.STONE_FLOOR
);

// 階段: 10~39, 12+i, 3+i (i=0..3)
for (let i = 0; i < 4; i++) {
    // 1段をSCALE段にする
    for (let s = 0; s < SCALE; s++) {
        // Yは奥へ進む、Zは上がる
        // 元の1段分を、SCALE倍の階段にするには...
        // 傾斜を維持するなら、YもZもSCALE倍の間で補間が必要だが、
        // ここでは単純にブロック状に拡大する。

        // 元の (y, z) が (12, 3), (13, 4)...
        // 拡大後: 
        // y範囲: (12+i)*SCALE ~ (12+i)*SCALE + SCALE - 1
        // z範囲: (3+i)*SCALE ~ (3+i)*SCALE + SCALE - 1

        const yStart = (12 + i) * SCALE;
        const zStart = (3 + i) * SCALE;

        // 階段状にするため、詳細にループ
        // ここは単純に直方体で埋めると急な坂になるが、SCALE倍なので段差もSCALE倍になる。
        // なだらかにするには、さらに内部でステップを作る必要がある。
        // が、リクエストは「スケールアップ」なので、そのまま拡大（巨人の階段）で良いか、
        // あるいは細かい階段にするか。
        // 文脈的に「城門が小さかった」ので、全体を大きくしたい。つまり巨人の階段でOK。

        fillRect(
            10 * SCALE, yStart, zStart,
            39 * SCALE + (SCALE - 1), yStart + (SCALE - 1), zStart + (SCALE - 1),
            BLOCK.STONE_FLOOR
        );
    }
    // いや、これだと結局同じことか fillRectで範囲指定すればよい
}


// 2. 城壁 (Main Wall)
const wallY = 32 * SCALE;
const wallHeightBase = 18;
const wallBaseZ = 6;
const wallZStart = wallBaseZ * SCALE;
const wallZEnd = (wallBaseZ + wallHeightBase) * SCALE + (SCALE - 1);
const wallThickness = 4 * SCALE;

// 左右の壁
// Left: 0~18
fillRect(0, wallY, wallZStart, 18 * SCALE + (SCALE - 1), wallY + wallThickness + (SCALE - 1), wallZEnd, BLOCK.STONE_WALL);

// Right: 32~49
fillRect(32 * SCALE, wallY, wallZStart, 49 * SCALE + (SCALE - 1), wallY + wallThickness + (SCALE - 1), wallZEnd, BLOCK.STONE_WALL);

// 壁の上部の凹凸 (クレネル)
// 元: x += 2 (1つ飛ばし) => SCALE倍だと 2*SCALE 飛ばし
for (let x = 0; x < 18; x += 2) {
    const xBase = x * SCALE;
    // ブロック幅もSCALE倍
    fillRect(xBase, wallY, wallZEnd + 1, xBase + SCALE - 1, wallY, wallZEnd + SCALE, BLOCK.STONE_WALL);
    fillRect(xBase, wallY + wallThickness, wallZEnd + 1, xBase + SCALE - 1, wallY + wallThickness, wallZEnd + SCALE, BLOCK.STONE_WALL);
    // 厚み方向の奥側も
}

for (let x = 32; x < 50; x += 2) {
    const xBase = x * SCALE;
    fillRect(xBase, wallY, wallZEnd + 1, xBase + SCALE - 1, wallY, wallZEnd + SCALE, BLOCK.STONE_WALL);
    fillRect(xBase, wallY + wallThickness, wallZEnd + 1, xBase + SCALE - 1, wallY + wallThickness, wallZEnd + SCALE, BLOCK.STONE_WALL);
}


// 3. 中央の門 (Gatehouse)
const gateXBase = 19;
const gateWidthBase = 12;
const gateHeightBase = 22;

const gateX = gateXBase * SCALE;
const gateWidth = gateWidthBase * SCALE; // -1 adjustment handled in fillRect range
const gateHeightZEnd = (wallBaseZ + gateHeightBase) * SCALE + (SCALE - 1);

// 本体
fillRect(
    gateX,
    wallY - 2 * SCALE,
    wallZStart,
    gateX + gateWidth + (SCALE - 1), // 19+12=31. 31*S + S-1
    wallY + wallThickness + 2 * SCALE + (SCALE - 1),
    gateHeightZEnd,
    BLOCK.STONE_WALL
);

// 開口部 (AIRで抜く)
// 元: gateX+4, wallY-3
const openingXStart = (gateXBase + 4) * SCALE;
const openingXEnd = (gateXBase + gateWidthBase - 4) * SCALE + (SCALE - 1);
const openingYStart = wallY - 3 * SCALE;
const openingYEnd = wallY + wallThickness + 3 * SCALE + (SCALE - 1);
const openingZMax = 14 * SCALE + (SCALE - 1);

fillRect(openingXStart, openingYStart, wallZStart, openingXEnd, openingYEnd, openingZMax, BLOCK.AIR);

// 門扉
const doorZMax = 13 * SCALE + (SCALE - 1);
const doorY = wallY + 1 * SCALE;
// 閉まっている状態
const doorXStart = (gateXBase + 5) * SCALE;
const doorXEnd = (gateXBase + gateWidthBase - 5) * SCALE + (SCALE - 1);

fillRect(doorXStart, doorY, wallZStart, doorXEnd, doorY + (SCALE - 1), doorZMax, BLOCK.WOOD_DOOR);

// 門の上部の凹凸
for (let xBase = gateXBase; xBase <= gateXBase + gateWidthBase; xBase += 2) {
    const x = xBase * SCALE;
    // 前面
    fillRect(x, wallY - 2 * SCALE, gateHeightZEnd + 1, x + SCALE - 1, wallY - 2 * SCALE + (SCALE - 1), gateHeightZEnd + SCALE, BLOCK.STONE_WALL);
    // 後面
    fillRect(x, wallY + wallThickness + 2 * SCALE, gateHeightZEnd + 1, x + SCALE - 1, wallY + wallThickness + 2 * SCALE + (SCALE - 1), gateHeightZEnd + SCALE, BLOCK.STONE_WALL);
}


// 4. 側塔
const towerSizeBase = 8;
const towerHeightBase = 26;
const towerSize = towerSizeBase * SCALE;
const towerHeightZEnd = (wallBaseZ + towerHeightBase) * SCALE + (SCALE - 1);

// 左塔
fillRect(
    0,
    wallY - 2 * SCALE,
    wallZStart,
    towerSize - 1 + (SCALE - 1), // towerSize * SCALE - 1 ではない。 grid的には fillRectの第4引数はinclusive
    // fillRectの仕様: x2まで塗る。
    // 元: 0 .. towerSize(8) つまり index 8 まで塗るなら幅9？
    // 元コード: fillRect(0, ..., towerSize, ...) 
    // 元の setBlock ループなら condition x <= x2 なので index 8 も含まれる
    // 0~8 => 幅9ブロック。
    // SCALE倍なら 0 ~ 8*SCALE + (SCALE-1)

    (towerSizeBase) * SCALE + (SCALE - 1),
    wallY + wallThickness + 2 * SCALE + (SCALE - 1),
    towerHeightZEnd,
    BLOCK.STONE_WALL
);

// 右塔
// 元: 49-towerSize (41) ~ 49
fillRect(
    (49 - towerSizeBase) * SCALE,
    wallY - 2 * SCALE,
    wallZStart,
    49 * SCALE + (SCALE - 1),
    wallY + wallThickness + 2 * SCALE + (SCALE - 1),
    towerHeightZEnd,
    BLOCK.STONE_WALL
);

// 窓
// setBlock(2, wallY, 15, BLOCK.WINDOW);
// 窓も大きくする
fillRect(
    2 * SCALE, wallY, 15 * SCALE,
    2 * SCALE + (SCALE - 1), wallY + (SCALE - 1), 15 * SCALE + (SCALE - 1),
    BLOCK.WINDOW
);
fillRect(
    (49 - 2) * SCALE, wallY, 15 * SCALE,
    (49 - 2) * SCALE + (SCALE - 1), wallY + (SCALE - 1), 15 * SCALE + (SCALE - 1),
    BLOCK.WINDOW
);


// 5. 手前の小さな防壁など
// 0~8, 16, 7~8 (height 1)
// z range 7~7 ? 元コード: z1=7, z2=8?? 元コード: fillRect(..., 7, ..., 8, ...) => z=7,8
const lowWallZStart = 7 * SCALE;
const lowWallZEnd = 8 * SCALE + (SCALE - 1);
const lowWallYStart = 16 * SCALE;
const lowWallYEnd = 16 * SCALE + (SCALE - 1);

fillRect(0, lowWallYStart, lowWallZStart, 8 * SCALE + (SCALE - 1), lowWallYEnd, lowWallZEnd, BLOCK.STONE_WALL);
fillRect(41 * SCALE, lowWallYStart, lowWallZStart, 49 * SCALE + (SCALE - 1), lowWallYEnd, lowWallZEnd, BLOCK.STONE_WALL);

// 篝火
// setBlock(15, 20, 7, BLOCK.WOOD_WALL);
fillRect(
    15 * SCALE, 20 * SCALE, 7 * SCALE,
    15 * SCALE + (SCALE - 1), 20 * SCALE + (SCALE - 1), 7 * SCALE + (SCALE - 1),
    BLOCK.WOOD_WALL
);
fillRect(
    34 * SCALE, 20 * SCALE, 7 * SCALE,
    34 * SCALE + (SCALE - 1), 20 * SCALE + (SCALE - 1), 7 * SCALE + (SCALE - 1),
    BLOCK.WOOD_WALL
);


// === JSON出力 ===
const data = {
    name: "Large Castle Gate",
    size: SIZE,
    blocks: blocks
};

// メモリ対策: JSON.stringifyが失敗する可能性があるため、Buffer分割などを検討するか、
// Node.jsのヒープを増やす必要があるかも。
// しかしこのサイズならギリギリいけるか。

try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data)); // 圧縮なし
    console.log(`JSON generated: ${OUTPUT_FILE}`);
} catch (e) {
    console.error("Failed to write JSON:", e);
}
