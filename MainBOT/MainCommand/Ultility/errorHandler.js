const { EmbedBuilder } = require('discord.js');
const { logToDiscord, LogLevel } = require('../Core/logger');

const ERROR_COUNTS = new Map();
const ERROR_THRESHOLD = 5; // Errors per minute before alert
const RECOVERY_STRATEGIES = new Map();

/**
 * Initialize error handlers for the process
 */
function initializeErrorHandlers(client) {
    // Unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
        console.error('Unhandled Rejection:', reason);
        await handleError(client, reason, 'UnhandledRejection');
    });

    // Uncaught exceptions
    process.on('uncaughtException', async (error) => {
        console.error('Uncaught Exception:', error);
        await handleError(client, error, 'UncaughtException');
        
        // Give time to log before potential crash
        setTimeout(() => {
            process.exit(1);
        }, 3000);
    });

    // Warning handler
    process.on('warning', (warning) => {
        console.warn('Process Warning:', warning.name, warning.message);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT. Graceful shutdown...');
        await gracefulShutdown(client);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
        await gracefulShutdown(client);
    });
}

/**
 * Handle and log errors with rate limiting
 */
async function handleError(client, error, context = 'Unknown') {
    const errorKey = `${context}:${error?.message?.slice(0, 50) || 'unknown'}`;
    const now = Date.now();

    // Track error frequency
    const errorData = ERROR_COUNTS.get(errorKey) || { count: 0, firstSeen: now, lastSeen: now };
    errorData.count++;
    errorData.lastSeen = now;
    
    // Reset count if over a minute old
    if (now - errorData.firstSeen > 60000) {
        errorData.count = 1;
        errorData.firstSeen = now;
    }
    
    ERROR_COUNTS.set(errorKey, errorData);

    // Create error embed
    const embed = new EmbedBuilder()
        .setTitle(`❌ Error: ${context}`)
        .setColor('#FF0000')
        .setDescription(`\`\`\`${error?.stack?.slice(0, 1000) || error?.message || 'Unknown error'}\`\`\``)
        .addFields(
            { name: 'Occurrences (1min)', value: `${errorData.count}`, inline: true },
            { name: 'Memory Usage', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true }
        )
        .setTimestamp();

    // Alert if error frequency is high
    if (errorData.count >= ERROR_THRESHOLD) {
        embed.addFields({
            name: '⚠️ HIGH FREQUENCY',
            value: 'This error is occurring frequently!',
            inline: false
        });
    }

    try {
        await logToDiscord(client, null, null, LogLevel.ERROR, embed);
    } catch (logError) {
        console.error('Failed to log error to Discord:', logError.message);
    }

    // Attempt recovery if strategy exists
    await attemptRecovery(context, error, client);
}

/**
 * Register a recovery strategy for a specific error type
 */
function registerRecoveryStrategy(errorContext, recoveryFn) {
    RECOVERY_STRATEGIES.set(errorContext, recoveryFn);
}

/**
 * Attempt to recover from an error
 */
async function attemptRecovery(context, error, client) {
    const strategy = RECOVERY_STRATEGIES.get(context);
    if (strategy) {
        try {
            console.log(`🔧 Attempting recovery for: ${context}`);
            await strategy(error, client);
            console.log(`✅ Recovery successful for: ${context}`);
        } catch (recoveryError) {
            console.error(`❌ Recovery failed for ${context}:`, recoveryError.message);
        }
    }
}

/**
 * Graceful shutdown procedure
 */
async function gracefulShutdown(client) {
    console.log('🔄 Starting graceful shutdown...');
    
    try {
        // Log shutdown
        const embed = new EmbedBuilder()
            .setTitle('🛑 Bot Shutting Down')
            .setColor('#FFA500')
            .setDescription('FumoBOT is shutting down gracefully.')
            .setTimestamp();
        
        await logToDiscord(client, null, null, LogLevel.INFO, embed);
        
        // Stop intervals and queues
        const { stopAllFarmingIntervals } = require('../Service/FarmingService/FarmingIntervalService');
        await stopAllFarmingIntervals();
        
        // Close database connection
        const db = require('../Core/Database/dbSetting');
        await new Promise((resolve) => db.close(resolve));
        
        // Destroy client
        await client.destroy();
        
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
    }
}

