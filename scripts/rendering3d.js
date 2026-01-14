/**
 * SEKIGAHARA RTS - 3D Rendering Engine
 * Three.jsベースの3Dレンダリングシステム
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HEX_SIZE, TILE_SIZE, TILE_HEIGHT, MAP_W, MAP_H, WARLORDS } from './constants.js';
import { KamonDrawer } from './kamon.js';
import { ANIMATIONS, DIRECTIONS, getSpriteInfo, getAllSpritePaths } from './sprite-config.js';
import TerrainManager from './terrain-manager.js';

export class RenderingEngine3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.groundMesh = null; // 地形メッシュ（Raycast用）
        this.canvas = canvas;
        this.groundMesh = null; // 地形メッシュ（Raycast用）
        this.unitMeshes = new Map(); // ユニットID -> Mesh
        this.effects = []; // 3Dエフェクト
        this.hexHeights = []; // 地形高さキャッシュ
        this.unitGeometry = null; // ユニット用ジオメトリ（共有）

        // スプライト関連
        this.spriteTextures = new Map(); // スプライトシートテクスチャキャッシュ
        this.unitAnimationStates = new Map(); // ユニットID -> {anim, frame, lastUpdate}
        this.loadSpriteTextures();




        // Three.js基本セットアップ
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a2a1a); // 暗めのグレーグリーン（オーバーレイと調和）

        // Terrain Manager (New Prototype)
        this.useTerrainManager = false; // REVERTED AS REQUESTED
        this.terrainManager = new TerrainManager(this);
        this.terrainManager.init();

        // カメラセットアップ（OrthographicCamera：平行投影でアイソメトリック表示）
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 800; // 視野の大きさ（調整可能）
        this.frustumSize = frustumSize;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,  // left
            frustumSize * aspect / 2,   // right
            frustumSize / 2,            // top
            frustumSize / -2,           // bottom
            1,                          // near
            10000                       // far
        );
        // クォータービュー：ユーザー指定のカスタム設定 (2026/01/12)
        // Position: (x=0, y=428, z=1242), Target: (x=-4, y=-118, z=492), Zoom: 1.47
        this.camera.position.set(0, 428, 1242);
        this.camera.zoom = 1.47;
        this.camera.updateProjectionMatrix();

        // lookAtは初期化時に設定（OrbitControlsのtargetと合わせる）
        this.camera.lookAt(-4, -118, 492);

        // レンダラーセットアップ
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true  // アルファ透過を有効化
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // コントロール（カメラ操作）
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        // OrthographicCamera用：ズームは距離ではなくスケールで制御
        this.controls.enableZoom = true;
        this.controls.minZoom = 0.5;
        this.controls.maxZoom = 3;
        this.controls.maxPolarAngle = Math.PI / 2.5; // 地平線より手前で止める（約72度）

        // マウス操作の割り当てを変更（左クリックをゲーム操作用に開放）
        this.controls.mouseButtons = {
            LEFT: null, // 左ドラッグ：無効（範囲選択などに使用）
            MIDDLE: THREE.MOUSE.DOLLY, // 中ドラッグ：ズーム
            RIGHT: THREE.MOUSE.PAN     // 右ドラッグ：平行移動（パン）
        };

        // タッチ操作の割り当て（1本指をゲーム操作用に開放）
        this.controls.touches = {
            ONE: null, // 1本指ドラッグ：無効（範囲選択などに使用）
            TWO: THREE.TOUCH.DOLLY_PAN // 2本指：移動とズーム
        };

        // OrbitControlsのターゲットをユーザー指定値に設定
        this.controls.target.set(-4, -118, 492);
        // 回転を無効化（固定アイソメトリック視点）
        this.controls.enableRotate = false;

        // マウス位置追跡（画面端での回転用）
        this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.isRightMouseDown = false; // 右クリック状態

        // デバッグ用: カメラ情報を画面に表示（ユーザー調整用）
        this.createCameraDebugOverlay();
        this.controls.addEventListener('change', () => {
            this.updateCameraDebugInfo();
        });

        // 初回表示更新
        this.updateCameraDebugInfo();

        // F9キーでデバッグ表示切り替え
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F9') {
                this.toggleCameraDebugOverlay();
            }
        });

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
        // アイソメトリックグリッドのサイズを計算
        const gridWorldWidth = (MAP_W + MAP_H) * TILE_SIZE / 2;
        const gridWorldHeight = (MAP_W + MAP_H) * TILE_SIZE / 4;

        // グリッドの中心
        const centerX = 0;
        const centerZ = gridWorldHeight / 2;

        // クラスメンバとして保存
        this.gridWidth = gridWorldWidth;
        this.gridHeight = gridWorldHeight;
        this.gridCenterX = centerX;
        this.gridCenterZ = centerZ;

        // 地形テクスチャとハイトマップをロード
        const textureLoader = new THREE.TextureLoader();
        this.groundTexture = textureLoader.load('./assets/textures/ground_sekigahara.jpg');

        // ハイトマップをロードして解析
        const heightMapImage = new Image();
        heightMapImage.crossOrigin = 'anonymous';
        heightMapImage.onload = () => {
            // ハイトマップから各タイルの高さを読み取り
            this.buildTerrainFromHeightmap(heightMapImage);
        };
        heightMapImage.src = './assets/textures/height_sekigahara.jpg';

        // テクスチャ設定
        this.groundTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.groundTexture.wrapT = THREE.ClampToEdgeWrapping;

        // Raycast用の不可視平面
        const groundPlaneGeometry = new THREE.PlaneGeometry(
            gridWorldWidth * 2,
            gridWorldHeight * 2
        );
        const groundPlaneMaterial = new THREE.MeshBasicMaterial({ visible: false });
        this.groundMesh = new THREE.Mesh(groundPlaneGeometry, groundPlaneMaterial);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.position.set(centerX, 0, centerZ);
        this.scene.add(this.groundMesh);

        // タイルグループを作成
        this.tileGroup = new THREE.Group();
        this.scene.add(this.tileGroup);

        // グリッド線オーバーレイ
        this.createIsometricGridOverlay();
    }

    /**
     * ハイトマップからタイル地形を構築
     */
    buildTerrainFromHeightmap(heightMapImage) {
        // Canvasでハイトマップを読み取る
        const canvas = document.createElement('canvas');
        canvas.width = heightMapImage.width;
        canvas.height = heightMapImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(heightMapImage, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // MapSystemの高さデータを更新
        if (this.mapSystem) {
            const tiles = this.mapSystem.getMap();

            // 第1パス：ハイトマップから生の高さを読み取り
            for (let y = 0; y < MAP_H; y++) {
                for (let x = 0; x < MAP_W; x++) {
                    const u = x / MAP_W;
                    const v = y / MAP_H;
                    const imgX = Math.floor(u * (canvas.width - 1));
                    const imgY = Math.floor(v * (canvas.height - 1));
                    const idx = (imgY * canvas.width + imgX) * 4;
                    const heightVal = imageData.data[idx]; // R channel

                    // 高さを0-5段階に変換（山はより高く）
                    const z = Math.floor(heightVal / 255 * 5);
                    tiles[y][x].z = z;
                }
            }

            // 第2パス：スムージング（隣接タイルと平均化）
            const tempHeights = [];
            for (let y = 0; y < MAP_H; y++) {
                tempHeights[y] = [];
                for (let x = 0; x < MAP_W; x++) {
                    let sum = tiles[y][x].z;
                    let count = 1;
                    // 4方向の隣接タイルをチェック
                    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
                    for (const [dx, dy] of dirs) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
                            sum += tiles[ny][nx].z;
                            count++;
                        }
                    }
                    tempHeights[y][x] = Math.round(sum / count);
                }
            }

            // スムージング結果を適用
            for (let y = 0; y < MAP_H; y++) {
                for (let x = 0; x < MAP_W; x++) {
                    tiles[y][x].z = tempHeights[y][x];
                }
            }
        }

        // タイルメッシュを生成
        this.createIsometricTiles();
    }

    /**
     * アイソメトリックタイルメッシュを生成（1枚テクスチャをUVで参照）
     */
    createIsometricTiles() {
        if (this.useTerrainManager) {
            const tiles = this.mapSystem.getMap();
            if (tiles) {
                this.terrainManager.createTerrain(tiles);
                this.hexHeights = [];
                // Update hexHeights cache for gameplay logic
                for (let y = 0; y < MAP_H; y++) {
                    this.hexHeights[y] = [];
                    for (let x = 0; x < MAP_W; x++) {
                        const tile = tiles[y][x];
                        const worldPos = this.gridToWorld3D(x, y, tile.z);
                        this.hexHeights[y][x] = worldPos.y;
                    }
                }
                console.log("Using TerrainManager for terrain rendering.");
                return;
            }
        }

        // 既存タイルをクリア
        while (this.tileGroup.children.length > 0) {
            const child = this.tileGroup.children[0];
            this.tileGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }

        if (!this.mapSystem) return;
        const tiles = this.mapSystem.getMap();
        if (!tiles) return;

        // hexHeightsキャッシュを初期化
        this.hexHeights = [];

        // 崖側面用のマテリアル
        const cliffMaterial = new THREE.MeshStandardMaterial({
            color: 0x5a4a3a,
            roughness: 0.95,
            metalness: 0.0,
            side: THREE.DoubleSide
        });

        for (let y = 0; y < MAP_H; y++) {
            this.hexHeights[y] = [];
            for (let x = 0; x < MAP_W; x++) {
                const tile = tiles[y][x];
                const worldPos = this.gridToWorld3D(x, y, tile.z);

                // タイル用の菱形ジオメトリを作成
                const tileShape = new THREE.Shape();
                const hw = TILE_SIZE / 2;
                const hh = TILE_SIZE / 4;
                tileShape.moveTo(0, -hh);
                tileShape.lineTo(hw, 0);
                tileShape.lineTo(0, hh);
                tileShape.lineTo(-hw, 0);
                tileShape.closePath();

                const tileGeometry = new THREE.ShapeGeometry(tileShape);

                // UV座標を設定（マップ全体の中での位置）
                const positions = tileGeometry.attributes.position;
                const uvs = new Float32Array(positions.count * 2);

                // タイルのUV範囲を計算
                const uBase = x / MAP_W;
                const vBase = 1 - (y / MAP_H); // V座標は反転
                const uSize = 1 / MAP_W;
                const vSize = 1 / MAP_H;

                for (let i = 0; i < positions.count; i++) {
                    const localX = positions.getX(i);
                    const localY = positions.getY(i);
                    // ローカル座標をUVオフセットに変換
                    uvs[i * 2] = uBase + (localX / (hw * 2) + 0.5) * uSize;
                    uvs[i * 2 + 1] = vBase - (localY / (hh * 2) + 0.5) * vSize;
                }
                tileGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

                // 高さに基づく明度調整
                const brightness = 0.7 + (tile.z / 7) * 0.3;

                const material = new THREE.MeshStandardMaterial({
                    map: this.groundTexture,
                    color: new THREE.Color(brightness, brightness, brightness),
                    roughness: 0.85,
                    metalness: 0.05,
                    side: THREE.DoubleSide
                });

                const tileMesh = new THREE.Mesh(tileGeometry, material);
                tileMesh.rotation.x = -Math.PI / 2;
                tileMesh.position.set(worldPos.x, worldPos.y, worldPos.z);
                tileMesh.receiveShadow = true;

                // Raycast用に座標データを保存
                tileMesh.userData = { x: x, y: y, z: tile.z };

                this.tileGroup.add(tileMesh);
                this.hexHeights[y][x] = worldPos.y;

                // 崖の側面を描画
                this.addCliffSides(x, y, tile.z, tiles, cliffMaterial);
            }
        }

        console.log('Isometric terrain built from heightmap');
    }

    /**
     * MapSystem設定後にタイルを更新
     */
    updateTerrainTiles(tileGeometry, terrainColors, terrainTextures = {}) {
        // 既存のタイルをクリア
        while (this.tileGroup.children.length > 0) {
            const child = this.tileGroup.children[0];
            this.tileGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }

        const tiles = this.mapSystem.getMap();
        if (!tiles || tiles.length === 0) return;

        // hexHeightsキャッシュを初期化
        this.hexHeights = [];

        // 崖側面用のマテリアル（暗めの茶色）
        const cliffMaterial = new THREE.MeshStandardMaterial({
            color: 0x5a4a3a,
            roughness: 0.95,
            metalness: 0.0,
            side: THREE.DoubleSide
        });

        // タイルタイプごとのマテリアルをキャッシュ（パフォーマンス最適化）
        const materialCache = {};

        for (let y = 0; y < MAP_H; y++) {
            this.hexHeights[y] = [];
            for (let x = 0; x < MAP_W; x++) {
                const tile = tiles[y][x];
                const worldPos = this.gridToWorld3D(x, y, tile.z);

                // マテリアルのキャッシュキー（タイプと高さ）
                const cacheKey = `${tile.type}_${tile.z}`;

                let material;
                if (materialCache[cacheKey]) {
                    material = materialCache[cacheKey];
                } else {
                    // 高さに基づく明度調整
                    const brightness = 0.7 + (tile.z / 8) * 0.3;

                    // テクスチャがあれば使用、なければ色
                    const texture = terrainTextures[tile.type];
                    if (texture) {
                        material = new THREE.MeshStandardMaterial({
                            map: texture,
                            color: new THREE.Color(brightness, brightness, brightness),
                            roughness: 0.85,
                            metalness: 0.05,
                            side: THREE.DoubleSide
                        });
                    } else {
                        const baseColor = terrainColors[tile.type] || 0x888888;
                        const color = new THREE.Color(baseColor);
                        color.multiplyScalar(brightness);
                        material = new THREE.MeshStandardMaterial({
                            color: color,
                            roughness: 0.9,
                            metalness: 0.1,
                            side: THREE.DoubleSide
                        });
                    }
                    materialCache[cacheKey] = material;
                }

                const tileMesh = new THREE.Mesh(tileGeometry, material);
                tileMesh.rotation.x = -Math.PI / 2;
                tileMesh.position.set(worldPos.x, worldPos.y, worldPos.z);
                tileMesh.receiveShadow = true;
                tileMesh.castShadow = false; // シャドウを無効化してアーティファクトを回避

                this.tileGroup.add(tileMesh);

                // hexHeightsキャッシュに保存（ユニット高さ合わせ用）
                this.hexHeights[y][x] = worldPos.y;

                // 崖の側面を描画（隣接タイルとの高さ差をチェック）
                this.addCliffSides(x, y, tile.z, tiles, cliffMaterial);
            }
        }
    }

    /**
     * 崖の側面を追加（菱形タイルの4辺に沿って）
     */
    addCliffSides(x, y, z, tiles, cliffMaterial) {
        if (z === 0) return; // 高さ0の場合は側面不要

        const worldPos = this.gridToWorld3D(x, y, z);
        const hw = TILE_SIZE / 2;  // タイル幅の半分
        const hh = TILE_SIZE / 4;  // タイル高さの半分（アイソメトリック）

        // 菱形の4つの頂点（上面）
        const topVertices = [
            { x: worldPos.x, z: worldPos.z - hh },  // 上（北）
            { x: worldPos.x + hw, z: worldPos.z },  // 右（東）
            { x: worldPos.x, z: worldPos.z + hh },  // 下（南）
            { x: worldPos.x - hw, z: worldPos.z }   // 左（西）
        ];

        // 4方向の隣接タイルと対応する辺（上下左右）
        const edges = [
            { dx: 0, dy: -1, v1: 0, v2: 1, name: '北' },   // 上辺：上のタイルに接続
            { dx: 1, dy: 0, v1: 1, v2: 2, name: '東' },    // 右辺：右のタイルに接続
            { dx: 0, dy: 1, v1: 2, v2: 3, name: '南' },    // 下辺：下のタイルに接続
            { dx: -1, dy: 0, v1: 3, v2: 0, name: '西' }    // 左辺：左のタイルに接続
        ];

        const topY = worldPos.y;

        for (const edge of edges) {
            const nx = x + edge.dx;
            const ny = y + edge.dy;

            // 隣接タイルの高さを取得
            let neighborZ = 0;
            if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
                neighborZ = tiles[ny][nx].z;
            }

            // 高さ差がある場合、その辺に側面を描画
            if (z > neighborZ) {
                const bottomY = neighborZ * TILE_HEIGHT;
                const v1 = topVertices[edge.v1];
                const v2 = topVertices[edge.v2];

                // 四角形の4頂点（上辺の2点 + 下辺の2点）
                const vertices = new Float32Array([
                    v1.x, topY, v1.z,      // 上辺・頂点1
                    v1.x, bottomY, v1.z,   // 下辺・頂点1
                    v2.x, bottomY, v2.z,   // 下辺・頂点2
                    v2.x, topY, v2.z       // 上辺・頂点2
                ]);

                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                geometry.setIndex([0, 1, 2, 0, 2, 3]);
                geometry.computeVertexNormals();

                const cliffMesh = new THREE.Mesh(geometry, cliffMaterial);
                cliffMesh.receiveShadow = true;
                cliffMesh.castShadow = false;
                this.tileGroup.add(cliffMesh);
            }
        }
    }

    /**
     * プレースホルダー地形（mapSystem設定前）
     */
    createPlaceholderTerrain(tileGeometry) {
        const material = new THREE.MeshStandardMaterial({
            color: 0x4a7c3a,
            roughness: 0.9,
            metalness: 0.1
        });

        for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
                const worldPos = this.gridToWorld3D(x, y, 0);
                const tileMesh = new THREE.Mesh(tileGeometry, material);
                tileMesh.rotation.x = -Math.PI / 2;
                tileMesh.position.set(worldPos.x, 0, worldPos.z);
                this.tileGroup.add(tileMesh);
            }
        }
    }

    /**
     * アイソメトリックグリッド線オーバーレイを生成
     */
    createIsometricGridOverlay() {
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x444444,
            transparent: true,
            opacity: 0.3
        });

        const gridGroup = new THREE.Group();

        // 各タイルの境界線を描画
        for (let y = 0; y <= MAP_H; y++) {
            for (let x = 0; x <= MAP_W; x++) {
                // 水平線（X方向）
                if (x < MAP_W) {
                    const start = this.gridToWorld3D(x, y, 0);
                    const end = this.gridToWorld3D(x + 1, y, 0);
                    const points = [
                        new THREE.Vector3(start.x, 2, start.z),
                        new THREE.Vector3(end.x, 2, end.z)
                    ];
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geometry, lineMaterial);
                    gridGroup.add(line);
                }

                // 垂直線（Y方向）
                if (y < MAP_H) {
                    const start = this.gridToWorld3D(x, y, 0);
                    const end = this.gridToWorld3D(x, y + 1, 0);
                    const points = [
                        new THREE.Vector3(start.x, 2, start.z),
                        new THREE.Vector3(end.x, 2, end.z)
                    ];
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geometry, lineMaterial);
                    gridGroup.add(line);
                }
            }
        }

        this.scene.add(gridGroup);
        this.gridOverlay = gridGroup;
    }

    /**
     * MapSystemへの参照を設定
     */
    setMapSystem(mapSystem) {
        this.mapSystem = mapSystem;
        // 高さキャッシュはハイトマップロード時にcreateIsometricTiles()で初期化される
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

                // 高さキャッシュに保存 (displacementScale = 50)
                if (!this.hexHeights[r]) this.hexHeights[r] = [];
                this.hexHeights[r][q] = (heightVal / 255) * 50;

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
    addHexOverlay(q, r, color, opacity, isRange = false) {
        const center = this.gridToWorld3D(q, r);
        const vertices = this.getHexagonVertices(q, r);

        // 六角形（菱形）の形状を作成
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
        // 少し浮かせる（カーソルよりは下、地面より上）
        let y = 0;
        if (this.hexHeights && this.hexHeights[r] && this.hexHeights[r][q] !== undefined) {
            y = this.hexHeights[r][q];
        }
        overlay.position.set(center.x, y + 1.0, center.z);
        this.scene.add(overlay);

        if (isRange) {
            if (!this.rangeOverlays) this.rangeOverlays = [];
            this.rangeOverlays.push(overlay);
        }

        return overlay;
    }

    /**
     * 移動範囲のハイライトを表示
     * @param {Array<{x, y}>} tiles 
     * @param {number} color 
     */
    showMoveRange(tiles, color = 0x0000ff) {
        this.clearMoveRange();
        tiles.forEach(t => {
            this.addHexOverlay(t.x, t.y, color, 0.3, true);
        });
    }

    /**
     * 移動範囲のハイライトを消去
     */
    clearMoveRange() {
        if (this.rangeOverlays) {
            this.rangeOverlays.forEach(mesh => {
                this.scene.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) mesh.material.dispose();
            });
        }
        this.rangeOverlays = [];
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

        // 再利用可能なVector3オブジェクト（GC負荷軽減）
        if (!this._tempVec3) {
            this._tempVec3 = new THREE.Vector3();
            this._tempAnimOffset = new THREE.Vector3();
        }

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

            // アニメーション処理（キャッシュされたVector3を再利用）
            this._tempAnimOffset.set(0, 0, 0);
            if (mesh.userData.attackAnim && mesh.userData.attackAnim.active) {
                const anim = mesh.userData.attackAnim;
                anim.progress++;

                const t = anim.progress / anim.duration;
                let scale = 0;

                if (t < 0.2) {
                    scale = t / 0.2;
                } else if (t < 0.4) {
                    scale = 1.0;
                } else {
                    scale = 1.0 - (t - 0.4) / 0.6;
                }

                if (t >= 1.0) {
                    anim.active = false;
                    scale = 0;
                }

                this._tempAnimOffset.copy(anim.offsetVec).multiplyScalar(scale);
            }

            // 位置更新
            const rawPos = this.gridToWorld3D(unit.x, unit.y);

            // 地形高さを取得（hexHeightsキャッシュを優先）
            let groundHeight = 0;
            if (this.hexHeights && this.hexHeights[unit.y] && this.hexHeights[unit.y][unit.x] !== undefined) {
                groundHeight = this.hexHeights[unit.y][unit.x];
            }

            // 建物がある場合は建物の高さを使用
            if (window.game && window.game.buildingSystem) {
                const bInfo = window.game.buildingSystem.getBuildingHeight(unit.x, unit.y);
                if (bInfo && bInfo.isBuilding) {
                    groundHeight = Math.max(groundHeight, bInfo.height);
                }
            }

            // キャッシュされたVector3を再利用
            this._tempVec3.set(rawPos.x, groundHeight + 2, rawPos.z);
            this._tempVec3.add(this._tempAnimOffset);

            // グリッド移動検出（位置追跡を初期化）
            if (!mesh.userData.lastGridX) {
                mesh.userData.lastGridX = unit.x;
                mesh.userData.lastGridY = unit.y;
                mesh.userData.lastGroundHeight = groundHeight;
            }

            // グリッド位置が変わった場合
            const gridChanged = (mesh.userData.lastGridX !== unit.x || mesh.userData.lastGridY !== unit.y);
            const heightDiff = groundHeight - mesh.userData.lastGroundHeight;

            if (gridChanged && Math.abs(heightDiff) > 0.01) {
                // 段差移動アニメーション開始
                mesh.userData.elevAnim = {
                    active: true,
                    progress: 0,
                    duration: 6, // 非常に短い（約100ms）
                    startX: mesh.position.x,
                    startZ: mesh.position.z,
                    startY: mesh.position.y,
                    targetX: rawPos.x,
                    targetZ: rawPos.z,
                    targetBaseY: groundHeight + 2,
                    heightDiff: heightDiff,
                    lastHeight: mesh.userData.lastGroundHeight
                };
            }

            // 段差移動アニメーション処理
            let elevYOffset = 0;
            if (mesh.userData.elevAnim && mesh.userData.elevAnim.active) {
                const anim = mesh.userData.elevAnim;
                anim.progress++;

                if (anim.progress >= anim.duration) {
                    // アニメーション完了
                    anim.active = false;
                } else {
                    const t = anim.progress / anim.duration;

                    // 水平位置は線形補間（カクッと動かす）
                    mesh.position.x = anim.startX + (anim.targetX - anim.startX) * t;
                    mesh.position.z = anim.startZ + (anim.targetZ - anim.startZ) * t;

                    // 垂直方向：段差に沿って移動 + 小さなジャンプ
                    // 前半で旧高さから新高度へ、後半でそこから目標位置へ
                    // その途中で微小なジャンプ（高さ0.3程度、持続時間の中央付近）
                    const prevHeight = anim.lastHeight + 2;
                    const newHeight = anim.targetBaseY;

                    // 基本の高さ変化（段差に沿った移動）
                    let baseY;
                    if (t < 0.5) {
                        // 前半：旧高さから中間点へ
                        baseY = prevHeight + (newHeight - prevHeight) * (t * 2);
                    } else {
                        // 後半：中間点から新高さへ
                        baseY = newHeight;
                    }

                    // 小さなジャンプ（正弦波、中央の短い区間のみ）
                    // t=0.35-0.65の間だけで発動、最大高さ0.3
                    let jumpOffset = 0;
                    const jumpCenter = 0.5;
                    const jumpWidth = 0.15; // ジャンプの幅（狭くする）
                    if (Math.abs(t - jumpCenter) < jumpWidth) {
                        const jumpT = (t - (jumpCenter - jumpWidth)) / (jumpWidth * 2); // 0 to 1 within jump window
                        jumpOffset = Math.sin(jumpT * Math.PI) * 0.3; // 最大0.3のジャンプ
                    }

                    elevYOffset = baseY + jumpOffset - anim.targetBaseY;
                }
            }

            this._tempVec3.y += elevYOffset;

            // 現在位置とターゲット位置が離れている場合のみ更新（段差アニメ中は常に更新）
            if (mesh.userData.elevAnim?.active || this._tempAnimOffset.lengthSq() > 0 ||
                Math.abs(mesh.position.x - this._tempVec3.x) > 0.1 ||
                Math.abs(mesh.position.z - this._tempVec3.z) > 0.1 ||
                Math.abs(mesh.position.y - this._tempVec3.y) > 0.1) {
                if (!mesh.userData.elevAnim?.active) {
                    mesh.position.x = this._tempVec3.x;
                    mesh.position.z = this._tempVec3.z;
                }
                mesh.position.y = this._tempVec3.y;
            }

            // 位置情報を更新
            mesh.userData.lastGridX = unit.x;
            mesh.userData.lastGridY = unit.y;
            mesh.userData.lastGroundHeight = groundHeight;

            // 画面正対ビルボード - スプライトがカメラのビュー平面に完全に平行
            // 画面上では常にまっすぐ立って見える
            const sprite = mesh.getObjectByName('unitSprite');
            if (sprite && this.camera) {
                // カメラのクォータニオンをコピーして、スプライトをカメラと同じ向きに
                sprite.quaternion.copy(this.camera.quaternion);
            }

            // 選択状態のハイライト更新
            const isSelected = window.game && window.game.selectedUnits && window.game.selectedUnits.some(u => u.id === unit.id);
            if (mesh.material) {
                if (mesh.userData.flashTime > 0) {
                    // フラッシュ中
                    mesh.material.emissive.setHex(mesh.userData.flashColor || 0xFFFFFF);
                    mesh.userData.flashTime--;
                } else if (isSelected) {
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

            // スプライトアニメーション更新
            // 優先順位: 死亡 > 被ダメージ > 攻撃中 > 行動済み(静止) > 移動中 > 未行動(待機)
            let animType = 'ready'; // デフォルト: 未行動（01-02ループ）

            if (unit.isDying) {
                // 死亡アニメーション（06パターン）
                animType = 'death';
            } else if (unit.isDamaged) {
                // 被ダメージアニメーション（05パターン）
                animType = 'damage';
            } else if (unit.isAttacking) {
                // 攻撃アニメーション中
                animType = 'attack';
            } else if (unit.hasActed) {
                // 行動済み（静止）- 攻撃や移動が完了した後
                animType = 'idle';
            } else if (unit.order && (unit.order.type === 'MOVE' || unit.order.type === 'ATTACK')) {
                // 移動中または攻撃のため移動中
                animType = 'walk';
            }
            // else: ready（未行動、待機中）

            this.updateSpriteAnimation(unit.id, unit, animType);

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
     * スプライトテクスチャをロード（個別ファイル版 + 色相シフト）
     * 東軍=オリジナル（青系）、西軍=色相シフト（赤系）
     */
    loadSpriteTextures() {
        const paths = getAllSpritePaths();

        for (const path of paths) {
            // 画像をロードしてからテクスチャを作成
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                // オリジナル（東軍用）
                const eastTexture = this.createTextureFromImage(img);
                this.spriteTextures.set(`EAST:${path}`, eastTexture);

                // 色相シフト版（西軍用）- 青→赤
                const westCanvas = this.hueShiftImage(img, 180); // 180度シフトで青→赤
                const westTexture = this.createTextureFromCanvas(westCanvas);
                this.spriteTextures.set(`WEST:${path}`, westTexture);
            };
            img.src = path;
        }
    }

    /**
     * 画像からテクスチャを作成
     */
    createTextureFromImage(img) {
        const texture = new THREE.Texture(img);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.premultiplyAlpha = false; // アルファ透過を正しく処理
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * Canvasからテクスチャを作成
     */
    createTextureFromCanvas(canvas) {
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.premultiplyAlpha = false; // アルファ透過を正しく処理
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * 画像の色相をシフト（青→赤変換用）
     * @param {HTMLImageElement} img - 元画像
     * @param {number} hueShift - 色相シフト量（度）
     * @returns {HTMLCanvasElement}
     */
    hueShiftImage(img, hueShift) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // 透明ピクセルはスキップ
            if (a === 0) continue;

            // RGB to HSL
            const [h, s, l] = this.rgbToHsl(r, g, b);

            // 色相シフト
            const newH = (h + hueShift / 360) % 1;

            // HSL to RGB
            const [newR, newG, newB] = this.hslToRgb(newH, s, l);

            data[i] = newR;
            data[i + 1] = newG;
            data[i + 2] = newB;
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * RGB to HSL変換
     */
    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return [h, s, l];
    }

    /**
     * HSL to RGB変換
     */
    hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    /**
     * ユニットメッシュを作成して返す（個別スプライトファイル版）
     */
    createUnitMesh(unit) {
        // コンテナグループを作成
        const group = new THREE.Group();
        group.userData = { unitId: unit.id };

        const size = HEX_SIZE * 0.6;
        const side = unit.side || 'EAST';

        // 1. スプライトビルボード（PlaneGeometryを使用してフリップ対応）
        const planeGeo = new THREE.PlaneGeometry(size * 2, size * 2);
        const initialSpriteInfo = getSpriteInfo(unit.dir || 0, '00');
        // 所属軍に応じたテクスチャを取得（EAST=青, WEST=赤）
        const textureKey = `${side}:${initialSpriteInfo.path}`;
        const initialTexture = this.spriteTextures.get(textureKey);

        const planeMat = new THREE.MeshBasicMaterial({
            map: initialTexture || null,
            transparent: true,
            side: THREE.DoubleSide,
            alphaTest: 0.5,      // アルファが0.5以下のピクセルは描画しない
            depthWrite: false,   // 深度バッファに書き込まない
            depthTest: false     // 深度テスト無効（常に地形の上に描画）
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.position.y = size * 1.0;
        plane.name = 'unitSprite';
        plane.renderOrder = 100; // 地形より後に描画（高い値=後に描画）
        group.add(plane);

        // アニメーション状態を初期化
        this.unitAnimationStates.set(unit.id, {
            anim: 'idle',
            frame: 0,
            lastUpdate: Date.now(),
            dir: unit.dir || 0,
            side: side,
            material: planeMat,
            mesh: plane
        });

        // 3. 本陣の場合、金色のリングを追加
        if (unit.unitType === 'HEADQUARTERS') {
            const ringGeo = new THREE.RingGeometry(size * 0.9, size * 1.0, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xFFD700, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 2;
            ring.name = 'hqRing';
            group.add(ring);
        }

        // 4. 選択リング（初期状態は非表示）
        const selRingGeo = new THREE.RingGeometry(size * 1.0, size * 1.1, 32);
        const selRingMat = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
            depthTest: false
        });
        const selRing = new THREE.Mesh(selRingGeo, selRingMat);
        selRing.rotation.x = -Math.PI / 2;
        selRing.name = 'selectionRing';
        selRing.position.y = 3;
        selRing.renderOrder = 999;
        selRing.visible = false;
        group.add(selRing);

        // 5. HitBox（クリック判定用）
        const hitBoxGeo = new THREE.BoxGeometry(size * 1.5, size * 2, size * 1.5);
        const hitBoxMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
        hitBox.name = 'hitBox';
        hitBox.position.y = size;
        group.add(hitBox);

        // 情報オーバーレイ初期作成
        this.createUnitInfoOverlay(group, unit);

        return group;
    }

    /**
     * スプライトアニメーションを更新（個別ファイル版）
     * @param {number} unitId - ユニットID
     * @param {Object} unit - ユニットオブジェクト
     * @param {string} animName - 切り替えるアニメーション名（省略時は現在のまま）
     */
    updateSpriteAnimation(unitId, unit = null, animName = null) {
        const state = this.unitAnimationStates.get(unitId);
        if (!state) return;

        const now = Date.now();

        // アニメーション切り替え
        if (animName && animName !== state.anim && ANIMATIONS[animName]) {
            state.anim = animName;
            state.frame = 0;
            state.lastUpdate = now;
        }

        const anim = ANIMATIONS[state.anim];
        if (!anim) return;

        // 方向更新
        if (unit && unit.dir !== undefined) {
            state.dir = unit.dir;
        }

        // フレーム更新
        if (now - state.lastUpdate >= anim.speed) {
            const frameCount = anim.frameIds.length;
            state.frame++;
            if (state.frame >= frameCount) {
                state.frame = anim.loop ? 0 : frameCount - 1;
            }
            state.lastUpdate = now;
        }

        // テクスチャを切り替え（所属軍に応じた色）
        const frameId = anim.frameIds[state.frame];
        const spriteInfo = getSpriteInfo(state.dir, frameId);
        // 寝返り対応: ユニットの現在のsideを使用（キャッシュされたstate.sideではなく）
        const currentSide = unit && unit.side ? unit.side : state.side;
        const textureKey = `${currentSide}:${spriteInfo.path}`;
        const texture = this.spriteTextures.get(textureKey);

        if (texture && state.material) {
            state.material.map = texture;
            state.material.needsUpdate = true;

            // 反転が必要な場合はスケールでフリップ
            if (state.mesh) {
                state.mesh.scale.x = spriteInfo.flip ? -1 : 1;
            }
        }
    }

    /**
     * ユニットの攻撃アニメーションをトリガー
     * @param {string} attackerId - 攻撃者のユニットID
     * @param {string} targetId - 攻撃対象のユニットID
     */
    triggerUnitAttackAnimation(attackerId, targetId) {
        // 攻撃者にisAttackingフラグを立てる（一定時間後に解除）
        if (window.game && window.game.unitManager) {
            const units = window.game.unitManager.getUnits();
            const attacker = units.find(u => u.id === attackerId);
            if (attacker) {
                attacker.isAttacking = true;
                // 攻撃アニメーション終了後にフラグを解除
                setTimeout(() => {
                    attacker.isAttacking = false;
                }, 900); // 攻撃アニメーションの持続時間
            }
        }
    }

    /**
     * ユニットの被ダメージアニメーションをトリガー
     * @param {string} unitId - ダメージを受けたユニットのID
     */
    triggerDamageAnimation(unitId) {
        if (window.game && window.game.unitManager) {
            const units = window.game.unitManager.getAllUnits();
            const unit = units.find(u => u.id === unitId);
            if (unit) {
                unit.isDamaged = true;
                // ダメージアニメーション後にフラグを解除
                setTimeout(() => {
                    unit.isDamaged = false;
                }, 400); // ダメージアニメーションの持続時間
            }
        }
    }

    /**
     * ユニットの死亡アニメーションをトリガー（倒れ + フェードアウト）
     * @param {string} unitId - 死亡したユニットのID
     */
    triggerDeathAnimation(unitId) {
        const mesh = this.unitMeshes.get(unitId);
        if (!mesh) return;

        // 死亡フラグを立てる（これによりスプライトが倒れパターン06に切り替わる）
        if (window.game && window.game.unitManager) {
            const units = window.game.unitManager.getAllUnits();
            const unit = units.find(u => u.id === unitId);
            if (unit) {
                unit.isDying = true;
            }
        }

        // スプライトを取得
        const sprite = mesh.getObjectByName('unitSprite');
        if (sprite && sprite.material) {
            // まず倒れスプライトを見せるために少し待つ
            setTimeout(() => {
                // フェードアウト開始
                let opacity = 1.0;
                const fadeInterval = setInterval(() => {
                    opacity -= 0.05;
                    sprite.material.opacity = Math.max(0, opacity);
                    sprite.material.needsUpdate = true;

                    if (opacity <= 0) {
                        clearInterval(fadeInterval);
                        // フェードアウト完了後にメッシュを非表示
                        mesh.visible = false;
                    }
                }, 50); // 50ms間隔で20回 = 1秒でフェードアウト
            }, 800); // 800ms後にフェードアウト開始（倒れスプライトを見せる時間）
        }
    }

    /**
     * ユニット情報オーバーレイ（兵士ゲージ、家紋）を作成
     */
    createUnitInfoOverlay(mesh, unit) {
        // 兵士ゲージ用スプライト
        const barSprite = this.createBarSprite(unit);
        barSprite.name = 'barSprite';
        barSprite.position.set(0, 20, 0); // 高さ調整
        mesh.add(barSprite);

        // 本陣マーカーと名前
        if (unit.unitType === 'HEADQUARTERS') {
            const kSprite = this.createKamonSprite(unit);
            kSprite.position.set(0, 35, 0); // 高さ調整
            mesh.add(kSprite);

            // 名前ラベル
            const nameSprite = this.createNameSprite(unit.name);
            nameSprite.position.set(0, 50, 0); // 高さ調整
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
            // 値が変わったときのみ更新
            if (mesh.userData.lastSoldiers === unit.soldiers && mesh.userData.lastMaxSoldiers === unit.maxSoldiers) {
                return;
            }

            // テクスチャのみ更新したいが、CanvasTextureの更新はコストが高いので
            // 兵数が変わったときのみ再描画するロジックを入れるべき
            const texture = barSprite.material.map;
            const canvas = texture.image;
            const ctx = canvas.getContext('2d');
            this.drawBar(ctx, unit.soldiers, unit.maxSoldiers, canvas.width, canvas.height);
            texture.needsUpdate = true;

            // キャッシュ更新
            mesh.userData.lastSoldiers = unit.soldiers;
            mesh.userData.lastMaxSoldiers = unit.maxSoldiers;
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
     * グリッド座標(x, y)を3D空間のワールド座標に変換（クォータービュー/アイソメトリック）
     * @param {number} x - グリッドX座標
     * @param {number} y - グリッドY座標
     * @param {number} z - 高さ（段数、オプション）
     */
    gridToWorld3D(x, y, z = 0) {
        // アイソメトリック変換（45度回転した菱形グリッド）
        const worldX = (x - y) * TILE_SIZE / 2;
        const worldZ = (x + y) * TILE_SIZE / 4;
        const worldY = z * TILE_HEIGHT;
        return { x: worldX, y: worldY, z: worldZ };
    }

    /**
     * 指定グリッドの地面の高さを取得
     */
    getGroundHeight(x, y) {
        if (this.hexHeights && this.hexHeights[y] && this.hexHeights[y][x] !== undefined) {
            return this.hexHeights[y][x];
        }
        return 0;
    }

    /**
     * 旧API互換：ヘックス座標を3D空間のXZ座標に変換
     * @deprecated gridToWorld3Dを使用してください
     */
    hexToWorld3D(q, r) {
        // q -> x, r -> y として新しい変換を使用
        return this.gridToWorld3D(q, r, 0);
    }

    /**
     * 六角形（菱形）の頂点を取得（XZ平面）
     * アイソメトリック用に菱形の頂点を返す
     */
    getHexagonVertices(q, r) {
        // q, r は x, y
        const center = this.gridToWorld3D(q, r);
        const hw = TILE_SIZE / 2;
        const hh = TILE_SIZE / 4;

        // 高さも考慮（できれば）
        let y = 2; // デフォルト（地面すれすれ）
        if (this.hexHeights && this.hexHeights[r] && this.hexHeights[r][q] !== undefined) {
            y = this.hexHeights[r][q] + 2;
        }

        // 菱形の4頂点 (中心からのオフセット)
        // 北、東、南、西
        return [
            new THREE.Vector3(center.x, y, center.z - hh),
            new THREE.Vector3(center.x + hw, y, center.z),
            new THREE.Vector3(center.x, y, center.z + hh),
            new THREE.Vector3(center.x - hw, y, center.z)
        ];
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
     * カーソルを作成（遅延初期化）
     */
    createCursor() {
        const shape = new THREE.Shape();
        const hw = TILE_SIZE / 2;
        const hh = TILE_SIZE / 4;

        // 菱形
        shape.moveTo(0, -hh);
        shape.lineTo(hw, 0);
        shape.lineTo(0, hh);
        shape.lineTo(-hw, 0);
        shape.closePath();

        const geometry = new THREE.ShapeGeometry(shape);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({
            color: 0xffff00,
            linewidth: 2,
            transparent: true,
            opacity: 0.8
        });

        this.cursorMesh = new THREE.LineSegments(edges, material);
        this.cursorMesh.rotation.x = -Math.PI / 2;
        this.cursorMesh.visible = false;
        // 常に最前面に表示されるように深度テストをオフにするか検討したが、
        // 地形に隠れるべき時は隠れたほうが自然なのでオンのまま。
        // ただし少し浮かす。
        this.scene.add(this.cursorMesh);
    }

    /**
     * カーソル位置を更新
     * @param {number|null} q 
     * @param {number|null} r 
     * @param {string|null} text - 表示するテキスト（ターン数など）
     */
    updateCursorPosition(q, r, text = null) {
        if (q === null || r === null) {
            if (this.cursorMesh) this.cursorMesh.visible = false;
            if (this.cursorTextSprite) this.cursorTextSprite.visible = false;
            return;
        }

        if (!this.cursorMesh) this.createCursor();

        const pos = this.gridToWorld3D(q, r);
        let y = 0;
        if (this.hexHeights && this.hexHeights[r] && this.hexHeights[r][q] !== undefined) {
            y = this.hexHeights[r][q];
        }

        this.cursorMesh.position.set(pos.x, y + 2, pos.z);
        this.cursorMesh.visible = true;

        // テキスト表示の更新
        if (text) {
            if (!this.cursorTextSprite) {
                this.cursorTextSprite = this.createCursorTextSprite();
                this.scene.add(this.cursorTextSprite);
            }

            this.updateTextSpriteContent(this.cursorTextSprite, text);
            this.cursorTextSprite.position.set(pos.x, y + 20, pos.z);
            this.cursorTextSprite.visible = true;
        } else {
            if (this.cursorTextSprite) this.cursorTextSprite.visible = false;
        }
    }

    createCursorTextSprite() {
        const canvas = document.createElement('canvas'); // Small size
        canvas.width = 128;
        canvas.height = 64;
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(30, 15, 1);
        sprite.renderOrder = 9999;

        sprite.userData = { canvas, context: canvas.getContext('2d'), texture };
        return sprite;
    }

    updateTextSpriteContent(sprite, text) {
        const { canvas, context, texture } = sprite.userData;
        context.clearRect(0, 0, canvas.width, canvas.height);

        // 背景
        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.beginPath();
        context.roundRect(10, 10, 108, 44, 10);
        context.fill();

        // テキスト
        context.font = 'bold 24px sans-serif';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 64, 34); // Yは微調整

        texture.needsUpdate = true;
    }

    /**
     * アニメーションループ
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        // 外部からのレンダリング上書き（エディタモード等）
        if (this.renderOverride) {
            this.renderOverride();
            return;
        }

        // 画面端でのカメラ回転処理
        this.handleEdgeRotation();

        // ユニット更新
        this.updateUnits();

        // エフェクト更新
        this.updateEffects();

        // 命令ライン描画
        this.drawOrderLines();

        // 攻撃ライン描画（流れる光）
        this.updateAttackLines();

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
        const aspect = width / height;

        // OrthographicCamera用リサイズ処理
        this.camera.left = this.frustumSize * aspect / -2;
        this.camera.right = this.frustumSize * aspect / 2;
        this.camera.top = this.frustumSize / 2;
        this.camera.bottom = this.frustumSize / -2;
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
        } else if (type === 'HEX_FLASH') {
            // arg1: {q, r, color}
            this.createHexFlash(arg1);
        } else if (type === 'UNIT_FLASH') {
            // arg1: {unitId, color, duration}
            this.triggerUnitFlash(arg1);
        }
    }

    createBeam(data) {
        // data: { start: {q,r} or {x,y,z}, end: {q,r} or {x,y,z}, color: hex }

        const resolvePos = (p) => {
            if (p instanceof THREE.Vector3) return p;
            if (p.z !== undefined) return p; // ワールド座標
            // 以下、グリッド座標からの変換
            // x, yプロパティがあればそれを優先（SquareGrid）
            if (p.x !== undefined && p.y !== undefined) {
                const pos = this.gridToWorld3D(p.x, p.y);
                const h = this.getGroundHeight(p.x, p.y);
                pos.y = h;
                return pos;
            }
            // q, rがあれば（旧仕様互換）
            if (p.q !== undefined) {
                const pos = this.hexToWorld3D(p.q, p.r);
                // hexToWorld3Dはz=0を返すので高さを補正
                const h = this.getGroundHeight(p.q, p.r);
                pos.y = h;
                return pos;
            }
            return p;
        };

        const startPos = resolvePos(data.start);
        const endPos = resolvePos(data.end);

        // 高さを調整（ユニットの胸元あたり）
        if (startPos.y < 1000) startPos.y += 30; // 既に十分高い場合は加算しない
        if (endPos.y < 1000) endPos.y += 30;

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
        let gridX, gridY; // グリッド座標（高さ取得用）

        if (data.x !== undefined) {
            pos = { x: data.x, y: data.y, z: data.z };
        } else if (data.q !== undefined) {
            pos = this.hexToWorld3D(data.q, data.r);
            gridX = data.q;
            gridY = data.r;
        } else if (data.pos) {
            if (data.pos.x !== undefined) {
                pos = { x: data.pos.x, y: data.pos.y, z: data.pos.z };
            } else {
                pos = this.hexToWorld3D(data.pos.q, data.pos.r);
                gridX = data.pos.q;
                gridY = data.pos.r;
            }
        } else {
            return; // 座標不明
        }

        // 地形の高さを取得してユニットの頭上に表示
        let groundHeight = 0;
        if (gridX !== undefined && gridY !== undefined) {
            groundHeight = this.getGroundHeight(gridX, gridY);
        } else if (pos.y < 10) {
            // ワールド座標指定時で高さが低い場合はデフォルト
            groundHeight = 0;
        } else {
            groundHeight = pos.y;
        }
        // ユニットの頭上（地形高さ + ユニット高さ60 + オフセット20）
        pos.y = groundHeight + 80;

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
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false // 他のオブジェクトに隠れないように
        });
        const sprite = new THREE.Sprite(material);

        sprite.position.set(pos.x, pos.y, pos.z);
        sprite.renderOrder = 1000; // ユニットより手前に表示

        // 基本サイズを設定（data.sizeがあれば使用、デフォルト60）
        const baseSize = data.size || 60;
        sprite.scale.set(baseSize, baseSize * 0.25, 1);
        sprite.userData = { baseScale: baseSize };

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
        const pos = this.hexToWorld3D(unit.x, unit.y);
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

    createHexFlash(data) {
        // data: { q, r, color }
        const center = this.hexToWorld3D(data.q, data.r);
        const vertices = this.getHexagonVertices(data.q, data.r);

        const shape = new THREE.Shape();
        // 中心からの相対座標に変換
        shape.moveTo(vertices[0].x - center.x, vertices[0].z - center.z);
        for (let i = 1; i < vertices.length; i++) {
            shape.lineTo(vertices[i].x - center.x, vertices[i].z - center.z);
        }
        shape.lineTo(vertices[0].x - center.x, vertices[0].z - center.z);

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
            color: data.color || 0xffff00,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(center.x, 2, center.z); // 地面より少し上
        this.scene.add(mesh);

        this.effects.push({
            mesh: mesh,
            type: 'HEX_FLASH',
            life: 40,
            maxLife: 40
        });
    }

    triggerUnitFlash(data) {
        // data: { unitId, color, duration }
        const mesh = this.unitMeshes.get(data.unitId);
        if (mesh) {
            mesh.userData.flashColor = data.color || 0xFFFFFF;
            mesh.userData.flashTime = data.duration || 20;
        }
    }

    triggerUnitAttackAnimation(unitId, targetId) {
        const mesh = this.unitMeshes.get(unitId);
        // targetIdからユニットを探す（meshがまだない可能性もあるためgameStateから）
        const targetUnit = window.gameState.units.find(u => u.id === targetId);

        if (mesh && targetUnit) {
            // 現在のユニット位置（HEX中心）
            const unit = window.gameState.units.find(u => u.id === unitId);
            if (!unit) return;

            const startPos = this.hexToWorld3D(unit.x, unit.y);
            const targetPos = this.hexToWorld3D(targetUnit.x, targetUnit.y);

            // ターゲット方向へのベクトル
            const dir = new THREE.Vector3().subVectors(targetPos, startPos);
            // Y成分（高さ）の差は無視して水平移動だけにする
            dir.y = 0;

            const dist = dir.length();
            if (dist > 0) dir.normalize();

            // 距離の半分ちょい手前まで (あまり近づきすぎるとめり込むので調整)
            // HEX_SIZE(40) * 1.5 程度がユニットサイズなので、HEX間距離(約70)の半分=35くらい
            // dist * 0.4 くらいが適当か
            const moveVec = dir.multiplyScalar(dist * 0.45);

            mesh.userData.attackAnim = {
                active: true,
                progress: 0,
                duration: 40, // 全体フレーム数（約0.7秒）
                offsetVec: moveVec
            };
        }
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

                // 距離に応じてサイズを調整（遠くても見やすく）
                // カメラからの距離を取得
                const dist = effect.mesh.position.distanceTo(this.camera.position);
                // 基準距離(500)より遠い場合は拡大する
                const scaleFactor = Math.max(1, dist / 500);
                const base = effect.mesh.userData.baseScale || 60;
                effect.mesh.scale.set(base * scaleFactor, base * 0.25 * scaleFactor, 1);
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
            } else if (effect.type === 'HEX_FLASH') {
                // 点滅しながら消える
                const progress = effect.life / effect.maxLife;
                const flash = (Math.sin(progress * Math.PI * 4) + 1) / 2; // 2回点滅
                effect.mesh.material.opacity = flash * 0.8;
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
     * 最適化: 命令が変わった時のみ再描画
     */
    drawOrderLines() {
        if (!this.orderLineGroup) {
            this.orderLineGroup = new THREE.Group();
            this.scene.add(this.orderLineGroup);
            // キャッシュ用ジオメトリとマテリアル
            this._arrowConeGeometry = new THREE.ConeGeometry(8, 20, 8);
            this._orderLineCache = null;
        }

        // ORDERフェイズ以外は描画しない
        if (!window.game || !window.gameState || !window.gameState.units || window.game.gameState !== 'ORDER') {
            // 非ORDERフェイズではラインを隠す
            if (this.orderLineGroup.children.length > 0) {
                this.orderLineGroup.visible = false;
            }
            return;
        }
        this.orderLineGroup.visible = true;

        // 命令状態のハッシュを計算して変更検知
        const currentHash = this._computeOrderHash();
        if (this._orderLineCache === currentHash) {
            // 変更なし - 再描画不要
            return;
        }
        this._orderLineCache = currentHash;

        // 変更があったので再描画
        // 子要素を全削除
        while (this.orderLineGroup.children.length > 0) {
            const obj = this.orderLineGroup.children[0];
            this.orderLineGroup.remove(obj);
            if (obj.geometry && obj.geometry !== this._arrowConeGeometry) {
                obj.geometry.dispose();
            }
            if (obj.material) obj.material.dispose();
        }

        // 全ユニットの命令ラインを描画（選択中は強調、非選択は薄く）
        window.gameState.units.forEach(unit => {
            if (unit.dead || !unit.order) return;

            // フィルター: 
            // 1. 通常移動(MOVE)の場合は本陣のみラインを表示する（配下は陣形で動くため）
            if (unit.order.type === 'MOVE' && unit.unitType !== 'HEADQUARTERS') {
                return;
            }

            // 2. 攻撃(ATTACK)や調略(PLOT)の場合も、接敵するまでは陣形で動くため、遠い場合は表示しない
            if ((unit.order.type === 'ATTACK' || unit.order.type === 'PLOT') && unit.unitType !== 'HEADQUARTERS') {
                const target = window.gameState.units.find(u => u.id === unit.order.targetId);
                if (target) {
                    const dq = unit.q - target.q;
                    const dr = unit.r - target.r;
                    const ds = -dq - dr;
                    const dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
                    if (dist > 8) {
                        return;
                    }
                }
            }

            const isSelected = window.game.selectedUnits && window.game.selectedUnits.some(u => u.id === unit.id);
            const opacity = isSelected ? 1.0 : 0.3;
            const depthTest = isSelected ? false : true;
            const renderOrder = isSelected ? 999 : 0;

            const startPos = this.hexToWorld3D(unit.x, unit.y);
            startPos.y = 30;

            let endPos = null;
            let color = 0xffffff;

            if (unit.order.type === 'MOVE' && unit.order.targetHex) {
                endPos = this.hexToWorld3D(unit.order.targetHex.x, unit.order.targetHex.y);
                color = 0x00ff00;
            } else if ((unit.order.type === 'ATTACK' || unit.order.type === 'PLOT') && unit.order.targetId) {
                const target = window.gameState.units.find(u => u.id === unit.order.targetId);
                if (target) {
                    endPos = this.hexToWorld3D(target.x, target.y);
                    color = unit.order.type === 'ATTACK' ? 0xff0000 : 0x00ffff;
                }
            }

            if (endPos) {
                let targetX, targetY;
                if (unit.order.type === 'MOVE' && unit.order.targetHex) {
                    targetX = unit.order.targetHex.x;
                    targetY = unit.order.targetHex.y;
                }
                else if (unit.order.targetId) {
                    const t = window.gameState.units.find(u => u.id === unit.order.targetId);
                    if (t) { targetX = t.x; targetY = t.y; }
                }

                if (targetX !== undefined) {
                    const h = this.getGroundHeight(targetX, targetY);
                    endPos.y = h + 30;
                } else {
                    endPos.y = 30;
                }

                const startH = this.getGroundHeight(unit.x, unit.y);
                startPos.y = startH + 30;

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

                // 矢印の先端（コーン）- ジオメトリはキャッシュを再利用
                const dir = new THREE.Vector3().subVectors(
                    new THREE.Vector3(endPos.x, endPos.y, endPos.z),
                    new THREE.Vector3(startPos.x, startPos.y, startPos.z)
                ).normalize();

                const arrowHead = new THREE.Mesh(
                    this._arrowConeGeometry, // キャッシュされたジオメトリを再利用
                    new THREE.MeshBasicMaterial({
                        color: color,
                        depthTest: depthTest,
                        transparent: true,
                        opacity: opacity
                    })
                );
                arrowHead.renderOrder = renderOrder;
                arrowHead.position.set(endPos.x, endPos.y, endPos.z);
                const axis = new THREE.Vector3(0, 1, 0);
                arrowHead.quaternion.setFromUnitVectors(axis, dir);
                arrowHead.position.sub(dir.clone().multiplyScalar(10));
                arrowHead.rotateX(Math.PI / 2);

                this.orderLineGroup.add(arrowHead);
            }
        });
    }

    /**
     * 命令状態のハッシュを計算（変更検知用）
     */
    _computeOrderHash() {
        if (!window.gameState || !window.gameState.units) return '';

        // 選択状態も含める（選択によって描画が変わるため）
        const selectedIds = window.game?.selectedUnits?.map(u => u.id).join(',') || '';

        const orderData = window.gameState.units
            .filter(u => !u.dead && u.order && (u.unitType === 'HEADQUARTERS' || u.order.type !== 'MOVE'))
            .map(u => {
                const targetPos = u.order.targetId
                    ? window.gameState.units.find(t => t.id === u.order.targetId)
                    : null;
                return `${u.id}:${u.x},${u.y}:${u.order.type}:${u.order.targetId || ''}:${u.order.targetHex?.x || ''},${u.order.targetHex?.y || ''}:${targetPos?.x || ''},${targetPos?.y || ''}`;
            })
            .join('|');

        return `${selectedIds}#${orderData}`;
    }


    /**
     * 攻撃ライン（流れる光）のアニメーション更新
     * 最適化: 攻撃ペアが変わった時のみ再描画
     */
    updateAttackLines() {
        if (!this.attackLineGroup) {
            this.attackLineGroup = new THREE.Group();
            this.scene.add(this.attackLineGroup);

            // 流れるテクスチャの作成
            this.flowTexture = this.createFlowTexture();
            this._attackLineCache = null;
        }

        // テクスチャのアニメーション（オフセット移動）- これは毎フレーム実行
        if (this.flowTexture) {
            this.flowTexture.offset.x -= 0.02;
        }

        if (!window.gameState || !window.gameState.units) return;

        // 攻撃ペアのハッシュを計算して変更検知
        const currentHash = this._computeAttackLineHash();
        if (this._attackLineCache === currentHash) {
            // 変更なし - 再描画不要
            return;
        }
        this._attackLineCache = currentHash;

        // 既存のラインを削除
        while (this.attackLineGroup.children.length > 0) {
            const obj = this.attackLineGroup.children[0];
            this.attackLineGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }

        // 攻撃ラインを描画
        window.gameState.units.forEach(unit => {
            if (unit.dead) return;

            let targetId = null;
            let isPlot = false;

            if (unit.order) {
                if (unit.order.type === 'ATTACK') {
                    targetId = unit.order.targetId;
                } else if (unit.order.type === 'PLOT') {
                    targetId = unit.order.targetId;
                    isPlot = true;
                }
            }

            if (!targetId) return;

            const target = window.gameState.units.find(u => u.id === targetId);
            if (!target || target.dead) return;

            // 距離チェック
            const dq = unit.q - target.q;
            const dr = unit.r - target.r;
            const ds = -dq - dr;
            const dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));

            // 接敵距離（約3HEX）より遠い場合はラインを出さない
            if (dist > 3) return;

            const startPos = this.hexToWorld3D(unit.x, unit.y);
            const endPos = this.hexToWorld3D(target.x, target.y);

            startPos.y = 40;
            endPos.y = 40;

            this.createAttackRibbon(startPos, endPos, isPlot);
        });
    }

    /**
     * 攻撃ライン状態のハッシュを計算（変更検知用）
     */
    _computeAttackLineHash() {
        if (!window.gameState || !window.gameState.units) return '';

        const attackPairs = window.gameState.units
            .filter(u => !u.dead && u.order && (u.order.type === 'ATTACK' || u.order.type === 'PLOT'))
            .map(u => {
                const target = window.gameState.units.find(t => t.id === u.order.targetId);
                if (!target || target.dead) return null;
                // 距離チェック
                const dq = u.q - target.q;
                const dr = u.r - target.r;
                const ds = -dq - dr;
                const dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
                if (dist > 3) return null;
                return `${u.id}:${u.x},${u.y}->${target.x},${target.y}:${u.order.type}`;
            })
            .filter(Boolean)
            .join('|');

        return attackPairs;
    }

    /**
     * 流れるテクスチャを作成
     */
    createFlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');

        // グラデーション（光の粒子感）
        const gradient = ctx.createLinearGradient(0, 0, 64, 0);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 16);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        return texture;
    }

    /**
     * 攻撃リボンを作成
     */
    createAttackRibbon(start, end, isPlot) {
        const sub = new THREE.Vector3().subVectors(end, start);
        const length = sub.length();
        const angle = Math.atan2(sub.z, sub.x);
        const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

        const width = 8;
        const geometry = new THREE.PlaneGeometry(length, width);
        const color = isPlot ? 0x00ffff : 0xff3333;

        const material = new THREE.MeshBasicMaterial({
            map: this.flowTexture,
            color: color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(center);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = -angle;

        this.attackLineGroup.add(mesh);
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
            console.log("Raycast Hit Unit Object:", unitIntersects[0].object.name, unitIntersects[0].point);
            // 最も手前のオブジェクトを取得
            // 親を辿ってメインのMeshを探す（userData.unitIdを持っているはず）
            let target = unitIntersects[0].object;
            while (target) {
                if (target.userData && target.userData.unitId !== undefined) {
                    // ユニットIDからユニット情報を取得して座標を返す
                    const unit = window.gameState.units.find(u => u.id === target.userData.unitId);
                    if (unit) {
                        return { q: unit.x, r: unit.y }; // x,y を返す
                    }
                }
                // hitBoxなど子要素の場合、親を辿る
                target = target.parent;
                // Sceneまで到達したら終了
                if (target && target.type === 'Scene') break;
            }
        }

        // 2. 地形との交差判定（タイルグループに対して実施）
        // これにより高さのある地形でも正確に判定可能
        const tileIntersects = raycaster.intersectObjects(this.tileGroup.children);

        if (tileIntersects.length > 0) {
            // 最も手前のタイル
            const target = tileIntersects[0].object;
            console.log("Raycast Hit Tile:", target.userData);
            if (target.userData && target.userData.x !== undefined) {
                return { q: target.userData.x, r: target.userData.y };
            }
        }

        // フォールバック: groundMesh（平面）との判定
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
        if (unit.x === undefined || unit.y === undefined) return null;

        // 3D位置を取得
        const pos = this.hexToWorld3D(unit.x, unit.y);

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
     * 3Dワールド座標(x, z)をグリッド座標(x, y)に変換（クォータービュー）
     */
    world3DToGrid(worldX, worldZ) {
        // アイソメトリック逆変換
        const gx = (worldX / (TILE_SIZE / 2) + worldZ / (TILE_SIZE / 4)) / 2;
        const gy = (worldZ / (TILE_SIZE / 4) - worldX / (TILE_SIZE / 2)) / 2;
        return { x: Math.round(gx), y: Math.round(gy) };
    }

    /**
     * 旧API互換：3Dワールド座標(x, z)をHEX座標(q, r)に変換
     * @deprecated world3DToGridを使用してください
     */
    world3DToHex(x, z) {
        const result = this.world3DToGrid(x, z);
        return { q: result.x, r: result.y };
    }

    /**
     * 旧API互換（未使用だが念のため残す）
     * @deprecated
     */
    axialRound(q, r) {
        return { q: Math.round(q), r: Math.round(r) };
    }

    /**
     * デバッグ用カメラ情報オーバーレイを作成
     */
    createCameraDebugOverlay() {
        if (document.getElementById('camera-debug')) return;

        const div = document.createElement('div');
        div.id = 'camera-debug';
        div.style.position = 'absolute';
        div.style.top = '10px';
        div.style.left = '10px';
        div.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        div.style.color = 'lime';
        div.style.padding = '10px';
        div.style.fontFamily = 'monospace';
        div.style.fontSize = '14px';
        div.style.pointerEvents = 'none'; // クリック透過
        div.style.zIndex = '9999';
        div.style.display = 'none'; // デフォルト非表示
        document.body.appendChild(div);
    }

    /**
     * デバッグ表示切り替え
     */
    toggleCameraDebugOverlay() {
        const el = document.getElementById('camera-debug');
        if (el) {
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
            if (el.style.display === 'block') {
                this.updateCameraDebugInfo();
            }
        }
    }

    /**
     * カメラ情報を更新
     */
    updateCameraDebugInfo() {
        const el = document.getElementById('camera-debug');
        if (!el) return;

        const p = this.camera.position;
        const t = this.controls.target;
        const z = this.camera.zoom;

        el.innerHTML = `
            <strong>Camera Settings</strong><br>
            Position: (x=${Math.round(p.x)}, y=${Math.round(p.y)}, z=${Math.round(p.z)})<br>
            Target: (x=${Math.round(t.x)}, y=${Math.round(t.y)}, z=${Math.round(t.z)})<br>
            Zoom: ${z.toFixed(2)}<br>
        `;
    }

    /**
     * スクリーン座標から地面へのレイキャスト
     */
    raycastToGround(screenX, screenY) {
        if (!this.raycaster) this.raycaster = new THREE.Raycaster();

        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((screenX - rect.left) / rect.width) * 2 - 1;
        const y = -((screenY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera({ x, y }, this.camera);

        // 1. 地形タイルとの交差
        if (this.tileGroup && this.tileGroup.children.length > 0) {
            const intersects = this.raycaster.intersectObjects(this.tileGroup.children);
            if (intersects.length > 0) {
                return intersects[0];
            }
        }

        // 2. 平面との交差（フォールバック）
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(plane, target)) {
            return { point: target };
        }

        return null;
    }

    // =====================================
    // 弓矢アニメーション (Arrow Animation)
    // =====================================

    /**
     * 矢のアニメーションを生成・再生
     * @param {Object} fromUnit - 発射元ユニット
     * @param {Object} toUnit - 対象ユニット
     * @param {{blocked: boolean, blockPos: {x,y,z}|null}} blockInfo - 遮蔽情報
     * @returns {Promise} アニメーション完了時にresolve
     */
    spawnArrowAnimation(fromUnit, toUnit, blockInfo) {
        return new Promise((resolve) => {
            // 3Dジオメトリで矢を作成
            // 矢はローカルで+X方向を「前」として構築（THREE.jsのlookAtと相性が良い）
            const arrowGroup = new THREE.Group();

            // 矢の軸（シリンダー）- 2倍サイズ、X軸方向に横たわる
            const shaftGeometry = new THREE.CylinderGeometry(1, 1, 24, 8);
            const shaftMaterial = new THREE.MeshBasicMaterial({ color: 0xC4A574 }); // 明るい茶色
            const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
            shaft.rotation.z = Math.PI / 2; // X軸方向に横たわる
            arrowGroup.add(shaft);

            // 矢尻（コーン）- 2倍サイズ
            const headGeometry = new THREE.ConeGeometry(2.5, 7, 8);
            const headMaterial = new THREE.MeshBasicMaterial({ color: 0xCCCCCC }); // シルバー
            const head = new THREE.Mesh(headGeometry, headMaterial);
            head.rotation.z = -Math.PI / 2; // 先端が+X方向を向く
            head.position.x = 15; // 先端に配置
            arrowGroup.add(head);

            // 羽根（小さめ、白/灰色）
            const fletchGeometry = new THREE.ConeGeometry(1.5, 4, 4);
            const fletchMaterial = new THREE.MeshBasicMaterial({ color: 0xEEEEEE }); // 白っぽい灰色
            const fletch = new THREE.Mesh(fletchGeometry, fletchMaterial);
            fletch.rotation.z = Math.PI / 2;
            fletch.position.x = -12;
            arrowGroup.add(fletch);

            // 開始・終了位置を計算
            const fromPos = this.gridToWorld3D(fromUnit.x, fromUnit.y);
            const toPos = this.gridToWorld3D(toUnit.x, toUnit.y);

            // 高さ情報を取得
            let fromZ = 0, toZ = 0;
            if (this.hexHeights && this.hexHeights[fromUnit.y]) {
                fromZ = this.hexHeights[fromUnit.y][fromUnit.x] || 0;
            }
            if (this.hexHeights && this.hexHeights[toUnit.y]) {
                toZ = this.hexHeights[toUnit.y][toUnit.x] || 0;
            }

            // 遮蔽時は遮蔽ポイントで止まる
            let endPos = { x: toPos.x, y: toZ + 8, z: toPos.z };
            if (blockInfo && blockInfo.blocked && blockInfo.blockPos) {
                const blockWorldPos = this.gridToWorld3D(blockInfo.blockPos.x, blockInfo.blockPos.y);
                endPos = { x: blockWorldPos.x, y: blockInfo.blockPos.z * TILE_HEIGHT + 8, z: blockWorldPos.z };
            }

            // 距離に基づくアニメーション時間（弧を描くので長めに）
            const dx = endPos.x - fromPos.x;
            const dz = endPos.z - fromPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const duration = Math.max(800, Math.min(1800, distance * 12));

            // 放物線の高さ（高く弧を描いて落下するように）
            const arcHeight = Math.min(distance * 0.5, 100);

            // 初期位置設定
            const startY = fromZ + 8;
            arrowGroup.position.set(fromPos.x, startY, fromPos.z);
            this.scene.add(arrowGroup);

            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const t = Math.min(1, elapsed / duration);

                // 線形補間でXZ位置を計算
                const currentX = fromPos.x + (endPos.x - fromPos.x) * t;
                const currentZ = fromPos.z + (endPos.z - fromPos.z) * t;

                // 放物線でY座標を計算
                const endY = endPos.y;
                const baseY = startY + (endY - startY) * t;
                const arcY = 4 * arcHeight * t * (1 - t);
                const currentY = baseY + arcY;

                arrowGroup.position.set(currentX, currentY, currentZ);

                // 矢の向きを進行方向に合わせる（接線方向）
                // 次フレームの位置を予測して向きを決定
                const nextT = Math.min(1, t + 0.01);
                const nextX = fromPos.x + (endPos.x - fromPos.x) * nextT;
                const nextZ = fromPos.z + (endPos.z - fromPos.z) * nextT;
                const nextBaseY = startY + (endY - startY) * nextT;
                const nextArcY = 4 * arcHeight * nextT * (1 - nextT);
                const nextY = nextBaseY + nextArcY;

                // 進行方向ベクトル
                const dirX = nextX - currentX;
                const dirY = nextY - currentY;
                const dirZ = nextZ - currentZ;

                // Y軸回転（水平方向の向き）: atan2(-dirZ, dirX) でX軸からの角度
                const yaw = Math.atan2(-dirZ, dirX);

                // ピッチ（上下の傾き）
                const horizontalDist = Math.sqrt(dirX * dirX + dirZ * dirZ);
                const pitch = Math.atan2(dirY, horizontalDist);

                arrowGroup.rotation.set(0, 0, 0); // リセット
                arrowGroup.rotation.y = yaw;
                arrowGroup.rotation.z = pitch;

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // アニメーション完了
                    if (blockInfo && blockInfo.blocked) {
                        setTimeout(() => {
                            this.scene.remove(arrowGroup);
                            shaftGeometry.dispose();
                            shaftMaterial.dispose();
                            headGeometry.dispose();
                            headMaterial.dispose();
                            fletchGeometry.dispose();
                            fletchMaterial.dispose();
                            resolve();
                        }, 150);
                    } else {
                        this.scene.remove(arrowGroup);
                        shaftGeometry.dispose();
                        shaftMaterial.dispose();
                        headGeometry.dispose();
                        headMaterial.dispose();
                        fletchGeometry.dispose();
                        fletchMaterial.dispose();
                        resolve();
                    }
                }
            };

            animate();
        });
    }
}
