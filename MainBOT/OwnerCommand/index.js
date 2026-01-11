/**
 * Owner Command Module
 * Bot Owner Only Commands - Slash Command Based
 */

// CONFIGURATION

const ownerConfig = require('./Config/ownerConfig');

// SERVICES

const GuildTrackingService = require('./Service/GuildTrackingService');

// COMMANDS (Slash Commands)

const botcheckCommand = require('./Commands/botcheck');
const adminCommand = require('./Commands/admin');
const botbanCommand = require('./Commands/botban');
const ticketCommand = require('./Commands/ticket');

// UTILITIES

const ownerUtils = require('./Utils/ownerUtils');

// GUILD TRACKING

const { 
    initializeGuildTracking,
    sendGuildNotification,
    createGuildJoinEmbed,
    createGuildLeaveEmbed,
    getGuildStatistics,
    createGuildStatsEmbed,
    GUILD_LOG_CHANNEL_ID
} = GuildTrackingService;

// BAN SERVICE EXPORTS

const { isUserBanned } = botbanCommand;

// ALL SLASH COMMANDS

const slashCommands = [
    botcheckCommand,
    adminCommand,
    botbanCommand,
    ticketCommand
].filter(cmd => cmd?.data?.name);

// MODULE EXPORTS

module.exports = {
    // Configuration
    ownerConfig,
    
    // Slash Commands
    slashCommands,
    botcheckCommand,
    adminCommand,
    botbanCommand,
    ticketCommand,
    
    // Guild Tracking
    initializeGuildTracking,
    sendGuildNotification,
    createGuildJoinEmbed,
    createGuildLeaveEmbed,
    getGuildStatistics,
    createGuildStatsEmbed,
    GUILD_LOG_CHANNEL_ID,
    
    // Ban Functions
    isUserBanned,
    isBanned: isUserBanned,
    
    // Utilities
    ownerUtils
};
