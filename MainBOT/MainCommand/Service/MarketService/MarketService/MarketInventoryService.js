const { run, get, all } = require('../../../Core/database');
const { incrementWeeklyShiny } = require('../../../Ultility/weekly');
const { debugLog } = require('../../../Core/logger');

/**
 * Special Variant Configuration for Market
 * VOID and GLITCHED variants can be obtained when special items are active
 */
const MARKET_VARIANT_CONFIG = {
    SHINY: {
        baseChance: 0.01,           // 1%
        boostChance: 0.02,          // +2% per shinyMark level
        tag: '[✨SHINY]'
    },
    ALG: {
        baseChance: 0.00001,        // 0.001%
        boostChance: 0.00009,       // +0.009% per shinyMark level
        tag: '[🌟alG]'
    },
    VOID: {
        baseChance: 0.001,          // 0.1% (same as gacha VOID chance)
        tag: '[🌀VOID]',
        sources: ['VoidCrystal']    // ONLY VoidCrystal provides VOID
    },
    GLITCHED: {
        baseChance: 1 / 50000,      // 0.002% (same as gacha GLITCHED chance)
        tag: '[🔮GLITCHED]',
        sources: ['S!gil', 'CosmicCore']  // S!gil and CosmicCore provide GLITCHED
    }
};

/**
 * Get active special variant boosts for market purchases
 * Checks for VoidCrystal, CosmicCore, and S!gil
 * OPTIMIZED: Single query for all boost sources
 * @param {string} userId - User ID
 * @returns {Object} Active variant info with chances
 */
