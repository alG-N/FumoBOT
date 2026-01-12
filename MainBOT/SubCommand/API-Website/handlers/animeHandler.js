const { EmbedBuilder } = require('discord.js');
const anilistService = require('../services/anilistService');

// Media type labels and colors
const MEDIA_CONFIG = {
    anime: { emoji: '📺', color: '#3498db', label: 'Anime' },
    manga: { emoji: '📚', color: '#e74c3c', label: 'Manga' },
    lightnovel: { emoji: '📖', color: '#9b59b6', label: 'Light Novel' },
    webnovel: { emoji: '💻', color: '#2ecc71', label: 'Web Novel' },
    oneshot: { emoji: '📄', color: '#f39c12', label: 'One-shot' }
};

/**
 * Create embed based on media type and source
 */
async function createMediaEmbed(media, source = 'anilist', mediaType = 'anime') {
    if (source === 'mal' && mediaType !== 'anime') {
        return createMALMangaEmbed(media, mediaType);
    } else if (source === 'mal') {
        return createMALAnimeEmbed(media);
    } else {
        return createAniListEmbed(media);
    }
}

/**
 * Create AniList anime embed (original design)
 */
async function createAniListEmbed(anime) {
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
        .setTitle(`📘 ${title} (${anime.format || 'Unknown'})`)
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

/**
 * Create MAL anime embed (unique design for MAL)
 */
async function createMALAnimeEmbed(anime) {
    const title = anime.title.romaji || anime.title.english || anime.title.native;
    const description = anime.description
        ? anilistService.truncate(anime.description.replace(/<\/?[^>]+(>|$)/g, ''), 400)
        : 'No description available.';

    const startDate = anilistService.formatDate(anime.startDate);
    const endDate = anime.endDate?.year
        ? anilistService.formatDate(anime.endDate)
        : anime.status === 'RELEASING' ? 'Ongoing' : 'Unknown';

    const episodeText = anime.episodes ? `${anime.episodes} episodes` : 'Unknown';
    
    // MAL-specific stats
    const scoreText = anime.score ? `⭐ ${anime.score}/10` : 'N/A';
    const memberText = anime.members ? formatNumber(anime.members) : 'N/A';
    const favoritesText = anime.favorites ? formatNumber(anime.favorites) : 'N/A';
    const rankText = anime.rank ? `#${anime.rank}` : 'N/A';
    const popularityText = anime.popularity_rank ? `#${anime.popularity_rank}` : 'N/A';

    const trailerUrl = anime.trailer?.id 
        ? `[Watch Trailer](https://youtube.com/watch?v=${anime.trailer.id})`
        : 'N/A';

    return new EmbedBuilder()
        .setTitle(`📗 ${title}`)
        .setURL(anime.siteUrl)
        .setColor('#2E51A2') // MAL blue
        .setThumbnail(anime.coverImage?.large)
        .setDescription(description)
        .addFields(
            { name: '📊 Score', value: scoreText, inline: true },
            { name: '📈 Ranked', value: rankText, inline: true },
            { name: '🔥 Popularity', value: popularityText, inline: true },
            { name: '📺 Episodes', value: episodeText, inline: true },
            { name: '⏱️ Duration', value: anime.duration ? `${anime.duration} min/ep` : 'N/A', inline: true },
            { name: '📅 Aired', value: `${startDate} → ${endDate}`, inline: true },
            { name: '🎬 Type', value: anime.format || 'Unknown', inline: true },
            { name: '📡 Status', value: anime.status || 'Unknown', inline: true },
            { name: '🎬 Rating', value: anime.rating || 'N/A', inline: true },
            { name: '🎵 Studio', value: anime.studios?.nodes?.[0]?.name || 'Unknown', inline: true },
            { name: '📺 Broadcast', value: anime.broadcast || 'N/A', inline: true },
            { name: '🎥 Trailer', value: trailerUrl, inline: true },
            { name: '🏷️ Genres', value: anime.genres?.join(', ') || 'None', inline: false },
            { name: '👥 Community', value: `${memberText} members • ${favoritesText} favorites`, inline: false }
        )
        .setFooter({ text: `MyAnimeList • Scored by ${anime.scoredBy ? formatNumber(anime.scoredBy) : '?'} users` });
}

/**
 * Create MAL manga/lightnovel/webnovel embed
 */
async function createMALMangaEmbed(manga, mediaType = 'manga') {
    const config = MEDIA_CONFIG[mediaType] || MEDIA_CONFIG.manga;
    const title = manga.title.romaji || manga.title.english || manga.title.native;
    const description = manga.description
        ? anilistService.truncate(manga.description.replace(/<\/?[^>]+(>|$)/g, ''), 400)
        : 'No description available.';

    const startDate = anilistService.formatDate(manga.startDate);
    const endDate = manga.endDate?.year
        ? anilistService.formatDate(manga.endDate)
        : manga.status === 'RELEASING' ? 'Ongoing' : 'Unknown';

    // Progress info
    const chaptersText = manga.chapters ? `${manga.chapters} chapters` : 'Unknown';
    const volumesText = manga.volumes ? `${manga.volumes} volumes` : 'Unknown';
    
    // MAL-specific stats
    const scoreText = manga.score ? `⭐ ${manga.score}/10` : 'N/A';
    const memberText = manga.members ? formatNumber(manga.members) : 'N/A';
    const favoritesText = manga.favorites ? formatNumber(manga.favorites) : 'N/A';
    const rankText = manga.rank ? `#${manga.rank}` : 'N/A';
    const popularityText = manga.popularity_rank ? `#${manga.popularity_rank}` : 'N/A';

    // Authors
    const authorsText = manga.authors?.length > 0
        ? manga.authors.map(a => `${a.name} (${a.role})`).join(', ')
        : 'Unknown';

    // Serialization
    const serializationText = manga.serialization?.length > 0
        ? manga.serialization.join(', ')
        : 'N/A';

    // Themes & Demographics
    const themesText = [...(manga.themes || []), ...(manga.demographics || [])].join(', ') || 'None';

    return new EmbedBuilder()
        .setTitle(`${config.emoji} ${title}`)
        .setURL(manga.siteUrl)
        .setColor(config.color)
        .setThumbnail(manga.coverImage?.large)
        .setDescription(description)
        .addFields(
            { name: '📊 Score', value: scoreText, inline: true },
            { name: '📈 Ranked', value: rankText, inline: true },
            { name: '🔥 Popularity', value: popularityText, inline: true },
            { name: '📖 Chapters', value: chaptersText, inline: true },
            { name: '📚 Volumes', value: volumesText, inline: true },
            { name: '📅 Published', value: `${startDate} → ${endDate}`, inline: true },
            { name: '📝 Type', value: manga.format || config.label, inline: true },
            { name: '📡 Status', value: manga.status || 'Unknown', inline: true },
            { name: '📰 Serialization', value: serializationText, inline: true },
            { name: '✍️ Authors', value: anilistService.truncate(authorsText, 100), inline: false },
            { name: '🏷️ Genres', value: manga.genres?.join(', ') || 'None', inline: false },
            { name: '🎯 Themes', value: themesText, inline: false },
            { name: '👥 Community', value: `${memberText} members • ${favoritesText} favorites`, inline: false }
        )
        .setFooter({ text: `MyAnimeList ${config.label} • Scored by ${manga.scoredBy ? formatNumber(manga.scoredBy) : '?'} users` });
}

/**
 * Legacy function for backward compatibility
 */
async function createAnimeEmbed(anime, source = 'anilist') {
    return createMediaEmbed(anime, source, 'anime');
}

/**
 * Format large numbers (e.g., 1234567 -> 1.2M)
 */
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

module.exports = {
    createMediaEmbed,
    createAnimeEmbed,
    createAniListEmbed,
    createMALAnimeEmbed,
    createMALMangaEmbed
};
