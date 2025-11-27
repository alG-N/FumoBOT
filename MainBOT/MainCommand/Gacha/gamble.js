const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../Database/db');
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
const { incrementDailyGamble } = require('../Utils/weekly');

module.exports = (client) => {
    // Initialize active gambles tracker
    if (!client.activeGambles) client.activeGambles = new Set();

    // Promisified database operations
    const dbGet = (query, params) => new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
    });

    const dbAll = (query, params) => new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
    });

    const dbRun = (query, params) => new Promise((resolve, reject) => {
        db.run(query, params, (err) => err ? reject(err) : resolve());
    });

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

    const CARDS = ['ReimuFumo', 'SanaeFumo', 'MarisaFumo', 'FlandreFumo', 'SakuyaFumo',
        'AliceFumo', 'YoumuFumo', 'CirnoFumo', 'RemiliaFumo', 'YukariFumo'];

    const COUNTERS = {
        1: [2, 3, 5, 7], 2: [3, 4, 6, 8], 3: [4, 5, 7, 9], 4: [5, 6, 8, 10], 5: [6, 7, 9, 1],
        6: [7, 8, 10, 2], 7: [8, 9, 1, 3], 8: [9, 10, 2, 4], 9: [10, 1, 3, 5], 10: [1, 2, 4, 6]
    };

    const updateBalances = async (winnerId, loserId, currency, amount) => {
        await Promise.all([
            dbRun(`UPDATE userCoins SET ${currency} = ${currency} + ? WHERE userId = ?`, [amount, winnerId]),
            dbRun(`UPDATE userCoins SET ${currency} = ${currency} - ? WHERE userId = ?`, [amount, loserId])
        ]);
        incrementDailyGamble(winnerId).catch(() => { });
        incrementDailyGamble(loserId).catch(() => { });
    };

    const updateBalancesHalfLoss = async (user1Id, user2Id, currency, halfAmount) => {
        await Promise.all([
            dbRun(`UPDATE userCoins SET ${currency} = ${currency} - ? WHERE userId = ?`, [halfAmount, user1Id]),
            dbRun(`UPDATE userCoins SET ${currency} = ${currency} - ? WHERE userId = ?`, [halfAmount, user2Id])
        ]);
        incrementDailyGamble(user1Id).catch(() => { });
        incrementDailyGamble(user2Id).catch(() => { });
    };

    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot) return;
        if (!message.content.startsWith('.gamble') && !message.content.startsWith('.g')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) return message.reply({ embeds: [restriction.embed] });

        const args = message.content.trim().split(/\s+/);
        const mentionedUser = message.mentions.users.first();
        const currency = args[2]?.toLowerCase();
        const amount = parseInt(args[3], 10);

        const usageEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🎲 How to Use .gamble')
            .setDescription('Challenge another user to a gamble!')
            .addFields(
                { name: '📌 Format', value: '`.gamble @user coins/gems amount`' },
                { name: '📋 Parameters', value: '**@user:** Tag the user\n**coins/gems:** Currency\n**amount:** Wager amount' },
                { name: '✅ Example', value: '`.gamble @alterGolden coins 50`' }
            )
            .setFooter({ text: 'Use valid parameters!' });

        if (!mentionedUser || !['coins', 'gems'].includes(currency) || isNaN(amount) || amount <= 0) {
            return message.reply({ embeds: [usageEmbed] });
        }
        if (mentionedUser.id === message.author.id) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Cannot gamble yourself!')
                    .setDescription('Select a different user.')]
            });
        }
        if (mentionedUser.bot) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🤖 Cannot gamble bots!')
                    .setDescription('Bots are not eligible.')]
            });
        }

        const sessionKey = [message.author.id, mentionedUser.id].sort().join('-');
        if (client.activeGambles.has(sessionKey)) {
            return message.reply('⚠️ There is already an active gamble between you two.');
        }

        client.activeGambles.add(sessionKey);
        try {
            await sendInvitation(message, mentionedUser, currency, amount, sessionKey);
        } finally {
            client.activeGambles.delete(sessionKey);
        }
    });

    async function sendInvitation(message, mentionedUser, currency, amount, sessionKey) {
        const embed = new EmbedBuilder()
            .setTitle('🎲 Gamble Invitation')
            .setDescription(`📣 ${message.author.username} challenges ${mentionedUser.username} to a gamble!`)
            .setColor('#0099ff')
            .addFields(
                { name: 'Currency', value: currency, inline: true },
                { name: 'Amount', value: amount.toString(), inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`accept_${Date.now()}`)
                .setLabel('🟢 Yes')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`decline_${Date.now()}`)
                .setLabel('🔴 No')
                .setStyle(ButtonStyle.Danger)
        );

        const msg = await message.channel.send({ embeds: [embed], components: [row] });

        const filter = i => i.user.id === mentionedUser.id;
        const collector = msg.createMessageComponentCollector({ filter, time: 20000 });

        let accepted = false;
        collector.on('collect', async (interaction) => {
            if (interaction.customId.startsWith('accept_')) {
                accepted = true;
                await interaction.update({ content: '🎉 Gamble accepted! Starting...', embeds: [], components: [] });
                collector.stop();
                showGuide(message, mentionedUser, currency, amount, sessionKey);
            } else {
                await interaction.update({ content: '🔴 Gamble declined.', embeds: [], components: [] });
                collector.stop();
            }
        });

        collector.on('end', async () => {
            if (!accepted) {
                await msg.edit({ content: '⏰ Invitation expired.', embeds: [], components: [] }).catch(() => { });
            }
        });
    }

    async function showGuide(message, mentionedUser, currency, amount, sessionKey) {
        const guideFields = CARDS.map((card, i) => ({
            name: card,
            value: `Counters: ${COUNTERS[i + 1].map(c => CARDS[c - 1]).join(', ')}`,
            inline: true
        }));

        const embed = new EmbedBuilder()
            .setTitle('📜 Gamble Guide')
            .setDescription('Each Fumo counters specific other Fumos.')
            .addFields(guideFields)
            .setColor('#0099ff')
            .setFooter({ text: 'Starting in 10 seconds...' });

        const msg = await message.channel.send({ embeds: [embed] });
        let countdown = 10;

        const interval = setInterval(async () => {
            if (countdown <= 0) {
                clearInterval(interval);
                await msg.delete().catch(() => { });
                startGamble(message, mentionedUser, currency, amount, sessionKey);
            } else {
                countdown--;
                embed.setFooter({ text: `Starting in ${countdown} seconds...` });
                await msg.edit({ embeds: [embed] }).catch(() => clearInterval(interval));
            }
        }, 1000);
    }

    async function startGamble(message, mentionedUser, currency, amount, sessionKey) {
        try {
            const rows = await dbAll(
                'SELECT userId, coins, gems FROM userCoins WHERE userId IN (?, ?)',
                [message.author.id, mentionedUser.id]
            );

            const user1 = rows.find(r => r.userId === message.author.id);
            const user2 = rows.find(r => r.userId === mentionedUser.id);

            if (!user1 || !user2) {
                return message.reply('❌ One or both users lack an account. Register first.');
            }
            if (user1[currency] < amount || user2[currency] < amount) {
                return message.reply(`❌ Both players need at least ${amount} ${currency}.`);
            }

            const buttons = CARDS.map((name, i) =>
                new ButtonBuilder()
                    .setCustomId(`card_${i + 1}_${sessionKey}`)
                    .setLabel(name)
                    .setStyle(ButtonStyle.Primary)
            );

            const buttonRows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                buttonRows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
            }

            const msg = await message.channel.send({
                content: 'Choose your card (15 seconds):',
                components: buttonRows
            });

            const userChoices = new Map();
            let countdown = 15;
            let deleted = false;

            const interval = setInterval(async () => {
                if (countdown <= 0 || userChoices.size === 2) {
                    clearInterval(interval);
                    if (!deleted) {
                        await msg.delete().catch(() => { });
                        deleted = true;
                    }
                    determineWinner(message, userChoices, mentionedUser, currency, amount);
                } else {
                    countdown--;
                    if (!deleted) {
                        await msg.edit({ content: `Choose your card (${countdown}s left)`, components: buttonRows })
                            .catch(() => { deleted = true; clearInterval(interval); });
                    }
                }
            }, 1000);

            const filter = i =>
                (i.user.id === message.author.id || i.user.id === mentionedUser.id) &&
                i.customId.endsWith(sessionKey);

            const collector = msg.createMessageComponentCollector({ filter, time: 15000 });

            collector.on('collect', async (interaction) => {
                if (userChoices.has(interaction.user.id)) {
                    return interaction.reply({ content: 'You already selected!', ephemeral: true });
                }

                const choice = parseInt(interaction.customId.split('_')[1], 10);
                userChoices.set(interaction.user.id, choice);

                await interaction.reply({
                    content: `Selected: ${CARDS[choice - 1]}`,
                    ephemeral: true
                });

                if (userChoices.size === 2) {
                    clearInterval(interval);
                    collector.stop();
                    if (!deleted) {
                        await msg.delete().catch(() => { });
                        deleted = true;
                    }
                    determineWinner(message, userChoices, mentionedUser, currency, amount);
                }
            });

        } catch (err) {
            console.error('Gamble error:', err);
            message.reply('❌ Database error.');
        }
    }

    async function determineWinner(message, userChoices, mentionedUser, currency, amount) {
        const c1 = userChoices.get(message.author.id);
        const c2 = userChoices.get(mentionedUser.id);

        let embed;

        if (!c1 && !c2) {
            embed = new EmbedBuilder()
                .setTitle('❌ Invalid Gamble')
                .setDescription('Neither player selected. No changes.')
                .setColor('#808080');
        }
        else if (!c1 || !c2) {
            const winner = c1 ? message.author : mentionedUser;
            const loser = c1 ? mentionedUser : message.author;
            const card = c1 || c2;

            await updateBalances(winner.id, loser.id, currency, amount);

            embed = new EmbedBuilder()
                .setTitle('🎲 Gamble Result')
                .setDescription(`${loser.username} didn't select.\n${winner.username} wins by default!`)
                .addFields(
                    { name: 'Winner', value: winner.username, inline: true },
                    { name: 'Card', value: CARDS[card - 1], inline: true },
                    { name: 'Won', value: `${amount} ${currency}`, inline: true }
                )
                .setColor('#4caf50');
        }
        else if (c1 === c2) {
            const half = Math.floor(amount / 2);
            await updateBalancesHalfLoss(message.author.id, mentionedUser.id, currency, half);

            embed = new EmbedBuilder()
                .setTitle('🎲 Unexpected Movement!')
                .setDescription('Same card chosen! Both lose 50% of bet.')
                .addFields(
                    { name: `${message.author.username}'s Card`, value: CARDS[c1 - 1], inline: true },
                    { name: `${mentionedUser.username}'s Card`, value: CARDS[c2 - 1], inline: true },
                    { name: 'Lost', value: `${half} ${currency}`, inline: true }
                )
                .setColor('#ff0000');
        }
        else {
            let winner, loser, wCard, lCard;

            if (COUNTERS[c1].includes(c2)) {
                winner = message.author;
                loser = mentionedUser;
                wCard = c1;
                lCard = c2;
            } else if (COUNTERS[c2].includes(c1)) {
                winner = mentionedUser;
                loser = message.author;
                wCard = c2;
                lCard = c1;
            } else {
                embed = new EmbedBuilder()
                    .setTitle('🎲 Draw!')
                    .setDescription('No winner. No currency exchanged.')
                    .addFields(
                        { name: `${message.author.username}'s Card`, value: CARDS[c1 - 1], inline: true },
                        { name: `${mentionedUser.username}'s Card`, value: CARDS[c2 - 1], inline: true }
                    )
                    .setColor('#aaaaaa');

                const msg = await message.channel.send({ embeds: [embed] });
                setTimeout(() => msg.delete().catch(() => { }), 15000);
                return;
            }

            await updateBalances(winner.id, loser.id, currency, amount);

            embed = new EmbedBuilder()
                .setTitle('🎲 Gamble Result')
                .setDescription('The gamble has ended!')
                .addFields(
                    { name: 'Winner', value: winner.username, inline: true },
                    { name: 'Loser', value: loser.username, inline: true },
                    { name: "Winner's Card", value: CARDS[wCard - 1], inline: true },
                    { name: "Loser's Card", value: CARDS[lCard - 1], inline: true },
                    { name: 'Amount', value: `${amount} ${currency}`, inline: true }
                )
                .setColor('#0099ff');
        }

        const msg = await message.channel.send({ embeds: [embed] });
        setTimeout(() => msg.delete().catch(() => { }), 15000);
    }
};