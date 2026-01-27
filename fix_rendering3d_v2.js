const fs = require('fs');
const path = 'c:\\fantasyrts\\scripts\\rendering3d.js';

try {
    const data = fs.readFileSync(path, 'utf8');

    // buildTerrainFromMapDataの最初の定義を探す
    const targetMethodName = "buildTerrainFromMapData(mapData)";
    const methodIndex = data.indexOf(targetMethodName);

    if (methodIndex === -1) {
        throw new Error('Target method buildTerrainFromMapData not found in file');
    }

    // メソッド定義の直前のJSDocコメント (/** ... */) も含めて削除したい。
    // /** から始まるブロックを探すために、少し前を検索する。
    // methodIndexの前にある "/**" を探す。
    const jsDocIndex = data.lastIndexOf("/**", methodIndex);

    if (jsDocIndex === -1) {
        // JSDocがない場合はメソッド定義の直前までとするが、
        // 前のメソッドの閉じ括弧 "}" までは残したい。
        // methodIndexの前の "}" を探す。
        throw new Error('JSDoc not found, unexpected file structure');
    }

    // JSDocの前の改行や空白も含めて、前のメソッドの閉じ括弧まで戻る
    // jsDocIndexの前にある最初の "}" を探す（後ろから検索して）
    /*
    3460:     }
    3461: 
    3462:     
    3463:     /**
    */
    // jsDocIndexより前の部分文字列を取得し、その末尾の空白を除去するのが安全

    let cutPoint = jsDocIndex;

    // jsDocIndexの前が空白だけなら、それも削除対象にする（前のメソッドの直後まで戻る）
    // ループで cutPoint を戻していく
    while (cutPoint > 0 && /\s/.test(data[cutPoint - 1])) {
        cutPoint--;
    }

    // cutPointの位置が "}" の直後であることを期待
    if (data[cutPoint - 1] !== '}') {
        console.warn('Warning: Check cut point, expected "}" but found "' + data[cutPoint - 1] + '"');
        // 安全のため、"}" の直後まで進める
        // あるいは、lastIndexOf('}') を使う
        cutPoint = data.lastIndexOf('}', jsDocIndex) + 1;
    }

    const validContent = data.substring(0, cutPoint);

    // 追加するコンテンツ（buildTerrainFromMapData + クラス閉じ括弧）
    // 前回のスクリプトと同じ内容
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
        const hw = TILE_SIZE / 2;
        const hh = TILE_SIZE / 4;
        
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

    // もう一度置換して書き込み
    fs.writeFileSync(path, validContent + newContent, 'utf8');
    console.log('Successfully fixed rendering3d.js v2');

} catch (e) {
    console.error('Failed to fix rendering3d.js:', e);
}
