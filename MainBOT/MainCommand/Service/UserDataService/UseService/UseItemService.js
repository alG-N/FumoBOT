const ItemHandlers = require('./ItemUseHandler/SpecialItemHandler');
const { getUserInventory, updateInventory } = require('./UseDatabaseService');
const { validateItemUse } = require('./UseValidationService');

async function useItem(userId, itemName, quantity = 1) {
    const inventory = await getUserInventory(userId, itemName);
    
    const validation = validateItemUse(inventory, itemName, quantity);
    if (!validation.valid) {
        throw new Error(validation.message);
    }
    
    if (!ItemHandlers.isUsableItem(itemName)) {
        throw new Error(`Item ${itemName} is not usable.`);
    }
    
    await updateInventory(userId, itemName, quantity);
    
    return {
        success: true,
        itemName,
        quantity,
        remainingQuantity: inventory.quantity - quantity
    };
}

async function canUseItem(userId, itemName) {
    const inventory = await getUserInventory(userId, itemName);
    
    if (!inventory || inventory.quantity < 1) {
        return {
            canUse: false,
            reason: 'NOT_IN_INVENTORY'
        };
    }
    
    if (!ItemHandlers.isUsableItem(itemName)) {
        return {
            canUse: false,
            reason: 'NOT_USABLE'
        };
    }
    
    return {
        canUse: true,
        availableQuantity: inventory.quantity
    };
}

async function getUsableItems(userId) {
    return [];
}

module.exports = {
    useItem,
    canUseItem,
    getUsableItems
};