const { handleCoinPotion, handleGemPotion, handleBoostPotion, isCoinPotion, isGemPotion, isBoostPotion } = require('./PotionHandler');
const { handleWeirdGrass } = require('./WeirdGrassHandler');
const { handleGoldenSigil } = require('./GoldenSigilHandler');
const { handleHakureiTicket } = require('./HakureiTicketHandler');
const { handleLumina } = require('./LuminaHandler');
const { handleFantasyBook } = require('./FantasyBookHandler');
const { handleMysteriousCube } = require('./MysteriousCubeHandler');
const { handleMysteriousDice } = require('./MysteriousDiceHandler');
const { handleTimeClock } = require('./TimeClockHandler');
const { handleSgil } = require('./SgilHandler');
const { handleNullified } = require('./NullifiedHandler');
const { handlePetFoob } = require('./PetFoobHandler');
const { handleShinyShard } = require('./ShinyShardHandler');
const { handleAlGShard } = require('./alGShardHandler');
const { handleAncientRelic } = require('./AncientRelicHandler');

const ITEM_HANDLERS = {
    // Potions
    'CoinPotionT1(R)': handleCoinPotion,
    'CoinPotionT2(R)': handleCoinPotion,
    'CoinPotionT3(R)': handleCoinPotion,
    'CoinPotionT4(L)': handleCoinPotion,
    'CoinPotionT5(M)': handleCoinPotion,
    
    'GemPotionT1(R)': handleGemPotion,
    'GemPotionT2(R)': handleGemPotion,
    'GemPotionT3(R)': handleGemPotion,
    'GemPotionT4(L)': handleGemPotion,
    'GemPotionT5(M)': handleGemPotion,
    
    'BoostPotionT1(L)': handleBoostPotion,
    'BoostPotionT2(L)': handleBoostPotion,
    'BoostPotionT3(L)': handleBoostPotion,
    'BoostPotionT4(M)': handleBoostPotion,
    'BoostPotionT5(M)': handleBoostPotion,
    
    // Special Items
    'WeirdGrass(R)': handleWeirdGrass,
    'GoldenSigil(?)': handleGoldenSigil,
    'HakureiTicket(L)': handleHakureiTicket,
    'Lumina(M)': handleLumina,
    'FantasyBook(M)': handleFantasyBook,
    'MysteriousCube(M)': handleMysteriousCube,
    'MysteriousDice(M)': handleMysteriousDice,
    'TimeClock(L)': handleTimeClock,
    'S!gil?(?)': handleSgil,
    'Nullified(?)': handleNullified,
    'PetFoob(B)': handlePetFoob,
    'ShinyShard(?)': handleShinyShard,
    'alGShard(P)': handleAlGShard,
    'AncientRelic(E)': handleAncientRelic
};

async function handleItem(message, itemName, quantity) {
    const handler = ITEM_HANDLERS[itemName];
    
    if (!handler) {
        return message.reply(`❌ **${itemName}** cannot be used or has no implemented handler yet.`);
    }
    
    try {
        await handler(message, itemName, quantity, message.author.id);
    } catch (error) {
        console.error(`[ITEM_HANDLER] Error handling ${itemName}:`, error);
        throw error;
    }
}

function isUsableItem(itemName) {
    return !!ITEM_HANDLERS[itemName];
}

function getItemHandler(itemName) {
    return ITEM_HANDLERS[itemName] || null;
}

module.exports = {
    handleItem,
    isUsableItem,
    getItemHandler,
    
    // Export individual handlers for direct access
    handleCoinPotion,
    handleGemPotion,
    handleBoostPotion,
    handleWeirdGrass,
    handleGoldenSigil,
    handleHakureiTicket,
    handleLumina,
    handleFantasyBook,
    handleMysteriousCube,
    handleMysteriousDice,
    handleTimeClock,
    handleSgil,
    handleNullified,
    handlePetFoob,
    handleShinyShard,
    handleAlGShard,
    handleAncientRelic,
    
    // Helper functions
    isCoinPotion,
    isGemPotion,
    isBoostPotion
};