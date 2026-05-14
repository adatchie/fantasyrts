
import { STAGES, gameProgress, STAGE_EVENTS } from './game-data.js?v=126';
import { getUnitTypeInfo, UNIT_TYPES, SOLDIERS_PER_UNIT, MAP_W, MAP_H } from './constants.js?v=11';
import { SPRITE_PATHS, UNIT_TYPE_TO_SPRITE } from './sprite-config.js'; // スプライト設定読み込み
import { mapRepository } from './map-repository.js?v=2'; // マップリポジトリ読み込み
import {
    EQUIPMENT_ITEMS,
    EQUIPMENT_STAT_KEYS,
    EQUIPMENT_SLOTS,
    formatEquipmentStats,
    getEquipmentItem,
    getEquipmentItemsBySlot,
    getEquipmentStatBonus,
    getItemIconStyle,
    normalizeEquipment
} from './equipment-data.js';
import { createInputHandler, setupInputListeners } from './managers/input-handler.js';
import { createTurnManager } from './managers/turn-manager.js';
import { validateMapData, validateUnitData, validatePlacements } from './game/validator.js';

function esc(str) {
    const el = document.createElement('span');
    el.textContent = String(str ?? '');
    return el.innerHTML;
}

const EQUIPMENT_SLOT_ORDER = ['head', 'body', 'weapon', 'shield'];

function renderEquipmentIcon(item, extraClass = '') {
    if (!item) {
        return `<span class="equipment-icon empty ${extraClass}">-</span>`;
    }
    return `<span class="equipment-icon ${extraClass}" style="${getItemIconStyle(item)}" title="${esc(item.name)}"></span>`;
}

function renderEquipmentMiniIcons(unit) {
    const equipment = normalizeEquipment(unit.equipment);
    return EQUIPMENT_SLOT_ORDER.map(slotId => {
        const item = getEquipmentItem(equipment[slotId]);
        return renderEquipmentIcon(item, 'mini');
    }).join('');
}

function renderStatLines(stats = {}) {
    return formatEquipmentStats(stats)
        .split(' / ')
        .map(text => `<span>${esc(text)}</span>`)
        .join('');
}

export const SCENES = {
    TITLE: 'TITLE',
    WORLD_MAP: 'WORLD_MAP',
    MAP_SELECT: 'MAP_SELECT',
    ORGANIZATION: 'ORGANIZATION',
    EQUIPMENT: 'EQUIPMENT',
    EQUIPMENT_SHOP: 'EQUIPMENT_SHOP',
    DEPLOYMENT: 'DEPLOYMENT',
    BATTLE: 'BATTLE',
    RESULT: 'RESULT',
    EVENT: 'EVENT'
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
            link.href = 'styles/scene-styles.css?v=126';
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
            this.turnManager.triggerEndGame = async (winnerSide, loserName) => {
                // Set game state immediately to prevent resolveTurn from resetting to ORDER
                this.game.gameState = 'END';

                // Ensure eventManager processes clear/victory custom events prior to screen change
                if (this.game.eventManager) {
                    await this.game.eventManager.triggerClearEvent(winnerSide);
                }

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
            if (this.game?.effectManager) {
                this.game.effectManager.clearAll();
            }

            // 前のシーンのクリーンアップ
            if (this.uiContainer) {
                this.uiContainer.innerHTML = '';
                this.uiContainer.style.pointerEvents = '';
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
                case SCENES.WORLD_MAP:
                    this.sceneInstance = new WorldMapScene(this);
                    break;
                case SCENES.MAP_SELECT:
                    this.sceneInstance = new MapSelectScene(this);
                    break;
                case SCENES.ORGANIZATION:
                    this.sceneInstance = new OrganizationScene(this);
                    break;
                case SCENES.EQUIPMENT:
                    this.sceneInstance = new EquipmentScene(this, params.unitId);
                    break;
                case SCENES.EQUIPMENT_SHOP:
                    this.sceneInstance = new EquipmentShopScene(this);
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
                case SCENES.EVENT:
                    this.sceneInstance = new EventScene(this, params.eventKey);
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
            this.manager.transition(SCENES.WORLD_MAP);
        });
    }
}

class MapSelectScene {
    constructor(manager) {
        this.manager = manager;
    }

