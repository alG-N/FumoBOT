const { SlashCommandBuilder } = require('discord.js');
const { checkAccess, AccessType } = require('../../Middleware');
const { checkRestrictions } = require('../../../MainCommand/Middleware/restrictions');
const sayService = require('../Service/SayService/SayService');
const logger = require('../Utility/SayUtility/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Send a message as the bot.')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('What should the bot say?')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Send the message to a specific channel (default: current)')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('embed')
                .setDescription('Send the message as an embed?')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('credit')
                .setDescription('Show who requested this message?')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of message: normal, info, warning, error, success')
                .setRequired(false)
                .addChoices(
                    { name: 'Normal', value: 'normal' },
                    { name: 'Info', value: 'info' },
                    { name: 'Warning', value: 'warning' },
                    { name: 'Error', value: 'error' },
                    { name: 'Success', value: 'success' }
                )
        ),

    async execute(interaction) {
        try {
            // Access control check (maintenance/ban)
            const access = await checkAccess(interaction, AccessType.SUB);
            if (access.blocked) {
                return interaction.reply({ embeds: [access.embed], ephemeral: true });
            }

            const restriction = checkRestrictions(interaction.user.id);
            if (restriction.blocked) {
                return interaction.reply({ embeds: [restriction.embed], ephemeral: true });
            }

            const message = interaction.options.getString('message');
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const useEmbed = interaction.options.getBoolean('embed') || false;
            const showCredit = interaction.options.getBoolean('credit');
            const type = interaction.options.getString('type') || 'normal';

            if (!sayService.validateChannel(channel)) {
                return interaction.reply({
                    content: '❌ That channel is not a text-based channel!',
                    ephemeral: true
                });
            }

            const safeMessage = sayService.sanitizeMessage(message);
            const creditText = sayService.buildCreditText(interaction.user.id, interaction.user.tag, showCredit);

            await sayService.sendMessage(channel, safeMessage, useEmbed, safeMessage, type, creditText);
            
            await interaction.reply({ content: `✅ Message sent to ${channel}`, ephemeral: true });

            logger.log(interaction.user.tag, interaction.user.id, channel.name, channel.id, type, safeMessage);
            await logger.logToChannel(interaction.client, interaction.user.tag, interaction.user.id, channel.name, channel.id, type, safeMessage);

        } catch (err) {
            logger.error(err.message);
            
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: '❌ Failed to send the message.', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Failed to send the message.', ephemeral: true });
            }
        }
    },
};