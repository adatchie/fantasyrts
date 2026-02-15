/**
 * SEKIGAHARA RTS - Building Placement Controller
 * 建物配置モード管理モジュール
 *
 * main.jsのGameクラスから建物配置関連ロジックを分離。
 */

export class BuildingPlacementController {
    /**
     * @param {Object} game - Gameインスタンス
     */
    constructor(game) {
        this.game = game;
    }

    /**
     * 建物配置モードを開始
     * @param {Object} buildingData - 建物データ
     */
    enterPlacementMode(buildingData) {
        const game = this.game;

        if (game.buildingEditor && game.buildingEditor.isActive) {
            game.buildingEditor.exit();
        }

        console.log("Entering Placement Mode", buildingData);
        game.gameState = 'PLACEMENT';
        game.placementData = buildingData;

        // ゴースト生成
        if (game.placementGhost) {
            game.renderingEngine.scene.remove(game.placementGhost);
        }

        game.placementGhost = game.buildingSystem.createBuildingMesh({ name: "Ghost", ...buildingData }, 0, 0, 0);
        console.log("Ghost created:", game.placementGhost);

        if (game.placementGhost) {
            game.placementGhost.traverse(c => {
                if (c.isMesh) {
                    c.material = c.material.clone();
                    c.material.transparent = true;
                    c.material.opacity = 0.5;
                }
            });
            game.renderingEngine.scene.add(game.placementGhost);
        } else {
            console.error("Failed to create placement ghost!");
        }
    }

    /**
     * 建物配置モードをキャンセル
     */
    cancelPlacementMode() {
        const game = this.game;

        if (game.gameState !== 'PLACEMENT') return;

        game.gameState = 'ORDER';
        game.placementData = null;
        if (game.placementGhost) {
            game.renderingEngine.scene.remove(game.placementGhost);
            game.placementGhost = null;
        }
    }

    /**
     * マップデータをエクスポート
     */
    exportMapData() {
        const game = this.game;

        const buildings = game.buildingSystem.getPlacedBuildingsData();
        const data = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            buildings: buildings
        };
        const json = JSON.stringify(data, null, 2);
        console.log("=== EXPORTED MAP DATA ===");
        console.log(json);
        console.log("=========================");
        alert("マップデータをコンソールに出力しました。\\nF12キーを押してコンソールを開き、データをコピーしてください。");
    }

    /**
     * 配置ゴーストの位置を更新
     * @param {number} screenX - スクリーンX座標
     * @param {number} screenY - スクリーンY座標
     */
    updatePlacementGhost(screenX, screenY) {
        const game = this.game;

        if (!game.placementGhost || !game.renderingEngine) return;

        const h = game.renderingEngine.getHexFromScreenCoordinates(screenX, screenY);

        const intersects = game.renderingEngine.raycastToGround(screenX, screenY);
        if (intersects) {
            const p = intersects.point;
            game.placementGhost.position.set(p.x, p.y, p.z);
            game.currentPlacementPos = p;
            game.currentPlacementGrid = h;
        }
    }

    /**
     * 現在の位置に建物を配置
     */
    placeCurrentBuilding() {
        const game = this.game;

        if (!game.placementData || !game.currentPlacementPos) return;

        const p = game.currentPlacementPos;
        const gx = game.currentPlacementGrid ? game.currentPlacementGrid.q : 0;
        const gy = game.currentPlacementGrid ? game.currentPlacementGrid.r : 0;

        game.buildingSystem.placeCustomBuilding(game.placementData, p.x, p.z, p.y, gx, gy);

        this.cancelPlacementMode();
    }
}
