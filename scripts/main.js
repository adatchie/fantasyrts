/**
 * SEKIGAHARA RTS - Main Game Loop
 * メインゲームロジックとループ
 *
 * リファクタリング: 元の1671行のGod Objectから分割。
 * 各責務は以下のモジュールに委譲:
 *   - game/input-controller.js  : 入力処理（マウス/タッチ/キーボード）
 *   - game/ui-manager.js        : UI管理（HUD/選択UI/陣形パネル/速度制御）
 *   - game/unit-spawner.js      : ユニット生成（カスタムマップ/ステージ/レガシー）
 *   - game/building-placement.js: 建物配置モード
 *   - managers/turn-manager.js  : ターン管理（commitTurn/resolveTurn/triggerEndGame）
 */

import { WARLORDS } from './constants.js';
import { TUTORIAL_PLAIN_DATA } from './data/maps/tutorial_plain.js';
import { AudioEngine } from './audio.js';
import { MapSystem } from './map.js?v=118';
import { RenderingEngine3D } from './rendering3d.js?v=122';
import { CombatSystem } from './combat.js?v=119';
import { AISystem } from './ai.js?v=118';
import { UnitManager } from './unit-manager.js?v=118';
import { hexToPixel } from './pathfinding.js';
import { BuildingEditor } from './editor/building-editor.js';
import { StageLoader } from './stage-loader.js';
import { createSceneManager, SCENES } from './scene-manager.js?v=118';
import { mapRepository } from './map-repository.js';
import { createTurnManager } from './managers/turn-manager.js';

// Sub-modules
import { InputController } from './game/input-controller.js';
import { UIManager } from './game/ui-manager.js';
import { UnitSpawner } from './game/unit-spawner.js';
import { BuildingPlacementController } from './game/building-placement.js';

// Main Game Logic
console.log("%c FIXED VERSION LOADED: v118 Arrow Orientation & Height Provider Fix", "background: #00ff00; color: black; font-size: 16px; font-weight: bold; padding: 4px; border: 2px solid green;");

