const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Colors } = require('discord.js');
const { 
    getUserNotificationPreferences, 
    setUserNotificationPreference 
} = require('./NotificationPreferenceService');

function createDisableNotificationButton(userId, type) {
    return new ButtonBuilder()
        .setCustomId(`disableNotification_${type}_${userId}`)
        .setLabel('🔕 Disable Notifications')
        .setStyle(ButtonStyle.Secondary);
}

function addDisableNotificationButton(existingRow, userId, type) {
    const components = existingRow.components;
    
    if (components.length >= 5) {
        const newRow = new ActionRowBuilder().addComponents(
            createDisableNotificationButton(userId, type)
        );
        return [existingRow, newRow];
    }
    
    components.push(createDisableNotificationButton(userId, type));
    return [existingRow];
}

function createConfirmationEmbed(type) {
    const gachaName = type === 'normal' ? 'Normal Gacha' : 'Event Gacha';
    
    return new EmbedBuilder()
        .setTitle('⚠️ Disable Notification Warning')
        .setDescription(
            `You are about to disable auto-roll restoration notifications for **${gachaName}**.\n\n` +
            `**What this means:**\n` +
            `• You will NOT be notified when the bot restarts and restores your auto-roll session\n` +
            `• You will NOT see what fumos you got during the restoration\n` +
            `• Your auto-roll will still continue working normally\n\n` +
            `**Why disable this?**\n` +
            `If the bot owner restarts frequently, you may get too many notification messages.\n\n` +
            `Are you sure you want to proceed?`
        )
        .setColor(Colors.Orange)
        .setFooter({ text: 'You can re-enable this later in the auto-roll summary' })
        .setTimestamp();
}

function createConfirmationButtons(userId, type) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`confirmDisableNotif_${type}_${userId}`)
            .setLabel('✅ Yes, Disable')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`cancelDisableNotif_${type}_${userId}`)
            .setLabel('❌ No, Keep Enabled')
            .setStyle(ButtonStyle.Secondary)
    );
}

function createDisabledConfirmationEmbed(type) {
    const gachaName = type === 'normal' ? 'Normal Gacha' : 'Event Gacha';
    
    return new EmbedBuilder()
        .setTitle('🔕 Notifications Disabled')
        .setDescription(
            `Auto-roll restoration notifications for **${gachaName}** have been disabled.\n\n` +
            `You can re-enable them at any time by clicking the "Enable Notifications" button in the auto-roll summary.`
        )
        .setColor(Colors.Green)
        .setTimestamp();
}

function createCancelledEmbed() {
    return new EmbedBuilder()
        .setTitle('✅ Cancelled')
        .setDescription('Notification settings remain unchanged.')
        .setColor(Colors.Blue)
        .setTimestamp();
}

function createEnableNotificationButton(userId, type) {
    return new ButtonBuilder()
        .setCustomId(`enableNotification_${type}_${userId}`)
        .setLabel('🔔 Enable Notifications')
        .setStyle(ButtonStyle.Success);
}

function updateSummaryWithNotificationButton(components, userId, type) {
    const prefs = getUserNotificationPreferences(userId);
    const isDisabled = type === 'normal' ? !prefs.normalGacha : !prefs.eventGacha;
    
    if (isDisabled) {
        const enableButton = createEnableNotificationButton(userId, type);
        
        if (components.length > 0) {
            const lastRow = components[components.length - 1];
            if (lastRow.components.length < 5) {
                lastRow.components.push(enableButton);
            } else {
                components.push(new ActionRowBuilder().addComponents(enableButton));
            }
        } else {
            components.push(new ActionRowBuilder().addComponents(enableButton));
        }
    }
    
    return components;
}

async function handleDisableNotificationButton(interaction) {
    const parts = interaction.customId.split('_');
    const type = parts[1];
    const userId = parts[2];
    
    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: "❌ You can't use someone else's buttons.",
            ephemeral: true
        });
    }
    
    const embed = createConfirmationEmbed(type);
    const buttons = createConfirmationButtons(userId, type);
    
    await interaction.reply({
        embeds: [embed],
        components: [buttons],
        ephemeral: true
    });
}

async function handleConfirmDisableNotification(interaction) {
    const parts = interaction.customId.split('_');
    const type = parts[1];
    const userId = parts[2];
    
    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: "❌ You can't use someone else's buttons.",
            ephemeral: true
        });
    }
    
    setUserNotificationPreference(userId, type, false);
    
    const embed = createDisabledConfirmationEmbed(type);
    
    await interaction.update({
        embeds: [embed],
        components: []
    });
}

async function handleCancelDisableNotification(interaction) {
    const parts = interaction.customId.split('_');
    const userId = parts[2];
    
    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: "❌ You can't use someone else's buttons.",
            ephemeral: true
        });
    }
    
    const embed = createCancelledEmbed();
    
    await interaction.update({
        embeds: [embed],
        components: []
    });
}

async function handleEnableNotification(interaction) {
    const parts = interaction.customId.split('_');
    const type = parts[1];
    const userId = parts[2];
    
    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: "❌ You can't use someone else's buttons.",
            ephemeral: true
        });
    }
    
    setUserNotificationPreference(userId, type, true);
    
    const gachaName = type === 'normal' ? 'Normal Gacha' : 'Event Gacha';
    
    const embed = new EmbedBuilder()
        .setTitle('🔔 Notifications Enabled')
        .setDescription(`Auto-roll restoration notifications for **${gachaName}** have been re-enabled.`)
        .setColor(Colors.Green)
        .setTimestamp();
    
    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

module.exports = {
    createDisableNotificationButton,
    addDisableNotificationButton,
    createConfirmationEmbed,
    createConfirmationButtons,
    createDisabledConfirmationEmbed,
    createCancelledEmbed,
    createEnableNotificationButton,
    updateSummaryWithNotificationButton,
    handleDisableNotificationButton,
    handleConfirmDisableNotification,
    handleCancelDisableNotification,
    handleEnableNotification
};