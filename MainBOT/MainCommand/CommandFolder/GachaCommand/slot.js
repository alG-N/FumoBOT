const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../../Core/Database/dbSetting');
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
const { maintenance, developerID } = require("../../Configuration/Maintenance/maintenanceConfig");
const { isBanned } = require('../../Administrator/BannedList/BanUtils');
const { incrementDailyGamble } = require('../../Ultility/weekly');

const SLOT_CONFIG = {
    reels: ['🍒', '🍋', '🔔', '💎', '7️⃣', '🍉', '🪙'],
    minBets: { coins: 100000, gems: 10000 },
    payouts: {
        '7️⃣': { multiplier: 50, message: '🎉 JACKPOT! You hit 7️⃣ 7️⃣ 7️⃣! This is your lucky day! 🎉' },
        '💎': { multiplier: 25, message: '💎 Amazing! You hit 💎 💎 💎! Your luck is shining bright! 💎' },
        '🔔': { multiplier: 15, message: '🔔 Great! You hit 🔔 🔔 🔔! Keep up the good work! 🔔' },
        '🍋': { multiplier: 10, message: '🍋 Not bad! You hit 🍋 🍋 🍋! Better luck next time! 🍋' },
        '🍒': { multiplier: 5, message: '🍒 You hit 🍒 🍒 🍒! Keep spinning for bigger wins! 🍒' },
        '🍉': { multiplier: 3, message: '🍉 Nice! You hit 🍉 🍉 🍉! Enjoy your win! 🍉' },
        '🪙': { multiplier: 2, message: '🪙 You hit 🪙 🪙 🪙! Keep going for the big prize! 🪙' }
    },
    twoMatch: { multiplier: 1.5, message: '🎯 Close call! You hit two in a row! Keep trying! 🎲' },
    noMatch: { multiplier: 0, message: '🌈 Keep believing! Jackpots are won by those who don\'t quit. Keep spinning! 💫' }
};

