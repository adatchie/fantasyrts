/**
 * SEKIGAHARA RTS - Constants and Data
 * 定数、武将データ、セリフデータなど
 */

// ゲーム定数
export const HEX_SIZE = 14;
export const MAP_W = 70;
export const MAP_H = 70;

// カラー定数
export const C_EAST = '#88AAEE';
export const C_WEST = '#EE4444';
export const C_SEL_BOX = 'rgba(255, 255, 255, 0.2)';
export const C_SEL_BORDER = '#fff';

// ユニットタイプ定数
export const UNIT_TYPE_HEADQUARTERS = 'HEADQUARTERS'; // 本陣
export const UNIT_TYPE_NORMAL = 'NORMAL';             // 通常ユニット

// マルチユニットシステム定数
export const SOLDIERS_PER_UNIT = 1000; // 1ユニットあたりの標準兵力

// 性格タイプ
export const P_BRAVE = '勇猛';
export const P_LOYAL = '忠義';
export const P_COWARD = '臆病';
export const P_CALM = '沈着';

// セリフデータ
export const DIALOGUE = {
    [P_BRAVE]: {
        ATTACK: ["推して参る！", "蹴散らせ！", "我に続け！"],
        DAMAGED: ["ぬぅ！", "退くな！"],
        PLOT_DO: ["寝返れ！"],
        PLOT_REC: ["愚弄するか"],
        DYING: ["見事…！"]
    },
    [P_LOYAL]: {
        ATTACK: ["殿の為！", "参る！", "義は我にあり"],
        DAMAGED: ["持ち堪えよ！"],
        PLOT_DO: ["大義の為"],
        PLOT_REC: ["裏切らぬ"],
        DYING: ["無念…！"]
    },
    [P_COWARD]: {
        ATTACK: ["い、行け！", "囲め！"],
        DAMAGED: ["ひっ！", "来るな！"],
        PLOT_DO: ["うまい話だ"],
        PLOT_REC: ["話を聞こう"],
        DYING: ["助けて！"]
    },
    [P_CALM]: {
        ATTACK: ["好機だ", "掛かれ"],
        DAMAGED: ["想定内だ", "崩れるな"],
        PLOT_DO: ["時勢を見よ"],
        PLOT_REC: ["乗らぬ"],
        DYING: ["計算違いか"]
    }
};

