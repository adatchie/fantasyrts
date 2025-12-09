/**
 * SEKIGAHARA RTS - 3D Rendering Engine
 * Three.jsベースの3Dレンダリングシステム
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HEX_SIZE, MAP_W, MAP_H } from './constants.js';

export class RenderingEngine3D {
    constructor(canvas) {
        this.canvas = canvas;

        // Three.js基本セットアップ
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2a4a2a); // 暗めの緑

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
        // 地面（シンプルな平面）
        const groundGeometry = new THREE.PlaneGeometry(MAP_W * HEX_SIZE * 2, MAP_H * HEX_SIZE * 2);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a5a3a,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // XZ平面に配置
        ground.receiveShadow = true;
        this.scene.add(ground);

        // ヘックスグリッドの描画
        this.drawHexGrid();
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
            vertices.push(new THREE.Vector3(x, 0.1, z)); // 地面より少し上
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
