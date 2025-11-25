const db = require('../../Database/db');
const { calculateBoost } = require('../Utilities/petUtils');
const { dbAll, dbRun } = require('../Utilities/dbUtils');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const userId = message.author.id;
        const content = message.content.trim().toLowerCase();

        // Equip pet(s)
        if (content.startsWith('.equippet') || content.startsWith('.ep') ||
            content.startsWith('.equipbest') || content.startsWith('.eb')) {

            const isEquipBest = content.startsWith('.equipbest') || content.startsWith('.eb');
            let petName = 'best';

            if (!isEquipBest) {
                petName = message.content
                    .replace(/^\.ep\b|^\.equippet\b/i, '')
                    .trim();
            }

            try {
                const pets = await dbAll(db, `SELECT * FROM petInventory WHERE userId = ?`, [userId]);

                if (!pets || pets.length === 0) {
                    return message.reply("❌ You don't own any pets.");
                }

                const equipped = await dbAll(db, `SELECT petId FROM equippedPets WHERE userId = ?`, [userId]);
                const equippedIds = equipped.map(e => e.petId);
                let petsToEquip = [];

                if (isEquipBest || petName === 'best') {
                    const scored = pets
                        .filter(p => !equippedIds.includes(p.petId))
                        .map(p => ({
                            ...p,
                            score: (p.quality + p.weight) * (p.age || 1) * (p.level || 1)
                        }));

                    petsToEquip = scored.sort((a, b) => b.score - a.score).slice(0, 5);

                    if (petsToEquip.length === 0) {
                        return message.reply("❌ No unequipped pets available to equip as best.");
                    }
                } else {
                    const matched = pets.filter(p => p.petName === petName);

                    if (matched.length === 0) {
                        return message.reply("❌ You don't own a pet with that name.");
                    }

                    const availablePet = matched.find(p => !equippedIds.includes(p.petId));

                    if (!availablePet) {
                        return message.reply(`❌ Your pet **${petName}** is already equipped.`);
                    }

                    if (equipped.length >= 5) {
                        return message.reply("❌ You can only equip up to 5 pets.");
                    }

                    petsToEquip = [availablePet];
                }

                // Clear all equipped if equipping best
                if (isEquipBest || petName === 'best') {
                    await dbRun(db, `DELETE FROM equippedPets WHERE userId = ?`, [userId]);
                }

                // Equip pets and calculate abilities
                for (const pet of petsToEquip) {
                    await dbRun(db, `INSERT INTO equippedPets (userId, petId) VALUES (?, ?)`, [userId, pet.petId]);

                    const ability = calculateBoost(pet);
                    if (ability) {
                        await dbRun(db,
                            `UPDATE petInventory SET ability = ? WHERE petId = ?`,
                            [JSON.stringify(ability), pet.petId]
                        );
                    }
                }

                await clearPetBoosts(userId);
                await applyPetBoosts(userId, petsToEquip);

                const petNames = petsToEquip.map(p => `**${p.name}**`).join(', ');
                message.reply(`✅ Equipped ${isEquipBest ? 'your best pets' : petNames} successfully!`);

            } catch (error) {
                console.error("Error equipping pet:", error);
                message.reply("❌ Failed to equip pets.");
            }
        }

        // Unequip pet(s)
        else if (content.startsWith('.unequip') || content.startsWith('.ue') ||
            content.startsWith('.unequipall') || content.startsWith('.uea')) {

            const isUnequipAll = content.startsWith('.unequipall') || content.startsWith('.uea');

            if (isUnequipAll) {
                try {
                    await dbRun(db, `DELETE FROM equippedPets WHERE userId = ?`, [userId]);
                    await clearPetBoosts(userId);
                    message.reply(`✅ All pets have been unequipped.`);
                } catch (error) {
                    console.error("Error unequipping all pets:", error);
                    message.reply("❌ Failed to unequip all pets.");
                }
            } else {
                const petName = message.content
                    .replace(/^\.uea\b|^\.unequipall\b|^\.ue\b|^\.unequip\b/i, '')
                    .trim()
                    .toLowerCase();

                if (!petName) {
                    return message.reply("❌ Please provide a pet name to unequip.");
                }

                try {
                    const pets = await dbAll(db, `
                        SELECT p.* FROM equippedPets e
                        JOIN petInventory p ON e.petId = p.petId
                        WHERE e.userId = ? AND LOWER(p.name) = LOWER(?)
                    `, [userId, petName]);

                    if (!pets || pets.length === 0) {
                        return message.reply("❌ No equipped pet found with that name.");
                    }

                    const petToRemove = pets[0];
                    await dbRun(db, `DELETE FROM equippedPets WHERE userId = ? AND petId = ?`, [userId, petToRemove.petId]);

                    const updatedPets = await dbAll(db, `
                        SELECT p.* FROM equippedPets e
                        JOIN petInventory p ON e.petId = p.petId
                        WHERE e.userId = ?
                    `, [userId]);

                    await clearPetBoosts(userId);
                    await applyPetBoosts(userId, updatedPets);

                    message.reply(`✅ Unequipped **${petToRemove.name}**.`);
                } catch (error) {
                    console.error("Error unequipping pet:", error);
                    message.reply("❌ Failed to unequip the pet.");
                }
            }
        }
    });

    // Auto-refresh pet boosts every 10 seconds
    setInterval(async () => {
        try {
            const users = await dbAll(db, `SELECT DISTINCT userId FROM equippedPets`, []);

            for (const row of users) {
                await clearPetBoosts(row.userId);
                await applyPetBoosts(row.userId);
            }
        } catch (error) {
            console.error("Error in auto-refresh boosts:", error);
        }
    }, 10000);
};

