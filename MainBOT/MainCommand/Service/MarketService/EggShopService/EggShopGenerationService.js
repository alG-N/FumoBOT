const { EGG_POOL, SHOP_SIZE } = require('../../../Configuration/eggConfig');
const { debugLog } = require('../../../Core/logger');

function rollWeightedEgg() {
    const totalWeight = EGG_POOL.reduce((sum, egg) => sum + egg.chance, 0);
    let random = Math.random() * totalWeight;
    
    for (const egg of EGG_POOL) {
        random -= egg.chance;
        if (random <= 0) {
            return { ...egg };
        }
    }
    
    return { ...EGG_POOL[0] };
}

function generateGlobalEggShop() {
    const eggs = [];
    
    for (let i = 0; i < SHOP_SIZE; i++) {
        eggs.push(rollWeightedEgg());
    }
    
    debugLog('EGG_GEN', `Generated ${eggs.length} eggs for shop`);
    return eggs;
}

module.exports = {
    generateGlobalEggShop,
    rollWeightedEgg
};