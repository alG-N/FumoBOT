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
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');

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

const MAX_EXCHANGES_PER_DAY = 5;
const EXCHANGE_RATE_ID = 1;
const EXCHANGE_BUTTON_PREFIX = 'exchange_';
const MIN_EXCHANGE = 10;

const formatNumber = (number) => number.toLocaleString();

const parseAmount = (str, userBalance) => {
    if (!str) return NaN;
    str = str.replace(/,/g, '').toLowerCase();
    if (str === 'all') return userBalance;
    
    const multipliers = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };
    const suffix = str.slice(-1);
    const multiplier = multipliers[suffix] || 1;
    const num = parseFloat(multiplier > 1 ? str.slice(0, -1) : str);
    
    return isNaN(num) ? NaN : Math.floor(num * multiplier);
};

const getTaxRate = (amount) => {
    if (amount <= 10_000) return 0.05;
    if (amount <= 100_000) return 0.15;
    if (amount <= 1_000_000) return 0.25;
    if (amount <= 10_000_000) return 0.33;
    return 0.45;
};

const createBlockEmbed = (isMaintenance, banData) => {
    const isMaintenanceMode = isMaintenance && !banData;
    
    let description = isMaintenanceMode
        ? "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden"
        : `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;
    
    if (banData?.expiresAt) {
        const remaining = banData.expiresAt - Date.now();
        const time = {
            d: Math.floor(remaining / (1000 * 60 * 60 * 24)),
            h: Math.floor((remaining / (1000 * 60 * 60)) % 24),
            m: Math.floor((remaining / (1000 * 60)) % 60),
            s: Math.floor((remaining / 1000) % 60)
        };
        const timeString = Object.entries(time)
            .filter(([_, v]) => v)
            .map(([k, v]) => `${v}${k}`)
            .join(' ');
        description += `\n**Time Remaining:** ${timeString}`;
    } else if (banData) {
        description += `\n**Ban Type:** Permanent`;
    }

    return new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(isMaintenanceMode ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
        .setDescription(description)
        .setFooter({ text: isMaintenanceMode ? 'Thank you for your patience' : 'Ban enforced by developer' })
        .setTimestamp();
};

const createExchangeButtons = (disabled = false) => {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${EXCHANGE_BUTTON_PREFIX}confirm`)
            .setLabel('Confirm Exchange')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`${EXCHANGE_BUTTON_PREFIX}cancel`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    );
};

const formatHistory = (rows) => {
    if (!rows.length) return 'No exchange history found yet.';
    
    return rows.map(entry => {
        const symbol = entry.type === 'coins' ? '🪙' : '💎';
        const target = entry.type === 'coins' ? 'gems' : 'coins';
        const tax = Math.round(((entry.amount - entry.taxedAmount) / entry.amount) * 100);
        return `${symbol} ${formatNumber(entry.amount)} ${entry.type} ➡️ ${formatNumber(entry.result)} ${target} (${tax}% tax)`;
    }).join('\n');
};

const getResetTimeText = () => {
    const now = new Date();
    const resetTime = new Date();
    resetTime.setUTCDate(resetTime.getUTCDate() + 1);
    resetTime.setUTCHours(0, 0, 0, 0);
    return Math.ceil((resetTime - now) / (1000 * 60 * 60));
};

const showExchangeGuide = async (message, userId, today) => {
    try {
        const [rows, limitRow] = await Promise.all([
            new Promise((resolve, reject) => {
                db.all('SELECT * FROM exchangeHistory WHERE userId = ? ORDER BY rowid DESC LIMIT 5', 
                    [userId], (err, rows) => err ? reject(err) : resolve(rows || []));
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT count FROM userExchangeLimits WHERE userId = ? AND date = ?',
                    [userId, today], (err, row) => err ? reject(err) : resolve(row));
            })
        ]);

        const used = limitRow?.count || 0;
        const remaining = MAX_EXCHANGES_PER_DAY - used;
        let limitText = `You have **${remaining}** exchanges left for today.`;
        
        if (remaining === 0) {
            limitText += `\n⏳ Limit resets in **${getResetTimeText()} hour(s)** (at 00:00 UTC).`;
        }

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💱 Exchange Center Guide')
            .setDescription(
                'To exchange coins or gems, use the command:\n`/exchange <type> <amount>`\n\n' +
                '💰 **Base Exchange Rate:**\n10 coins = 1 gem\n\n' +
                'You can also use `all` to exchange your entire balance.'
            )
            .addFields(
                { name: '📜 Your Recent Exchanges', value: formatHistory(rows) },
                { name: '📆 Daily Exchange Limit', value: limitText }
            )
            .setFooter({ text: 'Make sure to check your balance before exchanging!' });

        message.reply({ embeds: [embed] });
    } catch (err) {
        console.error('Error showing exchange guide:', err);
        message.reply('⚠️ Could not load exchange information.');
    }
};

