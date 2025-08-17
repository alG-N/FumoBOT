const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../database/db');
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});
const { Colors } = require('discord.js');
client.setMaxListeners(150);
function formatNumber(num) {
    if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Qa';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
}
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
module.exports = (client) => {
    const POTION_HISTORY_LIMIT = 10;

    client.on('messageCreate', async (message) => {
        try {
            if (
                message.author.bot ||
                (
                    message.content !== '.potionCraft' &&
                    !message.content.startsWith('.potionCraft ') &&
                    message.content !== '.pc' &&
                    !message.content.startsWith('.pc ')
                )
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

            const args = message.content.split(' ').slice(1);
            const itemToCraft = args.join(' ').trim();
            const userId = message.author.id;

            // Helper: fetch user inventory and coins/gems
            const getUserData = async () => {
                return new Promise((resolve, reject) => {
                    db.all(
                        `SELECT itemName, SUM(quantity) as totalQuantity FROM userInventory WHERE userId = ? GROUP BY itemName`,
                        [userId],
                        (err, inventoryRows) => {
                            if (err) return reject(err);
                            db.get(
                                `SELECT coins, gems FROM userCoins WHERE userId = ?`,
                                [userId],
                                (err2, coinRow) => {
                                    if (err2) return reject(err2);
                                    const userInventory = {};
                                    inventoryRows.forEach(row => userInventory[row.itemName] = row.totalQuantity);
                                    resolve({
                                        userInventory,
                                        userCoins: coinRow?.coins || 0,
                                        userGems: coinRow?.gems || 0
                                    });
                                }
                            );
                        }
                    );
                });
            };

            // Helper: fetch potion craft history
            const getPotionHistory = async () => {
                return new Promise((resolve) => {
                    db.all(
                        `SELECT * FROM potionCraftHistory WHERE userId = ? ORDER BY craftedAt DESC LIMIT ?`,
                        [userId, POTION_HISTORY_LIMIT],
                        (err, rows) => {
                            if (err) {
                                console.error(`[PotionHistory] DB error:`, err);
                                return resolve([]);
                            }
                            resolve(rows || []);
                        }
                    );
                });
            };

            // Helper: add to potion craft history
            const addPotionHistory = async (itemName, amount) => {
                db.run(
                    `INSERT INTO potionCraftHistory (userId, itemName, amount, craftedAt) VALUES (?, ?, ?, ?)`,
                    [userId, itemName, amount, Date.now()],
                    (err) => {
                        if (err) console.error(`[PotionHistory] Failed to log craft:`, err);
                    }
                );
            };

            // Show crafting menu
            if (!itemToCraft) {
                try {
                    const { userInventory, userCoins, userGems } = await getUserData();
                    const historyRows = await getPotionHistory();

                    const pages = ['How to Craft', 'Coins Potion', 'Gems Potion', 'Other Potion', 'Craft History'];
                    let currentPage = 0;

                    const tierIcons = {
                        '1': '[T1 • L]',
                        '2': '[T2 • R]',
                        '3': '[T3 • R]',
                        '4': '[T4 • L]',
                        '5': '[T5 • M]',
                    };

                    const categoryLabels = {
                        'Coins Potion': 'Coins Potion',
                        'Gems Potion': 'Gems Potion',
                        'Other Potion': 'Other Potion',
                    };

                    const getEmbed = () => {
                        const embed = new EmbedBuilder()
                            .setColor(Colors.Gold)
                            .setFooter({ text: `Page ${currentPage + 1} of ${pages.length}` });

                        const selectedCategory = pages[currentPage];

                        if (selectedCategory === 'How to Craft') {
                            embed
                                .setTitle('📖 How to Craft')
                                .setDescription(
                                    '**Usage:**\n```/potionCraft <item name> <amount>```\n\n' +
                                    'Make sure you have the required materials and coins/gems in your inventory.\n\n' +
                                    'Navigate the pages below to see what you can currently craft!'
                                )
                                .addFields(
                                    { name: '💰 Your Coins', value: formatNumber(userCoins), inline: true },
                                    { name: '💎 Your Gems', value: formatNumber(userGems), inline: true }
                                );
                            return embed;
                        }

                        if (selectedCategory === 'Craft History') {
                            embed.setTitle('🕓 Potion Craft History');
                            if (!historyRows.length) {
                                embed.setDescription('No recent potion crafts found.');
                            } else {
                                embed.setDescription(
                                    historyRows.map(row =>
                                        `• **${row.amount}x** \`${row.itemName}\` <t:${Math.floor(row.craftedAt / 1000)}:R>`
                                    ).join('\n')
                                );
                            }
                            return embed;
                        }

                        embed.setTitle(`─ ${categoryLabels[selectedCategory]} ─`);

                        const items = [];
                        for (const [itemName, data] of Object.entries(recipes)) {
                            const { requires, resources, category, effect } = data;
                            if (category !== selectedCategory) continue;

                            let canCraft = true;
                            let maxCraftable = Infinity;

                            for (const [reqItem, reqQty] of Object.entries(requires)) {
                                const availableQty = userInventory[reqItem] || 0;
                                if (availableQty < reqQty) canCraft = false;
                                maxCraftable = Math.min(maxCraftable, Math.floor(availableQty / reqQty));
                            }
                            if (resources.coins) {
                                if (userCoins < resources.coins) canCraft = false;
                                maxCraftable = Math.min(maxCraftable, Math.floor(userCoins / resources.coins));
                            }
                            if (resources.gems) {
                                if (userGems < resources.gems) canCraft = false;
                                maxCraftable = Math.min(maxCraftable, Math.floor(userGems / resources.gems));
                            }
                            if (!isFinite(maxCraftable) || maxCraftable < 1) maxCraftable = "None";

                            const tierMatch = itemName.match(/T(\d)/);
                            const tierLabel = tierMatch ? tierIcons[tierMatch[1]] || '[??]' : '[??]';
                            const status = canCraft ? '✅' : '❌';

                            items.push(
                                `${tierLabel} \`${itemName}\` ${status}\n` +
                                `> **Effect:** ${effect}\n` +
                                `> **Craftable:** ${maxCraftable}\n` +
                                `> ────────────────`
                            );
                        }

                        embed.setDescription(items.length
                            ? items.join('\n')
                            : `No craftable items found in **${selectedCategory}**.`
                        );
                        return embed;
                    };

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    const sent = await message.reply({ embeds: [getEmbed()], components: [row] });
                    const collector = sent.createMessageComponentCollector({
                        filter: i => i.user.id === message.author.id,
                        time: 45000
                    });

                    collector.on('collect', async interaction => {
                        try {
                            await interaction.deferUpdate();
                            if (interaction.customId === 'next_page') {
                                currentPage = (currentPage + 1) % pages.length;
                            } else if (interaction.customId === 'prev_page') {
                                currentPage = (currentPage - 1 + pages.length) % pages.length;
                            }
                            // Refresh history if on history page
                            if (pages[currentPage] === 'Craft History') {
                                const newHistory = await getPotionHistory();
                                historyRows.length = 0;
                                historyRows.push(...newHistory);
                            }
                            await sent.edit({ embeds: [getEmbed()], components: [row] });
                        } catch (e) {
                            console.error(`[CraftMenu] Button error:`, e);
                        }
                    });

                    collector.on('end', () => {
                        sent.edit({ components: [] }).catch(() => { });
                    });
                } catch (err) {
                    console.error(`[CraftMenu] Error:`, err);
                    message.reply('❌ An error occurred while loading your crafting menu.');
                }
            } else {
                // Parse item and amount
                const itemName = args[0];
                const craftAmount = Math.max(1, parseInt(args[1]) || 1);

                if (!recipes[itemName]) return message.reply('❌ That item does not exist.');
                if (craftAmount <= 0) return message.reply('❌ Craft amount must be at least 1.');

                const recipe = recipes[itemName];

                try {
                    const { userInventory, userCoins, userGems } = await getUserData();

                    let hasAll = true;
                    let missing = [];

                    const requiredItems = Object.entries(recipe.requires).map(([reqItem, reqQty]) => {
                        const totalRequired = reqQty * craftAmount;
                        const owned = userInventory[reqItem] || 0;
                        if (owned < totalRequired) {
                            hasAll = false;
                            missing.push(`📦 ${totalRequired}x ${reqItem} (you have ${owned})`);
                        }
                        return `📦 ${totalRequired}x ${reqItem} — *(You have ${owned})*`;
                    });

                    const totalCoins = recipe.resources.coins * craftAmount;
                    const totalGems = recipe.resources.gems * craftAmount;

                    if (userCoins < totalCoins) {
                        hasAll = false;
                        missing.push(`💰 ${formatNumber(totalCoins)} coins (you have ${formatNumber(userCoins)})`);
                    }
                    if (userGems < totalGems) {
                        hasAll = false;
                        missing.push(`💎 ${formatNumber(totalGems)} gems (you have ${formatNumber(userGems)})`);
                    }

                    if (!hasAll) {
                        const missingEmbed = new EmbedBuilder()
                            .setTitle('❌ Missing Requirements')
                            .setColor(Colors.Red)
                            .setDescription(`You are missing the following to craft **${craftAmount}x ${itemName}**:`)
                            .addFields({ name: 'Requirements', value: missing.map(m => `- ${m}`).join('\n') });
                        return message.reply({ embeds: [missingEmbed] });
                    }

                    const confirmEmbed = new EmbedBuilder()
                        .setTitle(`⚒️ Craft **${craftAmount}x ${itemName}**?`)
                        .setColor(Colors.Blue)
                        .addFields(
                            { name: '📋 Effect:', value: recipe.effect || '*No effect description*' },
                            { name: '📦 Required Materials:', value: requiredItems.join('\n') || 'None' },
                            { name: '💰 Cost:', value: `Coins: ${formatNumber(totalCoins)} | Gems: ${formatNumber(totalGems)}` },
                            { name: '🔔 Instruction:', value: 'Type **yes** to confirm or **no** to cancel.' }
                        )
                        .setFooter({ text: 'You have 15 seconds to respond.' });

                    const confirmMsg = await message.reply({ embeds: [confirmEmbed] });

                    const collector = message.channel.createMessageCollector({
                        filter: m => m.author.id === message.author.id,
                        max: 1,
                        time: 15000
                    });

                    collector.on('collect', async collected => {
                        const reply = collected.content.toLowerCase();
                        if (reply === 'yes') {
                            try {
                                db.serialize(() => {
                                    // Deduct coins/gems
                                    db.run(
                                        "UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?",
                                        [totalCoins, totalGems, userId],
                                        function (err) {
                                            if (err) {
                                                console.error(`[Craft] Failed to deduct coins/gems:`, err);
                                                return message.reply('❌ Failed to update your balance.');
                                            }
                                        }
                                    );
                                    // Deduct required items
                                    for (const [reqItem, reqQty] of Object.entries(recipe.requires)) {
                                        db.run(
                                            `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
                                            [reqQty * craftAmount, userId, reqItem],
                                            function (err) {
                                                if (err) {
                                                    console.error(`[Craft] Failed to deduct ${reqItem}:`, err);
                                                }
                                            }
                                        );
                                    }
                                    // Add crafted item
                                    db.run(
                                        `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)
                                         ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
                                        [userId, itemName, craftAmount, craftAmount],
                                        function (err) {
                                            if (err) {
                                                console.error(`[Craft] Failed to add crafted item:`, err);
                                                return message.reply('❌ Failed to add crafted item.');
                                            }
                                        }
                                    );
                                    // Log to history
                                    addPotionHistory(itemName, craftAmount);

                                    const successEmbed = new EmbedBuilder()
                                        .setTitle('✅ Crafting Successful!')
                                        .setColor(Colors.Green)
                                        .setDescription(`You have crafted **${craftAmount}x ${itemName}**!`)
                                        .setFooter({ text: 'Check your inventory or use .potionCraft to see your new items.' });
                                    message.reply({ embeds: [successEmbed] });
                                });
                            } catch (err) {
                                console.error(`[Craft] Crafting error:`, err);
                                message.reply('❌ An error occurred during crafting.');
                            }
                        } else {
                            message.reply('❌ Crafting cancelled.');
                        }
                    });

                    collector.on('end', (collected, reason) => {
                        if (collected.size === 0) {
                            message.reply('⌛ Crafting timed out.');
                        }
                    });
                } catch (err) {
                    console.error(`[Craft] Error:`, err);
                    message.reply('❌ An error occurred while processing your craft request.');
                }
            }
        } catch (err) {
            console.error(`[PotionCraft] Fatal error:`, err);
            message.reply('❌ An unexpected error occurred.');
        }
    });
};

const recipes = {
    // Coin Potions
    "CoinPotionT2(R)": {
        category: "Coins Potion",
        requires: { "CoinPotionT1(R)": 5 },
        resources: { coins: 15000, gems: 150 },
        effect: "+50% Coins for 60 min"
    },
    "CoinPotionT3(R)": {
        category: "Coins Potion",
        requires: { "CoinPotionT2(R)": 2 },
        resources: { coins: 30000, gems: 500 },
        effect: "+75% Coins for 60 min"
    },
    "CoinPotionT4(L)": {
        category: "Coins Potion",
        requires: { "CoinPotionT3(R)": 2 },
        resources: { coins: 65000, gems: 1000 },
        effect: "+100% Coins for 60 min"
    },
    "CoinPotionT5(M)": {
        category: "Coins Potion",
        requires: {
            "CoinPotionT1(R)": 10,
            "CoinPotionT2(R)": 5,
            "CoinPotionT3(R)": 3,
            "CoinPotionT4(L)": 1
        },
        resources: { coins: 175000, gems: 10000 },
        effect: "+150% Coins for 60 min"
    },

    // Gem Potions
    "GemPotionT2(R)": {
        category: "Gems Potion",
        requires: { "GemPotionT1(R)": 4 },
        resources: { coins: 0, gems: 2000 },
        effect: "+20% Gems for 60 min"
    },
    "GemPotionT3(R)": {
        category: "Gems Potion",
        requires: { "GemPotionT2(R)": 2 },
        resources: { coins: 0, gems: 5000 },
        effect: "+45% Gems for 60 min"
    },
    "GemPotionT4(L)": {
        category: "Gems Potion",
        requires: { "GemPotionT3(R)": 2 },
        resources: { coins: 0, gems: 25000 },
        effect: "+90% Gems for 60 min"
    },
    "GemPotionT5(M)": {
        category: "Gems Potion",
        requires: {
            "GemPotionT1(R)": 10,
            "GemPotionT2(R)": 4,
            "GemPotionT3(R)": 2,
            "GemPotionT4(L)": 1
        },
        resources: { coins: 0, gems: 50000 },
        effect: "+125% Gems for 60 min"
    },

    // Boost Potions (Coins + Gems)
    "BoostPotionT1(L)": {
        category: "Other Potion",
        requires: {
            "CoinPotionT1(R)": 1,
            "GemPotionT1(R)": 1
        },
        resources: { coins: 100000, gems: 1000 },
        effect: "+25% Coins & Gems for 30 min"
    },
    "BoostPotionT2(L)": {
        category: "Other Potion",
        requires: {
            "CoinPotionT2(R)": 1,
            "GemPotionT2(R)": 1,
            "BoostPotionT1(L)": 2
        },
        resources: { coins: 250000, gems: 2500 },
        effect: "+50% Coins & Gems for 30 min"
    },
    "BoostPotionT3(L)": {
        category: "Other Potion",
        requires: {
            "CoinPotionT3(R)": 1,
            "GemPotionT3(R)": 1,
            "BoostPotionT2(L)": 2
        },
        resources: { coins: 500000, gems: 5000 },
        effect: "+100% Coins & Gems for 30 min"
    },
    "BoostPotionT4(M)": {
        category: "Other Potion",
        requires: {
            "CoinPotionT4(L)": 1,
            "GemPotionT4(L)": 1,
            "BoostPotionT3(L)": 2
        },
        resources: { coins: 1000000, gems: 10000 },
        effect: "+150% Coins & Gems for 30 min"
    },
    "BoostPotionT5(M)": {
        category: "Other Potion",
        requires: {
            "CoinPotionT5(M)": 1,
            "GemPotionT5(M)": 1,
            "BoostPotionT4(M)": 1
        },
        resources: { coins: 2500000, gems: 25000 },
        effect: "+300% Coins & Gems for 60 min"
    },
};