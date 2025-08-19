const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    InteractionType,
} = require('discord.js');
const { GraphQLClient, gql } = require('graphql-request');
const aniClient = new GraphQLClient('https://graphql.anilist.co');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// SQLite DB setup
const db = new sqlite3.Database(path.join(__dirname, 'animebot.db'));
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS favourites (
        user_id TEXT,
        anime_id INTEGER,
        anime_title TEXT,
        PRIMARY KEY(user_id, anime_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        user_id TEXT,
        anime_id INTEGER,
        notify INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, anime_id)
    )`);
});

// Helper to format watch time
function formatDuration(minutes) {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

function getRecommendation(score) {
    if (score >= 85) return "🔥 Must Watch";
    if (score >= 70) return "👍 Good";
    if (score >= 55) return "👌 Decent";
    return "😬 Skip or Unknown Information";
}

function truncate(str, max = 1000) {
    return str.length > max ? str.slice(0, max) + "..." : str;
}

const query = gql`
query ($search: String) {
  Media(search: $search, type: ANIME) {
    id
    title { romaji english native }
    coverImage { large color }
    description(asHtml: false)
    episodes
    averageScore
    popularity
    format
    season
    seasonYear
    status
    source
    genres
    duration
    startDate { year month day }
    endDate { year month day }
    rankings { rank allTime type context }
    characters(sort: [ROLE, RELEVANCE], perPage: 5) {
      edges { node { name { full } } }
    }
    relations {
      edges {
        node {
          title { romaji }
          type
          averageScore
        }
      }
    }
    studios { nodes { name } }
    trailer { id site }
    siteUrl
    nextAiringEpisode { episode airingAt timeUntilAiring }
  }
}
`;

// Get user's favourite list
function getUserFavourites(userId) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT anime_title FROM favourites WHERE user_id = ?`, [userId], (err, rows) => {
            if (err) return reject(err);
            resolve(rows.map(r => r.anime_title));
        });
    });
}

// Check if anime is favourited
function isFavourited(userId, animeId) {
    return new Promise((resolve) => {
        db.get(`SELECT 1 FROM favourites WHERE user_id = ? AND anime_id = ?`, [userId, animeId], (err, row) => {
            resolve(!!row);
        });
    });
}

// Check if notify is enabled
function isNotifyEnabled(userId, animeId) {
    return new Promise((resolve) => {
        db.get(`SELECT notify FROM notifications WHERE user_id = ? AND anime_id = ?`, [userId, animeId], (err, row) => {
            resolve(row?.notify === 1);
        });
    });
}

// Add favourite
function addFavourite(userId, animeId, animeTitle) {
    db.run(`INSERT OR IGNORE INTO favourites (user_id, anime_id, anime_title) VALUES (?, ?, ?)`, [userId, animeId, animeTitle]);
}

// Remove favourite
function removeFavourite(userId, animeId) {
    db.run(`DELETE FROM favourites WHERE user_id = ? AND anime_id = ?`, [userId, animeId]);
    db.run(`DELETE FROM notifications WHERE user_id = ? AND anime_id = ?`, [userId, animeId]);
}

// Enable notify
function enableNotify(userId, animeId) {
    db.run(`INSERT OR REPLACE INTO notifications (user_id, anime_id, notify) VALUES (?, ?, 1)`, [userId, animeId]);
}

// Disable notify
function disableNotify(userId, animeId) {
    db.run(`INSERT OR REPLACE INTO notifications (user_id, anime_id, notify) VALUES (?, ?, 0)`, [userId, animeId]);
}

