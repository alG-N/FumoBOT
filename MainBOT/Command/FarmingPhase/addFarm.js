const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { promisify } = require('util');
const db = require('../database/db');
db.getAsync = promisify(db.get).bind(db);
db.allAsync = promisify(db.all).bind(db);
db.runAsync = (...args) => new Promise((resolve, reject) => {
    db.run(...args, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});
const farmingIntervals = new Map();
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
module.exports = async (client) => {
    db.serialize(() => {
        // Helper: get active boost multipliers for a user (separate for coins/gems)
        async function getActiveBoostMultipliers(userId) {
            let coinMultiplier = 1;
            let gemMultiplier = 1;
            let coinSources = [];
            let gemSources = [];
            let boosts = [];
            try {
                const now = Date.now();
                boosts = await db.allAsync(
                    `SELECT type, multiplier, source, expiresAt, stack, uses FROM activeBoosts WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
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

        function getRarity(fumoName) {
            if (!fumoName) return 'Unknown';
            const rarities = ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON'];
            return fumoName ? (rarities.find(r => fumoName.includes(r)) || 'Common') : 'Unknown';
        }
        // Get farming stats by rarity
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

            // Boosts
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
        // Add farming Fumo(s)
        async function addFumoToFarm(db, message, fumoName) {
            const userId = message.author.id;

            const [upgradeRow] = await db.allAsync(`SELECT fragmentUses FROM userUpgrades WHERE userId = ?`, [userId]);
            const limit = 5 + (upgradeRow?.fragmentUses || 0);

            const farmingFumos = await db.allAsync(`SELECT * FROM farmingFumos WHERE userId = ?`, [userId]);
            if (farmingFumos.length >= limit) {
                return message.reply({
                    embeds: [new EmbedBuilder().setDescription(`🚜 Your farm is full. Max ${limit} Fumos allowed.`)]
                });
            }

            const alreadyFarming = farmingFumos.find(f => f.fumoName === fumoName);
            if (alreadyFarming) {
                return message.reply({
                    embeds: [new EmbedBuilder().setDescription(`🚜 You're already farming a ${fumoName} Fumo.`)]
                });
            }

            const [inventoryRow] = await db.allAsync(`SELECT COUNT(*) as count FROM userInventory WHERE userId = ? AND fumoName = ?`, [userId, fumoName]);
            const inventoryCount = inventoryRow?.count || 0;

            if (inventoryCount <= 0) {
                return message.reply({
                    embeds: [new EmbedBuilder().setDescription(`🔍 You don't have a ${fumoName} Fumo in your inventory.`)]
                });
            }

            const rarity = getRarity(fumoName);
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
        // Add random fumos by rarity
        async function addRandomByRarity(db, message, rarity) {
            const userId = message.author.id;

            const [upgradeRow] = await db.allAsync(`SELECT fragmentUses FROM userUpgrades WHERE userId = ?`, [userId]);
            const limit = 5 + (upgradeRow?.fragmentUses || 0);

            const farmingFumos = await db.allAsync(`SELECT * FROM farmingFumos WHERE userId = ?`, [userId]);
            const availableSlots = limit - farmingFumos.length;
            if (availableSlots <= 0) {
                return message.reply({ embeds: [new EmbedBuilder().setDescription(`🚜 Your farm is full.`)] });
            }

            const inventory = await db.allAsync(
                `SELECT fumoName, COUNT(*) as count FROM userInventory WHERE userId = ? GROUP BY fumoName`,
                [userId]
            );

            // Shuffle inventory to pick random order
            inventory.sort(() => Math.random() - 0.5);

            let added = 0;

            for (const item of inventory) {
                if (getRarity(item.fumoName) !== rarity) continue;

                const isAlreadyFarming = farmingFumos.some(f => f.fumoName === item.fumoName);
                if (isAlreadyFarming) continue;

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
        // Command listener
        client.on('messageCreate', async message => {
            if (message.author.bot || (message.content !== '.addfarm' && !message.content.startsWith('.addfarm ') && message.content !== '.af' && !message.content.startsWith('.af '))) return;

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
                        const days = Math.floor((remaining / (1000 * 60 * 60 * 24)));

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

            const args = message.content.trim().split(' ');

            try {
                const input = message.content.replace(/^\.addfarm\s+|^\.af\s+/i, '').trim();

                // Check if this is just a rarity input like ".addfarm Common"
                const rarityOnly = input.match(/^[a-zA-Z]+$/);
                if (rarityOnly) {
                    const rarity = input;
                    return await addRandomByRarity(db, message, rarity);
                }

                // Regex: Name(Rarity) [Tag] Quantity
                const match = input.match(/^([a-zA-Z0-9]+)(?:\(([a-zA-Z]+)\))?(?:\s*\[([^\]]+)\])?\s*(\d+)?$/);
                if (!match) {
                    return message.reply({ embeds: [new EmbedBuilder().setDescription('❌ Invalid command format. Use `.addfarm <Name>(Rarity) [Tag] <Quantity>`')] });
                }

                const [, name, rarity, rawTag, quantityStr] = match;

                const quantity = parseInt(quantityStr, 10) || 1;
                if (quantity <= 0) {
                    return message.reply({ embeds: [new EmbedBuilder().setDescription('❌ Please provide a valid quantity.')] });
                }

                const tag = rawTag ? rawTag.trim() : null;
                const fumoKey = `${name}${rarity ? `(${rarity})` : ''}${tag ? `[${tag}]` : ''}`;

                await addFumoToFarm(db, message, fumoKey, quantity);
            } catch (err) {
                console.error('Error in .addfarm:', err);
                return message.reply({ embeds: [new EmbedBuilder().setDescription('⚠️ Something went wrong while processing your request.')] });
            }
        });
        // Add the best fumo possible
        client.on('messageCreate', async (message) => {
            if ((message.content.startsWith('.addbest') || message.content.startsWith('.ab')) && !message.author.bot) {

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
                            const days = Math.floor((remaining / (1000 * 60 * 60 * 24)));

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

                const userId = message.author.id;
                const [upgradeRow] = await db.allAsync(`SELECT fragmentUses FROM userUpgrades WHERE userId = ?`, [userId]);
                const limit = 5 + (upgradeRow?.fragmentUses || 0);

                const farmingFumos = await db.allAsync(`SELECT * FROM farmingFumos WHERE userId = ?`, [userId]);
                const currentFarm = farmingFumos.map(f => ({
                    ...f,
                    stats: getStatsByRarity(f.fumoName),
                }));

                const inventory = await db.allAsync(`
                SELECT fumoName, COUNT(*) as count FROM userInventory 
                WHERE userId = ? GROUP BY fumoName
            `, [userId]);

                const farmNames = new Set(currentFarm.map(f => f.fumoName));

                const potential = inventory
                    .filter(f => f.fumoName && typeof f.fumoName === 'string' && f.fumoName.trim())
                    .map(f => {
                        const [coins, gems] = getStatsByRarity(f.fumoName);
                        return { ...f, stats: [coins, gems] };
                    })
                    .filter(f => !farmNames.has(f.fumoName)) // only if not already farming
                    .sort((a, b) => (b.stats[0] + b.stats[1]) - (a.stats[0] + a.stats[1])); // sort by total income

                const combined = [...currentFarm, ...potential]
                    .sort((a, b) => (b.stats[0] + b.stats[1]) - (a.stats[0] + a.stats[1]))
                    .slice(0, limit);

                // Remove all current farming fumos
                await db.runAsync(`DELETE FROM farmingFumos WHERE userId = ?`, [userId]);

                let added = 0;
                for (const fumo of combined) {
                    const [coins, gems] = fumo.stats;
                    await runAsync(
                        `INSERT INTO farmingFumos (userId, fumoName, coinsPerMin, gemsPerMin) VALUES (?, ?, ?, ?)`,
                        [userId, fumo.fumoName, coins, gems]
                    );
                    const farmingId = await db.getAsync(`SELECT last_insert_rowid() AS id`);
                    startFarming(userId, fumo.fumoName, coins, gems, farmingId.id);
                    added++;
                }

                return message.reply({ embeds: [new EmbedBuilder().setDescription(`🌾 Optimized your farm with the ${added} best Fumo(s).`)] });
            }
        });
        //Start the Farming
        const generateFarmingKey = (userId, fumoName) => `${userId}-${fumoName}`;
        async function stopAllFarming(userId) {
            try {
                const rows = await db.allAsync(`SELECT fumoName FROM farmingFumos WHERE userId = ?`, [userId]);

                if (rows.length === 0) {
                    console.log(`No farming entries found for user ${userId}.`);
                    return;
                }

                for (const row of rows) {
                    const key = generateFarmingKey(userId, row.fumoName);

                    if (farmingIntervals.has(key)) {
                        clearInterval(farmingIntervals.get(key));
                        farmingIntervals.delete(key);
                    }

                    await runAsync(`DELETE FROM farmingFumos WHERE userId = ? AND fumoName = ?`, [userId, row.fumoName]);
                }

                console.log(`Finished clearing all farming for ${userId}.`);
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

                if (!row) {
                    console.log(`No entry for ${fumoName} found.`);
                    return;
                }

                const key = generateFarmingKey(userId, fumoName);

                if (quantity >= row.quantity) {
                    // Remove all
                    if (farmingIntervals.has(key)) {
                        clearInterval(farmingIntervals.get(key));
                        farmingIntervals.delete(key);
                    }

                    await runAsync(`DELETE FROM farmingFumos WHERE userId = ? AND fumoName = ?`, [userId, fumoName]);
                    console.log(`Removed all '${fumoName}' from farming.`);
                } else {
                    // Partial reduction
                    await runAsync(`UPDATE farmingFumos SET quantity = quantity - ? WHERE userId = ? AND fumoName = ?`, [quantity, userId, fumoName]);
                    console.log(`Decreased '${fumoName}' quantity by ${quantity}.`);
                }

            } catch (err) {
                console.error(`stopFumoWithQuantity error for ${userId}:`, err);
            }
        }

        // Farming update batching system
        // Add this to your addFarm.js module

        class FarmingUpdateBatcher {
            constructor(db, flushInterval = 5000) {
                this.db = db;
                this.updates = new Map(); // userId -> {coins, gems, quests}
                this.flushInterval = flushInterval;
                this.isProcessing = false;

                // Auto-flush timer
                this.timer = setInterval(() => this.flush(), this.flushInterval);
            }

            addUpdate(userId, coins, gems, questCoins = 0) {
                if (!this.updates.has(userId)) {
                    this.updates.set(userId, { coins: 0, gems: 0, questCoins: 0 });
                }

                const update = this.updates.get(userId);
                update.coins += coins;
                update.gems += gems;
                update.questCoins += questCoins;
            }

            async flush() {
                if (this.isProcessing || this.updates.size === 0) return;

                this.isProcessing = true;
                const updates = new Map(this.updates);
                this.updates.clear();

                try {
                    // Use a single transaction for all updates
                    await new Promise((resolve, reject) => {
                        this.db.serialize(() => {
                            this.db.run("BEGIN IMMEDIATE TRANSACTION", (err) => {
                                if (err) return reject(err);

                                let completed = 0;
                                const total = updates.size;

                                updates.forEach((data, userId) => {
                                    // Update coins and gems
                                    this.db.run(
                                        `UPDATE userCoins SET 
                  coins = COALESCE(coins, 0) + ?, 
                  gems = COALESCE(gems, 0) + ? 
                WHERE userId = ?`,
                                        [data.coins, data.gems, userId],
                                        (err) => {
                                            if (err) console.error(`Error updating coins for ${userId}:`, err);
                                        }
                                    );

                                    // Update quest progress if needed
                                    if (data.questCoins > 0) {
                                        const date = new Date().toISOString().slice(0, 10);
                                        const questId = "coins_1m";

                                        this.db.run(
                                            `INSERT INTO dailyQuestProgress (userId, questId, date, progress, completed)
                  VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(userId, questId, date) DO UPDATE SET
                    progress = MIN(dailyQuestProgress.progress + ?, 1000000),
                    completed = CASE 
                      WHEN dailyQuestProgress.progress + ? >= 1000000 THEN 1
                      ELSE dailyQuestProgress.completed
                    END`,
                                            [userId, questId, date, data.questCoins, 0, data.questCoins, data.questCoins],
                                            (err) => {
                                                if (err) console.error(`Error updating quest for ${userId}:`, err);
                                            }
                                        );
                                    }

                                    completed++;
                                    if (completed === total) {
                                        this.db.run("COMMIT", (err) => {
                                            if (err) {
                                                console.error("Batch commit error:", err);
                                                this.db.run("ROLLBACK");
                                                reject(err);
                                            } else {
                                                resolve();
                                            }
                                        });
                                    }
                                });
                            });
                        });
                    });

                    console.log(`✅ Flushed ${updates.size} farming updates`);
                } catch (err) {
                    console.error("Error flushing farming updates:", err);

                    // Put failed updates back in queue
                    updates.forEach((data, userId) => {
                        this.addUpdate(userId, data.coins, data.gems, data.questCoins);
                    });
                } finally {
                    this.isProcessing = false;
                }
            }

            destroy() {
                clearInterval(this.timer);
                this.flush(); // Final flush
            }
        }

        // Create global batcher instance
        const farmingBatcher = new FarmingUpdateBatcher(db, 5000);

        // Modified startFarming function using batcher
        async function startFarming(userId, fumoName, coinsPerMin, gemsPerMin) {
            try {
                if (!fumoName || typeof fumoName !== 'string' || !fumoName.trim()) {
                    console.warn(`Skipping farming start: Invalid fumoName for user ${userId}`);
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

                if (farmingIntervals.has(key)) {
                    return;
                }

                const intervalId = setInterval(async () => {
                    try {
                        // Quick inventory check (read-only, no lock)
                        const inventoryRow = await db.getAsync(
                            `SELECT quantity FROM userInventory WHERE userId = ? AND fumoName = ?`,
                            [userId, fumoName]
                        );

                        if (!inventoryRow || inventoryRow.quantity <= 0) {
                            clearInterval(farmingIntervals.get(key));
                            farmingIntervals.delete(key);
                            await runAsync(
                                `DELETE FROM farmingFumos WHERE userId = ? AND fumoName = ?`,
                                [userId, fumoName]
                            );
                            return;
                        }

                        // Get boost multipliers (cached or from DB)
                        const { coinMultiplier, gemMultiplier } = await getActiveBoostMultipliers(userId);

                        const coinsAwarded = Math.floor(coinsPerMin * quantity * coinMultiplier);
                        const gemsAwarded = Math.floor(gemsPerMin * quantity * gemMultiplier);

                        // Add to batch instead of immediate DB write
                        farmingBatcher.addUpdate(userId, coinsAwarded, gemsAwarded, coinsAwarded);

                    } catch (err) {
                        console.error(`Farming update failed for ${key}:`, err);
                    }
                }, 60000);

                farmingIntervals.set(key, intervalId);
            } catch (err) {
                console.error(`startFarming error for ${userId}, ${fumoName}:`, err);
            }
        }

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('Shutting down farming system...');
            farmingBatcher.destroy();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('Shutting down farming system...');
            farmingBatcher.destroy();
            process.exit(0);
        });

        // Endfarm Command
        client.on('messageCreate', async (message) => {
            if ((!message.content.startsWith('.endfarm') && !message.content.startsWith('.ef')) || message.author.bot) return;

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

            // Utility function to safely escape RegExp strings
            const escapeRegex = str => str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');

            // Updated regex to allow rarities like ???, !!!, etc.
            const args = message.content.match(
                /^(\.endfarm|\.ef)\s+([^\s(]+)(?:\(([^()]+)\))?(?:\s*\[(.*?)\])?\s*(\d+)?$/
            );
            if (!args) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setTitle('❗ Invalid Command Format')
                        .setDescription(
                            [
                                `Please use one of the following valid formats:`,
                                `\u200B`,
                                `• \`.endfarm all\` — Remove all Fumos from your farm`,
                                `• \`.endfarm <FumoName>(<Rarity>)\` — Remove Fumo with specified rarity (e.g. \`.endfarm Cirno(LEGENDARY)\`)`,
                                `• \`.endfarm <Rarity>\` — Remove all Fumos of a specific rarity (e.g. \`.endfarm LEGENDARY\`)`,
                            ].join('\n')
                        )],
                });
            }

            const [, , fumoName, rarity, extraInfo, quantity] = args;
            const fumoRarity = rarity || null;
            const fumoTags = extraInfo ? `[${extraInfo}]` : "";
            const fumoQuantity = parseInt(quantity, 10) || 1;

            const validRarities = [
                '!!!', 'Equinox', 'SPECIAL', 'TRANSCENDENT', 'ETERNAL', 'INFINITE',
                'CELESTIAL', 'ASTRAL', '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY',
                'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON', 'Common'
            ];

            try {
                if (fumoName === 'all') {
                    await stopAllFarming(message.author.id);
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(Colors.Green)
                            .setDescription(`✅ Successfully removed all Fumos from the farm.`)],
                    });
                }

                // ✅ RARITY-ONLY CASE (e.g. ".endfarm ???")
                if (!rarity && validRarities.includes(fumoName)) {
                    const targetRarity = fumoName;

                    db.all(`SELECT fumoName FROM farmingFumos WHERE userId = ?`, [message.author.id], async (err, rows) => {
                        if (err) {
                            console.error(`DB error fetching farmingFumos: ${err.message}`);
                            return message.reply({
                                embeds: [new EmbedBuilder()
                                    .setColor(Colors.Red)
                                    .setDescription(`❗ Error checking your farm.`)],
                            });
                        }

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
                            db.get(`SELECT quantity FROM farmingFumos WHERE userId = ? AND fumoName = ?`, [message.author.id, fumo], async (err, row) => {
                                if (err) {
                                    console.error(`Error fetching quantity for ${fumo}: ${err.message}`);
                                    return;
                                }

                                if (!row) return;

                                const currentQty = row.quantity;

                                await stopFumoWithQuantity(message.author.id, fumo, currentQty);

                                db.run(`DELETE FROM farmingFumos WHERE userId = ? AND fumoName = ?`, [message.author.id, fumo]);
                            });
                        }

                        return message.reply({
                            embeds: [new EmbedBuilder()
                                .setColor(Colors.Green)
                                .setDescription(`✅ Successfully removed all Fumos of rarity ${targetRarity} from the farm.`)],
                        });
                    });

                    return;
                }

                // ✅ NAME + RARITY CASE (e.g. ".endfarm GawrGura(???)")
                if (rarity) {
                    const escapedName = escapeRegex(fumoName);
                    const escapedRarity = escapeRegex(fumoRarity);
                    const regexFumoKey = `^${escapedName}\\(${escapedRarity}\\)(\\[.*\\])?$`;
                    // console.log("Looking for regex match:", regexFumoKey);

                    db.all(`
            SELECT fumoName, quantity FROM farmingFumos 
            WHERE userId = ?`, [message.author.id], async (err, rows) => {
                        if (err) {
                            console.error(`DB error fetching farmingFumos: ${err.message}`);
                            return message.reply({
                                embeds: [new EmbedBuilder()
                                    .setColor(Colors.Red)
                                    .setDescription(`❗ Error checking your farm.`)],
                            });
                        }

                        const matchedFumo = rows.find(row => {
                            const regex = new RegExp(regexFumoKey);
                            return regex.test(row.fumoName);
                        });

                        if (!matchedFumo) {
                            return message.reply({
                                embeds: [new EmbedBuilder()
                                    .setColor(Colors.Red)
                                    .setDescription(`❗ No ${fumoName}(${fumoRarity}) variants found in your farm.`)],
                            });
                        }

                        if (matchedFumo.quantity < fumoQuantity) {
                            return message.reply({
                                embeds: [new EmbedBuilder()
                                    .setColor(Colors.Yellow)
                                    .setDescription(`❗ Not enough ${matchedFumo.fumoName}(s) in the farm to remove.`)],
                            });
                        }

                        db.run(`
                UPDATE farmingFumos 
                SET quantity = quantity - ? 
                WHERE userId = ? AND fumoName = ?`,
                            [fumoQuantity, message.author.id, matchedFumo.fumoName],
                            async function (err) {
                                if (err) {
                                    console.error(`Error updating farming entry for ${matchedFumo.fumoName}: ${err.message}`);
                                    return message.reply({
                                        embeds: [new EmbedBuilder()
                                            .setColor(Colors.Red)
                                            .setDescription(`❗ Error removing ${fumoQuantity} ${matchedFumo.fumoName}(s) from the farm.`)],
                                    });
                                }

                                await stopFumoWithQuantity(message.author.id, matchedFumo.fumoName, fumoQuantity);

                                return message.reply({
                                    embeds: [new EmbedBuilder()
                                        .setColor(Colors.Green)
                                        .setDescription(`✅ Successfully removed ${fumoQuantity} ${matchedFumo.fumoName}(s) from the farm.`)],
                                });
                            });
                    });
                } else {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setDescription(`❗ Invalid input. Provide a valid Fumo name and optionally a quantity or rarity.`)],
                    });
                }
            } catch (err) {
                console.error(err);
                message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription(`❗ Unexpected error occurred. Try again later.`)],
                });
            }
        });
        // Farm-check Command
        client.on('messageCreate', async (message) => {
            if ((!message.content.startsWith('.farmcheck') && !message.content.startsWith('.fc')) || message.author.bot) return;

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

            // Helper: format numbers to 1k, 1m, 1b, etc.
            function formatNumber(num) {
                if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\.00$/, '') + 'b';
                if (num >= 1e6) return (num / 1e6).toFixed(2).replace(/\.00$/, '') + 'm';
                if (num >= 1e3) return (num / 1e3).toFixed(2).replace(/\.00$/, '') + 'k';
                return num.toString();
            }

            // Get active boost multipliers for this user
            async function getActiveBoostMultipliers(userId) {
                let coinMultiplier = 1;
                let gemMultiplier = 1;
                let coinSources = [];
                let gemSources = [];
                let boosts = [];
                try {
                    const now = Date.now();
                    boosts = await db.allAsync(
                        `SELECT type, multiplier, source, expiresAt, stack, uses FROM activeBoosts WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
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

            db.get(`SELECT fragmentUses FROM userUpgrades WHERE userId = ?`, [message.author.id], async (err, row) => {
                if (err) return message.reply('⚠️ Could not retrieve farming data.');

                const fragmentUses = row?.fragmentUses ?? 0;
                const maxFarmingFumos = 5 + fragmentUses;

                db.all(`SELECT fumoName, coinsPerMin, gemsPerMin, rarity, quantity FROM farmingFumos WHERE userId = ?`, [message.author.id], async (err, rows) => {
                    if (err) return message.reply('⚠️ Error loading farming data.');

                    if (rows.length === 0) {
                        return message.reply({
                            embeds: [new EmbedBuilder()
                                .setColor(Colors.Blue)
                                .setDescription('🤷‍♂️ No Fumos are currently farming. Time to get started!')],
                        });
                    }

                    // Get boost multipliers
                    const { coinMultiplier, gemMultiplier, coinSources, gemSources, boosts } = await getActiveBoostMultipliers(message.author.id);

                    const rarityOrder = [
                        'TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL',
                        '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY',
                        'EPIC', 'RARE', 'UNCOMMON', 'Common'
                    ];

                    // Determines rarity from name (ex: Aya(EPIC) -> EPIC)
                    function getRarity(fumoName) {
                        const rarities = rarityOrder;
                        return rarities.find(r => fumoName.includes(r)) || 'Common';
                    }

                    // Clean name (remove (RARITY))
                    function stripRarityFromName(fumoName) {
                        return fumoName.replace(/\((.*?)\)/g, '').trim();
                    }

                    // Flatten and group identical fumos
                    const fumoByRarity = {};
                    let totalCoinsPerMin = 0;
                    let totalGemsPerMin = 0;
                    let totalCoinsPerMinBoosted = 0;
                    let totalGemsPerMinBoosted = 0;

                    rows.forEach(row => {
                        const fumoName = row.fumoName;
                        const quantity = row.quantity || 1;
                        const rarity = getRarity(fumoName);

                        // Determine multipliers
                        let multiplier = 1;
                        if (/✨|SHINY/i.test(fumoName)) multiplier *= 2;
                        if (/🌟|alG/i.test(fumoName)) multiplier *= 100;

                        if (!fumoByRarity[rarity]) {
                            fumoByRarity[rarity] = { names: {}, coins: 0, gems: 0, coinsBoosted: 0, gemsBoosted: 0 };
                        }

                        const cleanName = stripRarityFromName(fumoName);
                        fumoByRarity[rarity].names[cleanName] = (fumoByRarity[rarity].names[cleanName] || 0) + quantity;

                        const coins = (row.coinsPerMin || 0) * quantity;
                        const gems = (row.gemsPerMin || 0) * quantity;
                        const coinsBoosted = Math.floor(coins * multiplier * coinMultiplier);
                        const gemsBoosted = Math.floor(gems * multiplier * gemMultiplier);

                        fumoByRarity[rarity].coins += coins * multiplier;
                        fumoByRarity[rarity].gems += gems * multiplier;
                        fumoByRarity[rarity].coinsBoosted += coinsBoosted;
                        fumoByRarity[rarity].gemsBoosted += gemsBoosted;

                        totalCoinsPerMin += coins * multiplier;
                        totalGemsPerMin += gems * multiplier;
                        totalCoinsPerMinBoosted += coinsBoosted;
                        totalGemsPerMinBoosted += gemsBoosted;
                    });

                    const embed = new EmbedBuilder()
                        .setTitle('🌾 Fumo Farming Status')
                        .setColor(Colors.Blurple)
                        .setImage('https://farmingsimulator22mods.it/wp-content/uploads/2022/01/fumo-di-scarico-nero-v1-0-1.jpg')
                        .setDescription('🛠️ Your Fumos are working hard. Let’s check how much loot they’re bringing!')
                        .addFields({
                            name: '📋 Notes:',
                            value: 'Use `.endfarm` to stop farming specific Fumos.\nCheck the full power breakdown in the manual or `.farminfo`.',
                        });

                    // Build embed fields from sorted rarities
                    for (const rarity of rarityOrder) {
                        if (!fumoByRarity[rarity]) continue;

                        const { names, coins, gems, coinsBoosted, gemsBoosted } = fumoByRarity[rarity];
                        const nameList = Object.entries(names).map(([name, count]) =>
                            `${name}${count > 1 ? ` (x${count})` : ''}`
                        ).join(', ');

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

                    // Show boost info if any
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
            });
        });
        // Farm information
        client.on('messageCreate', async (message) => {
            if ((message.content.startsWith('.farminfo') || message.content.startsWith('.fi')) && !message.author.bot) {
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

                const embed = new EmbedBuilder()
                    .setTitle('🧠 Fumo Farming Info')
                    .setColor('Purple')
                    .setDescription(
                        `💡 **Note**:\nEach Fumo has a different power rate based on its rarity.\nYou can stop farming anytime using \`/endfarm <fumo name>\`.`
                    )
                    .addFields([
                        {
                            name: '🔢 Power by Rarity',
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
                                `🕊  Eternal         → 5,000 coins/min | 1,150 gems/min\n` +
                                `💫 Transcendent    → 25,000 coins/min| 2,500 gems/min\n` +
                                `\`\`\``
                        }
                    ])
                    .setFooter({ text: 'Extra trait on fumo can boost alot of coins and gems farming rate too!' })
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }
        });
        // Run on startup
        async function resumeAllFarming() {
            try {
                const allFarming = await db.allAsync(`SELECT * FROM farmingFumos`);
                for (const row of allFarming) {
                    const { userId, fumoName, coinsPerMin, gemsPerMin } = row;
                    await startFarming(userId, fumoName, coinsPerMin, gemsPerMin);
                }
                console.log(`✅ Resumed ${allFarming.length} farming intervals.`);
            } catch (err) {
                console.error("Failed to resume farming on startup:", err);
            }
        }
        client.once('ready', async () => {
            await resumeAllFarming();
        });
    });
}