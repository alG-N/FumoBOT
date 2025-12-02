/**
 * Logger Utility
 * Centralized logging with Discord channel integration
 */

const config = require('../config/music.config');
const { formatTimestamp } = require('./format.util');

class Logger {
    constructor() {
        this.client = null;
    }

    /**
     * Set Discord client for channel logging
     */
    setClient(client) {
        this.client = client;
    }

    /**
     * Format log message
     */
    formatMessage(level, message, context = {}) {
        const timestamp = formatTimestamp(Date.now());
        const guild = context.guild?.name || 'N/A';
        const user = context.user?.tag || 'System';
        
        return `[${timestamp}] [${level.toUpperCase()}] [${guild}] [${user}] ${message}`;
    }

    /**
     * Log to console
     */
    logToConsole(level, message, context) {
        const formatted = this.formatMessage(level, message, context);
        
        switch (level) {
            case 'error':
                console.error(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            case 'info':
                console.info(formatted);
                break;
            case 'debug':
                console.log(formatted);
                break;
            default:
                console.log(formatted);
        }
    }

    /**
     * Log to Discord channel
     */
    async logToChannel(message, level = 'info') {
        if (!config.logging.enabled || !this.client) {
            return;
        }

        try {
            const channel = await this.client.channels.fetch(config.logging.channelId);
            if (channel) {
                const emoji = {
                    error: '❌',
                    warn: '⚠️',
                    info: 'ℹ️',
                    debug: '🔍'
                }[level] || 'ℹ️';

                await channel.send(`${emoji} \`\`\`js\n${message}\n\`\`\``);
            }
        } catch (error) {
            console.error('Failed to log to Discord channel:', error.message);
        }
    }

    /**
     * Error log
     */
    error(message, context = {}) {
        this.logToConsole('error', message, context);
        this.logToChannel(this.formatMessage('error', message, context), 'error');
    }

    /**
     * Warning log
     */
    warn(message, context = {}) {
        this.logToConsole('warn', message, context);
        this.logToChannel(this.formatMessage('warn', message, context), 'warn');
    }

    /**
     * Info log
     */
    info(message, context = {}) {
        this.logToConsole('info', message, context);
        this.logToChannel(this.formatMessage('info', message, context), 'info');
    }

    /**
     * Debug log
     */
    debug(message, context = {}) {
        this.logToConsole('debug', message, context);
        // Don't log debug messages to Discord channel
    }

    /**
     * Command log
     */
    command(commandName, user, guild) {
        const message = `Command "${commandName}" executed`;
        this.info(message, { user, guild });
    }
}

module.exports = new Logger();