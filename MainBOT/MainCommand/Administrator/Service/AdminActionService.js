/**
 * Admin Action Service
 * Handles admin operations like adding items, fumos, and currency
 */

const db = require('../../Core/Database/dbSetting');
const FumoPool = require('../../Data/FumoPool');
const { RARITY_PRIORITY } = require('../../Configuration/rarity');
const { SEASONS, WEATHER_EVENTS, getSeasonDescription, getWeatherDuration } = require('../../Configuration/seasonConfig');
const { forceWeatherEvent, stopWeatherEvent } = require('../../Service/FarmingService/SeasonService/SeasonManagerService');
const { ITEM_RARITIES, FUMO_TRAITS, CURRENCY_TYPES, isAdmin } = require('../Config/adminConfig');
const { parseAmount } = require('../Utils/adminUtils');

// In-memory stores for pending operations
const pendingActions = new Map();
const pendingCurrency = new Map();

// ═══════════════════════════════════════════════════════════════
// PENDING ACTION MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Store pending action
 * @param {string} adminId - Admin user ID
 * @param {Object} action - Action data
 */
function storePendingAction(adminId, action) {
    pendingActions.set(adminId, action);
}

/**
 * Get pending action
 * @param {string} adminId - Admin user ID
 * @returns {Object|undefined} - Action data
 */
function getPendingAction(adminId) {
    return pendingActions.get(adminId);
}

/**
 * Remove pending action
 * @param {string} adminId - Admin user ID
 */
function removePendingAction(adminId) {
    pendingActions.delete(adminId);
}

/**
 * Store pending currency operation
 * @param {string} adminId - Admin user ID
 * @param {Object} data - Currency operation data
 */
function storePendingCurrency(adminId, data) {
    pendingCurrency.set(adminId, data);
}

/**
 * Get pending currency operation
 * @param {string} adminId - Admin user ID
 * @returns {Object|undefined} - Currency operation data
 */
function getPendingCurrency(adminId) {
    return pendingCurrency.get(adminId);
}

/**
 * Remove pending currency operation
 * @param {string} adminId - Admin user ID
 */
function removePendingCurrency(adminId) {
    pendingCurrency.delete(adminId);
}

// ═══════════════════════════════════════════════════════════════
// ITEM OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Add item to user inventory
 * @param {string} userId - Target user ID
 * @param {string} itemName - Full item name with rarity
 * @param {number} quantity - Quantity to add
 * @returns {Promise<Object>} - Result object
 */
function addItemToUser(userId, itemName, quantity) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)
             ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
            [userId, itemName, quantity, quantity],
            function(err) {
                if (err) {
                    console.error('Error adding item:', err);
                    return reject({ success: false, error: err.message });
                }
                resolve({ success: true, itemName, quantity });
            }
        );
    });
}

/**
 * Get item rarities for select menu
 * @returns {Array} - Array of rarity options
 */
function getItemRarities() {
    return ITEM_RARITIES;
}

/**
 * Build full item name with rarity
 * @param {string} baseName - Base item name
 * @param {string} rarity - Rarity suffix
 * @returns {string} - Full item name
 */
function buildItemName(baseName, rarity) {
    return `${baseName}(${rarity})`;
}

// ═══════════════════════════════════════════════════════════════
// FUMO OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Add fumo to user inventory
 * @param {string} userId - Target user ID
 * @param {string} fumoName - Full fumo name with rarity and trait
 * @param {number} quantity - Quantity to add
 * @returns {Promise<Object>} - Result object
 */
function addFumoToUser(userId, fumoName, quantity) {
    return new Promise((resolve, reject) => {
        // Extract rarity from fumo name
        const rarityMatch = fumoName.match(/\((.*?)\)/);
        const rarity = rarityMatch ? rarityMatch[1] : 'Common';
        
        // First check if this fumo already exists in user's inventory
        db.get(
            `SELECT id, quantity as existingQty FROM userInventory WHERE userId = ? AND fumoName = ?`,
            [userId, fumoName],
            (err, row) => {
                if (err) {
                    console.error('Error checking inventory:', err);
                    return reject({ success: false, error: err.message });
                }
                
                if (row) {
                    // Fumo exists, update quantity
                    db.run(
                        `UPDATE userInventory SET quantity = quantity + ? WHERE id = ?`,
                        [quantity, row.id],
                        function(updateErr) {
                            if (updateErr) {
                                console.error('Error updating fumo quantity:', updateErr);
                                reject({ success: false, error: updateErr.message });
                            } else {
                                resolve({ success: true, fumoName, quantity, action: 'updated' });
                            }
                        }
                    );
                } else {
                    // Fumo doesn't exist, insert new row
                    db.run(
                        `INSERT INTO userInventory (userId, fumoName, quantity, rarity) VALUES (?, ?, ?, ?)`,
                        [userId, fumoName, quantity, rarity],
                        function(insertErr) {
                            if (insertErr) {
                                console.error('Error adding fumo:', insertErr);
                                reject({ success: false, error: insertErr.message });
                            } else {
                                resolve({ success: true, fumoName, quantity, action: 'inserted' });
                            }
                        }
                    );
                }
            }
        );
    });
}

/**
 * Get fumo rarities for select menu
 * @returns {Array} - Array of rarity options
 */
function getFumoRarities() {
    return RARITY_PRIORITY.map(rarity => ({
        label: rarity,
        value: rarity
    })).slice(0, 25);
}

/**
 * Get fumos by rarity
 * @param {string} rarity - Rarity to filter by
 * @returns {Array} - Array of fumo objects
 */
