const { EmbedBuilder, Colors } = require('discord.js');
const { checkRestrictions } = require('../Middleware/restrictions');
const path = require('path');

const ERROR_CHANNEL_ID = '1367886953286205530';
let errorCount = 0;
const recentErrors = new Map();

function parseErrorLocation(error) {
    if (!error.stack) {
        return {
            file: 'Unknown',
            line: '?',
            column: '?',
            function: 'Unknown',
            fullPath: 'Unknown'
        };
    }
    
    const stackLines = error.stack.split('\n');
    
    const relevantLine = stackLines.find(line => {
        return line.includes(process.cwd()) && 
               !line.includes('node_modules') &&
               !line.includes('internal/');
    });
    
    if (!relevantLine) {
        return {
            file: 'Unknown',
            line: '?',
            column: '?',
            function: 'Unknown',
            fullPath: stackLines[1] || 'No stack trace'
        };
    }
    
    const match = relevantLine.match(/at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?/);
    
    if (!match) {
        return {
            file: 'Parse Error',
            line: '?',
            column: '?',
            function: 'Unknown',
            fullPath: relevantLine.trim()
        };
    }
    
    const [, functionName, fullPath, line, column] = match;
    const file = path.relative(process.cwd(), fullPath);
    
    return {
        file: file || path.basename(fullPath),
        line: line || '?',
        column: column || '?',
        function: functionName?.trim() || 'Anonymous',
        fullPath: fullPath
    };
}

function formatEnhancedError(error) {
    const location = parseErrorLocation(error);
    
    let formatted = `**Error Type:** ${error.name || 'Error'}\n`;
    formatted += `**Message:** ${error.message || 'No message'}\n\n`;
    
    formatted += `**📍 Location:**\n`;
    formatted += `• File: \`${location.file}\`\n`;
    formatted += `• Line: \`${location.line}\` Column: \`${location.column}\`\n`;
    formatted += `• Function: \`${location.function}\`\n\n`;
    
    if (error.stack) {
        const stackLines = error.stack.split('\n').slice(1, 6); 
        formatted += `**Stack Trace:**\n\`\`\`\n${stackLines.join('\n')}\n\`\`\``;
    }
    
    return formatted;
}

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
        rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`
    };
}

function isDuplicateError(errorKey) {
    const now = Date.now();
    const lastOccurrence = recentErrors.get(errorKey);
    
    if (lastOccurrence && (now - lastOccurrence) < 300000) {
        return true;
    }
    
    recentErrors.set(errorKey, now);
    
    for (const [key, timestamp] of recentErrors.entries()) {
        if (now - timestamp > 300000) {
            recentErrors.delete(key);
        }
    }
    
    return false;
}

function logToConsole(prefix, error) {
    const location = parseErrorLocation(error);
    const timestamp = new Date().toISOString();
    
    console.error(`\n${'='.repeat(80)}`);
    console.error(`🟥 [${timestamp}] ${prefix}`);
    console.error(`${'='.repeat(80)}`);
    console.error(`📍 Location: ${location.file}:${location.line}:${location.column}`);
    console.error(`🔧 Function: ${location.function}`);
    console.error(`⚠️  Error Type: ${error.name}`);
    console.error(`💬 Message: ${error.message}`);
    console.error(`\n📚 Stack Trace:`);
    console.error(error.stack || 'No stack trace available');
    console.error(`${'='.repeat(80)}\n`);
}

async function sendErrorEmbed(client, prefix, error, context = {}) {
    try {
        if (!client?.channels?.fetch) return;
        
        const location = parseErrorLocation(error);
        const errorKey = `${location.file}:${location.line}:${error.message}`;
        
        if (isDuplicateError(errorKey)) {
            console.log('⏭️  Skipping duplicate error notification');
            return;
        }

        const channel = await client.channels.fetch(ERROR_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const formatted = formatEnhancedError(error).slice(0, 4000);
        const uptime = formatUptime(process.uptime() * 1000);
        const memory = getMemoryUsage();
        const guilds = client.guilds.cache.size;
        const users = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

        const embed = new EmbedBuilder()
            .setTitle(`🟥 ${prefix}`)
            .setColor(Colors.Red)
            .addFields(
                {
                    name: '📍 Error Location',
                    value: `**File:** \`${location.file}\`\n**Line:** \`${location.line}:${location.column}\`\n**Function:** \`${location.function}\``,
                    inline: false
                },
                {
                    name: '⚠️ Error Details',
                    value: `**Type:** ${error.name}\n**Message:** ${error.message.slice(0, 200)}`,
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({ text: `Error #${errorCount} • ${client.user?.username || 'Bot'}` });
        
        if (error.stack) {
            const stackPreview = error.stack.split('\n').slice(1, 4).join('\n');
            if (stackPreview.length < 1000) {
                embed.addFields({
                    name: '📚 Stack Trace Preview',
                    value: `\`\`\`js\n${stackPreview}\n\`\`\``,
                    inline: false
                });
            }
        }
        
        if (Object.keys(context).length > 0) {
            const contextStr = Object.entries(context)
                .map(([key, value]) => `• **${key}:** ${value}`)
                .join('\n')
                .slice(0, 1000);
            
            embed.addFields({
                name: '🔍 Context',
                value: contextStr,
                inline: false
            });
        }
        
        embed.addFields(
            {
                name: '⏱️ System Info',
                value: `**Uptime:** ${uptime}\n**Servers:** ${guilds.toLocaleString()}\n**Users:** ${users.toLocaleString()}`,
                inline: true
            },
            {
                name: '💾 Memory Usage',
                value: `**Heap:** ${memory.heapUsed} / ${memory.heapTotal}\n**RSS:** ${memory.rss}`,
                inline: true
            }
        );

        await channel.send({ embeds: [embed] });

    } catch (sendErr) {
        console.error('🟥 Failed to send error embed to Discord:', sendErr.message);
    }
}

