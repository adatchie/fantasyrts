/**
 * SEKIGAHARA RTS - Combat System
 * 戦闘処理とユニット行動
 */

import { getDist, getDistRaw, getFacingAngle, findPath } from './pathfinding.js';
import { hexToPixel } from './pathfinding.js';
import { DIALOGUE } from './constants.js';
import { generatePortrait } from './rendering.js';
import { getFormationModifiers, canMoveWithFormation, checkForcedFormationChange, FORMATION_INFO } from './formation.js';
import { UNIT_TYPE_HEADQUARTERS } from './constants.js';

export class CombatSystem {
    constructor(audioEngine, unitManager = null) {
        this.audioEngine = audioEngine;
        this.activeEffects = [];
        this.activeBubbles = [];
        this.playerSide = 'EAST'; // デフォルト値
        this.unitManager = unitManager; // 陣形チェック用
    }

    setPlayerSide(side) {
        this.playerSide = side;
    }

    setUnitManager(unitManager) {
        this.unitManager = unitManager;
    }

    setRenderingEngine(renderingEngine) {
        this.renderingEngine = renderingEngine;
    }

    setMapSystem(mapSystem) {
        this.mapSystem = mapSystem;
    }

    /**
     * ユニットの行動を処理
     */
    async processUnit(unit, allUnits, map, warlordPlotUsed = {}) {
        if (!unit.order) return;

        console.log(`[processUnit] ${unit.name} (${unit.unitType}): order=${unit.order.type}, formation=${unit.formation}`);

        // 本陣ユニットの場合、兵力による強制陣形変更をチェック
        if (unit.unitType === UNIT_TYPE_HEADQUARTERS && this.unitManager) {
            const forceChange = checkForcedFormationChange(unit.soldiers, unit.formation);
            if (forceChange.needsChange) {
                unit.formation = forceChange.newFormation;
                const info = FORMATION_INFO[forceChange.newFormation];
                this.showFormation(unit, info.nameShort);
                console.log(`強制陣形変更: ${unit.name} -> ${info.nameShort} (兵力: ${unit.soldiers})`);
            }
        }

        const target = allUnits.find(u => u.id === unit.order.targetId);
        const reach = (unit.size + (target ? target.size : 1)) / 2.0 + 0.5;

        if (unit.order.type === 'PLOT' && target && !target.dead) {
            await this.processPlot(unit, target, allUnits, warlordPlotUsed);
        } else if (unit.order.type === 'ATTACK' && target && !target.dead) {
            await this.processAttack(unit, target, allUnits, map, reach);
        } else if (unit.order.type === 'MOVE') {
            await this.processMove(unit, allUnits);
        }
    }