function parseBet(betStr) {
    if (!betStr) return NaN;
    const str = betStr.toLowerCase().replace(/,/g, '').trim();
    const multipliers = { k: 1000, m: 1000000 };
    const lastChar = str.slice(-1);
    const multiplier = multipliers[lastChar] || 1;
    const num = parseFloat(multiplier !== 1 ? str.slice(0, -1) : str);
    return isNaN(num) ? NaN : Math.floor(num * multiplier);
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const formatNumber = (num) => Number(num).toLocaleString();
const getUserId = (msgOrInt) => msgOrInt.author?.id || msgOrInt.user.id;
const isTextCommand = (msg) => msg.content.startsWith('.slot') || msg.content.startsWith('.sl');

async function getUserBalance(userId) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

async function updateUserBalance(userId, currency, amount) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE userCoins SET ${currency} = ${currency} + ? WHERE userId = ?`, [amount, userId], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function getWinInfo(spinResult) {
    const [s1, s2, s3] = spinResult;
    const allMatch = s1 === s2 && s2 === s3;
    const twoMatch = s1 === s2 || s2 === s3 || s1 === s3;

    if (allMatch) return SLOT_CONFIG.payouts[s1];
    if (twoMatch) return SLOT_CONFIG.twoMatch;
    return SLOT_CONFIG.noMatch;
}

async function replyTo(msgOrInt, options) {
    if (msgOrInt.author) {
        return msgOrInt.reply(options);
    }
    return msgOrInt.deferred || msgOrInt.replied ? msgOrInt.editReply(options) : msgOrInt.reply(options);
}

async function editOrReply(msgOrInt, options) {
    if (msgOrInt.author) {
        const messages = await msgOrInt.channel.messages.fetch({ limit: 5 });
        const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
        return botMsg ? botMsg.edit(options) : msgOrInt.channel.send(options);
    }
    return msgOrInt.editReply(options);
}

async function sendFollowup(msgOrInt, options) {
    return msgOrInt.author ? msgOrInt.channel.send(options) : msgOrInt.followUp(options);
}

async function slotAnimation(msgOrInt, spinResult) {
    const createEmbed = (desc) => new EmbedBuilder().setDescription(desc).setColor('#FFD700');
    const embeds = [
        createEmbed(`🎰 | ${spinResult[0]} - ❓ - ❓`),
        createEmbed(`🎰 | ${spinResult[0]} - ${spinResult[1]} - ❓`),
        createEmbed(`🎰 | ${spinResult.join(' - ')}`)
    ];

    if (msgOrInt.author) {
        const sent = await msgOrInt.reply({ embeds: [embeds[0]] });
        await wait(500);
        await sent.edit({ embeds: [embeds[1]] });
        await wait(500);
        await sent.edit({ embeds: [embeds[2]] });
    } else {
        if (!msgOrInt.deferred && !msgOrInt.replied) await msgOrInt.deferReply();
        for (let i = 0; i < embeds.length; i++) {
            await msgOrInt.editReply({ embeds: [embeds[i]] });
            if (i < embeds.length - 1) await wait(500);
        }
    }
}

async function handleSlot(msgOrInt, currency, betStr, autoSpinCount = 1) {
    const userId = getUserId(msgOrInt);
    const bet = parseBet(betStr);

    if (!['coins', 'gems'].includes(currency)) {
        return replyTo(msgOrInt, {
            embeds: [new EmbedBuilder().setDescription('❌ Invalid currency. Use `coins` or `gems`.').setColor('Red')]
        });
    }

    if (isNaN(bet) || bet <= 0) {
        return replyTo(msgOrInt, {
            embeds: [new EmbedBuilder().setDescription('🤔 Your bet must be a positive number.').setColor('Red')]
        });
    }

    let userRow;
    try {
        userRow = await getUserBalance(userId);
    } catch (err) {
        console.error('[Slot] DB Error:', err);
        return replyTo(msgOrInt, {
            embeds: [new EmbedBuilder().setDescription('⚠️ Database error. Please try again later.').setColor('Red')]
        });
    }

    if (!userRow) {
        return replyTo(msgOrInt, {
            embeds: [new EmbedBuilder().setDescription('😞 You do not have an account yet. Please register first.').setColor('Red')]
        });
    }

    const minBet = SLOT_CONFIG.minBets[currency];
    if (userRow[currency] < minBet) {
        return replyTo(msgOrInt, {
            embeds: [new EmbedBuilder().setDescription(`😞 You need at least ${formatNumber(minBet)} ${currency} to play.`).setColor('Red')]
        });
    }

    if (userRow[currency] < bet) {
        return replyTo(msgOrInt, {
            embeds: [new EmbedBuilder().setDescription(`😞 Not enough ${currency} for this bet. Try a smaller amount.`).setColor('Red')]
        });
    }

    try {
        await updateUserBalance(userId, currency, -bet);
        await incrementDailyGamble(userId).catch(err => console.error('[Slot] Gamble increment error:', err));
    } catch (err) {
        console.error('[Slot] Balance update error:', err);
        return replyTo(msgOrInt, {
            embeds: [new EmbedBuilder().setDescription('⚠️ Could not update your balance. Try again later.').setColor('Red')]
        });
    }

    let totalWin = 0;
    let lastResult = null;

    for (let spin = 0; spin < autoSpinCount; spin++) {
        const spinResult = Array.from({ length: 3 }, () =>
            SLOT_CONFIG.reels[Math.floor(Math.random() * SLOT_CONFIG.reels.length)]
        );

        if (spin === 0) await slotAnimation(msgOrInt, spinResult);

        const winInfo = getWinInfo(spinResult);
        const winAmount = Math.floor(bet * winInfo.multiplier);
        totalWin += winAmount;
        lastResult = { spinResult, winInfo };

        if (winAmount > 0) {
            try {
                await updateUserBalance(userId, currency, winAmount);
            } catch (err) {
                console.error('[Slot] Win update error:', err);
            }
        }
    }

    const resultEmbed = new EmbedBuilder()
        .setDescription(
            `🎰 | ${lastResult.spinResult.join(' - ')}\n\n${lastResult.winInfo.message} ${totalWin > 0
                ? `🎉 WON ${formatNumber(totalWin)} ${currency}!`
                : '😞 Better luck next time!'
            }`
        )
        .setColor('#FFD700');

    await editOrReply(msgOrInt, { embeds: [resultEmbed] });

    userBets.set(userId, { currency, betStr });

    await sendFollowup(msgOrInt, {
        embeds: [new EmbedBuilder().setDescription('Want to play again?').setColor('#FFD700')],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('playAgain').setLabel('Play Again').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('autoSpin').setLabel('Auto Spin x5').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        )]
    });
}

module.exports = (client) => {
    const userBets = new Map();

    client.on('messageCreate', async message => {
        if (!isTextCommand(message)) return;

        const banData = isBanned(message.author.id);
        if ((maintenance === "yes" && message.author.id !== developerID) || banData) {
            const isMaintenanceBlock = maintenance === "yes" && message.author.id !== developerID;
            let description = isMaintenanceBlock
                ? "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden"
                : `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

            if (!isMaintenanceBlock && banData.expiresAt) {
                const remaining = banData.expiresAt - Date.now();
                const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
                const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                const seconds = Math.floor((remaining / 1000) % 60);
                const timeString = [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`, seconds && `${seconds}s`]
                    .filter(Boolean).join(' ');
                description += `\n**Time Remaining:** ${timeString}`;
            } else if (!isMaintenanceBlock) {
                description += `\n**Ban Type:** Permanent`;
            }

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(isMaintenanceBlock ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
                    .setDescription(description)
                    .setFooter({ text: isMaintenanceBlock ? "Thank you for your patience" : "Ban enforced by developer" })
                    .setTimestamp()]
            });
        }

        const [command, currency, betStr] = message.content.split(/\s+/);

        if (!currency || !betStr) {
            let row;
            try {
                row = await getUserBalance(message.author.id);
            } catch (err) {
                console.error('[Slot] DB Error:', err);
                return message.reply({
                    embeds: [new EmbedBuilder().setDescription('⚠️ Database error. Please try again later.').setColor('Red')]
                });
            }

            if (!row) {
                return message.reply({
                    embeds: [new EmbedBuilder().setDescription('😞 You do not have an account yet. Please register first.').setColor('Red')]
                });
            }

            const tutorialEmbed = new EmbedBuilder()
                .setTitle('🎰 **Hosuh\'s Slot Machine** 🎰')
                .setColor(0xFFD700)
                .setDescription(`
**💎 Welcome to Hosuh's Casino!**
*Where Hosuh will happily take all your money 🎉*

🔸 **Your Balances:**
🪙 **Coins**: ${formatNumber(row.coins)}
💎 **Gems**: ${formatNumber(row.gems)}

💰 **Minimum Bets:**
- 🪙 **Coins**: 100k
- 💎 **Gems**: 10k

🎁 **Possible Rewards:**
- 7️⃣ **3x 7**: 50x Bet
- 💎 **3x Diamonds**: 25x Bet
- 🔔 **3x Bells**: 15x Bet
- 🍋 **3x Lemons**: 10x Bet
- 🍒 **3x Cherries**: 5x Bet
- 🍉 **3x Watermelons**: 3x Bet
- 🪙 **3x Coins**: 2x Bet
- 🔢 **2 Matching Symbols**: 1.5x Bet

🎲 **How to Play:**
Use: \`.slot <currency> <bet>\`
*Example: \`.slot coins 100k\`, \`.slot gems 10k\`*
                `)
                .setThumbnail('https://i.pinimg.com/1200x/00/7b/9f/007b9f17c7905f9a9e0d845ee0b116b8.jpg')
                .setImage('https://preview.redd.it/my-fumo-collection-so-far-all-authentic-v0-4b6o9g748ova1.jpg?width=640&crop=smart&auto=webp&s=6afe02354fd23eac68531c043815acdf65039846')
                .setFooter({
                    text: '🎰 Good luck and have fun!',
                    iconURL: 'https://preview.redd.it/lc4b8xugpqv91.png?auto=webp&s=892a5d0a53f30239c1a1e2bbed545f698dc7a5ea'
                });

            return message.reply({ embeds: [tutorialEmbed] });
        }

        handleSlot(message, currency, betStr);
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        const lastBet = userBets.get(interaction.user.id);

        if (interaction.customId === 'playAgain') {
            if (!lastBet) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setDescription('No previous bet found. Use the `.slot` command to start a new game.')
                        .setColor('#FFD700')],
                    ephemeral: true
                });
            }
            handleSlot(interaction, lastBet.currency, lastBet.betStr);
        }
        else if (interaction.customId === 'autoSpin') {
            if (!lastBet) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setDescription('No previous bet found. Use the `.slot` command to start a new game.')
                        .setColor('#FFD700')],
                    ephemeral: true
                });
            }
            handleSlot(interaction, lastBet.currency, lastBet.betStr, 5);
        }
        else if (interaction.customId === 'cancel') {
            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setDescription('Game cancelled, come back if you are ready to gamble again.')
                    .setImage('https://life-stuff.org/wp-content/uploads/2022/02/gambling-poster.jpg')
                    .setColor('#FFD700')],
                ephemeral: true
            });

            setTimeout(() => {
                interaction.deleteReply().catch(() => { });
            }, 5000);
        }
    });
};