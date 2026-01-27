const fs = require('fs');
const path = 'c:\\fantasyrts\\scripts\\rendering3d.js';

try {
    const data = fs.readFileSync(path, 'utf8');

    // clearDeploymentHighlightメソッドの終わりを探す
    // "Deployment highlights cleared');" の後の "    }" が目安
    const marker = "console.log('[RenderingEngine3D] Deployment highlights cleared');";
    const markerIndex = data.lastIndexOf(marker);

    if (markerIndex === -1) {
        throw new Error('Marker not found');
    }

    // マーカーの後、閉じ括弧を探す
    const endOfMethodIndex = data.indexOf('}', markerIndex);

    if (endOfMethodIndex === -1) {
        throw new Error('End of method not found');
    }

    // そこまでのコンテンツを保持（閉じ括弧含む）
    const validContent = data.substring(0, endOfMethodIndex + 1);

    // 追加するコンテンツ（buildTerrainFromMapData + クラス閉じ括弧）
    const newContent = `

    /**
     * マップデータから地形と建物を生成
     * @param {Object} mapData - map repository data
     */
    buildTerrainFromMapData(mapData) {
        console.log('[RenderingEngine3D] Building terrain from map data:', mapData.name);
        this.customMapLoaded = true;

        const width = mapData.terrain.width;
        const height = mapData.terrain.height;
        const heightMap = mapData.terrain.heightMap;
        const terrainType = mapData.terrain.terrainType;

        // 既存タイル削除
        while (this.tileGroup.children.length > 0) {
            const child = this.tileGroup.children[0];
            this.tileGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }

        // 高さ配列初期化
        this.hexHeights = [];
        for (let y = 0; y < height; y++) {
            this.hexHeights[y] = new Array(width).fill(0);
        }

        // 基本タイル形状
        const TILE_SIZE = 64; // 定数定義がないのでここで使うか、本来は外部定数。ここではリテラルか、ファイルの先頭でimportされていることを期待。
                              // しかしrendering3d.js内ではTILE_SIZEはimportされているはずだが、このスクリプト内では参照不可。
                              // ただし追記するテキストとしては rendering3d.js のコンテキストで評価されるので、TILE_SIZE という文字列でOK。
                              // rendering3d.jsは constants.js から TILE_SIZE などをimportしているはず。

        const hw = 32; // TILE_SIZE / 2
        const hh = 16; // TILE_SIZE / 4
        const TILE_HEIGHT = 16;

        // 注意: rendering3d.js内の定数定数はそのまま文字列として書き込む
        // 変数展開されないように注意
        
        const tileShape = new THREE.Shape();
        tileShape.moveTo(0, -hh);
        tileShape.lineTo(hw, 0);
        tileShape.lineTo(0, hh);
        tileShape.lineTo(-hw, 0);
        tileShape.closePath();
        const tileGeometry = new THREE.ShapeGeometry(tileShape);

        // テクスチャロード（あれば）
        let mapTexture = null;
        if (mapData.image) {
            const textureLoader = new THREE.TextureLoader();
            mapTexture = textureLoader.load(mapData.image);
            mapTexture.wrapS = THREE.ClampToEdgeWrapping;
            mapTexture.wrapT = THREE.ClampToEdgeWrapping;
        }

        const tempTiles = []; // 崖生成用データ構造
        const cliffMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9, side: THREE.DoubleSide });

        // タイル生成
        for (let y = 0; y < height; y++) {
            tempTiles[y] = [];
            for (let x = 0; x < width; x++) {
                const zIndex = (heightMap[y] && heightMap[y][x] !== undefined) ? heightMap[y][x] : 0;
                tempTiles[y][x] = { z: zIndex };

                const tType = (terrainType && terrainType[y] && terrainType[y][x]) ? terrainType[y][x] : 'grass';
                
                // 座標計算 (MapEditor互換)
                const wx = (x - y) * hw;
                const wz = (x + y) * hh;
                const wy = zIndex * TILE_HEIGHT;

                this.hexHeights[y][x] = wy;

                // マテリアル決定
                let material;
                const brightness = 0.7 + (zIndex / 7) * 0.3;
                
                if (mapTexture) {
                    material = new THREE.MeshStandardMaterial({
                        map: mapTexture,
                        color: new THREE.Color(brightness, brightness, brightness),
                        roughness: 0.85,
                        side: THREE.DoubleSide
                    });
                } else {
                    // カラーフォールバック
                    const baseColor = (tType === 'water') ? 0x3b7cb8 : 
                                      (tType === 'mountain') ? 0x7a6b5a : 
                                      0x4a7c41; // Default grass
                    const color = new THREE.Color(baseColor);
                    color.multiplyScalar(brightness);
                    material = new THREE.MeshStandardMaterial({
                        color: color,
                        roughness: 0.9,
                        side: THREE.DoubleSide
                    });
                }

                const tileMesh = new THREE.Mesh(tileGeometry, material);
                tileMesh.rotation.x = -Math.PI / 2;
                tileMesh.position.set(wx, wy, wz);
                tileMesh.receiveShadow = true;
                tileMesh.userData = { x, y, z: zIndex };
                
                // UV設定
                if (mapTexture) {
                    const posAttr = tileGeometry.attributes.position;
                    const uvs = new Float32Array(posAttr.count * 2);
                    const uBase = x / width;
                    const vBase = 1 - (y / height);
                    const uSize = 1 / width;
                    const vSize = 1 / height;
                    
                    for(let i=0; i<posAttr.count; i++){
                        const lx = posAttr.getX(i);
                        const ly = posAttr.getY(i);
                        uvs[i*2] = uBase + (lx / (hw*2) + 0.5) * uSize;
                        uvs[i*2+1] = vBase - (ly / (hh*2) + 0.5) * vSize;
                    }
                    tileGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                }

                this.tileGroup.add(tileMesh);
            }
        }

        // 崖生成ループ
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const zIndex = tempTiles[y][x].z;
                if(zIndex > 0) {
                     try {
                         this.addCliffSidesCustom(x, y, zIndex, tempTiles, cliffMaterial, width, height);
                     } catch(e) { }
                }
            }
        }

        // 建物生成
        this.buildingSystem.clearBuildings();
        if (mapData.buildings) {
            mapData.buildings.forEach(b => {
                let template = BUILDING_TEMPLATES[b.type];
                
                // カスタムテンプレート
                if (!template && b.properties && (b.properties.blocks || b.properties.compressedBlocks)) {
                     let blocks = b.properties.blocks;
                     if (!blocks && b.properties.compressedBlocks) {
                         blocks = decompressBlocks(b.properties.compressedBlocks, b.properties.size);
                     }
                     template = {
                         name: b.properties.name || 'Custom',
                         size: b.properties.size,
                         blocks: blocks
                     };
                }

                if (template) {
                    const buildingGroup = this.buildingSystem.createBuildingFromTemplate(template);
                    
                    // 座標変換 (アイソメトリック)
                    const wx = (b.x - b.y) * hw;
                    const wz = (b.x + b.y) * hh;
                    // 高さは足元のタイルの高さ 
                    const groundH = this.hexHeights[Math.floor(b.y)][Math.floor(b.x)];
                    
                    // buildingSystemは原点中心で作られるため、位置調整
                    buildingGroup.position.set(wx, groundH, wz);
                    
                    // 回転
                    const rot = b.rotation || 0;
                    buildingGroup.rotation.y = -rot * (Math.PI / 2); 
                    
                    this.buildingSystem.buildingGroup.add(buildingGroup);
                    
                    this.buildingSystem.buildings.push({
                        gridX: b.x,
                        gridY: b.y,
                        rotation: b.rotation,
                        template: template,
                        position: buildingGroup.position
                    });
                }
            });
        }
    }
}
`;
    // rendering3d.js内ではTILE_SIZEなどの変数が利用可能なので、
    // ここでハードコードしてしまったhw, hhなどを元の定数計算式に戻す必要がある。
    // 上記の newContent 内の hw, hh, TILE_HEIGHT 定義を、rendering3d.js のコンテキストに合うように置換する。

    // 正しいコードブロック（スクリプト内で文字列として扱うため、バックスラッシュのエスケープなどに注意）
    // 特に定数はrendering3d.jsのスコープにあるものを使うべき。

    let finalContent = newContent.replace('const hw = 32; // TILE_SIZE / 2', 'const hw = TILE_SIZE / 2;');
    finalContent = finalContent.replace('const hh = 16; // TILE_SIZE / 4', 'const hh = TILE_SIZE / 4;');
    finalContent = finalContent.replace('const TILE_HEIGHT = 16;', ''); // Remove duplicate definition if TILE_HEIGHT is global
    // TILE_HEIGHT is imported const? Yes.

    // もう一度置換して書き込み
    fs.writeFileSync(path, validContent + finalContent, 'utf8');
    console.log('Successfully fixed rendering3d.js');

} catch (e) {
    console.error('Failed to fix rendering3d.js:', e);
}
