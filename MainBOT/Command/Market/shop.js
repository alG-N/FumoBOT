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
module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.content.startsWith('.shop') || message.content.startsWith('.sh')) {
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
            handleShopCommand(message);
        }
    });
    // Stock messages and rarities
    const STOCK_MESSAGES = {
        UNLIMITED: '!!!U*L?M%2D!!!',
        LEGENDARY: 'LEGENDARY stock',
        LOTS: 'A lot of items.',
        ON_STOCK: 'On-Stock',
        OUT_OF_STOCK: 'Out of Stock'
    };

    // Helper function to get a random integer between min and max (inclusive)
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Helper: check if today is Friday, Saturday, or Sunday
    function isDoubleLuckDay() {
        const day = new Date().getDay();
        return day === 5 || day === 6 || day === 0; // Fri/Sat/Sun
    }

    // Helper: check if this 6-hour block is a guaranteed "???" block
    function isGuaranteedMysteryBlock() {
        const now = new Date();
        const hour = now.getUTCHours();
        // Every 6 hours: 0-5, 6-11, 12-17, 18-23
        return hour % 6 === 0;
    }

    // Function to assign stock based on rarity, with x2 luck and guarantee logic
    function assignStock(rarity, forceMystery = false) {
        let rand = Math.random();
        const doubleLuck = isDoubleLuckDay();
        // x2 luck: double the chance for each rarity roll except "???" (handled separately)
        if (doubleLuck && rarity !== '???') rand = Math.min(rand * 0.5, 1);

        // Buffed thresholds: max rarest is 0.5%, more balanced for higher rarities
        // Format: [unlimited, legendary, lots, on-stock]
        // Common:    [0.5%, 5%, 25%]
        // Rare:      [0.5%, 3%, 12%, 30%]
        // Epic:      [0.5%, 2%, 8%, 20%]
        // Legendary: [0.5%, 1.5%, 5%, 15%]
        // Mythical:  [0.5%, 1%, 3%, 10%]
        // ???:       [0.5%]
        let thresholds;
        switch (rarity) {
            case 'Common':
                thresholds = [0.005, 0.05, 0.25]; // 0.5%, 5%, 25%
                break;
            case 'Rare':
                thresholds = [0.005, 0.03, 0.12, 0.3]; // 0.5%, 3%, 12%, 30%
                break;
            case 'Epic':
                thresholds = [0.005, 0.02, 0.08, 0.2]; // 0.5%, 2%, 8%, 20%
                break;
            case 'Legendary':
                thresholds = [0.005, 0.015, 0.05, 0.15]; // 0.5%, 1.5%, 5%, 15%
                break;
            case 'Mythical':
                thresholds = [0.005, 0.01, 0.03, 0.1]; // 0.5%, 1%, 3%, 10%
                break;
            case '???':
                thresholds = [0.005]; // 0.5% (guaranteed logic below)
                break;
            default:
                thresholds = [];
        }

        // Guarantee "???" every 6 hours for at least one item
        if (rarity === '???' && forceMystery) {
            return { stock: getRandomInt(1, 2), message: STOCK_MESSAGES.ON_STOCK };
        }

        switch (rarity) {
            case 'Common':
                if (rand <= thresholds[0]) return { stock: 'unlimited', message: STOCK_MESSAGES.UNLIMITED };
                if (rand <= thresholds[1]) return { stock: getRandomInt(15, 30), message: STOCK_MESSAGES.LEGENDARY };
                if (rand <= thresholds[2]) return { stock: getRandomInt(3, 15), message: STOCK_MESSAGES.LOTS };
                return { stock: getRandomInt(1, 3), message: STOCK_MESSAGES.ON_STOCK };
            case 'Rare':
                if (rand <= thresholds[0]) return { stock: 'unlimited', message: STOCK_MESSAGES.UNLIMITED };
                if (rand <= thresholds[1]) return { stock: getRandomInt(15, 30), message: STOCK_MESSAGES.LEGENDARY };
                if (rand <= thresholds[2]) return { stock: getRandomInt(3, 15), message: STOCK_MESSAGES.LOTS };
                if (rand <= thresholds[3]) return { stock: getRandomInt(1, 3), message: STOCK_MESSAGES.ON_STOCK };
                return { stock: 0, message: STOCK_MESSAGES.OUT_OF_STOCK };
            case 'Epic':
                if (rand <= thresholds[0]) return { stock: 'unlimited', message: STOCK_MESSAGES.UNLIMITED };
                if (rand <= thresholds[1]) return { stock: getRandomInt(15, 30), message: STOCK_MESSAGES.LEGENDARY };
                if (rand <= thresholds[2]) return { stock: getRandomInt(3, 15), message: STOCK_MESSAGES.LOTS };
                if (rand <= thresholds[3]) return { stock: getRandomInt(1, 3), message: STOCK_MESSAGES.ON_STOCK };
                return { stock: 0, message: STOCK_MESSAGES.OUT_OF_STOCK };
            case 'Legendary':
                if (rand <= thresholds[0]) return { stock: 'unlimited', message: STOCK_MESSAGES.UNLIMITED };
                if (rand <= thresholds[1]) return { stock: getRandomInt(15, 30), message: STOCK_MESSAGES.LEGENDARY };
                if (rand <= thresholds[2]) return { stock: getRandomInt(3, 15), message: STOCK_MESSAGES.LOTS };
                if (rand <= thresholds[3]) return { stock: getRandomInt(1, 3), message: STOCK_MESSAGES.ON_STOCK };
                return { stock: 0, message: STOCK_MESSAGES.OUT_OF_STOCK };
            case 'Mythical':
                if (rand <= thresholds[0]) return { stock: 'unlimited', message: STOCK_MESSAGES.UNLIMITED };
                if (rand <= thresholds[1]) return { stock: getRandomInt(15, 30), message: STOCK_MESSAGES.LEGENDARY };
                if (rand <= thresholds[2]) return { stock: getRandomInt(3, 15), message: STOCK_MESSAGES.LOTS };
                if (rand <= thresholds[3]) return { stock: getRandomInt(1, 3), message: STOCK_MESSAGES.ON_STOCK };
                return { stock: 0, message: STOCK_MESSAGES.OUT_OF_STOCK };
            case '???':
                if (rand <= thresholds[0]) return { stock: getRandomInt(1, 2), message: STOCK_MESSAGES.ON_STOCK };
                return { stock: 0, message: STOCK_MESSAGES.OUT_OF_STOCK };
            default:
                return { stock: 0, message: STOCK_MESSAGES.OUT_OF_STOCK };
        }
    }

    // Define stock assignment functions
    function assignCommonStock() {
        return assignStock('Common');
    }
    function assignRareStock() {
        return assignStock('Rare');
    }
    function assignEpicStock() {
        return assignStock('Epic');
    }
    function assignLegendaryStock() {
        return assignStock('Legendary');
    }
    function assignMythicalStock() {
        return assignStock('Mythical');
    }
    function assignMysteryStock(forceMystery = false) {
        return assignStock('???', forceMystery);
    }

    function randomizePrice(basePrice) {
        const eventChance = Math.random();
        let variationPercent = 20; // default variation of normal price
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
        const cost = Math.floor(Math.random() * (max - min + 1)) + min;

        return { cost, priceTag };
    }

    function createItem(basePrice, currency, stockFn, rarity, forceMystery = false) {
        const { cost, priceTag } = randomizePrice(basePrice);
        return {
            cost,
            priceTag,
            currency,
            ...stockFn(forceMystery),
            rarity
        };
    }

    // Item definitions
    const itemDefinitions = [
        // Common
        { name: 'UniqueRock(C)', basePrice: 3500, currency: 'gems', stockFn: assignCommonStock, rarity: 'Common' },
        { name: 'Books(C)', basePrice: 2500, currency: 'coins', stockFn: assignCommonStock, rarity: 'Common' },
        { name: 'Wool(C)', basePrice: 1050, currency: 'coins', stockFn: assignCommonStock, rarity: 'Common' },
        { name: 'Wood(C)', basePrice: 750, currency: 'coins', stockFn: assignCommonStock, rarity: 'Common' },
        { name: 'Dice(C)', basePrice: 500, currency: 'coins', stockFn: assignCommonStock, rarity: 'Common' },
        { name: 'PetFoob(C)', basePrice: 5000, currency: 'coins', stockFn: assignCommonStock, rarity: 'Common' },
        // Rare
        { name: 'FragmentOf1800s(R)', basePrice: 15000, currency: 'gems', stockFn: assignRareStock, rarity: 'Rare' },
        { name: 'WeirdGrass(R)', basePrice: 10000, currency: 'gems', stockFn: assignRareStock, rarity: 'Rare' },
        // Epic
        { name: 'EnhancedScroll(E)', basePrice: 35000, currency: 'gems', stockFn: assignEpicStock, rarity: 'Epic' },
        { name: 'RustedCore(E)', basePrice: 125000, currency: 'coins', stockFn: assignEpicStock, rarity: 'Epic' },
        // Legendary
        { name: 'RedShard(L)', basePrice: 75000, currency: 'gems', stockFn: assignLegendaryStock, rarity: 'Legendary' },
        { name: 'BlueShard(L)', basePrice: 75000, currency: 'gems', stockFn: assignLegendaryStock, rarity: 'Legendary' },
        { name: 'YellowShard(L)', basePrice: 75000, currency: 'gems', stockFn: assignLegendaryStock, rarity: 'Legendary' },
        { name: 'WhiteShard(L)', basePrice: 135000, currency: 'gems', stockFn: assignLegendaryStock, rarity: 'Legendary' },
        { name: 'DarkShard(L)', basePrice: 135000, currency: 'gems', stockFn: assignLegendaryStock, rarity: 'Legendary' },
        // Mythic
        { name: 'ChromaShard(M)', basePrice: 500000, currency: 'gems', stockFn: assignMythicalStock, rarity: 'Mythical' },
        { name: 'MonoShard(M)', basePrice: 500000, currency: 'gems', stockFn: assignMythicalStock, rarity: 'Mythical' },
        { name: 'EquinoxAlloy(M)', basePrice: 1000000, currency: 'gems', stockFn: assignMythicalStock, rarity: 'Mythical' },
        // ???
        { name: 'GoldenSigil(?)', basePrice: 100000000, currency: 'coins', stockFn: assignMysteryStock, rarity: '???' },
        { name: 'Undefined(?)', basePrice: 7557575, currency: 'gems', stockFn: assignMysteryStock, rarity: '???' },
        { name: 'Null?(?)', basePrice: 91991919, currency: 'coins', stockFn: assignMysteryStock, rarity: '???' }
    ];

    // Variables to track the reset timer
    const resetInterval = 3600000; // 1 hour

    // Function to reset stock for all items (global shop, not per-user)
    function resetStock() {
        // No global stock needed, per-user shop is randomized
    }

    // Call resetStock initially (for compatibility)
    resetStock();
    setInterval(resetStock, resetInterval);

    // Rarity icons
    const rarityIcons = {
        Common: "🟩",
        Rare: "🟦",
        Epic: "🟨",
        Legendary: "🟪",
        Mythical: "🟥",
        "???": "⬛"
    };

    // Helper to format stock display
    function formatStockText(stock, stockMessage) {
        if (stock === 0) return `~~Out of Stock~~`;
        if (stock === 'unlimited') return `${stockMessage}`;
        return `Stock: ${stock} (${stockMessage})`;
    }

    // Per-user shop cache
    const userShopCache = new Map();

    // Generate a randomized shop for a user, with x2 luck and guaranteed ??? logic
    function generateUserShop() {
        const shop = {};
        let guaranteedMysteryGiven = false;
        const guaranteeMystery = isGuaranteedMysteryBlock();

        // Shuffle itemDefinitions to randomize which ??? gets the guarantee
        const shuffledItems = [...itemDefinitions].sort(() => Math.random() - 0.5);

        for (const def of shuffledItems) {
            let forceMystery = false;
            if (def.rarity === '???' && guaranteeMystery && !guaranteedMysteryGiven) {
                forceMystery = true;
                guaranteedMysteryGiven = true;
            }
            shop[def.name] = createItem(def.basePrice, def.currency, def.stockFn, def.rarity, forceMystery);
        }
        return shop;
    }

    // Get the timestamp for the current hour (e.g., 0:00, 1:00, 2:00, etc.)
    function getCurrentHourTimestamp() {
        const now = new Date();
        now.setMinutes(0, 0, 0);
        return now.getTime();
    }

    // Get or create a user's shop, reset at every hour (e.g., 0:00, 1:00, 2:00)
    function getUserShop(userId) {
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
    }

    // Get time until user's shop resets (to next hour)
    function getUserShopTimeLeft(userId) {
        const now = Date.now();
        const nextHour = getCurrentHourTimestamp() + 3600000;
        const timeRemaining = nextHour - now;
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        return `${minutes} minute(s) and ${seconds} second(s)`;
    }

    async function handleShopCommand(message) {
        const args = message.content.split(' ');
        const command = args[1]?.toLowerCase();
        const userId = message.author.id;
        const userShop = getUserShop(userId);

        if (command === 'buy') {
            const itemName = args.slice(2, -1).join(' ') || args[2];
            const quantity = Math.max(Number(args[args.length - 1]) || 1, 1);
            const itemCost = userShop[itemName];

            if (!itemCost) {
                message.reply({ content: `🔍 The item "${itemName}" is not available in your magical shop.`, ephemeral: true });
                return;
            }

            if (itemCost.stock === 0) {
                message.reply({ content: `❌ You don't have this item in your shop stock.`, ephemeral: true });
                return;
            }

            if (itemCost.stock !== 'unlimited' && itemCost.stock < quantity) {
                message.reply({ content: `⚠️ Sorry, you only have ${itemCost.stock} ${itemName}(s) in your shop.`, ephemeral: true });
                return;
            }

            db.get(`SELECT ${itemCost.currency} FROM userCoins WHERE userId = ?`, [userId], async (err, row) => {
                if (err) return console.error(err.message);
                if (!row || row[itemCost.currency] < itemCost.cost * quantity) {
                    message.reply({ content: `💸 You do not have enough ${itemCost.currency} to buy ${quantity} ${itemName}(s).`, ephemeral: true });
                    return;
                }

                const confirmationEmbed = new EmbedBuilder()
                    .setTitle("🛒 Confirm Purchase")
                    .setDescription(`Are you sure you want to buy **${quantity} ${itemName}(s)** for **${formatNumber(itemCost.cost * quantity)} ${itemCost.currency}**?`)
                    .setColor("#0099ff");

                const buttonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('purchase_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('purchase_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
                );

                const confirmationMessage = await message.reply({ embeds: [confirmationEmbed], components: [buttonRow], ephemeral: true });

                const filter = i => i.user.id === userId;
                const collector = confirmationMessage.createMessageComponentCollector({ filter, time: 15000 });

                collector.on('collect', async i => {
                    if (i.customId === 'purchase_confirm') {
                        db.run(`UPDATE userCoins SET ${itemCost.currency} = ${itemCost.currency} - ? WHERE userId = ?`,
                            [itemCost.cost * quantity, userId], err => {
                                if (err) return console.error(err.message);

                                db.run(`INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?) 
                                ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
                                    [userId, itemName, quantity, quantity], err => {
                                        if (err) return console.error(err.message);

                                        if (itemCost.stock !== 'unlimited') itemCost.stock -= quantity;
                                        if (itemCost.stock <= 0) {
                                            itemCost.stock = 0;
                                            itemCost.message = STOCK_MESSAGES.OUT_OF_STOCK;
                                        }

                                        i.update({
                                            content: `✅ You have successfully purchased **${quantity} ${itemName}(s)** for **${formatNumber(itemCost.cost * quantity)} ${itemCost.currency}**!`,
                                            embeds: [], components: [], ephemeral: true
                                        });
                                    });
                            });
                    } else {
                        i.update({ content: '❎ Purchase canceled.', embeds: [], components: [], ephemeral: true });
                    }
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
                        confirmationMessage.edit({ content: '⏱️ Purchase timed out.', embeds: [], components: [], ephemeral: true });
                    }
                });
            });
        } else if (command === 'search') {
            const searchQuery = args.slice(2).join(' ').toLowerCase();
            const categorizedItems = { Common: [], Rare: [], Epic: [], Legendary: [], Mythical: [], '???': [] };

            Object.keys(userShop).forEach(itemName => {
                const item = userShop[itemName];
                if (itemName.toLowerCase().includes(searchQuery)) {
                    const stockText = formatStockText(item.stock, item.message);
                    const priceLabel = {
                        SALE: '🔥 SALE',
                        SURGE: '📈 Surge',
                        NORMAL: ''
                    }[item.priceTag];

                    categorizedItems[item.rarity].push(
                        `${rarityIcons[item.rarity]} \`${itemName}\` — **${formatNumber(item.cost)} ${item.currency}** (${stockText}${priceLabel ? ` • ${priceLabel}` : ''})`
                    );
                }
            });

            const searchEmbed = new EmbedBuilder()
                .setTitle("🔍 Search Results")
                .setDescription(`Here are the items that match your search:`)
                .setColor('#0099ff');

            for (const rarity of Object.keys(categorizedItems)) {
                const itemsList = categorizedItems[rarity].length > 0 ? categorizedItems[rarity].join('\n') : '-No items found-';
                searchEmbed.addFields({ name: `${rarityIcons[rarity]} ${rarity}`, value: itemsList, inline: false });
            }

            message.reply({ embeds: [searchEmbed], ephemeral: true });

        } else {
            const categorizedItems = { Common: [], Rare: [], Epic: [], Legendary: [], Mythical: [], '???': [] };

            Object.keys(userShop).forEach(itemName => {
                const item = userShop[itemName];
                if (item.stock !== 0) {
                    const stockText = formatStockText(item.stock, item.message);
                    const priceLabel = {
                        SALE: '🔥 SALE',
                        SURGE: '📈 Surge',
                        NORMAL: ''
                    }[item.priceTag];

                    categorizedItems[item.rarity].push(
                        `\`${itemName}\` — **${formatNumber(item.cost)} ${item.currency}** (${stockText}${priceLabel ? ` • ${priceLabel}` : ''})`
                    );
                }
            });

            const timeUntilNextReset = getUserShopTimeLeft(userId);

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
                const itemsList = categorizedItems[rarity].length > 0 ? categorizedItems[rarity].join('\n') : '-No items available here-';
                shopEmbed.addFields({ name: `${rarityIcons[rarity]} ${rarity} Items`, value: itemsList, inline: false });
            }

            message.reply({ embeds: [shopEmbed], ephemeral: true });
        }
    }
}