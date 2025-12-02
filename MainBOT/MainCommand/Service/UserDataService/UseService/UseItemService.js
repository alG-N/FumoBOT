const ItemHandlers = require('./ItemUseHandler/SpecialItemHandler');
const { getUserInventory, updateInventory } = require('./UseDatabaseService');
const { validateItemUse } = require('./UseValidationService');

/**
 * Core service for using items - handles validation, inventory updates, and item handler execution
 */

async function useItem(userId, itemName, quantity = 1, message) {
    // Validate inventory
    const inventory = await getUserInventory(userId, itemName);
    
    const validation = validateItemUse(inventory, itemName, quantity);
    if (!validation.valid) {
        throw new Error(validation.message);
    }
    
    // Check if item is usable
    if (!ItemHandlers.isUsableItem(itemName)) {
        throw new Error(`❌ **${itemName}** cannot be used or has no implemented handler.`);
    }
    
    // Update inventory (remove items)
    await updateInventory(userId, itemName, quantity);
    
    try {
        // Execute the item handler
        await ItemHandlers.handleItem(message, itemName, quantity);
        
        return {
            success: true,
            itemName,
            quantity,
            remainingQuantity: inventory.quantity - quantity
        };
    } catch (error) {
        // If handler fails, restore items
        console.error(`[USE_ITEM_SERVICE] Handler failed for ${itemName}:`, error);
        
        // Attempt to restore items
        try {
            const { run } = require('../../../Core/database');
            await run(
                `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
                [quantity, userId, itemName]
            );
        } catch (restoreError) {
            console.error('[USE_ITEM_SERVICE] Failed to restore items:', restoreError);
        }
        
        throw error;
    }
}

async function canUseItem(userId, itemName, quantity = 1) {
    const inventory = await getUserInventory(userId, itemName);
    
    // Check if item exists in inventory
    if (!inventory || inventory.quantity < quantity) {
        return {
            canUse: false,
            reason: 'NOT_IN_INVENTORY',
            message: `❌ You don't have enough **${itemName}**. You need **${quantity}**, but only have **${inventory?.quantity || 0}**.`
        };
    }
    
    // Check if item has a handler
    if (!ItemHandlers.isUsableItem(itemName)) {
        return {
            canUse: false,
            reason: 'NOT_USABLE',
            message: `❌ **${itemName}** cannot be used or has no implemented handler.`
        };
    }
    
    return {
        canUse: true,
        availableQuantity: inventory.quantity
    };
}

async function getUsableItems(userId) {
    const { get } = require('../../../Core/database');
    
    try {
        const items = await get(
            `SELECT itemName, quantity FROM userInventory WHERE userId = ? AND type = 'item' ORDER BY itemName`,
            [userId]
        );
        
        if (!items) return [];
        
        // Filter to only items that have handlers
        return (Array.isArray(items) ? items : [items]).filter(item => 
            ItemHandlers.isUsableItem(item.itemName)
        );
    } catch (error) {
        console.error('[USE_ITEM_SERVICE] Error getting usable items:', error);
        return [];
    }
}

async function getItemInfo(itemName) {
    if (!ItemHandlers.isUsableItem(itemName)) {
        return {
            exists: false,
            message: `❌ **${itemName}** is not a usable item.`
        };
    }
    
    // Get item type
    const itemType = getItemType(itemName);
    
    return {
        exists: true,
        name: itemName,
        type: itemType,
        isUsable: true
    };
}

function getItemType(itemName) {
    if (ItemHandlers.isCoinPotion(itemName)) return 'Coin Potion';
    if (ItemHandlers.isGemPotion(itemName)) return 'Gem Potion';
    if (ItemHandlers.isBoostPotion(itemName)) return 'Boost Potion';
    
    // Special items
    const specialItems = {
        'WeirdGrass(R)': 'Random Boost',
        'GoldenSigil(?)': 'Stackable Boost',
        'HakureiTicket(L)': 'Cooldown Reset',
        'Lumina(M)': 'Permanent Luck',
        'FantasyBook(M)': 'Unlock Feature',
        'MysteriousCube(M)': 'Random Multi-Boost',
        'MysteriousDice(M)': 'Dynamic Luck',
        'TimeClock(L)': 'Multi-Boost',
        'S!gil?(?)': 'Ultimate Boost',
        'Nullified(?)': 'Rarity Override',
        'PetFoob(B)': 'Pet Food',
        'ShinyShard(?)': 'Fumo Transformation',
        'alGShard(P)': 'Fumo Transformation',
        'AncientRelic(E)': 'Multi-Boost'
    };
    
    return specialItems[itemName] || 'Special Item';
}

module.exports = {
    useItem,
    canUseItem,
    getUsableItems,
    getItemInfo
};