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

    console.log('✅ Error handlers initialized');
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

module.exports = {
    initializeErrorHandlers,
    handleError,
    registerRecoveryStrategy,
    gracefulShutdown,
    createUserErrorEmbed,
    wrapCommandHandler
};