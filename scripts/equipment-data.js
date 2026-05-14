/**
 * Fantasy RTS - Equipment Data
 * 装備品マスタとアイコンアトラス定義
 */

export const ITEM_ICON_ATLAS = {
    path: 'sprites/item/item_icon.png',
    columns: 10,
    rows: 10
};

export const EQUIPMENT_SLOTS = {
    head: { id: 'head', name: '頭装備' },
    body: { id: 'body', name: '体装備' },
    weapon: { id: 'weapon', name: '武器' },
    shield: { id: 'shield', name: '盾' }
};

export const EQUIPMENT_STAT_KEYS = ['ATK', 'DEF', 'AGI', 'VIT', 'INT', 'MND', 'LUK'];

export const EQUIPMENT_ITEMS = [
    {
        id: 'leather_cap',
        slot: 'head',
        name: '旅人のフード',
        price: 80,
        icon: { col: 0, row: 7 },
        stats: { DEF: 2, AGI: 1 },
        description: '軽く動きやすい頭装備。'
    },
    {
        id: 'iron_helm',
        slot: 'head',
        name: '鉄兜',
        price: 140,
        icon: { col: 1, row: 7 },
        stats: { DEF: 4, VIT: 2 },
        description: '前線指揮官向けの堅実な兜。'
    },
    {
        id: 'crusader_helm',
        slot: 'head',
        name: '十字軍の兜',
        price: 260,
        icon: { col: 2, row: 7 },
        stats: { DEF: 6, MND: 2, AGI: -1 },
        description: '信念を守りに変える重兜。'
    },
    {
        id: 'wizard_hat',
        slot: 'head',
        name: '青の魔導帽',
        price: 220,
        icon: { col: 5, row: 7 },
        stats: { INT: 5, MND: 2 },
        description: '魔力の集中を助ける帽子。'
    },
    {
        id: 'royal_crown',
        slot: 'head',
        name: '王冠',
        price: 520,
        icon: { col: 9, row: 7 },
        stats: { MND: 6, LUK: 4, DEF: 2 },
        description: '軍勢を鼓舞する王者の冠。'
    },
    {
        id: 'leather_cuirass',
        slot: 'body',
        name: '革の胸当て',
        price: 120,
        icon: { col: 5, row: 1 },
        stats: { DEF: 3, AGI: 1 },
        description: '取り回しの良い軽鎧。'
    },
    {
        id: 'chain_mail',
        slot: 'body',
        name: '鎖帷子',
        price: 220,
        icon: { col: 6, row: 1 },
        stats: { DEF: 6, VIT: 2, AGI: -1 },
        description: '斬撃に強い標準的な鎧。'
    },
    {
        id: 'scale_armor',
        slot: 'body',
        name: '鱗鎧',
        price: 340,
        icon: { col: 7, row: 1 },
        stats: { DEF: 8, VIT: 3 },
        description: '防御と機動の均衡に優れる鎧。'
    },
    {
        id: 'silver_plate',
        slot: 'body',
        name: '白銀の甲冑',
        price: 520,
        icon: { col: 8, row: 1 },
        stats: { DEF: 12, VIT: 5, AGI: -2 },
        description: '重いが極めて頑丈な全身鎧。'
    },
    {
        id: 'obsidian_armor',
        slot: 'body',
        name: '黒曜騎士鎧',
        price: 720,
        icon: { col: 9, row: 1 },
        stats: { DEF: 14, ATK: 3, MND: 2, AGI: -3 },
        description: '攻め気を帯びた黒い重甲。'
    },
    {
        id: 'iron_sword',
        slot: 'weapon',
        name: '騎士剣',
        price: 120,
        icon: { col: 0, row: 0 },
        stats: { ATK: 5 },
        weapon: { scale: 1.35, pivot: { x: 0.50, y: 0.92 } },
        description: '癖のない標準的な片手剣。'
    },
    {
        id: 'long_sword',
        slot: 'weapon',
        name: 'ロングソード',
        price: 240,
        icon: { col: 1, row: 0 },
        stats: { ATK: 8, AGI: -1 },
        weapon: { scale: 1.45, pivot: { x: 0.50, y: 0.94 } },
        description: '威力を重視した長剣。'
    },
    {
        id: 'royal_saber',
        slot: 'weapon',
        name: '王国のサーベル',
        price: 360,
        icon: { col: 4, row: 0 },
        stats: { ATK: 7, AGI: 3, LUK: 1 },
        weapon: { scale: 1.40, pivot: { x: 0.48, y: 0.90 } },
        description: '素早い切り返しに向く曲刀。'
    },
    {
        id: 'black_blade',
        slot: 'weapon',
        name: '黒鋼の剣',
        price: 520,
        icon: { col: 6, row: 0 },
        stats: { ATK: 13, DEF: -2, LUK: 2 },
        weapon: { scale: 1.42, pivot: { x: 0.50, y: 0.92 } },
        description: '防御を捨てて斬撃力を高める剣。'
    },
    {
        id: 'battle_axe',
        slot: 'weapon',
        name: '戦斧',
        price: 480,
        icon: { col: 9, row: 2 },
        stats: { ATK: 15, AGI: -3 },
        weapon: { scale: 1.55, pivot: { x: 0.52, y: 0.88 } },
        description: '重い一撃で敵陣を崩す斧。'
    },
    {
        id: 'crystal_staff',
        slot: 'weapon',
        name: '蒼晶の杖',
        price: 460,
        icon: { col: 5, row: 3 },
        stats: { INT: 9, MND: 3 },
        weapon: { scale: 1.50, pivot: { x: 0.50, y: 0.90 } },
        description: '魔力を導く青い宝珠の杖。'
    },
    {
        id: 'hunter_bow',
        slot: 'weapon',
        name: '狩人の弓',
        price: 300,
        icon: { col: 1, row: 2 },
        stats: { ATK: 6, AGI: 3 },
        weapon: { scale: 1.35, pivot: { x: 0.50, y: 0.60 } },
        description: '軽く扱いやすい弓。'
    },
    {
        id: 'round_shield',
        slot: 'shield',
        name: '円盾',
        price: 100,
        icon: { col: 1, row: 1 },
        stats: { DEF: 4 },
        description: '小回りの利く木と鉄の盾。'
    },
    {
        id: 'lion_shield',
        slot: 'shield',
        name: '獅子紋の盾',
        price: 220,
        icon: { col: 0, row: 1 },
        stats: { DEF: 7, MND: 1 },
        description: '前線で映える紋章盾。'
    },
    {
        id: 'scarlet_guard',
        slot: 'shield',
        name: '緋紋の盾',
        price: 320,
        icon: { col: 2, row: 1 },
        stats: { DEF: 8, ATK: 2 },
        description: '反撃姿勢を取りやすい盾。'
    },
    {
        id: 'tower_shield',
        slot: 'shield',
        name: '黒塔盾',
        price: 460,
        icon: { col: 3, row: 1 },
        stats: { DEF: 12, AGI: -2 },
        description: '突破を受け止める大型盾。'
    },
    {
        id: 'sun_shield',
        slot: 'shield',
        name: '太陽の円盾',
        price: 620,
        icon: { col: 4, row: 1 },
        stats: { DEF: 10, VIT: 4, LUK: 2 },
        description: '守りと生命力を高める黄金盾。'
    }
];

