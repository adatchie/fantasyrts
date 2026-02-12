/**
 * FANTASY RTS - Building System
 * ボクセルベースの建物システム
 */

import * as THREE from 'three';
import { TILE_SIZE, TILE_HEIGHT } from './constants.js';
import { textureGenerator } from './building-textures.js';

// ブロックタイプ定義
export const BLOCK_TYPES = {
    AIR: 0,
    STONE_WALL: 1,      // 石壁
    STONE_FLOOR: 2,     // 石床
    WOOD_WALL: 3,       // 木造壁
    WOOD_FLOOR: 4,      // 木床
    ROOF_TILE: 5,       // 屋根瓦
    WOOD_DOOR: 6,       // 木のドア
    WINDOW: 7,          // 窓
};

// ブロックの色（フォールバック用）
export const BLOCK_COLORS = {
    [BLOCK_TYPES.STONE_WALL]: 0x888888,
    [BLOCK_TYPES.STONE_FLOOR]: 0x666666,
    [BLOCK_TYPES.WOOD_WALL]: 0x8B4513,
    [BLOCK_TYPES.WOOD_FLOOR]: 0xA0522D,
    [BLOCK_TYPES.ROOF_TILE]: 0xB22222,
    [BLOCK_TYPES.WOOD_DOOR]: 0x654321,
    [BLOCK_TYPES.WINDOW]: 0x87CEEB,
};

/**
 * 建物テンプレート
 * blocks配列: [z][y][x] の3次元配列
 */
export const BUILDING_TEMPLATES = {
    'house_small': {
        name: '民家（小）',
        size: { x: 5, y: 5, z: 4 },
        // z=0: 床, z=1-2: 壁, z=3: 屋根
        blocks: generateSmallHouse()
    }
};

/**
 * 小さな民家のブロック配列を生成
 */
function generateSmallHouse() {
    const W = BLOCK_TYPES.WOOD_WALL;
    const F = BLOCK_TYPES.WOOD_FLOOR;
    const R = BLOCK_TYPES.ROOF_TILE;
    const D = BLOCK_TYPES.WOOD_DOOR;
    const N = BLOCK_TYPES.WINDOW;
    const _ = BLOCK_TYPES.AIR;

    // z=0: 床
    const floor = [
        [F, F, F, F, F],
        [F, F, F, F, F],
        [F, F, F, F, F],
        [F, F, F, F, F],
        [F, F, F, F, F],
    ];

    // z=1: 1階壁（前面にドア）
    const wall1 = [
        [W, W, D, W, W],
        [W, _, _, _, W],
        [W, _, _, _, W],
        [W, _, _, _, W],
        [W, W, N, W, W],
    ];

    // z=2: 2階壁
    const wall2 = [
        [W, W, W, W, W],
        [W, _, _, _, W],
        [W, _, _, _, W],
        [W, _, _, _, W],
        [W, W, N, W, W],
    ];

    // z=3: 屋根
    const roof = [
        [R, R, R, R, R],
        [R, R, R, R, R],
        [R, R, R, R, R],
        [R, R, R, R, R],
        [R, R, R, R, R],
    ];

    return [floor, wall1, wall2, roof];
}

/**
 * 建物システムクラス
 */
export class BuildingSystem {
    constructor(scene, renderingEngine) {
        this.scene = scene;
        this.renderingEngine = renderingEngine; // レンダリングエンジンへの参照（座標変換用）
        this.buildingGroup = new THREE.Group();
        this.buildingGroup.name = 'buildings';
        this.scene.add(this.buildingGroup);

        // 配置された建物リスト
        this.buildings = [];

        // 保存用：配置済み建物データ
        this.placedBuildings = [];

        // ブロックサイズ（ワールド座標）
        this.blockSize = 8.0;

        // マテリアルキャッシュ
        this.materials = {};
        this.initMaterials();
    }

    /**
     * 配置済み建物データを取得（保存用）
     */
    getPlacedBuildingsData() {
        return this.placedBuildings;
    }

