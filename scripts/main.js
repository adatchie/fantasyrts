/**
 * SEKIGAHARA RTS - Main Game Loop
 * メインゲームロジックとループ
 */

import { HEX_SIZE, C_EAST, C_WEST, C_SEL_BOX, C_SEL_BORDER, WARLORDS, UNIT_TYPE_HEADQUARTERS, FORMATION_HOKO, FORMATION_KAKUYOKU, FORMATION_GYORIN } from './constants.js';
import { AudioEngine } from './audio.js';
import { MapSystem } from './map.js?v=2';
import { RenderingEngine3D } from './rendering3d.js?v=5';
import { generatePortrait } from './rendering.js';
import { CombatSystem } from './combat.js?v=5';
import { AISystem } from './ai.js';
import { UnitManager } from './unit-manager.js';
import { hexToPixel, pixelToHex, isValidHex, getDistRaw } from './pathfinding.js';
import { FORMATION_INFO, getAvailableFormations } from './formation.js?v=2';

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

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        window.addEventListener('keydown', (e) => this.onKeyDown(e));

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
            this.unitManager.createUnitsFromWarlord(warlord, warlordId, WARLORDS);
        });

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
        this.audioEngine.playFanfare(winnerSide === this.playerSide);

        const winText = winnerSide === 'EAST' ? "東軍 勝利" : "西軍 勝利";
        const msg = `敵総大将・${loserName}、討ち取ったり！`;

        const vs = document.getElementById('victory-screen');
        vs.style.display = 'flex';
        document.getElementById('vic-msg-1').innerText = msg;
        document.getElementById('vic-msg-2').innerText = winText;
        document.getElementById('vic-msg-2').style.color = (winnerSide === 'EAST') ? C_EAST : C_WEST;
    }

    loop() {
        // 3Dレンダラーが自動的にアニメーションループを持っているので
        // ここでは2D UIの更新のみ行う
        // 将来的にはユニットやエフェクトを3Dで描画する

        requestAnimationFrame(() => this.loop());
    }

    // Input handling
    onMouseDown(e) {
        // 右クリックはOrbitControlsが処理するので何もしない
        if (e.button === 0) {
            this.input.isLeftDown = true;
            this.input.start = { x: e.clientX, y: e.clientY };
            this.input.curr = { x: e.clientX, y: e.clientY };
        }
    }

    onMouseMove(e) {
        // 右ドラッグ（カメラ移動）はOrbitControlsが処理する
        if (this.input.isLeftDown) {
            this.input.curr = { x: e.clientX, y: e.clientY };

            // 選択ボックスを描画
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
            }
        }
    }

    onMouseUp(e) {
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

    onKeyDown(e) {
        // ESCキーで選択解除とパネルを閉じる
        if (e.key === 'Escape') {
            this.selectedUnits = [];
            this.updateSelectionUI([]);
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
        const u = this.units.find(x =>
            !x.dead && x.q === h.q && x.r === h.r
        );

        const menu = document.getElementById('context-menu');
        menu.style.display = 'none';

        if (u) {
            if (u.side === this.playerSide) {
                // 同じ武将の全ユニットを選択
                const warlordUnits = this.unitManager.getUnitsByWarlordId(u.warlordId);
                this.selectedUnits = warlordUnits.filter(unit => !unit.dead);
                this.updateSelectionUI(this.selectedUnits, null); // ターゲット情報はクリア
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
                    su.order = { type: 'MOVE', targetHex: { q: h.q, r: h.r } }
                );
                // 選択を維持して陣形パネルも維持
            } else {
                // 選択状態でなければ、選択解除
                this.selectedUnits = [];
                this.updateSelectionUI([], null); // ターゲット情報はクリア
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
                if (headquarters.order.type === 'MOVE') ord = `移動`;
                else if (headquarters.order.type === 'ATTACK') ord = `攻撃`;
                else if (headquarters.order.type === 'PLOT') ord = `調略`;
            }

            const img = document.createElement('img');
            img.className = 'portrait';
            if (headquarters.imgCanvas) {
                img.src = headquarters.imgCanvas.toDataURL();
            }

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
}


