/**
 * Validation Utility
 * 
 * Common validation functions to prevent bugs and ensure data integrity.
 * Use these functions before database operations or command execution.
 */

/**
 * Validate Discord user ID format
 * @param {string} userId 
 * @returns {boolean}
 */
function isValidUserId(userId) {
    if (!userId || typeof userId !== 'string') return false;
    // Discord snowflake IDs are 17-19 digit numbers
    return /^\d{17,19}$/.test(userId);
}

/**
 * Validate positive integer
 * @param {any} value 
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {boolean}
 */
function isValidPositiveInt(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseInt(value, 10);
    return !isNaN(num) && Number.isInteger(num) && num >= min && num <= max;
}

/**
 * Validate quantity for transactions
 * @param {any} quantity 
 * @param {number} maxQuantity - Maximum allowed quantity
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
function validateQuantity(quantity, maxQuantity = 1000000) {
    const num = parseInt(quantity, 10);
    
    if (isNaN(num)) {
        return { valid: false, error: 'Quantity must be a number.' };
    }
    
    if (!Number.isInteger(num)) {
        return { valid: false, error: 'Quantity must be a whole number.' };
    }
    
    if (num < 1) {
        return { valid: false, error: 'Quantity must be at least 1.' };
    }
    
    if (num > maxQuantity) {
        return { valid: false, error: `Quantity cannot exceed ${maxQuantity.toLocaleString()}.` };
    }
    
    return { valid: true, value: num };
}

/**
 * Validate currency amount
 * @param {any} amount 
 * @param {string} currencyType - 'coins' or 'gems'
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
function validateCurrencyAmount(amount, currencyType = 'coins') {
    const num = parseInt(amount, 10);
    const maxAmount = currencyType === 'gems' ? 1000000000 : 100000000000; // 1B gems, 100B coins
    
    if (isNaN(num)) {
        return { valid: false, error: 'Amount must be a number.' };
    }
    
    if (num < 0) {
        return { valid: false, error: 'Amount cannot be negative.' };
    }
    
    if (num > maxAmount) {
        return { valid: false, error: `Amount exceeds maximum allowed (${maxAmount.toLocaleString()}).` };
    }
    
    return { valid: true, value: num };
}

/**
 * Validate fumo name format
 * @param {string} fumoName 
 * @returns {boolean}
 */
function isValidFumoName(fumoName) {
    if (!fumoName || typeof fumoName !== 'string') return false;
    // Fumo names should be between 1-200 characters
    return fumoName.length >= 1 && fumoName.length <= 200;
}

/**
 * Validate level
 * @param {any} level 
 * @param {number} maxLevel 
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
function validateLevel(level, maxLevel = 999) {
    const num = parseInt(level, 10);
    
    if (isNaN(num) || !Number.isInteger(num)) {
        return { valid: false, error: 'Level must be a whole number.' };
    }
    
    if (num < 1) {
        return { valid: false, error: 'Level must be at least 1.' };
    }
    
    if (num > maxLevel) {
        return { valid: false, error: `Level cannot exceed ${maxLevel}.` };
    }
    
    return { valid: true, value: num };
}

/**
 * Validate rebirth level
 * @param {any} rebirthLevel 
 * @param {number} maxRebirth 
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
function validateRebirthLevel(rebirthLevel, maxRebirth = 100) {
    const num = parseInt(rebirthLevel, 10);
    
    if (isNaN(num) || !Number.isInteger(num)) {
        return { valid: false, error: 'Rebirth level must be a whole number.' };
    }
    
    if (num < 0) {
        return { valid: false, error: 'Rebirth level cannot be negative.' };
    }
    
    if (num > maxRebirth) {
        return { valid: false, error: `Rebirth level cannot exceed ${maxRebirth}.` };
    }
    
    return { valid: true, value: num };
}

/**
 * Validate percentage value
 * @param {any} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
function validatePercentage(value, min = 0, max = 100) {
    const num = parseFloat(value);
    
    if (isNaN(num)) {
        return { valid: false, error: 'Value must be a number.' };
    }
    
    if (num < min) {
        return { valid: false, error: `Value must be at least ${min}%.` };
    }
    
    if (num > max) {
        return { valid: false, error: `Value cannot exceed ${max}%.` };
    }
    
    return { valid: true, value: num };
}

/**
 * Sanitize string input (prevent injection)
 * @param {string} input 
 * @param {number} maxLength 
 * @returns {string}
 */
function sanitizeString(input, maxLength = 100) {
    if (!input || typeof input !== 'string') return '';
    
    return input
        .trim()
        .slice(0, maxLength)
        .replace(/[<>]/g, ''); // Remove potential HTML/Discord formatting exploits
}

/**
 * Validate and clamp a numeric value
 * @param {any} value 
 * @param {number} min 
 * @param {number} max 
 * @param {number} defaultValue 
 * @returns {number}
 */
function clampNumber(value, min, max, defaultValue = min) {
    const num = parseFloat(value);
    if (isNaN(num)) return defaultValue;
    return Math.max(min, Math.min(max, num));
}

/**
 * Validate JSON string
 * @param {string} jsonString 
 * @returns {{valid: boolean, data?: any, error?: string}}
 */
function validateJSON(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        return { valid: true, data };
    } catch (e) {
        return { valid: false, error: 'Invalid JSON format.' };
    }
}

/**
 * Validate timestamp (milliseconds)
 * @param {any} timestamp 
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
function validateTimestamp(timestamp) {
    const num = parseInt(timestamp, 10);
    
    if (isNaN(num)) {
        return { valid: false, error: 'Invalid timestamp.' };
    }
    
    // Reasonable timestamp range (year 2000 to year 3000)
    const minTimestamp = 946684800000; // 2000-01-01
    const maxTimestamp = 32503680000000; // 3000-01-01
    
    if (num < minTimestamp || num > maxTimestamp) {
        return { valid: false, error: 'Timestamp out of valid range.' };
    }
    
    return { valid: true, value: num };
}

/**
 * Validate biome ID
 * @param {string} biomeId 
 * @returns {boolean}
 */
function isValidBiomeId(biomeId) {
    if (!biomeId || typeof biomeId !== 'string') return false;
    // Biome IDs are uppercase alphanumeric with underscores
    return /^[A-Z][A-Z0-9_]*$/.test(biomeId) && biomeId.length <= 50;
}

/**
 * Ensure array is valid
 * @param {any} arr 
 * @param {any} defaultValue 
 * @returns {Array}
 */
function ensureArray(arr, defaultValue = []) {
    return Array.isArray(arr) ? arr : defaultValue;
}

/**
 * Ensure object is valid
 * @param {any} obj 
 * @param {any} defaultValue 
 * @returns {Object}
 */
function ensureObject(obj, defaultValue = {}) {
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : defaultValue;
}

/**
 * Safe parse JSON with default
 * @param {string} jsonString 
 * @param {any} defaultValue 
 * @returns {any}
 */
function safeParseJSON(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return defaultValue;
    }
}

module.exports = {
    // User validation
    isValidUserId,
    
    // Number validation
    isValidPositiveInt,
    validateQuantity,
    validateCurrencyAmount,
    validateLevel,
    validateRebirthLevel,
    validatePercentage,
    clampNumber,
    
    // String validation
    isValidFumoName,
    sanitizeString,
    isValidBiomeId,
    
    // JSON/Data validation
    validateJSON,
    safeParseJSON,
    validateTimestamp,
    
    // Utility
    ensureArray,
    ensureObject
};
