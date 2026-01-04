/**
 * Main Quest UI Service
 * 
 * Creates embeds and UI components for the main quest system.
 * Features alterGolden as the quest giver with story-driven dialog.
 */

const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const { 
    QUEST_GIVER, 
    DIFFICULTY, 
    getQuestById, 
    getDifficultyInfo,
    calculateQuestExp,
    getTotalMainQuests 
} = require('../../../Configuration/mainQuestConfig.js');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership.js');

// ═══════════════════════════════════════════════════════════════════
// EMBED CREATORS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create the main quest overview embed
 * @param {Object} params
 * @param {Object} params.progress - User's main quest progress
 * @param {Object} params.stats - Completion stats
 * @param {Object} params.questProgress - Current quest progress
 * @param {Object} params.user - Discord user object
 * @returns {EmbedBuilder}
 */
function createMainQuestOverviewEmbed({ progress, stats, questProgress, user }) {
    const currentQuest = stats.currentQuest;
    const difficulty = currentQuest ? getDifficultyInfo(currentQuest.difficulty) : null;
    
    const embed = new EmbedBuilder()
        .setColor(difficulty?.color || QUEST_GIVER.color)
        .setAuthor({
            name: `${QUEST_GIVER.emoji} ${QUEST_GIVER.name} - ${QUEST_GIVER.title}`,
            iconURL: QUEST_GIVER.avatar || user.displayAvatarURL()
        })
        .setThumbnail(user.displayAvatarURL({ dynamic: true }));
    
    if (stats.allCompleted) {
        embed.setTitle('🎊 All Main Quests Completed!')
            .setDescription(
                "```\n" +
                "Congratulations, Master Collector!\n" +
                "You have completed all main quests.\n" +
                "Your journey continues beyond...\n" +
                "```"
            )
            .addFields({
                name: '📊 Final Stats',
                value: `**Quests Completed:** ${stats.completed}/${stats.total}\n` +
                       `**Completion:** 100%`,
                inline: false
            });
    } else {
        embed.setTitle(`📜 Main Quest ${currentQuest.id}/${getTotalMainQuests()}: ${currentQuest.title}`)
            .setDescription(formatStoryText(currentQuest.story));
        
        // Progress bar
        const progressBar = createProgressBar(questProgress.progress, questProgress.required);
        
        embed.addFields(
            {
                name: `📋 Objective`,
                value: `**${currentQuest.teaches}**\n${currentQuest.hint}`,
                inline: false
            },
            {
                name: '📈 Progress',
                value: `${progressBar}\n` +
                       `**${questProgress.progress}** / **${questProgress.required}**`,
                inline: true
            },
            {
                name: '⭐ Difficulty',
                value: `**${difficulty.name}**\n(${difficulty.expMultiplier}x EXP)`,
                inline: true
            },
            {
                name: '🎁 Rewards',
                value: formatRewards(currentQuest.rewards, calculateQuestExp(currentQuest)),
                inline: true
            }
        );
        
        // Overall progress
        embed.addFields({
            name: '📊 Overall Progress',
            value: `**${stats.completed}** / **${stats.total}** quests (${stats.percentage}%)`,
            inline: false
        });
    }
    
    embed.setFooter({ 
        text: `${user.username}'s Main Quest Progress`,
        iconURL: user.displayAvatarURL()
    })
    .setTimestamp();
    
    return embed;
}

/**
 * Create quest completion embed
 * @param {Object} params
 * @param {Object} params.quest - Completed quest
 * @param {Object} params.rewards - Rewards given
 * @param {Object} params.nextQuest - Next quest or null
 * @param {boolean} params.allCompleted - Whether all quests done
 * @param {Object} params.user - Discord user
 * @returns {EmbedBuilder}
 */