// Apply boosts based on equipped pets' abilities
async function applyPetBoosts(userId, equippedPets = null) {
    if (!equippedPets) {
        equippedPets = await dbAll(db, `
            SELECT p.* FROM equippedPets e
            JOIN petInventory p ON e.petId = p.petId
            WHERE e.userId = ?
        `, [userId]);
    }

    if (!equippedPets.length) return;

    const boostMap = {};

    for (const pet of equippedPets) {
        if (!pet.ability) continue;

        let ability;
        try {
            ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
        } catch {
            continue;
        }

        const { type, amount, boostType } = ability;
        const key = type.toLowerCase();

        if (!boostMap[key]) {
            boostMap[key] = { boostType, values: [], pets: [] };
        }

        boostMap[key].values.push(amount);
        boostMap[key].pets.push({ petId: pet.petId, name: pet.name });
    }

    // Insert boosts into activeBoosts table
    for (const [type, { boostType, values, pets }] of Object.entries(boostMap)) {
        const petNames = pets.map(p => p.name).join(', ');
        let multiplier = 1;

        if (boostType === 'multiplier') {
            values.forEach(val => multiplier *= val);
        } else if (boostType === 'percent') {
            const totalPercent = values.reduce((a, b) => a + b, 0);
            multiplier = 1 + totalPercent / 100;
        } else if (boostType === 'passive') {
            const total = values.reduce((a, b) => a + (b.passive || 0), 0);
            multiplier = 1 + total;
        }

        try {
            await dbRun(db, `
                INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack)
                VALUES (?, ?, ?, ?, NULL, 1)
            `, [userId, type, petNames, multiplier]);
        } catch (error) {
            console.error(`Failed to add boost for user ${userId}, type ${type}:`, error);
        }
    }
}

// Clear pet-related boosts
async function clearPetBoosts(userId) {
    try {
        const rows = await dbAll(db, `SELECT name FROM petInventory WHERE userId = ?`, [userId]);
        const petNames = rows.map(r => r.name);

        if (!petNames.length) return;

        const query = `
            DELETE FROM activeBoosts
            WHERE userId = ? AND (${petNames.map(() => 'source LIKE ?').join(' OR ')})
        `;
        const values = [userId, ...petNames.map(name => `%${name}%`)];

        await dbRun(db, query, values);
    } catch (error) {
        console.error("Error clearing pet boosts:", error);
    }
}