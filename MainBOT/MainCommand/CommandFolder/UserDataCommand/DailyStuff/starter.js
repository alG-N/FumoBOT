const { checkRestrictions } = require('../../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../../Middleware/rateLimiter');
const { claimStarter, getStarterStats, hasClaimedStarter } = require('../../../Service/UserDataService/StarterService/StarterService');
const { 
    createPathSelectionEmbed,
    createPathButtons,
    createStarterEmbed, 
    createAlreadyClaimedEmbed, 
    createErrorEmbed,
    createTimeoutEmbed,
    createStatsEmbed 
} = require('../../../Service/UserDataService/StarterService/StarterUIService');
const { logError } = require('../../../Core/logger');
const { STARTER_CONFIG } = require('../../../Configuration/starterConfig');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        const args = message.content.trim().split(/\s+/);
        const command = args[0].toLowerCase();
        
        if (command !== '.starter' && command !== '.start') return;
        
        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }
        
        const cooldown = await checkAndSetCooldown(message.author.id, 'starter', 3000);
        if (cooldown.onCooldown) {
            return message.reply({
                content: `⏱️ Please wait ${cooldown.remaining}s before using this command again.`
            }).catch(() => {});
        }
        
        // Stats subcommand
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
            // Check if already claimed
            const alreadyClaimed = await hasClaimedStarter(message.author.id);
            if (alreadyClaimed) {
                return message.reply({ embeds: [createAlreadyClaimedEmbed()] });
            }
            
            // Show path selection
            const selectionEmbed = createPathSelectionEmbed();
            const buttons = createPathButtons();
            
            const selectionMsg = await message.reply({
                embeds: [selectionEmbed],
                components: [buttons]
            });
            
            // Create button collector
            const filter = (i) => {
                if (i.user.id !== message.author.id) {
                    i.reply({ content: 'This is not your starter selection!', ephemeral: true });
                    return false;
                }
                return i.customId.startsWith('starter_');
            };
            
            const collector = selectionMsg.createMessageComponentCollector({
                filter,
                time: STARTER_CONFIG.SELECTION_TIMEOUT,
                max: 1
            });
            
            collector.on('collect', async (interaction) => {
                const pathId = interaction.customId.replace('starter_', '');
                
                try {
                    const result = await claimStarter(message.author.id, pathId);
                    
                    if (!result.success) {
                        if (result.reason === 'ALREADY_CLAIMED') {
                            await interaction.update({
                                embeds: [createAlreadyClaimedEmbed()],
                                components: []
                            });
                            return;
                        }
                        
                        await interaction.update({
                            embeds: [createErrorEmbed()],
                            components: []
                        });
                        return;
                    }
                    
                    const successEmbed = createStarterEmbed(result, message.author.username);
                    await interaction.update({
                        embeds: [successEmbed],
                        components: []
                    });
                    
                } catch (error) {
                    await logError(client, 'Starter Claim', error, message.author.id);
                    await interaction.update({
                        embeds: [createErrorEmbed(error)],
                        components: []
                    }).catch(() => {});
                }
            });
            
            collector.on('end', async (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    await selectionMsg.edit({
                        embeds: [createTimeoutEmbed()],
                        components: []
                    }).catch(() => {});
                }
            });
            
        } catch (error) {
            await logError(client, 'Starter Command', error, message.author.id);
            return message.reply({ embeds: [createErrorEmbed(error)] });
        }
    });
};