    /**
     * 調略を処理
     * マルチユニットシステム: 1武将1ターン1回のみ
     */
    async processPlot(unit, target, allUnits, warlordPlotUsed = {}) {
        // この武将がすでに調略を使用済みかチェック
        if (warlordPlotUsed[unit.warlordId]) {
            console.log(`${unit.warlordName} は今ターンすでに調略を使用済み`);
            // 調略をスキップして移動に切り替え
            unit.order = { type: 'MOVE', targetHex: { q: target.q, r: target.r } };
            await this.processMove(unit, allUnits);
            return;
        }

        const dist = getDist(unit, target);
        console.log(`[processPlot] ${unit.name} -> ${target.name}, dist=${dist}`);

        if (dist <= 5) {
            unit.dir = getFacingAngle(unit.q, unit.r, target.q, target.r);
            this.speak(unit, 'PLOT_DO');
            this.speak(target, 'PLOT_REC');
            await this.spawnEffect('WAVE', unit, target);

            // エフェクトを見せるためのウェイト
            await this.wait(800);

            // 戦況による調略成功率
            const eTotal = allUnits.filter(u => u.side === 'EAST' && !u.dead)
                .reduce((a, c) => a + c.soldiers, 0);
            const wTotal = allUnits.filter(u => u.side === 'WEST' && !u.dead)
                .reduce((a, c) => a + c.soldiers, 0);
            const myTotal = unit.side === 'EAST' ? eTotal : wTotal;
            const total = eTotal + wTotal;
            const tideRatio = myTotal / (total || 1);
            const tideMod = (tideRatio - 0.5) * 100;

            let chance = 30 + (unit.jin - target.loyalty) + tideMod;
            if (target.loyalty > 95) chance = 1;

            console.log(`[processPlot] Chance: ${chance}% (Jin: ${unit.jin}, Loyalty: ${target.loyalty}, Tide: ${tideMod.toFixed(1)})`);

            if (Math.random() * 100 < chance) {
                // マルチユニットシステム: 対象武将の全ユニットを寝返らせる
                const targetWarlordId = target.warlordId;
                const targetWarlordUnits = allUnits.filter(u => u.warlordId === targetWarlordId);

                console.log(`調略成功: ${target.warlordName} (武将ID: ${targetWarlordId})`);
                console.log(`対象ユニット数: ${targetWarlordUnits.length}`);

                targetWarlordUnits.forEach(warlordUnit => {
                    console.log(`  - ユニットID ${warlordUnit.id}: ${warlordUnit.side} -> ${unit.side}`);
                    warlordUnit.side = unit.side;
                    warlordUnit.loyalty = 100;
                    warlordUnit.order = null; // 命令をクリア

                    // 本陣ユニットのみ画像を更新（2D用）
                    if (warlordUnit.imgCanvas) {
                        warlordUnit.imgCanvas = generatePortrait(warlordUnit, warlordUnit.side);
                    }

                    // 3D表示を更新
                    if (this.renderingEngine && this.renderingEngine.updateUnitVisuals) {
                        this.renderingEngine.updateUnitVisuals(warlordUnit);
                    }
                });

                this.spawnText({ q: target.q, r: target.r }, "寝返り！", "#0f0", 60);
                this.audioEngine.sfxArrangementSuccess(); // 調略成功SE
            } else {
                console.log(`[processPlot] Failed.`);
                this.spawnText({ q: target.q, r: target.r }, "失敗...", "#aaa", 40);
                this.audioEngine.sfxArrangementFail(); // 調略失敗SE
            }

            // 調略使用フラグを立てる（武将単位）
            warlordPlotUsed[unit.warlordId] = true;

            unit.order = null;
            await this.wait(800);
        } else {
            console.log(`[processPlot] Target too far, moving instead.`);
            await this.moveUnitStep(unit, target, allUnits);
        }
    }

    /**
     * 攻撃を処理
     */
    async processAttack(unit, target, allUnits, map, reach) {
        // 距離チェックを少し緩める（+1.0の猶予を持たせる）
        // 3D化に伴う座標の微妙なズレを許容するため
        const dist = getDist(unit, target);
        console.log(`[processAttack] ${unit.name} -> ${target.name}, dist=${dist}, reach=${reach}`);

        if (dist <= reach + 1.0) {
            unit.dir = getFacingAngle(unit.q, unit.r, target.q, target.r);
            this.speak(unit, 'ATTACK');
            await this.combat(unit, target, allUnits, map);
        } else {
            const moved = await this.moveUnitStep(unit, target, allUnits);
            // 移動後に再チェック
            const newDist = getDist(unit, target);
            if (newDist <= reach + 1.0) {
                unit.dir = getFacingAngle(unit.q, unit.r, target.q, target.r);
                this.speak(unit, 'ATTACK');
                await this.combat(unit, target, allUnits, map);
            }
        }
    }

