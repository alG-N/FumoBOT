function parseQuestCommand(args) {
    if (!args || args.length === 0) {
        return {
            action: 'menu',
            valid: true
        };
    }

    const command = args[0].toLowerCase();

    switch (command) {
        case 'daily':
        case 'd':
            return {
                action: 'daily',
                valid: true
            };

        case 'weekly':
        case 'w':
            return {
                action: 'weekly',
                valid: true
            };

        case 'achievement':
        case 'achievements':
        case 'ach':
        case 'a':
            return {
                action: 'achievements',
                valid: true,
                category: args[1] || null
            };

        case 'claim':
        case 'cl':
            return {
                action: 'claim',
                valid: true,
                type: args[1] || 'all'
            };

        case 'history':
        case 'h':
            return {
                action: 'history',
                valid: true,
                limit: parseInt(args[1]) || 20
            };

        case 'stats':
        case 's':
            return {
                action: 'stats',
                valid: true
            };

        case 'pin':
            if (!args[1]) {
                return {
                    valid: false,
                    error: 'MISSING_QUEST_ID'
                };
            }
            return {
                action: 'pin',
                valid: true,
                questId: args[1],
                type: args[2] || 'daily'
            };

        case 'unpin':
            if (!args[1]) {
                return {
                    valid: false,
                    error: 'MISSING_QUEST_ID'
                };
            }
            return {
                action: 'unpin',
                valid: true,
                questId: args[1]
            };

        case 'pinned':
            return {
                action: 'pinned',
                valid: true
            };

        case 'reroll':
            return {
                action: 'reroll',
                valid: true,
                type: args[1] || 'daily'
            };

        case 'chain':
        case 'chains':
            return {
                action: 'chains',
                valid: true,
                chainId: args[1] || null
            };

        case 'category':
        case 'cat':
            if (!args[1]) {
                return {
                    valid: false,
                    error: 'MISSING_CATEGORY'
                };
            }
            return {
                action: 'category',
                valid: true,
                category: args[1]
            };

        case 'leaderboard':
        case 'lb':
            return {
                action: 'leaderboard',
                valid: true,
                type: args[1] || 'completion'
            };

        case 'help':
            return {
                action: 'help',
                valid: true
            };

        default:
            return {
                valid: false,
                error: 'INVALID_COMMAND',
                command
            };
    }
}

function parseClaimType(arg) {
    if (!arg) return 'all';
    
    const normalized = arg.toLowerCase();
    const validTypes = ['daily', 'd', 'weekly', 'w', 'achievement', 'ach', 'a', 'all'];
    
    if (!validTypes.includes(normalized)) {
        return null;
    }
    
    const typeMap = {
        'd': 'daily',
        'w': 'weekly',
        'ach': 'achievement',
        'a': 'achievement'
    };
    
    return typeMap[normalized] || normalized;
}

function parseQuestId(questIdStr) {
    if (!questIdStr) return null;
    
    const cleaned = questIdStr.toLowerCase().replace(/[^a-z0-9_]/g, '');
    return cleaned;
}

function parseCategory(categoryStr) {
    if (!categoryStr) return null;
    
    const validCategories = [
        'gacha', 'prayer', 'economy', 'gamble', 'crafting', 
        'collection', 'meta', 'hidden', 'challenge', 'social'
    ];
    
    const normalized = categoryStr.toLowerCase();
    
    if (!validCategories.includes(normalized)) {
        return null;
    }
    
    return normalized;
}

function parseTier(tierStr) {
    if (!tierStr) return null;
    
    const validTiers = ['bronze', 'silver', 'gold', 'platinum'];
    const normalized = tierStr.toLowerCase();
    
    if (!validTiers.includes(normalized)) {
        return null;
    }
    
    return normalized;
}

function parseLimit(limitStr, min = 1, max = 100, defaultValue = 20) {
    if (!limitStr) return defaultValue;
    
    const limit = parseInt(limitStr, 10);
    
    if (isNaN(limit)) return defaultValue;
    if (limit < min) return min;
    if (limit > max) return max;
    
    return limit;
}

function parseRerollType(typeStr) {
    if (!typeStr) return 'daily';
    
    const normalized = typeStr.toLowerCase();
    const validTypes = ['daily', 'd', 'weekly', 'w'];
    
    if (!validTypes.includes(normalized)) {
        return null;
    }
    
    return normalized === 'd' ? 'daily' : normalized === 'w' ? 'weekly' : normalized;
}

function validateQuestAction(action) {
    const validActions = [
        'menu', 'daily', 'weekly', 'achievements', 'claim',
        'history', 'stats', 'pin', 'unpin', 'pinned',
        'reroll', 'chains', 'category', 'leaderboard', 'help'
    ];
    
    return validActions.includes(action);
}

function parseLeaderboardType(typeStr) {
    if (!typeStr) return 'completion';
    
    const normalized = typeStr.toLowerCase();
    const validTypes = [
        'completion', 'daily', 'weekly', 'achievements',
        'streak', 'points', 'speed'
    ];
    
    if (!validTypes.includes(normalized)) {
        return null;
    }
    
    return normalized;
}

module.exports = {
    parseQuestCommand,
    parseClaimType,
    parseQuestId,
    parseCategory,
    parseTier,
    parseLimit,
    parseRerollType,
    validateQuestAction,
    parseLeaderboardType
};