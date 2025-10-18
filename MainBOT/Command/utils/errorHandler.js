const { EmbedBuilder } = require('discord.js');

const ERROR_CHANNEL_ID = '1367886953286205530';
let errorCount = 0;

/**
 * Format error for display
 */
function formatError(error) {
    if (error instanceof Error) {
        const stackLines = error.stack?.split('\n') || [];
        const relevantLine = stackLines.find(line =>
            line.includes(process.cwd())
        ) || stackLines[1] || 'Stack trace not available';

        return `${error.name}: ${error.message}\nAt: ${relevantLine.trim()}\n\n${error.stack}`;
    } else if (typeof error === 'object' && error !== null) {
        try {
            return JSON.stringify(error, null, 2);
        } catch {
            return String(error);
        }
    } else {
        return String(error);
    }
}

/**
 * Format uptime for display
 */
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Log error to console
 */
function logToConsole(prefix, error) {
    const formatted = formatError(error);
    console.error(`🟥 [${new Date().toISOString()}] ${prefix}:\n${formatted}`);
}

/**
 * Send error embed to Discord channel
 */
async function sendErrorEmbed(client, prefix, error) {
    try {
        if (!client?.channels?.fetch) return;

        const channel = await client.channels.fetch(ERROR_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const formatted = formatError(error).slice(0, 4000);
        const uptime = formatUptime(process.uptime() * 1000);
        const guilds = client.guilds.cache.map(g => g.name).join(', ').slice(0, 1024) || 'N/A';

        const embed = new EmbedBuilder()
            .setTitle('🟥 Error Detected')
            .setDescription(`**${prefix}**`)
            .addFields(
                { name: 'Details', value: `\`\`\`js\n${formatted.slice(0, 1010)}\n\`\`\`` },
                { name: 'Bot Uptime', value: uptime, inline: true },
                { name: 'Connected Servers', value: guilds, inline: false }
            )
            .setColor(0xFF0000)
            .setTimestamp()
            .setFooter({ text: `${client.user?.username || 'Bot'} • Error Logger` });

        await channel.send({ embeds: [embed] });

    } catch (sendErr) {
        console.error('🟥 Failed to send error embed to Discord:', formatError(sendErr));
    }
}

/**
 * Increment error counter
 */
function incrementErrorCount() {
    errorCount++;
}

/**
 * Get current error count
 */
function getErrorCount() {
    return errorCount;
}

/**
 * Reset error count
 */
function resetErrorCount() {
    errorCount = 0;
}

/**
 * Handle .errorstats command
 */
async function handleErrorStats(message) {
    const ADMIN_IDS = ['1128296349566251068', '1362450043939979378'];
    
    if (!ADMIN_IDS.includes(message.author.id)) return;

    const embed = new EmbedBuilder()
        .setTitle('🟠 Error Statistics')
        .setDescription(`Total errors since last restart: **${errorCount}**`)
        .setColor(0xFFA500)
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

/**
 * Initialize global error handlers
 */
function initializeErrorHandlers(client) {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
        incrementErrorCount();
        logToConsole('Unhandled Promise Rejection', reason);
        await sendErrorEmbed(client, 'Unhandled Promise Rejection', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
        incrementErrorCount();
        logToConsole('Uncaught Exception', error);
        await sendErrorEmbed(client, 'Uncaught Exception', error);
    });

    // Handle .errorstats command
    client.on('messageCreate', async (message) => {
        if (message.content.trim() === '.errorstats') {
            await handleErrorStats(message);
        }
    });

    console.log('✅ Error handlers initialized');
}

/**
 * Manually log an error
 */
async function logError(client, context, error) {
    incrementErrorCount();
    logToConsole(context, error);
    await sendErrorEmbed(client, context, error);
}

module.exports = {
    initializeErrorHandlers,
    logError,
    formatError,
    formatUptime,
    getErrorCount,
    resetErrorCount,
    incrementErrorCount,
    ERROR_CHANNEL_ID
};