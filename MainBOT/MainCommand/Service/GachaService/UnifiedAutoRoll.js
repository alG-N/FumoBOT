const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { formatNumber } = require('../../Ultility/formatting');

function createUnifiedRestorationEmbed(normalState, eventState, userId) {
    const embed = new EmbedBuilder()
        .setTitle('🔄 Auto Roll Sessions Restored!')
        .setDescription(
            'Your auto-roll sessions have been automatically restored after the bot restarted.\n\n' +
            'Click the buttons below to view detailed statistics for each gacha type.'
        )
        .setColor(Colors.Green)
        .setTimestamp();

    if (normalState) {
        const uptime = Math.floor((Date.now() - normalState.startTime) / 1000 / 60);
        const totalRolls = normalState.rollCount * 100;
        
        embed.addFields({
            name: '🎁 Normal Gacha',
            value: 
                `✅ **Status:** Active\n` +
                `🎲 **Batches:** ${formatNumber(normalState.rollCount)}\n` +
                `🎯 **Total Rolls:** ${formatNumber(totalRolls)}\n` +
                `⏱️ **Duration:** ${uptime} minutes\n` +
                `${normalState.bestFumo ? `🏆 **Best:** ${normalState.bestFumo.rarity}` : ''}` +
                `${normalState.autoSell ? '\n💰 **Auto-Sell:** ON' : ''}`,
            inline: true
        });
    }

    if (eventState) {
        const uptime = Math.floor((Date.now() - eventState.startTime) / 1000 / 60);
        const totalRolls = eventState.totalFumosRolled || (eventState.rollCount * 100);
        
        embed.addFields({
            name: '🎊 Event Gacha',
            value: 
                `✅ **Status:** Active\n` +
                `🎲 **Batches:** ${formatNumber(eventState.rollCount)}\n` +
                `🎯 **Total Rolls:** ${formatNumber(totalRolls)}\n` +
                `⏱️ **Duration:** ${uptime} minutes\n` +
                `${eventState.bestFumo ? `🏆 **Best:** ${eventState.bestFumo.rarity}` : ''}` +
                `${eventState.autoSell ? '\n💰 **Auto-Sell:** ON' : ''}`,
            inline: true
        });
    }

    if (!normalState && !eventState) {
        embed.setDescription('No active auto-roll sessions were found to restore.');
        embed.setColor(Colors.Grey);
    }

    embed.setFooter({ 
        text: 'Auto-roll sessions will continue where they left off • Use "Stop Roll 100" or "Stop Event Auto" to stop' 
    });

    return embed;
}

function createNormalGachaDetails(state, userId) {
    const uptime = Math.floor((Date.now() - state.startTime) / 1000 / 60);
    const totalRolls = state.rollCount * 100;

    const embed = new EmbedBuilder()
        .setTitle('🎁 Normal Gacha Auto-Roll Details')
        .setDescription('Your normal gacha auto-roll session statistics:')
        .setColor(Colors.Blue)
        .addFields([
            {
                name: '📊 Progress Statistics',
                value: 
                    `🎲 **Batches Completed:** ${formatNumber(state.rollCount)}\n` +
                    `🎯 **Total Rolls:** ${formatNumber(totalRolls)}\n` +
                    `⏱️ **Session Duration:** ${uptime} minutes\n` +
                    `${state.autoSell ? '💰 **Auto-Sell:** Enabled (Selling below EXCLUSIVE)' : '💎 **Auto-Sell:** Disabled'}`,
                inline: false
            }
        ])
        .setTimestamp();

    if (state.bestFumo) {
        const cleanName = state.bestFumo.name
            .replace(/\(.*?\)/g, '')
            .replace(/\[.*?\]/g, '')
            .trim();

        embed.addFields({
            name: '🏆 Best Fumo Obtained',
            value: 
                `**${cleanName}**\n` +
                `Rarity: **${state.bestFumo.rarity}**\n` +
                `Roll #${formatNumber(state.bestFumoRoll)} at ${state.bestFumoAt}`,
            inline: false
        });

        if (state.bestFumo.picture) {
            embed.setThumbnail(state.bestFumo.picture);
        }
    }

    if (state.specialFumoCount > 0) {
        embed.addFields({
            name: '✨ Special Fumos',
            value: 
                `You've obtained **${state.specialFumoCount}** special fumo(s) (EXCLUSIVE+)\n` +
                `${state.specialFumoFirstAt ? `First at roll #${state.specialFumoFirstRoll} (${state.specialFumoFirstAt})` : ''}`,
            inline: false
        });
    }

    return embed;
}

