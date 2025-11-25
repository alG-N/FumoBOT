const db = require('../../Database/db');
const { calculateBoost, getXpRequired, updateHunger } = require('../Utilities/petUtils');
const { dbAll, dbRun } = require('../Utilities/dbUtils');

// Import pet ability classes
const OwlAbility = require('../Abilities/OwlAbility');
const NightOwlAbility = require('../Abilities/NightOwlAbility');
// Add more pet abilities here as you create them:
// const BearAbility = require('./Abilities/BearAbility');
// const DragonAbility = require('./Abilities/DragonAbility');

// Constants
const MAX_WEIGHT = 5.0;
const MAX_QUALITY = 5.0;

// Initialize all background systems
function initializePetSystems() {
    // Standard pet aging for EQUIPPED pets only (1 second interval)
    setInterval(async () => {
        await handleEquippedPetAging();
    }, 1000);

    // Initialize special pet abilities
    const owlAbility = new OwlAbility();
    owlAbility.initialize();

    const nightOwlAbility = new NightOwlAbility();
    nightOwlAbility.initialize();

    // Initialize more pet abilities here:
    // const bearAbility = new BearAbility();
    // bearAbility.initialize();

    console.log("✅ Pet aging and ability systems initialized");
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
            // Skip pets with special ability systems (Owls handle their own exp)
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

module.exports = { initializePetSystems };