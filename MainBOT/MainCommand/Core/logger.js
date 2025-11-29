const { EmbedBuilder, Colors } = require('discord.js');

const LOG_CHANNEL_ID = '1411386632589807719';
const DEBUG = process.env.DEBUG === 'true';

/**
 * Log levels
 */
const LogLevel = {
    DEBUG: 'debug',
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    ACTIVITY: 'activity'
};

/**
 * Console logging with timestamps
 */
function debugLog(category, message, data = null) {
    if (!DEBUG) return;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${category}] ${message}`, data || '');
}

/**
 * Send embed to Discord log channel
 */
async function logToDiscord(client, message, error = null, logType = LogLevel.INFO) {
    try {
        if (!client?.isReady()) {
            debugLog('DISCORD_LOG', 'Client not ready, skipping log');
            return;
        }

        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!channel?.isTextBased()) {
            debugLog('DISCORD_LOG', 'Channel not found or not text-based');
            return;
        }

        const colors = {
            [LogLevel.INFO]: Colors.Blue,
            [LogLevel.SUCCESS]: Colors.Green,
            [LogLevel.WARNING]: Colors.Yellow,
            [LogLevel.ERROR]: Colors.Red,
            [LogLevel.ACTIVITY]: Colors.Purple,
            [LogLevel.DEBUG]: Colors.Grey
        };

        const icons = {
            [LogLevel.INFO]: 'ℹ️',
            [LogLevel.SUCCESS]: '✅',
            [LogLevel.WARNING]: '⚠️',
            [LogLevel.ERROR]: '❌',
            [LogLevel.ACTIVITY]: '📊',
            [LogLevel.DEBUG]: '🔍'
        };

        const embed = new EmbedBuilder()
            .setTitle(`${icons[logType]} ${logType.toUpperCase()}`)
            .setDescription(message.slice(0, 2000))
            .setColor(colors[logType] || Colors.Blue)
            .setTimestamp();

        if (error) {
            embed.addFields([
                { 
                    name: '⚠️ Error Message', 
                    value: `\`\`\`${(error.message || 'Unknown').slice(0, 1000)}\`\`\`` 
                }
            ]);
            if (error.stack) {
                embed.addFields([
                    { 
                        name: '📍 Stack Trace', 
                        value: `\`\`\`${error.stack.slice(0, 1000)}\`\`\`` 
                    }
                ]);
            }
        }

        await channel.send({ embeds: [embed] });
        debugLog('DISCORD_LOG', `Logged to Discord: ${message.slice(0, 50)}`);
    } catch (err) {
        debugLog('DISCORD_LOG', 'Failed to log to Discord', err.message);
    }
}

/**
 * Log user activity
 */
async function logUserActivity(client, userId, username, action, details = '') {
    const message = `**User Activity**\n` +
        `👤 User: ${username} (\`${userId}\`)\n` +
        `🎯 Action: ${action}\n` +
        `${details ? `📝 Details: ${details}` : ''}`;
    await logToDiscord(client, message, null, LogLevel.ACTIVITY);
}

/**
 * Log error with context
 */
async function logError(client, context, error, userId = null) {
    const message = `**Error in ${context}**\n` +
        `${userId ? `👤 User ID: \`${userId}\`\n` : ''}` +
        `⏰ Timestamp: ${new Date().toLocaleTimeString()}`;
    await logToDiscord(client, message, error, LogLevel.ERROR);
}

/**
 * Log system event
 */
async function logSystemEvent(client, event, details = '') {
    const message = `**System Event**\n` +
        `🔔 Event: ${event}\n` +
        `${details ? `📝 Details: ${details}` : ''}`;
    await logToDiscord(client, message, null, LogLevel.INFO);
}

/**
 * Log success
 */
async function logSuccess(client, message, details = '') {
    const fullMessage = `${message}\n${details ? `📝 ${details}` : ''}`;
    await logToDiscord(client, fullMessage, null, LogLevel.SUCCESS);
}

module.exports = {
    LogLevel,
    debugLog,
    logToDiscord,
    logUserActivity,
    logError,
    logSystemEvent,
    logSuccess,
    LOG_CHANNEL_ID
};