const { ActionRowBuilder, ButtonBuilder, ComponentType } = require('discord.js');
const { COLLECTOR_TIMEOUT } = require('../Configuration/MusicConfig');
const logger = require('../Utility/logger');

class InteractionHandler {
    createCollector(message, guildId, handlers) {
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: COLLECTOR_TIMEOUT,
            dispose: true
        });

        collector.on("collect", async (i) => {
            try {
                await this.handleInteraction(i, guildId, handlers);
            } catch (error) {
                logger.error(`Collector error: ${error.message}`, { guild: { name: i.guild?.name }, user: i.user });
            }
        });

        collector.on("end", async (collected, reason) => {
            if (handlers.onEnd) {
                await handlers.onEnd(reason, message);
            }
        });

        return collector;
    }

    async handleInteraction(interaction, guildId, handlers) {
        const buttonId = interaction.customId.split(":")[0];
        
        logger.log(`Button pressed: ${interaction.customId} by ${interaction.user.tag}`, 
            { guild: interaction.guild, user: interaction.user });

        const handler = handlers[buttonId];
        
        if (handler && typeof handler === 'function') {
            await handler(interaction, guildId);
        } else {
            logger.warn(`No handler found for button: ${buttonId}`, 
                { guild: interaction.guild, user: interaction.user });
        }
    }

    async safeEdit(message, payload) {
        try {
            await message.edit(payload);
            return { success: true, message };
        } catch (err) {
            logger.error(`Safe edit failed: ${err.message}`);
            
            try {
                const newMsg = await message.channel.send(payload);
                logger.log(`Fallback: sent new message`);
                return { success: true, message: newMsg, fallback: true };
            } catch (err2) {
                logger.error(`Fallback failed: ${err2.message}`);
                return { success: false, message: null };
            }
        }
    }

    async safeReply(interaction, payload) {
        try {
            if (interaction.replied || interaction.deferred) {
                return await interaction.followUp(payload);
            } else {
                return await interaction.reply(payload);
            }
        } catch (error) {
            logger.error(`Safe reply failed: ${error.message}`);
            return null;
        }
    }

    async safeDeferUpdate(interaction) {
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferUpdate();
            }
        } catch (error) {
            logger.error(`Safe defer update failed: ${error.message}`);
        }
    }

    disableComponents(components) {
        return components?.map(row => {
            return ActionRowBuilder.from(row).setComponents(
                row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
            );
        }) || [];
    }

    async disableMessageComponents(message) {
        if (!message || !message.components) return;
        
        try {
            const disabledRows = this.disableComponents(message.components);
            await message.edit({ components: disabledRows });
        } catch (error) {
            logger.error(`Failed to disable components: ${error.message}`);
        }
    }
}

module.exports = new InteractionHandler();