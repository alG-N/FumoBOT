/**
 * Biome System Configuration
 * 
 * Biomes are different farming zones that provide unique bonuses.
 * - Unlocked at Level 50
 * - Each biome specializes in different rewards
 * - Some biomes synergize with specific fumo rarities or traits
 * - Can be changed once per day (or with cooldown)
 * - Non-default biomes require purchase to unlock!
 * 
 * Design Philosophy:
 * - Basic biome is free and balanced
 * - Premium biomes offer trade-offs (more coins but less gems, etc.)
 * - Some biomes synergize with weather events
 * - Higher tier biomes require higher rebirth levels and more expensive unlocks
 */

// Biome images for visual appeal
const BIOME_IMAGES = {
    GRASSLAND: 'https://tse4.mm.bing.net/th/id/OIP.VtwNGH4_8JBJKvAkUywN2AHaFj?cb=defcache2defcache=1&rs=1&pid=ImgDetMain&o=7&rm=3',
    MOUNTAIN: 'https://tse1.mm.bing.net/th/id/OIP.Ln8t1GvCZYmR1x4AtZ17ywHaEo?cb=defcache2defcache=1&rs=1&pid=ImgDetMain&o=7&rm=3',
    FOREST: 'https://www.sarakadeelite.com/wp-content/uploads/2024/01/forest-open.jpg',
    BEACH: 'https://i.dailymail.co.uk/1s/2024/02/07/23/80990373-0-image-m-101_1707348446800.jpg',
    VOLCANO: 'https://media.istockphoto.com/id/1124780295/photo/patterns-of-fertile-volcanic-farming-fields-next-to-a-volcano-by-atlantic-ocean-lanzarote.jpg?s=170667a&w=0&k=20&c=l9BMKZm2itwVOOifnLzCAv0oV2dMnPcLC3iznMn5euQ=',
    GLACIER: 'https://images.squarespace-cdn.com/content/v1/5e00e1831871de3d6398dcf9/1616180614792-TCT1VYE826GWKVK4VB0J/mtnroots-660x330.jpg?format=1000w',
    CELESTIAL_GARDEN: 'https://img.freepik.com/premium-photo/celestial-garden-where-beings-from-various-galaxie_1022456-49755.jpg',
    VOID_REALM: 'https://i.pinimg.com/originals/2f/08/aa/2f08aaccd1483bd930a3e964a1a598c0.jpg',
    TRANSCENDENT_PLAINS: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/3d733837-eae3-48b0-883b-955ce7172d8a/db6l7w6-98794d3f-2944-4191-9c43-97331aa9d9c2.jpg/v1/fill/w_1192,h_670,q_70,strp/farm_by_frankatt_db6l7w6-pre.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9OTAwIiwicGF0aCI6IlwvZlwvM2Q3MzM4MzctZWFlMy00OGIwLTg4M2ItOTU1Y2U3MTcyZDhhXC9kYjZsN3c2LTk4Nzk0ZDNmLTI5NDQtNDE5MS05YzQzLTk3MzMxYWE5ZDljMi5qcGciLCJ3aWR0aCI6Ijw9MTYwMCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.nhGFTYD45FW7h6XWulI7SzCMEq5Rk6Zi7zvYeZ1SylM'
};

