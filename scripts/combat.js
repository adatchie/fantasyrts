/**
 * SEKIGAHARA RTS - Combat System
 * 戦闘�E琁E��ユニット行動
 */

import { getDist, getDistRaw, getFacingAngle, findPath, getDistAttack } from './pathfinding.js';
import { TERRAIN_TYPES } from './map.js';
import { hexToPixel } from './pathfinding.js';
import { DIALOGUE, UNIT_TYPES, UNIT_TYPE_NORMAL, UNIT_TYPE_HEADQUARTERS, TILE_HEIGHT, COMMANDER_GROWTH_RATES, MAX_LEVEL, STAT_CAP, expToNextLevel, getOccupiedGrids } from './constants.js';
import { getFormationModifiers, checkForcedFormationChange, calculateFormationTargets } from './formation.js';
import { ATTACK_PATTERNS, rotatePattern } from './attack-patterns.js';

const GAME_DIR_TO_PATTERN_DIR = [1, 2, 3, 0];
const MELEE_REACH_TYPES = new Set(['melee', 'forward2']);

function getPatternDir(unit) {
    return GAME_DIR_TO_PATTERN_DIR[unit?.dir ?? 0] ?? 0;
}

function getSizeShape(unit) {
    if (unit?.sizeShape) return unit.sizeShape;
    if (unit?.size === 4) return '2x2';
    if (unit?.size === 2) return 'vertical';
    return 'single';
}

function getAttackOccupiedGrids(unit) {
    return getOccupiedGrids(unit.x, unit.y, getPatternDir(unit), getSizeShape(unit));
}

export function isMeleeReachable(unit, target, allUnits = [], rangeType = 'melee', map = null) {
    if (!unit || !target || !MELEE_REACH_TYPES.has(rangeType)) return false;

    const attackerGrids = getAttackOccupiedGrids(unit);
    const targetGrids = getAttackOccupiedGrids(target);

    if (rangeType === 'melee') {
        const attackerSize = unit.size || 1;
        const targetSize = target.size || 1;
        const reach = (attackerSize + targetSize) / 2.0 + 0.5;

        return attackerGrids.some(attGrid =>
            targetGrids.some(targetGrid =>
                Math.max(Math.abs(attGrid.x - targetGrid.x), Math.abs(attGrid.y - targetGrid.y)) <= reach
            )
        );
    }

    const pattern = ATTACK_PATTERNS[rangeType];
    if (!pattern) return false;

    const targetKeys = new Set(targetGrids.map(grid => `${grid.x},${grid.y}`));
    return attackerGrids.some(attGrid => {
        const rotated = rotatePattern(pattern, getPatternDir(unit));
        return rotated.some(offset => targetKeys.has(`${attGrid.x + offset.dx},${attGrid.y + offset.dy}`));
    });
}

