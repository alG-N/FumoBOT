const db = require('../../../Core/database');
const LEADERBOARD_CONFIG = require('../../../Configuration/leaderboardConfig');
const cacheService = require('./LeaderboardCacheService');

class LeaderboardDataService {
    async getCoinsLeaderboard(limit = 10) {
        const cached = cacheService.get('coins');
        if (cached) return cached;

        const rows = await db.all(
            'SELECT userId, coins FROM userCoins WHERE coins >= ? ORDER BY coins DESC LIMIT ?',
            [LEADERBOARD_CONFIG.MIN_DISPLAY_VALUE.coins, limit]
        );

        cacheService.set('coins', rows);
        return rows;
    }

    async getGemsLeaderboard(limit = 10) {
        const cached = cacheService.get('gems');
        if (cached) return cached;

        const rows = await db.all(
            'SELECT userId, gems FROM userCoins WHERE gems >= ? ORDER BY gems DESC LIMIT ?',
            [LEADERBOARD_CONFIG.MIN_DISPLAY_VALUE.gems, limit]
        );

        cacheService.set('gems', rows);
        return rows;
    }

    async getFumosLeaderboard(limit = 10) {
        const cached = cacheService.get('fumos');
        if (cached) return cached;

        const rows = await db.all(
            `SELECT userId, COUNT(*) as fumoCount 
             FROM userInventory 
             WHERE fumoName IS NOT NULL 
             GROUP BY userId 
             HAVING fumoCount >= ?
             ORDER BY fumoCount DESC 
             LIMIT ?`,
            [LEADERBOARD_CONFIG.MIN_DISPLAY_VALUE.fumos, limit]
        );

        cacheService.set('fumos', rows);
        return rows;
    }

    async getRarityLeaderboard(limit = 10) {
        const cached = cacheService.get('rarity');
        if (cached) return cached;

        const allRows = await db.all(
            'SELECT userId, fumoName FROM userInventory WHERE fumoName IS NOT NULL'
        );

        const userMaxRarity = new Map();

        for (const row of allRows) {
            const rarity = this.getRarity(row.fumoName);
            const rarityLevel = LEADERBOARD_CONFIG.RARITY_LEVELS[rarity] || 1;
            const currentMax = userMaxRarity.get(row.userId) || { level: 0, rarity: 'Common' };

            if (rarityLevel > currentMax.level) {
                userMaxRarity.set(row.userId, { level: rarityLevel, rarity });
            }
        }

        const rows = Array.from(userMaxRarity.entries())
            .map(([userId, data]) => ({ userId, rarity: data.rarity, level: data.level }))
            .sort((a, b) => b.level - a.level)
            .slice(0, limit);

        cacheService.set('rarity', rows);
        return rows;
    }

    async getLevelLeaderboard(limit = 10) {
        const cached = cacheService.get('level');
        if (cached) return cached;

        const rows = await db.all(
            `SELECT ulp.userId, ulp.level 
             FROM userLevelProgress ulp
             WHERE ulp.level >= ? 
             ORDER BY ulp.level DESC, ulp.exp DESC LIMIT ?`,
            [LEADERBOARD_CONFIG.MIN_DISPLAY_VALUE.level, limit]
        );

        cacheService.set('level', rows);
        return rows;
    }

    async getRebirthLeaderboard(limit = 10) {
        const cached = cacheService.get('rebirth');
        if (cached) return cached;

        const rows = await db.all(
            `SELECT urp.userId, urp.rebirthCount as rebirth 
             FROM userRebirthProgress urp
             LEFT JOIN userLevelProgress ulp ON urp.userId = ulp.userId
             WHERE urp.rebirthCount > 0 
             ORDER BY urp.rebirthCount DESC, COALESCE(ulp.level, 1) DESC LIMIT ?`,
            [limit]
        );

        cacheService.set('rebirth', rows);
        return rows;
    }

    async getTotalRollsLeaderboard(limit = 10) {
        const cached = cacheService.get('totalRolls');
        if (cached) return cached;

        const rows = await db.all(
            'SELECT userId, totalRolls FROM userCoins WHERE totalRolls >= ? ORDER BY totalRolls DESC LIMIT ?',
            [LEADERBOARD_CONFIG.MIN_DISPLAY_VALUE.totalRolls, limit]
        );

        cacheService.set('totalRolls', rows);
        return rows;
    }

    async getStreakLeaderboard(limit = 10) {
        const cached = cacheService.get('streak');
        if (cached) return cached;

        const rows = await db.all(
            'SELECT userId, dailyStreak FROM userCoins WHERE dailyStreak > 0 ORDER BY dailyStreak DESC LIMIT ?',
            [limit]
        );

        cacheService.set('streak', rows);
        return rows;
    }

    async getYukariMarkLeaderboard(limit = 10) {
        const cached = cacheService.get('yukariMark');
        if (cached) return cached;

        const rows = await db.all(
            'SELECT userId, yukariMark FROM userCoins WHERE yukariMark > 0 ORDER BY yukariMark DESC LIMIT ?',
            [limit]
        );

        cacheService.set('yukariMark', rows);
        return rows;
    }

