/**
 * SubCommand/Administrator Module
 * Server Administrator Commands (Server Owner & Authorized Roles)
 * 
 * Commands:
 * - /setting  - Server owner settings configuration
 * - /snipe    - Deleted message recovery
 * - /kick     - Kick users from server
 * - /mute     - Mute users (timeout)
 * - /ban      - Ban users from server
 * - /delete   - Bulk delete messages
 */

// COMMANDS

const settingCommand = require('./Commands/setting');
const snipeCommand = require('./Commands/snipe');
const kickCommand = require('./Commands/kick');
const muteCommand = require('./Commands/mute');
const banCommand = require('./Commands/ban');
const deleteCommand = require('./Commands/delete');

// SERVICES

const GuildSettingsService = require('./Service/GuildSettingsService');
const SnipeService = require('./Service/SnipeService');
const ModerationService = require('./Service/ModerationService');

// CONFIGURATION

const adminConfig = require('./Config/adminConfig');

// ALL SLASH COMMANDS

const slashCommands = [
    settingCommand,
    snipeCommand,
    kickCommand,
    muteCommand,
    banCommand,
    deleteCommand
].filter(cmd => cmd?.data?.name);

// EXPORTS

module.exports = {
    // Commands
    slashCommands,
    settingCommand,
    snipeCommand,
    kickCommand,
    muteCommand,
    banCommand,
    deleteCommand,
    
    // Services
    GuildSettingsService,
    SnipeService,
    ModerationService,
    
    // Configuration
    adminConfig,
    
    // Quick access
    initializeSnipeService: SnipeService.initialize,
    getGuildSettings: GuildSettingsService.getGuildSettings,
    updateGuildSettings: GuildSettingsService.updateGuildSettings
};
