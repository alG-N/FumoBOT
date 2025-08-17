const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Embed,
    Events
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
function formatNumber(number) {
    return number.toLocaleString();
}
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
async function runAsync(sql, params = [], maxRetries = 10, retryDelay = 200) {
    let attempts = 0;
    while (attempts <= maxRetries) {
        try {
            return await new Promise((resolve, reject) => {
                db.run(sql, params, function (err) {
                    if (err) return reject(err);
                    resolve(this); // this.lastID, this.changes
                });
            });
        } catch (err) {
            if (err.code === "SQLITE_BUSY" && attempts < maxRetries) {
                attempts++;
                const backoff = retryDelay * Math.pow(2, attempts);
                const jitter = Math.floor(Math.random() * 100); // random 0–99 ms
                const waitTime = backoff + jitter;
                console.warn(`SQLITE_BUSY on attempt ${attempts}, retrying in ${waitTime}ms`);
                await new Promise(res => setTimeout(res, waitTime));
            } else {
                throw new Error(`SQL error after ${attempts} attempt(s): ${err.message}`);
            }
        }
    }
    throw new Error(`Failed to execute SQL after ${maxRetries} retries.`);
}
const cooldownMap = new Map();
const autoRollMap = new Map(); // userId -> { intervalId, bestFumo }
const { getWeekIdentifier, incrementWeeklyShiny, incrementWeeklyAstral } = require('../utils/weekly'); // adjust path
module.exports = (client, fumos) => {
    client.on('messageCreate', async message => {
        if (message.content.startsWith('.crategacha') || message.content.startsWith('.cg')) {

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

            const row = await new Promise(resolve => {
                db.get(`SELECT coins, boostCharge, boostActive, boostRollsRemaining, pityTranscendent, pityEternal, pityInfinite, pityCelestial, pityAstral, hasFantasyBook, rollsLeft
                    FROM userCoins 
                    WHERE userId = ?`, [message.author.id], (err, row) => {
                    if (err) {
                        console.error(err.message);
                    }
                    resolve(row);
                });
            });

            const ancientLuckMultiplier = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`,
                    [message.author.id],
                    (err, relicRow) => {
                        if (err) {
                            console.error(err.message);
                            return resolve(1); // Fallback to no boost
                        }
                        resolve(relicRow ? relicRow.multiplier : 1);
                    }
                );
            });

            const mysteriousLuckMultiplier = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`,
                    [message.author.id],
                    (err, cubeRow) => {
                        if (err) {
                            console.error(err.message);
                            return resolve(1); // Fallback to no boost
                        }
                        resolve(cubeRow && cubeRow.expiresAt > Date.now() ? cubeRow.multiplier : 1);
                    }
                );
            });

            // MysteriousDice boost (per-hour random multiplier)
            let mysteriousDiceMultiplier = 1;
            const mysteriousDiceBoost = await new Promise(resolve => {
                db.get(
                    `SELECT multiplier, expiresAt, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
                    [message.author.id],
                    (err, row) => resolve(row)
                );
            });

            if (mysteriousDiceBoost && mysteriousDiceBoost.expiresAt > Date.now()) {
                let perHourArr = [];
                try {
                    perHourArr = JSON.parse(mysteriousDiceBoost.extra || '[]');
                } catch {
                    perHourArr = [];
                }

                const now = Date.now();
                const currentHourTimestamp = now - (now % (60 * 60 * 1000));

                let currentHour = perHourArr.find(e => e.at === currentHourTimestamp);

                if (!currentHour) {
                    function getRandomMultiplier() {
                        return parseFloat((0.0001 + Math.random() * (10.9999)).toFixed(4));
                    }

                    const newMultiplier = getRandomMultiplier();
                    const newEntry = { at: currentHourTimestamp, multiplier: newMultiplier };

                    perHourArr.push(newEntry);
                    if (perHourArr.length > 12) perHourArr = perHourArr.slice(-12);

                    await new Promise(resolve => {
                        db.run(
                            `UPDATE activeBoosts SET multiplier = ?, extra = ? WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
                            [newMultiplier, JSON.stringify(perHourArr), message.author.id],
                            () => resolve()
                        );
                    });

                    mysteriousDiceMultiplier = newMultiplier;
                    // console.log(`[MysteriousDice] New multiplier generated for user ${message.author.id}: ${newMultiplier}`);
                } else {
                    mysteriousDiceMultiplier = currentHour.multiplier;
                    // console.log(`[MysteriousDice] Existing multiplier used for user ${message.author.id}: ${currentHour.multiplier}`);
                }
            } else {
                // console.log(`[MysteriousDice] No active boost for user ${message.author.id}`);
            }

            // 🐰 Pet Boost
            let petBoost = 1;

            // Fetch all active pet-related boosts
            const petBoostRows = await new Promise(resolve => {
                db.all(
                    `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'luck'`,
                    [message.author.id],
                    (err, rows) => {
                        if (err) {
                            console.error('❌ Error fetching pet boosts:', err.message);
                            return resolve([]);
                        }
                        resolve(rows);
                    }
                );
            });

            // Multiply all applicable pet boost multipliers
            if (petBoostRows.length > 0) {
                petBoost = petBoostRows.reduce((acc, row) => acc * row.multiplier, 1);
                console.log(`🐰 Found ${petBoostRows.length} pet boost(s). Final multiplier: x${petBoost.toFixed(4)}`);
            } else {
                // console.log('🐰 No active pet boosts found. Defaulting to x1.');
            }

            if (!row) {
                return message.reply({ content: 'You do not have any coins unfortunately..', ephemeral: true });
            }

            const hasFantasyBook = row.hasFantasyBook;

            const baseChances = [
                { label: '👑 **TRANSCENDENT**', base: 0.0000667, gated: true },
                { label: '🌟 **ETERNAL**', base: 0.0002, gated: true },
                { label: '✨ **INFINITE**', base: 0.0005, gated: true },
                { label: '☀️ **CELESTIAL**', base: 0.001111, gated: true },
                { label: '🌙 **ASTRAL**', base: 0.003333, gated: true },
                { label: '❓ **???**', base: 0.006666 },
                { label: '🎁 **EXCLUSIVE**', base: 0.02 },
                { label: '🦄 **MYTHICAL**', base: 0.1 },
                { label: '🌈 **LEGENDARY**', base: 0.4 },
                { label: '👽 **OTHERWORLDLY**', base: 1.0, gated: true },
                { label: '🔮 **EPIC**', base: 6.0 },
                { label: '💎 **RARE**', base: 10.0 },
                { label: '💠 **UNCOMMON**', base: 25.0 },
                { label: '⚪ **Common**', base: 57.4681233 },
            ];

            const isBoostActive = row.boostActive && row.boostRollsRemaining > 0;
            const rollsLeft = row.rollsLeft || 0;

            function applyBoosts(baseChance) {
                let boosted = baseChance * ancientLuckMultiplier * mysteriousLuckMultiplier * mysteriousDiceMultiplier * petBoost;

                if (isBoostActive) {
                    boosted *= 25;
                } else if (rollsLeft > 0) {
                    boosted *= 2;
                }

                return boosted;
            }

            function obscureChance(boosted) {
                if (boosted >= 0.1) return null;

                const zeros = boosted.toExponential().split('e-')[1];
                const level = parseInt(zeros) || 2;
                return '?'.repeat(level) + '%';
            }

            const shownRarityChances = [];
            const shownUnknownChances = [];

            baseChances.forEach(({ label, base, gated }) => {
                if (gated && !hasFantasyBook) return;

                let boosted = applyBoosts(base);
                let display = '';

                const obscured = obscureChance(boosted);
                if (obscured) {
                    display = `${label} – ${obscured}`;
                    shownUnknownChances.push(display);
                    return;
                }

                if (boosted > 100) {
                    boosted = 100;
                    display = `${label} – 100.00% 🔥`;
                } else {
                    display = `${label} – ${boosted.toFixed(2)}%`;
                }

                (base >= 1 ? shownRarityChances : shownUnknownChances).push(display);
            });

            const rarityChances = shownRarityChances.join('\n');
            const unknownChances = shownUnknownChances.join('\n');
            const ancientNoteLines = [];

            if (ancientLuckMultiplier > 1) {
                ancientNoteLines.push(`🎇 AncientRelic active! Luck boosted by ${ancientLuckMultiplier}×`);
            }
            // Lumina effect (every 10th roll)
            const luminaBoostActive = await new Promise((resolve, reject) => {
                db.get(`SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`, [message.author.id], (err, row) => {
                    if (err) reject(err);
                    resolve(!!row);
                });
            });
            if (luminaBoostActive) {
                ancientNoteLines.push(`🌟 Lumina active! Every 10th roll grants 5× Luck`);
            }
            if (rollsLeft > 0 && !isBoostActive) {
                ancientNoteLines.push(`✨ Bonus Roll active! Luck boosted by 2×`);
            }
            if (mysteriousLuckMultiplier > 1) {
                ancientNoteLines.push(`🧊 MysteriousCube active! Luck boosted by ${mysteriousLuckMultiplier.toFixed(2)}×`);
            }
            if (mysteriousDiceMultiplier !== 1) {
                ancientNoteLines.push(`🎲 MysteriousDice active! Luck boosted by ${mysteriousDiceMultiplier.toFixed(4)}× (random per hour)`);
            }
            if (petBoost > 1) {
                ancientNoteLines.push(`🐰 Pet boost active! Luck boosted by ${petBoost.toFixed(4)}×`);
            }
            const ancientNote = ancientNoteLines.length > 0 ? ancientNoteLines.join('\n') : 'No luck boost applied...';

            const pitySection =
                `Each roll charges the mysterious **Boost**. At maximum charge, reality fractures and fate itself is rewritten...\n\n` +
                (row.boostActive
                    ? `🔥 **BOOSTED MODE ACTIVE**\n➡️ Rolls Remaining: \`${row.boostRollsRemaining} / 250\`\n⚠️ Each roll costs **1 Energy**!\n\n`
                    : `⚡ **Boost Charge**: \`${row.boostCharge} / 1,000\`\n`) +

                (hasFantasyBook ? `**🌙 Astral Pity**        → \`${row.pityAstral.toLocaleString()} / 30,000\`\n` : '') +
                (hasFantasyBook ? `**☀️ Celestial Pity**     → \`${row.pityCelestial.toLocaleString()} / 90,000\`\n` : '') +
                (hasFantasyBook ? `**✨ Infinite Pity**      → \`${row.pityInfinite.toLocaleString()} / 200,000\`\n` : '') +
                (hasFantasyBook ? `**🌟 Eternal Pity**       → \`${row.pityEternal.toLocaleString()} / 500,000\`\n` : '') +
                (hasFantasyBook ? `**👑 Transcendent Pity**  → \`${row.pityTranscendent.toLocaleString()} / 1,500,000\`` : '');

            const embed = new EmbedBuilder()
                .setTitle('🎉 Welcome to alterGolden\'s Fumo Crate Shop! 🎉')
                .setDescription(
                    `👋 Hey there! I'm **alterGolden**, your friendly Fumo dealer, bringing you the mysterious and magical **Fumo Boxes**!  
            ✨ *"What's inside?"* you ask? — "**Fumo**, of course!"  
            Take a chance—who knows what you'll get?
            
            💰 **You currently have ${formatNumber(row.coins)} coins!**  
            🎲 Each summon costs **100 coins** — choose wisely, and may luck be on your side!`
                )
                .addFields([
                    {
                        name: '🌈 Rarity Chances',
                        value: rarityChances,
                        inline: true
                    },
                    {
                        name: '❓ Rare Chances:',
                        value: unknownChances,
                        inline: true
                    },
                    {
                        name: '🌌 Booster/Pity Status:',
                        value: pitySection,
                        inline: false
                    }
                ])
                .setColor(0x0099ff)
                .setImage('https://pbs.twimg.com/media/EkXjV4sU0AIwSr5.png')
                .setFooter({ text: `${ancientNote}` });

            const userId = message.author.id;

            const rowButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`buy1fumo_${userId}`)
                    .setLabel('Summon 1')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`buy10fumos_${userId}`)
                    .setLabel('Summon 10')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`buy100fumos_${userId}`)
                    .setLabel('Summon 100')
                    .setStyle(ButtonStyle.Primary),
            );

            if (autoRollMap.has(userId)) {
                rowButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`stopAuto50_${userId}`)
                        .setLabel('🛑 Stop Auto 100')
                        .setStyle(ButtonStyle.Danger)
                );
            } else {
                rowButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`autoRoll50_${userId}`)
                        .setLabel('Auto Roll 100')
                        .setStyle(ButtonStyle.Success)
                );
            }

            message.channel.send({ embeds: [embed], components: [rowButtons] });
        }
    });

    client.on('interactionCreate', async interaction => {
        try {
            if (!interaction.isButton()) return;

            const [action, userId] = interaction.customId.split('_');

            const protectedActions = ['crategacha', 'buy1fumo', 'buy10fumos', 'buy100fumos', 'autoRoll50', 'stopAuto50', 'autoRollPrev', 'autoRollNext'];
            if (protectedActions.includes(action) && interaction.user.id !== userId) {
                return interaction.reply({
                    content: "You can't use someone else's button. Use /crategacha yourself.",
                    ephemeral: true
                });
            }

            // Cooldown check (4 seconds = 4000 milliseconds)
            if (['buy1fumo', 'buy10fumos', 'buy100fumos', 'autoRoll50', 'stopAuto50'].includes(action)) {
                const cooldownKey = `${interaction.user.id}_gacha`;
                const lastUsed = cooldownMap.get(cooldownKey);
                const now = Date.now();

                // Default cooldown is 4000 ms
                let cooldownDuration = 4000;

                // Check for active TimeBlessing boost that affects summonCooldown
                const row = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`,
                        [interaction.user.id, now],
                        (err, row) => err ? reject(err) : resolve(row)
                    );
                });

                if (row && row.multiplier) {
                    cooldownDuration *= row.multiplier; // Apply the multiplier (e.g., 0.5)
                }

                // Check for active TimeClock boost (x2 summon speed, halves cooldown)
                const timeClockBoost = await new Promise((resolve) => {
                    db.get(
                        `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`,
                        [interaction.user.id, now],
                        (err, row) => resolve(row)
                    );
                });
                if (timeClockBoost && timeClockBoost.multiplier === 2) {
                    cooldownDuration = Math.floor(cooldownDuration / 2);
                }

                if (lastUsed && now - lastUsed < cooldownDuration) {
                    const remaining = ((cooldownDuration - (now - lastUsed)) / 1000).toFixed(1);
                    return interaction.reply({
                        content: `🕒 Please wait ${remaining}s before clicking again.`,
                        ephemeral: true
                    });
                }

                cooldownMap.set(cooldownKey, now); // Update last used time

                if (['buy1fumo', 'buy10fumos', 'buy100fumos'].includes(action) && autoRollMap.has(userId)) {
                    return interaction.reply({
                        content: '⚠️ You cannot manually roll while Auto Roll is active. Please stop it first.',
                        ephemeral: true
                    });
                }
                function compareFumos(a, b) {
                    const rarityOrder = ['Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];

                    const rarityA = rarityOrder.indexOf(a.rarity);
                    const rarityB = rarityOrder.indexOf(b.rarity);

                    if (rarityA > rarityB) return 1;
                    if (rarityA < rarityB) return -1;

                    // If rarities are the same, compare by name (optional)
                    return a.name.localeCompare(b.name);
                }
                async function handleBuy50Fumos(interaction, db, fumos, options = {}) {
                    return new Promise((resolve, reject) => {
                        db.serialize(() => {
                            db.get(
                                `SELECT coins, boostCharge, boostActive, boostRollsRemaining, pityTranscendent, pityEternal, pityInfinite, pityCelestial, pityAstral, rollsLeft, totalRolls, hasFantasyBook, luck 
                                 FROM userCoins WHERE userId = ?`,
                                [interaction.user.id],
                                async (err, row) => {
                                    if (err) {
                                        console.error(err.message);
                                        if (!options.auto) {
                                            try {
                                                await interaction.reply({ content: 'An error occurred while retrieving your coin data. Please try again later.', ephemeral: true });
                                            } catch { }
                                        }
                                        return resolve(null);
                                    }

                                    if (!row || row.coins < 5000) {
                                        if (!options.auto) {
                                            try {
                                                await interaction.reply({ content: 'You do not have enough coins to buy 50 fumos.', ephemeral: true });
                                            } catch { }
                                        }
                                        return resolve(null);
                                    }

                                    const hasFantasyBook = !!row.hasFantasyBook;
                                    const shinyMarkValue = Math.min(1, row.luck || 0);
                                    let { boostCharge, boostActive, boostRollsRemaining } = row;
                                    let { pityTranscendent, pityEternal, pityInfinite, pityCelestial, pityAstral } = row;
                                    let currentRolls = row.totalRolls;

                                    const rarityPriority = [
                                        'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???',
                                        'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
                                    ];
                                    const isRarer = (r1, r2) => rarityPriority.indexOf(r1?.toUpperCase() ?? '') > rarityPriority.indexOf(r2?.toUpperCase() ?? '');

                                    // Get boosts only once per batch
                                    const luminaBoostActive = await new Promise((resolve, reject) => {
                                        db.get(`SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`, [interaction.user.id], (err, row) => {
                                            if (err) return resolve(false);
                                            resolve(!!row);
                                        });
                                    });

                                    const ancientLuckMultiplier = await new Promise((resolve, reject) => {
                                        db.get(
                                            `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`,
                                            [interaction.user.id],
                                            (err, row) => {
                                                if (err) return resolve(1);
                                                resolve(row && row.expiresAt > Date.now() ? row.multiplier : 1);
                                            }
                                        );
                                    });

                                    const mysteriousLuckMultiplier = await new Promise(resolve => {
                                        db.get(
                                            `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`,
                                            [interaction.user.id],
                                            (err, row) => {
                                                if (err) return resolve(1);
                                                resolve(row && row.expiresAt > Date.now() ? row.multiplier : 1);
                                            }
                                        );
                                    });

                                    // Pet boost
                                    const petBoost = await new Promise(resolve => {
                                        db.get(
                                            `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'luck'`,
                                            [interaction.user.id],
                                            (err, row) => {
                                                if (err) {
                                                    console.error('DB error fetching pet boost:', err);
                                                    return resolve(1);
                                                }
                                                // console.log('🐰 Pet boost row:', row);
                                                resolve(row ? row.multiplier : 1);
                                            }
                                        );
                                    });
                                    // console.log('🎲 Final Pet Boost Multiplier:', petBoost);

                                    let mysteriousDiceMultiplier = 1;
                                    const mysteriousDiceBoost = await new Promise(resolve => {
                                        db.get(
                                            `SELECT multiplier, expiresAt, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
                                            [interaction.user.id],
                                            (err, row) => resolve(row)
                                        );
                                    });

                                    if (mysteriousDiceBoost && mysteriousDiceBoost.expiresAt > Date.now()) {
                                        let perHourArr = [];
                                        try {
                                            perHourArr = JSON.parse(mysteriousDiceBoost.extra || '[]');
                                        } catch {
                                            perHourArr = [];
                                        }

                                        const now = Date.now();
                                        const currentHourTimestamp = now - (now % (60 * 60 * 1000));

                                        let currentHour = perHourArr.find(e => e.at === currentHourTimestamp);

                                        if (!currentHour) {
                                            function getRandomMultiplier() {
                                                return parseFloat((0.0001 + Math.random() * (10.9999)).toFixed(4));
                                            }

                                            const newMultiplier = getRandomMultiplier();
                                            const newEntry = { at: currentHourTimestamp, multiplier: newMultiplier };

                                            perHourArr.push(newEntry);
                                            if (perHourArr.length > 12) perHourArr = perHourArr.slice(-12);

                                            await new Promise(resolve => {
                                                db.run(
                                                    `UPDATE activeBoosts SET multiplier = ?, extra = ? WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
                                                    [newMultiplier, JSON.stringify(perHourArr), interaction.user.id],
                                                    () => resolve()
                                                );
                                            });

                                            mysteriousDiceMultiplier = newMultiplier;
                                            // console.log(`[MysteriousDice] New multiplier generated for user ${interaction.user.id}: ${newMultiplier}`);
                                        } else {
                                            mysteriousDiceMultiplier = currentHour.multiplier;
                                            // console.log(`[MysteriousDice] Existing multiplier used for user ${interaction.user.id}: ${currentHour.multiplier}`);
                                        }
                                    } else {
                                        // console.log(`[MysteriousDice] No active boost for user ${interaction.user.id}`);
                                    }

                                    let updatedPities = {
                                        pityTranscendent,
                                        pityEternal,
                                        pityInfinite,
                                        pityCelestial,
                                        pityAstral
                                    };
                                    const fumosBought = [];
                                    let bestFumo = null;

                                    for (let i = 0; i < 100; i++) {
                                        let rarity = null;

                                        // Pity logic
                                        if (hasFantasyBook) {
                                            if (row.pityTranscendent >= 1500000) { rarity = 'TRANSCENDENT'; row.pityTranscendent = 0; }
                                            else if (row.pityEternal >= 500000) { rarity = 'ETERNAL'; row.pityEternal = 0; }
                                            else if (row.pityInfinite >= 200000) { rarity = 'INFINITE'; row.pityInfinite = 0; }
                                            else if (row.pityCelestial >= 90000) { rarity = 'CELESTIAL'; row.pityCelestial = 0; }
                                            else if (row.pityAstral >= 30000) { rarity = 'ASTRAL'; row.pityAstral = 0; }
                                        }

                                        currentRolls++;

                                        // Nullified(?) Boost Check – overrides normal rarity math
                                        let nullifiedBoost = null;
                                        try {
                                            nullifiedBoost = await new Promise((resolve, reject) => {
                                                db.get(
                                                    `SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                                                    [interaction.user.id],
                                                    (err, row) => {
                                                        if (err) return resolve(null);
                                                        resolve(row);
                                                    }
                                                );
                                            });
                                        } catch { }

                                        if (!rarity && nullifiedBoost?.uses > 0) {
                                            const rarities = hasFantasyBook
                                                ? ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON', 'Common']
                                                : ['???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'Common'];
                                            rarity = rarities[Math.floor(Math.random() * rarities.length)];
                                            const remainingUses = nullifiedBoost.uses - 1;
                                            if (remainingUses > 0) {
                                                db.run(
                                                    `UPDATE activeBoosts SET uses = ? WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                                                    [remainingUses, interaction.user.id]
                                                );
                                            } else {
                                                db.run(
                                                    `DELETE FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                                                    [interaction.user.id]
                                                );
                                            }
                                        } else if (!rarity) {
                                            const totalLuckMultiplier = ancientLuckMultiplier * mysteriousLuckMultiplier * mysteriousDiceMultiplier * petBoost?.multiplier || 1;
                                            let rarityRoll = Math.random() * 100;
                                            if (luminaBoostActive && currentRolls % 10 === 0) rarityRoll /= 5;
                                            if (totalLuckMultiplier > 1) {
                                                rarityRoll /= totalLuckMultiplier;
                                            }

                                            let useRollsLeftBoost = row.rollsLeft > 0;
                                            if (boostActive && boostRollsRemaining > 0) {
                                                rarityRoll /= 25;
                                                boostRollsRemaining--;
                                                if (boostRollsRemaining === 0) {
                                                    boostActive = 0;
                                                    boostRollsRemaining = 0;
                                                }
                                            } else if (useRollsLeftBoost) {
                                                rarityRoll /= 2;
                                            }

                                            // Balanced rarity rates, total = 100%
                                            if (rarityRoll < 0.0000667 && hasFantasyBook) rarity = 'TRANSCENDENT';
                                            else if (rarityRoll < 0.0002667 && hasFantasyBook) rarity = 'ETERNAL'; // +0.0002
                                            else if (rarityRoll < 0.0007667 && hasFantasyBook) rarity = 'INFINITE'; // +0.0005
                                            else if (rarityRoll < 0.0018777 && hasFantasyBook) rarity = 'CELESTIAL'; // +0.001111
                                            else if (rarityRoll < 0.0052107 && hasFantasyBook) rarity = 'ASTRAL'; // +0.003333
                                            else if (rarityRoll < 0.0118767 && hasFantasyBook) rarity = '???'; // +0.006666
                                            else if (rarityRoll < 0.0318767) rarity = 'EXCLUSIVE'; // +0.02
                                            else if (rarityRoll < 0.1318767) rarity = 'MYTHICAL'; // +0.1
                                            else if (rarityRoll < 0.5318767) rarity = 'LEGENDARY'; // +0.4
                                            else if (rarityRoll < 1.5318767 && hasFantasyBook) rarity = 'OTHERWORLDLY'; // +1
                                            else if (rarityRoll < 7.5318767) rarity = 'EPIC'; // +6
                                            else if (rarityRoll < 17.5318767) rarity = 'RARE'; // +10
                                            else if (rarityRoll < 42.5318767) rarity = 'UNCOMMON'; // +25
                                            else rarity = 'Common'; // Remaining 57.4681233%

                                            // Astral+ quest
                                            const astralPlus = ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
                                            if (astralPlus.includes(rarity)) incrementWeeklyAstral(interaction.user.id);
                                        }

                                        // Update pity counters
                                        if (hasFantasyBook) {
                                            updatedPities.pityTranscendent = rarity === 'TRANSCENDENT' ? 0 : updatedPities.pityTranscendent + 1;
                                            updatedPities.pityEternal = rarity === 'ETERNAL' ? 0 : updatedPities.pityEternal + 1;
                                            updatedPities.pityInfinite = rarity === 'INFINITE' ? 0 : updatedPities.pityInfinite + 1;
                                            updatedPities.pityCelestial = rarity === 'CELESTIAL' ? 0 : updatedPities.pityCelestial + 1;
                                            updatedPities.pityAstral = rarity === 'ASTRAL' ? 0 : updatedPities.pityAstral + 1;
                                        }

                                        // Boost charge logic
                                        if (!boostActive) {
                                            boostCharge++;
                                            if (boostCharge >= 1000) {
                                                boostCharge = 0;
                                                boostActive = 1;
                                                boostRollsRemaining = 250;
                                            }
                                        } else {
                                            // Already decremented above if boostActive
                                        }

                                        // Get fumo
                                        const matchingFumos = fumos.filter(f => f.name.includes(rarity));
                                        if (matchingFumos.length > 0) {
                                            const fumo = matchingFumos[Math.floor(Math.random() * matchingFumos.length)];
                                            const shinyChance = 0.01 + shinyMarkValue * 0.02;
                                            const alGChance = 0.00001 + shinyMarkValue * 0.00009;
                                            const isAlterGolden = Math.random() < alGChance;
                                            const isShiny = !isAlterGolden && Math.random() < shinyChance;
                                            let fumoName = fumo.name;
                                            if (isAlterGolden) {
                                                fumoName += '[🌟alG]';
                                                incrementWeeklyShiny(interaction.user.id);
                                            } else if (isShiny) {
                                                fumoName += '[✨SHINY]';
                                                incrementWeeklyShiny(interaction.user.id);
                                            }
                                            fumosBought.push({ ...fumo, rarity, name: fumoName });
                                            await runAsync(`INSERT INTO userInventory (userId, fumoName) VALUES (?, ?)`, [interaction.user.id, fumoName]);
                                            if (!bestFumo || isRarer(rarity, bestFumo.rarity)) {
                                                bestFumo = { ...fumo, rarity, name: fumoName };
                                            }
                                        }
                                    }

                                    // Final database updates
                                    db.run(
                                        `UPDATE userCoins SET coins = coins - 5000, totalRolls = totalRolls + 50, boostCharge = ?, boostActive = ?, boostRollsRemaining = ?, pityTranscendent = ?, pityEternal = ?, pityInfinite = ?, pityCelestial = ?, pityAstral = ?, rollsLeft = CASE WHEN rollsLeft >= 50 THEN rollsLeft - 50 ELSE 0 END WHERE userId = ?`,
                                        [
                                            boostCharge,
                                            boostActive,
                                            boostRollsRemaining,
                                            updatedPities.pityTranscendent,
                                            updatedPities.pityEternal,
                                            updatedPities.pityInfinite,
                                            updatedPities.pityCelestial,
                                            updatedPities.pityAstral,
                                            interaction.user.id
                                        ]
                                    );

                                    db.run(
                                        `INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date) VALUES (?, 'roll_1000', 1, 0, DATE('now')) 
                                         ON CONFLICT(userId, questId, date) DO UPDATE SET progress = MIN(progress + 50, 1000), completed = CASE WHEN progress + 50 >= 1000 THEN 1 ELSE completed END`,
                                        [interaction.user.id]
                                    );

                                    const weekId = getWeekIdentifier();
                                    db.run(
                                        `INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week) VALUES (?, 'roll_15000', 1, 0, ?) 
                                         ON CONFLICT(userId, questId, week) DO UPDATE SET progress = MIN(progress + 50, 15000), completed = CASE WHEN progress + 50 >= 15000 THEN 1 ELSE completed END`,
                                        [interaction.user.id, weekId]
                                    );

                                    db.run(
                                        `INSERT INTO achievementProgress (userId, achievementId, progress, claimed) VALUES (?, 'total_rolls', 50, 0) 
                                         ON CONFLICT(userId, achievementId) DO UPDATE SET progress = progress + 50`,
                                        [interaction.user.id]
                                    );

                                    resolve(bestFumo);
                                }
                            );
                        });
                    });
                }
                if (action === 'buy1fumo') {
                    (async () => {
                        try {
                            const row = await new Promise((resolve, reject) => {
                                db.get(
                                    `SELECT coins, boostCharge, boostActive, boostRollsRemaining, pityTranscendent, pityEternal, pityInfinite, pityCelestial, pityAstral, rollsLeft, totalRolls, hasFantasyBook, luck FROM userCoins WHERE userId = ?`,
                                    [interaction.user.id],
                                    (err, row) => err ? reject(err) : resolve(row)
                                );
                            });

                            if (!row || row.coins < 100) {
                                await interaction.reply({ content: 'You do not have enough coins to buy a fumo.', ephemeral: true });
                                return;
                            }

                            let boostCharge = row.boostCharge;
                            let boostActive = row.boostActive;
                            let boostRollsRemaining = row.boostRollsRemaining;
                            let rarity = null;

                            const hasFantasyBook = !!row.hasFantasyBook;

                            // Pity logic
                            if (hasFantasyBook) {
                                if (row.pityTranscendent >= 1500000) { rarity = 'TRANSCENDENT'; row.pityTranscendent = 0; }
                                else if (row.pityEternal >= 500000) { rarity = 'ETERNAL'; row.pityEternal = 0; }
                                else if (row.pityInfinite >= 200000) { rarity = 'INFINITE'; row.pityInfinite = 0; }
                                else if (row.pityCelestial >= 90000) { rarity = 'CELESTIAL'; row.pityCelestial = 0; }
                                else if (row.pityAstral >= 30000) { rarity = 'ASTRAL'; row.pityAstral = 0; }
                            }

                            // Lumina boost
                            const luminaBoostActive = await new Promise(resolve => {
                                db.get(`SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`, [interaction.user.id], (err, row) => {
                                    resolve(!!row);
                                });
                            });

                            // AncientRelic boost
                            const ancientLuckMultiplier = await new Promise(resolve => {
                                db.get(
                                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`,
                                    [interaction.user.id],
                                    (err, row) => {
                                        if (err) return resolve(1);
                                        resolve(row && row.expiresAt > Date.now() ? row.multiplier : 1);
                                    }
                                );
                            });

                            const totalRollsBeforeThisRoll = row.totalRolls + 1;

                            // MysteriousCube boost
                            const mysteriousLuckMultiplier = await new Promise(resolve => {
                                db.get(
                                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`,
                                    [interaction.user.id],
                                    (err, row) => {
                                        if (err) return resolve(1);
                                        resolve(row && row.expiresAt > Date.now() ? row.multiplier : 1);
                                    }
                                );
                            });

                            // MysteriousDice boost (per-hour random multiplier)
                            let mysteriousDiceMultiplier = 1;
                            const mysteriousDiceBoost = await new Promise(resolve => {
                                db.get(
                                    `SELECT multiplier, expiresAt, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
                                    [interaction.user.id],
                                    (err, row) => resolve(row)
                                );
                            });

                            if (mysteriousDiceBoost && mysteriousDiceBoost.expiresAt > Date.now()) {
                                let perHourArr = [];
                                try {
                                    perHourArr = JSON.parse(mysteriousDiceBoost.extra || '[]');
                                } catch {
                                    perHourArr = [];
                                }

                                const now = Date.now();
                                const currentHourTimestamp = now - (now % (60 * 60 * 1000));

                                let currentHour = perHourArr.find(e => e.at === currentHourTimestamp);

                                if (!currentHour) {
                                    function getRandomMultiplier() {
                                        return parseFloat((0.0001 + Math.random() * (10.9999)).toFixed(4));
                                    }

                                    const newMultiplier = getRandomMultiplier();
                                    const newEntry = { at: currentHourTimestamp, multiplier: newMultiplier };

                                    perHourArr.push(newEntry);
                                    if (perHourArr.length > 12) perHourArr = perHourArr.slice(-12);

                                    await new Promise(resolve => {
                                        db.run(
                                            `UPDATE activeBoosts SET multiplier = ?, extra = ? WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
                                            [newMultiplier, JSON.stringify(perHourArr), interaction.user.id],
                                            () => resolve()
                                        );
                                    });

                                    mysteriousDiceMultiplier = newMultiplier;
                                    // console.log(`[MysteriousDice] New multiplier generated for user ${interaction.user.id}: ${newMultiplier}`);
                                } else {
                                    mysteriousDiceMultiplier = currentHour.multiplier;
                                    // console.log(`[MysteriousDice] Existing multiplier used for user ${interaction.user.id}: ${currentHour.multiplier}`);
                                }
                            } else {
                                // console.log(`[MysteriousDice] No active boost for user ${interaction.user.id}`);
                            }

                            // Pet boost
                            const petBoost = await new Promise(resolve => {
                                db.get(
                                    `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'luck'`,
                                    [interaction.user.id],
                                    (err, row) => {
                                        if (err) {
                                            console.error('DB error fetching pet boost:', err);
                                            return resolve(1);
                                        }
                                        console.log('🐰 Pet boost row:', row);
                                        resolve(row ? row.multiplier : 1);
                                    }
                                );
                            });
                            console.log('🎲 Final Pet Boost Multiplier:', petBoost);

                            // Nullified boost
                            const nullifiedBoost = await new Promise(resolve => {
                                db.get(
                                    `SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                                    [interaction.user.id],
                                    (err, row) => resolve(row)
                                );
                            });

                            if (!rarity && nullifiedBoost?.uses > 0) {
                                const rarities = hasFantasyBook
                                    ? ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON', 'Common']
                                    : ['???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'Common'];
                                rarity = rarities[Math.floor(Math.random() * rarities.length)];
                                const remainingUses = nullifiedBoost.uses - 1;
                                if (remainingUses > 0) {
                                    db.run(
                                        `UPDATE activeBoosts SET uses = ? WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                                        [remainingUses, interaction.user.id]
                                    );
                                } else {
                                    db.run(
                                        `DELETE FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                                        [interaction.user.id]
                                    );
                                }
                            } else if (!rarity) {
                                // Multiply all luck boosts together, including MysteriousDice
                                const totalLuckMultiplier = ancientLuckMultiplier * mysteriousLuckMultiplier * mysteriousDiceMultiplier * petBoost?.multiplier || 1;
                                let rarityRoll = Math.random() * 100;
                                if (luminaBoostActive && totalRollsBeforeThisRoll % 10 === 0) rarityRoll /= 5;
                                if (totalLuckMultiplier > 1) {
                                    rarityRoll /= totalLuckMultiplier;
                                }

                                let useRollsLeftBoost = row.rollsLeft > 0;
                                if (boostActive && boostRollsRemaining > 0) {
                                    rarityRoll /= 25;
                                    boostRollsRemaining--;
                                    if (boostRollsRemaining === 0) {
                                        boostActive = 0;
                                        boostRollsRemaining = 0;
                                    }
                                } else if (useRollsLeftBoost) {
                                    rarityRoll /= 2;
                                }

                                if (rarityRoll < 0.0000667 && hasFantasyBook) rarity = 'TRANSCENDENT';
                                else if (rarityRoll < 0.0002667 && hasFantasyBook) rarity = 'ETERNAL'; // +0.0002
                                else if (rarityRoll < 0.0007667 && hasFantasyBook) rarity = 'INFINITE'; // +0.0005
                                else if (rarityRoll < 0.0018777 && hasFantasyBook) rarity = 'CELESTIAL'; // +0.001111
                                else if (rarityRoll < 0.0052107 && hasFantasyBook) rarity = 'ASTRAL'; // +0.003333
                                else if (rarityRoll < 0.0118767 && hasFantasyBook) rarity = '???'; // +0.006666
                                else if (rarityRoll < 0.0318767) rarity = 'EXCLUSIVE'; // +0.02
                                else if (rarityRoll < 0.1318767) rarity = 'MYTHICAL'; // +0.1
                                else if (rarityRoll < 0.5318767) rarity = 'LEGENDARY'; // +0.4
                                else if (rarityRoll < 1.5318767 && hasFantasyBook) rarity = 'OTHERWORLDLY'; // +1
                                else if (rarityRoll < 7.5318767) rarity = 'EPIC'; // +6
                                else if (rarityRoll < 17.5318767) rarity = 'RARE'; // +10
                                else if (rarityRoll < 42.5318767) rarity = 'UNCOMMON'; // +25
                                else rarity = 'Common'; // Remaining 57.4681233%
                            }

                            // Boost charge logic
                            if (!boostActive) {
                                boostCharge++;
                                if (boostCharge >= 1000) {
                                    boostCharge = 0;
                                    boostActive = 1;
                                    boostRollsRemaining = 250;
                                }
                            } else {
                                boostRollsRemaining--;
                                if (boostRollsRemaining <= 0) {
                                    boostActive = 0;
                                    boostRollsRemaining = 0;
                                }
                            }

                            // Update pity counters
                            const updatedPities = {
                                pityTranscendent: rarity === 'TRANSCENDENT' ? 0 : (hasFantasyBook ? row.pityTranscendent + 1 : row.pityTranscendent),
                                pityEternal: rarity === 'ETERNAL' ? 0 : (hasFantasyBook ? row.pityEternal + 1 : row.pityEternal),
                                pityInfinite: rarity === 'INFINITE' ? 0 : (hasFantasyBook ? row.pityInfinite + 1 : row.pityInfinite),
                                pityCelestial: rarity === 'CELESTIAL' ? 0 : (hasFantasyBook ? row.pityCelestial + 1 : row.pityCelestial),
                                pityAstral: rarity === 'ASTRAL' ? 0 : (hasFantasyBook ? row.pityAstral + 1 : row.pityAstral)
                            };

                            // Astral+ quest
                            const astralPlusRarities = ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
                            if (astralPlusRarities.includes(rarity)) {
                                incrementWeeklyAstral(interaction.user.id);
                            }

                            // Select a Fumo based on rarity
                            const filteredFumos = fumos.filter(f => f.name.includes(rarity));
                            if (!filteredFumos.length) {
                                await interaction.reply({ content: 'No Fumo found for this rarity. Please contact the developer.', ephemeral: true });
                                return;
                            }
                            const fumo = filteredFumos[Math.floor(Math.random() * filteredFumos.length)];

                            // Shiny/AlterGolden logic
                            const shinyMark = Math.min(1, row.luck || 0);
                            const shinyChance = 0.01 + (shinyMark * 0.02);
                            const alGChance = 0.00001 + (shinyMark * 0.00009);
                            const isAlterGolden = Math.random() < alGChance;
                            const isShiny = !isAlterGolden && Math.random() < shinyChance;
                            let fumoName = fumo.name;
                            if (isAlterGolden) {
                                fumoName += '[🌟alG]';
                                incrementWeeklyShiny(interaction.user.id);
                            } else if (isShiny) {
                                fumoName += '[✨SHINY]';
                                incrementWeeklyShiny(interaction.user.id);
                            }

                            // Update DB
                            await new Promise(resolve => {
                                db.run(
                                    `UPDATE userCoins SET
                                        coins = coins - 100,
                                        totalRolls = totalRolls + 1,
                                        boostCharge = ?,
                                        boostActive = ?,
                                        boostRollsRemaining = ?,
                                        pityTranscendent = ?,
                                        pityEternal = ?,
                                        pityInfinite = ?,
                                        pityCelestial = ?,
                                        pityAstral = ?,
                                        rollsLeft = CASE WHEN rollsLeft >= 1 THEN rollsLeft - 1 ELSE 0 END
                                    WHERE userId = ?`,
                                    [
                                        boostCharge,
                                        boostActive,
                                        boostRollsRemaining,
                                        updatedPities.pityTranscendent,
                                        updatedPities.pityEternal,
                                        updatedPities.pityInfinite,
                                        updatedPities.pityCelestial,
                                        updatedPities.pityAstral,
                                        interaction.user.id
                                    ],
                                    () => resolve()
                                );
                            });

                            // Daily quest
                            db.run(
                                `INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date)
                                VALUES (?, 'roll_1000', 1, 0, DATE('now'))
                                ON CONFLICT(userId, questId, date) DO UPDATE SET 
                                    progress = MIN(progress + 1, 1000),
                                    completed = CASE WHEN progress + 1 >= 1000 THEN 1 ELSE completed END`,
                                [interaction.user.id]
                            );

                            // Weekly quest
                            const weekId = getWeekIdentifier();
                            db.run(
                                `INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
                                VALUES (?, 'roll_15000', 1, 0, ?)
                                ON CONFLICT(userId, questId, week) DO UPDATE SET 
                                    progress = MIN(progress + 1, 15000),
                                    completed = CASE WHEN progress + 1 >= 15000 THEN 1 ELSE completed END`,
                                [interaction.user.id, weekId]
                            );

                            // Achievement
                            db.run(
                                `INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
                                VALUES (?, 'total_rolls', 1, 0)
                                ON CONFLICT(userId, achievementId) DO UPDATE SET 
                                    progress = progress + 1`,
                                [interaction.user.id]
                            );

                            // Add fumo to inventory
                            await runAsync(`INSERT INTO userInventory (userId, fumoName) VALUES (?, ?)`, [interaction.user.id, fumoName]);

                            // Animation and embed
                            const hasRareFumo = ['MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'].includes(rarity);
                            const embed = new EmbedBuilder()
                                .setTitle('🎁 Unleashing an extraordinary surprise box just for you... ✨-golden-✨')
                                .setImage('https://img.freepik.com/premium-photo/gift-box-present-isolated_63260-45.jpg')
                                .setColor(hasRareFumo ? '#FFD700' : '#FFFFFF');

                            await interaction.reply({ embeds: [embed], ephemeral: true });

                            setTimeout(async () => {
                                embed.setImage('https://www.shutterstock.com/image-illustration/open-gift-box-3d-illustration-260nw-275157815.jpg');
                                await interaction.editReply({ embeds: [embed] });

                                setTimeout(async () => {
                                    embed.setImage(fumo.picture);
                                    if (hasRareFumo) embed.setTitle("💫 A radiant sparkle amidst the ordinary...?");
                                    await interaction.editReply({ embeds: [embed] });

                                    setTimeout(async () => {
                                        embed.setTitle(`🎉 Congrats! You've unlocked a ${fumo.name.replace(/\(.*?\)/g, '').trim()} from alterGolden's Common Fumo Box.`)
                                            .setColor(hasRareFumo ? '#FFD700' : '#FFFFFF');
                                        await interaction.editReply({ embeds: [embed] });
                                    }, 2000);
                                }, 2000);
                            }, 2000);

                        } catch (err) {
                            console.error('buy1fumo error:', err);
                            try {
                                await interaction.reply({ content: 'An error occurred while processing your fumo roll.', ephemeral: true });
                            } catch { }
                        }
                    })();
                } else if (action === 'buy10fumos') {
                    (async () => {
                        try {
                            const row = await new Promise((resolve, reject) => {
                                db.get(
                                    `SELECT coins, boostCharge, boostActive, boostRollsRemaining, pityTranscendent, pityEternal, pityInfinite, pityCelestial, pityAstral, rollsLeft, totalRolls, hasFantasyBook, luck FROM userCoins WHERE userId = ?`,
                                    [interaction.user.id],
                                    (err, row) => err ? reject(err) : resolve(row)
                                );
                            });

                            if (!row || row.coins < 1000) {
                                await interaction.reply({ content: 'You do not have enough coins to buy 10 fumos unfortunately.', ephemeral: true });
                                return;
                            }

                            const hasFantasyBook = !!row.hasFantasyBook;
                            let { boostCharge, boostActive, boostRollsRemaining } = row;
                            let { pityTranscendent, pityEternal, pityInfinite, pityCelestial, pityAstral } = row;
                            let currentRolls = row.totalRolls;
                            const shinyMarkValue = Math.min(1, row.luck || 0);

                            const rarityPriority = [
                                'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY',
                                'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???',
                                'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
                            ];
                            const isRarer = (r1, r2) => rarityPriority.indexOf(r1?.toUpperCase() ?? '') > rarityPriority.indexOf(r2?.toUpperCase() ?? '');

                            const luminaBoostActive = await new Promise((resolve) => {
                                db.get(`SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`, [interaction.user.id], (err, row) => {
                                    resolve(!!row);
                                });
                            });

                            const ancientLuckMultiplier = await new Promise((resolve) => {
                                db.get(
                                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`,
                                    [interaction.user.id],
                                    (err, row) => {
                                        resolve(row && row.expiresAt > Date.now() ? row.multiplier : 1);
                                    }
                                );
                            });

                            const mysteriousLuckMultiplier = await new Promise(resolve => {
                                db.get(
                                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`,
                                    [interaction.user.id],
                                    (err, row) => {
                                        if (err) return resolve(1);
                                        resolve(row && row.expiresAt > Date.now() ? row.multiplier : 1);
                                    }
                                );
                            });

                            // Pet boost
                            const petBoost = await new Promise(resolve => {
                                db.get(
                                    `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'luck'`,
                                    [interaction.user.id],
                                    (err, row) => {
                                        if (err) {
                                            console.error('DB error fetching pet boost:', err);
                                            return resolve(1);
                                        }
                                        // console.log('🐰 Pet boost row:', row);
                                        resolve(row ? row.multiplier : 1);
                                    }
                                );
                            });
                            // console.log('🎲 Final Pet Boost Multiplier:', petBoost);

                            // MysteriousDice boost (per-hour random multiplier)
                            let mysteriousDiceMultiplier = 1;
                            const mysteriousDiceBoost = await new Promise(resolve => {
                                db.get(
                                    `SELECT multiplier, expiresAt, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
                                    [interaction.user.id],
                                    (err, row) => resolve(row)
                                );
                            });

                            if (mysteriousDiceBoost && mysteriousDiceBoost.expiresAt > Date.now()) {
                                let perHourArr = [];
                                try {
                                    perHourArr = JSON.parse(mysteriousDiceBoost.extra || '[]');
                                } catch {
                                    perHourArr = [];
                                }

                                const now = Date.now();
                                const currentHourTimestamp = now - (now % (60 * 60 * 1000));

                                let currentHour = perHourArr.find(e => e.at === currentHourTimestamp);

                                if (!currentHour) {
                                    function getRandomMultiplier() {
                                        return parseFloat((0.0001 + Math.random() * (10.9999)).toFixed(4));
                                    }

                                    const newMultiplier = getRandomMultiplier();
                                    const newEntry = { at: currentHourTimestamp, multiplier: newMultiplier };

                                    perHourArr.push(newEntry);
                                    if (perHourArr.length > 12) perHourArr = perHourArr.slice(-12);

                                    await new Promise(resolve => {
                                        db.run(
                                            `UPDATE activeBoosts SET multiplier = ?, extra = ? WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
                                            [newMultiplier, JSON.stringify(perHourArr), interaction.user.id],
                                            () => resolve()
                                        );
                                    });

                                    mysteriousDiceMultiplier = newMultiplier;
                                    // console.log(`[MysteriousDice] New multiplier generated for user ${interaction.user.id}: ${newMultiplier}`);
                                } else {
                                    mysteriousDiceMultiplier = currentHour.multiplier;
                                    // console.log(`[MysteriousDice] Existing multiplier used for user ${interaction.user.id}: ${currentHour.multiplier}`);
                                }
                            } else {
                                // console.log(`[MysteriousDice] No active boost for user ${interaction.user.id}`);
                            }

                            let updatedPities = {
                                pityTranscendent,
                                pityEternal,
                                pityInfinite,
                                pityCelestial,
                                pityAstral
                            };

                            const fumosBought = [];
                            let bestFumo = null;

                            for (let i = 0; i < 10; i++) {
                                let rarity = null;

                                // Pity logic
                                if (hasFantasyBook) {
                                    if (row.pityTranscendent >= 1500000) { rarity = 'TRANSCENDENT'; row.pityTranscendent = 0; }
                                    else if (row.pityEternal >= 500000) { rarity = 'ETERNAL'; row.pityEternal = 0; }
                                    else if (row.pityInfinite >= 200000) { rarity = 'INFINITE'; row.pityInfinite = 0; }
                                    else if (row.pityCelestial >= 90000) { rarity = 'CELESTIAL'; row.pityCelestial = 0; }
                                    else if (row.pityAstral >= 30000) { rarity = 'ASTRAL'; row.pityAstral = 0; }
                                }

                                currentRolls++;

                                // Nullified(?) Boost Check – overrides normal rarity math
                                let nullifiedBoost = null;
                                try {
                                    nullifiedBoost = await new Promise((resolve) => {
                                        db.get(
                                            `SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                                            [interaction.user.id],
                                            (err, row) => resolve(row)
                                        );
                                    });
                                } catch { }

                                if (!rarity && nullifiedBoost?.uses > 0) {
                                    const rarities = hasFantasyBook
                                        ? ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON', 'Common']
                                        : ['???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'Common'];
                                    rarity = rarities[Math.floor(Math.random() * rarities.length)];
                                    const remainingUses = nullifiedBoost.uses - 1;
                                    if (remainingUses > 0) {
                                        db.run(
                                            `UPDATE activeBoosts SET uses = ? WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                                            [remainingUses, interaction.user.id]
                                        );
                                    } else {
                                        db.run(
                                            `DELETE FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                                            [interaction.user.id]
                                        );
                                    }
                                } else if (!rarity) {
                                    const totalLuckMultiplier = ancientLuckMultiplier * mysteriousLuckMultiplier * mysteriousDiceMultiplier * petBoost?.multiplier || 1;
                                    let rarityRoll = Math.random() * 100;
                                    if (luminaBoostActive && currentRolls % 10 === 0) rarityRoll /= 5;
                                    if (totalLuckMultiplier > 1) {
                                        rarityRoll /= totalLuckMultiplier;
                                    }

                                    let useRollsLeftBoost = row.rollsLeft > 0;
                                    if (boostActive && boostRollsRemaining > 0) {
                                        rarityRoll /= 25;
                                        boostRollsRemaining--;
                                        if (boostRollsRemaining === 0) {
                                            boostActive = 0;
                                            boostRollsRemaining = 0;
                                        }
                                    } else if (useRollsLeftBoost) {
                                        rarityRoll /= 2;
                                    }

                                    // Balanced rarity rates for 10x rolls (keep TRANSCENDENT at 1.5m pity)
                                    if (rarityRoll < 0.0000667 && hasFantasyBook) rarity = 'TRANSCENDENT';
                                    else if (rarityRoll < 0.0002667 && hasFantasyBook) rarity = 'ETERNAL'; // +0.0002
                                    else if (rarityRoll < 0.0007667 && hasFantasyBook) rarity = 'INFINITE'; // +0.0005
                                    else if (rarityRoll < 0.0018777 && hasFantasyBook) rarity = 'CELESTIAL'; // +0.001111
                                    else if (rarityRoll < 0.0052107 && hasFantasyBook) rarity = 'ASTRAL'; // +0.003333
                                    else if (rarityRoll < 0.0118767 && hasFantasyBook) rarity = '???'; // +0.006666
                                    else if (rarityRoll < 0.0318767) rarity = 'EXCLUSIVE'; // +0.02
                                    else if (rarityRoll < 0.1318767) rarity = 'MYTHICAL'; // +0.1
                                    else if (rarityRoll < 0.5318767) rarity = 'LEGENDARY'; // +0.4
                                    else if (rarityRoll < 1.5318767 && hasFantasyBook) rarity = 'OTHERWORLDLY'; // +1
                                    else if (rarityRoll < 7.5318767) rarity = 'EPIC'; // +6
                                    else if (rarityRoll < 17.5318767) rarity = 'RARE'; // +10
                                    else if (rarityRoll < 42.5318767) rarity = 'UNCOMMON'; // +25
                                    else rarity = 'Common'; // Remaining 57.4681233%

                                    // Astral+ quest
                                    const astralPlus = ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
                                    if (astralPlus.includes(rarity)) incrementWeeklyAstral(interaction.user.id);
                                }

                                // Update pity counters
                                if (hasFantasyBook) {
                                    updatedPities.pityTranscendent = rarity === 'TRANSCENDENT' ? 0 : updatedPities.pityTranscendent + 1;
                                    updatedPities.pityEternal = rarity === 'ETERNAL' ? 0 : updatedPities.pityEternal + 1;
                                    updatedPities.pityInfinite = rarity === 'INFINITE' ? 0 : updatedPities.pityInfinite + 1;
                                    updatedPities.pityCelestial = rarity === 'CELESTIAL' ? 0 : updatedPities.pityCelestial + 1;
                                    updatedPities.pityAstral = rarity === 'ASTRAL' ? 0 : updatedPities.pityAstral + 1;
                                }

                                // Boost charge logic
                                if (!boostActive) {
                                    boostCharge++;
                                    if (boostCharge >= 1000) {
                                        boostCharge = 0;
                                        boostActive = 1;
                                        boostRollsRemaining = 250;
                                    }
                                } else {
                                    boostRollsRemaining--;
                                    if (boostRollsRemaining <= 0) {
                                        boostActive = 0;
                                        boostRollsRemaining = 0;
                                    }
                                }

                                // Get fumo
                                const matchingFumos = fumos.filter(f => f.name.includes(rarity));
                                if (matchingFumos.length > 0) {
                                    const fumo = matchingFumos[Math.floor(Math.random() * matchingFumos.length)];
                                    const shinyChance = 0.01 + shinyMarkValue * 0.02;
                                    const alGChance = 0.00001 + shinyMarkValue * 0.00009;
                                    const isAlterGolden = Math.random() < alGChance;
                                    const isShiny = !isAlterGolden && Math.random() < shinyChance;
                                    let fumoName = fumo.name;
                                    if (isAlterGolden) {
                                        fumoName += '[🌟alG]';
                                        incrementWeeklyShiny(interaction.user.id);
                                    } else if (isShiny) {
                                        fumoName += '[✨SHINY]';
                                        incrementWeeklyShiny(interaction.user.id);
                                    }
                                    fumosBought.push({ ...fumo, rarity, name: fumoName });
                                    await runAsync(`INSERT INTO userInventory (userId, fumoName) VALUES (?, ?)`, [interaction.user.id, fumoName]);
                                    if (!bestFumo || isRarer(rarity, bestFumo.rarity)) {
                                        bestFumo = { ...fumo, rarity, name: fumoName };
                                    }
                                }
                            }

                            // Save user data
                            await new Promise((resolve) => {
                                db.run(
                                    `UPDATE userCoins SET
                                        coins = coins - 1000,
                                        totalRolls = totalRolls + 10,
                                        boostCharge = ?,
                                        boostActive = ?,
                                        boostRollsRemaining = ?,
                                        pityTranscendent = ?,
                                        pityEternal = ?,
                                        pityInfinite = ?,
                                        pityCelestial = ?,
                                        pityAstral = ?,
                                        rollsLeft = CASE WHEN rollsLeft >= 10 THEN rollsLeft - 10 ELSE 0 END
                                    WHERE userId = ?`,
                                    [
                                        boostCharge,
                                        boostActive,
                                        boostRollsRemaining,
                                        updatedPities.pityTranscendent,
                                        updatedPities.pityEternal,
                                        updatedPities.pityInfinite,
                                        updatedPities.pityCelestial,
                                        updatedPities.pityAstral,
                                        interaction.user.id
                                    ],
                                    () => resolve()
                                );
                            });

                            // Update daily quest: roll_1000
                            db.run(
                                `INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date)
                                VALUES (?, 'roll_1000', 1, 0, DATE('now'))
                                ON CONFLICT(userId, questId, date) DO UPDATE SET 
                                    progress = MIN(progress + 10, 1000),
                                    completed = CASE WHEN progress + 10 >= 1000 THEN 1 ELSE completed END`,
                                [interaction.user.id]
                            );

                            // Update weekly quest: roll_15000
                            const weekId = getWeekIdentifier();
                            db.run(
                                `INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
                                VALUES (?, 'roll_15000', 1, 0, ?)
                                ON CONFLICT(userId, questId, week) DO UPDATE SET 
                                    progress = MIN(progress + 10, 15000),
                                    completed = CASE WHEN progress + 10 >= 15000 THEN 1 ELSE completed END`,
                                [interaction.user.id, weekId],
                                function (err) {
                                    if (err) {
                                        console.error("❌ Weekly quest DB error (crateGacha):", err.message);
                                    }
                                }
                            );

                            // Update achievement progress
                            db.run(
                                `INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
                                VALUES (?, 'total_rolls', 10, 0)
                                ON CONFLICT(userId, achievementId) DO UPDATE SET 
                                    progress = progress + 10`,
                                [interaction.user.id]
                            );

                            // Show result (basic animation flow for 10 rolls)
                            const embed = new EmbedBuilder()
                                .setTitle('🌟💫 Opening the Golden Fumo Box... 💫🌟')
                                .setImage('https://5.imimg.com/data5/HH/SX/MY-6137980/golden-gift-box-500x500.jpg')
                                .setColor(Colors.Yellow);

                            await interaction.reply({ embeds: [embed], ephemeral: true });
                            setTimeout(async () => {
                                embed.setImage('https://img.freepik.com/premium-vector/open-golden-gift-box-gold-confetti_302982-1365.jpg');
                                await interaction.editReply({ embeds: [embed] });

                                setTimeout(async () => {
                                    const isRareCutscene = isRarer(bestFumo.rarity, 'LEGENDARY');
                                    embed.setTitle(isRareCutscene ? "✨ A golden box shines brighter than usual... ✨" : '🎁 The golden box reveals...')
                                        .setImage(isRareCutscene
                                            ? 'https://previews.123rf.com/images/baks/baks1412/baks141200006/34220442-christmas-background-with-open-golden-box-with-stars-and-confetti.jpg'
                                            : 'https://media.istockphoto.com/id/865744872/photo/golden-glowing-box-of-light.jpg?s=612x612&w=0&k=20&c=14_RsYdmgE8OLV70elc3sLQRuuK3i_IYA0M5aGPiTtA=');

                                    await interaction.editReply({ embeds: [embed] });

                                    setTimeout(async () => {
                                        const fumoCounts = fumosBought.reduce((acc, fumo) => {
                                            if (!acc[fumo.rarity]) acc[fumo.rarity] = {};
                                            acc[fumo.rarity][fumo.name] = (acc[fumo.rarity][fumo.name] || 0) + 1;
                                            return acc;
                                        }, {});

                                        const sortedRarities = Object.keys(fumoCounts).sort((a, b) =>
                                            rarityPriority.indexOf(b.toUpperCase()) - rarityPriority.indexOf(a.toUpperCase())
                                        );

                                        const fumoList = sortedRarities.map(rarity => {
                                            const entries = Object.entries(fumoCounts[rarity]).map(([name, count]) => {
                                                const cleanName = name.replace(/\(.*?\)/g, '').trim();
                                                return `${cleanName.trim()} (x${count})`;
                                            });
                                            const totalCount = entries.reduce((sum, _, i) => sum + Object.values(fumoCounts[rarity])[i], 0);
                                            return `**${rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase()} (x${totalCount}):**\n${entries.join(', ')}`;
                                        }).join('\n\n');

                                        embed.setTitle('🎉 You’ve unlocked 10 fumos!')
                                            .setDescription(`${fumoList}\n\n**Best fumo:** ${bestFumo.name}`)
                                            .setColor(isRareCutscene ? Colors.Gold : Colors.White);

                                        await interaction.editReply({ embeds: [embed] });
                                    }, 2000);
                                }, 2000);
                            }, 2000);
                        } catch (err) {
                            console.error('buy10fumos error:', err);
                            try {
                                await interaction.reply({ content: 'An error occurred while processing your 10 fumo rolls.', ephemeral: true });
                            } catch { }
                        }
                    })();
                } else if (action === 'buy100fumos') {
                    const bestFumo = await handleBuy50Fumos(interaction, db, fumos);

                    if (!bestFumo) {
                        // Error or not enough coins already handled in handleBuy50Fumos
                        return;
                    }

                    // Animation and result display
                    const rarityPriority = [
                        'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY',
                        'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???',
                        'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
                    ];

                    const isRarer = (r1, r2) =>
                        rarityPriority.indexOf(r1?.toUpperCase() ?? '') > rarityPriority.indexOf(r2?.toUpperCase() ?? '');

                    const embed = new EmbedBuilder()
                        .setTitle('🔮 Unleashing the magic of this colossal treasure chest...')
                        .setImage('https://media.istockphoto.com/id/610990634/photo/businessman-looking-at-huge-present.jpg?s=612x612&w=0&k=20&c=blc7bjEGc8pbmfYKnmqw7g5jp32rMTDAI5y5W9Z4ZOo=');

                    await interaction.reply({ embeds: [embed], ephemeral: true });

                    setTimeout(async () => {
                        embed.setImage('https://media.istockphoto.com/id/494384016/photo/young-men-coming-up-from-a-big-box.jpg?s=612x612&w=0&k=20&c=LkQMIrS-CNqNARtscgK-lmijIt8ZyT4UFB9fqigSM1I=');
                        await interaction.editReply({ embeds: [embed] });

                        setTimeout(async () => {
                            const isRareCutscene = isRarer(bestFumo.rarity, 'LEGENDARY');

                            embed.setTitle(
                                isRareCutscene
                                    ? "✨ A sudden burst of radiance... An extraordinary spectacle indeed! ✨"
                                    : "🎁 The treasure chest reveals..."
                            ).setImage(
                                isRareCutscene
                                    ? 'https://media.istockphoto.com/id/579738794/vector/open-gift-box-with-shiny-light.jpg?s=1024x1024&w=is&k=20&c=573dQ-4CGCMwQcKaha-zbqCBJrgj7cAf_cwNeBSHyoI='
                                    : 'https://boxfox.com.au/cdn/shop/products/Large_gift_box_-_Red_lid_open_2DC_2623_800x.jpg?v=1556515906'
                            );

                            await interaction.editReply({ embeds: [embed] });

                            setTimeout(async () => {
                                // Fetch the last 100 fumos for this user (to avoid race conditions)
                                const inventoryRows = await new Promise((resolve, reject) => {
                                    db.all(
                                        `SELECT fumoName FROM userInventory WHERE userId = ? ORDER BY rowid DESC LIMIT 50`,
                                        [interaction.user.id],
                                        (err, rows) => {
                                            if (err) return resolve([]);
                                            resolve(rows);
                                        }
                                    );
                                });

                                // Map fumoName to rarity and clean up names
                                const fumoCounts = {};
                                for (const row of inventoryRows) {
                                    const name = row.fumoName;
                                    // Try to extract rarity from name (fallback to 'Common')
                                    let rarity = 'Common';
                                    for (const r of rarityPriority) {
                                        if (name.toUpperCase().includes(r)) {
                                            rarity = r;
                                            break;
                                        }
                                    }
                                    if (!fumoCounts[rarity]) fumoCounts[rarity] = {};
                                    fumoCounts[rarity][name] = (fumoCounts[rarity][name] || 0) + 1;
                                }

                                // Sort rarities by your priority array
                                const sortedRarities = Object.keys(fumoCounts).sort((a, b) =>
                                    rarityPriority.indexOf(b.toUpperCase()) - rarityPriority.indexOf(a.toUpperCase())
                                );

                                // Build the display list
                                const fumoList = sortedRarities.map(rarity => {
                                    const entries = Object.entries(fumoCounts[rarity]);
                                    const cleanedEntries = entries.map(([name, count]) => {
                                        const cleanName = name.replace(/\(.*?\)/g, '').trim();
                                        return `${cleanName.trim()} (x${count})`;
                                    });
                                    const totalCount = entries.reduce((sum, [, count]) => sum + count, 0);
                                    return `**${rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase()} (x${totalCount}):**\n${cleanedEntries.join(', ')}`;
                                }).join('\n\n');

                                embed.setTitle('🎉 You’ve unlocked 100 fumos!')
                                    .setDescription(`${fumoList}\n\n**Best fumo:** ${bestFumo.name}`)
                                    .setColor(isRareCutscene ? '#FFD700' : '#FFFFFF');

                                await interaction.editReply({ embeds: [embed] });
                            }, 2000);
                        }, 2000);
                    }, 2000);
                } else if (action === 'autoRoll50') {
                    // Show choice embed with two buttons: Proceed AutoRoll, Enable AutoSell
                    const choiceRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`autoRollProceed_${userId}`)
                            .setLabel('Proceed AutoRoll')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`autoRollAutoSell_${userId}`)
                            .setLabel('Enable AutoSell')
                            .setStyle(ButtonStyle.Success)
                    );

                    const choiceEmbed = new EmbedBuilder()
                        .setTitle('🤖 Choose Your Auto Roll Mode')
                        .setDescription('How would you like to proceed?\n\n- **Proceed AutoRoll**: Just auto roll as usual.\n- **Enable AutoSell**: Auto roll and automatically sell all fumos below EXCLUSIVE rarity for coins.\nWARNING: THIS WILL AUTOMATICALLY USE ALL OF YOUR BOOST!')
                        .setColor(0x3366ff);

                    await interaction.reply({
                        embeds: [choiceEmbed],
                        components: [choiceRow],
                        ephemeral: true
                    });

                    const filter = i =>
                        i.user.id === userId &&
                        (i.customId === `autoRollProceed_${userId}` || i.customId === `autoRollAutoSell_${userId}`);

                    const collector = interaction.channel.createMessageComponentCollector({
                        filter,
                        time: 15000,
                        max: 1
                    });

                    collector.on('collect', async i => {
                        await i.deferUpdate();
                        let autoSell = false;
                        if (i.customId.startsWith('autoRollAutoSell_')) {
                            autoSell = true;
                            console.log('[AutoSell] Enable AutoSell button clicked by', userId);
                        } else {
                            console.log('[AutoRoll] Proceed AutoRoll button clicked by', userId);
                        }

                        // Stacking logic: base 60s, TimeBlessing halves to 30s, TimeClock halves again to 15s
                        let rollInterval = 60000;
                        const now = Date.now();

                        // Check TimeBlessing
                        let timeBlessingBoost = await new Promise(resolve => {
                            db.get(
                                `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`,
                                [userId, now],
                                (err, row) => resolve(row)
                            );
                        });
                        if (timeBlessingBoost && timeBlessingBoost.multiplier === 0.5) {
                            rollInterval = 30000;
                        }

                        // Check TimeClock(M) and stack if present (summonSpeed type, source TimeClock)
                        let timeclockBoost = await new Promise(resolve => {
                            db.get(
                                `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`,
                                [userId, now],
                                (err, row) => resolve(row)
                            );
                        });
                        if (timeclockBoost && timeclockBoost.multiplier === 2) {
                            rollInterval = Math.floor(rollInterval / 2);
                        }

                        if (autoRollMap.has(userId)) {
                            await i.followUp({
                                embeds: [
                                    {
                                        title: '⏳ Auto Roll Already Running',
                                        description: 'You already have Auto Roll active!',
                                        color: 0xffcc00
                                    }
                                ],
                                ephemeral: true
                            });
                            return;
                        }

                        let bestFumo = null;
                        let rollCount = 0;
                        let intervalId = null;
                        let stopped = false;

                        const coinRewards = {
                            'Common': 20, 'UNCOMMON': 50, 'RARE': 70, 'EPIC': 150,
                            'OTHERWORLDLY': 300, 'LEGENDARY': 1300, 'MYTHICAL': 7000,
                        };

                        async function autoRollLoop() {
                            if (stopped) return;
                            rollCount++;

                            // Re-calculate interval with stacking logic each roll
                            let newInterval = 60000;
                            const now = Date.now();

                            let timeBlessingBoost = await new Promise(resolve => {
                                db.get(
                                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`,
                                    [userId, now],
                                    (err, row) => resolve(row)
                                );
                            });
                            if (timeBlessingBoost && timeBlessingBoost.multiplier === 0.5) {
                                newInterval = 30000;
                            }

                            // Check TimeClock(M) (summonSpeed type, source TimeClock)
                            let timeclockBoost = await new Promise(resolve => {
                                db.get(
                                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`,
                                    [userId, now],
                                    (err, row) => resolve(row)
                                );
                            });
                            if (timeclockBoost && timeclockBoost.multiplier === 2) {
                                newInterval = Math.floor(newInterval / 2);
                            }

                            try {
                                const result = await handleBuy50Fumos(interaction, db, fumos, {
                                    userId,
                                    auto: true
                                });

                                const current = autoRollMap.get(userId);
                                const timeStr = new Date().toLocaleString();
                                const specialRarities = ['EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];

                                if (current) {
                                    current.rollCount = rollCount;

                                    if (!current.bestFumo || compareFumos(result, current.bestFumo) > 0) {
                                        current.bestFumo = result;
                                        current.bestFumoAt = timeStr;
                                        current.bestFumoRoll = rollCount;
                                    }

                                    if (specialRarities.includes(result.rarity)) {
                                        current.specialFumoCount++;
                                        if (!current.specialFumoFirstAt) {
                                            current.specialFumoFirstAt = timeStr;
                                            current.specialFumoFirstRoll = rollCount;
                                        }

                                        if (current.bestFumo && compareFumos(result, current.bestFumo) < 0) {
                                            current.lowerSpecialFumos.push({
                                                name: result.name,
                                                rarity: result.rarity,
                                                roll: rollCount,
                                                time: timeStr
                                            });
                                        }
                                    }
                                }

                                // Always auto sell if enabled, regardless of interval/boost
                                if (autoSell) {
                                    // Fetch last 100 fumos below EXCLUSIVE rarity
                                    const inventoryRows = await new Promise((resolve) => {
                                        db.all(
                                            `SELECT id, fumoName, quantity FROM userInventory WHERE userId = ? ORDER BY id DESC LIMIT 100`,
                                            [userId],
                                            (_, rows) => resolve(rows || [])
                                        );
                                    });

                                    let totalSell = 0;
                                    let toDelete = [];
                                    let toUpdate = [];

                                    // Track sell count per rarity for logging
                                    const sellCountByRarity = {
                                        'Common': 0,
                                        'UNCOMMON': 0,
                                        'RARE': 0,
                                        'EPIC': 0,
                                        'OTHERWORLDLY': 0,
                                        'LEGENDARY': 0,
                                        'MYTHICAL': 0
                                    };

                                    for (const row of inventoryRows) {
                                        // Determine rarity (exact match, not substring)
                                        let rarity = null;
                                        for (const r of Object.keys(coinRewards)) {
                                            // Use regex to match whole word (case-insensitive)
                                            const regex = new RegExp(`\\b${r}\\b`, 'i');
                                            if (regex.test(row.fumoName)) {
                                                rarity = r;
                                                break;
                                            }
                                        }
                                        // Only sell if rarity is exactly one of the listed ones
                                        if (
                                            rarity &&
                                            ['Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL']
                                                .includes(rarity)
                                        ) {
                                            let value = coinRewards[rarity] || 0;
                                            if (row.fumoName.includes('[🌟alG]')) value *= 150;
                                            else if (row.fumoName.includes('[✨SHINY]')) value *= 2;
                                            totalSell += value;

                                            // Count for log
                                            sellCountByRarity[rarity] = (sellCountByRarity[rarity] || 0) + 1;

                                            // Use your provided logic for quantity
                                            if (row.quantity > 1) {
                                                toUpdate.push({ id: row.id, quantity: row.quantity - 1 });
                                            } else {
                                                toDelete.push(row.id);
                                            }
                                        }
                                    }

                                    // Apply DB updates
                                    for (const upd of toUpdate) {
                                        await new Promise((resolve, reject) => {
                                            db.run(`UPDATE userInventory SET quantity = ? WHERE userId = ? AND id = ?`, [upd.quantity, userId, upd.id], err => err ? reject(err) : resolve());
                                        });
                                    }
                                    if (toDelete.length > 0) {
                                        await new Promise((resolve, reject) => {
                                            db.run(
                                                `DELETE FROM userInventory WHERE userId = ? AND id IN (${toDelete.map(() => '?').join(',')})`,
                                                [userId, ...toDelete],
                                                err => err ? reject(err) : resolve()
                                            );
                                        });
                                    }
                                    if (totalSell > 0) {
                                        await new Promise(resolve => {
                                            db.run(
                                                `UPDATE userCoins SET coins = coins + ? WHERE userId = ?`,
                                                [totalSell, userId],
                                                () => resolve()
                                            );
                                        });
                                    }
                                }

                            } catch (error) {
                                console.error(`Auto Roll failed at roll #${rollCount}:`, error);
                            }

                            if (!stopped) {
                                intervalId = setTimeout(autoRollLoop, newInterval);
                                autoRollMap.get(userId).intervalId = intervalId;
                            }
                        }

                        autoRollMap.set(userId, {
                            intervalId: null,
                            bestFumo,
                            rollCount,
                            bestFumoAt: null,
                            bestFumoRoll: null,
                            specialFumoCount: 0,
                            specialFumoFirstAt: null,
                            specialFumoFirstRoll: null,
                            lowerSpecialFumos: []
                        });

                        autoRollLoop();

                        // Get boost again before displaying the message to show accurate interval
                        let displayInterval = 60000;
                        let timeBlessingBoostDisplay = await new Promise(resolve => {
                            db.get(
                                `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`,
                                [userId, Date.now()],
                                (err, row) => resolve(row)
                            );
                        });
                        if (timeBlessingBoostDisplay && timeBlessingBoostDisplay.multiplier === 0.5) {
                            displayInterval = 30000;
                        }
                        // Updated: TimeClock(M) now uses type = 'summonSpeed' and source = 'TimeClock'
                        let timeclockBoostDisplay = await new Promise(resolve => {
                            db.get(
                                `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`,
                                [userId, Date.now()],
                                (err, row) => resolve(row)
                            );
                        });
                        if (timeclockBoostDisplay && timeclockBoostDisplay.multiplier === 2) {
                            displayInterval = Math.floor(displayInterval / 2);
                        }

                        await i.followUp({
                            embeds: [
                                {
                                    title: autoSell ? '🤖 Auto Roll + AutoSell Started!' : '🎰 Auto Roll Started!',
                                    description: autoSell
                                        ? `Rolling every **${displayInterval / 1000} seconds** (auto-adjusts for boosts, including TimeClock(L) and stacks with TimeBlessing) and **auto-selling all fumos below EXCLUSIVE for coins**.\nUse \`Stop Roll 100\` to cancel the process.`
                                        : `Rolling every **${displayInterval / 1000} seconds** (auto-adjusts for boosts, including TimeClock(L) and stacks with TimeBlessing) indefinitely...\nUse \`Stop Roll 100\` to cancel the process.`,
                                    color: 0x3366ff,
                                    footer: {
                                        text: 'This will continue until you stop it manually.'
                                    }
                                }
                            ],
                            ephemeral: true
                        });
                    });
                } else if (action === 'stopAuto50') {
                    const auto = autoRollMap.get(userId);
                    if (!auto) {
                        const embed = new EmbedBuilder()
                            .setTitle('❌ No Active Auto Roll')
                            .setDescription('You currently don’t have an auto-roll running.')
                            .setColor(0xff4444)
                            .setFooter({ text: 'Auto Roll Status' })
                            .setTimestamp();
                        if (interaction.deferred || interaction.replied) {
                            await interaction.followUp({ embeds: [embed], ephemeral: true });
                        } else {
                            await interaction.reply({ embeds: [embed], ephemeral: true });
                        }
                        return;
                    }

                    if (auto.intervalId) clearTimeout(auto.intervalId);
                    autoRollMap.delete(userId);

                    // Prepare best fumo text
                    let bestFumoText = 'None (N/A)';
                    let bestFumoImage = null;
                    if (auto.bestFumo) {
                        // Check for [✨SHINY] or [🌟alG] in name
                        let suffix = '';
                        if (auto.bestFumo.name.includes('[🌟alG]')) suffix = ' [🌟alG]';
                        else if (auto.bestFumo.name.includes('[✨SHINY]')) suffix = ' [✨SHINY]';
                        bestFumoText = `🏆 Best Fumo: ${auto.bestFumo.name.replace(/\s*\(.*?\)$/, '').replace(/\[.*?\]/g, '').trim()} (${auto.bestFumo.rarity})${suffix}\n` +
                            (auto.bestFumoRoll && auto.bestFumoAt
                                ? `🕒 Obtained at roll #${auto.bestFumoRoll}, at ${auto.bestFumoAt}`
                                : '');
                        bestFumoImage = auto.bestFumo.picture || null;
                    }

                    // Prepare summary of rare fumos
                    const rarityOrder = [
                        'TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???'
                    ];
                    const fumoSummary = {};
                    (auto.lowerSpecialFumos || []).forEach(f => {
                        if (!fumoSummary[f.rarity]) fumoSummary[f.rarity] = [];
                        fumoSummary[f.rarity].push(f);
                    });
                    if (auto.bestFumo && rarityOrder.includes(auto.bestFumo.rarity)) {
                        if (!fumoSummary[auto.bestFumo.rarity]) fumoSummary[auto.bestFumo.rarity] = [];
                        // Add bestFumo if not already in the list
                        if (!fumoSummary[auto.bestFumo.rarity].some(x => x.roll === auto.bestFumoRoll)) {
                            fumoSummary[auto.bestFumo.rarity].push({
                                name: auto.bestFumo.name,
                                rarity: auto.bestFumo.rarity,
                                roll: auto.bestFumoRoll,
                                time: auto.bestFumoAt
                            });
                        }
                    }

                    // Count shiny and alG for each rarity
                    const shinyAlGMap = {};
                    for (const rarity of rarityOrder) {
                        shinyAlGMap[rarity] = { shiny: [], alg: [] };
                        const arr = fumoSummary[rarity] || [];
                        arr.forEach(f => {
                            if (f.name && f.name.includes('[🌟alG]')) {
                                shinyAlGMap[rarity].alg.push(f);
                            } else if (f.name && f.name.includes('[✨SHINY]')) {
                                shinyAlGMap[rarity].shiny.push(f);
                            }
                        });
                        // Also check bestFumo for shiny/alG
                        if (auto.bestFumo && auto.bestFumo.rarity === rarity) {
                            if (auto.bestFumo.name.includes('[🌟alG]')) {
                                if (!shinyAlGMap[rarity].alg.some(x => x.roll === auto.bestFumoRoll)) {
                                    shinyAlGMap[rarity].alg.push({
                                        name: auto.bestFumo.name,
                                        rarity: auto.bestFumo.rarity,
                                        roll: auto.bestFumoRoll,
                                        time: auto.bestFumoAt
                                    });
                                }
                            } else if (auto.bestFumo.name.includes('[✨SHINY]')) {
                                if (!shinyAlGMap[rarity].shiny.some(x => x.roll === auto.bestFumoRoll)) {
                                    shinyAlGMap[rarity].shiny.push({
                                        name: auto.bestFumo.name,
                                        rarity: auto.bestFumo.rarity,
                                        roll: auto.bestFumoRoll,
                                        time: auto.bestFumoAt
                                    });
                                }
                            }
                        }
                    }

                    let summaryLines = [];
                    for (const rarity of rarityOrder) {
                        const arr = fumoSummary[rarity] || [];
                        let line = `**${rarity}:** `;
                        if (arr.length === 0) {
                            line += 'None';
                        } else {
                            line += `\`${arr.length}\``;
                            // Show first roll/time
                            arr.sort((a, b) => a.roll - b.roll);
                            const first = arr[0];
                            line += ` (first: #${first.roll}, ${first.time})`;
                        }
                        // Add shiny/alG if any
                        const shinyArr = shinyAlGMap[rarity].shiny;
                        const algArr = shinyAlGMap[rarity].alg;
                        let extras = [];
                        if (shinyArr.length > 0) {
                            const shinyFirst = shinyArr[0];
                            extras.push(`Shiny: ${shinyArr.length} (obtained at #${shinyFirst.roll}, ${shinyFirst.time})`);
                        }
                        if (algArr.length > 0) {
                            const algFirst = algArr[0];
                            extras.push(`alG: ${algArr.length} (obtained at #${algFirst.roll}, ${algFirst.time})`);
                        }
                        if (extras.length > 0) {
                            line += ', ' + extras.join(', ');
                        }
                        summaryLines.push(line);
                    }

                    // Calculate coins spent
                    const coinsSpent = auto.rollCount * 10000;

                    // Add some stats and emoji for fun
                    const statsField = [
                        `🎲 **Total Rolls:** \`${auto.rollCount * 100}\``,
                        `💸 **Coins Spent:** \`${coinsSpent.toLocaleString()}\``,
                        bestFumoText,
                        `\n__**Special Fumos Obtained:**__\n${summaryLines.join('\n')}`
                    ].join('\n\n');

                    const embed = new EmbedBuilder()
                        .setTitle('🛑 Auto Roll Stopped!')
                        .setDescription(
                            'Your auto roll was stopped manually.\n\n' +
                            'Here’s a summary of your session:'
                        )
                        .addFields([
                            { name: '📊 Results', value: statsField }
                        ])
                        .setColor(0xcc3300)
                        .setFooter({ text: 'Auto Roll Summary', iconURL: interaction.user.displayAvatarURL() })
                        .setTimestamp();

                    if (bestFumoImage) {
                        embed.setImage(bestFumoImage);
                    }

                    // Add a little confetti if they got a rare
                    if (auto.bestFumo && ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???'].includes(auto.bestFumo.rarity)) {
                        embed.setThumbnail('https://cdn.pixabay.com/photo/2017/01/31/13/14/confetti-2024631_1280.png');
                    }

                    // Add a button to quickly restart auto roll
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`autoRoll50_${userId}`)
                            .setLabel('🔄 Restart Auto Roll')
                            .setStyle(ButtonStyle.Success)
                    );

                    if (interaction.deferred || interaction.replied) {
                        await interaction.followUp({
                            embeds: [embed],
                            components: [row],
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            embeds: [embed],
                            components: [row],
                            ephemeral: true
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Interaction error:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: 'An error occurred.', ephemeral: true });
            } else {
                await interaction.reply({ content: 'An error occurred.', ephemeral: true });
            }
        }
    });
};