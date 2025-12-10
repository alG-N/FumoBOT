const { PET_ABILITIES, HUNGER_CONFIG, RARITY_TIERS } = require('../../Configuration/petConfig');

function calculateBoost(pet) {
    const quality = (pet.quality || 1) * (hasAlterGoldenBonus(pet.petName) ? 2 : 1);
    const weight = (pet.weight || 1) * (hasAlterGoldenBonus(pet.petName) ? 2 : 1);
    const level = pet.level || 1;
    const age = pet.age || 1;

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

function updateHunger(pet, isEquipped = false) {
    if (!isEquipped) return pet;

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

    return pet;
}

function hasAlterGoldenBonus(petName) {
    return petName === 'alterGolden';
}

function getRandomWeight() {
    return parseFloat((Math.random() * 4 + 1).toFixed(2));
}

function getRandomQuality() {
    return parseFloat((Math.random() * 4 + 1).toFixed(2));
}

function generatePetName() {
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

    if (Math.random() < 0.001) return 'alterGolden';
    return PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)];
}

function pickRandomPet(eggName, eggPools) {
    const pool = eggPools[eggName];
    if (!pool) return null;

    const roll = Math.random() * 100;
    let cumulative = 0;

    for (const pet of pool) {
        cumulative += pet.chance;
        if (roll <= cumulative) return pet;
    }

    return pool[pool.length - 1];
}

module.exports = {
    calculateBoost,
    getXpRequired,
    getMaxHunger,
    getHungerDuration,
    updateHunger,
    hasAlterGoldenBonus,
    getRandomWeight,
    getRandomQuality,
    generatePetName,
    pickRandomPet
};