    async createUI() {
        if (!this.manager.uiContainer) return;

        // ゲーム進行状態から利用可能なステージを取得
        const stages = gameProgress.getAvailableStages();

        // カスタムマップリストを確実に最新化
        if (mapRepository) {
            try {
                await mapRepository.loadFromStorage();
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

        document.getElementById('btn-to-org').addEventListener('click', async () => {
            if (this.selectedId !== null) {
                if (this.selectedType === 'story') {
                    gameProgress.currentStage = parseInt(this.selectedId);

                    // シナリオに対応するステージJSONファイルを読み込む
                    const stages = gameProgress.getAvailableStages();
                    const selectedStage = stages[parseInt(this.selectedId)];
                    if (selectedStage && selectedStage.stageFile) {
                        try {
                            const response = await fetch(`./scripts/data/stages/${selectedStage.stageFile}`);
                            if (response.ok) {
                                const fullMapData = await response.json();
                                // Validate stage map data
                                const validation = validateMapData(fullMapData);
                                if (!validation.valid) {
                                    console.error('[MapSelectScene] Stage data validation failed:', validation.errors);
                                    alert(`ステージデータにエラーがあります:\n${validation.errors.join('\n')}`);
                                    return;
                                }
                                this.manager.setGameData('customMapData', fullMapData);
                            } else {
                                console.error(`[MapSelectScene] Failed to load ${selectedStage.stageFile}: ${response.status}`);
                                alert(`ステージデータの読み込みに失敗しました。`);
                                return;
                            }
                        } catch (e) {
                            console.error('[MapSelectScene] Error loading stage file:', e);
                            alert(`ステージデータの読み込み中にエラーが発生しました。`);
                            return;
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

        // デバッグ用ダミーデータは本番ユニットとは別配列で管理
        this.dummyUnits = [];
        if (this.allUnits.length < 10) {
            const dummyTypes = ['soldier', 'archer', 'knight', 'mage', 'lancer', 'fighter'];
            for (let i = 0; i < 20; i++) {
                const type = dummyTypes[i % dummyTypes.length];
                const dummyId = `dummy_${Date.now()}_${i}`;
                this.dummyUnits.push({
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
                            <button class="btn-sub-action" id="btn-shop">
                                <i class="fas fa-store"></i> 購入
                            </button>
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
        document.getElementById('btn-shop').addEventListener('click', () => {
            this.manager.transition(SCENES.EQUIPMENT_SHOP);
        });
        document.getElementById('btn-equip').addEventListener('click', () => {
            const activeUnit = this.getActiveUnit();
            if (activeUnit) this.manager.transition(SCENES.EQUIPMENT, { unitId: activeUnit.id });
        });

    }

    getActiveUnit() {
        const activeId = this.selectedDeployedUnitId || this.selectedUnitId;
        if (!activeId) return null;
        return this.allUnits.find(u => u.id === activeId) || null;
    }

    calculateTotalCost() {
        let total = 0;
        this.deployedIds.forEach(id => {
            const unit = this.allUnits.find(u => u.id === id);
            if (unit) {
                const info = getUnitTypeInfo(unit.class || unit.type);
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
        const activeUnit = this.getActiveUnit();
        const isDisabled = !activeUnit;

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

        [...this.allUnits, ...this.dummyUnits].forEach(unit => {
            const isDeployed = this.deployedIds.includes(unit.id);
            // 左側での選択状態
            const isSelected = (unit.id === this.selectedUnitId);
            const info = getUnitTypeInfo(unit.class || unit.type);

            const card = document.createElement('div');
            card.className = `org-unit-card ${isSelected ? 'selected' : ''} ${isDeployed ? 'deployed' : ''}`;

            card.innerHTML = `
                <div class="card-content">
                    <div class="card-header">
                        <span class="badg-type type-${esc(unit.class || unit.type)}">${esc(info?.name || unit.class || unit.type)}</span>
                        ${isDeployed ? '<span class="badg-status">DEPL</span>' : ''}
                    </div>
                    <div class="card-name">${esc(unit.name)}</div>
                    <div class="card-meta">
                        Lv.${unit.level} / ${unit.unitCount}体
                    </div>
                    <div class="card-equipment-icons">${renderEquipmentMiniIcons(unit)}</div>
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
            const info = getUnitTypeInfo(unit.class || unit.type);

            const row = document.createElement('div');
            row.className = `deployed-row ${isSelected ? 'selected' : ''}`;

            // シンボル部 + スプライト列
            row.innerHTML = `
                <div class="d-row-left">
                    <div class="d-symbol">${esc(info?.marker || '?')}</div>
                    <div class="d-name">${esc(unit.name)}</div>
                    <div class="d-lv">Lv.${unit.level}</div>
                    <div class="d-equipment-icons">${renderEquipmentMiniIcons(unit)}</div>

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
            const typeKey = (unit.class || unit.type || 'INFANTRY').toUpperCase();
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

    openEquipmentDialog(unitId, selectedSlot = 'weapon') {
        const unit = this.allUnits.find(u => u.id === unitId);
        if (!unit) return;

        const existing = document.getElementById('equipment-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'equipment-modal-overlay';
        overlay.className = 'equipment-modal-overlay';
        this.manager.uiContainer.appendChild(overlay);

        const render = (slotId) => {
            unit.equipment = normalizeEquipment(unit.equipment);
            const typeInfo = getUnitTypeInfo(unit.class || unit.type);
            const bonus = getEquipmentStatBonus(unit.equipment);
            const currentSlotItem = getEquipmentItem(unit.equipment[slotId]);

            overlay.innerHTML = `
                <div class="equipment-modal">
                    <div class="equipment-modal-header">
                        <div>
                            <div class="equipment-modal-title">${esc(unit.name)} の装備</div>
                            <div class="equipment-modal-sub">${esc(typeInfo?.name || unit.class || unit.type)} / Lv.${esc(unit.level || 1)}</div>
                        </div>
                        <button class="equipment-close-btn" id="equipment-close-btn">×</button>
                    </div>
                    <div class="equipment-modal-body">
                        <div class="equipment-slot-panel">
                            ${EQUIPMENT_SLOT_ORDER.map(slot => {
                                const slotItem = getEquipmentItem(unit.equipment[slot]);
                                const slotInfo = EQUIPMENT_SLOTS[slot];
                                return `
                                    <button class="equipment-slot-btn ${slot === slotId ? 'active' : ''}" data-slot="${slot}">
                                        ${renderEquipmentIcon(slotItem)}
                                        <span>${esc(slotInfo.name)}</span>
                                        <strong>${esc(slotItem?.name || '未装備')}</strong>
                                    </button>
                                `;
                            }).join('')}
                            <div class="equipment-bonus-box">
                                <label>装備補正</label>
                                <div class="equipment-stat-lines">${renderStatLines(bonus)}</div>
                            </div>
                        </div>
                        <div class="equipment-choice-panel">
                            <div class="equipment-choice-header">
                                <div>
                                    <span>${esc(EQUIPMENT_SLOTS[slotId].name)}</span>
                                    <strong>${esc(currentSlotItem?.name || '未装備')}</strong>
                                </div>
                                <button class="btn-secondary compact" id="equipment-clear-btn">外す</button>
                            </div>
                            <div class="equipment-choice-list" id="equipment-choice-list"></div>
                        </div>
                    </div>
                </div>
            `;

            const choiceList = overlay.querySelector('#equipment-choice-list');
            const ownedItems = gameProgress.getOwnedEquipmentItems(slotId);
            if (ownedItems.length === 0) {
                choiceList.innerHTML = '<div class="equipment-empty">このスロットの装備品をまだ所持していません。</div>';
            } else {
                ownedItems.forEach(item => {
                    const isCurrent = unit.equipment[slotId] === item.id;
                    const available = gameProgress.getEquipmentAvailableCount(item.id, unit.id);
                    const canEquip = isCurrent || available > 0;
                    const card = document.createElement('button');
                    card.className = `equipment-choice-card ${isCurrent ? 'active' : ''}`;
                    card.disabled = !canEquip;
                    card.innerHTML = `
                        ${renderEquipmentIcon(item)}
                        <div class="equipment-choice-main">
                            <div class="equipment-choice-name">${esc(item.name)}</div>
                            <div class="equipment-choice-desc">${esc(item.description)}</div>
                            <div class="equipment-choice-stats">${renderStatLines(item.stats)}</div>
                        </div>
                        <div class="equipment-choice-stock">
                            <span>所持 ${gameProgress.getEquipmentQuantity(item.id)}</span>
                            <span>空き ${available}</span>
                        </div>
                    `;
                    card.addEventListener('click', () => {
                        const result = gameProgress.equipUnit(unit.id, slotId, item.id);
                        if (!result.ok) {
                            alert(result.message);
                            return;
                        }
                        this.renderLists();
                        this.renderDeployedDetailList();
                        render(slotId);
                    });
                    choiceList.appendChild(card);
                });
            }

            overlay.querySelectorAll('.equipment-slot-btn').forEach(btn => {
                btn.addEventListener('click', () => render(btn.dataset.slot));
            });

            overlay.querySelector('#equipment-clear-btn')?.addEventListener('click', () => {
                gameProgress.equipUnit(unit.id, slotId, null);
                this.renderLists();
                this.renderDeployedDetailList();
                render(slotId);
            });

            overlay.querySelector('#equipment-close-btn')?.addEventListener('click', () => overlay.remove());
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) overlay.remove();
            });
        };

        render(selectedSlot);
    }
}

class EquipmentShopScene {
    constructor(manager) {
        this.manager = manager;
        this.selectedSlot = 'weapon';
    }

    createUI() {
        if (!this.manager.uiContainer) return;

        const shop = document.createElement('div');
        shop.className = 'scene-ui equipment-shop-screen';
        shop.innerHTML = `
            <div class="equipment-shop-shell">
                <div class="equipment-shop-header">
                    <div>
                        <h2>装備品購入</h2>
                        <p>GOLD <strong id="shop-gold">${gameProgress.gold}</strong></p>
                    </div>
                    <button class="btn-secondary" id="btn-back-org-from-shop">編成へ戻る</button>
                </div>
                <div class="equipment-shop-tabs">
                    ${EQUIPMENT_SLOT_ORDER.map(slot => `
                        <button class="equipment-shop-tab ${slot === this.selectedSlot ? 'active' : ''}" data-slot="${slot}">
                            ${esc(EQUIPMENT_SLOTS[slot].name)}
                        </button>
                    `).join('')}
                </div>
                <div class="equipment-shop-grid" id="equipment-shop-grid"></div>
            </div>
        `;

        this.manager.uiContainer.appendChild(shop);

        document.getElementById('btn-back-org-from-shop')?.addEventListener('click', () => {
            this.manager.transition(SCENES.ORGANIZATION);
        });

        shop.querySelectorAll('.equipment-shop-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedSlot = btn.dataset.slot;
                shop.querySelectorAll('.equipment-shop-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderItems();
            });
        });

        this.renderItems();
    }

    renderItems() {
        const grid = document.getElementById('equipment-shop-grid');
        const gold = document.getElementById('shop-gold');
        if (!grid) return;

        if (gold) gold.textContent = gameProgress.gold;
        grid.innerHTML = '';

        getEquipmentItemsBySlot(this.selectedSlot).forEach(item => {
            const canBuy = gameProgress.gold >= item.price;
            const card = document.createElement('div');
            card.className = 'equipment-shop-card';
            card.innerHTML = `
                ${renderEquipmentIcon(item, 'large')}
                <div class="equipment-shop-info">
                    <h3>${esc(item.name)}</h3>
                    <p>${esc(item.description)}</p>
                    <div class="equipment-shop-stats">${renderStatLines(item.stats)}</div>
                    <div class="equipment-shop-owned">所持数: ${gameProgress.getEquipmentQuantity(item.id)}</div>
                </div>
                <button class="btn-primary equipment-buy-btn" ${canBuy ? '' : 'disabled'} data-item-id="${esc(item.id)}">
                    ${item.price} G
                </button>
            `;

            card.querySelector('.equipment-buy-btn')?.addEventListener('click', () => {
                const result = gameProgress.buyEquipment(item.id);
                if (!result.ok) {
                    alert(result.message);
                    return;
                }
                this.renderItems();
            });

            grid.appendChild(card);
        });
    }
}

class EquipmentScene {
    constructor(manager, initialUnitId = null) {
        this.manager = manager;
        this.units = gameProgress.getPlayerUnits();
        this.selectedUnitId = initialUnitId || this.units[0]?.id || null;
        this.selectedSlot = 'weapon';
    }

    createUI() {
        if (!this.manager.uiContainer) return;

        const equipment = document.createElement('div');
        equipment.className = 'scene-ui equipment-screen';
        equipment.innerHTML = `
            <div class="equipment-screen-shell">
                <div class="equipment-screen-header">
                    <div>
                        <h2>装備変更</h2>
                        <p>GOLD <strong id="equipment-screen-gold">${gameProgress.gold}</strong></p>
                    </div>
                    <div class="equipment-screen-actions">
                        <button class="btn-sub-action" id="btn-equipment-shop">購入</button>
                        <button class="btn-secondary" id="btn-back-org-from-equipment">編成へ戻る</button>
                    </div>
                </div>
                <div class="equipment-screen-body">
                    <div class="equipment-roster-panel">
                        <div class="equipment-panel-title">指揮官</div>
                        <div class="equipment-roster-list" id="equipment-roster-list"></div>
                    </div>
                    <div class="equipment-detail-panel" id="equipment-detail-panel"></div>
                </div>
            </div>
        `;

        this.manager.uiContainer.appendChild(equipment);

        document.getElementById('btn-back-org-from-equipment')?.addEventListener('click', () => {
            this.manager.transition(SCENES.ORGANIZATION);
        });

        document.getElementById('btn-equipment-shop')?.addEventListener('click', () => {
            this.manager.transition(SCENES.EQUIPMENT_SHOP);
        });

        this.render();
    }

    getSelectedUnit() {
        return this.units.find(unit => unit.id === this.selectedUnitId) || this.units[0] || null;
    }

    render() {
        this.renderRoster();
        this.renderDetail();
    }

    renderRoster() {
        const list = document.getElementById('equipment-roster-list');
        if (!list) return;

        list.innerHTML = '';
        this.units.forEach(unit => {
            const info = getUnitTypeInfo(unit.class || unit.type);
            const row = document.createElement('button');
            row.className = `equipment-roster-item ${unit.id === this.selectedUnitId ? 'active' : ''}`;
            row.innerHTML = `
                <div class="equipment-roster-marker">${esc(info?.marker || '?')}</div>
                <div class="equipment-roster-main">
                    <strong>${esc(unit.name)}</strong>
                    <span>${esc(info?.name || unit.class || unit.type)} / Lv.${esc(unit.level || 1)}</span>
                    <div class="card-equipment-icons">${renderEquipmentMiniIcons(unit)}</div>
                </div>
            `;
            row.addEventListener('click', () => {
                this.selectedUnitId = unit.id;
                this.render();
            });
            list.appendChild(row);
        });
    }

    renderDetail() {
        const panel = document.getElementById('equipment-detail-panel');
        const unit = this.getSelectedUnit();
        if (!panel || !unit) return;

        unit.equipment = normalizeEquipment(unit.equipment);
        const typeInfo = getUnitTypeInfo(unit.class || unit.type);
        const bonus = getEquipmentStatBonus(unit.equipment);

        panel.innerHTML = `
            <div class="equipment-unit-summary">
                <div>
                    <h3>${esc(unit.name)}</h3>
                    <p>${esc(typeInfo?.name || unit.class || unit.type)} / Lv.${esc(unit.level || 1)}</p>
                </div>
                <div class="equipment-total-bonus">
                    <label>装備補正</label>
                    <div class="equipment-stat-lines">${renderStatLines(bonus)}</div>
                </div>
            </div>
            <div class="equipment-current-layout">
                <div class="equipment-slot-grid">
                    ${EQUIPMENT_SLOT_ORDER.map(slot => {
                        const item = getEquipmentItem(unit.equipment[slot]);
                        return `
                            <button class="equipment-slot-btn ${slot === this.selectedSlot ? 'active' : ''}" data-slot="${slot}">
                                ${renderEquipmentIcon(item)}
                                <span>${esc(EQUIPMENT_SLOTS[slot].name)}</span>
                                <strong>${esc(item?.name || '未装備')}</strong>
                            </button>
                        `;
                    }).join('')}
                </div>
                <div class="equipment-screen-stats">
                    ${EQUIPMENT_STAT_KEYS.map(key => {
                        const base = Number(unit[key] ?? unit[key.toLowerCase()] ?? 0);
                        const add = bonus[key] || 0;
                        return `
                            <div class="equipment-screen-stat">
                                <span>${key}</span>
                                <strong>${base + add}</strong>
                                <em>${add ? `${add > 0 ? '+' : ''}${add}` : '+0'}</em>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="equipment-screen-choice">
                <div class="equipment-choice-header">
                    <div>
                        <span>${esc(EQUIPMENT_SLOTS[this.selectedSlot].name)}</span>
                        <strong>${esc(getEquipmentItem(unit.equipment[this.selectedSlot])?.name || '未装備')}</strong>
                    </div>
                    <button class="btn-secondary compact" id="equipment-screen-clear-btn">外す</button>
                </div>
                <div class="equipment-choice-list" id="equipment-screen-choice-list"></div>
            </div>
        `;

        panel.querySelectorAll('.equipment-slot-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedSlot = btn.dataset.slot;
                this.renderDetail();
            });
        });

        panel.querySelector('#equipment-screen-clear-btn')?.addEventListener('click', () => {
            gameProgress.equipUnit(unit.id, this.selectedSlot, null);
            this.render();
        });

        this.renderChoices(unit);
    }

    renderChoices(unit) {
        const list = document.getElementById('equipment-screen-choice-list');
        if (!list) return;

        const ownedItems = gameProgress.getOwnedEquipmentItems(this.selectedSlot);
        list.innerHTML = '';

        if (ownedItems.length === 0) {
            list.innerHTML = '<div class="equipment-empty">このスロットの装備品をまだ所持していません。購入画面で入手できます。</div>';
            return;
        }

        ownedItems.forEach(item => {
            const isCurrent = unit.equipment[this.selectedSlot] === item.id;
            const available = gameProgress.getEquipmentAvailableCount(item.id, unit.id);
            const canEquip = isCurrent || available > 0;
            const card = document.createElement('button');
            card.className = `equipment-choice-card ${isCurrent ? 'active' : ''}`;
            card.disabled = !canEquip;
            card.innerHTML = `
                ${renderEquipmentIcon(item)}
                <div class="equipment-choice-main">
                    <div class="equipment-choice-name">${esc(item.name)}</div>
                    <div class="equipment-choice-desc">${esc(item.description)}</div>
                    <div class="equipment-choice-stats">${renderStatLines(item.stats)}</div>
                </div>
                <div class="equipment-choice-stock">
                    <span>所持 ${gameProgress.getEquipmentQuantity(item.id)}</span>
                    <span>空き ${available}</span>
                </div>
            `;
            card.addEventListener('click', () => {
                const result = gameProgress.equipUnit(unit.id, this.selectedSlot, item.id);
                if (!result.ok) {
                    alert(result.message);
                    return;
                }
                this.render();
            });
            list.appendChild(card);
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
            const info = getUnitTypeInfo(u.class || u.type);
            return `
                            <div class="deploy-unit-item" data-unit-id="${esc(u.id)}">
                                <span class="unit-marker">${esc(info?.marker || '👤')}</span>
                                <span>${esc(u.name)}</span>
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
            <div class="deploy-confirm-overlay" id="deploy-confirm-overlay" style="display:none;">
                <div class="deploy-confirm-dialog">
                    <p class="deploy-confirm-message">戦闘を開始しますか？</p>
                    <div class="deploy-confirm-buttons">
                        <button class="btn-primary" id="btn-confirm-yes">はい</button>
                        <button class="btn-secondary" id="btn-confirm-no">いいえ</button>
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
            // 同ウィンドウ内の確認ダイアログを表示
            const overlay = document.getElementById('deploy-confirm-overlay');
            if (overlay) overlay.style.display = 'flex';
        });

        document.getElementById('btn-confirm-no')?.addEventListener('click', () => {
            const overlay = document.getElementById('deploy-confirm-overlay');
            if (overlay) overlay.style.display = 'none';
        });

        document.getElementById('btn-confirm-yes')?.addEventListener('click', () => {
            const overlay = document.getElementById('deploy-confirm-overlay');
            if (overlay) overlay.style.display = 'none';

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

            const mapW = (customMap && customMap.terrain) ? customMap.terrain.width : (stage ? stage.mapSize?.width : 30) || 30;
            const mapH = (customMap && customMap.terrain) ? customMap.terrain.height : (stage ? stage.mapSize?.height : 30) || 30;

            if (this.deploymentZones.length > 0) {
                // 配置可能エリアが指定されている場合
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

                        // 部隊全体（本陣+兵士）の配置マーカーを表示
                        const totalUnits = this.calculateTotalUnitsForSquadron(unit);
                        this.manager.game.renderingEngine.addSquadronDeploymentMarker(
                            zone.x, zone.y, totalUnits, MAP_W, MAP_H
                        );
                    }
                });
            } else {
                // 配置可能エリアが指定されていない場合（従来の自動配置）
                let zone = { x: 0, y: 20, width: 10, height: 10 };

                if (customMap && customMap.zones && customMap.zones.playerDeployment) {
                    zone = customMap.zones.playerDeployment;
                } else if (stage && stage.deploymentZone) {
                    zone = stage.deploymentZone;
                }

                let idx = 0;
                units.forEach(unit => {
                    const totalUnits = this.calculateTotalUnitsForSquadron(unit);
                    const squadRadius = Math.ceil(Math.sqrt(totalUnits));

                    // 部隊ごとに間隔を空けて配置
                    const col = idx % 3;
                    const row = Math.floor(idx / 3);
                    const offsetX = col * (squadRadius + 2);
                    const offsetY = row * (squadRadius + 2);

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

                    // 部隊全体（本陣+兵士）の配置マーカーを表示
                    this.manager.game.renderingEngine.addSquadronDeploymentMarker(
                        x, y, totalUnits, MAP_W, MAP_H
                    );

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

    /**
     * 部隊の総ユニット数を計算（本陣+兵士）
     * unit-manager.jsのcreateUnitsFromWarlordと同じロジック
     */
    calculateTotalUnitsForSquadron(unit) {
        const unitCount = unit.unitCount || 1;
        const soldiers = unitCount * SOLDIERS_PER_UNIT;
        return Math.ceil(soldiers / SOLDIERS_PER_UNIT);
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

                // 配置エリアの判定（本陣の位置が配置エリア内なら許可）
                const isValidZone = this.deploymentZones.some(z => z.x === x && z.y === y);
                if (!isValidZone) {
                    return;
                }

                // 既に配置されている部隊と重なるかチェック（本陣位置で判定）
                let occupiedUnitId = null;
                for (const [uid, pos] of this.placedUnits) {
                    if (pos.x === x && pos.y === y) {
                        occupiedUnitId = uid;
                        break;
                    }
                }

                // 既存のマーカーをクリアして再描画
                if (game.renderingEngine?.clearDeploymentMarkers) {
                    game.renderingEngine.clearDeploymentMarkers();
                }

                if (occupiedUnitId) {
                    // 部隊入れ替え
                    if (occupiedUnitId === this.selectedUnitId) return;

                    const prevPos = this.placedUnits.get(this.selectedUnitId);

                    if (prevPos) {
                        this.placedUnits.set(occupiedUnitId, prevPos);
                        this.updateUnitStatus(occupiedUnitId, prevPos);
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

                // 部隊全体の配置マーカーを再描画
                this.redeployAllMarkers();

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

    /**
     * すべての配置済み部隊のマーカーを再描画
     * （手動配置時の部隊全体表示用）
     */
    redeployAllMarkers() {
        if (!this.manager.game.renderingEngine?.clearDeploymentMarkers) return;

        const game = this.manager.game;
        const deployedUnits = gameProgress.getDeployedUnits();

        // マーカーをクリア
        game.renderingEngine.clearDeploymentMarkers();

        // 配置済み部隊ごとにマーカーを表示
        for (const [unitId, pos] of this.placedUnits) {
            const unit = deployedUnits.find(u => u.id === parseInt(unitId));
            if (!unit) continue;

            const totalUnits = this.calculateTotalUnitsForSquadron(unit);
            game.renderingEngine.addSquadronDeploymentMarker(
                pos.x, pos.y, totalUnits, MAP_W, MAP_H
            );
        }
    }

    removeManualPlacementHandler(game) {
        const canvas = game.renderingEngine?.canvas;
        if (canvas) {
            if (this._handlePointerDown) {
                canvas.removeEventListener('mousedown', this._handlePointerDown, { capture: true });
                this._handlePointerDown = null;
            }
            if (this._handlePointerUp) {
                canvas.removeEventListener('mouseup', this._handlePointerUp, { capture: true });
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
                    type: String(def.type || 'INFANTRY').toUpperCase(),
                    class: String(def.type || 'INFANTRY').toUpperCase(),
                    ATK: def.atk || 50,
                    DEF: def.def || 50,
                    AGI: 50,
                    VIT: 50, INT: 50, MND: 50, LUK: 50,
                    level: def.level || 1, exp: 0,
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
                    const uType = String(def.type || 'INFANTRY').toUpperCase();
                    unit.type = uType;
                    unit.class = uType;
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
                <button id="bgm-toggle" class="${this.manager.game.audioEngine.bgmEnabled ? 'active' : ''}" onclick="window.toggleBGM()">${this.manager.game.audioEngine.bgmEnabled ? '🔊' : '🔇'}</button>
                <button class="speed-btn" data-speed="1.0" onclick="window.setActionSpeed(1.0)">▶</button>
                <button class="speed-btn" data-speed="1.5" onclick="window.setActionSpeed(1.5)">▶▶</button>
                <button class="speed-btn" data-speed="2.0" onclick="window.setActionSpeed(2.0)">▶▶▶</button>
            </div>
            <div id="conversation-layer">
                <div id="dialogue-top" class="dialogue-box top">
                    <div class="dialogue-content">
                        <div class="dialogue-speaker">
                            <div class="speaker-img">
                                <span id="dialogue-top-img-placeholder"></span>
                                <img id="dialogue-top-img" src="" style="display:none;">
                            </div>
                            <div id="dialogue-top-name" class="speaker-name"></div>
                        </div>
                        <div id="dialogue-top-text" class="dialogue-text"></div>
                    </div>
                </div>
                <div id="dialogue-bottom" class="dialogue-box bottom">
                    <div class="dialogue-content">
                        <div class="dialogue-speaker">
                            <div class="speaker-img">
                                <span id="dialogue-bottom-img-placeholder"></span>
                                <img id="dialogue-bottom-img" src="" style="display:none;">
                            </div>
                            <div id="dialogue-bottom-name" class="speaker-name"></div>
                        </div>
                        <div id="dialogue-bottom-text" class="dialogue-text"></div>
                    </div>
                </div>
                <div class="click-prompt">▼ タップして次へ</div>
            </div>
        `;

        const game = this.manager.game;
        game.customMapData = this.manager.getGameData('customMapData');
        // startGame is now async (delegates to game/starter.js)
        await game.startGame('EAST');

        // Save pre-battle snapshot for EXP comparison
        gameProgress.snapshotPlayerUnits();
        gameProgress.setPlayerSide(game.playerSide);

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
                game.setActionSpeed(speed);
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

        window.toggleBGM = () => {
            try {
                game.toggleBGM();
            } catch (e) {
                console.error('toggleBGM error:', e);
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

        const isVictory = this.result === 'VICTORY';
        const title = isVictory ? '勝利' : '敗北';
        const color = isVictory ? '#ffd700' : '#888';

        // Get player units from battle and pre-battle snapshot
        const game = this.manager.game;
        const playerUnits = (game.units || []).filter(u =>
            u.side === game.playerSide && u.unitType === 'HEADQUARTERS'
        );
        const snapshot = gameProgress.getPreBattleSnapshot();

        // Build unit cards
        let cardsHtml = '';
        for (const unit of playerUnits) {
            const pre = snapshot.find(s => s.id === unit.sourceUnitId) || { level: 1, exp: 0 };
            const gainedExp = Math.max(0, (unit.exp || 0) - pre.exp);
            const leveledUp = (unit.level || 1) > pre.level;
            const lvUpBadge = leveledUp ? '<span class="lvup-badge">LvUP!</span>' : '';

            const statChanges = [];
            if (leveledUp) {
                for (const stat of ['ATK', 'DEF', 'AGI']) {
                    const diff = (unit[stat] || 50) - (pre[stat] || 50);
                    if (diff > 0) statChanges.push(`${stat}+${diff}`);
                }
            }
            const statHtml = statChanges.length > 0
                ? `<div class="stat-change">${statChanges.join(' ')}</div>` : '';

            cardsHtml += `
                <div class="result-unit-card">
                    ${lvUpBadge}
                    <div class="unit-name">${esc(unit.warlordName || unit.name)}</div>
                    <div class="unit-level">Lv.${pre.level} → Lv.${unit.level || pre.level}</div>
                    <div class="unit-exp">+${gainedExp} EXP</div>
                    ${statHtml}
                </div>
            `;
        }

        const resultDiv = document.createElement('div');
        resultDiv.className = 'scene-ui result-screen';

        resultDiv.innerHTML = `
            <div class="result-header" style="color:${color}">${title}</div>
            <div class="result-unit-grid">${cardsHtml || '<p style="color:#aaa">ユニット情報なし</p>'}</div>
            <button class="btn-primary" id="btn-next">${isVictory ? '次へ' : '戻る'}</button>
        `;

        this.manager.uiContainer.appendChild(resultDiv);

        document.getElementById('btn-next').addEventListener('click', () => {
            if (isVictory) {
                // Complete stage and persist EXP
                gameProgress.completeStageWithExp(
                    gameProgress.currentStage,
                    game.units
                );

                // Check for inter-stage event
                const eventKey = gameProgress.getStageTransitionKey();
                if (eventKey && STAGE_EVENTS[eventKey]) {
                    this.manager.transition(SCENES.EVENT, { eventKey });
                } else {
                    this.manager.transition(SCENES.WORLD_MAP);
                }
            } else {
                this.manager.transition(SCENES.WORLD_MAP);
            }
        });
    }
}

class EventScene {
    constructor(manager, eventKey) {
        this.manager = manager;
        this.eventKey = eventKey;
        this.dialogueIndex = 0;
        this.isAnimating = false;
    }

    createUI() {
        if (!this.manager.uiContainer) return;

        const eventData = STAGE_EVENTS[this.eventKey];
        if (!eventData || !eventData.dialogue) {
            this.manager.transition(SCENES.WORLD_MAP);
            return;
        }

        this.dialogue = eventData.dialogue;

        const div = document.createElement('div');
        div.className = 'scene-ui event-screen';

        // 戦闘中会話と同じDOM構造・CSSクラスを使用
        div.innerHTML = `
            <div id="conversation-layer" class="active">
                <div id="dialogue-top" class="dialogue-box top">
                    <div class="dialogue-content">
                        <div class="dialogue-speaker">
                            <div class="speaker-img">
                                <span id="dialogue-top-img-placeholder"></span>
                                <img id="dialogue-top-img" src="" style="display:none;">
                            </div>
                            <div id="dialogue-top-name" class="speaker-name"></div>
                        </div>
                        <div id="dialogue-top-text" class="dialogue-text"></div>
                    </div>
                </div>
                <div id="dialogue-bottom" class="dialogue-box bottom">
                    <div class="dialogue-content">
                        <div class="dialogue-speaker">
                            <div class="speaker-img">
                                <span id="dialogue-bottom-img-placeholder"></span>
                                <img id="dialogue-bottom-img" src="" style="display:none;">
                            </div>
                            <div id="dialogue-bottom-name" class="speaker-name"></div>
                        </div>
                        <div id="dialogue-bottom-text" class="dialogue-text"></div>
                    </div>
                </div>
                <div class="click-prompt" style="display:block;">▼ タップして次へ</div>
            </div>
        `;

        this.manager.uiContainer.appendChild(div);
        this.manager.uiContainer.style.pointerEvents = 'auto';

        // DOM参照を保持
        this.layer = document.getElementById('conversation-layer');
        this.topBox = document.getElementById('dialogue-top');
        this.topName = document.getElementById('dialogue-top-name');
        this.topText = document.getElementById('dialogue-top-text');
        this.topImg = document.getElementById('dialogue-top-img');
        this.topPlaceholder = document.getElementById('dialogue-top-img-placeholder');
        this.bottomBox = document.getElementById('dialogue-bottom');
        this.bottomName = document.getElementById('dialogue-bottom-name');
        this.bottomText = document.getElementById('dialogue-bottom-text');
        this.bottomImg = document.getElementById('dialogue-bottom-img');
        this.bottomPlaceholder = document.getElementById('dialogue-bottom-img-placeholder');

        this.layer.addEventListener('click', () => this.advance());

        this.showDialogue(0);
    }

    showDialogue(index) {
        if (index >= this.dialogue.length) {
            this.manager.transition(SCENES.WORLD_MAP);
            return;
        }

        const diag = this.dialogue[index];
        this.isAnimating = true;

        // 話者側のボックスを再表示アニメーション
        if (diag.position === 'top') {
            this.topBox.classList.remove('show');
        } else {
            this.bottomBox.classList.remove('show');
        }

        setTimeout(() => {
            if (diag.position === 'top') {
                this.topName.innerText = diag.speaker || '';
                this.topText.innerText = '';
                this._typeWrite(this.topText, diag.text || '', () => { this.isAnimating = false; });
                if (diag.portrait) {
                    this.topImg.src = diag.portrait;
                    this.topImg.style.display = 'block';
                    this.topPlaceholder.style.display = 'none';
                } else {
                    this.topImg.style.display = 'none';
                    this.topPlaceholder.style.display = 'flex';
                    this.topPlaceholder.innerText = (diag.speaker || '?').charAt(0);
                }
                this.topBox.classList.add('show');
            } else {
                this.bottomName.innerText = diag.speaker || '';
                this.bottomText.innerText = '';
                this._typeWrite(this.bottomText, diag.text || '', () => { this.isAnimating = false; });
                if (diag.portrait) {
                    this.bottomImg.src = diag.portrait;
                    this.bottomImg.style.display = 'block';
                    this.bottomPlaceholder.style.display = 'none';
                } else {
                    this.bottomImg.style.display = 'none';
                    this.bottomPlaceholder.style.display = 'flex';
                    this.bottomPlaceholder.innerText = (diag.speaker || '?').charAt(0);
                }
                this.bottomBox.classList.add('show');
            }
        }, 150);
    }

    _typeWrite(el, text, onComplete) {
        let i = 0;
        if (this._typeInterval) clearInterval(this._typeInterval);
        this._typeInterval = setInterval(() => {
            if (i < text.length) {
                el.textContent += text[i];
                i++;
            } else {
                clearInterval(this._typeInterval);
                this._typeInterval = null;
                if (onComplete) onComplete();
            }
        }, 30);
    }

    advance() {
        if (this.isAnimating) {
            // アニメーションスキップ：全文表示
            if (this._typeInterval) {
                clearInterval(this._typeInterval);
                this._typeInterval = null;
            }
            const diag = this.dialogue[this.dialogueIndex];
            if (diag) {
                const el = diag.position === 'top' ? this.topText : this.bottomText;
                if (el) el.textContent = diag.text || '';
            }
            this.isAnimating = false;
            return;
        }

        this.dialogueIndex++;
        this.showDialogue(this.dialogueIndex);
    }

    cleanup() {
        if (this._typeInterval) clearInterval(this._typeInterval);
    }
}

class WorldMapScene {
    constructor(manager) {
        this.manager = manager;
        this.selectedStageId = null;
    }

    createUI() {
        if (!this.manager.uiContainer) return;

        this.manager.uiContainer.style.pointerEvents = 'auto';

        const allStages = gameProgress.getAllStages();

        // Position nodes horizontally
        const nodePositions = [
            { x: 50, y: 150 },   // tutorial
            { x: 230, y: 150 },  // castle
            { x: 410, y: 150 },  // mountain
        ];

        let nodesHtml = '';
        let connectorsHtml = '';

        allStages.forEach((stage, i) => {
            const pos = nodePositions[i] || { x: 50 + i * 180, y: 150 };
            let stateClass = 'locked';
            let statusText = '未開放';

            if (stage.completed) {
                stateClass = 'completed';
                statusText = 'クリア済';
            } else if (stage.unlocked) {
                stateClass = 'available';
                statusText = '出撃可能';
            }

            nodesHtml += `
                <div class="stage-node ${stateClass}" data-stage-id="${esc(stage.id)}"
                     style="left:${pos.x}px; top:${pos.y}px;">
                    <div class="node-name">${esc(stage.name)}</div>
                    <div class="node-status">${esc(statusText)}</div>
                </div>
            `;

            if (i > 0) {
                const prevPos = nodePositions[i - 1];
                const connLeft = prevPos.x + 140;
                const connWidth = pos.x - connLeft;
                connectorsHtml += `<div class="stage-connector" style="left:${connLeft}px; width:${connWidth}px; top:${prevPos.y + 30}px;"></div>`;
            }
        });

        const div = document.createElement('div');
        div.className = 'scene-ui world-map-screen';

        div.innerHTML = `
            <div class="world-map-title">ワールドマップ</div>
            <div class="world-map-container">
                ${connectorsHtml}
                ${nodesHtml}
            </div>
            <div class="world-map-buttons">
                <button class="btn-secondary" id="btn-wm-back">タイトル</button>
                <button class="btn-primary" id="btn-wm-go" disabled>出陣準備へ</button>
            </div>
        `;

        this.manager.uiContainer.appendChild(div);

        // Node click handlers
        div.querySelectorAll('.stage-node.available').forEach(node => {
            node.addEventListener('click', () => {
                div.querySelectorAll('.stage-node').forEach(n => n.style.outline = 'none');
                node.style.outline = '3px solid #ffd700';
                this.selectedStageId = node.dataset.stageId;
                document.getElementById('btn-wm-go').disabled = false;
            });
        });

        document.getElementById('btn-wm-back').addEventListener('click', () => {
            this.manager.transition(SCENES.TITLE);
        });

        document.getElementById('btn-wm-go').addEventListener('click', async () => {
            if (!this.selectedStageId) return;

            gameProgress.currentStage = this.selectedStageId;

            // Load stage data
            const stageConfig = STAGES[this.selectedStageId];
            if (stageConfig && stageConfig.stageFile) {
                try {
                    const response = await fetch(`./scripts/data/stages/${stageConfig.stageFile}`);
                    if (response.ok) {
                        const fullMapData = await response.json();
                        this.manager.setGameData('customMapData', fullMapData);
                    } else {
                        this.manager.setGameData('customMapData', null);
                    }
                } catch (e) {
                    console.error('[WorldMapScene] Error loading stage:', e);
                    this.manager.setGameData('customMapData', null);
                }
            } else {
                this.manager.setGameData('customMapData', null);
            }

            this.manager.transition(SCENES.ORGANIZATION);
        });
    }
}