export class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.camera = { x: 0, y: 0, zoom: 1.0 };
        this.input = {
            isLeftDown: false,
            isRightDown: false,
            start: { x: 0, y: 0 },
            curr: { x: 0, y: 0 },
            targetHex: null
        };

        this.gameState = 'INIT';
        this.playerSide = 'EAST';
        this.units = [];
        this.selectedUnits = [];
        this.targetContextUnit = null;

        this.audioEngine = new AudioEngine();
        this.mapSystem = new MapSystem();
        this.renderingEngine = null;
        this.combatSystem = null;
        this.aiSystem = new AISystem();
        this.unitManager = new UnitManager();
        this.buildingSystem = null;
        this.stageLoader = null;

        // Action Speed Control (1.0, 1.5, 2.0)
        this.actionSpeed = 1.0;

        // Placement State
        this.placementData = null;
        this.placementGhost = null;
        this.placementRotation = 0;
        this.currentPlacementPos = null;
        this.currentPlacementGrid = null;

        // Custom Map Data (set by SceneManager before startGame)
        this.customMapData = null;

        // Deployment Mode (for unit placement phase)
        this.isDeploymentMode = false;

        // Sub-modules (initialized here, they receive `this`)
        this.inputController = new InputController(this);
        this.uiManager = new UIManager(this);
        this.unitSpawner = new UnitSpawner(this);
        this.buildingPlacement = new BuildingPlacementController(this);

        // TurnManager (initialized after combatSystem is ready in init())
        this.turnManager = null;

        // 調略フラグ（武将単位で管理）
        this.warlordPlotUsed = {};
    }

    init() {
        this.canvas = document.getElementById('gameCanvas');

        // Selection Box (イベントリスナーより先に作成 - race condition防止)
        this.selectionBox = document.createElement('div');
        this.selectionBox.style.cssText = 'position:absolute; border:1px solid #00FF00; background-color:rgba(0,255,0,0.1); display:none; pointer-events:none; z-index:1000;';
        document.body.appendChild(this.selectionBox);

        // イベントリスナー登録 (Resize)
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Input Handlers - InputControllerに委譲
        this.inputController.setupEventListeners();

        // 3D Rendering Engine Init
        this.renderingEngine = new RenderingEngine3D(this.canvas);
        this.renderingEngine.setMapSystem(this.mapSystem);

        this.renderingEngine.init().then(() => {
            console.log('Rendering Engine Initialized');

            // Combat System
            this.combatSystem = new CombatSystem(this.audioEngine);
            this.combatSystem.setRenderingEngine(this.renderingEngine);
            this.combatSystem.setMapSystem(this.mapSystem);
            this.combatSystem.setGame(this);
            this.combatSystem.setUnitManager(this.unitManager);

            // Building System
            this.buildingSystem = this.renderingEngine.buildingSystem;

            // MapSystemに外部高さプロバイダを設定（建物用）
            this.mapSystem.setExternalHeightProvider((x, y) => {
                if (this.buildingSystem && this.renderingEngine) {
                    const worldPos = this.renderingEngine.gridToWorld3D(x, y);
                    const heightInfo = this.buildingSystem.getBuildingHeightAtWorldPos(worldPos.x, worldPos.z);
                    if (heightInfo && heightInfo.isBuilding) {
                        return heightInfo.height;
                    }
                }
                return 0;
            });
            this.renderingEngine.externalHeightProvider = this.mapSystem.externalHeightProvider;

            // TurnManager (combatSystem ready)
            this.turnManager = createTurnManager(this);
            // onGameEnd callback for triggerEndGame
            this.turnManager.onGameEnd = (winnerSide, loserName) => {
                this._showEndGameScreen(winnerSide, loserName);
            };

            // Stage Loader
            try {
                this.stageLoader = new StageLoader(this);
            } catch (e) {
                console.error("StageLoader init failed:", e);
            }

            // Building Editor
            this.buildingEditor = new BuildingEditor(this);

            // Initial Map Generation for Title Screen Background
            this._loadBackgroundMap();

            // HTMLファイルに応じてモードを切り替え
            this._initSceneManager();

            // Start Loop
            requestAnimationFrame(() => this.loop());
        }).catch(e => {
            console.error('[Init] Rendering engine init failed:', e);
            this._showError('Rendering Error: ' + e.message);
        });
    }

    // ==================== Game Start ====================

    /**
     * 特定のステージをロードして開始
     */
    startStage(stageData, playerSide = 'EAST') {
        this.audioEngine.init();
        this.audioEngine.playBGM();
        this.playerSide = playerSide;
        this.combatSystem.setPlayerSide(playerSide);
        document.getElementById('start-screen').style.display = 'none';

        this.stageLoader.loadStage(stageData);

        this.uiManager.updateHUD();
        this.uiManager.updateSelectionUI([]);

        this.gameState = 'ORDER';
        document.getElementById('action-btn').style.display = 'block';
        document.getElementById('phase-text').innerText = "目標設定フェイズ";

        if (this.renderingEngine && this.renderingEngine.drawUnits) {
            this.renderingEngine.drawUnits();
        }
    }

    startGame(side) {
        this.audioEngine.init();
        this.audioEngine.playBGM();
        this.playerSide = side;
        this.combatSystem.setPlayerSide(side);

        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'none';

        if (this.customMapData) {
            // カスタムマップモード
            this.unitSpawner.setupCustomMap();

            this.units = [];

            // 1. カスタムマップの敵ユニット
            console.log("[startGame] customMapData check:", {
                hasCustomMapData: !!this.customMapData,
                mapName: this.customMapData?.name,
                hasUnits: !!this.customMapData?.units,
                unitsCount: this.customMapData?.units?.length || 0,
                hasUnitDefinitions: !!this.customMapData?.unitDefinitions,
                unitDefinitionsCount: this.customMapData?.unitDefinitions?.length || 0
            });

            const customEnemies = this.unitSpawner.spawnCustomMapEnemies();
            const customMapEnemiesLoaded = customEnemies.length > 0;
            this.units.push(...customEnemies);

            // 2. プレイヤーユニット + 敵軍（AI）
            if (this.sceneManager) {
                const playerUnits = this.unitSpawner.spawnPlayerUnits();
                this.units.push(...playerUnits);

                const enemyUnits = this.unitSpawner.spawnEnemyUnits(customMapEnemiesLoaded);
                this.units.push(...enemyUnits);
            }

            console.log(`[startGame] Total Units after all loading: ${this.units.length}`);
            if (this.units.length > 0) {
                console.log(`[startGame] Unit summary:`, {
                    playerUnits: this.units.filter(u => u.side === this.playerSide).length,
                    enemyUnits: this.units.filter(u => u.side !== this.playerSide).length
                });
            }
        } else {
            // シナリオモード（レガシー）
            this.units = this.unitSpawner.spawnLegacyUnits();
        }

        // 3Dレンダラーのマップ情報を更新
        if (this.renderingEngine && !this.customMapData) {
            this.renderingEngine.createIsometricTiles();
        }

        console.log(`Total units created: ${this.units.length}`);

        window.gameState = { units: this.units };
        this.warlordPlotUsed = {};
        this.combatSystem.setUnitManager(this.unitManager);

        // カメラ位置
        const center = hexToPixel(30, 30);
        this.camera.x = this.canvas.width / 2 - center.x;
        this.camera.y = this.canvas.height / 2 - center.y;

        this.gameState = 'ORDER';
        this.uiManager.updateHUD();

        if (this.renderingEngine && this.renderingEngine.drawUnits) {
            this.renderingEngine.drawUnits();
        }
    }

    // ==================== Turn Management (delegates to TurnManager) ====================

    async commitTurn() {
        if (this.turnManager) {
            await this.turnManager.commitTurn();
        }
    }

    async resolveTurn() {
        if (this.turnManager) {
            await this.turnManager.resolveTurn();
        }
    }

    triggerEndGame(winnerSide, loserName) {
        if (this.turnManager) {
            this.turnManager.triggerEndGame(winnerSide, loserName);
        }
    }

    // ==================== Game Loop ====================

    loop() {
        requestAnimationFrame(() => this.loop());
    }

    resize() {
        if (this.renderingEngine) {
            this.renderingEngine.resize();
        }
    }

    // ==================== Backward-Compatible Delegates ====================
    // scene-manager.js, index.html, sekigahara.html から呼ばれるメソッド名を維持

    // Input (scene-manager.js が .bind(this.game) で参照)
    handleMouseDownInternal(e) { this.inputController.handleMouseDown(e); }
    handleMouseMoveInternal(e) { this.inputController.handleMouseMove(e); }
    handleMouseUpInternal(e)   { this.inputController.handleMouseUp(e); }
    handleKeyDownInternal(e)   { this.inputController.handleKeyDown(e); }
    onWheel(e)                 { this.inputController.onWheel(e); }
    onTouchStart(e)            { this.inputController.onTouchStart(e); }
    onTouchMove(e)             { this.inputController.onTouchMove(e); }
    onTouchEnd(e)              { this.inputController.onTouchEnd(e); }

    // UI (HTML onclick, scene-manager.js)
    updateHUD()                              { this.uiManager.updateHUD(); }
    updateSelectionUI(list, targetUnit)       { this.uiManager.updateSelectionUI(list, targetUnit); }
    showFormationPanel(hqUnit, subordinates)  { this.uiManager.showFormationPanel(hqUnit, subordinates); }
    hideFormationPanel()                      { this.uiManager.hideFormationPanel(); }
    setFormation(hqUnit, formation)           { this.uiManager.setFormation(hqUnit, formation); }
    setActionSpeed(speed)                     { this.uiManager.setActionSpeed(speed); }
    showSpeedControl(show)                    { this.uiManager.showSpeedControl(show); }

    // Commands (HTML onclick)
    issueCommand(type) { this.inputController.issueCommand(type); }
    closeCtx()         { this.inputController.closeCtx(); }

    // Building Placement (building-editor.js)
    enterBuildingPlacementMode(data) { this.buildingPlacement.enterPlacementMode(data); }
    cancelPlacementMode()            { this.buildingPlacement.cancelPlacementMode(); }
    exportMapData()                  { this.buildingPlacement.exportMapData(); }

    // Utility
    findNonOverlappingPosition(cx, cy, totalUnits, existingUnits) {
        return this.unitManager.findNonOverlappingPosition(cx, cy, totalUnits, existingUnits);
    }

    // ==================== Private Init Helpers ====================

    /**
     * タイトル画面背景マップをロード
     * @private
     */
    _loadBackgroundMap() {
        let backgroundMapData = TUTORIAL_PLAIN_DATA;
        try {
            mapRepository.loadFromStorage();
            const storedMaps = mapRepository.list();
            console.log('[Init] Available maps:', storedMaps.map(m => ({ id: m.id, name: m.name })));
            if (storedMaps.length > 0) {
                const firstMapId = storedMaps[0].id;
                const firstMap = mapRepository.get(firstMapId);
                if (firstMap && firstMap.terrain) {
                    backgroundMapData = firstMap;
                    console.log(`[Init] Using stored map as background: ${firstMap.name}`);
                }
            }
        } catch (e) {
            console.warn('[Init] Failed to load stored maps, using fallback:', e);
        }
        this.mapSystem.setMapData(backgroundMapData);
        this.renderingEngine.buildTerrainFromMapData(backgroundMapData);
        console.log('[Init] Map built successfully');
    }

    /**
     * SceneManagerの初期化
     * @private
     */
    _initSceneManager() {
        const startScreenElement = document.getElementById('start-screen');
        const isLegacyMode = startScreenElement !== null && startScreenElement.style.display !== 'none';
        console.log('[Init] Legacy mode check:', { startScreenElement, isLegacyMode });

        try {
            if (isLegacyMode) {
                console.log('Legacy Mode: Using traditional start screen');
                this.sceneManager = null;
            } else {
                console.log('New Mode: Using SceneManager');
                this.sceneManager = createSceneManager(this);
                console.log('[Init] SceneManager created:', this.sceneManager);

                if (this.sceneManager && this.sceneManager.uiContainer) {
                    console.log('[Init] uiContainer found:', this.sceneManager.uiContainer);
                    this.sceneManager.transition(SCENES.TITLE);
                    console.log('[Init] Transitioned to TITLE scene');
                } else {
                    console.error('[Init] SceneManager or uiContainer is null!');
                    this._showError('Error: SceneManager initialization failed. Check console.');
                }
            }
        } catch (e) {
            console.error('[Init] SceneManager error:', e);
            this._showError('Error: ' + e.message);
        }
    }

    /**
     * ゲーム終了画面を表示
     * @private
     */
    _showEndGameScreen(winnerSide, loserName) {
        const isPlayerWin = (winnerSide === this.playerSide);

        let msg = "";
        let winText = "";
        let color = "";

        if (isPlayerWin) {
            msg = `敵総大将・${loserName}、討ち取ったり！`;
            winText = (winnerSide === 'EAST') ? "東軍 勝利" : "西軍 勝利";
            color = "#ffd700";
        } else {
            msg = `無念…総大将、${loserName}殿、討ち死に…`;
            const loserSideText = (winnerSide === 'EAST') ? "西軍" : "東軍";
            winText = `${loserSideText} 敗北`;
            color = "#aaaaaa";
        }

        const vs = document.getElementById('victory-screen');
        vs.style.display = 'flex';
        document.getElementById('vic-msg-1').innerText = msg;
        document.getElementById('vic-msg-2').innerText = winText;
        document.getElementById('vic-msg-2').style.color = color;
    }

    /**
     * エラーメッセージをDOM上に表示
     * @private
     */
    _showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:red; color:white; padding:20px; z-index:9999;';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
    }
}