const BIOMES = {
    // ═══════════════════════════════════════════════════════════════
    // DEFAULT BIOME - Available to all (FREE)
    // ═══════════════════════════════════════════════════════════════
    GRASSLAND: {
        id: 'GRASSLAND',
        name: 'Grassland',
        emoji: '🌾',
        description: 'A lush grassland, each fumo is slowly clearing the fields out. Perfect for balancing your farm!',
        requiredLevel: 0,
        requiredRebirth: 0,
        unlockCost: null, // Free!
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
    // LEVEL 50 BIOMES - Basic specialization (Entry cost)
    // ═══════════════════════════════════════════════════════════════
    MOUNTAIN: {
        id: 'MOUNTAIN',
        name: 'Crystal Mountain',
        emoji: '⛰️',
        description: 'A majestic mountain filled with sparkling crystals, your fumos are taking the pickaxe to mine gems. Great for gem hunting!',
        requiredLevel: 50,
        requiredRebirth: 0,
        unlockCost: {
            type: 'coins',
            amount: 150_000_000, // 150M coins
            display: '150M Coins'
        },
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
        description: 'A magical forest overflowing with such rare golden flora, your fumos are gathering them up. Excellent for coin farming!',
        requiredLevel: 50,
        requiredRebirth: 0,
        unlockCost: {
            type: 'gems',
            amount: 50_000_000, // 50M gems
            display: '50M Gems'
        },
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
        description: 'A beautiful beach with treasures in the sand, your fumos are digging up hidden gems and coins. A balanced spot for farming!',
        requiredLevel: 50,
        requiredRebirth: 0,
        unlockCost: {
            type: 'percentage',
            coinPercent: 10,  // 10% of total coins
            gemPercent: 10,   // 10% of total gems
            display: '10% of Coins & Gems'
        },
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
    // REBIRTH 1 BIOMES - Intermediate specialization (Higher cost)
    // ═══════════════════════════════════════════════════════════════
    VOLCANO: {
        id: 'VOLCANO',
        name: 'Volcanic Forge',
        emoji: '🌋',
        description: 'A dangerous but rewarding volcanic area, your fumos are braving the heat to extract valuable resources.',
        requiredLevel: 50,
        requiredRebirth: 1,
        unlockCost: {
            type: 'coins',
            amount: 500_000_000_000, // 500B coins
            display: '500B Coins'
        },
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
        unlockCost: {
            type: 'gems',
            amount: 300_000_000_000, // 300B gems
            display: '300B Gems'
        },
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
    // REBIRTH 3 BIOMES - Advanced specialization (Premium cost)
    // ═══════════════════════════════════════════════════════════════
    CELESTIAL_GARDEN: {
        id: 'CELESTIAL_GARDEN',
        name: 'Celestial Garden',
        emoji: '🌸',
        description: 'A heavenly garden blessed by the stars, your fumos are basking in celestial light to enhance their powers.',
        requiredLevel: 50,
        requiredRebirth: 3,
        unlockCost: {
            type: 'percentage',
            coinPercent: 15, // 15% of total coins
            gemPercent: 15,  // 15% of total gems
            display: '15% of Coins & Gems'
        },
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
        unlockCost: {
            type: 'both',
            coins: 1_000_000_000_000, // 1T coins
            gems: 500_000_000_000,    // 500B gems
            display: '1T Coins + 500B Gems'
        },
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
    // REBIRTH 5 BIOMES - Mastery tier (Ultimate cost)
    // ═══════════════════════════════════════════════════════════════
    TRANSCENDENT_PLAINS: {
        id: 'TRANSCENDENT_PLAINS',
        name: 'Transcendent Plains',
        emoji: '✨',
        description: 'A realm beyond reality with incredible rewards, your fumos are transcending the ordinary to achieve greatness.',
        requiredLevel: 50,
        requiredRebirth: 5,
        unlockCost: {
            type: 'percentage',
            coinPercent: 25, // 25% of total coins
            gemPercent: 25,  // 25% of total gems
            display: '25% of Coins & Gems'
        },
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

/**
 * Get biome image URL
 * @param {string} biomeId 
 * @returns {string}
 */
function getBiomeImage(biomeId) {
    return BIOME_IMAGES[biomeId] || BIOME_IMAGES.GRASSLAND;
}

/**
 * Calculate unlock cost for a biome
 * @param {Object} biome 
 * @param {number} userCoins 
 * @param {number} userGems 
 * @returns {{coins: number, gems: number, display: string} | null}
 */
function calculateUnlockCost(biome, userCoins = 0, userGems = 0) {
    if (!biome.unlockCost) return null;
    
    const cost = biome.unlockCost;
    
    switch (cost.type) {
        case 'coins':
            return { coins: cost.amount, gems: 0, display: cost.display };
        case 'gems':
            return { coins: 0, gems: cost.amount, display: cost.display };
        case 'percentage':
            return {
                coins: Math.floor(userCoins * (cost.coinPercent / 100)),
                gems: Math.floor(userGems * (cost.gemPercent / 100)),
                display: cost.display
            };
        case 'both':
            return { coins: cost.coins, gems: cost.gems, display: cost.display };
        default:
            return null;
    }
}

/**
 * Check if user can afford biome unlock
 * @param {Object} biome 
 * @param {number} userCoins 
 * @param {number} userGems 
 * @returns {{canAfford: boolean, cost: Object | null}}
 */
function canAffordBiome(biome, userCoins, userGems) {
    const cost = calculateUnlockCost(biome, userCoins, userGems);
    if (!cost) return { canAfford: true, cost: null }; // Free biome
    
    const canAfford = userCoins >= cost.coins && userGems >= cost.gems;
    return { canAfford, cost };
}

module.exports = {
    // Constants
    BIOMES,
    BIOME_IMAGES,
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
    getDefaultBiome,
    getBiomeImage,
    calculateUnlockCost,
    canAffordBiome
};
