const db = require('../../Core/database');
const PetDatabase = require('./PetDatabaseService');
const PetStats = require('./PetStatsService');

async function applyPetBoosts(userId, equippedPets = null) {
    if (!equippedPets) {
        equippedPets = await PetDatabase.getEquippedPets(userId, false);
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

        await db.run(
            `INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack)
             VALUES (?, ?, ?, ?, NULL, 1)`,
            [userId, type, petNames, multiplier]
        );
    }
}

async function clearPetBoosts(userId) {
    const pets = await db.all(
        `SELECT DISTINCT name FROM petInventory WHERE userId = ?`,
        [userId]
    );
    
    const petNames = pets.map(r => r.name);
    if (!petNames.length) return;

    const query = `
        DELETE FROM activeBoosts
        WHERE userId = ? AND (${petNames.map(() => 'source LIKE ?').join(' OR ')})
    `;
    const values = [userId, ...petNames.map(name => `%${name}%`)];

    await db.run(query, values);
}

async function refreshBoosts(userId) {
    await clearPetBoosts(userId);
    await applyPetBoosts(userId);
}

async function refreshAllBoosts() {
    const users = await db.all(`SELECT DISTINCT userId FROM equippedPets`, []);
    
    for (const { userId } of users) {
        await refreshBoosts(userId);
    }
}

async function updatePetAbility(petId, ability) {
    await db.run(
        `UPDATE petInventory SET ability = ? WHERE petId = ?`,
        [JSON.stringify(ability), petId]
    );
}

async function recalculateAndApplyBoosts(userId) {
    const equipped = await PetDatabase.getEquippedPets(userId, false);
    
    for (const pet of equipped) {
        const ability = PetStats.calculateBoost(pet);
        if (ability) {
            await updatePetAbility(pet.petId, ability);
        }
    }
    
    await refreshBoosts(userId);
}

module.exports = {
    applyPetBoosts,
    clearPetBoosts,
    refreshBoosts,
    refreshAllBoosts,
    updatePetAbility,
    recalculateAndApplyBoosts
};