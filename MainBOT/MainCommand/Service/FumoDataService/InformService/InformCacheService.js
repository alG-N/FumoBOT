const { get, all } = require('../../../Core/database');

const informCache = new Map();
const CACHE_TTL = 30000;

function getCacheKey(userId, fumoName, variant) {
    return `${userId}_${fumoName}_${variant}`;
}

function stripVariantTags(fumoName) {
    return fumoName
        .replace(/\[✨SHINY\]/gi, '')
        .replace(/\[🌟alG\]/gi, '')
        .replace(/\[🌀VOID\]/gi, '')
        .replace(/\[🔮GLITCHED\]/gi, '')
        .trim();
}

async function getFumoOwnershipData(userId, fumoName, variant = 'NORMAL') {
    const cacheKey = getCacheKey(userId, fumoName, variant);
    const cached = informCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const baseFumoName = stripVariantTags(fumoName);
    
    let variantPattern = baseFumoName;
    if (variant === 'SHINY') {
        variantPattern = `${baseFumoName}[✨SHINY]`;
    } else if (variant === 'ALG') {
        variantPattern = `${baseFumoName}[🌟alG]`;
    } else if (variant === 'VOID') {
        variantPattern = `${baseFumoName}[🌀VOID]`;
    } else if (variant === 'GLITCHED') {
        variantPattern = `${baseFumoName}[🔮GLITCHED]`;
    }

    const [userFumos, totalCount, normalCount, shinyCount, algCount, voidCount, glitchedCount, userCount] = await Promise.all([
        all(`SELECT dateObtained FROM userInventory WHERE userId = ? AND fumoName = ? ORDER BY dateObtained`, [userId, variantPattern]),
        
        all(`SELECT fumoName FROM userInventory WHERE fumoName LIKE ?`, [`${baseFumoName}%`]),
        
        all(`SELECT fumoName FROM userInventory WHERE fumoName = ?`, [baseFumoName]),
        
        all(`SELECT fumoName FROM userInventory WHERE fumoName = ?`, [`${baseFumoName}[✨SHINY]`]),
        
        all(`SELECT fumoName FROM userInventory WHERE fumoName = ?`, [`${baseFumoName}[🌟alG]`]),

        all(`SELECT fumoName FROM userInventory WHERE fumoName = ?`, [`${baseFumoName}[🌀VOID]`]),
        
        all(`SELECT fumoName FROM userInventory WHERE fumoName = ?`, [`${baseFumoName}[🔮GLITCHED]`]),
        
        all(`SELECT DISTINCT userId FROM userInventory WHERE fumoName LIKE ?`, [`${baseFumoName}%`])
    ]);

    const data = {
        userOwns: userFumos.length > 0,
        userQuantity: userFumos.length,
        firstObtained: userFumos[0]?.dateObtained || null,
        totalExistence: totalCount.length,
        normalExistence: normalCount.length,
        shinyExistence: shinyCount.length,
        algExistence: algCount.length,
        voidExistence: voidCount.length,
        glitchedExistence: glitchedCount.length,
        uniqueOwners: userCount.length,
        variantExistence: variant === 'NORMAL' ? normalCount.length : 
                        variant === 'SHINY' ? shinyCount.length : 
                        variant === 'ALG' ? algCount.length :
                        variant === 'VOID' ? voidCount.length :
                        variant === 'GLITCHED' ? glitchedCount.length : 0
    };

    informCache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });

    return data;
}

function clearCache(userId = null, fumoName = null, variant = null) {
    if (userId && fumoName && variant) {
        informCache.delete(getCacheKey(userId, fumoName, variant));
    } else if (userId) {
        for (const key of informCache.keys()) {
            if (key.startsWith(userId)) {
                informCache.delete(key);
            }
        }
    } else {
        informCache.clear();
    }
}

setInterval(() => {
    const now = Date.now();
    for (const [key, { timestamp }] of informCache.entries()) {
        if (now - timestamp > CACHE_TTL) {
            informCache.delete(key);
        }
    }
}, 60000);

module.exports = {
    getFumoOwnershipData,
    clearCache
};