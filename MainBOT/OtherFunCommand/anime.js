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
const { maintenance, developerID } = require("../Command/Maintenace/MaintenaceConfig.js");
const { isBanned } = require('../Command/Banned/BanUtils.js');
const { GraphQLClient, gql } = require('graphql-request');
const aniClient = new GraphQLClient('https://graphql.anilist.co');

const getRecommendation = (score) => {
    if (score >= 80) return "Must Watch, Absolute Cinema, Worth a try, No Regret!";
    if (score >= 65) return "Recommended, you should watch it when you have the time!";
    if (score >= 50) return "Depends, if you want to waste your time or not.";
    return "Just don't waste your time on this..";
};

function formatDuration(totalMinutes) {
    if (!totalMinutes || totalMinutes <= 0) return "Unknown";

    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const days = Math.floor(totalMinutes / 60 / 24) % 30;
    const months = Math.floor(totalMinutes / 60 / 24 / 30) % 12;
    const years = Math.floor(totalMinutes / 60 / 24 / 365);

    let parts = [];
    if (years) parts.push(`${years}y`);
    if (months) parts.push(`${months}mo`);
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);

    return parts.join(" ");
}

function truncate(str, maxLength = 1024) {
    return str.length > maxLength ? str.slice(0, maxLength - 3) + "..." : str;
}

