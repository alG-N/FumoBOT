const path = require('path');

// Load environment variables from .env files in the API-Website root
// You can merge all env vars into a single .env file in the API-Website folder
require('dotenv').config({ path: path.join(__dirname, '../../.env.steam') });
require('dotenv').config({ path: path.join(__dirname, '../../.env.reddit') });
require('dotenv').config({ path: path.join(__dirname, '../../.env.pixiv') });
require('dotenv').config({ path: path.join(__dirname, '../../.env.rule34') });

// Or use a single unified .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

module.exports = {
    steam: {
        apiKey: process.env.STEAM_API_KEY || ''
    },
    reddit: {
        clientId: process.env.CLIENT_ID || process.env.REDDIT_CLIENT_ID,
        secretKey: process.env.SECRET_KEY || process.env.REDDIT_SECRET_KEY
    },
    pixiv: {
        refreshToken: process.env.PIXIV_REFRESH_TOKEN,
        clientId: 'MOBrBDS8blbauoSck0ZfDbtuzpyT',
        clientSecret: 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj'
    },
    rule34: {
        userId: process.env.RULE34_USER_ID || '',
        apiKey: process.env.RULE34_API_KEY || ''
    },
    google: {
        apiKey: process.env.GOOGLE_API_KEY || '',
        searchCx: process.env.GOOGLE_SEARCH_CX || ''
    }
};
