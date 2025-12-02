/**
 * Button Utility
 * Creates button components for music controls
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class ButtonUtil {
    /**
     * Create main control buttons
     */
    static createControls(guildId, isPaused = false, isLooped = false) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`pause:${guildId}`)
                .setLabel(isPaused ? '▶️ Resume' : '⏸️ Pause')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`stop:${guildId}`)
                .setLabel('🛑 Stop')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`skip:${guildId}`)
                .setLabel('⏭️ Skip')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`list:${guildId}`)
                .setLabel('🧾 Queue')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`loop:${guildId}`)
                .setLabel(isLooped ? '🔁 Unloop' : '🔂 Loop')
                .setStyle(isLooped ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
    }

    /**
     * Create volume control buttons
     */
    static createVolumeControls(guildId, trackUrl = null) {
        const buttons = [
            new ButtonBuilder()
                .setCustomId(`volDown:${guildId}`)
                .setLabel('🔉 -')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`volUp:${guildId}`)
                .setLabel('🔊 +')
                .setStyle(ButtonStyle.Secondary),
        ];

        if (trackUrl) {
            buttons.push(
                new ButtonBuilder()
                    .setLabel('🔗 Link')
                    .setStyle(ButtonStyle.Link)
                    .setURL(trackUrl)
            );
        }

        return new ActionRowBuilder().addComponents(buttons);
    }

    /**
     * Create skip voting button
     */
    static createSkipVote() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('vote_skip')
                .setLabel('⏭️ Vote Skip')
                .setStyle(ButtonStyle.Primary)
        );
    }

    /**
     * Create confirmation buttons
     */
    static createConfirmation() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_yes')
                .setLabel('✅ Yes')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('confirm_no')
                .setLabel('❌ No')
                .setStyle(ButtonStyle.Danger)
        );
    }

    /**
     * Disable all buttons in component rows
     */
    static disableAll(components) {
        return components.map(row => {
            return ActionRowBuilder.from(row).setComponents(
                row.components.map(button => 
                    ButtonBuilder.from(button).setDisabled(true)
                )
            );
        });
    }
}

module.exports = ButtonUtil;