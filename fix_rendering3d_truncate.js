const fs = require('fs');
const path = 'c:\\fantasyrts\\scripts\\rendering3d.js';

try {
    const data = fs.readFileSync(path, 'utf8');
    const marker = "console.log('[RenderingEngine3D] Deployment highlights cleared');";
    const idx = data.lastIndexOf(marker);

    if (idx === -1) throw new Error('Marker not found');

    // if文の閉じ
    const ifEnd = data.indexOf('}', idx);
    if (ifEnd === -1) throw new Error('If close not found');

    // メソッドの閉じ
    const methodEnd = data.indexOf('}', ifEnd + 1);
    if (methodEnd === -1) throw new Error('Method close not found');

    console.log('Truncating at:', methodEnd + 1);

    // メソッド閉じまでを保持
    const newData = data.substring(0, methodEnd + 1) + '\n}\n';

    fs.writeFileSync(path, newData);
    console.log('Success');
} catch (e) {
    console.error(e);
}
