const fs = require('fs');
const path = require('path');

const MAINTENANCE_FILE = path.join(__dirname, 'maintenanceState.json');

// Default state - now supports both MainCommand and SubCommand
let maintenanceState = {
    // MainCommand maintenance (Fumo game, trading, etc.)
    main: {
        enabled: false,
        reason: "MainCommand maintenance",
        startTime: null,
        estimatedEnd: null,
        partialMode: false,
        disabledFeatures: []
    },
    // SubCommand maintenance (Reddit, Music, Video, etc.)
    sub: {
        enabled: false,
        reason: "SubCommand maintenance",
        startTime: null,
        estimatedEnd: null,
        partialMode: false,
        disabledFeatures: []
    },
    allowedUsers: [], // Users who can bypass ALL maintenance
    scheduledMaintenance: null
};

// Load state from file
function loadMaintenanceState() {
    try {
        if (fs.existsSync(MAINTENANCE_FILE)) {
            const data = JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8'));
            // Handle migration from old format
            if (data.enabled !== undefined && data.main === undefined) {
                // Old format - migrate to new
                maintenanceState.main.enabled = data.enabled;
                maintenanceState.main.reason = data.reason;
                maintenanceState.main.startTime = data.startTime;
                maintenanceState.main.estimatedEnd = data.estimatedEnd;
                maintenanceState.main.partialMode = data.partialMode || false;
                maintenanceState.main.disabledFeatures = data.disabledFeatures || [];
                maintenanceState.allowedUsers = data.allowedUsers || [];
                maintenanceState.scheduledMaintenance = data.scheduledMaintenance;
                saveMaintenanceState(); // Save in new format
            } else {
                maintenanceState = { ...maintenanceState, ...data };
            }
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

// Legacy compatibility (checks MainCommand)
const maintenance = maintenanceState.main.enabled ? "yes" : "no";

/**
 * Enable maintenance mode
 * @param {string} system - 'main' or 'sub' (default: 'main')
 * @param {Object} options - Maintenance options
 */
function enableMaintenance(system = 'main', options = {}) {
    const target = system === 'sub' ? maintenanceState.sub : maintenanceState.main;
    
    target.enabled = true;
    target.reason = options.reason || `${system === 'sub' ? 'SubCommand' : 'MainCommand'} maintenance`;
    target.startTime = Date.now();
    target.estimatedEnd = options.estimatedEnd || null;
    target.partialMode = options.partialMode || false;
    target.disabledFeatures = options.disabledFeatures || [];
    
    saveMaintenanceState();
    return target;
}

/**
 * Disable maintenance mode
 * @param {string} system - 'main' or 'sub' (default: 'main')
 */
function disableMaintenance(system = 'main') {
    const target = system === 'sub' ? maintenanceState.sub : maintenanceState.main;
    
    target.enabled = false;
    target.reason = null;
    target.startTime = null;
    target.estimatedEnd = null;
    target.partialMode = false;
    target.disabledFeatures = [];
    
    saveMaintenanceState();
    return target;
}

/**
 * Check if user can bypass maintenance
 */
function canBypassMaintenance(userId) {
    return userId === developerID || maintenanceState.allowedUsers.includes(userId);
}

/**
 * Check if a specific feature is disabled
 * @param {string} featureName - Feature to check
 * @param {string} system - 'main' or 'sub' (default: 'main')
 */
function isFeatureDisabled(featureName, system = 'main') {
    const target = system === 'sub' ? maintenanceState.sub : maintenanceState.main;
    
    if (!target.enabled) return false;
    if (!target.partialMode) return true; // All features disabled
    return target.disabledFeatures.includes(featureName);
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
 * @param {string} system - 'main', 'sub', or 'both' (default: 'main')
 */
function getMaintenanceStatus(system = 'main') {
    if (system === 'both') {
        return {
            main: getMaintenanceStatus('main'),
            sub: getMaintenanceStatus('sub'),
            bothDown: maintenanceState.main.enabled && maintenanceState.sub.enabled
        };
    }
    
    const state = system === 'sub' ? maintenanceState.sub : maintenanceState.main;
    const systemName = system === 'sub' ? 'SubCommand' : 'MainCommand';
    
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
        enabled: state.enabled,
        reason: state.reason,
        estimatedEnd: state.estimatedEnd,
        message: `🚧 **${systemName} Maintenance Active**\n\n${state.reason || `${systemName} is undergoing maintenance.`}${timeInfo}\n\nThank you for your patience!`,
        partialMode: state.partialMode,
        disabledFeatures: state.disabledFeatures
    };
}

/**
 * Create maintenance embed
 * @param {string} system - 'main' or 'sub' (default: 'main')
 */
function createMaintenanceEmbed(system = 'main') {
    const { EmbedBuilder } = require('discord.js');
    const status = getMaintenanceStatus(system);
    const state = system === 'sub' ? maintenanceState.sub : maintenanceState.main;
    const systemName = system === 'sub' ? 'SubCommand' : 'MainCommand';
    
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle(`🚧 ${systemName} Maintenance`)
        .setDescription(status.message || `${systemName} is currently in maintenance mode.`)
        .setFooter({ text: "FumoBOT's Developer: alterGolden" })
        .setTimestamp();

    if (state.estimatedEnd) {
        embed.addFields({
            name: '⏰ Estimated End',
            value: `<t:${Math.floor(state.estimatedEnd / 1000)}:R>`,
            inline: true
        });
    }

    if (state.partialMode && state.disabledFeatures.length > 0) {
        embed.addFields({
            name: '🔧 Disabled Features',
            value: state.disabledFeatures.join(', '),
            inline: false
        });
    }

    return embed;
}

/**
 * Check if a system is in maintenance
 * @param {string} system - 'main' or 'sub'
 */
function isInMaintenance(system = 'main') {
    const target = system === 'sub' ? maintenanceState.sub : maintenanceState.main;
    return target.enabled;
}

/**
 * Get the full state object
 */
function getState() {
    return { ...maintenanceState };
}

/**
 * Get state for a specific system
 * @param {string} system - 'main' or 'sub'
 */
function getSystemState(system = 'main') {
    return system === 'sub' ? { ...maintenanceState.sub } : { ...maintenanceState.main };
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
    isInMaintenance,
    getState,
    getSystemState
};