    /**
     * 移動を処理
     * 本陣の場合は陣形制限をチェック
     */
    async processMove(unit, allUnits) {
        console.log(`[processMove] START: ${unit.name}, unitType=${unit.unitType}, formation=${unit.formation}`);

        const dest = unit.order.targetHex;
        if (getDistRaw(unit.q, unit.r, dest.q, dest.r) === 0) {
            unit.order = null;
        } else {
            // 本陣の場合、陣形制限をチェック
            if (unit.unitType === UNIT_TYPE_HEADQUARTERS && unit.formation && this.unitManager) {
                const subordinates = this.unitManager.getUnitsByWarlordId(unit.warlordId)
                    .filter(u => !u.dead && u.unitType !== UNIT_TYPE_HEADQUARTERS);

                console.log(`[陣形チェック] ${unit.name}: 陣形=${unit.formation}, 配下=${subordinates.length}体, 目標=(${dest.q},${dest.r})`);

                const canMove = canMoveWithFormation(unit, subordinates, dest.q, dest.r, unit.formation);

                console.log(`[陣形チェック結果] ${unit.name}: 移動可=${canMove}`);

                if (!canMove) {
                    // 陣形要件を満たさない場合、移動をキャンセル（陣形は維持）
                    console.log(`❌ 陣形制限により移動キャンセル: ${unit.name} (${unit.formation})`);
                    // 移動をスキップ（その場にとどまる）
                    return;
                }
            }

            await this.moveUnitStep(unit, dest, allUnits);
        }
    }

    /**
     * ユニットを移動（パスファインディング使用）
     * 包囲移動をサポート
     */
    async moveUnitStep(unit, dest, allUnits) {
        let targetQ = dest.q;
        let targetR = dest.r;

        // 目標がユニット（攻撃対象）の場合、包囲位置を探す
        if (dest.id !== undefined) {
            const surroundPos = this.findSurroundPosition(unit, dest, allUnits);
            if (surroundPos) {
                targetQ = surroundPos.q;
                targetR = surroundPos.r;
            }
        }

        const path = findPath(unit.q, unit.r, targetQ, targetR, allUnits, unit);
        let moves = 3;
        let actuallyMoved = false;

        for (let i = 1; i < path.length && moves > 0; i++) {
            const next = path[i];

            // 念のため再チェック（状況が変わっている可能性）
            const blocker = allUnits.find(u =>
                u.id !== unit.id &&
                !u.dead &&
                getDistRaw(next.q, next.r, u.q, u.r) < (unit.radius + u.radius)
            );

            if (blocker) return actuallyMoved;

            unit.dir = getFacingAngle(unit.q, unit.r, next.q, next.r);
            unit.q = next.q;
            unit.r = next.r;
            unit.pos = hexToPixel(unit.q, unit.r);
            actuallyMoved = true;
            moves--;
            await this.wait(20);
        }

        return actuallyMoved;
    }

    /**
     * 包囲位置を探す
     * 目標の周囲で空いているスペースを見つける
     */
    findSurroundPosition(unit, target, allUnits) {
        const directions = [
            [+1, 0], [+1, -1], [0, -1],
            [-1, 0], [-1, +1], [0, +1]
        ];

        // 目標の周囲6方向をチェック
        const surroundPositions = [];
        for (const [dq, dr] of directions) {
            const q = target.q + dq;
            const r = target.r + dr;

            // 空いているかチェック
            const isOccupied = allUnits.some(u =>
                u.id !== unit.id &&
                !u.dead &&
                getDistRaw(q, r, u.q, u.r) < (unit.radius + u.radius)
            );

            if (!isOccupied) {
                const dist = getDistRaw(unit.q, unit.r, q, r);
                surroundPositions.push({ q, r, dist });
            }
        }

        if (surroundPositions.length === 0) return null;

        // 現在位置から最も近い包囲位置を選択
        surroundPositions.sort((a, b) => a.dist - b.dist);
        return surroundPositions[0];
    }

