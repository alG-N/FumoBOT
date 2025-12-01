const { get, run } = require('../../../../Core/database');

function getMaxHunger(rarity) {
    const hungerMap = {
        Common: 1500,
        Rare: 1800,
        Epic: 2160,
        Legendary: 2880,
        Mythical: 3600,
        Divine: 4320
    };
    return hungerMap[rarity] || 1500;
}

async function handlePetFoob(message, itemName, quantity, userId) {
    try {
        const petRow = await get(
            `SELECT * FROM petInventory WHERE userId = ? AND type = 'pet' AND hunger < 100 ORDER BY hunger ASC LIMIT 1`,
            [userId]
        );

        if (!petRow) {
            return message.reply("❌ You don't have any pets that need feeding.");
        }

        console.log(`🾠Feeding pet with ID: ${petRow.petId}, Name: ${petRow.name}, Hunger: ${petRow.hunger}`);

        const maxHunger = getMaxHunger(petRow.rarity || 'Common');

        await run(
            `UPDATE petInventory SET hunger = ?, lastHungerUpdate = ? WHERE petId = ?`,
            [maxHunger, Math.floor(Date.now() / 1000), petRow.petId]
        );

        message.reply(`✅ You fed **${petRow.name}**! Hunger restored to 100%.`);

    } catch (error) {
        console.error('[PET_FOOB] Error:', error);
        message.reply('❌ Failed to feed your pet.');
    }
}

module.exports = { handlePetFoob };