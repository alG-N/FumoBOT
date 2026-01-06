/**
 * Biome System Configuration
 * 
 * Biomes are different farming zones that provide unique bonuses.
 * - Unlocked at Level 50
 * - Each biome specializes in different rewards
 * - Some biomes synergize with specific fumo rarities or traits
 * - Can be changed once per day (or with cooldown)
 * 
 * Design Philosophy:
 * - Basic biome is free and balanced
 * - Premium biomes offer trade-offs (more coins but less gems, etc.)
 * - Some biomes synergize with weather events
 * - Higher tier biomes require higher rebirth levels
 */

const BIOMES = {
    // ═══════════════════════════════════════════════════════════════
    // DEFAULT BIOME - Available to all
    // ═══════════════════════════════════════════════════════════════
    GRASSLAND: {
        id: 'GRASSLAND',
        name: 'Grassland',
        emoji: '🌾',
        description: 'A peaceful meadow with balanced rewards.',
        requiredLevel: 0,
        requiredRebirth: 0,
        multipliers: {
            coins: 1.0,
            gems: 1.0
        },
        bonuses: {
            commonBonus: 0,        // Extra % for common fumos
            shinyBonus: 0,         // Extra % for shiny fumos
            weatherSynergy: null   // No specific weather synergy
        },
        color: 0x7CFC00  // Lawn green
    },

    // ═══════════════════════════════════════════════════════════════
    // LEVEL 50 BIOMES - Basic specialization
    // ═══════════════════════════════════════════════════════════════
    MOUNTAIN: {
        id: 'MOUNTAIN',
        name: 'Crystal Mountain',
        emoji: '⛰️',
        description: 'A towering mountain rich with gem deposits.',
        requiredLevel: 50,
        requiredRebirth: 0,
        multipliers: {
            coins: 0.8,    // -20% coins
            gems: 1.5      // +50% gems
        },
        bonuses: {
            commonBonus: 0,
            shinyBonus: 10,        // Shinies get 10% more
            weatherSynergy: 'STARRY_NIGHT'  // Extra bonus during starry night
        },
        color: 0x708090  // Slate gray
    },

    FOREST: {
        id: 'FOREST',
        name: 'Enchanted Forest',
        emoji: '🌲',
        description: 'A magical forest overflowing with gold.',
        requiredLevel: 50,
        requiredRebirth: 0,
        multipliers: {
            coins: 1.5,    // +50% coins
            gems: 0.8      // -20% gems
        },
        bonuses: {
            commonBonus: 20,       // Common fumos get 20% more
            shinyBonus: 0,
            weatherSynergy: 'SUNNY_DAY'
        },
        color: 0x228B22  // Forest green
    },

    BEACH: {
        id: 'BEACH',
        name: 'Sunset Beach',
        emoji: '🏖️',
        description: 'A beautiful beach with treasures in the sand.',
        requiredLevel: 50,
        requiredRebirth: 0,
        multipliers: {
            coins: 1.2,
            gems: 1.2
        },
        bonuses: {
            commonBonus: 0,
            shinyBonus: 0,
            weatherSynergy: 'GOLDEN_HOUR'  // Big bonus during golden hour
        },
        color: 0xF4A460  // Sandy brown
    },

    // ═══════════════════════════════════════════════════════════════
    // REBIRTH 1 BIOMES - Intermediate specialization
    // ═══════════════════════════════════════════════════════════════
    VOLCANO: {
        id: 'VOLCANO',
        name: 'Volcanic Forge',
        emoji: '🌋',
        description: 'A dangerous but rewarding volcanic area.',
        requiredLevel: 50,
        requiredRebirth: 1,
        multipliers: {
            coins: 2.0,    // +100% coins
            gems: 0.5      // -50% gems
        },
        bonuses: {
            commonBonus: 0,
            shinyBonus: 25,
            weatherSynergy: 'METEOR_SHOWER'
        },
        color: 0xFF4500  // Orange red
    },

    GLACIER: {
        id: 'GLACIER',
        name: 'Frozen Glacier',
        emoji: '🧊',
        description: 'An icy landscape preserving ancient gems.',
        requiredLevel: 50,
        requiredRebirth: 1,
        multipliers: {
            coins: 0.5,    // -50% coins
            gems: 2.0      // +100% gems
        },
        bonuses: {
            commonBonus: 0,
            shinyBonus: 25,
            weatherSynergy: 'AURORA'
        },
        color: 0x87CEEB  // Sky blue
    },

    // ═══════════════════════════════════════════════════════════════
    // REBIRTH 3 BIOMES - Advanced specialization
    // ═══════════════════════════════════════════════════════════════
    CELESTIAL_GARDEN: {
        id: 'CELESTIAL_GARDEN',
        name: 'Celestial Garden',
        emoji: '🌸',
        description: 'A heavenly garden blessed by the stars.',
        requiredLevel: 50,
        requiredRebirth: 3,
        multipliers: {
            coins: 1.5,
            gems: 1.5
        },
        bonuses: {
            commonBonus: 0,
            shinyBonus: 50,        // Huge shiny bonus
            weatherSynergy: 'RAINBOW'
        },
        color: 0xFFB6C1  // Light pink
    },

    VOID_REALM: {
        id: 'VOID_REALM',
        name: 'Void Realm',
        emoji: '🌀',
        description: 'A mysterious dimension with unpredictable rewards.',
        requiredLevel: 50,
        requiredRebirth: 3,
        multipliers: {
            coins: 1.3,
            gems: 1.3
        },
        bonuses: {
            commonBonus: 0,
            shinyBonus: 0,
            voidBonus: 100,        // Void fumos get huge bonus
            glitchedBonus: 50,     // Glitched fumos get bonus
            weatherSynergy: null   // Works with any weather
        },
        color: 0x4B0082  // Indigo
    },

    // ═══════════════════════════════════════════════════════════════
    // REBIRTH 5 BIOMES - Mastery tier
    // ═══════════════════════════════════════════════════════════════
    TRANSCENDENT_PLAINS: {
        id: 'TRANSCENDENT_PLAINS',
        name: 'Transcendent Plains',
        emoji: '✨',
        description: 'A realm beyond reality with incredible rewards.',
        requiredLevel: 50,
        requiredRebirth: 5,
        multipliers: {
            coins: 2.0,
            gems: 2.0
        },
        bonuses: {
            commonBonus: 10,
            shinyBonus: 30,
            alGBonus: 50,             // alG fumos get 50% bonus
            allRarityBonus: 20        // All rarities get bonus
        },
        color: 0xFFD700  // Gold
    }
};

