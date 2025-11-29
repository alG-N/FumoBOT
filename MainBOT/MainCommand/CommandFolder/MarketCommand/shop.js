const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../../Core/Database/db');
const { maintenance, developerID } = require("../../Configuration/MaintenanceConfig");
const { isBanned } = require('../../Administrator/BannedList/BanUtils');

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

const STOCK_MESSAGES = {
    UNLIMITED: '!!!U*L?M%2D!!!',
    LEGENDARY: 'LEGENDARY stock',
    LOTS: 'A lot of items.',
    ON_STOCK: 'On-Stock',
    OUT_OF_STOCK: 'Out of Stock'
};

const RARITY_ICONS = {
    Common: "🟩",
    Rare: "🟦",
    Epic: "🟨",
    Legendary: "🟪",
    Mythical: "🟥",
    "???": "⬛"
};

// Simplified rarity thresholds: [unlimited, legendary, lots, onStock]
const RARITY_THRESHOLDS = {
    Common: [0.005, 0.05, 0.25, 1.0],
    Rare: [0.005, 0.03, 0.12, 0.3],
    Epic: [0.005, 0.02, 0.08, 0.2],
    Legendary: [0.005, 0.015, 0.05, 0.15],
    Mythical: [0.005, 0.01, 0.03, 0.1],
    '???': [0.005]
};

const STOCK_RANGES = {
    LEGENDARY: [15, 30],
    LOTS: [3, 15],
    ON_STOCK: [1, 3],
    MYSTERY: [1, 2]
};