    /**
     * 3次元ブロック配列を回転（90度単位）
     * @param {Array} blocks - blocks[z][y][x]
     * @param {Object} size - {x, y, z}
     * @param {number} rotation - 0,1,2,3 (90度刻み)
     */
    rotateBlocks(blocks, size, rotation) {
        if (rotation === 0) return { blocks, size };

        let currentBlocks = blocks;
        let currentSize = { ...size };

        for (let r = 0; r < rotation; r++) {
            const newSize = { x: currentSize.y, y: currentSize.x, z: currentSize.z };
            const newBlocks = [];

            for (let z = 0; z < newSize.z; z++) {
                newBlocks[z] = [];
                for (let y = 0; y < newSize.y; y++) {
                    newBlocks[z][y] = [];
                    for (let x = 0; x < newSize.x; x++) {
                        // 90度時計回り: new(x,y) = old(size.y-1-y, x)
                        const oldX = currentSize.x - 1 - y;
                        const oldY = x;
                        newBlocks[z][y][x] = currentBlocks[z][oldY][oldX];
                    }
                }
            }
            currentBlocks = newBlocks;
            currentSize = newSize;
        }

        return { blocks: currentBlocks, size: currentSize };
    }

    /**
     * マテリアルを初期化
     */
    initMaterials() {
        for (const [typeId, color] of Object.entries(BLOCK_COLORS)) {
            const texture = textureGenerator.getTextureForBlockType(parseInt(typeId));

            this.materials[typeId] = new THREE.MeshStandardMaterial({
                color: texture ? 0xffffff : color,  // テクスチャ使用時は白色ベース
                map: texture || undefined,
                roughness: 0.8,
                metalness: 0.1,
            });
        }
    }

