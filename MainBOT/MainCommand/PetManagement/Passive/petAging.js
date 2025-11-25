const db = require('../../Database/db');
const { calculateBoost, getXpRequired, updateHunger } = require('../Utilities/petUtils');
const { dbAll, dbRun } = require('../Utilities/dbUtils');

// Constants
const MAX_WEIGHT = 5.0;
const MAX_QUALITY = 5.0;

// Initialize all background systems
function initializePetSystems() {
    // Standard pet aging for EQUIPPED pets only (1 second interval)
    setInterval(async () => {
        await handleEquippedPetAging();
    }, 1000);

    // Owl passive exp bonus (1 second interval)
    setInterval(async () => {
        await handleOwlPassiveExp();
    }, 1000);

    // Owl active exp gain (15 minute interval)
    setInterval(async () => {
        await handleOwlActiveExp();
    }, 15 * 60 * 1000);

    console.log("✅ Pet aging and Owl systems initialized");
}

// Handle aging for EQUIPPED pets only (hunger-based exp gain)
async function handleEquippedPetAging() {
    try {
        // Only get equipped pets
        const equippedPets = await dbAll(db, `
            SELECT p.* FROM equippedPets e
            JOIN petInventory p ON e.petId = p.petId
            WHERE p.type = 'pet'
        `);
        
        for (let pet of equippedPets) {
            // Skip Owls (they have their own system)
            if (pet.name === "Owl" || pet.name === "NightOwl") continue;

            // Update hunger (only equipped pets lose hunger)
            pet = updateHunger(pet, db, true);

            // Only gain exp if hunger > 0
            if (pet.hunger > 0) {
                const baseXp = 1;
                const xpGain = pet.hunger > 90 ? baseXp * 2 : baseXp;
                pet.ageXp = (pet.ageXp || 0) + xpGain;

                pet.age = pet.age || 1;
                pet.level = pet.level || 1;
                pet.rarity = pet.rarity || 'Common';

                let agedUp = false;

                // Level up loop
                while (true) {
                    const xpRequired = getXpRequired(pet.level, pet.age, pet.rarity);

                    if (pet.ageXp >= xpRequired) {
                        pet.ageXp -= xpRequired;
                        pet.age += 1;
                        agedUp = true;

                        // Every 5 ages: increase weight
                        if (pet.age % 5 === 0 && pet.weight < MAX_WEIGHT) {
                            const weightGain = Math.random() * (5.0 - 0.1) + 0.1;
                            pet.weight = Math.min(pet.weight + weightGain, MAX_WEIGHT);
                        }

                        // Every 10 ages: increase quality
                        if (pet.age % 10 === 0 && pet.quality < MAX_QUALITY) {
                            const qualityGain = Math.random() * (1.0 - 0.01) + 0.01;
                            pet.quality = Math.min(pet.quality + qualityGain, MAX_QUALITY);
                        }
                    } else {
                        break;
                    }
                }

                // Update ability if aged up
                if (agedUp) {
                    const ability = calculateBoost(pet);
                    if (ability) {
                        await dbRun(db, 
                            `UPDATE petInventory SET ability = ? WHERE petId = ?`,
                            [JSON.stringify(ability), pet.petId]
                        );
                    }
                }

                // Update pet stats
                await dbRun(db,
                    `UPDATE petInventory SET age = ?, ageXp = ?, weight = ?, quality = ? WHERE petId = ?`,
                    [pet.age, pet.ageXp, pet.weight, pet.quality, pet.petId]
                );
            }
        }
    } catch (error) {
        console.error("❌ Error in equipped pet aging:", error);
    }
}

