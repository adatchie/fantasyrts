
import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_COLORS } from '../building.js?v=17';

/**
 * 建物エディタ（Architect Mode）
 * ゲーム内で「建物の設計図」を作成するためのツールです。
 * ここで作ったモデルデータを、ゲーム本編で「スタンプ」のように量産配置します。
 */
export class BuildingEditor {
    constructor(game) {
        this.game = game;
        this.isActive = false;

        // シーン設定
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222233);

        // グリッド・可視化
        this.gridGroup = new THREE.Group();
        this.scene.add(this.gridGroup);
        this.previewGroup = new THREE.Group(); // ゴーストブロック
        this.scene.add(this.previewGroup);
        this.blocksGroup = new THREE.Group();  // 配置済みブロック
        this.scene.add(this.blocksGroup);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // データ
        this.canvasSize = { x: 10, y: 10, z: 8 };
        this.blocks = []; // [z][y][x]
        this.resetData();

        // 状態
        this.selectedBlockType = BLOCK_TYPES.STONE_WALL;
        this.currentLayer = 0; // 編集中のZハイト (0-based)
        this.isEraser = false;
        this.ghostBlock = null;

        // UI
        this.uiContainer = null;
        this.styleElement = null;

        // 共有ジオメトリ・マテリアル
        this.geometries = {};
        this.materials = {};
        this.initResources();

