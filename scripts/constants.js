/**
 * SEKIGAHARA RTS - Constants and Data
 * 定数、武将データ、セリフデータなど
 */

// ゲーム定数 - スクエアグリッド（クォータービュー）
export const TILE_SIZE = 32;        // タイルの基本サイズ（ピクセル）
export const TILE_HEIGHT = 16;      // 1段あたりの高さ（ピクセル）
export const MAX_HEIGHT = 8;        // 地形の最大高さ段数
export const MAP_W = 70;            // マップ幅（タイル数）
export const MAP_H = 70;            // マップ高さ（タイル数）

// 後方互換性のためHEX_SIZEも維持（段階的移行用）
export const HEX_SIZE = TILE_SIZE;

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

// 陣形定数
export const FORMATION_HOKO = 'HOKO';         // 鋒矢の陣（攻撃的・本陣前方）
export const FORMATION_KAKUYOKU = 'KAKUYOKU'; // 鶴翼の陣（バランス型・本陣中央）
export const FORMATION_GYORIN = 'GYORIN';     // 魚鱗の陣（防御的・本陣後方）

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
    // --- 東軍 (徳川) ---
    { name: "徳川家康", side: 'EAST', soldiers: 30000, atk: 95, def: 99, jin: 99, loyalty: 100, x: 60, y: 35, size: 2, p: P_CALM, kamon: 'MITSUBA_AOI', bg: '#d4af37', face: 'tokugawa_iyeyasu.png' },
    { name: "本多忠勝", side: 'EAST', soldiers: 500, atk: 99, def: 90, jin: 80, loyalty: 100, x: 45, y: 35, size: 1, p: P_BRAVE, kamon: 'MARUNI_TACHIAOI', bg: '#111', face: 'honda_tadakatsu.png' },
    { name: "井伊直政", side: 'EAST', soldiers: 3600, atk: 92, def: 85, jin: 85, loyalty: 100, x: 35, y: 33, size: 1, p: P_BRAVE, kamon: 'TACHIBANA', bg: '#cc0000', face: 'ii_naomasa.png' }, // 赤備え
    { name: "松平忠吉", side: 'EAST', soldiers: 3000, atk: 80, def: 80, jin: 75, loyalty: 100, x: 36, y: 34, size: 1, p: P_LOYAL, kamon: 'MITSUBA_AOI', bg: '#444', face: 'matsudaira_tadayoshi.png' },

    // 豊臣恩顧の東軍
    { name: "福島正則", side: 'EAST', soldiers: 6000, atk: 90, def: 80, jin: 70, loyalty: 75, x: 32, y: 30, size: 1, p: P_BRAVE, kamon: 'OMODAKA', bg: '#222', face: 'fukushima_masanori.png' },
    { name: "黒田長政", side: 'EAST', soldiers: 5400, atk: 88, def: 85, jin: 85, loyalty: 82, x: 38, y: 15, size: 1, p: P_CALM, kamon: 'FUJIDOMOE', bg: '#333', face: 'kuroda_nagamasa.png' },
    { name: "細川忠興", side: 'EAST', soldiers: 5000, atk: 85, def: 80, jin: 80, loyalty: 78, x: 40, y: 16, size: 1, p: P_LOYAL, kamon: 'KUYO', bg: '#333', face: 'hosokawa_tadaoki.png' },
    { name: "加藤嘉明", side: 'EAST', soldiers: 3000, atk: 82, def: 80, jin: 75, loyalty: 75, x: 38, y: 20, size: 1, p: P_BRAVE, kamon: 'SAGARI_FUJI', bg: '#444', face: 'kato_yoshiaki.png' },
    { name: "田中吉政", side: 'EAST', soldiers: 3000, atk: 80, def: 80, jin: 75, loyalty: 85, x: 35, y: 22, size: 1, p: P_LOYAL, kamon: 'KUGINUKI', bg: '#444', face: 'tanaka_yoshimasa.png' },
    { name: "藤堂高虎", side: 'EAST', soldiers: 2490, atk: 85, def: 85, jin: 85, loyalty: 88, x: 33, y: 38, size: 1, p: P_CALM, kamon: 'TSUTA', bg: '#555', face: 'todo_takatora.png' },
    { name: "京極高知", side: 'EAST', soldiers: 3000, atk: 78, def: 75, jin: 70, loyalty: 85, x: 34, y: 39, size: 1, p: P_LOYAL, kamon: 'FOUR_DIAMONDS', bg: '#666', face: 'kyogoku_takatomo.png' },
    { name: "寺沢広高", side: 'EAST', soldiers: 2400, atk: 75, def: 75, jin: 70, loyalty: 80, x: 38, y: 35, size: 1, p: P_CALM, kamon: 'KANI', bg: '#666', face: 'terasawa_hirotaka.png' },
    { name: "筒井定次", side: 'EAST', soldiers: 2850, atk: 75, def: 75, jin: 70, loyalty: 80, x: 40, y: 30, size: 1, p: P_CALM, kamon: 'UMEBACHI', bg: '#666', face: 'tsutsui_sadatsugu.png' },
    { name: "生駒一正", side: 'EAST', soldiers: 1830, atk: 75, def: 70, jin: 65, loyalty: 80, x: 42, y: 25, size: 1, p: P_LOYAL, kamon: 'GENJI_GURUMA', bg: '#666', face: 'ikoma_kazumasa.png' },
    { name: "金森長近", side: 'EAST', soldiers: 1140, atk: 70, def: 70, jin: 60, loyalty: 85, x: 45, y: 20, size: 1, p: P_LOYAL, kamon: 'UMEBACHI', bg: '#666', face: 'kanamori_nagachika.png' },
    { name: "古田重然", side: 'EAST', soldiers: 1200, atk: 70, def: 70, jin: 60, loyalty: 80, x: 48, y: 25, size: 1, p: P_CALM, kamon: 'MARUNI_FUTATSUHIKI', bg: '#666', face: 'furuta_shigenari.png' },
    { name: "織田長益", side: 'EAST', soldiers: 450, atk: 60, def: 60, jin: 50, loyalty: 70, x: 45, y: 30, size: 1, p: P_COWARD, kamon: 'ODA_MOKKO', bg: '#888', face: 'oda_nagamasu.png' },
    { name: "堀尾忠氏", side: 'EAST', soldiers: 1000, atk: 80, def: 80, jin: 75, loyalty: 100, x: 50, y: 32, size: 1, p: P_LOYAL, kamon: 'KUGINUKI', bg: '#222', face: 'horio_tadauji.png' },
    { name: "山内一豊", side: 'EAST', soldiers: 2050, atk: 75, def: 75, jin: 75, loyalty: 95, x: 54, y: 40, size: 1, p: P_LOYAL, kamon: 'MITSU_GASHIWA', bg: '#222', face: 'yamanouchi_kazutoyo.png' },
    { name: "池田輝政", side: 'EAST', soldiers: 4560, atk: 85, def: 85, jin: 85, loyalty: 90, x: 52, y: 38, size: 1, p: P_BRAVE, kamon: 'IKEDA_CHO', bg: '#222', face: 'ikeda_terumasa.png' },
    { name: "戸川達安", side: 'EAST', soldiers: 1000, atk: 75, def: 75, jin: 70, loyalty: 100, x: 50, y: 37, size: 1, p: P_BRAVE, kamon: 'MARUNI_MITSUBONSUGI', bg: '#222', face: 'togawa_michiyasu.png' },

    // --- 西軍 (石田) ---
    { name: "石田三成", side: 'WEST', soldiers: 6900, atk: 80, def: 85, jin: 95, loyalty: 100, x: 8, y: 12, size: 2, p: P_LOYAL, kamon: 'DAIICHI', bg: '#4a0080', face: 'ishida_mitsunari.png' },
    { name: "島左近", side: 'WEST', soldiers: 1000, atk: 95, def: 90, jin: 85, loyalty: 100, x: 10, y: 14, size: 1, p: P_BRAVE, kamon: 'MITSU_GASHIWA', bg: '#8b0000', face: 'shima_sakon.png' }, // 鬼左近の赤
    { name: "蒲生郷舎", side: 'WEST', soldiers: 800, atk: 80, def: 80, jin: 80, loyalty: 100, x: 9, y: 13, size: 1, p: P_LOYAL, kamon: 'MUKAI_TSURU', bg: '#444', face: 'gamo_satoie.png' },
    { name: "島津義弘", side: 'WEST', soldiers: 1500, atk: 98, def: 95, jin: 90, loyalty: 100, x: 12, y: 18, size: 1, p: P_BRAVE, kamon: 'MARUNI_JUJI', bg: '#222', face: 'shimazu_yoshihiro.png' },
    { name: "島津豊久", side: 'WEST', soldiers: 500, atk: 90, def: 85, jin: 80, loyalty: 100, x: 13, y: 19, size: 1, p: P_BRAVE, kamon: 'MARUNI_JUJI', bg: '#222', face: 'shimazu_toyohisa.png' },
    { name: "小西行長", side: 'WEST', soldiers: 4000, atk: 80, def: 85, jin: 75, loyalty: 100, x: 15, y: 25, size: 1, p: P_CALM, kamon: 'GION_MAMORI', bg: '#333', face: 'konishi_yukinaga.png' },
    { name: "宇喜多秀家", side: 'WEST', soldiers: 17000, atk: 85, def: 85, jin: 80, loyalty: 100, x: 18, y: 30, size: 2, p: P_BRAVE, kamon: 'JI', bg: '#222', face: 'ukita_hideie.png' },
    { name: "明石全登", side: 'WEST', soldiers: 2000, atk: 88, def: 80, jin: 75, loyalty: 100, x: 20, y: 31, size: 1, p: P_BRAVE, kamon: 'JI', bg: '#444', face: 'akashi_teruzumi.png' },
    { name: "大谷吉継", side: 'WEST', soldiers: 600, atk: 90, def: 90, jin: 95, loyalty: 100, x: 15, y: 40, size: 1, p: P_CALM, kamon: 'MUKAI_CHO', bg: '#fff', face: 'otani_yoshitsugu.png' }, // 白頭巾
    { name: "大谷吉治", side: 'WEST', soldiers: 1000, atk: 75, def: 75, jin: 70, loyalty: 100, x: 16, y: 41, size: 1, p: P_LOYAL, kamon: 'MUKAI_CHO', bg: '#ccc', face: 'ootani_yoshiharu.png' },
    { name: "戸田重政", side: 'WEST', soldiers: 1500, atk: 70, def: 70, jin: 60, loyalty: 100, x: 18, y: 39, size: 1, p: P_LOYAL, kamon: 'MUTSUBOSHI', bg: '#555', face: 'toda_shigemasa.png' },
    { name: "平塚為広", side: 'WEST', soldiers: 360, atk: 75, def: 70, jin: 60, loyalty: 100, x: 17, y: 42, size: 1, p: P_BRAVE, kamon: 'MITSU_UROKO', bg: '#555', face: 'hiratsuka_tamehiro.png' },
    { name: "脇坂安治", side: 'WEST', soldiers: 990, atk: 70, def: 70, jin: 50, loyalty: 60, x: 12, y: 48, size: 1, p: P_COWARD, kamon: 'WA_CHIGAI', bg: '#666', face: 'wakisaka_yasuharu.png' },
    { name: "朽木元綱", side: 'WEST', soldiers: 600, atk: 65, def: 65, jin: 50, loyalty: 60, x: 13, y: 49, size: 1, p: P_COWARD, kamon: 'FOUR_DIAMONDS', bg: '#666', face: 'kuchiki_mototsuna.png' },
    { name: "小川祐忠", side: 'WEST', soldiers: 2100, atk: 70, def: 70, jin: 50, loyalty: 60, x: 11, y: 47, size: 1, p: P_COWARD, kamon: 'MARUNI_DAKIGASHIWA', bg: '#666', face: 'ogawa_suketada.png' },
    { name: "赤座直保", side: 'WEST', soldiers: 600, atk: 65, def: 65, jin: 50, loyalty: 60, x: 10, y: 50, size: 1, p: P_COWARD, kamon: 'MARUNI_MITSUMEBISHI', bg: '#666', face: 'akaza_naoyasu.png' },

    // --- 不確定勢力（松尾山）---
    { name: "小早川秀秋", side: 'WEST', soldiers: 15600, atk: 85, def: 80, jin: 70, loyalty: 40, x: 5, y: 60, size: 2, p: P_COWARD, kamon: 'CHIGAI_GAMA', bg: '#a52a2a', face: 'kobayakawa_hideaki.png' },
    { name: "稲葉正成", side: 'WEST', soldiers: 1000, atk: 75, def: 75, jin: 60, loyalty: 50, x: 6, y: 61, size: 1, p: P_CALM, kamon: 'OSHIKI_NI_SAN', bg: '#888', face: 'inaba_masashige.png' },

    // --- 不確定勢力（南宮山）---
    { name: "毛利秀元", side: 'WEST', soldiers: 16000, atk: 85, def: 90, jin: 80, loyalty: 70, x: 60, y: 60, size: 2, p: P_CALM, kamon: 'MITSUBOSHI', bg: '#222', face: 'mouri_hidemoto.png' },
    { name: "吉川広家", side: 'WEST', soldiers: 3000, atk: 80, def: 85, jin: 85, loyalty: 20, x: 58, y: 58, size: 1, p: P_CALM, kamon: 'MITSUBOSHI', bg: '#333', face: 'kikkawa_hiroie.png' },
    { name: "安国寺恵瓊", side: 'WEST', soldiers: 1800, atk: 70, def: 70, jin: 75, loyalty: 90, x: 62, y: 58, size: 1, p: P_CALM, kamon: 'TAKEDA_BISHI', bg: '#555', face: 'ankokuji_ekei.png' },
    { name: "長宗我部盛親", side: 'WEST', soldiers: 6600, atk: 88, def: 85, jin: 80, loyalty: 80, x: 65, y: 55, size: 1, p: P_BRAVE, kamon: 'KATABAMI', bg: '#333', face: 'chosokabe_nobuchika.png' },
    { name: "長束正家", side: 'WEST', soldiers: 1500, atk: 75, def: 75, jin: 70, loyalty: 90, x: 63, y: 56, size: 1, p: P_LOYAL, kamon: 'HANABISHI', bg: '#444', face: 'nagatsuka_masaie.png' }
];
