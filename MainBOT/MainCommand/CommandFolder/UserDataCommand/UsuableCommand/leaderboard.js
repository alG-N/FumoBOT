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
module.exports = (client) => {
    const rarityLevels = {
        'Common': 1, 'UNCOMMON': 2, 'RARE': 3, 'EPIC': 4, 'OTHERWORLDLY': 5,
        'LEGENDARY': 6, 'MYTHICAL': 7, 'EXCLUSIVE': 8, '???': 9, 'ASTRAL': 10,
        'CELESTIAL': 11, 'INFINITE': 12, 'ETERNAL': 13, 'TRANSCENDENT': 14
    };

    const getRarity = (fumoName) => {
        if (!fumoName) return 'Common';
        return Object.keys(rarityLevels).find(r => fumoName.includes(r)) || 'Common';
    };

    const formatNumber = (n) => {
        if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
        if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
        if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
        return n.toString();
    };

    const dbQuery = (sql) => {
        return new Promise(resolve => {
            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error(err);
                    return resolve([]);
                }
                resolve(rows);
            });
        });
    };

    async function formatSimpleLeaderboard(rows) {
        if (!rows.length) return '*No data available.*';
        const lines = await Promise.all(rows.map(async (row, i) => {
            const user = await client.users.fetch(row.userId).catch(() => null);
            const username = user?.username || `Unknown (${row.userId})`;
            const value = row.value || row.coins || row.gems || row.fumoCount;
            return `**${i + 1}. ${username}:** ${formatNumber(value)}`;
        }));
        return lines.join('\n');
    }

    async function formatRarityLeaderboard(rows) {
        if (!rows.length) return '*No data available.*';

        const rarityCountMap = {};
        const allRows = await new Promise(resolve => {
            db.all("SELECT userId, fumoName FROM userInventory", [], (err, data) => resolve(err ? [] : data));
        });

        for (const row of allRows) {
            const rarity = getRarity(row.fumoName);
            const user = row.userId;
            if (!rarityCountMap[user]) rarityCountMap[user] = {};
            rarityCountMap[user][rarity] = (rarityCountMap[user][rarity] || 0) + 1;
        }

        const resultLines = await Promise.all(rows.map(async (row, i) => {
            const user = await client.users.fetch(row.userId).catch(() => null);
            const username = user?.username || `Unknown (${row.userId})`;
            const topRarity = row.value;
            const count = rarityCountMap[row.userId]?.[topRarity] || 1;
            return `**${i + 1}. ${username}:** ${count}x ${topRarity}`;
        }));

        return resultLines.join('\n');
    }

    client.on('messageCreate', async message => {
        if (!message.content.startsWith('.leaderboard') && !message.content.startsWith('.le')) return;

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

        db.all("SELECT userId, fumoName FROM userInventory", [], async (err, rows) => {
            if (err) return console.error(err.message);

            const userMaxRarity = {};
            rows.forEach(row => {
                let rarity = rarityLevels[getRarity(row.fumoName)];
                userMaxRarity[row.userId] = Math.max(userMaxRarity[row.userId] || 0, rarity);
            });

            const sortedUsers = Object.keys(userMaxRarity).sort((a, b) => userMaxRarity[b] - userMaxRarity[a]);

            const [coinRows, gemRows, fumoRows] = await Promise.all([
                dbQuery("SELECT userId, coins FROM userCoins ORDER BY coins DESC LIMIT 3"),
                dbQuery("SELECT userId, gems FROM userCoins ORDER BY gems DESC LIMIT 3"),
                dbQuery("SELECT userId, COUNT(*) as fumoCount FROM userInventory GROUP BY userId ORDER BY fumoCount DESC LIMIT 3")
            ]);

            const rarityRows = sortedUsers.slice(0, 3).map(id => ({
                userId: id,
                value: Object.keys(rarityLevels).find(key => rarityLevels[key] === userMaxRarity[id])
            }));

            const leaderboardEmbed = new EmbedBuilder()
                .setTitle('🏆 Ultimate Fumo Masters Leaderboard')
                .setColor('#FFD700')
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ text: 'Updated every summon. Keep collecting!' })
                .setTimestamp();

            leaderboardEmbed.addFields(
                // Row 1
                {
                    name: '💰 Top Coins',
                    value: await formatSimpleLeaderboard(coinRows),
                    inline: true
                },
                {
                    name: '💎 Top Gems',
                    value: await formatSimpleLeaderboard(gemRows),
                    inline: true
                },
                {
                    name: '\u200B', // empty column to balance
                    value: '\u200B',
                    inline: true
                },

                // Row 2
                {
                    name: '🧸 Top Fumos',
                    value: await formatSimpleLeaderboard(fumoRows),
                    inline: true
                },
                {
                    name: '🌟 Top Rarities',
                    value: await formatRarityLeaderboard(rarityRows),
                    inline: true
                },
                {
                    name: '\u200B', // empty column to balance
                    value: '\u200B',
                    inline: true
                }
            );

            message.channel.send({ embeds: [leaderboardEmbed] });
        });
    });
};
