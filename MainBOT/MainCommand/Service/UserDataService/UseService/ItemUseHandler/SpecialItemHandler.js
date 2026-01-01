const { handleCoinPotion, handleGemPotion, handleBoostPotion, isCoinPotion, isGemPotion, isBoostPotion } = require('./PotionHandler');
const { handleGoldenSigil } = require('./GoldenSigilHandler');
const { handleNullified } = require('./NullifiedHandler');
const { handlePetFoob } = require('./PetFoobHandler');
const { handleShinyShard } = require('./ShinyShardHandler');
const { handleAlGShard } = require('./alGShardHandler');
const { handleAncientRelic } = require('./AncientRelicHandler');
const { handleCrystalSigil } = require('./CrystalSigilHandler');
const { handleVoidCrystal } = require('./VoidCrystalHandler');
const { handleEternalEssence } = require('./EternalEssenceHandler');
const { handleCosmicCore } = require('./CosmicCoreHandler');
const { handleSigil } = require('./SgilHandler');
const { handleFantasyBook } = require('./FantasyBookHandler');

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
    
    // Special items
    'GoldenSigil(?)': handleGoldenSigil,
    'S!gil?(?)': handleSigil,
    'Nullified(?)': handleNullified,
    'PetFoob(B)': handlePetFoob,
    'ShinyShard(?)': handleShinyShard,
    'alGShard(P)': handleAlGShard,
    'AncientRelic(E)': handleAncientRelic,
    'FantasyBook(M)' : handleFantasyBook,
    
    // Tier 6 items
    'CrystalSigil(?)': handleCrystalSigil,
    'VoidCrystal(?)': handleVoidCrystal,
    'EternalEssence(?)': handleEternalEssence,
    'CosmicCore(?)': handleCosmicCore
};

async function handleItem(message, itemName, quantity) {
    const handler = ITEM_HANDLERS[itemName];
    if (!handler) {
        return null;
    }
    return handler(message, itemName, quantity, message.author.id);
}

function isUsableItem(itemName) {
    return ITEM_HANDLERS.hasOwnProperty(itemName);
}

function getItemHandler(itemName) {
    return ITEM_HANDLERS[itemName] || null;
}

module.exports = {
    handleItem,
    isUsableItem,
    getItemHandler,
    handleCoinPotion,
    handleGemPotion,
    handleBoostPotion,
    isCoinPotion,
    isGemPotion,
    isBoostPotion,
    handleGoldenSigil,
    handleSigil,
    handleNullified,
    handlePetFoob,
    handleShinyShard,
    handleAlGShard,
    handleAncientRelic,
    handleCrystalSigil,
    handleVoidCrystal,
    handleEternalEssence,
    handleCosmicCore,
    handleFantasyBook,
    ITEM_HANDLERS
};