    /**
     * 戦闘を実行
     */
    async combat(att, def, allUnits, map) {
        att.dir = getFacingAngle(att.q, att.r, def.q, def.r);

        // 包囲攻撃の判定
        const siegers = allUnits.filter(u =>
            u.side === att.side &&
            !u.dead &&
            u.id !== att.id &&
            getDist(u, def) <= (u.size + def.size) / 2 + 1
        );

        // 鬨の声（戦闘開始SE）
        this.audioEngine.sfxBattleCry();

        // 攻撃側から防御側への攻撃線
        this.addEffect('BEAM', { q: att.q, r: att.r }, { q: def.q, r: def.r }, '#ffaa00');
        siegers.forEach(s => this.addEffect('BEAM', { q: s.q, r: s.r }, { q: def.q, r: def.r }, '#ffaa00'));

        // 戦闘エフェクト: 土煙と火花を追加
        this.addEffect('DUST', { q: def.q, r: def.r }, null, null);
        this.spawnSparks(att, def); // 攻撃側と防御側の間に火花

        this.audioEngine.sfxHit();
        await this.wait(600);

        // 地形ボーナス
        const hAtt = map[att.r][att.q].h;
        const hDef = map[def.r][def.q].h;
        let mod = 1.0 + (hAtt > hDef ? 0.3 : 0) + (siegers.length * 0.2);

        // 方向ボーナス
        let dirDiff = Math.abs(att.dir - def.dir);
        if (dirDiff > 3) dirDiff = 6 - dirDiff;

        let dirMod = 1.0;
        let dirMsg = "";
        if (dirDiff === 0) {
            dirMod = 2.0;
            dirMsg = "背面攻撃!";
        } else if (dirDiff !== 3) {
            dirMod = 1.5;
            dirMsg = "側面攻撃!";
        }

        if (dirMsg) this.spawnText({ q: def.q, r: def.r }, dirMsg, "#ffff00", 40);

        // 陣形によるステータス修正
        const attFormation = getFormationModifiers(att.formation);
        const defFormation = getFormationModifiers(def.formation);
        const finalAtkStat = att.atk + attFormation.atk;
        const finalDefStat = def.def + defFormation.def;

        // ダメージ計算（陣形修正を適用）
        let dmgToDef = Math.floor((Math.sqrt(att.soldiers) * finalAtkStat * mod * dirMod) / (finalDefStat / 15));
        if (dmgToDef < 10) dmgToDef = 10;
        const dmgToAtt = Math.floor(dmgToDef * 0.2);

        def.soldiers -= dmgToDef;
        att.soldiers -= dmgToAtt;
        this.spawnText({ q: def.q, r: def.r }, `-${dmgToDef}`, '#ff3333', 60);
        this.spawnText({ q: att.q, r: att.r }, `-${dmgToAtt}`, '#ff8888', 60);
        this.speak(def, 'DAMAGED');

        // 3Dレンダラー側のユニット情報を更新（兵士数ゲージなど）
        if (this.renderingEngine && this.renderingEngine.updateUnitInfo) {
            // ユニットメッシュを取得して更新
            const attMesh = this.renderingEngine.unitMeshes.get(att.id);
            const defMesh = this.renderingEngine.unitMeshes.get(def.id);
            if (attMesh) this.renderingEngine.updateUnitInfo(attMesh, att);
            if (defMesh) this.renderingEngine.updateUnitInfo(defMesh, def);
        }

        if (def.soldiers <= 0) {
            def.soldiers = 0;
            def.dead = true;
            await this.dramaticDeath(def, att.side);
        }
        if (att.soldiers <= 0) {
            att.soldiers = 0;
            att.dead = true;
            await this.dramaticDeath(att, def.side);
        }

        await this.wait(400);
        this.activeEffects = this.activeEffects.filter(e => e.type !== 'BEAM');
    }

