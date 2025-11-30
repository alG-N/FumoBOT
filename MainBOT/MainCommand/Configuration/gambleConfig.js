const CARDS = [
    { id: 1, name: 'ReimuFumo', emoji: '⛩️' },
    { id: 2, name: 'SanaeFumo', emoji: '🐸' },
    { id: 3, name: 'MarisaFumo', emoji: '⭐' },
    { id: 4, name: 'FlandreFumo', emoji: '🦇' },
    { id: 5, name: 'SakuyaFumo', emoji: '⏰' },
    { id: 6, name: 'AliceFumo', emoji: '🎀' },
    { id: 7, name: 'YoumuFumo', emoji: '⚔️' },
    { id: 8, name: 'CirnoFumo', emoji: '❄️' },
    { id: 9, name: 'RemiliaFumo', emoji: '🌙' },
    { id: 10, name: 'YukariFumo', emoji: '👁️' }
];

const COUNTERS = {
    1: [2, 3, 5, 7],
    2: [3, 4, 6, 8],
    3: [4, 5, 7, 9],
    4: [5, 6, 8, 10],
    5: [6, 7, 9, 1],
    6: [7, 8, 10, 2], 
    7: [8, 9, 1, 3],  
    8: [9, 10, 2, 4],   
    9: [10, 1, 3, 5], 
    10: [1, 2, 4, 6]  
};

const GAMBLE_CONFIG = {
    INVITATION_TIMEOUT: 20000,
    GUIDE_DURATION: 10000,
    SELECTION_DURATION: 15000,
    RESULT_DISPLAY_DURATION: 15000,
    COOLDOWN: 3000,         
    
    MIN_BET: {
        coins: 100,
        gems: 10
    },
    
    SAME_CARD_PENALTY: 0.5
};

function getCard(cardId) {
    return CARDS.find(card => card.id === cardId) || null;
}

function getAllCards() {
    return [...CARDS];
}

function doesCounter(card1Id, card2Id) {
    return COUNTERS[card1Id]?.includes(card2Id) || false;
}

function getCounteredBy(cardId) {
    return COUNTERS[cardId] || [];
}

function getCounters(cardId) {
    const result = [];
    for (const [id, counters] of Object.entries(COUNTERS)) {
        if (counters.includes(cardId)) {
            result.push(parseInt(id));
        }
    }
    return result;
}

function validateBet(currency, amount) {
    const minBet = GAMBLE_CONFIG.MIN_BET[currency];
    if (!minBet) {
        return { valid: false, error: 'INVALID_CURRENCY' };
    }
    
    if (amount < minBet) {
        return { valid: false, error: 'BELOW_MINIMUM', minBet };
    }
    
    return { valid: true };
}

module.exports = {
    CARDS,
    COUNTERS,
    GAMBLE_CONFIG,

    getCard,
    getAllCards,
    doesCounter,
    getCounteredBy,
    getCounters,
    validateBet
};