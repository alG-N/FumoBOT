const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkAccess, AccessType } = require('../Middleware');

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
        // Check access (maintenance + ban)
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
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