        this.initScene();
        this.setupInput();
    }

    resetData() {
        this.blocks = [];
        for (let z = 0; z < this.canvasSize.z; z++) {
            this.blocks[z] = [];
            for (let y = 0; y < this.canvasSize.y; y++) {
                this.blocks[z][y] = new Array(this.canvasSize.x).fill(BLOCK_TYPES.AIR);
            }
        }
    }

    // キャンバスサイズ変更（データ保持）
    resizeCanvas(newX, newY, newZ) {
        const oldBlocks = this.blocks;
        const oldSize = { ...this.canvasSize };

        this.canvasSize = { x: newX, y: newY, z: newZ };
        this.blocks = [];

        for (let z = 0; z < newZ; z++) {
            this.blocks[z] = [];
            for (let y = 0; y < newY; y++) {
                this.blocks[z][y] = new Array(newX).fill(BLOCK_TYPES.AIR);

                // 旧データをコピー
                if (z < oldSize.z && y < oldSize.y) {
                    for (let x = 0; x < newX; x++) {
                        if (x < oldSize.x) {
                            this.blocks[z][y][x] = oldBlocks[z][y][x];
                        }
                    }
                }
            }
        }

        // グリッド再生成
        this.initScene();
        this.updateGridVisuals();
    }

    initResources() {
        // 色マテリアルの作成
        Object.keys(BLOCK_COLORS).forEach(type => {
            this.materials[type] = new THREE.MeshLambertMaterial({
                color: BLOCK_COLORS[type],
                flatShading: true
            });
        });
        // ゴースト用マテリアル
        this.ghostMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            wireframe: true
        });

        // 剪断変形ジオメトリの作成
        const blockSize = 8.0;
        this.blockSize = blockSize;

        const shape = new THREE.Shape();
        const hw = blockSize / 2;
        const hh = blockSize / 4;
        shape.moveTo(0, -hh);
        shape.lineTo(hw, 0);
        shape.lineTo(0, hh);
        shape.lineTo(-hw, 0);
        shape.closePath();

        const extrudeSettings = {
            depth: blockSize,
            bevelEnabled: false
        };
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.translate(0, 0, -blockSize / 2);
        this.geometries['sheared_cube'] = geo;
    }

    initScene() {
        // シーン初期化（リサイズ時にも呼ばれるのでクリアする）
        while (this.gridGroup.children.length > 0) {
            this.gridGroup.remove(this.gridGroup.children[0]);
        }

        // ライト（初回のみ）
        if (this.scene.children.length < 5) {
            const amb = new THREE.AmbientLight(0xffffff, 0.7);
            this.scene.add(amb);
            const dir = new THREE.DirectionalLight(0xffffff, 0.8);
            dir.position.set(20, 40, 20);
            this.scene.add(dir);
        }

        // グリッド線
        const size = this.canvasSize;
        const gridMat = new THREE.LineBasicMaterial({ color: 0x888888, opacity: 0.3, transparent: true });

        for (let x = 0; x <= size.x; x++) {
            const p1 = this.gridToWorld(x, 0, 0);
            const p2 = this.gridToWorld(x, size.y, 0);
            const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p1.x, 0, p1.z), new THREE.Vector3(p2.x, 0, p2.z)]);
            this.gridGroup.add(new THREE.Line(geo, gridMat));
        }
        for (let y = 0; y <= size.y; y++) {
            const p1 = this.gridToWorld(0, y, 0);
            const p2 = this.gridToWorld(size.x, y, 0);
            const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p1.x, 0, p1.z), new THREE.Vector3(p2.x, 0, p2.z)]);
            this.gridGroup.add(new THREE.Line(geo, gridMat));
        }

        // 床面判定用の不可視プレーン
        if (!this.groundPlane) {
            const planeGeo = new THREE.PlaneGeometry(2000, 2000);
            planeGeo.rotateX(-Math.PI / 2);
            this.groundPlane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ visible: false }));
            this.scene.add(this.groundPlane);
        }
    }

    gridToWorld(bx, by, bz) {
        const cx = bx - this.canvasSize.x / 2;
        const cy = by - this.canvasSize.y / 2;
        const wx = (cx - cy) * (this.blockSize / 2);
        const wz = (cx + cy) * (this.blockSize / 4);
        const wy = bz * this.blockSize;
        return { x: wx, y: wy, z: wz };
    }

    worldToGrid(wx, wz) {
        const cx_minus_cy = wx / (this.blockSize / 2);
        const cx_plus_cy = wz / (this.blockSize / 4);
        const cx = (cx_minus_cy + cx_plus_cy) / 2;
        const cy = (cx_plus_cy - cx_minus_cy) / 2;
        const bx = Math.round(cx + this.canvasSize.x / 2);
        const by = Math.round(cy + this.canvasSize.y / 2);
        return { x: bx, y: by };
    }

    setupInput() {
        window.addEventListener('mousedown', (e) => this.onMouseDown(e), true);
        window.addEventListener('mousemove', (e) => this.onMouseMove(e), true);
    }

    createUI() {
        this.uiContainer = document.createElement('div');
        this.uiContainer.id = 'architect-ui';
        this.uiContainer.innerHTML = `
            <div class="panel toolbar">
                <h3>Architect Mode</h3>
                <p class="desc">Build Blueprints for Game</p>
                
                <div class="section">
                    <label>Canvas Size (W x D x H)</label>
                    <div style="display:flex; gap:5px;">
                        <input type="number" id="size-x" value="${this.canvasSize.x}" min="1" max="50" style="width:40px">
                        <input type="number" id="size-y" value="${this.canvasSize.y}" min="1" max="50" style="width:40px">
                        <input type="number" id="size-z" value="${this.canvasSize.z}" min="1" max="20" style="width:40px">
                        <button id="btn-resize" style="width:auto;">Set</button>
                    </div>
                </div>

                <div class="section">
                    <label>Block Type: <span id="current-block-name" style="color:#aaf;">Stone Wall</span></label>
                    <div class="palette" id="block-palette"></div>
                </div>
                
                <div class="section">
                    <label>Tools</label>
                    <button id="tool-brush" class="active">Brush (Place)</button>
                    <button id="tool-eraser">Eraser (Remove)</button>
                    <button id="tool-rotate">Reset Camera</button>
                </div>
                
                <div class="section">
                    <label>Layer (Height): <span id="layer-val">0</span></label>
                    <input type="range" id="layer-slider" min="0" max="${this.canvasSize.z - 1}" value="0">
                    <label style="font-weight:normal; margin-top:5px; font-size:11px;">
                        <input type="checkbox" id="show-all-layers" checked> Show All Layers
                    </label>
                </div>
                
                <div class="section">
                    <button id="btn-export">Export JSON</button>
                    <button id="btn-import">Import JSON</button>
                    <button id="btn-deploy" style="background:#484; border-color:#6a6;">Test Build (Deploy)</button>
                </div>
                
                <div class="section">
                     <button id="btn-exit">Exit (Shift+B)</button>
                </div>
            </div>
            
            <div id="export-modal" class="modal" style="display:none;">
                <div class="modal-content">
                    <h4>Blueprint Data</h4>
                    <p>Copy this JSON to save your building design.</p>
                    <textarea id="json-output" rows="10"></textarea>
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <button id="modal-copy">Copy to Clipboard</button>
                        <button id="modal-close">Close</button>
                    </div>
                </div>
            </div>
            
            <div id="import-modal" class="modal" style="display:none;">
                <div class="modal-content">
                    <h4>Import Blueprint</h4>
                    <p>Paste JSON here.</p>
                    <textarea id="json-input" rows="10"></textarea>
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <button id="modal-load">Load</button>
                        <button id="modal-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.uiContainer);

        // スタイル
        this.styleElement = document.createElement('style');
        this.styleElement.textContent = `
            #architect-ui { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5000; font-family: monospace; }
            #architect-ui .panel { pointer-events: auto; background: rgba(0,0,0,0.85); color: white; padding: 15px; border: 1px solid #444; border-radius: 4px; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
            #architect-ui .toolbar { position: absolute; right: 20px; top: 20px; width: 240px; }
            #architect-ui h3 { margin: 0 0 5px 0; color: #gold; border-bottom: 1px solid #555; padding-bottom:5px; }
            #architect-ui .desc { color: #aaa; font-size: 11px; margin-bottom: 15px; }
            
            .section { margin-bottom: 20px; }
            .section label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 12px; color: #ccc; }
            
            .palette { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; background: #222; padding: 5px; border: 1px solid #444; }
            .p-btn { width: 100%; aspect-ratio: 1; border: 2px solid #555; cursor: pointer; transition: all 0.1s; }
            .p-btn.active { border-color: #fff; box-shadow: 0 0 5px #fff; transform: scale(1.1); z-index: 10; }
            .p-btn:hover { border-color: #aaa; }
            
            button { background: #334; color: white; border: 1px solid #556; padding: 6px; cursor: pointer; width: 100%; margin-bottom: 3px; border-radius: 3px; font-size: 12px; }
            button:hover { background: #445; }
            button:active { background: #556; }
            button.active { background: #468; border-color: #68a; }
            
            input[type="number"] { background: #222; border: 1px solid #444; color: white; padding: 2px; }
            input[type="range"] { width: 100%; }
            
            .modal { position: absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; pointer-events:auto; backdrop-filter: blur(2px); }
            .modal-content { background:#222; padding:20px; width:500px; border:1px solid #666; color:white; border-radius: 5px; box-shadow: 0 0 20px rgba(0,0,0,0.8); }
            textarea { width:100%; background:#111; color:#0f0; border:1px solid #444; font-family:monospace; padding: 5px; }
        `;
        document.head.appendChild(this.styleElement);

        this.bindEvents();
        this.refreshPalette();
    }

    bindEvents() {
        const ui = this.uiContainer;

        // Resize
        ui.querySelector('#btn-resize').onclick = () => {
            const x = parseInt(ui.querySelector('#size-x').value) || 10;
            const y = parseInt(ui.querySelector('#size-y').value) || 10;
            const z = parseInt(ui.querySelector('#size-z').value) || 8;
            this.resizeCanvas(x, y, z);
            // スライダー最大値更新
            ui.querySelector('#layer-slider').max = z - 1;
        };

        // Palette
        const palette = ui.querySelector('#block-palette');
        const blockNameDisplay = ui.querySelector('#current-block-name');

        Object.keys(BLOCK_TYPES).forEach(key => {
            const type = BLOCK_TYPES[key];
            if (type === BLOCK_TYPES.AIR) return;

            const btn = document.createElement('div');
            btn.className = 'p-btn';
            btn.title = key; // Tooltip default
            const color = BLOCK_COLORS[type] || 0xFF00FF;
            btn.style.backgroundColor = '#' + color.toString(16).padStart(6, '0');

            btn.onclick = () => {
                this.selectedBlockType = type;
                this.isEraser = false;
                blockNameDisplay.textContent = key;
                this.updateUIState();
            };

            btn.onmouseenter = () => {
                // ホバー時に名前表示（クリックはしない）
                // blockNameDisplay.textContent = key + " (Preview)";
            };

            btn.dataset.type = type;
            palette.appendChild(btn);
        });

        // Tools
        ui.querySelector('#tool-brush').onclick = () => { this.isEraser = false; this.updateUIState(); };
        ui.querySelector('#tool-eraser').onclick = () => { this.isEraser = true; this.updateUIState(); };
        ui.querySelector('#tool-rotate').onclick = () => { this.game.renderingEngine.controls.reset(); };

        // Layer
        const slider = ui.querySelector('#layer-slider');
        const layerVal = ui.querySelector('#layer-val');
        slider.oninput = (e) => {
            this.currentLayer = parseInt(e.target.value);
            layerVal.textContent = this.currentLayer;
            this.updateGridVisuals();
        };

        ui.querySelector('#show-all-layers').onchange = () => {
            this.updateGridVisuals();
        };

        // Export/Import
        ui.querySelector('#btn-deploy').onclick = () => {
            // データのディープコピーを作成して渡す
            const data = {
                size: { ...this.canvasSize },
                blocks: JSON.parse(JSON.stringify(this.blocks)) // Deep copy
            };
            this.game.enterBuildingPlacementMode(data);
        };

        ui.querySelector('#btn-export').onclick = () => this.exportData();

        ui.querySelector('#modal-copy').onclick = () => {
            const ta = ui.querySelector('#json-output');
            ta.select();
            document.execCommand('copy');
            alert("Copied to clipboard!");
        };
        ui.querySelector('#modal-close').onclick = () => { ui.querySelector('#export-modal').style.display = 'none'; };

        ui.querySelector('#btn-import').onclick = () => {
            ui.querySelector('#import-modal').style.display = 'flex';
        };
        ui.querySelector('#modal-load').onclick = () => {
            const json = ui.querySelector('#json-input').value;
            try {
                this.importData(json);
                ui.querySelector('#import-modal').style.display = 'none';
            } catch (e) {
                alert("Invalid JSON");
            }
        };
        ui.querySelector('#modal-cancel').onclick = () => { ui.querySelector('#import-modal').style.display = 'none'; };

        ui.querySelector('#btn-exit').onclick = () => this.exit();

        this.updateUIState();
    }

    importData(jsonString) {
        const data = JSON.parse(jsonString);
        if (data.size && data.blocks) {
            this.canvasSize = data.size;
            this.blocks = data.blocks;

            // UI更新
            this.uiContainer.querySelector('#size-x').value = this.canvasSize.x;
            this.uiContainer.querySelector('#size-y').value = this.canvasSize.y;
            this.uiContainer.querySelector('#size-z').value = this.canvasSize.z;
            this.uiContainer.querySelector('#layer-slider').max = this.canvasSize.z - 1;

            this.initScene();
            this.updateGridVisuals();
        }
    }

    updateUIState() {
        const ui = this.uiContainer;
        ui.querySelector('#tool-brush').classList.toggle('active', !this.isEraser);
        ui.querySelector('#tool-eraser').classList.toggle('active', this.isEraser);

        ui.querySelectorAll('.p-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.type) === this.selectedBlockType && !this.isEraser);
        });
    }

    refreshPalette() { }

    enter() {
        if (this.isActive) return;
        this.isActive = true;

        if (this.game.renderingEngine) {
            this.game.renderingEngine.controls.enabled = true;
            this.game.renderingEngine.controls.minPolarAngle = 0;
            this.game.renderingEngine.controls.maxPolarAngle = Math.PI;
            this.game.renderingEngine.renderOverride = () => this.render(this.game.renderingEngine.renderer);
        }

        this.createUI();
        this.updateGridVisuals();
    }

    exit() {
        if (!this.isActive) return;
        this.isActive = false;

        if (this.uiContainer) document.body.removeChild(this.uiContainer);
        if (this.styleElement) document.head.removeChild(this.styleElement);
        this.uiContainer = null;
        this.styleElement = null;

        if (this.game.renderingEngine) {
            this.game.renderingEngine.renderOverride = null;
            this.game.renderingEngine.controls.reset();
            this.game.renderingEngine.controls.maxPolarAngle = Math.PI / 2.5;
        }
    }

    update() {
        if (!this.isActive) return;
    }

    render(renderer) {
        if (!this.isActive) return;
        renderer.render(this.scene, this.game.renderingEngine.camera);
    }

    // --- Interaction ---

    onMouseMove(e) {
        if (!this.isActive) return;

        const rect = this.game.renderingEngine.canvas.getBoundingClientRect(); // Corrected
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.updateGhostBlock();
    }

    onMouseDown(e) {
        if (!this.isActive) return;
        if (e.target.closest('#architect-ui')) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        if (e.button === 0) {
            this.placeBlock();
        }
    }

    getIntersect() {
        // ... (Not used directly by placeBlock logic which relies on updateGhostBlock state, keeping for future)
        return null;
    }

    updateGhostBlock() {
        this.previewGroup.clear();
        this.raycaster.setFromCamera(this.mouse, this.game.renderingEngine.camera);

        const planeY = this.currentLayer * this.blockSize;
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
        const target = new THREE.Vector3();

        const hit = this.raycaster.ray.intersectPlane(plane, target);

        if (hit) {
            const grid = this.worldToGrid(target.x, target.z);
            if (grid.x >= 0 && grid.x < this.canvasSize.x && grid.y >= 0 && grid.y < this.canvasSize.y) {
                const pos = this.gridToWorld(grid.x, grid.y, this.currentLayer);

                if (!this.ghostMesh) {
                    const geo = this.geometries['sheared_cube'];
                    this.ghostMesh = new THREE.Mesh(geo, this.ghostMaterial);
                    this.ghostMesh.rotation.x = -Math.PI / 2;
                }

                this.ghostMesh.position.set(pos.x, pos.y + this.blockSize / 2, pos.z);
                this.previewGroup.add(this.ghostMesh);

                this.targetGrid = { x: grid.x, y: grid.y, z: this.currentLayer };
            } else {
                this.targetGrid = null;
            }
        }
    }

    placeBlock() {
        if (!this.targetGrid) return;
        const { x, y, z } = this.targetGrid;

        if (this.isEraser) {
            this.blocks[z][y][x] = BLOCK_TYPES.AIR;
        } else {
            this.blocks[z][y][x] = this.selectedBlockType;
        }

        this.updateGridVisuals();
    }

    updateGridVisuals() {
        this.blocksGroup.clear();

        const showAll = this.uiContainer ? this.uiContainer.querySelector('#show-all-layers').checked : true;

        for (let z = 0; z < this.canvasSize.z; z++) {
            if (!showAll && z > this.currentLayer) continue;

            for (let y = 0; y < this.canvasSize.y; y++) {
                for (let x = 0; x < this.canvasSize.x; x++) {
                    const type = this.blocks[z][y][x];
                    if (type === BLOCK_TYPES.AIR) continue;

                    const mat = this.materials[type];
                    const geo = this.geometries['sheared_cube'];

                    const mesh = new THREE.Mesh(geo, mat);
                    const pos = this.gridToWorld(x, y, z);

                    mesh.position.set(pos.x, pos.y + this.blockSize / 2, pos.z);
                    mesh.rotation.x = -Math.PI / 2;
                    mesh.userData.gridPos = { x, y, z };

                    // Visibility Logic
                    if (z > this.currentLayer) {
                        // Upper layers: Ghost
                        mesh.material = mat.clone();
                        mesh.material.opacity = 0.3;
                        mesh.material.transparent = true;
                        mesh.castShadow = false;
                        mesh.receiveShadow = false;
                    } else if (z < this.currentLayer) {
                        // Lower layers: Slightly darker to distinguish
                        mesh.material = mat.clone();
                        mesh.material.color.multiplyScalar(0.85);
                    }

                    this.blocksGroup.add(mesh);
                }
            }
        }
    }

    exportData() {
        const data = {
            name: "New Building",
            size: this.canvasSize,
            blocks: this.blocks
        };
        const json = JSON.stringify(data, null, 2);

        const ui = this.uiContainer;
        ui.querySelector('#json-output').value = json;
        ui.querySelector('#export-modal').style.display = 'flex';
    }
}