    /**
     * 指定座標の建物の高さを取得（ユニット配置用）
     * @param {number} x グリッドX
     * @param {number} y グリッドY
     * @returns {number} 建物の高さ（y座標オフセット）
     */
    getBuildingHeight(x, y) {
        for (const building of this.buildings) {
            // gridX, gridY が設定されていない場合はスキップ
            if (building.gridX === undefined || building.gridY === undefined) {
                continue;
            }

            const template = building.template || BUILDING_TEMPLATES[building.templateId];
            if (!template) continue;

            const blockSize = template.blockSize || this.blockSize;
            const origSizeX = building.customData ? building.customData.size.x : template.size.x;
            const origSizeY = building.customData ? building.customData.size.y : template.size.y;
            const footprintX = Math.ceil(origSizeX * blockSize / TILE_SIZE);
            const footprintY = Math.ceil(origSizeY * blockSize / TILE_SIZE);

            const minX = building.gridX;
            const maxX = building.gridX + footprintX - 1;
            const minY = building.gridY;
            const maxY = building.gridY + footprintY - 1;

            // 通常のグリッド座標チェック
            let inFootprint = (x >= minX && x <= maxX && y >= minY && y <= maxY);

            // 建物がマップの大部分を覆う場合（城砦マップ等）、デプロイメントゾーンは
            // 建物のブロック座標（0-49）として扱われる可能性がある
            // 例：50x50ブロックの建物が50x50マップ全体にある場合
            let useDirectBlockCoords = false;
            if (!inFootprint && x < origSizeX && y < origSizeY) {
                // グリッド座標が建物のブロックサイズ範囲内にある場合は、
                // 直接ブロック座標として扱う
                useDirectBlockCoords = true;
            }

            if (inFootprint || useDirectBlockCoords) {
                // ヒットした - その位置での実際の最高ブロックを探す

                // 回転を考慮してブロック座標を計算
                const rotation = building.rotation || 0;

                // 回転を無視するかどうかの判定
                // カスタム建物でfootprintが実サイズと一致する場合は回転を無視
                // （マップエディタで設定された座標をそのまま使用）
                const ignoreRotation = (footprintX === origSizeX && footprintY === origSizeY);

                // グリッド単位からブロック単位への変換係数
                // footprintX = Math.ceil(origSizeX * blockSize / TILE_SIZE) なので
                // 1グリッドあたりのブロック数 = origSizeX / footprintX
                const xScale = origSizeX / footprintX;
                const yScale = origSizeY / footprintY;

                // グリッド単位のローカル座標からブロック配列インデックスを計算
                let blockX, blockY;

                if (useDirectBlockCoords || ignoreRotation) {
                    // 回転を適用せずに直接ブロック座標として扱う
                    // （城砦マップ等で、デプロイメントゾーンがブロック配列の座標と一致する場合）
                    const localX = x - building.gridX;
                    const localY = y - building.gridY;
                    const blockLocalX = Math.floor(localX * xScale);
                    const blockLocalY = Math.floor(localY * yScale);
                    blockX = blockLocalX;
                    blockY = blockLocalY;
                } else {
                    // 通常のグリッド座標からブロック座標への変換
                    const localX = x - building.gridX;
                    const localY = y - building.gridY;
                    const blockLocalX = Math.floor(localX * xScale);
                    const blockLocalY = Math.floor(localY * yScale);

                    switch (rotation) {
                        case 0: blockX = blockLocalX; blockY = blockLocalY; break;
                        case 1: blockX = blockLocalY; blockY = origSizeX - 1 - blockLocalX; break;
                        case 2: blockX = origSizeX - 1 - blockLocalX; blockY = origSizeY - 1 - blockLocalY; break;
                        case 3: blockX = origSizeY - 1 - blockLocalY; blockY = blockLocalX; break;
                        default: blockX = blockLocalX; blockY = blockLocalY;
                    }
                }

                // その位置の最高ブロックのZ値を探す
                let maxZ = -1;
                if (template.blocks) {
                    for (let z = 0; z < template.size.z; z++) {
                        if (template.blocks[z] &&
                            template.blocks[z][Math.floor(blockY)] &&
                            template.blocks[z][Math.floor(blockY)][Math.floor(blockX)] !== undefined &&
                            template.blocks[z][Math.floor(blockY)][Math.floor(blockX)] !== 0) {
                            maxZ = z;
                        }
                    }
                }

                if (maxZ >= 0) {
                    // 最高ブロックの上面の高さ = baseY + (maxZ + 1) * blockSize
                    const buildingHeightWorld = (maxZ + 1) * blockSize;
                    const result = { isBuilding: true, height: building.position.y + buildingHeightWorld };
                    return result;
                }

                return null;
            }
        }
        return null;
    }

