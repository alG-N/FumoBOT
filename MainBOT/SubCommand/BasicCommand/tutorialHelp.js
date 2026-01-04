const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { checkAccess, AccessType } = require('../Middleware');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('othercmd')
        .setDescription('Shows a list of other fun commands.'),
    async execute(interaction) {
        // Check access (maintenance + ban)
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        const helpEmbed = new EmbedBuilder()
            .setTitle('🛠️ FumoBOT(OtherCMD) - List of Commands')
            .setColor('#00ccff')
            .addFields(
                { name: '🎬 Media Commands', value: 
                    '`/video [url]` - Download videos from TikTok, YouTube, Twitter, etc.\n' +
                    '`/pixiv [query]` - Search Pixiv artwork (SFW/NSFW filters)\n' +
                    '`/reddit [subreddit]` - Fetch posts from Reddit\n' +
                    '`/anime [name]` - Search anime information\n' +
                    '`/steam` - Check Steam sales', inline: false },
                { name: '🎵 Music Commands', value: 
                    '`/music play [query]` - Play music in voice channel\n' +
                    '`/music queue` - View the queue\n' +
                    '`/music skip` - Skip current track\n' +
                    '`/music stop` - Stop and disconnect', inline: false },
                { name: '⚔️ Interactive Commands', value: 
                    '`/deathbattle [@user] [skillset]` - Battle with anime skillsets\n' +
                    '`/say [message]` - Make the bot speak', inline: false },
                { name: '📋 Utility Commands', value: 
                    '`/avatar [user]` - View user avatar\n' +
                    '`/ping` - Check bot latency\n' +
                    '`/groupinform` - Server information\n' +
                    '`/roleinfo [@role]` - Role information\n' +
                    '`/afk [reason]` - Set AFK status\n' +
                    '`/invite` - Invite the bot', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [helpEmbed], ephemeral: false });
    }
};