export const EQUIPMENT_ITEM_MAP = new Map(EQUIPMENT_ITEMS.map(item => [item.id, item]));

export function createEmptyEquipment() {
    return {
        head: null,
        body: null,
        weapon: null,
        shield: null
    };
}

export function normalizeEquipment(equipment = {}) {
    return {
        ...createEmptyEquipment(),
        ...(equipment || {})
    };
}

export function createInitialEquipmentInventory() {
    return {
        leather_cap: 1,
        leather_cuirass: 1,
        iron_sword: 1,
        round_shield: 1
    };
}

export function getEquipmentItem(itemId) {
    if (!itemId) return null;
    return EQUIPMENT_ITEM_MAP.get(itemId) || null;
}

export function getEquipmentItemsBySlot(slot) {
    return EQUIPMENT_ITEMS.filter(item => item.slot === slot);
}

export function getEquipmentStatBonus(equipment) {
    const normalized = normalizeEquipment(equipment);
    const totals = {};
    EQUIPMENT_STAT_KEYS.forEach(key => { totals[key] = 0; });

    Object.values(EQUIPMENT_SLOTS).forEach(slot => {
        const item = getEquipmentItem(normalized[slot.id]);
        if (!item || !item.stats) return;
        EQUIPMENT_STAT_KEYS.forEach(key => {
            totals[key] += item.stats[key] || 0;
        });
    });

    return totals;
}

export function addStatBonuses(baseStats, bonusStats) {
    const result = {};
    EQUIPMENT_STAT_KEYS.forEach(key => {
        const base = Number(baseStats?.[key] ?? 0);
        const bonus = Number(bonusStats?.[key] ?? 0);
        result[key] = Math.max(0, base + bonus);
    });
    return result;
}

export function formatEquipmentStats(stats = {}) {
    const parts = EQUIPMENT_STAT_KEYS
        .filter(key => stats[key])
        .map(key => `${key}${stats[key] > 0 ? '+' : ''}${stats[key]}`);
    return parts.length > 0 ? parts.join(' / ') : '効果なし';
}

export function getItemIconStyle(itemOrIcon) {
    const icon = itemOrIcon?.icon || itemOrIcon;
    if (!icon) return '';
    const x = ITEM_ICON_ATLAS.columns <= 1 ? 0 : (icon.col / (ITEM_ICON_ATLAS.columns - 1)) * 100;
    const y = ITEM_ICON_ATLAS.rows <= 1 ? 0 : (icon.row / (ITEM_ICON_ATLAS.rows - 1)) * 100;
    return [
        `background-image:url('${ITEM_ICON_ATLAS.path}')`,
        `background-size:${ITEM_ICON_ATLAS.columns * 100}% ${ITEM_ICON_ATLAS.rows * 100}%`,
        `background-position:${x.toFixed(3)}% ${y.toFixed(3)}%`
    ].join(';');
}