function createQuestCompletionEmbed({ quest, rewards, nextQuest, allCompleted, user }) {
    const difficulty = getDifficultyInfo(quest.difficulty);
    
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setAuthor({
            name: `${QUEST_GIVER.emoji} ${QUEST_GIVER.name}`,
            iconURL: user.displayAvatarURL()
        })
        .setTitle(`✅ Quest Complete: ${quest.title}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }));
    
    // Completion message
    let completionMessage = "Excellent work, collector!";
    if (quest.id >= 25) completionMessage = "Outstanding achievement!";
    if (quest.id >= 28) completionMessage = "You're becoming a legend!";
    if (quest.id === 30) completionMessage = "You have transcended... A new journey begins!";
    
    embed.setDescription(`*"${completionMessage}"*`);
    
    // Rewards
    embed.addFields({
        name: '🎁 Rewards Claimed',
        value: `${rewards.exp > 0 ? `✨ **${rewards.exp.toLocaleString()}** EXP\n` : ''}` +
               `${rewards.coins > 0 ? `🪙 **${rewards.coins.toLocaleString()}** Coins\n` : ''}` +
               `${rewards.gems > 0 ? `💎 **${rewards.gems.toLocaleString()}** Gems\n` : ''}` +
               `${rewards.tickets > 0 ? `🎟️ **${rewards.tickets.toLocaleString()}** Tickets` : ''}`,
        inline: false
    });
    
    // Next quest preview
    if (nextQuest && !allCompleted) {
        const nextDiff = getDifficultyInfo(nextQuest.difficulty);
        embed.addFields({
            name: `📜 Next Quest: ${nextQuest.title}`,
            value: `*Difficulty: ${nextDiff.name}*\n` +
                   `*Teaches: ${nextQuest.teaches}*`,
            inline: false
        });
    } else if (allCompleted) {
        embed.addFields({
            name: '🎊 All Quests Completed!',
            value: 'You have finished all main quests!\nYour legend will live on...',
            inline: false
        });
    }
    
    embed.setFooter({ 
        text: `Quest ${quest.id}/${getTotalMainQuests()} completed`,
        iconURL: user.displayAvatarURL()
    })
    .setTimestamp();
    
    return embed;
}

/**
 * Create story dialog embed (for reading quest stories)
 * @param {Object} quest 
 * @param {Object} user 
 * @returns {EmbedBuilder}
 */
function createStoryDialogEmbed(quest, user) {
    const difficulty = getDifficultyInfo(quest.difficulty);
    
    return new EmbedBuilder()
        .setColor(QUEST_GIVER.color)
        .setAuthor({
            name: `${QUEST_GIVER.emoji} ${QUEST_GIVER.name} speaks...`,
            iconURL: user.displayAvatarURL()
        })
        .setTitle(`📖 ${quest.title}`)
        .setDescription(
            "```\n" +
            quest.story.join('\n') +
            "\n```"
        )
        .addFields({
            name: '💡 Hint',
            value: quest.hint,
            inline: false
        })
        .setFooter({ text: `Quest ${quest.id} - ${difficulty.name} Difficulty` })
        .setTimestamp();
}

/**
 * Create quest list embed (showing all quests)
 * @param {Object[]} completedQuests - Array of completed quest objects
 * @param {number} currentQuestId 
 * @param {Object} user 
 * @param {number} page 
 * @returns {EmbedBuilder}
 */
function createQuestListEmbed(completedQuests, currentQuestId, user, page = 0) {
    const totalQuests = getTotalMainQuests();
    const questsPerPage = 10;
    const totalPages = Math.ceil(totalQuests / questsPerPage);
    const startIdx = page * questsPerPage;
    const endIdx = Math.min(startIdx + questsPerPage, totalQuests);
    
    const completedIds = new Set(completedQuests.map(q => q.questId));
    
    const embed = new EmbedBuilder()
        .setColor(QUEST_GIVER.color)
        .setAuthor({
            name: `${QUEST_GIVER.emoji} ${QUEST_GIVER.name}'s Quest Log`,
            iconURL: user.displayAvatarURL()
        })
        .setTitle('📜 Main Quest List')
        .setDescription('Your journey through the main quest line:');
    
    let questList = '';
    for (let i = startIdx + 1; i <= endIdx; i++) {
        const quest = getQuestById(i);
        if (!quest) continue;
        
        const difficulty = getDifficultyInfo(quest.difficulty);
        let status;
        
        if (completedIds.has(i)) {
            status = '✅';
        } else if (i === currentQuestId) {
            status = '🔸';
        } else {
            status = '🔒';
        }
        
        questList += `${status} **${i}.** ${quest.title} *(${difficulty.name})*\n`;
    }
    
    embed.addFields({
        name: `Quests ${startIdx + 1}-${endIdx}`,
        value: questList || 'No quests available',
        inline: false
    });
    
    embed.setFooter({ 
        text: `Page ${page + 1}/${totalPages} • ✅ Completed • 🔸 Current • 🔒 Locked`,
        iconURL: user.displayAvatarURL()
    })
    .setTimestamp();
    
    return embed;
}

