const db = require('../../Core/database');
const PetCache = require('./PetCacheService');

async function getUserPets(userId, useCache = true) {
    if (useCache) {
        const cached = PetCache.get(userId, 'pets');
        if (cached) return cached;
    }
    
    const pets = await db.all(
        `SELECT * FROM petInventory WHERE userId = ? AND type = 'pet'`,
        [userId],
        true
    );
    
    if (useCache) PetCache.set(userId, 'pets', pets);
    return pets;
}

async function getUserEggs(userId, useCache = true) {
    if (useCache) {
        const cached = PetCache.get(userId, 'eggs');
        if (cached) return cached;
    }
    
    const eggs = await db.all(
        `SELECT name, COUNT(*) as count FROM petInventory 
         WHERE userId = ? AND type = 'egg' GROUP BY name`,
        [userId],
        true
    );
    
    if (useCache) PetCache.set(userId, 'eggs', eggs);
    return eggs;
}

async function getEquippedPets(userId, useCache = true) {
    if (useCache) {
        const cached = PetCache.get(userId, 'equipped');
        if (cached) return cached;
    }
    
    const equipped = await db.all(
        `SELECT p.* FROM equippedPets e
         JOIN petInventory p ON e.petId = p.petId
         WHERE e.userId = ?`,
        [userId],
        true
    );
    
    if (useCache) PetCache.set(userId, 'equipped', equipped);
    return equipped;
}

async function getHatchingEggs(userId, useCache = true) {
    if (useCache) {
        const cached = PetCache.get(userId, 'hatching');
        if (cached) return cached;
    }
    
    const hatching = await db.all(
        `SELECT * FROM hatchingEggs WHERE userId = ? ORDER BY hatchAt ASC`,
        [userId],
        true
    );
    
    if (useCache) PetCache.set(userId, 'hatching', hatching);
    return hatching;
}

async function insertPet(petData) {
    const { petId, userId, type, name, petName, rarity, weight, age, quality, timestamp, level, hunger, ageXp, lastHungerUpdate, baseWeight, ability } = petData;
    
    await db.run(
        `INSERT INTO petInventory (
            petId, userId, type, name, petName, rarity, weight, age, quality,
            timestamp, level, hunger, ageXp, lastHungerUpdate, baseWeight, ability
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [petId, userId, type, name, petName, rarity, weight, age, quality, timestamp, level, hunger, ageXp, lastHungerUpdate, baseWeight || weight, ability || null]
    );
    
    PetCache.invalidate(userId);
}

async function updatePet(petId, updates) {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), petId];
    
    await db.run(
        `UPDATE petInventory SET ${fields} WHERE petId = ?`,
        values
    );
}

async function deletePet(userId, petId) {
    await db.run(`DELETE FROM petInventory WHERE petId = ?`, [petId]);
    PetCache.invalidate(userId);
}

async function equipPet(userId, petId) {
    await db.run(
        `INSERT INTO equippedPets (userId, petId) VALUES (?, ?)`,
        [userId, petId]
    );
    PetCache.invalidate(userId, 'equipped');
}

async function unequipPet(userId, petId) {
    await db.run(
        `DELETE FROM equippedPets WHERE userId = ? AND petId = ?`,
        [userId, petId]
    );
    PetCache.invalidate(userId, 'equipped');
}

async function unequipAllPets(userId) {
    await db.run(`DELETE FROM equippedPets WHERE userId = ?`, [userId]);
    PetCache.invalidate(userId, 'equipped');
}

async function startHatching(userId, eggName, startedAt, hatchAt) {
    await db.run(
        `INSERT INTO hatchingEggs (userId, eggName, startedAt, hatchAt) VALUES (?, ?, ?, ?)`,
        [userId, eggName, startedAt, hatchAt]
    );
    PetCache.invalidate(userId, 'hatching');
}

async function deleteHatchingEgg(userId, eggId) {
    await db.run(`DELETE FROM hatchingEggs WHERE id = ?`, [eggId]);
    PetCache.invalidate(userId, 'hatching');
}

async function removeEgg(userId, eggName) {
    await db.run(
        `DELETE FROM petInventory WHERE userId = ? AND type = 'egg' AND name = ? LIMIT 1`,
        [userId, eggName]
    );
    PetCache.invalidate(userId, 'eggs');
}

async function addEgg(userId, eggName) {
    await db.run(
        `INSERT INTO petInventory (userId, name, type) VALUES (?, ?, 'egg')`,
        [userId, eggName]
    );
    PetCache.invalidate(userId, 'eggs');
}

module.exports = {
    getUserPets,
    getUserEggs,
    getEquippedPets,
    getHatchingEggs,
    insertPet,
    updatePet,
    deletePet,
    equipPet,
    unequipPet,
    unequipAllPets,
    startHatching,
    deleteHatchingEgg,
    removeEgg,
    addEgg
};