// 武将データ
export const WARLORDS = [
    // --- 東軍 (徳川) ---
    { name: "徳川家康", side: 'EAST', soldiers: 30000, atk: 95, def: 99, jin: 99, loyalty: 100, q: 55, r: 35, size: 2, p: P_CALM, kamon: 'MITSUBA_AOI', bg: '#d4af37' },
    { name: "本多忠勝", side: 'EAST', soldiers: 500, atk: 99, def: 90, jin: 80, loyalty: 100, q: 53, r: 34, size: 1, p: P_BRAVE, kamon: 'MARUNI_TACHIAOI', bg: '#111' },
    { name: "井伊直政", side: 'EAST', soldiers: 3600, atk: 92, def: 85, jin: 85, loyalty: 100, q: 45, r: 30, size: 1, p: P_BRAVE, kamon: 'TACHIBANA', bg: '#cc0000' }, // 赤備え
    { name: "松平忠吉", side: 'EAST', soldiers: 3000, atk: 80, def: 80, jin: 75, loyalty: 100, q: 44, r: 31, size: 1, p: P_LOYAL, kamon: 'MITSUBA_AOI', bg: '#444' },

    // 豊臣恩顧の東軍
    { name: "福島正則", side: 'EAST', soldiers: 6000, atk: 90, def: 80, jin: 70, loyalty: 75, q: 35, r: 25, size: 1, p: P_BRAVE, kamon: 'OMODAKA', bg: '#222' },
    { name: "黒田長政", side: 'EAST', soldiers: 5400, atk: 88, def: 85, jin: 85, loyalty: 82, q: 38, r: 22, size: 1, p: P_CALM, kamon: 'FUJIDOMOE', bg: '#333' },
    { name: "細川忠興", side: 'EAST', soldiers: 5000, atk: 85, def: 80, jin: 80, loyalty: 78, q: 40, r: 20, size: 1, p: P_LOYAL, kamon: 'KUYO', bg: '#333' },
    { name: "加藤嘉明", side: 'EAST', soldiers: 3000, atk: 82, def: 80, jin: 75, loyalty: 75, q: 36, r: 23, size: 1, p: P_BRAVE, kamon: 'SAGARI_FUJI', bg: '#444' },
    { name: "田中吉政", side: 'EAST', soldiers: 3000, atk: 80, def: 80, jin: 75, loyalty: 85, q: 32, r: 28, size: 1, p: P_LOYAL, kamon: 'KUGINUKI', bg: '#444' },
    { name: "藤堂高虎", side: 'EAST', soldiers: 2490, atk: 85, def: 85, jin: 85, loyalty: 88, q: 30, r: 30, size: 1, p: P_CALM, kamon: 'TSUTA', bg: '#555' },
    { name: "京極高知", side: 'EAST', soldiers: 3000, atk: 78, def: 75, jin: 70, loyalty: 85, q: 28, r: 32, size: 1, p: P_LOYAL, kamon: 'FOUR_DIAMONDS', bg: '#666' },
    { name: "寺沢広高", side: 'EAST', soldiers: 2400, atk: 75, def: 75, jin: 70, loyalty: 80, q: 26, r: 34, size: 1, p: P_CALM, kamon: 'KANI', bg: '#666' },
    { name: "筒井定次", side: 'EAST', soldiers: 2850, atk: 75, def: 75, jin: 70, loyalty: 80, q: 34, r: 26, size: 1, p: P_CALM, kamon: 'UMEBACHI', bg: '#666' },
    { name: "生駒一正", side: 'EAST', soldiers: 1830, atk: 75, def: 70, jin: 65, loyalty: 80, q: 24, r: 36, size: 1, p: P_LOYAL, kamon: 'GENJI_GURUMA', bg: '#666' },
    { name: "金森長近", side: 'EAST', soldiers: 1140, atk: 70, def: 70, jin: 60, loyalty: 85, q: 22, r: 38, size: 1, p: P_LOYAL, kamon: 'UMEBACHI', bg: '#666' },
    { name: "古田重勝", side: 'EAST', soldiers: 1200, atk: 70, def: 70, jin: 60, loyalty: 80, q: 20, r: 40, size: 1, p: P_CALM, kamon: 'MARUNI_FUTATSUHIKI', bg: '#666' },
    { name: "織田長益", side: 'EAST', soldiers: 450, atk: 60, def: 60, jin: 50, loyalty: 70, q: 18, r: 42, size: 1, p: P_COWARD, kamon: 'ODA_MOKKO', bg: '#888' },
    { name: "本多忠政", side: 'EAST', soldiers: 1000, atk: 80, def: 80, jin: 75, loyalty: 100, q: 52, r: 36, size: 1, p: P_LOYAL, kamon: 'MARUNI_TACHIAOI', bg: '#222' },
    { name: "榊原康政", side: 'EAST', soldiers: 1000, atk: 85, def: 85, jin: 80, loyalty: 100, q: 54, r: 33, size: 1, p: P_CALM, kamon: 'GENJI_GURUMA', bg: '#222' },
    { name: "大久保忠隣", side: 'EAST', soldiers: 1000, atk: 80, def: 80, jin: 75, loyalty: 100, q: 56, r: 37, size: 1, p: P_LOYAL, kamon: 'SAGARI_FUJI', bg: '#222' },
    { name: "酒井家次", side: 'EAST', soldiers: 1000, atk: 75, def: 75, jin: 70, loyalty: 100, q: 50, r: 38, size: 1, p: P_LOYAL, kamon: 'KATABAMI', bg: '#222' },

    // --- 西軍 (石田) ---
    { name: "石田三成", side: 'WEST', soldiers: 6900, atk: 80, def: 85, jin: 95, loyalty: 100, q: 10, r: 15, size: 2, p: P_LOYAL, kamon: 'DAIICHI', bg: '#4a0080' },
    { name: "島左近", side: 'WEST', soldiers: 1000, atk: 95, def: 90, jin: 85, loyalty: 100, q: 12, r: 16, size: 1, p: P_BRAVE, kamon: 'MITSU_GASHIWA', bg: '#8b0000' }, // 鬼左近の赤
    { name: "蒲生郷舎", side: 'WEST', soldiers: 800, atk: 80, def: 80, jin: 80, loyalty: 100, q: 11, r: 14, size: 1, p: P_LOYAL, kamon: 'MUKAI_TSURU', bg: '#444' },
    { name: "島津義弘", side: 'WEST', soldiers: 1500, atk: 98, def: 95, jin: 90, loyalty: 100, q: 15, r: 20, size: 1, p: P_BRAVE, kamon: 'MARUNI_JUJI', bg: '#222' },
    { name: "島津豊久", side: 'WEST', soldiers: 500, atk: 90, def: 85, jin: 80, loyalty: 100, q: 16, r: 21, size: 1, p: P_BRAVE, kamon: 'MARUNI_JUJI', bg: '#222' },
    { name: "小西行長", side: 'WEST', soldiers: 4000, atk: 80, def: 85, jin: 75, loyalty: 100, q: 18, r: 25, size: 1, p: P_CALM, kamon: 'GION_MAMORI', bg: '#333' },
    { name: "宇喜多秀家", side: 'WEST', soldiers: 17000, atk: 85, def: 85, jin: 80, loyalty: 100, q: 22, r: 28, size: 2, p: P_BRAVE, kamon: 'JI', bg: '#222' },
    { name: "明石全登", side: 'WEST', soldiers: 2000, atk: 88, def: 80, jin: 75, loyalty: 100, q: 24, r: 29, size: 1, p: P_BRAVE, kamon: 'JI', bg: '#444' },
    { name: "大谷吉継", side: 'WEST', soldiers: 600, atk: 90, def: 90, jin: 95, loyalty: 100, q: 20, r: 35, size: 1, p: P_CALM, kamon: 'MUKAI_CHO', bg: '#fff' }, // 白頭巾
    { name: "大谷吉治", side: 'WEST', soldiers: 1000, atk: 75, def: 75, jin: 70, loyalty: 100, q: 19, r: 36, size: 1, p: P_LOYAL, kamon: 'MUKAI_CHO', bg: '#ccc' },
    { name: "戸田重政", side: 'WEST', soldiers: 1500, atk: 70, def: 70, jin: 60, loyalty: 100, q: 21, r: 34, size: 1, p: P_LOYAL, kamon: 'MUTSUBOSHI', bg: '#555' },
    { name: "平塚為広", side: 'WEST', soldiers: 360, atk: 75, def: 70, jin: 60, loyalty: 100, q: 20, r: 37, size: 1, p: P_BRAVE, kamon: 'MITSU_UROKO', bg: '#555' },
    { name: "脇坂安治", side: 'WEST', soldiers: 990, atk: 70, def: 70, jin: 50, loyalty: 60, q: 15, r: 40, size: 1, p: P_COWARD, kamon: 'WA_CHIGAI', bg: '#666' },
    { name: "朽木元綱", side: 'WEST', soldiers: 600, atk: 65, def: 65, jin: 50, loyalty: 60, q: 16, r: 41, size: 1, p: P_COWARD, kamon: 'FOUR_DIAMONDS', bg: '#666' },
    { name: "小川祐忠", side: 'WEST', soldiers: 2100, atk: 70, def: 70, jin: 50, loyalty: 60, q: 14, r: 39, size: 1, p: P_COWARD, kamon: 'MARUNI_DAKIGASHIWA', bg: '#666' },
    { name: "赤座直保", side: 'WEST', soldiers: 600, atk: 65, def: 65, jin: 50, loyalty: 60, q: 13, r: 42, size: 1, p: P_COWARD, kamon: 'MARUNI_MITSUMEBISHI', bg: '#666' },

    // --- 不確定勢力（松尾山）---
    { name: "小早川秀秋", side: 'WEST', soldiers: 15600, atk: 85, def: 80, jin: 70, loyalty: 40, q: 5, r: 50, size: 2, p: P_COWARD, kamon: 'CHIGAI_GAMA', bg: '#a52a2a' },
    { name: "稲葉正成", side: 'WEST', soldiers: 1000, atk: 75, def: 75, jin: 60, loyalty: 50, q: 6, r: 51, size: 1, p: P_CALM, kamon: 'OSHIKI_NI_SAN', bg: '#888' },

    // --- 不確定勢力（南宮山）---
    { name: "毛利秀元", side: 'WEST', soldiers: 16000, atk: 85, def: 90, jin: 80, loyalty: 70, q: 50, r: 50, size: 2, p: P_CALM, kamon: 'MITSUBOSHI', bg: '#222' },
    { name: "吉川広家", side: 'WEST', soldiers: 3000, atk: 80, def: 85, jin: 85, loyalty: 20, q: 48, r: 48, size: 1, p: P_CALM, kamon: 'MITSUBOSHI', bg: '#333' },
    { name: "安国寺恵瓊", side: 'WEST', soldiers: 1800, atk: 70, def: 70, jin: 75, loyalty: 90, q: 52, r: 48, size: 1, p: P_CALM, kamon: 'TAKEDA_BISHI', bg: '#555' },
    { name: "長宗我部盛親", side: 'WEST', soldiers: 6600, atk: 88, def: 85, jin: 80, loyalty: 80, q: 55, r: 45, size: 1, p: P_BRAVE, kamon: 'KATABAMI', bg: '#333' },
    { name: "長束正家", side: 'WEST', soldiers: 1500, atk: 75, def: 75, jin: 70, loyalty: 90, q: 53, r: 46, size: 1, p: P_LOYAL, kamon: 'HANABISHI', bg: '#444' }
];
