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
function formatNumber(number) {
    return number.toLocaleString();
}
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
/**
 * Exchange command handler for Discord bot.
 * Improvements:
 * 1. Removed duplicate maintenance check.
 * 2. Improved argument parsing and validation.
 * 3. Centralized tax calculation and exchange logic.
 * 4. Added input validation for large/small/invalid numbers.
 * 5. Added "exchange all" feature (e.g. `.exchange coins all`).
 * 6. Improved error handling and user feedback.
 * 7. Refactored for readability and maintainability.
 */

const MAX_EXCHANGES_PER_DAY = 5;
const EXCHANGE_RATE_ID = 1; // For DB lookup

function parseAmount(str, userBalance) {
    if (!str) return NaN;
    str = str.replace(/,/g, '').toLowerCase();
    if (str === 'all') return userBalance;
    let multiplier = 1;
    if (str.endsWith('k')) { multiplier = 1_000; str = str.slice(0, -1); }
    else if (str.endsWith('m')) { multiplier = 1_000_000; str = str.slice(0, -1); }
    else if (str.endsWith('b')) { multiplier = 1_000_000_000; str = str.slice(0, -1); }
    const num = parseFloat(str);
    if (isNaN(num)) return NaN;
    return Math.floor(num * multiplier);
}

function getTaxRate(amount) {
    if (amount <= 10_000) return 0.05;
    if (amount <= 100_000) return 0.15;
    if (amount <= 1_000_000) return 0.25;
    if (amount <= 10_000_000) return 0.33;
    return 0.45;
}

const EXCHANGE_BUTTON_PREFIX = 'exchange_';

