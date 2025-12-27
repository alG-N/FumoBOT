const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const anilistService = require('../services/anilistService');
const animeRepository = require('../repositories/animeRepository');

async function createAnimeEmbed(anime) {
    const title = anime.title.romaji || anime.title.english || anime.title.native;
    const description = anime.description
        ? anilistService.truncate(anime.description.replace(/<\/?[^>]+(>|$)/g, ''), 500)
        : 'No description available.';

    const startDate = anilistService.formatDate(anime.startDate);
    const endDate = anime.endDate?.year
        ? anilistService.formatDate(anime.endDate)
        : anime.status === 'RELEASING' ? 'Ongoing' : 'Unknown';

    const totalMinutes = anime.episodes && anime.duration ? anime.episodes * anime.duration : 0;
    const humanReadableDuration = anilistService.formatDuration(totalMinutes);

    let episodeStatus = '??';
    let nextEpisodeCountdown = '';
    let finalEpisodeMsg = '';

    if (anime.nextAiringEpisode) {
        const currentEp = anime.nextAiringEpisode.episode - 1;
        episodeStatus = `${currentEp} / ${anime.episodes || '??'}`;

        const now = Math.floor(Date.now() / 1000);
        const delta = anime.nextAiringEpisode.airingAt - now;
        nextEpisodeCountdown = `, Ep ${anime.nextAiringEpisode.episode} in: ${anilistService.formatCountdown(delta)}`;

        if (anime.nextAiringEpisode.episode === anime.episodes) {
            finalEpisodeMsg = `\n**Final Episode airs in ${anilistService.formatCountdown(delta)}!**`;
        }
    } else if (anime.episodes) {
        episodeStatus = `${anime.episodes} / ${anime.episodes}`;
    }

    const relatedEntries = anilistService.formatRelatedEntries(anime.relations?.edges);
    const mainCharacters = anime.characters?.edges?.map(c => c.node.name.full).join(', ') || 'N/A';

    const rankingObj = anime.rankings?.find(r => r.type === 'RATED' && r.allTime);
    const rankings = rankingObj ? `#${rankingObj.rank}` : '#??? (No Info)';

    const trailerUrl = anilistService.getTrailerUrl(anime.trailer);

    return new EmbedBuilder()
        .setTitle(`${title} (${anime.format || 'Unknown'})`)
        .setURL(anime.siteUrl)
        .setColor(anime.coverImage?.color || '#3498db')
        .setThumbnail(anime.coverImage?.large)
        .setDescription(description + finalEpisodeMsg)
        .addFields(
            { name: 'Score', value: anime.averageScore ? `${anime.averageScore}/100` : 'N/A', inline: true },
            { name: 'Episodes', value: `${episodeStatus}${nextEpisodeCountdown}`, inline: true },
            { name: 'Total Watch Time', value: humanReadableDuration, inline: true },
            { name: 'Release Date', value: `${startDate} → ${endDate}`, inline: true },
            { name: 'Type', value: anime.format || 'Unknown', inline: true },
            { name: 'Source', value: anime.source?.replace('_', ' ') || 'Unknown', inline: true },
            { name: 'Status', value: anime.status || 'Unknown', inline: true },
            { name: 'Studio', value: anime.studios?.nodes?.[0]?.name || 'Unknown', inline: true },
            { name: 'Trailer', value: trailerUrl, inline: true },
            { name: 'Genres', value: anime.genres?.join(', ') || 'None', inline: false },
            { name: 'Characters', value: mainCharacters, inline: false },
            { name: 'Leaderboard Rank', value: rankings, inline: true },
            { name: 'Recommendation', value: anime.averageScore ? anilistService.getRecommendation(anime.averageScore) : 'N/A', inline: true },
            { name: 'Other Seasons/Movies', value: anilistService.truncate(relatedEntries, 800), inline: false }
        )
        .setFooter({ text: 'Powered by AniList' });
}

