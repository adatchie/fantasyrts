# Building Texture Specification

## 概要

FANTASY RTSの建造物ブロックシステム用テクスチャ仕様。

現在は `CanvasTexture` を使用したプロシージャル生成方式を採用している。

## ファイル構成

```
scripts/
  ├── building.js              # マテリアル生成・適用
  └── building-textures.js     # テクスチャ生成クラス
```

## テクスチャ生成方式

### 現行方式: CanvasTexture (Procedural)

**利点:**
- 画像ファイル管理が不要
- 動的に色やパターンを調整可能
- ロード時間がゼロ

**欠点:**
- 複雑な表現には限界
- 色味が単調になりがち

### 将来の拡張案: 画像ベース

マップチップ方式（タイルベース）の画像ファイルを使用する方式への移行可能性あり。

## ブロックタイプ定義

| ID   | タイプ名      | 用途           | 現行テクスチャ概要                  |
|------|---------------|----------------|-----------------------------------|
| 0    | AIR           | 空気           | -                                 |
| 1    | STONE_WALL    | 石壁           | レンガ境界 + ノイズ                |
| 2    | STONE_FLOOR   | 石床           | 石畳パターン（オフセット行）         |
| 3    | WOOD_WALL     | 木造壁         | 板材境界 + 木目 + ランダムな節      |
| 4    | WOOD_FLOOR    | 木床           | 板床パターン + 木目                |
| 5    | ROOF_TILE     | 屋根瓦         | 鱗状瓦パターン                     |
| 6    | WOOD_DOOR     | 木のドア       | 枠 + 取っ手 + 板材模様              |
| 7    | WINDOW        | 窓             | 枠 + ガラス（水色） + 十字枠        |

## テクスチャパラメータ

```javascript
{
    textureSize: 128,        // キャンバスサイズ (px)
    magFilter: NearestFilter,  // ピクセルated（マップチップ風）
    minFilter: NearestFilter,
    wrapS: RepeatWrapping,   // タイリング可能
    wrapT: RepeatWrapping
}
```

## マテリアル設定

```javascript
{
    color: 0xffffff,         // テクスチャ使用時は白色ベース
    map: texture,            // CanvasTexture
    roughness: 0.8,
    metalness: 0.1
}
```

## BuildingTextureGenerator クラス

### メソッド

| メソッド名                    | 戻り値           | 説明                  |
|-------------------------------|------------------|----------------------|
| `createStoneWallTexture()`    | THREE.CanvasTexture | 石壁テクスチャ       |
| `createWoodWallTexture()`     | THREE.CanvasTexture | 木壁テクスチャ       |
| `createStoneFloorTexture()`   | THREE.CanvasTexture | 石床テクスチャ       |
| `createWoodFloorTexture()`    | THREE.CanvasTexture | 木床テクスチャ       |
| `createRoofTileTexture()`     | THREE.CanvasTexture | 屋根瓦テクスチャ     |
| `createDoorTexture()`         | THREE.CanvasTexture | ドアテクスチャ       |
| `createWindowTexture()`       | THREE.CanvasTexture | 窓テクスチャ        |
| `getTextureForBlockType(n)`   | THREE.CanvasTexture | タイプIDからテクスチャ取得 |
| `addNoise(ctx, size, str)`    | void             | ノイズ付加           |
| `clearCache()`                | void             | キャッシュクリア     |

### テクスチャキャッシュ

生成したテクスチャは `textureCache` オブジェクトにキャッシュされ、再利用される。

```javascript
const textureCache = {
    'stoneWall': CanvasTexture,
    'woodWall': CanvasTexture,
    // ...
};
```

## 色パレット（現行）

| タイプ       | 16進数   | 用途             |
|-------------|----------|------------------|
| Stone Wall  | #888888  | ベース + 境界    |
| Wood Wall   | #8B4513  | ベース + 木目    |
| Stone Floor | #666666  | ベース + 石畳    |
| Wood Floor  | #A0522D  | ベース + 板材    |
| Roof Tile   | #B22222  | ベース + 瓦      |
| Door        | #654321  | ベース + 枠      |
| Window      | #87CEEB  | ガラス色         |

## マップチップ方式の仕様（将来実装）

### ファイル構成

