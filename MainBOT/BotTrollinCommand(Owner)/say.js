const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const OWNER_ID = "1128296349566251068";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Send a message as the bot (Owner only).')
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
                .setDescription('Show that the owner requested this message?')
                .setRequired(false)
        ),
    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: "❌ You are not allowed to use this command.", ephemeral: true });
        }

        const message = interaction.options.getString('message');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const useEmbed = interaction.options.getBoolean('embed') || false;
        const showCredit = interaction.options.getBoolean('credit') || false;

        const safeMessage = message.replace(/@everyone/g, '[everyone]').replace(/@here/g, '[here]');

        let contentToSend;
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setDescription(safeMessage)
                .setColor('Random')
                .setFooter({ text: showCredit ? `Requested by Owner (${interaction.user.tag})` : ' ' })
                .setTimestamp();
            contentToSend = { embeds: [embed] };
        } else {
            contentToSend = {
                content: safeMessage + (showCredit ? `\n\n— Requested by Owner (${interaction.user.tag})` : '')
            };
        }

        await channel.send(contentToSend);
        await interaction.reply({ content: `✅ Message sent to ${channel}`, ephemeral: true });
    },
};
