const { all } = require('../../../Core/database');
const { RARITY_ORDER, RARITY_SUFFIX_MAP } = require('../../../Configuration/itemConfig');
const { debugLog } = require('../../../Core/logger');

async function getUserInventoryPaginated(userId, itemsPerPage = 2) {
    debugLog('INVENTORY_QUERY', `Fetching paginated inventory for user ${userId}`);

    try {
        const rows = await all(
            `SELECT itemName, SUM(quantity) as totalQuantity 
             FROM userInventory 
             WHERE userId = ? 
             GROUP BY itemName 
             HAVING totalQuantity > 0`,
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
            if (!row.itemName) continue;

            totalItems += row.totalQuantity;

            const rarityEntry = Object.entries(RARITY_SUFFIX_MAP).find(([suffix]) =>
                row.itemName.endsWith(suffix)
            );

            if (rarityEntry) {
                categorized[rarityEntry[1]].push({
                    name: row.itemName,
                    quantity: row.totalQuantity
                });
            }
        }

        const pages = [];
        for (let i = 0; i < RARITY_ORDER.length; i += itemsPerPage) {
            const pageRarities = RARITY_ORDER.slice(i, i + itemsPerPage);
            const pageData = {};

            for (const rarity of pageRarities) {
                pageData[rarity] = categorized[rarity];
            }

            pages.push(pageData);
        }

        return {
            hasItems: true,
            pages,
            totalItems,
            categorized
        };

    } catch (error) {
        console.error('Error in getUserInventoryPaginated:', error);
        throw error;
    }
}

async function getInventoryStats(userId) {
    debugLog('INVENTORY_QUERY', `Fetching inventory stats for user ${userId}`);

    try {
        const rows = await all(
            `SELECT itemName, SUM(quantity) as totalQuantity 
             FROM userInventory 
             WHERE userId = ? 
             GROUP BY itemName 
             HAVING totalQuantity > 0`,
            [userId]
        );

        const stats = {
            totalItems: 0,
            totalUniqueItems: rows.length,
            byRarity: {}
        };

        for (const rarity of RARITY_ORDER) {
            stats.byRarity[rarity] = {
                count: 0,
                uniqueCount: 0
            };
        }

        for (const row of rows) {
            if (!row.itemName) continue;  // <-- ADD THIS LINE

            stats.totalItems += row.totalQuantity;

            const rarityEntry = Object.entries(RARITY_SUFFIX_MAP).find(([suffix]) =>
                row.itemName.endsWith(suffix)
            );

            if (rarityEntry) {
                const rarity = rarityEntry[1];
                stats.byRarity[rarity].count += row.totalQuantity;
                stats.byRarity[rarity].uniqueCount++;
            }
        }

        return stats;

    } catch (error) {
        console.error('Error in getInventoryStats:', error);
        throw error;
    }
}

async function getItemsByRarity(userId, rarity) {
    debugLog('INVENTORY_QUERY', `Fetching ${rarity} items for user ${userId}`);

    try {
        const suffix = Object.entries(RARITY_SUFFIX_MAP).find(([_, r]) => r === rarity)?.[0];
        if (!suffix) return [];

        const rows = await all(
            `SELECT itemName, SUM(quantity) as totalQuantity 
             FROM userInventory 
             WHERE userId = ? AND itemName LIKE ? 
             GROUP BY itemName 
             HAVING totalQuantity > 0`,
            [userId, `%${suffix}`]
        );

        return rows.map(row => ({
            name: row.itemName,
            quantity: row.totalQuantity
        }));

    } catch (error) {
        console.error('Error in getItemsByRarity:', error);
        throw error;
    }
}

async function searchInventory(userId, searchTerm) {
    debugLog('INVENTORY_QUERY', `Searching inventory for user ${userId}: ${searchTerm}`);

    try {
        const rows = await all(
            `SELECT itemName, SUM(quantity) as totalQuantity 
             FROM userInventory 
             WHERE userId = ? AND itemName LIKE ? 
             GROUP BY itemName 
             HAVING totalQuantity > 0`,
            [userId, `%${searchTerm}%`]
        );

        return rows.map(row => ({
            name: row.itemName,
            quantity: row.totalQuantity
        }));

    } catch (error) {
        console.error('Error in searchInventory:', error);
        throw error;
    }
}

module.exports = {
    getUserInventoryPaginated,
    getInventoryStats,
    getItemsByRarity,
    searchInventory
};