    /**
     * ワールド座標を指定して、その正確な位置にある建物の高さを取得
     * @param {number} worldX ワールドX座標
     * @param {number} worldZ ワールドZ座標
     * @returns {{isBuilding: boolean, height: number, buildingId: number}|null}
     */
    getBuildingHeightAtWorldPos(worldX, worldZ) {
        for (const building of this.buildings) {
            // バウンディングボックスチェック（簡易）
            // まずは建物の位置を取得
            const bx = building.position.x;
            const bz = building.position.z;

            // テンプレート情報を取得
            const template = building.template || BUILDING_TEMPLATES[building.templateId];
            if (!template) continue;

            const blockSize = template.blockSize || this.blockSize;

            // 建物のサイズ（ワールド座標系での幅・奥行）
            // ブロック数 * ブロックサイズ
            // アイソメトリック変換後の座標系に合わせる必要がある
            // rendering3d.blockMesh生成時のロジック:
            // wx = (bx - by) * (blockSize / 2)
            // wz = (bx + by) * (blockSize / 4)
            // これは中心基準。
            // 逆に worldX, worldZ から bx, by (ブロックインデックス) を求めたい。

            // worldX = (bx - by) * HW
            // worldZ = (bx + by) * HH
            // worldX / HW = bx - by
            // worldZ / HH = bx + by
            // (worldX/HW + worldZ/HH) / 2 = bx
            // (worldZ/HH - worldX/HW) / 2 = by

            // 建物グループの逆変換を行う
            // 建物グループの位置 (building.position) を引く
            const localWx = worldX - building.position.x;
            const localWz = worldZ - building.position.z;

            const HW = blockSize / 2;
            const HH = blockSize / 4;

            let bxCalculated = (localWx / HW + localWz / HH) / 2;
            let byCalculated = (localWz / HH - localWx / HW) / 2;

            // createBuildingMeshでは:
            // bx = x - size.x / 2 + 0.5
            // by = y - size.y / 2 + 0.5
            // なので、x, y (ブロックインデックス 0..size-1) に戻すには:
            // x = bxCalculated + size.x / 2 - 0.5
            // y = byCalculated + size.y / 2 - 0.5

            const sizeX = building.customData ? building.customData.size.x : template.size.x;
            const sizeY = building.customData ? building.customData.size.y : template.size.y;

            const rawBlockX = bxCalculated + sizeX / 2 - 0.5;
            const rawBlockY = byCalculated + sizeY / 2 - 0.5;

            // 整数座標（ブロックインデックス）
            const blockX = Math.round(rawBlockX);
            const blockY = Math.round(rawBlockY);

            // 範囲チェック
            if (blockX >= 0 && blockX < sizeX && blockY >= 0 && blockY < sizeY) {
                // ブロックが存在するかチェック
                // 回転を考慮
                const rotation = building.rotation || 0;
                let refBlockX, refBlockY;

                // ブロック配列へのアクセスのための座標変換（回転逆変換ではない、データ構造上の回転対応）
                // テンプレートデータは回転していない状態の配列
                // 上記のblockX/Yは「表示上の配置位置」から逆算したもの＝回転後の配置における位置
                // なので、テンプレート配列を読むには回転を考慮して元の座標に戻す必要がある

                // rotation=0: 表示x = 配列x, 表示y = 配列y
                // rotation=1: 表示x = 配列y, 表示y = size.x - 1 - 配列x
                // ... 複雑なので、blockX/Yが「配置された状態でのローカルXY」であることを利用して、
                // テンプレート側を回転させるか、インデックスを変換するか。

                // createBuildingMeshのロジックを再確認すると:
                // bx, by はループ変数 x, y (テンプレート配列のインデックス) から計算されている。
                // つまり、blockMeshの位置決定において x, y が使われている。
                // したがって、上で逆算した blockX, blockY は、そのままテンプレート配列のインデックス(x, y)に対応するはず。
                // ただし、blocks自体が rotateBlocks で回転済みであれば直アクセスでOK。
                // 実装を見る限り、rotateBlocks は使われておらず、createBuildingMesh 内では回転ロジックが見当たらない。
                // しかし getBuildingHeight では switch文で回転考慮している。
                // どうやら「メッシュ生成時は回転していない」か「グループ全体を回転させている」か？
                // createBuildingMesh の最後: group.rotation.y = 0;
                // ということは、メッシュ生成時にブロック位置を回転させて配置しているか？
                // いや、createBuildingMeshを見ると、単純に x, y ループで mesh を配置しているだけ。
                // つまり、建物自体の回転は「template.blocks自体を回転させておいてから渡す」か、
                // 「group.rotation」を使うかのどちらか。
                // コードの348行目で building オブジェクト生成時、buildingMesh を add している。
                // placeBuilding 内で createBuildingMesh を呼んでいる。

                // ここで重要なのは、getBuildingHeight の switch文。
                // case 0: blockX = localX...
                // これは「グリッド座標」からの変換。

                // createBuildingMesh では単純に blocks[z][y][x] で配置している。
                // つまり「描画されているブロック」は blocks 配列の配置そのまま。
                // なので、逆算した blockX, blockY は blocks 配列の x, y そのもののはず。
                // ただし、四捨五入の誤差や 0.5 オフセットに注意。

                let maxZ = -1;
                if (template.blocks) {
                    for (let z = 0; z < template.size.z; z++) {
                        if (template.blocks[z] &&
                            template.blocks[z][blockY] &&
                            template.blocks[z][blockY][blockX] !== undefined &&
                            template.blocks[z][blockY][blockX] !== 0) {
                            maxZ = z;
                        }
                    }
                }

                if (maxZ >= 0) {
                    // 最高ブロックの上面の高さ = baseY + (maxZ + 1) * blockSize
                    const buildingHeightWorld = (maxZ + 1) * blockSize;
                    // 地形の高さ(baseY) + ブロック高さ
                    return { isBuilding: true, height: building.position.y + buildingHeightWorld, buildingId: building.id };
                }
            }
        }
        return null;
    }

