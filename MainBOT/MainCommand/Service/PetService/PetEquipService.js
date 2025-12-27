const PetDatabase = require('./PetDatabaseService');
const PetBoost = require('./PetBoostService');
const PetStats = require('./PetStatsService');

async function equipPet(userId, petId) {
    const [equipped, pets] = await Promise.all([
        PetDatabase.getEquippedPets(userId, false),
        PetDatabase.getUserPets(userId, false)
    ]);
    
    if (equipped.length >= 5) {
        return { success: false, error: 'MAX_EQUIPPED' };
    }
    
    const pet = pets.find(p => p.petId === petId);
    if (!pet) {
        return { success: false, error: 'PET_NOT_FOUND' };
    }
    
    if (equipped.some(p => p.petId === petId)) {
        return { success: false, error: 'ALREADY_EQUIPPED' };
    }
    
    // Ensure pet has an ability before equipping
    const updatedPet = await PetStats.ensurePetHasAbility(pet);
    
    await PetDatabase.equipPet(userId, petId);
    
    const ability = PetStats.calculateBoost(updatedPet);
    if (ability) {
        await PetBoost.updatePetAbility(petId, ability);
    }
    
    await PetBoost.refreshBoosts(userId);
    
    return { success: true, pet: updatedPet };
}

async function unequipPet(userId, petId) {
    await PetDatabase.unequipPet(userId, petId);
    await PetBoost.refreshBoosts(userId);
    
    return { success: true };
}

async function equipBestPets(userId) {
    const pets = await PetDatabase.getUserPets(userId, false);
    
    if (pets.length === 0) {
        return { success: false, error: 'NO_PETS' };
    }
    
    const scored = pets.map(p => ({
        ...p,
        score: (p.quality + p.weight) * (p.age || 1) * (p.level || 1)
    }));
    
    const best = scored.sort((a, b) => b.score - a.score).slice(0, 5);
    
    await PetDatabase.unequipAllPets(userId);
    
    for (const pet of best) {
        // Ensure each pet has an ability
        const updatedPet = await PetStats.ensurePetHasAbility(pet);
        
        await PetDatabase.equipPet(userId, pet.petId);
        
        const ability = PetStats.calculateBoost(updatedPet);
        if (ability) {
            await PetBoost.updatePetAbility(pet.petId, ability);
        }
    }
    
    await PetBoost.applyPetBoosts(userId, best);
    
    return { success: true, pets: best };
}

async function unequipAll(userId) {
    await PetDatabase.unequipAllPets(userId);
    await PetBoost.clearPetBoosts(userId);
    
    return { success: true };
}

async function equipByName(userId, petName) {
    const [pets, equipped] = await Promise.all([
        PetDatabase.getUserPets(userId, false),
        PetDatabase.getEquippedPets(userId, false)
    ]);
    
    const matches = pets.filter(p => 
        p.petName.toLowerCase() === petName.toLowerCase()
    );
    
    if (matches.length === 0) {
        return { success: false, error: 'NO_PETS_FOUND' };
    }
    
    const available = matches.filter(p => 
        !equipped.some(e => e.petId === p.petId)
    );
    
    if (available.length === 0) {
        return { success: false, error: 'ALL_EQUIPPED' };
    }
    
    if (equipped.length >= 5) {
        return { success: false, error: 'MAX_EQUIPPED' };
    }
    
    if (available.length > 1) {
        return { success: false, error: 'MULTIPLE_FOUND', pets: available };
    }
    
    return await equipPet(userId, available[0].petId);
}

async function unequipByName(userId, petName) {
    const equipped = await PetDatabase.getEquippedPets(userId, false);
    
    const matches = equipped.filter(p => 
        p.petName.toLowerCase() === petName.toLowerCase()
    );
    
    if (matches.length === 0) {
        return { success: false, error: 'NOT_EQUIPPED' };
    }
    
    if (matches.length > 1) {
        return { success: false, error: 'MULTIPLE_FOUND', pets: matches };
    }
    
    return await unequipPet(userId, matches[0].petId);
}

module.exports = {
    equipPet,
    unequipPet,
    equipBestPets,
    unequipAll,
    equipByName,
    unequipByName
};