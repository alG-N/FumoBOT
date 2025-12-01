const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const OWNER_ID = "1128296349566251068";
const LOG_CHANNEL_ID = "1411386693499486429";

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
        const message = interaction.options.getString('message');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const useEmbed = interaction.options.getBoolean('embed') || false;
        const showCredit = interaction.options.getBoolean('credit');
        const type = interaction.options.getString('type') || 'normal';

        if (!channel.isTextBased()) {
            return interaction.reply({
                content: '❌ That channel is not a text-based channel!',
                ephemeral: true
            });
        }

        const typeColors = {
            normal: 0x2f3136,
            info: 0x3498db,
            warning: 0xf1c40f,
            error: 0xe74c3c,
            success: 0x2ecc71
        };

        const safeMessage = message
            .replace(/@everyone/g, '[everyone]')
            .replace(/@here/g, '[here]');

        let creditText = '';
        if (interaction.user.id === OWNER_ID) {
            if (showCredit) {
                creditText = `Requested by Owner (${interaction.user.tag})`;
            }
        } else {
            creditText = `Requested by ${interaction.user.tag}`;
        }

        let contentToSend;
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setDescription(safeMessage)
                .setColor(typeColors[type] || 0x2f3136)
                .setTimestamp();

            if (creditText) {
                embed.setFooter({ text: creditText });
            }

            contentToSend = { embeds: [embed] };
        } else {
            contentToSend = {
                content: safeMessage + (creditText ? `\n\n— ${creditText}` : '')
            };
        }

        try {
            await channel.send(contentToSend);
            await interaction.reply({ content: `✅ Message sent to ${channel}`, ephemeral: true });
            const now = new Date();
            const dateStr = now.toLocaleString('en-GB');
            console.log(`[${dateStr}] [say] User: ${interaction.user.tag} | Channel: ${channel.name} (${channel.id}) | Type: ${type}`);
            const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
                await logChannel.send(
                    "```" +
                    `Say Command Used\n` +
                    `User: ${interaction.user.tag} (${interaction.user.id})\n` +
                    `Channel: ${channel.name} (${channel.id})\n` +
                    `Type: ${type}\n` +
                    `Message: ${safeMessage}` +
                    "```"
                );
            }

        } catch (err) {
            console.error(err);
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: '❌ Failed to send the message.', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Failed to send the message.', ephemeral: true });
            }
        }
    },
};
