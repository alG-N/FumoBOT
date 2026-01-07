const { EmbedBuilder } = require('discord.js');
const { checkRestrictions } = require('../../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../../Middleware/buttonOwnership');
const { getUserLevel } = require('../../../Service/UserDataService/LevelService/LevelDatabaseService');
const {
    getRebirthStatus,
    getUserFumosForSelection,
    performRebirth,
    getUnclaimedRebirthMilestones,
    getClaimedRebirthMilestones,
    claimAllRebirthMilestones
} = require('../../../Service/UserDataService/RebirthService/RebirthDatabaseService');
const {
    createRebirthOverviewEmbed,
    createRebirthConfirmEmbed,
    createFumoSelectionEmbed,
    createRebirthSuccessEmbed,
    createMilestonesEmbed,
    createClaimSuccessEmbed,
    createRebirthButtons,
    createFumoSelectMenu,
    createConfirmButtons,
    COLORS
} = require('../../../Service/UserDataService/RebirthService/RebirthUIService');

const INTERACTION_TIMEOUT = 300000; // 5 minutes for rebirth (important decision)

// Store user rebirth sessions
const rebirthSessions = new Map();

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        const content = message.content.trim().toLowerCase();
        const args = content.split(/\s+/);
        
        if (args[0] !== '.rebirth' && args[0] !== '.rb') return;
        
        const userId = message.author.id;
        
        // Check restrictions
        const restriction = checkRestrictions(userId);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }
        
        try {
            const rebirthData = await getRebirthStatus(userId);
            const levelData = await getUserLevel(userId);
            const unclaimedMilestones = await getUnclaimedRebirthMilestones(userId);
            
            let currentView = 'overview';
            let selectedFumo = null;
            
            const embed = createRebirthOverviewEmbed(message.author, rebirthData, levelData);
            const buttons = createRebirthButtons(userId, currentView, rebirthData.canRebirth, unclaimedMilestones.length);
            
            const sent = await message.channel.send({
                embeds: [embed],
                components: buttons
            });
            
            // Create collector
            const collector = sent.createMessageComponentCollector({
                time: INTERACTION_TIMEOUT,
                filter: (i) => {
                    const ownership = checkButtonOwnership(i);
                    if (!ownership.isOwner) {
                        i.reply({ content: ownership.message, ephemeral: true }).catch(() => {});
                        return false;
                    }
                    return true;
                }
            });
            
            collector.on('collect', async (interaction) => {
                try {
                    // Get fresh data
                    const freshRebirthData = await getRebirthStatus(userId);
                    const freshLevelData = await getUserLevel(userId);
                    
                    const customIdParts = interaction.customId.split('_');
                    const action = customIdParts[1];
                    
                    let newEmbed;
                    let newComponents = [];
                    
                    // Handle dropdown selection
                    if (interaction.isStringSelectMenu()) {
                        selectedFumo = interaction.values[0];
                        await interaction.deferUpdate();
                        
                        const fumos = await getUserFumosForSelection(userId);
                        newEmbed = createFumoSelectionEmbed(message.author, fumos, selectedFumo);
                        newComponents = [
                            createFumoSelectMenu(userId, fumos, selectedFumo),
                            createConfirmButtons(userId, !!selectedFumo)
                        ];
                        
                        await interaction.editReply({
                            embeds: [newEmbed],
                            components: newComponents
                        });
                        return;
                    }
                    
                    await interaction.deferUpdate();
                    
                    // Get fresh unclaimed milestones
                    const freshUnclaimed = await getUnclaimedRebirthMilestones(userId);
                    const freshClaimed = await getClaimedRebirthMilestones(userId);
                    
                    switch (action) {
                        case 'overview':
                            currentView = 'overview';
                            newEmbed = createRebirthOverviewEmbed(message.author, freshRebirthData, freshLevelData);
                            newComponents = createRebirthButtons(userId, currentView, freshRebirthData.canRebirth, freshUnclaimed.length);
                            break;
                            
                        case 'milestones':
                            currentView = 'milestones';
                            newEmbed = createMilestonesEmbed(message.author, freshRebirthData.rebirth, freshClaimed);
                            newComponents = createRebirthButtons(userId, currentView, freshRebirthData.canRebirth, freshUnclaimed.length);
                            break;
                        
                        case 'claim':
                            // Claim all rebirth milestone rewards
                            const claimResult = await claimAllRebirthMilestones(userId);
                            
                            if (claimResult.success && claimResult.claimed.length > 0) {
                                newEmbed = createClaimSuccessEmbed(message.author, claimResult.claimed, claimResult.totalRewards);
                                // Refresh claimed list after claiming
                                const updatedClaimed = await getClaimedRebirthMilestones(userId);
                                const updatedUnclaimed = await getUnclaimedRebirthMilestones(userId);
                                newComponents = createRebirthButtons(userId, 'milestones', freshRebirthData.canRebirth, updatedUnclaimed.length);
                            } else {
                                newEmbed = new EmbedBuilder()
                                    .setTitle('ℹ️ No Rewards to Claim')
                                    .setColor(COLORS.DEFAULT)
                                    .setDescription('You have already claimed all available rebirth milestone rewards.')
                                    .setTimestamp();
                                newComponents = createRebirthButtons(userId, 'milestones', freshRebirthData.canRebirth, 0);
                            }
                            break;
                            
                        case 'start':
                            // Start rebirth process - show fumo selection
                            if (!freshRebirthData.canRebirth) {
                                newEmbed = new EmbedBuilder()
                                    .setTitle('❌ Cannot Rebirth')
                                    .setColor(COLORS.DANGER)
                                    .setDescription(`You need to be Level 100 to rebirth.\nCurrent: Level ${freshLevelData.level}`)
                                    .setTimestamp();
                                newComponents = createRebirthButtons(userId, 'overview', false, freshUnclaimed.length);
                                break;
                            }
                            
                            currentView = 'confirm';
                            selectedFumo = null;
                            
                            const fumos = await getUserFumosForSelection(userId);
                            newEmbed = createFumoSelectionEmbed(message.author, fumos, null);
                            newComponents = [
                                createFumoSelectMenu(userId, fumos, null),
                                createConfirmButtons(userId, false)
                            ];
                            break;
                            
                        case 'cancel':
                            currentView = 'overview';
                            selectedFumo = null;
                            newEmbed = createRebirthOverviewEmbed(message.author, freshRebirthData, freshLevelData);
                            newComponents = createRebirthButtons(userId, currentView, freshRebirthData.canRebirth, freshUnclaimed.length);
                            break;
                            
                        case 'skip':
                            // User wants to keep nothing
                            selectedFumo = null;
                            // Fall through to confirm
                            
                        case 'confirm':
                            // Verify eligibility again
                            if (!freshRebirthData.canRebirth) {
                                newEmbed = new EmbedBuilder()
                                    .setTitle('❌ Cannot Rebirth')
                                    .setColor(COLORS.DANGER)
                                    .setDescription('You are no longer eligible for rebirth.')
                                    .setTimestamp();
                                newComponents = createRebirthButtons(userId, 'overview', false, freshUnclaimed.length);
                                break;
                            }
                            
                            // Perform rebirth
                            const result = await performRebirth(userId, selectedFumo, client);
                            
                            if (!result.success) {
                                newEmbed = new EmbedBuilder()
                                    .setTitle('❌ Rebirth Failed')
                                    .setColor(COLORS.DANGER)
                                    .setDescription(result.message || 'An error occurred during rebirth.')
                                    .setTimestamp();
                                newComponents = createRebirthButtons(userId, 'overview', freshRebirthData.canRebirth, freshUnclaimed.length);
                            } else {
                                newEmbed = createRebirthSuccessEmbed(
                                    message.author,
                                    result.newRebirth,
                                    result.newMultiplier,
                                    result.keptFumo
                                );
                                newComponents = []; // No more buttons after success
                                collector.stop('rebirth_complete');
                            }
                            break;
                            
                        default:
                            return;
                    }
                    
                    await interaction.editReply({
                        embeds: [newEmbed],
                        components: newComponents
                    });
                    
                } catch (error) {
                    console.error('[Rebirth] Interaction error:', error);
                }
            });
            
            collector.on('end', async (collected, reason) => {
                if (reason !== 'rebirth_complete') {
                    try {
                        await sent.edit({ components: [] }).catch(() => {});
                    } catch {}
                }
            });
            
        } catch (error) {
            console.error('[Rebirth] Command error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Error')
                .setDescription('An error occurred while loading rebirth data.')
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    });
};
