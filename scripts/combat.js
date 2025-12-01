/**
 * SEKIGAHARA RTS - Combat System
 * 戦闘処理とユニット行動
 */

import { getDist, getDistRaw, getFacingAngle, findPath } from './pathfinding.js';
import { hexToPixel } from './pathfinding.js';
import { DIALOGUE } from './constants.js';
import { generatePortrait } from './rendering.js';

export class CombatSystem {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.activeEffects = [];
        this.activeBubbles = [];
        this.playerSide = 'EAST'; // デフォルト値
    }

    setPlayerSide(side) {
        this.playerSide = side;
    }

    /**
     * ユニットの行動を処理
     */
    async processUnit(unit, allUnits, map, warlordPlotUsed = {}) {
        if (!unit.order) return;

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

        if (getDist(unit, target) <= 5) {
            unit.dir = getFacingAngle(unit.q, unit.r, target.q, target.r);
            this.speak(unit, 'PLOT_DO');
            this.speak(target, 'PLOT_REC');
            await this.spawnEffect('WAVE', unit, target);

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

                    // 本陣ユニットのみ画像を更新
                    if (warlordUnit.imgCanvas) {
                        warlordUnit.imgCanvas = generatePortrait(warlordUnit, warlordUnit.side);
                    }
                });

                this.spawnText(target.pos, "寝返り！", "#0f0", 60);
                this.audioEngine.sfxArrangementSuccess(); // 調略成功SE
            } else {
                this.spawnText(target.pos, "失敗...", "#aaa", 40);
                this.audioEngine.sfxArrangementFail(); // 調略失敗SE
            }

            // 調略使用フラグを立てる（武将単位）
            warlordPlotUsed[unit.warlordId] = true;

            unit.order = null;
            await this.wait(800);
        } else {
            await this.moveUnitStep(unit, target, allUnits);
        }
    }

    /**
     * 攻撃を処理
     */
    async processAttack(unit, target, allUnits, map, reach) {
        if (getDist(unit, target) <= reach) {
            unit.dir = getFacingAngle(unit.q, unit.r, target.q, target.r);
            this.speak(unit, 'ATTACK');
            await this.combat(unit, target, allUnits, map);
        } else {
            const moved = await this.moveUnitStep(unit, target, allUnits);
            if (!moved && getDist(unit, target) <= reach + 1.0) {
                unit.dir = getFacingAngle(unit.q, unit.r, target.q, target.r);
                this.speak(unit, 'ATTACK');
                await this.combat(unit, target, allUnits, map);
            }
        }
    }

    /**
     * 移動を処理
     */
    async processMove(unit, allUnits) {
        const dest = unit.order.targetHex;
        if (getDistRaw(unit.q, unit.r, dest.q, dest.r) === 0) {
            unit.order = null;
        } else {
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
        this.addEffect('BEAM', att.pos, def.pos, '#ffaa00');
        siegers.forEach(s => this.addEffect('BEAM', s.pos, def.pos, '#ffaa00'));

        // 戦闘エフェクト: 土煙と火花を追加
        this.addEffect('DUST', def.pos, null, null);
        this.spawnSparks(att.pos, def.pos); // 攻撃側と防御側の間に火花

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

        if (dirMsg) this.spawnText(def.pos, dirMsg, "#ffff00", 40);

        // ダメージ計算
        let dmgToDef = Math.floor((Math.sqrt(att.soldiers) * att.atk * mod * dirMod) / (def.def / 15));
        if (dmgToDef < 10) dmgToDef = 10;
        const dmgToAtt = Math.floor(dmgToDef * 0.2);

        def.soldiers -= dmgToDef;
        att.soldiers -= dmgToAtt;
        this.spawnText(def.pos, `-${dmgToDef}`, '#ff3333', 60);
        this.spawnText(att.pos, `-${dmgToAtt}`, '#ff8888', 60);
        this.speak(def, 'DAMAGED');

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
        this.activeBubbles.push({
            x: unit.pos.x,
            y: unit.pos.y - 40,
            text: text,
            life: 100
        });
    }

    addEffect(type, p1, p2, color) {
        this.activeEffects.push({
            type: type,
            x: p1.x,
            y: p1.y,
            tx: p2?.x,
            ty: p2?.y,
            color: color,
            life: 30
        });
    }

    spawnText(pos, text, color, life) {
        this.activeEffects.push({
            type: 'FLOAT_TEXT',
            x: pos.x,
            y: pos.y - 30,
            text: text,
            color: color,
            life: life
        });
    }

    async spawnEffect(type, u1, u2) {
        if (type === 'WAVE') {
            this.activeEffects.push({
                type: 'WAVE',
                x: u1.pos.x,
                y: u1.pos.y,
                tx: u2.pos.x,
                ty: u2.pos.y,
                life: 40
            });
        }
        await this.wait(600);
    }

    /**
     * 火花エフェクトを生成（攻撃側と防御側の間で閃く小さな光）
     * @param {Object} attPos - 攻撃側の位置
     * @param {Object} defPos - 防御側の位置
     */
    spawnSparks(attPos, defPos) {
        // 攻撃側と防御側の中間点
        const midX = (attPos.x + defPos.x) / 2;
        const midY = (attPos.y + defPos.y) / 2;

        // 15個の小さな火花を中間点付近の狭い範囲に生成
        for (let i = 0; i < 15; i++) {
            // 中間点付近の狭い範囲（±12px）にランダムに配置
            const offsetX = (Math.random() - 0.5) * 24;
            const offsetY = (Math.random() - 0.5) * 24;

            // ごくわずかなランダムな動き
            const vx = (Math.random() - 0.5) * 0.5;
            const vy = (Math.random() - 0.5) * 0.5;

            this.activeEffects.push({
                type: 'SPARK',
                x: midX + offsetX,
                y: midY + offsetY,
                vx: vx,
                vy: vy,
                life: 8 + Math.random() * 8,  // 短い寿命（8-16フレーム）
                maxLife: 16
            });
        }
    }

    wait(ms) {
        return new Promise(r => setTimeout(r, ms));
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