function createActionRow(userId, animeId, favourited, notifyEnabled, siteUrl) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`anime_fav_${userId}_${animeId}`)
            .setLabel(favourited ? 'Unfavourite' : 'Favourite')
            .setEmoji('❤️')
            .setStyle(favourited ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`anime_notify_${userId}_${animeId}`)
            .setLabel(favourited ? (notifyEnabled ? 'Stop Notifying' : 'Notify') : 'Notify')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!favourited),
        new ButtonBuilder()
            .setCustomId(`anime_favlist_${userId}`)
            .setLabel('Favourite List')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setLabel('More Info')
            .setStyle(ButtonStyle.Link)
            .setURL(siteUrl)
    );
}

function createNotifyPromptRow(userId, animeId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`anime_notifyyes_${userId}_${animeId}`)
            .setLabel('Yes, notify me!')
            .setEmoji('🔔')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`anime_notifyno_${userId}_${animeId}`)
            .setLabel('No, thanks')
            .setStyle(ButtonStyle.Secondary)
    );
}

function createMoviePromptRow(userId, animeId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`anime_watchyes_${userId}_${animeId}`)
            .setLabel('Yes, I want to watch it!')
            .setEmoji('🍿')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`anime_watchno_${userId}_${animeId}`)
            .setLabel('Not now')
            .setStyle(ButtonStyle.Secondary)
    );
}

async function createFavouriteListEmbed(userId, username) {
    const favs = await animeRepository.getUserFavourites(userId);

    if (!favs.length) {
        return new EmbedBuilder()
            .setTitle(`${username}'s Favourite Anime`)
            .setDescription('No favourites yet. Use the Favourite button to add anime!')
            .setColor('#e67e22');
    }

    const favDetails = [];
    for (const fav of favs.slice(0, 10)) {
        try {
            const anime = await anilistService.searchAnime(fav.anime_title);
            if (anime) {
                favDetails.push({
                    name: anime.title.romaji || anime.title.english || anime.title.native,
                    value: `Score: ${anime.averageScore || '?'} | Episodes: ${anime.episodes || '?'} | [AniList](${anime.siteUrl})`
                });
            } else {
                favDetails.push({ name: fav.anime_title, value: 'Details unavailable.' });
            }
        } catch {
            favDetails.push({ name: fav.anime_title, value: 'Details unavailable.' });
        }
    }

    return new EmbedBuilder()
        .setTitle(`${username}'s Favourite Anime`)
        .setColor('#e67e22')
        .addFields(favDetails)
        .setFooter({ text: favs.length > 10 ? `Showing 10 of ${favs.length}` : `Total: ${favs.length}` });
}

function createNotificationEmbed(title, type) {
    const configs = {
        enabled: {
            title: '✅ Notifications Enabled',
            description: `You will now be notified about new episodes of **${title}**.`,
            color: '#2ecc71'
        },
        disabled: {
            title: '🚫 Notifications Disabled',
            description: `You won't be notified about **${title}**.`,
            color: '#95a5a6'
        },
        timeout: {
            title: "⌛ Time's up",
            description: "You didn't respond in time.",
            color: '#e67e22'
        },
        nextSeason: {
            title: '📺 Next Ongoing Season Found!',
            description: `You will be notified for the next season instead, since the anime you favourited has already ended.`,
            color: '#2ecc71'
        },
        noSeason: {
            title: '⏳ No Ongoing Season Found',
            description: 'The anime has already ended, and no sequel with ongoing episodes was found.',
            color: '#f1c40f'
        }
    };

    const config = configs[type] || configs.disabled;
    return new EmbedBuilder()
        .setTitle(config.title)
        .setDescription(config.description)
        .setColor(config.color);
}

module.exports = {
    createAnimeEmbed,
    createActionRow,
    createNotifyPromptRow,
    createMoviePromptRow,
    createFavouriteListEmbed,
    createNotificationEmbed
};
