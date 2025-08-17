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
 * Mystery Crate Command Handler
 * Improvements:
 * 1. Bug fixes: Fixed session handling, button index, and rare edge cases.
 * 2. Structure: Split logic into smaller functions, improved readability.
 * 3. Naming: Improved variable and function names.
 * 4. Feature: Added a "Play Again" button for quick replay.
 * 5. Error Handling: More robust DB and input checks, concurrency safety.
 */

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
    { multiplier: 50, text: 'x50 your bet' }, // Rare
    { multiplier: -1, text: 'Mystery Crate Glitch: All your balance lost!' } // Punishing
];

function parseArgs(content) {
    const args = content.trim().split(/\s+/);
    if (args.length < 4) return null;
    const numCrates = parseInt(args[1], 10);
    const betAmount = parseInt(args[2], 10);
    const currency = (args[3] || '').toLowerCase() === 'gems' ? 'gems' : 'coins';
    return { numCrates, betAmount, currency };
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

function createPlayAgainButton() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('play_again')
                .setLabel('🔁 Play Again')
                .setStyle(ButtonStyle.Success)
        )
    ];
}

function getCrateResults(numCrates, betAmount) {
    return Array.from({ length: numCrates }, () => {
        const outcome = CRATE_OUTCOMES[Math.floor(Math.random() * CRATE_OUTCOMES.length)];
        const reward = outcome.multiplier === -1
            ? 0 // Will handle -1 (glitch) separately
            : Math.floor(betAmount * outcome.multiplier);
        return { reward, description: outcome.text, multiplier: outcome.multiplier };
    });
}

function getUserBalance(db, userId, currency) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT ${currency} FROM userCoins WHERE userId = ?`, [userId], (err, row) => {
            if (err) return reject(err);
            resolve(row ? row[currency] : null);
        });
    });
}

function updateUserBalance(db, userId, currency, amount) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE userCoins SET ${currency} = ${currency} + ? WHERE userId = ?`, [amount, userId], function (err) {
            if (err) return reject(err);
            resolve();
        });
    });
}

