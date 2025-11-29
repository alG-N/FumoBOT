const fs = require('fs');
const path = require('path');
const banfilepath = path.join(__dirname, 'Banned.json');

// Ensure file exists
if (!fs.existsSync(banfilepath)) {
    fs.writeFileSync(banfilepath, JSON.stringify([]));
}

function isBanned(userId) {
    const banList = JSON.parse(fs.readFileSync(banfilepath));

    const updatedBanList = banList.filter(ban => {
        if (ban.expiresAt && Date.now() > ban.expiresAt) {
            return false; // expired
        }
        return true;
    });

    if (updatedBanList.length !== banList.length) {
        fs.writeFileSync(banfilepath, JSON.stringify(updatedBanList, null, 2));
    }

    return updatedBanList.find(ban => ban.userId === userId) || null;
}

module.exports = { isBanned };