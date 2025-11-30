const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../../../Core/Database/dbSetting');
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
const { maintenance, developerID } = require("../../../Configuration/maintenanceConfig");
const { isBanned } = require('../../../Administrator/BannedList/BanUtils');
// Utility: Async wrapper for db.run and db.get
const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) => db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    }));
const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    }));
const dbAll = (sql, params = []) =>
    new Promise((resolve, reject) => db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    }));

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.sell') && message.content !== '.s' && !message.content.startsWith('.s ')) return;

        // Maintenance check
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

        // --- Constants ---
        const userId = message.author.id;
        const args = message.content.split(' ').slice(1);
        const coinRewards = {
            'Common': 20, 'UNCOMMON': 50, 'RARE': 70, 'EPIC': 150,
            'OTHERWORLDLY': 300, 'LEGENDARY': 1300, 'MYTHICAL': 7000, 'EXCLUSIVE': 20000
        };
        const gemRewards = {
            '???': 10000, 'ASTRAL': 25000, 'CELESTIAL': 40000, 'INFINITE': 100000
        };
        const allRarities = [
            'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY',
            'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
        ];
        const unsellableRarities = ['ETERNAL', 'TRANSCENDENT'];
        const shinyTag = '[✨SHINY]';
        const algTag = '[🌟alG]';

        // --- Helpers ---
        const checkRarityFormat = rarity => {
            if (!allRarities.includes(rarity)) {
                message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Invalid Rarity Format')
                            .setDescription(`Please use the correct rarity format. Valid rarities are:\n\n${allRarities.join(', ')}`)
                            .setColor('#ff0000')
                            .setFooter({ text: 'Example: .sell Reimu(Common) 1' })
                    ]
                });
                return false;
            }
            return true;
        };

        const confirmationPrompt = async (promptMsg) => {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('sell_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('sell_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
            );
            await promptMsg.edit({ components: [row] });
            return new Promise(resolve => {
                const filter = i => i.user.id === userId && ['sell_confirm', 'sell_cancel'].includes(i.customId);
                const collector = promptMsg.channel.createMessageComponentCollector({ filter, max: 1, time: 30000 });
                collector.on('collect', async i => {
                    await i.deferUpdate();
                    await promptMsg.edit({ components: [] });
                    resolve(i.customId === 'sell_confirm');
                });
                collector.on('end', async collected => {
                    if (collected.size === 0) {
                        await promptMsg.edit({ components: [] });
                        message.reply('No response received. Sale canceled.');
                        resolve(false);
                    }
                });
            });
        };

        const getSellMultiplier = async () => {
            try {
                const row = await dbGet(
                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
                    [userId, 'sellPenalty', 'AncientRelic']
                );
                if (row && row.expiresAt > Date.now()) return row.multiplier;
            } catch { }
            return 1.0;
        };

        const addUserReward = async (coins, gems = 0) => {
            try {
                const res = await dbRun('UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?', [coins, gems, userId]);
                if (res.changes === 0) {
                    await dbRun('INSERT INTO userCoins (userId, coins, gems) VALUES (?, ?, ?)', [userId, coins, gems]);
                }
            } catch (e) {
                throw new Error('Error updating user balance: ' + e.message);
            }
        };

        const logSale = async (fumoName, quantity) => {
            await dbRun(
                'INSERT INTO userSales (userId, fumoName, quantity, timestamp) VALUES (?, ?, ?, strftime(\'%s\',\'now\'))',
                [userId, fumoName, quantity]
            );
        };

        const removeFumos = async (fumoName, quantity) => {
            await dbRun(
                `DELETE FROM userInventory WHERE rowid IN (
                    SELECT rowid FROM userInventory WHERE userId = ? AND fumoName = ? LIMIT ?
                )`,
                [userId, fumoName, quantity]
            );
        };

        const removeAllFumosOfRarity = async (rows, tag = null) => {
            for (const row of rows) {
                if (tag && !row.fumoName.endsWith(tag)) continue;
                if (!tag && (row.fumoName.endsWith(shinyTag) || row.fumoName.endsWith(algTag))) continue;
                await dbRun('DELETE FROM userInventory WHERE userId = ? AND fumoName = ?', [userId, row.fumoName]);
                await logSale(row.fumoName, row.count);
            }
        };

        // --- Command Parsing ---
        // Regex for .sell <fumoName>(Rarity)[Tag] quantity
        const regexWithTag = /(.+?)\((.+?)\)\s*(\[✨SHINY\]|\[🌟alG\])?\s*(\d+)/i;
        const match = args.join(' ').match(regexWithTag);

        // Bulk: .sell RARITY[Tag]
        let bulkRarity = null, bulkTag = null;
        if (!match && args.length === 1) {
            const bulkMatch = args[0].match(/^([A-Z\?]+)(\[✨SHINY\]|\[🌟alG\])?$/i);
            if (bulkMatch) {
                bulkRarity = bulkMatch[1].trim();
                bulkTag = bulkMatch[2] || null;
            }
        }

        try {
            // --- Single Fumo sale ---
            if (match) {
                let fumoBase = match[1].trim();
                let rarity = match[2].trim();
                let tag = match[3] || null;
                let quantity = parseInt(match[4]);
                let fumoName = fumoBase + `(${rarity})`;
                if (tag) fumoName += tag;

                // Prevent selling [✨SHINY] or [🌟alG] unless explicitly specified
                if ((args.join(' ').toUpperCase().includes(shinyTag.toUpperCase()) || args.join(' ').toUpperCase().includes(algTag.toUpperCase()))
                    && !fumoName.endsWith(shinyTag) && !fumoName.endsWith(algTag)) {
                    return message.reply('To sell a [✨SHINY] or [🌟alG] Fumo, you must specify the tag in your command, e.g. `.sell Reimu(Common)[✨SHINY] 1` or `.sell Common[🌟alG]`.');
                }

                if (!checkRarityFormat(rarity)) return;
                if (isNaN(quantity) || quantity <= 0) return message.reply('Please enter a valid quantity.');
                if (unsellableRarities.includes(rarity)) return message.reply(`You cannot sell Fumos of ${rarity} rarity.`);

                const row = await dbGet('SELECT COUNT(*) as count FROM userInventory WHERE userId = ? AND fumoName = ?', [userId, fumoName]);
                if (!row || row.count < quantity) return message.reply(`You don't have enough of ${fumoName} to sell.`);

                const sellMultiplier = await getSellMultiplier();
                let rewardAmount = 0, rewardType = 'coins';
                if (coinRewards[rarity]) {
                    rewardAmount = Math.floor(coinRewards[rarity] * quantity * sellMultiplier);
                } else if (gemRewards[rarity]) {
                    rewardAmount = Math.floor(gemRewards[rarity] * quantity * sellMultiplier);
                    rewardType = 'gems';
                } else {
                    return message.reply('This rarity cannot be sold.');
                }
                if (tag === shinyTag) rewardAmount *= 2;
                if (tag === algTag) rewardAmount *= 150;

                const embed = new EmbedBuilder()
                    .setTitle('💰 Confirm Sale')
                    .setDescription(
                        `You are about to sell **${quantity}x ${fumoName}** for **${rewardAmount} ${rewardType}**.\n` +
                        `💎 Fumo Rarity: **${rarity}**\n` +
                        (tag === shinyTag ? '✨ SHINY Bonus: x2\n' : '') +
                        (tag === algTag ? '🌟 alG Bonus: x150\n' : '') +
                        `🔥 Are you sure you want to proceed?`
                    )
                    .setColor('#28A745')
                    .setFooter({ text: 'Click Confirm to proceed or Cancel to abort.' });

                const confirmMsg = await message.reply({ embeds: [embed], components: [] });
                const confirmed = await confirmationPrompt(confirmMsg);
                if (!confirmed) return message.reply('Sale canceled.');

                await dbRun('BEGIN TRANSACTION');
                await removeFumos(fumoName, quantity);
                await logSale(fumoName, quantity);
                if (rewardType === 'coins') await addUserReward(rewardAmount, 0);
                else await addUserReward(0, rewardAmount);
                await dbRun('COMMIT');

                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Sale Successful')
                            .setDescription(`You have successfully sold **${quantity}x ${fumoName}**.\nYou received **${rewardAmount} ${rewardType}**.`)
                            .setColor('#00ff00')
                    ]
                });
            }

            // --- Bulk sale by rarity (with optional tag) ---
            if (args.length === 1 && bulkRarity) {
                let rarity = bulkRarity;
                let tag = bulkTag;

                if (!checkRarityFormat(rarity)) return;
                if (unsellableRarities.includes(rarity)) return message.reply(`You cannot sell Fumos of ${rarity} rarity.`);

                // Prevent selling [✨SHINY] or [🌟alG] in bulk unless explicitly specified
                if ((args[0].toUpperCase().includes(shinyTag.toUpperCase()) || args[0].toUpperCase().includes(algTag.toUpperCase()))
                    && !args[0].endsWith(shinyTag) && !args[0].endsWith(algTag)) {
                    return message.reply('To sell [✨SHINY] or [🌟alG] Fumos, you must specify the tag in your command, e.g. `.sell Common[✨SHINY]` or `.sell Common[🌟alG]`.');
                }

                let query = 'SELECT fumoName, COUNT(*) AS count FROM userInventory WHERE userId = ? AND fumoName LIKE ?';
                let params = [userId, `%(${rarity})%`];
                if (tag) {
                    query += ' AND fumoName LIKE ?';
                    params.push(`%${tag}%`);
                }
                query += ' GROUP BY fumoName';

                let rows = await dbAll(query, params);
                if (!tag) rows = rows.filter(row => !row.fumoName.endsWith(shinyTag) && !row.fumoName.endsWith(algTag));
                if (!rows || rows.length === 0) {
                    return message.reply(`😔 No **${rarity}${tag ? tag : ''}** Fumos available to sell.`);
                }

                const sellMultiplier = await getSellMultiplier();
                let totalReward = 0, totalFumosCount = 0, rewardType = 'coins';
                for (const row of rows) {
                    const baseReward = coinRewards[rarity] || gemRewards[rarity] || 0;
                    let fumoReward = Math.floor(baseReward * row.count * sellMultiplier);
                    if (tag && row.fumoName.endsWith(tag)) {
                        if (tag === shinyTag) fumoReward *= 2;
                        if (tag === algTag) fumoReward *= 150;
                    }
                    totalReward += fumoReward;
                    totalFumosCount += row.count;
                    if (!coinRewards[rarity]) rewardType = 'gems';
                }

                const embed = new EmbedBuilder()
                    .setTitle('💎 Confirm Bulk Sale')
                    .setDescription(
                        `You are about to sell all your **${rarity}${tag ? tag : ''}** Fumos for **${totalReward} ${rewardType}**.\n` +
                        `📦 Total Fumos: **${totalFumosCount}**\n` +
                        (tag === shinyTag ? '✨ SHINY Bonus: x2\n' : '') +
                        (tag === algTag ? '🌟 alG Bonus: x150\n' : '') +
                        `💰 Total Reward: **${totalReward} ${rewardType}**\n` +
                        `Are you sure you want to proceed?`
                    )
                    .setColor('#28A745')
                    .setFooter({ text: 'Click Confirm to proceed or Cancel to abort.' });

                const confirmMsg = await message.reply({ embeds: [embed], components: [] });
                const confirmed = await confirmationPrompt(confirmMsg);
                if (!confirmed) return message.reply('Sale canceled.');

                await dbRun('BEGIN TRANSACTION');
                await removeAllFumosOfRarity(rows, tag ? tag : null);
                if (rewardType === 'coins') await addUserReward(totalReward, 0);
                else await addUserReward(0, totalReward);
                await dbRun('COMMIT');

                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Sale Successful')
                            .setDescription(`You have successfully sold all your **${rarity}${tag ? tag : ''}** Fumos.\nYou received **${totalReward} ${rewardType}**.`)
                            .setColor('#00ff00')
                    ]
                });
            }

            // --- Invalid format ---
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Invalid Command Format')
                        .setDescription(
                            `Please use one of the following formats to sell your Fumos:\n\n` +
                            `🔹 **.sell <fumoName>(Rarity) quantity**\n` +
                            `Example: \`.sell Marisa(Common) 3\`\n` +
                            `🔹 **.sell <fumoName>(Rarity)[✨SHINY] quantity**\n` +
                            `Example: \`.sell Marisa(Common)[✨SHINY] 1\`\n` +
                            `🔹 **.sell (Rarity)**\n` +
                            `Example: \`.sell LEGENDARY\`\n` +
                            `🔹 **.sell (Rarity)[✨SHINY]**\n` +
                            `Example: \`.sell Common[✨SHINY]\``
                        )
                        .setColor('#FF5733')
                        .setFooter({ text: '📘 Tip: Double-check your command format before sending.' })
                ]
            });
        } catch (err) {
            await dbRun('ROLLBACK').catch(() => { });
            console.error('Sell command error:', err);
            message.reply('An unexpected error occurred. Please contact the developer.');
        }
    });
};

/*
 * Improvements/Features:
 * - Async/await for better readability and error handling.
 * - Uses reactions (✅/❌) for confirmation instead of text, making UX faster and less error-prone.
 * - Handles both coins and gems rewards.
 * - Rolls back DB transaction on error.
 * - Utility functions for DB and repeated logic.
 * - Logs errors with context for easier debugging.
 * - Ignores bot messages.
 * - All user input is trimmed and validated.
 * - Modular helpers for future extension.
 */
