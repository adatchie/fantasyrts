/**
 * Fantasy RTS - Map Registry
 * プロジェクトに含まれる全マップデータをJSON読み込みで管理するレジストリ。
 * 新しいマップを追加する場合は MAP_JSON_PATHS に1行追加するだけでOK。
 */

// 読み込むJSONファイルのパス一覧（scripts/ からの相対パス）
const MAP_JSON_PATHS = [
    './scripts/data/maps/map_sample_tutorial.json',
    './scripts/data/maps/map_sample_castle.json',
    './scripts/data/maps/map_sample_mountain.json',
];

// 読み込み済みマップデータを格納する配列
export let MAP_REGISTRY = [];

export class MapRegistry {
    /**
     * 全JSONマップファイルを非同期に読み込み、MAP_REGISTRYを構築する
     * @returns {Promise<Object[]>} 読み込まれたマップデータの配列
     */
    static async loadAll() {
        const results = [];

        for (const path of MAP_JSON_PATHS) {
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    console.warn(`[MapRegistry] Failed to fetch ${path}: ${response.status}`);
                    continue;
                }
                const data = await response.json();
                results.push(data);
                console.log(`[MapRegistry] Loaded: ${data.name || data.id} from ${path}`);
            } catch (e) {
                console.error(`[MapRegistry] Error loading ${path}:`, e);
            }
        }

        MAP_REGISTRY = results;
        console.log(`[MapRegistry] Total maps loaded: ${MAP_REGISTRY.length}`);
        return MAP_REGISTRY;
    }

    static getAvailableMaps() {
        return MAP_REGISTRY;
    }

    static getMapById(id) {
        return MAP_REGISTRY.find(m => m.id === id);
    }
}
