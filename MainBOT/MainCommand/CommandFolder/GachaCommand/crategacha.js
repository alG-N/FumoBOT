const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    Events
} = require('discord.js');
const db = require('../../Core/Database/dbSetting');
const { maintenance, developerID } = require("../../Configuration/Maintenance/maintenanceConfig");
const { isBanned } = require('../../Administrator/BannedList/BanUtils');
const { getWeekIdentifier, incrementWeeklyShiny, incrementWeeklyAstral } = require('../../Ultility/weekly');

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
// Need to fix logging function to show in the channel ID

const LOG_CHANNEL_ID = '1411386632589807719';
const COOLDOWN_DURATION = 4000;
const COIN_REWARDS = {
    'Common': 20, 'UNCOMMON': 50, 'RARE': 70, 'EPIC': 150,
    'OTHERWORLDLY': 300, 'LEGENDARY': 1300, 'MYTHICAL': 7000,
};
const RARITY_PRIORITY = [
    'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY',
    'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???',
    'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];
const SPECIAL_RARITIES = ['EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
const ASTRAL_PLUS_RARITIES = ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];

const cooldownMap = new Map();
const autoRollMap = new Map();

function formatNumber(number) {
    return number.toLocaleString();
}

function compareFumos(a, b) {
    const rarityA = RARITY_PRIORITY.indexOf(a.rarity?.toUpperCase() ?? 'COMMON');
    const rarityB = RARITY_PRIORITY.indexOf(b.rarity?.toUpperCase() ?? 'COMMON');
    if (rarityA !== rarityB) return rarityA - rarityB;
    return a.name.localeCompare(b.name);
}

function isRarer(r1, r2) {
    return RARITY_PRIORITY.indexOf(r1?.toUpperCase() ?? '') > RARITY_PRIORITY.indexOf(r2?.toUpperCase() ?? '');
}

async function runAsync(sql, params = [], maxRetries = 10, retryDelay = 200) {
    let attempts = 0;
    while (attempts <= maxRetries) {
        try {
            return await new Promise((resolve, reject) => {
                db.run(sql, params, function (err) {
                    if (err) return reject(err);
                    resolve(this);
                });
            });
        } catch (err) {
            if (err.code === "SQLITE_BUSY" && attempts < maxRetries) {
                attempts++;
                const backoff = retryDelay * Math.pow(2, attempts);
                const jitter = Math.floor(Math.random() * 100);
                await new Promise(res => setTimeout(res, backoff + jitter));
            } else {
                throw new Error(`SQL error after ${attempts} attempts: ${err.message}`);
            }
        }
    }
    throw new Error(`Failed after ${maxRetries} retries`);
}

async function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
}

async function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
}

async function dbRun(sql, params = []) {
    return runAsync(sql, params);
}

const DEBUG = process.env.DEBUG === 'true';

function debugLog(category, message, data = null) {
    if (!DEBUG) return;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${category}] ${message}`, data || '');
}

async function logToDiscord(client, message, error = null, logType = 'info') {
    try {
        if (!client?.isReady()) {
            debugLog('DISCORD_LOG', 'Client not ready, skipping log');
            return;
        }

        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!channel?.isTextBased()) {
            debugLog('DISCORD_LOG', 'Channel not found or not text-based');
            return;
        }

        const colors = {
            info: Colors.Blue,
            success: Colors.Green,
            warning: Colors.Yellow,
            error: Colors.Red,
            activity: Colors.Purple
        };

        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            activity: '📊'
        };

        const embed = new EmbedBuilder()
            .setTitle(`${icons[logType]} ${logType.toUpperCase()}`)
            .setDescription(message.slice(0, 2000))
            .setColor(colors[logType] || Colors.Blue)
            .setTimestamp();

        if (error) {
            embed.addFields([
                { name: '⚠️ Error Message', value: `\`\`\`${(error.message || 'Unknown').slice(0, 1000)}\`\`\`` }
            ]);
            if (error.stack) {
                embed.addFields([
                    { name: '📍 Stack Trace', value: `\`\`\`${error.stack.slice(0, 1000)}\`\`\`` }
                ]);
            }
        }

        await channel.send({ embeds: [embed] });
        debugLog('DISCORD_LOG', `Logged to Discord: ${message.slice(0, 50)}`);
    } catch (err) {
        debugLog('DISCORD_LOG', 'Failed to log to Discord', err.message);
    }
}

async function logUserActivity(client, userId, username, action, details = '') {
    const message = `**User Activity**\n` +
        `👤 User: ${username} (\`${userId}\`)\n` +
        `🎯 Action: ${action}\n` +
        `${details ? `📝 Details: ${details}` : ''}`;
    await logToDiscord(client, message, null, 'activity');
}

async function logError(client, context, error, userId = null) {
    const message = `**Error in ${context}**\n` +
        `${userId ? `👤 User ID: \`${userId}\`\n` : ''}` +
        `⏰ Timestamp: ${new Date().toLocaleTimeString()}`;
    await logToDiscord(client, message, error, 'error');
}

async function logSystemEvent(client, event, details = '') {
    const message = `**System Event**\n` +
        `🔔 Event: ${event}\n` +
        `${details ? `📝 Details: ${details}` : ''}`;
    await logToDiscord(client, message, null, 'info');
}

async function getUserBoosts(userId) {
    debugLog('BOOST', `Fetching boosts for user ${userId}`);
    const startTime = Date.now();

    const now = Date.now();
    const [ancientRelic, mysteriousCube, mysteriousDice, lumina, timeBlessing, timeClock, petBoosts, nullified] = await Promise.all([
        dbGet(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`, [userId]),
        dbGet(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`, [userId]),
        dbGet(`SELECT multiplier, expiresAt, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`, [userId]),
        dbGet(`SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`, [userId]),
        dbGet(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`, [userId, now]),
        dbGet(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`, [userId, now]),
        dbAll(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'luck'`, [userId]),
        dbGet(`SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`, [userId])
    ]);

    const ancientLuckMultiplier = (ancientRelic && ancientRelic.expiresAt > now) ? ancientRelic.multiplier : 1;
    const mysteriousLuckMultiplier = (mysteriousCube && mysteriousCube.expiresAt > now) ? mysteriousCube.multiplier : 1;

    let mysteriousDiceMultiplier = 1;
    if (mysteriousDice && mysteriousDice.expiresAt > now) {
        mysteriousDiceMultiplier = await calculateDiceMultiplier(userId, mysteriousDice);
    }

    const petBoost = petBoosts.reduce((acc, row) => acc * row.multiplier, 1);

    const elapsed = Date.now() - startTime;
    debugLog('BOOST', `Boosts fetched in ${elapsed}ms`, {
        ancient: ancientLuckMultiplier,
        cube: mysteriousLuckMultiplier,
        dice: mysteriousDiceMultiplier,
        pet: petBoost
    });

    return {
        ancientLuckMultiplier,
        mysteriousLuckMultiplier,
        mysteriousDiceMultiplier,
        petBoost,
        luminaActive: !!lumina,
        timeBlessingMultiplier: timeBlessing?.multiplier || 1,
        timeClockMultiplier: timeClock?.multiplier || 1,
        nullifiedUses: nullified?.uses || 0
    };
}

