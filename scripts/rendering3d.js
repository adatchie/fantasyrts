/**
 * SEKIGAHARA RTS - 3D Rendering Engine
 * Three.jsベースの3Dレンダリングシステム
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HEX_SIZE, MAP_W, MAP_H, WARLORDS } from './constants.js';
import { KamonDrawer } from './kamon.js';

export class RenderingEngine3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.groundMesh = null; // 地形メッシュ（Raycast用）
        this.canvas = canvas;
        this.groundMesh = null; // 地形メッシュ（Raycast用）
        this.unitMeshes = new Map(); // ユニットID -> Mesh
        this.effects = []; // 3Dエフェクト


        // Three.js基本セットアップ
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a2a1a); // 暗めのグレーグリーン（オーバーレイと調和）

        // カメラセットアップ（RTS視点：斜め45度上空）
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 1, 10000);
        this.camera.position.set(0, 800, 600); // 斜め上から見下ろす
        this.camera.lookAt(0, 0, 0);

        // レンダラーセットアップ
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // コントロール（カメラ操作）
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 200;
        this.controls.maxDistance = 2000;
        this.controls.maxPolarAngle = Math.PI / 2.5; // 地平線より手前で止める（約72度）

        // マウス操作の割り当てを変更（左クリックをゲーム操作用に開放）
        this.controls.mouseButtons = {
            LEFT: null, // 左ドラッグ：無効（範囲選択などに使用）
            MIDDLE: THREE.MOUSE.DOLLY, // 中ドラッグ：ズーム
            RIGHT: THREE.MOUSE.PAN     // 右ドラッグ：平行移動（パン）
        };

        // マウス位置追跡（画面端での回転用）
        this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.isRightMouseDown = false; // 右クリック状態

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        // 右クリック状態の追跡
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) this.isRightMouseDown = true;
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) this.isRightMouseDown = false;
        });

        // 右クリック時のコンテキストメニューを無効化
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // ライティング
        this.setupLights();

        // 地面とグリッド
        this.setupGround();

        // アニメーションループ開始
        this.animate();
    }

    setupLights() {
        // 環境光（全体的な明るさ）
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // 平行光源（太陽光）
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 200, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -500;
        directionalLight.shadow.camera.right = 500;
        directionalLight.shadow.camera.top = 500;
        directionalLight.shadow.camera.bottom = -500;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
    }

    setupGround() {
        // ヘックスグリッドの実際のサイズを計算
        // pointy-top hexの場合：
        // 幅 = MAP_W * sqrt(3) * HEX_SIZE + (MAP_H-1) * sqrt(3)/2 * HEX_SIZE
        // 高さ = (MAP_H-1) * 1.5 * HEX_SIZE + 2*HEX_SIZE
        const gridWidth = MAP_W * Math.sqrt(3) * HEX_SIZE + (MAP_H - 1) * Math.sqrt(3) / 2 * HEX_SIZE;
        const gridHeight = (MAP_H - 1) * 1.5 * HEX_SIZE + 2 * HEX_SIZE;

        // グリッドの中心位置を計算
        const centerX = (gridWidth - Math.sqrt(3) * HEX_SIZE) / 2;
        const centerZ = (gridHeight - 2 * HEX_SIZE) / 2;

        // クラスメンバとして保存（ハイトマップ解析用）
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
        this.gridCenterX = centerX;
        this.gridCenterZ = centerZ;

        // テクスチャをロード
        const textureLoader = new THREE.TextureLoader();
        const groundTexture = textureLoader.load('./assets/textures/ground_sekigahara.jpg');

        // ハイトマップのロードと解析
        const heightMap = textureLoader.load('./assets/textures/height_sekigahara.jpg', (texture) => {
            // 画像読み込み完了時に解析を行う
            // texture.image は Image オブジェクト
            if (texture.image) {
                this.analyzeHeightMap(texture.image);
            }
        });

        // テクスチャを繰り返さない（史実の地形マップとして使用）
        groundTexture.wrapS = THREE.ClampToEdgeWrapping;
        groundTexture.wrapT = THREE.ClampToEdgeWrapping;
        heightMap.wrapS = THREE.ClampToEdgeWrapping;
        heightMap.wrapT = THREE.ClampToEdgeWrapping;

        // テクスチャのフィルタリング設定（よりきれいに表示）
        groundTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        heightMap.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

        // 地面（セグメント数を減らしてパフォーマンス改善）
        const groundGeometry = new THREE.PlaneGeometry(
            gridWidth * 1.2,
            gridHeight * 1.2,
            128, // 幅のセグメント数（最適化）
            128  // 高さのセグメント数
        );

        const groundMaterial = new THREE.MeshStandardMaterial({
            map: groundTexture,  // カラーテクスチャ
            displacementMap: heightMap,  // 専用の高さマップを使用
            displacementScale: 50,  // 高さのスケール（控えめに調整）
            roughness: 0.8,
            metalness: 0.2
        });

        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // XZ平面に配置
        ground.position.set(centerX, 0, centerZ); // グリッドの中心に配置
        ground.receiveShadow = true;
        ground.castShadow = true; // 山が影を落とす
        this.scene.add(ground);

        // 地形メッシュを保存（Raycast用）
        this.groundMesh = ground;

        // グリッド外のエリアを暗くするオーバーレイ（プレイエリアを明確化）
        this.createOutOfBoundsOverlay(gridWidth, gridHeight, centerX, centerZ);

        // ヘックスグリッドを地形に沿った平面として描画（DisplacementMap使用）
        this.createHexGridOverlay(gridWidth, gridHeight, centerX, centerZ, heightMap);
    }

    /**
     * MapSystemへの参照を設定
     */
    setMapSystem(mapSystem) {
        this.mapSystem = mapSystem;
    }

    /**
     * ハイトマップ画像を解析してMapSystemの地形データを更新
     */
    analyzeHeightMap(image) {
        if (!this.mapSystem) return;

        console.log("Analyzing height map for terrain data...");

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        // 画像データを取得
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // PlaneGeometryのサイズと配置
        const planeW = this.gridWidth * 1.2;
        const planeH = this.gridHeight * 1.2;
        // Planeの左上のワールド座標 (中心から半分のサイズを引く)
        const startX = this.gridCenterX - planeW / 2;
        const startZ = this.gridCenterZ - planeH / 2;

        let mountainCount = 0;
        let hillCount = 0;

        for (let r = 0; r < MAP_H; r++) {
            for (let q = 0; q < MAP_W; q++) {
                // 各HEXの中心座標（ワールド座標）を取得
                const worldPos = this.hexToWorld3D(q, r);

                // ワールド座標からUV座標(0.0-1.0)への変換
                let u = (worldPos.x - startX) / planeW;
                let v = (worldPos.z - startZ) / planeH;

                let imgX = u * (canvas.width - 1);
                let imgY = v * (canvas.height - 1);

                // 範囲外チェック
                imgX = Math.max(0, Math.min(canvas.width - 1, imgX));
                imgY = Math.max(0, Math.min(canvas.height - 1, imgY));

                const px = Math.floor(imgX);
                const py = Math.floor(imgY);

                const index = (py * canvas.width + px) * 4;
                const heightVal = data[index]; // R成分

                this.mapSystem.updateTerrain(q, r, heightVal);

                if (heightVal > 160) mountainCount++;
                else if (heightVal > 80) hillCount++;
            }
        }

        console.log(`Terrain analysis complete. Mountains: ${mountainCount}, Hills: ${hillCount}`);
    }

    /**
     * グリッド外のエリアを暗くするオーバーレイを作成
     */
    createOutOfBoundsOverlay(gridWidth, gridHeight, centerX, centerZ) {
        // ヘックスグリッドの範囲外を暗くする
        // 各ヘックス位置に対して、グリッド内かどうかを判定し、
        // グリッド外なら暗いヘックス形状のオーバーレイを配置

        const overlayColor = 0x000000; // 黒
        const overlayOpacity = 0.35; // 透明度（ヘックス単位のみなので少し濃くする）

        // より広い範囲をチェック（グリッドより大きい範囲）
        const checkRangeQ = MAP_W + 20; // 外側も広くカバー
        const checkRangeR = MAP_H + 20;

        for (let r = -10; r < checkRangeR; r++) {
            for (let q = -10; q < checkRangeQ; q++) {
                // グリッド範囲外のヘックスにオーバーレイを配置
                if (q < 0 || q >= MAP_W || r < 0 || r >= MAP_H) {
                    this.addHexOverlay(q, r, overlayColor, overlayOpacity);
                }
            }
        }
    }

    /**
     * 指定したヘックス位置に暗いオーバーレイを追加
     */
    addHexOverlay(q, r, color, opacity) {
        const center = this.hexToWorld3D(q, r);
        const vertices = this.getHexagonVertices(q, r);

        // 六角形の形状を作成
        const shape = new THREE.Shape();
        shape.moveTo(vertices[0].x - center.x, vertices[0].z - center.z);
        for (let i = 1; i < vertices.length; i++) {
            shape.lineTo(vertices[i].x - center.x, vertices[i].z - center.z);
        }
        shape.lineTo(vertices[0].x - center.x, vertices[0].z - center.z);

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const overlay = new THREE.Mesh(geometry, material);
        overlay.rotation.x = -Math.PI / 2;
        overlay.position.set(center.x, 0.5, center.z);
        this.scene.add(overlay);
    }

    /**
     * HEXグリッドを地形に沿った平面オーバーレイとして作成
     */
    createHexGridOverlay(gridWidth, gridHeight, centerX, centerZ, heightMap) {
        // Canvasでヘックスグリッドを描画
        const canvas = document.createElement('canvas');
        const size = 2048; // テクスチャサイズ
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // 背景を透明に
        ctx.clearRect(0, 0, size, size);

        // グリッドを描画
        ctx.strokeStyle = 'rgba(136, 170, 136, 0.5)'; // 半透明の緑
        ctx.lineWidth = 2;

        const scaleX = size / (gridWidth * 1.2);
        const scaleZ = size / (gridHeight * 1.2);
        const offsetX = (size - gridWidth * scaleX) / 2;
        const offsetZ = (size - gridHeight * scaleZ) / 2;

        for (let r = 0; r < MAP_H; r++) {
            for (let q = 0; q < MAP_W; q++) {
                const center = this.hexToWorld3D(q, r);

                ctx.beginPath();
                for (let i = 0; i <= 6; i++) {
                    const angle = (Math.PI / 3) * i + Math.PI / 6;
                    const x = (center.x + HEX_SIZE * Math.cos(angle)) * scaleX + offsetX;
                    const z = (center.z + HEX_SIZE * Math.sin(angle)) * scaleZ + offsetZ;

                    if (i === 0) {
                        ctx.moveTo(x, z);
                    } else {
                        ctx.lineTo(x, z);
                    }
                }
                ctx.stroke();
            }
        }

        const gridTexture = new THREE.CanvasTexture(canvas);
        gridTexture.wrapS = THREE.ClampToEdgeWrapping;
        gridTexture.wrapT = THREE.ClampToEdgeWrapping;

        // 地形と同じジオメトリを使用
        const gridGeometry = new THREE.PlaneGeometry(
            gridWidth * 1.2,
            gridHeight * 1.2,
            128,
            128
        );

        // 透明なマテリアルにグリッドテクスチャとDisplacementMapを適用
        const gridMaterial = new THREE.MeshStandardMaterial({
            map: gridTexture,
            transparent: true,
            opacity: 1.0,
            displacementMap: heightMap,
            displacementScale: 50,
            roughness: 1.0,
            metalness: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const gridOverlay = new THREE.Mesh(gridGeometry, gridMaterial);
        gridOverlay.rotation.x = -Math.PI / 2;
        gridOverlay.position.set(centerX, 5, centerZ); // 地形より十分上に
        gridOverlay.renderOrder = 1; // 地形の後に描画
        this.scene.add(gridOverlay);
    }

    /**
     * ユニットの表示を更新（毎フレーム呼び出し）
     */
    updateUnits() {
        if (!window.gameState || !window.gameState.units) return;

        // groundMeshがまだない場合はスキップ
        if (!this.groundMesh) return;

        const activeIds = new Set();

        window.gameState.units.forEach(unit => {
            if (unit.dead) return;
            activeIds.add(unit.id);

            let mesh = this.unitMeshes.get(unit.id);
            if (!mesh) {
                // 新規ユニット作成
                mesh = this.createUnitMesh(unit);
                this.unitMeshes.set(unit.id, mesh);
                this.scene.add(mesh);
            }

            // 位置更新
            const targetPos = this.hexToWorld3D(unit.q, unit.r);

            // 現在位置とターゲット位置が離れている場合のみ更新（パフォーマンス最適化）
            if (Math.abs(mesh.position.x - targetPos.x) > 1 || Math.abs(mesh.position.z - targetPos.z) > 1) {
                mesh.position.x = targetPos.x;
                mesh.position.z = targetPos.z;

                // 高さ合わせ（Raycast）
                const raycaster = new THREE.Raycaster();
                const rayOrigin = new THREE.Vector3(targetPos.x, 2000, targetPos.z);
                const rayDirection = new THREE.Vector3(0, -1, 0);
                raycaster.set(rayOrigin, rayDirection);

                const intersects = raycaster.intersectObject(this.groundMesh);
                if (intersects.length > 0) {
                    mesh.position.y = intersects[0].point.y + 60;
                } else {
                    mesh.position.y = 100;
                }
            }

            // 回転更新
            const dir = unit.dir !== undefined ? unit.dir : (unit.facing || 0);
            const targetRot = -Math.PI / 2 - dir * (Math.PI / 3) + Math.PI;
            mesh.rotation.z = targetRot;

            // 選択状態のハイライト更新
            const isSelected = window.game && window.game.selectedUnits && window.game.selectedUnits.some(u => u.id === unit.id);
            if (mesh.material) {
                if (isSelected) {
                    mesh.material.emissive.setHex(0x666666); // 白く発光
                } else {
                    mesh.material.emissive.setHex(0x000000); // 通常
                }
            }

            // 選択リングの表示切り替え
            const selRing = mesh.getObjectByName('selectionRing');
            if (selRing) {
                selRing.visible = isSelected;
                if (isSelected) {
                    // 点滅アニメーション
                    const time = Date.now() * 0.005;
                    selRing.material.opacity = 0.5 + Math.sin(time) * 0.3;
                }
            }

            // 兵士数ゲージ更新
            this.updateUnitInfo(mesh, unit);
        });

        // 死亡したユニットを削除
        for (const [id, mesh] of this.unitMeshes) {
            if (!activeIds.has(id)) {
                this.scene.remove(mesh);
                // メモリリーク防止のためのdispose処理は省略（簡易実装）
                this.unitMeshes.delete(id);
            }
        }
    }

    /**
     * ユニットメッシュを作成して返す
     */
    createUnitMesh(unit) {
        // 所属軍の色を取得
        let color = 0x88AAEE;
        if (unit.side === 'WEST') color = 0xEE4444;
        else if (unit.side === 'EAST') color = 0x88AAEE;
        else color = 0x888888;

        // 凸字型の形状を作成
        const shape = new THREE.Shape();
        const size = HEX_SIZE * 1.5;
        const width = size * 1.2;
        const height = size * 0.8;
        const notchDepth = height * 0.5;
        const notchWidth = width * 0.5;

        shape.moveTo(-width / 2, height / 2);
        shape.lineTo(width / 2, height / 2);
        shape.lineTo(width / 2, -height / 2);
        shape.lineTo(notchWidth / 2, -height / 2);
        shape.lineTo(notchWidth / 2, -height / 2 - notchDepth);
        shape.lineTo(-notchWidth / 2, -height / 2 - notchDepth);
        shape.lineTo(-notchWidth / 2, -height / 2);
        shape.lineTo(-width / 2, -height / 2);
        shape.lineTo(-width / 2, height / 2);

        const extrudeSettings = { depth: size * 0.3, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.3,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Raycast用にIDを保存
        mesh.userData = { unitId: unit.id };

        // 情報オーバーレイ初期作成
        this.createUnitInfoOverlay(mesh, unit);

        // 本陣の場合、金色のリングを追加
        if (unit.unitType === 'HEADQUARTERS') {
            const ringGeo = new THREE.RingGeometry(size * 0.8, size * 0.9, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xFFD700, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.z = 1; // 地面より少し上
            mesh.add(ring);
        }

        // 選択リング（初期状態は非表示）
        // ユニットより大きくして外側に見えるようにする
        const selRingGeo = new THREE.RingGeometry(size * 1.3, size * 1.4, 32);
        const selRingMat = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
            depthTest: false // 常に最前面に描画（埋もれ防止）
        });
        const selRing = new THREE.Mesh(selRingGeo, selRingMat);
        selRing.name = 'selectionRing';
        selRing.position.z = 0.5; // 地面近く
        selRing.renderOrder = 999; // 最前面
        selRing.visible = false;
        mesh.add(selRing);

        return mesh;
    }

    /**
     * ユニット情報オーバーレイ（兵士ゲージ、家紋）を作成
     */
    createUnitInfoOverlay(mesh, unit) {
        // 兵士ゲージ用スプライト
        const barSprite = this.createBarSprite(unit);
        barSprite.name = 'barSprite';
        barSprite.position.set(0, 30, 0);
        mesh.add(barSprite);

        // 本陣マーカーと名前
        if (unit.unitType === 'HEADQUARTERS') {
            const kSprite = this.createKamonSprite(unit);
            kSprite.position.set(0, 45, 0);
            mesh.add(kSprite);

            // 名前ラベル
            const nameSprite = this.createNameSprite(unit.name);
            nameSprite.position.set(0, 60, 0); // 家紋の上
            mesh.add(nameSprite);
        }
    }

    createNameSprite(name) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.font = "bold 32px serif";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 4;
        ctx.strokeText(name, 128, 32);
        ctx.fillText(name, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(40, 10, 1);
        return sprite;
    }

    createBarSprite(unit) {
        const barWidth = 128;
        const barHeight = 16;
        const canvas = document.createElement('canvas');
        canvas.width = barWidth;
        canvas.height = barHeight;
        const ctx = canvas.getContext('2d');

        this.drawBar(ctx, unit.soldiers, unit.maxSoldiers, barWidth, barHeight);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(15, 2, 1);
        return sprite;
    }

    drawBar(ctx, current, max, w, h) {
        if (isNaN(current) || isNaN(max) || max <= 0) return;

        ctx.fillStyle = '#ff4444';
        ctx.fillRect(0, 0, w, h);
        const ratio = Math.max(0, Math.min(1, current / max));
        ctx.fillStyle = '#44ff44';
        ctx.fillRect(0, 0, w * ratio, h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, w, h);
    }

    createKamonSprite(unit) {
        const kSize = 128;
        const kCanvas = document.createElement('canvas');
        kCanvas.width = kSize;
        kCanvas.height = kSize;
        const kCtx = kCanvas.getContext('2d');

        let bgColor = '#000000';
        // ユーザーの指摘により、個別の武将カラーではなく陣営色を使用する（視認性向上と統一感のため）
        if (unit.side === 'EAST') bgColor = '#001133';
        else if (unit.side === 'WEST') bgColor = '#330000';
        else bgColor = '#333333';

        KamonDrawer.drawKamon(kCtx, unit.kamon || 'DEFAULT', kSize / 2, kSize / 2, kSize / 2 - 4, bgColor);

        const kTexture = new THREE.CanvasTexture(kCanvas);
        const kMaterial = new THREE.SpriteMaterial({ map: kTexture });
        const kSprite = new THREE.Sprite(kMaterial);
        kSprite.scale.set(15, 15, 1);
        return kSprite;
    }

    updateUnitInfo(mesh, unit) {
        // 兵士ゲージの更新
        const barSprite = mesh.getObjectByName('barSprite');
        if (barSprite) {
            // テクスチャのみ更新したいが、CanvasTextureの更新はコストが高いので
            // 兵数が変わったときのみ再描画するロジックを入れるべき
            // ここでは簡易的に毎回描画（最適化余地あり）
            // ただしCanvasTextureのcanvasを取得して描き直す
            const texture = barSprite.material.map;
            const canvas = texture.image;
            const ctx = canvas.getContext('2d');
            this.drawBar(ctx, unit.soldiers, unit.maxSoldiers, canvas.width, canvas.height);
            texture.needsUpdate = true;
        }
    }

    /**
     * ユニットの見た目（色、家紋など）を更新
     * 寝返りなどで所属が変わった場合に呼び出す
     */
    updateUnitVisuals(unit) {
        const mesh = this.unitMeshes.get(unit.id);
        if (!mesh) return;

        // 本体の色更新
        // mesh自体がExtrudeGeometryを持つ本体
        if (mesh.material && mesh.material.color) {
            let color = 0x88AAEE;
            if (unit.side === 'WEST') color = 0xEE4444;
            else if (unit.side === 'EAST') color = 0x88AAEE;
            else color = 0x888888;
            mesh.material.color.setHex(color);
        }

        // 家紋スプライトの再生成と差し替え（本陣のみ）
        if (unit.unitType === 'HEADQUARTERS') {
            const oldKamon = mesh.getObjectByName('kamonSprite');
            if (oldKamon) {
                mesh.remove(oldKamon);
                // メモリ解放
                if (oldKamon.material.map) oldKamon.material.map.dispose();
                if (oldKamon.material) oldKamon.material.dispose();
            }

            const newKamon = this.createKamonSprite(unit);
            newKamon.name = 'kamonSprite';
            newKamon.position.set(0, 45, 0); // 高さ調整 (createUnitInfoOverlayと合わせる)
            mesh.add(newKamon);
        }
    }

    // 古いメソッド（互換性のため残すが中身は空またはupdateUnitsへ委譲）
    drawUnits() {
        this.updateUnits();
    }

    /**
     * ヘックス座標を3D空間のXZ座標に変換
     */
    hexToWorld3D(q, r) {
        const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
        const z = HEX_SIZE * 3 / 2 * r;
        return { x, y: 0, z };
    }

    /**
     * 六角形の頂点を取得（XZ平面）
     */
    getHexagonVertices(q, r) {
        const center = this.hexToWorld3D(q, r);
        const vertices = [];

        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + Math.PI / 6; // pointy-top
            const x = center.x + HEX_SIZE * Math.cos(angle);
            const z = center.z + HEX_SIZE * Math.sin(angle);
            let y = 150; // 固定の高さ
            vertices.push(new THREE.Vector3(x, y, z));
        }

        return vertices;
    }

    /**
     * ヘックスグリッドを3D空間に描画
     */
    drawHexGrid() {
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x88aa88,
            opacity: 0.3,
            transparent: true
        });

        for (let r = 0; r < MAP_H; r++) {
            for (let q = 0; q < MAP_W; q++) {
                const vertices = this.getHexagonVertices(q, r);

                // 六角形のラインを描画
                const geometry = new THREE.BufferGeometry().setFromPoints([...vertices, vertices[0]]);
                const line = new THREE.Line(geometry, lineMaterial);
                this.scene.add(line);
            }
        }
    }

    /**
     * 画面端でのカメラ回転処理
     */
    handleEdgeRotation() {
        // 右クリック中のみ回転（ユーザー要望）
        if (!this.isRightMouseDown) return;

        const margin = 20; // 反応する画面端の幅（ピクセル）
        const rotateSpeed = 0.03; // 回転速度

        const x = this.mouse.x;
        const y = this.mouse.y;
        const w = window.innerWidth;
        const h = window.innerHeight;

        let theta = 0; // 水平回転（Azimuth）
        let phi = 0;   // 垂直回転（Polar）

        // 左端・右端
        if (x < margin) theta = rotateSpeed;
        else if (x > w - margin) theta = -rotateSpeed;

        // 上端・下端
        if (y < margin) phi = -rotateSpeed;
        else if (y > h - margin) phi = rotateSpeed;

        if (theta !== 0 || phi !== 0) {
            // 現在のカメラ位置（ターゲット相対）を取得
            const offset = new THREE.Vector3().copy(this.camera.position).sub(this.controls.target);

            // 球面座標に変換
            const spherical = new THREE.Spherical().setFromVector3(offset);

            // 回転を適用
            spherical.theta += theta;
            spherical.phi += phi;

            // 垂直角度の制限（OrbitControlsの設定に合わせる）
            spherical.phi = Math.max(this.controls.minPolarAngle, Math.min(this.controls.maxPolarAngle, spherical.phi));

            // ベクトルに戻す
            offset.setFromSpherical(spherical);

            // カメラ位置を更新
            this.camera.position.copy(this.controls.target).add(offset);

            // 注視点は変更しない
            this.camera.lookAt(this.controls.target);
        }
    }

    /**
     * アニメーションループ
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        // 画面端でのカメラ回転処理
        this.handleEdgeRotation();

        // ユニット更新
        this.updateUnits();

        // エフェクト更新
        this.updateEffects();

        // 命令ライン描画
        this.drawOrderLines();

        // コントロールを更新
        this.controls.update();

        // レンダリング
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * ウィンドウリサイズ対応
     */
    resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    /**
     * 3Dエフェクトを追加
     * 引数の形式を柔軟に対応
     */
    add3DEffect(type, arg1, arg2, arg3) {
        if (type === 'BEAM') {
            // BEAMの場合、(type, start, end, color) で呼ばれることが多い
            // または (type, {start, end, color})
            if (arg2) {
                this.createBeam({ start: arg1, end: arg2, color: arg3 });
            } else {
                this.createBeam(arg1);
            }
        } else if (type === 'FLOAT_TEXT') {
            this.createFloatingText(arg1);
        } else if (type === 'SPARK') {
            this.createSparks(arg1);
        } else if (type === 'DUST') {
            // DUSTの場合、(type, pos, null, null) で呼ばれることがある
            this.createDust(arg1);
        } else if (type === 'WAVE') {
            // WAVEの場合、(type, start, end) で呼ばれることがある
            if (arg2) {
                this.createWave({ start: arg1, end: arg2 });
            } else {
                this.createWave(arg1);
            }
        } else if (type === 'BUBBLE') {
            this.createBubble(arg1);
        }
    }

    createBeam(data) {
        // data: { start: {q,r} or {x,y,z}, end: {q,r} or {x,y,z}, color: hex }
        // 座標変換が必要な場合に対応
        const startPos = data.start.x !== undefined ? data.start : this.hexToWorld3D(data.start.q, data.start.r);
        const endPos = data.end.x !== undefined ? data.end : this.hexToWorld3D(data.end.q, data.end.r);

        // 高さを調整（ユニットの胸元あたり）
        if (startPos.y < 10) startPos.y = 30;
        if (endPos.y < 10) endPos.y = 30;

        const points = [new THREE.Vector3(startPos.x, startPos.y, startPos.z), new THREE.Vector3(endPos.x, endPos.y, endPos.z)];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: data.color || 0xffaa00,
            linewidth: 3, // WebGLでは効かないことが多いが指定
            transparent: true,
            opacity: 0.8
        });

        const line = new THREE.Line(geometry, material);
        this.scene.add(line);

        this.effects.push({
            mesh: line,
            type: 'BEAM',
            life: 30,
            maxLife: 30
        });
    }

    createFloatingText(data) {
        // data: { q,r, text, color } or { pos: {x,y,z}, text, color }
        let pos;
        if (data.x !== undefined) pos = data;
        else if (data.q !== undefined) pos = this.hexToWorld3D(data.q, data.r);
        else if (data.pos) {
            pos = data.pos.x !== undefined ? data.pos : this.hexToWorld3D(data.pos.q, data.pos.r);
        } else {
            return; // 座標不明
        }

        if (pos.y < 10) pos.y = 150; // 頭上

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.font = 'bold 40px serif';
        ctx.fillStyle = data.color || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        ctx.strokeText(data.text, 128, 32);
        ctx.fillText(data.text, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);

        sprite.position.set(pos.x, pos.y, pos.z);
        sprite.scale.set(60, 15, 1);

        this.scene.add(sprite);

        this.effects.push({
            mesh: sprite,
            type: 'FLOAT_TEXT',
            life: 60,
            maxLife: 60,
            velocity: new THREE.Vector3(0, 1.5, 0) // 上昇
        });
    }



    createSparks(data) {
        // data: { q,r } or { x,y,z } or { pos: {x,y,z} }
        let pos;
        if (data.x !== undefined) pos = data;
        else if (data.q !== undefined) pos = this.hexToWorld3D(data.q, data.r);
        else if (data.pos) {
            pos = data.pos.x !== undefined ? data.pos : this.hexToWorld3D(data.pos.q, data.pos.r);
        } else {
            return; // 座標不明
        }

        // 簡易的な火花（黄色い点）
        const geometry = new THREE.BufferGeometry();
        const count = 10;
        const positions = new Float32Array(count * 3);
        const velocities = [];

        for (let i = 0; i < count; i++) {
            positions[i * 3] = pos.x;
            positions[i * 3 + 1] = pos.y + 30; // 地面より少し上
            positions[i * 3 + 2] = pos.z;

            velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            ));
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xffff00,
            size: 5,
            transparent: true
        });

        const points = new THREE.Points(geometry, material);
        this.scene.add(points);

        this.effects.push({
            mesh: points,
            type: 'SPARK',
            life: 20,
            maxLife: 20,
            velocities: velocities
        });
    }


    createDust(data) {
        // data: { q, r } or { x, y, z }
        const pos = data.x !== undefined ? data : this.hexToWorld3D(data.q, data.r);

        const geometry = new THREE.SphereGeometry(10, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.6
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(pos.x, 10, pos.z);
        this.scene.add(mesh);

        this.effects.push({
            mesh: mesh,
            type: 'DUST',
            life: 40,
            maxLife: 40,
            scaleSpeed: 0.5
        });
    }

    createWave(data) {
        // data: { start: {q,r}, end: {q,r} }
        // 調略エフェクト：波紋が広がる
        const startPos = this.hexToWorld3D(data.start.q, data.start.r);

        const geometry = new THREE.RingGeometry(1, 2, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(startPos.x, 20, startPos.z);
        this.scene.add(mesh);

        this.effects.push({
            mesh: mesh,
            type: 'WAVE',
            life: 60,
            maxLife: 60,
            targetPos: this.hexToWorld3D(data.end.q, data.end.r)
        });
    }

    createBubble(data) {
        // data: { unit: unitObject, text: string }
        const unit = data.unit;
        const pos = this.hexToWorld3D(unit.q, unit.r);
        pos.y = 180; // 頭上高め

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // 吹き出し描画
        const w = canvas.width;
        const h = canvas.height;
        const r = 20;

        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, h - 30 - r);
        ctx.quadraticCurveTo(w, h - 30, w - r, h - 30);
        ctx.lineTo(w / 2 + 20, h - 30);
        ctx.lineTo(w / 2, h);
        ctx.lineTo(w / 2 - 20, h - 30);
        ctx.lineTo(r, h - 30);
        ctx.quadraticCurveTo(0, h - 30, 0, h - 30 - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // テキスト
        ctx.font = 'bold 40px serif';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(data.text, w / 2, (h - 30) / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(pos.x, pos.y, pos.z);
        sprite.scale.set(80, 20, 1);

        this.scene.add(sprite);

        this.effects.push({
            mesh: sprite,
            type: 'BUBBLE',
            life: 100,
            maxLife: 100,
            velocity: new THREE.Vector3(0, 0.2, 0)
        });
    }

    updateEffects() {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.life--;

            if (effect.type === 'BEAM') {
                effect.mesh.material.opacity = effect.life / effect.maxLife;
            } else if (effect.type === 'FLOAT_TEXT') {
                effect.mesh.position.add(effect.velocity);
                effect.mesh.material.opacity = effect.life / effect.maxLife;
            } else if (effect.type === 'BUBBLE') {
                effect.mesh.position.add(effect.velocity);
                effect.mesh.material.opacity = Math.min(1, effect.life / 20); // 最後だけフェードアウト
            } else if (effect.type === 'DUST') {
                effect.mesh.scale.multiplyScalar(1.05);
                effect.mesh.material.opacity = effect.life / effect.maxLife;
                effect.mesh.position.y += 0.5;
            } else if (effect.type === 'WAVE') {
                const progress = 1 - (effect.life / effect.maxLife);
                effect.mesh.scale.setScalar(1 + progress * 30);
                effect.mesh.material.opacity = 1 - progress;

                // 目標に向かって移動
                if (effect.targetPos) {
                    effect.mesh.position.lerp(effect.targetPos, 0.05);
                }
            } else if (effect.type === 'SPARK') {
                const positions = effect.mesh.geometry.attributes.position.array;
                for (let j = 0; j < effect.velocities.length; j++) {
                    positions[j * 3] += effect.velocities[j].x;
                    positions[j * 3 + 1] += effect.velocities[j].y;
                    positions[j * 3 + 2] += effect.velocities[j].z;
                }
                effect.mesh.geometry.attributes.position.needsUpdate = true;
                effect.mesh.material.opacity = effect.life / effect.maxLife;
            }

            if (effect.life <= 0) {
                this.scene.remove(effect.mesh);
                if (effect.mesh.geometry) effect.mesh.geometry.dispose();
                if (effect.mesh.material) {
                    if (effect.mesh.material.map) effect.mesh.material.map.dispose();
                    effect.mesh.material.dispose();
                }
                this.effects.splice(i, 1);
            }
        }
    }

    /**
     * 命令ライン（移動矢印）を描画
     */
    drawOrderLines() {
        // 既存のラインを削除（毎フレーム再描画）
        // パフォーマンス的には最適ではないが、動く矢印のためには必要
        // ここでは「ライン専用のグループ」を作って管理すると良い
        if (!this.orderLineGroup) {
            this.orderLineGroup = new THREE.Group();
            this.scene.add(this.orderLineGroup);
        }

        // 子要素を全削除
        while (this.orderLineGroup.children.length > 0) {
            const obj = this.orderLineGroup.children[0];
            this.orderLineGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }

        // 選択中のユニットに対してラインを描画
        // window.game.selectedUnits を参照
        // ORDERフェイズ以外は描画しない
        if (!window.game || !window.gameState || !window.gameState.units || window.game.gameState !== 'ORDER') return;

        // 全ユニットの命令ラインを描画（選択中は強調、非選択は薄く）
        window.gameState.units.forEach(unit => {
            if (unit.dead || !unit.order) return;

            const isSelected = window.game.selectedUnits && window.game.selectedUnits.some(u => u.id === unit.id);

            // 非選択ユニットのラインは薄く表示（オプション）
            // 2D版の仕様に合わせて、全ユニットのラインを表示する
            const opacity = isSelected ? 1.0 : 0.3;
            const depthTest = isSelected ? false : true; // 選択中は地形を貫通、非選択は地形に隠れる
            const renderOrder = isSelected ? 999 : 0;

            const startPos = this.hexToWorld3D(unit.q, unit.r);
            startPos.y = 30; // 地面近くに下げる

            let endPos = null;
            let color = 0xffffff;

            if (unit.order.type === 'MOVE' && unit.order.targetHex) {
                endPos = this.hexToWorld3D(unit.order.targetHex.q, unit.order.targetHex.r);
                color = 0x00ff00; // 緑
            } else if ((unit.order.type === 'ATTACK' || unit.order.type === 'PLOT') && unit.order.targetId) {
                const target = window.gameState.units.find(u => u.id === unit.order.targetId);
                if (target) {
                    endPos = this.hexToWorld3D(target.q, target.r);
                    color = unit.order.type === 'ATTACK' ? 0xff0000 : 0x00ffff; // 赤 or 水色
                }
            }

            if (endPos) {
                endPos.y = 30;

                // 矢印の軸
                const points = [new THREE.Vector3(startPos.x, startPos.y, startPos.z), new THREE.Vector3(endPos.x, endPos.y, endPos.z)];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({
                    color: color,
                    depthTest: depthTest,
                    transparent: true,
                    opacity: opacity
                });
                const line = new THREE.Line(geometry, material);
                line.renderOrder = renderOrder;
                this.orderLineGroup.add(line);

                // 矢印の先端（コーン）
                // 向きを計算
                const dir = new THREE.Vector3().subVectors(new THREE.Vector3(endPos.x, endPos.y, endPos.z), new THREE.Vector3(startPos.x, startPos.y, startPos.z)).normalize();
                const arrowLength = 20;
                const arrowHead = new THREE.Mesh(
                    new THREE.ConeGeometry(8, 20, 8),
                    new THREE.MeshBasicMaterial({
                        color: color,
                        depthTest: depthTest,
                        transparent: true,
                        opacity: opacity
                    })
                );
                arrowHead.renderOrder = renderOrder;
                arrowHead.position.copy(new THREE.Vector3(endPos.x, endPos.y, endPos.z));
                // コーンはデフォルトでY軸向きなので、進行方向に回転させる
                // クォータニオンで回転
                const axis = new THREE.Vector3(0, 1, 0);
                arrowHead.quaternion.setFromUnitVectors(axis, dir);
                // 90度倒す必要があるかも？ ConeGeometryの底面はY=0
                // setFromUnitVectorsでY軸(0,1,0)をdirに向けるのでOKなはず
                // ただしConeの頂点は(0, height/2, 0)なので、中心から先端に向かう
                // 位置を少し手前に戻す
                arrowHead.position.sub(dir.multiplyScalar(10));

                // 90度回転（ConeGeometryの仕様による）
                arrowHead.rotateX(Math.PI / 2);

                this.orderLineGroup.add(arrowHead);
            }
        });
    }


    /**
     * スクリーン座標(x, y)からHEX座標(q, r)を取得
     * @param {number} x - スクリーンX座標
     * @param {number} y - スクリーンY座標
     * @returns {{q: number, r: number}|null} HEX座標、またはnull
     */
    getHexFromScreenCoordinates(x, y) {
        if (!this.groundMesh) return null;

        // スクリーン座標を正規化デバイス座標(-1 to +1)に変換
        const rect = this.canvas.getBoundingClientRect();
        const ndcX = ((x - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((y - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);

        // 1. ユニットとの交差判定（優先）
        // unitMeshesはMapなのでArrayに変換
        const unitMeshesArray = Array.from(this.unitMeshes.values());
        const unitIntersects = raycaster.intersectObjects(unitMeshesArray, true); // trueで再帰的に子要素もチェック

        if (unitIntersects.length > 0) {
            // 最も手前のオブジェクトを取得
            // 親を辿ってメインのMeshを探す（userData.unitIdを持っているはず）
            let target = unitIntersects[0].object;
            while (target) {
                if (target.userData && target.userData.unitId) {
                    // ユニットIDからユニット情報を取得して座標を返す
                    const unit = window.gameState.units.find(u => u.id === target.userData.unitId);
                    if (unit) {
                        return { q: unit.q, r: unit.r };
                    }
                }
                target = target.parent;
            }
        }

        // 2. 地形との交差判定（フォールバック）
        const intersects = raycaster.intersectObject(this.groundMesh);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            return this.world3DToHex(point.x, point.z);
        }

        return null;
    }

    /**
     * ユニットのスクリーン座標を取得（ボックス選択用）
     * @param {Object} unit - ユニットオブジェクト(q, rを持つ)
     * @returns {{x: number, y: number}|null} スクリーン座標、または画面外/計算不能ならnull
     */
    getUnitScreenPosition(unit) {
        if (unit.q === undefined || unit.r === undefined) return null;

        // 3D位置を取得
        const pos = this.hexToWorld3D(unit.q, unit.r);

        // ユニットの高さ（概算）
        // ユニットの足元(0)〜中心(30)あたりを基準にする
        const y = 30;

        // ベクトルを作成
        const vector = new THREE.Vector3(pos.x, y, pos.z);

        // カメラ空間に投影
        vector.project(this.camera);

        // 正規化デバイス座標からスクリーン座標に変換
        // canvas.width/heightはバッファサイズ（Retina等で大きくなる）なので
        // clientWidth/clientHeight（CSSサイズ）を使用する
        const widthHalf = this.canvas.clientWidth / 2;
        const heightHalf = this.canvas.clientHeight / 2;

        const x = (vector.x * widthHalf) + widthHalf;
        const yScreen = -(vector.y * heightHalf) + heightHalf;

        // カメラの前にあるかチェック (z < 1)
        if (vector.z > 1) return null; // カメラの後ろ

        return { x, y: yScreen };
    }

    /**
     * 3Dワールド座標(x, z)をHEX座標(q, r)に変換
     */
    world3DToHex(x, z) {
        // axial coordinatesへの変換
        const q = (Math.sqrt(3) / 3 * x - 1 / 3 * z) / HEX_SIZE;
        const r = (2 / 3 * z) / HEX_SIZE;

        return this.axialRound(q, r);
    }

    /**
     * Axial座標の丸め処理
     */
    axialRound(q, r) {
        let s = -q - r;
        let roundQ = Math.round(q);
        let roundR = Math.round(r);
        let roundS = Math.round(s);

        const qDiff = Math.abs(roundQ - q);
        const rDiff = Math.abs(roundR - r);
        const sDiff = Math.abs(roundS - s);

        if (qDiff > rDiff && qDiff > sDiff) {
            roundQ = -roundR - roundS;
        } else if (rDiff > sDiff) {
            roundR = -roundQ - roundS;
        }

        return { q: roundQ, r: roundR };
    }
}
