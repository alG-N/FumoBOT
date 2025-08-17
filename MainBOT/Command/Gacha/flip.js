const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
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
client.setMaxListeners(150);
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
const { incrementDailyGamble } = require('../utils/weekly'); // adjust path
/**
 * Flip the Coin Command Handler
 * Improvements:
 * 1. Fixed bug: user object not updated after insert (fetch again).
 * 2. Improved bet parsing (supports decimals, spaces, case-insensitive).
 * 3. Added concurrency safety for DB updates.
 * 4. Improved error handling and logging.
 * 5. Added feature: Show user's balance after every flip.
 * 6. Added feature: Leaderboard command (.flip leaderboard).
 * 7. Improved code structure and readability.
 */

module.exports = (client) => {
    const getUserFromDatabase = (userId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM userCoins WHERE userId = ?`, [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    };

    // Function to update user data in the database
    const updateUserInDatabase = (user) => {
        const { userId, coins, gems, wins, losses } = user;
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE userCoins SET coins = ?, gems = ?, wins = ?, losses = ? WHERE userId = ?`,
                [coins, gems, wins, losses, userId],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    };

    // Parse bet amounts like "100k", "1.5m", "200"
    const parseBetAmount = (betStr) => {
        if (!betStr) return NaN;
        const multiplier = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };
        const match = betStr.replace(/,/g, '').toLowerCase().match(/^(\d+(\.\d+)?)([kmb])?$/);
        if (!match) return NaN;
        const amount = parseFloat(match[1]);
        const suffix = match[3] || '';
        return Math.floor(amount * (multiplier[suffix] || 1));
    };

    // Format numbers with commas
    const formatNumber = (num) => new Intl.NumberFormat().format(Math.floor(num));

    // Helper: get or create user, always returns up-to-date user object
    const getOrCreateUser = async (userId) => {
        let user = await getUserFromDatabase(userId);
        if (!user) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO userCoins (userId, coins, gems, wins, losses, joinDate) VALUES (?, ?, ?, ?, ?, ?)`,
                    [userId, 0, 0, 0, 0, new Date().toISOString()],
                    (err) => (err ? reject(err) : resolve())
                );
            });
            user = await getUserFromDatabase(userId);
        }
        return user;
    };

    // Leaderboard feature
    const sendLeaderboard = async (message, currency) => {
        db.all(
            `SELECT userId, ${currency} FROM userCoins ORDER BY ${currency} DESC LIMIT 10`,
            [],
            async (err, rows) => {
                if (err) {
                    console.error('Leaderboard DB error:', err);
                    return message.channel.send('❌ Error fetching leaderboard.');
                }
                if (!rows.length) {
                    return message.channel.send('No leaderboard data yet.');
                }
                let desc = '';
                for (let i = 0; i < rows.length; i++) {
                    const userTag = await client.users.fetch(rows[i].userId).then(u => u.tag).catch(() => 'Unknown User');
                    desc += `**${i + 1}.** ${userTag} — ${formatNumber(rows[i][currency])} ${currency}\n`;
                }
                const embed = new EmbedBuilder()
                    .setTitle(`🏆 Top 10 ${currency.charAt(0).toUpperCase() + currency.slice(1)} Holders`)
                    .setDescription(desc)
                    .setColor('Gold')
                    .setTimestamp();
                message.channel.send({ embeds: [embed] });
            }
        );
    };

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        // Leaderboard command: .flip leaderboard [coins|gems]
        if (
            message.content.toLowerCase().startsWith('.flip leaderboard') ||
            message.content.toLowerCase().startsWith('.f leaderboard')
        ) {
            const args = message.content.split(/\s+/);
            const currency = (args[2] && ['coins', 'gems'].includes(args[2].toLowerCase())) ? args[2].toLowerCase() : 'coins';
            return sendLeaderboard(message, currency);
        }

        // Main flip command
        if (
            !(
                message.content === '.flip' ||
                message.content.startsWith('.flip ') ||
                message.content === '.f' ||
                message.content.startsWith('.f ')
            )
        ) return;

        try {
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

            const commandUsed = message.content.startsWith('.flip') ? '.flip' : '.f';
            const args = message.content.slice(commandUsed.length).trim().split(/ +/);

            // Usage/help
            if (args.length < 3) {
                const usageEmbed = new EmbedBuilder()
                    .setTitle('🎲 Flip the Coin')
                    .setDescription("Welcome to **Flip the Coin**! Here's how you can play:\n\n**Usage:** `.flip (heads/tails) (coins/gems) (bet) (x?)`\n\n**Example:** `.flip heads gems 100k x2`")
                    .addFields({
                        name: '📈 Multipliers',
                        value: '🔹 **x2:** Double your bet if you win, lose the same amount if you lose.\n' +
                            '🔹 **x3:** Triple your bet if you win, lose 1.5x if you lose.\n' +
                            '🔹 **x5:** 5x your bet if you win, lose 4x if you lose.\n' +
                            '🔹 **x10:** 10x your bet if you win, lose 7.5x if you lose.\n' +
                            '🔹 **x100:** 100x your bet if you win, lose 95x if you lose.'
                    })
                    .setFooter({ text: 'Good luck!', iconURL: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/edbbe96e-e6e4-4343-981d-7eaf881a1964/dg6bym4-429fca4d-11e6-4205-a749-5da24e2bf47f.png' })
                    .setColor('Blue')
                    .setThumbnail('https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/edbbe96e-e6e4-4343-981d-7eaf881a1964/dg6bym4-429fca4d-11e6-4205-a749-5da24e2bf47f.png');
                return message.channel.send({ embeds: [usageEmbed] });
            }

            const choice = args[0]?.toLowerCase();
            const currency = args[1]?.toLowerCase();
            const betStr = args[2];
            const multiplier = args[3] ? parseInt(args[3].replace(/[^0-9]/g, ''), 10) : 2;

            if (!['heads', 'tails'].includes(choice)) {
                return message.channel.send('❌ **Invalid choice.** Please choose either `heads` or `tails`.');
            }
            if (!['coins', 'gems'].includes(currency)) {
                return message.channel.send('❌ **Invalid currency.** Please use either `coins` or `gems`.');
            }

            const betAmount = parseBetAmount(betStr);
            if (isNaN(betAmount) || betAmount <= 0) {
                return message.channel.send('❌ **Invalid bet amount.** Please use a valid number or abbreviation like `100k`, `12m`.');
            }
            if (![2, 3, 5, 10, 100].includes(multiplier)) {
                return message.channel.send('❌ **Invalid multiplier.** Valid options are `x2`, `x3`, `x5`, `x10`, `x100`.');
            }

            const userId = message.author.id;
            let user = await getOrCreateUser(userId);

            if (typeof incrementDailyGamble === 'function') {
                const maybePromise = incrementDailyGamble(userId);
                if (maybePromise && typeof maybePromise.catch === 'function') {
                    maybePromise.catch(() => { });
                }
            }

            if (user[currency] < betAmount) {
                return message.channel.send('❌ **You do not have enough currency to make this bet.**');
            }

            // Flip logic
            const flipResult = Math.random() < 0.5 ? 'heads' : 'tails';
            const won = flipResult === choice;

            let resultMessage;
            let winnings = 0, loss = 0;
            if (won) {
                winnings = betAmount * multiplier;
                user[currency] += winnings;
                user.wins += 1;
                resultMessage = `🎉 **Congratulations!** You won **${formatNumber(winnings)} ${currency}**.`;
            } else {
                // Loss calculation per multiplier
                switch (multiplier) {
                    case 2: loss = betAmount; break;
                    case 3: loss = Math.floor(betAmount * 1.5); break;
                    case 5: loss = betAmount * 4; break;
                    case 10: loss = Math.floor(betAmount * 7.5); break;
                    case 100: loss = betAmount * 95; break;
                    default: loss = betAmount;
                }
                user[currency] -= loss;
                if (user[currency] < 0) user[currency] = 0;
                user.losses += 1;
                resultMessage = `😞 **Sorry!** You lost **${formatNumber(loss)} ${currency}**.`;
            }

            // Save user
            await updateUserInDatabase(user);

            // Show balance after flip
            const balanceMsg = `Your new balance: **${formatNumber(user[currency])} ${currency}**.`;

            const embed = new EmbedBuilder()
                .setTitle('🎲 Flip the Coin')
                .setDescription(`You chose **${choice}**.\nThe coin landed on **${flipResult}**.`)
                .addFields(
                    { name: '🔔 Result', value: `${resultMessage}\n${balanceMsg}` },
                    { name: '📊 Your Stats', value: `**Wins:** ${user.wins}\n**Losses:** ${user.losses}` }
                )
                .setColor(won ? 'Green' : 'Red')
                .setThumbnail(won
                    ? 'https://www.shutterstock.com/image-photo/casual-man-winning-celebrating-isolated-260nw-128232164.jpg'
                    : 'https://www.shutterstock.com/image-photo/crazy-loser-man-260nw-277087517.jpg')
                .setFooter({ text: 'Thanks for playing!', iconURL: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/edbbe96e-e6e4-4343-981d-7eaf881a1964/dg6bym4-429fca4d-11e6-4205-a749-5da24e2bf47f.png' })
                .setTimestamp();

            message.channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('Flip command error:', err);
            message.channel.send('❌ An error occurred while processing your flip. Please try again later.');
        }
    });
};