/**
 * SEKIGAHARA RTS - Combat System
 * 戦闘処理とユニット行動
 */

import { getDist, getDistRaw, getFacingAngle, findPath, getDistAttack } from './pathfinding.js';
import { TERRAIN_TYPES } from './map.js';
import { hexToPixel } from './pathfinding.js';
import { DIALOGUE, UNIT_TYPES, UNIT_TYPE_NORMAL, UNIT_TYPE_HEADQUARTERS, TILE_HEIGHT } from './constants.js';
import { getFormationModifiers, checkForcedFormationChange, calculateFormationTargets } from './formation.js';
import { ATTACK_PATTERNS, rotatePattern } from './attack-patterns.js';

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

    setGame(game) {
        this.game = game;
    }

    /**
     * 現在のアクション速度を取得
     * @returns {number} 速度倍率 (1.0, 1.5, 2.0)
     */
    getActionSpeed() {
        return this.game ? this.game.actionSpeed : 1.0;
    }

    /**
     * ユニットの行動を処理
     */
    async processUnit(unit, allUnits, map, warlordPlotUsed = {}) {
        if (!unit.order) return;

        // アクティブマーカーを表示
        if (this.renderingEngine && this.renderingEngine.showActiveMarker) {
            this.renderingEngine.showActiveMarker(unit);
        }

        try {
            // 本陣ユニットの場合、兵力による強制陣形変更をチェック
            if (unit.unitType === UNIT_TYPE_HEADQUARTERS && this.unitManager) {
                const forceChange = checkForcedFormationChange(unit.soldiers, unit.formation);
                if (forceChange.needsChange) {
                    unit.formation = forceChange.newFormation;
                    const info = FORMATION_INFO[forceChange.newFormation];
                    this.showFormation(unit, info.nameShort);
                }
            }

            const target = allUnits.find(u => u.id === unit.order.targetId);
            const reach = (unit.size + (target ? target.size : 1)) / 2.0 + 0.5;

            if (unit.order.type === 'PLOT' && target && !target.dead) {
                await this.processPlot(unit, target, allUnits, warlordPlotUsed, map);
            } else if (unit.order.type === 'ATTACK' && target && !target.dead) {
                await this.processAttack(unit, target, allUnits, map, reach);
            } else if (unit.order.type === 'MOVE') {
                await this.processMove(unit, allUnits, map);
            }
        } finally {
            // アクティブマーカーを非表示
            if (this.renderingEngine && this.renderingEngine.hideActiveMarker) {
                this.renderingEngine.hideActiveMarker();
            }
        }

        // 行動完了フラグを設定（行動フェイズで行動済みとして静止させる）
        unit.hasActed = true;
    }

    /**
     * 調略を処理
     * マルチユニットシステム: 1武将1ターン1回のみ
     */
    async processPlot(unit, target, allUnits, warlordPlotUsed = {}, map) {
        // この武将がすでに調略を使用済みかチェック
        if (warlordPlotUsed[unit.warlordId]) {
            // 調略をスキップして移動に切り替え
            unit.order = { type: 'MOVE', targetHex: { x: target.x, y: target.y } };
            await this.processMove(unit, allUnits, map);
            return;
        }

        const dist = getDistAttack(unit, target);

        // 調略射程(5) + 陣形解除距離(3)
        const engagementDist = 8.0;

        if (dist <= 5) {
            unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
            this.speak(unit, 'PLOT_DO');
            this.speak(target, 'PLOT_REC');
            await this.spawnEffect('WAVE', unit, target);

            // エフェクトを見せるためのウェイト
            await this.wait(400);

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

                targetWarlordUnits.forEach(warlordUnit => {
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

                this.spawnText({ q: target.x, r: target.y }, "寝返り！", "#0f0", 60);
                this.audioEngine.sfxArrangementSuccess(); // 調略成功SE

                // 画面中央にフローメッセージを表示（潰走演出と同様）
                const defectionMsg = (unit.side === this.playerSide)
                    ? `${target.warlordName}が味方についた模様！`
                    : `${target.warlordName}が敵に寝返った模様！`;
                const defectionColor = (unit.side === this.playerSide) ? '#00ff88' : '#ff4444';

                const div = document.createElement('div');
                div.className = 'vic-title';
                div.innerText = defectionMsg;
                div.style.position = 'absolute';
                div.style.top = '30%';
                div.style.left = '50%';
                div.style.transform = 'translate(-50%,-50%)';
                div.style.color = defectionColor;
                div.style.zIndex = 150;
                div.style.pointerEvents = 'none';
                div.style.whiteSpace = 'nowrap';
                div.style.fontSize = '32px';
                div.style.textShadow = '2px 2px 4px #000';
                document.getElementById('game-container').appendChild(div);
                setTimeout(() => div.remove(), 3000);
            } else {
                this.spawnText({ q: target.x, r: target.y }, "失敗...", "#aaa", 40);
                this.audioEngine.sfxArrangementFail(); // 調略失敗SE
            }

            // 調略使用フラグを立てる（武将単位）
            warlordPlotUsed[unit.warlordId] = true;

            unit.order = null;
            await this.wait(400);
        } else if (dist > engagementDist) {
            // まだ遠い場合は陣形を維持して移動
            const originalOrder = unit.order;
            unit.order = {
                type: 'MOVE',
                targetHex: { x: target.x, y: target.y },
                originalTargetId: target.id
            };

            await this.processMove(unit, allUnits, map);

            // 命令復帰
            if (unit.order === null && getDist(unit, target) > 5) {
                unit.order = originalOrder;
            } else {
                unit.order = originalOrder;
            }
        } else {
            await this.moveUnitStep(unit, target, allUnits, map);
        }
    }

    /**
     * 攻撃を処理
     */
    /**
     * 攻撃を処理
     */
    async processAttack(unit, target, allUnits, map, reach) {
        let hasAttackedThisPhase = false;
        // スクエアグリッドに伴い、距離判定を厳格化（チェビシェフ距離を使用）
        const dist = getDistAttack(unit, target);

        // 接敵するまでは陣形で近づく
        // reach + 3.0 くらいまでは陣形で整然と近づき、そこから個別に襲いかかるイメージ
        const engagementDist = reach + 3.0;

        // ユニットが遠距離攻撃可能かチェック
        // unit.type は兵種（INFANTRY, ARCHER等）、unit.unitType は役割（NORMAL, HEADQUARTERS）
        const unitCombatType = unit.type || 'INFANTRY';
        const typeInfo = UNIT_TYPES[unitCombatType] || UNIT_TYPES.INFANTRY;
        const rangeType = typeInfo.rangeType || 'melee';

        // 遠距離攻撃可能なユニットタイプ
        const canRangedAttack = ['bowArc', 'longArc', 'siege', 'aoe', 'breath', 'heal'].includes(rangeType);

        // 弓攻撃の射程（基本射程8、高さによる補正はダメージのみ適用）
        let bowBaseRange = 8;
        // マジック/ブレス/大砲は射程が異なる
        if (rangeType === 'aoe') bowBaseRange = 6;
        if (rangeType === 'breath') bowBaseRange = 4;
        if (rangeType === 'siege') bowBaseRange = 12;
        if (rangeType === 'heal') bowBaseRange = 5;

        const bowMinRange = 2; // 最小射程2（1マスは射程外）

        // 高い位置にいる弓兵の射程拡張（移動できない場合の救済措置）
        let extendedBowRange = bowBaseRange;
        if (canRangedAttack && this.mapSystem) {
            const unitZ = this.mapSystem.getHeight(unit.x, unit.y);
            const targetZ = this.mapSystem.getHeight(target.x, target.y);
            const heightDiff = unitZ - targetZ;
            // 自分が相手より高い場合、1段差ごとに射程+1（最大+4まで）
            if (heightDiff > 0) {
                const heightInGrids = Math.floor(heightDiff / TILE_HEIGHT);
                extendedBowRange = Math.min(bowBaseRange + heightInGrids, bowBaseRange + 4);
            }
        }

        // 弓が使える距離かどうか判定
        const canUseBow = canRangedAttack ? (d) => d >= bowMinRange && d <= extendedBowRange : () => false;

        // 弓兵デバッグ（各判定ごとに出力）
        if (canRangedAttack && target) {
            // 弓兵デバッグログ（必要な場合は有効化）
            // console.log('[ARCHER] ' + unit.name + ' dist=' + dist + ' reach=' + reach + ' canRangedAttack=' + canRangedAttack + ' canUseBow=' + canUseBow(dist) + ' inMelee=' + (dist <= reach));
        }

        // 高さ制限チェック（近接攻撃時）
        // 城壁上の敵には近接攻撃不可。段差2（32 world units）までは近接攻撃可能
        let canMeleeAttack = true;
        if (dist <= reach && this.mapSystem) {
            const unitZ = this.mapSystem.getHeight(unit.x, unit.y);
            const targetZ = this.mapSystem.getHeight(target.x, target.y);
            const heightDiff = Math.abs(targetZ - unitZ);
            // 段差2以上（32 world units = 2 * TILE_HEIGHT）なら近接攻撃不可
            // これにより城壁（通常40+world units）上の敵に地上から直接攻撃できなくなる
            const MAX_MELEE_HEIGHT_DIFF = 2 * TILE_HEIGHT; // 32 world units
            if (heightDiff > MAX_MELEE_HEIGHT_DIFF) {
                canMeleeAttack = false;
            }
        }

        if (dist <= reach && canMeleeAttack) {
            // 攻撃射程内なら近接攻撃実行
            unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
            this.speak(unit, 'ATTACK');
            await this.combat(unit, target, allUnits, map);
            hasAttackedThisPhase = true;
        } else if (canUseBow(dist)) {
            // 弓攻撃射程内（最小射程以上、最大射程まで）なら遠距離攻撃
            unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
            await this.rangedCombat(unit, target, map, allUnits);
            hasAttackedThisPhase = true;
        } else if (canRangedAttack && dist <= extendedBowRange) {
            // 弓兵が拡張射程内にいる場合は移動せずに攻撃
            unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
            await this.rangedCombat(unit, target, map, allUnits);
            hasAttackedThisPhase = true;
        } else if (canRangedAttack && this.mapSystem) {
            // 弓兵が高い位置にいる場合、移動を諦めてその場から攻撃
            const unitZ = this.mapSystem.getHeight(unit.x, unit.y);
            const targetZ = this.mapSystem.getHeight(target.x, target.y);
            const heightDiff = unitZ - targetZ;
            // 自分が2段差超高い場合は移動せずに攻撃（城壁対応）
            if (heightDiff > 2 * TILE_HEIGHT) {
                unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                await this.rangedCombat(unit, target, map, allUnits);
                hasAttackedThisPhase = true;
                return;
            }
        }

        if (dist > engagementDist || (dist <= reach && !canMeleeAttack)) {
            // 遠い場合、または近接攻撃できない高さ差がある場合は移動
            // 弓射程内なら先に弓を撃つ
            if (!hasAttackedThisPhase && canUseBow(dist)) {
                unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                await this.rangedCombat(unit, target, map, allUnits);
                hasAttackedThisPhase = true;
                // 弓攻撃後、まだ距離があれば陣形で近づく
            }

            // 陣形を維持して移動
            // 一時的にMOVE命令のフリをしてprocessMoveを呼ぶ（ただしターゲットは維持）
            // processMoveは内部で陣形位置を計算して移動する

            // 重要: processMoveは unit.order.targetHex を参照するので、一時的にセットする
            const originalOrder = unit.order;
            unit.order = {
                type: 'MOVE',
                targetHex: { x: target.x, y: target.y },
                // 元のターゲット情報を保持して、陣形計算時の本陣の向き決定などに使う
                originalTargetId: target.id
            };

            await this.processMove(unit, allUnits, map);

            // 移動後に攻撃可能かチェック（特に弓兵用）
            const newDist = getDistAttack(unit, target);
            if (!hasAttackedThisPhase && newDist <= reach) {
                // 近接攻撃射程内
                unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                this.speak(unit, 'ATTACK');
                await this.combat(unit, target, allUnits, map);
                hasAttackedThisPhase = true;
            } else if (!hasAttackedThisPhase && canUseBow(newDist)) {
                // 弓射程内なら遠距離攻撃
                unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                await this.rangedCombat(unit, target, map, allUnits);
                hasAttackedThisPhase = true;
            }

            // 命令を元に戻す（次ターンも攻撃を継続するため）
            // processMove内で目的地に着くとorderがnullになることがあるので注意
            if (unit.order === null && getDistAttack(unit, target) > reach) {
                // まだ届いていないのにMove完了扱いでnullになった場合、攻撃命令を復帰させる
                unit.order = originalOrder;
            } else {
                // まだ移動中なら、次のターンも攻撃命令として処理したいので復帰
                unit.order = originalOrder;
            }
        } else {
            // 接敵距離に入ったら、個別にターゲットへ殺到する
            const moved = await this.moveUnitStep(unit, target, allUnits, map);
            // 移動後に再チェック
            const newDist = getDistAttack(unit, target);
            if (!hasAttackedThisPhase && newDist <= reach) {
                unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                this.speak(unit, 'ATTACK');
                await this.combat(unit, target, allUnits, map);
                hasAttackedThisPhase = true;
            } else if (!hasAttackedThisPhase && canUseBow(newDist)) {
                // 移動後に弓射程内なら遠距離攻撃
                unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                await this.rangedCombat(unit, target, map, allUnits);
                hasAttackedThisPhase = true;
            }
        }
    }

    /**
     * 遠距離攻撃を実行（旧版 — 後方定義により上書きされるデッドコード）
     * @param {Object} att - 攻撃者
     * @param {Object} def - 防御者
     * @param {Array} map - マップデータ
     * @param {Array} allUnits - 全ユニット配列
     */
    async rangedCombat(att, def, map, allUnits = []) {
        att.dir = getFacingAngle(att.x, att.y, def.x, def.y);

        // 攻撃アニメーションをトリガー (必須)
        if (this.renderingEngine && this.renderingEngine.triggerUnitAttackAnimation) {
            this.renderingEngine.triggerUnitAttackAnimation(att.id, def.id);
        }

        // 攻撃予備動作待ち
        await this.wait(300);

        // ... targetZ calc ...

        let attZ = (map[att.y]?.[att.x]?.z || 0) * TILE_HEIGHT;
        let defZ = (map[def.y]?.[def.x]?.z || 0) * TILE_HEIGHT;
        if (this.mapSystem) {
            attZ = Math.max(attZ, this.mapSystem.getHeight(att.x, att.y));
            defZ = Math.max(defZ, this.mapSystem.getHeight(def.x, def.y));
        }

        // 高さ差チェック: 段差2（32 world units）を超える場合は攻撃不可
        const heightDiff = defZ - attZ;
        const MAX_HEIGHT_DIFF = 2 * TILE_HEIGHT; // 32 world units

        if (heightDiff > MAX_HEIGHT_DIFF) {
            this.spawnText({ q: att.x, r: att.y }, "届かない!", '#888', 40);
            await this.wait(300);
            return;
        }

        // ユニットタイプに応じた攻撃演出
        const typeInfo = UNIT_TYPES[att.type] || UNIT_TYPES.INFANTRY;
        const rangeType = typeInfo.rangeType || 'bowArc';

        if (rangeType === 'aoe') {
            // 魔術師：魔法弾またはエフェクト
            this.audioEngine.sfxMagicAtk && this.audioEngine.sfxMagicAtk();
            // TODO: マジックエフェクト実装。とりあえず矢ではなくビームか何か
            if (this.renderingEngine && this.renderingEngine.add3DEffect) {
                // 魔法陣など?
                this.renderingEngine.add3DEffect('MAGIC_CAST', att);
            }
            // 魔法弾飛ばす
            if (this.renderingEngine && this.renderingEngine.spawnMagicProjectile) {
                await this.renderingEngine.spawnMagicProjectile(att, def); // 要実装
            } else {
                // フォールバック: ビーム
                this.addEffect('BEAM', { q: att.x, r: att.y }, { q: def.x, r: def.y }, '#AA00FF');
                await this.wait(200);
            }

        } else if (rangeType === 'breath') {
            // ドラゴン：ブレス
            this.audioEngine.sfxBreath && this.audioEngine.sfxBreath();
            if (this.renderingEngine && this.renderingEngine.add3DEffect) {
                this.renderingEngine.add3DEffect('BREATH', att, def);
            }
            await this.wait(500);

        } else {
            // 弓・銃・大砲
            // 遮蔽チェック
            const blockInfo = this.isArrowPathBlocked(att, def, map);

            // 矢のアニメーションを発射
            if (this.renderingEngine && this.renderingEngine.spawnArrowAnimation) {
                // 銃の場合は弾丸速度などを変えたいが、とりあえず矢で統一
                await this.renderingEngine.spawnArrowAnimation(att, def, blockInfo);
            }

            if (blockInfo.blocked) {
                this.spawnText({ q: blockInfo.blockPos.x, r: blockInfo.blockPos.y }, "遮蔽!", '#888', 40);
                await this.wait(300);
                return;
            }

            // ヒットSE
            this.audioEngine.sfxHit();
        }
        // ---------------------------------------------------------
    }

    /**
     * 移動を処理
     * 本陣の場合は陣形制限をチェック
     */
    async processMove(unit, allUnits, map) {
        let dest = unit.order.targetHex;

        // ---------------------------------------------------------
        // 陣形移動ロジック (配下ユニットの場合)
        // ---------------------------------------------------------
        if (unit.unitType !== UNIT_TYPE_HEADQUARTERS) {
            // 本陣を探す
            const hq = allUnits.find(u => u.warlordId === unit.warlordId && u.unitType === UNIT_TYPE_HEADQUARTERS && !u.dead);

            if (hq && hq.formation) {
                // 配下ユニットリストを取得（自分を含む、ID順でソートして一貫性を保つ）
                const subordinates = allUnits
                    .filter(u => u.warlordId === unit.warlordId && u.unitType !== UNIT_TYPE_HEADQUARTERS && !u.dead)
                    .sort((a, b) => a.id - b.id);

                // 本陣の向きを決定（移動中なら移動方向、そうでなければ現在の向き）
                let baseDir = hq.dir;
                if (hq.order && hq.order.targetHex) {
                    // 移動目標がある場合はそちらを向く
                    baseDir = getFacingAngle(hq.x, hq.y, hq.order.targetHex.x, hq.order.targetHex.y);
                }

                // 陣形ターゲットを計算（本陣の現在位置を基準、地形考慮）
                const targets = calculateFormationTargets({ ...hq, dir: baseDir }, subordinates, this.mapSystem);

                if (targets && targets.has(unit.id)) {
                    const formDest = targets.get(unit.id);
                    // 簡易的に、ターゲットが敵ユニットでない（単なる移動）なら陣形位置を優先
                    if (dest.id === undefined) {
                        dest = formDest;
                    }
                }
            }
        }
        // ---------------------------------------------------------
        if (getDistRaw(unit.x, unit.y, dest.x, dest.y) === 0) {
            unit.order = null;
        } else {
            // 本陣の場合、配下の追従を待つ（足並みを揃える）処理
            // ただし、戦闘時に敵ユニットに向かって移動する場合（dest.idがある）は待機しない
            const isCombatMove = (dest.id !== undefined);
            if (unit.unitType === UNIT_TYPE_HEADQUARTERS && this.unitManager && !isCombatMove) {
                // 1. 緊急回避チェック：近くに敵がいる場合はなりふり構わず動く
                let enemyNearby = false;
                for (const other of allUnits) {
                    if (other.side !== unit.side && !other.dead && getDistRaw(unit.x, unit.y, other.x, other.y) <= 2) {
                        enemyNearby = true;
                        break;
                    }
                }

                if (!enemyNearby) {
                    const subordinates = this.unitManager.getUnitsByWarlordId(unit.warlordId)
                        .filter(u => !u.dead && u.unitType !== UNIT_TYPE_HEADQUARTERS);

                    if (subordinates.length > 0) {
                        // 周囲6HEX以内にいる配下をカウント（地形による遅れを考慮して緩和）
                        const nearbySubordinates = subordinates.filter(u => getDistRaw(unit.x, unit.y, u.x, u.y) <= 6);
                        const ratio = nearbySubordinates.length / subordinates.length;

                        // 配下の50%以上が近くにいないなら、移動を待機
                        if (ratio < 0.5) {
                            this.spawnText({ q: unit.x, r: unit.y }, "軍待ち...", "#aaa", 40);
                            await this.wait(200); // 少しだけウェイトを入れて雰囲気を出す
                            return; // 移動スキップ
                        }
                    }
                }
            }

            await this.moveUnitStep(unit, dest, allUnits, map);
        }
    }

    /**
     * ユニットを移動（パスファインディング使用）
     * 包囲移動をサポート
     */
    async moveUnitStep(unit, dest, allUnits, map) {
        let targetQ = dest.x;
        let targetR = dest.y;

        // 目標がユニット（攻撃対象）の場合、包囲位置を探す
        if (dest.id !== undefined) {
            const surroundPos = this.findSurroundPosition(unit, dest, allUnits);
            if (surroundPos) {
                targetQ = surroundPos.x;
                targetR = surroundPos.y;
            }
        }

        const path = findPath(unit.x, unit.y, targetQ, targetR, allUnits, unit, this.mapSystem);
        let moves = unit.movePower || 6;
        let actuallyMoved = false;

        // ユニット位置の高速検索用Mapを作成 (移動中の衝突判定用)
        // 他のユニットは動かない前提 (ターン制/順次処理)
        const unitMap = new Map();
        for (const u of allUnits) {
            if (!u.dead && u.id !== unit.id) {
                unitMap.set(`${u.x},${u.y}`, u);
            }
        }

        for (let i = 1; i < path.length && moves > 0; i++) {
            const next = path[i];

            // 移動コスト計算（高低差を考慮）- ブロッカーチェックより前に実行
            let cost = 1;
            if (this.mapSystem) {
                // mapSystem.getMoveCostを使う（高低差・建物を考慮）
                const canFly = unit.canFly || unit.type === 'FLYING';
                cost = this.mapSystem.getMoveCost(
                    { x: unit.x, y: unit.y },
                    { x: next.x, y: next.y },
                    canFly
                );
            } else if (map && map[next.y] && map[next.y][next.x]) {
                // フォールバック: 地形タイプのみ
                const t = map[next.y][next.x];
                if (TERRAIN_TYPES[t.type]) {
                    cost = TERRAIN_TYPES[t.type].moveCost;
                }
            }

            // 無限コスト（移動不可）なら停止
            if (cost === Infinity || cost >= 999) break;

            // 移動力不足なら停止
            if (moves < cost) break;

            // ブロッカーチェック（コストチェック後）
            // Mapを使用して高速化 (O(N) -> O(1))
            const blocker = unitMap.get(`${next.x},${next.y}`);

            // 半径チェックも考慮する場合、厳密には周囲も見る必要があるが、
            // グリッドベース移動なので「同じタイルにいるか」で判定して問題ないはず。
            // 以前のコードは getDistRaw < (r1+r2) で判定していたが、グリッド上では距離0（同座標）の判定とほぼ同義。
            // ただし、大型ユニット(2x2)の場合は注意が必要だが、現状は1x1前提で最適化。

            unit.dir = getFacingAngle(unit.x, unit.y, next.x, next.y);

            if (blocker) {
                // 味方ユニットなら位置交換（Swap）を行う
                if (blocker.side === unit.side) {
                    // blockerをunitの元いた位置に移動させる
                    // Mapも更新する必要がある

                    // 1. Mapからblockerを削除
                    unitMap.delete(`${blocker.x},${blocker.y}`);

                    blocker.x = unit.x;
                    blocker.y = unit.y;
                    blocker.pos = hexToPixel(blocker.x, blocker.y);

                    // 2. Mapにblockerの新しい位置を登録
                    unitMap.set(`${blocker.x},${blocker.y}`, blocker);

                    // unitは予定通りnextへ進む
                    unit.x = next.x;
                    unit.y = next.y;
                    unit.pos = hexToPixel(unit.x, unit.y);

                    // unitはMapに入っていないので更新不要（他ユニットとの衝突判定用なので）

                    actuallyMoved = true;
                    moves -= cost;

                    // ---------------------------------------------------------
                    // 射程内停止ロジック（遠距離攻撃ユニット用）
                    // ---------------------------------------------------------
                    if (unit.order && unit.order.originalTargetId) {
                        const targetUnit = allUnits.find(u => u.id === unit.order.originalTargetId);
                        if (targetUnit) {
                            // 自分の射程タイプを確認
                            const typeInfo = UNIT_TYPES[unit.type] || UNIT_TYPES.INFANTRY;
                            const rangeType = typeInfo.rangeType || 'melee';
                            const isRanged = ['bowArc', 'longArc', 'siege', 'aoe', 'breath', 'heal'].includes(rangeType);

                            if (isRanged) {
                                // 現在の射程範囲を計算（高低差ボーナス込み）
                                let currentRange = 8; // default
                                if (rangeType === 'aoe') currentRange = 6;
                                if (rangeType === 'breath') currentRange = 4;
                                if (rangeType === 'siege') currentRange = 12;
                                if (rangeType === 'heal') currentRange = 5;

                                if (this.mapSystem) {
                                    const uZ = this.mapSystem.getHeight(unit.x, unit.y);
                                    const tZ = this.mapSystem.getHeight(targetUnit.x, targetUnit.y);
                                    if (uZ > tZ) {
                                        const hDiff = Math.floor((uZ - tZ) / 16);
                                        currentRange = Math.min(currentRange + hDiff, currentRange + 4);
                                    }
                                }

                                const distToTarget = getDistAttack(unit, targetUnit); // スクエア距離
                                const minRange = 2; // bowMinRange

                                // 射程内に入ったら移動終了（その場から攻撃へ）
                                if (distToTarget >= minRange && distToTarget <= currentRange) {
                                    // 移動リソースを0にしてループを抜ける
                                    moves = 0;
                                    break;
                                }
                            }
                        }
                    }
                    // ---------------------------------------------------------

                    await this.wait(20);
                    continue;
                } else {
                    // 敵なら移動不可
                    return actuallyMoved;
                }
            }

            // 通常移動実行
            unit.x = next.x;
            unit.y = next.y;
            unit.pos = hexToPixel(unit.x, unit.y);
            actuallyMoved = true;
            moves -= cost;
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

        // 移動可能な最大高低差（段差2まで = 32 world units）
        const MAX_WALKABLE_HEIGHT_DIFF = 2 * TILE_HEIGHT;

        // 目標の周囲6方向をチェック（スクエアグリッドでは4方向）
        const surroundPositions = [];
        for (const [dx, dy] of directions) {
            const nx = target.x + dx;
            const ny = target.y + dy;

            // 高低差チェック（移動可能か）
            if (this.mapSystem) {
                const unitZ = this.mapSystem.getHeight(unit.x, unit.y);
                const targetZ = this.mapSystem.getHeight(nx, ny);
                const heightDiff = Math.abs(targetZ - unitZ);
                if (heightDiff > MAX_WALKABLE_HEIGHT_DIFF) {
                    continue; // 移動不可なのでスキップ
                }
            }

            // 空いているかチェック
            const isOccupied = allUnits.some(u =>
                u.id !== unit.id &&
                !u.dead &&
                getDistRaw(nx, ny, u.x, u.y) < (unit.radius + u.radius)
            );

            if (!isOccupied) {
                const dist = getDistRaw(unit.x, unit.y, nx, ny);
                surroundPositions.push({ x: nx, y: ny, dist });
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
        att.dir = getFacingAngle(att.x, att.y, def.x, def.y);

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
        this.addEffect('BEAM', { q: att.x, r: att.y }, { q: def.x, r: def.y }, '#ffaa00');

        // 陣営色を取得するローカル関数
        const getSideColor = (side) => {
            if (side === 'EAST') return 0x6666FF; // 青（少し明るめ）
            if (side === 'WEST') return 0xFF4444; // 赤
            return 0xAAAAAA;
        };

        // 攻撃ユニットを少し光らせる
        this.addEffect('UNIT_FLASH', { unitId: att.id, color: getSideColor(att.side), duration: 10 });

        siegers.forEach(s => {
            const siegeColor = getSideColor(s.side);
            this.addEffect('BEAM', { q: s.x, r: s.y }, { q: def.x, r: def.y }, '#ffaa00');
            // 包囲参加ユニットのHEXを点滅させる
            this.addEffect('HEX_FLASH', { q: s.x, r: s.y, color: siegeColor });
            // ユニット自体も少し光らせる
            this.addEffect('UNIT_FLASH', { unitId: s.id, color: siegeColor, duration: 30 });
        });

        // 戦闘エフェクト: 土煙と火花を追加
        this.addEffect('DUST', { q: def.x, r: def.y }, null, null);
        // 攻撃アニメーション（突撃）
        if (this.renderingEngine && this.renderingEngine.triggerUnitAttackAnimation) {
            this.renderingEngine.triggerUnitAttackAnimation(att.id, def.id);
            siegers.forEach(s => {
                this.renderingEngine.triggerUnitAttackAnimation(s.id, def.id);
            });
        }

        // 突撃の予備動作時間（少し待ってからエフェクト）
        await this.wait(150);

        this.spawnSparks(att, def); // 攻撃側と防御側の間に火花

        this.audioEngine.sfxHit();
        await this.wait(300);

        // 地形ボーナス（建物の高さを考慮）
        // 単位を世界単位（world units）で統一

        let hAtt = (map[att.y]?.[att.x]?.z || 0) * TILE_HEIGHT; // グリッド単位→世界単位
        let hDef = (map[def.y]?.[def.x]?.z || 0) * TILE_HEIGHT; // グリッド単位→世界単位

        // mapSystemがある場合は建物の高さも考慮（キャッシュ付き）
        // どちらも世界単位なので正しく比較できる
        if (this.mapSystem) {
            hAtt = Math.max(hAtt, this.mapSystem.getHeight(att.x, att.y));
            hDef = Math.max(hDef, this.mapSystem.getHeight(def.x, def.y));
        }

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

        if (dirMsg) this.spawnText({ q: def.x, r: def.y }, dirMsg, "#ffff00", 40);

        // 陣形によるステータス修正
        const attFormation = getFormationModifiers(att.formation);
        const defFormation = getFormationModifiers(def.formation);
        const finalAtkStat = att.atk + attFormation.atk;
        const finalDefStat = def.def + defFormation.def;

        // 入力値の検証（NaN発生源の特定用）
        if (typeof att.atk !== 'number' || typeof att.soldiers !== 'number' ||
            typeof def.def !== 'number' || typeof def.soldiers !== 'number') {
            // Invalid unit data - skip with safe defaults
        }

        // ダメージ計算（陣形修正を適用）
        // 安全な兵士数（負やNaNを防止）
        const safeSoldiers = (typeof att.soldiers === 'number' && att.soldiers > 0) ? att.soldiers : 1;
        let dmgToDef = Math.floor((Math.sqrt(safeSoldiers) * finalAtkStat * mod * dirMod) / (finalDefStat / 15));
        if (!Number.isFinite(dmgToDef) || dmgToDef < 10) dmgToDef = 10;

        // ダメージ適用（被攻撃側のみ）
        def.soldiers -= dmgToDef;
        this.spawnText({ q: def.x, r: def.y }, `-${dmgToDef}`, '#ff3333', 60);
        this.speak(def, 'DAMAGED');

        // 被ダメージアニメーションをトリガー
        if (this.renderingEngine && this.renderingEngine.triggerDamageAnimation) {
            this.renderingEngine.triggerDamageAnimation(def.id);
        }

        // 3Dレンダラー側のユニット情報を更新（兵士数ゲージなど）
        if (this.renderingEngine && this.renderingEngine.updateUnitInfo) {
            // ユニットメッシュを取得して更新
            const attMesh = this.renderingEngine.unitMeshes.get(att.id);
            const defMesh = this.renderingEngine.unitMeshes.get(def.id);
            if (attMesh) this.renderingEngine.updateUnitInfo(attMesh, att);
            if (defMesh) this.renderingEngine.updateUnitInfo(defMesh, def);
        }

        // 死亡判定（NaNの場合も死亡として扱う）
        if (def.soldiers <= 0 || isNaN(def.soldiers)) {
            def.soldiers = 0;
            def.dead = true;
            // 死亡アニメーションをトリガー（フェードアウト付き）
            if (this.renderingEngine && this.renderingEngine.triggerDeathAnimation) {
                this.renderingEngine.triggerDeathAnimation(def.id);
            }
            await this.dramaticDeath(def, att.side);
        }
        // 注: 攻撃側はダメージを受けないため、死亡判定は不要

        // ---------------------------------------------------------
        // 騎兵押し出し（CAVALRY: canPushBack === true）
        // 攻撃方向に防御側を1マス押し戻す
        // ---------------------------------------------------------
        const attTypeInfo = UNIT_TYPES[att.type] || UNIT_TYPES.INFANTRY;
        if (attTypeInfo.canPushBack && !def.dead) {
            // 攻撃者から防御者への方向ベクトルを計算
            const pushDx = Math.sign(def.x - att.x);
            const pushDy = Math.sign(def.y - att.y);
            // 方向が算出できない場合（同じマスに居る等）はスキップ
            if (pushDx !== 0 || pushDy !== 0) {
                const newX = def.x + pushDx;
                const newY = def.y + pushDy;

                // 押し出し先が有効かチェック
                let canPush = true;

                // マップ範囲チェック
                if (newX < 0 || newY < 0 || !map[newY] || !map[newY][newX]) {
                    canPush = false;
                }

                // 他のユニットが占有していないかチェック
                if (canPush && allUnits) {
                    const occupied = allUnits.find(u =>
                        !u.dead && u.id !== def.id && u.x === newX && u.y === newY
                    );
                    if (occupied) canPush = false;
                }

                // 高低差チェック（段差2まで = 32 world units）
                if (canPush && this.mapSystem) {
                    const currentZ = this.mapSystem.getHeight(def.x, def.y);
                    const targetZ = this.mapSystem.getHeight(newX, newY);
                    if (Math.abs(targetZ - currentZ) > 2 * TILE_HEIGHT) {
                        canPush = false;
                    }
                }

                if (canPush) {
                    def.x = newX;
                    def.y = newY;
                    def.pos = hexToPixel(def.x, def.y);
                    this.spawnText({ q: def.x, r: def.y }, '押出!', '#ffaa00', 40);
                    // 3Dレンダラー側の位置を更新
                    if (this.renderingEngine && this.renderingEngine.updateUnitInfo) {
                        const defMesh = this.renderingEngine.unitMeshes.get(def.id);
                        if (defMesh) this.renderingEngine.updateUnitInfo(defMesh, def);
                    }
                }
            }
        }

        await this.wait(200);
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
            // 総大将判定
            const isCommander = (unit.name === "徳川家康" || unit.name === "石田三成");

            if (unit.side !== this.playerSide) {
                // 敵本陣の場合、討ち死にか敗走かをランダムで決定
                // 将来的には士気などが関わる予定
                if (Math.random() < 0.5) {
                    // パターンA: 敗走（撤退）
                    if (isCommander) {
                        msg = `敵総大将・${unit.name}、戦場より撤退！`;
                    } else {
                        msg = `${unit.name}、戦場より撤退！`;
                    }
                    color = '#ffa500'; // オレンジ色

                    // 顔グラフィックのカットイン表示
                    if (unit.face) {
                        this.showWarlordCutIn(unit, 'ROUT');
                    }
                } else {
                    // パターンB: 討ち死に
                    if (isCommander) {
                        msg = `敵総大将・${unit.name}、討ち取ったり！`;
                    } else {
                        msg = `敵将${unit.name}、討ち取ったり！`;
                    }
                    color = '#ff0';

                    // 顔グラフィックのカットイン表示（討ち死に用）
                    if (unit.face) {
                        this.showWarlordCutIn(unit, 'DEATH');
                    }
                }
            } else {
                // 味方本陣の場合
                if (Math.random() < 0.5) {
                    // 敗走
                    if (isCommander) {
                        msg = `総大将・${unit.name}、戦場より撤退！`;
                    } else {
                        msg = `${unit.name}、戦場より撤退！`;
                    }
                    color = '#ffa500';
                    if (unit.face) {
                        this.showWarlordCutIn(unit, 'ROUT');
                    }
                } else {
                    // 討ち死に
                    msg = `無念… ${unit.name} 討ち死に！`;
                    color = '#aaa';
                    if (unit.face) {
                        this.showWarlordCutIn(unit, 'DEATH');
                    }
                }
            }
        } else {
            // 配下部隊: 「撃破/壊滅」メッセージ
            msg = (unit.side === this.playerSide) ?
                `${unit.warlordName}配下の部隊、壊滅…` :
                `${unit.warlordName}配下の部隊、撃破！`;
            color = (unit.side === this.playerSide) ? '#aaa' : '#ffa500';
        }

        // テキスト表示
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
        // テキストシャドウやフォントサイズを強化
        div.style.fontSize = isHeadquarters ? '36px' : '24px';
        div.style.textShadow = '2px 2px 4px #000';

        document.getElementById('game-container').appendChild(div);
        setTimeout(() => div.remove(), 3000);

        await this.wait(1000);
    }

    /**
     * 武将のカットインを表示（敗走時など）
     * @param {Object} unit
     * @param {string} type 'ROUT' | 'DEATH'
     */
    showWarlordCutIn(unit, type) {
        const container = document.getElementById('game-container');

        // 画像要素作成
        const img = document.createElement('img');
        img.src = `portraits/${unit.face}`;
        img.style.position = 'absolute';
        img.style.top = '50%';
        img.style.left = '50%';
        img.style.transform = 'translate(-50%, -50%) scale(0.5)';
        img.style.maxHeight = '60%';
        img.style.zIndex = 140; // テキスト(150)の後ろ
        img.style.opacity = '0';
        img.style.transition = 'all 0.5s ease-out';
        img.style.pointerEvents = 'none';

        container.appendChild(img);

        // アニメーション開始
        requestAnimationFrame(() => {
            img.style.opacity = '1';
            img.style.transform = 'translate(-50%, -50%) scale(1.0)';
        });

        if (type === 'DEATH') {
            // 討ち死に演出: ランダムで3パターンから選択
            const variation = Math.floor(Math.random() * 3) + 1;

            setTimeout(() => {
                // まずは共通でモノクロ化
                img.style.filter = 'grayscale(100%) contrast(1.2) brightness(0.8)';
                img.style.transition = 'filter 1.0s ease, transform 0.2s';

                // 少し揺らして衝撃を表現
                img.style.transform = 'translate(-50%, -50%) scale(1.05)';
                setTimeout(() => img.style.transform = 'translate(-50%, -50%) scale(1.0)', 100);

                // 各演出へ分岐
                setTimeout(() => {
                    if (variation === 1) {
                        // 演出1: 散る（既存）
                        img.style.transition = 'all 1.5s ease-out';
                        img.style.opacity = '0';
                        img.style.transform = 'translate(-50%, -50%) scale(1.5)';
                        img.style.filter = 'grayscale(100%) blur(10px)'; // ぼやけて消える

                        setTimeout(() => img.remove(), 1500);

                    } else if (variation === 2) {
                        // 演出2: 両断（左右に割れて上下にズレる）

                        // 画像を複製して左右を作成
                        // 左半分
                        const left = img.cloneNode();
                        left.style.clipPath = 'polygon(0% 0%, 50% 0%, 50% 100%, 0% 100%)';
                        left.style.transition = 'all 1.2s ease-in';
                        container.appendChild(left);

                        // 右半分
                        const right = img.cloneNode();
                        right.style.clipPath = 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)';
                        right.style.transition = 'all 1.2s ease-in';
                        container.appendChild(right);

                        // 元画像は隠す
                        img.style.display = 'none';

                        // アニメーション実行（左上・右下へスライドしながらフェードアウト）
                        requestAnimationFrame(() => {
                            left.style.transform = 'translate(-50%, calc(-50% - 100px)) scale(1.0)'; // 左は上へ
                            left.style.opacity = '0';

                            right.style.transform = 'translate(-50%, calc(-50% + 100px)) scale(1.0)'; // 右は下へ
                            right.style.opacity = '0';
                        });

                        setTimeout(() => {
                            left.remove();
                            right.remove();
                            img.remove();
                        }, 1200);

                    } else if (variation === 3) {
                        // 演出3: 血しぶき（赤黒いエフェクト）

                        // ベース画像を赤黒く変化させる
                        // grayscale -> sepia -> hue-rotate(赤系) -> saturate(濃く) -> brightness(暗く)
                        img.style.transition = 'all 0.5s ease-in';
                        img.style.filter = 'grayscale(100%) sepia(100%) hue-rotate(-50deg) saturate(500%) contrast(1.5) brightness(0.4)';
                        img.style.transform = 'translate(-50%, -50%) scale(1.02)';

                        // 血のオーバーレイを追加
                        const bloodOverlay = document.createElement('div');
                        bloodOverlay.style.position = 'absolute';
                        bloodOverlay.style.top = '50%';
                        bloodOverlay.style.left = '50%';
                        // 画像サイズを正確に取得するのは難しいので、画面中央に大きめの円形グラデーションを出す
                        bloodOverlay.style.width = '600px';
                        bloodOverlay.style.height = '600px';
                        bloodOverlay.style.transform = 'translate(-50%, -50%)';
                        bloodOverlay.style.background = 'radial-gradient(circle, rgba(180, 0, 0, 0.6) 0%, rgba(100, 0, 0, 0.0) 70%)';
                        bloodOverlay.style.mixBlendMode = 'multiply';
                        bloodOverlay.style.zIndex = 141;
                        bloodOverlay.style.opacity = '0';
                        bloodOverlay.style.pointerEvents = 'none';
                        bloodOverlay.style.transition = 'opacity 0.2s ease-out';

                        container.appendChild(bloodOverlay);

                        requestAnimationFrame(() => {
                            bloodOverlay.style.opacity = '1';
                        });

                        // フェードアウト
                        setTimeout(() => {
                            img.style.transition = 'all 1.5s ease-out';
                            img.style.opacity = '0';
                            bloodOverlay.style.transition = 'opacity 1.5s ease-out';
                            bloodOverlay.style.opacity = '0';

                            setTimeout(() => {
                                img.remove();
                                bloodOverlay.remove();
                            }, 1500);
                        }, 1000);
                    }
                }, 1200); // モノクロを見てる時間

            }, 800); // 最初の表示時間

        } else {
            // 敗走演出: 表示 -> フレームアウト or フェードアウト
            setTimeout(() => {
                img.style.opacity = '0';
                img.style.transform = 'translate(-50%, -50%) scale(0.8)'; // 奥に引っ込む感じ
                setTimeout(() => img.remove(), 500);
            }, 2000);
        }
    }

    // ユーティリティ関数
    speak(unit, type, force = false) {
        if (!unit) return; // Null check
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

        // 3D版は unit.x/unit.y を直接使用、2D版は unit.pos を使用
        const posX = unit.pos?.x ?? unit.x ?? 0;
        const posY = unit.pos?.y ?? unit.y ?? 0;
        this.activeBubbles.push({
            x: posX,
            y: posY - 40,
            text: text,
            life: 100
        });
    }

    showFormation(unit, formationName) {
        this.spawnText({ q: unit.x, r: unit.y }, formationName, "#00FFFF", 40);
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
                q: (unit1.x + unit2.x) / 2,
                r: (unit1.y + unit2.y) / 2
            });
        }
    }

    spawnEffect(type, unit1, unit2) {
        if (this.renderingEngine) {
            this.renderingEngine.add3DEffect(type, { q: unit1.x, r: unit1.y }, { q: unit2.x, r: unit2.y });
        }
    }

    wait(ms) {
        // 速度倍率を適用 (速度が高いほど待機時間が短くなる)
        const speedMultiplier = this.getActionSpeed();
        const adjustedMs = ms / speedMultiplier;
        return new Promise(resolve => setTimeout(resolve, adjustedMs));
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

    // =====================================
    // 弓攻撃システム (Bow Attack System)
    // =====================================

    /**
     * 弓の有効射程を計算（高低差による変動）
     * @param {number} attackerZ - 攻撃者の高さ
     * @param {number} targetZ - 対象の高さ
     * @param {number} baseRange - 基本射程（デフォルト5）
     * @returns {number} 有効射程
     */
    calculateBowRange(attackerZ, targetZ, baseRange = 5) {
        const heightDiff = attackerZ - targetZ;
        // 高所からは射程が伸び、低所からは射程が縮む
        // 最小1、最大 baseRange + 3
        return Math.max(1, Math.min(baseRange + 3, baseRange + heightDiff));
    }

    /**
     * 矢の軌道が障害物で遮られるかチェック
     * タクティクスオウガ風の軌道システムを採用：
     * - 近距離射撃：高い弧の軌道（障害物をクリアしやすい）
     * - 遠距離射撃：低い弧の軌道（障害物に阻まれやすい）
     * @param {Object} from - 発射元ユニット
     * @param {Object} to - 対象ユニット
     * @param {Array} map - マップデータ
     * @returns {{blocked: boolean, blockPos: {x,y,z}|null, arcHeight: number}} 遮蔽情報と弧の高さ
     */
    isArrowPathBlocked(from, to, map) {
        // 放物線の頂点を計算
        const dist = getDistRaw(from.x, from.y, to.x, to.y);

        // 高さは世界単位で統一（TILE_HEIGHT = 16）

        let fromZ = (map[from.y]?.[from.x]?.z || 0) * TILE_HEIGHT;
        let toZ = (map[to.y]?.[to.x]?.z || 0) * TILE_HEIGHT;

        // mapSystemがある場合は建物の高さも考慮（キャッシュ付き）
        if (this.mapSystem) {
            fromZ = Math.max(fromZ, this.mapSystem.getHeight(from.x, from.y));
            toZ = Math.max(toZ, this.mapSystem.getHeight(to.x, to.y));
        }

        // 高低差に基づく弧の高さを計算
        const heightDiff = toZ - fromZ;
        const isShootingUp = heightDiff > 0;

        const maxRange = 12;
        const distFactor = 1 - Math.min(dist / maxRange, 1);

        // 基本弧の高さ（世界単位で計算）
        // 以前の計算式は高すぎたので修正: (15 + 65 * distFactor) -> (2 + 10 * distFactor)
        // 1グリッド距離あたりではなく、より物理的な見た目を重視
        const baseArcHeight = (1 + 6 * distFactor) * TILE_HEIGHT;

        let arcHeight = baseArcHeight;
        if (isShootingUp) {
            // 見上げるときは少し弧を高くしないと刺さらないが、以前の +heightDiff*2 は過剰
            arcHeight = baseArcHeight + heightDiff * 0.5;
        }

        // 軌道上の各グリッドをチェック
        const steps = Math.ceil(dist * 2); // ステップ数を増やして精度向上
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const checkX = Math.round(from.x + (to.x - from.x) * t);
            const checkY = Math.round(from.y + (to.y - from.y) * t);

            // マップ範囲チェック
            if (!map[checkY] || !map[checkY][checkX]) continue;

            let tileZ = (map[checkY][checkX].z || 0) * TILE_HEIGHT;

            // 経路上のグリッドでも建物の高さを考慮
            if (this.mapSystem) {
                tileZ = Math.max(tileZ, this.mapSystem.getHeight(checkX, checkY));
            }

            // 放物線上の高さを計算（パラボラ）
            const arcZ = fromZ + (toZ - fromZ) * t + 4 * arcHeight * t * (1 - t);

            // 障害物チェック：ターゲットより低い位置にある障害物はブロック
            // 判定マージンを少し設ける（+4）
            if (tileZ > arcZ + 4) {
                // 衝突！
                // 衝突地点のZは、arrowの高さ(arcZ)ではなく障害物の表面(tileZ)でもなく、
                // 見た目的には「刺さった場所」= arcZ を返すべき。
                return {
                    blocked: true,
                    blockPos: { x: checkX, y: checkY, z: arcZ }, // 表示用座標
                    t: t, // 進行割合
                    arcHeight: arcHeight
                };
            }

            // 低所から高所へ撃つ場合、途中に壁があるとブロック
            if (isShootingUp && tileZ > fromZ + TILE_HEIGHT && tileZ < toZ && tileZ > arcZ) {
                return {
                    blocked: true,
                    blockPos: { x: checkX, y: checkY, z: arcZ },
                    t: t,
                    arcHeight: arcHeight
                };
            }
        }

        return { blocked: false, blockPos: null, t: 1.0, arcHeight: arcHeight };
    }

    // ---------------------------------------------------------


    /**
     * 遠距離攻撃を実行
     * @param {Object} att - 攻撃者
     * @param {Object} def - 防御者
     * @param {Array} map - マップデータ
     * @param {Array} allUnits - 全ユニット配列（AoE/ブレス範囲ダメージ用）
     */
    async rangedCombat(att, def, map, allUnits = []) {
        att.dir = getFacingAngle(att.x, att.y, def.x, def.y);

        // Debug Log
        // console.log(`[Combat] rangedCombat start.`);

        // 攻撃アニメーションをトリガー (必須)
        if (this.renderingEngine && this.renderingEngine.triggerUnitAttackAnimation) {
            this.renderingEngine.triggerUnitAttackAnimation(att.id, def.id);
        }

        // 攻撃予備動作待ち
        await this.wait(300);

        // 単位を世界単位（world units）で統一

        let attZ = (map[att.y]?.[att.x]?.z || 0) * TILE_HEIGHT; // グリッド単位→世界単位
        let defZ = (map[def.y]?.[def.x]?.z || 0) * TILE_HEIGHT; // グリッド単位→世界単位

        // mapSystemがある場合は建物の高さも考慮（キャッシュ付き）
        // どちらも世界単位なので正しく比較できる
        if (this.mapSystem) {
            attZ = Math.max(attZ, this.mapSystem.getHeight(att.x, att.y));
            defZ = Math.max(defZ, this.mapSystem.getHeight(def.x, def.y));
        }

        // 高さ差による射程制限：ターゲットが攻撃者より高すぎる場合は攻撃不可
        // 段差2（32 world units）を超える場合は遠距離攻撃不可（城壁対応）
        const MAX_RANGED_HEIGHT_DIFF = 2 * TILE_HEIGHT; // 32 world units

        // ワールドユニットでの高さ差を計算
        const heightDiff = defZ - attZ;

        if (heightDiff > MAX_RANGED_HEIGHT_DIFF) {
            // ターゲットが高すぎて到達できない
            this.spawnText({ q: att.x, r: att.y }, "届かない!", '#888', 40);
            await this.wait(300);
            return;
        }

        // ユニットタイプに応じた攻撃演出
        const typeInfo = UNIT_TYPES[att.type] || UNIT_TYPES.INFANTRY;
        const rangeType = typeInfo.rangeType || 'bowArc';

        if (rangeType === 'aoe') {
            // 魔術師：魔法弾
            this.audioEngine.sfxMagicAtk && this.audioEngine.sfxMagicAtk();
            if (this.renderingEngine && this.renderingEngine.spawnMagicProjectile) {
                await this.renderingEngine.spawnMagicProjectile(att, def, 0xAA00FF);
            } else {
                await this.wait(500);
            }
        } else if (rangeType === 'breath') {
            // ドラゴン：ブレス(赤)
            this.audioEngine.sfxBreath && this.audioEngine.sfxBreath();
            if (this.renderingEngine && this.renderingEngine.spawnMagicProjectile) {
                await this.renderingEngine.spawnMagicProjectile(att, def, 0xFF4400);
            } else {
                await this.wait(500);
            }
        } else if (rangeType === 'heal') {
            // 僧侶：聖なる光(黄)
            this.audioEngine.sfxMagicAtk && this.audioEngine.sfxMagicAtk();
            if (this.renderingEngine && this.renderingEngine.spawnMagicProjectile) {
                await this.renderingEngine.spawnMagicProjectile(att, def, 0xFFFF88);
            } else {
                await this.wait(500);
            }

        } else {
            // 弓・銃・大砲
            // 遮蔽チェック
            const blockInfo = this.isArrowPathBlocked(att, def, map);

            // 矢のアニメーションを発射
            if (this.renderingEngine && this.renderingEngine.spawnArrowAnimation) {
                await this.renderingEngine.spawnArrowAnimation(att, def, blockInfo);
            }

            if (blockInfo.blocked) {
                // 矢が遮られた
                // Z座標（高さ）を正しく反映して表示
                const textPos = {
                    q: blockInfo.blockPos.x,
                    r: blockInfo.blockPos.y,
                    height: blockInfo.blockPos.z // 高さ指定を追加（ui.js/rendering.jsでの対応が必要だが、渡す）
                };
                // spawnTextは本来QR座標だが、3D表示用に高さを考慮させる（renderingHelper側で対応されている前提、なければ後で修正）
                // 一旦、blockPos.zはワールド座標なので、そのまま渡すのは難しいかも。
                // pixelToHex等で変換するか、spawnTextが3D座標を受け取れるか？
                // spawnTextの実装を確認していないが、既存コードに合わせて q,r を渡す。
                // ただし、高さを表現するために、blockPosはあくまで「どのタイルで止まったか」を示す。
                this.spawnText(textPos, "遮蔽!", '#888', 40);
                await this.wait(300);
                return;
            }

            // ヒットSE
            this.audioEngine.sfxHit();
        }

        // 高低差によるダメージ倍率（heightDiffは上で計算済み: defZ - attZ）
        let heightMod = 1.0;
        const attackHeightDiff = -heightDiff; // 攻撃者側から見た高低差（正=高い位置から攻撃）
        if (attackHeightDiff > 0) {
            heightMod = 1.0 + (attackHeightDiff * 0.15); // 高所から: +15%/段
        } else if (attackHeightDiff < 0) {
            heightMod = Math.max(0.5, 1.0 + (attackHeightDiff * 0.15)); // 低所から: -15%/段 (最低50%)
        }

        // 陣形によるステータス修正
        const attFormation = getFormationModifiers(att.formation);
        const defFormation = getFormationModifiers(def.formation);
        const finalAtkStat = att.atk + attFormation.atk;
        const finalDefStat = def.def + defFormation.def;

        // 距離によるダメージ減衰（遠いほど威力低下）
        // 4マスまでは減衰なし、それ以降1マスごとに-5%
        // ただし最低保証50%
        const dist = getDistRaw(att.x, att.y, def.x, def.y);
        let distMod = 1.0;
        if (dist > 4) {
            distMod = Math.max(0.5, 1.0 - (dist - 4) * 0.05);
        }

        // ダメージ・回復計算
        const safeSoldiers = (typeof att.soldiers === 'number' && att.soldiers > 0) ? att.soldiers : 1;

        if (rangeType === 'heal') {
            // 回復計算 (攻撃力の半分程度を基準に)
            // 回復は自身の攻撃力依存、相手の防御関係なし
            let healAmount = Math.floor((Math.sqrt(safeSoldiers) * finalAtkStat * heightMod * distMod * 0.5));
            if (healAmount < 1) healAmount = 1;

            // 回復適用
            const oldSoldiers = def.soldiers;
            def.soldiers += healAmount;
            if (def.soldiers > def.maxSoldiers) def.soldiers = def.maxSoldiers; // 最大値キャップ（あれば）
            // ※ここでは簡易的に元の兵数を最大と見なせないため、キャップ処理は別途必要だが、
            // とりあえず UNIT_TYPES から baseHp を取得するか、あるいは無制限にするか。
            // 今回はシンプルに加算のみ（上限なし、またはデータ構造依存）

            this.spawnText({ q: def.x, r: def.y }, `+${healAmount}`, '#00ff00', 60);
            // this.speak(def, 'HEALED'); // ボイスがあれば

            // 3Dレンダラー側のユニット情報を更新
            if (this.renderingEngine && this.renderingEngine.updateUnitInfo) {
                const defMesh = this.renderingEngine.unitMeshes.get(def.id);
                if (defMesh) this.renderingEngine.updateUnitInfo(defMesh, def);
            }
            return;
        }

        // 攻撃ダメージ計算（近接より低め、ただし反撃なし）
        let dmgToDef = Math.floor((Math.sqrt(safeSoldiers) * finalAtkStat * heightMod * distMod * 0.7) / (finalDefStat / 15));
        if (!Number.isFinite(dmgToDef) || dmgToDef < 5) dmgToDef = 5;

        // ダメージ適用（反撃なし）
        def.soldiers -= dmgToDef;
        this.spawnText({ q: def.x, r: def.y }, `-${dmgToDef}`, '#ff6600', 60);
        this.speak(def, 'DAMAGED');

        // 被ダメージアニメーションをトリガー
        if (this.renderingEngine && this.renderingEngine.triggerDamageAnimation) {
            this.renderingEngine.triggerDamageAnimation(def.id);
        }

        // 3Dレンダラー側のユニット情報を更新
        if (this.renderingEngine && this.renderingEngine.updateUnitInfo) {
            const defMesh = this.renderingEngine.unitMeshes.get(def.id);
            if (defMesh) this.renderingEngine.updateUnitInfo(defMesh, def);
        }

        // 死亡判定
        if (def.soldiers <= 0 || isNaN(def.soldiers)) {
            def.soldiers = 0;
            def.dead = true;
            if (this.renderingEngine && this.renderingEngine.triggerDeathAnimation) {
                this.renderingEngine.triggerDeathAnimation(def.id);
            }
            await this.dramaticDeath(def, att.side);
        }

        // ---------------------------------------------------------
        // AoEスプラッシュダメージ（魔術師: isAoe === true）
        // 着弾点の周囲8マスにいる敵ユニットにも50%のダメージを与える
        // ---------------------------------------------------------
        if (typeInfo.isAoe && allUnits && allUnits.length > 0) {
            const splashDmg = Math.max(3, Math.floor(dmgToDef * 0.5));
            const surroundingOffsets = [
                { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
                { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }
            ];
            for (const offset of surroundingOffsets) {
                const tx = def.x + offset.dx;
                const ty = def.y + offset.dy;
                const splashTarget = allUnits.find(u =>
                    !u.dead && u.side !== att.side && u.x === tx && u.y === ty && u.id !== def.id
                );
                if (splashTarget) {
                    splashTarget.soldiers -= splashDmg;
                    this.spawnText({ q: tx, r: ty }, `-${splashDmg}`, '#cc66ff', 40);
                    if (this.renderingEngine && this.renderingEngine.triggerDamageAnimation) {
                        this.renderingEngine.triggerDamageAnimation(splashTarget.id);
                    }
                    if (this.renderingEngine && this.renderingEngine.updateUnitInfo) {
                        const mesh = this.renderingEngine.unitMeshes.get(splashTarget.id);
                        if (mesh) this.renderingEngine.updateUnitInfo(mesh, splashTarget);
                    }
                    if (splashTarget.soldiers <= 0) {
                        splashTarget.soldiers = 0;
                        splashTarget.dead = true;
                        if (this.renderingEngine && this.renderingEngine.triggerDeathAnimation) {
                            this.renderingEngine.triggerDeathAnimation(splashTarget.id);
                        }
                        await this.dramaticDeath(splashTarget, att.side);
                    }
                }
            }
        }

        // ---------------------------------------------------------
        // ブレス扇状ダメージ（ドラゴン/竜騎兵: rangeType === 'breath'）
        // attack-patterns.jsのbreathパターンを回転させ、範囲内の全敵にダメージ
        // ---------------------------------------------------------
        if (rangeType === 'breath' && allUnits && allUnits.length > 0) {
            const breathPattern = ATTACK_PATTERNS.breath;
            if (breathPattern) {
                const rotated = rotatePattern(breathPattern, att.dir || 0);
                const breathDmg = Math.max(3, Math.floor(dmgToDef * 0.6));
                for (const { dx, dy } of rotated) {
                    const tx = att.x + dx;
                    const ty = att.y + dy;
                    // メインターゲットは既にダメージ済みなのでスキップ
                    if (tx === def.x && ty === def.y) continue;
                    const breathTarget = allUnits.find(u =>
                        !u.dead && u.side !== att.side && u.x === tx && u.y === ty
                    );
                    if (breathTarget) {
                        breathTarget.soldiers -= breathDmg;
                        this.spawnText({ q: tx, r: ty }, `-${breathDmg}`, '#ff8800', 40);
                        if (this.renderingEngine && this.renderingEngine.triggerDamageAnimation) {
                            this.renderingEngine.triggerDamageAnimation(breathTarget.id);
                        }
                        if (this.renderingEngine && this.renderingEngine.updateUnitInfo) {
                            const mesh = this.renderingEngine.unitMeshes.get(breathTarget.id);
                            if (mesh) this.renderingEngine.updateUnitInfo(mesh, breathTarget);
                        }
                        if (breathTarget.soldiers <= 0) {
                            breathTarget.soldiers = 0;
                            breathTarget.dead = true;
                            if (this.renderingEngine && this.renderingEngine.triggerDeathAnimation) {
                                this.renderingEngine.triggerDeathAnimation(breathTarget.id);
                            }
                            await this.dramaticDeath(breathTarget, att.side);
                        }
                    }
                }
            }
        }

        await this.wait(200);
    }
}
