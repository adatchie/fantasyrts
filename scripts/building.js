/**
 * FANTASY RTS - Building System
 * ボクセルベースの建物システム
 */

import * as THREE from 'three';

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

// ブロックの色（テクスチャが用意されるまでの仮）
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
        console.log('[BuildingSystem] Constructor called');
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
            this.materials[typeId] = new THREE.MeshStandardMaterial({
                color: color,
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
            if (building.gridX === undefined || building.gridY === undefined) continue;

            // テンプレートからサイズを取得（回転は未実装のためrotation=0と仮定）
            // 将来的に rotation 対応が必要
            const template = building.template || BUILDING_TEMPLATES[building.templateId];
            if (!template) continue;

            // サイズ（グリッド単位換算）
            // template.size はブロック数。this.blockSize=8。
            // タイルサイズ=32? renderingのTILE_SIZEによるが...
            // placeBuildingAtGridでのfootprint計算を参照
            // const footprintX = Math.ceil(template.size.x * this.blockSize / 32);
            // 32は定数TILE_SIZEと仮定（constants.js読み込んでる？）
            // TILE_SIZEがインポートされていないので、building.js内では不明確。
            // しかし placeBuildingAtGrid のロジックと合わせるべき。

            const footprintX = Math.ceil(template.size.x * this.blockSize / 32);
            const footprintY = Math.ceil(template.size.y * this.blockSize / 32);

            // 建物の配置基準は左下（gridX, gridY）から、X正・Y負方向へ？
            // placeBuildingAtGridのループ:
            //   for (let dy = -offsetY; dy < footprintY - offsetY; dy++)
            //   getGroundHeight(gridX + dx, ...
            // これは「中心」基準で配置している。 gridXが中心。

            const offsetX = Math.floor(footprintX / 2);
            const offsetY = Math.floor(footprintY / 2); // Yは?

            // placeBuildingAtGridでは gridX が中心指定。
            // 範囲： [gridX - offsetX, gridX + footprintX - offsetX - 1]

            const minX = building.gridX - offsetX;
            const maxX = building.gridX + footprintX - offsetX - 1; // inclusive

            const minY = building.gridY - offsetY;
            const maxY = building.gridY + footprintY - offsetY - 1;

            if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                // ヒットした
                // 高さはブロック段数 * ブロック高さ * スケール？
                // レンダリングエンジンのスケールに合わせる必要がある。
                // unitsのyは worldPos.y。
                // 建物の天辺は building.position.y + height
                // height = template.size.z * this.blockSize

                // ただし、ユニットの足元座標系に合わせる。
                // ブロック高さ8、ユニット高さは？
                // 単純にジオメトリ高さを返す。
                const buildingHeightWorld = template.size.z * this.blockSize;

                // 建物のベース高さも考慮
                // (building.position.y はベース高さ)
                // return building.position.y + buildingHeightWorld;

                // しかし呼び出し元は getGroundHeight() + buildingHeight なので、
                // 地形からの相対高さ（追加分）を返すべきか？
                // rendering3d.js で mesh.position.y = hexHeight + offset している。
                // hexHeight は地形高さ。

                // もし建物が埋まっているなら、その分を引かないといけないが、
                // 簡略化して「建物の天辺の高さ - 地形高さ」を返したいが、地形高さは場所による。

                // ここでは「建物の厚み」を返すのが無難だが、
                // ユニットが「建物のベース高さ + 建物高さ」に乗るべき。
                // return (building.position.y + buildingHeightWorld) - 地形高さ(x,y) ?
                // 地形高さがわからないので、絶対高さ(Absolute Height)を返すAPIにするか？
                // あるいは、BuildingSystemとしては「この座標には建物（天辺Y=...）がある」と返す。

                return { isBuilding: true, height: building.position.y + buildingHeightWorld };
            }
        }
        return null;
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

        // グリッド座標からワールド座標を計算
        const worldPos = this.renderingEngine.gridToWorld3D(gridX, gridY, 0);

        // 建物フットプリント内の最低地形高さを計算（ユーザー指示に準拠）
        let minHeight = Infinity;
        const footprintX = Math.ceil(template.size.x * this.blockSize / 32); // グリッドタイル数（概算）
        const footprintY = Math.ceil(template.size.y * this.blockSize / 32);

        // フットプリントの中心を合わせるためのオフセット
        const offsetX = Math.floor(footprintX / 2);
        const offsetY = Math.floor(footprintY / 2);

        for (let dy = -offsetY; dy < footprintY - offsetY; dy++) {
            for (let dx = -offsetX; dx < footprintX - offsetX; dx++) {
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

        console.log(`[BuildingSystem] placeBuildingAtGrid: grid(${gridX}, ${gridY}), footprint: ${footprintX}x${footprintY}, minHeight: ${minHeight}`);

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

        console.log(`Building placed: ${template.name} at worldY=${baseY}`);
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

        // 各ブロックをメッシュとして追加
        for (let z = 0; z < size.z; z++) { // 高さ
            for (let y = 0; y < size.y; y++) { // 奥行き
                for (let x = 0; x < size.x; x++) { // 幅
                    const blockType = blocks[z][y][x];
                    if (blockType === BLOCK_TYPES.AIR) continue;

                    const material = this.materials[blockType];
                    if (!material) continue;

                    const blockMesh = new THREE.Mesh(this.shearedBlockGeometry, material);

                    // 建物のローカル座標系でのグリッド位置
                    // 中心を原点(0,0)とするように調整
                    const bx = x - size.x / 2 + 0.5;
                    const by = y - size.y / 2 + 0.5;

                    // アイソメトリック投影変換（rendering3d.gridToWorld3Dと同様のロジック）
                    // これにより建物もグリッドと同じ「歪んだ」座標系に乗る
                    const wx = (bx - by) * (this.blockSize / 2);
                    const wz = (bx + by) * (this.blockSize / 4);

                    // 高さはそのまま（ただしブロックの中心へ）
                    const wy = z * this.blockSize + this.blockSize / 2;

                    blockMesh.position.set(wx, wy, wz);

                    // ExtrudeGeometryはXY平面からZ方向への押し出しなので、
                    // これをXZ平面からY方向への立ち上がりに変換する
                    blockMesh.rotation.x = -Math.PI / 2;

                    blockMesh.castShadow = true;
                    blockMesh.receiveShadow = true;

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
        if (!this.renderingEngine) return null;

        // グリッド座標からワールド座標を計算
        const worldPos = this.renderingEngine.gridToWorld3D(gridX, gridY, 0);

        // 回転後のサイズを考慮
        const rotatedSize = rotation % 2 === 0 ? customData.size : { x: customData.size.y, y: customData.size.x, z: customData.size.z };

        // 地形高さ計算（templateと同じロジック）
        let minHeight = Infinity;
        const footprintX = Math.ceil(rotatedSize.x * this.blockSize / 32);
        const footprintY = Math.ceil(rotatedSize.y * this.blockSize / 32);
        const offsetX = Math.floor(footprintX / 2);
        const offsetY = Math.floor(footprintY / 2);

        for (let dy = -offsetY; dy < footprintY - offsetY; dy++) {
            for (let dx = -offsetX; dx < footprintX - offsetX; dx++) {
                const height = this.renderingEngine.getGroundHeight(gridX + dx, gridY + dy);
                if (height < minHeight) minHeight = height;
            }
        }
        if (minHeight === Infinity) minHeight = this.renderingEngine.getGroundHeight(gridX, gridY);

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
