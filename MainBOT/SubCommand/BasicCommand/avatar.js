const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const { checkAccess, AccessType } = require('../Middleware');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Displays the avatar of a user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to get the avatar of')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('size')
                .setDescription('Avatar size (128, 256, 512, 1024)')
                .addChoices(
                    { name: '128', value: 128 },
                    { name: '256', value: 256 },
                    { name: '512', value: 512 },
                    { name: '1024', value: 1024 }
                )
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Avatar type')
                .addChoices(
                    { name: 'Dynamic', value: 'dynamic' },
                    { name: 'Static', value: 'static' }
                )
                .setRequired(false)
        ),
    async execute(interaction) {
        // Check access (maintenance + ban)
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const avatarSize = interaction.options.getInteger('size') || 512;
        const avatarType = interaction.options.getString('type') || 'dynamic';

        const avatarURL = avatarType === 'static'
            ? targetUser.displayAvatarURL({ extension: 'png', size: avatarSize })
            : targetUser.displayAvatarURL({ dynamic: true, size: avatarSize });

        const avatarEmbed = new EmbedBuilder()
            .setTitle(`${targetUser.username}'s Avatar`)
            .setDescription(`[Click here for full size](${avatarURL})`)
            .setImage(avatarURL)
            .setColor('#3498db')
            .setFooter({
                text: `Requested by ${interaction.user.username}, use "/avatar" for more options`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .addFields(
                { name: 'Username', value: targetUser.username, inline: true },
                { name: 'User ID', value: targetUser.id, inline: true },
                { name: 'Avatar Size', value: `${avatarSize}px`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [avatarEmbed] });
    }
};
