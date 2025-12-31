import fs from 'fs';
import path from 'path';

const genesisPath = 'C:/synthesis-ledger/genesis_onchain.json';
const recipesDir = './recipes';

if (!fs.existsSync(recipesDir)) fs.mkdirSync(recipesDir);

const genesis = JSON.parse(fs.readFileSync(genesisPath, 'utf8'));

genesis.forEach(recipe => {
    const filename = `${recipe.outcome}.json`;
    fs.writeFileSync(path.join(recipesDir, filename), JSON.stringify(recipe, null, 2));
    console.log(`💎 Slivered: ${filename}`);
});
console.log(`\n✅ 38 Atomics ready for Arweave deployment.`);