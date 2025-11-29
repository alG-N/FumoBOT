const fs = require('fs');
const path = require('path');

const banfilepath = path.join(__dirname, 'Banned.json');

const banDir = path.dirname(banfilepath);
if (!fs.existsSync(banDir)) {
    fs.mkdirSync(banDir, { recursive: true });
}

if (!fs.existsSync(banfilepath)) {
    fs.writeFileSync(banfilepath, JSON.stringify([], null, 2));
}

function isBanned(userId) {
    const banList = JSON.parse(fs.readFileSync(banfilepath, 'utf8'));

    const updatedBanList = banList.filter(ban => {
        if (ban.expiresAt && Date.now() > ban.expiresAt) {
            return false;
        }
        return true;
    });

    if (updatedBanList.length !== banList.length) {
        fs.writeFileSync(banfilepath, JSON.stringify(updatedBanList, null, 2));
    }

    return updatedBanList.find(ban => ban.userId === userId) || null;
}

module.exports = { isBanned };