async function calculateDiceMultiplier(userId, diceBoost) {
    let perHourArr = [];
    try {
        perHourArr = JSON.parse(diceBoost.extra || '[]');
    } catch {
        perHourArr = [];
    }

    const now = Date.now();
    const currentHourTimestamp = now - (now % (60 * 60 * 1000));
    let currentHour = perHourArr.find(e => e.at === currentHourTimestamp);

    if (!currentHour) {
        const newMultiplier = parseFloat((0.0001 + Math.random() * 10.9999).toFixed(4));
        const newEntry = { at: currentHourTimestamp, multiplier: newMultiplier };

        perHourArr.push(newEntry);
        if (perHourArr.length > 12) perHourArr = perHourArr.slice(-12);

        await dbRun(
            `UPDATE activeBoosts SET multiplier = ?, extra = ? WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
            [newMultiplier, JSON.stringify(perHourArr), userId]
        );

        return newMultiplier;
    }

    return currentHour.multiplier;
}

function calculateTotalLuckMultiplier(boosts, isBoostActive, rollsLeft, totalRolls) {
    let multiplier = boosts.ancientLuckMultiplier *
        boosts.mysteriousLuckMultiplier *
        boosts.mysteriousDiceMultiplier *
        boosts.petBoost;

    if (boosts.luminaActive && totalRolls % 10 === 0) {
        multiplier *= 5;
    }

    if (isBoostActive) {
        multiplier *= 25;
    } else if (rollsLeft > 0) {
        multiplier *= 2;
    }

    return multiplier;
}

async function calculateCooldown(userId) {
    const now = Date.now();
    let cooldown = COOLDOWN_DURATION;

    const [timeBlessing, timeClock] = await Promise.all([
        dbGet(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`, [userId, now]),
        dbGet(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`, [userId, now])
    ]);

    if (timeBlessing?.multiplier) cooldown *= timeBlessing.multiplier;
    if (timeClock?.multiplier === 2) cooldown = Math.floor(cooldown / 2);

    return cooldown;
}

async function calculateRarity(userId, boosts, row, hasFantasyBook) {
    // Check pity first
    if (hasFantasyBook) {
        if (row.pityTranscendent >= 1500000) return { rarity: 'TRANSCENDENT', resetPity: 'pityTranscendent' };
        if (row.pityEternal >= 500000) return { rarity: 'ETERNAL', resetPity: 'pityEternal' };
        if (row.pityInfinite >= 200000) return { rarity: 'INFINITE', resetPity: 'pityInfinite' };
        if (row.pityCelestial >= 90000) return { rarity: 'CELESTIAL', resetPity: 'pityCelestial' };
        if (row.pityAstral >= 30000) return { rarity: 'ASTRAL', resetPity: 'pityAstral' };
    }

    // Check Nullified boost
    if (boosts.nullifiedUses > 0) {
        const rarities = hasFantasyBook
            ? ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON', 'Common']
            : ['???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'Common'];

        const rarity = rarities[Math.floor(Math.random() * rarities.length)];

        const remainingUses = boosts.nullifiedUses - 1;
        if (remainingUses > 0) {
            await dbRun(`UPDATE activeBoosts SET uses = ? WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`, [remainingUses, userId]);
        } else {
            await dbRun(`DELETE FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`, [userId]);
        }

        return { rarity, nullifiedUsed: true };
    }

    // Calculate rarity with luck
    const totalLuck = calculateTotalLuckMultiplier(boosts, row.boostActive && row.boostRollsRemaining > 0, row.rollsLeft, row.totalRolls);
    let rarityRoll = (Math.random() * 100) / totalLuck;

    // Rarity thresholds
    if (rarityRoll < 0.0000667 && hasFantasyBook) return { rarity: 'TRANSCENDENT' };
    if (rarityRoll < 0.0002667 && hasFantasyBook) return { rarity: 'ETERNAL' };
    if (rarityRoll < 0.0007667 && hasFantasyBook) return { rarity: 'INFINITE' };
    if (rarityRoll < 0.0018777 && hasFantasyBook) return { rarity: 'CELESTIAL' };
    if (rarityRoll < 0.0052107 && hasFantasyBook) return { rarity: 'ASTRAL' };
    if (rarityRoll < 0.0118767 && hasFantasyBook) return { rarity: '???' };
    if (rarityRoll < 0.0318767) return { rarity: 'EXCLUSIVE' };
    if (rarityRoll < 0.1318767) return { rarity: 'MYTHICAL' };
    if (rarityRoll < 0.5318767) return { rarity: 'LEGENDARY' };
    if (rarityRoll < 1.5318767 && hasFantasyBook) return { rarity: 'OTHERWORLDLY' };
    if (rarityRoll < 7.5318767) return { rarity: 'EPIC' };
    if (rarityRoll < 17.5318767) return { rarity: 'RARE' };
    if (rarityRoll < 42.5318767) return { rarity: 'UNCOMMON' };
    return { rarity: 'Common' };
}

function updatePityCounters(pities, rarity, hasFantasyBook) {
    if (!hasFantasyBook) return pities;

    return {
        pityTranscendent: rarity === 'TRANSCENDENT' ? 0 : pities.pityTranscendent + 1,
        pityEternal: rarity === 'ETERNAL' ? 0 : pities.pityEternal + 1,
        pityInfinite: rarity === 'INFINITE' ? 0 : pities.pityInfinite + 1,
        pityCelestial: rarity === 'CELESTIAL' ? 0 : pities.pityCelestial + 1,
        pityAstral: rarity === 'ASTRAL' ? 0 : pities.pityAstral + 1
    };
}

function updateBoostCharge(boostCharge, boostActive, boostRollsRemaining) {
    if (!boostActive) {
        boostCharge++;
        if (boostCharge >= 1000) {
            return { boostCharge: 0, boostActive: 1, boostRollsRemaining: 250 };
        }
        return { boostCharge, boostActive: 0, boostRollsRemaining: 0 };
    } else {
        boostRollsRemaining--;
        if (boostRollsRemaining <= 0) {
            return { boostCharge, boostActive: 0, boostRollsRemaining: 0 };
        }
        return { boostCharge, boostActive, boostRollsRemaining };
    }
}

async function selectAndAddFumo(userId, rarity, fumos, luck) {
    const matchingFumos = fumos.filter(f => f.name.includes(rarity));
    if (matchingFumos.length === 0) return null;

    const fumo = matchingFumos[Math.floor(Math.random() * matchingFumos.length)];
    const shinyChance = 0.01 + (Math.min(1, luck || 0) * 0.02);
    const alGChance = 0.00001 + (Math.min(1, luck || 0) * 0.00009);

    const isAlterGolden = Math.random() < alGChance;
    const isShiny = !isAlterGolden && Math.random() < shinyChance;

    let fumoName = fumo.name;
    if (isAlterGolden) {
        fumoName += '[🌟alG]';
        await incrementWeeklyShiny(userId);
    } else if (isShiny) {
        fumoName += '[✨SHINY]';
        await incrementWeeklyShiny(userId);
    }

    await runAsync(`INSERT INTO userInventory (userId, fumoName) VALUES (?, ?)`, [userId, fumoName]);

    return { ...fumo, rarity, name: fumoName };
}

async function updateQuestsAndAchievements(userId, rollCount) {
    const weekId = getWeekIdentifier();

    await Promise.all([
        dbRun(
            `INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date) 
             VALUES (?, 'roll_1000', ?, 0, DATE('now')) 
             ON CONFLICT(userId, questId, date) DO UPDATE SET 
             progress = MIN(progress + ?, 1000), 
             completed = CASE WHEN progress + ? >= 1000 THEN 1 ELSE completed END`,
            [userId, rollCount, rollCount, rollCount]
        ),
        dbRun(
            `INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week) 
             VALUES (?, 'roll_15000', ?, 0, ?) 
             ON CONFLICT(userId, questId, week) DO UPDATE SET 
             progress = MIN(progress + ?, 15000), 
             completed = CASE WHEN progress + ? >= 15000 THEN 1 ELSE completed END`,
            [userId, rollCount, weekId, rollCount, rollCount]
        ),
        dbRun(
            `INSERT INTO achievementProgress (userId, achievementId, progress, claimed) 
             VALUES (?, 'total_rolls', ?, 0) 
             ON CONFLICT(userId, achievementId) DO UPDATE SET progress = progress + ?`,
            [userId, rollCount, rollCount]
        )
    ]);
}

async function handleSingleRoll(interaction, fumos, client) {
    debugLog('ROLL', `Single roll initiated by ${interaction.user.tag}`);
    const startTime = Date.now();

    try {
        const row = await dbGet(
            `SELECT coins, boostCharge, boostActive, boostRollsRemaining, pityTranscendent, pityEternal, 
             pityInfinite, pityCelestial, pityAstral, rollsLeft, totalRolls, hasFantasyBook, luck 
             FROM userCoins WHERE userId = ?`,
            [interaction.user.id]
        );

        if (!row || row.coins < 100) {
            debugLog('ROLL', `Insufficient coins for ${interaction.user.tag}`);
            return await interaction.reply({ content: 'You do not have enough coins to buy a fumo.', ephemeral: true });
        }

        const hasFantasyBook = !!row.hasFantasyBook;
        const boosts = await getUserBoosts(interaction.user.id);

        const { rarity, resetPity } = await calculateRarity(interaction.user.id, boosts, row, hasFantasyBook);
        debugLog('RARITY', `Calculated rarity: ${rarity}`, { hasBook: hasFantasyBook, resetPity });

        if (ASTRAL_PLUS_RARITIES.includes(rarity)) {
            await incrementWeeklyAstral(interaction.user.id);
        }

        const boostUpdates = updateBoostCharge(row.boostCharge, row.boostActive, row.boostRollsRemaining);
        const updatedPities = updatePityCounters(
            {
                pityTranscendent: row.pityTranscendent,
                pityEternal: row.pityEternal,
                pityInfinite: row.pityInfinite,
                pityCelestial: row.pityCelestial,
                pityAstral: row.pityAstral
            },
            rarity,
            hasFantasyBook
        );

        const fumo = await selectAndAddFumo(interaction.user.id, rarity, fumos, row.luck);
        if (!fumo) {
            debugLog('ROLL', `No fumo found for rarity: ${rarity}`);
            return await interaction.reply({ content: 'No Fumo found for this rarity. Please contact the developer.', ephemeral: true });
        }

        await dbRun(
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
                boostUpdates.boostCharge,
                boostUpdates.boostActive,
                boostUpdates.boostRollsRemaining,
                updatedPities.pityTranscendent,
                updatedPities.pityEternal,
                updatedPities.pityInfinite,
                updatedPities.pityCelestial,
                updatedPities.pityAstral,
                interaction.user.id
            ]
        );

        await updateQuestsAndAchievements(interaction.user.id, 1);

        // Animation sequence
        const hasRareFumo = SPECIAL_RARITIES.includes(rarity);
        const embed = new EmbedBuilder()
            .setTitle('🎁 Unleashing an extraordinary surprise box just for you... ✨-golden-✨')
            .setImage('https://img.freepik.com/premium-photo/gift-box-present-isolated_63260-45.jpg')
            .setColor(hasRareFumo ? Colors.Gold : Colors.White);

        await interaction.reply({ embeds: [embed], ephemeral: true });

        setTimeout(async () => {
            embed.setImage('https://www.shutterstock.com/image-illustration/open-gift-box-3d-illustration-260nw-275157815.jpg');
            await interaction.editReply({ embeds: [embed] });

            setTimeout(async () => {
                if (hasRareFumo) embed.setTitle("💫 A radiant sparkle amidst the ordinary...?");
                embed.setImage(fumo.picture);
                await interaction.editReply({ embeds: [embed] });

                setTimeout(async () => {
                    embed.setTitle(`🎉 Congrats! You've unlocked a ${fumo.name.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim()} from alterGolden's Common Fumo Box.`)
                        .setColor(hasRareFumo ? Colors.Gold : Colors.White);
                    await interaction.editReply({ embeds: [embed] });
                }, 2000);
            }, 2000);
        }, 2000);

        const elapsed = Date.now() - startTime;
        debugLog('ROLL', `Single roll completed in ${elapsed}ms for ${interaction.user.tag}`);

        // LOG TO DISCORD - Only important/rare rolls
        if (SPECIAL_RARITIES.includes(rarity)) {
            await logUserActivity(
                client,
                interaction.user.id,
                interaction.user.tag,
                'Single Roll - Rare Drop',
                `Got **${fumo.name}** (${rarity})`
            );
        }

    } catch (err) {
        debugLog('ROLL', 'Single roll error', err);
        await logError(client, 'Single Roll', err, interaction.user.id);
        try {
            await interaction.reply({ content: 'An error occurred while processing your fumo roll.', ephemeral: true });
        } catch { }
    }
}

async function handleMultiRoll(interaction, fumos, rollCount) {
    try {
        const cost = rollCount * 100;
        const row = await dbGet(
            `SELECT coins, boostCharge, boostActive, boostRollsRemaining, pityTranscendent, pityEternal, 
             pityInfinite, pityCelestial, pityAstral, rollsLeft, totalRolls, hasFantasyBook, luck 
             FROM userCoins WHERE userId = ?`,
            [interaction.user.id]
        );

        if (!row || row.coins < cost) {
            return await interaction.reply({
                content: `You do not have enough coins to buy ${rollCount} fumos.`,
                ephemeral: true
            });
        }

        const hasFantasyBook = !!row.hasFantasyBook;
        const boosts = await getUserBoosts(interaction.user.id);

        let { boostCharge, boostActive, boostRollsRemaining } = row;
        let pities = {
            pityTranscendent: row.pityTranscendent,
            pityEternal: row.pityEternal,
            pityInfinite: row.pityInfinite,
            pityCelestial: row.pityCelestial,
            pityAstral: row.pityAstral
        };

        const fumosBought = [];
        let bestFumo = null;
        let currentRolls = row.totalRolls;

        // Perform rolls
        for (let i = 0; i < rollCount; i++) {
            currentRolls++;

            // Update row for rarity calculation
            const tempRow = {
                ...row,
                boostActive,
                boostRollsRemaining,
                totalRolls: currentRolls,
                ...pities
            };

            const { rarity } = await calculateRarity(interaction.user.id, boosts, tempRow, hasFantasyBook);

            // Track Astral+
            if (ASTRAL_PLUS_RARITIES.includes(rarity)) {
                await incrementWeeklyAstral(interaction.user.id);
            }

            // Update pities
            pities = updatePityCounters(pities, rarity, hasFantasyBook);

            // Update boost
            const boostUpdate = updateBoostCharge(boostCharge, boostActive, boostRollsRemaining);
            boostCharge = boostUpdate.boostCharge;
            boostActive = boostUpdate.boostActive;
            boostRollsRemaining = boostUpdate.boostRollsRemaining;

            // Add fumo
            const fumo = await selectAndAddFumo(interaction.user.id, rarity, fumos, row.luck);
            if (fumo) {
                fumosBought.push(fumo);
                if (!bestFumo || isRarer(rarity, bestFumo.rarity)) {
                    bestFumo = fumo;
                }
            }
        }

        // Update database
        await dbRun(
            `UPDATE userCoins SET
                coins = coins - ?,
                totalRolls = totalRolls + ?,
                boostCharge = ?,
                boostActive = ?,
                boostRollsRemaining = ?,
                pityTranscendent = ?,
                pityEternal = ?,
                pityInfinite = ?,
                pityCelestial = ?,
                pityAstral = ?,
                rollsLeft = CASE WHEN rollsLeft >= ? THEN rollsLeft - ? ELSE 0 END
            WHERE userId = ?`,
            [
                cost,
                rollCount,
                boostCharge,
                boostActive,
                boostRollsRemaining,
                pities.pityTranscendent,
                pities.pityEternal,
                pities.pityInfinite,
                pities.pityCelestial,
                pities.pityAstral,
                rollCount,
                rollCount,
                interaction.user.id
            ]
        );

        await updateQuestsAndAchievements(interaction.user.id, rollCount);

        // Display animation and results
        await displayMultiRollResults(interaction, fumosBought, bestFumo, rollCount);

        await logToDiscord(client, `✅ User ${interaction.user.tag} rolled ${rollCount}x. Best: ${bestFumo?.name} (${bestFumo?.rarity})`);

    } catch (err) {
        console.error(`${rollCount}x roll error:`, err);
        await logToDiscord(client, `Error in ${rollCount}x roll for ${interaction.user.tag}`, err);
        try {
            await interaction.reply({ content: `An error occurred while processing your ${rollCount} fumo rolls.`, ephemeral: true });
        } catch { }
    }
}

async function displayMultiRollResults(interaction, fumosBought, bestFumo, rollCount) {
    const isRareCutscene = isRarer(bestFumo.rarity, 'LEGENDARY');
    const embedColor = rollCount === 10 ? Colors.Yellow : Colors.Gold;

    const embed = new EmbedBuilder()
        .setTitle(`🌟💫 Opening the ${rollCount === 10 ? 'Golden' : 'Legendary'} Fumo Box... 💫🌟`)
        .setImage(rollCount === 10
            ? 'https://5.imimg.com/data5/HH/SX/MY-6137980/golden-gift-box-500x500.jpg'
            : 'https://media.istockphoto.com/id/610990634/photo/businessman-looking-at-huge-present.jpg?s=612x612&w=0&k=20&c=blc7bjEGc8pbmfYKnmqw7g5jp32rMTDAI5y5W9Z4ZOo=')
        .setColor(embedColor);

    await interaction.reply({ embeds: [embed], ephemeral: true });

    setTimeout(async () => {
        embed.setImage(rollCount === 10
            ? 'https://img.freepik.com/premium-vector/open-golden-gift-box-gold-confetti_302982-1365.jpg'
            : 'https://media.istockphoto.com/id/494384016/photo/young-men-coming-up-from-a-big-box.jpg?s=612x612&w=0&k=20&c=LkQMIrS-CNqNARtscgK-lmijIt8ZyT4UFB9fqigSM1I=');
        await interaction.editReply({ embeds: [embed] });

        setTimeout(async () => {
            embed.setTitle(isRareCutscene
                ? "✨ A sudden burst of radiance... An extraordinary spectacle indeed! ✨"
                : `🎁 The ${rollCount === 10 ? 'golden box' : 'treasure chest'} reveals...`)
                .setImage(isRareCutscene
                    ? (rollCount === 10
                        ? 'https://previews.123rf.com/images/baks/baks1412/baks141200006/34220442-christmas-background-with-open-golden-box-with-stars-and-confetti.jpg'
                        : 'https://media.istockphoto.com/id/579738794/vector/open-gift-box-with-shiny-light.jpg?s=1024x1024&w=is&k=20&c=573dQ-4CGCMwQcKaha-zbqCBJrgj7cAf_cwNeBSHyoI=')
                    : (rollCount === 10
                        ? 'https://media.istockphoto.com/id/865744872/photo/golden-glowing-box-of-light.jpg?s=612x612&w=0&k=20&c=14_RsYdmgE8OLV70elc3sLQRuuK3i_IYA0M5aGPiTtA='
                        : 'https://boxfox.com.au/cdn/shop/products/Large_gift_box_-_Red_lid_open_2DC_2623_800x.jpg?v=1556515906'));
            await interaction.editReply({ embeds: [embed] });

            setTimeout(async () => {
                const fumoCounts = fumosBought.reduce((acc, fumo) => {
                    if (!acc[fumo.rarity]) acc[fumo.rarity] = {};
                    const cleanName = fumo.name.replace(/\(.*?\)/g, '').trim();
                    acc[fumo.rarity][cleanName] = (acc[fumo.rarity][cleanName] || 0) + 1;
                    return acc;
                }, {});

                const sortedRarities = Object.keys(fumoCounts).sort((a, b) =>
                    RARITY_PRIORITY.indexOf(b.toUpperCase()) - RARITY_PRIORITY.indexOf(a.toUpperCase())
                );

                const fumoList = sortedRarities.map(rarity => {
                    const entries = Object.entries(fumoCounts[rarity])
                        .map(([name, count]) => `${name} (x${count})`);
                    const totalCount = Object.values(fumoCounts[rarity]).reduce((sum, count) => sum + count, 0);
                    return `**${rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase()} (x${totalCount}):**\n${entries.join(', ')}`;
                }).join('\n\n');

                embed.setTitle(`🎉 You've unlocked ${rollCount} fumos!`)
                    .setDescription(`${fumoList}\n\n**Best fumo:** ${bestFumo.name}`)
                    .setColor(isRareCutscene ? Colors.Gold : Colors.White);

                await interaction.editReply({ embeds: [embed] });
            }, 2000);
        }, 2000);
    }, 2000);
}

