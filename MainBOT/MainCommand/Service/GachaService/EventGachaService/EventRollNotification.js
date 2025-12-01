const { EmbedBuilder, Colors } = require('discord.js');
const { formatNumber } = require('../../../Ultility/formatting');

/**
 * Send a DM to users whose event auto-rolls were restored
 * @param {Client} client - Discord client
 * @param {string} userId - User ID
 * @param {Object} state - Restored state
 */
async function notifyUserEventAutoRollRestored(client, userId, state) {
    try {
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) {
            console.warn(`⚠️ Could not fetch user ${userId} for event notification`);
            return false;
        }

        const uptime = Math.floor((Date.now() - state.startTime) / 1000 / 60); // minutes
        const totalRolls = state.totalFumosRolled || (state.rollCount * 100);
        const gemsSpent = totalRolls * 100;

        const embed = new EmbedBuilder()
            .setTitle('🔄 Event Auto Roll Restored!')
            .setDescription(
                `Your event gacha auto-roll session has been automatically restored after the bot restarted.\n\n` +
                `Your progress has been preserved and will continue where it left off.`
            )
            .addFields([
                {
                    name: '📊 Current Progress',
                    value: 
                        `🎲 **Batches Completed:** ${formatNumber(state.rollCount)}\n` +
                        `🎯 **Total Rolls:** ${formatNumber(totalRolls)}\n` +
                        `💎 **Gems Spent:** ${formatNumber(gemsSpent)}\n` +
                        `⏱️ **Session Duration:** ${uptime} minutes\n` +
                        `${state.autoSell ? '💰 **Auto-Sell:** Enabled (EPIC & LEGENDARY)' : ''}`,
                    inline: false
                }
            ])
            .setColor(Colors.Gold)
            .setTimestamp();

        if (state.totalCoinsFromSales > 0) {
            embed.addFields([
                {
                    name: '💰 Auto-Sell Earnings',
                    value: `Earned **${formatNumber(state.totalCoinsFromSales)}** coins from auto-selling`,
                    inline: false
                }
            ]);
        }

        if (state.bestFumo) {
            const cleanName = state.bestFumo.name
                .replace(/\(.*?\)/g, '')
                .replace(/\[.*?\]/g, '')
                .trim();

            embed.addFields([
                {
                    name: '🏆 Best Fumo So Far',
                    value: `${cleanName} (${state.bestFumo.rarity})\nObtained at batch #${formatNumber(state.bestFumoRoll)}`,
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
                    value: `You've obtained **${state.specialFumoCount}** special fumo(s) (MYTHICAL+) during this session!`,
                    inline: false
                }
            ]);
        }

        embed.setFooter({ 
            text: 'Use "Stop Event Auto" to stop auto-rolling at any time' 
        });

        await user.send({ embeds: [embed] });
        console.log(`📧 Sent event restoration notification to user ${userId}`);
        return true;

    } catch (error) {
        console.warn(`⚠️ Could not send event notification to user ${userId}:`, error.message);
        return false;
    }
}

/**
 * Send event restoration summary to log channel
 * @param {Client} client - Discord client
 * @param {Object} results - Restoration results
 * @param {string} logChannelId - Log channel ID
 */
async function sendEventRestorationSummary(client, results, logChannelId) {
    try {
        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setTitle('🔄 Event Auto-Roll Restoration Summary')
            .setDescription(
                `Bot has restarted and attempted to restore active event auto-rolls.`
            )
            .addFields([
                {
                    name: '✅ Successfully Restored',
                    value: `${results.restored} event auto-roll(s)`,
                    inline: true
                },
                {
                    name: '❌ Failed to Restore',
                    value: `${results.failed} event auto-roll(s)`,
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
                        `• User has insufficient gems\n` +
                        `• User doesn't have Fantasy Book\n` +
                        `• User reached roll limit\n` +
                        `• Database connection issues`,
                    inline: false
                }
            ]);
        }

        await channel.send({ embeds: [embed] });

    } catch (error) {
        console.error('❌ Failed to send event restoration summary:', error);
    }
}

module.exports = {
    notifyUserEventAutoRollRestored,
    sendEventRestorationSummary
};