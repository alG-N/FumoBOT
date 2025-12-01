const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../../../Core/Database/dbSetting');
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
const { maintenance, developerID } = require("../../../Configuration/maintenanceConfig");
const { isBanned } = require('../../../Administrator/BannedList/BanUtils');
const { getWeekIdentifier } = require('../../../Ultility/weekly');
module.exports = async (client) => {
    const dailyQuests = [
        { id: "roll_1000", desc: "🎲 Rolls 1000 times", goal: 1000 },
        { id: "pray_5", desc: "🙏 Pray 5 times successfully", goal: 5 },
        { id: "coins_1m", desc: "💰 Obtain 1M coins passively", goal: 1_000_000 },
        { id: "gamble_10", desc: "🎰 Use any gamble command 10 times", goal: 10 },
        { id: "craft_1", desc: "🛠️ Craft a random item", goal: 1 },
    ];

    const weeklyQuests = [
        { id: "roll_15000", desc: "🎲 Roll 15,000 times", goal: 15000 },
        { id: "pray_success_25", desc: "🙏 Successfully pray 25 times", goal: 25 },
        { id: "shiny_25", desc: "✨ Obtain 25 shiny fumos", goal: 25 },
        { id: "craft_15", desc: "🔧 Craft 15 random items", goal: 15 },
        { id: "gamble_25", desc: "🎰 Use any gamble command 25 times", goal: 25 },
        { id: "astral_plus", desc: "🌌 Get an ASTRAL+ fumo", goal: 1 },
        { id: "complete_dailies", desc: "🗓️ Complete 7 daily quests", goal: 7 },
    ];

    function getCurrentDate() {
        return new Date().toISOString().slice(0, 10);
    }

    function getQuestProgress(table, userId, quests, periodField, periodValue) {
        return new Promise((resolve, reject) => {
            if (!Array.isArray(quests) || quests.length === 0) return resolve({});

            const placeholders = quests.map(q => `'${q.id}'`).join(",");
            const query = `SELECT * FROM ${table} WHERE userId = ? AND questId IN (${placeholders}) AND ${periodField} = ?`;

            db.all(query, [userId, periodValue], (err, rows) => {
                if (err) return reject(err);
                const result = {};
                quests.forEach(q => {
                    const row = rows.find(r => r.questId === q.id);
                    result[q.id] = row || { progress: 0, completed: 0 };
                });
                resolve(result);
            });
        });
    }

    function updateUserCoins(userId, coins, gems = 0) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO userCoins (userId, coins, gems) VALUES (?, ?, ?)
             ON CONFLICT(userId) DO UPDATE SET coins = coins + ?, gems = gems + ?`,
                [userId, coins, gems, coins, gems],
                err => err ? reject(err) : resolve()
            );
        });
    }

    function addItemToInventory(userId, itemName) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, 1)
             ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                [userId, itemName],
                err => err ? reject(err) : resolve()
            );
        });
    }

    function formatNumber(num) {
        if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Qa';
        if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toString();
    }

    function getTimeUntilNextDailyReset() {
        const now = new Date();
        const nextReset = new Date();
        nextReset.setUTCHours(0, 0, 0, 0);
        nextReset.setUTCDate(now.getUTCDate() + 1); 
        const diffMs = nextReset - now;
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        return `${hours}h ${minutes}m remaining`;
    }

    function getTimeUntilNextWeeklyReset() {
        const now = new Date();
        const day = now.getUTCDay(); 
        const daysUntilMonday = (8 - day) % 7 || 7;

        const nextReset = new Date(now);
        nextReset.setUTCDate(now.getUTCDate() + daysUntilMonday);
        nextReset.setUTCHours(0, 0, 0, 0); 

        const diffMs = nextReset - now;
        const totalMinutes = Math.floor(diffMs / 60000);
        const days = Math.floor(totalMinutes / (24 * 60));
        const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
        const minutes = totalMinutes % 60;

        return `${days}d ${hours}h ${minutes}m remaining`;
    }

    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        const userId = message.author.id;
        const currentDate = getCurrentDate();
        const currentWeek = getWeekIdentifier();
        if (message.content === ".quest" || message.content === ".qu") {
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
            db.run(`DELETE FROM dailyQuestProgress WHERE date != ?`, [currentDate], err => {
                if (err) console.error("Failed to clean dailyQuestProgress:", err);
            });
            db.run(`DELETE FROM weeklyQuestProgress WHERE week != ?`, [currentWeek], err => {
                if (err) console.error("Failed to clean weeklyQuestProgress:", err);
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("daily_quests").setLabel("🗓️ Daily").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("weekly_quests").setLabel("📅 Weekly").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("achievements").setLabel("🏆 Achievements").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("quest_help").setLabel("❓ Help").setStyle(ButtonStyle.Secondary)
            );

            const questMenu = new EmbedBuilder()
                .setColor("#5DADE2")
                .setTitle("📜 Fumo Quest Board")
                .setDescription([
                    "Embark on quests and earn shiny rewards!",
                    "",
                    "**Choose your path:**",
                    "🗓️ Daily — Quick tasks for steady gains",
                    "📅 Weekly — Bigger goals, better loot",
                    "🏆 Achievements — Milestone rewards for the dedicated",
                    "",
                    "Use `.claim` to collect rewards after completion."
                ].join("\n"))
                .setFooter({ text: "Stay consistent. Reap the rewards." })
                .setTimestamp();

            let sent;
            try {
                sent = await message.channel.send({ embeds: [questMenu], components: [row] });
            } catch (err) {
                console.error("Failed to send quest menu:", err);
                return message.reply("❌ Failed to display quest board. Please try again later.");
            }

            const collector = sent.createMessageComponentCollector({
                time: 60000,
                filter: (i) => i.user.id === message.author.id && i.message.id === sent.id,
            });

            collector.on("collect", async (interaction) => {
                try {
                    await interaction.deferUpdate();

                    if (interaction.customId === "daily_quests") {
                        db.all(
                            `SELECT * FROM dailyQuestProgress WHERE userId = ? AND date = ?`,
                            [userId, currentDate],
                            (err, rows) => {
                                if (err) {
                                    console.error("Failed to fetch daily quest progress:", err);
                                    return interaction.followUp({ content: "❌ Error loading daily quests.", ephemeral: true });
                                }

                                const progressMap = {};
                                for (const row of rows) {
                                    progressMap[row.questId] = {
                                        progress: row.progress,
                                        completed: row.completed,
                                    };
                                }

                                const fields = dailyQuests.map(q => {
                                    const val = progressMap[q.id] || { progress: 0, completed: 0 };
                                    const status = val.completed ? "✅" : "";
                                    return `- ${q.desc}: ${formatNumber(val.progress)} / ${formatNumber(q.goal)} ${status}`;
                                }).join("\n");

                                const completedCount = dailyQuests.filter(q => (progressMap[q.id]?.completed)).length;

                                const embed = new EmbedBuilder()
                                    .setColor("#FFD700")
                                    .setTitle("🗓️ Daily Quests")
                                    .setDescription(fields + `\n\n**Completed:** ${completedCount} / ${dailyQuests.length}\n🕒 ${getTimeUntilNextDailyReset()}`)
                                    .setFooter({ text: "Complete them all to earn your reward!" });

                                interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => { });
                            }
                        );

                    } else if (interaction.customId === "weekly_quests") {
                        db.all(
                            `SELECT * FROM weeklyQuestProgress WHERE userId = ? AND week = ?`,
                            [userId, currentWeek],
                            (err, rows) => {
                                if (err) {
                                    console.error("Failed to fetch weekly quest progress:", err);
                                    return interaction.followUp({ content: "❌ Error loading weekly quests.", ephemeral: true });
                                }

                                const progressMap = {};
                                for (const row of rows) {
                                    progressMap[row.questId] = {
                                        progress: row.progress,
                                        completed: row.completed,
                                    };
                                }

                                const fields = weeklyQuests.map(q => {
                                    const val = progressMap[q.id] || { progress: 0, completed: 0 };
                                    const status = val.completed ? "✅" : "";
                                    return `- ${q.desc}: ${formatNumber(val.progress)} / ${formatNumber(q.goal)} ${status}`;
                                }).join("\n");

                                const completedCount = weeklyQuests.filter(q => (progressMap[q.id]?.completed)).length;

                                const embed = new EmbedBuilder()
                                    .setColor("#A020F0")
                                    .setTitle("📅 Weekly Quests")
                                    .setDescription(fields + `\n\n**Completed:** ${completedCount} / ${weeklyQuests.length}\n🕒 ${getTimeUntilNextWeeklyReset()}`)
                                    .setFooter({ text: "Weekly reset occurs every Monday." });

                                interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => { });
                            }
                        );

                    } else if (interaction.customId === "achievements") {
                        const achievements = [
                            { id: "total_rolls", name: "🎲 Roll Mastery", unit: 100 },
                            { id: "total_prays", name: "🙏 Pray Mastery", unit: 10 },
                        ];

                        const displayLines = [];

                        for (const ach of achievements) {
                            let row;
                            try {
                                row = await new Promise((resolve, reject) =>
                                    db.get(
                                        `SELECT progress, claimed FROM achievementProgress WHERE userId = ? AND achievementId = ?`,
                                        [userId, ach.id],
                                        (err, row) => err ? reject(err) : resolve(row)
                                    )
                                );
                            } catch (err) {
                                console.error("Failed to fetch achievement progress:", err);
                                displayLines.push(`${ach.name}\nError loading progress.`);
                                continue;
                            }
                            const progress = row?.progress || 0;
                            const claimed = row?.claimed || 0;
                            const totalMilestones = Math.floor(progress / ach.unit);
                            const claimable = totalMilestones > claimed ? "CLAIMABLE" : "UNAVAILABLE";

                            displayLines.push(`${ach.name}\nTotal: ${formatNumber(progress)} — ${claimable}`);
                        }

                        const embed = new EmbedBuilder()
                            .setColor("#2ECC71")
                            .setTitle("🏆 Achievement Tracker")
                            .setDescription(displayLines.join("\n\n"))
                            .setFooter({ text: "Complete milestones to unlock bonuses!" });

                        interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => { });
                    } else if (interaction.customId === "quest_help") {
                        const embed = new EmbedBuilder()
                            .setColor("#3498DB")
                            .setTitle("❓ Quest Help")
                            .setDescription([
                                "**How to progress quests?**",
                                "- Use bot commands as usual. Progress is tracked automatically.",
                                "",
                                "**How do I claim rewards?**",
                                "- Use `.claim` after completing all dailies/weeklies or reaching achievement milestones.",
                                "",
                                "**When do quests reset?**",
                                "- Dailies reset at 00:00 UTC. Weeklies reset every Monday 00:00 UTC.",
                                "",
                                "**Missed a day?**",
                                "- Progress resets, so try to complete quests before reset time.",
                                "",
                                "**Need more help?**",
                                "- Contact support or use `.help`."
                            ].join("\n"))
                            .setFooter({ text: "Stay determined, Fumo seeker!" });

                        interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => { });
                    }
                } catch (err) {
                    console.error("Error handling quest interaction:", err);
                    try {
                        await interaction.followUp({ content: "❌ Something went wrong. Please try again.", ephemeral: true });
                    } catch { }
                }
            });

            collector.on("end", () => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                );
                sent.edit({ components: [disabledRow] }).catch(() => { });
            });
        }

        if (message.content === ".claim" || message.content === ".cl") {
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
            db.run(`DELETE FROM dailyQuestProgress WHERE date != ?`, [currentDate], err => {
                if (err) console.error("Failed to clean dailyQuestProgress:", err);
            });
            db.run(`DELETE FROM weeklyQuestProgress WHERE week != ?`, [currentWeek], err => {
                if (err) console.error("Failed to clean weeklyQuestProgress:", err);
            });

            let totalCoins = 0;
            let totalGems = 0;
            let itemsClaimed = [];
            let claimedSomething = false;
            let errorOccurred = false;

            try {
                const dailyProgress = await getQuestProgress("dailyQuestProgress", userId, dailyQuests, "date", currentDate);
                const dailyCompleted = Object.values(dailyProgress).filter(q => q.completed).length;
                if (dailyCompleted === dailyQuests.length) {
                    const dailyClaimKey = `daily_${currentDate}`;
                    const alreadyClaimed = await new Promise((resolve, reject) => {
                        db.get(
                            `SELECT claimed FROM achievementProgress WHERE userId = ? AND achievementId = ?`,
                            [userId, dailyClaimKey],
                            (err, row) => err ? reject(err) : resolve(row?.claimed)
                        );
                    });
                    if (!alreadyClaimed) {
                        const dailyCoins = 25000;
                        const dailyGems = 3500;
                        const prayTickets = 5;
                        const fumoTraits = 15;
                        const bonusChance = Math.random();
                        const bonusQty = Math.floor(Math.random() * 6) + 3;

                        await updateUserCoins(userId, dailyCoins, dailyGems);
                        for (let i = 0; i < prayTickets; i++) await addItemToInventory(userId, "PrayTicket(R)");
                        for (let i = 0; i < fumoTraits; i++) await addItemToInventory(userId, "FumoTrait(R)");
                        await addItemToInventory(userId, "DailyTicket(C)");

                        if (bonusChance <= 0.15) {
                            for (let i = 0; i < bonusQty; i++) {
                                await addItemToInventory(userId, "PrayTicket(R)");
                                await addItemToInventory(userId, "FumoTrait(R)");
                            }
                            itemsClaimed.push(`🎁 Bonus: PrayTicket(R) ×${bonusQty}, FumoTrait(R) ×${bonusQty}`);
                        }

                        totalCoins += dailyCoins;
                        totalGems += dailyGems;
                        itemsClaimed.push(`PrayTicket(R) ×${prayTickets}`, `FumoTrait(R) ×${fumoTraits}`, "DailyTicket(C)");

                        db.run(
                            `INSERT INTO achievementProgress (userId, achievementId, claimed) VALUES (?, ?, 1)
                     ON CONFLICT(userId, achievementId) DO UPDATE SET claimed = 1`,
                            [userId, dailyClaimKey]
                        );

                        db.run(
                            `INSERT INTO weeklyQuestProgress (userId, week, questId, progress, completed)
                    VALUES (?, ?, 'complete_dailies', 1, 0)
                    ON CONFLICT(userId, week, questId) DO UPDATE SET 
                    progress = MIN(progress + 1, 7),
                    completed = CASE WHEN progress + 1 >= 7 THEN 1 ELSE completed END`,
                            [userId, currentWeek]
                        );
                        claimedSomething = true;
                    }
                }

                const weeklyProgress = await getQuestProgress("weeklyQuestProgress", userId, weeklyQuests, "week", currentWeek);
                const weeklyCompleted = Object.values(weeklyProgress).filter(q => q.completed).length;
                if (weeklyCompleted === weeklyQuests.length) {
                    const weeklyClaimKey = `weekly_${currentWeek}`;
                    const alreadyClaimed = await new Promise((resolve, reject) => {
                        db.get(
                            `SELECT claimed FROM achievementProgress WHERE userId = ? AND achievementId = ?`,
                            [userId, weeklyClaimKey],
                            (err, row) => err ? reject(err) : resolve(row?.claimed)
                        );
                    });
                    if (!alreadyClaimed) {
                        const weeklyCoins = 500000;
                        const weeklyGems = 100000;
                        const mysticOrb = "MysticOrb(M)";
                        const prayTickets = 35;
                        const fumoTraits = 50;

                        await updateUserCoins(userId, weeklyCoins, weeklyGems);
                        await addItemToInventory(userId, mysticOrb);
                        for (let i = 0; i < prayTickets; i++) await addItemToInventory(userId, "PrayTicket(R)");
                        for (let i = 0; i < fumoTraits; i++) await addItemToInventory(userId, "FumoTrait(R)");

                        totalCoins += weeklyCoins;
                        totalGems += weeklyGems;
                        itemsClaimed.push(
                            mysticOrb,
                            `PrayTicket(R) ×${prayTickets}`,
                            `FumoTrait(R) ×${fumoTraits}`
                        );

                        db.run(
                            `INSERT INTO achievementProgress (userId, achievementId, claimed) VALUES (?, ?, 1)
                     ON CONFLICT(userId, achievementId) DO UPDATE SET claimed = 1`,
                            [userId, weeklyClaimKey]
                        );

                        const streakRow = await new Promise((resolve, reject) =>
                            db.all(
                                `SELECT achievementId FROM achievementProgress WHERE userId = ? AND achievementId LIKE 'weekly_%' AND claimed = 1`,
                                [userId],
                                (err, rows) => err ? reject(err) : resolve(rows)
                            )
                        );
                        if (streakRow?.length >= 7) {
                            await addItemToInventory(userId, "StreakBadge(7W)");
                            itemsClaimed.push("🏅 7-Week Streak Badge");
                        }
                        claimedSomething = true;
                    }
                }

                const achievements = [
                    {
                        id: "total_rolls",
                        name: "Roll Mastery",
                        unit: 100,
                        type: "coins",
                        reward: { coins: 5000, gems: 1000 },
                    },
                    {
                        id: "total_prays",
                        name: "Pray Mastery",
                        unit: 10,
                        type: "item",
                        reward: {
                            fumoTraits: 20,
                            sfumoTraitMilestone: 50,
                        }
                    }
                ];

                for (const ach of achievements) {
                    const row = await new Promise((resolve, reject) =>
                        db.get(
                            `SELECT progress, claimed FROM achievementProgress WHERE userId = ? AND achievementId = ?`,
                            [userId, ach.id],
                            (err, row) => err ? reject(err) : resolve(row)
                        )
                    );
                    const progress = row?.progress || 0;
                    const claimed = row?.claimed || 0;

                    const totalMilestones = Math.floor(progress / ach.unit);
                    const newMilestones = totalMilestones - claimed;

                    if (newMilestones > 0) {
                        if (ach.id === "total_rolls") {
                            const coins = 5000 * newMilestones;
                            const gems = 1000 * newMilestones;
                            await updateUserCoins(userId, coins, gems);
                            totalCoins += coins;
                            totalGems += gems;

                            const extraTickets = Math.floor(progress / 500) - Math.floor(claimed * ach.unit / 500);
                            const extraTokens = Math.floor(progress / 1000) - Math.floor(claimed * ach.unit / 1000);
                            for (let i = 0; i < extraTickets; i++) await addItemToInventory(userId, "PrayTicket(R)");
                            for (let i = 0; i < extraTokens; i++) await addItemToInventory(userId, "FumoChangeToken(E)");
                            if (extraTickets > 0) itemsClaimed.push(`PrayTicket(R) ×${extraTickets}`);
                            if (extraTokens > 0) itemsClaimed.push(`FumoChangeToken(E) ×${extraTokens}`);
                        } else if (ach.id === "total_prays") {
                            const fumoTraits = 20 * newMilestones;
                            const sfumoTraits = Math.floor(progress / 50) - Math.floor(claimed * ach.unit / 50);
                            for (let i = 0; i < fumoTraits; i++) await addItemToInventory(userId, "FumoTrait(R)");
                            for (let i = 0; i < sfumoTraits * 5; i++) await addItemToInventory(userId, "SFumoTrait(L)");
                            itemsClaimed.push(`FumoTrait(R) ×${fumoTraits}`);
                            if (sfumoTraits > 0) itemsClaimed.push(`SFumoTrait(L) ×${sfumoTraits * 5}`);
                        }

                        db.run(
                            `UPDATE achievementProgress SET claimed = ? WHERE userId = ? AND achievementId = ?`,
                            [totalMilestones, userId, ach.id]
                        );
                        claimedSomething = true;
                    }
                }

                if (!claimedSomething) {
                    let nextDaily = getTimeUntilNextDailyReset();
                    let nextWeekly = getTimeUntilNextWeeklyReset();
                    return message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Red")
                                .setTitle("⚠️ Nothing to claim")
                                .setDescription([
                                    "You haven't completed any quests or unlocked any achievements yet.",
                                    "",
                                    `🕒 **Next daily claim:** ${nextDaily}`,
                                    `🕒 **Next weekly claim:** ${nextWeekly}`
                                ].join("\n"))
                        ]
                    });
                }

                const rewardEmbed = new EmbedBuilder()
                    .setColor("#00FFAB")
                    .setTitle("🎁 Rewards Claimed!")
                    .setDescription("Here are your rewards for today.")
                    .setFooter({ text: "Keep up the good work!" })
                    .setTimestamp();

                if (totalCoins > 0 || totalGems > 0) {
                    rewardEmbed.addFields({
                        name: "💰 Currency",
                        value: `**Coins:** ${formatNumber(totalCoins)}\n**Gems:** ${formatNumber(totalGems)}`,
                        inline: false
                    });
                }

                if (itemsClaimed.length > 0) {
                    rewardEmbed.addFields({
                        name: "🎉 Items",
                        value: itemsClaimed.join("\n"),
                        inline: false
                    });
                }

                message.reply({ embeds: [rewardEmbed] });
            } catch (err) {
                errorOccurred = true;
                console.error("Error during claim process:", err);
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Red")
                            .setTitle("❌ Claim Failed")
                            .setDescription("An error occurred while processing your claim. Please try again later.")
                    ]
                });
            }
        }
    });
}