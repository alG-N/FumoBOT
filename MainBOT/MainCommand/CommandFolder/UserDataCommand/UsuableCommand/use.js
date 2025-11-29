const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../Core/Database/db');
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
const { maintenance, developerID } = require("../Configuration/MaintenanceConfig");
const { isBanned } = require('../Administrator/BannedList/BanUtils');

function sendErrorEmbed(message, title, description) {
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
    return message.reply({ embeds: [embed] });
}

function applyBoost(userId, type, source, multiplier, expiresAt, callback) {
    db.get(
        `SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
        [userId, type, source],
        (err, row) => {
            if (err) return callback(err);

            const now = Date.now();
            const newExpiresAt = (row && row.expiresAt > now)
                ? row.expiresAt + (expiresAt - now)
                : expiresAt;

            db.run(
                `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(userId, type, source) DO UPDATE SET
                    multiplier = excluded.multiplier,
                    expiresAt = excluded.expiresAt`,
                [userId, type, source, multiplier, newExpiresAt],
                callback
            );
        }
    );
}

function applyMultipleBoosts(userId, boosts, duration, callback) {
    let completed = 0;
    let errors = [];
    const now = Date.now();
    const expiresAt = now + duration;

    boosts.forEach(({ type, source, multiplier }) => {
        applyBoost(userId, type, source, multiplier, expiresAt, (err) => {
            if (err) errors.push(err);
            completed++;
            if (completed === boosts.length) {
                callback(errors.length > 0 ? errors : null);
            }
        });
    });
}

function updateInventory(userId, itemName, quantity, callback) {
    db.run(
        `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
        [quantity, userId, itemName],
        callback
    );
}

function formatDuration(hours) {
    return `**${hours} hour${hours > 1 ? 's' : ''}**`;
}

function createBoostEmbed(color, title, itemName, quantity, boost, duration, source, extra = '') {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(
            `You used **${itemName}** x${quantity}!\n\n` +
            `> 📹 **${boost}**\n` +
            `> ⏳ Duration: ${formatDuration(duration)}\n` +
            extra
        )
        .setFooter({ text: `Boost Source: ${source}` })
        .setTimestamp();
}

const UNUSABLE_ITEMS = new Set([
    'UniqueRock(C)', 'Books(C)', 'Wool(C)', 'Wood(C)',
    'FragmentOf1800s(R)',
    'EnhancedScroll(E)', 'RustedCore(E)',
    'RedShard(L)', 'BlueShard(L)', 'YellowShard(L)', 'WhiteShard(L)', 'DarkShard(L)',
    'ChromaShard(M)', 'MonoShard(M)', 'EquinoxAlloy(M)', 'StarShard(M)',
    'Undefined(?)', 'Null?(?)',
]);

module.exports = async (client) => {
    client.on("messageCreate", async (message) => {
        try {
            // Early returns for invalid messages
            if (message.author.bot) return;
            if (!message.content.match(/^\.u(se)?(\s|$)/)) return;

            // Check maintenance & ban
            const banData = isBanned(message.author.id);
            if (maintenance === "yes" && message.author.id !== developerID) {
                return sendErrorEmbed(
                    message,
                    '🚧 Maintenance Mode',
                    "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden"
                );
            }

            if (banData) {
                let description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

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

                return sendErrorEmbed(message, '⛔ You Are Banned', description);
            }

            const args = message.content.split(/ +/).slice(1);
            let quantity = 1;
            const lastArg = args[args.length - 1];

            if (!isNaN(lastArg) && Number.isInteger(Number(lastArg))) {
                quantity = parseInt(lastArg);
                args.pop();
            }

            if (quantity <= 0) {
                return message.reply("❌ Quantity must be a positive number.");
            }

            const itemName = args.join(" ").trim();
            if (!itemName) {
                return message.reply("❌ Please specify an item name. Example: `.use CoinPotionT1(R)`");
            }

            if (UNUSABLE_ITEMS.has(itemName)) {
                return message.reply(`❌ The item **${itemName}** cannot be used.`);
            }

            db.get(
                `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                [message.author.id, itemName],
                (err, row) => {
                    if (err) {
                        console.error(`[DB ERROR] Inventory fetch:`, err);
                        return message.reply("❌ An error occurred. Please try again later.");
                    }

                    if (!row || row.quantity < quantity) {
                        return message.reply(
                            `❌ You don't have enough **${itemName}**. ` +
                            `You need **${quantity}**, but only have **${row?.quantity || 0}**.`
                        );
                    }

                    updateInventory(message.author.id, itemName, quantity, (err) => {
                        if (err) {
                            console.error(`[DB ERROR] Inventory update:`, err);
                            return message.reply("❌ Failed to update inventory.");
                        }

                        handleItemUse(message, itemName, quantity, row);
                    });
                }
            );
        } catch (e) {
            console.error(`[ERROR] Unexpected error in .use command:`, e);
            message.reply("❌ An unexpected error occurred.");
        }
    });
};

