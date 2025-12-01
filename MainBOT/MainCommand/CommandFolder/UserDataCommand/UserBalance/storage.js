const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../../../Core/Database/dbSetting');
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
const { maintenance, developerID } = require("../../../Configuration/maintenanceConfig");
const { isBanned } = require('../../../Administrator/BannedList/BanUtils');

module.exports = (client) => {
    const RARITY_ORDER = [
        'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY',
        'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL',
        'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
    ];

    function getRarity(fumoName) {
        if (!fumoName) return 'Common';
        if (fumoName.includes('TRANSCENDENT')) return 'TRANSCENDENT';
        if (fumoName.includes('ETERNAL')) return 'ETERNAL';
        if (fumoName.includes('INFINITE')) return 'INFINITE';
        if (fumoName.includes('CELESTIAL')) return 'CELESTIAL';
        if (fumoName.includes('ASTRAL')) return 'ASTRAL';
        if (fumoName.includes('???')) return '???';
        if (fumoName.includes('EXCLUSIVE')) return 'EXCLUSIVE';
        if (fumoName.includes('MYTHICAL')) return 'MYTHICAL';
        if (fumoName.includes('LEGENDARY')) return 'LEGENDARY';
        if (fumoName.includes('OTHERWORLDLY')) return 'OTHERWORLDLY';
        if (fumoName.includes('EPIC')) return 'EPIC';
        if (fumoName.includes('RARE')) return 'RARE';
        if (fumoName.includes('UNCOMMON')) return 'UNCOMMON';
        return 'Common';
    }

    function cleanFumoName(name) {
        return name.replace(/\s*\(.*?\)\s*/g, '').trim();
    }

    async function fetchUserInventory(userId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT fumoName, SUM(quantity) as count FROM userInventory WHERE userId = ? GROUP BY fumoName`,
                [userId],
                (err, rows) => (err ? reject(err) : resolve(rows || []))
            );
        });
    }

    async function fetchUserCoinData(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT hasFantasyBook FROM userCoins WHERE userId = ?`,
                [userId],
                (err, row) => (err ? reject(err) : resolve(row || { hasFantasyBook: 0 }))
            );
        });
    }

    client.on('messageCreate', async (message) => {
        if (!['.storage', '.st'].includes(message.content) || message.author.bot) return;

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
                .setFooter({ text: footehrText })
                .setTimestamp();

            console.log(`[${new Date().toISOString()}] Blocked user (${message.author.id}) due to ${maintenance === "yes" ? "maintenance" : "ban"}.`);

            return message.reply({ embeds: [embed] });
        }

        let userData, inventoryRows;
        try {
            [userData, inventoryRows] = await Promise.all([
                fetchUserCoinData(message.author.id),
                fetchUserInventory(message.author.id)
            ]);
        } catch (err) {
            console.error('DB error:', err);
            return message.reply({ content: '⚠️ Database error occurred. Please try again later.', ephemeral: true });
        }

        const hasFantasyBook = userData.hasFantasyBook === 1;

        if (!Array.isArray(inventoryRows) || inventoryRows.length === 0) {
            return message.reply({ content: '🛑 Your inventory is empty! Start collecting some fumos!', ephemeral: true });
        }

        let showShinyPlus = false;
        let sortBy = 'rarity';

        function buildInventoryData() {
            const categories = {};
            RARITY_ORDER.forEach(r => categories[r] = []);
            let totalFumos = 0, totalShinyPlus = 0;

            for (const row of inventoryRows) {
                if (!row.fumoName) continue;
                const isShiny = row.fumoName.includes('[✨SHINY]');
                const isAlG = row.fumoName.includes('[🌟alG]');
                const isShinyPlus = isShiny || isAlG;
                const rarity = getRarity(row.fumoName);
                const isAstralPlus = ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'].includes(rarity);
                const isOtherworldly = rarity === 'OTHERWORLDLY';

                if (showShinyPlus && !isShinyPlus) continue;
                if (!showShinyPlus && isShinyPlus) continue;
                if (!showShinyPlus && (isAstralPlus || isOtherworldly) && !hasFantasyBook) continue;

                const cleanName = cleanFumoName(row.fumoName);
                categories[rarity].push({ name: cleanName, count: row.count });
                totalFumos += row.count;
                if (isShinyPlus) totalShinyPlus += row.count;
            }

            let visibleRarities = RARITY_ORDER.filter(rarity => {
                if (!categories[rarity].length) return false;
                if (!showShinyPlus && !hasFantasyBook && ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT', 'OTHERWORLDLY'].includes(rarity)) return false;
                return true;
            });

            for (const rarity of visibleRarities) {
                categories[rarity].sort((a, b) => {
                    if (sortBy === 'quantity') return b.count - a.count || a.name.localeCompare(b.name);
                    return a.name.localeCompare(b.name);
                });
            }

            return { categories, visibleRarities, totalFumos, totalShinyPlus };
        }

        let currentPage = 0;

        let { categories, visibleRarities, totalFumos, totalShinyPlus } = buildInventoryData();
        let maxPage = Math.max(0, Math.ceil(visibleRarities.length / 3) - 1);

        function buildEmbed({ categories, visibleRarities, totalFumos, totalShinyPlus }) {
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setThumbnail('https://media.discordapp.net/attachments/1255538076172816415/1255887181071913010/FyrEe68WIAgN3sc.png?format=webp&quality=lossless')
                .setTitle(showShinyPlus ? `✨ ${message.author.username}'s SHINY+ Units ✨` : `🎒 ${message.author.username}'s Fumo Inventory 🎒`)
                .setDescription(showShinyPlus
                    ? `🧸 **Total SHINY+ Units:** ${totalShinyPlus}`
                    : `🧸 **Total Fumos:** ${totalFumos}`
                );

            const start = currentPage * 3;
            const end = Math.min(start + 3, visibleRarities.length);
            for (let i = start; i < end; i++) {
                const rarity = visibleRarities[i];
                const items = categories[rarity];
                const value = items.map(item => `${item.name} (x${item.count})`).join('\n');
                embed.addFields({
                    name: `${rarity} (x${items.reduce((sum, i) => sum + i.count, 0)})`,
                    value: value,
                    inline: true
                });
            }

            embed.setFooter({
                text: showShinyPlus
                    ? '🎯 Viewing SHINY+ units (✨SHINY and 🌟alG)'
                    : !hasFantasyBook
                        ? '🔒 Some high-tier fumos are hidden. Unlock FantasyBook(M) to view them all.'
                        : `📦 Sorted by ${sortBy === 'rarity' ? 'rarity/name' : 'quantity'} • Keep up the hunt for rare fumos!`
            });

            if (embed.data && embed.data.fields) {
                embed.data.fields = embed.data.fields.filter(
                    f => f.name !== undefined && f.value !== undefined
                );
            }

            return embed;
        }

        function buildButtons(maxPage) {
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('first').setLabel('⏮ First').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                new ButtonBuilder().setCustomId('prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                new ButtonBuilder().setCustomId('next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === maxPage),
                new ButtonBuilder().setCustomId('last').setLabel('Last ⏭').setStyle(ButtonStyle.Primary).setDisabled(currentPage === maxPage),
                new ButtonBuilder()
                    .setCustomId('shinyplus')
                    .setLabel(showShinyPlus ? '📦 NORMAL' : '✨ SHINY+')
                    .setStyle(showShinyPlus ? ButtonStyle.Success : ButtonStyle.Danger)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('sort')
                    .setLabel(sortBy === 'rarity' ? '🔢 Sort: Quantity' : '🔤 Sort: Rarity')
                    .setStyle(ButtonStyle.Secondary)
            );
            return [row1, row2];
        }

        let sentMessage;
        try {
            sentMessage = await message.reply({
                embeds: [buildEmbed({ categories, visibleRarities, totalFumos, totalShinyPlus })],
                components: buildButtons(maxPage),
                ephemeral: true
            });
        } catch (err) {
            console.error('Failed to send inventory embed:', err);
            return;
        }

        const collector = sentMessage.createMessageComponentCollector({ time: 180000 });

        collector.on('collect', async interaction => {
            if (interaction.user.id !== message.author.id) {
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: '❌ This is not your inventory!', ephemeral: true });
                    }
                } catch (err) {
                }
                return;
            }

            let dataChanged = false;

            switch (interaction.customId) {
                case 'first':
                    if (currentPage !== 0) { currentPage = 0; dataChanged = true; }
                    break;
                case 'prev':
                    if (currentPage > 0) { currentPage--; dataChanged = true; }
                    break;
                case 'next':
                    if (currentPage < maxPage) { currentPage++; dataChanged = true; }
                    break;
                case 'last':
                    if (currentPage !== maxPage) { currentPage = maxPage; dataChanged = true; }
                    break;
                case 'shinyplus':
                    showShinyPlus = !showShinyPlus;
                    currentPage = 0;
                    dataChanged = true;
                    break;
                case 'sort':
                    sortBy = sortBy === 'rarity' ? 'quantity' : 'rarity';
                    currentPage = 0;
                    dataChanged = true;
                    break;
            }

            if (dataChanged) {
                ({ categories, visibleRarities, totalFumos, totalShinyPlus } = buildInventoryData());
                maxPage = Math.max(0, Math.ceil(visibleRarities.length / 3) - 1);
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.update({
                            embeds: [buildEmbed({ categories, visibleRarities, totalFumos, totalShinyPlus })],
                            components: buildButtons(maxPage)
                        });
                    }
                } catch (err) {
                }
            }
        });

        collector.on('end', async () => {
            try {
                await sentMessage.edit({ components: [] });
            } catch (err) {
            }
        });
    });
};
