/**
 * Ban Service
 * Handles bot-wide ban checking
 */

const { isUserBanned } = require('../Commands/botban');

module.exports = {
    isBanned: isUserBanned,
    isUserBanned
};
