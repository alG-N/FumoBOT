module.exports = {
    MAX_SEARCH_RESULTS: 15,
    TOP_RESULTS_TO_RANK: 3,
    
    searchSuffixes: {
        primary: ' song',
        fallback: ' music'
    },
    
    rankingWeights: {
        wordMatchRatio: 2000,
        fullQueryMatch: 500,
        queryStartsWith: 800,
        viewBonus: 0.5,
        highViewsBonus: 1000,
        mediumViewsBonus: 500,
        officialBonus: 600,
        officialContentBonus: 400,
        durationBonus: 200,
        shortDurationBonus: 100,
        spamPenalty: 1500,
        compilationPenalty: 2000,
        longDurationPenalty: 1000,
        mediumLongPenalty: 300,
        shortDurationPenalty: 500,
        veryShortPenalty: 100,
        popularNonOfficialBonus: 200
    },
    
    durationRanges: {
        ideal: { min: 120, max: 480 },
        acceptable: { min: 60, max: 600 },
        long: 600,
        veryLong: 480,
        short: 60,
        veryShort: 90
    },
    
    viewThresholds: {
        high: 10000000,
        medium: 1000000,
        popular: 100000
    },
    
    spamKeywords: [
        'top 10', 'top 15', 'top 20', 'top 30', 'top 50', 'best of', 'compilation',
        'playlist', 'mix', 'megamix', 'mashup', 'collection',
        'reaction', 'reacts', 'reacting', 'review', 'reviewer',
        'cover', 'covered by', 'acoustic', 'piano', 'violin', 'guitar', 'instrumental',
        'nightcore', 'slowed', 'reverb', 'speed up', 'sped up', '8d audio', '8d',
        'bass boost', 'bass boosted', 'earrape', 'distorted',
        'lyrics', 'lyric video', 'with lyrics', 'tutorial', 'lesson', 'how to', 'guide',
        'live', 'concert', 'performance', 'tour', 'behind the scenes'
    ],
    
    officialKeywords: ['official', 'vevo', 'records', 'music', 'topic'],
    
    officialContentKeywords: [
        'official audio', 'official video', 'official music video', 'official mv'
    ]
};