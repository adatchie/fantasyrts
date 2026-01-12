/**
 * SEKIGAHARA RTS - AI System (Enhanced)
 * より戦術的な判断を行うAIシステム
 */

import { getDist, getDistRaw } from './pathfinding.js';
import { FORMATION_HOKO, FORMATION_KAKUYOKU, FORMATION_GYORIN, UNIT_TYPE_HEADQUARTERS } from './constants.js';

export class AISystem {
    constructor() {
        this.evaluationCache = new Map();
    }

    /**
     * CPUユニットの行動を決定
     */
    decideAction(unit, allUnits, map) {
        // 吉川広家と毛利秀元の特殊処理
        if (unit.name === '吉川広家') return null;
        if (unit.name === '毛利秀元' && allUnits.find(u => u.name === '吉川広家' && !u.dead)) {
            return null;
        }

        // 既存の命令が有効ならそのまま（ただし攻撃目標が死んでいたらリセット）
        if (unit.order && unit.order.type === 'ATTACK') {
            const target = allUnits.find(u => u.id === unit.order.targetId);
            if (target && !target.dead && target.side !== unit.side) {
                return unit.order;
            }
        }

        // 敵ユニットをリストアップ
        const enemies = allUnits.filter(t => t.side !== unit.side && !t.dead);
        if (enemies.length === 0) return null;

        // 調略の可能性を検討（仁が高い場合）
        if (unit.jin >= 75) {
            const plotTarget = this.considerPlot(unit, enemies, allUnits, map);
            if (plotTarget) {
                return { type: 'PLOT', targetId: plotTarget.id };
            }
        }

        // 戦術的評価で最適な目標を選択
        const bestTarget = this.selectBestTarget(unit, enemies, allUnits, map);
        if (!bestTarget) return null;

        return { type: 'ATTACK', targetId: bestTarget.id };
    }

    /**
     * 調略を検討
     */
    considerPlot(unit, enemies, allUnits, map) {
        // 忠誠度が低い敵を探す
        const plotCandidates = enemies.filter(e =>
            e.loyalty < 80 &&
            getDist(unit, e) <= 8 // ある程度近い
        );

        if (plotCandidates.length === 0) return null;

        // 最も調略しやすそうな敵を選択
        let bestScore = -Infinity;
        let bestCandidate = null;

        for (const enemy of plotCandidates) {
            // 戦況を考慮
            const eTotal = allUnits.filter(u => u.side === 'EAST' && !u.dead)
                .reduce((a, c) => a + c.soldiers, 0);
            const wTotal = allUnits.filter(u => u.side === 'WEST' && !u.dead)
                .reduce((a, c) => a + c.soldiers, 0);
            const myTotal = unit.side === 'EAST' ? eTotal : wTotal;
            const total = eTotal + wTotal;
            const tideRatio = myTotal / (total || 1);
            const tideMod = (tideRatio - 0.5) * 100;

            const successChance = 30 + (unit.jin - enemy.loyalty) + tideMod;

            // 成功率が30%以上なら検討
            if (successChance >= 30) {
                const score = successChance + (enemy.soldiers / 100); // 兵力が多いほど価値が高い
                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = enemy;
                }
            }
        }

