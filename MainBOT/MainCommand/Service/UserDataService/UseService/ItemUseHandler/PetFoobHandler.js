const { get, all, run } = require('../../../../Core/database');

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
        const hungryPets = await all(
            `SELECT * FROM petInventory 
             WHERE userId = ? AND type = 'pet' 
             ORDER BY hunger ASC`,
            [userId]
        );

        if (!hungryPets || hungryPets.length === 0) {
            return message.reply("❌ You don't have any pets.");
        }

        const petsToFeed = [];
        let foodUsed = 0;

        for (const pet of hungryPets) {
            if (foodUsed >= quantity) break;

            const maxHunger = getMaxHunger(pet.rarity || 'Common');
            
            if (pet.hunger < maxHunger) {
                petsToFeed.push({
                    petId: pet.petId,
                    name: pet.name,
                    petName: pet.petName,
                    currentHunger: pet.hunger,
                    maxHunger: maxHunger,
                    rarity: pet.rarity
                });
                foodUsed++;
            }
        }

        if (petsToFeed.length === 0) {
            return message.reply("❌ All your pets are already full!");
        }

        const fedPets = [];
        for (const pet of petsToFeed) {
            await run(
                `UPDATE petInventory 
                 SET hunger = ?, lastHungerUpdate = ? 
                 WHERE petId = ?`,
                [pet.maxHunger, Math.floor(Date.now() / 1000), pet.petId]
            );
            fedPets.push(pet);
        }

        const petList = fedPets.map(p => 
            `**${p.name}** "${p.petName}" (${p.currentHunger.toFixed(0)} → ${p.maxHunger})`
        ).join('\n');

        message.reply(
            `✅ Fed ${fedPets.length} pet${fedPets.length > 1 ? 's' : ''}!\n\n${petList}`
        );

    } catch (error) {
        console.error('[PET_FOOB] Error:', error);
        message.reply('❌ Failed to feed your pets.');
    }
}

module.exports = { handlePetFoob };