module.exports = async (client) => {
    const userShopCache = new Map();

    // Utility functions
    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    
    const isDoubleLuckDay = () => {
        const day = new Date().getDay();
        return day === 5 || day === 6 || day === 0; // Fri/Sat/Sun
    };

    const isGuaranteedMysteryBlock = () => {
        const hour = new Date().getUTCHours();
        return hour % 6 === 0; // Every 6 hours: 0-5, 6-11, 12-17, 18-23
    };

    const getCurrentHourTimestamp = () => {
        const now = new Date();
        now.setMinutes(0, 0, 0);
        return now.getTime();
    };

    const getUserShopTimeLeft = () => {
        const now = Date.now();
        const nextHour = getCurrentHourTimestamp() + 3600000;
        const timeRemaining = nextHour - now;
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        return `${minutes} minute(s) and ${seconds} second(s)`;
    };

    const formatStockText = (stock, stockMessage) => {
        if (stock === 0) return `~~Out of Stock~~`;
        if (stock === 'unlimited') return stockMessage;
        return `Stock: ${stock} (${stockMessage})`;
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

    // Consolidated stock assignment
    const assignStock = (rarity, forceMystery = false) => {
        // Handle forced mystery items
        if (rarity === '???' && forceMystery) {
            return { 
                stock: getRandomInt(...STOCK_RANGES.MYSTERY), 
                message: STOCK_MESSAGES.ON_STOCK 
            };
        }

        const thresholds = RARITY_THRESHOLDS[rarity] || [];
        if (thresholds.length === 0) {
            return { stock: 0, message: STOCK_MESSAGES.OUT_OF_STOCK };
        }

        // Apply double luck on weekends (except for ???)
        let rand = Math.random();
        if (isDoubleLuckDay() && rarity !== '???') {
            rand = Math.min(rand * 0.5, 1);
        }

        // Check thresholds in order
        if (rand <= thresholds[0]) {
            return { stock: 'unlimited', message: STOCK_MESSAGES.UNLIMITED };
        }
        if (thresholds[1] && rand <= thresholds[1]) {
            return { stock: getRandomInt(...STOCK_RANGES.LEGENDARY), message: STOCK_MESSAGES.LEGENDARY };
        }
        if (thresholds[2] && rand <= thresholds[2]) {
            return { stock: getRandomInt(...STOCK_RANGES.LOTS), message: STOCK_MESSAGES.LOTS };
        }
        if (thresholds[3] && rand <= thresholds[3]) {
            return { stock: getRandomInt(...STOCK_RANGES.ON_STOCK), message: STOCK_MESSAGES.ON_STOCK };
        }

        // Out of stock (only for Rare+ rarities)
        return { stock: 0, message: STOCK_MESSAGES.OUT_OF_STOCK };
    };

    const randomizePrice = (basePrice) => {
        const eventChance = Math.random();
        let variationPercent = 20;
        let priceTag = 'NORMAL';

        if (eventChance < 0.1) {
            variationPercent = -40;
            priceTag = 'SALE';
        } else if (eventChance > 0.9) {
            variationPercent = 50;
            priceTag = 'SURGE';
        }

        const variation = basePrice * (variationPercent / 100);
        const min = Math.floor(basePrice + Math.min(0, variation));
        const max = Math.ceil(basePrice + Math.max(0, variation));
        const cost = getRandomInt(min, max);

        return { cost, priceTag };
    };

    const createItem = (basePrice, currency, rarity, forceMystery = false) => {
        const { cost, priceTag } = randomizePrice(basePrice);
        const stockData = assignStock(rarity, forceMystery);
        
        return {
            cost,
            priceTag,
            currency,
            ...stockData,
            rarity
        };
    };

    // Item definitions - consolidated format
    const itemDefinitions = [
        // Common
        { name: 'UniqueRock(C)', basePrice: 3500, currency: 'gems', rarity: 'Common' },
        { name: 'Books(C)', basePrice: 2500, currency: 'coins', rarity: 'Common' },
        { name: 'Wool(C)', basePrice: 1050, currency: 'coins', rarity: 'Common' },
        { name: 'Wood(C)', basePrice: 750, currency: 'coins', rarity: 'Common' },
        { name: 'Dice(C)', basePrice: 500, currency: 'coins', rarity: 'Common' },
        { name: 'PetFoob(C)', basePrice: 5000, currency: 'coins', rarity: 'Common' },
        // Rare
        { name: 'FragmentOf1800s(R)', basePrice: 15000, currency: 'gems', rarity: 'Rare' },
        { name: 'WeirdGrass(R)', basePrice: 10000, currency: 'gems', rarity: 'Rare' },
        // Epic
        { name: 'EnhancedScroll(E)', basePrice: 35000, currency: 'gems', rarity: 'Epic' },
        { name: 'RustedCore(E)', basePrice: 125000, currency: 'coins', rarity: 'Epic' },
        // Legendary
        { name: 'RedShard(L)', basePrice: 75000, currency: 'gems', rarity: 'Legendary' },
        { name: 'BlueShard(L)', basePrice: 75000, currency: 'gems', rarity: 'Legendary' },
        { name: 'YellowShard(L)', basePrice: 75000, currency: 'gems', rarity: 'Legendary' },
        { name: 'WhiteShard(L)', basePrice: 135000, currency: 'gems', rarity: 'Legendary' },
        { name: 'DarkShard(L)', basePrice: 135000, currency: 'gems', rarity: 'Legendary' },
        // Mythical
        { name: 'ChromaShard(M)', basePrice: 500000, currency: 'gems', rarity: 'Mythical' },
        { name: 'MonoShard(M)', basePrice: 500000, currency: 'gems', rarity: 'Mythical' },
        { name: 'EquinoxAlloy(M)', basePrice: 1000000, currency: 'gems', rarity: 'Mythical' },
        // ???
        { name: 'GoldenSigil(?)', basePrice: 100000000, currency: 'coins', rarity: '???' },
        { name: 'Undefined(?)', basePrice: 7557575, currency: 'gems', rarity: '???' },
        { name: 'Null?(?)', basePrice: 91991919, currency: 'coins', rarity: '???' }
    ];

    const generateUserShop = () => {
        const shop = {};
        let guaranteedMysteryGiven = false;
        const guaranteeMystery = isGuaranteedMysteryBlock();

        // Shuffle items to randomize which ??? gets the guarantee
        const shuffledItems = [...itemDefinitions].sort(() => Math.random() - 0.5);

        for (const def of shuffledItems) {
            const forceMystery = def.rarity === '???' && guaranteeMystery && !guaranteedMysteryGiven;
            if (forceMystery) guaranteedMysteryGiven = true;

            shop[def.name] = createItem(def.basePrice, def.currency, def.rarity, forceMystery);
        }

        return shop;
    };

    const getUserShop = (userId) => {
        const currentHour = getCurrentHourTimestamp();
        let cache = userShopCache.get(userId);

        if (!cache || cache.timestamp !== currentHour) {
            cache = {
                shop: generateUserShop(),
                timestamp: currentHour
            };
            userShopCache.set(userId, cache);
        }

        return cache.shop;
    };

    client.on('messageCreate', async (message) => {
        if (!message.content.startsWith('.shop') && !message.content.startsWith('.sh')) return;

        const access = checkAccess(message.author.id);
        if (access.blocked) {
            const embed = createAccessEmbed(access.isMaintenance, access.banData);
            console.log(`[${new Date().toISOString()}] Blocked user (${message.author.id}) due to ${access.isMaintenance ? "maintenance" : "ban"}.`);
            return message.reply({ embeds: [embed] });
        }

        handleShopCommand(message);
    });

    const handleShopCommand = async (message) => {
        const args = message.content.split(' ');
        const command = args[1]?.toLowerCase();
        const userId = message.author.id;
        const userShop = getUserShop(userId);

        if (command === 'buy') {
            await handleBuyCommand(message, args, userId, userShop);
        } else if (command === 'search') {
            handleSearchCommand(message, args, userShop);
        } else {
            handleDisplayShop(message, userId, userShop);
        }
    };

    const handleBuyCommand = async (message, args, userId, userShop) => {
        const itemName = args.slice(2, -1).join(' ') || args[2];
        const quantity = Math.max(Number(args[args.length - 1]) || 1, 1);
        const itemCost = userShop[itemName];

        if (!itemCost) {
            return message.reply({ 
                content: `🔍 The item "${itemName}" is not available in your magical shop.`, 
                ephemeral: true 
            });
        }

        if (itemCost.stock === 0) {
            return message.reply({ 
                content: `❌ You don't have this item in your shop stock.`, 
                ephemeral: true 
            });
        }

        if (itemCost.stock !== 'unlimited' && itemCost.stock < quantity) {
            return message.reply({ 
                content: `⚠️ Sorry, you only have ${itemCost.stock} ${itemName}(s) in your shop.`, 
                ephemeral: true 
            });
        }

        db.get(`SELECT ${itemCost.currency} FROM userCoins WHERE userId = ?`, [userId], async (err, row) => {
            if (err) {
                console.error('Database error:', err.message);
                return message.reply('❌ An error occurred. Please try again.');
            }

            if (!row || row[itemCost.currency] < itemCost.cost * quantity) {
                return message.reply({ 
                    content: `💸 You do not have enough ${itemCost.currency} to buy ${quantity} ${itemName}(s).`, 
                    ephemeral: true 
                });
            }

            const confirmationEmbed = new EmbedBuilder()
                .setTitle("🛒 Confirm Purchase")
                .setDescription(
                    `Are you sure you want to buy **${quantity} ${itemName}(s)** ` +
                    `for **${formatNumber(itemCost.cost * quantity)} ${itemCost.currency}**?`
                )
                .setColor("#0099ff");

            const buttonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('purchase_confirm')
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('purchase_cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
            );

            const confirmationMessage = await message.reply({ 
                embeds: [confirmationEmbed], 
                components: [buttonRow], 
                ephemeral: true 
            });

            const filter = i => i.user.id === userId;
            const collector = confirmationMessage.createMessageComponentCollector({ 
                filter, 
                time: 15000 
            });

            collector.on('collect', async i => {
                if (i.customId === 'purchase_confirm') {
                    await processPurchase(i, userId, itemName, itemCost, quantity);
                } else {
                    await i.update({ 
                        content: '⏸️ Purchase canceled.', 
                        embeds: [], 
                        components: [], 
                        ephemeral: true 
                    });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    confirmationMessage.edit({ 
                        content: '⏱️ Purchase timed out.', 
                        embeds: [], 
                        components: [], 
                        ephemeral: true 
                    }).catch(() => {});
                }
            });
        });
    };

    const processPurchase = async (interaction, userId, itemName, itemCost, quantity) => {
        const totalCost = itemCost.cost * quantity;

        db.run(
            `UPDATE userCoins SET ${itemCost.currency} = ${itemCost.currency} - ? WHERE userId = ?`,
            [totalCost, userId], 
            (err) => {
                if (err) {
                    console.error('Database error:', err.message);
                    return interaction.update({ 
                        content: '❌ Purchase failed. Please try again.', 
                        embeds: [], 
                        components: [] 
                    });
                }

                db.run(
                    `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?) 
                     ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
                    [userId, itemName, quantity, quantity], 
                    (err) => {
                        if (err) {
                            console.error('Database error:', err.message);
                            return;
                        }

                        // Update stock
                        if (itemCost.stock !== 'unlimited') {
                            itemCost.stock -= quantity;
                            if (itemCost.stock <= 0) {
                                itemCost.stock = 0;
                                itemCost.message = STOCK_MESSAGES.OUT_OF_STOCK;
                            }
                        }

                        interaction.update({
                            content: `✅ You have successfully purchased **${quantity} ${itemName}(s)** for **${formatNumber(totalCost)} ${itemCost.currency}**!`,
                            embeds: [], 
                            components: [], 
                            ephemeral: true
                        });
                    }
                );
            }
        );
    };

    const handleSearchCommand = (message, args, userShop) => {
        const searchQuery = args.slice(2).join(' ').toLowerCase();
        const categorizedItems = { Common: [], Rare: [], Epic: [], Legendary: [], Mythical: [], '???': [] };

        Object.keys(userShop).forEach(itemName => {
            const item = userShop[itemName];
            if (!itemName.toLowerCase().includes(searchQuery)) return;

            const stockText = formatStockText(item.stock, item.message);
            const priceLabel = item.priceTag === 'SALE' ? '🔥 SALE' : 
                               item.priceTag === 'SURGE' ? '📈 Surge' : '';

            categorizedItems[item.rarity].push(
                `${RARITY_ICONS[item.rarity]} \`${itemName}\` — **${formatNumber(item.cost)} ${item.currency}** ` +
                `(${stockText}${priceLabel ? ` • ${priceLabel}` : ''})`
            );
        });

        const searchEmbed = new EmbedBuilder()
            .setTitle("🔍 Search Results")
            .setDescription(`Here are the items that match your search:`)
            .setColor('#0099ff');

        for (const rarity of Object.keys(categorizedItems)) {
            const itemsList = categorizedItems[rarity].length > 0 ? 
                categorizedItems[rarity].join('\n') : 
                '-No items found-';
            searchEmbed.addFields({ 
                name: `${RARITY_ICONS[rarity]} ${rarity}`, 
                value: itemsList, 
                inline: false 
            });
        }

        message.reply({ embeds: [searchEmbed], ephemeral: true });
    };

    const handleDisplayShop = (message, userId, userShop) => {
        const categorizedItems = { Common: [], Rare: [], Epic: [], Legendary: [], Mythical: [], '???': [] };

        Object.keys(userShop).forEach(itemName => {
            const item = userShop[itemName];
            if (item.stock === 0) return; // Skip out-of-stock items

            const stockText = formatStockText(item.stock, item.message);
            const priceLabel = item.priceTag === 'SALE' ? '🔥 SALE' : 
                               item.priceTag === 'SURGE' ? '📈 Surge' : '';

            categorizedItems[item.rarity].push(
                `\`${itemName}\` — **${formatNumber(item.cost)} ${item.currency}** ` +
                `(${stockText}${priceLabel ? ` • ${priceLabel}` : ''})`
            );
        });

        const timeUntilNextReset = getUserShopTimeLeft();

        const shopEmbed = new EmbedBuilder()
            .setTitle("✨ Welcome to Your Magical Shop ✨")
            .setDescription(
                `🧙‍♂️ **Some random guy's magical shop** is open just for you!\n\n` +
                `📜 To buy: \`.shop buy <ItemName> <Quantity>\`\n` +
                `🔎 To search: \`.shop search <ItemName>\`\n\n` +
                `🔄 **Your shop resets in:** ${timeUntilNextReset}` +
                (isDoubleLuckDay() ? `\n🍀 **x2 Luck is active!**` : '') +
                (isGuaranteedMysteryBlock() ? `\n⬛ **Guaranteed ??? item in this shop!**` : '')
            )
            .setColor('#0099ff')
            .setThumbnail('https://img1.picmix.com/output/stamp/normal/6/1/0/7/2577016_a2c58.png')
            .setFooter({ text: 'Prices and stock are unique to you. Shop resets every hour on the hour.' });

        for (const rarity of Object.keys(categorizedItems)) {
            const itemsList = categorizedItems[rarity].length > 0 ? 
                categorizedItems[rarity].join('\n') : 
                '-No items available here-';
            shopEmbed.addFields({ 
                name: `${RARITY_ICONS[rarity]} ${rarity} Items`, 
                value: itemsList, 
                inline: false 
            });
        }

        message.reply({ embeds: [shopEmbed], ephemeral: true });
    };
};

