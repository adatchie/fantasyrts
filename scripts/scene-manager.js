
import { STAGES, gameProgress } from './game-data.js';
import { getUnitTypeInfo, UNIT_TYPES } from './constants.js?v=11';
import { SPRITE_PATHS, UNIT_TYPE_TO_SPRITE } from './sprite-config.js'; // スプライト設定読み込み
import { mapRepository } from './map-repository.js?v=2'; // マップリポジトリ読み込み
import { createInputHandler, setupInputListeners } from './managers/input-handler.js';
import { createTurnManager } from './managers/turn-manager.js';
import { validateMapData, validateUnitData, validatePlacements } from './game/validator.js';

export const SCENES = {
    TITLE: 'TITLE',
    MAP_SELECT: 'MAP_SELECT',
    ORGANIZATION: 'ORGANIZATION',
    DEPLOYMENT: 'DEPLOYMENT',
    BATTLE: 'BATTLE',
    RESULT: 'RESULT'
};

export function createSceneManager(gameInstance) {
    return new SceneManager(gameInstance);
}

class SceneManager {
    constructor(game) {
        this.game = game;
        this.uiContainer = document.getElementById('ui-layer');
        this.currentScene = null;
        this.sceneInstance = null;
        this.gameData = {}; // シーン間で共有するデータ

        // Load scene styles dynamically if not present
        if (!document.getElementById('scene-styles')) {
            const link = document.createElement('link');
            link.id = 'scene-styles';
            link.rel = 'stylesheet';
            link.href = 'styles/scene-styles.css';
            document.head.appendChild(link);
        }

        // Initialize managers
        this.inputHandler = null;
        this.turnManager = null;
    }

    /**
     * Initialize game managers (called when transitioning to battle scene)
     */
    initializeManagers() {
        if (!this.inputHandler) {
            this.inputHandler = createInputHandler({
                game: this.game,
                getUnits: () => this.game.units,
                getGameState: () => this.game.gameState,
                getPlayerSide: () => this.game.playerSide,
                getSelectedUnits: () => this.game.selectedUnits,
                setSelectedUnits: (units) => { this.game.selectedUnits = units; },
                getCamera: () => this.game.camera,
                onMouseDown: this.game.handleMouseDownInternal?.bind(this.game),
                onMouseMove: this.game.handleMouseMoveInternal?.bind(this.game),
                onMouseUp: this.game.handleMouseUpInternal?.bind(this.game),
                onKeyDown: this.game.handleKeyDownInternal?.bind(this.game),
                onTouchStart: (e) => this.game.onTouchStart?.(e),
                onTouchMove: (e) => this.game.onTouchMove?.(e),
                onTouchEnd: (e) => this.game.onTouchEnd?.(e)
            });
        }

        if (!this.turnManager) {
            // Create turn manager with custom onGameEnd callback for scene transitions
            const playerSide = this.game.playerSide;

            this.turnManager = createTurnManager(this.game);

            // Override onGameEnd to transition to result scene
            const originalTriggerEndGame = this.turnManager.triggerEndGame.bind(this.turnManager);
            this.turnManager.triggerEndGame = (winnerSide, loserName) => {
                const isPlayerWin = (winnerSide === playerSide);
                const result = isPlayerWin ? 'VICTORY' : 'DEFEAT';

                // Transition to result scene
                this.transition('RESULT', { result });
            };
        }
    }

    /**
     * Setup input listeners for the current canvas
     * @param {HTMLElement} canvas - The game canvas element
     */
    setupInput(canvas) {
        if (this.inputHandler && canvas) {
            setupInputListeners(this.inputHandler, canvas);
        }
    }

    async transition(sceneName, params = {}) {
        try {
            // 前のシーンのクリーンアップ
            if (this.uiContainer) {
                this.uiContainer.innerHTML = '';
            }
            if (this.sceneInstance && this.sceneInstance.cleanup) {
                this.sceneInstance.cleanup();
            }

            this.currentScene = sceneName;

            // 新しいシーンの初期化
            switch (sceneName) {
                case SCENES.TITLE:
                    this.sceneInstance = new TitleScene(this);
                    break;
                case SCENES.MAP_SELECT:
                    this.sceneInstance = new MapSelectScene(this);
                    break;
                case SCENES.ORGANIZATION:
                    this.sceneInstance = new OrganizationScene(this);
                    break;
                case SCENES.DEPLOYMENT:
                    this.sceneInstance = new DeploymentScene(this);
                    break;
                case SCENES.BATTLE:
                    this.sceneInstance = new BattleScene(this);
                    break;
                case SCENES.RESULT:
                    this.sceneInstance = new ResultScene(this, params.result);
                    break;
                default:
                // Unknown scene
            }

            if (this.sceneInstance) {
                // BattleScene.createUI is async (calls game.startGame which is async)
                await this.sceneInstance.createUI();
            }
        } catch (e) {
            // 画面にエラーを表示
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position:fixed; top:10px; left:10px; background:red; color:white; padding:10px; z-index:9999; max-width:80%;';
            errorDiv.textContent = `Scene Error (${sceneName}): ` + e.message;
            document.body.appendChild(errorDiv);
        }
    }

    setGameData(key, value) {
        this.gameData[key] = value;
    }

    getGameData(key) {
        return this.gameData[key];
    }
}

class TitleScene {
    constructor(manager) {
        this.manager = manager;
    }

    createUI() {
        if (!this.manager.uiContainer) {
            return;
        }

        // レガシーなスタート画面を隠す
        const legacyStart = document.getElementById('start-screen');
        if (legacyStart) legacyStart.style.display = 'none';

        const title = document.createElement('div');
        title.className = 'scene-ui title-screen';

        title.innerHTML = `
            <div class="title-bg">
                <h1 class="title-text">Fantasy RTS</h1>
                <div class="title-menu">
                    <button class="title-btn" id="btn-start">新規ゲーム</button>
                    <button class="title-btn" id="btn-load" disabled>ロード (未実装)</button>
                </div>
                <p class="version-text">Fantasy RTS v1.0</p>
            </div>
        `;

        this.manager.uiContainer.appendChild(title);

        document.getElementById('btn-start').addEventListener('click', () => {
            this.manager.transition(SCENES.MAP_SELECT);
        });
    }
}