function getNextEpisodeCountdown(startDate, duration, episodes) {
    const now = new Date();
    const start = new Date(startDate.year, startDate.month - 1, startDate.day);
    const airInterval = duration * 60 * 1000; // episode duration in ms

    const firstEpDate = start.getTime();
    const diff = now.getTime() - firstEpDate;
    const epsAired = Math.floor(diff / (1000 * 60 * duration));
    const nextEpTime = new Date(firstEpDate + (epsAired + 1) * airInterval);

    const delta = Math.max(nextEpTime.getTime() - now.getTime(), 0);

    const days = Math.floor(delta / (1000 * 60 * 60 * 24));
    const hours = Math.floor((delta % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((delta % (1000 * 60 * 60)) / (1000 * 60));

    return `Next ep in: ${days}d ${hours}h ${mins}m`;
}

function getEpisodeStatus(anime) {
    const currentEp = anime.nextAiringEpisode?.episode
        ? anime.nextAiringEpisode.episode - 1
        : anime.episodes || "??";

    const epCount = anime.episodes || "??";
    let status = `${currentEp} / ${epCount}`;

    if (anime.nextAiringEpisode?.airingAt) {
        const now = Math.floor(Date.now() / 1000);
        const delta = anime.nextAiringEpisode.airingAt - now;

        const days = Math.floor(delta / (60 * 60 * 24));
        const hours = Math.floor((delta % (60 * 60 * 24)) / (60 * 60));
        const mins = Math.floor((delta % (60 * 60)) / 60);

        status += `\nNext ep in: ${days}d ${hours}h ${mins}m`;
    }

    return status;
}

let requestCount = 0;
let isRateLimited = false;
setInterval(() => {
    if (requestCount > 0) {
        console.log(`[AniList] Sent ${requestCount} requests in the last minute.`);
        if (requestCount > 80) {
            console.warn(`[AniList] ⚠️ WARNING: Approaching rate limit (${requestCount}/90)!`);
        }
    }
    requestCount = 0;
}, 60 * 1000); // Reset every minute

setInterval(() => {
    requestCount = 0;
    isRateLimited = false; // Reset rate limit flag
    // console.log(`[AniList] ✅ Request limit reset.`);
}, 60 * 1000); // Reset every minute

module.exports = (client) => {
    client.on("messageCreate", async (message) => {
        if (!message.content.startsWith(".anime") || message.author.bot) return;

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

        if (isRateLimited) {
            return message.channel.send("⚠️ Bot is temporarily rate-limited due to high usage. Please try again in a minute.");
        }

        const animeName = message.content.slice(".anime".length).trim();
        if (!animeName) {
            return message.channel.send("Please provide an anime name.");
        }

        requestCount++;

        if (requestCount > 80) {
            isRateLimited = true;
            console.warn(`[AniList] ❌ Rate limit exceeded (${requestCount}/90). Temporarily blocking commands.`);
            return message.channel.send("⚠️ Too many requests! Bot is temporarily paused for a minute to avoid hitting AniList's rate limit.");
        }

        const query = gql`
        query ($search: String) {
          Media(search: $search, type: ANIME) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              color
            }
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
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
            rankings {
              rank
              allTime
              type
              context
            }
            characters(sort: [ROLE, RELEVANCE], perPage: 5) {
              edges {
                node {
                  name {
                    full
                  }
                }
              }
            }
            relations {
              edges {
                node {
                  title {
                    romaji
                  }
                  type
                  averageScore
                }
              }
            }
            studios {
              nodes {
                name
              }
            }
            trailer {
              id
              site
            }
            siteUrl
            nextAiringEpisode {
              episode
              airingAt
              timeUntilAiring
            }
          }
        }
      `;

        const variables = { search: animeName };

        try {
            const { Media: anime } = await aniClient.request(query, variables);
            if (!anime) throw new Error("Anime not found.");

            // Title fallback
            const title = anime.title.romaji || anime.title.english || anime.title.native;

            // Description cleaned and trimmed
            const description =
                anime.description?.replace(/<\/?[^>]+(>|$)/g, "").slice(0, 300) || "No description available.";

            // Format release dates (if available)
            const startDate = anime.startDate?.year
                ? `${anime.startDate.day}/${anime.startDate.month}/${anime.startDate.year}`
                : "Unknown";
            const endDate =
                anime.endDate?.year || anime.status === "RELEASING"
                    ? (anime.endDate?.year ? `${anime.endDate.day}/${anime.endDate.month}/${anime.endDate.year}` : "Ongoing")
                    : "Unknown";

            // Calculate total watch time (total minutes → human-readable)
            const totalMinutes = anime.episodes && anime.duration ? anime.episodes * anime.duration : 0;
            const humanReadableDuration = formatDuration(totalMinutes);

            // --- Improved: Show full episode status and next episode timer ---
            let episodeStatus = "??";
            let nextEpisodeCountdown = "";
            if (anime.nextAiringEpisode && anime.episodes) {
                // Example: 18 / 24, Episode 19 release in: 2d 3h 10m
                const currentEp = anime.nextAiringEpisode.episode - 1;
                const totalEp = anime.episodes;
                episodeStatus = `${currentEp} / ${totalEp}`;
                const now = Math.floor(Date.now() / 1000);
                const delta = anime.nextAiringEpisode.airingAt - now;
                const days = Math.floor(delta / (60 * 60 * 24));
                const hours = Math.floor((delta % (60 * 60 * 24)) / (60 * 60));
                const mins = Math.floor((delta % (60 * 60)) / 60);
                nextEpisodeCountdown = `, Episode ${anime.nextAiringEpisode.episode} release in: ${days}d ${hours}h ${mins}m`;
            } else if (anime.episodes) {
                // Completed or no next episode info
                episodeStatus = `${anime.episodes} / ${anime.episodes}`;
            } else if (anime.nextAiringEpisode) {
                // No total episode info
                const currentEp = anime.nextAiringEpisode.episode - 1;
                episodeStatus = `${currentEp} / ??`;
                const now = Math.floor(Date.now() / 1000);
                const delta = anime.nextAiringEpisode.airingAt - now;
                const days = Math.floor(delta / (60 * 60 * 24));
                const hours = Math.floor((delta % (60 * 60 * 24)) / (60 * 60));
                const mins = Math.floor((delta % (60 * 60)) / 60);
                nextEpisodeCountdown = `, Episode ${anime.nextAiringEpisode.episode} release in: ${days}d ${hours}h ${mins}m`;
            } else {
                episodeStatus = "??";
            }

            // Merged and deduplicated related entries
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

            // Main characters list
            const mainCharacters = anime.characters.edges
                .map((c) => c.node.name.full)
                .join(", ") || "N/A";

            // Leaderboard ranking
            const rankingObj = anime.rankings.find((r) => r.type === "RATED" && r.allTime);
            const rankings = rankingObj ? `#${rankingObj.rank}` : "#??? (No Information)";

            // Process related anime (seasons) and movies from relations
            const relatedSeasons = anime.relations.edges
                .filter((rel) => rel.node.type === "ANIME")
                .map(
                    (rel) =>
                        `${rel.node.title.romaji} - Score: ${rel.node.averageScore || "?"} - ${getRecommendation(
                            rel.node.averageScore || 0
                        )}`
                )
                .join("\n") || "No other seasons.";

            const relatedMovies = anime.relations.edges
                .filter((rel) => rel.node.type === "MOVIE")
                .map(
                    (rel) =>
                        `${rel.node.title.romaji} - Score: ${rel.node.averageScore || "?"} - ${getRecommendation(
                            rel.node.averageScore || 0
                        )}`
                )
                .join("\n") || "No Movies Available";

            // --- Error handling for trailer ---
            let trailerUrl = "None";
            if (anime.trailer && anime.trailer.site && anime.trailer.id) {
                if (anime.trailer.site.toLowerCase() === "youtube") {
                    trailerUrl = `[Watch Here](https://www.youtube.com/watch?v=${anime.trailer.id})`;
                } else if (anime.trailer.site.toLowerCase() === "dailymotion") {
                    trailerUrl = `[Watch Here](https://www.dailymotion.com/video/${anime.trailer.id})`;
                }
            }

            // Build the embed message
            const embed = new EmbedBuilder()
                .setTitle(`${title} (${anime.format || "Unknown Format"})`)
                .setURL(anime.siteUrl)
                .setColor(anime.coverImage.color || "#3498db")
                .setThumbnail(anime.coverImage.large)
                .setDescription(description + (anime.description && anime.description.length > 300 ? "..." : ""))
                .addFields(
                    { name: "Average Score", value: anime.averageScore ? `${anime.averageScore} / 100` : "N/A", inline: true },
                    { name: "Episodes", value: `${episodeStatus}${nextEpisodeCountdown}`, inline: true },
                    { name: "Total Watch Time", value: humanReadableDuration, inline: true },
                    { name: "Release Date", value: `${startDate} → ${endDate}`, inline: true },
                    { name: "Anime Type", value: anime.format || "Unknown", inline: true },
                    { name: "Source", value: anime.source ? anime.source.replace("_", " ") : "Unknown", inline: true },
                    { name: "Status", value: anime.status || "Unknown", inline: true },
                    {
                        name: "Studio",
                        value: anime.studios?.nodes?.[0]?.name || "Unknown",
                        inline: true,
                    },
                    {
                        name: "Trailer",
                        value: trailerUrl,
                        inline: true,
                    },
                    { name: "Genres", value: anime.genres.join(", ") || "None", inline: false },
                    { name: "Main Characters", value: mainCharacters, inline: false },
                    { name: "Ranking in Leaderboard", value: rankings, inline: true },
                    { name: "Recommendation", value: anime.averageScore ? getRecommendation(anime.averageScore) : "N/A", inline: true },
                    { name: "Seasons/Movies & Ranking", value: truncate(relatedEntries), inline: false },
                )
                .setFooter({ text: "Powered by AniList" });

            return message.channel.send({ embeds: [embed] });
        } catch (err) {
            console.error(`[AniList] Error fetching anime "${animeName}":`, err);
            if (err.response && err.response.errors && err.response.errors[0]?.message) {
                return message.channel.send(`❌ AniList error: ${err.response.errors[0].message}`);
            }
            return message.channel.send(`❌ Could not find anime: **${animeName}**.`);
        }
    });
};
