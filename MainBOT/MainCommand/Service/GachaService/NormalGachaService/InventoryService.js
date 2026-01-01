const { run, get, all, transaction } = require('../../../Core/database');
const { SHINY_CONFIG, SELL_REWARDS, VARIANT_CONFIG, ASTRAL_PLUS_RARITIES } = require('../../../Configuration/rarity');
const { incrementWeeklyShiny } = require('../../../Ultility/weekly');
const { debugLog } = require('../../../Core/logger');
const { STORAGE_CONFIG } = require('../../../Configuration/storageConfig');
const StorageLimitService = require('../../UserDataService/StorageService/StorageLimitService');

// Define ASTRAL+ rarities for duplicate blocking (if not in rarity config)
const ASTRAL_PLUS = ASTRAL_PLUS_RARITIES || ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];

/**
 * Special variant configurations
 * GLITCHED and VOID are separate traits like SHINY and alG
 */
const SPECIAL_VARIANTS = {
    GLITCHED: {
        tag: '[🔮GLITCHED]',
        emoji: '🔮',
        sources: ['S!gil', 'CosmicCore'],
        priority: 1 // Highest priority
    },
    VOID: {
        tag: '[🌀VOID]',
        emoji: '🌀',
        sources: ['VoidCrystal'],
        priority: 2
    }
};

/**
 * Get active special variant boost for a user
 * GLITCHED and VOID can both exist and are rolled independently
 * Returns all active variant chances
 */
async function getActiveSpecialVariants(userId) {
    const now = Date.now();
    const variants = {
        glitched: null,
        void: null
    };
    
    // Check if S!gil is active (has priority for glitched)
    const sigilActive = await get(
        `SELECT * FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'coin'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    
    if (sigilActive) {
        // Get S!gil glitched chance (S!gil has priority for GLITCHED)
        const sigilGlitched = await get(
            `SELECT multiplier, extra FROM activeBoosts 
             WHERE userId = ? AND source = 'S!gil' AND type = 'glitchedTrait'
             AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, now]
        );
        
        if (sigilGlitched) {
            try {
                const extra = JSON.parse(sigilGlitched.extra || '{}');
                variants.glitched = {
                    chance: extra.chance || sigilGlitched.multiplier,
                    tag: extra.tag || SPECIAL_VARIANTS.GLITCHED.tag,
                    source: 'S!gil'
                };
            } catch {}
        }
    } else {
        // Check CosmicCore glitched (only when S!gil not active)
        const cosmicGlitched = await get(
            `SELECT multiplier, extra FROM activeBoosts 
             WHERE userId = ? AND source = 'CosmicCore' AND type = 'glitchedTrait'
             AND expiresAt > ?`,
            [userId, now]
        );
        
        if (cosmicGlitched) {
            try {
                const extra = JSON.parse(cosmicGlitched.extra || '{}');
                variants.glitched = {
                    chance: extra.chance || cosmicGlitched.multiplier,
                    tag: extra.tag || SPECIAL_VARIANTS.GLITCHED.tag,
                    source: 'CosmicCore'
                };
            } catch {}
        }
    }
    
    // Check VoidCrystal void (VOID is independent of S!gil, always active)
    const voidCrystal = await get(
        `SELECT multiplier, extra FROM activeBoosts 
         WHERE userId = ? AND source = 'VoidCrystal' AND type = 'voidTrait'
         AND expiresAt > ?`,
        [userId, now]
    );
    
    if (voidCrystal) {
        try {
            const extra = JSON.parse(voidCrystal.extra || '{}');
            variants.void = {
                chance: extra.chance || voidCrystal.multiplier,
                tag: extra.tag || SPECIAL_VARIANTS.VOID.tag,
                source: 'VoidCrystal'
            };
        } catch {}
    }
    
    return variants;
}

/**
 * Get variant luck multiplier (affects SHINY/alG chances)
 * From EternalEssence or S!gil - changed from 'traitLuck' to 'variantLuck'
 */
