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
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig"); //ignore this, will add later
module.exports = async (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot || (message.content !== '.use' && !message.content.startsWith('.use ') && message.content !== '.u' && !message.content.startsWith('.u '))) return;

        if (maintenance === "yes" && message.author.id !== developerID) {
            console.log(`[${new Date().toISOString()}] The bot is in maintenance mode.`);

            const { EmbedBuilder } = require("discord.js");
            const embed = new EmbedBuilder()
                .setColor("#FF0000")
                .setTitle("🚧 Maintenance Mode")
                .setDescription("The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden")
                .setFooter({ text: "Thank you for your patience" })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const args = message.content.split(/ +/);
        let quantity = 1;
        let itemNameParts = args.slice(1);
        const lastArg = itemNameParts[itemNameParts.length - 1];
        if (!isNaN(lastArg) && Number.isInteger(Number(lastArg))) {
            quantity = parseInt(lastArg);
            itemNameParts.pop();
        }

        if (quantity <= 0) {
            return message.reply("❌ Quantity must be a positive number.");
        }

        const itemName = itemNameParts.join(" ").trim();

        if (!itemName) {
            return message.reply("❌ Please specify an item name to use. Example: `.use CoinPotion-Tier1(R)`");
        }

        // List of items that cannot be used
        const unusableItems = [
            // Common Item
            'UniqueRock(C)',
            'Books(C)',
            'Wool(C)',
            'Wood(C)',

            // Rare Item
            'FragmentOf1800s(R)',

            // Epic Item
            'EnhancedScroll(E)',
            'RustedCore(E)',

            // Legendary Item
            'RedShard(L)',
            'BlueShard(L)',
            'YellowShard(L)',
            'WhiteShard(L)',
            'DarkShard(L)',

            // Mythic Item
            'ChromaShard(M)',
            'MonoShard(M)',
            'EquinoxAlloy(M)',
            'StarShard(M)',

            // ??? Item
            'Undefined(?)',
            'Null?(?)',
        ];

        // Allow only 'WeirdGrass(R)' and 'GoldenSigil(?)'
        if (unusableItems.includes(itemName)) {
            return message.reply(`❌ The item **${itemName}** cannot be used.`);
        }

        db.get(`SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`, [message.author.id, itemName], (err, row) => {
            if (err) return console.error(err);

            if (!row || row.quantity < quantity) {
                return message.reply(`❌ You don't have enough **${itemName}**. You need **${quantity}**, but only have **${row ? row.quantity : 0}**.`);
            }

            // Decrease quantity by 1
            db.run(`UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`, [quantity, message.author.id, itemName], (err) => {
                if (err) return console.error(err);

                // Coin Potion Boost - Tier 1
                if (itemName === "CoinPotionT1(R)") {
                    const source = 'CoinPotionT1';
                    const multiplier = 1.25;
                    const baseDuration = 60 * 60 * 1000; // 1 hour
                    const duration = baseDuration * quantity;

                    db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = ?`, [message.author.id, source], (err, row) => {
                        if (err) return console.error(err);

                        const newExpiresAt = (row && row.expiresAt > Date.now())
                        ? row.expiresAt + duration
                        : Date.now() + duration; 

                        db.run(`
                            INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                            VALUES (?, 'coin', ?, ?, ?)
                            ON CONFLICT(userId, type, source) DO UPDATE SET
                                multiplier = excluded.multiplier,
                                expiresAt = excluded.expiresAt
                        `, [message.author.id, source, multiplier, newExpiresAt]);
                        const embed = {
                            color: 0xFFD700,
                            title: "💰 Coin Boost Activated!",
                            description: `You used **CoinPotionT1(R)** x${quantity}!\n\n> 🔹 **+25% Coin Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`,
                            footer: { text: `Boost Source: ${source}` },
                            timestamp: new Date()
                        };
                        message.reply({ embeds: [embed] });
                    });
                }

                // Coin Potion Boost - Tier 2
                if (itemName === "CoinPotionT2(R)") {
                    const source = 'CoinPotionT2';
                    const multiplier = 1.5;
                    const baseDuration = 60 * 60 * 1000;
                    const duration = baseDuration * quantity;

                    db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = ?`, [message.author.id, source], (err, row) => {
                        if (err) return console.error(err);

                        const newExpiresAt = (row && row.expiresAt > Date.now())
                        ? row.expiresAt + duration
                        : Date.now() + duration; 

                        db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                VALUES (?, 'coin', ?, ?, ?)
                                ON CONFLICT(userId, type, source) DO UPDATE SET
                                    multiplier = excluded.multiplier,
                                    expiresAt = excluded.expiresAt
                                `, [message.author.id, source, multiplier, newExpiresAt]);
                        const embed = {
                            color: 0xFFD700,
                            title: "💰 Coin Boost Activated!",
                            description: `You used **CoinPotionT2(R)** x${quantity}!\n\n> 🔹 **+50% Coin Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`, // ✅ UPDATED: Show quantity and duration
                            footer: { text: `Boost Source: ${source}` },
                            timestamp: new Date()
                        };
                        message.reply({ embeds: [embed] });
                    });
                }

                // Coin Potion Boost - Tier 3
                if (itemName === "CoinPotionT3(R)") {
                    const source = 'CoinPotionT3';
                    const multiplier = 1.75;
                    const baseDuration = 60 * 60 * 1000;
                    const duration = baseDuration * quantity;

                    db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = ?`, [message.author.id, source], (err, row) => {
                        if (err) return console.error(err);

                        const newExpiresAt = (row && row.expiresAt > Date.now())
                        ? row.expiresAt + duration
                        : Date.now() + duration; 

                        db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                VALUES (?, 'coin', ?, ?, ?)
                                ON CONFLICT(userId, type, source) DO UPDATE SET
                                    multiplier = excluded.multiplier,
                                    expiresAt = excluded.expiresAt
                                `, [message.author.id, source, multiplier, newExpiresAt]);
                        const embed = {
                            color: 0xFFD700,
                            title: "💰 Coin Boost Activated!",
                            description: `You used **GemPotionT3(R)** x${quantity}!\n\n> 🔹 **+75% Coin Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`,
                            footer: { text: `Boost Source: ${source}` },
                            timestamp: new Date()
                        };
                        message.reply({ embeds: [embed] });
                    });
                }

                // Coin Potion Boost - Tier 4
                if (itemName === "CoinPotionT4(L)") {
                    const source = 'CoinPotionT4';
                    const multiplier = 2;
                    const baseDuration = 60 * 60 * 1000; // 1 hour
                    const duration = baseDuration * quantity;

                    db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = ?`, [message.author.id, source], (err, row) => {
                        if (err) return console.error(err);

                        const newExpiresAt = (row && row.expiresAt > Date.now())
                        ? row.expiresAt + duration
                        : Date.now() + duration; 

                        db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                VALUES (?, 'coin', ?, ?, ?)
                                ON CONFLICT(userId, type, source) DO UPDATE SET
                                    multiplier = excluded.multiplier,
                                    expiresAt = excluded.expiresAt
                            `, [message.author.id, source, multiplier, newExpiresAt]);
                        const embed = {
                            color: 0xFFD700,
                            title: "💰 Coin Boost Activated!",
                            description: `You used **CoinPotionT4(L)** x${quantity}!\n\n> 🔹 **+100% Coin Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`, // ✅ UPDATED: Show quantity and duration
                            footer: { text: `Boost Source: ${source}` },
                            timestamp: new Date()
                        };
                        message.reply({ embeds: [embed] });
                    });
                }

                // Coin Potion Boost - Tier 5
                if (itemName === "CoinPotionT5(M)") {
                    const source = 'CoinPotionT5';
                    const multiplier = 2.5;
                    const baseDuration = 60 * 60 * 1000;
                    const duration = baseDuration * quantity;

                    db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = ?`, [message.author.id, source], (err, row) => {
                        if (err) return console.error(err);

                        const newExpiresAt = (row && row.expiresAt > Date.now())
                        ? row.expiresAt + duration
                        : Date.now() + duration; 

                        db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                VALUES (?, 'coin', ?, ?, ?)
                                ON CONFLICT(userId, type, source) DO UPDATE SET
                                multiplier = excluded.multiplier,
                                expiresAt = excluded.expiresAt
                            `, [message.author.id, source, multiplier, newExpiresAt]);
                        const embed = {
                            color: 0xFFD700,
                            title: "💰 Coin Boost Activated!",
                            description: `You used **CoinPotionT5(M)** x${quantity}!\n\n> 🔹 **+150% Coin Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`, // ✅ UPDATED: Show quantity and duration
                            footer: { text: `Boost Source: ${source}` },
                            timestamp: new Date()
                        };
                        message.reply({ embeds: [embed] });
                    });
                }

                // Gem Potion - Tier 1
                if (itemName === "GemPotionT1(R)") {
                    const source = 'GemPotionT1';
                    const multiplier = 1.1;
                    const baseDuration = 60 * 60 * 1000;
                    const duration = baseDuration * quantity;

                    db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = 'gem' AND source = ?`, [message.author.id, source], (err, row) => {
                        if (err) return console.error(err);

                        const newExpiresAt = (row && row.expiresAt > Date.now())
                        ? row.expiresAt + duration
                        : Date.now() + duration; 

                        db.run(`
                            INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                            VALUES (?, 'gem', ?, ?, ?)
                            ON CONFLICT(userId, type, source) DO UPDATE SET
                                multiplier = excluded.multiplier,
                                expiresAt = excluded.expiresAt
                        `, [message.author.id, source, multiplier, newExpiresAt]);
                        const embed = {
                            color: 0x00FFFF,
                            title: "💎 Gem Boost Activated!",
                            description: `You used **GemPotionT1(R)** x${quantity}!\n\n> 🔹 **+10% Gem Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`,
                            footer: { text: `Boost Source: ${source}` },
                            timestamp: new Date()
                        };
                        message.reply({ embeds: [embed] });
                    });
                }

                // Gem Potion - Tier 2
                if (itemName === "GemPotionT2(R)") {
                    const source = 'GemPotionT2';
                    const multiplier = 1.2;
                    const baseDuration = 60 * 60 * 1000;
                    const duration = baseDuration * quantity;

                    db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = 'gem' AND source = ?`, [message.author.id, source], (err, row) => {
                        if (err) return console.error(err);

                        const newExpiresAt = (row && row.expiresAt > Date.now())
                        ? row.expiresAt + duration
                        : Date.now() + duration; 

                        db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                VALUES (?, 'gem', ?, ?, ?)
                                ON CONFLICT(userId, type, source) DO UPDATE SET
                                    multiplier = excluded.multiplier,
                                    expiresAt = excluded.expiresAt
                            `, [message.author.id, source, multiplier, newExpiresAt]);
                        const embed = {
                            color: 0x00FFFF,
                            title: "💎 Gem Boost Activated!",
                            description: `You used **GemPotionT2(R)** x${quantity}!\n\n> 🔹 **+20% Gem Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`, // ✅ UPDATED: Show quantity and duration
                            footer: { text: `Boost Source: ${source}` },
                            timestamp: new Date()
                        };
                        message.reply({ embeds: [embed] });
                    });
                }

                // Gem Potion - Tier 3
                if (itemName === "GemPotionT3(R)") {
                    const source = 'GemPotionT3';
                    const multiplier = 1.45;
                    const baseDuration = 60 * 60 * 1000;
                    const duration = baseDuration * quantity;

                    db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = 'gem' AND source = ?`, [message.author.id, source], (err, row) => {
                        if (err) return console.error(err);

                        const newExpiresAt = (row && row.expiresAt > Date.now())
                        ? row.expiresAt + duration
                        : Date.now() + duration;

                        db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                VALUES (?, 'gem', ?, ?, ?)
                                ON CONFLICT(userId, type, source) DO UPDATE SET
                                    multiplier = excluded.multiplier,
                                    expiresAt = excluded.expiresAt
                            `, [message.author.id, source, multiplier, newExpiresAt]);
                        const embed = {
                            color: 0x00FFFF,
                            title: "💎 Gem Boost Activated!",
                            description: `You used **GemPotionT3(R)** x${quantity}!\n\n> 🔹 **+45% Gem Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`, // ✅ UPDATED: Show quantity and duration
                            footer: { text: `Boost Source: ${source}` },
                            timestamp: new Date()
                        };
                        message.reply({ embeds: [embed] });
                    });
                }

                // Gem Potion - Tier 4
                if (itemName === "GemPotionT4(L)") {
                    const source = 'GemPotionT4';
                    const multiplier = 1.9;
                    const baseDuration = 60 * 60 * 1000; // 1 hour
                    const duration = baseDuration * quantity;

                    db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = 'gem' AND source = ?`, [message.author.id, source], (err, row) => {
                        if (err) return console.error(err);

                        const newExpiresAt = (row && row.expiresAt > Date.now())
                        ? row.expiresAt + duration
                        : Date.now() + duration; 

                        db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                VALUES (?, 'gem', ?, ?, ?)
                                ON CONFLICT(userId, type, source) DO UPDATE SET
                                    multiplier = excluded.multiplier,
                                    expiresAt = excluded.expiresAt
                            `, [message.author.id, source, multiplier, newExpiresAt]);
                        const embed = {
                            color: 0x00FFFF,
                            title: "💎 Gem Boost Activated!",
                            description: `You used **GemPotionT4(L)** x${quantity}!\n\n> 🔹 **+90% Gem Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`,
                            footer: { text: `Boost Source: ${source}` },
                            timestamp: new Date()
                        };
                        message.reply({ embeds: [embed] });
                    });
                }

                // Gem Potion - Tier 5
                if (itemName === "GemPotionT5(M)") {
                    const source = 'GemPotionT5';
                    const multiplier = 2.25;
                    const baseDuration = 60 * 60 * 1000; // 1 hour
                    const duration = baseDuration * quantity; // UPDATED: Duration scales with quantity

                    db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = 'gem' AND source = ?`, [message.author.id, source], (err, row) => {
                        if (err) return console.error(err);

                        const newExpiresAt = (row && row.expiresAt > Date.now())
                        ? row.expiresAt + duration
                        : Date.now() + duration; 

                        db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                VALUES (?, 'gem', ?, ?, ?)
                                ON CONFLICT(userId, type, source) DO UPDATE SET
                                    multiplier = excluded.multiplier,
                                    expiresAt = excluded.expiresAt
                            `, [message.author.id, source, multiplier, newExpiresAt]);
                        const embed = {
                            color: 0x00FFFF,
                            title: "💎 Gem Boost Activated!",
                            description: `You used **GemPotionT5(M)** x${quantity}!\n\n> 🔹 **+125% Gem Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`, // ✅ UPDATED: Show quantity and duration
                            footer: { text: `Boost Source: ${source}` },
                            timestamp: new Date()
                        };
                        message.reply({ embeds: [embed] });
                    });
                }

                // Boost Potion (coin & gem) - Tier 1
                if (itemName === "BoostPotionT1(L)") {
                    const source = 'BoostPotionT1';
                    const multiplier = 1.25;
                    const baseDuration = 30 * 60 * 1000;
                    const duration = baseDuration * quantity;
                    let completed = 0;

                    ['coin', 'gem'].forEach(type => {
                        db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`, [message.author.id, type, source], (err, row) => {
                            if (err) return console.error(err);

                            const newExpiresAt = (row && row.expiresAt > Date.now()) 
                            ? row.expiresAt + duration
                            : Date.now() + duration;

                            db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                VALUES (?, ?, ?, ?, ?)
                                ON CONFLICT(userId, type, source) DO UPDATE SET
                                    multiplier = excluded.multiplier,
                                    expiresAt = excluded.expiresAt
                            `, [message.author.id, type, source, multiplier, newExpiresAt], () => {
                                completed++;
                                if (completed === 2) {
                                    const embed = {
                                        color: 0x9932CC,
                                        title: "🧪 Magic Boost Activated!",
                                        description: `You used **BoostPotionT1(L)** x${quantity}!\n\n> 🔹 **+25% Coin & Gem Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`, // ✅ UPDATED: Quantity and duration reflected
                                        footer: { text: `Boost Source: ${source}` },
                                        timestamp: new Date()
                                    };
                                    message.reply({ embeds: [embed] });
                                }
                            });
                        });
                    });
                }

                // Magic Potion (coin & gem) - Tier 2
                if (itemName === "BoostPotionT2(L)") {
                    const source = 'BoostPotionT2';
                    const multiplier = 1.5;
                    const baseDuration = 30 * 60 * 1000;
                    const duration = baseDuration * quantity;
                    let completed = 0;

                    ['coin', 'gem'].forEach(type => {
                        db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`, [message.author.id, type, source], (err, row) => {
                            if (err) return console.error(err);

                            const newExpiresAt = (row && row.expiresAt > Date.now()) 
                            ? row.expiresAt + duration
                            : Date.now() + duration;

                            db.run(`
                                    INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                    VALUES (?, ?, ?, ?, ?)
                                    ON CONFLICT(userId, type, source) DO UPDATE SET
                                        multiplier = excluded.multiplier,
                                        expiresAt = excluded.expiresAt
                                `, [message.author.id, type, source, multiplier, newExpiresAt], () => {
                                completed++;
                                if (completed === 2) {
                                    const embed = {
                                        color: 0x9932CC,
                                        title: "🧪 Magic Boost Activated!",
                                        description: `You used **BoostPotionT2(L)** x${quantity}!\n\n> 🔹 **+50% Coin & Gem Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`, // ✅ UPDATED: Quantity and duration reflected
                                        footer: { text: `Boost Source: ${source}` },
                                        timestamp: new Date()
                                    };
                                    message.reply({ embeds: [embed] });
                                }
                            });
                        });
                    });
                }

                // Magic Potion (coin & gem) - Tier 3
                if (itemName === "BoostPotionT3(L)") {
                    const source = 'BoostPotionT3';
                    const multiplier = 2;
                    const baseDuration = 30 * 60 * 1000;
                    const duration = baseDuration * quantity;
                    let completed = 0;

                    ['coin', 'gem'].forEach(type => {
                        db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`, [message.author.id, type, source], (err, row) => {
                            if (err) return console.error(err);

                            const newExpiresAt = (row && row.expiresAt > Date.now()) 
                            ? row.expiresAt + duration
                            : Date.now() + duration;

                            db.run(`
                                    INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                    VALUES (?, ?, ?, ?, ?)
                                    ON CONFLICT(userId, type, source) DO UPDATE SET
                                    multiplier = excluded.multiplier,
                                    expiresAt = excluded.expiresAt
                                `, [message.author.id, type, source, multiplier, newExpiresAt], () => {
                                completed++;
                                if (completed === 2) {
                                    const embed = {
                                        color: 0x9932CC,
                                        title: "🧪 Magic Boost Activated!",
                                        description: `You used **BoostPotionT3(L)** x${quantity}!\n\n> 🔹 **+100% Coin & Gem Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`, // ✅ UPDATED: Quantity and duration reflected
                                        footer: { text: `Boost Source: ${source}` },
                                        timestamp: new Date()
                                    };
                                    message.reply({ embeds: [embed] });
                                }
                            });
                        });
                    });
                }

                // Magic Potion (coin & gem) - Tier 4
                if (itemName === "BoostPotionT4(M)") {
                    const source = 'BoostPotionT4';
                    const multiplier = 2.5;
                    const baseDuration = 30 * 60 * 1000; // 30 mins
                    const duration = baseDuration * quantity;
                    let completed = 0;

                    ['coin', 'gem'].forEach(type => {
                        db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`, [message.author.id, type, source], (err, row) => {
                            if (err) return console.error(err);

                            const newExpiresAt = (row && row.expiresAt > Date.now()) 
                            ? row.expiresAt + duration
                            : Date.now() + duration;

                            db.run(`
                                    INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                    VALUES (?, ?, ?, ?, ?)
                                    ON CONFLICT(userId, type, source) DO UPDATE SET
                                        multiplier = excluded.multiplier,
                                        expiresAt = excluded.expiresAt
                                `, [message.author.id, type, source, multiplier, newExpiresAt], () => {
                                completed++;
                                if (completed === 2) {
                                    const embed = {
                                        color: 0x9932CC,
                                        title: "🧪 Magic Boost Activated!",
                                        description: `You used **BoostPotionT4(M)** x${quantity}!\n\n> 🔹 **+150% Coin & Gem Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`, // ✅ UPDATED: Quantity and duration reflected
                                        footer: { text: `Boost Source: ${source}` },
                                        timestamp: new Date()
                                    };
                                    message.reply({ embeds: [embed] });
                                }
                            });
                        });
                    });
                }

                // Magic Potion (coin & gem) - Tier 5
                if (itemName === "BoostPotionT5(M)") {
                    const source = 'BoostPotionT5';
                    const multiplier = 3;
                    const baseDuration = 60 * 60 * 1000;
                    const duration = baseDuration * quantity;
                    let completed = 0;

                    ['coin', 'gem'].forEach(type => {
                        db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`, [message.author.id, type, source], (err, row) => {
                            if (err) return console.error(err);

                            const newExpiresAt = (row && row.expiresAt > Date.now()) 
                            ? row.expiresAt + duration
                            : Date.now() + duration;

                            db.run(`
                                    INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                    VALUES (?, ?, ?, ?, ?)
                                    ON CONFLICT(userId, type, source) DO UPDATE SET
                                    multiplier = excluded.multiplier,
                                    expiresAt = excluded.expiresAt
                                `, [message.author.id, type, source, multiplier, newExpiresAt], () => {
                                completed++;
                                if (completed === 2) {
                                    const embed = {
                                        color: 0x9932CC,
                                        title: "🧪 Magic Boost Activated!",
                                        description: `You used **BoostPotionT5(M)** x${quantity}!\n\n> 🔹 **+300% Coin & Gem Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`,
                                        footer: { text: `Boost Source: ${source}` },
                                        timestamp: new Date()
                                    };
                                    message.reply({ embeds: [embed] });
                                }
                            });
                        });
                    });
                }

                // WeirdGrass(R)
                if (itemName === "WeirdGrass(R)") {
                    if (quantity > 1) {
                        return message.reply("❌ **WeirdGrass(R)** is a one-time use item. You can only use 1 at a time.");
                    }
                    const outcomes = [
                        {
                            type: 'coin',
                            multiplier: 1.5, // +50%
                            duration: 15 * 60 * 1000,
                            desc: "+50% coins for 15 mins",
                            color: 0xFFD700,
                            emoji: "💰"
                        },
                        {
                            type: 'gem',
                            multiplier: 1.5, // +50%
                            duration: 5 * 60 * 1000,
                            desc: "+50% gems for 5 mins",
                            color: 0x00FFFF,
                            emoji: "💎"
                        },
                        {
                            type: 'both',
                            multiplier: { coin: 0.25, gem: 0.5 }, // -75% coins, -50% gems
                            duration: 25 * 60 * 1000,
                            desc: "-75% coins, -50% gems for 25 mins",
                            color: 0xFF6347,
                            emoji: "☠️"
                        }
                    ];

                    const choice = outcomes[Math.floor(Math.random() * outcomes.length)];

                    if (choice.type === 'both') {
                        const types = ['coin', 'gem'];
                        types.forEach(type => {
                            const mult = choice.multiplier[type];
                            const source = 'WeirdGrass-Negative';
                            const expiresAt = Date.now() + choice.duration;

                            db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                VALUES (?, ?, ?, ?, ?)
                                ON CONFLICT(userId, type, source) DO UPDATE SET
                                    multiplier = excluded.multiplier,
                                    expiresAt = excluded.expiresAt
                            `, [message.author.id, type, source, mult, expiresAt]);
                        });
                    } else {
                        const source = 'WeirdGrass-Boost';
                        const expiresAt = Date.now() + choice.duration;

                        db.run(`
                            INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                            VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT(userId, type, source) DO UPDATE SET
                                multiplier = excluded.multiplier,
                                expiresAt = excluded.expiresAt
                        `, [message.author.id, choice.type, source, choice.multiplier, expiresAt]);
                    }

                    const embed = {
                        color: choice.color,
                        title: `🌿 You used WeirdGrass(R)!`,
                        description: `${choice.emoji} **Effect:** ${choice.desc}`,
                        footer: { text: "Weird grass has unpredictable powers..." },
                        timestamp: new Date()
                    };

                    return message.reply({ embeds: [embed] });
                }

                // GoldenSigil(?)
                if (itemName === "GoldenSigil(?)") {
                    if (quantity > 1) {
                        return message.reply("❌ **GoldenSigil(?)** is a one-time use item. You can only use 1 at a time.");
                    }
                    const source = 'GoldenSigil';
                    const baseMultiplier = 100; // x100 multiplier per stack (10,000%)

                    db.get(`SELECT stack FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = ?`, [message.author.id, source], (err, row) => {
                        if (err) return console.error(err);

                        const currentStacks = row?.stack || 0;

                        if (currentStacks >= 10) {
                            const embed = {
                                color: 0xFF4500,
                                title: "⚠️ Max Stack Reached!",
                                description: `You already have **10/10** GoldenSigil boosts.\n> 💸 That's a **+1,000,000% coin boost**!`,
                                timestamp: new Date()
                            };
                            return message.reply({ embeds: [embed] });
                        }

                        const newStack = currentStacks + 1;
                        const newMultiplier = baseMultiplier * newStack; // 100 * stack

                        if (row) {
                            db.run(`
                                UPDATE activeBoosts
                                SET stack = ?, multiplier = ?
                                WHERE userId = ? AND type = 'coin' AND source = ?
                            `, [newStack, newMultiplier, message.author.id, source], () => {
                                const embed = {
                                    color: 0xFFD700,
                                    title: "✨ Golden Sigil Stacked!",
                                    description: `You used **GoldenSigil(?)**!\n\n🔹 **Stack:** ${newStack}/10\n💰 **Coin Boost:** +${newMultiplier * 100}%`,
                                    footer: { text: "Stacks reset when the effect is cleared." },
                                    timestamp: new Date()
                                };
                                message.reply({ embeds: [embed] });
                            });
                        } else {
                            db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack)
                                VALUES (?, ?, ?, ?, NULL, ?)
                            `, [message.author.id, 'coin', source, baseMultiplier, 1], () => {
                                const embed = {
                                    color: 0xFFD700,
                                    title: "✨ Golden Sigil Activated!",
                                    description: `You used **GoldenSigil(?)**!\n\n🔹 **Stack:** 1/10\n💰 **Coin Boost:** +${baseMultiplier * 100}%`,
                                    footer: { text: "Stacks reset when the effect is cleared." },
                                    timestamp: new Date()
                                };
                                message.reply({ embeds: [embed] });
                            });
                        }
                    });
                }

                // HakureiTicket(L)
                if (itemName === "HakureiTicket(L)") {
                    if (quantity > 1) {
                        return message.reply("❌ **HakureiTicket(L)** is a one-time use item. You can only use 1 at a time.");
                    }
                    db.get(`SELECT reimuUsageCount FROM userCoins WHERE userId = ?`, [message.author.id], (err, row) => {
                        if (err) {
                            console.error("Error fetching usage count:", err.message);
                            return;
                        }

                        if (row.reimuUsageCount <= 0) {
                            const embed = new EmbedBuilder()
                                .setTitle("🌀 Ticket Not Needed")
                                .setDescription("You're still within your prayer limit. No need to use a HakureiTicket(L) right now.")
                                .setColor(0x3498db); // blue

                            message.reply({ embeds: [embed] });
                            return;
                        }

                        // Reset the prayer usage
                        db.run(`UPDATE userCoins SET reimuUsageCount = 0, reimuLastReset = ? WHERE userId = ?`, [Date.now(), message.author.id], (err) => {
                            if (err) {
                                console.error("Error resetting prayer cooldown:", err.message);
                                return;
                            }

                            // Remove one ticket from inventory
                            db.run(`UPDATE userInventory SET quantity = quantity - 1 WHERE userId = ? AND itemName = ?`, [message.author.id, "HakureiTicket(L)"], function (err) {
                                if (err) {
                                    console.error("Error removing ticket from inventory:", err.message);
                                    return;
                                }

                                // Optionally delete item if quantity hits zero
                                db.run(`DELETE FROM userInventory WHERE userId = ? AND itemName = ? AND quantity <= 0`, [message.author.id, "HakureiTicket(L)"]);

                                const embed = new EmbedBuilder()
                                    .setTitle("✨ Ticket Used")
                                    .setDescription("Your **Reimu prayer limit** has been reset using a HakureiTicket(L)!")
                                    .setColor(0x9b59b6); // purple

                                message.reply({ embeds: [embed] });
                            });
                        });
                    });
                }

                // Lumina(M)
                if (itemName === "Lumina(M)") {
                    if (quantity > 1) {
                        return message.reply("❌ **Lumina(M)** is a one-time use item. You can only use 1 at a time.");
                    }

                    const source = 'Lumina';
                    const multiplier = 5.0;

                    db.get(`SELECT * FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10' AND source = ?`, [message.author.id, source], (err, row) => {
                        if (err) return console.error(err);

                        if (row) {
                            const embed = {
                                color: 0x00FFFF,
                                title: "🔮 Lumina(M) Already Active!",
                                description: `You already have the **Lumina(M)** boost active.\n> Every 10th roll = **x5 luck** forever!`,
                                timestamp: new Date()
                            };
                            return message.reply({ embeds: [embed] });
                        } else {
                            db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack)
                                VALUES (?, ?, ?, ?, NULL, NULL)
                            `, [message.author.id, 'luckEvery10', source, multiplier], () => {
                                const embed = {
                                    color: 0x00FFFF,
                                    title: "✨ Lumina(M) Activated!",
                                    description: `You used **Lumina(M)**!\n\n🔹 **Effect:** Every 10th roll = **5x luck** (permanent)`,
                                    footer: { text: "Enjoy your new luck boost!" },
                                    timestamp: new Date()
                                };
                                message.reply({ embeds: [embed] });
                            });
                        }
                    });
                }

                // FantasyBook(M)
                if (itemName === "FantasyBook(M)") {
                    if (quantity > 1) {
                        return message.reply("❌ **FantasyBook(M)** is a one-time use item. You can only use 1 at a time.");
                    }

                    const userId = message.author.id;

                    if (!row || row.quantity <= 0) {
                        return message.reply("❌ You don't have a **FantasyBook(M)** to use!");
                    }

                    // Check if already used
                    db.get(`SELECT hasFantasyBook FROM userCoins WHERE userId = ?`, [userId], (err, userRow) => {
                        if (err) return console.error(err);

                        if (userRow?.hasFantasyBook) {
                            return message.reply({
                                embeds: [{
                                    color: 0x9370DB,
                                    title: "📖 FantasyBook(M) Already Used!",
                                    description: "You've already unlocked **ASTRAL+** and non-Touhou rarities.\n> The Fantasy power is eternal.",
                                    timestamp: new Date()
                                }]
                            });
                        }

                        // Ask for confirmation
                        message.reply({
                            embeds: [{
                                color: 0xFFD700,
                                title: "⚠️ Confirm Use of FantasyBook(M)",
                                description: "**Are you sure you want to use FantasyBook(M)?**\n\n> ⚠️ This will unlock drops from **non-Touhou** fumos (e.g., Lumina, Aya) and rarities like **OTHERWORLDLY** and **ASTRAL+**.\n\nOnce used, this cannot be undone.",
                                footer: { text: "Reply with 'yes' to confirm or 'no' to cancel." },
                                timestamp: new Date()
                            }]
                        }).then(() => {
                            const filter = m => m.author.id === userId && ['yes', 'no'].includes(m.content.toLowerCase());
                            message.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] })
                                .then(collected => {
                                    const response = collected.first().content.toLowerCase();
                                    if (response === 'no') {
                                        // Restore the item since it's not used
                                        db.run(`UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`, [userId, itemName], (err) => {
                                            if (err) return console.error(err);
                                            return message.reply("❌ FantasyBook(M) use cancelled.");
                                        });
                                        return;
                                    }

                                    // User confirmed
                                    db.run(`UPDATE userCoins SET hasFantasyBook = 1 WHERE userId = ?`, [userId], (err) => {
                                        if (err) return console.error(err);

                                        const embed = {
                                            color: 0x8A2BE2,
                                            title: "📖 FantasyBook(M) Activated!",
                                            description: "**You used FantasyBook(M)!**\n\n🔓 **Effects Unlocked:**\n- Non-Touhou Fumos (e.g., Lumina, Aya, etc.)\n- **OTHERWORLDLY** Rarity\n- **ASTRAL+** Rarities\n\nA whole new dimension of power is now accessible.",
                                            footer: { text: "You will now obtain even more rarer fumo..." },
                                            timestamp: new Date()
                                        };

                                        message.reply({ embeds: [embed] });
                                    });
                                })
                                .catch(() => {
                                    db.run(`UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`, [userId, itemName], (err) => {
                                        if (err) console.error(err);
                                        message.reply("⌛ FantasyBook(M) use timed out. Please try again.");
                                    });
                                });
                        });
                    });
                }

                // AncientRelic(E)
                if (itemName === "AncientRelic(E)") {
                    const source = 'AncientRelic';
                    const boosts = [
                        { type: 'luck', multiplier: 3.5 },   // 250% boost => 3.5x total (1 + 2.5)
                        { type: 'coin', multiplier: 4.5 },   // 350% boost => 4.5x total (1 + 3.5)
                        { type: 'gem', multiplier: 6.0 },     // 500% boost => 6.0x total (1 + 5.0)
                        { type: 'sellPenalty', multiplier: 0.4 } // 60% reduction => 0.4x
                    ];
                    const singleDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds 24 * 60 * 60 * 1000
                    const totalDuration = singleDuration * quantity;
                    let completed = 0;

                    boosts.forEach(({ type, multiplier }) => {
                        db.get(`SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`, [message.author.id, type, source], (err, row) => {
                            if (err) return console.error(err);

                            const newExpiresAt = (row && row.expiresAt > Date.now()) ? row.expiresAt + totalDuration : Date.now() + totalDuration;

                            db.run(`
                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                VALUES (?, ?, ?, ?, ?)
                                ON CONFLICT(userId, type, source) DO UPDATE SET
                                    multiplier = excluded.multiplier,
                                    expiresAt = excluded.expiresAt
                            `, [message.author.id, type, source, multiplier, newExpiresAt], () => {
                                completed++;
                                if (completed === boosts.length) {
                                    const embed = {
                                        color: 0xFFD700,
                                        title: "🔮 Ancient Power Unleashed!",
                                        description:
                                            `You used **AncientRelic(E)** x${quantity}!\n\n` +
                                            `> 🍀 **+250% Luck Boost**\n` +
                                            `> 💰 **+350% Coin Boost**\n` +
                                            `> 💎 **+500% Gem Boost**\n` +
                                            `⏳ Duration: **${24 * quantity} hour(s)**\n\n` +
                                            `📉 **-60% Sell Value Penalty** is now active!`,
                                        footer: { text: `Boost Source: ${source}` },
                                        timestamp: new Date()
                                    };
                                    message.reply({ embeds: [embed] });
                                }
                            });
                        });
                    });
                }

                // Nullified(?)
                if (itemName === "Nullified(?)") {
                    const source = 'Nullified';
                    const type = 'rarityOverride';
                    const multiplier = 1; // Placeholder, logic uses 'uses'

                    db.get(`
                        SELECT uses FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?
                    `, [message.author.id, type, source], (err, row) => {
                        if (err) {
                            console.error("DB Get Error (Nullified):", err);
                            return message.reply("❌ An error occurred while activating Nullified boost.");
                        }

                        const newUses = (row?.uses || 0) + quantity;

                        db.run(`
                            INSERT INTO activeBoosts (userId, type, source, multiplier, uses)
                            VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT(userId, type, source) DO UPDATE SET
                                uses = excluded.uses
                        `, [
                            message.author.id,
                            type,
                            source,
                            multiplier,
                            newUses
                        ], (err) => {
                            if (err) {
                                console.error("DB Run Error (Nullified):", err);
                                return message.reply("❌ Failed to apply Nullified boost.");
                            }

                            const embed = {
                                color: 0x9B59B6,
                                title: "🎲 Rarity Nullified!",
                                description:
                                    `You used **Nullified(?)** ${quantity} time(s)!\n\n` +
                                    `> All rarity chances will be **equal** for **${newUses} roll(s)** (applies to Coins/Gems banners).\n` +
                                    `🎯 Every rarity has an equal chance!`,
                                footer: { text: `Boost Source: ${source}` },
                                timestamp: new Date()
                            };

                            message.reply({ embeds: [embed] }).catch(console.error);
                        });
                    });
                }

            });
        });
    });
};
