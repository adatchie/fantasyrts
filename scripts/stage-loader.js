/**
 * SEKIGAHARA RTS - Stage Loader
 * ステージデータ（JSON）を読み込んでゲーム世界を構築する
 */

export class StageLoader {
    constructor(game) {
        this.game = game;
    }

    /**
     * ステージデータを読み込む
     * @param {Object} stageData - ステージJSONデータ
     */
    loadStage(stageData) {
        console.log("Loading Stage:", stageData.meta ? stageData.meta.name : "Unknown");

        // 1. マップ生成
        this.loadMap(stageData.map);

        // 2. 建物配置
        this.loadBuildings(stageData.buildings);

        // 3. ユニット配置
        this.loadUnits(stageData.units);

        console.log("Stage Loaded Successfully");
    }

    /**
     * マップ情報の読み込み・生成
     */
    loadMap(mapData) {
        if (!mapData) return;

        // シード値がある場合はそれを使用（MapSystemの実装依存）
        // 現状のMapSystemはランダム生成のみだが、シード対応が必要ならここで渡す
        // 今回は単純に再生成を呼ぶ
        const map = this.game.mapSystem.generateMap(mapData.seed);

        // 保存されたタイルデータがある場合は上書き（将来拡張）
        // if (mapData.tiles) { ... }
    }

    /**
     * 建物の配置
     */
    loadBuildings(buildingsData) {
        if (!buildingsData || !Array.isArray(buildingsData)) return;

        // 既存の建物をクリア
        this.game.buildingSystem.clearBuildings();

        buildingsData.forEach(b => {
            if (b.templateData) {
                // カスタムデータ（エディタで作成したものなど）
                this.game.buildingSystem.placeCustomBuildingAtGrid(
                    b.templateData,
                    b.gridX,
                    b.gridY,
                    b.rotation || 0
                );
            } else if (b.templateId) {
                // テンプレートID指定（未実装だが将来用）
                // this.game.buildingSystem.placeBuildingById(b.templateId, b.gridX, b.gridY, b.rotation);
            }
        });
    }

    /**
     * ユニットの配置
     */
    loadUnits(unitsData) {
        if (!unitsData || !Array.isArray(unitsData)) return;

        // 既存のユニットをクリア
        this.game.unitManager.clearUnits(); // UnitManagerにclearUnitsが必要

        unitsData.forEach(u => {
            // 武将IDからWARLORDSデータを検索
            // ※ global WARLORDS定数へのアクセスが必要
            // ここでは簡易実装としてconsole.logのみ
            console.log(`Deploying Warlord ${u.warlordId} at (${u.gridX}, ${u.gridY})`);

            // 実際の実装:
            // const warlord = WARLORDS[u.warlordId];
            // this.game.unitManager.createUnitsFromWarlordAt(warlord, u.gridX, u.gridY, ...)
        });
    }
}
