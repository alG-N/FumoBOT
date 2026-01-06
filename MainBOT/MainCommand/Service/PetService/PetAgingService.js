const db = require('../../Core/database');
const PetStats = require('./PetStatsService');
const PetBoost = require('./PetBoostService');

const MAX_AGE = 100;

/**
 * Optimized: Pre-fetch all data to avoid N+1 queries
 */
async function givePassiveExp(petType, passiveExpPerSec) {
    // Pre-fetch all required data in parallel
    const [usersWithEquippedPets, allUserPets] = await Promise.all([
        db.all(
            `SELECT e.userId, p.*
             FROM equippedPets e
             JOIN petInventory p ON e.petId = p.petId
             WHERE p.name = ?`,
            [petType]
        ),
        db.all(
            `SELECT pi.* FROM petInventory pi
             WHERE pi.type = 'pet' AND pi.userId IN (
                 SELECT DISTINCT e.userId FROM equippedPets e
                 JOIN petInventory p ON e.petId = p.petId
                 WHERE p.name = ?
             )`,
            [petType]
        )
    ]);

    // Group data by userId
    const userEquippedPets = new Map();
    const userPetsMap = new Map();

    for (const row of usersWithEquippedPets) {
        if (!userEquippedPets.has(row.userId)) {
            userEquippedPets.set(row.userId, []);
        }
        userEquippedPets.set(row.userId, [...userEquippedPets.get(row.userId), row]);
    }

    for (const pet of allUserPets) {
        if (!userPetsMap.has(pet.userId)) {
            userPetsMap.set(pet.userId, []);
        }
        userPetsMap.get(pet.userId).push(pet);
    }

    // Batch updates
    const updates = [];
    const abilityUpdates = [];

    for (const [userId, equippedPets] of userEquippedPets) {
        let totalExpPerSec = 0;
        
        for (const pet of equippedPets) {
            let ability = pet.ability;
            if (!ability || typeof ability === "string") {
                try {
                    ability = JSON.parse(ability);
                } catch {
                    ability = PetStats.calculateBoost(pet);
                }
            }
            if (ability?.amount?.passive) {
                totalExpPerSec += ability.amount.passive;
            }
        }

        if (totalExpPerSec === 0) continue;

        const userPets = userPetsMap.get(userId) || [];
        for (let pet of userPets) {
            pet.ageXp = (pet.ageXp || 0) + totalExpPerSec;
            let agedUp = false;

            while (pet.age < MAX_AGE) {
                const xpRequired = PetStats.getXpRequired(pet.level || 1, pet.age || 1, pet.rarity || 'Common');
                if (pet.ageXp >= xpRequired) {
                    pet.ageXp -= xpRequired;
                    pet.age = (pet.age || 1) + 1;
                    agedUp = true;
                } else {
                    break;
                }
            }

            updates.push({
                sql: `UPDATE petInventory SET age = ?, ageXp = ? WHERE petId = ?`,
                params: [pet.age, pet.ageXp, pet.petId]
            });

            if (agedUp) {
                const ability = PetStats.calculateBoost(pet);
                if (ability) {
                    abilityUpdates.push({ petId: pet.petId, ability });
                }
            }
        }
    }

    // Execute batch updates
    if (updates.length > 0) {
        await db.transaction(updates);
    }

    // Update abilities (can be done in parallel)
    await Promise.all(abilityUpdates.map(u => PetBoost.updatePetAbility(u.petId, u.ability)));
}

/**
 * Optimized: Pre-fetch all data and batch updates
 */
