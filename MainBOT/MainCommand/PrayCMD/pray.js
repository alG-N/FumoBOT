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
const { getWeekIdentifier, incrementWeeklyShiny, incrementWeeklyAstral } = require('../Utils/weekly');

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

// ===== HELPER FUNCTIONS =====
function formatNumber(num) {
    if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Qa';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
}

// Promisify database operations
const dbGet = (query, params) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
});

const dbRun = (query, params) => new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
        err ? reject(err) : resolve({ changes: this.changes, lastID: this.lastID });
    });
});

const dbAll = (query, params) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
});

// Add item to inventory
async function addToInventory(userId, itemName, quantity = 1) {
    const existing = await dbGet(
        `SELECT * FROM userInventory WHERE userId = ? AND itemName = ?`,
        [userId, itemName]
    );

    if (existing) {
        await dbRun(
            `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
            [quantity, userId, itemName]
        );
    } else {
        await dbRun(
            `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)`,
            [userId, itemName, quantity]
        );
    }
}

// Increment daily quest progress
function incrementDailyPray(userId) {
    // Daily quest: pray_5
    dbRun(`
        INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date)
        VALUES (?, 'pray_5', 1, 0, DATE('now'))
        ON CONFLICT(userId, questId, date) DO UPDATE SET 
            progress = MIN(dailyQuestProgress.progress + 1, 5),
            completed = CASE 
                WHEN dailyQuestProgress.progress + 1 >= 5 THEN 1
                ELSE dailyQuestProgress.completed
            END
    `, [userId]).catch(err => console.error(`[DailyPray] Error:`, err.message));

    // Weekly quest: pray_success_25
    const weekKey = getWeekIdentifier();
    dbRun(`
        INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
        VALUES (?, 'pray_success_25', 1, 0, ?)
        ON CONFLICT(userId, questId, week) DO UPDATE SET 
            progress = MIN(weeklyQuestProgress.progress + 1, 25),
            completed = CASE 
                WHEN weeklyQuestProgress.progress + 1 >= 25 THEN 1
                ELSE weeklyQuestProgress.completed
            END
    `, [userId, weekKey]).catch(err => console.error(`[WeeklyPray] Error:`, err.message));

    // Achievement
    dbRun(`
        INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
        VALUES (?, 'total_prays', 1, 0)
        ON CONFLICT(userId, achievementId) DO UPDATE SET progress = progress + 1
    `, [userId]).catch(err => console.error(`[Achievement] Error:`, err.message));
}

// Get rarity from fumo name
function getRarity(fumoName) {
    if (!fumoName) return 'Common';
    const rarities = ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL',
        '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY',
        'EPIC', 'RARE', 'UNCOMMON'];
    return rarities.find(r => fumoName.includes(`(${r})`)) || 'Common';
}

module.exports = async (client, fumos) => {
    const activePrayers = new Set();
    const usageTracker = new Map();
    const cooldown = new Map();

    // Character definitions
    const characters = [
        {
            name: 'Yuyuko',
            picture: 'https://wiki.koumakan.jp/images/hisouten/4/40/Swr-portrait-yuyuko.png',
            offer: 'If you give her 150k coins and 30k gems, you will win 2x luck for the next 100 rolls and some small Shiny+ chance, but she can be a little bit greedy.'
        },
        {
            name: 'Yukari',
            picture: 'https://en.touhouwiki.net/images/thumb/e/e8/Th155Yukari.png/275px-Th155Yukari.png',
            offer: 'If your fumo`s inventory below 1000, you will be punished. If your fumo is over 1000, she might as well to take it away but you will win something else.'
        },
        {
            name: 'Reimu',
            picture: 'https://wiki.koumakan.jp/images/hisouten/4/4d/Swr-portrait-reimu.png',
            offer: 'Give her 60k coins and 5k gems, and you will get something rare in the next meeting(Requirement stackable).'
        },
        {
            name: 'Marisa',
            picture: 'https://static.wikia.nocookie.net/touhou/images/0/07/Th19Marisa.png',
            offer: 'She will ask to borrow you 15k coins, and she will return it upon the next encounter.'
        },
        {
            name: 'Sakuya',
            picture: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/8fb402e5-c8cd-4bbe-a0ef-40b744424ab5/dg03t5g-acc5dd09-b613-4086-8c02-b673c79b57d8.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcLzhmYjQwMmU1LWM4Y2QtNGJiZS1hMGVmLTQwYjc0NDQyNGFiNVwvZGcwM3Q1Zy1hY2M1ZGQwOS1iNjEzLTQwODYtOGMwMi1iNjczYzc5YjU3ZDgucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.7X-9s-58lVI9v0qNS6norvMhfO1frLPeleMVjTt7jcE',
            offer: 'Time flies... unless I say otherwise. Instantly skip 12 hours of progress—farming and passive coins only. But, I take 10% of your earnings as tribute. The more you rely on me, the more I claim.'
        }
    ];

    client.on('messageCreate', async (message) => {
        // Command validation
        const validCommands = ['.pray', '.p'];
        const isValidCommand = validCommands.some(cmd =>
            message.content === cmd || message.content.startsWith(cmd + ' ')
        );

        if (!isValidCommand || message.author.bot) return;

        const userId = message.author.id;

        // Check if user already has active prayer
        if (activePrayers.has(userId)) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🔒 Decision Pending')
                    .setDescription('You already have an ongoing offer! Please accept or decline it before praying again.')
                    .setColor('#ff0000')]
            });
        }

        // Check maintenance & ban status
        const banData = isBanned(userId);
        if ((maintenance === "yes" && userId !== developerID) || banData) {
            const isMaintenance = maintenance === "yes" && userId !== developerID;
            const description = isMaintenance
                ? "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden"
                : `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

            let footerText = isMaintenance ? "Thank you for your patience" : "Ban enforced by developer";

            if (!isMaintenance && banData.expiresAt) {
                const remaining = banData.expiresAt - Date.now();
                const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
                const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                const seconds = Math.floor((remaining / 1000) % 60);

                const timeString = [
                    days ? `${days}d` : '',
                    hours ? `${hours}h` : '',
                    minutes ? `${minutes}m` : '',
                    seconds ? `${seconds}s` : ''
                ].filter(Boolean).join(' ');

                description += `\n**Time Remaining:** ${timeString}`;
            } else if (!isMaintenance) {
                description += `\n**Ban Type:** Permanent`;
            }

            console.log(`[${new Date().toISOString()}] Blocked user (${userId}) due to ${isMaintenance ? "maintenance" : "ban"}.`);

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(isMaintenance ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
                    .setDescription(description)
                    .setFooter({ text: footerText })
                    .setTimestamp()]
            });
        }

        // Check PrayTicket(R)
        try {
            const ticket = await dbGet(
                `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                [userId, 'PrayTicket(R)']
            );

            if (!ticket || ticket.quantity <= 0) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('📿 Missing Prayer Ticket')
                        .setDescription("You need at least **1 PrayTicket(R)** in your inventory to use this command.")
                        .setColor('#ff0000')]
                });
            }

            // Check usage limit (25 per hour)
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const limit = 25;

            if (!usageTracker.has(userId)) usageTracker.set(userId, []);
            const timestamps = usageTracker.get(userId).filter(ts => now - ts < oneHour);
            usageTracker.set(userId, timestamps);

            if (timestamps.length >= limit) {
                const nextAvailable = new Date(timestamps[0] + oneHour);
                const timeRemaining = Math.ceil((nextAvailable - now) / 1000);
                const minutes = Math.floor(timeRemaining / 60);
                const seconds = timeRemaining % 60;

                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('⚠️ Limit Reached')
                        .setDescription(`You've used the \`/pray\` command **${limit} times** in the past hour.\nPlease wait **${minutes}m ${seconds}s** before praying again.`)
                        .setColor('#ffcc00')]
                });
            }

            // Consume ticket
            await dbRun(
                `UPDATE userInventory SET quantity = quantity - 1 WHERE userId = ? AND itemName = ?`,
                [userId, 'PrayTicket(R)']
            );

            // Track usage
            timestamps.push(now);
            usageTracker.set(userId, timestamps);

            // Check cooldown
            const cooldownEnd = cooldown.get(userId);
            if (cooldownEnd && cooldownEnd > Date.now()) {
                const remainingTime = Math.ceil((cooldownEnd - Date.now()) / 60000);
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('🔮 Yukari\'s Boundary: Banishment! 🔮')
                        .setDescription(`Yukari has temporarily sealed your ability to pray. Please wait ${remainingTime} minutes before attempting to use the /pray command again. Go outside and do something else`)
                        .setColor('#ff0000')
                        .setImage('https://cdn.donmai.us/original/52/2c/522c49c3fd7a0174b060b639faf6a230.jpg')]
                });
            }

            // Random character selection
            const character = characters[Math.floor(Math.random() * characters.length)];

            const embed = new EmbedBuilder()
                .setTitle(`🔮 '${character.name}' Appears! 🔮`)
                .setImage(character.picture)
                .setDescription(`"${character.offer} The choice is yours. Will you accept the offer?"`);

            const acceptButton = new ButtonBuilder()
                .setCustomId(`accept_${character.name}`)
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success);

            const rejectButton = new ButtonBuilder()
                .setCustomId(`reject_${character.name}`)
                .setLabel('Reject')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(acceptButton, rejectButton);
            const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

            activePrayers.add(userId);

            const filter = (interaction) => ['accept', 'reject'].includes(interaction.customId.split('_')[0]);
            const collector = sentMessage.createMessageComponentCollector({ filter, max: 1, time: 60000 });

            collector.on('collect', async (interaction) => {
                const action = interaction.customId.split('_')[0];

                if (action === 'reject') {
                    activePrayers.delete(interaction.user.id);
                    await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setTitle('🔮 Decision Made 🔮')
                            .setDescription(`You decided to decline ${character.name}'s enticing offer. Nothing happened until you pray again..`)
                            .setColor('#0099ff')]
                    });

                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            acceptButton.setDisabled(true),
                            rejectButton.setDisabled(true)
                        );
                    await interaction.message.edit({ components: [disabledRow] });
                    return;
                }

                // Accept button pressed
                await interaction.deferUpdate();
                activePrayers.delete(interaction.user.id);

                try {
                    switch (character.name) {
                        case 'Yuyuko':
                            await handleYuyuko(message.author.id, message.channel);
                            break;
                        case 'Yukari':
                            await handleYukari(message.author.id, message.channel);
                            break;
                        case 'Reimu':
                            await handleReimu(message.author.id, message.channel, fumos, interaction.user.id);
                            break;
                        case 'Marisa':
                            await handleMarisa(message.author.id, message.channel);
                            break;
                        case 'Sakuya':
                            await handleSakuya(message.author.id, message.channel);
                            break;
                    }
                } catch (error) {
                    console.error(`[${character.name}] Error:`, error);
                    message.channel.send("❌ An error occurred while processing your prayer.");
                }
            });

            collector.on('end', (collected) => {
                activePrayers.delete(userId);
                if (collected.size === 0) {
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            acceptButton.setDisabled(true),
                            rejectButton.setDisabled(true)
                        );

                    message.channel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('⏳ Time\'s Up! ⏳')
                            .setDescription('You didn\'t accept nor decline the offer, so they leave.')
                            .setColor('#ff0000')]
                    });
                    sentMessage.edit({ components: [disabledRow] });
                }
            });

        } catch (error) {
            console.error('[Pray Command] Error:', error);
            message.reply("❌ An error occurred while processing your prayer.");
        }
    });

    // ===== CHARACTER HANDLERS =====

    // Yuyuko Handler
    async function handleYuyuko(userId, channel) {
        const randomNumber = Math.floor(Math.random() * 100) + 1;
        const user = await dbGet(`SELECT luck, rollsLeft FROM userCoins WHERE userId = ?`, [userId]);

        if (!user) {
            console.error('No user found');
            return;
        }

        let currentLuck = user.luck || 0;
        let newLuck = currentLuck;
        let bonusRolls = 0;
        const isDevour = randomNumber <= 15;

        if (isDevour) {
            // Devour outcome
            bonusRolls = currentLuck >= 1 ? 2000 : 1000;
            newLuck = Math.min(currentLuck + 0.1, 1);
            if (newLuck >= 1) bonusRolls = 2000;
            bonusRolls = Math.min(bonusRolls, 10000);

            const result = await dbRun(`
                UPDATE userCoins 
                SET coins = CASE WHEN coins - 1500000 < 0 THEN 0 ELSE coins - 1500000 END,
                    gems = CASE WHEN gems - 350000 < 0 THEN 0 ELSE gems - 350000 END,
                    rollsLeft = rollsLeft + ?,
                    luck = ?
                WHERE userId = ?`,
                [bonusRolls, newLuck, userId]
            );

            if (result.changes === 0) {
                await dbRun(`UPDATE userCoins SET coins = 0, gems = 0 WHERE userId = ?`, [userId]);
                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🌸 Yuyuko\'s Feast 🌸')
                        .setDescription('Yuyuko devoured *everything*. Coins, gems, all gone. She leaves you with nothing but ghostly regrets.')
                        .setColor('#ff0000')]
                });
            } else {
                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🍽️ Devoured! 🍽️')
                        .setDescription(`Yuyuko took 1.5m coins & 350k gems... but left ${bonusRolls} rolls${bonusRolls === 2000 ? ' thanks to ShinyMark+!' : ' as a ghostly favor.'}`)
                        .setColor('#0099ff')]
                });
            }
        } else {
            // Normal outcome
            bonusRolls = currentLuck >= 1 ? 200 : 100;
            newLuck = Math.min(currentLuck + 0.01, 1);
            if (newLuck >= 1) bonusRolls = 200;
            bonusRolls = Math.min(bonusRolls, 10000);

            const result = await dbRun(`
                UPDATE userCoins 
                SET coins = coins - 150000, 
                    gems = gems - 30000, 
                    rollsLeft = rollsLeft + ?, 
                    luck = ?, 
                    luckRarity = 'LEGENDARY,MYTHIC,EXCLUSIVE,???,ASTRAL,CELESTIAL,INFINITE,ETERNAL,TRANSCENDENT' 
                WHERE userId = ? AND coins >= 150000 AND gems >= 30000`,
                [bonusRolls, newLuck, userId]
            );

            if (result.changes === 0) {
                cooldown.set(userId, Date.now() + 10 * 60 * 1000);
                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🔮 Yukari Intervenes 🔮')
                        .setDescription('Too broke to feed Yuyuko. Yukari seals you away for 10 minutes.')
                        .setColor('#ff0000')]
                });
            } else {
                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🍀 Yuyuko\'s Blessing 🍀')
                        .setDescription(`${bonusRolls === 200 ? 'ShinyMark+ triggered! ' : ''}150k coins & 30k gems lost... but luck shines on your next ${bonusRolls} rolls.`)
                        .setColor('#0099ff')]
                });
            }
        }

        incrementDailyPray(userId);
    }

    // Yukari Handler
    async function handleYukari(userId, channel) {
        const prices = {
            'Common': 113,
            'UNCOMMON': 270,
            'RARE': 675,
            'EPIC': 1125,
            'OTHERWORLDLY': 1800,
            'LEGENDARY': 18000,
            'MYTHICAL': 168750,
            'EXCLUSIVE': 1125000,
            '???': 22500000,
            'ASTRAL': 45000000,
            'CELESTIAL': 90000000,
            'INFINITE': 180000000,
            'ETERNAL': 360000000,
            'TRANSCENDENT': 720000000
        };

        const markRequirements = {
            1: [1500, 2000],
            5: [1750, 2500],
            7: [2000, 3000],
            10: [3000, 5000]
        };

        try {
            const rows = await dbAll(
                `SELECT id, fumoName, quantity FROM userInventory WHERE userId = ? AND fumoName LIKE '%(%)'`,
                [userId]
            );

            // Group definitions
            const group1Rarities = ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE'];
            const group2Rarities = ['Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE'];
            const group3Rarities = ['ETERNAL', 'TRANSCENDENT'];

            // Categorize fumos
            const groups = { group1: [], group2: [], group3: [], shiny: [], alg: [] };
            let totalCoins = 0, totalFumos = 0;

            for (const row of rows) {
                if (!row.fumoName?.includes('(')) continue;

                const qty = row.quantity || 1;
                totalFumos += qty;

                const rarity = getRarity(row.fumoName);
                let price = prices[rarity] || 0;

                // Apply tag multipliers
                if (row.fumoName.includes('[✨SHINY]')) price *= 5;
                if (row.fumoName.includes('[🌟alG]')) price *= 150;

                const fumoData = { ...row, price, quantity: qty };

                // Categorize
                if (row.fumoName.includes('[✨SHINY]')) groups.shiny.push(fumoData);
                if (row.fumoName.includes('[🌟alG]')) groups.alg.push(fumoData);

                if (group1Rarities.includes(rarity)) groups.group1.push(fumoData);
                else if (group2Rarities.includes(rarity)) groups.group2.push(fumoData);
                else if (group3Rarities.includes(rarity)) groups.group3.push(fumoData);

                totalCoins += price;
            }

            const user = await dbGet(`SELECT yukariMark FROM userCoins WHERE userId = ?`, [userId]);
            let mark = ((user?.yukariMark || 0) % 10) + 1;
            const [minRequired, maxAllowed] = markRequirements[mark] || [1000, 1500];

            // Check minimum requirement
            if (totalFumos < minRequired) {
                await dbRun(`UPDATE userCoins SET coins = coins - 50000 WHERE userId = ?`, [userId]);
                cooldown.set(userId, Date.now() + 10 * 60 * 1000);

                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Too Few Fumos! ❌')
                        .setDescription(`Mark ${mark} requires at least ${minRequired} fumos.\nYukari fines you 50k coins & seals /pray for 10 minutes.`)
                        .setColor('#ff0000')]
                });
                return;
            }

            // Select fumos to trade
            const cappedFumos = Math.min(totalFumos, maxAllowed);
            let selected = [];
            let coinsSelected = 0;

            function takeFromGroup(group, needed) {
                const taken = [];
                for (const fumo of group) {
                    if (needed <= 0) break;
                    const takeQty = Math.min(fumo.quantity, needed);
                    taken.push({ ...fumo, quantity: takeQty });
                    coinsSelected += fumo.price * takeQty;
                    needed -= takeQty;
                }
                return { taken, remaining: needed };
            }

            let needed = cappedFumos;
            const order = ['group1', 'group2', 'group3', 'shiny', 'alg'];

            for (const groupName of order) {
                if (needed <= 0) break;
                const result = takeFromGroup(groups[groupName], needed);
                selected.push(...result.taken);
                needed = result.remaining;
            }

            // Determine mark bonus
            const rewardMultipliers = { 1: 1.5, 5: 3.5, 7: 5, 10: 25 };
            const rewardMultiplier = rewardMultipliers[mark] || 1;

            // Bonus item drop logic
            let bonusItem = '';
            const dropRates = {
                1: { shard: 0.35 },
                5: { shard: 0.50, golden: 0.10, nullified: 0.10, undefined: 0.10, null: 0.10 },
                7: { shard: 0.75, golden: 0.10, nullified: 0.07, undefined: 0.04, null: 0.04 },
                10: { shard: 1.0, golden: 0.05, sigil: 0.03, nullified: 0.15, undefined: 0.30, null: 0.30 }
            };

            const rates = dropRates[mark] || { shard: 0.15 };
            const roll = Math.random();

            if (mark === 10) {
                bonusItem = 'MysteriousShard(M)'; // Guaranteed
                if (roll < 0.05) bonusItem = 'GoldenSigil(?)';
                else if (roll < 0.08) bonusItem = 'S!gil?(?)';
                else if (roll < 0.23) bonusItem = 'Nullified(?)';
                else if (roll < 0.53) bonusItem = 'Undefined(?)';
                else if (roll < 0.83) bonusItem = 'Null?(?)';
            } else if (mark === 7) {
                if (roll < 0.75) bonusItem = 'MysteriousShard(M)';
                else if (roll < 0.85) bonusItem = 'GoldenSigil(?)';
                else if (roll < 0.92) bonusItem = 'Nullified(?)';
                else if (roll < 0.96) bonusItem = 'Undefined(?)';
                else if (roll < 1.0) bonusItem = 'Null(?)';
            } else if (mark === 5) {
                if (roll < 0.50) bonusItem = 'MysteriousShard(M)';
                else if (roll < 0.60) bonusItem = 'GoldenSigil(?)';
                else if (roll < 0.70) bonusItem = 'Nullified(?)';
                else if (roll < 0.80) bonusItem = 'Undefined(?)';
                else if (roll < 0.90) bonusItem = 'Null(?)';
            } else if (mark === 1) {
                if (roll < 0.35) bonusItem = 'MysteriousShard(M)';
            } else {
                if (roll < 0.15) bonusItem = 'MysteriousShard(M)';
            }

            if (bonusItem) {
                await addToInventory(userId, bonusItem, 1);
            }

            // Calculate rewards
            coinsSelected = Math.floor(coinsSelected * rewardMultiplier);
            let totalGems = Math.floor(coinsSelected / 100);
            let bonusMessage = '';

            // 0.5% chance to scam
            if (Math.random() < 0.005) {
                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('😈 Yukari\'s Prank 😈')
                        .setDescription('Yukari scammed you. Everything\'s gone. 💸')
                        .setColor('#ff0000')]
                });
                incrementDailyPray(userId);
                return;
            }

            // 20% chance for bonus
            if (Math.random() < 0.20) {
                coinsSelected = Math.floor(coinsSelected * 1.15);
                totalGems = Math.floor(totalGems * 1.5);
                bonusMessage += '\n🎉 Bonus! 15% extra coins & x1.5 gems!';
            }

            // 7% chance for Fumo Token
            if (Math.random() < 0.07) {
                await dbRun(
                    `UPDATE userCoins SET spiritTokens = COALESCE(spiritTokens, 0) + 1 WHERE userId = ?`,
                    [userId]
                );
                bonusMessage += '\n🌸 You got a rare Fumo Token!';
            }

            // Delete selected fumos
            for (const fumo of selected) {
                const qtyToDelete = fumo.quantity;
                const existing = await dbGet(
                    `SELECT quantity FROM userInventory WHERE id = ?`,
                    [fumo.id]
                );

                if (existing) {
                    if (existing.quantity > qtyToDelete) {
                        await dbRun(
                            `UPDATE userInventory SET quantity = quantity - ? WHERE id = ?`,
                            [qtyToDelete, fumo.id]
                        );
                    } else {
                        await dbRun(`DELETE FROM userInventory WHERE id = ?`, [fumo.id]);
                    }
                }
            }

            // Update user stats
            await dbRun(
                `UPDATE userCoins 
                SET coins = coins + ?, 
                    gems = gems + ?, 
                    yukariCoins = yukariCoins + ?, 
                    yukariGems = yukariGems + ?, 
                    yukariMark = ? 
                WHERE userId = ?`,
                [coinsSelected, totalGems, coinsSelected, totalGems, mark, userId]
            );

            const nextMark = mark === 10 ? 1 : mark + 1;
            const [nextMin, nextMax] = markRequirements[nextMark] || [1000, 1500];

            await channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('🌌 Yukari\'s Exchange 🌌')
                    .setDescription(
                        `Fumos traded, you have earned:\n💰 +${formatNumber(coinsSelected)} coins\n💎 +${formatNumber(totalGems)} gems${bonusMessage}${bonusItem ? `\n🎁 You also got **${bonusItem}** from her as well!` : ''}`
                    )
                    .addFields(
                        { name: '🌌 Yukari\'s Mark', value: `${mark}/10`, inline: true },
                        { name: '⚠️ Next Mark Requirement', value: `Requires **${nextMin}–${nextMax}** Fumos`, inline: true }
                    )
                    .setColor('#0099ff')
                    .setFooter({ text: `Priority: Group1(??? to INFINITE) → Group2(Common to EXCLUSIVE) → Group3(ETERNAL to TRANSCENDENT) → SHINY → alG` })]
            });

            incrementDailyPray(userId);

        } catch (error) {
            console.error('[Yukari] Error:', error);
            channel.send('❌ An error occurred during Yukari\'s exchange.');
        }
    }

    // Reimu Handler
    async function handleReimu(userId, channel, fumos, interactionUserId) {
        try {
            const user = await dbGet(
                `SELECT reimuStatus, reimuPityCount, reimuUsageCount, reimuLastReset, coins, gems, reimuPenalty 
                FROM userCoins WHERE userId = ?`,
                [userId]
            );

            if (!user) {
                await channel.send('❌ User data not found.');
                return;
            }

            const now = Date.now();
            const twelveHours = 12 * 60 * 60 * 1000;

            // Reset usage if 12 hours passed
            if (!user.reimuLastReset || now - user.reimuLastReset > twelveHours) {
                user.reimuUsageCount = 0;
                await dbRun(
                    `UPDATE userCoins SET reimuUsageCount = 0, reimuLastReset = ? WHERE userId = ?`,
                    [now, userId]
                );
            }

            // Block if usage >= 3
            if (user.reimuUsageCount >= 3) {
                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle("⏳ Prayer Cooldown")
                        .setDescription("You have prayed to Reimu too many times today. Come back later.")
                        .setColor(0xff5555)]
                });
                return;
            }

            // === GIFT PHASE ===
            if (user.reimuStatus === 1) {
                const baseProbabilities = {
                    'EPIC': 40.0,
                    'LEGENDARY': 18.0,
                    'OTHERWORLDLY': 13.0,
                    'MYTHICAL': 7.0,
                    'EXCLUSIVE': 5.0,
                    '???': 2.5,
                    'ASTRAL': 2.0,
                    'CELESTIAL': 1.5,
                    'INFINITE': 0.8,
                    'ETERNAL': 0.5,
                    'TRANSCENDENT': 0.2
                };

                function applyPityBoost(probabilities, pityCount) {
                    if (pityCount >= 15) return probabilities;
                    const boostFactor = Math.pow(1.08, pityCount);
                    const boosted = { ...probabilities };
                    const rareKeys = ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
                    rareKeys.forEach(r => boosted[r] *= boostFactor);
                    return boosted;
                }

                function pickRarity(probabilities) {
                    const entries = Object.entries(probabilities);
                    const total = entries.reduce((sum, [, val]) => sum + val, 0);
                    const rand = Math.random() * total;
                    let acc = 0;
                    for (const [rarity, chance] of entries) {
                        acc += chance;
                        if (rand <= acc) return rarity;
                    }
                    return entries[0][0];
                }

                let pickedRarity;
                const pityCount = user.reimuPityCount || 0;

                if (pityCount >= 14) {
                    // Guarantee ultra-rare
                    const pityRarities = ["???", "ASTRAL", "CELESTIAL", "INFINITE", "ETERNAL", "TRANSCENDENT"];
                    pickedRarity = pityRarities[Math.floor(Math.random() * pityRarities.length)];
                } else {
                    const adjustedProbabilities = applyPityBoost(baseProbabilities, pityCount);
                    pickedRarity = pickRarity(adjustedProbabilities);
                }

                const filteredFumos = fumos.filter(fumo => fumo.rarity === pickedRarity);
                if (filteredFumos.length === 0) {
                    await channel.send('❌ No fumos available for that rarity!');
                    return;
                }

                const fumo = filteredFumos[Math.floor(Math.random() * filteredFumos.length)];
                const isAlterGolden = Math.random() < 0.008;
                const isShiny = !isAlterGolden && Math.random() < 0.18;

                let fumoName = fumo.name;
                if (isAlterGolden) {
                    fumoName += '[🌟alG]';
                    incrementWeeklyShiny(interactionUserId);
                } else if (isShiny) {
                    fumoName += '[✨SHINY]';
                    incrementWeeklyShiny(interactionUserId);
                }

                const astralPlusRarities = ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
                if (astralPlusRarities.includes(fumo.rarity)) {
                    incrementWeeklyAstral(interactionUserId);
                }

                await dbRun(
                    `INSERT INTO userInventory (userId, items, fumoName) VALUES (?, ?, ?)`,
                    [userId, fumo.rarity, fumoName]
                );

                const variantNote = isAlterGolden
                    ? " It's a **divine, golden anomaly**—a truly miraculous find!"
                    : isShiny
                        ? " It sparkles with a magical glow—**a Shiny Fumo!**"
                        : "";

                const description = `She gives you a **${fumo.rarity}** Fumo: **${fumoName}**.${variantNote} Cherish this rare companion!`;

                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle(`🎁 A Gift from Reimu! 🎁`)
                        .setImage(fumo.picture)
                        .setDescription(description)
                        .setColor('#0099ff')]
                });

                incrementDailyPray(userId);

                // Token drop (buffed rates)
                let tokensEarned = 0;
                const rng = Math.random();
                if (rng < 0.0004) tokensEarned = 25;
                else if (rng < 0.012) tokensEarned = 5;
                else if (rng < 0.06) tokensEarned = 2;
                else if (rng < 0.18) tokensEarned = 1;

                if (tokensEarned > 0) {
                    await dbRun(
                        `UPDATE userCoins SET spiritTokens = spiritTokens + ? WHERE userId = ?`,
                        [tokensEarned, userId]
                    );
                    await channel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle(`✨ Fumo Token Blessing!`)
                            .setDescription(`You received **${tokensEarned} Fumo Token${tokensEarned > 1 ? 's' : ''}**!`)
                            .setColor('#a29bfe')]
                    });
                }

                // Reset pity if ultra-rare
                const resetPity = astralPlusRarities.includes(fumo.rarity) ? 0 : pityCount + 1;

                await dbRun(
                    `UPDATE userCoins 
                    SET reimuStatus = 0, 
                        reimuPityCount = ?, 
                        reimuUsageCount = reimuUsageCount + 1 
                    WHERE userId = ?`,
                    [resetPity, userId]
                );

            } else {
                // === DONATION PHASE ===
                const baseCoinCost = 60000;
                const baseGemCost = 5000;

                const pity = user.reimuPityCount || 0;
                const penalty = Math.abs(user.reimuPenalty) || 0;

                // Determine multiplier based on pity
                let multiplier = 1;
                if (pity >= 11 && pity <= 15) multiplier = 10;
                else if (pity >= 6 && pity <= 10) multiplier = 5;
                else if (pity >= 1 && pity <= 5) multiplier = 2;

                const requiredCoins = (baseCoinCost + penalty * 50000) * multiplier;
                const requiredGems = (baseGemCost + penalty * 5000) * multiplier;

                if (user.coins >= requiredCoins && user.gems >= requiredGems) {
                    // Successful donation
                    if (penalty >= 1) {
                        await channel.send({
                            embeds: [new EmbedBuilder()
                                .setTitle('🎉 Donation Received 🎉')
                                .setDescription(`You gave ${formatNumber(requiredCoins)} coins and ${formatNumber(requiredGems)} gems. She appreciates your generosity.`)
                                .setColor('#0099ff')]
                        });
                    }

                    await dbRun(
                        `UPDATE userCoins 
                        SET coins = coins - ?, 
                            gems = gems - ?, 
                            reimuStatus = 1, 
                            reimuPenalty = 0 
                        WHERE userId = ?`,
                        [requiredCoins, requiredGems, userId]
                    );

                    await channel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🙏 Reimu\'s Gratitude 🙏')
                            .setDescription(
                                `You have earned her favor.\nNext prayer may bring something rare.\n\n` +
                                `You donated **${formatNumber(requiredCoins)} coins** and **${formatNumber(requiredGems)} gems**.\n` +
                                `Pity Multiplier Applied: x${multiplier}`
                            )
                            .setColor('#0099ff')]
                    });
                } else {
                    // Failed donation - increase penalty
                    await dbRun(
                        `UPDATE userCoins SET reimuPenalty = reimuPenalty + 1 WHERE userId = ?`,
                        [userId]
                    );

                    const updatedUser = await dbGet(
                        `SELECT reimuPenalty FROM userCoins WHERE userId = ?`,
                        [userId]
                    );

                    const penaltyCoins = (updatedUser.reimuPenalty || 1) * 10000;
                    const penaltyGems = (updatedUser.reimuPenalty || 1) * 2000;

                    await channel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('😔 Reimu is Unimpressed 😔')
                            .setDescription(
                                updatedUser.reimuPenalty === 1
                                    ? 'You failed to donate enough. She gives you a cold look.'
                                    : `You angered her. Next time you must pay an extra ${formatNumber(penaltyCoins)} coins and ${formatNumber(penaltyGems)} gems.`
                            )
                            .setColor('#ff0000')]
                    });
                }
            }

        } catch (error) {
            console.error('[Reimu] Error:', error);
            channel.send('❌ An error occurred during Reimu\'s prayer.');
        }
    }

    // Marisa Handler
    async function handleMarisa(userId, channel) {
        try {
            // 15% chance Marisa is absent
            if (Math.random() < 0.15) {
                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🌟 Marisa\'s Absence 🌟')
                        .setDescription('Marisa is not around right now. Try again later!')
                        .setColor('#0099ff')]
                });
                return;
            }

            const user = await dbGet(
                `SELECT coins, gems, prayedToMarisa, marisaDonationCount FROM userCoins WHERE userId = ?`,
                [userId]
            );

            if (!user || user.coins < 15000) {
                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('⚠️ Not Enough Coins ⚠️')
                        .setDescription('You need at least 15,000 coins to donate to Marisa.')
                        .setColor('#ff0000')]
                });
                return;
            }

            const currentCount = user.marisaDonationCount || 0;
            const isPityRound = (currentCount + 1) % 5 === 0; // Every 5th donation triggers pity
            const donatedBefore = user.prayedToMarisa === 1;

            // 3% chance Marisa steals extra (only if not pity round)
            if (!isPityRound && Math.random() < 0.03) {
                const extraStolenCoins = Math.floor((user.coins - 15000) * 0.03);
                const stolenGems = Math.floor((user.gems || 0) * 0.005);
                const newCoinTotal = user.coins - 15000 - extraStolenCoins;

                await dbRun(
                    `UPDATE userCoins SET coins = ?, gems = COALESCE(gems, 0) - ? WHERE userId = ?`,
                    [newCoinTotal, stolenGems, userId]
                );

                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('💀 Marisa\'s Trick 💀')
                        .setDescription(
                            `Marisa cackled and vanished!\nShe stole your **15,000 coin donation**, an **extra ${formatNumber(extraStolenCoins)} coins**, and **${formatNumber(stolenGems)} gems**!`
                        )
                        .setColor('#8b0000')]
                });
                return;
            }

            if (donatedBefore) {
                // === RETURN PHASE ===
                const updatedCoins = user.coins + 20000; // Net profit of 20k (donated 15k, got back 35k)

                await dbRun(
                    `UPDATE userCoins SET coins = ?, prayedToMarisa = 0 WHERE userId = ?`,
                    [updatedCoins, userId]
                );

                const rewardMessages = [];
                let embedDescription = 'You donated 15k coins. She returned with 35k coins for you!\n(Technically 20k profit, but shhh...)\n\n**Rewards:**\n';

                // === POTION DROP ===
                const potionRoll = Math.random();
                const rareChance = isPityRound ? 0.35 : 0.18;
                const legendaryChance = isPityRound ? 0.08 : 0.04;

                if (potionRoll < rareChance || potionRoll >= (1 - legendaryChance)) {
                    let potion;
                    if (potionRoll < rareChance) {
                        potion = {
                            name: 'GemPotionT1(R)',
                            rarity: 'Rare',
                            effect: 'A Gem Potion that boosts your wealth by 15%, lasts for 1 hour'
                        };
                    } else {
                        potion = {
                            name: 'BoostPotionT1(L)',
                            rarity: 'Legendary',
                            effect: 'A magic potion that boosts coin and gem by 25%, lasts for 30 mins'
                        };
                    }
                    rewardMessages.push(`🎁 **${potion.name}** (${potion.rarity}) - ${potion.effect}`);
                    await addToInventory(userId, potion.name, 1);
                }

                // === GEM REWARD ===
                if (Math.random() < (isPityRound ? 0.7 : 0.35)) {
                    const gemBonus1 = Math.floor((Math.random() * 0.15 + 0.25) * 1000); // 25%–40%
                    let gemBonus2 = Math.floor((Math.random() * 0.12 + 0.08) * (Math.random() * 9000 + 10000)); // 8%–20% of 10k–19k
                    gemBonus2 = Math.floor(gemBonus2 / 10) * 10;

                    const totalGems = isPityRound ? (gemBonus1 + gemBonus2) * 2 : (gemBonus1 + gemBonus2);
                    rewardMessages.push(`💎 **${formatNumber(totalGems)} Gems** have been gifted!`);

                    await dbRun(
                        `UPDATE userCoins SET gems = COALESCE(gems, 0) + ? WHERE userId = ?`,
                        [totalGems, userId]
                    );
                }

                // === SPECIAL DROPS ===
                const specialRoll = Math.random();
                const goldenChance = isPityRound ? 0.002 : 0.0007;
                const fragChance = isPityRound ? 0.07 : 0.03;
                const ticketChance = isPityRound ? 0.35 : 0.18;

                if (specialRoll < goldenChance) {
                    rewardMessages.push('✨ **GoldenSigil(?)** - Ultra rare drop!');
                    await addToInventory(userId, 'GoldenSigil(?)', 1);
                } else if (specialRoll < fragChance) {
                    rewardMessages.push('📜 **FragmentOf1800s(R)** - Rare drop!');
                    await addToInventory(userId, 'FragmentOf1800s(R)', 1);
                } else if (specialRoll < ticketChance) {
                    rewardMessages.push('🎫 **HakureiTicket(L)** - A legendary ticket!');
                    await addToInventory(userId, 'HakureiTicket(L)', 1);
                }

                // === PITY COUNTER ===
                const newCount = currentCount + 1;

                if (isPityRound) {
                    // Reward StarShard on pity (every 5th donation)
                    await addToInventory(userId, 'StarShard(M)', 1);
                    await channel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🌟 Loyalty Reward: StarShard! 🌟')
                            .setDescription('After 5 generous donations, Marisa gifts you a mysterious **StarShard(M)**.\nReward chances are also increased!')
                            .setColor('#00ffff')]
                    });

                    await dbRun(
                        `UPDATE userCoins SET marisaDonationCount = 0 WHERE userId = ?`,
                        [userId]
                    );
                } else {
                    await dbRun(
                        `UPDATE userCoins SET marisaDonationCount = ? WHERE userId = ?`,
                        [newCount, userId]
                    );
                }

                if (rewardMessages.length > 0) {
                    embedDescription += rewardMessages.join('\n');
                } else {
                    embedDescription += '(No additional rewards this time.)';
                }

                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('✨ Marisa\'s Blessing ✨')
                        .setDescription(embedDescription)
                        .setColor('#ffd700')]
                });

                incrementDailyPray(userId);

            } else {
                // === FIRST-TIME DONATION ===
                const updatedCoins = user.coins - 15000;

                await dbRun(
                    `UPDATE userCoins SET coins = ?, prayedToMarisa = 1 WHERE userId = ?`,
                    [updatedCoins, userId]
                );

                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🧪 Donation Received 🧪')
                        .setDescription('You gave Marisa 15k coins. She smiles mysteriously...')
                        .setColor('#0099ff')]
                });
            }

        } catch (error) {
            console.error('[Marisa] Error:', error);
            channel.send('❌ An error occurred during Marisa\'s exchange.');
        }
    }

    // Sakuya Handler
    async function handleSakuya(userId, channel) {
        try {
            // Helper: Get fumo stats by rarity
            function getStatsByRarity(fumoName) {
                const rarity = getRarity(fumoName);
                const statMap = {
                    'Common': [25, 5],
                    'UNCOMMON': [45, 10],
                    'RARE': [70, 20],
                    'EPIC': [100, 35],
                    'OTHERWORLDLY': [150, 50],
                    'LEGENDARY': [200, 75],
                    'MYTHICAL': [350, 115],
                    'EXCLUSIVE': [500, 150],
                    '???': [750, 220],
                    'ASTRAL': [1000, 450],
                    'CELESTIAL': [2000, 700],
                    'INFINITE': [3500, 915],
                    'ETERNAL': [5000, 1150],
                    'TRANSCENDENT': [25000, 2500],
                };

                let [coinsPerMin, gemsPerMin] = statMap[rarity] || [0, 0];

                if (fumoName.includes('✨SHINY')) {
                    coinsPerMin *= 2;
                    gemsPerMin *= 2;
                }
                if (fumoName.includes('🌟alG')) {
                    coinsPerMin *= 100;
                    gemsPerMin *= 100;
                }

                return [coinsPerMin, gemsPerMin];
            }

            const user = await dbGet(`SELECT * FROM userCoins WHERE userId = ?`, [userId]);
            if (!user) {
                await channel.send("❌ Couldn't find your account!");
                return;
            }

            const usage = await dbGet(`SELECT * FROM sakuyaUsage WHERE userId = ?`, [userId]);
            const now = Date.now();
            const twelveHoursMs = 12 * 60 * 60 * 1000;
            const twentyFourHoursMs = 24 * 60 * 60 * 1000;
            const oneDayMs = 24 * 60 * 60 * 1000;

            let useCount = usage?.uses || 0;
            let timeBlessing = usage?.timeBlessing || 0;
            let blessingExpiry = usage?.blessingExpiry || null;
            let firstUseTime = usage?.firstUseTime || now;

            // === BLESSING EXPIRY CHECK ===
            if (blessingExpiry && now > blessingExpiry) {
                timeBlessing = 0;
                blessingExpiry = null;
                await dbRun(
                    `UPDATE sakuyaUsage SET timeBlessing = 0, blessingExpiry = NULL WHERE userId = ?`,
                    [userId]
                );
            }

            // === RESET LOGIC ===
            if (usage) {
                const timeSinceFirstUse = now - firstUseTime;

                if (useCount >= 6 && timeSinceFirstUse >= twentyFourHoursMs) {
                    // Reset after 24h lockout
                    useCount = 0;
                    timeBlessing = 0;
                    blessingExpiry = null;
                    firstUseTime = now;
                    await dbRun(
                        `UPDATE sakuyaUsage SET uses = 0, timeBlessing = 0, blessingExpiry = NULL, firstUseTime = ?, lastUsed = ? WHERE userId = ?`,
                        [now, now, userId]
                    );
                } else if (useCount < 6 && timeSinceFirstUse >= twelveHoursMs) {
                    // Reset after 12h window
                    useCount = 0;
                    timeBlessing = 0;
                    firstUseTime = now;
                    await dbRun(
                        `UPDATE sakuyaUsage SET uses = 0, timeBlessing = 0, firstUseTime = ?, lastUsed = ? WHERE userId = ?`,
                        [now, now, userId]
                    );
                }
            }

            // === COST SCALING ===
            const costMap = [0.10, 0.18, 0.28, 0.40, 0.50, 0.60];
            const demand = costMap[useCount] || 0.60;
            const requiredFumos = useCount === 0 ? 0 : (useCount === 1 ? 1 : (useCount >= 2 && useCount <= 4 ? useCount : 2));

            // === RARITY RESTRICTIONS ===
            const allowedRarities = useCount >= 5
                ? ['ASTRAL', 'CELESTIAL', 'INFINITE']
                : ['RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL'];

            const allFumos = await dbAll(`SELECT * FROM userInventory WHERE userId = ?`, [userId]);

            // Check if user owns Sakuya(UNCOMMON) for bonus drop rates
            const ownsSakuyaUncommon = allFumos.some(f => f.fumoName === "Sakuya(UNCOMMON)");
            const dropChances = ownsSakuyaUncommon
                ? { fragment: 0.22, clock: 0.07, watch: 0.015, perfectSkip: 0.03 }
                : { fragment: 0.12, clock: 0.03, watch: 0.005, perfectSkip: 0.01 };

            const rarePlusFumos = allFumos.filter(f => {
                const match = f.fumoName?.match(/\((.*?)\)$/);
                const rarity = match?.[1]?.toUpperCase();
                return allowedRarities.includes(rarity);
            });

            const totalAvailable = rarePlusFumos.reduce((acc, f) => acc + (f.quantity || 1), 0);
            const isPerfectSkip = Math.random() < dropChances.perfectSkip;
            const blessingActive = blessingExpiry && now < blessingExpiry;
            let blessingSkip = false;

            // === REQUIREMENT CHECK ===
            if (totalAvailable < requiredFumos && !isPerfectSkip && !blessingActive) {
                await channel.send(`⚠️ You need at least ${requiredFumos} RARE+ fumo(s) for Sakuya to skip time.`);
                return;
            }

            // === CALCULATE FARMING REWARDS ===
            const farming = await dbAll(`SELECT * FROM farmingFumos WHERE userId = ?`, [userId]);
            const twelveHours = 720;
            let farmingCoins = 0, farmingGems = 0;

            for (const fumo of farming) {
                const [cpm, gpm] = getStatsByRarity(fumo.fumoName);
                const qty = fumo.quantity || 1;
                farmingCoins += cpm * twelveHours * qty;
                farmingGems += gpm * twelveHours * qty;
            }

            const baseCoins = 150 * twelveHours;
            const baseGems = 50 * twelveHours;
            let totalCoins = farmingCoins + baseCoins;
            let totalGems = farmingGems + baseGems;

            // === APPLY BOOSTS ===
            const coinBoosts = await dbAll(
                `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'coin' AND (expiresAt IS NULL OR expiresAt > ?)`,
                [userId, Date.now()]
            );
            totalCoins = Math.floor(totalCoins * coinBoosts.reduce((acc, b) => acc * b.multiplier, 1));

            const gemBoosts = await dbAll(
                `SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'gem' AND (expiresAt IS NULL OR expiresAt > ?)`,
                [userId, Date.now()]
            );
            totalGems = Math.floor(totalGems * gemBoosts.reduce((acc, b) => acc * b.multiplier, 1));

            // === BLESSING ACTIVATION ===
            timeBlessing += 10;

            if (timeBlessing >= 100 && !blessingActive) {
                timeBlessing = 0;
                blessingExpiry = now + oneDayMs;

                await dbRun(
                    `UPDATE sakuyaUsage SET blessingExpiry = ?, timeBlessing = 0 WHERE userId = ?`,
                    [blessingExpiry, userId]
                );

                // Apply cooldown boost
                await dbRun(
                    `INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt) 
                    VALUES (?, 'summonCooldown', 'TimeBlessing', 0.5, ?)`,
                    [userId, blessingExpiry]
                );

                blessingSkip = true;
            }

            // === DOUBLE REWARDS IF BLESSING ACTIVE ===
            if (blessingSkip || blessingActive) {
                totalCoins *= 2;
                totalGems *= 2;
            }

            // === APPLY COST (IF NOT PERFECT SKIP OR BLESSING) ===
            if (!isPerfectSkip && !blessingSkip && !blessingActive) {
                totalCoins = Math.floor(totalCoins * (1 - demand));
                totalGems = Math.floor(totalGems * (1 - demand));
            }

            // === LIMITS ===
            const COIN_LIMIT = 10_000_000_000;
            const GEM_LIMIT = 1_000_000_000;
            if (totalCoins > COIN_LIMIT) totalCoins = COIN_LIMIT;
            if (totalGems > GEM_LIMIT) totalGems = GEM_LIMIT;

            // === REMOVE REQUIRED FUMOS ===
            if (!isPerfectSkip && !blessingSkip && !blessingActive) {
                const expanded = [];
                for (const f of rarePlusFumos) {
                    const qty = f.quantity || 1;
                    for (let i = 0; i < qty; i++) expanded.push({ ...f });
                }
                const shuffled = expanded.sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, requiredFumos);

                for (const fumo of selected) {
                    const existing = await dbGet(
                        `SELECT quantity FROM userInventory WHERE userId = ? AND fumoName = ? ORDER BY quantity DESC LIMIT 1`,
                        [userId, fumo.fumoName]
                    );

                    if (existing) {
                        if (existing.quantity > 1) {
                            await dbRun(
                                `UPDATE userInventory SET quantity = quantity - 1 WHERE userId = ? AND fumoName = ? AND quantity = ?`,
                                [userId, fumo.fumoName, existing.quantity]
                            );
                        } else {
                            await dbRun(
                                `DELETE FROM userInventory WHERE userId = ? AND fumoName = ? LIMIT 1`,
                                [userId, fumo.fumoName]
                            );
                        }
                    }
                }
            }

            // === UPDATE USER REWARDS ===
            await dbRun(
                `UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?`,
                [totalCoins, totalGems, userId]
            );

            // === ITEM DROPS ===
            const drops = [];
            if (Math.random() < dropChances.fragment) drops.push("FragmentOfTime(E)");
            if (Math.random() < dropChances.clock) drops.push("TimeClock-Broken(L)");
            if (Math.random() < dropChances.watch) drops.push("PocketWatch(M)");

            for (const item of drops) {
                await addToInventory(userId, item, 1);
            }

            // === UPDATE USAGE ===
            if (usage) {
                const timeSinceFirstUse = now - firstUseTime;

                if (usage.uses < 6) {
                    if (timeSinceFirstUse >= twelveHoursMs) {
                        await dbRun(
                            `UPDATE sakuyaUsage SET uses = 1, firstUseTime = ?, lastUsed = ?, timeBlessing = ? WHERE userId = ?`,
                            [now, now, timeBlessing, userId]
                        );
                    } else {
                        await dbRun(
                            `UPDATE sakuyaUsage SET uses = uses + 1, lastUsed = ?, timeBlessing = ? WHERE userId = ?`,
                            [now, timeBlessing, userId]
                        );
                    }
                } else {
                    if (timeSinceFirstUse >= twentyFourHoursMs) {
                        await dbRun(
                            `UPDATE sakuyaUsage SET uses = 1, firstUseTime = ?, lastUsed = ?, timeBlessing = ? WHERE userId = ?`,
                            [now, now, timeBlessing, userId]
                        );
                    } else {
                        const timeLeft = twentyFourHoursMs - timeSinceFirstUse;
                        const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                        await channel.send(`⛔ You've reached the maximum skips (6). Please wait **${hours}h ${minutes}m** before using it again.`);
                        return;
                    }
                }
            } else {
                await dbRun(
                    `INSERT INTO sakuyaUsage (userId, uses, firstUseTime, lastUsed, timeBlessing, blessingExpiry)
                    VALUES (?, 1, ?, ?, ?, ?)`,
                    [userId, now, now, timeBlessing, null]
                );
            }

            // === DISPLAY PROGRESS ===
            const currentDemand = Math.min(useCount + 1, 6);
            const progressBar = '█'.repeat(currentDemand) + '░'.repeat(6 - currentDemand);

            const blessingRemaining = blessingActive && blessingExpiry ? blessingExpiry - now : 0;
            const blessingPercent = blessingActive
                ? Math.floor((blessingRemaining / oneDayMs) * 100)
                : Math.min(Math.floor((timeBlessing / 100) * 100), 100);

            const blessingBar = '█'.repeat(Math.floor(blessingPercent / 20)) + '░'.repeat(5 - Math.floor(blessingPercent / 20));

            const hB = Math.floor(blessingRemaining / 3600000);
            const mB = Math.floor((blessingRemaining % 3600000) / 60000);
            const sB = Math.floor((blessingRemaining % 60000) / 1000);
            const blessingTimer = `${hB.toString().padStart(2, '0')}:${mB.toString().padStart(2, '0')}:${sB.toString().padStart(2, '0')}`;

            const embed = new EmbedBuilder()
                .setTitle('🕰️ Sakuya\'s Time Skip 🕰️')
                .setDescription(
                    `${blessingSkip ? '⏳ Sakuya skipped time forward a day!' : '⏳ Sakuya skipped time forward 12 hours!'}\n\n` +
                    `**You earned:**\n🪙 Coins: **${totalCoins.toLocaleString()}**\n💎 Gems: **${totalGems.toLocaleString()}**` +
                    (drops.length ? `\n\n**Extra Item Drops:**\n${drops.join('\n')}` : '') +
                    `\n\n**Time's Demander:** \`${progressBar}\` (${currentDemand}/6)` +
                    (blessingSkip
                        ? `\n\n🌟 **Time Blessing activated!** No cost taken. 1-day cooldown buff granted!`
                        : isPerfectSkip
                            ? `\n\n✨ **Perfect Skip!** You kept everything without losing any fumos or coins!`
                            : `\n\nSakuya took ${Math.round(demand * 100)}% of your rewards and ${requiredFumos} RARE+ fumo(s).`)
                )
                .setFooter({ text: `🔮 Time Blessing: [${blessingBar}] ${blessingPercent}% | ${blessingActive ? `Expires in: ${blessingTimer}` : 'Not active'}` })
                .setColor('#b0c4de');

            await channel.send({ embeds: [embed] });
            incrementDailyPray(userId);

        } catch (error) {
            console.error('[Sakuya] Error:', error);
            channel.send('❌ An error occurred during Sakuya\'s time skip.');
        }
    }

};