function incrementErrorCount() {
    errorCount++;
}

function getErrorCount() {
    return errorCount;
}

function resetErrorCount() {
    errorCount = 0;
}

function getErrorStats() {
    return {
        total: errorCount,
        recentUnique: recentErrors.size,
        memory: getMemoryUsage(),
        uptime: formatUptime(process.uptime() * 1000)
    };
}

function createErrorStatsEmbed() {
    const stats = getErrorStats();
    
    const embed = new EmbedBuilder()
        .setTitle('🟠 Error Statistics')
        .setColor(Colors.Orange)
        .addFields(
            {
                name: '📊 Error Counts',
                value: `**Total since restart:** ${stats.total}\n**Unique recent errors:** ${stats.recentUnique}`,
                inline: true
            },
            {
                name: '⏱️ System Status',
                value: `**Uptime:** ${stats.uptime}`,
                inline: true
            },
            {
                name: '💾 Memory Usage',
                value: `**Heap Used:** ${stats.memory.heapUsed}\n**RSS:** ${stats.memory.rss}\n**External:** ${stats.memory.external}`,
                inline: false
            }
        )
        .setFooter({ text: 'Error tracking system' })
        .setTimestamp();
    
    return embed;
}

async function handleErrorStats(message) {
    const ADMIN_IDS = ['1128296349566251068', '1362450043939979378'];
    
    if (!ADMIN_IDS.includes(message.author.id)) {
        return message.reply('❌ You do not have permission to view error statistics.');
    }

    const embed = createErrorStatsEmbed();
    await message.reply({ embeds: [embed] });
}

function initializeErrorHandlers(client) {
    process.on('unhandledRejection', async (reason, promise) => {
        incrementErrorCount();
        logToConsole('Unhandled Promise Rejection', reason);
        await sendErrorEmbed(client, 'Unhandled Promise Rejection', reason, {
            'Promise': promise.toString().slice(0, 100)
        });
    });

    process.on('uncaughtException', async (error) => {
        incrementErrorCount();
        logToConsole('Uncaught Exception', error);
        await sendErrorEmbed(client, 'Uncaught Exception', error);
        
        setTimeout(() => {
            console.error('💀 Exiting due to uncaught exception...');
            process.exit(1);
        }, 1000);
    });

    process.on('warning', (warning) => {
        console.warn('⚠️  Node Warning:', warning.name);
        console.warn('   Message:', warning.message);
        console.warn('   Stack:', warning.stack);
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        const commands = ['.errorstats', '.errors', '.clearerrors'];
        if (!commands.some(cmd => message.content.trim().startsWith(cmd))) return;
        
        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }
        
        const ADMIN_IDS = ['1128296349566251068', '1362450043939979378'];
        if (!ADMIN_IDS.includes(message.author.id)) {
            return message.reply('❌ You do not have permission to use admin commands.');
        }
        
        if (message.content.trim() === '.errorstats' || message.content.trim() === '.errors') {
            await handleErrorStats(message);
        } else if (message.content.trim() === '.clearerrors') {
            const oldCount = errorCount;
            resetErrorCount();
            recentErrors.clear();
            
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('✅ Error Stats Cleared')
                        .setDescription(`Cleared ${oldCount} error records and ${recentErrors.size} recent error cache.`)
                        .setColor(Colors.Green)
                ]
            });
        }
    });

    console.log('✅ Enhanced error handlers initialized');
    console.log(`   - Error channel: ${ERROR_CHANNEL_ID}`);
    console.log(`   - File & line tracking: Enabled`);
    console.log(`   - Duplicate prevention: Enabled (5min window)`);
}

async function logError(client, context, error, additionalContext = {}) {
    incrementErrorCount();
    logToConsole(context, error);
    await sendErrorEmbed(client, context, error, additionalContext);
}

module.exports = {
    initializeErrorHandlers,
    logError,
    formatEnhancedError,
    parseErrorLocation,
    formatUptime,
    getErrorCount,
    resetErrorCount,
    incrementErrorCount,
    getErrorStats,
    createErrorStatsEmbed,
    ERROR_CHANNEL_ID
};