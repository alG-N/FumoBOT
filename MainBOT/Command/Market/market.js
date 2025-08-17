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
client.setMaxListeners(150);
function formatNumber(number) {
    return number.toLocaleString();
}
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
const { allFumoList, market } = require('./Storage/marketStorage');
const { getWeekIdentifier, incrementWeeklyShiny, incrementWeeklyAstral } = require('../utils/weekly'); // adjust path
module.exports = async (client) => {
    // Balanced rarity levels (sum to 1, more reasonable distribution)
    let rarityLevels = [
        { name: 'Common', chance: 0.35, minStock: 60, maxStock: 120 },
        { name: 'UNCOMMON', chance: 0.22, minStock: 50, maxStock: 100 },
        { name: 'RARE', chance: 0.13, minStock: 35, maxStock: 80 },
        { name: 'EPIC', chance: 0.09, minStock: 25, maxStock: 60 },
        { name: 'OTHERWORLDLY', chance: 0.06, minStock: 15, maxStock: 40 },
        { name: 'LEGENDARY', chance: 0.045, minStock: 10, maxStock: 30 },
        { name: 'MYTHICAL', chance: 0.025, minStock: 5, maxStock: 15 },
        { name: 'EXCLUSIVE', chance: 0.015, minStock: 5, maxStock: 12 },
        { name: '???', chance: 0.012, minStock: 4, maxStock: 10 },
        { name: 'ASTRAL', chance: 0.008, minStock: 3, maxStock: 8 },
        { name: 'CELESTIAL', chance: 0.006, minStock: 3, maxStock: 6 },
        { name: 'INFINITE', chance: 0.004, minStock: 2, maxStock: 5 },
        { name: 'ETERNAL', chance: 0.003, minStock: 2, maxStock: 4 },
        { name: 'TRANSCENDENT', chance: 0.002, minStock: 1, maxStock: 3 }
    ];

    // Per-user market cache: { [userId]: { market: [], resetTime: timestamp, ... } }
    const userMarkets = {};

    const fumoPool = allFumoList;

    function getRandomStock(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function extractRarity(name) {
        const match = name.match(/\(([^)]+)\)$/);
        return match ? match[1] : null;
    }

    function getRarityData(rarityName, levels = rarityLevels) {
        return levels.find(r => r.name.toLowerCase() === rarityName?.toLowerCase());
    }

    function applyDynamicWeightScaling(levels, consecutiveMisses = 0) {
        const buffed = ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
        const scaleFactor = 0.05 * consecutiveMisses;
        return levels.map(r => {
            if (buffed.includes(r.name)) {
                return { ...r, chance: r.chance * (1 + scaleFactor) };
            }
            return { ...r };
        });
    }

    function applyWeekendBuff(levels) {
        const day = new Date().getDay();
        if (![0, 5, 6].includes(day)) return levels;
        const buffed = ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
        return levels.map(r => {
            if (buffed.includes(r.name)) {
                return { ...r, chance: r.chance * 2 };
            }
            return { ...r };
        });
    }

    // Calculate next reset time at 0:00, 1:00, or 2:00
    function getNextResetTime() {
        const now = new Date();
        const next = new Date(now);
        next.setMinutes(0, 0, 0); // zero out minutes, seconds, milliseconds
        next.setHours(now.getHours() + 1); // set to next full hour
        return next.getTime();
    }

    // Generate a fresh market for a user
    function generateUserMarket(userId) {
        let consecutiveMisses = 0;
        let lastTimeHadQuestionMarkPlus = Date.now();
        let lastTimeHadCelestialPlus = Date.now();

        // Apply buffs
        let effectiveLevels = [...rarityLevels];
        effectiveLevels = applyDynamicWeightScaling(effectiveLevels, consecutiveMisses);
        effectiveLevels = applyWeekendBuff(effectiveLevels);

        const usedNames = new Set();
        let selected = [];

        for (const fumo of fumoPool) {
            const rarityName = extractRarity(fumo.name);
            const rarity = getRarityData(rarityName, effectiveLevels);
            if (!rarity) continue;
            if (usedNames.has(fumo.name)) continue;
            if (Math.random() < rarity.chance) {
                const fumoCopy = { ...fumo };
                fumoCopy.rarity = rarity.name;
                fumoCopy.stock = getRandomStock(rarity.minStock, rarity.maxStock);
                selected.push(fumoCopy);
                usedNames.add(fumo.name);
            }
        }

        // Always ensure at least 5-7 fumos are present
        if (selected.length < 5) {
            const candidates = fumoPool.filter(f => !usedNames.has(f.name));
            while (selected.length < 5 && candidates.length > 0) {
                const idx = Math.floor(Math.random() * candidates.length);
                const fumo = candidates.splice(idx, 1)[0];
                const rarityName = extractRarity(fumo.name);
                const rarity = getRarityData(rarityName, effectiveLevels);
                if (!rarity) continue;
                const fumoCopy = { ...fumo };
                fumoCopy.rarity = rarity.name;
                fumoCopy.stock = getRandomStock(rarity.minStock, rarity.maxStock);
                selected.push(fumoCopy);
                usedNames.add(fumo.name);
            }
        }
        // Cap at 7 for sanity (optional)
        if (selected.length > 7) {
            selected = selected.slice(0, 7 + Math.floor(Math.random() * (selected.length - 6)));
        }

        // Check for high rarities
        const now = Date.now();
        const hasQuestionMarkPlus = selected.some(f => {
            const r = extractRarity(f.name);
            return ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'].includes(r);
        });
        const hasCelestialPlus = selected.some(f => {
            const r = extractRarity(f.name);
            return ['CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'].includes(r);
        });

        if (hasQuestionMarkPlus) {
            lastTimeHadQuestionMarkPlus = now;
            consecutiveMisses = 0;
        } else {
            consecutiveMisses++;
        }

        if (hasCelestialPlus) {
            lastTimeHadCelestialPlus = now;
        }

        // Force-inject `???+` if 12h passed
        if (!hasQuestionMarkPlus && now - lastTimeHadQuestionMarkPlus >= 12 * 60 * 60 * 1000) {
            const candidates = fumoPool.filter(f => {
                const r = extractRarity(f.name);
                return ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'].includes(r);
            });
            if (candidates.length > 0) {
                const forced = candidates[Math.floor(Math.random() * candidates.length)];
                const rarity = extractRarity(forced.name);
                selected[0] = {
                    ...forced,
                    rarity,
                    stock: getRandomStock(getRarityData(rarity).minStock, getRarityData(rarity).maxStock)
                };
                lastTimeHadQuestionMarkPlus = now;
                consecutiveMisses = 0;
            }
        }

        // Force-inject `CELESTIAL+` if 24h passed
        if (!hasCelestialPlus && now - lastTimeHadCelestialPlus >= 24 * 60 * 60 * 1000) {
            const candidates = fumoPool.filter(f => {
                const r = extractRarity(f.name);
                return ['CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'].includes(r);
            });
            if (candidates.length > 0) {
                const forced = candidates[Math.floor(Math.random() * candidates.length)];
                const rarity = extractRarity(forced.name);
                selected[1] = {
                    ...forced,
                    rarity,
                    stock: getRandomStock(getRarityData(rarity).minStock, getRarityData(rarity).maxStock)
                };
                lastTimeHadCelestialPlus = now;
            }
        }

        // Set resetTime to next 0:00, 1:00, or 2:00
        return {
            market: selected,
            resetTime: getNextResetTime()
        };
    }

    // Helper to get or refresh a user's market
    function getUserMarket(userId) {
        const now = Date.now();
        if (!userMarkets[userId] || now > userMarkets[userId].resetTime) {
            userMarkets[userId] = generateUserMarket(userId);
        }
        return userMarkets[userId];
    }

    // Global market reset at 0:00, 1:00, 2:00 for all users
    function scheduleGlobalMarketReset() {
        const now = new Date();
        let nextReset = getNextResetTime();
        let msUntilReset = nextReset - now.getTime();

        setTimeout(() => {
            // Clear all user markets
            Object.keys(userMarkets).forEach(userId => {
                userMarkets[userId] = generateUserMarket(userId);
            });
            // Schedule next reset
            scheduleGlobalMarketReset();
        }, msUntilReset);
    }
    scheduleGlobalMarketReset();

    client.on('messageCreate', message => {
        if (message.content === '.market' || message.content.startsWith('.market ') || message.content === '.m' || message.content.startsWith('.m ')) {

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
            showMarketPage(message, 0);
        } else if (message.content.startsWith('.purchase') || message.content.startsWith('.pu')) {
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
            handlePurchaseCommand(message);
        }
    });

    function showMarketPage(message) {
        const { market, resetTime } = getUserMarket(message.author.id);
        const remainingTime = Math.max(Math.floor((resetTime - Date.now()) / 60000), 0);

        db.get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [message.author.id], (err, row) => {
            if (err) {
                console.error(err.message);
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle("🎪 Golden's Market Extravaganza 🎪")
                .setDescription(
                    `✨ **Golden's father is selling premium Fumos!** ✨\n` +
                    `Use **\`.purchase <name>\`** to buy.\n\n` +
                    `⏳ **Market resets in:** \`${remainingTime} minute(s)\`\n` +
                    `💰 **Limited stock! Refreshes often!**\n`
                )
                .setColor('#f5b042')
                .setThumbnail('https://media.tenor.com/rFFZ4WbQq3EAAAAC/fumo.gif');

            rarityLevels.forEach(rarity => {
                const fumos = market.filter(fumo => fumo.rarity === rarity.name);
                if (fumos.length === 0) return;

                const emoji = getRarityEmoji(rarity.name);
                const fumoText = fumos.map(fumo =>
                    `**${fumo.name}**\n💵 Price: ${formatNumber(fumo.price)}  |  📦 Stock: ${fumo.stock}`
                ).join('\n');

                embed.addFields({ name: `${emoji} ${rarity.name}`, value: fumoText });
            });

            if (row && row.coins && row.gems) {
                embed.addFields(
                    {
                        name: '🪙 Your Coins',
                        value: `\`${formatNumber(row.coins)}\``,
                        inline: true
                    },
                    {
                        name: '💎 Your Gems',
                        value: `\`${formatNumber(row.gems)}\``,
                        inline: true
                    }
                );
            }

            message.reply({ embeds: [embed] });
        });
    }

    function getRarityEmoji(rarity) {
        const emojis = {
            'Common': '⚪',
            'UNCOMMON': '🟢',
            'RARE': '🔵',
            'EPIC': '🟣',
            'OTHERWORLDLY': '🌌',
            'LEGENDARY': '🟠',
            'MYTHICAL': '💫',
            'EXCLUSIVE': '💎',
            '???': '❓',
            'ASTRAL': '🌠',
            'CELESTIAL': '🌟',
            'INFINITE': '♾️',
            'ETERNAL': '🪐',
            'TRANSCENDENT': '👑'
        };
        return emojis[rarity] || '🔸';
    }

    function handlePurchaseCommand(message) {
        const args = message.content.split(' ').slice(1);

        if (args.length === 0) {
            const tutorialEmbed = new EmbedBuilder()
                .setTitle("📖 How to Use /purchase")
                .setDescription("To purchase a Fumo, use:\n`/purchase FumoName [amount]`\n\n**Example:** `/purchase Marisa 3`\nYou can also omit the amount to buy 1.\n\nUse `/market` to view what’s for sale!")
                .setColor('#00aaff');
            message.reply({ embeds: [tutorialEmbed] });
            return;
        }

        let amount = 1;
        const lastArg = args[args.length - 1];
        if (!isNaN(lastArg)) {
            amount = parseInt(lastArg);
            args.pop();
        }

        const fumoName = args.join(' ');
        const userMarketObj = getUserMarket(message.author.id);
        const fumo = userMarketObj.market.find(f => f.name.toLowerCase() === fumoName.toLowerCase());

        if (!fumo) {
            const notFoundEmbed = new EmbedBuilder()
                .setTitle('⚠️ Fumo Not Found ⚠️')
                .setDescription(`Could not find a Fumo named **"${fumoName}"** in the market. Make sure you typed it exactly.`)
                .setColor('#ff0000');
            message.reply({ embeds: [notFoundEmbed] });
            return;
        }

        if (fumo.stock < amount) {
            const stockEmbed = new EmbedBuilder()
                .setTitle('⚠️ Not Enough Stock ⚠️')
                .setDescription(`Only **${fumo.stock}** of **${fumo.name}** left in the market, but you asked for **${amount}**.`)
                .setColor('#ff0000');
            message.reply({ embeds: [stockEmbed] });
            return;
        }

        const totalPrice = fumo.price * amount;

        const confirmEmbed = new EmbedBuilder()
            .setTitle('🛒 Confirm Purchase')
            .setDescription(`Are you sure you want to purchase **${amount}x ${fumo.name}** for **${formatNumber(totalPrice)} coins**?`)
            .setColor('#00ff00');

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirmPurchase')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancelPurchase')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
        message.reply({ embeds: [confirmEmbed], components: [row] });

        const filter = i => i.user.id === message.author.id;
        const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 15000 });

        collector.on('collect', i => {
            if (i.customId === 'confirmPurchase') {
                handlePurchaseConfirmation(i, fumo, amount, message, userMarketObj);
            } else if (i.customId === 'cancelPurchase') {
                i.reply('Purchase canceled.');
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                confirmButton.setDisabled(true);
                cancelButton.setDisabled(true);
                message.edit({ components: [row.setComponents(confirmButton, cancelButton)] });
            }
        });
    }

    function handlePurchaseConfirmation(interaction, fumo, amount, message, userMarketObj) {
        const totalPrice = fumo.price * amount;

        db.get(`SELECT coins FROM userCoins WHERE userId = ?`, [message.author.id], (err, row) => {
            if (err) {
                console.error(err.message);
                return;
            }

            if (!row) {
                const noCoinsEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Empty Coin Pouch ⚠️')
                    .setDescription('You do not have any coins yet. Go on adventures to earn some before shopping!')
                    .setColor('#ff0000');
                interaction.reply({ embeds: [noCoinsEmbed] });
                return;
            }

            if (row.coins < totalPrice) {
                const insufficientCoinsEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Not Enough Coins ⚠️')
                    .setDescription(`You need **${formatNumber(totalPrice)}** coins to buy **${amount}x ${fumo.name}**, but you only have **${formatNumber(row.coins)}**.`)
                    .setColor('#ff0000');
                interaction.reply({ embeds: [insufficientCoinsEmbed] });
                return;
            }

            if (fumo.stock < amount) {
                const outOfStockEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Not Enough Stock ⚠️')
                    .setDescription(`Only **${fumo.stock}** of **${fumo.name}** are left, but you tried to buy **${amount}**.`)
                    .setColor('#ff0000');
                interaction.reply({ embeds: [outOfStockEmbed] });
                return;
            }

            const remainingCoins = row.coins - totalPrice;
            processPurchase(interaction, fumo, remainingCoins, amount, message, userMarketObj);
        });
    }

    function processPurchase(i, fumo, remainingCoins, amount, message, userMarketObj) {
        db.run(`UPDATE userCoins SET coins = ? WHERE userId = ?`, [remainingCoins, message.author.id], async err => {
            if (err) {
                console.error(err.message);
                return;
            }

            fumo.stock -= amount;

            const shinyMarkValue = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT luck FROM userCoins WHERE userId = ?`,
                    [message.author.id],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row?.luck || 0);
                    }
                );
            });

            for (let x = 0; x < amount; x++) {
                addFumoToInventory(message.author.id, fumo, shinyMarkValue);
            }

            const purchaseSuccessEmbed = new EmbedBuilder()
                .setTitle('🎉 Purchase Successful 🎉')
                .setDescription(`You bought **${amount}x ${fumo.name}**! 🎊\nRemaining Coins: ${formatNumber(remainingCoins)}\nStock left: ${fumo.stock}`)
                .setColor('#00ff00');
            i.reply({ embeds: [purchaseSuccessEmbed] });

            if (fumo.stock <= 0) {
                removeFumoFromMarket(fumo, userMarketObj);
            }
        });
    }

    function removeFumoFromMarket(fumo, userMarketObj) {
        let index = userMarketObj.market.findIndex(f => f.name === fumo.name);
        if (index !== -1) {
            userMarketObj.market.splice(index, 1);
        }
    }

    function addFumoToInventory(userId, fumo, shinyMarkValue = 0) {
        const shinyMark = Math.min(1, shinyMarkValue);
        const shinyChance = 0.01 + (shinyMark * 0.02);
        const alGChance = 0.00001 + (shinyMark * 0.00009);

        const isAlterGolden = Math.random() < alGChance;
        const isShiny = !isAlterGolden && Math.random() < shinyChance;

        let fumoName = fumo.name;
        if (isAlterGolden) {
            fumoName += '[🌟alG]';
            incrementWeeklyShiny(userId);
        } else if (isShiny) {
            fumoName += '[✨SHINY]';
            incrementWeeklyShiny(userId);
        }

        db.run(
            `INSERT INTO userInventory(userId, fumoName) VALUES(?, ?)`,
            [userId, fumoName],
            (err) => {
                if (err) {
                    console.error(err.message);
                }
            }
        );
    }
}
