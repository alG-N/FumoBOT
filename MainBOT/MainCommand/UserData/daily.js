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
module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // Ignore bot messages and irrelevant commands
        if (
            message.author.bot ||
            !/^\.d(aily)?(\s|$)/i.test(message.content)
        ) return;

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

        db.get(
            `SELECT lastDailyBonus, dailyStreak, spiritTokens FROM userCoins WHERE userId = ?`,
            [message.author.id],
            async (err, row) => {
                if (err) {
                    console.error("Database error:", err.message);
                    try {
                        await message.reply("An error occurred while accessing your data. Please try again later.");
                    } catch { }
                    return;
                }

                if (!row) {
                    try {
                        const msg = await message.reply('You need to use `.starter` first to begin your journey!');
                        setTimeout(() => msg.delete().catch(() => { }), 30000);
                    } catch { }
                    return;
                }

                const now = Date.now();
                const oneDay = 24 * 60 * 60 * 1000;
                const twoDays = oneDay * 2;
                const timeSinceLastBonus = now - row.lastDailyBonus;
                const timeUntilNextBonus = oneDay - timeSinceLastBonus;

                let dailyStreak = row.dailyStreak;

                // Reset streak if more than 48 hours have passed
                if (timeSinceLastBonus > twoDays) {
                    dailyStreak = 1;
                } else if (timeSinceLastBonus >= oneDay) {
                    dailyStreak += 1;
                }

                if (timeSinceLastBonus >= oneDay) {
                    // Buffed rewards
                    const rand = Math.random();
                    let bonusCoins = 0,
                        bonusGems = 0,
                        bonusSpiritTokens = 0,
                        description = '',
                        color = '',
                        thumbnail = 'https://www.meme-arsenal.com/memes/64de2341d1ed532a646cc011ac582e1b.jpg';

                    if (rand < 0.5) {
                        bonusCoins = 1500 + 150 * dailyStreak;
                        bonusGems = 150 + 15 * dailyStreak;
                        bonusSpiritTokens = 1;
                        description = '🎁 **Daily Bonus!** 🎁\n\nA solid reward to keep your journey going! (50% chance)';
                        color = '#0099ff';
                    } else if (rand < 0.8) {
                        bonusCoins = 3000 + 300 * dailyStreak;
                        bonusGems = 300 + 30 * dailyStreak;
                        bonusSpiritTokens = 2;
                        description = '🎉 **Daily Bonus!** 🎉\n\nA generous bonus from the bot! (30% chance)';
                        color = '#33cc33';
                    } else if (rand < 0.95) {
                        bonusCoins = 7000 + 700 * dailyStreak;
                        bonusGems = 700 + 70 * dailyStreak;
                        bonusSpiritTokens = 3;
                        description = '💰 **Daily Bonus!** 💰\n\nJackpot! Your luck is shining bright today! (15% chance)';
                        color = '#ffcc00';
                    } else if (rand < 0.99) {
                        bonusCoins = 15000 + 1500 * dailyStreak;
                        bonusGems = 1500 + 150 * dailyStreak;
                        bonusSpiritTokens = 5;
                        description = '🎊 **Daily Bonus!** 🎊\n\nAn unexpected windfall! (4.9% chance)';
                        color = '#ff66ff';
                    } else {
                        bonusCoins = 200000;
                        bonusGems = 20000;
                        bonusSpiritTokens = 10;
                        description = '👑 **Daily Bonus!** 👑\n\nIncredible! You\'ve hit the ultimate jackpot! (0.1% chance)';
                        color = '#ff0000';
                    }

                    // Update spiritTokens instead of tickets
                    db.run(
                        `UPDATE userCoins SET coins = coins + ?, gems = gems + ?, lastDailyBonus = ?, dailyStreak = ?, spiritTokens = COALESCE(spiritTokens, 0) + ? WHERE userId = ?`,
                        [bonusCoins, bonusGems, now, dailyStreak, bonusSpiritTokens, message.author.id],
                        (updateErr) => {
                            if (updateErr) {
                                console.error("Failed to update daily bonus:", updateErr);
                                message.reply("Failed to update your daily bonus. Please try again later.").catch(() => { });
                                return;
                            }
                        }
                    );

                    // Streak Bar
                    const progressBar = '■'.repeat(Math.min(dailyStreak, 7)) + '□'.repeat(Math.max(0, 7 - dailyStreak));
                    const streakText = dailyStreak >= 7 ? `MAX Streak (${dailyStreak} days) 🔥` : `${dailyStreak}/7 days\nKeep going for even better rewards!`;

                    const embed = new EmbedBuilder()
                        .setTitle(`🎁 ${message.author.username}'s Daily Bonus 🎁`)
                        .setDescription(description)
                        .addFields(
                            { name: '💰 Coins', value: `${bonusCoins.toLocaleString()} coins`, inline: true },
                            { name: '💎 Gems', value: `${bonusGems.toLocaleString()} gems`, inline: true },
                            { name: '🪙 Spirit Tokens', value: `${bonusSpiritTokens} token${bonusSpiritTokens > 1 ? 's' : ''}`, inline: true },
                            { name: '🔥 Daily Streak', value: `[${progressBar}] ${streakText}`, inline: false }
                        )
                        .setColor(color)
                        .setThumbnail(thumbnail)
                        .setFooter({ text: 'Remember to claim your daily bonus every day to maximize your rewards!' })
                        .setTimestamp();

                    try {
                        const sentMsg = await message.channel.send({ embeds: [embed] });
                        setTimeout(() => sentMsg.delete().catch(() => { }), 30000);
                    } catch (err) {
                        console.error("Failed to send daily bonus embed:", err);
                    }
                } else {
                    // Calculate remaining time
                    const hours = Math.floor(timeUntilNextBonus / (60 * 60 * 1000));
                    const minutes = Math.floor((timeUntilNextBonus % (60 * 60 * 1000)) / (60 * 1000));
                    const seconds = Math.floor((timeUntilNextBonus % (60 * 1000)) / 1000);

                    const timerMessage = `You have already claimed your daily bonus today. Please wait **${hours}h ${minutes}m ${seconds}s** until you can claim it again.\n\nRemember: Tomorrow's rewards will be even better if you maintain your streak!`;

                    const embed = new EmbedBuilder()
                        .setTitle(`⏳ ${message.author.username}, you have already claimed your daily bonus! ⏳`)
                        .setDescription(timerMessage)
                        .setColor('#ff0000')
                        .setFooter({ text: 'Come back tomorrow for even better rewards!', iconURL: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/edbbe96e-e6e4-4343-981d-7eaf881a1964/dg6bym4-429fca4d-11e6-4205-a749-5da24e2bf47f.png' })
                        .setTimestamp();

                    try {
                        const sentMsg = await message.channel.send({ embeds: [embed] });
                        setTimeout(() => sentMsg.delete().catch(() => { }), 30000);
                    } catch (err) {
                        console.error("Failed to send cooldown embed:", err);
                    }
                }
            }
        );
    });
}