module.exports = async (client) => {
    // Session store (per process)
    const activeSessions = new Map();

    client.on(Events.MessageCreate, async (message) => {
        if (!message.guild || message.author.bot) return;
        if (!message.content.toLowerCase().startsWith('.mysterycrate') && !message.content.toLowerCase().startsWith('.mc')) return;

        // Maintenance mode
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

        // Tutorial
        const args = message.content.trim().split(/\s+/);
        if (args.length === 1) {
            const tutorialEmbed = new EmbedBuilder()
                .setTitle('🎰 Mystery Crate Tutorial 🎰')
                .setDescription(
                    'Welcome to the Mystery Crate game! Here’s how to play:\n\n' +
                    '1️⃣ **Command Format:** `.mysteryCrate <number_of_crates> <bet_amount> <currency>`\n' +
                    '   - `<number_of_crates>`: Choose between 1 and 8 crates.\n' +
                    '   - `<bet_amount>`: Enter the amount you want to bet.\n' +
                    '   - `<currency>`: Specify `coins` or `gems`.\n\n' +
                    '2️⃣ **Example:** `.mysteryCrate 3 100 coins`\n' +
                    '   - This would bet 100 coins on 3 mystery crates.\n\n' +
                    '3️⃣ **Goal:** Pick a crate and see if luck is on your side for big rewards! 🎁\n\n' +
                    'May luck be in your favor!'
                )
                .setColor('#FFD700')
                .setFooter({ text: 'Use the command to start playing!', iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [tutorialEmbed] });
        }

        // Parse and validate arguments
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

        // Check user balance
        let balance;
        try {
            balance = await getUserBalance(db, userId, currency);
        } catch (err) {
            console.error(err);
            return message.reply('⚠️ An error occurred while retrieving your balance. Please try again later.');
        }
        if (balance === null) {
            return message.reply(`You don't have any ${currency} yet. Earn some before playing!`);
        }
        if (balance < betAmount) {
            return message.reply(`You don't have enough ${currency}. Your current balance is ${balance.toLocaleString()} ${currency}.`);
        }

        // Generate crate results
        const crateResults = getCrateResults(numCrates, betAmount);

        // Send crate selection message
        const embed = new EmbedBuilder()
            .setTitle('🎰 Mystery Crate 🎰')
            .setDescription('Pick one of the crates to see your reward!')
            .setColor('#FFD700')
            .setThumbnail('https://example.com/mystery_crate.png')
            .setFooter({ text: 'May luck be in your favor!', iconURL: message.author.displayAvatarURL({ dynamic: true }) });

        const crateButtons = createCrateButtons(numCrates);
        const msg = await message.channel.send({ embeds: [embed], components: crateButtons });

        // Store session
        activeSessions.set(userId, { msg, crateResults, betAmount, currency, numCrates });

        // Collector for crate selection
        const filter = i => i.user.id === userId;
        const collector = msg.createMessageComponentCollector({ filter, max: 1, time: 20000 });

        collector.on('collect', async (interaction) => {
            const selectedCrateIndex = parseInt(interaction.customId.split('_')[1], 10);
            if (isNaN(selectedCrateIndex) || selectedCrateIndex < 0 || selectedCrateIndex >= numCrates) {
                await interaction.reply({ content: 'Invalid crate selection.', ephemeral: true });
                return;
            }
            const selectedCrate = crateResults[selectedCrateIndex];

            // Calculate net reward
            let netReward;
            if (selectedCrate.multiplier === -1) {
                netReward = -balance; // Lose all
            } else {
                netReward = selectedCrate.reward - betAmount;
            }

            // Update balance
            try {
                await updateUserBalance(db, userId, currency, netReward);
                incrementDailyGamble(userId);
            } catch (err) {
                console.error(err);
                await interaction.reply({ content: '⚠️ An error occurred while updating your balance. Please try again later.', ephemeral: true });
                activeSessions.delete(userId);
                return;
            }

            // Show results
            const resultMessages = crateResults.map((result, idx) =>
                `Crate ${idx + 1}: ${result.description} -> ${result.multiplier === -1 ? `All ${currency} lost!` : `${result.reward.toLocaleString()} ${currency}`}`
            );
            const resultEmbed = new EmbedBuilder()
                .setTitle('🎰 Mystery Crate Results 🎰')
                .setDescription(resultMessages.join('\n'))
                .addFields(
                    { name: 'Your Choice:', value: `Crate ${selectedCrateIndex + 1}: ${selectedCrate.description} -> ${selectedCrate.multiplier === -1 ? `All ${currency} lost!` : `${selectedCrate.reward.toLocaleString()} ${currency}`}` },
                    { name: 'Net Result:', value: `${netReward >= 0 ? 'Profit' : 'Loss'} of ${Math.abs(netReward).toLocaleString()} ${currency}` }
                )
                .setColor(netReward >= 0 ? 0x00FF00 : 0xFF0000)
                .setTimestamp();

            await interaction.update({ embeds: [resultEmbed], components: createPlayAgainButton() });

            // Play again collector
            const playAgainCollector = msg.createMessageComponentCollector({
                filter: i => i.user.id === userId && i.customId === 'play_again',
                max: 1,
                time: 15000
            });
            playAgainCollector.on('collect', async (playAgainInteraction) => {
                activeSessions.delete(userId);
                await playAgainInteraction.deferUpdate();
                // Re-run the command with the same parameters
                message.content = `.mysteryCrate ${numCrates} ${betAmount} ${currency}`;
                client.emit(Events.MessageCreate, message);
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

        // Prevent other users from interacting
        msg.createMessageComponentCollector({
            filter: i => i.user.id !== userId,
            time: 20000
        }).on('collect', i => {
            i.reply({ content: "⛔ This isn't your Mystery Crate session!", ephemeral: true });
        });
    });
};