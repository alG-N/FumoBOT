const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkAccess, AccessType } = require('../Middleware');
const fs = require('fs');
const afkFilePath = 'MainBOT/SubCommand/BasicCommand/SillyAFK.json';

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
}

function loadAfkUsers() {
    if (!fs.existsSync(afkFilePath)) fs.writeFileSync(afkFilePath, '{}');
    try {
        return JSON.parse(fs.readFileSync(afkFilePath, 'utf-8').trim() || '{}');
    } catch {
        return {};
    }
}

function saveAfkUsers(data) {
    fs.writeFileSync(afkFilePath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set your AFK status (guild or global)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('AFK type')
                .addChoices(
                    { name: 'guild', value: 'guild' },
                    { name: 'global', value: 'global' }
                )
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for AFK')
        ),

    async execute(interaction) {
        // Access control check
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        const afkData = loadAfkUsers();
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;
        const type = interaction.options.getString('type') || 'guild';
        const reason = interaction.options.getString('reason') || 'No reason provided.';
        const timestamp = Date.now();

        if (type === 'global') {
            afkData[userId] = { reason, timestamp, type: 'global' };
        } else {
            if (!afkData[userId]) afkData[userId] = {};
            afkData[userId][guildId] = { reason, timestamp, type: 'guild' };
        }
        saveAfkUsers(afkData);

        const embed = new EmbedBuilder()
            .setColor('#8A2BE2')
            .setTitle('AFK mode activated!')
            .setDescription(`**Type:** ${type}\n**Reason:** ${reason}`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'I will let others know if they mention you 💬', iconURL: interaction.client.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
    
    onMessage(message, client) {
        if (message.author.bot) return;
        const afkData = loadAfkUsers();
        const userId = message.author.id;
        const guildId = message.guild?.id;

        let wasAfk = false;
        let afkInfo;
        if (afkData[userId]?.type === 'global') {
            wasAfk = true;
            afkInfo = afkData[userId];
            delete afkData[userId];
        } else if (afkData[userId]?.[guildId]) {
            wasAfk = true;
            afkInfo = afkData[userId][guildId];
            delete afkData[userId][guildId];
            if (Object.keys(afkData[userId]).length === 0) delete afkData[userId];
        }
        if (wasAfk) {
            saveAfkUsers(afkData);
            const timeAway = Math.floor((Date.now() - afkInfo.timestamp) / 1000);
            const embed = new EmbedBuilder()
                .setColor('#00CED1')
                .setTitle('Welcome Back!')
                .setDescription(`You were AFK for **${formatTime(timeAway)}**. おかえりなさい！`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setImage('https://media.tenor.com/blCLnVdO3CgAAAAd/senko-sewayaki-kitsune-no-senko-san.gif')
                .setFooter({ text: 'We missed you! 🎌', iconURL: client.user.displayAvatarURL() });
            return message.reply({ embeds: [embed] }).then(msg => setTimeout(() => msg.delete().catch(() => { }), 15000));
        }

        message.mentions.users.forEach(user => {
            let afkInfo;
            if (afkData[user.id]?.type === 'global') afkInfo = afkData[user.id];
            else if (afkData[user.id]?.[guildId]) afkInfo = afkData[user.id][guildId];
            if (afkInfo) {
                const timeAway = Math.floor((Date.now() - afkInfo.timestamp) / 1000);
                const embed = new EmbedBuilder()
                    .setColor('#FFA07A')
                    .setTitle(`${user.username} is currently AFK 💤`)
                    .setDescription(`**AFK for:** ${formatTime(timeAway)}\n**Reason:** ${afkInfo.reason}`)
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .addFields([
                        {
                            name: 'While you wait...',
                            value: '🍵 Grab tea\n📺 Watch anime\n🎮 Play a game\n🈶 Practice Japanese\n🎨 Draw a fumo\n'
                        }
                    ])
                    .setFooter({ text: 'They’ll return soon 🌸', iconURL: client.user.displayAvatarURL() });
                message.reply({ embeds: [embed] });
            }
        });
    }
};
