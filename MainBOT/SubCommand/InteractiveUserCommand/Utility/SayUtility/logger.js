const { LOG_CHANNEL_ID } = require('../Configuration/sayConfig');

class SayLogger {
    log(userTag, userId, channelName, channelId, type, message) {
        const now = new Date();
        const dateStr = now.toLocaleString('en-GB');
        const consoleMsg = `[${dateStr}] [say] User: ${userTag} | Channel: ${channelName} (${channelId}) | Type: ${type}`;
        console.log(consoleMsg);
    }

    async logToChannel(client, userTag, userId, channelName, channelId, type, message) {
        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel && logChannel.isTextBased()) {
                await logChannel.send(
                    "```" +
                    `Say Command Used\n` +
                    `User: ${userTag} (${userId})\n` +
                    `Channel: ${channelName} (${channelId})\n` +
                    `Type: ${type}\n` +
                    `Message: ${message}` +
                    "```"
                );
            }
        } catch (err) {
            console.error("[Say Logger] Failed to log to channel:", err);
        }
    }

    error(msg) {
        console.error(`[Say Command Error] ${msg}`);
    }
}

module.exports = new SayLogger();