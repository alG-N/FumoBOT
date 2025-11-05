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
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
const { incrementDailyGamble } = require('../Utils/weekly'); // adjust path
/**
 * Slot machine command handler for Discord bot.
 * Improvements:
 * 1. Bug fixes: Fixed async/await usage, reply/editReply logic, and DB error handling.
 * 2. Structure: Split logic into smaller functions, improved naming, and removed duplicate code.
 * 3. Readability: Added comments, clarified variable names, and improved embed formatting.
 * 4. Feature: Added "Auto Spin" button for 5 consecutive spins with the same bet.
 * 5. Error handling: Added more DB error checks, handled edge cases for bet parsing, and prevented negative balances.
 */

module.exports = (client) => {
    const userBets = new Map();

    function parseBet(betStr) {
        if (!betStr) return NaN;
        let multiplier = 1;
        let str = betStr.toLowerCase().replace(/,/g, '').trim();
        if (str.endsWith('k')) {
            multiplier = 1000;
            str = str.slice(0, -1);
        } else if (str.endsWith('m')) {
            multiplier = 1000000;
            str = str.slice(0, -1);
        }
        const num = parseFloat(str);
        return isNaN(num) ? NaN : Math.floor(num * multiplier);
    }

    function formatNumber(number) {
        return Number(number).toLocaleString();
    }

    function getUserId(msgOrInt) {
        return msgOrInt.author ? msgOrInt.author.id : msgOrInt.user.id;
    }

    function isTextCommand(msg) {
        return msg.content.startsWith('.slot') || msg.content.startsWith('.sl');
    }

    function getCurrencyMin(currency) {
        return currency === 'coins' ? 100000 : 10000;
    }

    function getCurrencyList() {
        return ['coins', 'gems'];
    }

    function getSlotReels() {
        return ['🍒', '🍋', '🔔', '💎', '7️⃣', '🍉', '🪙'];
    }

    function getWinInfo(symbol, allMatch) {
        if (!allMatch) return { multiplier: 1.5, message: '🎯 Close call! You hit two in a row! Keep trying! 🎲' };
        switch (symbol) {
            case '7️⃣': return { multiplier: 50, message: '🎉 JACKPOT! You hit 7️⃣ 7️⃣ 7️⃣! This is your lucky day! 🎉' };
            case '💎': return { multiplier: 25, message: '💎 Amazing! You hit 💎 💎 💎! Your luck is shining bright! 💎' };
            case '🔔': return { multiplier: 15, message: '🔔 Great! You hit 🔔 🔔 🔔! Keep up the good work! 🔔' };
            case '🍋': return { multiplier: 10, message: '🍋 Not bad! You hit 🍋 🍋 🍋! Better luck next time! 🍋' };
            case '🍒': return { multiplier: 5, message: '🍒 You hit 🍒 🍒 🍒! Keep spinning for bigger wins! 🍒' };
            case '🍉': return { multiplier: 3, message: '🍉 Nice! You hit 🍉 🍉 🍉! Enjoy your win! 🍉' };
            case '🪙': return { multiplier: 2, message: '🪙 You hit 🪙 🪙 🪙! Keep going for the big prize! 🪙' };
            default: return { multiplier: 0, message: '🌈 Keep believing! Jackpots are won by those who don\'t quit. Keep spinning! 💫' };
        }
    }

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
            db.run(`UPDATE userCoins SET ${currency} = ${currency} + ? WHERE userId = ?`, [amount, userId], function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    async function handleSlot(msgOrInt, currency, betStr, autoSpinCount = 1) {
        const userId = getUserId(msgOrInt);
        const bet = parseBet(betStr);

        if (!getCurrencyList().includes(currency)) {
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
            console.error('DB Error:', err);
            return replyTo(msgOrInt, {
                embeds: [new EmbedBuilder().setDescription('⚠️ Database error. Please try again later.').setColor('Red')]
            });
        }

        if (!userRow) {
            return replyTo(msgOrInt, {
                embeds: [new EmbedBuilder().setDescription('😞 You do not have an account yet. Please register first.').setColor('Red')]
            });
        }

        if (userRow[currency] < getCurrencyMin(currency)) {
            return replyTo(msgOrInt, {
                embeds: [new EmbedBuilder().setDescription(`😞 You do not have enough ${currency} (minimum ${formatNumber(getCurrencyMin(currency))}).`).setColor('Red')]
            });
        }

        if (userRow[currency] < bet) {
            return replyTo(msgOrInt, {
                embeds: [new EmbedBuilder().setDescription(`😞 Not enough ${currency} for this bet. Try a smaller amount.`).setColor('Red')]
            });
        }

        // Deduct bet
        try {
            await updateUserBalance(userId, currency, -bet);
        } catch (err) {
            console.error('DB Update Error:', err);
            return replyTo(msgOrInt, {
                embeds: [new EmbedBuilder().setDescription('⚠️ Could not update your balance. Try again later.').setColor('Red')]
            });
        }

        try {
            await incrementDailyGamble(userId);
        } catch (err) {
            // Not critical, just log
            console.error('incrementDailyGamble error:', err);
        }

        // Slot spin animation
        const reels = getSlotReels();
        let spinResult = [];
        let winMultiplier = 0;
        let winMessage = '';
        let totalWin = 0;

        for (let spin = 0; spin < autoSpinCount; spin++) {
            spinResult = [
                reels[Math.floor(Math.random() * reels.length)],
                reels[Math.floor(Math.random() * reels.length)],
                reels[Math.floor(Math.random() * reels.length)]
            ];

            // Animation
            if (spin === 0) {
                await slotAnimation(msgOrInt, spinResult);
            }

            // Win calculation
            if (spinResult[0] === spinResult[1] && spinResult[1] === spinResult[2]) {
                const win = getWinInfo(spinResult[0], true);
                winMultiplier = win.multiplier;
                winMessage = win.message;
            } else if (
                spinResult[0] === spinResult[1] ||
                spinResult[1] === spinResult[2] ||
                spinResult[0] === spinResult[2]
            ) {
                const win = getWinInfo(spinResult[0], false);
                winMultiplier = win.multiplier;
                winMessage = win.message;
            } else {
                winMultiplier = 0;
                winMessage = '🌈 Keep believing! Jackpots are won by those who don\'t quit. Keep spinning! 💫';
            }

            const winAmount = Math.floor(bet * winMultiplier);
            totalWin += winAmount;

            // Add winnings
            if (winAmount > 0) {
                try {
                    await updateUserBalance(userId, currency, winAmount);
                } catch (err) {
                    console.error('DB Update Error:', err);
                }
            }
        }

        // Final result embed
        const winEmbed = new EmbedBuilder()
            .setDescription(
                `🎰 | ${spinResult.join(' - ')}\n\n${winMessage} ${totalWin > 0
                    ? `🎉 WON ${formatNumber(totalWin)} ${currency}!`
                    : '😞 Better luck next time!'
                }`
            )
            .setColor('#FFD700');

        await editOrReply(msgOrInt, { embeds: [winEmbed] });

        userBets.set(userId, { currency, betStr });

        // Buttons: Play Again, Auto Spin, Cancel
        const rowButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('playAgain')
                .setLabel('Play Again')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('autoSpin')
                .setLabel('Auto Spin x5')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        await sendFollowup(msgOrInt, {
            embeds: [
                new EmbedBuilder()
                    .setDescription('Want to play again?')
                    .setColor('#FFD700')
            ],
            components: [rowButtons]
        });
    }

    // Helper: reply or editReply
    async function replyTo(msgOrInt, options) {
        if (msgOrInt.author) {
            return msgOrInt.reply(options);
        } else if (msgOrInt.deferred || msgOrInt.replied) {
            return msgOrInt.editReply(options);
        } else {
            return msgOrInt.reply(options);
        }
    }

    async function editOrReply(msgOrInt, options) {
        if (msgOrInt.author) {
            // Find the last bot message in the channel to edit
            const messages = await msgOrInt.channel.messages.fetch({ limit: 5 });
            const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
            if (botMsg) {
                return botMsg.edit(options);
            } else {
                return msgOrInt.channel.send(options);
            }
        } else {
            return msgOrInt.editReply(options);
        }
    }

    async function sendFollowup(msgOrInt, options) {
        if (msgOrInt.author) {
            return msgOrInt.channel.send(options);
        } else {
            return msgOrInt.followUp(options);
        }
    }

    // Slot animation
    async function slotAnimation(msgOrInt, spinResult) {
        const embed1 = new EmbedBuilder().setDescription(`🎰 | ${spinResult[0]} - ❓ - ❓`).setColor('#FFD700');
        const embed2 = new EmbedBuilder().setDescription(`🎰 | ${spinResult[0]} - ${spinResult[1]} - ❓`).setColor('#FFD700');
        const embed3 = new EmbedBuilder().setDescription(`🎰 | ${spinResult.join(' - ')}`).setColor('#FFD700');

        if (msgOrInt.author) {
            const sent = await msgOrInt.reply({ embeds: [embed1] });
            await wait(500);
            await sent.edit({ embeds: [embed2] });
            await wait(500);
            await sent.edit({ embeds: [embed3] });
        } else {
            if (!msgOrInt.deferred && !msgOrInt.replied) await msgOrInt.deferReply();
            await msgOrInt.editReply({ embeds: [embed1] });
            await wait(500);
            await msgOrInt.editReply({ embeds: [embed2] });
            await wait(500);
            await msgOrInt.editReply({ embeds: [embed3] });
        }
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Main message handler
    client.on('messageCreate', async message => {
        if (!isTextCommand(message)) return;

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

        const [command, currency, betStr] = message.content.split(/\s+/);

        if (!currency || !betStr) {
            let row;
            try {
                row = await getUserBalance(message.author.id);
            } catch (err) {
                console.error('DB Error:', err);
                return message.reply({
                    embeds: [new EmbedBuilder().setDescription('⚠️ Database error. Please try again later.').setColor('Red')]
                });
            }

            if (!row) {
                return message.reply({
                    embeds: [new EmbedBuilder().setDescription('😞 You do not have an account yet. Please register first.').setColor('Red')]
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🎰 **Hosuh\'s Slot Machine** 🎰')
                .setColor(0xFFD700)
                .setDescription(`
**💎 Welcome to Hosuh's Casino!**\n*Where Hosuh will happily take all your money 🎉*
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
To roll the slot machine, use the command:  
\`.slot <currency> <bet>\`  
*Example: \`.slot coins 100k\`, \`.slot gems 10k\`*
                `)
                .setThumbnail('https://i.pinimg.com/1200x/00/7b/9f/007b9f17c7905f9a9e0d845ee0b116b8.jpg')
                .setImage('https://preview.redd.it/my-fumo-collection-so-far-all-authentic-v0-4b6o9g748ova1.jpg?width=640&crop=smart&auto=webp&s=6afe02354fd23eac68531c043815acdf65039846')
                .setFooter({
                    text: '🎰 Good luck and have fun!',
                    iconURL: 'https://preview.redd.it/lc4b8xugpqv91.png?auto=webp&s=892a5d0a53f30239c1a1e2bbed545f698dc7a5ea'
                });

            return message.reply({ embeds: [embed] });
        }

        handleSlot(message, currency, betStr);
    });

    // Button interaction handler
    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'playAgain') {
            const lastBet = userBets.get(interaction.user.id);
            if (lastBet) {
                const { currency, betStr } = lastBet;
                handleSlot(interaction, currency, betStr);
            } else {
                interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setDescription('No previous bet found. Use the `/slot` command to start a new game.')
                        .setColor('#FFD700')
                    ],
                    ephemeral: true
                });
            }
        } else if (interaction.customId === 'autoSpin') {
            const lastBet = userBets.get(interaction.user.id);
            if (lastBet) {
                const { currency, betStr } = lastBet;
                handleSlot(interaction, currency, betStr, 5);
            } else {
                interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setDescription('No previous bet found. Use the `/slot` command to start a new game.')
                        .setColor('#FFD700')
                    ],
                    ephemeral: true
                });
            }
        } else if (interaction.customId === 'cancel') {
            const embed = new EmbedBuilder()
                .setDescription('Game cancelled, come back if you are ready to gamble again.')
                .setImage('https://life-stuff.org/wp-content/uploads/2022/02/gambling-poster.jpg')
                .setColor('#FFD700');

            await interaction.reply({ embeds: [embed], ephemeral: true });

            // Delete the reply after 5 seconds
            setTimeout(async () => {
                try {
                    await interaction.deleteReply();
                } catch (error) {
                    // Ignore
                }
            }, 5000);
        }
    });
};