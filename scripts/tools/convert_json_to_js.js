
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../../castle_gate_new.json');
const jsPath = path.join(__dirname, '../../scripts/data/castle_gate.js');

try {
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(jsonData);

    const jsContent = `
/**
 * Generated Castle Gate Data
 */
export const CASTLE_GATE_DATA = ${JSON.stringify(data, null, 4)};
`;

    fs.writeFileSync(jsPath, jsContent);
    console.log(`Converted ${jsonPath} to ${jsPath}`);
} catch (e) {
    console.error('Error converting file:', e);
}
