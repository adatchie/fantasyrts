/**
 * SEKIGAHARA RTS - Main Game Loop
 * メインゲームロジックとループ
 */

import { HEX_SIZE, C_EAST, C_WEST, C_SEL_BOX, C_SEL_BORDER, WARLORDS, UNIT_TYPE_HEADQUARTERS } from './constants.js';
import { AudioEngine } from './audio.js';
import { MapSystem } from './map.js';
import { RenderingEngine, generatePortrait } from './rendering.js';
import { CombatSystem } from './combat.js';
import { AISystem } from './ai.js';
import { UnitManager } from './unit-manager.js';
import { hexToPixel, pixelToHex, isValidHex, getDistRaw } from './pathfinding.js';

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
        this.ctx = this.canvas.getContext('2d');
        this.renderingEngine = new RenderingEngine(this.canvas, this.ctx);
        this.combatSystem = new CombatSystem(this.audioEngine);

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));

        requestAnimationFrame(() => this.loop());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
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

        // 調略フラグを初期化（武将単位で管理）
        this.warlordPlotUsed = {}; // warlordId -> boolean

        // カメラ位置
        const center = hexToPixel(30, 30);
        this.camera.x = this.canvas.width / 2 - center.x;
        this.camera.y = this.canvas.height / 2 - center.y;

        this.gameState = 'ORDER';
        this.updateHUD();
    }

    async commitTurn() {
        if (this.gameState !== 'ORDER') return;

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
            const queue = [...this.units].sort((a, b) => a.soldiers - b.soldiers);

            for (const u of queue) {
                if (u.dead) continue;

                await this.combatSystem.processUnit(u, this.units, this.mapSystem.getMap());

                // 勝敗判定
                const iyeyasu = this.units.find(x => x.name === '徳川家康');
                const mitsunari = this.units.find(x => x.name === '石田三成');

                if (!iyeyasu || iyeyasu.dead) {
                    this.triggerEndGame('WEST', '徳川家康');
                    return;
                }
                if (!mitsunari || mitsunari.dead) {
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
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const map = this.mapSystem.getMap();
        if (map.length > 0) {
            // マップ描画
            for (let r = 0; r < map.length; r++) {
                for (let q = 0; q < map[r].length; q++) {
                    const p = hexToPixel(q, r);
                    const sx = p.x * this.camera.zoom + this.camera.x;
                    const sy = p.y * this.camera.zoom + this.camera.y;

                    if (sx < -60 || sx > this.canvas.width + 60 ||
                        sy < -60 || sy > this.canvas.height + 60) continue;

                    this.renderingEngine.drawHex(sx, sy, map[r][q], this.camera);
                }
            }

            // 指示線描画（目標設定フェイズのみ）
            if (this.gameState === 'ORDER') {
                // 味方全ユニットの命令ラインを表示（薄い色）
                this.units.forEach(u => {
                    if (u.side === this.playerSide && !u.dead && u.order) {
                        const isSelected = this.selectedUnits.includes(u);
                        this.renderingEngine.drawOrderLine(u, this.units, this.camera, isSelected);
                    }
                });
            }

            // ユニット描画
            this.units.forEach(u => {
                if (!u.dead) {
                    this.renderingEngine.drawUnit(u, this.camera, this.selectedUnits);
                }
            });

            // エフェクトとバブル描画
            this.combatSystem.updateEffects();
            this.renderingEngine.drawEffects(this.combatSystem.activeEffects, this.camera);
            this.renderingEngine.drawBubbles(this.combatSystem.activeBubbles, this.camera);

            // 選択ボックス描画
            if (this.input.isLeftDown) {
                const w = this.input.curr.x - this.input.start.x;
                const h = this.input.curr.y - this.input.start.y;
                this.ctx.fillStyle = C_SEL_BOX;
                this.ctx.fillRect(this.input.start.x, this.input.start.y, w, h);
                this.ctx.strokeStyle = C_SEL_BORDER;
                this.ctx.strokeRect(this.input.start.x, this.input.start.y, w, h);
            }
        }

        requestAnimationFrame(() => this.loop());
    }

    // Input handling
    onMouseDown(e) {
        if (e.button === 2) {
            this.input.isRightDown = true;
            this.input.start = { x: e.clientX, y: e.clientY };
        } else if (e.button === 0) {
            this.input.isLeftDown = true;
            this.input.start = { x: e.clientX, y: e.clientY };
            this.input.curr = { x: e.clientX, y: e.clientY };
        }
    }

    onMouseMove(e) {
        if (this.input.isRightDown) {
            this.camera.x += e.clientX - this.input.start.x;
            this.camera.y += e.clientY - this.input.start.y;
            this.input.start = { x: e.clientX, y: e.clientY };
        }
        if (this.input.isLeftDown) {
            this.input.curr = { x: e.clientX, y: e.clientY };
        }
    }

    onMouseUp(e) {
        if (this.input.isRightDown && e.button === 2) {
            this.input.isRightDown = false;
        }
        if (this.input.isLeftDown && e.button === 0) {
            this.input.isLeftDown = false;
            const dist = Math.hypot(e.clientX - this.input.start.x, e.clientY - this.input.start.y);
            if (dist < 5) {
                this.handleLeftClick(e.clientX, e.clientY);
            } else {
                this.handleBoxSelect();
            }
        }
    }

    onWheel(e) {
        this.camera.zoom -= e.deltaY * 0.001;
        if (this.camera.zoom < 0.3) this.camera.zoom = 0.3;
        if (this.camera.zoom > 2.0) this.camera.zoom = 2.0;
    }

    handleLeftClick(mx, my) {
        const h = pixelToHex(mx, my, this.camera);
        if (!isValidHex(h)) return;

        const u = this.units.find(x =>
            !x.dead && getDistRaw(x.q, x.r, h.q, h.r) < x.radius
        );

        const menu = document.getElementById('context-menu');
        menu.style.display = 'none';

        if (u) {
            if (u.side === this.playerSide) {
                // 同じ武将の全ユニットを選択
                const warlordUnits = this.unitManager.getUnitsByWarlordId(u.warlordId);
                this.selectedUnits = warlordUnits.filter(unit => !unit.dead);
                this.updateSelectionUI(this.selectedUnits);
            } else {
                this.updateSelectionUI([u]);
                if (this.selectedUnits.length > 0 && this.selectedUnits[0].side === this.playerSide) {
                    this.targetContextUnit = u;
                    menu.style.display = 'flex';
                    menu.style.left = mx + 'px';
                    menu.style.top = my + 'px';
                } else {
                    this.selectedUnits = [];
                }
            }
        } else {
            if (this.selectedUnits.length > 0 && this.selectedUnits[0].side === this.playerSide) {
                this.selectedUnits.forEach(su =>
                    su.order = { type: 'MOVE', targetHex: { q: h.q, r: h.r } }
                );
                // 命令を出したら選択解除
                this.selectedUnits = [];
                this.updateSelectionUI([]);
            } else {
                this.selectedUnits = [];
                this.updateSelectionUI([]);
            }
        }
    }

    handleBoxSelect() {
        const x1 = Math.min(this.input.start.x, this.input.curr.x);
        const x2 = Math.max(this.input.start.x, this.input.curr.x);
        const y1 = Math.min(this.input.start.y, this.input.curr.y);
        const y2 = Math.max(this.input.start.y, this.input.curr.y);

        this.selectedUnits = this.units.filter(u => {
            if (u.side !== this.playerSide || u.dead) return false;
            const sx = u.pos.x * this.camera.zoom + this.camera.x;
            const sy = u.pos.y * this.camera.zoom + this.camera.y;
            return (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2);
        });

        this.updateSelectionUI(this.selectedUnits);
    }

    issueCommand(type) {
        if (this.targetContextUnit && this.selectedUnits.length > 0) {
            this.selectedUnits.forEach(u => {
                u.order = { type: type, targetId: this.targetContextUnit.id };
            });
            // 命令を出したら選択解除
            this.selectedUnits = [];
            this.updateSelectionUI([]);
        }
        this.closeCtx();
    }

    closeCtx() {
        document.getElementById('context-menu').style.display = 'none';
    }

    updateHUD() {
        const eS = this.units.filter(u => u.side === 'EAST' && !u.dead)
            .reduce((a, c) => a + c.soldiers, 0);
        const wS = this.units.filter(u => u.side === 'WEST' && !u.dead)
            .reduce((a, c) => a + c.soldiers, 0);
        document.getElementById('status-text').innerText = `東軍: ${eS} / 西軍: ${wS}`;
    }

    updateSelectionUI(list) {
        const container = document.getElementById('unit-list');
        container.innerHTML = '';

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
            info.innerHTML = `<strong>${headquarters.name}</strong><br>兵: ${totalSoldiers} (${unitCount}部隊) <small>(攻${headquarters.atk}/防${headquarters.def})</small><br>指示: ${ord}`;

            d.appendChild(img);
            d.appendChild(info);
            container.appendChild(d);
        });
    }
}