function getFumosByRarity(rarity) {
    const allFumos = FumoPool.getRaw();
    return allFumos.filter(fumo => fumo.rarity === rarity);
}

/**
 * Get fumo traits for select menu
 * @returns {Array} - Array of trait options
 */
function getFumoTraits() {
    return FUMO_TRAITS;
}

/**
 * Build full fumo name with rarity and trait
 * @param {string} baseName - Base fumo name
 * @param {string} rarity - Rarity
 * @param {string} trait - Trait value ('normal', 'shiny', 'alg')
 * @returns {string} - Full fumo name
 */
function buildFumoName(baseName, rarity, trait) {
    let fullName = `${baseName}(${rarity})`;
    
    const traitConfig = FUMO_TRAITS.find(t => t.value === trait);
    if (traitConfig && traitConfig.suffix) {
        fullName += traitConfig.suffix;
    }
    
    return fullName;
}

// ═══════════════════════════════════════════════════════════════
// CURRENCY OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Add currency to user
 * @param {string} userId - Target user ID
 * @param {string} currencyType - 'coins' or 'gems'
 * @param {number} amount - Amount to add
 * @returns {Promise<Object>} - Result object
 */
function addCurrencyToUser(userId, currencyType, amount) {
    return new Promise((resolve, reject) => {
        const column = currencyType === 'coins' ? 'coins' : 'gems';
        const coinValue = currencyType === 'coins' ? amount : 0;
        const gemValue = currencyType === 'gems' ? amount : 0;
        
        db.run(
            `INSERT INTO userCoins (userId, coins, gems) VALUES (?, ?, ?)
             ON CONFLICT(userId) DO UPDATE SET ${column} = ${column} + ?`,
            [userId, coinValue, gemValue, amount],
            function(err) {
                if (err) {
                    console.error('Error adding currency:', err);
                    return reject({ success: false, error: err.message });
                }
                resolve({ success: true, currencyType, amount });
            }
        );
    });
}

/**
 * Get currency types for select menu
 * @returns {Array} - Array of currency type options
 */
function getCurrencyTypes() {
    return CURRENCY_TYPES;
}

/**
 * Get currency info by type
 * @param {string} type - Currency type
 * @returns {Object} - Currency info
 */
function getCurrencyInfo(type) {
    return CURRENCY_TYPES.find(c => c.value === type);
}

// ═══════════════════════════════════════════════════════════════
// WEATHER OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get all available weather events
 * @returns {Array} - Array of weather event names
 */
function getWeatherEvents() {
    return WEATHER_EVENTS;
}

/**
 * Get weather event info
 * @param {string} weatherName - Weather event name
 * @returns {Object|null} - Weather event info
 */
function getWeatherInfo(weatherName) {
    if (!WEATHER_EVENTS.includes(weatherName)) return null;
    
    const season = SEASONS[weatherName];
    return {
        name: weatherName,
        ...season,
        description: getSeasonDescription(weatherName),
        defaultDuration: getWeatherDuration(weatherName)
    };
}

/**
 * Start a weather event
 * @param {string} weatherName - Weather event name
 * @param {number} durationMinutes - Duration in minutes (optional)
 * @param {Client} client - Discord client
 * @returns {Promise<Object>} - Result object
 */
async function startWeather(weatherName, durationMinutes, client) {
    if (!WEATHER_EVENTS.includes(weatherName)) {
        return { success: false, error: 'Invalid weather type' };
    }
    
    let duration = getWeatherDuration(weatherName);
    if (durationMinutes && !isNaN(durationMinutes) && durationMinutes > 0 && durationMinutes <= 10080) {
        duration = durationMinutes * 60 * 1000;
    }
    
    const result = await forceWeatherEvent(weatherName, duration, client);
    
    if (!result.success) {
        return { success: false, error: 'Failed to start weather event' };
    }
    
    const season = SEASONS[weatherName];
    return {
        success: true,
        weatherName,
        duration,
        durationMinutes: Math.floor(duration / 60000),
        description: getSeasonDescription(weatherName),
        coinMultiplier: season.coinMultiplier,
        gemMultiplier: season.gemMultiplier
    };
}

/**
 * Stop a weather event
 * @param {string} weatherName - Weather event name
 * @param {Client} client - Discord client
 * @returns {Promise<Object>} - Result object
 */
async function stopWeather(weatherName, client) {
    if (!WEATHER_EVENTS.includes(weatherName)) {
        return { success: false, error: 'Invalid weather type' };
    }
    
    await stopWeatherEvent(weatherName, client);
    return { success: true, weatherName };
}

/**
 * Format weather list for display
 * @returns {string} - Formatted weather list
 */
function formatWeatherList() {
    return WEATHER_EVENTS.map(w => {
        const season = SEASONS[w];
        return `• **${w}** - ${season.emoji} ${season.name}`;
    }).join('\n');
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
    // Pending action management
    storePendingAction,
    getPendingAction,
    removePendingAction,
    storePendingCurrency,
    getPendingCurrency,
    removePendingCurrency,
    
    // Item operations
    addItemToUser,
    getItemRarities,
    buildItemName,
    
    // Fumo operations
    addFumoToUser,
    getFumoRarities,
    getFumosByRarity,
    getFumoTraits,
    buildFumoName,
    
    // Currency operations
    addCurrencyToUser,
    getCurrencyTypes,
    getCurrencyInfo,
    parseAmount,
    
    // Weather operations
    getWeatherEvents,
    getWeatherInfo,
    startWeather,
    stopWeather,
    formatWeatherList
};
