const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../Database/db');
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
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
const ITEMS_PER_PAGE = 2;
const RARITY_ORDER = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythical', 'Secret'];
const RARITY_SUFFIX_MAP = {
    '(C)': 'Common',
    '(R)': 'Rare',
    '(E)': 'Epic',
    '(L)': 'Legendary',
    '(M)': 'Mythical',
    '(?)': 'Secret'
};

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (
            message.author.bot ||
            (!['.items', '.i'].includes(message.content.split(' ')[0]))
        ) return;

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

        db.all(
            `SELECT itemName, SUM(quantity) as totalQuantity FROM userInventory WHERE userId = ? GROUP BY itemName HAVING totalQuantity > 0`,
            [message.author.id],
            async (err, rows) => {
                if (err) {
                    console.error(err.message);
                    return message.reply('❌ An error occurred while fetching your items.');
                }
                if (!rows || rows.length === 0) {
                    return message.reply('🤷‍♂️ It appears you do not have any items at the moment.');
                }

                // Categorize items by rarity
                const categorized = {};
                let totalItems = 0;
                for (const rarity of RARITY_ORDER) categorized[rarity] = [];

                for (const row of rows) {
                    if (!row.itemName) continue;
                    totalItems += row.totalQuantity;
                    const rarityEntry = Object.entries(RARITY_SUFFIX_MAP).find(([suffix]) =>
                        row.itemName.endsWith(suffix)
                    );
                    if (rarityEntry) {
                        categorized[rarityEntry[1]].push(`🔹 ${row.itemName} (x${row.totalQuantity})`);
                    }
                }

                // Prepare pages (2 rarities per page)
                const rarityChunks = [];
                for (let i = 0; i < RARITY_ORDER.length; i += ITEMS_PER_PAGE) {
                    rarityChunks.push(RARITY_ORDER.slice(i, i + ITEMS_PER_PAGE));
                }

                let currentPage = 0;

                const buildEmbed = (page) => {
                    const embed = new EmbedBuilder()
                        .setTitle(`🎒 ${message.author.username}'s Treasure Trove 🎒`)
                        .setDescription(`📊 Total Items: ${totalItems}`)
                        .setColor('#0099ff')
                        .setThumbnail(message.author.displayAvatarURL());

                    for (const rarity of rarityChunks[page]) {
                        embed.addFields({
                            name: `**${rarity} Items**`,
                            value: categorized[rarity].length ? categorized[rarity].join('\n') : '-No items available-',
                            inline: true
                        });
                    }
                    embed.setFooter({ text: `Page ${page + 1} of ${rarityChunks.length}` });
                    return embed;
                };

                // Pagination buttons
                const getRow = (page) => {
                    return new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === rarityChunks.length - 1)
                    );
                };

                const sentMessage = await message.channel.send({
                    embeds: [buildEmbed(currentPage)],
                    components: [getRow(currentPage)]
                });

                const filter = (i) =>
                    i.user.id === message.author.id &&
                    ['prev_page', 'next_page'].includes(i.customId);

                const collector = sentMessage.createMessageComponentCollector({ filter, time: 300000 });

                collector.on('collect', async interaction => {
                    if (interaction.customId === 'prev_page' && currentPage > 0) {
                        currentPage--;
                    } else if (interaction.customId === 'next_page' && currentPage < rarityChunks.length - 1) {
                        currentPage++;
                    }
                    await interaction.update({
                        embeds: [buildEmbed(currentPage)],
                        components: [getRow(currentPage)]
                    });
                });

                collector.on('end', () => {
                    sentMessage.edit({ components: [] }).catch(() => { });
                });

                setTimeout(() => sentMessage.delete().catch(() => { }), 300000);
            }
        );
    });
};