// ═══════════════════════════════════════════════════════════════════
// BUTTON CREATORS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create main quest navigation buttons
 * @param {string} userId 
 * @param {Object} stats 
 * @returns {ActionRowBuilder}
 */
function createMainQuestButtons(userId, stats) {
    const row = new ActionRowBuilder();
    
    // Story button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('mq_story', userId))
            .setLabel('Read Story')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(stats.allCompleted)
    );
    
    // Quest List button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('mq_list', userId))
            .setLabel('Quest List')
            .setEmoji('📜')
            .setStyle(ButtonStyle.Secondary)
    );
    
    // Refresh button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('mq_refresh', userId))
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Success)
    );
    
    // Back to Quest button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('mq_back', userId))
            .setLabel('Back')
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
    );
    
    return row;
}

/**
 * Create quest list pagination buttons
 * @param {string} userId 
 * @param {number} currentPage 
 * @param {number} totalPages 
 * @returns {ActionRowBuilder}
 */
function createQuestListButtons(userId, currentPage, totalPages) {
    const row = new ActionRowBuilder();
    
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId(`mq_list_${currentPage - 1}`, userId))
            .setLabel('Previous')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 0)
    );
    
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('mq_refresh', userId))
            .setLabel('Overview')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Primary)
    );
    
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId(`mq_list_${currentPage + 1}`, userId))
            .setLabel('Next')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1)
    );
    
    return row;
}

/**
 * Create the Main Quest button for .quest command
 * @param {string} userId 
 * @returns {ButtonBuilder}
 */
function createMainQuestButtonForQuestCmd(userId) {
    return new ButtonBuilder()
        .setCustomId(buildSecureCustomId('open_main_quest', userId))
        .setLabel('alterGolden')
        .setEmoji('👤')
        .setStyle(ButtonStyle.Secondary);
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format story text with proper styling
 * @param {string[]} storyLines 
 * @returns {string}
 */
function formatStoryText(storyLines) {
    return "```\n" + storyLines.join('\n') + "\n```";
}

/**
 * Create a visual progress bar
 * @param {number} current 
 * @param {number} max 
 * @param {number} length 
 * @returns {string}
 */
function createProgressBar(current, max, length = 10) {
    const percentage = Math.min(current / max, 1);
    const filled = Math.floor(percentage * length);
    const empty = length - filled;
    
    const filledChar = '█';
    const emptyChar = '░';
    
    return `[${filledChar.repeat(filled)}${emptyChar.repeat(empty)}]`;
}

/**
 * Format rewards into a readable string
 * @param {Object} rewards 
 * @param {number} calculatedExp 
 * @returns {string}
 */
function formatRewards(rewards, calculatedExp) {
    const parts = [];
    
    if (calculatedExp > 0) parts.push(`✨ ${calculatedExp.toLocaleString()} EXP`);
    if (rewards.coins > 0) parts.push(`🪙 ${rewards.coins.toLocaleString()}`);
    if (rewards.gems > 0) parts.push(`💎 ${rewards.gems.toLocaleString()}`);
    if (rewards.tickets > 0) parts.push(`🎟️ ${rewards.tickets}`);
    
    return parts.join('\n') || 'None';
}

module.exports = {
    // Embeds
    createMainQuestOverviewEmbed,
    createQuestCompletionEmbed,
    createStoryDialogEmbed,
    createQuestListEmbed,
    
    // Buttons
    createMainQuestButtons,
    createQuestListButtons,
    createMainQuestButtonForQuestCmd,
    
    // Helpers
    formatStoryText,
    createProgressBar,
    formatRewards
};