export class CombatSystem {
    constructor(audioEngine, unitManager = null) {
        this.audioEngine = audioEngine;
        this.activeEffects = [];
        this.activeBubbles = [];
        this.playerSide = 'EAST'; // チE��ォルト値
        this.unitManager = unitManager; // 陣形チェチE��用
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
     * 現在のアクション速度を取征E
     * @returns {number} 速度倍率 (1.0, 1.5, 2.0)
     */
    getActionSpeed() {
        return this.game ? this.game.actionSpeed : 1.0;
    }

    /**
     * ユニット�E行動を�E琁E
     */
    async processUnit(unit, allUnits, map, warlordPlotUsed = {}) {
        if (!unit.order) return;

        // アクチE��ブ�Eーカーを表示
        const re = this.renderingEngine || (window.game && window.game.renderingEngine);
        if (re && re.showActiveMarker) {
            re.showActiveMarker(unit);
        }

        try {
            // 本陣ユニット�E場合、�E力による強制陣形変更をチェチE��
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
            // アクチE��ブ�Eーカーを非表示
            const re2 = this.renderingEngine || (window.game && window.game.renderingEngine);
            if (re2 && re2.hideActiveMarker) {
                re2.hideActiveMarker();
            }
        }

        // 行動完亁E��ラグを設定（行動フェイズで行動済みとして静止させる！E
        unit.hasActed = true;
    }

    /**
     * 調略を�E琁E
     * マルチユニットシスチE��: 1武封Eターン1回�Eみ
     */
    async processPlot(unit, target, allUnits, warlordPlotUsed = {}, map) {
        // こ�E武封E��すでに調略を使用済みかチェチE��
        if (warlordPlotUsed[unit.warlordId]) {
            // 調略をスキチE�Eして移動に刁E��替ぁE
            unit.order = { type: 'MOVE', targetHex: { x: target.x, y: target.y } };
            await this.processMove(unit, allUnits, map);
            return;
        }

        const dist = getDistAttack(unit, target);

        // 調略封E��E5) + 陣形解除距離(3)
        const engagementDist = 8.0;

        if (dist <= 5) {
            unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
            this.speak(unit, 'PLOT_DO');
            this.speak(target, 'PLOT_REC');
            await this.spawnEffect('WAVE', unit, target);

            // エフェクトを見せるため�EウェイチE
            await this.wait(400);

            // 戦況による調略成功玁E
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
                // マルチユニットシスチE��: 対象武封E�E全ユニットを寝返らせる
                const targetWarlordId = target.warlordId;
                const targetWarlordUnits = allUnits.filter(u => u.warlordId === targetWarlordId);

                targetWarlordUnits.forEach(warlordUnit => {
                    warlordUnit.side = unit.side;
                    warlordUnit.loyalty = 100;
                    warlordUnit.order = null; // 命令をクリア

                    // 本陣ユニット�Eみ画像を更新�E�ED用�E�E
                    if (warlordUnit.imgCanvas) {
                        warlordUnit.imgCanvas = generatePortrait(warlordUnit, warlordUnit.side);
                    }

                    // 3D表示を更新
                    if (this.renderingEngine && this.renderingEngine.updateUnitVisuals) {
                        this.renderingEngine.updateUnitVisuals(warlordUnit);
                    }
                });

                this.spawnText({ q: target.x, r: target.y }, "寝返り!", "#0f0", 60);
                this.audioEngine.sfxArrangementSuccess(); // 調略成功SE

                // 画面中央にフローメチE��ージを表示�E�潰走演�Eと同様！E
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

            // 調略使用フラグを立てる（武封E��位！E
            warlordPlotUsed[unit.warlordId] = true;

            unit.order = null;
            await this.wait(400);
        } else if (dist > engagementDist) {
            // まだ遠ぁE��合�E陣形を維持して移勁E
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
     * 攻撁E��処琁E
     */
    /**
     * 攻撁E��処琁E
     */
    async processAttack(unit, target, allUnits, map, reach) {
        let hasAttackedThisPhase = false;
        // スクエアグリチE��に伴ぁE��距離判定を厳格化（チェビシェフ距離を使用�E�E
        const dist = getDistAttack(unit, target);

        // 接敵するまでは陣形で近づぁE
        // reach + 3.0 くらぁE��では陣形で整然と近づき、そこから個別に襲ぁE��かるイメージ
        const engagementDist = reach + 3.0;

        // ユニットが遠距離攻撁E��能かチェチE��
        // unit.type は兵種�E�ENFANTRY, ARCHER等）、unit.unitType は役割�E�EORMAL, HEADQUARTERS�E�E
        const unitCombatType = unit.type || 'INFANTRY';
        const typeInfo = UNIT_TYPES[unitCombatType] || UNIT_TYPES.INFANTRY;
        const rangeType = typeInfo.rangeType || 'melee';

        // 遠距離攻撁E��能なユニットタイチE
        const canRangedAttack = ['bowArc', 'longArc', 'siege', 'aoe', 'breath', 'heal'].includes(rangeType);

        // 弓攻撁E�E封E��（基本封E��E、E��さによる補正はダメージのみ適用�E�E
        let bowBaseRange = 8;
        // マジチE��/ブレス/大砲は封E��が異なめE
        if (rangeType === 'aoe') bowBaseRange = 6;
        if (rangeType === 'breath') bowBaseRange = 4;
        if (rangeType === 'siege') bowBaseRange = 12;
        if (rangeType === 'heal') bowBaseRange = 5;

        const bowMinRange = 2; // 最小封E��E�E�Eマスは封E��外！E

        // 高い位置にぁE��弓�Eの封E��拡張�E�移動できなぁE��合�E救済措置�E�E
        let extendedBowRange = bowBaseRange;
        if (canRangedAttack && this.mapSystem) {
            const unitZ = this.mapSystem.getHeight(unit.x, unit.y);
            const targetZ = this.mapSystem.getHeight(target.x, target.y);
            const heightDiff = unitZ - targetZ;
            // 自刁E��相手より高い場合、E段差ごとに封E��E1�E�最大+4まで�E�E
            if (heightDiff > 0) {
                const heightInGrids = Math.floor(heightDiff / TILE_HEIGHT);
                extendedBowRange = Math.min(bowBaseRange + heightInGrids, bowBaseRange + 4);
            }
        }

        // 弓が使える距離かどぁE��判宁E
        const canUseBow = canRangedAttack ? (d) => d >= bowMinRange && d <= extendedBowRange : () => false;

        // 弓�EチE��チE���E�各判定ごとに出力！E
        if (canRangedAttack && target) {
            // 弓�EチE��チE��ログ�E�忁E��な場合�E有効化！E
            // console.log('[ARCHER] ' + unit.name + ' dist=' + dist + ' reach=' + reach + ' canRangedAttack=' + canRangedAttack + ' canUseBow=' + canUseBow(dist) + ' inMelee=' + (dist <= reach));
        }

        // 高さ制限チェチE���E�近接攻撁E���E�E
        // 城壁上�E敵には近接攻撁E��可。段差2�E�E2 world units�E�までは近接攻撁E��能
        let canMeleeAttack = true;
        if (dist <= reach && this.mapSystem) {
            const unitZ = this.mapSystem.getHeight(unit.x, unit.y);
            const targetZ = this.mapSystem.getHeight(target.x, target.y);
            const heightDiff = Math.abs(targetZ - unitZ);
            // 段差2以上！E2 world units = 2 * TILE_HEIGHT�E�なら近接攻撁E��可
            // これにより城壁E��通常40+world units�E�上�E敵に地上から直接攻撁E��きなくなめE
            const MAX_MELEE_HEIGHT_DIFF = 2 * TILE_HEIGHT; // 32 world units
            if (heightDiff > MAX_MELEE_HEIGHT_DIFF) {
                canMeleeAttack = false;
            }
        }

        if (dist <= reach && canMeleeAttack) {
            // 攻撁E��E���Eなら近接攻撁E��衁E
            unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
            this.speak(unit, 'ATTACK');
            await this.combat(unit, target, allUnits, map);
            hasAttackedThisPhase = true;
        } else if (canUseBow(dist)) {
            // 弓攻撁E��E���E�E�最小封E��以上、最大封E��まで�E�なら遠距離攻撁E
            unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
            await this.rangedCombat(unit, target, map, allUnits);
            hasAttackedThisPhase = true;
        } else if (canRangedAttack && dist <= extendedBowRange) {
            // 弓�Eが拡張封E���EにぁE��場合�E移動せずに攻撁E
            unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
            await this.rangedCombat(unit, target, map, allUnits);
            hasAttackedThisPhase = true;
        } else if (canRangedAttack && this.mapSystem) {
            // 弓�Eが高い位置にぁE��場合、移動を諦めてそ�E場から攻撁E
            const unitZ = this.mapSystem.getHeight(unit.x, unit.y);
            const targetZ = this.mapSystem.getHeight(target.x, target.y);
            const heightDiff = unitZ - targetZ;
            // 自刁E��2段差趁E��い場合�E移動せずに攻撁E��城壁対応！E
            if (heightDiff > 2 * TILE_HEIGHT) {
                unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                await this.rangedCombat(unit, target, map, allUnits);
                hasAttackedThisPhase = true;
                return;
            }
        }

        if (dist > engagementDist || (dist <= reach && !canMeleeAttack)) {
            // 遠ぁE��合、また�E近接攻撁E��きなぁE��さ差がある場合�E移勁E
            // 弓封E���Eなら�Eに弓を撁E��
            if (!hasAttackedThisPhase && canUseBow(dist)) {
                unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                await this.rangedCombat(unit, target, map, allUnits);
                hasAttackedThisPhase = true;
                // 遠距離ユニット�E封E���Eなら移動不要E��封E��のみで行動終亁E��E
                if (canRangedAttack) {
                    return;
                }
                // 近接ユニット�E弓攻撁E��、まだ距離があれ�E陣形で近づぁE
            }

            // 陣形を維持して移勁E
            // 一時的にMOVE命令のフリをしてprocessMoveを呼ぶ�E�ただしターゲチE��は維持E��E
            // processMoveは冁E��で陣形位置を計算して移動すめE

            // 重要E processMoveは unit.order.targetHex を参照するので、一時的にセチE��する
            const originalOrder = unit.order;
            unit.order = {
                type: 'MOVE',
                targetHex: { x: target.x, y: target.y },
                // 允E�EターゲチE��惁E��を保持して、E��形計算時の本陣の向き決定などに使ぁE
                originalTargetId: target.id
            };

            await this.processMove(unit, allUnits, map);

            // 移動後に攻撁E��能かチェチE���E�特に弓�E用�E�E
            const newDist = getDistAttack(unit, target);
            if (!hasAttackedThisPhase && newDist <= reach) {
                // 近接攻撁E��E���E
                unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                this.speak(unit, 'ATTACK');
                await this.combat(unit, target, allUnits, map);
                hasAttackedThisPhase = true;
            } else if (!hasAttackedThisPhase && canUseBow(newDist)) {
                // 弓封E���Eなら遠距離攻撁E
                unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                await this.rangedCombat(unit, target, map, allUnits);
                hasAttackedThisPhase = true;
            }

            // 命令を�Eに戻す（次ターンも攻撁E��継続するためE��E
            // processMove冁E��目皁E��に着くとorderがnullになることがある�Eで注愁E
            if (unit.order === null && getDistAttack(unit, target) > reach) {
                // まだ届いてぁE��ぁE�EにMove完亁E��ぁE��nullになった場合、攻撁E��令を復帰させめE
                unit.order = originalOrder;
            } else {
                // まだ移動中なら、次のターンも攻撁E��令として処琁E��たいので復帰
                unit.order = originalOrder;
            }
        } else {
            // 接敵距離に入った場吁E
            if (canRangedAttack && canUseBow(dist)) {
                // 遠距離ユニット�E封E���Eなら封E��のみ�E�突撃しなぁE��E
                if (!hasAttackedThisPhase) {
                    unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                    await this.rangedCombat(unit, target, map, allUnits);
                    hasAttackedThisPhase = true;
                }
            } else {
                // 近接ユニット�E従来通り突撃
                const moved = await this.moveUnitStep(unit, target, allUnits, map);
                // 移動後に再チェチE��
                const newDist = getDistAttack(unit, target);
                if (!hasAttackedThisPhase && newDist <= reach) {
                    unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                    this.speak(unit, 'ATTACK');
                    await this.combat(unit, target, allUnits, map);
                    hasAttackedThisPhase = true;
                } else if (!hasAttackedThisPhase && canUseBow(newDist)) {
                    // 移動後に弓封E���Eなら遠距離攻撁E
                    unit.dir = getFacingAngle(unit.x, unit.y, target.x, target.y);
                    await this.rangedCombat(unit, target, map, allUnits);
                    hasAttackedThisPhase = true;
                }
            }
        }
    }

    /**
     * 遠距離攻撁E��実行（旧牁E E後方定義により上書きされるチE��ドコード！E
     * @param {Object} att - 攻撁E��E
     * @param {Object} def - 防御老E
     * @param {Array} map - マップデータ
     * @param {Array} allUnits - 全ユニット�E刁E
     */
    async rangedCombat(att, def, map, allUnits = []) {
        att.dir = getFacingAngle(att.x, att.y, def.x, def.y);

        // 攻撁E��ニメーションをトリガー (忁E��E
        if (this.renderingEngine && this.renderingEngine.triggerUnitAttackAnimation) {
            this.renderingEngine.triggerUnitAttackAnimation(att.id, def.id);
        }

        // 攻撁E��備動作征E��
        await this.wait(300);

        // ... targetZ calc ...

        let attZ = (map[att.y]?.[att.x]?.z || 0) * TILE_HEIGHT;
        let defZ = (map[def.y]?.[def.x]?.z || 0) * TILE_HEIGHT;
        if (this.mapSystem) {
            attZ = Math.max(attZ, this.mapSystem.getHeight(att.x, att.y));
            defZ = Math.max(defZ, this.mapSystem.getHeight(def.x, def.y));
        }

        // 高さ差チェチE��: 段差2�E�E2 world units�E�を趁E��る場合�E攻撁E��可
        const heightDiff = defZ - attZ;
        const MAX_HEIGHT_DIFF = 2 * TILE_HEIGHT; // 32 world units

        if (heightDiff > MAX_HEIGHT_DIFF) {
            this.spawnText({ q: att.x, r: att.y }, "届かない", '#888', 40);
            await this.wait(300);
            return;
        }

        // ユニットタイプに応じた攻撁E���E
        const typeInfo = UNIT_TYPES[att.type] || UNIT_TYPES.INFANTRY;
        const rangeType = typeInfo.rangeType || 'bowArc';

        if (rangeType === 'aoe') {
            // 魔術師�E�魔法弾また�EエフェクチE
            this.audioEngine.sfxMagicAtk && this.audioEngine.sfxMagicAtk();
            // TODO: マジチE��エフェクト実裁E��とりあえず矢ではなくビームか何か
            if (this.renderingEngine && this.renderingEngine.add3DEffect) {
                // 魔法陣など?
                this.renderingEngine.add3DEffect('MAGIC_CAST', att);
            }
            // 魔法弾飛翔
            if (this.renderingEngine && this.renderingEngine.spawnMagicProjectile) {
                await this.renderingEngine.spawnMagicProjectile(att, def);
                // 着弾時に落雷エフェクト
                if (this.renderingEngine.add3DEffect) {
                    this.renderingEngine.add3DEffect('THUNDER_STRIKE', def.x, def.y);
                }
            } else {
                // フォールバック: ビ�Eム
                this.addEffect('BEAM', { q: att.x, r: att.y }, { q: def.x, r: def.y }, '#AA00FF');
                await this.wait(200);
            }

        } else if (rangeType === 'breath') {
            // ドラゴン�E�ブレス
            this.audioEngine.sfxBreath && this.audioEngine.sfxBreath();
            if (this.renderingEngine && this.renderingEngine.add3DEffect) {
                this.renderingEngine.add3DEffect('BREATH', att, def);
            }
            await this.wait(500);

        } else {
            // 弓�E銁E�E大砲
            // 遮蔽チェチE��
            const blockInfo = this.isArrowPathBlocked(att, def, map);

            // 矢のアニメーションを発封E
            if (this.renderingEngine && this.renderingEngine.spawnArrowAnimation) {
                // 銁E�E場合�E弾丸速度などを変えたいが、とりあえず矢で統一
                await this.renderingEngine.spawnArrowAnimation(att, def, blockInfo);
            }

            if (blockInfo.blocked) {
                this.spawnText({ q: blockInfo.blockPos.x, r: blockInfo.blockPos.y }, "遮蔽!", '#888', 40);
                await this.wait(300);
                return;
            }

            // ヒッチEE
            this.audioEngine.sfxHit();
        }
        // ---------------------------------------------------------
    }

    /**
     * 移動を処琁E
     * 本陣の場合�E陣形制限をチェチE��
     */
    async processMove(unit, allUnits, map) {
        let dest = unit.order.targetHex;

        // ---------------------------------------------------------
        // 陣形移動ロジチE�� (配下ユニット�E場吁E
        // ---------------------------------------------------------
        if (unit.unitType !== UNIT_TYPE_HEADQUARTERS) {
            // 本陣を探ぁE
            const hq = allUnits.find(u => u.warlordId === unit.warlordId && u.unitType === UNIT_TYPE_HEADQUARTERS && !u.dead);

            if (hq && hq.formation) {
                // 配下ユニットリストを取得（�E刁E��含む、ID頁E��ソートして一貫性を保つ�E�E
                const subordinates = allUnits
                    .filter(u => u.warlordId === unit.warlordId && u.unitType !== UNIT_TYPE_HEADQUARTERS && !u.dead)
                    .sort((a, b) => a.id - b.id);

                // 本陣の向きを決定（移動中なら移動方向、そぁE��なければ現在の向き�E�E
                let baseDir = hq.dir;
                if (hq.order && hq.order.targetHex) {
                    // 移動目標がある場合�Eそちらを向く
                    baseDir = getFacingAngle(hq.x, hq.y, hq.order.targetHex.x, hq.order.targetHex.y);
                }

                // 陣形ターゲチE��を計算（本陣の現在位置を基準、地形老E�E�E�E
                const targets = calculateFormationTargets({ ...hq, dir: baseDir }, subordinates, this.mapSystem);

                if (targets && targets.has(unit.id)) {
                    const formDest = targets.get(unit.id);
                    const hasAttackTarget = !!(unit.order && unit.order.originalTargetId !== undefined);
                    const enemyNearbyForFormation = allUnits.some(other =>
                        other.side !== unit.side &&
                        !other.dead &&
                        getDistAttack(unit, other) <= 4
                    );

                    // 非交戦時は陣形を優先し、敵が近い時だけ戦闘移動を優先する
                    if (dest.id === undefined && (!hasAttackTarget || !enemyNearbyForFormation)) {
                        dest = formDest;
                    }
                }
            }
        }
        // ---------------------------------------------------------
        if (getDistRaw(unit.x, unit.y, dest.x, dest.y) === 0) {
            unit.order = null;
        } else {
            // 本陣の場合、E�E下�E追従を征E���E�足並みを揃える�E��E琁E
            // ただし、戦闘時に敵ユニットに向かって移動する場合！Eest.idがある）�E征E��しなぁE
            const isCombatMove = (dest.id !== undefined) || (unit.order && unit.order.originalTargetId !== undefined);
            if (unit.unitType === UNIT_TYPE_HEADQUARTERS && this.unitManager && !isCombatMove) {
                // 1. 緊急回避チェチE���E�近くに敵がいる場合�Eなり�Eり構わず動ぁE
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
                        // 周囲6HEX以冁E��ぁE��配下をカウント（地形による遁E��を老E�Eして緩和！E
                        const nearbySubordinates = subordinates.filter(u => getDistRaw(unit.x, unit.y, u.x, u.y) <= 6);
                        const ratio = nearbySubordinates.length / subordinates.length;

                        // 配下�E50%以上が近くにぁE��ぁE��ら、移動を征E��E
                        if (ratio < 0.5) {
                            this.spawnText({ q: unit.x, r: unit.y }, "軍待ち...", "#aaa", 40);
                            await this.wait(200); // 少しだけウェイトを入れて雰囲気を出ぁE
                            return; // 移動スキチE�E
                        }
                    }
                }
            }

            await this.moveUnitStep(unit, dest, allUnits, map);
        }
    }

    /**
     * ユニットを移動（パスファインチE��ング使用�E�E
     * 匁E��移動をサポ�EチE
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

        // パスが無効な場合のチェック
        if (!path || path.length === 0 || (path.length === 1 && path[0].x === unit.x && path[0].y === unit.y)) {
            console.warn(`[Pathfinding] Unit ${unit.id} has no valid path to (${targetQ}, ${targetR}). Current pos: (${unit.x}, ${unit.y})`);
            return false;
        }

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
                    // 敵ユニットがいる場合
                    // パスが正しく生成されていれば到達しないはずだが、念のため対処
                    // ゴール地点に敵がいる場合はその場で攻撃可能なのでOK
                    if (next.x === targetQ && next.y === targetR && dest.id !== undefined) {
                        // 攻撃対象の隣に到達したとみなす
                        break;
                    }
                    // それ以外の場合は警告を出して停止
                    console.warn(`[Pathfinding] Unit ${unit.id} blocked by enemy at (${next.x}, ${next.y}). Path:`, path);
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
        // スクエアグリッド用4方向（上下左右）
        const directions = [
            [+1, 0],   // 右
            [-1, 0],  // 左
            [0, +1],  // 下
            [0, -1]   // 上
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

            // 空いているかチェック（スクエアグリッド：同じタイルにいるかどうか）
            const isOccupied = allUnits.some(u =>
                u.id !== unit.id &&
                !u.dead &&
                u.x === nx && u.y === ny
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

        // 匁E��攻撁E�E判宁E
        const siegers = allUnits.filter(u =>
            u.side === att.side &&
            !u.dead &&
            u.id !== att.id &&
            getDist(u, def) <= (u.size + def.size) / 2 + 1
        );

        // 鬨の声�E�戦闘開始SE�E�E
        this.audioEngine.sfxBattleCry();

        // 攻撁E�Eから防御側への攻撁E��E
        this.addEffect('BEAM', { q: att.x, r: att.y }, { q: def.x, r: def.y }, '#ffaa00');

        // 陣営色を取得するローカル関数
        const getSideColor = (side) => {
            if (side === 'EAST') return 0x6666FF; // 青（少し明るめE��E
            if (side === 'WEST') return 0xFF4444; // 赤
            return 0xAAAAAA;
        };

        // 攻撁E��ニットを少し光らせる
        this.addEffect('UNIT_FLASH', { unitId: att.id, color: getSideColor(att.side), duration: 10 });

        siegers.forEach(s => {
            const siegeColor = getSideColor(s.side);
            this.addEffect('BEAM', { q: s.x, r: s.y }, { q: def.x, r: def.y }, '#ffaa00');
            // 匁E��参加ユニット�EHEXを点滁E��せる
            this.addEffect('HEX_FLASH', { q: s.x, r: s.y, color: siegeColor });
            // ユニット�E体も少し光らせる
            this.addEffect('UNIT_FLASH', { unitId: s.id, color: siegeColor, duration: 30 });
        });

        // 戦闘エフェクチE 土�Eと火花を追加
        this.addEffect('DUST', { q: def.x, r: def.y }, null, null);
        // 攻撁E��ニメーション�E�突撃�E�E
        if (this.renderingEngine && this.renderingEngine.triggerUnitAttackAnimation) {
            this.renderingEngine.triggerUnitAttackAnimation(att.id, def.id);
            siegers.forEach(s => {
                this.renderingEngine.triggerUnitAttackAnimation(s.id, def.id);
            });
        }

        // 突撃の予備動作時間（少し征E��てからエフェクト！E
        await this.wait(150);

        // スラッシュ軌跡エフェクト
        if (this.renderingEngine && this.renderingEngine.add3DEffect) {
            this.renderingEngine.add3DEffect('SLASH', att, def);
        }

        this.spawnSparks(att, def); // 攻撁E�Eと防御側の間に火花

        this.audioEngine.sfxHit();
        await this.wait(300);

        // 地形ボ�Eナス�E�建物の高さを老E�E�E�E
        // 単位を世界単位！Eorld units�E�で統一

        let hAtt = (map[att.y]?.[att.x]?.z || 0) * TILE_HEIGHT; // グリチE��単位�E世界単佁E
        let hDef = (map[def.y]?.[def.x]?.z || 0) * TILE_HEIGHT; // グリチE��単位�E世界単佁E

        // mapSystemがある場合�E建物の高さも老E�E�E�キャチE��ュ付き�E�E
        // どちらも世界単位なので正しく比輁E��きる
        if (this.mapSystem) {
            hAtt = Math.max(hAtt, this.mapSystem.getHeight(att.x, att.y));
            hDef = Math.max(hDef, this.mapSystem.getHeight(def.x, def.y));
        }

        let mod = 1.0 + (hAtt > hDef ? 0.3 : 0) + (siegers.length * 0.2);

        // 方向�Eーナス
        let dirDiff = Math.abs(att.dir - def.dir);
        if (dirDiff > 3) dirDiff = 6 - dirDiff;

        let dirMod = 1.0;
        let dirMsg = "";
        if (dirDiff === 0) {
            dirMod = 2.0;
            dirMsg = "背面攻撁E";
        } else if (dirDiff !== 3) {
            dirMod = 1.5;
            dirMsg = "側面攻撁E";
        }

        if (dirMsg) this.spawnText({ q: def.x, r: def.y }, dirMsg, "#ffff00", 40);

        // 陣形によるスチE�Eタス修正
        const attFormation = getFormationModifiers(att.formation);
        const defFormation = getFormationModifiers(def.formation);
        const finalAtkStat = att.atk + attFormation.atk;
        const finalDefStat = def.def + defFormation.def;

        // 入力値の検証�E�EaN発生源�E特定用�E�E
        if (typeof att.atk !== 'number' || typeof att.soldiers !== 'number' ||
            typeof def.def !== 'number' || typeof def.soldiers !== 'number') {
            // Invalid unit data - skip with safe defaults
        }

        // ダメージ計算（陣形修正を適用�E�E
        // 安�Eな兵士数�E�負やNaNを防止�E�E
        const safeSoldiers = (typeof att.soldiers === 'number' && att.soldiers > 0) ? att.soldiers : 1;
        let dmgToDef = Math.floor((Math.sqrt(safeSoldiers) * finalAtkStat * mod * dirMod) / (finalDefStat / 15));
        if (!Number.isFinite(dmgToDef) || dmgToDef < 10) dmgToDef = 10;

        // 確率防御（Guard）判定
        const guardResult = this.rollGuard(def);
        dmgToDef = Math.floor(dmgToDef * guardResult.damageMultiplier);

        // ダメージ適用（被攻撃側のみ）
        def.soldiers -= dmgToDef;
        this.spawnText({ q: def.x, r: def.y }, `-${dmgToDef}`, '#ff3333', 60);
        this.speak(def, 'DAMAGED');

        // 被ダメージアニメーションをトリガー
        if (this.renderingEngine && this.renderingEngine.triggerDamageAnimation) {
            this.renderingEngine.triggerDamageAnimation(def.id);
        }

        // 3Dレンダラー側のユニット情報を更新�E��E士数ゲージなど�E�E
        if (this.renderingEngine && this.renderingEngine.updateUnitInfo) {
            // ユニットメチE��ュを取得して更新
            const attMesh = this.renderingEngine.unitMeshes.get(att.id);
            const defMesh = this.renderingEngine.unitMeshes.get(def.id);
            if (attMesh) this.renderingEngine.updateUnitInfo(attMesh, att);
            if (defMesh) this.renderingEngine.updateUnitInfo(defMesh, def);
        }

        // 死亡判定！EaNの場合も死亡として扱ぁE��E
        if (def.soldiers <= 0 || isNaN(def.soldiers)) {
            def.soldiers = 0;
            def.dead = true;
            // 死亡アニメーションをトリガー�E�フェードアウト付き�E�E
            if (this.renderingEngine && this.renderingEngine.triggerDeathAnimation) {
                this.renderingEngine.triggerDeathAnimation(def.id);
            }
            await this.dramaticDeath(def, att.side);
        }

        // EXP獲得・レベルアップ
        this._awardExp(att, def);

        // 注: 攻撃側はダメージを受けないため、死亡判定は不要

        // ---------------------------------------------------------
        // 騎�E押し�Eし！EAVALRY: canPushBack === true�E�E
        // 攻撁E��向に防御側めEマス押し戻ぁE
        // ---------------------------------------------------------
        const attTypeInfo = UNIT_TYPES[att.type] || UNIT_TYPES.INFANTRY;
        if (attTypeInfo.canPushBack && !def.dead) {
            // 攻撁E��E��ら防御老E��の方向�Eクトルを計箁E
            const pushDx = Math.sign(def.x - att.x);
            const pushDy = Math.sign(def.y - att.y);
            // 方向が算�EできなぁE��合（同じ�Eスに屁E��等）�EスキチE�E
            if (pushDx !== 0 || pushDy !== 0) {
                const newX = def.x + pushDx;
                const newY = def.y + pushDy;

                // 押し�Eし�Eが有効かチェチE��
                let canPush = true;

                // マップ篁E��チェチE��
                if (newX < 0 || newY < 0 || !map[newY] || !map[newY][newX]) {
                    canPush = false;
                }

                // 他�Eユニットが占有してぁE��ぁE��チェチE��
                if (canPush && allUnits) {
                    const occupied = allUnits.find(u =>
                        !u.dead && u.id !== def.id && u.x === newX && u.y === newY
                    );
                    if (occupied) canPush = false;
                }

                // 高低差チェチE���E�段差2まで = 32 world units�E�E
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
     * 劁E��な死亡演�E
     * @param {Object} unit - 討ち取られたユニッチE
     * @param {string} killerSide - 討ち取った�Eの陣営
     */
    // ==================== Guard / EXP / LevelUp ====================

    rollGuard(defender) {
        const defVal = defender.def || 50;
        const agiVal = defender.AGI || defender.agi || 50;
        const chance = Math.min(0.5, (defVal + agiVal) / 400);
        if (Math.random() < chance) {
            this.spawnText({ q: defender.x, r: defender.y }, 'Guard!', '#44aaff', 50);
            return { triggered: true, damageMultiplier: 0.5 };
        }
        return { triggered: false, damageMultiplier: 1.0 };
    }

    _awardExp(attacker, defender) {
        if (!defender.dead) return;
        const baseExp = Math.max(1, Math.floor((defender.maxSoldiers || 100) * 0.01 + (defender.level || 1) * 5));
        attacker.exp = (attacker.exp || 0) + baseExp;
        this.spawnText({ q: attacker.x, r: attacker.y }, `+${baseExp} EXP`, '#00ccff', 50);
        this._processLevelUps(attacker);
    }

    _processLevelUps(unit) {
        const growth = COMMANDER_GROWTH_RATES[unit.type] || COMMANDER_GROWTH_RATES.INFANTRY;
        const statKeys = ['ATK', 'DEF', 'AGI', 'VIT', 'INT', 'MND', 'LUK'];
        const combatMap = { ATK: 'atk', DEF: 'def' };
        let safetyCounter = 0;

        while (unit.exp >= expToNextLevel(unit.level) && unit.level < MAX_LEVEL && safetyCounter < 10) {
            unit.exp -= expToNextLevel(unit.level);
            unit.level++;
            safetyCounter++;

            for (const key of statKeys) {
                const rate = growth[key] || 0;
                const roll = Math.random() * 100;
                const currentVal = unit[key] ?? 50;
                if (roll < rate && currentVal < STAT_CAP) {
                    unit[key] = currentVal + 1;
                    if (unit.baseStats && unit.baseStats[key] !== undefined) {
                        unit.baseStats[key] = Math.min(STAT_CAP, unit.baseStats[key] + 1);
                    }
                    if (combatMap[key] && unit[combatMap[key]] !== undefined) {
                        unit[combatMap[key]] = unit[key];
                    }
                }
            }
            this.spawnText({ q: unit.x, r: unit.y }, `Lv${unit.level}!`, '#ffd700', 50);
        }
    }

    // ==================== Death Animation ====================

    async dramaticDeath(unit, killerSide) {
        // 本陣かどぁE�を判宁E
        const isHeadquarters = (unit.unitType === 'HEADQUARTERS');

        // 討ち取った�EによってSEを変更
        if (killerSide === this.playerSide) {
            // 敵を討ち取った！シャキーン�E�E
            this.audioEngine.sfxVictorySlash();
        } else {
            // 味方が討ち取られた…ズバッ
            this.audioEngine.sfxDefeatSlash();
        }

        this.speak(unit, 'DYING', true);

        const flash = document.getElementById('flash-overlay');
        flash.style.opacity = 0.5;
        setTimeout(() => flash.style.opacity = 0, 150);

        // メチE��ージを本陣と配下部隊で区別
        let msg, color;

        if (isHeadquarters) {
            // 総大封E��宁E
            const isCommander = (unit.name === "徳川家康" || unit.name === "石田三成");

            if (unit.side !== this.playerSide) {
                // 敵本陣の場合、討ち死にか敗走かをランダムで決宁E
                // 封E��皁E��は士気などが関わる予宁E
                if (Math.random() < 0.5) {
                    // パターンA: 敗走�E�撤退�E�E
                    if (isCommander) {
                        msg = `敵総大将${unit.name}、戦場より撤退！`;
                    } else {
                        msg = `${unit.name}、戦場より撤退！`;
                    }
                    color = '#ffa500'; // オレンジ色

                    // 顔グラフィチE��のカチE��イン表示
                    if (unit.face) {
                        this.showWarlordCutIn(unit, 'ROUT');
                    }
                } else {
                    // パターンB: 討ち死に
                    if (isCommander) {
                        msg = `敵総大将${unit.name}、討ち取ったり！`;
                    } else {
                        msg = `敵将${unit.name}、討ち取ったり！`;
                    }
                    color = '#ff0';

                    // 顔グラフィチE��のカチE��イン表示�E�討ち死に用�E�E
                    if (unit.face) {
                        this.showWarlordCutIn(unit, 'DEATH');
                    }
                }
            } else {
                // 味方本陣の場吁E
                if (Math.random() < 0.5) {
                    // 敗走
                    if (isCommander) {
                        msg = `総大将${unit.name}、戦場より撤退！`;
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
            // 配下部隁E 「撃破/壊滁E��メチE��ージ
            msg = (unit.side === this.playerSide) ?
                `${unit.warlordName}配下の部隊、壊滅！` :
                `${unit.warlordName}配下の部隊、撃破！`;
            color = (unit.side === this.playerSide) ? '#aaa' : '#ffa500';
        }

        // チE��スト表示
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
        // チE��ストシャドウめE��ォントサイズを強匁E
        div.style.fontSize = isHeadquarters ? '36px' : '24px';
        div.style.textShadow = '2px 2px 4px #000';

        document.getElementById('game-container').appendChild(div);
        setTimeout(() => div.remove(), 3000);

        await this.wait(1000);
    }

    /**
     * 武封E�EカチE��インを表示�E�敗走時など�E�E
     * @param {Object} unit
     * @param {string} type 'ROUT' | 'DEATH'
     */
    showWarlordCutIn(unit, type) {
        const container = document.getElementById('game-container');

        // 画像要素作�E
        const img = document.createElement('img');
        img.src = `portraits/${unit.face}`;
        img.style.position = 'absolute';
        img.style.top = '50%';
        img.style.left = '50%';
        img.style.transform = 'translate(-50%, -50%) scale(0.5)';
        img.style.maxHeight = '60%';
        img.style.zIndex = 140; // チE��スチE150)の後ろ
        img.style.opacity = '0';
        img.style.transition = 'all 0.5s ease-out';
        img.style.pointerEvents = 'none';

        container.appendChild(img);

        // アニメーション開姁E
        requestAnimationFrame(() => {
            img.style.opacity = '1';
            img.style.transform = 'translate(-50%, -50%) scale(1.0)';
        });

        if (type === 'DEATH') {
            // 討ち死に演�E: ランダムで3パターンから選抁E
            const variation = Math.floor(Math.random() * 3) + 1;

            setTimeout(() => {
                // まず�E共通でモノクロ匁E
                img.style.filter = 'grayscale(100%) contrast(1.2) brightness(0.8)';
                img.style.transition = 'filter 1.0s ease, transform 0.2s';

                // 少し揺らして衝撃を表現
                img.style.transform = 'translate(-50%, -50%) scale(1.05)';
                setTimeout(() => img.style.transform = 'translate(-50%, -50%) scale(1.0)', 100);

                // 吁E���Eへ刁E��E
                setTimeout(() => {
                    if (variation === 1) {
                        // 演�E1: 散る（既存！E
                        img.style.transition = 'all 1.5s ease-out';
                        img.style.opacity = '0';
                        img.style.transform = 'translate(-50%, -50%) scale(1.5)';
                        img.style.filter = 'grayscale(100%) blur(10px)'; // ぼめE��て消えめE

                        setTimeout(() => img.remove(), 1500);

                    } else if (variation === 2) {
                        // 演�E2: 両断�E�左右に割れて上下にズレる！E

                        // 画像を褁E��して左右を作�E
                        // 左半�E
                        const left = img.cloneNode();
                        left.style.clipPath = 'polygon(0% 0%, 50% 0%, 50% 100%, 0% 100%)';
                        left.style.transition = 'all 1.2s ease-in';
                        container.appendChild(left);

                        // 右半�E
                        const right = img.cloneNode();
                        right.style.clipPath = 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)';
                        right.style.transition = 'all 1.2s ease-in';
                        container.appendChild(right);

                        // 允E��像�E隠ぁE
                        img.style.display = 'none';

                        // アニメーション実行（左上�E右下へスライドしながらフェードアウト！E
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
                        // 演�E3: 血し�Eき（赤黒いエフェクト！E

                        // ベ�Eス画像を赤黒く変化させめE
                        // grayscale -> sepia -> hue-rotate(赤系) -> saturate(濁E��) -> brightness(暗く)
                        img.style.transition = 'all 0.5s ease-in';
                        img.style.filter = 'grayscale(100%) sepia(100%) hue-rotate(-50deg) saturate(500%) contrast(1.5) brightness(0.4)';
                        img.style.transform = 'translate(-50%, -50%) scale(1.02)';

                        // 血のオーバ�Eレイを追加
                        const bloodOverlay = document.createElement('div');
                        bloodOverlay.style.position = 'absolute';
                        bloodOverlay.style.top = '50%';
                        bloodOverlay.style.left = '50%';
                        // 画像サイズを正確に取得する�Eは難しいので、画面中央に大きめの冁E��グラチE�Eションを�EぁE
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

                        // フェードアウチE
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
                }, 1200); // モノクロを見てる時閁E

            }, 800); // 最初�E表示時間

        } else {
            // 敗走演�E: 表示 -> フレームアウチEor フェードアウチE
            setTimeout(() => {
                img.style.opacity = '0';
                img.style.transform = 'translate(-50%, -50%) scale(0.8)'; // 奥に引っ込む感じ
                setTimeout(() => img.remove(), 500);
            }, 2000);
        }
    }

    // ユーチE��リチE��関数
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

        // 3D版�E unit.x/unit.y を直接使用、ED版�E unit.pos を使用
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
        this.speak(unit, 'FORMATION'); // 陣形変更時�Eセリフがあれば
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
        // 速度倍率を適用 (速度が高いほど征E��時間が短くなめE
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
                // 火花の物琁E��算（ほとんど動かなぁE��さな閁E���E�E
                e.x += e.vx;
                e.y += e.vy;
                e.vx *= 0.85; // 強ぁE��気抵抗ですぐに減衰
                e.vy *= 0.85;
            }
        });
        this.activeEffects = this.activeEffects.filter(e => e.life > 0);

        this.activeBubbles.forEach(b => b.life--);
        this.activeBubbles = this.activeBubbles.filter(b => b.life > 0);
    }