async function getActiveMarketVariants(userId) {
    const now = Date.now();
    const variants = {
        void: null,
        glitched: null,
        reimuLuck: 1.0
    };
    
    // OPTIMIZED: Get all relevant boosts in single query
    const allBoosts = await all(
        `SELECT source, type, multiplier, extra FROM activeBoosts 
         WHERE userId = ? 
         AND source IN ('S!gil', 'CosmicCore', 'VoidCrystal')
         AND type IN ('coin', 'glitchedTrait', 'voidTrait', 'reimuLuck')
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    
    // Check if S!gil is active (takes priority)
    const sigilCoin = allBoosts.find(b => b.source === 'S!gil' && b.type === 'coin');
    
    if (sigilCoin) {
        // S!gil provides GLITCHED
        const sigilGlitched = allBoosts.find(b => b.source === 'S!gil' && b.type === 'glitchedTrait');
        
        if (sigilGlitched) {
            try {
                const extra = JSON.parse(sigilGlitched.extra || '{}');
                variants.glitched = {
                    chance: extra.chance || sigilGlitched.multiplier || MARKET_VARIANT_CONFIG.GLITCHED.baseChance,
                    tag: MARKET_VARIANT_CONFIG.GLITCHED.tag,
                    source: 'S!gil'
                };
            } catch {
                variants.glitched = {
                    chance: MARKET_VARIANT_CONFIG.GLITCHED.baseChance,
                    tag: MARKET_VARIANT_CONFIG.GLITCHED.tag,
                    source: 'S!gil'
                };
            }
        }
        
        // Get S!gil Reimu luck multiplier
        const sigilReimuLuck = allBoosts.find(b => b.source === 'S!gil' && b.type === 'reimuLuck');
        if (sigilReimuLuck) {
            variants.reimuLuck = sigilReimuLuck.multiplier || 1.0;
        }
        
        // Check VoidCrystal even when S!gil is active
        const voidCrystal = allBoosts.find(b => b.source === 'VoidCrystal' && b.type === 'voidTrait');
        if (voidCrystal) {
            try {
                const extra = JSON.parse(voidCrystal.extra || '{}');
                const voidChance = extra.chance || voidCrystal.multiplier || MARKET_VARIANT_CONFIG.VOID.baseChance;
                variants.void = {
                    chance: voidChance,
                    tag: MARKET_VARIANT_CONFIG.VOID.tag,
                    source: 'VoidCrystal'
                };
            } catch {}
        }
        
        debugLog('MARKET_INV', `[S!gil Active] GLITCHED: ${variants.glitched?.chance}, VOID: ${variants.void?.chance}, ReimuLuck: ${variants.reimuLuck}`);
        return variants;
    }
    
    // Check CosmicCore for GLITCHED (only when S!gil not active)
    const cosmicCore = allBoosts.find(b => b.source === 'CosmicCore' && b.type === 'glitchedTrait');
    
    if (cosmicCore) {
        try {
            const extra = JSON.parse(cosmicCore.extra || '{}');
            if (!extra.sigilDisabled) {
                variants.glitched = {
                    chance: extra.chance || cosmicCore.multiplier || MARKET_VARIANT_CONFIG.GLITCHED.baseChance,
                    tag: MARKET_VARIANT_CONFIG.GLITCHED.tag,
                    source: 'CosmicCore'
                };
            }
        } catch {
            variants.glitched = {
                chance: MARKET_VARIANT_CONFIG.GLITCHED.baseChance,
                tag: MARKET_VARIANT_CONFIG.GLITCHED.tag,
                source: 'CosmicCore'
            };
        }
    }
    
    // Check VoidCrystal for VOID variant
    const voidCrystal = allBoosts.find(b => b.source === 'VoidCrystal' && b.type === 'voidTrait');
    
    if (voidCrystal) {
        try {
            const extra = JSON.parse(voidCrystal.extra || '{}');
            if (!extra.sigilDisabled) {
                const voidChance = extra.chance || voidCrystal.multiplier || MARKET_VARIANT_CONFIG.VOID.baseChance;
                if (!variants.void || voidChance > variants.void.chance) {
                    variants.void = {
                        chance: voidChance,
                        tag: MARKET_VARIANT_CONFIG.VOID.tag,
                        source: 'VoidCrystal'
                    };
                }
            }
        } catch {
            if (!variants.void) {
                variants.void = {
                    chance: MARKET_VARIANT_CONFIG.VOID.baseChance,
                    tag: MARKET_VARIANT_CONFIG.VOID.tag,
                    source: 'VoidCrystal'
                };
            }
        }
    }
    
    debugLog('MARKET_INV', `[Variants] GLITCHED: ${variants.glitched?.chance || 'none'}, VOID: ${variants.void?.chance || 'none'}`);
    return variants;
}

/**
 * Roll for special variants (GLITCHED or VOID) for market purchases
 * These can be obtained when VoidCrystal, CosmicCore, or S!gil are active
 * A fumo can only have ONE special variant
 * @param {Object} variants - Active variant info from getActiveMarketVariants
 * @returns {Object|null} Rolled special variant or null
 */
function rollMarketSpecialVariant(variants) {
    // Roll for GLITCHED first (rarer, higher priority)
    if (variants.glitched) {
        if (Math.random() < variants.glitched.chance) {
            return {
                type: 'GLITCHED',
                tag: variants.glitched.tag,
                source: variants.glitched.source
            };
        }
    }
    
    // Roll for VOID if GLITCHED didn't hit
    if (variants.void) {
        if (Math.random() < variants.void.chance) {
            return {
                type: 'VOID',
                tag: variants.void.tag,
                source: variants.void.source
            };
        }
    }
    
    return null;
}

/**
 * Apply variant tags to fumo name
 * Order: FumoName(RARITY)[BASE_VARIANT][SPECIAL_VARIANT]
 * Example: Reimu(TRANSCENDENT)[✨SHINY][🔮GLITCHED]
 * @param {string} fumoName - Base fumo name
 * @param {string|null} baseTag - SHINY or alG tag
 * @param {Object|null} specialVariant - GLITCHED or VOID variant
 * @returns {string} Final fumo name with all variants
 */
function applyMarketVariants(fumoName, baseTag, specialVariant) {
    let finalName = fumoName;
    
    // Add base variant first (SHINY or alG)
    if (baseTag) {
        finalName += baseTag;
    }
    
    // Add special variant second (GLITCHED or VOID)
    if (specialVariant) {
        finalName += specialVariant.tag;
    }
    
    return finalName;
}

/**
 * Add fumo to user inventory with variant rolls
 * Now supports VOID and GLITCHED variants when special items are active
 * Reimu luck affects base variant (SHINY/alG) chances
 * @param {string} userId - User ID
 * @param {Object} fumo - Fumo data with name property
 * @param {number} shinyMarkValue - Shiny mark boost (0-1)
 * @returns {Object} Result with added fumo info
 */
async function addFumoToInventory(userId, fumo, shinyMarkValue = 0) {
    // Get active special variant boosts
    const activeVariants = await getActiveMarketVariants(userId);
    
    const shinyMark = Math.min(1, shinyMarkValue);
    
    // Base variant chances (SHINY/alG)
    let shinyChance = MARKET_VARIANT_CONFIG.SHINY.baseChance + (shinyMark * MARKET_VARIANT_CONFIG.SHINY.boostChance);
    let alGChance = MARKET_VARIANT_CONFIG.ALG.baseChance + (shinyMark * MARKET_VARIANT_CONFIG.ALG.boostChance);
    
    // Apply Reimu luck multiplier to base variants (from S!gil)
    // This multiplier boosts SHINY/alG chances significantly
    if (activeVariants.reimuLuck > 1) {
        const luckMult = activeVariants.reimuLuck;
        // Cap the luck boost to prevent 100% chances
        shinyChance = Math.min(shinyChance * luckMult, 0.5);  // Max 50% SHINY
        alGChance = Math.min(alGChance * luckMult, 0.1);      // Max 10% alG
        debugLog('MARKET_INV', `[Reimu Luck] Applied x${luckMult} - SHINY: ${(shinyChance * 100).toFixed(2)}%, alG: ${(alGChance * 100).toFixed(4)}%`);
    }
    
    // Roll for base variant (SHINY or alG)
    const isAlterGolden = Math.random() < alGChance;
    const isShiny = !isAlterGolden && Math.random() < shinyChance;
    
    let baseTag = null;
    if (isAlterGolden) {
        baseTag = MARKET_VARIANT_CONFIG.ALG.tag;
        await incrementWeeklyShiny(userId);
        debugLog('MARKET_INV', `[Base Variant] alG rolled!`);
    } else if (isShiny) {
        baseTag = MARKET_VARIANT_CONFIG.SHINY.tag;
        await incrementWeeklyShiny(userId);
        debugLog('MARKET_INV', `[Base Variant] SHINY rolled!`);
    }
    
    // Roll for special variant (GLITCHED or VOID) if active
    // These require VoidCrystal, CosmicCore, or S!gil to be active
    const specialVariant = rollMarketSpecialVariant(activeVariants);
    
    if (specialVariant) {
        debugLog('MARKET_INV', `[Special Variant] ${specialVariant.type} rolled from ${specialVariant.source}!`);
    }
    
    // Build final fumo name with all variants
    const fumoName = applyMarketVariants(fumo.name, baseTag, specialVariant);

    // Use INSERT OR UPDATE to handle duplicate entries (user already owns this exact fumo)
    await run(
        `INSERT INTO userInventory (userId, fumoName, quantity, rarity) VALUES (?, ?, 1, ?)
         ON CONFLICT(userId, fumoName) DO UPDATE SET quantity = quantity + 1`,
        [userId, fumoName, fumo.rarity || 'Common']
    );

    debugLog('MARKET_INV', `Added ${fumoName} to ${userId}'s inventory`);
    
    return {
        success: true,
        fumoName,
        baseName: fumo.name,
        variants: {
            base: isAlterGolden ? 'alG' : (isShiny ? 'SHINY' : null),
            special: specialVariant?.type || null,
            specialSource: specialVariant?.source || null
        }
    };
}

module.exports = {
    addFumoToInventory,
    getActiveMarketVariants,
    rollMarketSpecialVariant,
    applyMarketVariants,
    MARKET_VARIANT_CONFIG
};