function handleItemUse(message, itemName, quantity, row) {
    const userId = message.author.id;

    const COIN_POTIONS = {
        "CoinPotionT1(R)": { source: "CoinPotionT1", multiplier: 1.25, boost: "+25%" },
        "CoinPotionT2(R)": { source: "CoinPotionT2", multiplier: 1.5, boost: "+50%" },
        "CoinPotionT3(R)": { source: "CoinPotionT3", multiplier: 1.75, boost: "+75%" },
        "CoinPotionT4(L)": { source: "CoinPotionT4", multiplier: 2, boost: "+100%" },
        "CoinPotionT5(M)": { source: "CoinPotionT5", multiplier: 2.5, boost: "+150%" }
    };

    const GEM_POTIONS = {
        "GemPotionT1(R)": { source: "GemPotionT1", multiplier: 1.1, boost: "+10%" },
        "GemPotionT2(R)": { source: "GemPotionT2", multiplier: 1.2, boost: "+20%" },
        "GemPotionT3(R)": { source: "GemPotionT3", multiplier: 1.45, boost: "+45%" },
        "GemPotionT4(L)": { source: "GemPotionT4", multiplier: 1.9, boost: "+90%" },
        "GemPotionT5(M)": { source: "GemPotionT5", multiplier: 2.25, boost: "+125%" }
    };

    const BOOST_POTIONS = {
        "BoostPotionT1(L)": { source: "BoostPotionT1", multiplier: 1.25, boost: "+25%", baseDuration: 30 },
        "BoostPotionT2(L)": { source: "BoostPotionT2", multiplier: 1.5, boost: "+50%", baseDuration: 30 },
        "BoostPotionT3(L)": { source: "BoostPotionT3", multiplier: 2, boost: "+100%", baseDuration: 30 },
        "BoostPotionT4(M)": { source: "BoostPotionT4", multiplier: 2.5, boost: "+150%", baseDuration: 30 },
        "BoostPotionT5(M)": { source: "BoostPotionT5", multiplier: 3, boost: "+300%", baseDuration: 60 }
    };

    if (COIN_POTIONS[itemName]) {
        return handleSingleTypePotion(message, itemName, quantity, COIN_POTIONS[itemName], 'coin', 0xFFD700, '💰 Coin Boost Activated!');
    }

    if (GEM_POTIONS[itemName]) {
        return handleSingleTypePotion(message, itemName, quantity, GEM_POTIONS[itemName], 'gem', 0x00FFFF, '💎 Gem Boost Activated!');
    }

    if (BOOST_POTIONS[itemName]) {
        return handleDualTypePotion(message, itemName, quantity, BOOST_POTIONS[itemName]);
    }

    handleSpecialItems(message, itemName, quantity, row, userId);
}

