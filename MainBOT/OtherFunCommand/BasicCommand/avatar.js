const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { maintenance, developerID } = require("../../Command/Maintenace/MaintenaceConfig.js");
const { isBanned } = require('../../Command/Banned/BanUtils.js');

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
        const userId = interaction.user.id;
        const banData = isBanned(userId);

        if ((maintenance === "yes" && userId !== developerID) || banData) {
            let description = '';
            let footerText = '';

            if (maintenance === "yes" && userId !== developerID) {
                description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
                footerText = "Thank you for your patience";
            } else if (banData) {
                description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;
                if (banData.expiresAt) {
                    const remaining = banData.expiresAt - Date.now();
                    const seconds = Math.floor((remaining / 1000) % 60);
                    const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                    const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
                    const timeString = [
                        days ? `${days}d` : '',
                        hours ? `${hours}h` : '',
                        minutes ? `${minutes}m` : '',
                        seconds ? `${seconds}s` : ''
                    ].filter(Boolean).join(' ');
                    description += `\n**Time Remaining:** ${timeString}`;
                } else {
                    description += `\n**Ban Type:** Permanent`;
                }
                footerText = "Ban enforced by developer";
            }

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(maintenance === "yes" ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
                .setDescription(description)
                .setFooter({ text: footerText })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Get options
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const avatarSize = interaction.options.getInteger('size') || 512;
        const avatarType = interaction.options.getString('type') || 'dynamic';

        // Build avatar URL
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
