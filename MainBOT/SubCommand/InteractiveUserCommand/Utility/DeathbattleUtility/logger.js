const { LOG_CHANNEL_ID } = require('../../Configuration/Deathbattle/deathBattleConfig');

class DeathBattleLogger {
    log(msg, interaction) {
        const now = new Date();
        const ts = now.toLocaleString('en-GB');
        const guild = interaction?.guild?.name ?? "UnknownGuild";
        const user = interaction?.user?.tag ?? "UnknownUser";
        const logMsg = `[${ts}] [DeathBattle] [${guild}] [${user}] ${msg}`;
        
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
            console.error("[DeathBattle Logger] Failed to send log to channel:", err);
        }
    }

    error(msg, interaction = null) {
        const errorMsg = `[ERROR] ${msg}`;
        console.error(errorMsg);
        
        if (interaction && interaction.client) {
            this.logToChannel(interaction.client, errorMsg);
        }
    }
}

module.exports = new DeathBattleLogger();