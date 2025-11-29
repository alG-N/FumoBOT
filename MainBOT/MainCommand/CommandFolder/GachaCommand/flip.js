const {
    EmbedBuilder
} = require('discord.js');
const db = require('../../Core/Database/dbSetting');
const { maintenance, developerID } = require("../../Configuration/Maintenance/maintenanceConfig");
const { isBanned } = require('../../Administrator/BannedList/BanUtils');
const { incrementDailyGamble } = require('../../Ultility/weekly');

module.exports = (client) => {
    const dbGet = (query, params) => new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
    });

    const dbRun = (query, params) => new Promise((resolve, reject) => {
        db.run(query, params, (err) => err ? reject(err) : resolve());
    });

    const dbAll = (query, params) => new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
    });

    const getOrCreateUser = async (userId) => {
        let user = await dbGet(`SELECT * FROM userCoins WHERE userId = ?`, [userId]);
        if (!user) {
            await dbRun(
                `INSERT INTO userCoins (userId, coins, gems, wins, losses, joinDate) VALUES (?, 0, 0, 0, 0, ?)`,
                [userId, new Date().toISOString()]
            );
            user = await dbGet(`SELECT * FROM userCoins WHERE userId = ?`, [userId]);
        }
        return user;
    };

    const updateUser = (user) => dbRun(
        `UPDATE userCoins SET coins = ?, gems = ?, wins = ?, losses = ? WHERE userId = ?`,
        [user.coins, user.gems, user.wins, user.losses, user.userId]
    );

    const parseBet = (str) => {
        if (!str) return NaN;
        const match = str.replace(/,/g, '').toLowerCase().match(/^(\d+(\.\d+)?)([kmb])?$/);
        if (!match) return NaN;
        const multipliers = { k: 1e3, m: 1e6, b: 1e9 };
        return Math.floor(parseFloat(match[1]) * (multipliers[match[3]] || 1));
    };

    const fmt = (num) => new Intl.NumberFormat().format(Math.floor(num));

    const sendLeaderboard = async (message, currency) => {
        try {
            const rows = await dbAll(
                `SELECT userId, ${currency} FROM userCoins ORDER BY ${currency} DESC LIMIT 10`,
                []
            );
            
            if (!rows.length) return message.channel.send('No leaderboard data yet.');

            const desc = await Promise.all(
                rows.map(async (row, i) => {
                    const tag = await client.users.fetch(row.userId)
                        .then(u => u.tag)
                        .catch(() => 'Unknown User');
                    return `**${i + 1}.** ${tag} — ${fmt(row[currency])} ${currency}`;
                })
            );

            const embed = new EmbedBuilder()
                .setTitle(`🏆 Top 10 ${currency.charAt(0).toUpperCase() + currency.slice(1)} Holders`)
                .setDescription(desc.join('\n'))
                .setColor('Gold')
                .setTimestamp();

            message.channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('Leaderboard error:', err);
            message.channel.send('❌ Error fetching leaderboard.');
        }
    };

    const checkRestrictions = (userId) => {
        const banData = isBanned(userId);
        if (maintenance === "yes" && userId !== developerID) {
            return {
                blocked: true,
                embed: new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🚧 Maintenance Mode')
                    .setDescription("The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden")
                    .setFooter({ text: "Thank you for your patience" })
                    .setTimestamp()
            };
        }
        
        if (banData) {
            let desc = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;
            
            if (banData.expiresAt) {
                const ms = banData.expiresAt - Date.now();
                const d = Math.floor(ms / 864e5);
                const h = Math.floor((ms % 864e5) / 36e5);
                const m = Math.floor((ms % 36e5) / 6e4);
                const s = Math.floor((ms % 6e4) / 1000);
                const time = [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`]
                    .filter(Boolean).join(' ');
                desc += `\n**Time Remaining:** ${time}`;
            } else {
                desc += `\n**Ban Type:** Permanent`;
            }

            return {
                blocked: true,
                embed: new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('⛔ You Are Banned')
                    .setDescription(desc)
                    .setFooter({ text: "Ban enforced by developer" })
                    .setTimestamp()
            };
        }
        return { blocked: false };
    };

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const content = message.content.toLowerCase();

        if (content.startsWith('.flip leaderboard') || content.startsWith('.f leaderboard')) {
            const args = content.split(/\s+/);
            const currency = ['coins', 'gems'].includes(args[2]) ? args[2] : 'coins';
            return sendLeaderboard(message, currency);
        }

        if (!content.startsWith('.flip') && !content.startsWith('.f')) return;
        if (content === '.flip' || content === '.f') {
            const embed = new EmbedBuilder()
                .setTitle('🎲 Flip the Coin')
                .setDescription("**Usage:** `.flip (heads/tails) (coins/gems) (bet) (x?)`\n**Example:** `.flip heads gems 100k x2`")
                .addFields({
                    name: '📈 Multipliers',
                    value: '🔹 **x2:** Win 2x, lose 1x\n🔹 **x3:** Win 3x, lose 1.5x\n' +
                           '🔹 **x5:** Win 5x, lose 4x\n🔹 **x10:** Win 10x, lose 7.5x\n' +
                           '🔹 **x100:** Win 100x, lose 95x'
                })
                .setColor('Blue')
                .setFooter({ text: 'Good luck!' });
            return message.channel.send({ embeds: [embed] });
        }

        try {
            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) return message.reply({ embeds: [restriction.embed] });

            const args = content.replace(/^\.f(lip)?\s+/, '').split(/\s+/);
            if (args.length < 3) return; 
            const [choice, currency, betStr, multStr] = args;
            const mult = multStr ? parseInt(multStr.replace(/\D/g, ''), 10) : 2;
            const bet = parseBet(betStr);

            if (!['heads', 'tails'].includes(choice)) {
                return message.channel.send('❌ Invalid choice. Use `heads` or `tails`.');
            }
            if (!['coins', 'gems'].includes(currency)) {
                return message.channel.send('❌ Invalid currency. Use `coins` or `gems`.');
            }
            if (isNaN(bet) || bet <= 0) {
                return message.channel.send('❌ Invalid bet amount.');
            }
            if (![2, 3, 5, 10, 100].includes(mult)) {
                return message.channel.send('❌ Invalid multiplier. Use x2, x3, x5, x10, or x100.');
            }

            const user = await getOrCreateUser(message.author.id);
            
            if (typeof incrementDailyGamble === 'function') {
                incrementDailyGamble(message.author.id).catch(() => {});
            }

            if (user[currency] < bet) {
                return message.channel.send('❌ Insufficient balance.');
            }

            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const won = result === choice;

            const lossMultipliers = { 2: 1, 3: 1.5, 5: 4, 10: 7.5, 100: 95 };
            let amount, msg;
            
            if (won) {
                amount = bet * mult;
                user[currency] += amount;
                user.wins += 1;
                msg = `🎉 **You won ${fmt(amount)} ${currency}!**`;
            } else {
                amount = Math.floor(bet * lossMultipliers[mult]);
                user[currency] = Math.max(0, user[currency] - amount);
                user.losses += 1;
                msg = `😞 **You lost ${fmt(amount)} ${currency}.**`;
            }

            await updateUser(user);

            const embed = new EmbedBuilder()
                .setTitle('🎲 Flip the Coin')
                .setDescription(`You chose **${choice}**. The coin landed on **${result}**.`)
                .addFields(
                    { name: '🔔 Result', value: `${msg}\nBalance: **${fmt(user[currency])} ${currency}**` },
                    { name: '📊 Stats', value: `Wins: ${user.wins} | Losses: ${user.losses}` }
                )
                .setColor(won ? 'Green' : 'Red')
                .setTimestamp();

            message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error('Flip error:', err);
            message.channel.send('❌ An error occurred. Please try again.');
        }
    });
};