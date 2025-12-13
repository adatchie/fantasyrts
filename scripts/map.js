/**
 * SEKIGAHARA RTS - Map System (Enhanced)
 * マップ生成と描画（高精細化、等高線、グラデーション）
 */

import { MAP_W, MAP_H } from './constants.js';

export class MapSystem {
    constructor() {
        this.map = [];
        this.generateMap();
    }

    generateMap() {
        this.map = [];
        for (let r = 0; r < MAP_H; r++) {
            let row = [];
            for (let q = 0; q < MAP_W; q++) {
                let h = 0;
                let type = 'PLAIN';

                // 松尾山エリア
                if (Math.hypot(q - 5, r - 50) < 8) {
                    h = 4 + Math.random() * 5;
                }
                // 南宮山エリア
                else if (Math.hypot(q - 50, r - 50) < 8) {
                    h = 4 + Math.random() * 5;
                }
                // 伊吹山エリア
                else if (q < 10 && r < 20) {
                    h = 6 + Math.random() * 4;
                }

                if (h > 4) type = 'MTN';
                if (Math.abs(q - r) < 2 && h < 3) {
                    type = 'RIVER';
                    h = -1;
                }

                row.push({ q, r, h, type });
            }
            this.map.push(row);
        }
        return this.map;
    }

    getMap() {
        return this.map;
    }

    getTile(q, r) {
        if (q < 0 || q >= MAP_W || r < 0 || r >= MAP_H) return null;
        return this.map[r][q];
    }

    /**
     * 3Dハイトマップの解析結果に基づいて地形データを更新
     * @param {number} q - HEX Q座標
     * @param {number} r - HEX R座標
     * @param {number} heightVal - ハイトマップの輝度値 (0-255)
     */
    updateTerrain(q, r, heightVal) {
        if (q < 0 || q >= MAP_W || r < 0 || r >= MAP_H) return;
        const tile = this.map[r][q];

        // ハイトマップの輝度値に基づいて地形タイプを決定
        // 黒(0)に近いほど低地、白(255)に近いほど高地

        // 閾値を調整して3段階に分類
        // 0-80: 平地 (PLAIN, h=0)
        // 81-160: 丘陵/麓 (HILL, h=1) -> 移動コスト高、高所ボーナスあり
        // 161-255: 山岳 (MTN, h=2) -> 侵入不可

        if (heightVal > 160) {
            tile.type = 'MTN';
            tile.h = 2;
        } else if (heightVal > 80) {
            tile.type = 'HILL';
            tile.h = 1;
        } else {
            // 平地
            tile.type = 'PLAIN';
            tile.h = 0;
        }
    }
}
