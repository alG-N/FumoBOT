const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../Steam/.env') });
require('dotenv').config({ path: path.join(__dirname, '../../Reddit/.env') });
require('dotenv').config({ path: path.join(__dirname, '../../Pixiv/.env') });
require('dotenv').config({ path: path.join(__dirname, '../../Rule34/.env') });

module.exports = {
    steam: {
        apiKey: process.env.STEAM_API_KEY || ''
    },
    reddit: {
        clientId: process.env.CLIENT_ID,
        secretKey: process.env.SECRET_KEY
    },
    pixiv: {
        refreshToken: process.env.PIXIV_REFRESH_TOKEN,
        clientId: 'MOBrBDS8blbauoSck0ZfDbtuzpyT',
        clientSecret: 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj'
    },
    rule34: {
        userId: process.env.RULE34_USER_ID || '',
        apiKey: process.env.RULE34_API_KEY || ''
    }
};
