const PetAbilityHandler = require('./PetAbilityHandler');
const PetAgingService = require('./PetAgingService');
const db = require('../../Core/database');

const INTERVALS = new Map();
const LAST_ITEM_DROP = new Map();

async function getAllEquippedUsers() {
    return await db.all(
        `SELECT DISTINCT userId FROM equippedPets`,
        []
    );
}

function startItemChanceInterval() {
    if (INTERVALS.has('itemChance')) return;

    const interval = setInterval(async () => {
        try {
            const users = await getAllEquippedUsers();

            for (const { userId } of users) {
                const now = Date.now();
                const lastDrop = LAST_ITEM_DROP.get(userId) || 0;
                
                const pets = await PetAbilityHandler.getActiveItemChancePets(userId);
                
                for (const pet of pets) {
                    let ability;
                    try {
                        ability = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
                    } catch {
                        continue;
                    }

                    if (now - lastDrop >= ability.amount.interval) {
                        await PetAbilityHandler.handleItemChanceAbility(userId, pet.name, ability);
                        LAST_ITEM_DROP.set(userId, now);
                    }
                }
            }
        } catch (error) {
            console.error('Error in item chance interval:', error);
        }
    }, 60000);

    INTERVALS.set('itemChance', interval);
}

function startPassiveExpInterval() {
    if (INTERVALS.has('passiveExp')) return;

    const interval = setInterval(async () => {
        try {
            await PetAgingService.givePassiveExp('Owl', 1);
            await PetAgingService.givePassiveExp('NightOwl', 1);
        } catch (error) {
            console.error('Error in passive exp interval:', error);
        }
    }, 1000);

    INTERVALS.set('passiveExp', interval);
}

function startActiveExpInterval() {
    if (INTERVALS.has('activeExp')) return;

    const interval = setInterval(async () => {
        try {
            await PetAgingService.giveActiveExp('Owl', 150);
            await PetAgingService.giveActiveExp('NightOwl', 200);
        } catch (error) {
            console.error('Error in active exp interval:', error);
        }
    }, 15 * 60 * 1000);

    INTERVALS.set('activeExp', interval);
}

function startNightOwlActiveExpInterval() {
    if (INTERVALS.has('nightOwlActiveExp')) return;

    const interval = setInterval(async () => {
        try {
            await PetAgingService.giveActiveExp('NightOwl', 200);
        } catch (error) {
            console.error('Error in night owl active exp interval:', error);
        }
    }, 12 * 60 * 1000);

    INTERVALS.set('nightOwlActiveExp', interval);
}

function startPetAgingInterval() {
    if (INTERVALS.has('petAging')) return;

    const interval = setInterval(async () => {
        try {
            await PetAgingService.handleEquippedPetAging();
        } catch (error) {
            console.error('Error in pet aging interval:', error);
        }
    }, 60000);

    INTERVALS.set('petAging', interval);
}

function startAllPetIntervals() {
    startItemChanceInterval();
    startPassiveExpInterval();
    startActiveExpInterval();
    startNightOwlActiveExpInterval();
    startPetAgingInterval();
}

function stopAllPetIntervals() {
    for (const [name, interval] of INTERVALS.entries()) {
        clearInterval(interval);
        console.log(`🛑 Stopped ${name} interval`);
    }
    INTERVALS.clear();
    LAST_ITEM_DROP.clear();
}

function restartInterval(name) {
    const interval = INTERVALS.get(name);
    if (interval) {
        clearInterval(interval);
        INTERVALS.delete(name);
    }

    switch (name) {
        case 'itemChance':
            startItemChanceInterval();
            break;
        case 'passiveExp':
            startPassiveExpInterval();
            break;
        case 'activeExp':
            startActiveExpInterval();
            break;
        case 'nightOwlActiveExp':
            startNightOwlActiveExpInterval();
            break;
        case 'petAging':
            startPetAgingInterval();
            break;
        default:
            console.warn(`Unknown interval: ${name}`);
    }
}

function getIntervalStatus() {
    return {
        running: INTERVALS.size,
        intervals: Array.from(INTERVALS.keys()),
        lastDrops: LAST_ITEM_DROP.size
    };
}

module.exports = {
    startAllPetIntervals,
    stopAllPetIntervals,
    restartInterval,
    getIntervalStatus,
    startItemChanceInterval,
    startPassiveExpInterval,
    startActiveExpInterval,
    startNightOwlActiveExpInterval,
    startPetAgingInterval
};