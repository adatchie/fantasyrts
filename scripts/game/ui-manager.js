/**
 * SEKIGAHARA RTS - UI Manager
 * HUD更新、ユニット選択UI、陣形パネル、速度制御UIを管理するモジュール
 *
 * main.jsのGameクラスからUI関連ロジックを分離。
 */

import { UNIT_TYPE_HEADQUARTERS, UNIT_TYPES } from '../constants.js';
import { FORMATION_HOKO, FORMATION_KAKUYOKU, FORMATION_GYORIN } from '../constants.js';
import { FORMATION_INFO, getAvailableFormations } from '../formation.js?v=118';

export class UIManager {
    /**
     * @param {Object} game - Gameインスタンス
     */
    constructor(game) {
        this.game = game;
    }

    // ==================== HUD ====================

    updateHUD() {
        const game = this.game;
        const eS = game.units.filter(u => u.side === 'EAST' && !u.dead)
            .reduce((a, c) => a + c.soldiers, 0);
        const wS = game.units.filter(u => u.side === 'WEST' && !u.dead)
            .reduce((a, c) => a + c.soldiers, 0);
        document.getElementById('status-text').innerText = `東軍: ${eS} / 西軍: ${wS}`;
    }

    // ==================== Selection UI ====================

    updateSelectionUI(list, targetUnit = null) {
        const game = this.game;
        const container = document.getElementById('unit-list');
        container.innerHTML = '';

        // ターゲットユニットがある場合、その情報を最上部に表示
        if (targetUnit) {
            this._renderTargetCard(container, targetUnit);

            // 区切り線
            const hr = document.createElement('hr');
            hr.style.borderColor = '#444';
            hr.style.margin = '5px 0 15px 0';
            container.appendChild(hr);
        }

        // 選択されているユニットがない場合は、味方全武将を表示
        let displayList = list;
        if (!list || list.length === 0) {
            displayList = game.units.filter(u => u.side === game.playerSide && !u.dead);
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
            this._renderUnitCard(container, units, warlordId);
        });
    }

    /**
     * ターゲットユニットのカードを描画
     * @private
     */
    _renderTargetCard(container, targetUnit) {
        const game = this.game;
        const targetWarlordUnits = game.unitManager.getUnitsByWarlordId(targetUnit.warlordId);
        const targetHeadquarters = targetWarlordUnits.find(u => u.unitType === UNIT_TYPE_HEADQUARTERS) || targetWarlordUnits[0];
        const targetTotalSoldiers = targetWarlordUnits.reduce((sum, u) => sum + (u.dead ? 0 : u.soldiers), 0);
        const targetUnitCount = targetWarlordUnits.filter(u => !u.dead).length;

        const targetDiv = document.createElement('div');
        targetDiv.className = 'unit-card target-card ' + (targetHeadquarters.side === 'EAST' ? 'card-east' : 'card-west');
        targetDiv.style.border = '2px solid #FF0000';
        targetDiv.style.marginBottom = '10px';

        const img = document.createElement('img');
        img.className = 'portrait';
        if (targetHeadquarters.imgCanvas) {
            img.src = targetHeadquarters.imgCanvas.toDataURL();
        }

        // 顔グラフィック
        if (targetHeadquarters.face) {
            const faceImg = this._createFaceImage(targetHeadquarters);
            targetDiv.appendChild(faceImg);
        }

        const info = document.createElement('div');
        info.style.flex = '1';
        const targetTypeInfo = UNIT_TYPES[targetHeadquarters.type] || UNIT_TYPES.INFANTRY;
        const targetTypeMarker = targetTypeInfo.marker || '';
        info.innerHTML = `<strong style="color:#FF8888">[目標] ${targetHeadquarters.name} ${targetTypeMarker}</strong><br>兵: ${targetTotalSoldiers} (${targetUnitCount}部隊) <small>(攻${targetHeadquarters.atk}/防${targetHeadquarters.def})</small>`;

        targetDiv.appendChild(img);
        targetDiv.appendChild(info);
        container.appendChild(targetDiv);
    }

    /**
     * 武将ユニットカードを描画
     * @private
     */
    _renderUnitCard(container, units, warlordId) {
        const game = this.game;
        const headquarters = units.find(u => u.unitType === UNIT_TYPE_HEADQUARTERS) || units[0];
        const totalSoldiers = units.reduce((sum, u) => sum + u.soldiers, 0);
        const unitCount = units.length;

        const d = document.createElement('div');
        d.className = 'unit-card ' + (headquarters.side === 'EAST' ? 'card-east' : 'card-west');

        // クリックで武将の全ユニットを選択
        d.onclick = () => {
            game.selectedUnits = units.filter(u => !u.dead);
            this.updateSelectionUI(game.selectedUnits);
        };

        let ord = "待機";
        if (headquarters.order) {
            const target = game.units.find(u => u.id === headquarters.order.targetId);
            const targetName = target ? target.name : "地点";
            const typeMap = { 'MOVE': '移動', 'ATTACK': '攻撃', 'PLOT': '調略' };
            ord = `<span style="color:#aaf">${typeMap[headquarters.order.type]}</span> -> ${targetName}`;
        }

        // 顔グラフィック
        console.log(`[UI] ${headquarters.name} face property:`, headquarters.face);
        if (headquarters.face) {
            const faceImg = this._createFaceImage(headquarters);
            d.appendChild(faceImg);
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

        const unitTypeInfo = UNIT_TYPES[headquarters.type] || UNIT_TYPES.INFANTRY;
        const typeMarker = unitTypeInfo.marker || '';

        info.innerHTML = `<strong>${headquarters.name} ${typeMarker}</strong><br>兵: ${totalSoldiers} (${unitCount}部隊) <small>(攻${headquarters.atk}/防${headquarters.def})</small>${formationText}<br>指示: ${ord}`;

        d.appendChild(img);
        d.appendChild(info);

        // 本陣の場合、陣形ボタンを追加
        if (headquarters.unitType === UNIT_TYPE_HEADQUARTERS && headquarters.side === game.playerSide) {
            console.log('Creating formation controls for:', headquarters.name, 'Type:', headquarters.unitType, 'Side:', headquarters.side, 'PlayerSide:', game.playerSide);
            const formationContainer = this._createFormationControls(headquarters, units);
            d.appendChild(formationContainer);
            console.log('Formation controls created successfully');
        } else {
            console.log('Skipping formation controls for:', headquarters.name, 'Type:', headquarters.unitType, 'isHQ:', headquarters.unitType === UNIT_TYPE_HEADQUARTERS, 'isPlayerSide:', headquarters.side === game.playerSide);
        }

        container.appendChild(d);
    }

    /**
     * 顔画像要素を生成
     * @private
     */
    _createFaceImage(unit) {
        const faceImg = document.createElement('img');
        faceImg.src = `portraits/${unit.face}`;
        faceImg.style.width = '48px';
        faceImg.style.height = '72px';
        faceImg.style.objectFit = 'cover';
        faceImg.style.borderRadius = '4px';
        faceImg.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
        faceImg.style.marginRight = '8px';

        faceImg.onerror = () => {
            console.error(`[UI] Face load failed for ${unit.name}: ${faceImg.src}`);
            faceImg.style.border = '2px solid red';
            faceImg.style.width = '46px';
            faceImg.style.height = '70px';
            faceImg.alt = '404';
        };

        return faceImg;
    }

    /**
     * 陣形コントロールを生成
     * @private
     */
    _createFormationControls(headquarters, units) {
        const game = this.game;

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
                    game.combatSystem.showFormation(headquarters, info.nameShort);
                    this.updateSelectionUI(game.selectedUnits);
                };
            }

            selector.appendChild(btn);
        });

        formationContainer.appendChild(toggleBtn);
        formationContainer.appendChild(selector);
        return formationContainer;
    }

    // ==================== Formation Panel (Legacy) ====================

    showFormationPanel(hqUnit, subordinates) {
        const panel = document.getElementById('formation-panel');
        const buttonsContainer = document.getElementById('formation-buttons');
        const tooltip = document.getElementById('formation-tooltip');

        panel.style.display = 'block';
        buttonsContainer.innerHTML = '';

        const availableFormations = getAvailableFormations(subordinates.length);
        const allFormations = [FORMATION_HOKO, FORMATION_KAKUYOKU, FORMATION_GYORIN];

        allFormations.forEach(formationType => {
            const info = FORMATION_INFO[formationType];
            const isAvailable = availableFormations.includes(formationType);
            const isActive = hqUnit.formation === formationType;

            const btn = document.createElement('button');
            btn.className = 'formation-btn';
            btn.textContent = info.nameShort;

            if (!isAvailable) btn.classList.add('disabled');
            if (isActive) btn.classList.add('active');

            btn.onmouseenter = () => { tooltip.textContent = info.description; };
            btn.onmouseleave = () => { tooltip.textContent = ''; };

            if (isAvailable) {
                btn.onclick = () => { this.setFormation(hqUnit, formationType); };
            }

            buttonsContainer.appendChild(btn);
        });
    }

    hideFormationPanel() {
        const panel = document.getElementById('formation-panel');
        panel.style.display = 'none';
    }

    setFormation(hqUnit, formation) {
        const game = this.game;
        hqUnit.formation = formation;
        const info = FORMATION_INFO[formation];

        game.combatSystem.showFormation(hqUnit, info.nameShort);

        const warlordUnits = game.unitManager.getUnitsByWarlordId(hqUnit.warlordId);
        const subordinates = warlordUnits.filter(u => !u.dead && u.unitType !== UNIT_TYPE_HEADQUARTERS);
        this.showFormationPanel(hqUnit, subordinates);
    }

    // ==================== Speed Control ====================

    setActionSpeed(speed) {
        const game = this.game;
        game.actionSpeed = speed;
        this.updateSpeedControlUI();
        console.log(`Action speed set to ${speed}x`);
    }

    updateSpeedControlUI() {
        const game = this.game;
        const buttons = document.querySelectorAll('.speed-btn');
        buttons.forEach(btn => {
            const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
            if (btnSpeed === game.actionSpeed) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    showSpeedControl(show) {
        const speedControl = document.getElementById('speed-control');
        if (speedControl) {
            speedControl.style.display = show ? 'flex' : 'none';
        }
    }
}