    /**
     * 指定座標の建物の高さレベル（地形z相当）を取得
     * @param {number} x グリッドX
     * @param {number} y グリッドY
     * @returns {number} 建物の高さレベル (0 if no building)
     */
    getBuildingLevel(x, y) {
        const heightInfo = this.getBuildingHeight(x, y);
        if (heightInfo && heightInfo.isBuilding) {
            // ワールド高さを地形高さ(16)で割ってレベルに換算
            // 例: block(8)*3 = 24. 24/16 = 1.5 -> ceil(1.5) = 2
            // getLevel called
            return Math.ceil(heightInfo.height / TILE_HEIGHT);
        }
        return 0;
    }

    /**
     * グリッド座標を指定して建物を配置（推奨API）
     * レンダリングエンジンを使って座標と高さを自動計算
     * 建物フットプリント内の最低地形高さに配置
     * @param {string} templateId - テンプレートID
     * @param {number} gridX - グリッドX座標（建物の左下）
     * @param {number} gridY - グリッドY座標（建物の左下）
     */
    placeBuildingAtGrid(templateId, gridX, gridY) {
        if (!this.renderingEngine) {
            console.error('[BuildingSystem] renderingEngine not set');
            return null;
        }

        const template = BUILDING_TEMPLATES[templateId];
        if (!template) {
            console.error(`Building template not found: ${templateId}`);
            return null;
        }

        const blockSize = template.blockSize || this.blockSize;
        const footprintX = Math.ceil(template.size.x * blockSize / TILE_SIZE); // グリッドタイル数
        const footprintY = Math.ceil(template.size.y * blockSize / TILE_SIZE);

        // 指定された gridX, gridY を「配置矩形の左上のタイル」とする
        // 建物の中心座標（論理的な中心）を計算
        // 1x1なら (gridX, gridY) が中心
        // 2x2なら (gridX + 0.5, gridY + 0.5) が中心
        const centerX = gridX + (footprintX - 1) / 2;
        const centerY = gridY + (footprintY - 1) / 2;

        // グリッド座標からワールド座標を計算（中心位置）
        const worldPos = this.renderingEngine.gridToWorld3D(centerX, centerY, 0);

        // 建物フットプリント内の最低地形高さを計算（ユーザー指示に準拠）
        let minHeight = Infinity;

        // 高さ判定用のループ範囲（gridX, gridY から footprint 分だけ回す）
        for (let dy = 0; dy < footprintY; dy++) {
            for (let dx = 0; dx < footprintX; dx++) {
                const height = this.renderingEngine.getGroundHeight(gridX + dx, gridY + dy);
                if (height < minHeight) {
                    minHeight = height;
                }
            }
        }

        // 最低高さが見つからない場合は中心点の高さを使用
        if (minHeight === Infinity) {
            minHeight = this.renderingEngine.getGroundHeight(gridX, gridY);
        }

        // placeBuildingAtGrid called

        const building = this.placeBuilding(templateId, worldPos.x, worldPos.z, minHeight);

        // グリッド座標を記録（高さ判定用）
        if (building) {
            building.gridX = gridX;
            building.gridY = gridY;
            building.template = template; // テンプレート参照も保持
        }

        return building;
    }