    // =====================================
    // 弓攻撁E��スチE�� (Bow Attack System)
    // =====================================

    /**
     * 弓�E有効封E��を計算（高低差による変動�E�E
     * @param {number} attackerZ - 攻撁E��E�E高さ
     * @param {number} targetZ - 対象の高さ
     * @param {number} baseRange - 基本封E��（デフォルチE�E�E
     * @returns {number} 有効封E��E
     */
    calculateBowRange(attackerZ, targetZ, baseRange = 5) {
        const heightDiff = attackerZ - targetZ;
        // 高所からは封E��が伸び、低所からは封E��が縮む
        // 最封E、最大 baseRange + 3
        return Math.max(1, Math.min(baseRange + 3, baseRange + heightDiff));
    }

    /**
     * 矢の軌道が障害物で遮られるかチェチE��
     * タクチE��クスオウガ風の軌道シスチE��を採用�E�E
     * - 近距離封E���E�高い弧の軌道�E�障害物をクリアしやすい�E�E
     * - 遠距離封E���E�低い弧の軌道�E�障害物に阻まれやすい�E�E
     * @param {Object} from - 発封E�EユニッチE
     * @param {Object} to - 対象ユニッチE
     * @param {Array} map - マップデータ
     * @returns {{blocked: boolean, blockPos: {x,y,z}|null, arcHeight: number}} 遮蔽惁E��と弧の高さ
     */
    isArrowPathBlocked(from, to, map) {
        // 放物線�E頂点を計箁E
        const dist = getDistRaw(from.x, from.y, to.x, to.y);

        // 高さは世界単位で統一�E�EILE_HEIGHT = 16�E�E

        let fromZ = (map[from.y]?.[from.x]?.z || 0) * TILE_HEIGHT;
        let toZ = (map[to.y]?.[to.x]?.z || 0) * TILE_HEIGHT;

        // mapSystemがある場合�E建物の高さも老E�E�E�キャチE��ュ付き�E�E
        if (this.mapSystem) {
            fromZ = Math.max(fromZ, this.mapSystem.getHeight(from.x, from.y));
            toZ = Math.max(toZ, this.mapSystem.getHeight(to.x, to.y));
        }

        // 高低差に基づく弧の高さを計箁E
        const heightDiff = toZ - fromZ;
        const isShootingUp = heightDiff > 0;

        const maxRange = 12;
        const distFactor = 1 - Math.min(dist / maxRange, 1);

        // 基本弧の高さ�E�世界単位で計算！E
        // 以前�E計算式�E高すぎたので修正: (15 + 65 * distFactor) -> (2 + 10 * distFactor)
        // 1グリチE��距離あたりではなく、より物琁E��な見た目を重要E
        const baseArcHeight = (1 + 6 * distFactor) * TILE_HEIGHT;

        let arcHeight = baseArcHeight;
        if (isShootingUp) {
            // 見上げるとき�E少し弧を高くしなぁE��刺さらなぁE��、以前�E +heightDiff*2 は過剰
            arcHeight = baseArcHeight + heightDiff * 0.5;
        }

        // 軌道上�E吁E��リチE��をチェチE��
        const steps = Math.ceil(dist * 2); // スチE��プ数を増やして精度向丁E
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const checkX = Math.round(from.x + (to.x - from.x) * t);
            const checkY = Math.round(from.y + (to.y - from.y) * t);

            // マップ篁E��チェチE��
            if (!map[checkY] || !map[checkY][checkX]) continue;

            let tileZ = (map[checkY][checkX].z || 0) * TILE_HEIGHT;

            // 経路上�EグリチE��でも建物の高さを老E�E
            if (this.mapSystem) {
                tileZ = Math.max(tileZ, this.mapSystem.getHeight(checkX, checkY));
            }

            // 放物線上�E高さを計算（パラボラ�E�E
            const arcZ = fromZ + (toZ - fromZ) * t + 4 * arcHeight * t * (1 - t);

            // 障害物チェチE���E�ターゲチE��より低い位置にある障害物はブロチE��
            // 判定�Eージンを少し設ける�E�E4�E�E
            if (tileZ > arcZ + 4) {
                // 衝突E��E
                // 衝突地点のZは、arrowの高さ(arcZ)ではなく障害物の表面(tileZ)でもなく、E
                // 見た目皁E��は「刺さった場所、E arcZ を返すべき、E
                return {
                    blocked: true,
                    blockPos: { x: checkX, y: checkY, z: arcZ }, // 表示用座樁E
                    t: t, // 進行割吁E
                    arcHeight: arcHeight
                };
            }

            // 低所から高所へ撁E��場合、E��中に壁があるとブロチE��
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
     * 遠距離攻撁E��実衁E
     * @param {Object} att - 攻撁E��E
     * @param {Object} def - 防御老E
     * @param {Array} map - マップデータ
     * @param {Array} allUnits - 全ユニット�E列！EoE/ブレス篁E��ダメージ用�E�E
     */
    async rangedCombat(att, def, map, allUnits = []) {
        att.dir = getFacingAngle(att.x, att.y, def.x, def.y);

        // Debug Log
        // console.log(`[Combat] rangedCombat start.`);

        // 攻撁E��ニメーションをトリガー (忁E��E
        if (this.renderingEngine && this.renderingEngine.triggerUnitAttackAnimation) {
            this.renderingEngine.triggerUnitAttackAnimation(att.id, def.id);
        }

        // 攻撁E��備動作征E��
        await this.wait(300);

        // 単位を世界単位！Eorld units�E�で統一

        let attZ = (map[att.y]?.[att.x]?.z || 0) * TILE_HEIGHT; // グリチE��単位�E世界単佁E
        let defZ = (map[def.y]?.[def.x]?.z || 0) * TILE_HEIGHT; // グリチE��単位�E世界単佁E

        // mapSystemがある場合�E建物の高さも老E�E�E�キャチE��ュ付き�E�E
        // どちらも世界単位なので正しく比輁E��きる
        if (this.mapSystem) {
            attZ = Math.max(attZ, this.mapSystem.getHeight(att.x, att.y));
            defZ = Math.max(defZ, this.mapSystem.getHeight(def.x, def.y));
        }

        // 高さ差による封E��制限：ターゲチE��が攻撁E��E��り高すぎる場合�E攻撁E��可
        // 段差2�E�E2 world units�E�を趁E��る場合�E遠距離攻撁E��可�E�城壁対応！E
        const MAX_RANGED_HEIGHT_DIFF = 2 * TILE_HEIGHT; // 32 world units

        // ワールドユニットでの高さ差を計箁E
        const heightDiff = defZ - attZ;

        if (heightDiff > MAX_RANGED_HEIGHT_DIFF) {
            // ターゲチE��が高すぎて到達できなぁE
            this.spawnText({ q: att.x, r: att.y }, "届かない", '#888', 40);
            await this.wait(300);
            return;
        }

        // ユニットタイプに応じた攻撁E���E
        const typeInfo = UNIT_TYPES[att.type] || UNIT_TYPES.INFANTRY;
        const rangeType = typeInfo.rangeType || 'bowArc';

        if (rangeType === 'aoe') {
            // 魔術師�E�魔法弾
            this.audioEngine.sfxMagicAtk && this.audioEngine.sfxMagicAtk();
            if (this.renderingEngine && this.renderingEngine.spawnMagicProjectile) {
                await this.renderingEngine.spawnMagicProjectile(att, def, 0xAA00FF);
                // 着弾時に落雷エフェクト
                if (this.renderingEngine.add3DEffect) {
                    this.renderingEngine.add3DEffect('THUNDER_STRIKE', def.x, def.y);
                }
            } else {
                await this.wait(500);
            }
        } else if (rangeType === 'breath') {
            // ドラゴン�E�ブレス(赤)
            this.audioEngine.sfxBreath && this.audioEngine.sfxBreath();
            if (this.renderingEngine && this.renderingEngine.spawnMagicProjectile) {
                await this.renderingEngine.spawnMagicProjectile(att, def, 0xFF4400);
            } else {
                await this.wait(500);
            }
        } else if (rangeType === 'heal') {
            // 僧侶の聖なる光(味方のみ)
            // 安全チェック: ターゲットが敵の場合は回復しない（近接フォールバックはcombat()で処理）
            if (att.side === def.side) {
                this.audioEngine.sfxMagicAtk && this.audioEngine.sfxMagicAtk();
                if (this.renderingEngine && this.renderingEngine.spawnMagicProjectile) {
                    await this.renderingEngine.spawnMagicProjectile(att, def, 0xFFFF88);
                } else {
                    await this.wait(500);
                }
            }

        } else {
            // 弓�E銁E�E大砲
            // 遮蔽チェチE��
            const blockInfo = this.isArrowPathBlocked(att, def, map);

            // 矢のアニメーションを発封E
            if (this.renderingEngine && this.renderingEngine.spawnArrowAnimation) {
                await this.renderingEngine.spawnArrowAnimation(att, def, blockInfo);
            }

            if (blockInfo.blocked) {
                // 矢が�EられぁE
                // Z座標（高さ�E�を正しく反映して表示
                const textPos = {
                    q: blockInfo.blockPos.x,
                    r: blockInfo.blockPos.y,
                    height: blockInfo.blockPos.z // 高さ持E��を追加�E�Ei.js/rendering.jsでの対応が忁E��だが、渡す！E
                };
                // spawnTextは本来QR座標だが、ED表示用に高さを老E�Eさせる！EenderingHelper側で対応されてぁE��前提、なければ後で修正�E�E
                // 一旦、blockPos.zはワールド座標なので、そのまま渡す�Eは難しいかも、E
                // pixelToHex等で変換するか、spawnTextぁED座標を受け取れるか�E�E
                // spawnTextの実裁E��確認してぁE��ぁE��、既存コードに合わせて q,r を渡す、E
                // ただし、E��さを表現するために、blockPosはあくまで「どのタイルで止まったか」を示す、E
                this.spawnText(textPos, "遮蔽!", '#888', 40);
                await this.wait(300);
                return;
            }

            // ヒッチEE
            this.audioEngine.sfxHit();
        }

        // 高低差によるダメージ倍率�E�EeightDiffは上で計算済み: defZ - attZ�E�E
        let heightMod = 1.0;
        const attackHeightDiff = -heightDiff; // 攻撁E��E�Eから見た高低差�E�正=高い位置から攻撁E��E
        if (attackHeightDiff > 0) {
            heightMod = 1.0 + (attackHeightDiff * 0.15); // 高所から: +15%/段
        } else if (attackHeightDiff < 0) {
            heightMod = Math.max(0.5, 1.0 + (attackHeightDiff * 0.15)); // 低所から: -15%/段 (最佁E0%)
        }

        // 陣形によるスチE�Eタス修正
        const attFormation = getFormationModifiers(att.formation);
        const defFormation = getFormationModifiers(def.formation);
        const finalAtkStat = att.atk + attFormation.atk;
        const finalDefStat = def.def + defFormation.def;

        // 距離によるダメージ減衰�E�遠ぁE��ど威力低下！E
        // 4マスまでは減衰なし、それ以陁Eマスごとに-5%
        // ただし最低保証50%
        const dist = getDistRaw(att.x, att.y, def.x, def.y);
        let distMod = 1.0;
        if (dist > 4) {
            distMod = Math.max(0.5, 1.0 - (dist - 4) * 0.05);
        }

        // ダメージ・回復計箁E
        const safeSoldiers = (typeof att.soldiers === 'number' && att.soldiers > 0) ? att.soldiers : 1;

        if (rangeType === 'heal') {
            // 回復計箁E(攻撁E��の半�E程度を基準に)
            // 回復は自身の攻撁E��依存、相手�E防御関係なぁE
            let healAmount = Math.floor((Math.sqrt(safeSoldiers) * finalAtkStat * heightMod * distMod * 0.5));
            if (healAmount < 1) healAmount = 1;

            // 回復適用
            const oldSoldiers = def.soldiers;
            def.soldiers += healAmount;
            if (def.soldiers > def.maxSoldiers) def.soldiers = def.maxSoldiers; // 最大値キャチE�E�E�あれ�E�E�E
            // ※ここでは簡易的に允E�E兵数を最大と見なせなぁE��め、キャチE�E処琁E�E別途忁E��だが、E
            // とりあえず UNIT_TYPES から baseHp を取得するか、あるいは無制限にするか、E
            // 今回はシンプルに加算�Eみ�E�上限なし、また�EチE�Eタ構造依存！E

            this.spawnText({ q: def.x, r: def.y }, `+${healAmount}`, '#00ff00', 60);
            // this.speak(def, 'HEALED'); // ボイスがあれ�E

            // 3Dレンダラー側のユニット情報を更新
            if (this.renderingEngine && this.renderingEngine.updateUnitInfo) {
                const defMesh = this.renderingEngine.unitMeshes.get(def.id);
                if (defMesh) this.renderingEngine.updateUnitInfo(defMesh, def);
            }
            return;
        }

        // 攻撁E��メージ計算（近接より低め、ただし反撁E��し！E
        let dmgToDef = Math.floor((Math.sqrt(safeSoldiers) * finalAtkStat * heightMod * distMod * 0.7) / (finalDefStat / 15));
        if (!Number.isFinite(dmgToDef) || dmgToDef < 5) dmgToDef = 5;

        // 確率防御（Guard）判定
        const guardResult = this.rollGuard(def);
        dmgToDef = Math.floor(dmgToDef * guardResult.damageMultiplier);

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

        // 死亡判宁E
        if (def.soldiers <= 0 || isNaN(def.soldiers)) {
            def.soldiers = 0;
            def.dead = true;
            if (this.renderingEngine && this.renderingEngine.triggerDeathAnimation) {
                this.renderingEngine.triggerDeathAnimation(def.id);
            }
            await this.dramaticDeath(def, att.side);
        }

        // EXP獲得・レベルアップ
        this._awardExp(att, def);

        // ---------------------------------------------------------
        // AoEスプラッシュダメージ�E�魔術師: isAoe === true�E�E
        // 着弾点の周囲8マスにぁE��敵ユニットにめE0%のダメージを与えめE
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
        // ブレス扁E��ダメージ�E�ドラゴン/竜騎�E: rangeType === 'breath'�E�E
        // attack-patterns.jsのbreathパターンを回転させ、篁E��冁E�E全敵にダメージ
        // ---------------------------------------------------------
        if (rangeType === 'breath' && allUnits && allUnits.length > 0) {
            const breathPattern = ATTACK_PATTERNS.breath;
            if (breathPattern) {
                const rotated = rotatePattern(breathPattern, att.dir || 0);
                const breathDmg = Math.max(3, Math.floor(dmgToDef * 0.6));
                for (const { dx, dy } of rotated) {
                    const tx = att.x + dx;
                    const ty = att.y + dy;
                    // メインターゲチE��は既にダメージ済みなのでスキチE�E
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
