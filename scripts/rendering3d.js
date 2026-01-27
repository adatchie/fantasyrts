/**
 * SEKIGAHARA RTS - 3D Rendering Engine
 * Three.js繝吶・繧ｹ縺ｮ3D繝ｬ繝ｳ繝繝ｪ繝ｳ繧ｰ繧ｷ繧ｹ繝・Β
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HEX_SIZE, TILE_SIZE, TILE_HEIGHT, MAP_W, MAP_H, WARLORDS } from './constants.js';
import { KamonDrawer } from './kamon.js';
import { ANIMATIONS, DIRECTIONS, getSpriteInfo, getAllSpritePaths } from './sprite-config.js';

import TerrainManager from './terrain-manager.js';
import { BuildingSystem, BUILDING_TEMPLATES } from './building.js';

import { decompressBlocks } from './map-repository.js';
import { generatePortrait } from './rendering.js'; // Import generatePortrait
import { C_EAST, C_WEST, UNIT_TYPE_HEADQUARTERS } from './constants.js'; // Import constants

export class RenderingEngine3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.groundMesh = null; // 蝨ｰ蠖｢繝｡繝・す繝･・・aycast逕ｨ・・

        this.unitMeshes = new Map(); // 繝ｦ繝九ャ繝・D -> Mesh
        this.effects = []; // 3D繧ｨ繝輔ぉ繧ｯ繝・



        // 繝槭ャ繝励ョ繝ｼ繧ｿ・磯ｫ倥＆諠・ｱ縺ｪ縺ｩ・・
        this.hexHeights = [];
        for (let y = 0; y < MAP_H; y++) {
            this.hexHeights[y] = new Array(MAP_W).fill(0);
        }

        this.unitGeometry = null; // 繝ｦ繝九ャ繝育畑繧ｸ繧ｪ繝｡繝医Μ・亥・譛会ｼ・

        // 繧ｹ繝励Λ繧､繝磯未騾｣
        this.spriteTextures = new Map(); // 繧ｹ繝励Λ繧､繝医す繝ｼ繝医ユ繧ｯ繧ｹ繝√Ε繧ｭ繝｣繝・す繝･
        this.unitAnimationStates = new Map(); // 繝ｦ繝九ャ繝・D -> {anim, frame, lastUpdate}
        this.loadSpriteTextures();




        // Three.js蝓ｺ譛ｬ繧ｻ繝・ヨ繧｢繝・・
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a2a1a);

        // Building System
        this.buildingSystem = new BuildingSystem(this.scene, this);

        // Terrain Manager (New Prototype)
        this.useTerrainManager = false; // REVERTED AS REQUESTED
        this.terrainManager = new TerrainManager(this);
        this.terrainManager.init();

        // 繧ｫ繝｡繝ｩ繧ｻ繝・ヨ繧｢繝・・・・rthographicCamera・壼ｹｳ陦梧兜蠖ｱ縺ｧ繧｢繧､繧ｽ繝｡繝医Μ繝・け陦ｨ遉ｺ・・
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 800; // 隕夜㍽縺ｮ螟ｧ縺阪＆・郁ｪｿ謨ｴ蜿ｯ閭ｽ・・
        this.frustumSize = frustumSize;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,  // left
            frustumSize * aspect / 2,   // right
            frustumSize / 2,            // top
            frustumSize / -2,           // bottom
            1,                          // near
            10000                       // far
        );
        // 繧ｯ繧ｩ繝ｼ繧ｿ繝ｼ繝薙Η繝ｼ・壹Θ繝ｼ繧ｶ繝ｼ謖・ｮ壹・繧ｫ繧ｹ繧ｿ繝險ｭ螳・(2026/01/12)
        // Position: (x=0, y=428, z=1242), Target: (x=-4, y=-118, z=492), Zoom: 1.47
        this.camera.position.set(0, 428, 1242);
        this.camera.zoom = 1.47;
        this.camera.updateProjectionMatrix();

        // lookAt縺ｯ蛻晄悄蛹匁凾縺ｫ險ｭ螳夲ｼ・rbitControls縺ｮtarget縺ｨ蜷医ｏ縺帙ｋ・・
        this.camera.lookAt(-4, -118, 492);

        // 繝ｬ繝ｳ繝繝ｩ繝ｼ繧ｻ繝・ヨ繧｢繝・・
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true  // 繧｢繝ｫ繝輔ぃ騾城℃繧呈怏蜉ｹ蛹・
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // 繧ｳ繝ｳ繝医Ο繝ｼ繝ｫ・医き繝｡繝ｩ謫堺ｽ懶ｼ・
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        // OrthographicCamera逕ｨ・壹ぜ繝ｼ繝縺ｯ霍晞屬縺ｧ縺ｯ縺ｪ縺上せ繧ｱ繝ｼ繝ｫ縺ｧ蛻ｶ蠕｡
        this.controls.enableZoom = true;
        this.controls.minZoom = 0.5;
        this.controls.maxZoom = 3;
        this.controls.maxPolarAngle = Math.PI / 2.5; // 蝨ｰ蟷ｳ邱壹ｈ繧頑焔蜑阪〒豁｢繧√ｋ・育ｴ・2蠎ｦ・・

        // 繝槭え繧ｹ謫堺ｽ懊・蜑ｲ繧雁ｽ薙※繧貞､画峩・亥ｷｦ繧ｯ繝ｪ繝・け繧偵ご繝ｼ繝謫堺ｽ懃畑縺ｫ髢区叛・・
        this.controls.mouseButtons = {
            LEFT: null, // 蟾ｦ繝峨Λ繝・げ・夂┌蜉ｹ・育ｯ・峇驕ｸ謚槭↑縺ｩ縺ｫ菴ｿ逕ｨ・・
            MIDDLE: THREE.MOUSE.DOLLY, // 荳ｭ繝峨Λ繝・げ・壹ぜ繝ｼ繝
            RIGHT: THREE.MOUSE.PAN     // 蜿ｳ繝峨Λ繝・げ・壼ｹｳ陦檎ｧｻ蜍包ｼ医ヱ繝ｳ・・
        };

        // 繧ｿ繝・メ謫堺ｽ懊・蜑ｲ繧雁ｽ薙※・・譛ｬ謖・ｒ繧ｲ繝ｼ繝謫堺ｽ懃畑縺ｫ髢区叛・・
        this.controls.touches = {
            ONE: null, // 1譛ｬ謖・ラ繝ｩ繝・げ・夂┌蜉ｹ・育ｯ・峇驕ｸ謚槭↑縺ｩ縺ｫ菴ｿ逕ｨ・・
            TWO: THREE.TOUCH.DOLLY_PAN // 2譛ｬ謖・ｼ夂ｧｻ蜍輔→繧ｺ繝ｼ繝
        };

        // OrbitControls縺ｮ繧ｿ繝ｼ繧ｲ繝・ヨ繧偵Θ繝ｼ繧ｶ繝ｼ謖・ｮ壼､縺ｫ險ｭ螳・
        this.controls.target.set(-4, -118, 492);
        // 蝗櫁ｻ｢繧堤┌蜉ｹ蛹厄ｼ亥崋螳壹い繧､繧ｽ繝｡繝医Μ繝・け隕也せ・・
        this.controls.enableRotate = false;

        // 繝槭え繧ｹ菴咲ｽｮ霑ｽ霍｡・育判髱｢遶ｯ縺ｧ縺ｮ蝗櫁ｻ｢逕ｨ・・
        this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.isRightMouseDown = false; // 蜿ｳ繧ｯ繝ｪ繝・け迥ｶ諷・

        // 繝・ヰ繝・げ逕ｨ: 繧ｫ繝｡繝ｩ諠・ｱ繧堤判髱｢縺ｫ陦ｨ遉ｺ・医Θ繝ｼ繧ｶ繝ｼ隱ｿ謨ｴ逕ｨ・・
        this.createCameraDebugOverlay();
        this.controls.addEventListener('change', () => {
            this.updateCameraDebugInfo();
        });

        // 蛻晏屓陦ｨ遉ｺ譖ｴ譁ｰ
        this.updateCameraDebugInfo();

        // F9繧ｭ繝ｼ縺ｧ繝・ヰ繝・げ陦ｨ遉ｺ蛻・ｊ譖ｿ縺・
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F9') {
                this.toggleCameraDebugOverlay();
            }
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        // 蜿ｳ繧ｯ繝ｪ繝・け迥ｶ諷九・霑ｽ霍｡
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) this.isRightMouseDown = true;
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) this.isRightMouseDown = false;
        });

        // 蜿ｳ繧ｯ繝ｪ繝・け譎ゅ・繧ｳ繝ｳ繝・く繧ｹ繝医Γ繝九Η繝ｼ繧堤┌蜉ｹ蛹・
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // 繝ｩ繧､繝・ぅ繝ｳ繧ｰ
        this.setupLights();

        // 蝨ｰ髱｢縺ｨ繧ｰ繝ｪ繝・ラ
        this.setupGround();

        // 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繝ｫ繝ｼ繝鈴幕蟋・
        this.animate();
    }

    async init() {
        return Promise.resolve();
    }

    setupLights() {
        // 迺ｰ蠅・・・亥・菴鍋噪縺ｪ譏弱ｋ縺包ｼ・
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        // 蟷ｳ陦悟・貅撰ｼ亥､ｪ髯ｽ蜈会ｼ・
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
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
        // 繧｢繧､繧ｽ繝｡繝医Μ繝・け繧ｰ繝ｪ繝・ラ縺ｮ繧ｵ繧､繧ｺ繧定ｨ育ｮ・
        const gridWorldWidth = (MAP_W + MAP_H) * TILE_SIZE / 2;
        const gridWorldHeight = (MAP_W + MAP_H) * TILE_SIZE / 4;

        // 繧ｰ繝ｪ繝・ラ縺ｮ荳ｭ蠢・
        const centerX = 0;
        const centerZ = gridWorldHeight / 2;

        // 繧ｯ繝ｩ繧ｹ繝｡繝ｳ繝舌→縺励※菫晏ｭ・
        this.gridWidth = gridWorldWidth;
        this.gridHeight = gridWorldHeight;
        this.gridCenterX = centerX;
        this.gridCenterZ = centerZ;

        // 繧ｫ繧ｹ繧ｿ繝繝槭ャ繝苓ｪｭ縺ｿ霎ｼ縺ｿ繝輔Λ繧ｰ・・uildTerrainFromMapData縺ｧ險ｭ螳夲ｼ・
        this.customMapLoaded = false;

        // 地形テクスチャのロード（プロシージャル生成のためのプレースホルダー）
        // 現状はTerrainManagerがテクスチャを生成・管理するため、ここでのロードは不要または
        // デフォルトの単色テクスチャを使用する

        // height_sekigahara.jpg の読み込みをスキップし、TerrainManagerの初期化を待つ
        // または、デフォルトのフラットな地形を生成する
        // デフォルトの地形初期化処理があればここで呼ぶ

        // Raycast逕ｨ縺ｮ荳榊庄隕門ｹｳ髱｢
        const groundPlaneGeometry = new THREE.PlaneGeometry(
            gridWorldWidth * 2,
            gridWorldHeight * 2
        );
        const groundPlaneMaterial = new THREE.MeshBasicMaterial({ visible: false });
        this.groundMesh = new THREE.Mesh(groundPlaneGeometry, groundPlaneMaterial);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.position.set(centerX, 0, centerZ);
        this.scene.add(this.groundMesh);

        // 繧ｿ繧､繝ｫ繧ｰ繝ｫ繝ｼ繝励ｒ菴懈・
        this.tileGroup = new THREE.Group();
        this.scene.add(this.tileGroup);

        // 繧ｰ繝ｪ繝・ラ邱壹が繝ｼ繝舌・繝ｬ繧､
        this.createIsometricGridOverlay();
    }

    /**
     * 繝上う繝医・繝・・縺九ｉ繧ｿ繧､繝ｫ蝨ｰ蠖｢繧呈ｧ狗ｯ・
     */
    buildTerrainFromHeightmap(heightMapImage) {
        // Canvas縺ｧ繝上う繝医・繝・・繧定ｪｭ縺ｿ蜿悶ｋ
        const canvas = document.createElement('canvas');
        canvas.width = heightMapImage.width;
        canvas.height = heightMapImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(heightMapImage, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // MapSystem縺ｮ鬮倥＆繝・・繧ｿ繧呈峩譁ｰ
        if (this.mapSystem) {
            const tiles = this.mapSystem.getMap();

            // 隨ｬ1繝代せ・壹ワ繧､繝医・繝・・縺九ｉ逕溘・鬮倥＆繧定ｪｭ縺ｿ蜿悶ｊ
            for (let y = 0; y < MAP_H; y++) {
                for (let x = 0; x < MAP_W; x++) {
                    const u = x / MAP_W;
                    const v = y / MAP_H;
                    const imgX = Math.floor(u * (canvas.width - 1));
                    const imgY = Math.floor(v * (canvas.height - 1));
                    const idx = (imgY * canvas.width + imgX) * 4;
                    const heightVal = imageData.data[idx]; // R channel

                    // 鬮倥＆繧・-5谿ｵ髫弱↓螟画鋤・亥ｱｱ縺ｯ繧医ｊ鬮倥￥・・
                    const z = Math.floor(heightVal / 255 * 5);
                    tiles[y][x].z = z;
                }
            }

            // 隨ｬ2繝代せ・壹せ繝繝ｼ繧ｸ繝ｳ繧ｰ・磯團謗･繧ｿ繧､繝ｫ縺ｨ蟷ｳ蝮・喧・・
            const tempHeights = [];
            for (let y = 0; y < MAP_H; y++) {
                tempHeights[y] = [];
                for (let x = 0; x < MAP_W; x++) {
                    let sum = tiles[y][x].z;
                    let count = 1;
                    // 4譁ｹ蜷代・髫｣謗･繧ｿ繧､繝ｫ繧偵メ繧ｧ繝・け
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

            // 繧ｹ繝繝ｼ繧ｸ繝ｳ繧ｰ邨先棡繧帝←逕ｨ
            for (let y = 0; y < MAP_H; y++) {
                for (let x = 0; x < MAP_W; x++) {
                    tiles[y][x].z = tempHeights[y][x];
                }
            }
        }

        // 繧ｿ繧､繝ｫ繝｡繝・す繝･繧堤函謌・
        this.createIsometricTiles();
    }

    /**
     * 繧｢繧､繧ｽ繝｡繝医Μ繝・け繧ｿ繧､繝ｫ繝｡繝・す繝･繧堤函謌撰ｼ・譫壹ユ繧ｯ繧ｹ繝√Ε繧旦V縺ｧ蜿ら・・・
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

        // 譌｢蟄倥ち繧､繝ｫ繧偵け繝ｪ繧｢
        while (this.tileGroup.children.length > 0) {
            const child = this.tileGroup.children[0];
            this.tileGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }

        if (!this.mapSystem) return;
        const tiles = this.mapSystem.getMap();
        if (!tiles) return;

        // hexHeights繧ｭ繝｣繝・す繝･繧貞・譛溷喧
        this.hexHeights = [];

        // 蟠門・髱｢逕ｨ縺ｮ繝槭ユ繝ｪ繧｢繝ｫ
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

                // 繧ｿ繧､繝ｫ逕ｨ縺ｮ闖ｱ蠖｢繧ｸ繧ｪ繝｡繝医Μ繧剃ｽ懈・
                const tileShape = new THREE.Shape();
                const hw = TILE_SIZE / 2;
                const hh = TILE_SIZE / 4;
                tileShape.moveTo(0, -hh);
                tileShape.lineTo(hw, 0);
                tileShape.lineTo(0, hh);
                tileShape.lineTo(-hw, 0);
                tileShape.closePath();

                const tileGeometry = new THREE.ShapeGeometry(tileShape);

                // UV蠎ｧ讓吶ｒ險ｭ螳夲ｼ医・繝・・蜈ｨ菴薙・荳ｭ縺ｧ縺ｮ菴咲ｽｮ・・
                const positions = tileGeometry.attributes.position;
                const uvs = new Float32Array(positions.count * 2);

                // 繧ｿ繧､繝ｫ縺ｮUV遽・峇繧定ｨ育ｮ・
                const uBase = x / MAP_W;
                const vBase = 1 - (y / MAP_H); // V蠎ｧ讓吶・蜿崎ｻ｢
                const uSize = 1 / MAP_W;
                const vSize = 1 / MAP_H;

                for (let i = 0; i < positions.count; i++) {
                    const localX = positions.getX(i);
                    const localY = positions.getY(i);
                    // 繝ｭ繝ｼ繧ｫ繝ｫ蠎ｧ讓吶ｒUV繧ｪ繝輔そ繝・ヨ縺ｫ螟画鋤
                    uvs[i * 2] = uBase + (localX / (hw * 2) + 0.5) * uSize;
                    uvs[i * 2 + 1] = vBase - (localY / (hh * 2) + 0.5) * vSize;
                }
                tileGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

                // 鬮倥＆縺ｫ蝓ｺ縺･縺乗・蠎ｦ隱ｿ謨ｴ
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

                // Raycast逕ｨ縺ｫ蠎ｧ讓吶ョ繝ｼ繧ｿ繧剃ｿ晏ｭ・
                tileMesh.userData = { x: x, y: y, z: tile.z };

                this.tileGroup.add(tileMesh);
                this.hexHeights[y][x] = worldPos.y;

                // 蟠悶・蛛ｴ髱｢繧呈緒逕ｻ
                this.addCliffSides(x, y, tile.z, tiles, cliffMaterial);
            }
        }

        console.log('Isometric terrain built from heightmap');
    }

    /**
     * 譌｢蟄倥・繝・Ξ繧､繝ｳ繧貞ｮ悟・縺ｫ繧ｯ繝ｪ繧｢
     */
    clearTerrain() {
        // tileGroup縺ｮ蜈ｨ隕∫ｴ繧貞炎髯､
        if (this.tileGroup) {
            while (this.tileGroup.children.length > 0) {
                const child = this.tileGroup.children[0];
                this.tileGroup.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        }

        // hexHeights繧ｭ繝｣繝・す繝･繧偵け繝ｪ繧｢
        this.hexHeights = [];

        // TerrainManager繧剃ｽｿ逕ｨ縺励※縺・ｋ蝣ｴ蜷医・縺昴■繧峨ｂ繧ｯ繝ｪ繧｢
        if (this.useTerrainManager && this.terrainManager && this.terrainManager.clear) {
            this.terrainManager.clear();
        }

        console.log('[RenderingEngine3D] Terrain cleared.');
    }

    /**
     * 繧ｫ繧ｹ繧ｿ繝繝槭ャ繝励ョ繝ｼ繧ｿ縺九ｉ繝・Ξ繧､繝ｳ繧呈ｧ狗ｯ・
     * @param {Object} mapData - 繧ｫ繧ｹ繧ｿ繝繝槭ャ繝励ョ繝ｼ繧ｿ (terrain, buildings遲峨ｒ蜷ｫ繧)
     */
    buildTerrainFromMapData(mapData) {
        if (!mapData || !mapData.terrain) {
            console.error('[RenderingEngine3D] Invalid map data for terrain building.');
            return;
        }

        console.log(`[RenderingEngine3D] buildTerrainFromMapData: name=${mapData.name}, textureData=${!!mapData.textureData}, image=${!!mapData.image}`);

        // カスタムマップが読み込まれたフラグをセット
        this.customMapLoaded = true;

        // テクスチャ読み込み処理
        const loadTexture = (textureSrc) => {
            if (!textureSrc) {
                this._buildTerrainInternal(mapData, null);
                return;
            }

            // Imageオブジェクトを作成してからテクスチャを生成（base64対応）
            const img = new Image();
            img.onload = () => {
                const texture = new THREE.Texture(img);
                texture.needsUpdate = true;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.colorSpace = THREE.SRGBColorSpace;
                console.log('[RenderingEngine3D] Custom texture loaded successfully');
                this._buildTerrainInternal(mapData, texture);
            };
            img.onerror = () => {
                console.warn('[RenderingEngine3D] Failed to load custom texture, using default');
                this._buildTerrainInternal(mapData, null);
            };
            img.src = textureSrc;
        };

        // textureDataを優先、なければimageを使用
        if (mapData.textureData) {
            loadTexture(mapData.textureData);
        } else if (mapData.image) {
            loadTexture(mapData.image);
        } else {
            this._buildTerrainInternal(mapData, null);
        }
    }

    _buildTerrainInternal(mapData, mapTexture) {
        console.log(`[RenderingEngine3D] Building terrain from map data: ${mapData.name}`);

        const terrain = mapData.terrain;
        const width = terrain.width;
        const height = terrain.height;

        // カスタムマップサイズを保存（screenToGridで使用）
        this.customMapWidth = width;
        this.customMapHeight = height;
        console.log(`[RenderingEngine3D] Custom map size set: ${width}x${height}`);

        // 以前の地形をクリア
        this.clearTerrain();

        // hexHeightsキャッシュを初期化
        this.hexHeights = [];

        // 蟠門・髱｢逕ｨ縺ｮ繝槭ユ繝ｪ繧｢繝ｫ
        const cliffMaterial = new THREE.MeshStandardMaterial({
            color: 0x5a4a3a,
            roughness: 0.95,
            metalness: 0.0,
            side: THREE.DoubleSide
        });

        // 蝨ｰ蠖｢繧ｿ繧､繝励＃縺ｨ縺ｮ濶ｲ・医ユ繧ｯ繧ｹ繝√Ε縺後↑縺・ｴ蜷医・繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ・・
        const terrainColors = {
            'grass': 0x4a7c41,
            'plain': 0x5a8c51,
            'forest': 0x2d5a27,
            'water': 0x3b7cb8,
            'mountain': 0x7a6b5a,
            'road': 0x8b7355,
            'sand': 0xc9b896,
            'swamp': 0x5a6b4a,
            'cliff': 0x4a4a4a
        };

        // 繝槭ユ繝ｪ繧｢繝ｫ繧ｭ繝｣繝・す繝･
        const materialCache = {};

        // 縲先怙驕ｩ蛹悶奏empTiles繧偵Ν繝ｼ繝怜､悶〒1蝗槭□縺台ｽ懈・
        const tempTiles = [];
        for (let ty = 0; ty < height; ty++) {
            tempTiles[ty] = [];
            for (let tx = 0; tx < width; tx++) {
                tempTiles[ty][tx] = {
                    z: (terrain.heightMap && terrain.heightMap[ty] && terrain.heightMap[ty][tx] !== undefined)
                        ? terrain.heightMap[ty][tx]
                        : 0
                };
            }
        }

        // 繝・け繧ｹ繝√Ε繧偵Ο繝ｼ繝会ｼ亥ｼ墓焚縺ｧ貂｡縺輔ｌ縺ｦ縺・↑縺・ｴ蜷医√°縺､繝槭ャ繝励ョ繝ｼ繧ｿ縺ｫimage繝励Ο繝代ユ繧｣縺後≠繧後・菴ｿ逕ｨ・・
        if (!mapTexture && mapData.image) {
            const textureLoader = new THREE.TextureLoader();
            mapTexture = textureLoader.load(mapData.image);
            mapTexture.wrapS = THREE.ClampToEdgeWrapping;
            mapTexture.wrapT = THREE.ClampToEdgeWrapping;
        }

        for (let y = 0; y < height; y++) {
            this.hexHeights[y] = [];
            for (let x = 0; x < width; x++) {
                // 鬮倥＆繝・・繧ｿ繧貞叙蠕・
                const z = tempTiles[y][x].z;

                // 蝨ｰ蠖｢繧ｿ繧､繝励ｒ蜿門ｾ・
                const terrainType = (terrain.terrainType && terrain.terrainType[y] && terrain.terrainType[y][x])
                    ? terrain.terrainType[y][x]
                    : 'grass';

                const worldPos = this.gridToWorld3D(x, y, z);

                // 繧ｿ繧､繝ｫ逕ｨ縺ｮ闖ｱ蠖｢繧ｸ繧ｪ繝｡繝医Μ繧剃ｽ懈・
                const tileShape = new THREE.Shape();
                const hw = TILE_SIZE / 2;
                const hh = TILE_SIZE / 4;
                tileShape.moveTo(0, -hh);
                tileShape.lineTo(hw, 0);
                tileShape.lineTo(0, hh);
                tileShape.lineTo(-hw, 0);
                tileShape.closePath();

                const tileGeometry = new THREE.ShapeGeometry(tileShape);

                // UV蠎ｧ讓吶ｒ險ｭ螳夲ｼ医・繝・・蜈ｨ菴薙・荳ｭ縺ｧ縺ｮ菴咲ｽｮ・・
                if (mapTexture) {
                    const positions = tileGeometry.attributes.position;
                    const uvs = new Float32Array(positions.count * 2);

                    // 繧ｿ繧､繝ｫ縺ｮUV遽・峇繧定ｨ育ｮ・
                    const uBase = x / width;
                    const vBase = 1 - (y / height); // V蠎ｧ讓吶・蜿崎ｻ｢
                    const uSize = 1 / width;
                    const vSize = 1 / height;

                    for (let i = 0; i < positions.count; i++) {
                        const localX = positions.getX(i);
                        const localY = positions.getY(i);
                        // 繝ｭ繝ｼ繧ｫ繝ｫ蠎ｧ讓吶ｒUV繧ｪ繝輔そ繝・ヨ縺ｫ螟画鋤
                        uvs[i * 2] = uBase + (localX / (hw * 2) + 0.5) * uSize;
                        uvs[i * 2 + 1] = vBase - (localY / (hh * 2) + 0.5) * vSize;
                    }
                    tileGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                }

                // 繝槭ユ繝ｪ繧｢繝ｫ縺ｮ繧ｭ繝｣繝・す繝･繧ｭ繝ｼ
                const cacheKey = mapTexture ? `tex_${z}` : `${terrainType}_${z}`;
                let material;

                if (materialCache[cacheKey]) {
                    material = materialCache[cacheKey];
                } else {
                    // 鬮倥＆縺ｫ蝓ｺ縺･縺乗・蠎ｦ隱ｿ謨ｴ
                    const brightness = 0.7 + (z / 7) * 0.3;

                    if (mapTexture) {
                        // 繝・け繧ｹ繝√Ε繧剃ｽｿ逕ｨ
                        material = new THREE.MeshStandardMaterial({
                            map: mapTexture,
                            color: new THREE.Color(brightness, brightness, brightness),
                            roughness: 0.85,
                            metalness: 0.05,
                            side: THREE.DoubleSide
                        });
                    } else {
                        // 繧ｫ繝ｩ繝ｼ縺ｮ縺ｿ菴ｿ逕ｨ
                        const baseColor = terrainColors[terrainType] || 0x888888;
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

                // Raycast逕ｨ縺ｫ蠎ｧ讓吶ョ繝ｼ繧ｿ繧剃ｿ晏ｭ・
                tileMesh.userData = { x: x, y: y, z: z };

                this.tileGroup.add(tileMesh);
                this.hexHeights[y][x] = worldPos.y;

                // 蟠悶・蛛ｴ髱｢繧呈緒逕ｻ
                this.addCliffSidesCustom(x, y, z, tempTiles, cliffMaterial, width, height);
            }
        }

        console.log(`[RenderingEngine3D] Custom terrain built: ${width}x${height}`);

        // 建物生成
        try {
            this.buildingSystem.clearBuildings();
            if (mapData.buildings) {
                console.log(`[RenderingEngine3D] Processing ${mapData.buildings.length} buildings...`);
                console.log(`[RenderingEngine3D] customBuildingDefinitions:`, mapData.customBuildingDefinitions);
                if (mapData.customBuildingDefinitions && mapData.customBuildingDefinitions.length > 0) {
                    mapData.customBuildingDefinitions.forEach((def, idx) => {
                        console.log(`[RenderingEngine3D] customBuildingDefinition ${idx}:`, def);
                    });
                }
                const hw = TILE_SIZE / 2;
                const hh = TILE_SIZE / 4;
                mapData.buildings.forEach((b, idx) => {
                    // 古い建物タイプ（castle, wall）はスキップ - カスタム建物に統合されている
                    if (b.type === 'castle' || b.type === 'wall') {
                        console.log(`[RenderingEngine3D] Building ${idx}: Skipping old type=${b.type}`);
                        return;
                    }

                    console.log(`[RenderingEngine3D] Building ${idx}: type=${b.type}, x=${b.x}, y=${b.y}, rotation=${b.rotation}, hasProperties=${!!b.properties}, properties=`, b.properties);
                    let template = null;

                    // 1. インラインプロパティを優先 (b.propertiesから直接)
                    if (b.properties) {
                        console.log(`[RenderingEngine3D] Building ${idx}: has properties, checking blocks/compressedBlocks...`);
                        if (b.properties.blocks || b.properties.compressedBlocks) {
                            let blocks = b.properties.blocks;
                            if (!blocks && b.properties.compressedBlocks) {
                                blocks = decompressBlocks(b.properties.compressedBlocks, b.properties.size);
                            }
                            template = {
                                name: b.properties.name || 'Custom',
                                size: b.properties.size,
                                blocks: blocks
                            };
                            console.log(`[RenderingEngine3D] Building ${idx}: Created template from properties, size=${JSON.stringify(template.size)}`);
                        }
                    }

                    // 2. カスタム定義から検索 (propertiesがない場合)
                    if (!template && mapData.customBuildingDefinitions) {
                        const customDef = mapData.customBuildingDefinitions.find(d => d.id === b.type || d.id === b.id);
                        if (customDef) {
                            template = customDef.data;
                            if (customDef.name) template.name = customDef.name;
                            if (template.compressedBlocks && !template.blocks) {
                                template.blocks = decompressBlocks(template.compressedBlocks, template.size);
                            }
                            console.log(`[RenderingEngine3D] Building ${idx}: Found in customBuildingDefinitions`);
                        }
                    }

                    // 3. BUILDING_TEMPLATESから検索 (Fallback)
                    if (!template) {
                        template = BUILDING_TEMPLATES[b.type];
                        if (template) {
                            console.log(`[RenderingEngine3D] Building ${idx}: Found in BUILDING_TEMPLATES`);
                        }
                    }

                    if (template) {
                        // 【重要】サイズ補正：Editor/Mainと同様にblockSizeをTILE_SIZEに設定
                        if (!template.blockSize) {
                            template.blockSize = TILE_SIZE;
                        }

                        // BuildingSystemの配置ロジック（中心補正など）を使用
                        this.buildingSystem.placeCustomBuildingAtGrid(
                            template,
                            b.x, // gridX
                            b.y, // gridY
                            b.rotation || 0
                        );
                    } else {
                        console.warn(`[RenderingEngine3D] Building ${idx}: No template found for type=${b.type}, skipping...`);
                    }
                });
                console.log(`[RenderingEngine3D] Buildings placed: ${mapData.buildings.length}`);
                // 建物がbuildingSystem.buildingsに正しく登録されているか確認
                console.log(`[RenderingEngine3D] buildingSystem.buildings count: ${this.buildingSystem.buildings.length}`);
                this.buildingSystem.buildings.forEach((b, idx) => {
                    console.log(`[RenderingEngine3D] Building ${idx}: gridX=${b.gridX}, gridY=${b.gridY}, template.size=${JSON.stringify(b.template?.size)}`);
                });
            }
        } catch (e) {
            console.error('[RenderingEngine3D] Building placement error:', e);
        }
    }

    /**
     * 繧ｫ繧ｹ繧ｿ繝繝槭ャ繝礼畑蟠門・髱｢繧定ｿｽ蜉・医・繝・・繧ｵ繧､繧ｺ蜿ｯ螟牙ｯｾ蠢懶ｼ・
     */
    addCliffSidesCustom(x, y, z, tiles, cliffMaterial, mapW, mapH) {
        if (z === 0) return;

        const worldPos = this.gridToWorld3D(x, y, z);
        const hw = TILE_SIZE / 2;
        const hh = TILE_SIZE / 4;

        const topVertices = [
            { x: worldPos.x, z: worldPos.z - hh },
            { x: worldPos.x + hw, z: worldPos.z },
            { x: worldPos.x, z: worldPos.z + hh },
            { x: worldPos.x - hw, z: worldPos.z }
        ];

        const edges = [
            { dx: 0, dy: -1, v1: 0, v2: 1 },
            { dx: 1, dy: 0, v1: 1, v2: 2 },
            { dx: 0, dy: 1, v1: 2, v2: 3 },
            { dx: -1, dy: 0, v1: 3, v2: 0 }
        ];

        const topY = worldPos.y;

        for (const edge of edges) {
            const nx = x + edge.dx;
            const ny = y + edge.dy;

            let neighborZ = 0;
            if (nx >= 0 && nx < mapW && ny >= 0 && ny < mapH) {
                neighborZ = tiles[ny][nx].z;
            }

            if (z > neighborZ) {
                const bottomY = neighborZ * TILE_HEIGHT;
                const v1 = topVertices[edge.v1];
                const v2 = topVertices[edge.v2];

                const vertices = new Float32Array([
                    v1.x, topY, v1.z,
                    v1.x, bottomY, v1.z,
                    v2.x, bottomY, v2.z,
                    v2.x, topY, v2.z
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
     * MapSystem險ｭ螳壼ｾ後↓繧ｿ繧､繝ｫ繧呈峩譁ｰ
     */
    updateTerrainTiles(tileGeometry, terrainColors, terrainTextures = {}) {
        // 譌｢蟄倥・繧ｿ繧､繝ｫ繧偵け繝ｪ繧｢
        while (this.tileGroup.children.length > 0) {
            const child = this.tileGroup.children[0];
            this.tileGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }

        const tiles = this.mapSystem.getMap();
        if (!tiles || tiles.length === 0) return;

        // hexHeights繧ｭ繝｣繝・す繝･繧貞・譛溷喧
        this.hexHeights = [];

        // 蟠門・髱｢逕ｨ縺ｮ繝槭ユ繝ｪ繧｢繝ｫ・域囓繧√・闌ｶ濶ｲ・・
        const cliffMaterial = new THREE.MeshStandardMaterial({
            color: 0x5a4a3a,
            roughness: 0.95,
            metalness: 0.0,
            side: THREE.DoubleSide
        });

        // 繧ｿ繧､繝ｫ繧ｿ繧､繝励＃縺ｨ縺ｮ繝槭ユ繝ｪ繧｢繝ｫ繧偵く繝｣繝・す繝･・医ヱ繝輔か繝ｼ繝槭Φ繧ｹ譛驕ｩ蛹厄ｼ・
        const materialCache = {};

        for (let y = 0; y < MAP_H; y++) {
            this.hexHeights[y] = [];
            for (let x = 0; x < MAP_W; x++) {
                const tile = tiles[y][x];
                const worldPos = this.gridToWorld3D(x, y, tile.z);

                // 繝槭ユ繝ｪ繧｢繝ｫ縺ｮ繧ｭ繝｣繝・す繝･繧ｭ繝ｼ・医ち繧､繝励→鬮倥＆・・
                const cacheKey = `${tile.type}_${tile.z}`;

                let material;
                if (materialCache[cacheKey]) {
                    material = materialCache[cacheKey];
                } else {
                    // 鬮倥＆縺ｫ蝓ｺ縺･縺乗・蠎ｦ隱ｿ謨ｴ
                    const brightness = 0.7 + (tile.z / 8) * 0.3;

                    // 繝・け繧ｹ繝√Ε縺後≠繧後・菴ｿ逕ｨ縲√↑縺代ｌ縺ｰ濶ｲ
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
                tileMesh.castShadow = false; // 繧ｷ繝｣繝峨え繧堤┌蜉ｹ蛹悶＠縺ｦ繧｢繝ｼ繝・ぅ繝輔ぃ繧ｯ繝医ｒ蝗樣∩

                this.tileGroup.add(tileMesh);

                // hexHeights繧ｭ繝｣繝・す繝･縺ｫ菫晏ｭ假ｼ医Θ繝九ャ繝磯ｫ倥＆蜷医ｏ縺帷畑・・
                this.hexHeights[y][x] = worldPos.y;

                // 蟠悶・蛛ｴ髱｢繧呈緒逕ｻ・磯團謗･繧ｿ繧､繝ｫ縺ｨ縺ｮ鬮倥＆蟾ｮ繧偵メ繧ｧ繝・け・・
                this.addCliffSides(x, y, tile.z, tiles, cliffMaterial);
            }
        }
    }

    /**
     * 蟠悶・蛛ｴ髱｢繧定ｿｽ蜉・郁廠蠖｢繧ｿ繧､繝ｫ縺ｮ4霎ｺ縺ｫ豐ｿ縺｣縺ｦ・・
     */
    addCliffSides(x, y, z, tiles, cliffMaterial) {
        if (z === 0) return; // 鬮倥＆0縺ｮ蝣ｴ蜷医・蛛ｴ髱｢荳崎ｦ・

        const worldPos = this.gridToWorld3D(x, y, z);
        const hw = TILE_SIZE / 2;  // 繧ｿ繧､繝ｫ蟷・・蜊雁・
        const hh = TILE_SIZE / 4;  // 繧ｿ繧､繝ｫ鬮倥＆縺ｮ蜊雁・・医い繧､繧ｽ繝｡繝医Μ繝・け・・

        // 闖ｱ蠖｢縺ｮ4縺､縺ｮ鬆らせ・井ｸ企擇・・
        const topVertices = [
            { x: worldPos.x, z: worldPos.z - hh },  // 荳奇ｼ亥圏・・
            { x: worldPos.x + hw, z: worldPos.z },  // 蜿ｳ・域擲・・
            { x: worldPos.x, z: worldPos.z + hh },  // 荳具ｼ亥漉・・
            { x: worldPos.x - hw, z: worldPos.z }   // 蟾ｦ・郁･ｿ・・
        ];

        // 4譁ｹ蜷代・髫｣謗･繧ｿ繧､繝ｫ縺ｨ蟇ｾ蠢懊☆繧玖ｾｺ・井ｸ贋ｸ句ｷｦ蜿ｳ・・
        const edges = [
            { dx: 0, dy: -1, v1: 0, v2: 1, name: 'North' },
            { dx: 1, dy: 0, v1: 1, v2: 2, name: 'East' },
            { dx: 0, dy: 1, v1: 2, v2: 3, name: 'South' },
            { dx: -1, dy: 0, v1: 3, v2: 0, name: 'West' }
        ];

        const topY = worldPos.y;

        for (const edge of edges) {
            const nx = x + edge.dx;
            const ny = y + edge.dy;

            // 髫｣謗･繧ｿ繧､繝ｫ縺ｮ鬮倥＆繧貞叙蠕・
            let neighborZ = 0;
            if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
                neighborZ = tiles[ny][nx].z;
            }

            // 鬮倥＆蟾ｮ縺後≠繧句ｴ蜷医√◎縺ｮ霎ｺ縺ｫ蛛ｴ髱｢繧呈緒逕ｻ
            if (z > neighborZ) {
                const bottomY = neighborZ * TILE_HEIGHT;
                const v1 = topVertices[edge.v1];
                const v2 = topVertices[edge.v2];

                // 蝗幄ｧ貞ｽ｢縺ｮ4鬆らせ・井ｸ願ｾｺ縺ｮ2轤ｹ + 荳玖ｾｺ縺ｮ2轤ｹ・・
                const vertices = new Float32Array([
                    v1.x, topY, v1.z,      // 荳願ｾｺ繝ｻ鬆らせ1
                    v1.x, bottomY, v1.z,   // 荳玖ｾｺ繝ｻ鬆らせ1
                    v2.x, bottomY, v2.z,   // 荳玖ｾｺ繝ｻ鬆らせ2
                    v2.x, topY, v2.z       // 荳願ｾｺ繝ｻ鬆らせ2
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
     * 繝励Ξ繝ｼ繧ｹ繝帙Ν繝繝ｼ蝨ｰ蠖｢・・apSystem險ｭ螳壼燕・・
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
     * 繧｢繧､繧ｽ繝｡繝医Μ繝・け繧ｰ繝ｪ繝・ラ邱壹が繝ｼ繝舌・繝ｬ繧､繧堤函謌・
     */
    createIsometricGridOverlay() {
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x444444,
            transparent: true,
            opacity: 0.3
        });

        const gridGroup = new THREE.Group();

        // 蜷・ち繧､繝ｫ縺ｮ蠅・阜邱壹ｒ謠冗判
        for (let y = 0; y <= MAP_H; y++) {
            for (let x = 0; x <= MAP_W; x++) {
                // 豌ｴ蟷ｳ邱夲ｼ・譁ｹ蜷托ｼ・
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

                // 蝙ら峩邱夲ｼ・譁ｹ蜷托ｼ・
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
     * MapSystem縺ｸ縺ｮ蜿ら・繧定ｨｭ螳・
     */
    setMapSystem(mapSystem) {
        this.mapSystem = mapSystem;
        // 鬮倥＆繧ｭ繝｣繝・す繝･縺ｯ繝上う繝医・繝・・繝ｭ繝ｼ繝画凾縺ｫcreateIsometricTiles()縺ｧ蛻晄悄蛹悶＆繧後ｋ
    }

    /**
     * 繝上う繝医・繝・・逕ｻ蜒上ｒ隗｣譫舌＠縺ｦMapSystem縺ｮ蝨ｰ蠖｢繝・・繧ｿ繧呈峩譁ｰ
     */
    analyzeHeightMap(image) {
        if (!this.mapSystem) return;

        console.log("Analyzing height map for terrain data...");

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        // 逕ｻ蜒上ョ繝ｼ繧ｿ繧貞叙蠕・
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // PlaneGeometry縺ｮ繧ｵ繧､繧ｺ縺ｨ驟咲ｽｮ
        const planeW = this.gridWidth * 1.2;
        const planeH = this.gridHeight * 1.2;
        // Plane縺ｮ蟾ｦ荳翫・繝ｯ繝ｼ繝ｫ繝牙ｺｧ讓・(荳ｭ蠢・°繧牙濠蛻・・繧ｵ繧､繧ｺ繧貞ｼ輔￥)
        const startX = this.gridCenterX - planeW / 2;
        const startZ = this.gridCenterZ - planeH / 2;

        let mountainCount = 0;
        let hillCount = 0;

        for (let r = 0; r < MAP_H; r++) {
            for (let q = 0; q < MAP_W; q++) {
                // 蜷ЗEX縺ｮ荳ｭ蠢・ｺｧ讓呻ｼ医Ρ繝ｼ繝ｫ繝牙ｺｧ讓呻ｼ峨ｒ蜿門ｾ・
                const worldPos = this.hexToWorld3D(q, r);

                // 繝ｯ繝ｼ繝ｫ繝牙ｺｧ讓吶°繧蔚V蠎ｧ讓・0.0-1.0)縺ｸ縺ｮ螟画鋤
                let u = (worldPos.x - startX) / planeW;
                let v = (worldPos.z - startZ) / planeH;

                let imgX = u * (canvas.width - 1);
                let imgY = v * (canvas.height - 1);

                // 遽・峇螟悶メ繧ｧ繝・け
                imgX = Math.max(0, Math.min(canvas.width - 1, imgX));
                imgY = Math.max(0, Math.min(canvas.height - 1, imgY));

                const px = Math.floor(imgX);
                const py = Math.floor(imgY);

                const index = (py * canvas.width + px) * 4;
                const heightVal = data[index]; // R謌仙・

                this.mapSystem.updateTerrain(q, r, heightVal);

                // 鬮倥＆繧ｭ繝｣繝・す繝･縺ｫ菫晏ｭ・(displacementScale = 50)
                if (!this.hexHeights[r]) this.hexHeights[r] = [];
                this.hexHeights[r][q] = (heightVal / 255) * 50;

                if (heightVal > 160) mountainCount++;
                else if (heightVal > 80) hillCount++;
            }
        }

        console.log(`Terrain analysis complete. Mountains: ${mountainCount}, Hills: ${hillCount}`);
    }

    /**
     * 繧ｰ繝ｪ繝・ラ螟悶・繧ｨ繝ｪ繧｢繧呈囓縺上☆繧九が繝ｼ繝舌・繝ｬ繧､繧剃ｽ懈・
     */
    createOutOfBoundsOverlay(gridWidth, gridHeight, centerX, centerZ) {
        // 繝倥ャ繧ｯ繧ｹ繧ｰ繝ｪ繝・ラ縺ｮ遽・峇螟悶ｒ證励￥縺吶ｋ
        // 蜷・・繝・け繧ｹ菴咲ｽｮ縺ｫ蟇ｾ縺励※縲√げ繝ｪ繝・ラ蜀・°縺ｩ縺・°繧貞愛螳壹＠縲・
        // 繧ｰ繝ｪ繝・ラ螟悶↑繧画囓縺・・繝・け繧ｹ蠖｢迥ｶ縺ｮ繧ｪ繝ｼ繝舌・繝ｬ繧､繧帝・鄂ｮ

        const overlayColor = 0x000000; // 鮟・
        const overlayOpacity = 0.35; // 騾乗・蠎ｦ・医・繝・け繧ｹ蜊倅ｽ阪・縺ｿ縺ｪ縺ｮ縺ｧ蟆代＠豼・￥縺吶ｋ・・

        // 繧医ｊ蠎・＞遽・峇繧偵メ繧ｧ繝・け・医げ繝ｪ繝・ラ繧医ｊ螟ｧ縺阪＞遽・峇・・
        const checkRangeQ = MAP_W + 20; // 螟門・繧ょｺ・￥繧ｫ繝舌・
        const checkRangeR = MAP_H + 20;

        for (let r = -10; r < checkRangeR; r++) {
            for (let q = -10; q < checkRangeQ; q++) {
                // 繧ｰ繝ｪ繝・ラ遽・峇螟悶・繝倥ャ繧ｯ繧ｹ縺ｫ繧ｪ繝ｼ繝舌・繝ｬ繧､繧帝・鄂ｮ
                if (q < 0 || q >= MAP_W || r < 0 || r >= MAP_H) {
                    this.addHexOverlay(q, r, overlayColor, overlayOpacity);
                }
            }
        }
    }

    /**
     * 謖・ｮ壹＠縺溘・繝・け繧ｹ菴咲ｽｮ縺ｫ證励＞繧ｪ繝ｼ繝舌・繝ｬ繧､繧定ｿｽ蜉
     */
    addHexOverlay(q, r, color, opacity, isRange = false) {
        const center = this.gridToWorld3D(q, r);
        const vertices = this.getHexagonVertices(q, r);

        // 蜈ｭ隗貞ｽ｢・郁廠蠖｢・峨・蠖｢迥ｶ繧剃ｽ懈・
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
        // 蟆代＠豬ｮ縺九○繧具ｼ医き繝ｼ繧ｽ繝ｫ繧医ｊ縺ｯ荳九∝慍髱｢繧医ｊ荳奇ｼ・
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
     * 遘ｻ蜍慕ｯ・峇縺ｮ繝上う繝ｩ繧､繝医ｒ陦ｨ遉ｺ
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
     * 遘ｻ蜍慕ｯ・峇縺ｮ繝上う繝ｩ繧､繝医ｒ豸亥悉
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
     * HEX繧ｰ繝ｪ繝・ラ繧貞慍蠖｢縺ｫ豐ｿ縺｣縺溷ｹｳ髱｢繧ｪ繝ｼ繝舌・繝ｬ繧､縺ｨ縺励※菴懈・
     */
    createHexGridOverlay(gridWidth, gridHeight, centerX, centerZ, heightMap) {
        // Canvas縺ｧ繝倥ャ繧ｯ繧ｹ繧ｰ繝ｪ繝・ラ繧呈緒逕ｻ
        const canvas = document.createElement('canvas');
        const size = 2048; // 繝・け繧ｹ繝√Ε繧ｵ繧､繧ｺ
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // 閭梧勹繧帝乗・縺ｫ
        ctx.clearRect(0, 0, size, size);

        // 繧ｰ繝ｪ繝・ラ繧呈緒逕ｻ
        ctx.strokeStyle = 'rgba(136, 170, 136, 0.5)'; // 蜊企乗・縺ｮ邱・
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

        // 蝨ｰ蠖｢縺ｨ蜷後§繧ｸ繧ｪ繝｡繝医Μ繧剃ｽｿ逕ｨ
        const gridGeometry = new THREE.PlaneGeometry(
            gridWidth * 1.2,
            gridHeight * 1.2,
            128,
            128
        );

        // 騾乗・縺ｪ繝槭ユ繝ｪ繧｢繝ｫ縺ｫ繧ｰ繝ｪ繝・ラ繝・け繧ｹ繝√Ε縺ｨDisplacementMap繧帝←逕ｨ
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
        gridOverlay.position.set(centerX, 5, centerZ); // 蝨ｰ蠖｢繧医ｊ蜊∝・荳翫↓
        gridOverlay.renderOrder = 1; // 蝨ｰ蠖｢縺ｮ蠕後↓謠冗判
        this.scene.add(gridOverlay);
    }

    /**
     * 繝ｦ繝九ャ繝医・陦ｨ遉ｺ繧呈峩譁ｰ・域ｯ弱ヵ繝ｬ繝ｼ繝蜻ｼ縺ｳ蜃ｺ縺暦ｼ・
     */
    updateUnits() {
        if (!window.gameState || !window.gameState.units) return;

        // groundMesh縺後∪縺縺ｪ縺・ｴ蜷医・繧ｹ繧ｭ繝・・
        if (!this.groundMesh) return;

        // 蜀榊茜逕ｨ蜿ｯ閭ｽ縺ｪVector3繧ｪ繝悶ず繧ｧ繧ｯ繝茨ｼ・C雋闕ｷ霆ｽ貂幢ｼ・
        if (!this._tempVec3) {
            this._tempVec3 = new THREE.Vector3();
            this._tempAnimOffset = new THREE.Vector3();
        }

        const activeIds = new Set();

        window.gameState.units.forEach(unit => {
            // isDying縺荊rue縺ｪ繧画ｭｻ莠｡繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ荳ｭ縺ｪ縺ｮ縺ｧ謠冗判繧堤ｶ壹￠繧・
            if (unit.dead && !unit.isDying) return;
            activeIds.add(unit.id);

            let mesh = this.unitMeshes.get(unit.id);
            if (!mesh) {
                // 譁ｰ隕上Θ繝九ャ繝井ｽ懈・
                mesh = this.createUnitMesh(unit);
                this.unitMeshes.set(unit.id, mesh);
                this.scene.add(mesh);
            }

            // 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ蜃ｦ逅・ｼ医く繝｣繝・す繝･縺輔ｌ縺欸ector3繧貞・蛻ｩ逕ｨ・・
            this._tempAnimOffset.set(0, 0, 0);
            if (mesh.userData.attackAnim && mesh.userData.attackAnim.active) {
                const anim = mesh.userData.attackAnim;
                // 騾溷ｺｦ蛟咲紫繧帝←逕ｨ
                const speedMultiplier = (window.game && window.game.actionSpeed) ? window.game.actionSpeed : 1.0;
                anim.progress += speedMultiplier;

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

            // 菴咲ｽｮ譖ｴ譁ｰ
            const rawPos = this.gridToWorld3D(unit.x, unit.y);

            // 蝨ｰ蠖｢鬮倥＆繧貞叙蠕暦ｼ・exHeights繧ｭ繝｣繝・す繝･繧貞━蜈茨ｼ・
            let groundHeight = 0;
            if (this.hexHeights && this.hexHeights[unit.y] && this.hexHeights[unit.y][unit.x] !== undefined) {
                groundHeight = this.hexHeights[unit.y][unit.x];
            }

            // 蟒ｺ迚ｩ縺後≠繧句ｴ蜷医・蟒ｺ迚ｩ縺ｮ鬮倥＆繧剃ｽｿ逕ｨ
            if (window.game && window.game.buildingSystem) {
                const bInfo = window.game.buildingSystem.getBuildingHeightAtWorldPos(rawPos.x, rawPos.z);
                if (bInfo && bInfo.isBuilding) {
                    // console.log removed
                    groundHeight = Math.max(groundHeight, bInfo.height);
                }
            }

            // 繧ｭ繝｣繝・す繝･縺輔ｌ縺欸ector3繧貞・蛻ｩ逕ｨ
            this._tempVec3.set(rawPos.x, groundHeight + 2, rawPos.z);
            this._tempVec3.add(this._tempAnimOffset);

            // 繧ｰ繝ｪ繝・ラ遘ｻ蜍墓､懷・・井ｽ咲ｽｮ霑ｽ霍｡繧貞・譛溷喧・・
            if (!mesh.userData.lastGridX) {
                mesh.userData.lastGridX = unit.x;
                mesh.userData.lastGridY = unit.y;
                mesh.userData.lastGroundHeight = groundHeight;
            }

            // 繧ｰ繝ｪ繝・ラ菴咲ｽｮ縺悟､峨ｏ縺｣縺溷ｴ蜷・
            const gridChanged = (mesh.userData.lastGridX !== unit.x || mesh.userData.lastGridY !== unit.y);
            const heightDiff = groundHeight - mesh.userData.lastGroundHeight;

            if (gridChanged && Math.abs(heightDiff) > 0.01) {
                // 谿ｵ蟾ｮ遘ｻ蜍輔い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ髢句ｧ・
                mesh.userData.elevAnim = {
                    active: true,
                    progress: 0,
                    duration: 6, // 髱槫ｸｸ縺ｫ遏ｭ縺・ｼ育ｴ・00ms・・
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

            // 谿ｵ蟾ｮ遘ｻ蜍輔い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ蜃ｦ逅・
            let elevYOffset = 0;
            if (mesh.userData.elevAnim && mesh.userData.elevAnim.active) {
                const anim = mesh.userData.elevAnim;
                anim.progress++;

                if (anim.progress >= anim.duration) {
                    // 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ螳御ｺ・
                    anim.active = false;
                } else {
                    const t = anim.progress / anim.duration;

                    // 豌ｴ蟷ｳ菴咲ｽｮ縺ｯ邱壼ｽ｢陬憺俣・医き繧ｯ繝・→蜍輔°縺呻ｼ・
                    mesh.position.x = anim.startX + (anim.targetX - anim.startX) * t;
                    mesh.position.z = anim.startZ + (anim.targetZ - anim.startZ) * t;

                    // 蝙ら峩譁ｹ蜷托ｼ壽ｮｵ蟾ｮ縺ｫ豐ｿ縺｣縺ｦ遘ｻ蜍・+ 蟆上＆縺ｪ繧ｸ繝｣繝ｳ繝・
                    // 蜑榊濠縺ｧ譌ｧ鬮倥＆縺九ｉ譁ｰ鬮伜ｺｦ縺ｸ縲∝ｾ悟濠縺ｧ縺昴％縺九ｉ逶ｮ讓吩ｽ咲ｽｮ縺ｸ
                    // 縺昴・騾比ｸｭ縺ｧ蠕ｮ蟆上↑繧ｸ繝｣繝ｳ繝暦ｼ磯ｫ倥＆0.3遞句ｺｦ縲∵戟邯壽凾髢薙・荳ｭ螟ｮ莉倩ｿ托ｼ・
                    const prevHeight = anim.lastHeight + 2;
                    const newHeight = anim.targetBaseY;

                    // 蝓ｺ譛ｬ縺ｮ鬮倥＆螟牙喧・域ｮｵ蟾ｮ縺ｫ豐ｿ縺｣縺溽ｧｻ蜍包ｼ・
                    let baseY;
                    if (t < 0.5) {
                        // 蜑榊濠・壽立鬮倥＆縺九ｉ荳ｭ髢鍋せ縺ｸ
                        baseY = prevHeight + (newHeight - prevHeight) * (t * 2);
                    } else {
                        // 蠕悟濠・壻ｸｭ髢鍋せ縺九ｉ譁ｰ鬮倥＆縺ｸ
                        baseY = newHeight;
                    }

                    // 蟆上＆縺ｪ繧ｸ繝｣繝ｳ繝暦ｼ域ｭ｣蠑ｦ豕｢縲∽ｸｭ螟ｮ縺ｮ遏ｭ縺・玄髢薙・縺ｿ・・
                    // t=0.35-0.65縺ｮ髢薙□縺代〒逋ｺ蜍輔∵怙螟ｧ鬮倥＆0.3
                    let jumpOffset = 0;
                    const jumpCenter = 0.5;
                    const jumpWidth = 0.15; // 繧ｸ繝｣繝ｳ繝励・蟷・ｼ育強縺上☆繧具ｼ・
                    if (Math.abs(t - jumpCenter) < jumpWidth) {
                        const jumpT = (t - (jumpCenter - jumpWidth)) / (jumpWidth * 2); // 0 to 1 within jump window
                        jumpOffset = Math.sin(jumpT * Math.PI) * 0.3; // 譛螟ｧ0.3縺ｮ繧ｸ繝｣繝ｳ繝・
                    }

                    elevYOffset = baseY + jumpOffset - anim.targetBaseY;
                }
            }

            this._tempVec3.y += elevYOffset;

            // 迴ｾ蝨ｨ菴咲ｽｮ縺ｨ繧ｿ繝ｼ繧ｲ繝・ヨ菴咲ｽｮ縺碁屬繧後※縺・ｋ蝣ｴ蜷医・縺ｿ譖ｴ譁ｰ・域ｮｵ蟾ｮ繧｢繝九Γ荳ｭ縺ｯ蟶ｸ縺ｫ譖ｴ譁ｰ・・
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

            // 菴咲ｽｮ諠・ｱ繧呈峩譁ｰ
            mesh.userData.lastGridX = unit.x;
            mesh.userData.lastGridY = unit.y;
            mesh.userData.lastGroundHeight = groundHeight;

            // 逕ｻ髱｢豁｣蟇ｾ繝薙Ν繝懊・繝・- 繧ｹ繝励Λ繧､繝医′繧ｫ繝｡繝ｩ縺ｮ繝薙Η繝ｼ蟷ｳ髱｢縺ｫ螳悟・縺ｫ蟷ｳ陦・
            // 逕ｻ髱｢荳翫〒縺ｯ蟶ｸ縺ｫ縺ｾ縺｣縺吶＄遶九▲縺ｦ隕九∴繧・
            const sprite = mesh.getObjectByName('unitSprite');
            if (sprite && this.camera) {
                // 繧ｫ繝｡繝ｩ縺ｮ繧ｯ繧ｩ繝ｼ繧ｿ繝九が繝ｳ繧偵さ繝斐・縺励※縲√せ繝励Λ繧､繝医ｒ繧ｫ繝｡繝ｩ縺ｨ蜷後§蜷代″縺ｫ
                sprite.quaternion.copy(this.camera.quaternion);
            }

            // 驕ｸ謚樒憾諷九・繝上う繝ｩ繧､繝域峩譁ｰ
            const isSelected = window.game && window.game.selectedUnits && window.game.selectedUnits.some(u => u.id === unit.id);
            if (mesh.material) {
                if (mesh.userData.flashTime > 0) {
                    // 繝輔Λ繝・す繝･荳ｭ
                    mesh.material.emissive.setHex(mesh.userData.flashColor || 0xFFFFFF);
                    mesh.userData.flashTime--;
                } else if (isSelected) {
                    mesh.material.emissive.setHex(0x666666); // 逋ｽ縺冗匱蜈・
                } else {
                    mesh.material.emissive.setHex(0x000000); // 騾壼ｸｸ
                }
            }

            // 驕ｸ謚槭Μ繝ｳ繧ｰ縺ｮ陦ｨ遉ｺ蛻・ｊ譖ｿ縺・
            const selRing = mesh.getObjectByName('selectionRing');
            if (selRing) {
                selRing.visible = isSelected;
                if (isSelected) {
                    // 轤ｹ貊・い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ
                    const time = Date.now() * 0.005;
                    selRing.material.opacity = 0.5 + Math.sin(time) * 0.3;
                }
            }

            // 繧ｹ繝励Λ繧､繝医い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ譖ｴ譁ｰ
            // 蜆ｪ蜈磯・ｽ・ 豁ｻ莠｡ > 陲ｫ繝繝｡繝ｼ繧ｸ > 謾ｻ謦・ｸｭ > 陦悟虚貂医∩(髱呎ｭ｢) > 遘ｻ蜍穂ｸｭ > 譛ｪ陦悟虚(蠕・ｩ・
            let animType = 'ready'; // 繝・ヵ繧ｩ繝ｫ繝・ 譛ｪ陦悟虚・・1-02繝ｫ繝ｼ繝暦ｼ・

            if (unit.isDying) {
                // 豁ｻ莠｡繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ・・6繝代ち繝ｼ繝ｳ・・
                animType = 'death';
            } else if (unit.isDamaged) {
                // 陲ｫ繝繝｡繝ｼ繧ｸ繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ・・5繝代ち繝ｼ繝ｳ・・
                animType = 'damage';
            } else if (unit.isAttacking) {
                // 謾ｻ謦・い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ荳ｭ
                animType = 'attack';
            } else if (unit.hasActed) {
                // 陦悟虚貂医∩・磯撕豁｢・・ 謾ｻ謦・ｄ遘ｻ蜍輔′螳御ｺ・＠縺溷ｾ・
                animType = 'idle';
            } else if (unit.order && (unit.order.type === 'MOVE' || unit.order.type === 'ATTACK')) {
                // 遘ｻ蜍穂ｸｭ縺ｾ縺溘・謾ｻ謦・・縺溘ａ遘ｻ蜍穂ｸｭ
                animType = 'walk';
            }
            // else: ready・域悴陦悟虚縲∝ｾ・ｩ滉ｸｭ・・

            this.updateSpriteAnimation(unit.id, unit, animType);

            // 蜈ｵ螢ｫ謨ｰ繧ｲ繝ｼ繧ｸ譖ｴ譁ｰ
            this.updateUnitInfo(mesh, unit);
        });

        // 豁ｻ莠｡縺励◆繝ｦ繝九ャ繝医ｒ蜑企勁
        for (const [id, mesh] of this.unitMeshes) {
            if (!activeIds.has(id)) {
                this.scene.remove(mesh);
                // 繝｡繝｢繝ｪ繝ｪ繝ｼ繧ｯ髦ｲ豁｢縺ｮ縺溘ａ縺ｮdispose蜃ｦ逅・・逵∫払・育ｰ｡譏灘ｮ溯｣・ｼ・
                this.unitMeshes.delete(id);
            }
        }
    }

    /**
     * 繧ｹ繝励Λ繧､繝医ユ繧ｯ繧ｹ繝√Ε繧偵Ο繝ｼ繝会ｼ亥句挨繝輔ぃ繧､繝ｫ迚・+ 濶ｲ逶ｸ繧ｷ繝輔ヨ・・
     * 譚ｱ霆・繧ｪ繝ｪ繧ｸ繝翫Ν・磯搨邉ｻ・峨∬･ｿ霆・濶ｲ逶ｸ繧ｷ繝輔ヨ・郁ｵ､邉ｻ・・
     */
    loadSpriteTextures() {
        const paths = getAllSpritePaths();

        for (const path of paths) {
            // 逕ｻ蜒上ｒ繝ｭ繝ｼ繝峨＠縺ｦ縺九ｉ繝・け繧ｹ繝√Ε繧剃ｽ懈・
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                // 繧ｪ繝ｪ繧ｸ繝翫Ν・域擲霆咲畑・・
                const eastTexture = this.createTextureFromImage(img);
                this.spriteTextures.set(`EAST:${path}`, eastTexture);

                // 濶ｲ逶ｸ繧ｷ繝輔ヨ迚茨ｼ郁･ｿ霆咲畑・・ 髱停・襍､
                const westCanvas = this.hueShiftImage(img, 180); // 180蠎ｦ繧ｷ繝輔ヨ縺ｧ髱停・襍､
                const westTexture = this.createTextureFromCanvas(westCanvas);
                this.spriteTextures.set(`WEST:${path}`, westTexture);
            };
            img.src = path;
            img.onerror = () => {
                console.warn(`[Rendering] Failed to load sprite: ${path}. Generating fallback texture.`);
                // フォールバック: カラー矩形
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#888';
                ctx.fillRect(0, 0, 64, 64);
                ctx.strokeStyle = '#F00';
                ctx.strokeRect(2, 2, 60, 60); // 枠線

                const fallbackTex = this.createTextureFromCanvas(canvas);
                this.spriteTextures.set(`EAST:${path}`, fallbackTex);
                this.spriteTextures.set(`WEST:${path}`, fallbackTex); // 同じものをセット
            };
        }
    }

    /**
     * 逕ｻ蜒上°繧峨ユ繧ｯ繧ｹ繝√Ε繧剃ｽ懈・
     */
    createTextureFromImage(img) {
        const texture = new THREE.Texture(img);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.premultiplyAlpha = false; // 繧｢繝ｫ繝輔ぃ騾城℃繧呈ｭ｣縺励￥蜃ｦ逅・
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * Canvas縺九ｉ繝・け繧ｹ繝√Ε繧剃ｽ懈・
     */
    createTextureFromCanvas(canvas) {
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.premultiplyAlpha = false; // 繧｢繝ｫ繝輔ぃ騾城℃繧呈ｭ｣縺励￥蜃ｦ逅・
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * 逕ｻ蜒上・濶ｲ逶ｸ繧偵す繝輔ヨ・磯搨竊定ｵ､螟画鋤逕ｨ・・
     * @param {HTMLImageElement} img - 蜈・判蜒・
     * @param {number} hueShift - 濶ｲ逶ｸ繧ｷ繝輔ヨ驥擾ｼ亥ｺｦ・・
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

            // 騾乗・繝斐け繧ｻ繝ｫ縺ｯ繧ｹ繧ｭ繝・・
            if (a === 0) continue;

            // RGB to HSL
            const [h, s, l] = this.rgbToHsl(r, g, b);

            // 濶ｲ逶ｸ繧ｷ繝輔ヨ
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
     * RGB to HSL螟画鋤
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
     * HSL to RGB螟画鋤
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
     * 繝ｦ繝九ャ繝医Γ繝・す繝･繧剃ｽ懈・縺励※霑斐☆・亥句挨繧ｹ繝励Λ繧､繝医ヵ繧｡繧､繝ｫ迚茨ｼ・
     */
    createUnitMesh(unit) {
        // 繧ｳ繝ｳ繝・リ繧ｰ繝ｫ繝ｼ繝励ｒ菴懈・
        const group = new THREE.Group();
        group.userData = { unitId: unit.id };

        const size = HEX_SIZE * 0.6;
        const side = unit.side || 'EAST';

        // 1. 繧ｹ繝励Λ繧､繝医ン繝ｫ繝懊・繝会ｼ・laneGeometry繧剃ｽｿ逕ｨ縺励※繝輔Μ繝・・蟇ｾ蠢懶ｼ・
        const planeGeo = new THREE.PlaneGeometry(size * 2, size * 2);
        const initialSpriteInfo = getSpriteInfo(unit.dir || 0, '00');
        // 謇螻櫁ｻ阪↓蠢懊§縺溘ユ繧ｯ繧ｹ繝√Ε繧貞叙蠕暦ｼ・AST=髱・ WEST=襍､・・
        const textureKey = `${side}:${initialSpriteInfo.path}`;
        const initialTexture = this.spriteTextures.get(textureKey);

        const planeMat = new THREE.MeshBasicMaterial({
            map: initialTexture || null,
            transparent: true,
            side: THREE.DoubleSide,
            alphaTest: 0.5,      // 繧｢繝ｫ繝輔ぃ縺・.5莉･荳九・繝斐け繧ｻ繝ｫ縺ｯ謠冗判縺励↑縺・
            depthWrite: false,   // 豺ｱ蠎ｦ繝舌ャ繝輔ぃ縺ｫ譖ｸ縺崎ｾｼ縺ｾ縺ｪ縺・
            depthTest: false     // 豺ｱ蠎ｦ繝・せ繝育┌蜉ｹ・亥ｸｸ縺ｫ蝨ｰ蠖｢縺ｮ荳翫↓謠冗判・・
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.position.y = size * 1.0;
        plane.name = 'unitSprite';
        plane.renderOrder = 100; // 蝨ｰ蠖｢繧医ｊ蠕後↓謠冗判・磯ｫ倥＞蛟､=蠕後↓謠冗判・・
        group.add(plane);

        // 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ迥ｶ諷九ｒ蛻晄悄蛹・
        this.unitAnimationStates.set(unit.id, {
            anim: 'idle',
            frame: 0,
            lastUpdate: Date.now(),
            dir: unit.dir || 0,
            side: side,
            material: planeMat,
            mesh: plane
        });

        // 3. 譛ｬ髯｣縺ｮ蝣ｴ蜷医・≡濶ｲ縺ｮ繝ｪ繝ｳ繧ｰ繧定ｿｽ蜉
        if (unit.unitType === 'HEADQUARTERS') {
            const ringGeo = new THREE.RingGeometry(size * 0.9, size * 1.0, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xFFD700, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 2;
            ring.name = 'hqRing';
            group.add(ring);
        }

        // 4. 驕ｸ謚槭Μ繝ｳ繧ｰ・亥・譛溽憾諷九・髱櫁｡ｨ遉ｺ・・
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

        // 5. HitBox・医け繝ｪ繝・け蛻､螳夂畑・・
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

        // 諠・ｱ繧ｪ繝ｼ繝舌・繝ｬ繧､蛻晄悄菴懈・
        this.createUnitInfoOverlay(group, unit);

        return group;
    }

    /**
     * 繧ｹ繝励Λ繧､繝医い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧呈峩譁ｰ・亥句挨繝輔ぃ繧､繝ｫ迚茨ｼ・
     * @param {number} unitId - 繝ｦ繝九ャ繝・D
     * @param {Object} unit - 繝ｦ繝九ャ繝医が繝悶ず繧ｧ繧ｯ繝・
     * @param {string} animName - 蛻・ｊ譖ｿ縺医ｋ繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ蜷搾ｼ育怐逡･譎ゅ・迴ｾ蝨ｨ縺ｮ縺ｾ縺ｾ・・
     */
    updateSpriteAnimation(unitId, unit = null, animName = null) {
        const state = this.unitAnimationStates.get(unitId);
        if (!state) return;

        const now = Date.now();

        // 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ蛻・ｊ譖ｿ縺・
        if (animName && animName !== state.anim && ANIMATIONS[animName]) {
            state.anim = animName;
            state.frame = 0;
            state.lastUpdate = now;
        }

        const anim = ANIMATIONS[state.anim];
        if (!anim) return;

        // 譁ｹ蜷第峩譁ｰ
        if (unit && unit.dir !== undefined) {
            state.dir = unit.dir;
        }

        // 繝輔Ξ繝ｼ繝譖ｴ譁ｰ
        if (now - state.lastUpdate >= anim.speed) {
            const frameCount = anim.frameIds.length;
            state.frame++;
            if (state.frame >= frameCount) {
                state.frame = anim.loop ? 0 : frameCount - 1;
            }
            state.lastUpdate = now;
        }

        // 繝・け繧ｹ繝√Ε繧貞・繧頑崛縺茨ｼ域園螻櫁ｻ阪↓蠢懊§縺溯牡・・
        const frameId = anim.frameIds[state.frame];
        const spriteInfo = getSpriteInfo(state.dir, frameId);
        // 蟇晁ｿ斐ｊ蟇ｾ蠢・ 繝ｦ繝九ャ繝医・迴ｾ蝨ｨ縺ｮside繧剃ｽｿ逕ｨ・医く繝｣繝・す繝･縺輔ｌ縺殱tate.side縺ｧ縺ｯ縺ｪ縺擾ｼ・
        const currentSide = unit && unit.side ? unit.side : state.side;
        const textureKey = `${currentSide}:${spriteInfo.path}`;
        const texture = this.spriteTextures.get(textureKey);

        if (texture && state.material) {
            state.material.map = texture;
            state.material.needsUpdate = true;

            // 蜿崎ｻ｢縺悟ｿ・ｦ√↑蝣ｴ蜷医・繧ｹ繧ｱ繝ｼ繝ｫ縺ｧ繝輔Μ繝・・
            if (state.mesh) {
                state.mesh.scale.x = spriteInfo.flip ? -1 : 1;
            }
        }
    }

    /**
     * 繝ｦ繝九ャ繝医・謾ｻ謦・い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧偵ヨ繝ｪ繧ｬ繝ｼ
     * @param {string} attackerId - 謾ｻ謦・・・繝ｦ繝九ャ繝・D
     * @param {string} targetId - 謾ｻ謦・ｯｾ雎｡縺ｮ繝ｦ繝九ャ繝・D
     */
    triggerUnitAttackAnimation(attackerId, targetId) {
        // 謾ｻ謦・・↓isAttacking繝輔Λ繧ｰ繧堤ｫ九※繧具ｼ井ｸ螳壽凾髢灘ｾ後↓隗｣髯､・・
        if (window.game && window.game.unitManager) {
            const units = window.game.unitManager.getUnits();
            const attacker = units.find(u => u.id === attackerId);
            if (attacker) {
                attacker.isAttacking = true;
                // 謾ｻ謦・い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ邨ゆｺ・ｾ後↓繝輔Λ繧ｰ繧定ｧ｣髯､
                setTimeout(() => {
                    attacker.isAttacking = false;
                }, 900); // 謾ｻ謦・い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ縺ｮ謖∫ｶ壽凾髢・
            }
        }
    }

    /**
     * 繝ｦ繝九ャ繝医・陲ｫ繝繝｡繝ｼ繧ｸ繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧偵ヨ繝ｪ繧ｬ繝ｼ
     * @param {string} unitId - 繝繝｡繝ｼ繧ｸ繧貞女縺代◆繝ｦ繝九ャ繝医・ID
     */
    triggerDamageAnimation(unitId) {
        if (window.game && window.game.unitManager) {
            const units = window.game.unitManager.getAllUnits();
            const unit = units.find(u => u.id === unitId);
            if (unit) {
                unit.isDamaged = true;
                // 繝繝｡繝ｼ繧ｸ繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ蠕後↓繝輔Λ繧ｰ繧定ｧ｣髯､
                setTimeout(() => {
                    unit.isDamaged = false;
                }, 400); // 繝繝｡繝ｼ繧ｸ繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ縺ｮ謖∫ｶ壽凾髢・
            }
        }
    }

    /**
     * 繝ｦ繝九ャ繝医・豁ｻ莠｡繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧偵ヨ繝ｪ繧ｬ繝ｼ・亥偵ｌ + 繝輔ぉ繝ｼ繝峨い繧ｦ繝茨ｼ・
     * @param {string} unitId - 豁ｻ莠｡縺励◆繝ｦ繝九ャ繝医・ID
     */
    triggerDeathAnimation(unitId) {
        const mesh = this.unitMeshes.get(unitId);
        if (!mesh) return;

        // 豁ｻ莠｡繝輔Λ繧ｰ繧堤ｫ九※繧具ｼ医％繧後↓繧医ｊ繧ｹ繝励Λ繧､繝医′蛟偵ｌ繝代ち繝ｼ繝ｳ06縺ｫ蛻・ｊ譖ｿ繧上ｋ・・
        if (window.game && window.game.unitManager) {
            const units = window.game.unitManager.getAllUnits();
            const unit = units.find(u => u.id === unitId);
            if (unit) {
                unit.isDying = true;
            }
        }

        // 繧ｹ繝励Λ繧､繝医ｒ蜿門ｾ・
        const sprite = mesh.getObjectByName('unitSprite');
        if (sprite && sprite.material) {
            // 騾溷ｺｦ蛟咲紫繧貞叙蠕・
            const speedMultiplier = (window.game && window.game.actionSpeed) ? window.game.actionSpeed : 1.0;

            // 縺ｾ縺壼偵ｌ繧ｹ繝励Λ繧､繝医ｒ隕九○繧九◆繧√↓蟆代＠蠕・▽
            setTimeout(() => {
                // 繝輔ぉ繝ｼ繝峨い繧ｦ繝磯幕蟋・
                let opacity = 1.0;
                const fadeInterval = setInterval(() => {
                    opacity -= 0.05 * speedMultiplier; // 騾溷ｺｦ縺ｫ蠢懊§縺ｦ繝輔ぉ繝ｼ繝峨ｒ騾溘￥
                    sprite.material.opacity = Math.max(0, opacity);
                    sprite.material.needsUpdate = true;

                    if (opacity <= 0) {
                        clearInterval(fadeInterval);
                        // 繝輔ぉ繝ｼ繝峨い繧ｦ繝亥ｮ御ｺ・ｾ後↓繝｡繝・す繝･繧帝撼陦ｨ遉ｺ縲（sDying繧偵け繝ｪ繧｢縺励※蜑企勁蜿ｯ閭ｽ縺ｫ
                        mesh.visible = false;
                        if (window.game && window.game.unitManager) {
                            const units = window.game.unitManager.getAllUnits();
                            const unit = units.find(u => u.id === unitId);
                            if (unit) {
                                unit.isDying = false; // 縺薙ｌ縺ｫ繧医ｊupdateUnits縺ｧ繝｡繝・す繝･縺悟炎髯､縺輔ｌ繧・
                            }
                        }
                    }
                }, 50 / speedMultiplier); // 騾溷ｺｦ縺ｫ蠢懊§縺ｦ髢馴囈繧堤洒縺・
            }, 800 / speedMultiplier); // 800ms蠕後↓繝輔ぉ繝ｼ繝峨い繧ｦ繝磯幕蟋具ｼ磯溷ｺｦ隱ｿ謨ｴ・・
        }
    }

    /**
     * 繝ｦ繝九ャ繝域ュ蝣ｱ繧ｪ繝ｼ繝舌・繝ｬ繧､・亥・螢ｫ繧ｲ繝ｼ繧ｸ縲∝ｮｶ邏具ｼ峨ｒ菴懈・
     */
    createUnitInfoOverlay(mesh, unit) {
        // 蜈ｵ螢ｫ繧ｲ繝ｼ繧ｸ逕ｨ繧ｹ繝励Λ繧､繝・
        const barSprite = this.createBarSprite(unit);
        barSprite.name = 'barSprite';
        barSprite.position.set(0, 20, 0); // 鬮倥＆隱ｿ謨ｴ
        mesh.add(barSprite);

        // 譛ｬ髯｣繝槭・繧ｫ繝ｼ縺ｨ蜷榊燕
        if (unit.unitType === 'HEADQUARTERS') {
            const kSprite = this.createKamonSprite(unit);
            kSprite.position.set(0, 35, 0); // 鬮倥＆隱ｿ謨ｴ
            mesh.add(kSprite);

            // 蜷榊燕繝ｩ繝吶Ν
            const nameSprite = this.createNameSprite(unit.name);
            nameSprite.position.set(0, 50, 0); // 鬮倥＆隱ｿ謨ｴ
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
        // 繝ｦ繝ｼ繧ｶ繝ｼ縺ｮ謖・遭縺ｫ繧医ｊ縲∝句挨縺ｮ豁ｦ蟆・き繝ｩ繝ｼ縺ｧ縺ｯ縺ｪ縺城劵蝟ｶ濶ｲ繧剃ｽｿ逕ｨ縺吶ｋ・郁ｦ冶ｪ肴ｧ蜷台ｸ翫→邨ｱ荳諢溘・縺溘ａ・・
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
        // 蜈ｵ螢ｫ繧ｲ繝ｼ繧ｸ縺ｮ譖ｴ譁ｰ
        const barSprite = mesh.getObjectByName('barSprite');
        if (barSprite) {
            // 蛟､縺悟､峨ｏ縺｣縺溘→縺阪・縺ｿ譖ｴ譁ｰ
            if (mesh.userData.lastSoldiers === unit.soldiers && mesh.userData.lastMaxSoldiers === unit.maxSoldiers) {
                return;
            }

            // 繝・け繧ｹ繝√Ε縺ｮ縺ｿ譖ｴ譁ｰ縺励◆縺・′縲，anvasTexture縺ｮ譖ｴ譁ｰ縺ｯ繧ｳ繧ｹ繝医′鬮倥＞縺ｮ縺ｧ
            // 蜈ｵ謨ｰ縺悟､峨ｏ縺｣縺溘→縺阪・縺ｿ蜀肴緒逕ｻ縺吶ｋ繝ｭ繧ｸ繝・け繧貞・繧後ｋ縺ｹ縺・
            const texture = barSprite.material.map;
            const canvas = texture.image;
            const ctx = canvas.getContext('2d');
            this.drawBar(ctx, unit.soldiers, unit.maxSoldiers, canvas.width, canvas.height);
            texture.needsUpdate = true;

            // 繧ｭ繝｣繝・す繝･譖ｴ譁ｰ
            mesh.userData.lastSoldiers = unit.soldiers;
            mesh.userData.lastMaxSoldiers = unit.maxSoldiers;
        }
    }

    /**
     * 繝ｦ繝九ャ繝医・隕九◆逶ｮ・郁牡縲∝ｮｶ邏九↑縺ｩ・峨ｒ譖ｴ譁ｰ
     * 蟇晁ｿ斐ｊ縺ｪ縺ｩ縺ｧ謇螻槭′螟峨ｏ縺｣縺溷ｴ蜷医↓蜻ｼ縺ｳ蜃ｺ縺・
     */
    updateUnitVisuals(unit) {
        const mesh = this.unitMeshes.get(unit.id);
        if (!mesh) return;

        // 譛ｬ菴薙・濶ｲ譖ｴ譁ｰ
        // mesh閾ｪ菴薙′ExtrudeGeometry繧呈戟縺､譛ｬ菴・
        if (mesh.material && mesh.material.color) {
            let color = 0x88AAEE;
            if (unit.side === 'WEST') color = 0xEE4444;
            else if (unit.side === 'EAST') color = 0x88AAEE;
            else color = 0x888888;
            mesh.material.color.setHex(color);
        }

        // 螳ｶ邏九せ繝励Λ繧､繝医・蜀咲函謌舌→蟾ｮ縺玲崛縺茨ｼ域悽髯｣縺ｮ縺ｿ・・
        if (unit.unitType === 'HEADQUARTERS') {
            const oldKamon = mesh.getObjectByName('kamonSprite');
            if (oldKamon) {
                mesh.remove(oldKamon);
                // 繝｡繝｢繝ｪ隗｣謾ｾ
                if (oldKamon.material.map) oldKamon.material.map.dispose();
                if (oldKamon.material) oldKamon.material.dispose();
            }

            const newKamon = this.createKamonSprite(unit);
            newKamon.name = 'kamonSprite';
            newKamon.position.set(0, 45, 0); // 鬮倥＆隱ｿ謨ｴ (createUnitInfoOverlay縺ｨ蜷医ｏ縺帙ｋ)
            mesh.add(newKamon);
        }
    }

    // 蜿､縺・Γ繧ｽ繝・ラ・井ｺ呈鋤諤ｧ縺ｮ縺溘ａ谿九☆縺御ｸｭ霄ｫ縺ｯ遨ｺ縺ｾ縺溘・updateUnits縺ｸ蟋碑ｭｲ・・
    drawUnits() {
        this.updateUnits();
    }

    /**
     * 繧ｰ繝ｪ繝・ラ蠎ｧ讓・x, y)繧・D遨ｺ髢薙・繝ｯ繝ｼ繝ｫ繝牙ｺｧ讓吶↓螟画鋤・医け繧ｩ繝ｼ繧ｿ繝ｼ繝薙Η繝ｼ/繧｢繧､繧ｽ繝｡繝医Μ繝・け・・
     * @param {number} x - 繧ｰ繝ｪ繝・ラX蠎ｧ讓・
     * @param {number} y - 繧ｰ繝ｪ繝・ラY蠎ｧ讓・
     * @param {number} z - 鬮倥＆・域ｮｵ謨ｰ縲√が繝励す繝ｧ繝ｳ・・
     */
    gridToWorld3D(x, y, z = 0) {
        // 繧｢繧､繧ｽ繝｡繝医Μ繝・け螟画鋤・・5蠎ｦ蝗櫁ｻ｢縺励◆闖ｱ蠖｢繧ｰ繝ｪ繝・ラ・・
        const worldX = (x - y) * TILE_SIZE / 2;
        const worldZ = (x + y) * TILE_SIZE / 4;
        const worldY = z * TILE_HEIGHT;
        return { x: worldX, y: worldY, z: worldZ };
    }

    /**
     * 謖・ｮ壹げ繝ｪ繝・ラ縺ｮ蝨ｰ髱｢縺ｮ鬮倥＆繧貞叙蠕・
     */
    getGroundHeight(x, y) {
        if (this.hexHeights && this.hexHeights[y] && this.hexHeights[y][x] !== undefined) {
            return this.hexHeights[y][x];
        }
        return 0;
    }

    /**
     * 譌ｧAPI莠呈鋤・壹・繝・け繧ｹ蠎ｧ讓吶ｒ3D遨ｺ髢薙・XZ蠎ｧ讓吶↓螟画鋤
     * @deprecated gridToWorld3D繧剃ｽｿ逕ｨ縺励※縺上□縺輔＞
     */
    hexToWorld3D(q, r) {
        // q -> x, r -> y 縺ｨ縺励※譁ｰ縺励＞螟画鋤繧剃ｽｿ逕ｨ
        return this.gridToWorld3D(q, r, 0);
    }

    /**
     * 蜈ｭ隗貞ｽ｢・郁廠蠖｢・峨・鬆らせ繧貞叙蠕暦ｼ・Z蟷ｳ髱｢・・
     * 繧｢繧､繧ｽ繝｡繝医Μ繝・け逕ｨ縺ｫ闖ｱ蠖｢縺ｮ鬆らせ繧定ｿ斐☆
     */
    getHexagonVertices(q, r) {
        // q, r 縺ｯ x, y
        const center = this.gridToWorld3D(q, r);
        const hw = TILE_SIZE / 2;
        const hh = TILE_SIZE / 4;

        // 鬮倥＆繧り・・・医〒縺阪ｌ縺ｰ・・
        let y = 2; // 繝・ヵ繧ｩ繝ｫ繝茨ｼ亥慍髱｢縺吶ｌ縺吶ｌ・・
        if (this.hexHeights && this.hexHeights[r] && this.hexHeights[r][q] !== undefined) {
            y = this.hexHeights[r][q] + 2;
        }

        // 闖ｱ蠖｢縺ｮ4鬆らせ (荳ｭ蠢・°繧峨・繧ｪ繝輔そ繝・ヨ)
        // 蛹励∵擲縲∝漉縲∬･ｿ
        return [
            new THREE.Vector3(center.x, y, center.z - hh),
            new THREE.Vector3(center.x + hw, y, center.z),
            new THREE.Vector3(center.x, y, center.z + hh),
            new THREE.Vector3(center.x - hw, y, center.z)
        ];
    }

    /**
     * 繝倥ャ繧ｯ繧ｹ繧ｰ繝ｪ繝・ラ繧・D遨ｺ髢薙↓謠冗判
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

                // 蜈ｭ隗貞ｽ｢縺ｮ繝ｩ繧､繝ｳ繧呈緒逕ｻ
                const geometry = new THREE.BufferGeometry().setFromPoints([...vertices, vertices[0]]);
                const line = new THREE.Line(geometry, lineMaterial);
                this.scene.add(line);
            }
        }
    }

    /**
     * 逕ｻ髱｢遶ｯ縺ｧ縺ｮ繧ｫ繝｡繝ｩ蝗櫁ｻ｢蜃ｦ逅・
     */
    handleEdgeRotation() {
        // 蜿ｳ繧ｯ繝ｪ繝・け荳ｭ縺ｮ縺ｿ蝗櫁ｻ｢・医Θ繝ｼ繧ｶ繝ｼ隕∵悍・・
        if (!this.isRightMouseDown) return;

        const margin = 20; // 蜿榊ｿ懊☆繧狗判髱｢遶ｯ縺ｮ蟷・ｼ医ヴ繧ｯ繧ｻ繝ｫ・・
        const rotateSpeed = 0.03; // 蝗櫁ｻ｢騾溷ｺｦ

        const x = this.mouse.x;
        const y = this.mouse.y;
        const w = window.innerWidth;
        const h = window.innerHeight;

        let theta = 0; // 豌ｴ蟷ｳ蝗櫁ｻ｢・・zimuth・・
        let phi = 0;   // 蝙ら峩蝗櫁ｻ｢・・olar・・

        // 蟾ｦ遶ｯ繝ｻ蜿ｳ遶ｯ
        if (x < margin) theta = rotateSpeed;
        else if (x > w - margin) theta = -rotateSpeed;

        // 荳顔ｫｯ繝ｻ荳狗ｫｯ
        if (y < margin) phi = -rotateSpeed;
        else if (y > h - margin) phi = rotateSpeed;

        if (theta !== 0 || phi !== 0) {
            // 迴ｾ蝨ｨ縺ｮ繧ｫ繝｡繝ｩ菴咲ｽｮ・医ち繝ｼ繧ｲ繝・ヨ逶ｸ蟇ｾ・峨ｒ蜿門ｾ・
            const offset = new THREE.Vector3().copy(this.camera.position).sub(this.controls.target);

            // 逅・擇蠎ｧ讓吶↓螟画鋤
            const spherical = new THREE.Spherical().setFromVector3(offset);

            // 蝗櫁ｻ｢繧帝←逕ｨ
            spherical.theta += theta;
            spherical.phi += phi;

            // 蝙ら峩隗貞ｺｦ縺ｮ蛻ｶ髯撰ｼ・rbitControls縺ｮ險ｭ螳壹↓蜷医ｏ縺帙ｋ・・
            spherical.phi = Math.max(this.controls.minPolarAngle, Math.min(this.controls.maxPolarAngle, spherical.phi));

            // 繝吶け繝医Ν縺ｫ謌ｻ縺・
            offset.setFromSpherical(spherical);

            // 繧ｫ繝｡繝ｩ菴咲ｽｮ繧呈峩譁ｰ
            this.camera.position.copy(this.controls.target).add(offset);

            // 豕ｨ隕也せ縺ｯ螟画峩縺励↑縺・
            this.camera.lookAt(this.controls.target);
        }
    }

    /**
     * 繧ｫ繝ｼ繧ｽ繝ｫ繧剃ｽ懈・・磯≦蟒ｶ蛻晄悄蛹厄ｼ・
     */
    createCursor() {
        const shape = new THREE.Shape();
        const hw = TILE_SIZE / 2;
        const hh = TILE_SIZE / 4;

        // 闖ｱ蠖｢
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
        // 蟶ｸ縺ｫ譛蜑埼擇縺ｫ陦ｨ遉ｺ縺輔ｌ繧九ｈ縺・↓豺ｱ蠎ｦ繝・せ繝医ｒ繧ｪ繝輔↓縺吶ｋ縺区､懆ｨ弱＠縺溘′縲・
        // 蝨ｰ蠖｢縺ｫ髫繧後ｋ縺ｹ縺肴凾縺ｯ髫繧後◆縺ｻ縺・′閾ｪ辟ｶ縺ｪ縺ｮ縺ｧ繧ｪ繝ｳ縺ｮ縺ｾ縺ｾ縲・
        // 縺溘□縺怜ｰ代＠豬ｮ縺九☆縲・
        this.scene.add(this.cursorMesh);
    }

    /**
     * 繧ｫ繝ｼ繧ｽ繝ｫ菴咲ｽｮ繧呈峩譁ｰ
     * @param {number|null} q 
     * @param {number|null} r 
     * @param {string|null} text - 陦ｨ遉ｺ縺吶ｋ繝・く繧ｹ繝茨ｼ医ち繝ｼ繝ｳ謨ｰ縺ｪ縺ｩ・・
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

        // 繝・く繧ｹ繝郁｡ｨ遉ｺ縺ｮ譖ｴ譁ｰ
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

        // 閭梧勹
        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.beginPath();
        context.roundRect(10, 10, 108, 44, 10);
        context.fill();

        // 繝・く繧ｹ繝・
        context.font = 'bold 24px sans-serif';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 64, 34); // Y縺ｯ蠕ｮ隱ｿ謨ｴ

        texture.needsUpdate = true;
    }

    /**
     * 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繝ｫ繝ｼ繝・
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        // 螟夜Κ縺九ｉ縺ｮ繝ｬ繝ｳ繝繝ｪ繝ｳ繧ｰ荳頑嶌縺搾ｼ医お繝・ぅ繧ｿ繝｢繝ｼ繝臥ｭ会ｼ・
        if (this.renderOverride) {
            this.renderOverride();
            return;
        }

        // 逕ｻ髱｢遶ｯ縺ｧ縺ｮ繧ｫ繝｡繝ｩ蝗櫁ｻ｢蜃ｦ逅・
        this.handleEdgeRotation();

        // 繝ｦ繝九ャ繝域峩譁ｰ
        this.updateUnits();

        // 繧ｨ繝輔ぉ繧ｯ繝域峩譁ｰ
        this.updateEffects();

        // 蜻ｽ莉､繝ｩ繧､繝ｳ謠冗判
        this.drawOrderLines();

        // 謾ｻ謦・Λ繧､繝ｳ謠冗判・域ｵ√ｌ繧句・・・
        this.updateAttackLines();

        // 繧ｳ繝ｳ繝医Ο繝ｼ繝ｫ繧呈峩譁ｰ
        this.controls.update();

        // 繝ｬ繝ｳ繝繝ｪ繝ｳ繧ｰ
        this.renderer.render(this.scene, this.camera);
    }

    /**
    * 繧ｦ繧｣繝ｳ繝峨え繝ｪ繧ｵ繧､繧ｺ蟇ｾ蠢・
    */
    resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const aspect = width / height;

        // OrthographicCamera逕ｨ繝ｪ繧ｵ繧､繧ｺ蜃ｦ逅・
        this.camera.left = this.frustumSize * aspect / -2;
        this.camera.right = this.frustumSize * aspect / 2;
        this.camera.top = this.frustumSize / 2;
        this.camera.bottom = this.frustumSize / -2;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    /**
     * 3D繧ｨ繝輔ぉ繧ｯ繝医ｒ霑ｽ蜉
     * 蠑墓焚縺ｮ蠖｢蠑上ｒ譟碑ｻ溘↓蟇ｾ蠢・
     */
    add3DEffect(type, arg1, arg2, arg3) {
        if (type === 'BEAM') {
            // BEAM縺ｮ蝣ｴ蜷医・type, start, end, color) 縺ｧ蜻ｼ縺ｰ繧後ｋ縺薙→縺悟､壹＞
            // 縺ｾ縺溘・ (type, {start, end, color})
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
            // DUST縺ｮ蝣ｴ蜷医・type, pos, null, null) 縺ｧ蜻ｼ縺ｰ繧後ｋ縺薙→縺後≠繧・
            this.createDust(arg1);
        } else if (type === 'WAVE') {
            // WAVE縺ｮ蝣ｴ蜷医・type, start, end) 縺ｧ蜻ｼ縺ｰ繧後ｋ縺薙→縺後≠繧・
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
            if (p.z !== undefined) return p; // 繝ｯ繝ｼ繝ｫ繝牙ｺｧ讓・
            // 莉･荳九√げ繝ｪ繝・ラ蠎ｧ讓吶°繧峨・螟画鋤
            // x, y繝励Ο繝代ユ繧｣縺後≠繧後・縺昴ｌ繧貞━蜈茨ｼ・quareGrid・・
            if (p.x !== undefined && p.y !== undefined) {
                const pos = this.gridToWorld3D(p.x, p.y);
                const h = this.getGroundHeight(p.x, p.y);
                pos.y = h;
                return pos;
            }
            // q, r縺後≠繧後・・域立莉墓ｧ倅ｺ呈鋤・・
            if (p.q !== undefined) {
                const pos = this.hexToWorld3D(p.q, p.r);
                // hexToWorld3D縺ｯz=0繧定ｿ斐☆縺ｮ縺ｧ鬮倥＆繧定｣懈ｭ｣
                const h = this.getGroundHeight(p.q, p.r);
                pos.y = h;
                return pos;
            }
            return p;
        };

        const startPos = resolvePos(data.start);
        const endPos = resolvePos(data.end);

        // 鬮倥＆繧定ｪｿ謨ｴ・医Θ繝九ャ繝医・閭ｸ蜈・≠縺溘ｊ・・
        if (startPos.y < 1000) startPos.y += 30; // 譌｢縺ｫ蜊∝・鬮倥＞蝣ｴ蜷医・蜉邂励＠縺ｪ縺・
        if (endPos.y < 1000) endPos.y += 30;

        const points = [new THREE.Vector3(startPos.x, startPos.y, startPos.z), new THREE.Vector3(endPos.x, endPos.y, endPos.z)];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: data.color || 0xffaa00,
            linewidth: 3, // WebGL縺ｧ縺ｯ蜉ｹ縺九↑縺・％縺ｨ縺悟､壹＞縺梧欠螳・
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
        let gridX, gridY; // 繧ｰ繝ｪ繝・ラ蠎ｧ讓呻ｼ磯ｫ倥＆蜿門ｾ礼畑・・

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
            return; // 蠎ｧ讓吩ｸ肴・
        }

        // 蝨ｰ蠖｢縺ｮ鬮倥＆繧貞叙蠕励＠縺ｦ繝ｦ繝九ャ繝医・鬆ｭ荳翫↓陦ｨ遉ｺ
        let groundHeight = 0;
        if (gridX !== undefined && gridY !== undefined) {
            groundHeight = this.getGroundHeight(gridX, gridY);
        } else if (pos.y < 10) {
            // 繝ｯ繝ｼ繝ｫ繝牙ｺｧ讓呎欠螳壽凾縺ｧ鬮倥＆縺御ｽ弱＞蝣ｴ蜷医・繝・ヵ繧ｩ繝ｫ繝・
            groundHeight = 0;
        } else {
            groundHeight = pos.y;
        }
        // 繝ｦ繝九ャ繝医・鬆ｭ荳奇ｼ亥慍蠖｢鬮倥＆ + 繝ｦ繝九ャ繝磯ｫ倥＆60 + 繧ｪ繝輔そ繝・ヨ20・・
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
            depthTest: false // 莉悶・繧ｪ繝悶ず繧ｧ繧ｯ繝医↓髫繧後↑縺・ｈ縺・↓
        });
        const sprite = new THREE.Sprite(material);

        sprite.position.set(pos.x, pos.y, pos.z);
        sprite.renderOrder = 1000; // 繝ｦ繝九ャ繝医ｈ繧頑焔蜑阪↓陦ｨ遉ｺ

        // 蝓ｺ譛ｬ繧ｵ繧､繧ｺ繧定ｨｭ螳夲ｼ・ata.size縺後≠繧後・菴ｿ逕ｨ縲√ョ繝輔か繝ｫ繝・0・・
        const baseSize = data.size || 60;
        sprite.scale.set(baseSize, baseSize * 0.25, 1);
        sprite.userData = { baseScale: baseSize };

        this.scene.add(sprite);

        this.effects.push({
            mesh: sprite,
            type: 'FLOAT_TEXT',
            life: 60,
            maxLife: 60,
            velocity: new THREE.Vector3(0, 1.5, 0) // 荳頑・
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
            return; // 蠎ｧ讓吩ｸ肴・
        }

        // 邁｡譏鍋噪縺ｪ轣ｫ闃ｱ・磯ｻ・牡縺・せ・・
        const geometry = new THREE.BufferGeometry();
        const count = 10;
        const positions = new Float32Array(count * 3);
        const velocities = [];

        for (let i = 0; i < count; i++) {
            positions[i * 3] = pos.x;
            positions[i * 3 + 1] = pos.y + 30; // 蝨ｰ髱｢繧医ｊ蟆代＠荳・
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
        // 隱ｿ逡･繧ｨ繝輔ぉ繧ｯ繝茨ｼ壽ｳ｢邏九′蠎・′繧・
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
        pos.y = 180; // 鬆ｭ荳企ｫ倥ａ

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // 蜷ｹ縺榊・縺玲緒逕ｻ
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

        // 繝・く繧ｹ繝・
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
        // 荳ｭ蠢・°繧峨・逶ｸ蟇ｾ蠎ｧ讓吶↓螟画鋤
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
        mesh.position.set(center.x, 2, center.z); // 蝨ｰ髱｢繧医ｊ蟆代＠荳・
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
        // targetId縺九ｉ繝ｦ繝九ャ繝医ｒ謗｢縺呻ｼ・esh縺後∪縺縺ｪ縺・庄閭ｽ諤ｧ繧ゅ≠繧九◆繧“ameState縺九ｉ・・
        const targetUnit = window.gameState.units.find(u => u.id === targetId);

        if (mesh && targetUnit) {
            // 迴ｾ蝨ｨ縺ｮ繝ｦ繝九ャ繝井ｽ咲ｽｮ・・EX荳ｭ蠢・ｼ・
            const unit = window.gameState.units.find(u => u.id === unitId);
            if (!unit) return;

            const startPos = this.hexToWorld3D(unit.x, unit.y);
            const targetPos = this.hexToWorld3D(targetUnit.x, targetUnit.y);

            // 繧ｿ繝ｼ繧ｲ繝・ヨ譁ｹ蜷代∈縺ｮ繝吶け繝医Ν
            const dir = new THREE.Vector3().subVectors(targetPos, startPos);
            // Y謌仙・・磯ｫ倥＆・峨・蟾ｮ縺ｯ辟｡隕悶＠縺ｦ豌ｴ蟷ｳ遘ｻ蜍輔□縺代↓縺吶ｋ
            dir.y = 0;

            const dist = dir.length();
            if (dist > 0) dir.normalize();

            // 霍晞屬縺ｮ蜊雁・縺｡繧・＞謇句燕縺ｾ縺ｧ (縺ゅ∪繧願ｿ代▼縺阪☆縺弱ｋ縺ｨ繧√ｊ霎ｼ繧縺ｮ縺ｧ隱ｿ謨ｴ)
            // HEX_SIZE(40) * 1.5 遞句ｺｦ縺後Θ繝九ャ繝医し繧､繧ｺ縺ｪ縺ｮ縺ｧ縲？EX髢楢ｷ晞屬(邏・0)縺ｮ蜊雁・=35縺上ｉ縺・
            // dist * 0.4 縺上ｉ縺・′驕ｩ蠖薙°
            const moveVec = dir.multiplyScalar(dist * 0.45);

            mesh.userData.attackAnim = {
                active: true,
                progress: 0,
                duration: 40, // 蜈ｨ菴薙ヵ繝ｬ繝ｼ繝謨ｰ・育ｴ・.7遘抵ｼ・
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

                // 霍晞屬縺ｫ蠢懊§縺ｦ繧ｵ繧､繧ｺ繧定ｪｿ謨ｴ・磯□縺上※繧りｦ九ｄ縺吶￥・・
                // 繧ｫ繝｡繝ｩ縺九ｉ縺ｮ霍晞屬繧貞叙蠕・
                const dist = effect.mesh.position.distanceTo(this.camera.position);
                // 蝓ｺ貅冶ｷ晞屬(500)繧医ｊ驕縺・ｴ蜷医・諡｡螟ｧ縺吶ｋ
                const scaleFactor = Math.max(1, dist / 500);
                const base = effect.mesh.userData.baseScale || 60;
                effect.mesh.scale.set(base * scaleFactor, base * 0.25 * scaleFactor, 1);
            } else if (effect.type === 'BUBBLE') {
                effect.mesh.position.add(effect.velocity);
                effect.mesh.material.opacity = Math.min(1, effect.life / 20); // 譛蠕後□縺代ヵ繧ｧ繝ｼ繝峨い繧ｦ繝・
            } else if (effect.type === 'DUST') {
                effect.mesh.scale.multiplyScalar(1.05);
                effect.mesh.material.opacity = effect.life / effect.maxLife;
                effect.mesh.position.y += 0.5;
            } else if (effect.type === 'WAVE') {
                const progress = 1 - (effect.life / effect.maxLife);
                effect.mesh.scale.setScalar(1 + progress * 30);
                effect.mesh.material.opacity = 1 - progress;

                // 逶ｮ讓吶↓蜷代°縺｣縺ｦ遘ｻ蜍・
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
                // 轤ｹ貊・＠縺ｪ縺後ｉ豸医∴繧・
                const progress = effect.life / effect.maxLife;
                const flash = (Math.sin(progress * Math.PI * 4) + 1) / 2; // 2蝗樒せ貊・
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
     * 蜻ｽ莉､繝ｩ繧､繝ｳ・育ｧｻ蜍慕泙蜊ｰ・峨ｒ謠冗判
     * 譛驕ｩ蛹・ 蜻ｽ莉､縺悟､峨ｏ縺｣縺滓凾縺ｮ縺ｿ蜀肴緒逕ｻ
     */
    drawOrderLines() {
        if (!this.orderLineGroup) {
            this.orderLineGroup = new THREE.Group();
            this.scene.add(this.orderLineGroup);
            // 繧ｭ繝｣繝・す繝･逕ｨ繧ｸ繧ｪ繝｡繝医Μ縺ｨ繝槭ユ繝ｪ繧｢繝ｫ
            this._arrowConeGeometry = new THREE.ConeGeometry(8, 20, 8);
            this._orderLineCache = null;
        }

        // ORDER繝輔ぉ繧､繧ｺ莉･螟悶・謠冗判縺励↑縺・
        if (!window.game || !window.gameState || !window.gameState.units || window.game.gameState !== 'ORDER') {
            // 髱朧RDER繝輔ぉ繧､繧ｺ縺ｧ縺ｯ繝ｩ繧､繝ｳ繧帝國縺・
            if (this.orderLineGroup.children.length > 0) {
                this.orderLineGroup.visible = false;
            }
            return;
        }
        this.orderLineGroup.visible = true;

        // 蜻ｽ莉､迥ｶ諷九・繝上ャ繧ｷ繝･繧定ｨ育ｮ励＠縺ｦ螟画峩讀懃衍
        const currentHash = this._computeOrderHash();
        if (this._orderLineCache === currentHash) {
            // 螟画峩縺ｪ縺・- 蜀肴緒逕ｻ荳崎ｦ・
            return;
        }
        this._orderLineCache = currentHash;

        // 螟画峩縺後≠縺｣縺溘・縺ｧ蜀肴緒逕ｻ
        // 蟄占ｦ∫ｴ繧貞・蜑企勁
        while (this.orderLineGroup.children.length > 0) {
            const obj = this.orderLineGroup.children[0];
            this.orderLineGroup.remove(obj);
            if (obj.geometry && obj.geometry !== this._arrowConeGeometry) {
                obj.geometry.dispose();
            }
            if (obj.material) obj.material.dispose();
        }

        // 蜈ｨ繝ｦ繝九ャ繝医・蜻ｽ莉､繝ｩ繧､繝ｳ繧呈緒逕ｻ・磯∈謚樔ｸｭ縺ｯ蠑ｷ隱ｿ縲・撼驕ｸ謚槭・阮・￥・・
        window.gameState.units.forEach(unit => {
            if (unit.dead || !unit.order) return;

            // 繝輔ぅ繝ｫ繧ｿ繝ｼ: 
            // 1. 騾壼ｸｸ遘ｻ蜍・MOVE)縺ｮ蝣ｴ蜷医・譛ｬ髯｣縺ｮ縺ｿ繝ｩ繧､繝ｳ繧定｡ｨ遉ｺ縺吶ｋ・磯・荳九・髯｣蠖｢縺ｧ蜍輔￥縺溘ａ・・
            if (unit.order.type === 'MOVE' && unit.unitType !== 'HEADQUARTERS') {
                return;
            }

            // 2. 謾ｻ謦・ATTACK)繧・ｪｿ逡･(PLOT)縺ｮ蝣ｴ蜷医ｂ縲∵磁謨ｵ縺吶ｋ縺ｾ縺ｧ縺ｯ髯｣蠖｢縺ｧ蜍輔￥縺溘ａ縲・□縺・ｴ蜷医・陦ｨ遉ｺ縺励↑縺・
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

                // 遏｢蜊ｰ縺ｮ霆ｸ
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

                // 遏｢蜊ｰ縺ｮ蜈育ｫｯ・医さ繝ｼ繝ｳ・・ 繧ｸ繧ｪ繝｡繝医Μ縺ｯ繧ｭ繝｣繝・す繝･繧貞・蛻ｩ逕ｨ
                const dir = new THREE.Vector3().subVectors(
                    new THREE.Vector3(endPos.x, endPos.y, endPos.z),
                    new THREE.Vector3(startPos.x, startPos.y, startPos.z)
                ).normalize();

                const arrowHead = new THREE.Mesh(
                    this._arrowConeGeometry, // 繧ｭ繝｣繝・す繝･縺輔ｌ縺溘ず繧ｪ繝｡繝医Μ繧貞・蛻ｩ逕ｨ
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
     * 蜻ｽ莉､迥ｶ諷九・繝上ャ繧ｷ繝･繧定ｨ育ｮ暦ｼ亥､画峩讀懃衍逕ｨ・・
     */
    _computeOrderHash() {
        if (!window.gameState || !window.gameState.units) return '';

        // 驕ｸ謚樒憾諷九ｂ蜷ｫ繧√ｋ・磯∈謚槭↓繧医▲縺ｦ謠冗判縺悟､峨ｏ繧九◆繧・ｼ・
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
     * 謾ｻ謦・Λ繧､繝ｳ・域ｵ√ｌ繧句・・峨・繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ譖ｴ譁ｰ
     * 譛驕ｩ蛹・ 謾ｻ謦・・繧｢縺悟､峨ｏ縺｣縺滓凾縺ｮ縺ｿ蜀肴緒逕ｻ
     */
    updateAttackLines() {
        if (!this.attackLineGroup) {
            this.attackLineGroup = new THREE.Group();
            this.scene.add(this.attackLineGroup);

            // 豬√ｌ繧九ユ繧ｯ繧ｹ繝√Ε縺ｮ菴懈・
            this.flowTexture = this.createFlowTexture();
            this._attackLineCache = null;
        }

        // 繝・け繧ｹ繝√Ε縺ｮ繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ・医が繝輔そ繝・ヨ遘ｻ蜍包ｼ・ 縺薙ｌ縺ｯ豈弱ヵ繝ｬ繝ｼ繝螳溯｡・
        if (this.flowTexture) {
            this.flowTexture.offset.x -= 0.02;
        }

        if (!window.gameState || !window.gameState.units) return;

        // 謾ｻ謦・・繧｢縺ｮ繝上ャ繧ｷ繝･繧定ｨ育ｮ励＠縺ｦ螟画峩讀懃衍
        const currentHash = this._computeAttackLineHash();
        if (this._attackLineCache === currentHash) {
            // 螟画峩縺ｪ縺・- 蜀肴緒逕ｻ荳崎ｦ・
            return;
        }
        this._attackLineCache = currentHash;

        // 譌｢蟄倥・繝ｩ繧､繝ｳ繧貞炎髯､
        while (this.attackLineGroup.children.length > 0) {
            const obj = this.attackLineGroup.children[0];
            this.attackLineGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }

        // 謾ｻ謦・Λ繧､繝ｳ繧呈緒逕ｻ
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

            // 霍晞屬繝√ぉ繝・け
            const dq = unit.q - target.q;
            const dr = unit.r - target.r;
            const ds = -dq - dr;
            const dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));

            // 謗･謨ｵ霍晞屬・育ｴ・HEX・峨ｈ繧企□縺・ｴ蜷医・繝ｩ繧､繝ｳ繧貞・縺輔↑縺・
            if (dist > 3) return;

            // メッシュから正確な位置を取得（アニメーションや高さ補正含む）
            let startPos, endPos;

            const unitMesh = this.unitMeshes.get(unit.id);
            if (unitMesh) {
                startPos = unitMesh.position.clone();
            } else {
                startPos = this.hexToWorld3D(unit.x, unit.y);
                startPos.y = 40; // フォールバック
                console.warn(`[AttackLine] Unit mesh not found for attacker ${unit.id} (${unit.name})`);
            }

            const targetMesh = this.unitMeshes.get(target.id);
            if (targetMesh) {
                endPos = targetMesh.position.clone();
            } else {
                endPos = this.hexToWorld3D(target.x, target.y);
                endPos.y = 40; // フォールバック
                console.warn(`[AttackLine] Target mesh not found for target ${target.id} (${target.name})`);
            }

            // デバッグログ: 座標を確認（攻撃ライン生成時に常に出力）
            console.warn(`[AttackLine] ${unit.name}(${unit.x},${unit.y}) -> ${target.name}(${target.x},${target.y}) | StartY=${startPos.y.toFixed(1)}, EndY=${endPos.y.toFixed(1)}`);

            // ユニットの少し上（胸のあたり）からラインを出す
            startPos.y += 15;
            endPos.y += 15;

            // 高さ修正: 地形の高さを考慮（meshがない場合のため念のため）
            // すでにmesh.positionを使っていれば高さは反映されているはず。

            this.createAttackRibbon(startPos, endPos, isPlot);
        });
    }

    /**
     * 謾ｻ謦・Λ繧､繝ｳ迥ｶ諷九・繝上ャ繧ｷ繝･繧定ｨ育ｮ暦ｼ亥､画峩讀懃衍逕ｨ・・
     */
    _computeAttackLineHash() {
        if (!window.gameState || !window.gameState.units) return '';

        const attackPairs = window.gameState.units
            .filter(u => !u.dead && u.order && (u.order.type === 'ATTACK' || u.order.type === 'PLOT'))
            .map(u => {
                const target = window.gameState.units.find(t => t.id === u.order.targetId);
                if (!target || target.dead) return null;
                // 霍晞屬繝√ぉ繝・け
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
     * 豬√ｌ繧九ユ繧ｯ繧ｹ繝√Ε繧剃ｽ懈・
     */
    createFlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');

        // 繧ｰ繝ｩ繝・・繧ｷ繝ｧ繝ｳ・亥・縺ｮ邊貞ｭ先─・・
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
     * 謾ｻ謦・Μ繝懊Φ繧剃ｽ懈・
     */
    createAttackRibbon(start, end, isPlot) {
        const sub = new THREE.Vector3().subVectors(end, start);
        const length = sub.length();
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

        // 始点から終点へ向ける (Y軸回転とX軸回転=ピッチを計算)
        // デフォルトのPlaneGeometryはXY平面、長さはX軸方向（幅heightはY軸方向）
        // これを寝かせて(XZ平面)、Z軸マイナス方向に向けるなどの調整が必要だが、
        // lookAtを使うとZ軸マイナス方向がターゲットに向く。

        // PlaneGeometry(length, width) -> X軸: -length/2 ~ +length/2
        // これを start -> end の向きに合わせたい。
        // lookAtはZ軸マイナスを向けるので、ジオメトリを回転させておくか、親オブジェクトを使う。

        // シンプルに: 
        // 1. Z軸方向に向かう長さlengthの板を作る (Geometry操作)
        // 2. lookAt(end) する

        // PlaneGeometryは XY平面。
        // X軸プラス方向を向くように回転させる -> rotateY(-Math.PI/2) ? いや、lookAtの仕様上、+Zか-Zを向けるのが定石。

        // Three.jsのlookAtはローカルの+Z軸をターゲットに向けるわけではない（オブジェクトの正面がどこかによる）。
        // Mesh.lookAt(target) は、オブジェクトのローカル+Z軸がターゲットを向くように回転させる。

        // PlaneGeometry(length, width)
        // 初期状態: X軸に平行(-L/2 ~ L/2), Y軸に幅(-W/2 ~ W/2), 法線はZ軸

        // これを、ローカルZ軸方向に長い板にしたい。
        // createAttackRibbonは頻繁に呼ばれる生成関数ではない（エフェクト）ので、Geometry回転OK。
        geometry.rotateY(-Math.PI / 2); // X軸平行 -> Z軸平行
        // これで Z軸: -L/2 ~ L/2 
        // lookAtで中心からendを見ると、+Z軸がendに向く。

        mesh.lookAt(end);

        // 板の面をカメラに向ける（ビルボード）のが理想だが、地面に水平なリボンなら
        // 進行方向に対して垂直な軸（横）で回転させる必要がある。
        // ここでは「高さも追従する平らな帯」にしたい。
        // 上のrotateY(-PI/2)してlookAt(end)すると、板の面は「垂直（壁）」になる（法線が水平）。
        // 地面に投影されているように見せるには、X軸（ローカル横軸）で90度回す？

        mesh.rotateX(Math.PI / 2);

        this.attackLineGroup.add(mesh);
    }

    /**
     * 繧ｹ繧ｯ繝ｪ繝ｼ繝ｳ蠎ｧ讓・x, y)縺九ｉHEX蠎ｧ讓・q, r)繧貞叙蠕・
     * @param {number} x - 繧ｹ繧ｯ繝ｪ繝ｼ繝ｳX蠎ｧ讓・
     * @param {number} y - 繧ｹ繧ｯ繝ｪ繝ｼ繝ｳY蠎ｧ讓・
     * @returns {{q: number, r: number}|null} HEX蠎ｧ讓吶√∪縺溘・null
     */
    getHexFromScreenCoordinates(x, y) {
        if (!this.groundMesh) return null;

        // 繧ｹ繧ｯ繝ｪ繝ｼ繝ｳ蠎ｧ讓吶ｒ豁｣隕丞喧繝・ヰ繧､繧ｹ蠎ｧ讓・-1 to +1)縺ｫ螟画鋤
        const rect = this.canvas.getBoundingClientRect();
        const ndcX = ((x - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((y - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);

        // 1. 繝ｦ繝九ャ繝医→縺ｮ莠､蟾ｮ蛻､螳夲ｼ亥━蜈茨ｼ・
        // unitMeshes縺ｯMap縺ｪ縺ｮ縺ｧArray縺ｫ螟画鋤
        const unitMeshesArray = Array.from(this.unitMeshes.values());
        const unitIntersects = raycaster.intersectObjects(unitMeshesArray, true); // true縺ｧ蜀榊ｸｰ逧・↓蟄占ｦ∫ｴ繧ゅメ繧ｧ繝・け

        if (unitIntersects.length > 0) {
            // 譛繧よ焔蜑阪・繧ｪ繝悶ず繧ｧ繧ｯ繝医ｒ蜿門ｾ・
            // 隕ｪ繧定ｾｿ縺｣縺ｦ繝｡繧､繝ｳ縺ｮMesh繧呈爾縺呻ｼ・serData.unitId繧呈戟縺｣縺ｦ縺・ｋ縺ｯ縺夲ｼ・
            let target = unitIntersects[0].object;
            while (target) {
                if (target.userData && target.userData.unitId !== undefined) {
                    // 繝ｦ繝九ャ繝・D縺九ｉ繝ｦ繝九ャ繝域ュ蝣ｱ繧貞叙蠕励＠縺ｦ蠎ｧ讓吶ｒ霑斐☆
                    const unit = window.gameState.units.find(u => u.id === target.userData.unitId);
                    if (unit) {
                        return { q: unit.x, r: unit.y }; // x,y 繧定ｿ斐☆
                    }
                }
                // hitBox縺ｪ縺ｩ蟄占ｦ∫ｴ縺ｮ蝣ｴ蜷医∬ｦｪ繧定ｾｿ繧・
                target = target.parent;
                // Scene縺ｾ縺ｧ蛻ｰ驕斐＠縺溘ｉ邨ゆｺ・
                if (target && target.type === 'Scene') break;
            }
        }

        // 1.5. 建物との交差判定（優先度高：地形より前）
        if (this.buildingSystem && this.buildingSystem.buildingGroup) {
            const buildingIntersects = raycaster.intersectObjects(this.buildingSystem.buildingGroup.children, true);
            if (buildingIntersects.length > 0) {
                const hit = buildingIntersects[0];
                return this.world3DToHex(hit.point.x, hit.point.z);
            }
        }

        // 2. 地形との交差判定（タイルグループに対して実行）
        // これにより高さのある地形でも正確に判定可能
        const tileIntersects = raycaster.intersectObjects(this.tileGroup.children);

        if (tileIntersects.length > 0) {
            // 最も手前のタイル
            const target = tileIntersects[0].object;
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
     * 繝ｦ繝九ャ繝医・繧ｹ繧ｯ繝ｪ繝ｼ繝ｳ蠎ｧ讓吶ｒ蜿門ｾ暦ｼ医・繝・け繧ｹ驕ｸ謚樒畑・・
     * @param {Object} unit - 繝ｦ繝九ャ繝医が繝悶ず繧ｧ繧ｯ繝・q, r繧呈戟縺､)
     * @returns {{x: number, y: number}|null} 繧ｹ繧ｯ繝ｪ繝ｼ繝ｳ蠎ｧ讓吶√∪縺溘・逕ｻ髱｢螟・險育ｮ嶺ｸ崎・縺ｪ繧穎ull
     */
    getUnitScreenPosition(unit) {
        if (unit.x === undefined || unit.y === undefined) return null;

        // 3D菴咲ｽｮ繧貞叙蠕・
        const pos = this.hexToWorld3D(unit.x, unit.y);

        // 繝ｦ繝九ャ繝医・鬮倥＆・域ｦらｮ暦ｼ・
        // 繝ｦ繝九ャ繝医・雜ｳ蜈・0)縲應ｸｭ蠢・30)縺ゅ◆繧翫ｒ蝓ｺ貅悶↓縺吶ｋ
        const y = 30;

        // 繝吶け繝医Ν繧剃ｽ懈・
        const vector = new THREE.Vector3(pos.x, y, pos.z);

        // 繧ｫ繝｡繝ｩ遨ｺ髢薙↓謚募ｽｱ
        vector.project(this.camera);

        // 豁｣隕丞喧繝・ヰ繧､繧ｹ蠎ｧ讓吶°繧峨せ繧ｯ繝ｪ繝ｼ繝ｳ蠎ｧ讓吶↓螟画鋤
        // canvas.width/height縺ｯ繝舌ャ繝輔ぃ繧ｵ繧､繧ｺ・・etina遲峨〒螟ｧ縺阪￥縺ｪ繧具ｼ峨↑縺ｮ縺ｧ
        // clientWidth/clientHeight・・SS繧ｵ繧､繧ｺ・峨ｒ菴ｿ逕ｨ縺吶ｋ
        const widthHalf = this.canvas.clientWidth / 2;
        const heightHalf = this.canvas.clientHeight / 2;

        const x = (vector.x * widthHalf) + widthHalf;
        const yScreen = -(vector.y * heightHalf) + heightHalf;

        // 繧ｫ繝｡繝ｩ縺ｮ蜑阪↓縺ゅｋ縺九メ繧ｧ繝・け (z < 1)
        if (vector.z > 1) return null; // 繧ｫ繝｡繝ｩ縺ｮ蠕後ｍ

        return { x, y: yScreen };
    }

    /**
     * 3D繝ｯ繝ｼ繝ｫ繝牙ｺｧ讓・x, z)繧偵げ繝ｪ繝・ラ蠎ｧ讓・x, y)縺ｫ螟画鋤・医け繧ｩ繝ｼ繧ｿ繝ｼ繝薙Η繝ｼ・・
     */
    world3DToGrid(worldX, worldZ) {
        // 繧｢繧､繧ｽ繝｡繝医Μ繝・け騾・､画鋤
        const gx = (worldX / (TILE_SIZE / 2) + worldZ / (TILE_SIZE / 4)) / 2;
        const gy = (worldZ / (TILE_SIZE / 4) - worldX / (TILE_SIZE / 2)) / 2;
        return { x: Math.round(gx), y: Math.round(gy) };
    }

    /**
     * 譌ｧAPI莠呈鋤・・D繝ｯ繝ｼ繝ｫ繝牙ｺｧ讓・x, z)繧辿EX蠎ｧ讓・q, r)縺ｫ螟画鋤
     * @deprecated world3DToGrid繧剃ｽｿ逕ｨ縺励※縺上□縺輔＞
     */
    world3DToHex(x, z) {
        const result = this.world3DToGrid(x, z);
        return { q: result.x, r: result.y };
    }

    /**
     * 譌ｧAPI莠呈鋤・域悴菴ｿ逕ｨ縺縺悟ｿｵ縺ｮ縺溘ａ谿九☆・・
     * @deprecated
     */
    axialRound(q, r) {
        return { q: Math.round(q), r: Math.round(r) };
    }

    /**
     * 繝・ヰ繝・げ逕ｨ繧ｫ繝｡繝ｩ諠・ｱ繧ｪ繝ｼ繝舌・繝ｬ繧､繧剃ｽ懈・
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
        div.style.pointerEvents = 'none'; // 繧ｯ繝ｪ繝・け騾城℃
        div.style.zIndex = '9999';
        div.style.display = 'none'; // 繝・ヵ繧ｩ繝ｫ繝磯撼陦ｨ遉ｺ
        document.body.appendChild(div);
    }

    /**
     * 繝・ヰ繝・げ陦ｨ遉ｺ蛻・ｊ譖ｿ縺・
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
     * 繧ｫ繝｡繝ｩ諠・ｱ繧呈峩譁ｰ
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
     * 繧ｹ繧ｯ繝ｪ繝ｼ繝ｳ蠎ｧ讓吶°繧牙慍髱｢縺ｸ縺ｮ繝ｬ繧､繧ｭ繝｣繧ｹ繝・
     */
    raycastToGround(screenX, screenY) {
        if (!this.raycaster) this.raycaster = new THREE.Raycaster();

        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((screenX - rect.left) / rect.width) * 2 - 1;
        const y = -((screenY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera({ x, y }, this.camera);

        // 1. 蝨ｰ蠖｢繧ｿ繧､繝ｫ縺ｨ縺ｮ莠､蟾ｮ
        if (this.tileGroup && this.tileGroup.children.length > 0) {
            const intersects = this.raycaster.intersectObjects(this.tileGroup.children);
            if (intersects.length > 0) {
                return intersects[0];
            }
        }

        // 2. 蟷ｳ髱｢縺ｨ縺ｮ莠､蟾ｮ・医ヵ繧ｩ繝ｼ繝ｫ繝舌ャ繧ｯ・・
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(plane, target)) {
            return { point: target };
        }

        return null;
    }

    // =====================================
    // 蠑鍋泙繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ (Arrow Animation)
    // =====================================

    /**
     * 遏｢縺ｮ繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧堤函謌舌・蜀咲函
     * @param {Object} fromUnit - 逋ｺ蟆・・繝ｦ繝九ャ繝・
     * @param {Object} toUnit - 蟇ｾ雎｡繝ｦ繝九ャ繝・
     * @param {{blocked: boolean, blockPos: {x,y,z}|null}} blockInfo - 驕ｮ阡ｽ諠・ｱ
     * @returns {Promise} 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ螳御ｺ・凾縺ｫresolve
     */
    spawnArrowAnimation(fromUnit, toUnit, blockInfo) {
        return new Promise((resolve) => {
            try {
            // 3D繧ｸ繧ｪ繝｡繝医Μ縺ｧ遏｢繧剃ｽ懈・
            // 遏｢縺ｯ繝ｭ繝ｼ繧ｫ繝ｫ縺ｧ+X譁ｹ蜷代ｒ縲悟燕縲阪→縺励※讒狗ｯ会ｼ・HREE.js縺ｮlookAt縺ｨ逶ｸ諤ｧ縺瑚憶縺・ｼ・
            const arrowGroup = new THREE.Group();

            // 遏｢縺ｮ霆ｸ・医す繝ｪ繝ｳ繝繝ｼ・・ 2蛟阪し繧､繧ｺ縲々霆ｸ譁ｹ蜷代↓讓ｪ縺溘ｏ繧・
            const shaftGeometry = new THREE.CylinderGeometry(2, 2, 48, 8);
            const shaftMaterial = new THREE.MeshBasicMaterial({ color: 0xFF4444 }); // 譏弱ｋ縺・幻濶ｲ
            const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
            shaft.rotation.z = Math.PI / 2; // X霆ｸ譁ｹ蜷代↓讓ｪ縺溘ｏ繧・
            arrowGroup.add(shaft);

            // 遏｢蟆ｻ・医さ繝ｼ繝ｳ・・ 2蛟阪し繧､繧ｺ
            const headGeometry = new THREE.ConeGeometry(5, 14, 8);
            const headMaterial = new THREE.MeshBasicMaterial({ color: 0xCCCCCC }); // 繧ｷ繝ｫ繝舌・
            const head = new THREE.Mesh(headGeometry, headMaterial);
            head.rotation.z = -Math.PI / 2; // 蜈育ｫｯ縺・X譁ｹ蜷代ｒ蜷代￥
            head.position.x = 30; // 蜈育ｫｯ縺ｫ驟咲ｽｮ
            arrowGroup.add(head);

            // 鄒ｽ譬ｹ・亥ｰ上＆繧√∫區/轣ｰ濶ｲ・・
            const fletchGeometry = new THREE.ConeGeometry(3, 8, 4);
            const fletchMaterial = new THREE.MeshBasicMaterial({ color: 0xEEEEEE }); // 逋ｽ縺｣縺ｽ縺・・濶ｲ
            const fletch = new THREE.Mesh(fletchGeometry, fletchMaterial);
            fletch.rotation.z = Math.PI / 2;
            fletch.position.x = -24;
            arrowGroup.add(fletch);


            // 髢句ｧ九・邨ゆｺ・ｽ咲ｽｮ繧定ｨ育ｮ・
            const fromPos = this.gridToWorld3D(fromUnit.x, fromUnit.y);
            const toPos = this.gridToWorld3D(toUnit.x, toUnit.y);

            // 鬮倥＆諠・ｱ繧定ｨ育ｮ・（mapSystem縺九ｉ縺ッ繧ｭ繝｣繝・繝帙→繝ｼ縺ｾ縺ｾ縺ｨ繝ｻ繝ϯ繝・）
            let fromTileHeight = 0;
            let toTileHeight = 0;
            if (this.hexHeights && this.hexHeights[fromUnit.y]) {
                fromTileHeight = this.hexHeights[fromUnit.y][fromUnit.x] || 0;
            }
            if (this.hexHeights && this.hexHeights[toUnit.y]) {
                toTileHeight = this.hexHeights[toUnit.y][toUnit.x] || 0;
            }

            // mapSystem縺吾ゥｭ莠∫髯ｷ蜀・蝣ｴ蜷茨ｼ育匱阪↓・（迺ｾ蜿ｷ縺上・縲∝邨､蜍慕峥縺ｫ豌ｴ鬮・莉･縺・）
            let fromBuildingHeight = 0;
            let toBuildingHeight = 0;
            if (this.externalHeightProvider) {
                const cacheKey1 = `${fromUnit.x},${fromUnit.y}`;
                const cacheKey2 = `${toUnit.x},${toUnit.y}`;
                if (!this.buildingHeightCache) this.buildingHeightCache = new Map();
                if (!this.buildingHeightCache.has(cacheKey1)) {
                    this.buildingHeightCache.set(cacheKey1, this.externalHeightProvider(fromUnit.x, fromUnit.y));
                }
                if (!this.buildingHeightCache.has(cacheKey2)) {
                    this.buildingHeightCache.set(cacheKey2, this.externalHeightProvider(toUnit.x, toUnit.y));
                }
                fromBuildingHeight = this.buildingHeightCache.get(cacheKey1) || 0;
                toBuildingHeight = this.buildingHeightCache.get(cacheKey2) || 0;
            }

            // 鬮倥↓荳也AE蜷・ｼ∝ｻｰ繝ｼ繧ｸ縺ｧ髢｢遐捐縺ｾ縺ｨ縺セ縺阪↓・ (TILE_HEIGHT = 16)
            // 鬮倥↓荳也AE蜷・ｼ∝ｻｰ繝ｼ繧ｸ繧定ｨ育ｮ・
            //逶ｷ蜉・九′繧√∵逶ｷ繝ｳ繝医″蝣ｴ蜷・医⊥縺セ繺阪↓・
            const fromZ = fromBuildingHeight > 0 ? fromBuildingHeight : fromTileHeight * TILE_HEIGHT;
            const toZ = toBuildingHeight > 0 ? toBuildingHeight : toTileHeight * TILE_HEIGHT;

            // Height limit check (backup in case combat.js is cached)
            const TILE_HEIGHT_CHECK = 16;
            const MAX_HEIGHT_GRIDS = 3;
            const MAX_HEIGHT_DIFF_CHECK = MAX_HEIGHT_GRIDS * TILE_HEIGHT_CHECK; // 48
            const heightDiffCheck = toZ - fromZ;
            if (heightDiffCheck > MAX_HEIGHT_DIFF_CHECK) {
                resolve();
                return;
            }

            // 驕ｮ阡ｽ譎ゅ・驕ｮ阡ｽ繝昴う繝ｳ繝医〒豁｢縺ｾ繧・
            let endPos = { x: toPos.x, y: toZ + 32, z: toPos.z };
            if (blockInfo && blockInfo.blocked && blockInfo.blockPos) {
                const blockWorldPos = this.gridToWorld3D(blockInfo.blockPos.x, blockInfo.blockPos.y);
                // blockPos.zはworld unitsで返ってくるので、そのまま+32でターゲット位置に合わせる
                endPos = { x: blockWorldPos.x, y: blockInfo.blockPos.z + 32, z: blockWorldPos.z };
            }

            // 霍晞屬縺ｫ蝓ｺ縺･縺上い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ譎る俣・亥ｼｧ繧呈緒縺上・縺ｧ髟ｷ繧√↓・・
            const dx = endPos.x - fromPos.x;
            const dz = endPos.z - fromPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            // 騾溷ｺｦ蛟咲紫繧帝←逕ｨ (window.game.actionSpeed繧貞盾辣ｧ)
            const speedMultiplier = (window.game && window.game.actionSpeed) ? window.game.actionSpeed : 1.0;
            const duration = Math.max(1200, Math.min(2500, distance * 15)) / speedMultiplier;

            // 謾ｾ迚ｩ邱壹・鬮倥＆・磯ｫ倥￥蠑ｧ繧呈緒縺・※關ｽ荳九☆繧九ｈ縺・↓・・
            // タクティクスオウガ風の軌道計算
            // 近距離ほど高い弧を描く（障害物をクリア）、遠距離ほど低い弧（障害物に阻まれやすい）
            let arcHeight;
            if (blockInfo && blockInfo.arcHeight !== undefined) {
                // combat.js側で計算された弧の高さを使用
                arcHeight = blockInfo.arcHeight;
            } else {
                // フォールバック: 同じ計算式を適用（グリッド距離を推定）
                const gridDist = distance / 32; // おおよそのグリッド距離
                const maxRange = 12;
                const minArcHeight = 20;
                const maxArcHeight = 80;
                const distFactor = 1 - Math.min(gridDist / maxRange, 1);
                arcHeight = minArcHeight + (maxArcHeight - minArcHeight) * distFactor;
            }

            // 蛻晄悄菴咲ｽｮ險ｭ螳・（繝ｦ繝九ャ繝育ｚ縺ｮ髢｢邂ｶ縺ｾ縺ｨ縺セ縺阪↑）
            const startY = fromZ + 48;
            arrowGroup.position.set(fromPos.x, startY, fromPos.z);
            this.scene.add(arrowGroup);

            const startTime = Date.now();


            const animate = () => {
                const elapsed = Date.now() - startTime;
                const linearT = Math.min(1, elapsed / duration);

                // Debug: log first frame
                if (elapsed < 50) {
                }

                const t = linearT;

                // 邱壼ｽ｢陬憺俣縺ｧXZ菴咲ｽｮ繧定ｨ育ｮ・
                const currentX = fromPos.x + (endPos.x - fromPos.x) * t;
                const currentZ = fromPos.z + (endPos.z - fromPos.z) * t;

                // 謾ｾ迚ｩ邱壹〒Y蠎ｧ讓吶ｒ險育ｮ・
                const endY = endPos.y;
                const baseY = startY + (endY - startY) * t;
                const arcY = 4 * arcHeight * t * (1 - t);
                const currentY = baseY + arcY;

                arrowGroup.position.set(currentX, currentY, currentZ);

                // 矢を進行方向に向ける（lookAtをシミュレート）
                const nextT = Math.min(1, t + 0.01);
                const nextX = fromPos.x + (endPos.x - fromPos.x) * nextT;
                const nextZ = fromPos.z + (endPos.z - fromPos.z) * nextT;
                const nextBaseY = startY + (endY - startY) * nextT;
                const nextArcY = 4 * arcHeight * nextT * (1 - nextT);
                const nextY = nextBaseY + nextArcY;

                const dirX = nextX - currentX;
                const dirY = nextY - currentY;
                const dirZ = nextZ - currentZ;

                const targetVec = new THREE.Vector3(dirX, dirY, dirZ);
                if (targetVec.length() > 0.001) {
                    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), targetVec.normalize());
                    arrowGroup.setRotationFromQuaternion(quaternion);
                }

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // アニメーション終了時の処理
                    this.scene.remove(arrowGroup);
                    shaftGeometry.dispose();
                    shaftMaterial.dispose();
                    headGeometry.dispose();
                    headMaterial.dispose();
                    fletchGeometry.dispose();
                    fletchMaterial.dispose();
                    resolve();
                }
            };

            animate();
            } catch (error) {
                console.error('[ARROW ANIM] ERROR:', error);
                console.error('[ARROW ANIM] ERROR stack:', error.stack);
                resolve();
            }
        });
    }

    /**
     * 驟咲ｽｮ蜿ｯ閭ｽ蠎ｧ讓吶ｒ繝上う繝ｩ繧､繝郁｡ｨ遉ｺ
     * @param {Array} zones - [{x, y}, ...]
     */
    setDeploymentHighlight(zones) {
        // 譌｢蟄倥・繝上う繝ｩ繧､繝医ｒ繧ｯ繝ｪ繧｢
        this.clearDeploymentHighlight();

        if (!zones || zones.length === 0) return;

        // 繝上う繝ｩ繧､繝医げ繝ｫ繝ｼ繝励ｒ菴懈・
        this.deploymentHighlights = new THREE.Group();
        this.deploymentHighlights.name = 'deploymentHighlights';

        const highlightGeometry = new THREE.PlaneGeometry(TILE_SIZE * 0.8, TILE_SIZE * 0.8);
        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthTest: false  // 建物の前面に常に表示
        });

        zones.forEach((zone, idx) => {
            const highlight = new THREE.Mesh(highlightGeometry.clone(), highlightMaterial.clone());

            // 3D座標に変換 (アイソメトリック)
            const hw = TILE_SIZE / 2;
            const hh = TILE_SIZE / 4;
            const worldX = (zone.x - zone.y) * hw;
            const worldZ = (zone.x + zone.y) * hh;

            let worldY = 0;
            // 建物がある場合はその上に配置
            if (this.buildingSystem) {
                const buildingHeightInfo = this.buildingSystem.getBuildingHeight(zone.x, zone.y);
                if (buildingHeightInfo && buildingHeightInfo.isBuilding) {
                    worldY = buildingHeightInfo.height;
                } else {
                    worldY = this.hexHeights[zone.y]?.[zone.x] || 0;
                }
            } else {
                worldY = this.hexHeights[zone.y]?.[zone.x] || 0;
            }

            highlight.position.set(worldX, worldY + 1, worldZ);
            highlight.rotation.x = -Math.PI / 2;
            highlight.frustumCulled = false;

            this.deploymentHighlights.add(highlight);
        });

        this.scene.add(this.deploymentHighlights);
        console.log(`[RenderingEngine3D] Deployment highlights added: ${zones.length}`);
    }

    /**
     * 驟咲ｽｮ蠎ｧ讓吶ワ繧､繝ｩ繧､繝医ｒ繧ｯ繝ｪ繧｢
     */
    clearDeploymentHighlight() {
        if (this.deploymentHighlights) {
            this.scene.remove(this.deploymentHighlights);
            this.deploymentHighlights.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.deploymentHighlights = null;
            console.log('[RenderingEngine3D] Deployment highlights cleared');
        }
    }

    /**
     * スクリーン座標からグリッド座標に変換
     * @param {number} screenX - スクリーンX座標
     * @param {number} screenY - スクリーンY座標
     * @param {number} canvasWidth - キャンバス幅
     * @param {number} canvasHeight - キャンバス高さ
     * @returns {{x: number, y: number}|null} グリッド座標、失敗時はnull
     */
    screenToGrid(screenX, screenY, canvasWidth, canvasHeight, canvas) {
        if (!this.camera) return null;

        // Canvasの内部解像度を取得（CSSサイズではなく内部サイズを使用）
        const internalWidth = canvas ? canvas.width : (this.renderer ? this.renderer.domElement.width : canvasWidth);
        const internalHeight = canvas ? canvas.height : (this.renderer ? this.renderer.domElement.height : canvasHeight);

        // スケール係数を計算（CSSサイズと内部サイズの比率）
        const scaleX = internalWidth / canvasWidth;
        const scaleY = internalHeight / canvasHeight;

        // 正規化デバイス座標（NDC）に変換（スケールを考慮）
        const ndcX = (screenX * scaleX / internalWidth) * 2 - 1;
        const ndcY = -(screenY * scaleY / internalHeight) * 2 + 1;

        // レイを作成
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);

        // 地面との交点を計算（y=0平面）
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);

        if (!intersection) return null;

        // 3D座標をグリッド座標に変換（gridToWorld3Dの逆変換）
        // worldX = (x - y) * TILE_SIZE / 2
        // worldZ = (x + y) * TILE_SIZE / 4
        // これを解くと：
        // x = (worldX * 2 / TILE_SIZE + worldZ * 4 / TILE_SIZE) / 2
        // y = (worldZ * 4 / TILE_SIZE - worldX * 2 / TILE_SIZE) / 2

        const worldX = intersection.x;
        const worldZ = intersection.z;

        // 小数点の誤差を考慮してクリッピングしてから丸める
        let gridX = (worldX * 2 / TILE_SIZE + worldZ * 4 / TILE_SIZE) / 2;
        let gridY = (worldZ * 4 / TILE_SIZE - worldX * 2 / TILE_SIZE) / 2;

        // 負の値は0にクリップ、Math.roundで四捨五入
        gridX = Math.max(0, Math.round(gridX));
        gridY = Math.max(0, Math.round(gridY));

        // カスタムマップサイズを取得（gridWorldSizeがあれば使用）
        const mapW = this.customMapWidth || MAP_W;
        const mapH = this.customMapHeight || MAP_H;

        if (gridX >= mapW || gridY >= mapH) {
            return null;
        }

        return { x: gridX, y: gridY };
    }

    /**
     * 配置マーカーを追加
     * @param {number} x - グリッドX座標
     * @param {number} y - グリッドY座標
     */
    addDeploymentMarker(x, y) {
        if (!this.deploymentMarkers) {
            this.deploymentMarkers = new THREE.Group();
            this.deploymentMarkers.name = 'deploymentMarkers';
            this.scene.add(this.deploymentMarkers);
        }

        // マーカーを大きくして目立つように（半径はTILE_SIZEの約70%）
        const markerGeometry = new THREE.CylinderGeometry(TILE_SIZE * 0.7, TILE_SIZE * 0.7, TILE_SIZE * 0.3, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0xff3366,  // ピンク系で目立つ色
            transparent: true,
            opacity: 0.85,
            depthTest: false  // 建物の前面に常に表示
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);

        // グリッド座標を3D座標に変換（gridToWorld3Dを使用）
        const worldPos = this.gridToWorld3D(x, y);
        let markerY = 0.25;

        // 建物がある場合はその上に配置
        if (this.buildingSystem) {
            const buildingHeightInfo = this.buildingSystem.getBuildingHeight(x, y);
            if (buildingHeightInfo && buildingHeightInfo.isBuilding) {
                markerY = buildingHeightInfo.height + 0.5; // 建物の少し上
            } else {
                // 地形の高さを取得
                const groundH = this.getGroundHeight(x, y);
                markerY = groundH + 0.25;
            }
        }

        marker.position.set(worldPos.x, markerY, worldPos.z);

        this.deploymentMarkers.add(marker);
    }

    /**
     * 配置マーカーを全てクリア
     */
    clearDeploymentMarkers() {
        if (this.deploymentMarkers) {
            this.scene.remove(this.deploymentMarkers);
            this.deploymentMarkers.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.deploymentMarkers = null;
        }
    }
}
