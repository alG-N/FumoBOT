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
    // Utility: Format large numbers with suffixes
    function formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) return '0';
        if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Qa';
        if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toString();
    }

    // Descriptions for coins, gems, crates, streaks
    function getCoinDescription(coins) {
        if (coins >= 1e15) return '👑💰 You are the Emperor of Coins! 💰👑';
        if (coins >= 1e9) return '🌧️💰 Coins rain down around you! 💰🌧️';
        if (coins >= 1e6) return '🏦💰 Your coin vault is overflowing! 💰🏦';
        if (coins >= 1e3) return '🌟💰 Your coin journey has just begun! 💰🌟';
        return '💰 Every coin brings you closer to fortune! 💰';
    }
    function getGemDescription(gems) {
        if (gems >= 1e15) return '👑💎 You are the Emperor of Gems! 💎👑';
        if (gems >= 1e9) return '✨💎 Gems sparkle in your presence! 💎✨';
        if (gems >= 1e6) return '💎✨ Your gem collection is dazzling! ✨💎';
        if (gems >= 1e3) return '🌟💎 Your gem journey has just begun! 💎🌟';
        return '💎 Every gem brings you closer to sparkle! 💎';
    }
    function getCrateDescription(crates) {
        if (crates >= 1e6) return '📦🌟 You are a crate-opening legend! 📦🌟';
        if (crates >= 1e3) return '📦 You are a crate-opening enthusiast! 📦';
        return '📦 Keep opening those crates! 📦';
    }
    function getStreakDescription(streak) {
        if (streak >= 7) return '🔥 You are on a hot streak! 🔥';
        if (streak >= 5) return '👍 Keep up the good work! 👍';
        if (streak >= 3) return '😄 Nice streak, keep it going! 😄';
        return '📅 Every day counts towards your streak! 📅';
    }
    function getAchievements(row) {
        const achievements = [];
        if (row.coins >= 1e12) achievements.push('💸 Billionaire');
        if (row.gems >= 1e9) achievements.push('💎 Gem Master');
        if (row.dailyStreak >= 7) achievements.push('🔥 Weekly Warrior');
        return achievements.length > 0 ? achievements.join(', ') : 'No achievements yet!';
    }

    // New Feature: Allow checking another user's balance by mention or ID
    client.on('messageCreate', async message => {
        const content = message.content.trim();

        if (
            message.author.bot ||
            (content !== '.b' && content !== '.balance')
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

        // Parse target user (self, mention, or ID)
        let targetUser = message.author;
        const args = message.content.split(/\s+/);
        if (args.length > 1) {
            // Try mention
            const mention = message.mentions.users.first();
            if (mention) {
                targetUser = mention;
            } else if (/^\d{17,19}$/.test(args[1])) {
                // Try user ID
                try {
                    const fetched = await message.client.users.fetch(args[1]);
                    if (fetched) targetUser = fetched;
                } catch (e) {
                    // Invalid ID, fallback to self
                }
            }
        }

        db.get(`SELECT * FROM userCoins WHERE userId = ?`, [targetUser.id], async (err, row) => {
            if (err) {
                console.error(`[Balance] DB error:`, err);
                return message.reply('❌ An error occurred while fetching user data.');
            }
            if (!row) {
                if (targetUser.id === message.author.id) {
                    return message.reply('You do not have any coins or gems yet, use /starter or /daily to start off!');
                } else {
                    return message.reply(`${targetUser.username} does not have any coins or gems yet.`);
                }
            }

            // Defensive: fallback for missing/null fields
            const safe = (v, d = 0) => (typeof v === 'number' && !isNaN(v) ? v : d);

            // Build embed pages
            const embedPages = [];

            // Page 1: Value
            embedPages.push(new EmbedBuilder()
                .setTitle(`🌟 ${targetUser.username}'s Golden Fumo Profile 🌟\nYour Value:`)
                .setColor('#ffcc00')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '💰 Coins:', value: `${getCoinDescription(safe(row.coins))}\n💰 ${formatNumber(safe(row.coins))}` },
                    { name: '💎 Gems:', value: `${getGemDescription(safe(row.gems))}\n💎 ${formatNumber(safe(row.gems))}` },
                    { name: '🌸 Fumo Tokens:', value: `\n🌸 ${formatNumber(safe(row.spiritTokens))}` }
                )
                .setFooter({ text: 'Page 1/5 - use /boost to check your passive coins and gems per min!' })
            );

            // Page 2: Prayer and Stats
            embedPages.push(new EmbedBuilder()
                .setTitle(`🌟 ${targetUser.username}'s Golden Fumo Profile 🌟\nPrayer and Stats:`)
                .setColor('#ffcc00')
                .addFields(
                    { name: '🍀 Luck Stat:', value: `✨ ShinyMark+: ${safe(row.luck)}/1\n🌟 Reimu's Blessing: ${row.reimuStatus || 'None'}\n🎲 Rolls left: ${formatNumber(safe(row.rollsLeft))}` },
                    { name: '🔮 Reimu Stat:', value: `Reimu's Stack of Bad Karma: ${safe(row.reimuPenalty)}\nReimu's Pity: ${safe(row.reimuPityCount)}/15` },
                    { name: '🙏 Marisa Stat:', value: `Prayed to Marisa: ${row.prayedToMarisa ? 'Yes' : 'No'}\nMarisa's Donation: ${safe(row.marisaDonationCount)}/5` },
                    { name: '📅 Join Date:', value: row.joinDate ? `${new Date(row.joinDate).toLocaleDateString()}` : 'Unknown' },
                    { name: '🌀 Yukari Coins Earned:', value: `${formatNumber(safe(row.yukariCoins))}`, inline: true },
                    { name: '🧿 Yukari Gems Earned:', value: `${formatNumber(safe(row.yukariGems))}`, inline: true },
                    { name: '🌀 Yukari Mark:', value: `${safe(row.yukariMark)}/10`, inline: true },
                )
                .setFooter({ text: 'Page 2/5 - Based on the /pray command!' })
            );

            // Page 3: Main Stats
            embedPages.push(new EmbedBuilder()
                .setTitle(`🌟 ${targetUser.username}'s Golden Fumo Profile 🌟\nMain Stats:`)
                .setColor('#ffcc00')
                .addFields(
                    { name: '📦 Total Crates Bought:', value: `${getCrateDescription(safe(row.totalRolls))}\n📦 ${formatNumber(safe(row.totalRolls))}` },
                    { name: '🔥 Daily Streak:', value: `${getStreakDescription(safe(row.dailyStreak))}\n📅 ${safe(row.dailyStreak)} days` },
                    { name: '📈 Level:', value: `${safe(row.level)}` },
                    { name: '🔄 Rebirth:', value: `${safe(row.rebirth)}` }
                )
                .setFooter({ text: 'Page 3/5 - Golden`s FumoBOT!' })
            );

            // Page 4: Achievements
            embedPages.push(new EmbedBuilder()
                .setTitle(`🏆 ${targetUser.username}'s Achievements 🏆`)
                .setColor('#ffcc00')
                .addFields({ name: 'Achievements:', value: getAchievements(row) })
                .setFooter({ text: 'Page 4/5 - Golden`s FumoBOT!' })
            );

            // Page 5: Additional Features
            embedPages.push(new EmbedBuilder()
                .setTitle(`🌟 ${targetUser.username}'s Golden Fumo Profile 🌟\nAdditional Features:`)
                .setDescription('More features coming soon!')
                .setColor('#ffcc00')
                .setFooter({ text: 'Page 5/5 - Golden`s FumoBOT!' })
            );

            let currentPage = 0;

            // Button navigation with timeout and permission check
            const sendEmbedMessage = async () => {
                const previousButton = new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('⬅️ Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true);

                const nextButton = new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(embedPages.length === 1);

                const row = new ActionRowBuilder().addComponents(previousButton, nextButton);

                const initialMessage = await message.channel.send({ embeds: [embedPages[currentPage]], components: [row] });

                const collector = initialMessage.createMessageComponentCollector({
                    time: 60000,
                    filter: i => i.user.id === message.author.id // Only allow the command user to interact
                });

                collector.on('collect', async interaction => {
                    if (interaction.customId === 'previous') currentPage--;
                    if (interaction.customId === 'next') currentPage++;

                    previousButton.setDisabled(currentPage === 0);
                    nextButton.setDisabled(currentPage === embedPages.length - 1);

                    await interaction.update({ embeds: [embedPages[currentPage]], components: [row] });
                });

                collector.on('end', async () => {
                    // Disable buttons after timeout
                    previousButton.setDisabled(true);
                    nextButton.setDisabled(true);
                    await initialMessage.edit({ components: [row] }).catch(() => { });
                });
            };

            sendEmbedMessage().catch(e => {
                console.error(`[Balance] Failed to send embed:`, e);
                message.reply('❌ Failed to display balance.');
            });
        });
    });
};