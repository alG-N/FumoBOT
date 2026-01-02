const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const { checkAccess, AccessType } = require('../Middleware');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('groupinform')
        .setDescription('Shows information about the server.'),
    async execute(interaction) {
        // Check access (maintenance + ban)
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        const guild = interaction.guild;
        const serverName = guild.name;
        const serverIcon = guild.iconURL({ dynamic: true, size: 1024 });
        const owner = await guild.fetchOwner();
        const createdAt = guild.createdAt.toLocaleDateString();
        const totalMembers = guild.memberCount;
        const textChannels = guild.channels.cache.filter(channel => channel.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2).size;
        const roleCount = guild.roles.cache.size;
        const verificationLevel = guild.verificationLevel;
        const boostLevel = guild.premiumTier ? `Level ${guild.premiumTier}` : 'None';
        const boostCount = guild.premiumSubscriptionCount || 0;
        const emojiCount = guild.emojis.cache.size;
        const botsCount = guild.members.cache.filter(member => member.user.bot).size;
        const region = guild.preferredLocale || 'Not Set';
        const serverDescription = guild.description || 'No description set for this server.';
        const contentFilterLevels = ['Disabled', 'Members without roles', 'All members'];
        const explicitContentFilter = contentFilterLevels[guild.explicitContentFilter];
        const topRole = guild.roles.cache.sort((a, b) => b.position - a.position).first();
        const boostIcon = boostLevel !== 'None' ? '🚀' : '🔰';

        let serverInfoEmbed = new EmbedBuilder()
            .setTitle(`✨ Server Information: ${serverName}`)
            .setThumbnail(serverIcon)
            .setColor('#0099ff')
            .addFields(
                { name: '📛 Server Name', value: serverName, inline: true },
                { name: '👑 Owner', value: `${owner.user.tag}`, inline: true },
                { name: '📅 Created On', value: createdAt, inline: true },
                { name: '👥 Total Members', value: `${totalMembers}`, inline: true },
                { name: '🤖 Bots', value: `${botsCount}`, inline: true },
                { name: '💬 Text Channels', value: `${textChannels}`, inline: true },
                { name: '🔊 Voice Channels', value: `${voiceChannels}`, inline: true },
                { name: '📜 Roles', value: `${roleCount}`, inline: true },
                { name: '🔝 Top Role', value: `${topRole.name}`, inline: true },
                { name: '📍 Region', value: `${region}`, inline: true },
                { name: '🔐 Verification Level', value: `${verificationLevel}`, inline: true },
                { name: `${boostIcon} Boost Level`, value: `${boostLevel}`, inline: true },
                { name: '🎉 Boost Count', value: `${boostCount}`, inline: true },
                { name: '😀 Emojis', value: `${emojiCount}`, inline: true },
                { name: '🚫 Explicit Content Filter', value: `${explicitContentFilter}`, inline: true }
            )
            .setDescription(`**Server Description:**\n${serverDescription}`)
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        return interaction.reply({ embeds: [serverInfoEmbed] });
    }
};
