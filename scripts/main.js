/**
 * SEKIGAHARA RTS - Main Game Loop
 * メインゲームロジックとループ
 */

import { HEX_SIZE, C_EAST, C_WEST, C_SEL_BOX, C_SEL_BORDER, WARLORDS, UNIT_TYPE_HEADQUARTERS, FORMATION_HOKO, FORMATION_KAKUYOKU, FORMATION_GYORIN } from './constants.js?v=10';
import * as THREE from 'three';
import { AudioEngine } from './audio.js';
import { MapSystem } from './map.js?v=3';
import { RenderingEngine3D } from './rendering3d.js?v=58';
import { generatePortrait } from './rendering.js?v=2';
import { CombatSystem } from './combat.js?v=25';
import { AISystem } from './ai.js';
import { UnitManager } from './unit-manager.js?v=4';
import { hexToPixel, pixelToHex, isValidHex, getDistRaw, getReachableTiles, estimateTurns } from './pathfinding.js';
import { FORMATION_INFO, getAvailableFormations } from './formation.js?v=4';
import { BuildingSystem } from './building.js?v=17';
import { BuildingEditor } from './editor/building-editor.js';
import { StageLoader } from './stage-loader.js';

// Main Game Logic
console.log("Main JS Version: 25 Loaded (Debug)");

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


        // Placement State
        this.placementData = null;
        this.placementGhost = null;
        this.placementRotation = 0; // 0,1,2,3 (90度刻み)
    }

    init() {
        this.canvas = document.getElementById('gameCanvas');
        // 2Dコンテキストは不要になる
        // this.ctx = this.canvas.getContext('2d');

        // 3Dレンダラーに切り替え
        this.renderingEngine = new RenderingEngine3D(this.canvas);
        this.renderingEngine.setMapSystem(this.mapSystem); // MapSystemを渡す
        this.combatSystem = new CombatSystem(this.audioEngine);
        this.combatSystem.setRenderingEngine(this.renderingEngine);
        this.combatSystem.setMapSystem(this.mapSystem);

        // 建物システム初期化（レンダリングエンジンへの参照を渡す）
        this.buildingSystem = new BuildingSystem(this.renderingEngine.scene, this.renderingEngine);

        // ステージローダー初期化
        this.stageLoader = new StageLoader(this);

        // 建物エディタ（Architect Mode）
        this.buildingEditor = new BuildingEditor(this);

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        window.addEventListener('keydown', (e) => this.onKeyDown(e));

        // タッチ操作のリスナーを追加
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false, capture: true });
        // touchmoveとtouchendはwindowで受けて、ドラッグが画面外に出ても追跡できるようにする
        window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });

        // 選択ボックス用要素を作成
        this.selectionBox = document.createElement('div');
        this.selectionBox.style.position = 'absolute';
        this.selectionBox.style.border = '1px solid #00FF00';
        this.selectionBox.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
        this.selectionBox.style.display = 'none';
        this.selectionBox.style.pointerEvents = 'none'; // クリックを透過
        this.selectionBox.style.zIndex = '1000';
        document.body.appendChild(this.selectionBox);

        requestAnimationFrame(() => this.loop());
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
        this.combatSystem.setPlayerSide(side); // CombatSystemにplayerSideを設定
        document.getElementById('start-screen').style.display = 'none';

        // マップ生成
        const map = this.mapSystem.generateMap();

        // マルチユニット初期化: 各武将から複数ユニットを生成
        WARLORDS.forEach((warlord, warlordId) => {
            this.unitManager.createUnitsFromWarlord(warlord, warlordId, WARLORDS, this.mapSystem);
        });

        // 3Dレンダラーのマップ情報を更新（高さキャッシュの再計算）
        if (this.renderingEngine) {
            this.renderingEngine.createIsometricTiles();
        }

        // 全ユニットを取得
        this.units = this.unitManager.getAllUnits();

        console.log(`Total units created: ${this.units.length}`);
        console.log(`Warlords: ${WARLORDS.length}`);

        // gameStateをwindowに公開（3Dレンダリング用）
        window.gameState = { units: this.units };

        // 調略フラグを初期化（武将単位で管理）
        this.warlordPlotUsed = {}; // warlordId -> boolean

        // CombatSystemにunitManagerを設定（陣形チェック用）
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

        // テスト: 建物を配置（グリッド座標を指定するだけで高さは自動計算）
        if (this.buildingSystem) {
            this.buildingSystem.placeBuildingAtGrid('house_small', 35, 35);
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
            const order = this.aiSystem.decideAction(cpu, this.units, this.mapSystem.getMap());
            if (order) cpu.order = order;
        });

        this.gameState = 'ACTION';
        document.getElementById('action-btn').style.display = 'none';
        document.getElementById('phase-text').innerText = "行動フェイズ";
        this.closeCtx();

        await this.resolveTurn();
    }

    async resolveTurn() {
        try {
            // 調略フラグをリセット（新しいターン開始）
            this.warlordPlotUsed = {};

            // 全ユニットの行動済みフラグをリセット（未行動状態に戻す）
            this.units.forEach(u => u.hasActed = false);

            // ユニット単位でソート（残り兵数が少ない順）
            const queue = [...this.units].sort((a, b) => a.soldiers - b.soldiers);

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

                // 勝敗判定（本陣ユニットベース）
                const iyeyasuHQ = this.units.find(x => x.warlordName === '徳川家康' && x.unitType === 'HEADQUARTERS');
                const mitsunariHQ = this.units.find(x => x.warlordName === '石田三成' && x.unitType === 'HEADQUARTERS');

                if (!iyeyasuHQ || iyeyasuHQ.dead) {
                    this.triggerEndGame('WEST', '徳川家康');
                    return;
                }
                if (!mitsunariHQ || mitsunariHQ.dead) {
                    this.triggerEndGame('EAST', '石田三成');
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
    onMouseDown(e) {
        if (this.buildingEditor && this.buildingEditor.isActive) return;

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

    onMouseMove(e) {
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

    onMouseUp(e) {
        if (this.buildingEditor && this.buildingEditor.isActive) return;
        if (this.input.isLeftDown && e.button === 0) {

            this.input.isLeftDown = false;

            // 選択ボックスを隠す
            this.selectionBox.style.display = 'none';

            const dist = Math.hypot(e.clientX - this.input.start.x, e.clientY - this.input.start.y);
            if (dist < 5) {
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

    onKeyDown(e) {
        if (this.gameState === 'PLACEMENT' && e.key === 'Escape') {
            this.cancelPlacementMode();
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

    handleLeftClick(mx, my) {
        let h = null;

        // 3DレンダリングエンジンからHEX座標を取得
        if (this.renderingEngine && this.renderingEngine.getHexFromScreenCoordinates) {
            h = this.renderingEngine.getHexFromScreenCoordinates(mx, my);
        } else {
            // フォールバック（2D用）
            h = pixelToHex(mx, my, this.camera);
        }

        if (!h || !isValidHex(h)) return;

        // クリック位置に近いユニットを探す
        // 3Dの場合、HEX座標の一致で判定する方が確実
        // UnitManager改修によりプロパティは q,r ではなく x,y になっている
        const u = this.units.find(x =>
            !x.dead && x.x === h.q && x.y === h.r
        );

        const menu = document.getElementById('context-menu');
        menu.style.display = 'none';

        if (u) {
            if (u.side === this.playerSide) {
                // 同じ武将の全ユニットを選択
                const warlordUnits = this.unitManager.getUnitsByWarlordId(u.warlordId);
                this.selectedUnits = warlordUnits.filter(unit => !unit.dead);
                this.updateSelectionUI(this.selectedUnits, null); // ターゲット情報はクリア

                // 移動範囲表示（本陣を基準）
                const leader = this.selectedUnits.find(unit => unit.unitType === UNIT_TYPE_HEADQUARTERS) || this.selectedUnits[0];
                if (leader && this.renderingEngine && this.renderingEngine.showMoveRange) {
                    this.renderingEngine.clearMoveRange();
                    const range = leader.move || 6; // デフォルト移動力
                    const tiles = getReachableTiles(leader.x, leader.y, range, this.mapSystem);
                    this.renderingEngine.showMoveRange(tiles, 0x4466ff);
                }
                // 陣形はユニットカード内に表示される
            } else {
                // 敵クリック
                // 既に味方を選択中なら、それをターゲットにする（攻撃/調略）
                if (this.selectedUnits.length > 0 && this.selectedUnits[0].side === this.playerSide) {
                    this.targetContextUnit = u;
                    menu.style.display = 'flex';
                    menu.style.left = mx + 'px';
                    menu.style.top = my + 'px';

                    // ユーザー要望: 目標の部隊の情報も表示したい
                    // 選択状態は維持しつつ、UI上だけ一時的にターゲット情報を表示する、あるいは
                    // 選択UIにターゲット情報も追加する形が望ましいが、
                    // ここではシンプルに「ターゲット情報のみを表示」してしまうと、自軍の操作ができなくなる。
                    // 妥協案として、コンソールに情報を出すか、あるいは updateSelectionUI を拡張して「ターゲット情報」を表示できるようにする。
                    // 今回は updateSelectionUI にターゲットユニットを渡して、両方表示するように変更する。
                    this.updateSelectionUI(this.selectedUnits, u);

                } else {
                    // 味方を選択していないなら、敵ユニットを選択（情報表示のみ）
                    // この場合、敵の武将グループ全体を表示する
                    const warlordUnits = this.unitManager.getUnitsByWarlordId(u.warlordId);
                    const enemyGroup = warlordUnits.filter(unit => !unit.dead);
                    this.updateSelectionUI(enemyGroup);
                    this.selectedUnits = []; // 操作対象としては保持しない
                }
            }
        } else {
            if (this.selectedUnits.length > 0 && this.selectedUnits[0].side === this.playerSide) {
                // 移動命令を設定（選択は維持）
                this.selectedUnits.forEach(su =>
                    su.order = { type: 'MOVE', targetHex: { x: h.q, y: h.r } }
                );
                // 選択を維持して陣形パネルも維持
            } else {
                // 選択状態でなければ、選択解除
                this.selectedUnits = [];
                this.updateSelectionUI([], null); // ターゲット情報はクリア
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

        // 半透明にする
        this.placementGhost.traverse(c => {
            if (c.isMesh) {
                c.material = c.material.clone();
                c.material.transparent = true;
                c.material.opacity = 0.6;
                c.material.emissive = new THREE.Color(0x004400);
            }
        });

        this.renderingEngine.scene.add(this.placementGhost);
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
        }
    }

    placeCurrentBuilding() {
        if (!this.placementData || !this.currentPlacementPos) return;

        // Snap logic here if needed.
        // For now, just place at cursor.
        const p = this.currentPlacementPos;

        // Align to height map? center?
        // The buildSystem logic usually calculates height.
        // Let's try to infer grid coordinates roughly or just pass world coords.
        // placeCustomBuilding(data, wx, wz, y);
        this.buildingSystem.placeCustomBuilding(this.placementData, p.x, p.z, p.y);

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
            info.innerHTML = `<strong style="color:#FF8888">[目標] ${targetHeadquarters.name}</strong><br>兵: ${targetTotalSoldiers} (${targetUnitCount}部隊) <small>(攻${targetHeadquarters.atk}/防${targetHeadquarters.def})</small>`;

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

            info.innerHTML = `<strong>${headquarters.name}</strong><br>兵: ${totalSoldiers} (${unitCount}部隊) <small>(攻${headquarters.atk}/防${headquarters.def})</small>${formationText}<br>指示: ${ord}`;

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
     * キーボード入力ハンドラー
     */
    onKeyDown(e) {
        // 配置モード中の回転
        if (this.state === 'PLACEMENT' && (e.key === 'r' || e.key === 'R')) {
            this.placementRotation = (this.placementRotation + 1) % 4;
            console.log(`Rotation: ${this.placementRotation * 90}°`);
            this.updatePlacementGhost();
        }

        // エスケープキーで配置モードをキャンセル
        if (e.key === 'Escape' && this.state === 'PLACEMENT') {
            this.cancelPlacementMode();
        }

        // マップ保存 (Shift+P)
        if (e.key === 'P' && e.shiftKey) {
            this.exportMapData();
        }
    }

    /**
     * 建物配置モードに入る
     */
    enterBuildingPlacementMode(buildingData) {
        console.log("Enter Placement Mode");
        this.state = 'PLACEMENT';
        this.placementData = buildingData;
        this.placementRotation = 0;
        this.updatePlacementGhost();
    }

    /**
     * 配置モードをキャンセル
     */
    cancelPlacementMode() {
        console.log("Cancel Placement Mode");
        this.state = 'PLAYING';
        this.placementData = null;
        this.placementRotation = 0;

        if (this.placementGhost) {
            this.renderingEngine.scene.remove(this.placementGhost);
            this.placementGhost = null;
        }
    }

    /**
     * 配置ゴーストを更新
     */
    updatePlacementGhost() {
        // 古いゴーストを削除
        if (this.placementGhost) {
            this.renderingEngine.scene.remove(this.placementGhost);
            this.placementGhost = null;
        }

        if (!this.placementData) return;

        // 回転を適用
        const { blocks, size } = this.buildingSystem.rotateBlocks(
            this.placementData.blocks,
            this.placementData.size,
            this.placementRotation
        );
        const tempTemplate = { ...this.placementData, blocks, size };

        // ゴースト作成
        const mesh = this.buildingSystem.createBuildingMesh(tempTemplate, 0, 0, 0);

        // 半透明化
        mesh.traverse((child) => {
            if (child.isMesh) {
                child.material = child.material.clone();
                child.material.transparent = true;
                child.material.opacity = 0.5;
                child.material.depthWrite = false;
            }
        });

        this.placementGhost = mesh;
        this.renderingEngine.scene.add(this.placementGhost);
    }

    /**
     * 現在の建物を配置
     */
    placeCurrentBuilding() {
        if (!this.placementData || !this.input.hoverHex) return;

        const hex = this.input.hoverHex;

        this.buildingSystem.placeCustomBuildingAtGrid(
            this.placementData,
            hex.x,
            hex.y,
            this.placementRotation
        );

        console.log(`Placed building at (${hex.x}, ${hex.y}) Rotation: ${this.placementRotation * 90}°`);
    }

    /**
     * マウス移動イベントハンドラー
     */
    onMouseMove(e) {
        // 配置モード中のゴースト更新
        if (this.state === 'PLACEMENT') {
            const intersect = this.renderingEngine.raycastToGround(e.clientX, e.clientY);
            if (intersect && intersect.object && intersect.object.userData) {
                const hex = { x: intersect.object.userData.x, y: intersect.object.userData.y };
                this.input.hoverHex = hex;

                // ゴーストの位置を更新
                if (this.placementGhost) {
                    const pos = this.renderingEngine.gridToWorld3D(hex.x, hex.y, 0);
                    const h = this.renderingEngine.mapSystem.getGroundHeight(hex.x, hex.y);
                    this.placementGhost.position.set(pos.x, h, pos.z);
                }
            }
            return; // 配置モード中は他の処理をスキップ
        }

        // 通常のマウス処理（必要に応じて追加）
    }

    /**
     * マウスクリックイベントハンドラー
     */
    onMouseDown(e) {
        // 配置モード中の処理
        if (this.state === 'PLACEMENT') {
            if (e.button === 0) { // 左クリック
                this.placeCurrentBuilding();
            } else if (e.button === 2) { // 右クリック
                this.cancelPlacementMode();
            }
            e.preventDefault();
            return;
        }

        // 通常のクリック処理（必要に応じて追加）
    }

    /**
     * マウスアップイベントハンドラー
     */
    onMouseUp(e) {
        // 必要に応じて実装
    }

    /**
     * マウスホイールイベントハンドラー
     */
    onWheel(e) {
        // 必要に応じて実装
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
        alert("マップデータをコンソールに出力しました。\nF12キーを押してコンソールを開き、データをコピーしてください。");
    }
}