async function handleAutoRoll(interaction, fumos, userId, autoSell = false) {

    debugLog('AUTO_ROLL', `Auto-roll ${autoSell ? 'with auto-sell' : 'normal'} started by user ${userId}`);

    try {
        if (autoRollMap.has(userId)) {
            return await interaction.followUp({
                embeds: [{
                    title: '⏳ Auto Roll Already Running',
                    description: 'You already have Auto Roll active!',
                    color: 0xffcc00
                }],
                ephemeral: true
            });
        }

        // Calculate interval with stacking boosts
        let rollInterval = await calculateAutoRollInterval(userId);

        let rollCount = 0;
        let bestFumo = null;
        let stopped = false;

        async function autoRollLoop() {
            if (stopped) return;
            rollCount++;

            // Recalculate interval each roll
            const newInterval = await calculateAutoRollInterval(userId);

            try {
                const result = await performBatch100Roll(userId, fumos);

                const current = autoRollMap.get(userId);
                if (current) {
                    current.rollCount = rollCount;
                    const timeStr = new Date().toLocaleString();

                    if (!current.bestFumo || compareFumos(result, current.bestFumo) > 0) {
                        current.bestFumo = result;
                        current.bestFumoAt = timeStr;
                        current.bestFumoRoll = rollCount;
                    }

                    if (SPECIAL_RARITIES.includes(result.rarity)) {
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

                // Auto-sell if enabled
                if (autoSell) {
                    await performAutoSell(userId);
                }

            } catch (error) {
                console.error(`Auto Roll failed at roll #${rollCount}:`, error);
                await logToDiscord(client, `Auto roll error for ${userId} at roll ${rollCount}`, error);
            }

            if (!stopped) {
                const intervalId = setTimeout(autoRollLoop, newInterval);
                const mapEntry = autoRollMap.get(userId);
                if (mapEntry) mapEntry.intervalId = intervalId;
            }
        }

        autoRollMap.set(userId, {
            intervalId: null,
            bestFumo: null,
            rollCount: 0,
            bestFumoAt: null,
            bestFumoRoll: null,
            specialFumoCount: 0,
            specialFumoFirstAt: null,
            specialFumoFirstRoll: null,
            lowerSpecialFumos: []
        });

        autoRollLoop();

        const displayInterval = await calculateAutoRollInterval(userId);

        await interaction.followUp({
            embeds: [{
                title: autoSell ? '🤖 Auto Roll + AutoSell Started!' : '🎰 Auto Roll Started!',
                description: autoSell
                    ? `Rolling every **${displayInterval / 1000} seconds** and **auto-selling all fumos below EXCLUSIVE**.\nUse \`Stop Roll 100\` to cancel.`
                    : `Rolling every **${displayInterval / 1000} seconds** indefinitely.\nUse \`Stop Roll 100\` to cancel.`,
                color: 0x3366ff,
                footer: { text: 'This will continue until you stop it manually.' }
            }],
            ephemeral: true
        });

        await logUserActivity(
            client,
            userId,
            interaction.user.tag,
            'Auto-Roll Started',
            `Mode: ${autoSell ? 'With AutoSell' : 'Normal'}, Interval: ${displayInterval / 1000}s`
        );

    } catch (err) {
        debugLog('AUTO_ROLL', 'Auto roll start error', err);
        await logError(client, 'Auto-Roll Start', err, userId);
    }
}

async function calculateAutoRollInterval(userId) {
    let interval = 60000;
    const now = Date.now();

    const [timeBlessing, timeClock] = await Promise.all([
        dbGet(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`, [userId, now]),
        dbGet(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`, [userId, now])
    ]);

    if (timeBlessing?.multiplier === 0.5) interval = 30000;
    if (timeClock?.multiplier === 2) interval = Math.floor(interval / 2);

    return interval;
}

async function performBatch100Roll(userId, fumos) {
    const row = await dbGet(
        `SELECT coins, boostCharge, boostActive, boostRollsRemaining, pityTranscendent, pityEternal, 
         pityInfinite, pityCelestial, pityAstral, rollsLeft, totalRolls, hasFantasyBook, luck 
         FROM userCoins WHERE userId = ?`,
        [userId]
    );

    if (!row || row.coins < 10000) return null;

    const hasFantasyBook = !!row.hasFantasyBook;
    const boosts = await getUserBoosts(userId);

    let { boostCharge, boostActive, boostRollsRemaining } = row;
    let pities = {
        pityTranscendent: row.pityTranscendent,
        pityEternal: row.pityEternal,
        pityInfinite: row.pityInfinite,
        pityCelestial: row.pityCelestial,
        pityAstral: row.pityAstral
    };

    let bestFumo = null;
    let currentRolls = row.totalRolls;

    for (let i = 0; i < 100; i++) {
        currentRolls++;

        const tempRow = {
            ...row,
            boostActive,
            boostRollsRemaining,
            totalRolls: currentRolls,
            ...pities
        };

        const { rarity } = await calculateRarity(userId, boosts, tempRow, hasFantasyBook);

        if (ASTRAL_PLUS_RARITIES.includes(rarity)) {
            await incrementWeeklyAstral(userId);
        }

        pities = updatePityCounters(pities, rarity, hasFantasyBook);

        const boostUpdate = updateBoostCharge(boostCharge, boostActive, boostRollsRemaining);
        boostCharge = boostUpdate.boostCharge;
        boostActive = boostUpdate.boostActive;
        boostRollsRemaining = boostUpdate.boostRollsRemaining;

        const fumo = await selectAndAddFumo(userId, rarity, fumos, row.luck);
        if (fumo && (!bestFumo || isRarer(rarity, bestFumo.rarity))) {
            bestFumo = fumo;
        }
    }

    await dbRun(
        `UPDATE userCoins SET
            coins = coins - 10000,
            totalRolls = totalRolls + 100,
            boostCharge = ?,
            boostActive = ?,
            boostRollsRemaining = ?,
            pityTranscendent = ?,
            pityEternal = ?,
            pityInfinite = ?,
            pityCelestial = ?,
            pityAstral = ?,
            rollsLeft = CASE WHEN rollsLeft >= 100 THEN rollsLeft - 100 ELSE 0 END
        WHERE userId = ?`,
        [
            boostCharge,
            boostActive,
            boostRollsRemaining,
            pities.pityTranscendent,
            pities.pityEternal,
            pities.pityInfinite,
            pities.pityCelestial,
            pities.pityAstral,
            userId
        ]
    );

    await updateQuestsAndAchievements(userId, 100);

    return bestFumo;
}

async function performAutoSell(userId) {
    const inventoryRows = await dbAll(
        `SELECT id, fumoName, quantity FROM userInventory WHERE userId = ? ORDER BY id DESC LIMIT 100`,
        [userId]
    );

    let totalSell = 0;
    const toDelete = [];
    const toUpdate = [];

    for (const row of inventoryRows) {
        let rarity = null;
        for (const r of Object.keys(COIN_REWARDS)) {
            const regex = new RegExp(`\\b${r}\\b`, 'i');
            if (regex.test(row.fumoName)) {
                rarity = r;
                break;
            }
        }

        if (rarity && ['Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL'].includes(rarity)) {
            let value = COIN_REWARDS[rarity] || 0;
            if (row.fumoName.includes('[🌟alG]')) value *= 150;
            else if (row.fumoName.includes('[✨SHINY]')) value *= 2;
            totalSell += value;

            if (row.quantity > 1) {
                toUpdate.push({ id: row.id, quantity: row.quantity - 1 });
            } else {
                toDelete.push(row.id);
            }
        }
    }

    for (const upd of toUpdate) {
        await dbRun(`UPDATE userInventory SET quantity = ? WHERE userId = ? AND id = ?`, [upd.quantity, userId, upd.id]);
    }

    if (toDelete.length > 0) {
        await dbRun(
            `DELETE FROM userInventory WHERE userId = ? AND id IN (${toDelete.map(() => '?').join(',')})`,
            [userId, ...toDelete]
        );
    }

    if (totalSell > 0) {
        await dbRun(`UPDATE userCoins SET coins = coins + ? WHERE userId = ?`, [totalSell, userId]);
    }

    return totalSell;
}

async function handleStopAutoRoll(interaction, userId) {
    const auto = autoRollMap.get(userId);
    if (!auto) {
        return await interaction.reply({
            embeds: [{
                title: '❌ No Active Auto Roll',
                description: "You currently don't have an auto-roll running.",
                color: 0xff4444,
                footer: { text: 'Auto Roll Status' },
                timestamp: new Date()
            }],
            ephemeral: true
        });
    }

    if (auto.intervalId) clearTimeout(auto.intervalId);
    autoRollMap.delete(userId);

    // Generate summary
    const summary = generateAutoRollSummary(auto, userId);

    await interaction.reply({
        embeds: [summary.embed],
        components: summary.components,
        ephemeral: true
    });

    await logToDiscord(client, `🛑 User ${interaction.user.tag} stopped auto-roll. Total: ${auto.rollCount * 100} rolls`);
}

function generateAutoRollSummary(auto, userId) {
    let bestFumoText = 'None (N/A)';
    let bestFumoImage = null;

    if (auto.bestFumo) {
        let suffix = '';
        if (auto.bestFumo.name.includes('[🌟alG]')) suffix = ' [🌟alG]';
        else if (auto.bestFumo.name.includes('[✨SHINY]')) suffix = ' [✨SHINY]';

        const cleanName = auto.bestFumo.name.replace(/\s*\(.*?\)$/, '').replace(/\[.*?\]/g, '').trim();
        bestFumoText = `🏆 Best Fumo: ${cleanName} (${auto.bestFumo.rarity})${suffix}\n`;

        if (auto.bestFumoRoll && auto.bestFumoAt) {
            bestFumoText += `🕒 Obtained at roll #${auto.bestFumoRoll}, at ${auto.bestFumoAt}`;
        }

        bestFumoImage = auto.bestFumo.picture || null;
    }

    const rarityOrder = ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???'];
    const fumoSummary = {};

    (auto.lowerSpecialFumos || []).forEach(f => {
        if (!fumoSummary[f.rarity]) fumoSummary[f.rarity] = [];
        fumoSummary[f.rarity].push(f);
    });

    if (auto.bestFumo && rarityOrder.includes(auto.bestFumo.rarity)) {
        if (!fumoSummary[auto.bestFumo.rarity]) fumoSummary[auto.bestFumo.rarity] = [];
        if (!fumoSummary[auto.bestFumo.rarity].some(x => x.roll === auto.bestFumoRoll)) {
            fumoSummary[auto.bestFumo.rarity].push({
                name: auto.bestFumo.name,
                rarity: auto.bestFumo.rarity,
                roll: auto.bestFumoRoll,
                time: auto.bestFumoAt
            });
        }
    }

    const shinyAlGMap = {};
    for (const rarity of rarityOrder) {
        shinyAlGMap[rarity] = { shiny: [], alg: [] };
        const arr = fumoSummary[rarity] || [];
        arr.forEach(f => {
            if (f.name?.includes('[🌟alG]')) shinyAlGMap[rarity].alg.push(f);
            else if (f.name?.includes('[✨SHINY]')) shinyAlGMap[rarity].shiny.push(f);
        });
    }

    const summaryLines = rarityOrder.map(rarity => {
        const arr = fumoSummary[rarity] || [];
        let line = `**${rarity}:** `;

        if (arr.length === 0) {
            line += 'None';
        } else {
            arr.sort((a, b) => a.roll - b.roll);
            const first = arr[0];
            line += `\`${arr.length}\` (first: #${first.roll}, ${first.time})`;
        }

        const extras = [];
        if (shinyAlGMap[rarity].shiny.length > 0) {
            const shinyFirst = shinyAlGMap[rarity].shiny[0];
            extras.push(`Shiny: ${shinyAlGMap[rarity].shiny.length} (#${shinyFirst.roll})`);
        }
        if (shinyAlGMap[rarity].alg.length > 0) {
            const algFirst = shinyAlGMap[rarity].alg[0];
            extras.push(`alG: ${shinyAlGMap[rarity].alg.length} (#${algFirst.roll})`);
        }
        if (extras.length > 0) line += ', ' + extras.join(', ');

        return line;
    });

    const coinsSpent = auto.rollCount * 10000;
    const statsField = [
        `🎲 **Total Rolls:** \`${(auto.rollCount * 100).toLocaleString()}\``,
        `💸 **Coins Spent:** \`${coinsSpent.toLocaleString()}\``,
        bestFumoText,
        `\n__**Special Fumos Obtained:**__\n${summaryLines.join('\n')}`
    ].join('\n');

    const embed = new EmbedBuilder()
        .setTitle('🛑 Auto Roll Stopped!')
        .setDescription('Your auto roll was stopped manually.\n\nHere\'s a summary of your session: ')
        .addFields([{ name: '📊 Results', value: statsField }])
        .setColor(0xcc3300)
        .setFooter({ text: 'Auto Roll Summary' })
        .setTimestamp();

    if (bestFumoImage) embed.setImage(bestFumoImage);

    if (auto.bestFumo && rarityOrder.includes(auto.bestFumo.rarity)) {
        embed.setThumbnail('https://cdn.pixabay.com/photo/2017/01/31/13/14/confetti-2024631_1280.png');
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`autoRoll50_${userId}`)
            .setLabel('🔄 Restart Auto Roll')
            .setStyle(ButtonStyle.Success)
    );

    return { embed, components: [row] };
}

module.exports = (client, fumos) => {
    client.on('messageCreate', async message => {
        if (!message.content.startsWith('.crategacha') && !message.content.startsWith('.cg')) return;

        debugLog('COMMAND', `Crate gacha command received from ${message.author.tag}`);

        try {
            // Check maintenance and ban status
            const banData = isBanned(message.author.id);
            if ((maintenance === "yes" && message.author.id !== developerID) || banData) {
                const embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle(maintenance === "yes" ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
                    .setTimestamp();

                if (maintenance === "yes") {
                    embed.setDescription("The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden")
                        .setFooter({ text: "Thank you for your patience" });
                } else if (banData) {
                    let description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

                    if (banData.expiresAt) {
                        const remaining = banData.expiresAt - Date.now();
                        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                        const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                        const seconds = Math.floor((remaining / 1000) % 60);
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

                    embed.setDescription(description).setFooter({ text: "Ban enforced by developer" });
                }

                await logUserActivity(
                    client,
                    message.author.id,
                    message.author.tag,
                    'Access Denied',
                    maintenance === "yes" ? 'Maintenance mode' : `Banned: ${banData.reason}`
                );

                return message.reply({ embeds: [embed] });
            }

            debugLog('COMMAND', `Shop displayed successfully for ${message.author.tag}`);

            // Fetch user data and boosts
            const row = await dbGet(
                `SELECT coins, boostCharge, boostActive, boostRollsRemaining, pityTranscendent, pityEternal, 
                 pityInfinite, pityCelestial, pityAstral, hasFantasyBook, rollsLeft 
                 FROM userCoins WHERE userId = ?`,
                [message.author.id]
            );

            if (!row) {
                return message.reply({ content: 'You do not have any coins unfortunately..', ephemeral: true });
            }

            const boosts = await getUserBoosts(message.author.id);
            const hasFantasyBook = !!row.hasFantasyBook;

            // Base chances configuration
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
                let boosted = baseChance * boosts.ancientLuckMultiplier *
                    boosts.mysteriousLuckMultiplier *
                    boosts.mysteriousDiceMultiplier *
                    boosts.petBoost;

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
                const obscured = obscureChance(boosted);

                if (obscured) {
                    shownUnknownChances.push(`${label} — ${obscured}`);
                    return;
                }

                if (boosted > 100) boosted = 100;
                const display = boosted >= 100 ? `${label} — 100.00% 🔥` : `${label} — ${boosted.toFixed(2)}%`;
                (base >= 1 ? shownRarityChances : shownUnknownChances).push(display);
            });

            const rarityChances = shownRarityChances.join('\n');
            const unknownChances = shownUnknownChances.join('\n');

            // Build boost status text
            const ancientNoteLines = [];
            if (boosts.ancientLuckMultiplier > 1) {
                ancientNoteLines.push(`🎇 AncientRelic active! Luck boosted by ${boosts.ancientLuckMultiplier}×`);
            }
            if (boosts.luminaActive) {
                ancientNoteLines.push(`🌟 Lumina active! Every 10th roll grants 5× Luck`);
            }
            if (rollsLeft > 0 && !isBoostActive) {
                ancientNoteLines.push(`✨ Bonus Roll active! Luck boosted by 2×`);
            }
            if (boosts.mysteriousLuckMultiplier > 1) {
                ancientNoteLines.push(`🧊 MysteriousCube active! Luck boosted by ${boosts.mysteriousLuckMultiplier.toFixed(2)}×`);
            }
            if (boosts.mysteriousDiceMultiplier !== 1) {
                ancientNoteLines.push(`🎲 MysteriousDice active! Luck boosted by ${boosts.mysteriousDiceMultiplier.toFixed(4)}× (random per hour)`);
            }
            if (boosts.petBoost > 1) {
                ancientNoteLines.push(`🐰 Pet boost active! Luck boosted by ${boosts.petBoost.toFixed(4)}×`);
            }
            const ancientNote = ancientNoteLines.length > 0 ? ancientNoteLines.join('\n') : 'No luck boost applied...';

            // Pity section
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
                    { name: '🌈 Rarity Chances', value: rarityChances, inline: true },
                    { name: '❓ Rare Chances:', value: unknownChances, inline: true },
                    { name: '🌌 Booster/Pity Status:', value: pitySection, inline: false }
                ])
                .setColor(Colors.Blue)
                .setImage('https://pbs.twimg.com/media/EkXjV4sU0AIwSr5.png')
                .setFooter({ text: ancientNote });

            const userId = message.author.id;
            const isAutoRollActive = autoRollMap.has(userId);

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
                new ButtonBuilder()
                    .setCustomId(isAutoRollActive ? `stopAuto50_${userId}` : `autoRoll50_${userId}`)
                    .setLabel(isAutoRollActive ? '🛑 Stop Auto 100' : 'Auto Roll 100')
                    .setStyle(isAutoRollActive ? ButtonStyle.Danger : ButtonStyle.Success)
            );

            await message.channel.send({ embeds: [embed], components: [rowButtons] });
            await logToDiscord(client, `📋 User ${message.author.tag} opened crate gacha shop`);

        } catch (err) {
            debugLog('COMMAND', 'Message handler error', err);
            await logError(client, 'Message Handler', err, message.author.id);
        }
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        try {
            const [action, userId] = interaction.customId.split('_');

            // Button ownership check
            const protectedActions = ['buy1fumo', 'buy10fumos', 'buy100fumos', 'autoRoll50', 'stopAuto50', 'autoRollProceed', 'autoRollAutoSell'];
            if (protectedActions.includes(action) && interaction.user.id !== userId) {
                return interaction.reply({
                    content: "You can't use someone else's button. Use .crategacha yourself.",
                    ephemeral: true
                });
            }

            // Cooldown check for roll actions
            if (['buy1fumo', 'buy10fumos', 'buy100fumos', 'autoRoll50', 'stopAuto50'].includes(action)) {
                const cooldownKey = `${interaction.user.id}_gacha`;
                const lastUsed = cooldownMap.get(cooldownKey);
                const now = Date.now();

                const cooldownDuration = await calculateCooldown(interaction.user.id);

                if (lastUsed && now - lastUsed < cooldownDuration) {
                    const remaining = ((cooldownDuration - (now - lastUsed)) / 1000).toFixed(1);
                    return interaction.reply({
                        content: `🕒 Please wait ${remaining}s before clicking again.`,
                        ephemeral: true
                    });
                }

                cooldownMap.set(cooldownKey, now);

                // Prevent manual rolls during auto-roll
                if (['buy1fumo', 'buy10fumos', 'buy100fumos'].includes(action) && autoRollMap.has(userId)) {
                    return interaction.reply({
                        content: '⚠️ You cannot manually roll while Auto Roll is active. Please stop it first.',
                        ephemeral: true
                    });
                }
            }

            // Route to appropriate handler
            switch (action) {
                case 'buy1fumo':
                    await handleSingleRoll(interaction, fumos);
                    break;

                case 'buy10fumos':
                    await handleMultiRoll(interaction, fumos, 10);
                    break;

                case 'buy100fumos':
                    await handleMultiRoll(interaction, fumos, 100);
                    break;

                case 'autoRoll50':
                    // Show choice embed
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
                        .setDescription('How would you like to proceed?\n\n- **Proceed AutoRoll**: Just auto roll as usual.\n- **Enable AutoSell**: Auto roll and automatically sell all fumos below EXCLUSIVE rarity for coins.\n⚠️ WARNING: THIS WILL AUTOMATICALLY USE ALL OF YOUR BOOST!')
                        .setColor(Colors.Blue);

                    await interaction.reply({
                        embeds: [choiceEmbed],
                        components: [choiceRow],
                        ephemeral: true
                    });

                    // Set up collector for choice
                    const filter = i => i.user.id === userId &&
                        (i.customId === `autoRollProceed_${userId}` || i.customId === `autoRollAutoSell_${userId}`);

                    const collector = interaction.channel.createMessageComponentCollector({
                        filter,
                        time: 15000,
                        max: 1
                    });

                    collector.on('collect', async i => {
                        await i.deferUpdate();
                        const autoSell = i.customId.startsWith('autoRollAutoSell_');
                        await handleAutoRoll(i, fumos, userId, autoSell);
                    });

                    collector.on('end', collected => {
                        if (collected.size === 0) {
                            interaction.editReply({
                                content: '⏱️ Auto Roll setup timed out.',
                                components: [],
                                embeds: []
                            }).catch(() => { });
                        }
                    });
                    break;

                case 'stopAuto50':
                    await handleStopAutoRoll(interaction, userId);
                    break;

                default:
                    break;
            }

        } catch (err) {
            console.error('Interaction error:', err);
            await logToDiscord(client, `Error handling interaction for ${interaction.user?.tag}`, err);

            const errorMsg = { content: 'An error occurred while processing your request.', ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errorMsg).catch(() => { });
            } else {
                await interaction.reply(errorMsg).catch(() => { });
            }
        }
    });
};