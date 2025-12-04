const { formatTimestamp } = require('./formatters');
const { LOG_CHANNEL_ID } = require('../Configuration/MusicConfig');

class Logger {
    log(msg, interaction) {
        const now = new Date();
        const ts = formatTimestamp(now);
        const guild = interaction?.guild?.name ?? "UnknownGuild";
        const user = interaction?.user?.tag ?? "UnknownUser";
        const logMsg = `[${ts}] [${guild}] [${user}] ${msg}`;
        
        console.log(logMsg);
        
        if (interaction && interaction.client) {
            this.logToChannel(interaction.client, `[${ts}] ${msg}`);
        }
    }

    async logToChannel(client, msg) {
        try {
            const channel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (channel && channel.isTextBased()) {
                await channel.send(`\`\`\`js\n${msg}\n\`\`\``);
            }
        } catch (err) {
            console.error("[Logger] Failed to send log to channel:", err);
        }
    }

    error(msg, interaction = null) {
        const errorMsg = `[ERROR] ${msg}`;
        console.error(errorMsg);
        
        if (interaction && interaction.client) {
            this.logToChannel(interaction.client, errorMsg);
        }
    }

    warn(msg, interaction = null) {
        const warnMsg = `[WARN] ${msg}`;
        console.warn(warnMsg);
        
        if (interaction && interaction.client) {
            this.logToChannel(interaction.client, warnMsg);
        }
    }

    debug(msg, interaction = null) {
        const debugMsg = `[DEBUG] ${msg}`;
        console.log(debugMsg);
    }
}

module.exports = new Logger();