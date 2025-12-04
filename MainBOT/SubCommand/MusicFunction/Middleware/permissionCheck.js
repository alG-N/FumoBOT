const { PermissionFlagsBits } = require('discord.js');
const embedBuilder = require('../Utility/embedBuilder');

async function checkBotPermissions(interaction, requiredPermissions = []) {
    const botMember = interaction.guild.members.me;
    const missingPermissions = [];

    for (const permission of requiredPermissions) {
        if (!botMember.permissions.has(permission)) {
            missingPermissions.push(permission);
        }
    }

    if (missingPermissions.length > 0) {
        const permissionNames = missingPermissions.map(p => 
            Object.keys(PermissionFlagsBits).find(key => PermissionFlagsBits[key] === p)
        ).join(', ');

        await interaction.reply({
            embeds: [embedBuilder.buildInfoEmbed(
                "❌ Missing Permissions",
                `I need the following permissions: ${permissionNames}`
            )],
            ephemeral: true
        });
        return false;
    }

    return true;
}

async function checkUserPermissions(interaction, requiredPermissions = []) {
    const member = interaction.member;
    const missingPermissions = [];

    for (const permission of requiredPermissions) {
        if (!member.permissions.has(permission)) {
            missingPermissions.push(permission);
        }
    }

    if (missingPermissions.length > 0) {
        const permissionNames = missingPermissions.map(p => 
            Object.keys(PermissionFlagsBits).find(key => PermissionFlagsBits[key] === p)
        ).join(', ');

        await interaction.reply({
            embeds: [embedBuilder.buildInfoEmbed(
                "❌ Missing Permissions",
                `You need the following permissions: ${permissionNames}`
            )],
            ephemeral: true
        });
        return false;
    }

    return true;
}

async function checkChannelPermissions(interaction, channel, requiredPermissions = []) {
    const botMember = interaction.guild.members.me;
    const permissions = channel.permissionsFor(botMember);
    const missingPermissions = [];

    for (const permission of requiredPermissions) {
        if (!permissions.has(permission)) {
            missingPermissions.push(permission);
        }
    }

    if (missingPermissions.length > 0) {
        const permissionNames = missingPermissions.map(p => 
            Object.keys(PermissionFlagsBits).find(key => PermissionFlagsBits[key] === p)
        ).join(', ');

        await interaction.reply({
            embeds: [embedBuilder.buildInfoEmbed(
                "❌ Missing Channel Permissions",
                `I need the following permissions in that channel: ${permissionNames}`
            )],
            ephemeral: true
        });
        return false;
    }

    return true;
}

module.exports = {
    checkBotPermissions,
    checkUserPermissions,
    checkChannelPermissions
};