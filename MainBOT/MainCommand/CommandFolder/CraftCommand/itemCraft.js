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
function formatNumber(num) {
    if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Qa';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
}
const { maintenance, developerID } = require("../../Configuration/Maintenance/maintenanceConfig");
const { incrementDailyCraft } = require('../../Ultility/weekly'); // adjust path
const { isBanned } = require('../../Administrator/BannedList/BanUtils');
module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        try {
            if (
                message.author.bot ||
                (
                    message.content !== '.itemCraft' &&
                    !message.content.startsWith('.itemCraft ') &&
                    message.content !== '.ic' &&
                    !message.content.startsWith('.ic ')
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

            // Helper for logging
            const logError = (msg, err) => {
                console.error(`[itemCraft] ${msg}`, err);
            };

            // Helper for formatting requirements
            function formatRequirements(requires, userInventory, craftAmount = 1) {
                return Object.entries(requires).map(([reqItem, reqQty]) => {
                    const owned = userInventory[reqItem] || 0;
                    const totalRequired = reqQty * craftAmount;
                    return `📦 ${totalRequired}x ${reqItem} — *(You have ${owned})*`;
                }).join('\n');
            }

            // Helper for formatting resources
            function formatResources(resources, userCoins, userGems, craftAmount = 1) {
                const coins = resources.coins * craftAmount;
                const gems = resources.gems * craftAmount;
                return `💰 Coins: ${formatNumber(coins)} *(You have ${formatNumber(userCoins)})*\n💎 Gems: ${formatNumber(gems)} *(You have ${formatNumber(userGems)})*`;
            }

            // New Feature: Show user's craft history (last 5 crafts)
            async function showCraftHistory(userId, message) {
                db.all(
                    `SELECT itemName, amount, craftedAt FROM userCraftHistory WHERE userId = ? ORDER BY craftedAt DESC LIMIT 5`,
                    [userId],
                    (err, rows) => {
                        if (err) {
                            logError('Failed to fetch craft history', err);
                            return message.reply('❌ Could not fetch your craft history.');
                        }
                        if (!rows.length) {
                            return message.reply('📜 You have no crafting history yet.');
                        }
                        const embed = new EmbedBuilder()
                            .setTitle('🕑 Your Recent Crafting History')
                            .setColor(0xFFD700)
                            .setDescription(
                                rows.map(r =>
                                    `• **${r.amount}x ${r.itemName}** at <t:${Math.floor(r.craftedAt / 1000)}:f>`
                                ).join('\n')
                            )
                            .setFooter({ text: 'Use .itemCraft <item> to craft more!' });
                        message.reply({ embeds: [embed] });
                    }
                );
            }

            // Show craft history if user types .itemCraft history
            if (itemToCraft.toLowerCase() === 'history') {
                return showCraftHistory(userId, message);
            }

            if (!itemToCraft) {
                db.all(
                    `SELECT itemName, SUM(quantity) as totalQuantity FROM userInventory WHERE userId = ? GROUP BY itemName`,
                    [userId],
                    (err, inventoryRows) => {
                        if (err) {
                            logError('Database error on inventory fetch', err);
                            return message.reply('❌ Database error.');
                        }

                        db.get(
                            `SELECT coins, gems FROM userCoins WHERE userId = ?`,
                            [userId],
                            (err, coinRow) => {
                                if (err) {
                                    logError('Could not fetch balances', err);
                                    return message.reply('❌ Could not fetch your balances.');
                                }

                                const userInventory = {};
                                inventoryRows.forEach(row => userInventory[row.itemName] = row.totalQuantity);
                                const userCoins = coinRow?.coins || 0;
                                const userGems = coinRow?.gems || 0;

                                const pageTitles = ['How to Craft', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5', 'Tier 6(MAX)'];
                                let currentPage = 0;

                                const getEmbed = () => {
                                    const pageName = pageTitles[currentPage];
                                    const embed = new EmbedBuilder()
                                        .setColor(0x00BFFF)
                                        .setFooter({ text: `Page ${currentPage + 1} of ${pageTitles.length}` })
                                        .setTimestamp();

                                    if (pageName === 'How to Craft') {
                                        embed
                                            .setTitle('📖 How to Craft')
                                            .setDescription(
                                                '**Usage:**\n```/itemCraft <item name>```\n\n' +
                                                'Make sure you have the required materials and coins/gems in your inventory.\n\n' +
                                                'Navigate the pages below to see what you can currently craft!\n\n' +
                                                '🆕 **Tip:** Type `.itemCraft history` to see your last 5 crafts!'
                                            );
                                        return embed;
                                    }

                                    embed.setTitle(`🛠️ Craftable Items - ${pageName}`);
                                    const items = [];

                                    for (const [itemName, data] of Object.entries(recipes)) {
                                        const { requires, resources, category } = data;
                                        if (category !== pageName) continue;

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

                                        const status = canCraft ? '✅' : '❌';

                                        items.push(
                                            `**${status} \`${itemName}\`**\n` +
                                            `> 📝 *${data.effect || 'No effect'}*\n` +
                                            `> 🧰 Craftable: **${maxCraftable}**\n` +
                                            `> 💰 Cost: ${formatNumber(resources.coins)} coins, ${formatNumber(resources.gems)} gems\n` +
                                            `-----------------------------------------`
                                        );
                                    }

                                    if (items.length === 0) {
                                        embed.setDescription(`No craftable items found in **${pageName}**.`);
                                    } else {
                                        embed.setDescription(items.join('\n'));
                                    }

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

                                message.reply({ embeds: [getEmbed()], components: [row] }).then(sent => {
                                    const collector = sent.createMessageComponentCollector({
                                        filter: i => i.user.id === message.author.id,
                                        time: 60000
                                    });

                                    collector.on('collect', interaction => {
                                        interaction.deferUpdate().catch(() => { });
                                        if (interaction.customId === 'next_page') {
                                            currentPage = (currentPage + 1) % pageTitles.length;
                                        } else if (interaction.customId === 'prev_page') {
                                            currentPage = (currentPage - 1 + pageTitles.length) % pageTitles.length;
                                        }
                                        sent.edit({ embeds: [getEmbed()], components: [row] }).catch(() => { });
                                    });

                                    collector.on('end', () => {
                                        sent.edit({ components: [] }).catch(() => { });
                                    });
                                }).catch(err => logError('Failed to send embed', err));
                            }
                        );
                    }
                );
            } else {
                // Parse item name and amount robustly
                let craftAmount = 1;
                let itemName = itemToCraft;
                // Support ".itemCraft <item> <amount>" or ".itemCraft <amount> <item>"
                if (args.length > 1) {
                    if (!isNaN(args[args.length - 1])) {
                        craftAmount = parseInt(args[args.length - 1]);
                        itemName = args.slice(0, -1).join(' ').trim();
                    } else if (!isNaN(args[0])) {
                        craftAmount = parseInt(args[0]);
                        itemName = args.slice(1).join(' ').trim();
                    }
                }

                if (!recipes[itemName]) return message.reply('❌ That item does not exist. Check spelling or use `.itemCraft` to see available items.');
                if (craftAmount <= 0 || !Number.isInteger(craftAmount)) return message.reply('❌ Craft amount must be a positive integer.');

                const recipe = recipes[itemName];

                db.all(
                    `SELECT itemName, SUM(quantity) as totalQuantity FROM userInventory WHERE userId = ? GROUP BY itemName`,
                    [userId],
                    (err, inventoryRows) => {
                        if (err) {
                            logError('Database error on inventory fetch', err);
                            return message.reply('❌ Database error.');
                        }

                        db.get(
                            `SELECT coins, gems FROM userCoins WHERE userId = ?`,
                            [userId],
                            async (err, coinRow) => {
                                if (err) {
                                    logError('Could not fetch balances', err);
                                    return message.reply('❌ Could not fetch your balances.');
                                }

                                const userInventory = {};
                                inventoryRows.forEach(row => userInventory[row.itemName] = row.totalQuantity);
                                const userCoins = coinRow?.coins || 0;
                                const userGems = coinRow?.gems || 0;

                                let hasAll = true;
                                let missing = [];

                                for (const [reqItem, reqQty] of Object.entries(recipe.requires)) {
                                    const totalRequired = reqQty * craftAmount;
                                    const owned = userInventory[reqItem] || 0;
                                    if (owned < totalRequired) {
                                        hasAll = false;
                                        missing.push(`${totalRequired}x ${reqItem} (you have ${owned})`);
                                    }
                                }

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
                                        .setColor(0xFF0000)
                                        .setDescription(`You are missing the following to craft **${craftAmount}x ${itemName}**:`)
                                        .addFields({ name: 'Requirements', value: missing.map(m => `- ${m}`).join('\n') })
                                        .setTimestamp();

                                    return message.reply({ embeds: [missingEmbed] });
                                }

                                // Confirm embed with improved UI
                                const confirmEmbed = new EmbedBuilder()
                                    .setTitle(`⚒️ Craft **${craftAmount}x ${itemName}**?`)
                                    .setColor(0x00AE86)
                                    .addFields(
                                        { name: '📋 Effect:', value: recipe.effect || '*No effect description*' },
                                        { name: '📦 Required Materials:', value: formatRequirements(recipe.requires, userInventory, craftAmount) || 'None' },
                                        { name: '💰 Cost:', value: formatResources(recipe.resources, userCoins, userGems, craftAmount) },
                                        { name: '🔔 Instruction:', value: 'Type **yes** to confirm or **no** to cancel.' }
                                    )
                                    .setFooter({ text: 'You have 15 seconds to respond.' })
                                    .setTimestamp();

                                const confirmMsg = await message.reply({ embeds: [confirmEmbed] });

                                const collector = message.channel.createMessageCollector({
                                    filter: m => m.author.id === message.author.id,
                                    max: 1,
                                    time: 15000
                                });

                                collector.on('collect', collected => {
                                    const reply = collected.content.toLowerCase();
                                    if (reply === 'yes') {
                                        db.serialize(() => {
                                            try {
                                                const coinStmt = db.prepare("UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?");
                                                coinStmt.run(totalCoins, totalGems, userId);
                                                coinStmt.finalize();

                                                for (const [reqItem, reqQty] of Object.entries(recipe.requires)) {
                                                    const stmt = db.prepare(`UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`);
                                                    stmt.run(reqQty * craftAmount, userId, reqItem);
                                                    stmt.finalize();
                                                }

                                                const addStmt = db.prepare("INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?) ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?");
                                                addStmt.run(userId, itemName, craftAmount, craftAmount);
                                                addStmt.finalize();

                                                // New Feature: Save craft history
                                                const histStmt = db.prepare("INSERT INTO userCraftHistory (userId, itemName, amount, craftedAt) VALUES (?, ?, ?, ?)");
                                                histStmt.run(userId, itemName, craftAmount, Date.now());
                                                histStmt.finalize();

                                                const successEmbed = new EmbedBuilder()
                                                    .setTitle('✅ Crafting Successful!')
                                                    .setColor(0x00FF00)
                                                    .setDescription(`You have crafted **${craftAmount}x ${itemName}**!`)
                                                    .setTimestamp();

                                                message.reply({ embeds: [successEmbed] });
                                                incrementDailyCraft(userId);
                                            } catch (err) {
                                                logError('Crafting transaction failed', err);
                                                message.reply('❌ Crafting failed due to an internal error.');
                                            }
                                        });
                                    } else {
                                        message.reply('❌ Crafting cancelled.');
                                    }
                                });

                                collector.on('end', (collected, reason) => {
                                    if (collected.size === 0) {
                                        message.reply('⌛ Crafting timed out.');
                                    }
                                });
                            }
                        );
                    }
                );
            }
        } catch (err) {
            console.error('[itemCraft] Uncaught error:', err);
            message.reply('❌ An unexpected error occurred. Please try again later.');
        }
    });
}

