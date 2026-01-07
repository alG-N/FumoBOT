const db = require('../../../Core/database');
const { RARITY_ORDER } = require('../../../Configuration/storageConfig');

class StorageService {
    static async getUserInventory(userId) {
        return db.all(
            `SELECT fumoName, SUM(quantity) as count, rarity 
             FROM userInventory 
             WHERE userId = ? 
             GROUP BY fumoName`,
            [userId],
            true
        );
    }

    static async getUserMetadata(userId) {
        // Join userCoins with userLevelProgress and userRebirthProgress for level/rebirth
        return db.get(
            `SELECT uc.hasFantasyBook, 
                    COALESCE(ulp.level, 1) as level, 
                    COALESCE(urp.rebirthCount, 0) as rebirth 
             FROM userCoins uc
             LEFT JOIN userLevelProgress ulp ON uc.userId = ulp.userId
             LEFT JOIN userRebirthProgress urp ON uc.userId = urp.userId
             WHERE uc.userId = ?`,
            [userId],
            true
        );
    }

    static getRarity(fumoName) {
        if (!fumoName) return 'Common';
        
        const rarityChecks = [
            'TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL',
            '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY',
            'EPIC', 'RARE', 'UNCOMMON'
        ];

        for (const rarity of rarityChecks) {
            if (fumoName.includes(rarity)) return rarity;
        }
        
        return 'Common';
    }

    static cleanFumoName(name) {
        return name.replace(/\s*\(.*?\)\s*/g, '').trim();
    }

    static isShinyPlus(fumoName) {
        return fumoName.includes('[✨SHINY]') || fumoName.includes('[🌟alG]');
    }

    /**
     * Check if fumo has VOID or GLITCHED variant (VOID+)
     */
    static isVoidPlus(fumoName) {
        return fumoName.includes('[🌀VOID]') || fumoName.includes('[🔮GLITCHED]');
    }

    static isHighTier(rarity) {
        return ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT', 'OTHERWORLDLY'].includes(rarity);
    }

    static buildInventoryData(inventoryRows, options = {}) {
        const { showShinyPlus = false, showVoidPlus = false, hasFantasyBook = false, sortBy = 'rarity' } = options;
        
        const categories = {};
        RARITY_ORDER.forEach(r => categories[r] = []);
        
        let totalFumos = 0;
        let totalShinyPlus = 0;
        let totalVoidPlus = 0;

        for (const row of inventoryRows) {
            if (!row.fumoName) continue;

            const rarity = this.getRarity(row.fumoName);
            const isShiny = this.isShinyPlus(row.fumoName);
            const isVoid = this.isVoidPlus(row.fumoName);
            const isHigh = this.isHighTier(rarity);

            // Count total fumos
            totalFumos += row.count;
            
            // Count shiny and void separately
            if (isShiny) {
                totalShinyPlus += row.count;
            }
            if (isVoid) {
                totalVoidPlus += row.count;
            }

            // Filter for display based on mode
            // If showing VOID+, only show VOID/GLITCHED fumos
            // If showing SHINY+, only show SHINY/alG fumos (but NOT void variants)
            // If showing normal, only show non-variant fumos
            if (showVoidPlus) {
                if (!isVoid) continue;
            } else if (showShinyPlus) {
                if (!isShiny || isVoid) continue; // SHINY+ excludes VOID variants
            } else {
                if (isShiny || isVoid) continue; // Normal excludes all variants
            }
            
            // If showing normal fumos and it's high tier without fantasy book, skip
            if (!showShinyPlus && !showVoidPlus && isHigh && !hasFantasyBook) continue;

            const cleanName = this.cleanFumoName(row.fumoName);
            categories[rarity].push({ 
                name: cleanName, 
                count: row.count,
                original: row.fumoName
            });
        }

        const visibleRarities = RARITY_ORDER.filter(rarity => {
            if (!categories[rarity].length) return false;
            return true;
        });

        for (const rarity of visibleRarities) {
            categories[rarity].sort((a, b) => {
                if (sortBy === 'quantity') {
                    return b.count - a.count || a.name.localeCompare(b.name);
                }
                return a.name.localeCompare(b.name);
            });
        }

        return { categories, visibleRarities, totalFumos, totalShinyPlus, totalVoidPlus };
    }

    static getStatsForRarity(categories, rarity) {
        const items = categories[rarity] || [];
        const totalCount = items.reduce((sum, item) => sum + item.count, 0);
        const uniqueCount = items.length;
        
        return { totalCount, uniqueCount, items };
    }

    static getInventorySummary(inventoryData) {
        const { categories, totalFumos, totalShinyPlus, totalVoidPlus } = inventoryData;
        
        const summary = {
            totalFumos,
            totalShinyPlus,
            totalVoidPlus,
            byRarity: {}
        };

        for (const rarity of RARITY_ORDER) {
            const stats = this.getStatsForRarity(categories, rarity);
            if (stats.totalCount > 0) {
                summary.byRarity[rarity] = stats;
            }
        }

        return summary;
    }
}

module.exports = StorageService;