```
assets/textures/
  ├── blocks/
  │   ├── atlas.png              # アトラステクスチャ（推奨）
  │   └── individual/            # 個別ファイル（開発用）
  │       ├── stone_wall.png
  │       ├── wood_wall.png
  │       ├── stone_floor.png
  │       ├── wood_floor.png
  │       ├── roof_tile.png
  │       ├── door.png
  │       └── window.png
  └── normals/                   # 法線マップ（オプション）
      ├── atlas_n.png
      └── individual/
          ├── stone_wall_n.png
          └── ...

data/textures/
  └── block_texture_config.json  # テクスチャ設定ファイル
```

### テクスチャ仕様

#### 推奨: アトラステクスチャ方式

1枚の画像に全ブロックテクスチャをタイル配置し、UV座標で参照する。

```
atlas.png (512x512 推奨)
┌─────────┬─────────┬─────────┬─────────┐
│Stone    │Wood     │Stone    │Wood     │
│Wall     │Wall     │Floor    │Floor    │
│(0,0)    │(128,0)  │(256,0)  │(384,0)  │
├─────────┼─────────┼─────────┼─────────┤
│Roof     │Door     │Window   │(予備)   │
│Tile     │         │         │         │
│(0,128)  │(128,128)│(256,128)│(384,128)│
├─────────┼─────────┼─────────┼─────────┤
│...      │...      │...      │...      │
└─────────┴─────────┴─────────┴─────────┘

各チップサイズ: 128x128px (変更可能)
```

**利点:**
- ドローコール削減（マテリアル統合）
- メモリ効率が良い
- 一括ロードで管理が簡単

**実装例:**

```javascript
// building-textures.js (変更後)

export class BuildingTextureGenerator {
    constructor() {
        this.atlas = null;
        this.chipSize = 128;
        this.textureCache = {};
    }

    async loadAtlas() {
        const response = await fetch('assets/textures/blocks/atlas.png');
        const blob = await response.blob();
        const image = await createImageBitmap(blob);

        this.atlas = new THREE.Texture(image);
        this.atlas.magFilter = THREE.NearestFilter;
        this.atlas.minFilter = THREE.NearestFilter;
        this.atlas.needsUpdate = true;
    }

    getTextureForBlockType(blockType) {
        // UV座標マッピング
        const uvMap = {
            [BLOCK_TYPES.STONE_WALL]:  { u: 0, v: 0 },
            [BLOCK_TYPES.WOOD_WALL]:   { u: 1, v: 0 },
            [BLOCK_TYPES.STONE_FLOOR]: { u: 2, v: 0 },
            [BLOCK_TYPES.WOOD_FLOOR]:  { u: 3, v: 0 },
            [BLOCK_TYPES.ROOF_TILE]:   { u: 0, v: 1 },
            [BLOCK_TYPES.WOOD_DOOR]:   { u: 1, v: 1 },
            [BLOCK_TYPES.WINDOW]:      { u: 2, v: 1 },
        };

        const uv = uvMap[blockType];
        if (!uv || !this.atlas) return null;

        // アトラスから該当領域を参照するマテリアル
        // 実際にはUV変換が必要なため、後述の getAtlasUV を使用
        return this.createAtlasMaterial(uv.u, uv.v);
    }

    createAtlasMaterial(uIndex, vIndex) {
        // ジオメトリのUVをアトラスの該当領域に変換
        // これは各ブロックメッシュ生成時に適用
        return {
            map: this.atlas,
            atlasUV: {
                offsetX: uIndex * this.chipSize,
                offsetY: vIndex * this.chipSize,
                width: this.chipSize,
                height: this.chipSize,
                atlasWidth: this.atlas.image.width,
                atlasHeight: this.atlas.image.height
            }
        };
    }

    // アトラスUVを計算（ジオメトリ側で使用）
    static getAtlasUV(uIndex, vIndex, chipSize, atlasSize) {
        const u = uIndex * chipSize / atlasSize;
        const v = vIndex * chipSize / atlasSize;
        const size = chipSize / atlasSize;
        return {
            uMin: u,
            uMax: u + size,
            vMin: v,
            vMax: v + size
        };
    }
}
```

#### 個別ファイル方式（開発用・簡易版）

各ブロックタイプごとに独立した画像ファイル。

**実装例:**

```javascript
async loadTexture(type) {
    const paths = {
        [BLOCK_TYPES.STONE_WALL]: 'assets/textures/blocks/individual/stone_wall.png',
        [BLOCK_TYPES.WOOD_WALL]: 'assets/textures/blocks/individual/wood_wall.png',
        // ...
    };

    const path = paths[type];
    if (!path) return null;

    if (this.textureCache[path]) {
        return this.textureCache[path];
    }

    const texture = await this.loadTextureFromFile(path);
    this.textureCache[path] = texture;
    return texture;
}
```

