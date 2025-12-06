const ITEM_DATABASE = require('./ItemDataRepository');
const { RARITY_SUFFIX_MAP } = require('../../../../Configuration/itemConfig');

class ItemQueryService {
    static getAllItems() {
        return Object.entries(ITEM_DATABASE).map(([name, data]) => ({
            name,
            ...data
        }));
    }

    static getItemByName(itemName) {
        return ITEM_DATABASE[itemName] || null;
    }

    static searchItems(query) {
        const lowerQuery = query.toLowerCase();
        return Object.entries(ITEM_DATABASE)
            .filter(([name]) => name.toLowerCase().includes(lowerQuery))
            .map(([name, data]) => ({ name, ...data }));
    }

    static getItemsByRarity(rarity) {
        return Object.entries(ITEM_DATABASE)
            .filter(([_, data]) => data.rarity === rarity)
            .map(([name, data]) => ({ name, ...data }));
    }

    static getItemsByCategory(category) {
        return Object.entries(ITEM_DATABASE)
            .filter(([_, data]) => data.category === category)
            .map(([name, data]) => ({ name, ...data }));
    }

    static getCraftableItems() {
        return Object.entries(ITEM_DATABASE)
            .filter(([_, data]) => data.craftable)
            .map(([name, data]) => ({ name, ...data }));
    }

    static getUsableItems() {
        return Object.entries(ITEM_DATABASE)
            .filter(([_, data]) => data.usable)
            .map(([name, data]) => ({ name, ...data }));
    }

    static getItemRarity(itemName) {
        const item = ITEM_DATABASE[itemName];
        return item ? item.rarity : null;
    }

    static isItemCraftable(itemName) {
        const item = ITEM_DATABASE[itemName];
        return item ? item.craftable : false;
    }

    static isItemUsable(itemName) {
        const item = ITEM_DATABASE[itemName];
        return item ? item.usable : false;
    }

    static getItemCraftTime(itemName) {
        const item = ITEM_DATABASE[itemName];
        return item?.craftTime || 0;
    }

    static getItemsByPrefix(prefix) {
        const lowerPrefix = prefix.toLowerCase();
        return Object.entries(ITEM_DATABASE)
            .filter(([name]) => name.toLowerCase().startsWith(lowerPrefix))
            .map(([name, data]) => ({ name, ...data }));
    }

    static getItemCount() {
        return Object.keys(ITEM_DATABASE).length;
    }

    static getRarityDistribution() {
        const distribution = {};
        Object.values(ITEM_DATABASE).forEach(item => {
            distribution[item.rarity] = (distribution[item.rarity] || 0) + 1;
        });
        return distribution;
    }

    static getCategoryDistribution() {
        const distribution = {};
        Object.values(ITEM_DATABASE).forEach(item => {
            distribution[item.category] = (distribution[item.category] || 0) + 1;
        });
        return distribution;
    }

    static fuzzySearch(query, threshold = 0.6) {
        const lowerQuery = query.toLowerCase();
        const results = [];

        for (const [name, data] of Object.entries(ITEM_DATABASE)) {
            const lowerName = name.toLowerCase();
            const similarity = this.calculateSimilarity(lowerQuery, lowerName);
            
            if (similarity >= threshold) {
                results.push({ name, ...data, similarity });
            }
        }

        return results.sort((a, b) => b.similarity - a.similarity);
    }

    static calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    static levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    static getRelatedItems(itemName, limit = 5) {
        const item = ITEM_DATABASE[itemName];
        if (!item) return [];

        return Object.entries(ITEM_DATABASE)
            .filter(([name]) => name !== itemName)
            .filter(([_, data]) => 
                data.rarity === item.rarity || 
                data.category === item.category
            )
            .slice(0, limit)
            .map(([name, data]) => ({ name, ...data }));
    }

    static validateItemName(itemName) {
        return ITEM_DATABASE.hasOwnProperty(itemName);
    }
}

module.exports = ItemQueryService;