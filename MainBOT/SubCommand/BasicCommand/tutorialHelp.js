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
                { name: '/anime [nameAnime]', value: 'Displays detailed information about this anime' },
                { name: '/play', value: 'Play a music of your own choice' },
                { name: '/invite', value: 'Invite the bot to other server!' },
                { name: '/reddit', value: 'Fetch post from Reddit!' },
                { name: '/groupInform', value: 'Displays detailed information about the server.' },
                { name: '/avatar help', value: 'Shows information about a user. If no user is mentioned, shows info about the command user.' },
                { name: '/ping', value: 'Checks the bot\'s latency and API latency.' },
                { name: '/roleinfo [@role]', value: 'Displays information about a specific role.' },
                { name: '/leaderboard', value: 'Displays the no-life' },
                { name: '/afk', value: 'If you want to afk sure' },
                { name: '/deathbattle [@username] [set-hp] [jjk / ??? anime]', value: 'Deathbattle with a friend in anime..' },
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [helpEmbed], ephemeral: false });
    }
};