    /**
     * 建物を配置（ワールド座標直接指定版）
     * @param {string} templateId - テンプレートID
     * @param {number} worldX - ワールドX座標
     * @param {number} worldZ - ワールドZ座標
     * @param {number} baseY - ベースの高さ（地形の高さ）
     */
    placeBuilding(templateId, worldX, worldZ, baseY = 0) {
        const template = BUILDING_TEMPLATES[templateId];
        if (!template) {
            console.error(`Building template not found: ${templateId}`);
            return null;
        }

        const buildingMesh = this.createBuildingMesh(template, worldX, worldZ, baseY);
        this.buildingGroup.add(buildingMesh);

        const building = {
            id: this.buildings.length,
            templateId,
            gridPosition: null, // グリッド座標版で設定される
            position: { x: worldX, y: baseY, z: worldZ },
            mesh: buildingMesh
        };
        this.buildings.push(building);

        return building;
    }

    /**
     * 建物メッシュを生成
     */
    createBuildingMesh(template, worldX, worldZ, baseY) {
        const group = new THREE.Group();
        group.name = `building_${template.name}`;

        const { blocks, size } = template;

        // 歪んだブロックジオメトリを作成（グリッドの菱形に合わせる）
        // rendering3d.gridToWorld3Dと同じ比率で変形
        if (!this.shearedBlockGeometry) {
            const shape = new THREE.Shape();
            const hw = this.blockSize / 2;     // 半幅
            const hh = this.blockSize / 4;     // 半高（奥行き）

            // 菱形（中心基準）- アイソメトリックグリッドの1マス形状
            shape.moveTo(0, -hh);
            shape.lineTo(hw, 0);
            shape.lineTo(0, hh);
            shape.lineTo(-hw, 0);
            shape.closePath();

            const extrudeSettings = {
                depth: this.blockSize, // 高さ（Y方向へ向かうZ）
                bevelEnabled: false
            };
            this.shearedBlockGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

            // 重心を中心に合わせるためのオフセット（高さ方向）
            this.shearedBlockGeometry.translate(0, 0, -this.blockSize / 2);
        }

        // --- キャッシュ: UV書き換え済みジオメトリ（tileX,tileZ の組み合わせ = 最大16パターン） ---
        const blocksPerGrid = Math.round(TILE_SIZE / (template.blockSize || this.blockSize));
        if (!this._uvGeometryCache) this._uvGeometryCache = {};
        const baseMat = this.materials[BLOCK_TYPES.STONE_WALL];
        const hasTexture = baseMat && baseMat.map;

        if (hasTexture) {
            const hw = this.blockSize / 2;
            const hh = this.blockSize / 4;
            for (let tx = 0; tx < blocksPerGrid; tx++) {
                for (let tz = 0; tz < blocksPerGrid; tz++) {
                    const key = `${tx}_${tz}`;
                    if (this._uvGeometryCache[key]) continue;
                    const geom = this.shearedBlockGeometry.clone();
                    const uvAttr = geom.getAttribute('uv');
                    for (let i = 0; i < uvAttr.count; i++) {
                        const u = uvAttr.getX(i);
                        const v = uvAttr.getY(i);
                        const nu = (u + hw) / (2 * hw);
                        const nv = (v + hh) / (2 * hh);
                        uvAttr.setXY(i, (tx + nu) / blocksPerGrid, (tz + nv) / blocksPerGrid);
                    }
                    uvAttr.needsUpdate = true;
                    this._uvGeometryCache[key] = geom;
                }
            }
        }

        // --- キャッシュ: 色バリエーション用マテリアル（グリッド座標のハッシュ） ---
        if (!this._stoneMatCache) this._stoneMatCache = {};

        // 各ブロックをメッシュとして追加
        for (let z = 0; z < size.z; z++) { // 高さ
            for (let y = 0; y < size.y; y++) { // 奥行き
                for (let x = 0; x < size.x; x++) { // 幅
                    const blockType = blocks[z][y][x];
                    if (blockType === BLOCK_TYPES.AIR) continue;

                    let material = this.materials[blockType];
                    if (!material) continue;

                    // 石壁ブロック: キャッシュ済みジオメトリ＆マテリアルを使用
                    let blockGeometry = this.shearedBlockGeometry;
                    if (blockType === BLOCK_TYPES.STONE_WALL) {
                        // UV書き換え済みジオメトリをキャッシュから取得
                        if (hasTexture) {
                            const tileX = ((x % blocksPerGrid) + blocksPerGrid) % blocksPerGrid;
                            const tileZ = ((z % blocksPerGrid) + blocksPerGrid) % blocksPerGrid;
                            blockGeometry = this._uvGeometryCache[`${tileX}_${tileZ}`];
                        }

                        // 色バリエーション（グリッド単位）をキャッシュ
                        const gridX = Math.floor(x / blocksPerGrid);
                        const gridY = Math.floor(y / blocksPerGrid);
                        const gridZ = Math.floor(z / blocksPerGrid);
                        const hash = (gridX * 73856093 + gridY * 19349663 + gridZ * 83492791) & 0xFFFF;
                        const matKey = `stone_${hash}`;
                        
                        if (!this._stoneMatCache[matKey]) {
                            const brightness = 0.85 + (hash % 100) / 100 * 0.3;
                            const hueShift = ((hash >> 4) % 20 - 10) / 360;
                            const baseColor = new THREE.Color(hasTexture ? 0xffffff : 0x888888);
                            baseColor.multiplyScalar(brightness);
                            const r = baseColor.r + hueShift * 0.5;
                            const g = baseColor.g;
                            const b = baseColor.b - hueShift * 0.5;
                            const mat = baseMat.clone();
                            mat.color.setRGB(
                                Math.max(0, Math.min(1, r)),
                                Math.max(0, Math.min(1, g)),
                                Math.max(0, Math.min(1, b))
                            );
                            this._stoneMatCache[matKey] = mat;
                        }
                        material = this._stoneMatCache[matKey];
                    }
                    const blockMesh = new THREE.Mesh(blockGeometry, material);

                    // 建物のローカル座標系でのグリッド位置
                    // 中心を原点(0,0)とするように調整
                    const bx = x - size.x / 2 + 0.5;
                    const by = y - size.y / 2 + 0.5;

                    // ブロック固有のサイズ（template.blockSize優先）
                    const currentBlockSize = template.blockSize || this.blockSize;
                    const scale = currentBlockSize / this.blockSize;

                    // アイソメトリック投影変換（rendering3d.gridToWorld3Dと同様のロジック）
                    // これにより建物もグリッドと同じ「歪んだ」座標系に乗る
                    // createBuildingMeshのExtrudeGeometryはthis.blockSize(8)で作られているので、scale倍する

                    const wx = (bx - by) * (currentBlockSize / 2);
                    const wz = (bx + by) * (currentBlockSize / 4);

                    // 高さ計算（エディター仕様に準拠: wy = bz * blockSize）
                    const blockHeight = currentBlockSize;
                    const wy = z * blockHeight + blockHeight / 2;

                    blockMesh.position.set(wx, wy, wz);

                    // メッシュ自体のスケール調整（8 -> currentBlockSize）
                    // エディタと同じスケールを使用（高さ方向も同じ）
                    blockMesh.scale.set(scale, scale, scale);

                    // ExtrudeGeometryはXY平面からZ方向への押し出しなので、
                    // これをXZ平面からY方向への立ち上がりに変換する
                    blockMesh.rotation.x = -Math.PI / 2;

                    blockMesh.castShadow = true;
                    blockMesh.receiveShadow = true;
                    blockMesh.frustumCulled = false; // カメラ位置による誤カリングを防止

                    group.add(blockMesh);
                }
            }
        }

        // グループの位置を設定
        group.position.set(worldX, baseY, worldZ);

        // クォータービュー特有の回転補正は不要になる（形状自体が歪んでいるため）
        group.rotation.y = 0;

        return group;
    }

