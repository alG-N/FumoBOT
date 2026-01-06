const { EmbedBuilder } = require('discord.js');
const { checkRestrictions } = require('../../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../../Middleware/buttonOwnership');
const {
    getUserLevel,
    getUnclaimedMilestones,
    claimAllMilestones,
    getLevelLeaderboard
} = require('../../../Service/UserDataService/LevelService/LevelDatabaseService');
const {
    createLevelOverviewEmbed,
    createMilestonesEmbed,
    createFeatureUnlocksEmbed,
    createMilestoneClaimedEmbed,
    createLevelButtons,
    COLORS
} = require('../../../Service/UserDataService/LevelService/LevelUIService');
const { LEVEL_MILESTONES } = require('../../../Configuration/levelConfig');
const { get, all } = require('../../../Core/database');
const { formatNumber } = require('../../../Ultility/formatting');

const INTERACTION_TIMEOUT = 180000;

/**
 * Get claimed milestone levels for a user
 * @param {string} userId 
 * @returns {Promise<number[]>}
 */
async function getClaimedMilestones(userId) {
    const rows = await all(
        `SELECT milestoneLevel FROM userLevelMilestones WHERE userId = ?`,
        [userId]
    );
    
    return rows.map(r => r.milestoneLevel);
}

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        const content = message.content.trim().toLowerCase();
        const args = content.split(/\s+/);
        
        if (args[0] !== '.level' && args[0] !== '.lvl' && args[0] !== '.lv') return;
        
        const userId = message.author.id;
        
        // Check restrictions
        const restriction = checkRestrictions(userId);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }
        
        try {
            // Handle subcommands
            const subcommand = args[1]?.toLowerCase();
            
            // Leaderboard subcommand
            if (subcommand === 'leaderboard' || subcommand === 'lb' || subcommand === 'top') {
                const leaderboard = await getLevelLeaderboard(10);
                
                if (!leaderboard || leaderboard.length === 0) {
                    return message.reply('📊 No level data available yet!');
                }
                
                const entries = await Promise.all(leaderboard.map(async (entry, index) => {
                    let username = 'Unknown User';
                    try {
                        const user = await client.users.fetch(entry.userId);
                        username = user.username;
                    } catch (e) {}
                    
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`${index + 1}.\``;
                    const rebirthStr = entry.rebirth > 0 ? ` ♻️${entry.rebirth}` : '';
                    
                    return `${medal} **${username}** - Lv.${entry.level}${rebirthStr} (${formatNumber(entry.exp)} EXP)`;
                }));
                
                const embed = new EmbedBuilder()
                    .setTitle('🏆 Level Leaderboard')
                    .setColor(COLORS.GOLD)
                    .setDescription(entries.join('\n'))
                    .setFooter({ text: 'Gain EXP from Main Quests, Daily & Weekly quests!' })
                    .setTimestamp();
                
                return message.channel.send({ embeds: [embed] });
            }
            
            // Main level view
            const levelData = await getUserLevel(userId);
            const claimedLevels = await getClaimedMilestones(userId);
            const unclaimed = await getUnclaimedMilestones(userId);
            const hasClaimable = unclaimed.length > 0;
            
            let currentView = 'overview';
            let milestonePage = 0;
            
            const embed = createLevelOverviewEmbed(message.author, levelData);
            const buttons = createLevelButtons(userId, currentView, milestonePage, 
                Math.ceil(LEVEL_MILESTONES.length / 5), hasClaimable);
            
            const sent = await message.channel.send({
                embeds: [embed],
                components: buttons
            });
            
            // Create collector for button interactions
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
                    await interaction.deferUpdate();
                    
                    const customId = interaction.customId;
                    const action = customId.split('_')[1];
                    
                    // Get fresh data
                    const freshLevelData = await getUserLevel(userId);
                    const freshClaimedLevels = await getClaimedMilestones(userId);
                    const freshUnclaimed = await getUnclaimedMilestones(userId);
                    const freshHasClaimable = freshUnclaimed.length > 0;
                    
                    let newEmbed;
                    let newButtons;
                    
                    switch (action) {
                        case 'overview':
                            currentView = 'overview';
                            newEmbed = createLevelOverviewEmbed(message.author, freshLevelData);
                            newButtons = createLevelButtons(userId, currentView, milestonePage,
                                Math.ceil(LEVEL_MILESTONES.length / 5), freshHasClaimable);
                            break;
                            
                        case 'milestones':
                            currentView = 'milestones';
                            const milestoneResult = createMilestonesEmbed(
                                message.author, freshLevelData, freshClaimedLevels, milestonePage
                            );
                            newEmbed = milestoneResult.embed;
                            newButtons = createLevelButtons(userId, currentView, milestonePage,
                                milestoneResult.totalPages, freshHasClaimable);
                            break;
                            
                        case 'features':
                            currentView = 'features';
                            newEmbed = createFeatureUnlocksEmbed(message.author, freshLevelData);
                            newButtons = createLevelButtons(userId, currentView, milestonePage,
                                Math.ceil(LEVEL_MILESTONES.length / 5), freshHasClaimable);
                            break;
                            
                        case 'milestone':
                            // Handle pagination
                            const direction = customId.split('_')[2];
                            if (direction === 'prev' && milestonePage > 0) {
                                milestonePage--;
                            } else if (direction === 'next') {
                                milestonePage++;
                            }
                            
                            const pageResult = createMilestonesEmbed(
                                message.author, freshLevelData, freshClaimedLevels, milestonePage
                            );
                            newEmbed = pageResult.embed;
                            newButtons = createLevelButtons(userId, currentView, milestonePage,
                                pageResult.totalPages, freshHasClaimable);
                            break;
                            
                        case 'claim':
                            // Claim all milestones
                            const claimResult = await claimAllMilestones(userId);
                            
                            if (claimResult.claimed.length === 0) {
                                newEmbed = new EmbedBuilder()
                                    .setTitle('❌ Nothing to Claim')
                                    .setColor(COLORS.DEFAULT)
                                    .setDescription('You have no unclaimed milestones.')
                                    .setTimestamp();
                            } else {
                                const milestoneNames = claimResult.claimed.map(m => `• **${m.name}** (Lv.${m.level})`);
                                newEmbed = new EmbedBuilder()
                                    .setTitle('🎁 Milestones Claimed!')
                                    .setColor(COLORS.SUCCESS)
                                    .setDescription([
                                        '**Milestones:**',
                                        milestoneNames.join('\n'),
                                        '',
                                        '**Total Rewards:**',
                                        claimResult.totalRewards.coins > 0 ? `💰 **${formatNumber(claimResult.totalRewards.coins)}** Coins` : '',
                                        claimResult.totalRewards.gems > 0 ? `💎 **${formatNumber(claimResult.totalRewards.gems)}** Gems` : '',
                                        claimResult.totalRewards.tickets > 0 ? `🎫 **${claimResult.totalRewards.tickets}** Tickets` : ''
                                    ].filter(Boolean).join('\n'))
                                    .setTimestamp();
                            }
                            
                            // Refresh unclaimed status
                            const afterClaimUnclaimed = await getUnclaimedMilestones(userId);
                            newButtons = createLevelButtons(userId, currentView, milestonePage,
                                Math.ceil(LEVEL_MILESTONES.length / 5), afterClaimUnclaimed.length > 0);
                            break;
                            
                        default:
                            return;
                    }
                    
                    await interaction.editReply({
                        embeds: [newEmbed],
                        components: newButtons
                    });
                    
                } catch (error) {
                    console.error('[Level] Interaction error:', error);
                }
            });
            
            collector.on('end', async () => {
                try {
                    await sent.edit({ components: [] }).catch(() => {});
                } catch {}
            });
            
        } catch (error) {
            console.error('[Level] Command error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Error')
                .setDescription('An error occurred while loading level data.')
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    });
};
