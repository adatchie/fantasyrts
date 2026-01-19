
import { STAGES, gameProgress } from './game-data.js';
import { getUnitTypeInfo, UNIT_TYPES } from './constants.js?v=11';
import { mapRepository } from './map-repository.js'; // マップリポジトリ読み込み

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
        console.log(`Transitioning to ${sceneName}`, params);

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
                console.error('Unknown scene:', sceneName);
        }

        if (this.sceneInstance) {
            this.sceneInstance.createUI();
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
        if (!this.manager.uiContainer) return;

        // レガシーなスタート画面を隠す
        const legacyStart = document.getElementById('start-screen');
        if (legacyStart) legacyStart.style.display = 'none';

        const title = document.createElement('div');
        title.className = 'scene-ui title-screen';

        title.innerHTML = `
            <div class="title-bg">
                <h1 class="title-text">関ヶ原の戦い</h1>
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

        // 【修正】カスタムマップリストを確実に最新化
        if (mapRepository) {
            mapRepository.loadFromStorage();
        }
        const customMaps = mapRepository ? mapRepository.list() : [];
        console.log(`[MapSelectScene] Loaded ${customMaps.length} custom maps.`);

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
                    // カスタムマップデータをクリア
                    this.manager.setGameData('customMapData', null);
                } else {
                    // カスタムマップIDを設定（gameProgressはシナリオ進行用なので、別途Managerで持つ）
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
    }

    createUI() {
        if (!this.manager.uiContainer) return;

        const stageId = gameProgress.currentStage;
        const stage = STAGES[stageId];
        const customMap = this.manager.getGameData('customMapData');
        const deployedUnits = gameProgress.getDeployedUnits();

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
            this.manager.transition(SCENES.ORGANIZATION);
        });

        document.getElementById('btn-start-battle')?.addEventListener('click', () => {
            if (this.placedUnits.size === deployedUnits.length) {
                // ゲームデータに配置情報を保存
                this.manager.setGameData('unitPlacements', Array.from(this.placedUnits.entries()));
                this.manager.transition(SCENES.BATTLE);
            }
        });
    }

    autoPlaceUnits(units, stage, customMap) {
        try {
            // 【修正】ゾーン決定優先順位: カスタムマップ > ステージ定義 > デフォルト
            let zone = { x: 0, y: 20, width: 10, height: 10 }; // Default

            if (customMap && customMap.zones && customMap.zones.playerDeployment) {
                zone = customMap.zones.playerDeployment;
            } else if (stage && stage.deploymentZone) {
                zone = stage.deploymentZone;
            }

            // 【修正】マップサイズ取得（境界チェック用）
            const mapW = customMap ? customMap.terrain.width : (stage ? stage.mapSize.width : 30);
            const mapH = customMap ? customMap.terrain.height : (stage ? stage.mapSize.height : 30);

            let idx = 0;

            // DOM要素を事前にキャッシュ（高速化）
            const itemMap = new Map();
            document.querySelectorAll('.deploy-unit-item').forEach(item => {
                const id = item.dataset.unitId;  // 文字列のまま保持
                itemMap.set(id, item);
            });

            units.forEach(unit => {
                const col = idx % 4;
                const row = Math.floor(idx / 4);

                // ゾーン内に収まるように計算 (4列)
                const offsetX = col * 2 + 1;
                const offsetY = row * 2 + 1;

                let x = zone.x + offsetX;
                let y = zone.y + offsetY;

                // 【修正】境界チェック (Out of bounds対策)
                if (x >= mapW) x = mapW - 1;
                if (y >= mapH) y = mapH - 1;
                if (x < 0) x = 0;
                if (y < 0) y = 0;

                this.placedUnits.set(unit.id, { x, y });

                // UI更新
                const item = itemMap.get(String(unit.id));  // 文字列に変換
                if (item) {
                    item.classList.add('placed');
                    const statusEl = item.querySelector('.place-status');
                    if (statusEl) statusEl.textContent = `(${x}, ${y})`;
                }

                idx++;
            });

            // カウント更新
            const countEl = document.getElementById('placed-count');
            if (countEl) countEl.textContent = this.placedUnits.size.toString();

            // バトル開始ボタン有効化
            if (this.placedUnits.size === units.length) {
                const btn = document.getElementById('btn-start-battle');
                if (btn) btn.disabled = false;
            }

            console.log(`Auto-placed ${this.placedUnits.size} units.`);
        } catch (e) {
            console.error("Auto place error:", e);
            alert("自動配置中にエラーが発生しました。");
        }
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
            <button id="action-btn" onclick="commitTurn()">全軍 行動開始</button>
            <div style="position:absolute; bottom:10px; left:10px; font-size:12px; color:#888; font-family:sans-serif;">
                [左ドラッグ] 範囲選択 | [右ドラッグ] マップ移動 | [左クリック] 指示/確認
            </div>
            <div id="context-menu" style="display:none;">
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
        this.manager.uiContainer.style.pointerEvents = 'none'; // クリック透過（各要素はpointer-events: auto）

        // Gameクラスの開始メソッドを呼ぶ
        const game = this.manager.game;
        // カスタムマップデータがあれば渡す
        game.customMapData = this.manager.getGameData('customMapData');

        // プレイヤーサイドは仮でEAST
        game.startGame('EAST');
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