    async getSpiritTokensLeaderboard(limit = 10) {
        const cached = cacheService.get('spiritTokens');
        if (cached) return cached;

        const rows = await db.all(
            'SELECT userId, spiritTokens FROM userCoins WHERE spiritTokens > 0 ORDER BY spiritTokens DESC LIMIT ?',
            [limit]
        );

        cacheService.set('spiritTokens', rows);
        return rows;
    }

    async getNetWorthLeaderboard(limit = 10) {
        const cached = cacheService.get('netWorth');
        if (cached) return cached;

        const rows = await db.all(
            'SELECT userId, coins, gems, (coins + gems * 10) as netWorth FROM userCoins ORDER BY netWorth DESC LIMIT ?',
            [limit]
        );

        cacheService.set('netWorth', rows);
        return rows;
    }

    async getShinyLeaderboard(limit = 10) {
        const cached = cacheService.get('shiny');
        if (cached) return cached;

        const rows = await db.all(
            `SELECT userId, COUNT(*) as shinyCount 
             FROM userInventory 
             WHERE fumoName LIKE '%✨SHINY%' 
             GROUP BY userId 
             ORDER BY shinyCount DESC 
             LIMIT ?`,
            [limit]
        );

        cacheService.set('shiny', rows);
        return rows;
    }

    async getAlgLeaderboard(limit = 10) {
        const cached = cacheService.get('alg');
        if (cached) return cached;

        const rows = await db.all(
            `SELECT userId, COUNT(*) as algCount 
             FROM userInventory 
             WHERE fumoName LIKE '%🌟alG%' 
             GROUP BY userId 
             ORDER BY algCount DESC 
             LIMIT ?`,
            [limit]
        );

        cacheService.set('alg', rows);
        return rows;
    }

    async getPetsLeaderboard(limit = 10) {
        const cached = cacheService.get('pets');
        if (cached) return cached;

        const rows = await db.all(
            `SELECT userId, COUNT(*) as petCount 
             FROM petInventory 
             GROUP BY userId 
             ORDER BY petCount DESC 
             LIMIT ?`,
            [limit]
        );

        cacheService.set('pets', rows);
        return rows;
    }

    async getItemsLeaderboard(limit = 10) {
        const cached = cacheService.get('items');
        if (cached) return cached;

        const rows = await db.all(
            `SELECT userId, SUM(quantity) as itemCount 
             FROM userInventory 
             WHERE itemName IS NOT NULL 
             GROUP BY userId 
             ORDER BY itemCount DESC 
             LIMIT ?`,
            [limit]
        );

        cacheService.set('items', rows);
        return rows;
    }

    async getCraftsLeaderboard(limit = 10) {
        const cached = cacheService.get('crafts');
        if (cached) return cached;

        const rows = await db.all(
            `SELECT userId, SUM(amount) as totalCrafted 
             FROM craftHistory 
             GROUP BY userId 
             ORDER BY totalCrafted DESC 
             LIMIT ?`,
            [limit]
        );

        cacheService.set('crafts', rows);
        return rows;
    }

    async getGambleWinsLeaderboard(limit = 10) {
        const cached = cacheService.get('gambleWins');
        if (cached) return cached;

        const rows = await db.all(
            'SELECT userId, wins FROM userCoins WHERE wins > 0 ORDER BY wins DESC LIMIT ?',
            [limit]
        );

        cacheService.set('gambleWins', rows);
        return rows;
    }

    async getUserRank(userId, category) {
        const cached = cacheService.getUserCache(`${userId}_${category}`);
        if (cached) return cached;

        let query, params;

        switch (category) {
            case 'coins':
                query = 'SELECT COUNT(*) + 1 as rank FROM userCoins WHERE coins > (SELECT coins FROM userCoins WHERE userId = ?)';
                params = [userId];
                break;
            case 'gems':
                query = 'SELECT COUNT(*) + 1 as rank FROM userCoins WHERE gems > (SELECT gems FROM userCoins WHERE userId = ?)';
                params = [userId];
                break;
            case 'fumos':
                query = `SELECT COUNT(*) + 1 as rank FROM (
                    SELECT COUNT(*) as cnt FROM userInventory WHERE fumoName IS NOT NULL GROUP BY userId
                ) WHERE cnt > (SELECT COUNT(*) FROM userInventory WHERE userId = ? AND fumoName IS NOT NULL)`;
                params = [userId];
                break;
            case 'level':
                query = 'SELECT COUNT(*) + 1 as rank FROM userLevelProgress WHERE level > (SELECT COALESCE(level, 1) FROM userLevelProgress WHERE userId = ?)';
                params = [userId];
                break;
            default:
                return null;
        }

        const result = await db.get(query, params);
        const rank = result?.rank || null;

        cacheService.setUserCache(`${userId}_${category}`, rank);
        return rank;
    }

    getRarity(fumoName) {
        if (!fumoName) return 'Common';
        return Object.keys(LEADERBOARD_CONFIG.RARITY_LEVELS).find(r => fumoName.includes(r)) || 'Common';
    }
}

module.exports = new LeaderboardDataService();