function createEventGachaDetails(state, userId) {
    const uptime = Math.floor((Date.now() - state.startTime) / 1000 / 60);
    const totalRolls = state.totalFumosRolled || (state.rollCount * 100);

    const embed = new EmbedBuilder()
        .setTitle('🎊 Event Gacha Auto-Roll Details')
        .setDescription('Your event gacha auto-roll session statistics:')
        .setColor(Colors.Gold)
        .addFields([
            {
                name: '📊 Progress Statistics',
                value: 
                    `🎲 **Batches Completed:** ${formatNumber(state.rollCount)}\n` +
                    `🎯 **Total Rolls:** ${formatNumber(totalRolls)}\n` +
                    `💎 **Gems Spent:** ${formatNumber(totalRolls * 100)}\n` +
                    `⏱️ **Session Duration:** ${uptime} minutes\n` +
                    `${state.autoSell ? '💰 **Auto-Sell:** Enabled (Selling EPIC & LEGENDARY)' : '💎 **Auto-Sell:** Disabled'}`,
                inline: false
            }
        ])
        .setTimestamp();

    if (state.bestFumo) {
        const cleanName = state.bestFumo.name
            .replace(/\(.*?\)/g, '')
            .replace(/\[.*?\]/g, '')
            .trim();

        embed.addFields({
            name: '🏆 Best Fumo Obtained',
            value: 
                `**${cleanName}**\n` +
                `Rarity: **${state.bestFumo.rarity}**\n` +
                `Roll #${formatNumber(state.bestFumoRoll)} at ${state.bestFumoAt}`,
            inline: false
        });

        if (state.bestFumo.picture) {
            embed.setThumbnail(state.bestFumo.picture);
        }
    }

    if (state.specialFumoCount > 0) {
        embed.addFields({
            name: '✨ Special Fumos',
            value: 
                `You've obtained **${state.specialFumoCount}** special fumo(s) (MYTHICAL+)\n` +
                `${state.specialFumoFirstAt ? `First at roll #${state.specialFumoFirstRoll} (${state.specialFumoFirstAt})` : ''}`,
            inline: false
        });
    }

    return embed;
}

function createDetailsButtons(userId, hasNormal, hasEvent) {
    const buttons = [];

    if (hasNormal) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`viewNormalAutoRoll_${userId}`)
                .setLabel('🎁 Normal Gacha')
                .setStyle(ButtonStyle.Primary)
        );
    }

    if (hasEvent) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`viewEventAutoRoll_${userId}`)
                .setLabel('🎊 Event Gacha')
                .setStyle(ButtonStyle.Success)
        );
    }

    if (buttons.length === 0) return null;

    return new ActionRowBuilder().addComponents(buttons);
}

async function notifyUserUnifiedAutoRoll(client, userId, normalState, eventState) {
    try {
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) {
            console.warn(`⚠️ Could not fetch user ${userId} for notification`);
            return false;
        }

        const embed = createUnifiedRestorationEmbed(normalState, eventState, userId);
        const buttons = createDetailsButtons(userId, !!normalState, !!eventState);

        const messageOptions = { embeds: [embed] };
        if (buttons) {
            messageOptions.components = [buttons];
        }

        await user.send(messageOptions);
        console.log(`📧 Sent unified restoration notification to user ${userId}`);
        return true;

    } catch (error) {
        console.warn(`⚠️ Could not send notification to user ${userId}:`, error.message);
        return false;
    }
}

async function handleDetailsButtonInteraction(interaction, normalStates, eventStates) {
    const userId = interaction.user.id;
    
    if (interaction.customId === `viewNormalAutoRoll_${userId}`) {
        const normalState = normalStates.get(userId);
        if (!normalState) {
            return interaction.reply({
                content: '❌ Normal gacha auto-roll data not found.',
                ephemeral: true
            });
        }

        const embed = createNormalGachaDetails(normalState, userId);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.customId === `viewEventAutoRoll_${userId}`) {
        const eventState = eventStates.get(userId);
        if (!eventState) {
            return interaction.reply({
                content: '❌ Event gacha auto-roll data not found.',
                ephemeral: true
            });
        }

        const embed = createEventGachaDetails(eventState, userId);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
}


async function sendUnifiedRestorationSummary(client, results, logChannelId) {
    try {
        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setTitle('🔄 Auto-Roll Restoration Summary')
            .setDescription('Bot has restarted and attempted to restore active auto-rolls.')
            .addFields([
                {
                    name: '🎁 Normal Gacha',
                    value: 
                        `✅ Restored: ${results.normal.restored}\n` +
                        `❌ Failed: ${results.normal.failed}`,
                    inline: true
                },
                {
                    name: '🎊 Event Gacha',
                    value: 
                        `✅ Restored: ${results.event.restored}\n` +
                        `❌ Failed: ${results.event.failed}`,
                    inline: true
                },
                {
                    name: '📊 Total',
                    value: 
                        `✅ ${results.normal.restored + results.event.restored} restored\n` +
                        `❌ ${results.normal.failed + results.event.failed} failed`,
                    inline: true
                }
            ])
            .setColor(
                (results.normal.failed + results.event.failed) > 0 
                    ? Colors.Orange 
                    : Colors.Green
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });

    } catch (error) {
        console.error('❌ Failed to send restoration summary:', error);
    }
}

module.exports = {
    createUnifiedRestorationEmbed,
    createNormalGachaDetails,
    createEventGachaDetails,
    createDetailsButtons,
    notifyUserUnifiedAutoRoll,
    handleDetailsButtonInteraction,
    sendUnifiedRestorationSummary
};