    /**
     * すべての建物を削除
     */
    clearBuildings() {
        while (this.buildingGroup.children.length > 0) {
            const child = this.buildingGroup.children[0];
            this.buildingGroup.remove(child);
            // 子メッシュのジオメトリ/マテリアルはキャッシュしているので破棄しない
        }
        this.buildings = [];
    }

    /**
     * 建物をIDで取得
     */
    getBuilding(id) {
        return this.buildings.find(b => b.id === id);
    }

    /**
     * カスタムデータから建物を配置（エディタ用）
     * @param {Object} customData - {size, blocks}
     * @param {number} gridX
     * @param {number} gridY
     * @param {number} rotation - 0,1,2,3 (90度刻み)
     */
    placeCustomBuildingAtGrid(customData, gridX, gridY, rotation = 0) {
        if (!this.renderingEngine) {
            return null;
        }

        // 回転後のサイズを考慮
        const rotatedSize = rotation % 2 === 0 ? customData.size : { x: customData.size.y, y: customData.size.x, z: customData.size.z };

        // マップエディタは建物の左上角座標を保存する
        // ゲームでは中心座標として配置するため、建物サイズの半分をオフセットとして加算
        // 注: マップエディタの1ブロック = 1グリッドセル として計算
        const centerGridX = gridX + rotatedSize.x / 2;
        const centerGridY = gridY + rotatedSize.y / 2;

        // グリッド座標からワールド座標を計算
        const worldPos = this.renderingEngine.gridToWorld3D(centerGridX, centerGridY, 0);

        // 地形高さ計算（templateと同じロジック）
        let minHeight = Infinity;
        const blockSize = customData.blockSize || this.blockSize;
        const footprintX = Math.ceil(rotatedSize.x * blockSize / TILE_SIZE);
        const footprintY = Math.ceil(rotatedSize.y * blockSize / TILE_SIZE);
        const offsetX = Math.floor(footprintX / 2);
        const offsetY = Math.floor(footprintY / 2);

        for (let dy = -offsetY; dy < footprintY - offsetY; dy++) {
            for (let dx = -offsetX; dx < footprintX - offsetX; dx++) {
                const height = this.renderingEngine.getGroundHeight(Math.round(centerGridX) + dx, Math.round(centerGridY) + dy);
                if (height < minHeight) minHeight = height;
            }
        }
        if (minHeight === Infinity) minHeight = this.renderingEngine.getGroundHeight(Math.round(centerGridX), Math.round(centerGridY));

        return this.placeCustomBuilding(customData, worldPos.x, worldPos.z, minHeight, gridX, gridY, rotation);
    }

