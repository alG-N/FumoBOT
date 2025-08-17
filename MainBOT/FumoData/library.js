const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../Command/database/db.js');
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
const { isBanned } = require('../Command/Banned/BanUtils');
module.exports = (client, libraryFumos) => {
    const CATEGORIES = [
        'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL',
        'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
    ];

    // Utility: Progress bar
    function progressBar(discovered, totalFumos) {
        const safeTotal = Math.max(1, totalFumos);
        const safeDiscovered = Math.max(0, Math.min(discovered, safeTotal));
        const percentage = Math.round((safeDiscovered / safeTotal) * 100);
        const barLength = 10;
        const filledLength = Math.round((safeDiscovered / safeTotal) * barLength);
        const emptyLength = barLength - filledLength;
        return `${'█'.repeat(filledLength)}${'░'.repeat(emptyLength)} ${percentage}%`;
    }

    // Utility: Discovery description
    function getDiscoveryDescription(percentage) {
        if (percentage < 10) return "✨ Just hugged your first fumo! The softest journey has begun.";
        if (percentage < 20) return "🧵 You’re stitching together your fumo collection! So fluffy, so good.";
        if (percentage < 30) return "🎀 You’ve found a few cuddly friends! The fumo shelf is starting to look alive!";
        if (percentage < 40) return "📦 Your fumo box is filling up nicely. Keep those plushies coming!";
        if (percentage < 50) return "🛏️ Halfway to a bed full of fumos! Sleepover party soon?";
        if (percentage < 60) return "🪄 Your room is gaining fumo magic. Every plush brings new joy!";
        if (percentage < 70) return "🎒 Your fumo backpack is getting heavy (and adorable). Keep going!";
        if (percentage < 80) return "🧺 Your fumo laundry basket is full (but who would ever wash them?).";
        if (percentage < 90) return "🎡 You're building a full fumo amusement park! Plushies are everywhere!";
        if (percentage < 100) return "🏰 Almost there! Your fumo kingdom just needs a few more royals.";
        return "👑 Congratulations! You’ve discovered *every* fumo. You are the Supreme Fumo Collector!";
    }

    function stripTags(name) {
        if (typeof name !== 'string') return '';
        return name.replace(/\s*\[.*?\]/g, '').trim();
    }

    function extractRarity(name) {
        const match = name.match(/\(([^)]+)\)/);
        return match ? match[1] : null;
    }

    function chunkArray(arr, size) {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    }

    client.on('messageCreate', async message => {
        try {
            if (!message.content.startsWith('.library') && !message.content.startsWith('.li')) return;

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

            db.all(`SELECT fumoName FROM userInventory WHERE userId = ?`, [message.author.id], async (err, rows) => {
                if (err) {
                    console.error(`[DB ERROR] ${err.message}`);
                    message.channel.send('There was an error retrieving your inventory. Please try again later.');
                    return;
                }

                let shinyFound = 0, algFound = 0;
                const discoveredFumos = {};
                rows.forEach(row => {
                    if (!row.fumoName) return;
                    const baseName = stripTags(row.fumoName);
                    if (!discoveredFumos[baseName]) {
                        discoveredFumos[baseName] = { base: false, shiny: false, alg: false };
                    }
                    discoveredFumos[baseName].base = true;
                    if (row.fumoName.includes('[✨SHINY]')) discoveredFumos[baseName].shiny = true;
                    if (row.fumoName.includes('[🌟alG]')) discoveredFumos[baseName].alg = true;
                });

                // Prepare categories
                const categories = {};
                CATEGORIES.forEach(category => categories[category] = []);
                libraryFumos.forEach(fumo => {
                    const baseName = stripTags(fumo.name);
                    const rarity = extractRarity(fumo.name);
                    if (!rarity || !categories.hasOwnProperty(rarity)) return;

                    const userData = discoveredFumos[baseName] || {};
                    const hasBase = !!userData.base;
                    const hasShiny = !!userData.shiny;
                    const hasAlg = !!userData.alg;

                    let emoji = hasBase ? '✅' : '❌';
                    let displayName = hasBase ? fumo.name : '???';
                    let badges = '';
                    if (hasShiny) badges += ' [✨]';
                    if (hasAlg) badges += ' [🌟]';

                    categories[rarity].push(`${displayName}${badges} ${emoji}`);
                    if (hasShiny) shinyFound++;
                    if (hasAlg) algFound++;
                });

                // New feature: Show all categories in one embed, paginated by category
                const pages = Object.keys(categories).filter(cat => categories[cat].length > 0);
                let currentPage = 0;

                function updatePage(pageIndex) {
                    const discoveredCount = Object.values(discoveredFumos).filter(f => f.base).length;
                    const percentage = Math.round((discoveredCount / libraryFumos.length) * 100);

                    // Calculate shiny/alG progress based on total fumos
                    const shinyProgress = progressBar(shinyFound, libraryFumos.length);
                    const algProgress = progressBar(algFound, libraryFumos.length);

                    const embed = new EmbedBuilder()
                        .setTitle('📚 Fumo Library: Your Gateway to Fumo World 🌍')
                        .setDescription(
                            `Welcome to the Fumo Library! Here, you'll find every fumo that currently exists in the bot.\n\n` +
                            `🟢 Green tick: You've discovered it!\n🔴 Red tick: Yet to be discovered...\n\n` +
                            `📊 Fumo Stats:\n- Total Fumos in existence: ${libraryFumos.length}\n- Fumos you've discovered: ${discoveredCount}\n\n` +
                            `Keep exploring and uncover the magic of each fumo!`
                        )
                        .setColor('#0099ff');

                    const rarity = pages[pageIndex];
                    // Paginate category entries if too long (Discord field limit: 1024 chars)
                    const lines = categories[rarity];
                    const chunked = chunkArray(lines, 20); // 20 lines per field
                    chunked.forEach((chunk, idx) => {
                        embed.addFields({
                            name: idx === 0 ? rarity : `${rarity} (cont.)`,
                            value: chunk.join('\n'),
                            inline: true
                        });
                    });

                    embed.addFields({
                        name: '🚀 Fumo Discovery Journey 🌟',
                        value: `${getDiscoveryDescription(percentage)}\n\n${progressBar(discoveredCount, libraryFumos.length)}`,
                        inline: false
                    });

                    embed.addFields(
                        { name: '✨ SHINY Progress', value: shinyProgress, inline: true },
                        { name: '🌟 alG Progress', value: algProgress, inline: true }
                    );

                    embed.setFooter({ text: `Page ${pageIndex + 1} of ${pages.length}` });
                    return embed;
                }

                function updateButtons() {
                    return new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('first').setLabel('First').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                        new ButtonBuilder().setCustomId('back').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                        new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(currentPage === pages.length - 1),
                        new ButtonBuilder().setCustomId('last').setLabel('Last').setStyle(ButtonStyle.Primary).setDisabled(currentPage === pages.length - 1)
                    );
                }

                let embed = updatePage(currentPage);
                const sentMessage = await message.channel.send({ embeds: [embed], components: [updateButtons()] });

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async interaction => {
                    try {
                        if (interaction.user.id !== message.author.id) {
                            await interaction.reply({ content: "These buttons aren't for you! Please use your own .library command.", ephemeral: true });
                            return;
                        }
                        switch (interaction.customId) {
                            case 'first': currentPage = 0; break;
                            case 'last': currentPage = pages.length - 1; break;
                            case 'back': currentPage = Math.max(0, currentPage - 1); break;
                            case 'next': currentPage = Math.min(pages.length - 1, currentPage + 1); break;
                        }
                        await interaction.update({ embeds: [updatePage(currentPage)], components: [updateButtons()] });
                    } catch (e) {
                        console.error(`[Collector ERROR] ${e.message}`);
                    }
                });

                collector.on('end', () => {
                    sentMessage.edit({ components: [] }).catch(() => { });
                });
            });
        } catch (e) {
            console.error(`[Handler ERROR] ${e.message}`);
            message.channel.send('An unexpected error occurred. Please try again later.');
        }
    });
};