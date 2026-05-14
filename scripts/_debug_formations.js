
const FORMATIONS = {
    'HOKO (鋒矢の陣)': [
        { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 }, { q: 5, r: 0 }, // Spine
        { q: 1, r: -1 }, { q: 2, r: -1 }, { q: 3, r: -1 }, // Left Inner
        { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, // Right Inner
        { q: 1, r: -2 }, { q: 2, r: -2 }, // Left Outer
        { q: -1, r: 2 }, { q: 0, r: 2 }, // Right Outer
        { q: 1, r: -3 }, { q: -2, r: 3 }, // Tips
        { q: 0, r: -1 }, { q: 0, r: -2 }, // Base Left
        { q: -1, r: 1 }, { q: -1, r: 0 }, { q: -1, r: -1 }, // Back
        { q: -2, r: 1 }, { q: -2, r: 2 }, { q: -2, r: 0 }, // Back Wide
        { q: -3, r: 0 }, { q: -3, r: 1 }, { q: -3, r: 2 }, // Back Far
        { q: -2, r: -1 }, { q: -2, r: -2 } // Back Fill
    ],
    'KAKUYOKU (鶴翼の陣)': [
        // Left Wing (NE)
        { q: 0, r: -1 }, { q: 1, r: -2 }, { q: 2, r: -3 }, { q: 3, r: -4 }, { q: 4, r: -5 }, { q: 5, r: -6 },
        // Right Wing (SE)
        { q: 0, r: 1 }, { q: 1, r: 2 }, { q: 2, r: 3 }, { q: 3, r: 4 }, { q: 4, r: 5 }, { q: 5, r: 6 },
        // Inner Left & Right
        { q: 1, r: -3 }, { q: 2, r: -4 }, { q: 3, r: -5 },
        { q: 1, r: 3 }, { q: 2, r: 4 }, { q: 3, r: 5 },
        // Body
        { q: -1, r: -1 }, { q: -1, r: -2 }, { q: -2, r: -1 },
        { q: -1, r: 2 }, { q: -2, r: 2 }, { q: -2, r: 1 },
        // Center Guard
        { q: -1, r: 0 }, { q: -2, r: 0 }, { q: -3, r: 0 },
        // Rear Extensions
        { q: -3, r: -1 }, { q: -3, r: 1 }, { q: -4, r: 0 }
    ],
    'GYORIN (魚鱗の陣)': [
        // Ring 1
        { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 },
        // Ring 2
        { q: 2, r: 0 }, { q: 1, r: 1 }, { q: 0, r: 2 }, { q: -1, r: 2 }, { q: -2, r: 2 }, { q: -2, r: 1 },
        { q: -2, r: 0 }, { q: -1, r: -1 }, { q: 0, r: -2 }, { q: 1, r: -2 }, { q: 2, r: -2 }, { q: 2, r: -1 },
        // Ring 3 (Front Heavy)
        { q: 3, r: 0 }, { q: 2, r: 1 }, { q: 1, r: 2 }, { q: 0, r: 3 }, { q: 3, r: -1 }, { q: 2, r: -3 },
        { q: -3, r: 0 }, { q: -3, r: 3 }, { q: -3, r: -3 }, { q: -1, r: 3 }, { q: -1, r: -3 }, { q: 1, r: -3 }
    ]
};

function renderFormation(name, slots) {
    // 30 units total check
    const totalUnits = 30;
    const subCount = totalUnits - 1;

    const grid = new Map();
    grid.set("0,0", 1);

    for (let i = 0; i < subCount; i++) {
        let q = 0, r = 0;
        if (i < slots.length) {
            q = slots[i].q;
            r = slots[i].r;
        }
        const key = `${q},${r}`;
        grid.set(key, (grid.get(key) || 0) + 1);
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const points = [];

    for (const key of grid.keys()) {
        const [q, r] = key.split(',').map(Number);
        const count = grid.get(key);
        // x = 2 * q + r, y = r
        const x = 2 * q + r;
        const y = r;
        points.push({ x, y, count });
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    }

    const H = maxY - minY + 3;
    const W = maxX - minX + 5;
    const canvas = Array(H).fill(null).map(() => Array(W).fill(' '));

    points.forEach(p => {
        const row = p.y - minY + 1;
        const col = p.x - minX + 2;
        canvas[row][col] = p.count > 0 ? String(p.count).slice(-1) : '.';
    });

    console.log(`\n### ${name}`);
    console.log(`Slots Defined: ${slots.length}`);
    console.log(`Subordinates: ${subCount}`);
    console.log(`Overflow at HQ: ${grid.get("0,0") - 1} (should be 0)`);
    console.log("```");
    for (let r = 0; r < H; r++) {
        console.log(canvas[r].join('').replace(/(\d)/g, '[$1]'));
    }
    console.log("```");
}

for (const [name, slots] of Object.entries(FORMATIONS)) {
    renderFormation(name, slots);
}
