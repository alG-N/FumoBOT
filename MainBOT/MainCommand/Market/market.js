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
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
const { allFumoList } = require('./Storage/marketStorage');
const { incrementWeeklyShiny } = require('../Utils/weekly');

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

const formatNumber = (number) => number.toLocaleString();

const rarityLevels = [
    { name: 'Common', chance: 0.35, minStock: 60, maxStock: 120, emoji: '⚪' },
    { name: 'UNCOMMON', chance: 0.22, minStock: 50, maxStock: 100, emoji: '🟢' },
    { name: 'RARE', chance: 0.13, minStock: 35, maxStock: 80, emoji: '🔵' },
    { name: 'EPIC', chance: 0.09, minStock: 25, maxStock: 60, emoji: '🟣' },
    { name: 'OTHERWORLDLY', chance: 0.06, minStock: 15, maxStock: 40, emoji: '🌌' },
    { name: 'LEGENDARY', chance: 0.045, minStock: 10, maxStock: 30, emoji: '🟠' },
    { name: 'MYTHICAL', chance: 0.025, minStock: 5, maxStock: 15, emoji: '💫' },
    { name: 'EXCLUSIVE', chance: 0.015, minStock: 5, maxStock: 12, emoji: '💎' },
    { name: '???', chance: 0.012, minStock: 4, maxStock: 10, emoji: '❓' },
    { name: 'ASTRAL', chance: 0.008, minStock: 3, maxStock: 8, emoji: '🌠' },
    { name: 'CELESTIAL', chance: 0.006, minStock: 3, maxStock: 6, emoji: '🌟' },
    { name: 'INFINITE', chance: 0.004, minStock: 2, maxStock: 5, emoji: '♾️' },
    { name: 'ETERNAL', chance: 0.003, minStock: 2, maxStock: 4, emoji: '🪐' },
    { name: 'TRANSCENDENT', chance: 0.002, minStock: 1, maxStock: 3, emoji: '🌈' }
];

