/**
 * Administrator Module
 * Central export file for all admin-related functionality
 * 
 * Directory Structure:
 * Administrator/
 * ├── index.js              - This file (main exports)
 * ├── Config/
 * │   └── adminConfig.js    - Configuration constants
 * ├── Service/
 * │   ├── BanService.js     - Ban management logic
 * │   ├── TicketService.js  - Ticket management logic
 * │   ├── GuildTrackingService.js - Guild tracking logic
 * │   └── AdminActionService.js   - Admin action logic
 * ├── Command/
 * │   ├── adminCommands.js  - Item/Fumo/Currency commands
 * │   ├── banCommands.js    - Ban/Unban commands
 * │   ├── ticketCommands.js - Ticket system commands
 * │   └── migratePetsCommand.js - Pet migration command
 * ├── Utils/
 * │   └── adminUtils.js     - Shared utilities
 * └── Data/
 *     ├── BannedList/
 *     │   └── Banned.json   - Ban list data
 *     └── ticketCounter.txt - Ticket counter
 */

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const adminConfig = require('./Config/adminConfig');

// ═══════════════════════════════════════════════════════════════
// SERVICES
// ═══════════════════════════════════════════════════════════════

const BanService = require('./Service/BanService');
const TicketService = require('./Service/TicketService');
const GuildTrackingService = require('./Service/GuildTrackingService');
const AdminActionService = require('./Service/AdminActionService');

// ═══════════════════════════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════════════════════════

const { registerAdminCommands, ALLOWED_ADMINS } = require('./Command/adminCommands');
const { registerBanSystem, banUser, unbanUser, isUserBanned, parseDuration } = require('./Command/banCommands');
const { registerTicketSystem, initializeTicketSystem, incrementTicketCounter } = require('./Command/ticketCommands');
const migratePetsCommand = require('./Command/migratePetsCommand');
const botCheckCommand = require('./Command/botCheckCommand');

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

const adminUtils = require('./Utils/adminUtils');

// ═══════════════════════════════════════════════════════════════
// GUILD TRACKING
// ═══════════════════════════════════════════════════════════════

const { 
    initializeGuildTracking,
    sendGuildNotification,
    createGuildJoinEmbed,
    createGuildLeaveEmbed,
    getGuildStatistics,
    createGuildStatsEmbed,
    GUILD_LOG_CHANNEL_ID
} = GuildTrackingService;

// ═══════════════════════════════════════════════════════════════
// BAN SERVICE EXPORTS (for backward compatibility)
// ═══════════════════════════════════════════════════════════════

const { isBanned } = BanService;

// ═══════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
    // Configuration
    adminConfig,
    ALLOWED_ADMINS,
    
    // Command Registration
    registerAdminCommands,
    registerBanSystem,
    registerTicketSystem,
    migratePetsCommand,
    botCheckCommand,
    
    // Guild Tracking
    initializeGuildTracking,
    sendGuildNotification,
    createGuildJoinEmbed,
    createGuildLeaveEmbed,
    getGuildStatistics,
    createGuildStatsEmbed,
    GUILD_LOG_CHANNEL_ID,
    
    // Ban Functions
    banUser,
    unbanUser,
    isUserBanned,
    isBanned,
    parseDuration,
    
    // Ticket Functions
    initializeTicketSystem,
    incrementTicketCounter,
    
    // Services (for advanced usage)
    BanService,
    TicketService,
    GuildTrackingService,
    AdminActionService,
    
    // Utilities
    adminUtils
};
