const { all } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');

function getBaseFumoNameWithRarity(fumoName) {
    if (!fumoName) return '';
    
    return fumoName
        .replace(/\[✨SHINY\]/g, '')
        .replace(/\[🌟alG\]/g, '')
        .replace(/\[🔮GLITCHED\]/g, '')
        .replace(/\[🌀VOID\]/g, '')
        .trim();
}

function extractTrait(fumoName) {
    if (!fumoName) return null;
    if (fumoName.includes('[🌀VOID]')) return 'VOID';
    if (fumoName.includes('[🔮GLITCHED]')) return 'GLITCHED';
    if (fumoName.includes('[🌟alG]')) return 'alG';
    if (fumoName.includes('[✨SHINY]')) return 'SHINY';
    return null;
}

async function validateUserHasFumo(userId, fumoName) {
    const baseWithRarity = getBaseFumoNameWithRarity(fumoName);
    const requestedTrait = extractTrait(fumoName);
    
    debugLog('MARKET_VALIDATOR', `Checking inventory for ${fumoName}`);
    debugLog('MARKET_VALIDATOR', `  Base: ${baseWithRarity}`);
    debugLog('MARKET_VALIDATOR', `  Requested trait: ${requestedTrait || 'Base'}`);
    
    let rows;
    
    if (requestedTrait === 'VOID') {
        rows = await all(
            `SELECT id, fumoName, COUNT(*) as count 
             FROM userInventory 
             WHERE userId = ? 
             AND fumoName LIKE ?
             AND fumoName LIKE '%[🌀VOID]%'
             GROUP BY fumoName`,
            [userId, `${baseWithRarity}%`]
        );
    } else if (requestedTrait === 'GLITCHED') {
        rows = await all(
            `SELECT id, fumoName, COUNT(*) as count 
             FROM userInventory 
             WHERE userId = ? 
             AND fumoName LIKE ?
             AND fumoName LIKE '%[🔮GLITCHED]%'
             GROUP BY fumoName`,
            [userId, `${baseWithRarity}%`]
        );
    } else if (requestedTrait === 'alG') {
        rows = await all(
            `SELECT id, fumoName, COUNT(*) as count 
             FROM userInventory 
             WHERE userId = ? 
             AND fumoName LIKE ?
             AND fumoName LIKE '%[🌟alG]%'
             GROUP BY fumoName`,
            [userId, `${baseWithRarity}%`]
        );
    } else if (requestedTrait === 'SHINY') {
        rows = await all(
            `SELECT id, fumoName, COUNT(*) as count 
             FROM userInventory 
             WHERE userId = ? 
             AND fumoName LIKE ?
             AND fumoName LIKE '%[✨SHINY]%'
             GROUP BY fumoName`,
            [userId, `${baseWithRarity}%`]
        );
    } else {
        // Base variant - get all variants
        rows = await all(
            `SELECT id, fumoName, COUNT(*) as count 
             FROM userInventory 
             WHERE userId = ? 
             AND (
                 fumoName = ? OR
                 fumoName = ? OR
                 fumoName = ? OR
                 fumoName = ? OR
                 fumoName = ?
             )
             GROUP BY fumoName`,
            [userId, baseWithRarity, `${baseWithRarity}[✨SHINY]`, `${baseWithRarity}[🌟alG]`, `${baseWithRarity}[🔮GLITCHED]`, `${baseWithRarity}[🌀VOID]`]
        );
    }
    
    if (!rows || rows.length === 0) {
        debugLog('MARKET_VALIDATOR', `  ❌ Not found in inventory`);
        return { 
            found: false, 
            variants: [] 
        };
    }
    
    const variants = rows.map(row => ({
        fumoName: row.fumoName,
        count: row.count,
        id: row.id
    }));
    
    debugLog('MARKET_VALIDATOR', `  ✅ Found ${variants.length} variant(s):`);
    variants.forEach(v => {
        debugLog('MARKET_VALIDATOR', `     - ${v.fumoName} (x${v.count})`);
    });
    
    return { 
        found: true, 
        variants 
    };
}

