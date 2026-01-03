const { checkRestrictions } = require('../../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../../Middleware/rateLimiter');
const { claimDaily, getDailyStatus, getDailyLeaderboard } = require('../../../Service/UserDataService/DailyService/DailyService');
const { 
    createDailyEmbed, 
    createCooldownEmbed, 
    createNoAccountEmbed, 
    createErrorEmbed,
    createLeaderboardEmbed 
} = require('../../../Service/UserDataService/DailyService/DailyUIService');
const { logError } = require('../../../Core/logger');
const { DAILY_CONFIG } = require('../../../Configuration/dailyConfig');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        const match = message.content.match(/^\.d(aily)?(\s+(.+))?$/i);
        if (!match) return;
        
        const subcommand = match[3]?.toLowerCase();
        
        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }
        
        // Leaderboard subcommand
        if (subcommand === 'leaderboard' || subcommand === 'lb') {
            try {
                const leaderboard = await getDailyLeaderboard(10);
                const embed = createLeaderboardEmbed(leaderboard, client);
                return message.reply({ embeds: [embed] });
            } catch (error) {
                await logError(client, 'Daily Leaderboard Command', error, message.author.id);
                return message.reply({ embeds: [createErrorEmbed(error)] });
            }
        }
        
        // Status subcommand
        if (subcommand === 'status' || subcommand === 's') {
            try {
                const status = await getDailyStatus(message.author.id);
                
                if (!status.exists) {
                    return message.reply({ embeds: [createNoAccountEmbed()] });
                }
                
                if (!status.canClaim) {
                    const embed = createCooldownEmbed(
                        status.timeRemaining,
                        status.streak,
                        status.nextMilestone,
                        message.author.username
                    );
                    return message.reply({ embeds: [embed] });
                }
                
                return message.reply({
                    content: `✅ Your daily is ready to claim! Use \`.daily\` to get your rewards.\n🔥 Current streak: **${status.streak}** day${status.streak !== 1 ? 's' : ''}`
                });
            } catch (error) {
                await logError(client, 'Daily Status Command', error, message.author.id);
                return message.reply({ embeds: [createErrorEmbed(error)] });
            }
        }
        
        // Main claim command
        const cooldown = await checkAndSetCooldown(message.author.id, 'daily', 3000);
        if (cooldown.onCooldown) {
            return message.reply({
                content: `⏱️ Please wait ${cooldown.remaining}s before using this command again.`
            }).catch(() => {});
        }
        
        try {
            const result = await claimDaily(message.author.id);
            
            if (!result.success) {
                if (result.reason === 'NO_ACCOUNT') {
                    const embed = createNoAccountEmbed();
                    const msg = await message.reply({ embeds: [embed] });
                    setTimeout(() => msg.delete().catch(() => {}), DAILY_CONFIG.MESSAGE_TIMEOUT);
                    return;
                }
                
                if (result.reason === 'ON_COOLDOWN') {
                    const embed = createCooldownEmbed(
                        result.timeRemaining, 
                        result.streak,
                        result.nextMilestone,
                        message.author.username
                    );
                    const msg = await message.reply({ embeds: [embed] });
                    setTimeout(() => msg.delete().catch(() => {}), DAILY_CONFIG.MESSAGE_TIMEOUT);
                    return;
                }
                
                return message.reply({ embeds: [createErrorEmbed()] });
            }
            
            const embed = createDailyEmbed(result, message.author.username);
            const sentMsg = await message.reply({ embeds: [embed] });
            
            setTimeout(() => {
                sentMsg.delete().catch(() => {});
            }, DAILY_CONFIG.MESSAGE_TIMEOUT);
            
        } catch (error) {
            await logError(client, 'Daily Command', error, message.author.id);
            return message.reply({ embeds: [createErrorEmbed(error)] });
        }
    });
};