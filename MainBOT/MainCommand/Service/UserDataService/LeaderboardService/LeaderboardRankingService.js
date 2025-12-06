const LEADERBOARD_CONFIG = require('../../../Configuration/leaderboardConfig');
const dataService = require('./LeaderboardDataService');
const { formatNumber } = require('../../../Ultility/formatting');

class LeaderboardRankingService {
    async getRankings(category, limit = 10) {
        switch (category) {
            case 'coins':
                return await dataService.getCoinsLeaderboard(limit);
            case 'gems':
                return await dataService.getGemsLeaderboard(limit);
            case 'fumos':
                return await dataService.getFumosLeaderboard(limit);
            case 'rarity':
                return await dataService.getRarityLeaderboard(limit);
            case 'level':
                return await dataService.getLevelLeaderboard(limit);
            case 'rebirth':
                return await dataService.getRebirthLeaderboard(limit);
            case 'totalRolls':
                return await dataService.getTotalRollsLeaderboard(limit);
            case 'streak':
                return await dataService.getStreakLeaderboard(limit);
            case 'yukariMark':
                return await dataService.getYukariMarkLeaderboard(limit);
            case 'spiritTokens':
                return await dataService.getSpiritTokensLeaderboard(limit);
            case 'netWorth':
                return await dataService.getNetWorthLeaderboard(limit);
            case 'shiny':
                return await dataService.getShinyLeaderboard(limit);
            case 'alg':
                return await dataService.getAlgLeaderboard(limit);
            case 'pets':
                return await dataService.getPetsLeaderboard(limit);
            case 'items':
                return await dataService.getItemsLeaderboard(limit);
            case 'crafts':
                return await dataService.getCraftsLeaderboard(limit);
            case 'gambleWins':
                return await dataService.getGambleWinsLeaderboard(limit);
            default:
                return [];
        }
    }

    async getGlobalRankings() {
        const categories = ['coins', 'gems', 'fumos', 'level', 'totalRolls'];
        const results = {};

        for (const category of categories) {
            results[category] = await this.getRankings(category, 3);
        }

        return results;
    }

    async formatLeaderboardEntry(client, row, rank, category) {
        const user = await client.users.fetch(row.userId).catch(() => null);
        const username = user?.username || `Unknown`;
        const medal = LEADERBOARD_CONFIG.RANK_MEDALS[rank] || '';

        let value;
        switch (category) {
            case 'coins':
                value = formatNumber(row.coins);
                break;
            case 'gems':
                value = formatNumber(row.gems);
                break;
            case 'fumos':
                value = formatNumber(row.fumoCount);
                break;
            case 'rarity':
                value = row.rarity;
                break;
            case 'level':
                value = row.level;
                break;
            case 'rebirth':
                value = row.rebirth;
                break;
            case 'totalRolls':
                value = formatNumber(row.totalRolls);
                break;
            case 'streak':
                value = `${row.dailyStreak} days`;
                break;
            case 'yukariMark':
                value = row.yukariMark;
                break;
            case 'spiritTokens':
                value = formatNumber(row.spiritTokens);
                break;
            case 'netWorth':
                value = formatNumber(row.netWorth);
                break;
            case 'shiny':
                value = formatNumber(row.shinyCount);
                break;
            case 'alg':
                value = formatNumber(row.algCount);
                break;
            case 'pets':
                value = formatNumber(row.petCount);
                break;
            case 'items':
                value = formatNumber(row.itemCount);
                break;
            case 'crafts':
                value = formatNumber(row.totalCrafted);
                break;
            case 'gambleWins':
                value = formatNumber(row.wins);
                break;
            default:
                value = 'N/A';
        }

        return {
            rank,
            medal,
            username,
            userId: row.userId,
            value,
            rawValue: this.getRawValue(row, category)
        };
    }

    getRawValue(row, category) {
        switch (category) {
            case 'coins': return row.coins;
            case 'gems': return row.gems;
            case 'fumos': return row.fumoCount;
            case 'rarity': return row.level;
            case 'level': return row.level;
            case 'rebirth': return row.rebirth;
            case 'totalRolls': return row.totalRolls;
            case 'streak': return row.dailyStreak;
            case 'yukariMark': return row.yukariMark;
            case 'spiritTokens': return row.spiritTokens;
            case 'netWorth': return row.netWorth;
            case 'shiny': return row.shinyCount;
            case 'alg': return row.algCount;
            case 'pets': return row.petCount;
            case 'items': return row.itemCount;
            case 'crafts': return row.totalCrafted;
            case 'gambleWins': return row.wins;
            default: return 0;
        }
    }

    async getUserPosition(userId, category) {
        const rank = await dataService.getUserRank(userId, category);
        return rank;
    }

    getRankEmoji(rank) {
        return LEADERBOARD_CONFIG.RANK_MEDALS[rank] || `#${rank}`;
    }

    getCategoryColor(category) {
        const colorMap = {
            coins: LEADERBOARD_CONFIG.COLORS.COINS,
            gems: LEADERBOARD_CONFIG.COLORS.GEMS,
            fumos: LEADERBOARD_CONFIG.COLORS.FUMOS,
            rarity: LEADERBOARD_CONFIG.COLORS.RARITY,
            level: LEADERBOARD_CONFIG.COLORS.LEVEL,
            rebirth: LEADERBOARD_CONFIG.COLORS.REBIRTH,
            streak: LEADERBOARD_CONFIG.COLORS.STREAK,
            yukariMark: LEADERBOARD_CONFIG.COLORS.YUKARI,
            spiritTokens: LEADERBOARD_CONFIG.COLORS.SPIRIT,
            netWorth: LEADERBOARD_CONFIG.COLORS.NET_WORTH
        };

        return colorMap[category] || LEADERBOARD_CONFIG.COLORS.DEFAULT;
    }
}

module.exports = new LeaderboardRankingService();