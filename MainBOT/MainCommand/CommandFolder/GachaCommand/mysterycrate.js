const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events
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

const CRATE_OUTCOMES = [
    { multiplier: 0.15, text: 'Lose 85% of your bet' },
    { multiplier: 2, text: 'x2 your bet' },
    { multiplier: 0, text: 'Lose all your bet' },
    { multiplier: 1.5, text: 'x1.5 your bet' },
    { multiplier: 1, text: 'Nothing' },
    { multiplier: 10, text: 'x10 your bet' },
    { multiplier: 5, text: 'x5 your bet' },
    { multiplier: 0.5, text: 'Lose 50% of your bet' },
    { multiplier: 20, text: 'x20 your bet' },
    { multiplier: 0.75, text: 'Lose 25% of your bet' },
    { multiplier: 50, text: 'x50 your bet' },
    { multiplier: -1, text: 'Mystery Crate Glitch: All your balance lost!' }
];

function parseArgs(content) {
    const args = content.trim().split(/\s+/);
    if (args.length < 4) return null;
    return {
        numCrates: parseInt(args[1], 10),
        betAmount: parseInt(args[2], 10),
        currency: (args[3] || '').toLowerCase() === 'gems' ? 'gems' : 'coins'
    };
}

function createCrateButtons(numCrates) {
    const rows = [];
    for (let i = 0; i < numCrates; i += 5) {
        const row = new ActionRowBuilder();
        for (let j = i; j < Math.min(i + 5, numCrates); j++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`crate_${j}`)
                    .setLabel(`Crate ${j + 1}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        rows.push(row);
    }
    return rows;
}

function getCrateResults(numCrates, betAmount) {
    return Array.from({ length: numCrates }, () => {
        const outcome = CRATE_OUTCOMES[Math.floor(Math.random() * CRATE_OUTCOMES.length)];
        return {
            reward: outcome.multiplier === -1 ? 0 : Math.floor(betAmount * outcome.multiplier),
            description: outcome.text,
            multiplier: outcome.multiplier
        };
    });
}

async function getUserBalance(userId, currency) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT ${currency} FROM userCoins WHERE userId = ?`, [userId], (err, row) => {
            if (err) return reject(err);
            resolve(row ? row[currency] : null);
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

module.exports = async (client) => {
    const activeSessions = new Map();

    client.on(Events.MessageCreate, async (message) => {
        if (!message.guild || message.author.bot) return;
        if (!message.content.toLowerCase().startsWith('.mysterycrate') &&
            !message.content.toLowerCase().startsWith('.mc')) return;

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

        if (message.content.trim().split(/\s+/).length === 1) {
            return message.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('🎰 Mystery Crate Tutorial 🎰')
                    .setDescription(
                        [
                            "Welcome to the Mystery Crate game! Here's how to play:\n",
                            "1️⃣ **Command Format:** `.mysteryCrate <number_of_crates> <bet_amount> <currency>`",
                            "   - `<number_of_crates>`: Choose between **1 and 8** crates.",
                            "   - `<bet_amount>`: Enter the amount you want to bet.",
                            "   - `<currency>`: Specify `coins` or `gems`.\n",
                            "2️⃣ **Example:** `.mysteryCrate 3 100 coins`\n",
                            "3️⃣ **Goal:** Pick a crate and see if luck is on your side! 🎁\n",
                            "May luck be in your favor!"
                        ].join("\n")
                    )
                    .setColor('#FFD700')
                    .setFooter({ text: 'Use the command to start playing!', iconURL: message.author.displayAvatarURL({ dynamic: true }) })]
            });
        }

        const parsed = parseArgs(message.content);
        if (!parsed) {
            return message.reply('Usage: `.mysteryCrate <number_of_crates> <bet_amount> <currency>`\nExample: `.mysteryCrate 3 100 coins`');
        }

        const { numCrates, betAmount, currency } = parsed;
        const userId = message.author.id;

        if (activeSessions.has(userId)) {
            return message.reply('You already have an ongoing Mystery Crate session. Please complete it before starting another.');
        }
        if (isNaN(numCrates) || numCrates < 1 || numCrates > 8) {
            return message.reply('Please specify a valid number of crates (1 to 8).');
        }
        if (isNaN(betAmount) || betAmount <= 0) {
            return message.reply('Please specify a valid bet amount.');
        }

        let balance;
        try {
            balance = await getUserBalance(userId, currency);
            if (balance === null) {
                return message.reply(`You don't have any ${currency} yet. Earn some before playing!`);
            }
            if (balance < betAmount) {
                return message.reply(`You don't have enough ${currency}. Your current balance is ${balance.toLocaleString()} ${currency}.`);
            }
        } catch (err) {
            console.error('[Mystery Crate] Balance fetch error:', err);
            return message.reply('⚠️ An error occurred while retrieving your balance. Please try again later.');
        }

        const crateResults = getCrateResults(numCrates, betAmount);
        const msg = await message.channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🎰 Mystery Crate 🎰')
                .setDescription('Pick one of the crates to see your reward!')
                .setColor('#FFD700')
                .setFooter({ text: 'May luck be in your favor!', iconURL: message.author.displayAvatarURL({ dynamic: true }) })],
            components: createCrateButtons(numCrates)
        });

        activeSessions.set(userId, { msg, crateResults, betAmount, currency, numCrates, balance });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === userId && i.customId.startsWith('crate_'),
            max: 1,
            time: 20000
        });

        collector.on('collect', async (interaction) => {
            const selectedCrateIndex = parseInt(interaction.customId.split('_')[1], 10);
            const selectedCrate = crateResults[selectedCrateIndex];

            const netReward = selectedCrate.multiplier === -1
                ? -balance
                : selectedCrate.reward - betAmount;

            try {
                await updateUserBalance(userId, currency, netReward);
                incrementDailyGamble(userId);
            } catch (err) {
                console.error('[Mystery Crate] Balance update error:', err);
                await interaction.reply({ content: '⚠️ An error occurred while updating your balance.', ephemeral: true });
                activeSessions.delete(userId);
                return;
            }

            const resultMessages = crateResults.map((result, idx) =>
                `Crate ${idx + 1}: ${result.description} -> ${result.multiplier === -1 ? `All ${currency} lost!` : `${result.reward.toLocaleString()} ${currency}`}`
            );

            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle('🎰 Mystery Crate Results 🎰')
                    .setDescription(resultMessages.join('\n'))
                    .addFields(
                        { name: 'Your Choice:', value: `Crate ${selectedCrateIndex + 1}: ${selectedCrate.description} -> ${selectedCrate.multiplier === -1 ? `All ${currency} lost!` : `${selectedCrate.reward.toLocaleString()} ${currency}`}` },
                        { name: 'Net Result:', value: `${netReward >= 0 ? 'Profit' : 'Loss'} of ${Math.abs(netReward).toLocaleString()} ${currency}` }
                    )
                    .setColor(netReward >= 0 ? 0x00FF00 : 0xFF0000)
                    .setTimestamp()],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('play_again')
                        .setLabel('🔄 Play Again')
                        .setStyle(ButtonStyle.Success)
                )]
            });

            const playAgainCollector = msg.createMessageComponentCollector({
                filter: i => i.user.id === userId && i.customId === 'play_again',
                max: 1,
                time: 15000
            });

            playAgainCollector.on('collect', async (playAgainInteraction) => {
                await playAgainInteraction.deferUpdate();
                activeSessions.delete(userId);

                const replayMessage = {
                    ...message,
                    content: `.mysterycrate ${numCrates} ${betAmount} ${currency}`
                };
                client.emit(Events.MessageCreate, replayMessage);
            });

            playAgainCollector.on('end', () => {
                activeSessions.delete(userId);
            });
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                msg.edit({ content: '⏳ You took too long to pick a crate!', components: [] });
                activeSessions.delete(userId);
            }
        });

        msg.createMessageComponentCollector({
            filter: i => i.user.id !== userId,
            time: 20000
        }).on('collect', i => {
            i.reply({ content: "⛔ This isn't your Mystery Crate session!", ephemeral: true });
        });
    });
};