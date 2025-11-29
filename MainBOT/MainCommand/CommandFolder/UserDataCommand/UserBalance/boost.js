const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../Core/Database/db');
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
const { maintenance, developerID } = require("../Configuration/MaintenanceConfig");
const { isBanned } = require('../Administrator/BannedList/BanUtils');
/**
 * Handles the .boost/.bst command to display a user's active boosts.
 * Improvements:
 * 1. Fixed: Only one EmbedBuilder import at top, not inside handler.
 * 2. Optimized: Use prepared statements, avoid repeated require, and structure logic for clarity.
 * 3. Improved: Naming, comments, and formatting for readability.
 * 4. Feature: Added `.boost details <type>` to show detailed info for a specific boost type.
 * 5. Error handling: Added DB error reply, and checks for unknown boost types.
 */

module.exports = (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;

        // Command parsing
        const prefixMatch = message.content.match(/^\.b(?:oost|st)(?:\s+details\s+(\w+))?/i);
        if (!prefixMatch) return;

        const detailsType = prefixMatch[1]?.toLowerCase();

        // Maintenance mode check
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

        const userId = message.author.id;
        const now = Date.now();

        // --- MysteriousDice boost (per-hour random multiplier) ---
        let mysteriousDiceMultiplier = 1;
        let mysteriousDiceLabel = null;
        try {
            const mysteriousDiceBoost = await new Promise(resolve => {
                db.get(
                    `SELECT multiplier, expiresAt, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
                    [userId],
                    (err, row) => resolve(row)
                );
            });

            if (mysteriousDiceBoost && mysteriousDiceBoost.expiresAt > now) {
                let perHourArr = [];
                try {
                    perHourArr = JSON.parse(mysteriousDiceBoost.extra || '[]');
                } catch {
                    perHourArr = [];
                }

                const currentHourTimestamp = now - (now % (60 * 60 * 1000));
                let currentHour = perHourArr.find(e => e.at === currentHourTimestamp);

                if (!currentHour) {
                    function getRandomMultiplier() {
                        return parseFloat((0.0001 + Math.random() * (10.9999)).toFixed(4));
                    }

                    const newMultiplier = getRandomMultiplier();
                    const newEntry = { at: currentHourTimestamp, multiplier: newMultiplier };

                    perHourArr.push(newEntry);
                    if (perHourArr.length > 12) perHourArr = perHourArr.slice(-12);

                    await new Promise(resolve => {
                        db.run(
                            `UPDATE activeBoosts SET multiplier = ?, extra = ? WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
                            [newMultiplier, JSON.stringify(perHourArr), userId],
                            () => resolve()
                        );
                    });

                    mysteriousDiceMultiplier = newMultiplier;
                } else {
                    mysteriousDiceMultiplier = currentHour.multiplier;
                }

                // Prepare label for display
                const expiresIn = mysteriousDiceBoost.expiresAt - now;
                const formatTime = (ms) => {
                    if (!ms || ms === Infinity) return "∞ - Permanent";
                    const totalSec = Math.floor(ms / 1000);
                    const days = Math.floor(totalSec / 86400);
                    const hours = Math.floor((totalSec % 86400) / 3600);
                    const minutes = Math.floor((totalSec % 3600) / 60);
                    const seconds = totalSec % 60;
                    let timeString = "";
                    if (days) timeString += `${days}d `;
                    if (hours) timeString += `${hours}h `;
                    if (minutes) timeString += `${minutes}m `;
                    if (!days && !hours && seconds) timeString += `${seconds}s`;
                    return timeString.trim();
                };
                mysteriousDiceLabel = `• x${mysteriousDiceMultiplier} Luck Boost (MysteriousDice, this hour) (${formatTime(expiresIn)})`;
            }
        } catch (e) {
            mysteriousDiceMultiplier = 1;
            mysteriousDiceLabel = null;
        }
        // ---------------------------------------------------------

        // --- TimeClock(L) boost (summon cooldown reduction) ---
        let timeClockCooldownLabel = null;
        try {
            const timeClockBoost = await new Promise(resolve => {
                db.get(
                    `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock'`,
                    [userId],
                    (err, row) => resolve(row)
                );
            });

            if (timeClockBoost && timeClockBoost.expiresAt > now) {
                // Summon speed x2 means cooldown is halved (50% reduction)
                const expiresIn = timeClockBoost.expiresAt - now;
                const formatTime = (ms) => {
                    if (!ms || ms === Infinity) return "∞ - Permanent";
                    const totalSec = Math.floor(ms / 1000);
                    const days = Math.floor(totalSec / 86400);
                    const hours = Math.floor((totalSec % 86400) / 3600);
                    const minutes = Math.floor((totalSec % 3600) / 60);
                    const seconds = totalSec % 60;
                    let timeString = "";
                    if (days) timeString += `${days}d `;
                    if (hours) timeString += `${hours}h `;
                    if (minutes) timeString += `${minutes}m `;
                    if (!days && !hours && seconds) timeString += `${seconds}s`;
                    return timeString.trim();
                };
                timeClockCooldownLabel = `• -50% Summon Cooldown from **TimeClock(L)** (${formatTime(expiresIn)})`;
            }
        } catch (e) {
            timeClockCooldownLabel = null;
        }
        // -------------------------------------------------------

        // Query boosts for the user
        db.all(
            `SELECT type, source, multiplier, expiresAt, uses
             FROM activeBoosts
             WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, now],
            (err, rows) => {
                if (err) {
                    console.error(err);
                    return message.reply("❌ An error occurred while fetching your boosts. Please try again later.").catch(() => { });
                }

                if (!rows || rows.length === 0) {
                    // If MysteriousDice or TimeClock(L) is active, show it even if no other boosts
                    if (mysteriousDiceLabel || timeClockCooldownLabel) {
                        const embed = new EmbedBuilder()
                            .setTitle("🚀 Active Boosts")
                            .setColor("#FFD700")
                            .setDescription(
                                [mysteriousDiceLabel, timeClockCooldownLabel].filter(Boolean).join("\n")
                            )
                            .setFooter({ text: "Boosts apply automatically when farming! Use `.boost details <type>` for more info." })
                            .setTimestamp();
                        return message.reply({ embeds: [embed] }).catch(() => { });
                    }
                    return message.reply("🛑 You have no active boosts at the moment.").catch(() => { });
                }

                // Group boosts by type
                const boostsByType = {
                    coin: [],
                    gem: [],
                    luck: [],
                    debuff: [],
                    cooldown: []
                };

                // For total calculations
                const totalBoosts = {
                    coin: 1,
                    gem: 1,
                    luckEvery10: 1,
                };

                // Helper to format time
                const formatTime = (ms) => {
                    if (!ms || ms === Infinity) return "∞ - Permanent";
                    const totalSec = Math.floor(ms / 1000);
                    const days = Math.floor(totalSec / 86400);
                    const hours = Math.floor((totalSec % 86400) / 3600);
                    const minutes = Math.floor((totalSec % 3600) / 60);
                    const seconds = totalSec % 60;
                    let timeString = "";
                    if (days) timeString += `${days}d `;
                    if (hours) timeString += `${hours}h `;
                    if (minutes) timeString += `${minutes}m `;
                    if (!days && !hours && seconds) timeString += `${seconds}s`;
                    return timeString.trim();
                };

                // Helper to format total boost
                const formatTotalBoost = (total) => {
                    const percent = Math.round(total * 100);
                    const sign = percent >= 100 ? "+" : (percent < 100 ? "-" : "");
                    const effective = Math.abs(percent - 100);
                    return `${sign}${effective}%`;
                };

                // Process each boost
                rows.forEach(({ type, source, multiplier, expiresAt, uses }) => {
                    const timeLeft = expiresAt ? formatTime(expiresAt - now) : "∞ - Permanent";
                    if (type === "coin" || type === "gem") {
                        const boostPercent = Math.round(multiplier * 100);
                        const sign = boostPercent >= 100 ? "+" : (boostPercent < 100 ? "-" : "");
                        const effectivePercent = Math.abs(boostPercent - 100);
                        const percentLabel = `${sign}${effectivePercent}%`;
                        const label = `• ${percentLabel} from **${source}** (${timeLeft})`;
                        boostsByType[type].push(label);
                        if (type in totalBoosts) totalBoosts[type] *= multiplier;
                    } else if (type === "luck" || type === "luckEvery10") {
                        // Skip MysteriousDice here, handled above
                        if (source === "MysteriousDice") return;
                        const prefix = type === "luckEvery10" ? "every 10 rolls" : "total";
                        const label = `• x${multiplier} Luck Boost (${prefix}) from **${source}** (${timeLeft})`;
                        boostsByType.luck.push(label);
                        totalBoosts.luck = Math.max(totalBoosts.luck || 1, multiplier);
                    } else if (type === "sellPenalty") {
                        const reduction = Math.round((1 - multiplier) * 100);
                        const label = `• -${reduction}% Sell Value from **${source}** (${timeLeft})`;
                        boostsByType.debuff.push(label);
                    } else if (type === "rarityOverride") {
                        const label = `• 🎯 Equal Rarity Odds from **${source}** (${uses || 0} roll(s) left)`;
                        boostsByType.luck.push(label);
                    } else if (type === "summonCooldown") {
                        const cooldownReduction = Math.round((1 - multiplier) * 100);
                        const label = `• -${cooldownReduction}% Summon Cooldown from **${source}** (${timeLeft})`;
                        boostsByType.cooldown.push(label);
                    } else if (type === "summonSpeed" && source === "TimeClock") {
                        // Already handled above, skip here
                        return;
                    }
                });

                // Add MysteriousDice boost to luck section if active
                if (mysteriousDiceLabel) {
                    boostsByType.luck.push(mysteriousDiceLabel);
                }
                // Add TimeClock(L) cooldown boost to cooldown section if active
                if (timeClockCooldownLabel) {
                    boostsByType.cooldown.push(timeClockCooldownLabel);
                }

                // Feature: Show details for a specific boost type
                if (detailsType) {
                    const validTypes = {
                        coin: "🪙 Coin Boosts",
                        gem: "💎 Gem Boosts",
                        luck: "🍀 Luck Boosts",
                        cooldown: "⏱️ Cooldown Reductions",
                        debuff: "⚠️ Debuffs"
                    };
                    if (!validTypes[detailsType]) {
                        return message.reply(`❓ Unknown boost type: \`${detailsType}\`. Valid types: coin, gem, luck, cooldown, debuff.`).catch(() => { });
                    }
                    const embed = new EmbedBuilder()
                        .setTitle(`${validTypes[detailsType]} Details`)
                        .setColor("#00BFFF")
                        .setFooter({ text: "Use `.boost` to see all boosts." })
                        .setTimestamp();

                    if (boostsByType[detailsType].length) {
                        embed.setDescription(boostsByType[detailsType].join("\n"));
                    } else {
                        embed.setDescription("You have no active boosts of this type.");
                    }
                    return message.reply({ embeds: [embed] }).catch(() => { });
                }

                // Main embed for all boosts
                const embed = new EmbedBuilder()
                    .setTitle("🚀 Active Boosts")
                    .setColor("#FFD700")
                    .setFooter({ text: "Boosts apply automatically when farming! Use `.boost details <type>` for more info." })
                    .setTimestamp();

                if (boostsByType.coin.length) {
                    embed.addFields({
                        name: "🪙 Coin Boosts",
                        value: boostsByType.coin.join("\n"),
                    });
                }
                if (boostsByType.gem.length) {
                    embed.addFields({
                        name: "💎 Gem Boosts",
                        value: boostsByType.gem.join("\n"),
                    });
                }
                if (boostsByType.luck.length) {
                    embed.addFields({
                        name: "🍀 Luck Boosts",
                        value: boostsByType.luck.join("\n"),
                    });
                }
                if (boostsByType.cooldown.length) {
                    embed.addFields({
                        name: "⏱️ Cooldown Reductions",
                        value: boostsByType.cooldown.join("\n"),
                    });
                }
                if (boostsByType.debuff.length) {
                    embed.addFields({
                        name: "⚠️ Debuffs",
                        value: boostsByType.debuff.join("\n"),
                    });
                }

                message.reply({ embeds: [embed] }).catch(() => { });
            }
        );
    });
};

