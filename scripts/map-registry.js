import { TUTORIAL_PLAIN_DATA } from './data/maps/tutorial_plain.js';

/**
 * プロジェクトに含まれる全マップデータを管理するレジストリ
 * 新しいマップを追加した場合は、ここにimport文と配列への追加を行ってください。
 */
export const MAP_REGISTRY = [
    TUTORIAL_PLAIN_DATA
];

export class MapRegistry {
    static getAvailableMaps() {
        return MAP_REGISTRY;
    }

    static getMapById(id) {
        return MAP_REGISTRY.find(m => m.id === id);
    }
}