const recipes = {
    // Tier 1
    "ForgottenBook(C)": { //undone
        category: "Tier 1",
        requires: {
            "Books(C)": 1,
            "FragmentOf1800s(R)": 1
        },
        resources: { coins: 500, gems: 100 },
        effect: "Unlock secret story of this bot and its developer..."
    },

    "FantasyBook(M)": {
        category: "Tier 1",
        requires: {
            "ForgottenBook(C)": 1,
            "RedShard(L)": 1,
            "WhiteShard(L)": 1,
            "DarkShard(L)": 1,
            "BlueShard(L)": 1,
            "YellowShard(L)": 1
        },
        resources: { coins: 500, gems: 100 },
        effect: "Enable other-fumo from otherworld.."
    },

    // Tier 2
    "Lumina(M)": {
        category: "Tier 2",
        requires: { "StarShard(M)": 5 },
        resources: { coins: 25000, gems: 1500 },
        effect: "x5 luck permanently for every 10th roll\n(applied to normal/event banner)."
    },

    // Tier 3
    "AncientRelic(E)": {
        category: "Tier 3",
        requires: {
            "ForgottenBook(C)": 5,
            "UniqueRock(C)": 25,
            "WhiteShard(L)": 5,
            "DarkShard(L)": 5
        },
        resources: { coins: 35000, gems: 5000 },
        effect: "-60% value on selling, +250% luck boost\n+350% coin boost, +500% gem boost for 1 day\n(applied to normal/event banner)"
    },

    "MysteriousCube(M)": {
        category: "Tier 3",
        requires: {
            "MysteriousShard(M)": 5,
        },
        resources: { coins: 35000, gems: 5000 },
        effect: "+???% luck, +??? coin boost, +??? gem boost for 1 day, applied to normal/event banner."
    },

    // Tier 4
    "TimeClock(L)": {
        category: "Tier 4",
        requires: {
            "TimeClock-Broken(L)": 1,
            "FragmentOfTime(E)": 5,
            "FragmentOf1800s(R)": 10
        },
        resources: { coins: 35000, gems: 5000 },
        effect: "x2 speed on farming fumos, passive coins for 1 day(Cooldown: 1w)"
    },

    "MysteriousDice(M)": {
        category: "Tier 4",
        requires: {
            "MysteriousCube(M)": 1,
            "Dice(C)": 150,
        },
        resources: { coins: 35000, gems: 5000 },
        effect: "Dice that can be used to gamble your luck!\n\nBoost a random from 0.01% to 1000% every hour, lasted for 12 hours!\n\n**NOTE:*This item is not stackable!"
    },

    // Tier 5
    "Nullified(?)": {
        category: "Tier 5",
        requires: {
            "Undefined(?)": 2,
            "Null?(?)": 2,
        },
        resources: { coins: 150000, gems: 10000 },
        effect: "Your rolls become nullified,\n rarity chance does not matter for 1 roll."
    },

    // Tier 6
    "S!gil?(?)": { //undone
        category: "Tier 6(MAX)",
        requires: {
            "Nullified(?)": 15,
            "GoldenSigil(?)": 1,
            "EquinoxAlloy(M)": 15,
            "Undefined(?)": 10,
            "Null?(?)": 10
        },
        resources: { coins: 150000, gems: 10000 },
        effect: "\n- +1000% to +10000% coins for every GoldenSigil(?) applied\n- x1.25 to x2 luck for every GoldenSigil(?) applied\n- Your 10 rolls become nullified, rarity chance does not matter, reset every 1 day\n- +500% value when selling fumo\n- +1500% luck on Reimu's Praying\n\n**Downside:**\n- All of your boost no longer applied\n- You can longer get more than 1 same rarity(Applied for ASTRAL+)"
    },
}