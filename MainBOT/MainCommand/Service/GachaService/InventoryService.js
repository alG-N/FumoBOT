const { run } = require('../Core/database');
const { SHINY_CONFIG } = require('../Configuration/rarity');
const { incrementWeeklyShiny } = require('../Ultility/weekly');


async function selectAndAddFumo(userId, rarity, fumos, luck) {
    const matchingFumos = fumos.filter(f => f.name.includes(rarity));
    if (matchingFumos.length === 0) return null;

    const fumo = matchingFumos[Math.floor(Math.random() * matchingFumos.length)];
    
    const shinyChance = SHINY_CONFIG.BASE_CHANCE + (Math.min(1, luck || 0) * SHINY_CONFIG.LUCK_BONUS);
    const alGChance = SHINY_CONFIG.ALG_BASE_CHANCE + (Math.min(1, luck || 0) * SHINY_CONFIG.ALG_LUCK_BONUS);

    const isAlterGolden = Math.random() < alGChance;
    const isShiny = !isAlterGolden && Math.random() < shinyChance;

    let fumoName = fumo.name;
    if (isAlterGolden) {
        fumoName += '[🌟alG]';
        await incrementWeeklyShiny(userId);
    } else if (isShiny) {
        fumoName += '[✨SHINY]';
        await incrementWeeklyShiny(userId);
    }

    await run(`INSERT INTO userInventory (userId, fumoName) VALUES (?, ?)`, [userId, fumoName]);

    return { ...fumo, rarity, name: fumoName };
}

async function deductCoins(userId, amount) {
    await run(`UPDATE userCoins SET coins = coins - ? WHERE userId = ?`, [amount, userId]);
}

async function addCoins(userId, amount) {
    await run(`UPDATE userCoins SET coins = coins + ? WHERE userId = ?`, [amount, userId]);
}

module.exports = {
    selectAndAddFumo,
    deductCoins,
    addCoins
};