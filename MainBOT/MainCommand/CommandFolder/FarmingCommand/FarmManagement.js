const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors
} = require('discord.js');
const { promisify } = require('util');
const db = require('../../Core/Database/db');
db.getAsync = promisify(db.get).bind(db);
db.allAsync = promisify(db.all).bind(db);
// Need more logging here, especially for farming start/stop and errors
const farmingIntervals = new Map();
const { maintenance, developerID } = require("../../Configuration/MaintenanceConfig");
const { isBanned } = require('../../Administrator/BannedList/BanUtils');

const LOG_CHANNEL_ID = '1411386632589807719';

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

async function logToDiscord(client, message, color = Colors.Blue) {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (channel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setDescription(message)
                .setColor(color)
                .setTimestamp();
            await channel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('Failed to log to Discord:', err);
    }
}

async function checkAccess(message) {
    const banData = isBanned(message.author.id);
    if ((maintenance === "yes" && message.author.id !== developerID) || banData) {
        let description = '';
        let footerText = '';
        let title = '';

        if (maintenance === "yes" && message.author.id !== developerID) {
            title = '🚧 Maintenance Mode';
            description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
            footerText = "Thank you for your patience";
        } else if (banData) {
            title = '⛔ You Are Banned';
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
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: footerText })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
        return false;
    }
    return true;
}

function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\.00$/, '') + 'b';
    if (num >= 1e6) return (num / 1e6).toFixed(2).replace(/\.00$/, '') + 'm';
    if (num >= 1e3) return (num / 1e3).toFixed(2).replace(/\.00$/, '') + 'k';
    return num.toString();
}

function getRarity(fumoName) {
    if (!fumoName) return 'Unknown';
    const rarities = ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???',
        'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON'];
    return rarities.find(r => fumoName.includes(r)) || 'Common';
}

function getStatsByRarity(fumoName) {
    const rarity = getRarity(fumoName);
    const statMap = {
        'Common': [25, 5],
        'UNCOMMON': [45, 10],
        'RARE': [70, 20],
        'EPIC': [100, 35],
        'OTHERWORLDLY': [150, 50],
        'LEGENDARY': [200, 75],
        'MYTHICAL': [350, 115],
        'EXCLUSIVE': [500, 150],
        '???': [750, 220],
        'ASTRAL': [1000, 450],
        'CELESTIAL': [2000, 700],
        'INFINITE': [3500, 915],
        'ETERNAL': [5000, 1150],
        'TRANSCENDENT': [25000, 2500],
    };

    let [coinsPerMin, gemsPerMin] = statMap[rarity] || [0, 0];

    if (fumoName.includes('✨SHINY')) {
        coinsPerMin *= 2;
        gemsPerMin *= 2;
    }
    if (fumoName.includes('🌟alG')) {
        coinsPerMin *= 100;
        gemsPerMin *= 100;
    }

    return [coinsPerMin, gemsPerMin];
}