### テクスチャ設定ファイル

`data/textures/block_texture_config.json`:

```json
{
    "version": 1,
    "format": "atlas",
    "atlasPath": "assets/textures/blocks/atlas.png",
    "chipSize": 128,
    "atlasSize": 512,
    "blocks": [
        {
            "id": 1,
            "name": "STONE_WALL",
            "atlasPosition": { "u": 0, "v": 0 },
            "variations": 1
        },
        {
            "id": 3,
            "name": "WOOD_WALL",
            "atlasPosition": { "u": 1, "v": 0 },
            "variations": 2,
            "variationPositions": [
                { "u": 1, "v": 0 },
                { "u": 1, "v": 1 }
            ]
        },
        {
            "id": 7,
            "name": "WINDOW",
            "atlasPosition": { "u": 2, "v": 1 },
            "emissive": true,
            "emissiveColor": "#87CEEB",
            "emissiveIntensity": 0.3
        }
    ]
}
```

### 画像仕様

| 項目       | 推奨値               | 説明                    |
|-----------|---------------------|-------------------------|
| 解像度     | 128x128px / チップ  | ピクセルatedなので2の累乗 |
| 色深度     | RGBA 8bit           | 透過対応                 |
| ファイル形式 | PNG                 | 可逆圧縮                 |
| 色プロファイル| sRGB                | Web標準                  |

### UVマッピングの変更

`building.js` のメッシュ生成部分でUVをアトラス座標に変換：

```javascript
// createBuildingMesh 内の変更例
const blockType = blocks[z][y][x];
if (blockType === BLOCK_TYPES.AIR) continue;

// テクスチャ情報を取得
const textureInfo = textureGenerator.getTextureForBlockType(blockType);
if (!textureInfo) continue;

// UV変換を適用したマテリアル/ジオメトリを使用
const material = this.materials[blockType];
const blockMesh = new THREE.Mesh(this.shearedBlockGeometry, material);

// UVをアトラス座標に変換（必要に応じて）
if (textureInfo.atlasUV) {
    this.applyAtlasUV(blockMesh.geometry, textureInfo.atlasUV);
}
```

### 移行手順

1. 画像ファイルの作成・配置
   - ペイントツールで各ブロックのマップチップを作成
   - `assets/textures/blocks/` に配置

2. アトラス画像の作成（推奨）
   - 個別チップを1枚画像に統合
   - `atlas.png` として保存

3. `block_texture_config.json` の作成
   - 各ブロックのアトラス座標を定義

4. `building-textures.js` の書き換え
   - CanvasTexture生成 → 画像ロードに変更

5. `building.js` の調整
   - 必要に応じてUVマッピング処理を追加

### バリエーション実装

同一ブロックタイプで複数パターンを使い分ける：

```javascript
// blocks[z][y][x] の値を拡張してバリエーションを表現
// 例: blockType = 3 (WOOD_WALL) の場合
//      3.0 = 通常, 3.1 = 変異1, 3.2 = 変異2

getTextureForBlockType(blockType) {
    const baseType = Math.floor(blockType);
    const variation = Math.round((blockType % 1) * 10);

    const config = this.config.blocks[baseType];
    if (config.variations > 1) {
        const pos = config.variationPositions[variation];
        return this.createAtlasMaterial(pos.u, pos.v);
    }
    return this.createAtlasMaterial(config.atlasPosition.u, config.atlasPosition.v);
}
```

### 開発用ツール（将来実装）

- **テクスチャプレビュー**: 各ブロックにテクスチャを適用して確認
- **アトラス生成ツール**: 個別チップからアトラスを自動生成
- **UVエディタ**: アトラス座標の視覚的編集

### 2. バリエーション追加

- 同タイプで複数パターン（石壁のバリエーション等）
- 汚れ・摩耗表現
- 季節による変化

### 3. 高度なマテリアル

- Normal Map：凹凸表現
- Roughness Map：光沢の変化
- Emissive Map：発光部分（窓の夜間表現等）

### 4. アトラス化

複数テクスチャを1枚の画像にまとめてドローコール削減。

## 依存関係

```
building.js
    └── imports → BuildingTextureGenerator (building-textures.js)
                 └── uses → THREE.CanvasTexture
```

## 更新履歴

| 日付       | 内容                         |
|------------|------------------------------|
| 2025-01-24 | 初版: CanvasTexture方式実装   |