const HIGH_RARITIES = ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
const CELESTIAL_PLUS = ['CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];

module.exports = async (client) => {
    const userMarkets = {};
    const fumoPool = allFumoList;

    // Utility functions
    const getRandomStock = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    
    const extractRarity = (name) => {
        const match = name.match(/\(([^)]+)\)$/);
        return match ? match[1] : null;
    };

    const getRarityData = (rarityName) => 
        rarityLevels.find(r => r.name.toLowerCase() === rarityName?.toLowerCase());

    const applyBuffs = (levels, consecutiveMisses = 0) => {
        const day = new Date().getDay();
        const isWeekend = [0, 5, 6].includes(day);
        const scaleFactor = 0.05 * consecutiveMisses;

        return levels.map(r => {
            if (!HIGH_RARITIES.includes(r.name)) return { ...r };
            
            let buffedChance = r.chance;
            if (consecutiveMisses > 0) buffedChance *= (1 + scaleFactor);
            if (isWeekend) buffedChance *= 2;
            
            return { ...r, chance: buffedChance };
        });
    };

    const getNextResetTime = () => {
        const now = new Date();
        const next = new Date(now);
        next.setMinutes(0, 0, 0);
        next.setHours(now.getHours() + 1);
        return next.getTime();
    };

    const createAccessEmbed = (isMaintenance, banData) => {
        let description = '';
        let footerText = '';
        let title = '';

        if (isMaintenance) {
            title = '🚧 Maintenance Mode';
            description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
            footerText = "Thank you for your patience";
        } else if (banData) {
            title = '⛔ You Are Banned';
            description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

            if (banData.expiresAt) {
                const remaining = banData.expiresAt - Date.now();
                const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
                const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                const seconds = Math.floor((remaining / 1000) % 60);

                const timeString = [
                    days && `${days}d`,
                    hours && `${hours}h`,
                    minutes && `${minutes}m`,
                    seconds && `${seconds}s`
                ].filter(Boolean).join(' ');

                description += `\n**Time Remaining:** ${timeString}`;
            } else {
                description += `\n**Ban Type:** Permanent`;
            }
            footerText = "Ban enforced by developer";
        }

        return new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: footerText })
            .setTimestamp();
    };

    const checkAccess = (userId) => {
        const isMaintenance = maintenance === "yes" && userId !== developerID;
        const banData = isBanned(userId);
        return { blocked: isMaintenance || banData, isMaintenance, banData };
    };

    const generateUserMarket = (userId) => {
        let consecutiveMisses = 0;
        const effectiveLevels = applyBuffs(rarityLevels, consecutiveMisses);
        const usedNames = new Set();
        const selected = [];

        // Select fumos based on rarity chances
        for (const fumo of fumoPool) {
            const rarityName = extractRarity(fumo.name);
            const rarity = getRarityData(rarityName);
            
            if (!rarity || usedNames.has(fumo.name) || Math.random() >= rarity.chance) continue;

            selected.push({
                ...fumo,
                rarity: rarity.name,
                stock: getRandomStock(rarity.minStock, rarity.maxStock)
            });
            usedNames.add(fumo.name);
        }

        // Ensure minimum 5 fumos
        const candidates = fumoPool.filter(f => !usedNames.has(f.name));
        while (selected.length < 5 && candidates.length > 0) {
            const idx = Math.floor(Math.random() * candidates.length);
            const fumo = candidates.splice(idx, 1)[0];
            const rarityName = extractRarity(fumo.name);
            const rarity = getRarityData(rarityName);
            
            if (!rarity) continue;

            selected.push({
                ...fumo,
                rarity: rarity.name,
                stock: getRandomStock(rarity.minStock, rarity.maxStock)
            });
            usedNames.add(fumo.name);
        }

        // Cap at random 7-13 fumos
        if (selected.length > 7) {
            const maxSize = 7 + Math.floor(Math.random() * (selected.length - 6));
            selected.splice(maxSize);
        }

        // Force high-rarity injection logic (kept as-is since it's complex)
        const now = Date.now();
        const hasHighRarity = selected.some(f => HIGH_RARITIES.includes(extractRarity(f.name)));
        const hasCelestialPlus = selected.some(f => CELESTIAL_PLUS.includes(extractRarity(f.name)));

        // Force inject ??? or higher if none in 12h (simplified)
        if (!hasHighRarity) {
            const highRarityFumos = fumoPool.filter(f => HIGH_RARITIES.includes(extractRarity(f.name)));
            if (highRarityFumos.length > 0 && selected.length > 0) {
                const forced = highRarityFumos[Math.floor(Math.random() * highRarityFumos.length)];
                const rarity = getRarityData(extractRarity(forced.name));
                selected[0] = {
                    ...forced,
                    rarity: rarity.name,
                    stock: getRandomStock(rarity.minStock, rarity.maxStock)
                };
            }
        }

        // Force inject CELESTIAL+ if none in 24h (simplified)
        if (!hasCelestialPlus) {
            const celestialFumos = fumoPool.filter(f => CELESTIAL_PLUS.includes(extractRarity(f.name)));
            if (celestialFumos.length > 0 && selected.length > 1) {
                const forced = celestialFumos[Math.floor(Math.random() * celestialFumos.length)];
                const rarity = getRarityData(extractRarity(forced.name));
                selected[1] = {
                    ...forced,
                    rarity: rarity.name,
                    stock: getRandomStock(rarity.minStock, rarity.maxStock)
                };
            }
        }

        return {
            market: selected,
            resetTime: getNextResetTime()
        };
    };

    const getUserMarket = (userId) => {
        const now = Date.now();
        if (!userMarkets[userId] || now > userMarkets[userId].resetTime) {
            userMarkets[userId] = generateUserMarket(userId);
        }
        return userMarkets[userId];
    };

    // Schedule global market resets
    const scheduleGlobalMarketReset = () => {
        const msUntilReset = getNextResetTime() - Date.now();
        setTimeout(() => {
            Object.keys(userMarkets).forEach(userId => {
                userMarkets[userId] = generateUserMarket(userId);
            });
            scheduleGlobalMarketReset();
        }, msUntilReset);
    };
    scheduleGlobalMarketReset();

    client.on('messageCreate', message => {
        const isMarketCommand = message.content === '.market' || message.content === '.m' || 
                                message.content.startsWith('.market ') || message.content.startsWith('.m ');
        const isPurchaseCommand = message.content.startsWith('.purchase') || message.content.startsWith('.pu');

        if (!isMarketCommand && !isPurchaseCommand) return;

        const access = checkAccess(message.author.id);
        if (access.blocked) {
            const embed = createAccessEmbed(access.isMaintenance, access.banData);
            console.log(`[${new Date().toISOString()}] Blocked user (${message.author.id}) due to ${access.isMaintenance ? "maintenance" : "ban"}.`);
            return message.reply({ embeds: [embed] });
        }

        if (isMarketCommand) {
            showMarketPage(message);
        } else if (isPurchaseCommand) {
            handlePurchaseCommand(message);
        }
    });

    const showMarketPage = (message) => {
        const { market, resetTime } = getUserMarket(message.author.id);
        const remainingTime = Math.max(Math.floor((resetTime - Date.now()) / 60000), 0);

        db.get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [message.author.id], (err, row) => {
            if (err) {
                console.error('Database error:', err.message);
                return message.reply('❌ An error occurred while fetching your coins.');
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
                const fumos = market.filter(f => f.rarity === rarity.name);
                if (fumos.length === 0) return;

                const fumoText = fumos.map(fumo =>
                    `**${fumo.name}**\n💵 Price: ${formatNumber(fumo.price)}  |  📦 Stock: ${fumo.stock}`
                ).join('\n');

                embed.addFields({ name: `${rarity.emoji} ${rarity.name}`, value: fumoText });
            });

            if (row?.coins !== undefined && row?.gems !== undefined) {
                embed.addFields(
                    { name: '🪙 Your Coins', value: `\`${formatNumber(row.coins)}\``, inline: true },
                    { name: '💎 Your Gems', value: `\`${formatNumber(row.gems)}\``, inline: true }
                );
            }

            message.reply({ embeds: [embed] });
        });
    };

    const handlePurchaseCommand = (message) => {
        const args = message.content.split(' ').slice(1);

        if (args.length === 0) {
            const tutorialEmbed = new EmbedBuilder()
                .setTitle("📖 How to Use .purchase")
                .setDescription(
                    "To purchase a Fumo, use:\n`/purchase FumoName [amount]`\n\n" +
                    "**Example:** `/purchase Marisa 3`\n" +
                    "You can also omit the amount to buy 1.\n\n" +
                    "Use `/market` to view what's for sale!"
                )
                .setColor('#00aaff');
            return message.reply({ embeds: [tutorialEmbed] });
        }

        let amount = 1;
        const lastArg = args[args.length - 1];
        if (!isNaN(lastArg) && parseInt(lastArg) > 0) {
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
            return message.reply({ embeds: [notFoundEmbed] });
        }

        if (fumo.stock < amount) {
            const stockEmbed = new EmbedBuilder()
                .setTitle('⚠️ Not Enough Stock ⚠️')
                .setDescription(`Only **${fumo.stock}** of **${fumo.name}** left in the market, but you asked for **${amount}**.`)
                .setColor('#ff0000');
            return message.reply({ embeds: [stockEmbed] });
        }

        const totalPrice = fumo.price * amount;
        const confirmEmbed = new EmbedBuilder()
            .setTitle('🛒 Confirm Purchase')
            .setDescription(`Are you sure you want to purchase **${amount}x ${fumo.name}** for **${formatNumber(totalPrice)} coins**?`)
            .setColor('#00ff00');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirmPurchase')
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancelPurchase')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        message.reply({ embeds: [confirmEmbed], components: [row] }).then(reply => {
            const filter = i => i.user.id === message.author.id;
            const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 15000 });

            collector.on('collect', i => {
                if (i.customId === 'confirmPurchase') {
                    handlePurchaseConfirmation(i, fumo, amount, message, userMarketObj);
                } else {
                    i.reply('Purchase canceled.');
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    reply.edit({ components: [] }).catch(() => {});
                }
            });
        });
    };

    const handlePurchaseConfirmation = (interaction, fumo, amount, message, userMarketObj) => {
        const totalPrice = fumo.price * amount;

        db.get(`SELECT coins FROM userCoins WHERE userId = ?`, [message.author.id], (err, row) => {
            if (err) {
                console.error('Database error:', err.message);
                return interaction.reply('❌ An error occurred. Please try again.');
            }

            if (!row) {
                const noCoinsEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Empty Coin Pouch ⚠️')
                    .setDescription('You do not have any coins yet. Go on adventures to earn some before shopping!')
                    .setColor('#ff0000');
                return interaction.reply({ embeds: [noCoinsEmbed] });
            }

            if (row.coins < totalPrice) {
                const insufficientCoinsEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Not Enough Coins ⚠️')
                    .setDescription(`You need **${formatNumber(totalPrice)}** coins to buy **${amount}x ${fumo.name}**, but you only have **${formatNumber(row.coins)}**.`)
                    .setColor('#ff0000');
                return interaction.reply({ embeds: [insufficientCoinsEmbed] });
            }

            if (fumo.stock < amount) {
                const outOfStockEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Not Enough Stock ⚠️')
                    .setDescription(`Only **${fumo.stock}** of **${fumo.name}** are left, but you tried to buy **${amount}**.`)
                    .setColor('#ff0000');
                return interaction.reply({ embeds: [outOfStockEmbed] });
            }

            const remainingCoins = row.coins - totalPrice;
            processPurchase(interaction, fumo, remainingCoins, amount, message, userMarketObj);
        });
    };

    const processPurchase = (i, fumo, remainingCoins, amount, message, userMarketObj) => {
        db.run(`UPDATE userCoins SET coins = ? WHERE userId = ?`, [remainingCoins, message.author.id], async (err) => {
            if (err) {
                console.error('Database error:', err.message);
                return i.reply('❌ Purchase failed. Please try again.');
            }

            fumo.stock -= amount;

            const shinyMarkValue = await new Promise((resolve) => {
                db.get(`SELECT luck FROM userCoins WHERE userId = ?`, [message.author.id], (err, row) => {
                    resolve(err || !row ? 0 : row.luck);
                });
            });

            for (let x = 0; x < amount; x++) {
                addFumoToInventory(message.author.id, fumo, shinyMarkValue);
            }

            const purchaseSuccessEmbed = new EmbedBuilder()
                .setTitle('🎉 Purchase Successful 🎉')
                .setDescription(
                    `You bought **${amount}x ${fumo.name}**! 🎊\n` +
                    `Remaining Coins: ${formatNumber(remainingCoins)}\n` +
                    `Stock left: ${fumo.stock}`
                )
                .setColor('#00ff00');
            i.reply({ embeds: [purchaseSuccessEmbed] });

            if (fumo.stock <= 0) {
                const index = userMarketObj.market.findIndex(f => f.name === fumo.name);
                if (index !== -1) userMarketObj.market.splice(index, 1);
            }
        });
    };

    const addFumoToInventory = (userId, fumo, shinyMarkValue = 0) => {
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

        db.run(`INSERT INTO userInventory(userId, fumoName) VALUES(?, ?)`, [userId, fumoName], (err) => {
            if (err) console.error('Inventory error:', err.message);
        });
    };
};