// Get active boost multipliers (consolidated - used once)
async function getActiveBoostMultipliers(userId) {
    let coinMultiplier = 1;
    let gemMultiplier = 1;
    let coinSources = [];
    let gemSources = [];
    let boosts = [];

    try {
        const now = Date.now();
        boosts = await db.allAsync(
            `SELECT type, multiplier, source, expiresAt, stack, uses FROM activeBoosts 
             WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, now]
        );

        boosts.forEach(b => {
            const type = (b.type || '').toLowerCase();
            const mult = b.multiplier || 1;
            if (['coin', 'income'].includes(type)) {
                coinMultiplier *= mult;
                coinSources.push(`${type}:x${mult.toFixed(2)} from [${b.source}]`);
            }
            if (['gem', 'gems', 'income'].includes(type)) {
                gemMultiplier *= mult;
                gemSources.push(`${type}:x${mult.toFixed(2)} from [${b.source}]`);
            }
        });
    } catch (err) {
        console.error("Error fetching active boosts:", err);
    }

    return { coinMultiplier, gemMultiplier, coinSources, gemSources, boosts };
}

// Get farm limit for user
async function getFarmLimit(userId) {
    const [upgradeRow] = await db.allAsync(`SELECT fragmentUses FROM userUpgrades WHERE userId = ?`, [userId]);
    return 5 + (upgradeRow?.fragmentUses || 0);
}

// Add Fumo to farm
async function addFumoToFarm(db, message, fumoName) {
    const userId = message.author.id;
    const limit = await getFarmLimit(userId);

    const farmingFumos = await db.allAsync(`SELECT * FROM farmingFumos WHERE userId = ?`, [userId]);
    if (farmingFumos.length >= limit) {
        return message.reply({
            embeds: [new EmbedBuilder().setDescription(`🚜 Your farm is full. Max ${limit} Fumos allowed.`)]
        });
    }

    if (farmingFumos.find(f => f.fumoName === fumoName)) {
        return message.reply({
            embeds: [new EmbedBuilder().setDescription(`🚜 You're already farming a ${fumoName} Fumo.`)]
        });
    }

    const [inventoryRow] = await db.allAsync(
        `SELECT COUNT(*) as count FROM userInventory WHERE userId = ? AND fumoName = ?`,
        [userId, fumoName]
    );

    if ((inventoryRow?.count || 0) <= 0) {
        return message.reply({
            embeds: [new EmbedBuilder().setDescription(`🔍 You don't have a ${fumoName} Fumo in your inventory.`)]
        });
    }

    const [coinsPerMin, gemsPerMin] = getStatsByRarity(fumoName);

    await runAsync(
        `INSERT INTO farmingFumos (userId, fumoName, coinsPerMin, gemsPerMin) VALUES (?, ?, ?, ?)`,
        [userId, fumoName, coinsPerMin, gemsPerMin]
    );

    startFarming(userId, fumoName, coinsPerMin, gemsPerMin);

    return message.reply({
        embeds: [new EmbedBuilder().setDescription(`🎉 ${fumoName} Fumo added to your farm.`)]
    });
}

async function addRandomByRarity(db, message, rarity) {
    const userId = message.author.id;
    const limit = await getFarmLimit(userId);

    const farmingFumos = await db.allAsync(`SELECT * FROM farmingFumos WHERE userId = ?`, [userId]);
    const availableSlots = limit - farmingFumos.length;

    if (availableSlots <= 0) {
        return message.reply({ embeds: [new EmbedBuilder().setDescription(`🚜 Your farm is full.`)] });
    }

    const inventory = await db.allAsync(
        `SELECT fumoName, COUNT(*) as count FROM userInventory WHERE userId = ? GROUP BY fumoName`,
        [userId]
    );

    inventory.sort(() => Math.random() - 0.5);

    let added = 0;
    for (const item of inventory) {
        if (getRarity(item.fumoName) !== rarity) continue;
        if (farmingFumos.some(f => f.fumoName === item.fumoName)) continue;
        if (item.count <= 0) continue;

        const [coinsPerMin, gemsPerMin] = getStatsByRarity(item.fumoName);

        await runAsync(
            `INSERT INTO farmingFumos (userId, fumoName, coinsPerMin, gemsPerMin) VALUES (?, ?, ?, ?)`,
            [userId, item.fumoName, coinsPerMin, gemsPerMin]
        );

        startFarming(userId, item.fumoName, coinsPerMin, gemsPerMin);
        added++;

        if (added >= availableSlots) break;
    }

    if (added === 0) {
        return message.reply({
            embeds: [new EmbedBuilder().setDescription(`🔍 No available ${rarity} Fumos found in your inventory.`)]
        });
    }

    return message.reply({
        embeds: [new EmbedBuilder().setDescription(`🎉 Added ${added} ${rarity} Fumo(s) to your farm.`)]
    });
}

const generateFarmingKey = (userId, fumoName) => `${userId}-${fumoName}`;

async function stopAllFarming(userId) {
    try {
        const rows = await db.allAsync(`SELECT fumoName FROM farmingFumos WHERE userId = ?`, [userId]);

        for (const row of rows) {
            const key = generateFarmingKey(userId, row.fumoName);
            if (farmingIntervals.has(key)) {
                clearInterval(farmingIntervals.get(key));
                farmingIntervals.delete(key);
            }
        }

        await runAsync(`DELETE FROM farmingFumos WHERE userId = ?`, [userId]);
        console.log(`Cleared all farming for ${userId}.`);
    } catch (err) {
        console.error(`stopAllFarming error for ${userId}:`, err);
    }
}