module.exports = async (client) => {
    const today = new Date().toISOString().split('T')[0];

    client.on('messageCreate', async message => {
        if (!message.guild || message.author.bot) return;

        const command = message.content.trim().split(/\s+/)[0].toLowerCase();
        if (command !== '.exchange' && command !== '.e') return;

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

        const args = message.content.trim().split(/\s+/);

        // Show guide + last 5 exchange history
        if (args.length === 1) {
            const userId = message.author.id;
            db.all(`SELECT * FROM exchangeHistory WHERE userId = ? ORDER BY rowid DESC LIMIT 5`, [userId], (err, rows) => {
                if (err) {
                    console.error('Error fetching exchange history:', err.message);
                    return message.reply('⚠️ Could not load exchange history.');
                }
                let historyText = 'No exchange history found yet.';
                if (rows.length > 0) {
                    historyText = rows.map(entry => {
                        const symbol = entry.type === 'coins' ? '🪙' : '💎';
                        const target = entry.type === 'coins' ? 'gems' : 'coins';
                        const tax = Math.round(((entry.amount - entry.taxedAmount) / entry.amount) * 100);
                        return `${symbol} ${formatNumber(entry.amount)} ${entry.type} ➡️ ${formatNumber(entry.result)} ${target} (${tax}% tax)`;
                    }).join('\n');
                }
                db.get(`SELECT count FROM userExchangeLimits WHERE userId = ? AND date = ?`, [userId, today], (err, limitRow) => {
                    if (err) {
                        console.error('Error fetching daily limit:', err.message);
                        return message.reply('⚠️ Could not load daily exchange limit.');
                    }
                    const used = limitRow?.count || 0;
                    const remaining = MAX_EXCHANGES_PER_DAY - used;
                    let limitText = `You have **${remaining}** exchanges left for today.`;
                    if (remaining === 0) {
                        const now = new Date();
                        const resetTime = new Date();
                        resetTime.setUTCDate(resetTime.getUTCDate() + 1);
                        resetTime.setUTCHours(0, 0, 0, 0);
                        const hoursLeft = Math.ceil((resetTime - now) / (1000 * 60 * 60));
                        limitText += `\n⏳ Limit resets in **${hoursLeft} hour(s)** (at 00:00 UTC).`;
                    }
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('💱 Exchange Center Guide')
                        .setDescription('To exchange coins or gems, use the command:\n`/exchange <type> <amount>`\n\n💰 **Base Exchange Rate:**\n10 coins = 1 gem\n\nYou can also use `all` to exchange your entire balance.')
                        .addFields(
                            { name: '📜 Your Recent Exchanges', value: historyText },
                            { name: '📆 Daily Exchange Limit', value: limitText }
                        )
                        .setFooter({ text: 'Make sure to check your balance before exchanging!' });
                    message.reply({ embeds: [embed] });
                });
            });
            return;
        }

        // Argument parsing and validation
        const type = args[1]?.trim().toLowerCase();
        if (!['coins', 'gems'].includes(type)) {
            return message.reply('❌ **Invalid type.** Use either `coins` or `gems`.');
        }

        // Fetch user balance first for "all" support
        db.get('SELECT coins, gems FROM userCoins WHERE userId = ?', [message.author.id], (err, userRow) => {
            if (err) {
                console.error('DB error:', err);
                return message.reply('⚠️ Could not fetch your balance.');
            }
            if (!userRow) return message.reply('❌ You do not have an account yet.');

            const userBalance = type === 'coins' ? userRow.coins : userRow.gems;
            let amount = parseAmount(args[2], userBalance);

            if (!isFinite(amount) || amount <= 0) {
                return message.reply('❌ **Invalid amount.** Please enter a positive number or `all`.');
            }
            if (amount > userBalance) {
                return message.reply(`❌ You don't have enough ${type}. Your balance: **${formatNumber(userBalance)}**.`);
            }
            if (amount < 10) {
                return message.reply('❌ Minimum exchange amount is **10**.');
            }

            // Check daily exchange limit
            db.get('SELECT count FROM userExchangeLimits WHERE userId = ? AND date = ?', [message.author.id, today], (err, row) => {
                if (err) return message.reply('⚠️ Could not verify daily exchange limit.');
                if (row && row.count >= MAX_EXCHANGES_PER_DAY) {
                    return message.reply('❌ You have reached your **daily limit of 5 exchanges**.');
                }
                // Get exchange rate
                db.get('SELECT coinToGem FROM exchangeRate WHERE id = ?', [EXCHANGE_RATE_ID], (err, rateRow) => {
                    if (err || !rateRow) return message.reply('⚠️ Could not fetch exchange rate.');
                    const rate = rateRow.coinToGem;
                    const taxRate = getTaxRate(amount);
                    const taxedAmount = Math.floor(amount * (1 - taxRate));
                    const exchangeAmount = type === 'coins'
                        ? Math.floor(taxedAmount / rate)
                        : Math.floor(taxedAmount * rate);
                    const exchangeType = type === 'coins' ? 'gems' : 'coins';

                    if (exchangeAmount < 1) {
                        return message.reply('❌ The amount after tax is too small to exchange.');
                    }

                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('💱 Exchange Center')
                        .setDescription(`You are about to exchange **${formatNumber(amount)} ${type}** for **${formatNumber(exchangeAmount)} ${exchangeType}** *(after ${taxRate * 100}% tax)*.\n\nPlease confirm your action below.`)
                        .setFooter({ text: 'Proceed with caution!' });

                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`${EXCHANGE_BUTTON_PREFIX}confirm`)
                                .setLabel('Confirm Exchange')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId(`${EXCHANGE_BUTTON_PREFIX}cancel`)
                                .setLabel('Cancel')
                                .setStyle(ButtonStyle.Danger),
                        );

                    // Store exchange data in message for later validation
                    message.reply({
                        embeds: [embed],
                        components: [row],
                        content: `<@${message.author.id}>|${type}|${amount}|${taxedAmount}|${exchangeAmount}|${taxRate}|${EXCHANGE_BUTTON_PREFIX}`
                    });
                });
            });
        });
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        // Only handle buttons for the exchange command
        if (!interaction.customId.startsWith(EXCHANGE_BUTTON_PREFIX)) return;

        // Only allow the user who initiated the exchange to interact
        const content = interaction.message.content;
        // Now also check the prefix in the content for extra safety
        const match = content.match(/^<@(\d+)>[|]([a-z]+)[|](\d+)[|](\d+)[|](\d+)[|]([\d.]+)[|](exchange_)/i);
        if (!match) return interaction.reply({ content: '❌ **Invalid or expired exchange.**', ephemeral: true });
        const [_, userId, type, amountStr, taxedAmountStr, exchangeAmountStr, taxRateStr, prefix] = match;
        if (prefix !== EXCHANGE_BUTTON_PREFIX) return; // Not an exchange button
        if (interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ **This is not your exchange.**', ephemeral: true });
        }

        if (interaction.customId === `${EXCHANGE_BUTTON_PREFIX}confirm`) {
            const amount = parseInt(amountStr, 10);
            const taxedAmount = parseInt(taxedAmountStr, 10);
            const exchangeAmount = parseInt(exchangeAmountStr, 10);
            const taxRate = parseFloat(taxRateStr);
            const today = new Date().toISOString().split('T')[0];

            // Check daily exchange count again (race condition prevention)
            db.get(
                `SELECT count FROM userExchangeLimits WHERE userId = ? AND date = ?`,
                [userId, today],
                (err, row) => {
                    if (err) {
                        console.error(err);
                        return interaction.reply('❌ **Database error occurred.**');
                    }
                    if (row && row.count >= MAX_EXCHANGES_PER_DAY) {
                        return interaction.reply('❌ **You have reached your daily exchange limit.**');
                    }
                    // Fetch balances again for safety
                    db.get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId], (err, userRow) => {
                        if (err) {
                            console.error(err);
                            return interaction.reply('❌ **Database error occurred.**');
                        }
                        if (!userRow) return interaction.reply('❌ Account not found.');
                        const userBalance = type === 'coins' ? userRow.coins : userRow.gems;
                        if (userBalance < amount) {
                            return interaction.reply(`❌ **You don't have enough ${type} to exchange.**`);
                        }
                        // Update balances
                        const updateQuery = type === 'coins'
                            ? `UPDATE userCoins SET coins = coins - ?, gems = gems + ? WHERE userId = ?`
                            : `UPDATE userCoins SET gems = gems - ?, coins = coins + ? WHERE userId = ?`;
                        const values = type === 'coins'
                            ? [amount, exchangeAmount, userId]
                            : [amount, exchangeAmount, userId];

                        db.run(updateQuery, values, function (err) {
                            if (err) {
                                console.error(err.message);
                                return interaction.reply('❌ **An error occurred during the exchange.**');
                            }
                            // Update daily limit
                            db.run(
                                `INSERT INTO userExchangeLimits (userId, date, count)
                                 VALUES (?, ?, 1)
                                 ON CONFLICT(userId, date)
                                 DO UPDATE SET count = count + 1`,
                                [userId, today],
                                (err) => {
                                    if (err) console.error('⚠️ Failed to update daily exchange count:', err.message);
                                }
                            );
                            // Log to exchange history
                            db.run(`INSERT INTO exchangeHistory (userId, type, amount, taxedAmount, result, date)
                                    VALUES (?, ?, ?, ?, ?, ?)`,
                                [userId, type, amount, taxedAmount, exchangeAmount, today]);
                            interaction.reply(`✅ **Exchanged ${formatNumber(amount)} ${type} for ${formatNumber(exchangeAmount)} ${type === 'coins' ? 'gems' : 'coins'} after ${Math.round(taxRate * 100)}% tax.**`);
                            // Disable buttons
                            const updatedRow = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`${EXCHANGE_BUTTON_PREFIX}confirm`)
                                        .setLabel('Confirm Exchange')
                                        .setStyle(ButtonStyle.Success)
                                        .setDisabled(true),
                                    new ButtonBuilder()
                                        .setCustomId(`${EXCHANGE_BUTTON_PREFIX}cancel`)
                                        .setLabel('Cancel')
                                        .setStyle(ButtonStyle.Danger)
                                        .setDisabled(true)
                                );
                            interaction.message.edit({ components: [updatedRow] });
                        });
                    });
                }
            );
        } else if (interaction.customId === `${EXCHANGE_BUTTON_PREFIX}cancel`) {
            interaction.reply('❌ **Exchange cancelled.**');
            const updatedRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`${EXCHANGE_BUTTON_PREFIX}confirm`).setLabel('Confirm Exchange').setStyle(ButtonStyle.Success).setDisabled(true),
                    new ButtonBuilder().setCustomId(`${EXCHANGE_BUTTON_PREFIX}cancel`).setLabel('Cancel').setStyle(ButtonStyle.Danger).setDisabled(true)
                );
            interaction.message.edit({ components: [updatedRow] });
        }
    });
};
