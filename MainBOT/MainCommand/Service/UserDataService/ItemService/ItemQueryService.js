const { all } = require('../../../Core/database');
const { RARITY_ORDER, RARITY_SUFFIX_MAP } = require('../../../Configuration/itemConfig');
const { debugLog } = require('../../../Core/logger');

async function getUserInventoryPaginated(userId, itemsPerPage = 2) {
    debugLog('INVENTORY_QUERY', `Fetching paginated inventory for user ${userId}`);

    try {
        const rows = await all(
            `SELECT itemName, SUM(quantity) as totalQuantity 
             FROM userInventory 
             WHERE userId = ? AND itemName IS NOT NULL AND TRIM(itemName) != ''
             GROUP BY itemName 
             HAVING totalQuantity > 0
             ORDER BY itemName`,
            [userId]
        );

        if (!rows || rows.length === 0) {
            return { hasItems: false, pages: [], totalItems: 0 };
        }

        const categorized = {};
        let totalItems = 0;

        for (const rarity of RARITY_ORDER) {
            categorized[rarity] = [];
        }

        for (const row of rows) {
            if (!row.itemName || typeof row.itemName !== 'string' || row.itemName.trim() === '') {
                console.warn(`[INVENTORY] Skipping invalid item:`, row);
                continue;
            }

            const quantity = parseInt(row.totalQuantity) || 0;
            if (quantity <= 0) {
                console.warn(`[INVENTORY] Skipping zero quantity item: ${row.itemName}`);
                continue;
            }

            totalItems += quantity;

            const rarityEntry = Object.entries(RARITY_SUFFIX_MAP).find(([suffix]) =>
                row.itemName.endsWith(suffix)
            );

            if (rarityEntry) {
                const [suffix, rarity] = rarityEntry;
                categorized[rarity].push({
                    name: row.itemName,
                    quantity: quantity
                });
            } else {
                console.warn(`[INVENTORY] Unknown rarity for item: ${row.itemName}`);
            }
        }

        const pages = [];
        
        for (let i = 0; i < RARITY_ORDER.length; i += itemsPerPage) {
            const pageRarities = RARITY_ORDER.slice(i, i + itemsPerPage);
            const pageData = {};

            for (const rarity of pageRarities) {
                pageData[rarity] = categorized[rarity] || [];
            }

            pages.push(pageData);
        }

        return {
            hasItems: true,
            pages,
            totalItems,
            totalPages: pages.length,
            categorized
        };

    } catch (error) {
        console.error('[INVENTORY] Error in getUserInventoryPaginated:', error);
        throw error;
    }
}

async function getInventoryStats(userId) {
    debugLog('INVENTORY_QUERY', `Fetching inventory stats for user ${userId}`);

    try {
        const rows = await all(
            `SELECT itemName, SUM(quantity) as totalQuantity 
             FROM userInventory 
             WHERE userId = ? AND itemName IS NOT NULL AND TRIM(itemName) != ''
             GROUP BY itemName 
             HAVING totalQuantity > 0`,
            [userId]
        );

        const stats = {
            totalItems: 0,
            totalUniqueItems: 0,
            byRarity: {}
        };

        for (const rarity of RARITY_ORDER) {
            stats.byRarity[rarity] = {
                count: 0,
                uniqueCount: 0
            };
        }

        for (const row of rows) {
            if (!row.itemName || typeof row.itemName !== 'string' || row.itemName.trim() === '') {
                continue;
            }

            const quantity = parseInt(row.totalQuantity) || 0;
            if (quantity <= 0) continue;

            stats.totalItems += quantity;
            stats.totalUniqueItems++;

            const rarityEntry = Object.entries(RARITY_SUFFIX_MAP).find(([suffix]) =>
                row.itemName.endsWith(suffix)
            );

            if (rarityEntry) {
                const rarity = rarityEntry[1];
                stats.byRarity[rarity].count += quantity;
                stats.byRarity[rarity].uniqueCount++;
            }
        }

        console.log(`[INVENTORY STATS] User ${userId}:`, {
            totalItems: stats.totalItems,
            uniqueItems: stats.totalUniqueItems
        });

        return stats;

    } catch (error) {
        console.error('[INVENTORY] Error in getInventoryStats:', error);
        throw error;
    }
}

async function getItemsByRarity(userId, rarity) {
    debugLog('INVENTORY_QUERY', `Fetching ${rarity} items for user ${userId}`);

    try {
        const suffix = Object.entries(RARITY_SUFFIX_MAP).find(([_, r]) => r === rarity)?.[0];
        if (!suffix) {
            console.warn(`[INVENTORY] No suffix found for rarity: ${rarity}`);
            return [];
        }

        const rows = await all(
            `SELECT itemName, SUM(quantity) as totalQuantity 
             FROM userInventory 
             WHERE userId = ? 
             AND itemName LIKE ? 
             AND itemName IS NOT NULL 
             AND TRIM(itemName) != ''
             GROUP BY itemName 
             HAVING totalQuantity > 0`,
            [userId, `%${suffix}`]
        );

        return rows
            .filter(row => row.itemName && typeof row.itemName === 'string' && row.itemName.trim() !== '')
            .map(row => ({
                name: row.itemName,
                quantity: parseInt(row.totalQuantity) || 0
            }))
            .filter(item => item.quantity > 0);

    } catch (error) {
        console.error('[INVENTORY] Error in getItemsByRarity:', error);
        throw error;
    }
}

async function searchInventory(userId, searchTerm) {
    debugLog('INVENTORY_QUERY', `Searching inventory for user ${userId}: ${searchTerm}`);

    try {
        const rows = await all(
            `SELECT itemName, SUM(quantity) as totalQuantity 
             FROM userInventory 
             WHERE userId = ? 
             AND itemName LIKE ? 
             AND itemName IS NOT NULL 
             AND TRIM(itemName) != ''
             GROUP BY itemName 
             HAVING totalQuantity > 0`,
            [userId, `%${searchTerm}%`]
        );

        return rows
            .filter(row => row.itemName && typeof row.itemName === 'string' && row.itemName.trim() !== '')
            .map(row => ({
                name: row.itemName,
                quantity: parseInt(row.totalQuantity) || 0
            }))
            .filter(item => item.quantity > 0);

    } catch (error) {
        console.error('[INVENTORY] Error in searchInventory:', error);
        throw error;
    }
}

module.exports = {
    getUserInventoryPaginated,
    getInventoryStats,
    getItemsByRarity,
    searchInventory
};