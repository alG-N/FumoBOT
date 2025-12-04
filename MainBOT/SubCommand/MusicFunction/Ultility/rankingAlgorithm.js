const { parseDuration } = require('./formatters');
const config = require('../Configuration/searchConfig');

class RankingAlgorithm {
    rankResults(results, query) {
        const queryLower = query.toLowerCase().trim();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);

        return results.map(result => {
            let score = 0;
            const title = (result.title || "").toLowerCase();
            const author = (result.author?.name || result.uploader || result.channel || "").toLowerCase();
            const views = Number(result.view_count || result.views || 0);
            const duration = Number(result.duration || result.seconds || result.lengthSeconds || 0);

            const durationSeconds = typeof duration === 'string' ? parseDuration(duration) : duration;

            const wordsInTitle = queryWords.filter(word => title.includes(word)).length;
            const wordMatchRatio = queryWords.length > 0 ? wordsInTitle / queryWords.length : 0;
            score += wordMatchRatio * config.rankingWeights.wordMatchRatio;

            if (title.includes(queryLower)) {
                score += config.rankingWeights.fullQueryMatch;
            }

            if (title.startsWith(queryLower)) {
                score += config.rankingWeights.queryStartsWith;
            }

            if (views > 0) {
                score += Math.sqrt(views) * config.rankingWeights.viewBonus;
                if (views > config.viewThresholds.high) {
                    score += config.rankingWeights.highViewsBonus;
                }
                else if (views > config.viewThresholds.medium) {
                    score += config.rankingWeights.mediumViewsBonus;
                }
            }

            const isOfficial = config.officialKeywords.some(keyword => author.includes(keyword));
            if (isOfficial) {
                score += config.rankingWeights.officialBonus;
            }

            const hasOfficialContent = config.officialContentKeywords.some(keyword => title.includes(keyword));
            if (hasOfficialContent) {
                score += config.rankingWeights.officialContentBonus;
            }

            if (durationSeconds >= config.durationRanges.ideal.min && 
                durationSeconds <= config.durationRanges.ideal.max) {
                score += config.rankingWeights.durationBonus;
            } else if (durationSeconds >= config.durationRanges.acceptable.min && 
                       durationSeconds <= config.durationRanges.acceptable.max) {
                score += config.rankingWeights.shortDurationBonus;
            }

            const spamKeywordsToCheck = queryLower.includes('remix') 
                ? config.spamKeywords.filter(k => k !== 'remix')
                : config.spamKeywords;

            let spamCount = 0;
            spamKeywordsToCheck.forEach(keyword => {
                if (title.includes(keyword)) spamCount++;
            });
            score -= spamCount * config.rankingWeights.spamPenalty;

            if (/\d+/.test(title) && (title.includes('top') || title.includes('best') ||
                title.includes('greatest') || title.includes('most'))) {
                score -= config.rankingWeights.compilationPenalty;
            }

            if (durationSeconds > config.durationRanges.long) {
                score -= config.rankingWeights.longDurationPenalty;
            } else if (durationSeconds > config.durationRanges.veryLong) {
                score -= config.rankingWeights.mediumLongPenalty;
            }

            if (durationSeconds > 0 && durationSeconds < config.durationRanges.short) {
                score -= config.rankingWeights.shortDurationPenalty;
            } else if (durationSeconds < config.durationRanges.veryShort) {
                score -= config.rankingWeights.veryShortPenalty;
            }

            if (!isOfficial && views > config.viewThresholds.popular && 
                durationSeconds >= 180 && durationSeconds <= 360) {
                score += config.rankingWeights.popularNonOfficialBonus;
            }

            return { ...result, _searchScore: score };
        }).sort((a, b) => b._searchScore - a._searchScore);
    }
}

module.exports = new RankingAlgorithm();