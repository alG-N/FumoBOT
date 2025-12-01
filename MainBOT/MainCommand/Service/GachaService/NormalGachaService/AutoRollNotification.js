const { EmbedBuilder, Colors } = require('discord.js');
const { formatNumber } = require('../../../Ultility/formatting');

/**
 * Send a DM to users whose auto-rolls were restored
 * @param {Client} client - Discord client
 * @param {string} userId - User ID
 * @param {Object} state - Restored state
 */
async function notifyUserAutoRollRestored(client, userId, state) {
    try {
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) {
            console.warn(`⚠️ Could not fetch user ${userId} for notification`);
            return false;
        }

        const uptime = Math.floor((Date.now() - state.startTime) / 1000 / 60); // minutes
        const totalRolls = state.rollCount * 100;

        const embed = new EmbedBuilder()
            .setTitle('🔄 Auto Roll Restored!')
            .setDescription(
                `Your auto-roll session has been automatically restored after the bot restarted.\n\n` +
                `Your progress has been preserved and will continue where it left off. **You can turn off the FumoBOT Notification by turning off in Discord if you want!**`
            )
            .addFields([
                {
                    name: '📊 Current Progress',
                    value: 
                        `🎲 **Batches Completed:** ${formatNumber(state.rollCount)}\n` +
                        `🎯 **Total Rolls:** ${formatNumber(totalRolls)}\n` +
                        `⏱️ **Session Duration:** ${uptime} minutes\n` +
                        `${state.autoSell ? '💰 **Auto-Sell:** Enabled' : ''}`,
                    inline: false
                }
            ])
            .setColor(Colors.Green)
            .setTimestamp();

        if (state.bestFumo) {
            const cleanName = state.bestFumo.name
                .replace(/\(.*?\)/g, '')
                .replace(/\[.*?\]/g, '')
                .trim();

            embed.addFields([
                {
                    name: '🏆 Best Fumo So Far',
                    value: `${cleanName} (${state.bestFumo.rarity})\nObtained at roll #${formatNumber(state.bestFumoRoll)}`,
                    inline: false
                }
            ]);

            if (state.bestFumo.picture) {
                embed.setThumbnail(state.bestFumo.picture);
            }
        }

        if (state.specialFumoCount > 0) {
            embed.addFields([
                {
                    name: '✨ Special Fumos',
                    value: `You've obtained **${state.specialFumoCount}** special fumo(s) during this session!`,
                    inline: false
                }
            ]);
        }

        embed.setFooter({ 
            text: 'Use "Stop Roll 100" to stop auto-rolling at any time' 
        });

        await user.send({ embeds: [embed] });
        console.log(`📧 Sent restoration notification to user ${userId}`);
        return true;

    } catch (error) {
        // User might have DMs disabled
        console.warn(`⚠️ Could not send notification to user ${userId}:`, error.message);
        return false;
    }
}

/**
 * Send restoration summary to log channel
 * @param {Client} client - Discord client
 * @param {Object} results - Restoration results
 * @param {string} logChannelId - Log channel ID
 */
async function sendRestorationSummary(client, results, logChannelId) {
    try {
        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setTitle('🔄 Auto-Roll Restoration Summary')
            .setDescription(
                `Bot has restarted and attempted to restore active auto-rolls.`
            )
            .addFields([
                {
                    name: '✅ Successfully Restored',
                    value: `${results.restored} auto-roll(s)`,
                    inline: true
                },
                {
                    name: '❌ Failed to Restore',
                    value: `${results.failed} auto-roll(s)`,
                    inline: true
                },
                {
                    name: '📊 Total Attempts',
                    value: `${results.restored + results.failed}`,
                    inline: true
                }
            ])
            .setColor(results.failed > 0 ? Colors.Orange : Colors.Green)
            .setTimestamp();

        if (results.failed > 0) {
            embed.addFields([
                {
                    name: '⚠️ Common Failure Reasons',
                    value: 
                        `• User has insufficient coins\n` +
                        `• User account not found\n` +
                        `• Database connection issues`,
                    inline: false
                }
            ]);
        }

        await channel.send({ embeds: [embed] });

    } catch (error) {
        console.error('❌ Failed to send restoration summary:', error);
    }
}

module.exports = {
    notifyUserAutoRollRestored,
    sendRestorationSummary
};