// Handle Owl passive exp bonus (all equipped Owls give exp/sec to all user's pets)
async function handleOwlPassiveExp() {
    try {
        const usersWithOwl = await dbAll(db, `
            SELECT DISTINCT e.userId
            FROM equippedPets e
            JOIN petInventory p ON e.petId = p.petId
            WHERE p.name IN ('Owl', 'NightOwl')
        `);

        for (const user of usersWithOwl) {
            // Get all equipped Owls for this user
            const equippedOwls = await dbAll(db, `
                SELECT p.*
                FROM equippedPets e
                JOIN petInventory p ON e.petId = p.petId
                WHERE e.userId = ? AND p.name IN ('Owl', 'NightOwl')
            `, [user.userId]);

            // Calculate total exp/sec from all equipped Owls
            let totalExpPerSec = 0;
            for (const owl of equippedOwls) {
                let ability = owl.ability;
                
                if (!ability || typeof ability === "string") {
                    try {
                        ability = JSON.parse(ability);
                    } catch {
                        ability = calculateBoost(owl);
                    }
                }

                if (ability && ability.amount && typeof ability.amount.passive === "number") {
                    totalExpPerSec += ability.amount.passive;
                }
            }

            if (totalExpPerSec === 0) continue;

            // Give exp to all pets (not eggs) owned by this user
            const userPets = await dbAll(db, `
                SELECT * FROM petInventory
                WHERE userId = ? AND type = 'pet'
            `, [user.userId]);

            for (let pet of userPets) {
                pet.ageXp = (pet.ageXp || 0) + totalExpPerSec;
                let agedUp = false;

                while (true) {
                    const xpRequired = getXpRequired(pet.level || 1, pet.age || 1, pet.rarity || 'Common');
                    
                    if (pet.ageXp >= xpRequired) {
                        pet.ageXp -= xpRequired;
                        pet.age = (pet.age || 1) + 1;
                        agedUp = true;
                    } else {
                        break;
                    }
                }

                await dbRun(db,
                    `UPDATE petInventory SET age = ?, ageXp = ? WHERE petId = ?`,
                    [pet.age, pet.ageXp, pet.petId]
                );

                // Update ability if aged up
                if (agedUp) {
                    const ability = calculateBoost(pet);
                    if (ability) {
                        await dbRun(db,
                            `UPDATE petInventory SET ability = ? WHERE petId = ?`,
                            [JSON.stringify(ability), pet.petId]
                        );
                    }
                }
            }
        }
    } catch (error) {
        console.error("❌ Error in Owl passive exp:", error);
    }
}

// Handle Owl active exp gain (each equipped Owl gains exp for itself)
async function handleOwlActiveExp() {
    try {
        const usersWithOwl = await dbAll(db, `
            SELECT DISTINCT e.userId
            FROM equippedPets e
            JOIN petInventory p ON e.petId = p.petId
            WHERE p.name IN ('Owl', 'NightOwl')
        `);

        for (const user of usersWithOwl) {
            const equippedOwls = await dbAll(db, `
                SELECT p.*
                FROM equippedPets e
                JOIN petInventory p ON e.petId = p.petId
                WHERE e.userId = ? AND p.name IN ('Owl', 'NightOwl')
            `, [user.userId]);

            for (let owl of equippedOwls) {
                const level = owl.level || 1;
                let activeGain = 150 + level * 5;
                activeGain = Math.min(activeGain, 750);

                owl.ageXp = (owl.ageXp || 0) + activeGain;
                let agedUp = false;

                while (true) {
                    const xpRequired = getXpRequired(owl.level || 1, owl.age || 1, owl.rarity || 'Common');
                    
                    if (owl.ageXp >= xpRequired) {
                        owl.ageXp -= xpRequired;
                        owl.age = (owl.age || 1) + 1;
                        agedUp = true;
                    } else {
                        break;
                    }
                }

                await dbRun(db,
                    `UPDATE petInventory SET age = ?, ageXp = ? WHERE petId = ?`,
                    [owl.age, owl.ageXp, owl.petId]
                );

                // Update ability if aged up
                if (agedUp) {
                    const ability = calculateBoost(owl);
                    if (ability) {
                        await dbRun(db,
                            `UPDATE petInventory SET ability = ? WHERE petId = ?`,
                            [JSON.stringify(ability), owl.petId]
                        );
                    }
                }
            }
        }
    } catch (error) {
        console.error("❌ Error in Owl active exp:", error);
    }
}

module.exports = { initializePetSystems };