function handleSingleTypePotion(message, itemName, quantity, config, type, color, title) {
    const { source, multiplier, boost } = config;
    const duration = 60 * 60 * 1000 * quantity;
    const userId = message.author.id;

    applyBoost(userId, type, source, multiplier, Date.now() + duration, (err) => {
        if (err) {
            console.error(`[DB ERROR] ${type} boost:`, err);
            return message.reply("❌ Failed to activate boost.");
        }

        const embed = createBoostEmbed(
            color,
            title,
            itemName,
            quantity,
            `${boost} ${type === 'coin' ? 'Coin' : 'Gem'} Boost`,
            quantity,
            source
        );
        message.reply({ embeds: [embed] });
    });
}

function handleDualTypePotion(message, itemName, quantity, config) {
    const { source, multiplier, boost, baseDuration } = config;
    const duration = baseDuration * 60 * 1000 * quantity;
    const userId = message.author.id;

    const boosts = [
        { type: 'coin', source, multiplier },
        { type: 'gem', source, multiplier }
    ];

    applyMultipleBoosts(userId, boosts, duration, (errors) => {
        if (errors) {
            console.error('[DB ERROR] Boost potion:', errors);
            return message.reply("❌ Failed to activate boost.");
        }

        const embed = createBoostEmbed(
            0x9932CC,
            '🧪 Magic Boost Activated!',
            itemName,
            quantity,
            `${boost} Coin & Gem Boost`,
            Math.round(duration / (60 * 60 * 1000)),
            source
        );
        message.reply({ embeds: [embed] });
    });
}

function handleSpecialItems(message, itemName, quantity, row, userId) {
    const specialHandlers = {
        "WeirdGrass(R)": handleWeirdGrass,
        "GoldenSigil(?)": handleGoldenSigil,
        "HakureiTicket(L)": handleHakureiTicket,
        "Lumina(M)": handleLumina,
        "FantasyBook(M)": handleFantasyBook,
        "AncientRelic(E)": handleAncientRelic,
        "Nullified(?)": handleNullified,
        "MysteriousCube(M)": handleMysteriousCube,
        "MysteriousDice(M)": handleMysteriousDice,
        "TimeClock(L)": handleTimeClock,
        "S!gil?(?)": handleSgil,
        "PetFoob(C)": handlePetFoob
    };

    const handler = specialHandlers[itemName];
    if (handler) {
        return handler(message, itemName, quantity, userId);
    }

    // Default: generic response
    message.reply(`✅ You used **${itemName}** x${quantity}!`);
}

function handleWeirdGrass(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **WeirdGrass(R)** is a one-time use item.");
    }

    const outcomes = [
        { type: 'coin', multiplier: 1.5, duration: 15 * 60 * 1000, desc: "+50% coins for 15 mins", color: 0xFFD700, emoji: "💰" },
        { type: 'gem', multiplier: 1.5, duration: 5 * 60 * 1000, desc: "+50% gems for 5 mins", color: 0x00FFFF, emoji: "💎" },
        { type: 'both', multiplier: { coin: 0.25, gem: 0.5 }, duration: 25 * 60 * 1000, desc: "-75% coins, -50% gems for 25 mins", color: 0xFF6347, emoji: "☠️" }
    ];

    const choice = outcomes[Math.floor(Math.random() * outcomes.length)];
    const now = Date.now();
    const expiresAt = now + choice.duration;

    if (choice.type === 'both') {
        const boosts = [
            { type: 'coin', source: 'WeirdGrass-Negative', multiplier: choice.multiplier.coin },
            { type: 'gem', source: 'WeirdGrass-Negative', multiplier: choice.multiplier.gem }
        ];

        applyMultipleBoosts(userId, boosts, choice.duration, (errors) => {
            if (errors) {
                console.error("WeirdGrass DB error:", errors);
                return message.reply("❌ Failed to apply WeirdGrass effect.");
            }
            sendWeirdGrassEmbed(message, choice);
        });
    } else {
        applyBoost(userId, choice.type, 'WeirdGrass-Boost', choice.multiplier, expiresAt, (err) => {
            if (err) {
                console.error("WeirdGrass DB error:", err);
                return message.reply("❌ Failed to apply WeirdGrass effect.");
            }
            sendWeirdGrassEmbed(message, choice);
        });
    }
}