class MapSelectScene {
    constructor(manager) {
        this.manager = manager;
    }

    createUI() {
        if (!this.manager.uiContainer) return;

        // ゲーム進行状態から利用可能なステージを取得
        const stages = gameProgress.getAvailableStages();

        // カスタムマップリストを確実に最新化
        if (mapRepository) {
            try {
                mapRepository.loadFromStorage();
            } catch (e) {
                console.error('[MapSelectScene] Failed to load maps:', e);
            }
        }
        const customMaps = mapRepository ? mapRepository.list() : [];

        const mapSelect = document.createElement('div');
        mapSelect.className = 'scene-ui map-select-screen';
        // Make outer container transparent to show map
        mapSelect.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';

        // タブ切り替えUI（.panel-bgでラップ）
        mapSelect.innerHTML = `
            <div class="panel-bg">
                <h2>合戦選択</h2>
                <div class="tabs">
                    <button class="tab-btn active" data-tab="story">シナリオ</button>
                    <button class="tab-btn" data-tab="custom">カスタムマップ</button>
                </div>
                <div class="map-list content-active" id="list-story">
                    ${stages.map((s, i) => {
            const mapDiv = document.createElement('div');
            mapDiv.className = 'map-item';
            mapDiv.dataset.id = i;

            const nameHeader = document.createElement('h3');
            nameHeader.textContent = s.name; // Safe: prevents XSS
            mapDiv.appendChild(nameHeader);

            const descPara = document.createElement('p');
            descPara.textContent = s.description; // Safe: prevents XSS
            mapDiv.appendChild(descPara);

            return mapDiv.outerHTML;
        }).join('')}
                </div>
                <div class="map-list" id="list-custom" style="display:none;">
                    ${customMaps.length === 0 ? '<p>作成されたマップがありません</p>' :
                customMaps.map(m => {
                    const mapDiv = document.createElement('div');
                    mapDiv.className = 'map-item custom-map';
                    mapDiv.dataset.id = m.id;

                    const nameHeader = document.createElement('h3');
                    nameHeader.textContent = m.name; // Safe: prevents XSS
                    mapDiv.appendChild(nameHeader);

                    const sizePara = document.createElement('p');
                    sizePara.textContent = `サイズ: ${m.terrain?.width || 30}x${m.terrain?.height || 30}`;
                    mapDiv.appendChild(sizePara);

                    return mapDiv.outerHTML;
                }).join('')}
                </div>
                <div class="button-row">
                    <button class="btn-secondary" id="btn-back-title">戻る</button>
                    <button class="btn-primary" id="btn-to-org" disabled>出陣へ</button>
                </div>
            </div>
        `;

        this.manager.uiContainer.appendChild(mapSelect);

        // タブ制御
        const tabBtns = mapSelect.querySelectorAll('.tab-btn');
        const listStory = document.getElementById('list-story');
        const listCustom = document.getElementById('list-custom');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (btn.dataset.tab === 'story') {
                    listStory.style.display = 'block';
                    listCustom.style.display = 'none';
                    this.selectedType = 'story';
                } else {
                    listStory.style.display = 'none';
                    listCustom.style.display = 'block';
                    this.selectedType = 'custom';
                }
                // 選択リセット
                this.selectedId = null;
                document.getElementById('btn-to-org').disabled = true;
                mapSelect.querySelectorAll('.map-item').forEach(i => i.classList.remove('selected'));
            });
        });

        // マップ選択
        mapSelect.querySelectorAll('.map-item').forEach(item => {
            item.addEventListener('click', () => {
                mapSelect.querySelectorAll('.map-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                this.selectedId = item.dataset.id;
                this.selectedType = item.classList.contains('custom-map') ? 'custom' : 'story';
                document.getElementById('btn-to-org').disabled = false;
            });
        });

        document.getElementById('btn-back-title').addEventListener('click', () => {
            this.manager.transition(SCENES.TITLE);
        });

        document.getElementById('btn-to-org').addEventListener('click', () => {
            if (this.selectedId !== null) {
                if (this.selectedType === 'story') {
                    gameProgress.currentStage = parseInt(this.selectedId);

                    // シナリオに対応するカスタムマップがあれば読み込む
                    const stages = gameProgress.getAvailableStages();
                    const selectedStage = stages[parseInt(this.selectedId)];
                    if (selectedStage && selectedStage.customMapName) {
                        // customMapNameでmapRepositoryから検索
                        const allMaps = mapRepository.list();
                        const matchingMap = allMaps.find(m => m.name === selectedStage.customMapName);
                        if (matchingMap) {
                            const fullMapData = mapRepository.get(matchingMap.id);
                            // Validate custom map data
                            const validation = validateMapData(fullMapData);
                            if (!validation.valid) {
                                console.error('[MapSelectScene] Custom map validation failed:', validation.errors);
                                alert(`カスタムマップデータにエラーがあります:\n${validation.errors.join('\n')}`);
                                return;
                            }
                            this.manager.setGameData('customMapData', fullMapData);
                        } else {
                            this.manager.setGameData('customMapData', null);
                        }
                    } else {
                        // カスタムマップデータをクリア
                        this.manager.setGameData('customMapData', null);
                    }
                } else {
                    // カスタムマップIDを設定
                    const mapData = mapRepository.get(this.selectedId);
                    // Validate custom map data
                    const validation = validateMapData(mapData);
                    if (!validation.valid) {
                        console.error('[MapSelectScene] Custom map validation failed:', validation.errors);
                        alert(`カスタムマップデータにエラーがあります:\n${validation.errors.join('\n')}`);
                        return;
                    }
                    this.manager.setGameData('customMapData', mapData);
                    // ステージIDはダミーまたは専用ID
                    gameProgress.currentStage = 'custom';
                }
                this.manager.transition(SCENES.ORGANIZATION);
            }
        });
    }
}

