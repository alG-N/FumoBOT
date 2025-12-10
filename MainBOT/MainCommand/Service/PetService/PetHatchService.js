const { v4: uuidv4 } = require('uuid');
const { EGG_DATA, EGG_POOLS } = require('../../Configuration/petConfig');
const PetDatabase = require('./PetDatabaseService');
const PetStats = require('./PetStatsService');

async function startHatching(userId, eggName) {
    const now = Date.now();
    const hatchAt = now + EGG_DATA[eggName].time;
    
    await PetDatabase.removeEgg(userId, eggName);
    await PetDatabase.startHatching(userId, eggName, now, hatchAt);
    
    return { startedAt: now, hatchAt };
}

async function cancelHatching(userId, eggId, eggName) {
    await PetDatabase.deleteHatchingEgg(userId, eggId);
    await PetDatabase.addEgg(userId, eggName);
}

async function hatchEgg(userId, eggName) {
    const chosen = PetStats.pickRandomPet(eggName, EGG_POOLS);
    if (!chosen) throw new Error('Invalid egg type');
    
    const weight = PetStats.getRandomWeight();
    const quality = PetStats.getRandomQuality();
    const petName = PetStats.generatePetName();
    const timestamp = Date.now();
    const petId = uuidv4();
    const maxHunger = PetStats.getMaxHunger(chosen.rarity);

    let finalWeight = weight;
    let finalQuality = quality;
    
    if (PetStats.hasAlterGoldenBonus(petName)) {
        finalWeight = weight * 2;
        finalQuality = Math.min(quality * 2, 5);
    }

    const petData = {
        petId,
        userId,
        type: 'pet',
        name: chosen.name,
        petName,
        rarity: chosen.rarity,
        weight: finalWeight,
        age: 1,
        quality: finalQuality,
        timestamp,
        level: 1,
        hunger: maxHunger,
        ageXp: 0,
        lastHungerUpdate: Math.floor(timestamp / 1000),
        baseWeight: weight
    };

    await PetDatabase.insertPet(petData);
    
    return {
        pet: petData,
        chosen,
        hasAlterGolden: PetStats.hasAlterGoldenBonus(petName)
    };
}

async function hatchAllReady(userId) {
    const [eggs, hatching] = await Promise.all([
        PetDatabase.getUserEggs(userId, false),
        PetDatabase.getHatchingEggs(userId, false)
    ]);

    let slotsLeft = 5 - hatching.length;
    if (slotsLeft <= 0) return { success: false, error: 'NO_SLOTS' };

    const results = [];
    
    for (const egg of eggs) {
        if (slotsLeft <= 0) break;
        
        const count = Math.min(egg.count, slotsLeft);
        
        for (let i = 0; i < count; i++) {
            const { startedAt, hatchAt } = await startHatching(userId, egg.name);
            results.push({ name: egg.name, hatchAt });
            slotsLeft--;
            if (slotsLeft <= 0) break;
        }
    }

    return { success: true, hatched: results };
}

async function checkReadyEggs(userId) {
    const hatching = await PetDatabase.getHatchingEggs(userId, false);
    const now = Date.now();
    
    return hatching.map(egg => ({
        ...egg,
        ready: egg.hatchAt <= now
    }));
}

module.exports = {
    startHatching,
    cancelHatching,
    hatchEgg,
    hatchAllReady,
    checkReadyEggs
};