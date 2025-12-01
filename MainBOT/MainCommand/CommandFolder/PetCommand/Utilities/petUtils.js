const { HUNGER_CONFIG, RARITY_TIERS, EGG_POOLS, PET_ABILITIES } = require('../Configuration/petConfig');

const PET_NAMES = [
    'Jack', 'Bob', 'Timmy', 'Max', 'Charlie', 'Buddy', 'Rocky', 'Duke',
    'Bailey', 'Cooper', 'Tucker', 'Bear', 'Oliver', 'Toby', 'Leo', 'Milo',
    'Zeus', 'Bentley', 'Lucky', 'Oscar', 'Sam', 'Shadow', 'Jake', 'Buster',
    'Cody', 'Winston', 'Thor', 'Murphy', 'Jasper', 'Henry', 'Finn', 'Gus',
    'Luna', 'Bella', 'Daisy', 'Lucy', 'Molly', 'Sadie', 'Sophie', 'Chloe',
    'Lily', 'Zoe', 'Penny', 'Nala', 'Stella', 'Ruby', 'Rosie', 'Maggie',
    'Coco', 'Lola', 'Pepper', 'Piper', 'Princess', 'Angel', 'Willow', 'Roxy',
    'Cookie', 'Mia', 'Emma', 'Honey', 'Gracie', 'Ellie', 'Maya', 'Athena'
];

function generatePetName() {
    const roll = Math.random();
    if (roll < 0.001) {
        return 'alterGolden';
    }
    return PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)];
}

function hasAlterGoldenBonus(petName) {
    return petName === 'alterGolden';
}

function applyAlterGoldenBonus(pet) {
    if (hasAlterGoldenBonus(pet.petName)) {
        return {
            ...pet,
            weight: pet.weight * 2,
            quality: Math.min(pet.quality * 2, 5),
            _hasAlterGolden: true
        };
    }
    return pet;
}

function getXpRequired(level, age, rarity) {
    const rarityIndex = RARITY_TIERS.indexOf(rarity) + 1 || 1;
    const baseXp = 100;
    return Math.floor(baseXp * Math.pow(age, 1.2) * Math.pow(level, 0.8) * rarityIndex);
}

function getMaxHunger(rarity) {
    return HUNGER_CONFIG[rarity]?.max || HUNGER_CONFIG.Common.max;
}

function getHungerDuration(rarity) {
    return HUNGER_CONFIG[rarity]?.duration || HUNGER_CONFIG.Common.duration;
}

function getRandomWeight() {
    return parseFloat((Math.random() * 4 + 1).toFixed(2));
}

function getRandomQuality() {
    return parseFloat((Math.random() * 4 + 1).toFixed(2));
}

function pickRandomPet(eggName, eggPools) {
    const pool = eggPools[eggName];
    if (!pool) return null;

    const roll = Math.random() * 100;
    let cumulative = 0;

    for (const pet of pool) {
        cumulative += pet.chance;
        if (roll <= cumulative) {
            return pet;
        }
    }

    return pool[pool.length - 1];
}

function calculateBoost(pet) {
    let quality = pet.quality || 1;
    let weight = pet.weight || 1;
    const level = pet.level || 1;
    const age = pet.age || 1;

    if (hasAlterGoldenBonus(pet.petName)) {
        quality *= 2;
        weight *= 2;
    }

    const abilityData = PET_ABILITIES[pet.name];
    if (!abilityData) return null;

    const { stat, base, max, type } = abilityData;

    if (type === 'percent' || type === 'multiplier') {
        const factor = ((weight + quality) * Math.log(age + 1) * Math.sqrt(level)) / 20;
        const boost = Math.min(base + factor, max);
        return { 
            type: stat, 
            amount: boost, 
            boostType: type,
            abilityName: abilityData.abilityName 
        };
    }

    if (type === 'interval-chance') {
        const chance = Math.min(base + (weight + quality) * Math.sqrt(level), max);
        return {
            type: stat,
            amount: { interval: abilityData.interval, chance },
            boostType: type,
            abilityName: abilityData.abilityName
        };
    }

    if (type === 'passive') {
        const passive = Math.min(
            base + ((quality + weight) * Math.log(age + 1) * Math.sqrt(level)) / 30, 
            max
        );
        const activeGain = Math.min(abilityData.activeGain + level * 5, abilityData.maxGain);
        return {
            type: stat,
            amount: {
                passive,
                activeInterval: abilityData.activeInterval,
                activeGain
            },
            boostType: type,
            abilityName: abilityData.abilityName
        };
    }

    return null;
}

function updateHunger(pet, db, isEquipped = false) {
    if (!isEquipped) {
        return pet;
    }

    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - (pet.lastHungerUpdate || now);
    if (elapsed <= 0) return pet;

    const maxHunger = getMaxHunger(pet.rarity);
    const durationHours = getHungerDuration(pet.rarity);
    const hungerLossPerSecond = maxHunger / (durationHours * 3600);

    const startingHunger = typeof pet.hunger === "number" ? pet.hunger : maxHunger;
    const totalHungerLoss = elapsed * hungerLossPerSecond;

    pet.hunger = Math.max(0, parseFloat((startingHunger - totalHungerLoss).toFixed(2)));
    pet.lastHungerUpdate = now;

    if (db) {
        db.run(
            `UPDATE petInventory SET hunger = ?, lastHungerUpdate = ? WHERE petId = ?`,
            [pet.hunger, now, pet.petId]
        );
    }

    return pet;
}

module.exports = {
    calculateBoost,
    getXpRequired,
    getMaxHunger,
    getHungerDuration,
    updateHunger,
    getRandomWeight,
    getRandomQuality,
    pickRandomPet,
    generatePetName,
    hasAlterGoldenBonus,
    applyAlterGoldenBonus
};