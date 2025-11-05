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
module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (!message.guild || message.author.bot) return;
        if (message.content.startsWith('.gamble') || message.content.startsWith('.g')) {
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
            handleGambleCommand(message);
        }
    });

    // Helper: Validate currency
    function isValidCurrency(currency) {
        return ['coins', 'gems'].includes(currency?.toLowerCase());
    }

    // Main command handler
    async function handleGambleCommand(message) {
        const args = message.content.trim().split(/\s+/);
        const mentionedUser = message.mentions.users.first();
        const currency = args[2]?.toLowerCase();
        const amount = parseInt(args[3], 10);

        // Usage embed
        const usageEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🎲 How to Use the .gamble Command')
            .setDescription('Challenge another user to a friendly gamble!')
            .addFields(
                { name: '📌 Command Format', value: '`.gamble @user coins/gems amount`' },
                {
                    name: '🔧 Parameters', value: [
                        '**@user:** Tag the user you want to challenge.',
                        '**coins/gems:** Choose your currency for the gamble.',
                        '**amount:** Specify the amount to wager.',
                    ].join('\n')
                },
                { name: '❗ Example', value: '`.gamble @alterGolden coins 50`' }
            )
            .setFooter({ text: 'Make sure to use valid parameters!' });

        if (!mentionedUser || !isValidCurrency(currency) || isNaN(amount) || amount <= 0) {
            return message.reply({ embeds: [usageEmbed] });
        }
        if (mentionedUser.id === message.author.id) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ You cannot gamble against yourself!')
                    .setDescription('Please select a different user for your challenge.')]
            });
        }
        if (mentionedUser.bot) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🤖 You cannot gamble against a bot!')
                    .setDescription('Bots are not eligible for gambling.')]
            });
        }
        // Prevent multiple concurrent gambles between same users
        if (!client.activeGambles) client.activeGambles = new Set();
        const sessionKey = [message.author.id, mentionedUser.id].sort().join('-');
        if (client.activeGambles.has(sessionKey)) {
            return message.reply('⚠️ There is already an active gamble between you two. Please wait for it to finish.');
        }
        client.activeGambles.add(sessionKey);
        try {
            await sendGambleInvitation(message, mentionedUser, currency, amount, sessionKey);
        } finally {
            client.activeGambles.delete(sessionKey);
        }
    }

    // Invitation with accept/decline
    async function sendGambleInvitation(message, mentionedUser, currency, amount, sessionKey) {
        const confirmationMessage = new EmbedBuilder()
            .setTitle('🎲 Gamble Invitation 🎲')
            .setDescription(`📣 ${message.author.username} has challenged ${mentionedUser.username} to a thrilling gamble. Do you dare to accept?`)
            .setColor('#0099ff')
            .addFields(
                { name: 'Currency', value: currency, inline: true },
                { name: 'Amount', value: amount.toString(), inline: true }
            );

        const yesButton = new ButtonBuilder()
            .setCustomId(`accept_gamble_${mentionedUser.id}_${Date.now()}`)
            .setLabel('🟢 Yes')
            .setStyle(ButtonStyle.Success);

        const noButton = new ButtonBuilder()
            .setCustomId(`decline_gamble_${mentionedUser.id}_${Date.now()}`)
            .setLabel('🔴 No')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(yesButton, noButton);

        const sentMsg = await message.channel.send({ embeds: [confirmationMessage], components: [row] });

        const filter = interaction =>
            interaction.user.id === mentionedUser.id &&
            (interaction.customId.startsWith('accept_gamble_') || interaction.customId.startsWith('decline_gamble_'));
        const collector = sentMsg.createMessageComponentCollector({ filter, time: 20000 });

        let accepted = false;
        collector.on('collect', async interaction => {
            if (interaction.customId.startsWith('accept_gamble_')) {
                accepted = true;
                await interaction.update({ content: '🎉 You accepted the gamble. Let the games begin!', embeds: [], components: [] });
                collector.stop();
                showGambleGuide(message, mentionedUser, currency, amount, sessionKey);
            } else if (interaction.customId.startsWith('decline_gamble_')) {
                await interaction.update({ content: '🔴 You declined the gamble. Maybe next time!', embeds: [], components: [] });
                collector.stop();
            }
        });
        collector.on('end', async () => {
            if (!accepted) {
                await sentMsg.edit({ content: '⏰ Gamble invitation expired.', embeds: [], components: [] }).catch(() => { });
            }
        });
    }

    // Show guide before gamble
    function showGambleGuide(message, mentionedUser, currency, amount, sessionKey) {
        const guideMessage = new EmbedBuilder()
            .setTitle('📜 Gamble Guide 📜')
            .setDescription("Here's a quick guide to help you with your choices. Each Fumo counters specific other Fumos.")
            .addFields(
                { name: 'ReimuFumo', value: 'Counters: SanaeFumo, MarisaFumo, SakuyaFumo, YoumuFumo', inline: true },
                { name: 'SanaeFumo', value: 'Counters: MarisaFumo, FlandreFumo, AliceFumo, CirnoFumo', inline: true },
                { name: 'MarisaFumo', value: 'Counters: FlandreFumo, SakuyaFumo, AliceFumo, RemiliaFumo', inline: true },
                { name: 'FlandreFumo', value: 'Counters: SakuyaFumo, AliceFumo, YoumuFumo, YukariFumo', inline: true },
                { name: 'SakuyaFumo', value: 'Counters: AliceFumo, YoumuFumo, CirnoFumo, ReimuFumo', inline: true },
                { name: 'AliceFumo', value: 'Counters: YoumuFumo, CirnoFumo, RemiliaFumo, SanaeFumo', inline: true },
                { name: 'YoumuFumo', value: 'Counters: CirnoFumo, RemiliaFumo, YukariFumo, MarisaFumo', inline: true },
                { name: 'CirnoFumo', value: 'Counters: RemiliaFumo, YukariFumo, ReimuFumo, FlandreFumo', inline: true },
                { name: 'RemiliaFumo', value: 'Counters: YukariFumo, ReimuFumo, SanaeFumo, SakuyaFumo', inline: true },
                { name: 'YukariFumo', value: 'Counters: ReimuFumo, SanaeFumo, MarisaFumo, AliceFumo', inline: true }
            )
            .setColor('#0099ff')
            .setFooter({ text: 'Gamble starting in 10 seconds...' });

        message.channel.send({ embeds: [guideMessage] }).then(sentMessage => {
            let countdown = 10;
            const interval = setInterval(() => {
                if (countdown <= 0) {
                    clearInterval(interval);
                    sentMessage.delete().catch(() => { });
                    startGamble(message, mentionedUser, currency, amount, sessionKey);
                } else {
                    countdown--;
                    sentMessage.edit({ embeds: [guideMessage.setFooter({ text: `Gamble starting in ${countdown} seconds...` })] }).catch(() => { });
                }
            }, 1000);
        });
    }

    // Start the actual gamble
    function startGamble(message, mentionedUser, currency, amount, sessionKey) {
        const userChoices = new Map();
        // Check balances
        db.all(
            'SELECT userId, coins, gems FROM userCoins WHERE userId IN (?, ?)',
            [message.author.id, mentionedUser.id],
            (err, rows) => {
                if (err) {
                    message.reply('❌ Database error. Please try again later.');
                    return;
                }
                const userBalance = rows.find(row => row.userId === message.author.id);
                const mentionedUserBalance = rows.find(row => row.userId === mentionedUser.id);

                if (!userBalance || !mentionedUserBalance) {
                    message.reply('❌ One or both users do not have an account. Please register first.');
                    return;
                }
                if (userBalance[currency] < amount || mentionedUserBalance[currency] < amount) {
                    message.reply(`Both players need to have at least ${amount} ${currency} to enter the gamble. Check your balance and try again!`);
                    return;
                }

                const counters = {
                    1: [2, 3, 5, 7],
                    2: [3, 4, 6, 8],
                    3: [4, 5, 7, 9],
                    4: [5, 6, 8, 10],
                    5: [6, 7, 9, 1],
                    6: [7, 8, 10, 2],
                    7: [8, 9, 1, 3],
                    8: [9, 10, 2, 4],
                    9: [10, 1, 3, 5],
                    10: [1, 2, 4, 6]
                };
                const cardNames = [
                    'ReimuFumo', 'SanaeFumo', 'MarisaFumo', 'FlandreFumo', 'SakuyaFumo',
                    'AliceFumo', 'YoumuFumo', 'CirnoFumo', 'RemiliaFumo', 'YukariFumo'
                ];
                const cardButtons = cardNames.map((name, index) =>
                    new ButtonBuilder()
                        .setCustomId(`gamble_card_${index + 1}_${sessionKey}`)
                        .setLabel(name)
                        .setStyle(ButtonStyle.Primary)
                );
                const cardRows = [];
                for (let i = 0; i < cardButtons.length; i += 5) {
                    cardRows.push(new ActionRowBuilder().addComponents(cardButtons.slice(i, i + 5)));
                }

                let messageDeleted = false;
                message.channel.send({ content: 'Choose your card, each card has its unique counter:', components: cardRows }).then(sentMessage => {
                    let countdown = 15;
                    const interval = setInterval(() => {
                        if (countdown <= 0) {
                            clearInterval(interval);
                            if (!messageDeleted) {
                                sentMessage.delete().catch(() => { });
                                messageDeleted = true;
                            }
                            determineWinner(message, userChoices.get(message.author.id), userChoices.get(mentionedUser.id), counters, mentionedUser, currency, amount, cardNames);
                        } else {
                            countdown--;
                            if (!messageDeleted) {
                                sentMessage.edit({
                                    content: `Choose your card... (${countdown} seconds left)`,
                                    components: cardRows
                                }).catch(err => {
                                    if (err.code === 10008) {
                                        messageDeleted = true;
                                        clearInterval(interval);
                                    }
                                });
                            }
                        }
                    }, 1000);

                    const filter = interaction =>
                        (interaction.user.id === message.author.id || interaction.user.id === mentionedUser.id) &&
                        interaction.customId.endsWith(sessionKey);
                    const collector = sentMessage.createMessageComponentCollector({ filter, time: 15000 });

                    collector.on('collect', async interaction => {
                        if (userChoices.has(interaction.user.id)) {
                            await interaction.reply({ content: 'You have already selected a card.', ephemeral: true });
                            return;
                        }
                        const userChoice = parseInt(interaction.customId.split('_')[2], 10);
                        userChoices.set(interaction.user.id, userChoice);
                        await interaction.reply({ content: `You have selected: ${cardNames[userChoice - 1]}`, ephemeral: true });
                        // If both have chosen, end early
                        if (userChoices.size === 2) {
                            clearInterval(interval);
                            if (!messageDeleted) {
                                sentMessage.delete().catch(() => { });
                                messageDeleted = true;
                            }
                            collector.stop();
                            determineWinner(message, userChoices.get(message.author.id), userChoices.get(mentionedUser.id), counters, mentionedUser, currency, amount, cardNames);
                        }
                    });

                    collector.on('end', () => {
                        if (!userChoices.has(message.author.id) || !userChoices.has(mentionedUser.id)) {
                            // Already handled by determineWinner
                        }
                    });
                });
            }
        );
    }

    // Determine winner and update balances -- FIXME
    // This function will determine the winner based on the choices made by both users
    // It will also update the balances of the users based on the outcome of the gamble
    function determineWinner(message, user1Choice, user2Choice, counters, mentionedUser, currency, amount, cardNames) {
        let winner, loser, winnerCard, loserCard;
        let resultEmbed;

        if (!user1Choice && !user2Choice) {
            resultEmbed = new EmbedBuilder()
                .setTitle('❌ Invalid Gamble ❌')
                .setDescription('Neither player selected a card. The gamble cannot proceed.')
                .setColor('#808080');
            message.channel.send({ embeds: [resultEmbed] }).then(sentMessage => {
                setTimeout(() => sentMessage.delete().catch(() => { }), 15000);
            });
            return;
        }
        if (!user1Choice || !user2Choice) {
            if (user1Choice && !user2Choice) {
                winner = message.author;
                loser = mentionedUser;
                winnerCard = user1Choice;
                updateBalances(winner.id, loser.id, currency, amount);
                resultEmbed = new EmbedBuilder()
                    .setTitle('Gamble Result')
                    .setDescription(`${mentionedUser.username} did not select a card.\n${message.author.username} wins by default.`)
                    .addFields(
                        { name: 'Winner', value: `${winner.username}`, inline: true },
                        { name: 'Selected Card', value: `${cardNames[winnerCard - 1]}`, inline: true },
                        { name: 'Amount Won', value: `${amount} ${currency}`, inline: true }
                    )
                    .setColor('#4caf50');
            } else {
                winner = mentionedUser;
                loser = message.author;
                winnerCard = user2Choice;
                updateBalances(winner.id, loser.id, currency, amount);
                resultEmbed = new EmbedBuilder()
                    .setTitle('Gamble Result')
                    .setDescription(`${message.author.username} did not select a card.\n${mentionedUser.username} wins by default.`)
                    .addFields(
                        { name: 'Winner', value: `${winner.username}`, inline: true },
                        { name: 'Selected Card', value: `${cardNames[winnerCard - 1]}`, inline: true },
                        { name: 'Amount Won', value: `${amount} ${currency}`, inline: true }
                    )
                    .setColor('#4caf50');
            }
            message.channel.send({ embeds: [resultEmbed] }).then(sentMessage => {
                setTimeout(() => sentMessage.delete().catch(() => { }), 15000);
            });
            return;
        }
        if (user1Choice === user2Choice) {
            // Both players lose 50% of their bet
            const halfAmount = Math.floor(amount / 2);
            updateBalancesHalfLoss(message.author.id, mentionedUser.id, currency, halfAmount);
            resultEmbed = new EmbedBuilder()
                .setTitle('🎲 Gamble Result: Unexpected Movement of Choice 🎲')
                .setDescription('Both players chose the same card, resulting in an unexpected movement of choice. Each player loses 50% of their bet.')
                .addFields(
                    { name: `${message.author.username}'s Card`, value: cardNames[user1Choice - 1], inline: true },
                    { name: `${mentionedUser.username}'s Card`, value: cardNames[user2Choice - 1], inline: true },
                    { name: 'Amount Lost', value: `${halfAmount} ${currency}`, inline: true }
                )
                .setColor('#ff0000');
        } else {
            if (counters[user1Choice].includes(user2Choice)) {
                winner = message.author;
                loser = mentionedUser;
                winnerCard = user1Choice;
                loserCard = user2Choice;
                updateBalances(winner.id, loser.id, currency, amount);
            } else if (counters[user2Choice].includes(user1Choice)) {
                winner = mentionedUser;
                loser = message.author;
                winnerCard = user2Choice;
                loserCard = user1Choice;
                updateBalances(winner.id, loser.id, currency, amount);
            } else {
                // Draw: no one wins
                resultEmbed = new EmbedBuilder()
                    .setTitle('🎲 Gamble Result: Draw 🎲')
                    .setDescription('No winner could be determined. No currency exchanged.')
                    .addFields(
                        { name: `${message.author.username}'s Card`, value: cardNames[user1Choice - 1], inline: true },
                        { name: `${mentionedUser.username}'s Card`, value: cardNames[user2Choice - 1], inline: true }
                    )
                    .setColor('#aaaaaa');
                message.channel.send({ embeds: [resultEmbed] }).then(sentMessage => {
                    setTimeout(() => sentMessage.delete().catch(() => { }), 15000);
                });
                return;
            }
            // Send the result message for winner and loser
            resultEmbed = new EmbedBuilder()
                .setTitle('🎲 Gamble Result 🎲')
                .setDescription('The gamble has ended! Here are the results:')
                .addFields(
                    { name: 'Winner', value: `${winner.username}`, inline: true },
                    { name: 'Loser', value: `${loser.username}`, inline: true },
                    { name: "Winner's Card", value: `${cardNames[winnerCard - 1]}`, inline: true },
                    { name: "Loser's Card", value: `${cardNames[loserCard - 1]}`, inline: true },
                    { name: 'Amount', value: `${amount} ${currency}`, inline: true }
                )
                .setColor('#0099ff');
        }
        message.channel.send({ embeds: [resultEmbed] }).then(sentMessage => {
            setTimeout(() => sentMessage.delete().catch(() => { }), 15000);
        });
    }

    // Update balances
    function updateBalances(winnerId, loserId, currency, amount) {
        db.run(`UPDATE userCoins SET ${currency} = ${currency} + ? WHERE userId = ?`, [amount, winnerId], err => { });
        db.run(`UPDATE userCoins SET ${currency} = ${currency} - ? WHERE userId = ?`, [amount, loserId], err => { });
        incrementDailyGamble(winnerId);
        incrementDailyGamble(loserId);
    }
    function updateBalancesHalfLoss(user1Id, user2Id, currency, halfAmount) {
        db.run(`UPDATE userCoins SET ${currency} = ${currency} - ? WHERE userId = ?`, [halfAmount, user1Id], err => { });
        db.run(`UPDATE userCoins SET ${currency} = ${currency} - ? WHERE userId = ?`, [halfAmount, user2Id], err => { });
        incrementDailyGamble(user1Id);
        incrementDailyGamble(user2Id);
    }
}