async function stopFumoWithQuantity(userId, fumoName, quantity) {
    try {
        const row = await db.getAsync(
            `SELECT quantity FROM farmingFumos WHERE userId = ? AND fumoName = ?`,
            [userId, fumoName]
        );

        if (!row) return;

        const key = generateFarmingKey(userId, fumoName);

        if (quantity >= row.quantity) {
            if (farmingIntervals.has(key)) {
                clearInterval(farmingIntervals.get(key));
                farmingIntervals.delete(key);
            }
            await runAsync(`DELETE FROM farmingFumos WHERE userId = ? AND fumoName = ?`, [userId, fumoName]);
        } else {
            await runAsync(
                `UPDATE farmingFumos SET quantity = quantity - ? WHERE userId = ? AND fumoName = ?`,
                [quantity, userId, fumoName]
            );
        }
    } catch (err) {
        console.error(`stopFumoWithQuantity error:`, err);
    }
}

async function startFarming(userId, fumoName, coinsPerMin, gemsPerMin) {
    try {
        if (!fumoName || typeof fumoName !== 'string' || !fumoName.trim()) {
            console.warn(`Invalid fumoName for user ${userId}`);
            return;
        }

        const row = await db.getAsync(
            `SELECT quantity FROM farmingFumos WHERE userId = ? AND fumoName = ?`,
            [userId, fumoName]
        );

        if (!row) {
            console.error(`No entries found for ${userId} farming '${fumoName}'.`);
            return;
        }

        const key = generateFarmingKey(userId, fumoName);
        const quantity = row.quantity || 1;

        if (farmingIntervals.has(key)) return;

        const intervalId = setInterval(async () => {
            try {
                const inventoryRow = await db.getAsync(
                    `SELECT quantity FROM userInventory WHERE userId = ? AND fumoName = ?`,
                    [userId, fumoName]
                );

                if (!inventoryRow || inventoryRow.FumoTotal <= 0) {
                    clearInterval(farmingIntervals.get(key));
                    farmingIntervals.delete(key);
                    await runAsync(`DELETE FROM farmingFumos WHERE userId = ? AND fumoName = ?`, [userId, fumoName]);
                    return;
                }

                const { coinMultiplier, gemMultiplier } = await getActiveBoostMultipliers(userId);

                const coinsAwarded = Math.floor(coinsPerMin * quantity * coinMultiplier);
                const gemsAwarded = Math.floor(gemsPerMin * quantity * gemMultiplier);

                await runAsync(
                    `UPDATE userCoins SET coins = COALESCE(coins, 0) + ?, gems = COALESCE(gems, 0) + ? WHERE userId = ?`,
                    [coinsAwarded, gemsAwarded, userId]
                );

                const date = new Date().toISOString().slice(0, 10);
                await runAsync(`
                    INSERT INTO dailyQuestProgress (userId, questId, date, progress, completed)
                    VALUES (?, 'coins_1m', ?, ?, 0)
                    ON CONFLICT(userId, questId, date) DO UPDATE SET
                    progress = MIN(dailyQuestProgress.progress + ?, 1000000),
                    completed = CASE WHEN dailyQuestProgress.progress + ? >= 1000000 THEN 1 ELSE 0 END
                `, [userId, date, coinsAwarded, coinsAwarded, coinsAwarded]);

            } catch (err) {
                console.error(`Farming update failed for ${key}:`, err);
            }
        }, 60000);

        farmingIntervals.set(key, intervalId);
    } catch (err) {
        console.error(`startFarming error:`, err);
    }
}

async function resumeAllFarming() {
    try {
        const allFarming = await db.allAsync(`SELECT * FROM farmingFumos`);
        for (const row of allFarming) {
            const { userId, fumoName, coinsPerMin, gemsPerMin } = row;
            await startFarming(userId, fumoName, coinsPerMin, gemsPerMin);
        }
        console.log(`✅ Resumed ${allFarming.length} farming intervals.`);
    } catch (err) {
        console.error("Failed to resume farming:", err);
    }
}

