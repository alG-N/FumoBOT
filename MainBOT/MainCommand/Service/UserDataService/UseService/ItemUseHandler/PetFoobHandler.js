const { get, all, run, transaction } = require('../../../../Core/database');

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

function getHungerDuration(rarity) {
    const durationMap = {
        Common: 12,
        Rare: 15,
        Epic: 18,
        Legendary: 24,
        Mythical: 30,
        Divine: 36
    };
    return (durationMap[rarity] || 12) * 60 * 60; // Convert hours to seconds
}

function calculateCurrentHunger(pet) {
    const maxHunger = getMaxHunger(pet.rarity || 'Common');
    const durationSeconds = getHungerDuration(pet.rarity || 'Common');
    const currentTime = Math.floor(Date.now() / 1000);
    const lastUpdate = pet.lastHungerUpdate || currentTime;
    const elapsedSeconds = currentTime - lastUpdate;
    
    // Calculate hunger decay
    const hungerPerSecond = maxHunger / durationSeconds;
    const hungerLost = hungerPerSecond * elapsedSeconds;
    
    // Current hunger = stored hunger - decay
    const currentHunger = Math.max(0, (pet.hunger || 0) - hungerLost);
    
    return Math.floor(currentHunger);
}

async function handlePetFoob(message, itemName, quantity, userId) {
    try {
        console.log('\n=== PET FOOB DEBUG START ===');
        console.log(`User ID: ${userId}`);
        console.log(`Item: ${itemName}, Quantity: ${quantity}`);

        // Fetch pets
        const hungryPets = await all(
            `SELECT * FROM petInventory 
             WHERE userId = ? AND type = 'pet' 
             ORDER BY hunger ASC`,
            [userId]
        );

        console.log(`\n📊 Fetched ${hungryPets?.length || 0} pets from database`);
        
        if (!hungryPets || hungryPets.length === 0) {
            console.log('❌ No pets found');
            return message.reply("❌ You don't have any pets.");
        }

        // Log all pets with their hunger values
        console.log('\n🐾 All pets with REAL-TIME hunger:');
        hungryPets.forEach((pet, idx) => {
            const currentHunger = calculateCurrentHunger(pet);
            const maxHunger = getMaxHunger(pet.rarity);
            const percentage = ((currentHunger / maxHunger) * 100).toFixed(1);
            
            console.log(`  ${idx + 1}. ${pet.name} "${pet.petName}"`);
            console.log(`     - Stored hunger: ${pet.hunger}`);
            console.log(`     - Current hunger: ${currentHunger}/${maxHunger} (${percentage}%)`);
            console.log(`     - Last update: ${pet.lastHungerUpdate}`);
            console.log(`     - Rarity: ${pet.rarity}`);
        });

        const petsToFeed = [];
        let foodUsed = 0;

        console.log('\n🍖 Processing pets for feeding:');
        for (const pet of hungryPets) {
            if (foodUsed >= quantity) {
                console.log(`  ⏭️ Skipping ${pet.name} - Already used ${foodUsed}/${quantity} food`);
                break;
            }

            const maxHunger = getMaxHunger(pet.rarity || 'Common');
            const currentHunger = calculateCurrentHunger(pet);
            
            console.log(`\n  🔍 Checking ${pet.name} "${pet.petName}":`);
            console.log(`     - Current hunger: ${currentHunger}`);
            console.log(`     - Max hunger: ${maxHunger}`);
            console.log(`     - Needs food? ${currentHunger < maxHunger}`);
            
            // Pet needs food if current hunger (with decay) is less than max
            if (currentHunger < maxHunger) {
                console.log(`     ✅ Adding to feed list`);
                petsToFeed.push({
                    petId: pet.petId,
                    name: pet.name,
                    petName: pet.petName,
                    currentHunger: currentHunger,
                    maxHunger: maxHunger,
                    rarity: pet.rarity
                });
                foodUsed++;
            } else {
                console.log(`     ❌ Pet is already full`);
            }
        }

        console.log(`\n📋 Summary: ${petsToFeed.length} pets to feed, ${foodUsed} food will be used`);

        if (petsToFeed.length === 0) {
            console.log('❌ No pets need feeding!');
            console.log('=== PET FOOB DEBUG END ===\n');
            return message.reply(
                "❌ All your pets are already full!\n\n" +
                "**Debug Info:**\n" +
                `- Total pets: ${hungryPets.length}\n` +
                `- Pets that need food: 0\n\n` +
                "Your pets are healthy! 🐾"
            );
        }

        // Feed the pets - update to current time and set to max hunger
        console.log('\n🍽️ Feeding pets:');
        const fedPets = [];
        const currentTime = Math.floor(Date.now() / 1000);
        
        // OPTIMIZED: Build all operations and execute in single transaction
        const operations = [];
        
        for (const pet of petsToFeed) {
            console.log(`  Feeding ${pet.name} "${pet.petName}": ${pet.currentHunger} → ${pet.maxHunger}`);
            
            // Set hunger to max and update the timestamp
            operations.push({
                sql: `UPDATE petInventory SET hunger = ?, lastHungerUpdate = ? WHERE petId = ?`,
                params: [pet.maxHunger, currentTime, pet.petId]
            });
            
            fedPets.push(pet);
        }
        
        // Execute all updates in single transaction
        if (operations.length > 0) {
            await transaction(operations);
        }

        console.log(`\n✅ Successfully fed ${fedPets.length} pets`);
        console.log('=== PET FOOB DEBUG END ===\n');

        const petList = fedPets.map(p => 
            `**${p.name}** "${p.petName}" (${p.currentHunger} → ${p.maxHunger}) 🍖`
        ).join('\n');

        message.reply(
            `✅ Fed ${fedPets.length} pet${fedPets.length > 1 ? 's' : ''}!\n\n${petList}\n\n` +
            `🍖 Used ${foodUsed} PetFoob(B)`
        );

    } catch (error) {
        console.error('\n💥 [PET_FOOB] Error:', error);
        console.error('Stack trace:', error.stack);
        console.log('=== PET FOOB DEBUG END (ERROR) ===\n');
        message.reply('❌ Failed to feed your pets. Error: ' + error.message);
    }
}

module.exports = { handlePetFoob };