function sendWeirdGrassEmbed(message, choice) {
    const embed = new EmbedBuilder()
        .setColor(choice.color)
        .setTitle("🌿 You used WeirdGrass(R)!")
        .setDescription(`${choice.emoji} **Effect:** ${choice.desc}`)
        .setFooter({ text: "Weird grass has unpredictable powers..." })
        .setTimestamp();
    message.reply({ embeds: [embed] });
}

function handleGoldenSigil(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **GoldenSigil(?)** is a one-time use item.");
    }

    const source = 'GoldenSigil';
    const baseMultiplier = 100;

    db.get(
        `SELECT stack FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = ?`,
        [userId, source],
        (err, row) => {
            if (err) {
                console.error("GoldenSigil DB error:", err);
                return message.reply("❌ Failed to apply GoldenSigil effect.");
            }

            const currentStacks = row?.stack || 0;

            if (currentStacks >= 10) {
                // Refund item
                db.run(`UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`, [userId, itemName]);

                const embed = new EmbedBuilder()
                    .setColor(0xFF4500)
                    .setTitle("⚠️ Max Stack Reached!")
                    .setDescription("You already have **10/10** GoldenSigil boosts.\n> 💸 That's a **+1,000,000% coin boost**!\n\nYour item was **not** consumed.")
                    .setTimestamp();
                return message.reply({ embeds: [embed] });
            }

            const newStack = currentStacks + 1;
            const newMultiplier = baseMultiplier * newStack;
            const query = row
                ? `UPDATE activeBoosts SET stack = ?, multiplier = ? WHERE userId = ? AND type = 'coin' AND source = ?`
                : `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack) VALUES (?, ?, ?, ?, NULL, ?)`;

            const params = row
                ? [newStack, newMultiplier, userId, source]
                : [userId, 'coin', source, baseMultiplier, 1];

            db.run(query, params, (err) => {
                if (err) {
                    console.error("GoldenSigil DB error:", err);
                    return message.reply("❌ Failed to stack GoldenSigil.");
                }

                const embed = new EmbedBuilder()
                    .setColor(0xFFD700)
                    .setTitle("✨ Golden Sigil " + (row ? "Stacked!" : "Activated!"))
                    .setDescription(`You used **GoldenSigil(?)**!\n\n📹 **Stack:** ${newStack}/10\n💰 **Coin Boost:** +${(row ? newMultiplier : baseMultiplier) * 100}%`)
                    .setFooter({ text: "Stacks reset when the effect is cleared." })
                    .setTimestamp();
                message.reply({ embeds: [embed] });
            });
        }
    );
}