async function getFumoIdForRemoval(userId, fumoName) {
    const baseWithRarity = getBaseFumoNameWithRarity(fumoName);
    const requestedTrait = extractTrait(fumoName);
    
    debugLog('MARKET_VALIDATOR', `[getFumoIdForRemoval] Looking for: ${fumoName}`);
    debugLog('MARKET_VALIDATOR', `  Base: ${baseWithRarity}`);
    debugLog('MARKET_VALIDATOR', `  Trait: ${requestedTrait || 'Base'}`);
    
    let exactMatch;
    
    if (requestedTrait === 'VOID') {
        exactMatch = await all(
            `SELECT id, fumoName FROM userInventory 
             WHERE userId = ? 
             AND fumoName LIKE ?
             AND fumoName LIKE '%[🌀VOID]%'
             LIMIT 1`,
            [userId, `${baseWithRarity}%`]
        );
    } else if (requestedTrait === 'GLITCHED') {
        exactMatch = await all(
            `SELECT id, fumoName FROM userInventory 
             WHERE userId = ? 
             AND fumoName LIKE ?
             AND fumoName LIKE '%[🔮GLITCHED]%'
             LIMIT 1`,
            [userId, `${baseWithRarity}%`]
        );
    } else if (requestedTrait === 'alG') {
        exactMatch = await all(
            `SELECT id, fumoName FROM userInventory 
             WHERE userId = ? 
             AND fumoName LIKE ?
             AND fumoName LIKE '%[🌟alG]%'
             LIMIT 1`,
            [userId, `${baseWithRarity}%`]
        );
    } else if (requestedTrait === 'SHINY') {
        exactMatch = await all(
            `SELECT id, fumoName FROM userInventory 
             WHERE userId = ? 
             AND fumoName LIKE ?
             AND fumoName LIKE '%[✨SHINY]%'
             LIMIT 1`,
            [userId, `${baseWithRarity}%`]
        );
    } else {
        exactMatch = await all(
            `SELECT id, fumoName FROM userInventory 
             WHERE userId = ? AND fumoName = ? 
             LIMIT 1`,
            [userId, fumoName]
        );
    }
    
    if (exactMatch && exactMatch.length > 0) {
        debugLog('MARKET_VALIDATOR', `✅ Found exact match: ${exactMatch[0].fumoName}`);
        return exactMatch[0].id;
    }
    
    // Fallback: find any variant
    const anyVariant = await all(
        `SELECT id, fumoName FROM userInventory 
         WHERE userId = ? 
         AND (
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ?
         )
         LIMIT 1`,
        [userId, baseWithRarity, `${baseWithRarity}[✨SHINY]`, `${baseWithRarity}[🌟alG]`, `${baseWithRarity}[🔮GLITCHED]`, `${baseWithRarity}[🌀VOID]`]
    );
    
    if (anyVariant && anyVariant.length > 0) {
        debugLog('MARKET_VALIDATOR', `Found variant ${anyVariant[0].fumoName} for requested ${fumoName}`);
        return anyVariant[0].id;
    }
    
    debugLog('MARKET_VALIDATOR', `❌ No fumo found for ${fumoName}`);
    return null;
}

async function getAvailableVariants(userId, baseFumoName) {
    const baseWithRarity = getBaseFumoNameWithRarity(baseFumoName);
    
    const rows = await all(
        `SELECT fumoName, SUM(quantity) as count 
         FROM userInventory 
         WHERE userId = ? 
         AND (
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ?
         )
         GROUP BY fumoName
         ORDER BY 
             CASE 
                 WHEN fumoName LIKE '%[🌀VOID]%' THEN 1
                 WHEN fumoName LIKE '%[🔮GLITCHED]%' THEN 2
                 WHEN fumoName LIKE '%[🌟alG]%' THEN 3
                 WHEN fumoName LIKE '%[✨SHINY]%' THEN 4
                 ELSE 5
             END`,
        [userId, baseWithRarity, `${baseWithRarity}[✨SHINY]`, `${baseWithRarity}[🌟alG]`, `${baseWithRarity}[🔮GLITCHED]`, `${baseWithRarity}[🌀VOID]`]
    );
    
    debugLog('MARKET_VALIDATOR', `[getAvailableVariants] Found variants for ${baseWithRarity}:`);
    rows.forEach(r => debugLog('MARKET_VALIDATOR', `  - ${r.fumoName} x${r.count}`));
    
    return rows || [];
}

async function hasMinimumCopies(userId, fumoName, minCopies = 1) {
    const validation = await validateUserHasFumo(userId, fumoName);
    
    if (!validation.found) return false;
    
    const totalCopies = validation.variants.reduce((sum, v) => sum + v.count, 0);
    return totalCopies >= minCopies;
}

function validateFumoNameFormat(fumoName) {
    if (!fumoName || typeof fumoName !== 'string') {
        return { valid: false, error: 'INVALID_NAME' };
    }
    
    if (!fumoName.includes('(') || !fumoName.includes(')')) {
        return { valid: false, error: 'MISSING_RARITY' };
    }
    
    const hasShiny = fumoName.includes('[✨SHINY]');
    const hasAlG = fumoName.includes('[🌟alG]');
    const hasGlitched = fumoName.includes('[🔮GLITCHED]');
    const hasVoid = fumoName.includes('[🌀VOID]');
    
    // Count base variants (SHINY/alG are mutually exclusive)
    const baseVariantCount = (hasShiny ? 1 : 0) + (hasAlG ? 1 : 0);
    // Count special variants (GLITCHED/VOID are mutually exclusive)
    const specialVariantCount = (hasGlitched ? 1 : 0) + (hasVoid ? 1 : 0);
    
    if (baseVariantCount > 1) {
        return { valid: false, error: 'MULTIPLE_BASE_TRAITS' };
    }
    
    if (specialVariantCount > 1) {
        return { valid: false, error: 'MULTIPLE_SPECIAL_TRAITS' };
    }
    
    return { valid: true };
}

module.exports = {
    getBaseFumoNameWithRarity,
    extractTrait,
    validateUserHasFumo,
    getFumoIdForRemoval,
    getAvailableVariants,
    hasMinimumCopies,
    validateFumoNameFormat
};