        return bestCandidate;
    }

    /**
     * 戦術的評価で最適な目標を選択
     */
    selectBestTarget(unit, enemies, allUnits, map) {
        let bestScore = -Infinity;
        let bestTarget = null;

        for (const enemy of enemies) {
            const score = this.evaluateTarget(unit, enemy, allUnits, map);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = enemy;
            }
        }

        return bestTarget;
    }

    /**
     * 目標の評価スコアを計算
     */
    evaluateTarget(unit, enemy, allUnits, map) {
        let score = 0;

        // 1. 距離（近いほうが良い）
        const distance = getDist(unit, enemy);
        score += (50 - distance) * 2; // 最大100点

        // 2. 敵の弱さ（兵力が少ないほど良い）
        const enemyStrength = enemy.soldiers;
        score += (10000 - enemyStrength) / 100; // 最大100点

        // 3. 地形優位性
        const unitHeight = map[unit.y]?.[unit.x]?.h || 0;
        const enemyHeight = map[enemy.y]?.[enemy.x]?.h || 0;
        if (unitHeight > enemyHeight) {
            score += 30; // 高所にいる
        }

        // 4. 協調攻撃の可能性（味方との距離）
        const allies = allUnits.filter(u =>
            u.side === unit.side &&
            !u.dead &&
            u.id !== unit.id &&
            getDist(u, enemy) <= 5
        );
        score += allies.length * 20; // 味方が近くにいるほど良い

        // 5. 重要目標ボーナス（大将クラス）
        if (enemy.size === 2) {
            score += 50;
        }

        // 6. 側面・背面攻撃の可能性
        // （実装簡略化のため、距離が近い場合にボーナス）
        if (distance <= 3) {
            score += 25;
        }

        // 7. 忠誠度が低い敵は避ける（寝返る可能性）
        if (enemy.loyalty < 70) {
            score -= 30;
        }

        return score;
    }

    /**
     * AIの思考をリセット（ターン開始時など）
     */
    reset() {
        this.evaluationCache.clear();
    }

    /**
     * CPUの陣形を決定
     * @param {Object} hqUnit - 本陣ユニット
     * @param {Array} allUnits - 全ユニット
     * @param {number} subordinateCount - 配下ユニット数
     * @returns {string} - 選択する陣形
     */
    decideFormation(hqUnit, allUnits, subordinateCount) {
        // 1. 本陣兵力による強制陣形
        if (hqUnit.soldiers <= 500) {
            return FORMATION_GYORIN; // 魚鱗
        }
        if (hqUnit.soldiers <= 800) {
            return FORMATION_KAKUYOKU; // 鶴翼
        }

        // 2. 配下ユニット数による制限
        if (subordinateCount < 1) {
            return FORMATION_HOKO; // 鋒矢のみ選択可
        }
        if (subordinateCount < 2) {
            // 鶴翼まで選択可
            // 兵力比率で判定
            const { friendly, enemy } = this.countNearbyForces(hqUnit, allUnits, 5);
            const ratio = friendly / (enemy || 1);
            return ratio >= 1.5 ? FORMATION_HOKO : FORMATION_KAKUYOKU;
        }

        // 3. 周囲5HEX以内の敵味方兵力を計算
        const { friendly, enemy } = this.countNearbyForces(hqUnit, allUnits, 5);

        // 4. 兵力比率で判定
        const ratio = friendly / (enemy || 1);

        // 総大将（徳川家康・石田三成）は特別扱い：より保守的な判定
        const isCommander = (hqUnit.name === '徳川家康' || hqUnit.name === '石田三成');

        if (isCommander) {
            // 総大将は守りを固くする（ユーザー要望）
            // 3倍以上の圧倒的優勢でない限り、基本は魚鱗（防御+20）で進む
            if (ratio >= 3.0) {
                console.log(`[総大将陣形] ${hqUnit.name}: 圧倒的優勢(${ratio.toFixed(2)}) → 鋒矢`);
                return FORMATION_HOKO;      // 鋒矢（一気に攻め滅ぼす）
            } else {
                // 多少優勢でも防御優先
                console.log(`[総大将陣形] ${hqUnit.name}: 防御重視(${ratio.toFixed(2)}) → 魚鱗`);
                return FORMATION_GYORIN;    // 魚鱗（鉄壁の守り）
            }
        } else {
            // 通常の武将は従来通り
            if (ratio >= 1.5) {
                return FORMATION_HOKO;      // 鋒矢（優勢）
            } else if (ratio <= 0.67) {
                return FORMATION_GYORIN;    // 魚鱗（劣勢）
            } else {
                return FORMATION_KAKUYOKU;  // 鶴翼（拮抗）
            }
        }
    }

    /**
     * 周囲の兵力を計算
     * @param {Object} hqUnit - 本陣ユニット
     * @param {Array} allUnits - 全ユニット
     * @param {number} radius - 半径（HEX）
     * @returns {{friendly: number, enemy: number}} - 味方と敵の兵力
     */
    countNearbyForces(hqUnit, allUnits, radius) {
        let friendly = 0;
        let enemy = 0;

        for (const unit of allUnits) {
            if (unit.dead) continue;

            const dist = getDistRaw(hqUnit.x, hqUnit.y, unit.x, unit.y);
            if (dist <= radius) {
                if (unit.side === hqUnit.side) {
                    friendly += unit.soldiers;
                } else {
                    enemy += unit.soldiers;
                }
            }
        }

        return { friendly, enemy };
    }
}
