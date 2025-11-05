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
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig"); //ignore this, will add later
const { isBanned } = require('../Banned/BanUtils');
module.exports = async (client) => {
    client.on("messageCreate", async (message) => {
        try {
            if (
                message.author.bot ||
                (message.content !== '.use' && !message.content.startsWith('.use ') &&
                    message.content !== '.u' && !message.content.startsWith('.u '))
            ) return;

            // Maintenance mode check
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

            // Parse command arguments
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
                return message.reply("❌ Please specify an item name to use. Example: `.use CoinPotionT1(R)`");
            }

            // List of items that cannot be used
            const unusableItems = new Set([
                // Common Item
                'UniqueRock(C)', 'Books(C)', 'Wool(C)', 'Wood(C)',
                // Rare Item
                'FragmentOf1800s(R)',
                // Epic Item
                'EnhancedScroll(E)', 'RustedCore(E)',
                // Legendary Item
                'RedShard(L)', 'BlueShard(L)', 'YellowShard(L)', 'WhiteShard(L)', 'DarkShard(L)',
                // Mythic Item
                'ChromaShard(M)', 'MonoShard(M)', 'EquinoxAlloy(M)', 'StarShard(M)',
                // ??? Item
                'Undefined(?)', 'Null?(?)',
            ]);
            if (unusableItems.has(itemName)) {
                return message.reply(`❌ The item **${itemName}** cannot be used.`);
            }

            // Fetch user inventory
            db.get(
                `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                [message.author.id, itemName],
                (err, row) => {
                    if (err) {
                        console.error(`[DB ERROR] Failed to fetch inventory for ${message.author.id}:`, err);
                        return message.reply("❌ An error occurred while accessing your inventory. Please try again later.");
                    }
                    if (!row || row.quantity < quantity) {
                        return message.reply(`❌ You don't have enough **${itemName}**. You need **${quantity}**, but only have **${row ? row.quantity : 0}**.`);
                    }

                    // Decrease quantity
                    db.run(
                        `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
                        [quantity, message.author.id, itemName],
                        (err) => {
                            if (err) {
                                console.error(`[DB ERROR] Failed to update inventory for ${message.author.id}:`, err);
                                return message.reply("❌ Failed to update your inventory. Please try again later.");
                            }

                            // --- Coin Potion Boost Handler ---
                            const coinPotions = {
                                "CoinPotionT1(R)": { source: "CoinPotionT1", multiplier: 1.25, boost: "+25%" },
                                "CoinPotionT2(R)": { source: "CoinPotionT2", multiplier: 1.5, boost: "+50%" },
                                "CoinPotionT3(R)": { source: "CoinPotionT3", multiplier: 1.75, boost: "+75%" },
                                "CoinPotionT4(L)": { source: "CoinPotionT4", multiplier: 2, boost: "+100%" },
                                "CoinPotionT5(M)": { source: "CoinPotionT5", multiplier: 2.5, boost: "+150%" }
                            };
                            if (coinPotions[itemName]) {
                                const { source, multiplier, boost } = coinPotions[itemName];
                                const baseDuration = 60 * 60 * 1000; // 1 hour
                                const duration = baseDuration * quantity;
                                db.get(
                                    `SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = ?`,
                                    [message.author.id, source],
                                    (err, boostRow) => {
                                        if (err) {
                                            console.error(`[DB ERROR] Failed to fetch boost for ${message.author.id}:`, err);
                                            return message.reply("❌ Failed to activate your boost. Please try again later.");
                                        }
                                        const now = Date.now();
                                        const newExpiresAt = (boostRow && boostRow.expiresAt > now)
                                            ? boostRow.expiresAt + duration
                                            : now + duration;

                                        db.run(
                                            `
                                            INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                            VALUES (?, 'coin', ?, ?, ?)
                                            ON CONFLICT(userId, type, source) DO UPDATE SET
                                                multiplier = excluded.multiplier,
                                                expiresAt = excluded.expiresAt
                                            `,
                                            [message.author.id, source, multiplier, newExpiresAt],
                                            (err) => {
                                                if (err) {
                                                    console.error(`[DB ERROR] Failed to update boost for ${message.author.id}:`, err);
                                                    return message.reply("❌ Failed to activate your boost. Please try again later.");
                                                }
                                                const embed = new EmbedBuilder()
                                                    .setColor(0xFFD700)
                                                    .setTitle("💰 Coin Boost Activated!")
                                                    .setDescription(
                                                        `You used **${itemName}** x${quantity}!\n\n> 🔹 **${boost} Coin Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`
                                                    )
                                                    .setFooter({ text: `Boost Source: ${source}` })
                                                    .setTimestamp();
                                                message.reply({ embeds: [embed] });
                                            }
                                        );
                                    }
                                );
                                return;
                            }

                            // --- Gem Potion Boost Handler (Refactored) ---
                            const gemPotions = {
                                "GemPotionT1(R)": { source: "GemPotionT1", multiplier: 1.1, boost: "+10%" },
                                "GemPotionT2(R)": { source: "GemPotionT2", multiplier: 1.2, boost: "+20%" },
                                "GemPotionT3(R)": { source: "GemPotionT3", multiplier: 1.45, boost: "+45%" },
                                "GemPotionT4(L)": { source: "GemPotionT4", multiplier: 1.9, boost: "+90%" },
                                "GemPotionT5(M)": { source: "GemPotionT5", multiplier: 2.25, boost: "+125%" }
                            };
                            if (gemPotions[itemName]) {
                                const { source, multiplier, boost } = gemPotions[itemName];
                                const baseDuration = 60 * 60 * 1000; // 1 hour
                                const duration = baseDuration * quantity;

                                db.get(
                                    `SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = 'gem' AND source = ?`,
                                    [message.author.id, source],
                                    (err, row) => {
                                        if (err) {
                                            console.error(`[DB ERROR] Failed to fetch gem boost for ${message.author.id}:`, err);
                                            return message.reply("❌ Failed to activate your gem boost. Please try again later.");
                                        }

                                        const now = Date.now();
                                        const newExpiresAt = (row && row.expiresAt > now)
                                            ? row.expiresAt + duration
                                            : now + duration;

                                        db.run(
                                            `
                                            INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                            VALUES (?, 'gem', ?, ?, ?)
                                            ON CONFLICT(userId, type, source) DO UPDATE SET
                                                multiplier = excluded.multiplier,
                                                expiresAt = excluded.expiresAt
                                            `,
                                            [message.author.id, source, multiplier, newExpiresAt],
                                            (err) => {
                                                if (err) {
                                                    console.error(`[DB ERROR] Failed to update gem boost for ${message.author.id}:`, err);
                                                    return message.reply("❌ Failed to activate your gem boost. Please try again later.");
                                                }
                                                const embed = new EmbedBuilder()
                                                    .setColor(0x00FFFF)
                                                    .setTitle("💎 Gem Boost Activated!")
                                                    .setDescription(
                                                        `You used **${itemName}** x${quantity}!\n\n> 🔹 **${boost} Gem Boost**\n> ⏳ Duration: **${quantity} hour${quantity > 1 ? 's' : ''}**`
                                                    )
                                                    .setFooter({ text: `Boost Source: ${source}` })
                                                    .setTimestamp();
                                                message.reply({ embeds: [embed] });
                                            }
                                        );
                                    }
                                );
                                return;
                            }

                            // --- Boost Potion (coin & gem) Handler (Refactored & Optimized) ---
                            const boostPotions = {
                                "BoostPotionT1(L)": { source: "BoostPotionT1", multiplier: 1.25, boost: "+25%", baseDuration: 30 * 60 * 1000 },
                                "BoostPotionT2(L)": { source: "BoostPotionT2", multiplier: 1.5, boost: "+50%", baseDuration: 30 * 60 * 1000 },
                                "BoostPotionT3(L)": { source: "BoostPotionT3", multiplier: 2, boost: "+100%", baseDuration: 30 * 60 * 1000 },
                                "BoostPotionT4(M)": { source: "BoostPotionT4", multiplier: 2.5, boost: "+150%", baseDuration: 30 * 60 * 1000 },
                                "BoostPotionT5(M)": { source: "BoostPotionT5", multiplier: 3, boost: "+300%", baseDuration: 60 * 60 * 1000 }
                            };
                            if (boostPotions[itemName]) {
                                const { source, multiplier, boost, baseDuration } = boostPotions[itemName];
                                const duration = baseDuration * quantity;
                                const types = ['coin', 'gem'];
                                let completed = 0;
                                let errors = [];
                                let expiresAtResults = {};

                                types.forEach(type => {
                                    db.get(
                                        `SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
                                        [message.author.id, type, source],
                                        (err, row) => {
                                            if (err) {
                                                errors.push(`[DB ERROR] Failed to fetch ${type} boost for ${message.author.id}: ${err.message}`);
                                                completed++;
                                                if (completed === types.length) handleBoostPotionReply();
                                                return;
                                            }

                                            const now = Date.now();
                                            const newExpiresAt = (row && row.expiresAt > now)
                                                ? row.expiresAt + duration
                                                : now + duration;

                                            db.run(
                                                `
                                                INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                                VALUES (?, ?, ?, ?, ?)
                                                ON CONFLICT(userId, type, source) DO UPDATE SET
                                                    multiplier = excluded.multiplier,
                                                    expiresAt = excluded.expiresAt
                                                `,
                                                [message.author.id, type, source, multiplier, newExpiresAt],
                                                (err) => {
                                                    if (err) {
                                                        errors.push(`[DB ERROR] Failed to update ${type} boost for ${message.author.id}: ${err.message}`);
                                                    } else {
                                                        expiresAtResults[type] = newExpiresAt;
                                                    }
                                                    completed++;
                                                    if (completed === types.length) handleBoostPotionReply();
                                                }
                                            );
                                        }
                                    );
                                });

                                function handleBoostPotionReply() {
                                    if (errors.length > 0) {
                                        errors.forEach(e => console.error(e));
                                        return message.reply("❌ Failed to activate your boost. Please try again later.");
                                    }
                                    const embed = new EmbedBuilder()
                                        .setColor(0x9932CC)
                                        .setTitle("🧪 Magic Boost Activated!")
                                        .setDescription(
                                            `You used **${itemName}** x${quantity}!\n\n> 🔹 **${boost} Coin & Gem Boost**\n> ⏳ Duration: **${Math.round(duration / (60 * 60 * 1000))} hour${quantity > 1 ? 's' : ''}**`
                                        )
                                        .setFooter({ text: `Boost Source: ${source}` })
                                        .setTimestamp();
                                    message.reply({ embeds: [embed] });
                                }
                                return;
                            }

                            // --- WeirdGrass(R) ---
                            if (itemName === "WeirdGrass(R)") {
                                if (quantity > 1) {
                                    return message.reply("❌ **WeirdGrass(R)** is a one-time use item. You can only use 1 at a time.");
                                }
                                const outcomes = [
                                    {
                                        type: 'coin',
                                        multiplier: 1.5,
                                        duration: 15 * 60 * 1000,
                                        desc: "+50% coins for 15 mins",
                                        color: 0xFFD700,
                                        emoji: "💰"
                                    },
                                    {
                                        type: 'gem',
                                        multiplier: 1.5,
                                        duration: 5 * 60 * 1000,
                                        desc: "+50% gems for 5 mins",
                                        color: 0x00FFFF,
                                        emoji: "💎"
                                    },
                                    {
                                        type: 'both',
                                        multiplier: { coin: 0.25, gem: 0.5 },
                                        duration: 25 * 60 * 1000,
                                        desc: "-75% coins, -50% gems for 25 mins",
                                        color: 0xFF6347,
                                        emoji: "☠️"
                                    }
                                ];
                                const choice = outcomes[Math.floor(Math.random() * outcomes.length)];
                                const now = Date.now();

                                if (choice.type === 'both') {
                                    const types = ['coin', 'gem'];
                                    let completed = 0, errors = [];
                                    types.forEach(type => {
                                        const mult = choice.multiplier[type];
                                        const source = 'WeirdGrass-Negative';
                                        const expiresAt = now + choice.duration;
                                        db.run(`
                                            INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                            VALUES (?, ?, ?, ?, ?)
                                            ON CONFLICT(userId, type, source) DO UPDATE SET
                                                multiplier = excluded.multiplier,
                                                expiresAt = excluded.expiresAt
                                        `, [message.author.id, type, source, mult, expiresAt], err => {
                                            if (err) errors.push(err);
                                            if (++completed === types.length) {
                                                if (errors.length) {
                                                    console.error("WeirdGrass(R) DB error:", errors);
                                                    return message.reply("❌ Failed to apply WeirdGrass effect.");
                                                }
                                                const embed = new EmbedBuilder()
                                                    .setColor(choice.color)
                                                    .setTitle("🌿 You used WeirdGrass(R)!")
                                                    .setDescription(`${choice.emoji} **Effect:** ${choice.desc}`)
                                                    .setFooter({ text: "Weird grass has unpredictable powers..." })
                                                    .setTimestamp();
                                                return message.reply({ embeds: [embed] });
                                            }
                                        });
                                    });
                                } else {
                                    const source = 'WeirdGrass-Boost';
                                    const expiresAt = now + choice.duration;
                                    db.run(`
                                        INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                        VALUES (?, ?, ?, ?, ?)
                                        ON CONFLICT(userId, type, source) DO UPDATE SET
                                            multiplier = excluded.multiplier,
                                            expiresAt = excluded.expiresAt
                                    `, [message.author.id, choice.type, source, choice.multiplier, expiresAt], err => {
                                        if (err) {
                                            console.error("WeirdGrass(R) DB error:", err);
                                            return message.reply("❌ Failed to apply WeirdGrass effect.");
                                        }
                                        const embed = new EmbedBuilder()
                                            .setColor(choice.color)
                                            .setTitle("🌿 You used WeirdGrass(R)!")
                                            .setDescription(`${choice.emoji} **Effect:** ${choice.desc}`)
                                            .setFooter({ text: "Weird grass has unpredictable powers..." })
                                            .setTimestamp();
                                        return message.reply({ embeds: [embed] });
                                    });
                                }
                                return;
                            }

                            // --- GoldenSigil(?) ---
                            if (itemName === "GoldenSigil(?)") {
                                if (quantity > 1) {
                                    return message.reply("❌ **GoldenSigil(?)** is a one-time use item. You can only use 1 at a time.");
                                }
                                const source = 'GoldenSigil';
                                const baseMultiplier = 100; // x100 per stack
                                db.get(
                                    `SELECT stack FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = ?`,
                                    [message.author.id, source],
                                    (err, row) => {
                                        if (err) {
                                            console.error("GoldenSigil DB error:", err);
                                            return message.reply("❌ Failed to apply GoldenSigil effect.");
                                        }
                                        const currentStacks = row?.stack || 0;
                                        if (currentStacks >= 10) {
                                            const embed = new EmbedBuilder()
                                                .setColor(0xFF4500)
                                                .setTitle("⚠️ Max Stack Reached!")
                                                .setDescription("You already have **10/10** GoldenSigil boosts.\n> 💸 That's a **+1,000,000% coin boost**!\n\nYour item was **not** consumed.")
                                                .setTimestamp();
                                            // Refund the item if it was removed
                                            db.run(
                                                `UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`,
                                                [message.author.id, itemName]
                                            );
                                            return message.reply({ embeds: [embed] });
                                        }
                                        const newStack = currentStacks + 1;
                                        const newMultiplier = baseMultiplier * newStack;
                                        if (row) {
                                            db.run(
                                                `UPDATE activeBoosts SET stack = ?, multiplier = ? WHERE userId = ? AND type = 'coin' AND source = ?`,
                                                [newStack, newMultiplier, message.author.id, source],
                                                err => {
                                                    if (err) {
                                                        console.error("GoldenSigil DB update error:", err);
                                                        return message.reply("❌ Failed to stack GoldenSigil.");
                                                    }
                                                    const embed = new EmbedBuilder()
                                                        .setColor(0xFFD700)
                                                        .setTitle("✨ Golden Sigil Stacked!")
                                                        .setDescription(`You used **GoldenSigil(?)**!\n\n🔹 **Stack:** ${newStack}/10\n💰 **Coin Boost:** +${newMultiplier * 100}%`)
                                                        .setFooter({ text: "Stacks reset when the effect is cleared." })
                                                        .setTimestamp();
                                                    message.reply({ embeds: [embed] });
                                                }
                                            );
                                        } else {
                                            db.run(
                                                `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack)
                                                 VALUES (?, ?, ?, ?, NULL, ?)`,
                                                [message.author.id, 'coin', source, baseMultiplier, 1],
                                                err => {
                                                    if (err) {
                                                        console.error("GoldenSigil DB insert error:", err);
                                                        return message.reply("❌ Failed to activate GoldenSigil.");
                                                    }
                                                    const embed = new EmbedBuilder()
                                                        .setColor(0xFFD700)
                                                        .setTitle("✨ Golden Sigil Activated!")
                                                        .setDescription(`You used **GoldenSigil(?)**!\n\n🔹 **Stack:** 1/10\n💰 **Coin Boost:** +${baseMultiplier * 100}%`)
                                                        .setFooter({ text: "Stacks reset when the effect is cleared." })
                                                        .setTimestamp();
                                                    message.reply({ embeds: [embed] });
                                                }
                                            );
                                        }
                                    }
                                );
                                return;
                            }

                            // --- HakureiTicket(L) ---
                            if (itemName === "HakureiTicket(L)") {
                                if (quantity > 1) {
                                    return message.reply("❌ **HakureiTicket(L)** is a one-time use item. You can only use 1 at a time.");
                                }
                                db.get(
                                    `SELECT reimuUsageCount FROM userCoins WHERE userId = ?`,
                                    [message.author.id],
                                    (err, row) => {
                                        if (err) {
                                            console.error("HakureiTicket DB error:", err);
                                            return message.reply("❌ Failed to check your prayer limit.");
                                        }
                                        if (!row || row.reimuUsageCount <= 0) {
                                            const embed = new EmbedBuilder()
                                                .setTitle("🌀 Ticket Not Needed")
                                                .setDescription("You're still within your prayer limit. No need to use a HakureiTicket(L) right now.")
                                                .setColor(0x3498db);
                                            return message.reply({ embeds: [embed] });
                                        }
                                        db.run(
                                            `UPDATE userCoins SET reimuUsageCount = 0, reimuLastReset = ? WHERE userId = ?`,
                                            [Date.now(), message.author.id],
                                            err => {
                                                if (err) {
                                                    console.error("HakureiTicket DB update error:", err);
                                                    return message.reply("❌ Failed to reset your prayer cooldown.");
                                                }
                                                db.run(
                                                    `UPDATE userInventory SET quantity = quantity - 1 WHERE userId = ? AND itemName = ?`,
                                                    [message.author.id, "HakureiTicket(L)"],
                                                    err => {
                                                        if (err) {
                                                            console.error("HakureiTicket inventory update error:", err);
                                                            return message.reply("❌ Failed to remove HakureiTicket from inventory.");
                                                        }
                                                        db.run(
                                                            `DELETE FROM userInventory WHERE userId = ? AND itemName = ? AND quantity <= 0`,
                                                            [message.author.id, "HakureiTicket(L)"]
                                                        );
                                                        const embed = new EmbedBuilder()
                                                            .setTitle("✨ Ticket Used")
                                                            .setDescription("Your **Reimu prayer limit** has been reset using a HakureiTicket(L)!")
                                                            .setColor(0x9b59b6);
                                                        message.reply({ embeds: [embed] });
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                                return;
                            }

                            // --- Lumina(M) ---
                            if (itemName === "Lumina(M)") {
                                if (quantity > 1) {
                                    return message.reply("❌ **Lumina(M)** is a one-time use item. You can only use 1 at a time.");
                                }
                                const source = 'Lumina';
                                const multiplier = 5.0;
                                db.get(
                                    `SELECT * FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10' AND source = ?`,
                                    [message.author.id, source],
                                    (err, row) => {
                                        if (err) {
                                            console.error("Lumina DB error:", err);
                                            return message.reply("❌ Failed to activate Lumina.");
                                        }
                                        if (row) {
                                            const embed = new EmbedBuilder()
                                                .setColor(0x00FFFF)
                                                .setTitle("🔮 Lumina(M) Already Active!")
                                                .setDescription("You already have the **Lumina(M)** boost active.\n> Every 10th roll = **x5 luck** forever!")
                                                .setTimestamp();
                                            return message.reply({ embeds: [embed] });
                                        }
                                        db.run(
                                            `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack)
                                             VALUES (?, ?, ?, ?, NULL, NULL)`,
                                            [message.author.id, 'luckEvery10', source, multiplier],
                                            err => {
                                                if (err) {
                                                    console.error("Lumina DB insert error:", err);
                                                    return message.reply("❌ Failed to activate Lumina.");
                                                }
                                                const embed = new EmbedBuilder()
                                                    .setColor(0x00FFFF)
                                                    .setTitle("✨ Lumina(M) Activated!")
                                                    .setDescription("You used **Lumina(M)**!\n\n🔹 **Effect:** Every 10th roll = **5x luck** (permanent)")
                                                    .setFooter({ text: "Enjoy your new luck boost!" })
                                                    .setTimestamp();
                                                message.reply({ embeds: [embed] });
                                            }
                                        );
                                    }
                                );
                                return;
                            }

                            // --- FantasyBook(M) ---
                            if (itemName === "FantasyBook(M)") {
                                if (quantity > 1) {
                                    return message.reply("❌ **FantasyBook(M)** is a one-time use item. You can only use 1 at a time.");
                                }
                                const userId = message.author.id;
                                if (!row || row.quantity <= 0) {
                                    return message.reply("❌ You don't have a **FantasyBook(M)** to use!");
                                }
                                db.get(
                                    `SELECT hasFantasyBook FROM userCoins WHERE userId = ?`,
                                    [userId],
                                    (err, userRow) => {
                                        if (err) {
                                            console.error("FantasyBook DB error:", err);
                                            return message.reply("❌ Failed to check FantasyBook status.");
                                        }
                                        if (userRow?.hasFantasyBook) {
                                            const embed = new EmbedBuilder()
                                                .setColor(0x9370DB)
                                                .setTitle("📖 FantasyBook(M) Already Used!")
                                                .setDescription("You've already unlocked **ASTRAL+** and non-Touhou rarities.\n> The Fantasy power is eternal.")
                                                .setTimestamp();
                                            return message.reply({ embeds: [embed] });
                                        }
                                        message.reply({
                                            embeds: [
                                                new EmbedBuilder()
                                                    .setColor(0xFFD700)
                                                    .setTitle("⚠️ Confirm Use of FantasyBook(M)")
                                                    .setDescription("**Are you sure you want to use FantasyBook(M)?**\n\n> ⚠️ This will unlock drops from **non-Touhou** fumos (e.g., Lumina, Aya) and rarities like **OTHERWORLDLY** and **ASTRAL+**.\n\nOnce used, this cannot be undone.")
                                                    .setFooter({ text: "Reply with 'yes' to confirm or 'no' to cancel." })
                                                    .setTimestamp()
                                            ]
                                        }).then(() => {
                                            const filter = m => m.author.id === userId && ['yes', 'no'].includes(m.content.toLowerCase());
                                            message.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] })
                                                .then(collected => {
                                                    const response = collected.first().content.toLowerCase();
                                                    if (response === 'no') {
                                                        db.run(
                                                            `UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`,
                                                            [userId, itemName],
                                                            err => {
                                                                if (err) console.error("FantasyBook restore error:", err);
                                                                return message.reply("❌ FantasyBook(M) use cancelled.");
                                                            }
                                                        );
                                                        return;
                                                    }
                                                    db.run(
                                                        `UPDATE userCoins SET hasFantasyBook = 1 WHERE userId = ?`,
                                                        [userId],
                                                        err => {
                                                            if (err) {
                                                                console.error("FantasyBook DB update error:", err);
                                                                return message.reply("❌ Failed to activate FantasyBook.");
                                                            }
                                                            const embed = new EmbedBuilder()
                                                                .setColor(0x8A2BE2)
                                                                .setTitle("📖 FantasyBook(M) Activated!")
                                                                .setDescription("**You used FantasyBook(M)!**\n\n🔓 **Effects Unlocked:**\n- Non-Touhou Fumos (e.g., Lumina, Aya, etc.)\n- **OTHERWORLDLY** Rarity\n- **ASTRAL+** Rarities\n\nA whole new dimension of power is now accessible.")
                                                                .setFooter({ text: "You will now obtain even more rarer fumo..." })
                                                                .setTimestamp();
                                                            message.reply({ embeds: [embed] });
                                                        }
                                                    );
                                                })
                                                .catch(() => {
                                                    db.run(
                                                        `UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`,
                                                        [userId, itemName],
                                                        err => {
                                                            if (err) console.error("FantasyBook timeout restore error:", err);
                                                            message.reply("⌛ FantasyBook(M) use timed out. Please try again.");
                                                        }
                                                    );
                                                });
                                        });
                                    }
                                );
                                return;
                            }

                            // --- AncientRelic(E) ---
                            if (itemName === "AncientRelic(E)") {
                                const source = 'AncientRelic';
                                const boosts = [
                                    { type: 'luck', multiplier: 3.5 },
                                    { type: 'coin', multiplier: 4.5 },
                                    { type: 'gem', multiplier: 6.0 },
                                    { type: 'sellPenalty', multiplier: 0.4 }
                                ];
                                const singleDuration = 24 * 60 * 60 * 1000;
                                const totalDuration = singleDuration * quantity;
                                let completed = 0, errors = [];
                                boosts.forEach(({ type, multiplier }) => {
                                    db.get(
                                        `SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
                                        [message.author.id, type, source],
                                        (err, row) => {
                                            if (err) {
                                                errors.push(err);
                                                if (++completed === boosts.length) handleAncientRelicReply();
                                                return;
                                            }
                                            const now = Date.now();
                                            const newExpiresAt = (row && row.expiresAt > now) ? row.expiresAt + totalDuration : now + totalDuration;
                                            db.run(
                                                `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                                 VALUES (?, ?, ?, ?, ?)
                                                 ON CONFLICT(userId, type, source) DO UPDATE SET
                                                    multiplier = excluded.multiplier,
                                                    expiresAt = excluded.expiresAt`,
                                                [message.author.id, type, source, multiplier, newExpiresAt],
                                                err => {
                                                    if (err) errors.push(err);
                                                    if (++completed === boosts.length) handleAncientRelicReply();
                                                }
                                            );
                                        }
                                    );
                                });
                                function handleAncientRelicReply() {
                                    if (errors.length) {
                                        console.error("AncientRelic(E) DB error:", errors);
                                        return message.reply("❌ Failed to activate AncientRelic boost.");
                                    }
                                    const embed = new EmbedBuilder()
                                        .setColor(0xFFD700)
                                        .setTitle("🔮 Ancient Power Unleashed!")
                                        .setDescription(
                                            `You used **AncientRelic(E)** x${quantity}!\n\n` +
                                            `> 🍀 **+250% Luck Boost**\n` +
                                            `> 💰 **+350% Coin Boost**\n` +
                                            `> 💎 **+500% Gem Boost**\n` +
                                            `⏳ Duration: **${24 * quantity} hour(s)**\n\n` +
                                            `📉 **-60% Sell Value Penalty** is now active!`
                                        )
                                        .setFooter({ text: `Boost Source: ${source}` })
                                        .setTimestamp();
                                    message.reply({ embeds: [embed] });
                                }
                                return;
                            }

                            // --- Nullified(?) ---
                            if (itemName === "Nullified(?)") {
                                const source = 'Nullified';
                                const type = 'rarityOverride';
                                const multiplier = 1;
                                db.get(
                                    `SELECT uses FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
                                    [message.author.id, type, source],
                                    (err, row) => {
                                        if (err) {
                                            console.error("Nullified DB get error:", err);
                                            return message.reply("❌ An error occurred while activating Nullified boost.");
                                        }
                                        const newUses = (row?.uses || 0) + quantity;
                                        db.run(
                                            `INSERT INTO activeBoosts (userId, type, source, multiplier, uses)
                                             VALUES (?, ?, ?, ?, ?)
                                             ON CONFLICT(userId, type, source) DO UPDATE SET
                                                uses = excluded.uses`,
                                            [message.author.id, type, source, multiplier, newUses],
                                            err => {
                                                if (err) {
                                                    console.error("Nullified DB run error:", err);
                                                    return message.reply("❌ Failed to apply Nullified boost.");
                                                }
                                                const embed = new EmbedBuilder()
                                                    .setColor(0x9B59B6)
                                                    .setTitle("🎲 Rarity Nullified!")
                                                    .setDescription(
                                                        `You used **Nullified(?)** ${quantity} time(s)!\n\n` +
                                                        `> All rarity chances will be **equal** for **${newUses} roll(s)** (applies to Coins/Gems banners).\n` +
                                                        `🎯 Every rarity has an equal chance!`
                                                    )
                                                    .setFooter({ text: `Boost Source: ${source}` })
                                                    .setTimestamp();
                                                message.reply({ embeds: [embed] });
                                            }
                                        );
                                    }
                                );
                                return;
                            }

                            // --- MysteriousCube(M) ---
                            if (itemName === "MysteriousCube(M)") {
                                if (quantity > 1) {
                                    return message.reply("❌ **MysteriousCube(M)** is a one-time use item. You can only use 1 at a time.");
                                }
                                const source = 'MysteriousCube';

                                // Check if user already has an active MysteriousCube boost
                                db.get(
                                    `SELECT * FROM activeBoosts WHERE userId = ? AND source = ? AND (type = 'luck' OR type = 'coin' OR type = 'gem') AND expiresAt > ?`,
                                    [message.author.id, source, Date.now()],
                                    (err, row) => {
                                        if (err) {
                                            console.error("MysteriousCube(M) DB check error:", err);
                                            return message.reply("❌ Failed to check MysteriousCube status.");
                                        }
                                        if (row) {
                                            return message.reply("❌ You already have an active **MysteriousCube(M)** boost! Wait for it to expire before using another.");
                                        }

                                        function getRandomMultiplier() {
                                            // Random value between 0.01% and 500% → multiplier between 1.0001 and 6.0
                                            return parseFloat((1 + Math.random() * 5.999).toFixed(4));
                                        }

                                        const boosts = [
                                            { type: 'luck', multiplier: getRandomMultiplier() },
                                            { type: 'coin', multiplier: getRandomMultiplier() },
                                            { type: 'gem', multiplier: getRandomMultiplier() }
                                        ];

                                        const singleDuration = 24 * 60 * 60 * 1000;
                                        const totalDuration = singleDuration * quantity;
                                        let completed = 0, errors = [];

                                        boosts.forEach(({ type, multiplier }) => {
                                            db.get(
                                                `SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
                                                [message.author.id, type, source],
                                                (err, row) => {
                                                    if (err) {
                                                        errors.push(err);
                                                        if (++completed === boosts.length) handleMysteriousCubeReply();
                                                        return;
                                                    }

                                                    const now = Date.now();
                                                    const newExpiresAt = (row && row.expiresAt > now) ? row.expiresAt + totalDuration : now + totalDuration;

                                                    db.run(
                                                        `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                                         VALUES (?, ?, ?, ?, ?)
                                                         ON CONFLICT(userId, type, source) DO UPDATE SET
                                                            multiplier = excluded.multiplier,
                                                            expiresAt = excluded.expiresAt`,
                                                        [message.author.id, type, source, multiplier, newExpiresAt],
                                                        err => {
                                                            if (err) errors.push(err);
                                                            if (++completed === boosts.length) handleMysteriousCubeReply();
                                                        }
                                                    );
                                                }
                                            );
                                        });

                                        function handleMysteriousCubeReply() {
                                            if (errors.length) {
                                                console.error("MysteriousCube(L) DB error:", errors);
                                                return message.reply("❌ Failed to activate MysteriousCube boost.");
                                            }

                                            const [luck, coin, gem] = boosts;

                                            const embed = new EmbedBuilder()
                                                .setColor(0x9400D3)
                                                .setTitle("🧊 The Mysterious Cube Shifts...")
                                                .setDescription(
                                                    `You used **MysteriousCube(L)**!\n\n` +
                                                    `> 🍀 **+${((luck.multiplier - 1) * 100).toFixed(2)}% Luck Boost**\n` +
                                                    `> 💰 **+${((coin.multiplier - 1) * 100).toFixed(2)}% Coin Boost**\n` +
                                                    `> 💎 **+${((gem.multiplier - 1) * 100).toFixed(2)}% Gem Boost**\n\n` +
                                                    `⏳ Duration: **24 hour(s)**`
                                                )
                                                .setFooter({ text: `Boost Source: ${source}` })
                                                .setTimestamp();

                                            message.reply({ embeds: [embed] });
                                        }
                                    }
                                );
                                return;
                            }

                            // --- MysteriousDice(M) --- UPDATED 7/10/2025
                            if (itemName === "MysteriousDice(M)") {
                                if (quantity > 1) {
                                    return message.reply("❌ **MysteriousDice(M)** is a one-time use item. You can only use 1 at a time.");
                                }
                                const source = 'MysteriousDice';
                                const type = 'luck';
                                const duration = 12 * 60 * 60 * 1000; // 12 hours

                                db.get(
                                    `SELECT * FROM activeBoosts WHERE userId = ? AND type = ? AND source = ? AND expiresAt > ?`,
                                    [message.author.id, type, source, Date.now()],
                                    (err, row) => {
                                        if (err) {
                                            console.error("MysteriousDice(M) DB check error:", err);
                                            return message.reply("❌ Failed to check MysteriousDice status.");
                                        }
                                        if (row) {
                                            return message.reply("❌ You already have an active **MysteriousDice(M)** boost! Wait for it to expire before using another.");
                                        }

                                        function getRandomMultiplier() {
                                            return parseFloat((0.0001 + Math.random() * (10.9999)).toFixed(4));
                                        }

                                        const now = Date.now();
                                        const hourAligned = now - (now % (60 * 60 * 1000));
                                        const initialMultiplier = getRandomMultiplier();
                                        const expiresAt = now + duration;

                                        const perHour = JSON.stringify([{ at: hourAligned, multiplier: initialMultiplier }]);

                                        db.run(
                                            `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, extra)
                                             VALUES (?, ?, ?, ?, ?, ?)
                                             ON CONFLICT(userId, type, source) DO UPDATE SET
                                                multiplier = excluded.multiplier,
                                                expiresAt = excluded.expiresAt,
                                                extra = excluded.extra`,
                                            [message.author.id, type, source, initialMultiplier, expiresAt, perHour],
                                            err => {
                                                if (err) {
                                                    console.error("MysteriousDice(M) DB insert error:", err);
                                                    return message.reply("❌ Failed to activate MysteriousDice boost.");
                                                }
                                                const embed = new EmbedBuilder()
                                                    .setColor(0x1abc9c)
                                                    .setTitle("🎲 The Mysterious Dice Rolls...")
                                                    .setDescription(
                                                        `You used **MysteriousDice(M)**!\n\n` +
                                                        `> 🍀 **Luck Boost:** **${(initialMultiplier * 100).toFixed(2)}%** *(this hour)*\n` +
                                                        `> Every hour, the boost will randomly change between **0.01%** and **1000%**!\n` +
                                                        `⏳ Duration: **12 hours**`
                                                    )
                                                    .setFooter({ text: `Boost Source: ${source}` })
                                                    .setTimestamp();
                                                message.reply({ embeds: [embed] });
                                            }
                                        );
                                    }
                                );
                                return;
                            }

                            //  --- TimeClock(L) ---
                            if (itemName === "TimeClock(L)") {
                                if (quantity > 1) {
                                    return message.reply("❌ **TimeClock(L)** is a one-time use item. You can only use 1 at a time.");
                                }
                                const userId = message.author.id;
                                const source = "TimeClock";
                                const duration = 24 * 60 * 60 * 1000; // 1 day
                                const cooldown = (1 * 24 * 60 * 60 * 1000) + (12 * 60 * 60 * 1000); // 1 day and 12 hours

                                // Check if user owns the item (should not consume it)
                                db.get(
                                    `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                                    [userId, "TimeClock(L)"],
                                    (err, row) => {
                                        if (err) {
                                            console.error("TimeClock(L) DB error:", err);
                                            return message.reply("❌ Failed to check your TimeClock(L) status.");
                                        }
                                        if (!row || row.quantity < 1) {
                                            return message.reply("❌ You don't own a **TimeClock(L)**!");
                                        }

                                        // Re-add the item (since it's not consumed)
                                        db.run(
                                            `UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`,
                                            [userId, "TimeClock(L)"],
                                            (err) => {
                                                if (err) {
                                                    console.error("TimeClock(L) re-add error:", err);
                                                    // Not fatal, continue
                                                }
                                            }
                                        );

                                        // Check cooldown (store last used in userCoins table or a dedicated table)
                                        db.get(
                                            `SELECT timeclockLastUsed FROM userCoins WHERE userId = ?`,
                                            [userId],
                                            (err, userRow) => {
                                                if (err) {
                                                    console.error("TimeClock(L) cooldown check error:", err);
                                                    return message.reply("❌ Failed to check TimeClock(L) cooldown.");
                                                }
                                                const now = Date.now();
                                                const lastUsed = userRow?.timeclockLastUsed || 0;
                                                if (lastUsed && now - lastUsed < cooldown) {
                                                    return message.reply(`⏳ **TimeClock(L)** is on cooldown!\nYou can use it again <t:${Math.floor((lastUsed + cooldown) / 1000)}:R>.`);
                                                }

                                                // Apply 3 boosts: x2 coins, x2 gems, x2 summon speed
                                                const boostData = [
                                                    { type: 'coin', multiplier: 2 },
                                                    { type: 'gem', multiplier: 2 },
                                                    { type: 'summonSpeed', multiplier: 2 }
                                                ];

                                                const stmt = db.prepare(
                                                    `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                                                     VALUES (?, ?, ?, ?, ?)
                                                     ON CONFLICT(userId, type, source) DO UPDATE SET
                                                        multiplier = excluded.multiplier,
                                                        expiresAt = excluded.expiresAt`
                                                );

                                                for (const boost of boostData) {
                                                    stmt.run(userId, boost.type, source, boost.multiplier, now + duration);
                                                }

                                                stmt.finalize((err) => {
                                                    if (err) {
                                                        console.error("TimeClock(L) boost DB error:", err);
                                                        return message.reply("❌ Failed to activate TimeClock(L) boosts.");
                                                    }

                                                    // Update cooldown
                                                    db.run(
                                                        `UPDATE userCoins SET timeclockLastUsed = ? WHERE userId = ?`,
                                                        [now, userId],
                                                        (err) => {
                                                            if (err) {
                                                                console.error("TimeClock(L) cooldown update error:", err);
                                                                return message.reply("❌ Failed to set TimeClock(L) cooldown.");
                                                            }

                                                            const embed = new EmbedBuilder()
                                                                .setColor(0x3498db)
                                                                .setTitle("⏰ TimeClock(L) Activated!")
                                                                .setDescription(
                                                                    `You activated **TimeClock(L)**!\n\n` +
                                                                    `> 💰 **x2 Coins**\n` +
                                                                    `> 💎 **x2 Gems**\n` +
                                                                    `> 🏃‍♂️ **x2 Summon Speed**\n` +
                                                                    `> ⏳ Cooldown: **1d and 12h**\n\n` +
                                                                    `*This item is not consumed. You can use it again after the cooldown.*`
                                                                )
                                                                .setFooter({ text: "Enjoy your time boost!" })
                                                                .setTimestamp();

                                                            message.reply({ embeds: [embed] });
                                                        }
                                                    );
                                                });
                                            }
                                        );
                                    }
                                );
                                return;
                            }

                            //  --- S!gil?(?) ---  NOT DONE
                            if (itemName === "S!gil?(?)") {
                                if (quantity > 1) {
                                    return message.reply("❌ **S!gil?(?)** is a one-time use item. You can only use 1 at a time.");
                                }
                                const userId = message.author.id;
                                const source = "S!gil";

                                // Check if already owned
                                db.get(
                                    `SELECT * FROM activeBoosts WHERE userId = ? AND source = ? AND type = 'sgilPermanent'`,
                                    [userId, source],
                                    (err, row) => {
                                        if (err) {
                                            console.error("S!gil DB error:", err);
                                            return message.reply("❌ Failed to check S!gil status.");
                                        }
                                        if (row) {
                                            // Already owned, just reset nullified rolls silently
                                            db.run(
                                                `INSERT INTO activeBoosts (userId, type, source, multiplier, uses, expiresAt)
                                                 VALUES (?, 'rarityOverride', ?, 1, 10, ?)
                                                 ON CONFLICT(userId, type, source) DO UPDATE SET
                                                    uses = 10,
                                                    expiresAt = excluded.expiresAt`,
                                                [userId, source, Date.now() + 24 * 60 * 60 * 1000]
                                            );
                                            return;
                                        }

                                        // Remove/disable all other boosts for this user
                                        db.run(
                                            `DELETE FROM activeBoosts WHERE userId = ? AND source != ?`,
                                            [userId, source],
                                            (err) => {
                                                if (err) {
                                                    console.error("S!gil boost removal error:", err);
                                                    return message.reply("❌ Failed to disable your other boosts.");
                                                }

                                                // Get GoldenSigil stack
                                                db.get(
                                                    `SELECT stack FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = ?`,
                                                    [userId, "GoldenSigil"],
                                                    (err, goldenRow) => {
                                                        if (err) {
                                                            console.error("S!gil GoldenSigil DB error:", err);
                                                            return message.reply("❌ Failed to check GoldenSigil stack.");
                                                        }
                                                        const goldenStack = goldenRow?.stack || 0;
                                                        // Calculate boosts
                                                        const coinMultiplier = 10 * (goldenStack > 0 ? goldenStack : 1); // x1000% per stack
                                                        const luckMultiplier = 1.25 + (goldenStack > 0 ? (goldenStack * 0.075) : 0); // x1.25 +0.075 per stack, up to x2 at 10 stacks
                                                        const sellMultiplier = 6.0; // +500% (x6)
                                                        const reimuLuck = 16.0; // +1500% (x16)
                                                        const nullifiedRolls = 10;
                                                        const duration = 24 * 60 * 60 * 1000; // 1 day

                                                        let completed = 0, errors = [];

                                                        // Permanent marker
                                                        db.run(
                                                            `INSERT INTO activeBoosts (userId, type, source, multiplier)
                                                             VALUES (?, 'sgilPermanent', ?, 1)
                                                             ON CONFLICT(userId, type, source) DO NOTHING`,
                                                            [userId, source],
                                                            err => {
                                                                if (err) errors.push(err);
                                                                if (++completed === 7) handleSgilReply();
                                                            }
                                                        );
                                                        // Coin boost
                                                        db.run(
                                                            `INSERT INTO activeBoosts (userId, type, source, multiplier)
                                                             VALUES (?, 'coin', ?, ?)
                                                             ON CONFLICT(userId, type, source) DO UPDATE SET
                                                                multiplier = excluded.multiplier`,
                                                            [userId, source, coinMultiplier],
                                                            err => {
                                                                if (err) errors.push(err);
                                                                if (++completed === 7) handleSgilReply();
                                                            }
                                                        );
                                                        // Luck boost
                                                        db.run(
                                                            `INSERT INTO activeBoosts (userId, type, source, multiplier)
                                                             VALUES (?, 'luck', ?, ?)
                                                             ON CONFLICT(userId, type, source) DO UPDATE SET
                                                                multiplier = excluded.multiplier`,
                                                            [userId, source, luckMultiplier],
                                                            err => {
                                                                if (err) errors.push(err);
                                                                if (++completed === 7) handleSgilReply();
                                                            }
                                                        );
                                                        // Sell value boost
                                                        db.run(
                                                            `INSERT INTO activeBoosts (userId, type, source, multiplier)
                                                             VALUES (?, 'sell', ?, ?)
                                                             ON CONFLICT(userId, type, source) DO UPDATE SET
                                                                multiplier = excluded.multiplier`,
                                                            [userId, source, sellMultiplier],
                                                            err => {
                                                                if (err) errors.push(err);
                                                                if (++completed === 7) handleSgilReply();
                                                            }
                                                        );
                                                        // Nullified rolls (expires in 1 day, resets daily)
                                                        db.run(
                                                            `INSERT INTO activeBoosts (userId, type, source, multiplier, uses, expiresAt)
                                                             VALUES (?, 'rarityOverride', ?, 1, ?, ?)
                                                             ON CONFLICT(userId, type, source) DO UPDATE SET
                                                                uses = excluded.uses,
                                                                expiresAt = excluded.expiresAt`,
                                                            [userId, source, nullifiedRolls, Date.now() + duration],
                                                            err => {
                                                                if (err) errors.push(err);
                                                                if (++completed === 7) handleSgilReply();
                                                            }
                                                        );
                                                        // Reimu luck
                                                        db.run(
                                                            `INSERT INTO activeBoosts (userId, type, source, multiplier)
                                                             VALUES (?, 'reimuLuck', ?, ?)
                                                             ON CONFLICT(userId, type, source) DO UPDATE SET
                                                                multiplier = excluded.multiplier`,
                                                            [userId, source, reimuLuck],
                                                            err => {
                                                                if (err) errors.push(err);
                                                                if (++completed === 7) handleSgilReply();
                                                            }
                                                        );
                                                        // Astral+ lock (no more than 1 same rarity)
                                                        db.run(
                                                            `INSERT INTO activeBoosts (userId, type, source, multiplier, extra)
                                                             VALUES (?, 'astralLock', ?, 1, '{"maxAstralPlus":1}')
                                                             ON CONFLICT(userId, type, source) DO UPDATE SET
                                                                extra = excluded.extra`,
                                                            [userId, source],
                                                            err => {
                                                                if (err) errors.push(err);
                                                                if (++completed === 7) handleSgilReply();
                                                            }
                                                        );

                                                        function handleSgilReply() {
                                                            if (errors.length) {
                                                                console.error("S!gil DB error:", errors);
                                                                return message.reply("❌ Failed to activate S!gil effect.");
                                                            }
                                                            const embed = new EmbedBuilder()
                                                                .setColor(0xFFD700)
                                                                .setTitle("🪄 S!gil?(?) Activated!")
                                                                .setDescription(
                                                                    `You used **S!gil?(?)**!\n\n` +
                                                                    `> 💰 **+${coinMultiplier * 100}% Coin Boost** (permanent)\n` +
                                                                    `> 🍀 **x${luckMultiplier.toFixed(2)} Luck Boost** (permanent)\n` +
                                                                    `> 📉 **+500% Sell Value** (permanent)\n` +
                                                                    `> 🎲 **10 Nullified Rolls** (equal rarity chance, resets every day)\n` +
                                                                    `> 🛐 **+1500% Luck on Reimu's Praying** (permanent)\n` +
                                                                    `> 🚫 **All your other boosts are disabled**\n` +
                                                                    `> ✨ **You cannot get more than 1 of the same ASTRAL+ rarity**\n\n` +
                                                                    `GoldenSigil stacks: **${goldenStack}**\n\n` +
                                                                    `*S!gil is permanent. Nullified rolls reset every day!*`
                                                                )
                                                                .setFooter({ text: "The power of S!gil is unleashed. All other boosts are sealed, and ASTRAL+ is limited." })
                                                                .setTimestamp();
                                                            message.reply({ embeds: [embed] });
                                                        }
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                                return;
                            }

                            // --- PetFoob(C) ---
                            function getMaxHunger(rarity) {
                                const hungerMap = {
                                    Common: 1500,     // lasts 12h
                                    Rare: 1800,       // lasts 15h
                                    Epic: 2160,       // lasts 18h
                                    Legendary: 2880,  // lasts 24h
                                    Mythical: 3600,   // lasts 30h
                                    Divine: 4320      // lasts 36h
                                };
                                return hungerMap[rarity] || 1500;
                            }
                            if (itemName === "PetFoob(C)") {
                                const userId = message.author.id;
                                db.get(
                                    `SELECT * FROM petInventory WHERE userId = ? AND type = 'pet' AND hunger < 100 ORDER BY hunger ASC LIMIT 1`,
                                    [userId],
                                    (err, petRow) => {
                                        if (err) {
                                            console.error("PetFoob(C) DB error:", err);
                                            return message.reply("❌ Failed to check your pets.");
                                        }
                                        if (!petRow) {
                                            return message.reply("❌ You don't have any pets that need feeding.");
                                        }

                                        // 🔍 Log selected pet info
                                        console.log(`🐾 Feeding pet with ID: ${petRow.petId}, Name: ${petRow.name}, Hunger: ${petRow.hunger}`);

                                        // ✅ Use petId instead of rowid
                                        const maxHunger = getMaxHunger(petRow.rarity || 'Common'); // fallback if rarity missing
                                        db.run(
                                            `UPDATE petInventory SET hunger = ?, lastHungerUpdate = ? WHERE petId = ?`,
                                            [maxHunger, Math.floor(Date.now() / 1000), petRow.petId],
                                            err => {
                                                if (err) {
                                                    console.error("PetFoob(C) update error:", err);
                                                    return message.reply("❌ Failed to feed your pet.");
                                                }

                                                message.reply(`✅ You fed **${petRow.name}**! Hunger restored to 100%.`);
                                            }
                                        );
                                    }
                                );

                                // ✅ Prevent fallthrough
                                return;
                            }

                            // Suggestion: Add a generic handler for unknown usable items
                            // You can expand this switch for more items in the future
                            // For now, just reply with a generic message
                            message.reply(`✅ You used **${itemName}** x${quantity}! (No special effect implemented yet.)`);
                        }
                    );
                }
            );
        } catch (e) {
            console.error(`[ERROR] Unexpected error in .use command:`, e);
            message.reply("❌ An unexpected error occurred. Please try again later.");
        }
    });
};
