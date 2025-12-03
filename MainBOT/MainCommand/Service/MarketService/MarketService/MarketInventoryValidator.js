const { all } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');

function getBaseFumoNameWithRarity(fumoName) {
    if (!fumoName) return '';
    
    return fumoName
        .replace(/\[✨SHINY\]/g, '')
        .replace(/\[🌟alG\]/g, '')
        .trim();
}

function extractTrait(fumoName) {
    if (!fumoName) return null;
    if (fumoName.includes('[🌟alG]')) return 'alG';
    if (fumoName.includes('[✨SHINY]')) return 'SHINY';
    return null;
}

async function validateUserHasFumo(userId, fumoName) {
    const baseWithRarity = getBaseFumoNameWithRarity(fumoName);
    
    debugLog('MARKET_VALIDATOR', `Checking inventory for ${fumoName}`);
    debugLog('MARKET_VALIDATOR', `  Base: ${baseWithRarity}`);
    
    const rows = await all(
        `SELECT id, fumoName, COUNT(*) as count 
         FROM userInventory 
         WHERE userId = ? 
         AND (
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ?
         )
         GROUP BY fumoName`,
        [userId, baseWithRarity, `${baseWithRarity}[✨SHINY]`, `${baseWithRarity}[🌟alG]`]
    );
    
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
    
    const exactMatch = await all(
        `SELECT id FROM userInventory 
         WHERE userId = ? AND fumoName = ? 
         LIMIT 1`,
        [userId, fumoName]
    );
    
    if (exactMatch && exactMatch.length > 0) {
        debugLog('MARKET_VALIDATOR', `Found exact match for ${fumoName}`);
        return exactMatch[0].id;
    }
    
    const anyVariant = await all(
        `SELECT id, fumoName FROM userInventory 
         WHERE userId = ? 
         AND (
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ?
         )
         LIMIT 1`,
        [userId, baseWithRarity, `${baseWithRarity}[✨SHINY]`, `${baseWithRarity}[🌟alG]`]
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
        `SELECT fumoName, COUNT(*) as count 
         FROM userInventory 
         WHERE userId = ? 
         AND (
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ?
         )
         GROUP BY fumoName`,
        [userId, baseWithRarity, `${baseWithRarity}[✨SHINY]`, `${baseWithRarity}[🌟alG]`]
    );
    
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
    
    if (hasShiny && hasAlG) {
        return { valid: false, error: 'MULTIPLE_TRAITS' };
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