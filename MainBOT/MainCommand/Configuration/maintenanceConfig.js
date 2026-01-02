const fs = require('fs');
const path = require('path');

const MAINTENANCE_FILE = path.join(__dirname, 'maintenanceState.json');

// Default state
let maintenanceState = {
    enabled: false,
    reason: null,
    startTime: null,
    estimatedEnd: null,
    allowedUsers: [], // Users who can bypass maintenance
    partialMode: false, // If true, only some features are disabled
    disabledFeatures: [], // List of disabled features in partial mode
    scheduledMaintenance: null // Future scheduled maintenance
};

// Load state from file
function loadMaintenanceState() {
    try {
        if (fs.existsSync(MAINTENANCE_FILE)) {
            const data = JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8'));
            maintenanceState = { ...maintenanceState, ...data };
        }
    } catch (error) {
        console.error('Failed to load maintenance state:', error.message);
    }
    return maintenanceState;
}

// Save state to file
function saveMaintenanceState() {
    try {
        fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(maintenanceState, null, 2));
    } catch (error) {
        console.error('Failed to save maintenance state:', error.message);
    }
}

// Initialize
loadMaintenanceState();

const developerID = "1128296349566251068";

// Legacy compatibility
const maintenance = maintenanceState.enabled ? "yes" : "no";

/**
 * Enable maintenance mode
 */
function enableMaintenance(options = {}) {
    maintenanceState = {
        ...maintenanceState,
        enabled: true,
        reason: options.reason || 'Scheduled maintenance',
        startTime: Date.now(),
        estimatedEnd: options.estimatedEnd || null,
        partialMode: options.partialMode || false,
        disabledFeatures: options.disabledFeatures || []
    };
    saveMaintenanceState();
    return maintenanceState;
}

/**
 * Disable maintenance mode
 */
function disableMaintenance() {
    maintenanceState = {
        ...maintenanceState,
        enabled: false,
        reason: null,
        startTime: null,
        estimatedEnd: null,
        partialMode: false,
        disabledFeatures: []
    };
    saveMaintenanceState();
    return maintenanceState;
}

/**
 * Check if user can bypass maintenance
 */
function canBypassMaintenance(userId) {
    return userId === developerID || maintenanceState.allowedUsers.includes(userId);
}

/**
 * Check if a specific feature is disabled
 */
function isFeatureDisabled(featureName) {
    if (!maintenanceState.enabled) return false;
    if (!maintenanceState.partialMode) return true; // All features disabled
    return maintenanceState.disabledFeatures.includes(featureName);
}

/**
 * Add user to maintenance bypass list
 */
function addBypassUser(userId) {
    if (!maintenanceState.allowedUsers.includes(userId)) {
        maintenanceState.allowedUsers.push(userId);
        saveMaintenanceState();
    }
}

/**
 * Remove user from maintenance bypass list
 */
function removeBypassUser(userId) {
    maintenanceState.allowedUsers = maintenanceState.allowedUsers.filter(id => id !== userId);
    saveMaintenanceState();
}

/**
 * Schedule future maintenance
 */
function scheduleMaintenance(startTime, options = {}) {
    maintenanceState.scheduledMaintenance = {
        startTime,
        ...options
    };
    saveMaintenanceState();
    return maintenanceState.scheduledMaintenance;
}

/**
 * Get maintenance status for display
 */
function getMaintenanceStatus() {
    const state = maintenanceState;
    
    if (!state.enabled) {
        return {
            active: false,
            message: null
        };
    }

    let timeInfo = '';
    if (state.estimatedEnd) {
        const remaining = state.estimatedEnd - Date.now();
        if (remaining > 0) {
            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            timeInfo = `\n⏰ Estimated completion: ${hours}h ${minutes}m`;
        }
    }

    return {
        active: true,
        message: `🚧 **Maintenance Mode Active**\n\n${state.reason || 'The bot is undergoing maintenance.'}${timeInfo}\n\nThank you for your patience!`,
        partialMode: state.partialMode,
        disabledFeatures: state.disabledFeatures
    };
}

/**
 * Create maintenance embed
 */
function createMaintenanceEmbed() {
    const { EmbedBuilder } = require('discord.js');
    const status = getMaintenanceStatus();
    
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🚧 Maintenance Mode')
        .setDescription(status.message || 'The bot is currently in maintenance mode.')
        .setFooter({ text: "FumoBOT's Developer: alterGolden" })
        .setTimestamp();

    if (maintenanceState.estimatedEnd) {
        embed.addFields({
            name: '⏰ Estimated End',
            value: `<t:${Math.floor(maintenanceState.estimatedEnd / 1000)}:R>`,
            inline: true
        });
    }

    if (maintenanceState.partialMode && maintenanceState.disabledFeatures.length > 0) {
        embed.addFields({
            name: '🔧 Disabled Features',
            value: maintenanceState.disabledFeatures.join(', '),
            inline: false
        });
    }

    return embed;
}

module.exports = {
    maintenance,
    developerID,
    enableMaintenance,
    disableMaintenance,
    canBypassMaintenance,
    isFeatureDisabled,
    addBypassUser,
    removeBypassUser,
    scheduleMaintenance,
    getMaintenanceStatus,
    createMaintenanceEmbed,
    getState: () => maintenanceState
};