function handleHakureiTicket(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **HakureiTicket(L)** is a one-time use item.");
    }

    db.get(
        `SELECT reimuUsageCount FROM userCoins WHERE userId = ?`,
        [userId],
        (err, row) => {
            if (err) {
                console.error("HakureiTicket DB error:", err);
                return message.reply("❌ Failed to check your prayer limit.");
            }

            if (!row || row.reimuUsageCount <= 0) {
                return sendErrorEmbed(
                    message,
                    '🌀 Ticket Not Needed',
                    "You're still within your prayer limit. No need to use a HakureiTicket(L) right now."
                );
            }

            db.run(
                `UPDATE userCoins SET reimuUsageCount = 0, reimuLastReset = ? WHERE userId = ?`,
                [Date.now(), userId],
                (err) => {
                    if (err) {
                        console.error("HakureiTicket DB error:", err);
                        return message.reply("❌ Failed to reset your prayer cooldown.");
                    }

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

function handleLumina(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **Lumina(M)** is a one-time use item.");
    }

    const source = 'Lumina';
    const multiplier = 5.0;

    db.get(
        `SELECT * FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10' AND source = ?`,
        [userId, source],
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
                `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack) VALUES (?, ?, ?, ?, NULL, NULL)`,
                [userId, 'luckEvery10', source, multiplier],
                (err) => {
                    if (err) {
                        console.error("Lumina DB error:", err);
                        return message.reply("❌ Failed to activate Lumina.");
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x00FFFF)
                        .setTitle("✨ Lumina(M) Activated!")
                        .setDescription("You used **Lumina(M)**!\n\n📹 **Effect:** Every 10th roll = **5x luck** (permanent)")
                        .setFooter({ text: "Enjoy your new luck boost!" })
                        .setTimestamp();
                    message.reply({ embeds: [embed] });
                }
            );
        }
    );
}

function handleFantasyBook(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **FantasyBook(M)** is a one-time use item.");
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
                        .setDescription(
                            "**Are you sure you want to use FantasyBook(M)?**\n\n" +
                            "> ⚠️ This will unlock drops from **non-Touhou** fumos (e.g., Lumina, Aya) and rarities like **OTHERWORLDLY** and **ASTRAL+**.\n\n" +
                            "Once used, this cannot be undone."
                        )
                        .setFooter({ text: "Reply with 'yes' to confirm or 'no' to cancel." })
                        .setTimestamp()
                ]
            }).then(() => {
                const filter = m => m.author.id === userId && ['yes', 'no'].includes(m.content.toLowerCase());
                message.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] })
                    .then(collected => {
                        const response = collected.first().content.toLowerCase();

                        if (response === 'no') {
                            db.run(`UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`, [userId, itemName]);
                            return message.reply("❌ FantasyBook(M) use cancelled.");
                        }

                        db.run(
                            `UPDATE userCoins SET hasFantasyBook = 1 WHERE userId = ?`,
                            [userId],
                            (err) => {
                                if (err) {
                                    console.error("FantasyBook DB error:", err);
                                    return message.reply("❌ Failed to activate FantasyBook.");
                                }

                                const embed = new EmbedBuilder()
                                    .setColor(0x8A2BE2)
                                    .setTitle("📖 FantasyBook(M) Activated!")
                                    .setDescription(
                                        "**You used FantasyBook(M)!**\n\n" +
                                        "📚 **Effects Unlocked:**\n" +
                                        "- Non-Touhou Fumos (e.g., Lumina, Aya, etc.)\n" +
                                        "- **OTHERWORLDLY** Rarity\n" +
                                        "- **ASTRAL+** Rarities\n\n" +
                                        "A whole new dimension of power is now accessible."
                                    )
                                    .setFooter({ text: "You will now obtain even more rarer fumo..." })
                                    .setTimestamp();
                                message.reply({ embeds: [embed] });
                            }
                        );
                    })
                    .catch(() => {
                        db.run(`UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`, [userId, itemName]);
                        message.reply("⏱️ FantasyBook(M) use timed out. Please try again.");
                    });
            });
        }
    );
}