module.exports = async (client) => {
    db.serialize(() => {

        // .addfarm / .af command
        client.on('messageCreate', async message => {
            if (message.author.bot ||
                (message.content !== '.addfarm' && !message.content.startsWith('.addfarm ') &&
                    message.content !== '.af' && !message.content.startsWith('.af '))) return;

            if (!await checkAccess(message)) return;

            const input = message.content.replace(/^\.addfarm\s+|^\.af\s+/i, '').trim();

            try {
                // Check if rarity-only input
                if (/^[a-zA-Z]+$/.test(input)) {
                    await logToDiscord(client, `User ${message.author.tag} added random ${input} Fumos`, Colors.Green);
                    return await addRandomByRarity(db, message, input);
                }

                // Parse: Name(Rarity) [Tag] Quantity
                const match = input.match(/^([a-zA-Z0-9]+)(?:\(([a-zA-Z]+)\))?(?:\s*\[([^\]]+)\])?\s*(\d+)?$/);
                if (!match) {
                    return message.reply({
                        embeds: [new EmbedBuilder().setDescription('❌ Invalid format. Use `.addfarm <Name>(Rarity) [Tag] <Quantity>`')]
                    });
                }

                const [, name, rarity, rawTag, quantityStr] = match;
                const quantity = parseInt(quantityStr, 10) || 1;

                if (quantity <= 0) {
                    return message.reply({
                        embeds: [new EmbedBuilder().setDescription('❌ Please provide a valid quantity.')]
                    });
                }

                const tag = rawTag ? rawTag.trim() : null;
                const fumoKey = `${name}${rarity ? `(${rarity})` : ''}${tag ? `[${tag}]` : ''}`;

                await logToDiscord(client, `User ${message.author.tag} added ${fumoKey} to farm`, Colors.Green);
                await addFumoToFarm(db, message, fumoKey);
            } catch (err) {
                console.error('Error in .addfarm:', err);
                await logToDiscord(client, `Error in .addfarm for ${message.author.tag}: ${err.message}`, Colors.Red);
                return message.reply({
                    embeds: [new EmbedBuilder().setDescription('⚠️ Something went wrong.')]
                });
            }
        });

        // .addbest / .ab command
        client.on('messageCreate', async (message) => {
            if ((!message.content.startsWith('.addbest') && !message.content.startsWith('.ab')) || message.author.bot) return;

            if (!await checkAccess(message)) return;

            const userId = message.author.id;
            const limit = await getFarmLimit(userId);

            const farmingFumos = await db.allAsync(`SELECT * FROM farmingFumos WHERE userId = ?`, [userId]);
            const currentFarm = farmingFumos.map(f => ({
                ...f,
                stats: getStatsByRarity(f.fumoName),
            }));

            const inventory = await db.allAsync(
                `SELECT fumoName, COUNT(*) as count FROM userInventory WHERE userId = ? GROUP BY fumoName`,
                [userId]
            );

            const farmNames = new Set(currentFarm.map(f => f.fumoName));

            const potential = inventory
                .filter(f => f.fumoName && typeof f.fumoName === 'string' && f.fumoName.trim())
                .map(f => {
                    const [coins, gems] = getStatsByRarity(f.fumoName);
                    return { ...f, stats: [coins, gems] };
                })
                .filter(f => !farmNames.has(f.fumoName))
                .sort((a, b) => (b.stats[0] + b.stats[1]) - (a.stats[0] + a.stats[1]));

            const combined = [...currentFarm, ...potential]
                .sort((a, b) => (b.stats[0] + b.stats[1]) - (a.stats[0] + a.stats[1]))
                .slice(0, limit);

            await db.runAsync(`DELETE FROM farmingFumos WHERE userId = ?`, [userId]);

            let added = 0;
            for (const fumo of combined) {
                const [coins, gems] = fumo.stats;
                await runAsync(
                    `INSERT INTO farmingFumos (userId, fumoName, coinsPerMin, gemsPerMin) VALUES (?, ?, ?, ?)`,
                    [userId, fumo.fumoName, coins, gems]
                );
                startFarming(userId, fumo.fumoName, coins, gems);
                added++;
            }

            await logToDiscord(client, `User ${message.author.tag} optimized farm with ${added} Fumos`, Colors.Blue);
            return message.reply({
                embeds: [new EmbedBuilder().setDescription(`🌾 Optimized your farm with the ${added} best Fumo(s).`)]
            });
        });

        // .endfarm / .ef command
        client.on('messageCreate', async (message) => {
            if ((!message.content.startsWith('.endfarm') && !message.content.startsWith('.ef')) || message.author.bot) return;

            if (!await checkAccess(message)) return;

            const escapeRegex = str => str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');

            const args = message.content.match(/^(\.endfarm|\.ef)\s+([^\s(]+)(?:\(([^()]+)\))?(?:\s*\[(.*?)\])?\s*(\d+)?$/);

            if (!args) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setTitle('❗ Invalid Command Format')
                        .setDescription(
                            `Please use one of the following:\n\n` +
                            `• \`.endfarm all\` — Remove all Fumos\n` +
                            `• \`.endfarm <Name>(<Rarity>)\` — Remove specific Fumo\n` +
                            `• \`.endfarm <Rarity>\` — Remove all of a rarity`
                        )],
                });
            }

            const [, , fumoName, rarity, extraInfo, quantity] = args;
            const fumoQuantity = parseInt(quantity, 10) || 1;

            const validRarities = [
                '!!!', 'Equinox', 'SPECIAL', 'TRANSCENDENT', 'ETERNAL', 'INFINITE',
                'CELESTIAL', 'ASTRAL', '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY',
                'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON', 'Common'
            ];

            try {
                // Remove all
                if (fumoName === 'all') {
                    await stopAllFarming(message.author.id);
                    await logToDiscord(client, `User ${message.author.tag} removed all Fumos from farm`, Colors.Orange);
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(Colors.Green)
                            .setDescription(`✅ Successfully removed all Fumos from the farm.`)],
                    });
                }

                // Remove by rarity only
                if (!rarity && validRarities.includes(fumoName)) {
                    const targetRarity = fumoName;
                    const rows = await db.allAsync(`SELECT fumoName FROM farmingFumos WHERE userId = ?`, [message.author.id]);

                    const matchingFumos = rows
                        .map(row => row.fumoName)
                        .filter(f => {
                            const match = f.match(/\(([^)]+)\)$/);
                            return match && match[1] === targetRarity;
                        });

                    if (matchingFumos.length === 0) {
                        return message.reply({
                            embeds: [new EmbedBuilder()
                                .setColor(Colors.Yellow)
                                .setDescription(`❗ No Fumos of rarity ${targetRarity} found in your farm.`)],
                        });
                    }

                    for (const fumo of matchingFumos) {
                        const row = await db.getAsync(
                            `SELECT quantity FROM farmingFumos WHERE userId = ? AND fumoName = ?`,
                            [message.author.id, fumo]
                        );
                        if (row) {
                            await stopFumoWithQuantity(message.author.id, fumo, row.quantity);
                            await db.runAsync(`DELETE FROM farmingFumos WHERE userId = ? AND fumoName = ?`, [message.author.id, fumo]);
                        }
                    }

                    await logToDiscord(client, `User ${message.author.tag} removed all ${targetRarity} Fumos`, Colors.Orange);
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(Colors.Green)
                            .setDescription(`✅ Successfully removed all ${targetRarity} Fumos from the farm.`)],
                    });
                }

                // Remove by name + rarity
                if (rarity) {
                    const escapedName = escapeRegex(fumoName);
                    const escapedRarity = escapeRegex(rarity);
                    const regexFumoKey = `^${escapedName}\\(${escapedRarity}\\)(\\[.*\\])?$`;

                    const rows = await db.allAsync(
                        `SELECT fumoName, quantity FROM farmingFumos WHERE userId = ?`,
                        [message.author.id]
                    );

                    const matchedFumo = rows.find(row => new RegExp(regexFumoKey).test(row.fumoName));

                    if (!matchedFumo) {
                        return message.reply({
                            embeds: [new EmbedBuilder()
                                .setColor(Colors.Red)
                                .setDescription(`❗ No ${fumoName}(${rarity}) variants found in your farm.`)],
                        });
                    }

                    if (matchedFumo.quantity < fumoQuantity) {
                        return message.reply({
                            embeds: [new EmbedBuilder()
                                .setColor(Colors.Yellow)
                                .setDescription(`❗ Not enough ${matchedFumo.fumoName}(s) in the farm to remove.`)],
                        });
                    }

                    await db.runAsync(
                        `UPDATE farmingFumos SET quantity = quantity - ? WHERE userId = ? AND fumoName = ?`,
                        [fumoQuantity, message.author.id, matchedFumo.fumoName]
                    );

                    await stopFumoWithQuantity(message.author.id, matchedFumo.fumoName, fumoQuantity);

                    await logToDiscord(client, `User ${message.author.tag} removed ${fumoQuantity}x ${matchedFumo.fumoName}`, Colors.Orange);
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(Colors.Green)
                            .setDescription(`✅ Successfully removed ${fumoQuantity} ${matchedFumo.fumoName}(s) from the farm.`)],
                    });
                }

                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription(`❗ Invalid input. Provide a valid Fumo name and optionally a quantity or rarity.`)],
                });
            } catch (err) {
                console.error(err);
                await logToDiscord(client, `Error in .endfarm for ${message.author.tag}: ${err.message}`, Colors.Red);
                message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription(`❗ Unexpected error occurred. Try again later.`)],
                });
            }
        });

        // .farmcheck / .fc command
        client.on('messageCreate', async (message) => {
            if ((!message.content.startsWith('.farmcheck') && !message.content.startsWith('.fc')) || message.author.bot) return;

            if (!await checkAccess(message)) return;

            const userId = message.author.id;

            const fragmentUses = (await db.getAsync(`SELECT fragmentUses FROM userUpgrades WHERE userId = ?`, [userId]))?.fragmentUses ?? 0;
            const maxFarmingFumos = 5 + fragmentUses;

            const rows = await db.allAsync(`SELECT fumoName, coinsPerMin, gemsPerMin, quantity FROM farmingFumos WHERE userId = ?`, [userId]);

            if (rows.length === 0) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(Colors.Blue)
                        .setDescription('🤷‍♂️ No Fumos are currently farming. Time to get started!')],
                });
            }

            const { coinMultiplier, gemMultiplier, boosts } = await getActiveBoostMultipliers(userId);

            const rarityOrder = [
                'TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL',
                '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY',
                'EPIC', 'RARE', 'UNCOMMON', 'Common'
            ];

            const stripRarityFromName = (fumoName) => fumoName.replace(/\((.*?)\)/g, '').trim();

            const fumoByRarity = {};
            let totalCoinsPerMinBoosted = 0;
            let totalGemsPerMinBoosted = 0;

            rows.forEach(row => {
                const fumoName = row.fumoName;
                const quantity = row.quantity || 1;
                const rarity = getRarity(fumoName);

                let multiplier = 1;
                if (/✨|SHINY/i.test(fumoName)) multiplier *= 2;
                if (/🌟|alG/i.test(fumoName)) multiplier *= 100;

                if (!fumoByRarity[rarity]) {
                    fumoByRarity[rarity] = { names: {}, coinsBoosted: 0, gemsBoosted: 0 };
                }

                const cleanName = stripRarityFromName(fumoName);
                fumoByRarity[rarity].names[cleanName] = (fumoByRarity[rarity].names[cleanName] || 0) + quantity;

                const coins = (row.coinsPerMin || 0) * quantity * multiplier;
                const gems = (row.gemsPerMin || 0) * quantity * multiplier;
                const coinsBoosted = Math.floor(coins * coinMultiplier);
                const gemsBoosted = Math.floor(gems * gemMultiplier);

                fumoByRarity[rarity].coinsBoosted += coinsBoosted;
                fumoByRarity[rarity].gemsBoosted += gemsBoosted;

                totalCoinsPerMinBoosted += coinsBoosted;
                totalGemsPerMinBoosted += gemsBoosted;
            });

            const embed = new EmbedBuilder()
                .setTitle('🌾 Fumo Farming Status')
                .setColor(Colors.Blurple)
                .setImage('https://tse4.mm.bing.net/th/id/OIP.uPn1KR9q8AKKhhJVCr1C4QHaDz?rs=1&pid=ImgDetMain&o=7&rm=3')
                .setDescription(`🛠️ Your Fumos are working hard. Let's check how much loot they're bringing!`)
                .addFields({
                    name: '📋 Notes:',
                    value: 'Use `.endfarm` to stop farming specific Fumos.\nCheck `.farminfo` for rarity stats.',
                });

            for (const rarity of rarityOrder) {
                if (!fumoByRarity[rarity]) continue;

                const { names, coinsBoosted, gemsBoosted } = fumoByRarity[rarity];
                const nameList = Object.entries(names)
                    .map(([name, count]) => `${name}${count > 1 ? ` (x${count})` : ''}`)
                    .join(', ');

                embed.addFields({
                    name: `🔹 ${rarity}: ${formatNumber(coinsBoosted)} coins/min, ${formatNumber(gemsBoosted)} gems/min`,
                    value: nameList || 'None',
                });
            }

            embed.addFields(
                { name: '💰 Total Earnings (with boosts)', value: `${formatNumber(totalCoinsPerMinBoosted)} coins/min | ${formatNumber(totalGemsPerMinBoosted)} gems/min`, inline: true },
                { name: '📦 Max Farming Slots', value: `${rows.length} / ${maxFarmingFumos}`, inline: true },
                { name: '🔮 Fragment of 1800s', value: `${fragmentUses} used`, inline: true },
            );

            if (boosts && boosts.length > 0) {
                embed.addFields({
                    name: '⚡ Active Boosts',
                    value: boosts.map(b =>
                        `• **${b.type}** x${b.multiplier} from [${b.source}]${b.expiresAt ? ` (expires <t:${Math.floor(b.expiresAt / 1000)}:R>)` : ''}`
                    ).join('\n')
                });
            }

            message.reply({ embeds: [embed] }).catch(console.error);
        });

        // .farminfo / .fi command
        client.on('messageCreate', async (message) => {
            if ((!message.content.startsWith('.farminfo') && !message.content.startsWith('.fi')) || message.author.bot) return;

            if (!await checkAccess(message)) return;

            const embed = new EmbedBuilder()
                .setTitle('🧠 Fumo Farming Info')
                .setColor('Purple')
                .setDescription(
                    `💡 **Note**:\nEach Fumo has a different power rate based on its rarity.\nYou can stop farming anytime using \`.endfarm <fumo name>\`.`
                )
                .addFields([{
                    name: '📢 Power by Rarity',
                    value:
                        `\`\`\`\n` +
                        `🌿 Common          → 25 coins/min    | 5 gems/min\n` +
                        `🍀 Uncommon        → 45 coins/min    | 10 gems/min\n` +
                        `🔷 Rare            → 70 coins/min    | 20 gems/min\n` +
                        `💎 Epic            → 100 coins/min   | 35 gems/min\n` +
                        `🌌 Otherworldly    → 150 coins/min   | 50 gems/min\n` +
                        `🏆 Legendary       → 200 coins/min   | 75 gems/min\n` +
                        `🌠 Mythical        → 350 coins/min   | 115 gems/min\n` +
                        `🎟️ Exclusive       → 500 coins/min   | 150 gems/min\n` +
                        `❓ ???             → 750 coins/min   | 220 gems/min\n` +
                        `🌟 Astral          → 1,000 coins/min | 450 gems/min\n` +
                        `🌙 Celestial       → 2,000 coins/min | 700 gems/min\n` +
                        `♾️ Infinite        → 3,500 coins/min | 915 gems/min\n` +
                        `🕊️ Eternal         → 5,000 coins/min | 1,150 gems/min\n` +
                        `💫 Transcendent    → 25,000 coins/min| 2,500 gems/min\n` +
                        `\`\`\``
                }])
                .setFooter({ text: 'Extra traits on fumo can boost farming rates too!' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        });

        // Startup: Resume all farming
        client.once('ready', async () => {
            await resumeAllFarming();
            await logToDiscord(client, '✅ Farming system initialized and all intervals resumed.', Colors.Green);
        });
    });
}