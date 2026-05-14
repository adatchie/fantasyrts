
const HEX_DIRECTIONS = [
    { q: 1, r: 0 },   // 0: East
    { q: 0, r: 1 },   // 1: SouthEast
    { q: -1, r: 1 },  // 2: SouthWest
    { q: -1, r: 0 },  // 3: West
    { q: 0, r: -1 },  // 4: NorthWest
    { q: 1, r: -1 }   // 5: NorthEast
];

function add(a, b) { return { q: a.q + b.q, r: a.r + b.r }; }
function scale(a, k) { return { q: a.q * k, r: a.r * k }; }

function generateFormations() {
    const formations = {};

    // --- GYORIN (Fish Scales) ---
    // Dense cluster. Rings around (0,0).
    const gyorin = [];
    // Ring 1
    for (const d of HEX_DIRECTIONS) gyorin.push(d);
    // Ring 2
    for (let i = 0; i < 6; i++) {
        const corner = scale(HEX_DIRECTIONS[i], 2);
        gyorin.push(corner);
        // Fill between corner and next corner
        // corner + next_dir (approx)
        // actually ring 2 is: 2*dir_i, and 2*dir_i + dir_(i+4%6) -> moving back?
        // Standard ring generation:
        // For each direction side, walk N steps
        // let's do simple ring walk
        const nextDir = HEX_DIRECTIONS[(i + 2) % 6];
        // No, standard ring:
        // corner = direction * radius
        // walk along direction (i+2)%6 for radius steps
        const sideDir = HEX_DIRECTIONS[(i + 2) % 6];
        gyorin.push(add(corner, sideDir)); // Middle of edge
    }
    // Ring 3 (Need 29 total, we have 6 + 12 = 18. Need 11 more)
    // Ring 3 has 18 slots. We take Front (East) focused ones? Or just full ring.
    // Let's take full ring 3 to ensure enough slots (up to 30+)
    for (let i = 0; i < 6; i++) {
        const corner = scale(HEX_DIRECTIONS[i], 3);
        gyorin.push(corner);
        const sideDir = HEX_DIRECTIONS[(i + 2) % 6];
        gyorin.push(add(corner, sideDir));
        gyorin.push(add(corner, scale(sideDir, 2)));
    }
    formations.GYORIN = gyorin;

    // --- HOKO (Arrowhead) ---
    // Long center spine, tapered sides
    // Spine: East
    const hoko = [];
    // Center column
    for (let i = 1; i <= 5; i++) hoko.push({ q: i, r: 0 });

    // Sides
    for (let i = 1; i <= 4; i++) {
        // Top side (NE): (q, r-q) ?? NE is (1, -1). 
        // Let's just stack "behind and out"
        // Row 1 (just behind tip): Tip is (5,0). 
        // Let's build purely by layers.
        // Hoko is a triangle pointing East.
        // Tip: (4,0)
        // Row behind: (3, -1), (3, 0), (3, 1) -> (3,1) is SE of (3,0)? No (0,1) is SE.
        // (3,0) + (0,1) = (3,1). (3,0) + (1,-1) is NE? No NE is (1,-1).
        // (3,0) NE is (4,-1).
        // Let's define rows by X (q).
        // q=4: r=0 (Tip)
        // q=3: r=-1, 0, 1 (Width 3) - but r direction is slanted.
        // Let's use axial coords visually.
        //      (1,-1) (2,-1)
        // (0,0) (1,0)  (2,0)
        //      (0,1)  (1,1)
        // This forms a forward wedge.
    }
    // Reset Hoko
    const hoko2 = [];
    // Center
    hoko2.push({ q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 }, { q: 5, r: 0 });
    // Flanks
    // Inner Flank
    hoko2.push({ q: 1, r: -1 }, { q: 2, r: -1 }, { q: 3, r: -1 }); // North side
    hoko2.push({ q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 });  // South side
    // Outer Flank
    hoko2.push({ q: 1, r: -2 }, { q: 2, r: -2 }); // North
    hoko2.push({ q: -1, r: 2 }, { q: 0, r: 2 });  // South
    // Back gaurd / root
    hoko2.push({ q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 });
    // Fill rest to 30
    hoko2.push({ q: 0, r: -2 }, { q: -1, r: 3 }, { q: 3, r: -2 }, { q: 1, r: 2 }); // Random extras to fill shape


    // Let's algorithmically build a Triangle pointing East
    //     *
    //    * *
    //   * * *
    //  * * * *
    // The "columns" are vertical in screen space?
    // In hex (pointy top), q is diagonal SE, r is straight down? No.
    // q=East, r=SE.
    //      (0,-1)
    // (-1,0) (0,0) (1,0)
    //      (0,1)
    // To make a West-East arrow:
    //      (1,-1)  (2,-1)
    // (0,0)  (1,0)   (2,0)   (3,0)
    //      (0,1)   (1,1)
    //    (-1,2)  (0,2)

    const hokoFinal = [];
    // Spine
    hokoFinal.push({ q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 });
    // Layer 1 (Top/Bottom)
    hokoFinal.push({ q: 1, r: -1 }, { q: 2, r: -1 }, { q: 3, r: -1 });
    hokoFinal.push({ q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 });
    // Layer 2
    hokoFinal.push({ q: 1, r: -2 }, { q: 2, r: -2 });
    hokoFinal.push({ q: -1, r: 2 }, { q: 0, r: 2 });
    // Layer 3
    hokoFinal.push({ q: 1, r: -3 });
    hokoFinal.push({ q: -2, r: 3 });
    // Fillers around base
    hokoFinal.push({ q: 0, r: -1 }, { q: 0, r: -2 });
    hokoFinal.push({ q: -1, r: 1 }, { q: -1, r: 0 }); // Back
    hokoFinal.push({ q: -1, r: -1 }, { q: -2, r: 1 }, { q: -2, r: 2 });
    // Check count
    // 4 + 6 + 4 + 2 + 7 = 23. Need more.
    hokoFinal.push({ q: -2, r: 0 }, { q: -3, r: 0 }, { q: -3, r: 1 }, { q: -3, r: 2 }, { q: -2, r: -1 }, { q: -2, r: -2 });

    formations.HOKO = hokoFinal;

    // --- KAKUYOKU (Crane Wing) ---
    // V-shape opening East.
    // Center is empty (HQ is protected or exposed? Usually HQ deep inside V)
    // Wings extend forward-out.
    const kaku = [];
    // Left Wing (North-East direction-ish)
    // Going (1, -1) [NE] -> (2, -2) ...
    for (let i = 0; i < 8; i++) kaku.push({ q: i, r: -(i + 1) }); // (0,-1), (1,-2)...
    // Right Wing (South-East direction-ish - actually SE is (0,1). But we want symmetry.)
    // If NE is (1,-1), then SE symmetric is (0,1)?
    // (1,-1) in pixels: (+x, -y).
    // (1,0) is (+x, 0).
    // (0,1) is (+x/2, +y).
    // To get (+x, +y), we need... (1, 1)? No (1,1) is (1,0)+(0,1).
    // Let's use (1,1) for South-East-Forward?
    // (1,0) + (0,1) = (1,1).
    // No. (0,1) is SE.
    // Let's just create a wall.
    // Wall 1: (0,-1), (0,-2), (0,-3)... (North West line)
    // Wall 2: (-1,1), (-2,2), (-3,3)... (South West line)
    // This is V opening East? No this is V pointing West.
    // We want V opening East. So the tips are East.
    // Arm 1: starts at (0,-1), goes to (1,-2), (2,-3)... (NE)
    // Arm 2: starts at (-1,1), goes to (0,2), (1,3)... (SE ?)
    // Let's verify SE: (0,1) is SE. (1,1) is E+SE.

    // Let's try:
    // N-Side: (0,-1), (1,-2), (2,-3), (3,-4), (4,-5)
    // S-Side: (-1,1), (0,2) -> wait, (-1,1) is SW.
    // Let's use:
    // N-Side: (0,-1), (0,-2), (1,-2), (1,-3), (2,-3)... Staggered NE
    // S-Side: (0,1), (-1,2), (0,2), (-1,3), (0,3)? No.

    // Let's construct strictly visually.
    // Forward-Left (NE): (1,-1), (2,-2), (3,-3), (4,-4)
    // Forward-Right (SE): (0,1), (1,2), (2,3), (3,4) -- (0,1) is SE. (1,2) is (1,1)+(0,1).
    // (1,1) is (1,0)+(0,1) = East + SE.
    // So (0,1), (1,2), (2,3)... is a line to the SE.

    // Arm 1 (NE): 
    for (let i = 0; i < 6; i++) kaku.push({ q: i, r: -(i + 1) }); // (0,-1), (1,-2)...
    // Arm 2 (SE):
    for (let i = 0; i < 6; i++) kaku.push({ q: i, r: i + 1 }); // (0,1), (1,2)...

    // Thicken the wings
    // Inner layer
    for (let i = 0; i < 5; i++) kaku.push({ q: i, r: -(i + 2) }); // Above Arm 1? r is more negative -> more North?
    // r=-1 is NW/N. r=-2 is more NW.
    // We want inner side.
    // If Arm 1 is (1,-2), inner is (0,-1)? Already used.
    // Let's fill the body.
    kaku.push({ q: -1, r: -1 }, { q: -1, r: -2 }, { q: -2, r: -1 }); // Back Left
    kaku.push({ q: -1, r: 2 }, { q: -2, r: 2 }, { q: -2, r: 1 }); // Back Right

    // More front
    kaku.push({ q: 1, r: -3 }, { q: 2, r: -4 }, { q: 3, r: -5 });
    kaku.push({ q: 1, r: 3 }, { q: 2, r: 4 }, { q: 3, r: 5 }); // Symmetrical SE line?

    // Center guard
    kaku.push({ q: -1, r: 0 }, { q: -2, r: 0 });

    formations.KAKUYOKU = kaku;

    return formations;
}

const f = generateFormations();
console.log(JSON.stringify(f, null, 2));

function render(name, slots) {
    const grid = new Map();
    grid.set("0,0", 1);
    for (const s of slots) {
        const k = `${s.q},${s.r}`;
        grid.set(k, (grid.get(k) || 0) + 1);
    }

    let minQ = 0, maxQ = 0, minR = 0, maxR = 0;
    for (const k of grid.keys()) {
        const [q, r] = k.split(',').map(Number);
        minQ = Math.min(minQ, q); maxQ = Math.max(maxQ, q);
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    }

    console.log(`\n${name} (${slots.length} slots)`);
    console.log("```");
    for (let r = minR; r <= maxR; r++) {
        let line = "";
        if (r % 2 !== 0) line += " ";
        for (let q = minQ; q <= maxQ; q++) {
            const k = `${q},${r}`;
            const c = grid.get(k);
            if (q === 0 && r === 0) line += "[H ]";
            else if (c) line += "[x ]";
            else line += "    "; // 4 spaces
        }
        console.log(line);
    }
    console.log("```");
}

/*
for(const k in f) {
    render(k, f[k]);
}
*/
