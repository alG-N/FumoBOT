const { checkRestrictions } = require('../../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../../Middleware/rateLimiter');
const { claimStarter, getStarterStats } = require('../../../Service/UserDataService/StarterService/StarterService');
const { 
    createStarterEmbed, 
    createAlreadyClaimedEmbed, 
    createErrorEmbed,
    createStatsEmbed 
} = require('../../../Service/UserDataService/StarterService/StarterUIService');
const { logError } = require('../../../Core/logger');
const { STARTER_CONFIG } = require('../../../Configuration/starterConfig');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        const args = message.content.trim().split(/\s+/);
        const command = args[0].toLowerCase();
        
        if (command !== '.starter') return;
        
        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }
        
        const cooldown = await checkAndSetCooldown(message.author.id, 'starter', 3000);
        if (cooldown.onCooldown) {
            return message.reply({
                content: `⏱️ Please wait ${cooldown.remaining}s before using this command again.`,
                ephemeral: true
            }).catch(() => {});
        }
        
        if (args[1]?.toLowerCase() === 'stats') {
            try {
                const stats = await getStarterStats(message.author.id);
                const embed = createStatsEmbed(stats, message.author.username);
                return message.reply({ embeds: [embed] });
            } catch (error) {
                await logError(client, 'Starter Stats Command', error, message.author.id);
                return message.reply({ embeds: [createErrorEmbed(error)] });
            }
        }
        
        try {
            const result = await claimStarter(message.author.id);
            
            if (!result.success) {
                if (result.reason === 'ALREADY_CLAIMED') {
                    const embed = createAlreadyClaimedEmbed();
                    return message.reply({ embeds: [embed], ephemeral: true });
                }
                
                return message.reply({ embeds: [createErrorEmbed()] });
            }
            
            const embed = createStarterEmbed(result.reward, message.author.username);
            const reply = await message.reply({ embeds: [embed] });
            
            setTimeout(() => {
                message.delete().catch(() => {});
            }, STARTER_CONFIG.MESSAGE_TIMEOUT);
            
        } catch (error) {
            await logError(client, 'Starter Command', error, message.author.id);
            return message.reply({ embeds: [createErrorEmbed(error)] });
        }
    });
};