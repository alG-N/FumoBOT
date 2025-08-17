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
function formatNumber(number) {
    return number.toLocaleString();
}
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
const { getWeekIdentifier, incrementWeeklyShiny, incrementWeeklyAstral } = require('../utils/weekly'); // adjust path
module.exports = async (client, fumos) => {
    const activePrayers = new Set(); // userId who are making a decision
    const usageTracker = new Map(); // userId -> array of timestamps
    const cooldown = new Map();
    function formatNumber(num) {
        if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Qa';
        if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toString();
    }
    client.on('messageCreate', async (message) => {
        if ((message.content !== '.pray' && !message.content.startsWith('.pray ') && message.content !== '.p' && !message.content.startsWith('.p ')) || message.author.bot) return;
        const userId = message.author.id;

        if (activePrayers.has(userId)) {
            const embed = new EmbedBuilder()
                .setTitle('🔒 Decision Pending')
                .setDescription('You already have an ongoing offer! Please accept or decline it before praying again.')
                .setColor('#ff0000');

            return message.reply({ embeds: [embed] });
        }

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

        // Check PrayTicket(R) in inventory
        db.get(`SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`, [userId, 'PrayTicket(R)'], (err, row) => {
            if (err) {
                console.error(err);
                return message.reply("❌ Database error occurred.");
            }

            if (!row || row.FumoTotal <= 0) {
                const embed = new EmbedBuilder()
                    .setTitle('📿 Missing Prayer Ticket')
                    .setDescription("You need at least **1 PrayTicket(R)** in your inventory to use this command.")
                    .setColor('#ff0000');
                return message.reply({ embeds: [embed] });
            }

            // Check usage limit
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            if (!usageTracker.has(userId)) usageTracker.set(userId, []);
            const timestamps = usageTracker.get(userId).filter(ts => now - ts < oneHour);
            usageTracker.set(userId, timestamps);

            const limit = 25;
            if (timestamps.length >= limit) {
                const nextAvailable = new Date(timestamps[0] + oneHour);
                const timeRemaining = Math.ceil((nextAvailable - now) / 1000); // in seconds
                const minutes = Math.floor(timeRemaining / 60);
                const seconds = timeRemaining % 60;

                const embed = new EmbedBuilder()
                    .setTitle('⚠️ Limit Reached')
                    .setDescription(`You've used the \`/pray\` command **${limit} times** in the past hour.\nPlease wait **${minutes}m ${seconds}s** before praying again.`)
                    .setColor('#ffcc00');
                return message.reply({ embeds: [embed] });
            }

            // Consume 1 PrayTicket(R)
            db.run(`UPDATE userInventory SET quantity = quantity - 1 WHERE userId = ? AND itemName = ?`, [userId, 'PrayTicket(R)'], async function (updateErr) {
                if (updateErr) {
                    console.error(updateErr);
                    return message.reply("❌ Failed to consume PrayTicket(R).");
                }

                // Track usage
                timestamps.push(now);
                usageTracker.set(userId, timestamps);

                const cooldownEnd = cooldown.get(message.author.id);
                if (cooldownEnd) {
                    const remainingTime = Math.ceil((cooldownEnd - Date.now()) / 60000);
                    const embed = new EmbedBuilder()
                        .setTitle('🔮 Yukari\'s Boundary: Banishment! 🔮')
                        .setDescription(`Yukari has temporarily sealed your ability to pray. Please wait ${remainingTime} minutes before attempting to use the /pray command again. Go outside and do something else`)
                        .setColor('#ff0000')
                        .setImage('https://cdn.donmai.us/original/52/2c/522c49c3fd7a0174b060b639faf6a230.jpg');
                    message.reply({ embeds: [embed] });
                    return;
                }
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
                        picture: 'https://static.wikia.nocookie.net/touhou/images/0/07/Th19Marisa.png/revision/latest?cb=20230603115038',
                        offer: 'She will ask to borrow you 15k coins, and she will return it upon the next encounter.'
                    },
                    {
                        name: 'Sakuya',
                        picture: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/8fb402e5-c8cd-4bbe-a0ef-40b744424ab5/dg03t5g-acc5dd09-b613-4086-8c02-b673c79b57d8.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcLzhmYjQwMmU1LWM4Y2QtNGJiZS1hMGVmLTQwYjc0NDQyNGFiNVwvZGcwM3Q1Zy1hY2M1ZGQwOS1iNjEzLTQwODYtOGMwMi1iNjczYzc5YjU3ZDgucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.7X-9s-58lVI9v0qNS6norvMhfO1frLPeleMVjTt7jcE',
                        offer: 'Time flies... unless I say otherwise. Instantly skip 12 hours of progress—farming and passive coins only. But, I take 10% of your earnings as tribute. The more you rely on me, the more I claim.'
                    },
                ];
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
                    const actionRow = new ActionRowBuilder()
                        .addComponents([acceptButton, rejectButton]);

                    function incrementDailyPray(userId) {
                        // Daily quest: pray_5
                        db.run(`
                            INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date)
                            VALUES (?, 'pray_5', 1, 0, DATE('now'))
                            ON CONFLICT(userId, questId, date) DO UPDATE SET 
                                progress = MIN(dailyQuestProgress.progress + 1, 5),
                                completed = CASE 
                            WHEN dailyQuestProgress.progress + 1 >= 5 THEN 1
                            ELSE dailyQuestProgress.completed
                            END
                        `, [userId], function (err) {
                            if (err) {
                                console.error(`[DailyPray] Failed to update daily quest for ${userId}:`, err.message);
                            }
                        });

                        // Weekly quest: pray_success_25
                        const weekKey = getWeekIdentifier();
                        db.run(`
                            INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
                            VALUES (?, 'pray_success_25', 1, 0, ?)
                            ON CONFLICT(userId, questId, week) DO UPDATE SET 
                                progress = MIN(weeklyQuestProgress.progress + 1, 25),
                                completed = CASE 
                            WHEN weeklyQuestProgress.progress + 1 >= 25 THEN 1
                            ELSE weeklyQuestProgress.completed
                            END
                        `, [userId, weekKey], function (err) {
                            if (err) {
                                console.error(`[DailyPray] Failed to update weekly quest for ${userId}:`, err.message);
                            }
                        });

                        // Achievement adding
                        db.run(`
                            INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
                            VALUES (?, 'total_prays', 1, 0)
                            ON CONFLICT(userId, achievementId) DO UPDATE SET 
                                progress = progress + 1
                        `, [interaction.user.id]);
                    }

                    if (interaction.customId === `accept_${character.name}`) {
                        await interaction.deferUpdate();
                        activePrayers.delete(interaction.user.id);
                        switch (character.name) {
                            case 'Yuyuko':
                                {
                                    let randomNumber = Math.floor(Math.random() * 100) + 1;
                                    db.get(`SELECT luck, rollsLeft FROM userCoins WHERE userId = ?`, [message.author.id], (err, row) => {
                                        if (err || !row) return console.error(err?.message || 'No user found');
                                        let currentLuck = row.luck || 0;
                                        let newLuck = currentLuck;
                                        let bonusRolls = 0;

                                        if (randomNumber <= 15) {
                                            // Devour outcome
                                            if (currentLuck >= 1) {
                                                bonusRolls = 2000; // x2 instead of +1000
                                            } else {
                                                newLuck = currentLuck + 0.1;
                                                if (newLuck >= 1) {
                                                    newLuck = 1;
                                                    bonusRolls = 2000;
                                                } else {
                                                    bonusRolls = 1000;
                                                }
                                            }

                                            // Cap to 10,000
                                            if (bonusRolls > 10000) bonusRolls = 10000;

                                            db.run(`
                                                UPDATE userCoins 
                                                SET coins = CASE WHEN coins - 1500000 < 0 THEN 0 ELSE coins - 1500000 END,
                                                    gems = CASE WHEN gems - 350000 < 0 THEN 0 ELSE gems - 350000 END,
                                                    rollsLeft = rollsLeft + ?,
                                                    luck = ?
                                                WHERE userId = ?`,
                                                [bonusRolls, newLuck, message.author.id],
                                                function (err) {
                                                    if (this.changes === 0) {
                                                        db.run(`UPDATE userCoins SET coins = 0, gems = 0 WHERE userId = ?`, [message.author.id], function (err) {
                                                            if (err) return console.error(err.message);
                                                            const embed = new EmbedBuilder()
                                                                .setTitle('🌸 Yuyuko\'s Feast 🌸')
                                                                .setDescription('Yuyuko devoured *everything*. Coins, gems, all gone. She leaves you with nothing but ghostly regrets.')
                                                                .setColor('#ff0000');
                                                            message.channel.send({ embeds: [embed] });
                                                            incrementDailyPray(message.author.id);
                                                        });
                                                        return;
                                                    }
                                                    if (err) return console.error(err.message);
                                                    const embed = new EmbedBuilder()
                                                        .setTitle('🍽️ Devoured! 🍽️')
                                                        .setDescription(`Yuyuko took 1.5m coins & 350k gems... but left ${bonusRolls} rolls${bonusRolls === 2000 ? ' thanks to ShinyMark+!' : ' as a ghostly favor.'}`)
                                                        .setColor('#0099ff');
                                                    message.channel.send({ embeds: [embed] });
                                                    incrementDailyPray(message.author.id);
                                                }
                                            );

                                        } else {
                                            // Normal outcome
                                            if (currentLuck >= 1) {
                                                bonusRolls = 200;
                                            } else {
                                                newLuck = currentLuck + 0.01;
                                                if (newLuck >= 1) {
                                                    newLuck = 1;
                                                    bonusRolls = 200;
                                                } else {
                                                    bonusRolls = 100;
                                                }
                                            }

                                            // Cap to 10,000
                                            if (bonusRolls > 10000) bonusRolls = 10000;

                                            db.run(`
                                                UPDATE userCoins 
                                                SET coins = coins - 150000, 
                                                    gems = gems - 30000, 
                                                    rollsLeft = rollsLeft + ?, 
                                                    luck = ?, 
                                                    luckRarity = 'LEGENDARY,MYTHIC,EXCLUSIVE,???,ASTRAL,CELESTIAL,INFINITE,ETERNAL,TRANSCENDENT' 
                                                WHERE userId = ? AND coins >= 150000 AND gems >= 30000`,
                                                [bonusRolls, newLuck, message.author.id],
                                                function (err) {
                                                    if (this.changes === 0) {
                                                        cooldown.set(message.author.id, Date.now() + 10 * 60 * 1000);
                                                        const embed = new EmbedBuilder()
                                                            .setTitle('🔮 Yukari Intervenes 🔮')
                                                            .setDescription('Too broke to feed Yuyuko. Yukari seals you away for 10 minutes.')
                                                            .setColor('#ff0000');
                                                        message.channel.send({ embeds: [embed] });
                                                        return;
                                                    }
                                                    if (err) return console.error(err.message);
                                                    const embed = new EmbedBuilder()
                                                        .setTitle('🍀 Yuyuko\'s Blessing 🍀')
                                                        .setDescription(`${bonusRolls === 200 ? 'ShinyMark+ triggered! ' : ''}150k coins & 30k gems lost... but luck shines on your next ${bonusRolls} rolls.`)
                                                        .setColor('#0099ff');
                                                    message.channel.send({ embeds: [embed] });
                                                    incrementDailyPray(message.author.id);
                                                }
                                            );
                                        }
                                    });
                                }
                                break;
                            case 'Yukari':
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
                                db.all(`SELECT id, fumoName FROM userInventory WHERE userId = ? AND fumoName LIKE '%(%)'`, [message.author.id], (err, rows) => {
                                    if (err) return console.error(err.message);

                                    // Group definitions
                                    const group1Rarities = ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE'];
                                    const group2Rarities = ['Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE'];
                                    const group3Rarities = ['ETERNAL', 'TRANSCENDENT'];

                                    // Helper to get rarity
                                    const getRarity = name => name?.split('(')[1]?.split(')')[0]?.toUpperCase() || '';

                                    // Group fumos
                                    const group1 = [];
                                    const group2 = [];
                                    const group3 = [];
                                    const shinyGroup = [];
                                    const algGroup = [];
                                    let totalCoins = 0, totalFumos = 0;

                                    for (let row of rows) {
                                        if (!row.fumoName?.includes('(')) continue;
                                        totalFumos += 1;
                                        const rarity = getRarity(row.fumoName);

                                        let price = prices[rarity] || 0;
                                        let tagMultiplier = 1;
                                        if (row.fumoName.includes('[✨SHINY]')) tagMultiplier *= 5;
                                        if (row.fumoName.includes('[🌟alG]')) tagMultiplier *= 150;

                                        // SHINY and alG groups
                                        if (row.fumoName.includes('[✨SHINY]')) shinyGroup.push({ ...row, price: price * tagMultiplier });
                                        if (row.fumoName.includes('[🌟alG]')) algGroup.push({ ...row, price: price * tagMultiplier });

                                        if (group1Rarities.includes(rarity)) group1.push({ ...row, price: price * tagMultiplier });
                                        else if (group2Rarities.includes(rarity)) group2.push({ ...row, price: price * tagMultiplier });
                                        else if (group3Rarities.includes(rarity)) group3.push({ ...row, price: price * tagMultiplier });

                                        totalCoins += price * tagMultiplier;
                                    }

                                    const markRequirements = {
                                        1: [1500, 2000],
                                        5: [1750, 2500],
                                        7: [2000, 3000],
                                        10: [3000, 5000]
                                    };

                                    db.get(`SELECT yukariMark FROM userCoins WHERE userId = ?`, [message.author.id], (err, user) => {
                                        if (err) return console.error(err.message);

                                        let mark = (user?.yukariMark || 0) + 1;
                                        if (mark > 10) mark = 1;

                                        const [minRequired, maxAllowed] = markRequirements[mark] || [1000, 1500];

                                        if (totalFumos < minRequired) {
                                            db.run(`UPDATE userCoins SET coins = coins - 50000 WHERE userId = ?`, [message.author.id], function (err) {
                                                if (err) return console.error(err.message);
                                                cooldown.set(message.author.id, Date.now() + 10 * 60 * 1000);

                                                const embed = new EmbedBuilder()
                                                    .setTitle('❌ Too Few Fumos! ❌')
                                                    .setDescription(`Mark ${mark} requires at least ${minRequired} fumos.\nYukari fines you 50k coins & seals /pray for 10 minutes.`)
                                                    .setColor('#ff0000');
                                                message.channel.send({ embeds: [embed] });
                                            });
                                            return;
                                        }

                                        const cappedFumos = Math.min(totalFumos, maxAllowed);
                                        // Select from group1, then group2, then group3, then SHINY, then alG
                                        let selected = [];
                                        let coinsSelected = 0;
                                        let needed = cappedFumos;

                                        // Helper to take from group
                                        function takeFromGroup(group) {
                                            let taken = [];
                                            for (let i = 0; i < group.length && needed > 0; i++, needed--) {
                                                taken.push(group[i]);
                                                coinsSelected += group[i].price;
                                            }
                                            return taken;
                                        }

                                        selected = selected.concat(takeFromGroup(group1));
                                        if (needed > 0) selected = selected.concat(takeFromGroup(group2));
                                        if (needed > 0) selected = selected.concat(takeFromGroup(group3));
                                        if (needed > 0) selected = selected.concat(takeFromGroup(shinyGroup));
                                        if (needed > 0) selected = selected.concat(takeFromGroup(algGroup));

                                        // If not enough, fallback to all available
                                        if (selected.length < cappedFumos) {
                                            // Should not happen, but fallback
                                            selected = [...group1, ...group2, ...group3, ...shinyGroup, ...algGroup].slice(0, cappedFumos);
                                            coinsSelected = selected.reduce((sum, f) => sum + (f.price || 0), 0);
                                        }

                                        // Determine mark bonus
                                        let rewardMultiplier = 1;
                                        let bonusItem = '';

                                        // Buffed mysterious shard drop rates and increased item drops for all cases
                                        switch (mark) {
                                            case 1:
                                                rewardMultiplier = 1.5;
                                                // 35% chance for MysteriousShard(M)
                                                if (Math.random() < 0.35) bonusItem = 'MysteriousShard(M)';
                                                break;
                                            case 5:
                                                rewardMultiplier = 3.5;
                                                // 50% chance for MysteriousShard(M)
                                                if (Math.random() < 0.5) bonusItem = 'MysteriousShard(M)';
                                                // 30% chance for Nullified(?), 10% for Undefined(?), 10% for Null(?), 10% for GoldenSigil(?)
                                                else {
                                                    const r5 = Math.random();
                                                    if (r5 < 0.10) bonusItem = 'GoldenSigil(?)';
                                                    else if (r5 < 0.20) bonusItem = 'Nullified(?)';
                                                    else if (r5 < 0.30) bonusItem = 'Undefined(?)';
                                                    else if (r5 < 0.40) bonusItem = 'Null(?)';
                                                }
                                                break;
                                            case 7:
                                                rewardMultiplier = 5;
                                                // 75% chance for MysteriousShard(M)
                                                if (Math.random() < 0.75) bonusItem = 'MysteriousShard(M)';
                                                // 10% for GoldenSigil(?), 7% for Nullified(?), 4% for Undefined(?), 4% for Null(?)
                                                else {
                                                    const r7 = Math.random();
                                                    if (r7 < 0.10) bonusItem = 'GoldenSigil(?)';
                                                    else if (r7 < 0.17) bonusItem = 'Nullified(?)';
                                                    else if (r7 < 0.21) bonusItem = 'Undefined(?)';
                                                    else if (r7 < 0.25) bonusItem = 'Null(?)';
                                                }
                                                break;
                                            case 10:
                                                rewardMultiplier = 25;
                                                // Guaranteed MysteriousShard(M)
                                                bonusItem = 'MysteriousShard(M)';
                                                // 5% for GoldenSigil(?), 3% for S!gil?(?), 15% for Nullified(?), 30% for Undefined(?), 30% for Null(?)
                                                const r10 = Math.random();
                                                if (r10 < 0.05) bonusItem = 'GoldenSigil(?)';
                                                else if (r10 < 0.08) bonusItem = 'S!gil?(?)';
                                                else if (r10 < 0.23) bonusItem = 'Nullified(?)';
                                                else if (r10 < 0.53) bonusItem = 'Undefined(?)';
                                                else if (r10 < 0.83) bonusItem = 'Null?(?)';
                                                break;
                                            default:
                                                // Other marks: 15% chance for MysteriousShard(M)
                                                if (Math.random() < 0.15) bonusItem = 'MysteriousShard(M)';
                                                break;
                                        }
                                        // Changes:
                                        // - All cases now have a chance to drop MysteriousShard(M) (case 1: 35%, case 5: 50%, case 7: 75%, case 10: guaranteed, others: 15%)
                                        // - Increased item drop rates for other rare items in each case

                                        if (bonusItem) {
                                            db.run(`INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, 1)
                                                ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                                                [message.author.id, bonusItem], err => {
                                                    if (err) console.error(err.message);
                                                });
                                        }

                                        coinsSelected = Math.floor(coinsSelected * rewardMultiplier);
                                        let totalGems = Math.floor(coinsSelected / 100);
                                        let bonusMessage = '';

                                        if (Math.random() < 0.005) {
                                            const embed = new EmbedBuilder()
                                                .setTitle('😈 Yukari\'s Prank 😈')
                                                .setDescription('Yukari scammed you. Everything’s gone. 💸')
                                                .setColor('#ff0000');
                                            message.channel.send({ embeds: [embed] });
                                            incrementDailyPray(message.author.id);
                                            return;
                                        }

                                        if (Math.random() < 0.20) {
                                            coinsSelected = Math.floor(coinsSelected * 1.15);
                                            totalGems = Math.floor(totalGems * 1.5);
                                            bonusMessage += '\n🎉 Bonus! 15% extra coins & x1.5 gems!';
                                        }

                                        if (Math.random() < 0.07) {
                                            db.run(`UPDATE userCoins SET spiritTokens = COALESCE(spiritTokens, 0) + 1 WHERE userId = ?`, [message.author.id]);
                                            bonusMessage += '\n🌸 You got a rare Fumo Token!';
                                        }

                                        // Delete selected fumos
                                        function deleteNext(i) {
                                            if (i >= selected.length) {
                                                const nextMark = mark === 10 ? 1 : mark + 1;
                                                const [nextMin, nextMax] = markRequirements[nextMark] || [1000, 1500];

                                                const embed = new EmbedBuilder()
                                                    .setTitle('🌌 Yukari\'s Exchange 🌌')
                                                    .setDescription(`Fumos traded, you have earned:\n💰 +${formatNumber(coinsSelected)} coins\n💎 +${formatNumber(totalGems)} gems${bonusMessage}${bonusItem ? `\n🎁 You also got **${bonusItem}** from her as well!` : ''}`)
                                                    .addFields(
                                                        { name: '🌌 Yukari’s Mark', value: `${mark}/10`, inline: true },
                                                        { name: '⚠️ Next Mark Requirement', value: `Requires **${nextMin}–${nextMax}** Fumos`, inline: true }
                                                    )
                                                    .setColor('#0099ff')
                                                    .setFooter({ text: `Priority: Group1(??? to INFINITE) → Group2(Common to EXCLUSIVE) → Group3(ETERNAL to TRANSCENDENT) → SHINY → alG` });
                                                message.channel.send({ embeds: [embed] });
                                                incrementDailyPray(message.author.id);
                                                return;
                                            }
                                            db.run(`DELETE FROM userInventory WHERE id = ?`, [selected[i].id], err => {
                                                if (err) console.error(err.message);
                                                deleteNext(i + 1);
                                            });
                                        }
                                        // Update coins/gems/mark before deletion
                                        db.run(
                                            `UPDATE userCoins SET coins = coins + ?, gems = gems + ?, yukariCoins = yukariCoins + ?, yukariGems = yukariGems + ?, yukariMark = ? WHERE userId = ?`,
                                            [coinsSelected, totalGems, coinsSelected, totalGems, mark, message.author.id],
                                            function (err) {
                                                if (err) return console.error(err.message);
                                                deleteNext(0);
                                            }
                                        );
                                    });
                                });
                                break;
                            case 'Reimu':
                                // --- ENHANCED REIMU LOGIC ---
                                db.get(`SELECT reimuStatus, reimuPityCount, reimuUsageCount, reimuLastReset FROM userCoins WHERE userId = ?`, [message.author.id], (err, row) => {
                                    if (err) {
                                        console.error("Database query error:", err.message);
                                        return;
                                    }
                                    if (!row) return;

                                    const now = Date.now();
                                    const twelveHours = 12 * 60 * 60 * 1000;

                                    // Reset usage if 12 hours passed
                                    if (!row.reimuLastReset || now - row.reimuLastReset > twelveHours) {
                                        row.reimuUsageCount = 0;
                                        db.run(`UPDATE userCoins SET reimuUsageCount = 0, reimuLastReset = ? WHERE userId = ?`, [now, message.author.id]);
                                    }

                                    // Block if usageCount >= 3
                                    if (row.reimuUsageCount >= 3) {
                                        const embed = new EmbedBuilder()
                                            .setTitle("⏳ Prayer Cooldown")
                                            .setDescription("You have prayed to Reimu too many times today. Come back later.")
                                            .setColor(0xff5555);
                                        message.reply({ embeds: [embed] });
                                        return;
                                    }

                                    if (row.reimuStatus === 1) {
                                        // --- RARITY PROBABILITIES (lowered rare rates) ---
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
                                            // Pity only boosts ultra-rares, capped at 15
                                            if (pityCount >= 15) return probabilities;
                                            const boostFactor = Math.pow(1.08, pityCount); // x1.08 per step
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
                                            return entries[0][0]; // fallback
                                        }

                                        let pickedRarity;
                                        if (row.reimuPityCount >= 14) {
                                            // Pity: guarantee ultra-rare
                                            const pityRarities = ["???", "ASTRAL", "CELESTIAL", "INFINITE", "ETERNAL", "TRANSCENDENT"];
                                            pickedRarity = pityRarities[Math.floor(Math.random() * pityRarities.length)];
                                        } else {
                                            const adjustedProbabilities = applyPityBoost(baseProbabilities, row.reimuPityCount);
                                            pickedRarity = pickRarity(adjustedProbabilities);
                                        }

                                        const filteredFumos = fumos.filter(fumo => fumo.rarity === pickedRarity);
                                        if (filteredFumos.length === 0) {
                                            message.reply('No fumos available for that rarity!');
                                            return;
                                        }

                                        const fumo = filteredFumos[Math.floor(Math.random() * filteredFumos.length)];
                                        const isAlterGolden = Math.random() < 0.008;
                                        const isShiny = !isAlterGolden && Math.random() < 0.18;

                                        let fumoName = fumo.name;
                                        if (isAlterGolden) {
                                            fumoName += '[🌟alG]';
                                            incrementWeeklyShiny(interaction.user.id);
                                        } else if (isShiny) {
                                            fumoName += '[✨SHINY]';
                                            incrementWeeklyShiny(interaction.user.id);
                                        }

                                        const astralPlusRarities = ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
                                        if (astralPlusRarities.includes(fumo.rarity)) {
                                            incrementWeeklyAstral(interaction.user.id);
                                        }

                                        db.run(`INSERT INTO userInventory (userId, items, fumoName) VALUES (?, ?, ?)`, [message.author.id, fumo.rarity, fumoName], function (err) {
                                            if (err) {
                                                console.error(err.message);
                                                return;
                                            }

                                            let variantNote = isAlterGolden
                                                ? " It's a **divine, golden anomaly**—a truly miraculous find!"
                                                : isShiny
                                                    ? " It sparkles with a magical glow—**a Shiny Fumo!**"
                                                    : "";

                                            const description = `She gives you a **${fumo.rarity}** Fumo: **${fumoName}**.${variantNote} Cherish this rare companion!`;

                                            let embed = new EmbedBuilder()
                                                .setTitle(`🎁 A Gift from Reimu! 🎁`)
                                                .setImage(fumo.picture)
                                                .setDescription(description)
                                                .setColor('#0099ff');
                                            message.channel.send({ embeds: [embed] });
                                            incrementDailyPray(message.author.id);

                                            // Token drop (slightly boosted)
                                            let tokensEarned = 0;
                                            const rng = Math.random();
                                            if (rng < 0.0004) tokensEarned = 25;
                                            else if (rng < 0.012) tokensEarned = 5;
                                            else if (rng < 0.06) tokensEarned = 2;
                                            else if (rng < 0.18) tokensEarned = 1;

                                            if (tokensEarned > 0) {
                                                db.run(`UPDATE userCoins SET spiritTokens = spiritTokens + ? WHERE userId = ?`, [tokensEarned, message.author.id]);
                                                const tokenMsg = new EmbedBuilder()
                                                    .setTitle(`✨ Fumo Token Blessing!`)
                                                    .setDescription(`You received **${tokensEarned} Fumo Token${tokensEarned > 1 ? 's' : ''}**!`)
                                                    .setColor('#a29bfe');
                                                message.channel.send({ embeds: [tokenMsg] });
                                            }
                                            // Pity counter
                                            const resetPity = astralPlusRarities.includes(fumo.rarity) ? 0 : row.reimuPityCount + 1;

                                            db.run(`UPDATE userCoins SET reimuStatus = 0, reimuPityCount = ?, reimuUsageCount = reimuUsageCount + 1 WHERE userId = ?`,
                                                [resetPity, message.author.id]);
                                        });
                                    } else {
                                        // --- DONATION PHASE ---
                                        db.get(`SELECT coins, reimuStatus, reimuPenalty, gems, reimuPityCount FROM userCoins WHERE userId = ?`, [message.author.id], function (err, row) {
                                            if (err) {
                                                console.error("Database query error:", err.message);
                                                return;
                                            }
                                            if (!row) return;

                                            const baseCoinCost = 60000;
                                            const baseGemCost = 5000;

                                            let pity = row.reimuPityCount || 0;
                                            let penalty = Math.abs(row.reimuPenalty) || 0;
                                            let multiplier = 1;

                                            if (pity >= 11 && pity <= 15) multiplier = 10;
                                            else if (pity >= 6 && pity <= 10) multiplier = 5;
                                            else if (pity >= 1 && pity <= 5) multiplier = 2;

                                            const requiredCoins = (baseCoinCost + penalty * 50000) * multiplier;
                                            const requiredGems = (baseGemCost + penalty * 5000) * multiplier;

                                            if (row.coins >= requiredCoins && row.gems >= requiredGems) {
                                                if (penalty >= 1) {
                                                    const embed = new EmbedBuilder()
                                                        .setTitle('🎉 Donation Received 🎉')
                                                        .setDescription(`You gave ${formatNumber(requiredCoins)} coins and ${formatNumber(requiredGems)} gems. She appreciates your generosity.`)
                                                        .setColor('#0099ff');
                                                    message.channel.send({ embeds: [embed] });
                                                }

                                                db.run(`UPDATE userCoins SET coins = coins - ?, gems = gems - ?, reimuStatus = 1, reimuPenalty = 0 WHERE userId = ?`,
                                                    [requiredCoins, requiredGems, message.author.id], function (err) {
                                                        if (err) {
                                                            console.error("Error updating donation status:", err.message);
                                                            return;
                                                        }
                                                        const embed = new EmbedBuilder()
                                                            .setTitle('🙏 Reimu\'s Gratitude 🙏')
                                                            .setDescription(
                                                                `You have earned her favor.\nNext prayer may bring something rare.\n\n` +
                                                                `You donated **${formatNumber(requiredCoins)} coins** and **${formatNumber(requiredGems)} gems**.\n` +
                                                                `Pity Multiplier Applied: x${multiplier}`
                                                            )
                                                            .setColor('#0099ff');
                                                        message.channel.send({ embeds: [embed] });
                                                    });
                                            } else {
                                                db.run(`UPDATE userCoins SET reimuPenalty = reimuPenalty + 1 WHERE userId = ?`, [message.author.id], function (err) {
                                                    if (err) {
                                                        console.error("Error increasing penalty:", err.message);
                                                        return;
                                                    }

                                                    db.get(`SELECT reimuPenalty FROM userCoins WHERE userId = ?`, [message.author.id], function (err, row2) {
                                                        if (err) {
                                                            console.error("Error fetching updated penalty:", err.message);
                                                            return;
                                                        }
                                                        const penaltyCoins = (row2.reimuPenalty || 1) * 10000;
                                                        const penaltyGems = (row2.reimuPenalty || 1) * 2000;
                                                        const embed = new EmbedBuilder()
                                                            .setTitle('😔 Reimu is Unimpressed 😔')
                                                            .setDescription(row2.reimuPenalty === 1
                                                                ? 'You failed to donate enough. She gives you a cold look.'
                                                                : `You angered her. Next time you must pay an extra ${formatNumber(penaltyCoins)} coins and ${formatNumber(penaltyGems)} gems.`)
                                                            .setColor('#ff0000');
                                                        message.channel.send({ embeds: [embed] });
                                                    });
                                                });
                                            }
                                        });
                                    }
                                });
                                break;
                            case 'Marisa':
                                const marisa = characters.find(character => character.name === 'Marisa');

                                // 15% chance Marisa is absent (increased from 10%)
                                if (Math.random() < 0.15) {
                                    const embed = new EmbedBuilder()
                                        .setTitle('🌟 Marisa\'s Absence 🌟')
                                        .setDescription('Marisa is not around right now. Try again later!')
                                        .setColor('#0099ff');
                                    message.channel.send({ embeds: [embed] });
                                    break;
                                }

                                db.get(`SELECT coins, gems, prayedToMarisa, marisaDonationCount FROM userCoins WHERE userId = ?`, [message.author.id], (err, row) => {
                                    if (err) return console.error(err.message);

                                    if (!row || row.coins < 15000) {
                                        const embed = new EmbedBuilder()
                                            .setTitle('⚠️ Not Enough Coins ⚠️')
                                            .setDescription('You need at least 15,000 coins to donate to Marisa.')
                                            .setColor('#ff0000');
                                        message.channel.send({ embeds: [embed] });
                                        return;
                                    }

                                    const currentCount = row.marisaDonationCount || 0;
                                    const isPityRound = currentCount + 1 === 5; // Every 5th donation triggers pity
                                    let updatedCoins = row.coins - 15000;
                                    const donatedBefore = row.prayedToMarisa === 1;

                                    // 3% chance Marisa steals extra (decreased from 5%)
                                    if (!isPityRound && Math.random() < 0.03) {
                                        const extraStolenCoins = Math.floor((row.coins - 15000) * 0.03); // 3% of remaining coins
                                        const stolenGems = Math.floor((row.gems || 0) * 0.005); // 0.5% of total gems

                                        const newCoinTotal = row.coins - 15000 - extraStolenCoins;

                                        db.run(`UPDATE userCoins SET coins = ?, gems = COALESCE(gems, 0) - ? WHERE userId = ?`,
                                            [newCoinTotal, stolenGems, message.author.id], (err) => {
                                                if (err) return console.error("Steal update error:", err.message);
                                            });

                                        const embed = new EmbedBuilder()
                                            .setTitle('💀 Marisa\'s Trick 💀')
                                            .setDescription(`Marisa cackled and vanished!\nShe stole your **15,000 coin donation**, an **extra ${extraStolenCoins} coins**, and **${stolenGems} gems**!`)
                                            .setColor('#8b0000');

                                        message.channel.send({ embeds: [embed] });
                                        return;
                                    }

                                    if (donatedBefore) {
                                        updatedCoins += 35000;
                                        db.run(`UPDATE userCoins SET prayedToMarisa = 0 WHERE userId = ?`, [message.author.id]);

                                        const rewardMessages = [];
                                        let embedDescription = 'You donated 15k coins. She returned with 35k coins for you!\n(Technically 20k profit, but shhh...)\n\n**Rewards:**\n';

                                        db.run(`UPDATE userCoins SET coins = ? WHERE userId = ?`, [updatedCoins, message.author.id]);

                                        // Potion Roll Logic - decreased rates
                                        const potionRoll = Math.random();
                                        const rareChance = isPityRound ? 0.35 : 0.18; // was 0.5/0.3
                                        const legendaryChance = isPityRound ? 0.08 : 0.04; // was 0.15/0.08

                                        if (potionRoll < rareChance || potionRoll >= 1 - legendaryChance) {
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
                                            db.run(`INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, 1)
                                            ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                                                [message.author.id, potion.name], err => {
                                                    if (err) return console.error("Insert potion error:", err.message);
                                                });
                                        }

                                        // Gem Reward - decreased rates
                                        if (Math.random() < (isPityRound ? 0.7 : 0.35)) { // was 0.5/1.0
                                            let gemBonus1 = Math.floor((Math.random() * 0.15 + 0.25) * 1000); // 25%–40%
                                            let gemBonus2 = Math.floor((Math.random() * 0.12 + 0.08) * (Math.random() * 9000 + 10000)); // 8%–20% of 10k–19k
                                            gemBonus2 = Math.floor(gemBonus2 / 10) * 10;

                                            const totalGems = isPityRound ? (gemBonus1 + gemBonus2) * 2 : (gemBonus1 + gemBonus2);
                                            rewardMessages.push(`💎 **${totalGems} Gems** have been gifted!`);
                                            db.run(`UPDATE userCoins SET gems = COALESCE(gems, 0) + ? WHERE userId = ?`,
                                                [totalGems, message.author.id], err => {
                                                    if (err) return console.error("Update gems error:", err.message);
                                                });
                                        }

                                        // Special Drops - decreased rates
                                        const specialRoll = Math.random();
                                        const goldenChance = isPityRound ? 0.002 : 0.0007; // was 0.004/0.0015
                                        const fragChance = isPityRound ? 0.07 : 0.03; // was 0.12/0.06
                                        const ticketChance = isPityRound ? 0.35 : 0.18; // was 0.6/0.4

                                        if (specialRoll < goldenChance) {
                                            rewardMessages.push('✨ **GoldenSigil(?)** - Ultra rare drop!');
                                            db.run(`INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, 1)
                                                ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                                                [message.author.id, 'GoldenSigil(?)']);
                                        } else if (specialRoll < fragChance) {
                                            rewardMessages.push('📜 **FragmentOf1800s(R)** - Rare drop!');
                                            db.run(`INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, 1)
                                                ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                                                [message.author.id, 'FragmentOf1800s(R)']);
                                        } else if (specialRoll < ticketChance) {
                                            rewardMessages.push('🎫 **HakureiTicket(L)** - A legendary ticket!');
                                            db.run(`INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, 1)
                                                ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                                                [message.author.id, 'HakureiTicket(L)']);
                                        }

                                        const newCount = currentCount + 1;

                                        if (isPityRound) {
                                            // Reward StarShard on pity
                                            db.run(`INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, 1)
                                                ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                                                [message.author.id, 'StarShard(M)'], err => {
                                                    if (err) return console.error(err.message);
                                                    const embed = new EmbedBuilder()
                                                        .setTitle('🌟 Loyalty Reward: StarShard! 🌟')
                                                        .setDescription('After 5 generous donations, Marisa gifts you a mysterious **StarShard(M)**.\nReward chances are also increased!')
                                                        .setColor('#00ffff');
                                                    message.channel.send({ embeds: [embed] });
                                                });

                                            db.run(`UPDATE userCoins SET marisaDonationCount = 0 WHERE userId = ?`, [message.author.id]);
                                        } else {
                                            db.run(`UPDATE userCoins SET marisaDonationCount = ? WHERE userId = ?`, [newCount, message.author.id]);
                                        }

                                        if (rewardMessages.length > 0) {
                                            embedDescription += rewardMessages.join('\n');
                                        } else {
                                            embedDescription += '(No additional rewards this time.)';
                                        }

                                        const embed = new EmbedBuilder()
                                            .setTitle('✨ Marisa\'s Blessing ✨')
                                            .setDescription(embedDescription)
                                            .setColor('#ffd700');

                                        message.channel.send({ embeds: [embed] });
                                        incrementDailyPray(message.author.id);
                                    } else {
                                        // First-time donation
                                        db.run(`UPDATE userCoins SET prayedToMarisa = 1 WHERE userId = ?`, [message.author.id]);
                                        db.run(`UPDATE userCoins SET coins = ? WHERE userId = ?`, [updatedCoins, message.author.id]);

                                        const embed = new EmbedBuilder()
                                            .setTitle('🧪 Donation Received 🧪')
                                            .setDescription('You gave Marisa 15k coins. She smiles mysteriously...')
                                            .setColor('#0099ff');
                                        message.channel.send({ embeds: [embed] });
                                    }
                                });
                                break;
                            case 'Sakuya':
                                // --- Sakuya Time Skip Logic (Enhanced, Nerfed, Bugfixes) ---
                                function getRarity(fumoName) {
                                    if (!fumoName) return 'Unknown';
                                    const rarities = ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON'];
                                    return fumoName ? (rarities.find(r => fumoName.includes(r)) || 'Common') : 'Unknown';
                                }
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
                                function addToInventory(userId, itemName, quantity = 1) {
                                    return new Promise((resolve, reject) => {
                                        db.get(`SELECT * FROM userInventory WHERE userId = ? AND itemName = ?`, [userId, itemName], (err, row) => {
                                            if (err) return reject(err);
                                            if (row) {
                                                db.run(`UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`, [quantity, userId, itemName], err => err ? reject(err) : resolve());
                                            } else {
                                                db.run(`INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)`, [userId, itemName, quantity], err => err ? reject(err) : resolve());
                                            }
                                        });
                                    });
                                }
                                const userId = message.author.id;
                                db.get(`SELECT * FROM userCoins WHERE userId = ?`, [userId], (err, user) => {
                                    if (err || !user) return message.channel.send("❌ Couldn't find your account!");

                                    db.get(`SELECT * FROM sakuyaUsage WHERE userId = ?`, [userId], async (err, usage) => {
                                        if (err) {
                                            console.error("Sakuya usage DB error:", err);
                                            return message.channel.send("❌ An error occurred while checking your Sakuya usage.");
                                        }
                                        const now = Date.now();
                                        const twelveHoursMs = 12 * 60 * 60 * 1000;
                                        const twentyFourHoursMs = 24 * 60 * 60 * 1000;

                                        let useCount = usage?.uses || 0;
                                        let timeBlessing = usage?.timeBlessing || 0;
                                        let blessingExpiry = usage?.blessingExpiry || null;
                                        let firstUseTime = usage?.firstUseTime || now;
                                        let lastUsed = usage?.lastUsed || now;

                                        // --- FIX: Reset blessing progress if expired ---
                                        if (usage && usage.blessingExpiry && now > usage.blessingExpiry) {
                                            // Blessing expired, reset progress to 0 and clear expiry
                                            timeBlessing = 0;
                                            blessingExpiry = null;
                                            await new Promise((resolve, reject) => {
                                                db.run(
                                                    `UPDATE sakuyaUsage SET timeBlessing = 0, blessingExpiry = NULL WHERE userId = ?`,
                                                    [userId],
                                                    err => err ? reject(err) : resolve()
                                                );
                                            });
                                        }

                                        // Reset logic for 12h and 24h windows
                                        if (usage) {
                                            const timeSinceFirstUse = now - firstUseTime;
                                            if (useCount >= 6 && timeSinceFirstUse >= twentyFourHoursMs) {
                                                // Reset after 24h lockout
                                                useCount = 0;
                                                timeBlessing = 0;
                                                blessingExpiry = null;
                                                firstUseTime = now;
                                                lastUsed = now;
                                                await new Promise((resolve, reject) => {
                                                    db.run(`UPDATE sakuyaUsage SET uses = 0, timeBlessing = 0, blessingExpiry = NULL, firstUseTime = ?, lastUsed = ? WHERE userId = ?`,
                                                        [now, now, userId], err => err ? reject(err) : resolve());
                                                });
                                            } else if (useCount < 6 && timeSinceFirstUse >= twelveHoursMs) {
                                                // Reset after 12h window for 1-5 bars
                                                useCount = 0;
                                                timeBlessing = 0;
                                                firstUseTime = now;
                                                lastUsed = now;
                                                await new Promise((resolve, reject) => {
                                                    db.run(`UPDATE sakuyaUsage SET uses = 0, timeBlessing = 0, firstUseTime = ?, lastUsed = ? WHERE userId = ?`,
                                                        [now, now, userId], err => err ? reject(err) : resolve());
                                                });
                                            }
                                        }

                                        // Nerf: Increase cost scaling, max cost 60% at 6th use
                                        const costMap = [0.10, 0.18, 0.28, 0.40, 0.50, 0.60];
                                        const demand = costMap[useCount] || 0.60;
                                        const requiredFumos = useCount === 0 ? 0 : (useCount === 1 ? 1 : (useCount >= 2 && useCount <= 4 ? useCount : 2));

                                        // Nerf: Only allow ASTRAL+ on 6th use, otherwise up to CELESTIAL
                                        const allowedRarities = useCount >= 5
                                            ? ['ASTRAL', 'CELESTIAL', 'INFINITE']
                                            : ['RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL'];
                                        db.all(`SELECT * FROM userInventory WHERE userId = ?`, [userId], async (err, fumos) => {
                                            if (err || !fumos) return message.channel.send("⚠️ Could not retrieve inventory.");

                                            // Nerf: Sakuya(UNCOMMON) now gives less boost
                                            const ownsSakuyaUncommon = fumos.some(f => f.fumoName === "Sakuya(UNCOMMON)");
                                            const dropChances = ownsSakuyaUncommon
                                                ? { fragment: 0.22, clock: 0.07, watch: 0.015, perfectSkip: 0.03 }
                                                : { fragment: 0.12, clock: 0.03, watch: 0.005, perfectSkip: 0.01 };

                                            const rarePlusFumos = fumos.filter(f => {
                                                const match = f.fumoName?.match(/\((.*?)\)$/);
                                                const rarity = match?.[1]?.toUpperCase();
                                                return allowedRarities.includes(rarity);
                                            });

                                            const totalAvailable = rarePlusFumos.reduce((acc, f) => acc + (f.quantity || 1), 0);
                                            const isPerfectSkip = Math.random() < dropChances.perfectSkip;
                                            const oneDayMs = 24 * 60 * 60 * 1000;

                                            let blessing = usage?.timeBlessing || 0;
                                            blessing += 10;

                                            const originalBlessing = blessing;
                                            const blessingActive = usage?.blessingExpiry && now < usage.blessingExpiry;
                                            let blessingSkip = false;

                                            if (totalAvailable < requiredFumos && !isPerfectSkip && !blessingSkip) {
                                                return message.channel.send(`⚠️ You need at least ${requiredFumos} RARE+ fumo(s) for Sakuya to skip time.`);
                                            }

                                            const farming = await new Promise((resolve, reject) => {
                                                db.all(`SELECT * FROM farmingFumos WHERE userId = ?`, [userId], (err, rows) => err ? reject(err) : resolve(rows));
                                            });

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

                                            // Apply boosts
                                            const coinBoosts = await new Promise((resolve, reject) => {
                                                db.all(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'coin' AND (expiresAt IS NULL OR expiresAt > ?)`, [userId, Date.now()], (err, rows) => err ? reject(err) : resolve(rows));
                                            });
                                            totalCoins = Math.floor(totalCoins * coinBoosts.reduce((acc, b) => acc * b.multiplier, 1));

                                            const gemBoosts = await new Promise((resolve, reject) => {
                                                db.all(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'gem' AND (expiresAt IS NULL OR expiresAt > ?)`, [userId, Date.now()], (err, rows) => err ? reject(err) : resolve(rows));
                                            });
                                            totalGems = Math.floor(totalGems * gemBoosts.reduce((acc, b) => acc * b.multiplier, 1));

                                            let hasTimeBlessing = usage?.blessingExpiry && usage.blessingExpiry > now;

                                            // Remove required fumos unless perfect skip or blessing
                                            if (!isPerfectSkip && !blessingSkip) {
                                                const expanded = [];
                                                for (const f of rarePlusFumos) {
                                                    const qty = f.quantity || 1;
                                                    for (let i = 0; i < qty; i++) expanded.push({ fumoName: f.fumoName });
                                                }
                                                const shuffled = expanded.sort(() => 0.5 - Math.random());
                                                const selected = shuffled.slice(0, requiredFumos);

                                                for (const fumo of selected) {
                                                    const rows = await new Promise((resolve, reject) => {
                                                        db.all(`SELECT * FROM userInventory WHERE userId = ? AND fumoName = ? ORDER BY quantity DESC`, [userId, fumo.fumoName], (err, rows) => err ? reject(err) : resolve(rows));
                                                    });
                                                    const targetRow = rows[0];
                                                    if (!targetRow) continue;

                                                    if (targetRow.quantity > 1) {
                                                        await new Promise((resolve, reject) => {
                                                            db.run(`UPDATE userInventory SET quantity = quantity - 1 WHERE userId = ? AND id = ?`, [userId, targetRow.id], err => err ? reject(err) : resolve());
                                                        });
                                                    } else {
                                                        await new Promise((resolve, reject) => {
                                                            db.run(`DELETE FROM userInventory WHERE userId = ? AND id = ?`, [userId, targetRow.id], err => err ? reject(err) : resolve());
                                                        });
                                                    }
                                                }
                                            }

                                            // Usage/cooldown logic
                                            if (usage) {
                                                const firstUseTime = usage.firstUseTime;
                                                const timeSinceFirstUse = now - firstUseTime;

                                                if (usage.uses < 6) {
                                                    if (timeSinceFirstUse >= twelveHoursMs) {
                                                        // Reset window
                                                        db.run(`UPDATE sakuyaUsage SET uses = 1, firstUseTime = ?, lastUsed = ?, timeBlessing = ? WHERE userId = ?`,
                                                            [now, now, blessing, userId]);
                                                    } else {
                                                        // Increment use
                                                        db.run(`UPDATE sakuyaUsage SET uses = uses + 1, lastUsed = ?, timeBlessing = ? WHERE userId = ?`,
                                                            [now, blessing, userId]);
                                                    }
                                                } else {
                                                    if (timeSinceFirstUse >= twentyFourHoursMs) {
                                                        // Reset after 24h lockout
                                                        db.run(`UPDATE sakuyaUsage SET uses = 1, firstUseTime = ?, lastUsed = ?, timeBlessing = ? WHERE userId = ?`,
                                                            [now, now, blessing, userId]);
                                                    } else {
                                                        // Still blocked
                                                        const timeLeft = twentyFourHoursMs - timeSinceFirstUse;
                                                        const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                                                        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                                                        return message.channel.send(`⛔ You've reached the maximum skips (6). Please wait **${hours}h ${minutes}m** before using it again.`);
                                                    }
                                                }
                                            } else {
                                                // First-time use
                                                db.run(`INSERT INTO sakuyaUsage (userId, uses, firstUseTime, lastUsed, timeBlessing, blessingExpiry)
                                                VALUES (?, 1, ?, ?, ?, ?)`,
                                                    [userId, now, now, blessing, null],
                                                    (err) => {
                                                        if (err) {
                                                            console.error("Sakuya insert error:", err);
                                                            return message.channel.send("❌ An error occurred while initializing your Sakuya usage.");
                                                        }
                                                    });
                                            }

                                            // Time Blessing Activation (nerf: now needs 100 points)
                                            if (blessing >= 100 && !blessingActive) {
                                                blessing = 0;
                                                const expiry = now + oneDayMs;

                                                // Set blessing expiry
                                                await new Promise((resolve, reject) => {
                                                    db.run("UPDATE sakuyaUsage SET blessingExpiry = ?, timeBlessing = 0 WHERE userId = ?", [expiry, userId], err => err ? reject(err) : resolve());
                                                });

                                                // Apply cooldown & passive boosts
                                                const blessingBoosts = [
                                                    { type: 'summonCooldown', multiplier: 0.5 },
                                                ];

                                                for (const boost of blessingBoosts) {
                                                    await new Promise((resolve, reject) => {
                                                        db.run(
                                                            `INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt) VALUES (?, ?, 'TimeBlessing', ?, ?)`,
                                                            [userId, boost.type, boost.multiplier, expiry],
                                                            err => err ? reject(err) : resolve()
                                                        );
                                                    });
                                                }

                                                blessingSkip = true; // TimeBlessing was used, so skip cooldown cost
                                            }

                                            if (blessingSkip || hasTimeBlessing) {
                                                totalCoins *= 2;
                                                totalGems *= 2;
                                            }

                                            if (!isPerfectSkip && !blessingSkip) {
                                                totalCoins = Math.floor(totalCoins * (1 - demand));
                                                totalGems = Math.floor(totalGems * (1 - demand));
                                            }

                                            // LIMIT: Max 10B coins, 1B gems
                                            const COIN_LIMIT = 10_000_000_000;
                                            const GEM_LIMIT = 1_000_000_000;
                                            if (totalCoins > COIN_LIMIT) totalCoins = COIN_LIMIT;
                                            if (totalGems > GEM_LIMIT) totalGems = GEM_LIMIT;

                                            await new Promise((resolve, reject) => {
                                                db.run(`UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?`, [totalCoins, totalGems, userId], err => err ? reject(err) : resolve());
                                            });

                                            // Nerf: Lower drop rates
                                            const drops = [];
                                            if (Math.random() < dropChances.fragment) drops.push("FragmentOfTime(E)");
                                            if (Math.random() < dropChances.clock) drops.push("TimeClock-Broken(L)");
                                            if (Math.random() < dropChances.watch) drops.push("PocketWatch(M)");

                                            for (const item of drops) {
                                                if (item) await addToInventory(userId, item, 1);
                                            }

                                            // Progress/cooldown display
                                            const currentDemand = Math.min(useCount + 1, 6);
                                            const progressBar = '█'.repeat(currentDemand) + '░'.repeat(6 - currentDemand);
                                            const cooldownDuration = blessingSkip ? 0 : (currentDemand >= 6 ? oneDayMs : oneDayMs / 2);
                                            const timeLeft = usage ? Math.max(0, cooldownDuration - (now - usage.lastUsed)) : 0;
                                            const h = Math.floor(timeLeft / 3600000), m = Math.floor((timeLeft % 3600000) / 60000), s = Math.floor((timeLeft % 60000) / 1000);
                                            const cooldownDisplay = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

                                            // Blessing progress
                                            const blessingRemaining = blessingActive ? usage.blessingExpiry - now : 0;
                                            const blessingPercent = blessingActive
                                                ? Math.floor((blessingRemaining / oneDayMs) * 100)
                                                : Math.min(Math.floor((originalBlessing / 100) * 100), 100);

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
                                                    `\n⌛ Cooldown resets in: \`${cooldownDisplay}\`` +
                                                    (blessingSkip
                                                        ? `\n\n🌟 **Time Blessing activated!** No cost taken. 1-day cooldown buff granted!`
                                                        : isPerfectSkip
                                                            ? `\n\n✨ **Perfect Skip!** You kept everything without losing any fumos or coins!`
                                                            : `\n\nSakuya took ${Math.round(demand * 100)}% of your rewards and ${requiredFumos} RARE+ fumo(s).`)
                                                )
                                                .setFooter({ text: `🔮 Time Blessing: [${blessingBar}] ${blessingPercent}% | ${blessingActive ? `Expires in: ${blessingTimer}` : 'Not active'}` })
                                                .setColor('#b0c4de');

                                            message.channel.send({ embeds: [embed] });
                                            incrementDailyPray(message.author.id);
                                        });
                                    });
                                });
                                break;
                        }

                    } else if (interaction.customId === `reject_${character.name}`) {
                        activePrayers.delete(interaction.user.id);
                        const embed = new EmbedBuilder()
                            .setTitle('🔮 Decision Made 🔮')
                            .setDescription(`You decided to decline ${character.name}'s enticing offer. Nothing happened until you pray again..`)
                            .setColor('#0099ff'); // You can change this to any color you like

                        await interaction.reply({ embeds: [embed] });
                        actionRow.components.forEach((button) => button.setDisabled(true));
                        await interaction.message.edit({ components: [actionRow] });
                    }
                });

                collector.on('end', (collected) => {
                    activePrayers.delete(userId);
                    const actionRow = new ActionRowBuilder()
                        .addComponents([acceptButton, rejectButton]);

                    if (collected.size === 0) {
                        const embed = new EmbedBuilder()
                            .setTitle('⏳ Time\'s Up! ⏳')
                            .setDescription('You didnt accept nor decline the offer, so they leave.')
                            .setColor('#ff0000'); // You can change this to any color you like

                        message.channel.send({ embeds: [embed] });
                        actionRow.components.forEach((button) => button.setDisabled(true));
                        sentMessage.edit({ components: [actionRow] });
                    }
                });
            });
        });
    });
}