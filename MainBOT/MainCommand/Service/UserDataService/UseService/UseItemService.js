const ItemHandlers = require('./ItemUseHandler/SpecialItemhandler');
const { getUserInventory, updateInventory } = require('./UseDatabaseService');
const { validateItemUse } = require('./UseValidationService');

async function useItem(userId, itemName, quantity = 1) {
    // Check if item exists in inventory
    const inventory = await getUserInventory(userId, itemName);
    
    // Validate item use
    const validation = validateItemUse(inventory, itemName, quantity);
    if (!validation.valid) {
        throw new Error(validation.message);
    }
    
    // Check if item is usable
    if (!ItemHandlers.isUsableItem(itemName)) {
        throw new Error(`Item ${itemName} is not usable.`);
    }
    
    // Update inventory (remove items)
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
    // This would require a database query to get all items
    // For now, return empty array as placeholder
    return [];
}

module.exports = {
    useItem,
    canUseItem,
    getUsableItems
};