    /**
     * 劇的な死亡演出
     * @param {Object} unit - 討ち取られたユニット
     * @param {string} killerSide - 討ち取った側の陣営
     */
    async dramaticDeath(unit, killerSide) {
        // 本陣かどうかを判定
        const isHeadquarters = (unit.unitType === 'HEADQUARTERS');

        // 討ち取った側によってSEを変更
        if (killerSide === this.playerSide) {
            // 敵を討ち取った！シャキーン！
            this.audioEngine.sfxVictorySlash();
        } else {
            // 味方が討ち取られた…ズバッ
            this.audioEngine.sfxDefeatSlash();
        }

        this.speak(unit, 'DYING', true);

        const flash = document.getElementById('flash-overlay');
        flash.style.opacity = 0.5;
        setTimeout(() => flash.style.opacity = 0, 150);

        // メッセージを本陣と配下部隊で区別
        let msg, color;

        if (isHeadquarters) {
            // 本陣ユニット: 従来の「討ち取った」メッセージ
            msg = (unit.side === this.playerSide) ?
                `無念… ${unit.name} 討ち死に！` :
                `敵将・${unit.name}、討ち取ったり！`;
            color = (unit.side === this.playerSide) ? '#aaa' : '#ff0';
        } else {
            // 配下部隊: 「撃破/壊滅」メッセージ
            msg = (unit.side === this.playerSide) ?
                `${unit.warlordName}配下の部隊、壊滅…` :
                `${unit.warlordName}配下の部隊、撃破！`;
            color = (unit.side === this.playerSide) ? '#aaa' : '#ffa500';
        }

        const div = document.createElement('div');
        div.className = 'vic-title';
        div.innerText = msg;
        div.style.position = 'absolute';
        div.style.top = '30%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%,-50%)';
        div.style.color = color;
        div.style.zIndex = 150;
        div.style.pointerEvents = 'none';
        div.style.whiteSpace = 'nowrap';
        document.getElementById('game-container').appendChild(div);
        setTimeout(() => div.remove(), 3000);

        await this.wait(1000);
    }

    // ユーティリティ関数
    speak(unit, type, force = false) {
        if (!force && Math.random() > 0.4) return;
        const lines = DIALOGUE[unit.p]?.[type];
        if (!lines) return;
        const text = lines[Math.floor(Math.random() * lines.length)];

        if (this.renderingEngine) {
            this.renderingEngine.add3DEffect('BUBBLE', {
                unit: unit,
                text: text
            });
        }

        this.activeBubbles.push({
            x: unit.pos.x,
            y: unit.pos.y - 40,
            text: text,
            life: 100
        });
    }

    showFormation(unit, formationName) {
        this.spawnText({ q: unit.q, r: unit.r }, formationName, "#00FFFF", 40);
        this.speak(unit, 'FORMATION'); // 陣形変更時のセリフがあれば
    }

    addEffect(type, start, end, color) {
        if (this.renderingEngine) {
            this.renderingEngine.add3DEffect(type, start, end, color);
        }
    }

    spawnText(pos, text, color, size) {
        if (this.renderingEngine) {
            this.renderingEngine.add3DEffect('FLOAT_TEXT', {
                q: pos.q,
                r: pos.r,
                text: text,
                color: color,
                size: size
            });
        }
    }

    spawnSparks(unit1, unit2) {
        if (this.renderingEngine) {
            this.renderingEngine.add3DEffect('SPARK', {
                q: (unit1.q + unit2.q) / 2,
                r: (unit1.r + unit2.r) / 2
            });
        }
    }

    spawnEffect(type, unit1, unit2) {
        if (this.renderingEngine) {
            this.renderingEngine.add3DEffect(type, { q: unit1.q, r: unit1.r }, { q: unit2.q, r: unit2.r });
        }
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    updateEffects() {
        this.activeEffects.forEach(e => {
            e.life--;
            if (e.type === 'FLOAT_TEXT') {
                e.y -= 0.5;
            } else if (e.type === 'SPARK') {
                // 火花の物理演算（ほとんど動かない小さな閃き）
                e.x += e.vx;
                e.y += e.vy;
                e.vx *= 0.85; // 強い空気抵抗ですぐに減衰
                e.vy *= 0.85;
            }
        });
        this.activeEffects = this.activeEffects.filter(e => e.life > 0);

        this.activeBubbles.forEach(b => b.life--);
        this.activeBubbles = this.activeBubbles.filter(b => b.life > 0);
    }
}
