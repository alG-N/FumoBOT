const { run } = require('../../../Core/database');
const { incrementWeeklyShiny } = require('../../../Ultility/weekly');
const { debugLog } = require('../../../Core/logger');

async function addFumoToInventory(userId, fumo, shinyMarkValue = 0) {
    const shinyMark = Math.min(1, shinyMarkValue);
    const shinyChance = 0.01 + (shinyMark * 0.02);
    const alGChance = 0.00001 + (shinyMark * 0.00009);

    const isAlterGolden = Math.random() < alGChance;
    const isShiny = !isAlterGolden && Math.random() < shinyChance;

    let fumoName = fumo.name;
    if (isAlterGolden) {
        fumoName += '[🌟alG]';
        await incrementWeeklyShiny(userId);
        debugLog('MARKET_INV', `AlterGolden variant: ${fumoName}`);
    } else if (isShiny) {
        fumoName += '[✨SHINY]';
        await incrementWeeklyShiny(userId);
        debugLog('MARKET_INV', `Shiny variant: ${fumoName}`);
    }

    await run(
        `INSERT INTO userInventory(userId, fumoName) VALUES(?, ?)`,
        [userId, fumoName]
    );

    debugLog('MARKET_INV', `Added ${fumoName} to ${userId}'s inventory`);
}

module.exports = {
    addFumoToInventory
};