class OrganizationScene {
    constructor(manager) {
        this.manager = manager;
        this.maxSquadSize = 30;
        this.maxTotalCost = 300;
        this.selectedUnitId = null; // 左リストでの選択
        this.selectedDeployedUnitId = null; // 右リストでの選択
    }

    createUI() {
        if (!this.manager.uiContainer) return;

        this.deployedIds = [...gameProgress.deployedUnitIds];
        this.allUnits = gameProgress.getPlayerUnits();

        // 【デバッグ用】ダミーデータの投入
        if (this.allUnits.length < 10) {
            const dummyTypes = ['soldier', 'archer', 'knight', 'mage', 'lancer', 'fighter'];
            for (let i = 0; i < 20; i++) {
                const type = dummyTypes[i % dummyTypes.length];
                const dummyId = `dummy_${Date.now()}_${i}`;
                this.allUnits.push({
                    id: dummyId,
                    type: type,
                    name: `予備部隊 ${String.fromCharCode(65 + (i % 26))}${i > 25 ? i : ''}`,
                    level: Math.floor(Math.random() * 10) + 1,
                    unitCount: Math.floor(Math.random() * 20) + 1,
                    exp: 0,
                    nextExp: 100
                });
            }
        }

        const org = document.createElement('div');
        org.className = 'scene-ui organization-screen';

        // v6: 3カラムレイアウト
        org.innerHTML = `
            <div class="org-container-v6">
                
                <!-- 左カラム：所持リスト -->
                <div class="org-col-left">
                    <div class="panel-header">
                        <div class="panel-title">
                            <i class="fas fa-th-list"></i> 所有部隊
                        </div>
                    </div>
                    <div class="org-unit-list card-view" id="org-unit-list"></div>
                </div>

                <!-- 中央カラム：操作ボタン -->
                <div class="org-col-center">
                   <button class="btn-remove-deploy" id="btn-remove-deploy" disabled>
                        <i class="fas fa-arrow-left"></i>
                        <br>
                        解除
                   </button>
                </div>

                <!-- 右カラム：出撃詳細・エディタ -->
                <div class="org-col-right">
                    
                    <!-- ヘッダーエリア：コスト＆ボタン -->
                    <div class="org-right-header">
                        <div class="cost-area">
                            <label>TOTAL COST</label>
                            <span id="header-cost-val">0 / 300</span>
                        </div>
                        <div class="header-actions">
                            <button class="btn-sub-action" id="btn-skill" disabled>
                                <i class="fas fa-book"></i> スキル
                            </button>
                            <button class="btn-sub-action" id="btn-equip" disabled>
                                <i class="fas fa-shield-alt"></i> 装備
                            </button>
                        </div>
                    </div>

                    <!-- メイン：出撃部隊詳細リスト -->
                    <div class="deployed-detail-list" id="deployed-detail-list">
                        <!-- JSで生成 -->
                    </div>

                    <!-- フッターアクション: 戻る・出撃 -->
                    <div class="org-right-footer">
                        <button class="btn-secondary" id="btn-back-map">戻る</button>
                        <button class="btn-primary btn-xl" id="btn-to-deploy">出撃へ</button>
                    </div>

                </div>

            </div>
        `;

        this.manager.uiContainer.appendChild(org);

        this.renderLists();
        this.renderDeployedDetailList();
        this.renderCenterControls();
        this.updateHeaderInfo();

        // イベント
        document.getElementById('btn-back-map').addEventListener('click', () => {
            this.manager.transition(SCENES.MAP_SELECT);
        });

        document.getElementById('btn-to-deploy').addEventListener('click', () => {
            const currentCost = this.calculateTotalCost();
            if (currentCost <= this.maxTotalCost) {
                gameProgress.deployedUnits = this.deployedIds.filter(id => typeof id === 'string' ? !id.startsWith('dummy_') : true);
                this.manager.transition(SCENES.DEPLOYMENT);
            } else {
                alert(`コスト上限(${this.maxTotalCost})を超えています。\n現在のコスト: ${currentCost}`);
            }
        });

        document.getElementById('btn-remove-deploy').addEventListener('click', () => {
            if (this.selectedDeployedUnitId) {
                this.deployedIds = this.deployedIds.filter(id => id !== this.selectedDeployedUnitId);
                this.selectedDeployedUnitId = null;
                this.renderLists();
                this.renderDeployedDetailList();
                this.renderCenterControls();
                this.updateHeaderInfo();
            }
        });

        document.getElementById('btn-skill').addEventListener('click', () => alert('スキル画面へ（未実装）'));
        document.getElementById('btn-equip').addEventListener('click', () => alert('装備画面へ（未実装）'));

    }

    calculateTotalCost() {
        let total = 0;
        this.deployedIds.forEach(id => {
            const unit = this.allUnits.find(u => u.id === id);
            if (unit) {
                const info = getUnitTypeInfo(unit.type);
                const cost = info?.cost || 0;
                total += cost * (unit.unitCount || 1);
            }
        });
        return total;
    }

    updateHeaderInfo() {
        // コスト更新
        const currentCost = this.calculateTotalCost();
        const costText = document.getElementById('header-cost-val');
        if (costText) {
            costText.innerHTML = `<span style="color:${currentCost > this.maxTotalCost ? '#f55' : '#fff'}">${currentCost}</span> / ${this.maxTotalCost}`;
        }

        // ボタン活性化制御
        const skillBtn = document.getElementById('btn-skill');
        const equipBtn = document.getElementById('btn-equip');

        // どちらかで選択されていれば活性化（優先は右リスト）
        const activeId = this.selectedDeployedUnitId || this.selectedUnitId;
        const isDisabled = !activeId;

        if (skillBtn) skillBtn.disabled = isDisabled;
        if (equipBtn) equipBtn.disabled = isDisabled;
    }

