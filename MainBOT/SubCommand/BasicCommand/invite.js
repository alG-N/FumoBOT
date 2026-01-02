const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const { checkAccess, AccessType } = require('../Middleware');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Invite the bot to your server!'), 
    async execute(interaction) {
        // Check access (maintenance + ban)
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        const inviteURL = `https://discord.com/oauth2/authorize?client_id=1254962096924397569&permissions=4292493126401985&integration_type=0&scope=bot`;

        let inviteEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Invite FumoBOT to Your Server!')
            .setDescription('Click the link below to invite FumoBOT and enjoy its features!')
            .addFields({ name: 'Invite Link', value: `[Invite FumoBOT](${inviteURL})` })
            .setFooter({ text: 'Thank you for choosing FumoBOT!' })
            .setTimestamp();

        return interaction.reply({ embeds: [inviteEmbed], ephemeral: true });
    }
};
