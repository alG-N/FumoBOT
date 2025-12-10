const db = require('../../Core/database');
const PetStats = require('./PetStatsService');
const PetBoost = require('./PetBoostService');

const MAX_WEIGHT = 5.0;
const MAX_QUALITY = 5.0;

async function givePassiveExp(petType, passiveExpPerSec) {
    const usersWithPet = await db.all(
        `SELECT DISTINCT e.userId
         FROM equippedPets e
         JOIN petInventory p ON e.petId = p.petId
         WHERE p.name = ?`,
        [petType]
    );

    for (const user of usersWithPet) {
        const equippedPets = await db.all(
            `SELECT p.*
             FROM equippedPets e
             JOIN petInventory p ON e.petId = p.petId
             WHERE e.userId = ? AND p.name = ?`,
            [user.userId, petType]
        );

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

        const userPets = await db.all(
            `SELECT * FROM petInventory WHERE userId = ? AND type = 'pet'`,
            [user.userId]
        );

        for (let pet of userPets) {
            pet.ageXp = (pet.ageXp || 0) + totalExpPerSec;
            let agedUp = false;

            while (true) {
                const xpRequired = PetStats.getXpRequired(pet.level || 1, pet.age || 1, pet.rarity || 'Common');
                
                if (pet.ageXp >= xpRequired) {
                    pet.ageXp -= xpRequired;
                    pet.age = (pet.age || 1) + 1;
                    agedUp = true;
                } else {
                    break;
                }
            }

            await db.run(
                `UPDATE petInventory SET age = ?, ageXp = ? WHERE petId = ?`,
                [pet.age, pet.ageXp, pet.petId]
            );

            if (agedUp) {
                const ability = PetStats.calculateBoost(pet);
                if (ability) {
                    await PetBoost.updatePetAbility(pet.petId, ability);
                }
            }
        }
    }
}

async function giveActiveExp(petType, baseActiveGain) {
    const usersWithPet = await db.all(
        `SELECT DISTINCT e.userId
         FROM equippedPets e
         JOIN petInventory p ON e.petId = p.petId
         WHERE p.name = ?`,
        [petType]
    );

    for (const user of usersWithPet) {
        const equippedPets = await db.all(
            `SELECT p.*
             FROM equippedPets e
             JOIN petInventory p ON e.petId = p.petId
             WHERE e.userId = ? AND p.name = ?`,
            [user.userId, petType]
        );

        for (let pet of equippedPets) {
            const level = pet.level || 1;
            let activeGain = baseActiveGain + level * 5;
            activeGain = Math.min(activeGain, baseActiveGain * 5);

            pet.ageXp = (pet.ageXp || 0) + activeGain;
            let agedUp = false;

            while (true) {
                const xpRequired = PetStats.getXpRequired(pet.level || 1, pet.age || 1, pet.rarity || 'Common');
                
                if (pet.ageXp >= xpRequired) {
                    pet.ageXp -= xpRequired;
                    pet.age = (pet.age || 1) + 1;
                    agedUp = true;
                } else {
                    break;
                }
            }

            await db.run(
                `UPDATE petInventory SET age = ?, ageXp = ? WHERE petId = ?`,
                [pet.age, pet.ageXp, pet.petId]
            );

            if (agedUp) {
                const ability = PetStats.calculateBoost(pet);
                if (ability) {
                    await PetBoost.updatePetAbility(pet.petId, ability);
                }
            }
        }
    }
}

async function handleEquippedPetAging() {
    const equippedPets = await db.all(
        `SELECT p.* FROM equippedPets e
         JOIN petInventory p ON e.petId = p.petId
         WHERE p.type = 'pet'`
    );
    
    for (let pet of equippedPets) {
        if (pet.name === "Owl" || pet.name === "NightOwl") continue;

        pet = PetStats.updateHunger(pet, true);

        if (pet.hunger > 0) {
            const baseXp = 1;
            const xpGain = pet.hunger > 90 ? baseXp * 2 : baseXp;
            pet.ageXp = (pet.ageXp || 0) + xpGain;

            pet.age = pet.age || 1;
            pet.level = pet.level || 1;
            pet.rarity = pet.rarity || 'Common';

            let agedUp = false;

            while (true) {
                const xpRequired = PetStats.getXpRequired(pet.level, pet.age, pet.rarity);

                if (pet.ageXp >= xpRequired) {
                    pet.ageXp -= xpRequired;
                    pet.age += 1;
                    agedUp = true;

                    if (pet.age % 5 === 0 && pet.weight < MAX_WEIGHT) {
                        const weightGain = Math.random() * (5.0 - 0.1) + 0.1;
                        pet.weight = Math.min(pet.weight + weightGain, MAX_WEIGHT);
                    }

                    if (pet.age % 10 === 0 && pet.quality < MAX_QUALITY) {
                        const qualityGain = Math.random() * (1.0 - 0.01) + 0.01;
                        pet.quality = Math.min(pet.quality + qualityGain, MAX_QUALITY);
                    }
                } else {
                    break;
                }
            }

            if (agedUp) {
                const ability = PetStats.calculateBoost(pet);
                if (ability) {
                    await PetBoost.updatePetAbility(pet.petId, ability);
                }
            }

            await db.run(
                `UPDATE petInventory SET age = ?, ageXp = ?, weight = ?, quality = ?, hunger = ?, lastHungerUpdate = ? WHERE petId = ?`,
                [pet.age, pet.ageXp, pet.weight, pet.quality, pet.hunger, pet.lastHungerUpdate, pet.petId]
            );
        }
    }
}

module.exports = {
    givePassiveExp,
    giveActiveExp,
    handleEquippedPetAging
};