
import { STAGES, gameProgress } from './game-data.js';
import { getUnitTypeInfo, UNIT_TYPES } from './constants.js?v=11';
import { mapRepository } from './map-repository.js?v=2'; // マップリポジトリ読み込み

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
    }

    transition(sceneName, params = {}) {
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
                this.sceneInstance.createUI();
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
            mapRepository.loadFromStorage();
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
                    ${stages.map((s, i) => `
                        <div class="map-item" data-id="${i}">
                            <h3>${s.name}</h3>
                            <p>${s.description}</p>
                        </div>
                    `).join('')}
                </div>
                <div class="map-list" id="list-custom" style="display:none;">
                    ${customMaps.length === 0 ? '<p>作成されたマップがありません</p>' :
                customMaps.map(m => `
                            <div class="map-item custom-map" data-id="${m.id}">
                                <h3>${m.name}</h3>
                                <p>サイズ: ${m.terrain?.width || 30}x${m.terrain?.height || 30}</p>
                            </div>
                        `).join('')}
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
        this.maxDeployment = 8; // 最大出撃数
    }

    createUI() {
        if (!this.manager.uiContainer) return;

        const allUnits = gameProgress.getPlayerUnits();
        const deployedIds = gameProgress.deployedUnitIds;
        const stageId = gameProgress.currentStage || 'tutorial';
        const stageName = STAGES[stageId]?.name || 'カスタムマップ';

        const org = document.createElement('div');
        org.className = 'scene-ui organization-screen';
        org.innerHTML = `
            <div class="org-layout">
                <div class="org-sidebar">
                    <h2>部隊編成</h2>
                    <p class="stage-name">📍 ${stageName}</p>
                    <div class="org-buttons">
                        <button class="btn-secondary" id="btn-back-map">戻る</button>
                        <button class="btn-primary" id="btn-to-deploy">出陣へ</button>
                    </div>
                </div>
                <div class="org-main">
                    <div class="org-columns">
                        <div class="unit-pool">
                            <h3>待機ユニット</h3>
                            <div id="pool-list" class="unit-grid"></div>
                        </div>
                        <div class="army-slots">
                            <h3>出撃部隊 (<span id="deployed-count">0</span>/${this.maxDeployment})</h3>
                            <div id="deployed-list" class="unit-list"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.manager.uiContainer.appendChild(org);
        this.renderLists();

        document.getElementById('btn-back-map').addEventListener('click', () => {
            this.manager.transition(SCENES.MAP_SELECT);
        });

        document.getElementById('btn-to-deploy').addEventListener('click', () => {
            if (gameProgress.deployedUnitIds.length > 0) {
                this.manager.transition(SCENES.DEPLOYMENT);
            } else {
                alert('出撃ユニットを選択してください');
            }
        });
    }

    renderLists() {
        const poolList = document.getElementById('pool-list');
        const deployedList = document.getElementById('deployed-list');
        const countSpan = document.getElementById('deployed-count');

        if (!poolList || !deployedList) return;

        poolList.innerHTML = '';
        deployedList.innerHTML = '';

        const allUnits = gameProgress.getPlayerUnits();
        const deployedIds = gameProgress.deployedUnitIds;

        countSpan.textContent = deployedIds.length;

        allUnits.forEach(unit => {
            const isDeployed = deployedIds.includes(unit.id);
            const info = getUnitTypeInfo(unit.type);

            const el = document.createElement('div');
            el.className = 'org-unit-card';
            if (isDeployed) el.classList.add('selected');

            el.innerHTML = `
                <span class="unit-marker">${info?.marker || '👤'}</span>
                <div class="unit-details">
                    <strong>${unit.name}</strong>
                    <span class="unit-type">${info?.name || unit.type} Lv.${unit.level}</span>
                </div>
            `;

            el.addEventListener('click', () => {
                this.toggleDeployment(unit.id);
            });

            if (isDeployed) {
                deployedList.appendChild(el);
            } else {
                poolList.appendChild(el);
            }
        });
    }

    toggleDeployment(unitId) {
        if (gameProgress.deployedUnitIds.includes(unitId)) {
            // 外す
            gameProgress.undeployUnit(unitId);
        } else {
            // 加える
            if (gameProgress.deployedUnitIds.length < this.maxDeployment) {
                gameProgress.deployUnit(unitId);
            } else {
                alert('最大出撃数に達しています');
                return;
            }
        }
        this.renderLists();
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
        // 修正: playerDeploymentZones (配列) を優先
        this.deploymentZones = [];

        // 1. playerDeploymentZones (配列形式) を優先 - マップエディタで設定した座標
        if (customMap && customMap.playerDeploymentZones && customMap.playerDeploymentZones.length > 0) {
            this.deploymentZones = customMap.playerDeploymentZones;
        }
        // 2. zones.playerDeployment (矩形) へのフォールバック
        else if (customMap && customMap.zones && customMap.zones.playerDeployment) {
            const rect = customMap.zones.playerDeployment;
            for (let y = rect.y; y < rect.y + rect.height; y++) {
                for (let x = rect.x; x < rect.x + rect.width; x++) {
                    if (x >= 0 && x < customMap.terrain.width && y >= 0 && y < customMap.terrain.height) {
                        this.deploymentZones.push({ x, y });
                    }
                }
            }
        }

        // 先にマップと建物を表示（3Dレンダリング更新して高さデータを確定させる）
        if (customMap && this.manager.game.renderingEngine) {
            this.manager.game.renderingEngine.buildTerrainFromMapData(customMap);
            // 敵ユニットのプレビュー表示
            this.spawnPreviewUnits(customMap);
            // 配置可能エリアをハイライト表示
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
            // ハイライト解除
            if (this.manager.game.renderingEngine?.clearDeploymentHighlight) {
                this.manager.game.renderingEngine.clearDeploymentHighlight();
            }
            this.manager.transition(SCENES.ORGANIZATION);
        });

        document.getElementById('btn-start-battle')?.addEventListener('click', () => {
            // 確認ダイアログ
            if (confirm('戦闘を開始しますか？')) {
                if (this.placedUnits.size === deployedUnits.length) {
                    // ハイライト解除
                    if (this.manager.game.renderingEngine?.clearDeploymentHighlight) {
                        this.manager.game.renderingEngine.clearDeploymentHighlight();
                    }
                    // ゲームデータに配置情報を保存
                    this.manager.setGameData('unitPlacements', Array.from(this.placedUnits.entries()));
                    this.manager.transition(SCENES.BATTLE);
                }
            }
        });

        // ユニット選択イベント
        document.querySelectorAll('.deploy-unit-item').forEach(item => {
            item.addEventListener('click', () => {
                const unitId = item.dataset.unitId;
                this.selectUnit(unitId);
            });
        });

        // 手動配置用のポインターハンドラーをセットアップ
        this.setupManualPlacement(this.manager.game);
    }



    autoPlaceUnits(units, stage, customMap) {
        try {
            // 配置マーカーをクリア
            if (this.manager.game.renderingEngine?.clearDeploymentMarkers) {
                this.manager.game.renderingEngine.clearDeploymentMarkers();
            }

            // 既存の配置をクリア
            this.placedUnits.clear();

            // 配置座標がある場合はそこに配置
            if (this.deploymentZones.length > 0) {
                units.forEach((unit, idx) => {
                    if (idx < this.deploymentZones.length) {
                        const zone = this.deploymentZones[idx];
                        this.placedUnits.set(unit.id, { x: zone.x, y: zone.y });

                        // UI更新
                        const item = document.querySelector(`.deploy-unit-item[data-unit-id="${unit.id}"]`);
                        if (item) {
                            item.classList.remove('selecting');
                            item.classList.add('placed');
                            const statusEl = item.querySelector('.place-status');
                            if (statusEl) statusEl.textContent = `(${zone.x}, ${zone.y})`;
                        }

                        // マーカーを表示
                        this.manager.game.renderingEngine.addDeploymentMarker(zone.x, zone.y);
                    }
                });
            } else {
                // フォールバック: デフォルトゾーンを使用
                let zone = { x: 0, y: 20, width: 10, height: 10 };

                if (customMap && customMap.zones && customMap.zones.playerDeployment) {
                    zone = customMap.zones.playerDeployment;
                } else if (stage && stage.deploymentZone) {
                    zone = stage.deploymentZone;
                }

                const mapW = customMap ? customMap.terrain.width : (stage ? stage.mapSize?.width : 30) || 30;
                const mapH = customMap ? customMap.terrain.height : (stage ? stage.mapSize?.height : 30) || 30;

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

                    // マーカーを表示
                    this.manager.game.renderingEngine.addDeploymentMarker(x, y);

                    idx++;
                });
            }

            // カウント更新
            const countEl = document.getElementById('placed-count');
            if (countEl) countEl.textContent = this.placedUnits.size.toString();

            // バトル開始ボタン有効化
            if (this.placedUnits.size === units.length) {
                const btn = document.getElementById('btn-start-battle');
                if (btn) btn.disabled = false;
            }

            // 選択解除
            this.selectedUnitId = null;
            document.querySelectorAll('.deploy-unit-item').forEach(item => {
                item.classList.remove('selecting');
            });
        } catch (e) {
            alert("自動配置中にエラーが発生しました。");
        }
    }
    selectUnit(unitId) {
        this.selectedUnitId = unitId;

        // UI更新：選択中のユニットをハイライト
        document.querySelectorAll('.deploy-unit-item').forEach(item => {
            item.classList.remove('selecting');
            if (item.dataset.unitId === unitId) {
                item.classList.add('selecting');
            }
        });
    }

    // 手動配置：マップクリック時の処理
    setupManualPlacement(game) {
        const canvas = game.renderingEngine?.canvas;
        if (!canvas) return;

        // デプロイメントシーン中であることを示すフラグを設定
        game.isDeploymentMode = true;

        const handlePointerDown = (event) => {
            // UI要素（ボタンなど）へのクリックは無視
            if (event.target !== canvas && event.target.id !== 'gameCanvas') {
                return;
            }

            if (!this.selectedUnitId) return;

            // イベントの伝播を停止してmain.jsのハンドラーを実行しないようにする
            event.stopPropagation();
            event.stopImmediatePropagation();

            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // レイキャスティングでグリッド座標を取得（canvas要素も渡す）
            const gridPos = game.renderingEngine.screenToGrid(mouseX, mouseY, rect.width, rect.height, canvas);
            if (!gridPos) return;

            const { x, y } = gridPos;

            // 配置可能エリア内かチェック
            const isValidZone = this.deploymentZones.some(z => z.x === x && z.y === y);
            if (!isValidZone) {
                return;
            }

            // 既に配置されている場合は除外
            for (const [uid, pos] of this.placedUnits) {
                if (pos.x === x && pos.y === y) {
                    return;
                }
            }

            // 配置を実行
            this.placedUnits.set(this.selectedUnitId, { x, y });

            // UI更新
            const item = document.querySelector(`.deploy-unit-item[data-unit-id="${this.selectedUnitId}"]`);
            if (item) {
                item.classList.remove('selecting');
                item.classList.add('placed');
                const statusEl = item.querySelector('.place-status');
                if (statusEl) statusEl.textContent = `(${x}, ${y})`;
            }

            // カウント更新
            const countEl = document.getElementById('placed-count');
            if (countEl) countEl.textContent = this.placedUnits.size.toString();

            // 全員配置完了チェック
            const deployedUnits = gameProgress.getDeployedUnits();
            if (this.placedUnits.size === deployedUnits.length) {
                const btn = document.getElementById('btn-start-battle');
                if (btn) btn.disabled = false;
            }

            // 配置完了したら選択解除
            this.selectedUnitId = null;
            document.querySelectorAll('.deploy-unit-item').forEach(item => {
                item.classList.remove('selecting');
            });

            // 配置位置にマーカーを表示
            game.renderingEngine.addDeploymentMarker(x, y);
        };

        const handlePointerUp = (event) => {
            if (event.target === canvas || event.target.id === 'gameCanvas') {
                if (this.selectedUnitId) {
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                }
            }
        };

        // イベントリスナーを登録（重複回避のため一度解除）
        if (this._handlePointerDown) canvas.removeEventListener('mousedown', this._handlePointerDown);
        if (this._handlePointerUp) canvas.removeEventListener('mouseup', this._handlePointerUp);

        this._handlePointerDown = handlePointerDown;
        this._handlePointerUp = handlePointerUp;

        // mousedownイベントを使用（captureフェーズでキャプチャして先に処理）
        canvas.addEventListener('mousedown', this._handlePointerDown, { capture: true });
        canvas.addEventListener('mouseup', this._handlePointerUp, { capture: true });
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
        // デプロイメントモードフラグをリセット
        if (game) game.isDeploymentMode = false;
    }


    spawnPreviewUnits(customMap) {
        const game = this.manager.game;
        if (!game || !game.unitManager) return;

        // 既存ユニットをクリア
        game.units = [];

        // 敵ユニットデータの読み込み
        if (customMap && customMap.units && customMap.unitDefinitions) {
            // プレイヤーサイドの反対を敵とする
            // 注意: DeploymentSceneではplayerSideが未確定かもしれないが、デフォルトはEASTとする
            const playerSide = 'EAST';
            const enemySide = 'WEST';

            customMap.units.forEach((placedUnit, idx) => {
                const def = customMap.unitDefinitions.find(d => d.id === placedUnit.defId);
                if (!def) return;

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
                    // プレビュー用に動かないようにする設定などは不要（GameStateが動かなければ動かない）
                });

                game.units.push(...generatedUnits);
            });

            // 描画更新
            if (game.renderingEngine && game.renderingEngine.drawUnits) {
                // window.gameStateを更新してレンダラーに認識させる
                window.gameState = { units: game.units };
                game.renderingEngine.drawUnits();
            }
        }
    }

    cleanup() {
        // シーン離脱時にハイライト解除
        if (this.manager.game.renderingEngine?.clearDeploymentHighlight) {
            this.manager.game.renderingEngine.clearDeploymentHighlight();
        }
        // 配置マーカーもクリア
        if (this.manager.game.renderingEngine?.clearDeploymentMarkers) {
            this.manager.game.renderingEngine.clearDeploymentMarkers();
        }
        // 手動配置ハンドラーを削除
        this.removeManualPlacementHandler(this.manager.game);
    }
}

class BattleScene {
    constructor(manager) {
        this.manager = manager;
    }

    createUI() {
        if (!this.manager.uiContainer) return;

        // バトル画面UIの再構築
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
                <button class="ctx-btn" style="color:darkred" onclick="issueCommand('ATTACK')">突撃</button>
                <button class="ctx-btn" style="color:darkgreen" onclick="issueCommand('PLOT')">調略</button>
                <button class="ctx-btn" onclick="closeCtx()">取消</button>
            </div>
            <div id="formation-panel" class="hud-panel" style="display:none;">
                <div class="formation-title">陣形選択</div>
                <div id="formation-buttons"></div>
                <div id="formation-tooltip"></div>
            </div>
            <div id="speed-control">
                <button class="speed-btn" data-speed="1.0" onclick="setActionSpeed(1.0)">▶</button>
                <button class="speed-btn" data-speed="1.5" onclick="setActionSpeed(1.5)">▶▶</button>
                <button class="speed-btn" data-speed="2.0" onclick="setActionSpeed(2.0)">▶▶▶</button>
            </div>
        `;

        // Gameクラスの開始メソッドを呼ぶ
        const game = this.manager.game;
        // カスタムマップデータがあれば渡す
        game.customMapData = this.manager.getGameData('customMapData');

        // プレイヤーサイドは仮でEAST
        game.startGame('EAST');

        // グローバル関数を定義（UIのonclickから呼べるように）
        window.game = game;
        window.commitTurn = () => {
            try {
                game.commitTurn();
            } catch (e) {
                // commitTurn failed
            }
        };
        window.issueCommand = (type) => {
            try {
                game.issueCommand(type);
            } catch (e) {
                // issueCommand failed
            }
        };
        window.closeCtx = () => {
            try {
                const ctxMenu = document.getElementById('context-menu');
                if (ctxMenu) ctxMenu.style.display = 'none';
            } catch (e) {
                // closeCtx failed
            }
        };

        // アクションボタンを表示してイベントリスナー設定
        const actionBtn = document.getElementById('action-btn');
        if (actionBtn) {
            actionBtn.style.display = 'block';
            actionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    game.commitTurn();
                } catch (err) {
                    // commitTurn error
                }
            });
        }

        window.setActionSpeed = (speed) => {
            try {
                game.actionSpeed = speed;
                // ボタンのアクティブ状態を更新
                document.querySelectorAll('.speed-btn').forEach(btn => {
                    const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
                    if (btnSpeed === speed) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            } catch (e) {
                // setActionSpeed failed
            }
        };

        // スピードボタンのイベントも設定
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const speed = parseFloat(btn.dataset.speed);
                try {
                    game.actionSpeed = speed;
                    // ボタンのアクティブ状態を更新
                    document.querySelectorAll('.speed-btn').forEach(b => {
                        if (b === btn) {
                            b.classList.add('active');
                        } else {
                            b.classList.remove('active');
                        }
                    });
                } catch (err) {
                    // setActionSpeed error
                }
            });
        });

        // 初期状態: 1.0ボタンをアクティブに
        const defaultSpeedBtn = document.querySelector('.speed-btn[data-speed="1.0"]');
        if (defaultSpeedBtn) {
            defaultSpeedBtn.classList.add('active');
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

        this.manager.uiContainer.style.pointerEvents = 'auto'; // クリック有効化

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
            // リロードして初期状態に戻すのが一番安全
            location.reload();
        });
    }
}
