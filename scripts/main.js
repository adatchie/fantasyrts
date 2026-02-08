/**
 * SEKIGAHARA RTS - Main Game Loop
 * メインゲームロジックとループ
 */

import { STAGES, gameProgress } from './game-data.js';
import { UNIT_TYPE_HEADQUARTERS, WARLORDS, FORMATION_HOKO, FORMATION_KAKUYOKU, FORMATION_GYORIN, TILE_SIZE, TILE_HEIGHT, MAP_W, MAP_H, UNIT_TYPES } from './constants.js'; // Added TILE_SIZE, TILE_HEIGHT, MAP_W, MAP_H, UNIT_TYPES
import { TUTORIAL_PLAIN_DATA } from './data/maps/tutorial_plain.js';
import * as THREE from 'three';
import { AudioEngine } from './audio.js';
import { MapSystem } from './map.js?v=118';
import { RenderingEngine3D } from './rendering3d.js?v=122';
import { generatePortrait } from './rendering.js?v=118';
import { CombatSystem } from './combat.js?v=119';
import { AISystem } from './ai.js?v=118';
import { UnitManager } from './unit-manager.js?v=118';
import { hexToPixel, pixelToHex, isValidHex, getDistRaw, getReachableTiles, estimateTurns } from './pathfinding.js';
import { FORMATION_INFO, getAvailableFormations } from './formation.js?v=118'; // Removed invalid import
import { BuildingSystem, BUILDING_TEMPLATES } from './building.js?v=118';
import { BuildingEditor } from './editor/building-editor.js';
import { decompressBlocks } from './map-repository.js';
import { StageLoader } from './stage-loader.js';
import { createSceneManager, SCENES } from './scene-manager.js?v=118'; // Added import
import { mapRepository } from './map-repository.js'; // カスタムマップ用

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
            curr: { x: 0, y: 0 }
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
        this.buildingSystem = null;  // 建物システム
        this.stageLoader = null;     // ステージローダー

        // Action Speed Control (1.0, 1.5, 2.0)
        this.actionSpeed = 1.0;

        // Placement State
        this.placementData = null;
        this.placementGhost = null;
        this.placementRotation = 0; // 0,1,2,3 (90度刻み)

        // Deployment Mode (for unit placement phase)
        this.isDeploymentMode = false;
    }

    init() {
        this.canvas = document.getElementById('gameCanvas');


        // イベントリスナー登録 (Resize)
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Input Handlers
        window.addEventListener('mousedown', (e) => {
            if (e.target === this.canvas || e.target.id === 'gameCanvas') {
                this.handleMouseDownInternal(e);
            }
        }, true);

        window.addEventListener('mousemove', (e) => {
            if (e.target === this.canvas || e.target.id === 'gameCanvas' || this.input.isLeftDown) {
                this.handleMouseMoveInternal(e);
            }
        }, true);

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.handleMouseUpInternal(e);
            }
        }, true);

        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        window.addEventListener('keydown', (e) => this.handleKeyDownInternal(e));

        // Touch Events
        window.addEventListener('touchstart', (e) => {
            if (e.target === this.canvas || e.target.id === 'gameCanvas') {
                this.onTouchStart(e);
            }
        }, { passive: false, capture: true });
        window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false, capture: true });
        window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false, capture: true });

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

            // Building System - renderingEngineのインスタンスを使用
            this.buildingSystem = this.renderingEngine.buildingSystem;

            // MapSystemに外部高さプロバイダを設定（建物用）
            // ワールド座標ベースで詳細な高さを取得することで、城壁端でも正確な判定が可能
            this.mapSystem.setExternalHeightProvider((x, y) => {
                if (this.buildingSystem && this.renderingEngine) {
                    // グリッド中央のワールド座標を計算
                    const worldPos = this.renderingEngine.gridToWorld3D(x, y);
                    const heightInfo = this.buildingSystem.getBuildingHeightAtWorldPos(worldPos.x, worldPos.z);
                    if (heightInfo && heightInfo.isBuilding) {
                        // ワールド高さをそのまま返す（map.jsのgetHeightと単位を合わせるため）
                        return heightInfo.height;
                    }
                }
                return 0;
            });

            // RenderingEngineにも同じ高さプロバイダを設定（矢の高さ計算用）
            this.renderingEngine.externalHeightProvider = this.mapSystem.externalHeightProvider;

            // Stage Loader
            try {
                this.stageLoader = new StageLoader(this);
            } catch (e) {
                console.error("StageLoader init failed:", e);
            }

            // Building Editor
            this.buildingEditor = new BuildingEditor(this);

            // Selection Box
            this.selectionBox = document.createElement('div');
            this.selectionBox.style.cssText = 'position:absolute; border:1px solid #00FF00; background-color:rgba(0,255,0,0.1); display:none; pointer-events:none; z-index:1000;';
            document.body.appendChild(this.selectionBox);

            // Initial Map Generation for Title Screen Background
            // LocalStorageの最初のマップを使用（なければフォールバックでTUTORIAL_PLAIN_DATA）
            let backgroundMapData = TUTORIAL_PLAIN_DATA; // デフォルト
            try {
                mapRepository.loadFromStorage();
                const storedMaps = mapRepository.list();
                console.log('[Init] Available maps:', storedMaps.map(m => ({ id: m.id, name: m.name })));
                if (storedMaps.length > 0) {
                    // 最初のマップを取得
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

            // HTMLファイルに応じてモードを切り替え
            // sekigahara.htmlではレガシースタート画面、index.htmlではSceneManagerを使用
            const startScreenElement = document.getElementById('start-screen');
            const isLegacyMode = startScreenElement !== null && startScreenElement.style.display !== 'none';
            console.log('[Init] Legacy mode check:', { startScreenElement, isLegacyMode });

            try {
                if (isLegacyMode) {
                    // レガシーモード (sekigahara.html): 旧スタート画面を使用
                    console.log('Legacy Mode: Using traditional start screen');
                    this.sceneManager = null; // SceneManagerを使用しない
                } else {
                    // 新モード (index.html): SceneManagerを使用
                    console.log('New Mode: Using SceneManager');
                    this.sceneManager = createSceneManager(this);
                    console.log('[Init] SceneManager created:', this.sceneManager);

                    if (this.sceneManager && this.sceneManager.uiContainer) {
                        console.log('[Init] uiContainer found:', this.sceneManager.uiContainer);
                        this.sceneManager.transition(SCENES.TITLE);
                        console.log('[Init] Transitioned to TITLE scene');
                    } else {
                        console.error('[Init] SceneManager or uiContainer is null!');
                        // 画面にエラーを表示
                        const errorDiv = document.createElement('div');
                        errorDiv.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:red; color:white; padding:20px; z-index:9999;';
                        errorDiv.textContent = 'Error: SceneManager initialization failed. Check console.';
                        document.body.appendChild(errorDiv);
                    }
                }
            } catch (e) {
                console.error('[Init] SceneManager error:', e);
                // 画面にエラーを表示
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:red; color:white; padding:20px; z-index:9999;';
                errorDiv.textContent = 'Error: ' + e.message;
                document.body.appendChild(errorDiv);
            }

            // Start Loop
            requestAnimationFrame(() => this.loop());
        }).catch(e => {
            console.error('[Init] Rendering engine init failed:', e);
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:red; color:white; padding:20px; z-index:9999;';
            errorDiv.textContent = 'Rendering Error: ' + e.message;
            document.body.appendChild(errorDiv);
        });
    }

    /**
     * 特定のステージをロードして開始
     * @param {Object} stageData - ステージJSON
     * @param {string} playerSide - 'EAST' or 'WEST'
     */
    startStage(stageData, playerSide = 'EAST') {
        this.audioEngine.init();
        this.audioEngine.playBGM();
        this.playerSide = playerSide;
        this.combatSystem.setPlayerSide(playerSide);
        document.getElementById('start-screen').style.display = 'none';

        // ステージローダーで構築
        this.stageLoader.loadStage(stageData);

        // UI更新など初期化処理
        this.updateHUD();
        this.updateSelectionUI([]);

        // 最初のフェーズ開始
        this.gameState = 'ORDER';
        document.getElementById('action-btn').style.display = 'block';
        document.getElementById('phase-text').innerText = "目標設定フェイズ";

        // 3Dユニット描画更新
        if (this.renderingEngine && this.renderingEngine.drawUnits) {
            this.renderingEngine.drawUnits();
        }
    }

    resize() {
        // 3Dレンダラーのリサイズメソッドを呼ぶ
        if (this.renderingEngine) {
            this.renderingEngine.resize();
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
            console.log('Starting Custom Map:', this.customMapData.name);
            if (this.renderingEngine) {
                // 【重要】既存のテレインをクリアしてから新規マップを構築
                this.renderingEngine.clearTerrain();
                this.renderingEngine.buildTerrainFromMapData(this.customMapData);
                this.mapSystem.setMapData(this.customMapData);
                if (this.buildingSystem) {
                    this.buildingSystem.clearBuildings(); // 既存建物もクリア
                    // 建物データがあれば配置
                    if (this.customMapData.buildings && Array.isArray(this.customMapData.buildings)) {
                        this.customMapData.buildings.forEach(b => {
                            let template = b.templateData;

                            // Inject blockSize for direct templateData (editor-placed buildings)
                            // 1ブロック = 1タイルとして配置するため、TILE_SIZEを使用
                            if (template && !template.blockSize) {
                                template.blockSize = TILE_SIZE;
                            }

                            // templateDataがない場合、typeから検索
                            if (!template && b.type) {
                                // 1. カスタム定義から検索
                                if (this.customMapData.customBuildingDefinitions) {
                                    const customDef = this.customMapData.customBuildingDefinitions.find(d => d.id === b.type);
                                    if (customDef) {
                                        template = customDef.data;
                                        // Inject blockSize to match Editor scale for custom buildings
                                        // 1ブロック = 1タイルとして配置するため、TILE_SIZEを使用
                                        if (!template.blockSize) template.blockSize = TILE_SIZE;

                                        if (template.compressedBlocks && !template.blocks) {
                                            template.blocks = decompressBlocks(template.compressedBlocks, template.size);
                                        }
                                        // 名前を上書き
                                        if (customDef.name) template.name = customDef.name;
                                    }
                                }
                                // 2. 標準テンプレートから検索
                                if (!template) {
                                    template = BUILDING_TEMPLATES[b.type];
                                }
                            }

                            if (template) {
                                this.buildingSystem.placeCustomBuildingAtGrid(
                                    template,
                                    b.gridX || b.x, // xの場合もあるかも
                                    b.gridY || b.y, // yの場合もあるかも
                                    b.rotation || 0
                                );
                            }
                        });
                    }
                }
            }

            this.units = [];

            // カスタムマップ敵ユニットを読み込んだかどうかのフラグ
            let customMapEnemiesLoaded = false;

            // 1. カスタムマップの敵ユニット（エディタ配置）を生成
            console.log("[startGame] customMapData check:", {
                hasCustomMapData: !!this.customMapData,
                mapName: this.customMapData?.name,
                hasUnits: !!this.customMapData?.units,
                unitsCount: this.customMapData?.units?.length || 0,
                hasUnitDefinitions: !!this.customMapData?.unitDefinitions,
                unitDefinitionsCount: this.customMapData?.unitDefinitions?.length || 0
            });

            if (this.customMapData.units && this.customMapData.unitDefinitions && this.customMapData.units.length > 0) {
                const enemySide = this.playerSide === 'EAST' ? 'WEST' : 'EAST';
                customMapEnemiesLoaded = true; // カスタムマップ敵を読み込んだフラグをセット

                // raw JSONの確認
                console.log('[CUSTOM MAP] Raw unitDefinitions JSON:', JSON.stringify(this.customMapData.unitDefinitions));
                this.customMapData.unitDefinitions.forEach(u => {
                    console.log('  -', u.id, u.name, 'type=' + u.type);
                });

                this.customMapData.units.forEach((placedUnit, placementIndex) => {
                    const def = this.customMapData.unitDefinitions.find(d => d.id === placedUnit.defId);
                    if (!def) return;

                    // エディタのユニット定義を武将データ形式に変換
                    const warlordData = {
                        name: def.name,
                        side: enemySide,
                        x: placedUnit.x,
                        y: placedUnit.y,
                        soldiers: (def.count || 1) * 1000,  // SOLDIERS_PER_UNIT = 1000
                        atk: def.atk || 50,
                        def: def.def || 50,
                        jin: 50,
                        loyalty: 100,
                        p: 50,
                        kamon: null,
                        bg: null,
                        face: null
                    };

                    // 既存のcreateUnitsFromWarlordを使用して複数ユニットを生成
                    const warlordId = `enemy_${placementIndex}`;
                    const generatedUnits = this.unitManager.createUnitsFromWarlord(
                        warlordData,
                        warlordId,
                        [],  // 重複チェック用の他武将データ（今回は空）
                        this.mapSystem
                    );

                    // 生成されたユニットにカスタム情報を追加
                    generatedUnits.forEach((unit, i) => {
                        unit.type = def.type;
                        unit.level = def.level || 1;
                        console.log('[CUSTOM MAP] Created: ' + unit.name + ' type=' + unit.type + ' def.type=' + def.type);
                        // commander役割の場合、本陣として扱う（既にcreateUnitsFromWarlordでi===0がHEADQUARTERS）
                        if (def.role === 'commander' && i === 0) {
                            unit.unitType = 'HEADQUARTERS';
                        }
                    });

                    this.units.push(...generatedUnits);
                });
            }

            // 2. プレイヤーの配置済みユニットがいれば配置（複数ユニット生成）
            if (this.sceneManager) {
                const placements = this.sceneManager.getGameData('unitPlacements') || [];
                console.log(`[startGame] Found ${placements.length} placements.`);
                
                const deployedUnits = gameProgress.getDeployedUnits();
                console.log(`[startGame] Deployed units count: ${deployedUnits.length}`);

                placements.forEach(([unitId, pos], placementIndex) => {
                    // unitIdの型変換（念のため）
                    const targetId = typeof unitId === 'string' ? parseInt(unitId) : unitId;
                    
                    const unitData = deployedUnits.find(u => u.id === targetId);
                    
                    if (unitData) {
                        console.log(`[startGame] Spawning player unit: ${unitData.name} (ID: ${targetId}) at ${pos.x},${pos.y}`);
                        
                        // 武将データ形式に変換（敵ユニットと同じ処理）
                        // unitCount (編成数) から兵士数を計算
                        const unitCount = unitData.unitCount || 1;
                        const soldiers = unitCount * SOLDIERS_PER_UNIT;

                        const warlordData = {
                            name: unitData.warlordName || unitData.name,
                            side: this.playerSide,
                            x: pos.x,
                            y: pos.y,
                            soldiers: soldiers,
                            atk: unitData.atk || 50,
                            def: unitData.def || 50,
                            jin: unitData.jin || 50,
                            loyalty: unitData.loyalty || 100,
                            p: unitData.p || 50,
                            kamon: unitData.kamon || null,
                            bg: unitData.bg || null,
                            face: unitData.face || null
                        };

                        // 既存のcreateUnitsFromWarlordを使用して複数ユニットを生成
                        const warlordId = unitData.warlordId || `player_${placementIndex}`;
                        const generatedUnits = this.unitManager.createUnitsFromWarlord(
                            warlordData,
                            warlordId,
                            [],
                            this.mapSystem
                        );

                        // 生成されたユニットにカスタム情報を追加
                        generatedUnits.forEach((unit, i) => {
                            unit.type = unitData.type || 'infantry';
                            unit.level = unitData.level || 1;
                        });

                        this.units.push(...generatedUnits);
                    } else {
                        console.warn(`[startGame] Unit data NOT found for ID: ${targetId} (Original: ${unitId})`);
                        // デバッグ用: deployedUnitsのIDリストを出力
                        console.log(`[startGame] Available IDs: ${deployedUnits.map(u => u.id).join(',')}`);
                    }

                });

                // 敵軍（AI）の生成
                // カスタムマップで敵ユニットが既に読み込まれている場合はスキップ
                if (!customMapEnemiesLoaded) {
                    const currentStageId = gameProgress.currentStage;
                    console.log('[DEBUG] currentStageId=' + currentStageId);
                    console.log('[DEBUG] STAGES keys=' + Object.keys(STAGES));
                    // STAGESに定義があればそれを使う、なければカスタムマップデータ（にenemyForcesがあれば）を使う
                    const stageConfig = STAGES[currentStageId] || (this.customMapData && this.customMapData.enemyForces ? this.customMapData : null);

                    // ステージデータに敵軍設定がある場合
                    if (stageConfig && stageConfig.enemyForces) {
                        console.log(`Generating enemies for stage: ${stageConfig.name}`);
                        console.log(`Player side: ${this.playerSide}, Enemy side will be: ${this.playerSide === 'EAST' ? 'WEST' : 'EAST'}`);
                        let enemyUnitIdCounter = 0;

                        // 配置エリア（なければデフォルト）
                        const zone = stageConfig.deploymentZone || { x: 0, y: 20, width: 20, height: 20 };

                        stageConfig.enemyForces.forEach(force => {
                            const typeInfo = Object.values(UNIT_TYPES).find(t => t.name === force.type) || UNIT_TYPES.INFANTRY; // 名前一致またはデフォルト

                            for (let i = 0; i < force.count; i++) {
                                // 配置座標をランダム決定 (簡易)
                                const ex = zone.x + Math.floor(Math.random() * zone.width);
                                const ey = zone.y + Math.floor(Math.random() * zone.height);

                                // ダミー武将データ作成
                                const enemyWarlord = {
                                    name: `敵将${enemyUnitIdCounter}`,
                                    side: this.playerSide === 'EAST' ? 'WEST' : 'EAST', // プレイヤーと反対サイド
                                    x: ex,
                                    y: ey,
                                    soldiers: 3000, // 3000 = 3ユニット分
                                    atk: 50,
                                    def: 50,
                                    jin: 50,
                                    loyalty: 0,
                                    type: force.type, // ユニットタイプを指定
                                    face: null // 顔なし
                                };

                                const warlordId = `enemy_stage_${enemyUnitIdCounter}`;
                                const generatedEnemies = this.unitManager.createUnitsFromWarlord(
                                    enemyWarlord,
                                    warlordId,
                                    [], // allWarlords (重複チェック用だが敵は無視)
                                    this.mapSystem
                                );

                                // タイプ情報を付与
                                generatedEnemies.forEach(u => {
                                    u.unitType = 'NORMAL'; // 本陣ではない
                                    u.type = force.type || 'INFANTRY'; // 兵種を設定（重要！）
                                    console.log('[ENEMY] Created: ' + u.name + ' type=' + u.type + ' force.type=' + force.type);
                                });

                                this.units.push(...generatedEnemies);
                                enemyUnitIdCounter++;
                            }
                        });
                    }
                    // カスタムマップなどで敵設定がない場合、かつ関ヶ原デモの場合のみフォールバック
                    else if (!stageConfig && !this.customMapData) {
                        console.log('[WARNING] Using WARLORDS fallback - units will be INFANTRY only!');
                        // 既存の関ヶ原データ（WARLORDS）を使用
                        Object.values(WARLORDS).forEach((warlord, index) => {
                            if (warlord.side !== this.playerSide) {
                                const warlordId = `enemy_${index}`;
                                const generatedEnemies = this.unitManager.createUnitsFromWarlord(
                                    warlord,
                                    warlordId,
                                    Object.values(WARLORDS),
                                    this.mapSystem
                                );
                                this.units.push(...generatedEnemies);
                            }
                        });
                    }
                } // if (!customMapEnemiesLoaded) の終わり

            }
            console.log(`[startGame] Total Units after all loading: ${this.units.length}`);
            if (this.units.length > 0) {
                console.log(`[startGame] Unit summary:`, {
                    playerUnits: this.units.filter(u => u.side === this.playerSide).length,
                    enemyUnits: this.units.filter(u => u.side !== this.playerSide).length
                });
            }
        } else {
            // シナリオモード（既存ロジック）
            // マップ生成
            const map = this.mapSystem.generateMap();
            // マルチユニット初期化: 各武将から複数ユニットを生成
            Object.values(WARLORDS).forEach((warlord, index) => {
                this.unitManager.createUnitsFromWarlord(warlord, `warlord_${index}`, Object.values(WARLORDS), this.mapSystem);
            });
            this.units = this.unitManager.getAllUnits();
        }

        // 3Dレンダラーのマップ情報を更新（高さキャッシュの再計算）
        // 【重要】カスタムマップの場合は buildTerrainFromMapData で既に構築済みなのでスキップ
        if (this.renderingEngine && !this.customMapData) {
            this.renderingEngine.createIsometricTiles();
        }

        console.log(`Total units created: ${this.units.length}`);

        // gameStateをwindowに公開（3Dレンダリング用）
        window.gameState = { units: this.units };

        // 調略フラグを初期化（武将単位で管理）
        this.warlordPlotUsed = {};

        // CombatSystemにunitManagerを設定
        this.combatSystem.setUnitManager(this.unitManager);

        // カメラ位置
        const center = hexToPixel(30, 30);
        this.camera.x = this.canvas.width / 2 - center.x;
        this.camera.y = this.canvas.height / 2 - center.y;

        this.gameState = 'ORDER';
        this.updateHUD();

        // 3Dユニットを描画
        if (this.renderingEngine && this.renderingEngine.drawUnits) {
            this.renderingEngine.drawUnits();
        }
    }

    async commitTurn() {
        if (this.gameState !== 'ORDER') return;

        // CPU AIの陣形を決定（本陣ユニットのみ）
        const cpuHeadquarters = this.units.filter(u =>
            u.side !== this.playerSide &&
            !u.dead &&
            u.unitType === UNIT_TYPE_HEADQUARTERS
        );

        cpuHeadquarters.forEach(hq => {
            const subordinates = this.unitManager.getUnitsByWarlordId(hq.warlordId)
                .filter(u => !u.dead && u.unitType !== UNIT_TYPE_HEADQUARTERS);

            const formation = this.aiSystem.decideFormation(hq, this.units, subordinates.length);

            // 陣形が変わった場合のみ更新
            if (hq.formation !== formation) {
                hq.formation = formation;
                console.log(`CPU陣形設定: ${hq.name} -> ${formation}`);
            }
        });

        // CPU AIの命令を設定
        this.units.filter(u => u.side !== this.playerSide && !u.dead).forEach(cpu => {
            const order = this.aiSystem.decideAction(cpu, this.units, this.mapSystem);
            if (order) cpu.order = order;
        });

        this.gameState = 'ACTION';
        document.getElementById('action-btn').style.display = 'none';
        document.getElementById('phase-text').innerText = "行動フェイズ";
        this.closeCtx();

        // 速度制御UIを表示
        this.showSpeedControl(true);

        await this.resolveTurn();
    }

    async resolveTurn() {
        try {
            // 調略フラグをリセット（新しいターン開始）
            this.warlordPlotUsed = {};

            // 全ユニットの行動済みフラグをリセット（未行動状態に戻す）
            this.units.forEach(u => u.hasActed = false);

            // 武将ごとにグループ化して、陣形に応じてID順序を制御（渋滞防止）
            // 1. 武将IDでグループ化
            const warlordGroups = new Map();
            for (const u of this.units) {
                if (!warlordGroups.has(u.warlordId)) {
                    warlordGroups.set(u.warlordId, []);
                }
                warlordGroups.get(u.warlordId).push(u);
            }

            // 2. 各武将グループ内で陣形に応じてソート
            //    - 鋒矢の陣(HOKO): ID昇順（本陣が先頭）
            //    - その他: ID降順（前方ユニットが先に動く）
            for (const [warlordId, units] of warlordGroups) {
                const hq = units.find(u => u.unitType === 'HEADQUARTERS' && !u.dead);
                const formation = hq ? hq.formation : null;
                const isHoko = (formation === 'HOKO');

                units.sort((a, b) => {
                    if (isHoko) {
                        // 鋒矢の陣: IDが小さい順（本陣から先に動く）
                        return a.id - b.id;
                    } else {
                        // その他の陣形: IDが大きい順（前方ユニットから先に動く）
                        return b.id - a.id;
                    }
                });
            }

            // 3. グループを統合し、兵士数でソート（少ない順）
            const queue = [];
            for (const units of warlordGroups.values()) {
                queue.push(...units);
            }
            queue.sort((a, b) => a.soldiers - b.soldiers);

            for (const u of queue) {
                if (u.dead) continue;

                try {
                    // ユニットの行動を処理
                    await this.combatSystem.processUnit(u, this.units, this.mapSystem.getMap(), this.warlordPlotUsed);
                } catch (err) {
                    console.error(`Error processing unit ${u.name}:`, err);
                    // エラーが出ても続行
                }

                // 各ユニット行動後に本陣の状態をチェック
                // 本陣が全滅していたら、その武将の全ユニットを敗走させる
                const warlordIds = new Set(this.units.map(unit => unit.warlordId));
                warlordIds.forEach(warlordId => {
                    this.unitManager.checkHeadquartersStatus(warlordId);
                });

                // 勝敗判定（陣営ベース：本陣ユニットの生存で判定）
                const playerHQ = this.units.find(x => x.side === this.playerSide && x.unitType === 'HEADQUARTERS' && !x.dead);
                const enemySide = this.playerSide === 'EAST' ? 'WEST' : 'EAST';
                const enemyHQ = this.units.find(x => x.side === enemySide && x.unitType === 'HEADQUARTERS' && !x.dead);

                if (!playerHQ) {
                    // プレイヤー本陣全滅 → 敵勝利
                    this.triggerEndGame(enemySide, 'プレイヤー');
                    return;
                }
                if (!enemyHQ) {
                    // 敵本陣全滅 → プレイヤー勝利
                    this.triggerEndGame(this.playerSide, '敵軍');
                    return;
                }
            }
        } catch (e) {
            console.error('Turn resolution error:', e);
        } finally {
            if (this.gameState !== 'END') {
                this.gameState = 'ORDER';
                document.getElementById('action-btn').style.display = 'block';
                document.getElementById('phase-text').innerText = "目標設定フェイズ";
                this.updateHUD();
                // 速度制御UIを非表示
                this.showSpeedControl(false);
            }
        }
    }

    triggerEndGame(winnerSide, loserName) {
        this.gameState = 'END';
        const isPlayerWin = (winnerSide === this.playerSide);
        this.audioEngine.playFanfare(isPlayerWin);

        let msg = "";
        let winText = "";
        let color = "";

        if (isPlayerWin) {
            // 自軍勝利
            msg = `敵総大将・${loserName}、討ち取ったり！`;
            winText = (winnerSide === 'EAST') ? "東軍 勝利" : "西軍 勝利";
            color = "#ffd700"; // Gold
        } else {
            // 自軍敗北
            msg = `無念…総大将、${loserName}殿、討ち死に…`;
            const loserSideText = (winnerSide === 'EAST') ? "西軍" : "東軍";
            winText = `${loserSideText} 敗北`;
            color = "#aaaaaa"; // Gray
        }

        const vs = document.getElementById('victory-screen');


        vs.style.display = 'flex';
        document.getElementById('vic-msg-1').innerText = msg;
        document.getElementById('vic-msg-2').innerText = winText;
        document.getElementById('vic-msg-2').style.color = color;
    }

    loop() {
        // 3Dレンダラーが自動的にアニメーションループを持っているので
        // ここでは2D UIの更新のみ行う
        // 将来的にはユニットやエフェクトを3Dで描画する

        requestAnimationFrame(() => this.loop());
    }

    // Input handling
    handleMouseDownInternal(e) {
        // handleMouseDownInternal called
        // デプロイメントモード中は処理をスキップ
        if (this.isDeploymentMode) {
            return;
        }
        if (this.buildingEditor && this.buildingEditor.isActive) {
            return;
        }

        // 建物配置モード
        if (this.gameState === 'PLACEMENT') {
            if (e.button === 0) { // Left Click
                this.placeCurrentBuilding();
            } else if (e.button === 2) { // Right Click
                this.cancelPlacementMode();
            }
            return;
        }

        // 右クリックはOrbitControlsが処理するので何もしない
        if (e.button === 0) {
            this.input.isLeftDown = true;
            this.input.start = { x: e.clientX, y: e.clientY };
            this.input.curr = { x: e.clientX, y: e.clientY };
        }
    }

    handleMouseMoveInternal(e) {
        if (this.buildingEditor && this.buildingEditor.isActive) return;

        // 建物配置モード: ゴースト移動
        if (this.gameState === 'PLACEMENT') {
            this.updatePlacementGhost(e.clientX, e.clientY);
            return;
        }

        // 右ドラッグ（カメラ移動）はOrbitControlsが処理する
        if (this.input.isLeftDown) {
            this.input.curr = { x: e.clientX, y: e.clientY };

            // 選択ボックスを描画
            // console.log("Updating Selection Box:", this.input.start, this.input.curr); // DEBUG
            this.updateSelectionBox();
        }

        // 3Dカーソル更新
        if (this.renderingEngine && this.renderingEngine.updateCursorPosition && this.renderingEngine.getHexFromScreenCoordinates) {
            const h = this.renderingEngine.getHexFromScreenCoordinates(e.clientX, e.clientY);

            let cursorText = null;
            // ユニット選択中で、カーソル有効ならターン計算
            // 頻繁なA*計算は重いので、カーソル位置が変わったときだけやるべきだが、
            // ここでは簡易的に毎回計算（最適化の余地あり）
            if (h && this.selectedUnits.length > 0) {
                const leader = this.selectedUnits.find(unit => unit.unitType === UNIT_TYPE_HEADQUARTERS) || this.selectedUnits[0];

                // 自分の位置以外なら計算
                if (leader.x !== h.q || leader.y !== h.r) {
                    // 敵ユニットなどは避ける計算を行う
                    const units = window.gameState ? window.gameState.units : [];
                    // 簡易計算（キャッシュしてないので重くなる可能性あり）
                    const turns = estimateTurns(leader, h.q, h.r, this.mapSystem, units);

                    if (turns !== Infinity) {
                        cursorText = `${turns} Turn${turns > 1 ? 's' : ''}`;
                    } else {
                        cursorText = "X";
                    }
                }
            }

            this.renderingEngine.updateCursorPosition(h ? h.q : null, h ? h.r : null, cursorText);
        }
    }

    handleMouseUpInternal(e) {
        // デプロイメントモード中は処理をスキップ
        if (this.isDeploymentMode) return;
        if (this.buildingEditor && this.buildingEditor.isActive) return;

        if (this.input.isLeftDown && e.button === 0) {

            this.input.isLeftDown = false;

            // 選択ボックスを隠す
            this.selectionBox.style.display = 'none';

            const dist = Math.hypot(e.clientX - this.input.start.x, e.clientY - this.input.start.y);

            if (dist < 15) { // 許容範囲を少し広げる
                this.handleLeftClick(e.clientX, e.clientY);
            } else {
                // ボックス選択実行
                this.handleBoxSelect();
            }
        }
    }

    onWheel(e) {
        // ズームはOrbitControlsが処理する
    }

    // タッチ操作のハンドリング
    onTouchStart(e) {
        if (this.buildingEditor && this.buildingEditor.isActive) return;
        // 1本指の場合のみ、選択操作として処理
        // OrbitControlsの設定でONE: nullにしているので回転とは競合しないはずだが、
        // 念のためcaptureフェーズでイベントを捕捉し、伝播を止める
        if (e.touches.length === 1) {
            e.preventDefault(); // スクロール等のデフォルト動作を防止
            e.stopImmediatePropagation(); // OrbitControlsへの伝播を完全に阻止

            this.input.isLeftDown = true;
            const touch = e.touches[0];
            this.input.start = { x: touch.clientX, y: touch.clientY };
            this.input.curr = { x: touch.clientX, y: touch.clientY };
        } else {
            // 2本指以上になった場合は選択操作をキャンセル（OrbitControlsに任せる）
            if (this.input.isLeftDown) {
                this.input.isLeftDown = false;
                this.selectionBox.style.display = 'none';
            }
        }
    }

    onTouchMove(e) {
        // 1本指ドラッグ中
        if (this.input.isLeftDown && e.touches.length === 1) {
            e.preventDefault(); // スクロール防止

            const touch = e.touches[0];
            this.input.curr = { x: touch.clientX, y: touch.clientY };

            // 選択ボックスを描画 (onMouseMoveのロジックを使用)
            this.updateSelectionBox();
        }
    }

    onTouchEnd(e) {
        // タッチ終了時
        // e.touchesは終了したタッチを含まないが、changedTouchesで取得可能
        // ただし、this.input.isLeftDownがtrueなら、処理を行う
        if (this.input.isLeftDown) {
            // まだ指が残っているかチェック（マルチタッチからの変化など）
            if (e.touches.length > 0) {
                // まだ他の指がある場合は終了しない（かも？）
                // ここではシンプルに、開始した指が離れたと仮定
            }

            this.input.isLeftDown = false;
            this.selectionBox.style.display = 'none';

            // ボックス判定 or クリック判定
            // タッチの場合、指の太さでズレやすいので許容誤差を少し大きめに(10px)
            // タッチ終了時の座標はchangedTouchesにあるが、
            // moveイベントで更新したthis.input.currを使うのが確実

            const dist = Math.hypot(this.input.curr.x - this.input.start.x, this.input.curr.y - this.input.start.y);

            if (dist < 10) {
                // クリック（タップ）とみなす
                this.handleLeftClick(this.input.curr.x, this.input.curr.y);
            } else {
                // ボックス選択
                this.handleBoxSelect();
            }
        }
    }

    // 選択ボックスの描画処理を共通化
    updateSelectionBox() {
        const startX = Math.min(this.input.start.x, this.input.curr.x);
        const startY = Math.min(this.input.start.y, this.input.curr.y);
        const width = Math.abs(this.input.curr.x - this.input.start.x);
        const height = Math.abs(this.input.curr.y - this.input.start.y);

        // 一定以上のドラッグでボックスを表示
        if (width > 5 || height > 5) {
            this.selectionBox.style.left = startX + 'px';
            this.selectionBox.style.top = startY + 'px';
            this.selectionBox.style.width = width + 'px';
            this.selectionBox.style.height = height + 'px';
            this.selectionBox.style.display = 'block';
        } else {
            this.selectionBox.style.display = 'none';
        }
    }

    handleKeyDownInternal(e) {
        // DEBUG: Check what's under the cursor
        if (e.key === 'D' && e.shiftKey) {
            const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
            console.log("Element at center:", el);
            console.log("Active Element:", document.activeElement);
        }

        if (this.gameState === 'PLACEMENT' && e.key === 'Escape') {
            this.cancelPlacementMode();
            return;
        }

        // 配置モード中の回転 (R)
        if (this.gameState === 'PLACEMENT' && (e.key === 'r' || e.key === 'R')) {
            this.placementRotation = (this.placementRotation + 1) % 4;
            if (this.placementGhost) {
                this.placementGhost.rotation.y = -(Math.PI / 2) * this.placementRotation;
            }
            return;
        }

        // マップ保存 (Shift+P)
        if (e.key === 'P' && e.shiftKey) {
            this.exportMapData();
            return;
        }

        // Shift + B でエディタモード切替
        if (e.key === 'B' && e.shiftKey) {
            if (this.buildingEditor) {
                if (this.buildingEditor.isActive) {
                    this.buildingEditor.exit();
                } else {
                    this.buildingEditor.enter();
                }
            }
            return;
        }

        // ESCキーで選択解除とパネルを閉じる
        if (e.key === 'Escape') {
            this.selectedUnits = [];
            this.updateSelectionUI([]);
            if (this.renderingEngine && this.renderingEngine.clearMoveRange) {
                this.renderingEngine.clearMoveRange();
            }
            document.getElementById('context-menu').style.display = 'none';
        }
    }

    handleLeftClick() {
        // 建物配置モード
        if (this.gameState === 'PLACEMENT') {
            this.placeCurrentBuilding();
            return;
        }

        // クリック位置（Canvas内座標）- メニュー表示用
        const rect = this.canvas.getBoundingClientRect();
        const mx = this.input.start.x - rect.left;
        const my = this.input.start.y - rect.top;

        let h;

        // 3Dモード用の判定（Raycaster使用）
        if (this.renderingEngine && this.renderingEngine.getHexFromScreenCoordinates) {
            h = this.renderingEngine.getHexFromScreenCoordinates(this.input.start.x, this.input.start.y);
        } else {
            // フォールバック（2D用）
            h = pixelToHex(mx, my, this.camera);
        }

        if (!h || !isValidHex(h)) {
            return;
        }

        // クリック位置に近いユニットを探す
        const u = this.units.find(x => !x.dead && x.x === h.q && x.y === h.r);

        const menu = document.getElementById('context-menu');
        if (menu) menu.style.display = 'none';

        if (u) {
            // ユニットをクリックした場合
            if (u.side === this.playerSide) {
                // 味方ユニット選択
                const warlordUnits = this.unitManager.getUnitsByWarlordId(u.warlordId);
                this.selectedUnits = warlordUnits.filter(unit => !unit.dead);
                this.updateSelectionUI(this.selectedUnits, null);

                // 移動範囲表示
                const leader = this.selectedUnits.find(unit => unit.unitType === UNIT_TYPE_HEADQUARTERS) || this.selectedUnits[0];
                if (leader && this.renderingEngine && this.renderingEngine.showMoveRange) {
                    this.renderingEngine.clearMoveRange();
                    const range = leader.move || 6;
                    const tiles = getReachableTiles(leader.x, leader.y, range, this.mapSystem);
                    this.renderingEngine.showMoveRange(tiles, 0x4466ff);
                }
            } else {
                // 敵ユニットをクリックした場合
                if (this.selectedUnits.length > 0 && this.selectedUnits[0].side === this.playerSide) {
                    // ターゲット指定（攻撃・調略）
                    this.targetContextUnit = u;
                    menu.style.display = 'flex';
                    menu.style.left = mx + 'px';
                    menu.style.top = my + 'px';

                    this.updateSelectionUI(this.selectedUnits, u);
                } else {
                    // 敵情報の表示のみ
                    const warlordUnits = this.unitManager.getUnitsByWarlordId(u.warlordId);
                    this.updateSelectionUI(warlordUnits.filter(unit => !unit.dead));
                    this.selectedUnits = [];
                }
            }
        } else {
            // 地面をクリックした場合
            if (this.selectedUnits.length > 0 && this.selectedUnits[0].side === this.playerSide) {
                // 地面クリック時は即座に移動命令を発行（RTSの標準挙動）
                this.targetContextUnit = null;
                this.input.targetHex = h;

                // 全選択ユニットに移動命令を発行
                this.selectedUnits.forEach(u => {
                    u.order = { type: 'MOVE', targetHex: { x: h.q, y: h.r } };
                    // Move order issued
                });

                // メニューは表示しない（即座に命令発行）
                menu.style.display = 'none';
            } else {
                // 選択解除
                this.selectedUnits = [];
                this.updateSelectionUI([], null);
                if (this.renderingEngine && this.renderingEngine.clearMoveRange) {
                    this.renderingEngine.clearMoveRange();
                }
            }
        }
    }

    handleBoxSelect() {
        if (!this.renderingEngine || !this.renderingEngine.getUnitScreenPosition) return;

        const startX = Math.min(this.input.start.x, this.input.curr.x);
        const endX = Math.max(this.input.start.x, this.input.curr.x);
        const startY = Math.min(this.input.start.y, this.input.curr.y);
        const endY = Math.max(this.input.start.y, this.input.curr.y);

        const selected = [];

        // 全ユニットのスクリーン座標をチェック
        this.units.forEach(u => {
            if (u.dead || u.side !== this.playerSide) return; // 味方のみ選択可能

            const screenPos = this.renderingEngine.getUnitScreenPosition(u);
            if (screenPos) {
                if (screenPos.x >= startX && screenPos.x <= endX &&
                    screenPos.y >= startY && screenPos.y <= endY) {
                    selected.push(u);
                }
            }
        });

        if (selected.length > 0) {
            this.selectedUnits = selected;
            this.updateSelectionUI(this.selectedUnits, null); // ターゲット情報はクリア

            // 移動範囲表示（先頭ユニット基準）
            if (this.selectedUnits.length > 0 && this.renderingEngine && this.renderingEngine.showMoveRange) {
                this.renderingEngine.clearMoveRange();
                const leader = this.selectedUnits.find(unit => unit.unitType === UNIT_TYPE_HEADQUARTERS) || this.selectedUnits[0];
                const range = leader.move || 6;
                const tiles = getReachableTiles(leader.x, leader.y, range, this.mapSystem);
                this.renderingEngine.showMoveRange(tiles, 0x4466ff);
            }

            // コンテキストメニューは閉じる
            this.closeCtx();
        } else {
            // 何も囲まなかった場合は選択解除しない（誤操作防止）
            // または選択解除する？ RTSの標準は「何もないところを囲むと選択解除」だが、
            // 3Dだと意図せず空振りすることもあるので、維持の方が親切かも。
            // ここでは「空振りなら選択解除」にする（標準挙動）
            this.selectedUnits = [];
            this.updateSelectionUI([], null); // ターゲット情報はクリア
        }
    }

    issueCommand(type) {
        if (this.targetContextUnit && this.selectedUnits.length > 0) {
            this.selectedUnits.forEach(u => {
                u.order = { type: type, targetId: this.targetContextUnit.id };
            });
            // 攻撃/調略命令を出しても選択は維持
        }
        this.closeCtx();
    }

    closeCtx() {
        document.getElementById('context-menu').style.display = 'none';
        // 陣形パネルは閉じない（選択を維持）
    }

    /**
     * 建物配置モードを開始
     */
    enterBuildingPlacementMode(buildingData) {
        if (this.buildingEditor.isActive) {
            this.buildingEditor.exit();
        }

        console.log("Entering Placement Mode", buildingData);
        this.gameState = 'PLACEMENT';
        this.placementData = buildingData;

        // ゴースト生成
        if (this.placementGhost) {
            this.renderingEngine.scene.remove(this.placementGhost);
        }

        // BuildingSystemを使ってメッシュ生成（仮位置）
        this.placementGhost = this.buildingSystem.createBuildingMesh({ name: "Ghost", ...buildingData }, 0, 0, 0);
        console.log("Ghost created:", this.placementGhost); // DEBUG

        if (this.placementGhost) {
            // 半透明にする
            this.placementGhost.traverse(c => {
                if (c.isMesh) {
                    c.material = c.material.clone();
                    c.material.transparent = true;
                    c.material.opacity = 0.5;
                }
            });
            this.renderingEngine.scene.add(this.placementGhost);
        } else {
            console.error("Failed to create placement ghost!");
        }
    }

    cancelPlacementMode() {
        if (this.gameState !== 'PLACEMENT') return;

        this.gameState = 'PLAY'; // or previous state? Default to PLAY logic
        this.placementData = null;
        if (this.placementGhost) {
            this.renderingEngine.scene.remove(this.placementGhost);
            this.placementGhost = null;
        }
    }

    /**
     * マップデータをエクスポート
     */
    exportMapData() {
        const buildings = this.buildingSystem.getPlacedBuildingsData();
        const data = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            buildings: buildings
        };
        const json = JSON.stringify(data, null, 2);
        console.log("=== EXPORTED MAP DATA ===");
        console.log(json);
        console.log("=========================");
        alert("マップデータをコンソールに出力しました。\\nF12キーを押してコンソールを開き、データをコピーしてください。");
    }

    updatePlacementGhost(screenX, screenY) {
        if (!this.placementGhost || !this.renderingEngine) return;

        const h = this.renderingEngine.getHexFromScreenCoordinates(screenX, screenY);
        // getHexFromScreenCoordinates returns Hex coords (q,r), but we likely want Grid coords for buildings?
        // Building system uses square grid logic inside placeBuildingAtGrid?
        // Wait, renderingEngine has gridToWorld3D(gridX, gridY).
        // Let's assume we map screen to ground plane, then to grid.

        // Raycast to plane
        const intersects = this.renderingEngine.raycastToGround(screenX, screenY);
        if (intersects) {
            const p = intersects.point;
            // Convert to Grid
            // Assuming building blockSize = 8.
            // But we need consistency with `placeCustomBuildingAtGrid`.
            // Let's implement worldToGrid logic here or use renderingEngine helper if exists.

            // For now, map world pos to grid:
            const blockSize = 8.0; // Same as building system
            const bx = Math.round(p.x / (blockSize / 2));
            const bz = Math.round(p.z / (blockSize / 4));
            // This is complex because of shearing.

            // Simpler: Just get the world position and determine grid index.
            // Let's reuse BuildingEditor logic? No, main.js shouldn't depend on Editor inner logic.
            // Let's look at `renderingEngine.getHexFromScreenCoordinates`.

            // Wait, Sekigahara v3 is Hex?
            // "distinct field shape (square grid with height differences instead of hex)" - Request says SQUARE.
            // But main.js variable says `HEX_SIZE`.
            // And `getHexFromScreenCoordinates`.
            // BUT Building uses "sheared geometry".

            // Let's assume we pass approximate grid coordinates to `placeCustomBuildingAtGrid`.
            // Or just place at World Position.
            // `placeCustomBuilding` takes world coords.

            this.placementGhost.position.set(p.x, p.y, p.z);
            this.currentPlacementPos = p;
            this.currentPlacementGrid = h; // グリッド座標を保存
        }
    }

    placeCurrentBuilding() {
        if (!this.placementData || !this.currentPlacementPos) return;

        // Snap logic here if needed.
        // For now, just place at cursor.
        const p = this.currentPlacementPos;

        // mapSystem/RenderEngineのグリッド座標を使用
        const gx = this.currentPlacementGrid ? this.currentPlacementGrid.q : 0;
        const gy = this.currentPlacementGrid ? this.currentPlacementGrid.r : 0;

        // placeCustomBuilding(data, wx, wz, y, gridX, gridY);
        this.buildingSystem.placeCustomBuilding(this.placementData, p.x, p.z, p.y, gx, gy);

        // Sound?
        // this.audioEngine.play('build'); 

        // Keep placement mode active for multiple? Or exit?
        // Exit for now.
        this.cancelPlacementMode();
    }

    /**
     * 陣形選択パネルを表示
     * @param {Object} hqUnit - 本陣ユニット
     * @param {Array} subordinates - 配下ユニット（本陣を除く）
     */
    showFormationPanel(hqUnit, subordinates) {
        const panel = document.getElementById('formation-panel');
        const buttonsContainer = document.getElementById('formation-buttons');
        const tooltip = document.getElementById('formation-tooltip');

        // パネルを表示
        panel.style.display = 'block';

        // ボタンをクリア
        buttonsContainer.innerHTML = '';

        // 選択可能な陣形を取得
        const availableFormations = getAvailableFormations(subordinates.length);
        const allFormations = [FORMATION_HOKO, FORMATION_KAKUYOKU, FORMATION_GYORIN];

        // 各陣形のボタンを生成
        allFormations.forEach(formationType => {
            const info = FORMATION_INFO[formationType];
            const isAvailable = availableFormations.includes(formationType);
            const isActive = hqUnit.formation === formationType;

            const btn = document.createElement('button');
            btn.className = 'formation-btn';
            btn.textContent = info.nameShort;

            if (!isAvailable) {
                btn.classList.add('disabled');
            }
            if (isActive) {
                btn.classList.add('active');
            }

            // マウスオーバーで説明を表示
            btn.onmouseenter = () => {
                tooltip.textContent = info.description;
            };
            btn.onmouseleave = () => {
                tooltip.textContent = '';
            };

            // クリックで陣形を設定
            if (isAvailable) {
                btn.onclick = () => {
                    this.setFormation(hqUnit, formationType);
                };
            }

            buttonsContainer.appendChild(btn);
        });
    }

    /**
     * 陣形選択パネルを非表示
     */
    hideFormationPanel() {
        const panel = document.getElementById('formation-panel');
        panel.style.display = 'none';
    }

    /**
     * 陣形を設定
     * @param {Object} hqUnit - 本陣ユニット
     * @param {string} formation - 陣形タイプ
     */
    setFormation(hqUnit, formation) {
        hqUnit.formation = formation;
        const info = FORMATION_INFO[formation];

        // 陣形名を表示
        this.combatSystem.showFormation(hqUnit, info.nameShort);

        // パネルを更新（activeクラスを適用）
        const warlordUnits = this.unitManager.getUnitsByWarlordId(hqUnit.warlordId);
        const subordinates = warlordUnits.filter(u => !u.dead && u.unitType !== UNIT_TYPE_HEADQUARTERS);
        this.showFormationPanel(hqUnit, subordinates);
    }

    updateHUD() {
        const eS = this.units.filter(u => u.side === 'EAST' && !u.dead)
            .reduce((a, c) => a + c.soldiers, 0);
        const wS = this.units.filter(u => u.side === 'WEST' && !u.dead)
            .reduce((a, c) => a + c.soldiers, 0);
        document.getElementById('status-text').innerText = `東軍: ${eS} / 西軍: ${wS}`;
    }

    updateSelectionUI(list, targetUnit = null) {
        const container = document.getElementById('unit-list');
        container.innerHTML = '';

        // ターゲットユニットがある場合、その情報を最上部に表示
        if (targetUnit) {
            const targetWarlordUnits = this.unitManager.getUnitsByWarlordId(targetUnit.warlordId);
            const targetHeadquarters = targetWarlordUnits.find(u => u.unitType === UNIT_TYPE_HEADQUARTERS) || targetWarlordUnits[0];
            const targetTotalSoldiers = targetWarlordUnits.reduce((sum, u) => sum + (u.dead ? 0 : u.soldiers), 0);
            const targetUnitCount = targetWarlordUnits.filter(u => !u.dead).length;

            const targetDiv = document.createElement('div');
            targetDiv.className = 'unit-card target-card ' + (targetHeadquarters.side === 'EAST' ? 'card-east' : 'card-west');
            targetDiv.style.border = '2px solid #FF0000'; // ターゲット強調
            targetDiv.style.marginBottom = '10px';

            const img = document.createElement('img');
            img.className = 'portrait';
            if (targetHeadquarters.imgCanvas) {
                img.src = targetHeadquarters.imgCanvas.toDataURL();
            }

            // 顔グラフィック（あれば表示）
            if (targetHeadquarters.face) {
                const faceImg = document.createElement('img');
                faceImg.src = `portraits/${targetHeadquarters.face}`;
                faceImg.style.width = '48px';
                faceImg.style.height = '72px';
                faceImg.style.objectFit = 'cover';
                faceImg.style.borderRadius = '4px';
                faceImg.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
                faceImg.style.marginRight = '8px';

                faceImg.onerror = () => {
                    faceImg.style.display = 'none';
                };
                targetDiv.appendChild(faceImg);
            }

            const info = document.createElement('div');
            info.style.flex = '1';
            // 兵種マーカーを取得
            const targetTypeInfo = UNIT_TYPES[targetHeadquarters.type] || UNIT_TYPES.INFANTRY;
            const targetTypeMarker = targetTypeInfo.marker || '⚔️';
            info.innerHTML = `<strong style="color:#FF8888">[目標] ${targetHeadquarters.name} ${targetTypeMarker}</strong><br>兵: ${targetTotalSoldiers} (${targetUnitCount}部隊) <small>(攻${targetHeadquarters.atk}/防${targetHeadquarters.def})</small>`;

            targetDiv.appendChild(img);
            targetDiv.appendChild(info);
            container.appendChild(targetDiv);

            // 区切り線
            const hr = document.createElement('hr');
            hr.style.borderColor = '#444';
            hr.style.margin = '5px 0 15px 0';
            container.appendChild(hr);
        }

        // 選択されているユニットがない場合は、味方全武将を表示
        let displayList = list;
        if (!list || list.length === 0) {
            displayList = this.units.filter(u => u.side === this.playerSide && !u.dead);
        }

        if (!displayList || displayList.length === 0) return;

        // 武将単位でグループ化して表示
        const warlordMap = new Map();
        displayList.forEach(u => {
            if (!warlordMap.has(u.warlordId)) {
                warlordMap.set(u.warlordId, []);
            }
            warlordMap.get(u.warlordId).push(u);
        });

        // 各武将ごとに1つのカードを表示
        warlordMap.forEach((units, warlordId) => {
            // 本陣ユニットを取得（画像表示用）
            const headquarters = units.find(u => u.unitType === UNIT_TYPE_HEADQUARTERS) || units[0];

            // 合計兵力を計算
            const totalSoldiers = units.reduce((sum, u) => sum + u.soldiers, 0);
            const unitCount = units.length;

            const d = document.createElement('div');
            d.className = 'unit-card ' + (headquarters.side === 'EAST' ? 'card-east' : 'card-west');

            // クリックで武将の全ユニットを選択
            d.onclick = () => {
                this.selectedUnits = units.filter(u => !u.dead);
                this.updateSelectionUI(this.selectedUnits);
            };

            let ord = "待機";
            if (headquarters.order) {
                const target = this.units.find(u => u.id === headquarters.order.targetId);
                const targetName = target ? target.name : "地点";
                const typeMap = { 'MOVE': '移動', 'ATTACK': '攻撃', 'PLOT': '調略' };
                ord = `<span style="color:#aaf">${typeMap[headquarters.order.type]}</span> -> ${targetName}`;
            }

            // 顔グラフィック（あれば表示）
            console.log(`[UI] ${headquarters.name} face property:`, headquarters.face);

            if (headquarters.face) {
                const faceImg = document.createElement('img');
                faceImg.src = `portraits/${headquarters.face}`;
                faceImg.style.width = '48px';
                faceImg.style.height = '72px';
                faceImg.style.objectFit = 'cover';
                faceImg.style.borderRadius = '4px';
                faceImg.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
                faceImg.style.marginRight = '8px'; // マージン追加

                faceImg.onerror = () => {
                    console.error(`[UI] Face load failed for ${headquarters.name}: ${faceImg.src}`);
                    faceImg.style.border = '2px solid red';
                    faceImg.style.width = '46px'; // border分調整
                    faceImg.style.height = '70px';
                    faceImg.alt = '404'; // Altテキストで表示
                };

                d.appendChild(faceImg);
            }

            const img = document.createElement('img');
            img.className = 'portrait';
            if (headquarters.imgCanvas) {
                img.src = headquarters.imgCanvas.toDataURL();
            }
            // d.appendChild(img); // Moved below

            const info = document.createElement('div');
            info.style.flex = '1';

            let formationText = "";
            if (headquarters.unitType === UNIT_TYPE_HEADQUARTERS && headquarters.formation) {
                const fInfo = FORMATION_INFO[headquarters.formation];
                if (fInfo) {
                    formationText = `<br>陣形: ${fInfo.nameShort}`;
                }
            }

            // 兵種マーカーを取得
            const unitTypeInfo = UNIT_TYPES[headquarters.type] || UNIT_TYPES.INFANTRY;
            const typeMarker = unitTypeInfo.marker || '⚔️';

            info.innerHTML = `<strong>${headquarters.name} ${typeMarker}</strong><br>兵: ${totalSoldiers} (${unitCount}部隊) <small>(攻${headquarters.atk}/防${headquarters.def})</small>${formationText}<br>指示: ${ord}`;

            d.appendChild(img);
            d.appendChild(info);

            // 本陣の場合、陣形ボタンを追加
            if (headquarters.unitType === UNIT_TYPE_HEADQUARTERS && headquarters.side === this.playerSide) {
                console.log('Creating formation controls for:', headquarters.name, 'Type:', headquarters.unitType, 'Side:', headquarters.side, 'PlayerSide:', this.playerSide);

                const formationContainer = document.createElement('div');
                formationContainer.style.display = 'flex';
                formationContainer.style.flexDirection = 'column';
                formationContainer.style.marginLeft = 'auto';

                // 陣形トグルボタン
                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'formation-toggle';
                const currentFormation = headquarters.formation ? FORMATION_INFO[headquarters.formation].nameShort : '陣形';
                toggleBtn.textContent = currentFormation;
                toggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    const selector = formationContainer.querySelector('.formation-selector');
                    selector.classList.toggle('show');
                };

                // 陣形セレクター
                const selector = document.createElement('div');
                selector.className = 'formation-selector';

                const subordinates = units.filter(u => !u.dead && u.unitType !== UNIT_TYPE_HEADQUARTERS);
                const availableFormations = getAvailableFormations(subordinates.length);
                const allFormations = [FORMATION_HOKO, FORMATION_KAKUYOKU, FORMATION_GYORIN];

                allFormations.forEach(formationType => {
                    const info = FORMATION_INFO[formationType];
                    const isAvailable = availableFormations.includes(formationType);
                    const isActive = headquarters.formation === formationType;

                    const btn = document.createElement('button');
                    btn.className = 'formation-select-btn';
                    btn.textContent = info.nameShort;
                    btn.title = info.description;

                    if (!isAvailable) {
                        btn.classList.add('disabled');
                    }
                    if (isActive) {
                        btn.classList.add('active');
                    }

                    if (isAvailable) {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            headquarters.formation = formationType;
                            this.combatSystem.showFormation(headquarters, info.nameShort);
                            this.updateSelectionUI(this.selectedUnits); // UI更新
                        };
                    }

                    selector.appendChild(btn);
                });

                formationContainer.appendChild(toggleBtn);
                formationContainer.appendChild(selector);
                d.appendChild(formationContainer);

                console.log('Formation controls created successfully');
            } else {
                console.log('Skipping formation controls for:', headquarters.name, 'Type:', headquarters.unitType, 'isHQ:', headquarters.unitType === UNIT_TYPE_HEADQUARTERS, 'isPlayerSide:', headquarters.side === this.playerSide);
            }

            container.appendChild(d);
        });
    }

    /**
     * アクション速度を設定
     * @param {number} speed - 速度倍率 (1.0, 1.5, 2.0)
     */
    setActionSpeed(speed) {
        this.actionSpeed = speed;
        this.updateSpeedControlUI();
        console.log(`Action speed set to ${speed}x`);
    }

    /**
     * 速度制御UIのボタン状態を更新
     */
    updateSpeedControlUI() {
        const buttons = document.querySelectorAll('.speed-btn');
        buttons.forEach(btn => {
            const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
            if (btnSpeed === this.actionSpeed) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * 速度制御UIの表示/非表示を切り替え
     * @param {boolean} show - 表示するかどうか
     */
    showSpeedControl(show) {
        const speedControl = document.getElementById('speed-control');
        if (speedControl) {
            speedControl.style.display = show ? 'flex' : 'none';
        }
    }

    findNonOverlappingPosition(cx, cy, totalUnits, existingUnits) {
        return this.unitManager.findNonOverlappingPosition(cx, cy, totalUnits, existingUnits);
    }
}




