const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events
} = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});
client.setMaxListeners(150);
const { maintenance, developerID } = require("../Command/Maintenace/MaintenaceConfig.js");
const { isBanned } = require('../Command/Banned/BanUtils.js');
module.exports = (client) => {
    client.on(Events.MessageCreate, async (message) => {
        if (!message.content.startsWith('.roleinfo')) return;
        if (message.author.bot) return;

        // Check for maintenance mode or ban
        const banData = isBanned(message.author.id);
        if ((maintenance === "yes" && message.author.id !== developerID) || banData) {
            let description = '';
            let footerText = '';

            if (maintenance === "yes" && message.author.id !== developerID) {
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

            console.log(`[${new Date().toISOString()}] Blocked user (${message.author.id}) due to ${maintenance === "yes" ? "maintenance" : "ban"}.`);

            return message.reply({ embeds: [embed] });
        }

        const args = message.content.trim().split(' ');
        const roleInput = args.slice(1).join(' ').trim();

        if (!roleInput) {
            return message.reply('❗ **Please provide a valid role name or mention a role.**\nExample: `/roleinfo Verified` or `/roleinfo @Verified`');
        }

        const role = message.mentions.roles.first() ||
            message.guild.roles.cache.find(r => r.name.toLowerCase() === roleInput.toLowerCase()) ||
            message.guild.roles.cache.find(r => r.name.toLowerCase().includes(roleInput.toLowerCase()));

        if (!role) {
            return message.reply(`🚫 **Role "${roleInput}" not found.** Please provide an existing role name or mention a role.`);
        }

        const roleInfoEmbed = new EmbedBuilder()
            .setTitle(`📜 Role Information: ${role.name}`)
            .setColor(role.color || 0x00AE86)
            .addFields(
                { name: '🆔 Role ID', value: role.id, inline: true },
                { name: '🖍 Color', value: role.hexColor, inline: true },
                { name: '👥 Members with this role', value: `${role.members.size}`, inline: true },
                { name: '💼 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
                { name: '📅 Created On', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() });

        await message.channel.send({ embeds: [roleInfoEmbed] });
    });
}