async function getVariantLuckMultiplier(userId) {
    const now = Date.now();
    
    // Check if S!gil is active
    const sigilActive = await get(
        `SELECT * FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'coin'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    
    if (sigilActive) {
        // Only use S!gil variant luck when active
        const sigilVariantLuck = await get(
            `SELECT multiplier FROM activeBoosts 
             WHERE userId = ? AND source = 'S!gil' AND type = 'variantLuck'
             AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, now]
        );
        
        return sigilVariantLuck?.multiplier || 1.0;
    }
    
    // Check EternalEssence variant luck (24h duration now)
    const eternalVariantLuck = await get(
        `SELECT multiplier FROM activeBoosts 
         WHERE userId = ? AND source = 'EternalEssence' AND type = 'variantLuck'
         AND expiresAt > ?`,
        [userId, now]
    );
    
    return eternalVariantLuck?.multiplier || 1.0;
}

/**
 * Check if S!gil ASTRAL+ duplicate blocking is active
 */
async function shouldBlockAstralDuplicate(userId) {
    const now = Date.now();
    
    const astralBlock = await get(
        `SELECT extra FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'astralBlock'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    
    if (astralBlock) {
        try {
            const extra = JSON.parse(astralBlock.extra || '{}');
            return extra.blocksAstralDuplicates === true;
        } catch {}
    }
    
    return false;
}

/**
 * Check if a fumo should be blocked due to S!gil ASTRAL+ duplicate blocking
 * Returns true if user already owns this base fumo and S!gil blocking is active
 */
async function checkAstralDuplicateBlock(userId, baseFumoName, rarity) {
    // Only check for ASTRAL+ rarities
    if (!ASTRAL_PLUS.includes(rarity?.toUpperCase())) {
        return false;
    }
    
    // Check if S!gil blocking is active
    const shouldBlock = await shouldBlockAstralDuplicate(userId);
    if (!shouldBlock) {
        return false;
    }
    
    // Extract base name without variants for matching
    const cleanName = baseFumoName.replace(/\[.*?\]/g, '').trim();
    
    // Check if user already owns any variant of this fumo
    const existing = await get(
        `SELECT * FROM userInventory 
         WHERE userId = ? AND fumoName LIKE ? AND quantity > 0`,
        [userId, `%${cleanName}%`]
    );
    
    if (existing) {
        debugLog(`[SIGIL] Blocking ASTRAL+ duplicate: ${cleanName} for user ${userId}`);
        return true;
    }
    
    return false;
}

/**
 * Roll for special variant (GLITCHED or VOID)
 * These are separate from SHINY/alG and can be rolled independently
 * A fumo can only have ONE special variant (GLITCHED or VOID, not both)
 */
async function rollSpecialVariant(userId, fumoName) {
    const variants = await getActiveSpecialVariants(userId);
    
    // Roll for GLITCHED first (higher priority)
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
 * Roll for SHINY or alG variant
 * Affected by variant luck multiplier
 */
async function rollBaseVariant(userId) {
    const variantLuck = await getVariantLuckMultiplier(userId);
    
    // Roll for alG first (rarer)
    const algChance = (VARIANT_CONFIG?.ALG?.multiplier || 1/1000) * variantLuck;
    if (Math.random() < algChance) {
        return {
            type: 'alG',
            tag: '[🌟alG]'
        };
    }
    
    // Roll for SHINY
    const shinyChance = (SHINY_CONFIG?.CHANCE || 1/100) * variantLuck;
    if (Math.random() < shinyChance) {
        return {
            type: 'SHINY',
            tag: '[✨SHINY]'
        };
    }
    
    return null;
}

/**
 * Apply variant to fumo name
 * Order: FumoName(RARITY)[BASE_VARIANT][SPECIAL_VARIANT]
 * Example: Reimu(TRANSCENDENT)[✨SHINY][🔮GLITCHED]
 */
function applyVariantToName(fumoName, baseVariant, specialVariant) {
    let suffix = '';
    
    // Add base variant first (SHINY or alG)
    if (baseVariant) {
        suffix += baseVariant.tag;
    }
    
    // Add special variant second (GLITCHED or VOID)
    if (specialVariant) {
        suffix += specialVariant.tag;
    }
    
    if (suffix) {
        return `${fumoName}${suffix}`;
    }
    
    return fumoName;
}

/**
 * Select and add a fumo to user's inventory with variant rolls
 */
async function selectAndAddFumo(userId, rarity, fumoPool) {
    // Check storage
    const storageCheck = await StorageLimitService.canAddFumos(userId, 1);
    if (!storageCheck.canAdd) {
        return { success: false, reason: 'storage_full', storageCheck };
    }
    
    // Handle both flat array and organized by rarity formats
    let rarityPool;
    if (Array.isArray(fumoPool)) {
        // Flat array - filter by rarity
        rarityPool = fumoPool.filter(f => f.rarity === rarity);
    } else {
        // Object organized by rarity
        rarityPool = fumoPool[rarity];
    }
    
    if (!rarityPool || rarityPool.length === 0) {
        debugLog(`[INVENTORY] No fumos found for rarity: ${rarity}`);
        return { success: false, reason: 'no_fumos' };
    }
    
    // Select fumo with ASTRAL+ duplicate blocking (S!gil feature)
    let baseFumo;
    let attempts = 0;
    const maxAttempts = Math.min(rarityPool.length, 10); // Try up to 10 times or pool size
    
    do {
        baseFumo = rarityPool[Math.floor(Math.random() * rarityPool.length)];
        attempts++;
        
        // Check if this fumo should be blocked (ASTRAL+ duplicate)
        const shouldReroll = await checkAstralDuplicateBlock(userId, baseFumo.name, rarity);
        
        if (!shouldReroll) {
            break; // Found a non-duplicate, use it
        }
        
        debugLog(`[SIGIL] Re-rolling ASTRAL+ duplicate (attempt ${attempts}/${maxAttempts})`);
    } while (attempts < maxAttempts);
    let finalName = baseFumo.name;
    
    // Roll for base variant (SHINY or alG)
    const baseVariant = await rollBaseVariant(userId);
    
    // Roll for special variant (GLITCHED or VOID)
    const specialVariant = await rollSpecialVariant(userId, finalName);
    
    // Apply variants to name
    finalName = applyVariantToName(finalName, baseVariant, specialVariant);
    
    // Add to inventory - use check-then-insert pattern for compatibility
    const existingFumo = await get(
        `SELECT id, quantity FROM userInventory WHERE userId = ? AND fumoName = ?`,
        [userId, finalName]
    );
    
    if (existingFumo) {
        await run(
            `UPDATE userInventory SET quantity = quantity + 1 WHERE id = ?`,
            [existingFumo.id]
        );
    } else {
        await run(
            `INSERT INTO userInventory (userId, fumoName, quantity, rarity) VALUES (?, ?, 1, ?)`,
            [userId, finalName, rarity]
        );
    }
    
    // Track shiny for weekly stats
    if (baseVariant?.type === 'SHINY') {
        await incrementWeeklyShiny(userId);
    }
    
    return {
        success: true,
        fumo: {
            name: finalName,
            baseName: baseFumo.name,
            rarity,
            picture: baseFumo.picture,
            baseVariant: baseVariant?.type || null,
            specialVariant: specialVariant?.type || null,
            isShiny: baseVariant?.type === 'SHINY',
            isAlG: baseVariant?.type === 'alG',
            isGlitched: specialVariant?.type === 'GLITCHED',
            isVoid: specialVariant?.type === 'VOID'
        }
    };
}

/**
 * Select and add multiple fumos - OPTIMIZED for batch operations
 */
async function selectAndAddMultipleFumos(userId, rarities, fumoPool) {
    // Check storage once at the start
    const storageCheck = await StorageLimitService.canAddFumos(userId, rarities.length);
    if (!storageCheck.canAdd) {
        return [{ success: false, reason: 'storage_full', storageCheck }];
    }
    
    const results = [];
    const fumoUpdates = new Map(); // Track fumo name -> {count, rarity, fumoData}
    let shinyCount = 0;
    
    // First pass: determine all fumos and variants without DB writes
    for (const rarity of rarities) {
        // Handle both flat array and organized by rarity formats
        let rarityPool;
        if (Array.isArray(fumoPool)) {
            rarityPool = fumoPool.filter(f => f.rarity === rarity);
        } else {
            rarityPool = fumoPool[rarity];
        }
        
        if (!rarityPool || rarityPool.length === 0) {
            results.push({ success: false, reason: 'no_fumos' });
            continue;
        }
        
        // Select base fumo
        const baseFumo = rarityPool[Math.floor(Math.random() * rarityPool.length)];
        let finalName = baseFumo.name;
        
        // Roll for variants
        const baseVariant = await rollBaseVariant(userId);
        const specialVariant = await rollSpecialVariant(userId, finalName);
        
        // Apply variants to name
        finalName = applyVariantToName(finalName, baseVariant, specialVariant);
        
        // Track for batch update
        if (fumoUpdates.has(finalName)) {
            const existing = fumoUpdates.get(finalName);
            existing.count++;
        } else {
            fumoUpdates.set(finalName, { count: 1, rarity, baseFumo });
        }
        
        // Track shiny count
        if (baseVariant?.type === 'SHINY') {
            shinyCount++;
        }
        
        results.push({
            success: true,
            fumo: {
                name: finalName,
                baseName: baseFumo.name,
                rarity,
                picture: baseFumo.picture,
                baseVariant: baseVariant?.type || null,
                specialVariant: specialVariant?.type || null,
                isShiny: baseVariant?.type === 'SHINY',
                isAlG: baseVariant?.type === 'alG',
                isGlitched: specialVariant?.type === 'GLITCHED',
                isVoid: specialVariant?.type === 'VOID'
            }
        });
    }
    
    // Second pass: batch update database
    // Get all existing fumos for this user in one query
    const fumoNames = Array.from(fumoUpdates.keys());
    if (fumoNames.length > 0) {
        const placeholders = fumoNames.map(() => '?').join(',');
        const existingFumos = await all(
            `SELECT id, fumoName, quantity FROM userInventory WHERE userId = ? AND fumoName IN (${placeholders})`,
            [userId, ...fumoNames]
        );
        
        const existingMap = new Map();
        for (const row of existingFumos) {
            existingMap.set(row.fumoName, row);
        }
        
        // Batch updates and inserts
        for (const [fumoName, data] of fumoUpdates) {
            const existing = existingMap.get(fumoName);
            if (existing) {
                await run(
                    `UPDATE userInventory SET quantity = quantity + ? WHERE id = ?`,
                    [data.count, existing.id]
                );
            } else {
                await run(
                    `INSERT INTO userInventory (userId, fumoName, quantity, rarity) VALUES (?, ?, ?, ?)`,
                    [userId, fumoName, data.count, data.rarity]
                );
            }
        }
    }
    
    // Update shiny count once (fire and forget - these are async DB writes)
    if (shinyCount > 0) {
        // Call incrementWeeklyShiny multiple times - it's async callback based
        for (let i = 0; i < shinyCount; i++) {
            incrementWeeklyShiny(userId);
        }
    }
    
    return results;
}

module.exports = {
    selectAndAddFumo,
    selectAndAddMultipleFumos,
    getActiveSpecialVariants,
    getVariantLuckMultiplier,
    rollBaseVariant,
    rollSpecialVariant,
    applyVariantToName,
    shouldBlockAstralDuplicate,
    checkAstralDuplicateBlock,
    SPECIAL_VARIANTS
};