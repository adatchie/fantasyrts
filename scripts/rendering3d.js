/**
 * SEKIGAHARA RTS - 3D Rendering Engine
 * Three.jsベースの3Dレンダリングシステム
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HEX_SIZE, MAP_W, MAP_H, WARLORDS } from './constants.js';

export class RenderingEngine3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.groundMesh = null; // 地形メッシュ（Raycast用）

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
        this.controls.maxPolarAngle = Math.PI / 2.2; // 地平線より下に行かない

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

        // テクスチャをロード
        const textureLoader = new THREE.TextureLoader();
        const groundTexture = textureLoader.load('./assets/textures/ground_sekigahara.jpg');
        const heightMap = textureLoader.load('./assets/textures/height_sekigahara.jpg'); // 専用の高さマップ

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

        // ユニットはstartGame()後に描画される
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
     * 全ユニットを描画
     */
    drawUnits() {
        if (!window.gameState || !window.gameState.units) return;

        // groundMeshがまだない場合は少し待って再試行
        if (!this.groundMesh) {
            console.log("Waiting for ground mesh...");
            setTimeout(() => this.drawUnits(), 100);
            return;
        }

        window.gameState.units.forEach(unit => {
            if (unit.q !== undefined && unit.r !== undefined && !unit.dead) {
                // 所属軍の色を取得（東軍：青、西軍：赤）
                let color = 0x88AAEE; // デフォルト東軍色

                if (unit.side === 'WEST') {
                    color = 0xEE4444; // 西軍色
                } else if (unit.side === 'EAST') {
                    color = 0x88AAEE; // 東軍色
                } else {
                    // その他はグレー
                    color = 0x888888;
                }

                // dirプロパティを使用（unit-manager.jsで設定されている）
                // なければfacing、それもなければ0
                const dir = unit.dir !== undefined ? unit.dir : (unit.facing || 0);
                this.createUnit(unit.q, unit.r, dir, color);
            }
        });
    }

    /**
     * 凸型ユニットを1つ配置
     */
    createUnit(q, r, facing, color) {
        // ヘックス位置を3D座標に変換
        const pos = this.hexToWorld3D(q, r);

        // 凸字型の形状を作成（NATO記号スタイル）
        const shape = new THREE.Shape();
        const size = HEX_SIZE * 1.5; // サイズ調整
        const width = size * 1.2;    // 横幅
        const height = size * 0.8;   // 高さ
        const notchDepth = height * 0.5; // 凹みの深さ
        const notchWidth = width * 0.5;  // 凹みの幅

        // 凸字型の頂点を定義（下部中央に突起）
        shape.moveTo(-width / 2, height / 2);            // 左上
        shape.lineTo(width / 2, height / 2);             // 右上
        shape.lineTo(width / 2, -height / 2);            // 右下
        shape.lineTo(notchWidth / 2, -height / 2);       // 突起右上
        shape.lineTo(notchWidth / 2, -height / 2 - notchDepth);  // 突起右下
        shape.lineTo(-notchWidth / 2, -height / 2 - notchDepth); // 突起左下
        shape.lineTo(-notchWidth / 2, -height / 2);      // 突起左上
        shape.lineTo(-width / 2, -height / 2);           // 左下
        shape.lineTo(-width / 2, height / 2);            // 左上に戻る

        // ExtrudeGeometryで立体化（薄い板状）
        const extrudeSettings = {
            depth: size * 0.3,  // 厚み
            bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // マテリアル
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.3,
            side: THREE.DoubleSide
        });

        const unit = new THREE.Mesh(geometry, material);

        // 地面に寝かせる（X軸回転）
        unit.rotation.x = -Math.PI / 2;

        // facing方向を向く（Z軸回転、地面に寝た状態で）
        // facing定義 (unit-manager.js準拠): 0=東, 1=南東, 2=南西, 3=西, 4=北西, 5=北東
        // rotation.z=0で北を向いているため、補正が必要
        // 0(東) -> -90度
        unit.rotation.z = -Math.PI / 2 - facing * (Math.PI / 3);

        // 位置：地形の高さ + 固定オフセット
        let y = 100; // デフォルト高さ

        // Raycastで地形の高さを取得
        if (this.groundMesh) {
            const raycaster = new THREE.Raycaster();
            const rayOrigin = new THREE.Vector3(pos.x, 2000, pos.z);
            const rayDirection = new THREE.Vector3(0, -1, 0);
            raycaster.set(rayOrigin, rayDirection);

            const intersects = raycaster.intersectObject(this.groundMesh);
            if (intersects.length > 0) {
                // 地形の高さ + ユニットの浮遊高さ（大幅に上げる）
                y = intersects[0].point.y + 60;
            }
        }

        unit.position.set(pos.x, y, pos.z);

        unit.castShadow = true;
        unit.receiveShadow = true;

        this.scene.add(unit);
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
     * アニメーションループ
     */
    animate() {
        requestAnimationFrame(() => this.animate());

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
     * 後方互換性のためのダミーメソッド
     */
    drawEffects() {
        // 3Dエフェクトは後で実装
    }

    drawBubbles() {
        // 3Dバブルは後で実装
    }
}
