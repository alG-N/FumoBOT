const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../../Core/Database/dbSetting');
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
const tutorialCommands = require('./helpCMD');
const { maintenance, developerID } = require("../../Configuration/Maintenance/maintenanceConfig");
const { isBanned } = require('../../Administrator/BannedList/BanUtils');
module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (message.content.startsWith('.help') || message.content.startsWith('.h')) {

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

            let selectedCategory = 'tutorial';
            const userId = message.author.id;

            const createEmbed = (category, timeRemaining) => {
                return new EmbedBuilder()
                    .setTitle(`🚀 Golden's Fumo Bot V2.3 ${category.charAt(0).toUpperCase() + category.slice(1)} 🚀`)
                    .setDescription('Embark on your adventure with alterGolden`s FumoBOT! Here are the commands to guide you on your journey:')
                    .addFields(tutorialCommands[category])
                    .setColor('#0099ff')
                    .setImage('https://preview.redd.it/do-you-guys-think-fumos-are-equivalent-to-the-funko-pops-v0-xi2av2hg1umb1.jpg?width=640&crop=smart&auto=webp&s=edb968ff6d6604ef605fe3a0742661a767b9d3f3')
                    .setFooter({ text: `?5_Z1!3V | This message will be deleted in ${timeRemaining} seconds.` })
                    .setTimestamp();
            };

            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('tutorial')
                        .setLabel('Tutorial')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(selectedCategory === 'tutorial'),
                    new ButtonBuilder()
                        .setCustomId('information')
                        .setLabel('Information')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(selectedCategory === 'information'),
                    new ButtonBuilder()
                        .setCustomId('gamble')
                        .setLabel('Gamble')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(selectedCategory === 'gamble'),
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('shop')
                        .setLabel('Shop')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(selectedCategory === 'shop'),
                    new ButtonBuilder()
                        .setCustomId('capitalism')
                        .setLabel('Capitalism')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(selectedCategory === 'capitalism'),
                    new ButtonBuilder()
                        .setCustomId('misc')
                        .setLabel('MISC')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(selectedCategory === 'misc'),
                );

            let timeRemaining = 60;
            const embedMessage = await message.channel.send({ embeds: [createEmbed('tutorial', timeRemaining)], components: [row1, row2] });

            const filter = i => i.customId && i.user.id === userId;
            const collector = embedMessage.createMessageComponentCollector({ filter, time: timeRemaining * 1000 });

            const interval = setInterval(async () => {
                timeRemaining--;
                if (timeRemaining > 0) {
                    await embedMessage.edit({ embeds: [createEmbed(selectedCategory, timeRemaining)], components: [row1, row2] });
                }
            }, 1000);

            collector.on('collect', async i => {
                if (i.user.id !== userId) {
                    await i.reply({ content: `🚫 This isn't your tutorial! Use /tutorial to start your own journey.`, ephemeral: true });
                    return;
                }

                selectedCategory = i.customId;

                row1.components.forEach(button => button.setDisabled(button.data.custom_id === selectedCategory));
                row2.components.forEach(button => button.setDisabled(button.data.custom_id === selectedCategory));

                await i.update({
                    embeds: [createEmbed(selectedCategory, timeRemaining)],
                    components: [row1, row2],
                });
            });

            collector.on('end', () => {
                clearInterval(interval);
                embedMessage.delete().catch(() => { });
            });
        }
    });
}