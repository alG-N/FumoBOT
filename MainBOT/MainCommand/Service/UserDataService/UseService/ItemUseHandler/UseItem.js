const PotionHandler = require('./PotionHandler');
const SpecialItemHandler = require('./SpecialItemhandler');

const ITEM_HANDLERS = {
    CoinPotionT1: PotionHandler.handleCoinPotion,
    CoinPotionT2: PotionHandler.handleCoinPotion,
    CoinPotionT3: PotionHandler.handleCoinPotion,
    CoinPotionT4: PotionHandler.handleCoinPotion,
    CoinPotionT5: PotionHandler.handleCoinPotion,
    
    GemPotionT1: PotionHandler.handleGemPotion,
    GemPotionT2: PotionHandler.handleGemPotion,
    GemPotionT3: PotionHandler.handleGemPotion,
    GemPotionT4: PotionHandler.handleGemPotion,
    GemPotionT5: PotionHandler.handleGemPotion,
    
    BoostPotionT1: PotionHandler.handleBoostPotion,
    BoostPotionT2: PotionHandler.handleBoostPotion,
    BoostPotionT3: PotionHandler.handleBoostPotion,
    BoostPotionT4: PotionHandler.handleBoostPotion,
    BoostPotionT5: PotionHandler.handleBoostPotion,
    
    WeirdGrass: SpecialItemHandler.handleWeirdGrass,
    GoldenSigil: SpecialItemHandler.handleGoldenSigil,
    HakureiTicket: SpecialItemHandler.handleHakureiTicket,
    Lumina: SpecialItemHandler.handleLumina,
    FantasyBook: SpecialItemHandler.handleFantasyBook,
    AncientRelic: SpecialItemHandler.handleAncientRelic,
    Nullified: SpecialItemHandler.handleNullified,
    PetFoob: SpecialItemHandler.handlePetFoob
};

function getItemKey(itemName) {
    const baseNames = {
        'CoinPotionT1(R)': 'CoinPotionT1',
        'CoinPotionT2(R)': 'CoinPotionT2',
        'CoinPotionT3(R)': 'CoinPotionT3',
        'CoinPotionT4(L)': 'CoinPotionT4',
        'CoinPotionT5(M)': 'CoinPotionT5',
        
        'GemPotionT1(R)': 'GemPotionT1',
        'GemPotionT2(R)': 'GemPotionT2',
        'GemPotionT3(R)': 'GemPotionT3',
        'GemPotionT4(L)': 'GemPotionT4',
        'GemPotionT5(M)': 'GemPotionT5',
        
        'BoostPotionT1(L)': 'BoostPotionT1',
        'BoostPotionT2(L)': 'BoostPotionT2',
        'BoostPotionT3(L)': 'BoostPotionT3',
        'BoostPotionT4(M)': 'BoostPotionT4',
        'BoostPotionT5(M)': 'BoostPotionT5',
        
        'WeirdGrass(R)': 'WeirdGrass',
        'GoldenSigil(?)': 'GoldenSigil',
        'HakureiTicket(L)': 'HakureiTicket',
        'Lumina(M)': 'Lumina',
        'FantasyBook(M)': 'FantasyBook',
        'AncientRelic(E)': 'AncientRelic',
        'Nullified(?)': 'Nullified',
        'PetFoob(B)': 'PetFoob'
    };

    return baseNames[itemName] || null;
}

async function handleItem(message, itemName, quantity) {
    const itemKey = getItemKey(itemName);
    const userId = message.author.id;

    if (!itemKey) {
        return message.reply(`✅ You used **${itemName}** x${quantity}!`);
    }

    const handler = ITEM_HANDLERS[itemKey];

    if (!handler) {
        return message.reply(`✅ You used **${itemName}** x${quantity}!`);
    }

    try {
        await handler(message, itemName, quantity, userId);
    } catch (error) {
        console.error(`[ITEM_HANDLER] Error handling ${itemName}:`, error);
        message.reply('❌ Failed to use item. Please try again.');
    }
}

module.exports = {
    handleItem,
    getItemKey,
    ITEM_HANDLERS
};