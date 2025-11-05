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
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
client.setMaxListeners(150);
function formatNumber(number) {
    return number.toLocaleString();
}
const { getWeekIdentifier, incrementWeeklyShiny } = require('../Utils/weekly'); // adjust path
/**
 * Event Gacha Command Handler
 * Improvements:
 * 1. Fixed async/await usage in DB operations (removed db.serialize, used async/await properly)
 * 2. Improved error handling for all DB calls and user feedback
 * 3. Refactored function/variable names for clarity and consistency
 * 4. Added a feature: User can check their current pity counters and roll window status with `.eventgacha status`
 * 5. Optimized roll window logic and reduced duplicate DB queries
 * 6. Added logging for critical errors
 */

module.exports = (client, Efumos) => {
    const ROLL_LIMIT = 50000; // 50,000 rolls
    const WINDOW_DURATION = 30 * 60 * 1000; // 30 minutes

    // Helper: Check if roll window expired
    function isWindowExpired(lastRollTime) {
        if (!lastRollTime) return true;
        return Date.now() - lastRollTime > WINDOW_DURATION;
    }

    // Helper: Get time left until roll window resets
    function getRollResetTime(lastRollTime) {
        const now = Date.now();
        const windowStart = lastRollTime ? Math.floor(lastRollTime / WINDOW_DURATION) * WINDOW_DURATION : now;
        const nextReset = windowStart + WINDOW_DURATION;
        const timeLeft = Math.max(0, nextReset - now);
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        return `${minutes}m ${seconds}s remaining`;
    }

    // Event timer
    const eventStartTime = new Date();
    const eventDuration = 11 * 24 * 60 * 60 * 1000;
    const eventEndTime = new Date(eventStartTime.getTime() + eventDuration);
    function isEventActive() {
        return Date.now() < eventEndTime.getTime();
    }
    function getRemainingTime() {
        const remaining = eventEndTime.getTime() - Date.now();
        if (remaining <= 0) return 'Event has ended';
        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        return `${days}d ${hours}h ${minutes}m remaining`;
    }

    const cooldowns = new Map();

    // Utility: Promisified DB get
    function dbGet(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
    // Utility: Promisified DB run
    function dbRun(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    // Feature: Status command for pity/roll window
    client.on('messageCreate', async message => {
        if (
            message.content.trim().toLowerCase() === '.eventgacha status' ||
            message.content.trim().toLowerCase() === '.eg status'
        ) {
            try {
                const userId = message.author.id;
                const userData = await dbGet(
                    `SELECT gems, lastRollTime, rollsInCurrentWindow, rollsSinceLastMythical, rollsSinceLastQuestionMark, luck, rollsLeft FROM userCoins WHERE userId = ?`,
                    [userId]
                );
                if (!userData) return message.reply('No data found. Use `.eventgacha` to start!');

                // Luck/boost footer and chance calculation
                let ancientLuckMultiplier = 1;
                let mysteriousLuckMultiplier = 1;
                let rollsLeft = userData.rollsLeft || 0;
                let isBoostActive = false;
                let ancientNoteLines = [];
                try {
                    const ancient = await dbGet(
                        `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`,
                        [userId]
                    );
                    if (ancient && ancient.expiresAt > Date.now()) {
                        ancientLuckMultiplier = ancient.multiplier;
                        ancientNoteLines.push(`🎇 AncientRelic active! Luck boosted by ${ancientLuckMultiplier}×`);
                        isBoostActive = true;
                    }
                    const mysterious = await dbGet(
                        `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`,
                        [userId]
                    );
                    if (mysterious && mysterious.expiresAt > Date.now()) {
                        mysteriousLuckMultiplier = mysterious.multiplier;
                        ancientNoteLines.push(`🧊 MysteriousCube active! Luck boosted by ${mysteriousLuckMultiplier.toFixed(2)}×`);
                        isBoostActive = true;
                    }
                } catch { }
                // Lumina effect (every 10th roll)
                let luminaBoostActive = false;
                try {
                    luminaBoostActive = await new Promise((resolve, reject) => {
                        db.get(`SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`, [userId], (err, row) => {
                            if (err) reject(err);
                            resolve(!!row);
                        });
                    });
                } catch { }
                if (luminaBoostActive) {
                    ancientNoteLines.push(`🌟 Lumina active! Every 10th roll grants 5× Luck`);
                }
                if (rollsLeft > 0 && !isBoostActive) {
                    ancientNoteLines.push(`✨ Bonus Roll active! Luck boosted by 2×`);
                }
                const ancientNote = ancientNoteLines.length > 0 ? ancientNoteLines.join('\n') : 'No luck boost applied...';

                // Calculate chances based on boosts
                const luck = userData.luck || 0;
                const totalLuckMultiplier = ancientLuckMultiplier * mysteriousLuckMultiplier * Math.max(1, luck) * (rollsLeft > 0 && !isBoostActive ? 2 : 1);
                // Mythical: 1 in 1,000 (0.1%), ???: 1 in 10,000 (0.01%), TRANSCENDENT: 1 in 1,000,000 (0.0001%)
                const baseChances = {
                    EPIC: 100 - (13.5 + 0.1 + 0.01 + 0.0000066667),
                    LEGENDARY: 13.5,
                    MYTHICAL: 0.1,
                    '???': 0.01,
                    TRANSCENDENT: 0.0001 // 1 in 1,000,000
                };
                const mythicalChance = Math.min(baseChances.MYTHICAL * totalLuckMultiplier, 5);
                const questionChance = Math.min(baseChances['???'] * totalLuckMultiplier, 0.5);
                // TRANSCENDENT is always fixed, but for display, show as "???%"
                const transcendentChance = baseChances.TRANSCENDENT;
                const legendaryChance = Math.max(baseChances.LEGENDARY - (mythicalChance + questionChance + transcendentChance), 0.01);
                // epicChance is not used, so we remove this line for cleanliness

                // Fixed pity values
                const mythicalPity = 1000;
                const questionPityDisplay = "0 / ???";

                const embed = new EmbedBuilder()
                    .setTitle('🎲 Event Gacha Status')
                    .addFields(
                        { name: 'Gems', value: formatNumber(userData.gems), inline: true },
                        { name: 'Rolls in Window', value: `${userData.rollsInCurrentWindow || 0} / ${ROLL_LIMIT}`, inline: true },
                        { name: 'Window Reset', value: getRollResetTime(userData.lastRollTime), inline: true },
                        { name: 'Pity', value: `🟥 Mythical: ${userData.rollsSinceLastMythical || 0} / ${mythicalPity} ❓ ???: ${userData.rollsSinceLastQuestionMark || 0} / 10000`, inline: false },
                        { name: 'Event Time Left', value: getRemainingTime(), inline: false },
                        {
                            name: '🎲 Your Current Chances', value:
                                `🔮 EPIC - ${epicChance.toFixed(4)}%\n` +
                                `🟨 LEGENDARY - ${legendaryChance.toFixed(4)}%\n` +
                                `🟥 MYTHICAL - ${mythicalChance.toFixed(4)}%\n` +
                                `❓ ??? - ${questionChance.toFixed(5)}%\n` +
                                `👑 TRANSCENDENT - ???%`
                        }
                    )
                    .setColor('#0099ff')
                    .setFooter({ text: ancientNote });
                return message.reply({ embeds: [embed] });
            } catch (err) {
                console.error('Status command error:', err);
                return message.reply('Error fetching your status.');
            }
        }
    });

    // Main eventgacha command
    client.on('messageCreate', async message => {
        // Only trigger if the message is exactly ".eventgacha" or ".eg" (case-insensitive, ignoring whitespace)
        const content = message.content.trim().toLowerCase();
        if (content === '.eventgacha' || content === '.eg') {
            // (status command is handled above)

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

            if (!isEventActive()) {
                return message.reply('The banner has closed. Please wait for further updates.');
            }

            let userData;
            try {
                userData = await dbGet(
                    `SELECT gems, lastRollTime, rollsInCurrentWindow, hasFantasyBook, luck, rollsLeft, rollsSinceLastMythical, rollsSinceLastQuestionMark FROM userCoins WHERE userId = ?`,
                    [message.author.id]
                );
            } catch (err) {
                console.error('DB error:', err);
                return message.reply('Database error. Please try again later.');
            }
            if (!userData) return message.reply('You do not have any gems.');
            if (!userData.hasFantasyBook) {
                return message.reply('You are not allowed to use this command until you enable **FantasyBook(M)**.');
            }

            // Roll window logic
            let rollsInCurrentWindow = userData.rollsInCurrentWindow || 0;
            let lastRollTime = userData.lastRollTime || 0;
            if (isWindowExpired(lastRollTime)) {
                rollsInCurrentWindow = 0;
                lastRollTime = Date.now();
                try {
                    await dbRun(
                        `UPDATE userCoins SET rollsInCurrentWindow = 0, lastRollTime = ? WHERE userId = ?`,
                        [lastRollTime, message.author.id]
                    );
                } catch (err) {
                    console.error('DB error:', err);
                }
            }

            if (rollsInCurrentWindow >= ROLL_LIMIT) {
                return message.reply(`You have reached your roll limit. Please wait ${getRollResetTime(lastRollTime)} before rolling again.`);
            }

            // Define baseChances and luck before using them
            const baseChances = {
                EPIC: 100 - (13.5 + 0.1 + 0.01 + 0.0001),
                LEGENDARY: 13.5,
                MYTHICAL: 0.1,
                '???': 0.01,
                TRANSCENDENT: 0.0001 // 1 in 1,000,000
            };
            const luck = userData.luck || 0;
            let ancientLuckMultiplier = 1;
            let mysteriousLuckMultiplier = 1;
            let mysteriousDiceMultiplier = 1;
            let petLuckMultiplier = 1;
            let rollsLeft = userData.rollsLeft || 0;
            let isBoostActive = false;
            let ancientNoteLines = [];

            try {
                // Ancient Relic Boost
                const ancient = await dbGet(
                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`,
                    [message.author.id]
                );
                if (ancient && ancient.expiresAt > Date.now()) {
                    ancientLuckMultiplier = ancient.multiplier;
                    ancientNoteLines.push(`🎇 AncientRelic active! Luck boosted by ${ancientLuckMultiplier}×`);
                    isBoostActive = true;
                }

                // Mysterious Cube Boost
                const mysterious = await dbGet(
                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`,
                    [message.author.id]
                );
                if (mysterious && mysterious.expiresAt > Date.now()) {
                    mysteriousLuckMultiplier = mysterious.multiplier;
                    ancientNoteLines.push(`🧊 MysteriousCube active! Luck boosted by ${mysteriousLuckMultiplier.toFixed(2)}×`);
                    isBoostActive = true;
                }

                // Mysterious Dice Boost (hourly)
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
                        ancientNoteLines.push(`🎲 MysteriousDice active! Luck boosted by ${newMultiplier}×`);
                    } else {
                        mysteriousDiceMultiplier = currentHour.multiplier;
                        ancientNoteLines.push(`🎲 MysteriousDice active! Luck boosted by ${currentHour.multiplier}×`);
                    }
                }

                // 🐰 Pet Boost(s)
                const petBoostRows = await new Promise(resolve => {
                    db.all(
                        `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source LIKE 'Pet:%'`,
                        [message.author.id],
                        (err, rows) => {
                            if (err) {
                                console.error('Error loading pet boosts:', err.message);
                                return resolve([]);
                            }
                            resolve(rows);
                        }
                    );
                });

                if (petBoostRows.length > 0) {
                    petLuckMultiplier = petBoostRows.reduce((acc, row) => acc * row.multiplier, 1);
                    ancientNoteLines.push(`🐰 Pet boost active! Luck boosted by ${petLuckMultiplier.toFixed(4)}×`);
                    isBoostActive = true;
                }

            } catch (err) {
                console.error('Error calculating boosts:', err);
            }

            // Lumina effect (every 10th roll)
            let luminaBoostActive = false;
            try {
                luminaBoostActive = await new Promise((resolve, reject) => {
                    db.get(`SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`, [message.author.id], (err, row) => {
                        if (err) reject(err);
                        resolve(!!row);
                    });
                });
            } catch { }

            if (luminaBoostActive) {
                ancientNoteLines.push(`🌟 Lumina active! Every 10th roll grants 5× Luck`);
            }

            if (rollsLeft > 0 && !isBoostActive) {
                ancientNoteLines.push(`✨ Bonus Roll active! Luck boosted by 2×`);
            }

            const ancientNote = ancientNoteLines.length > 0 ? ancientNoteLines.join('\n') : 'No luck boost applied...';

            const totalLuckMultiplier = ancientLuckMultiplier * mysteriousLuckMultiplier * mysteriousDiceMultiplier * petLuckMultiplier * Math.max(1, luck) * (rollsLeft > 0 && !isBoostActive ? 2 : 1);
            const mythicalChance = Math.min(baseChances.MYTHICAL * totalLuckMultiplier, 5);
            const questionChance = Math.min(baseChances['???'] * totalLuckMultiplier, 0.5);
            // TRANSCENDENT is always fixed, but for display, show as "???%"
            const transcendentChance = baseChances.TRANSCENDENT;
            const legendaryChance = Math.max(baseChances.LEGENDARY - (mythicalChance + questionChance + transcendentChance), 0.01);
            const epicChance = 100 - (legendaryChance + mythicalChance + questionChance + transcendentChance);

            // Fixed pity values
            const mythicalPity = 1000;
            const questionPity = 10000;

            const embed = new EmbedBuilder()
                .setTitle('🎲 Jujutsu Kaisen turned into Marketable Fumo?!?! 🎲')
                .setDescription(`💎 You're sitting on a treasure of ${formatNumber(userData.gems)} gems. Unleash the urge to gamble, each summon is just 100 gems for 1 marketable-fumo.`)
                .addFields(
                    {
                        name: '🌟 Rarity Chances 🌟', value:
                            'Step right up and test your luck! Here are the odds for each rarity (with your luck applied):\n' +
                            `🔮 EPIC - ${epicChance.toFixed(4)}%\n` +
                            `🟨 LEGENDARY - ${legendaryChance.toFixed(4)}%\n` +
                            `🟥 MYTHICAL - ${mythicalChance.toFixed(4)}%\n` +
                            `❓ ??? - ${questionChance.toFixed(5)}%\n` +
                            `👑 TRANSCENDENT - ???%`
                    },
                    { name: '⏳ Time Left', value: getRemainingTime(), inline: true },
                    { name: '🔄 Roll Limit', value: `${rollsInCurrentWindow} / ${ROLL_LIMIT} rolls. ${getRollResetTime(lastRollTime)} until reset.`, inline: true },
                    { name: '🟥 Mythical Pity', value: `${userData.rollsSinceLastMythical || 0} / ${mythicalPity}`, inline: false },
                    { name: '❓ ??? Pity', value: `${userData.rollsSinceLastQuestionMark || 0} / ???`, inline: false }
                )
                .setColor('#0099ff')
                .setImage('https://cdn141.picsart.com/322879240181201.jpg')
                .setFooter({ text: ancientNote });

            const rowButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`eventbuy1fumo_${message.author.id}`)
                        .setLabel('Summon 1')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(rollsInCurrentWindow >= ROLL_LIMIT),
                    new ButtonBuilder()
                        .setCustomId(`eventbuy10fumos_${message.author.id}`)
                        .setLabel('Summon 10')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(rollsInCurrentWindow >= ROLL_LIMIT),
                    new ButtonBuilder()
                        .setCustomId(`eventbuy100fumos_${message.author.id}`)
                        .setLabel('Summon 100')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(rollsInCurrentWindow >= ROLL_LIMIT)
                );

            message.channel.send({ embeds: [embed], components: [rowButtons] });
        }
    });

    // Button interactions
    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;
        const [baseId, buttonOwnerId] = interaction.customId.split('_');
        const interactingUserId = interaction.user.id;

        // Only allow event-related buttons
        if (!['eventbuy1fumo', 'eventbuy10fumos', 'eventbuy100fumos', 'continue1', 'continue10', 'continue100'].includes(baseId)) return;

        // Only allow the button's owner to use it
        if (interactingUserId !== buttonOwnerId) {
            await interaction.reply({
                content: "You can't use someone else's summon buttons. Use `/eventgacha` to start your own!",
                ephemeral: true
            });
            return;
        }

        // Cooldown logic
        const now = Date.now();
        let baseCooldown = 3000;
        let cooldownMultiplier = 1;

        try {
            // TimeBlessing boost (multiplies cooldown speed, so divides cooldown)
            const timeBlessing = await dbGet(
                `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'farmingCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`,
                [interactingUserId, now]
            );
            if (timeBlessing && timeBlessing.multiplier) {
                cooldownMultiplier *= timeBlessing.multiplier;
            }

            // TimeClock(L) boost (multiplies cooldown speed, so divides cooldown)
            const timeClock = await dbGet(
                `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`,
                [interactingUserId, now]
            );
            if (timeClock && timeClock.multiplier) {
                cooldownMultiplier *= timeClock.multiplier;
            }
        } catch (err) {
            // Ignore boost errors, fallback to default cooldown
        }

        // Both boosts stack multiplicatively on speed, so divide baseCooldown by total multiplier
        let cooldownDuration = baseCooldown / cooldownMultiplier;

        let lastUsed = cooldowns.get(interactingUserId) || 0;
        if (now - lastUsed < cooldownDuration) {
            const timeLeft = ((cooldownDuration - (now - lastUsed)) / 1000).toFixed(1);
            await interaction.reply({
                content: `🕒 Please wait ${timeLeft}s before clicking again.`,
                ephemeral: true,
            });
            return;
        }
        cooldowns.set(interactingUserId, now);

        if (!isEventActive()) {
            await interaction.reply('The banner has closed. Please wait for further updates.');
            return;
        }

        // Fetch user data
        let userData;
        try {
            userData = await dbGet(
                `SELECT gems, lastRollTime, rollsInCurrentWindow, luck, rollsLeft, rollsSinceLastMythical, rollsSinceLastQuestionMark FROM userCoins WHERE userId = ?`,
                [interactingUserId]
            );
        } catch (err) {
            console.error('DB error:', err);
            await interaction.reply('Database error. Please try again later.');
            return;
        }
        if (!userData) {
            await interaction.reply('User data not found. Please try again later.');
            return;
        }

        // Roll window logic
        let rollsInCurrentWindow = userData.rollsInCurrentWindow || 0;
        let lastRollTime = userData.lastRollTime || 0;
        if (isWindowExpired(lastRollTime)) {
            rollsInCurrentWindow = 0;
            lastRollTime = Date.now();
            try {
                await dbRun(
                    `UPDATE userCoins SET rollsInCurrentWindow = 0, lastRollTime = ? WHERE userId = ?`,
                    [lastRollTime, interactingUserId]
                );
            } catch (err) {
                console.error('DB error:', err);
            }
        }
        if (rollsInCurrentWindow >= ROLL_LIMIT) {
            await interaction.reply(`You have reached your roll limit. Please wait ${getRollResetTime(lastRollTime)} before rolling again.`);
            return;
        }

        // Helper: Get full user data for summoning
        async function getUserFullData(userId) {
            try {
                return await dbGet(
                    `SELECT gems, luckRarity, rollsLeft, rollsSinceLastMythical, rollsSinceLastQuestionMark, totalRolls, luck FROM userCoins WHERE userId = ?`,
                    [userId]
                );
            } catch (err) {
                console.error('DB error:', err);
                return null;
            }
        }

        // Helper: Update user data after summon
        async function updateUserAfterSummon(userId, numSummons, currentTime, newMythical, newQuestion) {
            try {
                await dbRun(
                    `
                    UPDATE userCoins 
                    SET 
                        gems = gems - ?,
                        totalRolls = totalRolls + ?,
                        rollsInCurrentWindow = rollsInCurrentWindow + ?,
                        lastRollTime = ?,
                        rollsLeft = CASE WHEN rollsLeft > 0 THEN rollsLeft - ? ELSE 0 END,
                        luckRarity = CASE WHEN rollsLeft <= 1 THEN 'NORMAL' ELSE luckRarity END,
                        rollsSinceLastMythical = ?,
                        rollsSinceLastQuestionMark = ?
                    WHERE userId = ?`,
                    [
                        100 * numSummons, numSummons, numSummons, currentTime, numSummons,
                        newMythical,
                        newQuestion,
                        userId
                    ]
                );
            } catch (err) {
                console.error('DB error:', err);
            }
        }

        // Helper: Select a random fumo by rarity
        function selectFumo(rarity) {
            const filtered = Efumos.filter(f => f.rarity === rarity);
            return filtered.length > 0 ? filtered[Math.floor(Math.random() * filtered.length)] : null;
        }

        // Summon logic
        async function performSummon(userId, numSummons) {
            const user = await getUserFullData(userId);
            if (!user || user.gems < 100 * numSummons) {
                return { success: false, message: `Oops! It seems like you need more gems to unlock ${numSummons} fumos.` };
            }

            // Boosts
            let luminaBoostActive = false;
            let ancientLuckMultiplier = 1;
            let mysteriousLuckMultiplier = 1;
            let mysteriousDiceMultiplier = 1;
            let nullifiedBoost = null;
            let boostText = [];
            let rollsLeft = user.rollsLeft || 0;
            let isBoostActive = false;
            let petLuckMultiplier = 1;

            try {
                const lumina = await dbGet(
                    `SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`,
                    [userId]
                );
                luminaBoostActive = !!lumina;
                if (luminaBoostActive) boostText.push('Lumina');

                const ancient = await dbGet(
                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`,
                    [userId]
                );
                if (ancient && ancient.expiresAt > Date.now()) {
                    ancientLuckMultiplier = ancient.multiplier;
                    boostText.push(`AncientRelic x${ancient.multiplier}`);
                    isBoostActive = true;
                }

                const mysterious = await dbGet(
                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`,
                    [userId]
                );
                if (mysterious && mysterious.expiresAt > Date.now()) {
                    mysteriousLuckMultiplier = mysterious.multiplier;
                    boostText.push(`MysteriousCube x${mysterious.multiplier}`);
                    isBoostActive = true;
                }

                // MysteriousDice boost (per-hour random multiplier)
                const mysteriousDiceBoost = await new Promise(resolve => {
                    db.get(
                        `SELECT multiplier, expiresAt, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
                        [userId],
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
                                [newMultiplier, JSON.stringify(perHourArr), userId],
                                () => resolve()
                            );
                        });

                        mysteriousDiceMultiplier = newMultiplier;
                        boostText.push(`MysteriousDice x${newMultiplier}`);
                    } else {
                        mysteriousDiceMultiplier = currentHour.multiplier;
                        boostText.push(`MysteriousDice x${currentHour.multiplier}`);
                    }
                }

                const petBoost = await dbGet(
                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'Pet'`,
                    [userId]
                );
                if (petBoost && petBoost.expiresAt > Date.now()) {
                    petLuckMultiplier = petBoost.multiplier;
                    boostText.push(`Pet x${petLuckMultiplier}`);
                    isBoostActive = true;
                }

                // Nullified Boost
                nullifiedBoost = await dbGet(
                    `SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                    [userId]
                );
                if (nullifiedBoost) boostText.push('Nullified');
            } catch (err) {
                // Ignore boost errors
            }

            if (rollsLeft > 0 && !isBoostActive) {
                boostText.push('Bonus Roll x2');
            }

            let fumoList = [];
            let currentMythical = user.rollsSinceLastMythical || 0;
            let currentQuestion = user.rollsSinceLastQuestionMark || 0;

            // Custom fixed chances
            const luck = user.luck || 0;
            const baseChances = {
                EPIC: 100 - (13.5 + 0.1 + 0.01 + 0.0001),
                LEGENDARY: 13.5,
                MYTHICAL: 0.1,
                '???': 0.01,
                TRANSCENDENT: 0.0001 // 1 in 1,000,000
            };
            const totalLuckMultiplier =
                ancientLuckMultiplier *
                mysteriousLuckMultiplier *
                mysteriousDiceMultiplier *
                petLuckMultiplier *
                Math.max(1, luck) *
                (rollsLeft > 0 && !isBoostActive ? 2 : 1);
            const mythicalChance = Math.min(baseChances.MYTHICAL * totalLuckMultiplier, 5);
            const questionChance = Math.min(baseChances['???'] * totalLuckMultiplier, 0.5);
            // TRANSCENDENT is always fixed, not affected by luck
            const transcendentChance = baseChances.TRANSCENDENT;
            const legendaryChance = Math.max(baseChances.LEGENDARY - (mythicalChance + questionChance + transcendentChance), 0.01);
            // Fixed pity values
            const mythicalPity = 1000;
            const questionPity = 10000;

            for (let i = 0; i < numSummons; i++) {
                let rarity;
                // Nullified(?) Boost
                if (nullifiedBoost?.uses > 0) {
                    const rarities = ['EPIC', 'LEGENDARY', 'MYTHICAL', '???', 'TRANSCENDENT'];
                    rarity = rarities[Math.floor(Math.random() * rarities.length)];
                    // Decrement or remove boost
                    try {
                        if (nullifiedBoost.uses > 1) {
                            await dbRun(
                                `UPDATE activeBoosts SET uses = ? WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                                [nullifiedBoost.uses - 1, userId]
                            );
                            nullifiedBoost.uses--;
                        } else {
                            await dbRun(
                                `DELETE FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                                [userId]
                            );
                            nullifiedBoost = null;
                        }
                    } catch (err) {
                        // Ignore
                    }
                } else {
                    // Pity logic
                    if (currentQuestion >= questionPity) {
                        rarity = '???';
                        currentQuestion = 0;
                        currentMythical = 0; // Reset both pities on ??? pull
                    } else if (currentMythical >= mythicalPity) {
                        rarity = 'MYTHICAL';
                        currentMythical = 0;
                        currentQuestion = 0; // Reset both pities on MYTHICAL pull
                    } else {
                        // Boost logic
                        let rarityRoll = Math.random() * 100;
                        if (luminaBoostActive && (user.totalRolls + i + 1) % 10 === 0) {
                            rarityRoll /= 5;
                        }
                        // Rarity order: EPIC -> LEGENDARY -> MYTHICAL -> ??? -> TRANSCENDENT
                        if (rarityRoll < transcendentChance) rarity = 'TRANSCENDENT';
                        else if (rarityRoll < questionChance + transcendentChance) rarity = '???';
                        else if (rarityRoll < mythicalChance + questionChance + transcendentChance) rarity = 'MYTHICAL';
                        else if (rarityRoll < legendaryChance + mythicalChance + questionChance + transcendentChance) rarity = 'LEGENDARY';
                        else rarity = 'EPIC';

                        // Reset pity if MYTHICAL or ??? is pulled
                        if (rarity === 'MYTHICAL' || rarity === '???') {
                            currentMythical = 0;
                            currentQuestion = 0;
                        } else {
                            currentMythical++;
                            currentQuestion++;
                        }
                    }
                }
                const fumo = selectFumo(rarity);
                if (fumo) {
                    // Shiny/AlterGolden logic
                    const shinyMark = Math.min(1, user.luck || 0);
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
                    try {
                        await dbRun(
                            `INSERT INTO userInventory (userId, fumoName) VALUES (?, ?)`,
                            [userId, fumoName]
                        );
                    } catch (err) {
                        // Ignore inventory insert error
                    }
                    fumoList.push({
                        name: fumoName,
                        rarity: rarity,
                        picture: fumo.picture
                    });
                }
            }

            // Update user after summon
            await updateUserAfterSummon(
                userId,
                numSummons,
                Date.now(),
                currentMythical,
                currentQuestion
            );

            // Daily/weekly quest progress
            try {
                await dbRun(
                    `
                INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date)
                VALUES (?, 'roll_1000', ?, 0, DATE('now'))
                ON CONFLICT(userId, questId, date) DO UPDATE SET 
                progress = MIN(progress + ?, 1000),
                completed = CASE WHEN progress + ? >= 1000 THEN 1 ELSE completed END
                `,
                    [userId, numSummons, numSummons, numSummons]
                );
                const weekId = getWeekIdentifier();
                await dbRun(
                    `
                INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
                VALUES (?, 'roll_15000', ?, 0, ?)
                ON CONFLICT(userId, questId, week) DO UPDATE SET 
                progress = MIN(progress + ?, 15000),
                completed = CASE WHEN progress + ? >= 15000 THEN 1 ELSE completed END
                `,
                    [userId, numSummons, weekId, numSummons, numSummons]
                );
                await dbRun(
                    `
                INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
                VALUES (?, 'total_rolls', ?, 0)
                ON CONFLICT(userId, achievementId) DO UPDATE SET 
                progress = progress + ?
                `,
                    [userId, numSummons, numSummons]
                );
            } catch (err) {
                console.error("❌ Quest/Achievement DB error:", err.message);
            }

            // Luck/boost footer
            let ancientNoteLines = [];
            if (ancientLuckMultiplier > 1) {
                ancientNoteLines.push(`🎇 AncientRelic active! Luck boosted by ${ancientLuckMultiplier}×`);
            }
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
                ancientNoteLines.push(`🎲 MysteriousDice active! Luck boosted by ${mysteriousDiceMultiplier}×`);
            }
            const ancientNote = ancientNoteLines.length > 0 ? ancientNoteLines.join('\n') : 'No luck boost applied...';

            return {
                success: true,
                fumoList,
                rollsSinceLastMythical: currentMythical,
                rollsSinceLastQuestionMark: currentQuestion,
                luck,
                boostText: ancientNote,
                mythicalPity,
                questionPity
            };
        }

        // Handle summon 1 fumo
        if (baseId === 'eventbuy1fumo' || baseId === 'continue1') {
            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ ephemeral: true });
                }
                const result = await performSummon(interactingUserId, 1);
                if (!result.success) {
                    try {
                        await interaction.editReply({ content: result.message, ephemeral: true });
                    } catch (err) {
                        // Ignore unknown interaction error
                    }
                    return;
                }
                const fumo = result.fumoList[0];
                const embed = new EmbedBuilder()
                    .setTitle(`🎉🎊 Woohoo! You've successfully unlocked a fantastic fumo! 🎊🎉`)
                    .setDescription(`You acquired a ${fumo.rarity === 'TRANSCENDENT' ? '👑' : ''}${fumo.name} from the exclusive Event Fumo Crate! 🎊🎉`)
                    .setImage(fumo.picture)
                    .addFields(
                        { name: 'Mythical Pity', value: `${result.rollsSinceLastMythical} / 1000` },
                        { name: '??? Pity', value: `${result.rollsSinceLastQuestionMark} / ???` },
                        { name: '🔄 Roll Limit', value: `${(rollsInCurrentWindow + 1)} / ${ROLL_LIMIT} rolls. ${getRollResetTime(lastRollTime)} until reset.` }
                    )
                    .setFooter({ text: result.boostText });
                const rowButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`continue1_${interactingUserId}`)
                            .setLabel('Continue')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled((rollsInCurrentWindow + 1) >= ROLL_LIMIT)
                    );
                try {
                    await interaction.editReply({ embeds: [embed], components: [rowButtons] });
                } catch (err) {
                    // Ignore unknown interaction error
                }
                return;
            } catch (err) {
                // Ignore unknown interaction error
            }
        }

        // Handle summon 10 fumos
        if (baseId === 'eventbuy10fumos' || baseId === 'continue10') {
            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ ephemeral: true });
                }
                const result = await performSummon(interactingUserId, 10);
                if (!result.success) {
                    try {
                        await interaction.editReply({ content: result.message, ephemeral: true });
                    } catch (err) {
                        // Ignore unknown interaction error
                    }
                    return;
                }
                // Group fumos by rarity
                const rarityOrder = ['EPIC', 'LEGENDARY', 'MYTHICAL', 'TRANSCENDENT', '???'];
                const groupedFumos = result.fumoList.reduce((acc, fumo) => {
                    if (!acc[fumo.rarity]) acc[fumo.rarity] = {};
                    if (!acc[fumo.rarity][fumo.name]) acc[fumo.rarity][fumo.name] = 0;
                    acc[fumo.rarity][fumo.name]++;
                    return acc;
                }, {});
                let description = '';
                for (const rarity of rarityOrder) {
                    const fumoCounts = groupedFumos[rarity];
                    if (!fumoCounts) continue;
                    const total = Object.values(fumoCounts).reduce((sum, count) => sum + count, 0);
                    description += `**${rarity === 'TRANSCENDENT' ? '👑 ' : ''}${rarity} (x${total}):**\n`;
                    for (const [name, count] of Object.entries(fumoCounts)) {
                        description += `- ${name} x${count}\n`;
                    }
                }
                const embed = new EmbedBuilder()
                    .setTitle(`🎉🎊 You've successfully unlocked 10 fantastic fumos from the\nJJK's Fumo Crate! 🎊🎉`)
                    .setDescription(description)
                    .addFields(
                        { name: 'Mythical Pity', value: `${result.rollsSinceLastMythical} / 1000` },
                        { name: '??? Pity', value: `${result.rollsSinceLastQuestionMark} / ???` },
                        { name: '🔄 Roll Limit', value: `${(rollsInCurrentWindow + 10)} / ${ROLL_LIMIT} rolls. ${getRollResetTime(lastRollTime)} until reset.` }
                    )
                    .setFooter({ text: result.boostText });
                const rowButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`continue10_${interactingUserId}`)
                            .setLabel('Continue')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled((rollsInCurrentWindow + 10) >= ROLL_LIMIT)
                    );
                try {
                    await interaction.editReply({ embeds: [embed], components: [rowButtons] });
                } catch (err) {
                    // Ignore unknown interaction error
                }
                return;
            } catch (err) {
                // Ignore unknown interaction error
            }
        }

        // Handle summon 100 fumos
        if (baseId === 'eventbuy100fumos' || baseId === 'continue100') {
            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ ephemeral: true });
                }
                const result = await performSummon(interactingUserId, 100);
                if (!result.success) {
                    try {
                        await interaction.editReply({ content: result.message, ephemeral: true });
                    } catch (err) {
                        // Ignore unknown interaction error
                    }
                    return;
                }
                // Group fumos by rarity
                const rarityOrder = ['EPIC', 'LEGENDARY', 'MYTHICAL', 'TRANSCENDENT', '???'];
                const groupedFumos = result.fumoList.reduce((acc, fumo) => {
                    if (!acc[fumo.rarity]) acc[fumo.rarity] = {};
                    if (!acc[fumo.rarity][fumo.name]) acc[fumo.rarity][fumo.name] = 0;
                    acc[fumo.rarity][fumo.name]++;
                    return acc;
                }, {});
                let description = '';
                for (const rarity of rarityOrder) {
                    const fumoCounts = groupedFumos[rarity];
                    if (!fumoCounts) continue;
                    const total = Object.values(fumoCounts).reduce((sum, count) => sum + count, 0);
                    description += `**${rarity === 'TRANSCENDENT' ? '👑 ' : ''}${rarity} (x${total}):**\n`;
                    for (const [name, count] of Object.entries(fumoCounts)) {
                        description += `- ${name} x${count}\n`;
                    }
                }
                const embed = new EmbedBuilder()
                    .setTitle(`🎉🎊 You've successfully unlocked 100 fantastic fumos from the\nJJK's Fumo Crate! 🎊🎉`)
                    .setDescription(description)
                    .addFields(
                        { name: 'Mythical Pity', value: `${result.rollsSinceLastMythical} / 1000` },
                        { name: '??? Pity', value: `${result.rollsSinceLastQuestionMark} / ???` },
                        { name: '🔄 Roll Limit', value: `${(rollsInCurrentWindow + 100)} / ${ROLL_LIMIT} rolls. ${getRollResetTime(lastRollTime)} until reset.` }
                    )
                    .setFooter({ text: result.boostText });
                const rowButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`continue100_${interactingUserId}`)
                            .setLabel('Continue')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled((rollsInCurrentWindow + 100) >= ROLL_LIMIT)
                    );
                try {
                    await interaction.editReply({ embeds: [embed], components: [rowButtons] });
                } catch (err) {
                    // Ignore unknown interaction error
                }
                return;
            } catch (err) {
                // Ignore unknown interaction error
            }
        }
    });
};