// Core handler: builds embed + buttons
// Change: Enhanced button persistence, user-only interaction, detailed favourite list, notify prompt, and more features.
async function handleAnimeSearch(context, animeName, isSlash = true) {
    try {
        const data = await aniClient.request(query, { search: animeName });
        const anime = data.Media;
        if (!anime) throw new Error("Anime not found.");

        const userId = isSlash ? context.user.id : context.author.id;
        const title = anime.title.romaji || anime.title.english || anime.title.native;
        const description = anime.description?.replace(/<\/?[^>]+(>|$)/g, "").slice(0, 300) || "No description available.";
        const startDate = anime.startDate?.year
            ? `${anime.startDate.day}/${anime.startDate.month}/${anime.startDate.year}`
            : "Unknown";
        const endDate =
            anime.endDate?.year || anime.status === "RELEASING"
                ? (anime.endDate?.year ? `${anime.endDate.day}/${anime.endDate.month}/${anime.endDate.year}` : "Ongoing")
                : "Unknown";
        const totalMinutes = anime.episodes && anime.duration ? anime.episodes * anime.duration : 0;
        const humanReadableDuration = formatDuration(totalMinutes);

        let episodeStatus = "??";
        let nextEpisodeCountdown = "";
        let finalEpisodeMsg = "";

        if (anime.nextAiringEpisode) {
            const currentEp = anime.nextAiringEpisode.episode - 1;
            episodeStatus = `${currentEp} / ${anime.episodes || "??"}`;
            const now = Math.floor(Date.now() / 1000);
            const delta = anime.nextAiringEpisode.airingAt - now;
            const days = Math.floor(delta / (60 * 60 * 24));
            const hours = Math.floor((delta % (60 * 60 * 24)) / (60 * 60));
            const mins = Math.floor((delta % (60 * 60)) / 60);
            nextEpisodeCountdown = `, Ep ${anime.nextAiringEpisode.episode} in: ${days}d ${hours}h ${mins}m`;

            if (anime.nextAiringEpisode.episode === anime.episodes) {
                finalEpisodeMsg = `**Final Episode airs in ${days}d ${hours}h ${mins}m!**`;
            }
        } else if (anime.episodes) {
            episodeStatus = `${anime.episodes} / ${anime.episodes}`;
        }

        const seenTitles = new Set();
        const relatedEntries = anime.relations.edges
            .filter(rel => rel.node.type === "ANIME" || rel.node.type === "MOVIE")
            .filter(rel => {
                if (seenTitles.has(rel.node.title.romaji)) return false;
                seenTitles.add(rel.node.title.romaji);
                return true;
            })
            .map(rel => {
                const tag = rel.node.type === "ANIME" ? "[TV]" : `[${rel.node.type}]`;
                return `${tag} ${rel.node.title.romaji} - Score: ${rel.node.averageScore || "?"} - ${getRecommendation(rel.node.averageScore || 0)}`;
            })
            .join("\n") || "No other seasons or movies available.";

        const mainCharacters = anime.characters.edges
            .map((c) => c.node.name.full)
            .join(", ") || "N/A";

        const rankingObj = anime.rankings.find((r) => r.type === "RATED" && r.allTime);
        const rankings = rankingObj ? `#${rankingObj.rank}` : "#??? (No Info)";

        let trailerUrl = "None";
        if (anime.trailer?.site && anime.trailer?.id) {
            if (anime.trailer.site.toLowerCase() === "youtube") {
                trailerUrl = `[Watch Here](https://www.youtube.com/watch?v=${anime.trailer.id})`;
            } else if (anime.trailer.site.toLowerCase() === "dailymotion") {
                trailerUrl = `[Watch Here](https://www.dailymotion.com/video/${anime.trailer.id})`;
            }
        }

        // Get favourite status and notify status
        let favourited = await isFavourited(userId, anime.id);
        let notifyEnabled = await isNotifyEnabled(userId, anime.id);
        const favouriteList = await getUserFavourites(userId);

        // Buttons always reflect latest state
        function buildRow(favourited, notifyEnabled) {
            return new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`fav_${userId}`)
                        .setLabel(favourited ? 'Unfavourite' : 'Favourite')
                        .setEmoji('❤️')
                        .setStyle(favourited ? ButtonStyle.Danger : ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`notify_${userId}`)
                        .setLabel(favourited ? (notifyEnabled ? 'Stop Notifying' : 'Notify') : 'Notify')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(!favourited),
                    new ButtonBuilder()
                        .setCustomId(`favlist_${userId}`)
                        .setLabel('Favourite List')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setLabel('More Info')
                        .setStyle(ButtonStyle.Link)
                        .setURL(anime.siteUrl)
                );
        }

        let row = buildRow(favourited, notifyEnabled);

        // Embed
        const embed = new EmbedBuilder()
            .setTitle(`${title} (${anime.format || "Unknown"})`)
            .setURL(anime.siteUrl)
            .setColor(anime.coverImage.color || "#3498db")
            .setThumbnail(anime.coverImage.large)
            .setDescription(description + (anime.description?.length > 300 ? "..." : "") + (finalEpisodeMsg ? `\n${finalEpisodeMsg}` : ""))
            .addFields(
                { name: "Score", value: anime.averageScore ? `${anime.averageScore}/100` : "N/A", inline: true },
                { name: "Episodes", value: `${episodeStatus}${nextEpisodeCountdown}`, inline: true },
                { name: "Total Watch Time", value: humanReadableDuration, inline: true },
                { name: "Release Date", value: `${startDate} → ${endDate}`, inline: true },
                { name: "Type", value: anime.format || "Unknown", inline: true },
                { name: "Source", value: anime.source?.replace("_", " ") || "Unknown", inline: true },
                { name: "Status", value: anime.status || "Unknown", inline: true },
                { name: "Studio", value: anime.studios?.nodes?.[0]?.name || "Unknown", inline: true },
                { name: "Trailer", value: trailerUrl, inline: true },
                { name: "Genres", value: anime.genres.join(", ") || "None", inline: false },
                { name: "Characters", value: mainCharacters, inline: false },
                { name: "Leaderboard Rank", value: rankings, inline: true },
                { name: "Recommendation", value: anime.averageScore ? getRecommendation(anime.averageScore) : "N/A", inline: true },
                { name: "Other Seasons/Movies", value: truncate(relatedEntries), inline: false },
            )
            .setFooter({ text: "Powered by AniList" });

        let msg;
        if (isSlash) {
            msg = await context.editReply({ embeds: [embed], components: [row] });
        } else {
            msg = await context.reply({ embeds: [embed], components: [row] });
        }

        // Collector persists and always updates state for 60s
        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60 * 1000,
            filter: i => i.user.id === userId
        });

        collector.on('collect', async i => {
            // Always re-check state before updating
            favourited = await isFavourited(userId, anime.id);
            notifyEnabled = await isNotifyEnabled(userId, anime.id);
            row = buildRow(favourited, notifyEnabled);

            if (!i.customId.endsWith(`_${userId}`)) {
                await i.reply({ content: "These buttons are not for you!", ephemeral: true });
                return;
            }

            if (i.customId.startsWith('fav_')) {
                if (favourited) {
                    removeFavourite(userId, anime.id);
                    favourited = false;
                    notifyEnabled = false;
                    row = buildRow(favourited, notifyEnabled);
                    await i.update({ content: 'Removed from favourites.', embeds: [embed], components: [row] });
                } else {
                    addFavourite(userId, anime.id, title);
                    favourited = true;
                    row = buildRow(favourited, notifyEnabled);
                    await i.update({ content: 'Added to favourites.', embeds: [embed], components: [row] });
                    const notifyRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`notify_yes_${userId}_${anime.id}`)
                            .setLabel('Yes, notify me!')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`notify_no_${userId}_${anime.id}`)
                            .setLabel('No, thanks')
                            .setStyle(ButtonStyle.Secondary)
                    );
                    await i.followUp({
                        content: 'Would you like to be notified when new episodes release?',
                        components: [notifyRow],
                        ephemeral: true
                    });
                }
            } else if (i.customId.startsWith('notify_') && !i.customId.startsWith('notify_yes_') && !i.customId.startsWith('notify_no_')) {
                if (!favourited) {
                    await i.reply({ content: 'You need to favourite first!', ephemeral: true });
                } else if (notifyEnabled) {
                    disableNotify(userId, anime.id);
                    notifyEnabled = false;
                    row = buildRow(favourited, notifyEnabled);
                    await i.update({ content: 'Stopped notifications.', embeds: [embed], components: [row] });
                } else {
                    enableNotify(userId, anime.id);
                    notifyEnabled = true;
                    row = buildRow(favourited, notifyEnabled);
                    await i.update({ content: 'Notifications enabled.', embeds: [embed], components: [row] });
                }
            } else if (i.customId.startsWith('favlist_')) {
                const favs = await getUserFavourites(userId);
                if (!favs.length) {
                    await i.reply({ content: 'No favourites yet.', ephemeral: true });
                } else {
                    const favDetails = [];
                    for (let favTitle of favs.slice(0, 10)) {
                        try {
                            const favData = await aniClient.request(query, { search: favTitle });
                            const favAnime = favData.Media;
                            favDetails.push({
                                name: favAnime.title.romaji || favAnime.title.english || favAnime.title.native,
                                value: `Score: ${favAnime.averageScore || "?"} | Episodes: ${favAnime.episodes || "?"} | [AniList](${favAnime.siteUrl})`
                            });
                        } catch {
                            favDetails.push({ name: favTitle, value: "Details unavailable." });
                        }
                    }
                    const favEmbed = new EmbedBuilder()
                        .setTitle(`${i.user.username}'s Favourite Anime`)
                        .setColor("#e67e22")
                        .addFields(favDetails)
                        .setFooter({ text: favs.length > 10 ? `Showing 10 of ${favs.length}` : `Total: ${favs.length}` });
                    await i.reply({ embeds: [favEmbed], ephemeral: true });
                }
            } else if (i.customId.startsWith('notify_yes_')) { // Fix: the Notification Allowed sending interaction failed, and when User Unfavourites, the notify should be set off
                const parts = i.customId.split('_');
                const animeId = parseInt(parts[3], 10) || anime.id;
                enableNotify(userId, animeId);
                notifyEnabled = true;
                row = buildRow(favourited, notifyEnabled);
                await i.update({ content: 'Notifications enabled for this anime!', components: [] });
                if (msg.editable) {
                    await msg.edit({ embeds: [embed], components: [row] });
                }
            } else if (i.customId.startsWith('notify_no_')) {
                await i.update({ content: 'No notifications will be sent.', components: [] });
            }
        });

        collector.on('end', async () => {
            // Optionally disable buttons after timeout
            // for (const btn of row.components) btn.setDisabled(true);
            // if (msg.editable) await msg.edit({ embeds: [embed], components: [row] });
        });

    } catch (err) {
        console.error(`[AniList] Error fetching "${animeName}":`, err);
        if (isSlash) {
            await context.editReply({ content: `❌ Could not find anime: **${animeName}**.` });
        } else {
            await context.reply({ content: `❌ Could not find anime: **${animeName}**.` });
        }
    }
}

