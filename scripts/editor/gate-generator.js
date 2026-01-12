
const fs = require('fs');

const AIR = 0;
const STONE = 1;
const FLOOR = 2;

const SCALE = 5;
const logicSize = { x: 14, y: 4, z: 12 };
const size = { x: logicSize.x * SCALE, y: logicSize.y * SCALE, z: logicSize.z * SCALE };
const blocks = [];

// Initialize
for (let z = 0; z < size.z; z++) {
    blocks[z] = [];
    for (let y = 0; y < size.y; y++) {
        blocks[z][y] = [];
        for (let x = 0; x < size.x; x++) {
            blocks[z][y][x] = AIR;
        }
    }
}

// Build Logic (Original Logic scaled mapping)
for (let lz = 0; lz < logicSize.z; lz++) {
    for (let ly = 0; ly < logicSize.y; ly++) {
        for (let lx = 0; lx < logicSize.x; lx++) {

            let type = AIR;

            // Determine type based on original logic logic
            // Ground (Floor)
            if (lz === 0) {
                type = FLOOR;
            }
            // Towers (Left/Right)
            else if (lx < 4 || lx >= 10) {
                // Tower Base
                if (lz <= 9) {
                    type = STONE;
                }
                // Tower Crenellations (Top)
                if (lz === 10) {
                    // Edges only
                    if (ly === 0 || ly === logicSize.y - 1 || lx === 0 || lx === 3 || lx === 10 || lx === 13) {
                        if ((lx + ly) % 2 === 0) type = STONE;
                    }
                }
            }
            // Main Wall (Center)
            else {
                // Wall Base
                if (lz <= 7) {
                    type = STONE;
                }
                // Wall Crenellations
                if (lz === 8) {
                    if (ly === 0 || ly === logicSize.y - 1) {
                        if ((lx + ly) % 2 === 0) type = STONE;
                    }
                }
            }

            // Archway logic (Carve out)
            // Center X=4 to 9 (Width 6, implies x=5,6,7,8 for 4-width hole? Original was 5<=x<=8)
            // Original: for (let x = 5; x <= 8; x++) -> 5,6,7,8
            // Height 1 to 5
            if (lz >= 1 && lz <= 5) {
                if (lx >= 5 && lx <= 8) {
                    type = AIR;
                }
            }


            // Apply to scaled blocks
            if (type !== AIR) {
                for (let sz = 0; sz < SCALE; sz++) {
                    for (let sy = 0; sy < SCALE; sy++) {
                        for (let sx = 0; sx < SCALE; sx++) {
                            blocks[lz * SCALE + sz][ly * SCALE + sy][lx * SCALE + sx] = type;
                        }
                    }
                }
            }
        }
    }
}

// Archway logic is integrated above

const data = { name: "Castle Gate (Auto)", size, blocks };
fs.writeFileSync('castle_gate.json', JSON.stringify(data, null, 2));
console.log("Generated castle_gate.json");
