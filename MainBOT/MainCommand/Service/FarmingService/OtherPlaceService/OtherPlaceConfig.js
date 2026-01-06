/**
 * Other Place Configuration
 * 
 * "Other Place" is an alternate dimension where you can send extra fumos
 * to earn passive income. Unlocks at Rebirth 1.
 * 
 * Features:
 * - Send up to N fumos to the Other Place
 * - Fumos earn reduced income but don't take farm slots
 * - Can be retrieved at any time
 * - Higher rebirth = more slots and better efficiency
 */

// Base slots and scaling
const BASE_SLOTS = 5;                    // Starting slots at Rebirth 1
const SLOTS_PER_REBIRTH = 3;             // Additional slots per rebirth level

// Income efficiency (% of normal farming income)
const BASE_EFFICIENCY = 0.3;             // 30% base efficiency
const EFFICIENCY_PER_REBIRTH = 0.05;     // +5% per rebirth level
const MAX_EFFICIENCY = 0.75;             // Cap at 75%

// Minimum farming time before collection
const MIN_FARMING_TIME = 30 * 60 * 1000; // 30 minutes minimum

// Maximum storage time (after this, income caps)
const MAX_STORAGE_TIME = 24 * 60 * 60 * 1000; // 24 hours max

/**
 * Calculate available slots based on rebirth level
 * @param {number} rebirthLevel 
 * @returns {number}
 */
function getOtherPlaceSlots(rebirthLevel) {
    if (rebirthLevel < 1) return 0;
    return BASE_SLOTS + (rebirthLevel - 1) * SLOTS_PER_REBIRTH;
}

/**
 * Calculate income efficiency based on rebirth level
 * @param {number} rebirthLevel 
 * @returns {number} Efficiency multiplier (0.0 - 1.0)
 */
function getOtherPlaceEfficiency(rebirthLevel) {
    if (rebirthLevel < 1) return 0;
    const efficiency = BASE_EFFICIENCY + (rebirthLevel - 1) * EFFICIENCY_PER_REBIRTH;
    return Math.min(efficiency, MAX_EFFICIENCY);
}

/**
 * Get tier name based on rebirth level
 * @param {number} rebirthLevel 
 * @returns {string}
 */
function getOtherPlaceTier(rebirthLevel) {
    if (rebirthLevel >= 10) return '🌌 Transcendent Void';
    if (rebirthLevel >= 7) return '🌀 Astral Plane';
    if (rebirthLevel >= 5) return '✨ Starlight Realm';
    if (rebirthLevel >= 3) return '🌙 Moonlit Garden';
    if (rebirthLevel >= 1) return '🌑 Shadow Dimension';
    return '🔒 Locked';
}

module.exports = {
    BASE_SLOTS,
    SLOTS_PER_REBIRTH,
    BASE_EFFICIENCY,
    EFFICIENCY_PER_REBIRTH,
    MAX_EFFICIENCY,
    MIN_FARMING_TIME,
    MAX_STORAGE_TIME,
    getOtherPlaceSlots,
    getOtherPlaceEfficiency,
    getOtherPlaceTier
};