    renderCenterControls() {
        const btn = document.getElementById('btn-remove-deploy');
        if (btn) {
            btn.disabled = !this.selectedDeployedUnitId;
        }
    }

    // 左パネル：カード型リスト
    renderLists() {
        const container = document.getElementById('org-unit-list');
        if (!container) return;
        container.innerHTML = '';

        this.allUnits.forEach(unit => {
            const isDeployed = this.deployedIds.includes(unit.id);
            // 左側での選択状態
            const isSelected = (unit.id === this.selectedUnitId);
            const info = getUnitTypeInfo(unit.type);

            const card = document.createElement('div');
            card.className = `org-unit-card ${isSelected ? 'selected' : ''} ${isDeployed ? 'deployed' : ''}`;

            card.innerHTML = `
                <div class="card-content">
                    <div class="card-header">
                        <span class="badg-type type-${unit.type}">${info?.name || unit.type}</span>
                        ${isDeployed ? '<span class="badg-status">DEPL</span>' : ''}
                    </div>
                    <div class="card-name">${unit.name}</div>
                    <div class="card-meta">
                        Lv.${unit.level} / ${unit.unitCount}体
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                // 左クリック時:
                // 1. 未出撃なら出撃リストに追加
                // 2. 既に出撃中なら選択状態にする（右リストも連動してスクロール等したいがまずは選択のみ）
                this.selectedUnitId = unit.id;
                this.selectedDeployedUnitId = null; // 右の選択は解除

                if (!isDeployed) {
                    this.deployedIds.push(unit.id);
                } else {
                    // 既に出撃済みの場合、右側でも選択状態にする
                    this.selectedDeployedUnitId = unit.id;
                }

                this.renderLists();
                this.renderDeployedDetailList();
                this.renderCenterControls();
                this.updateHeaderInfo();
            });

            container.appendChild(card);
        });
    }

    // 右パネル：出撃詳細リスト (v6 縦並び・スプライト列)
    renderDeployedDetailList() {
        const container = document.getElementById('deployed-detail-list');
        if (!container) return;
        container.innerHTML = '';

        if (this.deployedIds.length === 0) {
            container.innerHTML = '<div class="empty-state">出撃部隊がいません。<br>左のリストから選択して追加してください。</div>';
            return;
        }

        this.deployedIds.forEach(id => {
            const unit = this.allUnits.find(u => u.id === id);
            if (!unit) return;

            const isSelected = (id === this.selectedDeployedUnitId);
            const info = getUnitTypeInfo(unit.type);

            const row = document.createElement('div');
            row.className = `deployed-row ${isSelected ? 'selected' : ''}`;

            // シンボル部 + スプライト列
            row.innerHTML = `
                <div class="d-row-left">
                    <div class="d-symbol">${info?.marker || '?'}</div>
                    <div class="d-name">${unit.name}</div>
                    <div class="d-lv">Lv.${unit.level}</div>
                    
                    <!-- 簡易兵数操作 (hover時等に表示、または常時) -->
                    <div class="d-count-ctrl">
                        <button class="btn-mini dec">-</button>
                        <span class="val">${unit.unitCount}</span>
                        <button class="btn-mini inc">+</button>
                    </div>
                </div>
                <div class="d-row-right">
                    <div class="unit-sprite-line">
                        <!-- JSで埋める -->
                    </div>
                </div>
            `;

            // スプライト生成
            const line = row.querySelector('.unit-sprite-line');

            // ユニットタイプに基づきスプライトパスを決定
            const typeKey = (unit.type || 'INFANTRY').toUpperCase();
            // マッピングからキーを取得 (例: 'ARCHER' -> 'ARCHER', 'INFANTRY' -> 'DEFAULT')
            const spriteKey = UNIT_TYPE_TO_SPRITE[typeKey] || 'DEFAULT';

            // パスを取得 (sprite-config.js の定義を使用)
            // SPRITE_PATHS は 'sprites/archer/archer.png' 等を返し、これはルートからの相対パスとして機能する
            const spritePath = SPRITE_PATHS[spriteKey] || SPRITE_PATHS['DEFAULT'];
            const spriteSrc = `url('${spritePath}')`;

            for (let i = 0; i < unit.unitCount; i++) {
                const cell = document.createElement('div');
                cell.className = 'unit-sprite-cell-small';
                cell.style.backgroundImage = spriteSrc;
                // アニメーションのランダム開始
                cell.style.animationDelay = `${Math.random() * -1.0}s`;
                line.appendChild(cell);
            }

            // 行クリックで選択
            row.addEventListener('click', (e) => {
                // ボタン類クリック時は伝播させない
                if (e.target.tagName === 'BUTTON') return;

                this.selectedDeployedUnitId = id;
                this.selectedUnitId = null; // 左選択解除
                this.renderLists();
                this.renderDeployedDetailList();
                this.renderCenterControls();
                this.updateHeaderInfo();
            });

            // 兵数操作イベント
            row.querySelector('.dec').addEventListener('click', (e) => {
                e.stopPropagation();
                if (unit.unitCount > 1) {
                    unit.unitCount--;
                    this.renderLists(); // Cardの兵数更新
                    this.renderDeployedDetailList();
                    this.updateHeaderInfo(); // コスト更新
                }
            });
            row.querySelector('.inc').addEventListener('click', (e) => {
                e.stopPropagation();
                if (unit.unitCount < this.maxSquadSize) {
                    unit.unitCount++;
                    this.renderLists();
                    this.renderDeployedDetailList();
                    this.updateHeaderInfo();
                }
            });

            container.appendChild(row);
        });
    }
}

class DeploymentScene {
    constructor(manager) {
        this.manager = manager;
        this.placedUnits = new Map(); // unitId -> {x, y}
        this.selectedUnitId = null;   // 現在選択中のユニットID
        this.deploymentZones = [];    // 配置可能座標リスト
    }

    createUI() {
        if (!this.manager.uiContainer) return;

        const stageId = gameProgress.currentStage;
        const stage = STAGES[stageId];
        const customMap = this.manager.getGameData('customMapData');
        const deployedUnits = gameProgress.getDeployedUnits();

        // 配置可能座標を取得
        this.deploymentZones = [];

        if (customMap && customMap.playerDeploymentZones && customMap.playerDeploymentZones.length > 0) {
            this.deploymentZones = customMap.playerDeploymentZones;
        }
        else if (customMap && customMap.zones && customMap.zones.playerDeployment && customMap.terrain) {
            const rect = customMap.zones.playerDeployment;
            for (let y = rect.y; y < rect.y + rect.height; y++) {
                for (let x = rect.x; x < rect.x + rect.width; x++) {
                    if (x >= 0 && x < customMap.terrain.width && y >= 0 && y < customMap.terrain.height) {
                        this.deploymentZones.push({ x, y });
                    }
                }
            }
        }

        if (customMap && this.manager.game.renderingEngine) {
            this.manager.game.renderingEngine.buildTerrainFromMapData(customMap);
            this.spawnPreviewUnits(customMap);
            this.manager.game.renderingEngine.setDeploymentHighlight(this.deploymentZones);
        }

        const deploy = document.createElement('div');
        deploy.className = 'scene-ui deployment-screen';
        deploy.innerHTML = `
            <div class="deploy-sidebar">
                <h3>📍 配置ユニット</h3>
                <div id="deploy-unit-list" class="deploy-unit-list">
                    ${deployedUnits.map(u => {
            const info = getUnitTypeInfo(u.type);
            return `
                            <div class="deploy-unit-item" data-unit-id="${u.id}">
                                <span class="unit-marker">${info?.marker || '👤'}</span>
                                <span>${u.name}</span>
                                <span class="place-status">未配置</span>
                            </div>
                        `;
        }).join('')}
                </div>
                <button class="btn-primary full-width" id="btn-auto-place">自動配置</button>
            </div>
            <div class="deploy-overlay">
                <div class="deploy-panel">
                    <h2>⚔️ ${stage?.name || customMap?.name || 'ステージ'}</h2>
                    <p>配置エリア: 青色のハイライトエリアにユニットを配置</p>
                    <div class="deploy-info">
                        <span>配置: <strong id="placed-count">0</strong>/${deployedUnits.length}</span>
                    </div>
                    <div class="button-row">
                        <button class="btn-secondary" id="btn-back-org">戻る</button>
                        <button class="btn-primary" id="btn-start-battle" disabled>戦闘開始</button>
                    </div>
                </div>
            </div>
        `;

        this.manager.uiContainer.appendChild(deploy);

        // 自動配置
        document.getElementById('btn-auto-place')?.addEventListener('click', () => {
            this.autoPlaceUnits(deployedUnits, stage, customMap);
        });

        document.getElementById('btn-back-org')?.addEventListener('click', () => {
            if (this.manager.game.renderingEngine?.clearDeploymentHighlight) {
                this.manager.game.renderingEngine.clearDeploymentHighlight();
            }
            this.manager.transition(SCENES.ORGANIZATION);
        });

        document.getElementById('btn-start-battle')?.addEventListener('click', () => {
            if (confirm('戦闘を開始しますか？')) {
                if (this.placedUnits.size === deployedUnits.length) {
                    // Validate unit placements before starting battle
                    const placements = Array.from(this.placedUnits.entries()).map(([unitId, pos]) => ({
                        unitId: parseInt(unitId),
                        x: pos.x,
                        y: pos.y
                    }));
                    const validation = validatePlacements(placements);
                    if (!validation.valid) {
                        console.error('[DeploymentScene] Placement validation failed:', validation.errors);
                        alert(`ユニット配置にエラーがあります:\n${validation.errors.join('\n')}`);
                        return;
                    }

                    // Validate individual unit data
                    const deployedUnitsData = gameProgress.getDeployedUnits();
                    for (const unit of deployedUnitsData) {
                        const unitValidation = validateUnitData(unit);
                        if (!unitValidation.valid) {
                            console.error(`[DeploymentScene] Unit validation failed for ${unit.id}:`, unitValidation.errors);
                            alert(`ユニットデータにエラーがあります (${unit.name}):\n${unitValidation.errors.join('\n')}`);
                            return;
                        }
                    }

                    if (this.manager.game.renderingEngine?.clearDeploymentHighlight) {
                        this.manager.game.renderingEngine.clearDeploymentHighlight();
                    }
                    this.manager.setGameData('unitPlacements', Array.from(this.placedUnits.entries()));
                    this.manager.transition(SCENES.BATTLE);
                }
            }
        });

        document.querySelectorAll('.deploy-unit-item').forEach(item => {
            item.addEventListener('click', () => {
                const unitId = item.dataset.unitId;
                this.selectUnit(unitId);
            });
        });

        this.setupManualPlacement(this.manager.game);
    }

    autoPlaceUnits(units, stage, customMap) {
        try {
            if (this.manager.game.renderingEngine?.clearDeploymentMarkers) {
                this.manager.game.renderingEngine.clearDeploymentMarkers();
            }

            this.placedUnits.clear();

            if (this.deploymentZones.length > 0) {
                units.forEach((unit, idx) => {
                    if (idx < this.deploymentZones.length) {
                        const zone = this.deploymentZones[idx];
                        this.placedUnits.set(unit.id, { x: zone.x, y: zone.y });

                        const item = document.querySelector(`.deploy-unit-item[data-unit-id="${unit.id}"]`);
                        if (item) {
                            item.classList.remove('selecting');
                            item.classList.add('placed');
                            const statusEl = item.querySelector('.place-status');
                            if (statusEl) statusEl.textContent = `(${zone.x}, ${zone.y})`;
                        }

                        this.manager.game.renderingEngine.addDeploymentMarker(zone.x, zone.y);
                    }
                });
            } else {
                let zone = { x: 0, y: 20, width: 10, height: 10 };

                if (customMap && customMap.zones && customMap.zones.playerDeployment) {
                    zone = customMap.zones.playerDeployment;
                } else if (stage && stage.deploymentZone) {
                    zone = stage.deploymentZone;
                }

                const mapW = (customMap && customMap.terrain) ? customMap.terrain.width : (stage ? stage.mapSize?.width : 30) || 30;
                const mapH = (customMap && customMap.terrain) ? customMap.terrain.height : (stage ? stage.mapSize?.height : 30) || 30;

                let idx = 0;
                units.forEach(unit => {
                    const col = idx % 4;
                    const row = Math.floor(idx / 4);
                    const offsetX = col * 2 + 1;
                    const offsetY = row * 2 + 1;

                    let x = zone.x + offsetX;
                    let y = zone.y + offsetY;

                    if (x >= mapW) x = mapW - 1;
                    if (y >= mapH) y = mapH - 1;
                    if (x < 0) x = 0;
                    if (y < 0) y = 0;

                    this.placedUnits.set(unit.id, { x, y });

                    const item = document.querySelector(`.deploy-unit-item[data-unit-id="${unit.id}"]`);
                    if (item) {
                        item.classList.remove('selecting');
                        item.classList.add('placed');
                        const statusEl = item.querySelector('.place-status');
                        if (statusEl) statusEl.textContent = `(${x}, ${y})`;
                    }

                    this.manager.game.renderingEngine.addDeploymentMarker(x, y);

                    idx++;
                });
            }

            const countEl = document.getElementById('placed-count');
            if (countEl) countEl.textContent = this.placedUnits.size.toString();

            if (this.placedUnits.size === units.length) {
                const btn = document.getElementById('btn-start-battle');
                if (btn) btn.disabled = false;
            }

            this.selectedUnitId = null;
            document.querySelectorAll('.deploy-unit-item').forEach(item => {
                item.classList.remove('selecting');
            });
        } catch (e) {
            alert("自動配置中にエラーが発生しました。");
        }
    }
    selectUnit(unitId) {
        this.selectedUnitId = parseInt(unitId);

        document.querySelectorAll('.deploy-unit-item').forEach(item => {
            item.classList.remove('selecting');
            if (parseInt(item.dataset.unitId) === this.selectedUnitId) {
                item.classList.add('selecting');
            }
        });
    }

    setupManualPlacement(game) {
        const canvas = game.renderingEngine?.canvas;
        if (!canvas) return;

        game.isDeploymentMode = true;

        const handlePointerDown = (event) => {
            try {
                if (event.target !== canvas && event.target.id !== 'gameCanvas') {
                    return;
                }

                if (!this.selectedUnitId) return;

                event.stopPropagation();
                event.stopImmediatePropagation();

                const rect = canvas.getBoundingClientRect();
                const mouseX = event.clientX - rect.left;
                const mouseY = event.clientY - rect.top;

                const gridPos = game.renderingEngine.screenToGrid(mouseX, mouseY, rect.width, rect.height, canvas);
                if (!gridPos) return;

                const { x, y } = gridPos;

                const isValidZone = this.deploymentZones.some(z => z.x === x && z.y === y);
                if (!isValidZone) {
                    return;
                }

                let occupiedUnitId = null;
                for (const [uid, pos] of this.placedUnits) {
                    if (pos.x === x && pos.y === y) {
                        occupiedUnitId = uid;
                        break;
                    }
                }

                if (occupiedUnitId) {
                    if (occupiedUnitId === this.selectedUnitId) return;

                    const prevPos = this.placedUnits.get(this.selectedUnitId);

                    if (prevPos) {
                        this.placedUnits.set(occupiedUnitId, prevPos);
                        this.updateUnitStatus(occupiedUnitId, prevPos);
                        game.renderingEngine.addDeploymentMarker(prevPos.x, prevPos.y);
                    } else {
                        this.placedUnits.delete(occupiedUnitId);
                        this.updateUnitStatus(occupiedUnitId, null);
                    }
                }

                this.placedUnits.set(this.selectedUnitId, { x, y });
                this.updateUnitStatus(this.selectedUnitId, { x, y });

                const countEl = document.getElementById('placed-count');
                if (countEl) countEl.textContent = this.placedUnits.size.toString();

                const deployedUnits = gameProgress.getDeployedUnits();
                if (this.placedUnits.size === deployedUnits.length) {
                    const btn = document.getElementById('btn-start-battle');
                    if (btn) btn.disabled = false;
                }

                game.renderingEngine.addDeploymentMarker(x, y);
            } catch (e) {
                console.error("Manual Placement Error:", e);
                alert("配置処理中にエラーが発生しました: " + e.message);
            }
        };

        const handlePointerUp = (event) => {
            if (event.target === canvas || event.target.id === 'gameCanvas') {
                if (this.selectedUnitId) {
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                }
            }
        };

        if (this._handlePointerDown) canvas.removeEventListener('mousedown', this._handlePointerDown);
        if (this._handlePointerUp) canvas.removeEventListener('mouseup', this._handlePointerUp);

        this._handlePointerDown = handlePointerDown;
        this._handlePointerUp = handlePointerUp;

        canvas.addEventListener('mousedown', this._handlePointerDown, { capture: true });
        canvas.addEventListener('mouseup', this._handlePointerUp, { capture: true });
    }

    updateUnitStatus(unitId, pos) {
        const item = document.querySelector(`.deploy-unit-item[data-unit-id="${unitId}"]`);
        if (item) {
            const statusEl = item.querySelector('.place-status');
            if (pos) {
                item.classList.add('placed');
                if (statusEl) statusEl.textContent = `(${pos.x}, ${pos.y})`;
            } else {
                item.classList.remove('placed');
                if (statusEl) statusEl.textContent = '未配置';
            }
        }
    }

    removeManualPlacementHandler(game) {
        const canvas = game.renderingEngine?.canvas;
        if (canvas) {
            if (this._handlePointerDown) {
                canvas.removeEventListener('mousedown', this._handlePointerDown);
                this._handlePointerDown = null;
            }
            if (this._handlePointerUp) {
                canvas.removeEventListener('mouseup', this._handlePointerUp);
                this._handlePointerUp = null;
            }
        }
        if (game) game.isDeploymentMode = false;
    }


    spawnPreviewUnits(customMap) {
        const game = this.manager.game;
        if (!game || !game.unitManager) return;

        game.units = [];

        // Security: Validate customMap structure and prevent prototype pollution/DoS
        if (!customMap || typeof customMap !== 'object') {
            console.error('[DeploymentScene] Invalid customMap structure');
            return;
        }

        if (!Array.isArray(customMap.units) || !Array.isArray(customMap.unitDefinitions)) {
            console.error('[DeploymentScene] units/unitDefinitions must be arrays');
            return;
        }

        if (customMap.units.length > 1000) {
            console.error('[DeploymentScene] Too many units (max 1000)');
            return;
        }

        if (customMap && customMap.units && customMap.unitDefinitions) {
            const playerSide = 'EAST';
            const enemySide = 'WEST';

            // Security: Validate arrays immediately before entering loop (CWE-20)
            if (!Array.isArray(customMap.units) || !Array.isArray(customMap.unitDefinitions)) {
                console.error('[DeploymentScene] units/unitDefinitions must be arrays');
                return;
            }

            customMap.units.forEach((placedUnit, idx) => {
                // Security: Re-validate on each iteration to prevent TOCTOU/time-of-check attacks
                if (!Array.isArray(customMap.units) || !Array.isArray(customMap.unitDefinitions)) {
                    console.error('[DeploymentScene] Array modified during iteration');
                    return;
                }
                const def = customMap.unitDefinitions.find(d => d.id === placedUnit.defId);
                if (!def) return;

                // Security: Validate unit data before using it to prevent malicious map exploits
                const unitValidation = validateUnitData({
                    id: def.id,
                    name: def.name,
                    type: def.type,
                    count: def.count,
                    atk: def.atk,
                    def: def.def,
                    x: placedUnit.x,
                    y: placedUnit.y
                });

                if (!unitValidation.valid) {
                    console.error(`[DeploymentScene] Invalid unit definition:`, unitValidation.errors);
                    return; // Skip this unit
                }

                const warlordData = {
                    name: def.name,
                    side: enemySide,
                    x: placedUnit.x,
                    y: placedUnit.y,
                    soldiers: (def.count || 1) * 1000,
                    atk: def.atk || 50,
                    def: def.def || 50,
                    jin: 50,
                    loyalty: 100,
                    p: 50,
                    type: def.type,
                    face: null
                };

                const warlordId = `preview_enemy_${idx}`;
                const generatedUnits = game.unitManager.createUnitsFromWarlord(
                    warlordData,
                    warlordId,
                    [],
                    game.mapSystem
                );

                generatedUnits.forEach((unit, i) => {
                    unit.type = def.type;
                    unit.level = def.level || 1;
                    if (def.role === 'commander' && i === 0) {
                        unit.unitType = 'HEADQUARTERS';
                    }
                });

                game.units.push(...generatedUnits);
            });

            if (game.renderingEngine && game.renderingEngine.drawUnits) {
                window.gameState = { units: game.units };
                game.renderingEngine.drawUnits();
            }
        }
    }

    cleanup() {
        if (this.manager.game.renderingEngine?.clearDeploymentHighlight) {
            this.manager.game.renderingEngine.clearDeploymentHighlight();
        }
        if (this.manager.game.renderingEngine?.clearDeploymentMarkers) {
            this.manager.game.renderingEngine.clearDeploymentMarkers();
        }
        this.removeManualPlacementHandler(this.manager.game);
    }
}

class BattleScene {
    constructor(manager) {
        this.manager = manager;
    }

    async createUI() {
        if (!this.manager.uiContainer) return;

        // Initialize managers
        this.manager.initializeManagers();

        // Validate custom map data before starting game
        const customMapData = this.manager.getGameData('customMapData');
        if (customMapData) {
            const mapValidation = validateMapData(customMapData);
            if (!mapValidation.valid) {
                console.error('[BattleScene] Map validation failed:', mapValidation.errors);
                alert(`マップデータにエラーがあります:\n${mapValidation.errors.join('\n')}`);
                this.manager.transition(SCENES.MAP_SELECT);
                return;
            }

            // Validate unit definitions if present
            if (customMapData.unitDefinitions) {
                for (const unitDef of customMapData.unitDefinitions) {
                    const unitValidation = validateUnitData(unitDef);
                    if (!unitValidation.valid) {
                        console.error(`[BattleScene] Unit definition validation failed for ${unitDef.id}:`, unitValidation.errors);
                        alert(`ユニット定義にエラーがあります (${unitDef.name || unitDef.id}):\n${unitValidation.errors.join('\n')}`);
                        this.manager.transition(SCENES.MAP_SELECT);
                        return;
                    }
                }
            }

            // Validate unit placements if present
            if (customMapData.units) {
                const placementsValidation = validatePlacements(customMapData.units);
                if (!placementsValidation.valid) {
                    console.error('[BattleScene] Placements validation failed:', placementsValidation.errors);
                    alert(`ユニット配置データにエラーがあります:\n${placementsValidation.errors.join('\n')}`);
                    this.manager.transition(SCENES.MAP_SELECT);
                    return;
                }
            }
        }

        this.manager.uiContainer.innerHTML = `
            <div id="top-bar" class="hud-panel">
                <span id="phase-text" style="color:#ffd700">関ヶ原の戦い</span>
                <span id="status-text" style="font-size:14px; color:#ccc; margin-top:4px;">東軍: -- / 西軍: --</span>
            </div>
            <div id="unit-list"></div>
            <div style="position:absolute; bottom:10px; left:10px; font-size:12px; color:#888; font-family:sans-serif; pointer-events:auto;">
                [左ドラッグ] 範囲選択 | [右ドラッグ] マップ移動 | [左クリック] 指示/確認
            </div>
            <div id="context-menu" style="display:none; pointer-events:auto;">
                <button class="ctx-btn" style="color:darkred" onclick="window.issueCommand('ATTACK')">突撃</button>
                <button class="ctx-btn" style="color:darkgreen" onclick="window.issueCommand('PLOT')">調略</button>
                <button class="ctx-btn" onclick="window.closeCtx()">取消</button>
            </div>
            <div id="formation-panel" class="hud-panel" style="display:none;">
                <div class="formation-title">陣形選択</div>
                <div id="formation-buttons"></div>
                <div id="formation-tooltip"></div>
            </div>
            <div id="speed-control">
                <button class="speed-btn" data-speed="1.0" onclick="window.setActionSpeed(1.0)">▶</button>
                <button class="speed-btn" data-speed="1.5" onclick="window.setActionSpeed(1.5)">▶▶</button>
                <button class="speed-btn" data-speed="2.0" onclick="window.setActionSpeed(2.0)">▶▶▶</button>
            </div>
        `;

        const game = this.manager.game;
        game.customMapData = this.manager.getGameData('customMapData');
        // startGame is now async (delegates to game/starter.js)
        await game.startGame('EAST');

        // Setup input listeners
        const canvas = document.getElementById('gameCanvas');
        this.manager.setupInput(canvas);

        // Expose game instance and manager methods to window
        window.game = game;
        window.sceneManager = this.manager;

        // Use turn manager for commit turn
        window.commitTurn = () => {
            try {
                if (this.manager.turnManager) {
                    this.manager.turnManager.commitTurn();
                } else {
                    game.commitTurn();
                }
            } catch (e) {
                console.error('commitTurn error:', e);
            }
        };

        // Issue command still uses game method
        window.issueCommand = (type) => {
            try {
                game.issueCommand(type);
            } catch (e) {
                console.error('issueCommand error:', e);
            }
        };

        // Close context menu
        window.closeCtx = () => {
            try {
                document.getElementById('context-menu').style.display = 'none';
            } catch (e) {
                console.error('closeCtx error:', e);
            }
        };

        // Store handler references for cleanup
        this._actionBtnHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                if (this.manager.turnManager) {
                    this.manager.turnManager.commitTurn();
                } else {
                    game.commitTurn();
                }
            } catch (err) {
                console.error('Action button error:', err);
            }
        };

        // Action button click handler
        const actionBtn = document.getElementById('action-btn');
        if (actionBtn) {
            actionBtn.style.display = 'block';
            actionBtn.addEventListener('click', this._actionBtnHandler);
        }

        // Store speed button handler reference
        this._speedBtnHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const speed = parseFloat(e.currentTarget.dataset.speed);
            try {
                game.actionSpeed = speed;
                document.querySelectorAll('.speed-btn').forEach(b => {
                    if (b === e.currentTarget) {
                        b.classList.add('active');
                    } else {
                        b.classList.remove('active');
                    }
                });
            } catch (err) {
                console.error('Speed button error:', err);
            }
        };

        // Action speed control
        window.setActionSpeed = (speed) => {
            try {
                game.actionSpeed = speed;
                document.querySelectorAll('.speed-btn').forEach(btn => {
                    const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
                    if (btnSpeed === speed) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            } catch (e) {
                console.error('setActionSpeed error:', e);
            }
        };

        // Speed button click handlers
        this._speedButtons = [];
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', this._speedBtnHandler);
            this._speedButtons.push(btn);
        });

        // Set default active speed button
        const defaultSpeedBtn = document.querySelector('.speed-btn[data-speed="1.0"]');
        if (defaultSpeedBtn) {
            defaultSpeedBtn.classList.add('active');
        }
    }

    /**
     * Cleanup event listeners and global properties to prevent memory leaks
     */
    cleanup() {
        // Remove action button event listener
        const actionBtn = document.getElementById('action-btn');
        if (actionBtn && this._actionBtnHandler) {
            actionBtn.removeEventListener('click', this._actionBtnHandler);
            this._actionBtnHandler = null;
        }

        // Remove speed button event listeners
        if (this._speedButtons && this._speedBtnHandler) {
            this._speedButtons.forEach(btn => {
                btn.removeEventListener('click', this._speedBtnHandler);
            });
            this._speedButtons = [];
            this._speedBtnHandler = null;
        }

        // Clean up global window properties
        if (window.game) {
            window.game = null;
        }
        if (window.sceneManager) {
            window.sceneManager = null;
        }
        if (window.commitTurn) {
            window.commitTurn = null;
        }
        if (window.issueCommand) {
            window.issueCommand = null;
        }
        if (window.closeCtx) {
            window.closeCtx = null;
        }
        if (window.setActionSpeed) {
            window.setActionSpeed = null;
        }
    }
}

class ResultScene {
    constructor(manager, result) {
        this.manager = manager;
        this.result = result; // 'VICTORY' or 'DEFEAT'
    }

    createUI() {
        if (!this.manager.uiContainer) return;

        this.manager.uiContainer.style.pointerEvents = 'auto';

        const resultDiv = document.createElement('div');
        resultDiv.className = 'scene-ui result-screen';

        const title = this.result === 'VICTORY' ? '勝利' : '敗北';
        const color = this.result === 'VICTORY' ? '#ffd700' : '#888';

        resultDiv.innerHTML = `
            <h1 style="color:${color}; font-size: 64px;">${title}</h1>
            <button class="btn-primary" id="btn-return">タイトルへ戻る</button>
        `;

        this.manager.uiContainer.appendChild(resultDiv);

        document.getElementById('btn-return').addEventListener('click', () => {
            location.reload();
        });
    }
}
