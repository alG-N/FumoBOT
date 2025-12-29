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
        db.get(
            `SELECT * FROM userInventory WHERE userId = ? AND itemName = ?`,
            [userId, itemName],
            (err, row) => {
                if (err) {
                    return reject({ success: false, error: err.message });
                }
                
                const query = row
                    ? `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`
                    : `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)`;
                
                const params = row
                    ? [quantity, userId, itemName]
                    : [userId, itemName, quantity];
                
                db.run(query, params, function(err) {
                    if (err) {
                        return reject({ success: false, error: err.message });
                    }
                    resolve({ success: true, itemName, quantity });
                });
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
        const insertPromises = [];
        
        for (let i = 0; i < quantity; i++) {
            insertPromises.push(
                new Promise((res, rej) => {
                    db.run(
                        `INSERT INTO userInventory (userId, fumoName) VALUES (?, ?)`,
                        [userId, fumoName],
                        function(err) {
                            if (err) {
                                console.error('Error adding fumo:', err);
                                rej(err);
                            } else {
                                res();
                            }
                        }
                    );
                })
            );
        }
        
        Promise.all(insertPromises)
            .then(() => resolve({ success: true, fumoName, quantity }))
            .catch(err => reject({ success: false, error: err.message }));
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
        
        db.get(
            `SELECT ${column} FROM userCoins WHERE userId = ?`,
            [userId],
            (err, row) => {
                if (err) {
                    return reject({ success: false, error: err.message });
                }
                
                const query = row
                    ? `UPDATE userCoins SET ${column} = ${column} + ? WHERE userId = ?`
                    : `INSERT INTO userCoins (userId, coins, gems) VALUES (?, ?, ?)`;
                
                const params = row
                    ? [amount, userId]
                    : [userId, currencyType === 'coins' ? amount : 0, currencyType === 'gems' ? amount : 0];
                
                db.run(query, params, function(err) {
                    if (err) {
                        return reject({ success: false, error: err.message });
                    }
                    resolve({ success: true, currencyType, amount });
                });
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
