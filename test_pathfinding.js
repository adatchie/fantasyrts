import { MapSystem } from './scripts/map.js';
import { TERRAIN_TYPES } from './scripts/map-repository.js'; // Note map.js has its own TERRAIN_TYPES
import { estimateTurns, findPath, getReachableTiles } from './scripts/pathfinding.js';
import { UNIT_TYPES, TILE_HEIGHT } from './scripts/constants.js';

// Setup Mock Map
const mapSystem = new MapSystem();
const mockMapData = {
    terrain: {
        width: 10,
        height: 10,
        heightMap: Array(10).fill().map(() => Array(10).fill(10)), // All mountains (height 10)
        terrainType: Array(10).fill().map(() => Array(10).fill('mountain')) // mapped to 'MTN'
    }
};

mapSystem.setMapData(mockMapData);

// Setup Mock Unit
const movingUnit = {
    x: 5,
    y: 5,
    q: 5,
    r: 5,
    side: 'EAST',
    movePower: 3,
    canFly: false,
    unitType: 'INFANTRY'
};

const units = [movingUnit];

console.log('Testing Mountain Passability');
console.log('Unit is at 5,5 on Mountain.');

// Test 1: getMoveCost
const cost1 = mapSystem.getMoveCost({ x: 5, y: 5 }, { x: 6, y: 5 }, false);
console.log(`getMoveCost from (5,5) to (6,5): ${cost1}`);

// Test 2: findPath
const path = findPath(5, 5, 6, 5, units, movingUnit, mapSystem);
console.log(`findPath to (6,5):`, path ? `Path found, length ${path.length}` : 'null');

// Test 3: estimateTurns
const turns = estimateTurns(movingUnit, 6, 5, mapSystem, units);
console.log(`estimateTurns to (6,5): ${turns} (Expected: 1)`);

// Test 4: getReachableTiles
const reachable = getReachableTiles(5, 5, 3, mapSystem, false);
console.log(`getReachableTiles with Move 3: Found ${reachable.length} tiles`);

// Print out tile info explicitly
const tile = mapSystem.getTile(5, 5);
console.log(`Tile at 5,5:`, tile);