async function giveActiveExp(petType, baseActiveGain) {
    // Pre-fetch all equipped pets of this type with their full data
    const allEquippedPets = await db.all(
        `SELECT e.userId, p.*
         FROM equippedPets e
         JOIN petInventory p ON e.petId = p.petId
         WHERE p.name = ?`,
        [petType]
    );

    const updates = [];
    const abilityUpdates = [];

    for (let pet of allEquippedPets) {
        const level = pet.level || 1;
        let activeGain = baseActiveGain + level * 5;
        activeGain = Math.min(activeGain, baseActiveGain * 5);

        pet.ageXp = (pet.ageXp || 0) + activeGain;
        let agedUp = false;

        while (pet.age < MAX_AGE) {
            const xpRequired = PetStats.getXpRequired(pet.level || 1, pet.age || 1, pet.rarity || 'Common');
            
            if (pet.ageXp >= xpRequired) {
                pet.ageXp -= xpRequired;
                pet.age = (pet.age || 1) + 1;
                agedUp = true;
            } else {
                break;
            }
        }

        updates.push({
            sql: `UPDATE petInventory SET age = ?, ageXp = ? WHERE petId = ?`,
            params: [pet.age, pet.ageXp, pet.petId]
        });

        if (agedUp) {
            const ability = PetStats.calculateBoost(pet);
            if (ability) {
                abilityUpdates.push({ petId: pet.petId, ability });
            }
        }
    }

    // Batch execute all updates
    if (updates.length > 0) {
        await db.transaction(updates);
    }

    // Update abilities in parallel
    await Promise.all(abilityUpdates.map(u => PetBoost.updatePetAbility(u.petId, u.ability)));
}

/**
 * Optimized: Batch updates for equipped pet aging
 */
async function handleEquippedPetAging() {
    const equippedPets = await db.all(
        `SELECT p.* FROM equippedPets e
         JOIN petInventory p ON e.petId = p.petId
         WHERE p.type = 'pet'`
    );
    
    const updates = [];
    const abilityUpdates = [];
    
    for (let pet of equippedPets) {
        if (pet.name === "Owl" || pet.name === "NightOwl") continue;

        pet = PetStats.updateHunger(pet, true);

        if (pet.hunger > 0 && pet.age < MAX_AGE) {
            const baseXp = 1;
            const xpGain = pet.hunger > 90 ? baseXp * 2 : baseXp;
            pet.ageXp = (pet.ageXp || 0) + xpGain;

            pet.age = pet.age || 1;
            pet.level = pet.level || 1;
            pet.rarity = pet.rarity || 'Common';

            let agedUp = false;
            const maxWeight = PetStats.getMaxWeight(pet.baseWeight || pet.weight);

            while (pet.age < MAX_AGE) {
                const xpRequired = PetStats.getXpRequired(pet.level, pet.age, pet.rarity);

                if (pet.ageXp >= xpRequired) {
                    pet.ageXp -= xpRequired;
                    pet.age += 1;
                    agedUp = true;

                    if (pet.age % 5 === 0 && pet.weight < maxWeight) {
                        const weightGain = Math.random() * (5.0 - 0.1) + 0.1;
                        pet.weight = Math.min(pet.weight + weightGain, maxWeight);
                    }

                    if (pet.age % 10 === 0 && pet.quality < 5.0) {
                        const qualityGain = Math.random() * (1.0 - 0.01) + 0.01;
                        pet.quality = Math.min(pet.quality + qualityGain, 5.0);
                    }
                } else {
                    break;
                }
            }

            if (agedUp) {
                const ability = PetStats.calculateBoost(pet);
                if (ability) {
                    abilityUpdates.push({ petId: pet.petId, ability });
                }
            }

            updates.push({
                sql: `UPDATE petInventory SET age = ?, ageXp = ?, weight = ?, quality = ?, hunger = ?, lastHungerUpdate = ? WHERE petId = ?`,
                params: [pet.age, pet.ageXp, pet.weight, pet.quality, pet.hunger, pet.lastHungerUpdate, pet.petId]
            });
        }
    }
    
    // Batch execute all updates
    if (updates.length > 0) {
        await db.transaction(updates);
    }

    // Update abilities in parallel
    await Promise.all(abilityUpdates.map(u => PetBoost.updatePetAbility(u.petId, u.ability)));
}

module.exports = {
    givePassiveExp,
    giveActiveExp,
    handleEquippedPetAging
};