/**
 * Create user-friendly error response
 */
function createUserErrorEmbed(error, suggestion = null) {
    const embed = new EmbedBuilder()
        .setTitle('⚠️ Something Went Wrong')
        .setColor('#FF6600')
        .setDescription('An error occurred while processing your request.');

    if (suggestion) {
        embed.addFields({
            name: '💡 Suggestion',
            value: suggestion,
            inline: false
        });
    }

    embed.setFooter({ text: 'If this persists, please use .report to notify the developers.' });

    return embed;
}

/**
 * Wrap async command handlers with error handling
 */
function wrapCommandHandler(handler, commandName) {
    return async (...args) => {
        try {
            return await handler(...args);
        } catch (error) {
            console.error(`Error in command ${commandName}:`, error);
            
            // Try to respond to user
            const interaction = args.find(a => a?.reply || a?.editReply);
            const message = args.find(a => a?.channel?.send);
            
            const errorEmbed = createUserErrorEmbed(error, 'Please try again in a moment.');
            
            if (interaction?.deferred || interaction?.replied) {
                await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
            } else if (interaction?.reply) {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            } else if (message?.reply) {
                await message.reply({ embeds: [errorEmbed] }).catch(() => {});
            }

            throw error; // Re-throw for logging
        }
    };
}

/**
 * Safe interaction reply that handles already replied interactions
 * @param {object} interaction - Discord interaction
 * @param {object} options - Reply options
 * @param {string} context - Context for error logging
 */
async function safeReply(interaction, options, context = 'INTERACTION') {
    try {
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(options);
        } else {
            return await interaction.reply(options);
        }
    } catch (error) {
        console.error(`[${context}] Safe reply failed:`, error.message);
        return null;
    }
}

/**
 * Safe message edit that handles deleted messages
 * @param {object} message - Discord message
 * @param {object} options - Edit options
 * @param {string} context - Context for error logging
 */
async function safeEdit(message, options, context = 'MESSAGE_EDIT') {
    try {
        return await message.edit(options);
    } catch (error) {
        // Only log if it's not a "Unknown Message" error (message was deleted)
        if (!error.message?.includes('Unknown Message')) {
            console.error(`[${context}] Safe edit failed:`, error.message);
        }
        return null;
    }
}

/**
 * Safe JSON parse with error handling
 * @param {string} str - String to parse
 * @param {any} fallback - Fallback value on error
 * @param {string} context - Context for error logging
 * @returns {any} Parsed object or fallback
 */
function safeJsonParse(str, fallback = null, context = 'JSON_PARSE') {
    try {
        return JSON.parse(str);
    } catch (error) {
        console.error(`[${context}] JSON parse failed:`, error.message);
        return fallback;
    }
}

/**
 * Create an error handler for catch blocks that logs instead of swallowing
 * @param {string} context - Context identifier
 * @param {object} metadata - Additional metadata to log
 * @returns {Function} Error handler function
 */
function createCatchHandler(context, metadata = {}) {
    return (error) => {
        const metaStr = Object.keys(metadata).length > 0 
            ? ` | ${JSON.stringify(metadata)}` 
            : '';
        console.error(`[${context}] Caught error${metaStr}:`, error.message);
    };
}

/**
 * Get error statistics
 * @returns {object} Error stats
 */
function getErrorStats() {
    const stats = {
        total: 0,
        uniqueErrors: ERROR_COUNTS.size,
        topErrors: []
    };
    
    const now = Date.now();
    for (const [key, data] of ERROR_COUNTS) {
        // Only count recent errors (last minute)
        if (now - data.firstSeen <= 60000) {
            stats.total += data.count;
            stats.topErrors.push({ error: key, count: data.count });
        }
    }
    
    stats.topErrors.sort((a, b) => b.count - a.count);
    stats.topErrors = stats.topErrors.slice(0, 5);
    
    return stats;
}

module.exports = {
    initializeErrorHandlers,
    handleError,
    registerRecoveryStrategy,
    gracefulShutdown,
    createUserErrorEmbed,
    wrapCommandHandler,
    safeReply,
    safeEdit,
    safeJsonParse,
    createCatchHandler,
    getErrorStats
};