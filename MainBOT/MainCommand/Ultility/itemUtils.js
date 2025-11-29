const { RARITY_ORDER, RARITY_SUFFIX_MAP, getRarityFromItemName } = require('../Configuration/itemConfig');

function groupItemsByRarity(items) {
    const grouped = {};
    
    for (const rarity of RARITY_ORDER) {
        grouped[rarity] = [];
    }
    
    for (const item of items) {
        const rarity = getRarityFromItemName(item.itemName || item.name);
        
        if (rarity && grouped[rarity]) {
            grouped[rarity].push({
                name: item.itemName || item.name,
                quantity: item.totalQuantity || item.quantity || 1
            });
        }
    }
    
    return grouped;
}

function sortItemsByRarity(items) {
    return items.sort((a, b) => {
        const rarityA = getRarityFromItemName(a.itemName || a.name) || 'Common';
        const rarityB = getRarityFromItemName(b.itemName || b.name) || 'Common';
        
        const indexA = RARITY_ORDER.indexOf(rarityA);
        const indexB = RARITY_ORDER.indexOf(rarityB);
        
        if (indexA !== indexB) {
            return indexB - indexA; 
        }
        
        return (a.itemName || a.name).localeCompare(b.itemName || b.name);
    });
}

function filterItemsBySearch(items, searchTerm) {
    if (!searchTerm) return items;
    
    const lowerSearch = searchTerm.toLowerCase();
    
    return items.filter(item => {
        const itemName = (item.itemName || item.name || '').toLowerCase();
        return itemName.includes(lowerSearch);
    });
}

function calculateTotalValue(items) {
    return items.reduce((total, item) => {
        const value = item.value || 0;
        const quantity = item.totalQuantity || item.quantity || 1;
        return total + (value * quantity);
    }, 0);
}

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

function formatItemName(itemName, removeSuffix = false) {
    if (!removeSuffix) return itemName;
    
    for (const suffix of Object.keys(RARITY_SUFFIX_MAP)) {
        if (itemName.endsWith(suffix)) {
            return itemName.slice(0, -suffix.length).trim();
        }
    }
    
    return itemName;
}

function getUniqueItemCount(groupedItems) {
    return Object.values(groupedItems).reduce((total, items) => {
        return total + items.length;
    }, 0);
}

function getTotalItemCount(groupedItems) {
    return Object.values(groupedItems).reduce((total, items) => {
        return total + items.reduce((sum, item) => sum + item.quantity, 0);
    }, 0);
}

function hasAnyItems(groupedItems) {
    return Object.values(groupedItems).some(items => items.length > 0);
}

function mergeDuplicateItems(items) {
    const merged = new Map();
    
    for (const item of items) {
        const name = item.itemName || item.name;
        
        if (merged.has(name)) {
            const existing = merged.get(name);
            existing.quantity += (item.totalQuantity || item.quantity || 1);
        } else {
            merged.set(name, {
                name,
                quantity: item.totalQuantity || item.quantity || 1
            });
        }
    }
    
    return Array.from(merged.values());
}

function validateQuantity(quantity, min = 1, max = Infinity) {
    if (isNaN(quantity) || quantity < min) {
        return { 
            valid: false, 
            error: `Quantity must be at least ${min}` 
        };
    }
    
    if (quantity > max) {
        return { 
            valid: false, 
            error: `Quantity cannot exceed ${max}` 
        };
    }
    
    return { valid: true };
}

module.exports = {
    groupItemsByRarity,
    sortItemsByRarity,
    filterItemsBySearch,
    calculateTotalValue,
    chunkArray,
    formatItemName,
    getUniqueItemCount,
    getTotalItemCount,
    hasAnyItems,
    mergeDuplicateItems,
    validateQuantity
};