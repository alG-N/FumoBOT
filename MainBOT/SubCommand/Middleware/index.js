/**
 * SubCommand Middleware Module
 * Central export file for all middleware functionality
 * 
 * This module provides:
 * - accessControl.js - NEW: Cross-system access control with smart suggestions
 * - Re-exports from MainCommand for convenience (maintenanceConfig, errorHandler)
 * 
 * Usage:
 *   const { checkAccess, AccessType, isBanned } = require('../Middleware');
 *   
 *   // In SubCommand execute:
 *   const access = await checkAccess(interaction, AccessType.SUB);
 *   if (access.blocked) {
 *       return interaction.reply({ embeds: [access.embed], ephemeral: true });
 *   }
 */

// Access Control (NEW - handles cross-system maintenance with suggestions)
const {
    checkAccess,
    checkMainAccess,
    checkSubAccess,
    AccessType,
    isBanned,
    getMaintenanceStatus,
    formatRemainingTime,
    clearCache,
    getCacheStats,
    createBanEmbed,
    createMainMaintenanceEmbed,
    createSubMaintenanceEmbed,
    createBothMaintenanceEmbed
} = require('./accessControl');

// Re-export from MainCommand (no duplication)
const maintenanceConfig = require('../../MainCommand/Configuration/maintenanceConfig');
const errorHandler = require('../../MainCommand/Ultility/errorHandler');

module.exports = {
    // ═══════════════════════════════════════════════════════════════
    // ACCESS CONTROL (NEW)
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Main access check function - checks maintenance & bans with smart suggestions
     * @param {Interaction} interaction - Discord interaction
     * @param {string} accessType - AccessType.MAIN, AccessType.SUB, or AccessType.BOTH
     * @param {Object} options - { useCache: boolean, featureName: string }
     */
    checkAccess,
    
    /** Quick check for MainCommand access */
    checkMainAccess,
    
    /** Quick check for SubCommand access */
    checkSubAccess,
    
    /** Access type constants */
    AccessType,
    
    // ═══════════════════════════════════════════════════════════════
    // BAN FUNCTIONS (from MainCommand)
    // ═══════════════════════════════════════════════════════════════
    
    /** Check if a user is banned (synchronous) */
    isBanned,
    
    // ═══════════════════════════════════════════════════════════════
    // MAINTENANCE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    /** Get maintenance status for both systems */
    getMaintenanceStatus,
    
    /** Full maintenance config module (from MainCommand) */
    maintenanceConfig,
    
    // ═══════════════════════════════════════════════════════════════
    // ERROR HANDLING (from MainCommand)
    // ═══════════════════════════════════════════════════════════════
    
    /** Full error handler module */
    errorHandler,
    
    /** Handle command errors with full logging */
    handleError: errorHandler.handleError,
    
    /** Wrap a command handler with automatic error handling */
    wrapCommandHandler: errorHandler.wrapCommandHandler,
    
    /** Create user-friendly error embed */
    createUserErrorEmbed: errorHandler.createUserErrorEmbed,
    
    /** Register a recovery strategy */
    registerRecoveryStrategy: errorHandler.registerRecoveryStrategy,
    
    // ═══════════════════════════════════════════════════════════════
    // UTILITY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    /** Format remaining time in human readable format */
    formatRemainingTime,
    
    /** Clear access cache */
    clearCache,
    
    /** Get cache statistics */
    getCacheStats,
    
    // ═══════════════════════════════════════════════════════════════
    // EMBED BUILDERS (for custom use)
    // ═══════════════════════════════════════════════════════════════
    
    createBanEmbed,
    createMainMaintenanceEmbed,
    createSubMaintenanceEmbed,
    createBothMaintenanceEmbed
};
