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

const { checkRestrictions } = require('../../../Middleware/restrictions');
const { getWeekIdentifier } = require('../../../Ultility/weekly');
const { formatNumber } = require('../../../Ultility/formatting');
const { DAILY_QUESTS, WEEKLY_QUESTS } = require('../../../Configuration/questConfig');
const QuestProgressService = require('../../../Service/UserDataService/QuestService/QuestProgressService');
const QuestClaimService = require('../../../Service/UserDataService/QuestService/QuestClaimService');
const AchievementService = require('../../../Service/UserDataService/QuestService/AchievementService');

function getCurrentDate() {
    return new Date().toISOString().slice(0, 10);
}

function getTimeUntilDailyReset() {
    const now = new Date();
    const nextReset = new Date();
    nextReset.setUTCHours(24, 0, 0, 0);
    const diffMs = nextReset - now;
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
}

function getTimeUntilWeeklyReset() {
    const now = new Date();
    const day = now.getUTCDay();
    const daysUntilMonday = (8 - day) % 7 || 7;
    const nextReset = new Date(now);
    nextReset.setUTCDate(now.getUTCDate() + daysUntilMonday);
    nextReset.setUTCHours(0, 0, 0, 0);
    const diffMs = nextReset - now;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${days}d ${hours}h ${minutes}m`;
}

async function showDailyQuests(interaction, userId, currentDate) {
    try {
        const progress = await QuestProgressService.getDailyProgress(userId, currentDate);
        
        const progressMap = {};
        
        if (Array.isArray(progress)) {
            progress.forEach(row => {
                progressMap[row.questId] = {
                    progress: row.progress,
                    completed: row.completed === 1
                };
            });
        } else if (typeof progress === 'object' && progress !== null) {
            Object.assign(progressMap, progress);
        }

        const fields = DAILY_QUESTS.map(q => {
            const val = progressMap[q.id] || { progress: 0, completed: false };
            const status = val.completed ? "✅" : "";
            return `${q.icon} ${q.desc}: ${formatNumber(val.progress)} / ${formatNumber(q.goal)} ${status}`;
        }).join("\n");

        const completedCount = DAILY_QUESTS.filter(q => progressMap[q.id]?.completed).length;

        const embed = new EmbedBuilder()
            .setColor("#FFD700")
            .setTitle("🗓️ Daily Quests")
            .setDescription(`${fields}\n\n**Completed:** ${completedCount} / ${DAILY_QUESTS.length}\n🕒 ${getTimeUntilDailyReset()}`)
            .setFooter({ text: "Complete them all to earn your reward!" });

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.update({ embeds: [embed] });
        }
    } catch (error) {
        console.error('[Quest] Error showing daily quests:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "❌ Error loading daily quests.", ephemeral: true }).catch(() => {});
        } else {
            await interaction.followUp({ content: "❌ Error loading daily quests.", ephemeral: true }).catch(() => {});
        }
    }
}

async function showWeeklyQuests(interaction, userId, currentWeek) {
    try {
        const progress = await QuestProgressService.getWeeklyProgress(userId, currentWeek);
        
        const progressMap = {};
        
        if (Array.isArray(progress)) {
            progress.forEach(row => {
                progressMap[row.questId] = {
                    progress: row.progress,
                    completed: row.completed === 1
                };
            });
        } else if (typeof progress === 'object' && progress !== null) {
            Object.assign(progressMap, progress);
        }

        const fields = WEEKLY_QUESTS.map(q => {
            const val = progressMap[q.id] || { progress: 0, completed: false };
            const status = val.completed ? "✅" : "";
            return `${q.icon} ${q.desc}: ${formatNumber(val.progress)} / ${formatNumber(q.goal)} ${status}`;
        }).join("\n");

        const completedCount = WEEKLY_QUESTS.filter(q => progressMap[q.id]?.completed).length;

        const embed = new EmbedBuilder()
            .setColor("#A020F0")
            .setTitle("📅 Weekly Quests")
            .setDescription(`${fields}\n\n**Completed:** ${completedCount} / ${WEEKLY_QUESTS.length}\n🕒 ${getTimeUntilWeeklyReset()}`)
            .setFooter({ text: "Weekly reset occurs every Monday." });

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.update({ embeds: [embed] });
        }
    } catch (error) {
        console.error('[Quest] Error showing weekly quests:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "❌ Error loading weekly quests.", ephemeral: true }).catch(() => {});
        } else {
            await interaction.followUp({ content: "❌ Error loading weekly quests.", ephemeral: true }).catch(() => {});
        }
    }
}

async function showAchievements(interaction, userId) {
    try {
        const achievements = [
            { id: "total_rolls", name: "🎲 Roll Mastery", unit: 100 },
            { id: "total_prays", name: "🙏 Pray Mastery", unit: 10 },
        ];

        const displayLines = [];
        const progressData = await QuestProgressService.getAchievementProgress(userId);
        
        const progressMap = {};
        if (Array.isArray(progressData)) {
            progressData.forEach(row => {
                progressMap[row.achievementId] = {
                    progress: row.progress,
                    claimed: row.claimed
                };
            });
        } else if (typeof progressData === 'object' && progressData !== null) {
            Object.assign(progressMap, progressData);
        }

        for (const ach of achievements) {
            const achProgress = progressMap[ach.id] || { progress: 0, claimed: 0 };
            const progress = achProgress.progress || 0;
            const claimed = achProgress.claimed || 0;
            const totalMilestones = Math.floor(progress / ach.unit);
            const claimable = totalMilestones > claimed ? "CLAIMABLE" : "UNAVAILABLE";

            displayLines.push(`${ach.name}\nTotal: ${formatNumber(progress)} — ${claimable}`);
        }

        const embed = new EmbedBuilder()
            .setColor("#2ECC71")
            .setTitle("🏆 Achievement Tracker")
            .setDescription(displayLines.join("\n\n"))
            .setFooter({ text: "Complete milestones to unlock bonuses!" });

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.update({ embeds: [embed] });
        }
    } catch (error) {
        console.error('[Quest] Error showing achievements:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "❌ Error loading achievements.", ephemeral: true }).catch(() => {});
        } else {
            await interaction.followUp({ content: "❌ Error loading achievements.", ephemeral: true }).catch(() => {});
        }
    }
}

async function showHelp(interaction) {
    try {
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

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.update({ embeds: [embed] });
        }
    } catch (error) {
        console.error('[Quest] Error showing help:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "❌ Error loading help.", ephemeral: true }).catch(() => {});
        } else {
            await interaction.followUp({ content: "❌ Error loading help.", ephemeral: true }).catch(() => {});
        }
    }
}

module.exports = async (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        const userId = message.author.id;
        const currentDate = getCurrentDate();
        const currentWeek = getWeekIdentifier();

        if (message.content === ".quest" || message.content === ".qu") {
            const restriction = checkRestrictions(userId);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            // OPTIMIZED: Run both deletes in parallel
            await Promise.all([
                db.run(`DELETE FROM dailyQuestProgress WHERE date != ?`, [currentDate]),
                db.run(`DELETE FROM weeklyQuestProgress WHERE week != ?`, [currentWeek])
            ]);

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

            const sent = await message.channel.send({ embeds: [questMenu], components: [row] });

            const collector = sent.createMessageComponentCollector({
                time: 60000,
                filter: (i) => i.user.id === message.author.id && i.message.id === sent.id,
            });

            collector.on("collect", async (interaction) => {
                try {
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.deferUpdate();
                    }

                    if (interaction.customId === "daily_quests") {
                        await showDailyQuests(interaction, userId, currentDate);
                    } else if (interaction.customId === "weekly_quests") {
                        await showWeeklyQuests(interaction, userId, currentWeek);
                    } else if (interaction.customId === "achievements") {
                        await showAchievements(interaction, userId);
                    } else if (interaction.customId === "quest_help") {
                        await showHelp(interaction);
                    }
                } catch (err) {
                    console.error("Error handling quest interaction:", err);
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
            const restriction = checkRestrictions(userId);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            // OPTIMIZED: Run both deletes in parallel
            await Promise.all([
                db.run(`DELETE FROM dailyQuestProgress WHERE date != ?`, [currentDate]),
                db.run(`DELETE FROM weeklyQuestProgress WHERE week != ?`, [currentWeek])
            ]);

            try {
                const result = await QuestClaimService.claimAll(userId);

                if (!result.success) {
                    const nextDaily = getTimeUntilDailyReset();
                    const nextWeekly = getTimeUntilWeeklyReset();
                    return message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("Red")
                                .setTitle("⚠️ Nothing to claim")
                                .setDescription([
                                    "You haven't completed any quests or unlocked any achievements yet.",
                                    "",
                                    `🕒 **Next daily reset:** ${nextDaily}`,
                                    `🕒 **Next weekly reset:** ${nextWeekly}`
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

                if (result.results.totalCoins > 0 || result.results.totalGems > 0) {
                    rewardEmbed.addFields({
                        name: "💰 Currency",
                        value: `**Coins:** ${formatNumber(result.results.totalCoins)}\n**Gems:** ${formatNumber(result.results.totalGems)}`,
                        inline: false
                    });
                }

                if (result.results.allItems.length > 0) {
                    const itemMap = new Map();
                    result.results.allItems.forEach(item => {
                        const name = typeof item === 'string' ? item : item.name;
                        const qty = typeof item === 'string' ? 1 : (item.quantity || 1);
                        itemMap.set(name, (itemMap.get(name) || 0) + qty);
                    });

                    const itemLines = Array.from(itemMap.entries()).map(([name, qty]) => 
                        `📦 ${name} x${qty}`
                    );

                    rewardEmbed.addFields({
                        name: "🎉 Items",
                        value: itemLines.join("\n"),
                        inline: false
                    });
                }

                message.reply({ embeds: [rewardEmbed] });
            } catch (err) {
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
};