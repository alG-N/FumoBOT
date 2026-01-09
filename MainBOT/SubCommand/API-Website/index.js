/**
 * API-Website Module Exports
 * Centralized exports for all API commands
 */

// Commands
const anime = require('./commands/anime');
const reddit = require('./commands/reddit');
const rule34 = require('./commands/rule34');
const pixiv = require('./commands/pixiv');
const nhentai = require('./commands/nhentai');
const google = require('./commands/google');
const wikipedia = require('./commands/wikipedia');
const steam = require('./commands/steam');

// Services
const anilistService = require('./services/anilistService');
const redditService = require('./services/redditService');
const rule34Service = require('./services/rule34Service');
const pixivService = require('./services/pixivService');
const steamService = require('./services/steamService');
const nhentaiService = require('./services/nhentaiService');
const googleService = require('./services/googleService');
const wikipediaService = require('./services/wikipediaService');

// Handlers
const animeHandler = require('./handlers/animeHandler');
const redditPostHandler = require('./handlers/redditPostHandler');
const rule34PostHandler = require('./handlers/rule34PostHandler');
const pixivContentHandler = require('./handlers/pixivContentHandler');
const steamSaleHandler = require('./handlers/steamSaleHandler');
const nhentaiHandler = require('./handlers/nhentaiHandler');
const googleHandler = require('./handlers/googleHandler');
const wikipediaHandler = require('./handlers/wikipediaHandler');

// Repositories
const cacheManager = require('./repositories/cacheManager');
const animeRepository = require('./repositories/animeRepository');
const redditCache = require('./repositories/redditCache');
const rule34Cache = require('./repositories/rule34Cache');
const pixivCache = require('./repositories/pixivCache');

// Shared utilities
const { cooldownManager, COOLDOWN_SETTINGS } = require('./shared/utils/cooldown');
const { HttpClient, clients } = require('./shared/utils/httpClient');
const { BaseApiService } = require('./shared/services/BaseApiService');
const { BaseHandler, COLORS } = require('./shared/handlers/BaseHandler');
const { BaseCache } = require('./shared/repositories/BaseCache');

module.exports = {
    // Commands array for easy registration
    commands: [
        anime,
        reddit,
        rule34,
        pixiv,
        nhentai,
        google,
        wikipedia,
        steam
    ],
    
    // Individual command exports
    anime,
    reddit,
    rule34,
    pixiv,
    nhentai,
    google,
    wikipedia,
    steam,
    
    // Services
    services: {
        anilistService,
        redditService,
        rule34Service,
        pixivService,
        steamService,
        nhentaiService,
        googleService,
        wikipediaService
    },
    
    // Handlers
    handlers: {
        animeHandler,
        redditPostHandler,
        rule34PostHandler,
        pixivContentHandler,
        steamSaleHandler,
        nhentaiHandler,
        googleHandler,
        wikipediaHandler
    },
    
    // Repositories
    repositories: {
        cacheManager,
        animeRepository,
        redditCache,
        rule34Cache,
        pixivCache
    },
    
    // Shared utilities
    shared: {
        cooldownManager,
        COOLDOWN_SETTINGS,
        HttpClient,
        clients,
        BaseApiService,
        BaseHandler,
        BaseCache,
        COLORS
    }
};
