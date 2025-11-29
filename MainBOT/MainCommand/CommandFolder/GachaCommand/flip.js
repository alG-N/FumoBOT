const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkAndSetFlipCooldown } = require('../../Middleware/flipRateLimiter');
const { parseFlipCommand, parseLeaderboardCommand } = require('../../Ultility/flipParser');
const { executeSingleFlip, getUserFlipStats } = require('../../Service/GachaService/FlipService/flipGameService');
const {
    getTopPlayersByCurrency,
    getTopPlayersByWins,
    getTopPlayersByWinRate,
    getTopPlayersByGames,
    getUserRank,
    formatLeaderboardData
} = require('../../Service/GachaService/FlipService/FlipGameLeaderboard');
const {
    createHelpEmbed,
    createSingleFlipEmbed,
    createLeaderboardEmbed,
    createStatsEmbed,
    createErrorEmbed
} = require('../../Service/GachaService/FlipService/FlipGameUI');
const { logError } = require('../../Core/logger');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const content = message.content.toLowerCase();

        if (!content.startsWith('.flip') && !content.startsWith('.f')) return;

        try {
            const userId = message.author.id;
            const username = message.author.username;

            if (content.startsWith('.flip leaderboard') || content.startsWith('.f leaderboard')) {
                await handleLeaderboardCommand(client, message, content);
                return;
            }

            if (content.startsWith('.flip stats') || content.startsWith('.f stats')) {
                await handleStatsCommand(client, message, userId, username);
                return;
            }

            if (content.startsWith('.flip stat') || content.startsWith('.f stat')) {
                const embed = createErrorEmbed('TYPO_STATS');
                await message.channel.send({ embeds: [embed] });
                return;
            }

            if (content.startsWith('.flip leaderboards') || content.startsWith('.f leaderboards')) {
                const embed = createErrorEmbed('TYPO_LEADERBOARD');
                await message.channel.send({ embeds: [embed] });
                return;
            }

            if (content === '.flip' || content === '.f') {
                const embed = createHelpEmbed();
                await message.channel.send({ embeds: [embed] });
                return;
            }

            const restriction = checkRestrictions(userId);
            if (restriction.blocked) {
                await message.reply({ embeds: [restriction.embed] });
                return;
            }

            const cooldown = checkAndSetFlipCooldown(userId);
            if (cooldown.onCooldown) {
                const embed = createErrorEmbed('COOLDOWN', { remaining: cooldown.remaining });
                await message.channel.send({ embeds: [embed] });
                return;
            }

            const args = content.replace(/^\.f(lip)?\s+/, '').split(/\s+/);
            const parsed = parseFlipCommand(args);

            if (!parsed.valid) {
                const embed = createErrorEmbed(parsed.error, parsed);
                await message.channel.send({ embeds: [embed] });
                return;
            }

            const result = await executeSingleFlip(
                userId,
                parsed.choice,
                parsed.currency,
                parsed.bet,
                parsed.multiplier
            );

            if (!result.success) {
                const embed = createErrorEmbed(result.error, result);
                await message.channel.send({ embeds: [embed] });
                return;
            }

            const embed = createSingleFlipEmbed(
                result,
                parsed.currency,
                parsed.bet,
                parsed.multiplier
            );
            await message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error('Flip command error:', err);
            await logError(client, 'Flip Command', err, message.author.id);
            
            let errorType = 'GENERIC';
            if (err.message?.includes('SQLITE')) {
                errorType = 'DATABASE_ERROR';
            } else if (err.message?.includes('timeout')) {
                errorType = 'TIMEOUT';
            }
            
            const embed = createErrorEmbed(errorType, { message: err.message });
            await message.channel.send({ embeds: [embed] });
        }
    });
};

async function handleLeaderboardCommand(client, message, content) {
    try {
        const args = content.split(/\s+/).slice(2);
        const parsed = parseLeaderboardCommand(args);

        if (!parsed.valid) {
            const embed = createErrorEmbed('GENERIC', { message: parsed.message });
            await message.channel.send({ embeds: [embed] });
            return;
        }

        const { type } = parsed;
        let rows;
        let category;

        switch (type) {
            case 'coins':
                rows = await getTopPlayersByCurrency('coins');
                category = 'coins';
                break;
            case 'gems':
                rows = await getTopPlayersByCurrency('gems');
                category = 'gems';
                break;
            case 'wins':
                rows = await getTopPlayersByWins();
                category = 'wins';
                break;
            case 'winrate':
                rows = await getTopPlayersByWinRate();
                category = 'winrate';
                break;
            case 'games':
                rows = await getTopPlayersByGames();
                category = 'games';
                break;
            default:
                rows = await getTopPlayersByCurrency('coins');
                category = 'coins';
        }

        if (!rows || rows.length === 0) {
            await message.channel.send('No leaderboard data yet.');
            return;
        }

        const entries = await formatLeaderboardData(client, rows, category);
        
        const userRank = await getUserRank(message.author.id, category);
        
        const embed = createLeaderboardEmbed(entries, category, userRank);
        await message.channel.send({ embeds: [embed] });

    } catch (err) {
        console.error('Leaderboard error:', err);
        await logError(client, 'Flip Leaderboard', err, message.author.id);
        
        const embed = createErrorEmbed('GENERIC', { message: err.message });
        await message.channel.send({ embeds: [embed] });
    }
}

async function handleStatsCommand(client, message, userId, username) {
    try {
        const stats = await getUserFlipStats(userId);
        
        const ranks = {
            Coins: await getUserRank(userId, 'coins'),
            Gems: await getUserRank(userId, 'gems'),
            Wins: await getUserRank(userId, 'wins'),
            'Win Rate': await getUserRank(userId, 'winrate'),
            Games: await getUserRank(userId, 'games')
        };
        
        const embed = createStatsEmbed(username, stats, ranks);
        await message.channel.send({ embeds: [embed] });

    } catch (err) {
        console.error('Stats error:', err);
        await logError(client, 'Flip Stats', err, userId);
        
        const embed = createErrorEmbed('STATS_ERROR', { message: err.message });
        await message.channel.send({ embeds: [embed] });
    }
}