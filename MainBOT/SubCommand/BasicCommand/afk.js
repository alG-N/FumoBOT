const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkAccess, AccessType } = require('../Middleware');
const fs = require('fs');
const path = require('path');
const afkFilePath = path.join(__dirname, 'SillyAFK.json');

// In-memory cache for AFK data
let afkCache = null;
let isDirty = false;

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
}

// Load once at startup, then use cache
function loadAfkUsers() {
    if (afkCache !== null) return afkCache;
    
    try {
        if (!fs.existsSync(afkFilePath)) {
            afkCache = {};
            fs.promises.writeFile(afkFilePath, '{}').catch(() => {});
            return afkCache;
        }
        afkCache = JSON.parse(fs.readFileSync(afkFilePath, 'utf-8').trim() || '{}');
    } catch {
        afkCache = {};
    }
    return afkCache;
}

function saveAfkUsers(data) {
    afkCache = data;
    isDirty = true;
}

// Periodic async save (every 30s if dirty)
setInterval(async () => {
    if (isDirty && afkCache !== null) {
        try {
            await fs.promises.writeFile(afkFilePath, JSON.stringify(afkCache, null, 2));
            isDirty = false;
        } catch (err) {
            console.error('[AFK] Failed to save:', err);
        }
    }
}, 30000);

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
        try {
            if (message.author.bot) return;
            if (!message.guild) return; // Ignore DMs
            
            const afkData = loadAfkUsers();
            const userId = message.author.id;
            const guildId = message.guild.id;

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
                message.reply({ embeds: [embed] })
                    .then(msg => setTimeout(() => msg.delete().catch(() => {}), 15000))
                    .catch(() => {});
                return;
            }

            message.mentions.users.forEach(user => {
                let mentionedAfkInfo;
                if (afkData[user.id]?.type === 'global') {
                    mentionedAfkInfo = afkData[user.id];
                } else if (afkData[user.id]?.[guildId]) {
                    mentionedAfkInfo = afkData[user.id][guildId];
                }
                
                if (mentionedAfkInfo) {
                    const timeAway = Math.floor((Date.now() - mentionedAfkInfo.timestamp) / 1000);
                    const embed = new EmbedBuilder()
                        .setColor('#FFA07A')
                        .setTitle(`${user.username} is currently AFK 💤`)
                        .setDescription(`**AFK for:** ${formatTime(timeAway)}\n**Reason:** ${mentionedAfkInfo.reason}`)
                        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                        .addFields([
                            {
                                name: 'While you wait...',
                                value: '🍵 Grab tea\n📺 Watch anime\n🎮 Play a game\n🈶 Practice Japanese\n🎨 Draw a fumo\n'
                            }
                        ])
                        .setFooter({ text: 'They\'ll return soon 🌸', iconURL: client.user.displayAvatarURL() });
                    message.reply({ embeds: [embed] }).catch(() => {});
                }
            });
        } catch (error) {
            console.error('[AFK] onMessage error:', error.message);
        }
    }
};