module.exports = async (client) => {
    const today = new Date().toISOString().split('T')[0];

    client.on('messageCreate', async message => {
        if (!message.guild || message.author.bot) return;

        const command = message.content.trim().split(/\s+/)[0].toLowerCase();
        if (command !== '.exchange' && command !== '.e') return;

        const banData = isBanned(message.author.id);
        if ((maintenance === "yes" && message.author.id !== developerID) || banData) {
            console.log(`[${new Date().toISOString()}] Blocked user (${message.author.id})`);
            return message.reply({ embeds: [createBlockEmbed(maintenance === "yes", banData)] });
        }

        const args = message.content.trim().split(/\s+/);

        if (args.length === 1) {
            return showExchangeGuide(message, message.author.id, today);
        }

        const type = args[1]?.trim().toLowerCase();
        if (!['coins', 'gems'].includes(type)) {
            return message.reply('❌ **Invalid type.** Use either `coins` or `gems`.');
        }

        db.get('SELECT coins, gems FROM userCoins WHERE userId = ?', [message.author.id], (err, userRow) => {
            if (err) {
                console.error('DB error:', err);
                return message.reply('⚠️ Could not fetch your balance.');
            }
            if (!userRow) return message.reply('❌ You do not have an account yet.');

            const userBalance = type === 'coins' ? userRow.coins : userRow.gems;
            const amount = parseAmount(args[2], userBalance);

            if (!isFinite(amount) || amount <= 0) {
                return message.reply('❌ **Invalid amount.** Please enter a positive number or `all`.');
            }
            if (amount > userBalance) {
                return message.reply(`❌ You don't have enough ${type}. Your balance: **${formatNumber(userBalance)}**.`);
            }
            if (amount < MIN_EXCHANGE) {
                return message.reply(`❌ Minimum exchange amount is **${MIN_EXCHANGE}**.`);
            }

            db.get('SELECT count FROM userExchangeLimits WHERE userId = ? AND date = ?', 
                [message.author.id, today], (err, row) => {
                if (err) return message.reply('⚠️ Could not verify daily exchange limit.');
                if (row?.count >= MAX_EXCHANGES_PER_DAY) {
                    return message.reply('❌ You have reached your **daily limit of 5 exchanges**.');
                }

                processExchange(message, type, amount, today);
            });
        });
    });

    const processExchange = (message, type, amount, today) => {
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
                .setDescription(
                    `You are about to exchange **${formatNumber(amount)} ${type}** for ` +
                    `**${formatNumber(exchangeAmount)} ${exchangeType}** ` +
                    `*(after ${taxRate * 100}% tax)*.\n\nPlease confirm your action below.`
                )
                .setFooter({ text: 'Proceed with caution!' });

            message.reply({
                embeds: [embed],
                components: [createExchangeButtons()],
                content: `<@${message.author.id}>|${type}|${amount}|${taxedAmount}|${exchangeAmount}|${taxRate}|${EXCHANGE_BUTTON_PREFIX}`
            });
        });
    };

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton() || !interaction.customId.startsWith(EXCHANGE_BUTTON_PREFIX)) return;

        const match = interaction.message.content.match(
            /^<@(\d+)>[|]([a-z]+)[|](\d+)[|](\d+)[|](\d+)[|]([\d.]+)[|](exchange_)/i
        );
        
        if (!match) {
            return interaction.reply({ content: '❌ **Invalid or expired exchange.**', ephemeral: true });
        }

        const [_, userId, type, amountStr, taxedAmountStr, exchangeAmountStr, taxRateStr, prefix] = match;
        
        if (prefix !== EXCHANGE_BUTTON_PREFIX || interaction.user.id !== userId) {
            return interaction.reply({ 
                content: '❌ **This is not your exchange.**', 
                ephemeral: true 
            });
        }

        if (interaction.customId === `${EXCHANGE_BUTTON_PREFIX}cancel`) {
            await interaction.reply('❌ **Exchange cancelled.**');
            return interaction.message.edit({ components: [createExchangeButtons(true)] });
        }

        if (interaction.customId === `${EXCHANGE_BUTTON_PREFIX}confirm`) {
            const amount = parseInt(amountStr, 10);
            const taxedAmount = parseInt(taxedAmountStr, 10);
            const exchangeAmount = parseInt(exchangeAmountStr, 10);
            const taxRate = parseFloat(taxRateStr);
            const today = new Date().toISOString().split('T')[0];


            db.get('SELECT count FROM userExchangeLimits WHERE userId = ? AND date = ?',
                [userId, today], (err, row) => {
                if (err) {
                    console.error(err);
                    return interaction.reply('❌ **Database error occurred.**');
                }
                if (row?.count >= MAX_EXCHANGES_PER_DAY) {
                    return interaction.reply('❌ **You have reached your daily exchange limit.**');
                }

                db.get('SELECT coins, gems FROM userCoins WHERE userId = ?', [userId], (err, userRow) => {
                    if (err) {
                        console.error(err);
                        return interaction.reply('❌ **Database error occurred.**');
                    }
                    if (!userRow) return interaction.reply('❌ Account not found.');

                    const userBalance = type === 'coins' ? userRow.coins : userRow.gems;
                    if (userBalance < amount) {
                        return interaction.reply(`❌ **You don't have enough ${type} to exchange.**`);
                    }

                    executeExchange(interaction, userId, type, amount, taxedAmount, exchangeAmount, taxRate, today);
                });
            });
        }
    });
};