// Notification job (call this periodically, e.g. with setInterval in your bot main file)
async function notifyUsers(client, db) {
    db.all(`SELECT user_id, anime_id FROM notifications WHERE notify = 1`, async (err, rows) => {
        if (err) {
            console.error("[DB] Failed to fetch notifications:", err);
            return;
        }
        if (!rows.length) return;

        for (const row of rows) {
            try {
                const data = await aniClient.request(gql`
                    query ($id: Int) {
                        Media(id: $id, type: ANIME) {
                            title { romaji }
                            nextAiringEpisode { episode airingAt timeUntilAiring }
                            episodes
                        }
                    }
                `, { id: row.anime_id });

                const anime = data.Media;
                if (!anime || !anime.nextAiringEpisode) continue;

                const now = Math.floor(Date.now() / 1000);
                const delta = anime.nextAiringEpisode.airingAt - now;

                let message = null;

                if (delta < 3600 && delta > 0) {
                    // Less than 1 hour before next episode
                    message = `⏰ A new episode of **${anime.title.romaji}** (Ep ${anime.nextAiringEpisode.episode}) airs in less than 1 hour!`;
                } else if (anime.nextAiringEpisode.episode === anime.episodes && delta > 0 && delta < 86400) {
                    // Final episode soon (< 24 hours)
                    message = `🔥 The **final episode** of **${anime.title.romaji}** (Ep ${anime.nextAiringEpisode.episode}) airs within 24 hours!`;
                } else if (delta < 0) {
                    // Delayed
                    message = `⚠️ Episode **${anime.nextAiringEpisode.episode}** of **${anime.title.romaji}** seems delayed.`;
                }

                if (message) {
                    try {
                        const user = await client.users.fetch(row.user_id);
                        await user.send(message);
                        console.log(`[Notify] Sent DM to ${user.tag}: ${message}`);
                    } catch (dmErr) {
                        console.warn(`[Notify] Failed to DM user ${row.user_id}. Maybe they have DMs disabled.`);
                    }
                }

            } catch (e) {
                console.error("[AniList] Error checking notifications:", e);
            }
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anime')
        .setDescription('Search for an anime')
        .addStringOption(opt =>
            opt.setName('name').setDescription('Anime name').setRequired(true)
        ),

    async execute(interaction) {
        const animeName = interaction.options.getString('name');
        await interaction.deferReply();
        await handleAnimeSearch(interaction, animeName, true);
    },

    async onMessage(message, client) {
        if (!message.content.startsWith('!anime ')) return;
        const animeName = message.content.slice(7).trim();
        if (!animeName) {
            await message.reply('Please provide an anime name.');
            return;
        }
        await handleAnimeSearch(message, animeName, false);
    },

    notifyUsers,
    handleAnimeSearch 
};