function handleAncientRelic(message, itemName, quantity, userId) {
    const source = 'AncientRelic';
    const boosts = [
        { type: 'luck', source, multiplier: 3.5 },
        { type: 'coin', source, multiplier: 4.5 },
        { type: 'gem', source, multiplier: 6.0 },
        { type: 'sellPenalty', source, multiplier: 0.4 }
    ];
    const duration = 24 * 60 * 60 * 1000 * quantity;

    applyMultipleBoosts(userId, boosts, duration, (errors) => {
        if (errors) {
            console.error("AncientRelic DB error:", errors);
            return message.reply("❌ Failed to activate AncientRelic boost.");
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("🔮 Ancient Power Unleashed!")
            .setDescription(
                `You used **AncientRelic(E)** x${quantity}!\n\n` +
                `> 🤠 **+250% Luck Boost**\n` +
                `> 💰 **+350% Coin Boost**\n` +
                `> 💎 **+500% Gem Boost**\n\n` +

                `**Boost Details**\n` +
                `⏳ Duration: ${24 * quantity} hour(s)\n\n` +
                `📉 **-60% Sell Value Penalty is now active!**`
            )
            .setFooter({ text: `Boost Source: ${source}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    });
}

function handleNullified(message, itemName, quantity, userId) {
    const source = 'Nullified';
    const type = 'rarityOverride';
    db.get(
        `SELECT uses FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
        [userId, type, source],
        (err, row) => {
            if (err) {
                console.error("Nullified DB error:", err);
                return message.reply("❌ An error occurred while activating Nullified boost.");
            }

            const newUses = (row?.uses || 0) + quantity;

            db.run(
                `INSERT INTO activeBoosts (userId, type, source, multiplier, uses)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(userId, type, source) DO UPDATE SET uses = excluded.uses`,
                [userId, type, source, 1, newUses],
                (err) => {
                    if (err) {
                        console.error("Nullified DB error:", err);
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
}

function handleMysteriousCube(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **MysteriousCube(M)** is a one-time use item.");
    }

    const source = 'MysteriousCube';

    db.get(
        `SELECT * FROM activeBoosts WHERE userId = ? AND source = ? AND (type = 'luck' OR type = 'coin' OR type = 'gem') AND expiresAt > ?`,
        [userId, source, Date.now()],
        (err, row) => {
            if (err) {
                console.error("MysteriousCube DB error:", err);
                return message.reply("❌ Failed to check MysteriousCube status.");
            }

            if (row) {
                return message.reply("❌ You already have an active **MysteriousCube(M)** boost! Wait for it to expire before using another.");
            }

            const getRandomMultiplier = () => parseFloat((1 + Math.random() * 5.999).toFixed(4));

            const boosts = [
                { type: 'luck', source, multiplier: getRandomMultiplier() },
                { type: 'coin', source, multiplier: getRandomMultiplier() },
                { type: 'gem', source, multiplier: getRandomMultiplier() }
            ];

            const duration = 24 * 60 * 60 * 1000 * quantity;

            applyMultipleBoosts(userId, boosts, duration, (errors) => {
                if (errors) {
                    console.error("MysteriousCube DB error:", errors);
                    return message.reply("❌ Failed to activate MysteriousCube boost.");
                }

                const [luck, coin, gem] = boosts;
                const embed = new EmbedBuilder()
                    .setColor(0x9400D3)
                    .setTitle("🧊 The Mysterious Cube Shifts...")
                    .setDescription(
                        `You used **MysteriousCube(M)**!\n\n` +
                        `> 🤠**+${((luck.multiplier - 1) * 100).toFixed(2)}% Luck Boost**\n` +
                        `> 💰 **+${((coin.multiplier - 1) * 100).toFixed(2)}% Coin Boost**\n` +
                        `> 💎 **+${((gem.multiplier - 1) * 100).toFixed(2)}% Gem Boost**\n\n` +
                        `⏳ Duration: **24 hour(s)**`
                    )
                    .setFooter({ text: `Boost Source: ${source}` })
                    .setTimestamp();
                message.reply({ embeds: [embed] });
            });
        }
    );
}

function handleMysteriousDice(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **MysteriousDice(M)** is a one-time use item.");
    }

    const source = 'MysteriousDice';
    const type = 'luck';
    const duration = 12 * 60 * 60 * 1000;

    db.get(
        `SELECT * FROM activeBoosts WHERE userId = ? AND type = ? AND source = ? AND expiresAt > ?`,
        [userId, type, source, Date.now()],
        (err, row) => {
            if (err) {
                console.error("MysteriousDice DB error:", err);
                return message.reply("❌ Failed to check MysteriousDice status.");
            }

            if (row) {
                return message.reply("❌ You already have an active **MysteriousDice(M)** boost! Wait for it to expire before using another.");
            }

            const getRandomMultiplier = () => parseFloat((0.0001 + Math.random() * 10.9999).toFixed(4));
            
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
                [userId, type, source, initialMultiplier, expiresAt, perHour],
                (err) => {
                    if (err) {
                        console.error("MysteriousDice DB error:", err);
                        return message.reply("❌ Failed to activate MysteriousDice boost.");
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x1abc9c)
                        .setTitle("🎲 The Mysterious Dice Rolls...")
                        .setDescription(
                            `You used **MysteriousDice(M)**!\n\n` +
                            `> 🤠**Luck Boost:** **${(initialMultiplier * 100).toFixed(2)}%** *(this hour)*\n` +
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
}

function handleTimeClock(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **TimeClock(L)** is a one-time use item.");
    }

    const source = "TimeClock";
    const duration = 24 * 60 * 60 * 1000;
    const cooldown = 36 * 60 * 60 * 1000; // 1.5 days

    // Re-add item (not consumed)
    db.run(`UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`, [userId, itemName]);

    db.get(
        `SELECT timeclockLastUsed FROM userCoins WHERE userId = ?`,
        [userId],
        (err, userRow) => {
            if (err) {
                console.error("TimeClock DB error:", err);
                return message.reply("❌ Failed to check TimeClock(L) cooldown.");
            }

            const now = Date.now();
            const lastUsed = userRow?.timeclockLastUsed || 0;
            
            if (lastUsed && now - lastUsed < cooldown) {
                return message.reply(`⏳ **TimeClock(L)** is on cooldown!\nYou can use it again <t:${Math.floor((lastUsed + cooldown) / 1000)}:R>.`);
            }

            const boosts = [
                { type: 'coin', source, multiplier: 2 },
                { type: 'gem', source, multiplier: 2 },
                { type: 'summonSpeed', source, multiplier: 2 }
            ];

            applyMultipleBoosts(userId, boosts, duration, (errors) => {
                if (errors) {
                    console.error("TimeClock DB error:", errors);
                    return message.reply("❌ Failed to activate TimeClock(L) boosts.");
                }

                db.run(`UPDATE userCoins SET timeclockLastUsed = ? WHERE userId = ?`, [now, userId], (err) => {
                    if (err) {
                        console.error("TimeClock cooldown update error:", err);
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
                });
            });
        }
    );
}

function handleSgil(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **S!gil?(?)** is a one-time use item.");
    }

    const source = "S!gil";

    db.get(
        `SELECT * FROM activeBoosts WHERE userId = ? AND source = ? AND type = 'sgilPermanent'`,
        [userId, source],
        (err, row) => {
            if (err) {
                console.error("S!gil DB error:", err);
                return message.reply("❌ Failed to check S!gil status.");
            }

            if (row) {
                // Already owned, just reset nullified rolls
                db.run(
                    `INSERT INTO activeBoosts (userId, type, source, multiplier, uses, expiresAt)
                     VALUES (?, 'rarityOverride', ?, 1, 10, ?)
                     ON CONFLICT(userId, type, source) DO UPDATE SET uses = 10, expiresAt = excluded.expiresAt`,
                    [userId, source, Date.now() + 24 * 60 * 60 * 1000]
                );
                return;
            }

            // Disable all other boosts
            db.run(`DELETE FROM activeBoosts WHERE userId = ? AND source != ?`, [userId, source], (err) => {
                if (err) {
                    console.error("S!gil boost removal error:", err);
                    return message.reply("❌ Failed to disable your other boosts.");
                }

                // Get GoldenSigil stack
                db.get(
                    `SELECT stack FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = 'GoldenSigil'`,
                    [userId],
                    (err, goldenRow) => {
                        if (err) {
                            console.error("S!gil GoldenSigil check error:", err);
                            return message.reply("❌ Failed to check GoldenSigil stack.");
                        }

                        const goldenStack = goldenRow?.stack || 0;
                        const coinMultiplier = 10 * Math.max(goldenStack, 1);
                        const luckMultiplier = 1.25 + (goldenStack > 0 ? goldenStack * 0.075 : 0);
                        const sellMultiplier = 6.0;
                        const reimuLuck = 16.0;
                        const duration = 24 * 60 * 60 * 1000;

                        const boostConfigs = [
                            { type: 'sgilPermanent', multiplier: 1, expiresAt: null },
                            { type: 'coin', multiplier: coinMultiplier, expiresAt: null },
                            { type: 'luck', multiplier: luckMultiplier, expiresAt: null },
                            { type: 'sell', multiplier: sellMultiplier, expiresAt: null },
                            { type: 'rarityOverride', multiplier: 1, expiresAt: Date.now() + duration, uses: 10 },
                            { type: 'reimuLuck', multiplier: reimuLuck, expiresAt: null },
                            { type: 'astralLock', multiplier: 1, expiresAt: null, extra: '{"maxAstralPlus":1}' }
                        ];

                        let completed = 0;
                        let errors = [];

                        boostConfigs.forEach(config => {
                            const baseQuery = `INSERT INTO activeBoosts (userId, type, source, multiplier${config.expiresAt !== undefined ? ', expiresAt' : ''}${config.uses ? ', uses' : ''}${config.extra ? ', extra' : ''})
                                               VALUES (?, ?, ?, ?${config.expiresAt !== undefined ? ', ?' : ''}${config.uses ? ', ?' : ''}${config.extra ? ', ?' : ''})
                                               ON CONFLICT(userId, type, source) DO UPDATE SET multiplier = excluded.multiplier${config.expiresAt !== undefined ? ', expiresAt = excluded.expiresAt' : ''}${config.uses ? ', uses = excluded.uses' : ''}${config.extra ? ', extra = excluded.extra' : ''}`;
                            
                            const params = [userId, config.type, source, config.multiplier];
                            if (config.expiresAt !== undefined) params.push(config.expiresAt);
                            if (config.uses) params.push(config.uses);
                            if (config.extra) params.push(config.extra);

                            db.run(baseQuery, params, err => {
                                if (err) errors.push(err);
                                if (++completed === boostConfigs.length) {
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
                                            `> 🤠**x${luckMultiplier.toFixed(2)} Luck Boost** (permanent)\n` +
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
                            });
                        });
                    }
                );
            });
        }
    );
}

function handlePetFoob(message, itemName, quantity, userId) {
    function getMaxHunger(rarity) {
        const hungerMap = {
            Common: 1500,
            Rare: 1800,
            Epic: 2160,
            Legendary: 2880,
            Mythical: 3600,
            Divine: 4320
        };
        return hungerMap[rarity] || 1500;
    }

    db.get(
        `SELECT * FROM petInventory WHERE userId = ? AND type = 'pet' AND hunger < 100 ORDER BY hunger ASC LIMIT 1`,
        [userId],
        (err, petRow) => {
            if (err) {
                console.error("PetFoob DB error:", err);
                return message.reply("❌ Failed to check your pets.");
            }

            if (!petRow) {
                return message.reply("❌ You don't have any pets that need feeding.");
            }

            console.log(`🾠Feeding pet with ID: ${petRow.petId}, Name: ${petRow.name}, Hunger: ${petRow.hunger}`);

            const maxHunger = getMaxHunger(petRow.rarity || 'Common');
            
            db.run(
                `UPDATE petInventory SET hunger = ?, lastHungerUpdate = ? WHERE petId = ?`,
                [maxHunger, Math.floor(Date.now() / 1000), petRow.petId],
                (err) => {
                    if (err) {
                        console.error("PetFoob update error:", err);
                        return message.reply("❌ Failed to feed your pet.");
                    }

                    message.reply(`✅ You fed **${petRow.name}**! Hunger restored to 100%.`);
                }
            );
        }
    );
}