// Biome change cooldown (24 hours default)
const BIOME_CHANGE_COOLDOWN = 24 * 60 * 60 * 1000;

// Weather synergy multiplier when biome matches weather
const WEATHER_SYNERGY_BONUS = 0.5;  // +50% when synergy matches

/**
 * Get biome by ID
 * @param {string} biomeId 
 * @returns {Object|null}
 */
function getBiome(biomeId) {
    return BIOMES[biomeId] || null;
}

/**
 * Get all biomes
 * @returns {Object}
 */
function getAllBiomes() {
    return BIOMES;
}

/**
 * Get available biomes for a user based on level and rebirth
 * @param {number} level 
 * @param {number} rebirthLevel 
 * @returns {Object[]}
 */
function getAvailableBiomes(level, rebirthLevel = 0) {
    return Object.values(BIOMES).filter(biome => 
        level >= biome.requiredLevel && 
        rebirthLevel >= biome.requiredRebirth
    );
}

/**
 * Get locked biomes (for display purposes)
 * @param {number} level 
 * @param {number} rebirthLevel 
 * @returns {Object[]}
 */
function getLockedBiomes(level, rebirthLevel = 0) {
    return Object.values(BIOMES).filter(biome => 
        level < biome.requiredLevel || 
        rebirthLevel < biome.requiredRebirth
    );
}

/**
 * Check if user can use a biome
 * @param {string} biomeId 
 * @param {number} level 
 * @param {number} rebirthLevel 
 * @returns {boolean}
 */
function canUseBiome(biomeId, level, rebirthLevel = 0) {
    const biome = getBiome(biomeId);
    if (!biome) return false;
    return level >= biome.requiredLevel && rebirthLevel >= biome.requiredRebirth;
}

/**
 * Calculate biome multipliers for farming income
 * @param {string} biomeId 
 * @param {Object} fumo - Fumo object with name and traits
 * @param {string|null} activeWeather - Current weather type
 * @returns {Object} { coinMultiplier, gemMultiplier }
 */