    /**
     * カスタム建物を配置（メイン実装）
     */
    placeCustomBuilding(customData, worldX, worldZ, baseY, gridX, gridY, rotation = 0) {
        // 回転適用
        const { blocks, size } = this.rotateBlocks(customData.blocks, customData.size, rotation);
        const rotatedData = { ...customData, blocks, size };

        // createBuildingMeshはtemplateオブジェクト(size, blocksを持つ)を受け取るのでそのまま渡せる
        const buildingMesh = this.createBuildingMesh({ name: "Custom", ...rotatedData }, worldX, worldZ, baseY);
        this.buildingGroup.add(buildingMesh);

        const building = {
            id: this.buildings.length,
            templateId: 'custom',
            customData: customData,
            template: rotatedData, // getBuildingHeight用にテンプレートを保存
            gridX: gridX,          // getBuildingHeight用にグリッド座標を保存
            gridY: gridY,
            rotation: rotation,
            position: { x: worldX, y: baseY, z: worldZ },
            mesh: buildingMesh
        };
        this.buildings.push(building);

        // 保存用データに追加
        if (gridX !== undefined && gridY !== undefined) {
            this.placedBuildings.push({
                name: customData.name || 'Custom Building',
                gridX,
                gridY,
                rotation,
                templateData: customData // 元のデータを保存（回転前）
            });
        }

        return building;
    }
}
