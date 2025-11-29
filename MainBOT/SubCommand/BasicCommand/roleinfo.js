const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { maintenance, developerID } = require("../../MainCommand/Configuration/Maintenance/maintenanceConfig.js");
const { isBanned } = require('../../MainCommand/Administrator/BannedList/BanUtils.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleinfo')
        .setDescription('Get information about a role')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to get info about')
                .setRequired(true)
        ),
    async execute(interaction) {
        // Maintenance or ban check
        const banData = isBanned(interaction.user.id);
        if ((maintenance === "yes" && interaction.user.id !== developerID) || banData) {
            let description = '';
            let footerText = '';

            if (maintenance === "yes" && interaction.user.id !== developerID) {
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

        const role = interaction.options.getRole('role');
        if (!role) {
            return interaction.reply({ content: '❗ **Please provide a valid role.**', ephemeral: true });
        }

        // Permissions formatting
        const permissions = role.permissions.toArray().map(perm => `\`${perm}\``).join(', ') || 'None';

        const roleInfoEmbed = new EmbedBuilder()
            .setTitle(`📜 Role Information: ${role.name}`)
            .setColor(role.color || 0x00AE86)
            .addFields(
                { name: '🆔 Role ID', value: role.id, inline: true },
                { name: '🖍 Color', value: role.hexColor, inline: true },
                { name: '👥 Members with this role', value: `${role.members.size}`, inline: true },
                { name: '💼 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
                { name: '📅 Created On', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🔢 Position', value: `${role.position}`, inline: true },
                { name: '📌 Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
                { name: '🔒 Permissions', value: permissions, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [roleInfoEmbed] });
    }
};