function calculateBiomeMultipliers(biomeId, fumo = null, activeWeather = null) {
    const biome = getBiome(biomeId) || BIOMES.GRASSLAND;
    
    let coinMult = biome.multipliers.coins;
    let gemMult = biome.multipliers.gems;
    
    // Apply trait bonuses
    if (fumo) {
        const fumoName = fumo.fumoName || fumo.name || '';
        
        // Shiny bonus
        if (fumoName.includes('✨SHINY') && biome.bonuses.shinyBonus) {
            const bonus = biome.bonuses.shinyBonus / 100;
            coinMult *= (1 + bonus);
            gemMult *= (1 + bonus);
        }
        
        // alG bonus
        if (fumoName.includes('🌟alG') && biome.bonuses.alGBonus) {
            const bonus = biome.bonuses.alGBonus / 100;
            coinMult *= (1 + bonus);
            gemMult *= (1 + bonus);
        }
        
        // Void bonus
        if (fumoName.includes('🌀VOID') && biome.bonuses.voidBonus) {
            const bonus = biome.bonuses.voidBonus / 100;
            coinMult *= (1 + bonus);
            gemMult *= (1 + bonus);
        }
        
        // Glitched bonus
        if (fumoName.includes('🔮GLITCHED') && biome.bonuses.glitchedBonus) {
            const bonus = biome.bonuses.glitchedBonus / 100;
            coinMult *= (1 + bonus);
            gemMult *= (1 + bonus);
        }
        
        // Common bonus (check by absence of special traits)
        if (biome.bonuses.commonBonus) {
            const isCommon = !fumoName.includes('✨') && 
                            !fumoName.includes('🌟') && 
                            !fumoName.includes('🔮') && 
                            !fumoName.includes('🌀');
            if (isCommon) {
                const bonus = biome.bonuses.commonBonus / 100;
                coinMult *= (1 + bonus);
                gemMult *= (1 + bonus);
            }
        }
        
        // All rarity bonus
        if (biome.bonuses.allRarityBonus) {
            const bonus = biome.bonuses.allRarityBonus / 100;
            coinMult *= (1 + bonus);
            gemMult *= (1 + bonus);
        }
    }
    
    // Weather synergy bonus
    if (activeWeather && biome.bonuses.weatherSynergy === activeWeather) {
        coinMult *= (1 + WEATHER_SYNERGY_BONUS);
        gemMult *= (1 + WEATHER_SYNERGY_BONUS);
    }
    
    return {
        coinMultiplier: coinMult,
        gemMultiplier: gemMult
    };
}

/**
 * Get biome unlock requirements text
 * @param {Object} biome 
 * @returns {string}
 */
function getBiomeRequirementText(biome) {
    const reqs = [];
    
    if (biome.requiredLevel > 0) {
        reqs.push(`Level ${biome.requiredLevel}`);
    }
    
    if (biome.requiredRebirth > 0) {
        reqs.push(`Rebirth ${biome.requiredRebirth}`);
    }
    
    return reqs.length > 0 ? reqs.join(' + ') : 'No requirements';
}

/**
 * Format biome info for display
 * @param {Object} biome 
 * @returns {string}
 */
function formatBiomeInfo(biome) {
    const lines = [
        `${biome.emoji} **${biome.name}**`,
        `> ${biome.description}`,
        ``,
        `**Multipliers:**`,
        `💰 Coins: ${biome.multipliers.coins}x`,
        `💎 Gems: ${biome.multipliers.gems}x`
    ];
    
    // Add bonuses
    const bonusList = [];
    if (biome.bonuses.shinyBonus) bonusList.push(`✨ Shiny: +${biome.bonuses.shinyBonus}%`);
    if (biome.bonuses.alGBonus) bonusList.push(`🌟 alG: +${biome.bonuses.alGBonus}%`);
    if (biome.bonuses.commonBonus) bonusList.push(`⚪ Common: +${biome.bonuses.commonBonus}%`);
    if (biome.bonuses.voidBonus) bonusList.push(`🌀 Void: +${biome.bonuses.voidBonus}%`);
    if (biome.bonuses.glitchedBonus) bonusList.push(`🔮 Glitched: +${biome.bonuses.glitchedBonus}%`);
    if (biome.bonuses.allRarityBonus) bonusList.push(`⭐ All: +${biome.bonuses.allRarityBonus}%`);
    
    if (bonusList.length > 0) {
        lines.push(``, `**Bonuses:** ${bonusList.join(' | ')}`);
    }
    
    if (biome.bonuses.weatherSynergy) {
        lines.push(`⛅ Weather Synergy: ${biome.bonuses.weatherSynergy}`);
    }
    
    return lines.join('\n');
}

/**
 * Get default biome
 * @returns {Object}
 */
function getDefaultBiome() {
    return BIOMES.GRASSLAND;
}

module.exports = {
    // Constants
    BIOMES,
    BIOME_CHANGE_COOLDOWN,
    WEATHER_SYNERGY_BONUS,
    
    // Functions
    getBiome,
    getAllBiomes,
    getAvailableBiomes,
    getLockedBiomes,
    canUseBiome,
    calculateBiomeMultipliers,
    getBiomeRequirementText,
    formatBiomeInfo,
    getDefaultBiome
};
